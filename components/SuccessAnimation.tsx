'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';

interface SuccessAnimationProps {
  onComplete: () => void;
}

export default function SuccessAnimation({ onComplete }: SuccessAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="success-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="success-circle"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4, type: 'spring' }}
        >
          <FiCheckCircle size={64} />
        </motion.div>
      </motion.div>

      <motion.h2
        className="success-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        Успешная авторизация
      </motion.h2>

      <motion.p
        className="success-subtitle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        Добро пожаловать!
      </motion.p>

      {/* Анимированные частицы */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="particle"
          initial={{ 
            opacity: 1, 
            scale: 0,
            x: 0, 
            y: 0 
          }}
          animate={{ 
            opacity: 0, 
            scale: 1,
            x: Math.cos((i * 30) * Math.PI / 180) * 150, 
            y: Math.sin((i * 30) * Math.PI / 180) * 150 
          }}
          transition={{ 
            delay: 0.3, 
            duration: 1, 
            ease: 'easeOut' 
          }}
        />
      ))}
    </motion.div>
  );
}