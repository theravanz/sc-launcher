use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

use crate::java::find_java;
use crate::launcher::{launch_minecraft, LaunchContext};
use crate::settings::{
    delete_game_files, get_system_info as collect_system_info, load_settings, sanitize_settings,
    save_settings, LauncherSettings, SystemInfo,
};

#[derive(Serialize, Clone)]
pub struct LaunchProgressEvent {
    pub stage: String,
    pub percent: f64,
    pub message: String,
}

fn primary_monitor_size(app_handle: &AppHandle) -> Option<(u32, u32)> {
    app_handle
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let size = m.size();
            (size.width, size.height)
        })
}

/// Резолвит (w, h) окна игры из настроек + разрешения монитора.
fn resolve_game_window(settings: &LauncherSettings, app_handle: &AppHandle) -> (u32, u32) {
    let monitor = primary_monitor_size(app_handle);
    settings
        .window_mode
        .resolution(settings.window_width, settings.window_height, monitor)
}

#[tauri::command]
pub async fn launch_game(
    app_handle: AppHandle,
    mc_version: String,
    nf_version: String,
    memory_mb: Option<i32>,
    username: Option<String>,
) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    
    // Настройки — единый источник правды: память берём из них,
    // если пользователь не передал значение явно.
    // sanitize_settings защищает от -Xmx больше, чем есть ОЗУ на ПК.
    let settings = sanitize_settings(&load_settings(&app_dir));
    let memory_mb = {
        let mut candidate = settings.clone();
        if let Some(explicit) = memory_mb {
            candidate.memory_mb = explicit;
        }
        sanitize_settings(&candidate).memory_mb
    };

    let emit = |percent: f64, message: String| {
        let _ = app_handle.emit("launch_progress", LaunchProgressEvent {
            stage: "install".to_string(),
            percent,
            message,
        });
    };
    
    let ctx = LaunchContext {
        app_dir: app_dir.clone(),
        mc_version,
        nf_version,
        java_path: find_java()?,
        memory_mb,
        username: username.unwrap_or_else(|| "Player".to_string()),
        window: resolve_game_window(&settings, &app_handle),
    };
    
    launch_minecraft(&ctx, |p, msg| emit(p, msg)).await?;
    
    Ok(())
}

// ==================== НАСТРОЙКИ ====================

#[tauri::command]
pub fn load_launcher_settings(app_handle: AppHandle) -> Result<LauncherSettings, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let raw = load_settings(&app_dir);
    let fixed = sanitize_settings(&raw);

    // Само-починка файла: если значения вышли за пределы железа
    // (например, память 32 ГБ на 16-гиговой машине) — пересохраняем корректные.
    if fixed.memory_mb != raw.memory_mb
        || fixed.window_width != raw.window_width
        || fixed.window_height != raw.window_height
    {
        let _ = save_settings(&app_dir, &fixed);
    }

    Ok(fixed)
}

#[tauri::command]
pub fn save_launcher_settings(
    app_handle: AppHandle,
    settings: LauncherSettings,
) -> Result<(), String> {
    // Валидация: память не больше, чем есть на ПК
    let s = sanitize_settings(&settings);
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    save_settings(&app_dir, &s)
}

/// Системная информация: ОЗУ (для лимита ползунка) + разрешение монитора.
/// ОЗУ — через sysinfo, разрешение — через Tauri API основного монитора.
#[tauri::command]
pub fn get_system_info(app_handle: AppHandle) -> Result<SystemInfo, String> {
    let mut info = collect_system_info()?;
    if let Some((w, h)) = primary_monitor_size(&app_handle) {
        info.screen_width = w;
        info.screen_height = h;
    }
    Ok(info)
}

/// Открывает папку с игрой в системном проводнике (через плагин opener).
#[tauri::command]
pub fn open_game_dir(app_handle: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    // Папка может ещё не существовать (игра не установлена) — создаём
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    app_handle
        .opener()
        .open_path(app_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("Не удалось открыть папку: {}", e))
}

/// Полное удаление файлов игры с подтверждением на стороне GUI.
#[tauri::command]
pub fn delete_game(app_handle: AppHandle) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    delete_game_files(&app_dir)
}