"""
Automated Token Lifecycle Management
Self-healing authentication system with 3-level strategy
"""

import httpx
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Any
import asyncio
from app.core.config import settings


class TokenManager:
    """
    🔁 3-Level Authentication Strategy
    LEVEL 1 → Access Token (short-lived)
    LEVEL 2 → Refresh Token (medium-lived)
    LEVEL 3 → Re-Authenticate (fallback)
    """

    def __init__(self, tenant: str, access_code: str):
        self.tenant = tenant
        self.access_code = access_code
        self.base_url = f"https://{tenant}.unicommerce.com/services/rest/v1"
        
        # Load credentials from settings
        from app.core.config import settings
        self.username = settings.UNICOMMERCE_USERNAME
        self.password = settings.UNICOMMERCE_PASSWORD
        
        # Token storage file
        self.token_file = Path(__file__).parent.parent / "data" / "unicommerce_tokens.json"
        self.token_file.parent.mkdir(exist_ok=True)
        
        # In-memory cache
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._refresh_expires_at: Optional[datetime] = None
        
        # Load saved tokens or use environment tokens
        self._load_tokens()
        
        # If no tokens in file, try loading from environment
        if not self._access_token:
            if settings.UNICOMMERCE_ACCESS_TOKEN:
                self._access_token = settings.UNICOMMERCE_ACCESS_TOKEN
                self._refresh_token = settings.UNICOMMERCE_REFRESH_TOKEN
                # Set expiry to trigger refresh check
                self._token_expires_at = datetime.utcnow() + timedelta(hours=1)
                self._refresh_expires_at = datetime.utcnow() + timedelta(days=29)
                self._save_tokens()
                print("✅ Loaded tokens from environment variables")

    def _load_tokens(self):
        """Load tokens from persistent storage"""
        try:
            if self.token_file.exists():
                with open(self.token_file, 'r') as f:
                    data = json.load(f)
                    self._access_token = data.get('access_token')
                    self._refresh_token = data.get('refresh_token')
                    
                    # Parse expiry timestamps
                    if data.get('token_expires_at'):
                        self._token_expires_at = datetime.fromisoformat(data['token_expires_at'])
                    if data.get('refresh_expires_at'):
                        self._refresh_expires_at = datetime.fromisoformat(data['refresh_expires_at'])
        except Exception as e:
            print(f"⚠️ Failed to load tokens: {e}")

    def _save_tokens(self):
        """Save tokens to persistent storage"""
        try:
            data = {
                'access_token': self._access_token,
                'refresh_token': self._refresh_token,
                'token_expires_at': self._token_expires_at.isoformat() if self._token_expires_at else None,
                'refresh_expires_at': self._refresh_expires_at.isoformat() if self._refresh_expires_at else None,
                'last_updated': datetime.utcnow().isoformat()
            }
            with open(self.token_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"⚠️ Failed to save tokens: {e}")

    async def _authenticate(self) -> bool:
        """
        LEVEL 3: Re-Authenticate with username/password or access code
        Fallback when everything else fails
        """
        print("🔐 LEVEL 3: Re-authenticating...")
        
        # Try username/password authentication first
        if self.username and self.password:
            print(f"   Attempting login with username: {self.username}")
            
            # Unicommerce login endpoint
            login_url = f"https://{self.tenant}.unicommerce.com/oauth/token"
            
            async with httpx.AsyncClient() as client:
                try:
                    # Try form-based login with client credentials
                    # Common OAuth patterns: try with client_id, then without
                    response = await client.post(
                        login_url,
                        data={
                            "grant_type": "password",
                            "username": self.username,
                            "password": self.password,
                            "client_id": "my-trusted-client"  # Common default for Unicommerce
                        },
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Accept": "application/json"
                        },
                        timeout=30.0
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        self._access_token = data.get('access_token')
                        self._refresh_token = data.get('refresh_token')
                        
                        # Parse token expiry from response
                        expires_in = data.get('expires_in', 86400)  # Default 24 hours
                        self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 600)
                        
                        refresh_expires_in = data.get('refresh_expires_in', 2592000)  # Default 30 days
                        self._refresh_expires_at = datetime.utcnow() + timedelta(seconds=refresh_expires_in - 600)
                        
                        self._save_tokens()
                        print(f"✅ Login successful! Access token: {self._access_token[:20]}...")
                        return True
                    else:
                        print(f"⚠️ Login failed ({response.status_code}): {response.text[:200]}")
                        
                except Exception as e:
                    print(f"⚠️ Login error: {e}")
        
        # Fallback: Try using access code directly as bearer token
        if self.access_code:
            print(f"   Trying access code as bearer token...")
            self._access_token = self.access_code
            
            # Set far future expiry since access code doesn't expire normally
            self._token_expires_at = datetime.utcnow() + timedelta(days=365)
            self._refresh_expires_at = datetime.utcnow() + timedelta(days=365)
            
            self._save_tokens()
            print("✅ Using access code as bearer token")
            return True
        
        print("❌ All authentication methods failed")
        return False

    async def _refresh_access_token(self) -> bool:
        """
        LEVEL 2: Refresh access token using refresh token
        Used when access token expires
        """
        if not self._refresh_token:
            print("⚠️ No refresh token available, skipping to re-auth")
            return False
            
        print("🔄 LEVEL 2: Refreshing access token...")
        
        refresh_url = f"https://{self.tenant}.unicommerce.com/oauth/token"
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    refresh_url,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": self._refresh_token
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json"
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get('access_token')
                    
                    # Some APIs return new refresh token, others keep the same
                    if data.get('refresh_token'):
                        self._refresh_token = data.get('refresh_token')
                    
                    # Update access token expiry
                    expires_in = data.get('expires_in', 86400)
                    self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 600)
                    
                    self._save_tokens()
                    print("✅ Token refresh successful")
                    return True
                else:
                    print(f"⚠️ Token refresh failed: {response.status_code}, falling back to re-auth")
                    return False
                    
            except Exception as e:
                print(f"⚠️ Token refresh error: {e}, falling back to re-auth")
                return False

    async def get_valid_token(self) -> Optional[str]:
        """
        LEVEL 1: Get a valid access token
        Automatically handles token lifecycle
        """
        now = datetime.utcnow()
        
        # Check if we have a valid access token
        if self._access_token and self._token_expires_at:
            # Refresh 10 minutes before expiry (proactive refresh)
            if now < (self._token_expires_at - timedelta(minutes=10)):
                print("✅ LEVEL 1: Using valid access token")
                return self._access_token
        
        # Access token expired or about to expire
        # Try LEVEL 2: Refresh
        if self._refresh_token and self._refresh_expires_at:
            if now < self._refresh_expires_at:
                if await self._refresh_access_token():
                    return self._access_token
        
        # LEVEL 2 failed, try LEVEL 3: Re-authenticate
        if await self._authenticate():
            return self._access_token
        
        # All levels failed
        print("❌ All authentication levels failed")
        return None

    async def get_headers(self) -> Dict[str, str]:
        """Get authenticated headers with valid token"""
        # Get the best available token (access token or fallback to access code)
        token = await self.get_valid_token()
        
        # Use token if available, otherwise use access code directly
        auth_token = token if token else self.access_code
        
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def get_token_status(self) -> Dict[str, Any]:
        """Get current token status for monitoring"""
        now = datetime.utcnow()
        
        return {
            "has_access_token": bool(self._access_token),
            "has_refresh_token": bool(self._refresh_token),
            "access_token_valid": bool(
                self._access_token and 
                self._token_expires_at and 
                now < self._token_expires_at
            ),
            "refresh_token_valid": bool(
                self._refresh_token and 
                self._refresh_expires_at and 
                now < self._refresh_expires_at
            ),
            "access_token_expires_in": str(
                self._token_expires_at - now
            ) if self._token_expires_at else None,
            "refresh_token_expires_in": str(
                self._refresh_expires_at - now
            ) if self._refresh_expires_at else None
        }


# Singleton instance
_token_manager: Optional[TokenManager] = None


def get_token_manager() -> TokenManager:
    """Get or create the global token manager instance"""
    global _token_manager
    
    if _token_manager is None:
        _token_manager = TokenManager(
            tenant=settings.UNICOMMERCE_TENANT,
            access_code=settings.UNICOMMERCE_ACCESS_CODE
        )
    
    return _token_manager
