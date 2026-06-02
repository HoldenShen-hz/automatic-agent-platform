# P0 Pilot Evidence Access Guide

This guide corresponds to the three P0 main lines:

- `coding`
- `knowledge-base`
- `customer-service`

The goal is not to fabricate "real pilot results", but to collect real sample inputs into a unified evidence package, used for:

- `real pilot`
- `real eval`
- `real red-team`
- `real ROI`
- `real external benchmark matchups`

## Initialization

First, generate the input template directory:

```bash
npm run pilot:evidence:p0:init
```

This will generate:

- `data/pilot-evidence-inputs/coding/`
- `data/pilot-evidence-inputs/knowledge-base/`
- `data/pilot-evidence-inputs/customer-service/`

Each directory fixedly contains:

- `eval-cases.json`
- `redteam-results.json`
- `roi-samples.json`
- `benchmark-results.json`
- `pilot-observations.json`
- `README.json`

## Running

Run all P0 together:

```bash
npm run pilot:evidence:p0
```

Run only a single division:

```bash
npm run pilot:evidence:p0 -- --division=coding
```

## Output

Results will be written to:

- `artifacts/validation/p0-pilot-evidence/`

Which includes:

- `evidence-package.json` for each division
- `summary.md` for each division
- Aggregated `p0-pilot-evidence-report.json`
- Aggregated `p0-pilot-evidence-summary.md`

## Validation rules

The runner now strictly validates inputs and no longer accepts implicit type conversions. Common failures include:

- Boolean fields written as strings
- benchmark `metricId` not in the family mapping
- Missing required input files
- Missing fields in observation / ROI / red-team entries

When real inputs are missing, it will directly report:

- `pilot_evidence.input_missing:<path>`

Field type errors will directly report:

- `pilot_evidence.invalid_*:<fieldPath>`

## Current boundaries

What this chain has already completed is:

- Unified input contract
- Unified aggregation logic
- Readiness threshold judgment
- Evidence package persistence

What still needs to be provided by real operations is the real samples themselves for each division, not more placeholder code.
