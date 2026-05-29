# ADR-006 LLM Provider Strategy

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

The platform contains headquarters roles, execution roles, review roles, and background tasks. Different roles have vastly different quality, speed, and cost requirements. If LLM decides which model to use on-the-fly each time, it brings uncontrollable costs and unexplainable behavior.

## Decision

Adopt a combined strategy of "model tier + provider abstraction + rule selection":

- Use four tiers `reasoning`, `coding`, `balanced`, `fast` to describe capability layering.
- Role-to-tier mapping is declared at the configuration layer, not re-judged by LLM at runtime.
- Unified Provider interface shields underlying vendor differences.
- Provider layer uniformly handles retry, backoff, failover, cache, and rate limiting.
- Further distinguish provider-internal auth profile rotation vs inter-provider model fallback.

## Model Tier Principles

Typical mappings:

- `reasoning`: High-quality judgment scenarios like CEO, architect, reviewer.
- `coding`: Execution-intensive scenarios like developer, data engineer.
- `balanced`: Comprehensive balance scenarios like PM, tester, researcher, VP Orchestration.
- `fast`: Low-cost scenarios like VP Operations fallback classification, proofreading, QA, compression.

Key constraints:

- Role-to-tier mapping must be configurable and auditable.
- Same-named tier in different versions may switch to different underlying models, but behavior should have regression verification.

## Provider Layer Responsibilities

Provider layer is not just "sending requests", but also uniformly handles:

- Credential loading.
- Auth profile selection and rotation.
- Request/response adaptation.
- Retry and exponential backoff.
- Provider failover.
- Token counting and billing embedding.
- Prompt cache and response cache.

It is also recommended to maintain a unified provider/model metadata registry for carrying:

- Capability labels
- Context/output limits
- Pricing
- Modalities
- Auth methods
- Status (`active | degraded | disabled | deprecated`)
- Metadata source (`bundled_snapshot | local_override | remote_refresh`)

This registry should avoid scattering model capabilities across call sites via string matching hardcoding.

## Cost and Reliability

Provider strategy must collaborate with cost model:

- High-value roles use stronger models, but unlimited upgrades are not allowed.
- Compression, fallback classification, and background organization prefer cheaper models.
- Explicit rate limit strategy and daily budget strategy needed.

When LLM is unavailable:

- Allow failover to backup provider.
- If completely unavailable, should pause task and notify user, not blindly retry.
- When system enters degraded mode, only allow execution of capabilities that do not depend on LLM.

Intra-provider recommendations:

- Multiple auth profiles under same provider should support rotation order, cooldown, and temporary disabled state.
- Auto-selected profile can maintain stickiness per session to reduce cache churn.
- User-explicitly pinned profile has higher priority than auto-rotation, but still should provide auditable recovery path when failing.

## Cache Strategy

Cache is divided into at least three types:

- Layer 1 prompt static cache.
- Prompt caching.
- LLM response cache.

Goals:

- Reduce token waste from repeated contexts.
- Improve reuse rate for multi-agent isomorphic tasks.
- Provide more stable foundation for cost prediction.

## Results

Benefits:

- Explainable, controllable, auditable.
- Easy to individually evolve tier selection for one class of roles.
- Not locked to single vendor, beneficial for subsequent failover and enterprise deployment.

Constraints:

- Tier design must be maintained together with cost model, workflow paths, and role responsibilities.
- New model onboarding needs regression testing, not just string replacement.
- Provider abstraction should avoid abstracting only "least common denominator", otherwise high-value features will be lost.

## Cross-References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-007 Evolution Engine](./007-evolution-engine.md) (rollout/release semantics partially superseded by ADR-075)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `§7.1`
- `§7.3`
- `§7.3.1`
- `§7.3.2`
- `§7.3.3`
- `§7.4`
- `§7.4.1`
- `§7.5`
- `§7.6`

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (e.g., `§7.1`/`§7.3`). It has now been updated with correct section mappings from the actual architecture document.