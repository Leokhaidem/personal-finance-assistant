"""
RAG pipeline.

    Question
       |
       v
    Embedding                (same provider used when chunks were stored)
       |
       v
    Similarity search        (ChromaDB, top-k)
       |
       v
    Top 5 chunks
       |
       v
    Build grounded prompt
       |
       v
    Gemini (generation)
       |
       v
    Answer + citations

Configuration (environment variables):
    GOOGLE_API_KEY       required — used for the Gemini generation call
    GEMINI_MODEL         generation model (default "gemini-2.5-flash")
    EMBEDDING_PROVIDER   "openai" (default) or "gemini" — MUST match whatever
                         provider was used to embed/store the chunks, since
                         embedding spaces from different models aren't comparable
    (+ whichever of OPENAI_API_KEY / GOOGLE_API_KEY that embedding provider needs)

Install:
    pip install google-genai
"""

from __future__ import annotations

import os

from pydantic import BaseModel

from vector_service import EmbeddingProvider, VectorService, get_embedding_provider

DEFAULT_TOP_K = 5


class Citation(BaseModel):
    marker: str  # e.g. "[1]" — matches the inline citation markers in `answer`
    document_id: str
    filename: str
    page_number: int
    chunk_id: str
    similarity: float
    text: str


class RAGAnswer(BaseModel):
    question: str
    answer: str
    citations: list[Citation]


class RAGService:
    def __init__(
        self,
        vector_service: VectorService,
        embedding_provider: EmbeddingProvider | None = None,
        gemini_model: str | None = None,
        api_key: str | None = None,
    ):
        from google import genai

        self._vector_service = vector_service
        # Must be the same embedding model/provider that produced the stored
        # vectors — otherwise the question embedding lives in a different
        # space and similarity search is meaningless.
        self._embedder = embedding_provider or get_embedding_provider()
        self._model = gemini_model or os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

        key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("GOOGLE_API_KEY is not set (required for Gemini generation).")
        self._client = genai.Client(api_key=key)

    # -- Step 2 + 3: embed the question, retrieve top-k similar chunks -----

    def _retrieve(self, question: str, top_k: int) -> list[Citation]:
        query_embedding = self._embedder.embed([question])[0]

        results = self._vector_service._collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

        ids = results["ids"][0]
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        dists = results["distances"][0]

        citations = []
        for i, (chunk_id, text, meta, dist) in enumerate(zip(ids, docs, metas, dists)):
            citations.append(
                Citation(
                    marker=f"[{i + 1}]",
                    document_id=meta.get("document_id", "unknown"),
                    filename=meta.get("filename", "unknown"),
                    page_number=meta.get("page_number", -1),
                    chunk_id=chunk_id,
                    similarity=round(1 - dist, 4),  # collection uses cosine space
                    text=text,
                )
            )
        return citations

    # -- Step 4: build a grounded, citation-instructing prompt --------------

    @staticmethod
    def _build_prompt(question: str, citations: list[Citation]) -> str:
        context_blocks = "\n\n".join(
            f"{c.marker} (source: {c.filename}, page {c.page_number})\n{c.text}"
            for c in citations
        )
        return (
            "You are a helpful assistant. Answer the question using ONLY the "
            "context provided below. If the context does not contain enough "
            "information to answer, say so explicitly rather than guessing.\n\n"
            f"Context:\n{context_blocks}\n\n"
            f"Question: {question}\n\n"
            "Instructions:\n"
            "- Answer clearly and concisely.\n"
            "- Cite the sources you used inline with their bracket markers, "
            "e.g. [1], [2], matching the context blocks above.\n"
            "- Do not cite a source you did not actually use."
        )

    # -- Step 5 + 6: send to Gemini, return answer + citations --------------

    def answer(self, question: str, top_k: int = DEFAULT_TOP_K) -> RAGAnswer:
        if not question or not question.strip():
            raise ValueError("question must not be empty")

        citations = self._retrieve(question, top_k)
        if not citations:
            return RAGAnswer(
                question=question,
                answer="I don't have any relevant documents to answer this question.",
                citations=[],
            )

        prompt = self._build_prompt(question, citations)
        response = self._client.models.generate_content(model=self._model, contents=prompt)

        return RAGAnswer(
            question=question,
            answer=response.text or "",
            citations=citations,
        )