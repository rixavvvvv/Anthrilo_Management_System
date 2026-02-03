"""
Complete Unicommerce API Integration for Anthrilo ERP
All available APIs organized by functionality
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import httpx
from app.core.token_manager import TokenManager


class UnicommerceAPIService:
    """
    Comprehensive Unicommerce API integration service
    Covers: Products, Inventory, Sales, Fulfillment, Returns, Vendors
    """
    
    def __init__(self):
        from app.core.config import settings
        self.tenant = settings.UNICOMMERCE_TENANT
        self.access_code = settings.UNICOMMERCE_ACCESS_CODE
        self.base_url = f"https://{self.tenant}.unicommerce.com/services/rest/v1"
        self.token_manager = TokenManager(tenant=self.tenant, access_code=self.access_code)
        self.timeout = httpx.Timeout(30.0)
    
    async def _get_headers(self) -> Dict[str, str]:
        """Get authenticated headers with auto-refreshing token"""
        token = await self.token_manager.get_valid_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    async def _get_headers_with_facility(self, facility_code: str) -> Dict[str, str]:
        """Get headers with facility code for facility-level APIs"""
        headers = await self._get_headers()
        headers["Facility"] = facility_code
        return headers
    
    # ============================================================================
    # PRODUCT MANAGEMENT APIs
    # ============================================================================
    
    async def create_or_update_category(self, category_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update product category
        Endpoint: POST /product/category/addOrEdit
        Level: Tenant
        """
        url = f"{self.base_url}/product/category/addOrEdit"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"category": category_data},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def create_or_update_item(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update product/item
        Endpoint: POST /catalog/itemType/createOrEdit
        Level: Tenant
        
        Use for: Fabrics, Yarns, Garments
        Fields: skuCode, name, categoryCode, price, dimensions, barcode, etc.
        """
        url = f"{self.base_url}/catalog/itemType/createOrEdit"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"itemType": item_data},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def get_item_details(self, sku_code: str) -> Dict[str, Any]:
        """
        Get detailed information for a product
        Endpoint: POST /catalog/itemType/get
        """
        url = f"{self.base_url}/catalog/itemType/get"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"skuCode": sku_code},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def search_items(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Search products with filters
        Endpoint: POST /catalog/itemType/search
        Filters: categoryCode, brand, enabled, etc.
        """
        url = f"{self.base_url}/catalog/itemType/search"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=filters,
                headers=await self._get_headers()
            )
            return response.json()
    
    # ============================================================================
    # INVENTORY MANAGEMENT APIs
    # ============================================================================
    
    async def get_inventory_snapshot(
        self,
        facility_code: str,
        item_skus: Optional[List[str]] = None,
        updated_since_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get inventory levels for SKUs
        Endpoint: POST /inventory/inventorySnapshot/get
        Level: Facility
        
        Returns: available qty, open sale, blocked, pending, etc.
        """
        url = f"{self.base_url}/inventory/inventorySnapshot/get"
        
        payload = {}
        if item_skus:
            payload["itemTypeSKUs"] = item_skus
        if updated_since_minutes:
            payload["updatedSinceInMinutes"] = updated_since_minutes
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
    
    async def adjust_inventory(
        self,
        facility_code: str,
        sku_code: str,
        quantity: int,
        adjustment_type: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Adjust inventory for a SKU
        Endpoint: POST /inventory/adjust
        Level: Facility
        
        Types: DAMAGE, FOUND, LOST, etc.
        """
        url = f"{self.base_url}/inventory/adjust"
        
        payload = {
            "inventoryAdjustment": {
                "itemTypeSku": sku_code,
                "quantity": quantity,
                "adjustmentType": adjustment_type,
                "reason": reason
            }
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
    
    # ============================================================================
    # SALE ORDER APIs (Already Implemented)
    # ============================================================================
    
    async def create_sale_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new sale order
        Endpoint: POST /oms/saleOrder/create
        Level: Tenant
        """
        url = f"{self.base_url}/oms/saleOrder/create"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=order_data,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def get_sale_order(self, order_code: str) -> Dict[str, Any]:
        """
        Get sale order details (ALREADY IMPLEMENTED - used for revenue)
        Endpoint: POST /oms/saleorder/get
        """
        url = f"{self.base_url}/oms/saleorder/get"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"code": order_code},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def search_sale_orders(
        self,
        from_date: datetime,
        to_date: datetime,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search sale orders (ALREADY IMPLEMENTED)
        Endpoint: POST /oms/saleOrder/search
        """
        url = f"{self.base_url}/oms/saleOrder/search"
        
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        }
        
        if status:
            payload["status"] = status
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def update_sale_order(self, order_code: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update sale order details
        Endpoint: POST /oms/saleOrder/edit
        """
        url = f"{self.base_url}/oms/saleOrder/edit"
        
        payload = {"saleOrderCode": order_code, **updates}
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def cancel_sale_order(self, order_codes: List[str]) -> Dict[str, Any]:
        """
        Cancel sale orders
        Endpoint: POST /oms/saleOrder/cancel
        """
        url = f"{self.base_url}/oms/saleOrder/cancel"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"saleOrderCodes": order_codes},
                headers=await self._get_headers()
            )
            return response.json()
    
    # ============================================================================
    # FULFILLMENT / SHIPPING APIs
    # ============================================================================
    
    async def create_shipping_package(
        self,
        sale_order_code: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create shipping package for order
        Endpoint: POST /oms/shippingPackage/create
        """
        url = f"{self.base_url}/oms/shippingPackage/create"
        
        payload = {
            "saleOrderCode": sale_order_code,
            "shippingPackageItems": items
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def search_shipping_packages(
        self,
        from_date: datetime,
        to_date: datetime,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search shipping packages
        Endpoint: POST /oms/shippingPackage/search
        """
        url = f"{self.base_url}/oms/shippingPackage/search"
        
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        }
        
        if status:
            payload["status"] = status
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def create_invoice(self, shipping_package_code: str) -> Dict[str, Any]:
        """
        Create invoice for shipment
        Endpoint: POST /oms/shippingPackage/createInvoice
        """
        url = f"{self.base_url}/oms/shippingPackage/createInvoice"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"shippingPackageCode": shipping_package_code},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def get_invoice_details(self, shipping_package_code: str) -> Dict[str, Any]:
        """
        Get invoice details
        Endpoint: POST /oms/invoice/getDetails
        """
        url = f"{self.base_url}/oms/invoice/getDetails"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"shippingPackageCode": shipping_package_code},
                headers=await self._get_headers()
            )
            return response.json()
    
    async def mark_dispatched(self, shipping_package_codes: List[str]) -> Dict[str, Any]:
        """
        Mark shipments as dispatched
        Endpoint: POST /oms/shippingPackage/dispatch
        """
        url = f"{self.base_url}/oms/shippingPackage/dispatch"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"shippingPackageCodes": shipping_package_codes},
                headers=await self._get_headers()
            )
            return response.json()
    
    # ============================================================================
    # RETURNS APIs
    # ============================================================================
    
    async def mark_order_returned(
        self,
        sale_order_code: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Mark sale order items as returned
        Endpoint: POST /oms/saleOrder/markReturned
        """
        url = f"{self.base_url}/oms/saleOrder/markReturned"
        
        payload = {
            "saleOrderCode": sale_order_code,
            "saleOrderItems": items
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def search_returns(
        self,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """
        Search returns
        Endpoint: POST /oms/return/search
        """
        url = f"{self.base_url}/oms/return/search"
        
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    async def create_reverse_pickup(
        self,
        sale_order_code: str,
        items: List[str]
    ) -> Dict[str, Any]:
        """
        Create reverse pickup for returns
        Endpoint: POST /oms/reversePickup/create
        """
        url = f"{self.base_url}/oms/reversePickup/create"
        
        payload = {
            "saleOrderCode": sale_order_code,
            "saleOrderItemCodes": items
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers()
            )
            return response.json()
    
    # ============================================================================
    # VENDOR / PURCHASE ORDER APIs
    # ============================================================================
    
    async def create_or_update_vendor(
        self,
        facility_code: str,
        vendor_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create or update vendor
        Endpoint: POST /purchase/vendor/create (or /edit)
        Level: Facility
        
        Use for: Fabric suppliers, yarn vendors, etc.
        """
        url = f"{self.base_url}/purchase/vendor/create"
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json={"vendor": vendor_data},
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
    
    async def create_purchase_order(
        self,
        facility_code: str,
        vendor_code: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create purchase order
        Endpoint: POST /purchase/purchaseOrder/create
        Level: Facility
        """
        url = f"{self.base_url}/purchase/purchaseOrder/create"
        
        payload = {
            "vendorCode": vendor_code,
            "purchaseOrderItems": items
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
    
    async def search_purchase_orders(
        self,
        facility_code: str,
        from_date: datetime,
        to_date: datetime
    ) -> Dict[str, Any]:
        """
        Search purchase orders
        Endpoint: POST /purchase/purchaseOrder/search
        """
        url = f"{self.base_url}/purchase/purchaseOrder/search"
        
        payload = {
            "fromDate": from_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "toDate": to_date.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
    
    async def create_grn(
        self,
        facility_code: str,
        purchase_order_code: str,
        items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create Goods Receipt Note (GRN)
        Endpoint: POST /purchase/inflowReceipt/create
        Level: Facility
        
        Use for: Receiving raw materials (yarn, fabric)
        """
        url = f"{self.base_url}/purchase/inflowReceipt/create"
        
        payload = {
            "purchaseOrderCode": purchase_order_code,
            "inflowReceiptItems": items
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                json=payload,
                headers=await self._get_headers_with_facility(facility_code)
            )
            return response.json()
