'use client';

import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, Maximize2, MoreHorizontal } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  downloadable?: boolean;
  glass?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className = '',
  downloadable = true,
  glass = false,
}: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    if (!chartRef.current) return;
    try {
      const svgEl = chartRef.current.querySelector('svg.recharts-surface');
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx?.scale(2, 2);
        ctx?.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-chart.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch {
      // Silently fail
    }
  }, [title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-2xl p-6 border transition-all duration-200
        ${glass
          ? 'bg-[var(--glass-bg)] backdrop-blur-xl border-[var(--glass-border)]'
          : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800'
        }
        shadow-[var(--shadow-soft)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {action}
          {downloadable && (
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                         hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Download as PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Content */}
      <div ref={chartRef}>{children}</div>
    </motion.div>
  );
}
