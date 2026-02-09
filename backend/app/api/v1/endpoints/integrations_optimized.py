"""
Unicommerce Integration API Endpoints - PRODUCTION VERSION (v2)
================================================================
Accurate revenue using sellingPrice ONLY with two-phase fetch.

Includes:
- Summary endpoints (today, yesterday, 7-days, 30-days)
- Paginated order listing
- Background sync endpoints
- Sync status monitoring
- Cache management
- Revenue validation
"""

from fastapi import APIRouter, Query, BackgroundTasks
import logging
from datetime import datetime, timezone, timedelta
from app.services.unicommerce_optimized import get_unicommerce_service
from app.services.sync_service import get_sync_service
from app.core.token_manager import get_token_manager

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================================================
# SUMMARY ENDPOINTS (For dashboard cards)
# =============================================================================

@router.get("/unicommerce/today")
async def get_today_sales():
    """Get today's sales summary using two-phase approach."""
    try:
        logger.info("Fetching TODAY sales")
        service = get_unicommerce_service()
        result = await service.get_today_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"TODAY: {summary.get('total_orders', 0)} orders, "
                f"INR {summary.get('total_revenue', 0):,.2f}"
            )
        return result

    except Exception as e:
        logger.error(f"Error in get_today_sales: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch today's sales"}


@router.get("/unicommerce/yesterday")
async def get_yesterday_sales():
    """Get yesterday's sales summary."""
    try:
        logger.info("Fetching YESTERDAY sales")
        service = get_unicommerce_service()
        result = await service.get_yesterday_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"YESTERDAY: {summary.get('total_orders', 0)} orders, "
                f"INR {summary.get('total_revenue', 0):,.2f}"
            )
        return result

    except Exception as e:
        logger.error(f"Error in get_yesterday_sales: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch yesterday's sales"}


@router.get("/unicommerce/last-7-days")
async def get_last_7_days():
    """Get last 7 complete days sales (not including today)."""
    try:
        logger.info("Fetching LAST 7 DAYS sales")
        service = get_unicommerce_service()
        result = await service.get_last_7_days_sales()

        if result.get("success"):
            summary = result.get("summary", {})
            logger.info(
                f"7 DAYS: {summary.get('total_orders', 0)} orders, "
                f"INR {summary.get('total_revenue', 0):,.2f}"
            )
        return result

    except Exception as e:
        logger.error(f"Error in get_last_7_days: {e}", exc_info=True)
        return {"success": False, "error": str(e), "message": "Failed to fetch last 7 days sales"}


# Backward compatibility alias
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
    """Get today's orders with pagination."""
    try:
        service = get_unicommerce_service()
        return await service.get_today_orders_paginated(page, page_size)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/yesterday")
async def get_yesterday_orders_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get yesterday's orders with pagination."""
    try:
        service = get_unicommerce_service()
        return await service.get_yesterday_orders_paginated(page, page_size)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/orders/last-7-days")
async def get_last_7_days_orders_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100)
):
    """Get last 7 days orders with pagination."""
    try:
        service = get_unicommerce_service()
        return await service.get_last_7_days_orders_paginated(page, page_size)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
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
        from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(
            hour=0, minute=0, second=0, tzinfo=timezone.utc
        )
        to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )

        service = get_unicommerce_service()
        return await service.get_orders_paginated(from_dt, to_dt, page, page_size)

    except ValueError as e:
        return {"success": False, "error": f"Invalid date format: {e}"}
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# SALES REPORT ENDPOINT
# =============================================================================

@router.get("/unicommerce/sales-report")
async def get_sales_report(
    from_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    period: str = Query(
        "today", description="Preset: today, yesterday, last_7_days, custom")
):
    """Get comprehensive sales report."""
    try:
        service = get_unicommerce_service()

        if period == "today":
            result = await service.get_today_sales()
        elif period == "yesterday":
            result = await service.get_yesterday_sales()
        elif period == "last_7_days":
            result = await service.get_last_7_days_sales()
        elif period == "custom" and from_date and to_date:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, tzinfo=timezone.utc
            )
            to_dt = datetime.strptime(to_date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            result = await service.get_custom_range_sales(from_dt, to_dt)
        else:
            result = await service.get_today_sales()

        return result

    except ValueError as e:
        return {"success": False, "error": f"Invalid date format: {e}"}
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/daily-sales-report")
async def get_daily_sales_report(
    date: str = Query(..., description="Date for report (YYYY-MM-DD)")
):
    """
    Get Daily Sales Report with channel-wise breakdown.

    Returns:
    - Channel Name (unique)
    - Quantity of Items (total items per channel)
    - Selling Price (sum of sellingPrice per channel)

    Uses existing saleorder/get data if available, otherwise fetches fresh data.
    """
    try:
        service = get_unicommerce_service()

        # Parse the date
        report_date = datetime.strptime(date, "%Y-%m-%d").date()
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        # Check if we can reuse existing cached data
        result = None
        if report_date == today:
            result = await service.get_today_sales()
        elif report_date == yesterday:
            result = await service.get_yesterday_sales()
        else:
            # Fetch custom date range (full day)
            from_dt = datetime.strptime(date, "%Y-%m-%d").replace(
                hour=0, minute=0, second=0, tzinfo=timezone.utc
            )
            to_dt = datetime.strptime(date, "%Y-%m-%d").replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            result = await service.get_custom_range_sales(from_dt, to_dt)

        if not result.get("success"):
            return result

        # Extract channel breakdown data
        channel_breakdown = result.get(
            "summary", {}).get("channel_breakdown", {})

        # Transform to report format
        # Group by channel with quantity and selling price
        report_data = []
        for channel_name, channel_data in channel_breakdown.items():
            report_data.append({
                "channel_name": channel_name,
                # Total items in channel
                "quantity": channel_data.get("items", 0),
                # Sum of sellingPrice
                "selling_price": channel_data.get("revenue", 0),
                "orders": channel_data.get("orders", 0),  # Number of orders
            })

        # Sort by revenue (highest first)
        report_data.sort(key=lambda x: x["selling_price"], reverse=True)

        # Calculate totals
        total_quantity = sum(item["quantity"] for item in report_data)
        total_revenue = sum(item["selling_price"] for item in report_data)
        total_orders = result.get("summary", {}).get(
            "valid_orders", 0)  # Only valid orders
        total_all_orders = result.get("summary", {}).get(
            "total_orders", 0)  # All orders
        excluded_items = result.get("summary", {}).get(
            "total_items", 0) - total_quantity

        return {
            "success": True,
            "date": date,
            "report": report_data,
            "totals": {
                "total_channels": len(report_data),
                "total_quantity": total_quantity,  # Items from revenue-generating orders only
                "total_revenue": round(total_revenue, 2),
                "total_orders": total_orders,  # Valid orders only
                "excluded_items": excluded_items,  # Items from cancelled/returned orders
                "all_orders": total_all_orders,  # Including excluded orders
            },
            "currency": "INR",
            "data_source": "saleorder/get API",
            "cached": result.get("fetch_info", {}).get("cached", False),
            "note": f"Report shows {total_quantity} items from revenue-generating orders. {excluded_items} items excluded from cancelled/returned orders.",
        }

    except ValueError as e:
        return {"success": False, "error": f"Invalid date format. Use YYYY-MM-DD: {e}"}
    except Exception as e:
        logger.error(
            f"Error generating daily sales report: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# CHANNEL BREAKDOWN ENDPOINT
# =============================================================================

@router.get("/unicommerce/channel-revenue")
async def get_channel_revenue(
    period: str = Query(
        "last_7_days", description="Period for channel breakdown")
):
    """Get revenue breakdown by channel/marketplace."""
    try:
        service = get_unicommerce_service()

        if period == "today":
            result = await service.get_today_sales()
        elif period == "yesterday":
            result = await service.get_yesterday_sales()
        else:
            result = await service.get_last_7_days_sales()

        if not result.get("success"):
            return result

        summary = result.get("summary", {})
        channel_breakdown = summary.get("channel_breakdown", {})
        total_revenue = summary.get("total_revenue", 0)

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

        channel_sum = sum(ch["revenue"] for ch in channels)
        validation_passed = abs(channel_sum - total_revenue) < 1

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
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# BACKGROUND SYNC ENDPOINTS
# =============================================================================

@router.post("/unicommerce/sync/{period}")
async def trigger_sync(
    period: str,
    background_tasks: BackgroundTasks
):
    """
    Trigger background sync for a period.
    Orders are fetched from Unicommerce and persisted to DB.

    Valid periods: today, yesterday, last_7_days
    """
    valid_periods = {"today", "yesterday", "last_7_days"}
    if period not in valid_periods:
        return {
            "success": False,
            "error": f"Invalid period. Use: {', '.join(valid_periods)}"
        }

    try:
        sync_service = get_sync_service()

        # Check if already running
        status = sync_service.get_sync_status(period)
        if status.get("status") == "running":
            return {
                "success": False,
                "message": f"Sync for '{period}' is already running",
                "status": status,
            }

        # Run sync in background
        async def _run_sync():
            await sync_service.sync_period(period)

        background_tasks.add_task(_run_sync)

        return {
            "success": True,
            "message": f"Sync started for '{period}' in background",
            "period": period,
        }

    except Exception as e:
        logger.error(f"Error triggering sync: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.post("/unicommerce/sync/all")
async def trigger_sync_all(background_tasks: BackgroundTasks):
    """Trigger background sync for all periods."""
    try:
        sync_service = get_sync_service()

        async def _run_all_syncs():
            for period in ["today", "yesterday", "last_7_days"]:
                try:
                    await sync_service.sync_period(period)
                except Exception as e:
                    logger.error(f"Sync failed for {period}: {e}")

        background_tasks.add_task(_run_all_syncs)

        return {
            "success": True,
            "message": "Sync started for all periods in background",
        }

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/sync/status")
async def get_sync_status(
    period: str = Query(None, description="Period to check, or omit for all")
):
    """Get sync status for a specific period or all periods."""
    try:
        sync_service = get_sync_service()
        return sync_service.get_sync_status(period)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# VALIDATION ENDPOINT
# =============================================================================

@router.get("/unicommerce/validate")
async def validate_revenue():
    """Run revenue validation checks across all periods."""
    try:
        service = get_unicommerce_service()
        return await service.validate_revenue_consistency()
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# AUTH STATUS
# =============================================================================

@router.get("/unicommerce/auth/status")
async def get_auth_status():
    """Get Unicommerce authentication status and stats."""
    try:
        token_manager = get_token_manager()
        status = token_manager.get_token_status()
        return {
            "success": True,
            "authentication_status": status,
            "message": "Token lifecycle is managed automatically (60s proactive refresh)"
        }
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
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
        logger.error(f"Error: {e}", exc_info=True)
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
        return await service.search_sale_orders(
            from_date=from_dt,
            to_date=to_dt,
            display_start=display_start,
            display_length=display_length
        )
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/order-items/{order_code}")
async def get_order_items(order_code: str):
    """Get order details."""
    try:
        service = get_unicommerce_service()
        return await service.get_order_details(order_code)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

@router.post("/unicommerce/clear-cache")
async def clear_cache():
    """Clear the in-memory sales data cache to force fresh data fetch."""
    try:
        service = get_unicommerce_service()
        service._cache.clear()
        logger.info("Sales data cache cleared")
        return {"success": True, "message": "Cache cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/cache-stats")
async def get_cache_stats():
    """Get cache statistics showing what's cached and TTL info."""
    try:
        service = get_unicommerce_service()

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
        logger.error(f"Error getting cache stats: {e}", exc_info=True)
        return {"success": False, "error": str(e)}


@router.get("/unicommerce/cache-check")
async def check_cache_status():
    """
    Quickly check cache status for all standard periods without fetching data.
    Returns which periods are cached and ready for instant load.
    """
    try:
        service = get_unicommerce_service()

        periods = ["today", "yesterday", "last_7_days"]
        cache_status = {}

        for period in periods:
            cache_key = service._get_cache_key(period)
            if cache_key in service._cache:
                timestamp, _ = service._cache[cache_key]
                age_seconds = (datetime.now() - timestamp).total_seconds()
                is_valid = age_seconds < service.CACHE_TTL_SECONDS

                cache_status[period] = {
                    "cached": True,
                    "valid": is_valid,
                    "age_seconds": round(age_seconds, 2),
                    "remaining_seconds": round(max(0, service.CACHE_TTL_SECONDS - age_seconds), 2),
                    "cached_at": timestamp.isoformat()
                }
            else:
                cache_status[period] = {
                    "cached": False,
                    "valid": False,
                    "age_seconds": None,
                    "remaining_seconds": 0
                }

        all_cached = all(status["valid"] for status in cache_status.values())

        return {
            "success": True,
            "all_periods_cached": all_cached,
            "cache_ttl_seconds": service.CACHE_TTL_SECONDS,
            "periods": cache_status,
            "message": "All data cached and ready for instant load" if all_cached else "Some periods need fetching"
        }
    except Exception as e:
        logger.error(f"Error checking cache: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
