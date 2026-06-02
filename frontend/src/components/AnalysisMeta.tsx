/** Freshness header for a persisted AI analysis: a subtle "generated" stamp when current,
 *  or an amber "out of date" banner with a Regenerate action when the data room changed. */
export default function AnalysisMeta({
  meta,
  busy,
  onRegenerate,
}: {
  meta: { created_at: string; stale: boolean } | null;
  busy: boolean;
  onRegenerate: () => void;
}) {
  if (!meta) return null;
  const when = new Date(meta.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (meta.stale) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brass/40 bg-brass/10 px-4 py-3">
        <div className="font-body text-sm text-parchment">
          <span className="text-brass">⚠ Possibly out of date.</span> The data room has changed since this was generated
          on {when}.
        </div>
        <button className="btn shrink-0 text-xs" disabled={busy} onClick={onRegenerate}>
          {busy ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    );
  }
  return <div className="mb-4 font-mono text-[10.5px] uppercase tracking-wider text-muted">Generated {when}</div>;
}
