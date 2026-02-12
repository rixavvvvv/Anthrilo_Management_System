'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 50;

export default function GarmentInventoryPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-inventory', page, search],
    queryFn: async () => {
      const response = await ucCatalog.searchItems({
        displayStart: page * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: true,
        keyword: search || undefined,
      });
      return response.data;
    },
    staleTime: 60_000,
  });

  const items = (data?.elements || []).map((item: any) => {
    const snap = item.inventorySnapshots?.[0] || {};
    return {
      skuCode: item.skuCode,
      name: item.name,
      categoryName: item.categoryName,
      size: item.size || '-',
      color: item.color || '-',
      price: item.price || 0,
      inventory: snap.inventory || 0,
      virtualInventory: snap.virtualInventory || 0,
      openSale: snap.openSale || 0,
      badInventory: snap.badInventory || 0,
      putawayPending: snap.putawayPending || 0,
      enabled: item.enabled,
    };
  });

  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  // Page-level stats
  const totalStock = items.reduce((s: number, i: any) => s + i.inventory, 0);
  const totalVirtual = items.reduce((s: number, i: any) => s + i.virtualInventory, 0);
  const lowStock = items.filter((i: any) => i.inventory > 0 && i.inventory <= 10).length;
  const outOfStock = items.filter((i: any) => i.inventory === 0).length;

  const columns: Column<any>[] = [
    { key: 'skuCode', header: 'SKU', width: '13%' },
    { key: 'name', header: 'Product Name', width: '22%' },
    { key: 'categoryName', header: 'Category', width: '10%' },
    { key: 'size', header: 'Size', width: '7%',
      render: (value) => <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium">{value}</span>,
    },
    { key: 'color', header: 'Color', width: '7%' },
    { key: 'inventory', header: 'Good Stock', width: '8%',
      render: (value) => {
        const c = value === 0 ? 'text-red-600 dark:text-red-400' : value <= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
        return <span className={`font-bold ${c}`}>{value}</span>;
      },
    },
    { key: 'virtualInventory', header: 'Virtual', width: '7%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    { key: 'openSale', header: 'Open Sale', width: '7%',
      render: (value) => <span className="text-blue-600 dark:text-blue-400 font-medium">{value}</span>,
    },
    { key: 'badInventory', header: 'Bad Stock', width: '7%',
      render: (value) => value > 0 ? <span className="text-red-500 font-medium">{value}</span> : <span className="text-gray-400">0</span>,
    },
    { key: 'price', header: 'MRP', width: '8%',
      render: (value) => <span className="text-gray-900 dark:text-gray-100">₹{value?.toFixed(0)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Garment Inventory" description={`Live inventory from Unicommerce — ${totalRecords.toLocaleString()} total SKUs`} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Good Stock (page)" value={totalStock} icon="📦" color="green" />
        <StatCard title="Virtual Stock (page)" value={totalVirtual} icon="☁️" color="blue" />
        <StatCard title="Low Stock (page)" value={lowStock} icon="⚠️" color="yellow" />
        <StatCard title="Out of Stock (page)" value={outOfStock} icon="🚫" color="red" />
      </div>

      <div className="card mb-4">
        <div className="flex gap-4 items-center">
          <input type="text" placeholder="Search by product name or SKU..." className="input flex-1"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {totalRecords.toLocaleString()} items
          </span>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message || 'Failed to load inventory'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Inventory Overview</h2>
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
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page + 1} of {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
