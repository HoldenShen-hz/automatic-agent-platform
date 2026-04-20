# ADR-006 LLM Provider Strategy

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

The platform includes headquarters roles, execution roles, review roles, and background tasks. Quality, speed, and cost requirements vary greatly across roles. If the model is decided ad-hoc for each call, it brings uncontrollable costs and unexplainable behavior.

## Decision

Adopt a combined strategy of "model tier + provider abstraction + rule selection":

- Use `reasoning`, `coding`, `balanced`, `fast` four tiers to describe capability layering.
- Role-to-tier mapping is declared at the configuration layer, not re-judged by LLM at runtime.
- Unified provider interface shields underlying vendor differences.
- Provider layer uniformly handles retry, backoff, failover, caching, and rate limiting.
- Further distinguish provider-internal auth profile rotation and inter-provider model fallback.

## Model Tier Principles

Typical mapping:

- `reasoning`: High-quality judgment scenarios like CEO, architect, reviewer.
- `coding`: Execution-intensive scenarios like developer, data engineer.
- `balanced`: Comprehensive balanced scenarios like PM, tester, researcher, VP orchestration.
- `fast`: Low-cost scenarios like VP Operations fallback classification, proofreading, QA, compression.

Key constraints:

- Role-to-tier mapping must be configurable and auditable.
- Same-named tier in different versions can switch to different underlying models, but behavior should have regression validation.

## Provider Layer Responsibilities

Provider layer is not just "send request"; it also needs to uniformly handle:

- Credential loading.
- Auth profile selection and rotation.
- Request/response adaptation.
- Retry and exponential backoff.
- Provider failover.
- Token counting and billing instrumentation.
- Prompt cache and response cache.

It is also recommended to maintain a unified provider/model metadata registry to carry:

- capability labels
- context/output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

This registry should try to avoid scattering model capabilities across call sites via string matching and hardcoding.

## Cost and Reliability

Provider strategy must coordinate with cost model:

- High-value roles use stronger models but unlimited upgrades are not allowed.
- Compression, fallback classification, and background organization prioritize cheaper models.
- Rate limit strategy and daily budget strategy must be explicit.

When LLM is unavailable:

- Failover to alternate provider is allowed.
- If completely unavailable, pause task and notify user rather than blindly retrying.
- When system enters degraded mode, only allow execution of capabilities not dependent on LLM.

Intra-provider recommended rules:

- Multiple auth profiles within the same provider should support rotation order, cooldown, and temporary disabled state.
- Auto-selected profile can maintain session stickiness to reduce cache churn.
- User-explicitly pinned profile has higher priority than auto-rotation, but audit trail recovery path still needed on failure.

## Caching Strategy

Caching divides into at least three types:

- Layer 1 prompt static cache.
- Prompt caching.
- LLM response cache.

Goals:

- Reduce token waste from repeated context.
- Improve reuse rate for multi-agent homogeneous tasks.
- Provide more stable foundation for cost prediction.

## Consequences

Advantages:

- Explainable, controllable, auditable.
- Easy to independently evolve tier selection for a certain role class.
- Not locked to a single vendor; beneficial for future failover and enterprise deployment.

Constraints:

- Tier design must be maintained together with cost model, workflow paths, and role responsibilities.
- New model onboarding needs regression runs; should not just replace strings.
- Provider abstraction should avoid abstracting only the "least common denominator"; otherwise high-value features will be lost.

## Cross-References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-007 Evolution Engine](./007-evolution-engine.md)
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
