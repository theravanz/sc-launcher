use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

use crate::java::find_java;
use crate::launcher::{launch_minecraft, LaunchContext};

#[derive(Serialize, Clone)]
pub struct LaunchProgressEvent {
    pub stage: String,
    pub percent: f64,
    pub message: String,
}

#[tauri::command]
pub async fn launch_game(
    app_handle: AppHandle,
    mc_version: String,
    nf_version: String,
    memory_mb: i32,
) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    
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
    };
    
    launch_minecraft(&ctx, |p, msg| emit(p, msg)).await?;
    
    Ok(())
}