# ADR-033 Phased Roadmap

- Status: Accepted
- Decision Date: 2026-04-17

## Context

Platform construction is an incremental process that requires clear phase divisions and phase gates to ensure each phase delivers usable functionality.

## Decision

### 7-Phase Roadmap

| Phase | Objective | Key Deliverables |
|-------|-----------|------------------|
| Phase 1 | Core Execution Plane | Basic Workflow, Plugin, State Management |
| Phase 2 | Stability Enhancement | Recovery Mechanism, Monitoring Alerts |
| Phase 3 | AI Operations Layer | LLM Abstraction, Prompt Governance, Cost Management |
| Phase 4 | Business Domain Onboarding | DomainDescriptor, Pack SDK |
| Phase 5 | Intelligent Interaction | NL Entry, Goal Decomposition, Proactive Agent |
| Phase 6 | Organization Governance | Tenant Isolation, SSO, Permission Management |
| Phase 7 | Scale Ecosystem | Multi-Region, Marketplace |

### Roadmap Service

- `domains/roadmap/roadmap-service.ts` (124 lines)
- Phase tracking and status management
- Completion records

### Phase Gates

- SuccessCriteriaService supports phase gate registration
- Metric scoring
- `evaluatePhaseAdvance()` interception

### Feature Flags

- Feature flag governance in `config-override-governance`
- `gray-release-rehearsal` supports canary release

## Consequences

Positive:
- Phasing reduces delivery risk
- Phase gates ensure quality
- Feature flags support incremental release

Negative:
- Roadmap maintenance requires ongoing investment
- Phase boundaries may need adjustment

## Cross-References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## Source Sections

- `§33` Phased Roadmap
