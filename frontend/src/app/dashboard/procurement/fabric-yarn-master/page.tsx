'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Plus, Upload, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/shared/components';
import { productMasterApi } from '@/features/procurement';
import {
  FabricYarnImportDialog,
} from '@/features/procurement/components/FabricYarnImportDialog';
import {
  FabricYarnMasterForm,
} from '@/features/procurement/components/FabricYarnMasterForm';
import {
  FabricYarnMasterTable,
} from '@/features/procurement/components/FabricYarnMasterTable';
import {
  useCreateFabricYarnMaster,
  useDeleteFabricYarnMaster,
  useFabricYarnMasterFilterOptions,
  useFabricYarnMasterList,
  useImportFabricYarnMaster,
  useUpdateFabricYarnMaster,
} from '@/features/procurement/hooks/useFabricYarnMaster';
import type {
  FabricYarnImportPreviewRow,
  FabricYarnImportSummary,
  FabricYarnMaster,
  FabricYarnMasterCreatePayload,
} from '@/features/procurement/types/fabricYarnMaster.types';

const PAGE_SIZE = 25;

export default function FabricYarnMasterPage() {
  const { success, error } = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fabricTypeFilter, setFabricTypeFilter] = useState<string>('');
  const [printFilter, setPrintFilter] = useState<string>('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FabricYarnMaster | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FabricYarnMaster | null>(null);

  const listParams = useMemo(() => ({
    skip: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    search: search || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    fabric_type: fabricTypeFilter || undefined,
    print: printFilter || undefined,
  }), [fabricTypeFilter, page, printFilter, search, sortBy, sortOrder]);

  const listQuery = useFabricYarnMasterList(listParams);
  const filterQuery = useFabricYarnMasterFilterOptions();
  const productFilterQuery = useQuery({
    queryKey: ['product-filter-options-for-fabric-yarn-master'],
    queryFn: async () => (await productMasterApi.getFilterOptions()).data as { fabric_types?: string[] },
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useCreateFabricYarnMaster();
  const updateMutation = useUpdateFabricYarnMaster();
  const deleteMutation = useDeleteFabricYarnMaster();
  const importMutation = useImportFabricYarnMaster();

  const records = listQuery.data?.items ?? [];
  const fabricTypeOptions = useMemo(
    () => Array.from(new Set([...(productFilterQuery.data?.fabric_types ?? []), ...(filterQuery.data?.fabric_types ?? [])])).sort(),
    [filterQuery.data?.fabric_types, productFilterQuery.data?.fabric_types],
  );

  const submitForm = async (payload: FabricYarnMasterCreatePayload) => {
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, payload });
        success('Fabric & Yarn record updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        success('Fabric & Yarn record added successfully');
      }
      setEditTarget(null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      error(message || 'Failed to save Fabric & Yarn record');
      throw err;
    }
  };

  const submitImport = async (rows: FabricYarnImportPreviewRow[]): Promise<FabricYarnImportSummary> => {
    const validRows = rows.filter((row) => row.__isValid).map((row) => ({
      yarn: row.yarn,
      yarnPercentage: row.yarnPercentage,
      yarnPrice: row.yarnPrice,
      fabricType: row.fabricType,
      print: row.print,
      fabricReadyTime: row.fabricReadyTime,
    }));

    const summary = await importMutation.mutateAsync(validRows);
    success(`Import finished. Imported ${summary.importedRows} rows, failed ${summary.failedRows}.`);
    return summary;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      success('Fabric & Yarn record deleted');
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      error(message || 'Failed to delete record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 p-3 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide uppercase">Procurement / Master</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fabric & Yarn Master</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage yarn composition, pricing, and fabric readiness records.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditTarget(null); setIsFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search yarn, fabric type, print, ready time..."
            className="input flex-1"
          />
          <select
            value={fabricTypeFilter}
            onChange={(event) => { setFabricTypeFilter(event.target.value); setPage(1); }}
            className="input lg:w-52"
          >
            <option value="">Fabric Type: All</option>
            {fabricTypeOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            value={printFilter}
            onChange={(event) => { setPrintFilter(event.target.value); setPage(1); }}
            className="input lg:w-44"
          >
            <option value="">Print: All</option>
            {(filterQuery.data?.prints ?? []).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(event) => {
              const [newSortBy, newSortOrder] = event.target.value.split(':');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder as 'asc' | 'desc');
            }}
            className="input lg:w-52"
          >
            <option value="created_at:desc">Newest First</option>
            <option value="created_at:asc">Oldest First</option>
            <option value="yarn:asc">Yarn A-Z</option>
            <option value="yarn:desc">Yarn Z-A</option>
            <option value="yarn_price:asc">Price Low-High</option>
            <option value="yarn_price:desc">Price High-Low</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>{(listQuery.data?.total ?? 0).toLocaleString()} records found</span>
        {listQuery.isFetching && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
      </div>

      <FabricYarnMasterTable
        records={records}
        isLoading={listQuery.isLoading}
        onEdit={(record) => {
          setEditTarget(record);
          setIsFormOpen(true);
        }}
        onDelete={(record) => setDeleteTarget(record)}
      />

      {(listQuery.data?.total_pages ?? 1) > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Page {page} / {listQuery.data?.total_pages ?? 1}</span>
          <button
            disabled={page >= (listQuery.data?.total_pages ?? 1)}
            onClick={() => setPage((prev) => Math.min(prev + 1, listQuery.data?.total_pages ?? 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <AnimatePresence>
        {isFormOpen && (
          <FabricYarnMasterForm
            open={isFormOpen}
            mode={editTarget ? 'edit' : 'create'}
            initialData={editTarget}
            fabricTypeOptions={fabricTypeOptions}
            printOptions={filterQuery.data?.prints ?? []}
            onClose={() => {
              setIsFormOpen(false);
              setEditTarget(null);
            }}
            onSubmit={submitForm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportOpen && (
          <FabricYarnImportDialog
            open={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onImport={submitImport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Record</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Delete <strong className="text-slate-700 dark:text-slate-200">{deleteTarget.yarn}</strong> from Fabric & Yarn Master?
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors disabled:opacity-50"
                >
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
