'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

export default function DiscountAnalysisPage() {
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-discount-analysis', period],
    queryFn: async () => {
      const response = await ucSales.getSalesBySku({ period });
      return response.data;
    },
    staleTime: 120_000,
  });

  const allSkus = (data?.skus || []).map((s: any) => ({
    ...s,
    discount_pct: s.total_revenue > 0 ? ((s.total_discount / s.total_revenue) * 100) : 0,
    net_after_discount: (s.total_revenue || 0) - (s.total_discount || 0),
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

  const overallDiscountPct = summary.total_revenue > 0
    ? ((summary.total_discount / summary.total_revenue) * 100).toFixed(1)
    : '0.0';

  const filtered = search
    ? allSkus.filter((s: any) =>
        s.sku?.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allSkus;

  const columns: Column<any>[] = [
    { key: 'sku', header: 'SKU', width: '14%' },
    { key: 'name', header: 'Product Name', width: '20%' },
    { key: 'total_quantity', header: 'Qty', width: '6%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    { key: 'total_revenue', header: 'Gross Revenue', width: '12%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'total_discount', header: 'Discount', width: '10%',
      render: (value) => <span className="text-orange-600 dark:text-orange-400 font-semibold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'discount_pct', header: 'Disc %', width: '8%',
      render: (value) => {
        const v = value || 0;
        const c = v > 30 ? 'text-red-600 dark:text-red-400' : v > 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
        return <span className={`font-bold ${c}`}>{v.toFixed(1)}%</span>;
      },
    },
    { key: 'net_after_discount', header: 'Net Revenue', width: '12%',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'avg_selling_price', header: 'Avg SP', width: '10%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{(value || 0).toFixed(2)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Discount Analysis" description="Discount breakdown across products from Unicommerce" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Overall Discount %" value={`${overallDiscountPct}%`} icon="💸" color="blue" />
        <StatCard title="Total SKUs" value={summary.total_skus || 0} icon="📦" color="purple" />
        <StatCard title="Total Revenue" value={`₹${((summary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="🏷️" color="green" />
        <StatCard title="Total Discount" value={`₹${((summary.total_discount || 0) / 1000).toFixed(1)}K`} icon="💰" color="red" />
      </div>

      {Object.values(buckets).some((v) => v > 0) && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Discount Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(buckets).map(([bucket, count]) => (
              <div key={bucket} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{count}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{bucket}</div>
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
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search SKU or product..." className="input flex-1"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Discount Details by SKU</h2>
        {isLoading ? (
          <LoadingSpinner message="Calculating discount analytics from Unicommerce..." />
        ) : (
          <DataTable data={filtered} columns={columns} emptyMessage="No discount data available for this period." />
        )}
      </div>
    </div>
  );
}
