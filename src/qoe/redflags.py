"""Red-flag / risk-signal detection over the data room (MindBridge-style, statement level).

Scans the financials + narrative for the earnings-quality risks a buyer should chase
down — aggressive or round-number add-backs, owner/related-party items, customer
concentration, revenue cut-off / period-end spikes, margin and cash-conversion
anomalies, one-time items dressed up as recurring — and returns ranked findings, each
with a severity, category, buyer-focused rationale, a concrete next diligence step, and
a VERBATIM evidence quote tied to its source file (so every flag is auditable).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from . import llm
from .config import settings

SYSTEM = (
    "You are a forensic-minded Quality-of-Earnings analyst at a private-equity firm. "
    "You hunt for earnings-quality risks and accounting red flags in a target's data room, "
    "and you are skeptical of management-friendly adjustments. You never invent figures: "
    "every flag must be grounded in a VERBATIM snippet copied word-for-word from a source "
    "file. If the data room is clean on a dimension, you do NOT manufacture a flag — quality "
    "of findings beats quantity."
)


class RedFlag(BaseModel):
    title: str = Field(description="short headline, e.g. 'Round-number owner add-back'")
    severity: Literal["high", "medium", "low"]
    category: str = Field(
        description="one of: Add-backs, Revenue quality, Customer concentration, "
        "Working capital, Cash conversion, Related party, Cut-off, Margins, Other"
    )
    rationale: str = Field(description="why this is a concern for a buyer")
    recommendation: str = Field(default="", description="the concrete next diligence step")
    evidence_source: str = Field(default="", description="filename the evidence was taken from")
    evidence_quote: str = Field(
        default="", description="VERBATIM snippet (line/figure) from that file supporting the flag"
    )


class RedFlagReport(BaseModel):
    findings: list[RedFlag] = Field(default_factory=list)
    summary: str = Field(
        default="", description="2-3 sentence overview of the overall earnings-quality picture"
    )


def scan(financials_text: str) -> RedFlagReport:
    """Surface and rank the earnings-quality risks in a data room."""
    prompt = (
        "Review the target's data room below and surface the most important earnings-quality "
        "risks and accounting red flags a buyer should investigate before closing. Rank them by "
        "severity (high/medium/low). For EACH finding, set: a short title, the category, a "
        "buyer-focused rationale, a concrete next diligence step (recommendation), and "
        "evidence_source + a VERBATIM evidence_quote copied from that file.\n"
        "Look specifically for: aggressive or suspiciously round-number add-backs; owner / "
        "related-party items; customer or supplier concentration; revenue cut-off or period-end "
        "spikes; gross-margin or cash-conversion anomalies; and one-time items treated as "
        "recurring (or vice-versa). The data room is grouped by source file under "
        "'=== filename ===' headers. Only flag what the evidence supports; an empty findings "
        "list is a valid answer for a clean data room.\n"
        "Finally, write `summary`: 2-3 sentences on the overall earnings-quality picture.\n\n"
        "=== DATA ROOM ===\n" + financials_text
    )
    return llm.parse(prompt, RedFlagReport, system=SYSTEM, max_tokens=8000,
                     model=settings.model_reasoning)
