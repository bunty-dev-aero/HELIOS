import os
APP_NAME = "HELIOS API"
APP_VERSION = "0.1.0"
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./helios.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
