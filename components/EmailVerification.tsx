'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiMail, FiCheckCircle, FiRefreshCw, FiEdit3 } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

interface EmailVerificationProps {
  email: string;
  onBack: () => void;
  onVerified: () => void;
  onChangeEmail: () => void;
}

export default function EmailVerification({ email, onBack, onVerified, onChangeEmail }: EmailVerificationProps) {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkVerification = async () => {
    setChecking(true);
    setError('');

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (session?.user?.email_confirmed_at) {
        onVerified();
      } else {
        setError('Email ещё не подтверждён. Проверьте почту.');
      }
    } catch (error: any) {
      setError('Ошибка проверки');
    } finally {
      setChecking(false);
    }
  };

  const resendEmail = async () => {
    setResending(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setSuccess('Письмо отправлено повторно!');
    } catch (error: any) {
      setError('Ошибка отправки');
    } finally {
      setResending(false);
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

      <motion.div
        className="verification-icon"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        <FiMail size={48} />
      </motion.div>

      <motion.h2
        className="login-title"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        Осталось ещё чуть-чуть...
      </motion.h2>

      <motion.p
        className="verification-subtitle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        Подтвердите почту
      </motion.p>

      <motion.div
        className="email-display"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <span className="email-text">{email}</span>
        <button onClick={onChangeEmail} className="change-email-btn" title="Сменить почту">
          <FiEdit3 size={14} />
        </button>
      </motion.div>

      <motion.p
        className="verification-description"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        Мы отправили ссылку для подтверждения на вашу почту. Перейдите по ней, чтобы завершить регистрацию.
      </motion.p>

      {error && (
        <motion.div
          className="error-message"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div
          className="success-message-inline"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FiCheckCircle />
          {success}
        </motion.div>
      )}

      <motion.div
        className="verification-buttons"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        <motion.button
          onClick={checkVerification}
          className="primary-btn"
          disabled={checking}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {checking ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <FiRefreshCw />
            </motion.span>
          ) : (
            <>
              Проверить
              <FiCheckCircle className="btn-icon" />
            </>
          )}
        </motion.button>

        <motion.button
          onClick={resendEmail}
          className="secondary-btn"
          disabled={resending}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {resending ? 'Отправка...' : 'Отправить повторно'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}