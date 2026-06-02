# Assurance Pipeline Contract

> Version: v1.0  
> Status: Required by `assurance:full` / `assurance:delta` / `rc:check`  
> Companion schemas: `schemas/assurance-report.schema.json` / `schemas/seeded-defect.schema.json`  
> Related documents: methodology §20, §21, §37, §38, §44

## 1. Scope

This contract defines the **Assurance Pipeline** of Automatic Agent Platform:

```text
Historical issue recovery
  → Full repository inventory
    → Static audit
      → Dynamic invariant tests
        → Contract / Docs / Runtime reconciliation
          → Eval / Redteam anti-fake-pass
            → Issue Ledger merging
              → Release Gate blocking
                → Evidence Bundle signed archiving
```

It covers three execution scenarios:

| Scenario | Entry Script | Trigger Frequency |
|---|---|---|
| PR Delta | `scripts/assurance/run-delta-assurance.mjs` | Every PR |
| Nightly Full | `scripts/assurance/run-full-assurance.mjs` | Every night |
| Release rc:check | `scripts/assurance/rc-check.mjs` | Before release |

## 2. Eight-Layer Pipeline

| Layer | Responsibility | npm Script | Key Artifact |
|---|---|---|---|
| 1 Inventory | Full repository file/contract/event/metric/test/document/config/workflow indexing | `assurance:inventory` | `artifacts/assurance/source-inventory.json`, `routes.json`, `contracts.json`, `events.json`, `metrics.json`, `tests.json` |
| 2 Historical Promises | Extract promises like must/done/final/production-ready | `assurance:historical-promises`, `audit:historical-promises` | `artifacts/assurance/historical-promises.jsonl` |
| 3 Static Audit | contract/secret/tenant/path/import/determinism scanning | `audit:contracts-sync`, `audit:secret-sinks`, `audit:tenant-isolation`, `audit:plugin-security`, `audit:path-safety`, `audit:architecture-boundary`, `audit:fire-and-forget`, `audit:determinism`, `audit:release-claims` | `artifacts/assurance/static-audit-report.json` |
| 4 Dynamic Invariant | invariant/chaos/multi-tenant/replay tests | `test:invariants`, `test:chaos:p0`, `test:regression:p0` | `artifacts/assurance/invariant-test-report.json` |
| 5 Eval/Redteam/Golden Anti-fake | expected-as-actual/judge read-self-score detection | `audit:eval-oracle`, `test:redteam:p0`, `test:golden:strict` | `artifacts/assurance/eval-oracle-report.json` |
| 6 Issue Ledger | Normalization + dedup + epic grouping | `assurance:issue-ledger` | `artifacts/assurance/issues.{raw,normalized,deduped}.jsonl` |
| 7 Coverage Scorecard | 10-dimension scoring, determines release blocked | `assurance:coverage-scorecard` | `artifacts/assurance/audit-coverage-scorecard.{json,md}` |
| 8 Evidence Bundle | Signed archive, verifier signature check | `evidence:bundle:create`, `evidence:bundle:verify` | `artifacts/release/evidence-bundle.json`, `.sig` |

## 3. Differences Across PR / Nightly / Release Scheduling Scenarios

### 3.1 PR Delta

```text
changed code        -> audit:fire-and-forget + audit:determinism (changed paths)
changed tests       -> test:unit + test:invariants (impacted subset)
changed docs        -> audit:docs-sync + audit:leadership-claims
changed config      -> audit:ci-supply-chain
changed routes      -> audit:tenant-isolation (changed paths)
changed schemas     -> audit:contracts-sync (changed paths)
changed workflows   -> audit:ci-supply-chain + audit:leadership-claims
```

PR must be blocked on:

```text
New P0 issue not entered into issue-ledger
New release claim without evidenceRef
New route without tenantId
New fire-and-forget Promise
New process.env in library code
New in-memory truth store without experimental flag
New secret sink
```

### 3.2 Nightly Full

Runs the full pipeline:

```text
npm run assurance:full
```

Outputs to `artifacts/assurance/nightly/YYYY-MM-DD/`.

### 3.3 Release rc:check

```text
npm run rc:check
```

rc:check internally runs in order:

1. `assurance:full`
2. `test:p0` = `test:invariants` + `test:regression:p0`
3. `test:chaos:p0`
4. `test:redteam:p0`
5. `test:golden:strict`
6. `evidence:bundle:create`
7. `evidence:bundle:verify`

## 4. Release Blocker Rules

If any of the following holds, release is blocked:

```text
open P0 issues > 0
contract drift P0 > 0
secret sink P0 > 0
tenant isolation P0 > 0
eval oracle fake pass > 0
release claim unverified > 0
plugin verification fail-open > 0
side-effect receipt missing > 0
unsigned evidence bundle
P0 alert without runbook
P0 audit gate lacks seeded defect test
```

## 5. Evidence Bundle

`artifacts/release/evidence-bundle.json` must contain at least:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "...",
  "commitSha": "...",
  "branch": "main",
  "contractSchemaVersion": "...",
  "eventRegistryHash": "...",
  "configVersion": "...",
  "validationRunId": "...",
  "includedReports": [
    "artifacts/release/rc-check-report.json",
    "artifacts/release/contract-drift-report.json",
    "artifacts/release/security-audit-report.json",
    "artifacts/release/eval-redteam-report.json",
    "artifacts/release/release-claim-report.json",
    "artifacts/assurance/audit-coverage-scorecard.json"
  ]
}
```

`artifacts/release/evidence-bundle.sig` is the HMAC-SHA256 signature of the bundle (key comes from `AA_RELEASE_SIGNING_KEY`).

Verifier failure means `rc:check` failure.

## 6. Seeded Defect Tests

Each P0 audit gate must have at least the following under `tests/fixtures/seeded-defects/<category>/`:

```text
positive.*   Real issue samples (must be caught by the gate)
negative.*   Normal code samples (must not trigger false positives)
evasion.*    Deliberately rewritten samples (must still be caught)
```

The manifest is written to `tests/fixtures/seeded-defects/<category>/manifest.json`, matching `schemas/seeded-defect.schema.json`. `assurance:seeded-defects` must run all manifests, and any gate that fails is treated as failed.

## 7. Boundary Between Tests and Assurance

| Dimension | tests | assurance |
|---|---|---|
| Input | Code execution results | Code / documents / config / CI / historical promises |
| Output | pass/fail | issue/finding/report/gate/evidence |
| When to run | PR + Nightly | Nightly + Release |
| Can block release | Depends on ci:baseline | Yes |

`tests/` provides the "implementation runs" evidence, `assurance/` provides the "project is trustworthy" evidence; both roll up into `rc:check`.
