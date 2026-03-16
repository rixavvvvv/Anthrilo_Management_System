import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api-client";

// Fetches paginated sales list with optional date/panel filters
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

// Creates a new sale and refreshes the sales + daily report caches
export function useCreateSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post(`/sales/`, data);
            return response.data;
        },
        onSuccess: (data) => {
            // Refresh sales list cache
            queryClient.invalidateQueries({ queryKey: ["sales", "list"] });

            // Also refresh the daily report for the sale's date
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
