import { useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { Answer, Citation } from "../types";

interface Turn {
  q: string;
  a?: Answer;
  error?: string;
}

const EXAMPLES = [
  "What add-backs did management propose, and are they defensible?",
  "Summarize customer concentration.",
  "What are the key terms of the largest contract?",
];

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

/** Render an answer where each citation's `claim` (a span of the answer) becomes a
 *  hover-highlightable, clickable in-text reference. Locates the claim in the answer
 *  (whitespace-tolerant) and wraps it; unmatched citations fall back to a small footer. */
function CitedAnswer({
  answer,
  citations,
  onCite,
}: {
  answer: string;
  citations: Citation[];
  onCite: (source: string, quote: string, claim?: string) => void;
}) {
  type Span = { start: number; end: number; c: Citation };
  const spans: Span[] = [];
  for (const c of citations) {
    const claim = (c.claim || "").trim();
    if (claim.length < 4) continue;
    let idx = answer.toLowerCase().indexOf(claim.toLowerCase());
    let len = claim.length;
    if (idx === -1) {
      try {
        const re = new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
        const m = answer.match(re);
        if (m && m.index !== undefined) {
          idx = m.index;
          len = m[0].length;
        }
      } catch {
        /* ignore bad regex */
      }
    }
    if (idx >= 0) spans.push({ start: idx, end: idx + len, c });
  }
  spans.sort((a, b) => a.start - b.start);
  const clean: Span[] = [];
  let lastEnd = -1;
  for (const s of spans) {
    if (s.start >= lastEnd) {
      clean.push(s);
      lastEnd = s.end;
    }
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  clean.forEach((s, n) => {
    if (s.start > cursor) nodes.push(<span key={`t${n}`}>{answer.slice(cursor, s.start)}</span>);
    const open = () => onCite(s.c.source, s.c.quote, s.c.claim);
    nodes.push(
      <span key={`c${n}`} className="cite-span" onClick={open} title={`${s.c.source}: ${s.c.quote}`}>
        {answer.slice(s.start, s.end)}
        <sup className="cite-marker">{n + 1}</sup>
      </span>
    );
    cursor = s.end;
  });
  if (cursor < answer.length) nodes.push(<span key="tail">{answer.slice(cursor)}</span>);

  const matched = new Set(clean.map((s) => s.c));
  const unmatched = citations.filter((c) => c.source && !matched.has(c));

  return (
    <>
      <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-parchment/90">{nodes}</p>
      {unmatched.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {unmatched.map((c, j) => (
            <button
              key={j}
              className="chip transition-colors hover:border-brass/60 hover:text-parchment"
              title={c.quote || c.claim}
              onClick={() => onCite(c.source, c.quote, c.claim)}
            >
              {c.source} ↗
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function ChatPanel({ projectId, hasDocs, onCite }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    const idx = turns.length;
    setTurns((t) => [...t, { q: question }]);
    try {
      const a = await api.ask(projectId, question);
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, a } : x)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, error: msg } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      {turns.length === 0 && (
        <div className="panel mb-6 p-7 text-center">
          <div className="eyebrow mb-2">Diligence Q&amp;A</div>
          <h2 className="font-display text-2xl text-parchment">Ask the data room</h2>
          <p className="mt-2 font-body text-sm text-muted">
            Answers are grounded in the uploaded documents and cite their source.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((x) => (
              <button key={x} className="chip transition-colors hover:border-brass/50 hover:text-parchment" onClick={() => setQ(x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {turns.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-line bg-surface2 px-4 py-2.5 font-body text-sm text-parchment">
                {t.q}
              </div>
            </div>
            {t.a && (
              <div className="panel p-5">
                <CitedAnswer answer={t.a.answer} citations={t.a.citations} onCite={onCite} />
                <p className="mt-3 font-mono text-[10.5px] text-muted/70">
                  Hover a citation to highlight it · click to open the source on the right
                </p>
              </div>
            )}
            {t.error && <p className="font-mono text-xs text-negative">{t.error}</p>}
            {!t.a && !t.error && (
              <div className="panel p-5">
                <span className="font-mono text-sm text-muted">Reading the data room…</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <form onSubmit={send} className="sticky bottom-0 mt-6 flex gap-3 bg-ink/80 py-3 backdrop-blur">
        <input
          className="field"
          placeholder={hasDocs ? "Ask a diligence question…" : "Upload documents first"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!hasDocs || busy}
        />
        <button className="btn" disabled={!hasDocs || busy || !q.trim()}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
