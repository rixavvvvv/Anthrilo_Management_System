from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.redis import redis_client
import asyncio
import logging

logger = logging.getLogger(__name__)


# ─── Startup / Shutdown lifecycle ─────────────────────────────────────────────

async def _preload_caches():
    """
    Pre-fetch today's & yesterday's sales + inventory snapshot into Redis
    so the first visitor gets an instant response.
    Runs as a background task — failures are non-critical.
    """
    from app.services.unicommerce_optimized import get_unicommerce_service
    service = get_unicommerce_service()

    tasks = [
        ("today sales",     service.get_today_sales()),
        ("yesterday sales", service.get_yesterday_sales()),
        ("inventory",       service.fetch_inventory_via_export()),
    ]

    for label, coro in tasks:
        try:
            await coro
            logger.info(f"Cache preload: {label} ✓")
        except Exception as e:
            logger.warning(f"Cache preload: {label} failed (non-critical): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Starting Anthrilo Management System API…")
    # Fire-and-forget cache preload so startup isn't blocked
    asyncio.create_task(_preload_caches())
    yield
    logger.info("Shutting down Anthrilo Management System API…")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    version="3.0.0",
    description="Enterprise ERP system for textile manufacturing and garment production management",
    lifespan=lifespan,
)

# GZip compression for responses > 500 bytes (reduces payload size ~60-80%)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {
        "message": "Anthrilo Management System API",
        "version": "3.0.0",
        "features": [
            "GZip Compression",
            "Redis Caching",
            "Export Job API (Sales + Inventory)",
            "WebSocket Live Feed",
            "Startup Cache Preload",
        ],
        "docs": f"{settings.API_V1_STR}/docs",
        "websocket": f"ws://localhost:8000{settings.API_V1_STR}/integrations/ws/sales",
    }


@app.get("/health")
async def health_check():
    redis_ok = False
    try:
        if redis_client:
            redis_client.ping()
            redis_ok = True
    except Exception:
        pass

    return {
        "status": "healthy",
        "version": "3.0.0",
        "environment": settings.ENVIRONMENT,
        "redis": "connected" if redis_ok else "disconnected",
    }
