"""Net Working Capital + Proof of Cash — the QoE deliverables beyond the EBITDA bridge.

Extracts the balance-sheet working-capital components, assesses the NWC trend and
seasonality, proposes a target NWC "peg" for the purchase agreement, identifies
debt-like items (the bridge from enterprise to equity value), and attempts a
proof-of-cash tie-out of reported revenue to cash receipts. Every extracted figure
carries its source filename and a verbatim quote, like the rest of the system.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from . import llm
from .config import settings

SYSTEM = (
    "You are a Quality-of-Earnings analyst focused on net working capital and cash. "
    "You extract balance-sheet working-capital components, assess the NWC trend and "
    "seasonality, propose a target NWC 'peg' for the deal, identify debt-like items, and "
    "attempt a proof-of-cash tie-out of revenue to cash receipts. You never invent numbers: "
    "if a component is not present in the data, leave it null and note it. Every figure you "
    "extract carries its source filename and a VERBATIM quote copied from that file."
)


class LineItem(BaseModel):
    label: str = Field(description="e.g. 'Accounts receivable', 'Inventory', 'Accounts payable'")
    amount: float
    evidence_source: str = Field(default="")
    evidence_quote: str = Field(default="", description="VERBATIM line from the source")


class ProofOfCash(BaseModel):
    reported_revenue: float | None = None
    cash_receipts: float | None = Field(
        default=None, description="cash collected from customers, if derivable from the cash-flow statement"
    )
    variance: float | None = Field(default=None, description="reported_revenue − cash_receipts")
    note: str = Field(default="", description="what the tie-out shows, or why it can't be completed")


class WorkingCapitalReport(BaseModel):
    current_assets: list[LineItem] = Field(default_factory=list)
    current_liabilities: list[LineItem] = Field(default_factory=list)
    net_working_capital: float | None = Field(default=None, description="current assets − current liabilities")
    nwc_pct_of_revenue: float | None = None
    suggested_peg: float | None = Field(default=None, description="target NWC to set in the purchase agreement")
    seasonality_note: str = Field(default="", description="intra-year swings a buyer should size the peg around")
    debt_like_items: list[LineItem] = Field(
        default_factory=list, description="items that adjust enterprise value to equity value"
    )
    proof_of_cash: ProofOfCash = Field(default_factory=ProofOfCash)
    notes: list[str] = Field(default_factory=list)
    summary: str = ""


def analyze(financials_text: str) -> WorkingCapitalReport:
    """Run an NWC + proof-of-cash pass over the supplied financial-statement text."""
    prompt = (
        "From the financials below, perform a net-working-capital and proof-of-cash analysis:\n"
        "1. Extract current-asset and current-liability line items (operating items: AR, "
        "inventory, prepaids, AP, accrued liabilities, deferred revenue — EXCLUDE cash and "
        "short-term debt, which are debt-like).\n"
        "2. Compute net working capital and NWC as a % of revenue.\n"
        "3. Propose a target NWC 'peg' and note any seasonality a buyer should size it around.\n"
        "4. List debt-like items (short-term debt, current portion of long-term debt, deferred "
        "revenue, unfunded liabilities) that bridge enterprise value to equity value.\n"
        "5. Attempt a proof of cash: tie reported revenue to cash receipts; if cash receipts "
        "are not derivable, set them null and explain in the note.\n"
        "For every extracted figure, set evidence_source and a VERBATIM evidence_quote from that "
        "file. The financials are grouped by source file under '=== filename ===' headers. Leave "
        "any figure you cannot support null rather than guessing.\n\n"
        "=== FINANCIALS ===\n" + financials_text
    )
    return llm.parse(prompt, WorkingCapitalReport, system=SYSTEM, max_tokens=9000,
                     model=settings.model_reasoning)
