import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  apiFetch,
  ensureCsrfToken,
  getInMemorySessionToken,
  setInMemorySessionToken,
} from '../lib/api';

export type UserRole = 'SUPER_ADMIN' | 'RECEPTION' | 'PATIENT';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  patientId: string | null;
  patientCode: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  registerPatient: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      await ensureCsrfToken();
      const bearer = getInMemorySessionToken();
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      });
      if (res.ok) {
        const data = (await res.json()) as { user: AuthUser };
        setUser(data.user);
      } else {
        setInMemorySessionToken(null);
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; sessionToken?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.sessionToken) setInMemorySessionToken(data.sessionToken);
    setUser(data.user);
    return data.user;
  };

  const registerPatient = async (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => {
    const data = await apiFetch<{ user: AuthUser; sessionToken?: string }>(
      '/api/v1/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    if (data.sessionToken) setInMemorySessionToken(data.sessionToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setInMemorySessionToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, refreshUser, login, registerPatient, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
