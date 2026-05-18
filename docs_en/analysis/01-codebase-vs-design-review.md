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

The current codebase no longer conforms to old conclusions such as "Layers 3-7 largely are skeleton, §5 contracts all unimplemented, `src/core/` still carries real runtime implementation".

Current more accurate judgment:

- Seven-layer directory structure has stabilized, and the upper five capability domains have all formed ADR -> contract -> src -> tests main closed loop.
- `docs_zh/analysis/00-architecture-coverage-matrix.md` has become the authoritative coverage entry; most v2.7 chapter statuses are `exists`, with remaining gaps mainly in `partial`, not `missing` or `skeleton`.
- `src/core/runtime/` has converged to a compatibility shim; canonical multi-step orchestration implementation resides in `src/platform/five-plane-execution/execution-engine/`.

## 2. This Round Confirmed Completed Convergence

### 2.1 Architecture and Documentation Closed Loop

- ADR has continuously extended to `090`
- v2.7 authoritative contracts have been supplemented by capability domain
- Coverage matrix has established full mapping of `architecture chapter -> ADR -> contract -> src -> tests`

### 2.2 Code Structure Consolidation

The following consolidation items have been completed in the current codebase:

- `src/platform/five-plane-execution/execution-engine/` has supplemented directory-level `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` five secondary directories
- `src/scale-ecosystem/*` five secondary directories
- `src/ops-maturity/*` ten secondary directories
- `src/sdk/cli/index.ts`
- `src/platform/five-plane-interface/ingress/index.ts` correctly exports two rate limiter modules

### 2.3 `core/runtime` Convergence Status

Current positioning of `src/core/runtime/` has changed from "remaining real implementation" to "compatibility re-export layer":

- `orchestrator/index.ts` -> re-export `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` -> re-export `multi-step-orchestration-types.ts`
- `planner/index.ts` -> re-export agent round loop / tool definitions / utils
- `supervisor/index.ts` -> re-export `multi-step-supervisor.ts`

Meanwhile, there are no remaining path residuals in `src/platform/` and `tests/` that directly import `core/runtime/*`.

## 3. Current Status Should Be Based on Coverage Matrix

Please use [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md) as the current status entry. Per this matrix, the following chapters have formed `exists` closed loop:

- `§37-§44` except `§44` upper domain / interaction chapters
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. Current Real Gaps

Current real gaps are no longer "largely missing", but the following `partial` chapters still have room for deeper work:

- `§6-§8`
  - API resource granularity, communication topology, extension ecosystem runtime chapter-level coverage still relatively light
- `§16-§17`
  - Platform-level prompt release orchestration and dataset / judge gate have been supplemented; remaining gaps mainly in staged canary, judge marketplace, and more complete online monitoring ecosystem
- `§20-§23`
  - Long-running workflow, HITL notification and takeover UI, SDK workbench still have product layer gaps; compliance has supplemented cross-region export and deletion request orchestration, but legal topic package still not thick enough
- `§29`
  - Learning signals -> validated learning objects -> knowledge/evolution memory orchestration has been supplemented, but deeper governance chain of Learn -> Improve -> Approval -> Rollout still needs further consolidation
- `§30`
  - Pack/plugin compatibility list, license tier determination, builtin plugin coverage, and pack development -> testing -> certification -> publish -> deprecate lifecycle have been supplemented, but deeper registry/marketplace linkage can continue to enhance
- `§27-§32`
  - Environment readiness / SLO / resource pool / failover drill orchestration, and event/projection/DLQ inventory have been supplemented; remaining gaps mainly in benchmark inventory, coordinator-level recovery details, deployment resource accounting depth, and complete projection list
- `§33`, `§36`
  - Essentially governance / success criteria chapters, naturally dominated by documentation and contracts
- `§44`
  - UX orchestration has been implemented, but UI product details and WCAG and other non-code specifications still not fully展开

## 5. Documentation Consistency Regression Results

This round has corrected old path references in the following outdated entry documents:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

These entry documents now uniformly point to the current seven-layer structure instead of old `src/core/` / `src/cli/` / `src/gateway/`形态.

## 6. Follow-up Recommendations

If continuing to advance, priority should be:

1. Continue to compress `partial` chapters per coverage matrix, rather than repeating directory reorganization.
2. Batch-supplement more realistic business flow and topic tests for `§6-§8`, `§20-§23`, `§27-§32`.
3. After external consumers completely migrate, then evaluate whether to delete `src/core/runtime/` shim layer.
