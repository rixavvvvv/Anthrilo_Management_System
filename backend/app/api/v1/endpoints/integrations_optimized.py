"""
Unicommerce Integration API Endpoints - PRODUCTION VERSION
===========================================================
Accurate revenue using sellingPrice ONLY with proper pagination

Features:
- Today, Yesterday, Last 7 Days, Last 30 Days filters
- Page-wise pagination (12 orders per page)
- Revenue by channel
- Validation logging
"""

from fastapi import APIRouter, Query
import logging
from datetime import datetime, timezone, timedelta
from app.services.unicommerce_optimized import get_unicommerce_service
from app.core.token_manager import get_token_manager

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# SUMMARY ENDPOINTS (For dashboard cards - no pagination needed)
# =============================================================================

@router.get("/unicommerce/today")
async def get_today_sales():
    """
    Get today's sales summary.

    Time range: 00:00:00 to (current time - 1 minute)
    Revenue: Calculated using sellingPrice ONLY
    """
    try:
        logger.info("Fetching TODAY sales")
        service = get_unicommerce_service()
        result = await service.get_today_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"✅ TODAY: {summary.get('total_orders', 0)} orders, "
                f"₹{summary.get('total_revenue', 0):,.2f} (sellingPrice)"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error in get_today_sales: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch today's sales"}


@router.get("/unicommerce/yesterday")
async def get_yesterday_sales():
    """
    Get yesterday's sales summary.

    Time range: 00:00:00 to 23:59:59
    Revenue: Calculated using sellingPrice ONLY
    """
    try:
        logger.info("📊 Fetching YESTERDAY sales")
        service = get_unicommerce_service()
        result = await service.get_yesterday_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"✅ YESTERDAY: {summary.get('total_orders', 0)} orders, "
                f"₹{summary.get('total_revenue', 0):,.2f} (sellingPrice)"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error in get_yesterday_sales: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch yesterday's sales"}


@router.get("/unicommerce/last-7-days")
async def get_last_7_days():
    """
    Get last 7 complete days sales (not including today).

    Revenue: Calculated using sellingPrice ONLY
    No overlap with Today filter.
    """
    try:
        logger.info("📊 Fetching LAST 7 DAYS sales")
        service = get_unicommerce_service()
        result = await service.get_last_7_days_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"✅ 7 DAYS: {summary.get('total_orders', 0)} orders, "
                f"₹{summary.get('total_revenue', 0):,.2f} (sellingPrice)"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error in get_last_7_days: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch last 7 days sales"}


@router.get("/unicommerce/last-30-days")
async def get_last_30_days():
    """
    Get last 30 complete days sales (not including today).

    Revenue: Calculated using sellingPrice ONLY
    No overlap with Today filter.
    """
    try:
        logger.info("📊 Fetching LAST 30 DAYS sales")
        service = get_unicommerce_service()
        result = await service.get_last_30_days_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"✅ 30 DAYS: {summary.get('total_orders', 0)} orders, "
                f"₹{summary.get('total_revenue', 0):,.2f} (sellingPrice)"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error in get_last_30_days: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch last 30 days sales"}


# Backward compatibility aliases
@router.get("/unicommerce/last-24-hours")
async def get_last_24_hours():
    """Alias for today's sales (backward compatibility)"""
    return await get_today_sales()


# =============================================================================
# PAGINATED ENDPOINTS (For order listing - 12 orders per page)
# =============================================================================

@router.get("/unicommerce/orders/today")
async def get_today_orders_paginated(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(12, ge=1, le=100, description="Orders per page")
):
    """
    Get today's orders with pagination.

    - Page-wise navigation (Next/Previous/Page number)
    - 12 orders per page by default
    - Revenue per page using sellingPrice
    """
    try:
        logger.info(f"📄 Fetching TODAY orders - Page {page}")
        service = get_unicommerce_service()
        result = await service.get_today_orders_paginated(page, page_size)

        if result.get("success"):
            pagination = result.get("pagination", {})
            logger.info(
                f"✅ Page {page}/{pagination.get('total_pages', 0)}: "
                f"{len(result.get('orders', []))} orders"
            )

        return result

    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/yesterday")
async def get_yesterday_orders_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get yesterday's orders with pagination."""
    try:
        logger.info(f"📄 Fetching YESTERDAY orders - Page {page}")
        service = get_unicommerce_service()
        result = await service.get_yesterday_orders_paginated(page, page_size)
        return result
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/last-7-days")
async def get_last_7_days_orders_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get last 7 days orders with pagination."""
    try:
        logger.info(f"📄 Fetching 7 DAYS orders - Page {page}")
        service = get_unicommerce_service()
        result = await service.get_last_7_days_orders_paginated(page, page_size)
        return result
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/last-30-days")
async def get_last_30_days_orders_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get last 30 days orders with pagination."""
    try:
        logger.info(f"📄 Fetching 30 DAYS orders - Page {page}")
        service = get_unicommerce_service()
        result = await service.get_last_30_days_orders_paginated(page, page_size)
        return result
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/custom")
async def get_custom_orders_paginated(
    from_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get orders for custom date range with pagination."""
    try:
        logger.info(
            f"📄 Fetching CUSTOM orders {from_date} to {to_date} - Page {page}")

        # Parse dates
        from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(
            hour=0, minute=0, second=0, tzinfo=timezone.utc
        )
        to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )

        service = get_unicommerce_service()
        result = await service.get_orders_paginated(from_dt, to_dt, page, page_size)
        return result

    except ValueError as e:
        return {"success": False, "error": f"Invalid date format: {e}"}
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# SALES REPORT ENDPOINT (For /dashboard/reports/sales)
# =============================================================================

@router.get("/unicommerce/sales-report")
async def get_sales_report(
    from_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    period: str = Query(
        "today", description="Preset: today, yesterday, last_7_days, last_30_days, custom")
):
    """
    Get comprehensive sales report.

    Revenue: Calculated using sellingPrice ONLY

    Presets:
    - today: 00:00:00 to (now - 1 minute)
    - yesterday: 00:00:00 to 23:59:59
    - last_7_days: 7 complete days (not including today)
    - last_30_days: 30 complete days (not including today)
    - custom: Use from_date and to_date
    """
    try:
        logger.info(f"📊 Generating sales report - Period: {period}")
        service = get_unicommerce_service()

        if period == "today":
            result = await service.get_today_sales()
        elif period == "yesterday":
            result = await service.get_yesterday_sales()
        elif period == "last_7_days":
            result = await service.get_last_7_days_sales()
        elif period == "last_30_days":
            result = await service.get_last_30_days_sales()
        elif period == "custom" and from_date and to_date:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, tzinfo=timezone.utc
            )
            to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            result = await service.get_custom_range_sales(from_dt, to_dt)
        else:
            # Default to today
            result = await service.get_today_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"✅ Report: {summary.get('total_orders', 0)} orders, "
                f"₹{summary.get('total_revenue', 0):,.2f} revenue (sellingPrice)"
            )

        return result

    except ValueError as e:
        return {"success": False, "error": f"Invalid date format: {e}"}
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# CHANNEL BREAKDOWN ENDPOINT
# =============================================================================

@router.get("/unicommerce/channel-revenue")
async def get_channel_revenue(
    period: str = Query(
        "last_30_days", description="Period for channel breakdown")
):
    """
    Get revenue breakdown by channel/marketplace.

    Revenue: Calculated using sellingPrice ONLY per channel
    """
    try:
        logger.info(f"📊 Fetching channel revenue - Period: {period}")
        service = get_unicommerce_service()

        if period == "today":
            result = await service.get_today_sales()
        elif period == "yesterday":
            result = await service.get_yesterday_sales()
        elif period == "last_7_days":
            result = await service.get_last_7_days_sales()
        else:
            result = await service.get_last_30_days_sales()

        if not result.get("success"):
            return result

        # Extract channel breakdown
        summary = result.get("summary", {})
        channel_breakdown = summary.get("channel_breakdown", {})
        total_revenue = summary.get("total_revenue", 0)

        # Format for frontend
        channels = []
        for channel, data in sorted(
            channel_breakdown.items(),
            key=lambda x: x[1].get("revenue", 0),
            reverse=True
        ):
            channels.append({
                "channel": channel,
                "orders": data.get("orders", 0),
                "revenue": data.get("revenue", 0),
                "percentage": round(
                    (data.get("revenue", 0) / total_revenue *
                     100) if total_revenue > 0 else 0,
                    2
                )
            })

        # Validation: channel sum should equal total
        channel_sum = sum(ch["revenue"] for ch in channels)
        validation_passed = abs(channel_sum - total_revenue) < 1

        if not validation_passed:
            logger.warning(
                f"⚠️ VALIDATION: Channel sum ({channel_sum:,.2f}) != "
                f"Total ({total_revenue:,.2f})"
            )

        return {
            "success": True,
            "period": period,
            "total_revenue": total_revenue,
            "total_orders": summary.get("total_orders", 0),
            "channels": channels,
            "validation": {
                "channel_sum": channel_sum,
                "total_revenue": total_revenue,
                "passed": validation_passed
            },
            "revenue_method": "sellingPrice_only"
        }

    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# VALIDATION ENDPOINT
# =============================================================================

@router.get("/unicommerce/validate")
async def validate_revenue():
    """
    Run revenue validation checks.

    Checks:
    - 7-day revenue < 30-day revenue
    - Channel totals = overall total
    """
    try:
        logger.info("🔍 Running revenue validation")
        service = get_unicommerce_service()
        result = await service.validate_revenue_consistency()
        return result
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# AUTH STATUS
# =============================================================================

@router.get("/unicommerce/auth/status")
async def get_auth_status():
    """Get Unicommerce authentication status."""
    try:
        token_manager = get_token_manager()
        status = token_manager.get_token_status()
        return {
            "success": True,
            "authentication_status": status,
            "message": "Token lifecycle is managed automatically"
        }
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.post("/unicommerce/auth/refresh")
async def force_refresh_token():
    """Manually trigger token refresh."""
    try:
        token_manager = get_token_manager()
        token = await token_manager.get_valid_token()

        if token:
            return {
                "success": True,
                "message": "Token refreshed",
                "status": token_manager.get_token_status()
            }
        else:
            return {"success": False, "message": "Failed to refresh token"}
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# BACKWARD COMPATIBILITY
# =============================================================================

@router.get("/unicommerce/search-orders")
async def search_orders(
    from_date: str = Query(...),
    to_date: str = Query(...),
    display_start: int = Query(0),
    display_length: int = Query(100)
):
    """Search orders (backward compatible)."""
    try:
        from_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        to_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))

        service = get_unicommerce_service()
        result = await service.search_sale_orders(
            from_date=from_dt,
            to_date=to_dt,
            display_start=display_start,
            display_length=display_length
        )
        return result
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/order-items/{order_code}")
async def get_order_items(order_code: str):
    """Get order details."""
    try:
        service = get_unicommerce_service()
        return await service.get_order_details(order_code)
    except Exception as e:
        logger.error(f"❌ Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.post("/unicommerce/clear-cache")
async def clear_cache():
    """Clear the sales data cache to force fresh data fetch."""
    try:
        service = get_unicommerce_service()
        service._cache.clear()
        logger.info("🗑️ Sales data cache cleared")
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
    except Exception as e:
        logger.error(f"❌ Error clearing cache: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/cache-stats")
async def get_cache_stats():
    """Get cache statistics showing what's cached and TTL info."""
    try:
        service = get_unicommerce_service()
        from datetime import datetime

        stats = []
        for key, (timestamp, data) in service._cache.items():
            age_seconds = (datetime.now() - timestamp).total_seconds()
            remaining_seconds = max(0, service.CACHE_TTL_SECONDS - age_seconds)

            stats.append({
                "key": key,
                "age_seconds": round(age_seconds, 2),
                "remaining_seconds": round(remaining_seconds, 2),
                "is_expired": age_seconds >= service.CACHE_TTL_SECONDS,
                "cached_at": timestamp.isoformat()
            })

        return {
            "success": True,
            "cache_ttl_seconds": service.CACHE_TTL_SECONDS,
            "total_cached_items": len(stats),
            "items": stats
        }
    except Exception as e:
        logger.error(f"❌ Error getting cache stats: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
