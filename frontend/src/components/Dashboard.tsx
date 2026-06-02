import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type {
  CachedReport,
  FinancialSummary,
  ProjectDetail,
  QoEReport,
  ReadinessReport,
  RedFlagReport,
  Taxonomy,
  TrackerItem,
} from "../types";
import { cn } from "../lib";
import { BarChart, Waterfall, finFmt } from "./charts";

interface Props {
  projectId: string;
  detail: ProjectDetail;
  onNavigate: (tab: string) => void;
}

const lastNum = (arr?: (number | null)[]) => {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number;
  return null;
};

const SEV_COLOR: Record<string, string> = { high: "text-negative", medium: "text-brass", low: "text-muted" };

export default function Dashboard({ projectId, detail, onNavigate }: Props) {
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [qoe, setQoe] = useState<CachedReport<QoEReport> | null>(null);
  const [rf, setRf] = useState<CachedReport<RedFlagReport> | null>(null);
  const [fin, setFin] = useState<FinancialSummary | null>(null);
  const [trackers, setTrackers] = useState<TrackerItem[]>([]);

  useEffect(() => {
    api.getReadiness(projectId).then(setReadiness).catch(() => {});
    api.getTaxonomy(projectId).then(setTax).catch(() => {});
    api.getCachedQoE(projectId).then(setQoe).catch(() => {});
    api.getCachedRedFlags(projectId).then(setRf).catch(() => {});
    api.getFinancials(projectId).then(setFin).catch(() => {});
    api.listTrackers(projectId).then(setTrackers).catch(() => {});
  }, [projectId]);

  const revenue = lastNum(fin?.series["Revenue"]);
  const normalized = qoe?.payload.normalized_ebitda ?? lastNum(fin?.series["EBITDA"]);
  const openItems = trackers.filter((t) => t.status !== "resolved").length;
  const catsCovered = tax ? tax.categories.filter((c) => c.count > 0).length : 0;
  const maxCat = tax ? Math.max(1, ...tax.categories.map((c) => c.count)) : 1;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* headline stats */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Documents" value={String(detail.documents.length)} onClick={() => onNavigate("dataroom")} />
        <Tile label="Readiness" value={readiness ? `${readiness.score}%` : "—"} onClick={() => onNavigate("dataroom")} />
        <Tile label="Categories" value={tax ? `${catsCovered}/${tax.categories.length}` : "—"} onClick={() => onNavigate("dataroom")} />
        <Tile label="Open items" value={trackers.length ? String(openItems) : "—"} onClick={() => onNavigate("trackers")} />
        <Tile label="Red flags" value={rf ? String(rf.payload.findings.length) : "—"} accent onClick={() => onNavigate("redflags")} />
        <Tile label="Norm. EBITDA" value={normalized != null ? finFmt(normalized) : "—"} accent onClick={() => onNavigate("qoe")} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* documents by category */}
        <div className="panel p-6">
          <SectionHead title="Documents by category" onClick={() => onNavigate("dataroom")} />
          <div className="mt-4 space-y-2">
            {tax?.categories.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className={cn("w-28 shrink-0 font-body text-sm", c.count ? "text-parchment" : "text-muted")}>
                  {c.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/60">
                  <div className="h-full rounded-full bg-brass/55" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
                <span className="num w-6 shrink-0 text-right text-sm text-muted">{c.count || "—"}</span>
              </div>
            ))}
            {!tax && <div className="py-6 text-center text-sm text-muted">Loading…</div>}
          </div>
        </div>

        {/* financial snapshot or EBITDA bridge */}
        <div className="panel p-6">
          {qoe ? (
            <>
              <SectionHead title="EBITDA bridge" onClick={() => onNavigate("qoe")} />
              <div className="mt-5">
                <Waterfall
                  reported={qoe.payload.reported_ebitda}
                  adjustments={qoe.payload.adjustments.map((a) => ({ label: a.label, amount: a.amount }))}
                  normalized={qoe.payload.normalized_ebitda}
                  format={finFmt}
                  height={200}
                />
              </div>
            </>
          ) : fin?.available && fin.series["Revenue"] ? (
            <>
              <SectionHead title="Revenue trend" onClick={() => onNavigate("report")} />
              <div className="mt-5">
                <BarChart labels={fin.periods} values={fin.series["Revenue"]} format={finFmt} height={180} />
              </div>
              <p className="mt-4 font-mono text-[11px] text-muted">
                Run Quality of Earnings to see the normalized EBITDA bridge here.
              </p>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <div className="eyebrow mb-2">Financial snapshot</div>
              <p className="max-w-xs font-body text-sm text-muted">
                Upload the financial statements to populate trends and the EBITDA bridge.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* key risks */}
      <div className="panel p-6">
        <SectionHead title="Key risks" onClick={() => onNavigate("redflags")} actionLabel={rf ? "View all" : "Run scan"} />
        {rf && rf.payload.findings.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {[...rf.payload.findings]
              .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]))
              .slice(0, 4)
              .map((f, i) => (
                <li key={i} className="flex items-start gap-3 border-t border-line pt-3">
                  <span className={cn("num shrink-0 text-[11px] uppercase", SEV_COLOR[f.severity])}>{f.severity}</span>
                  <div>
                    <span className="font-body text-sm text-parchment">{f.title}</span>
                    <span className="ml-2 text-xs text-muted">{f.category}</span>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-4 font-body text-sm text-muted">
            No red-flag scan yet — run it to surface the risks a buyer should chase down.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Tile({ label, value, accent, onClick }: { label: string; value: string; accent?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="bg-surface/70 p-5 text-left transition-colors hover:bg-surface2">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={cn("num text-2xl", accent ? "text-brass" : "text-parchment")}>{value}</div>
    </button>
  );
}

function SectionHead({ title, onClick, actionLabel = "Open" }: { title: string; onClick?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="eyebrow">{title}</div>
      {onClick && (
        <button onClick={onClick} className="font-mono text-[10.5px] uppercase tracking-wider text-brass/70 transition-colors hover:text-brass">
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
