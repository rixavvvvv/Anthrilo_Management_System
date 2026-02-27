import { apiClient } from '@/lib/api-client';
import type { Garment, Inventory, Panel, Sale, ProductionPlan } from '@/types';

// Export all reports API
export * from './reports';

// Garment API
export const garmentApi = {
  getAll: (params?: { category?: string; is_active?: boolean }) =>
    apiClient.get<Garment[]>('/garments', { params }),
  getById: (id: number) => apiClient.get<Garment>(`/garments/${id}`),
  getBySku: (sku: string) => apiClient.get<Garment>(`/garments/sku/${sku}`),
  create: (data: Partial<Garment>) => apiClient.post<Garment>('/garments', data),
  update: (id: number, data: Partial<Garment>) =>
    apiClient.put<Garment>(`/garments/${id}`, data),
  delete: (id: number) => apiClient.delete(`/garments/${id}`),
};

// Inventory API
export const inventoryApi = {
  getAll: () => apiClient.get<Inventory[]>('/inventory'),
  getByGarment: (garmentId: number) =>
    apiClient.get<Inventory[]>(`/inventory/garment/${garmentId}`),
  getLowStock: (threshold: number = 10) =>
    apiClient.get<Inventory[]>(`/inventory/low-stock?threshold=${threshold}`),
  create: (data: Partial<Inventory>) => apiClient.post<Inventory>('/inventory', data),
  update: (id: number, data: Partial<Inventory>) =>
    apiClient.put<Inventory>(`/inventory/${id}`, data),
};

// Panel API
export const panelApi = {
  getAll: (params?: { is_active?: boolean; panel_type?: string }) =>
    apiClient.get<Panel[]>('/panels', { params }),
  getById: (id: number) => apiClient.get<Panel>(`/panels/${id}`),
  create: (data: Partial<Panel>) => apiClient.post<Panel>('/panels', data),
};

// Sales API
export const salesApi = {
  getAll: (params?: {
    start_date?: string;
    end_date?: string;
    panel_id?: number;
  }) => apiClient.get<Sale[]>('/sales', { params }),
  getDaily: (date: string) => apiClient.get<Sale[]>(`/sales/daily/${date}`),
  create: (data: Partial<Sale>) => apiClient.post<Sale>('/sales', data),
};

// Production API
export const productionApi = {
  getAllPlans: (params?: { status?: string }) =>
    apiClient.get<ProductionPlan[]>('/production/plans', { params }),
  getPlan: (id: number) => apiClient.get<ProductionPlan>(`/production/plans/${id}`),
  createPlan: (data: Partial<ProductionPlan>) =>
    apiClient.post<ProductionPlan>('/production/plans', data),
};

// Unicommerce integration API
export const unicommerceApi = {
  // Summary endpoints (for dashboard cards)
  getToday: () => apiClient.get('/integrations/unicommerce/today'),
  getYesterday: () => apiClient.get('/integrations/unicommerce/yesterday'),
  getLast7Days: () => apiClient.get('/integrations/unicommerce/last-7-days'),
  getLast30Days: () => apiClient.get('/integrations/unicommerce/last-30-days'),
  getLast24Hours: () => apiClient.get('/integrations/unicommerce/today'), // Alias

  // Paginated order endpoints (12 per page)
  getTodayOrders: (page: number = 1, pageSize: number = 12) =>
    apiClient.get('/integrations/unicommerce/orders/today', { params: { page, page_size: pageSize } }),
  getYesterdayOrders: (page: number = 1, pageSize: number = 12) =>
    apiClient.get('/integrations/unicommerce/orders/yesterday', { params: { page, page_size: pageSize } }),
  getLast7DaysOrders: (page: number = 1, pageSize: number = 12) =>
    apiClient.get('/integrations/unicommerce/orders/last-7-days', { params: { page, page_size: pageSize } }),
  getLast30DaysOrders: (page: number = 1, pageSize: number = 12) =>
    apiClient.get('/integrations/unicommerce/orders/last-30-days', { params: { page, page_size: pageSize } }),
  getCustomOrders: (params: { from_date: string; to_date: string; page?: number; page_size?: number }) =>
    apiClient.get('/integrations/unicommerce/orders/custom', { params }),

  // Sales report (for reports page)
  getSalesReport: (params?: { from_date?: string; to_date?: string; period?: string }) =>
    apiClient.get('/integrations/unicommerce/sales-report', { params }),

  // Daily Sales Report - Channel-wise breakdown
  getDailySalesReport: (date: string) =>
    apiClient.get('/integrations/unicommerce/daily-sales-report', { params: { date } }),

  // Daily Return Report - Channel + SKU breakdown (Two-Phase API)
  getDailyReturnReport: (date: string, returnType: string = 'ALL') =>
    apiClient.get('/integrations/unicommerce/daily-return-report', { params: { date, return_type: returnType } }),

  // Best performing SKUs monthly
  getBestSkusMonthly: (params?: { month?: number; year?: number; limit?: number; force_refresh?: boolean; b2c_only?: boolean }) =>
    apiClient.get('/integrations/unicommerce/best-skus-monthly', { params }),

  // SKU Velocity - fast & slow movers monthly
  getSkuVelocity: (params?: { month?: number; year?: number; limit?: number; min_qty?: number; b2c_only?: boolean; force_refresh?: boolean }) =>
    apiClient.get('/integrations/unicommerce/sku-velocity', { params }),

  // COD vs Prepaid monthly
  getCodVsPrepaid: (params?: { month?: number; year?: number }) =>
    apiClient.get('/integrations/unicommerce/cod-vs-prepaid', { params }),

  // Channel revenue breakdown
  getChannelRevenue: (period: string = 'last_30_days') =>
    apiClient.get('/integrations/unicommerce/channel-revenue', { params: { period } }),

  // Validation
  validateRevenue: () => apiClient.get('/integrations/unicommerce/validate'),

  // Cache management
  clearCache: () => apiClient.post('/integrations/unicommerce/clear-cache'),
  getCacheStats: () => apiClient.get('/integrations/unicommerce/cache-stats'),
  checkCacheStatus: () => apiClient.get('/integrations/unicommerce/cache-check'),

  // Legacy
  searchOrders: (params: { from_date: string; to_date: string; display_start?: number; display_length?: number }) =>
    apiClient.get('/integrations/unicommerce/search-orders', { params }),
  getOrderItems: (orderCode: string) =>
    apiClient.get(`/integrations/unicommerce/order-items/${orderCode}`),
};
