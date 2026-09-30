'use client';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktopApp } from '@/lib/tauriEnv';

export default function DragRegion() {
  // getCurrentWindow() нельзя звать при рендере: на SSR/в браузере это ReferenceError
  // (ломало next build). Вызываем только по событию и только внутри Tauri.
  const handleMouseDown = async () => {
    if (!isDesktopApp()) return;
    await getCurrentWindow().startDragging();
  };

  return (
    <div 
      className="drag-region"
      onMouseDown={handleMouseDown}
    />
  );
}