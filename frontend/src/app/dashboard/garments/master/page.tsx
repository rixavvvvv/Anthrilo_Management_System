'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 50;

export default function GarmentMasterPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-catalog', page, search],
    queryFn: async () => {
      const response = await ucCatalog.searchItems({
        displayStart: page * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: false,
        keyword: search || undefined,
      });
      return response.data;
    },
    staleTime: 60_000,
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
  const activeCount = items.filter((i: any) => i.enabled).length;

  const columns: Column<any>[] = [
    { key: 'skuCode', header: 'SKU Code', width: '15%' },
    { key: 'name', header: 'Product Name', width: '25%' },
    { key: 'categoryName', header: 'Category', width: '12%' },
    { key: 'color', header: 'Color', width: '8%' },
    { key: 'size', header: 'Size', width: '7%',
      render: (value) => <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium">{value}</span>,
    },
    { key: 'brand', header: 'Brand', width: '10%' },
    { key: 'price', header: 'MRP', width: '9%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{value?.toFixed(0)}</span>,
    },
    { key: 'enabled', header: 'Status', width: '9%',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
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
        <StatCard title="Active (this page)" value={activeCount} icon="✅" color="green" />
        <StatCard title="Showing" value={`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalRecords)}`} icon="📄" color="purple" />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center">
          <input type="text" placeholder="Search by product name or SKU..." className="input flex-1"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{totalRecords.toLocaleString()} items</span>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message || 'Failed to load catalog'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Product Catalog</h2>
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
          <span className="text-sm text-gray-600 dark:text-gray-400">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
