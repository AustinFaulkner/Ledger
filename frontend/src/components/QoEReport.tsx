import { motion } from "framer-motion";
import { api } from "../api";
import type { QoEReport as Report } from "../types";
import { cn, money, signedMoney } from "../lib";
import { useAnalysis } from "../useAnalysis";
import AnalysisMeta from "./AnalysisMeta";

const KIND_STYLE: Record<string, string> = {
  recurring: "text-positive border-positive/40",
  non_recurring: "text-brass border-brass/40",
  questionable: "text-negative border-negative/40",
};

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

export default function QoEReport({ projectId, hasDocs, onCite }: Props) {
  const { report, meta, busy, err, loaded, regenerate } = useAnalysis<Report>(
    () => api.getCachedQoE(projectId),
    () => api.runQoE(projectId),
    [projectId]
  );

  if (!report) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="eyebrow mb-3">Quality of Earnings</div>
        <h2 className="font-display text-2xl text-parchment">Normalize EBITDA, flag the add-backs</h2>
        <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted">
          Runs an analyst pass over the data room: a reported → normalized EBITDA bridge, each
          adjustment classified, plus revenue-quality and working-capital flags.
        </p>
        <button className="btn mt-7" disabled={busy || !hasDocs || !loaded} onClick={regenerate}>
          {busy ? "Analyzing…" : loaded ? "Run analysis →" : "Loading…"}
        </button>
        {!hasDocs && <p className="mt-3 font-mono text-xs text-muted">Upload documents first.</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}
      </div>
    );
  }

  const delta = report.normalized_ebitda - report.reported_ebitda;
  const uplift = (delta / Math.abs(report.reported_ebitda || 1)) * 100;
  const maxAbs = Math.max(
    Math.abs(report.reported_ebitda),
    Math.abs(report.normalized_ebitda),
    ...report.adjustments.map((a) => Math.abs(a.amount)),
    1
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <AnalysisMeta meta={meta} busy={busy} onRegenerate={regenerate} />
      {err && <p className="font-mono text-xs text-negative">{err}</p>}
      <div className="panel p-7">
        <div className="flex items-center justify-between">
          <div className="eyebrow">EBITDA Bridge</div>
          <button className="btn-ghost text-xs" onClick={regenerate} disabled={busy}>
            {busy ? "…" : "Re-run"}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Reported EBITDA" value={money(report.reported_ebitda)} />
          <Stat label="Net adjustments" value={signedMoney(delta)} accent />
          <Stat label="Normalized EBITDA" value={money(report.normalized_ebitda)} big />
          <Stat label="Uplift" value={`${uplift >= 0 ? "+" : ""}${uplift.toFixed(1)}%`} />
        </div>

        <div className="mt-8 space-y-2">
          {report.adjustments.map((a, i) => (
            <div
              key={i}
              onClick={() => a.evidence_source && onCite(a.evidence_source, a.evidence_quote ?? "", a.rationale)}
              className={cn(
                "-mx-1 flex items-center gap-4 rounded px-1 transition-colors",
                a.evidence_source && "cursor-pointer hover:bg-surface2"
              )}
            >
              <div className="w-52 shrink-0 truncate font-body text-sm text-parchment" title={a.label}>
                {a.label}
              </div>
              <div className="relative h-6 flex-1 rounded bg-ink/60">
                <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <div
                  className={cn("absolute inset-y-0 rounded", a.amount >= 0 ? "left-1/2 bg-positive/40" : "right-1/2 bg-negative/40")}
                  style={{ width: `${(Math.abs(a.amount) / maxAbs) * 50}%` }}
                />
              </div>
              <div className={cn("num w-28 shrink-0 text-right text-sm", a.amount >= 0 ? "text-positive" : "text-negative")}>
                {signedMoney(a.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-baseline justify-between px-6 pt-5">
          <span className="eyebrow">Adjustments · {report.adjustments.length}</span>
          <span className="font-mono text-[11px] text-muted">click a row to trace its source →</span>
        </div>
        <table className="mt-3 w-full">
          <tbody>
            {report.adjustments.map((a, i) => {
              const clickable = !!a.evidence_source;
              return (
                <tr
                  key={i}
                  onClick={() => clickable && onCite(a.evidence_source!, a.evidence_quote ?? "", a.rationale)}
                  className={cn("group border-t border-line", clickable && "cursor-pointer transition-colors hover:bg-surface2")}
                >
                  <td className="px-6 py-4 align-top">
                    <div className="font-body text-sm text-parchment">{a.label}</div>
                    <div className="mt-1 font-body text-xs leading-relaxed text-muted">{a.rationale}</div>
                    {a.evidence_source && (
                      <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider text-brass/80 transition-colors group-hover:text-brass">
                        ↳ {a.evidence_source}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 align-top">
                    <span className={cn("chip", KIND_STYLE[a.kind])}>{a.kind.replace("_", " ")}</span>
                  </td>
                  <td className="px-3 py-4 align-top font-mono text-[11px] uppercase text-muted">{a.confidence}</td>
                  <td className={cn("num px-6 py-4 text-right align-top text-sm", a.amount >= 0 ? "text-positive" : "text-negative")}>
                    {signedMoney(a.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Flags title="Revenue-quality concerns" items={report.revenue_quality_concerns} />
        <Flags title="Working-capital notes" items={report.working_capital_notes} />
      </div>

      <div className="panel p-7">
        <div className="eyebrow mb-3">Analyst summary</div>
        <p className="font-display text-lg italic leading-relaxed text-parchment/90">{report.summary}</p>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={cn("num", big ? "text-3xl" : "text-xl", accent ? "text-brass" : "text-parchment")}>{value}</div>
    </div>
  );
}

function Flags({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel p-6">
      <div className="eyebrow mb-3">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None flagged.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((x, i) => (
            <li key={i} className="flex gap-3 font-body text-sm leading-relaxed text-parchment/90">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brass" />
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
