import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "./api";
import type { Project } from "./types";
import { cn, shortDate, groupByCompany } from "./lib";
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
  const groups = useMemo(() => groupByCompany(projects), [projects]);

  async function remove(id: string) {
    await api.deleteProject(id).catch(() => {});
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }
  function confirmDelete(p: Project) {
    const label = p.company ? `${p.company} — ${p.name}` : p.name;
    if (window.confirm(`Delete "${label}"?\n\nThis permanently removes its documents, analyses, and trackers.`)) {
      remove(p.id);
    }
  }

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
          {groups.map(([company, deals]) =>
            deals.length === 1 ? (
              <NavButton
                key={deals[0].id}
                title={deals[0].company ?? deals[0].name}
                sub={`${deals[0].name} · ${shortDate(deals[0].created_at)}`}
                active={selectedId === deals[0].id}
                onOpen={() => setSelectedId(deals[0].id)}
                onDelete={() => confirmDelete(deals[0])}
              />
            ) : (
              <div key={company} className="pt-1">
                <div className="flex items-center justify-between px-3 pb-1 pt-2">
                  <span className="eyebrow truncate">{company}</span>
                  <span className="num text-[10px] text-muted">{deals.length}</span>
                </div>
                {deals.map((p) => (
                  <NavButton
                    key={p.id}
                    title={p.name}
                    sub={shortDate(p.created_at)}
                    nested
                    active={selectedId === p.id}
                    onOpen={() => setSelectedId(p.id)}
                    onDelete={() => confirmDelete(p)}
                  />
                ))}
              </div>
            )
          )}
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
            <Workspace
              projectId={selected.id}
              onBack={() => setSelectedId(null)}
              onDelete={() => confirmDelete(selected)}
            />
          ) : (
            <ProjectsView
              projects={projects}
              onCreated={async (p) => {
                await refresh();
                setSelectedId(p.id);
              }}
              onOpen={setSelectedId}
              onDelete={remove}
            />
          )}
        </motion.div>
      </main>
    </div>
  );
}

function NavButton({
  title,
  sub,
  active,
  nested,
  onOpen,
  onDelete,
}: {
  title: string;
  sub: string;
  active: boolean;
  nested?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg transition-colors",
        active ? "border border-brass/30 bg-brass/10" : "border border-transparent hover:bg-surface/60",
        nested && "ml-2"
      )}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 flex-col items-start px-3 py-2 text-left">
        <span className="w-full truncate font-display text-[15px] text-parchment">{title}</span>
        <span className="num w-full truncate text-[11px] text-muted">{sub}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete deal"
        className="absolute right-2 px-1 font-mono text-xs text-muted opacity-0 transition-opacity hover:text-negative group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
