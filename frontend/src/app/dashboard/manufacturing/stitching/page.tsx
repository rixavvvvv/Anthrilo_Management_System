'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { garmentProductionApi, supplierApi } from '@/lib/api';
import type { StitchingOrder, Supplier } from '@/types';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

export default function StitchingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['stitching-orders', statusFilter],
    queryFn: () => garmentProductionApi.getStitchingOrders({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-stitchers'],
    queryFn: () => supplierApi.getAll({ supplier_type: 'STITCHER', is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => garmentProductionApi.createStitchingOrder(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stitching-orders'] }); setModalOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Stitching Orders" description="Manage stitching job work" action={{ label: '+ New Order', onClick: () => setModalOpen(true) }} />

      <div className="flex gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['OPEN', 'IN_PROGRESS', 'COMPLETED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && orders && orders.length === 0 && <EmptyState title="No stitching orders" />}

      {!isLoading && orders && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Cutting Order</th>
                  <th className="px-4 py-3">Stitcher</th>
                  <th className="px-4 py-3 text-right">Pieces</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((so: StitchingOrder) => (
                  <tr key={so.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{so.stitching_order_number}</td>
                    <td className="px-4 py-3 text-slate-500">{so.order_date}</td>
                    <td className="px-4 py-3 font-mono text-xs">#{so.cutting_order_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{so.stitcher?.supplier_name || (so.stitcher_supplier_id ? `#${so.stitcher_supplier_id}` : 'In-House')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{so.pieces_issued}</td>
                    <td className="px-4 py-3 text-slate-500">{so.target_date || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={so.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Stitching Order">
        <StitchingForm suppliers={suppliers || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>
    </div>
  );
}

function StitchingForm({ suppliers, onSubmit, loading }: { suppliers: Supplier[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0, 10),
    cutting_order_id: 0,
    stitcher_supplier_id: null as number | null,
    pieces_issued: 0,
    target_date: '',
    stitching_rate: 0,
    remarks: '',
    size_breakdown: '{}',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      let sb = {};
      try { sb = JSON.parse(form.size_breakdown); } catch { sb = {}; }
      onSubmit({
        ...form,
        size_breakdown: sb,
        stitcher_supplier_id: form.stitcher_supplier_id || undefined,
        target_date: form.target_date || undefined,
        stitching_rate: form.stitching_rate || undefined,
      });
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Order Date *</label><input className="input" type="date" required value={form.order_date} onChange={e => set('order_date', e.target.value)} /></div>
        <div><label className="label">Cutting Order ID *</label><input className="input" type="number" required value={form.cutting_order_id || ''} onChange={e => set('cutting_order_id', parseInt(e.target.value) || 0)} /></div>
        <div>
          <label className="label">Stitcher</label>
          <select className="input" value={form.stitcher_supplier_id ?? ''} onChange={e => set('stitcher_supplier_id', e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">In-House</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div><label className="label">Pieces Issued *</label><input className="input" type="number" required value={form.pieces_issued || ''} onChange={e => set('pieces_issued', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Target Date</label><input className="input" type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} /></div>
        <div><label className="label">Stitching Rate ₹</label><input className="input" type="number" step="0.01" value={form.stitching_rate || ''} onChange={e => set('stitching_rate', parseFloat(e.target.value) || 0)} /></div>
        <div className="col-span-2">
          <label className="label">Size Breakdown (JSON)</label>
          <input className="input font-mono text-xs" value={form.size_breakdown} onChange={e => set('size_breakdown', e.target.value)} placeholder='{"S":50,"M":100,"L":80}' />
        </div>
      </div>
      <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.cutting_order_id} className="btn btn-primary">{loading ? 'Creating…' : 'Create Stitching Order'}</button></div>
    </form>
  );
}
