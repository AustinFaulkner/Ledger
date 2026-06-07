import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "./api";
import type { Project } from "./types";
import { cn, shortDate, groupByCompany } from "./lib";
import { NAV, type Section } from "./nav";
import ProjectsView from "./components/ProjectsView";
import Workspace from "./components/Workspace";

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
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

  function openDeal(id: string) {
    setSelectedId(id);
    // Land on Documents when the deal has no files yet; otherwise the Dashboard.
    const p = projects.find((x) => x.id === id);
    setSection((p?.n_documents ?? 0) > 0 ? "dashboard" : "dataroom");
  }
  function goHome() {
    setSelectedId(null);
    refresh(); // refresh document counts so re-opening lands on the right section
  }
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
      <aside className="no-print flex w-72 shrink-0 flex-col border-r border-line bg-ink/50">
        <div className="px-6 pb-4 pt-7">
          <div className="font-display text-2xl font-medium tracking-tight text-parchment">Ledger</div>
          <div className="eyebrow mt-1.5">Quality of Earnings · Diligence</div>
        </div>
        <div className="rule mx-6" />

        {selected ? (
          <DealNav
            deal={selected}
            section={section}
            onSection={setSection}
            onBack={goHome}
            onDelete={() => confirmDelete(selected)}
          />
        ) : (
          <DealsNav groups={groups} onOpen={openDeal} onDelete={confirmDelete} />
        )}

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
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {selected ? (
            <Workspace projectId={selected.id} section={section} onSection={setSection} />
          ) : (
            <ProjectsView
              projects={projects}
              onCreated={async (p) => {
                await refresh();
                setSelectedId(p.id);
                setSection("dataroom"); // a brand-new deal has no files yet
              }}
              onOpen={openDeal}
              onDelete={remove}
            />
          )}
        </motion.div>
      </main>
    </div>
  );
}

/** The grouped section rail shown while a deal is open. */
function DealNav({
  deal,
  section,
  onSection,
  onBack,
  onDelete,
}: {
  deal: Project;
  section: Section;
  onSection: (s: Section) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 pt-4">
        <button
          onClick={onBack}
          className="mb-3 px-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-brass"
        >
          ← All deals
        </button>
        <div className="px-2">
          <div className="truncate font-display text-lg text-parchment">{deal.company ?? deal.name}</div>
          <div className="num text-[11px] text-muted">{deal.name}</div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g, gi) => (
          <motion.div
            key={g.group}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 + gi * 0.04 }}
            className="mb-3"
          >
            <div className="px-3 pb-1 eyebrow">{g.group}</div>
            {g.items.map(([key, label]) => {
              const active = section === key;
              return (
                <button
                  key={key}
                  onClick={() => onSection(key)}
                  className={cn(
                    "relative flex w-full items-center rounded-lg px-3 py-2 text-left font-body text-sm transition-colors",
                    active ? "text-parchment" : "text-muted hover:bg-surface/50 hover:text-parchment"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg border border-brass/30 bg-brass/10"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </motion.div>
        ))}
      </nav>

      <div className="px-5 pb-3">
        <button
          onClick={onDelete}
          className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-negative"
        >
          Delete deal
        </button>
      </div>
    </div>
  );
}

/** The deals list shown on the home screen (grouped by company). */
function DealsNav({
  groups,
  onOpen,
  onDelete,
}: {
  groups: [string, Project[]][];
  onOpen: (id: string) => void;
  onDelete: (p: Project) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pb-1 pt-5">
        <span className="eyebrow">Deals</span>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {groups.map(([company, deals]) =>
          deals.length === 1 ? (
            <NavButton
              key={deals[0].id}
              title={deals[0].company ?? deals[0].name}
              sub={`${deals[0].name} · ${shortDate(deals[0].created_at)}`}
              onOpen={() => onOpen(deals[0].id)}
              onDelete={() => onDelete(deals[0])}
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
                  onOpen={() => onOpen(p.id)}
                  onDelete={() => onDelete(p)}
                />
              ))}
            </div>
          )
        )}
        {groups.length === 0 && <p className="px-3 py-6 text-sm text-muted">No deals yet.</p>}
      </nav>
    </div>
  );
}

function NavButton({
  title,
  sub,
  nested,
  onOpen,
  onDelete,
}: {
  title: string;
  sub: string;
  nested?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex items-center rounded-lg border border-transparent transition-colors hover:bg-surface/60",
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
