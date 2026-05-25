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

interface UserContextType {
  user: User | null;
  login: (username: string, password: string, role: UserRole) => { success: boolean; message: string };
  register: (data: RegisterData) => { success: boolean; message: string };
  loginWithGoogle: (credential: string) => { success: boolean; message: string };
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

  const loginWithGoogle = (credential: string) => {
    const payload = parseGoogleJwt(credential);
    if (!payload) {
      return { success: false, message: 'Google 驗證失敗，請再試一次' };
    }

    const allUsers = getStoredUsers();
    // 以 Google sub (唯一 ID) 或 email 識別帳號
    const googleUsername = `google_${payload.sub}`;
    let foundUser = allUsers.find((u) => u.username === googleUsername);

    if (!foundUser) {
      // 首次登入：自動建立帳號（預設醫護人員角色）
      const newStoredUser: StoredUser = {
        id: payload.sub,
        realName: payload.name,
        username: googleUsername,
        password: '',          // Google 用戶不用密碼
        role: 'medical',
        unitCode: 'GOOGLE',    // 佔位符，代表 Google 登入用戶
      };
      allUsers.push(newStoredUser);
      saveStoredUsers(allUsers);
      foundUser = newStoredUser;
    } else if (foundUser.realName !== payload.name) {
      // 修正舊版 atob 解碼造成的中文名字亂碼，並同步 Google 最新名稱。
      foundUser.realName = payload.name;
      saveStoredUsers(allUsers);
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
    return { success: true, message: 'Google 登入成功' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    // 清除 Google One Tap 自動登入
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  };

  return (
    <UserContext.Provider value={{ user, login, register, loginWithGoogle, logout }}>
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
