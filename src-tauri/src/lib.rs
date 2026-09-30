#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod java;
mod launcher;
mod settings;
mod types;
mod utils;

mod mojang;
mod downloader;
mod neoforge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_opener::init())
    // Автообновление: эндпоинт и публичный ключ подписи в tauri.conf.json (plugins.updater)
    .plugin(tauri_plugin_updater::Builder::new().build())
    // relaunch после установки обновления
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
        commands::launch_game,
        commands::load_launcher_settings,
        commands::save_launcher_settings,
        commands::get_system_info,
        commands::open_game_dir,
        commands::delete_game,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}