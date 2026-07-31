from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Account
from app.schemas.schemas import AccountCreate, AccountUpdate, AccountResponse

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountResponse])
async def list_accounts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Account).where(Account.user_id == current_user.id)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(acc_in: AccountCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    acc = Account(user_id=current_user.id, **acc_in.model_dump())
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc

@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(account_id: str, acc_in: AccountUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Account).where(and_(Account.id == account_id, Account.user_id == current_user.id))
    res = await db.execute(stmt)
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    for k, v in acc_in.model_dump(exclude_unset=True).items():
        setattr(acc, k, v)

    await db.commit()
    await db.refresh(acc)
    return acc

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Account).where(and_(Account.id == account_id, Account.user_id == current_user.id))
    res = await db.execute(stmt)
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    await db.delete(acc)
    await db.commit()
    return None
