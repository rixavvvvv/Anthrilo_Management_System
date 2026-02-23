'use client';

import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Download, BarChart3, TrendingUp, TrendingDown,
  ArrowUpDown, ArrowUp, ArrowDown, Search, Sparkles, Flame,
  Package, ShoppingCart, Layers, Store, FileText, Loader2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

/* ── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: number) =>
  v >= 10_000_000 ? `₹${(v / 10_000_000).toFixed(2)}Cr`
    : v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L`
      : v >= 1_000 ? `₹${(v / 1_000).toFixed(1)}K`
        : `₹${v.toLocaleString('en-IN')}`;

const fmtFull = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const channelLabel = (c: string) =>
  c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/ New$/, '').replace(/ Api$/, '').replace(/ 26$/, '');

const CHANNEL_META: Record<string, { color: string; icon: string }> = {
  MYNTRA:            { color: '#EC4899', icon: 'M' },
  FIRSTCRY_NEW:      { color: '#F97316', icon: 'FC' },
  AMAZON_FLEX:       { color: '#F59E0B', icon: 'AZ' },
  AMAZON_IN_API:     { color: '#EAB308', icon: 'AZ' },
  SHOPIFY:           { color: '#22C55E', icon: 'SH' },
  NYKAA_FASHION_NEW: { color: '#A855F7', icon: 'NK' },
  AJIO_OMNI:         { color: '#3B82F6', icon: 'AJ' },
  MEESHO_26:         { color: '#14B8A6', icon: 'ME' },
  FLIPKART:          { color: '#6366F1', icon: 'FK' },
  TATACLIQ:          { color: '#8B5CF6', icon: 'TC' },
  SNAPDEAL_NEW:      { color: '#EF4444', icon: 'SD' },
};
const fallbackMeta = { color: '#64748B', icon: '?' };
const getMeta = (ch: string) => CHANNEL_META[ch] || fallbackMeta;

const PIE_COLORS = ['#EC4899', '#F97316', '#22C55E', '#3B82F6', '#A855F7', '#14B8A6', '#F59E0B', '#6366F1', '#EF4444', '#8B5CF6', '#64748B'];

/* ── animated counter ────────────────────────────────────────────────── */
function AnimatedNumber({ value, prefix = '', duration = 800 }: { value: number; prefix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value, duration]);

  return <>{prefix}{display.toLocaleString('en-IN')}</>;
}

/* ── sort types ──────────────────────────────────────────────────────── */
type SortKey = 'channel_name' | 'quantity' | 'selling_price' | 'orders' | 'avg' | 'pct';
type SortDir = 'asc' | 'desc';

/* ══════════════════════════════════════════════════════════════════════ */
export default function DailySalesReportPage() {
  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [showReport, setShowReport] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('selling_price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey: ['daily-sales-report', reportDate],
    queryFn: async () => (await ucSales.getDailySalesReport(reportDate)).data,
    enabled: showReport,
    staleTime: 5 * 60_000,
  });

  const handleGenerate = useCallback(() => { setShowReport(true); refetch(); }, [refetch]);

  /* ── CSV download ──────────────────────────────────────────────────── */
  const handleCSV = useCallback(() => {
    if (!raw?.report) return;
    const totalRev = raw.totals?.total_revenue || 1;
    const hdr = ['Channel', 'Items', 'Revenue (₹)', 'Orders', 'Avg/Order (₹)', 'Revenue Share %'];
    const rows = raw.report.map((r: any) => [
      channelLabel(r.channel_name), r.quantity, r.selling_price.toFixed(2),
      r.orders, (r.selling_price / r.orders).toFixed(2),
      ((r.selling_price / totalRev) * 100).toFixed(1) + '%',
    ]);
    if (raw.totals) rows.push(['TOTAL', raw.totals.total_quantity, raw.totals.total_revenue.toFixed(2),
      raw.totals.total_orders, (raw.totals.total_revenue / raw.totals.total_orders).toFixed(2), '100%']);
    const csv = [hdr.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `daily-sales-report-${reportDate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [raw, reportDate]);

  /* ── derived data ──────────────────────────────────────────────────── */
  const totals = raw?.totals;
  const totalRev = totals?.total_revenue || 1;

  const enriched = useMemo(() => {
    if (!raw?.report) return [];
    return raw.report.map((r: any) => ({
      ...r,
      label: channelLabel(r.channel_name),
      avg: r.orders > 0 ? r.selling_price / r.orders : 0,
      pct: (r.selling_price / totalRev) * 100,
      meta: getMeta(r.channel_name),
    })).sort((a: any, b: any) => b.selling_price - a.selling_price);
  }, [raw, totalRev]);

  const topChannel = enriched[0]?.channel_name;
  const maxRev = enriched[0]?.selling_price || 1;

  const sorted = useMemo(() => {
    const filtered = search
      ? enriched.filter((r: any) => r.label.toLowerCase().includes(search.toLowerCase()))
      : enriched;
    return [...filtered].sort((a: any, b: any) => {
      const va = sortKey === 'channel_name' ? a.label : a[sortKey];
      const vb = sortKey === 'channel_name' ? b.label : b[sortKey];
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [enriched, search, sortKey, sortDir]);

  /* ── chart data ────────────────────────────────────────────────────── */
  const pieData = useMemo(
    () => enriched.map((r: any, i: number) => ({ name: r.label, value: r.selling_price, color: PIE_COLORS[i % PIE_COLORS.length] })),
    [enriched],
  );
  const barData = useMemo(
    () => enriched.map((r: any) => ({ name: r.label, orders: r.orders, fill: r.meta.color })),
    [enriched],
  );

  /* ── insights ──────────────────────────────────────────────────────── */
  const insights = useMemo(() => {
    if (!enriched.length) return [];
    const byRev = [...enriched].sort((a: any, b: any) => b.selling_price - a.selling_price);
    const byAov = [...enriched].sort((a: any, b: any) => b.avg - a.avg);
    const worst = [...enriched].sort((a: any, b: any) => a.selling_price - b.selling_price);
    return [
      { icon: TrendingUp, color: 'emerald', title: 'Top Revenue', desc: `${byRev[0].label} generated ${fmt(byRev[0].selling_price)} (${byRev[0].pct.toFixed(1)}% share)` },
      { icon: Sparkles, color: 'violet', title: 'Highest AOV', desc: `${byAov[0].label} at ${fmtFull(byAov[0].avg)} per order` },
      { icon: TrendingDown, color: 'amber', title: 'Needs Attention', desc: `${worst[0].label} contributed only ${fmt(worst[0].selling_price)} (${worst[0].pct.toFixed(1)}%)` },
    ];
  }, [enriched]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;

  const dateLabel = new Date(reportDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-8">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Daily Sales Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Channel-wise sales breakdown · Revenue-generating orders only</p>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px] max-w-[260px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Report date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50 shadow-sm">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {isLoading ? 'Generating…' : 'Generate Report'}
          </button>
          {showReport && raw?.success && (
            <button onClick={handleCSV}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 transition shadow-sm">
              <Download className="w-4 h-4" /> Download CSV
            </button>
          )}
        </div>
      </div>

      {/* ─── Loading ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-10 flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Analysing sales data for {dateLabel}…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Error ───────────────────────────────────────────────────── */}
      {showReport && raw && !raw.success && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">{raw.error || 'Failed to generate report'}</p>
        </div>
      )}

      {/* ─── Report content ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showReport && raw?.success && totals && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="space-y-8">

            {/* ── Hero summary ────────────────────────────────────────── */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 sm:p-8 shadow-lg text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 opacity-70" />
                  <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{dateLabel}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-4">
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Total Revenue</p>
                    <p className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight">
                      <AnimatedNumber value={Math.round(totals.total_revenue)} prefix="₹" />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Orders</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_orders} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Items Sold</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_quantity} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Channels</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_channels} />
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Charts (Donut + Bar) ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut / Pie */}
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Revenue Distribution</h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={2} dataKey="value" animationDuration={800}>
                        {pieData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <RTooltip
                        formatter={(value: any) => fmtFull(value)}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                  {pieData.map((e: any) => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{e.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar */}
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Orders by Channel</h2>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }} />
                      <Bar dataKey="orders" radius={[0, 6, 6, 0]} animationDuration={800}>
                        {barData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Insights ────────────────────────────────────────────── */}
            {insights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {insights.map((ins, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${ins.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : ins.color === 'violet' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                      <ins.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{ins.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Data Table ──────────────────────────────────────────── */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              {/* Search */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Channel Breakdown</h2>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 z-10">
                      {([
                        { key: 'channel_name' as SortKey, label: 'Channel', align: 'left' },
                        { key: 'quantity' as SortKey, label: 'Items', align: 'right' },
                        { key: 'selling_price' as SortKey, label: 'Revenue', align: 'right' },
                        { key: 'pct' as SortKey, label: 'Share %', align: 'right' },
                        { key: 'orders' as SortKey, label: 'Orders', align: 'right' },
                        { key: 'avg' as SortKey, label: 'Avg / Order', align: 'right' },
                      ] as const).map((col) => (
                        <th key={col.key}
                          onClick={() => toggleSort(col.key)}
                          className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition hover:text-slate-900 dark:hover:text-white ${col.align === 'left' ? 'text-left' : 'text-right'} text-slate-500 dark:text-slate-400`}>
                          <span className="inline-flex items-center gap-1">
                            {col.label} <SortIcon k={col.key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {sorted.map((row: any, idx: number) => {
                      const isTop = row.channel_name === topChannel;
                      const revBarW = Math.max(3, Math.round((row.selling_price / maxRev) * 100));
                      const rank = enriched.findIndex((e: any) => e.channel_name === row.channel_name);
                      const isTop3 = rank < 3;
                      return (
                        <motion.tr key={row.channel_name}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                          className="group transition hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          {/* Channel */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                                style={{ background: row.meta.color }}>
                                {row.meta.icon}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">{row.label}</span>
                                {isTop && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                                    <Flame className="w-3 h-3" /> Top
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Items */}
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">{row.quantity.toLocaleString()}</td>
                          {/* Revenue + mini bar */}
                          <td className="px-5 py-4 text-right">
                            <p className={`text-sm font-semibold tabular-nums ${isTop3 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {fmtFull(row.selling_price)}
                            </p>
                            <div className="mt-1.5 h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${revBarW}%`, background: row.meta.color }} />
                            </div>
                          </td>
                          {/* Share % */}
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">{row.pct.toFixed(1)}%</span>
                          </td>
                          {/* Orders */}
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">{row.orders}</td>
                          {/* AOV */}
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">{fmtFull(row.avg)}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-t-2 border-slate-200 dark:border-slate-600">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">Total</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{totals.total_quantity.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtFull(totals.total_revenue)}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">100%</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{totals.total_orders}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-600 dark:text-slate-400">{fmtFull(totals.total_revenue / totals.total_orders)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-400 dark:text-slate-500 px-1">
              <span>Source: {raw.data_source}</span>
              {raw.cached && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">Cached</span>}
              <span>Currency: {raw.currency}</span>
              {raw.note && totals.excluded_items > 0 && <span className="text-amber-500">{totals.excluded_items} items excluded (cancelled/returned)</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
