from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


class ProductMasterBase(BaseModel):
    sku: str
    name: str
    size: Optional[str] = None
    collection: Optional[str] = None
    type: Optional[str] = None
    season: Optional[str] = None
    fabric_type: Optional[str] = None
    print: Optional[str] = None
    net_weight: Optional[Decimal] = None
    production_time: Optional[int] = None

    @field_validator("net_weight", mode="before")
    @classmethod
    def validate_net_weight(cls, v):
        if v is not None and v != "":
            try:
                val = float(v)
                if val < 0:
                    raise ValueError("Net weight must be non-negative")
                return val
            except (ValueError, TypeError):
                raise ValueError("Net weight must be a number")
        return None

    @field_validator("production_time", mode="before")
    @classmethod
    def validate_production_time(cls, v):
        if v is not None and v != "":
            try:
                val = int(v)
                if val < 0:
                    raise ValueError("Production time must be non-negative")
                return val
            except (ValueError, TypeError):
                raise ValueError("Production time must be an integer (days)")
        return None


class ProductMasterCreate(ProductMasterBase):
    pass


class ProductMasterUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    size: Optional[str] = None
    collection: Optional[str] = None
    type: Optional[str] = None
    season: Optional[str] = None
    fabric_type: Optional[str] = None
    print: Optional[str] = None
    net_weight: Optional[Decimal] = None
    production_time: Optional[int] = None


class ProductMaster(ProductMasterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductImportSummary(BaseModel):
    inserted: int
    skipped: int
    errors: list
