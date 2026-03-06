'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adsApi } from '@/lib/api/ads';
import type { AdsImportResult } from '@/types';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AdsImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [brand, setBrand] = useState('Anthrilo');
  const [result, setResult] = useState<AdsImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => adsApi.importCsv(file, brand),
    onSuccess: (res) => {
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['ads'] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setResult(null);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    mutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Import Ads Data from CSV</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Upload a CSV file with your ads data. The system will automatically map columns like
          &quot;Date&quot;, &quot;Channel&quot;, &quot;Spend&quot;, &quot;Ads Sale&quot;, &quot;Total Sale&quot;, etc.
          Required columns: <strong>Date, Channel, Spend, Ads Sale, Total Sale</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* File selector */}
          <div className="md:col-span-2">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer 
                         hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/30 dark:hover:bg-primary-950/20 transition-all"
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-primary-500" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to select a CSV file</p>
                  <p className="text-xs text-slate-400 mt-1">or drag and drop here</p>
                </>
              )}
            </div>
          </div>

          {/* Brand & Upload */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Default Brand</label>
              <select value={brand} onChange={e => setBrand(e.target.value)} className="input">
                <option value="Anthrilo">Anthrilo</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <button onClick={handleUpload} disabled={!selectedFile || mutation.isPending}
              className="btn btn-primary flex items-center justify-center gap-2 mt-auto">
              <Upload className="w-4 h-4" />
              {mutation.isPending ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="card bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <p className="text-sm text-rose-700 dark:text-rose-300">
              Import failed. Please check your CSV format and try again.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800/50">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Import Complete</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Imported:</span>{' '}
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{result.imported}</span>
              </div>
              <div>
                <span className="text-slate-500">Errors:</span>{' '}
                <span className={`font-bold ${result.total_errors > 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {result.total_errors}
                </span>
              </div>
            </div>
          </div>

          {/* Column Mapping */}
          {result.column_mapping && Object.keys(result.column_mapping).length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Column Mapping Used</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {Object.entries(result.column_mapping).map(([csv, field]) => (
                  <div key={csv} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-slate-500">{csv}</span>
                    <span className="text-slate-300 dark:text-slate-600">→</span>
                    <span className="font-mono font-medium text-primary-600 dark:text-primary-400">{field}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-300 mb-3">
                Errors ({result.total_errors} total, showing first {result.errors.length})
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex gap-3 text-xs p-2 rounded-lg bg-rose-50 dark:bg-rose-900/10">
                    <span className="text-rose-500 font-mono">Row {err.row}</span>
                    <span className="text-rose-700 dark:text-rose-300">{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Format Help */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Supported CSV Format</h3>
        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
          <p>The importer automatically recognizes these column names (case-insensitive):</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {['Date', 'Channel', 'Brand', 'Campaign', 'Impressions', 'Clicks', 'CPC',
              'Spend / Ad Spend / Cost', 'Spend With Tax', 'Ads Sale / Ad Sales',
              'Total Sale / Total Sales', 'Units Sold / Quantity'].map(col => (
              <div key={col} className="px-2 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono">{col}</div>
            ))}
          </div>
          <p>Supported date formats: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">YYYY-MM-DD</code>,{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">DD-MM-YYYY</code>,{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">DD/MM/YYYY</code>,{' '}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">MM/DD/YYYY</code>
          </p>
        </div>
      </div>
    </div>
  );
}
