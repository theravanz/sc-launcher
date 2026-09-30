'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX,
  FiMonitor,
  FiCpu,
  FiFolder,
  FiTrash2,
  FiAlertTriangle,
  FiCheck,
  FiMaximize,
} from 'react-icons/fi';
import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_SETTINGS,
  WINDOW_PRESETS,
  FALLBACK_MAX_MEMORY_MB,
  MIN_MEMORY_MB,
  MEMORY_STEP_MB,
  memoryLimit,
  clampMemory,
  isMemoryTight,
} from '@/lib/launcherSettings';
import type { LauncherSettings, SystemInfo, WindowMode } from '@/lib/launcherSettings';

interface LauncherSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LauncherSettingsModal({ open, onClose }: LauncherSettingsModalProps) {
  const [settings, setSettings] = useState<LauncherSettings>(DEFAULT_SETTINGS);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxMemory, setMaxMemory] = useState(FALLBACK_MAX_MEMORY_MB);
  // Настройки подгружены в текущем открытии — до этого не сохраняем,
  // чтобы не перезаписать файл дефолтами
  const [loadedOpen, setLoadedOpen] = useState(false);

  const patch = (p: Partial<LauncherSettings>) => setSettings((prev) => ({ ...prev, ...p }));
  const currentMode = settings.window_mode;

  // Загрузка настроек и системной инфы при открытии модалки
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [s, sys] = await Promise.all([
          invoke<LauncherSettings>('load_launcher_settings'),
          invoke<SystemInfo>('get_system_info'),
        ]);
        if (cancelled) return;

        setSettings({ ...DEFAULT_SETTINGS, ...s });
        setSystem(sys);

        // Лимит ползунка = вся ОЗУ ПК (но не больше 32 ГБ)
        const limit = memoryLimit(sys.total_memory_mb);
        setMaxMemory(limit);

        // Если сохранённая память больше, чем есть на ПК — клампим и сразу сохраняем
        if (s.memory_mb > limit) {
          const fixed = { ...s, memory_mb: limit };
          setSettings(fixed);
          invoke('save_launcher_settings', { settings: fixed }).catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Не удалось загрузить настройки:', e);
          setError('Не удалось загрузить настройки');
        }
      } finally {
        if (!cancelled) setLoadedOpen(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [open]);

  // Автосохранение с дебаунсом (только после загрузки, чтобы не перезаписать файл дефолтами)
  useEffect(() => {
    if (!open || !loadedOpen) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await invoke('save_launcher_settings', { settings });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (e) {
        console.error('Ошибка сохранения:', e);
        setError('Не удалось сохранить настройки');
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [settings, open, loadedOpen]);

  const handleClose = () => {
    setLoadedOpen(false);
    setDeleteConfirm(false);
    setDeleteError(null);
    setError(null);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await invoke('delete_game');
      setDeleteConfirm(false);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить игру');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_game_dir');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось открыть папку');
    }
  };

  const memDecimals = (mb: number, limit: number) => {
    if (limit <= 4096) return 1;
    return mb % 1024 === 0 ? 0 : 1;
  };

  const memValue = Math.min(settings.memory_mb, maxMemory);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="changelog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
        >
          <motion.div
            className="changelog-modal settings-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="changelog-modal-header">
              <div>
                <h2 className="changelog-modal-title">Настройки лаунчера</h2>
                <p className="changelog-modal-subtitle">Окно игры, память и файлы игры</p>
              </div>
              <button className="changelog-modal-close" onClick={handleClose}><FiX size={18} /></button>
            </div>

            <div className="changelog-modal-body">
              {/* ===== ОКНО ИГРЫ ===== */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <FiMonitor size={14} />
                  <span>Окно игры</span>
                </div>

                <div className="settings-presets-grid">
                  {['custom', 'w854x480', 'w1280x720', 'w1600x900', 'w1920x1080', 'fullscreen'].map((mode) => (
                    <button
                      key={mode}
                      className={`settings-preset ${currentMode === mode ? 'active' : ''}`}
                      onClick={() => patch({ window_mode: mode as WindowMode })}
                    >
                      {mode === 'fullscreen' && <FiMaximize size={12} />}
                      <span>
                        {mode === 'custom' ? 'Свой размер' : WINDOW_PRESETS.find((p) => p.mode === mode)?.label}
                      </span>
                      {currentMode === mode && <FiCheck size={12} />}
                    </button>
                  ))}
                </div>

                {currentMode === 'custom' && (
                  <div className="settings-custom-size">
                    <label className="settings-field">
                      <span>Ширина</span>
                      <input
                        type="number"
                        min={100}
                        max={system?.screen_width || 7680}
                        value={settings.window_width}
                        onChange={(e) => patch({ window_width: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <span className="settings-x">×</span>
                    <label className="settings-field">
                      <span>Высота</span>
                      <input
                        type="number"
                        min={100}
                        max={system?.screen_height || 4320}
                        value={settings.window_height}
                        onChange={(e) => patch({ window_height: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <span className="settings-screen-hint">
                      Экран: {system?.screen_width || '?'}×{system?.screen_height || '?'}
                    </span>
                  </div>
                )}

                <p className="settings-hint">Размер окна ограничен разрешением вашего монитора</p>
              </div>

              {/* ===== ПАМЯТЬ ===== */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <FiCpu size={14} />
                  <span>Оперативная память</span>
                </div>

                <div className="settings-memory-row">
                  <input
                    type="range"
                    min={MIN_MEMORY_MB}
                    max={maxMemory}
                    step={MEMORY_STEP_MB}
                    value={memValue}
                    onChange={(e) => patch({ memory_mb: clampMemory(Number(e.target.value), maxMemory) })}
                    className="settings-slider"
                  />
                  <span className="settings-memory-value">
                    {(memValue / 1024).toFixed(memDecimals(memValue, maxMemory))} ГБ
                  </span>
                </div>

                <div className="settings-slider-scale">
                  <span>{(MIN_MEMORY_MB / 1024).toFixed(1)} ГБ</span>
                  <span>{(maxMemory / 1024).toFixed(1)} ГБ (вся ОЗУ)</span>
                </div>

                <p className="settings-hint">
                  {system
                    ? `ОЗУ ПК: ${(system.total_memory_mb / 1024).toFixed(0)} ГБ (свободно ~${(system.available_memory_mb / 1024).toFixed(1)} ГБ)`
                    : 'Определяем объём памяти ПК...'}
                  {system && ` · максимум для ползунка: ${(maxMemory / 1024).toFixed(0)} ГБ`}
                  {' '}Рекомендуется 4–6 ГБ для модпака.
                </p>

                {isMemoryTight(memValue, system?.total_memory_mb ?? 0) && (
                  <p className="settings-warning">
                    <FiAlertTriangle size={12} />
                    Выделено почти всё ОЗУ — системе и видеодрайверу может не хватить памяти,
                    ПК уйдёт в своп и игра будет тормозить.
                  </p>
                )}
              </div>

              {/* ===== ФАЙЛЫ ИГРЫ ===== */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <FiFolder size={14} />
                  <span>Файлы игры</span>
                </div>

                <div className="settings-actions-row">
                  <button className="settings-action-btn" onClick={handleOpenFolder}>
                    <FiFolder size={14} /> Показать папку с игрой
                  </button>
                  <button
                    className="settings-action-btn danger"
                    onClick={() => { setDeleteConfirm(true); setDeleteError(null); }}
                  >
                    <FiTrash2 size={14} /> Удалить игру
                  </button>
                </div>
              </div>

              {error && <div className="settings-error">{error}</div>}
            </div>

            {/* Индикатор автосохранения */}
            <div className="settings-save-indicator">
              {saving && <span>Сохранение...</span>}
              {!saving && saved && <span className="saved"><FiCheck size={12} /> Сохранено</span>}
            </div>

            {/* ===== ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ ===== */}
            <AnimatePresence>
              {deleteConfirm && (
                <motion.div
                  className="settings-confirm-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <motion.div
                    className="settings-confirm"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="settings-confirm-icon"><FiAlertTriangle size={22} /></div>
                    <h3>Удалить игру?</h3>
                    <p>
                      Будут удалены versions, libraries, assets и mods.
                      При следующем запуске лаунчер скачает всё заново.
                    </p>
                    {deleteError && <div className="settings-error">{deleteError}</div>}
                    <div className="settings-confirm-actions">
                      <button
                        className="settings-confirm-cancel"
                        onClick={() => setDeleteConfirm(false)}
                        disabled={deleting}
                      >
                        Отмена
                      </button>
                      <button
                        className="settings-confirm-delete"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? 'Удаление...' : 'Удалить'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}