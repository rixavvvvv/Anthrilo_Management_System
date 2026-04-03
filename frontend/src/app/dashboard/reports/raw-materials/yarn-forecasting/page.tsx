'use client';
 
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rawMaterialsReports } from '@/features/reports';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, ProgressLoader, StatCard, ErrorPanel } from '@/components/ui/Common';
 
export default function YarnForecastingPage() {
  const [forecastDays, setForecastDays] = useState(30);
 
  const { data, isLoading, error } = useQuery({
    queryKey: ['yarn-forecasting', forecastDays],
    queryFn: async () => {
      const response = await rawMaterialsReports.getYarnForecasting({ forecast_days: forecastDays });
      return response.data;
    },
    staleTime: 120_000,
  });
 
  const items: any[] = Array.isArray(data) ? data : [];
 
  // Computed summary stats
  const totalYarnTypes = items.length;
  const criticalCount = items.filter((i) => i.days_until_stockout < 14).length;
  const totalRecommended = items.reduce((sum, i) => sum + (i.recommended_order || 0), 0);
  const avgDaysToStockout =
    items.length > 0
      ? items.reduce((sum, i) => sum + Math.min(i.days_until_stockout, 999), 0) / items.length
      : 0;
 
  // Status helper
  const getStockoutBadge = (days: number) => {
    if (days < 7)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
          Critical
        </span>
      );
    if (days < 14)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
          Low
        </span>
      );
    if (days < 30)
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
          Moderate
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
        Healthy
      </span>
    );
  };
 
  const columns: Column<any>[] = [
    {
      key: 'yarn_type',
      header: 'Yarn Type',
      width: '20%',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    {
      key: 'current_stock',
      header: 'Current Stock',
      width: '13%',
      render: (value) => (
        <span className="font-medium text-gray-800 dark:text-gray-200">{Number(value).toLocaleString()} kg</span>
      ),
    },
    {
      key: 'avg_daily_consumption',
      header: 'Daily Usage',
      width: '12%',
      render: (value) => <span className="text-gray-700 dark:text-gray-300">{Number(value).toFixed(2)} kg</span>,
    },
    {
      key: 'forecasted_demand',
      header: `${forecastDays}d Demand`,
      width: '13%',
      render: (value) => (
        <span className="font-medium text-violet-600 dark:text-violet-400">{Number(value).toLocaleString()} kg</span>
      ),
    },
    {
      key: 'days_until_stockout',
      header: 'Days to Stockout',
      width: '15%',
      render: (value) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {value >= 999 ? '999+' : Math.round(value)}
          </span>
          {getStockoutBadge(value)}
        </div>
      ),
    },
    {
      key: 'recommended_order',
      header: 'Recommended Order',
      width: '15%',
      render: (value) =>
        value > 0 ? (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{Number(value).toLocaleString()} kg</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];
 
  return (
    <div className="page-section-gap">
      <PageHeader
        title="Yarn Demand Forecasting"
        description="AI-driven demand forecasting based on production plans & consumption patterns"
      />
 
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Yarn Types" value={totalYarnTypes} icon="🧶" color="blue" />
        <StatCard
          title="Critical (< 14d)"
          value={criticalCount}
          icon="⚠️"
          color={criticalCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          title="Avg Days to Stockout"
          value={avgDaysToStockout >= 999 ? '999+' : Math.round(avgDaysToStockout).toString()}
          icon="📅"
          color="purple"
        />
        <StatCard
          title="Total Recommended"
          value={`${totalRecommended.toLocaleString()} kg`}
          icon="📦"
          color="green"
        />
      </div>
 
      {/* Forecast Period Selector */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Forecast Period:</span>
          <div className="tab-strip">
            {[
              { key: 7, label: '7 Days' },
              { key: 14, label: '14 Days' },
              { key: 30, label: '30 Days' },
              { key: 60, label: '60 Days' },
              { key: 90, label: '90 Days' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setForecastDays(p.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  forecastDays === p.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
 
      {/* Error */}
      {error && <ErrorPanel message={(error as any)?.message || 'Failed to load forecasting data'} />}
 
      {/* Data Table */}
      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100 text-lg font-semibold">
          Yarn Forecast — {forecastDays} Day Window
        </h2>
        <ProgressLoader loading={isLoading} stages={[
          { at: 0, label: 'Connecting to Unicommerce…' },
          { at: 20, label: 'Fetching sales history…' },
          { at: 50, label: 'Calculating demand forecasts…' },
          { at: 80, label: 'Finalizing…' },
        ]} />
        {!isLoading && (
          <DataTable data={items} columns={columns} emptyMessage="No yarn data available for forecasting." />
        )}
      </div>
    </div>
  );
}
 