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

// Raw Materials & Processing Reports
export const rawMaterialsReports = {
  // Stock Analysis Report
  getStockAnalysis: (params?: { category?: string }) =>
    apiClient.get('/reports/raw-materials/stock-analysis', { params }),

  // Yarn Forecasting Report
  getYarnForecasting: (params?: { forecast_days?: number }) =>
    apiClient.get('/reports/yarn/forecasting', { params }),

  // Purchase raise for yarn
  getPurchaseRaiseForYarn: (params?: { threshold?: number; forecast_days?: number }) =>
    apiClient.get('/reports/yarn/purchase-raise', { params }),
};

// Garment Production Reports
export const productionReports = {
  // Garment Production Tracking
  getProductionTracking: (params?: { status?: string; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/production/tracking', { params }),

  // Quality Control Metrics
  getQualityMetrics: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/quality/metrics', { params }),
};

// Sales Reports
export const salesReports = {
  // Sales Analytics
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

// Panel Reports
export const panelReports = {
  // Panel Performance Tracking
  getPerformanceTracking: (params?: { panel_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/panels/performance', { params }),

  // Top Performing Panels
  getTopPerforming: (params?: { limit?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/panels/top-performing', { params }),

  // Panel settlement
  getPanelSettlement: (params?: { panel_id?: number; start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/settlements/panel-settlement', { params }),
};

// Labour Reports
export const labourReports = {
  // Attendance Reports
  getAttendanceReport: (params?: { start_date?: string; end_date?: string; department?: string }) =>
    apiClient.get('/reports/labour/attendance', { params }),

  // Productivity Analysis
  getProductivityAnalysis: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/labour/productivity', { params }),

  // Labour Cost Reports
  getCostReport: (params?: { start_date?: string; end_date?: string; department?: string }) =>
    apiClient.get('/reports/labour/cost', { params }),
};

// Financial Reports
export const financialReports = {
  // Raw Material Purchase Analysis
  getRawMaterialPurchase: (params?: { start_date?: string; end_date?: string; category?: string }) =>
    apiClient.get('/reports/financial/raw-material-purchase', { params }),

  // Finished Goods Sales Analysis
  getFinishedGoodsSales: (params?: { start_date?: string; end_date?: string }) =>
    apiClient.get('/reports/financial/finished-goods-sales', { params }),

  // Profit Margin Analysis
  getProfitMargin: (params?: { start_date?: string; end_date?: string; category?: string }) =>
    apiClient.get('/reports/financial/profit-margin', { params }),

  // Expense Tracking
  getExpenseTracking: (params?: { start_date?: string; end_date?: string; expense_type?: string }) =>
    apiClient.get('/reports/financial/expense-tracking', { params }),
};

// All reports combined for easy access
export const reportsApi = {
  rawMaterials: rawMaterialsReports,
  production: productionReports,
  sales: salesReports,
  panels: panelReports,
  labour: labourReports,
  financial: financialReports,
};
