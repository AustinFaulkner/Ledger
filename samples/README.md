# Sample data rooms

Two ready-to-analyze data rooms built from **real, public SEC filings**, so the
analyzer can be demonstrated end-to-end without confidential client data. Both
targets are publicly traded cybersecurity-SaaS companies — high growth, strong
gross margins, GAAP losses driven mostly by stock-based compensation, which is
exactly what a Quality-of-Earnings review is built to surface.

| Folder | Target | Source filings |
|---|---|---|
| `crowdstrike/` | CrowdStrike Holdings, Inc. (Nasdaq: CRWD) | FY2026 Form 10-K (FYE 2026-01-31) + XBRL facts |
| `zscaler/` | Zscaler, Inc. (Nasdaq: ZS) | FY2025 Form 10-K (FYE 2025-07-31) + XBRL facts |

Each folder contains four fiscal years of as-reported income statement, balance
sheet, and cash-flow CSVs (pulled from SEC's XBRL companyfacts API, annual 10-K
values in USD), an adjusted-EBITDA bridge with the standard SaaS add-backs, and
the 10-K's business description, risk factors, and MD&A text for cited Q&A and
red-flag detection. CrowdStrike additionally carries the full
diligence-category set — revenue detail and retention, contracts and legal,
debt schedule, tax provision, and HR/headcount — so it scores 100% on the app's
data-room readiness checklist. Each room is also provided as a `.zip` for the
dashboard's zip-upload path.

## How to use

Desktop app or dashboard: create a deal, upload a company folder (or its
`.zip`), and run Quality of Earnings, Working Capital, and Red Flags.

```bash
qoe qoe samples/crowdstrike            # Quality-of-Earnings pass
qoe ask "What are the main risk factors?" --path samples/crowdstrike
```

## Provenance

All data is public and unmodified, from U.S. SEC EDGAR
(<https://www.sec.gov/cgi-bin/browse-edgar>):

- CrowdStrike (CIK 0001535527): accession 0001535527-26-000010 (FY2026 10-K).
- Zscaler (CIK 0001713683): accession 0001713683-25-000158 (FY2025 10-K).
- Financial CSVs derived from the XBRL companyfacts API
  (`https://data.sec.gov/api/xbrl/companyfacts/CIK<cik>.json`), annual 10-K
  values only.

The add-back classifications in the EBITDA bridge are illustrative for the
demo. These are real companies included purely to demonstrate the tool;
nothing here is investment advice or a recommendation.
