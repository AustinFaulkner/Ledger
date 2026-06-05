// Workspace navigation — the deal's sections, grouped by stage of the diligence
// process. Shared by the sidebar rail (App) and the content header (Workspace) so the
// labels stay in one place as features grow.

export type Section =
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

export const NAV: { group: string; items: [Section, string][] }[] = [
  { group: "Overview", items: [["dashboard", "Dashboard"]] },
  { group: "Data Room", items: [["dataroom", "Documents"], ["search", "Search"]] },
  {
    group: "Analysis",
    items: [
      ["qoe", "Quality of Earnings"],
      ["workingcapital", "Working Capital"],
      ["redflags", "Red Flags"],
    ],
  },
  {
    group: "Diligence",
    items: [
      ["matrix", "Diligence Matrix"],
      ["trackers", "Trackers"],
      ["diligence", "Q&A"],
    ],
  },
  { group: "Deliverable", items: [["report", "Report"]] },
];

export const SECTION_LABEL = Object.fromEntries(NAV.flatMap((g) => g.items)) as Record<Section, string>;
