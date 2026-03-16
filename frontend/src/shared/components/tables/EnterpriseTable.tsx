'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/utils';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';

// --- Types ---

export type { ColumnDef };

interface EnterpriseTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  isLoading?: boolean;
  /** Show global search input */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Enable CSV export button */
  exportable?: boolean;
  exportFileName?: string;
  /** Empty state message */
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Actions rendered in the toolbar area (right side) */
  toolbarActions?: React.ReactNode;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Show row count / page info */
  showRowCount?: boolean;
  /** Default page size override */
  pageSize?: number;
  /** Compact row height */
  compact?: boolean;
  /** Additional class on the wrapping element */
  className?: string;
}

// --- Component ---

export function EnterpriseTable<TData>({
  data,
  columns,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  exportable = false,
  exportFileName = 'export',
  emptyMessage = 'No data available',
  emptyIcon,
  onRowClick,
  toolbarActions,
  stickyHeader = true,
  showRowCount = true,
  pageSize = DEFAULT_PAGE_SIZE,
  compact = false,
  className,
}: EnterpriseTableProps<TData>) {
  // State
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  // Table instance
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // CSV export handler
  const handleExport = useCallback(() => {
    const headers = columns
      .map((c) => {
        const header = typeof c.header === 'string' ? c.header : String((c as unknown as Record<string, unknown>).accessorKey ?? c.id ?? '');
        return header;
      })
      .filter(Boolean);

    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().map((cell) => {
        const val = cell.getValue();
        if (val == null) return '';
        const str = String(val);
        // Escape commas, quotes, and newlines for CSV safety
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }),
    );

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, exportFileName, table]);

  // Derived values
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const currentPage = pagination.pageIndex + 1;

  // Build the pagination page-number window (1 2 ... 5 6 7 ... 10)
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (pageCount <= 7) {
      for (let i = 1; i <= pageCount; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(pageCount - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < pageCount - 2) pages.push('ellipsis');
      pages.push(pageCount);
    }
    return pages;
  }, [currentPage, pageCount]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('card space-y-3', className)}>
        {/* Skeleton header */}
        <div className="h-10 skeleton w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 skeleton w-full" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  // Main render
  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(searchable || exportable || toolbarActions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {searchable && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="input pl-10"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {toolbarActions}
            {exportable && data.length > 0 && (
              <button onClick={handleExport} className="btn btn-secondary text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {data.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          {emptyIcon && <div className="mb-4 text-slate-300 dark:text-slate-600">{emptyIcon}</div>}
          <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <table className="w-full text-sm">
            <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-slate-50/80 dark:bg-slate-800/60">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        className={cn(
                          'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider',
                          'text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700',
                          canSort && 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors',
                        )}
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            sorted === 'asc' ? <ChevronUp className="w-3 h-3" />
                            : sorted === 'desc' ? <ChevronDown className="w-3 h-3" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'transition-colors duration-100',
                    compact ? 'h-10' : 'h-12',
                    onRowClick
                      ? 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
                      : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          {/* Left: info */}
          <div className="flex items-center gap-3">
            {showRowCount && (
              <span>{totalRows} row{totalRows !== 1 ? 's' : ''}</span>
            )}
            <select
              value={pagination.pageSize}
              onChange={(e) => setPagination((prev) => ({ ...prev, pageSize: Number(e.target.value), pageIndex: 0 }))}
              className="input py-1 px-2 w-auto text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>

          {/* Right: page buttons */}
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {pageNumbers.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => table.setPageIndex(p - 1)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border transition-colors text-xs',
                      p === currentPage
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
