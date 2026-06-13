# Sample data rooms

Two ready-to-analyze data rooms built from **real, public SEC filings**, so you can
demonstrate the analyzer end-to-end without confidential client data. Both targets are
publicly traded cybersecurity-SaaS companies — a useful comparison: high growth, strong
gross margins, GAAP losses driven almost entirely by stock-based compensation (exactly the
kind of normalization a Quality-of-Earnings review surfaces).

| Folder | Target | Source filings |
|---|---|---|
| `crowdstrike/` | CrowdStrike Holdings, Inc. (Nasdaq: CRWD) | FY2026 Form 10-K (FYE 2026‑01‑31) + XBRL facts |
| `zscaler/` | Zscaler, Inc. (Nasdaq: ZS) | FY2025 Form 10-K (FYE 2025‑07‑31) + XBRL facts |

## What's in each folder

Core financials (both companies):

- `Income_Statement.csv`, `Balance_Sheet.csv`, `Cash_Flow_Statement.csv` — four fiscal
  years of as-reported figures, pulled from SEC's XBRL **companyfacts** API (annual 10-K
  values, in USD). These drive the EBITDA bridge, working-capital, profiling, and databook.
- `Adjusted_EBITDA_Bridge_and_Add-backs.csv` — a normalized-EBITDA bridge: reported
  operating income → +D&A +intangible amortization = EBITDA → +stock-based comp
  +restructuring = Adjusted EBITDA, with margins. Add-backs are the standard SaaS QoE
  normalizations; classifications are illustrative for the demo.
- `*_10-K_Narrative.txt` — business description, risk factors, and MD&A prose extracted
  verbatim from the official 10-K, for cited Q&A, red-flag detection, and readiness scoring.

CrowdStrike also includes the full diligence-category set (named to match the app's
auto-categorization + readiness checklist):

- `Revenue_Detail_and_Customer_Retention.csv` — revenue, deferred revenue, RPO, deferred
  commissions; net retention, revenue mix, and concentration notes.
- `Customer_Contracts_and_Legal_Summary.csv` — contract terms, RPO, leases, debt indenture,
  credit agreement, and litigation summary.
- `Debt_Schedule_and_Credit_Agreement.csv` — Senior Notes ($750M, 3.00%, due 2029), interest,
  lease liabilities, and credit-facility status.
- `Tax_Provision_and_Deferred_Tax.csv` — income-tax provision, effective rate, deferred tax
  assets, NOL and R&D-credit carryforwards, valuation allowance.
- `Org_Chart_Headcount_and_HR.csv` — headcount (10,698), stock-based comp, and HR notes.

- `*.zip` — the same files zipped, for the dashboard's "drop in a `.zip`" upload.

With these, CrowdStrike scores **100% data-room readiness** (every required and optional
checklist category covered); Zscaler covers the required set plus MD&A.

## How to use

**Desktop app / dashboard:** create a deal, then upload a company folder (or its `.zip`),
and run Quality of Earnings, Working Capital, and Red Flags.

**CLI:**

```bash
qoe qoe samples/crowdstrike            # Quality-of-Earnings pass over the financials
qoe ask "What are the main risk factors?" --path samples/crowdstrike
```

## Provenance

All data is public and unmodified. Primary source: U.S. SEC EDGAR
(<https://www.sec.gov/cgi-bin/browse-edgar>).

- CrowdStrike (CIK 0001535527): accession 0001535527-26-000010 (FY2026 10-K).
- Zscaler (CIK 0001713683): accession 0001713683-25-000158 (FY2025 10-K).
- Financial CSVs derived from the XBRL companyfacts API
  (`https://data.sec.gov/api/xbrl/companyfacts/CIK<cik>.json`); annual 10-K values only.

These are real public companies included purely to demonstrate the tool. Nothing here is
investment advice or a recommendation.
