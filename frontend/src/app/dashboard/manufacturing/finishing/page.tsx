'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { garmentProductionApi } from '@/lib/api';
import type { GarmentFinishing } from '@/types';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

const FINISHING_STAGES = ['THREAD_CUTTING', 'RAW_CHECKING', 'PRESSING', 'FINAL_CHECKING', 'PACKING', 'BARCODING'] as const;

const STAGE_LABELS: Record<string, string> = {
  THREAD_CUTTING: 'Thread Cutting',
  RAW_CHECKING: 'Raw Checking',
  PRESSING: 'Pressing',
  FINAL_CHECKING: 'Final Checking',
  PACKING: 'Packing',
  BARCODING: 'Barcoding',
};

const STAGE_COLORS: Record<string, string> = {
  THREAD_CUTTING: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  RAW_CHECKING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PRESSING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINAL_CHECKING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PACKING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BARCODING: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function FinishingPage() {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: stages, isLoading, error } = useQuery({
    queryKey: ['finishing-stages', stageFilter],
    queryFn: () => garmentProductionApi.getFinishingStages({ stage: stageFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const recordMut = useMutation({
    mutationFn: (data: any) => garmentProductionApi.recordFinishing(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['finishing-stages'] }); setModalOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Finishing" description="Track finishing stages for stitched garments" action={{ label: '+ Record Stage', onClick: () => setModalOpen(true) }} />

      <div className="flex gap-3">
        <select className="input w-48" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {FINISHING_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && stages && stages.length === 0 && <EmptyState title="No finishing records" />}

      {!isLoading && stages && stages.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Stitching Order</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Pieces In</th>
                  <th className="px-4 py-3 text-right">Passed</th>
                  <th className="px-4 py-3 text-right">Rejected</th>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stages.map((gf: GarmentFinishing) => (
                  <tr key={gf.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">#{gf.stitching_order_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[gf.stage] || 'bg-slate-100 text-slate-700'}`}>
                        {STAGE_LABELS[gf.stage] || gf.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{gf.stage_date}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{gf.pieces_in}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-600 font-medium">{gf.pieces_passed ?? '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">{gf.pieces_rejected ?? '-'}</td>
                    <td className="px-4 py-3">{gf.worker_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{gf.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Finishing Stage">
        <FinishingForm onSubmit={v => recordMut.mutate(v)} loading={recordMut.isPending} />
      </FormModal>
    </div>
  );
}

function FinishingForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    stitching_order_id: 0,
    stage: 'THREAD_CUTTING' as string,
    stage_date: new Date().toISOString().slice(0, 10),
    pieces_in: 0,
    pieces_passed: null as number | null,
    pieces_rejected: null as number | null,
    worker_name: '',
    remarks: '',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      onSubmit({
        ...form,
        pieces_passed: form.pieces_passed ?? undefined,
        pieces_rejected: form.pieces_rejected ?? undefined,
        worker_name: form.worker_name || undefined,
        remarks: form.remarks || undefined,
      });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Stitching Order ID *</label><input className="input" type="number" required value={form.stitching_order_id || ''} onChange={e => set('stitching_order_id', parseInt(e.target.value) || 0)} /></div>
        <div>
          <label className="label">Stage *</label>
          <select className="input" value={form.stage} onChange={e => set('stage', e.target.value)}>
            {FINISHING_STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>
        <div><label className="label">Date *</label><input className="input" type="date" required value={form.stage_date} onChange={e => set('stage_date', e.target.value)} /></div>
        <div><label className="label">Pieces In *</label><input className="input" type="number" required value={form.pieces_in || ''} onChange={e => set('pieces_in', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Pieces Passed</label><input className="input" type="number" value={form.pieces_passed ?? ''} onChange={e => set('pieces_passed', e.target.value ? parseInt(e.target.value) : null)} /></div>
        <div><label className="label">Pieces Rejected</label><input className="input" type="number" value={form.pieces_rejected ?? ''} onChange={e => set('pieces_rejected', e.target.value ? parseInt(e.target.value) : null)} /></div>
        <div><label className="label">Worker Name</label><input className="input" value={form.worker_name} onChange={e => set('worker_name', e.target.value)} /></div>
      </div>
      <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.stitching_order_id || !form.pieces_in} className="btn btn-primary">{loading ? 'Recording…' : 'Record Stage'}</button></div>
    </form>
  );
}
