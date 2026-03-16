'use client';

import { useQuery } from '@tanstack/react-query';
import { knittingApi, processingApi, garmentProductionApi, yarnStoreApi } from '../api';

export function useKnitOrders(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['knit-orders', params],
    queryFn: () => knittingApi.getOrders(params).then((r) => r.data),
  });
}

export function useProcessingOrders(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['processing-orders', params],
    queryFn: () => processingApi.getOrders(params).then((r) => r.data),
  });
}

export function useCuttingOrders(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['cutting-orders', params],
    queryFn: () => garmentProductionApi.getCuttingOrders(params).then((r) => r.data),
  });
}

export function useYarnStore(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['yarn-store', params],
    queryFn: () => yarnStoreApi.getBalance(params).then((r) => r.data),
  });
}
