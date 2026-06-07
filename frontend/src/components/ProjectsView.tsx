import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { Project } from "../types";
import { shortDate, groupByCompany } from "../lib";

interface Props {
  projects: Project[];
  onCreated: (p: Project) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ProjectsView({ projects, onCreated, onOpen, onDelete }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  const companies = useMemo(
    () => Array.from(new Set(projects.map((p) => (p.company || "").trim()).filter(Boolean))).sort(),
    [projects]
  );
  const groups = useMemo(() => groupByCompany(projects), [projects]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const p = await api.createProject(name.trim(), company.trim() || undefined);
      setName("");
      setCompany("");
      onCreated(p);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(p: Project) {
    const label = p.company ? `${p.company} — ${p.name}` : p.name;
    if (window.confirm(`Delete "${label}"?\n\nThis permanently removes its documents, analyses, and trackers.`)) {
      onDelete(p.id);
    }
  }
  function confirmDeleteCompany(companyName: string, deals: Project[]) {
    if (window.confirm(`Delete ${companyName} and all ${deals.length} deals?\n\nThis permanently removes everything for this company.`)) {
      deals.forEach((d) => onDelete(d.id));
    }
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-10 py-14">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-medium tracking-tight text-parchment">Deals</h1>
        <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-muted">
          Create a deal, upload its documents, and run quality-of-earnings, working-capital, and
          risk analysis. Answers cite their source; export a report or Excel databook.
        </p>
      </header>

      <form onSubmit={create} className="panel mb-12 p-6">
        <div className="eyebrow mb-4">Open a new deal</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="field"
            list="company-suggestions"
            placeholder="Target company — e.g. NewCo Industrial"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="off"
          />
          <datalist id="company-suggestions">
            {companies.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            className="field"
            placeholder="Deal name — e.g. Project Falcon"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn whitespace-nowrap" disabled={busy || !name.trim()}>
            {busy ? "Opening…" : "Open deal →"}
          </button>
        </div>
        {company.trim() && companies.includes(company.trim()) && (
          <p className="mt-3 font-mono text-[11px] text-brass/80">
            ↳ Existing company — this deal will be grouped under {company.trim()}.
          </p>
        )}
      </form>

      <div className="eyebrow mb-4">Active deals</div>
      {projects.length === 0 ? (
        <div className="panel px-6 py-12 text-center text-sm text-muted">No deals yet — open one above.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(([companyName, deals], gi) => (
            <motion.div
              key={companyName}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.03 }}
              className="panel p-5"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="truncate font-display text-xl text-parchment">{companyName}</h3>
                {deals.length > 1 && <span className="chip shrink-0">{deals.length} deals</span>}
              </div>
              <div className="mt-3 space-y-1">
                {deals.map((d) => (
                  <div
                    key={d.id}
                    className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2"
                  >
                    <button
                      onClick={() => onOpen(d.id)}
                      className="flex min-w-0 flex-1 items-baseline justify-between gap-3 text-left"
                    >
                      <span className="truncate font-body text-sm text-parchment transition-colors group-hover:text-brass">
                        {d.name}
                      </span>
                      <span className="num shrink-0 text-[11px] text-muted">{shortDate(d.created_at)}</span>
                    </button>
                    <button
                      onClick={() => confirmDelete(d)}
                      title="Delete deal"
                      className="shrink-0 px-1 font-mono text-xs text-muted opacity-0 transition-opacity hover:text-negative group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {deals.length > 1 && (
                <button
                  onClick={() => confirmDeleteCompany(companyName, deals)}
                  className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-muted transition-colors hover:text-negative"
                >
                  Delete all {deals.length} deals
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
