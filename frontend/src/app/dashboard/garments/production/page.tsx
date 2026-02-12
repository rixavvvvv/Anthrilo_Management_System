'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

export default function OrdersPage() {
  const [period, setPeriod] = useState('today');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { data: summaryData } = useQuery({
    queryKey: ['uc-sales-summary', period],
    queryFn: async () => {
      const fn = period === 'today' ? ucSales.getToday : period === 'yesterday' ? ucSales.getYesterday : ucSales.getLast7Days;
      const response = await fn();
      return response.data;
    },
    staleTime: 60_000,
  });

  const { data: ordersData, isLoading, error } = useQuery({
    queryKey: ['uc-orders', period, page],
    queryFn: async () => {
      const response = await ucSales.getOrders({ period, page, page_size: PAGE_SIZE });
      return response.data;
    },
    staleTime: 60_000,
  });

  const orders = (ordersData?.orders || []).map((o: any) => ({
    code: o.code,
    channel: o.channel || '-',
    status: o.status || '-',
    items: o.item_count || o.items?.length || 0,
    selling_price: o.selling_price || o.total_selling_price || 0,
    net_revenue: o.net_revenue || o.selling_price || 0,
    itemSku: o.items?.[0]?.itemSku || o.item_sku || '-',
  }));

  const totalOrders = ordersData?.total || orders.length;
  const totalPages = ordersData?.total_pages || Math.ceil(totalOrders / PAGE_SIZE);

  const statusColors: Record<string, string> = {
    CREATED: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    PROCESSING: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    COMPLETE: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    CANCELLED: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    DISPATCHED: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    SHIPPED: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
    DELIVERED: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  };

  const columns: Column<any>[] = [
    { key: 'code', header: 'Order Code', width: '18%' },
    { key: 'channel', header: 'Channel', width: '14%',
      render: (value) => (
        <span className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">{value}</span>
      ),
    },
    { key: 'status', header: 'Status', width: '12%',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[value] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
          {value}
        </span>
      ),
    },
    { key: 'items', header: 'Items', width: '7%',
      render: (value) => <span className="font-semibold">{value}</span>,
    },
    { key: 'selling_price', header: 'Selling Price', width: '13%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'net_revenue', header: 'Net Revenue', width: '13%',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Unicommerce Orders" description="Real-time order data from Unicommerce" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total Orders" value={summaryData?.total_orders || 0} icon="🛒" color="blue" />
        <StatCard title="Revenue" value={`₹${((summaryData?.total_revenue || 0) / 1000).toFixed(1)}K`} icon="💰" color="green" />
        <StatCard title="Avg Order" value={`₹${(summaryData?.avg_order_value || 0).toFixed(0)}`} icon="📊" color="purple" />
        <StatCard title="Channels" value={summaryData?.channel_count || '-'} icon="🏪" color="yellow" />
      </div>

      <div className="card mb-4">
        <div className="flex gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last_7_days', label: 'Last 7 Days' },
          ].map((p) => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message || 'Failed to load orders'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Orders</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching orders from Unicommerce..." />
        ) : (
          <DataTable data={orders} columns={columns} emptyMessage="No orders found for the selected period." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
