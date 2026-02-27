from supabase import create_client, Client
from app.core.config import settings
from typing import Optional

# Supabase client singleton
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Get or create Supabase client instance"""
    global _supabase_client

    if _supabase_client is None:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )

    return _supabase_client


def get_supabase_admin_client() -> Client:
    """Get Supabase client with service role (admin) key"""
    service_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY

    return create_client(
        settings.SUPABASE_URL,
        service_key
    )


# Example usage functions

async def upload_file_to_storage(bucket: str, file_path: str, file_data: bytes) -> dict:
    """Upload file to Supabase Storage"""
    supabase = get_supabase_client()

    response = supabase.storage.from_(bucket).upload(
        file_path,
        file_data
    )

    return response


async def get_realtime_subscription(table: str, event: str = "*"):
    """Subscribe to real-time changes in Supabase"""
    supabase = get_supabase_client()

    # Example: supabase.table(table).on(event, callback).subscribe()
    return supabase.table(table).on(event, lambda payload: print(payload))


async def query_with_supabase(table: str, filters: dict = None):
    """Query data using Supabase client (alternative to SQLAlchemy)"""
    supabase = get_supabase_client()

    query = supabase.table(table).select("*")

    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)

    response = query.execute()
    return response.data
