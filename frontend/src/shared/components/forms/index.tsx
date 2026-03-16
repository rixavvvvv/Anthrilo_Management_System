'use client';

import React from 'react';
import { cn } from '@/shared/utils';

// --- TextInput ---

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  error?: string;
  hint?: string;
  onChange?: (value: string) => void;
}

export function TextInput({ label, error, hint, onChange, className, id, ...rest }: TextInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {rest.required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={inputId}
        className={cn('input', error && 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500', className)}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-rose-500 dark:text-rose-400">{error}</p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}

// --- NumberInput ---

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label: string;
  error?: string;
  hint?: string;
  onChange?: (value: number | undefined) => void;
}

export function NumberInput({ label, error, hint, onChange, className, id, ...rest }: NumberInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {rest.required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={inputId}
        type="number"
        className={cn('input', error && 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500', className)}
        onChange={(e) => {
          const val = e.target.value;
          onChange?.(val === '' ? undefined : Number(val));
        }}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

// --- SelectInput ---

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  error,
  required,
  disabled,
  className,
  id,
}: SelectInputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('input', error && 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500', className)}
        aria-invalid={!!error}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
    </div>
  );
}

// --- DatePicker (native browser input) ---

interface DatePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  min,
  max,
  required,
  disabled,
  className,
  id,
}: DatePickerProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={inputId}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className={cn('input', error && 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500', className)}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
    </div>
  );
}

// --- TextArea ---

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  error?: string;
  onChange?: (value: string) => void;
}

export function TextArea({ label, error, onChange, className, id, ...rest }: TextAreaProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {rest.required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <textarea
        id={inputId}
        className={cn('input min-h-[80px] resize-y', error && 'border-rose-400', className)}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>}
    </div>
  );
}
