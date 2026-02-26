import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api-client";

/**
 * Hook for fetching sales list
 */
export function useSales({
    skip = 0,
    limit = 100,
    startDate,
    endDate,
    panelId,
}: {
    skip?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    panelId?: number;
}) {
    return useQuery({
        queryKey: ["sales", "list", skip, limit, startDate, endDate, panelId],
        queryFn: async () => {
            const response = await apiClient.get(`/sales/`, {
                params: {
                    skip,
                    limit,
                    ...(startDate && { start_date: startDate }),
                    ...(endDate && { end_date: endDate }),
                    ...(panelId && { panel_id: panelId }),
                },
            });
            return response.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Hook for creating a sale
 */
export function useCreateSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post(`/sales/`, data);
            return response.data;
        },
        onSuccess: (data) => {
            // Invalidate sales list
            queryClient.invalidateQueries({ queryKey: ["sales", "list"] });

            // Invalidate daily sales report for the sale date
            const saleDate = data.transaction_date || data.sale_date;
            if (saleDate) {
                queryClient.invalidateQueries({
                    queryKey: ["reports", "sales", "daily", saleDate],
                });
                queryClient.invalidateQueries({
                    queryKey: ["dailySales", saleDate],
                });
            }
        },
    });
}
