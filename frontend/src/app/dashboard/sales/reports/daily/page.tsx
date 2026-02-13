'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/Common';
import { unicommerceApi } from '@/lib/api';

export default function DailySalesReportPage() {
    const [reportDate, setReportDate] = useState<string>(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0]; // Default to yesterday
    });
    const [showReport, setShowReport] = useState(false);

    // Fetch daily sales report data
    const { data: dailyReportData, isLoading: reportLoading, refetch: refetchReport } = useQuery({
        queryKey: ['daily-sales-report', reportDate],
        queryFn: async () => {
            const response = await unicommerceApi.getDailySalesReport(reportDate);
            return response.data;
        },
        enabled: showReport,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Handler to generate daily sales report
    const handleGenerateReport = () => {
        setShowReport(true);
        refetchReport();
    };

    // Handler to download report as CSV
    const handleDownloadCSV = () => {
        if (!dailyReportData?.report) return;

        // Prepare CSV content
        const headers = ['Channel Name', 'Quantity', 'Selling Price (₹)', 'Orders', 'Avg/Order (₹)'];
        const rows = dailyReportData.report.map((item: any) => [
            item.channel_name,
            item.quantity,
            item.selling_price.toFixed(2),
            item.orders,
            (item.selling_price / item.orders).toFixed(2),
        ]);

        // Add totals row
        if (dailyReportData.totals) {
            rows.push([
                'TOTAL',
                dailyReportData.totals.total_quantity,
                dailyReportData.totals.total_revenue.toFixed(2),
                dailyReportData.totals.total_orders,
                (dailyReportData.totals.total_revenue / dailyReportData.totals.total_orders).toFixed(2),
            ]);
        }

        const csvContent = [
            headers.join(','),
            ...rows.map((row: any[]) => row.join(',')),
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `daily-sales-report-${reportDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Daily Sales Report"
                description="Channel-wise sales breakdown for accurate business insights"
            />

            {/* Report Configuration */}
            <div className="card">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    Generate Report
                </h2>

                <div className="flex flex-wrap items-end gap-4 mb-4">
                    {/* Date Picker */}
                    <div className="flex-1 min-w-[200px]">
                        <label htmlFor="report-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Select Date
                        </label>
                        <input
                            id="report-date"
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerateReport}
                        disabled={reportLoading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
                     transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-lg hover:shadow-xl"
                    >
                        {reportLoading ? '⏳ Generating...' : '📊 Generate Report'}
                    </button>

                    {/* Download Button */}
                    {showReport && dailyReportData?.success && (
                        <button
                            onClick={handleDownloadCSV}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg
                       transition-colors duration-200 shadow-lg hover:shadow-xl"
                        >
                            📥 Download CSV
                        </button>
                    )}
                </div>

                {/* Important Note about Data */}
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📌 About This Report</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <li>• Shows <strong>revenue-generating orders only</strong> (excludes cancelled, returned orders)</li>
                        <li>• Quantity = Total items from <strong>valid orders</strong> per channel</li>
                        <li>• Revenue calculated from <strong>item.sellingPrice × quantity</strong></li>
                        <li>• Data source: Unicommerce <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">saleorder/get</code> API</li>
                    </ul>
                </div>
            </div>

            {/* Loading State */}
            {reportLoading && (
                <div className="card text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Fetching report data...</p>
                </div>
            )}

            {/* Error State */}
            {showReport && dailyReportData && !dailyReportData.success && (
                <div className="card bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800">
                    <p className="text-red-800 dark:text-red-200 text-lg">
                        ❌ <strong>Error:</strong> {dailyReportData.error || 'Failed to generate report'}
                    </p>
                </div>
            )}

            {/* Report Table */}
            {showReport && dailyReportData?.success && dailyReportData.report && (
                <div className="card overflow-hidden">
                    {/* Report Header */}
                    <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    📅 {new Date(reportDate).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                    <span>🏪 {dailyReportData.totals.total_channels} channels</span>
                                    <span>📦 {dailyReportData.totals.total_orders} orders</span>
                                    <span>🔢 {dailyReportData.totals.total_quantity.toLocaleString()} items</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Revenue</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                    ₹{dailyReportData.totals.total_revenue.toLocaleString('en-IN')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Data Accuracy Note */}
                    {dailyReportData.note && dailyReportData.totals.excluded_items > 0 && (
                        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ℹ️ <strong>Data Accuracy:</strong> {dailyReportData.note}
                            </p>
                        </div>
                    )}

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Channel Name
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Quantity
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Selling Price (₹)
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Orders
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Avg/Order (₹)
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {dailyReportData.report.map((row: any, index: number) => (
                                    <tr
                                        key={row.channel_name}
                                        className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-850'
                                            }`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {row.channel_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-gray-900 dark:text-white font-semibold">
                                                {row.quantity.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-gray-900 dark:text-white font-semibold">
                                                ₹{row.selling_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {row.orders}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                ₹{(row.selling_price / row.orders).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-850 border-t-2 border-gray-300 dark:border-gray-600">
                                <tr>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                                            🎯 Total
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {dailyReportData.totals.total_quantity.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="text-base font-bold text-green-600 dark:text-green-400">
                                            ₹{dailyReportData.totals.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {dailyReportData.totals.total_orders}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                            ₹{(dailyReportData.totals.total_revenue / dailyReportData.totals.total_orders).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Data Source:</span>
                                <span className="ml-2 text-gray-600 dark:text-gray-400">{dailyReportData.data_source}</span>
                                {dailyReportData.cached && (
                                    <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                                        ✓ Cached
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Currency:</span>
                                <span className="ml-2 text-gray-600 dark:text-gray-400">{dailyReportData.currency}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Report Type:</span>
                                <span className="ml-2 text-gray-600 dark:text-gray-400">Channel-wise Breakdown</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
