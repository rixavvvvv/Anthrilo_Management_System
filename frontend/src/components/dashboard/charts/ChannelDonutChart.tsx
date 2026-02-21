'use client';

import { memo } from 'react';
import {
  PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];

interface DonutDataPoint {
  name: string;
  value: number;
}

interface Props {
  data: DonutDataPoint[];
}

/* Custom tooltip — dark mode aware, shows name + orders + percentage */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
      rounded-xl shadow-lg px-3.5 py-2.5 text-sm pointer-events-none min-w-[130px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.payload.fill }} />
        <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{d.name}</span>
      </div>
      <p className="font-semibold text-slate-900 dark:text-white">{d.value.toLocaleString()} orders</p>
      {d.payload.percent != null && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{(d.payload.percent * 100).toFixed(1)}%</p>
      )}
    </div>
  );
}

function ChannelDonutChartInner({ data }: Props) {
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
        <RPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="45%"
            outerRadius="72%"
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value: string) => <span className="text-slate-600 dark:text-slate-400 text-[11px]">{value}</span>}
          />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ChannelDonutChartInner);
