'use client';

import { useQuery } from '@tanstack/react-query';
import { adsApi } from '@/lib/api/ads';
import { LoadingSpinner, StatCard, EmptyState } from '@/components/ui/Common';
import { DataTable, Column } from '@/components/ui/DataTable';
import type { AdsChannelSummary } from '@/types';
import { DollarSign, TrendingUp, ShoppingCart, Eye, MousePointer, Target } from 'lucide-react';

const fmt = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v.toLocaleString('en-IN')}`;

export default function AdsDashboard() {
  const { data: mtd, isLoading: loadingMtd } = useQuery({
    queryKey: ['ads', 'mtd'],
    queryFn: async () => (await adsApi.getMtdSummary()).data,
    staleTime: 5 * 60 * 1000,
  });

  const { data: channelsData, isLoading: loadingChannels } = useQuery({
    queryKey: ['ads', 'all-channels'],
    queryFn: async () => (await adsApi.getAllChannelsSummary()).data,
    staleTime: 5 * 60 * 1000,
  });

  const channels = channelsData?.channels || [];

  const columns: Column<AdsChannelSummary>[] = [
    { key: 'channel', header: 'Channel', render: (v: string) => (
      <span className="font-medium text-slate-900 dark:text-white">{v?.replace(/_/g, ' ')}</span>
    )},
    { key: 'spend', header: 'Ad Spend', render: (v: number) => fmt(v) },
    { key: 'ads_sale', header: 'Ads Sale', render: (v: number) => fmt(v) },
    { key: 'total_sale', header: 'Total Sale', render: (v: number) => fmt(v) },
    { key: 'units', header: 'Units', render: (v: number) => v?.toLocaleString('en-IN') || '0' },
    { key: 'acos', header: 'ACOS %', render: (v: number | undefined) => (
      <span className={v && v > 50 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
        {v !== null && v !== undefined ? `${v}%` : '—'}
      </span>
    )},
    { key: 'roas', header: 'ROAS', render: (v: number | undefined) => (
      <span className={v && v >= 3 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
        {v !== null && v !== undefined ? `${v}x` : '—'}
      </span>
    )},
    { key: 'entries', header: 'Entries' },
  ];

  if (loadingMtd && loadingChannels) {
    return <LoadingSpinner message="Loading ads dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* MTD Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Spend" value={mtd ? fmt(mtd.total_spend) : '—'}
          icon={<DollarSign className="w-5 h-5" />} color="red" />
        <StatCard title="Ads Sale" value={mtd ? fmt(mtd.total_ads_sale) : '—'}
          icon={<TrendingUp className="w-5 h-5" />} color="green" />
        <StatCard title="Total Sale" value={mtd ? fmt(mtd.total_total_sale) : '—'}
          icon={<ShoppingCart className="w-5 h-5" />} color="blue" />
        <StatCard title="ROAS" value={mtd?.roas !== null && mtd?.roas !== undefined ? `${mtd.roas}x` : '—'}
          icon={<Target className="w-5 h-5" />} color="emerald"
          trend={mtd?.roas ? { value: mtd.roas >= 3 ? mtd.roas : mtd.roas, isPositive: mtd.roas >= 3 } : undefined} />
        <StatCard title="ACOS" value={mtd?.acos !== null && mtd?.acos !== undefined ? `${mtd.acos}%` : '—'}
          icon={<Eye className="w-5 h-5" />} color="purple"
          trend={mtd?.acos ? { value: mtd.acos, isPositive: mtd.acos < 30 } : undefined} />
        <StatCard title="Units Sold" value={mtd ? mtd.total_units.toLocaleString('en-IN') : '—'}
          icon={<MousePointer className="w-5 h-5" />} color="yellow" />
      </div>

      {/* MTD Summary Banner */}
      {mtd && (
        <div className="card bg-gradient-to-br from-primary-50 to-indigo-50 dark:from-primary-950/30 dark:to-indigo-950/30 border-primary-200 dark:border-primary-800/50">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Period:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.period}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">TACOS:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.tacos ?? '—'}%</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">ROI:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.roi ?? '—'}x</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">CTR:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.ctr ?? '—'}%</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Impressions:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.total_impressions.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Clicks:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.total_clicks.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Entries:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{mtd.entry_count}</span>
            </div>
          </div>
        </div>
      )}

      {/* Channel Performance Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Channel Performance (MTD)</h3>
        {channels.length === 0 && !loadingChannels ? (
          <EmptyState title="No ads data yet" description="Start entering ads data to see channel performance here." />
        ) : (
          <DataTable data={channels} columns={columns} isLoading={loadingChannels} emptyMessage="No channel data" />
        )}
      </div>
    </div>
  );
}
