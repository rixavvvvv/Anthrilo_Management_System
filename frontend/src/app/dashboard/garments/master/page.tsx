'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucCatalog, ucInventory } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';

const PAGE_SIZE = 25;

export default function GarmentMasterPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(0); }, [selectedCategory]);

  // ── Export-based summary (all 26K+ SKUs) ──────────────────────
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['uc-inventory-summary-export'],
    queryFn: async () => {
      const res = await ucInventory.getSummary();
      return res.data;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ── Catalog search (paginated from Unicommerce) ───────────────
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['uc-catalog', page, debouncedSearch, selectedCategory],
    queryFn: async () => {
      const payload: any = {
        getInventorySnapshot: false,
        searchOptions: {
          displayStart: page * PAGE_SIZE,
          displayLength: PAGE_SIZE,
        },
      };
      if (debouncedSearch) payload.keyword = debouncedSearch;
      // Unicommerce catalog search doesn't support category filter natively,
      // so we pass keyword if category is selected
      if (selectedCategory && !debouncedSearch) {
        payload.keyword = selectedCategory;
      }
      const response = await ucCatalog.searchItems({
        displayStart: page * PAGE_SIZE,
        displayLength: PAGE_SIZE,
        getInventorySnapshot: false,
        keyword: (debouncedSearch || selectedCategory) || undefined,
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const items = useMemo(() =>
    (data?.elements || []).map((item: any) => ({
      skuCode: item.skuCode || '-',
      name: item.name || '-',
      description: item.description || '',
      categoryName: item.categoryName || '-',
      color: item.color || '-',
      size: item.size || '-',
      brand: item.brand || '-',
      price: item.price || 0,
      hsnCode: item.hsnCode || '-',
      weight: item.weight || 0,
      enabled: item.enabled,
      ean: item.ean || '-',
    })),
  [data]);

  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);
  const currentPage = page + 1; // display as 1-based

  // ── Summary stats ─────────────────────────────────────────────
  const summary = summaryData?.summary || {};
  const categories = summaryData?.categories || [];
  const summaryOk = summaryData?.successful;

  // Unique category count
  const categoryCount = categories.length;

  const columns: Column<any>[] = [
    {
      key: 'skuCode', header: 'SKU Code', width: '14%',
      render: (value) => (
        <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">{value}</span>
      ),
    },
    {
      key: 'name', header: 'Product Name', width: '22%',
      render: (value, row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{value}</p>
          {row.description && (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'categoryName', header: 'Category', width: '12%',
      render: (value) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
          {value}
        </span>
      ),
    },
    {
      key: 'color', header: 'Color', width: '8%',
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-slate-200 dark:border-slate-600" style={{ backgroundColor: value !== '-' ? value.toLowerCase().replace(/\s+/g, '') : '#94a3b8' }}></span>
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
    {
      key: 'size', header: 'Size', width: '8%',
      render: (value) => (
        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {value}
        </span>
      ),
    },
    {
      key: 'brand', header: 'Brand', width: '8%',
      render: (value) => <span className="text-sm font-medium">{value}</span>,
    },
    {
      key: 'hsnCode', header: 'HSN', width: '8%',
      render: (value) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{value}</span>,
    },
    {
      key: 'price', header: 'MRP', width: '8%',
      render: (value) => (
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          ₹{value?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
      ),
    },
    {
      key: 'weight', header: 'Weight', width: '6%',
      render: (value) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">{value > 0 ? `${value}g` : '-'}</span>
      ),
    },
    {
      key: 'enabled', header: 'Status', width: '6%',
      render: (value) => (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
          value
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
          {value ? 'Active' : 'Off'}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Product Master Data"
        description={`Unicommerce Product Catalog — ${summaryOk ? summary.total_skus?.toLocaleString() : totalRecords.toLocaleString()} SKUs across ${categoryCount} categories`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          title="Total Catalog"
          value={totalRecords.toLocaleString()}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Enabled SKUs"
          value={summaryOk ? summary.enabled_skus?.toLocaleString() : (summaryLoading ? '…' : '-')}
          icon="✅"
          color="emerald"
        />
        <StatCard
          title="In Stock"
          value={summaryOk ? summary.in_stock_skus?.toLocaleString() : (summaryLoading ? '…' : '-')}
          icon="📊"
          color="green"
        />
        <StatCard
          title="Out of Stock"
          value={summaryOk ? summary.out_of_stock_skus?.toLocaleString() : (summaryLoading ? '…' : '-')}
          icon="⚠️"
          color="red"
        />
        <StatCard
          title="Total Inventory"
          value={summaryOk ? summary.total_inventory?.toLocaleString() : (summaryLoading ? '…' : '-')}
          icon="🏭"
          color="purple"
        />
        <StatCard
          title="Categories"
          value={categoryCount.toString()}
          icon="🏷️"
          color="indigo"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="card mb-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Search SKU, product name, category, brand…"
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null); }}
            />
          </div>

          <button
            onClick={() => setShowCategories(!showCategories)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              showCategories || selectedCategory
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            🏷️ {selectedCategory ? selectedCategory : 'Categories'}
          </button>

          {selectedCategory && (
            <button
              onClick={() => { setSelectedCategory(null); setSearch(''); }}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/30 transition-colors"
            >
              ✕ Clear
            </button>
          )}

          <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap ml-auto">
            {totalRecords.toLocaleString()} products · Page {currentPage} / {totalPages || 1}
            {isFetching && !isLoading && ' ⟳'}
          </span>
        </div>

        {/* Category Chips (collapsible) */}
        {showCategories && categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {categories.map((cat: any) => (
                <button
                  key={cat.category}
                  onClick={() => {
                    setSelectedCategory(cat.category === selectedCategory ? null : cat.category);
                    setSearch('');
                    setShowCategories(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedCategory === cat.category
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {cat.category}
                  <span className="ml-1.5 opacity-60">({cat.skus})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 mb-4">
          <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load catalog'}</p>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            Product Catalog
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              Unicommerce API
            </span>
          </h2>
          {selectedCategory && (
            <span className="text-sm px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium">
              📂 {selectedCategory}
            </span>
          )}
        </div>
        {isLoading ? (
          <LoadingSpinner message="Fetching product catalog from Unicommerce…" />
        ) : (
          <DataTable data={items} columns={columns} emptyMessage="No products found for this search." />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button disabled={page <= 0} onClick={() => setPage(page - 1)}
            className="btn btn-secondary disabled:opacity-40">← Previous</button>
          <div className="flex items-center gap-2">
            {currentPage > 2 && (
              <button onClick={() => setPage(0)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">1</button>
            )}
            {currentPage > 3 && <span className="text-slate-400">…</span>}
            {currentPage > 1 && (
              <button onClick={() => setPage(page - 1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{currentPage - 1}</button>
            )}
            <span className="px-3 py-1 rounded-lg text-sm bg-primary-600 text-white font-semibold">{currentPage}</span>
            {currentPage < totalPages && (
              <button onClick={() => setPage(page + 1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{currentPage + 1}</button>
            )}
            {currentPage < totalPages - 2 && <span className="text-slate-400">…</span>}
            {currentPage < totalPages - 1 && (
              <button onClick={() => setPage(totalPages - 1)} className="px-3 py-1 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">{totalPages}</button>
            )}
          </div>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
            className="btn btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Category Breakdown (always visible at bottom) */}
      {categories.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            📊 Category Distribution
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({categories.length} categories)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {categories.slice(0, 20).map((cat: any) => {
              const stockPercent = summary.total_inventory > 0 ? ((cat.inventory / summary.total_inventory) * 100) : 0;
              return (
                <button
                  key={cat.category}
                  onClick={() => { setSelectedCategory(cat.category); setSearch(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all text-left group"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {cat.category}
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {cat.inventory.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-1">units</span>
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-400">{cat.skus} SKUs</span>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{stockPercent.toFixed(1)}%</span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
                      style={{ width: `${Math.min(stockPercent, 100)}%` }}
                    ></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
