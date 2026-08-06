import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

# Import models module so SQLAlchemy registers all tables
from app.models import models

from app.routers import (
    auth, documents, accounts, transactions, budgets, goals, bills, notes, dashboard, chat, admin
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finance_app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup complete.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="RAG Personal Finance Assistant API powered by Gemini 3 Flash and ChromaDB",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred.",
            "path": str(request.url.path)
        }
    )

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(bills.router)
app.include_router(notes.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "health": "/health",
        "status": "online"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
