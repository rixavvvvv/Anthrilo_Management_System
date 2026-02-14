'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { PageHeader, StatCard, LoadingSpinner } from '@/components/ui/Common';

export default function CodVsPrepaidPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const { data, isLoading, error } = useQuery({
        queryKey: ['cod-vs-prepaid', month, year],
        queryFn: async () => {
            const response = await ucSales.getCodVsPrepaid({ month, year });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const cod = data?.cod || {};
    const prepaid = data?.prepaid || {};
    const totalOrders = data?.total_orders || 0;
    const totalRevenue = data?.total_revenue || 0;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const codPct = cod.percentage || 0;
    const prepaidPct = prepaid.percentage || 0;

    return (
        <div className="space-y-6">
            <PageHeader title="COD vs Prepaid Analysis" description="Monthly payment method breakdown from Unicommerce" />

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
                </div>
            </div>

            {error && (
                <div className="card bg-rose-50 dark:bg-rose-900/20">
                    <p className="text-rose-600 dark:text-rose-400">Error: {(error as any)?.message || 'Failed to load data'}</p>
                </div>
            )}

            {isLoading ? (
                <div className="card"><LoadingSpinner message="Fetching payment data..." /></div>
            ) : data?.success ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatCard title="Total Orders" value={totalOrders} icon="🛒" color="blue" />
                        <StatCard title="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(1)}K`} icon="💰" color="green" />
                        <StatCard title="COD Orders" value={`${cod.orders || 0} (${codPct}%)`} icon="💵" color="yellow" />
                        <StatCard title="Prepaid Orders" value={`${prepaid.orders || 0} (${prepaidPct}%)`} icon="💳" color="purple" />
                    </div>

                    {/* Visual Comparison */}
                    <div className="card">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
                            {monthNames[month - 1]} {year} — Payment Breakdown
                        </h2>

                        {/* Bar Chart */}
                        <div className="space-y-6">
                            {/* Orders Bar */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Orders Distribution</h3>
                                <div className="flex h-10 rounded-xl overflow-hidden shadow-inner">
                                    <div className="bg-amber-500 flex items-center justify-center text-white text-sm font-bold transition-all"
                                        style={{ width: `${codPct}%` }}>
                                        {codPct > 10 ? `COD ${codPct}%` : ''}
                                    </div>
                                    <div className="bg-emerald-500 flex items-center justify-center text-white text-sm font-bold transition-all"
                                        style={{ width: `${prepaidPct}%` }}>
                                        {prepaidPct > 10 ? `Prepaid ${prepaidPct}%` : ''}
                                    </div>
                                </div>
                            </div>

                            {/* Revenue Bar */}
                            <div>
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Revenue Distribution</h3>
                                {(() => {
                                    const codRevPct = totalRevenue > 0 ? ((cod.revenue || 0) / totalRevenue * 100) : 0;
                                    const prepaidRevPct = totalRevenue > 0 ? ((prepaid.revenue || 0) / totalRevenue * 100) : 0;
                                    return (
                                        <div className="flex h-10 rounded-xl overflow-hidden shadow-inner">
                                            <div className="bg-amber-400 flex items-center justify-center text-white text-sm font-bold transition-all"
                                                style={{ width: `${codRevPct}%` }}>
                                                {codRevPct > 10 ? `₹${((cod.revenue || 0) / 1000).toFixed(0)}K` : ''}
                                            </div>
                                            <div className="bg-emerald-400 flex items-center justify-center text-white text-sm font-bold transition-all"
                                                style={{ width: `${prepaidRevPct}%` }}>
                                                {prepaidRevPct > 10 ? `₹${((prepaid.revenue || 0) / 1000).toFixed(0)}K` : ''}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Detail Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                            {/* COD Card */}
                            <div className="p-6 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-3xl">💵</span>
                                    <h3 className="text-xl font-bold text-amber-800 dark:text-amber-200">Cash on Delivery</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-amber-700 dark:text-amber-300">Orders</span>
                                        <span className="font-bold text-amber-900 dark:text-amber-100">{(cod.orders || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700 dark:text-amber-300">Revenue</span>
                                        <span className="font-bold text-amber-900 dark:text-amber-100">₹{(cod.revenue || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700 dark:text-amber-300">Avg Order Value</span>
                                        <span className="font-bold text-amber-900 dark:text-amber-100">₹{(cod.avg_order_value || 0).toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-amber-700 dark:text-amber-300">Share</span>
                                        <span className="font-bold text-amber-900 dark:text-amber-100">{codPct}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Prepaid Card */}
                            <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-3xl">💳</span>
                                    <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">Prepaid</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-emerald-700 dark:text-emerald-300">Orders</span>
                                        <span className="font-bold text-emerald-900 dark:text-emerald-100">{(prepaid.orders || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-emerald-700 dark:text-emerald-300">Revenue</span>
                                        <span className="font-bold text-emerald-900 dark:text-emerald-100">₹{(prepaid.revenue || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-emerald-700 dark:text-emerald-300">Avg Order Value</span>
                                        <span className="font-bold text-emerald-900 dark:text-emerald-100">₹{(prepaid.avg_order_value || 0).toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-emerald-700 dark:text-emerald-300">Share</span>
                                        <span className="font-bold text-emerald-900 dark:text-emerald-100">{prepaidPct}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Channel Breakdown */}
                        {data.channels?.length > 0 && (
                            <div className="mt-8">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Channel-wise Breakdown</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-50 dark:bg-gray-800">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Channel</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">COD Orders</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">COD Revenue</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Prepaid Orders</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Prepaid Revenue</th>
                                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {data.channels.map((ch: any) => (
                                                <tr key={ch.channel} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{ch.channel}</td>
                                                    <td className="px-6 py-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{ch.cod_orders}</td>
                                                    <td className="px-6 py-3 text-right text-amber-600 dark:text-amber-400">₹{(ch.cod_revenue || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{ch.prepaid_orders}</td>
                                                    <td className="px-6 py-3 text-right text-emerald-600 dark:text-emerald-400">₹{(ch.prepaid_revenue || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-6 py-3 text-right font-bold">{ch.cod_orders + ch.prepaid_orders}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
}
