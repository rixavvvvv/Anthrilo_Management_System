"""
Test script to check Unicommerce orders with different date ranges
"""
from app.services.unicommerce import UnicommerceService
import asyncio
import sys
from datetime import datetime, timedelta
sys.path.insert(0, 'E:/Git/Anthrilo_Management_System/backend')


async def test_orders():
    service = UnicommerceService()

    print("=" * 60)
    print("Testing Unicommerce API - Different Date Ranges")
    print("=" * 60)

    # Test 1: Last 7 days
    print("\n📅 Test 1: Last 7 days")
    result = await service.search_sale_orders(
        from_date=datetime.utcnow() - timedelta(days=7),
        to_date=datetime.utcnow(),
        display_length=50
    )
    print(f"   Full Result: {result}")
    orders = result.get('saleOrderDTOs', [])
    print(f"   Success: {result.get('success', False)}")
    print(f"   Total Orders: {len(orders)}")
    if orders:
        print(f"   First Order Date: {orders[0].get('created', 'N/A')}")

    # Test 2: Last 30 days
    print("\n📅 Test 2: Last 30 days")
    result = await service.search_sale_orders(
        from_date=datetime.utcnow() - timedelta(days=30),
        to_date=datetime.utcnow(),
        display_length=50
    )
    orders = result.get('saleOrderDTOs', [])
    print(f"   Success: {result.get('success', False)}")
    print(f"   Total Orders: {len(orders)}")
    if orders:
        print(f"   First Order Date: {orders[0].get('created', 'N/A')}")
        print(f"   Latest Order Date: {orders[-1].get('created', 'N/A')}")

    # Test 3: Last 90 days
    print("\n📅 Test 3: Last 90 days")
    result = await service.search_sale_orders(
        from_date=datetime.utcnow() - timedelta(days=90),
        to_date=datetime.utcnow(),
        display_length=100
    )
    orders = result.get('saleOrderDTOs', [])
    print(f"   Success: {result.get('success', False)}")
    print(f"   Total Orders: {len(orders)}")
    if orders:
        print(f"   First Order Date: {orders[0].get('created', 'N/A')}")
        print(f"   Latest Order Date: {orders[-1].get('created', 'N/A')}")
        print(f"\n   Sample Order Details:")
        print(f"   - Order Code: {orders[0].get('code', 'N/A')}")
        print(f"   - Channel: {orders[0].get('channel', 'N/A')}")
        print(f"   - Status: {orders[0].get('status', 'N/A')}")
        print(f"   - Total: {orders[0].get('total', 0)}")

    print("\n" + "=" * 60)
    if not any([len(result.get('saleOrderDTOs', [])) for result in [result]]):
        print("⚠️  No orders found in any date range")
        print("   Possible reasons:")
        print("   1. This is a test/staging Unicommerce tenant with no data")
        print("   2. Orders exist but with different status filters")
        print("   3. Facility code or additional filters may be needed")
    else:
        print("✅ Orders found! API is working correctly.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_orders())
