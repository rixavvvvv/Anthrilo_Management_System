'use client';

import { useState } from 'react';
import { Calendar, FileBarChart, Download, Loader2 } from 'lucide-react';

export type ReportType = 'size-wise' | 'item-wise' | 'channel-detailed' | 'channel-summary';

interface Props {
  fromDate: string;
  toDate: string;
  reportType: ReportType;
  loading: boolean;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
  onReportTypeChange: (v: ReportType) => void;
  onGenerate: () => void;
  onExport: () => void;
  hasData: boolean;
}

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'size-wise', label: 'Size Wise' },
  { value: 'item-wise', label: 'Item Wise' },
  { value: 'channel-detailed', label: 'Channel Wise (Detailed)' },
  { value: 'channel-summary', label: 'Channel Wise (Summary)' },
];

export default function SalesActivitySelector({
  fromDate, toDate, reportType, loading,
  onFromDateChange, onToDateChange, onReportTypeChange,
  onGenerate, onExport, hasData,
}: Props) {
  return (
    <div className="card">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        {/* Date Range */}
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              From Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                  bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200
                  focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              To Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                  bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200
                  focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Report Type */}
        <div className="min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => onReportTypeChange(e.target.value as ReportType)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200
              focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
          >
            {REPORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={loading || !fromDate || !toDate}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
              bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50
              disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
            Generate
          </button>
          <button
            onClick={onExport}
            disabled={!hasData || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium
              border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
              text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}
