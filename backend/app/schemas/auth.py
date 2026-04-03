from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


SYSTEM_ROLES = {"developer", "admin", "user"}
VALID_ROLES = SYSTEM_ROLES

ERP_MODULES = [
    "dashboard",
    "reports",
    "garments",
    "sales",
    "financial",
    "procurement",
    "manufacturing",
    "user_management",
]

PERMISSION_ACTIONS = ["view", "create", "update", "delete"]


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: str = "user"


class UserCreate(UserBase):
    password: str
    module_access: List[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    module_access: Optional[List[str]] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None


class PreferencesUpdate(BaseModel):
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
    role_priority: int = 10
    permissions: List[str] = Field(default_factory=list)
    module_access: List[str] = Field(default_factory=list)
    is_developer: bool = False
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


class PermissionItem(BaseModel):
    id: int
    module: str
    action: str
    code: str
    description: Optional[str] = None


class RoleBase(BaseModel):
    name: str
    priority: int = 20
    description: Optional[str] = None


class RoleCreate(RoleBase):
    permission_codes: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    priority: Optional[int] = None
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None


class RoleItem(RoleBase):
    id: int
    is_system: bool
    is_developer: bool
    permissions: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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
