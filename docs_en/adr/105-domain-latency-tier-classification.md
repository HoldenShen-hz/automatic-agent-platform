# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Gather domain latency and SLA expectations
- **Assess**: Classify into ultra-low latency, realtime, near-realtime, or batch
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run with tier-aware routing and capacity
- **Feedback**: Monitor breaches and contention
- **Learn**: Improve pool allocation
- **Improve**: Tune per-domain SLA
- **Release**: Latency tier is part of domain readiness

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Domain latency requirements vary significantly and require explicit classification.

## Decision

- Every domain must declare a latency tier
- The platform uses it to assign priority, resources, and recovery order

## Consequences

- Domain config can no longer omit SLA and latency semantics
