# ADR-008 Cost Model

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Multi-agent, multi-layer coordination, context compression, and background tasks introduce significant hidden costs. Only counting in-house execution costs at the business unit level systematically underestimates true expenses and misleads routing, budget, and commercialization judgments.

## Decision

Design cost control as a platform-level capability rather than a local optimization for individual roles:

- All paths use a unified cost model estimation: passthrough, fast, standard, full.
- Estimations must include hidden costs such as VP operations, VP orchestration, Lead, compression, cache invalidation, self-healing, and recovery.
- The system maintains hard limits per task, per day, and per month.
- When thresholds are reached, trigger pause, escalation, read-only, or circuit breaker.

## Cost Components

Must be divided into at least the following categories:

- Headquarters layer overhead: classification, splitting, aggregation, escalation.
- Business unit execution overhead: role invocation, testing, review, build.
- Self-healing overhead: retry, rework, remediation after loop detection.
- Background overhead: compression, cache invalidation, memory extraction, recovery.

Key conclusions:

- True end-to-end costs are usually higher than the intuitive estimate of in-house business unit costs.
- Hidden costs of cross-business unit full paths cannot be ignored.

## Control Methods

Core control approaches:

- Role-tiered model selection.
- Prompt and response caching.
- Repo Map and tools instead of large context reads.
- Routing tiers, prioritizing passthrough or lighter execution chains.
- Budget guards and cost kill switches.

Checkpoints:

- Is individual task within estimate?
- Is coordination layer overhead too high?
- Is self-healing cost controllable?
- Is prompt cache hit rate meeting target?
- Is passthrough hit rate sufficiently high?

## Commercialization Association

The cost model serves not only runtime but also commercialization:

- Used to determine free, professional, and enterprise tier boundaries.
- Used to support usage metering and quota.
- Used to constrain high-risk modes like full-auto.
- Used to determine which paths can be platform-subsidized by default and which must be BYOK.

## Results

Benefits:

- Cost becomes a first-class runtime signal rather than post-hoc statistics.
- User expectations and internal budget models can be established before commercialization.
- Provides foundation for future metering, billing, and package pricing.

Constraints:

- Budget control affects user experience and must be designed alongside HITL, notifications, and commercial policies.
- Each new category of background capability must update the cost waterfall synchronously.
- Estimation models must be continuously calibrated through real tasks.

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-010 Commercial Model](./010-commercial-model.md)

## Source Sections

- Section 7.2
- Section 7.2.1
- Section 7.2.2
- Section 7.3
- Section 11.3.1

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (such as Section 7.2, 7.3, 11.3.1 etc.), which have been updated to the correct section mappings in the actual architecture doc.
