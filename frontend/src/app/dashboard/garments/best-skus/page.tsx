'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { unicommerceApi } from '@/lib/api';
import { PageHeader, LoadingSpinner } from '@/components/ui/Common';
import { DataTable, Column } from '@/components/ui/DataTable';

export default function BestSkusPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [limit, setLimit] = useState(25);

    const { data, isLoading, error } = useQuery({
        queryKey: ['best-skus-monthly', month, year, limit],
        queryFn: async () => {
            const response = await unicommerceApi.getBestSkusMonthly({ month, year, limit });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const skus = (data?.skus || []).map((s: any, i: number) => ({ ...s, rank: i + 1 }));

    const columns: Column<any>[] = [
        {
            key: 'rank', header: '#', width: '5%',
            render: (value: any) => <span className="font-bold text-slate-500">{value}</span>,
        },
        {
            key: 'sku', header: 'SKU Code', width: '20%',
            render: (value: string) => <span className="font-mono text-sm font-semibold text-primary-700 dark:text-primary-300">{value}</span>,
        },
        {
            key: 'name', header: 'Product Name', width: '25%',
            render: (value: string) => <span className="text-sm max-w-[200px] truncate block">{value || '-'}</span>,
        },
        {
            key: 'quantity', header: 'Qty Sold', width: '10%',
            render: (value: number) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{value}</span>,
        },
        {
            key: 'revenue', header: 'Revenue (₹)', width: '15%',
            render: (value: number) => <span className="font-semibold text-slate-900 dark:text-slate-100">₹{(value || 0).toLocaleString('en-IN')}</span>,
        },
        {
            key: 'order_count', header: 'Orders', width: '10%',
            render: (value: number) => <span className="font-medium">{value || 0}</span>,
        },
        {
            key: 'avg_price', header: 'Avg Price', width: '12%',
            render: (value: number) => <span className="text-slate-600 dark:text-slate-400">₹{(value || 0).toFixed(0)}</span>,
        },
    ];

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="space-y-6">
            <PageHeader title="Best Performing SKUs" description="Monthly top-selling SKUs from Unicommerce" />

            {/* Controls */}
            <div className="card">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Month</label>
                        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                            className="input w-auto">
                            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year</label>
                        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                            className="input w-auto">
                            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top N</label>
                        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                            className="input w-auto">
                            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card bg-rose-50 dark:bg-rose-900/20">
                    <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load data'}</p>
                </div>
            )}

            {/* Table */}
            <div className="card">
                <h2 className="mb-4 text-slate-900 dark:text-white">
                    Top {limit} SKUs — {monthNames[month - 1]} {year}
                </h2>
                {isLoading ? (
                    <LoadingSpinner message="Fetching monthly sales data..." />
                ) : (
                    <DataTable data={skus} columns={columns} emptyMessage="No sales data found for the selected month." />
                )}
            </div>
        </div>
    );
}
