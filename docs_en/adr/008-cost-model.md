# ADR-008 Cost Model

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-phase cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Multi-agent, multi-layer coordination, context compression, and background tasks bring large hidden costs. Only counting in-division execution costs systematically underestimates true overhead and misleads routing, budget, and commercialization judgments.

## Decision

Design cost control as a platform-level capability, not a local optimization of individual roles:

- All paths use a unified cost model estimate: `passthrough`, `fast`, `standard`, `full`.
- Estimates must include hidden costs of VP Operations, VP Orchestration, Lead, compression, cache invalidation, self-healing, and recovery.
- System maintains per-task, per-day, and per-month hard limits.
- On threshold breach, trigger pause, escalation, read-only, or circuit break.

## Cost Components

At minimum divided into these categories:

- Headquarters layer overhead: classification, splitting, aggregation, escalation.
- Division execution overhead: role invocation, testing, review, building.
- Self-healing overhead: retry, rework, remediation after loop detection.
- Background overhead: compression, cache invalidation, memory extraction, recovery.

Key conclusions:

- True end-to-end cost is usually higher than "division internal cost" intuition estimate.
- Hidden costs of cross-division full path cannot be ignored.

## Control Methods

Core control approaches:

- Role-tiered model selection.
- Prompt/response caching.
- Repo Map and tools replacing large context reads.
- Routing tiers; preferentially hitting `passthrough` or lighter execution chain.
- Budget guard and cost kill switch.

Checkpoints:

- Does per-task match estimate?
- Is coordination layer overhead too high?
- Is self-healing cost controllable?
- Is prompt cache hit rate up to standard?
- Is `passthrough` hit rate high enough?

## Commercialization Association

Cost model serves not just runtime but also commercialization:

- Used to determine free, Pro, and Enterprise boundaries.
- Used to support usage metering and quota.
- Used to constrain high-risk modes like full-auto.
- Used to judge which paths can default to platform payer and which must be BYOK.

## Consequences

Advantages:

- Cost becomes a first-class execution signal, not a post-hoc statistic.
- User expectations and internal budget models can be established before commercialization.
- Provides foundation for future metered billing and plan pricing.

Constraints:

- Budget control affects user experience; must be designed together with HITL, notifications, and commercial policy.
- Each new background capability category must update the cost waterfall synchronously.
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
