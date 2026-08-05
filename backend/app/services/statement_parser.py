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
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned

def clean_amount(raw_str: str) -> float:
    if not raw_str:
        return 0.0
    cleaned = re.sub(r"[^\d\.]", "", raw_str.replace(",", ""))
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_date_string(date_str: str) -> str:
    if not date_str:
        return date.today().isoformat()
    date_str = date_str.strip()
    
    # Try YYYY-MM-DD
    m = re.match(r"^(\d{4})[-/\.](\d{1,2})[-/\.](\d{1,2})$", date_str)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    # Try DD-MM-YYYY or DD/MM/YYYY
    m = re.match(r"^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{4})$", date_str)
    if m:
        return f"{int(m.group(3)):04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

    # Try DD-MM-YY or DD/MM/YY
    m = re.match(r"^(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2})$", date_str)
    if m:
        yr = 2000 + int(m.group(3))
        return f"{yr:04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

    # Try DD Mon YYYY or Mon DD, YYYY
    for fmt in ("%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%b %d %Y"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.date().isoformat()
        except ValueError:
            pass

    return date.today().isoformat()

def categorize_description(desc: str, tx_type: str) -> str:
    d = desc.lower()
    if tx_type == "income" or "salary" in d or "interest" in d:
        return "Income"
    if any(k in d for k in ["swiggy", "zomato", "restaurant", "cafe", "food", "dining", "dominos", "pizza", "dhabba", "mcdonald"]):
        return "Food & Dining"
    if any(k in d for k in ["electricity", "eb", "bescom", "tata power", "water", "gas", "lpg", "airtel", "jio", "broadband", "wifi", "rent", "utility", "bill"]):
        return "Rent & Utilities"
    if any(k in d for k in ["amazon", "flipkart", "myntra", "store", "retail", "mart", "supermarket"]):
        return "Shopping"
    if any(k in d for k in ["uber", "ola", "irctc", "flight", "petrol", "fuel", "shell", "metro", "transit"]):
        return "Travel & Transit"
    if any(k in d for k in ["apollo", "pharmacy", "medical", "hospital", "doctor"]):
        return "Healthcare"
    if any(k in d for k in ["netflix", "spotify", "prime", "cinema", "movie", "bookmyshow"]):
        return "Entertainment"
    return "Other"

def heuristic_statement_parser(text: str) -> List[Dict[str, Any]]:
    """Deterministic fallback parser for single-line statements, single-line bills without inline dates, vertical multi-line bills, and bill summary totals."""
    results = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return results

    date_pattern = r"(\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}|\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})"
    amount_pattern = r"(?:₹|Rs\.?|\$|INR)?\s*([\d,]+\.\d{2})"

    # Document-level date fallback
    doc_date = date.today().isoformat()
    for line in lines:
        dm = re.search(date_pattern, line, re.IGNORECASE)
        if dm:
            doc_date = parse_date_string(dm.group(1))
            break
    
    # 1. Single-line statement regex with inline date (Date Description Amount)
    line_item_regex = re.compile(f"{date_pattern}\\s+(.+?)\\s+{amount_pattern}", re.IGNORECASE)

    for line in lines:
        match = line_item_regex.search(line)
        if match:
            raw_date, desc, raw_amt = match.groups()
            amt = clean_amount(raw_amt)
            if amt > 0:
                parsed_date = parse_date_string(raw_date)
                is_income = any(k in line.lower() for k in ["cr", "credit", "deposit", "salary", "refund", "received"])
                tx_type = "income" if is_income else "expense"
                cat = categorize_description(desc, tx_type)
                results.append({
                    "date": parsed_date,
                    "description": desc.strip(),
                    "amount": round(amt, 2),
                    "type": tx_type,
                    "category": cat
                })

    # 2. Single-line statement regex without inline date (Description Amount on line)
    if not results:
        ignore_keywords = {"total", "total expenses", "total amount", "subtotal", "amount payable", "grand total", "balance", "net payable"}
        item_no_date_regex = re.compile(rf"^(?:{date_pattern}\s+)?(.+?)\s+{amount_pattern}$", re.IGNORECASE)

        for line in lines:
            # Skip header / total lines
            if any(k in line.lower() for k in ignore_keywords) or re.search(r"^\d+[\s\.\)]", line):
                continue
            match = item_no_date_regex.search(line)
            if match:
                date_grp, desc, raw_amt = match.groups()
                amt = clean_amount(raw_amt)
                if amt > 0:
                    item_date = parse_date_string(date_grp) if date_grp else doc_date
                    desc_clean = desc.strip()
                    if desc_clean.lower() in ignore_keywords or len(desc_clean) < 2:
                        continue
                    is_income = any(k in line.lower() for k in ["cr", "credit", "deposit", "salary", "refund", "received"])
                    tx_type = "income" if is_income else "expense"
                    cat = categorize_description(desc_clean, tx_type)
                    results.append({
                        "date": item_date,
                        "description": desc_clean,
                        "amount": round(amt, 2),
                        "type": tx_type,
                        "category": cat
                    })

    # 3. Multi-line vertical table parser strategy (common in column-based PDF bills & statements)
    if not results:
        known_categories = {"housing", "utilities", "communication", "food", "transportation", "loan", "insurance", "leisure", "shopping", "entertainment", "medical", "other"}
        amount_regex = re.compile(r"^₹?\s*([\d,]+\.\d{2})$")

        summary_skip_keywords = ["description", "category", "amount", "total expenses", "total income", "total amount", "grand total", "subtotal", "remaining balance", "net balance", "bill no", "invoice no"]
        tokens = []
        for line in lines:
            am = amount_regex.match(line)
            if am:
                tokens.append({"type": "amount", "value": float(am.group(1).replace(",", ""))})
            else:
                if not any(k in line.lower() for k in summary_skip_keywords):
                    tokens.append({"type": "text", "value": line})

        curr_text = []
        for tok in tokens:
            if tok["type"] == "text":
                curr_text.append(tok["value"])
            elif tok["type"] == "amount":
                if curr_text and tok["value"] > 0:
                    if len(curr_text) >= 2 and curr_text[-1].lower() in known_categories:
                        desc = curr_text[-2]
                    else:
                        desc = curr_text[-1]
                    
                    if not any(k in desc.lower() for k in ["total income", "total expenses", "grand total", "subtotal", "remaining balance"]):
                        tx_type = "income" if any(k in desc.lower() for k in ["salary", "credit", "deposit", "income"]) else "expense"
                        cat = categorize_description(desc, tx_type)
                        results.append({
                            "date": doc_date,
                            "description": desc,
                            "amount": round(tok["value"], 2),
                            "type": tx_type,
                            "category": cat
                        })
                curr_text = []

    # 3. Bill / Invoice Summary Total (if no line items extracted)
    if not results:
        bill_total_pattern = re.compile(
            r"(?:total\s+amount\s+due|amount\s+payable|total\s+payable|grand\s+total|invoice\s+total|total\s+due|net\s+amount|bill\s+amount|total\s+charges|amount\s+paid|total)\s*[:=\-]?\s*(?:₹|Rs\.?|\$|INR)?\s*([\d,]+\.?\d*)",
            re.IGNORECASE
        )
        found_amt = None
        for line in lines:
            bm = bill_total_pattern.search(line)
            if bm:
                amt = clean_amount(bm.group(1))
                if amt > 0:
                    found_amt = amt
                    break
        
        if found_amt:
            date_match = re.search(date_pattern, text, re.IGNORECASE)
            bill_date = parse_date_string(date_match.group(1)) if date_match else date.today().isoformat()
            
            header = lines[0] if lines else "Financial Bill"
            if len(header) > 60:
                header = header[:60]
            
            cat = categorize_description(text, "expense")
            results.append({
                "date": bill_date,
                "description": f"Bill: {header}",
                "amount": round(found_amt, 2),
                "type": "expense",
                "category": cat if cat != "Other" else "Rent & Utilities"
            })

    return results

async def extract_transactions_from_pdf_bytes(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract transactions from PDF bytes using PyMuPDF with AI semantic parsing + heuristic fallback."""
    text_content = ""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_texts = []
        for page in doc:
            page_texts.append(page.get_text("text"))
        text_content = "\n\n".join(page_texts).strip()
        doc.close()
    except Exception as e:
        print(f"PyMuPDF text extraction error: {e}")

    if not text_content:
        return []

    prompt = EXTRACTION_SYSTEM_PROMPT + "\n" + text_content[:4000]

    transactions = []
    # Call Gemini LLM
    try:
        raw_response = await call_gemini_llm(prompt)
        cleaned_json = clean_json_string(raw_response)

        parsed = json.loads(cleaned_json)
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict) and "amount" in item and "description" in item:
                    try:
                        amt = abs(float(item.get("amount", 0)))
                        if amt <= 0:
                            continue
                        tx_date = str(item.get("date", date.today().isoformat()))
                        if not re.match(r"^\d{4}-\d{2}-\d{2}$", tx_date):
                            tx_date = parse_date_string(tx_date)

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
        print(f"LLM JSON parsing fallback: {parse_err}")

    # If AI parsing yielded no results or returned fallback response, use heuristic statement parser
    if not transactions:
        transactions = heuristic_statement_parser(text_content)

    return transactions

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

        raw_type = str(tx.get("type", "")).lower()
        if "income" in raw_type or raw_type == "credit" or tx.get("type") == TransactionType.INCOME:
            tx_type = TransactionType.INCOME
        else:
            tx_type = TransactionType.EXPENSE

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
