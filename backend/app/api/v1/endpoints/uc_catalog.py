"""
Unicommerce Catalog & Product API Endpoints
=============================================
Covers:
- Create/Update Category
- Create/Update Item (single & multiple)
- Create/Update Channel Item Type
- Get Item Details
- Get Item Barcode Details
- Search Items
"""

from fastapi import APIRouter, Body
import logging
from typing import Any, Dict

from app.services.unicommerce_api_service import get_uc_api_service

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# CATEGORIES
# =============================================================================

@router.post("/category/create-or-edit")
async def create_or_update_category(payload: Dict[str, Any] = Body(...)):
    """
    Create or update product category.
    Payload: {
        category: {
            code, name, gstTaxTypeCode,
            taxTypeCode?, hsnCode?, expirable?, shelfLife?, ...
        }
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/product/category/addOrEdit", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# ITEMS (SINGLE)
# =============================================================================

@router.post("/item/create-or-edit")
async def create_or_update_item(payload: Dict[str, Any] = Body(...)):
    """
    Create or update a single item.
    Payload: {
        itemType: {
            categoryCode, skuCode, name, type?, description?,
            length?, width?, height?, weight?, color?, size?, brand?,
            maxRetailPrice?, basePrice?, costPrice?, gstTaxTypeCode?, hsnCode?,
            imageUrl?, productPageUrl?, tags?, customFieldValues?, ...
        }
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/catalog/itemType/createOrEdit", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# ITEMS (MULTIPLE)
# =============================================================================

@router.post("/items/create-or-edit")
async def create_or_update_items(payload: Dict[str, Any] = Body(...)):
    """
    Create or update multiple items.
    Payload: {
        itemTypes: [
            { categoryCode, skuCode, name, ... },
            { categoryCode, skuCode, name, ... }
        ]
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/catalog/itemTypes/createOrEdit", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# CHANNEL ITEM TYPE
# =============================================================================

@router.post("/channel-item/create-or-edit")
async def create_or_update_channel_item_type(payload: Dict[str, Any] = Body(...)):
    """
    Link Uniware product SKU with channel SKU.
    Payload: {
        channelItemType: {
            channelCode, channelProductId, sellerSkuCode, skuCode,
            blockedInventory?, live?, verified?, disabled?
        }
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/channel/createChannelItemType", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# GET ITEM DETAILS
# =============================================================================

@router.post("/item/get")
async def get_item_details(payload: Dict[str, Any] = Body(...)):
    """
    Get item details by SKU code.
    Payload: { skuCode, cartonScanIdentifier?, kitSku? }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/catalog/itemType/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/item/barcode")
async def get_item_barcode_details(payload: Dict[str, Any] = Body(...)):
    """
    Get item barcode details.
    Payload: { itemCode, facility_code? }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post("/product/item/get", payload, facility_code=fc)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# SEARCH ITEMS
# =============================================================================

@router.post("/item/search")
async def search_items(payload: Dict[str, Any] = Body(...)):
    """
    Search items with filters.
    Payload: {
        keyword?, productCode?, categoryCode?,
        getInventorySnapshot?, updatedSinceInHour?, skuType?,
        searchOptions?: { searchKey?, displayLength?, displayStart?, ... },
        getAggregates?: boolean (to fetch totals across all pages)
    }
    """
    try:
        svc = get_uc_api_service()
        get_aggregates = payload.pop("getAggregates", False)

        result = await svc.post("/product/itemType/search", payload)

        # Log sample if inventory snapshot requested
        if payload.get("getInventorySnapshot") and result.get("successful"):
            elements = result.get("elements", [])
            if elements:
                first_item = elements[0]
                logger.info(f"Sample item structure: SKU={first_item.get('skuCode')}, "
                            f"has inventorySnapshots: {bool(first_item.get('inventorySnapshots'))}")
                if first_item.get("inventorySnapshots"):
                    snap = first_item["inventorySnapshots"][0]
                    logger.info(
                        f"Sample inventory snapshot keys: {list(snap.keys())}")
                    logger.info(f"Sample inventory values: inventory={snap.get('inventory')}, "
                                f"goodInventory={snap.get('goodInventory')}, "
                                f"availableInventory={snap.get('availableInventory')}, "
                                f"virtualInventory={snap.get('virtualInventory')}")

        # Transform response to ensure consistent field naming
        if result.get("successful") and payload.get("getInventorySnapshot"):
            elements = result.get("elements", [])

            # Collect SKU codes for dedicated inventory snapshot lookup
            sku_codes = [item.get("skuCode")
                         for item in elements if item.get("skuCode")]

            # Fetch accurate virtualInventory from dedicated snapshot API
            vi_map = {}
            if sku_codes:
                try:
                    snap_result = await svc.post(
                        "/inventory/inventorySnapshot/get",
                        {"itemTypeSKUs": sku_codes}
                    )
                    if snap_result.get("successful"):
                        for snap in snap_result.get("inventorySnapshots", []):
                            sku = snap.get("itemTypeSKU", "")
                            vi_map[sku] = {
                                "virtualInventory": snap.get("virtualInventory", 0) or 0,
                                "inventory": snap.get("inventory", 0) or 0,
                                "openSale": snap.get("openSale", 0) or 0,
                                "badInventory": snap.get("badInventory", 0) or 0,
                                "putawayPending": snap.get("putawayPending", 0) or 0,
                                "inventoryBlocked": snap.get("inventoryBlocked", 0) or 0,
                            }
                except Exception as e:
                    logger.warning(f"Failed to fetch dedicated snapshot: {e}")

            for item in elements:
                snapshots = item.get("inventorySnapshots", [])
                sku = item.get("skuCode", "")

                # If we have dedicated snapshot data, use it (more accurate)
                if sku in vi_map:
                    if snapshots:
                        snap = snapshots[0]
                        snap.update(vi_map[sku])
                    else:
                        item["inventorySnapshots"] = [vi_map[sku]]
                        snapshots = item["inventorySnapshots"]

                for snap in snapshots:
                    # Normalize field names - try multiple possible field names
                    if "goodInventory" in snap and "inventory" not in snap:
                        snap["inventory"] = snap["goodInventory"]
                    if "availableInventory" in snap and "inventory" not in snap:
                        snap["inventory"] = snap["availableInventory"]
                    # Ensure numeric values for all inventory fields
                    snap["inventory"] = snap.get("inventory", 0) or 0
                    snap["virtualInventory"] = snap.get(
                        "virtualInventory", 0) or 0
                    snap["badInventory"] = snap.get("badInventory", 0) or 0
                    snap["openSale"] = snap.get("openSale", 0) or 0
                    snap["inventoryBlocked"] = snap.get(
                        "inventoryBlocked", 0) or 0
                    snap["putawayPending"] = snap.get("putawayPending", 0) or 0

        # Compute aggregates if requested
        if get_aggregates and result.get("successful") and payload.get("getInventorySnapshot"):
            logger.info("Computing aggregates across all pages...")
            aggregates = await _compute_inventory_aggregates(svc, payload)
            result["aggregates"] = aggregates

        return result
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


async def _compute_inventory_aggregates(svc, base_payload: Dict[str, Any]) -> Dict[str, int]:
    """
    Fetch all pages and compute aggregate totals.
    Returns totals for: inventory, virtualInventory, openSale, badInventory, etc.
    """
    try:
        # First, get total records count
        initial_payload = {
            **base_payload,
            "searchOptions": {
                **base_payload.get("searchOptions", {}),
                "displayStart": 0,
                "displayLength": 1
            }
        }
        initial_result = await svc.post("/product/itemType/search", initial_payload)

        if not initial_result.get("successful"):
            logger.warning(f"Initial aggregate query failed: {initial_result}")
            return {}

        total_records = initial_result.get("totalRecords", 0)
        logger.info(f"Total records for aggregates: {total_records}")

        if total_records == 0:
            return {
                "totalInventory": 0,
                "totalVirtualInventory": 0,
                "totalOpenSale": 0,
                "totalBadInventory": 0,
                "totalPutawayPending": 0,
                "totalValue": 0,
                "skusWithStock": 0,
                "skusOutOfStock": 0
            }

        # Fetch in batches of 100
        batch_size = 100
        totals = {
            "totalInventory": 0,
            "totalVirtualInventory": 0,
            "totalOpenSale": 0,
            "totalBadInventory": 0,
            "totalPutawayPending": 0,
            "totalValue": 0,
            "skusWithStock": 0,
            "skusOutOfStock": 0
        }

        # Limit to first 10,000 items for performance (configurable)
        # NOTE: For accurate totals across ALL SKUs, use /inventory/summary endpoint instead
        max_items = min(total_records, 10000)

        for start in range(0, max_items, batch_size):
            batch_payload = {
                **base_payload,
                "searchOptions": {
                    **base_payload.get("searchOptions", {}),
                    "displayStart": start,
                    "displayLength": min(batch_size, max_items - start)
                }
            }

            batch_result = await svc.post("/product/itemType/search", batch_payload)

            if not batch_result.get("successful"):
                logger.warning(f"Batch query failed at start={start}")
                continue

            elements = batch_result.get("elements", [])
            for item in elements:
                snapshots = item.get("inventorySnapshots", [])
                if snapshots:
                    snap = snapshots[0]
                    # Normalize inventory field
                    inv = snap.get("inventory", 0) or snap.get(
                        "goodInventory", 0) or snap.get("availableInventory", 0) or 0

                    totals["totalInventory"] += inv
                    totals["totalVirtualInventory"] += snap.get(
                        "virtualInventory", 0) or 0
                    totals["totalOpenSale"] += snap.get("openSale", 0) or 0
                    totals["totalBadInventory"] += snap.get(
                        "badInventory", 0) or 0
                    totals["totalPutawayPending"] += snap.get(
                        "putawayPending", 0) or 0

                    # Count SKUs with/without stock
                    if inv > 0:
                        totals["skusWithStock"] += 1
                    else:
                        totals["skusOutOfStock"] += 1

                    # Calculate value (inventory * price)
                    price = item.get("price", 0) or 0
                    totals["totalValue"] += inv * price

        logger.info(f"Aggregates computed: {totals}")
        return totals

    except Exception as e:
        logger.error(f"Error computing aggregates: {e}", exc_info=True)
        return {}


# =============================================================================
# INVENTORY SUMMARY (DEDICATED ENDPOINT FOR TOTALS)
# =============================================================================

@router.get("/inventory/summary")
async def get_inventory_summary(force_refresh: bool = False):
    """
    Get aggregated inventory summary across all SKUs.

    OPTIMIZED TWO-PHASE APPROACH (much faster than catalog+snapshot):
      Phase 1: Catalog search WITHOUT inventory snapshots (lightweight, fast)
               → gets SKU codes, enabled status, prices
      Phase 2: Dedicated /inventory/inventorySnapshot/get API in 5K batches
               → gets actual stock numbers (much lighter payloads)

    Uses Redis caching with 4-hour TTL.
    """
    import asyncio
    from app.services.cache_service import CacheService

    cache_key = "uc:inventory:summary:all"

    if not force_refresh:
        cached = CacheService.get(cache_key)
        if cached:
            logger.info("Returning cached inventory summary")
            return cached

    try:
        svc = get_uc_api_service()

        # ── Get total record count (1 lightweight call) ──
        initial_result = await svc.post("/product/itemType/search", {
            "getInventorySnapshot": False,
            "searchOptions": {"displayStart": 0, "displayLength": 1}
        })

        if not initial_result.get("successful"):
            return {"successful": False, "error": "Failed to fetch initial data"}

        total_catalog_records = initial_result.get("totalRecords", 0)
        logger.info(f"Inventory summary: {total_catalog_records} catalog records")

        if total_catalog_records == 0:
            result = {
                "successful": True, "totalProducts": 0, "totalSKUs": 0,
                "activeSKUs": 0, "facilitySKUs": 0, "skusWithStock": 0,
                "skusOutOfStock": 0, "outOfStockPercent": 0,
                "totalRealInventory": 0, "totalVirtualInventory": 0,
                "totalStockValue": 0
            }
            CacheService.set(cache_key, result, 14400)
            return result

        # ══════════════════════════════════════════════════════════
        # PHASE 1: Fetch catalog WITHOUT inventory (fast, ~5-10s)
        # Gets: SKU codes, enabled status, prices only
        # ══════════════════════════════════════════════════════════
        catalog_batch_size = 10000  # Max per UC API call
        catalog_concurrency = 4

        all_skus = []          # ordered list of SKU codes
        sku_price_map = {}     # sku_code → price
        active_count = 0

        async def fetch_catalog_batch(start: int):
            """Fetch one catalog batch (no inventory) → SKU metadata."""
            res = await svc.post("/product/itemType/search", {
                "getInventorySnapshot": False,
                "searchOptions": {
                    "displayStart": start,
                    "displayLength": min(catalog_batch_size, total_catalog_records - start)
                }
            })
            if not res.get("successful"):
                logger.warning(f"Catalog batch failed at start={start}")
                return []
            return [
                (item.get("skuCode", ""), item.get("enabled", False), item.get("price", 0) or 0)
                for item in res.get("elements", [])
                if item.get("skuCode")
            ]

        sem1 = asyncio.Semaphore(catalog_concurrency)
        async def limited_catalog(start: int):
            async with sem1:
                return await fetch_catalog_batch(start)

        catalog_starts = list(range(0, total_catalog_records, catalog_batch_size))
        logger.info(f"Phase 1: {len(catalog_starts)} catalog batches (no inventory)")

        catalog_results = await asyncio.gather(*[limited_catalog(s) for s in catalog_starts])

        for batch in catalog_results:
            for sku_code, enabled, price in batch:
                all_skus.append(sku_code)
                sku_price_map[sku_code] = price
                if enabled:
                    active_count += 1

        logger.info(f"Phase 1 done: {len(all_skus)} SKUs, {active_count} active")

        # ══════════════════════════════════════════════════════════
        # PHASE 2: Dedicated inventory snapshot API (fast, ~15-20s)
        # /inventory/inventorySnapshot/get — up to 10K SKUs per call
        # Returns ONLY inventory data, much lighter than catalog+snapshot
        # ══════════════════════════════════════════════════════════
        snapshot_batch_size = 5000
        snapshot_concurrency = 3

        totals = {
            "totalRealInventory": 0, "totalVirtualInventory": 0,
            "totalStockValue": 0, "facilitySKUs": 0,
            "skusWithStock": 0, "skusOutOfStock": 0,
        }

        async def fetch_snapshot_batch(sku_batch: list):
            """Fetch inventory snapshots for a batch of SKUs."""
            partial = {
                "facilitySKUs": 0, "skusWithStock": 0, "skusOutOfStock": 0,
                "totalRealInventory": 0, "totalVirtualInventory": 0, "totalStockValue": 0,
            }
            snap_result = await svc.post(
                "/inventory/inventorySnapshot/get",
                {"itemTypeSKUs": sku_batch}
            )
            if not snap_result.get("successful"):
                logger.warning(f"Snapshot batch failed for {len(sku_batch)} SKUs")
                partial["skusOutOfStock"] = len(sku_batch)
                return partial

            # Build SKU → snapshot map
            snapshot_map = {}
            for snap in snap_result.get("inventorySnapshots", []):
                sku = snap.get("itemTypeSKU", "")
                if sku:
                    snapshot_map[sku] = snap

            for sku in sku_batch:
                snap = snapshot_map.get(sku)
                if not snap:
                    partial["skusOutOfStock"] += 1
                    continue

                inv = 0
                for field in ["inventory", "goodInventory", "availableInventory"]:
                    val = snap.get(field)
                    if val is not None and val != 0:
                        inv = int(val)
                        break

                has_activity = any(
                    (snap.get(f) or 0) != 0
                    for f in ["inventory", "goodInventory", "availableInventory",
                              "openSale", "openPurchase", "badInventory",
                              "putawayPending", "pendingInventoryAssessment",
                              "pendingStockTransfer", "vendorInventory",
                              "virtualInventory", "inventoryBlocked"]
                )
                if has_activity:
                    partial["facilitySKUs"] += 1

                vi = snap.get("virtualInventory", 0) or 0
                partial["totalVirtualInventory"] += int(vi)

                if inv > 0:
                    partial["skusWithStock"] += 1
                else:
                    partial["skusOutOfStock"] += 1

                partial["totalRealInventory"] += inv
                partial["totalStockValue"] += inv * sku_price_map.get(sku, 0)

            return partial

        sku_batches = [all_skus[i:i + snapshot_batch_size]
                       for i in range(0, len(all_skus), snapshot_batch_size)]
        logger.info(f"Phase 2: {len(sku_batches)} snapshot batches of {snapshot_batch_size}")

        sem2 = asyncio.Semaphore(snapshot_concurrency)
        async def limited_snapshot(batch):
            async with sem2:
                return await fetch_snapshot_batch(batch)

        snapshot_results = await asyncio.gather(*[limited_snapshot(b) for b in sku_batches])

        for partial in snapshot_results:
            for key in totals:
                totals[key] += partial.get(key, 0)

        out_of_stock_percent = 0
        if total_catalog_records > 0:
            out_of_stock_percent = round(
                (totals["skusOutOfStock"] / total_catalog_records) * 100)

        logger.info(f"Inventory summary: {totals}, OOS%: {out_of_stock_percent}")

        result = {
            "successful": True,
            "totalProducts": total_catalog_records,
            "totalSKUs": total_catalog_records,
            "activeSKUs": active_count,
            "facilitySKUs": totals["facilitySKUs"],
            "skusWithStock": totals["skusWithStock"],
            "skusOutOfStock": totals["skusOutOfStock"],
            "outOfStockPercent": out_of_stock_percent,
            "totalRealInventory": totals["totalRealInventory"],
            "totalVirtualInventory": totals["totalVirtualInventory"],
            "totalStockValue": totals["totalStockValue"]
        }

        CacheService.set(cache_key, result, 14400)
        return result

    except Exception as e:
        logger.error(f"Error computing inventory summary: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
