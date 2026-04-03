'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  History, Activity, Loader2, CheckCircle, XCircle,
  Monitor, Globe, User, Filter, ChevronDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Types
interface LoginEntry {
  id: number;
  user_id: number;
  username: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

interface ActivityEntry {
  id: number;
  user_id: number;
  username: string | null;
  action: string;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

type Tab = 'logins' | 'activity';

// Action color mapping
const actionColors: Record<string, string> = {
  login: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  change_password: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  create_user: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  update_user: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  delete_user: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
};

function getActionColor(action: string) {
  return actionColors[action] || 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

// Helpers
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function parseUA(ua: string | null) {
  if (!ua) return 'Unknown';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Python')) return 'API Client';
  return ua.slice(0, 30);
}

// Page
function HistoryContent() {
  const [tab, setTab] = useState<Tab>('logins');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loginsQuery = useQuery({
    queryKey: ['login-history'],
    queryFn: async (): Promise<LoginEntry[]> => {
      const res = await apiClient.get('/auth/history/logins', { params: { limit: 200 } });
      return res.data;
    },
    staleTime: 30_000,
    enabled: tab === 'logins',
  });

  const activityQuery = useQuery({
    queryKey: ['activity-logs'],
    queryFn: async (): Promise<ActivityEntry[]> => {
      const res = await apiClient.get('/auth/history/activity', { params: { limit: 200 } });
      return res.data;
    },
    staleTime: 30_000,
    enabled: tab === 'activity',
  });

  const filteredLogins = useMemo(() => {
    const data = loginsQuery.data || [];
    if (statusFilter === 'all') return data;
    return data.filter((l) => l.status === statusFilter);
  }, [loginsQuery.data, statusFilter]);

  const isLoading = tab === 'logins' ? loginsQuery.isLoading : activityQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
          <History className="w-6 h-6 text-primary-600" />
          Login History & Activity
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monitor all authentication events and user actions
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
        {([
          { key: 'logins' as Tab, label: 'Login History', icon: History },
          { key: 'activity' as Tab, label: 'Activity Logs', icon: Activity },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter for logins */}
      {tab === 'logins' && (
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-xl px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      )}

      {/* Content */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          </div>
        ) : tab === 'logins' ? (
          /* Login History Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">IP Address</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Browser</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogins.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {entry.username || `User #${entry.user_id}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.status === 'success' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Globe className="w-3 h-3" />
                        {entry.ip_address || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Monitor className="w-3 h-3" />
                        {parseUA(entry.user_agent)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {fmtDateTime(entry.created_at)}
                    </td>
                  </tr>
                ))}
                {filteredLogins.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      No login records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Activity Logs */
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(activityQuery.data || []).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {entry.username || `User #${entry.user_id}`}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${getActionColor(entry.action)}`}>
                      {entry.action.replace('_', ' ')}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{entry.detail}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDateTime(entry.created_at)}
                    </span>
                    {entry.ip_address && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> {entry.ip_address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(activityQuery.data || []).length === 0 && (
              <div className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                No activity logs found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Export
export default function HistoryPage() {
  return (
    <ProtectedRoute allowedRoles={['developer']}>
      <HistoryContent />
    </ProtectedRoute>
  );
}
