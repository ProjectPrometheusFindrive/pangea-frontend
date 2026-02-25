import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'rental-business' | 'device-installer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  company?: string;
}

interface AuthContextType {
  user: User;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 기본 사용자 (렌터카 사업자)
const defaultUser: User = {
  id: 'user-001',
  name: '김대표',
  role: 'rental-business',
  company: '서울렌터카',
};

// 단말 장착사 사용자 예시
const installerUser: User = {
  id: 'installer-001',
  name: '박기사',
  role: 'device-installer',
  company: 'GPS솔루션',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(defaultUser);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}