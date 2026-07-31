from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.models import User, Document, Transaction
from app.schemas.schemas import UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=List[UserResponse])
async def list_all_users(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(User).order_by(User.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/stats")
async def get_system_stats(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_docs = (await db.execute(select(func.count(Document.id)))).scalar_one()
    total_txs = (await db.execute(select(func.count(Transaction.id)))).scalar_one()

    return {
        "total_users": total_users,
        "total_documents": total_docs,
        "total_transactions": total_txs
    }
