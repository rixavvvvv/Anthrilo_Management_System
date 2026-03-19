export interface FabricYarnMaster {
  id: number;
  yarn: string;
  yarnPercentage: number;
  yarnPrice: number;
  fabricType: string;
  print: string;
  fabricReadyTime: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FabricYarnMasterCreatePayload {
  yarn: string;
  yarnPercentage: number;
  yarnPrice: number;
  fabricType: string;
  print: string;
  fabricReadyTime: string;
}

export interface FabricYarnMasterUpdatePayload extends Partial<FabricYarnMasterCreatePayload> {}

export interface FabricYarnMasterListParams {
  skip?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  fabric_type?: string;
  print?: string;
}

export interface FabricYarnMasterListResponse {
  items: FabricYarnMaster[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FabricYarnMasterFilterOptions {
  fabric_types: string[];
  prints: string[];
  yarns: string[];
}

export interface FabricYarnImportRow {
  yarn: string;
  yarnPercentage: number;
  yarnPrice: number;
  fabricType: string;
  print: string;
  fabricReadyTime: string;
}

export interface FabricYarnImportValidationError {
  row: number;
  field: keyof FabricYarnImportRow | 'row';
  message: string;
}

export interface FabricYarnImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: FabricYarnImportValidationError[];
}

export interface FabricYarnImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  failedRows: number;
  errors: Array<{ row: number; error: string }>;
}

export interface FabricYarnImportPreviewRow extends FabricYarnImportRow {
  __rowNumber: number;
  __isValid: boolean;
  __error: string;
}
