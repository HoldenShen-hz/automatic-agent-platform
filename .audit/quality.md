# Test Quality Report

**Date:** 2026-05-17
**Scope:** targeted review remediation evidence plus current full-suite verification
**Full-suite status:** `npm test` passed on 2026-05-17 (log: `/private/tmp/aa-full-test-current.log`)

This file is no longer an authoritative stale failure ledger. The previous
2026-05-13 snapshot listed 58,382 total tests, 56,762 passed tests, 1,620 failed
tests, and 14 failing files; that snapshot remains historical context only.
A fresh full-suite run has now been performed on 2026-05-17 and supersedes that
stale snapshot for current status.

## Current Evidence Policy

- Do not use stale full-suite counts to justify issue closure.
- Use current command outputs recorded here and in
  `docs_zh/reviews/issues-table.md` for review remediation evidence.
- Treat the 2026-05-13 failure snapshot as archival context only.

## Targeted Evidence Referenced By The Review Table

| Evidence Area | Command | Current Result |
|---|---|---|
| CI supply chain | `node scripts/ci/audit-ci-supply-chain.mjs` | `ci supply-chain audit passed: 26/26` |
| Document structure | `node scripts/ci/audit-document-structure.mjs` | `document structure audit passed: 48/48` |
| Review guardrails | `node scripts/ci/audit-review-guardrails.mjs` | `review guardrail audit passed: 46/46` |
| Domain configs | `node scripts/ci/audit-domain-configs.mjs` | `domain config audit passed: 346/346` |
| Root dependency audit | `npm audit --audit-level=low` | `found 0 vulnerabilities` |
| Build | `npm run build` | `passed` |
| CLI regression | `./node_modules/.bin/tsx --test tests/integration/sdk/cli/ops-governance-cli.test.ts tests/integration/sdk/cli/ops-cli.test.ts` | `59/59 passed` |
| Full suite | `npm test > /private/tmp/aa-full-test-current.log 2>&1` | `passed (exit code 0)` |

## Historical Failure Snapshot

The following historical files were listed in the stale 2026-05-13 full-suite
snapshot. They remain historical context only and are not treated as current
failure evidence in this file:

- `tests/unit/platform/execution/dispatcher/execution-dispatch-service-async.test.ts`
- `tests/unit/platform/execution/execution-engine/nodeRunId-canonization.test.ts`
- `tests/unit/platform/execution/oapeflir/runtime-plan-executor.test.ts`
- `tests/unit/platform/execution/worker-pool/worker-pool-comprehensive.test.ts`
- `tests/unit/platform/five-plane-control-plane/iam/access-model.test.ts`
- `tests/unit/platform/five-plane-control-plane/iam/field-encryption.test.ts`
- `tests/unit/platform/five-plane-execution/budget-allocator.test.ts`
- `tests/unit/platform/five-plane-execution/tool-executor/web-fetch.test.ts`
- `tests/unit/platform/five-plane-execution/worker-drain-protocol.test.ts`
- `tests/unit/platform/five-plane-orchestration/planner/r20-05-parallelism-limit.test.ts`
- `tests/unit/platform/five-plane-state-evidence/checkpoints/node-run-checkpoint-migration.test.ts`
- `tests/unit/platform/interface/channel-gateway/channel-gateway-service-coverage.test.ts`
- `tests/unit/platform/orchestration/oapeflir/execution-adapter.test.ts`
- `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts`
