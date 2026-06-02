import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { Answer, MatrixGroup } from "../types";
import { cn } from "../lib";

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

type Cell = { status: "idle" | "running" | "done" | "error"; answer?: Answer; error?: string };
const CONCURRENCY = 3;

export default function DiligenceMatrix({ projectId, hasDocs, onCite }: Props) {
  const [template, setTemplate] = useState<MatrixGroup[]>([]);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getMatrixTemplate().then(setTemplate).catch((e) => setErr(String(e)));
  }, []);

  const questions = template.flatMap((g) => g.questions);
  const started = Object.keys(cells).length > 0;
  const doneCount = questions.filter((q) => cells[q]?.status === "done" || cells[q]?.status === "error").length;

  async function runAll() {
    if (!questions.length) return;
    setRunning(true);
    setCells(Object.fromEntries(questions.map((q) => [q, { status: "running" as const }])));
    let idx = 0;
    const worker = async () => {
      while (idx < questions.length) {
        const q = questions[idx++];
        try {
          const a = await api.ask(projectId, q);
          setCells((c) => ({ ...c, [q]: { status: "done", answer: a } }));
        } catch (e: unknown) {
          setCells((c) => ({ ...c, [q]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  if (!started) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="eyebrow mb-3">Diligence Matrix</div>
        <h2 className="font-display text-2xl text-parchment">Run the checklist across the data room</h2>
        <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted">
          A standard diligence question set, answered with citations over every document at once —
          {questions.length ? ` ${questions.length} questions` : ""} across {template.length} categories.
        </p>
        <button className="btn mt-7" disabled={running || !hasDocs || !questions.length} onClick={runAll}>
          {running ? "Running…" : "Run matrix →"}
        </button>
        {!hasDocs && <p className="mt-3 font-mono text-xs text-muted">Upload documents first.</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="panel flex items-center justify-between p-5">
        <div className="font-mono text-xs text-muted">
          {doneCount}/{questions.length} answered
          {running && <span className="ml-2 text-brass">· running…</span>}
        </div>
        <button className="btn-ghost text-xs" onClick={runAll} disabled={running}>
          {running ? "…" : "Re-run"}
        </button>
      </div>

      {template.map((group) => (
        <div key={group.category}>
          <div className="eyebrow mb-3">{group.category}</div>
          <div className="space-y-3">
            {group.questions.map((q) => (
              <MatrixRow key={q} question={q} cell={cells[q]} onCite={onCite} />
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function MatrixRow({
  question,
  cell,
  onCite,
}: {
  question: string;
  cell?: Cell;
  onCite: (source: string, quote: string, claim?: string) => void;
}) {
  const status = cell?.status ?? "idle";
  return (
    <div className="panel grid gap-4 p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <div className="font-body text-sm font-medium leading-relaxed text-parchment">{question}</div>
      <div className="min-w-0">
        {status === "running" && <span className="font-mono text-sm text-muted">Reading the data room…</span>}
        {status === "error" && <span className="font-mono text-xs text-negative">{cell?.error}</span>}
        {status === "done" && cell?.answer && (
          <>
            <p className="font-body text-sm leading-relaxed text-parchment/85">{cell.answer.answer}</p>
            {cell.answer.citations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {cell.answer.citations.map((c, i) => (
                  <button
                    key={i}
                    className={cn("chip transition-colors hover:border-brass/60 hover:text-parchment")}
                    title={c.quote || c.claim}
                    onClick={() => onCite(c.source, c.quote, c.claim)}
                  >
                    {c.source} ↗
                  </button>
                ))}
              </div>
            )}
            {cell.answer.confidence && (
              <span className="mt-2 inline-block font-mono text-[10.5px] uppercase tracking-wider text-muted">
                confidence: {cell.answer.confidence}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
