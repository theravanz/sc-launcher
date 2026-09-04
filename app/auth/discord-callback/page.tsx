'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiCopy, FiXCircle } from 'react-icons/fi';
import { supabase } from '@/lib/supabase';

export default function DiscordCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [authToken, setAuthToken] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;
        
        if (data.session) {
          setAuthToken(data.session.access_token);
          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error('Auth error:', err);
        setStatus('error');
      }
    };

    handleAuth();
  }, []);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(authToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerStyle = {
    minHeight: '100vh',
    background: '#0f0f14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'var(--font-main), system-ui, sans-serif',
  };

  const boxStyle = {
    maxWidth: '500px',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '40px',
    textAlign: 'center' as const,
  };

  const tokenBoxStyle = {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '24px',
    marginBottom: '24px',
    wordBreak: 'break-all' as const,
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#4ade80',
    maxHeight: '120px',
    overflow: 'auto',
    textAlign: 'left' as const,
  };

  return (
    <div style={containerStyle}>
      <motion.div style={boxStyle} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        {status === 'loading' && (
          <>
            <div style={{ width: 64, height: 64, border: '4px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Завершение авторизации...</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>Пожалуйста, подождите</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(74, 222, 128, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <FiCheckCircle size={40} color="#4ade80" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#4ade80', marginBottom: 8 }}>Успешно!</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
              Скопируйте токен ниже и вставьте его в лаунчер:
            </p>
            
            <div style={tokenBoxStyle}>
              {authToken}
            </div>
            
            <button 
              onClick={copyToClipboard}
              style={{ 
                padding: '12px 32px', 
                background: copied ? '#4ade80' : '#6366f1', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: 600, 
                cursor: 'pointer', 
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                transition: 'all 0.2s',
              }}
            >
              <FiCopy size={16} />
              {copied ? 'Скопировано!' : 'Копировать токен'}
            </button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <FiXCircle size={40} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>Ошибка</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>Не удалось получить токен</p>
          </>
        )}
      </motion.div>
      <style jsx global>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}