"""
Verify cancellation data accuracy and today's sales.
Runs inside the backend Docker container.
"""
import asyncio
import sys
sys.path.insert(0, '/app')

from app.services.unicommerce import UnicommerceService
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

async def verify():
    service = UnicommerceService()

    # ── Part 1: Verify today's sales (Mar 11 2026) ──
    print("=" * 60)
    print("PART 1: TODAY'S SALES (Mar 11, 2026)")
    print("=" * 60)
    now_ist = datetime.now(IST)
    today_start = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now_ist - timedelta(minutes=1)
    from_utc = today_start.astimezone(timezone.utc)
    to_utc = today_end.astimezone(timezone.utc)
    print(f"  IST range: {today_start.strftime('%Y-%m-%d %H:%M')} to {today_end.strftime('%Y-%m-%d %H:%M')}")
    print(f"  UTC range: {from_utc.isoformat()} to {to_utc.isoformat()}")

    today_result = await service.fetch_orders_via_export(from_utc, to_utc)
    if today_result.get("successful"):
        today_orders = today_result.get("orders", [])
        today_rev = 0.0
        today_valid = 0
        today_cancelled = 0
        for o in today_orders:
            calc = service.calculate_order_revenue(o)
            if calc["include_in_revenue"]:
                today_rev += calc["net_revenue"]
                today_valid += 1
            else:
                today_cancelled += 1
        print(f"  Total orders: {len(today_orders)}")
        print(f"  Valid orders: {today_valid}")
        print(f"  Cancelled: {today_cancelled}")
        print(f"  Revenue: INR {today_rev:,.2f}")
    else:
        print(f"  FAILED: {today_result.get('error')}")

    # ── Part 2: Fetch a small sample of CANCELLED orders to verify they're real ──
    print("\n" + "=" * 60)
    print("PART 2: SAMPLE CANCELLED ORDERS (verify authenticity)")
    print("=" * 60)
    # Fetch just 1 day that should have cancellations
    sample_from = datetime(2025, 12, 1, 0, 0, 0, tzinfo=timezone.utc)
    sample_to = datetime(2025, 12, 1, 23, 59, 59, tzinfo=timezone.utc)
    sample_result = await service.fetch_orders_via_export(sample_from, sample_to)
    if sample_result.get("successful"):
        sample_orders = sample_result.get("orders", [])
        cancelled_samples = [o for o in sample_orders if (o.get("status") or "").upper() == "CANCELLED"]
        print(f"  Dec 1 2025: {len(sample_orders)} total, {len(cancelled_samples)} cancelled")
        print(f"  Sample cancelled orders:")
        for o in cancelled_samples[:10]:
            calc = service.calculate_order_revenue(o)
            items = o.get("saleOrderItems", [])
            skus = [i.get("itemSku", "") for i in items[:3]]
            print(f"    {o.get('code')} | Channel={o.get('channel')} | Status={o.get('status')} | "
                  f"Items={len(items)} | SellingPrice=INR {calc['selling_price']:,.2f} | SKUs={skus}")
    else:
        print(f"  FAILED: {sample_result.get('error')}")

    # ── Part 3: Full period with individual chunk tracking ──
    print("\n" + "=" * 60)
    print("PART 3: FULL PERIOD Sep 2025 - Mar 11 2026 (chunk-by-chunk)")
    print("=" * 60)
    full_from = datetime(2025, 9, 1, 0, 0, 0, tzinfo=timezone.utc)
    full_to = datetime(2026, 3, 11, 23, 59, 59, tzinfo=timezone.utc)

    chunks = service._split_date_range(full_from, full_to)
    print(f"  Total chunks: {len(chunks)}")

    all_orders = []
    failed_chunks_info = []

    for idx, (c_from, c_to) in enumerate(chunks):
        label = f"Chunk {idx+1}/{len(chunks)}: {c_from.strftime('%Y-%m-%d')} -> {c_to.strftime('%Y-%m-%d')}"
        try:
            result = await service.fetch_orders_via_export(c_from, c_to)
            if result.get("successful"):
                chunk_orders = result.get("orders", [])
                all_orders.extend(chunk_orders)
                print(f"  OK  {label} -> {len(chunk_orders)} orders")
            else:
                err = result.get("error", "unknown")
                failed_chunks_info.append({"chunk": idx+1, "label": label, "error": err})
                print(f"  FAIL {label} -> {err}")
        except Exception as e:
            failed_chunks_info.append({"chunk": idx+1, "label": label, "error": str(e)})
            print(f"  FAIL {label} -> {e}")

        # Small delay between chunks
        if idx < len(chunks) - 1:
            await asyncio.sleep(1)

    print(f"\n  Total orders fetched: {len(all_orders)}")
    print(f"  Failed chunks: {len(failed_chunks_info)}")
    for fc in failed_chunks_info:
        print(f"    Chunk {fc['chunk']}: {fc['label']} - {fc['error']}")

    # ── Part 4: Complete status + revenue breakdown ──
    print("\n" + "=" * 60)
    print("PART 4: STATUS & REVENUE BREAKDOWN")
    print("=" * 60)
    status_data = {}
    for order in all_orders:
        status = (order.get("status") or "").upper()
        calc = service.calculate_order_revenue(order)
        if status not in status_data:
            status_data[status] = {"count": 0, "selling_price": 0.0, "items": 0, "sample_codes": []}
        status_data[status]["count"] += 1
        status_data[status]["selling_price"] += calc["selling_price"]
        status_data[status]["items"] += calc["item_count"]
        if len(status_data[status]["sample_codes"]) < 3:
            status_data[status]["sample_codes"].append(order.get("code", "?"))

    grand_total = 0.0
    included_total = 0.0
    excluded_total = 0.0
    included_orders = 0
    excluded_orders = 0

    for status in sorted(status_data.keys()):
        d = status_data[status]
        grand_total += d["selling_price"]
        is_excluded = status in service.EXCLUDED_STATUSES
        if is_excluded:
            excluded_total += d["selling_price"]
            excluded_orders += d["count"]
        else:
            included_total += d["selling_price"]
            included_orders += d["count"]
        marker = "EXCLUDED" if is_excluded else "INCLUDED"
        print(f"  {status:25s} | {d['count']:>7,} orders | {d['items']:>8,} items | "
              f"INR {d['selling_price']:>14,.2f} | [{marker}]")
        print(f"    Sample: {d['sample_codes']}")

    print(f"\n  {'─'*70}")
    print(f"  GRAND TOTAL (all):     {len(all_orders):>7,} orders | INR {grand_total:>14,.2f}")
    print(f"  INCLUDED (revenue):    {included_orders:>7,} orders | INR {included_total:>14,.2f}")
    print(f"  EXCLUDED (cancelled):  {excluded_orders:>7,} orders | INR {excluded_total:>14,.2f}")
    print(f"\n  UC Dashboard shows:    INR 13,09,39,211")
    print(f"  Our website shows:     INR {included_total:>14,.2f}")
    print(f"  Cancelled amount:      INR {excluded_total:>14,.2f}")
    print(f"  Our + Cancelled:       INR {included_total + excluded_total:>14,.2f}")

    if failed_chunks_info:
        print(f"\n  WARNING: {len(failed_chunks_info)} chunks failed - data is INCOMPLETE")
        print(f"  Missing data will account for the gap between our+cancelled and UC total")
    else:
        print(f"\n  ALL CHUNKS SUCCEEDED - data is COMPLETE")

asyncio.run(verify())
