import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ProjectDetail, Taxonomy } from "../types";
import { cn, shortDate } from "../lib";
import ReadinessTracker from "./ReadinessTracker";
import DataProfile from "./DataProfile";

export default function DataRoom({ detail, onChanged }: { detail: ProjectDetail; onChanged: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tax, setTax] = useState<Taxonomy | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getTaxonomy(detail.id).then(setTax).catch(() => setTax(null));
  }, [detail.id, detail.documents.length]);

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
      if (added) parts.push(`${added} added`);
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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <div className="eyebrow mb-3">Upload</div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
          onClick={() => input.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center transition-colors",
            drag ? "border-brass bg-brass/10" : "border-line hover:border-brass/50 hover:bg-surface/50"
          )}
        >
          <div className="font-display text-lg text-parchment">{busy ? "Ingesting…" : "Drop the data room"}</div>
          <p className="mt-2 max-w-xs font-body text-sm text-muted">
            PDF, Excel, CSV, or Word — or a <span className="text-brass/80">.zip</span> of the whole data room.
            Duplicates are detected and skipped.
          </p>
          <input ref={input} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
        {note && <p className="mt-3 font-mono text-xs text-brass/80">{note}</p>}
        {err && <p className="mt-3 font-mono text-xs text-negative">{err}</p>}
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
                {detail.documents.map((d) => (
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
                    <td className="num px-3 py-3 text-right text-sm text-muted">{d.n_chunks}</td>
                    <td className="num px-5 py-3 text-right text-xs text-muted">{shortDate(d.created_at)}</td>
                  </tr>
                ))}
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
