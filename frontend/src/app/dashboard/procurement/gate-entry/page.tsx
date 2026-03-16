'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gateEntryApi, supplierApi, purchaseOrderApi } from '@/features/procurement';
import type { GateEntry, Supplier, PurchaseOrder } from '@/features/procurement';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

export default function GateEntryPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['gate-entries', statusFilter],
    queryFn: () => gateEntryApi.getAll({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => supplierApi.getAll({ is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: openPOs } = useQuery({
    queryKey: ['po-pending'],
    queryFn: () => purchaseOrderApi.getPending().then(r => r.data),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => gateEntryApi.create(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gate-entries'] }); setModalOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Gate Entry" description="Record incoming material at gate" action={{ label: '+ New Entry', onClick: () => setModalOpen(true) }} />

      <div className="flex gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['OPEN', 'CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && entries && entries.length === 0 && (
        <EmptyState title="No gate entries" action={{ label: '+ New Entry', onClick: () => setModalOpen(true) }} />
      )}

      {!isLoading && entries && entries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">GE #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Challan</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((ge: GateEntry) => (
                  <tr key={ge.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{ge.gate_entry_number}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{ge.entry_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{ge.supplier?.supplier_name || `#${ge.supplier_id}`}</td>
                    <td className="px-4 py-3 text-slate-500">{ge.vehicle_number || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{ge.supplier_challan_no || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={ge.status || 'OPEN'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Gate Entry">
        <GateEntryForm suppliers={suppliers || []} openPOs={openPOs || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>
    </div>
  );
}

function GateEntryForm({ suppliers, openPOs, onSubmit, loading }: { suppliers: Supplier[]; openPOs: PurchaseOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    entry_time: new Date().toTimeString().slice(0, 5),
    supplier_id: 0,
    po_id: null as number | null,
    vehicle_number: '',
    driver_name: '',
    supplier_challan_no: '',
    supplier_challan_date: '',
    remarks: '',
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, po_id: form.po_id || undefined, supplier_challan_date: form.supplier_challan_date || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Entry Date *</label>
          <input className="input" type="date" required value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Entry Time</label>
          <input className="input" type="time" value={form.entry_time} onChange={e => set('entry_time', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier *</label>
          <select className="input" required value={form.supplier_id} onChange={e => set('supplier_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Against PO</label>
          <select className="input" value={form.po_id ?? ''} onChange={e => set('po_id', e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">-- None --</option>
            {openPOs.map(po => <option key={po.id} value={po.id}>{po.po_number}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Vehicle Number</label>
          <input className="input" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Driver Name</label>
          <input className="input" value={form.driver_name} onChange={e => set('driver_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier Challan No</label>
          <input className="input" value={form.supplier_challan_no} onChange={e => set('supplier_challan_no', e.target.value)} />
        </div>
        <div>
          <label className="label">Challan Date</label>
          <input className="input" type="date" value={form.supplier_challan_date} onChange={e => set('supplier_challan_date', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Remarks</label>
        <textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || form.supplier_id === 0} className="btn btn-primary">
          {loading ? 'Saving…' : 'Create Gate Entry'}
        </button>
      </div>
    </form>
  );
}
