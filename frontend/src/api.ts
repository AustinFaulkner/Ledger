import type {
  Answer,
  BulkResult,
  CachedReport,
  Doc,
  DocContent,
  DocProfile,
  FinancialSummary,
  MatrixGroup,
  Project,
  ProjectDetail,
  QoEReport,
  ReadinessReport,
  RedFlagReport,
  SearchHit,
  Taxonomy,
  TrackerItem,
  WorkingCapitalReport,
} from "./types";

// Same-origin "/api" by default — works in the packaged app (FastAPI serves both
// the dashboard and the API) and in dev (Vite proxies /api → backend, see vite.config).
const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${BASE}/health`).then(json<{ status: string; embeddings: boolean; model: string }>),

  listProjects: () => fetch(`${BASE}/projects`).then(json<Project[]>),

  createProject: (name: string, company?: string) =>
    fetch(`${BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, company: company || null }),
    }).then(json<Project>),

  getProject: (id: string) => fetch(`${BASE}/projects/${id}`).then(json<ProjectDetail>),

  getDocumentContent: (pid: string, docId: string) =>
    fetch(`${BASE}/projects/${pid}/documents/${docId}/content`).then(json<DocContent>),

  uploadDocument: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/projects/${id}/documents`, { method: "POST", body: form }).then(
      json<Doc & { duplicate?: boolean }>
    );
  },

  uploadBulk: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/projects/${id}/documents/bulk`, { method: "POST", body: form }).then(json<BulkResult>);
  },

  search: (id: string, q: string, kind?: string) => {
    const params = new URLSearchParams({ q, k: "20" });
    if (kind) params.set("kind", kind);
    return fetch(`${BASE}/projects/${id}/search?${params}`).then(json<SearchHit[]>);
  },

  getProfile: (id: string) => fetch(`${BASE}/projects/${id}/profile`).then(json<DocProfile[]>),

  getFinancials: (id: string) => fetch(`${BASE}/projects/${id}/financials`).then(json<FinancialSummary>),

  // Fetch the Excel databook and trigger a download (works in pywebview + browser).
  downloadDatabook: async (id: string) => {
    const res = await fetch(`${BASE}/projects/${id}/databook.xlsx`);
    if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diligence-databook.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getCachedQoE: (id: string) =>
    fetch(`${BASE}/projects/${id}/reports/qoe`).then(json<CachedReport<QoEReport> | null>),
  getCachedRedFlags: (id: string) =>
    fetch(`${BASE}/projects/${id}/reports/redflags`).then(json<CachedReport<RedFlagReport> | null>),
  getCachedWorkingCapital: (id: string) =>
    fetch(`${BASE}/projects/${id}/reports/working_capital`).then(json<CachedReport<WorkingCapitalReport> | null>),

  getTaxonomy: (id: string) => fetch(`${BASE}/projects/${id}/taxonomy`).then(json<Taxonomy>),

  listTrackers: (id: string) => fetch(`${BASE}/projects/${id}/trackers`).then(json<TrackerItem[]>),
  seedTrackers: (id: string) =>
    fetch(`${BASE}/projects/${id}/trackers/seed`, { method: "POST" }).then(json<TrackerItem[]>),
  addTracker: (id: string, body: { title: string; category?: string }) =>
    fetch(`${BASE}/projects/${id}/trackers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(json<TrackerItem>),
  updateTracker: (id: string, itemId: string, patch: Partial<Pick<TrackerItem, "title" | "category" | "status" | "owner" | "note">>) =>
    fetch(`${BASE}/projects/${id}/trackers/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<TrackerItem>),
  deleteTracker: (id: string, itemId: string) =>
    fetch(`${BASE}/projects/${id}/trackers/${itemId}`, { method: "DELETE" }).then(json<{ ok: boolean }>),

  runQoE: (id: string) =>
    fetch(`${BASE}/projects/${id}/qoe`, { method: "POST" }).then(json<QoEReport>),

  runRedFlags: (id: string) =>
    fetch(`${BASE}/projects/${id}/redflags`, { method: "POST" }).then(json<RedFlagReport>),

  runWorkingCapital: (id: string) =>
    fetch(`${BASE}/projects/${id}/working-capital`, { method: "POST" }).then(json<WorkingCapitalReport>),

  getReadiness: (id: string) =>
    fetch(`${BASE}/projects/${id}/readiness`).then(json<ReadinessReport>),

  getMatrixTemplate: () => fetch(`${BASE}/matrix/template`).then(json<MatrixGroup[]>),

  ask: (id: string, question: string) =>
    fetch(`${BASE}/projects/${id}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then(json<Answer>),
};
