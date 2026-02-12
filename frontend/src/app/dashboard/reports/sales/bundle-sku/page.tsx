'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

export default function SKUSalesPage() {
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-sales-by-sku', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  const allSkus = data?.skus || [];
  const summary = data?.summary || {};

  const filtered = search
    ? allSkus.filter((s: any) =>
        s.sku?.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allSkus;

  const columns: Column<any>[] = [
    { key: 'sku', header: 'SKU', width: '15%' },
    { key: 'name', header: 'Product Name', width: '22%' },
    { key: 'total_quantity', header: 'Units Sold', width: '9%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    { key: 'order_count', header: 'Orders', width: '8%',
      render: (value) => <span className="text-gray-700 dark:text-gray-300">{value}</span>,
    },
    { key: 'total_revenue', header: 'Revenue', width: '12%',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'total_discount', header: 'Discount', width: '10%',
      render: (value) => <span className="text-orange-600 dark:text-orange-400 font-semibold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'avg_selling_price', header: 'Avg Price', width: '10%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'channels', header: 'Channels', width: '14%',
      render: (value) => {
        if (!value || typeof value !== 'object') return <span className="text-gray-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {Object.entries(value).map(([ch, info]: [string, any]) => (
              <span key={ch} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
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
      <PageHeader title="SKU Sales Report" description="Sales performance by SKU from Unicommerce" />

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
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search SKU or product name..." className="input flex-1"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message || 'Failed to load SKU data'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">SKU Sales Breakdown</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching SKU sales from Unicommerce..." />
        ) : (
          <DataTable data={filtered} columns={columns} emptyMessage="No SKU sales data for this period." />
        )}
      </div>
    </div>
  );
}
