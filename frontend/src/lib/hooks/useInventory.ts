import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api-client";

// Fetches paginated inventory list
export function useInventory(skip: number = 0, limit: number = 100) {
    return useQuery({
        queryKey: ["inventory", "list", skip, limit],
        queryFn: async () => {
            const response = await apiClient.get(`/inventory/`, {
                params: { skip, limit },
            });
            return response.data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

// Fetches a single inventory item by ID
export function useInventoryItem(id: number) {
    return useQuery({
        queryKey: ["inventory", "item", id],
        queryFn: async () => {
            const response = await apiClient.get(`/inventory/${id}`);
            return response.data;
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

// Creates a new inventory item and refreshes the list
export function useCreateInventory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post(`/inventory/`, data);
            return response.data;
        },
        onSuccess: () => {
            // Refresh inventory list after adding
            queryClient.invalidateQueries({ queryKey: ["inventory", "list"] });
        },
    });
}

// Updates an inventory item and refreshes its detail + list caches
export function useUpdateInventory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const response = await apiClient.put(`/inventory/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            // Refresh this item's detail + the list
            queryClient.invalidateQueries({ queryKey: ["inventory", "item", variables.id] });
            queryClient.invalidateQueries({ queryKey: ["inventory", "list"] });
        },
    });
}
