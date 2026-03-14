'use client';

import { Calendar, FileBarChart, Download, Loader2 } from 'lucide-react';

export type ReportType = 'size-wise' | 'item-wise' | 'channel-detailed' | 'channel-summary';
export type DateRangeMode = 'daily' | 'weekly' | 'monthly' | 'custom';

interface Props {
  dateMode: DateRangeMode;
  anchorDate: string;
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  reportType: ReportType;
  loading: boolean;
  onDateModeChange: (v: DateRangeMode) => void;
  onAnchorDateChange: (v: string) => void;
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

const RANGE_OPTIONS: { value: DateRangeMode; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

export default function SalesActivitySelector({
  dateMode, anchorDate, fromDate, toDate, rangeLabel, reportType, loading,
  onDateModeChange, onAnchorDateChange, onFromDateChange, onToDateChange, onReportTypeChange,
  onGenerate, onExport, hasData,
}: Props) {
  const canGenerate = dateMode === 'custom' ? !!fromDate && !!toDate : !!anchorDate;

  return (
    <div className="card">
      <div className="space-y-4">
        {/* Range mode */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Date Range Mode
          </label>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDateModeChange(opt.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  dateMode === opt.value
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Date inputs */}
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {dateMode === 'custom' ? (
              <>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
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
                      min={fromDate || undefined}
                      onChange={(e) => onToDateChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                        bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200
                        focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 min-w-[180px] max-w-[280px]">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Reference Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={anchorDate}
                    onChange={(e) => onAnchorDateChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700
                      bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200
                      focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Effective Range
              </label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300">
                {rangeLabel}
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
              disabled={loading || !canGenerate}
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
    </div>
  );
}
