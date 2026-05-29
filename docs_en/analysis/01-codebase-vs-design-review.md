# Codebase vs Architecture Design Review Report

> Review Date: 2026-04-20
>
> Review Baseline:
>
> - `docs_zh/architecture/00-platform-architecture.md`
> - `docs_zh/architecture/01-code-structure.md`
> - `docs_zh/architecture/02-code-architecture-reference.md`
> - `docs_zh/analysis/00-architecture-coverage-matrix.md`

## 1. Conclusion

The current codebase no longer matches the old conclusions such as "Layers 3-7 are mostly skeletons, Section 5 contracts are entirely unimplemented, and `src/core/` still carries the real runtime implementation."

A more accurate current assessment is:

- The seven-layer directory structure is now stable, and all five upper-layer capability domains have formed the main closed loop: ADR -> contract -> src -> tests.
- `docs_zh/analysis/00-architecture-coverage-matrix.md` has become the authoritative coverage entry point; most v2.7 chapter statuses are `exists`, with the remaining gaps primarily in `partial` rather than `missing` or `skeleton`.
- `src/core/runtime/` has converged to a compatibility shim; the canonical multi-step orchestration implementation is located in `src/platform/five-plane-execution/execution-engine/`.

## 2. Convergence Items Confirmed in This Round

### 2.1 Architecture and Documentation Closed Loop

- ADR has been continuously extended to `090`
- v2.7 authoritative contracts have been supplemented by capability domain
- Coverage matrix has established full mapping: `architecture chapter -> ADR -> contract -> src -> tests`

### 2.2 Code Structure Cleanup

The following reorganization items have been completed in the current codebase:

- `src/platform/five-plane-execution/execution-engine/` has added directory-level `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` five subdirectories
- `src/scale-ecosystem/*` five subdirectories
- `src/ops-maturity/*` ten subdirectories
- `src/sdk/cli/index.ts`
- `src/platform/five-plane-interface/ingress/index.ts` now correctly exports two rate limiter modules

### 2.3 `core/runtime` Convergence Status

The positioning of `src/core/runtime/` has shifted from "remaining real implementation" to "compatibility re-export layer":

- `orchestrator/index.ts` → re-exports `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` → re-exports `multi-step-orchestration-types.ts`
- `planner/index.ts` → re-exports agent round loop / tool definitions / utils
- `supervisor/index.ts` → re-exports `multi-step-supervisor.ts`

Additionally, there are no remaining paths in `src/platform/` or `tests/` that directly import from `core/runtime/*`.

## 3. Current Status Should Be Based on the Coverage Matrix

Use [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md) as the entry point for current status. According to this matrix, the following chapters have formed an `exists` closed loop:

- `§37-§44` except `§44` - upper-layer domain / interaction chapters
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. Current Real Gaps

The current real gaps are no longer "extensive missing items," but rather the following `partial` chapters still have room for further deepening:

- `§6-§8`
  - API resource granularity, communication topology, and extension ecosystem runtime chapter-level coverage are still light
- `§16-§17`
  - Platform-level prompt release orchestration and dataset / judge gate have been supplemented; the remaining gaps are primarily staged canary, judge marketplace, and more complete online monitoring ecosystem
- `§20-§23`
  - Long-running workflow, HITL notification and takeover UI, and SDK workbench still have product-layer gaps; compliance has supplemented cross-region export and deletion request orchestration, but the regulatory topic package is still not thorough enough
- `§29`
  - The orchestration from learning signals -> validated learning objects -> knowledge/evolution memory has been completed, but the deeper governance chain of Learn -> Improve -> Approval -> Rollout still needs further consolidation
- `§30`
  - Pack/plugin compatibility list, license tier determination, builtin plugin coverage, and pack development -> testing -> certification -> publish -> deprecate lifecycle have been completed, but the deeper integration of registry/marketplace can continue to be enhanced
- `§27-§32`
  - Environment readiness / SLO / resource pool / failover drill orchestration and event/projection/DLQ inventory have been supplemented; the remaining gaps are primarily benchmark inventory, coordinator-level recovery details, deployment resource account depth, and complete projection inventory
- `§33`, `§36`
  - These are essentially governance / success criteria chapters, naturally document and contract-focused
- `§44`
  - UX orchestration has been implemented, but UI product details and non-code standards such as WCAG are still not fully expanded

## 5. Documentation Consistency Regression Results

This round has corrected outdated path references in the following entry documents:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

These entry documents now uniformly point to the current seven-layer structure instead of the old `src/core/` / `src/cli/` / `src/gateway/` layout.

## 6. Follow-up Recommendations

If continuing to advance, the priority should be:

1. Continue to compress `partial` chapters according to the coverage matrix, rather than repeating directory reorganization.
2. For `§6-§8`, `§20-§23`, `§27-§32`, supplement more real business flows and topic tests in batches.
3. After external consumers have completely migrated, evaluate whether to delete the `src/core/runtime/` shim layer.