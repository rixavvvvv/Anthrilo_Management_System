'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucInventory } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 50;

export default function GarmentInventoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [stockFilter]);

  // ── Summary (totals + category breakdown) ─────────────────────
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

  // ── Paginated inventory (search OR browse) ────────────────────
  const isSearching = debouncedSearch.length > 0;

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: isSearching
      ? ['uc-inventory-search', debouncedSearch, page]
      : ['uc-inventory-snapshot', page, PAGE_SIZE, stockFilter],
    queryFn: async () => {
      if (isSearching) {
        const res = await ucInventory.search({ q: debouncedSearch, page, page_size: PAGE_SIZE });
        return res.data;
      }
      const res = await ucInventory.getSnapshot({
        page,
        page_size: PAGE_SIZE,
        in_stock_only: stockFilter === 'in-stock',
        enabled_only: stockFilter !== 'out-of-stock',
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const items = data?.inventorySnapshots || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 0;

  // ── Summary stats ─────────────────────────────────────────────
  const summary = summaryData?.summary || {};
  const summaryOk = summaryData?.successful;

  const columns: Column<any>[] = [
    {
      key: 'itemTypeSKU',
      header: 'SKU',
      width: '20%',
      render: (value) => <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>,
    },
    { key: 'categoryName', header: 'Category', width: '12%' },
    { key: 'color', header: 'Color', width: '8%' },
    {
      key: 'size', header: 'Size', width: '7%',
      render: (value) => <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium">{value}</span>,
    },
    {
      key: 'inventory',
      header: 'Stock',
      width: '8%',
      render: (value) => {
        const c = value === 0 ? 'text-rose-600 dark:text-rose-400' : value <= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
        return <span className={`font-bold ${c}`}>{value}</span>;
      },
    },
    {
      key: 'inventoryBlocked',
      header: 'Blocked',
      width: '8%',
      render: (value) => value > 0 ? <span className="text-red-600 dark:text-red-400 font-semibold">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'putawayPending',
      header: 'Putaway',
      width: '8%',
      render: (value) => value > 0 ? <span className="text-orange-600 dark:text-orange-400 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'openSale',
      header: 'Open Sale',
      width: '8%',
      render: (value) => value > 0 ? <span className="text-purple-600 dark:text-purple-400 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'badInventory',
      header: 'Bad',
      width: '6%',
      render: (value) => value > 0 ? <span className="text-rose-500 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'costPrice',
      header: 'Cost',
      width: '8%',
      render: (value) => <span className="text-slate-900 dark:text-slate-100 font-medium">₹{(value || 0).toFixed(0)}</span>,
    },
    {
      key: 'enabled',
      header: 'Status',
      width: '7%',
      render: (value) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
          {value ? 'Active' : 'Off'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Garment Inventory"
        description={`Export Job API — ${summaryOk ? summary.total_skus?.toLocaleString() : '…'} total SKUs, ${summaryOk ? summary.total_inventory?.toLocaleString() : '…'} units in stock`}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total SKUs" value={summaryOk ? summary.total_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="📦" color="blue" />
        <StatCard title="Enabled SKUs" value={summaryOk ? summary.enabled_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="✅" color="emerald" />
        <StatCard title="In Stock" value={summaryOk ? summary.in_stock_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="📊" color="green" />
        <StatCard title="Out of Stock" value={summaryOk ? summary.out_of_stock_skus?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="⚠️" color="red" />
        <StatCard title="Total Inventory" value={summaryOk ? summary.total_inventory?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="🏭" color="purple" />
        <StatCard title="Blocked" value={summaryOk ? summary.total_blocked?.toLocaleString() : (summaryLoading ? '…' : '-')} icon="🔒" color="yellow" />
      </div>

      {/* Filters */}
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
          <input
            type="text"
            placeholder="Search SKU, category, brand, color, size…"
            className="input flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {totalCount.toLocaleString()} items · Page {page} / {totalPages || 1}
            {isFetching && !isLoading && ' ⟳'}
          </span>
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load inventory'}</p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <h2 className="mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          Inventory Overview
          {data?.method === 'export_job' && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              Export API
            </span>
          )}
        </h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching inventory via Export Job API (26K+ SKUs)…" />
        ) : (
          <DataTable data={items} columns={columns} emptyMessage="No inventory records found." />
        )}
      </div>

      {/* Pagination */}
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

      {/* Category breakdown */}
      {summaryData?.categories && summaryData.categories.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-4 text-slate-900 dark:text-white">Category Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {summaryData.categories.slice(0, 16).map((cat: any) => (
              <div key={cat.category} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{cat.category}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{cat.inventory.toLocaleString()}</p>
                <p className="text-xs text-slate-400">{cat.skus} SKUs</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
