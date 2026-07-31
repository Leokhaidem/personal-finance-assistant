import enum
import uuid
from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    String, Text, Float, Boolean, DateTime, Date, ForeignKey, Enum as SQLEnum, Integer, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def generate_uuid_str() -> str:
    return str(uuid.uuid4())

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class AccountType(str, enum.Enum):
    BANK = "bank"
    CREDIT_CARD = "credit_card"
    CASH = "cash"
    INVESTMENT = "investment"

class TransactionType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"

class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

# --------------------------------------------------------------------------
# User & Auth
# --------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


# --------------------------------------------------------------------------
# Documents & Chunks (Document Intake Layer)
# --------------------------------------------------------------------------

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), default="application/pdf")
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    num_pages: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[DocumentStatus] = mapped_column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    document = relationship("Document", back_populates="chunks")


# --------------------------------------------------------------------------
# Accounts, Transactions, Budgets, Goals, Bills
# --------------------------------------------------------------------------

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[AccountType] = mapped_column(SQLEnum(AccountType), default=AccountType.BANK)
    balance: Mapped[float] = mapped_column(Float, default=0.0)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    type: Mapped[TransactionType] = mapped_column(SQLEnum(TransactionType), nullable=False)

    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    monthly_limit: Mapped[float] = mapped_column(Float, nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False) # YYYY-MM

    user = relationship("User", back_populates="budgets")


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[float] = mapped_column(Float, nullable=False)
    saved_amount: Mapped[float] = mapped_column(Float, default=0.0)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)

    user = relationship("User", back_populates="goals")


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[str] = mapped_column(String(100), default="Utilities")

    user = relationship("User", back_populates="bills")


# --------------------------------------------------------------------------
# Notes (RAG free-text source)
# --------------------------------------------------------------------------

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notes")
    chunks = relationship("NoteChunk", back_populates="note", cascade="all, delete-orphan")


class NoteChunk(Base):
    __tablename__ = "note_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    note_id: Mapped[str] = mapped_column(String(36), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    note = relationship("Note", back_populates="chunks")


# --------------------------------------------------------------------------
# Chat Conversations, Messages & Citations
# --------------------------------------------------------------------------

class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[MessageRole] = mapped_column(SQLEnum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    citations = relationship("SourceCitation", back_populates="message", cascade="all, delete-orphan")


class SourceCitation(Base):
    __tablename__ = "source_citations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid_str)
    message_id: Mapped[str] = mapped_column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False) # document_chunk, note_chunk, transaction, goal, budget, bill
    source_id: Mapped[str] = mapped_column(String(128), nullable=False)
    snippet: Mapped[str] = mapped_column(Text, nullable=False)

    message = relationship("Message", back_populates="citations")
