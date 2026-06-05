import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

interface Props {
  onSuccess?: () => void;
}

// 取得 window.google 的輔助函式，避免 TypeScript 報錯
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gis = () => (window as any).google as any;

export function GoogleLoginButton({ onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const { loginWithGoogle } = useUser();
  const navigate = useNavigate();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId) return;

    const initGIS = () => {
      if (!gis()?.accounts || !containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      gis().accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          setError('');
          const result = await loginWithGoogle(response.credential);
          if (result.success) {
            onSuccess?.();
            navigate('/realtime');
          } else {
            setError(result.message || 'Google 登入失敗');
          }
        },
        cancel_on_tap_outside: true,
      });

      containerRef.current.innerHTML = '';
      gis().accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'zh-TW',
        width: containerRef.current.offsetWidth || 400,
      });

      setIsReady(true);
    };

    if (gis()?.accounts) {
      initGIS();
    } else {
      const interval = setInterval(() => {
        if (gis()?.accounts) {
          clearInterval(interval);
          initGIS();
        }
      }, 150);
      return () => clearInterval(interval);
    }
  }, [clientId]);

  // 未設定 Client ID 時顯示說明
  if (!clientId) {
    return (
      <div className="w-full flex flex-col items-center gap-1">
        <button
          disabled
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed select-none"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          使用 Google 帳號登入
        </button>
        <p className="text-xs text-slate-400 mt-1">
          需在 <code className="bg-slate-100 px-1 rounded">.env</code> 設定{' '}
          <code className="bg-slate-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && <p className="text-sm text-red-500 text-center mb-2">{error}</p>}
      {!isReady && <div className="w-full h-11 rounded-xl bg-slate-100 animate-pulse" />}
      <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
    </div>
  );
}
