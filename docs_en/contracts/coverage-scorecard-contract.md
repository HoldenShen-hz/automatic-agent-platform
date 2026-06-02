# Audit Coverage Scorecard Contract

> Version: v1.0  
> Status: Required by `assurance:coverage-scorecard` and `rc:check`  
> Companion schema: `schemas/coverage-scorecard.schema.json`  
> Related documents: methodology §30, §35

## 1. Purpose

The Coverage Scorecard quantifies the coverage of "each P0 problem domain" across six dimensions, avoiding the illusion of "running many scripts but P0 domains not covered."

The scorecard is **not** a sufficient condition for release; it is used to expose blind spots and provide a unified entry point for P0 blockers.

## 2. Ten Dimensions

| Dimension | Meaning | Calculation |
|---|---|---|
| `sourceInventory` | Whether src/ tests/ docs/ scripts/ config/ are fully included in the inventory | inventory file count / repo git tracked file count |
| `historicalPromise` | Whether must/done/final in reference/release/ADR are extracted | extracted promise count / promise count from doc grep hits |
| `contractSync` | Whether contract docs / TS type / Zod / JSON schema / runtime are N-way reconciled | contracts passing reconciliation / total P0 contracts |
| `securityAudit` | Whether tenant/secret/plugin/SSRF are covered by audit + regression seed | P0 audits hitting seed / P0 audit dimension count |
| `executionInvariant` | Whether queue/idempotency/lease/side-effect are in tests/invariants | existing P0 invariant test count / P0 invariant list |
| `evalOracle` | Whether expected-as-actual / judge read-self-score / dataset without samples are caught by audit | counterexamples passing eval-oracle-auditor / forbidden pattern count listed in doc §12.1 |
| `ciGate` | Whether P0 audits are in `ci:baseline` or `rc:check` | P0 audits taken over / P0 audit count |
| `regressionSeed` | Whether historical P0 issues are mapped to regression tests | mapped issueId count / P0 count in issue ledger |
| `releaseClaim` | Whether final/production-ready/industry-leading claims carry evidenceRef | claims with evidenceRef / total claim count |
| `auditToolSelfTest` | Whether each audit script has positive/negative/evasion seeds | audits with 3 seed types / total audit count |

Each dimension returns `{status, score, threshold, details, evidenceRefs?}`; see `coverage-scorecard.schema.json` for the full schema.

## 3. status Rules

```text
score >= threshold            -> pass
threshold * 0.7 <= score < threshold  -> warn
score < threshold * 0.7        -> fail
```

`overallStatus` takes the worst value of all dimensions; `releaseBlocked` is true when `overallStatus === fail`.

## 4. P0 Release Minimum Requirements

```text
sourceInventory.score      >= 1.0
historicalPromise.score    >= 0.95
contractSync.score        >= 1.0 (P0 contracts 100%)
securityAudit.score       >= 1.0
executionInvariant.score   >= 1.0 (P0 invariants 100%)
evalOracle.score          >= 1.0
ciGate.score              >= 1.0
regressionSeed.score      >= 1.0 (P0 issues 100%)
releaseClaim.score        >= 1.0
auditToolSelfTest.score   >= 1.0
```

If any dimension's score is below threshold, `rc:check` fails immediately.

## 5. Output

```text
artifacts/assurance/audit-coverage-scorecard.json
artifacts/assurance/audit-coverage-scorecard.md
```

The `md` version is for humans; the `json` version is consumed by `rc:check` to make blocking decisions.
