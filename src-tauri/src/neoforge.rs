use reqwest::Client;
use std::path::PathBuf;
use std::io::Read;
use std::collections::HashMap;
use zip::ZipArchive;
use serde_json::Value;

use crate::downloader::download_file_with_progress;
use crate::types::VersionDetails;

const NEOFORGE_MAVEN_URL: &str = "https://maven.neoforged.net/releases/net/neoforged/neoforge";

pub async fn get_neoforge_version_details(
    client: &Client,
    app_dir: &PathBuf,
    mc_version: &str,
    nf_version: &str,
    on_progress: impl Fn(f64, String),
) -> Result<VersionDetails, String> {
    let nf_dir = app_dir.join("versions").join(&format!("{}-neoforge-{}", mc_version, nf_version));
    std::fs::create_dir_all(&nf_dir).map_err(|e| e.to_string())?;
    
    on_progress(0.0, "Скачивание NeoForge installer...".to_string());
    
    let installer_url = format!(
        "{}/{}/neoforge-{}-installer.jar",
        NEOFORGE_MAVEN_URL, nf_version, nf_version
    );
    
    let installer_path = nf_dir.join("installer.jar");
    
    download_file_with_progress(
        client,
        &installer_url,
        &installer_path,
        None,
        None,
        |p| on_progress(p * 0.5, "Скачивание installer...".to_string()),
    ).await?;
    
    on_progress(50.0, "Извлечение конфигурации NeoForge...".to_string());
    
    let file = std::fs::File::open(&installer_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    let mut profile_data = Vec::new();
    let mut found = false;
    
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.name() == "install_profile.json" {
            entry.read_to_end(&mut profile_data).map_err(|e| e.to_string())?;
            found = true;
            break;
        }
    }
    
    if !found {
        return Err("Не удалось найти install_profile.json внутри installer.jar".to_string());
    }
    
    let profile: Value = serde_json::from_slice(&profile_data)
        .map_err(|e| format!("Ошибка парсинга install_profile.json: {}", e))?;
    
    on_progress(60.0, "Сборка конфигурации запуска...".to_string());
    
    let main_class = profile.get("mainClass")
        .and_then(|v| v.as_str())
        .unwrap_or("cpw.mods.bootstraplauncher.BootstrapLauncher")
        .to_string();
    
    let id = profile.get("version")
        .and_then(|v| v.as_str())
        .unwrap_or(&format!("{}-neoforge-{}", mc_version, nf_version))
        .to_string();
    
    let vanilla_details = crate::mojang::get_version_details(mc_version).await?;
    
    // === ПРОСТАЯ И НАДЕЖНАЯ ДЕДУПЛИКАЦИЯ: NeoForge ВСЕГДА перезаписывает ваниль ===
    let get_key = |name: &str| -> String {
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() >= 2 { format!("{}:{}", parts[0], parts[1]) } else { name.to_string() }
    };

    let mut library_map: HashMap<String, crate::types::Library> = HashMap::new();

    // 1. Сначала добавляем ванильные библиотеки
    for lib in vanilla_details.libraries.clone() {
        library_map.insert(get_key(&lib.name), lib);
    }

    // 2. Безусловно перезаписываем их библиотеками из NeoForge
    // Это гарантирует, что если NeoForge требует asm-util:9.10.1, он его получит,
    // независимо от того, что там было в ванили или в каком порядке идут записи.
    if let Some(libs_array) = profile.get("libraries").and_then(|v| v.as_array()) {
        for lib_val in libs_array {
            if let Ok(lib) = serde_json::from_value::<crate::types::Library>(lib_val.clone()) {
                library_map.insert(get_key(&lib.name), lib);
            }
        }
    }

    let libraries: Vec<crate::types::Library> = library_map.into_values().collect();
    
    eprintln!("✅ Собрано {} уникальных библиотек (приоритет у NeoForge)", libraries.len());

    let arguments = if let Some(args_val) = profile.get("arguments") {
        serde_json::from_value(args_val.clone()).unwrap_or_else(|_| {
            crate::types::Arguments { game: vec![], jvm: vec![] }
        })
    } else {
        crate::types::Arguments { game: vec![], jvm: vec![] }
    };
    
    let details = VersionDetails {
        id,
        arguments,
        assets: vanilla_details.assets,
        asset_index: vanilla_details.asset_index,
        downloads: vanilla_details.downloads,
        libraries,
        main_class,
    };
    
    let _ = std::fs::remove_file(&installer_path);
    
    on_progress(100.0, "Конфигурация NeoForge собрана!".to_string());
    
    Ok(details)
}