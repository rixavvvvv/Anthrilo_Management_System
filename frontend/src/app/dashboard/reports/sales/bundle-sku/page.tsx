'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 12;

export default function SKUSalesPage() {
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-sales-by-sku', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  const summary = data?.summary || {};

  const filtered = useMemo(() => {
    const allSkus = data?.skus || [];
    if (!search) return allSkus;
    const term = search.toLowerCase();
    return allSkus.filter((s: any) =>
      s.sku?.toLowerCase().includes(term) ||
      s.name?.toLowerCase().includes(term)
    );
  }, [data, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const columns: Column<any>[] = [
    { key: 'sku', header: 'SKU', width: '15%' },
    { key: 'name', header: 'Product Name', width: '22%' },
    { key: 'total_quantity', header: 'Units Sold', width: '9%',
      render: (value) => <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>,
    },
    { key: 'order_count', header: 'Orders', width: '8%',
      render: (value) => <span className="text-slate-700 dark:text-slate-300">{value}</span>,
    },
    { key: 'total_revenue', header: 'Revenue', width: '12%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'total_discount', header: 'Discount', width: '10%',
      render: (value) => <span className="text-orange-600 dark:text-orange-400 font-semibold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'avg_selling_price', header: 'Avg Price', width: '10%',
      render: (value) => <span className="text-slate-900 dark:text-slate-100">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'channels', header: 'Channels', width: '14%',
      render: (value) => {
        if (!value || typeof value !== 'object') return <span className="text-slate-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {Object.entries(value).map(([ch, info]: [string, any]) => (
              <span key={ch} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                {ch}: {info?.quantity || 0}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="SKU Sales Report" description="Sales performance by SKU from Anthrilo" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total SKUs Sold" value={summary.total_skus || 0} icon="📦" color="blue" />
        <StatCard title="Total Units" value={summary.total_quantity || 0} icon="🛒" color="purple" />
        <StatCard title="Total Revenue" value={`₹${((summary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="💰" color="green" />
        <StatCard title="Total Discount" value={`₹${((summary.total_discount || 0) / 1000).toFixed(1)}K`} icon="💸" color="red" />
      </div>

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
          <input type="text" placeholder="Search SKU or product name..." className="input flex-1"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load SKU data'}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-900 dark:text-white">SKU Sales Breakdown</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} SKUs</span>
        </div>
        {isLoading ? (
          <LoadingSpinner message="Fetching SKU sales from Anthrilo..." />
        ) : (
          <DataTable data={paginated} columns={columns} emptyMessage="No SKU sales data for this period." />
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
