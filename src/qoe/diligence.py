"""Retrieval + orchestration: cited Q&A and key-term extraction over the data room.

A deliberately small, dependency-light vector index (cosine similarity over
in-memory embeddings) keeps the scaffold runnable without external services. Swap
`_embed` for a production embedding provider and the index for pgvector/FAISS when
you outgrow it.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, Field

from . import llm
from .config import settings
from .ingest import Chunk


class Citation(BaseModel):
    claim: str = Field(
        default="", description="the exact span of the answer this supports (a verbatim substring of your answer)"
    )
    source: str = ""
    quote: str = Field(default="", description="VERBATIM snippet from the source that supports the claim")


class Answer(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    confidence: str


@dataclass
class Index:
    """In-memory retrieval index over data-room chunks."""
    chunks: list[Chunk]

    def search(self, query: str, k: int = 6) -> list[Chunk]:
        """Return the k most relevant chunks for `query`.

        TODO: replace the keyword fallback below with real embeddings
        (cosine similarity over `_embed(query)` vs. per-chunk vectors).
        """
        scored = sorted(
            self.chunks,
            key=lambda c: _keyword_overlap(query, c.text),
            reverse=True,
        )
        return scored[:k]


def build_index(chunks: list[Chunk]) -> Index:
    return Index(chunks=chunks)


def answer(question: str, chunks: list[Chunk]) -> Answer:
    """Answer a diligence question, grounded in and cited to the supplied chunks.

    Shared by the CLI (`ask`) and the web API (which retrieves chunks per-project).
    """
    context = "\n\n".join(f"=== {c.source} ===\n{c.text}" for c in chunks)
    prompt = (
        "Answer the diligence question using ONLY the sources below, in fluent prose.\n"
        "Then provide a citations list: for EACH factual claim in your answer, add one "
        "citation where 'claim' is the exact wording of that claim copied VERBATIM from "
        "your own answer (it must be a substring of your answer), 'source' is the filename, "
        "and 'quote' is the supporting sentence or figure from that file — copy it from the "
        "source as closely as you can (a short snippet is fine). Always fill in 'quote'. "
        "Cite the most important factual claims (at most 6); keep quotes short. If the "
        "sources do not answer the question, say so with an empty citations list.\n\n"
        f"=== SOURCES ===\n{context}\n\n=== QUESTION ===\n{question}"
    )
    # Interactive Q&A grounded in retrieved context → the fast-tier model.
    return llm.parse(prompt, Answer, max_tokens=8000, model=settings.model_fast)


def ask(index: Index, question: str) -> Answer:
    """Answer a diligence question with citations grounded in retrieved chunks."""
    return answer(question, index.search(question))


class KeyTerms(BaseModel):
    parties: list[str] = Field(default_factory=list)
    effective_date: str | None = None
    term_and_termination: str | None = None
    payment_terms: str | None = None
    change_of_control: str | None = None
    notable_clauses: list[str] = Field(default_factory=list)


def extract_key_terms(contract_text: str) -> KeyTerms:
    """Pull material terms from a contract / agreement."""
    prompt = "Extract the material terms from this agreement:\n\n" + contract_text
    return llm.parse(prompt, KeyTerms, max_tokens=2000, model=settings.model_fast)


def _keyword_overlap(query: str, text: str) -> int:
    q = {w.lower() for w in query.split()}
    return sum(1 for w in text.lower().split() if w in q)
