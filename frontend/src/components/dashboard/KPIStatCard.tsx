'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface KPIStatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  change?: number; // percentage change
  changeLabel?: string;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'indigo' | 'emerald' | 'cyan';
  sparklineData?: number[];
  loading?: boolean;
  glass?: boolean;
  formatter?: (val: number) => string;
  delay?: number;
  /** Tooltip text explaining this metric to non-technical users */
  tooltip?: string;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500/8 to-indigo-500/8 dark:from-blue-500/10 dark:to-indigo-500/10',
    spark: '#3b82f6',
    glow: 'shadow-blue-500/5',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500/8 to-teal-500/8 dark:from-emerald-500/10 dark:to-teal-500/10',
    spark: '#10b981',
    glow: 'shadow-emerald-500/5',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    gradient: 'from-amber-500/8 to-orange-500/8 dark:from-amber-500/10 dark:to-orange-500/10',
    spark: '#f59e0b',
    glow: 'shadow-amber-500/5',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    icon: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
    gradient: 'from-rose-500/8 to-pink-500/8 dark:from-rose-500/10 dark:to-pink-500/10',
    spark: '#f43f5e',
    glow: 'shadow-rose-500/5',
  },
  purple: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
    gradient: 'from-violet-500/8 to-purple-500/8 dark:from-violet-500/10 dark:to-purple-500/10',
    spark: '#8b5cf6',
    glow: 'shadow-violet-500/5',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    icon: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
    gradient: 'from-indigo-500/8 to-blue-500/8 dark:from-indigo-500/10 dark:to-blue-500/10',
    spark: '#6366f1',
    glow: 'shadow-indigo-500/5',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    gradient: 'from-emerald-500/8 to-green-500/8 dark:from-emerald-500/10 dark:to-green-500/10',
    spark: '#10b981',
    glow: 'shadow-emerald-500/5',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    icon: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400',
    gradient: 'from-cyan-500/8 to-blue-500/8 dark:from-cyan-500/10 dark:to-blue-500/10',
    spark: '#06b6d4',
    glow: 'shadow-cyan-500/5',
  },
};

// Count-up hook
function useCountUp(target: number, duration = 800, delay = 0) {
  const [count, setCount] = useState(0);
  const animRef = useRef<number>();

  useEffect(() => {
    if (target === 0) { setCount(0); return; }

    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(target * eased));
        if (progress < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };
      animRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [target, duration, delay]);

  return count;
}

// Mini sparkline SVG
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const areaPoints = [...points, `${width},${height}`, `0,${height}`];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints.join(' ')}
        fill={`url(#spark-grad-${color.replace('#', '')})`}
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KPIStatCard({
  title,
  value,
  prefix = '',
  suffix = '',
  change,
  changeLabel,
  icon: Icon,
  color = 'blue',
  sparklineData,
  loading = false,
  glass = false,
  formatter,
  delay = 0,
  tooltip,
}: KPIStatCardProps) {
  const colors = colorMap[color];
  const numValue = typeof value === 'number' ? value : 0;
  const displayCount = useCountUp(typeof value === 'number' ? numValue : 0, 800, delay);
  const [showTooltip, setShowTooltip] = useState(false);

  const formattedValue =
    typeof value === 'string'
      ? value
      : formatter
        ? formatter(displayCount)
        : displayCount.toLocaleString('en-IN');

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="skeleton w-24 h-4" />
          <div className="skeleton w-9 h-9 rounded-xl" />
        </div>
        <div className="skeleton w-32 h-8" />
        <div className="skeleton w-20 h-3" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-200
        ${glass
          ? 'bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]'
          : `bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 bg-gradient-to-br ${colors.gradient}`
        }
        shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)]
        hover:-translate-y-0.5 group`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 relative">
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{title}</p>
          {tooltip && (
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip((p) => !p)}
              className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
              aria-label={`Info: ${title}`}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          <AnimatePresence>
            {showTooltip && tooltip && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-1.5 z-30 min-w-[180px] max-w-[240px]
                  bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900
                  text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl
                  pointer-events-none"
              >
                {tooltip}
                <div className="absolute -top-1 left-3 w-2 h-2 rotate-45 bg-slate-900 dark:bg-slate-100" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className={`p-2 rounded-xl ${colors.icon}`}>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            {prefix}{formattedValue}{suffix}
          </p>

          {/* Change indicator */}
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : change < 0 ? (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Minus className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span
                className={`text-xs font-semibold ${
                  change > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : change < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-400'
                }`}
              >
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-0.5">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="opacity-60 group-hover:opacity-100 transition-opacity">
            <Sparkline data={sparklineData} color={colors.spark} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
