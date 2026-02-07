"""
Test configuration and fixtures for Unicommerce integration tests.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta


@pytest.fixture
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    with patch("app.core.config.settings") as mock:
        mock.UNICOMMERCE_TENANT = "test-tenant"
        mock.UNICOMMERCE_ACCESS_CODE = "test-access-code"
        mock.UNICOMMERCE_USERNAME = "test-user"
        mock.UNICOMMERCE_PASSWORD = "test-pass"
        mock.UNICOMMERCE_ACCESS_TOKEN = ""
        mock.UNICOMMERCE_REFRESH_TOKEN = ""
        mock.UNICOMMERCE_BASE_URL = "https://test-tenant.unicommerce.com/services/rest/v1"
        mock.DATABASE_URL = "sqlite:///test.db"
        mock.REDIS_URL = "redis://localhost:6379/0"
        yield mock


@pytest.fixture
def sample_search_response():
    """Sample response from saleOrder/search API."""
    return {
        "successful": True,
        "elements": [
            {"code": "SO-001", "status": "COMPLETE", "channel": "AMAZON", "created": "2024-01-01T10:00:00"},
            {"code": "SO-002", "status": "PROCESSING", "channel": "FLIPKART", "created": "2024-01-01T11:00:00"},
            {"code": "SO-003", "status": "CANCELLED", "channel": "MYNTRA", "created": "2024-01-01T12:00:00"},
        ],
        "totalRecords": 3,
    }


@pytest.fixture
def sample_order_detail():
    """Sample response from saleorder/get API with sellingPrice."""
    return {
        "successful": True,
        "saleOrderDTO": {
            "code": "SO-001",
            "status": "COMPLETE",
            "channel": "AMAZON",
            "created": "2024-01-01T10:00:00",
            "displayOrderDateTime": "2024-01-01T10:00:00",
            "saleOrderItems": [
                {
                    "sellingPrice": 1500.00,
                    "quantity": 1,
                    "discount": 100.00,
                    "taxAmount": 270.00,
                    "refundAmount": 0.0,
                },
                {
                    "sellingPrice": 800.00,
                    "quantity": 2,
                    "discount": 50.00,
                    "taxAmount": 144.00,
                    "refundAmount": 0.0,
                },
            ],
        },
    }


@pytest.fixture
def sample_cancelled_order():
    """Sample cancelled order (should be excluded from revenue)."""
    return {
        "code": "SO-003",
        "status": "CANCELLED",
        "channel": "MYNTRA",
        "created": "2024-01-01T12:00:00",
        "saleOrderItems": [
            {
                "sellingPrice": 2000.00,
                "quantity": 1,
                "discount": 0.0,
                "taxAmount": 360.00,
                "refundAmount": 0.0,
            },
        ],
    }


@pytest.fixture
def sample_orders_list():
    """List of sample orders for aggregation testing."""
    return [
        {
            "code": "SO-001",
            "status": "COMPLETE",
            "channel": "AMAZON",
            "created": "2024-01-01T10:00:00",
            "saleOrderItems": [
                {"sellingPrice": 1500.00, "quantity": 1, "discount": 100.0, "taxAmount": 270.0, "refundAmount": 0.0},
            ],
        },
        {
            "code": "SO-002",
            "status": "PROCESSING",
            "channel": "FLIPKART",
            "created": "2024-01-01T11:00:00",
            "saleOrderItems": [
                {"sellingPrice": 800.00, "quantity": 2, "discount": 50.0, "taxAmount": 144.0, "refundAmount": 0.0},
            ],
        },
        {
            "code": "SO-003",
            "status": "CANCELLED",
            "channel": "MYNTRA",
            "created": "2024-01-01T12:00:00",
            "saleOrderItems": [
                {"sellingPrice": 2000.00, "quantity": 1, "discount": 0.0, "taxAmount": 360.0, "refundAmount": 0.0},
            ],
        },
        {
            "code": "SO-004",
            "status": "COMPLETE",
            "channel": "AMAZON",
            "created": "2024-01-01T13:00:00",
            "saleOrderItems": [
                {"sellingPrice": 500.00, "quantity": 3, "discount": 25.0, "taxAmount": 90.0, "refundAmount": 100.0},
            ],
        },
    ]
