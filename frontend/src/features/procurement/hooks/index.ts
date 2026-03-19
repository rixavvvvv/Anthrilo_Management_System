'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productMasterApi, supplierApi, purchaseOrderApi, gateEntryApi, mrnApi } from '../api';

// Product Master

export function useProducts(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productMasterApi.getAll(params).then((r) => r.data),
  });
}

export function useProduct(id: number) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => productMasterApi.getById(id).then((r) => r.data),
    enabled: id > 0,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => productMasterApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      productMasterApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => productMasterApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useProductFilterOptions() {
  return useQuery({
    queryKey: ['products', 'filter-options'],
    queryFn: () => productMasterApi.getFilterOptions().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

// Suppliers

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.getAll().then((r) => r.data),
  });
}

// Purchase Orders

export function usePurchaseOrders(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => purchaseOrderApi.getAll(params).then((r) => r.data),
  });
}

// Gate Entries

export function useGateEntries(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['gate-entries', params],
    queryFn: () => gateEntryApi.getAll(params).then((r) => r.data),
  });
}

// Material Receipt Notes

export function useMRNs(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['mrns', params],
    queryFn: () => mrnApi.getAll(params).then((r) => r.data),
  });
}

export {
  useFabricYarnMasterList,
  useFabricYarnMasterFilterOptions,
  useCreateFabricYarnMaster,
  useUpdateFabricYarnMaster,
  useDeleteFabricYarnMaster,
  useImportFabricYarnMaster,
} from './useFabricYarnMaster';
