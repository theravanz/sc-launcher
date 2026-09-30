'use client';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktopApp } from '@/lib/tauriEnv';

export default function WindowControls() {
  // Tauri-окно получаем внутри обработчиков: при рендере (в т.ч. на SSR) window недоступен
  const handleMinimize = async () => {
    if (!isDesktopApp()) return;
    await getCurrentWindow().minimize();
  };

  const handleClose = async () => {
    if (!isDesktopApp()) return;
    await getCurrentWindow().close();
  };

  return (
    <div className="window-controls">
      <button 
        onClick={handleMinimize} 
        className="control-btn" 
        title="Свернуть"
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      
      <button 
        onClick={handleClose} 
        className="control-btn close-btn" 
        title="Закрыть"
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}