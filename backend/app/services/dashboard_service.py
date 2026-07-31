from datetime import datetime, date
from typing import Dict, Any, List
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Transaction, Account, Budget, Goal, Bill, TransactionType
from app.schemas.schemas import DashboardSummaryResponse, CategoryExpense, TrendPoint, GoalResponse

async def compute_dashboard_summary(db: AsyncSession, user_id: str) -> DashboardSummaryResponse:
    today = date.today()
    current_month_str = today.strftime("%Y-%m")
    
    # 1. Accounts total savings / balance
    acc_stmt = select(func.coalesce(func.sum(Account.balance), 0.0)).where(Account.user_id == user_id)
    acc_res = await db.execute(acc_stmt)
    total_savings = float(acc_res.scalar_one() or 0.0)

    # 2. Current month income and expenses
    # Start of current month
    first_day_of_month = date(today.year, today.month, 1)
    
    inc_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.INCOME,
            Transaction.date >= first_day_of_month
        )
    )
    inc_res = await db.execute(inc_stmt)
    monthly_income = float(inc_res.scalar_one() or 0.0)

    exp_stmt = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
        and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.date >= first_day_of_month
        )
    )
    exp_res = await db.execute(exp_stmt)
    monthly_expenses = float(exp_res.scalar_one() or 0.0)

    # Savings rate = (Income - Expense) / Income * 100
    savings_rate = 0.0
    if monthly_income > 0:
        savings_rate = round(max(0.0, (monthly_income - monthly_expenses) / monthly_income * 100), 1)

    # 3. Expense breakdown by category
    cat_stmt = select(
        Transaction.category,
        func.sum(Transaction.amount).label("cat_total")
    ).where(
        and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.EXPENSE,
            Transaction.date >= first_day_of_month
        )
    ).group_by(Transaction.category)
    cat_res = await db.execute(cat_stmt)
    cat_rows = cat_res.all()

    expense_by_category: List[CategoryExpense] = []
    for cat_name, cat_tot in cat_rows:
        tot_val = float(cat_tot or 0.0)
        pct = round((tot_val / monthly_expenses * 100), 1) if monthly_expenses > 0 else 0.0
        expense_by_category.append(CategoryExpense(
            category=cat_name,
            amount=tot_val,
            percentage=pct
        ))

    # 4. Emergency Fund progress (if goal named emergency fund exists)
    goal_stmt = select(Goal).where(Goal.user_id == user_id)
    goal_res = await db.execute(goal_stmt)
    goals = goal_res.scalars().all()

    emergency_fund_progress = None
    goals_progress = []
    for g in goals:
        goals_progress.append(GoalResponse.model_validate(g))
        if "emergency" in g.name.lower():
            pct = round((g.saved_amount / g.target_amount * 100), 1) if g.target_amount > 0 else 0.0
            emergency_fund_progress = {
                "goal_id": g.id,
                "name": g.name,
                "target_amount": g.target_amount,
                "saved_amount": g.saved_amount,
                "progress_percentage": min(100.0, pct)
            }

    # 5. Upcoming bills count (within next 30 days)
    bill_stmt = select(func.count(Bill.id)).where(
        and_(
            Bill.user_id == user_id,
            Bill.due_date >= today
        )
    )
    bill_res = await db.execute(bill_stmt)
    upcoming_bills_count = int(bill_res.scalar_one() or 0)

    # 6. Income vs Expense trend (last 6 months)
    # Generate past 6 month strings
    trend_points: List[TrendPoint] = []
    for i in range(5, -1, -1):
        # Calculate year and month for (today - i months)
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        m_str = f"{y:04d}-{m:02d}"
        
        m_start = date(y, m, 1)
        if m == 12:
            m_end = date(y + 1, 1, 1)
        else:
            m_end = date(y, m + 1, 1)

        t_inc = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.INCOME,
                Transaction.date >= m_start,
                Transaction.date < m_end
            )
        )
        t_exp = select(func.coalesce(func.sum(Transaction.amount), 0.0)).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.EXPENSE,
                Transaction.date >= m_start,
                Transaction.date < m_end
            )
        )

        res_inc = await db.execute(t_inc)
        res_exp = await db.execute(t_exp)
        
        inc_val = float(res_inc.scalar_one() or 0.0)
        exp_val = float(res_exp.scalar_one() or 0.0)
        sav_val = max(0.0, inc_val - exp_val)

        trend_points.append(TrendPoint(
            month=m_str,
            income=inc_val,
            expenses=exp_val,
            savings=sav_val
        ))

    return DashboardSummaryResponse(
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        total_savings=total_savings,
        savings_rate=savings_rate,
        emergency_fund_progress=emergency_fund_progress,
        upcoming_bills_count=upcoming_bills_count,
        expense_by_category=expense_by_category,
        income_vs_expense_trend=trend_points,
        goals_progress=goals_progress
    )
