export interface Project {
  id: string;
  name: string;
  company: string | null;
  created_at: string;
  n_documents?: number; // included by the projects list (used to pick the landing section)
}

export interface Doc {
  id: string;
  project_id: string;
  filename: string;
  kind: string;
  status: string;
  n_chunks: number;
  chunks_total: number;
  chunks_done: number;
  eta_seconds: number | null;
  created_at: string;
}

export interface Sample {
  name: string;
  company: string;
  filename: string;
  path: string;
}

export interface DocStatus {
  id: string;
  status: string;
  n_chunks: number;
  chunks_total: number;
  chunks_done: number;
  eta_seconds: number | null;
}

export interface ProjectDetail extends Project {
  documents: Doc[];
}

export type AdjustmentKind = "recurring" | "non_recurring" | "questionable";

export interface Adjustment {
  label: string;
  amount: number;
  kind: AdjustmentKind;
  rationale: string;
  confidence: "high" | "medium" | "low";
  evidence_source?: string;
  evidence_quote?: string;
}

export interface DocContent {
  id: string;
  filename: string;
  kind: string;
  content: string;
}

export interface QoEReport {
  reported_ebitda: number;
  adjustments: Adjustment[];
  normalized_ebitda: number;
  revenue_quality_concerns: string[];
  working_capital_notes: string[];
  summary: string;
}

export interface Citation {
  claim: string;
  source: string;
  quote: string;
}

export interface Answer {
  answer: string;
  citations: Citation[];
  confidence: string;
}

// --- Red flags ---
export type Severity = "high" | "medium" | "low";

export interface RedFlag {
  title: string;
  severity: Severity;
  category: string;
  rationale: string;
  recommendation: string;
  evidence_source: string;
  evidence_quote: string;
}

export interface RedFlagReport {
  findings: RedFlag[];
  summary: string;
}

// --- Working capital + proof of cash ---
export interface LineItem {
  label: string;
  amount: number;
  evidence_source: string;
  evidence_quote: string;
}

export interface ProofOfCash {
  reported_revenue: number | null;
  cash_receipts: number | null;
  variance: number | null;
  note: string;
}

export interface WorkingCapitalReport {
  current_assets: LineItem[];
  current_liabilities: LineItem[];
  net_working_capital: number | null;
  nwc_pct_of_revenue: number | null;
  suggested_peg: number | null;
  seasonality_note: string;
  debt_like_items: LineItem[];
  proof_of_cash: ProofOfCash;
  notes: string[];
  summary: string;
}

// --- Data-room readiness ---
export interface ReadinessCategory {
  category: string;
  required: boolean;
  present: boolean;
  documents: string[];
}

export interface ReadinessReport {
  categories: ReadinessCategory[];
  score: number;
  present_required: number;
  total_required: number;
  n_documents: number;
  unclassified: string[];
}

// --- Diligence matrix template ---
export interface MatrixGroup {
  category: string;
  questions: string[];
}

// --- Editable diligence matrix questions (per project) ---
export interface MatrixQuestion {
  id: string;
  project_id: string;
  category: string | null;
  question: string;
  created_at: string;
}

// --- Cross-document search ---
export interface SearchHit {
  document_id: string;
  filename: string;
  kind: string;
  locator: string;
  snippet: string;
  score: number;
}

// --- Tabular data profiling ---
export interface ColumnProfile {
  name: string;
  type: "numeric" | "boolean" | "text";
  count: number;
  null_pct: number;
  distinct: number;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  top?: { value: string; count: number }[];
}

export interface DocProfile {
  filename: string;
  kind: string;
  n_rows: number;
  n_cols: number;
  duplicate_rows: number;
  columns: ColumnProfile[];
  issues: string[];
}

// --- Bulk upload result ---
export interface BulkResult {
  ingested: string[];
  duplicates: string[];
  skipped: string[];
}

// --- Financial time-series (for the report charts) ---
export interface FinancialSummary {
  periods: string[];
  series: Record<string, (number | null)[]>;
  margins: Record<string, (number | null)[]>;
  available: boolean;
}

// --- Cached analysis result wrapper ---
export interface CachedReport<T> {
  payload: T;
  created_at: string;
  stale: boolean; // the data room changed since this was generated
}

// --- Data-room taxonomy (document categories) ---
export interface TaxonomyCategory {
  name: string;
  documents: string[];
  count: number;
}

export interface Taxonomy {
  categories: TaxonomyCategory[];
  by_document: Record<string, string>;
  total: number;
}

// --- Diligence trackers ---
export type TrackerStatus = "open" | "in_progress" | "resolved";

export interface TrackerItem {
  id: string;
  project_id: string;
  title: string;
  category: string | null;
  status: TrackerStatus;
  owner: string | null;
  note: string | null;
  created_at: string;
}
