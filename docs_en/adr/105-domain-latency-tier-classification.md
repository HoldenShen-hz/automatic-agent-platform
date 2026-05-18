# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Collect domain latency / SLA requirements
- **Assess**: Classify as ultra-low latency, real-time, near-real-time, batch
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run per latency tier
- **Feedback**: Monitor breach and congestion
- **Learn**: Optimize resource pool allocation
- **Improve**: Adjust domain-level SLA
- **Release**: latency tier enters domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Different domains have very different latency requirements; unified scheduling strategy leads to resource waste or SLA failure.

## Decision

- Each domain must declare latency tier
- Platform allocates queue priority, resource pool, and recovery order accordingly

## Consequences

- Domain configuration no longer lacks SLA / latency dimension
