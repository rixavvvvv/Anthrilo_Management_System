"""Universal Ads Management API."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sa_func
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator
import csv
import io
import logging

from app.db.session import get_db
from app.db.models import AdsData, AdsExtraMetric
from app.services.cache_service import CacheService

router = APIRouter()
logger = logging.getLogger(__name__)

# Supported advertising channels
CHANNELS = [
    "Amazon", "Flipkart", "Myntra", "Meesho", "Ajio",
    "Nykaa", "Snapdeal", "JioMart", "Tata_CLiQ", "FirstCry",
    "Google_Ads", "Meta_Ads", "Other",
]

BRANDS = ["Anthrilo", "Other"]


# --- Pydantic Schemas ---

class ExtraMetricIn(BaseModel):
    metric_name: str
    metric_value: Decimal

class AdsDataCreate(BaseModel):
    date: date
    channel: str
    brand: str
    campaign_name: Optional[str] = None
    impressions: int = 0
    clicks: int = 0
    cpc: Optional[Decimal] = None
    spend: Decimal = Decimal("0")
    spend_with_tax: Optional[Decimal] = None
    ads_sale: Decimal = Decimal("0")
    total_sale: Decimal = Decimal("0")
    units_sold: int = 0
    extra_metrics: list[ExtraMetricIn] = []

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        if v not in CHANNELS:
            raise ValueError(f"Invalid channel. Must be one of: {', '.join(CHANNELS)}")
        return v


class ExtraMetricOut(BaseModel):
    id: int
    metric_name: str
    metric_value: Decimal

    class Config:
        from_attributes = True


class AdsDataOut(BaseModel):
    id: int
    date: date
    channel: str
    brand: str
    campaign_name: Optional[str]
    impressions: int
    clicks: int
    cpc: Optional[Decimal]
    spend: Decimal
    spend_with_tax: Optional[Decimal]
    ads_sale: Decimal
    total_sale: Decimal
    units_sold: int
    acos: Optional[Decimal]
    tacos: Optional[Decimal]
    roas: Optional[Decimal]
    roi: Optional[Decimal]
    extra_metrics: list[ExtraMetricOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Helpers ---

def compute_metrics(spend: Decimal, ads_sale: Decimal, total_sale: Decimal) -> dict:
    """Compute ACOS, TACOS, ROAS, ROI from core values."""
    acos = round(spend / ads_sale * 100, 2) if ads_sale else None
    tacos = round(spend / total_sale * 100, 2) if total_sale else None
    roas = round(ads_sale / spend, 2) if spend else None
    roi = round((ads_sale - spend) / spend, 2) if spend else None
    return {"acos": acos, "tacos": tacos, "roas": roas, "roi": roi}


# --- POST /api/v1/ads/ ---

@router.post("/", response_model=AdsDataOut, status_code=201)
def create_ads_entry(payload: AdsDataCreate, db: Session = Depends(get_db)):
    """Create a new ads data entry with auto-calculated metrics."""
    metrics = compute_metrics(payload.spend, payload.ads_sale, payload.total_sale)

    row = AdsData(
        date=payload.date,
        channel=payload.channel,
        brand=payload.brand,
        campaign_name=payload.campaign_name,
        impressions=payload.impressions,
        clicks=payload.clicks,
        cpc=payload.cpc,
        spend=payload.spend,
        spend_with_tax=payload.spend_with_tax,
        ads_sale=payload.ads_sale,
        total_sale=payload.total_sale,
        units_sold=payload.units_sold,
        **metrics,
    )
    db.add(row)
    db.flush()

    for em in payload.extra_metrics:
        db.add(AdsExtraMetric(
            ads_data_id=row.id,
            metric_name=em.metric_name,
            metric_value=em.metric_value,
        ))

    db.commit()
    db.refresh(row)
    CacheService.invalidate_ads_cache()
    return row


# --- GET /api/v1/ads/ ---

@router.get("/")
def list_ads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    channel: Optional[str] = None,
    brand: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """List ads data with pagination, filtering, and extra metrics."""
    cache_key = f"ads:list:{page}:{page_size}:{channel}:{brand}:{start_date}:{end_date}"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    q = db.query(AdsData).options(joinedload(AdsData.extra_metrics))
    if channel:
        q = q.filter(AdsData.channel == channel)
    if brand:
        q = q.filter(AdsData.brand == brand)
    if start_date:
        q = q.filter(AdsData.date >= start_date)
    if end_date:
        q = q.filter(AdsData.date <= end_date)

    total = q.count()
    rows = q.order_by(AdsData.date.desc(), AdsData.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [AdsDataOut.from_orm(r).model_dump(mode="json") for r in rows]
    result = {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
    CacheService.set(cache_key, result, CacheService.TTL_SHORT)
    return result


# --- GET /api/v1/ads/{id} ---

@router.get("/{ads_id}", response_model=AdsDataOut)
def get_ads_entry(ads_id: int, db: Session = Depends(get_db)):
    """Get a single ads entry by ID."""
    row = db.query(AdsData).options(joinedload(AdsData.extra_metrics)).filter(AdsData.id == ads_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ads entry not found")
    return row


# --- PUT /api/v1/ads/{id} ---

@router.put("/{ads_id}", response_model=AdsDataOut)
def update_ads_entry(ads_id: int, payload: AdsDataCreate, db: Session = Depends(get_db)):
    """Update an existing ads entry."""
    row = db.query(AdsData).filter(AdsData.id == ads_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ads entry not found")

    metrics = compute_metrics(payload.spend, payload.ads_sale, payload.total_sale)

    for field in ["date", "channel", "brand", "campaign_name", "impressions", "clicks",
                  "cpc", "spend", "spend_with_tax", "ads_sale", "total_sale", "units_sold"]:
        setattr(row, field, getattr(payload, field))
    for k, v in metrics.items():
        setattr(row, k, v)

    # Replace extra metrics
    db.query(AdsExtraMetric).filter(AdsExtraMetric.ads_data_id == ads_id).delete()
    for em in payload.extra_metrics:
        db.add(AdsExtraMetric(ads_data_id=ads_id, metric_name=em.metric_name, metric_value=em.metric_value))

    db.commit()
    db.refresh(row)
    CacheService.invalidate_ads_cache()
    return row


# --- DELETE /api/v1/ads/{id} ---

@router.delete("/{ads_id}", status_code=204)
def delete_ads_entry(ads_id: int, db: Session = Depends(get_db)):
    """Delete an ads entry."""
    row = db.query(AdsData).filter(AdsData.id == ads_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ads entry not found")
    db.delete(row)
    db.commit()
    CacheService.invalidate_ads_cache()


# --- GET /api/v1/ads/summary/mtd ---

@router.get("/summary/mtd")
def get_mtd_summary(
    brand: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Month-to-date aggregated metrics."""
    today = date.today()
    first_of_month = today.replace(day=1)

    cache_key = f"ads:mtd:{today}:{brand}"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    q = db.query(
        sa_func.sum(AdsData.spend).label("total_spend"),
        sa_func.sum(AdsData.spend_with_tax).label("total_spend_with_tax"),
        sa_func.sum(AdsData.ads_sale).label("total_ads_sale"),
        sa_func.sum(AdsData.total_sale).label("total_total_sale"),
        sa_func.sum(AdsData.units_sold).label("total_units"),
        sa_func.sum(AdsData.impressions).label("total_impressions"),
        sa_func.sum(AdsData.clicks).label("total_clicks"),
        sa_func.count(AdsData.id).label("entry_count"),
    ).filter(AdsData.date >= first_of_month, AdsData.date <= today)

    if brand:
        q = q.filter(AdsData.brand == brand)

    row = q.one()
    spend = float(row.total_spend or 0)
    ads_sale = float(row.total_ads_sale or 0)
    total_sale = float(row.total_total_sale or 0)

    result = {
        "period": f"{first_of_month.isoformat()} to {today.isoformat()}",
        "total_spend": round(spend, 2),
        "total_spend_with_tax": round(float(row.total_spend_with_tax or 0), 2),
        "total_ads_sale": round(ads_sale, 2),
        "total_total_sale": round(total_sale, 2),
        "total_units": int(row.total_units or 0),
        "total_impressions": int(row.total_impressions or 0),
        "total_clicks": int(row.total_clicks or 0),
        "entry_count": int(row.entry_count or 0),
        "acos": round(spend / ads_sale * 100, 2) if ads_sale else None,
        "tacos": round(spend / total_sale * 100, 2) if total_sale else None,
        "roas": round(ads_sale / spend, 2) if spend else None,
        "roi": round((ads_sale - spend) / spend, 2) if spend else None,
        "ctr": round(int(row.total_clicks or 0) / int(row.total_impressions or 1) * 100, 2)
               if int(row.total_impressions or 0) > 0 else None,
    }
    CacheService.set(cache_key, result, CacheService.TTL_SHORT)
    return result


# --- GET /api/v1/ads/summary/channel/{channel} ---

@router.get("/summary/channel/{channel}")
def get_channel_performance(
    channel: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Aggregated performance for a specific channel."""
    q = db.query(
        AdsData.date,
        sa_func.sum(AdsData.spend).label("spend"),
        sa_func.sum(AdsData.ads_sale).label("ads_sale"),
        sa_func.sum(AdsData.total_sale).label("total_sale"),
        sa_func.sum(AdsData.units_sold).label("units"),
        sa_func.sum(AdsData.impressions).label("impressions"),
        sa_func.sum(AdsData.clicks).label("clicks"),
    ).filter(AdsData.channel == channel)

    if start_date:
        q = q.filter(AdsData.date >= start_date)
    if end_date:
        q = q.filter(AdsData.date <= end_date)

    rows = q.group_by(AdsData.date).order_by(AdsData.date.desc()).all()

    daily = []
    for r in rows:
        sp = float(r.spend or 0)
        ad_s = float(r.ads_sale or 0)
        ts = float(r.total_sale or 0)
        daily.append({
            "date": r.date.isoformat(),
            "spend": round(sp, 2),
            "ads_sale": round(ad_s, 2),
            "total_sale": round(ts, 2),
            "units": int(r.units or 0),
            "impressions": int(r.impressions or 0),
            "clicks": int(r.clicks or 0),
            "acos": round(sp / ad_s * 100, 2) if ad_s else None,
            "tacos": round(sp / ts * 100, 2) if ts else None,
            "roas": round(ad_s / sp, 2) if sp else None,
        })

    total_spend = sum(d["spend"] for d in daily)
    total_ads_sale = sum(d["ads_sale"] for d in daily)
    total_total_sale = sum(d["total_sale"] for d in daily)

    return {
        "channel": channel,
        "daily": daily,
        "totals": {
            "spend": round(total_spend, 2),
            "ads_sale": round(total_ads_sale, 2),
            "total_sale": round(total_total_sale, 2),
            "units": sum(d["units"] for d in daily),
            "acos": round(total_spend / total_ads_sale * 100, 2) if total_ads_sale else None,
            "tacos": round(total_spend / total_total_sale * 100, 2) if total_total_sale else None,
            "roas": round(total_ads_sale / total_spend, 2) if total_spend else None,
        },
    }


# --- GET /api/v1/ads/summary/all-channels ---

@router.get("/summary/all-channels")
def get_all_channels_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    brand: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Aggregated performance across all channels."""
    cache_key = f"ads:channels:{start_date}:{end_date}:{brand}"
    cached = CacheService.get(cache_key)
    if cached:
        return cached

    q = db.query(
        AdsData.channel,
        sa_func.sum(AdsData.spend).label("spend"),
        sa_func.sum(AdsData.ads_sale).label("ads_sale"),
        sa_func.sum(AdsData.total_sale).label("total_sale"),
        sa_func.sum(AdsData.units_sold).label("units"),
        sa_func.sum(AdsData.impressions).label("impressions"),
        sa_func.sum(AdsData.clicks).label("clicks"),
        sa_func.count(AdsData.id).label("entries"),
    )
    if start_date:
        q = q.filter(AdsData.date >= start_date)
    if end_date:
        q = q.filter(AdsData.date <= end_date)
    if brand:
        q = q.filter(AdsData.brand == brand)

    rows = q.group_by(AdsData.channel).all()

    channels = []
    for r in rows:
        sp = float(r.spend or 0)
        ad_s = float(r.ads_sale or 0)
        ts = float(r.total_sale or 0)
        channels.append({
            "channel": r.channel,
            "spend": round(sp, 2),
            "ads_sale": round(ad_s, 2),
            "total_sale": round(ts, 2),
            "units": int(r.units or 0),
            "impressions": int(r.impressions or 0),
            "clicks": int(r.clicks or 0),
            "entries": int(r.entries or 0),
            "acos": round(sp / ad_s * 100, 2) if ad_s else None,
            "roas": round(ad_s / sp, 2) if sp else None,
        })

    channels.sort(key=lambda c: c["spend"], reverse=True)

    result = {"channels": channels}
    CacheService.set(cache_key, result, CacheService.TTL_SHORT)
    return result


# --- POST /api/v1/ads/import ---

COLUMN_MAP = {
    "date": "date",
    "channel": "channel",
    "brand": "brand",
    "campaign": "campaign_name",
    "campaign name": "campaign_name",
    "campaignname": "campaign_name",
    "impressions": "impressions",
    "impression": "impressions",
    "clicks": "clicks",
    "click": "clicks",
    "cpc": "cpc",
    "spend": "spend",
    "ad spend": "spend",
    "adspend": "spend",
    "cost": "spend",
    "spend with tax": "spend_with_tax",
    "spendwithtax": "spend_with_tax",
    "ads sale": "ads_sale",
    "ad sales": "ads_sale",
    "adsales": "ads_sale",
    "adssale": "ads_sale",
    "total sale": "total_sale",
    "total sales": "total_sale",
    "totalsale": "total_sale",
    "totalsales": "total_sale",
    "units sold": "units_sold",
    "unitssold": "units_sold",
    "units": "units_sold",
    "quantity": "units_sold",
}

INT_FIELDS = {"impressions", "clicks", "units_sold"}
DECIMAL_FIELDS = {"cpc", "spend", "spend_with_tax", "ads_sale", "total_sale"}
REQUIRED_FIELDS = {"date", "channel", "spend", "ads_sale", "total_sale"}


@router.post("/import")
async def import_ads_csv(
    file: UploadFile = File(...),
    default_brand: str = Query("Anthrilo"),
    db: Session = Depends(get_db),
):
    """Import ads data from a CSV file with automatic column mapping."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no headers.")

    # Build mapping from CSV columns to our fields
    mapping: dict[str, str] = {}
    for col in reader.fieldnames:
        normalized = col.strip().lower().replace("_", " ")
        if normalized in COLUMN_MAP:
            mapping[col] = COLUMN_MAP[normalized]

    # Check required fields are mappable
    mapped_fields = set(mapping.values())
    missing = REQUIRED_FIELDS - mapped_fields
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing)}. "
                   f"Mapped: {dict(mapping)}",
        )

    imported = 0
    errors: list[dict] = []

    for i, csv_row in enumerate(reader, start=2):
        try:
            row_data: dict = {}
            for csv_col, field in mapping.items():
                raw = (csv_row.get(csv_col) or "").strip()
                if not raw:
                    continue
                if field == "date":
                    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
                        try:
                            row_data["date"] = datetime.strptime(raw, fmt).date()
                            break
                        except ValueError:
                            continue
                elif field in INT_FIELDS:
                    row_data[field] = int(float(raw.replace(",", "")))
                elif field in DECIMAL_FIELDS:
                    row_data[field] = Decimal(raw.replace(",", ""))
                else:
                    row_data[field] = raw

            if "date" not in row_data:
                errors.append({"row": i, "error": "Missing or unparseable date"})
                continue
            if "channel" not in row_data:
                errors.append({"row": i, "error": "Missing channel"})
                continue

            row_data.setdefault("brand", default_brand)
            row_data.setdefault("spend", Decimal("0"))
            row_data.setdefault("ads_sale", Decimal("0"))
            row_data.setdefault("total_sale", Decimal("0"))
            row_data.setdefault("units_sold", 0)
            row_data.setdefault("impressions", 0)
            row_data.setdefault("clicks", 0)

            computed = compute_metrics(
                row_data["spend"], row_data["ads_sale"], row_data["total_sale"]
            )
            row_data.update(computed)

            db.add(AdsData(**row_data))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    db.commit()
    CacheService.invalidate_ads_cache()

    return {
        "imported": imported,
        "errors": errors[:50],
        "total_errors": len(errors),
        "column_mapping": mapping,
    }


# --- Metadata endpoints ---

@router.get("/meta/channels")
def get_channels():
    """Return supported channel list."""
    return {"channels": CHANNELS}

@router.get("/meta/brands")
def get_brands():
    """Return supported brand list."""
    return {"brands": BRANDS}
