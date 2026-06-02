"""Local text embeddings for retrieval (fastembed / ONNX, CPU).

Decoupled from the chat provider: retrieval works offline and needs no API token.
The model is `bge-base-en-v1.5` — a strong general retrieval embedder.

Model resolution (so the packaged EXE is fully self-contained and offline):
  1. QOE_MODEL_CACHE env var, if set;
  2. the model bundled inside the EXE (sys._MEIPASS/models), when frozen;
  3. a local ./models cache, if present (created by the build's prefetch step);
  4. otherwise fastembed's default cache (downloads on first use).

If fastembed isn't importable at all, `AVAILABLE` is False and callers fall back
to keyword search.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np

MODEL_NAME = "BAAI/bge-base-en-v1.5"

try:
    from fastembed import TextEmbedding  # noqa: F401
    AVAILABLE = True
except Exception:  # pragma: no cover - import guard
    AVAILABLE = False

_MODEL = None


def _cache_dir() -> str | None:
    override = os.getenv("QOE_MODEL_CACHE")
    if override:
        return override
    if getattr(sys, "frozen", False):
        bundled = Path(getattr(sys, "_MEIPASS", ".")) / "models"
        return str(bundled) if bundled.exists() else None
    local = Path("models")
    return str(local) if local.exists() else None


def _model():
    global _MODEL
    if _MODEL is None:
        from fastembed import TextEmbedding
        cache = _cache_dir()
        _MODEL = (
            TextEmbedding(model_name=MODEL_NAME, cache_dir=cache)
            if cache
            else TextEmbedding(model_name=MODEL_NAME)
        )
    return _MODEL


def embed(texts: list[str]) -> list[list[float]]:
    if not AVAILABLE:
        raise RuntimeError("fastembed not installed; retrieval falls back to keyword search")
    return [list(map(float, v)) for v in _model().embed(list(texts))]


def cosine_rank(query_vec, matrix) -> np.ndarray:
    """Cosine similarity of a query vector against a matrix of row vectors."""
    q = np.asarray(query_vec, dtype=np.float32)
    m = np.asarray(matrix, dtype=np.float32)
    denom = np.linalg.norm(m, axis=1) * np.linalg.norm(q) + 1e-9
    return (m @ q) / denom
