import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import type { ProjectDetail } from "../types";
import { SECTION_LABEL, type Section } from "../nav";
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

interface Cite {
  filename: string;
  kind: string;
  content: string;
  quote: string;
  claim: string;
}

interface Props {
  projectId: string;
  section: Section;
  onSection: (s: Section) => void;
}

export default function Workspace({ projectId, section, onSection }: Props) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [cite, setCite] = useState<Cite | null>(null);
  const [citeLoading, setCiteLoading] = useState(false);

  const panelWidth = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    return Math.min(680, Math.max(440, Math.round(w * 0.44)));
  }, []);

  async function refresh() {
    setDetail(await api.getProject(projectId));
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // close the docked source panel when changing section
  useEffect(() => {
    setCite(null);
  }, [section]);

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

  const hasDocs = detail.documents.length > 0;
  const chunks = detail.documents.reduce((a, d) => a + d.n_chunks, 0);

  function renderSection() {
    switch (section) {
      case "dashboard":
        return <Dashboard projectId={projectId} detail={detail!} onNavigate={(t) => onSection(t as Section)} />;
      case "dataroom":
        return <DataRoom detail={detail!} onChanged={refresh} />;
      case "search":
        return <SearchView projectId={projectId} kinds={detail!.documents.map((d) => d.kind)} onCite={openCite} />;
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
        return <ReportView projectId={projectId} company={detail!.company ?? detail!.name} dealName={detail!.name} />;
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* slim, sticky section header */}
        <div className="no-print flex shrink-0 items-center justify-between border-b border-line bg-ink/60 px-10 py-4 backdrop-blur-sm">
          <div className="min-w-0">
            <div className="eyebrow mb-0.5 truncate">
              {detail.company ?? detail.name} · {detail.name}
            </div>
            <h1 className="font-display text-2xl tracking-tight text-parchment">{SECTION_LABEL[section]}</h1>
          </div>
          <div className="shrink-0 text-right font-mono text-[11px] text-muted">
            <div>{detail.documents.length} documents</div>
            <div>{chunks} chunks indexed</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderSection()}
          </motion.div>
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
