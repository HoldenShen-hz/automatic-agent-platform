# Migration Scope from Legacy System to New Platform

## Source

This boundary is based on the following documents:

- [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [00-migration-guideline.md](./00-migration-guideline.md)

Rules:

- Platform skeleton documents define the target state
- Migration guidelines define migration sequence and levels
- Current code architecture documents serve as reference for existing assets and refactoring costs

## Engineering Assets That Must Be Migrated

The current implementation structure (Phase 1a-4) covers the following engineering assets:

- `src/platform/control-plane/` — IAM, Config Center, Approval Center, Incident Control
- `src/platform/execution/` — Dispatcher, Execution Engine, Recovery, Worker Pool
- `src/platform/orchestration/` — OAPEFLIR, Routing, Planner, HITL
- `src/platform/state-evidence/` — Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
- `src/platform/interface/` — API, Channel Gateway, Ingress, Scheduler
- `src/platform/shared/` — Observability, Stability, Tool Metadata
- `src/platform/model-gateway/` — Model Gateway, Cost Tracking
- `src/platform/prompt-engine/` — Prompt Engine
- `src/interaction/` — NL Entry, Goal Decomposition, Proactive Agent, Dashboard, UX
- `src/org-governance/` — Organization Hierarchy, SSO/SCIM, Compliance
- `src/ops-maturity/` — Explainability, Drift Detection, Edge Computing, Cost, Chaos Engineering
- `src/scale-ecosystem/` — Multi-Region, Fair Scheduling, SLA, Connectors, Marketplace
- `src/sdk/` — CLI, Pack SDK, Plugin SDK, Client SDK
- `src/domains/` — Domain Descriptors, Onboarding, Registry
- `src/plugins/` — Plugin System
- `src/testing/` — Testing Tools
- `src/benchmarks/` — Performance Benchmarks
- `config/`
- `divisions/`
- `deploy/`
- `scripts/`
- `tests/unit`
- `tests/integration`
- `tests/golden`

## New Platform Capabilities That Must Be Added

Currently implemented:

- `src/interaction/nl-gateway/` — NL Entry
- `src/interaction/proactive-agent/` — Proactive Agent
- `src/ops-maturity/drift-detection/` — Drift Detection

## Document Families That Need Refactoring Before Migration

The following content still has value but cannot be copied verbatim:

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

Refactoring rules:

- Rewrite all according to the new platform five-plane architecture and current directory structure
- Stop treating `reviews/` and `archive/` as active authoritative sources
- Formal documents are unified under `docs_zh/` and `docs_en/`

## Materials That Only Retain Reference Value

The following content can remain in the old repository for reference but will not enter the new platform's formal document set:

- Old `docs_zh/reference/`
- Old `docs_zh/research/`
- Old `system-status-matrix.md`
- Competitor analysis, reference alignment research
- One-time gap analysis and special reviews

## Content Explicitly Not Migrated

The following content does not enter the new platform's formal document set:

- Old `docs_zh/reviews/`
- Old `docs_zh/archive/`
- Old `docs_zh/operations/archive/`
- Historical TODOs, phase snapshots, sign-off records, one-time evaluation materials

## Conclusion

Migration is complete. Current `src/platform/` is the authoritative code directory, containing all core runtime logic. `src/core/` is for backward compatibility only.

Current document system:

- `docs_zh/architecture/` — 5 architecture documents
- `docs_zh/contracts/` — 113 contract documents
- `docs_zh/adr/` — 38 ADR documents
- `docs_zh/operations/` — 16 operations documents
- `docs_zh/reviews/` — Architecture and implementation difference reviews
