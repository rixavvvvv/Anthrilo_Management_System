import { apiClient } from '@/lib/api-client';

export interface ReportFilters {
  start_date?: string;
  end_date?: string;
  category?: string;
  panel_id?: number;
  garment_id?: number;
  threshold?: number;
  status?: string;
  panel_type?: string;
}

// Raw materials & processing reports
export const rawMaterialsReports = {
  // Stock analysis
  getStockAnalysis: (params?: { category?: string }) =>
    apiClient.get('/reports/raw-materials/stock-analysis', { params }),

  // Yarn forecasting
  getYarnForecasting: (params?: { forecast_days?: number }) =>
    apiClient.get('/reports/yarn/forecasting', { params }),

  // Purchase raise for yarn
  getPurchaseRaiseForYarn: (params?: { threshold?: number; forecast_days?: number }) =>
    apiClient.get('/reports/yarn/purchase-raise', { params }),
};

// Garment production reports
export const productionReports = {
  // Production tracking
  getProductionTracking: (params?: { status?: string; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/production/tracking', { params }),

  // Quality control metrics
  getQualityMetrics: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/quality/metrics', { params }),
};

// Sales reports
export const salesReports = {
  // Sales analytics
  getSalesAnalytics: (params?: ReportFilters) =>
    apiClient.get('/reports/sales/analytics', { params }),

  // Bundle SKU sales
  getBundleSKUSales: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/sales/bundle-sku', { params }),

  // General discount report
  getGeneralDiscountReport: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/discounts/general', { params }),

  // Discount by panel
  getDiscountByPanel: (params?: { panel_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/discounts/by-panel', { params }),
};

// Panel reports
export const panelReports = {
  // Panel performance tracking
  getPerformanceTracking: (params?: { panel_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/panels/performance', { params }),

  // Top performing panels
  getTopPerforming: (params?: { limit?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/panels/top-performing', { params }),

  // Panel settlement report
  getPanelSettlement: (params?: { panel_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/settlements/panel-settlement', { params }),
};

// Labour reports
export const labourReports = {
  // Attendance report
  getAttendanceReport: (params?: { start_date?: string; end_date?: string; department?: string }) =>
    apiClient.get('/reports/labour/attendance', { params }),

  // Productivity analysis
  getProductivityAnalysis: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/labour/productivity', { params }),

  // Labour cost report
  getCostReport: (params?: { start_date?: string; end_date?: string; department?: string }) =>
    apiClient.get('/reports/labour/cost', { params }),
};

// Financial reports
export const financialReports = {
  // Raw material purchase analysis
  getRawMaterialPurchase: (params?: { start_date?: string; end_date?: string; category?: string }) =>
    apiClient.get('/reports/financial/raw-material-purchase', { params }),

  // Finished goods sales analysis
  getFinishedGoodsSales: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/financial/finished-goods-sales', { params }),

  // Profit margin analysis
  getProfitMargin: (params?: { start_date?: string; end_date?: string; category?: string }) =>
    apiClient.get('/reports/financial/profit-margin', { params }),

  // Expense tracking
  getExpenseTracking: (params?: { start_date?: string; end_date?: string; expense_type?: string }) =>
    apiClient.get('/reports/financial/expense-tracking', { params }),
};

// All reports combined for convenience
export const reportsApi = {
  rawMaterials: rawMaterialsReports,
  production: productionReports,
  sales: salesReports,
  panels: panelReports,
  labour: labourReports,
  financial: financialReports,
};
