import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { TrackerItem, TrackerStatus } from "../types";
import { cn } from "../lib";

const CATEGORIES = ["Finance", "Accounting", "Tax", "Legal", "HR", "Commercial", "Operational", "IT", "ESG", "General Info", "Other"];

const STATUS: Record<TrackerStatus, { label: string; chip: string; dot: string; next: TrackerStatus }> = {
  open: { label: "Open", chip: "text-muted border-line", dot: "bg-muted", next: "in_progress" },
  in_progress: { label: "In progress", chip: "text-brass border-brass/40", dot: "bg-brass", next: "resolved" },
  resolved: { label: "Resolved", chip: "text-positive border-positive/40", dot: "bg-positive", next: "open" },
};
const ORDER: TrackerStatus[] = ["open", "in_progress", "resolved"];

export default function Trackers({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<TrackerItem[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Finance");
  const [busy, setBusy] = useState(false);

  async function load() {
    setItems(await api.listTrackers(projectId).catch(() => []));
  }
  useEffect(() => {
    load();
  }, [projectId]);

  async function seed() {
    setBusy(true);
    try {
      setItems(await api.seedTrackers(projectId));
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle("");
    await api.addTracker(projectId, { title: t, category });
    load();
  }

  async function cycle(it: TrackerItem) {
    const next = STATUS[it.status].next;
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: next } : x))); // optimistic
    await api.updateTracker(projectId, it.id, { status: next });
  }

  async function setOwner(it: TrackerItem, owner: string) {
    if ((it.owner ?? "") === owner) return;
    await api.updateTracker(projectId, it.id, { owner });
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, owner } : x)));
  }

  async function remove(it: TrackerItem) {
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    await api.deleteTracker(projectId, it.id);
  }

  const resolved = items.filter((i) => i.status === "resolved").length;
  const pct = items.length ? Math.round((100 * resolved) / items.length) : 0;

  if (items.length === 0) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="eyebrow mb-3">Diligence Trackers</div>
        <h2 className="font-display text-2xl text-parchment">Request checklist</h2>
        <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-muted">
          A working checklist of diligence requests — owner, status, category. Start from the standard
          request list, then add your own.
        </p>
        <button className="btn mt-7" disabled={busy} onClick={seed}>
          {busy ? "Adding…" : "Load standard checklist →"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-6">
          {ORDER.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", STATUS[s].dot)} />
              <span className="num text-xl text-parchment">{items.filter((i) => i.status === s).length}</span>
              <span className="eyebrow">{STATUS[s].label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-positive" style={{ width: `${pct}%` }} />
          </div>
          <span className="num text-xs text-muted">{pct}% closed</span>
        </div>
      </div>

      <form onSubmit={add} className="flex gap-3">
        <input
          className="field"
          placeholder="Add a diligence request…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select className="field w-40 shrink-0" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn shrink-0" disabled={!title.trim()}>
          Add
        </button>
      </form>

      <div className="panel overflow-hidden">
        {items.map((it, i) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "group flex items-center gap-4 border-b border-line px-5 py-3 last:border-0",
              it.status === "resolved" && "opacity-60"
            )}
          >
            <button
              onClick={() => cycle(it)}
              className={cn("chip shrink-0 transition-colors hover:text-parchment", STATUS[it.status].chip)}
              title="Click to advance status"
            >
              {STATUS[it.status].label}
            </button>
            <div className="min-w-0 flex-1">
              <div className={cn("font-body text-sm text-parchment", it.status === "resolved" && "line-through decoration-muted")}>
                {it.title}
              </div>
            </div>
            {it.category && <span className="chip hidden shrink-0 sm:inline-flex">{it.category}</span>}
            <input
              defaultValue={it.owner ?? ""}
              placeholder="owner"
              onBlur={(e) => setOwner(it, e.target.value.trim())}
              className="w-24 shrink-0 rounded border border-line bg-ink/40 px-2 py-1 font-mono text-[11px] text-parchment placeholder:text-muted/50 outline-none focus:border-brass/50"
            />
            <button
              onClick={() => remove(it)}
              className="shrink-0 font-mono text-xs text-muted opacity-0 transition-opacity hover:text-negative group-hover:opacity-100"
              title="Delete"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
