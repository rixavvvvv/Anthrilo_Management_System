'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Minimum roles allowed. If empty, any authenticated user. */
  allowedRoles?: UserRole[];
  /** Only user id=1 (HeilKnights) can access */
  ownerOnly?: boolean;
}

/**
 * Protects child routes by role. Wraps around page content.
 * Falls back to /dashboard if role doesn't match.
 */
export function ProtectedRoute({ children, allowedRoles, ownerOnly }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (ownerOnly && user?.id !== '1') {
      router.replace('/dashboard');
      return;
    }

    if (allowedRoles && allowedRoles.length > 0 && user) {
      if (!allowedRoles.includes(user.role)) {
        router.replace('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, ownerOnly, router]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (ownerOnly && user?.id !== '1') return null;
  if (allowedRoles?.length && user && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
