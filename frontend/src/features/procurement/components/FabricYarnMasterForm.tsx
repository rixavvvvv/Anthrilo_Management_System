'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { NumberInput, SelectInput, TextInput } from '@/shared/components';
import type {
  FabricYarnMaster,
  FabricYarnMasterCreatePayload,
} from '../types/fabricYarnMaster.types';

interface FabricYarnMasterFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: FabricYarnMaster | null;
  fabricTypeOptions: string[];
  printOptions: string[];
  onClose: () => void;
  onSubmit: (payload: FabricYarnMasterCreatePayload) => Promise<void>;
}

interface FormState {
  yarn: string;
  yarnPercentage: string;
  yarnPrice: string;
  fabricType: string;
  print: string;
  fabricReadyTime: string;
}

const buildInitialState = (data?: FabricYarnMaster | null): FormState => ({
  yarn: data?.yarn ?? '',
  yarnPercentage: data?.yarnPercentage != null ? String(data.yarnPercentage) : '',
  yarnPrice: data?.yarnPrice != null ? String(data.yarnPrice) : '',
  fabricType: data?.fabricType ?? '',
  print: data?.print ?? '',
  fabricReadyTime: data?.fabricReadyTime ?? '',
});

export function FabricYarnMasterForm({
  open,
  mode,
  initialData,
  fabricTypeOptions,
  printOptions,
  onClose,
  onSubmit,
}: FabricYarnMasterFormProps) {
  const [form, setForm] = useState<FormState>(buildInitialState(initialData));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initialData));
      setErrors({});
    }
  }, [open, initialData]);

  if (!open) return null;

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.yarn.trim()) nextErrors.yarn = 'Yarn is required';

    const yarnPercentage = Number(form.yarnPercentage);
    if (form.yarnPercentage === '' || Number.isNaN(yarnPercentage)) {
      nextErrors.yarnPercentage = 'Yarn Percentage must be numeric';
    } else if (yarnPercentage < 0 || yarnPercentage > 100) {
      nextErrors.yarnPercentage = 'Yarn Percentage must be between 0 and 100';
    }

    const yarnPrice = Number(form.yarnPrice);
    if (form.yarnPrice === '' || Number.isNaN(yarnPrice)) {
      nextErrors.yarnPrice = 'Yarn Price must be numeric';
    } else if (yarnPrice < 0) {
      nextErrors.yarnPrice = 'Yarn Price cannot be negative';
    }

    if (!form.fabricType.trim()) nextErrors.fabricType = 'Fabric Type is required';
    if (!form.print.trim()) nextErrors.print = 'Print is required';
    if (!form.fabricReadyTime.trim()) nextErrors.fabricReadyTime = 'Fabric Ready Time is required';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload: FabricYarnMasterCreatePayload = {
      yarn: form.yarn.trim(),
      yarnPercentage: Number(form.yarnPercentage),
      yarnPrice: Number(form.yarnPrice),
      fabricType: form.fabricType.trim(),
      print: form.print.trim(),
      fabricReadyTime: form.fabricReadyTime.trim(),
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Fabric & Yarn Record' : 'Add Fabric & Yarn Record'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage yarn composition and fabric readiness attributes.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Yarn"
              required
              value={form.yarn}
              onChange={(value) => setForm((prev) => ({ ...prev, yarn: value }))}
              error={errors.yarn}
              placeholder="e.g. Cotton 40s"
            />
            <NumberInput
              label="Yarn Percentage"
              required
              min={0}
              max={100}
              step="0.01"
              value={form.yarnPercentage}
              onChange={(value) => setForm((prev) => ({ ...prev, yarnPercentage: value == null ? '' : String(value) }))}
              error={errors.yarnPercentage}
              hint="Value between 0 and 100"
            />
            <NumberInput
              label="Yarn Price"
              required
              min={0}
              step="0.01"
              value={form.yarnPrice}
              onChange={(value) => setForm((prev) => ({ ...prev, yarnPrice: value == null ? '' : String(value) }))}
              error={errors.yarnPrice}
            />
            <SelectInput
              label="Fabric Type"
              required
              value={form.fabricType}
              onChange={(value) => setForm((prev) => ({ ...prev, fabricType: value }))}
              options={fabricTypeOptions.map((value) => ({ label: value, value }))}
              placeholder="Select fabric type"
              error={errors.fabricType}
            />
            <SelectInput
              label="Print"
              required
              value={form.print}
              onChange={(value) => setForm((prev) => ({ ...prev, print: value }))}
              options={printOptions.map((value) => ({ label: value, value }))}
              placeholder="Select print"
              error={errors.print}
            />
            <TextInput
              label="Fabric Ready Time"
              required
              value={form.fabricReadyTime}
              onChange={(value) => setForm((prev) => ({ ...prev, fabricReadyTime: value }))}
              error={errors.fabricReadyTime}
              placeholder="e.g. 5 days"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'edit' ? 'Save Changes' : 'Add Record'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
