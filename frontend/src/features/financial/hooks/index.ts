'use client';

import { useQuery } from '@tanstack/react-query';
import { adsApi } from '../api';

export function useAdsMtd() {
  return useQuery({
    queryKey: ['ads', 'mtd'],
    queryFn: () => adsApi.getMtdSummary().then((r: { data: unknown }) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdsChannels() {
  return useQuery({
    queryKey: ['ads', 'channels'],
    queryFn: () => adsApi.getAllChannelsSummary().then((r: { data: unknown }) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdsData(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ['ads', 'list', params],
    queryFn: () => adsApi.list(params).then((r: { data: unknown }) => r.data),
  });
}
