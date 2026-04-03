'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  isLoading,
  emptyMessage = 'No data available',
  onRowClick,
}: DataTableProps<T>) {
  const renderCell = (row: T, column: Column<T>) =>
    column.render ? column.render(row[column.key], row) : row[column.key];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-50 dark:bg-slate-800/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 75}ms` }}></div>
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => (
          <div
            key={rowIndex}
            onClick={() => onRowClick?.(row)}
            className={`rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 ${
              onRowClick ? 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/10' : ''
            }`}
          >
            {columns.map((column) => (
              <div key={column.key} className="flex items-start justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {column.header}
                </span>
                <div className="text-sm text-slate-700 dark:text-slate-300 text-right break-words max-w-[65%]">
                  {renderCell(row, column)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
        <table className="min-w-full">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50">
              {columns.map((column) => (
                <th key={column.key} scope="col"
                  className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: column.width }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} onClick={() => onRowClick?.(row)}
                className={`transition-colors duration-150 ${
                  onRowClick ? 'cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                }`}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
