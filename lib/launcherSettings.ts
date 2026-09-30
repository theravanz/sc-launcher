// Типы и дефолты настроек лаунчера.
// Зеркалит структуры Rust: src-tauri/src/settings.rs

export type WindowMode =
  | 'custom'
  | 'w854x480'
  | 'w1280x720'
  | 'w1600x900'
  | 'w1920x1080'
  | 'fullscreen';

export interface LauncherSettings {
  window_mode: WindowMode;
  window_width: number;
  window_height: number;
  memory_mb: number;
}

export interface SystemInfo {
  total_memory_mb: number;
  available_memory_mb: number;
  screen_width: number;
  screen_height: number;
}

export const DEFAULT_SETTINGS: LauncherSettings = {
  window_mode: 'w1280x720',
  window_width: 1024,
  window_height: 576,
  memory_mb: 4096,
};

// Дефолтный лимит ползунка ОЗУ, пока get_system_info не вернул реальные данные.
// Должен совпадать с FALLBACK_MEMORY_LIMIT_MB в src-tauri/src/settings.rs
export const FALLBACK_MAX_MEMORY_MB = 8192;

/** Жёсткий предел выделения: больше 32 ГБ игре не нужно.
 *  Должен совпадать с HARD_MEMORY_CAP_MB в src-tauri/src/settings.rs */
export const HARD_MEMORY_CAP_MB = 32768;

/** Сколько ОЗУ разумно оставить системе, чтобы она не ушла в своп */
export const SYSTEM_RESERVE_MB = 2048;

/** Шаг ползунка памяти */
export const MEMORY_STEP_MB = 256;

/** Минимальное выделение памяти (совпадает с MIN_MEMORY_MB в Rust) */
export const MIN_MEMORY_MB = 512;

/** Пресеты окна в GUI (custom идёт отдельной опцией с ручным вводом) */
export const WINDOW_PRESETS: { mode: WindowMode; label: string }[] = [
  { mode: 'w854x480', label: '854 × 480' },
  { mode: 'w1280x720', label: '1280 × 720' },
  { mode: 'w1600x900', label: '1600 × 900' },
  { mode: 'w1920x1080', label: '1920 × 1080' },
];

/** Верхняя граница ползунка: вся ОЗУ ПК (не больше HARD_MEMORY_CAP_MB),
 *  выровненная по шагу ползунка, чтобы правый край был достижим.
 *  totalMemoryMb приходит из Rust уже в мегабайтах. */
export function memoryLimit(totalMemoryMb: number): number {
  const raw = totalMemoryMb > 0
    ? Math.min(totalMemoryMb, HARD_MEMORY_CAP_MB)
    : FALLBACK_MAX_MEMORY_MB;
  return Math.max(MEMORY_STEP_MB * 2, Math.floor(raw / MEMORY_STEP_MB) * MEMORY_STEP_MB);
}

/** true, если выделено почти столько же, сколько есть всего:
 *  системе (и видеодрайверу) может не хватить памяти. */
export function isMemoryTight(mb: number, totalMemoryMb: number): boolean {
  if (totalMemoryMb <= 0) return false;
  return mb > Math.max(512, totalMemoryMb - SYSTEM_RESERVE_MB);
}

/** Кламп памяти: не меньше 512 МБ, не больше лимита и кратно шагу ползунка */
export function clampMemory(mb: number, maxMb: number): number {
  const snapped = Math.round(mb / MEMORY_STEP_MB) * MEMORY_STEP_MB;
  return Math.max(MIN_MEMORY_MB, Math.min(maxMb, snapped));
}
