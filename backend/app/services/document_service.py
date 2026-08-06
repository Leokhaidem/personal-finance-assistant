import fitz  # PyMuPDF
from typing import List, Tuple
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import traceback
import uuid

from app.core.database import AsyncSessionLocal
from app.models.models import Document, Chunk, DocumentStatus
from app.services.vector_service import get_vector_service

CHUNK_SIZE = 500
CHUNK_OVERLAP = 100

def extract_text_from_pdf(pdf_bytes: bytes) -> Tuple[int, str]:
    """Extract page count and full text from PDF bytes using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        num_pages = doc.page_count
        page_texts = [page.get_text() for page in doc]
        full_text = "\n\n".join(page_texts)
        return num_pages, full_text
    finally:
        doc.close()

def split_document_text(text: str) -> List[str]:
    """Split text into overlapping chunks using RecursiveCharacterTextSplitter."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len
    )
    return splitter.split_text(text)

async def process_and_index_document(
    document_id: str,
    pdf_bytes: bytes
):
    """Background task to extract PDF text, chunk, save DB records, and vector index using an independent session."""
    async with AsyncSessionLocal() as db:
        stmt = select(Document).where(Document.id == document_id)
        res = await db.execute(stmt)
        document = res.scalar_one_or_none()
        if not document:
            return

        try:
            num_pages, text = extract_text_from_pdf(pdf_bytes)
            document.num_pages = num_pages
            
            if not text.strip():
                document.status = DocumentStatus.FAILED
                await db.commit()
                return

            chunks_text = split_document_text(text)
            vector_service = get_vector_service()
            
            ids = []
            texts = []
            metadatas = []
            
            for idx, chunk_str in enumerate(chunks_text):
                # Chroma vector ID
                chroma_id = f"doc_{document.id}_{idx}"

                # Database row
                chunk_row = Chunk(
                    id=str(uuid.uuid4()),          # UUID for PostgreSQL
                    document_id=document.id,
                    user_id=document.user_id,
                    chunk_index=idx,
                    chunk_text=chunk_str,
                    embedding_id=chroma_id         # Chroma vector ID
                )

                db.add(chunk_row)

                # Store in Chroma
                ids.append(chroma_id)
                texts.append(chunk_str)
                metadatas.append({
                    "user_id": document.user_id,
                    "document_id": document.id,
                    "document_title": document.title,
                    "source_type": "document"
                })
                
            vector_service.add_texts(ids=ids, texts=texts, metadatas=metadatas)
            
            document.status = DocumentStatus.READY
            await db.commit()

        except Exception as exc:
            await db.rollback()

            document.status = DocumentStatus.FAILED
            db.add(document)
            await db.commit()

            print("========== DOCUMENT PROCESSING ERROR ==========")
            traceback.print_exc()