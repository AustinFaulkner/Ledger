# Evaluation Harness

The hard part of an AI financial tool isn't calling the model — it's **proving the
reasoning is correct.** This harness benchmarks the analyzer against accounting
problems with *known answers*, so accuracy is a number, not a vibe.

## How it works

1. Each case in `cases/` is a JSON file: a scenario prompt + the verified answer
   (taxable income, the journal entry, the normalized figure, etc.).
2. `run_eval.py` feeds each scenario to the model and compares the structured
   output to the ground truth.
3. It reports per-category accuracy (e.g. deferred taxes, lease classification,
   equity roll-forwards) and an overall score.

## Where the cases come from

Intermediate-accounting and tax problem sets with worked solutions are an ideal
source — the solution *is* the label. Convert each problem into a case file:

```json
{
  "id": "deferred-tax-harris-y1",
  "category": "deferred_taxes",
  "prompt": "Harris Inc., first year of operations. Accounting income $1,305,000 ...",
  "expected": { "taxable_income": 1275000, "income_tax_expense": 310500 }
}
```

## Run it

```bash
python eval/run_eval.py
```

Put a real number from this on your resume: *"benchmarked financial-reasoning
accuracy across N verified accounting problems — X% on deferred taxes, lease
classification, and equity roll-forwards."*
