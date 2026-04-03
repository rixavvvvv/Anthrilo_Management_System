'use client';

import type { UserRole } from '@/lib/auth';

type RoleConfig = { label: string; bg: string; text: string; dot: string };

const SYSTEM_ROLE_CONFIG: Record<string, RoleConfig> = {
  developer: {
    label: 'Developer',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  admin: {
    label: 'Admin',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  user: {
    label: 'User',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

const customRoleConfig: RoleConfig = {
  label: 'Custom',
  bg: 'bg-cyan-50 dark:bg-cyan-950/40',
  text: 'text-cyan-600 dark:text-cyan-400',
  dot: 'bg-cyan-500',
};

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function RoleBadge({ role, size = 'sm', showDot = true }: RoleBadgeProps) {
  const normalized = (role || 'user').toLowerCase();
  const config = SYSTEM_ROLE_CONFIG[normalized] || {
    ...customRoleConfig,
    label: normalized.replace(/_/g, ' '),
  };
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wider
        ${config.bg} ${config.text} ${textSize} ${padding}`}
    >
      {showDot && <span className={`${dotSize} rounded-full ${config.dot}`} />}
      {config.label}
    </span>
  );
}
