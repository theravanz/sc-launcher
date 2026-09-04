use reqwest::Client;
use std::path::PathBuf;
use std::io::Write;
use futures_util::StreamExt;
use sha1::{Sha1, Digest};

const MAX_RETRIES: u32 = 3;

pub async fn download_file_with_progress(
    client: &Client,
    url: &str,
    dest: &PathBuf,
    expected_sha1: Option<&str>,
    total_size: Option<i64>,
    on_progress: impl Fn(f64),
) -> Result<(), String> {

    if url.is_empty() {
        return Err(format!("Пустой URL для файла {:?}", dest.file_name().unwrap_or_default()));
    }

    // Если файл уже есть и SHA1 совпадает — пропускаем
    if dest.exists() {
        if let Some(expected) = expected_sha1 {
            if !expected.is_empty() {
                let actual = sha1_file(dest)?;
                if actual == expected {
                    on_progress(100.0);
                    return Ok(());
                } else {
                    // Файл битый — удаляем и скачиваем заново
                    std::fs::remove_file(dest).ok();
                }
            }
        }
    }

    let mut last_error = String::new();

    for attempt in 1..=MAX_RETRIES {
        match download_once(client, url, dest, total_size, &on_progress).await {
            Ok(()) => {
                // Проверяем SHA1 после скачивания (только если хэш не пустой!)
                if let Some(expected) = expected_sha1 {
                    if !expected.is_empty() {
                        let actual = sha1_file(dest)?;
                        if actual != expected {
                            std::fs::remove_file(dest).ok();
                            last_error = format!(
                                "SHA1 mismatch для {}. Ожидалось: {}, получено: {}",
                                dest.file_name().unwrap_or_default().to_string_lossy(),
                                expected,
                                actual
                            );
                            if attempt < MAX_RETRIES {
                                continue; // Пробуем ещё раз
                            }
                            return Err(last_error);
                        }
                    }
                }
                return Ok(());
            }
            Err(e) => {
                last_error = e;
                if attempt < MAX_RETRIES {
                    std::fs::remove_file(dest).ok();
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    continue;
                }
            }
        }
    }

    Err(format!(
        "Не удалось скачать {} после {} попыток: {}",
        dest.file_name().unwrap_or_default().to_string_lossy(),
        MAX_RETRIES,
        last_error
    ))
}

async fn download_once(
    client: &Client,
    url: &str,
    dest: &PathBuf,
    total_size: Option<i64>,
    on_progress: &impl Fn(f64),
) -> Result<(), String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Сетевая ошибка: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let total = total_size.unwrap_or_else(|| response.content_length().unwrap_or(0) as i64);
    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;

    let mut downloaded = 0i64;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as i64;

        if total > 0 {
            on_progress((downloaded as f64 / total as f64) * 100.0);
        }
    }

    Ok(())
}

pub fn sha1_file(path: &PathBuf) -> Result<String, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}