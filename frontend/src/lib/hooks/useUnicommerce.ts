/**
 * Unicommerce Data Hooks
 * ======================
 * React hooks for fetching data using TWO-PHASE API approach
 * 
 * CRITICAL CONSTRAINT:
 * - Phase 1: saleOrder/search - Gets order CODES only (NO pricing data)
 * - Phase 2: saleorder/get - Gets sellingPrice (THE ONLY SOURCE OF REVENUE)
 * 
 * Revenue = SUM of item.sellingPrice from Phase 2 responses ONLY
 */

import { useState, useEffect, useCallback } from 'react';
import { unicommerceApi } from '@/lib/api';

export interface SalesData {
    success: boolean;
    period: string;
    summary: {
        total_orders: number;
        valid_orders: number;
        excluded_orders: number;
        total_revenue: number;
        total_discount: number;
        total_tax: number;
        avg_order_value: number;
        channel_breakdown: Record<string, { orders: number; revenue: number }>;
        status_breakdown: Record<string, number>;
        currency: string;
        calculation_method: string;
    };
    orders: Array<{
        code: string;
        status: string;
        channel: string;
        selling_price: number;
        net_revenue: number;
        created: string;
        item_count: number;
        quantity: number;  // NEW: Total quantity of items in order
        include_in_revenue: boolean;
    }>;
    fetch_info: {
        total_available: number;
        fetched_count: number;
        failed_codes: number;
        phase1_time_seconds: number;
        phase2_time_seconds: number;
        total_time_seconds: number;
        retry_recovered: number;
        phase1_dedup: number;
        phase2_dedup: number;
        reconciliation_passed: boolean;
    };
    revenue_method: string;
}

export interface PaginatedOrders {
    success: boolean;
    orders: Array<{
        code: string;
        status: string;
        channel: string;
        selling_price: number;
        net_revenue: number;
        created: string;
        item_count: number;
        quantity: number;  // NEW: Total quantity of items in order
        include_in_revenue: boolean;
    }>;
    pagination: {
        current_page: number;
        page_size: number;
        total_orders: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
    };
    page_summary: {
        orders_on_page: number;
        page_revenue: number;
    };
}

/**
 * Hook for fetching Today's sales summary
 * Uses TWO-PHASE API to get accurate revenue from sellingPrice
 * @param enabled - Only fetch data when true (default: true)
 */
export function useTodaySales(enabled: boolean = true) {
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const refetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await unicommerceApi.getToday();
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch today sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (enabled) {
            refetch();
        } else {
            setLoading(false);
        }
    }, [enabled]);

    return { data, loading, error, refetch };
}

/**
 * Hook for fetching Yesterday's sales summary
 * @param enabled - Only fetch data when true (default: true)
 */
export function useYesterdaySales(enabled: boolean = true) {
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const refetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await unicommerceApi.getYesterday();
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch yesterday sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (enabled) {
            refetch();
        } else {
            setLoading(false);
        }
    }, [enabled]);

    return { data, loading, error, refetch };
}

/**
 * Hook for fetching Last 7 Days sales summary
 * @param enabled - Only fetch data when true (default: true)
 */
export function useLast7DaysSales(enabled: boolean = true) {
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const refetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await unicommerceApi.getLast7Days();
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch last 7 days sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (enabled) {
            refetch();
        } else {
            setLoading(false);
        }
    }, [enabled]);

    return { data, loading, error, refetch };
}

/**
 * Hook for fetching Last 30 Days sales summary
 * @deprecated REMOVED FROM UI - Use Last 7 Days instead for better performance
 * @param enabled - Only fetch data when true (default: true)
 */
export function useLast30DaysSales(enabled: boolean = true) {
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);

    const refetch = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await unicommerceApi.getLast30Days();
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch last 30 days sales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (enabled) {
            refetch();
        } else {
            setLoading(false);
        }
    }, [enabled]);

    return { data, loading, error, refetch };
}

/**
 * Hook for fetching paginated orders
 * Uses TWO-PHASE approach for each page
 */
export function usePaginatedOrders(period: 'today' | 'yesterday' | 'last-7-days', initialPage = 1) {
    const [data, setData] = useState<PaginatedOrders | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(initialPage);

    const fetchPage = useCallback(async (page: number) => {
        setLoading(true);
        setError(null);
        try {
            let response;
            switch (period) {
                case 'today':
                    response = await unicommerceApi.getTodayOrders(page);
                    break;
                case 'yesterday':
                    response = await unicommerceApi.getYesterdayOrders(page);
                    break;
                case 'last-7-days':
                    response = await unicommerceApi.getLast7DaysOrders(page);
                    break;
            }
            setData(response.data);
            setCurrentPage(page);
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchPage(initialPage);
    }, [period, fetchPage, initialPage]);

    const nextPage = () => {
        if (data?.pagination.has_next) {
            fetchPage(currentPage + 1);
        }
    };

    const prevPage = () => {
        if (data?.pagination.has_previous) {
            fetchPage(currentPage - 1);
        }
    };

    const goToPage = (page: number) => {
        fetchPage(page);
    };

    return {
        data,
        loading,
        error,
        currentPage,
        nextPage,
        prevPage,
        goToPage,
        refetch: () => fetchPage(currentPage)
    };
}
