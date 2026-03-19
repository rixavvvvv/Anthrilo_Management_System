'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fabricYarnMasterApi } from '../api/fabricYarnMaster.api';
import type {
  FabricYarnImportRow,
  FabricYarnMasterCreatePayload,
  FabricYarnMasterListParams,
  FabricYarnMasterUpdatePayload,
} from '../types/fabricYarnMaster.types';

const LIST_KEY = ['fabric-yarn-master'] as const;

export function useFabricYarnMasterList(params: FabricYarnMasterListParams) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => fabricYarnMasterApi.getAll(params),
    staleTime: 60_000,
  });
}

export function useFabricYarnMasterFilterOptions() {
  return useQuery({
    queryKey: [...LIST_KEY, 'filter-options'],
    queryFn: () => fabricYarnMasterApi.getFilterOptions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateFabricYarnMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FabricYarnMasterCreatePayload) => fabricYarnMasterApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdateFabricYarnMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FabricYarnMasterUpdatePayload }) =>
      fabricYarnMasterApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteFabricYarnMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fabricYarnMasterApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useImportFabricYarnMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: FabricYarnImportRow[]) => fabricYarnMasterApi.importRows(rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
