"""Data-room readiness — classify uploaded documents into standard diligence categories
and score coverage against a checklist (Datasite / Ansarada-style).

Deliberately rule-based (filename + document text keywords) so it runs instantly and
fully offline — no model call. The checklist marks which categories a buyer expects in a
QoE/diligence data room; `assess()` reports which are covered, by which files, and which
required categories are still missing.
"""

from __future__ import annotations

from . import store

# (display name, required?, matching keywords). A document is filed under every category
# whose keywords appear in its filename or text. Keywords are deliberately SPECIFIC
# (multi-word phrases / filenames that indicate a dedicated document or section) so that
# an incidental mention — a "tax" line in the P&L, "legal" in an add-back — doesn't make a
# category look covered when no real document exists. That's what surfaces the true gaps.
CHECKLIST: list[tuple[str, bool, list[str]]] = [
    ("Income Statement", True,
     ["income statement", "statement of operations", "profit and loss", "income_statement"]),
    ("Balance Sheet", True,
     ["balance sheet", "balance_sheet", "statement of financial position"]),
    ("Cash Flow", True,
     ["cash flow", "cash_flow", "statement of cash flows", "operating activities"]),
    ("EBITDA / Add-backs", True,
     ["ebitda", "add-back", "addback", "ebitda bridge", "normalized ebitda", "run-rate adjustment"]),
    ("Revenue / Customers", False,
     ["customer concentration", "largest customers", "revenue by customer", "top customers",
      "cohort", "net revenue retention", "churn", "backlog", "bookings"]),
    ("Management Discussion", False,
     ["md&a", "management discussion", "mda_", "_mda", "results of operations"]),
    ("Contracts / Legal", False,
     ["master service agreement", "customer contract", "supply agreement", "lease agreement",
      "litigation", "indemnif", "_contract", "_msa", "engagement letter"]),
    ("Tax", False,
     ["tax return", "deferred tax", "tax provision", "form 1120", "nol carryforward", "tax basis"]),
    ("Debt / Capital", False,
     ["credit agreement", "term loan", "revolver", "cap table", "capitalization table",
      "debt schedule", "promissory note"]),
    ("Org / HR", False,
     ["org chart", "organizational chart", "headcount", "payroll register", "employee census", "cap table"]),
]

_TEXT_SCAN_LIMIT = 6000  # chars of document text scanned per file


def assess(project_id: str) -> dict:
    """Score data-room coverage against the standard diligence checklist."""
    docs = store.list_documents(project_id)
    chunks_by_doc: dict[str, list[str]] = {}
    for c in store.get_chunks(project_id):
        chunks_by_doc.setdefault(c["document_id"], []).append(c["text"] or "")

    haystacks = {
        d["id"]: (d["filename"] + " " + " ".join(chunks_by_doc.get(d["id"], [])))[:_TEXT_SCAN_LIMIT].lower()
        for d in docs
    }

    categories = []
    for name, required, keywords in CHECKLIST:
        matched = [d["filename"] for d in docs if any(k in haystacks[d["id"]] for k in keywords)]
        categories.append(
            {"category": name, "required": required, "present": bool(matched), "documents": matched}
        )

    required_cats = [c for c in categories if c["required"]]
    present_required = [c for c in required_cats if c["present"]]
    score = round(100 * len(present_required) / max(1, len(required_cats)))
    classified = {f for c in categories for f in c["documents"]}
    return {
        "categories": categories,
        "score": score,
        "present_required": len(present_required),
        "total_required": len(required_cats),
        "n_documents": len(docs),
        "unclassified": [d["filename"] for d in docs if d["filename"] not in classified],
    }
