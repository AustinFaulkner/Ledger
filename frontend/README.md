# LEDGER — Diligence Dashboard

The web front-end for the QoE & Diligence Analyzer. A refined "deal room": open a Project,
drop in the data room, generate the QoE EBITDA bridge, and ask cited diligence questions.

Stack: Vite + React + TypeScript + Tailwind, with Framer Motion for entrance motion.
Type: Fraunces (display) · Hanken Grotesk (UI) · IBM Plex Mono (figures).

## Run it (two terminals)

**1) Backend** (from the repo root):
```bash
pip install -e .
copy .env.example .env          # paste your LLM_API_KEY
uvicorn qoe.api:app --reload    # serves http://localhost:8000
```

**2) Front-end** (from `frontend/`):
```bash
npm install
npm run dev                     # serves http://localhost:5173
```

Open http://localhost:5173. The dashboard talks to the backend at `http://localhost:8000`
(override with `VITE_API_BASE`).

## Flow
1. **Open a deal** — name + target company.
2. **Data Room** — drag in PDF/Excel/CSV/Word; each file is parsed, chunked, and embedded.
3. **Quality of Earnings** — one click generates the normalized-EBITDA bridge + flagged adjustments.
4. **Diligence** — ask questions; answers cite the source document and locator.

> The QoE and Q&A panels call the model, so the backend needs a working `LLM_API_KEY`
> (`qoe doctor` from the repo root confirms it). The data-room upload works without a model.
