'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error('Ошибка OAuth:', error);
        router.push('/?error=oauth_failed');
      } else {
        router.push('/');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="app-container">
      <div className="background-blur" />
      <div className="loading-container">
        <div className="spinner" />
        <p>Завершение авторизации...</p>
      </div>
    </div>
  );
}