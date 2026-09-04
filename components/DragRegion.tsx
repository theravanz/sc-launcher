'use client';

import { getCurrentWindow } from '@tauri-apps/api/window';

export default function DragRegion() {
  const appWindow = getCurrentWindow();

  const handleMouseDown = async () => {
    await appWindow.startDragging();
  };

  return (
    <div 
      className="drag-region"
      onMouseDown={handleMouseDown}
    />
  );
}