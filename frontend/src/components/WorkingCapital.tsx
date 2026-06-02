import { motion } from "framer-motion";
import { api } from "../api";
import type { LineItem, WorkingCapitalReport } from "../types";
import { cn, money, signedMoney } from "../lib";
import { useAnalysis } from "../useAnalysis";
import AnalysisMeta from "./AnalysisMeta";

interface Props {
  projectId: string;
  hasDocs: boolean;
  onCite: (source: string, quote: string, claim?: string) => void;
}

const fmt = (n: number | null) => (n === null || n === undefined ? "—" : money(n));
const pct = (n: number | null) => (n === null || n === undefined ? "—" : `${n.toFixed(1)}%`);

export default function WorkingCapital({ projectId, hasDocs, onCite }: Props) {
  const { report, meta, busy, err, loaded, regenerate } = useAnalysis<WorkingCapitalReport>(
    () => api.getCachedWorkingCapital(projectId),
    () => api.runWorkingCapital(projectId),
    [projectId]
  );

  if (!report) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="eyebrow mb-3">Working Capital &amp; Cash</div>
        <h2 className="font-display text-2xl text-parchment">Net working capital, the peg, and proof of cash</h2>
        <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted">
          Extracts the working-capital components, proposes a target NWC peg with seasonality,
          flags debt-like items, and ties reported revenue to cash receipts.
        </p>
        <button className="btn mt-7" disabled={busy || !hasDocs || !loaded} onClick={regenerate}>
          {busy ? "Analyzing…" : loaded ? "Run analysis →" : "Loading…"}
        </button>
        {!hasDocs && <p className="mt-3 font-mono text-xs text-muted">Upload documents first.</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}
      </div>
    );
  }

  const r = report;
  const cite = (li: LineItem) =>
    li.evidence_source && onCite(li.evidence_source, li.evidence_quote, li.label);

  const poc = r.proof_of_cash;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <AnalysisMeta meta={meta} busy={busy} onRegenerate={regenerate} />
      {err && <p className="font-mono text-xs text-negative">{err}</p>}
      <div className="panel p-7">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Net Working Capital</div>
          <button className="btn-ghost text-xs" onClick={regenerate} disabled={busy}>
            {busy ? "…" : "Re-run"}
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Net working capital" value={fmt(r.net_working_capital)} big />
          <Stat label="NWC % of revenue" value={pct(r.nwc_pct_of_revenue)} />
          <Stat label="Suggested peg" value={fmt(r.suggested_peg)} accent />
          <Stat label="Debt-like items" value={String(r.debt_like_items.length)} />
        </div>
        {r.seasonality_note && (
          <p className="mt-6 border-t border-line pt-4 font-body text-sm leading-relaxed text-muted">
            <span className="text-brass/80">Seasonality — </span>
            {r.seasonality_note}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ItemTable title="Current assets" items={r.current_assets} onCite={cite} />
        <ItemTable title="Current liabilities" items={r.current_liabilities} onCite={cite} />
      </div>

      {r.debt_like_items.length > 0 && (
        <ItemTable title="Debt-like items (EV → equity bridge)" items={r.debt_like_items} onCite={cite} />
      )}

      <div className="panel p-7">
        <div className="eyebrow mb-5">Proof of Cash</div>
        <div className="grid grid-cols-3 gap-6">
          <Stat label="Reported revenue" value={fmt(poc.reported_revenue)} />
          <Stat label="Cash receipts" value={fmt(poc.cash_receipts)} />
          <Stat
            label="Variance"
            value={poc.variance === null || poc.variance === undefined ? "—" : signedMoney(poc.variance)}
            accent
          />
        </div>
        {poc.note && <p className="mt-5 border-t border-line pt-4 font-body text-sm leading-relaxed text-muted">{poc.note}</p>}
      </div>

      {r.notes.length > 0 && (
        <div className="panel p-6">
          <div className="eyebrow mb-3">Notes</div>
          <ul className="space-y-2.5">
            {r.notes.map((n, i) => (
              <li key={i} className="flex gap-3 font-body text-sm leading-relaxed text-parchment/90">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brass" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.summary && (
        <div className="panel p-7">
          <div className="eyebrow mb-3">Analyst summary</div>
          <p className="font-display text-lg italic leading-relaxed text-parchment/90">{r.summary}</p>
        </div>
      )}
    </motion.div>
  );
}

function ItemTable({
  title,
  items,
  onCite,
}: {
  title: string;
  items: LineItem[];
  onCite: (li: LineItem) => void;
}) {
  const total = items.reduce((a, b) => a + (b.amount || 0), 0);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-baseline justify-between px-6 pt-5">
        <span className="eyebrow">{title}</span>
        <span className="num text-sm text-parchment">{money(total)}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted">None extracted.</div>
      ) : (
        <table className="mt-3 w-full">
          <tbody>
            {items.map((li, i) => {
              const clickable = !!li.evidence_source;
              return (
                <tr
                  key={i}
                  onClick={() => clickable && onCite(li)}
                  className={cn(
                    "group border-t border-line",
                    clickable && "cursor-pointer transition-colors hover:bg-surface2"
                  )}
                >
                  <td className="px-6 py-3 font-body text-sm text-parchment">
                    {li.label}
                    {li.evidence_source && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-brass/70 transition-colors group-hover:text-brass">
                        ↳
                      </span>
                    )}
                  </td>
                  <td className="num px-6 py-3 text-right text-sm text-parchment/85">{money(li.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
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
