'use client';

import { useState, useMemo, useCallback, useRef, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productMasterApi } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Upload, Search, X, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2,
  FileSpreadsheet, AlertCircle, CheckCircle2, Loader2,
  BookOpen, Filter, ChevronDown,
} from 'lucide-react';
import type {
  ProductMasterItem, ProductMasterListResponse,
  ProductImportSummary, ProductFilterOptions,
} from '@/types';

/* ═══════════════════════════════════════════ helpers ═══ */

const PAGE_SIZE = 25;

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium
        ${type === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
          : 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700'}`}
    >
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════ main page ═══ */

export default function ProductMasterPage() {
  const qc = useQueryClient();

  // ── State ──
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<{ collection?: string; season?: string; fabric_type?: string; type?: string }>({});
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductMasterItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductMasterItem | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Search debounce
  const searchRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  }, []);

  // ── Queries ──
  const skip = (page - 1) * PAGE_SIZE;
  const { data, isLoading, isFetching } = useQuery<ProductMasterListResponse>({
    queryKey: ['products', skip, PAGE_SIZE, debouncedSearch, sortBy, sortOrder, filters],
    queryFn: async () => {
      const r = await productMasterApi.getAll({
        skip, limit: PAGE_SIZE, search: debouncedSearch || undefined,
        sort_by: sortBy, sort_order: sortOrder,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });
      return r.data as ProductMasterListResponse;
    },
  });

  const { data: filterOpts } = useQuery<ProductFilterOptions>({
    queryKey: ['product-filter-options'],
    queryFn: async () => (await productMasterApi.getFilterOptions()).data as ProductFilterOptions,
    staleTime: 60_000,
  });

  const products = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;
  const loading = isLoading || isFetching;

  // ── Mutations ──
  const deleteMut = useMutation({
    mutationFn: (id: number) => productMasterApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product-filter-options'] });
      setDeleteTarget(null);
      showToast('Product deleted', 'success');
    },
    onError: () => showToast('Failed to delete product', 'error'),
  });

  // ── Sort handler ──
  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary-500" /> : <ArrowDown className="w-3.5 h-3.5 text-primary-500" />;
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  /* ═══════════════════════════════════════ RENDER ═══ */
  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>{toast && <Toast {...toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Product Master</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage style master records for products used in procurement and sales.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditProduct(null); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> Upload CSV/Excel
          </button>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU or name…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
            />
            {search && (
              <button onClick={() => { handleSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all
              ${activeFilterCount > 0
                ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full">{activeFilterCount}</span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter dropdowns */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                {[
                  { key: 'collection', label: 'Collection', options: filterOpts?.collections },
                  { key: 'season', label: 'Season', options: filterOpts?.seasons },
                  { key: 'fabric_type', label: 'Fabric Type', options: filterOpts?.fabric_types },
                  { key: 'type', label: 'Type', options: filterOpts?.types },
                ].map(f => (
                  <select
                    key={f.key}
                    value={(filters as any)[f.key] || ''}
                    onChange={e => { setFilters(prev => ({ ...prev, [f.key]: e.target.value || undefined })); setPage(1); }}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  >
                    <option value="">{f.label}: All</option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setFilters({}); setPage(1); }}
                    className="text-sm text-rose-500 hover:text-rose-600 font-medium flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Total count */}
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{total.toLocaleString()} product{total !== 1 ? 's' : ''} found</span>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                {[
                  { key: 'sku', label: 'SKU', w: '120px' },
                  { key: 'name', label: 'Name', w: '' },
                  { key: 'size', label: 'Size', w: '80px' },
                  { key: 'collection', label: 'Collection', w: '120px' },
                  { key: 'type', label: 'Type', w: '120px' },
                  { key: 'season', label: 'Season', w: '100px' },
                  { key: 'fabric_type', label: 'Fabric Type', w: '120px' },
                  { key: 'print', label: 'Print', w: '100px' },
                  { key: 'net_weight', label: 'Net Weight', w: '100px' },
                  { key: 'production_time', label: 'Prod. Time', w: '100px' },
                ].map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    style={{ width: col.w || undefined }}
                    onClick={() => toggleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[90px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(11)].map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg animate-pulse" style={{ animationDelay: `${(i * 11 + j) * 30}ms`, width: j === 1 ? '80%' : '60%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">No products found</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add a product or upload a file to get started.</p>
                  </td>
                </tr>
              ) : (
                products.map((p, idx) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-primary-600 dark:text-primary-400">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.size ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.collection ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.type ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.season ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.fabric_type ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.print ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 text-right tabular-nums">
                      {p.net_weight != null ? `${p.net_weight} g` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 text-right tabular-nums">
                      {p.production_time != null ? `${p.production_time} d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditProduct(p); setShowAddModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-400 hover:text-primary-500 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors
                      ${page === p
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Add / Edit Modal ═══ */}
      <AnimatePresence>
        {showAddModal && (
          <ProductFormModal
            product={editProduct}
            onClose={() => { setShowAddModal(false); setEditProduct(null); }}
            onSuccess={(msg) => {
              qc.invalidateQueries({ queryKey: ['products'] });
              qc.invalidateQueries({ queryKey: ['product-filter-options'] });
              showToast(msg, 'success');
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}
      </AnimatePresence>

      {/* ═══ Import Modal ═══ */}
      <AnimatePresence>
        {showImportModal && (
          <ImportModal
            onClose={() => setShowImportModal(false)}
            onSuccess={(summary) => {
              qc.invalidateQueries({ queryKey: ['products'] });
              qc.invalidateQueries({ queryKey: ['product-filter-options'] });
              showToast(`Imported ${summary.inserted} products, ${summary.skipped} skipped, ${summary.errors.length} errors`, 'success');
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}
      </AnimatePresence>

      {/* ═══ Delete Confirmation ═══ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Product</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Are you sure you want to delete <strong className="text-slate-700 dark:text-slate-200">{deleteTarget.sku}</strong>? This cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMut.mutate(deleteTarget.id)}
                  disabled={deleteMut.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   ADD / EDIT PRODUCT MODAL
   ═══════════════════════════════════════════════════════════ */

const FIELDS: Array<{
  key: string; label: string; type?: string;
  required?: boolean; placeholder?: string; half?: boolean;
}> = [
  { key: 'sku', label: 'SKU', required: true, placeholder: 'e.g. ANT-TS-001' },
  { key: 'name', label: 'Name', required: true, placeholder: 'Product name' },
  { key: 'size', label: 'Size', placeholder: 'e.g. S, M, L, XL', half: true },
  { key: 'collection', label: 'Collection', placeholder: 'e.g. Summer 2026', half: true },
  { key: 'type', label: 'Type', placeholder: 'e.g. T-Shirt, Hoodie', half: true },
  { key: 'season', label: 'Season', placeholder: 'e.g. SS26, AW26', half: true },
  { key: 'fabric_type', label: 'Fabric Type', placeholder: 'e.g. Cotton, Polyester', half: true },
  { key: 'print', label: 'Print', placeholder: 'e.g. Solid, Graphic', half: true },
  { key: 'net_weight', label: 'Net Weight (g)', type: 'number', placeholder: '0.00', half: true },
  { key: 'production_time', label: 'Production Time (days)', type: 'number', placeholder: '0', half: true },
];

function ProductFormModal({
  product,
  onClose,
  onSuccess,
  onError,
}: {
  product: ProductMasterItem | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState<Record<string, any>>(() => {
    if (product) {
      return { ...product };
    }
    return FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as Record<string, any>);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.sku?.toString().trim()) errs.sku = 'SKU is required';
    if (!form.name?.toString().trim()) errs.name = 'Name is required';
    if (form.net_weight !== '' && form.net_weight != null && isNaN(Number(form.net_weight)))
      errs.net_weight = 'Must be a number';
    if (form.production_time !== '' && form.production_time != null && (!Number.isInteger(Number(form.production_time)) || Number(form.production_time) < 0))
      errs.production_time = 'Must be a non-negative integer';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    const payload: Record<string, any> = {};
    for (const f of FIELDS) {
      const val = form[f.key];
      if (val === '' || val == null) {
        if (f.required) payload[f.key] = val;
        else payload[f.key] = null;
      } else if (f.type === 'number') {
        payload[f.key] = Number(val);
      } else {
        payload[f.key] = val.toString().trim();
      }
    }

    try {
      if (isEdit) {
        await productMasterApi.update(product!.id, payload);
        onSuccess('Product updated');
      } else {
        await productMasterApi.create(payload);
        onSuccess('Product created');
      }
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Something went wrong';
      onError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map(f => (
              <div key={f.key} className={f.half ? 'col-span-1' : 'col-span-2'}>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type={f.type || 'text'}
                  value={form[f.key] ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className={`w-full px-3 py-2.5 border rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all
                    ${errors[f.key]
                      ? 'border-rose-300 dark:border-rose-600 focus:ring-rose-500/30'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/30 focus:border-primary-400'}`}
                />
                {errors[f.key] && <p className="text-xs text-rose-500 mt-1">{errors[f.key]}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════
   IMPORT MODAL (CSV / XLSX)
   ═══════════════════════════════════════════════════════════ */

function ImportModal({
  onClose, onSuccess, onError,
}: {
  onClose: () => void;
  onSuccess: (summary: ProductImportSummary) => void;
  onError: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, any>[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ProductImportSummary | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setParseError('');
    setPreview(null);
    setResult(null);

    try {
      const name = f.name.toLowerCase();

      if (name.endsWith('.csv')) {
        const text = await f.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { setParseError('File has no data rows'); return; }
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1, 6).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
        setPreview(rows);
      } else if (name.endsWith('.xlsx')) {
        // Dynamic import for xlsx (client-side)
        const XLSX = (await import('xlsx')) as any;
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
        setPreview(json.slice(0, 5));
      } else {
        setParseError('Unsupported file format. Use .csv or .xlsx');
      }
    } catch {
      setParseError('Failed to parse file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await productMasterApi.import(file);
      const summary = res.data as ProductImportSummary;
      setResult(summary);
      onSuccess(summary);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Import failed';
      onError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Import Products</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Upload area */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all"
          >
            <Upload className="w-8 h-8 mx-auto text-slate-400 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {file ? file.name : 'Click to choose a CSV or Excel file'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Accepted formats: .csv, .xlsx</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {parseError}
            </div>
          )}

          {/* Column requirements */}
          <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
            <strong className="text-slate-600 dark:text-slate-300">Required columns:</strong> Sku, Name &nbsp;|&nbsp;
            <strong className="text-slate-600 dark:text-slate-300">Optional:</strong> Size, Collection, Type, Season, Fabric Type, Print, Net Weight, Production Time
          </div>

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Preview (first {preview.length} rows)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      {Object.keys(preview[0]).map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{String(val ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-2">
              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Import Complete
              </h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{result.inserted}</p>
                  <p className="text-xs text-slate-500">Inserted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-slate-500">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rose-600">{result.errors.length}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto text-xs text-rose-600 dark:text-rose-400 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i}>Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading || !!parseError}
              className="px-5 py-2.5 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              Import Products
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
