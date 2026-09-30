use std::path::PathBuf;
use std::process::Command;
use std::io::Read;
use std::collections::HashSet;
use reqwest::Client;
use zip::ZipArchive;
use serde_json::Value;

use crate::downloader::download_file_with_progress;
use crate::mojang::get_version_details;

pub struct LaunchContext {
    pub app_dir: PathBuf,
    pub mc_version: String,
    pub nf_version: String,
    pub java_path: PathBuf,
    pub memory_mb: i32,
    pub username: String,
    /// Финальный размер окна игры из настроек: (w, h) или (0, 0) для fullscreen.
    /// Уже ограничен разрешением монитора (см. commands::resolve_game_window).
    pub window: (u32, u32),
}

fn extract_natives(zip_path: &PathBuf, dest_dir: &PathBuf) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = dest_dir.join(file.name());
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// Выносим обработку в отдельную async функцию, чтобы использовать .await
async fn process_lib(
    lib: &crate::types::Library,
    seen_artifacts: &mut HashSet<String>,
    classpath: &mut Vec<PathBuf>,
    libraries_dir: &PathBuf,
    natives_dir: &PathBuf,
    client: &Client,
) -> Result<(), String> {
    // OS-фильтр по rules (не качать natives-macos на Linux и т.п.)
    if !crate::utils::should_include_library(lib) {
        return Ok(());
    }

    let file_name = lib.name.rsplit(':').next().unwrap_or("");
    let is_natives_jar = file_name.starts_with("natives-");

    // net.neoforged:neoforge:VERSION (без классификатора) = universal.jar.
    // Его НЕЛЬЗЯ класть в classpath: он создаёт в бутстрап-слое модуль "net.neoforged.neoforge",
    // который затеняет game-слой и ломает чтение модуля minecraft (NoClassDefFoundError: LoadingOverlay).
    let parts0: Vec<&str> = lib.name.split(':').collect();
    // net.neoforged:neoforge:* (universal/client/server) — НЕЛЬЗЯ класть в classpath:
    // они создают в бутстрап-слое модуль "net.neoforged.neoforge", который затеняет
    // game-слой и ломает чтение модуля minecraft (NoClassDefFoundError: LoadingOverlay).
    let is_neoforge = parts0.len() >= 2 && parts0[0] == "net.neoforged" && parts0[1] == "neoforge";
    if is_neoforge {
        return Ok(());
    }

    // Дедуп classpath по group:name, чтобы старые версии из ванильного профиля
    // (asm 9.3, guava 20.0 и т.д.) не попадали в classpath вместе с новыми
    let parts: Vec<&str> = lib.name.split(':').collect();
    // Ключ включает классификатор (4-я часть), чтобы :client не считался дублем обычного артефакта,
    // но игнорирует версию, чтобы старые версии из ванили не попадали в classpath
    let group_artifact = match parts.len() {
        0 | 1 => lib.name.clone(),
        2 | 3 => format!("{}:{}", parts[0], parts[1]),
        _ => format!("{}:{}:{}", parts[0], parts[1], parts[3]),
    };

    // natives-варианты (org.lwjgl:lwjgl:3.3.3:natives-linux) — отдельные библиотеки,
    // они не конфликтуют с обычными jar'ами и нужны для распаковки
    if !is_natives_jar {
        if seen_artifacts.contains(&group_artifact) {
            // Уже в classpath, но natives (classifiers) всё равно нужно обработать
            return handle_classifiers(lib, natives_dir, libraries_dir, client).await;
        }
        seen_artifacts.insert(group_artifact);
    }

    if let Some(artifact) = &lib.downloads.artifact {
    if !artifact.url.is_empty() {
        let lib_path = libraries_dir.join(&artifact.path);
        
        // ✅ Добавляем только .jar файлы
        if let Some(ext) = lib_path.extension() {
            if ext == "jar" {
                std::fs::create_dir_all(lib_path.parent().unwrap()).ok();
                
                if !lib_path.exists() || lib_path.metadata().map(|m| m.len() as i64).unwrap_or(0) != artifact.size {
                    download_file_with_progress(
                        client, &artifact.url, &lib_path,
                        Some(&artifact.sha1), Some(artifact.size),
                        |_| {},
                    ).await?;
                }
                if is_natives_jar {
                    // natives-jar: распаковываем в natives_dir, в classpath не добавляем
                    extract_natives(&lib_path, natives_dir)?;
                } else {
                    classpath.push(lib_path);
                }
            } else {
                // ⚠️ Это не JAR - скачиваем, но НЕ добавляем в classpath
                eprintln!("⚠️ Пропускаем не-JAR файл в classpath: {}", lib_path.display());
                // Но всё равно скачиваем, если нужно
                if !lib_path.exists() {
                    download_file_with_progress(
                        client, &artifact.url, &lib_path,
                        Some(&artifact.sha1), Some(artifact.size),
                        |_| {},
                    ).await?;
                }
            }
        }
    }
}
    
    handle_classifiers(lib, natives_dir, libraries_dir, client).await
}

/// Скачивает и распаковывает natives (classifiers) библиотеки
async fn handle_classifiers(
    lib: &crate::types::Library,
    natives_dir: &PathBuf,
    libraries_dir: &PathBuf,
    client: &Client,
) -> Result<(), String> {
    if let Some(classifiers) = &lib.downloads.classifiers {
        let os_name = if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "osx" } else { "linux" };
        let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "" };
        let os_arch = if arch.is_empty() { os_name.to_string() } else { format!("{}-{}", os_name, arch) };
        
        if let Some(native_artifact) = classifiers.get(&os_arch).or_else(|| classifiers.get(os_name)) {
            if !native_artifact.url.is_empty() {
                let native_path = libraries_dir.join(&native_artifact.path);
                std::fs::create_dir_all(native_path.parent().unwrap()).ok();
                
                if !native_path.exists() {
                    download_file_with_progress(
                        client, &native_artifact.url, &native_path,
                        Some(&native_artifact.sha1), Some(native_artifact.size),
                        |_| {},
                    ).await?;
                }
                extract_natives(&native_path, natives_dir)?;
            }
        }
    }
    Ok(())
}

pub async fn launch_minecraft(
    ctx: &LaunchContext,
    on_progress: impl Fn(f64, String),
) -> Result<(), String> {
    let version_id = format!("{}-neoforge-{}", ctx.mc_version, ctx.nf_version);
    let instance_dir = ctx.app_dir.join("versions").join(&version_id);
    let libraries_dir = ctx.app_dir.join("libraries");
    let assets_dir = ctx.app_dir.join("assets");
    let natives_dir = instance_dir.join("natives");
    
    std::fs::create_dir_all(&instance_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&libraries_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;
    
    let client = Client::new();
    let installer_path = instance_dir.join("installer.jar");
    let profile_json_path = instance_dir.join("install_profile.json");

    // === ШАГ 1: Скачиваем installer и извлекаем install_profile.json + version.json ===
    let version_json_path = instance_dir.join("version.json");
    if !profile_json_path.exists() || !version_json_path.exists() {
        on_progress(5.0, "Скачивание установщика NeoForge...".to_string());
        let installer_url = format!(
            "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
            ctx.nf_version, ctx.nf_version
        );
        
        download_file_with_progress(
            &client, &installer_url, &installer_path, None, None,
            |p| on_progress(5.0 + p * 0.25, "Скачивание installer...".to_string()),
        ).await?;
        
        on_progress(30.0, "Извлечение install_profile.json и version.json...".to_string());
        let mut found = profile_json_path.exists();
        if !found {
            let file = std::fs::File::open(&installer_path).map_err(|e| e.to_string())?;
            let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
            for i in 0..archive.len() {
                let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
                if entry.name() == "install_profile.json" {
                    let mut json_data = Vec::new();
                    entry.read_to_end(&mut json_data).map_err(|e| e.to_string())?;
                    std::fs::write(&profile_json_path, json_data).map_err(|e| e.to_string())?;
                    found = true;
                    break;
                }
            }
        }
        
        // Также извлекаем version.json (полные аргументы запуска)
        let version_json_path = instance_dir.join("version.json");
        let mut found_version_json = false;
        let file = std::fs::File::open(&installer_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            if entry.name() == "version.json" {
                let mut json_data = Vec::new();
                entry.read_to_end(&mut json_data).map_err(|e| e.to_string())?;
                std::fs::write(&version_json_path, json_data).map_err(|e| e.to_string())?;
                found_version_json = true;
                break;
            }
        }
        if !found_version_json {
            eprintln!("⚠️ version.json не найден в installer, используем install_profile.json для аргументов");
        }

        if !found {
            return Err("Не удалось найти install_profile.json внутри installer.jar".to_string());
        }
        
        std::fs::remove_file(&installer_path).ok();
    }

    // === ШАГ 2: Читаем эталонный JSON ===
    on_progress(40.0, "Чтение конфигурации NeoForge...".to_string());
    let json_data = std::fs::read_to_string(&profile_json_path).map_err(|e| e.to_string())?;
    let install_profile: Value = serde_json::from_str(&json_data).map_err(|e| e.to_string())?;
    
    // Полные аргументы запуска лежат в version.json (arguments, mainClass)
    let profile: Value = if instance_dir.join("version.json").exists() {
        let vd = std::fs::read_to_string(instance_dir.join("version.json")).map_err(|e| e.to_string())?;
        serde_json::from_str(&vd).map_err(|e| e.to_string())?
    } else {
        install_profile.clone()
    };
    
    let main_class = profile.get("mainClass").and_then(|v| v.as_str()).or_else(|| install_profile.get("mainClass").and_then(|v| v.as_str())).unwrap_or("cpw.mods.bootstraplauncher.BootstrapLauncher").to_string();
    let id = profile.get("id").and_then(|v| v.as_str()).or_else(|| install_profile.get("version").and_then(|v| v.as_str())).unwrap_or(&version_id).to_string();
    
    let vanilla_details = get_version_details(&ctx.mc_version).await?;

    // === ШАГ 3: Безопасная сборка библиотек ===
on_progress(50.0, "Обработка библиотек...".to_string());

let mut seen_artifacts: HashSet<String> = HashSet::new();
let mut classpath = Vec::new();

// Сначала библиотеки из version.json (эталон для NeoForge)
if let Some(libs) = profile.get("libraries").and_then(|v| v.as_array()) {
    for lib_val in libs {
        let lib: crate::types::Library = serde_json::from_value(lib_val.clone())
            .map_err(|e| e.to_string())?;
        process_lib(&lib, &mut seen_artifacts, &mut classpath, &libraries_dir, &natives_dir, &client).await?;
    }
}
// Затем из install_profile.json
if let Some(libs) = install_profile.get("libraries").and_then(|v| v.as_array()) {
    for lib_val in libs {
        let lib: crate::types::Library = serde_json::from_value(lib_val.clone())
            .map_err(|e| e.to_string())?;
        process_lib(&lib, &mut seen_artifacts, &mut classpath, &libraries_dir, &natives_dir, &client).await?;
    }
}

// Затем добавляем ванильные
for lib in &vanilla_details.libraries {
    process_lib(lib, &mut seen_artifacts, &mut classpath, &libraries_dir, &natives_dir, &client).await?;
}

eprintln!("✅ Собрано {} уникальных библиотек", classpath.len());

// === ШАГ 3.5: Скачивание ассетов (РЕСУРСОВ) ===
    on_progress(60.0, "Скачивание ресурсов...".to_string());
    
    // Получаем ID и URL индекса ассетов из профиля или ванильных деталей
    let asset_index = vanilla_details.asset_index.as_ref()
        .expect("asset_index обязателен для запуска Minecraft");

    let asset_index_id = profile.get("assetIndex")
        .and_then(|a| a.get("id")).and_then(|s| s.as_str())
        .unwrap_or(&asset_index.id);
    
    let asset_index_url = profile.get("assetIndex")
        .and_then(|a| a.get("url")).and_then(|s| s.as_str())
        .unwrap_or(&asset_index.url);

    let indexes_dir = assets_dir.join("indexes");
    std::fs::create_dir_all(&indexes_dir).map_err(|e| e.to_string())?;
    let index_file = indexes_dir.join(format!("{}.json", asset_index_id));
    
    // 1. Скачиваем сам индекс (файл 17.json)
    if !index_file.exists() {
        download_file_with_progress(
            &client,
            asset_index_url,
            &index_file,
            None,
            None,
            |p| on_progress(60.0 + p * 0.1, format!("Скачивание индекса ресурсов {}...", asset_index_id)),
        ).await?;
    }
    
    // 2. Парсим индекс и скачиваем отдельные файлы ресурсов (звуки, текстуры и т.д.)
    let index_data = std::fs::read_to_string(&index_file).map_err(|e| e.to_string())?;
    let index_json: Value = serde_json::from_str(&index_data).map_err(|e| e.to_string())?;
    
    if let Some(objects) = index_json.get("objects").and_then(|v| v.as_object()) {
        let total_objects = objects.len();
        let objects_dir = assets_dir.join("objects");
        std::fs::create_dir_all(&objects_dir).map_err(|e| e.to_string())?;
        
        for (i, (_, obj)) in objects.iter().enumerate() {
            let hash = obj.get("hash").and_then(|v| v.as_str()).unwrap_or("");
            if hash.is_empty() { continue; }
            
            let hash_prefix = &hash[..2];
            let object_path = objects_dir.join(hash_prefix).join(hash);
            
            if !object_path.exists() {
                let object_url = format!("https://resources.download.minecraft.net/{}/{}", hash_prefix, hash);
                let size = obj.get("size").and_then(|v| v.as_i64());
                
                download_file_with_progress(
                    &client,
                    &object_url,
                    &object_path,
                    Some(hash),
                    size,
                    |_| {},
                ).await?;
            }
            
            if i % 100 == 0 {
                on_progress(70.0 + (10.0 * (i as f64 / total_objects as f64)), format!("Скачивание ресурсов {}/{}", i + 1, total_objects));
            }
        }
    }


// === Пропатченный клиентский jar (game jar) ===
// Реальные классы Minecraft находятся в пропатченном инсталлером neoforge-<v>-client.jar.
// Если его нет — запускаем официальный installer (--installClient), который применит
// бинарные патчи к ванильному client.jar.
let patched_client_name = format!("neoforge-{}-client.jar", ctx.nf_version);
let patched_client_main = libraries_dir.join("net/neoforged/neoforge")
    .join(&ctx.nf_version)
    .join(&patched_client_name);
// Возможное старое расположение: инсталлер ранее мог быть запущен с instance_dir как корнем
let patched_client_legacy = instance_dir.join("libraries/net/neoforged/neoforge")
    .join(&ctx.nf_version)
    .join(&patched_client_name);
// FML сам ищет пропатченный клиент в libraryDirectory (общая libraries) по maven-координатам
// net.neoforged:neoforge:<v>:client, поэтому он обязан лежать именно там
let patched_client = if !patched_client_main.exists() && patched_client_legacy.exists() {
    std::fs::create_dir_all(patched_client_main.parent().unwrap()).ok();
    std::fs::copy(&patched_client_legacy, &patched_client_main).map_err(|e| e.to_string())?;
    patched_client_main
} else {
    patched_client_main
};

if !patched_client.exists() {
    on_progress(52.0, "Установка NeoForge (применение патчей)...".to_string());
    let installer_path = instance_dir.join("installer.jar");
    if !installer_path.exists() {
        let installer_url = format!(
            "https://maven.neoforged.net/releases/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
            ctx.nf_version, ctx.nf_version
        );
        download_file_with_progress(
            &client, &installer_url, &installer_path, None, None,
            |p| on_progress(52.0 + p * 0.05, "Скачивание installer...".to_string()),
        ).await?;
    }
    let installer_output = Command::new(&ctx.java_path)
        .args(["-jar", installer_path.to_str().unwrap(), "--installClient", ctx.app_dir.to_str().unwrap()])
        .current_dir(&ctx.app_dir)
        .output()
        .map_err(|e| format!("Не удалось запустить installer: {}", e))?;
    if !installer_output.status.success() {
        return Err(format!(
            "Установка NeoForge не удалась:
{}",
            String::from_utf8_lossy(&installer_output.stderr)
        ));
    }
    std::fs::remove_file(&installer_path).ok();
}

if !patched_client.exists() {
    return Err("Пропатченный клиентский jar не найден после установки".to_string());
}

// Копируем пропатченный клиент на место primary jar (как это делает официальный инсталлер).
// BootstrapLauncher исключит его из модулей через -DignoreList (client-extra,<version>.jar).
let primary_jar = instance_dir.join(format!("{}.jar", id));
std::fs::copy(&patched_client, &primary_jar).map_err(|e| e.to_string())?;
let client_jar_path = primary_jar.to_str().unwrap().to_string();
classpath.push(primary_jar.clone());

// FML строит модуль 'minecraft' из net.minecraft:client::srg и ::extra, которые инсталлер
// генерирует в libraryDirectory. Они могут остаться от ранней установки в instance_dir/libraries.
// Копируем их в общую libraries (net/minecraft/client/<mc>-<neoform>/), где их ищет FML.
let client_mc_rel = instance_dir.join("libraries/net/minecraft/client");
if client_mc_rel.exists() {
    let legacy_client_root = client_mc_rel;
    let dest_root = libraries_dir.join("net/minecraft/client");
    if let Ok(entries) = std::fs::read_dir(&legacy_client_root) {
        for ver_dir in entries.flatten() {
            let ver_name = ver_dir.file_name();
            if let Ok(src_entries) = std::fs::read_dir(ver_dir.path()) {
                for file in src_entries.flatten() {
                    let fname = file.file_name().to_string_lossy().into_owned();
                    if (fname.contains("-srg.jar") || fname.contains("-extra.jar") || fname.contains("-slim.jar"))
                        && file.path().is_file()
                    {
                        let dest_dir = dest_root.join(&ver_name);
                        std::fs::create_dir_all(&dest_dir).ok();
                        let dest = dest_dir.join(&fname);
                        if !dest.exists() {
                            std::fs::copy(file.path(), &dest).map_err(|e| e.to_string())?;
                            eprintln!("📦 Скопировали client-артефакт FML: {}", dest.display());
                        }
                    }
                }
            }
        }
    }
}

let cp_sep = if cfg!(windows) { ";" } else { ":" };
let classpath_str = classpath.iter()
    .map(|p| p.to_str().unwrap().to_string())
    .collect::<Vec<_>>()
    .join(cp_sep);

eprintln!("📦 Классов в classpath: {}", classpath.len());

    // === ШАГ 4: Формирование аргументов из JSON ===
    on_progress(80.0, "Формирование аргументов...".to_string());
    
    let natives_dir_str = natives_dir.to_str().unwrap();
    let assets_root = assets_dir.to_str().unwrap();
    let game_dir = ctx.app_dir.to_str().unwrap();
    let asset_index = profile.get("assetIndex").and_then(|a| a.get("id")).and_then(|s| s.as_str()).unwrap_or("17");
    let cp_sep = if cfg!(windows) { ";" } else { ":" };
    
    let replace = |s: &str| -> String {
        s.replace("${natives_directory}", natives_dir_str)
         .replace("${classpath_separator}", cp_sep)
         .replace("${library_directory}", libraries_dir.to_str().unwrap())
         .replace("${primary_jar}", &client_jar_path)
         .replace("${version_name}", &id)
         .replace("${game_directory}", game_dir)
         .replace("${assets_root}", assets_root)
         .replace("${asset_index}", asset_index)
         .replace("${auth_player_name}", &ctx.username)
         .replace("${auth_uuid}", "00000000-0000-0000-0000-000000000000")
         .replace("${auth_access_token}", "0")
         .replace("${user_type}", "msa")
         .replace("${version_type}", "release")
    };

    let mut args: Vec<String> = Vec::new();

// 1. JVM аргументы из JSON (если есть)
if let Some(jvm_args) = profile.get("arguments")
    .and_then(|a| a.get("jvm"))
    .and_then(|v| v.as_array()) 
{
    for arg in jvm_args {
        if let Some(s) = arg.as_str() {
            args.push(replace(s));
        }
    }
}

// 2. Обязательные JVM аргументы (даже если их нет в JSON)
let mandatory_opens = [
    "java.base/java.lang.invoke=ALL-UNNAMED",
    "java.base/java.lang.reflect=ALL-UNNAMED",
    "java.base/java.lang=ALL-UNNAMED",
    "java.base/java.util=ALL-UNNAMED",
    "java.base/sun.nio.ch=ALL-UNNAMED",
    "java.base/java.io=ALL-UNNAMED",
    "java.base/java.net=ALL-UNNAMED",
    "java.base/jdk.internal.loader=ALL-UNNAMED",
    "java.base/jdk.internal.misc=ALL-UNNAMED",
];

for op in mandatory_opens {
    args.push("--add-opens".to_string());
    args.push(op.to_string());
}

// 3. Память
args.push(format!("-Xmx{}M", ctx.memory_mb));
args.push(format!("-Xms{}M", ctx.memory_mb));

// 4. Путь к нативным библиотекам
args.push(format!("-Djava.library.path={}", natives_dir_str));

// 5. Launcher информация
args.push("-Dminecraft.launcher.brand=TheravanzLauncher".to_string());
args.push("-Dminecraft.launcher.version=1.0".to_string());

// 6. Classpath и главный класс
args.push("-cp".to_string());
args.push(classpath_str);
args.push(main_class);

// 7. Игровые аргументы из JSON
if let Some(game_args) = profile.get("arguments")
    .and_then(|a| a.get("game"))
    .and_then(|v| v.as_array()) 
{
    for arg in game_args {
        if let Some(s) = arg.as_str() {
            args.push(replace(s));
        }
    }
}

// ✅ 8. Базовые игровые аргументы (обязательные для запуска)
args.push("--username".to_string());
args.push(ctx.username.clone());
args.push("--version".to_string());
args.push(id.clone());
args.push("--gameDir".to_string());
args.push(game_dir.to_string());
args.push("--assetsDir".to_string());
args.push(assets_root.to_string());
args.push("--assetIndex".to_string());
args.push(asset_index.to_string());
args.push("--uuid".to_string());
args.push("00000000-0000-0000-0000-000000000000".to_string());
args.push("--accessToken".to_string());
args.push("0".to_string());
args.push("--userType".to_string());
args.push("msa".to_string());
args.push("--versionType".to_string());
args.push("release".to_string());

// ✅ 9. Окно игры — из настроек лаунчера (уже ограничено разрешением монитора)
match ctx.window {
    (0, 0) => {
        args.push("--fullscreen".to_string());
    }
    (w, h) => {
        args.push("--width".to_string());
        args.push(w.to_string());
        args.push("--height".to_string());
        args.push(h.to_string());
    }
}
    
    eprintln!("🚀 Аргументы Java ({} шт):", args.len());
for (i, arg) in args.iter().enumerate() {
    eprintln!("  [{}] '{}'", i, arg);
}

eprintln!("\n📋 Полная команда:");
eprintln!("{}", ctx.java_path.display());
for arg in &args {
    eprint!(" '{}'", arg);
}
eprintln!("\n");
    
    // === ШАГ 5: Запуск ===
    on_progress(95.0, "Запуск Minecraft...".to_string());
    
    let output = Command::new(&ctx.java_path)
        .args(&args)
        .current_dir(&ctx.app_dir)
        .output()
        .map_err(|e| format!("Не удалось выполнить команду Java: {}", e))?;
    
    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Minecraft завершился с ошибкой (Код: {}).\n\n=== STDOUT ===\n{}\n\n=== STDERR ===\n{}",
            output.status.code().unwrap_or(-1), stdout, stderr
        ));
    }
    
    on_progress(100.0, "Minecraft запущен!".to_string());
    Ok(())
}