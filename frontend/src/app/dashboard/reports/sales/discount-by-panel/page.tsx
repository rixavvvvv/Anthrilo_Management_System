'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PageHeader, LoadingSpinner } from '@/components/ui/Common';

export default function ChannelPerformancePage() {
  const [period, setPeriod] = useState('last_7_days');

  const { data, isLoading } = useQuery({
    queryKey: ['uc-channel-performance', period],
    queryFn: async () => {
      const response = await ucSales.getChannelRevenue(period);
      return response.data;
    },
    staleTime: 120_000,
  });

  const channels = data?.channels || [];

  const columns: Column<any>[] = [
    { key: 'channel', header: 'Channel', width: '25%',
      render: (value) => (
        <span className="px-3 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{value}</span>
      ),
    },
    { key: 'orders', header: 'Total Orders',
      render: (value) => <span className="font-semibold text-gray-900 dark:text-gray-100">{value}</span>,
    },
    { key: 'revenue', header: 'Revenue',
      render: (value) => <span className="text-green-600 dark:text-green-400 font-bold">₹{(value || 0).toFixed(2)}</span>,
    },
    { key: 'percentage', header: 'Revenue Share %',
      render: (value) => <span className="font-bold text-primary-600 dark:text-primary-400">{(value || 0).toFixed(1)}%</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Channel Performance" description="Unicommerce marketplace-wise performance analysis" />

      <div className="card mb-4">
        <div className="flex gap-2">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last_7_days', label: '7 Days' },
            { key: 'last_30_days', label: '30 Days' },
          ].map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-gray-900 dark:text-gray-100">Channel Analysis</h2>
        {isLoading ? (
          <LoadingSpinner message="Fetching channel data..." />
        ) : (
          <DataTable data={channels} columns={columns} emptyMessage="No channel data available" />
        )}
      </div>
    </div>
  );
}
