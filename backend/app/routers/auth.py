from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    get_password_hash, verify_password, create_access_token, create_refresh_token, get_current_user
)
from app.models.models import User, RefreshToken, Account, AccountType
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, UserResponse, RefreshTokenRequest

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == user_in.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create default accounts for new user
    default_accounts = [
        Account(user_id=new_user.id, name="Primary Bank Account", type=AccountType.BANK, balance=0.0),
        Account(user_id=new_user.id, name="Cash Wallet", type=AccountType.CASH, balance=0.0)
    ]
    db.add_all(default_accounts)
    await db.commit()

    return new_user

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    email = None
    password = None

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Username/Email and Password required")

    stmt = select(User).where(User.email == email)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": user.id, "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": user.id})

    # Save refresh token in DB
    ref_row = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token[-32:],
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
    )
    db.add(ref_row)
    await db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(req: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        from jose import jwt
        from app.core.config import settings
        payload = jwt.decode(req.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access = create_access_token(data={"sub": user.id, "role": user.role.value})
    new_refresh = create_refresh_token(data={"sub": user.id})

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
