# Historical Promise Ledger Contract

> Version: v1.0  
> Paired schema: `schemas/historical-promise-ledger.schema.json`  
> Entry point: `npm run assurance:historical-promises`

## 1. Goal

Recover historical `must / should / done / final / production-ready / industry-leading` statements into a machine-readable ledger so release claims do not exist only as prose.

## 2. Outputs

`scripts/assurance/collect-historical-promises.mjs` must generate:

```text
artifacts/assurance/historical-promises.jsonl
artifacts/assurance/historical-promise-drift-report.json
artifacts/assurance/historical-promise-drift-report.md
```

Each line in `historical-promises.jsonl` must satisfy `schemas/historical-promise-ledger.schema.json`.

## 3. Minimum Fields

Each promise record must include at least:

```text
promiseId
sourceFile
sourceSection
promiseText
promiseType
status
claimStrength
owner
evidenceRefs
expiry
```

## 4. Fail-closed Rules

A promise cannot be treated as release-ready evidence when any of the following is true:

```text
strong claim has no evidenceRefs
claim status cannot be mapped to a supported enum
sourceFile/sourceSection is not traceable
expiry has elapsed
final/production-ready/industry-leading claim still has open drift
```

## 5. Release Gate Consumption

`rc:check` must consume historical promise drift results. At minimum, the following must appear as release blockers or observe-mode blockers in `artifacts/release/rc-check-report.json`:

```text
release claim unverified
strong claim without evidence bundle
expired claim still marked done/final
```
