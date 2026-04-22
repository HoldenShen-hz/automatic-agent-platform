# Migration Boundaries: Legacy System to New Platform

## Source Documents

This boundary is defined by the following documents:

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)

Rules:

- Platform skeleton document defines the target state
- Migration guideline defines migration sequence and phases
- Legacy code architecture document serves only as reference for existing assets and refactoring costs

## Engineering Assets That Must Be Migrated

Current implementation structure (Phase 1a-4) covers the following engineering assets:

- `src/platform/control-plane/` — IAM, config center, approval center, incident control
- `src/platform/execution/` — dispatcher, execution engine, recovery, worker pool
- `src/platform/orchestration/` — OAPEFLIR, routing, planner, HITL
- `src/platform/state-evidence/` — Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
- `src/platform/interface/` — API, Channel Gateway, Ingress, Scheduler
- `src/platform/shared/` — observability, stability, tool metadata
- `src/platform/model-gateway/` — model gateway, cost tracking
- `src/platform/prompt-engine/` — Prompt engine
- `src/interaction/` — NL entry, goal decomposition, proactive agent, dashboard, UX
- `src/org-governance/` — org hierarchy, SSO/SCIM, compliance
- `src/ops-maturity/` — explainability, drift detection, edge computing, cost, chaos engineering
- `src/scale-ecosystem/` — multi-region, fair scheduling, SLA, connectors, marketplace
- `src/sdk/` — CLI, Pack SDK, Plugin SDK, Client SDK
- `src/domains/` — domain descriptor, onboarding, registry
- `src/plugins/` — plugin system
- `src/testing/` — testing utilities
- `src/benchmarks/` — performance benchmarks
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
- `src/interaction/proactive-agent/` — proactive agent
- `src/ops-maturity/drift-detection/` — drift detection

## Document Families That Require Transformation Before Migration

The following content still has value but cannot be copied verbatim:

- Legacy `doc/00` through `doc/07`
- `18_code_architecture.md`
- `19_full_coverage_test_manual.md`
- `runtime-sequence.md`
- `module-inventory.md`
- `release-checklist.md`
- Legacy `docs_zh/contracts/`
- Legacy `docs_zh/adr/`
- Legacy `docs_zh/guides/`
- Legacy `docs_zh/governance/`

Transformation rules:

- Rewrite all content under the new platform's five-plane architecture and current directory structure
- Stop treating `reviews/` and `archive/` as active sources of truth
- Formal documentation is now centralized in `docs_zh/` and `docs_en/`

## Materials That Are Retained for Reference Only

The following content may remain in the legacy repository for consultation but does not enter the new platform's official documentation set:

- Legacy `docs_zh/reference/`
- Legacy `docs_zh/research/`
- Legacy `system-status-matrix.md`
- Competitive analysis and reference alignment research
- One-time gap analyses and special reviews

## Content Explicitly Not Migrated

The following content does not enter the new platform's official documentation set:

- Legacy `docs_zh/reviews/`
- Legacy `docs_zh/archive/`
- Legacy `docs_zh/operations/archive/`
- Historical TODOs, phase snapshots, sign-off records, and one-time evaluation materials

## Conclusion

Migration is complete. `src/platform/` is now the authoritative code directory, containing all core runtime logic. `src/core/` is retained for backward compatibility only.

Current documentation system:

- `docs_zh/architecture/` — 5 architecture documents
- `docs_zh/contracts/` — 113 contract documents
- `docs_zh/adr/` — 38 ADR documents
- `docs_zh/operations/` — 16 operations documents
- `docs_zh/reviews/` — architecture and implementation difference reviews
