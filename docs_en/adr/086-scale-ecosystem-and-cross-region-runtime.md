# ADR-086 Scale Ecosystem And Cross Region Runtime

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Region, quota, SLA, feedback, marketplace, connector health signals
- **Assess**: Cross-region routing, resource competition, SLA stratification, ecosystem governance
- **Plan**: Region selection, quota allocation, connector execution, and ecosystem expansion strategy
- **Execute**: Multi-region execution, preemption, fair scheduling, connector invocation, marketplace installation
- **Feedback**: User feedback, quality signals, marketplace performance, and connector health feedback
- **Learn**: Marketplace performance, resource strategy, and feedback-driven improvement
- **Improve**: SLA, scheduler, connector, and ecosystem capability continuous optimization
- **Release**: Cross-region, ecosystem component, and connector tiered release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§52-§57` requires the platform to enter the scale operation and open ecosystem phase. The current repository already has:

- `src/scale-ecosystem/multi-region`
- `src/scale-ecosystem/resource-manager`
- `src/scale-ecosystem/sla-engine`
- `src/scale-ecosystem/marketplace`
- `src/scale-ecosystem/feedback-loop`
- `src/scale-ecosystem/integration`

However, the maturity of these directories is significantly inconsistent.

## Decisions

### 1. Multi-region routing must be constrained by both data residency and execution locality

Region selection cannot look at latency alone; it must simultaneously satisfy:

- data residency
- legal transfer rule
- workload affinity
- recovery topology

### 2. Quota, preemption, and fair scheduling belong to a unified scheduling governance plane

Resource competition management is not a scattered collection of policies, but a unified scheduler contract.

### 3. SLA tier must directly affect scheduling and isolation

SLA is not a pure reporting field and must participate in:

- queue priority
- reservation
- preemption
- escalation

### 4. Marketplace, feedback, and connectors adopt a unified ecosystem governance approach

Although these three capabilities have different scenarios, all must comply with:

- manifest / metadata
- lifecycle
- review / certification
- rollback / revoke

## Consequences

- `scale-ecosystem` will become the unified module boundary for cross-region and open ecosystem
- Subsequent implementation will prioritize supplementing scheduler, connector, and cross-region contracts
