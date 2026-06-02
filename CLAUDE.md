# CLAUDE.md

This file provides repository context for coding agents working in this project.

## Project Overview

Automatic Agent Platform is a multi-layered task execution platform with a five-plane `platform/` runtime core and upper-layer business capability domains. The authoritative design source is `docs_zh/architecture/00-platform-architecture.md`; repository guide precedence is indexed in `docs_zh/governance/repository-guide-index.md`, `docs_zh/governance/source_of_truth.md`, and `docs_zh/governance/naming_and_directory_conventions.md`.
Release baseline references live at `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md` and `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md`.

## Build & Test Commands

```bash
npm run build
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:golden
```

`npm run test:golden` validates targeted contract snapshots. A single golden test file can own multiple `.golden` fixtures, and the repo hygiene gate audits that every referenced snapshot exists.

Single-test flow:

```bash
npm run build && ./node_modules/.bin/tsx --test tests/unit/platform/execution/execution-engine/index.test.ts
```

## Assurance Pipeline

This project runs an **Assurance Pipeline** that turns `docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md` into continuously-running audits. The full design is in `docs_zh/contracts/assurance-pipeline-contract.md`; canonical JSON Schemas live under `schemas/`.

| Layer | npm script | Output |
|---|---|---|
| 1. Source inventory | `assurance:inventory` | `artifacts/assurance/{source-inventory,routes,contracts,events,tests,docs-index,config-index,workflows-index}.json` |
| 2. Historical promises | `assurance:historical-promises` (alias: `audit:historical-promises`) | `artifacts/assurance/historical-promises.jsonl` + drift report |
| 3. Static audit (24 scanners) | `audit:fire-and-forget`, `audit:determinism`, `audit:tenant-isolation`, `audit:secret-sinks`, `audit:release-claims`, `audit:architecture-boundary`, `audit:path-safety`, `audit:eval-oracle`, `audit:plugin-security`, `audit:ui-token-storage`, `audit:contracts-sync`, `audit:idempotency`, `audit:queue`, `audit:lease-fencing`, `audit:side-effect-receipt`, `audit:recovery-replay`, `audit:audit-chain`, `audit:receipt-verification`, `audit:event-outbox`, `audit:docs-sot`, `audit:auth-role-mapping`, `audit:execution-invariants`, `audit:test-disabled`, `audit:ci-supply-chain` | per-scanner JSON findings |
| 4. Dynamic invariants | `test:invariants`, `test:regression:p0`, `test:chaos:p0` | test reports |
| 5. Eval / Redteam / Golden anti-fake | `audit:eval-oracle`, `test:redteam:p0` (under `tests/redteam/p0/`), `tests/eval/oracle-anti-fake.test.ts` + `dataset-card-integrity.test.ts`, `test:golden:strict` | anti-fake reports |
| 6. Issue Ledger | `assurance:issue-ledger` | `artifacts/assurance/issues.{raw,normalized,deduped}.jsonl` + `docs_zh/quality/issue-ledger/automatic-agent-system-issues.md` |
| 7. Coverage Scorecard | `assurance:coverage-scorecard` | `artifacts/assurance/audit-coverage-scorecard.{json,md}` |
| 7b. Assumption Ledger | `assurance:assumptions` | `artifacts/assurance/assumptions.jsonl` + `assumptions-summary.md` (§27.2) |
| 8. Evidence Bundle | `evidence:bundle:create`, `evidence:bundle:verify` | `artifacts/release/evidence-bundle.{json,sig}` |
| 8b. Release P0 suite | `tests/release/rc-check-smoke.test.ts` + `tests/release/release-claim-evidence.test.ts` | smoke + claim-evidence gates |

Top-level entry points:

```bash
npm run assurance:full      # Nightly: aggregates all required + observe-mode audits
npm run assurance:delta     # PR: only audits files changed since origin/main
npm run rc:check            # Release: assurance:full + tests + evidence bundle verify
npm run assurance:seeded-defects  # Run all P0 seeded-defect gates
npm run test:audit-tools    # Self-tests for audit scripts
```

Each `audit:*` script supports `--check` to exit non-zero on P0/P1 findings, suitable for CI enforcement. Each layer-1/2/3/6/7 script also has a corresponding schema under `schemas/`.

## Dataflow & Threat Model

10 core dataflows are documented in `docs_zh/threat-models/`:

1. User Request → Auth → Tenant Guard → Route → Service → Repository
2. Task Intake → Planner → Execution → Tool → SideEffect → Receipt
3. Observation → Feedback → Learning → Knowledge Promotion → Memory
4. Eval Dataset → Runner → Judge → Report → Release Gate
5. Plugin Manifest → Signature → SBOM → Registry → Execution
6. Secret Provider → Runtime Config → Logger/Event/Span sinks
7. WebSocket Subscribe → Broadcast → Client Cache
8. Backup/Restore → File System → Remote URI → Retention
9. Mission Resolve → Mission Guard → NodeRun → Runtime Transition
10. YONO Market → Forecast → Order → Settlement → Reputation

Each file annotates trust/tenant/secret/side-effect/evidence boundaries, threats, and the audit gates that protect the boundary. See `docs_zh/threat-models/README.md` for the coverage matrix.

## Audit Tool Self-Tests

Every P0 audit gate MUST have:

- a **positive seed** under `tests/fixtures/seeded-defects/<category>/positive.*` that the gate catches;
- a **negative seed** under `…/negative.*` that the gate does NOT catch;
- an **evasion seed** under `…/evasion.*` that the gate still catches after obfuscation;
- a manifest at `tests/fixtures/seeded-defects/<category>/manifest.json` matching `schemas/seeded-defect.schema.json`.

`tests/audit-tools/` contains the self-test files that run the gates against the seeds. `npm run assurance:seeded-defects` iterates all categories and fails the build on any miss.

## Runtime Structure

```text
src/platform/
  five-plane-interface/       # API, channel gateway, ingress, scheduler, console/webhook surfaces
  five-plane-control-plane/   # IAM, config-center, approval-center, incident control, rollout
  five-plane-orchestration/   # OAPEFLIR, routing, planner, HITL
  five-plane-execution/       # dispatcher, execution-engine, recovery, worker-pool, queue, locks
  five-plane-state-evidence/  # truth, events, checkpoints, artifacts, knowledge, memory
```

Upper layers:

- `src/domains/` — domain descriptor, onboarding, registry, prompt/eval governance
- `src/interaction/` — NL entry, goal decomposition, proactive agent, dashboard, UX
- `src/org-governance/` — org hierarchy, routing, compliance, SSO/SCIM, knowledge boundary
- `src/scale-ecosystem/` — multi-region, fair scheduling, SLA, connectors, marketplace
- `src/ops-maturity/` — explainability, panic/resume, edge, drift, cost, workflow debugger
- `src/runtime/agent-runtime/` and `src/core/runtime/` — runtime-boundary / compatibility surfaces; prefer canonical changes in five-plane modules unless the boundary itself is the subject

## Execution Model

- `Task` — user-level work unit with terminal lifecycle
- `Workflow` — multi-step execution plan attached to a task
- `Execution` — individual runtime attempt with approval, sandbox, and retry state
- `TransitionService` — authoritative status transition gate in `src/platform/five-plane-execution/state-transition/transition-service.ts`
- `runMultiStepOrchestration` — canonical multi-step orchestrator in `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`

## Storage & Evidence

- Authoritative storage lives under `src/platform/five-plane-state-evidence/truth/`
- Durable events live under `src/platform/five-plane-state-evidence/events/`
- Workflow checkpoints, artifacts, knowledge, and memory live under `src/platform/five-plane-state-evidence/`

## Important Notes

- `src/core/runtime/` is compatibility-only; do not add new canonical runtime logic there.
- `src/testing/` is the shared testing support surface; production code should not depend on it.
- All imports use ESM `.js` extensions.
- If you change an architectural boundary, update ADR / contract / tests together.
- Adding a new `audit:*` gate requires (a) a script under `scripts/ci/`, (b) at least one positive/negative/evasion seed under `tests/fixtures/seeded-defects/`, (c) a self-test under `tests/audit-tools/`, and (d) registration in `package.json` with both `--check` and observe-mode entries.
