'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knittingApi, supplierApi } from '@/features/manufacturing';
import type { KnitOrder, Supplier } from '@/features/manufacturing';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function KnitOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [yarnIssueOpen, setYarnIssueOpen] = useState(false);
  const [greyReceiptOpen, setGreyReceiptOpen] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['knit-orders', statusFilter],
    queryFn: () => knittingApi.getOrders({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-knitters'],
    queryFn: () => supplierApi.getAll({ supplier_type: 'KNITTER', is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => knittingApi.createOrder(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knit-orders'] }); setModalOpen(false); },
  });

  const issueMut = useMutation({
    mutationFn: (data: any) => knittingApi.issueYarn(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knit-orders'] }); setYarnIssueOpen(false); },
  });

  const receiptMut = useMutation({
    mutationFn: (data: any) => knittingApi.receiveGreyFabric(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knit-orders'] }); setGreyReceiptOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Knit Orders" description="Yarn planning & knitting order management" action={{ label: '+ New Knit Order', onClick: () => setModalOpen(true) }} />

      <div className="flex flex-wrap gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setYarnIssueOpen(true)} className="btn btn-primary text-sm">Issue Yarn</button>
        <button onClick={() => setGreyReceiptOpen(true)} className="btn btn-primary text-sm">Receive Grey Fabric</button>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && orders && orders.length === 0 && (
        <EmptyState title="No knit orders" action={{ label: '+ New Knit Order', onClick: () => setModalOpen(true) }} />
      )}

      {!isLoading && orders && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Knitter</th>
                  <th className="px-4 py-3">Fabric</th>
                  <th className="px-4 py-3 text-right">Planned Qty</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((ko: KnitOrder) => (
                  <tr key={ko.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{ko.knit_order_number}</td>
                    <td className="px-4 py-3 text-slate-500">{ko.order_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{ko.knitter?.supplier_name || `#${ko.knitter_supplier_id}`}</td>
                    <td className="px-4 py-3 text-slate-500">#{ko.fabric_id}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(ko.planned_qty_kg)} kg</td>
                    <td className="px-4 py-3 text-slate-500">{ko.target_date || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={ko.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Knit Order */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Knit Order">
        <KnitOrderForm suppliers={suppliers || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>

      {/* Yarn Issue */}
      <FormModal open={yarnIssueOpen} onClose={() => setYarnIssueOpen(false)} title="Issue Yarn to Knitter" wide>
        <YarnIssueForm orders={orders || []} onSubmit={v => issueMut.mutate(v)} loading={issueMut.isPending} />
      </FormModal>

      {/* Grey Fabric Receipt */}
      <FormModal open={greyReceiptOpen} onClose={() => setGreyReceiptOpen(false)} title="Receive Grey Fabric">
        <GreyFabricReceiptForm orders={orders || []} onSubmit={v => receiptMut.mutate(v)} loading={receiptMut.isPending} />
      </FormModal>
    </div>
  );
}

function KnitOrderForm({ suppliers, onSubmit, loading }: { suppliers: Supplier[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    order_date: new Date().toISOString().slice(0, 10),
    knitter_supplier_id: 0,
    fabric_id: 0,
    planned_qty_kg: 0,
    target_date: '',
    gsm: 0,
    fabric_type: '',
    remarks: '',
  });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, target_date: form.target_date || undefined }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Order Date *</label>
          <input className="input" type="date" required value={form.order_date} onChange={e => set('order_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Knitter *</label>
          <select className="input" required value={form.knitter_supplier_id} onChange={e => set('knitter_supplier_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fabric ID *</label>
          <input className="input" type="number" required value={form.fabric_id || ''} onChange={e => set('fabric_id', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Planned Qty (kg) *</label>
          <input className="input" type="number" step="0.01" required value={form.planned_qty_kg || ''} onChange={e => set('planned_qty_kg', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Target Date</label>
          <input className="input" type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
        </div>
        <div>
          <label className="label">GSM</label>
          <input className="input" type="number" value={form.gsm || ''} onChange={e => set('gsm', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Fabric Type</label>
          <input className="input" value={form.fabric_type} onChange={e => set('fabric_type', e.target.value)} placeholder="e.g. Single Jersey" />
        </div>
      </div>
      <div>
        <label className="label">Remarks</label>
        <textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || !form.knitter_supplier_id || !form.fabric_id} className="btn btn-primary">
          {loading ? 'Creating…' : 'Create Knit Order'}
        </button>
      </div>
    </form>
  );
}

function YarnIssueForm({ orders, onSubmit, loading }: { orders: KnitOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ issue_date: new Date().toISOString().slice(0, 10), knit_order_id: 0, remarks: '' });
  const [items, setItems] = useState([{ yarn_id: 0, lot_number: '', qty: 0, unit: 'KGS' }]);

  const addItem = () => setItems(p => [...p, { yarn_id: 0, lot_number: '', qty: 0, unit: 'KGS' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: any) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, items }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Issue Date *</label>
          <input className="input" type="date" required value={form.issue_date} onChange={e => setForm(p => ({ ...p, issue_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Knit Order *</label>
          <select className="input" required value={form.knit_order_id} onChange={e => setForm(p => ({ ...p, knit_order_id: parseInt(e.target.value) }))}>
            <option value={0}>-- Select --</option>
            {orders.filter(o => o.status !== 'CANCELLED').map(o => <option key={o.id} value={o.id}>{o.knit_order_number}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Yarn Items</h4>
          <button type="button" onClick={addItem} className="text-sm text-primary-600 font-medium">+ Add</button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className="input text-xs" type="number" placeholder="Yarn ID" value={it.yarn_id || ''} onChange={e => updateItem(i, 'yarn_id', parseInt(e.target.value) || 0)} required />
            <input className="input text-xs" placeholder="Lot #" value={it.lot_number} onChange={e => updateItem(i, 'lot_number', e.target.value)} />
            <input className="input text-xs" type="number" step="0.01" placeholder="Qty" value={it.qty || ''} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)} required />
            <select className="input text-xs" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
              {['KGS', 'MTR'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-rose-500 text-xs self-center">✕</button>}
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || !form.knit_order_id} className="btn btn-primary">
          {loading ? 'Issuing…' : 'Issue Yarn'}
        </button>
      </div>
    </form>
  );
}

function GreyFabricReceiptForm({ orders, onSubmit, loading }: { orders: KnitOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ receipt_date: new Date().toISOString().slice(0, 10), knit_order_id: 0, fabric_id: 0, qty_received: 0, qty_rejected: 0, lot_number: '', gsm_actual: 0, remarks: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Receipt Date *</label>
          <input className="input" type="date" required value={form.receipt_date} onChange={e => set('receipt_date', e.target.value)} />
        </div>
        <div>
          <label className="label">Knit Order *</label>
          <select className="input" required value={form.knit_order_id} onChange={e => set('knit_order_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {orders.filter(o => o.status !== 'CANCELLED').map(o => <option key={o.id} value={o.id}>{o.knit_order_number}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fabric ID *</label>
          <input className="input" type="number" required value={form.fabric_id || ''} onChange={e => set('fabric_id', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Qty Received (kg) *</label>
          <input className="input" type="number" step="0.01" required value={form.qty_received || ''} onChange={e => set('qty_received', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Qty Rejected (kg)</label>
          <input className="input" type="number" step="0.01" value={form.qty_rejected || ''} onChange={e => set('qty_rejected', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Lot #</label>
          <input className="input" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Actual GSM</label>
          <input className="input" type="number" value={form.gsm_actual || ''} onChange={e => set('gsm_actual', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div>
        <label className="label">Remarks</label>
        <textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || !form.knit_order_id || !form.fabric_id} className="btn btn-primary">
          {loading ? 'Recording…' : 'Record Receipt'}
        </button>
      </div>
    </form>
  );
}
