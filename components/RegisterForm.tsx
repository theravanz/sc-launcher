'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSettings, FiUser, FiMail, FiLock, FiArrowRight, FiAlertCircle } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { open } from '@tauri-apps/plugin-shell'; // <-- ДОБАВЛЕНО: импорт для открытия браузера

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onVerificationSuccess: (email: string) => void;
}

export default function RegisterForm({ onSwitchToLogin, onVerificationSuccess }: RegisterFormProps) {
  const router = useRouter(); // <-- ДОБАВЛЕНО: инициализация роутера
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }
  
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { username: username },
        },
      });

      if (error) throw error;

      if (data.user) {
        onVerificationSuccess(email);
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }; // <-- ДОБАВЛЕНО: закрывающая скобка функции handleRegister

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
      >
        <FiSettings size={20} />
      </motion.button>

      <motion.h2
        className="login-title"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        Создать аккаунт
      </motion.h2>

      <form onSubmit={handleRegister} className="login-form">
        <motion.div
          className="input-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <FiUser className="input-icon" />
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
          <FiMail className="input-icon" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field"
          />
        </motion.div>
        
        <motion.div
          className="input-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <FiLock className="input-icon" />
          <input
            type="password"
            placeholder="Password (мин. 6 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-field"
          />
        </motion.div>
        
        <motion.div
          className="input-wrapper"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <FiLock className="input-icon" />
          <input
            type="password"
            placeholder="Подтвердите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="input-field"
          />
        </motion.div>

        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <FiAlertCircle className="error-icon" />
            {error}
          </motion.div>
        )}

        <motion.button
          type="submit"
          className="primary-btn"
          disabled={loading}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          {loading ? 'Создание...' : (
            <>
              Зарегистрироваться
              <FiArrowRight className="btn-icon" />
            </>
          )}
        </motion.button>
      </form>

      <motion.div
        className="divider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        <span>или</span>
      </motion.div>

      <motion.div
        className="bottom-buttons"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
      >
        <motion.button
          onClick={handleDiscordLogin}
          className="discord-btn"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
        >
          <FaDiscord size={18} />
          {loading ? 'Ожидание...' : 'Войти через Discord'}
        </motion.button>
        
        <motion.button
          onClick={onSwitchToLogin}
          className="secondary-btn"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          Уже есть аккаунт? Войти
        </motion.button>
      </motion.div>
    </motion.div>
  );
}