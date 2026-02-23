'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

export default function TopSellersPage() {
  const [period, setPeriod] = useState('last_7_days');

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-top-sellers', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  // Top 50 by quantity, with rank field
  const allSkus = data?.skus || [];
  const topByQty = allSkus.slice(0, 50).map((s: any, i: number) => ({ ...s, rank: i + 1 }));
  const summary = data?.summary || {};

  const avgRevenuePerSku = summary.total_skus > 0 ? (summary.total_revenue / summary.total_skus) : 0;
  const avgQtyPerSku = summary.total_skus > 0 ? (summary.total_quantity / summary.total_skus) : 0;

  const columns: Column<any>[] = [
    {
      key: 'rank', header: '#', width: '5%',
      render: (value: any) => <span className="font-bold text-gray-500">{value}</span>,
    },
    { key: 'sku', header: 'SKU', width: '14%' },
    { key: 'name', header: 'Product Name', width: '22%' },
    {
      key: 'total_quantity', header: 'Units Sold', width: '10%',
      render: (value) => <span className="font-bold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    {
      key: 'total_revenue', header: 'Revenue', width: '13%',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'order_count', header: 'Orders', width: '8%' },
    {
      key: 'avg_selling_price', header: 'Avg Price', width: '10%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{(value || 0).toFixed(0)}</span>,
    },
    {
      key: 'channels', header: 'Top Channel', width: '13%',
      render: (value) => {
        if (!value || typeof value !== 'object') return '-';
        const sorted = Object.entries(value).sort((a: any, b: any) => (b[1]?.quantity || 0) - (a[1]?.quantity || 0));
        const top = sorted[0];
        return top ? (
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
            {top[0]}: {(top[1] as any)?.quantity || 0}
          </span>
        ) : '-';
      },
    },
  ];

  // Add rank index to data
  const rankedData = topByQty.map((item: any, idx: number) => ({ ...item, rank: idx + 1 }));

  return (
    <div>
      <PageHeader title="Top Selling Products" description="Best performing SKUs from Anthrilo sales data" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total SKUs Sold" value={summary.total_skus || 0} icon="📦" color="blue" />
        <StatCard title="Total Units" value={summary.total_quantity || 0} icon="🛒" color="purple" />
        <StatCard title="Avg Revenue/SKU" value={`₹${avgRevenuePerSku.toFixed(0)}`} icon="📊" color="green" />
        <StatCard title="Avg Qty/SKU" value={avgQtyPerSku.toFixed(1)} icon="📈" color="yellow" />
      </div>

      <div className="card mb-4">
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
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Top 50 by Units Sold</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching sales data from Anthrilo..." />
        ) : (
          <DataTable data={rankedData} columns={columns} emptyMessage="No sales data for this period." />
        )}
      </div>
    </div>
  );
}
