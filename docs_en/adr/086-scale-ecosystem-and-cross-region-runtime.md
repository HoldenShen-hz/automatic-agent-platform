# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Region, quota, SLA, feedback, marketplace, connector health signals
- **Assess**: Cross-region routing, resource competition, SLA tiering, ecosystem governance
- **Plan**: Region selection, quota allocation, connector execution, and ecosystem expansion strategy
- **Execute**: Multi-region operation, preemption, fair scheduling, connector calls, marketplace installation
- **Feedback**: User feedback, quality signals, marketplace performance, and connector health return
- **Learn**: Marketplace performance, resource strategy, and feedback-driven improvement
- **Improve**: SLA, scheduler, connector, and ecosystem capability continuous optimization
- **Release**: Cross-region, ecosystem component, and connector tiered release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative correspondence is in the multi-region, SLA, and ecosystem expansion section of `docs_zh/architecture/00-platform-architecture.md`. The repository already has:

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

But the maturity of these directories varies significantly.

## Decision

### 1. Multi-Region Routing Must Simultaneously Be Constrained by Data Residency and Execution Proximity

Region selection cannot只看latency, but must同时满足:

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. Quota, Preemption, Fair Scheduling Belong to Unified Scheduling Governance Surface

Resource competition management is not a scattered policy collection, but a unified scheduler contract.

### 3. SLA Tier Must Directly Affect Scheduling and Isolation

SLA is not a pure report field, must participate in:

- queue priority
- reservation
- preemption
- escalation

### 4. Marketplace, Feedback, Connectors Use Unified Ecosystem Governance Approach

Although these three types of capabilities have different scenarios, all must comply with:

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` will become the unified module boundary for cross-region and open ecosystem
- Subsequent implementation will prioritize supplementing scheduler, connector, and cross-region contracts