'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  User, Mail, Save, Loader2, CheckCircle2, AlertTriangle,
  Camera, Calendar, Shield,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';
import type { UserRole } from '@/lib/auth';

// Types
interface UserProfile {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_login: string | null;
  timezone: string;
  language: string;
  email_notifications: boolean;
  created_at: string;
  updated_at: string;
}

// Toast
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl
        ${type === 'success'
          ? 'bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
          : 'bg-red-50/90 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/40'}`}
    >
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}

// Page
export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch profile
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => (await apiClient.get('/auth/me')).data,
  });

  // Seed form
  useEffect(() => {
    if (profile) setFullName(profile.full_name || '');
  }, [profile]);

  // Update mutation
  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string }) => {
      return (await apiClient.put('/auth/me', data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setToast({ message: 'Profile updated successfully', type: 'success' });
      // Update stored user name
      const stored = localStorage.getItem('auth_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          u.name = fullName;
          localStorage.setItem('auth_user', JSON.stringify(u));
        } catch { }
      }
    },
    onError: (err: any) => {
      setToast({ message: err.response?.data?.detail || 'Failed to update profile', type: 'error' });
    },
  });

  const handleSave = () => {
    if (!fullName.trim()) return;
    updateProfile.mutate({ full_name: fullName.trim() });
  };

  const isDirty = fullName !== (profile?.full_name || '');
  const initials = (profile?.full_name?.[0] || profile?.username?.[0] || 'A').toUpperCase();
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : '';

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal information and public presence.
        </p>
      </motion.div>

      {/* Avatar card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden"
      >
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-br from-primary-500 via-primary-600 to-violet-600
                        dark:from-primary-700 dark:via-primary-800 dark:to-violet-800 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48cGF0aCBkPSJNMCAyMGgyME0yMCAwdjIwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNikiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNhKSIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiLz48L3N2Zz4=')] opacity-60" />
        </div>

        {/* Avatar + Info */}
        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-600 to-violet-600
                              flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-lg
                              overflow-hidden">
                {user?.picture ? (
                  <Image src={user.picture} alt="Profile" width={80} height={80} unoptimized className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-bold">{initials}</span>
                )}
              </div>
              <button
                className="absolute inset-0 flex items-center justify-center rounded-2xl
                           bg-black/0 group-hover:bg-black/40 transition-all duration-200
                           opacity-0 group-hover:opacity-100"
                title="Upload avatar (coming soon)"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {profile?.full_name || profile?.username || 'User'}
                </h2>
                {profile?.role && <RoleBadge role={profile.role as UserRole} />}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.email}</p>
            </div>
          </div>

          {/* Member since */}
          {memberSince && (
            <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-400 dark:text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              Member since {memberSince}
            </div>
          )}
        </div>
      </motion.div>

      {/* Edit form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Personal Information
        </h3>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Email (readonly) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-100/60 dark:bg-slate-800/30 text-sm text-slate-500 dark:text-slate-400
                           cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Contact an admin to update your email address.
            </p>
          </div>

          {/* Role (readonly) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Role
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={(profile?.role || 'user').charAt(0).toUpperCase() + (profile?.role || 'user').slice(1)}
                readOnly
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-100/60 dark:bg-slate-800/30 text-sm text-slate-500 dark:text-slate-400
                           cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="mt-6 flex items-center justify-end gap-3">
          {isDirty && (
            <span className="text-xs text-amber-500 dark:text-amber-400">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || updateProfile.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                       bg-primary-600 text-white hover:bg-primary-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-sm shadow-primary-600/20 transition-all duration-150"
          >
            {updateProfile.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
