import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../lib/api';
import type { PropertyDto } from '../lib/types';

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  tenantSubdomain: string | null;
  isPlatformAdmin: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  property: PropertyDto | null;
  permissions: string[];
  loading: boolean;
  login: (params: { subdomain?: string; email: string; password: string }) => Promise<CurrentUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (moduleKey: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [property, setProperty] = useState<PropertyDto | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTenantContext = async () => {
    try {
      const [properties, perms] = await Promise.all([
        apiFetch<PropertyDto[]>('/properties').catch(() => []),
        apiFetch<string[]>('/me/permissions').catch(() => []),
      ]);
      setProperty(properties[0] ?? null);
      setPermissions(perms);
    } catch {
      setProperty(null);
      setPermissions([]);
    }
  };

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setProperty(null);
      setPermissions([]);
      setLoading(false);
      return;
    }
    try {
      const me = await apiFetch<CurrentUser>('/auth/me');
      setUser(me);
      if (me.tenantId) {
        await loadTenantContext();
      }
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
    if (res.user.tenantId) {
      await loadTenantContext();
    }
    return res.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setProperty(null);
    setPermissions([]);
  };

  const can = (moduleKey: string, action: string) => permissions.includes(`${moduleKey}:${action}`);

  return (
    <AuthContext.Provider value={{ user, property, permissions, loading, login, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak');
  return ctx;
}
