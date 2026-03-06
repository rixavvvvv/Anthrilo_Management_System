'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/Common';
import AdsDashboard from '@/components/ads/AdsDashboard';
import AdsEntryForm from '@/components/ads/AdsEntryForm';
import AdsImport from '@/components/ads/AdsImport';
import AdsReportTable from '@/components/ads/AdsReportTable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, PenLine, Upload, Table2,
} from 'lucide-react';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { key: 'entry', label: 'Manual Entry', icon: PenLine },
  { key: 'import', label: 'Import CSV', icon: Upload },
  { key: 'report', label: 'Report', icon: Table2 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdsPage() {
  const [tab, setTab] = useState<TabKey>('dashboard');

  const descriptions: Record<TabKey, string> = {
    dashboard: 'Month-to-date advertising performance across all channels',
    entry: 'Record daily advertising data for any channel',
    import: 'Bulk import from CSV with automatic column mapping',
    report: 'Daily advertising performance with filtering and pagination',
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Ads Management" description={descriptions[tab]} />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                active
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}>
              <t.icon className="w-3.5 h-3.5" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'dashboard' && <AdsDashboard />}
          {tab === 'entry' && <AdsEntryForm />}
          {tab === 'import' && <AdsImport />}
          {tab === 'report' && <AdsReportTable />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
