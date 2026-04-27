# Migration Guideline

## Overview

This guideline defines migration principles, levels, absorption methods, and judgment criteria for migrating from the legacy system to the new platform.

## Migration Principles

1. **Platform skeleton takes precedence**: When migration content conflicts with `architecture/00-platform-architecture.md`, the skeleton document takes precedence.
2. **Incremental migration**: Large modules are migrated incrementally by bounded context to reduce risk.
3. **Contract-driven**: Migration is driven by interface contracts, not implementation details.
4. **Test coverage required**: Each migrated module must have corresponding test coverage.
5. **No regression**: Migration must not introduce regressions in existing functionality.

## Migration Levels

### Level A — Direct Transplant (Green)

**Meaning**: Zero modification, copy and use directly.

**Typical scope**: 0% — only copy + import path update

**Criteria**:
- Interface, naming, and dependencies are all compatible with the new architecture
- No adapter/wrapper needed

### Level A2 — Direct Reuse with Adapter (Green+Wrench)

**Meaning**: Core implementation unchanged, need to add adapter/wrapper to align with new architecture extension points.

**Typical scope**: ≤15% — add adapter layer or supplement missing interfaces

**Criteria**:
- Architecture alignment ≥ medium
- Modification scope ≤15%
- Need new adapter/wrapper

### Level B — Refactoring Transplant (Yellow)

**Meaning**: Core logic can be reused, but need to adapt to new architecture interfaces/naming/layering.

**Typical scope**: 15%-50% — interface refactoring + dependency replacement

**Criteria**:
- Core reusable but at least one dimension is "low" or modification scope >15%

### Level C — Reference Value Only (Blue)

**Meaning**: Not directly transplanted, but design thinking/test cases/competitor analysis has reference value.

**Typical scope**: N/A — reference only, no code movement

**Criteria**:
- Architecture alignment is "low" and modification scope ≥50%

### Level D — Archive and Deprecate (White)

**Meaning**: Outdated or replaced by new design, for historical archiving only.

**Typical scope**: N/A — archive only

**Criteria**:
- Explicitly replaced or deprecated by v2.7

## Five-Dimensional Judgment Template

Each module/document's level determination must provide the following five-dimensional evaluation evidence:

| Dimension | Meaning | Scoring Criteria |
|------|------|---------|
| **Architecture Alignment** | Interface/layer alignment degree with v2.7 target architecture | High=interfaces directly aligned / Medium=needs adapter / Low=needs interface rewrite |
| **Dependency Pollution** | Coupling degree to external modules, affects independent migration capability | Low=≤2 direct dependencies / Medium=3-5 / High=≥6 or circular dependencies |
| **Interface Stability** | Expected change degree of public APIs during migration | High=unchanged / Medium=extend but compatible / Low=breaking changes |
| **Test Coverage** | Coverage of core behavior by existing tests | High=full behavior coverage / Medium=main path coverage / Low=insufficient coverage |
| **Modification Scope** | Proportion of code that needs modification to total module | Small=≤15% / Medium=15%-50% / Large=≥50% |

**Judgment Rules**:
- **A1**: All five dimensions are "High/Low/High/High/Small"
- **A2**: Architecture alignment ≥ medium, modification scope ≤15%, but needs new adapter/wrapper
- **B**: Core reusable but at least one dimension is "low" or modification scope >15%
- **C**: Architecture alignment is "low" and modification scope ≥50%
- **D**: Explicitly replaced or deprecated by v2.7

## New Architecture Seven-Layer Mapping

```
Layer 7 │ Operational Maturity Layer (Explainability·Emergency Brake·Lifecycle·Edge·Drift·Cost·Debug·Compliance·Capacity·Multimodal·Self-Ops)
Layer 6 │ Scale Operations Layer + Ecosystem (Multi-Region·Resource Competition·SLA·Marketplace·Feedback·Integration)
Layer 5 │ Organization Governance Layer (Organization Hierarchy·Approval Routing·SSO·Compliance·Knowledge Isolation·Delegation)
Layer 4 │ Intelligent Interaction Layer (NL Entry·Goal Decomposition·Proactive Agent·Autonomy·Dashboard·UX)
Layer 3 │ Business Domain Access Layer (DomainDescriptor·Recipe·Runbook)
Layer 2 │ AI Operations Layer (LLM Abstraction·Prompt·Eval·Cost·HITL·SDK)
Layer 1 │ Infrastructure Layer (Five Planes·Stability·Risk·Security·Recovery·Audit)
```

## Migration Sequence

The recommended migration sequence is:

1. **P0 — Test Helpers**: Migrate all test helper files first
2. **P1 — Shared Kernel**: types, errors, constants, utils, results, lifecycle
3. **P2 — Infrastructure Foundation**: storage, events, config, locking, queue, cache
4. **P3 — Security & Governance**: security, approvals, cost, compliance, hr
5. **P4 — AI Ops Primitives**: providers, tools, workflow, artifacts
6. **P5 — Runtime Core**: runtime (split after migration)
7. **P6 — OAPEFLIR Pipeline**: agent-loop, planning, feedback, learning, evaluation, improvement
8. **P7 — Interaction Layer**: memory, knowledge, messages, gateway
9. **P8 — Business Domain**: domain-registry, divisions, plugins
10. **P9 — Operational Maturity**: observability, ops, stability, evolution, reliability, product, deployment
11. **P10 — CLI + E2E + Golden**: cli, e2e, golden, performance

## Phase Entry and Exit Criteria

Each migration Phase must meet clear Definition of Ready (DoR) and Definition of Done (DoD).

| Phase | Entry Criteria | Exit Criteria |
|-------|---------|-------------------------------|
| **P0 Test Helpers** | New project repo initialized, tsconfig/eslint/package.json in place | All 19 helper files pass `tsc --noEmit`; `createTempWorkspace()` available in new project |
| **P1 Shared Kernel** | P0 exit criteria met | types/errors/constants/utils/results/lifecycle all compile; 38 unit tests all green; zero external runtime dependencies |
| **P2 Infrastructure** | P1 exit criteria met | storage/events/config/locking/queue/cache compile; 180 unit tests + related integration tests all green; SQLite migration ledger integrity verification passed |
| **P3 Security** | P2 exit criteria met | security/approvals/cost/compliance/hr compile; 115 tests green; 64 security boundary integration tests all pass |
| **P4 AI Ops** | P2 exit criteria met | providers/tools/workflow/artifacts compile; 100 tests green; Provider CircuitBreaker integration test passes |
| **P5 Runtime** | P2+P3+P4 exit criteria met | Runtime 12 BCs extracted by wave; 150 tests green; stable-* rehearsal scenarios all pass; dispatch/lease/recovery integration tests pass |
| **P6 OAPEFLIR** | P4+P5 exit criteria met | agent-loop/planning/feedback/learning/evaluation/improvement compile; 56 tests green; OAPEFLIR 8-stage full loop E2E passes |
| **P7 Interaction** | P5+P6 exit criteria met | memory/knowledge/messages/gateway compile; 70 tests green; session→memory→retrieval end-to-end passes |
| **P8 Business Domain** | P2+P7 exit criteria met | domain-registry/divisions/plugins compile; 40 tests green; at least 1 division end-to-end loads successfully |
| **P9 Maturity** | P5 exit criteria met | observability/ops/stability/evolution/reliability/product/deployment compile; 165 tests green; health check + SLO alerting integration test passes |
| **P10 CLI + E2E** | All P1-P9 exit criteria met | CLI 78 entries compile; 10 E2E tests green; 8 golden test snapshots match; 6 performance tests meet baseline; `npm test` full regression green; `npm run build` generates dist/ successfully |

## Content Not Migrated

The following content is **explicitly not migrated** and only archived:

- `docs_zh/archive/` all files
- 9 D files in `docs_zh/reference/`
- `docs_zh/automatic_agent_platform/agent_platform.md` (92K lines)
- Chunk translation fragment files in `docs_zh/automatic_agent_platform/`
- 6 D files in `docs_zh/reviews/`
- 10 D contracts in `docs_zh/contracts/`
