'use client';

import { useState } from 'react';
import { Calendar, Filter, RefreshCw } from 'lucide-react';

export type DateRange = '1d' | '7d' | '30d' | '90d' | 'custom';

interface FilterBarProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children?: React.ReactNode;
}

const ranges: { key: DateRange; label: string }[] = [
  { key: '1d', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export function FilterBar({
  selectedRange,
  onRangeChange,
  onRefresh,
  isRefreshing,
  children,
}: FilterBarProps) {
  return (
    <div
      className="sticky top-14 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3
                 bg-surface-50/80 dark:bg-slate-950/80 backdrop-blur-xl
                 border-b border-slate-200/40 dark:border-slate-800/40"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Date Range Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => onRangeChange(r.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                selectedRange === r.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {children}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="btn btn-ghost text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
