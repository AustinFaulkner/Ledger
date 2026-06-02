import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import type { Project } from "../types";
import { shortDate } from "../lib";

interface Props {
  projects: Project[];
  onCreated: (p: Project) => void;
  onOpen: (id: string) => void;
}

export default function ProjectsView({ projects, onCreated, onOpen }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-10 py-14">
      <header className="mb-12">
        <div className="eyebrow mb-4">Diligence Workspace</div>
        <h1 className="font-display text-5xl font-medium leading-[1.04] tracking-tight text-parchment">
          Read the numbers.
          <br />
          <span className="text-brass">Find the truth.</span>
        </h1>
        <p className="mt-5 max-w-xl font-body text-[15px] leading-relaxed text-muted">
          Open a deal, drop in the data room, and generate a quality-of-earnings analysis with a
          normalized EBITDA bridge — then interrogate the documents with cited answers.
        </p>
      </header>

      <form onSubmit={create} className="panel mb-12 p-6">
        <div className="eyebrow mb-4">Open a new deal</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="field"
            placeholder="Target company — e.g. NewCo Industrial"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
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
      </form>

      <div className="eyebrow mb-4">Active deals</div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {projects.map((p, i) => (
          <motion.button
            key={p.id}
            onClick={() => onOpen(p.id)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="group bg-surface/70 p-6 text-left transition-colors hover:bg-surface2"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-xl text-parchment transition-colors group-hover:text-brass">
                {p.company ?? p.name}
              </h3>
              <span className="num text-[11px] text-muted">{shortDate(p.created_at)}</span>
            </div>
            <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">{p.name}</div>
          </motion.button>
        ))}
        {projects.length === 0 && (
          <div className="bg-surface/70 p-10 text-center text-sm text-muted sm:col-span-2">
            No deals yet — open one above.
          </div>
        )}
      </div>
    </div>
  );
}
