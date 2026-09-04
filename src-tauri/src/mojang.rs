use reqwest::Client;
use crate::types::{VersionManifest, VersionDetails, AssetsIndex};

const MOJANG_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

fn create_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Не удалось создать HTTP клиент: {}", e))
}

pub async fn get_version_details(version: &str) -> Result<VersionDetails, String> {
    let client = create_client()?;
    
    // 1. Получаем манифест
    let resp = client.get(MOJANG_MANIFEST_URL).send().await
        .map_err(|e| format!("Сетевая ошибка при запросе манифеста: {}", e))?;
    
    if !resp.status().is_success() {
        return Err(format!("Mojang Manifest вернул ошибку {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
    }

    let manifest: VersionManifest = resp.json().await
        .map_err(|e| format!("Ошибка парсинга JSON манифеста: {}", e))?;
    
    let version_entry = manifest.versions.iter()
        .find(|v| v.id == version)
        .ok_or_else(|| format!("Версия '{}' не найдена в манифесте Mojang", version))?;
    
    // 2. Получаем детали версии
    let version_url = &version_entry.url;
    let resp_details = client.get(version_url).send().await
        .map_err(|e| format!("Сетевая ошибка при запросе деталей версии (URL: {}): {}", version_url, e))?;

    if !resp_details.status().is_success() {
        // ВОТ ЗДЕСЬ МЫ УВИДИМ ТОЧНЫЙ URL, КОТОРЫЙ НЕ РАБОТАЕТ
        return Err(format!(
            "Mojang API вернул ошибку {} для URL версии:\n{}\nОтвет сервера: {}", 
            resp_details.status(), 
            version_url, 
            resp_details.text().await.unwrap_or_default()
        ));
    }
    
    let raw_text = resp_details.text().await.map_err(|e| e.to_string())?;
    
    let details: VersionDetails = serde_json::from_str(&raw_text).map_err(|e| {
        let snippet = if raw_text.len() > 300 { format!("{}...", &raw_text[..300]) } else { raw_text.clone() };
        format!("Mojang вернул не JSON! Ответ: {}\nОшибка: {}", snippet, e)
    })?;
    
    Ok(details)
}

pub async fn get_assets_index(details: &VersionDetails) -> Result<AssetsIndex, String> {
    let client = create_client()?;
    
    let url = if let Some(ref asset_index) = details.asset_index {
        asset_index.url.clone() // Берём прямой URL из JSON
    } else {
        format!("https://launchermeta.mojang.com/v1/packages/{}/{}.json", details.assets, details.assets)
    };
    
    let resp = client.get(&url).send().await
        .map_err(|e| format!("Сетевая ошибка при запросе индекса ассетов: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Mojang API вернул ошибку {}: {}", resp.status(), resp.text().await.unwrap_or_default()));
    }
    
    let raw_text = resp.text().await.map_err(|e| e.to_string())?;
    let index: AssetsIndex = serde_json::from_str(&raw_text)
        .map_err(|e| format!("Ошибка парсинга JSON ассетов: {}", e))?;
    
    Ok(index)
}