# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Collect domain latency / SLA requirements
- **Assess**: Classify as ultra-low latency, realtime, near-realtime, batch processing
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run by latency tier
- **Feedback**: Monitor breach and congestion
- **Learn**: Optimize resource pool allocation
- **Improve**: Adjust domain-level SLA
- **Release**: Latency tier enters domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Different domains have vastly different latency requirements; a unified scheduling strategy leads to resource waste or SLA failure.

## Decision

- Each domain must declare its latency tier
- Platform allocates queue priority, resource pool, and recovery order accordingly

## Consequences

- Domain configuration no longer lacks SLA / latency dimension
