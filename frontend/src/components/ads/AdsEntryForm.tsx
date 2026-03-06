'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adsApi } from '@/lib/api/ads';
import type { AdsDataCreate } from '@/types';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';

const CHANNELS = [
  'Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Ajio',
  'Nykaa', 'Snapdeal', 'JioMart', 'Tata_CLiQ', 'FirstCry',
  'Google_Ads', 'Meta_Ads', 'Other',
];

const BRANDS = ['Anthrilo', 'Other'];

const initialForm: AdsDataCreate = {
  date: new Date().toISOString().slice(0, 10),
  channel: '',
  brand: 'Anthrilo',
  campaign_name: '',
  impressions: 0,
  clicks: 0,
  cpc: undefined,
  spend: 0,
  spend_with_tax: undefined,
  ads_sale: 0,
  total_sale: 0,
  units_sold: 0,
  extra_metrics: [],
};

function computeMetrics(spend: number, adsSale: number, totalSale: number) {
  return {
    acos: adsSale > 0 ? +(spend / adsSale * 100).toFixed(2) : null,
    tacos: totalSale > 0 ? +(spend / totalSale * 100).toFixed(2) : null,
    roas: spend > 0 ? +(adsSale / spend).toFixed(2) : null,
    roi: spend > 0 ? +((adsSale - spend) / spend).toFixed(2) : null,
    ctr: 0,
  };
}

export default function AdsEntryForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdsDataCreate>({ ...initialForm });
  const [successMsg, setSuccessMsg] = useState('');

  const mutation = useMutation({
    mutationFn: (data: AdsDataCreate) => adsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ads'] });
      setSuccessMsg('Entry saved successfully!');
      setForm({ ...initialForm });
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const metrics = computeMetrics(form.spend, form.ads_sale, form.total_sale);

  const setField = (field: keyof AdsDataCreate, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const setNumericField = (field: keyof AdsDataCreate, raw: string) => {
    const v = raw === '' ? 0 : parseFloat(raw);
    if (!isNaN(v)) setField(field, v);
  };

  const addExtraMetric = () => {
    setForm(prev => ({
      ...prev,
      extra_metrics: [...prev.extra_metrics, { metric_name: '', metric_value: 0 }],
    }));
  };

  const removeExtraMetric = (idx: number) => {
    setForm(prev => ({
      ...prev,
      extra_metrics: prev.extra_metrics.filter((_, i) => i !== idx),
    }));
  };

  const updateExtraMetric = (idx: number, field: 'metric_name' | 'metric_value', value: string) => {
    setForm(prev => {
      const updated = [...prev.extra_metrics];
      if (field === 'metric_name') {
        updated[idx] = { ...updated[idx], metric_name: value };
      } else {
        const n = parseFloat(value);
        updated[idx] = { ...updated[idx], metric_value: isNaN(n) ? 0 : n };
      }
      return { ...prev, extra_metrics: updated };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.channel) return;
    mutation.mutate(form);
  };

  const handleReset = () => {
    setForm({ ...initialForm });
    setSuccessMsg('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success / Error Messages */}
      {successMsg && (
        <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
          {successMsg}
        </div>
      )}
      {mutation.isError && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-sm">
          Failed to save entry. Please check your inputs.
        </div>
      )}

      {/* Basic Info */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Basic Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Date *</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
              className="input" required />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Channel *</label>
            <select value={form.channel} onChange={e => setField('channel', e.target.value)}
              className="input" required>
              <option value="">Select Channel</option>
              {CHANNELS.map(ch => <option key={ch} value={ch}>{ch.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Brand</label>
            <select value={form.brand} onChange={e => setField('brand', e.target.value)} className="input">
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Campaign Name</label>
            <input type="text" value={form.campaign_name || ''} onChange={e => setField('campaign_name', e.target.value)}
              placeholder="e.g. Summer Sale 2025" className="input" />
          </div>
        </div>
      </div>

      {/* Traffic Metrics */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Traffic</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Impressions</label>
            <input type="number" min={0} value={form.impressions || ''}
              onChange={e => setNumericField('impressions', e.target.value)}
              placeholder="0" className="input" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Clicks</label>
            <input type="number" min={0} value={form.clicks || ''}
              onChange={e => setNumericField('clicks', e.target.value)}
              placeholder="0" className="input" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">CPC (₹)</label>
            <input type="number" min={0} step="0.01" value={form.cpc ?? ''}
              onChange={e => setNumericField('cpc', e.target.value)}
              placeholder="Auto if blank" className="input" />
          </div>
        </div>
      </div>

      {/* Cost & Revenue */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Cost & Revenue</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Ad Spend (₹) *</label>
            <input type="number" min={0} step="0.01" value={form.spend || ''}
              onChange={e => setNumericField('spend', e.target.value)}
              placeholder="0.00" className="input" required />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend with Tax (₹)</label>
            <input type="number" min={0} step="0.01" value={form.spend_with_tax ?? ''}
              onChange={e => setNumericField('spend_with_tax', e.target.value)}
              placeholder="Optional" className="input" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Ads Sale (₹) *</label>
            <input type="number" min={0} step="0.01" value={form.ads_sale || ''}
              onChange={e => setNumericField('ads_sale', e.target.value)}
              placeholder="0.00" className="input" required />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Sale (₹) *</label>
            <input type="number" min={0} step="0.01" value={form.total_sale || ''}
              onChange={e => setNumericField('total_sale', e.target.value)}
              placeholder="0.00" className="input" required />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Units Sold</label>
            <input type="number" min={0} value={form.units_sold || ''}
              onChange={e => setNumericField('units_sold', e.target.value)}
              placeholder="0" className="input" />
          </div>
        </div>
      </div>

      {/* Auto-Calculated Metrics */}
      <div className="card bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Auto-Calculated Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricPill label="ACOS" value={metrics.acos} suffix="%" color="blue" />
          <MetricPill label="TACOS" value={metrics.tacos} suffix="%" color="purple" />
          <MetricPill label="ROAS" value={metrics.roas} suffix="x" color="emerald" />
          <MetricPill label="ROI" value={metrics.roi} suffix="x" color="amber" />
        </div>
      </div>

      {/* Extra Metrics */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Extra Metrics</h3>
          <button type="button" onClick={addExtraMetric}
            className="btn btn-secondary text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Metric
          </button>
        </div>
        {form.extra_metrics.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No extra metrics. Click &quot;Add Metric&quot; to add custom metrics.</p>
        )}
        {form.extra_metrics.map((em, idx) => (
          <div key={idx} className="flex items-end gap-3 mb-3">
            <div className="flex-1 flex flex-col space-y-1">
              <label className="text-xs text-slate-500">Metric Name</label>
              <input type="text" value={em.metric_name} onChange={e => updateExtraMetric(idx, 'metric_name', e.target.value)}
                placeholder="e.g. CTR, DPV" className="input text-sm" />
            </div>
            <div className="w-36 flex flex-col space-y-1">
              <label className="text-xs text-slate-500">Value</label>
              <input type="number" step="any" value={em.metric_value || ''}
                onChange={e => updateExtraMetric(idx, 'metric_value', e.target.value)}
                placeholder="0" className="input text-sm" />
            </div>
            <button type="button" onClick={() => removeExtraMetric(idx)}
              className="p-2.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={mutation.isPending || !form.channel}
          className="btn btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          {mutation.isPending ? 'Saving...' : 'Save Entry'}
        </button>
        <button type="button" onClick={handleReset} className="btn btn-secondary flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </form>
  );
}

function MetricPill({ label, value, suffix, color }: { label: string; value: number | null; suffix: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    purple: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };
  return (
    <div className={`flex flex-col items-center p-3 rounded-xl border ${colors[color] || colors.blue}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</span>
      <span className="text-lg font-bold">{value !== null ? `${value}${suffix}` : '—'}</span>
    </div>
  );
}
