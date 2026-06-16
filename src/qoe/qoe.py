"""Quality-of-Earnings analysis: normalize EBITDA and classify adjustments.

This is the analytical heart of the project. Given a company's financials, the
model proposes a normalized-EBITDA bridge and flags each adjustment as recurring
or non-recurring, with a rationale and a confidence level. The output is a strict
Pydantic schema so it is auditable and testable (see `eval/`).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from . import llm
from .config import settings

SYSTEM = (
    "You are a meticulous Quality-of-Earnings analyst at a private-equity firm. "
    "You normalize EBITDA conservatively, you justify every adjustment, and you "
    "flag anything that looks like an aggressive or non-recurring add-back. "
    "You never invent numbers; if a figure is not supported by the input, you say so. "
    "For EVERY adjustment you propose, you cite its evidence: the exact source filename "
    "and a VERBATIM snippet (a line or figure copied word-for-word) from that file. "
    "Never paraphrase the evidence quote — it must appear in the source exactly."
)


class Adjustment(BaseModel):
    label: str = Field(description="e.g. 'Owner's compensation above market', 'One-time legal settlement'")
    amount: float = Field(description="Dollar impact on EBITDA (positive = add-back)")
    kind: Literal["recurring", "non_recurring", "questionable"]
    rationale: str
    confidence: Literal["high", "medium", "low"]
    evidence_source: str = Field(default="", description="filename the evidence was taken from")
    evidence_quote: str = Field(
        default="", description="VERBATIM snippet (line/figure) from that file supporting this adjustment"
    )


class QoEReport(BaseModel):
    reported_ebitda: float
    adjustments: list[Adjustment]
    normalized_ebitda: float
    revenue_quality_concerns: list[str] = Field(default_factory=list)
    working_capital_notes: list[str] = Field(default_factory=list)
    summary: str


def analyze(financials_text: str) -> QoEReport:
    """Run a QoE pass over the supplied financial-statement text/tables.

    `financials_text` should be the income statement, balance sheet, and any
    management EBITDA bridge, concatenated. For large inputs, summarize line items
    upstream rather than truncating.
    """
    prompt = (
        "Perform a Quality-of-Earnings analysis on the financials below. "
        "Start from reported EBITDA, propose normalizing adjustments, classify each, "
        "and compute normalized EBITDA. Surface revenue-quality and working-capital "
        "concerns. The financials are grouped by source file under '=== filename ===' headers; "
        "for each adjustment set evidence_source to that filename and evidence_quote to a verbatim "
        "line/figure copied from it.\n\n=== FINANCIALS ===\n" + financials_text
    )
    return llm.parse(prompt, QoEReport, system=SYSTEM, max_tokens=8000,
                     model=settings.model_reasoning)
