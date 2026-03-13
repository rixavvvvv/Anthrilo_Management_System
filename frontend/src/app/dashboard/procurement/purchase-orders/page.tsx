'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseOrderApi, supplierApi } from '@/lib/api';
import type { PurchaseOrder, Supplier } from '@/types';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

const inr = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['purchase-orders', statusFilter, deptFilter],
    queryFn: () => purchaseOrderApi.getAll({
      status: statusFilter || undefined,
      department: deptFilter || undefined,
      limit: 200,
    }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => supplierApi.getAll({ is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => purchaseOrderApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setCancelId(null); },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => purchaseOrderApi.create(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setModalOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" description="Create and manage purchase orders" action={{ label: '+ New PO', onClick: () => setModalOpen(true) }} />

      <div className="flex flex-wrap gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['OPEN', 'PARTIAL', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-40" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Depts</option>
          {['YARN', 'FABRIC', 'ACCESSORIES', 'PACKING'].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && orders && orders.length === 0 && (
        <EmptyState title="No purchase orders" description="Create your first PO." action={{ label: '+ New PO', onClick: () => setModalOpen(true) }} />
      )}

      {!isLoading && orders && orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">PO #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3 text-right">Net Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((po: PurchaseOrder) => (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600 dark:text-primary-400">{po.po_number}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{po.po_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{po.supplier?.supplier_name || `#${po.supplier_id}`}</td>
                    <td className="px-4 py-3"><StatusBadge status={po.department} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(po.net_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 flex gap-2">
                      {po.status === 'OPEN' && (
                        <button onClick={() => setCancelId(po.id)} className="text-rose-600 hover:text-rose-700 text-xs font-medium">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New PO Form */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Order" wide>
        <POForm suppliers={suppliers || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        onConfirm={() => cancelId && cancelMut.mutate(cancelId)}
        title="Cancel Purchase Order"
        message="Are you sure you want to cancel this PO? This action cannot be undone."
        confirmLabel="Cancel PO"
        danger
        loading={cancelMut.isPending}
      />
    </div>
  );
}

function POForm({ suppliers, onSubmit, loading }: { suppliers: Supplier[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    po_date: new Date().toISOString().slice(0, 10),
    supplier_id: 0,
    department: 'YARN',
    delivery_terms: '',
    payment_terms: '',
    credit_days: 0,
    remarks: '',
    freight_amount: 0,
  });
  const [items, setItems] = useState([emptyItem()]);

  function emptyItem() {
    return { item_type: 'YARN', item_name: '', item_code: '', order_qty: 0, unit: 'KGS', rate: 0, discount_percent: 0, gst_percent: 5, hsn_code: '' };
  }

  const addItem = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: any) => {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mapped = items.map(it => {
      const netRate = it.rate * (1 - (it.discount_percent || 0) / 100);
      const amount = it.order_qty * netRate;
      const gstAmt = amount * (it.gst_percent || 0) / 100;
      return { ...it, net_rate: netRate, amount, gst_amount: gstAmt, net_amount: amount + gstAmt, pending_qty: it.order_qty };
    });
    onSubmit({ ...form, items: mapped });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">PO Date *</label>
          <input className="input" type="date" required value={form.po_date} onChange={e => setForm(p => ({ ...p, po_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Supplier *</label>
          <select className="input" required value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: parseInt(e.target.value) }))}>
            <option value={0}>-- Select --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department *</label>
          <select className="input" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
            {['YARN', 'FABRIC', 'ACCESSORIES', 'PACKING'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Delivery Terms</label>
          <input className="input" value={form.delivery_terms} onChange={e => setForm(p => ({ ...p, delivery_terms: e.target.value }))} />
        </div>
        <div>
          <label className="label">Payment Terms</label>
          <input className="input" value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} />
        </div>
        <div>
          <label className="label">Freight ₹</label>
          <input className="input" type="number" step="0.01" value={form.freight_amount} onChange={e => setForm(p => ({ ...p, freight_amount: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Line Items</h3>
          <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Row</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Item Name</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2 w-20">Qty</th>
                <th className="px-2 py-2 w-16">Unit</th>
                <th className="px-2 py-2 w-20">Rate</th>
                <th className="px-2 py-2 w-16">Disc%</th>
                <th className="px-2 py-2 w-16">GST%</th>
                <th className="px-2 py-2 w-16">HSN</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1.5">
                    <select className="input py-1 text-xs" value={it.item_type} onChange={e => updateItem(i, 'item_type', e.target.value)}>
                      {['YARN', 'FABRIC', 'ACCESSORY', 'PACKING'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" value={it.item_name} onChange={e => updateItem(i, 'item_name', e.target.value)} required /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" value={it.item_code} onChange={e => updateItem(i, 'item_code', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.order_qty} onChange={e => updateItem(i, 'order_qty', parseFloat(e.target.value) || 0)} required /></td>
                  <td className="px-2 py-1.5">
                    <select className="input py-1 text-xs" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                      {['KGS', 'MTR', 'PCS', 'NOS', 'SET'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} required /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.discount_percent} onChange={e => updateItem(i, 'discount_percent', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.gst_percent} onChange={e => updateItem(i, 'gst_percent', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" value={it.hsn_code} onChange={e => updateItem(i, 'hsn_code', e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-rose-500 hover:text-rose-600 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="label">Remarks</label>
        <textarea className="input" rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || form.supplier_id === 0} className="btn btn-primary">
          {loading ? 'Creating…' : 'Create Purchase Order'}
        </button>
      </div>
    </form>
  );
}
