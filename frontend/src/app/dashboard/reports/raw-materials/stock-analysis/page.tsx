'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucInventory } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 50;

/**
 * Stock status thresholds (based on Good Stock / inventory):
 *   Out of Stock  =  0
 *   Low Stock     =  1–7   (< 8)
 *   Normal        =  8–17
 *   High Stock    =  > 17
 */
function getStockStatus(stock: number): string {
  if (stock === 0) return 'Out of Stock';
  if (stock < 8) return 'Low';
  if (stock <= 17) return 'Normal';
  return 'High';
}

export default function InventoryAnalysisPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  useEffect(() => { setPage(1); }, [stockFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Summary (totals across ALL 26K+ SKUs) ─────────────────────
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['uc-inventory-summary-export'],
    queryFn: async () => {
      const res = await ucInventory.getSummary();
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ── Paginated data via Export Job API ──────────────────────────
  const isSearching = debouncedSearch.length > 0;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: isSearching
      ? ['uc-stock-analysis-search', debouncedSearch, page]
      : ['uc-stock-analysis', page, PAGE_SIZE, stockFilter],
    queryFn: async () => {
      if (isSearching) {
        const res = await ucInventory.search({ q: debouncedSearch, page, page_size: PAGE_SIZE });
        return res.data;
      }
      const res = await ucInventory.getSnapshot({
        page,
        page_size: PAGE_SIZE,
        in_stock_only: stockFilter === 'in-stock',
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const items = data?.inventorySnapshots || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 0;

  // Enrich with stock status
  const enrichedItems = useMemo(() =>
    items.map((item: any) => ({
      ...item,
      stockValue: (item.inventory || 0) * (item.costPrice || 0),
      status: getStockStatus(item.inventory || 0),
    })),
  [items]);

  // Count statuses on current page for display
  const statusCounts = useMemo(() => ({
    out: enrichedItems.filter((i: any) => i.status === 'Out of Stock').length,
    low: enrichedItems.filter((i: any) => i.status === 'Low').length,
    normal: enrichedItems.filter((i: any) => i.status === 'Normal').length,
    high: enrichedItems.filter((i: any) => i.status === 'High').length,
  }), [enrichedItems]);

  const summary = summaryData?.summary || {};
  const summaryOk = summaryData?.successful;

  const statusColors: Record<string, string> = {
    'Out of Stock': 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
    'Low': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    'Normal': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    'High': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  };

  const columns: Column<any>[] = [
    {
      key: 'itemTypeSKU', header: 'SKU', width: '16%',
      render: (value) => <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>,
    },
    { key: 'categoryName', header: 'Category', width: '11%' },
    { key: 'color', header: 'Color', width: '8%' },
    { key: 'size', header: 'Size', width: '6%' },
    {
      key: 'inventory', header: 'Good Stock', width: '9%',
      render: (value) => {
        const c = value === 0 ? 'text-rose-600' : value <= 7 ? 'text-amber-600' : 'text-emerald-600';
        return <span className={`font-bold ${c}`}>{value}</span>;
      },
    },
    {
      key: 'openSale', header: 'Open Sale', width: '8%',
      render: (value) => value > 0 ? <span className="text-blue-600 dark:text-blue-400">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'badInventory', header: 'Bad', width: '6%',
      render: (value) => value > 0 ? <span className="text-rose-500 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'putawayPending', header: 'Putaway', width: '8%',
      render: (value) => value > 0 ? <span className="text-orange-600 dark:text-orange-400 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'stockValue', header: 'Value (Cost)', width: '10%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{(value || 0).toLocaleString()}</span>,
    },
    {
      key: 'status', header: 'Status', width: '10%',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[value] || ''}`}>{value}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Stock Analysis"
        description={`Export Job API — ${summaryOk ? summary.total_skus?.toLocaleString() : '…'} total SKUs across all facilities`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total SKUs" value={summaryOk ? summary.total_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="📦" color="blue" />
        <StatCard title="Total Inventory" value={summaryOk ? summary.total_inventory?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="📊" color="emerald" />
        <StatCard title="Out of Stock" value={summaryOk ? summary.out_of_stock_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="⚠️" color="red" />
        <StatCard title="Total Blocked" value={summaryOk ? summary.total_blocked?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="🔒" color="yellow" />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'in-stock', label: 'In Stock' },
              { key: 'out-of-stock', label: 'Out of Stock' },
            ] as const).map((f) => (
              <button key={f.key} onClick={() => setStockFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${stockFilter === f.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search SKU, category, brand, color, size…" className="input flex-1"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {totalCount.toLocaleString()} items · Page {page} / {totalPages || 1}
            {isFetching && !isLoading && ' ⟳'}
          </span>
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load stock data'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          Stock Analysis
          {data?.method === 'export_job' && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              Export API
            </span>
          )}
          <span className="text-sm font-normal text-slate-500 ml-auto">
            {statusCounts.out > 0 && <span className="text-rose-500 mr-3">{statusCounts.out} OOS</span>}
            {statusCounts.low > 0 && <span className="text-amber-500 mr-3">{statusCounts.low} Low</span>}
          </span>
        </h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching stock data via Export Job API (26K+ SKUs)…" />
        ) : (
          <DataTable data={enrichedItems} columns={columns} emptyMessage="No stock data found." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <div className="flex items-center gap-2">
            {page > 2 && <button onClick={() => setPage(1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">1</button>}
            {page > 3 && <span className="text-slate-400">…</span>}
            {page > 1 && <button onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{page - 1}</button>}
            <span className="px-3 py-1 rounded-lg text-sm bg-primary-600 text-white font-semibold">{page}</span>
            {page < totalPages && <button onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{page + 1}</button>}
            {page < totalPages - 2 && <span className="text-slate-400">…</span>}
            {page < totalPages - 1 && <button onClick={() => setPage(totalPages)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{totalPages}</button>}
          </div>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
