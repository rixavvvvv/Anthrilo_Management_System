import asyncio
from datetime import datetime, timedelta, timezone
import httpx
from app.core.token_manager import get_token_manager

BASE_COLUMNS = ["saleOrderCode", "skuCode", "channelProductId"]
CANDIDATES = [
    "bundleSkuCodeNumber","bundleSkuCode","bundleCode","bundleSku",
    "bundleSkuNumber","parentSkuCode","parentItemSku","bundleItemSku"
]

async def test():
    tm = get_token_manager()
    headers = await tm.get_headers()
    headers["Facility"] = "anthrilo"
    base = f"https://{tm.tenant}.unicommerce.com/services/rest/v1"
    now = datetime.now(timezone.utc)
    frm = now - timedelta(hours=1)
    start_ms = int(frm.timestamp() * 1000)
    end_ms = int(now.timestamp() * 1000)

    async with httpx.AsyncClient(timeout=60.0) as c:
        for cand in CANDIDATES:
            payload = {
                "exportJobTypeName": "Sale Orders",
                "frequency": "ONETIME",
                "exportColums": BASE_COLUMNS + [cand],
                "exportFilters": [{"id": "addedOn", "dateRange": {"start": start_ms, "end": end_ms}}],
            }
            r = await c.post(f"{base}/export/job/create", json=payload, headers=headers)
            try:
                data = r.json()
            except Exception:
                print(f"{cand}: status={r.status_code} NON_JSON body={(r.text or '')[:200]}")
                continue
            print(f"{cand}: status={r.status_code} successful={data.get('successful')} errors={data.get('errors')}")

asyncio.run(test())
