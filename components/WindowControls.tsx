'use client';

import { getCurrentWindow } from '@tauri-apps/api/window';

export default function WindowControls() {
  const appWindow = getCurrentWindow();

  return (
    <div className="window-controls">
      <button 
        onClick={() => appWindow.minimize()} 
        className="control-btn" 
        title="Свернуть"
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      
      <button 
        onClick={() => appWindow.close()} 
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