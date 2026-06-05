import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import type { ProjectDetail } from "../types";
import { cn } from "../lib";
import Dashboard from "./Dashboard";
import DataRoom from "./DataRoom";
import SearchView from "./SearchView";
import QoEReport from "./QoEReport";
import WorkingCapital from "./WorkingCapital";
import RedFlags from "./RedFlags";
import DiligenceMatrix from "./DiligenceMatrix";
import Trackers from "./Trackers";
import ChatPanel from "./ChatPanel";
import ReportView from "./ReportView";
import SourceViewer from "./SourceViewer";

type Tab =
  | "dashboard"
  | "dataroom"
  | "search"
  | "qoe"
  | "workingcapital"
  | "redflags"
  | "matrix"
  | "trackers"
  | "diligence"
  | "report";

interface Cite {
  filename: string;
  kind: string;
  content: string;
  quote: string;
  claim: string;
}

export default function Workspace({
  projectId,
  onBack,
  onDelete,
}: {
  projectId: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [cite, setCite] = useState<Cite | null>(null);
  const [citeLoading, setCiteLoading] = useState(false);

  // Docked panel takes ~46% of the window, clamped — computed once.
  const panelWidth = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return Math.min(680, Math.max(440, Math.round(w * 0.46)));
  }, []);

  async function refresh() {
    setDetail(await api.getProject(projectId));
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  // Open the docked source panel to a cited file + highlight the evidence. `claim` is
  // the secondary locator used when the model didn't emit a verbatim quote.
  async function openCite(source: string, quote: string, claim = "") {
    if (!detail) return;
    const doc = detail.documents.find((d) => d.filename === source);
    if (!doc) {
      setCite({ filename: source || "source", kind: "txt", content: quote || claim, quote, claim });
      return;
    }
    setCiteLoading(true);
    setCite({ filename: doc.filename, kind: doc.kind, content: "", quote, claim });
    try {
      const dc = await api.getDocumentContent(detail.id, doc.id);
      setCite({ filename: dc.filename, kind: dc.kind, content: dc.content, quote, claim });
    } catch {
      setCite({ filename: doc.filename, kind: doc.kind, content: "(failed to load source)", quote, claim });
    } finally {
      setCiteLoading(false);
    }
  }

  if (!detail) return <div className="p-12 font-mono text-sm text-muted">Loading deal…</div>;

  const tabs: [Tab, string][] = [
    ["dashboard", "Dashboard"],
    ["dataroom", "Data Room"],
    ["search", "Search"],
    ["qoe", "Quality of Earnings"],
    ["workingcapital", "Working Capital"],
    ["redflags", "Red Flags"],
    ["matrix", "Diligence Matrix"],
    ["trackers", "Trackers"],
    ["diligence", "Q&A"],
    ["report", "Report"],
  ];
  const chunks = detail.documents.reduce((a, d) => a + d.n_chunks, 0);

  return (
    <div className="flex h-full">
      {/* main analysis column — shrinks when the source panel docks in */}
      <div className="min-w-0 flex-1 overflow-y-auto px-10 py-9">
        <div className="no-print mb-6 flex items-center justify-between">
          <button onClick={onBack} className="btn-ghost text-xs">
            ← All deals
          </button>
          <button
            onClick={onDelete}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-negative"
          >
            Delete deal
          </button>
        </div>

        <div className="no-print flex items-end justify-between">
          <div>
            <div className="eyebrow mb-2">Deal · {detail.name}</div>
            <h1 className="font-display text-4xl font-medium tracking-tight text-parchment">
              {detail.company ?? detail.name}
            </h1>
          </div>
          <div className="text-right font-mono text-xs text-muted">
            <div>{detail.documents.length} documents</div>
            <div>{chunks} chunks indexed</div>
          </div>
        </div>

        <div className="no-print mt-7 flex gap-6 overflow-x-auto border-b border-line">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "relative -mb-px shrink-0 whitespace-nowrap pb-3 font-body text-sm transition-colors",
                tab === k ? "text-parchment" : "text-muted hover:text-parchment"
              )}
            >
              {label}
              {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brass" />}
            </button>
          ))}
        </div>

        <div className="py-8">
          {(() => {
            const hasDocs = detail.documents.length > 0;
            switch (tab) {
              case "dashboard":
                return <Dashboard projectId={projectId} detail={detail} onNavigate={(t) => setTab(t as Tab)} />;
              case "dataroom":
                return <DataRoom detail={detail} onChanged={refresh} />;
              case "search":
                return (
                  <SearchView
                    projectId={projectId}
                    kinds={detail.documents.map((d) => d.kind)}
                    onCite={openCite}
                  />
                );
              case "qoe":
                return <QoEReport projectId={projectId} hasDocs={hasDocs} onCite={openCite} />;
              case "workingcapital":
                return <WorkingCapital projectId={projectId} hasDocs={hasDocs} onCite={openCite} />;
              case "redflags":
                return <RedFlags projectId={projectId} hasDocs={hasDocs} onCite={openCite} />;
              case "matrix":
                return <DiligenceMatrix projectId={projectId} hasDocs={hasDocs} onCite={openCite} />;
              case "trackers":
                return <Trackers projectId={projectId} />;
              case "diligence":
                return <ChatPanel projectId={projectId} hasDocs={hasDocs} onCite={openCite} />;
              case "report":
                return (
                  <ReportView
                    projectId={projectId}
                    company={detail.company ?? detail.name}
                    dealName={detail.name}
                  />
                );
            }
          })()}
        </div>
      </div>

      {/* docked source panel — slides in beside the content, no overlay */}
      <AnimatePresence>
        {cite && (
          <motion.div
            className="h-full shrink-0 overflow-hidden border-l border-line"
            initial={{ width: 0 }}
            animate={{ width: panelWidth }}
            exit={{ width: 0 }}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
          >
            <div style={{ width: panelWidth }} className="h-full">
              <SourceViewer
                filename={cite.filename}
                kind={cite.kind}
                content={cite.content}
                quote={cite.quote}
                claim={cite.claim}
                loading={citeLoading}
                onClose={() => setCite(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
