import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { ReadinessReport } from "../types";
import { cn } from "../lib";

/** Data-room readiness — coverage of the standard diligence checklist. Re-assesses
 *  whenever the document count changes (rule-based on the backend, so it's instant). */
export default function ReadinessTracker({ projectId, docCount }: { projectId: string; docCount: number }) {
  const [report, setReport] = useState<ReadinessReport | null>(null);

  useEffect(() => {
    api.getReadiness(projectId).then(setReport).catch(() => setReport(null));
  }, [projectId, docCount]);

  if (!report || report.n_documents === 0) return null;

  const missingRequired = report.categories.filter((c) => c.required && !c.present);
  const ring = report.score >= 100 ? "text-positive" : report.score >= 60 ? "text-brass" : "text-negative";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="eyebrow">Data-room readiness</div>
        <div className="font-mono text-[11px] text-muted">
          required {report.present_required}/{report.total_required}
        </div>
      </div>
      <div className="panel p-6">
        <div className="flex items-center gap-5 border-b border-line pb-5">
          <div className={cn("num text-4xl", ring)}>{report.score}%</div>
          <div className="font-body text-sm text-muted">
            {missingRequired.length === 0
              ? "Core financials are all present."
              : `Missing ${missingRequired.length} required ${missingRequired.length === 1 ? "category" : "categories"}.`}
            <div className="mt-0.5 font-mono text-[11px]">{report.n_documents} documents classified</div>
          </div>
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {report.categories.map((c) => (
            <div key={c.category} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  c.present
                    ? "bg-positive/15 text-positive"
                    : c.required
                    ? "bg-negative/15 text-negative"
                    : "border border-line text-muted"
                )}
              >
                {c.present ? "✓" : c.required ? "!" : "+"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("font-body text-sm", c.present ? "text-parchment" : "text-muted")}>
                    {c.category}
                  </span>
                  {c.required && !c.present && <span className="chip text-negative border-negative/40">required</span>}
                  {!c.present && !c.required && <span className="chip">request</span>}
                </div>
                {c.documents.length > 0 && (
                  <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted/80" title={c.documents.join(", ")}>
                    {c.documents.join(" · ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
