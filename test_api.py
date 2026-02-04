#!/usr/bin/env python3
"""Simple test script to verify the API is working"""
import httpx
import json
import asyncio

async def test_api():
    async with httpx.AsyncClient() as client:
        try:
            print("Testing /api/v1/integrations/unicommerce/last-24-hours...")
            response = await client.get("http://localhost:8000/api/v1/integrations/unicommerce/last-24-hours", timeout=30)
            print(f"Status: {response.status_code}")
            
            data = response.json()
            print("\nResponse Summary:")
            print(json.dumps({
                "success": data.get("success"),
                "period": data.get("period"),
                "summary": data.get("summary")
            }, indent=2))
            
            if data.get("success"):
                print("\n✅ API is returning REAL data!")
            else:
                print("\n❌ API returned error:", data.get("message"))
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
