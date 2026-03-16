'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { cn } from '@/shared/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: number;
  details?: string[];
}

interface FileImporterProps {
  /** Accepted MIME types */
  accept?: string;
  /** Label shown above the drop area */
  title?: string;
  description?: string;
  /** Parse file and return rows. Throw on error. */
  onParse: (file: File) => Promise<ParsedRow[]>;
  /** Submit parsed rows. Return import result. */
  onSubmit: (rows: ParsedRow[]) => Promise<ImportResult>;
  /** Max preview rows */
  previewLimit?: number;
  className?: string;
}

// --- Component ---

export function FileImporter({
  accept = '.csv,.xlsx,.xls',
  title = 'Import Data',
  description = 'Upload a CSV or Excel file',
  onParse,
  onSubmit,
  previewLimit = 10,
  className,
}: FileImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
    setHeaders([]);
    setStep('upload');
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    setFile(f);
    try {
      const parsed = await onParse(f);
      if (parsed.length === 0) {
        setError('The file contains no data rows.');
        return;
      }
      setHeaders(Object.keys(parsed[0]));
      setRows(parsed);
      setStep('preview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
    }
  }, [onParse]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = useCallback(async () => {
    if (rows.length === 0) return;
    setStep('importing');
    setError(null);
    try {
      const res = await onSubmit(rows);
      setResult(res);
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStep('preview');
    }
  }, [rows, onSubmit]);

  const previewRows = rows.slice(0, previewLimit);

  return (
    <div className={cn('space-y-4', className)}>
      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
                dragOver
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-slate-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{description}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Drag & drop or click to browse
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* File info */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{file?.name}</p>
                  <p className="text-xs text-slate-400">{rows.length} rows detected</p>
                </div>
              </div>
              <button onClick={reset} className="btn btn-ghost text-xs p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row[h] != null ? String(row[h]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > previewLimit && (
              <p className="text-xs text-slate-400 text-center">
                Showing {previewLimit} of {rows.length} rows
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button onClick={reset} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSubmit} className="btn btn-primary text-sm">
                Import {rows.length} Rows
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <motion.div
            key="importing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="card text-center py-12"
          >
            <div className="w-10 h-10 mx-auto mb-4 border-[3px] border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Importing data…</p>
          </motion.div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="card space-y-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Import Complete</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{result.inserted}</p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Inserted</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.skipped}</p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Skipped</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{result.errors}</p>
                <p className="text-xs text-rose-600/70 dark:text-rose-400/70">Errors</p>
              </div>
            </div>
            {result.details && result.details.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                {result.details.map((d, i) => (
                  <p key={i}>• {d}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={reset} className="btn btn-secondary text-sm">
                Import Another
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
}
