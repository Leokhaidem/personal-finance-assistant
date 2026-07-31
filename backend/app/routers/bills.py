from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Bill
from app.schemas.schemas import BillCreate, BillUpdate, BillResponse

router = APIRouter(prefix="/bills", tags=["Bills"])

@router.get("", response_model=List[BillResponse])
async def list_bills(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Bill).where(Bill.user_id == current_user.id).order_by(Bill.due_date.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/upcoming", response_model=List[BillResponse])
async def list_upcoming_bills(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    target_date = today + timedelta(days=days)
    stmt = select(Bill).where(
        and_(
            Bill.user_id == current_user.id,
            Bill.due_date >= today,
            Bill.due_date <= target_date
        )
    ).order_by(Bill.due_date.asc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(b_in: BillCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    bill = Bill(user_id=current_user.id, **b_in.model_dump())
    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill

@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(bill_id: str, b_in: BillUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Bill).where(and_(Bill.id == bill_id, Bill.user_id == current_user.id))
    bill = (await db.execute(stmt)).scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    for k, v in b_in.model_dump(exclude_unset=True).items():
        setattr(bill, k, v)

    await db.commit()
    await db.refresh(bill)
    return bill

@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(bill_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Bill).where(and_(Bill.id == bill_id, Bill.user_id == current_user.id))
    bill = (await db.execute(stmt)).scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    await db.delete(bill)
    await db.commit()
    return None
