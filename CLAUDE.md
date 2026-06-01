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
