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

// Wraps useTodaySales with a React-Query-like interface shape
export function useUnicommerceToday(enabled: boolean = true): SalesHookResult {
    return adapt(useTodaySales(enabled));
}

// Wraps useYesterdaySales with a React-Query-like interface shape
export function useUnicommerceYesterday(enabled: boolean = true): SalesHookResult {
    return adapt(useYesterdaySales(enabled));
}

// Wraps useLast7DaysSales with a React-Query-like interface shape
export function useUnicommerceLast7Days(enabled: boolean = true): SalesHookResult {
    return adapt(useLast7DaysSales(enabled));
}
