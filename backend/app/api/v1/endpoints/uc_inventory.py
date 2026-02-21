"""
Unicommerce Inventory API Endpoints
=====================================
Covers:
- Get Inventory Snapshot (Export Job API - fast, complete inventory)
- Adjust Inventory (Single)
- Adjust Inventory (Multiple / Bulk)
- Adjust Batchwise Inventory (Multiple)
- Mark Inventory Found
- Get Nearby Store Inventory
"""

from fastapi import APIRouter, Body, Query
import logging
from typing import Any, Dict, Optional

from app.services.unicommerce_api_service import get_uc_api_service
from app.services.unicommerce_optimized import get_unicommerce_service
from app.services.cache_service import CacheService

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# INVENTORY SNAPSHOT (EXPORT JOB API - FAST)
# =============================================================================

@router.get("/snapshot")
async def get_inventory_snapshot_export(
    category: Optional[str] = Query(None, description="Filter by category name"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    enabled_only: bool = Query(True, description="Only show enabled items"),
    in_stock_only: bool = Query(False, description="Only show items with inventory > 0"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    force_refresh: bool = Query(False, description="Bypass cache and re-fetch"),
):
    """
    Get COMPLETE inventory snapshot using Export Job API.
    Returns all ~26K+ SKUs with inventory levels, categories, sizes, colors.
    Much faster than the old API (5s vs 23s) and covers ALL inventory.
    Cached for 15 minutes.
    """
    try:
        cache_key = "uc:inventory:snapshot:all"

        if not force_refresh:
            cached = CacheService.get(cache_key)
            if cached:
                logger.info("INVENTORY SNAPSHOT: Redis cache hit")
                all_items = cached.get("inventorySnapshots", [])
                filtered = _filter_inventory(
                    all_items, category, brand, enabled_only, in_stock_only
                )
                paginated = _paginate(filtered, page, page_size)
                paginated["_cached"] = True
                paginated["method"] = cached.get("method", "export_job")
                return paginated

        # Fetch via export
        service = get_unicommerce_service()
        result = await service.fetch_inventory_via_export()

        if not result.get("successful"):
            return {"successful": False, "error": "Failed to fetch inventory"}

        # Cache all items (before filtering)
        CacheService.set(cache_key, result, ttl=900)  # 15 min

        all_items = result.get("inventorySnapshots", [])
        filtered = _filter_inventory(
            all_items, category, brand, enabled_only, in_stock_only
        )
        paginated = _paginate(filtered, page, page_size)
        paginated["method"] = result.get("method", "export_job")
        paginated["fetch_time"] = result.get("total_time", 0)
        return paginated

    except Exception as e:
        logger.error(f"Error in inventory snapshot: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.get("/snapshot/summary")
async def get_inventory_summary(
    force_refresh: bool = Query(False, description="Bypass cache"),
):
    """
    Get inventory summary: total SKUs, total stock, category breakdown, etc.
    """
    try:
        cache_key = "uc:inventory:snapshot:all"

        cached = None if force_refresh else CacheService.get(cache_key)

        if cached:
            all_items = cached.get("inventorySnapshots", [])
        else:
            service = get_unicommerce_service()
            result = await service.fetch_inventory_via_export()
            if not result.get("successful"):
                return {"successful": False, "error": "Failed to fetch inventory"}
            CacheService.set(cache_key, result, ttl=900)
            all_items = result.get("inventorySnapshots", [])

        # Build summary
        total_skus = len(all_items)
        enabled_items = [i for i in all_items if i.get("enabled")]
        in_stock = [i for i in enabled_items if i.get("inventory", 0) > 0]
        total_inventory = sum(i.get("inventory", 0) for i in all_items)
        total_blocked = sum(i.get("inventoryBlocked", 0) for i in all_items)
        total_bad = sum(i.get("badInventory", 0) for i in all_items)
        total_open_sale = sum(i.get("openSale", 0) for i in all_items)

        # Category breakdown
        category_map = {}
        for item in enabled_items:
            cat = item.get("categoryName", "Uncategorized") or "Uncategorized"
            if cat not in category_map:
                category_map[cat] = {"skus": 0, "inventory": 0, "openSale": 0}
            category_map[cat]["skus"] += 1
            category_map[cat]["inventory"] += item.get("inventory", 0)
            category_map[cat]["openSale"] += item.get("openSale", 0)

        # Sort categories by inventory desc
        categories = sorted(
            [{"category": k, **v} for k, v in category_map.items()],
            key=lambda x: x["inventory"],
            reverse=True,
        )

        return {
            "successful": True,
            "summary": {
                "total_skus": total_skus,
                "enabled_skus": len(enabled_items),
                "in_stock_skus": len(in_stock),
                "out_of_stock_skus": len(enabled_items) - len(in_stock),
                "total_inventory": total_inventory,
                "total_blocked": total_blocked,
                "total_bad": total_bad,
                "total_open_sale": total_open_sale,
            },
            "categories": categories,
        }

    except Exception as e:
        logger.error(f"Error in inventory summary: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.get("/snapshot/search")
async def search_inventory(
    q: str = Query(..., description="Search term (SKU name, category, brand, color)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    """Search inventory by SKU name, category, brand, or color."""
    try:
        cache_key = "uc:inventory:snapshot:all"
        cached = CacheService.get(cache_key)

        if cached:
            all_items = cached.get("inventorySnapshots", [])
        else:
            service = get_unicommerce_service()
            result = await service.fetch_inventory_via_export()
            if not result.get("successful"):
                return {"successful": False, "error": "Failed to fetch inventory"}
            CacheService.set(cache_key, result, ttl=900)
            all_items = result.get("inventorySnapshots", [])

        q_lower = q.lower()
        matched = [
            item for item in all_items
            if (
                q_lower in (item.get("itemTypeSKU", "") or "").lower()
                or q_lower in (item.get("categoryName", "") or "").lower()
                or q_lower in (item.get("brand", "") or "").lower()
                or q_lower in (item.get("color", "") or "").lower()
                or q_lower in (item.get("size", "") or "").lower()
            )
        ]

        return _paginate(matched, page, page_size)

    except Exception as e:
        logger.error(f"Error searching inventory: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


@router.post("/snapshot/legacy")
async def get_inventory_snapshot_legacy(payload: Dict[str, Any] = Body(...)):
    """
    Legacy endpoint: Direct call to UC inventorySnapshot/get API.
    Use GET /snapshot instead for the fast export-based approach.
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/inventory/inventorySnapshot/get", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# ADJUST INVENTORY (SINGLE)
# =============================================================================

@router.post("/adjust")
async def adjust_inventory_single(payload: Dict[str, Any] = Body(...)):
    """
    Adjust inventory for a single SKU.
    Payload: {
        inventoryAdjustment: {
            itemSKU, quantity, shelfCode, adjustmentType (ADD|REMOVE|REPLACE|TRANSFER),
            inventoryType? (GOOD_INVENTORY|BAD_INVENTORY|QC_REJECTED|VIRTUAL_INVENTORY),
            transferToShelfCode?, remarks?
        },
        facility_code
    }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post("/inventory/adjust", payload, facility_code=fc)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# ADJUST INVENTORY (MULTIPLE / BULK)
# =============================================================================

@router.post("/adjust/bulk")
async def adjust_inventory_bulk(payload: Dict[str, Any] = Body(...)):
    """
    Adjust inventory for multiple SKUs (across facilities).
    Payload: {
        inventoryAdjustments: [
            {
                itemSKU, quantity, shelfCode, adjustmentType,
                inventoryType?, facilityCode, remarks?,
                transferToShelfCode?
            }, ...
        ],
        forceAllocate?: false
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/inventory/adjust/bulk", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# ADJUST BATCHWISE INVENTORY (MULTIPLE)
# =============================================================================

@router.post("/adjust/bulk/batchwise")
async def adjust_batchwise_inventory_bulk(payload: Dict[str, Any] = Body(...)):
    """
    Adjust batchwise inventory for multiple SKUs.
    Payload: {
        inventoryAdjustments: [
            {
                itemSKU, quantity, shelfCode, adjustmentType,
                inventoryType?, facilityCode, remarks?,
                batchCode?, batchDetails?: { mrp, mfd, vendorCode, ... }
            }, ...
        ],
        forceAllocate?: false
    }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/inventory/adjust/bulk", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# MARK INVENTORY FOUND
# =============================================================================

@router.post("/mark-found")
async def mark_inventory_found(payload: Dict[str, Any] = Body(...)):
    """
    Mark item(s) as found in inventory.
    Payload: { itemSku, shelfCode, quantityFound, ageingStartDate?, facility_code }
    """
    try:
        svc = get_uc_api_service()
        fc = payload.pop("facility_code", None)
        return await svc.post(
            "/inventory/markQuantityFound", payload, facility_code=fc
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# NEARBY STORE INVENTORY
# =============================================================================

@router.post("/nearby-store")
async def get_nearby_store_inventory(payload: Dict[str, Any] = Body(...)):
    """
    Get proximity-based inventory overview at warehouses/stores.
    Payload: { skuCode, pincode, ... }
    """
    try:
        svc = get_uc_api_service()
        return await svc.post("/oms/nearbyInventory/get", payload)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"successful": False, "error": str(e)}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _filter_inventory(items, category, brand, enabled_only, in_stock_only):
    """Filter inventory items by category, brand, enabled status, stock level."""
    filtered = items

    if enabled_only:
        filtered = [i for i in filtered if i.get("enabled")]

    if in_stock_only:
        filtered = [i for i in filtered if i.get("inventory", 0) > 0]

    if category:
        cat_lower = category.lower()
        filtered = [
            i for i in filtered
            if cat_lower in (i.get("categoryName", "") or "").lower()
        ]

    if brand:
        brand_lower = brand.lower()
        filtered = [
            i for i in filtered
            if brand_lower in (i.get("brand", "") or "").lower()
        ]

    return filtered


def _paginate(items, page, page_size):
    """Paginate a list of items."""
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = items[start:end]

    return {
        "successful": True,
        "inventorySnapshots": page_items,
        "totalCount": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": (total + page_size - 1) // page_size if total > 0 else 0,
    }
