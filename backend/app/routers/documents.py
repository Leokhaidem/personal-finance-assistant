from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Document, DocumentStatus
from app.schemas.schemas import DocumentResponse
from app.services.document_service import process_and_index_document
from app.services.vector_service import get_vector_service

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    doc = Document(
        user_id=current_user.id,
        title=file.filename or "Financial Document",
        filename=file.filename or "document.pdf",
        content_type=file.content_type or "application/pdf",
        file_size_bytes=len(content),
        status=DocumentStatus.PROCESSING
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Queue background text extraction and vector embedding
    background_tasks.add_task(process_and_index_document, db, doc.id, content)

    return doc

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(Document.user_id == current_user.id).order_by(Document.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Document).where(and_(Document.id == document_id, Document.user_id == current_user.id))
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    vector_service = get_vector_service()
    vector_service.delete_by_document(document_id)

    await db.delete(doc)
    await db.commit()
    return None
