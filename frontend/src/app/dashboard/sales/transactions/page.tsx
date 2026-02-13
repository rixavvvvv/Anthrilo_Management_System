'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 12;

export default function SalesTransactionsPage() {
  const [period, setPeriod] = useState('today');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, prepaid, cod
  const [channelFilter, setChannelFilter] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Fetch summary data (reuses cache from dashboard)
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['unicommerce-today'],
    queryFn: async () => {
      const response = await ucSales.getToday();
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: weekData, isLoading: loadingWeek } = useQuery({
    queryKey: ['unicommerce-last-7-days'],
    queryFn: async () => {
      const response = await ucSales.getLast7Days();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch paginated orders from UC
  const { data: ordersData, isLoading: loadingOrders, error } = useQuery({
    queryKey: ['uc-transactions', period, page, customFrom, customTo],
    queryFn: async () => {
      if (period === 'custom' && customFrom && customTo) {
        const response = await ucSales.getOrders({ period: 'custom', from_date: customFrom, to_date: customTo, page, page_size: 100 });
        return response.data;
      }
      const response = await ucSales.getOrders({ period, page, page_size: 100 }); // fetch larger batch for client filtering
      return response.data;
    },
    enabled: period !== 'custom' || (!!customFrom && !!customTo),
    staleTime: 60_000,
  });

  // Flatten orders to item-wise rows
  const allRows = useMemo(() => {
    const orders = ordersData?.orders || [];
    const rows: any[] = [];
    orders.forEach((order: any) => {
      const orderItems = order.items || [];
      if (orderItems.length === 0) {
        // Order with no items detail
        rows.push({
          date: order.displayOrderDateTime || order.created,
          code: order.displayOrderCode || order.code,
          channel: order.channel || '-',
          status: order.status || '-',
          sku: '-',
          size: '-',
          price: order.selling_price || order.total_selling_price || 0,
          cashOnDelivery: order.cashOnDelivery ?? order.cod ?? false,
        });
      } else {
        orderItems.forEach((item: any) => {
          rows.push({
            date: order.displayOrderDateTime || order.created,
            code: order.displayOrderCode || order.code,
            channel: order.channel || '-',
            status: order.status || '-',
            sku: item.itemSku || item.sku || '-',
            size: item.size || item.itemSku?.match(/[-_]([SMLXL0-9]+)$/)?.[1] || '-',
            price: item.sellingPrice || item.selling_price || 0,
            cashOnDelivery: order.cashOnDelivery ?? order.cod ?? false,
          });
        });
      }
    });
    return rows;
  }, [ordersData]);

  // Extract unique sizes for filter
  const uniqueSizes = useMemo(() => {
    const sizes = new Set<string>();
    allRows.forEach((r) => {
      if (r.size && r.size !== '-') sizes.add(r.size);
    });
    return Array.from(sizes).sort();
  }, [allRows]);

  // Extract unique channels for filter
  const uniqueChannels = useMemo(() => {
    const channels = new Set<string>();
    allRows.forEach((r) => {
      if (r.channel && r.channel !== '-') channels.add(r.channel);
    });
    return Array.from(channels).sort();
  }, [allRows]);

  // Apply client-side filters
  const filtered = useMemo(() => {
    return allRows.filter((row) => {
      // Search filter
      if (search) {
        const term = search.toLowerCase();
        if (!row.code?.toLowerCase().includes(term) &&
          !row.sku?.toLowerCase().includes(term) &&
          !row.channel?.toLowerCase().includes(term)) {
          return false;
        }
      }
      // Size filter
      if (sizeFilter && row.size !== sizeFilter) return false;
      // Payment filter
      if (paymentFilter === 'cod' && !row.cashOnDelivery) return false;
      if (paymentFilter === 'prepaid' && row.cashOnDelivery) return false;
      // Channel filter
      if (channelFilter && row.channel !== channelFilter) return false;
      return true;
    });
  }, [allRows, search, sizeFilter, paymentFilter, channelFilter]);

  // Client-side pagination of filtered results
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const clientPage = Math.min(page - 1, totalPages - 1);
  const paginated = filtered.slice(clientPage * PAGE_SIZE, (clientPage + 1) * PAGE_SIZE);

  const todaySummary = summaryData?.summary || {};
  const weekSummary = weekData?.summary || {};

  const statusColors: Record<string, string> = {
    CREATED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    PROCESSING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    COMPLETE: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    CANCELLED: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
    DISPATCHED: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200',
    SHIPPED: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200',
    DELIVERED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
  };

  const columns: Column<any>[] = [
    {
      key: 'date', header: 'Date', width: '14%',
      render: (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
    },
    {
      key: 'code', header: 'Order Code', width: '15%',
      render: (value) => <span className="font-mono text-xs font-semibold text-primary-700 dark:text-primary-300">{value}</span>,
    },
    {
      key: 'channel', header: 'Channel', width: '11%',
      render: (value) => <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">{value}</span>,
    },
    {
      key: 'status', header: 'Status', width: '10%',
      render: (value) => <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[value] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>{value}</span>,
    },
    {
      key: 'sku', header: 'SKU', width: '15%',
      render: (value) => <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{value}</span>,
    },
    {
      key: 'size', header: 'Size', width: '7%',
      render: (value) => <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium">{value}</span>,
    },
    {
      key: 'price', header: 'Price', width: '10%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{(value || 0).toFixed(0)}</span>,
    },
    {
      key: 'cashOnDelivery', header: 'Payment', width: '9%',
      render: (value) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${value ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'}`}>
          {value ? 'COD' : 'Prepaid'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Transactions" description="Item-wise transactions from Unicommerce" />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Today's Orders" value={loadingSummary ? '...' : (todaySummary.total_orders || 0)} icon="🛒" color="blue" />
        <StatCard title="Today's Revenue" value={loadingSummary ? '...' : `₹${((todaySummary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="💰" color="green" />
        <StatCard title="7-Day Orders" value={loadingWeek ? '...' : (weekSummary.total_orders || 0)} icon="📊" color="purple" />
        <StatCard title="7-Day Revenue" value={loadingWeek ? '...' : `₹${((weekSummary.total_revenue || 0) / 1000).toFixed(1)}K`} icon="💵" color="indigo" />
      </div>

      {/* Filters Section */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Period */}
          <div className="flex gap-2">
            {[
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'custom', label: 'Custom' },
            ].map((p) => (
              <button key={p.key} onClick={() => { setPeriod(p.key); setPage(1); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {period === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                max={new Date().toISOString().split('T')[0]}
                className="input w-auto text-sm" />
              <span className="text-sm text-slate-500">to</span>
              <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                max={new Date().toISOString().split('T')[0]}
                className="input w-auto text-sm" />
            </div>
          )}

          {/* Channel */}
          <select value={channelFilter} onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="input w-auto">
            <option value="">All Channels</option>
            {uniqueChannels.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
          </select>

          {/* Payment */}
          <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="input w-auto">
            <option value="all">All Payments</option>
            <option value="prepaid">Prepaid</option>
            <option value="cod">COD</option>
          </select>

          {/* Size */}
          <select value={sizeFilter} onChange={(e) => { setSizeFilter(e.target.value); setPage(1); }}
            className="input w-auto">
            <option value="">All Sizes</option>
            {uniqueSizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Search */}
          <input type="text" placeholder="Search order, SKU, channel..."
            className="input flex-1 min-w-[200px]"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {filtered.length} items found
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load transactions'}</p>
        </div>
      )}

      {/* Transactions Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-900 dark:text-white">Transactions ({filtered.length})</h2>
        </div>
        {loadingOrders ? (
          <LoadingSpinner message="Fetching transactions from Unicommerce..." />
        ) : (
          <DataTable data={paginated} columns={columns} emptyMessage="No transactions found for the selected filters." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
