import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api-client";

/**
 * Hook for fetching daily sales report with Redis caching
 */
export function useDailySalesReport(date: string) {
    return useQuery({
        queryKey: ["reports", "sales", "daily", date],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/sales/daily/${date}`);
            return response.data;
        },
        enabled: !!date,
        staleTime: 5 * 60 * 1000, // 5 minutes - matches Redis cache
    });
}

/**
 * Hook for fetching panel-wise sales report
 */
export function usePanelWiseSalesReport(startDate: string, endDate: string) {
    return useQuery({
        queryKey: ["reports", "sales", "panel-wise", startDate, endDate],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/sales/panel-wise`, {
                params: { start_date: startDate, end_date: endDate },
            });
            return response.data;
        },
        enabled: !!startDate && !!endDate,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for fetching raw materials stock analysis
 */
export function useRawMaterialsStockAnalysis(category?: string) {
    return useQuery({
        queryKey: ["reports", "raw-materials", "stock-analysis", category],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/raw-materials/stock-analysis`, {
                params: category ? { category } : {},
            });
            return response.data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Hook for fetching fabric stock sheet
 */
export function useFabricStockSheet(type?: "total" | string) {
    return useQuery({
        queryKey: ["reports", "fabric", "stock-sheet", type],
        queryFn: async () => {
            const url = type === "total" || !type
                ? `/reports/fabric/stock-sheet/total`
                : `/reports/fabric/stock-sheet/by-type/${type}`;
            const response = await apiClient.get(url);
            return response.data;
        },
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Hook for fetching slow-moving inventory
 */
export function useSlowMovingInventory(daysPeriod: number = 90) {
    return useQuery({
        queryKey: ["reports", "inventory", "slow-moving", daysPeriod],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/inventory/slow-moving`, {
                params: { days_period: daysPeriod },
            });
            return response.data;
        },
        staleTime: 15 * 60 * 1000, // 15 minutes
    });
}

/**
 * Hook for fetching fast-moving inventory
 */
export function useFastMovingInventory(daysPeriod: number = 90) {
    return useQuery({
        queryKey: ["reports", "inventory", "fast-moving", daysPeriod],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/inventory/fast-moving`, {
                params: { days_period: daysPeriod },
            });
            return response.data;
        },
        staleTime: 15 * 60 * 1000,
    });
}

/**
 * Hook for fetching production plan status
 */
export function useProductionPlanReport(startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: ["reports", "production", "plan-status", startDate, endDate],
        queryFn: async () => {
            const response = await apiClient.get(`/reports/production/plan-status`, {
                params: {
                    ...(startDate && { start_date: startDate }),
                    ...(endDate && { end_date: endDate }),
                },
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}
