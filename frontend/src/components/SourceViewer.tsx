import { useEffect, useRef } from "react";

interface Props {
  filename: string;
  kind: string;
  content: string;
  quote: string;
  /** Secondary locator: the claim/rationale this evidence supports. Used to find the
   *  source sentence when the model omitted a verbatim quote (the common case). */
  claim?: string;
  loading: boolean;
  onClose: () => void;
}

/** Build a whitespace-tolerant, case-insensitive regex from a verbatim quote. */
function quoteRegex(quote: string): RegExp | null {
  const q = quote.trim();
  if (q.length < 3) return null;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  try {
    return new RegExp(esc, "i");
  } catch {
    return null;
  }
}

// Significant words for the overlap fallback (drops short / stop words).
const STOP = new Set(
  "the a an of to in and or for on by with as is are was were that this it at from be its their than into over under not no".split(" ")
);
function sigWords(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9$%]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Split text into sentence spans. A boundary is .!? followed by whitespace/end
 *  (so decimals like $1.5 and 12.3% never split) or one-or-more newlines (markdown
 *  lines, bullets, and table rows each become their own span). */
function sentenceSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  const re = /[.!?]["')\]]*(?=\s|$)|\n+/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (text.slice(start, end).trim()) spans.push([start, end]);
    start = end;
  }
  if (text.slice(start).trim()) spans.push([start, text.length]);
  return spans;
}

function trimLead(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

/** Markdown-aware reflow. The data-room files hard-wrap prose at ~80 cols, which in a
 *  narrow panel double-wraps into a "full line, orphan word" zigzag. Join consecutive
 *  prose lines into one (so they soft-wrap to the panel), but keep blank lines (paragraph
 *  breaks) and structural lines — tables, bullets, headings, blockquotes, code fences —
 *  on their own lines. Highlighting runs on the reflowed text, so offsets stay valid. */
function reflow(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const isStruct = (l: string) => /^\s*(\||#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```)/.test(l);
  const out: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      out.push(buf.join(" "));
      buf = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === "") {
      flush();
      out.push("");
    } else if (isStruct(line)) {
      flush();
      out.push(line);
    } else {
      buf.push(line.trim());
    }
  }
  flush();
  return out.join("\n");
}

interface Loc {
  sStart: number;
  sEnd: number;
  exactStart?: number;
  exactEnd?: number;
}

/** Locate the sentence(s) in `content` that an evidence reference points to.
 *  1) verbatim (or first-8-word) match on the quote, then the claim → expand to the
 *     enclosing sentence(s), keeping the exact span so it can be marked more strongly.
 *  2) fallback: the sentence with the most significant-word overlap with quote+claim.
 *  The claim matters because the fast chat model usually omits the verbatim quote but
 *  always returns the claim — and the claim is derived from the source, so it overlaps. */
function locateEvidence(content: string, quote: string, claim = ""): Loc | null {
  const spans = sentenceSpans(content);
  const sentenceAt = (i: number, atEnd = false) =>
    spans.find(([s, e]) => (atEnd ? s < i && i <= e : s <= i && i < e));

  for (const raw of [quote, claim]) {
    const q = (raw || "").trim();
    if (q.length < 3) continue;
    for (const probe of [q, q.split(/\s+/).slice(0, 8).join(" ")]) {
      const re = quoteRegex(probe);
      const m = re ? content.match(re) : null;
      if (m && m.index !== undefined) {
        const ms = m.index;
        const me = m.index + m[0].length;
        const sb = sentenceAt(ms);
        const eb = sentenceAt(me, true) || sb;
        return {
          sStart: trimLead(content, sb ? sb[0] : ms),
          sEnd: eb ? eb[1] : me,
          exactStart: ms,
          exactEnd: me,
        };
      }
    }
  }

  const qw = new Set([...sigWords(quote || ""), ...sigWords(claim || "")]);
  if (!qw.size) return null;
  let best = -1;
  let bestScore = 0;
  spans.forEach(([s, e], i) => {
    const overlap = sigWords(content.slice(s, e)).filter((w) => qw.has(w)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = i;
    }
  });
  if (best >= 0 && bestScore >= Math.min(3, qw.size)) {
    return { sStart: trimLead(content, spans[best][0]), sEnd: spans[best][1] };
  }
  return null;
}

interface Seg {
  text: string;
  cls: "" | "evidence-mark";
}

/** Slice content into [plain, highlighted sentence(s), plain] — a SINGLE highlight
 *  layer over the whole located region, so nothing ever stacks into a darker band. */
function buildSegments(content: string, loc: Loc | null): Seg[] {
  if (!loc) return [{ text: content, cls: "" }];
  const { sStart, sEnd } = loc;
  const segs: Seg[] = [];
  const push = (a: number, b: number, cls: Seg["cls"]) => {
    if (b > a) segs.push({ text: content.slice(a, b), cls });
  };
  push(0, sStart, "");
  push(sStart, sEnd, "evidence-mark");
  push(sEnd, content.length, "");
  return segs;
}

function TextView({ content, quote, claim }: { content: string; quote: string; claim: string }) {
  const anchorRef = useRef<HTMLElement>(null);
  const display = reflow(content);
  useEffect(() => {
    const t = setTimeout(() => anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 160);
    return () => clearTimeout(t);
  }, [content, quote, claim]);
  const segs = buildSegments(display, locateEvidence(display, quote, claim));
  const anchorIdx = segs.findIndex((s) => s.cls); // first highlighted segment → scroll target
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-parchment/85">
      {segs.map((s, i) =>
        s.cls ? (
          <mark key={i} ref={i === anchorIdx ? anchorRef : undefined} className={s.cls}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </pre>
  );
}

/** Split one CSV line, honouring quoted fields. A naive split(",") tears the data-room
 *  header/note lines — which are a single quoted field containing commas — into several
 *  bogus cells. Doubled quotes ("") inside a quoted field are the escaped literal. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

function CsvView({ content, quote, claim }: { content: string; quote: string; claim: string }) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const rows = content.trim().split(/\r?\n/).map(splitCsvLine);

  // Data-room CSVs are ragged: section headings and single-value lines sit in the same
  // file as full 4-column rows. Rendered naively, a short row occupies only the first
  // column and trails dead space to the right. Spread the table's full column count
  // across whatever cells the row actually has — 1 cell spans everything, 2 cells take
  // half each — so every row reaches the right edge. Extra columns go to the leftmost
  // cells, which is where the long label sits.
  const maxCols = Math.max(...rows.map((cells) => cells.length));
  const spansFor = (n: number): number[] => {
    const base = Math.floor(maxCols / n);
    const rem = maxCols % n;
    return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
  };

  // Prefer a verbatim row match; otherwise score each row by significant-word overlap
  // with quote+claim (so an empty quote still pinpoints the right line item).
  const re = quoteRegex(quote);
  let hitRow = re ? rows.findIndex((cells) => re.test(cells.join(" "))) : -1;
  if (hitRow < 0) {
    const needle = new Set([...sigWords(quote || ""), ...sigWords(claim || "")]);
    if (needle.size) {
      let best = -1;
      let bestScore = 0;
      rows.forEach((cells, ri) => {
        const overlap = sigWords(cells.join(" ")).filter((w) => needle.has(w)).length;
        if (overlap > bestScore) {
          bestScore = overlap;
          best = ri;
        }
      });
      if (best > 0 && bestScore >= 2) hitRow = best; // best>0 so the header row never "wins"
    }
  }

  useEffect(() => {
    const t = setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 160);
    return () => clearTimeout(t);
  }, [content, quote, claim]);

  return (
    <table className="w-full border-collapse font-mono text-[12px]">
      <tbody>
        {rows.map((cells, ri) => {
          const isHit = ri === hitRow;
          const isHeader = ri === 0;
          const spans = spansFor(cells.length);
          return (
            <tr key={ri} ref={isHit ? rowRef : undefined} className={isHit ? "evidence-row" : ""}>
              {cells.map((c, ci) => (
                <td
                  key={ci}
                  colSpan={spans[ci]}
                  className={
                    "border border-line px-2.5 py-1.5 " +
                    (isHeader ? "font-semibold text-muted" : "text-parchment/85")
                  }
                >
                  {c}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Docked source panel — rendered inside the Workspace split, not as an overlay. */
export default function SourceViewer({ filename, kind, content, quote, claim = "", loading, onClose }: Props) {
  const referenced = quote?.trim() || claim?.trim() || "";
  return (
    <div className="flex h-full w-full flex-col bg-surface/40">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">Source</div>
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-lg text-parchment">{filename}</span>
            <span className="chip shrink-0">{kind}</span>
          </div>
        </div>
        <button className="btn-ghost shrink-0 text-xs" onClick={onClose}>
          Close ✕
        </button>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-sm text-muted">Loading source…</div>
        ) : kind === "csv" ? (
          <CsvView content={content} quote={quote} claim={claim} />
        ) : (
          <TextView content={content} quote={quote} claim={claim} />
        )}
      </div>
      {referenced && (
        <footer className="border-t border-line px-6 py-3">
          <span className="eyebrow">Referenced</span>
          <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted">{referenced}</p>
        </footer>
      )}
    </div>
  );
}
