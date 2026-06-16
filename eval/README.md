# Accuracy benchmark

A small set of known-answer accounting problems used to sanity-check the model's
financial reasoning. Each case is a self-contained scenario with a verified answer;
`run_eval.py` runs every case through the configured LLM and scores the structured
output against ground truth, reporting accuracy per category.

## Run

```bash
pip install -e .          # makes the `qoe` package importable
python eval/run_eval.py   # uses the provider/model from your .env
```

## Case format

One JSON file per case in `cases/`:

```json
{
  "id": "ebitda-normalization-newco-fy3",
  "category": "ebitda_normalization",
  "prompt": "NewCo reported EBITDA of $8,400,000 ... compute normalized EBITDA.",
  "expected": {
    "normalized_ebitda": 9185000
  }
}
```

- `id` — unique identifier, shown in the results table.
- `category` — groups cases for the per-category accuracy summary.
- `prompt` — the question posed to the model.
- `expected` — one or more answer keys. Numbers are compared with a small relative
  tolerance; everything else is compared as a case-insensitive string. The model is
  asked to return exactly the `expected` keys as a JSON object.

## Current cases

| Category | Tests |
|---|---|
| `ebitda_normalization` | Normalized-EBITDA bridge across add-backs and deductions |
| `deferred_taxes` | Book-to-tax differences, taxable income, tax payable |
| `lease_accounting` | ASC 842 lease liability as the PV of fixed payments |
| `revenue_recognition` | ASC 606 cutoff and non-recurring revenue corrections |
| `working_capital` | Change in operating net working capital between periods |

Add a case by dropping a new JSON file in `cases/` — no code changes needed.
