"""Auth endpoints: login, register, token refresh, user management."""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.db.session import get_db
from app.db.models import User, LoginHistory, ActivityLog, UserSession
from app.schemas.auth import (
    UserCreate, UserLogin, UserUpdate, ChangePassword,
    ProfileUpdate, PreferencesUpdate,
    User as UserSchema, UserList, Token,
    SessionItem, LoginHistoryItem, ActivityLogItem, VALID_ROLES,
)
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Helpers

def _hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe session storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def _parse_device(ua: str) -> str:
    """Extract a human-readable device label from user-agent."""
    ua_lower = ua.lower()
    browser = "Unknown"
    if "chrome" in ua_lower and "edg" not in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    elif "edg" in ua_lower:
        browser = "Edge"
    elif "python" in ua_lower:
        browser = "API Client"
    os_name = "Unknown"
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_name = "iOS"
    return f"{browser} on {os_name}"


# Dependencies

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Extract & validate user from Authorization: Bearer <token>."""
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user


def _jwt_pair(user: User) -> dict:
    """Issue access + refresh token pair with role in payload."""
    payload = {"sub": str(user.id), "role": user.role}
    return {
        "access_token": create_access_token(data=payload),
        "refresh_token": create_refresh_token(data=payload),
        "token_type": "bearer",
    }


def _log_activity(db: Session, user_id: int, action: str, detail: str = "", ip: str = ""):
    db.add(ActivityLog(user_id=user_id, action=action, detail=detail, ip_address=ip))
    db.commit()


def _create_session(db: Session, user_id: int, refresh_token: str, ip: str, ua: str):
    """Store a session record keyed by refresh-token hash."""
    token_hash = _hash_token(refresh_token)
    expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    device = _parse_device(ua)
    sess = UserSession(
        user_id=user_id,
        refresh_token_hash=token_hash,
        ip_address=ip,
        user_agent=ua[:512],
        device_label=device,
        is_current=False,
        created_at=datetime.utcnow(),
        expires_at=expires,
    )
    db.add(sess)
    db.commit()
    return sess


# Auth endpoints

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Login JWT tokens. Records login history, activity, and active session."""
    ip = request.client.host if request.client else ""
    ua = (request.headers.get("user-agent") or "")[:512]

    user = db.query(User).filter(User.username == credentials.username).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        if user:
            db.add(LoginHistory(user_id=user.id, ip_address=ip, user_agent=ua, status="failed"))
            db.commit()
        raise HTTPException(status_code=401, detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Create tokens
    tokens = _jwt_pair(user)

    # Record session
    _create_session(db, user.id, tokens["refresh_token"], ip, ua)

    # Record successful login
    user.last_login = datetime.utcnow()
    db.add(LoginHistory(user_id=user.id, ip_address=ip, user_agent=ua, status="success"))
    _log_activity(db, user.id, "login", f"Login from {ip}", ip)
    db.commit()

    return tokens


@router.post("/register", response_model=UserSchema, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. Open if no users exist, admin-only otherwise."""
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(status_code=403,
                            detail="Registration closed. Ask an admin to create your account.")
    if user_in.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    existing = db.query(User).filter(
        (User.email == user_in.email) | (User.username == user_in.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")
    db_user = User(
        email=user_in.email, username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name, role=user_in.role,
        is_active=True, is_superuser=user_in.role == "admin",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
def refresh_tokens(body: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)):
    """Rotate refresh token new access + refresh pair. Updates session."""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token",
                            headers={"WWW-Authenticate": "Bearer"})
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")

    # Remove old session
    old_hash = _hash_token(body.refresh_token)
    db.query(UserSession).filter(UserSession.refresh_token_hash == old_hash).delete()

    # Issue new tokens + session
    tokens = _jwt_pair(user)
    ip = request.client.host if request.client else ""
    ua = (request.headers.get("user-agent") or "")[:512]
    _create_session(db, user.id, tokens["refresh_token"], ip, ua)
    db.commit()
    return tokens


@router.get("/me", response_model=UserSchema)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=UserSchema)
def update_profile(
    body: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update own profile (full_name)."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    ip = request.client.host if request.client else ""
    _log_activity(db, current_user.id, "update_profile", f"Profile updated", ip)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    body: ChangePassword,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change own password."""
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(body.new_password)
    ip = request.client.host if request.client else ""
    _log_activity(db, current_user.id, "change_password", "Password changed", ip)
    db.commit()
    return {"message": "Password updated"}


@router.get("/me/preferences")
def get_preferences(current_user: User = Depends(get_current_user)):
    """Get user preferences."""
    return {
        "full_name": current_user.full_name,
        "timezone": current_user.timezone or "Asia/Kolkata",
        "language": current_user.language or "en",
        "email_notifications": current_user.email_notifications if current_user.email_notifications is not None else True,
    }


@router.put("/me/preferences")
def update_preferences(
    body: PreferencesUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user preferences."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.timezone is not None:
        current_user.timezone = body.timezone
    if body.language is not None:
        current_user.language = body.language
    if body.email_notifications is not None:
        current_user.email_notifications = body.email_notifications
    ip = request.client.host if request.client else ""
    _log_activity(db, current_user.id, "update_preferences", "Preferences updated", ip)
    db.commit()
    db.refresh(current_user)
    return {
        "full_name": current_user.full_name,
        "timezone": current_user.timezone,
        "language": current_user.language,
        "email_notifications": current_user.email_notifications,
    }


@router.get("/sessions", response_model=List[SessionItem])
def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active sessions for current user."""
    now = datetime.utcnow()
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id, UserSession.expires_at > now)
        .order_by(desc(UserSession.created_at))
        .all()
    )
    # Try to identify the caller's session via refresh token in header
    # (not available here, so we mark the most recent session as current)
    if sessions:
        sessions[0].is_current = True
    return sessions


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific session."""
    sess = db.query(UserSession).filter(
        UserSession.id == session_id, UserSession.user_id == current_user.id
    ).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(sess)
    ip = request.client.host if request.client else ""
    _log_activity(db, current_user.id, "revoke_session", f"Revoked session #{session_id}", ip)
    db.commit()
    return {"message": "Session revoked"}


@router.post("/sessions/logout-others")
def logout_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all sessions except the most recent one (current)."""
    now = datetime.utcnow()
    active = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id, UserSession.expires_at > now)
        .order_by(desc(UserSession.created_at))
        .all()
    )
    count = 0
    for i, sess in enumerate(active):
        if i == 0:
            continue  # keep the most recent (current) session
        db.delete(sess)
        count += 1
    ip = request.client.host if request.client else ""
    _log_activity(db, current_user.id, "logout_others", f"Revoked {count} other sessions", ip)
    db.commit()
    return {"message": f"Logged out {count} other sessions"}


# ADMIN: USER MANAGEMENT  (require_admin)

@router.get("/users", response_model=UserList)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    total = db.query(User).count()
    users = db.query(User).order_by(User.id).offset(skip).limit(limit).all()
    return {"users": users, "total": total}


@router.post("/users", response_model=UserSchema, status_code=201)
def create_user(
    user_in: UserCreate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    if user_in.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    existing = db.query(User).filter(
        (User.email == user_in.email) | (User.username == user_in.username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    db_user = User(
        email=user_in.email, username=user_in.username,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name, role=user_in.role,
        is_active=True, is_superuser=user_in.role == "admin",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    ip = request.client.host if request.client else ""
    _log_activity(db, admin.id, "create_user", f"Created user {db_user.username} ({db_user.role})", ip)
    return db_user


@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    body: UserUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user email/name/role/active status (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []
    if body.email is not None and body.email != user.email:
        user.email = body.email
        changes.append(f"email{body.email}")
    if body.full_name is not None:
        user.full_name = body.full_name
        changes.append(f"name{body.full_name}")
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
        user.role = body.role
        user.is_superuser = body.role == "admin"
        changes.append(f"role{body.role}")
    if body.is_active is not None:
        user.is_active = body.is_active
        changes.append(f"active{body.is_active}")

    db.commit()
    db.refresh(user)

    ip = request.client.host if request.client else ""
    _log_activity(db, admin.id, "update_user", f"Updated user #{user_id}: {', '.join(changes)}", ip)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only). Cannot delete self."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = user.username
    db.delete(user)
    db.commit()

    ip = request.client.host if request.client else ""
    _log_activity(db, admin.id, "delete_user", f"Deleted user {username} (#{user_id})", ip)
    return {"message": f"User {username} deleted"}


# OWNER (id=1): LOGIN HISTORY & ACTIVITY LOGS

@router.get("/history/logins", response_model=List[LoginHistoryItem])
def get_login_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user_id: Optional[int] = Query(None),
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Get login history (owner only — HeilKnights account)."""
    q = db.query(LoginHistory).order_by(desc(LoginHistory.created_at))
    if user_id:
        q = q.filter(LoginHistory.user_id == user_id)
    rows = q.offset(skip).limit(limit).all()
    # attach username for display
    result = []
    for r in rows:
        item = LoginHistoryItem.model_validate(r)
        item.username = r.user.username if r.user else None
        result.append(item)
    return result


@router.get("/history/activity", response_model=List[ActivityLogItem])
def get_activity_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user_id: Optional[int] = Query(None),
    owner: User = Depends(require_owner),
    db: Session = Depends(get_db),
):
    """Get activity logs (owner only — HeilKnights account)."""
    q = db.query(ActivityLog).order_by(desc(ActivityLog.created_at))
    if user_id:
        q = q.filter(ActivityLog.user_id == user_id)
    rows = q.offset(skip).limit(limit).all()
    result = []
    for r in rows:
        item = ActivityLogItem.model_validate(r)
        item.username = r.user.username if r.user else None
        result.append(item)
    return result
