from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Note, NoteChunk
from app.schemas.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.services.document_service import split_document_text
from app.services.vector_service import get_vector_service

router = APIRouter(prefix="/notes", tags=["Notes"])

async def process_and_index_note(db: AsyncSession, note_id: str, user_id: str, content: str, title: str):
    vector_service = get_vector_service()
    vector_service.delete_by_note(note_id)

    chunks = split_document_text(content)
    ids = []
    texts = []
    metadatas = []

    for idx, c_str in enumerate(chunks):
        c_id = f"note_{note_id}_{idx}"
        nc = NoteChunk(
            id=c_id,
            note_id=note_id,
            user_id=user_id,
            chunk_text=c_str,
            embedding_id=c_id
        )
        db.add(nc)

        ids.append(c_id)
        texts.append(c_str)
        metadatas.append({
            "user_id": user_id,
            "note_id": note_id,
            "document_title": title,
            "source_type": "note_chunk"
        })

    vector_service.add_texts(ids=ids, texts=texts, metadatas=metadatas)
    await db.commit()

@router.get("", response_model=List[NoteResponse])
async def list_notes(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(Note).where(Note.user_id == current_user.id).order_by(Note.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    background_tasks: BackgroundTasks,
    n_in: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    note = Note(user_id=current_user.id, **n_in.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)

    background_tasks.add_task(process_and_index_note, db, note.id, current_user.id, note.content, note.title)
    return note

@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    background_tasks: BackgroundTasks,
    n_in: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Note).where(and_(Note.id == note_id, Note.user_id == current_user.id))
    note = (await db.execute(stmt)).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    for k, v in n_in.model_dump(exclude_unset=True).items():
        setattr(note, k, v)

    await db.commit()
    await db.refresh(note)

    background_tasks.add_task(process_and_index_note, db, note.id, current_user.id, note.content, note.title)
    return note

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Note).where(and_(Note.id == note_id, Note.user_id == current_user.id))
    note = (await db.execute(stmt)).scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    get_vector_service().delete_by_note(note_id)

    await db.delete(note)
    await db.commit()
    return None
