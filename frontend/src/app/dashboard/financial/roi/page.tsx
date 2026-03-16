'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales, adsApi } from '@/features/financial';
import { PageHeader, ProgressLoader, ErrorPanel, EmptyState } from '@/components/ui/Common';
import { DataTable, Column } from '@/components/ui/DataTable';
import { motion } from 'framer-motion';
import {
  Target, DollarSign, TrendingUp, Zap,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const fmt = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ROIAnalysisPage() {
  // Ads MTD summary
  const { data: mtdData, isLoading: loadingMtd, error: mtdErr } = useQuery({
    queryKey: ['ads', 'mtd'],
    queryFn: async () => (await adsApi.getMtdSummary()).data,
    staleTime: 5 * 60 * 1000,
  });

  // Channel-level ads summary
  const { data: channelsData, isLoading: loadingCh } = useQuery({
    queryKey: ['ads', 'all-channels'],
    queryFn: async () => (await adsApi.getAllChannelsSummary()).data,
    staleTime: 5 * 60 * 1000,
  });

  // Revenue data for context
  const { data: weekData } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => (await ucSales.getLast7Days()).data,
    staleTime: 5 * 60 * 1000,
  });

  const mtd = (mtdData || {}) as any;
  const channels = channelsData?.channels || [];
  const weekRevenue = weekData?.summary?.total_revenue || 0;

  const totalSpend = mtd.total_spend || 0;
  const totalAdsSale = mtd.total_ads_sale || 0;
  const totalSale = mtd.total_total_sale || 0;
  const revenueForRoi = totalSale > 0 ? totalSale : totalAdsSale;
  const roi = totalSpend > 0 ? ((revenueForRoi - totalSpend) / totalSpend) * 100 : 0;
  const roas = totalSpend > 0 ? revenueForRoi / totalSpend : 0;
  const netProfit = revenueForRoi - totalSpend;

  const isLoading = loadingMtd || loadingCh;

  // Channel ROI table
  const channelRows = useMemo(() =>
    channels.map((ch: any) => {
      const spend = ch.spend || 0;
      const adsSale = ch.ads_sale || 0;
      const totalS = ch.total_sale || adsSale;
      const rev = totalS > 0 ? totalS : adsSale;
      return {
        channel: ch.channel?.replace(/_/g, ' ') || 'Unknown',
        spend,
        revenue: rev,
        profit: rev - spend,
        roi: spend > 0 ? ((rev - spend) / spend) * 100 : 0,
        roas: spend > 0 ? rev / spend : 0,
        acos: ch.acos ?? (rev > 0 ? (spend / rev) * 100 : 0),
        units: ch.units || 0,
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue),
    [channels]
  );

  const columns: Column<any>[] = [
    {
      key: 'channel', header: 'Channel', width: '18%',
      render: (v) => <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{v}</span>,
    },
    {
      key: 'spend', header: 'Ad Spend', width: '13%',
      render: (v) => <span className="text-rose-600 dark:text-rose-400 font-semibold">{fmt(v)}</span>,
    },
    {
      key: 'revenue', header: 'Revenue', width: '13%',
      render: (v) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fmt(v)}</span>,
    },
    {
      key: 'profit', header: 'Net Profit', width: '13%',
      render: (v) => {
        const pos = v >= 0;
        return <span className={`font-bold ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{pos ? '+' : ''}{fmt(v)}</span>;
      },
    },
    {
      key: 'roi', header: 'ROI %', width: '10%',
      render: (v) => {
        const pos = v >= 0;
        return (
          <div className="flex items-center gap-1">
            {pos ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <ArrowDownRight className="w-3 h-3 text-rose-500" />}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${pos ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-600 bg-rose-500/10'}`}>
              {v.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'roas', header: 'ROAS', width: '10%',
      render: (v) => <span className={`font-bold ${v >= 2 ? 'text-emerald-600 dark:text-emerald-400' : v >= 1 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{v.toFixed(1)}x</span>,
    },
    {
      key: 'acos', header: 'ACOS %', width: '10%',
      render: (v) => <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${(v || 0) > 50 ? 'text-rose-600 bg-rose-500/10' : 'text-emerald-600 bg-emerald-500/10'}`}>{(v || 0).toFixed(1)}%</span>,
    },
    {
      key: 'units', header: 'Units', width: '8%',
      render: (v) => <span className="font-semibold text-slate-900 dark:text-white">{(v || 0).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="ROI Analysis" description="Ad spend vs revenue, ROAS, and profitability across channels" />

      <ProgressLoader loading={isLoading} stages={[
        { at: 0, label: 'Connecting to data sources…' },
        { at: 25, label: 'Fetching ad spend & revenue…' },
        { at: 55, label: 'Calculating ROI metrics…' },
        { at: 85, label: 'Finalizing…' },
      ]} />
      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total Ad Spend', value: fmt(totalSpend), icon: DollarSign, accent: 'rose', sub: 'Month to date' },
              { title: 'Revenue Generated', value: fmt(revenueForRoi), icon: TrendingUp, accent: 'emerald', sub: weekRevenue > 0 ? `7d UC: ${fmt(weekRevenue)}` : 'From ads' },
              { title: 'ROI', value: `${roi.toFixed(1)}%`, icon: Target, accent: 'blue', sub: `Net ${netProfit >= 0 ? '+' : ''}${fmt(netProfit)}` },
              { title: 'ROAS', value: `${roas.toFixed(1)}x`, icon: Zap, accent: 'violet', sub: roas >= 2 ? 'Efficient' : roas >= 1 ? 'Break-even' : 'Below target' },
            ].map((kpi, i) => (
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
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{kpi.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* ROI Formula */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 flex items-center gap-3">
            <Target className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-blue-700 dark:text-blue-300">ROI = </span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">((Revenue − Spend) / Spend) × 100</span>
              <span className="text-blue-500 mx-2">|</span>
              <span className="font-semibold text-blue-700 dark:text-blue-300">ROAS = </span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">Revenue / Spend</span>
            </div>
          </div>

          {/* Channel Breakdown Table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Channel ROI Breakdown</h3>
              <span className="text-xs text-slate-400">{channelRows.length} channels</span>
            </div>
            {channelRows.length === 0 ? (
              <EmptyState title="No ad data yet" description="Enter ad spend data in Financial → Ads to see ROI calculations here." />
            ) : (
              <DataTable data={channelRows} columns={columns} emptyMessage="No channel data available." />
            )}
          </div>

          {mtdErr && <ErrorPanel message="Failed to load ads data for ROI calculation." />}
        </>
      )}
    </div>
  );
}
