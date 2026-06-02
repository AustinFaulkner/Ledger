"""Cross-document search over a project's data room.

Semantic search when embeddings are available (cosine over the same fastembed vectors
used for retrieval), with a keyword fallback otherwise. Returns ranked hits with a
source locator and a snippet windowed around the match — the "search everything"
convenience expected of any data-room / document platform.
"""

from __future__ import annotations

import re

import numpy as np

from . import embeddings, store


def search(project_id: str, query: str, k: int = 20, kind: str | None = None) -> list[dict]:
    q = (query or "").strip()
    if not q:
        return []
    rows = store.get_chunks(project_id)
    if not rows:
        return []
    docs = {d["id"]: d for d in store.list_documents(project_id)}

    def doc_kind(r: dict) -> str:
        return (docs.get(r["document_id"], {}) or {}).get("kind", "") or ""

    if kind:
        rows = [r for r in rows if doc_kind(r) == kind]
        if not rows:
            return []

    if embeddings.AVAILABLE and rows[0]["embedding"] is not None:
        qv = embeddings.embed([q])[0]
        sims = embeddings.cosine_rank(qv, [r["embedding"] for r in rows])
        ranked = [(i, float(sims[i])) for i in np.argsort(-sims)]
    else:
        qwords = {w.lower() for w in re.findall(r"\w+", q)}
        scores = [(i, _keyword_score(rows[i]["text"], qwords)) for i in range(len(rows))]
        ranked = sorted(scores, key=lambda x: -x[1])

    hits = []
    for i, score in ranked[:k]:
        if score <= 0:
            continue
        r = rows[i]
        hits.append(
            {
                "document_id": r["document_id"],
                "filename": r["source"] or "",
                "kind": doc_kind(r),
                "locator": r["locator"] or "",
                "snippet": _snippet(r["text"], q),
                "score": round(float(score), 4),
            }
        )
    return hits


def _keyword_score(text: str, qwords: set[str]) -> int:
    low = text.lower()
    return sum(1 for w in qwords if w in low)


def _snippet(text: str, query: str, width: int = 260) -> str:
    """A single-line window of the chunk centred on the first query-term hit."""
    flat = " ".join(text.split())
    low = flat.lower()
    pos = -1
    for w in sorted(re.findall(r"\w+", query.lower()), key=len, reverse=True):
        if len(w) < 3:
            continue
        pos = low.find(w)
        if pos >= 0:
            break
    if pos < 0:
        return flat[:width] + ("…" if len(flat) > width else "")
    start = max(0, pos - width // 3)
    end = min(len(flat), start + width)
    return ("…" if start > 0 else "") + flat[start:end] + ("…" if end < len(flat) else "")
