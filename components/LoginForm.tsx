'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSettings, FiMail, FiLock, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';
import { open } from '@tauri-apps/plugin-shell';
import { supabase } from '@/lib/supabase';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

export default function LoginForm({ onSwitchToRegister, onForgotPassword }: LoginFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!login.trim()) {
      setError('Введите email или логин');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('Введите пароль');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signIn(login, password);

      if (error) {
        const errorMessages: Record<string, string> = {
          'Invalid login credentials': 'Неверный email или пароль',
          'Email not confirmed': 'Email не подтверждён. Проверьте почту',
          'User not found': 'Пользователь не найден',
        };
        
        setError(errorMessages[error.message] || error.message);
      }
    } catch (error: any) {
      setError('Произошла непредвиденная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = async () => {
  setLoading(true);
  setError('');

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/discord-callback`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setError('Ошибка входа через Discord');
      setLoading(false);
      return;
    }

    if (data?.url) {
      await open(data.url);
      // Перенаправляем на страницу ожидания
      router.push('/auth/discord-waiting');
    }
  } catch (error: any) {
    setError('Произошла непредвиденная ошибка');
    setLoading(false);
  }
};

  return (
    <motion.div
      className="login-box"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        className="settings-btn"
        title="Настройки"
        whileHover={{ rotate: 90, scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ duration: 0.3 }}
      >
        <FiSettings size={20} />
      </motion.button>

      <motion.h2
        className="login-title"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        Авторизация
      </motion.h2>

      <form onSubmit={handleLogin} className="login-form">
        <motion.div
          className="input-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <FiMail className="input-icon" />
          <input
            type="text"
            placeholder="Login / Email"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            className="input-field"
          />
        </motion.div>
        
        <motion.div
          className="input-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <FiLock className="input-icon" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FiAlertCircle className="error-icon" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="forgot-password"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <button type="button" onClick={onForgotPassword} className="text-btn">
            Забыли пароль?
          </button>
        </motion.div>

        <motion.button
          type="submit"
          className="primary-btn"
          disabled={loading}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {loading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="loading-spinner"
            >
              ⏳
            </motion.span>
          ) : (
            <>
              Войти
              <FiArrowRight className="btn-icon" />
            </>
          )}
        </motion.button>
      </form>

      <motion.div
        className="divider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <span>или</span>
      </motion.div>

      <motion.div
        className="bottom-buttons"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        <motion.button
          onClick={handleDiscordLogin}
          className="discord-btn"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
        >
          <FaDiscord size={18} />
          Войти через Discord
        </motion.button>
        
        <motion.button
          onClick={onSwitchToRegister}
          className="secondary-btn"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          Создать новый аккаунт
        </motion.button>
      </motion.div>
    </motion.div>
  );
}