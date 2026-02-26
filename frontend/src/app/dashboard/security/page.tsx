'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle,
  Monitor, Smartphone, Laptop, Globe, Trash2, LogOut, Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SessionItem {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  device_label: string | null;
  is_current: boolean;
  created_at: string;
  expires_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getDeviceIcon(label: string | null) {
  if (!label) return Monitor;
  const lower = label.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return Smartphone;
  if (lower.includes('macbook') || lower.includes('laptop')) return Laptop;
  return Monitor;
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Strong', color: 'bg-emerald-500' };
  return { score, label: 'Very Strong', color: 'bg-emerald-600' };
}

// ─── Toast ─────────────────────────────────────────────────────────────────
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

// ─── Page ──────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ─── Password form state ─────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);
  const passwordsMatch = newPassword === confirmPassword;
  const canChangePassword = oldPassword.length > 0 && newPassword.length >= 8 && passwordsMatch;

  // ─── Change password mutation ────────────────────────────────────────
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return (await apiClient.put('/auth/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      })).data;
    },
    onSuccess: () => {
      setToast({ message: 'Password changed successfully', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: any) => {
      setToast({ message: err.response?.data?.detail || 'Failed to change password', type: 'error' });
    },
  });

  // ─── Sessions query ──────────────────────────────────────────────────
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => (await apiClient.get('/auth/sessions')).data,
  });

  // ─── Revoke session mutation ─────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      return (await apiClient.delete(`/auth/sessions/${sessionId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setToast({ message: 'Session revoked', type: 'success' });
    },
    onError: (err: any) => {
      setToast({ message: err.response?.data?.detail || 'Failed to revoke session', type: 'error' });
    },
  });

  // ─── Logout others mutation ──────────────────────────────────────────
  const logoutOthersMutation = useMutation({
    mutationFn: async () => {
      return (await apiClient.post('/auth/sessions/logout-others')).data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setToast({ message: data.detail || 'All other sessions revoked', type: 'success' });
    },
    onError: (err: any) => {
      setToast({ message: err.response?.data?.detail || 'Failed to logout other sessions', type: 'error' });
    },
  });

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40">
            <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Security</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your password and active sessions.
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Change Password ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change Password</h3>
        </div>

        <div className="space-y-4">
          {/* Current password */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      i <= strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700'
                    }`} />
                  ))}
                </div>
                <p className={`text-[11px] mt-1 ${
                  strength.score <= 2 ? 'text-red-500' : strength.score <= 3 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm
                           bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500/30 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                  confirmPassword && !passwordsMatch
                    ? 'border-red-300 dark:border-red-700 focus:border-red-500'
                    : 'border-slate-200 dark:border-slate-700 focus:border-primary-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => changePasswordMutation.mutate()}
            disabled={!canChangePassword || changePasswordMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                       bg-primary-600 text-white hover:bg-primary-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-sm shadow-primary-600/20 transition-all duration-150"
          >
            {changePasswordMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            Update Password
          </button>
        </div>
      </motion.div>

      {/* ── Active Sessions ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Active Sessions</h3>
            {sessions.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800
                               text-slate-500 dark:text-slate-400 font-medium">
                {sessions.length}
              </span>
            )}
          </div>
          {otherSessionsCount > 0 && (
            <button
              onClick={() => logoutOthersMutation.mutate()}
              disabled={logoutOthersMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-red-500 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-950/30
                         disabled:opacity-50 transition-colors"
            >
              {logoutOthersMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <LogOut className="w-3 h-3" />
              )}
              Logout all others
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-6 h-6 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device_label);
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl
                               bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100/60 dark:border-slate-800/40"
                  >
                    <div className={`p-2 rounded-lg ${
                      session.is_current
                        ? 'bg-primary-50 dark:bg-primary-950/40'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <DeviceIcon className={`w-4 h-4 ${
                        session.is_current
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {session.device_label || 'Unknown device'}
                        </p>
                        {session.is_current && (
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                           bg-emerald-50 dark:bg-emerald-950/40
                                           text-emerald-600 dark:text-emerald-400">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {session.ip_address || 'Unknown IP'}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(session.created_at)}
                        </span>
                      </div>
                    </div>
                    {!session.is_current && (
                      <button
                        onClick={() => revokeMutation.mutate(session.id)}
                        disabled={revokeMutation.isPending}
                        className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-500
                                   hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Revoke session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
