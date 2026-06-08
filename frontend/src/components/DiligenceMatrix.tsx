import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { Answer, MatrixQuestion } from "../types";
import { cn } from "../lib";

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

type Cell = { status: "idle" | "running" | "done" | "error"; answer?: Answer; error?: string };
const CONCURRENCY = 3;

/** Group questions by category, preserving first-seen order (Map keeps insertion order). */
function groupQuestions(qs: MatrixQuestion[]): [string, MatrixQuestion[]][] {
  const m = new Map<string, MatrixQuestion[]>();
  for (const q of qs) {
    const key = q.category || "General";
    const arr = m.get(key);
    if (arr) arr.push(q);
    else m.set(key, [q]);
  }
  return Array.from(m.entries());
}

export default function DiligenceMatrix({ projectId, hasDocs, onCite }: Props) {
  const [questions, setQuestions] = useState<MatrixQuestion[]>([]);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newQ, setNewQ] = useState("");
  const [newCat, setNewCat] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .getMatrix(projectId)
      .then(setQuestions)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [projectId]);

  const groups = groupQuestions(questions);
  const categories = Array.from(new Set(questions.map((q) => q.category).filter(Boolean) as string[]));
  const doneCount = questions.filter((q) => cells[q.id]?.status === "done" || cells[q.id]?.status === "error").length;

  async function runAll() {
    if (!questions.length) return;
    setRunning(true);
    setCells(Object.fromEntries(questions.map((q) => [q.id, { status: "running" as const }])));
    let idx = 0;
    const worker = async () => {
      while (idx < questions.length) {
        const q = questions[idx++];
        try {
          const a = await api.ask(projectId, q.question);
          setCells((c) => ({ ...c, [q.id]: { status: "done", answer: a } }));
        } catch (e: unknown) {
          setCells((c) => ({ ...c, [q.id]: { status: "error", error: e instanceof Error ? e.message : String(e) } }));
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
  }

  async function addQuestion(e: FormEvent) {
    e.preventDefault();
    const question = newQ.trim();
    if (!question) return;
    setNewQ("");
    const created = await api.addMatrixQuestion(projectId, { question, category: newCat.trim() || undefined });
    setQuestions((qs) => [...qs, created]);
  }

  async function saveQuestion(q: MatrixQuestion, text: string) {
    const question = text.trim();
    if (!question || question === q.question) return;
    await api.updateMatrixQuestion(projectId, q.id, { question });
    setQuestions((qs) => qs.map((x) => (x.id === q.id ? { ...x, question } : x)));
    setCells((c) => {
      const next = { ...c };
      delete next[q.id]; // the cached answer is now stale
      return next;
    });
  }

  async function removeQuestion(q: MatrixQuestion) {
    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
    setCells((c) => {
      const next = { ...c };
      delete next[q.id];
      return next;
    });
    await api.deleteMatrixQuestion(projectId, q.id);
  }

  async function resetQuestions() {
    if (!window.confirm("Discard your changes and restore the standard question set?")) return;
    const qs = await api.resetMatrix(projectId);
    setQuestions(qs);
    setCells({});
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="font-mono text-xs text-muted">
          {questions.length} questions{!editing && doneCount > 0 ? ` · ${doneCount} answered` : ""}
          {running && <span className="ml-2 text-brass">· running…</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-ghost text-xs"
            onClick={() => setEditing((v) => !v)}
            disabled={running}
          >
            {editing ? "Done editing" : "Edit questions"}
          </button>
          {!editing && (
            <button className="btn text-xs" disabled={running || !hasDocs || !questions.length} onClick={runAll}>
              {running ? "Running…" : doneCount > 0 ? "Re-run" : "Run matrix"}
            </button>
          )}
        </div>
      </div>

      {!hasDocs && !editing && (
        <p className="px-1 font-mono text-xs text-muted">Upload documents first to run the matrix.</p>
      )}

      {loaded && questions.length === 0 && (
        <div className="panel px-6 py-12 text-center text-sm text-muted">
          No questions yet. {editing ? "Add one below." : 'Use "Edit questions" to add some.'}
        </div>
      )}

      {groups.map(([category, qs]) => (
        <div key={category}>
          <div className="eyebrow mb-3">{category}</div>
          <div className="space-y-3">
            {qs.map((q) =>
              editing ? (
                <EditRow key={q.id} q={q} onSave={saveQuestion} onDelete={removeQuestion} />
              ) : (
                <MatrixRow key={q.id} question={q.question} cell={cells[q.id]} onCite={onCite} />
              )
            )}
          </div>
        </div>
      ))}

      {editing && (
        <div className="panel space-y-4 p-5">
          <form onSubmit={addQuestion} className="flex flex-col gap-3 sm:flex-row">
            <input
              className="field sm:w-44"
              list="matrix-categories"
              placeholder="Category"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <datalist id="matrix-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              className="field"
              placeholder="Add a diligence question…"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
            />
            <button className="btn shrink-0" disabled={!newQ.trim()}>
              Add
            </button>
          </form>
          <button
            onClick={resetQuestions}
            className="font-mono text-[10.5px] uppercase tracking-wider text-muted transition-colors hover:text-negative"
          >
            Reset to standard set
          </button>
        </div>
      )}
    </motion.div>
  );
}

function EditRow({
  q,
  onSave,
  onDelete,
}: {
  q: MatrixQuestion;
  onSave: (q: MatrixQuestion, text: string) => void;
  onDelete: (q: MatrixQuestion) => void;
}) {
  return (
    <div className="group flex items-center gap-2">
      <input
        className="field"
        defaultValue={q.question}
        onBlur={(e) => onSave(q, e.target.value)}
      />
      <button
        onClick={() => onDelete(q)}
        title="Delete question"
        className="shrink-0 px-2 font-mono text-xs text-muted transition-colors hover:text-negative"
      >
        ✕
      </button>
    </div>
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
        {status === "idle" && <span className="font-mono text-xs text-muted/70">Not run yet.</span>}
        {status === "running" && <span className="font-mono text-sm text-muted">Reading the documents…</span>}
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
          </>
        )}
      </div>
    </div>
  );
}
