import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Building2, ShieldCheck, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types';

interface Props {
  onSuccess?: () => void;
}

// 取得 window.google 的輔助函式，避免 TypeScript 報錯
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gis = () => (window as any).google as any;

/** Google 登入成功後的角色選擇彈窗（僅新用戶需要） */
function RoleSelectModal({
  googleName,
  googlePicture,
  onSelect,
  onCancel,
}: {
  googleName: string;
  googlePicture: string;
  onSelect: (role: UserRole) => void;
  onCancel: () => void;
}) {
  const roles: { id: UserRole; label: string; desc: string; icon: React.ElementType; color: string }[] = [
    { id: 'medical', label: '醫護人員', desc: '可查看即時監控、管理健康記錄', icon: HeartPulse, color: 'text-blue-500 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100' },
    { id: 'family', label: '家屬', desc: '可查看指定住民的狀態與記錄', icon: Building2, color: 'text-green-500 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100' },
    { id: 'admin', label: '管理者', desc: '可存取所有功能與人員管理', icon: ShieldCheck, color: 'text-purple-500 border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* 頂部關閉按鈕 */}
        <div className="flex justify-end mb-2">
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 使用者資訊 */}
        <div className="flex flex-col items-center mb-6">
          <img
            src={googlePicture}
            alt={googleName}
            className="w-16 h-16 rounded-full shadow-md mb-3 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(googleName)}&background=2C363F&color=fff`; }}
          />
          <p className="text-slate-800 font-semibold text-lg">{googleName}</p>
          <p className="text-slate-500 text-sm mt-1">請選擇您的使用者身份</p>
        </div>

        {/* 角色選擇 */}
        <div className="space-y-3">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-150 ${r.color}`}
            >
              <r.icon className="w-6 h-6 flex-shrink-0" />
              <div className="text-left">
                <p className="font-semibold text-slate-800">{r.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoogleLoginButton({ onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const pendingCredentialRef = useRef<string>('');

  const { loginWithGoogle, completeGoogleLogin } = useUser();
  const navigate = useNavigate();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [pendingRole, setPendingRole] = useState<{
    googleName: string;
    googlePicture: string;
  } | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const initGIS = () => {
      if (!gis()?.accounts || !containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      gis().accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => {
          setError('');
          const result = loginWithGoogle(response.credential);

          if (result.success) {
            onSuccess?.();
            navigate('/realtime');
          } else if ('needsRole' in result && result.needsRole) {
            // 🆕 新用戶：顯示角色選擇視窗
            pendingCredentialRef.current = result.credential;
            setPendingRole({
              googleName: result.googleName,
              googlePicture: result.googlePicture,
            });
          } else {
            setError('message' in result ? result.message : 'Google 登入失敗');
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

  /** 使用者在彈窗選完角色後呼叫 */
  const handleRoleSelect = (role: UserRole) => {
    const result = completeGoogleLogin(pendingCredentialRef.current, role);
    setPendingRole(null);
    if (result.success) {
      onSuccess?.();
      navigate('/realtime');
    } else {
      setError(result.message);
    }
  };

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
    <>
      {/* 角色選擇彈窗（新用戶） */}
      {pendingRole && (
        <RoleSelectModal
          googleName={pendingRole.googleName}
          googlePicture={pendingRole.googlePicture}
          onSelect={handleRoleSelect}
          onCancel={() => { setPendingRole(null); pendingCredentialRef.current = ''; }}
        />
      )}

      <div className="w-full">
        {error && (
          <p className="text-sm text-red-500 text-center mb-2">{error}</p>
        )}
        {!isReady && <div className="w-full h-11 rounded-xl bg-slate-100 animate-pulse" />}
        <div ref={containerRef} className="w-full flex justify-center min-h-[44px]" />
      </div>
    </>
  );
}
