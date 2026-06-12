"""Web API + static host for the diligence workspace.

All JSON endpoints live under ``/api``; the built React dashboard (frontend/dist)
is served at ``/`` when present, so the whole app runs from a single origin — which
is what lets it ship as one self-contained desktop EXE. Run:

    uvicorn qoe.api:app --reload     # dev (dashboard runs separately on :5173)
    python desktop.py                # one process: serve dashboard + open it
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import shutil
import sys
import zipfile
from pathlib import Path

from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import (
    databook,
    diligence,
    diligence_matrix,
    embeddings,
    financials,
    ingest,
    profiling,
    qoe,
    readiness,
    redflags,
    retrieval,
    search,
    store,
    taxonomy,
    working_capital,
)
from .config import settings

app = FastAPI(title="QoE Diligence Workspace", version="0.3.0")

# Harmless for the packaged single-origin app; convenient for the Vite dev server.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.on_event("startup")
async def _startup() -> None:
    store.init_db()
    # Calibrate embedding throughput once per machine; runs in a thread so startup isn't blocked.
    if embeddings.AVAILABLE:
        asyncio.create_task(asyncio.to_thread(embeddings.calibrate))


# --------------------------------------------------------------------- /api routes

api = APIRouter(prefix="/api")


class ProjectIn(BaseModel):
    name: str
    company: str | None = None


class AskIn(BaseModel):
    question: str


class TrackerIn(BaseModel):
    title: str
    category: str | None = None
    owner: str | None = None
    note: str | None = None


class TrackerPatch(BaseModel):
    title: str | None = None
    category: str | None = None
    status: str | None = None
    owner: str | None = None
    note: str | None = None


class MatrixQuestionIn(BaseModel):
    question: str
    category: str | None = None


class MatrixQuestionPatch(BaseModel):
    question: str | None = None
    category: str | None = None


# The standard diligence request list used to seed an empty tracker.
DEFAULT_TRACKERS: list[tuple[str, str]] = [
    ("Obtain 3 years of audited financial statements", "Finance"),
    ("Confirm revenue-recognition policy & period-end cut-off", "Finance"),
    ("Net working capital trend & proposed peg", "Finance"),
    ("Detail of management add-backs with supporting evidence", "Finance"),
    ("Customer concentration schedule (top 10 customers)", "Commercial"),
    ("Aged accounts-receivable & bad-debt history", "Accounting"),
    ("Three years of federal & state tax returns", "Tax"),
    ("Material customer & supplier contracts", "Legal"),
    ("Debt schedule & credit agreements", "Legal"),
    ("Pending or threatened litigation summary", "Legal"),
    ("Org chart & key-employee compensation", "HR"),
    ("IT systems & cybersecurity overview", "IT"),
]


@api.get("/health")
def health() -> dict:
    return {"status": "ok", "embeddings": embeddings.AVAILABLE, "model": settings.model}


@api.get("/projects")
def list_projects() -> list[dict]:
    return store.list_projects()


@api.post("/projects")
def create_project(body: ProjectIn) -> dict:
    return store.create_project(body.name, body.company)


@api.get("/projects/{pid}")
def get_project(pid: str) -> dict:
    project = store.get_project(pid)
    if not project:
        raise HTTPException(404, "project not found")
    return {**project, "documents": store.list_documents(pid)}


@api.delete("/projects/{pid}")
def delete_project(pid: str) -> dict:
    """Delete a deal and all of its data (documents, chunks, analyses, trackers, files)."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    store.delete_project(pid)
    shutil.rmtree(settings.data_root / "projects" / pid, ignore_errors=True)
    return {"ok": True}


# Small batches keep progress updates frequent; tuned for single-thread CPU embedding.
_EMBED_BATCH = 8


def _ingest_one(pid: str, did: str, path: Path) -> None:
    """Parse + embed one file in a background thread, streaming progress into the DB."""
    try:
        chunks = ingest.load_file(path)
        n = len(chunks)
        store.update_document(did, chunks_total=n)

        if embeddings.AVAILABLE and chunks:
            spc = embeddings.secs_per_chunk()
            texts = [c.text for c in chunks]
            embs: list[list[float]] = []
            for i in range(0, n, _EMBED_BATCH):
                embs.extend(embeddings.embed(texts[i : i + _EMBED_BATCH]))
                done = min(i + _EMBED_BATCH, n)
                store.update_document(did, chunks_done=done,
                                      eta_seconds=max(0.0, (n - done) * spc))
        else:
            embs = None

        store.add_chunks(pid, did, chunks, embs)
        store.update_document(did, status="ingested", n_chunks=n,
                              chunks_done=n, eta_seconds=0.0)
    except Exception:
        store.update_document(did, status="error")


def _ingest_many(pid: str, members: list[tuple[str, Path]]) -> None:
    """Process a batch of (doc_id, path) pairs sequentially — avoids CPU contention
    from parallel embed workers all thrashing the same cores."""
    for did, path in members:
        _ingest_one(pid, did, path)


@api.post("/projects/{pid}/documents")
async def upload_document(pid: str, file: UploadFile = File(...)) -> dict:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")

    data = await file.read()
    digest = hashlib.sha256(data).hexdigest()
    existing = store.find_document_by_hash(pid, digest)
    if existing:
        return {**existing, "duplicate": True}

    dest_dir = settings.data_root / "projects" / pid
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "upload").name
    path = dest_dir / safe_name
    path.write_bytes(data)
    kind = path.suffix.lower().lstrip(".")
    doc = store.add_document(pid, safe_name, str(path), kind, "indexing", 0, content_hash=digest)

    asyncio.create_task(asyncio.to_thread(_ingest_one, pid, doc["id"], path))
    return {**doc, "duplicate": False}


@api.post("/projects/{pid}/documents/bulk")
async def upload_bulk(pid: str, file: UploadFile = File(...)) -> dict:
    """Ingest a whole data room from a single .zip — files are queued immediately and
    embedded in the background; the response returns as soon as files are written."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    try:
        zf = zipfile.ZipFile(io.BytesIO(await file.read()))
    except zipfile.BadZipFile:
        raise HTTPException(400, "not a valid .zip file")

    dest_dir = settings.data_root / "projects" / pid
    dest_dir.mkdir(parents=True, exist_ok=True)

    ingested, duplicates, skipped = [], [], []
    members: list[tuple[str, Path]] = []

    for name in zf.namelist():
        base = Path(name).name
        if name.endswith("/") or not base or base.startswith("."):
            continue
        if Path(base).suffix.lower() not in ingest.SUPPORTED:
            skipped.append(base)
            continue
        data = zf.read(name)
        digest = hashlib.sha256(data).hexdigest()
        existing = store.find_document_by_hash(pid, digest)
        if existing:
            duplicates.append(base)
            continue
        path = dest_dir / base
        path.write_bytes(data)
        kind = Path(base).suffix.lower().lstrip(".")
        doc = store.add_document(pid, base, str(path), kind, "indexing", 0, content_hash=digest)
        ingested.append(base)
        members.append((doc["id"], path))

    if members:
        asyncio.create_task(asyncio.to_thread(_ingest_many, pid, members))
    return {"ingested": ingested, "duplicates": duplicates, "skipped": skipped}


@api.get("/projects/{pid}/search")
def search_documents(pid: str, q: str, k: int = 20, kind: str | None = None) -> list[dict]:
    """Cross-document search over the data room (semantic, keyword fallback)."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return search.search(pid, q, k=k, kind=kind)


@api.get("/projects/{pid}/profile")
def profile_dataroom(pid: str) -> list[dict]:
    """Per-column statistics + data-quality flags for every tabular document."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return profiling.profile_project(pid)


@api.get("/projects/{pid}/documents")
def list_documents(pid: str) -> list[dict]:
    return store.list_documents(pid)


@api.get("/projects/{pid}/documents/{doc_id}/status")
def document_status(pid: str, doc_id: str) -> dict:
    """Ingest progress for a single document — polled by the UI during background indexing."""
    doc = store.get_document(doc_id)
    if not doc or doc["project_id"] != pid:
        raise HTTPException(404, "document not found")
    return {
        "id": doc_id,
        "status": doc["status"],
        "n_chunks": doc["n_chunks"] or 0,
        "chunks_total": doc.get("chunks_total") or 0,
        "chunks_done": doc.get("chunks_done") or 0,
        "eta_seconds": doc.get("eta_seconds"),
    }


@api.get("/projects/{pid}/documents/{doc_id}/content")
def document_content(pid: str, doc_id: str) -> dict:
    """Raw source content for the evidence viewer (text for csv/md/txt; extracted text otherwise)."""
    doc = store.get_document(doc_id)
    if not doc or doc["project_id"] != pid:
        raise HTTPException(404, "document not found")
    path = Path(doc["path"])
    if path.suffix.lower() in {".csv", ".md", ".txt"} and path.exists():
        content = path.read_text(encoding="utf-8", errors="ignore")
    else:
        chunks = [c for c in store.get_chunks(pid) if c["document_id"] == doc_id]
        content = "\n\n".join(c["text"] for c in chunks)
    return {"id": doc_id, "filename": doc["filename"], "kind": doc["kind"], "content": content}


def _labeled_dataroom(pid: str) -> str:
    """The whole data room as one text, grouped by source file so the model can cite
    filenames as evidence. Shared by the QoE, red-flag and working-capital passes."""
    rows = store.get_chunks(pid)
    if not rows:
        raise HTTPException(400, "no documents in project — upload the data room first")
    return "\n\n".join(f"=== {r['source']} ===\n{r['text']}" for r in rows)[:60000]


@api.post("/projects/{pid}/qoe")
def run_qoe(pid: str) -> dict:
    return store.save_report(pid, "qoe", qoe.analyze(_labeled_dataroom(pid)).model_dump())


@api.post("/projects/{pid}/redflags")
def run_redflags(pid: str) -> dict:
    return store.save_report(pid, "redflags", redflags.scan(_labeled_dataroom(pid)).model_dump())


@api.post("/projects/{pid}/working-capital")
def run_working_capital(pid: str) -> dict:
    return store.save_report(pid, "working_capital", working_capital.analyze(_labeled_dataroom(pid)).model_dump())


@api.get("/projects/{pid}/financials")
def get_financials(pid: str) -> dict:
    """Structured financial time-series parsed from the statement tables (offline)."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return financials.extract(pid)


@api.get("/projects/{pid}/databook.xlsx")
def download_databook(pid: str):
    """The Excel databook — every schedule (financials, bridge, NWC, red flags,
    readiness, profile) in one workbook, the deliverable that ships with the PDF."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    content = databook.build(pid)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="databook-{pid[:8]}.xlsx"'},
    )


@api.get("/projects/{pid}/reports/{kind}")
def get_cached_report(pid: str, kind: str) -> dict | None:
    """The most recent saved result for a kind (qoe / redflags / working_capital), or null."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return store.get_report(pid, kind)


@api.get("/projects/{pid}/readiness")
def get_readiness(pid: str) -> dict:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return readiness.assess(pid)


@api.get("/projects/{pid}/taxonomy")
def get_taxonomy(pid: str) -> dict:
    """File each document into the standard data-room categories (Datasite-style)."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return taxonomy.categorize(pid)


@api.get("/projects/{pid}/trackers")
def list_trackers(pid: str) -> list[dict]:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return store.list_tracker_items(pid)


@api.post("/projects/{pid}/trackers")
def create_tracker(pid: str, body: TrackerIn) -> dict:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return store.add_tracker_item(pid, body.title, body.category, body.owner, body.note)


@api.post("/projects/{pid}/trackers/seed")
def seed_trackers(pid: str) -> list[dict]:
    """Populate the standard diligence request checklist (only if the tracker is empty)."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    if not store.list_tracker_items(pid):
        for title, category in DEFAULT_TRACKERS:
            store.add_tracker_item(pid, title, category)
    return store.list_tracker_items(pid)


@api.patch("/projects/{pid}/trackers/{item_id}")
def patch_tracker(pid: str, item_id: str, body: TrackerPatch) -> dict:
    item = store.get_tracker_item(item_id)
    if not item or item["project_id"] != pid:
        raise HTTPException(404, "tracker item not found")
    return store.update_tracker_item(item_id, **body.model_dump(exclude_none=True))


@api.delete("/projects/{pid}/trackers/{item_id}")
def remove_tracker(pid: str, item_id: str) -> dict:
    item = store.get_tracker_item(item_id)
    if not item or item["project_id"] != pid:
        raise HTTPException(404, "tracker item not found")
    store.delete_tracker_item(item_id)
    return {"ok": True}


@api.get("/matrix/template")
def matrix_template() -> list[dict]:
    """The standard diligence question set, used to seed a project's editable matrix."""
    return diligence_matrix.MATRIX_TEMPLATE


def _seed_matrix(pid: str) -> None:
    for group in diligence_matrix.MATRIX_TEMPLATE:
        for q in group["questions"]:
            store.add_matrix_question(pid, group["category"], q)


@api.get("/projects/{pid}/matrix")
def get_matrix(pid: str) -> list[dict]:
    """The project's editable diligence questions; seeded from the standard set the first time."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    questions = store.list_matrix_questions(pid)
    if not questions:
        _seed_matrix(pid)
        questions = store.list_matrix_questions(pid)
    return questions


@api.post("/projects/{pid}/matrix")
def add_matrix_question(pid: str, body: MatrixQuestionIn) -> dict:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    return store.add_matrix_question(pid, body.category, body.question)


@api.patch("/projects/{pid}/matrix/{qid}")
def patch_matrix_question(pid: str, qid: str, body: MatrixQuestionPatch) -> dict:
    q = store.get_matrix_question(qid)
    if not q or q["project_id"] != pid:
        raise HTTPException(404, "question not found")
    return store.update_matrix_question(qid, **body.model_dump(exclude_none=True))


@api.delete("/projects/{pid}/matrix/{qid}")
def delete_matrix_question(pid: str, qid: str) -> dict:
    q = store.get_matrix_question(qid)
    if not q or q["project_id"] != pid:
        raise HTTPException(404, "question not found")
    store.delete_matrix_question(qid)
    return {"ok": True}


@api.post("/projects/{pid}/matrix/reset")
def reset_matrix(pid: str) -> list[dict]:
    """Discard custom questions and restore the standard diligence set."""
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    store.clear_matrix_questions(pid)
    _seed_matrix(pid)
    return store.list_matrix_questions(pid)


@api.post("/projects/{pid}/ask")
def ask(pid: str, body: AskIn) -> dict:
    if not store.get_project(pid):
        raise HTTPException(404, "project not found")
    chunks = retrieval.search(pid, body.question)
    return diligence.answer(body.question, chunks).model_dump()


app.include_router(api)


# ---------------------------------------------------- serve the built dashboard

def _static_dir() -> Path | None:
    """Locate frontend/dist — bundled by PyInstaller (_MEIPASS) or in the repo."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
    dist = base / "frontend" / "dist"
    return dist if dist.exists() else None


_static = _static_dir()
if _static is not None:
    # Mounted last so /api/* and /docs win; everything else serves the SPA.
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="app")
