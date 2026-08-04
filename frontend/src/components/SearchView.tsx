import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { SearchHit } from "../types";
import { cn } from "../lib";

interface Props {
  projectId: string;
  kinds: string[];
  onCite: (source: string, quote: string, claim?: string) => void;
}

/** Highlight the query terms inside a snippet. */
function mark(text: string, query: string): ReactNode[] {
  const terms = query.split(/\s+/).filter((w) => w.length > 2);
  if (!terms.length) return [text];
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} className="bg-brass/25 text-parchment">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function SearchView({ projectId, kinds, onCite }: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);

  const uniqueKinds = useMemo(() => Array.from(new Set(kinds)).sort(), [kinds]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        setHits(await api.search(projectId, query, kind || undefined));
      } catch {
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q, kind, projectId]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="eyebrow mb-3">Search the data room</div>
      <div className="flex gap-3">
        <input
          autoFocus
          className="field"
          placeholder="Search every document — semantic, ranked by relevance…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {uniqueKinds.length > 1 && (
          <select
            className="field w-32 shrink-0"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All types</option>
            {uniqueKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {q.trim().length >= 2 && hits && (
          <div className="font-mono text-[11px] text-muted">
            {busy ? "searching…" : `${hits.length} result${hits.length === 1 ? "" : "s"}`}
          </div>
        )}
        {hits?.map((h, i) => (
          <motion.button
            key={`${h.document_id}-${h.locator}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            onClick={() => onCite(h.filename, "", q.trim())}
            className="panel block w-full p-4 text-left transition-colors hover:border-brass/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-display text-[15px] text-parchment">{h.filename}</span>
                <span className="chip">{h.kind}</span>
                {h.locator && <span className="font-mono text-[10.5px] text-muted">{h.locator}</span>}
              </div>
              <ScoreBar score={h.score} />
            </div>
            <p className="mt-2 font-body text-[13px] leading-relaxed text-parchment/80">{mark(h.snippet, q.trim())}</p>
          </motion.button>
        ))}
        {q.trim().length >= 2 && hits && hits.length === 0 && !busy && (
          <div className="panel px-6 py-10 text-center text-sm text-muted">No matches in the data room.</div>
        )}
        {q.trim().length < 2 && (
          <div className="panel px-6 py-12 text-center text-sm text-muted">
            Type to search across every document. Results are ranked by semantic relevance; click one to open the
            source with the passage highlighted.
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(6, Math.min(100, Math.round(score * 100)));
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full bg-brass")} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-[10.5px] text-muted">{score.toFixed(2)}</span>
    </div>
  );
}
