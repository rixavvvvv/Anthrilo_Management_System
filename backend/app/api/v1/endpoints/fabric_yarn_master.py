from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from app.db.models import FabricYarnMaster
from app.db.session import get_db
from app.schemas.fabric_yarn_master import (
    FabricYarnMaster as FabricYarnMasterSchema,
    FabricYarnMasterCreate,
    FabricYarnMasterImportError,
    FabricYarnMasterImportRequest,
    FabricYarnMasterImportSummary,
    FabricYarnMasterUpdate,
)
from app.services.cache_service import CacheService

router = APIRouter()

CACHE_PREFIX = "fabric_yarn_master"


def _invalidate_cache() -> None:
    try:
        CacheService.delete_pattern(f"{CACHE_PREFIX}:*")
    except Exception:
        pass


def _normalize_str(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _is_duplicate_record(db: Session, payload: dict, exclude_id: Optional[int] = None) -> bool:
    query = db.query(FabricYarnMaster).filter(
        FabricYarnMaster.yarn == payload["yarn"],
        FabricYarnMaster.yarn_percentage == payload["yarn_percentage"],
        FabricYarnMaster.yarn_price == payload["yarn_price"],
        FabricYarnMaster.fabric_type == payload["fabric_type"],
        FabricYarnMaster.print == payload["print"],
        FabricYarnMaster.fabric_ready_time == payload["fabric_ready_time"],
    )
    if exclude_id is not None:
        query = query.filter(FabricYarnMaster.id != exclude_id)
    return db.query(query.exists()).scalar()


@router.get("/", response_model=dict)
def list_fabric_yarn_master(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    search: Optional[str] = None,
    sort_by: str = Query("id"),
    sort_order: str = Query("desc"),
    fabric_type: Optional[str] = None,
    print_value: Optional[str] = Query(None, alias="print"),
    db: Session = Depends(get_db),
):
    cache_key = f"{CACHE_PREFIX}:list:{skip}:{limit}:{search}:{sort_by}:{sort_order}:{fabric_type}:{print_value}"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    query = db.query(FabricYarnMaster)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                FabricYarnMaster.yarn.ilike(term),
                FabricYarnMaster.fabric_type.ilike(term),
                FabricYarnMaster.print.ilike(term),
                FabricYarnMaster.fabric_ready_time.ilike(term),
            )
        )

    if fabric_type:
        query = query.filter(FabricYarnMaster.fabric_type == fabric_type)
    if print_value:
        query = query.filter(FabricYarnMaster.print == print_value)

    total = query.count()

    allowed_sort = {
        "id",
        "yarn",
        "yarn_percentage",
        "yarn_price",
        "fabric_type",
        "print",
        "fabric_ready_time",
        "created_at",
    }
    if sort_by not in allowed_sort:
        sort_by = "id"

    sort_col = getattr(FabricYarnMaster, sort_by)
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    items = query.offset(skip).limit(limit).all()

    result = {
        "items": [FabricYarnMasterSchema.from_orm(item).model_dump(mode="json") for item in items],
        "total": total,
        "page": (skip // limit) + 1,
        "page_size": limit,
        "total_pages": max(1, -(-total // limit)),
    }
    CacheService.set(cache_key, result, CacheService.TTL_MEDIUM)
    return result


@router.get("/meta/filter-options", response_model=dict)
def get_fabric_yarn_filter_options(db: Session = Depends(get_db)):
    cache_key = f"{CACHE_PREFIX}:filter_options"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    def distinct_vals(col):
        return sorted([r[0] for r in db.query(col).distinct().all() if r[0]])

    result = {
        "fabric_types": distinct_vals(FabricYarnMaster.fabric_type),
        "prints": distinct_vals(FabricYarnMaster.print),
        "yarns": distinct_vals(FabricYarnMaster.yarn),
    }
    CacheService.set(cache_key, result, CacheService.TTL_MEDIUM)
    return result


@router.post("/", response_model=FabricYarnMasterSchema, status_code=status.HTTP_201_CREATED)
def create_fabric_yarn_master(payload: FabricYarnMasterCreate, db: Session = Depends(get_db)):
    create_data = payload.model_dump()
    if _is_duplicate_record(db, create_data):
        raise HTTPException(status_code=400, detail="Duplicate fabric & yarn master record")

    row = FabricYarnMaster(**create_data)
    db.add(row)
    db.commit()
    db.refresh(row)
    _invalidate_cache()
    return row


@router.put("/{record_id}", response_model=FabricYarnMasterSchema)
def update_fabric_yarn_master(record_id: int, payload: FabricYarnMasterUpdate, db: Session = Depends(get_db)):
    row = db.query(FabricYarnMaster).filter(FabricYarnMaster.id == record_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fabric & Yarn record not found")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return row

    merged = {
        "yarn": update_data.get("yarn", row.yarn),
        "yarn_percentage": update_data.get("yarn_percentage", row.yarn_percentage),
        "yarn_price": update_data.get("yarn_price", row.yarn_price),
        "fabric_type": update_data.get("fabric_type", row.fabric_type),
        "print": update_data.get("print", row.print),
        "fabric_ready_time": update_data.get("fabric_ready_time", row.fabric_ready_time),
    }
    if _is_duplicate_record(db, merged, exclude_id=record_id):
        raise HTTPException(status_code=400, detail="Duplicate fabric & yarn master record")

    for field, value in update_data.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    _invalidate_cache()
    return row


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fabric_yarn_master(record_id: int, db: Session = Depends(get_db)):
    row = db.query(FabricYarnMaster).filter(FabricYarnMaster.id == record_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Fabric & Yarn record not found")

    db.delete(row)
    db.commit()
    _invalidate_cache()
    return None


@router.post("/import", response_model=FabricYarnMasterImportSummary)
def import_fabric_yarn_master(payload: FabricYarnMasterImportRequest, db: Session = Depends(get_db)):
    total_rows = len(payload.rows)
    errors: list[FabricYarnMasterImportError] = []
    imported_rows = 0
    invalid_rows = 0

    existing_signatures = {
        (
            _normalize_str(item.yarn),
            float(item.yarn_percentage),
            float(item.yarn_price),
            _normalize_str(item.fabric_type),
            _normalize_str(item.print),
            _normalize_str(item.fabric_ready_time),
        )
        for item in db.query(FabricYarnMaster).all()
    }
    seen_in_file = set()

    for idx, row in enumerate(payload.rows, start=1):
        data = row.model_dump()
        signature = (
            _normalize_str(data["yarn"]),
            float(data["yarn_percentage"]),
            float(data["yarn_price"]),
            _normalize_str(data["fabric_type"]),
            _normalize_str(data["print"]),
            _normalize_str(data["fabric_ready_time"]),
        )

        if signature in seen_in_file:
            invalid_rows += 1
            errors.append(FabricYarnMasterImportError(row=idx, error="Duplicate row in file"))
            continue

        if signature in existing_signatures:
            if payload.skip_duplicates:
                invalid_rows += 1
                errors.append(FabricYarnMasterImportError(row=idx, error="Duplicate record already exists"))
                continue
            invalid_rows += 1
            errors.append(FabricYarnMasterImportError(row=idx, error="Duplicate record already exists"))
            continue

        db.add(FabricYarnMaster(**data))
        seen_in_file.add(signature)
        existing_signatures.add(signature)
        imported_rows += 1

    if imported_rows > 0:
        db.commit()
        _invalidate_cache()
    else:
        db.rollback()

    failed_rows = invalid_rows
    valid_rows = total_rows - invalid_rows

    return FabricYarnMasterImportSummary(
        total_rows=total_rows,
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        imported_rows=imported_rows,
        failed_rows=failed_rows,
        errors=errors,
    )
