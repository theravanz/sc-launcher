import { isTauri } from '@tauri-apps/api/core';

/**
 * true, только если код выполняется внутри Tauri-окна.
 * В браузере (pnpm dev) — false: Tauri-API (invoke, окно, обновления) недоступны,
 * поэтому все вызовы нужно оборачивать этой проверкой.
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && isTauri();
}
