import { motion } from "framer-motion";
import { api } from "../api";
import type { RedFlagReport, Severity } from "../types";
import { cn } from "../lib";
import { useAnalysis } from "../useAnalysis";
import AnalysisMeta from "./AnalysisMeta";

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

const SEV: Record<Severity, { dot: string; chip: string; label: string; rank: number }> = {
  high: { dot: "bg-negative", chip: "text-negative border-negative/40", label: "High", rank: 0 },
  medium: { dot: "bg-brass", chip: "text-brass border-brass/40", label: "Medium", rank: 1 },
  low: { dot: "bg-muted", chip: "text-muted border-line", label: "Low", rank: 2 },
};

export default function RedFlags({ projectId, hasDocs, onCite }: Props) {
  const { report, meta, busy, err, loaded, regenerate } = useAnalysis<RedFlagReport>(
    () => api.getCachedRedFlags(projectId),
    () => api.runRedFlags(projectId),
    [projectId]
  );

  if (!report) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="eyebrow mb-3">Risk &amp; Red Flags</div>
        <h2 className="font-display text-2xl text-parchment">Surface what a buyer should chase down</h2>
        <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted">
          A forensic pass over the data room: aggressive add-backs, customer concentration, revenue
          cut-off, cash-conversion and related-party signals — ranked by severity, each tied to its source.
        </p>
        <button className="btn mt-7" disabled={busy || !hasDocs || !loaded} onClick={regenerate}>
          {busy ? "Scanning…" : loaded ? "Scan for red flags →" : "Loading…"}
        </button>
        {!hasDocs && <p className="mt-3 font-mono text-xs text-muted">Upload documents first.</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}
      </div>
    );
  }

  const findings = [...report.findings].sort((a, b) => SEV[a.severity].rank - SEV[b.severity].rank);
  const counts = (s: Severity) => findings.filter((f) => f.severity === s).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <AnalysisMeta meta={meta} busy={busy} onRegenerate={regenerate} />
      {err && <p className="font-mono text-xs text-negative">{err}</p>}
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-6">
          {(["high", "medium", "low"] as Severity[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", SEV[s].dot)} />
              <span className="num text-2xl text-parchment">{counts(s)}</span>
              <span className="eyebrow">{SEV[s].label}</span>
            </div>
          ))}
        </div>
        <button className="btn-ghost text-xs" onClick={regenerate} disabled={busy}>
          {busy ? "…" : "Re-scan"}
        </button>
      </div>

      {report.summary && (
        <p className="px-1 font-display text-lg italic leading-relaxed text-parchment/90">{report.summary}</p>
      )}

      <div className="space-y-3">
        {findings.length === 0 && (
          <div className="panel px-6 py-12 text-center text-sm text-muted">
            No material red flags surfaced — the data room reads clean on the dimensions checked.
          </div>
        )}
        {findings.map((f, i) => {
          const clickable = !!f.evidence_source;
          return (
            <div
              key={i}
              onClick={() => clickable && onCite(f.evidence_source, f.evidence_quote, f.title + ". " + f.rationale)}
              className={cn(
                "panel group p-5 transition-colors",
                clickable && "cursor-pointer hover:border-brass/40"
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", SEV[f.severity].dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg text-parchment">{f.title}</h3>
                    <span className={cn("chip", SEV[f.severity].chip)}>{SEV[f.severity].label}</span>
                    <span className="chip">{f.category}</span>
                  </div>
                  <p className="mt-2 font-body text-sm leading-relaxed text-parchment/85">{f.rationale}</p>
                  {f.recommendation && (
                    <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                      <span className="text-brass/80">Next step — </span>
                      {f.recommendation}
                    </p>
                  )}
                  {f.evidence_source && (
                    <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-brass/80 transition-colors group-hover:text-brass">
                      ↳ {f.evidence_source} — trace evidence
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
