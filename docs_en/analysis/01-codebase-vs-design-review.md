# Codebase vs Architecture Design Review Report

> Review date: 2026-04-20
>
> Review baseline:
>
> - `docs_zh/architecture/00-platform-architecture.md`
> - `docs_zh/architecture/01-code-structure.md`
> - `docs_zh/analysis/00-architecture-coverage-matrix.md`

## 1. Conclusion

The current codebase no longer matches the old conclusion that "Layers 3-7 are mostly skeletons, all contracts in §5 are unimplemented, and `src/core/` still carries real runtime implementation."

The more accurate current assessment is:

- The seven-layer directory structure is stable, and the upper five capability domains have all formed the main closed loop of ADR -> contract -> src -> tests.
- `docs_zh/analysis/00-architecture-coverage-matrix.md` has become the authoritative coverage entry point; most v2.7 chapter statuses are `exists`, and the remaining gaps are primarily `partial`, not `missing` or `skeleton`.
- `src/core/runtime/` has converged to a compatibility shim; the canonical multi-step orchestration implementation is located in `src/platform/execution/execution-engine/`.

## 2. Convergence Items Confirmed Complete This Round

### 2.1 Architecture and Documentation Closed Loop

- ADRs have been continuously extended to `090`
- v2.7 authoritative contracts have been completed by capability domain
- Coverage matrix has established full mapping from architecture chapter -> ADR -> contract -> src -> tests

### 2.2 Code Structure Cleanup

The following cleanup items have been completed in the current codebase:

- `src/platform/execution/execution-engine/` has added directory-level `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` five secondary directories
- `src/scale-ecosystem/*` five secondary directories
- `src/ops-maturity/*` ten secondary directories
- `src/sdk/cli/index.ts`
- `src/platform/interface/ingress/index.ts` correctly exports two rate limiter modules

### 2.3 `core/runtime` Convergence Status

The current positioning of `src/core/runtime/` has changed from "residual real implementation" to "compatibility re-export layer":

- `orchestrator/index.ts` -> re-exports `src/platform/execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` -> re-exports `multi-step-orchestration-types.ts`
- `planner/index.ts` -> re-exports agent round loop / tool definitions / utils
- `supervisor/index.ts` -> re-exports `multi-step-supervisor.ts`

Additionally, there are no remaining paths in `src/platform/` or `tests/` that directly import from `core/runtime/*`.

## 3. Current Status Should Be Based on Coverage Matrix

Use [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md) as the entry point for current status. According to this matrix, the following chapters have formed `exists` closed loops:

- Upper domain / interaction chapters in `§37-§44` except for `§44`
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. Current Real Gaps

The current real gaps are no longer "extensive missing", but rather the following `partial` chapters still have room for deeper work:

- `§6-§8`
  - Chapter-level coverage of API resource granularity, communication topology, and ecosystem extension runtime surface is still light
- `§16-§17`
  - Platform-level prompt release orchestration and dataset / judge gate are complete; remaining gaps are primarily staged canary, judge marketplace, and more complete online monitoring ecosystem
- `§20-§23`
  - Long-running workflow, HITL notification and takeover UI, and SDK workbench still have product-layer gaps; compliance has completed cross-region export and deletion request orchestration, but regulatory topic packages are still not thick enough
- `§29`
  - Orchestration of learning signals -> validated learning objects -> knowledge/evolution memory is complete; the deeper governance chain of Learn -> Improve -> Approval -> Rollout still needs to be further solidified
- `§30`
  - Pack/plugin compatibility inventory, license tier determination, builtin plugin coverage, and pack development -> testing -> certification -> publish -> deprecate lifecycle are complete; deeper registry/marketplace integration can continue to improve
- `§27-§32`
  - Environment readiness / SLO / resource pool / failover drill orchestration and event/projection/DLQ inventory are complete; remaining gaps are primarily benchmark inventory, coordinator-level recovery details, deployment resource ledger depth, and complete projection inventory
- `§33`, `§36`
  - Essentially governance / success criteria chapters, naturally primarily documentation and contracts
- `§44`
  - UX orchestration is implemented, but UI product details and non-code standards like WCAG are not yet fully expanded

## 5. Documentation Consistency Regression Results

This round has corrected the following outdated path references in entry documents:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

These entry documents now uniformly point to the current seven-layer structure, rather than the old `src/core/` / `src/cli/` / `src/gateway/` form.

## 6. Follow-up Recommendations

If continuing to advance, priorities should be:

1. Continue to reduce `partial` chapters according to the coverage matrix, rather than repeating directory restructuring.
2. Batch-add more realistic business flows and topic tests for `§6-§8`, `§20-§23`, and `§27-§32`.
3. After external consumers have completely migrated, evaluate whether to delete the `src/core/runtime/` shim layer.
