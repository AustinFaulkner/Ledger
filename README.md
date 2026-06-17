# Ledger: QoE & Diligence Analyzer

A demo AI/RAG app for quality-of-earnings and due-diligence work. Upload a
target company's data room and it produces a normalized-EBITDA bridge,
working-capital and red-flag analysis, cited answers to diligence questions,
and an exportable report.

## Features

- **Quality of earnings** — reported → normalized EBITDA, with every add-back classified.
- **Working capital & proof of cash** — NWC components, a target peg, and debt-like items.
- **Red flags** — ranked earnings-quality risks, each tied to a quote from the source documents.
- **Diligence matrix** — an editable per-deal question set, answered across all documents at once.
- **Cited Q&A** — every answer links back to the exact sentence it came from.
- **Data room** — PDF, Excel, Word, PowerPoint, CSV, and more; ZIP upload, dedup, search, profiling, readiness scoring, auto-categorization.
- **Report** — print to PDF or export an Excel databook.
- **Any provider** — runs on any OpenAI-compatible endpoint (OpenAI, OpenRouter, Qwen, Bedrock, self-hosted) with one env var. Bring your own token.

## Layout

| Path | Purpose |
|---|---|
| `src/qoe/` | FastAPI backend: analysis, retrieval, storage |
| `src/qoe/llm.py` | provider-agnostic LLM client |
| `src/qoe/qoe.py`, `working_capital.py`, `redflags.py` | the analysis passes |
| `src/qoe/ingest.py` | document parsing and chunking |
| `frontend/` | React + Vite dashboard |
| `desktop.py`, `ledger.spec` | desktop EXE launcher and build spec |
| `Dockerfile` | Linux web-app image |
| `eval/` | accuracy benchmark on known-answer accounting problems |
| `samples/` | two demo data rooms built from public SEC filings |

## Requirements

- Git, Python 3.11+, Node 20+ (to build the dashboard)
- An API key for any OpenAI-compatible LLM endpoint

## Build and run

The main target is a single Windows EXE:

```bat
build_exe.bat
```

That builds the dashboard, installs the dependencies, bundles the local
embedding model, and produces `dist_exe\LedgerDiligence.exe` (it takes a few
minutes). Create a `.env` (next section) in `dist_exe\` next to the EXE, then
double-click it.

Other ways to run:

```bash
# Docker (Linux web app)
docker build -t ledger-diligence .
docker run -p 8000:8000 --env-file .env ledger-diligence

# from source
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python desktop.py
```

## Configuration

```bash
copy .env.example .env        # Windows  (macOS/Linux: cp .env.example .env)
```

Paste your key into `LLM_API_KEY`. Any OpenAI-compatible token works — the app
detects the provider from the token, or set `LLM_PROVIDER` explicitly. The
defaults target a Qwen model on OpenRouter. The `.env` sits next to the EXE
(`dist_exe\`) for the desktop app, or in the project root for Docker and
source runs.

Only the AI analysis and Q&A need a key; upload, search, and profiling work
offline without one.

## Usage

1. Create a deal and upload its documents (or drop in a `.zip`).
2. Run Quality of Earnings, Working Capital, and Red Flags.
3. Ask questions, or run the diligence matrix.
4. Open the Report tab to print a PDF or download the Excel databook.

Citations are clickable: selecting one opens the source document with the
supporting text highlighted. Two sample data rooms built from real SEC filings
(CrowdStrike, Zscaler) ship in `samples/` — see
[samples/README.md](samples/README.md).

## How it works

Documents are parsed, chunked, and embedded locally (`bge-base`, ONNX), so
search needs no API key. Analysis and Q&A go through the client in `llm.py`,
which routes by provider; a reasoning model handles analysis and a faster model
handles chat. Results and citations are stored per deal in SQLite, and an
analysis is flagged stale when its documents change.

`eval/run_eval.py` benchmarks the configured model against known-answer
accounting cases (EBITDA normalization, deferred taxes, lease and revenue
accounting, working capital); add a case by dropping a JSON file in
`eval/cases/`.

## Tech Stack

Python · FastAPI · React · Vite · TypeScript · Tailwind · SQLite ·
fastembed/ONNX · PyInstaller · Docker

## License

MIT
