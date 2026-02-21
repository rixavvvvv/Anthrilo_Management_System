'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const CLIENT_PAGE_SIZE = 20;

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
  const [page, setPage] = useState(0);
  const [stockFilter, setStockFilter] = useState('all');

  // Reset to page 0 whenever filter or search changes
  useEffect(() => {
    setPage(0);
  }, [stockFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch summary data ONCE for totals across ALL SKUs
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['uc-inventory-summary'],
    queryFn: async () => {
      const response = await ucCatalog.getInventorySummary();
      return response.data;
    },
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch ALL items at once so client-side filtering works across the full catalog
  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-stock-analysis-all', debouncedSearch],
    queryFn: async () => {
      // Fetch large batch; Unicommerce caps at ~500 per request
      const response = await ucCatalog.searchItems({
        displayStart: 0,
        displayLength: 500,
        getInventorySnapshot: true,
        getAggregates: false,
        keyword: debouncedSearch || undefined,
      });
      return response.data;
    },
    staleTime: 60_000,
  });

  // Map raw elements → enriched rows with correct status
  const allItems = useMemo(() => {
    return (data?.elements || []).map((item: any) => {
      const snap = item.inventorySnapshots?.[0] || {};
      const stock = snap.inventory || 0;
      return {
        skuCode: item.skuCode,
        name: item.name,
        categoryName: item.categoryName || '-',
        inventory: stock,
        virtualInventory: snap.virtualInventory || 0,
        openSale: snap.openSale || 0,
        badInventory: snap.badInventory || 0,
        putawayPending: snap.putawayPending || 0,
        price: item.price || 0,
        stockValue: stock * (item.price || 0),
        status: getStockStatus(stock),
      };
    });
  }, [data]);

  // Apply filter across ALL items, then paginate client-side
  const filtered = useMemo(() => {
    if (stockFilter === 'all') return allItems;
    if (stockFilter === 'out') return allItems.filter((i: any) => i.status === 'Out of Stock');
    if (stockFilter === 'low') return allItems.filter((i: any) => i.status === 'Low');
    if (stockFilter === 'normal') return allItems.filter((i: any) => i.status === 'Normal');
    if (stockFilter === 'high') return allItems.filter((i: any) => i.status === 'High');
    return allItems;
  }, [allItems, stockFilter]);

  const totalPages = Math.ceil(filtered.length / CLIENT_PAGE_SIZE);
  const pagedItems = filtered.slice(page * CLIENT_PAGE_SIZE, (page + 1) * CLIENT_PAGE_SIZE);

  // Category counts for filter badges
  const counts = useMemo(() => ({
    all: allItems.length,
    out: allItems.filter((i: any) => i.status === 'Out of Stock').length,
    low: allItems.filter((i: any) => i.status === 'Low').length,
    normal: allItems.filter((i: any) => i.status === 'Normal').length,
    high: allItems.filter((i: any) => i.status === 'High').length,
  }), [allItems]);

  // Get REAL aggregates from summary endpoint (ALL SKUs)
  const totalSKUs = summaryData?.totalSKUs || 0;
  const totalInventory = summaryData?.totalRealInventory || 0;
  const totalVirtualInventory = summaryData?.totalVirtualInventory || 0;
  const totalValue = summaryData?.totalStockValue || 0;
  const summaryLoaded = summaryData?.successful || false;

  const statusColors: Record<string, string> = {
    'Out of Stock': 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
    'Low': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    'Normal': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    'High': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  };

  const columns: Column<any>[] = [
    { key: 'skuCode', header: 'SKU', width: '14%' },
    { key: 'name', header: 'Product Name', width: '20%' },
    { key: 'categoryName', header: 'Category', width: '10%' },
    {
      key: 'inventory', header: 'Good Stock', width: '9%',
      render: (value) => <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>,
    },
    { key: 'virtualInventory', header: 'Virtual', width: '8%' },
    {
      key: 'openSale', header: 'Open Sale', width: '8%',
      render: (value) => <span className="text-blue-600 dark:text-blue-400">{value}</span>,
    },
    {
      key: 'badInventory', header: 'Bad', width: '6%',
      render: (value) => value > 0 ? <span className="text-rose-500 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'stockValue', header: 'Stock Value', width: '11%',
      render: (value) => <span className="text-emerald-600 dark:text-emerald-400 font-semibold">₹{(value || 0).toFixed(0)}</span>,
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
      <PageHeader title="Inventory Stock Analysis" description={`Unicommerce stock levels — ${totalSKUs.toLocaleString()} total SKUs`} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total SKUs" value={summaryLoaded ? totalSKUs.toLocaleString() : (summaryLoading ? 'Loading...' : '-')} icon="📦" color="blue" />
        <StatCard
          title="Total Real Inventory"
          value={summaryLoaded ? totalInventory.toLocaleString() : (summaryLoading ? 'Loading...' : '-')}
          icon="📊"
          color="emerald"
        />
        <StatCard
          title="Total Virtual Inventory"
          value={summaryLoaded ? totalVirtualInventory.toLocaleString() : (summaryLoading ? 'Loading...' : '-')}
          icon="🔢"
          color="purple"
        />
        <StatCard
          title="Total Stock Value"
          value={summaryLoaded ? `₹${(totalValue / 1000000).toFixed(2)}M` : (summaryLoading ? 'Loading...' : '-')}
          icon="💰"
          color="yellow"
        />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'out', label: 'Out of Stock' },
              { key: 'low', label: 'Low Stock' },
              { key: 'normal', label: 'Normal' },
              { key: 'high', label: 'High Stock' },
            ].map((f) => (
              <button key={f.key} onClick={() => setStockFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${stockFilter === f.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {f.label} ({counts[f.key as keyof typeof counts]})
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search product name..." className="input flex-1"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-slate-900 dark:text-white">
          Stock Analysis
          {stockFilter !== 'all' && <span className="text-sm font-normal text-slate-500 ml-2">({filtered.length} items)</span>}
        </h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching stock data from Unicommerce..." />
        ) : (
          <DataTable data={pagedItems} columns={columns} emptyMessage="No stock data found." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-slate-600 dark:text-slate-400">Page {page + 1} of {totalPages} ({filtered.length} items)</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
