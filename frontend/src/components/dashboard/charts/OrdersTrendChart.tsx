'use client';

import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: { date: string; fullDate?: string; orders: number; items: number }[];
}

/* Custom tooltip — dark mode aware */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
      rounded-xl shadow-lg px-4 py-3 text-sm pointer-events-none">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1.5">
        {d?.fullDate || label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function OrdersTrendChartInner({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-[220px] sm:h-[240px] flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-[220px] sm:h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/60"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            axisLine={false}
            tickLine={false}
            interval={0}
            dy={4}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-slate-50 dark:text-slate-800/30' }} />
          <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} name="Orders" />
          <Bar dataKey="items" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} name="Items" />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
            formatter={(value: string) => <span className="text-slate-600 dark:text-slate-400 text-xs">{value}</span>}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(OrdersTrendChartInner);
