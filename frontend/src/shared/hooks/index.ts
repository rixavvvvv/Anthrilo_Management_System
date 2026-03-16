'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DEBOUNCE_SEARCH } from '@/shared/constants';

// Delays updating the returned value until the user stops changing it
export function useDebounce<T>(value: T, delay = DEBOUNCE_SEARCH): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Simple boolean toggle: returns [value, toggle(), setValue()]
export function useToggle(initial = false): [boolean, () => void, (val: boolean) => void] {
  const [state, setState] = useState(initial);
  const toggle = useCallback(() => setState((s) => !s), []);
  return [state, toggle, setState];
}

// Keeps track of what a value was on the previous render
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// Re-export domain-specific hooks so pages can grab them from one place
export { useWebSocket } from '@/lib/hooks/useWebSocket';
export { useTodaySales, useYesterdaySales, useLast7DaysSales, useLast30DaysSales, usePaginatedOrders } from '@/lib/hooks/useUnicommerce';
export { useDailySalesReport, usePanelWiseSalesReport, useFabricStockSheet, useProductionPlanReport } from '@/lib/hooks/useReports';
export { useSales, useCreateSale } from '@/lib/hooks/useSales';
export { useGarments, useGarment, useCreateGarment, useUpdateGarment } from '@/lib/hooks/useGarments';
export { useInventory, useInventoryItem, useCreateInventory, useUpdateInventory } from '@/lib/hooks/useInventory';
