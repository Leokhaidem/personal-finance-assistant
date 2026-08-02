"""
Vector service.

Input:  a list of text chunks (each tagged with document_id / filename / page_number)
Process: generate embeddings (OpenAI or Google Gemini, selectable) and store
         them in ChromaDB along with that metadata.
Output: a success result with the IDs that were stored.

Configuration (environment variables):
    EMBEDDING_PROVIDER   "openai" (default) or "gemini"
    OPENAI_API_KEY       required if provider == "openai"
    GOOGLE_API_KEY       required if provider == "gemini"
    CHROMA_PERSIST_DIR   local path for ChromaDB's persistent store (default "chroma_db")
    CHROMA_COLLECTION    collection name (default "documents")

Install:
    pip install chromadb openai google-genai
"""

from __future__ import annotations

import os
import uuid
from abc import ABC, abstractmethod
from typing import Literal

import chromadb
from pydantic import BaseModel, Field

# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class ChunkInput(BaseModel):
    """One chunk of a document, ready to be embedded and stored."""

    text: str = Field(..., min_length=1)
    document_id: str
    filename: str
    page_number: int | None = None
    chunk_index: int | None = None


class StoreChunksResult(BaseModel):
    success: bool
    collection_name: str
    embedding_provider: str
    num_chunks_stored: int
    ids: list[str]


# --------------------------------------------------------------------------
# Embedding providers (pluggable — pick one at runtime)
# --------------------------------------------------------------------------

class EmbeddingProvider(ABC):
    name: str

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text, same order as input."""
        ...


# class OpenAIEmbeddingProvider(EmbeddingProvider):
#     name = "openai"

#     def __init__(self, model: str = "text-embedding-3-small", api_key: str | None = None):
#         from openai import OpenAI

#         key = api_key or os.environ.get("OPENAI_API_KEY")
#         if not key:
#             raise RuntimeError("OPENAI_API_KEY is not set.")
#         self.model = model
#         self._client = OpenAI(api_key=key)

#     def embed(self, texts: list[str]) -> list[list[float]]:
#         # Batched in one call; OpenAI preserves input order in response.data.
#         response = self._client.embeddings.create(model=self.model, input=texts)
#         return [item.embedding for item in response.data]


class GeminiEmbeddingProvider(EmbeddingProvider):
    name = "gemini"

    def __init__(self, model: str = "text-embedding-004", api_key: str | None = None):
        from google import genai

        key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("GOOGLE_API_KEY is not set.")
        self.model = model
        self._client = genai.Client(api_key=key)

    def embed(self, texts: list[str]) -> list[list[float]]:
        result = self._client.models.embed_content(model=self.model, contents=texts)
        return [e.values for e in result.embeddings]


def get_embedding_provider(
    provider: Literal["openai", "gemini"] | None = None,
) -> EmbeddingProvider:
    provider = provider or os.environ.get("EMBEDDING_PROVIDER", "openai")
    # if provider == "openai":
    #     return OpenAIEmbeddingProvider()
    if provider == "gemini":
        return GeminiEmbeddingProvider()
    raise ValueError(f"Unknown embedding provider: {provider!r} (expected 'openai' or 'gemini')")


# --------------------------------------------------------------------------
# Vector service
# --------------------------------------------------------------------------

class VectorService:
    """Embeds chunks and stores them in a persistent ChromaDB collection."""

    def __init__(
        self,
        persist_directory: str | None = None,
        collection_name: str | None = None,
        embedding_provider: EmbeddingProvider | None = None,
    ):
        persist_directory = persist_directory or os.environ.get("CHROMA_PERSIST_DIR", "chroma_db")
        self.collection_name = collection_name or os.environ.get("CHROMA_COLLECTION", "documents")

        self._client = chromadb.PersistentClient(path=persist_directory)
        self._collection = self._client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},  # so distance -> similarity is meaningful
        )
        self._embedder = embedding_provider or get_embedding_provider()

    def store_chunks(self, chunks: list[ChunkInput]) -> StoreChunksResult:
        """Embed `chunks` and upsert them into ChromaDB with their metadata."""
        if not chunks:
            raise ValueError("chunks list is empty")

        texts = [c.text for c in chunks]
        embeddings = self._embedder.embed(texts)

        if len(embeddings) != len(chunks):
            raise RuntimeError(
                f"Embedding count ({len(embeddings)}) does not match chunk count ({len(chunks)})."
            )

        ids = [
            f"{c.document_id}_{c.chunk_index if c.chunk_index is not None else i}_{uuid.uuid4().hex[:8]}"
            for i, c in enumerate(chunks)
        ]
        metadatas = [
            {
                "document_id": c.document_id,
                "filename": c.filename,
                # Chroma metadata values can't be None -> use -1 as "unknown".
                "page_number": c.page_number if c.page_number is not None else -1,
                "chunk_index": c.chunk_index if c.chunk_index is not None else i,
            }
            for i, c in enumerate(chunks)
        ]

        # upsert (not add) so re-processing the same document overwrites cleanly.
        self._collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

        return StoreChunksResult(
            success=True,
            collection_name=self.collection_name,
            embedding_provider=self._embedder.name,
            num_chunks_stored=len(chunks),
            ids=ids,
        )