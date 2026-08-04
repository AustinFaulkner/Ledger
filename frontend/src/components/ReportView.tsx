import { useEffect, useState } from "react";
import type {
  CachedReport,
  FinancialSummary,
  QoEReport,
  ReadinessReport,
  RedFlagReport,
  WorkingCapitalReport,
} from "../types";
import { api } from "../api";
import { cn } from "../lib";
import { BarChart, LineChart, Waterfall, finFmt } from "./charts";

interface Props {
  projectId: string;
  company: string;
  dealName: string;
}

const lastNum = (arr?: (number | null)[]) => {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number;
  return null;
};
const today = () => new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const SEV_COLOR: Record<string, string> = {
  high: "text-negative",
  medium: "text-brass",
  low: "text-muted",
};

export default function ReportView({ projectId, company, dealName }: Props) {
  const [fin, setFin] = useState<FinancialSummary | null>(null);
  const [qoe, setQoe] = useState<CachedReport<QoEReport> | null>(null);
  const [rf, setRf] = useState<CachedReport<RedFlagReport> | null>(null);
  const [wc, setWc] = useState<CachedReport<WorkingCapitalReport> | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function downloadDatabook() {
    setDownloading(true);
    try {
      await api.downloadDatabook(projectId);
    } catch {
      /* surfaced via the browser/network; keep the toolbar quiet */
    } finally {
      setDownloading(false);
    }
  }

  async function load() {
    setLoading(true);
    const [f, q, r, w, rd] = await Promise.all([
      api.getFinancials(projectId).catch(() => null),
      api.getCachedQoE(projectId).catch(() => null),
      api.getCachedRedFlags(projectId).catch(() => null),
      api.getCachedWorkingCapital(projectId).catch(() => null),
      api.getReadiness(projectId).catch(() => null),
    ]);
    setFin(f);
    setQoe(q);
    setRf(r);
    setWc(w);
    setReadiness(rd);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [projectId]);

  // Which AI analyses are present *and* fresh; the rest are "remaining" / out of date.
  const RUNNERS: { key: string; label: string; run: () => Promise<unknown> }[] = [
    { key: "qoe", label: "Quality of Earnings", run: () => api.runQoE(projectId) },
    { key: "redflags", label: "Red Flags", run: () => api.runRedFlags(projectId) },
    { key: "working_capital", label: "Working Capital", run: () => api.runWorkingCapital(projectId) },
  ];
  const present: Record<string, boolean> = {
    qoe: !!qoe && !qoe.stale,
    redflags: !!rf && !rf.stale,
    working_capital: !!wc && !wc.stale,
  };
  const remaining = RUNNERS.filter((r) => !present[r.key]);

  async function generate(which: "all" | "remaining") {
    const targets = which === "all" ? RUNNERS : remaining;
    if (!targets.length) return;
    setGenerating(true);
    // Fire all analyses concurrently — they're independent endpoints, and FastAPI runs
    // our sync handlers on its threadpool, so the model calls genuinely overlap. Each
    // chip flips to done/failed as its own request resolves.
    setGen(Object.fromEntries(targets.map((t) => [t.key, "running"])));
    await Promise.allSettled(
      targets.map(async (t) => {
        try {
          await t.run();
          setGen((g) => ({ ...g, [t.key]: "done" }));
        } catch {
          setGen((g) => ({ ...g, [t.key]: "error" }));
        }
      })
    );
    setGenerating(false);
    await load();
  }

  if (loading) return <div className="p-10 font-mono text-sm text-muted">Compiling report…</div>;

  const series = fin?.series ?? {};
  const periods = fin?.periods ?? [];
  const revenue = lastNum(series["Revenue"]);
  const normalized = qoe?.payload.normalized_ebitda ?? lastNum(series["EBITDA"]);
  const flagCount = rf?.payload.findings.length ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="eyebrow">Diligence Report</div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-ghost text-xs"
            disabled={generating || remaining.length === 0}
            onClick={() => generate("remaining")}
          >
            {generating ? "Generating…" : `Generate remaining${remaining.length ? ` (${remaining.length})` : ""}`}
          </button>
          <button className="btn-ghost text-xs" disabled={generating} onClick={() => generate("all")}>
            Generate all
          </button>
          <button className="btn-ghost text-xs" disabled={generating} onClick={load}>
            Refresh
          </button>
          <button className="btn-ghost text-xs" disabled={downloading} onClick={downloadDatabook}>
            {downloading ? "Preparing…" : "Download Excel"}
          </button>
          <button className="btn text-xs" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {Object.keys(gen).length > 0 && (
        <div className="no-print mb-8 flex flex-wrap gap-2">
          {RUNNERS.filter((r) => gen[r.key]).map((r) => {
            const s = gen[r.key];
            const label = s === "running" ? "running…" : s === "done" ? "✓ done" : s === "error" ? "failed" : "queued";
            return (
              <span
                key={r.key}
                className={cn(
                  "chip",
                  s === "done" && "text-positive border-positive/40",
                  s === "error" && "text-negative border-negative/40",
                  s === "running" && "text-brass border-brass/40"
                )}
              >
                {r.label}: {label}
              </span>
            );
          })}
        </div>
      )}

      <article className="report space-y-10">
        <header className="border-b border-line pb-8">
          <div className="eyebrow mb-3 text-brass">Confidential · Prepared for the deal team</div>
          <h1 className="font-display text-5xl font-medium leading-tight tracking-tight text-parchment">
            {company || dealName}
          </h1>
          <p className="mt-3 font-display text-xl italic text-muted">
            Quality of Earnings &amp; Diligence Summary
          </p>
          <div className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
            Project {dealName} · {today()}
          </div>
        </header>

        <Section title="Executive Summary">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Revenue (latest)" value={revenue != null ? finFmt(revenue) : "—"} />
            <Stat label="Normalized EBITDA" value={normalized != null ? finFmt(normalized) : "—"} accent />
            <Stat label="Red flags" value={flagCount != null ? String(flagCount) : "—"} />
            <Stat label="Data-room readiness" value={readiness ? `${readiness.score}%` : "—"} />
          </div>
          <p className="mt-6 font-body text-sm leading-relaxed text-parchment/85">
            {qoe?.payload.summary ||
              "Run the Quality of Earnings, Working Capital and Red Flags analyses to populate this summary. " +
                "The financial overview below is derived directly from the statement files and is always current."}
          </p>
        </Section>

        {/* Always available — derived from statement files, no AI run required. */}
        {fin?.available ? (
          <Section title="Financial Overview" note="$ in millions · derived from the statement files">
            <div className="grid gap-8 md:grid-cols-2">
              {series["Revenue"] && (
                <ChartCard title="Revenue">
                  <BarChart labels={periods} values={series["Revenue"]} format={finFmt} />
                </ChartCard>
              )}
              {series["EBITDA"] && (
                <ChartCard title="EBITDA">
                  <BarChart labels={periods} values={series["EBITDA"]} format={finFmt} accent="bg-positive/80" />
                </ChartCard>
              )}
              {Object.keys(fin.margins).length > 0 && (
                <ChartCard title="Margins">
                  <LineChart
                    labels={periods}
                    series={Object.entries(fin.margins).map(([name, values], i) => ({
                      name,
                      values,
                      color: i === 0 ? "rgb(0,95,184)" : "rgb(15,123,15)",
                    }))}
                  />
                  <MarginTable periods={periods} margins={fin.margins} />
                </ChartCard>
              )}
              {series["Net working capital"] && (
                <ChartCard title="Net working capital">
                  <BarChart labels={periods} values={series["Net working capital"]} format={finFmt} />
                </ChartCard>
              )}
              {series["Operating cash flow"] && (
                <ChartCard title="Operating cash flow">
                  <BarChart labels={periods} values={series["Operating cash flow"]} format={finFmt} accent="bg-positive/80" />
                </ChartCard>
              )}
            </div>
          </Section>
        ) : (
          <Section title="Financial Overview">
            <Empty>No statement tables detected — upload the income statement, balance sheet and cash flow.</Empty>
          </Section>
        )}

        <Section title="Quality of Earnings" stamp={qoe?.created_at} stale={qoe?.stale}>
          {qoe ? (
            <>
              <ChartCard title="Reported → Normalized EBITDA bridge">
                <Waterfall
                  reported={qoe.payload.reported_ebitda}
                  adjustments={qoe.payload.adjustments.map((a) => ({ label: a.label, amount: a.amount }))}
                  normalized={qoe.payload.normalized_ebitda}
                  format={finFmt}
                />
              </ChartCard>
              <table className="mt-5 w-full">
                <tbody>
                  {qoe.payload.adjustments.map((a, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 pr-3 font-body text-sm text-parchment">{a.label}</td>
                      <td className="py-2 pr-3">
                        <span className="chip">{a.kind.replace("_", " ")}</span>
                      </td>
                      <td className={cn("num py-2 text-right text-sm", a.amount >= 0 ? "text-positive" : "text-negative")}>
                        {a.amount >= 0 ? "+" : "−"}
                        {finFmt(Math.abs(a.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <Empty>Run the Quality of Earnings analysis to include the EBITDA bridge.</Empty>
          )}
        </Section>

        <Section title="Working Capital &amp; Cash" stamp={wc?.created_at} stale={wc?.stale}>
          {wc ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Net working capital" value={wc.payload.net_working_capital != null ? finFmt(wc.payload.net_working_capital) : "—"} />
              <Stat label="NWC % of revenue" value={wc.payload.nwc_pct_of_revenue != null ? `${wc.payload.nwc_pct_of_revenue}%` : "—"} />
              <Stat label="Suggested peg" value={wc.payload.suggested_peg != null ? finFmt(wc.payload.suggested_peg) : "—"} accent />
              <Stat label="Debt-like items" value={String(wc.payload.debt_like_items.length)} />
            </div>
          ) : (
            <Empty>Run the Working Capital analysis to include the NWC peg and proof of cash.</Empty>
          )}
          {wc?.payload.summary && <p className="mt-4 font-body text-sm leading-relaxed text-muted">{wc.payload.summary}</p>}
        </Section>

        <Section title="Key Risks &amp; Red Flags" stamp={rf?.created_at} stale={rf?.stale}>
          {rf ? (
            rf.payload.findings.length === 0 ? (
              <Empty>No material red flags surfaced.</Empty>
            ) : (
              <ul className="space-y-3">
                {rf.payload.findings.slice(0, 8).map((f, i) => (
                  <li key={i} className="border-t border-line pt-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("num text-xs uppercase", SEV_COLOR[f.severity])}>{f.severity}</span>
                      <span className="font-body text-sm font-medium text-parchment">{f.title}</span>
                      <span className="chip">{f.category}</span>
                    </div>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-muted">{f.rationale}</p>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <Empty>Run the Red Flags scan to include ranked risks.</Empty>
          )}
        </Section>

        {readiness && (
          <Section title="Data-Room Readiness">
            <div className="flex items-center gap-5">
              <div className={cn("num text-4xl", readiness.score >= 100 ? "text-positive" : "text-brass")}>
                {readiness.score}%
              </div>
              <div className="font-body text-sm text-muted">
                {readiness.present_required}/{readiness.total_required} required categories present ·{" "}
                {readiness.n_documents} documents.
                {(() => {
                  const missing = readiness.categories.filter((c) => !c.present).map((c) => c.category);
                  return missing.length ? <> Still outstanding: {missing.join(", ")}.</> : null;
                })()}
              </div>
            </div>
          </Section>
        )}

        <footer className="border-t border-line pt-5 font-mono text-[10.5px] uppercase tracking-wider text-muted">
          Generated by Ledger · {today()} · AI-assisted; figures should be verified against source documents.
        </footer>
      </article>
    </div>
  );
}

function Section({
  title,
  note,
  stamp,
  stale,
  children,
}: {
  title: string;
  note?: string;
  stamp?: string;
  stale?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section">
      <div className="mb-4 flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="font-display text-2xl text-parchment" dangerouslySetInnerHTML={{ __html: title }} />
        {note && <span className="font-mono text-[10.5px] text-muted">{note}</span>}
        {stamp && (
          <span className={cn("font-mono text-[10.5px]", stale ? "text-brass" : "text-muted")}>
            run {stamp.slice(0, 10)}
            {stale ? " · out of date" : ""}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="eyebrow mb-4">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className={cn("num text-2xl", accent ? "text-brass" : "text-parchment")}>{value}</div>
    </div>
  );
}

function MarginTable({ periods, margins }: { periods: string[]; margins: Record<string, (number | null)[]> }) {
  return (
    <table className="mt-4 w-full">
      <thead>
        <tr>
          <th className="eyebrow py-1 text-left font-normal" />
          {periods.map((p) => (
            <th key={p} className="eyebrow py-1 text-right font-normal">
              {p}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Object.entries(margins).map(([name, vals]) => (
          <tr key={name}>
            <td className="py-1 font-body text-xs text-muted">{name}</td>
            {vals.map((v, i) => (
              <td key={i} className="num py-1 text-right text-xs text-parchment/85">
                {v == null ? "—" : `${v}%`}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line px-5 py-6 text-center text-sm text-muted">{children}</div>;
}
