# CLAUDE.md

This file provides repository context for coding agents working in this project.

## Project Overview

Automatic Agent Platform is a multi-layered task execution platform with a five-plane `platform/` runtime core and upper-layer business capability domains. The authoritative design source is `docs_zh/automatic_agent_patform_arthitecture_design.md`.

## Build & Test Commands

```bash
npm run build
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:golden
```

Single-test flow:

```bash
npm run build && node --test dist/tests/unit/platform/execution/execution-engine/index.test.js
```

## Runtime Structure

```text
src/platform/
  interface/       # API, channel gateway, ingress, scheduler, console/webhook surfaces
  control-plane/   # IAM, config-center, approval-center, incident control, rollout
  orchestration/   # OAPEFLIR, routing, planner, HITL
  execution/       # dispatcher, execution-engine, recovery, worker-pool, queue, locks
  state-evidence/  # truth, events, checkpoints, artifacts, knowledge, memory
```

Upper layers:

- `src/domains/` — domain descriptor, onboarding, registry, prompt/eval governance
- `src/interaction/` — NL entry, goal decomposition, proactive agent, dashboard, UX
- `src/org-governance/` — org hierarchy, routing, compliance, SSO/SCIM, knowledge boundary
- `src/scale-ecosystem/` — multi-region, fair scheduling, SLA, connectors, marketplace
- `src/ops-maturity/` — explainability, panic/resume, edge, drift, cost, workflow debugger

## Execution Model

- `Task` — user-level work unit with terminal lifecycle
- `Workflow` — multi-step execution plan attached to a task
- `Execution` — individual runtime attempt with approval, sandbox, and retry state
- `TransitionService` — authoritative status transition gate in `src/platform/execution/state-transition/transition-service.ts`
- `runMultiStepOrchestration` — canonical multi-step orchestrator in `src/platform/execution/execution-engine/multi-step-orchestration.ts`

## Storage & Evidence

- Authoritative storage lives under `src/platform/state-evidence/truth/`
- Durable events live under `src/platform/state-evidence/events/`
- Workflow checkpoints and artifacts live under `src/platform/state-evidence/checkpoints/` and `src/platform/state-evidence/artifacts/`

## Important Notes

- `src/core/runtime/` is compatibility-only; do not add new canonical runtime logic there.
- All imports use ESM `.js` extensions.
- If you change an architectural boundary, update ADR / contract / tests together.
