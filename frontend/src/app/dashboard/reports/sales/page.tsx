'use client';

import { useQuery } from '@tanstack/react-query';
import { unicommerceApi } from '@/lib/api';
import { useState, useMemo } from 'react';

// Simple chart components (no external library needed)
const BarChart = ({ data, label, valueKey, labelKey, color = 'primary' }: {
  data: any[];
  label: string;
  valueKey: string;
  labelKey: string;
  color?: string;
}) => {
  const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const colors: Record<string, string> = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };
  
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      {data.slice(0, 8).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 truncate">{item[labelKey]}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full ${colors[color]} transition-all duration-500`}
              style={{ width: `${Math.max((item[valueKey] / maxValue) * 100, 2)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 text-right">
            ₹{(item[valueKey] / 1000).toFixed(1)}K
          </span>
        </div>
      ))}
    </div>
  );
};

const LineChart = ({ data, label }: { data: any[]; label: string }) => {
  const maxRevenue = Math.max(...data.map(d => d.revenue || 0), 1);
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: 100 - ((d.revenue / maxRevenue) * 80),
    label: d.hour || d.date,
    value: d.revenue
  }));
  
  const pathD = points.length > 1 
    ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';
  
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <div className="relative h-32 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.3" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.3" />
          <line x1="0" y1="80" x2="100" y2="80" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.3" />
          
          {/* Area fill */}
          {points.length > 1 && (
            <path
              d={`${pathD} L 100,100 L 0,100 Z`}
              fill="url(#gradient)"
              opacity="0.3"
            />
          )}
          
          {/* Line */}
          {points.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          
          {/* Dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.5"
              className="fill-primary-500"
            />
          ))}
          
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(99, 102, 241)" />
              <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(99, 102, 241)" />
              <stop offset="100%" stopColor="rgb(168, 85, 247)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

const PieChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  
  const segments = data.map((d, i) => {
    const percentage = total > 0 ? (d.value / total) * 100 : 0;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (startAngle + angle - 90) * Math.PI / 180;
    
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    return {
      ...d,
      percentage,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
    };
  });
  
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  
  return (
    <div className="flex items-center gap-4">
      <svg className="w-32 h-32" viewBox="0 0 100 100">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.path}
            fill={colors[i % colors.length]}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        ))}
        <circle cx="50" cy="50" r="20" className="fill-white dark:fill-gray-900" />
      </svg>
      <div className="flex-1 space-y-1">
        {segments.slice(0, 5).map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{seg.label}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function SalesReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');

  // Calculate dates based on report type
  const dates = useMemo(() => {
    const now = new Date();
    switch (reportType) {
      case 'daily':
        return { from: today, to: today };
      case 'weekly':
        const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        return { from: weekAgo, to: today };
      case 'monthly':
        const monthAgo = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
        return { from: monthAgo, to: today };
      case 'custom':
        return { from: fromDate, to: toDate };
      default:
        return { from: today, to: today };
    }
  }, [reportType, fromDate, toDate, today]);

  // Fetch detailed sales report from Unicommerce
  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['salesReport', dates.from, dates.to],
    queryFn: async () => {
      const response = await unicommerceApi.getSalesReport({
        from_date: dates.from,
        to_date: dates.to
      });
      return response.data;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(2)}`;
  };

  // Prepare chart data
  const channelPieData = useMemo(() => {
    if (!report?.channel_performance) return [];
    return report.channel_performance.map((ch: any, i: number) => ({
      label: ch.channel,
      value: ch.revenue,
      color: ''
    }));
  }, [report]);

  const statusColors: Record<string, string> = {
    'COMPLETE': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'PROCESSING': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'CANCELLED': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'RETURNED': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📊 Sales Analytics Report</h1>
          <p className="text-gray-600 dark:text-gray-400">Real-time sales data from Unicommerce</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-primary flex items-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>🔄</span>
          )}
          Refresh
        </button>
      </div>

      {/* Report Type Selector */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  reportType === type
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {type === 'daily' && '📅 Today'}
                {type === 'weekly' && '📆 Last 7 Days'}
                {type === 'monthly' && '🗓️ Last 30 Days'}
                {type === 'custom' && '⚙️ Custom Range'}
              </button>
            ))}
          </div>

          {reportType === 'custom' && (
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-sm"
              />
            </div>
          )}

          {report?.metadata && (
            <div className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              Fetched in {report.metadata.fetch_time_seconds}s • 
              Sample: {report.metadata.sample_size}/{report.metadata.total_records} orders
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card py-16 text-center">
          <div className="inline-flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <span className="h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-lg">Generating sales report...</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">This may take 2-5 seconds</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold">Failed to load report</p>
              <p className="text-sm">{(error as Error).message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Report Content */}
      {report?.success && !isLoading && (
        <>
          {/* Executive Summary */}
          <div className="card bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-primary-200 dark:border-primary-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span>📈</span> Executive Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {report.executive_summary.total_orders.toLocaleString()}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gross Sales</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {formatCurrency(report.executive_summary.gross_sales)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Net Sales</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {formatCurrency(report.executive_summary.net_sales)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Discounts</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(report.executive_summary.total_discounts)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Returns</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(report.executive_summary.returns_value)}
                  <span className="text-xs text-gray-500 ml-1">({report.executive_summary.returns_count})</span>
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">AOV</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {formatCurrency(report.executive_summary.average_order_value)}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Trend */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                📉 {reportType === 'daily' ? 'Hourly Trend' : 'Daily Trend'}
              </h3>
              <LineChart 
                data={reportType === 'daily' ? report.hourly_trend : report.daily_trend}
                label="Revenue Over Time"
              />
            </div>

            {/* Channel Distribution */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                🏪 Channel Distribution
              </h3>
              {channelPieData.length > 0 ? (
                <PieChart data={channelPieData} />
              ) : (
                <p className="text-gray-500 text-center py-8">No channel data available</p>
              )}
            </div>
          </div>

          {/* Channel Performance Table */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Channel-wise Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Channel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Units</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contribution</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {report.channel_performance?.map((ch: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {ch.channel}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {ch.orders.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {ch.units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(ch.revenue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-primary-500"
                              style={{ width: `${ch.percentage}%` }}
                            />
                          </div>
                          <span className="text-gray-600 dark:text-gray-400">{ch.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Products */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🏆 Top Selling Products
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product Name</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Units Sold</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {report.top_products?.map((product: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-800' :
                          i === 1 ? 'bg-gray-100 text-gray-800' :
                          i === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                        {product.sku}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {product.units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {product.orders.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Status */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                📋 Order Status Breakdown
              </h3>
              <div className="space-y-3">
                {report.status_breakdown?.map((status: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[status.status] || 'bg-gray-100 text-gray-800'}`}>
                        {status.status}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {status.count.toLocaleString()} orders
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(status.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Insights */}
            <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                💡 Key Insights
              </h3>
              <div className="space-y-3">
                {report.executive_summary.total_orders > 0 && (
                  <>
                    <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-green-500">✓</span>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Average order value is <strong>{formatCurrency(report.executive_summary.average_order_value)}</strong>
                      </p>
                    </div>
                    {report.executive_summary.returns_count > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <span className="text-yellow-500">⚠</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Return rate: <strong>{((report.executive_summary.returns_count / report.executive_summary.total_orders) * 100).toFixed(1)}%</strong> 
                          ({report.executive_summary.returns_count} returns)
                        </p>
                      </div>
                    )}
                    {report.channel_performance?.length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <span className="text-blue-500">📊</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Top channel: <strong>{report.channel_performance[0]?.channel}</strong> contributing {report.channel_performance[0]?.percentage}% of revenue
                        </p>
                      </div>
                    )}
                    {report.top_products?.length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <span className="text-purple-500">🏆</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Best seller: <strong>{report.top_products[0]?.name?.substring(0, 30)}</strong> with {report.top_products[0]?.units} units
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📝 Recent Transactions
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Channel</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {report.transactions?.slice(0, 20).map((txn: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                        {txn.order_code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {txn.channel}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[txn.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                        {txn.items_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(txn.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {txn.created ? new Date(txn.created).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Report Metadata */}
          <div className="card bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Report Period:</span>{' '}
                {new Date(report.period.from_date).toLocaleDateString()} - {new Date(report.period.to_date).toLocaleDateString()}
                {' '}({report.period.days} day{report.period.days > 1 ? 's' : ''})
              </div>
              <div className="flex items-center gap-4">
                <span>
                  <span className="font-medium">Generated:</span>{' '}
                  {new Date(report.metadata.generated_at).toLocaleString()}
                </span>
                <span>
                  <span className="font-medium">Data Source:</span> Unicommerce OMS
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Data State */}
      {report && !report.success && !isLoading && (
        <div className="card py-16 text-center">
          <span className="text-6xl mb-4 block">📭</span>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Sales Data Available</h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {report.message || 'Unable to fetch sales data. Please check your Unicommerce connection.'}
          </p>
        </div>
      )}
    </div>
  );
}
