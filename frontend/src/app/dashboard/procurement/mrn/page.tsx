'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mrnApi, supplierApi, purchaseOrderApi, gateEntryApi } from '@/lib/api';
import type { MRN, Supplier, PurchaseOrder, GateEntry } from '@/types';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const inr = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function MRNPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const { data: mrns, isLoading, error } = useQuery({
    queryKey: ['mrns', statusFilter],
    queryFn: () => mrnApi.getAll({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => supplierApi.getAll({ is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => mrnApi.create(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mrns'] }); setModalOpen(false); },
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) => mrnApi.confirm(id).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mrns'] }); setConfirmId(null); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Materials Receipt Note" description="Record incoming material quality & quantity" action={{ label: '+ New MRN', onClick: () => setModalOpen(true) }} />

      <div className="flex gap-3">
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {['DRAFT', 'CONFIRMED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && mrns && mrns.length === 0 && (
        <EmptyState title="No MRNs found" action={{ label: '+ New MRN', onClick: () => setModalOpen(true) }} />
      )}

      {!isLoading && mrns && mrns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">MRN #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Net Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mrns.map((m: MRN) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{m.mrn_number}</td>
                    <td className="px-4 py-3 text-slate-500">{m.mrn_date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{m.supplier?.supplier_name || `#${m.supplier_id}`}</td>
                    <td className="px-4 py-3 text-slate-500">{m.mrn_type || 'Regular'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{inr(m.net_amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.status || 'DRAFT'} /></td>
                    <td className="px-4 py-3">
                      {m.status === 'DRAFT' && (
                        <button onClick={() => setConfirmId(m.id)} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">Confirm</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New MRN" wide>
        <MRNForm suppliers={suppliers || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>

      <ConfirmDialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && confirmMut.mutate(confirmId)}
        title="Confirm MRN"
        message="This will update inventory stock, PO received quantities, and gate entry status. This action cannot be undone."
        confirmLabel="Confirm MRN"
        loading={confirmMut.isPending}
      />
    </div>
  );
}

function MRNForm({ suppliers, onSubmit, loading }: { suppliers: Supplier[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    mrn_date: new Date().toISOString().slice(0, 10),
    supplier_id: 0,
    po_id: null as number | null,
    gate_entry_id: null as number | null,
    supplier_doc_no: '',
    supplier_doc_date: '',
    mrn_type: 'Regular',
    remarks: '',
    tax_type: 'GST',
    freight_amount: 0,
    other_charges: 0,
  });
  const [items, setItems] = useState([emptyItem()]);

  function emptyItem() {
    return { item_type: 'YARN', item_name: '', item_code: '', color: '', bags: 0, qty: 0, unit: 'KGS', rate: 0, discount_percent: 0, gst_percent: 5, lot_number: '', remarks: '' };
  }

  const addItem = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: any) => {
    setItems(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mapped = items.map(it => {
      const discRate = it.rate * (1 - (it.discount_percent || 0) / 100);
      const amount = it.qty * discRate;
      const gstAmt = amount * (it.gst_percent || 0) / 100;
      return { ...it, disc_rate: discRate, amount, gst_amount: gstAmt, net_amount: amount + gstAmt };
    });
    const grossAmount = mapped.reduce((s, it) => s + it.amount, 0);
    const taxAmount = mapped.reduce((s, it) => s + it.gst_amount, 0);
    const netAmount = grossAmount + taxAmount + (form.freight_amount || 0) + (form.other_charges || 0);
    onSubmit({
      ...form,
      po_id: form.po_id || undefined,
      gate_entry_id: form.gate_entry_id || undefined,
      supplier_doc_date: form.supplier_doc_date || undefined,
      gross_amount: grossAmount,
      tax_amount: taxAmount,
      net_amount: netAmount,
      items: mapped,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">MRN Date *</label>
          <input className="input" type="date" required value={form.mrn_date} onChange={e => setForm(p => ({ ...p, mrn_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Supplier *</label>
          <select className="input" required value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: parseInt(e.target.value) }))}>
            <option value={0}>-- Select --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">MRN Type</label>
          <select className="input" value={form.mrn_type} onChange={e => setForm(p => ({ ...p, mrn_type: e.target.value }))}>
            {['Regular', 'Returnable', 'Job Work'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Supplier Doc No</label>
          <input className="input" value={form.supplier_doc_no} onChange={e => setForm(p => ({ ...p, supplier_doc_no: e.target.value }))} />
        </div>
        <div>
          <label className="label">Supplier Doc Date</label>
          <input className="input" type="date" value={form.supplier_doc_date} onChange={e => setForm(p => ({ ...p, supplier_doc_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Tax Type</label>
          <select className="input" value={form.tax_type} onChange={e => setForm(p => ({ ...p, tax_type: e.target.value }))}>
            {['GST', 'IGST', 'NONE'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Items</h3>
          <button type="button" onClick={addItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add Row</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Item Name</th>
                <th className="px-2 py-2">Color</th>
                <th className="px-2 py-2 w-16">Bags</th>
                <th className="px-2 py-2 w-20">Qty</th>
                <th className="px-2 py-2 w-16">Unit</th>
                <th className="px-2 py-2 w-20">Rate</th>
                <th className="px-2 py-2 w-16">GST%</th>
                <th className="px-2 py-2">Lot#</th>
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
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" value={it.color} onChange={e => updateItem(i, 'color', e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" value={it.bags} onChange={e => updateItem(i, 'bags', parseInt(e.target.value) || 0)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.qty} onChange={e => updateItem(i, 'qty', parseFloat(e.target.value) || 0)} required /></td>
                  <td className="px-2 py-1.5">
                    <select className="input py-1 text-xs" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                      {['KGS', 'MTR', 'PCS', 'NOS'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.rate} onChange={e => updateItem(i, 'rate', parseFloat(e.target.value) || 0)} required /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" type="number" step="0.01" value={it.gst_percent} onChange={e => updateItem(i, 'gst_percent', parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-2 py-1.5"><input className="input py-1 text-xs" value={it.lot_number} onChange={e => updateItem(i, 'lot_number', e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-rose-500 hover:text-rose-600 text-xs">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Freight ₹</label>
          <input className="input" type="number" step="0.01" value={form.freight_amount} onChange={e => setForm(p => ({ ...p, freight_amount: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className="label">Other Charges ₹</label>
          <input className="input" type="number" step="0.01" value={form.other_charges} onChange={e => setForm(p => ({ ...p, other_charges: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className="label">Remarks</label>
          <input className="input" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || form.supplier_id === 0} className="btn btn-primary">
          {loading ? 'Creating…' : 'Create MRN (Draft)'}
        </button>
      </div>
    </form>
  );
}
