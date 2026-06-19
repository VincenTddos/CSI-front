import React, { useEffect, useState } from 'react';
import { UserCog, Plus, ShieldCheck, Crown, HeartPulse, Building2, Save, RefreshCw, type LucideIcon } from 'lucide-react';
import { useUser, type AccountInfo } from '../contexts/UserContext';
import { UserRole } from '../types';
import { roleLabel } from '../lib/roles';
import { isSupabaseConfigured } from '../lib/supabase';

const ROLE_OPTIONS: { id: UserRole; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'developer', label: '開發者', icon: Crown, color: 'text-purple-600' },
  { id: 'admin', label: '管理者', icon: ShieldCheck, color: 'text-red-500' },
  { id: 'medical', label: '醫護人員', icon: HeartPulse, color: 'text-blue-500' },
  { id: 'family', label: '家屬', icon: Building2, color: 'text-green-500' },
];

export function AccountManagement() {
  const { user, listAccounts, createAccount, setAccountRole } = useUser();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // 新增帳號表單
  const [realName, setRealName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('medical');

  const refresh = () => listAccounts().then(setAccounts).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const flash = (m: string, isErr = false) => {
    if (isErr) { setErr(m); setMsg(''); } else { setMsg(m); setErr(''); }
    setTimeout(() => { setMsg(''); setErr(''); }, 3000);
  };

  if (user?.role !== 'developer' && user?.role !== 'admin') {
    return <div className="p-6 text-slate-500">此頁僅限開發者 / 管理者使用。</div>;
  }

  const handleCreate = async () => {
    const r = await createAccount({ realName: realName || username, username, password, role });
    if (r.success) {
      flash(r.message);
      setRealName(''); setUsername(''); setPassword(''); setRole('medical');
      refresh();
    } else flash(r.message, true);
  };

  const handleRole = async (id: string, newRole: UserRole) => {
    const r = await setAccountRole(id, newRole);
    if (r.success) { flash(r.message); refresh(); } else flash(r.message, true);
  };

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-[#007AFF]" /> 帳號管理
        </h1>
        <p className="text-sm text-slate-500 mt-1">建立帳號並指派角色（僅開發者 / 管理者可操作）</p>
      </div>

      {msg && <div className="p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs max-w-md">{msg}</div>}
      {err && <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs max-w-md">{err}</div>}

      {/* 新增帳號 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> 新增帳號</h2>
        {isSupabaseConfigured ? (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            雲端模式：請用「註冊頁」建立帳號，再到下方清單調整角色（前端無法直接建立雲端使用者）。
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input value={realName} onChange={e => setRealName(e.target.value)} placeholder="姓名"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="帳號"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="密碼(≥6)" type="text"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            <select value={role} onChange={e => setRole(e.target.value as UserRole)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
              {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <button onClick={handleCreate}
              className="flex items-center justify-center gap-1.5 bg-[#007AFF] hover:bg-[#0066CC] text-white text-sm font-medium rounded-lg px-4 py-2">
              <Plus className="w-4 h-4" /> 建立
            </button>
          </div>
        )}
      </div>

      {/* 帳號清單 */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-600">現有帳號（{accounts.length}）</h2>
          <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <RefreshCw className="w-3.5 h-3.5" /> 重新整理
          </button>
        </div>
        <div className="space-y-2">
          {accounts.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">尚無帳號</p>}
          {accounts.map(a => {
            const meta = ROLE_OPTIONS.find(r => r.id === a.role);
            return (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[#007AFF] font-bold text-sm shrink-0">
                    {a.realName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.realName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{a.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {meta && <span className={`text-xs font-bold ${meta.color}`}>{roleLabel(a.role)}</span>}
                  <select value={a.role} onChange={e => handleRole(a.id, e.target.value as UserRole)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    title="變更角色">
                    {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
