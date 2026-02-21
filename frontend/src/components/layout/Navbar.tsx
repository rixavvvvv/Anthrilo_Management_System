'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, Moon, Sun, Command } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

export function Navbar() {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const isDark =
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = useCallback(() => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Build breadcrumb from pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  return (
    <header
      className="h-14 flex-shrink-0 flex items-center justify-between px-6
                 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl
                 border-b border-slate-200/60 dark:border-slate-800/60
                 sticky top-0 z-30"
    >
      {/* Left — Breadcrumb */}
      <nav className="hidden sm:flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>}
            {crumb.isLast ? (
              <span className="text-slate-800 dark:text-slate-200 font-medium capitalize">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-slate-400 dark:text-slate-500 capitalize hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right — Actions */}
      <div className="flex items-center gap-1.5">
        {/* Search Button */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Search (⌘K)"
        >
          <Search className="w-[18px] h-[18px]" />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1.5" />

        {/* Avatar */}
        <button className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">A</span>
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden lg:block">
            Admin
          </span>
        </button>
      </div>
    </header>
  );
}
