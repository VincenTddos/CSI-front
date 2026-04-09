import React, { useState } from 'react';
import { Page } from '../types';
import { Activity, ArrowLeft, Building2, HeartPulse, ShieldCheck, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

import { useNavigate } from 'react-router-dom';

export function Register() {
  const [role, setRole] = useState('medical');
  const [realName, setRealName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useUser();
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    if (!realName.trim()) {
      setError('請輸入真實姓名');
      return false;
    }
    if (!username.trim()) {
      setError('請輸入帳號');
      return false;
    }
    if (username.length < 3) {
      setError('帳號至少需要 3 個字符');
      return false;
    }
    if (!password) {
      setError('請輸入密碼');
      return false;
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字符');
      return false;
    }
    if (password !== confirmPassword) {
      setError('密碼不相符');
      return false;
    }
    if (role === 'medical' && !unitCode.trim()) {
      setError('請輸入醫療機構單位代號');
      return false;
    }
    if (role === 'family' && !familyCode.trim()) {
      setError('請輸入病患專屬家屬代碼');
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // Simulate network delay
    setTimeout(() => {
      const result = register({
        realName,
        username,
        password,
        role: role as any,
        unitCode: role === 'medical' ? unitCode : undefined,
        familyCode: role === 'family' ? familyCode : undefined,
      });

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setError(result.message);
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#E8E1D5] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 md:p-10 relative">
        <button
          onClick={() => navigate('/login')}
          disabled={loading}
          className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" /> 返回登入
        </button>

        <div className="flex flex-col items-center mb-8 mt-6">
          <div className="w-14 h-14 bg-[#2C363F] rounded-xl flex items-center justify-center shadow-md mb-4">
            <Activity className="w-7 h-7 text-[#007AFF]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">註冊新帳號</h1>
          <p className="text-slate-500 text-sm mt-2">建立您的智慧長照監控系統帳戶</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-600 font-medium">{success}</p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">使用者身份</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'medical', label: '醫護', icon: HeartPulse },
                { id: 'family', label: '家屬', icon: Building2 },
                { id: 'admin', label: '管理者', icon: ShieldCheck },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  disabled={loading}
                  className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    role === r.id 
                      ? 'border-[#007AFF] bg-[#007AFF]/5 text-[#007AFF]' 
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <r.icon className="w-5 h-5 mb-1.5" />
                  <span className="text-xs font-medium">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">真實姓名</label>
            <input
              type="text"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              disabled={loading}
              placeholder="例如：王大明"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">帳號</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="請輸入帳號"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
            />
          </div>

          {role === 'medical' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">單位代號 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                disabled={loading}
                placeholder="請輸入醫療機構單位代號"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
            </div>
          )}

          {role === 'family' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">家屬代碼 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value)}
                disabled={loading}
                placeholder="請輸入病患專屬家屬代碼"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">密碼 <span className="text-xs text-slate-500">(至少 6 個字符)</span></label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="設定密碼"
                className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">確認密碼</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="再次輸入密碼"
                className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all outline-none text-slate-700 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#007AFF] hover:bg-blue-600 disabled:bg-slate-400 text-white font-medium py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:hover:translate-y-0 mt-4"
          >
            {loading ? '註冊中...' : '完成註冊'}
          </button>
        </form>
      </div>
    </div>
  );
}






