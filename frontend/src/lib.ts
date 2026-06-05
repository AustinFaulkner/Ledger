import type { Project } from "./types";

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

export function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function signedMoney(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Group deals by company (falling back to the deal name when no company is set),
 *  returned alphabetically. Deals within a group keep their original (newest-first) order. */
export function groupByCompany(projects: Project[]): [string, Project[]][] {
  const m = new Map<string, Project[]>();
  for (const p of projects) {
    const key = (p.company || p.name).trim();
    const arr = m.get(key);
    if (arr) arr.push(p);
    else m.set(key, [p]);
  }
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
