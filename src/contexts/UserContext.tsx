import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isDeveloperIdentity, isValidAdminApprovalCode } from '../lib/roles';
import { initialsAvatar } from '../lib/avatar';

export interface RegisterData {
  realName: string;
  username: string;
  password: string;
  role: UserRole;
  unitCode?: string; // For medical staff
  familyCode?: string; // For family members
  approvalCode?: string; // For admin self-registration (輕量審核碼)
}

interface StoredUser extends RegisterData {
  id: string;
}

interface AuthResult { success: boolean; message: string }

export interface AccountInfo {
  id: string;
  username: string;
  realName: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  loginWithGoogle: (credential: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  // 開發者/管理者專用：帳號管理
  listAccounts: () => Promise<AccountInfo[]>;
  createAccount: (data: RegisterData) => Promise<AuthResult>;
  setAccountRole: (id: string, role: UserRole) => Promise<AuthResult>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// ⚠️ 僅供「未連 Supabase」的本機開發 fallback：用 SHA-256 雜湊密碼後再存 localStorage，
// 避免明文落地。正式環境一律走 Supabase Auth（bcrypt + 加鹽），不會用到此函式。
// 註：SHA-256 無鹽僅是最低限度防護，不可視為正式密碼儲存方案。
async function hashPassword(plain: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 帳號 (username) 與 Supabase Email 的對應：以合成網域保留「帳號」UX
// 註：使用合成 Email 時，請於 Supabase → Auth → Providers 關閉 "Confirm email"。
const SYNTH_DOMAIN = 'wicare.local';
const toEmail = (username: string) =>
  username.includes('@') ? username : `${username.trim().toLowerCase()}@${SYNTH_DOMAIN}`;
// 從合成 Email 反推帳號（供開發者帳號名單比對）
const usernameFromEmail = (email?: string | null) =>
  email && email.endsWith(`@${SYNTH_DOMAIN}`) ? email.slice(0, -(`@${SYNTH_DOMAIN}`.length)) : undefined;

// 套用開發者最高權限：身分命中名單則覆寫為 'developer'
const applyDeveloperOverride = (role: UserRole, email?: string | null, username?: string | null): UserRole =>
  isDeveloperIdentity(email, username ?? usernameFromEmail(email)) ? 'developer' : role;

// 依角色補上 demo 用的指派房間 / 綁定住民名稱（沿用原行為）
function decorateUser(base: Omit<User, 'assignedRooms' | 'patientName'>): User {
  return {
    ...base,
    assignedRooms: base.role === 'medical' ? ['Room 204', 'Room 205', 'Room 206'] : undefined,
    patientName: base.role === 'family' ? '王老先生' : undefined,
  };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (isSupabaseConfigured) return null; // Supabase 模式由 session 還原
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  // ---- Supabase 模式：由 profiles 表組出 User（套用開發者覆寫）----
  const buildUserFromProfile = async (
    userId: string, email: string | null, fallbackName: string, avatar?: string,
  ): Promise<User | null> => {
    // 用 maybeSingle 避免「0 筆」直接丟錯
    const { data } = await supabase
      .from('profiles')
      .select('real_name, role, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    let realName = data?.real_name as string | undefined;
    let baseRole = (data?.role as UserRole) ?? 'family';
    const avatarUrl = (data?.avatar_url as string | null) ?? null;

    // 防呆：profiles 沒有這列（trigger 沒建到）→ 自動補建一筆，避免登入後被踢回首頁
    if (!data) {
      const role = applyDeveloperOverride('family', email);
      const { error: insErr } = await supabase
        .from('profiles')
        .insert({ id: userId, real_name: fallbackName, role });
      if (insErr) {
        console.warn('[Auth] 自動建立 profile 失敗', insErr.message);
      }
      realName = fallbackName;
      baseRole = role;
    }

    const role = applyDeveloperOverride(baseRole, email);
    return decorateUser({
      id: userId,
      name: realName || fallbackName,
      role,
      avatar: avatar || avatarUrl || initialsAvatar(realName || fallbackName),
    });
  };

  // ---- 啟動時還原登入狀態（Supabase 模式）----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    const restore = async (session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (!active) return;
      if (session?.user) {
        const u = await buildUserFromProfile(
          session.user.id,
          session.user.email ?? null,
          session.user.email ?? '使用者',
          session.user.user_metadata?.picture as string | undefined,
        );
        if (active) setUser(u);
      } else {
        setUser(null);
      }
    };

    supabase.auth.getSession().then(({ data }) => restore(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => restore(session));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // ===========================================================================
  //  localStorage fallback 輔助（未設定 Supabase 時）
  // ===========================================================================
  const getStoredUsers = (): StoredUser[] => {
    const saved = localStorage.getItem('allUsers');
    return saved ? JSON.parse(saved) : [];
  };
  const saveStoredUsers = (users: StoredUser[]) => {
    localStorage.setItem('allUsers', JSON.stringify(users));
  };

  // ===========================================================================
  //  login（角色由帳號決定，不再由前端選擇）
  // ===========================================================================
  const login = async (username: string, password: string): Promise<AuthResult> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: toEmail(username), password,
      });
      if (error || !data.user) return { success: false, message: error?.message ?? '帳號或密碼錯誤' };
      const u = await buildUserFromProfile(data.user.id, data.user.email ?? null, username);
      if (!u) return { success: false, message: '無法載入個人資料，請稍後再試' };
      setUser(u);
      return { success: true, message: '登入成功' };
    }

    // -- fallback：localStorage（username + 密碼雜湊 比對；角色取自帳號）--
    const hashed = await hashPassword(password);
    const foundUser = getStoredUsers().find(u => u.username === username && u.password === hashed);
    if (!foundUser) return { success: false, message: '帳號或密碼錯誤' };
    const role = applyDeveloperOverride(foundUser.role, undefined, foundUser.username);
    const newUser = decorateUser({
      id: foundUser.id, name: foundUser.realName, role,
      avatar: initialsAvatar(foundUser.realName),
    });
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    return { success: true, message: '登入成功' };
  };

  // ===========================================================================
  //  register（只能註冊 medical / family；admin/developer 不開放自選）
  // ===========================================================================
  const register = async (data: RegisterData): Promise<AuthResult> => {
    if (data.password.length < 6) return { success: false, message: '密碼至少需要 6 個字符' };
    if (data.role !== 'medical' && data.role !== 'family' && data.role !== 'admin') {
      return { success: false, message: '註冊角色僅限醫護人員、家屬或管理者' };
    }
    if (data.role === 'medical' && !data.unitCode) return { success: false, message: '醫護人員必須填寫單位代號' };
    if (data.role === 'family' && !data.familyCode) return { success: false, message: '家屬必須填寫家屬代碼' };
    // 管理者：輕量審核 —— 須持有正確審核碼才能註冊為管理者
    if (data.role === 'admin' && !isValidAdminApprovalCode(data.approvalCode)) {
      return { success: false, message: '管理者審核碼不正確，請向系統開發者索取' };
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signUp({
        email: toEmail(data.username),
        password: data.password,
        options: { data: {
          real_name: data.realName, role: data.role,
          unit_code: data.unitCode, family_code: data.familyCode,
        } },
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: '註冊成功，請使用帳號登入' };
    }

    // -- fallback：localStorage（不保存審核碼）--
    const allUsers = getStoredUsers();
    if (allUsers.some(u => u.username === data.username)) return { success: false, message: '帳號已被註冊' };
    const { approvalCode: _approvalCode, ...stored } = data;
    allUsers.push({ ...stored, password: await hashPassword(data.password), id: Math.random().toString(36).substr(2, 9) });
    saveStoredUsers(allUsers);
    return { success: true, message: '註冊成功，請使用帳號登入' };
  };

  // ===========================================================================
  //  Google 登入（新使用者預設「家屬」最低權限；開發者信箱 → developer）
  // ===========================================================================
  const parseGoogleJwt = (token: string) => {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
      const json = new TextDecoder('utf-8').decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0)));
      return JSON.parse(json) as { sub: string; name: string; email: string; picture: string };
    } catch { return null; }
  };

  const loginWithGoogle = async (credential: string): Promise<AuthResult> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential });
      if (error || !data.user) return { success: false, message: error?.message ?? 'Google 登入失敗' };
      const u = await buildUserFromProfile(
        data.user.id, data.user.email ?? null,
        (data.user.user_metadata?.name as string) ?? data.user.email ?? 'Google 使用者',
        data.user.user_metadata?.picture as string | undefined,
      );
      if (!u) return { success: false, message: '無法載入個人資料，請稍後再試' };
      setUser(u);
      return { success: true, message: 'Google 登入成功' };
    }

    // -- fallback：解碼 JWT + localStorage（預設家屬；開發者信箱 → developer）--
    const payload = parseGoogleJwt(credential);
    if (!payload) return { success: false, message: 'Google 驗證失敗，請再試一次' };
    const allUsers = getStoredUsers();
    const googleUsername = `google_${payload.sub}`;
    let found = allUsers.find(u => u.username === googleUsername);
    if (!found) {
      found = { id: payload.sub, realName: payload.name, username: googleUsername, password: '', role: 'family' };
      allUsers.push(found);
      saveStoredUsers(allUsers);
    } else if (found.realName !== payload.name) {
      found.realName = payload.name;
      saveStoredUsers(allUsers);
    }
    const role = applyDeveloperOverride(found.role, payload.email);
    const newUser = decorateUser({
      id: found.id, name: found.realName, role,
      avatar: payload.picture || initialsAvatar(found.realName),
    });
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    return { success: true, message: 'Google 登入成功' };
  };

  // ===========================================================================
  //  logout
  // ===========================================================================
  // ===========================================================================
  //  帳號管理（開發者/管理者專用）
  // ===========================================================================
  const isManager = () => user?.role === 'developer' || user?.role === 'admin';

  const listAccounts = async (): Promise<AccountInfo[]> => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('profiles').select('id, real_name, role');
      if (error) { console.warn('[Accounts]', error.message); return []; }
      return (data ?? []).map(p => ({
        id: p.id, username: p.real_name, realName: p.real_name, role: p.role as UserRole,
      }));
    }
    return getStoredUsers().map(u => ({
      id: u.id, username: u.username, realName: u.realName, role: u.role,
    }));
  };

  const createAccount = async (data: RegisterData): Promise<AuthResult> => {
    if (!isManager()) return { success: false, message: '權限不足' };
    if (!data.username.trim()) return { success: false, message: '請輸入帳號' };
    if (data.password.length < 6) return { success: false, message: '密碼至少需要 6 個字符' };

    if (isSupabaseConfigured) {
      // 雲端模式：建立帳號需後端 admin API，前端 signUp 會切換登入狀態，
      // 故此處僅支援「角色指派」。請改用註冊頁建立帳號，再到此調整角色。
      return { success: false, message: '雲端模式請用註冊頁建立帳號，再於此調整角色' };
    }

    const allUsers = getStoredUsers();
    if (allUsers.some(u => u.username === data.username)) {
      return { success: false, message: '帳號已被註冊' };
    }
    allUsers.push({ ...data, password: await hashPassword(data.password), id: Math.random().toString(36).substr(2, 9) });
    saveStoredUsers(allUsers);
    return { success: true, message: `已建立帳號「${data.username}」(${data.role})` };
  };

  const setAccountRole = async (id: string, role: UserRole): Promise<AuthResult> => {
    if (!isManager()) return { success: false, message: '權限不足' };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) return { success: false, message: error.message };
    } else {
      const allUsers = getStoredUsers();
      const idx = allUsers.findIndex(u => u.id === id);
      if (idx === -1) return { success: false, message: '找不到帳號' };
      allUsers[idx].role = role;
      saveStoredUsers(allUsers);
    }

    // 若改到的是目前登入者本人，同步更新畫面
    if (user && user.id === id) {
      const updated = decorateUser({ id: user.id, name: user.name, role, avatar: user.avatar });
      setUser(updated);
      if (!isSupabaseConfigured) localStorage.setItem('currentUser', JSON.stringify(updated));
    }
    return { success: true, message: '角色已更新' };
  };

  const logout = async () => {
    // 即使 signOut 失敗/逾時，也一定清除本地登入狀態
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (e) {
      console.warn('[Auth] signOut 發生錯誤，仍強制登出', e);
    }
    setUser(null);
    localStorage.removeItem('currentUser');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  };

  return (
    <UserContext.Provider value={{ user, login, register, loginWithGoogle, logout, listAccounts, createAccount, setAccountRole }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) throw new Error('useUser must be used within a UserProvider');
  return context;
}
