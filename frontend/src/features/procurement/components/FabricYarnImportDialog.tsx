'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { FileImporter } from '@/shared/components';
import {
  downloadFabricYarnImportTemplate,
  getValidImportRows,
  parseFabricYarnImportFile,
} from '../services/fabricYarnMaster.service';
import type {
  FabricYarnImportPreviewRow,
  FabricYarnImportSummary,
  FabricYarnImportValidationResult,
} from '../types/fabricYarnMaster.types';

interface FabricYarnImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: FabricYarnImportPreviewRow[]) => Promise<FabricYarnImportSummary>;
}

export function FabricYarnImportDialog({ open, onClose, onImport }: FabricYarnImportDialogProps) {
  const [validation, setValidation] = useState<FabricYarnImportValidationResult | null>(null);
  const [summary, setSummary] = useState<FabricYarnImportSummary | null>(null);

  if (!open) return null;

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
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-2 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Import Fabric & Yarn Master</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload CSV/XLSX, validate rows, preview, then confirm import.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <button
            onClick={downloadFabricYarnImportTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Columns: Yarn, Yarn Percentage, Yarn Price, Fabric Type, Print, Fabric Ready Time
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <FileImporter
            title="Import Fabric & Yarn Master"
            description="Upload CSV or Excel in the official template format"
            accept=".csv,.xlsx,.xls"
            previewLimit={12}
            onParse={async (file) => {
              const parsed = await parseFabricYarnImportFile(file);
              setValidation(parsed.validation);
              setSummary(null);
              return parsed.rows as unknown as Record<string, string | number | null>[];
            }}
            onSubmit={async (rows) => {
              const typedRows = rows as unknown as FabricYarnImportPreviewRow[];
              const validRows = getValidImportRows(typedRows);
              if (validRows.length === 0) {
                throw new Error('No valid rows to import. Please fix validation errors first.');
              }
              const importSummary = await onImport(typedRows);
              setSummary(importSummary);
              return {
                inserted: importSummary.importedRows,
                skipped: importSummary.failedRows,
                errors: importSummary.errors.length,
                details: [
                  `Total rows: ${importSummary.totalRows}`,
                  `Valid rows: ${importSummary.validRows}`,
                  `Invalid rows: ${importSummary.invalidRows}`,
                  `Imported rows: ${importSummary.importedRows}`,
                  `Failed rows: ${importSummary.failedRows}`,
                ],
              };
            }}
          />

          {validation && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card text-center py-3">
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{validation.totalRows}</p>
                <p className="text-xs text-slate-500">Total Rows</p>
              </div>
              <div className="card text-center py-3">
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{validation.validRows}</p>
                <p className="text-xs text-slate-500">Valid Rows</p>
              </div>
              <div className="card text-center py-3">
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{validation.invalidRows}</p>
                <p className="text-xs text-slate-500">Invalid Rows</p>
              </div>
              <div className="card text-center py-3">
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{validation.errors.length}</p>
                <p className="text-xs text-slate-500">Validation Errors</p>
              </div>
            </div>
          )}

          {summary && summary.errors.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-2">Failed rows</h4>
              <div className="max-h-36 overflow-y-auto text-xs text-slate-600 dark:text-slate-300 space-y-1">
                {summary.errors.map((error, index) => (
                  <p key={`${error.row}-${index}`}>Row {error.row}: {error.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
