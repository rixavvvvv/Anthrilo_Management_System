'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ucSales } from '@/lib/api/uc';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Download, BarChart3, TrendingUp, TrendingDown,
  ArrowUpDown, ArrowUp, ArrowDown, Search, Sparkles, Flame,
  Layers, FileText, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parse, lastDayOfMonth } from 'date-fns';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

/* ── helpers ─────────────────────────────────────────────────────────── */
const fmt = (v: number) =>
  v >= 10_000_000 ? `₹${(v / 10_000_000).toFixed(2)}Cr`
    : v >= 100_000 ? `₹${(v / 100_000).toFixed(1)}L`
      : v >= 1_000 ? `₹${(v / 1_000).toFixed(1)}K`
        : `₹${v.toLocaleString('en-IN')}`;

const fmtFull = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const channelLabel = (c: string) =>
  c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/ New$/, '').replace(/ Api$/, '').replace(/ 26$/, '');

const CHANNEL_META: Record<string, { color: string; icon: string }> = {
  MYNTRA: { color: '#EC4899', icon: 'M' },
  FIRSTCRY_NEW: { color: '#F97316', icon: 'FC' },
  AMAZON_FLEX: { color: '#F59E0B', icon: 'AZ' },
  AMAZON_IN_API: { color: '#EAB308', icon: 'AZ' },
  SHOPIFY: { color: '#22C55E', icon: 'SH' },
  NYKAA_FASHION_NEW: { color: '#A855F7', icon: 'NK' },
  AJIO_OMNI: { color: '#3B82F6', icon: 'AJ' },
  MEESHO_26: { color: '#14B8A6', icon: 'ME' },
  FLIPKART: { color: '#6366F1', icon: 'FK' },
  TATACLIQ: { color: '#8B5CF6', icon: 'TC' },
  SNAPDEAL_NEW: { color: '#EF4444', icon: 'SD' },
};
const fallbackMeta = { color: '#64748B', icon: '?' };
const getMeta = (ch: string) => CHANNEL_META[ch] || fallbackMeta;

const PIE_COLORS = ['#EC4899', '#F97316', '#22C55E', '#3B82F6', '#A855F7', '#14B8A6', '#F59E0B', '#6366F1', '#EF4444', '#8B5CF6', '#64748B'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ITEMS_PER_PAGE = 50;

type ReportMode = 'daily' | 'monthly' | 'custom';
type SortKey = 'channel_name' | 'quantity' | 'selling_price' | 'orders' | 'avg' | 'pct';
type ItemSortKey = 'item_sku_code' | 'item_type_name' | 'channel_name' | 'selling_price' | 'size';
type SortDir = 'asc' | 'desc';

/* ── animated counter ────────────────────────────────────────────────── */
function AnimatedNumber({ value, prefix = '', duration = 800 }: { value: number; prefix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = value - start;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = value;
  }, [value, duration]);

  return <>{prefix}{display.toLocaleString('en-IN')}</>;
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function DailySalesReportPage() {
  const [mode, setMode] = useState<ReportMode>('daily');

  const [reportDate, setReportDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [calFromOpen, setCalFromOpen] = useState(false);
  const [calToOpen, setCalToOpen] = useState(false);
  const calFromRef = useRef<HTMLDivElement>(null);
  const calToRef = useRef<HTMLDivElement>(null);

  const [showReport, setShowReport] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('selling_price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [itemSearch, setItemSearch] = useState('');
  const [itemSortKey, setItemSortKey] = useState<ItemSortKey>('channel_name');
  const [itemSortDir, setItemSortDir] = useState<SortDir>('asc');
  const [itemPage, setItemPage] = useState(1);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
      if (calFromRef.current && !calFromRef.current.contains(e.target as Node)) setCalFromOpen(false);
      if (calToRef.current && !calToRef.current.contains(e.target as Node)) setCalToOpen(false);
    };
    if (calOpen || calFromOpen || calToOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpen, calFromOpen, calToOpen]);

  const queryParams = useMemo(() => {
    if (mode === 'daily') {
      return { date: reportDate };
    } else if (mode === 'monthly') {
      const first = new Date(selectedYear, selectedMonth, 1);
      const last = lastDayOfMonth(first);
      return { from_date: format(first, 'yyyy-MM-dd'), to_date: format(last, 'yyyy-MM-dd') };
    } else {
      return { from_date: customFrom, to_date: customTo };
    }
  }, [mode, reportDate, selectedMonth, selectedYear, customFrom, customTo]);

  const queryKey = useMemo(() => ['sales-report', mode, ...Object.values(queryParams)], [mode, queryParams]);

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await ucSales.getDailySalesReport(queryParams);
      return res.data;
    },
    enabled: showReport,
    staleTime: 15 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 30 * 60_000,
  });

  const handleGenerate = useCallback(() => { setShowReport(true); refetch(); }, [refetch]);

  /* ── Estimated loading progress ─────────────────────────────────── */
  const [loadProgress, setLoadProgress] = useState(0);
  useEffect(() => {
    if (!isLoading) { setLoadProgress(0); return; }
    // Estimate total time based on date range
    let totalDays = 1;
    if (mode === 'monthly') {
      totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    } else if (mode === 'custom') {
      const d0 = new Date(customFrom);
      const d1 = new Date(customTo);
      totalDays = Math.max(1, Math.ceil((d1.getTime() - d0.getTime()) / 86400000) + 1);
    }
    const chunks = Math.ceil(totalDays / 15);
    // ~10s per chunk, minimum 12s for single-day
    const estimatedMs = Math.max(12000, chunks * 10000);
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      // Asymptotic curve: reaches ~95% at estimated time, never 100% until done
      const pct = Math.min(95, (elapsed / estimatedMs) * 90 + (elapsed > estimatedMs ? 5 * (1 - Math.exp(-(elapsed - estimatedMs) / 30000)) : 0));
      setLoadProgress(Math.round(pct));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isLoading, mode, customFrom, customTo, selectedMonth, selectedYear]);

  /* ── CSV download (item-level + channel summary + comparison on right side) */
  const handleCSV = useCallback(() => {
    if (!raw) return;
    const items = raw.items || [];
    const report = raw.report || [];
    const comparison = raw.comparison;

    // Build channel summary rows for current date
    const chRows: string[][] = [];
    chRows.push([`${raw.date || ''}`, '', '', '']);
    chRows.push(['Channel', 'N QTY', 'Selling Price', 'AVG']);
    for (const r of report) {
      const avg = r.quantity > 0 ? (r.selling_price / r.quantity).toFixed(2) : '0';
      chRows.push([r.channel_name, String(r.quantity), r.selling_price.toFixed(2), avg]);
    }
    if (raw.totals) {
      const t = raw.totals;
      const avgT = t.total_quantity > 0 ? (t.total_revenue / t.total_quantity).toFixed(2) : '0';
      chRows.push([`TOTAL`, String(t.total_quantity), t.total_revenue.toFixed(2), avgT]);
    }

    // Build comparison rows
    const compRows: string[][] = [];
    if (comparison) {
      compRows.push([`${comparison.date || ''}`, '', '', '']);
      compRows.push(['Channel', 'N QTY', 'Selling Price', 'AVG']);
      for (const r of (comparison.report || [])) {
        const avg = r.quantity > 0 ? (r.selling_price / r.quantity).toFixed(2) : '0';
        compRows.push([r.channel_name, String(r.quantity), r.selling_price.toFixed(2), avg]);
      }
      if (comparison.totals) {
        const ct = comparison.totals;
        const avgT = ct.total_quantity > 0 ? (ct.total_revenue / ct.total_quantity).toFixed(2) : '0';
        compRows.push(['TOTAL', String(ct.total_quantity), ct.total_revenue.toFixed(2), avgT]);
      }
    }

    // Combine: item columns on left, spacer, channel summaries on right
    const maxRows = Math.max(items.length, chRows.length, compRows.length);
    const lines: string[] = [];

    // Header row: item cols + spacer + summary headers are in chRows row 0/1
    const hdrParts = ['Item SKU Code', 'Item Type Name', 'Size', 'Channel Name', 'Selling Price', ''];
    if (chRows.length > 0) hdrParts.push(...chRows[0]);
    else hdrParts.push('', '', '', '');
    if (comparison) {
      hdrParts.push('');
      if (compRows.length > 0) hdrParts.push(...compRows[0]);
      else hdrParts.push('', '', '', '');
    }
    lines.push(hdrParts.join(','));

    // Sub-header row (Channel/N QTY/Selling Price/AVG)
    const subParts = ['', '', '', '', '', ''];
    if (chRows.length > 1) subParts.push(...chRows[1]);
    else subParts.push('', '', '', '');
    if (comparison) {
      subParts.push('');
      if (compRows.length > 1) subParts.push(...compRows[1]);
      else subParts.push('', '', '', '');
    }
    lines.push(subParts.join(','));

    for (let i = 0; i < maxRows; i++) {
      const parts: string[] = [];

      // Left: item detail
      if (i < items.length) {
        const it = items[i];
        const name = (it.item_type_name || '').replace(/,/g, ' ');
        const size = (it.size || '').replace(/,/g, ' ');
        parts.push(it.item_sku_code, name, size, it.channel_name, String(it.selling_price));
      } else {
        parts.push('', '', '', '', '');
      }

      // Spacer column
      parts.push('');

      // Right: channel summary (current date) — skip first 2 rows (date header + column header already emitted)
      const chIdx = i + 2;
      if (chIdx < chRows.length) {
        parts.push(...chRows[chIdx]);
      } else {
        parts.push('', '', '', '');
      }

      // Right: comparison
      if (comparison) {
        parts.push(''); // spacer between summaries
        const compIdx = i + 2;
        if (compIdx < compRows.length) {
          parts.push(...compRows[compIdx]);
        } else {
          parts.push('', '', '', '');
        }
      }

      lines.push(parts.join(','));
    }

    const csv = lines.join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    const filename = mode === 'daily' ? `channel-wise-sales-report-${reportDate}.csv`
      : mode === 'monthly' ? `channel-wise-sales-report-${MONTHS[selectedMonth]}-${selectedYear}.csv`
        : `channel-wise-sales-report-${customFrom}-to-${customTo}.csv`;
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [raw, mode, reportDate, selectedMonth, selectedYear, customFrom, customTo]);

  /* ── derived data ──────────────────────────────────────────────────── */
  const totals = raw?.totals;
  const totalRev = totals?.total_revenue || 1;
  const items: any[] = raw?.items || [];

  const enriched = useMemo(() => {
    if (!raw?.report) return [];
    return raw.report.map((r: any) => ({
      ...r,
      label: channelLabel(r.channel_name),
      avg: r.orders > 0 ? r.selling_price / r.orders : 0,
      pct: (r.selling_price / totalRev) * 100,
      meta: getMeta(r.channel_name),
    })).sort((a: any, b: any) => b.selling_price - a.selling_price);
  }, [raw, totalRev]);

  const topChannel = enriched[0]?.channel_name;
  const maxRev = enriched[0]?.selling_price || 1;

  const sorted = useMemo(() => {
    const filtered = search
      ? enriched.filter((r: any) => r.label.toLowerCase().includes(search.toLowerCase()))
      : enriched;
    return [...filtered].sort((a: any, b: any) => {
      const va = sortKey === 'channel_name' ? a.label : a[sortKey];
      const vb = sortKey === 'channel_name' ? b.label : b[sortKey];
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [enriched, search, sortKey, sortDir]);

  /* ── chart data ────────────────────────────────────────────────────── */
  const pieData = useMemo(
    () => enriched.map((r: any, i: number) => ({ name: r.label, value: r.selling_price, color: PIE_COLORS[i % PIE_COLORS.length] })),
    [enriched],
  );
  const barData = useMemo(
    () => enriched.map((r: any) => ({ name: r.label, orders: r.orders, fill: r.meta.color })),
    [enriched],
  );

  /* ── insights ──────────────────────────────────────────────────────── */
  const insights = useMemo(() => {
    if (!enriched.length) return [];
    const byRev = [...enriched].sort((a: any, b: any) => b.selling_price - a.selling_price);
    const byAov = [...enriched].sort((a: any, b: any) => b.avg - a.avg);
    const worst = [...enriched].sort((a: any, b: any) => a.selling_price - b.selling_price);
    return [
      { icon: TrendingUp, color: 'emerald', title: 'Top Revenue', desc: `${byRev[0].label} generated ${fmt(byRev[0].selling_price)} (${byRev[0].pct.toFixed(1)}% share)` },
      { icon: Sparkles, color: 'violet', title: 'Highest AOV', desc: `${byAov[0].label} at ${fmtFull(byAov[0].avg)} per order` },
      { icon: TrendingDown, color: 'amber', title: 'Needs Attention', desc: `${worst[0].label} contributed only ${fmt(worst[0].selling_price)} (${worst[0].pct.toFixed(1)}%)` },
    ];
  }, [enriched]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;

  /* ── item table: filtered, sorted, paginated ───────────────────────── */
  const sortedItems = useMemo(() => {
    let filtered = items;
    if (itemSearch) {
      const q = itemSearch.toLowerCase();
      filtered = items.filter((it: any) =>
        (it.item_sku_code || '').toLowerCase().includes(q) ||
        (it.item_type_name || '').toLowerCase().includes(q) ||
        (it.size || '').toLowerCase().includes(q) ||
        (it.channel_name || '').toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a: any, b: any) => {
      const va = a[itemSortKey] ?? '';
      const vb = b[itemSortKey] ?? '';
      if (typeof va === 'string') return itemSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return itemSortDir === 'asc' ? va - vb : vb - va;
    });
  }, [items, itemSearch, itemSortKey, itemSortDir]);

  // Reset page when search/sort changes
  useEffect(() => { setItemPage(1); }, [itemSearch, itemSortKey, itemSortDir]);

  const totalItemPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PER_PAGE));
  const paginatedItems = sortedItems.slice((itemPage - 1) * ITEMS_PER_PAGE, itemPage * ITEMS_PER_PAGE);

  const toggleItemSort = (key: ItemSortKey) => {
    if (itemSortKey === key) setItemSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setItemSortKey(key); setItemSortDir('asc'); }
  };

  const ItemSortIcon = ({ k }: { k: ItemSortKey }) =>
    itemSortKey === k ? (itemSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />;

  /* ── date labels ───────────────────────────────────────────────────── */
  const dateLabel = mode === 'daily'
    ? format(parse(reportDate, 'yyyy-MM-dd', new Date()), 'EEEE, dd MMMM yyyy')
    : mode === 'monthly'
      ? `${MONTHS[selectedMonth]} ${selectedYear}`
      : `${format(parse(customFrom, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')} – ${format(parse(customTo, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}`;

  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const CAL_CLASSES = {
    root: 'rdp-custom',
    month_caption: 'text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-center py-1',
    weekday: 'text-[11px] font-medium text-slate-400 dark:text-slate-500 w-9 text-center',
    day_button: 'h-9 w-9 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center justify-center',
    today: 'font-bold text-blue-600 dark:text-blue-400',
    selected: '!bg-blue-600 !text-white rounded-lg font-semibold',
    disabled: 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40',
    chevron: 'fill-slate-500 dark:fill-slate-400 w-4 h-4',
  };

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-8">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Channel Wise Sales Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Channel-wise sales breakdown · Revenue-generating orders only</p>
      </div>

      {/* ─── Mode Selector ───────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 w-fit">
          {([
            { key: 'daily' as ReportMode, label: 'Daily', icon: Calendar },
            { key: 'monthly' as ReportMode, label: 'Monthly', icon: Layers },
            { key: 'custom' as ReportMode, label: 'Custom Range', icon: BarChart3 },
          ]).map((tab) => (
            <button key={tab.key} onClick={() => { setMode(tab.key); setShowReport(false); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === tab.key
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Daily controls */}
        {mode === 'daily' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px] max-w-[260px]" ref={calRef}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Report date</label>
              <div className="relative">
                <button type="button" onClick={() => setCalOpen((o) => !o)}
                  className="w-full flex items-center gap-2 pl-3 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{format(parse(reportDate, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</span>
                </button>
                <AnimatePresence>
                  {calOpen && (
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3">
                      <DayPicker mode="single"
                        selected={parse(reportDate, 'yyyy-MM-dd', new Date())}
                        onSelect={(day) => { if (day) { setReportDate(format(day, 'yyyy-MM-dd')); setShowReport(false); setCalOpen(false); } }}
                        disabled={{ after: new Date() }}
                        defaultMonth={parse(reportDate, 'yyyy-MM-dd', new Date())}
                        classNames={CAL_CLASSES}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <button onClick={handleGenerate} disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50 shadow-sm">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              {isLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {showReport && raw?.success && (
              <button onClick={handleCSV}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 transition shadow-sm">
                <Download className="w-4 h-4" /> Download CSV
              </button>
            )}
          </div>
        )}

        {/* Monthly controls */}
        {mode === 'monthly' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Year</label>
              <div className="flex gap-1.5">
                {yearOptions.map((yr) => (
                  <button key={yr} onClick={() => { setSelectedYear(yr); setShowReport(false); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${selectedYear === yr
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}>
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Select Month</label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {MONTHS.map((m, i) => {
                  const isDisabled = selectedYear === currentYear && i > now.getMonth();
                  return (
                    <button key={m} onClick={() => { if (!isDisabled) { setSelectedMonth(i); setShowReport(false); } }}
                      disabled={isDisabled}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition ${selectedMonth === i && !isDisabled
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300 dark:ring-blue-700'
                        : isDisabled
                          ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}>
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={handleGenerate} disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50 shadow-sm">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                {isLoading ? 'Generating…' : `Generate ${MONTHS[selectedMonth]} Report`}
              </button>
              {showReport && raw?.success && (
                <button onClick={handleCSV}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 transition shadow-sm">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom range controls */}
        {mode === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px] max-w-[220px]" ref={calFromRef}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">From date</label>
              <div className="relative">
                <button type="button" onClick={() => { setCalFromOpen((o) => !o); setCalToOpen(false); }}
                  className="w-full flex items-center gap-2 pl-3 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{format(parse(customFrom, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</span>
                </button>
                <AnimatePresence>
                  {calFromOpen && (
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3">
                      <DayPicker mode="single"
                        selected={parse(customFrom, 'yyyy-MM-dd', new Date())}
                        onSelect={(day) => { if (day) { setCustomFrom(format(day, 'yyyy-MM-dd')); setShowReport(false); setCalFromOpen(false); } }}
                        disabled={{ after: new Date() }}
                        defaultMonth={parse(customFrom, 'yyyy-MM-dd', new Date())}
                        classNames={CAL_CLASSES}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="flex-1 min-w-[180px] max-w-[220px]" ref={calToRef}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">To date</label>
              <div className="relative">
                <button type="button" onClick={() => { setCalToOpen((o) => !o); setCalFromOpen(false); }}
                  className="w-full flex items-center gap-2 pl-3 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{format(parse(customTo, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</span>
                </button>
                <AnimatePresence>
                  {calToOpen && (
                    <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-3">
                      <DayPicker mode="single"
                        selected={parse(customTo, 'yyyy-MM-dd', new Date())}
                        onSelect={(day) => { if (day) { setCustomTo(format(day, 'yyyy-MM-dd')); setShowReport(false); setCalToOpen(false); } }}
                        disabled={{ after: new Date() }}
                        defaultMonth={parse(customTo, 'yyyy-MM-dd', new Date())}
                        classNames={CAL_CLASSES}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <button onClick={handleGenerate} disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-50 shadow-sm">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              {isLoading ? 'Generating…' : 'Generate Report'}
            </button>
            {showReport && raw?.success && (
              <button onClick={handleCSV}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 transition shadow-sm">
                <Download className="w-4 h-4" /> Download CSV
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Loading ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-10 flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Fetching sales data for {dateLabel}…</p>
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{loadProgress}%</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Estimated</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${loadProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Large date ranges may take a few minutes</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Error ───────────────────────────────────────────────── */}
      {showReport && raw && !raw.success && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
          <p className="text-sm text-rose-600 dark:text-rose-400">{raw.error || 'Failed to generate report'}</p>
        </div>
      )}

      {/* ─── Report content ──────────────────────────────────────── */}
      <AnimatePresence>
        {showReport && raw?.success && totals && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="space-y-8">

            {/* ── Hero summary ────────────────────────────────────── */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 sm:p-8 shadow-lg text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjEuNSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3QgZmlsbD0idXJsKCNnKSIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIvPjwvc3ZnPg==')] opacity-50" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 opacity-70" />
                  <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{dateLabel}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-4">
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Total Revenue</p>
                    <p className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight">
                      <AnimatedNumber value={Math.round(totals.total_revenue)} prefix="₹" />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Orders</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_orders} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Items Sold</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_quantity} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-200 mb-1">Channels</p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums">
                      <AnimatedNumber value={totals.total_channels} />
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Charts (Donut + Bar) ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut / Pie */}
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Revenue Distribution</h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={2} dataKey="value" animationDuration={800}>
                        {pieData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <RTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          const pct = ((d.value / totalRev) * 100).toFixed(1);
                          return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg px-3.5 py-2.5 min-w-[150px]">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">{d.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                                <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtFull(d.value)}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{pct}% of total</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                  {pieData.map((e: any) => (
                    <div key={e.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{e.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar */}
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Orders by Channel</h2>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <RTooltip
                        cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg px-3.5 py-2.5 min-w-[140px]">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">{d.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                                <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{d.orders} orders</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="orders" radius={[0, 6, 6, 0]} animationDuration={800}>
                        {barData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Insights ────────────────────────────────────────── */}
            {insights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {insights.map((ins, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${ins.color === 'emerald' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : ins.color === 'violet' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                      <ins.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{ins.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{ins.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* ── Channel Breakdown Table ─────────────────────────── */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Channel Breakdown</h2>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 z-10">
                      {([
                        { key: 'channel_name' as SortKey, label: 'Channel', align: 'left' },
                        { key: 'quantity' as SortKey, label: 'Items', align: 'right' },
                        { key: 'selling_price' as SortKey, label: 'Revenue', align: 'right' },
                        { key: 'pct' as SortKey, label: 'Share %', align: 'right' },
                        { key: 'orders' as SortKey, label: 'Orders', align: 'right' },
                        { key: 'avg' as SortKey, label: 'Avg / Order', align: 'right' },
                      ] as const).map((col) => (
                        <th key={col.key}
                          onClick={() => toggleSort(col.key)}
                          className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none transition hover:text-slate-900 dark:hover:text-white ${col.align === 'left' ? 'text-left' : 'text-right'} text-slate-500 dark:text-slate-400`}>
                          <span className="inline-flex items-center gap-1">
                            {col.label} <SortIcon k={col.key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {sorted.map((row: any, idx: number) => {
                      const isTop = row.channel_name === topChannel;
                      const revBarW = Math.max(3, Math.round((row.selling_price / maxRev) * 100));
                      const rank = enriched.findIndex((e: any) => e.channel_name === row.channel_name);
                      const isTop3 = rank < 3;
                      return (
                        <motion.tr key={row.channel_name}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                          className="group transition hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white"
                                style={{ background: row.meta.color }}>
                                {row.meta.icon}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">{row.label}</span>
                                {isTop && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                                    <Flame className="w-3 h-3" /> Top
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">{row.quantity.toLocaleString()}</td>
                          <td className="px-5 py-4 text-right">
                            <p className={`text-sm font-semibold tabular-nums ${isTop3 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {fmtFull(row.selling_price)}
                            </p>
                            <div className="mt-1.5 h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${revBarW}%`, background: row.meta.color }} />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">{row.pct.toFixed(1)}%</span>
                          </td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">{row.orders}</td>
                          <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-600 dark:text-slate-400">{fmtFull(row.avg)}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-t-2 border-slate-200 dark:border-slate-600">
                      <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">Total</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{totals.total_quantity.toLocaleString()}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtFull(totals.total_revenue)}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">100%</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{totals.total_orders}</td>
                      <td className="px-5 py-4 text-right text-sm font-bold tabular-nums text-slate-600 dark:text-slate-400">{fmtFull(totals.total_revenue / totals.total_orders)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ── Item Details (Paginated) ────────────────────────── */}
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Item Details</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{sortedItems.length} items · {dateLabel}</p>
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search SKU, name, channel…"
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 sticky top-0 z-10">
                      {([
                        { key: 'item_sku_code' as ItemSortKey, label: 'Item SKU Code', align: 'left' },
                        { key: 'item_type_name' as ItemSortKey, label: 'Item Type Name', align: 'left' },
                        { key: 'size' as ItemSortKey, label: 'Size', align: 'left' },
                        { key: 'channel_name' as ItemSortKey, label: 'Channel Name', align: 'left' },
                        { key: 'selling_price' as ItemSortKey, label: 'Selling Price', align: 'right' },
                      ] as const).map((col) => (
                        <th key={col.key} onClick={() => toggleItemSort(col.key)}
                          className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition hover:text-slate-900 dark:hover:text-white ${col.align === 'left' ? 'text-left' : 'text-right'} text-slate-500 dark:text-slate-400`}>
                          <span className="inline-flex items-center gap-1">
                            {col.label} <ItemSortIcon k={col.key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {paginatedItems.map((item: any, idx: number) => (
                      <tr key={(itemPage - 1) * ITEMS_PER_PAGE + idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">{item.item_sku_code}</td>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-200 max-w-[400px] truncate">{item.item_type_name}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.size || '—'}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{item.channel_name}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{item.selling_price}</td>
                      </tr>
                    ))}
                    {paginatedItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                          {itemSearch ? 'No items match your search' : 'No item data available'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination controls */}
              {totalItemPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Showing {((itemPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(itemPage * ITEMS_PER_PAGE, sortedItems.length)} of {sortedItems.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setItemPage(1)} disabled={itemPage === 1}
                      className="px-2 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      First
                    </button>
                    <button onClick={() => setItemPage((p) => Math.max(1, p - 1))} disabled={itemPage === 1}
                      className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalItemPages) }, (_, i) => {
                      let page: number;
                      if (totalItemPages <= 5) {
                        page = i + 1;
                      } else if (itemPage <= 3) {
                        page = i + 1;
                      } else if (itemPage >= totalItemPages - 2) {
                        page = totalItemPages - 4 + i;
                      } else {
                        page = itemPage - 2 + i;
                      }
                      return (
                        <button key={page} onClick={() => setItemPage(page)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition ${itemPage === page
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}>
                          {page}
                        </button>
                      );
                    })}
                    <button onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))} disabled={itemPage === totalItemPages}
                      className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setItemPage(totalItemPages)} disabled={itemPage === totalItemPages}
                      className="px-2 py-1 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition">
                      Last
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-400 dark:text-slate-500 px-1">
              <span>Source: {raw.data_source}</span>
              {raw.cached && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">Cached</span>}
              <span>Currency: {raw.currency}</span>
              {raw.note && totals.excluded_items > 0 && <span className="text-amber-500">{totals.excluded_items} items excluded (cancelled/returned)</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
