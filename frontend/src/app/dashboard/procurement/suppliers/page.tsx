'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierApi } from '@/features/procurement';
import type { Supplier } from '@/features/procurement';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { FormModal } from '@/components/ui/FormModal';
import { StatusBadge } from '@/components/ui/StatusBadge';

const SUPPLIER_TYPES = ['YARN_SUPPLIER', 'FABRIC_SUPPLIER', 'KNITTER', 'PROCESSOR', 'STITCHER', 'OTHER'] as const;

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suppliers', debouncedSearch, typeFilter],
    queryFn: () => supplierApi.getAll({
      search: debouncedSearch || undefined,
      supplier_type: typeFilter || undefined,
    }).then(r => r.data),
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (vals: any) =>
      editing
        ? supplierApi.update(editing.id, vals).then(r => r.data)
        : supplierApi.create(vals).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeModal(); },
  });

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Manage yarn, fabric, knitter & processing suppliers" action={{ label: '+ New Supplier', onClick: openNew }} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="input w-full sm:w-72"
          placeholder="Search name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-full sm:w-56" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && data && data.length === 0 && (
        <EmptyState title="No suppliers found" description="Add your first supplier to get started." action={{ label: '+ New Supplier', onClick: openNew }} />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="card overflow-hidden">
          <div className="table-scroll-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((s: Supplier) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{s.supplier_code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.supplier_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.supplier_type} /></td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.city || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.phone || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.gstin || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-semibold rounded-full px-2 py-0.5 ${s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(s)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <FormModal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <SupplierForm initial={editing} onSubmit={vals => saveMut.mutate(vals)} loading={saveMut.isPending} />
      </FormModal>
    </div>
  );
}

function SupplierForm({ initial, onSubmit, loading }: { initial?: Supplier | null; onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    supplier_code: initial?.supplier_code || '',
    supplier_name: initial?.supplier_name || '',
    supplier_type: initial?.supplier_type || 'YARN_SUPPLIER',
    contact_person: initial?.contact_person || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    address: initial?.address || '',
    city: initial?.city || '',
    state: initial?.state || '',
    gstin: initial?.gstin || '',
    pan: initial?.pan || '',
    payment_terms: initial?.payment_terms || '',
    credit_days: initial?.credit_days ?? 0,
    is_active: initial?.is_active ?? true,
  });

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Supplier Code *</label>
          <input className="input" required value={form.supplier_code} onChange={e => set('supplier_code', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier Name *</label>
          <input className="input" required value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.supplier_type} onChange={e => set('supplier_type', e.target.value)}>
            {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Contact Person</label>
          <input className="input" value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">State</label>
          <input className="input" value={form.state} onChange={e => set('state', e.target.value)} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" value={form.gstin} onChange={e => set('gstin', e.target.value)} />
        </div>
        <div>
          <label className="label">PAN</label>
          <input className="input" value={form.pan} onChange={e => set('pan', e.target.value)} />
        </div>
        <div>
          <label className="label">Payment Terms</label>
          <input className="input" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} />
        </div>
        <div>
          <label className="label">Credit Days</label>
          <input className="input" type="number" value={form.credit_days} onChange={e => set('credit_days', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
        <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading} className="btn btn-primary w-full sm:w-auto">
          {loading ? 'Saving…' : initial ? 'Update Supplier' : 'Create Supplier'}
        </button>
      </div>
    </form>
  );
}
