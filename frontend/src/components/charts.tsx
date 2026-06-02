import { cn } from "../lib";

/** Bespoke, dependency-free charts in the deal-room palette (brass on ink). */

type Num = number | null;

/** Format a $000s-base figure as $B / $M (statements are in thousands). */
export function finFmt(thousands: number): string {
  const m = thousands / 1000;
  if (Math.abs(m) >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (Math.abs(m) >= 1) return `$${m.toLocaleString("en-US", { maximumFractionDigits: 0 })}M`;
  return `$${(thousands).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
}

export function BarChart({
  labels,
  values,
  format = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  height = 150,
  accent = "bg-brass/55",
}: {
  labels: string[];
  values: Num[];
  format?: (n: number) => string;
  height?: number;
  accent?: string;
}) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(...nums.map(Math.abs), 1);
  return (
    <div className="flex items-end gap-4" style={{ height }}>
      {nums.map((v, i) => {
        const h = Math.max(3, (Math.abs(v) / max) * (height - 36));
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end">
            <span className="num mb-1 text-[10.5px] text-parchment/70">{format(v)}</span>
            <div
              className={cn("w-full max-w-[68px] rounded-t", v < 0 ? "bg-negative/45" : accent)}
              style={{ height: h }}
            />
            <span className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-muted">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({
  labels,
  series,
  height = 150,
}: {
  labels: string[];
  series: { name: string; values: Num[]; color: string }[];
  height?: number;
}) {
  const W = 320;
  const H = 120;
  const pad = 8;
  const flat = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const max = Math.max(...flat, 1) * 1.1;
  const min = Math.min(0, ...flat);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, labels.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
            .filter(Boolean)
            .join(" ");
          return (
            <polyline
              key={s.name}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between">
        {labels.map((l, i) => (
          <span key={i} className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** EBITDA bridge waterfall: reported → ±adjustments → normalized. */
export function Waterfall({
  reported,
  adjustments,
  normalized,
  format = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 0 }),
  height = 230,
}: {
  reported: number;
  adjustments: { label: string; amount: number }[];
  normalized: number;
  format?: (n: number) => string;
  height?: number;
}) {
  type Col = { label: string; bottom: number; top: number; kind: "base" | "up" | "down" | "total"; amount: number };
  const cols: Col[] = [{ label: "Reported", bottom: 0, top: reported, kind: "base", amount: reported }];
  let run = reported;
  for (const a of adjustments) {
    const next = run + a.amount;
    cols.push({
      label: a.label,
      bottom: Math.min(run, next),
      top: Math.max(run, next),
      kind: a.amount >= 0 ? "up" : "down",
      amount: a.amount,
    });
    run = next;
  }
  cols.push({ label: "Normalized", bottom: 0, top: normalized, kind: "total", amount: normalized });
  const max = Math.max(reported, normalized, ...cols.map((c) => c.top), 1) * 1.06;
  const plot = height - 34;
  const color = (k: Col["kind"]) =>
    k === "base" ? "bg-parchment/25" : k === "total" ? "bg-brass/60" : k === "up" ? "bg-positive/45" : "bg-negative/50";

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: plot }}>
        {cols.map((c, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: plot }}>
            <span className="num mb-1 text-[9px] text-muted">
              {c.kind === "up" || c.kind === "down" ? (c.amount >= 0 ? "+" : "−") + format(Math.abs(c.amount)) : format(c.top)}
            </span>
            <div
              className={cn("w-full max-w-[52px] rounded-sm", color(c.kind))}
              style={{ height: Math.max(2, ((c.top - c.bottom) / max) * plot), marginBottom: (c.bottom / max) * plot }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {cols.map((c, i) => (
          <div
            key={i}
            className="flex-1 truncate text-center font-mono text-[9px] uppercase tracking-wide text-muted"
            title={c.label}
          >
            {c.label.length > 11 ? c.label.slice(0, 10) + "…" : c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
