/**
 * Panel-Wise Analytics Dashboard
 * ================================
 * Modern, accurate dashboard using TWO-PHASE Unicommerce API approach
 * 
 * DATA ARCHITECTURE:
 * ------------------
 * Phase 1 (saleOrder/search): Order codes, status, counts
 * Phase 2 (saleorder/get): Revenue data from item.sellingPrice
 * 
 * CRITICAL RULE:
 * Revenue = SUM of item.sellingPrice from Phase 2 ONLY
 * 
 * This dashboard provides:
 * - Real-time KPIs across multiple time periods
 * - Channel-wise revenue breakdown with graphs
 * - Order status analytics with donut chart
 * - API performance metrics
 * - Accurate revenue calculations
 */

'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/Common';
import {
  useTodaySales,
  useYesterdaySales,
  useLast7DaysSales,
  useLast30DaysSales,
} from '@/lib/hooks/useUnicommerce';
import {
  KPICard,
  RevenuePanel,
  ChannelBreakdownPanel,
  StatusBreakdownPanel,
  FetchInfoPanel,
  LoadingPanel,
  ErrorPanel,
} from '@/components/panels/DashboardPanels';
import {
  BarChart,
  DonutChart,
  ComparisonCard,
  MetricCard,
} from '@/components/panels/Charts';

type Period = 'today' | 'yesterday' | 'last7' | 'last30';

export default function PanelsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('today');

  // Fetch data ONLY for the selected period (PERFORMANCE FIX)
  const todayData = useTodaySales(selectedPeriod === 'today');
  const yesterdayData = useYesterdaySales(selectedPeriod === 'yesterday');
  const last7Data = useLast7DaysSales(selectedPeriod === 'last7');
  const last30Data = useLast30DaysSales(selectedPeriod === 'last30');

  // Select current period data
  const currentData = {
    today: todayData,
    yesterday: yesterdayData,
    last7: last7Data,
    last30: last30Data,
  }[selectedPeriod];

  const periodLabels = {
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 Days',
    last30: 'Last 30 Days',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Sales Analytics Dashboard"
        description="Panel-wise sales analytics with accurate revenue tracking using two-phase API"
      />

      {/* Period Selector */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(periodLabels) as Period[]).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`
                px-6 py-3 rounded-lg font-medium transition-all duration-200
                ${selectedPeriod === period
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {periodLabels[period]}
            </button>
          ))}
        </div>
      </div>

      {/* Error Handling */}
      {currentData.error && (
        <ErrorPanel message={currentData.error} />
      )}

      {/* Overview KPIs - Phase 1 & Phase 2 Data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard
          title="Total Orders"
          value={currentData.data?.summary.total_orders.toLocaleString() || '0'}
          subtitle={`${currentData.data?.summary.valid_orders || 0} valid orders`}
          icon="📦"
          color="blue"
          loading={currentData.loading}
          dataSource="phase1"
        />

        <KPICard
          title="Total Revenue"
          value={`₹${(currentData.data?.summary.total_revenue || 0).toLocaleString('en-IN')}`}
          subtitle="From sellingPrice"
          icon="💰"
          color="green"
          loading={currentData.loading}
          dataSource="phase2"
        />

        <KPICard
          title="Avg Order Value"
          value={`₹${(currentData.data?.summary.avg_order_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtitle="Per valid order"
          icon="📊"
          color="purple"
          loading={currentData.loading}
          dataSource="phase2"
        />

        <KPICard
          title="Excluded Orders"
          value={currentData.data?.summary.excluded_orders.toLocaleString() || '0'}
          subtitle="Cancelled, Returned, etc."
          icon="❌"
          color="red"
          loading={currentData.loading}
          dataSource="phase1"
        />
      </div>

      {/* Revenue Deep Dive - Phase 2 Only */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {currentData.loading ? (
            <LoadingPanel />
          ) : (
            <RevenuePanel
              title={`${periodLabels[selectedPeriod]} Revenue Breakdown`}
              revenue={currentData.data?.summary.total_revenue || 0}
              orders={currentData.data?.summary.valid_orders || 0}
              averageOrderValue={currentData.data?.summary.avg_order_value || 0}
              loading={currentData.loading}
            />
          )}
        </div>

        <div>
          {currentData.loading ? (
            <LoadingPanel />
          ) : (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Revenue Components
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Gross Revenue</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₹{(currentData.data?.summary.total_revenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Discounts</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    -₹{(currentData.data?.summary.total_discount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Tax</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₹{(currentData.data?.summary.total_tax || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Net Revenue</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      ₹{(currentData.data?.summary.total_revenue || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Currency: {currentData.data?.summary.currency || 'INR'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Method: {currentData.data?.summary.calculation_method || 'sellingPrice_only'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Channel Revenue Visualization - Bar Chart */}
      <div className="grid grid-cols-1 gap-6">
        {currentData.loading ? (
          <LoadingPanel />
        ) : (
          <BarChart
            data={Object.entries(currentData.data?.summary.channel_breakdown || {}).map(([channel, data]) => ({
              label: channel,
              value: data.revenue,
              color: getChannelColor(channel),
            }))}
            title={`Channel-Wise Revenue Comparison - ${periodLabels[selectedPeriod]}`}
            valuePrefix="₹"
            height="350px"
          />
        )}
      </div>

      {/* Channel & Status Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Details Panel */}
        <ChannelBreakdownPanel
          channels={currentData.data?.summary.channel_breakdown || {}}
          loading={currentData.loading}
        />

        {/* Status Distribution - Donut Chart */}
        {currentData.loading ? (
          <LoadingPanel />
        ) : (
          <DonutChart
            data={Object.entries(currentData.data?.summary.status_breakdown || {}).map(([status, count]) => ({
              label: status,
              value: count,
              color: getStatusColor(status),
            }))}
            title="Order Status Distribution"
            centerLabel="Total Orders"
            centerValue={currentData.data?.summary.total_orders.toLocaleString()}
          />
        )}
      </div>

      {/* API Performance Metrics */}
      {currentData.data?.fetch_info && (
        <FetchInfoPanel
          fetchInfo={currentData.data.fetch_info}
          loading={currentData.loading}
        />
      )}
    </div>
  );
}

// Helper function to get channel colors
function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    'AMAZON': 'bg-gradient-to-r from-orange-400 to-orange-600',
    'FLIPKART': 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    'MYNTRA': 'bg-gradient-to-r from-pink-400 to-pink-600',
    'AJIO': 'bg-gradient-to-r from-purple-400 to-purple-600',
    'MEESHO': 'bg-gradient-to-r from-red-400 to-red-600',
    'NYKAA': 'bg-gradient-to-r from-rose-400 to-rose-600',
    'SHOPIFY': 'bg-gradient-to-r from-green-400 to-green-600',
  };
  return colors[channel.toUpperCase()] || 'bg-gradient-to-r from-blue-400 to-blue-600';
}

// Helper function to get status colors
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'COMPLETE': '#10b981',
    'COMPLETED': '#10b981',
    'DELIVERED': '#059669',
    'SHIPPED': '#3b82f6',
    'PROCESSING': '#8b5cf6',
    'PENDING': '#f59e0b',
    'CREATED': '#06b6d4',
    'APPROVED': '#10b981',
    'CANCELLED': '#ef4444',
    'CANCELED': '#ef4444',
    'RETURNED': '#f97316',
    'REFUNDED': '#dc2626',
  };
  return colors[status.toUpperCase()] || '#6b7280';
}
