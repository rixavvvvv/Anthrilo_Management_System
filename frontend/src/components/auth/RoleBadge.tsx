'use client';

import type { UserRole } from '@/lib/auth';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; dot: string }> = {
  admin: {
    label: 'Admin',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  manager: {
    label: 'Manager',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  staff: {
    label: 'Staff',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
};

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function RoleBadge({ role, size = 'sm', showDot = true }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.staff;
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
