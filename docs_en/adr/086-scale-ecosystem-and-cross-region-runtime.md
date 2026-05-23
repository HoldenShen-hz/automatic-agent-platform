# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Region, quota, SLA, feedback, marketplace, connector health signals
- **Assess**: Cross-region routing, resource competition, SLA stratification, ecosystem governance
- **Plan**: Region selection, quota allocation, connector execution, and ecosystem expansion strategy
- **Execute**: Multi-region operation, preemption, fair scheduling, connector calls, marketplace installation
- **Feedback**: User feedback, quality signals, marketplace performance, and connector health feedback
- **Learn**: Marketplace performance, resource strategy, and feedback-driven improvement
- **Improve**: SLA, scheduler, connector, and ecosystem capability continuous optimization
- **Release**: Cross-region, ecosystem components, and connector tiered rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

The current authoritative source corresponds to the multi-region, SLA, and ecosystem expansion chapters in `docs_zh/architecture/00-platform-architecture.md`. The current repository already has:

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

But the maturity of these directories varies significantly.

## Decisions

### 1. Multi-region routing must simultaneously be constrained by data residency and execution proximity

Region selection cannot just look at latency, but must simultaneously satisfy:

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. Quota, preemption, fair scheduling belong to unified scheduler governance surface

Resource competition management is not a scattered policy collection, but a unified scheduler contract.

### 3. SLA tier must directly affect scheduling and isolation

SLA is not a pure report field, and must participate in:

- queue priority
- reservation
- preemption
- escalation

### 4. Marketplace, feedback, and connectors adopt unified ecosystem governance approach

Although these three capabilities have different scenarios, all must comply with:

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` will become unified module boundary for cross-region and open ecosystem
- Subsequent implementation will prioritize supplementing scheduler, connector, and cross-region contracts
