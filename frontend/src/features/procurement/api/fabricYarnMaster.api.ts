import { apiClient } from '@/lib/api-client';
import type {
  FabricYarnImportRow,
  FabricYarnImportSummary,
  FabricYarnMaster,
  FabricYarnMasterCreatePayload,
  FabricYarnMasterFilterOptions,
  FabricYarnMasterListParams,
  FabricYarnMasterListResponse,
  FabricYarnMasterUpdatePayload,
} from '../types/fabricYarnMaster.types';

interface FabricYarnMasterApiImportResponse {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_rows: number;
  failed_rows: number;
  errors: Array<{ row: number; error: string }>;
}

interface FabricYarnMasterApiRecord {
  id: number;
  yarn: string;
  yarn_percentage: number;
  yarn_price: number;
  fabric_type: string;
  print: string;
  fabric_ready_time: string;
  created_at?: string;
  updated_at?: string;
}

interface FabricYarnMasterApiListResponse {
  items: FabricYarnMasterApiRecord[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const toRecord = (row: FabricYarnMasterApiRecord): FabricYarnMaster => ({
  id: row.id,
  yarn: row.yarn,
  yarnPercentage: Number(row.yarn_percentage ?? 0),
  yarnPrice: Number(row.yarn_price ?? 0),
  fabricType: row.fabric_type,
  print: row.print,
  fabricReadyTime: row.fabric_ready_time,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPayload = (payload: FabricYarnMasterCreatePayload | FabricYarnMasterUpdatePayload) => ({
  yarn: payload.yarn,
  yarn_percentage: payload.yarnPercentage,
  yarn_price: payload.yarnPrice,
  fabric_type: payload.fabricType,
  print: payload.print,
  fabric_ready_time: payload.fabricReadyTime,
});

export const fabricYarnMasterApi = {
  getAll: async (params?: FabricYarnMasterListParams): Promise<FabricYarnMasterListResponse> => {
    const response = await apiClient.get<FabricYarnMasterApiListResponse>('/procurement/fabric-yarn-master', { params });
    return {
      ...response.data,
      items: response.data.items.map(toRecord),
    };
  },

  getFilterOptions: async (): Promise<FabricYarnMasterFilterOptions> => {
    const response = await apiClient.get<FabricYarnMasterFilterOptions>('/procurement/fabric-yarn-master/meta/filter-options');
    return response.data;
  },

  create: async (payload: FabricYarnMasterCreatePayload): Promise<FabricYarnMaster> => {
    const response = await apiClient.post<FabricYarnMasterApiRecord>('/procurement/fabric-yarn-master', toPayload(payload));
    return toRecord(response.data);
  },

  update: async (id: number, payload: FabricYarnMasterUpdatePayload): Promise<FabricYarnMaster> => {
    const response = await apiClient.put<FabricYarnMasterApiRecord>(`/procurement/fabric-yarn-master/${id}`, toPayload(payload));
    return toRecord(response.data);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/procurement/fabric-yarn-master/${id}`);
  },

  importRows: async (rows: FabricYarnImportRow[]): Promise<FabricYarnImportSummary> => {
    const apiRows = rows.map((row) => ({
      yarn: row.yarn,
      yarn_percentage: row.yarnPercentage,
      yarn_price: row.yarnPrice,
      fabric_type: row.fabricType,
      print: row.print,
      fabric_ready_time: row.fabricReadyTime,
    }));

    const response = await apiClient.post<FabricYarnMasterApiImportResponse>('/procurement/fabric-yarn-master/import', {
      rows: apiRows,
      skip_duplicates: true,
    });

    return {
      totalRows: response.data.total_rows,
      validRows: response.data.valid_rows,
      invalidRows: response.data.invalid_rows,
      importedRows: response.data.imported_rows,
      failedRows: response.data.failed_rows,
      errors: response.data.errors,
    };
  },
};
