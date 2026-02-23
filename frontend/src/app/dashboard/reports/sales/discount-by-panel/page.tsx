'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

export default function DiscountByChannelPage() {
  const [period, setPeriod] = useState('last_7_days');

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-discount-by-channel', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  // Aggregate discount data by channel from SKU-level data
  const channelDiscounts = useMemo(() => {
    const skus = data?.skus || [];
    const channelMap: Record<string, { channel: string; orders: number; revenue: number; discount: number; quantity: number }> = {};

    for (const sku of skus) {
      const channels = sku.channels || {};
      for (const [channel, chData] of Object.entries(channels) as [string, any][]) {
        if (!channelMap[channel]) {
          channelMap[channel] = { channel, orders: 0, revenue: 0, discount: 0, quantity: 0 };
        }
        channelMap[channel].revenue += chData.revenue || 0;
        channelMap[channel].quantity += chData.quantity || 0;
      }
      // Distribute discount proportionally across channels
      const totalRev = sku.total_revenue || 0;
      const totalDisc = sku.total_discount || 0;
      if (totalRev > 0 && totalDisc > 0) {
        for (const [channel, chData] of Object.entries(channels) as [string, any][]) {
          const proportion = (chData.revenue || 0) / totalRev;
          channelMap[channel].discount += totalDisc * proportion;
        }
      }
      // Count orders by channel
      channelMap[Object.keys(channels)[0] || 'UNKNOWN'] && (function () {
        for (const ch of Object.keys(channels)) {
          if (channelMap[ch]) channelMap[ch].orders += 1;
        }
      })();
    }

    const total_revenue = Object.values(channelMap).reduce((sum, c) => sum + c.revenue, 0);

    return Object.values(channelMap)
      .map((ch) => ({
        ...ch,
        revenue: Math.round(ch.revenue * 100) / 100,
        discount: Math.round(ch.discount * 100) / 100,
        discount_pct: ch.revenue > 0 ? Math.round((ch.discount / ch.revenue) * 10000) / 100 : 0,
        net_revenue: Math.round((ch.revenue - ch.discount) * 100) / 100,
        revenue_share: total_revenue > 0 ? Math.round((ch.revenue / total_revenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const summary = data?.summary || {};
  const overallDiscountPct = summary.total_revenue > 0
    ? ((summary.total_discount || 0) / summary.total_revenue * 100).toFixed(1)
    : '0.0';

  const columns: Column<any>[] = [
    {
      key: 'channel', header: 'Channel', width: '20%',
      render: (value) => (
        <span className="px-3 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{value}</span>
      ),
    },
    {
      key: 'revenue', header: 'Gross Revenue', width: '15%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>,
    },
    {
      key: 'discount', header: 'Total Discount', width: '14%',
      render: (value) => <span className="text-orange-600 dark:text-orange-400 font-semibold">₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>,
    },
    {
      key: 'discount_pct', header: 'Disc %', width: '10%',
      render: (value) => {
        const v = value || 0;
        const c = v > 30 ? 'text-rose-600 dark:text-rose-400' : v > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
        return <span className={`font-bold ${c}`}>{v.toFixed(1)}%</span>;
      },
    },
    {
      key: 'net_revenue', header: 'Net Revenue', width: '15%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>,
    },
    {
      key: 'revenue_share', header: 'Revenue Share', width: '14%',
      render: (value) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(value || 0, 100)}%` }} />
          </div>
          <span className="font-medium text-sm">{(value || 0).toFixed(1)}%</span>
        </div>
      ),
    },
    {
      key: 'quantity', header: 'Items', width: '8%',
      render: (value) => <span className="font-medium">{(value || 0).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Discount by Channel" description="Channel-wise discount analysis from Anthrilo" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Overall Discount %" value={`${overallDiscountPct}%`} icon="💸" color="blue" />
        <StatCard title="Total Revenue" value={`₹${((summary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="🏷️" color="green" />
        <StatCard title="Total Discount" value={`₹${((summary.total_discount || 0) / 1000).toFixed(1)}K`} icon="💰" color="red" />
        <StatCard title="Channels" value={channelDiscounts.length.toString()} icon="🏪" color="purple" />
      </div>

      <div className="card">
        <div className="flex gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last_7_days', label: '7 Days' },
            { key: 'last_30_days', label: '30 Days' },
          ].map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load discount data'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Discount by Channel</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching discount data from Anthrilo..." />
        ) : (
          <DataTable data={channelDiscounts} columns={columns} emptyMessage="No discount data available for this period." />
        )}
      </div>
    </div>
  );
}
