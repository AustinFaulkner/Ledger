"""Standard data-room taxonomy — file every document into the categories a PE buyer
expects (the same top-level buckets Datasite / Ansarada use), rule-based and offline.

Each document is assigned to its single best-matching category (filename weighted over
content), so the Dashboard can show "documents by category" and surface which buckets are
empty — the at-a-glance coverage view a deal team opens first.
"""

from __future__ import annotations

from . import store

# Ordered standard categories with the keywords that indicate them. Filename hits are
# weighted heavily so a well-named file lands in the right bucket regardless of contents.
CATEGORIES: list[tuple[str, list[str]]] = [
    ("Finance", ["income statement", "balance sheet", "cash flow", "statement of operations",
                 "financial statement", "ebitda", "revenue", "gross profit", "p&l",
                 "budget", "forecast", "projection", "working capital"]),
    ("Accounting", ["general ledger", "trial balance", "accounts receivable", "accounts payable",
                    "journal entry", "reconciliation", "audit", "aging", "gaap"]),
    ("Tax", ["tax return", "deferred tax", "tax provision", "form 1120", "sales tax",
             "nol carryforward", "tax basis"]),
    ("Legal", ["agreement", "contract", "lease", "litigation", "bylaws", "incorporation",
               "master service", "indemnif", "license", "patent", "trademark", "corporate"]),
    ("HR", ["employee", "payroll", "headcount", "compensation", "benefits", "org chart",
            "census", "personnel", "stock option"]),
    ("Commercial", ["customer", "sales pipeline", "marketing", "concentration", "churn",
                    "backlog", "bookings", "pricing", "go-to-market"]),
    ("Operational", ["operations", "supply chain", "inventory", "manufacturing", "facility",
                     "logistics", "vendor", "procurement", "production"]),
    ("IT", ["software", "systems", "infrastructure", "cybersecurity", "security", "tech stack",
            "saas", "database"]),
    ("ESG", ["environmental", "sustainability", "esg", "emissions", "governance", "carbon",
             "diversity"]),
    ("General Info", ["cim", "teaser", "overview", "executive summary", "management discussion",
                      "md&a", "mda", "company profile", "memorandum", "results of operations"]),
]
FALLBACK = "Other"


def categorize(project_id: str) -> dict:
    """Assign each document a category and tally documents per category."""
    docs = store.list_documents(project_id)
    chunks_by_doc: dict[str, list[str]] = {}
    for c in store.get_chunks(project_id):
        chunks_by_doc.setdefault(c["document_id"], []).append(c["text"] or "")

    buckets: dict[str, list[str]] = {name: [] for name, _ in CATEGORIES}
    buckets[FALLBACK] = []
    by_document: dict[str, str] = {}

    for d in docs:
        fname = d["filename"].lower().replace("_", " ").replace("-", " ")
        content = (" ".join(chunks_by_doc.get(d["id"], [])))[:4000].lower()
        best, best_score = FALLBACK, 0
        for name, keywords in CATEGORIES:
            score = sum((5 if k in fname else 0) + (1 if k in content else 0) for k in keywords)
            if score > best_score:
                best_score, best = score, name
        by_document[d["id"]] = best
        buckets[best].append(d["filename"])

    categories = [
        {"name": name, "documents": buckets[name], "count": len(buckets[name])}
        for name, _ in CATEGORIES
    ]
    categories.append({"name": FALLBACK, "documents": buckets[FALLBACK], "count": len(buckets[FALLBACK])})
    return {"categories": categories, "by_document": by_document, "total": len(docs)}
