# Migration Scope: Old System to New Platform

## Source

This boundary is based on:

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)

Rules:

- Platform skeleton documents define the target state
- Migration guidelines define migration order and classification
- Current code architecture documents serve as reference for legacy assets vs. refactoring costs

## Engineering Assets That Must Be Migrated

Current implementation structure (Phase 1a-4) covers the following engineering assets:

- `src/platform/five-plane-control-plane/` — IAM, config center, approval center, incident control
- `src/platform/five-plane-execution/` — Scheduler, execution engine, recovery, worker pool
- `src/platform/five-plane-orchestration/` — OAPEFLIR, routing, planner, HITL
- `src/platform/five-plane-state-evidence/` — Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
- `src/platform/five-plane-interface/` — API, Channel Gateway, Ingress, Scheduler
- `src/platform/shared/` — Observability, stability, tool metadata
- `src/platform/model-gateway/` — Model gateway, cost tracking
- `src/platform/prompt-engine/` — Prompt engine
- `src/interaction/` — NL entry, goal decomposition, proactive agent, dashboard, UX
- `src/org-governance/` — Org hierarchy, SSO/SCIM, compliance
- `src/ops-maturity/` — Explainability, drift detection, edge computing, cost, chaos engineering
- `src/scale-ecosystem/` — Multi-region, fair scheduling, SLA, connectors, marketplace
- `src/sdk/` — CLI, Pack SDK, Plugin SDK, Client SDK
- `src/domains/` — Domain descriptors, onboarding, registry
- `src/plugins/` — Plugin system
- `src/testing/` — Testing utilities
- `src/benchmarks/` — Performance benchmarks
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`
- `tests/unit`
- `tests/integration`
- `tests/golden`

## New Platform Capabilities That Must Be Added

Currently implemented:

- `src/interaction/nl-gateway/` — NL entry
- `src/interaction/proactive-agent/` — Proactive agent
- `src/ops-maturity/drift-detection/` — Drift detection

## Document Families Requiring Rewriting Before Migration

The following content still has value but cannot be copied as-is:

- Old `doc/00` to `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- Old `docs_zh/contracts/`
- Old `docs_zh/adr/`
- Old `docs_zh/guides/`
- Old `docs_zh/governance/`

Rewriting rules:

- Rewrite all according to the new platform Five-Plane architecture and current directory structure
- Stop treating `reviews/` and `archive/` as active sources of truth
- Official documents should be placed in `docs_zh/` vs `docs_en/`

## Materials That Only Have Reference Value

The following may remain in the old repository for reference but will not enter the new platform's official document set:

- Old `docs_zh/reference/`
- Old `docs_zh/research/`
- Old `system-status-matrix.md`
- Competitor analysis, reference alignment research
- One-time gap analysis and special reviews

## Content That Will Not Be Migrated

The following will not enter the new platform's official document set:

- Old `docs_zh/reviews/`
- Old `docs_zh/archive/`
- Old `docs_zh/operations/archive/`
- Historical TODOs, phase snapshots, sign-off records, one-time evaluation materials

## Conclusion

Migration is complete. The current `src/platform/` is the authoritative code directory, containing all core runtime logic. `src/core/` is used only for backward compatibility.

Current document system:

- `docs_zh/architecture/` — 5 architecture documents
- `docs_zh/contracts/` — 151 contract documents
- `docs_zh/adr/` — 120 ADR documents
- `docs_zh/operations/` — 16 operations documents
- `docs_zh/reviews/` — Architecture vs. implementation差异 reviews