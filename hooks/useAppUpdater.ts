'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isDesktopApp } from '@/lib/tauriEnv';

export type UpdateStatus =
  /** Обновлений нет (или проверка ещё не запускалась) */
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'restarting'
  | 'error';

export interface AppUpdaterState {
  status: UpdateStatus;
  /** Прогресс загрузки обновления, 0..100 */
  percent: number;
  /** Версия, которую ставим (если обновление найдено) */
  version: string | null;
  /** Release notes из latest.json */
  notes: string | null;
  error: string | null;
}

export interface AppUpdater extends AppUpdaterState {
  /** Проверить обновления и, если есть новая версия, скачать, установить и перезапустить лаунчер */
  checkNow: () => Promise<void>;
}

/** Человеческое описание ошибки обновления */
function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/signature|verify/i.test(msg)) {
    return 'Подпись обновления не совпала — файл повреждён или подделан';
  }
  if (/network|dns|connect|timeout|timed out|404|403/i.test(msg)) {
    return 'Не удалось связаться с сервером обновлений';
  }
  return msg;
}

/**
 * Автообновление лаунчера.
 * Проверяет эндпоинт из tauri.conf.json (plugins.updater) и ставит новую версию
 * без участия пользователя: download → install → relaunch.
 */
export function useAppUpdater({ autoCheck = true }: { autoCheck?: boolean } = {}): AppUpdater {
  const [state, setState] = useState<AppUpdaterState>({
    status: 'idle',
    percent: 0,
    version: null,
    notes: null,
    error: null,
  });

  // Защита от параллельных проверок (кнопка + автопроверка)
  const running = useRef(false);

  const checkNow = useCallback(async () => {
    // В браузере (pnpm dev) обновления недоступны
    if (!isDesktopApp() || running.current) return;
    running.current = true;

    setState((s) => ({ ...s, status: 'checking', percent: 0, error: null }));

    let update: Update | null = null;

    try {
      update = await check({ timeout: 30_000 });

      if (!update) {
        setState((s) => ({ ...s, status: 'idle', version: null, notes: null }));
        return;
      }

      setState((s) => ({
        ...s,
        status: 'downloading',
        percent: 0,
        version: update!.version,
        notes: update!.body ?? null,
      }));

      let total = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setState((s) => ({
            ...s,
            percent: total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : s.percent,
          }));
        } else {
          // Finished: файл скачан, инсталлятор уже запущен
          setState((s) => ({ ...s, status: 'installing', percent: 100 }));
        }
      });

      // Linux/macOS: установка завершена — перезапускаем приложение сами.
      // Windows: NSIS в passive-режиме сам закроет и заново запустит лаунчер,
      // поэтому relaunch здесь просто дополнительная страховка.
      setState((s) => ({ ...s, status: 'restarting' }));
      await relaunch();
    } catch (e) {
      console.error('Ошибка автообновления:', e);
      setState((s) => ({ ...s, status: 'error', error: describeError(e) }));
      if (update) await update.close().catch(() => {});
    } finally {
      running.current = false;
    }
  }, []);

  // Проверка при запуске лаунчера: небольшая задержка, чтобы не мешать первому рендеру.
  // В dev-сборке автообновление не проверяем (нет релиза с нашей версией),
  // но кнопка «Проверить обновления» в настройках работает всегда.
  useEffect(() => {
    if (!autoCheck || process.env.NODE_ENV !== 'production') return;
    const timer = setTimeout(() => { void checkNow(); }, 1500);
    return () => clearTimeout(timer);
  }, [autoCheck, checkNow]);

  return { ...state, checkNow };
}
