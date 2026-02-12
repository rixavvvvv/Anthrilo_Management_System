"""
Webhook system for real-time event processing.
Stores subscriptions in-memory (upgrade to DB for production).
Receives events from Unicommerce or internal triggers and fans out to subscribers.
"""

import asyncio
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()

# ── In-memory stores (swap for DB tables in production) ──────────────
_subscriptions: dict[str, dict] = {}
_event_history: list[dict] = []
MAX_HISTORY = 500

# ── Supported event types ────────────────────────────────────────────
EVENT_TYPES = [
    "order.created",
    "order.status_changed",
    "order.cancelled",
    "order.shipped",
    "order.delivered",
    "order.returned",
    "inventory.updated",
    "inventory.low_stock",
    "shipment.dispatched",
    "shipment.tracking_update",
    "shipment.delivered",
    "invoice.created",
    "return.created",
    "return.completed",
    "grn.created",
    "purchase_order.created",
    "purchase_order.approved",
    "gatepass.completed",
    "facility.updated",
    "catalog.item_updated",
]


# ── Schemas ──────────────────────────────────────────────────────────
class WebhookSubscription(BaseModel):
    event_type: str
    callback_url: str
    secret: Optional[str] = None


class WebhookEvent(BaseModel):
    event_type: str
    payload: dict = Field(default_factory=dict)


# ── CRUD Endpoints ───────────────────────────────────────────────────

@router.get("")
async def list_subscriptions():
    """List all webhook subscriptions."""
    return {"subscriptions": list(_subscriptions.values()), "count": len(_subscriptions)}


@router.get("/events")
async def list_event_types():
    """List all supported webhook event types."""
    return {"event_types": EVENT_TYPES}


@router.post("/subscribe")
async def subscribe(sub: WebhookSubscription):
    """Subscribe a callback URL to an event type."""
    if sub.event_type not in EVENT_TYPES:
        raise HTTPException(400, f"Unknown event type: {sub.event_type}. Valid: {EVENT_TYPES}")
    sub_id = str(uuid.uuid4())
    _subscriptions[sub_id] = {
        "id": sub_id,
        "event_type": sub.event_type,
        "callback_url": sub.callback_url,
        "secret": sub.secret,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
        "delivery_count": 0,
        "failure_count": 0,
    }
    return {"id": sub_id, "status": "subscribed", "event_type": sub.event_type}


@router.delete("/{sub_id}")
async def unsubscribe(sub_id: str):
    """Remove a webhook subscription."""
    if sub_id not in _subscriptions:
        raise HTTPException(404, "Subscription not found")
    del _subscriptions[sub_id]
    return {"status": "unsubscribed", "id": sub_id}


@router.get("/history")
async def get_history(event_type: str | None = None, limit: int = 50):
    """Get recent webhook delivery history."""
    history = _event_history
    if event_type:
        history = [h for h in history if h["event_type"] == event_type]
    return {"history": history[-limit:], "total": len(history)}


@router.post("/{sub_id}/test")
async def test_webhook(sub_id: str):
    """Send a test event to a subscription."""
    if sub_id not in _subscriptions:
        raise HTTPException(404, "Subscription not found")
    sub = _subscriptions[sub_id]
    test_payload = {
        "event_type": sub["event_type"],
        "test": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {"message": "This is a test webhook event from Anthrilo Management System"},
    }
    result = await _deliver(sub, test_payload)
    return {"status": "sent", "delivery": result}


# ── Internal: Publish an event (called by other services) ────────────

async def publish_event(event_type: str, payload: dict[str, Any]):
    """Publish an event to all matching subscribers. Call from any service."""
    event_record = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "deliveries": [],
    }
    matching = [s for s in _subscriptions.values() if s["event_type"] == event_type and s["active"]]
    tasks = [_deliver(sub, {"event_type": event_type, "timestamp": event_record["timestamp"], "data": payload}) for sub in matching]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for sub, result in zip(matching, results):
        event_record["deliveries"].append({
            "subscription_id": sub["id"],
            "callback_url": sub["callback_url"],
            "success": not isinstance(result, Exception) and result.get("success", False),
        })
    _event_history.append(event_record)
    if len(_event_history) > MAX_HISTORY:
        _event_history.pop(0)
    return event_record


async def _deliver(sub: dict, body: dict) -> dict:
    """Deliver a webhook event to a subscriber via HTTP POST."""
    headers = {"Content-Type": "application/json", "X-Webhook-Event": body.get("event_type", "")}
    if sub.get("secret"):
        signature = hmac.new(sub["secret"].encode(), json.dumps(body).encode(), hashlib.sha256).hexdigest()
        headers["X-Webhook-Signature"] = signature
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(sub["callback_url"], json=body, headers=headers)
        sub["delivery_count"] = sub.get("delivery_count", 0) + 1
        success = 200 <= resp.status_code < 300
        if not success:
            sub["failure_count"] = sub.get("failure_count", 0) + 1
        return {"success": success, "status_code": resp.status_code}
    except Exception as e:
        sub["failure_count"] = sub.get("failure_count", 0) + 1
        return {"success": False, "error": str(e)}


# ── Incoming webhook receiver (from Unicommerce push) ────────────────

@router.post("/incoming")
async def receive_incoming_webhook(request: Request):
    """
    Receive incoming webhooks from Unicommerce or other external services.
    Processes and re-publishes as internal events.
    """
    body = await request.json()
    event_type = _map_external_event(body)
    if event_type:
        await publish_event(event_type, body)
    return {"status": "received", "mapped_event": event_type}


def _map_external_event(body: dict) -> str | None:
    """Map an external webhook payload to an internal event type."""
    # Unicommerce event mapping
    uc_type = body.get("type", body.get("eventType", ""))
    mapping = {
        "SALE_ORDER_CREATED": "order.created",
        "SALE_ORDER_STATUS_CHANGE": "order.status_changed",
        "SALE_ORDER_CANCELLED": "order.cancelled",
        "SHIPMENT_DISPATCHED": "shipment.dispatched",
        "SHIPMENT_DELIVERED": "shipment.delivered",
        "TRACKING_UPDATE": "shipment.tracking_update",
        "INVENTORY_UPDATE": "inventory.updated",
        "RETURN_CREATED": "return.created",
        "RETURN_COMPLETED": "return.completed",
        "INVOICE_GENERATED": "invoice.created",
    }
    return mapping.get(uc_type)
