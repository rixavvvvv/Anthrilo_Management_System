from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.redis import redis_client
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    version="2.0.0",
    description="Enterprise ERP system for textile manufacturing and garment production management"
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
        "version": "2.0.0",
        "features": ["Redis Caching", "WebSocket Live Feed", "Two-Phase Fetch"],
        "docs": f"{settings.API_V1_STR}/docs",
        "websocket_path": f"{settings.API_V1_STR}/integrations/ws/sales"
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
        "environment": settings.ENVIRONMENT,
        "redis": "connected" if redis_ok else "disconnected",
    }
