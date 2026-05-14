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

The current codebase no longer conforms to the old findings such as "Layers 3-7 are mostly skeletons, all contracts in §5 unimplemented, and `src/core/` still carries real runtime implementations".

The current more accurate assessment is:

- The seven-layer directory structure is now stable, and all five upper capability domains have formed the main closed loop of ADR -> contract -> src -> tests.
- `docs_zh/analysis/00-architecture-coverage-matrix.md` has become the authoritative coverage entry point; most v2.7 chapter statuses are `exists`, with the remaining gaps concentrated in `partial` rather than `missing` or `skeleton`.
- `src/core/runtime/` has converged to a compatibility shim; the canonical multi-step orchestration implementation is located in `src/platform/five-plane-execution/execution-engine/`.

## 2. Convergence Items Confirmed Complete This Round

### 2.1 Architecture and Documentation Closed Loop

- ADRs have been continuously expanded to `090`
- v2.7 authoritative contracts have been supplemented by capability domain
- Coverage matrix has established full mapping from `architecture chapter -> ADR -> contract -> src -> tests`

### 2.2 Code Structure Organization

The following organization items have been completed in the current codebase:

- `src/platform/five-plane-execution/execution-engine/` added directory-level `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` five secondary directories
- `src/scale-ecosystem/*` five secondary directories
- `src/ops-maturity/*` ten secondary directories
- `src/sdk/cli/index.ts`
- `src/platform/five-plane-interface/ingress/index.ts` correctly exports two rate limiter modules

### 2.3 `core/runtime` Convergence Status

The current positioning of `src/core/runtime/` has changed from "residual real implementation" to "compatibility re-export layer":

- `orchestrator/index.ts` → re-exports `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` → re-exports `multi-step-orchestration-types.ts`
- `planner/index.ts` → re-exports agent round loop / tool definitions / utils
- `supervisor/index.ts` → re-exports `multi-step-supervisor.ts`

Additionally, there are no remaining paths in `src/platform/` or `tests/` that directly import from `core/runtime/*`.

## 3. Current Status Should Be Based on Coverage Matrix

Please use [00-architecture-coverage-matrix.md](./00-architecture-coverage-matrix.md) as the entry point for current status. According to this matrix, the following chapters have formed `exists` closed loops:

- Upper domain / interaction chapters in `§37-§44` except `§44`
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. Current Real Gaps

The current real gaps are no longer "large amounts of missing", but rather the following `partial` chapters still have room for further deepening:

- `§6-§8`
  - API resource granularity, communication topology, and chapter-level coverage of the extended ecosystem runtime surface are still relatively light
- `§16-§17`
  - Platform-level prompt release orchestration and dataset/judge gate have been supplemented; remaining gaps are mainly staged canary, judge marketplace, and more complete online monitoring ecosystem
- `§20-§23`
  - Long-running workflow, HITL notification and takeover UI, SDK workstation still have product-level gaps; compliance has supplemented cross-region export and deletion request orchestration, but legal topic packages are still not thick enough
- `§29`
  - Orchestration from learning signals -> validated learning objects -> knowledge/evolution memory has been completed, but the deeper governance chain of Learn -> Improve -> Approval -> Rollout still needs to be further solidified
- `§30`
  - pack/plugin compatibility list, license tier determination, builtin plugin coverage, and pack development -> testing -> certification -> publish -> deprecate lifecycle have been completed, but deeper registry/marketplace linkage can continue to be enhanced
- `§27-§32`
  - Environment readiness / SLO / resource pool / failover drill orchestration, and event/projection/DLQ inventory have been supplemented; remaining gaps are mainly benchmark inventory, coordinator-level recovery details, deployment resource ledger thickness, and complete projection list
- `§33`, `§36`
  - Essentially governance / success criteria chapters, inherently document and contract-centric
- `§44`
  - UX orchestration has been implemented, but UI product details and non-code standards like WCAG are still not fully expanded

## 5. Documentation Consistency Regression Results

This round has corrected outdated path references in the following entry documents:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

These entry documents now uniformly point to the current seven-layer structure instead of the old `src/core/` / `src/cli/` / `src/gateway/` form.

## 6. Follow-up Recommendations

If continuing to advance, the priority should be:

1. Continue to compress `partial` chapters according to the coverage matrix, rather than repeatedly doing directory reorganization.
2. Batch supplement more realistic business flows and topic tests for `§6-§8`, `§20-§23`, `§27-§32`.
3. After external consumers have completely migrated, evaluate whether to delete the `src/core/runtime/` shim layer.
