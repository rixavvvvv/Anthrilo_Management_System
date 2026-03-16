'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processingApi, supplierApi } from '@/features/manufacturing';
import type { ProcessingOrder, Supplier } from '@/features/manufacturing';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { FormModal } from '@/components/ui/FormModal';

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function ProcessingPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState<'orders' | 'grey' | 'finished'>('orders');
  const [modalOpen, setModalOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['processing-orders', statusFilter],
    queryFn: () => processingApi.getOrders({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-processors'],
    queryFn: () => supplierApi.getAll({ supplier_type: 'PROCESSOR', is_active: true }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: greyStore } = useQuery({
    queryKey: ['grey-fabric-store'],
    queryFn: () => processingApi.getGreyFabricStore().then(r => r.data),
    enabled: tab === 'grey',
  });

  const { data: finishedStore } = useQuery({
    queryKey: ['finished-fabric-store'],
    queryFn: () => processingApi.getFinishedFabricStore().then(r => r.data),
    enabled: tab === 'finished',
  });

  const createMut = useMutation({
    mutationFn: (data: any) => processingApi.createOrder(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processing-orders'] }); setModalOpen(false); },
  });

  const issueMut = useMutation({
    mutationFn: (data: any) => processingApi.issueGreyFabric(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processing'] }); setIssueOpen(false); },
  });

  const receiptMut = useMutation({
    mutationFn: (data: any) => processingApi.receiveFinishedFabric(data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['processing'] }); setReceiptOpen(false); },
  });

  const tabs = [
    { key: 'orders' as const, label: 'Processing Orders' },
    { key: 'grey' as const, label: 'Grey Fabric Store' },
    { key: 'finished' as const, label: 'Finished Fabric Store' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Processing / Dyeing" description="Manage dyeing & processing job work" action={{ label: '+ New Order', onClick: () => setModalOpen(true) }} />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {tab === 'orders' && (
          <>
            <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {['OPEN', 'IN_PROGRESS', 'COMPLETED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setIssueOpen(true)} className="btn btn-primary text-sm">Issue Grey Fabric</button>
            <button onClick={() => setReceiptOpen(true)} className="btn btn-primary text-sm">Receive Finished Fabric</button>
          </>
        )}
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}

      {tab === 'orders' && (
        <>
          <ProgressLoader loading={isLoading} />
          {!isLoading && orders && orders.length === 0 && <EmptyState title="No processing orders" />}
          {!isLoading && orders && orders.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Processor</th>
                      <th className="px-4 py-3">Process</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orders.map((o: ProcessingOrder) => (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-primary-600">{o.order_number}</td>
                        <td className="px-4 py-3 text-slate-500">{o.order_date}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{o.processor?.supplier_name || `#${o.processor_supplier_id}`}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.process_type} /></td>
                        <td className="px-4 py-3 text-slate-500">{o.target_date || '-'}</td>
                        <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'grey' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Fabric ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Array.isArray(greyStore) ? greyStore : []).map((f: any) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-mono text-xs">#{f.id}</td>
                    <td className="px-4 py-3 font-medium">{f.fabric_type} - {f.subtype}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(f.stock_quantity)}</td>
                    <td className="px-4 py-3 text-slate-500">{f.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'finished' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Fabric ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Array.isArray(finishedStore) ? finishedStore : []).map((f: any) => (
                  <tr key={f.id}>
                    <td className="px-4 py-3 font-mono text-xs">#{f.id}</td>
                    <td className="px-4 py-3 font-medium">{f.fabric_type} - {f.subtype}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{fmt(f.stock_quantity)}</td>
                    <td className="px-4 py-3 text-slate-500">{f.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Order */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Processing Order">
        <ProcessingOrderForm suppliers={suppliers || []} onSubmit={v => createMut.mutate(v)} loading={createMut.isPending} />
      </FormModal>

      {/* Grey Fabric Issue */}
      <FormModal open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue Grey Fabric">
        <GreyIssueForm orders={orders || []} onSubmit={v => issueMut.mutate(v)} loading={issueMut.isPending} />
      </FormModal>

      {/* Finished Fabric Receipt */}
      <FormModal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Receive Finished Fabric">
        <FinishedReceiptForm orders={orders || []} onSubmit={v => receiptMut.mutate(v)} loading={receiptMut.isPending} />
      </FormModal>
    </div>
  );
}

function ProcessingOrderForm({ suppliers, onSubmit, loading }: { suppliers: Supplier[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ order_date: new Date().toISOString().slice(0, 10), processor_supplier_id: 0, process_type: 'DYEING', target_date: '', remarks: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, target_date: form.target_date || undefined }); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Order Date *</label><input className="input" type="date" required value={form.order_date} onChange={e => set('order_date', e.target.value)} /></div>
        <div>
          <label className="label">Processor *</label>
          <select className="input" required value={form.processor_supplier_id} onChange={e => set('processor_supplier_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Process Type *</label>
          <select className="input" value={form.process_type} onChange={e => set('process_type', e.target.value)}>
            {['DYEING', 'PRINTING', 'WASHING', 'FINISHING', 'COMPACTING'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label className="label">Target Date</label><input className="input" type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} /></div>
      </div>
      <div><label className="label">Remarks</label><textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.processor_supplier_id} className="btn btn-primary">{loading ? 'Creating…' : 'Create Order'}</button></div>
    </form>
  );
}

function GreyIssueForm({ orders, onSubmit, loading }: { orders: ProcessingOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ issue_date: new Date().toISOString().slice(0, 10), processing_order_id: 0, fabric_id: 0, qty_issued: 0, lot_number: '', color: '', remarks: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Issue Date *</label><input className="input" type="date" required value={form.issue_date} onChange={e => set('issue_date', e.target.value)} /></div>
        <div>
          <label className="label">Processing Order *</label>
          <select className="input" required value={form.processing_order_id} onChange={e => set('processing_order_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {orders.filter(o => o.status !== 'COMPLETED').map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
          </select>
        </div>
        <div><label className="label">Fabric ID *</label><input className="input" type="number" required value={form.fabric_id || ''} onChange={e => set('fabric_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Qty (kg) *</label><input className="input" type="number" step="0.01" required value={form.qty_issued || ''} onChange={e => set('qty_issued', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Lot #</label><input className="input" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} /></div>
        <div><label className="label">Color</label><input className="input" value={form.color} onChange={e => set('color', e.target.value)} /></div>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.processing_order_id || !form.fabric_id} className="btn btn-primary">{loading ? 'Issuing…' : 'Issue Grey Fabric'}</button></div>
    </form>
  );
}

function FinishedReceiptForm({ orders, onSubmit, loading }: { orders: ProcessingOrder[]; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ receipt_date: new Date().toISOString().slice(0, 10), processing_order_id: 0, fabric_id: 0, qty_received: 0, qty_rejected: 0, lot_number: '', color: '', shade_code: '', gsm_actual: 0, shrinkage_percent: 0, remarks: '' });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Receipt Date *</label><input className="input" type="date" required value={form.receipt_date} onChange={e => set('receipt_date', e.target.value)} /></div>
        <div>
          <label className="label">Processing Order *</label>
          <select className="input" required value={form.processing_order_id} onChange={e => set('processing_order_id', parseInt(e.target.value))}>
            <option value={0}>-- Select --</option>
            {orders.map(o => <option key={o.id} value={o.id}>{o.order_number}</option>)}
          </select>
        </div>
        <div><label className="label">Fabric ID *</label><input className="input" type="number" required value={form.fabric_id || ''} onChange={e => set('fabric_id', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Qty Received (kg) *</label><input className="input" type="number" step="0.01" required value={form.qty_received || ''} onChange={e => set('qty_received', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Qty Rejected (kg)</label><input className="input" type="number" step="0.01" value={form.qty_rejected || ''} onChange={e => set('qty_rejected', parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Lot #</label><input className="input" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} /></div>
        <div><label className="label">Color</label><input className="input" value={form.color} onChange={e => set('color', e.target.value)} /></div>
        <div><label className="label">Shade Code</label><input className="input" value={form.shade_code} onChange={e => set('shade_code', e.target.value)} /></div>
        <div><label className="label">Actual GSM</label><input className="input" type="number" value={form.gsm_actual || ''} onChange={e => set('gsm_actual', parseInt(e.target.value) || 0)} /></div>
        <div><label className="label">Shrinkage %</label><input className="input" type="number" step="0.01" value={form.shrinkage_percent || ''} onChange={e => set('shrinkage_percent', parseFloat(e.target.value) || 0)} /></div>
      </div>
      <div className="flex justify-end pt-2"><button type="submit" disabled={loading || !form.processing_order_id || !form.fabric_id} className="btn btn-primary">{loading ? 'Recording…' : 'Record Receipt'}</button></div>
    </form>
  );
}
