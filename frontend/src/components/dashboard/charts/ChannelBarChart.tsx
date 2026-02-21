'use client';

import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];

interface ChannelDataPoint {
  name: string;
  revenue: number;
  orders: number;
}

interface Props {
  data: ChannelDataPoint[];
}

/* Short label for mobile */
function shortLabel(name: string) {
  const map: Record<string, string> = {
    MYNTRA: 'MYN', FLIPKART: 'FK', AMAZON_IN_API: 'AMZ', AMAZON_FLEX: 'AMZ-F',
    SHOPIFY: 'SHOP', AJIO_OMNI: 'AJIO', MEESHO_26: 'MEE', NYKAA_FASHION_NEW: 'NYK',
    FIRSTCRY_NEW: 'FC', TATACLIQ: 'TATA', SNAPDEAL_NEW: 'SD',
  };
  return map[name] ?? name.slice(0, 4);
}

/* Custom tooltip — dark mode aware */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ChannelDataPoint;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
      rounded-xl shadow-lg px-3.5 py-2.5 text-sm pointer-events-none">
      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">{d.name}</p>
      <p className="font-semibold text-slate-900 dark:text-white">₹{d.revenue.toLocaleString('en-IN')}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{d.orders.toLocaleString()} orders</p>
    </div>
  );
}

function ChannelBarChartInner({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-[240px] sm:h-[280px] flex items-center justify-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">No channel data</p>
      </div>
    );
  }

  return (
    <div className="h-[240px] sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            className="text-slate-400 dark:text-slate-500"
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={shortLabel}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            className="text-slate-400 dark:text-slate-500"
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-slate-100 dark:text-slate-800/40' }} />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ChannelBarChartInner);
