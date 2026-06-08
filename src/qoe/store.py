"""SQLite persistence for Projects, Documents, and Chunks.

A Project is one company/engagement being diligenced; Documents are its data-room
files; Chunks are the retrievable text (with embeddings) extracted from them.
Stdlib sqlite3 keeps the whole thing dependency-free and laptop-friendly.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone

from .config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return uuid.uuid4().hex


def _conn() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(settings.db_path)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    con = _conn()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, filename TEXT NOT NULL,
            path TEXT NOT NULL, kind TEXT, status TEXT, n_chunks INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, document_id TEXT NOT NULL,
            ord INTEGER, text TEXT NOT NULL, source TEXT, locator TEXT, embedding TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id);
        CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL,
            payload TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id, kind);
        CREATE TABLE IF NOT EXISTS tracker_items (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
            category TEXT, status TEXT NOT NULL DEFAULT 'open', owner TEXT, note TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_trackers_project ON tracker_items(project_id);
        CREATE TABLE IF NOT EXISTS matrix_questions (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT,
            question TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_matrix_project ON matrix_questions(project_id);
        """
    )
    # migration: content_hash for de-duplication (older DBs predate this column)
    cols = {r[1] for r in con.execute("PRAGMA table_info(documents)").fetchall()}
    if "content_hash" not in cols:
        con.execute("ALTER TABLE documents ADD COLUMN content_hash TEXT")
    # migration: fingerprint on reports (the data-room state an analysis was run against)
    rcols = {r[1] for r in con.execute("PRAGMA table_info(reports)").fetchall()}
    if "fingerprint" not in rcols:
        con.execute("ALTER TABLE reports ADD COLUMN fingerprint TEXT")
    con.commit()
    con.close()


def dataroom_fingerprint(project_id: str) -> str:
    """A hash of the project's document set — changes when a file is added, modified
    (new content hash) or removed. Lets us flag a cached analysis as out of date."""
    con = _conn()
    rows = con.execute(
        "SELECT content_hash, id FROM documents WHERE project_id=? ORDER BY id", (project_id,)
    ).fetchall()
    con.close()
    h = hashlib.sha256()
    for r in rows:
        h.update(((r["content_hash"] or r["id"] or "") + "|").encode())
    return h.hexdigest()


# --- projects ---

def create_project(name: str, company: str | None = None) -> dict:
    pid = _uid()
    con = _conn()
    con.execute("INSERT INTO projects (id, name, company, created_at) VALUES (?,?,?,?)",
                (pid, name, company, _now()))
    con.commit()
    con.close()
    return get_project(pid)  # type: ignore[return-value]


def list_projects() -> list[dict]:
    con = _conn()
    rows = con.execute(
        "SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) AS n_documents "
        "FROM projects p ORDER BY p.created_at DESC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_project(pid: str) -> dict | None:
    con = _conn()
    row = con.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    con.close()
    return dict(row) if row else None


def delete_project(pid: str) -> None:
    """Delete a project and everything belonging to it (chunks, documents, cached
    reports, tracker items, matrix questions). On-disk files are removed by the caller."""
    con = _conn()
    for table in ("chunks", "documents", "reports", "tracker_items", "matrix_questions"):
        con.execute(f"DELETE FROM {table} WHERE project_id=?", (pid,))
    con.execute("DELETE FROM projects WHERE id=?", (pid,))
    con.commit()
    con.close()


# --- documents ---

def add_document(project_id: str, filename: str, path: str, kind: str,
                 status: str = "ingested", n_chunks: int = 0,
                 content_hash: str | None = None) -> dict:
    did = _uid()
    con = _conn()
    con.execute(
        "INSERT INTO documents (id, project_id, filename, path, kind, status, n_chunks, "
        "created_at, content_hash) VALUES (?,?,?,?,?,?,?,?,?)",
        (did, project_id, filename, path, kind, status, n_chunks, _now(), content_hash),
    )
    con.commit()
    con.close()
    return get_document(did)  # type: ignore[return-value]


def find_document_by_hash(project_id: str, content_hash: str) -> dict | None:
    """Return an existing document in the project with the same content hash, if any."""
    con = _conn()
    row = con.execute(
        "SELECT * FROM documents WHERE project_id=? AND content_hash=? LIMIT 1",
        (project_id, content_hash),
    ).fetchone()
    con.close()
    return dict(row) if row else None


def get_document(did: str) -> dict | None:
    con = _conn()
    row = con.execute("SELECT * FROM documents WHERE id=?", (did,)).fetchone()
    con.close()
    return dict(row) if row else None


def list_documents(project_id: str) -> list[dict]:
    con = _conn()
    rows = con.execute("SELECT * FROM documents WHERE project_id=? ORDER BY created_at",
                       (project_id,)).fetchall()
    con.close()
    return [dict(r) for r in rows]


# --- chunks ---

def add_chunks(project_id: str, document_id: str, chunks, embeddings_list=None) -> None:
    con = _conn()
    for i, c in enumerate(chunks):
        emb = json.dumps(embeddings_list[i]) if embeddings_list is not None else None
        con.execute(
            "INSERT INTO chunks (id, project_id, document_id, ord, text, source, locator, embedding) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (_uid(), project_id, document_id, i, c.text, c.source, c.locator, emb),
        )
    con.commit()
    con.close()


def get_chunks(project_id: str) -> list[dict]:
    con = _conn()
    rows = con.execute("SELECT * FROM chunks WHERE project_id=?", (project_id,)).fetchall()
    con.close()
    out = []
    for r in rows:
        d = dict(r)
        d["embedding"] = json.loads(d["embedding"]) if d["embedding"] else None
        out.append(d)
    return out


# --- cached analysis results (so the report compiles without re-running paid models) ---

def save_report(project_id: str, kind: str, payload: dict) -> dict:
    """Persist an analysis result (qoe / redflags / working_capital) for later reuse,
    stamped with the data-room fingerprint it was generated against."""
    con = _conn()
    con.execute(
        "INSERT INTO reports (id, project_id, kind, payload, created_at, fingerprint) VALUES (?,?,?,?,?,?)",
        (_uid(), project_id, kind, json.dumps(payload), _now(), dataroom_fingerprint(project_id)),
    )
    con.commit()
    con.close()
    return payload


def get_report(project_id: str, kind: str) -> dict | None:
    """Return the most recent saved result for a kind, with its timestamp and whether the
    data room has changed since (``stale``), or None if never run."""
    con = _conn()
    row = con.execute(
        "SELECT payload, created_at, fingerprint FROM reports WHERE project_id=? AND kind=? "
        "ORDER BY created_at DESC LIMIT 1",
        (project_id, kind),
    ).fetchone()
    con.close()
    if not row:
        return None
    return {
        "payload": json.loads(row["payload"]),
        "created_at": row["created_at"],
        "stale": (row["fingerprint"] or "") != dataroom_fingerprint(project_id),
    }


# --- diligence trackers (issues / request checklist) ---

def add_tracker_item(project_id: str, title: str, category: str | None = None,
                     owner: str | None = None, note: str | None = None,
                     status: str = "open") -> dict:
    tid = _uid()
    con = _conn()
    con.execute(
        "INSERT INTO tracker_items (id, project_id, title, category, status, owner, note, created_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (tid, project_id, title, category, status, owner, note, _now()),
    )
    con.commit()
    con.close()
    return get_tracker_item(tid)  # type: ignore[return-value]


def get_tracker_item(item_id: str) -> dict | None:
    con = _conn()
    row = con.execute("SELECT * FROM tracker_items WHERE id=?", (item_id,)).fetchone()
    con.close()
    return dict(row) if row else None


def list_tracker_items(project_id: str) -> list[dict]:
    con = _conn()
    rows = con.execute(
        "SELECT * FROM tracker_items WHERE project_id=? ORDER BY created_at", (project_id,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def update_tracker_item(item_id: str, **fields) -> dict | None:
    allowed = {k: v for k, v in fields.items() if k in {"title", "category", "status", "owner", "note"}}
    if allowed:
        con = _conn()
        sets = ", ".join(f"{k}=?" for k in allowed)
        con.execute(f"UPDATE tracker_items SET {sets} WHERE id=?", (*allowed.values(), item_id))
        con.commit()
        con.close()
    return get_tracker_item(item_id)


def delete_tracker_item(item_id: str) -> None:
    con = _conn()
    con.execute("DELETE FROM tracker_items WHERE id=?", (item_id,))
    con.commit()
    con.close()


# --- editable diligence-matrix questions (per project) ---

def add_matrix_question(project_id: str, category: str | None, question: str) -> dict:
    qid = _uid()
    con = _conn()
    con.execute(
        "INSERT INTO matrix_questions (id, project_id, category, question, created_at) VALUES (?,?,?,?,?)",
        (qid, project_id, category, question, _now()),
    )
    con.commit()
    con.close()
    return get_matrix_question(qid)  # type: ignore[return-value]


def get_matrix_question(qid: str) -> dict | None:
    con = _conn()
    row = con.execute("SELECT * FROM matrix_questions WHERE id=?", (qid,)).fetchone()
    con.close()
    return dict(row) if row else None


def list_matrix_questions(project_id: str) -> list[dict]:
    con = _conn()
    rows = con.execute(
        "SELECT * FROM matrix_questions WHERE project_id=? ORDER BY created_at", (project_id,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def update_matrix_question(qid: str, **fields) -> dict | None:
    allowed = {k: v for k, v in fields.items() if k in {"category", "question"}}
    if allowed:
        con = _conn()
        sets = ", ".join(f"{k}=?" for k in allowed)
        con.execute(f"UPDATE matrix_questions SET {sets} WHERE id=?", (*allowed.values(), qid))
        con.commit()
        con.close()
    return get_matrix_question(qid)


def delete_matrix_question(qid: str) -> None:
    con = _conn()
    con.execute("DELETE FROM matrix_questions WHERE id=?", (qid,))
    con.commit()
    con.close()


def clear_matrix_questions(project_id: str) -> None:
    con = _conn()
    con.execute("DELETE FROM matrix_questions WHERE project_id=?", (project_id,))
    con.commit()
    con.close()
