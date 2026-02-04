import asyncio
from datetime import datetime, timedelta
from app.services.unicommerce import UnicommerceService

async def main():
    s = UnicommerceService()
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(hours=24)
    res = await s.fetch_all_sale_orders(from_date=from_date, to_date=to_date, max_orders=1, page_size=1)
    elem = res.get("elements", [{}])[0]
    print(list(elem.keys()))
    print(elem)
    code = elem.get("code")
    if code:
        details = await s.get_order_details(code)
        print("DETAILS SUCCESS:", details.get("successful"))
        print("DETAILS KEYS:", list((details.get("order") or {}).keys()))
        print("DETAILS ORDER:", details.get("order"))

asyncio.run(main())
