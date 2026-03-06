'use client';

import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { adsApi } from '@/lib/api/ads';
import { PageHeader, LoadingSpinner, ErrorPanel } from '@/components/ui/Common';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, ShoppingCart, Package, Percent,
  Target, Megaphone, ArrowRight, ArrowUpRight, ArrowDownRight,
  BarChart3, Tag,
} from 'lucide-react';

const fmt = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function FinancialPage() {
  const { data: todayData, isLoading: lt } = useQuery({
    queryKey: ['unicommerce-today'],
    queryFn: async () => (await ucSales.getToday()).data,
    staleTime: 2 * 60 * 1000,
  });
  const { data: weekData, isLoading: lw } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => (await ucSales.getLast7Days()).data,
    staleTime: 5 * 60 * 1000,
  });
  const { data: yesterdayData } = useQuery({
    queryKey: ['unicommerce-yesterday'],
    queryFn: async () => (await ucSales.getYesterday()).data,
    staleTime: 10 * 60 * 1000,
  });
  const { data: mtdAds } = useQuery({
    queryKey: ['ads', 'mtd'],
    queryFn: async () => (await adsApi.getMtdSummary()).data,
    staleTime: 5 * 60 * 1000,
  });

  const today = todayData?.summary || {};
  const week = weekData?.summary || {};
  const yest = yesterdayData?.summary || {};
  const ads = mtdAds || {};

  const revenueGrowth = yest.total_revenue > 0 ? ((today.total_revenue || 0) - yest.total_revenue) / yest.total_revenue * 100 : null;
  const avgOV = today.total_orders > 0 ? (today.total_revenue || 0) / today.total_orders : 0;
  const weekAvgOV = week.total_orders > 0 ? (week.total_revenue || 0) / week.total_orders : 0;
  const aovGrowth = weekAvgOV > 0 ? ((avgOV - weekAvgOV) / weekAvgOV) * 100 : null;

  const adSpend = (ads as any).total_spend || 0;
  const adRevenue = (ads as any).total_ads_sale || (ads as any).total_total_sale || 0;
  const roas = adSpend > 0 ? adRevenue / adSpend : 0;

  const isLoading = lt || lw;

  const kpis = [
    { title: "Today's Revenue", value: fmt(today.total_revenue || 0), icon: DollarSign, accent: 'emerald', growth: revenueGrowth },
    { title: '7-Day Revenue', value: fmt(week.total_revenue || 0), icon: TrendingUp, accent: 'blue', growth: null },
    { title: 'Avg Order Value', value: fmt(avgOV), icon: ShoppingCart, accent: 'violet', growth: aovGrowth },
    { title: "Today's Orders", value: `${today.total_orders || 0}`, icon: Package, accent: 'amber', growth: null },
  ];

  const modules = [
    {
      title: 'Discount Analytics',
      desc: 'Track discounts across products and channels',
      href: '/dashboard/financial/discounts',
      icon: Percent,
      gradient: 'from-violet-500 to-purple-600',
      stat: week.avg_discount_pct ? `${week.avg_discount_pct.toFixed(1)}% avg` : undefined,
    },
    {
      title: 'Ads Management',
      desc: 'Dashboard, manual entry, CSV import & reports',
      href: '/dashboard/financial/ads',
      icon: Megaphone,
      gradient: 'from-pink-500 to-rose-600',
      stat: adSpend > 0 ? `${fmt(adSpend)} spent` : undefined,
    },
    {
      title: 'ROI Analysis',
      desc: 'Ad spend vs revenue, ROAS & profitability',
      href: '/dashboard/financial/roi',
      icon: Target,
      gradient: 'from-blue-500 to-indigo-600',
      stat: roas > 0 ? `${roas.toFixed(1)}x ROAS` : undefined,
    },
  ];

  const quickReports = [
    { title: 'Discount Report', desc: 'Product-wise discount buckets', href: '/dashboard/reports/sales/discount-general', icon: Percent },
    { title: 'Channel Discounts', desc: 'Channel-level comparison', href: '/dashboard/reports/sales/discount-by-panel', icon: Tag },
    { title: 'Ads Report', desc: 'Daily ad performance data', href: '/dashboard/financial/ads', icon: BarChart3 },
    { title: 'All Reports', desc: 'Browse full report library', href: '/dashboard/reports/reports-index', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Management" description="Revenue analytics, discounts, advertising, and profitability" />

      {isLoading ? <LoadingSpinner message="Loading financial data..." /> : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.title}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[var(--shadow-soft)] p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{kpi.title}</p>
                  <div className={`p-2 rounded-xl bg-${kpi.accent}-500/10`}>
                    <kpi.icon className={`w-4 h-4 text-${kpi.accent}-500`} strokeWidth={2} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
                {kpi.growth !== null && kpi.growth !== undefined && (
                  <div className={`flex items-center gap-1 mt-1.5 ${kpi.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {kpi.growth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span className="text-xs font-semibold">{Math.abs(kpi.growth).toFixed(1)}%</span>
                    <span className="text-[10px] text-slate-400 ml-0.5">vs yesterday</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Modules */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modules.map((m, i) => (
                <Link key={m.href} href={m.href}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.25 + i * 0.06 }}
                    whileHover={{ y: -3 }}
                    className="card-interactive p-5 flex flex-col gap-4 group h-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.gradient} flex items-center justify-center flex-shrink-0`}>
                        <m.icon className="w-5 h-5 text-white" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{m.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{m.desc}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                    </div>
                    {m.stat && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{m.stat}</span>
                      </div>
                    )}
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick Reports */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Reports</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {quickReports.map((r, i) => (
                <Link key={r.href} href={r.href}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.4 + i * 0.04 }}
                    className="group flex items-center gap-3 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-primary-500/10 transition-colors">
                      <r.icon className="w-4 h-4 text-slate-500 group-hover:text-primary-500 transition-colors" strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{r.title}</p>
                      <p className="text-[10px] text-slate-400 truncate">{r.desc}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
