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
from typing import Any, Dict, List, Optional

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
    Uses catalog search for SKU list + inventory snapshot API for accurate virtual inventory.
    Uses Redis caching with 30-minute TTL for performance.
    """
    from app.services.cache_service import CacheService

    cache_key = "uc:inventory:summary:all"

    # Try to get from cache first (unless force refresh)
    if not force_refresh:
        cached = CacheService.get(cache_key)
        if cached:
            logger.info("Returning cached inventory summary")
            return cached

    try:
        svc = get_uc_api_service()

        # First get total record count from catalog
        initial_payload = {
            "getInventorySnapshot": True,
            "searchOptions": {
                "displayStart": 0,
                "displayLength": 1
            }
        }
        initial_result = await svc.post("/product/itemType/search", initial_payload)

        if not initial_result.get("successful"):
            logger.warning(f"Initial summary query failed: {initial_result}")
            return {
                "successful": False,
                "error": "Failed to fetch initial data"
            }

        total_catalog_records = initial_result.get("totalRecords", 0)
        logger.info(
            f"Computing inventory summary for {total_catalog_records} catalog records")

        if total_catalog_records == 0:
            result = {
                "successful": True,
                "totalProducts": 0,
                "totalSKUs": 0,
                "activeSKUs": 0,
                "skusWithStock": 0,
                "skusOutOfStock": 0,
                "outOfStockPercent": 0,
                "totalRealInventory": 0,
                "totalVirtualInventory": 0,
                "totalStockValue": 0
            }
            CacheService.set(cache_key, result, CacheService.TTL_LONG)
            return result

        # Fetch ALL records in large batches for speed
        batch_size = 1000  # Larger batches = fewer API calls = faster
        totals = {
            "totalRealInventory": 0,
            "totalVirtualInventory": 0,
            "totalStockValue": 0,
            "activeSKUs": 0,
            "skusWithStock": 0,
            "skusOutOfStock": 0
        }

        all_skus = []  # Collect all SKU codes for dedicated inventory snapshot

        # Fetch all pages from catalog
        for start in range(0, total_catalog_records, batch_size):
            batch_payload = {
                "getInventorySnapshot": True,
                "searchOptions": {
                    "displayStart": start,
                    "displayLength": min(batch_size, total_catalog_records - start)
                }
            }

            batch_result = await svc.post("/product/itemType/search", batch_payload)

            if not batch_result.get("successful"):
                logger.warning(f"Batch query failed at start={start}")
                continue

            elements = batch_result.get("elements", [])

            for item in elements:
                is_enabled = item.get("enabled", False)
                sku_code = item.get("skuCode", "")

                if sku_code:
                    all_skus.append(sku_code)

                # Count active SKUs
                if is_enabled:
                    totals["activeSKUs"] += 1

                snapshots = item.get("inventorySnapshots", [])
                if snapshots:
                    snap = snapshots[0]

                    # Get inventory - try multiple field names
                    inv = 0
                    for field in ["inventory", "goodInventory", "availableInventory"]:
                        val = snap.get(field)
                        if val is not None and val != 0:
                            inv = int(val)
                            break

                    # Count SKUs with/without stock
                    if inv > 0:
                        totals["skusWithStock"] += 1
                    else:
                        totals["skusOutOfStock"] += 1

                    totals["totalRealInventory"] += inv

                    # Calculate value
                    price = item.get("price", 0) or 0
                    totals["totalStockValue"] += inv * price
                else:
                    # No inventory snapshot = out of stock
                    totals["skusOutOfStock"] += 1

            # Log progress for large datasets
            if start % 10000 == 0 and start > 0:
                logger.info(
                    f"Summary progress: processed {start}/{total_catalog_records} records")

        # Now fetch virtualInventory from DEDICATED inventory snapshot API
        # (catalog search may not include virtualInventory accurately)
        total_virtual = 0
        snapshot_batch_size = 500  # inventorySnapshot/get supports up to 10,000 SKUs
        for i in range(0, len(all_skus), snapshot_batch_size):
            batch_skus = all_skus[i:i + snapshot_batch_size]
            snap_payload = {"itemTypeSKUs": batch_skus}
            snap_result = await svc.post(
                "/inventory/inventorySnapshot/get", snap_payload
            )
            if snap_result.get("successful"):
                for snap in snap_result.get("inventorySnapshots", []):
                    vi = snap.get("virtualInventory", 0)
                    if vi is not None:
                        total_virtual += int(vi)
            else:
                logger.warning(f"Inventory snapshot batch {i} failed, "
                               f"falling back to catalog data")
                # Fallback: re-read from catalog snapshots (already collected above won't help)
                break

        if total_virtual > 0:
            totals["totalVirtualInventory"] = total_virtual
            logger.info(
                f"Virtual inventory from snapshot API: {total_virtual}")

        # Calculate out of stock percentage
        total_checked = totals["skusWithStock"] + totals["skusOutOfStock"]
        out_of_stock_percent = 0
        if total_checked > 0:
            out_of_stock_percent = round(
                (totals["skusOutOfStock"] / total_checked) * 100)

        logger.info(
            f"Inventory summary computed: {totals}, outOfStockPercent: {out_of_stock_percent}")

        result = {
            "successful": True,
            "totalProducts": total_catalog_records,
            "totalSKUs": total_catalog_records,
            "activeSKUs": totals["activeSKUs"],
            "skusWithStock": totals["skusWithStock"],
            "skusOutOfStock": totals["skusOutOfStock"],
            "outOfStockPercent": out_of_stock_percent,
            "totalRealInventory": totals["totalRealInventory"],
            "totalVirtualInventory": totals["totalVirtualInventory"],
            "totalStockValue": totals["totalStockValue"]
        }

        # Cache for 30 minutes
        CacheService.set(cache_key, result, CacheService.TTL_LONG)

        return result

    except Exception as e:
        logger.error(f"Error computing inventory summary: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
