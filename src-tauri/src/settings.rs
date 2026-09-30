use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Расширение окна игры Minecraft.
/// "custom" — использовать width/height из настроек, иначе окна-пресеты.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WindowMode {
    Custom,
    W854X480,
    W1280X720,
    W1600X900,
    W1920X1080,
    Fullscreen,
}

impl Default for WindowMode {
    fn default() -> Self {
        WindowMode::W1280X720
    }
}

/// Настройки лаунчера. Хранятся в JSON в app_data_dir/settings.json
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LauncherSettings {
    /// Режим окна Minecraft
    #[serde(default)]
    pub window_mode: WindowMode,
    /// Ширина окна (только для WindowMode::Custom)
    #[serde(default = "default_width")]
    pub window_width: u32,
    /// Высота окна (только для WindowMode::Custom)
    #[serde(default = "default_height")]
    pub window_height: u32,
    /// Выделенная игре память в мегабайтах (-Xmx)
    #[serde(default = "default_memory")]
    pub memory_mb: i32,
}

fn default_width() -> u32 {
    1024
}

fn default_height() -> u32 {
    576
}

fn default_memory() -> i32 {
    4096
}

impl Default for LauncherSettings {
    fn default() -> Self {
        LauncherSettings {
            window_mode: WindowMode::default(),
            window_width: default_width(),
            window_height: default_height(),
            memory_mb: default_memory(),
        }
    }
}

impl WindowMode {
    /// Разрешение окна игры для данного режима с ограничением по монитору.
    /// Fullscreen -> (0, 0), что означает "--fullscreen" без размеров.
    pub fn resolution(&self, custom_w: u32, custom_h: u32, monitor: Option<(u32, u32)>) -> (u32, u32) {
        match self {
            WindowMode::Fullscreen => (0, 0),
            WindowMode::Custom => cap_to_monitor(custom_w.max(100), custom_h.max(100), monitor),
            WindowMode::W854X480 => cap_to_monitor(854, 480, monitor),
            WindowMode::W1280X720 => cap_to_monitor(1280, 720, monitor),
            WindowMode::W1600X900 => cap_to_monitor(1600, 900, monitor),
            WindowMode::W1920X1080 => cap_to_monitor(1920, 1080, monitor),
        }
    }
}

/// Ограничивает размер окна физическим разрешением монитора (если известно).
fn cap_to_monitor(w: u32, h: u32, monitor: Option<(u32, u32)>) -> (u32, u32) {
    match monitor {
        Some((mw, mh)) if mw > 0 && mh > 0 => (w.min(mw), h.min(mh)),
        _ => (w, h),
    }
}

/// Жёсткий предел выделения памяти: больше 32 ГБ игре выделять бессмысленно.
/// Должен совпадать с HARD_MEMORY_CAP_MB в lib/launcherSettings.ts
pub const HARD_MEMORY_CAP_MB: i32 = 32768;

/// Fallback, если объём ОЗУ определить не удалось.
/// Должен совпадать с FALLBACK_MAX_MEMORY_MB в lib/launcherSettings.ts
pub const FALLBACK_MEMORY_LIMIT_MB: i32 = 8192;

/// Минимально допустимое выделение памяти игре
pub const MIN_MEMORY_MB: i32 = 512;

/// Границы ручного размера окна
const MAX_WINDOW_W: u32 = 7680;
const MAX_WINDOW_H: u32 = 4320;

/// Осторожно: в sysinfo >= 0.30 память возвращается в БАЙТАХ.
fn bytes_to_mb(bytes: u64) -> i32 {
    let mb = bytes / (1024 * 1024);
    if mb > i32::MAX as u64 {
        i32::MAX
    } else {
        mb as i32
    }
}

/// Максимум ОЗУ, который можно выделить игре: вся память ПК,
/// но не больше HARD_MEMORY_CAP_MB. Если объём неизвестен — безопасный fallback.
pub fn system_memory_limit_mb() -> i32 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    let total_mb = bytes_to_mb(sys.total_memory());
    if total_mb > 0 {
        total_mb.min(HARD_MEMORY_CAP_MB)
    } else {
        FALLBACK_MEMORY_LIMIT_MB
    }
}

/// Приводит настройки к допустимым значениям: размер окна в разумных границах,
/// память — не больше, чем есть на ПК (иначе JVM не сможет выделить heap).
pub fn sanitize_settings(s: &LauncherSettings) -> LauncherSettings {
    let limit = system_memory_limit_mb().max(MIN_MEMORY_MB);
    let mut out = s.clone();
    out.window_width = out.window_width.clamp(100, MAX_WINDOW_W);
    out.window_height = out.window_height.clamp(100, MAX_WINDOW_H);
    out.memory_mb = out.memory_mb.clamp(MIN_MEMORY_MB, limit);
    out
}

/// Информация о системе для ограничения ползунка ОЗУ
#[derive(Serialize, Debug, Clone)]
pub struct SystemInfo {
    /// Установленная оперативная память в МБ
    pub total_memory_mb: i32,
    /// Свободная память в МБ
    pub available_memory_mb: i32,
    /// Физическое разрешение основного монитора (ширина)
    pub screen_width: u32,
    /// Физическое разрешение основного монитора (высота)
    pub screen_height: u32,
}

/// Читает настройки из app_data_dir/settings.json
/// (или возвращает default, если файла ещё нет)
pub fn load_settings(app_dir: &PathBuf) -> LauncherSettings {
    let path = app_dir.join("settings.json");
    match std::fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<LauncherSettings>(&content) {
            Ok(settings) => settings,
            Err(e) => {
                eprintln!("⚠️ Битый settings.json ({}), использую значения по умолчанию", e);
                LauncherSettings::default()
            }
        },
        Err(_) => LauncherSettings::default(),
    }
}

/// Сохраняет настройки в app_data_dir/settings.json
pub fn save_settings(app_dir: &PathBuf, settings: &LauncherSettings) -> Result<(), String> {
    let path = app_dir.join("settings.json");
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

/// Собирает информацию о системе: ОЗУ в МБ + (позже) разрешение монитора.
/// sysinfo >= 0.30 возвращает память в байтах — конвертируем через bytes_to_mb.
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();

    Ok(SystemInfo {
        total_memory_mb: bytes_to_mb(sys.total_memory()),
        available_memory_mb: bytes_to_mb(sys.available_memory()),
        screen_width: 0, // заполняется в commands.rs (нужен AppHandle)
        screen_height: 0,
    })
}

/// Полное удаление файлов игры (build-директории + settings.json).
/// Launcher-остатки (кэши нативов, логи) не трогаем — они не мешают переустановке.
pub fn delete_game_files(app_dir: &PathBuf) -> Result<(), String> {
    for dir in ["versions", "libraries", "assets", "mods"] {
        let path = app_dir.join(dir);
        if path.exists() {
            std::fs::remove_dir_all(&path).map_err(|e| format!("Не удалось удалить {}: {}", dir, e))?;
        }
    }
    let settings_path = app_dir.join("settings.json");
    if settings_path.exists() {
        std::fs::remove_file(&settings_path).map_err(|e| format!("Не удалось удалить settings.json: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Регрессия: sysinfo отдаёт байты, и раньше объём ОЗУ получался в 1024 раза больше.
    /// Отсюда и брался лимит ползунка 32 ГБ на 16-гиговой машине.
    #[test]
    fn memory_is_reported_in_megabytes() {
        let info = get_system_info().expect("system info");
        assert!(
            info.total_memory_mb >= 1024,
            "ОЗУ подозрительно мало: {} МБ",
            info.total_memory_mb
        );
        assert!(
            info.total_memory_mb <= 1_048_576,
            "ОЗУ завышено до {} МБ — похоже на ошибку единиц (МБ вместо байт)",
            info.total_memory_mb
        );
        assert!(info.available_memory_mb <= info.total_memory_mb);
    }

    #[test]
    fn memory_limit_never_exceeds_hardware() {
        let info = get_system_info().unwrap();
        let limit = system_memory_limit_mb();
        assert!(limit <= HARD_MEMORY_CAP_MB, "limit={} МБ", limit);
        if info.total_memory_mb > 0 {
            assert!(
                limit <= info.total_memory_mb,
                "лимит {} МБ больше ОЗУ {} МБ",
                limit,
                info.total_memory_mb
            );
        }
    }

    #[test]
    fn sanitize_clamps_memory_to_ram() {
        let limit = system_memory_limit_mb();

        let over = LauncherSettings { memory_mb: 999_999, ..Default::default() };
        let fixed = sanitize_settings(&over);
        assert!(fixed.memory_mb <= limit, "{} > {}", fixed.memory_mb, limit);
        assert!(fixed.memory_mb >= MIN_MEMORY_MB);

        let under = LauncherSettings { memory_mb: 1, ..Default::default() };
        assert_eq!(sanitize_settings(&under).memory_mb, MIN_MEMORY_MB);
    }

    #[test]
    fn sanitize_clamps_window_size() {
        let huge = LauncherSettings { window_width: 99_999, window_height: 99_999, ..Default::default() };
        let fixed = sanitize_settings(&huge);
        assert_eq!(fixed.window_width, MAX_WINDOW_W);
        assert_eq!(fixed.window_height, MAX_WINDOW_H);

        let tiny = LauncherSettings { window_width: 1, window_height: 1, ..Default::default() };
        let fixed_tiny = sanitize_settings(&tiny);
        assert_eq!(fixed_tiny.window_width, 100);
        assert_eq!(fixed_tiny.window_height, 100);
    }

    #[test]
    fn window_resolution_applies_mode_and_monitor() {
        assert_eq!(WindowMode::Fullscreen.resolution(1024, 576, Some((1920, 1080))), (0, 0));
        assert_eq!(WindowMode::W1280X720.resolution(1024, 576, None), (1280, 720));
        // Окно не может быть больше монитора
        assert_eq!(WindowMode::W1920X1080.resolution(1024, 576, Some((1366, 768))), (1366, 768));
        // Custom: минимум 100 px, но не больше монитора
        assert_eq!(WindowMode::Custom.resolution(10, 10, None), (100, 100));
        assert_eq!(WindowMode::Custom.resolution(800, 600, Some((2560, 1440))), (800, 600));
    }

    #[test]
    fn settings_round_trip_through_disk() {
        let dir = std::env::temp_dir().join("scl-launcher-settings-test");
        std::fs::create_dir_all(&dir).unwrap();

        let saved = LauncherSettings {
            window_mode: WindowMode::Fullscreen,
            window_width: 800,
            window_height: 600,
            memory_mb: 2048,
        };
        save_settings(&dir, &saved).unwrap();

        let loaded = load_settings(&dir);
        assert_eq!(loaded.window_mode, WindowMode::Fullscreen);
        assert_eq!(loaded.window_width, 800);
        assert_eq!(loaded.window_height, 600);
        assert_eq!(loaded.memory_mb, 2048);

        // Битый файл не должен ронять лаунчер
        std::fs::write(dir.join("settings.json"), "{ это не json").unwrap();
        assert_eq!(load_settings(&dir).memory_mb, LauncherSettings::default().memory_mb);

        std::fs::remove_dir_all(&dir).ok();
    }
}