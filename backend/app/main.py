from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS
from app.db import Base, engine

# Register database models
from app import models
from app import checkin_models

# Existing API
from app.api.routes import router

# Ground Control API
from app.api.ground_control import router as ground_control_router

# Crew Check-in and Cognitive Assessment API
from app.api.checkins import router as checkins_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing endpoints
app.include_router(router, prefix="/api/v1")

# Ground Control endpoints
app.include_router(
    ground_control_router,
    prefix="/api/v1",
)

# Crew Check-in and Cognitive Assessment endpoints
app.include_router(
    checkins_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "docs": "/docs",
    }