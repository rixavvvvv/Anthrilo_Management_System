import { useTodaySales, useYesterdaySales, useLast7DaysSales } from './useUnicommerce';
import type { SalesData } from './useUnicommerce';

interface SalesHookResult {
    data: SalesData | null;
    isLoading: boolean;
    error: { message: string } | null;
    refetch: () => Promise<void>;
}

function adapt(hook: { data: SalesData | null; loading: boolean; error: string | null; refetch: () => Promise<void> }): SalesHookResult {
    return {
        data: hook.data,
        isLoading: hook.loading,
        error: hook.error ? { message: hook.error } : null,
        refetch: hook.refetch,
    };
}

/**
 * Hook for fetching Today's sales summary
 * @param enabled - Only fetch data when true (default: true)
 */
export function useUnicommerceToday(enabled: boolean = true): SalesHookResult {
    return adapt(useTodaySales(enabled));
}

/**
 * Hook for fetching Yesterday's sales summary
 * @param enabled - Only fetch data when true (default: true)
 */
export function useUnicommerceYesterday(enabled: boolean = true): SalesHookResult {
    return adapt(useYesterdaySales(enabled));
}

/**
 * Hook for fetching Last 7 Days sales summary
 * @param enabled - Only fetch data when true (default: true)
 */
export function useUnicommerceLast7Days(enabled: boolean = true): SalesHookResult {
    return adapt(useLast7DaysSales(enabled));
}
