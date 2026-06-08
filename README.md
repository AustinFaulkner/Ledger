# Ledger — QoE & Diligence Analyzer

An AI quality-of-earnings and due-diligence tool for private-equity deal teams. Upload a target's data room and it produces a normalized EBITDA bridge, working-capital and red-flag analysis, cited answers, and an exportable report — all grounded in the source documents.

## Features

- **Quality of Earnings** — reported → normalized EBITDA bridge with each add-back classified.
- **Working capital & proof of cash** — NWC components, a target peg, and debt-like items.
- **Red flags** — ranked earnings-quality risks, each tied to a source quote.
- **Diligence matrix** — an editable, per-deal question set answered across every document at once.
- **Cited Q&A** — answers link back to the exact sentence in the source.
- **Data room** — PDF, Excel, Word, PowerPoint, CSV, and more; ZIP upload, dedup, search, profiling, readiness, and auto-categorization.
- **Report** — print to PDF or export an Excel databook.
- **Provider-agnostic** — runs on any OpenAI-compatible endpoint (Qwen, OpenAI, OpenRouter, Bedrock) with one env var. Bring your own token.

## Project Structure

| Path | What it does |
|---|---|
| `src/qoe/` | FastAPI backend: analysis, retrieval, storage |
| `src/qoe/llm.py` | Provider-agnostic LLM client |
| `src/qoe/qoe.py`, `working_capital.py`, `redflags.py` | Analysis passes |
| `src/qoe/ingest.py` | Document parsing and chunking |
| `src/qoe/api.py` | HTTP API and dashboard host |
| `frontend/` | React + Vite dashboard |
| `desktop.py`, `ledger.spec` | Desktop EXE launcher and build spec |
| `Dockerfile` | Linux web-app image |
| `eval/` | Accuracy benchmark over known-answer accounting problems |

## Requirements

- Python 3.11+
- Node 20+ (to build the dashboard)
- An API key for any OpenAI-compatible LLM endpoint

## Build

Desktop app (single Windows EXE):

```bat
build_exe.bat
```

Output is `dist_exe\LedgerDiligence.exe`. Put a `.env` (with `LLM_API_KEY`) next to it and double-click.

Docker (Linux web app):

```bash
docker build -t ledger-diligence .
docker run -p 8000:8000 --env-file .env ledger-diligence
```

From source:

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python desktop.py
```

## Usage

1. Create a deal and upload its documents (or drop in a `.zip`).
2. Run Quality of Earnings, Working Capital, and Red Flags.
3. Ask questions or run the diligence matrix.
4. Open the Report tab to print a PDF or download the Excel databook.

Citations are clickable — selecting one opens the source document and highlights the supporting text.

## How It Works

Documents are parsed, chunked, and embedded locally (`bge-base`, ONNX), so search needs no API key. Analysis and Q&A call the LLM client in `llm.py`, which detects the provider from the token and routes to it; a thinking model handles analysis and a faster model handles chat. Results and citations are stored per deal in SQLite, and an analysis is flagged stale when its documents change.

## Tech Stack

Python · FastAPI · React · Vite · TypeScript · Tailwind · SQLite · fastembed/ONNX · PyInstaller · Docker

## License

MIT
