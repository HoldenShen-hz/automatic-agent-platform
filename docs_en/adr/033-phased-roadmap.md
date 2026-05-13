# ADR-033 Phased Roadmap

- Status: Accepted
- Decision Date: 2026-04-17

## Context

Platform construction is an incremental process that requires clear phase divisions and phase gates to ensure each phase delivers usable functionality.

## Decision

### 3 Ring Roadmap

| Ring | Objective | Key Deliverables |
|------|-----------|------------------|
| Ring 1 | Core Execution Plane | HarnessRuntime, PlanGraphBundle, State Management |
| Ring 2 | Stability Enhancement | Recovery Mechanism, Monitoring Alerts, Governance and Durability |
| Ring 3 | Business Domain and Ecosystem | DomainDescriptor, Pack SDK, Marketplace, Multi-Region |

### Roadmap Service

- `domains/roadmap/roadmap-service.ts` (124 lines)
- Phase tracking and status management
- Completion records

### Phase Gates

- SuccessCriteriaService supports ring gate registration
- Metric scoring
- `evaluatePhaseAdvance()` interception

### Feature Flags

- Feature flag governance in config-override-governance
- gray-release-rehearsal supports canary release

## Consequences

Benefits:

- Phasing reduces delivery risk
- Phase gates ensure quality
- Feature flags support incremental release

Trade-offs:

- Roadmap maintenance requires ongoing investment
- Phase boundaries may need adjustment

## Cross-references

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## v4.3 ADR Remediation

- A-64: This ADR originally used `Phase 1-7` as the canonical roadmap. The root cause was that when the rollout roadmap ADR was formed, the main architecture had not yet unified to the ring terminology. Fix: The body now uses `Ring 1/2/3`, with historical phases only allowed as old milestone mappings.

## Source Section

- `§33` Phased Roadmap