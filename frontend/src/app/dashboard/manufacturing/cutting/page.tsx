'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { garmentProductionApi } from '@/features/manufacturing';
import type { CuttingOrder } from '@/features/manufacturing';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function CuttingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['cutting-orders', statusFilter],
    queryFn: () => garmentProductionApi.getCuttingOrders({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => garmentProductionApi.createCuttingOrder(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cutting-orders'] }); setModalOpen(false); },
  });

  const checkMut = useMutation({
    mutationFn: (data: any) => garmentProductionApi.createCuttingCheck(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cutting-orders'] }); setCheckOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Cutting Orders" description="Fabric cutting & wastage tracking" action={{ label: '+ New Cutting Order', onClick: () => setModalOpen(true) }} />

      <div className="flex flex-wrap gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['OPEN', 'IN_PROGRESS', 'COMPLETED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setCheckOpen(true)} className="btn btn-primary text-sm">Cutting Check</button>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && orders && orders.length === 0 && <EmptyState title="No cutting orders" />}

      {!isLoading && orders && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Garment</th>
                  <th className="px-4 py-3 text-right">Fabric Issued</th>
                  <th className="px-4 py-3 text-right">Planned Pcs</th>
                  <th className="px-4 py-3">Efficiency</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((co: CuttingOrder) => (
                  <tr key={co.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{co.cutting_order_number}</td>
                    <td className="px-4 py-3 text-slate-500">{co.order_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">#{co.garment_id}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt(co.fabric_qty_issued)} kg</td>
                    <td className="px-4 py-3 text-right tabular-nums">{co.planned_pieces}</td>
                    <td className="px-4 py-3 text-slate-500">{co.marker_efficiency ? `${co.marker_efficiency}%` : '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={co.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Cutting Order">
        <CuttingOrderForm onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>

      <FormModal open={checkOpen} onClose={() => setCheckOpen(false)} title="Cutting Quality Check">
        <CuttingCheckForm orders={orders || []} onSubmit={v => checkMut.mutate(v)} loading={checkMut.isPending} />
      </FormModal>
    </div>
  );
}

function CuttingOrderForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0, 10),
    garment_id: 0, fabric_id: 0, fabric_qty_issued: 0,
    planned_pieces: 0, marker_efficiency: 0, remarks: '',
    size_breakdown: '{}',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      let sb = {};
      try { sb = JSON.parse(form.size_breakdown); } catch { sb = {}; }
      onSubmit({ ...form, size_breakdown: sb, marker_efficiency: form.marker_efficiency || undefined });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Order Date *</label><input className="input" type="date" required value={form.order_date} onChange={e => set('order_date', e.target.value)} /></div>
        <div><label className="label">Garment ID *</label><input className="input" type="number" required value={form.garment_id || ''} onChange={e => set('garment_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Fabric ID *</label><input className="input" type="number" required value={form.fabric_id || ''} onChange={e => set('fabric_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Fabric Qty (kg) *</label><input className="input" type="number" step="0.01" required value={form.fabric_qty_issued || ''} onChange={e => set('fabric_qty_issued', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Planned Pieces *</label><input className="input" type="number" required value={form.planned_pieces || ''} onChange={e => set('planned_pieces', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Marker Efficiency %</label><input className="input" type="number" step="0.01" value={form.marker_efficiency || ''} onChange={e => set('marker_efficiency', parseFloat(e.target.value) || 0)} /></div>
        <div className="col-span-2">
          <label className="label">Size Breakdown (JSON)</label>
          <input className="input font-mono text-xs" value={form.size_breakdown} onChange={e => set('size_breakdown', e.target.value)} placeholder='{"S":50,"M":100,"L":80,"XL":50}' />
        </div>
      </div>
      <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.garment_id || !form.fabric_id} className="btn btn-primary">{loading ? 'Creating…' : 'Create Cutting Order'}</button></div>
    </form>
  );
}

function CuttingCheckForm({ orders, onSubmit, loading }: { orders: CuttingOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    cutting_order_id: 0, check_date: new Date().toISOString().slice(0, 10),
    pieces_cut: 0, pieces_ok: 0, pieces_rejected: 0,
    fabric_used_kg: 0, fabric_wastage_kg: 0, checked_by: '', remarks: '',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Cutting Order *</label>
          <select className="input" required value={form.cutting_order_id} onChange={e => set('cutting_order_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {orders.filter(o => o.status !== 'COMPLETED').map(o => <option key={o.id} value={o.id}>{o.cutting_order_number}</option>)}
          </select>
        </div>
        <div><label className="label">Check Date *</label><input className="input" type="date" required value={form.check_date} onChange={e => set('check_date', e.target.value)} /></div>
        <div><label className="label">Pieces Cut *</label><input className="input" type="number" required value={form.pieces_cut || ''} onChange={e => set('pieces_cut', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Pieces OK *</label><input className="input" type="number" required value={form.pieces_ok || ''} onChange={e => set('pieces_ok', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Pieces Rejected</label><input className="input" type="number" value={form.pieces_rejected || ''} onChange={e => set('pieces_rejected', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Fabric Used (kg)</label><input className="input" type="number" step="0.01" value={form.fabric_used_kg || ''} onChange={e => set('fabric_used_kg', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Fabric Wastage (kg)</label><input className="input" type="number" step="0.01" value={form.fabric_wastage_kg || ''} onChange={e => set('fabric_wastage_kg', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Checked By</label><input className="input" value={form.checked_by} onChange={e => set('checked_by', e.target.value)} /></div>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.cutting_order_id} className="btn btn-primary">{loading ? 'Saving…' : 'Record Check'}</button></div>
    </form>
  );
}
