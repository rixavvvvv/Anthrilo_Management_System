from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Anthrilo Management System"

    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str = ""

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Unicommerce API Configuration
    UNICOMMERCE_TENANT: str = ""
    UNICOMMERCE_ACCESS_CODE: str = ""
    UNICOMMERCE_USERNAME: str = ""
    UNICOMMERCE_PASSWORD: str = ""
    UNICOMMERCE_ACCESS_TOKEN: str = ""
    UNICOMMERCE_REFRESH_TOKEN: str = ""
    UNICOMMERCE_BASE_URL: str = "https://{tenant}.unicommerce.com/services/rest/v1"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
