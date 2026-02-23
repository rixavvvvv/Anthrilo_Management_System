'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';

const fmt = (v: number) =>
  v >= 10_000_000 ? `₹${(v / 10_000_000).toFixed(2)}Cr`
  : v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L`
  : v >= 1_000 ? `₹${(v / 1_000).toFixed(1)}K`
  : `₹${v.toLocaleString('en-IN')}`;

const channelLabel = (c: string) =>
  c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()).replace(/ New$/, '').replace(/ Api$/, '').replace(/ 26$/, '');

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CodVsPrepaidPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, error } = useQuery({
    queryKey: ['cod-vs-prepaid', month, year],
    queryFn: async () => (await ucSales.getCodVsPrepaid({ month, year })).data,
    staleTime: 5 * 60_000,
  });

  const cod = data?.cod || {} as any;
  const prepaid = data?.prepaid || {} as any;
  const totalOrders = data?.total_orders || 0;
  const totalRevenue = data?.total_revenue || 0;
  const codPct = cod.percentage || 0;
  const prepaidPct = prepaid.percentage || 0;
  const codRevPct = totalRevenue > 0 ? Math.round((cod.revenue || 0) / totalRevenue * 100) : 0;
  const prepaidRevPct = totalRevenue > 0 ? 100 - codRevPct : 0;

  /* channels sorted by total orders */
  const channels = useMemo(() => {
    if (!data?.channels?.length) return [];
    return [...data.channels].sort((a: any, b: any) => (b.cod_orders + b.prepaid_orders) - (a.cod_orders + a.prepaid_orders));
  }, [data]);
  const maxChOrders = channels.length > 0 ? Math.max(...channels.map((c: any) => c.cod_orders + c.prepaid_orders)) : 1;

  return (
    <div className="space-y-6">
      {/* Header + month/year control */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">COD vs Prepaid</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isLoading ? 'Loading…' : `${monthNames[month - 1]} ${year} · ${totalOrders.toLocaleString()} orders · ${fmt(totalRevenue)}`}
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">{(error as any)?.message || 'Failed to load data'}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Analysing {monthNames[month - 1]} {year} payment data — this may take a few seconds on first load…</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                <div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
          </div>
        </div>
      )}

      {!isLoading && data?.success && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {([
              { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: '📦', gradient: 'from-blue-500 to-blue-600' },
              { label: 'Total Revenue', value: fmt(totalRevenue), icon: '💰', gradient: 'from-emerald-500 to-emerald-600' },
              { label: 'COD Orders', value: `${(cod.orders || 0).toLocaleString()}`, sub: `${codPct}%`, icon: '💵', gradient: 'from-amber-500 to-amber-600' },
              { label: 'Prepaid Orders', value: `${(prepaid.orders || 0).toLocaleString()}`, sub: `${prepaidPct}%`, icon: '💳', gradient: 'from-violet-500 to-violet-600' },
            ] as const).map((c) => (
              <div key={c.label} className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full bg-gradient-to-br ${c.gradient} opacity-10`} />
                <span className="text-xl">{c.icon}</span>
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{c.value}</p>
                {'sub' in c && c.sub && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Distribution bars */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{monthNames[month - 1]} {year} — Distribution</h2>

            {/* Orders bar */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Orders</p>
              <div className="flex h-9 rounded-xl overflow-hidden">
                <div className="bg-amber-500 flex items-center justify-center text-white text-xs font-bold transition-all relative" style={{ width: `${codPct}%` }}>
                  {codPct > 12 && <span>COD {codPct}%</span>}
                </div>
                <div className="bg-emerald-500 flex items-center justify-center text-white text-xs font-bold transition-all relative" style={{ width: `${prepaidPct}%` }}>
                  {prepaidPct > 12 && <span>Prepaid {prepaidPct}%</span>}
                </div>
              </div>
            </div>

            {/* Revenue bar */}
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Revenue</p>
              <div className="flex h-9 rounded-xl overflow-hidden">
                <div className="bg-amber-400 flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${codRevPct}%` }}>
                  {codRevPct > 12 && <span>{fmt(cod.revenue || 0)}</span>}
                </div>
                <div className="bg-emerald-400 flex items-center justify-center text-white text-xs font-bold transition-all" style={{ width: `${prepaidRevPct}%` }}>
                  {prepaidRevPct > 12 && <span>{fmt(prepaid.revenue || 0)}</span>}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-6 pt-1">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-xs text-slate-600 dark:text-slate-400">COD</span></div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-xs text-slate-600 dark:text-slate-400">Prepaid</span></div>
            </div>
          </div>

          {/* COD vs Prepaid detail side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COD */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-2xl">💵</span>
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200">Cash on Delivery</h3>
              </div>
              <div className="space-y-3">
                {([
                  ['Orders', (cod.orders || 0).toLocaleString()],
                  ['Revenue', fmt(cod.revenue || 0)],
                  ['Avg Order Value', `₹${(cod.avg_order_value || 0).toFixed(0)}`],
                  ['Share', `${codPct}%`],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-sm text-amber-700 dark:text-amber-300">{l}</span>
                    <span className="text-sm font-bold text-amber-900 dark:text-amber-100 tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prepaid */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-2xl">💳</span>
                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">Prepaid</h3>
              </div>
              <div className="space-y-3">
                {([
                  ['Orders', (prepaid.orders || 0).toLocaleString()],
                  ['Revenue', fmt(prepaid.revenue || 0)],
                  ['Avg Order Value', `₹${(prepaid.avg_order_value || 0).toFixed(0)}`],
                  ['Share', `${prepaidPct}%`],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">{l}</span>
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100 tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel Breakdown — visual bars + table */}
          {channels.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Channel Breakdown</h2>
              <div className="space-y-3">
                {channels.map((ch: any) => {
                  const total = ch.cod_orders + ch.prepaid_orders;
                  const codW = total > 0 ? Math.round(ch.cod_orders / total * 100) : 0;
                  const barW = maxChOrders > 0 ? Math.max(4, Math.round(total / maxChOrders * 100)) : 0;
                  return (
                    <div key={ch.channel}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{channelLabel(ch.channel)}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{total.toLocaleString()} orders</span>
                      </div>
                      {/* stacked bar */}
                      <div className="h-5 rounded-lg overflow-hidden flex bg-slate-100 dark:bg-slate-700/50" style={{ width: `${barW}%` }}>
                        <div className="bg-amber-500 transition-all" style={{ width: `${codW}%` }} />
                        <div className="bg-emerald-500 transition-all flex-1" />
                      </div>
                      <div className="flex gap-4 mt-0.5 text-[10px] text-slate-400 tabular-nums">
                        <span>COD: {ch.cod_orders} · {fmt(ch.cod_revenue || 0)}</span>
                        <span>Prepaid: {ch.prepaid_orders} · {fmt(ch.prepaid_revenue || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
