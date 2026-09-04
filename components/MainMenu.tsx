'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiSettings, FiLogOut, FiChevronDown, FiPlay, FiClock, FiBox, FiX, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { FaGamepad } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { useLauncher } from '@/hooks/useLauncher';

interface MainMenuProps {
  onSettings: () => void;
  onAccountSettings: () => void;
}

const CHANGELOG_HISTORY = [
  {
    version: 'v2.1.0',
    date: '3 сентября 2026',
    type: 'major' as const,
    title: 'Синхронизация с сервером v2.1',
    changes: [
      { type: 'update', text: 'Оптимизирована загрузка чанков' },
      { type: 'fix', text: 'Исправлен вылет при открытии инвентаря' },
      { type: 'update', text: 'Обновлены конфигурации модов' },
      { type: 'new', text: 'Добавлены новые квесты' },
    ],
  },
  {
    version: 'v2.0.3',
    date: '31 августа 2026',
    type: 'patch' as const,
    title: 'Стабилизация соединения',
    changes: [
      { type: 'fix', text: 'Уменьшен пинг на 15%' },
      { type: 'fix', text: 'Исправлены разрывы соединения' },
    ],
  },
];

export default function MainMenu({ onSettings, onAccountSettings }: MainMenuProps) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ЕДИНСТВЕННЫЙ источник правды о запуске
  const { isLaunching, progress, message, error, launch, cancelLaunch } = useLauncher();

  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (changelogOpen || isLaunching) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [changelogOpen, isLaunching]);

  const handlePlay = () => {
    // Используем стабильную версию NeoForge для 1.21.1
    launch('1.21.1', '21.1.249', 4096);
  };

  const username = user?.user_metadata?.username || 'Пользователь';
  const email = user?.email || '';
  const avatarUrl = user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`;
  const latestChange = CHANGELOG_HISTORY[0];
  
  // Удобная переменная для проверки завершения
  const isComplete = progress >= 100;

  return (
    <div className="main-menu-wrapper">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-icon"><FaGamepad size={18} /></div>
          <div className="brand-text">
            <h1>Minecraft Launcher</h1>
            <span>Modded Edition</span>
          </div>
        </div>

        <div className="user-area" ref={menuRef}>
          <button className="user-trigger" onClick={() => setMenuOpen(!menuOpen)}>
            <img src={avatarUrl} alt="Avatar" className="user-avatar" />
            <span className="user-name">{username}</span>
            <FiChevronDown className={`user-arrow ${menuOpen ? 'open' : ''}`} size={14} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div className="user-dropdown" initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15 }}>
                <div className="dropdown-user-info">
                  <strong>{username}</strong>
                  <span>{email}</span>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-option" onClick={onAccountSettings}><FiUser size={14} /> Профиль</button>
                <button className="dropdown-option" onClick={onSettings}><FiSettings size={14} /> Настройки</button>
                <div className="dropdown-divider" />
                <button className="dropdown-option logout" onClick={handleLogout}><FiLogOut size={14} /> Выйти</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="main-content">
        <div className="content-left">
          <div className="version-strip">
            <div className="version-chip"><FiBox size={12} /><span>1.21.1</span><span className="chip-divider">•</span><span>NeoForge</span></div>
            <div className="server-chip"><span className="status-dot online" /><span>Сервер онлайн</span></div>
          </div>

          <motion.button 
            className="play-button" 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={handlePlay} 
            disabled={isLaunching}
          >
            <div className="play-button-glow" />
            <div className="play-button-content">
              <div className="play-icon-wrapper"><FiPlay size={24} fill="currentColor" /></div>
              <div className="play-button-text">
                <span className="play-text">ИГРАТЬ</span>
                {/* Показываем сообщение от Rust прямо на кнопке во время запуска */}
                <span className="play-subtext">{isLaunching ? message : 'Запустить Minecraft'}</span>
              </div>
            </div>
          </motion.button>
        </div>

        <div className="content-right">
          <div className="changelog-card">
            <div className="changelog-header">
              <div className="changelog-header-left"><FiClock size={14} /><span>Последние изменения</span></div>
              <button className="changelog-view-all" onClick={() => setChangelogOpen(true)}>Все версии <FiArrowRight size={12} /></button>
            </div>
            <div className="changelog-body">
              <div className="changelog-item">
                <div className="changelog-meta">
                  <span className={`changelog-tag changelog-tag-${latestChange.type}`}>{latestChange.type === 'major' ? 'Обновление' : 'Исправление'}</span>
                  <span className="changelog-date">{latestChange.date.split(' ')[0]}</span>
                </div>
                <h4 className="changelog-title">{latestChange.title}</h4>
                <ul className="changelog-list">
                  {latestChange.changes.slice(0, 3).map((c, i) => (<li key={i}>{c.text}</li>))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Оверлей запуска */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div className="launch-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}>
            <motion.div className="launch-status-top" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <div className="launch-status-content">
                <div className="launch-status-icon">
                  {isComplete ? <FiCheckCircle size={18} /> : <motion.div className="launch-spinner" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />}
                </div>
                <div className="launch-status-text">
                  <span className="launch-status-label">{isComplete ? 'Готово!' : (message || 'Запуск...')}</span>
                  <span className="launch-status-percent">{Math.round(progress)}%</span>
                </div>
              </div>
              <div className="launch-progress-bar">
                {/* Используем progress из хука, а не локальный launchProgress */}
                <motion.div className="launch-progress-fill" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.2, ease: 'linear' }} />
              </div>
              {error && <div className="launch-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{error}</div>}
            </motion.div>

            <motion.div className="launch-center" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}>
              <motion.div className="launch-logo-icon" animate={isComplete ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 0.5, repeat: isComplete ? 2 : 0 }}>
                <FaGamepad size={48} />
              </motion.div>
              <motion.h1 className="launch-logo-text" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>Launcher</motion.h1>
              <motion.p className="launch-logo-subtext" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.55 }}>
                {isComplete ? 'Minecraft запущен!' : 'Подготовка к запуску...'}
              </motion.p>
            </motion.div>

            {!isComplete && !error && (
              <motion.button className="launch-cancel-btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.8 }} onClick={cancelLaunch}>
                Отмена
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модалка Changelog */}
      <AnimatePresence>
        {changelogOpen && (
          <motion.div className="changelog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setChangelogOpen(false)}>
            <motion.div className="changelog-modal" initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()}>
              <div className="changelog-modal-header">
                <div>
                  <h2 className="changelog-modal-title">История изменений</h2>
                  <p className="changelog-modal-subtitle">Все обновления модпака и исправления</p>
                </div>
                <button className="changelog-modal-close" onClick={() => setChangelogOpen(false)}><FiX size={18} /></button>
              </div>
              <div className="changelog-modal-body">
                {CHANGELOG_HISTORY.map((entry, idx) => (
                  <div key={entry.version} className="changelog-entry">
                    <div className="changelog-entry-header">
                      <div className="changelog-entry-title-row">
                        <span className={`changelog-tag changelog-tag-${entry.type}`}>{entry.type === 'major' ? 'Обновление' : 'Исправление'}</span>
                        <h3 className="changelog-entry-version">{entry.version}</h3>
                        <span className="changelog-entry-date">{entry.date}</span>
                      </div>
                      <h4 className="changelog-entry-title">{entry.title}</h4>
                    </div>
                    <ul className="changelog-entry-list">
                      {entry.changes.map((c, i) => (<li key={i} className={`changelog-entry-item type-${c.type}`}><span className="entry-item-dot" /><span>{c.text}</span></li>))}
                    </ul>
                    {idx < CHANGELOG_HISTORY.length - 1 && <div className="changelog-entry-divider" />}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}