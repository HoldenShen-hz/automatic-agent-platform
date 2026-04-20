# ADR-008 Cost Model

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Multi-Agent, multi-layer coordination, context compression, and background tasks bring a lot of hidden costs. Only counting in-division execution costs will systematically underestimate true overhead and mislead routing, budget, and commercialization judgments.

## Decision

Design cost control as a platform-level capability rather than local optimization of a single role:

- All paths use unified cost model estimation: `passthrough`, `fast`, `standard`, `full`.
- Estimation must include hidden costs like VP Operations, VP Orchestration, Lead, compression, cache invalidation, self-healing, and recovery.
- System maintains single task, single day, and single month hard limits.
- When thresholds are reached, trigger pause, escalation, read-only, or circuit breaker.

## Cost Composition

At least divided into the following categories:

- Headquarters layer overhead: Classification, splitting, aggregation, escalation.
- Division execution overhead: Role invocation, testing, review, building.
- Self-healing overhead: Retry, rework, remediation after loop detection.
- Background overhead: Compression, cache invalidation, memory retrieval, recovery.

Key conclusions:

- True end-to-end cost is usually higher than the "in-division cost" intuitive estimate.
- Hidden costs of cross-division full path cannot be ignored.

## Control Methods

Core control methods:

- Role-tiered model selection.
- Prompt/response caching.
- Repo Map and tool substitution for large context reads.
- Routing tiers, prioritize `passthrough` or lighter execution chain.
- Budget guard and cost kill switch.

Checkpoints:

- Does single task match estimate?
- Is coordination layer overhead too high?
- Is self-healing cost controllable?
- Is prompt cache hit rate up to standard?
- Is `passthrough` hit rate high enough?

## Commercialization Association

Cost model serves not only runtime but also commercialization:

- Used to determine free, Pro, and Enterprise boundaries.
- Used to support usage metering and quota.
- Used to constrain high-risk modes like full-auto.
- Used to judge which paths can be platform-paid by default and which must be BYOK.

## Results

Benefits:

- Cost becomes a first-class runtime signal rather than post-hoc statistics.
- Can establish user expectations and internal budget models before commercialization.
- Provides foundation for future metered billing and package pricing.

Constraints:

- Budget control affects user experience and needs to be designed together with HITL, notifications, and commercial strategy.
- Each new type of background capability added must simultaneously update cost waterfall.
- Estimation model must be continuously calibrated through real tasks.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- `§7.2`
- `§7.2.1`
- `§7.2.2`
- `§7.3`
- `§11.3.1`
