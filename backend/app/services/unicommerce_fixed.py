# Fixed versions of the three methods - will be copied back
# This is just a helper file to prepare clean code

async def get_last_24_hours_sales_FIXED(self) -> Dict[str, Any]:
    """Get sales from last 24 hours with REAL parallel data fetching"""
    if not self.access_code or self.access_code == "":
        return {
            "success": False,
            "message": "Unicommerce access code not configured",
            "summary": {"total_orders": 0, "total_revenue": 0, "currency": "INR"}
        }

    try:
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(hours=24)

        # Use proper pagination to get ALL orders
        result = await self.fetch_all_sale_orders(
            from_date=from_date,
            to_date=to_date,
            max_orders=2000,
            page_size=100
        )

        if not result.get("successful", False):
            return {
                "success": False,
                "message": "Failed to fetch from Unicommerce",
                "period": "last_24_hours",
                "from_date": from_date.isoformat(),
                "to_date": to_date.isoformat(),
                "summary": {"total_orders": 0, "total_revenue": 0, "currency": "INR"},
                "orders": []
            }

        sale_orders = result.get("elements", [])
        total_orders = result.get("totalRecords", len(sale_orders))
        
        basic_processed_orders = []
        valid_basic_orders = []
        
        for order in sale_orders:
            financials = self.extract_order_financials(order)
            basic_processed_orders.append({
                "code": financials["order_code"],
                "status": financials["status"],
                "channel": financials["channel"],
                "gross_sales": financials["gross_sales"],
                "net_sales": financials["net_sales"],
                "discount": financials["discount"],
                "tax_amount": financials["tax_amount"]
            })
            
            if financials["include_in_revenue"]:
                valid_basic_orders.append(order)
        
        valid_orders_count = len(valid_basic_orders)
        
        # Parallel data fetching for real revenue
        sample_size = min(100, valid_orders_count)
        sample_orders = valid_basic_orders[:sample_size] if sample_size > 0 else []
        
        total_gross_sales = 0.0
        total_net_sales = 0.0
        total_discount = 0.0
        total_tax = 0.0
        channel_breakdown = {}
        
        if sample_orders:
            semaphore = asyncio.Semaphore(20)
            
            async def fetch_order_detail_safe(order):
                async with semaphore:
                    order_code = order.get("code", "")
                    try:
                        details = await self.get_order_details(order_code)
                        if details and details.get("successful"):
                            return details.get("order", {})
                    except Exception as e:
                        print(f"Error fetching {order_code}: {e}")
                    return None
            
            async with httpx.AsyncClient(timeout=self.timeout, limits=self.limits) as client:
                tasks = [fetch_order_detail_safe(order) for order in sample_orders]
                detailed_orders = await asyncio.gather(*tasks, return_exceptions=True)
                
                successful_count = 0
                for idx, detailed_order in enumerate(detailed_orders):
                    if detailed_order and not isinstance(detailed_order, Exception):
                        original_order = sample_orders[idx]
                        financials = self.extract_detailed_order_financials(detailed_order, original_order)
                        
                        if financials["include_in_revenue"]:
                            total_gross_sales += financials["gross_sales"]
                            total_net_sales += financials["net_sales"]
                            total_discount += financials["discount"]
                            total_tax += financials["tax_amount"]
                            
                            channel = financials["channel"]
                            if channel not in channel_breakdown:
                                channel_breakdown[channel] = {"orders": 0, "gross_sales": 0, "net_sales": 0}
                            channel_breakdown[channel]["orders"] += 1
                            channel_breakdown[channel]["gross_sales"] += financials["gross_sales"]
                            channel_breakdown[channel]["net_sales"] += financials["net_sales"]
                            
                            successful_count += 1
                
                if successful_count > 0 and valid_orders_count > successful_count:
                    extrapolation_factor = valid_orders_count / successful_count
                    total_gross_sales *= extrapolation_factor
                    total_net_sales *= extrapolation_factor
                    total_discount *= extrapolation_factor
                    total_tax *= extrapolation_factor
                    
                    for channel in channel_breakdown:
                        channel_breakdown[channel]["orders"] = int(channel_breakdown[channel]["orders"] * extrapolation_factor)
                        channel_breakdown[channel]["gross_sales"] *= extrapolation_factor
                        channel_breakdown[channel]["net_sales"] *= extrapolation_factor
                    
                    data_accuracy = "extrapolated"
                else:
                    data_accuracy = "complete"
        else:
            data_accuracy = "no_data"
        
        processed_orders = basic_processed_orders[:50]
        
        return {
            "success": True,
            "period": "last_24_hours",
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
            "summary": {
                "total_orders": total_orders,
                "valid_orders": valid_orders_count,
                "total_gross_sales": round(total_gross_sales, 2),
                "total_net_sales": round(total_net_sales, 2),
                "total_revenue": round(total_net_sales, 2),
                "total_discount": round(total_discount, 2),
                "total_tax": round(total_tax, 2),
                "currency": "INR",
                "avg_order_value": round(total_net_sales / valid_orders_count if valid_orders_count > 0 else 0, 2),
                "data_accuracy": data_accuracy,
                "channel_breakdown": channel_breakdown
            },
            "orders": processed_orders
        }
    except Exception as e:
        print(f"❌ Exception in get_last_24_hours_sales: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Exception occurred: {str(e)}",
            "summary": {"total_orders": 0, "total_revenue": 0, "currency": "INR"}
        }
