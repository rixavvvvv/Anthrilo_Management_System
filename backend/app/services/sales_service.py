import json
from datetime import date as date_type
from sqlalchemy.orm import Session
from app.core.redis import redis_client
from app.db.models import Sale
from decimal import Decimal

CACHE_TTL = 900  # 15 minutes


def get_daily_sales(report_date: date_type, db: Session):
    """Get daily sales report with Redis caching"""
    cache_key = f"report:daily_sales:{report_date}"

    # 1️⃣ Check Redis cache
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        print(f"Redis read error: {e}")
        # Continue to DB if Redis fails

    # 2️⃣ Fetch from DB
    sales = db.query(Sale).filter(Sale.transaction_date == report_date).all()

    total_orders = len(sales)
    revenue = sum(float(s.total_amount) for s in sales)

    result = {
        "date": str(report_date),
        "total_orders": total_orders,
        "revenue": revenue
    }

    # 3️⃣ Store in Redis
    try:
        redis_client.setex(cache_key, CACHE_TTL, json.dumps(result))
    except Exception as e:
        print(f"Redis write error: {e}")
        # Continue without caching if Redis fails

    return result


def invalidate_daily_sales_cache(report_date: date_type):
    """Invalidate daily sales cache for a specific date"""
    cache_key = f"report:daily_sales:{report_date}"
    try:
        redis_client.delete(cache_key)
    except Exception as e:
        print(f"Redis delete error: {e}")
