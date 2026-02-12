'use client';

import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { PageHeader, StatCard } from '@/components/ui/Common';
import Link from 'next/link';

export default function FinancialPage() {
  // Reuse cached UC data
  const { data: todayData, isLoading: loadingToday } = useQuery({
    queryKey: ['unicommerce-today'],
    queryFn: async () => { const r = await ucSales.getToday(); return r.data; },
    staleTime: 2 * 60 * 1000,
  });

  const { data: weekData, isLoading: loadingWeek } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => { const r = await ucSales.getLast7Days(); return r.data; },
    staleTime: 5 * 60 * 1000,
  });

  const { data: yesterdayData, isLoading: loadingYesterday } = useQuery({
    queryKey: ['unicommerce-yesterday'],
    queryFn: async () => { const r = await ucSales.getYesterday(); return r.data; },
    staleTime: 10 * 60 * 1000,
  });

  const today = todayData?.summary || {};
  const week = weekData?.summary || {};
  const yesterday = yesterdayData?.summary || {};

  // Compute growth %
  const revenueGrowth = yesterday.total_revenue && yesterday.total_revenue > 0
    ? (((today.total_revenue || 0) - yesterday.total_revenue) / yesterday.total_revenue * 100).toFixed(1)
    : null;

  const avgOrderValue = today.total_orders > 0 ? (today.total_revenue || 0) / today.total_orders : 0;
  const weekAvgOrder = week.total_orders > 0 ? (week.total_revenue || 0) / week.total_orders : 0;

  const modules = [
    { title: 'Discount Management', description: 'Track and manage product discounts across channels', icon: '💸', href: '/dashboard/financial/discounts' },
    { title: 'ROI Analysis', description: 'Return on investment and profitability analytics', icon: '📊', href: '/dashboard/financial/roi' },
  ];

  const reports = [
    { title: 'Discount Reports', description: 'General & panel-wise discount analysis', icon: '💰', href: '/dashboard/reports/sales/discount-general' },
    { title: 'Channel Revenue', description: 'Revenue breakdown by sales channel', icon: '🧾', href: '/dashboard/reports/sales/bundle-sku' },
    { title: 'Profit Margins', description: 'Product-wise profitability analysis', icon: '📈', href: '/dashboard/financial/roi' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Management" description="Track revenue, analyze profitability, and manage discounts" />

      {/* Key Metrics from Real UC Data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Today's Revenue"
          value={loadingToday ? '...' : `₹${((today.total_revenue || 0) / 1000).toFixed(1)}K`}
          icon="💵" color="green"
          trend={revenueGrowth ? { value: parseFloat(revenueGrowth), isPositive: parseFloat(revenueGrowth) >= 0 } : undefined}
        />
        <StatCard
          title="7-Day Revenue"
          value={loadingWeek ? '...' : `₹${((week.total_revenue || 0) / 1000).toFixed(1)}K`}
          icon="📊" color="blue"
        />
        <StatCard
          title="Avg Order Value"
          value={loadingToday ? '...' : `₹${avgOrderValue.toFixed(0)}`}
          icon="🛒" color="purple"
          trend={weekAvgOrder > 0 ? { value: Math.round(((avgOrderValue - weekAvgOrder) / weekAvgOrder) * 100), isPositive: avgOrderValue >= weekAvgOrder } : undefined}
        />
        <StatCard
          title="Today's Orders"
          value={loadingToday ? '...' : (today.total_orders || 0)}
          icon="📦" color="indigo"
        />
      </div>

      {/* Financial Insights Card */}
      <div className="card bg-gradient-to-r from-primary-50 to-violet-50 dark:from-primary-900/20 dark:to-violet-900/20 border-l-4 border-l-primary-500">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Financial Insights</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              All metrics are powered by real-time Unicommerce data. Analyze revenue trends, channel performance, and profitability.
            </p>
            <div className="flex gap-3">
              <Link href="/dashboard/financial/roi" className="btn btn-primary">View Analytics</Link>
              <Link href="/dashboard/reports/sales/discount-general" className="btn btn-secondary">Discount Reports</Link>
            </div>
          </div>
          <div className="text-6xl opacity-20">💎</div>
        </div>
      </div>

      {/* Management Modules */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Management</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="card hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-primary-500">
              <div className="text-4xl mb-3">{m.icon}</div>
              <h3 className="mb-2 text-slate-900 dark:text-white font-semibold">{m.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{m.description}</p>
              <div className="mt-4 text-primary-600 dark:text-primary-400 text-sm font-medium">Open Module →</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Reports */}
      <div>
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Reports & Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reports.map((r) => (
            <Link key={r.href} href={r.href} className="card hover:shadow-xl transition-all group">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{r.icon}</div>
              <h3 className="mb-2 text-slate-900 dark:text-white font-semibold">{r.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{r.description}</p>
              <div className="mt-4 text-primary-600 dark:text-primary-400 text-sm font-medium">View Report →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
