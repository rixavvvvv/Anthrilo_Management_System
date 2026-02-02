"""Test Unicommerce API integration"""
import asyncio
from app.services.unicommerce import UnicommerceService


async def test_unicommerce():
    print("=" * 60)
    print("🔌 Testing Unicommerce API Connection")
    print("=" * 60)

    service = UnicommerceService()

    print(f"\n📊 Configuration:")
    print(f"   Base URL: {service.base_url}")
    print(f"   Access Code: {service.access_code[:30]}...")
    print(f"   Timeout: {service.timeout}")

    print(f"\n🔄 Fetching last 24 hours sales...")
    result = await service.get_last_24_hours_sales()

    print(f"\n📋 Response:")
    print(f"   Success: {result.get('success')}")
    print(f"   Period: {result.get('period')}")

    if result.get('success'):
        summary = result.get('summary', {})
        print(f"\n✅ Sales Summary:")
        print(f"   Total Orders: {summary.get('total_orders')}")
        print(f"   Total Revenue: ₹{summary.get('total_revenue')}")
        print(f"   Currency: {summary.get('currency')}")

        orders = result.get('orders', [])
        if orders:
            print(f"\n📦 Sample Orders (first 3):")
            for i, order in enumerate(orders[:3], 1):
                print(
                    f"   {i}. Order #{order.get('code')} - ₹{order.get('total')}")
    else:
        print(f"\n❌ Error:")
        print(f"   Message: {result.get('message')}")
        if 'error_details' in result:
            print(f"   Details: {result.get('error_details')}")
        if 'response_text' in result:
            print(f"   Response: {result.get('response_text')[:200]}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(test_unicommerce())
