import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { ColumnProfile, DocProfile } from "../types";
import { cn } from "../lib";

const num = (n?: number) =>
  n === undefined ? "—" : Math.abs(n) >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(n);

/** Per-table column statistics + data-quality flags. Re-profiles when the document
 *  count changes (rule-based on the backend, so it's instant). */
export default function DataProfile({ projectId, docCount }: { projectId: string; docCount: number }) {
  const [profiles, setProfiles] = useState<DocProfile[]>([]);

  useEffect(() => {
    api.getProfile(projectId).then(setProfiles).catch(() => setProfiles([]));
  }, [projectId, docCount]);

  if (profiles.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="eyebrow">Data profile</div>
        <div className="font-mono text-[11px] text-muted">{profiles.length} tabular files</div>
      </div>
      <div className="space-y-5">
        {profiles.map((p) => (
          <div key={p.filename} className="panel overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
              <span className="font-display text-[15px] text-parchment">{p.filename}</span>
              <span className="num text-[11px] text-muted">
                {p.n_rows} rows × {p.n_cols} cols
              </span>
              {p.issues.map((iss, i) => (
                <span key={i} className="chip text-brass border-brass/40">
                  {iss}
                </span>
              ))}
              {p.issues.length === 0 && <span className="chip text-positive border-positive/40">clean</span>}
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow px-5 py-2 font-normal">Column</th>
                  <th className="eyebrow px-3 py-2 font-normal">Type</th>
                  <th className="eyebrow px-3 py-2 text-right font-normal">Fill</th>
                  <th className="eyebrow px-3 py-2 text-right font-normal">Distinct</th>
                  <th className="eyebrow px-5 py-2 font-normal">Summary</th>
                </tr>
              </thead>
              <tbody>
                {p.columns.map((c, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5 font-body text-sm text-parchment">{c.name}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "chip",
                          c.type === "numeric" ? "text-brass border-brass/40" : "text-muted"
                        )}
                      >
                        {c.type}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "num px-3 py-2.5 text-right text-sm",
                        c.null_pct > 0 ? "text-negative" : "text-muted"
                      )}
                    >
                      {(100 - c.null_pct).toFixed(0)}%
                    </td>
                    <td className="num px-3 py-2.5 text-right text-sm text-muted">{c.distinct}</td>
                    <td className="px-5 py-2.5 font-mono text-[11.5px] text-muted/90">
                      <ColSummary c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ColSummary({ c }: { c: ColumnProfile }) {
  if (c.type === "numeric") {
    return (
      <span>
        min {num(c.min)} · max {num(c.max)} · mean {num(c.mean)} · Σ {num(c.sum)}
      </span>
    );
  }
  if (c.top && c.top.length) {
    return <span>{c.top.map((t) => `${t.value} (${t.count})`).join(" · ")}</span>;
  }
  return <span>—</span>;
}
