"""
Centralized OAuth Token Lifecycle Manager
==========================================
Enterprise-grade, self-healing authentication system.

CRITICAL DESIGN:
- Single shared token across ALL concurrent requests
- Proactive refresh 60 seconds before expiry (not per-request)
- asyncio.Lock ensures only ONE refresh happens at a time
- 3-level authentication fallback strategy
- File-based persistence for token survival across restarts

Auth Strategy:
  LEVEL 1 -> Valid cached access token (instant)
  LEVEL 2 -> Refresh token exchange (if access expired)
  LEVEL 3 -> Full re-authentication (username/password or access_code fallback)
"""

import httpx
import json
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional, Any


def _utcnow() -> datetime:
    """Return current UTC time as naive datetime (Python 3.12+ compatible)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Proactive refresh window: refresh token this many seconds BEFORE expiry
PROACTIVE_REFRESH_SECONDS = 60


class TokenManager:
    """
    Centralized OAuth Token Manager with thread-safe refresh.

    Ensures:
    - No per-request token fetch (single shared token)
    - Proactive refresh 60s before expiry
    - Only ONE concurrent refresh via asyncio.Lock
    - Automatic fallback through 3 auth levels
    """

    def __init__(self, tenant: str, access_code: str):
        self.tenant = tenant
        self.access_code = access_code
        self.base_url = f"https://{tenant}.unicommerce.com/services/rest/v1"

        # Load credentials from settings
        self.username = settings.UNICOMMERCE_USERNAME
        self.password = settings.UNICOMMERCE_PASSWORD

        # Token storage file
        self.token_file = (
            Path(__file__).parent.parent / "data" / "unicommerce_tokens.json"
        )
        self.token_file.parent.mkdir(exist_ok=True)

        # In-memory cache
        self._access_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._refresh_expires_at: Optional[datetime] = None

        # Thread-safety: only one refresh at a time
        self._refresh_lock = asyncio.Lock()

        # Track auth stats
        self._auth_stats = {
            "level1_hits": 0,
            "level2_refreshes": 0,
            "level3_reauths": 0,
            "failures": 0,
            "last_refresh": None,
            "last_auth": None,
        }

        # Load saved tokens or use environment tokens
        self._load_tokens()

        # If no tokens in file, try loading from environment
        if not self._access_token:
            if settings.UNICOMMERCE_ACCESS_TOKEN:
                self._access_token = settings.UNICOMMERCE_ACCESS_TOKEN
                self._refresh_token = settings.UNICOMMERCE_REFRESH_TOKEN
                # Set expiry to trigger refresh check
                self._token_expires_at = _utcnow() + timedelta(hours=1)
                self._refresh_expires_at = _utcnow() + timedelta(days=29)
                self._save_tokens()
                logger.info("Loaded tokens from environment variables")

    # =========================================================================
    # PERSISTENCE
    # =========================================================================

    def _load_tokens(self):
        """Load tokens from persistent JSON storage"""
        try:
            if self.token_file.exists():
                with open(self.token_file, "r") as f:
                    data = json.load(f)
                    self._access_token = data.get("access_token")
                    self._refresh_token = data.get("refresh_token")

                    if data.get("token_expires_at"):
                        self._token_expires_at = datetime.fromisoformat(
                            data["token_expires_at"]
                        )
                    if data.get("refresh_expires_at"):
                        self._refresh_expires_at = datetime.fromisoformat(
                            data["refresh_expires_at"]
                        )
                logger.debug("Tokens loaded from file")
        except Exception as e:
            logger.warning(f"Failed to load tokens from file: {e}")

    def _save_tokens(self):
        """Persist tokens to JSON file for restart survival"""
        try:
            data = {
                "access_token": self._access_token,
                "refresh_token": self._refresh_token,
                "token_expires_at": (
                    self._token_expires_at.isoformat()
                    if self._token_expires_at
                    else None
                ),
                "refresh_expires_at": (
                    self._refresh_expires_at.isoformat()
                    if self._refresh_expires_at
                    else None
                ),
                "last_updated": _utcnow().isoformat(),
            }
            with open(self.token_file, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save tokens to file: {e}")

    # =========================================================================
    # LEVEL 3: Full Re-Authentication
    # =========================================================================

    async def _authenticate(self) -> bool:
        """
        LEVEL 3: Re-authenticate with username/password or access code.
        Called only when refresh token is also expired/invalid.
        """
        logger.info("LEVEL 3: Performing full re-authentication...")

        # Try username/password authentication first
        if self.username and self.password:
            logger.info(f"  Attempting login with username: {self.username}")
            login_url = f"https://{self.tenant}.unicommerce.com/oauth/token"

            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.post(
                        login_url,
                        data={
                            "grant_type": "password",
                            "username": self.username,
                            "password": self.password,
                            "client_id": "my-trusted-client",
                        },
                        headers={
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Accept": "application/json",
                        },
                    )

                    if response.status_code == 200:
                        data = response.json()
                        self._access_token = data.get("access_token")
                        self._refresh_token = data.get("refresh_token")

                        expires_in = data.get("expires_in", 86400)
                        self._token_expires_at = _utcnow() + timedelta(
                            seconds=expires_in
                        )

                        refresh_expires_in = data.get(
                            "refresh_expires_in", 2592000
                        )
                        self._refresh_expires_at = _utcnow() + timedelta(
                            seconds=refresh_expires_in
                        )

                        self._save_tokens()
                        self._auth_stats["level3_reauths"] += 1
                        self._auth_stats["last_auth"] = _utcnow().isoformat()
                        logger.info(
                            f"Login successful! Token expires in {expires_in}s"
                        )
                        return True
                    else:
                        logger.warning(
                            f"Login failed ({response.status_code}): "
                            f"{response.text[:200]}"
                        )
                except Exception as e:
                    logger.warning(f"Login error: {e}")

        # Fallback: Use access code directly as bearer token
        if self.access_code:
            logger.info("  Using access code as bearer token (fallback)")
            self._access_token = self.access_code
            self._token_expires_at = _utcnow() + timedelta(days=365)
            self._refresh_expires_at = _utcnow() + timedelta(days=365)
            self._save_tokens()
            self._auth_stats["level3_reauths"] += 1
            self._auth_stats["last_auth"] = _utcnow().isoformat()
            return True

        logger.error("All authentication methods failed")
        self._auth_stats["failures"] += 1
        return False

    # =========================================================================
    # LEVEL 2: Token Refresh
    # =========================================================================

    async def _refresh_access_token(self) -> bool:
        """
        LEVEL 2: Refresh access token using refresh token.
        Called when access token is expired/about to expire but refresh token is valid.
        """
        if not self._refresh_token:
            logger.debug("No refresh token available, skipping to re-auth")
            return False

        logger.info("LEVEL 2: Refreshing access token...")
        refresh_url = f"https://{self.tenant}.unicommerce.com/oauth/token"

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    refresh_url,
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": self._refresh_token,
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    self._access_token = data.get("access_token")

                    if data.get("refresh_token"):
                        self._refresh_token = data.get("refresh_token")

                    expires_in = data.get("expires_in", 86400)
                    self._token_expires_at = _utcnow() + timedelta(
                        seconds=expires_in
                    )

                    self._save_tokens()
                    self._auth_stats["level2_refreshes"] += 1
                    self._auth_stats["last_refresh"] = (
                        _utcnow().isoformat()
                    )
                    logger.info("Token refresh successful")
                    return True
                else:
                    logger.warning(
                        f"Token refresh failed: {response.status_code}"
                    )
                    return False
            except Exception as e:
                logger.warning(f"Token refresh error: {e}")
                return False

    # =========================================================================
    # LEVEL 1: Get Valid Token (Main Entry Point)
    # =========================================================================

    async def get_valid_token(self) -> Optional[str]:
        """
        Get a valid access token. Thread-safe via asyncio.Lock.

        Only ONE concurrent call will perform refresh/auth.
        All other concurrent callers wait and reuse the result.

        Refresh Strategy:
        - If token valid for > 60 seconds: return immediately (LEVEL 1)
        - If token expiring in < 60 seconds: refresh (LEVEL 2)
        - If refresh fails: re-authenticate (LEVEL 3)
        """
        now = _utcnow()

        # LEVEL 1: Check if current token is valid (not expiring within 60s)
        if self._access_token and self._token_expires_at:
            if now < (
                self._token_expires_at
                - timedelta(seconds=PROACTIVE_REFRESH_SECONDS)
            ):
                self._auth_stats["level1_hits"] += 1
                return self._access_token

        # Token needs refresh - acquire lock so only ONE refresh happens
        async with self._refresh_lock:
            # Double-check after acquiring lock (another coroutine may have refreshed)
            now = _utcnow()
            if self._access_token and self._token_expires_at:
                if now < (
                    self._token_expires_at
                    - timedelta(seconds=PROACTIVE_REFRESH_SECONDS)
                ):
                    self._auth_stats["level1_hits"] += 1
                    return self._access_token

            # LEVEL 2: Try refresh
            if self._refresh_token and self._refresh_expires_at:
                if now < self._refresh_expires_at:
                    if await self._refresh_access_token():
                        return self._access_token

            # LEVEL 3: Full re-authentication
            if await self._authenticate():
                return self._access_token

            logger.error("All authentication levels failed")
            self._auth_stats["failures"] += 1
            return None

    # =========================================================================
    # Headers & Status
    # =========================================================================

    def invalidate_token(self):
        """
        Invalidate the current token to force re-authentication.
        Called when we get a 401 from the server, indicating the token is invalid.
        """
        logger.warning("Invalidating current token to force refresh")
        self._token_expires_at = _utcnow() - timedelta(seconds=1)

    async def get_headers(self) -> Dict[str, str]:
        """Get authenticated headers with a valid token."""
        token = await self.get_valid_token()
        auth_token = token if token else self.access_code

        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def get_token_status(self) -> Dict[str, Any]:
        """Get current token status for monitoring/debugging."""
        now = _utcnow()

        access_remaining = None
        refresh_remaining = None

        if self._token_expires_at:
            delta = self._token_expires_at - now
            access_remaining = str(
                delta) if delta.total_seconds() > 0 else "EXPIRED"

        if self._refresh_expires_at:
            delta = self._refresh_expires_at - now
            refresh_remaining = (
                str(delta) if delta.total_seconds() > 0 else "EXPIRED"
            )

        return {
            "has_access_token": bool(self._access_token),
            "has_refresh_token": bool(self._refresh_token),
            "access_token_valid": bool(
                self._access_token
                and self._token_expires_at
                and now < self._token_expires_at
            ),
            "refresh_token_valid": bool(
                self._refresh_token
                and self._refresh_expires_at
                and now < self._refresh_expires_at
            ),
            "access_token_expires_in": access_remaining,
            "refresh_token_expires_in": refresh_remaining,
            "proactive_refresh_seconds": PROACTIVE_REFRESH_SECONDS,
            "auth_stats": self._auth_stats,
        }


# =========================================================================
# SINGLETON
# =========================================================================

_token_manager: Optional[TokenManager] = None


def get_token_manager() -> TokenManager:
    """Get or create the global token manager singleton."""
    global _token_manager
    if _token_manager is None:
        _token_manager = TokenManager(
            tenant=settings.UNICOMMERCE_TENANT,
            access_code=settings.UNICOMMERCE_ACCESS_CODE,
        )
    return _token_manager
