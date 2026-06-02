"""Retrieve the most relevant chunks for a question over a Project's data room.

Embeddings-backed cosine search when available (fastembed); keyword-overlap fallback
otherwise. Returns `Chunk` objects so the answer layer can cite source + locator.
"""

from __future__ import annotations

import numpy as np

from . import embeddings, store
from .ingest import Chunk


def search(project_id: str, question: str, k: int = 8, per_source_cap: int = 3) -> list[Chunk]:
    rows = store.get_chunks(project_id)
    if not rows:
        return []
    chunks = [Chunk(text=r["text"], source=r["source"] or "", locator=r["locator"] or "") for r in rows]

    if embeddings.AVAILABLE and rows[0]["embedding"] is not None:
        matrix = [r["embedding"] for r in rows]
        qv = embeddings.embed([question])[0]
        sims = embeddings.cosine_rank(qv, matrix)
        order = list(np.argsort(-sims))
    else:
        # Keyword fallback.
        qwords = {w.lower() for w in question.split()}
        order = sorted(
            range(len(chunks)),
            key=lambda i: sum(1 for w in chunks[i].text.lower().split() if w in qwords),
            reverse=True,
        )

    return _diversify(chunks, order, k, per_source_cap)


def _diversify(chunks: list[Chunk], order, k: int, cap: int) -> list[Chunk]:
    """Take the top-k by rank but cap chunks per source file, so a document that
    splits into many chunks (e.g. a prose MD&A) can't crowd out the financial
    statements (each a single chunk). Falls back to pure rank if the cap can't fill k.
    """
    picked: list[int] = []
    seen: dict[str, int] = {}
    for i in order:
        src = chunks[i].source
        if seen.get(src, 0) >= cap:
            continue
        picked.append(i)
        seen[src] = seen.get(src, 0) + 1
        if len(picked) >= k:
            break
    if len(picked) < k:  # under-filled because everything hit the cap → top up by rank
        for i in order:
            if i not in picked:
                picked.append(i)
                if len(picked) >= k:
                    break
    return [chunks[i] for i in picked]
