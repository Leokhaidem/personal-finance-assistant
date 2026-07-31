from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Budget, Transaction, TransactionType
from app.schemas.schemas import BudgetCreate, BudgetUpdate, BudgetResponse

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.get("", response_model=List[BudgetResponse])
async def list_budgets(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Budget).where(Budget.user_id == current_user.id)
    res = await db.execute(stmt)
    budgets = res.scalars().all()

    today = date.today()
    out = []
    for b in budgets:
        # compute spent for this category in month
        try:
            year, month = map(int, b.month.split("-"))
            m_start = date(year, month, 1)
            m_end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
            
            exp_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
                and_(
                    Transaction.user_id == current_user.id,
                    Transaction.category == b.category,
                    Transaction.type == TransactionType.EXPENSE,
                    Transaction.date >= m_start,
                    Transaction.date < m_end
                )
            )
            spent = float((await db.execute(exp_stmt)).scalar_one() or 0.0)
        except Exception:
            spent = 0.0

        b_resp = BudgetResponse.model_validate(b)
        b_resp.spent = spent
        out.append(b_resp)

    return out

@router.post("", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(b_in: BudgetCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    b = Budget(user_id=current_user.id, **b_in.model_dump())
    db.add(b)
    await db.commit()
    await db.refresh(b)
    b_resp = BudgetResponse.model_validate(b)
    b_resp.spent = 0.0
    return b_resp

@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: str, b_in: BudgetUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Budget).where(and_(Budget.id == budget_id, Budget.user_id == current_user.id))
    b = (await db.execute(stmt)).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")

    for k, v in b_in.model_dump(exclude_unset=True).items():
        setattr(b, k, v)

    await db.commit()
    await db.refresh(b)
    b_resp = BudgetResponse.model_validate(b)
    b_resp.spent = 0.0
    return b_resp

@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Budget).where(and_(Budget.id == budget_id, Budget.user_id == current_user.id))
    b = (await db.execute(stmt)).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")

    await db.delete(b)
    await db.commit()
    return None
