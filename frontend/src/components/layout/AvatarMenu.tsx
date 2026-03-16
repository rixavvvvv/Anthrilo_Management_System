'use client';

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Settings, Moon, Sun, LogOut, ChevronDown,
  Users, History, KeyRound, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge } from '@/components/auth/RoleBadge';

// Helpers
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Types
type MenuItem = {
  label: string;
  icon: typeof User;
  href: string;
};

const PERSONAL_ITEMS: MenuItem[] = [
  { label: 'My Profile', icon: User, href: '/dashboard/profile' },
  { label: 'Account Settings', icon: Settings, href: '/dashboard/settings' },
  { label: 'Security', icon: KeyRound, href: '/dashboard/security' },
];

const ADMIN_ITEMS: MenuItem[] = [
  { label: 'Manage Users', icon: Users, href: '/dashboard/admin/users' },
  { label: 'Login History', icon: History, href: '/dashboard/admin/history' },
];

// Shared item class
const menuItemClass = [
  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px]',
  'text-slate-600 dark:text-slate-400',
  'hover:text-slate-900 dark:hover:text-slate-100',
  'hover:bg-slate-50/80 dark:hover:bg-white/[0.04]',
  'focus:bg-slate-50/80 dark:focus:bg-white/[0.04] focus:outline-none',
  'transition-all duration-150',
].join(' ');

// Component
export const AvatarMenu = memo(function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin, isOwner, logout } = useAuth();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [darkMode]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items?.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = focusIdx < items.length - 1 ? focusIdx + 1 : 0;
        setFocusIdx(next);
        (items[next] as HTMLElement).focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = focusIdx > 0 ? focusIdx - 1 : items.length - 1;
        setFocusIdx(prev);
        (items[prev] as HTMLElement).focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, focusIdx]);

  // Filter admin items by role
  const adminItems = useMemo(() => {
    if (!isAdmin && !isOwner) return [];
    return ADMIN_ITEMS.filter((_, i) => {
      if (i === 1) return isOwner; // Login History = owner only
      return isAdmin;
    });
  }, [isAdmin, isOwner]);

  const handleOpen = () => { setOpen((v) => !v); setFocusIdx(-1); };

  const signedInAgo = useMemo(() => timeAgo((user as any)?.last_login), [user]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={handleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 p-1 pr-2 rounded-xl
                   hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-primary-600 to-violet-600
                          flex items-center justify-center flex-shrink-0 overflow-hidden
                          ring-2 ring-primary-500/20 shadow-sm shadow-primary-600/20">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-white text-xs font-bold">{(user?.name?.[0] || 'A').toUpperCase()}</span>
            )}
          </div>
          {/* Online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500
                           border-2 border-white dark:border-slate-950
                           shadow-[0_0_6px_rgba(16,185,129,0.45)]" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden lg:block max-w-[100px] truncate">
          {user?.name?.split(' ')[0] || 'User'}
        </span>
        <ChevronDown
          className={`hidden lg:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2.5 w-72 z-50
                       rounded-2xl overflow-hidden
                       border border-white/50 dark:border-slate-700/50
                       bg-white/80 dark:bg-slate-900/80
                       backdrop-blur-2xl backdrop-saturate-[1.8]
                       shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
          >
            {/* Gradient header */}
            <div className="relative px-4 py-4 border-b border-slate-100/80 dark:border-slate-800/60
                            bg-gradient-to-br from-primary-50/60 via-white/0 to-violet-50/40
                            dark:from-primary-950/30 dark:via-transparent dark:to-violet-950/20">
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-600 to-violet-600
                                  flex items-center justify-center overflow-hidden
                                  shadow-md shadow-primary-600/20">
                    {user?.picture ? (
                      <img src={user.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {(user?.name?.[0] || 'A').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500
                                   border-[2.5px] border-white dark:border-slate-900
                                   shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {user?.email || ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {user?.role && <RoleBadge role={user.role} size="sm" />}
                    {signedInAgo && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                        <Clock className="w-2.5 h-2.5" />
                        {signedInAgo}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal section */}
            <div className="p-1.5">
              <div className="px-3 pt-1.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">
                  Personal
                </span>
              </div>
              {PERSONAL_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setOpen(false)}
                  className={menuItemClass}
                >
                  <item.icon className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.8} />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Admin section */}
            {adminItems.length > 0 && (
              <div className="p-1.5 border-t border-slate-100/80 dark:border-slate-800/60">
                <div className="px-3 pt-1.5 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">
                    Admin
                  </span>
                </div>
                {adminItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setOpen(false)}
                    className={menuItemClass}
                  >
                    <item.icon className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.8} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Preferences section */}
            <div className="p-1.5 border-t border-slate-100/80 dark:border-slate-800/60">
              <div className="px-3 pt-1.5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">
                  Preferences
                </span>
              </div>
              {/* Theme toggle */}
              <button
                role="menuitem"
                tabIndex={0}
                onClick={toggleTheme}
                className={`w-full justify-between ${menuItemClass}`}
              >
                <span className="flex items-center gap-2.5">
                  {darkMode
                    ? <Sun className="w-[14px] h-[14px]" strokeWidth={1.8} />
                    : <Moon className="w-[14px] h-[14px]" strokeWidth={1.8} />}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </span>
                <span className={`w-8 h-[18px] rounded-full relative transition-colors duration-200 ${
                  darkMode ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}>
                  <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm
                    transition-transform duration-200 ${darkMode ? 'translate-x-[16px]' : 'translate-x-[2px]'}`}
                  />
                </span>
              </button>
              {/* Logout */}
              <button
                role="menuitem"
                tabIndex={0}
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px]
                           text-red-500 dark:text-red-400
                           hover:bg-red-50/80 dark:hover:bg-red-950/20
                           hover:text-red-600 dark:hover:text-red-300
                           focus:bg-red-50/80 dark:focus:bg-red-950/20 focus:outline-none
                           transition-all duration-150"
              >
                <LogOut className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.8} />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
