'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 20;

export default function BundleSkuPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['uc-bundle-skus'],
    queryFn: async () => {
      const response = await ucSales.getBundleSkus();
      return response.data;
    },
    staleTime: 300_000,
  });

  const summary = data?.summary || {};
  const allBundles: any[] = data?.bundles || [];
  const categories: Record<string, number> = summary.categories || {};

  const filtered = useMemo(() => {
    let items = allBundles;
    if (showEnabledOnly) items = items.filter((b: any) => b.enabled);
    if (category !== 'all') items = items.filter((b: any) => b.category === category);
    if (search) {
      const term = search.toLowerCase();
      items = items.filter(
        (b: any) =>
          b.skuCode?.toLowerCase().includes(term) ||
          b.itemName?.toLowerCase().includes(term) ||
          b.category?.toLowerCase().includes(term) ||
          b.brand?.toLowerCase().includes(term) ||
          b.components?.some((c: any) => c.sku?.toLowerCase().includes(term))
      );
    }
    return items;
  }, [allBundles, search, showEnabledOnly, category]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const columns: Column<any>[] = [
    {
      key: 'skuCode',
      header: 'SKU Code',
      width: '11%',
      render: (value) => (
        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
          {value}
        </span>
      ),
    },
    {
      key: 'itemName',
      header: 'Bundle Name',
      width: '20%',
      render: (value) => (
        <span className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
          {value}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '11%',
      render: (value) => (
        <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-xs font-medium">
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'mrp',
      header: 'MRP',
      width: '8%',
      render: (value) => (
        <span className="text-slate-900 dark:text-slate-100 font-medium">
          ₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'basePrice',
      header: 'Base Price',
      width: '8%',
      render: (value) => (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          ₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'costPrice',
      header: 'Cost Price',
      width: '8%',
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400">
          ₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      width: '7%',
      render: (value) => (
        <span className="text-xs text-slate-700 dark:text-slate-300">{value || '-'}</span>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      width: '14%',
      render: (_value, row) => {
        const comps: any[] = row?.components || [];
        if (comps.length === 0) return <span className="text-slate-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {comps.slice(0, 3).map((c: any, i: number) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium"
                title={`${c.sku} × ${c.quantity}`}
              >
                {c.sku}
              </span>
            ))}
            {comps.length > 3 && (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded text-[10px]">
                +{comps.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'componentCount',
      header: '#',
      width: '4%',
      render: (value) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{value ?? '-'}</span>
      ),
    },
    {
      key: 'enabled',
      header: 'Status',
      width: '6%',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${value
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
            }`}
        >
          {value ? 'Active' : 'Off'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bundle SKU Catalog"
        description="All bundle/combo SKUs from Unicommerce Item Master — deduplicated with component details"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Total Bundles"
          value={(summary.total_bundles || 0).toLocaleString('en-IN')}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Active"
          value={(summary.enabled || 0).toLocaleString('en-IN')}
          icon="✅"
          color="green"
        />
        <StatCard
          title="Disabled"
          value={(summary.disabled || 0).toLocaleString('en-IN')}
          icon="🚫"
          color="red"
        />
        <StatCard
          title="Avg MRP"
          value={`₹${(summary.avg_mrp || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon="💰"
          color="purple"
        />
        <StatCard
          title="Categories"
          value={(summary.total_categories || 0).toLocaleString('en-IN')}
          icon="🏷️"
          color="yellow"
        />
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search SKU, name, category, brand, component..."
            className="input flex-1"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(0); }}
            className="input w-56"
          >
            <option value="all">All Categories ({Object.keys(categories).length})</option>
            {Object.entries(categories).map(([cat, count]) => (
              <option key={cat} value={cat}>
                {cat} ({count})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEnabledOnly}
              onChange={(e) => { setShowEnabledOnly(e.target.checked); setPage(0); }}
              className="accent-emerald-500 w-4 h-4"
            />
            Active only
          </label>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isFetching
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
          >
            {isFetching ? 'Refreshing…' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">
            Error: {(error as any)?.message || 'Failed to load bundle data'}
          </p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Bundle SKUs
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length.toLocaleString('en-IN')} bundle{filtered.length !== 1 ? 's' : ''}
            {category !== 'all' && ` in ${category}`}
          </span>
        </div>
        {isLoading || isFetching ? (
          <LoadingSpinner message="Fetching bundle catalog from Unicommerce..." />
        ) : (
          <DataTable
            data={paginated}
            columns={columns}
            emptyMessage="No bundle SKUs match the current filters."
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}