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
            for item in elements:
                snapshots = item.get("inventorySnapshots", [])
                for snap in snapshots:
                    # Normalize field names - try multiple possible field names
                    if "goodInventory" in snap and "inventory" not in snap:
                        snap["inventory"] = snap["goodInventory"]
                    if "availableInventory" in snap and "inventory" not in snap:
                        snap["inventory"] = snap["availableInventory"]
                    # Ensure numeric values
                    snap["inventory"] = snap.get("inventory", 0) or 0
                    snap["virtualInventory"] = snap.get(
                        "virtualInventory", 0) or 0
                    snap["badInventory"] = snap.get("badInventory", 0) or 0
                    snap["openSale"] = snap.get("openSale", 0) or 0

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
                "totalValue": 0
            }

        # Fetch in batches of 100
        batch_size = 100
        totals = {
            "totalInventory": 0,
            "totalVirtualInventory": 0,
            "totalOpenSale": 0,
            "totalBadInventory": 0,
            "totalPutawayPending": 0,
            "totalValue": 0
        }

        # Limit to first 1000 items for performance (configurable)
        max_items = min(total_records, 1000)

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
async def get_inventory_summary():
    """
    Get aggregated inventory summary across all SKUs.
    This endpoint uses the inventory snapshot API for accurate totals.
    Returns:
        totalProducts: Total number of products in catalog
        totalSKUs: Total number of SKUs with inventory
        activeSKUs: Number of active (enabled) SKUs
        skusWithStock: Number of SKUs with inventory > 0
        skusOutOfStock: Number of SKUs with inventory = 0
        outOfStockPercent: Percentage of SKUs out of stock
        totalRealInventory: SUM of all inventory values
        totalVirtualInventory: SUM of all virtualInventory values
        totalStockValue: Total stock value (inventory * price)
    """
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
            return {
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

        # Fetch ALL records in batches for accurate totals
        batch_size = 500
        totals = {
            "totalRealInventory": 0,
            "totalVirtualInventory": 0,
            "totalStockValue": 0,
            "activeSKUs": 0,
            "skusWithStock": 0,
            "skusOutOfStock": 0
        }

        # Fetch all pages
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

                    # Get virtual inventory
                    virtual_inv = snap.get("virtualInventory", 0)
                    if virtual_inv is None:
                        virtual_inv = 0
                    virtual_inv = int(virtual_inv)

                    totals["totalRealInventory"] += inv
                    totals["totalVirtualInventory"] += virtual_inv

                    # Calculate value
                    price = item.get("price", 0) or 0
                    totals["totalStockValue"] += inv * price
                else:
                    # No inventory snapshot = out of stock
                    totals["skusOutOfStock"] += 1

            # Log progress for large datasets
            if start % 10000 == 0 and start > 0:
                logger.info(f"Summary progress: processed {start}/{total_catalog_records} records. "
                            f"Running totals - Inventory: {totals['totalRealInventory']}, "
                            f"With Stock: {totals['skusWithStock']}")

        # Calculate out of stock percentage
        total_checked = totals["skusWithStock"] + totals["skusOutOfStock"]
        out_of_stock_percent = 0
        if total_checked > 0:
            out_of_stock_percent = round(
                (totals["skusOutOfStock"] / total_checked) * 100)

        logger.info(
            f"Inventory summary computed: {totals}, outOfStockPercent: {out_of_stock_percent}")

        return {
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

    except Exception as e:
        logger.error(f"Error computing inventory summary: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}
