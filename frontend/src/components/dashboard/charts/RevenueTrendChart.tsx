'use client';

import { memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Props {
  data: { date: string; fullDate?: string; revenue: number }[];
}

/* Premium tooltip — dark mode aware, currency formatted */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
      rounded-xl shadow-lg px-4 py-3 text-sm pointer-events-none">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
        {d.fullDate || label}
      </p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">
        ₹{Number(payload[0].value).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

/* Clean tick formatter — round steps: 0, 1L, 2L or 0, 50K, 100K */
function formatYAxis(v: number): string {
  if (v === 0) return '0';
  if (v >= 100000) return `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 0)}K`;
  return String(v);
}

function RevenueTrendChartInner({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-[220px] sm:h-[260px] flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">No data available</p>
      </div>
    );
  }

  // Compute clean Y-axis domain: start at 0, end at nice round number
  const maxRev = Math.max(...data.map(d => d.revenue));
  const step = maxRev > 500000 ? 100000 : maxRev > 50000 ? 50000 : maxRev > 5000 ? 10000 : 1000;
  const yMax = Math.ceil(maxRev / step) * step;

  return (
    <div className="h-[220px] sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revGradFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
            width={52}
            domain={[0, yMax]}
            tickFormatter={formatYAxis}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#revGradFill)"
            dot={{ r: 4, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 2.5, fill: '#6366f1', stroke: 'white' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(RevenueTrendChartInner);
