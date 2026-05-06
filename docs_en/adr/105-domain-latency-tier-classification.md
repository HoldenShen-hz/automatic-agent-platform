# ADR-105 Domain Latency Tier Classification

---

## OAPEFLIR Association

- **Observe**: Collect domain latency / SLA requirements
- **Assess**: Classify as ultra-low latency, real-time, near real-time, batch
- **Plan**: Allocate resources and scheduling strategy
- **Execute**: Run per latency tier
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

- Each domain must declare latency tier
- Platform allocates queue priority, resource pool, and recovery order accordingly

### Latency Tier Definition

| Tier | Target Latency | Typical Scenarios | Constraints |
|------|---------------|-------------------|-------------|
| Ultra-low latency (deterministic) | < 50ms P99 | Trading, Risk control | `deterministic_hot_path_only`: Cannot use LLM loop or Harness general path; must use independent deterministic execution path |
| Real-time | < 500ms P99 | Dialogue, Collaboration | Can use LLM, but needs budget cap |
| Near real-time | < 5s P99 | Analysis, Generation | Can use LLM + standard harness |
| Batch | Hour-level | Reporting, Training | No strict SLA requirement |

### v4.3 Non-Goal Boundary

The `deterministic_hot_path_only` constraint for ultra-low latency tier is a v4.3 mandatory boundary (§3.2). Domains violating this constraint cannot declare ultra-low latency tier and must downgrade to real-time or near real-time tier. Platform validates consistency between tier constraint declaration and actual capability during domain registration.

## Consequences

- Domain configuration no longer lacks SLA / latency dimension
- Ultra-low latency tier is subject to `deterministic_hot_path_only` mandatory constraint; v4.3 does not allow LLM/Harness loop path
