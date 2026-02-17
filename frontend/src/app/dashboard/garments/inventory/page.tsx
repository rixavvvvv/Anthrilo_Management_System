'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 12;

export default function GarmentInventoryPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch inventory summary ONCE on page load - independent of pagination
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['uc-inventory-summary'],
    queryFn: async () => {
      const response = await ucCatalog.getInventorySummary();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Fetch paginated data for table - no aggregates needed
  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-inventory', page, debouncedSearch],
    queryFn: async () => {
      const response = await ucCatalog.searchItems({
        displayStart: page * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: true,
        getAggregates: false, // No longer need aggregates from paginated query
        keyword: debouncedSearch || undefined,
      });
      return response.data;
    },
    staleTime: 60_000,
  });

  const items = (data?.elements || []).map((item: any) => {
    const snap = item.inventorySnapshots?.[0] || {};
    return {
      itemTypeSKU: item.itemTypeSKU || item.skuCode || '-',
      name: item.name,
      categoryName: item.categoryName,
      inventory: snap.inventory || 0,
      inventoryBlocked: snap.inventoryBlocked || 0,
      putawayPending: snap.putawayPending || 0,
      virtualInventory: snap.virtualInventory || 0,
      openSale: snap.openSale || 0,
      badInventory: snap.badInventory || 0,
      price: item.price || 0,
      enabled: item.enabled,
    };
  });

  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  // Use summary data for totals (fetched once, independent of pagination)
  const aggregates = summaryData?.aggregates || {};
  const totalSKUs = summaryData?.totalRecords || totalRecords;
  const totalRealInventory = aggregates?.totalInventory || 0;
  const totalVirtualInventory = aggregates?.totalVirtualInventory || 0;
  const totalStockValue = aggregates?.totalValue || 0;
  
  // Use REAL data from API - not estimates!
  const skusWithStock = aggregates?.skusWithStock || 0;
  const skusOutOfStock = aggregates?.skusOutOfStock || 0;
  const outOfStockPercent = totalSKUs > 0 ? Math.round((skusOutOfStock / totalSKUs) * 100) : 0;
  
  const summaryLoaded = summaryData?.successful || false;

  const columns: Column<any>[] = [
    { 
      key: 'itemTypeSKU', 
      header: 'Item Type SKU', 
      width: '15%',
      render: (value) => <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>,
    },
    { key: 'name', header: 'Product Name', width: '25%' },
    { key: 'categoryName', header: 'Category', width: '10%' },
    {
      key: 'inventory', 
      header: 'Inventory', 
      width: '9%',
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
      header: 'Putaway Pending', 
      width: '11%',
      render: (value) => value > 0 ? <span className="text-orange-600 dark:text-orange-400 font-medium">{value}</span> : <span className="text-slate-400">0</span>,
    },
    {
      key: 'virtualInventory', 
      header: 'Virtual', 
      width: '7%',
      render: (value) => <span className="font-medium text-blue-600 dark:text-blue-400">{value}</span>,
    },
    {
      key: 'openSale', 
      header: 'Open Sale', 
      width: '7%',
      render: (value) => <span className="text-purple-600 dark:text-purple-400 font-medium">{value}</span>,
    },
    {
      key: 'price', 
      header: 'MRP', 
      width: '8%',
      render: (value) => <span className="text-slate-900 dark:text-slate-100 font-medium">₹{value?.toFixed(0)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Garment Inventory" description={`Live inventory from Unicommerce — ${totalSKUs.toLocaleString()} total SKUs`} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
        <StatCard title="Total SKUs" value={totalSKUs.toLocaleString()} icon="📦" color="blue" />
        <StatCard
          title="SKUs with Stock"
          value={summaryLoaded ? skusWithStock.toLocaleString() : (summaryLoading ? 'Loading...' : '-')}
          icon="✅"
          color="emerald"
        />
        <StatCard
          title="Out of Stock %"
          value={summaryLoaded ? `${outOfStockPercent}%` : (summaryLoading ? 'Loading...' : '-')}
          icon="⚠️"
          color="red"
        />
        <StatCard
          title="Total Inventory"
          value={summaryLoaded ? totalRealInventory.toLocaleString() : (summaryLoading ? 'Loading...' : '-')}
          icon="📊"
          color="purple"
        />
        <StatCard
          title="Stock Value"
          value={summaryLoaded ? `₹${(totalStockValue / 100000).toFixed(2)}L` : (summaryLoading ? 'Loading...' : '-')}
          icon="💰"
          color="yellow"
        />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center">
          <input type="text" placeholder="Search by SKU Code..." className="input flex-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Page {page + 1} of {totalPages || 1}
          </span>
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load inventory'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-slate-900 dark:text-white">Inventory Overview</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching inventory from Unicommerce..." />
        ) : (
          <DataTable data={items} columns={columns} emptyMessage="No inventory records found for this search." />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
