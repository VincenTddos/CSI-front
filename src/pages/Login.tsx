import React, { useState } from 'react';
import { Page, UserRole } from '../types';
import { Activity, Lock, User, AlertCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface LoginProps {
  onNavigate: (page: Page) => void;
}

export function Login({ onNavigate }: LoginProps) {
  const [role, setRole] = useState<UserRole>('medical');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim()) {
      setError('請輸入帳號');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('請輸入密碼');
      setLoading(false);
      return;
    }

    // Simulate network delay
    setTimeout(() => {
      const result = login(username, password, role);
      if (result.success) {
        setUsername('');
        setPassword('');
        onNavigate('device');
      } else {
        setError(result.message);
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#E8E1D5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 md:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#2C363F] rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Activity className="w-8 h-8 text-[#007AFF]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">智慧長照監控系統</h1>
          <p className="text-slate-500 text-sm mt-2">請登入以繼續</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">使用者身份</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
            >
              <option value="medical">醫護人員 (Medical Staff)</option>
              <option value="family">家屬 (Family Member)</option>
              <option value="admin">管理者 (Administrator)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">帳號</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="請輸入帳號"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">密碼</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="請輸入密碼"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2C363F] hover:bg-[#1E252B] disabled:bg-slate-400 text-white font-medium py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
          >
            {loading ? '登入中...' : '登入系統'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            尚未有帳號？{' '}
            <button 
              onClick={() => onNavigate('register')}
              disabled={loading}
              className="text-[#007AFF] font-medium hover:underline transition-all disabled:opacity-50"
            >
              立即註冊
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
