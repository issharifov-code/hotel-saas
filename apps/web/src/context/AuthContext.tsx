import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '../lib/api';
import type { PropertyDto } from '../lib/types';

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  tenantSubdomain: string | null;
  hasSampleData: boolean;
  isPlatformAdmin: boolean;
}

export interface TenantOption {
  subdomain: string;
  name: string;
}

// Login sahifasi qayta dizayni (2026-09): Subdomain maydoni endi ko'rsatilmaydi —
// backend email orqali tenant'ni avtomatik aniqlaydi. Agar bir xil email+parol
// bir nechta mehmonxonada ishlab qolsa (kamdan-kam), backend token o'rniga
// tanlash ro'yxatini qaytaradi — shu holatni LoginResult orqali aniq ifodalaymiz.
export type LoginResult =
  | { status: 'success'; user: CurrentUser }
  | { status: 'select-tenant'; tenants: TenantOption[] };

interface AuthContextValue {
  user: CurrentUser | null;
  property: PropertyDto | null;
  permissions: string[];
  loading: boolean;
  login: (params: {
    subdomain?: string;
    email: string;
    password: string;
    remember?: boolean;
  }) => Promise<LoginResult>;
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

  // `remember` faqat frontend'da token qayerda saqlanishini boshqaradi
  // (localStorage vs sessionStorage — pastdagi setToken chaqiruviga qarang);
  // backend DTO'sida bunday maydon yo'q va `forbidNonWhitelisted: true`
  // tufayli so'rov tanasiga qo'shilsa 400 xato beradi — shuning uchun
  // `credentials`dan ajratib olinadi va backend'ga yuborilmaydi.
  const login: AuthContextValue['login'] = async ({ remember = true, ...credentials }) => {
    const res = await apiFetch<
      | { accessToken: string; user: CurrentUser }
      | { requiresTenantSelection: true; tenants: TenantOption[] }
    >('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(credentials),
    });

    if ('requiresTenantSelection' in res) {
      return { status: 'select-tenant', tenants: res.tenants };
    }

    setToken(res.accessToken, remember);
    setUser(res.user);
    if (res.user.tenantId) {
      await loadTenantContext();
    }
    return { status: 'success', user: res.user };
  };

  const logout = () => {
    // 🔴 XAVFSIZLIK AUDITI (2026-09-05, L9). Ilgari chiqish faqat shu yerda —
    // brauzerda — bo'lardi: token o'chirilardi, lekin serverda hamon 8 soat
    // amal qilaverardi. Endi server ham xabardor qilinadi (`/auth/logout` ->
    // token_version +1), ya'ni o'sha token darhol kuchini yo'qotadi.
    //
    // Ataylab `await` qilinmaydi va xatosi yutiladi: chiqish har qanday holatda
    // (tarmoq yo'q, token allaqachon eskirgan) darhol va to'liq ishlashi kerak.
    void apiFetch<void>('/auth/logout', { method: 'POST' }).catch(() => {});
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
