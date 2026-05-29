# ADR-008 Cost Model

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Multi-Agent, multi-layer coordination, context compression, and background tasks bring large amounts of hidden costs. Only counting in-division execution costs systematically underestimates true spending, and misleads routing, budget, and commercialization judgments.

## Decision

Design cost control as a platform-level capability, not a local optimization of individual roles:

- All paths use unified cost model estimation: `passthrough`, `fast`, `standard`, `full`.
- Estimation must include hidden costs of VP Operations, VP Orchestration, Lead, compression, cache invalidation, self-healing, and recovery.
- System maintains hard limits per task, per day, and per month.
- When threshold is reached, trigger pause, escalation, read-only, or circuit break.

## Cost Composition

At minimum divided into the following categories:

- Headquarters layer overhead: Classification, decomposition, aggregation, escalation.
- Division execution overhead: Role calls, testing, review, building.
- Self-healing overhead: Retry, rework, remediation after loop detection.
- Background overhead: Compression, cache invalidation, memory extraction, recovery.

Key conclusions:

- True full-chain cost is usually higher than "in-division cost" intuition estimate.
- Hidden costs of cross-division full path cannot be ignored.

## Control Methods

Core control methods:

- Role-tiered model selection.
- Prompt/response caching.
- Repo Map and tool substitution for large context reading.
- Route classification, prioritize hitting `passthrough` or lighter execution chain.
- Budget guard and cost kill switch.

Checkpoints:

- Does single task match estimate.
- Is coordination layer overhead too high.
- Is self-healing cost controllable.
- Is prompt cache hit rate up to standard.
- Is `passthrough` hit rate high enough.

## Commercialization Association

Cost model serves not only runtime but also commercialization:

- Used to determine free, professional, and enterprise boundaries.
- Used to support usage metering and quota.
- Used to constrain high-risk modes like full-auto.
- Used to judge which paths can be platform-paid by default, which must be BYOK.

## Results

Benefits:

- Cost becomes a first-class runtime signal, not post-hoc statistics.
- Can establish user expectations and internal budget model before commercialization.
- Provides foundation for future metering billing and package pricing.

Constraints:

- Budget control affects user experience, needs to be designed together with HITL, notifications, and commercial strategy.
- Every new background capability added needs to synchronously update cost waterfall.
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

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (e.g., `§7.2`/`§7.3`/`§11.3.1`). It has now been updated with correct section mappings from the actual architecture document.