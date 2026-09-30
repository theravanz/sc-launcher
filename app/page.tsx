'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';
import EmailVerification from '@/components/EmailVerification';
import SuccessAnimation from '@/components/SuccessAnimation';
import MainMenu from '@/components/MainMenu';
import WindowControls from '@/components/WindowControls';
import DragRegion from '@/components/DragRegion';
import UpdaterOverlay from '@/components/UpdaterOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useAppUpdater } from '@/hooks/useAppUpdater';

type View = 'login' | 'register' | 'forgot-password' | 'verification' | 'success' | 'main-menu';

export default function Home() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('login');
  const [verificationEmail, setVerificationEmail] = useState('');

  // Автообновление лаунчера: проверка при запуске + установка и перезапуск
  const updater = useAppUpdater();

  const updaterOverlay = (
    <UpdaterOverlay status={updater.status} percent={updater.percent} version={updater.version} />
  );

  const handleVerificationSuccess = useCallback((email: string) => {
    setVerificationEmail(email);
    setView('verification');
  }, []);

  const handleVerified = useCallback(() => {
    setView('success');
  }, []);

  const handleSuccessComplete = useCallback(() => {
    setView('main-menu');
  }, []);

  // 1. Загрузка (ДОБАВЛЕНЫ DragRegion и WindowControls)
  if (loading) {
    return (
      <main className="app-container">
        <div className="background-blur" />
        <DragRegion />
        <WindowControls />
        <div className="loading-container">
          <div className="spinner" />
          <p>Загрузка...</p>
        </div>
        {updaterOverlay}
      </main>
    );
  }

  // 2. Если пользователь уже авторизован
  if (user && view !== 'verification' && view !== 'success') {
    return (
      <main className="app-container">
        <div className="background-blur" />
        <DragRegion />
        <WindowControls />
        <MainMenu updater={updater} onAccountSettings={() => console.log('Настройки аккаунта')} />
        {updaterOverlay}
      </main>
    );
  }

  // 3. Основной поток авторизации
  return (
    <main className="app-container">
      <div className="background-blur" />
      <DragRegion />
      <WindowControls />
      
      <AnimatePresence mode="wait">
        {view === 'login' && (
          <LoginForm
            key="login"
            onSwitchToRegister={() => setView('register')}
            onForgotPassword={() => setView('forgot-password')}
          />
        )}
        
        {view === 'register' && (
          <RegisterForm
            key="register"
            onSwitchToLogin={() => setView('login')}
            onVerificationSuccess={handleVerificationSuccess}
          />
        )}
        
        {view === 'forgot-password' && (
          <ForgotPasswordForm
            key="forgot-password"
            onBack={() => setView('login')}
          />
        )}

        {view === 'verification' && (
          <EmailVerification
            key="verification"
            email={verificationEmail}
            onBack={() => setView('register')}
            onVerified={handleVerified}
            onChangeEmail={() => setView('register')}
          />
        )}

        {view === 'success' && (
          <SuccessAnimation
            key="success"
            onComplete={handleSuccessComplete}
          />
        )}

        {view === 'main-menu' && (
          <MainMenu
            key="main-menu"
            updater={updater}
            onAccountSettings={() => console.log('Настройки аккаунта')}
          />
        )}
      </AnimatePresence>

      {updaterOverlay}
    </main>
  );
}