'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 12;

export default function DiscountAnalysisPage() {
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-discount-analysis', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  // Backend now returns discount_pct and total_discount computed from MRP.
  // total_revenue = sum of sellingPrice (post-discount effective price).
  // total_mrp = sum of MRP. total_discount = MRP - sellingPrice.
  const allSkus = (data?.skus || []).map((s: any) => ({
    ...s,
    // discount_pct already computed by backend (MRP-based)
    discount_pct: s.discount_pct ?? 0,
  }));
  const summary = data?.summary || {};

  // Discount distribution buckets
  const buckets = {
    '0%': allSkus.filter((s: any) => s.discount_pct === 0).length,
    '1-10%': allSkus.filter((s: any) => s.discount_pct > 0 && s.discount_pct <= 10).length,
    '10-20%': allSkus.filter((s: any) => s.discount_pct > 10 && s.discount_pct <= 20).length,
    '20-30%': allSkus.filter((s: any) => s.discount_pct > 20 && s.discount_pct <= 30).length,
    '30%+': allSkus.filter((s: any) => s.discount_pct > 30).length,
  };

  const overallDiscountPct = summary.avg_discount_pct?.toFixed(1) ?? '0.0';

  const filtered = useMemo(() => {
    if (!search) return allSkus;
    const term = search.toLowerCase();
    return allSkus.filter((s: any) =>
      s.sku?.toLowerCase().includes(term) ||
      s.name?.toLowerCase().includes(term)
    );
  }, [allSkus, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const columns: Column<any>[] = [
    { key: 'sku', header: 'SKU', width: '12%' },
    { key: 'name', header: 'Product Name', width: '18%' },
    {
      key: 'total_quantity', header: 'Qty', width: '6%',
      render: (value) => <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>,
    },
    {
      key: 'total_mrp', header: 'MRP Total', width: '11%',
      render: (value) => <span className="text-slate-500 dark:text-slate-400">₹{(value || 0).toFixed(2)}</span>,
    },
    {
      key: 'total_discount', header: 'Discount', width: '10%',
      render: (value) => <span className="text-orange-600 dark:text-orange-400 font-semibold">₹{(value || 0).toFixed(2)}</span>,
    },
    {
      key: 'discount_pct', header: 'Disc %', width: '8%',
      render: (value) => {
        const v = value || 0;
        const c = v > 30 ? 'text-rose-600 dark:text-rose-400' : v > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
        return <span className={`font-bold ${c}`}>{v.toFixed(1)}%</span>;
      },
    },
    {
      key: 'total_revenue', header: 'Net Revenue', width: '11%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    {
      key: 'avg_selling_price', header: 'Avg SP', width: '9%',
      render: (value) => <span className="text-slate-900 dark:text-slate-100">₹{(value || 0).toFixed(2)}</span>,
    },
    {
      key: 'avg_mrp', header: 'Avg MRP', width: '9%',
      render: (value) => <span className="text-slate-500 dark:text-slate-400">₹{(value || 0).toFixed(2)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Discount Analysis" description="Discount breakdown across products from Anthrilo" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Avg Discount %" value={`${overallDiscountPct}%`} icon="💸" color="blue" />
        <StatCard title="Total SKUs" value={summary.total_skus || 0} icon="📦" color="purple" />
        <StatCard title="Net Revenue" value={`₹${((summary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="🏷️" color="green" />
        <StatCard title="Total Discount" value={`₹${((summary.total_discount || 0) / 1000).toFixed(1)}K`} icon="💰" color="red" />
      </div>

      {Object.values(buckets).some((v) => v > 0) && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Discount Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(buckets).map(([bucket, count]) => (
              <div key={bucket} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{count}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{bucket}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {[
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last_7_days', label: '7 Days' },
              { key: 'last_30_days', label: '30 Days' },
            ].map((p) => (
              <button key={p.key} onClick={() => { setPeriod(p.key); setPage(0); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search SKU or product..." className="input flex-1"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-900 dark:text-white">Discount Details by SKU</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} SKUs</span>
        </div>
        {isLoading ? (
          <LoadingSpinner message="Calculating discount analytics from Anthrilo..." />
        ) : (
          <DataTable data={paginated} columns={columns} emptyMessage="No discount data available for this period." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
