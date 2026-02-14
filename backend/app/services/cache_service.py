import json
from typing import Any, Optional
from datetime import date as date_type, timedelta
from sqlalchemy.orm import Session
from app.core.redis import redis_client
import logging

logger = logging.getLogger(__name__)


class CacheService:
    """Centralized Redis caching service"""

    # Cache TTLs (in seconds)
    TTL_SHORT = 300      # 5 minutes
    TTL_MEDIUM = 900     # 15 minutes
    TTL_LONG = 1800      # 30 minutes
    TTL_VERY_LONG = 3600  # 1 hour

    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Get value from Redis cache"""
        if not redis_client:
            return None
        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Redis get error for key {key}: {e}")
        return None

    @staticmethod
    def set(key: str, value: Any, ttl: int = TTL_MEDIUM) -> bool:
        """Set value in Redis cache with TTL"""
        if not redis_client:
            return False
        try:
            redis_client.setex(key, ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.error(f"Redis set error for key {key}: {e}")
            return False

    @staticmethod
    def delete(key: str) -> bool:
        """Delete key from Redis cache"""
        if not redis_client:
            return False
        try:
            redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error for key {key}: {e}")
            return False

    @staticmethod
    def delete_pattern(pattern: str) -> bool:
        """Delete all keys matching pattern"""
        if not redis_client:
            return False
        try:
            keys = redis_client.keys(pattern)
            if keys:
                redis_client.delete(*keys)
            return True
        except Exception as e:
            logger.error(f"Redis delete pattern error for {pattern}: {e}")
            return False

    # Specific cache operations

    @staticmethod
    def get_report_cache(report_type: str, params: dict) -> Optional[Any]:
        """Get cached report data"""
        params_str = "_".join(f"{k}:{v}" for k, v in sorted(params.items()))
        key = f"report:{report_type}:{params_str}"
        return CacheService.get(key)

    @staticmethod
    def set_report_cache(report_type: str, params: dict, value: Any, ttl: int = TTL_MEDIUM) -> bool:
        """Cache report data"""
        params_str = "_".join(f"{k}:{v}" for k, v in sorted(params.items()))
        key = f"report:{report_type}:{params_str}"
        return CacheService.set(key, value, ttl)

    @staticmethod
    def invalidate_report_cache(report_type: str):
        """Invalidate all cached reports of a specific type"""
        pattern = f"report:{report_type}:*"
        return CacheService.delete_pattern(pattern)

    @staticmethod
    def get_inventory_cache(inventory_id: Optional[int] = None) -> Optional[Any]:
        """Get cached inventory data"""
        if inventory_id:
            key = f"inventory:{inventory_id}"
        else:
            key = "inventory:list"
        return CacheService.get(key)

    @staticmethod
    def set_inventory_cache(value: Any, inventory_id: Optional[int] = None, ttl: int = TTL_SHORT) -> bool:
        """Cache inventory data"""
        if inventory_id:
            key = f"inventory:{inventory_id}"
        else:
            key = "inventory:list"
        return CacheService.set(key, value, ttl)

    @staticmethod
    def invalidate_inventory_cache():
        """Invalidate all inventory caches"""
        return CacheService.delete_pattern("inventory:*")

    @staticmethod
    def get_garment_cache(garment_id: Optional[int] = None) -> Optional[Any]:
        """Get cached garment data"""
        if garment_id:
            key = f"garment:{garment_id}"
        else:
            key = "garment:list"
        return CacheService.get(key)

    @staticmethod
    def set_garment_cache(value: Any, garment_id: Optional[int] = None, ttl: int = TTL_LONG) -> bool:
        """Cache garment data"""
        if garment_id:
            key = f"garment:{garment_id}"
        else:
            key = "garment:list"
        return CacheService.set(key, value, ttl)

    @staticmethod
    def invalidate_garment_cache():
        """Invalidate all garment caches"""
        return CacheService.delete_pattern("garment:*")
