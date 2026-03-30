from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.api.v1.endpoints import integrations


class _FakeDailySalesService:
    async def get_custom_range_sales(self, from_dt: datetime, to_dt: datetime):
        return {
            "success": True,
            "summary": {
                "channel_breakdown": {
                    "SHOPIFY": {"items": 2, "revenue": 500.0, "orders": 1},
                },
                "valid_orders": 1,
                "total_orders": 1,
                "total_items": 2,
            },
            "_orders": [
                {
                    "status": "SHIPPED",
                    "channel": "SHOPIFY",
                    "created": "2024-01-10T10:00:00+00:00",
                    "saleOrderItems": [
                        {
                            "itemSku": "SKU-1",
                            "code": "SOI-1",
                            "itemTypeName": "Test Item",
                            "size": "M",
                            "sellingPrice": 250.0,
                        },
                        {
                            "itemSku": "SKU-2",
                            "code": "SOI-2",
                            "itemTypeName": "Test Item 2",
                            "size": "L",
                            "sellingPrice": 250.0,
                        },
                    ],
                }
            ],
        }

    async def get_inventory_snapshot(self, skus):
        return {sku: {"good_inventory": 10, "virtual_inventory": 2} for sku in skus}


class _FakeReturnService:
    async def fetch_returns_via_export(self, from_dt: datetime, to_dt: datetime):
        return {
            "successful": True,
            "total_time": 1.2,
            "items": [
                {
                    "saleOrderCode": "SO-1",
                    "invoiceCode": "INV-1",
                    "returnType": "RTO",
                    "channel": "SHOPIFY",
                    "sku": "SKU-R1",
                    "itemName": "Return Item",
                    "quantity": 1,
                    "unitPrice": 199.0,
                },
                {
                    "saleOrderCode": "SO-2",
                    "invoiceCode": "INV-2",
                    "returnType": "CIR",
                    "channel": "MYNTRA",
                    "sku": "SKU-R2",
                    "itemName": "Return Item 2",
                    "quantity": 2,
                    "unitPrice": 150.0,
                },
            ],
        }


class _FakeChunkedCancellationService:
    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    async def fetch_all_orders_with_revenue(self, from_dt: datetime, to_dt: datetime):
        self.calls.append((from_dt.date().isoformat(), to_dt.date().isoformat()))
        idx = len(self.calls)

        return {
            "successful": True,
            "total_time": 0.7,
            "orders": [
                {
                    "status": "CANCELLED",
                    "channel": "SHOPIFY",
                    "code": f"CAN-{idx}",
                    "created": "2025-01-10T10:00:00+00:00",
                    "cod": True,
                    "saleOrderItems": [
                        {
                            "itemSku": f"SKU-C-{idx}",
                            "itemTypeName": "Cancelled Item",
                            "code": f"SOI-C-{idx}",
                            "quantity": 1,
                            "sellingPrice": 100.0,
                        }
                    ],
                },
                {
                    "status": "SHIPPED",
                    "channel": "SHOPIFY",
                    "code": f"OK-{idx}",
                    "created": "2025-01-11T10:00:00+00:00",
                    "cod": False,
                    "saleOrderItems": [
                        {
                            "itemSku": f"SKU-O-{idx}",
                            "itemTypeName": "Regular Item",
                            "code": f"SOI-O-{idx}",
                            "quantity": 1,
                            "sellingPrice": 100.0,
                        }
                    ],
                },
            ],
        }


class _FakeChunkFailCancellationService(_FakeChunkedCancellationService):
    async def fetch_all_orders_with_revenue(self, from_dt: datetime, to_dt: datetime):
        self.calls.append((from_dt.date().isoformat(), to_dt.date().isoformat()))
        if len(self.calls) == 2:
            return {"successful": False, "error": "Export job creation failed"}
        return {
            "successful": True,
            "total_time": 0.3,
            "orders": [],
        }


@pytest.mark.asyncio
async def test_daily_sales_report_returns_channel_and_item_totals(monkeypatch):
    fake = _FakeDailySalesService()
    monkeypatch.setattr(integrations, "get_unicommerce_service", lambda: fake)
    monkeypatch.setattr(integrations.CacheService, "get", staticmethod(lambda _key: None))
    monkeypatch.setattr(integrations.CacheService, "set", staticmethod(lambda _key, _value, _ttl: None))

    result = await integrations.get_daily_sales_report(date="2024-01-10", from_date=None, to_date=None)

    assert result["success"] is True
    assert result["totals"]["total_channels"] == 1
    assert result["totals"]["total_quantity"] == 2
    assert result["totals"]["total_revenue"] == 500.0
    assert len(result["items"]) == 2


@pytest.mark.asyncio
async def test_return_report_aggregates_rto_and_cir(monkeypatch):
    fake = _FakeReturnService()
    monkeypatch.setattr(integrations, "get_unicommerce_service", lambda: fake)

    result = await integrations.get_return_report(
        date="2024-02-01",
        from_date=None,
        to_date=None,
        period="daily",
        return_type="ALL",
    )

    assert result["success"] is True
    assert result["totals"]["total_returns"] == 2
    assert result["totals"]["rto_count"] == 1
    assert result["totals"]["cir_count"] == 1
    assert result["totals"]["total_value"] == 499.0


@pytest.mark.asyncio
async def test_cancellation_report_splits_custom_range_into_three_month_chunks(monkeypatch):
    fake = _FakeChunkedCancellationService()
    monkeypatch.setattr(integrations, "get_unicommerce_service", lambda: fake)

    result = await integrations.get_cancellation_report(
        date=None,
        from_date="2025-01-01",
        to_date="2025-08-15",
        period="custom",
    )

    assert result["success"] is True
    assert result["search_results"]["chunk_count"] == 3
    assert result["search_results"]["method"] == "export_job_sale_orders_chunked"
    assert result["totals"]["total_orders"] == 6
    assert result["totals"]["total_cancellations"] == 3
    assert result["totals"]["cancellation_rate"] == 50.0

    assert fake.calls == [
        ("2025-01-01", "2025-03-31"),
        ("2025-04-01", "2025-06-30"),
        ("2025-07-01", "2025-08-15"),
    ]


@pytest.mark.asyncio
async def test_cancellation_report_returns_failed_chunk_details(monkeypatch):
    fake = _FakeChunkFailCancellationService()
    monkeypatch.setattr(integrations, "get_unicommerce_service", lambda: fake)

    result = await integrations.get_cancellation_report(
        date=None,
        from_date="2025-01-01",
        to_date="2025-08-15",
        period="custom",
    )

    assert result["success"] is False
    assert result["error"] == "Export job creation failed"
    assert result["failed_chunk"] == {"from_date": "2025-04-01", "to_date": "2025-06-30"}
    assert result["chunk_count"] == 3
