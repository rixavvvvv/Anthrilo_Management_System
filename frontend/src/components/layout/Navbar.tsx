'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { Search, Moon, Sun, Command } from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationDropdown } from './NotificationDropdown';
import { AvatarMenu } from './AvatarMenu';

// Lazy-load command palette — only needed when opened
const CommandPalette = dynamic(
  () => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })),
  { ssr: false },
);

// ─── Theme Toggle ──────────────────────────────────────────────────────────
const ThemeToggle = memo(function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDark =
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggle = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <button
      onClick={toggle}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Light mode' : 'Dark mode'}
      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      {darkMode
        ? <Sun className="w-[18px] h-[18px]" />
        : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
});

// ─── Navbar ────────────────────────────────────────────────────────────────
export function Navbar() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Scroll-shadow: listen on the <main> scroller
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 4);
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  return (
    <>
      <header
        className={`h-14 flex-shrink-0 flex items-center justify-between px-5 gap-4
                    bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl
                    border-b border-slate-200/60 dark:border-slate-800/60
                    sticky top-0 z-30 transition-shadow duration-300
                    ${scrolled
                      ? 'shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_-2px_rgba(0,0,0,0.4)]'
                      : 'shadow-none'
                    }`}
      >
        {/* ── Left: Breadcrumbs ── */}
        <Breadcrumbs />

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-0.5 flex-shrink-0">

          {/* Search / Command Palette trigger */}
          <button
            onClick={openPalette}
            aria-label="Open command palette"
            title="Search (⌘K)"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl
                       text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
          >
            <Search className="w-[17px] h-[17px]" />
            {/* ⌘K hint badge */}
            <kbd
              className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium
                         bg-slate-100 dark:bg-slate-800 text-slate-400
                         ring-1 ring-slate-200 dark:ring-slate-700
                         group-hover:ring-slate-300 dark:group-hover:ring-slate-600 transition-all"
            >
              <Command className="w-2.5 h-2.5" />
              K
            </kbd>
          </button>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1.5" aria-hidden />

          {/* Avatar + profile menu */}
          <AvatarMenu />
        </div>
      </header>

      {/* Command Palette (lazy) */}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </>
  );
}
