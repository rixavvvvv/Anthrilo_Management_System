from sqlalchemy import text
from app.db.session import engine
from app.db.supabase_client import get_supabase_client

print("=" * 60)
print("🧪 SUPABASE CONNECTION TEST")
print("=" * 60)

# Test 1: Database Connection
print("\n1️⃣ Testing PostgreSQL Database Connection...")
try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.scalar()
        print(f"✅ Connected to: {version[:60]}")
except Exception as e:
    print(f"❌ Failed: {e}")

# Test 2: List Tables
print("\n2️⃣ Checking Database Tables...")
try:
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        ))
        tables = [row[0] for row in result]
        print(f"📋 Found {len(tables)} tables:")
        for table in tables:
            print(f"   ✅ {table}")
except Exception as e:
    print(f"❌ Failed: {e}")

# Test 3: Supabase Client
print("\n3️⃣ Testing Supabase SDK Client...")
try:
    client = get_supabase_client()
    print("✅ Supabase client initialized successfully!")
except Exception as e:
    print(f"❌ Failed: {e}")

print("\n" + "=" * 60)
print("🎉 ALL TESTS COMPLETED!")
print("=" * 60)
print("\n📝 Next Steps:")
print("   1. Start backend: python -m uvicorn app.main:app --reload")
print("   2. Access API docs: http://127.0.0.1:8000/docs")
print("   3. Start frontend: cd ../frontend && npm run dev")
