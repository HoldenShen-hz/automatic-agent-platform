# ADR-008 Cost Model

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Release state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Multi-agent, multi-layer coordination, context compression, and background tasks bring a large amount of hidden costs. Only counting in-division execution costs will systematically underestimate true overhead and mislead routing, budget, and commercialization decisions.

## Decision

Design cost control as a platform-level capability, not a local optimization of a single role:

- All paths use unified cost model estimation: `passthrough`, `fast`, `standard`, `full`.
- Estimation must include hidden costs of VP Operations, VP Orchestration, Lead, compression, cache invalidation, self-healing, and recovery.
- System maintains hard limits on single task, single day, and single month.
- When thresholds are reached, trigger pause, upgrade, read-only, or circuit break.

## Cost Composition

At least divided into the following categories:

- Headquarters layer overhead: classification, splitting, aggregation, escalation.
- Division execution overhead: role invocation, testing, review, building.
- Self-healing overhead: retry, rework, remediation after loop detection.
- Background overhead: compression, cache invalidation, memory extraction, recovery.

Key conclusions:

- True full-chain cost is usually higher than the intuitive estimate of "in-division cost".
- Hidden costs of cross-division full path cannot be ignored.

## Control Methods

Core control methods:

- Role tier-based model selection.
- Prompt / response caching.
- Repo Map and tools instead of large context reading.
- Tiered routing, prioritize hitting `passthrough` or lighter execution chain.
- Budget guard and cost kill switch.

Checkpoints:

- Does single task conform to estimate.
- Is coordination layer overhead too high.
- Is self-healing cost controllable.
- Is prompt cache hit rate up to standard.
- Is `passthrough` hit rate high enough.

## Commercialization Association

Cost model serves not only runtime but also commercialization:

- Used to determine free, pro, and enterprise boundaries.
- Used to support usage metering and quota.
- Used to constrain high-risk modes like full-auto.
- Used to determine which paths can be platform-paid by default and which must be BYOK.

## Results

Advantages:

- Cost becomes a first-class runtime signal, not post-hoc statistics.
- User expectations and internal budget models can be established before commercialization.
- Provides foundation for future metering billing and plan pricing.

Constraints:

- Budget control affects user experience and needs to be designed together with HITL, notifications, and commercial strategy.
- Every new background capability category requires synchronized update of cost waterfall.
- Estimation model must be continuously calibrated through real tasks.

## Cross References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

Note: After v4.3 migration, original §7.2/§7.3/§11.3.1 section numbers have been restructured. This ADR's relevant content is now distributed across §18 (Cost and Budget), §53 (Scale Ecosystem - Billing), §64 (Ops Maturity - Cost Optimization).

v4.3 valid references:
- `§18` Cost and budget model
- `§53.2` Multi-dimensional metering and quota
- `§64.1` Cost attribution decomposition
