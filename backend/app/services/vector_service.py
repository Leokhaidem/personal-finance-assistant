import os
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any
from app.core.config import settings

class VectorService:
    def __init__(self):
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
        self.collection = self.client.get_or_create_collection(
            name="finance_documents",
            metadata={"hnsw:space": "cosine"}
        )

    def add_texts(
        self,
        ids: List[str],
        texts: List[str],
        metadatas: List[Dict[str, Any]]
    ):
        if not ids:
            return
        self.collection.upsert(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )

    def query_texts(
        self,
        query_text: str,
        user_id: str,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where={"user_id": user_id}
        )
        
        snippets = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else []
            ids = results["ids"][0] if "ids" in results and results["ids"] else []
            
            for i, doc in enumerate(docs):
                meta = metas[i] if i < len(metas) else {}
                snippets.append({
                    "id": ids[i] if i < len(ids) else f"chunk-{i}",
                    "text": doc,
                    "metadata": meta
                })
        return snippets

    def delete_by_document(self, document_id: str):
        try:
            self.collection.delete(where={"document_id": document_id})
        except Exception:
            pass

    def delete_by_note(self, note_id: str):
        try:
            self.collection.delete(where={"note_id": note_id})
        except Exception:
            pass

_vector_service_instance = None

def get_vector_service() -> VectorService:
    global _vector_service_instance
    if _vector_service_instance is None:
        _vector_service_instance = VectorService()
    return _vector_service_instance
