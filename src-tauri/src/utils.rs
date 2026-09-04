use std::path::PathBuf;
use std::io::Read;
use sha1::{Sha1, Digest};
use zip::ZipArchive;

use crate::types::Library;

/// Вычисляет SHA1 хэш файла (нужно для проверки целостности скачанных файлов Minecraft)
pub fn sha1_file(path: &PathBuf) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// Определяет, нужно ли скачивать библиотеку для текущей ОС
/// (например, не качать natives-macos.jar на Windows)
pub fn should_include_library(lib: &Library) -> bool {
    if lib.rules.is_empty() {
        return true;
    }

    let os_name = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };

    let mut allowed = false;

    for rule in &lib.rules {
        let matches_os = rule.os.as_ref().map(|o| o.name == os_name).unwrap_or(true);

        if rule.action == "allow" && matches_os {
            allowed = true;
        } else if rule.action == "disallow" && matches_os {
            allowed = false;
        }
    }

    allowed
}

/// Возвращает правильный суффикс для нативных библиотек в зависимости от ОС
pub fn get_os_classifier() -> String {
    if cfg!(windows) {
        "natives-windows".to_string()
    } else if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "natives-macos-arm64".to_string()
        } else {
            "natives-macos".to_string()
        }
    } else {
        "natives-linux".to_string()
    }
}

/// Извлекает файлы из .jar архива (используется для natives: .dll, .so, .dylib)
pub fn extract_natives(jar_path: &PathBuf, dest: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(jar_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();

        // Пропускаем служебные папки архива
        if name.starts_with("META-INF/") {
            continue;
        }

        let out_path = dest.join(&name);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let mut contents = Vec::new();
            entry.read_to_end(&mut contents).map_err(|e| e.to_string())?;
            std::fs::write(&out_path, &contents).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}