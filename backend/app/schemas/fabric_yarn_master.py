from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class FabricYarnMasterBase(BaseModel):
    yarn: str
    yarn_percentage: Decimal
    yarn_price: Decimal
    fabric_type: str
    print: str
    fabric_ready_time: str

    @field_validator("yarn")
    @classmethod
    def validate_yarn(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("Yarn is required")
        return value

    @field_validator("fabric_type")
    @classmethod
    def validate_fabric_type(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("Fabric type is required")
        return value

    @field_validator("print")
    @classmethod
    def validate_print(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("Print is required")
        return value

    @field_validator("fabric_ready_time")
    @classmethod
    def validate_ready_time(cls, v: str) -> str:
        value = (v or "").strip()
        if not value:
            raise ValueError("Fabric ready time is required")
        return value

    @field_validator("yarn_percentage", mode="before")
    @classmethod
    def validate_yarn_percentage(cls, v):
        if v is None or v == "":
            raise ValueError("Yarn percentage is required")
        try:
            val = Decimal(str(v))
        except Exception as exc:
            raise ValueError("Yarn percentage must be numeric") from exc
        if val < 0 or val > 100:
            raise ValueError("Yarn percentage must be between 0 and 100")
        return val

    @field_validator("yarn_price", mode="before")
    @classmethod
    def validate_yarn_price(cls, v):
        if v is None or v == "":
            raise ValueError("Yarn price is required")
        try:
            val = Decimal(str(v))
        except Exception as exc:
            raise ValueError("Yarn price must be numeric") from exc
        if val < 0:
            raise ValueError("Yarn price cannot be negative")
        return val


class FabricYarnMasterCreate(FabricYarnMasterBase):
    pass


class FabricYarnMasterUpdate(BaseModel):
    yarn: Optional[str] = None
    yarn_percentage: Optional[Decimal] = None
    yarn_price: Optional[Decimal] = None
    fabric_type: Optional[str] = None
    print: Optional[str] = None
    fabric_ready_time: Optional[str] = None


class FabricYarnMaster(FabricYarnMasterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FabricYarnMasterImportRow(BaseModel):
    yarn: str
    yarn_percentage: Decimal
    yarn_price: Decimal
    fabric_type: str
    print: str
    fabric_ready_time: str


class FabricYarnMasterImportRequest(BaseModel):
    rows: list[FabricYarnMasterImportRow]
    skip_duplicates: bool = True


class FabricYarnMasterImportError(BaseModel):
    row: int
    error: str


class FabricYarnMasterImportSummary(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    imported_rows: int
    failed_rows: int
    errors: list[FabricYarnMasterImportError]
