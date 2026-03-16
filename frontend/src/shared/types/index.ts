// Shared types — re-exports everything from the central types file.
// Over time, migrate types into their respective feature modules.
export type {
  // Core entities
  Yarn,
  Fabric,
  Garment,
  Inventory,
  Panel,
  Sale,
  ProductionPlan,
  Discount,
  PaginatedResponse,

  // Procurement
  Supplier,
  PurchaseOrderItem,
  PurchaseOrder,
  GateEntry,
  MRNItem,
  MRN,
  ProductMasterItem,
  ProductMasterListResponse,
  ProductImportSummary,
  ProductFilterOptions,

  // Manufacturing
  KnitOrder,
  YarnIssueItem,
  YarnIssue,
  GreyFabricReceipt,
  ProcessingOrder,
  GreyFabricIssue,
  FinishedFabricReceipt,
  CuttingOrder,
  CuttingCheck,
  StitchingOrder,
  GarmentFinishing,
  BarcodeLabel,

  // Financial / Ads
  PaidAd,
  AdsData,
  AdsDataCreate,
  AdsPaginatedResponse,
  AdsMtdSummary,
  AdsChannelSummary,
  AdsImportResult,

  // Inventory
  InventoryTransaction,
} from '@/types';
