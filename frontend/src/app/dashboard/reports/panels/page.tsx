'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui/Common';
import Link from 'next/link';

export default function PanelReportsPage() {
    const [period, setPeriod] = useState('last_7_days');

    const { data, isLoading, error } = useQuery({
        queryKey: ['uc-channel-revenue', period],
        queryFn: async () => {
            const response = await ucSales.getChannelRevenue(period);
            return response.data;
        },
        staleTime: 120_000,
    });

    const channels = (data?.channels || []).map((ch: any) => ({
        ...ch,
        avg_order_value: ch.orders > 0 ? (ch.revenue || 0) / ch.orders : 0,
    }));

    const totalRevenue = data?.total_revenue || 0;
    const totalOrders = data?.total_orders || 0;
    const totalItems = data?.total_items || 0;

    const columns: Column<any>[] = [
        {
            key: 'channel', header: 'Channel', width: '22%',
            render: (value) => (
                <span className="px-3 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{value}</span>
            ),
        },
        {
            key: 'orders', header: 'Orders', width: '12%',
            render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{(value || 0).toLocaleString()}</span>,
        },
        {
            key: 'revenue', header: 'Revenue', width: '18%',
            render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>,
        },
        {
            key: 'percentage', header: 'Revenue Share', width: '14%',
            render: (value) => (
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${Math.min(value || 0, 100)}%` }} />
                    </div>
                    <span className="font-bold text-primary-600 dark:text-primary-400 text-sm">{(value || 0).toFixed(1)}%</span>
                </div>
            ),
        },
        {
            key: 'avg_order_value', header: 'Avg Order Value', width: '15%',
            render: (value) => <span className="text-slate-700 dark:text-slate-300">₹{(value || 0).toFixed(0)}</span>,
        },
    ];

    const periodLabels: Record<string, string> = {
        today: 'Today',
        yesterday: 'Yesterday',
        last_7_days: 'Last 7 Days',
        last_30_days: 'Last 30 Days',
    };

    return (
        <div className="space-y-6">
            <PageHeader title="Panel / Channel Reports" description="Channel-wise sales performance from Anthrilo" />

            {/* Quick Links */}
            <div className="flex gap-3">
                <Link href="/dashboard/reports/panels/settlement"
                    className="btn btn-secondary text-sm flex items-center gap-2 hover:shadow-md transition-all">
                    💵 Settlement Report
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(1)}K`} icon="💰" color="green" />
                <StatCard title="Total Orders" value={totalOrders.toLocaleString()} icon="📦" color="blue" />
                <StatCard title="Active Channels" value={channels.length.toString()} icon="🏪" color="purple" />
                <StatCard title="Avg Order Value" value={totalOrders > 0 ? `₹${(totalRevenue / totalOrders).toFixed(0)}` : '—'} icon="📊" color="yellow" />
            </div>

            {/* Period Selector */}
            <div className="card">
                <div className="flex gap-2">
                    {[
                        { key: 'today', label: 'Today' },
                        { key: 'yesterday', label: 'Yesterday' },
                        { key: 'last_7_days', label: '7 Days' },
                        { key: 'last_30_days', label: '30 Days' },
                    ].map((p) => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card bg-rose-50 dark:bg-rose-900/20">
                    <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load channel data'}</p>
                </div>
            )}

            {/* Channel Table */}
            <div className="card">
                <h2 className="mb-4 text-gray-900 dark:text-gray-100">Channel Performance — {periodLabels[period] || period}</h2>
                {isLoading ? (
                    <LoadingSpinner message="Fetching channel data from Anthrilo..." />
                ) : (
                    <DataTable data={channels} columns={columns} emptyMessage="No channel data available for this period." />
                )}
            </div>
        </div>
    );
}
