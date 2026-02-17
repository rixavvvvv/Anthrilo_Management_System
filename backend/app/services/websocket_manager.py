"""
Centralized WebSocket Manager for real-time updates across the application.
Supports multiple event types: sales, inventory, orders, production.
"""
from typing import Dict, List, Set
from fastapi import WebSocket
import logging
import json

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts for different event types."""

    def __init__(self):
        # Store connections by event type for targeted broadcasting
        self.connections: Dict[str, Set[WebSocket]] = {
            "sales": set(),
            "inventory": set(),
            "orders": set(),
            "production": set(),
            "all": set(),  # Subscribed to all events
        }

    async def connect(self, websocket: WebSocket, event_type: str = "all"):
        """Accept a WebSocket connection and add to appropriate event group."""
        await websocket.accept()
        if event_type not in self.connections:
            self.connections[event_type] = set()
        self.connections[event_type].add(websocket)
        logger.info(f"WebSocket connected to '{event_type}' events. Total: {len(self.connections[event_type])}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from all event groups."""
        for event_type, connections in self.connections.items():
            if websocket in connections:
                connections.discard(websocket)
                logger.info(f"WebSocket disconnected from '{event_type}'. Remaining: {len(connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast(self, event_type: str, message: dict):
        """
        Broadcast a message to all clients subscribed to the event type.
        Also broadcasts to clients subscribed to 'all' events.
        """
        targets = self.connections.get(event_type, set()) | self.connections.get("all", set())
        disconnected = []

        for connection in targets:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

        logger.info(f"Broadcasted '{event_type}' event to {len(targets) - len(disconnected)} clients")

    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            event_type: len(connections)
            for event_type, connections in self.connections.items()
        }


# Global WebSocket managers for different event types
ws_manager = ConnectionManager()


# Helper functions for broadcasting common events

async def broadcast_inventory_update(data: dict):
    """Broadcast inventory changes to subscribed clients."""
    await ws_manager.broadcast("inventory", {
        "type": "inventory_update",
        "data": data,
        "timestamp": str(data.get("timestamp", ""))
    })


async def broadcast_order_update(data: dict):
    """Broadcast order status changes to subscribed clients."""
    await ws_manager.broadcast("orders", {
        "type": "order_update",
        "data": data,
        "timestamp": str(data.get("timestamp", ""))
    })


async def broadcast_production_update(data: dict):
    """Broadcast production plan changes to subscribed clients."""
    await ws_manager.broadcast("production", {
        "type": "production_update",
        "data": data,
        "timestamp": str(data.get("timestamp", ""))
    })


async def broadcast_sales_update(data: dict):
    """Broadcast sales changes to subscribed clients."""
    await ws_manager.broadcast("sales", {
        "type": "sales_update",
        "data": data,
        "timestamp": str(data.get("timestamp", ""))
    })
