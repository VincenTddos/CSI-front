import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

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
  login: (username: string, password: string, role: UserRole) => { success: boolean; message: string };
  register: (data: RegisterData) => { success: boolean; message: string };
  loginWithGoogle: (credential: string) => GoogleLoginResult;
  completeGoogleLogin: (credential: string, role: UserRole) => { success: boolean; message: string };
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const getStoredUsers = (): StoredUser[] => {
    const saved = localStorage.getItem('allUsers');
    return saved ? JSON.parse(saved) : [];
  };

  const saveStoredUsers = (users: StoredUser[]) => {
    localStorage.setItem('allUsers', JSON.stringify(users));
  };

  const login = (username: string, password: string, role: UserRole) => {
    const allUsers = getStoredUsers();
    const foundUser = allUsers.find(
      (u) => u.username === username && u.password === password && u.role === role
    );

    if (!foundUser) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    const newUser: User = {
      id: foundUser.id,
      name: foundUser.realName,
      role: foundUser.role,
      avatar: `https://picsum.photos/seed/${foundUser.realName}/150/150`,
      assignedRooms: foundUser.role === 'medical' ? ['Room 204', 'Room 205', 'Room 206'] : undefined,
      patientName: foundUser.role === 'family' ? '王老先生' : undefined,
    };
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    return { success: true, message: '登入成功' };
  };

  const register = (data: RegisterData) => {
    const allUsers = getStoredUsers();

    // Check if username already exists
    if (allUsers.some((u) => u.username === data.username)) {
      return { success: false, message: '帳號已被註冊' };
    }

    // Validate password
    if (data.password.length < 6) {
      return { success: false, message: '密碼至少需要 6 個字符' };
    }

    // Validate required fields for roles
    if (data.role === 'medical' && !data.unitCode) {
      return { success: false, message: '醫護人員必須填寫單位代號' };
    }
    if (data.role === 'family' && !data.familyCode) {
      return { success: false, message: '家屬必須填寫家屬代碼' };
    }

    const newStoredUser: StoredUser = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
    };

    allUsers.push(newStoredUser);
    saveStoredUsers(allUsers);

    return { success: true, message: '註冊成功，請使用帳號登入' };
  };

  /** 解析 Google JWT credential，取得 name / email / picture / sub */
  const parseGoogleJwt = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
      const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(json) as {
        sub: string;
        name: string;
        email: string;
        picture: string;
      };
    } catch {
      return null;
    }
  };

  /** 將 Google 帳號資訊存入並設定登入狀態（需先有角色） */
  const applyGoogleUser = (payload: { sub: string; name: string; picture: string }, role: UserRole) => {
    const allUsers = getStoredUsers();
    const googleUsername = `google_${payload.sub}`;
    let foundUser = allUsers.find((u) => u.username === googleUsername);

    if (!foundUser) {
      const newStoredUser: StoredUser = {
        id: payload.sub,
        realName: payload.name,
        username: googleUsername,
        password: '',
        role,
        unitCode: role === 'medical' ? 'GOOGLE' : undefined,
        familyCode: role === 'family' ? 'GOOGLE' : undefined,
      };
      allUsers.push(newStoredUser);
      saveStoredUsers(allUsers);
      foundUser = newStoredUser;
    } else {
      // 同步 Google 最新名稱
      if (foundUser.realName !== payload.name) {
        foundUser.realName = payload.name;
        saveStoredUsers(allUsers);
      }
    }

    const newUser: User = {
      id: foundUser.id,
      name: foundUser.realName,
      role: foundUser.role,
      avatar: payload.picture || `https://picsum.photos/seed/${foundUser.realName}/150/150`,
      assignedRooms: foundUser.role === 'medical' ? ['Room 204', 'Room 205', 'Room 206'] : undefined,
      patientName: foundUser.role === 'family' ? '王老先生' : undefined,
    };
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
  };

  const loginWithGoogle = (credential: string): GoogleLoginResult => {
    const payload = parseGoogleJwt(credential);
    if (!payload) {
      return { success: false, message: 'Google 驗證失敗，請再試一次' };
    }

    const allUsers = getStoredUsers();
    const googleUsername = `google_${payload.sub}`;
    const foundUser = allUsers.find((u) => u.username === googleUsername);

    if (!foundUser) {
      // 🆕 新用戶：請求前端顯示角色選擇視窗
      return {
        success: false,
        needsRole: true,
        credential,
        googleName: payload.name,
        googlePicture: payload.picture,
      };
    }

    // 已有帳號：直接登入
    applyGoogleUser(payload, foundUser.role);
    return { success: true, message: 'Google 登入成功' };
  };

  /** 新用戶選完角色後呼叫，完成 Google 登入 */
  const completeGoogleLogin = (credential: string, role: UserRole) => {
    const payload = parseGoogleJwt(credential);
    if (!payload) {
      return { success: false, message: 'Google 驗證失敗，請再試一次' };
    }
    applyGoogleUser(payload, role);
    return { success: true, message: 'Google 登入成功' };
  };

  /** 切換目前登入者的角色 */
  const switchRole = (newRole: UserRole) => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      role: newRole,
      assignedRooms: newRole === 'medical' ? ['Room 204', 'Room 205', 'Room 206'] : undefined,
      patientName: newRole === 'family' ? '王老先生' : undefined,
    };
    setUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    // 同步更新 allUsers 裡的角色
    const allUsers = getStoredUsers();
    const idx = allUsers.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      allUsers[idx].role = newRole;
      saveStoredUsers(allUsers);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    // 清除 Google One Tap 自動登入
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
