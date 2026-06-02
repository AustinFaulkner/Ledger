# QoE & Diligence Analyzer

> AI-assisted **Quality of Earnings** and due-diligence analysis for private-equity deal teams.
> Point it at a target company's financial statements and data-room documents; it returns a
> **normalized EBITDA bridge** (with flagged add-backs and non-recurring items), extracts key
> contract terms, and answers diligence questions **with citations** back to the source documents.

Built with Python, a **provider-agnostic LLM layer** (runs on a self-hosted **Qwen on AWS** via any
OpenAI-compatible endpoint, or Amazon Bedrock — swap with one env var), FastAPI, and a local vector
index for retrieval. Ships with an **evaluation harness** benchmarked against a set of verified
accounting problems, so the model's financial reasoning is measured, not assumed.

---

## Why this exists

A Quality-of-Earnings review is the analytical core of nearly every PE deal — and it's expensive,
slow, and manual. This tool drafts the first pass: it reads the numbers, proposes EBITDA
normalizations, flags revenue-recognition and one-time-item concerns, and lets an analyst
interrogate the data room in plain English. A human still signs off; the machine does the legwork.

## Features

- **Automated QoE pass** — normalizes EBITDA, classifies add-backs (one-time vs. recurring), surfaces
  revenue-quality and working-capital concerns.
- **Cited Q&A over the data room** — retrieval-augmented answers that link back to the exact source.
- **Key-term extraction** — pulls material terms from contracts and agreements.
- **Verified eval harness** — accuracy scored against known-answer accounting problems (see `eval/`).

## Architecture

```
              ┌────────────┐     ┌──────────────┐     ┌─────────────────┐
  data room → │  ingest.py │  →  │  index (RAG) │  →  │  diligence.py   │ → cited answers
  (pdf/xlsx/  │ (parse +   │     │  (chunk +    │     │  (orchestrator) │ → QoE report
   csv/docx)  │  chunk)    │     │   embed)     │     └────────┬────────┘
              └────────────┘     └──────────────┘              │
                                          ┌────────────────────┴───────────┐
                                          │            qoe.py              │
                                          │  EBITDA normalization +        │
                                          │  add-back / one-time flagging  │
                                          │  (LLM, structured output)      │
                                          └────────────────────────────────┘
```

Everything routes through `llm.py`, a thin wrapper over the Anthropic SDK.

## Web dashboard (the workspace)

The primary interface is a **React "deal room" dashboard** — create a Project, drag in the data
room, generate the QoE report, and ask cited questions. Two terminals:

```bash
# 1) backend (repo root)
pip install -e .
copy .env.example .env                  # paste your LLM_API_KEY
uvicorn qoe.api:app --reload            # http://localhost:8000

# 2) dashboard
cd frontend && npm install && npm run dev   # http://localhost:5173
```

See `frontend/README.md` for details.

## Desktop app (single EXE)

Compile the whole thing — backend + dashboard — into one double-click Windows executable:

```bat
build_exe.bat
```

Output: `dist_exe\LedgerDiligence.exe`. Drop a `.env` (with `LLM_API_KEY`) next to it, double-click,
and the app opens in its own window — no Python, Node, or browser setup required. Data (SQLite +
uploaded files) lives in `%USERPROFILE%\.ledger`. From source you can run the same launcher with
`python desktop.py`.

The EXE is **fully self-contained and offline** — the on-device embedding model
(`bge-base-en-v1.5`, ONNX) is prefetched into `models/` at build time and bundled in, so cited
retrieval is real semantic search with no first-run download and no API token. It's a large binary
(~0.5 GB) by design; correctness over size. The only network call at runtime is to your chosen LLM
provider for the QoE/chat generations.

## Quickstart (CLI)

```bash
python -m venv .venv && .venv\Scripts\activate        # Windows
pip install -e .
copy .env.example .env                                 # then set LLM_PROVIDER + LLM_BASE_URL/LLM_MODEL
qoe ingest data/sample/                                # build the index
qoe qoe data/sample/                                   # run the Quality-of-Earnings pass
qoe ask "What add-backs did management propose, and are they defensible?"
```

Or run the API:

```bash
uvicorn qoe.api:app --reload
```

## Validate it yourself (bring your own token)

No infrastructure required — point it at any hosted Qwen behind an OpenAI-compatible API:

```bash
copy .env.example .env        # default targets OpenRouter's Qwen
# paste your key into LLM_API_KEY (works with OpenRouter / Together / Fireworks / DashScope / OpenAI)
qoe doctor                    # confirms the endpoint + token are live
python eval/run_eval.py       # reproduce the benchmarked financial-reasoning accuracy
```

`qoe doctor` is a one-call connectivity check; the eval harness is the real validation —
it scores the model against known-answer accounting problems.

## Project layout

| Path | What it does |
|---|---|
| `src/qoe/config.py` | Settings (model id, API key, paths) |
| `src/qoe/llm.py` | Anthropic client wrapper (messages, structured output, PDF input) |
| `src/qoe/ingest.py` | Load + chunk financial statements and data-room docs |
| `src/qoe/qoe.py` | EBITDA normalization + add-back / one-time-item analysis |
| `src/qoe/diligence.py` | Orchestration: cited Q&A + key-term extraction |
| `src/qoe/cli.py` | `qoe` command-line entrypoint |
| `src/qoe/api.py` | FastAPI app |
| `eval/` | Verified-answer accuracy benchmark (see `eval/README.md`) |
| `data/sample/` | Drop a synthetic "NewCo" financial statement set here |

## Data

This repo ships **no proprietary data**. For demos, use a synthetic company assembled from public
or coursework components, or public SEC EDGAR filings. See `data/sample/README` (gitkept) for the
expected shape.

## Status

Scaffold — module interfaces and the eval harness are stubbed with `TODO`s. Built as a portfolio
project demonstrating applied AI for PE value creation.

## License

MIT
