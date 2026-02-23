'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';

const PAGE_SIZE = 25;

/* ── helper: flatten inventory snapshot from catalog item ─────── */
function flattenItem(el: any) {
  const snap = el.inventorySnapshots?.[0] || {};
  return {
    skuCode: el.skuCode || '',
    name: el.name || '',
    categoryName: el.categoryName || '',
    color: el.color || '',
    size: el.size || '',
    brand: el.brand || '',
    price: el.price || 0,
    enabled: el.enabled ?? false,
    hsnCode: el.hsnCode || '',
    weight: el.weight || 0,
    inventory: snap.inventory ?? 0,
    inventoryBlocked: snap.inventoryBlocked ?? 0,
    putawayPending: snap.putawayPending ?? 0,
    openSale: snap.openSale ?? 0,
    openPurchase: snap.openPurchase ?? 0,
    badInventory: snap.badInventory ?? 0,
    pendingStockTransfer: snap.pendingStockTransfer ?? 0,
    vendorInventory: snap.vendorInventory ?? 0,
  };
}

export default function GarmentInventoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [stockFilter]);

  /* ── 1. Stats query — 1 000 SKUs with inventory for aggregates ── */
  const { data: statsRaw, isLoading: statsLoading } = useQuery({
    queryKey: ['uc-inv-stats'],
    queryFn: async () => {
      const res = await ucCatalog.searchItems({
        displayStart: 0,
        displayLength: 1000,
        getInventorySnapshot: true,
      });
      return res.data;
    },
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const stats = useMemo(() => {
    const els = (statsRaw?.elements || []).map(flattenItem);
    if (!els.length) return null;
    const totalSkus = statsRaw?.totalRecords ?? els.length;
    const sampledSkus = els.length;
    let enabled = 0, inStock = 0, outOfStock = 0, totalUnits = 0, blocked = 0,
        putaway = 0, openSale = 0, bad = 0;
    const catMap: Record<string, { units: number; skus: number; inStock: number }> = {};
    for (const it of els) {
      if (it.enabled) enabled++;
      if (it.inventory > 0) inStock++; else outOfStock++;
      totalUnits += it.inventory;
      blocked += it.inventoryBlocked;
      putaway += it.putawayPending;
      openSale += it.openSale;
      bad += it.badInventory;
      const cat = it.categoryName || 'Uncategorised';
      if (!catMap[cat]) catMap[cat] = { units: 0, skus: 0, inStock: 0 };
      catMap[cat].skus++;
      catMap[cat].units += it.inventory;
      if (it.inventory > 0) catMap[cat].inStock++;
    }
    const categories = Object.entries(catMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.units - a.units);
    return { totalSkus, sampledSkus, enabled, inStock, outOfStock, totalUnits, blocked, putaway, openSale, bad, categories };
  }, [statsRaw]);

  /* ── 2. Paginated query — table page with inventory snapshot ─── */
  const { data: pageData, isLoading, error, isFetching } = useQuery({
    queryKey: ['uc-inv-page', debouncedSearch, page, stockFilter],
    queryFn: async () => {
      const res = await ucCatalog.searchItems({
        displayStart: (page - 1) * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: true,
        keyword: debouncedSearch || undefined,
      });
      return res.data;
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev: any) => prev,
  });

  /* flatten & filter */
  const allItems = useMemo(() => (pageData?.elements || []).map(flattenItem), [pageData]);
  const items = useMemo(() => {
    if (stockFilter === 'in-stock') return allItems.filter((i) => i.inventory > 0);
    if (stockFilter === 'out-of-stock') return allItems.filter((i) => i.inventory === 0);
    return allItems;
  }, [allItems, stockFilter]);

  const totalRecords = pageData?.totalRecords || 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  /* ── Pagination numbers ─────── */
  const pageNums = useMemo(() => {
    const nums: (number | '...')[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) nums.push(i); return nums; }
    nums.push(1);
    if (page > 3) nums.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i);
    if (page < totalPages - 2) nums.push('...');
    nums.push(totalPages);
    return nums;
  }, [page, totalPages]);

  /* ── do any items have operational data? ─────── */
  const hasOpsData = useMemo(() => items.some((i) => i.inventoryBlocked > 0 || i.putawayPending > 0 || i.openSale > 0 || i.badInventory > 0), [items]);

  /* ── stock colour helper ─────── */
  const stockColor = (v: number) =>
    v === 0 ? 'text-rose-600 dark:text-rose-400' :
    v <= 5  ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400';

  const numCell = (v: number, accent: string) =>
    v > 0 ? <span className={`${accent} font-semibold tabular-nums`}>{v}</span> : <span className="text-slate-400 tabular-nums">0</span>;

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {stats ? `${stats.totalSkus.toLocaleString()} total SKUs · Aggregates from ${stats.sampledSkus.toLocaleString()} sampled items` : 'Loading inventory data…'}
        </p>
      </div>

      {/* ── KPI cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { label: 'Total SKUs',   value: stats?.totalSkus,   icon: '📦', gradient: 'from-blue-500 to-blue-600' },
          { label: 'Enabled',      value: stats?.enabled,     icon: '✅', gradient: 'from-emerald-500 to-emerald-600' },
          { label: 'In Stock',     value: stats?.inStock,     icon: '📊', gradient: 'from-green-500 to-green-600' },
          { label: 'Out of Stock', value: stats?.outOfStock,  icon: '⚠️', gradient: 'from-rose-500 to-rose-600' },
          { label: 'Total Units',  value: stats?.totalUnits,  icon: '🏭', gradient: 'from-violet-500 to-violet-600' },
          ...((stats?.blocked ?? 0) > 0 ? [{ label: 'Blocked' as const, value: stats?.blocked, icon: '🔒', gradient: 'from-amber-500 to-amber-600' }] : []),
        ] as const).map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <div className={`absolute -top-4 -right-4 h-16 w-16 rounded-full bg-gradient-to-br ${c.gradient} opacity-10`} />
            <span className="text-xl">{c.icon}</span>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {statsLoading ? '…' : (c.value?.toLocaleString() ?? '-')}
            </p>
          </div>
        ))}
      </div>

      {/* ── Secondary metrics bar — only shown when any value > 0 */}
      {stats && (stats.putaway > 0 || stats.openSale > 0 || stats.bad > 0) && (
        <div className="flex flex-wrap gap-6 px-1">
          {[
            { label: 'Putaway Pending', value: stats.putaway, color: 'text-orange-600 dark:text-orange-400' },
            { label: 'Open Sale', value: stats.openSale, color: 'text-purple-600 dark:text-purple-400' },
            { label: 'Bad Inventory', value: stats.bad, color: 'text-rose-600 dark:text-rose-400' },
          ].filter((m) => m.value > 0).map((m) => (
            <div key={m.label} className="flex items-center gap-2 text-sm">
              <span className="text-slate-500 dark:text-slate-400">{m.label}:</span>
              <span className={`font-bold tabular-nums ${m.color}`}>{m.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters bar ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Stock filter pills */}
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1">
            {([
              { key: 'all' as const, label: 'All', count: totalRecords },
              { key: 'in-stock' as const, label: 'In Stock' },
              { key: 'out-of-stock' as const, label: 'Out of Stock' },
            ]).map((f) => (
              <button key={f.key} onClick={() => setStockFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  stockFilter === f.key
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Search SKU, name, category, color, size…"
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status */}
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap self-center tabular-nums">
            {totalRecords.toLocaleString()} items · Page {page}/{totalPages}
            {isFetching && !isLoading && <span className="ml-1 animate-pulse">⟳</span>}
          </span>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {(error as any)?.response?.data?.detail || (error as any)?.message || 'Failed to load inventory'}
          </p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading inventory…</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-slate-500 dark:text-slate-400">No inventory records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  {['SKU', 'Product', 'Category', 'Color', 'Size', 'Stock', ...(hasOpsData ? ['Blocked', 'Putaway', 'Open Sale', 'Bad'] : []), 'MRP', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {items.map((it, idx) => (
                  <tr key={it.skuCode + idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    {/* SKU */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono text-xs font-semibold">
                        {it.skuCode}
                      </span>
                    </td>
                    {/* Product name */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-slate-900 dark:text-white text-sm font-medium truncate" title={it.name}>{it.name}</p>
                      <p className="text-xs text-slate-400 truncate">{it.brand}</p>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{it.categoryName}</span>
                    </td>
                    {/* Color */}
                    <td className="px-4 py-3">
                      {it.color ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          <span className="h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: it.color.toLowerCase() === 'multi' ? '#a855f7' : it.color.toLowerCase() }} />
                          {it.color}
                        </span>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                    {/* Size */}
                    <td className="px-4 py-3">
                      {it.size ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">{it.size}</span>
                      ) : <span className="text-slate-400 text-xs">-</span>}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3">
                      <span className={`font-bold tabular-nums ${stockColor(it.inventory)}`}>{it.inventory}</span>
                    </td>
                    {hasOpsData && <>
                      <td className="px-4 py-3">{numCell(it.inventoryBlocked, 'text-red-600 dark:text-red-400')}</td>
                      <td className="px-4 py-3">{numCell(it.putawayPending, 'text-orange-600 dark:text-orange-400')}</td>
                      <td className="px-4 py-3">{numCell(it.openSale, 'text-purple-600 dark:text-purple-400')}</td>
                      <td className="px-4 py-3">{numCell(it.badInventory, 'text-rose-500')}</td>
                    </>}
                    {/* MRP */}
                    <td className="px-4 py-3">
                      <span className="text-slate-900 dark:text-white font-medium tabular-nums">₹{it.price.toLocaleString()}</span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        it.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${it.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {it.enabled ? 'Active' : 'Off'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm">
            ← Previous
          </button>
          <div className="flex items-center gap-1">
            {pageNums.map((n, i) =>
              n === '...' ? (
                <span key={`e${i}`} className="px-2 text-slate-400 text-sm">…</span>
              ) : (
                <button key={n} onClick={() => setPage(n as number)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                    n === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  {n}
                </button>
              )
            )}
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors shadow-sm">
            Next →
          </button>
        </div>
      )}

      {/* ── Category breakdown ───────────────────────────────── */}
      {stats && stats.categories.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Stock by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {stats.categories.slice(0, 16).map((cat) => {
              const pct = stats.totalUnits > 0 ? Math.round((cat.units / stats.totalUnits) * 100) : 0;
              const stockRate = cat.skus > 0 ? Math.round((cat.inStock / cat.skus) * 100) : 0;
              return (
                <button key={cat.name}
                  onClick={() => { setSearch(cat.name); }}
                  className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{cat.name}</p>
                    <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-1">{cat.units.toLocaleString()}<span className="text-xs font-normal text-slate-400 ml-1">units</span></p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-500">{cat.skus} SKUs · {stockRate}% stocked</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
