// src/hooks/useLauncher.ts
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { LaunchProgress, LauncherState } from '@/types/launcher';

export function useLauncher() {
  const [state, setState] = useState<LauncherState>({
    isLaunching: false,
    progress: 0,
    message: '',
    error: null,
  });

  const launch = useCallback(async (mcVersion: string, nfVersion: string, memoryMb: number, username?: string) => {
    setState({ isLaunching: true, progress: 0, message: 'Инициализация...', error: null });

    let unlisten: UnlistenFn | null = null;

    try {
      // 1. Сначала начинаем СЛУШАТЬ события от Rust
      unlisten = await listen<LaunchProgress>('launch_progress', (event) => {
        const { percent, message } = event.payload;
        setState((prev) => ({
          ...prev,
          progress: percent,
          message: message,
        }));
      });

      // 2. Вызываем команду Rust
      await invoke('launch_game', {
        mcVersion,
        nfVersion,
        memoryMb,
        username,
      });

      // Если дошли сюда, значит всё прошло успешно (100%)
      setState((prev) => ({ ...prev, message: 'Minecraft успешно запущен!' }));
      
    } catch (error) {
      console.error('Ошибка запуска:', error);
      setState((prev) => ({
        ...prev,
        isLaunching: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка запуска',
      }));
    } finally {
      // 3. Обязательно отписываемся от событий, чтобы не было утечек памяти
      if (unlisten) {
        await unlisten();
      }
      
      // Сбрасываем состояние через 3 секунды после успеха (или сразу при ошибке)
      if (!state.error) {
        setTimeout(() => {
          setState({ isLaunching: false, progress: 0, message: '', error: null });
        }, 3000);
      }
    }
  }, []);

  const cancelLaunch = useCallback(() => {
    // Пока просто сбрасываем UI. В будущем сюда можно добавить invoke('cancel_launch')
    setState({ isLaunching: false, progress: 0, message: 'Запуск отменён', error: null });
  }, []);

  return { ...state, launch, cancelLaunch };
}