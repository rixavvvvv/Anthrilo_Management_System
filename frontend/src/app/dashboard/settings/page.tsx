'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Settings, Globe, Languages, Bell, Save, Loader2, CheckCircle2, AlertTriangle, User,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Constants
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST) — Asia/Kolkata' },
  { value: 'America/New_York', label: 'Eastern (EST) — America/New_York' },
  { value: 'America/Chicago', label: 'Central (CST) — America/Chicago' },
  { value: 'America/Denver', label: 'Mountain (MST) — America/Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific (PST) — America/Los_Angeles' },
  { value: 'Europe/London', label: 'UK (GMT) — Europe/London' },
  { value: 'Europe/Berlin', label: 'CET — Europe/Berlin' },
  { value: 'Asia/Dubai', label: 'Gulf (GST) — Asia/Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT) — Asia/Singapore' },
  { value: 'Asia/Tokyo', label: 'Japan (JST) — Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Australia (AEST) — Australia/Sydney' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];

// Types
interface Preferences {
  full_name: string;
  timezone: string;
  language: string;
  email_notifications: boolean;
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

// Select Component
function SelectField({ icon: Icon, label, value, onChange, options }: {
  icon: typeof Globe;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                     bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100
                     focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all
                     appearance-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Page
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Preferences>({
    full_name: '',
    timezone: 'Asia/Kolkata',
    language: 'en',
    email_notifications: true,
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch preferences
  const { data: prefs, isLoading } = useQuery<Preferences>({
    queryKey: ['preferences'],
    queryFn: async () => (await apiClient.get('/auth/me/preferences')).data,
  });

  // Seed form
  useEffect(() => {
    if (prefs) setForm(prefs);
  }, [prefs]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Preferences>) => {
      return (await apiClient.put('/auth/me/preferences', data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setToast({ message: 'Settings saved successfully', type: 'success' });
    },
    onError: (err: any) => {
      setToast({ message: err.response?.data?.detail || 'Failed to save settings', type: 'error' });
    },
  });

  const handleSave = () => saveMutation.mutate(form);

  const isDirty = prefs && (
    form.full_name !== prefs.full_name ||
    form.timezone !== prefs.timezone ||
    form.language !== prefs.language ||
    form.email_notifications !== prefs.email_notifications
  );

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
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40">
            <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Account Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Customize your experience and notification preferences.
            </p>
          </div>
        </div>
      </motion.div>

      {/* General */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">General</h3>
        <div className="space-y-4">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your display name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700
                           bg-slate-50/50 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100
                           focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
          <SelectField
            icon={Globe}
            label="Timezone"
            value={form.timezone}
            onChange={(v) => setForm((p) => ({ ...p, timezone: v }))}
            options={TIMEZONES}
          />
          <SelectField
            icon={Languages}
            label="Language"
            value={form.language}
            onChange={(v) => setForm((p) => ({ ...p, language: v }))}
            options={LANGUAGES}
          />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                   bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Notifications</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Email Notifications</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Receive important updates and alerts via email.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, email_notifications: !p.email_notifications }))}
            className={`w-11 h-6 rounded-full relative transition-colors duration-200 outline-none border-0 ring-0 appearance-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
              form.email_notifications ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
          >
            <span className={`absolute left-[3px] top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm
              transition-transform duration-200 ${form.email_notifications ? 'translate-x-[20px]' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </motion.div>

      {/* Save button */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 flex items-center justify-end gap-3"
      >
        {isDirty && (
          <span className="text-xs text-amber-500 dark:text-amber-400">Unsaved changes</span>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                     bg-primary-600 text-white hover:bg-primary-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-sm shadow-primary-600/20 transition-all duration-150"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </motion.div>
    </div>
  );
}
