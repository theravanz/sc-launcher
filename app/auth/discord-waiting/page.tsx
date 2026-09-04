'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiCheckCircle, FiKey } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import WindowControls from '@/components/WindowControls';
import DragRegion from '@/components/DragRegion';

export default function DiscordWaiting() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleBack = () => {
    router.push('/');
  };

  const handleSubmitToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: token.trim(),
        refresh_token: token.trim(),
      });

      if (error) throw error;

      if (data.session) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Неверный токен');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-container">
      <div className="background-blur" />
      <DragRegion />
      <WindowControls />
      
      <motion.div
        className="waiting-page-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.button
          className="back-button"
          onClick={handleBack}
          whileHover={{ x: -5 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <FiArrowLeft size={20} />
          <span>Назад</span>
        </motion.button>

        {!success ? (
          <>
            <motion.div
              className="waiting-icon-wrapper"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                <FaDiscord size={72} color="#5865F2" />
              </motion.div>
            </motion.div>

            <motion.h1
              className="waiting-title"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Введите токен авторизации
            </motion.h1>

            <motion.p
              className="waiting-subtitle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Скопируйте токен из браузера и вставьте его ниже
            </motion.p>

            <motion.form
              onSubmit={handleSubmitToken}
              className="token-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Вставьте токен сюда..."
                className="token-input"
                rows={3}
              />

              {error && (
                <motion.div
                  className="error-message"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              <motion.button
                type="submit"
                className="primary-btn"
                disabled={loading || !token.trim()}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? 'Проверка...' : (
                  <>
                    <FiKey className="btn-icon" />
                    Войти
                  </>
                )}
              </motion.button>
            </motion.form>
          </>
        ) : (
          <>
            <motion.div
              className="success-icon-wrapper"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <FiCheckCircle size={64} color="#4ade80" />
            </motion.div>

            <motion.h1
              className="waiting-title success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Успешная авторизация!
            </motion.h1>

            <motion.p
              className="waiting-subtitle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Перенаправление в лаунчер...
            </motion.p>
          </>
        )}
      </motion.div>
    </main>
  );
}