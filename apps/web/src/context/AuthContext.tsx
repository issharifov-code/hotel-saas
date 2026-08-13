import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../lib/api';

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (params: { subdomain?: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<CurrentUser>('/auth/me');
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login: AuthContextValue['login'] = async (params) => {
    const res = await apiFetch<{ accessToken: string; user: CurrentUser }>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(params),
    });
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
