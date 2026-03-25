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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <UserContext.Provider value={{ user, login, register, logout }}>
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
