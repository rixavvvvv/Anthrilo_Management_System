'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  type AuthUser,
  getStoredUser,
  getStoredToken,
  storeAuth,
  clearAuth,
} from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDeveloper: boolean;
  isAdmin: boolean;
  isManagerOrAbove: boolean;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUserPayload(payload: any, fallback?: AuthUser | null): AuthUser {
  return {
    id: payload.id?.toString() || fallback?.id || '',
    email: payload.email || fallback?.email || '',
    name: payload.full_name || payload.name || payload.username || fallback?.name || '',
    picture: payload.picture || fallback?.picture,
    role: payload.role || fallback?.role || 'user',
    role_priority: payload.role_priority ?? fallback?.role_priority ?? 10,
    permissions: payload.permissions || fallback?.permissions || [],
    module_access: payload.module_access || fallback?.module_access || [],
    is_developer: payload.is_developer ?? fallback?.is_developer ?? payload.role === 'developer',
    is_active: payload.is_active ?? fallback?.is_active ?? true,
    last_login: payload.last_login || fallback?.last_login,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getStoredToken();

    if (!storedUser || !token) {
      setIsLoading(false);
      return;
    }

    setUser(storedUser);

    apiClient
      .get('/auth/me')
      .then((res) => {
        const nextUser = mapUserPayload(res.data, storedUser);
        setUser(nextUser);
        storeAuth(token, localStorage.getItem('refresh_token') || '', nextUser);
      })
      .catch(() => {
        // Keep last-known auth state; interceptor handles hard 401 redirect.
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      setIsLoading(true);
      try {
        const loginRes = await apiClient.post('/auth/login', { username, password });
        const { access_token, refresh_token } = loginRes.data;

        const meRes = await apiClient.get('/auth/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const authUser = mapUserPayload(meRes.data);
        storeAuth(access_token, refresh_token, authUser);
        setUser(authUser);

        router.push('/dashboard');
      } catch (err: any) {
        const msg = err.response?.data?.detail || err.message || 'Login failed';
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(() => {
    const role = user?.role || 'user';
    const isDeveloper = role === 'developer';
    const isAdmin = role === 'admin';
    const isManagerOrAbove = isDeveloper || isAdmin;

    return {
      user,
      isLoading,
      isAuthenticated: !!user,
      isDeveloper,
      isAdmin,
      isManagerOrAbove,
      loginWithPassword,
      logout,
    };
  }, [user, isLoading, loginWithPassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
