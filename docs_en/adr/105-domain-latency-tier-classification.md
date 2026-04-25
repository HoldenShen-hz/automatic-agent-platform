# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Gather domain latency and SLA requirements
- **Assess**: Classify as ultra-low latency, realtime, near-realtime, or batch
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run with latency tier-aware routing and capacity
- **Feedback**: Monitor breaches and contention
- **Learn**: Optimize resource pool allocation
- **Improve**: Tune per-domain SLA
- **Release**: Latency tier is part of domain readiness gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Latency requirements vary significantly across domains, and a uniform scheduling strategy leads to resource waste or SLA failure.

## Decision

- Every domain must declare a latency tier
- The platform uses it to assign queue priority, resource pools, and recovery order

## Consequences

- Domain config no longer lacks SLA and latency dimensions