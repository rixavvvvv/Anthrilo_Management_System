import type {
  FabricYarnImportPreviewRow,
  FabricYarnImportRow,
  FabricYarnImportValidationError,
  FabricYarnImportValidationResult,
} from '../types/fabricYarnMaster.types';

const TEMPLATE_COLUMNS = [
  'Yarn',
  'Yarn Percentage',
  'Yarn Price',
  'Fabric Type',
  'Print',
  'Fabric Ready Time',
] as const;

const HEADER_ALIASES: Record<string, keyof FabricYarnImportRow> = {
  yarn: 'yarn',
  'yarn percentage': 'yarnPercentage',
  yarnpercentage: 'yarnPercentage',
  'yarn %': 'yarnPercentage',
  'yarn price': 'yarnPrice',
  yarnprice: 'yarnPrice',
  'fabric type': 'fabricType',
  fabrictype: 'fabricType',
  print: 'print',
  'fabric ready time': 'fabricReadyTime',
  fabricreadytime: 'fabricReadyTime',
};

const normalizeHeader = (value: string): keyof FabricYarnImportRow | null => {
  const key = value.trim().toLowerCase().replace(/[_-]/g, ' ');
  return HEADER_ALIASES[key] ?? null;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toStringValue = (value: unknown): string => (value ?? '').toString().trim();

export function validateFabricYarnImportRow(row: FabricYarnImportRow, rowNumber: number): FabricYarnImportValidationError[] {
  const errors: FabricYarnImportValidationError[] = [];

  if (!row.yarn.trim()) {
    errors.push({ row: rowNumber, field: 'yarn', message: 'Yarn is required' });
  }

  if (!Number.isFinite(row.yarnPercentage)) {
    errors.push({ row: rowNumber, field: 'yarnPercentage', message: 'Yarn Percentage must be numeric' });
  } else if (row.yarnPercentage < 0 || row.yarnPercentage > 100) {
    errors.push({ row: rowNumber, field: 'yarnPercentage', message: 'Yarn Percentage must be between 0 and 100' });
  }

  if (!Number.isFinite(row.yarnPrice)) {
    errors.push({ row: rowNumber, field: 'yarnPrice', message: 'Yarn Price must be numeric' });
  } else if (row.yarnPrice < 0) {
    errors.push({ row: rowNumber, field: 'yarnPrice', message: 'Yarn Price cannot be negative' });
  }

  if (!row.fabricType.trim()) {
    errors.push({ row: rowNumber, field: 'fabricType', message: 'Fabric Type is required' });
  }

  if (!row.print.trim()) {
    errors.push({ row: rowNumber, field: 'print', message: 'Print is required' });
  }

  if (!row.fabricReadyTime.trim()) {
    errors.push({ row: rowNumber, field: 'fabricReadyTime', message: 'Fabric Ready Time is required' });
  }

  return errors;
}

export async function parseFabricYarnImportFile(file: File): Promise<{
  rows: FabricYarnImportPreviewRow[];
  validation: FabricYarnImportValidationResult;
}> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const errors: FabricYarnImportValidationError[] = [];
  const rows: FabricYarnImportPreviewRow[] = [];

  sheetData.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const mapped: Partial<FabricYarnImportRow> = {};

    for (const [header, value] of Object.entries(rawRow)) {
      const key = normalizeHeader(header);
      if (!key) continue;

      if (key === 'yarnPercentage' || key === 'yarnPrice') {
        mapped[key] = toNumber(value) as never;
      } else {
        mapped[key] = toStringValue(value) as never;
      }
    }

    const row: FabricYarnImportRow = {
      yarn: toStringValue(mapped.yarn),
      yarnPercentage: Number(mapped.yarnPercentage),
      yarnPrice: Number(mapped.yarnPrice),
      fabricType: toStringValue(mapped.fabricType),
      print: toStringValue(mapped.print),
      fabricReadyTime: toStringValue(mapped.fabricReadyTime),
    };

    const rowErrors = validateFabricYarnImportRow(row, rowNumber);
    errors.push(...rowErrors);

    rows.push({
      ...row,
      __rowNumber: rowNumber,
      __isValid: rowErrors.length === 0,
      __error: rowErrors.map((err) => err.message).join('; '),
    });
  });

  const invalidRows = rows.filter((row) => !row.__isValid).length;

  return {
    rows,
    validation: {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      errors,
    },
  };
}

export function getValidImportRows(rows: FabricYarnImportPreviewRow[]): FabricYarnImportRow[] {
  return rows
    .filter((row) => row.__isValid)
    .map((row) => ({
      yarn: row.yarn,
      yarnPercentage: row.yarnPercentage,
      yarnPrice: row.yarnPrice,
      fabricType: row.fabricType,
      print: row.print,
      fabricReadyTime: row.fabricReadyTime,
    }));
}

export function downloadFabricYarnImportTemplate(): void {
  const header = TEMPLATE_COLUMNS.join(',');
  const sample = 'Cotton 40s,60,320,Cotton Knit,Solid,5 days';
  const csv = `${header}\n${sample}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fabric-yarn-master-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export const fabricYarnTemplateColumns = [...TEMPLATE_COLUMNS];
