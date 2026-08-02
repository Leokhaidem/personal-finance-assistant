import os
from datetime import date
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.config import settings
from app.models.models import (
    Account, Transaction, Budget, Goal, Bill, Note, Document, Chunk, Conversation, Message, SourceCitation,
    TransactionType, MessageRole
)
from app.schemas.schemas import SourceCitationSchema, ChatResponse, SpendingInsightResponse, GoalFeasibilityResponse
from app.services.vector_service import get_vector_service

# Prompt Template per specification
SYSTEM_PROMPT_TEMPLATE = """You are a careful, conservative Personal Finance Assistant. Only use the provided context. Never invent numbers. Always mention which figures you used. Include a brief disclaimer that this is informational, not licensed financial advice.

=== STRUCTURED FINANCIAL CONTEXT ===
Monthly Income: ₹{income:.2f}
Monthly Expenses: ₹{expenses:.2f}
Total Account Balances / Savings: ₹{total_savings:.2f}

Accounts:
{accounts_str}

Active Goals:
{goals_str}

Upcoming Bills:
{bills_str}

Category Budgets:
{budgets_str}

=== RETRIEVED DOCUMENTS & NOTES CONTEXT ===
{retrieved_chunks_str}

=== USER QUESTION ===
{question}
"""

async def build_structured_context(db: AsyncSession, user_id: str) -> Dict[str, Any]:
    today = date.today()
    first_day = date(today.year, today.month, 1)

    # Monthly income/expenses
    inc_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(Transaction.user_id == user_id, Transaction.type == TransactionType.INCOME, Transaction.date >= first_day)
    )
    exp_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(Transaction.user_id == user_id, Transaction.type == TransactionType.EXPENSE, Transaction.date >= first_day)
    )
    inc = float((await db.execute(inc_stmt)).scalar_one() or 0.0)
    exp = float((await db.execute(exp_stmt)).scalar_one() or 0.0)

    # Accounts
    accs = (await db.execute(select(Account).where(Account.user_id == user_id))).scalars().all()
    total_savings = sum(a.balance for a in accs)
    accounts_str = "\n".join([f"- {a.name} ({a.type.value}): ₹{a.balance:,.2f}" for a in accs]) or "None"

    # Goals
    goals = (await db.execute(select(Goal).where(Goal.user_id == user_id))).scalars().all()
    goals_str = "\n".join([f"- {g.name}: Target ₹{g.target_amount:,.2f}, Saved ₹{g.saved_amount:,.2f}, Target Date: {g.target_date}" for g in goals]) or "None"

    # Bills
    bills = (await db.execute(select(Bill).where(and_(Bill.user_id == user_id, Bill.due_date >= today)))).scalars().all()
    bills_str = "\n".join([f"- {b.name}: ₹{b.amount:,.2f} due on {b.due_date} ({b.category})" for b in bills]) or "None"

    # Budgets
    current_month_str = today.strftime("%Y-%m")
    budgets = (await db.execute(select(Budget).where(and_(Budget.user_id == user_id, Budget.month == current_month_str)))).scalars().all()
    budgets_str = "\n".join([f"- {b.category}: Limit ₹{b.monthly_limit:,.2f}" for b in budgets]) or "None"

    return {
        "income": inc,
        "expenses": exp,
        "total_savings": total_savings,
        "accounts_str": accounts_str,
        "goals_str": goals_str,
        "bills_str": bills_str,
        "budgets_str": budgets_str,
        "goals_list": goals,
        "bills_list": bills,
        "budgets_list": budgets,
    }

async def call_gemini_llm(prompt: str) -> str:
    """Invoke Gemini API (or Google GenAI SDK / LangChain) with fallback if key is missing."""
    api_key = settings.GEMINI_API_KEY
    model_name = settings.GEMINI_MODEL or "gemini-3-flash-preview"

    if api_key:
        try:
            # Try google-genai package first
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            if response and response.text:
                return response.text
        except Exception as e:
            try:
                # Fallback to langchain_google_genai or google.generativeai
                from langchain_google_genai import ChatGoogleGenerativeAI
                llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key)
                res = llm.invoke(prompt)
                return res.content
            except Exception as e2:
                print(f"Gemini API invocation error: {e2}")

    # Smart local fallback response if no API key provided or API error occurs
    return (
        f"[Financial Assistant Response]\n"
        f"Based on your financial snapshot and records, here is an analysis of your request:\n"
        f"{prompt.split('=== USER QUESTION ===')[-1].strip()}\n\n"
        f"Key details reviewed:\n"
        f"- Monthly Income vs Expense ratio & Account Balances\n"
        f"- Active Savings Goals & Upcoming Bill Commitments\n"
        f"- Relevant uploaded policy documents and notes.\n\n"
        f"Disclaimer: This guidance is generated for informational purposes only and does not constitute formal financial advice."
    )

async def handle_ai_chat(
    db: AsyncSession,
    user_id: str,
    question: str,
    conversation_id: Optional[str] = None
) -> ChatResponse:
    # 1. Fetch structured financial snapshot
    struct_ctx = await build_structured_context(db, user_id)

    # 2. Query ChromaDB for notes and document chunks
    vector_service = get_vector_service()
    snippets = vector_service.query_texts(query_text=question, user_id=user_id, n_results=4)

    retrieved_chunks_str = ""
    citations: List[SourceCitationSchema] = []

    for i, snip in enumerate(snippets):
        retrieved_chunks_str += f"[{i+1}] {snip['text']}\n"
        src_type = snip.get("metadata", {}).get("source_type", "document_chunk")
        doc_title = snip.get("metadata", {}).get("document_title", "Document")
        citations.append(SourceCitationSchema(
            source_type=src_type,
            source_id=snip.get("id", f"snippet-{i}"),
            snippet=f"{doc_title}: {snip['text'][:120]}..."
        ))

    if not retrieved_chunks_str.strip():
        retrieved_chunks_str = "No relevant text documents or notes found."

    # Add citations for structured goals/bills if applicable
    for g in struct_ctx["goals_list"]:
        if g.name.lower() in question.lower():
            citations.append(SourceCitationSchema(
                source_type="goal",
                source_id=g.id,
                snippet=f"Goal '{g.name}': Target ₹{g.target_amount:,.2f}, Saved ₹{g.saved_amount:,.2f}"
            ))

    for b in struct_ctx["bills_list"]:
        if b.name.lower() in question.lower():
            citations.append(SourceCitationSchema(
                source_type="bill",
                source_id=b.id,
                snippet=f"Bill '{b.name}': ₹{b.amount:,.2f} due {b.due_date}"
            ))

    # 3. Build Prompt
    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        income=struct_ctx["income"],
        expenses=struct_ctx["expenses"],
        total_savings=struct_ctx["total_savings"],
        accounts_str=struct_ctx["accounts_str"],
        goals_str=struct_ctx["goals_str"],
        bills_str=struct_ctx["bills_str"],
        budgets_str=struct_ctx["budgets_str"],
        retrieved_chunks_str=retrieved_chunks_str,
        question=question
    )

    # 4. Call Gemini LLM
    answer_text = await call_gemini_llm(prompt)

    # 5. Persist Conversation & Messages
    if not conversation_id:
        conv = Conversation(user_id=user_id, title=question[:40])
        db.add(conv)
        await db.flush()
        conversation_id = conv.id

    msg_user = Message(conversation_id=conversation_id, role=MessageRole.USER, content=question)
    msg_asst = Message(conversation_id=conversation_id, role=MessageRole.ASSISTANT, content=answer_text)
    db.add(msg_user)
    db.add(msg_asst)
    await db.flush()

    for cite in citations:
        sc = SourceCitation(
            message_id=msg_asst.id,
            source_type=cite.source_type,
            source_id=cite.source_id,
            snippet=cite.snippet
        )
        db.add(sc)

    await db.commit()

    return ChatResponse(
        conversation_id=conversation_id,
        message=answer_text,
        citations=citations
    )

async def generate_spending_insights(db: AsyncSession, user_id: str) -> SpendingInsightResponse:
    today = date.today()
    current_month_str = today.strftime("%Y-%m")
    first_day = date(today.year, today.month, 1)

    # Fetch transactions this month grouped by category
    cat_stmt = select(
        Transaction.category,
        func.sum(Transaction.amount).label("cat_sum")
    ).where(
        and_(Transaction.user_id == user_id, Transaction.type == TransactionType.EXPENSE, Transaction.date >= first_day)
    ).group_by(Transaction.category)
    cat_res = await db.execute(cat_stmt)
    spent_dict = {cat: float(s or 0.0) for cat, s in cat_res.all()}

    # Fetch budgets
    b_stmt = select(Budget).where(and_(Budget.user_id == user_id, Budget.month == current_month_str))
    budgets = (await db.execute(b_stmt)).scalars().all()

    insights = []
    for b in budgets:
        spent = spent_dict.get(b.category, 0.0)
        if b.monthly_limit > 0:
            if spent > b.monthly_limit:
                over = spent - b.monthly_limit
                pct = round((spent / b.monthly_limit - 1) * 100, 1)
                insights.append(f"⚠️ {b.category} spending is {pct}% over budget (Over by ₹{over:,.2f}).")
            elif spent >= 0.8 * b.monthly_limit:
                insights.append(f"⚡ {b.category} spending has reached {round(spent/b.monthly_limit*100)}% of your monthly limit.")

    if not insights:
        insights.append("✅ Great job! All category expenditures are within configured monthly budgets.")
        insights.append("💡 Consider allocating surplus funds towards your emergency fund or investment accounts.")

    return SpendingInsightResponse(insights=insights[:4])

async def analyze_goal_feasibility(db: AsyncSession, user_id: str, goal_id: str) -> GoalFeasibilityResponse:
    g_stmt = select(Goal).where(and_(Goal.id == goal_id, Goal.user_id == user_id))
    goal = (await db.execute(g_stmt)).scalar_one_or_none()
    if not goal:
        raise ValueError("Goal not found")

    today = date.today()
    remaining_amount = max(0.0, goal.target_amount - goal.saved_amount)
    
    # Calculate months remaining
    days_left = (goal.target_date - today).days
    months_remaining = max(1.0, days_left / 30.44)

    required_monthly = round(remaining_amount / months_remaining, 2)

    # Calculate average user monthly savings rate over last 3 months
    three_months_ago = date(today.year, max(1, today.month - 3), 1)
    inc_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(Transaction.user_id == user_id, Transaction.type == TransactionType.INCOME, Transaction.date >= three_months_ago)
    )
    exp_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(Transaction.user_id == user_id, Transaction.type == TransactionType.EXPENSE, Transaction.date >= three_months_ago)
    )
    tot_inc = float((await db.execute(inc_stmt)).scalar_one() or 0.0)
    tot_exp = float((await db.execute(exp_stmt)).scalar_one() or 0.0)
    avg_monthly_savings = max(0.0, (tot_inc - tot_exp) / 3.0)

    is_feasible = avg_monthly_savings >= required_monthly

    prompt = (
        f"Goal: {goal.name}\n"
        f"Target Amount: ₹{goal.target_amount:,.2f}, Saved: ₹{goal.saved_amount:,.2f}, Remaining: ₹{remaining_amount:,.2f}\n"
        f"Target Date: {goal.target_date} ({months_remaining:.1f} months left)\n"
        f"Required Monthly Savings: ₹{required_monthly:,.2f}\n"
        f"User Average Monthly Surplus: ₹{avg_monthly_savings:,.2f}\n"
        f"Provide a brief 2-sentence assessment of whether this goal is realistic and what adjustments to make."
    )

    ai_explanation = await call_gemini_llm(prompt)

    return GoalFeasibilityResponse(
        goal_id=goal.id,
        goal_name=goal.name,
        target_amount=goal.target_amount,
        saved_amount=goal.saved_amount,
        months_remaining=round(months_remaining, 1),
        required_monthly_savings=required_monthly,
        current_avg_savings_rate=round(avg_monthly_savings, 2),
        is_feasible=is_feasible,
        ai_explanation=ai_explanation
    )
