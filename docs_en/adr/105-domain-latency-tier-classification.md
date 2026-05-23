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

Different domains have very different latency requirements, and unified scheduling strategy will lead to resource waste or SLA failure.

## Decision

- Each domain must declare latency tier
- Platform allocates queue priority, resource pool, and recovery order based on this
- `deterministic_hot_path_only` domains must not interpret latency tier as allowing entry into free LLM loop; LLM participation must maintain controlled boundaries
- This ADR only defines domain-level latency tier, and does not serve as authorization source for "automatic open LLM loop" outside v4.3 non-target boundaries

## Consequences

- Domain configuration no longer lacks SLA / latency dimension
