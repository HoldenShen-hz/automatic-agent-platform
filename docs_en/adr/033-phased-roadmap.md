# ADR-033 Phased Roadmap (Historical Phase Version, Superseded by Ring Roadmap)

- Status: Superseded by ADR-112
- Decision Date: 2026-04-17

## Context

Platform construction is an incremental process requiring clear phase definitions and phase gates to ensure deliverable functionality at each stage.

## Decision

### 3 Ring Roadmap

| Phase | Goal | Key Deliverables |
|-------|------|------------------|
| Ring 1 | Core Execution Plane | HarnessRuntime, PlanGraphBundle, State Management |
| Ring 2 | Stability Enhancement | Recovery mechanisms, Monitoring alerts, Governance and durability |
| Ring 3 | Business Domains and Ecosystem | DomainDescriptor, Pack SDK, Marketplace, Multi-Region |

### Historical Roadmap Service (Compatibility Note)

- `domains/roadmap/roadmap-service.ts` (124 lines)
- Historical phase tracking and state management
- Completion record projection

### Historical Phase Gates (Compatibility Projection)

- SuccessCriteriaService supports ring gate registration; old `evaluatePhaseAdvance()` only allowed as historical milestone projection, no longer defines canonical advancement conditions
- Metric scoring
- `evaluatePhaseAdvance()` interception

### Feature Flags

- Feature flag governance in config-override-governance
- gray-release-rehearsal supports canary release

## Consequences

Pros:

- Phasing reduces delivery risk
- Phase gates ensure quality
- Feature flags support progressive release

Cons:

- Roadmap maintenance requires ongoing investment
- Phase boundaries may need adjustment

## Cross-references

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md)
- [ADR-090 Runtime, Data Reliability and Operations Governance](./090-runtime-data-reliability-and-operations.md)

## v4.3 ADR Remediation

- A-64: This ADR originally used `Phase 1-7` as the canonical roadmap. Root cause: when the rollout roadmap ADR was formed, the main architecture had not yet unified to the ring terminology. Fix: The text now uses `Ring 1/2/3`, with historical phases only allowed as old milestone mappings.
- R8-63 / R6-48: Historical `evaluatePhaseAdvance()` and `Phase 1-7` gates are no longer the active canonical roadmap. The text now clarifies that this ADR is superseded historical mapping, with current advancement boundaries based on `Ring 1 / Ring 2 / Ring 3` and ADR-112.

## Current Authority

- Ring 1: Core execution plane available
- Ring 2: Stability, governance, and recovery readiness
- Ring 3: Business domains, ecosystem, and multi-region expansion

Historical `Phase 1-7`, if needed in old reports for display, must be labeled as migration aliases and cannot be used as basis for new gates or new contracts.

## Source Section

- `§33` Phased Roadmap
