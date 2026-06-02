"""Benchmark the model's financial reasoning against verified-answer cases.

Each file in ``cases/*.json`` is a scenario with a known answer. We run it through
the configured model and score the structured output against ground truth, then
report accuracy per category. See ``eval/README.md`` for the case format.

Run:  python eval/run_eval.py
"""

from __future__ import annotations

import json
from pathlib import Path

# Importable once the package is installed (`pip install -e .`).
from qoe import llm

CASES_DIR = Path(__file__).parent / "cases"


def _close(got, expected, tol: float = 0.01) -> bool:
    """Numeric closeness with a relative tolerance; falls back to string compare."""
    try:
        a, b = float(got), float(expected)
        return abs(a - b) <= tol * max(1.0, abs(b))
    except (TypeError, ValueError):
        return str(got).strip().lower() == str(expected).strip().lower()


def _safe_json(raw: str) -> dict:
    try:
        return json.loads(llm._extract_json(raw))
    except Exception:
        return {}


def run() -> None:
    cases = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(CASES_DIR.glob("*.json"))]
    if not cases:
        print(f"No cases in {CASES_DIR}. Add JSON cases — see eval/README.md.")
        return

    by_category: dict[str, list[bool]] = {}
    for c in cases:
        expected = c["expected"]
        prompt = c["prompt"] + "\n\nReturn a JSON object with exactly these keys: " + ", ".join(expected)
        got = _safe_json(llm.complete(prompt))
        ok = all(k in got and _close(got[k], v) for k, v in expected.items())
        by_category.setdefault(c.get("category", "uncategorized"), []).append(ok)
        print(f"{'PASS' if ok else 'FAIL'}  {c.get('id', '?'):30s} -> {got}")

    print("\n=== Accuracy by category ===")
    overall: list[bool] = []
    for cat, results in sorted(by_category.items()):
        overall += results
        print(f"{cat:26s} {sum(results) / len(results):6.1%}  ({sum(results)}/{len(results)})")
    print(f"{'OVERALL':26s} {sum(overall) / len(overall):6.1%}  ({sum(overall)}/{len(overall)})")


if __name__ == "__main__":
    run()
