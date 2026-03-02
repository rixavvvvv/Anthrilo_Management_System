import { unicommerceApi } from './index';
import { apiClient } from '@/lib/api-client';

// Re-exports for backward compatibility

// Sales-related APIs
export const ucSales = {
    getToday: unicommerceApi.getToday,
    getYesterday: unicommerceApi.getYesterday,
    getLast7Days: unicommerceApi.getLast7Days,
    getLast30Days: unicommerceApi.getLast30Days,
    getLast24Hours: unicommerceApi.getLast24Hours,
    getTodayOrders: unicommerceApi.getTodayOrders,
    getYesterdayOrders: unicommerceApi.getYesterdayOrders,
    getLast7DaysOrders: unicommerceApi.getLast7DaysOrders,
    getLast30DaysOrders: unicommerceApi.getLast30DaysOrders,
    getCustomOrders: unicommerceApi.getCustomOrders,
    getSalesReport: unicommerceApi.getSalesReport,
    getDailySalesReport: unicommerceApi.getDailySalesReport,
    getDailyReturnReport: unicommerceApi.getDailyReturnReport,
    getChannelRevenue: unicommerceApi.getChannelRevenue,
    validateRevenue: unicommerceApi.validateRevenue,
    getBestSkusMonthly: unicommerceApi.getBestSkusMonthly,
    getCodVsPrepaid: unicommerceApi.getCodVsPrepaid,
    getSkuVelocity: unicommerceApi.getSkuVelocity,

    // Additional functions used by legacy pages
    getOrders: async (params: { period: string; page: number; page_size: number; from_date?: string; to_date?: string }) => {
        const { period, page, page_size, from_date, to_date } = params;

        // Map period to the appropriate endpoint
        if (period === 'custom' && from_date && to_date) {
            return unicommerceApi.getCustomOrders({ from_date, to_date, page, page_size });
        } else if (period === 'today') {
            return unicommerceApi.getTodayOrders(page, page_size);
        } else if (period === 'yesterday') {
            return unicommerceApi.getYesterdayOrders(page, page_size);
        } else if (period === 'last_7_days') {
            return unicommerceApi.getLast7DaysOrders(page, page_size);
        } else if (period === 'last_30_days') {
            return unicommerceApi.getLast30DaysOrders(page, page_size);
        } else {
            return unicommerceApi.getTodayOrders(page, page_size);
        }
    },

    getSalesBySku: (params: { period: string; from_date?: string; to_date?: string }) =>
        apiClient.get('/integrations/unicommerce/sales-by-sku', { params }),

    getFabricSales: (params: { month?: number; year?: number; from_date?: string; to_date?: string; force_refresh?: boolean }) =>
        apiClient.get('/integrations/unicommerce/fabric-sales', { params }),

    getBundleSkus: (params?: { force_refresh?: boolean }) =>
        apiClient.get('/integrations/unicommerce/bundle-skus', { params }),

    getBundleSalesAnalysis: (params?: {
        period?: string;
        from_date?: string;
        to_date?: string;
        force_refresh?: boolean;
    }) => apiClient.get('/integrations/unicommerce/bundle-sales-analysis', { params }),
};

// Catalog-related APIs
export const ucCatalog = {
    searchItems: (params: {
        displayStart: number;
        displayLength: number;
        getInventorySnapshot?: boolean;
        getAggregates?: boolean;
        keyword?: string;
    }) => {
        // Transform params to Unicommerce format
        const payload: any = {
            getInventorySnapshot: params.getInventorySnapshot ?? false,
            getAggregates: params.getAggregates ?? false,
            searchOptions: {
                displayStart: params.displayStart,
                displayLength: params.displayLength,
            },
        };

        if (params.keyword) {
            payload.keyword = params.keyword;
        }

        return apiClient.post('/uc/catalog/item/search', payload);
    },

    // Get inventory summary - aggregated totals independent of pagination
    getInventorySummary: () => {
        return apiClient.get('/uc/catalog/inventory/summary');
    },
};

// Inventory-related APIs (used by stock-analysis page)
export const ucInventory = {
    getSummary: () =>
        apiClient.get('/uc/catalog/inventory/summary').then((res) => {
            const d = res.data || {};
            return {
                data: {
                    successful: d.successful,
                    summary: {
                        total_skus: d.totalSKUs ?? d.totalProducts ?? 0,
                        total_inventory: d.totalRealInventory ?? 0,
                        out_of_stock_skus: d.skusOutOfStock ?? 0,
                        total_blocked: d.totalVirtualInventory ?? 0,
                    },
                },
            };
        }),

    getSnapshot: (params: { page: number; page_size: number; in_stock_only?: boolean; category?: string; enabled_only?: boolean }) => {
        const payload: any = {
            getInventorySnapshot: true,
            searchOptions: {
                displayStart: (params.page - 1) * params.page_size,
                displayLength: params.page_size,
            },
        };
        return apiClient.post('/uc/catalog/item/search', payload).then((res) => {
            const elements = res.data?.elements || [];
            const totalRecords = res.data?.totalRecords || 0;
            const snapshots = elements.map((el: any) => {
                const snap = el.inventorySnapshots?.[0] || {};
                return {
                    itemTypeSKU: el.skuCode || '',
                    categoryName: el.categoryName || '',
                    color: el.color || '',
                    size: el.size || '',
                    brand: el.brand || '',
                    costPrice: el.costPrice || el.price || 0,
                    inventory: snap.inventory ?? 0,
                    openSale: snap.openSale ?? 0,
                    badInventory: snap.badInventory ?? 0,
                    putawayPending: snap.putawayPending ?? 0,
                    inventoryBlocked: snap.inventoryBlocked ?? 0,
                };
            });
            // Apply in-stock filter if needed
            const filtered = params.in_stock_only
                ? snapshots.filter((s: any) => s.inventory > 0)
                : snapshots;
            return {
                data: {
                    inventorySnapshots: filtered,
                    items: filtered,          // alias for page compatibility
                    totalCount: totalRecords,
                    totalRecords: totalRecords,
                    totalPages: Math.ceil(totalRecords / params.page_size),
                    total_pages: Math.ceil(totalRecords / params.page_size),
                    method: 'export_job',
                },
            };
        });
    },

    search: (params: { q: string; page: number; page_size: number }) => {
        const payload: any = {
            getInventorySnapshot: true,
            keyword: params.q,
            searchOptions: {
                displayStart: (params.page - 1) * params.page_size,
                displayLength: params.page_size,
            },
        };
        return apiClient.post('/uc/catalog/item/search', payload).then((res) => {
            const elements = res.data?.elements || [];
            const totalRecords = res.data?.totalRecords || 0;
            const snapshots = elements.map((el: any) => {
                const snap = el.inventorySnapshots?.[0] || {};
                return {
                    itemTypeSKU: el.skuCode || '',
                    categoryName: el.categoryName || '',
                    color: el.color || '',
                    size: el.size || '',
                    brand: el.brand || '',
                    costPrice: el.costPrice || el.price || 0,
                    inventory: snap.inventory ?? 0,
                    openSale: snap.openSale ?? 0,
                    badInventory: snap.badInventory ?? 0,
                    putawayPending: snap.putawayPending ?? 0,
                    inventoryBlocked: snap.inventoryBlocked ?? 0,
                };
            });
            return {
                data: {
                    inventorySnapshots: snapshots,
                    items: snapshots,              // alias for page compatibility
                    totalCount: totalRecords,
                    totalRecords: totalRecords,
                    totalPages: Math.ceil(totalRecords / params.page_size),
                    total_pages: Math.ceil(totalRecords / params.page_size),
                    method: 'search' as const,
                },
            };
        });
    },
};
