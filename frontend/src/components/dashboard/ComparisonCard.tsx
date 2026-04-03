'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface ComparisonMetric {
  label: string;
  today: number;
  yesterday: number;
  formatter?: (v: number) => string;
}

interface ComparisonCardProps {
  metrics: ComparisonMetric[];
  loading?: boolean;
  title?: string;
  leftLabel?: string;
  rightLabel?: string;
}

const defaultFormatter = (v: number) => v.toLocaleString('en-IN');

export function ComparisonCard({
  metrics,
  loading = false,
  title = 'Today vs Yesterday',
  leftLabel = 'Today',
  rightLabel = 'Yesterday',
}: ComparisonCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:p-6 2xl:p-7">
        <div className="skeleton h-5 w-40 mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="skeleton h-3 w-16 mx-auto" />
              <div className="skeleton h-7 w-20 mx-auto" />
              <div className="skeleton h-3 w-24 mx-auto" />
              <div className="skeleton h-5 w-14 mx-auto rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800
        bg-white dark:bg-slate-900 shadow-[var(--shadow-soft)] p-4 sm:p-5 lg:p-6 2xl:p-7"
    >
      <h3 className="text-sm 2xl:text-base font-semibold text-slate-900 dark:text-white mb-4 sm:mb-5">{title}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {metrics.map((metric, i) => {
          const fmt = metric.formatter || defaultFormatter;
          const change = metric.yesterday > 0
            ? ((metric.today - metric.yesterday) / metric.yesterday) * 100
            : 0;
          const isUp = change > 0;
          const isFlat = change === 0;

          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="text-center"
            >
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2">
                {metric.label}
              </p>
              <p className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white">
                {fmt(metric.today)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{leftLabel}</p>
              <p className="text-xs text-slate-400 mt-1">
                vs {fmt(metric.yesterday)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-0.5">{rightLabel}</p>
              <div
                className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isFlat
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    : isUp
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {isFlat ? (
                  <Minus className="w-3 h-3" />
                ) : isUp ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(change).toFixed(1)}%
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
