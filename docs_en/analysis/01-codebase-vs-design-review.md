# Codebase vs Architecture Design Review Report

> Review Date: 2026-04-20
>
> Review Baseline:
>
> - `docs_zh/architecture/00-platform-architecture.md`
> - `docs_zh/architecture/01-code-structure.md`
> - `docs_zh/architecture/02-code-architecture-reference.md`
> - `docs_zh/analysis/00-architecture-coverage-matrix.md`

## 1. Conclusions

The current codebase no longer matches the old conclusion that "Layer 3-7 are largely skeletons, §5 contracts are all unimplemented, `src/core/` still carries real runtime implementation".

The more accurate current judgment is:

- The seven-layer directory structure is stably in place, and the upper five capability domains have all formed the main closed loop of ADR -> contract -> src -> tests.
- `docs_zh/analysis/00-architecture-coverage-matrix.md` has become the authoritative coverage entry point; most v2.7 chapter states are `exists`, with the remaining gaps mainly in `partial`, not `missing` or `skeleton`.
- `src/core/runtime/` has converged to a compatibility shim; the canonical multi-step orchestration implementation is located in `src/platform/five-plane-execution/execution-engine/`.

## 2. Convergence Items Confirmed This Round

### 2.1 Architecture and Document Closed Loop

- ADR has continuously expanded to `090`
- v2.7 authoritative contracts have been completed by capability domain
- Coverage matrix has established full mapping of `architecture chapter -> ADR -> contract -> src -> tests`

### 2.2 Code Structure Organization

The following organization items have been completed in the current codebase:

- `src/platform/five-plane-execution/execution-engine/` has completed directory-level `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` five secondary directories
- `src/scale-ecosystem/*` five secondary directories
- `src/ops-maturity/*` ten secondary directories
- `src/sdk/cli/index.ts`
- `src/platform/five-plane-interface/ingress/index.ts` has correctly exported two rate limiter modules

### 2.3 `core/runtime` Convergence Status

The current positioning of `src/core/runtime/` has changed from "remaining real implementation" to "compatibility re-export layer":

- `orchestrator/index.ts` → re-export `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` → re-export `multi-step-orchestration-types.ts`
- `planner/index.ts` → re-export agent round loop / tool definitions / utils
- `supervisor/index.ts` → re-export `multi-step-supervisor.ts`

At the same time, there are no remaining path remnants in `src/platform/` and `tests/` that directly import `core/runtime/*`.

## 3. Current Status Should Be Based on Coverage Matrix

Please use [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md) as the current status entry point. According to that matrix, the following chapters have formed `exists` closed loop:

- `§37-§44` except for `§44` upper domain / interaction chapters
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. Current Real Gaps

Current real gaps are no longer "extensive missing", but the following `partial` chapters still have room for deepening:

- `§6-§8`
  - API resource granularity, communication topology, extended ecosystem operation chapter-level coverage is still light
- `§16-§17`
  - Platform-level prompt release orchestration and dataset / judge gate have been completed; remaining gaps mainly in staged canary, judge marketplace, and more complete online monitoring ecosystem
- `§20-§23`
  - Long-running workflow, HITL notification and takeover UI, SDK workbench still have product layer gaps; compliance has completed cross-region export and deletion request orchestration, but regulatory topic package is still not thick enough
- `§29`
  - The orchestration of learning signals -> validated learning objects -> knowledge/evolution memory has been completed, but the deeper governance chain of Learn -> Improve -> Approval -> Rollout still needs further consolidation
- `§30`
  - Pack/plugin compatibility list, license tier judgment, builtin plugin coverage, and pack development -> testing -> certification -> publish -> deprecate lifecycle have been completed; deeper linkage of registry/marketplace can continue to be enhanced
- `§27-§32`
  - Environment readiness / SLO / resource pool / failover drill orchestration, and event/projection/DLQ inventory have been completed; remaining gaps mainly in benchmark inventory, coordinator-level recovery details, deployment resource accounting thickness, and complete projection inventory
- `§33`, `§36`
  - Essentially governance / success criteria chapters, naturally dominated by documents and contracts
- `§44`
  - UX orchestration has been implemented, but UI product details and WCAG and other non-code specifications are still not fully expanded

## 5. Document Consistency Regression Results

This round has corrected the following outdated path references in old entry documents:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

These entry documents now uniformly point to the current seven-layer structure instead of the old `src/core/` / `src/cli/` / `src/gateway/`形态.

## 6. Follow-up Recommendations

If continuing to advance, the priority should be:

1. Continue to compress `partial` chapters according to the coverage matrix, rather than repeating directory reorganization.
2. Batch supplement more real business flows and thematic tests for `§6-§8`, `§20-§23`, `§27-§32`.
3. After external consumers are completely migrated, evaluate whether to delete `src/core/runtime/` shim layer.
