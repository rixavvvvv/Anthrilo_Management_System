// Sales-related types
export type { Sale, Discount, PaginatedResponse } from '@/types';

export interface SalesActivityRow {
  item_sku_code: string;
  item_type_name: string;
  size: string;
  channel: string;
  total_sale_qty: number;
  cancel_qty: number;
  return_qty: number;
  net_sale: number;
  stock_good: number;
  stock_virtual: number;
}

export type ReportType = 'size-wise' | 'item-wise' | 'channel-detailed' | 'channel-summary';
