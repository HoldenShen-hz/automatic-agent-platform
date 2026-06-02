# Issue Ledger Contract

> Version: v1.0  
> Status: Required by `assurance:issue-ledger` and `rc:check`  
> Companion schema: `schemas/issue-ledger.schema.json`  
> Related documents: `docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md` §1.5, §20.10, §29

## 1. Scope

This contract specifies the fields, constraints, and generation/consumption rules of **Issue Ledger** records produced by Automatic Agent Platform in the `assurance:full` / `assurance:issue-ledger` / `rc:check` flows.

The Issue Ledger is the only machine-readable carrier for P0/P1 issues. Any problem found by an audit script, review, release claim, or historical promise must be traceable back to an `AAS-ISSUE-…` record.

## 2. Physical Artifacts

| Path | Description |
|---|---|
| `artifacts/assurance/issues.raw.jsonl` | Raw findings, appended in discovery order, no dedup |
| `artifacts/assurance/issues.normalized.jsonl` | One normalized issue per line, matching `issue-ledger.schema.json` |
| `artifacts/assurance/issues.deduped.jsonl` | Ledger after dedup by root cause + invariant |
| `docs_zh/quality/issue-ledger/automatic-agent-system-issues.md` | Human-readable mirror, regenerated weekly by build-issue-ledger |

## 3. Required Fields

| Field | Required | Constraint |
|---|---|---|
| `issueId` | Yes | `^AAS-ISSUE-[0-9]{6,}$` |
| `source` | Yes | `code\|doc\|adr\|release\|test\|ci\|runtime\|manual\|audit` |
| `sourceRef` | Yes | At minimum locate to `path:line` or `doc#anchor` |
| `category` | Yes | Dot-separated, e.g. `security.tenant_isolation` |
| `severity` | Yes | `P0\|P1\|P2\|P3` |
| `description` | Yes | Natural language, no empty strings |
| `invariantViolated` | Yes | Describe the violated invariant. Use `unspecified` when not identifiable |
| `status` | Yes | See §4 |
| `requiredTest` | Yes | At least 1 test type (unit/integration/…) |
| `requiredGate` | Yes | At least 1 `audit:*` or `test:*` gate |
| `owner` | No | Fill `TBD` if missing; must be resolved before release |

## 4. Valid status Values and Transitions

```text
open
  ↓ fix landed + regression test green
in_progress
  ↓ PR merged + evidenceRef present
fixed
  ↓ audit tool self-test passes + independent reviewer sign-off
verified
  ↓ (or take the accepted_risk branch)
accepted_risk          // must have owner + expiry
needs_revalidation     // time window expired, regression failed, or context drifted
closed                 // only enterable after verified
```

## 5. Relationship with review-ledger / historical-promise-ledger

| Source | Identifier | Linked Field |
|---|---|---|
| Review | `AAS-REVIEW-SRC-…` | `linkedReviewIds[]` |
| Historical promise | `AAS-PROMISE-…` | `linkedPromiseIds[]` |
| Audit finding | `audit:<scanner>:<rule>` | `sourceRef` + `requiredGate[0]` |

`build-issue-ledger.mjs` must merge `review-ledger.normalized.jsonl` with `historical-promises.jsonl` to generate normalized issues; any review or promise record without a reverse mapping must report an error.

## 6. Forbidden Close Conditions

An issue entering `closed` state must satisfy all of the following:

```text
status === verified
regression test passes (at least 1 in requiredTest)
audit gate is included in ci:baseline or rc:check
evidenceRef is non-empty
owner is not TBD
At least 1 of linkedPromiseIds / linkedReviewIds is present
```

Closing with `accepted_risk` requires: `owner`, `expiry`, and a compensating control described in `fixStrategy`.

## 7. Reverse Traceability

Every issue must be reversely traceable via the following query:

```bash
rg -n "AAS-ISSUE-000001" src/ tests/ docs_zh/ scripts/ artifacts/ ui/
```

An issue with no `AAS-ISSUE-…` reference found is treated as "no downstream binding" and marked as a P0 regression gap by `coverage-scorecard`.
