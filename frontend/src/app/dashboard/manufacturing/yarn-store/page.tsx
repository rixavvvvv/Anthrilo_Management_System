'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yarnStoreApi } from '@/lib/api';
import type { InventoryTransaction } from '@/types';
import { PageHeader, ProgressLoader, EmptyState, ErrorPanel } from '@/components/ui';
import { FormModal } from '@/components/ui/FormModal';
import { StatusBadge } from '@/components/ui/StatusBadge';

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function YarnStorePage() {
  const qc = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [ledgerYarnId, setLedgerYarnId] = useState<number | null>(null);

  const { data: balances, isLoading, error } = useQuery({
    queryKey: ['yarn-store-balance'],
    queryFn: () => yarnStoreApi.getBalance().then(r => r.data),
    staleTime: 30_000,
  });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['yarn-store-ledger', ledgerYarnId],
    queryFn: () => yarnStoreApi.getLedger({ yarn_id: ledgerYarnId!, limit: 100 }).then(r => r.data),
    enabled: ledgerYarnId !== null,
  });

  const adjustMut = useMutation({
    mutationFn: (data: any) => yarnStoreApi.adjust(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['yarn-store'] }); setAdjustOpen(false); },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Yarn Store" description="Current yarn balances & inventory ledger" action={{ label: '± Manual Adjustment', onClick: () => setAdjustOpen(true) }} />

      {error && <ErrorPanel message={(error as Error).message} />}
      <ProgressLoader loading={isLoading} />

      {!isLoading && balances && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3">Yarn ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Stock Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Array.isArray(balances) ? balances : []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">#{b.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{b.yarn_type} - {b.yarn_count}</td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${b.stock_quantity <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(b.stock_quantity)}</td>
                    <td className="px-4 py-3 text-slate-500">{b.unit}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setLedgerYarnId(b.id)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">Ledger</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      <FormModal open={ledgerYarnId !== null} onClose={() => setLedgerYarnId(null)} title={`Yarn Ledger #${ledgerYarnId}`} wide>
        <ProgressLoader loading={ledgerLoading} />
        {ledgerData && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(Array.isArray(ledgerData) ? ledgerData : []).map((txn: InventoryTransaction) => (
                  <tr key={txn.id}>
                    <td className="px-3 py-2 text-slate-500 text-xs">{txn.transaction_date}</td>
                    <td className="px-3 py-2"><StatusBadge status={txn.transaction_type} /></td>
                    <td className="px-3 py-2 font-mono text-xs">{txn.reference_number}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${txn.transaction_type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {txn.transaction_type === 'IN' ? '+' : '-'}{fmt(txn.quantity)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{fmt(txn.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormModal>

      {/* Adjustment Modal */}
      <FormModal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Manual Stock Adjustment">
        <AdjustForm onSubmit={v => adjustMut.mutate(v)} loading={adjustMut.isPending} />
      </FormModal>
    </div>
  );
}

function AdjustForm({ onSubmit, loading }: { onSubmit: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({ yarn_id: 0, transaction_type: 'IN', quantity: 0, reference_number: '', transaction_date: new Date().toISOString().slice(0, 10) });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Yarn ID *</label>
          <input className="input" type="number" required value={form.yarn_id || ''} onChange={e => set('yarn_id', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Type *</label>
          <select className="input" value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}>
            <option value="IN">IN (Add)</option>
            <option value="OUT">OUT (Remove)</option>
          </select>
        </div>
        <div>
          <label className="label">Quantity *</label>
          <input className="input" type="number" step="0.01" required value={form.quantity || ''} onChange={e => set('quantity', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Date *</label>
          <input className="input" type="date" required value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Reference # *</label>
          <input className="input" required value={form.reference_number} onChange={e => set('reference_number', e.target.value)} placeholder="e.g. ADJ-001" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading || !form.yarn_id} className="btn btn-primary">
          {loading ? 'Processing…' : 'Submit Adjustment'}
        </button>
      </div>
    </form>
  );
}
