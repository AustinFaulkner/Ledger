import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "./api";
import type { Project } from "./types";
import { cn, shortDate } from "./lib";
import ProjectsView from "./components/ProjectsView";
import Workspace from "./components/Workspace";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [health, setHealth] = useState<{ embeddings: boolean; model: string } | null>(null);

  async function refresh() {
    setProjects(await api.listProjects().catch(() => []));
  }

  useEffect(() => {
    refresh();
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="no-print flex w-72 shrink-0 flex-col border-r border-line bg-ink/40">
        <div className="px-6 pb-5 pt-7">
          <div className="font-display text-2xl font-medium tracking-tight text-parchment">Ledger</div>
          <div className="eyebrow mt-1.5">Quality of Earnings · Diligence</div>
        </div>
        <div className="rule mx-6" />
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <span className="eyebrow">Deals</span>
          <button className="font-mono text-muted transition-colors hover:text-brass" onClick={() => setSelectedId(null)} title="All deals">
            ◳
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors",
                selectedId === p.id
                  ? "border border-brass/30 bg-brass/10"
                  : "border border-transparent hover:bg-surface/60"
              )}
            >
              <span className="font-display text-[15px] text-parchment">{p.company ?? p.name}</span>
              <span className="num text-[11px] text-muted">
                {p.name} · {shortDate(p.created_at)}
              </span>
            </button>
          ))}
          {projects.length === 0 && <p className="px-3 py-6 text-sm text-muted">No deals yet.</p>}
        </nav>
        <div className="rule mx-6" />
        <div className="flex items-center gap-2 px-6 py-4 font-mono text-[11px] text-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", health ? "bg-positive" : "bg-negative")} />
          {health ? `${health.model.split("/").pop()} · ${health.embeddings ? "embeddings" : "keyword"}` : "backend offline"}
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden">
        <motion.div
          key={selectedId ?? "home"}
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {selected ? (
            <Workspace projectId={selected.id} onBack={() => setSelectedId(null)} />
          ) : (
            <ProjectsView
              projects={projects}
              onCreated={async (p) => {
                await refresh();
                setSelectedId(p.id);
              }}
              onOpen={setSelectedId}
            />
          )}
        </motion.div>
      </main>
    </div>
  );
}
