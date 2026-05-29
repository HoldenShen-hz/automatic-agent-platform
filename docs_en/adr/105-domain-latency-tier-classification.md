# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Collect domain latency / SLA requirements
- **Assess**: Classify as ultra-low latency, real-time, near-real-time, batch processing
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run by latency tier
- **Feedback**: Monitor breach and congestion
- **Learn**: Optimize resource pool allocation
- **Improve**: Adjust domain-level SLA
- **Release**: Latency tier enters domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Different domains have vastly different latency requirements; unified scheduling strategy leads to resource waste or SLA failure.

## Decision

- Each domain must declare latency tier
- Platform allocates queue priority, resource pool, and recovery order accordingly
- `deterministic_hot_path_only` domain must not interpret latency tier as allowing entry into free LLM loop; LLM participation must maintain controlled boundary
- This ADR only defines domain-level latency tier, does not serve as source of authorization for "auto-open LLM loop" beyond v4.3 non-target boundary

## Consequences

- Domain configuration no longer missing SLA / latency dimension