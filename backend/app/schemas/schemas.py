from datetime import datetime, date as Date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, model_validator
from app.models.models import UserRole, AccountType, TransactionType, DocumentStatus, MessageRole

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.USER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Account Schemas ---
class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: AccountType = AccountType.BANK
    balance: float = 0.0

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    balance: Optional[float] = None

class AccountResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: AccountType
    balance: float

    class Config:
        from_attributes = True

# --- Transaction Schemas ---
class TransactionCreate(BaseModel):
    account_id: str
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1)
    description: Optional[str] = None
    date: Date
    type: TransactionType

class TransactionUpdate(BaseModel):
    account_id: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[Date] = None
    type: Optional[TransactionType] = None

class TransactionResponse(BaseModel):
    id: str
    user_id: str
    account_id: str
    amount: float
    category: str
    description: Optional[str] = None
    date: Date
    type: TransactionType

    class Config:
        from_attributes = True

# --- Budget Schemas ---
class BudgetCreate(BaseModel):
    category: str = Field(..., min_length=1)
    monthly_limit: float = Field(..., gt=0)
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$") # YYYY-MM

class BudgetUpdate(BaseModel):
    monthly_limit: Optional[float] = None

class BudgetResponse(BaseModel):
    id: str
    user_id: str
    category: str
    monthly_limit: float
    month: str
    spent: Optional[float] = 0.0

    class Config:
        from_attributes = True

# --- Goal Schemas ---
class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1)
    target_amount: float = Field(..., gt=0)
    saved_amount: float = 0.0
    target_date: Date

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    saved_amount: Optional[float] = None
    target_date: Optional[Date] = None

class GoalResponse(BaseModel):
    id: str
    user_id: str
    name: str
    target_amount: float
    saved_amount: float
    target_date: Date

    class Config:
        from_attributes = True

# --- Bill Schemas ---
class BillCreate(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    due_date: Date
    recurring: bool = True
    category: str = "Utilities"

class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[Date] = None
    recurring: Optional[bool] = None
    category: Optional[str] = None

class BillResponse(BaseModel):
    id: str
    user_id: str
    name: str
    amount: float
    due_date: Date
    recurring: bool
    category: str

    class Config:
        from_attributes = True

class ExtractedTransactionItem(BaseModel):
    date: str
    description: str
    amount: float = Field(..., gt=0)
    type: TransactionType = TransactionType.EXPENSE
    category: str = "Uncategorized"

# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: str
    user_id: str
    title: str
    filename: str
    content_type: str
    file_size_bytes: int
    num_pages: int
    status: DocumentStatus
    created_at: datetime
    extracted_transactions: List[ExtractedTransactionItem] = []

    class Config:
        from_attributes = True

# --- Note Schemas ---
class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteResponse(BaseModel):
    id: str
    user_id: str
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Dashboard Summary ---
class CategoryExpense(BaseModel):
    category: str
    amount: float
    percentage: float

class TrendPoint(BaseModel):
    month: str
    income: float
    expenses: float
    savings: float

class DashboardSummaryResponse(BaseModel):
    monthly_income: float
    monthly_expenses: float
    salary_income: float = 0.0
    active_month_label: Optional[str] = None
    active_month: Optional[str] = None
    available_months: List[str] = []
    total_savings: float
    savings_rate: float
    emergency_fund_progress: Optional[dict] = None
    upcoming_bills_count: int
    expense_by_category: List[CategoryExpense]
    income_vs_expense_trend: List[TrendPoint]
    goals_progress: List[GoalResponse]

class BulkDeleteTransactionsRequest(BaseModel):
    transaction_ids: List[str]

# --- AI & Chat Schemas ---
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str = Field(..., min_length=1)

class SourceCitationSchema(BaseModel):
    source_type: str
    source_id: str
    snippet: str

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    citations: List[SourceCitationSchema] = []

class MessageItemResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    citations: List[SourceCitationSchema] = []

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    title: Optional[str]
    created_at: datetime
    messages: List[MessageItemResponse] = []

    class Config:
        from_attributes = True

class SpendingInsightResponse(BaseModel):
    insights: List[str]

class GoalFeasibilityResponse(BaseModel):
    goal_id: str
    goal_name: str
    target_amount: float
    saved_amount: float
    months_remaining: float
    required_monthly_savings: float
    current_avg_savings_rate: float
    is_feasible: bool
    ai_explanation: str

# --- PDF Statement Extraction Schemas ---


class ConfirmTransactionsRequest(BaseModel):
    account_id: str
    transactions: List[ExtractedTransactionItem]

class ConfirmTransactionsResponse(BaseModel):
    imported_count: int
    account_id: str
    account_name: str
    new_balance: float

