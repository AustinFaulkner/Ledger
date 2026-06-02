"""The standard diligence question set the Matrix view runs across a data room.

Hebbia-style: each question becomes a row, answered with citations over the whole data
room (the frontend runs each via the existing /ask endpoint, filling the grid as answers
return). Centralised here so the checklist is one edit away from being sector-specific.
"""

from __future__ import annotations

MATRIX_TEMPLATE: list[dict] = [
    {
        "category": "Revenue Quality",
        "questions": [
            "What is the revenue trend over the periods shown, and what drove the change?",
            "How much of revenue is recurring versus one-time or project-based?",
        ],
    },
    {
        "category": "Customer Concentration",
        "questions": [
            "What is the customer concentration, and is there single-customer dependency risk?",
        ],
    },
    {
        "category": "Earnings & Add-backs",
        "questions": [
            "What add-backs did management propose, and are they defensible?",
            "What is reported EBITDA versus normalized EBITDA, and what is the gap?",
        ],
    },
    {
        "category": "Margins",
        "questions": [
            "How have gross and EBITDA margins trended, and what explains the movement?",
        ],
    },
    {
        "category": "Working Capital & Cash",
        "questions": [
            "What are the net working capital trends and seasonality?",
            "How well does EBITDA convert to cash, and what debt-like items exist?",
        ],
    },
    {
        "category": "Risks",
        "questions": [
            "What are the most important risks a buyer should diligence further before closing?",
        ],
    },
]
