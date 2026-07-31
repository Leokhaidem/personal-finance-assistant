import asyncio
import os
import sys
from datetime import date, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.models import (
    User, UserRole, Account, AccountType, Transaction, TransactionType,
    Budget, Goal, Bill, Note, Document, DocumentStatus
)
from app.services.vector_service import get_vector_service
from app.services.document_service import split_document_text

async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # 1. Create Users
        demo_user = (await db.execute(select(User).where(User.email == "user@example.com"))).scalar_one_or_none()
        if not demo_user:
            demo_user = User(
                email="user@example.com",
                hashed_password=get_password_hash("password123"),
                full_name="Rajesh Kumar",
                role=UserRole.USER
            )
            db.add(demo_user)

        admin_user = (await db.execute(select(User).where(User.email == "admin@example.com"))).scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                full_name="System Admin",
                role=UserRole.ADMIN
            )
            db.add(admin_user)

        await db.commit()
        await db.refresh(demo_user)

        user_id = demo_user.id

        # Clear existing accounts/transactions for clean seed
        acc_check = (await db.execute(select(Account).where(Account.user_id == user_id))).scalars().all()
        if acc_check:
            print("Database already contains seed data. Skipping duplicate seed.")
            return

        # 2. Accounts
        hdfc = Account(user_id=user_id, name="HDFC Salary Account", type=AccountType.BANK, balance=125000.0)
        icici = Account(user_id=user_id, name="ICICI Coral Credit Card", type=AccountType.CREDIT_CARD, balance=-18500.0)
        cash = Account(user_id=user_id, name="Cash Wallet", type=AccountType.CASH, balance=4500.0)
        zerodha = Account(user_id=user_id, name="Zerodha Stocks & Mutual Funds", type=AccountType.INVESTMENT, balance=210000.0)

        db.add_all([hdfc, icici, cash, zerodha])
        await db.commit()
        await db.refresh(hdfc)
        await db.refresh(icici)

        today = date.today()
        current_month_str = today.strftime("%Y-%m")

        # 3. Budgets
        budgets = [
            Budget(user_id=user_id, category="Food & Dining", monthly_limit=15000.0, month=current_month_str),
            Budget(user_id=user_id, category="Shopping", monthly_limit=10000.0, month=current_month_str),
            Budget(user_id=user_id, category="Rent & Utilities", monthly_limit=28000.0, month=current_month_str),
            Budget(user_id=user_id, category="Travel & Transit", monthly_limit=8000.0, month=current_month_str),
        ]
        db.add_all(budgets)

        # 4. Goals
        goals = [
            Goal(user_id=user_id, name="Emergency Fund", target_amount=200000.0, saved_amount=135000.0, target_date=today + timedelta(days=180)),
            Goal(user_id=user_id, name="New Electric Scooter", target_amount=120000.0, saved_amount=45000.0, target_date=today + timedelta(days=120)),
            Goal(user_id=user_id, name="Ladakh Vacation", target_amount=75000.0, saved_amount=30000.0, target_date=today + timedelta(days=90)),
        ]
        db.add_all(goals)

        # 5. Bills
        bills = [
            Bill(user_id=user_id, name="Electricity Bill (BESCOM)", amount=2450.0, due_date=today + timedelta(days=5), recurring=True, category="Utilities"),
            Bill(user_id=user_id, name="Jio Fiber Broadband", amount=1179.0, due_date=today + timedelta(days=12), recurring=True, category="Utilities"),
            Bill(user_id=user_id, name="ICICI Credit Card Statement", amount=18500.0, due_date=today + timedelta(days=20), recurring=True, category="Credit Card"),
        ]
        db.add_all(bills)

        # 6. Transactions (Past 3 months)
        txs = []
        for month_offset in range(3):
            # Base month date
            m_date = date(today.year, today.month - month_offset, 1) if today.month > month_offset else date(today.year - 1, 12 + (today.month - month_offset), 1)
            
            # Salary
            txs.append(Transaction(
                user_id=user_id, account_id=hdfc.id, amount=95000.0, category="Income",
                description="Monthly Salary Credit", date=m_date + timedelta(days=1), type=TransactionType.INCOME
            ))
            # Rent
            txs.append(Transaction(
                user_id=user_id, account_id=hdfc.id, amount=24000.0, category="Rent & Utilities",
                description="Apartment Rent Payment", date=m_date + timedelta(days=3), type=TransactionType.EXPENSE
            ))
            # Groceries
            txs.append(Transaction(
                user_id=user_id, account_id=icici.id, amount=6500.0, category="Food & Dining",
                description="Blinkit & Swiggy Instamart Groceries", date=m_date + timedelta(days=8), type=TransactionType.EXPENSE
            ))
            # Dining
            txs.append(Transaction(
                user_id=user_id, account_id=icici.id, amount=4200.0, category="Food & Dining",
                description="Weekend Restaurants & Coffee", date=m_date + timedelta(days=15), type=TransactionType.EXPENSE
            ))
            # Shopping
            txs.append(Transaction(
                user_id=user_id, account_id=icici.id, amount=7800.0, category="Shopping",
                description="Amazon Electronics & Clothing", date=m_date + timedelta(days=20), type=TransactionType.EXPENSE
            ))

        db.add_all(txs)

        # 7. Notes (Free text for RAG)
        n1 = Note(
            user_id=user_id,
            title="Tax Saving Investments 80C Summary",
            content="I have invested ₹1,50,000 in PPF and ELSS mutual funds under Section 80C for FY 2025-26. Additional health insurance premium of ₹25,000 is covered under Section 80D."
        )
        n2 = Note(
            user_id=user_id,
            title="Star Health Policy Terms",
            content="Health Insurance Policy #SH-88942 covering family up to ₹10,00,000 sum insured. Room rent capping is 1% of sum insured per day. Pre-existing diseases covered after 24 months."
        )
        db.add_all([n1, n2])
        await db.commit()

        # Index notes in ChromaDB
        vec = get_vector_service()
        for note in [n1, n2]:
            chunks = split_document_text(note.content)
            ids = [f"note_{note.id}_{i}" for i in range(len(chunks))]
            metas = [{"user_id": user_id, "note_id": note.id, "document_title": note.title, "source_type": "note_chunk"} for _ in chunks]
            vec.add_texts(ids=ids, texts=chunks, metadatas=metas)

        print("Successfully seeded database with Indian financial sample data!")
        print("Demo User: user@example.com / password123")
        print("Admin User: admin@example.com / admin123")

if __name__ == "__main__":
    asyncio.run(seed_data())
