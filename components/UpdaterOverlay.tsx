'use client';

import { motion } from 'framer-motion';
import { FiDownloadCloud, FiRefreshCw } from 'react-icons/fi';
import type { UpdateStatus } from '@/hooks/useAppUpdater';

interface UpdaterOverlayProps {
  status: UpdateStatus;
  percent: number;
  version: string | null;
}

/**
 * Экран обновления лаунчера. Показывается только когда обновление реально
 * качается/ставится — чтобы не мигать на каждой проверке при запуске.
 * Стили переиспользуют существующий оверлей запуска игры (.launch-*).
 */
export default function UpdaterOverlay({ status, percent, version }: UpdaterOverlayProps) {
  const visible = status === 'downloading' || status === 'installing' || status === 'restarting';
  if (!visible) return null;

  const label =
    status === 'downloading'
      ? `Загрузка обновления${version ? ` v${version}` : ''}...`
      : status === 'installing'
        ? 'Установка обновления...'
        : 'Перезапуск лаунчера...';

  const subtext =
    status === 'downloading'
      ? 'Лаунчер обновится автоматически'
      : status === 'installing'
        ? 'Осталось совсем немного'
        : 'Запускаем новую версию';

  return (
    <motion.div
      className="launch-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="launch-status-top"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="launch-status-content">
          <div className="launch-status-icon">
            {status === 'downloading' ? (
              <motion.div
                className="launch-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <FiRefreshCw size={18} />
              </motion.div>
            )}
          </div>
          <div className="launch-status-text">
            <span className="launch-status-label">{label}</span>
            <span className="launch-status-percent">{percent}%</span>
          </div>
        </div>
        <div className="launch-progress-bar">
          <motion.div
            className="launch-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.2, ease: 'linear' }}
          />
        </div>
      </motion.div>

      <motion.div
        className="launch-center"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <motion.div className="launch-logo-icon">
          <FiDownloadCloud size={48} />
        </motion.div>
        <motion.h1
          className="launch-logo-text"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          Обновление
        </motion.h1>
        <motion.p
          className="launch-logo-subtext"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          {subtext}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
