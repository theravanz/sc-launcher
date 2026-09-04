'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiMail, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export default function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim()) {
      setError('Введите email');
      setLoading(false);
      return;
    }

    try {
      const { error } = await resetPassword(email);

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (error: any) {
      setError('Произошла ошибка');
    } finally {
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
        className="back-btn"
        onClick={onBack}
        whileHover={{ x: -5 }}
        whileTap={{ scale: 0.9 }}
      >
        <FiArrowLeft size={20} />
      </motion.button>

      <motion.h2
        className="login-title"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        Восстановление пароля
      </motion.h2>

      {!success ? (
        <form onSubmit={handleReset} className="login-form">
          <motion.p
            className="form-description"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Введите email, указанный при регистрации. Мы отправим ссылку для сброса пароля.
          </motion.p>

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
            disabled={loading}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            {loading ? 'Отправка...' : 'Отправить ссылку'}
          </motion.button>
        </form>
      ) : (
        <motion.div
          className="success-message"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <FiCheckCircle className="success-icon" />
          <p>Ссылка для восстановления отправлена на <strong>{email}</strong></p>
          <p className="success-subtext">Проверьте почту и следуйте инструкциям</p>
        </motion.div>
      )}
    </motion.div>
  );
}