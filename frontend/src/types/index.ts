// Yarn Types
export interface Yarn {
  id: number;
  yarn_type: string;
  yarn_count: string;
  composition: string;
  percentage_breakdown?: Record<string, number>;
  supplier?: string;
  unit_price?: number;
  stock_quantity: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

// Fabric Types
export interface Fabric {
  id: number;
  fabric_type: string;
  subtype: string;
  gsm: number;
  composition: string;
  width?: number;
  color?: string;
  stock_quantity: number;
  unit: string;
  cost_per_unit?: number;
  created_at: string;
  updated_at: string;
}

// Garment Types
export interface Garment {
  id: number;
  style_sku: string;
  name: string;
  category: string;
  sub_category?: string;
  sizes: string[];
  gross_weight_per_size?: Record<string, number>;
  mrp: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Inventory Types
export interface Inventory {
  id: number;
  garment_id: number;
  size: string;
  good_stock: number;
  virtual_stock: number;
  warehouse_location?: string;
  last_updated: string;
  created_at: string;
}

// Panel Types
export interface Panel {
  id: number;
  panel_name: string;
  panel_type: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Sale Types
export interface Sale {
  id: number;
  transaction_date: string;
  garment_id: number;
  panel_id: number;
  size: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  total_amount: number;
  is_return: boolean;
  invoice_number?: string;
  created_at: string;
}

// Production Types
export interface ProductionPlan {
  id: number;
  plan_name: string;
  garment_id: number;
  planned_quantity: number;
  target_date: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  fabric_requirement?: number;
  yarn_requirement?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Discount Types
export interface Discount {
  id: number;
  discount_name: string;
  discount_type: string;
  discount_value: number;
  applicable_to: string;
  panel_id?: number;
  garment_id?: number;
  category?: string;
  valid_from: string;
  valid_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Paid Ad Types (legacy)
export interface PaidAd {
  id: number;
  ad_date: string;
  panel_id: number;
  platform: string;
  campaign_name: string;
  daily_spend: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue_generated?: number;
  notes?: string;
  created_at: string;
}

// Ads Module Types
export interface AdsExtraMetric {
  id?: number;
  metric_name: string;
  metric_value: number;
}

export interface AdsData {
  id: number;
  date: string;
  channel: string;
  brand: string;
  campaign_name?: string;
  impressions: number;
  clicks: number;
  cpc?: number;
  spend: number;
  spend_with_tax?: number;
  ads_sale: number;
  total_sale: number;
  units_sold: number;
  acos?: number;
  tacos?: number;
  roas?: number;
  roi?: number;
  extra_metrics: AdsExtraMetric[];
  created_at: string;
  updated_at: string;
}

export interface AdsDataCreate {
  date: string;
  channel: string;
  brand: string;
  campaign_name?: string;
  impressions: number;
  clicks: number;
  cpc?: number;
  spend: number;
  spend_with_tax?: number;
  ads_sale: number;
  total_sale: number;
  units_sold: number;
  extra_metrics: { metric_name: string; metric_value: number }[];
}

export interface AdsPaginatedResponse {
  items: AdsData[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdsMtdSummary {
  period: string;
  total_spend: number;
  total_spend_with_tax: number;
  total_ads_sale: number;
  total_total_sale: number;
  total_units: number;
  total_impressions: number;
  total_clicks: number;
  entry_count: number;
  acos?: number;
  tacos?: number;
  roas?: number;
  roi?: number;
  ctr?: number;
}

export interface AdsChannelSummary {
  channel: string;
  spend: number;
  ads_sale: number;
  total_sale: number;
  units: number;
  impressions: number;
  clicks: number;
  entries: number;
  acos?: number;
  roas?: number;
}

export interface AdsImportResult {
  imported: number;
  errors: { row: number; error: string }[];
  total_errors: number;
  column_mapping: Record<string, string>;
}

// ─── Procurement & Manufacturing Types ──────────────────────────

export interface Supplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  supplier_type: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  credit_days?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id?: number;
  po_id?: number;
  item_type: string;
  yarn_id?: number;
  fabric_id?: number;
  item_name: string;
  item_code?: string;
  description?: string;
  color?: string;
  order_qty: number;
  unit: string;
  rate: number;
  discount_percent?: number;
  net_rate: number;
  amount: number;
  gst_percent?: number;
  gst_amount?: number;
  net_amount: number;
  received_qty?: number;
  pending_qty: number;
  delivery_date?: string;
  hsn_code?: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  po_date: string;
  supplier_id: number;
  department: string;
  status: string;
  delivery_terms?: string;
  payment_terms?: string;
  credit_days?: number;
  extra_percent?: number;
  expiry_days?: number;
  remarks?: string;
  gross_amount?: number;
  tax_amount?: number;
  freight_amount?: number;
  net_amount?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
  items?: PurchaseOrderItem[];
  supplier?: Supplier;
}

export interface GateEntry {
  id: number;
  gate_entry_number: string;
  entry_date: string;
  entry_time?: string;
  supplier_id: number;
  po_id?: number;
  vehicle_number?: string;
  driver_name?: string;
  supplier_challan_no?: string;
  supplier_challan_date?: string;
  remarks?: string;
  status?: string;
  created_by?: number;
  created_at: string;
  supplier?: Supplier;
}

export interface MRNItem {
  id?: number;
  mrn_id?: number;
  po_item_id?: number;
  item_type: string;
  yarn_id?: number;
  fabric_id?: number;
  item_name: string;
  item_code?: string;
  color?: string;
  bags?: number;
  qty: number;
  unit: string;
  rate: number;
  discount_percent?: number;
  disc_rate?: number;
  amount: number;
  gst_percent?: number;
  gst_amount?: number;
  net_amount: number;
  lot_number?: string;
  remarks?: string;
}

export interface MRN {
  id: number;
  mrn_number: string;
  mrn_date: string;
  supplier_id: number;
  po_id?: number;
  gate_entry_id?: number;
  supplier_doc_no?: string;
  supplier_doc_date?: string;
  mrn_type?: string;
  remarks?: string;
  gross_amount?: number;
  tax_type?: string;
  tax_amount?: number;
  freight_amount?: number;
  other_charges?: number;
  net_amount: number;
  status?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  items?: MRNItem[];
  supplier?: Supplier;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product_type: string;
  transaction_type: string;
  reference_type: string;
  reference_id: number;
  reference_number: string;
  quantity: number;
  balance_after: number;
  lot_number?: string;
  transaction_date: string;
  created_by?: number;
  created_at: string;
}

// Knitting
export interface KnitOrder {
  id: number;
  knit_order_number: string;
  order_date: string;
  knitter_supplier_id: number;
  fabric_id: number;
  planned_qty_kg: number;
  status: string;
  target_date?: string;
  gsm?: number;
  fabric_type?: string;
  remarks?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  knitter?: Supplier;
}

export interface YarnIssueItem {
  id?: number;
  issue_id?: number;
  yarn_id: number;
  lot_number?: string;
  qty: number;
  unit?: string;
  returned_qty?: number;
}

export interface YarnIssue {
  id: number;
  issue_number: string;
  issue_date: string;
  knit_order_id: number;
  status: string;
  remarks?: string;
  created_by?: number;
  created_at: string;
  items?: YarnIssueItem[];
}

export interface GreyFabricReceipt {
  id: number;
  receipt_number: string;
  receipt_date: string;
  knit_order_id: number;
  fabric_id: number;
  qty_received: number;
  qty_rejected?: number;
  lot_number?: string;
  gsm_actual?: number;
  remarks?: string;
  created_by?: number;
  created_at: string;
}

// Processing / Dyeing
export interface ProcessingOrder {
  id: number;
  order_number: string;
  order_date: string;
  processor_supplier_id: number;
  process_type: string;
  status: string;
  target_date?: string;
  remarks?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  processor?: Supplier;
}

export interface GreyFabricIssue {
  id: number;
  issue_number: string;
  issue_date: string;
  processing_order_id: number;
  fabric_id: number;
  qty_issued: number;
  lot_number?: string;
  color?: string;
  remarks?: string;
  created_by?: number;
  created_at: string;
}

export interface FinishedFabricReceipt {
  id: number;
  receipt_number: string;
  receipt_date: string;
  processing_order_id: number;
  fabric_id: number;
  qty_received: number;
  qty_rejected?: number;
  lot_number?: string;
  color?: string;
  shade_code?: string;
  gsm_actual?: number;
  shrinkage_percent?: number;
  remarks?: string;
  created_by?: number;
  created_at: string;
}

// Garment Production
export interface CuttingOrder {
  id: number;
  cutting_order_number: string;
  order_date: string;
  garment_id: number;
  production_plan_id?: number;
  fabric_id: number;
  fabric_qty_issued: number;
  planned_pieces: number;
  size_breakdown?: Record<string, number>;
  status: string;
  marker_efficiency?: number;
  remarks?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface CuttingCheck {
  id: number;
  cutting_order_id: number;
  check_date: string;
  pieces_cut: number;
  pieces_ok: number;
  pieces_rejected?: number;
  fabric_used_kg?: number;
  fabric_wastage_kg?: number;
  size_breakdown_actual?: Record<string, number>;
  checked_by?: string;
  remarks?: string;
  created_at: string;
}

export interface StitchingOrder {
  id: number;
  stitching_order_number: string;
  order_date: string;
  cutting_order_id: number;
  stitcher_supplier_id?: number;
  pieces_issued: number;
  size_breakdown?: Record<string, number>;
  target_date?: string;
  status: string;
  stitching_rate?: number;
  remarks?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  stitcher?: Supplier;
}

export interface GarmentFinishing {
  id: number;
  stitching_order_id: number;
  garment_id: number;
  stage: string;
  stage_date: string;
  pieces_in: number;
  pieces_ok: number;
  pieces_rejected?: number;
  size_breakdown?: Record<string, number>;
  operator?: string;
  remarks?: string;
  created_at: string;
}

export interface BarcodeLabel {
  id: number;
  garment_finishing_id: number;
  garment_id: number;
  size: string;
  barcode: string;
  mrp: number;
  batch_number?: string;
  printed_at?: string;
  is_printed: boolean;
  created_at: string;
}

// Paginated response generic
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
