// Sales hooks (wrapping React Query)
export {
  useTodaySales,
  useYesterdaySales,
  useLast7DaysSales,
  useLast30DaysSales,
  usePaginatedOrders,
} from '@/lib/hooks/useUnicommerce';

export { useSales, useCreateSale } from '@/lib/hooks/useSales';
export { useUnicommerceToday, useUnicommerceYesterday } from '@/lib/hooks/useUnicommerceSales';
