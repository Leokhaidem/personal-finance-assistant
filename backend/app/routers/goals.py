from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Goal
from app.schemas.schemas import GoalCreate, GoalUpdate, GoalResponse

router = APIRouter(prefix="/goals", tags=["Goals"])

@router.get("", response_model=List[GoalResponse])
async def list_goals(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Goal).where(Goal.user_id == current_user.id)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(g_in: GoalCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    goal = Goal(user_id=current_user.id, **g_in.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal

@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(goal_id: str, g_in: GoalUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Goal).where(and_(Goal.id == goal_id, Goal.user_id == current_user.id))
    goal = (await db.execute(stmt)).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    for k, v in g_in.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)

    await db.commit()
    await db.refresh(goal)
    return goal

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(goal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Goal).where(and_(Goal.id == goal_id, Goal.user_id == current_user.id))
    goal = (await db.execute(stmt)).scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    await db.delete(goal)
    await db.commit()
    return None
