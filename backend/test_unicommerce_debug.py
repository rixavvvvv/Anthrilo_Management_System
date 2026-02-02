"""Debug Unicommerce API response structure"""
import asyncio
from app.services.unicommerce import UnicommerceService


async def test():
    service = UnicommerceService()
    result = await service.get_last_24_hours_sales()
    
    print("=" * 60)
    print("📊 Unicommerce API Response Debug")
    print("=" * 60)
    print(f"Success: {result.get('success')}")
    print(f"Total Orders: {result.get('summary', {}).get('total_orders')}")
    print(f"Total Revenue: {result.get('summary', {}).get('total_revenue')}")
    
    orders = result.get('orders', [])
    print(f"\n📦 Sample Order Count: {len(orders)}")
    
    if orders:
        first_order = orders[0]
        print(f"\n🔑 First Order Keys:")
        print(list(first_order.keys()))
        
        print(f"\n💰 Revenue-related fields in first order:")
        print(f"  total: {first_order.get('total')}")
        print(f"  orderAmount: {first_order.get('orderAmount')}")
        print(f"  totalAmount: {first_order.get('totalAmount')}")
        print(f"  totalPrice: {first_order.get('totalPrice')}")
        print(f"  grandTotal: {first_order.get('grandTotal')}")
        print(f"  netAmount: {first_order.get('netAmount')}")
        
        print(f"\n📄 Full First Order:")
        for key, value in first_order.items():
            print(f"  {key}: {value}")
    else:
        print("❌ No orders returned!")
        print(f"\nFull result: {result}")
    
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test())
