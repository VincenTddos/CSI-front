import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RegisterData {
  realName: string;
  username: string;
  password: string;
  role: UserRole;
  unitCode?: string; // For medical staff
  familyCode?: string; // For family members
}

interface StoredUser extends RegisterData {
  id: string;
}

export type GoogleLoginResult =
  | { success: true; message: string }
  | { success: false; message: string; needsRole?: false }
  | { success: false; needsRole: true; credential: string; googleName: string; googlePicture: string };

interface UserContextType {
  user: User | null;
  login: (username: string, password: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: (credential: string) => Promise<GoogleLoginResult>;
  completeGoogleLogin: (credential: string, role: UserRole) => Promise<{ success: boolean; message: string }>;
  switchRole: (newRole: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 帳號 (username) 與 Supabase Email 的對應：以合成網域保留「帳號」UX
// 註：使用合成 Email 時，請於 Supabase → Auth → Providers 關閉 "Confirm email"。
const SYNTH_DOMAIN = 'wicare.local';
const toEmail = (username: string) =>
  username.includes('@') ? username : `${username.trim().toLowerCase()}@${SYNTH_DOMAIN}`;

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

  // ---- Supabase 模式：由 profiles 表組出 User ----
  const buildUserFromProfile = async (userId: string, fallbackName: string, avatar?: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('real_name, role, avatar_url')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return decorateUser({
      id: userId,
      name: data.real_name || fallbackName,
      role: (data.role as UserRole) ?? 'medical',
      avatar: avatar || data.avatar_url || `https://picsum.photos/seed/${data.real_name}/150/150`,
    });
  };

  // ---- 啟動時還原登入狀態（Supabase 模式）----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session?.user && active) {
        const u = await buildUserFromProfile(
          session.user.id,
          session.user.email ?? '使用者',
          session.user.user_metadata?.picture as string | undefined,
        );
        if (active) setUser(u);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (session?.user) {
        const u = await buildUserFromProfile(
          session.user.id,
          session.user.email ?? '使用者',
          session.user.user_metadata?.picture as string | undefined,
        );
        setUser(u);
      } else {
        setUser(null);
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // ===========================================================================
  //  localStorage fallback 輔助（未設定 Supabase 時，行為與舊版完全一致）
  // ===========================================================================
  const getStoredUsers = (): StoredUser[] => {
    const saved = localStorage.getItem('allUsers');
    return saved ? JSON.parse(saved) : [];
  };
  const saveStoredUsers = (users: StoredUser[]) => {
    localStorage.setItem('allUsers', JSON.stringify(users));
  };

  // ===========================================================================
  //  login
  // ===========================================================================
  const login = async (username: string, password: string, role: UserRole) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: toEmail(username),
        password,
      });
      if (error || !data.user) {
        return { success: false, message: error?.message ?? '帳號或密碼錯誤' };
      }
      const u = await buildUserFromProfile(data.user.id, username);
      setUser(u);
      return { success: true, message: '登入成功' };
    }

    // -- fallback：localStorage --
    const allUsers = getStoredUsers();
    const foundUser = allUsers.find(
      (u) => u.username === username && u.password === password && u.role === role
    );
    if (!foundUser) return { success: false, message: '帳號或密碼錯誤' };
    const newUser = decorateUser({
      id: foundUser.id,
      name: foundUser.realName,
      role: foundUser.role,
      avatar: `https://picsum.photos/seed/${foundUser.realName}/150/150`,
    });
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    return { success: true, message: '登入成功' };
  };

  // ===========================================================================
  //  register
  // ===========================================================================
  const register = async (data: RegisterData) => {
    if (data.password.length < 6) {
      return { success: false, message: '密碼至少需要 6 個字符' };
    }
    if (data.role === 'medical' && !data.unitCode) {
      return { success: false, message: '醫護人員必須填寫單位代號' };
    }
    if (data.role === 'family' && !data.familyCode) {
      return { success: false, message: '家屬必須填寫家屬代碼' };
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signUp({
        email: toEmail(data.username),
        password: data.password,
        options: {
          data: {
            real_name: data.realName,
            role: data.role,
            unit_code: data.unitCode,
            family_code: data.familyCode,
          },
        },
      });
      if (error) return { success: false, message: error.message };
      // profiles 由資料庫 trigger 自動建立
      return { success: true, message: '註冊成功，請使用帳號登入' };
    }

    // -- fallback：localStorage --
    const allUsers = getStoredUsers();
    if (allUsers.some((u) => u.username === data.username)) {
      return { success: false, message: '帳號已被註冊' };
    }
    allUsers.push({ ...data, id: Math.random().toString(36).substr(2, 9) });
    saveStoredUsers(allUsers);
    return { success: true, message: '註冊成功，請使用帳號登入' };
  };

  // ===========================================================================
  //  Google 登入
  // ===========================================================================
  const parseGoogleJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(json) as { sub: string; name: string; email: string; picture: string };
    } catch {
      return null;
    }
  };

  const loginWithGoogle = async (credential: string): Promise<GoogleLoginResult> => {
    if (isSupabaseConfigured) {
      // 真正驗證 Google ID Token（由 Supabase 後端驗章）
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
      });
      if (error || !data.user) {
        return { success: false, message: error?.message ?? 'Google 登入失敗' };
      }
      const u = await buildUserFromProfile(
        data.user.id,
        data.user.user_metadata?.name ?? data.user.email ?? 'Google 使用者',
        data.user.user_metadata?.picture as string | undefined,
      );
      setUser(u);
      return { success: true, message: 'Google 登入成功' };
    }

    // -- fallback：解碼 JWT + localStorage（保留原新用戶選角色流程）--
    const payload = parseGoogleJwt(credential);
    if (!payload) return { success: false, message: 'Google 驗證失敗，請再試一次' };
    const allUsers = getStoredUsers();
    const googleUsername = `google_${payload.sub}`;
    const foundUser = allUsers.find((u) => u.username === googleUsername);
    if (!foundUser) {
      return { success: false, needsRole: true, credential, googleName: payload.name, googlePicture: payload.picture };
    }
    applyGoogleUserLocal(payload, foundUser.role);
    return { success: true, message: 'Google 登入成功' };
  };

  const applyGoogleUserLocal = (payload: { sub: string; name: string; picture: string }, role: UserRole) => {
    const allUsers = getStoredUsers();
    const googleUsername = `google_${payload.sub}`;
    let foundUser = allUsers.find((u) => u.username === googleUsername);
    if (!foundUser) {
      foundUser = {
        id: payload.sub, realName: payload.name, username: googleUsername, password: '', role,
        unitCode: role === 'medical' ? 'GOOGLE' : undefined,
        familyCode: role === 'family' ? 'GOOGLE' : undefined,
      };
      allUsers.push(foundUser);
      saveStoredUsers(allUsers);
    } else if (foundUser.realName !== payload.name) {
      foundUser.realName = payload.name;
      saveStoredUsers(allUsers);
    }
    const newUser = decorateUser({
      id: foundUser.id,
      name: foundUser.realName,
      role: foundUser.role,
      avatar: payload.picture || `https://picsum.photos/seed/${foundUser.realName}/150/150`,
    });
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
  };

  const completeGoogleLogin = async (credential: string, role: UserRole) => {
    // 僅 fallback 模式會走到此（Supabase 模式直接登入，角色預設 medical 可後續切換）
    const payload = parseGoogleJwt(credential);
    if (!payload) return { success: false, message: 'Google 驗證失敗，請再試一次' };
    applyGoogleUserLocal(payload, role);
    return { success: true, message: 'Google 登入成功' };
  };

  // ===========================================================================
  //  switchRole / logout
  // ===========================================================================
  const switchRole = async (newRole: UserRole) => {
    if (!user) return;
    if (isSupabaseConfigured) {
      await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    }
    const updatedUser = decorateUser({ id: user.id, name: user.name, role: newRole, avatar: user.avatar });
    setUser(updatedUser);
    if (!isSupabaseConfigured) {
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      const allUsers = getStoredUsers();
      const idx = allUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) { allUsers[idx].role = newRole; saveStoredUsers(allUsers); }
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('currentUser');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  };

  return (
    <UserContext.Provider value={{ user, login, register, loginWithGoogle, completeGoogleLogin, switchRole, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
