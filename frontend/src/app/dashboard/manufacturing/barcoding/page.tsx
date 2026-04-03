'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { garmentProductionApi } from '@/features/manufacturing';
import type { BarcodeLabel } from '@/features/manufacturing';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function BarcodingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'generate' | 'list'>('list');
  const [genOpen, setGenOpen] = useState(false);
  const [markId, setMarkId] = useState<number | null>(null);

  const { data: barcodes, isLoading, error } = useQuery({
    queryKey: ['barcodes'],
    queryFn: () => garmentProductionApi.getBarcodes().then(r => r.data),
    staleTime: 30_000,
  });

  const genMut = useMutation({
    mutationFn: (data: any) => garmentProductionApi.generateBarcodes(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['barcodes'] }); setGenOpen(false); },
  });

  const printMut = useMutation({
    mutationFn: (ids: number[]) => garmentProductionApi.markPrinted(ids).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['barcodes'] }); setMarkId(null); },
  });

  const printed = barcodes?.filter((b: BarcodeLabel) => b.is_printed) || [];
  const pending = barcodes?.filter((b: BarcodeLabel) => !b.is_printed) || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Barcoding" description="Generate and manage barcode labels" action={{ label: '+ Generate Batch', onClick: () => setGenOpen(true) }} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{barcodes?.length ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Total Labels</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-slate-500 mt-1">Pending Print</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{printed.length}</p>
          <p className="text-xs text-slate-500 mt-1">Printed</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-strip border-b border-slate-200 dark:border-slate-700">
        <div className="inline-flex min-w-max gap-1">
          {(['list', 'generate'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t === 'list' ? 'All Labels' : 'Pending Print'}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && (
        <BarcodeTable
          barcodes={tab === 'list' ? (barcodes || []) : pending}
          onMarkPrint={setMarkId}
        />
      )}

      <FormModal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Barcode Batch">
        <BatchForm onSubmit={v => genMut.mutate(v)} loading={genMut.isPending} />
      </FormModal>

      <ConfirmDialog
        open={markId !== null}
        onClose={() => setMarkId(null)}
        onConfirm={() => { if (markId !== null) printMut.mutate([markId]); }}
        title="Mark as Printed"
        message="Mark this barcode label as printed?"
        loading={printMut.isPending}
      />
    </div>
  );
}

function BarcodeTable({ barcodes, onMarkPrint }: { barcodes: BarcodeLabel[]; onMarkPrint: (id: number) => void }) {
  if (barcodes.length === 0) return <EmptyState title="No barcode labels" />;

  return (
    <div className="card overflow-hidden">
      <div className="table-scroll-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3">Garment ID</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3 text-right">MRP ₹</th>
              <th className="px-4 py-3">Printed</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {barcodes.map((b: BarcodeLabel) => (
              <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{b.barcode}</td>
                <td className="px-4 py-3 font-mono text-xs">{b.garment_id}</td>
                <td className="px-4 py-3">{b.size}</td>
                <td className="px-4 py-3 font-mono text-xs">{b.batch_number || '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums">₹{b.mrp?.toLocaleString('en-IN') ?? '-'}</td>
                <td className="px-4 py-3">
                  {b.is_printed
                    ? <span className="text-xs font-medium text-green-600">✓ Printed</span>
                    : <span className="text-xs font-medium text-amber-500">Pending</span>}
                </td>
                <td className="px-4 py-3">
                  {!b.is_printed && (
                    <button onClick={() => onMarkPrint(b.id)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                      Mark Printed
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    garment_finishing_id: 0,
    garment_id: 0,
    batch_number: '',
    mrp: 0,
    sizes: '{}',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      let sizes: Record<string, number> = {};
      try { sizes = JSON.parse(form.sizes); } catch { sizes = {}; }
      onSubmit({
        garment_finishing_id: form.garment_finishing_id,
        garment_id: form.garment_id,
        batch_number: form.batch_number || undefined,
        mrp: form.mrp || undefined,
        sizes,
      });
    }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Garment Finishing ID *</label><input className="input" type="number" required value={form.garment_finishing_id || ''} onChange={e => set('garment_finishing_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Garment ID *</label><input className="input" type="number" required value={form.garment_id || ''} onChange={e => set('garment_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Batch Number</label><input className="input" value={form.batch_number} onChange={e => set('batch_number', e.target.value)} placeholder="e.g. BATCH-2026-001" /></div>
        <div><label className="label">MRP ₹</label><input className="input" type="number" step="0.01" value={form.mrp || ''} onChange={e => set('mrp', parseFloat(e.target.value) || 0)} /></div>
      </div>
      <div>
        <label className="label">Sizes (JSON) *</label>
        <input className="input font-mono text-xs" value={form.sizes} onChange={e => set('sizes', e.target.value)} placeholder='{"S":50,"M":100,"L":80,"XL":40}' />
        <p className="text-xs text-slate-400 mt-1">One barcode per piece will be generated for each size.</p>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.garment_finishing_id || !form.garment_id} className="btn btn-primary w-full sm:w-auto">{loading ? 'Generating…' : 'Generate Barcodes'}</button></div>
    </form>
  );
}
