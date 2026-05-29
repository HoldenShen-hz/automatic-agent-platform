# ADR-033 Phased Roadmap

- Status: Superseded by ADR-112
- Decision Date: 2026-04-17

## Background

Platform construction is a gradual process requiring clear phase divisions and stage gates to ensure each phase delivers usable functionality.

## Decision

### 3 Ring Roadmap

| Phase | Goal | Key Deliverables |
|-------|------|------------------|
| Ring 1 | Core Execution Plane | HarnessRuntime, PlanGraphBundle, state management |
| Ring 2 | Enhanced Stability | Recovery mechanisms, monitoring alerting, governance and durability |
| Ring 3 | Business Domain and Ecosystem | DomainDescriptor, Pack SDK, Marketplace, multi-Region |

### Roadmap Service

- `domains/roadmap/roadmap-service.ts` (124 lines)
- Phase tracking and state management
- Completion records

### Stage Gates

- SuccessCriteriaService supports ring gate registration
- Metric scoring
- `evaluatePhaseAdvance()` interception

### Feature Flags

- Feature flag governance in config-override-governance
- gray-release-rehearsal supports canary release

## Consequences

Benefits:

- Phasing reduces delivery risk
- Stage gates ensure quality
- Feature flags support progressive release

Costs:

- Roadmap maintenance requires continuous investment
- Phase boundaries may need adjustment

## Cross-References

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## v4.3 ADR Remediation

- A-64: This ADR originally treated `Phase 1-7` as the canonical roadmap. Root cause: when the roadmap ADR was formed, the main architecture had not yet unified to the ring口径. Fix: Body now changed to `Ring 1/2/3`, historical phase only allowed as old milestone mapping.

## Source Sections

- `§33` Phased Roadmap