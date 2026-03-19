'use client';

import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { EnterpriseTable, type ColumnDef } from '@/shared/components';
import type { FabricYarnMaster } from '../types/fabricYarnMaster.types';

interface FabricYarnMasterTableProps {
  records: FabricYarnMaster[];
  isLoading?: boolean;
  onEdit: (record: FabricYarnMaster) => void;
  onDelete: (record: FabricYarnMaster) => void;
}

export function FabricYarnMasterTable({ records, isLoading, onEdit, onDelete }: FabricYarnMasterTableProps) {
  const columns = useMemo<ColumnDef<FabricYarnMaster, unknown>[]>(() => [
    {
      accessorKey: 'yarn',
      header: 'Yarn',
      cell: ({ row }) => <span className="font-medium text-slate-800 dark:text-slate-100">{row.original.yarn}</span>,
    },
    {
      accessorKey: 'yarnPercentage',
      header: 'Yarn %',
      cell: ({ row }) => <span className="tabular-nums">{row.original.yarnPercentage.toFixed(2)}%</span>,
    },
    {
      accessorKey: 'yarnPrice',
      header: 'Yarn Price',
      cell: ({ row }) => <span className="tabular-nums">₹{row.original.yarnPrice.toFixed(2)}</span>,
    },
    {
      accessorKey: 'fabricType',
      header: 'Fabric Type',
    },
    {
      accessorKey: 'print',
      header: 'Print',
    },
    {
      accessorKey: 'fabricReadyTime',
      header: 'Fabric Ready Time',
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => onEdit(row.original)}
            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-400 hover:text-primary-500 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(row.original)}
            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], [onDelete, onEdit]);

  return (
    <EnterpriseTable
      data={records}
      columns={columns}
      isLoading={isLoading}
      searchable
      searchPlaceholder="Search yarn, fabric type, print..."
      exportable
      exportFileName="fabric-yarn-master"
      emptyMessage="No Fabric & Yarn records found"
      pageSize={25}
    />
  );
}
