from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from app.schemas.schemas import (
    ChatRequest, ChatResponse, SpendingInsightResponse, GoalFeasibilityResponse, ConversationResponse
)
from app.services.ai_service import (
    handle_ai_chat, generate_spending_insights, analyze_goal_feasibility,
    get_user_conversations, get_conversation_with_messages, delete_user_conversation
)

router = APIRouter(tags=["AI & Chat"])

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await handle_ai_chat(db, current_user.id, req.message, req.conversation_id)

@router.get("/chat/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_user_conversations(db, current_user.id)

@router.get("/chat/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv = await get_conversation_with_messages(db, current_user.id, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/chat/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success = await delete_user_conversation(db, current_user.id, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")

@router.post("/ai/spending-insights", response_model=SpendingInsightResponse)
async def get_spending_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await generate_spending_insights(db, current_user.id)

@router.post("/ai/goal-feasibility/{goal_id}", response_model=GoalFeasibilityResponse)
async def get_goal_feasibility(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        return await analyze_goal_feasibility(db, current_user.id, goal_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
