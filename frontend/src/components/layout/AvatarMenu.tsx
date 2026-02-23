'use client';

import { useState, useRef, useEffect, memo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';

// ─── Menu Items ────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { label: 'Profile', icon: User, href: '#' },
  { label: 'Settings', icon: Settings, href: '#' },
];

// ─── Component ─────────────────────────────────────────────────────────────
export const AvatarMenu = memo(function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Profile menu"
        className="flex items-center gap-2 p-1 pr-2 rounded-xl
                   hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">A</span>
        </div>
        {/* Name (desktop only) */}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden lg:block">
          Admin
        </span>
        <ChevronDown
          className={`hidden lg:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Profile menu"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-52 z-50
                       rounded-2xl border border-white/20 dark:border-slate-700/60
                       bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl
                       shadow-2xl shadow-black/15 overflow-hidden"
          >
            {/* User info */}
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Admin
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    admin@anthrilo.com
                  </p>
                </div>
              </div>
            </div>

            {/* Nav links */}
            <div className="p-1.5">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px]
                             text-slate-600 dark:text-slate-400
                             hover:text-slate-900 dark:hover:text-slate-100
                             hover:bg-slate-50 dark:hover:bg-slate-800/50
                             transition-colors"
                >
                  <item.icon className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.8} />
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Logout */}
            <div className="p-1.5 border-t border-slate-100 dark:border-slate-800">
              <button
                role="menuitem"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px]
                           text-red-500 dark:text-red-400
                           hover:bg-red-50 dark:hover:bg-red-950/30
                           hover:text-red-600 dark:hover:text-red-300
                           transition-colors"
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
