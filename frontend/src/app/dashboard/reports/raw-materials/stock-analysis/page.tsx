'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 50;

export default function InventoryAnalysisPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [stockFilter, setStockFilter] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['uc-stock-analysis', page, search],
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
    const stock = snap.inventory || 0;
    const status = stock === 0 ? 'Out of Stock' : stock <= 5 ? 'Critical' : stock <= 20 ? 'Low' : stock <= 100 ? 'Normal' : 'High';
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
      status,
    };
  });

  const filtered = stockFilter === 'all' ? items :
    stockFilter === 'out' ? items.filter((i: any) => i.status === 'Out of Stock') :
    stockFilter === 'low' ? items.filter((i: any) => i.status === 'Critical' || i.status === 'Low') :
    stockFilter === 'normal' ? items.filter((i: any) => i.status === 'Normal') :
    items.filter((i: any) => i.status === 'High');

  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  const outOfStock = items.filter((i: any) => i.status === 'Out of Stock').length;
  const lowStock = items.filter((i: any) => i.status === 'Critical' || i.status === 'Low').length;
  const totalValue = items.reduce((s: number, i: any) => s + i.stockValue, 0);

  const statusColors: Record<string, string> = {
    'Out of Stock': 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    'Critical': 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
    'Low': 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    'Normal': 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    'High': 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  };

  const columns: Column<any>[] = [
    { key: 'skuCode', header: 'SKU', width: '14%' },
    { key: 'name', header: 'Product Name', width: '20%' },
    { key: 'categoryName', header: 'Category', width: '10%' },
    { key: 'inventory', header: 'Good Stock', width: '9%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    { key: 'virtualInventory', header: 'Virtual', width: '8%' },
    { key: 'openSale', header: 'Open Sale', width: '8%',
      render: (value) => <span className="text-blue-600 dark:text-blue-400">{value}</span>,
    },
    { key: 'badInventory', header: 'Bad', width: '6%',
      render: (value) => value > 0 ? <span className="text-red-500 font-medium">{value}</span> : <span className="text-gray-400">0</span>,
    },
    { key: 'stockValue', header: 'Stock Value', width: '11%',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-semibold">₹{(value || 0).toFixed(0)}</span>,
    },
    { key: 'status', header: 'Status', width: '10%',
      render: (value) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[value] || ''}`}>{value}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Inventory Stock Analysis" description={`Unicommerce stock levels — ${totalRecords.toLocaleString()} total SKUs`} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard title="Total SKUs" value={totalRecords.toLocaleString()} icon="📦" color="blue" />
        <StatCard title="Out of Stock (page)" value={outOfStock} icon="🚫" color="red" />
        <StatCard title="Low/Critical (page)" value={lowStock} icon="⚠️" color="yellow" />
        <StatCard title="Stock Value (page)" value={`₹${(totalValue / 1000).toFixed(1)}K`} icon="💰" color="green" />
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${stockFilter === f.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="Search SKU or product..." className="input flex-1"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 mb-4">
          <p className="text-red-600 dark:text-red-400">Error: {(error as any)?.message}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Stock Analysis</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching stock data from Unicommerce..." />
        ) : (
          <DataTable data={filtered} columns={columns} emptyMessage="No stock data found." />
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
