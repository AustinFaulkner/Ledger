"""Extract a structured financial time-series from the statement CSVs — offline and
rule-based (line-item label matching), to drive the report's trend charts. No LLM, no
pandas. Routes each tabular file to income statement / balance sheet / cash flow by the
line items it contains, then pulls the canonical lines and derives margins, EBITDA and
net working capital across the periods.
"""

from __future__ import annotations

from . import profiling, store


def extract(project_id: str) -> dict:
    """Return {periods, series, margins, available} parsed from the statement tables."""
    tables = []
    for doc in store.list_documents(project_id):
        if (doc.get("kind") or "").lower() in profiling.TABULAR_KINDS:
            periods, table = _read_table(doc)
            if table:
                tables.append((periods, table))

    inc = _match_table(tables, "revenue", "net sales")
    bal = _match_table(tables, "total current assets", "total assets")
    cf = _match_table(tables, "cash from operations", "operating activities")

    periods = (inc or bal or cf or (None, None))[0] or []
    series: dict[str, list] = {}
    margins: dict[str, list] = {}

    def put(name: str, vals):
        if vals and any(v is not None for v in vals):
            series[name] = vals

    revenue = gross = op_income = None
    if inc:
        t = inc[1]
        revenue = _find(t, "revenue", "net sales", "total revenue")
        cogs = _find(t, "cogs", "cost of goods", "cost of revenue", "cost of sales")
        gross = _find(t, "gross profit") or _sub(revenue, cogs)
        op_income = _find(t, "operating income", "operating profit", "ebit ")
        put("Revenue", revenue)
        put("Gross profit", gross)
        put("Operating income", op_income)
        put("Net income", _find(t, "net income", "net earnings"))

    da = _find(cf[1], "depreciation", "amortization", "d&a") if cf else None
    if op_income and da:
        ebitda = [_add(op_income[i], _abs(da[i])) for i in range(min(len(op_income), len(da)))]
        put("EBITDA", ebitda)
    if cf:
        put("Operating cash flow", _find(cf[1], "cash from operations", "operating activities"))

    ca = cl = None
    if bal:
        ca = _find(bal[1], "total current assets")
        cl = _find(bal[1], "total current liabilities")
        nwc = _sub(ca, cl)
        put("Net working capital", nwc)

    # margins (%)
    if revenue:
        if gross:
            margins["Gross margin %"] = _ratio(gross, revenue)
        if op_income:
            margins["Operating margin %"] = _ratio(op_income, revenue)

    return {
        "periods": periods,
        "series": series,
        "margins": margins,
        "available": bool(series) and bool(periods),
    }


# --- table reading ---

def _read_table(doc) -> tuple[list[str] | None, dict[str, list] | None]:
    rows = profiling._read_rows(doc)
    while rows and (not any(str(c).strip() for c in rows[0]) or str(rows[0][0]).lstrip().startswith("#")):
        rows = rows[1:]
    if len(rows) < 2:
        return None, None
    header = rows[0]
    periods = [str(h).strip() for h in header[1:]]
    table: dict[str, list] = {}
    for r in rows[1:]:
        if not r or not str(r[0]).strip():
            continue
        label = str(r[0]).strip().lower()
        table[label] = [profiling._to_number(r[i]) if i < len(r) else None for i in range(1, len(header))]
    return periods, table


def _match_table(tables, *markers):
    """Pick the table whose line items include one of the markers."""
    for periods, table in tables:
        if any(any(m in label for label in table) for m in markers):
            return periods, table
    return None


def _find(table: dict[str, list], *keys) -> list | None:
    for label, vals in table.items():
        if any(k in label for k in keys):
            return vals
    return None


# --- elementwise numeric helpers (None-safe) ---

def _abs(x):
    return abs(x) if x is not None else None


def _add(a, b):
    return None if a is None or b is None else round(a + b, 2)


def _sub(a, b):
    if not a or not b:
        return None
    return [None if a[i] is None or b[i] is None else round(a[i] - b[i], 2) for i in range(min(len(a), len(b)))]


def _ratio(a, b):
    return [None if a[i] is None or not b[i] else round(100 * a[i] / b[i], 1) for i in range(min(len(a), len(b)))]
