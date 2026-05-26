# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Region, quota, SLA, feedback, market, connector health signals
- **Assess**: Cross-region routing, resource competition, SLA tiering, ecosystem governance
- **Plan**: Region selection, quota allocation, connector execution, and ecosystem expansion strategy
- **Execute**: Multi-region operation, preemption, fair scheduling, connector calls, marketplace install
- **Feedback**: User feedback, quality signals, marketplace performance, and connector health return
- **Learn**: Marketplace performance, resource strategy, and feedback-driven improvement
- **Improve**: SLA, scheduler, connector, and ecosystem capability continuous optimization
- **Release**: Cross-region, ecosystem components, and connector tiered release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative source corresponds to multi-region, SLA, and ecosystem expansion chapters in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

But the maturity of these directories is clearly inconsistent.

## Decision

### 1. Multi-Region Routing Must Simultaneously Constrain Data Residency and Execution Proximity

Region selection cannot look at latency alone, must also satisfy:

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. Quota, Preemption, Fair Scheduling Belong to Unified Scheduler Governance Plane

Resource competition management is not a scattered strategy collection, but a unified scheduler contract.

### 3. SLA Tier Must Directly Influence Scheduling and Isolation

SLA is not a pure reporting field, must participate in:

- queue priority
- reservation
- preemption
- escalation

### 4. Marketplace, Feedback, Connectors Use Unified Ecosystem Governance Approach

These three types of capabilities, although different scenarios, must all comply with:

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` will become the unified module boundary for cross-region and open ecosystem
- Subsequent implementation will prioritize supplementing scheduler, connector, and cross-region contracts
