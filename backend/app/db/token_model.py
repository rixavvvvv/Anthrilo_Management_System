"""
Database model for storing Unicommerce tokens
Alternative to file-based storage for production
"""

from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.db.session import Base


class UnicommerceToken(Base):
    """Store Unicommerce authentication tokens"""
    
    __tablename__ = "unicommerce_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    refresh_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
