'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCheck, Info, AlertTriangle, CheckCircle, X,
} from 'lucide-react';

// Types
type NotifType = 'info' | 'alert' | 'success';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  timestamp: string;
  read: boolean;
}

// Config
const TYPE_CONFIG: Record<
  NotifType,
  { icon: typeof Info; color: string; bg: string; label: string; dot: string }
> = {
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    label: 'Info',
    dot: 'bg-blue-500',
  },
  alert: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    label: 'Alert',
    dot: 'bg-amber-500',
  },
  success: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    label: 'Success',
    dot: 'bg-emerald-500',
  },
};

// Mock notifications — replace with real API when ready
const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Daily Sales Synced',
    message: 'Unicommerce data for today is ready to view.',
    type: 'success',
    timestamp: '5m ago',
    read: false,
  },
  {
    id: '2',
    title: 'Low Stock Alert',
    message: 'Yarn type 30S/1 has fewer than 14 days of stock remaining.',
    type: 'alert',
    timestamp: '1h ago',
    read: false,
  },
  {
    id: '3',
    title: 'Report Available',
    message: 'Monthly SKU velocity report has been generated.',
    type: 'info',
    timestamp: '3h ago',
    read: false,
  },
  {
    id: '4',
    title: 'Inventory Sync Complete',
    message: 'Inventory data sync finished with no errors.',
    type: 'success',
    timestamp: 'Yesterday',
    read: true,
  },
];

// Component
export const NotificationDropdown = memo(function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                   hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" />

        {/* Animated unread dot */}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications panel"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.17, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-[370px] z-50
                       rounded-2xl border border-white/20 dark:border-slate-700/60
                       bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl
                       shadow-2xl shadow-black/15 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <motion.span
                    key={unreadCount}
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    className="px-1.5 py-0.5 text-[10px] font-bold rounded-full
                               bg-primary-100 dark:bg-primary-900/50
                               text-primary-700 dark:text-primary-300"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1.5 text-[11px] font-medium
                             text-primary-600 dark:text-primary-400
                             hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                /* Empty state */
                <div className="py-12 text-center select-none">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <Bell className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    You&apos;re all caught up!
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    No new notifications
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => {
                    const cfg = TYPE_CONFIG[n.type];
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => markRead(n.id)}
                        className={`group flex items-start gap-3 px-4 py-3.5 cursor-pointer
                                    border-b border-slate-50 dark:border-slate-800/40 last:border-0
                                    transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30 ${
                                      !n.read ? 'bg-slate-50/60 dark:bg-slate-800/20' : ''
                                    }`}
                      >
                        {/* Type icon */}
                        <div
                          className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg}`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-[13px] font-semibold leading-snug ${
                                !n.read
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {n.title}
                            </p>
                            {/* Dismiss */}
                            <button
                              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                              aria-label="Dismiss notification"
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100
                                         text-slate-300 hover:text-slate-500 dark:hover:text-slate-300
                                         transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              {n.timestamp}
                            </span>
                            {!n.read && (
                              <span
                                className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}
                                aria-hidden
                              />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
