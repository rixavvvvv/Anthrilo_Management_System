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

// Types
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;  isAdmin: boolean;
  isOwner: boolean;         // user.id === '1' (HeilKnights)
  isManagerOrAbove: boolean;  loginWithPassword: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = getStoredUser();
    const token = getStoredToken();
    if (stored && token) {
      setUser(stored);
      // Validate token in background
      apiClient.get('/auth/me').then((res) => {
        const u = res.data;
        setUser({
          id: u.id?.toString() || stored.id,
          email: u.email || stored.email,
          name: u.full_name || u.name || stored.name,
          picture: u.picture || stored.picture,
          role: u.role || 'staff',
          is_active: u.is_active ?? true,
          last_login: u.last_login || stored.last_login,
        });
      }).catch(() => {
        // Token might be expired but don't log out — let the interceptor handle 401
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Password login
  const loginWithPassword = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { username, password });
      const { access_token, refresh_token } = res.data;

      // Fetch user profile
      const meRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const u = meRes.data;

      const authUser: AuthUser = {
        id: u.id?.toString() || '',
        email: u.email,
        name: u.full_name || u.username || '',
        role: u.role || 'staff',
        is_active: u.is_active ?? true,
        last_login: u.last_login || undefined,
      };

      storeAuth(access_token, refresh_token, authUser);
      setUser(authUser);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed';
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Logout
  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isOwner: user?.id === '1',
    isManagerOrAbove: user?.role === 'admin' || user?.role === 'manager',
    loginWithPassword,
    logout,
  }), [user, isLoading, loginWithPassword, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
