import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { DocStatus, ProjectDetail, Sample, Taxonomy } from "../types";
import { cn, shortDate } from "../lib";
import ReadinessTracker from "./ReadinessTracker";
import DataProfile from "./DataProfile";

function fmtEta(secs: number | null | undefined): string {
  if (secs == null || secs <= 2) return "";
  if (secs < 10) return "< 10s";
  if (secs < 60) return `~${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

export default function DataRoom({ detail, onChanged }: { detail: ProjectDetail; onChanged: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const [liveStatus, setLiveStatus] = useState<Record<string, DocStatus>>({});
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getTaxonomy(detail.id).then(setTax).catch(() => setTax(null));
  }, [detail.id, detail.documents.length]);

  useEffect(() => {
    api.listSamples().then(setSamples).catch(() => setSamples([]));
  }, []);

  // Poll status for documents that are still indexing — runs regardless of tab visibility
  // because the server does the work; we only need to refresh the display when we're back.
  useEffect(() => {
    const toWatch = detail.documents
      .filter((d) => d.status === "indexing" || liveStatus[d.id]?.status === "indexing")
      .map((d) => d.id);

    if (toWatch.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      const updates: Record<string, DocStatus> = {};
      let anyStillIndexing = false;
      for (const id of toWatch) {
        try {
          const s = await api.getDocumentStatus(detail.id, id);
          updates[id] = s;
          if (s.status === "indexing") anyStillIndexing = true;
        } catch {
          // transient network hiccup — keep polling
        }
      }
      if (!cancelled) {
        setLiveStatus((prev) => ({ ...prev, ...updates }));
        if (!anyStillIndexing) {
          onChanged(); // refresh parent: n_chunks and final status are now accurate
        } else {
          pollTimer.current = setTimeout(poll, 2000);
        }
      }
    };

    pollTimer.current = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [detail.documents]);

  async function upload(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setErr(null);
    setNote(null);
    let added = 0;
    let dup = 0;
    let skip = 0;
    try {
      for (const f of Array.from(files)) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          const r = await api.uploadBulk(detail.id, f);
          added += r.ingested.length;
          dup += r.duplicates.length;
          skip += r.skipped.length;
        } else {
          const r = await api.uploadDocument(detail.id, f);
          if (r.duplicate) dup += 1;
          else added += 1;
        }
      }
      const parts: string[] = [];
      if (added) parts.push(`${added} indexing…`);
      if (dup) parts.push(`${dup} duplicate${dup === 1 ? "" : "s"} skipped`);
      if (skip) parts.push(`${skip} unsupported`);
      setNote(parts.join(" · ") || null);
      onChanged();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(s: Sample) {
    setLoadingSample(s.name);
    setErr(null);
    setNote(null);
    try {
      const r = await api.loadSample(detail.id, s.company, s.filename);
      const parts: string[] = [];
      if (r.ingested.length) parts.push(`${r.ingested.length} indexing…`);
      if (r.duplicates.length) parts.push(`${r.duplicates.length} already present`);
      setNote(parts.join(" · ") || "loaded");
      onChanged();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingSample(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <div className="eyebrow mb-3">Upload</div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center transition-colors",
            drag ? "border-brass bg-brass/10" : "border-[#c8c8c8] bg-surface/60 hover:border-brass/60 hover:bg-surface"
          )}
        >
          <div className="font-display text-lg text-parchment">
            {busy ? "Uploading…" : "Drop the data room"}
          </div>
          <p className="mt-2 max-w-xs font-body text-sm text-muted">
            PDF, Excel, CSV, or Word — or a <span className="text-brass/80">.zip</span> of the whole data room.
            Duplicates are detected and skipped.
          </p>
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
        {note && <p className="mt-3 font-mono text-xs text-brass/80">{note}</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}

        {samples.length > 0 && (
          <div className="mt-6">
            <div className="eyebrow mb-3">Sample data rooms</div>
            <div className="flex flex-col gap-2">
              {samples.map((s) => (
                <button
                  key={s.name}
                  onClick={() => loadSample(s)}
                  disabled={!!loadingSample}
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-line px-4 py-3 text-left transition-colors",
                    "hover:border-brass/50 hover:bg-surface/50 disabled:opacity-50"
                  )}
                >
                  <div>
                    <div className="font-body text-sm text-parchment capitalize">{s.company}</div>
                    <div className="font-mono text-xs text-muted">{s.filename}</div>
                  </div>
                  <span className="font-mono text-xs text-brass/70">
                    {loadingSample === s.name ? "loading…" : "Load →"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="eyebrow mb-3">Documents · {detail.documents.length}</div>
        <div className="panel overflow-hidden">
          {detail.documents.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted">No documents yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow px-5 py-3 font-normal">File</th>
                  <th className="eyebrow px-3 py-3 font-normal">Category</th>
                  <th className="eyebrow px-3 py-3 font-normal">Type</th>
                  <th className="eyebrow px-3 py-3 text-right font-normal">Chunks</th>
                  <th className="eyebrow px-5 py-3 text-right font-normal">Added</th>
                </tr>
              </thead>
              <tbody>
                {detail.documents.map((d) => {
                  const live = liveStatus[d.id];
                  const status = live?.status ?? d.status;
                  const isIndexing = status === "indexing";
                  const isError = status === "error";
                  const total = live?.chunks_total ?? d.chunks_total ?? 0;
                  const done = live?.chunks_done ?? d.chunks_done ?? 0;
                  const eta = live?.eta_seconds ?? d.eta_seconds;
                  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

                  return (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3 font-body text-sm text-parchment">{d.filename}</td>
                      <td className="px-3 py-3">
                        {tax?.by_document[d.id] && (
                          <span className="chip text-brass border-brass/40">{tax.by_document[d.id]}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="chip">{d.kind}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm">
                        {isIndexing ? (
                          <div className="flex flex-col items-end gap-1">
                            <div className="w-24 h-1.5 overflow-hidden rounded-full bg-line">
                              <div
                                className="h-full rounded-full bg-brass transition-all duration-500"
                                style={{ width: total > 0 ? `${pct}%` : "15%" }}
                              />
                            </div>
                            <span className="font-mono text-xs text-muted">
                              {total > 0 ? `${done} / ${total}` : "parsing…"}
                              {fmtEta(eta) && ` · ${fmtEta(eta)}`}
                            </span>
                          </div>
                        ) : isError ? (
                          <span className="font-mono text-xs text-negative">error</span>
                        ) : (
                          <span className="num text-muted">{d.n_chunks}</span>
                        )}
                      </td>
                      <td className="num px-5 py-3 text-right text-xs text-muted">
                        {shortDate(d.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <ReadinessTracker projectId={detail.id} docCount={detail.documents.length} />
        <DataProfile projectId={detail.id} docCount={detail.documents.length} />
      </div>
    </div>
  );
}
