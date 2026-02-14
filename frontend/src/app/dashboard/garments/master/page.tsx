'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 12;

export default function GarmentMasterPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-catalog', page, debouncedSearch],
    queryFn: async () => {
      const response = await ucCatalog.searchItems({
        displayStart: page * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: false,
        keyword: debouncedSearch || undefined,
      });
      return response.data;
    },
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const items = (data?.elements || []).map((item: any) => ({
    skuCode: item.skuCode,
    name: item.name,
    categoryName: item.categoryName || '-',
    color: item.color || '-',
    size: item.size || '-',
    brand: item.brand || '-',
    price: item.price || 0,
    enabled: item.enabled,
  }));

  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  const { activeCount, inactiveCount } = useMemo(() => {
    return items.reduce(
      (acc: { activeCount: number; inactiveCount: number }, item: any) => ({
        activeCount: acc.activeCount + (item.enabled ? 1 : 0),
        inactiveCount: acc.inactiveCount + (item.enabled ? 0 : 1),
      }),
      { activeCount: 0, inactiveCount: 0 }
    );
  }, [items]);

  const columns: Column<any>[] = [
    { key: 'skuCode', header: 'SKU Code', width: '15%' },
    { key: 'name', header: 'Product Name', width: '25%' },
    { key: 'categoryName', header: 'Category', width: '12%' },
    { key: 'color', header: 'Color', width: '8%' },
    {
      key: 'size', header: 'Size', width: '7%',
      render: (value) => <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium">{value}</span>,
    },
    { key: 'brand', header: 'Brand', width: '10%' },
    {
      key: 'price', header: 'MRP', width: '9%',
      render: (value) => <span className="text-slate-900 dark:text-slate-100 font-medium">₹{value?.toFixed(0)}</span>,
    },
    {
      key: 'enabled', header: 'Status', width: '9%',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${value ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Product Master" description={`Unicommerce product catalog — ${totalRecords.toLocaleString()} total SKUs`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard title="Total Products" value={totalRecords.toLocaleString()} icon="📦" color="blue" />
        <StatCard title="Active Products" value={activeCount.toLocaleString()} icon="✅" color="green" />
        <StatCard title="Inactive Products" value={inactiveCount.toLocaleString()} icon="🚫" color="red" />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center">
          <input type="text" placeholder="Search by SKU Code..." className="input flex-1"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{totalRecords.toLocaleString()} items</span>
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load catalog'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-slate-900 dark:text-white">Product Catalog</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching catalog from Unicommerce..." />
        ) : (
          <DataTable data={items} columns={columns} emptyMessage="No products found for this search." />
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
