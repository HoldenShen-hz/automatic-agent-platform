# ADR-006 LLM Provider Strategy

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform includes headquarters roles, execution roles, review roles, and background tasks; different roles have very different quality, speed, and cost requirements. If which model to use is decided by LLM temporarily each time, it will bring uncontrollable costs and unexplainable behavior.

## Decision

Adopt a combined strategy of "model tier + Provider abstraction + rule selection":

- Use four tiers `reasoning`, `coding`, `balanced`, `fast` to describe capability layering.
- Role to tier mapping is declared at configuration layer, not re-judged by LLM at runtime.
- Unified Provider interface shields underlying vendor differences.
- Provider layer uniformly handles retry, backoff, failover, cache, and rate limiting.
- Further distinguish provider internal auth profile rotation and inter-provider model fallback.

## Model Tier Principles

Typical mapping:

- `reasoning`: High-quality judgment scenarios like CEO, Architect, Reviewer.
- `coding`: Execution-intensive scenarios like Developer, Data Engineer.
- `balanced`: Comprehensive balanced scenarios like PM, Tester, Researcher, VP Orchestration.
- `fast`: Low-cost scenarios like VP Operations fallback classification, proofreading, QA, compression.

Key constraints:

- Role to tier mapping must be configurable and auditable.
- Same-named tier in different versions can switch to different underlying models, but behavior should have regression verification.

## Provider Layer Responsibilities

Provider layer is not just "sending requests" but also needs unified handling of:

- Credential loading.
- Auth profile selection and rotation.
- Request/response adaptation.
- Retry and exponential backoff.
- Provider failover.
- Token counting and billing instrumentation.
- Prompt cache and response cache.

It is also recommended to maintain a unified provider/model metadata registry for carrying:

- capability labels
- context/output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

This registry should try to avoid scattering model capabilities across call sites through string matching hardcoding.

## Cost and Reliability

Provider strategy must collaborate with cost model:

- High-value roles use stronger models but unlimited upgrade is not allowed.
- Compression, fallback classification, and background organization prioritize cheaper models.
- Need clear rate limit strategy and daily budget strategy.

When LLM is unavailable:

- Allow failover to alternate provider.
- If completely unavailable, should pause task and notify user rather than blindly retry.
- When system enters degraded mode, only allow execution of capabilities not dependent on LLM.

Provider internal recommended rules:

- Multiple auth profiles of the same provider should support rotation order, cooldown, and temporary disabled state.
- Auto-selected profile can maintain stickiness by session to reduce cache churn.
- User-explicitly pinned profile has higher priority than auto-rotation, but when it fails, an auditable recovery path should still be provided.

## Cache Strategy

Cache is divided into at least three types:

- Layer 1 prompt static cache.
- Prompt caching.
- LLM response cache.

Goals:

- Reduce token waste from repeated contexts.
- Increase reuse rate for multi-Agent homogeneous tasks.
- Provide more stable foundation for cost prediction.

## Results

Benefits:

- Explainable, controllable, auditable.
- Easy to independently evolve tier selection for one class of roles.
- Not locked to single vendor, conducive to subsequent failover and enterprise deployment.

Constraints:

- Tier design must be maintained together with cost model, workflow path, and role responsibilities.
- New model onboarding needs regression runs, should not just replace strings.
- Provider abstraction should avoid only abstracting "least common denominator," otherwise high-value features will be lost.

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
