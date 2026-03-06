'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adsApi } from '@/lib/api/ads';
import { DataTable, Column } from '@/components/ui/DataTable';
import { FilterInput, ReportFilters } from '@/components/ui/Filters';
import { LoadingSpinner, EmptyState } from '@/components/ui/Common';
import type { AdsData } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CHANNELS = [
  'Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Ajio',
  'Nykaa', 'Snapdeal', 'JioMart', 'Tata_CLiQ', 'FirstCry',
  'Google_Ads', 'Meta_Ads', 'Other',
];

const fmt = (v: number) => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function AdsReportTable() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['ads', 'list', page, filters],
    queryFn: async () => {
      const res = await adsApi.list({
        page,
        page_size: 50,
        channel: filters.channel || undefined,
        brand: filters.brand || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items || [];
  const totalPages = data?.total_pages || 1;

  const columns: Column<AdsData>[] = [
    { key: 'date', header: 'Date', width: '100px', render: (v: string) => (
      <span className="font-mono text-xs">{v}</span>
    )},
    { key: 'channel', header: 'Channel', render: (v: string) => (
      <span className="font-medium text-slate-800 dark:text-slate-200">{v?.replace(/_/g, ' ')}</span>
    )},
    { key: 'brand', header: 'Brand', render: (v: string) => (
      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{v}</span>
    )},
    { key: 'campaign_name', header: 'Campaign', render: (v: string) => (
      <span className="truncate max-w-[150px] block text-xs text-slate-500 dark:text-slate-400">{v || '—'}</span>
    )},
    { key: 'impressions', header: 'Impressions', render: (v: number) => v?.toLocaleString('en-IN') || '0' },
    { key: 'clicks', header: 'Clicks', render: (v: number) => v?.toLocaleString('en-IN') || '0' },
    { key: 'spend', header: 'Spend', render: (v: number) => fmt(v) },
    { key: 'ads_sale', header: 'Ads Sale', render: (v: number) => (
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmt(v)}</span>
    )},
    { key: 'total_sale', header: 'Total Sale', render: (v: number) => fmt(v) },
    { key: 'acos', header: 'ACOS', render: (v: number | undefined) => (
      <span className={v && v > 50 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
        {v != null ? `${v}%` : '—'}
      </span>
    )},
    { key: 'roas', header: 'ROAS', render: (v: number | undefined) => (
      <span className={v && v >= 3 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
        {v != null ? `${v}x` : '—'}
      </span>
    )},
    { key: 'units_sold', header: 'Units', render: (v: number) => v || '0' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ReportFilters onApplyFilters={(f) => { setFilters(f); setPage(1); }}>
        <FilterInput label="Channel" type="select" value={filters.channel || ''}
          onChange={v => setFilters(prev => ({ ...prev, channel: v }))}
          options={CHANNELS.map(ch => ({ label: ch.replace(/_/g, ' '), value: ch }))} />
        <FilterInput label="Brand" type="select" value={filters.brand || ''}
          onChange={v => setFilters(prev => ({ ...prev, brand: v }))}
          options={[{ label: 'Anthrilo', value: 'Anthrilo' }, { label: 'Other', value: 'Other' }]} />
        <FilterInput label="Start Date" type="date" value={filters.start_date || ''}
          onChange={v => setFilters(prev => ({ ...prev, start_date: v }))} />
        <FilterInput label="End Date" type="date" value={filters.end_date || ''}
          onChange={v => setFilters(prev => ({ ...prev, end_date: v }))} />
      </ReportFilters>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner message="Loading ads data..." />
      ) : items.length === 0 ? (
        <EmptyState title="No ads data found" description="Try adjusting your filters or add new entries." />
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <DataTable data={items} columns={columns} />
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} ({data?.total || 0} entries)
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="btn btn-secondary text-xs flex items-center gap-1 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="btn btn-secondary text-xs flex items-center gap-1 disabled:opacity-40">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
