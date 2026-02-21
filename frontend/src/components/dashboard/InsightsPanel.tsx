'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Zap, BarChart3,
} from 'lucide-react';

interface InsightsPanelProps {
  todayRevenue: number;
  yesterdayRevenue: number;
  todayOrders: number;
  yesterdayOrders: number;
  todayItems: number;
  yesterdayItems: number;
  topChannel?: { name: string; revenue: number; percentage: number };
  totalChannels?: number;
  loading?: boolean;
  comparisonLabel?: string;
}

interface Insight {
  icon: typeof TrendingDown;
  text: string;
  type: 'positive' | 'negative' | 'neutral' | 'info';
}

export function InsightsPanel({
  todayRevenue,
  yesterdayRevenue,
  todayOrders,
  yesterdayOrders,
  todayItems,
  yesterdayItems,
  topChannel,
  totalChannels,
  loading = false,
  comparisonLabel = 'yesterday',
}: InsightsPanelProps) {
  const insights = useMemo<Insight[]>(() => {
    if (loading) return [];

    const result: Insight[] = [];

    // Revenue change
    if (yesterdayRevenue > 0) {
      const revenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
      if (revenueChange < -20) {
        result.push({
          icon: TrendingDown,
          text: `Revenue dropped ${Math.abs(revenueChange).toFixed(0)}% compared to ${comparisonLabel}.`,
          type: 'negative',
        });
      } else if (revenueChange > 20) {
        result.push({
          icon: TrendingUp,
          text: `Revenue is up ${revenueChange.toFixed(0)}% compared to ${comparisonLabel}.`,
          type: 'positive',
        });
      } else if (Math.abs(revenueChange) <= 5) {
        result.push({
          icon: CheckCircle,
          text: `Revenue is tracking close to ${comparisonLabel} — stable.`,
          type: 'neutral',
        });
      }
    }

    // Order change
    if (yesterdayOrders > 0) {
      const orderChange = ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
      if (orderChange < -15) {
        result.push({
          icon: AlertTriangle,
          text: `Orders are down ${Math.abs(orderChange).toFixed(0)}% — check channel performance.`,
          type: 'negative',
        });
      } else if (orderChange > 15) {
        result.push({
          icon: Zap,
          text: `Orders surged ${orderChange.toFixed(0)}% — great momentum.`,
          type: 'positive',
        });
      }
    }

    // AOV insight
    if (todayOrders > 0 && yesterdayOrders > 0) {
      const todayAOV = todayRevenue / todayOrders;
      const yesterdayAOV = yesterdayRevenue / yesterdayOrders;
      const aovChange = ((todayAOV - yesterdayAOV) / yesterdayAOV) * 100;
      if (aovChange > 10) {
        result.push({
          icon: TrendingUp,
          text: `Avg order value increased ${aovChange.toFixed(0)}% — customers are spending more per order.`,
          type: 'positive',
        });
      } else if (aovChange < -10) {
        result.push({
          icon: TrendingDown,
          text: `Avg order value decreased ${Math.abs(aovChange).toFixed(0)}% — consider bundling or upsells.`,
          type: 'negative',
        });
      }
    }

    // Top channel contribution
    if (topChannel && topChannel.percentage > 0) {
      result.push({
        icon: BarChart3,
        text: `${topChannel.name} contributed ${topChannel.percentage.toFixed(0)}% of total revenue.`,
        type: 'info',
      });
    }

    // Fallback if no notable insights
    if (result.length === 0 && todayOrders > 0) {
      result.push({
        icon: CheckCircle,
        text: 'All metrics look normal today — no major shifts detected.',
        type: 'neutral',
      });
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRevenue, yesterdayRevenue, todayOrders, yesterdayOrders, topChannel, loading, comparisonLabel]);

  const typeStyles = {
    positive: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400',
    negative: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-800/30 text-rose-700 dark:text-rose-400',
    neutral: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-700/30 text-slate-600 dark:text-slate-400',
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 text-blue-700 dark:text-blue-400',
  };

  const iconStyles = {
    positive: 'text-emerald-500',
    negative: 'text-rose-500',
    neutral: 'text-slate-400',
    info: 'text-blue-500',
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => {
        const IconComp = insight.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm leading-relaxed ${typeStyles[insight.type]}`}
          >
            <IconComp className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconStyles[insight.type]}`} />
            <span>{insight.text}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
