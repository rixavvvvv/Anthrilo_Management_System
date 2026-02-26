from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


# ─── Role enum values ───────────────────────────────────────────────────────
VALID_ROLES = {"admin", "manager", "staff"}


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: str = "staff"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ProfileUpdate(BaseModel):
    """Self-service profile update (name only — email is read-only for non-admins)."""
    full_name: Optional[str] = None


class PreferencesUpdate(BaseModel):
    """Account settings / preferences."""
    full_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    email_notifications: Optional[bool] = None


class UserLogin(BaseModel):
    username: str
    password: str


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


class User(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    last_login: Optional[datetime] = None
    timezone: Optional[str] = "Asia/Kolkata"
    language: Optional[str] = "en"
    email_notifications: Optional[bool] = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserList(BaseModel):
    users: List[User]
    total: int


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[int] = None
    role: Optional[str] = None
    exp: Optional[int] = None
    type: Optional[str] = None


class SessionItem(BaseModel):
    id: int
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_label: Optional[str] = None
    is_current: bool = False
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


class LoginHistoryItem(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogItem(BaseModel):
    id: int
    user_id: int
    username: Optional[str] = None
    action: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
