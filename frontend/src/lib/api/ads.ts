import { apiClient } from '@/lib/api-client';
import type { AdsData, AdsDataCreate, AdsPaginatedResponse, AdsMtdSummary, AdsChannelSummary, AdsImportResult } from '@/types';

export const adsApi = {
  create: (data: AdsDataCreate) =>
    apiClient.post<AdsData>('/ads', data),

  list: (params?: {
    page?: number;
    page_size?: number;
    channel?: string;
    brand?: string;
    start_date?: string;
    end_date?: string;
  }) => apiClient.get<AdsPaginatedResponse>('/ads', { params }),

  getById: (id: number) =>
    apiClient.get<AdsData>(`/ads/${id}`),

  update: (id: number, data: AdsDataCreate) =>
    apiClient.put<AdsData>(`/ads/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/ads/${id}`),

  getMtdSummary: (brand?: string) =>
    apiClient.get<AdsMtdSummary>('/ads/summary/mtd', { params: brand ? { brand } : {} }),

  getChannelPerformance: (channel: string, params?: { start_date?: string; end_date?: string }) =>
    apiClient.get(`/ads/summary/channel/${encodeURIComponent(channel)}`, { params }),

  getAllChannelsSummary: (params?: { start_date?: string; end_date?: string; brand?: string }) =>
    apiClient.get<{ channels: AdsChannelSummary[] }>('/ads/summary/all-channels', { params }),

  importCsv: (file: File, defaultBrand: string = 'Anthrilo') => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<AdsImportResult>(`/ads/import?default_brand=${encodeURIComponent(defaultBrand)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getChannels: () =>
    apiClient.get<{ channels: string[] }>('/ads/meta/channels'),

  getBrands: () =>
    apiClient.get<{ brands: string[] }>('/ads/meta/brands'),
};
