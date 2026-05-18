# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Region, quota, SLA, feedback, market, connector health signals
- **Assess**: Cross-region routing, resource competition, SLA tiering, ecosystem governance
- **Plan**: Region selection, quota allocation, connector execution, and ecosystem expansion strategy
- **Execute**: Multi-region operation, preemption, fair scheduling, connector calls, marketplace install
- **Feedback**: User feedback, quality signals, market performance, and connector health reflux
- **Learn**: Market performance, resource strategy, and feedback-driven improvement
- **Improve**: SLA, scheduler, connector, and ecosystem capability continuous optimization
- **Release**: Cross-region, ecosystem components, and connector tiered rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§52-§57` requires the platform to enter the scale operation and open ecosystem stage. The current repository already has:

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

But the maturity of these directories is visibly inconsistent.

## Decisions

### 1. Multi-Region Routing Must Simultaneously Be Constrained by Data Residency and Execution Proximity

Region selection cannot look at latency alone, must simultaneously satisfy:

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. Quota, Preemption, Fair Scheduling Belong to a Unified Scheduling Governance Plane

Resource competition management is not a scattered policy collection, but a unified scheduler contract.

### 3. SLA Tier Must Directly Affect Scheduling and Isolation

SLA is not a pure reporting field, must participate in:

- queue priority
- reservation
- preemption
- escalation

### 4. Marketplace, Feedback, Connectors Use a Unified Ecosystem Governance Approach

Although these three capability types have different scenarios, all must comply with:

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` will become the unified module boundary for cross-region and open ecosystem
- Subsequent implementation will prioritize supplementing scheduler, connector, and cross-region contracts
