from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Transaction, Account, TransactionType
from app.schemas.schemas import TransactionCreate, TransactionUpdate, TransactionResponse, BulkDeleteTransactionsRequest

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    category: Optional[str] = None,
    type: Optional[TransactionType] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conditions = [Transaction.user_id == current_user.id]
    if category:
        conditions.append(Transaction.category == category)
    if type:
        conditions.append(Transaction.type == type)
    if date_from:
        conditions.append(Transaction.date >= date_from)
    if date_to:
        conditions.append(Transaction.date <= date_to)

    stmt = select(Transaction).where(and_(*conditions)).order_by(Transaction.date.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify account belongs to user
    acc_stmt = select(Account).where(and_(Account.id == tx_in.account_id, Account.user_id == current_user.id))
    acc = (await db.execute(acc_stmt)).scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=400, detail="Invalid account_id")

    tx = Transaction(user_id=current_user.id, **tx_in.model_dump())
    db.add(tx)

    # Update account balance
    if tx.type == TransactionType.INCOME:
        acc.balance += tx.amount
    else:
        acc.balance -= tx.amount

    await db.commit()
    await db.refresh(tx)
    return tx

@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    tx_in: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Transaction).where(and_(Transaction.id == transaction_id, Transaction.user_id == current_user.id))
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for k, v in tx_in.model_dump(exclude_unset=True).items():
        setattr(tx, k, v)

    await db.commit()
    await db.refresh(tx)
    return tx

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Transaction).where(and_(Transaction.id == transaction_id, Transaction.user_id == current_user.id))
    tx = (await db.execute(stmt)).scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Revert account balance
    acc_stmt = select(Account).where(and_(Account.id == tx.account_id, Account.user_id == current_user.id))
    acc = (await db.execute(acc_stmt)).scalar_one_or_none()
    if acc:
        if tx.type == TransactionType.INCOME:
            acc.balance -= tx.amount
        else:
            acc.balance += tx.amount

    await db.delete(tx)
    await db.commit()
    return None

@router.post("/bulk-delete")
async def bulk_delete_transactions(
    req: BulkDeleteTransactionsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not req.transaction_ids:
        return {"deleted_count": 0}

    stmt = select(Transaction).where(and_(Transaction.id.in_(req.transaction_ids), Transaction.user_id == current_user.id))
    txs = (await db.execute(stmt)).scalars().all()

    # Pre-fetch affected accounts
    account_ids = {t.account_id for t in txs if t.account_id}
    acc_stmt = select(Account).where(and_(Account.id.in_(account_ids), Account.user_id == current_user.id))
    accounts = (await db.execute(acc_stmt)).scalars().all()
    account_map = {a.id: a for a in accounts}

    deleted_count = 0
    for tx in txs:
        acc = account_map.get(tx.account_id)
        if acc:
            if tx.type == TransactionType.INCOME:
                acc.balance -= tx.amount
            else:
                acc.balance += tx.amount
        await db.delete(tx)
        deleted_count += 1

    await db.commit()
    return {"deleted_count": deleted_count}
