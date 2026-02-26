import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api-client";

/**
 * Hook for fetching garments list
 */
export function useGarments(skip: number = 0, limit: number = 100) {
    return useQuery({
        queryKey: ["garments", "list", skip, limit],
        queryFn: async () => {
            const response = await apiClient.get(`/garments/`, {
                params: { skip, limit },
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook for fetching single garment
 */
export function useGarment(id: number) {
    return useQuery({
        queryKey: ["garments", "item", id],
        queryFn: async () => {
            const response = await apiClient.get(`/garments/${id}`);
            return response.data;
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook for creating garment
 */
export function useCreateGarment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.post(`/garments/`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["garments", "list"] });
        },
    });
}

/**
 * Hook for updating garment
 */
export function useUpdateGarment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const response = await apiClient.put(`/garments/${id}`, data);
            return response.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["garments", "item", variables.id] });
            queryClient.invalidateQueries({ queryKey: ["garments", "list"] });
        },
    });
}
