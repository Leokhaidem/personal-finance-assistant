import io
import json
import re
import fitz  # PyMuPDF
from datetime import datetime, date
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import Transaction, Account, TransactionType
from app.services.ai_service import call_gemini_llm

EXTRACTION_SYSTEM_PROMPT = """You are an expert financial statement parser.
Your job is to read bank, credit card, or financial statement text/images (even if unstructured, scanned, or non-standard) and extract ALL individual transaction line items.

Return ONLY a raw JSON array of objects. Do not include any intro, explanation, or markdown codeblock formatting (no ```json).

Each JSON object in the array MUST have the following keys:
- "date": string in "YYYY-MM-DD" format (if year is missing in statement, default to current year 2026).
- "description": string (clean merchant name, transfer description, or transaction details).
- "amount": positive number (float, e.g. 250.50).
- "type": string, either "expense" or "income" (Debits/Spent/Withdrawals are "expense", Credits/Deposits/Refunds are "income").
- "category": string, best fit from ["Food & Dining", "Shopping", "Rent & Utilities", "Travel & Transit", "Healthcare", "Entertainment", "Income", "Other"].

Example Output:
[
  {"date": "2026-07-15", "description": "Swiggy Bangalore", "amount": 450.00, "type": "expense", "category": "Food & Dining"},
  {"date": "2026-07-16", "description": "Salary Credit", "amount": 85000.00, "type": "income", "category": "Income"}
]

STATEMENT CONTENT:
"""

def clean_json_string(raw_str: str) -> str:
    """Remove markdown code blocks and surrounding whitespace."""
    cleaned = raw_str.strip()
    if cleaned.startswith("```"):
        # Remove first line of codeblock
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned, flags=re.IGNORECASE)
        # Remove trailing codeblock
        cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned

async def extract_transactions_from_pdf_bytes(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract transactions from PDF bytes using PyMuPDF and Gemini AI semantic parsing."""
    text_content = ""
    is_corrupted_or_scanned = False

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_texts = []
        for page in doc:
            page_texts.append(page.get_text())
        text_content = "\n\n".join(page_texts).strip()
        doc.close()
    except Exception as e:
        print(f"PyMuPDF text extraction error: {e}. Switching to corrupted/scanned fallback.")
        is_corrupted_or_scanned = True

    if not text_content or len(text_content) < 50:
        is_corrupted_or_scanned = True

    prompt = EXTRACTION_SYSTEM_PROMPT + "\n" + (text_content if not is_corrupted_or_scanned else "[Scanned/Unstructured PDF Text Attempt]: " + text_content[:2000])

    # Call Gemini LLM
    raw_response = await call_gemini_llm(prompt)
    cleaned_json = clean_json_string(raw_response)

    transactions = []
    try:
        parsed = json.loads(cleaned_json)
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and "amount" in item and "description" in item:
                    try:
                        amt = abs(float(item.get("amount", 0)))
                        if amt <= 0:
                            continue
                        tx_date = str(item.get("date", date.today().isoformat()))
                        # Validate date format YYYY-MM-DD
                        if not re.match(r"^\d{4}-\d{2}-\d{2}$", tx_date):
                            tx_date = date.today().isoformat()

                        tx_type = str(item.get("type", "expense")).lower()
                        if tx_type not in ["income", "expense"]:
                            tx_type = "expense"

                        transactions.append({
                            "date": tx_date,
                            "description": str(item.get("description", "Statement Transaction")).strip(),
                            "amount": round(amt, 2),
                            "type": tx_type,
                            "category": str(item.get("category", "Other")).strip()
                        })
                    except (ValueError, TypeError):
                        continue
    except Exception as parse_err:
        print(f"Failed to parse LLM response JSON: {parse_err}. Response was: {cleaned_json[:300]}")
        # Secondary regex fallback if JSON parsing failed
        transactions = fallback_regex_parser(text_content)

    return transactions

def fallback_regex_parser(text: str) -> List[Dict[str, Any]]:
    """Basic fallback parser for standard tabular transaction formats if LLM fails."""
    results = []
    lines = text.splitlines()
    pattern = re.compile(r"(\d{2}[-/\.]\d{2}[-/\.]\d{2,4})\s+(.+?)\s+₹?\s*([\d,]+\.?\d*)")
    
    for line in lines:
        match = pattern.search(line)
        if match:
            raw_date, desc, raw_amt = match.groups()
            try:
                amt = float(raw_amt.replace(",", ""))
                if amt > 0:
                    results.append({
                        "date": date.today().isoformat(),
                        "description": desc.strip(),
                        "amount": round(amt, 2),
                        "type": "expense",
                        "category": "Other"
                    })
            except ValueError:
                continue
    return results

async def confirm_and_save_transactions(
    db: AsyncSession,
    user_id: str,
    account_id: str,
    transactions_list: List[Dict[str, Any]]
) -> Tuple[int, Account]:
    """Validate account ownership, deduplicate, insert transactions into DB, and update account balance."""
    # 1. Verify account
    stmt = select(Account).where(and_(Account.id == account_id, Account.user_id == user_id))
    acc = (await db.execute(stmt)).scalar_one_or_none()
    if not acc:
        raise ValueError("Account not found or access denied.")

    # 2. Fetch existing transactions to avoid duplicate imports
    existing_stmt = select(Transaction).where(and_(Transaction.user_id == user_id, Transaction.account_id == account_id))
    existing_txs = (await db.execute(existing_stmt)).scalars().all()
    existing_keys = {(t.date.isoformat(), t.amount, t.description.strip().lower()) for t in existing_txs if t.date and t.description}

    imported_count = 0
    for tx in transactions_list:
        try:
            tx_date_obj = datetime.strptime(tx["date"], "%Y-%m-%d").date()
        except Exception:
            tx_date_obj = date.today()

        amt = float(tx["amount"])
        desc = str(tx["description"]).strip()
        key = (tx_date_obj.isoformat(), amt, desc.lower())

        if key in existing_keys:
            continue  # Skip duplicate transaction

        tx_type = TransactionType.INCOME if tx.get("type") == "income" else TransactionType.EXPENSE

        new_tx = Transaction(
            user_id=user_id,
            account_id=account_id,
            amount=amt,
            category=tx.get("category", "Uncategorized"),
            description=desc,
            date=tx_date_obj,
            type=tx_type
        )
        db.add(new_tx)

        # Update account balance
        if tx_type == TransactionType.INCOME:
            acc.balance += amt
        else:
            acc.balance -= amt

        existing_keys.add(key)
        imported_count += 1

    await db.commit()
    await db.refresh(acc)
    return imported_count, acc
