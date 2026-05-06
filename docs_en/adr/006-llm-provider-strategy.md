# ADR-006 LLM Provider Strategy

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

The platform contains headquarters roles, execution roles, review roles, and background tasks. Different roles have vastly different quality, speed, and cost requirements. If which model to use is decided by LLM at runtime each time, it will bring uncontrollable costs and unexplainable behavior.

## Decision

Adopt a combined strategy of "model tier + Provider abstraction + rule-based selection":

- Use four tiers `reasoning`, `coding`, `balanced`, `fast` to describe capability layering.
- Role-to-tier mapping is declared at the configuration layer, not re-judged by LLM at runtime.
- Unify Provider interface to shield underlying vendor differences.
- Handle retry, backoff, failover, caching, and rate limiting uniformly at the Provider layer.
- Further distinguish provider-internal auth profile rotation from inter-provider model fallback.

## Model Tier Principles

Typical mapping:

- `reasoning`: High-quality judgment scenarios like CEO, Architect, Reviewer.
- `coding`: Execution-intensive scenarios like Developer, Data Engineer.
- `balanced`: Comprehensive balanced scenarios like PM, Tester, Researcher, VP Orchestration.
- `fast`: Low-cost scenarios like VP Operations fallback classification, proofreading, QA, compression.

Key constraints:

- Role-to-tier mapping must be configurable and auditable.
- Same-named tier can switch to different underlying models in different versions, but behavior should have regression verification.

## Provider Layer Responsibilities

Provider layer is not just "sending requests"; it also needs to uniformly handle:

- Credential loading.
- Auth profile selection and rotation.
- Request / response adaptation.
- Retry and exponential backoff.
- Provider failover.
- Token counting and billing embedding.
- Prompt caching and response caching.

It is also recommended to maintain a unified provider / model metadata registry to carry:

- capability labels
- context / output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

This registry should avoid scattering model capabilities across call sites through string matching hardcoding.

## Cost and Reliability

Provider strategy must coordinate with cost model:

- High-value roles use stronger models, but unlimited upgrades are not allowed.
- Compression, fallback classification, and background organization prefer cheaper models.
- Rate limit strategy and daily budget strategy must be clear.

When LLM is unavailable:

- Failover to backup provider is allowed.
- If completely unavailable, pause task and notify user rather than blindly retry.
- When system enters degraded mode, only safe capabilities not dependent on LLM are allowed.

Provider-internal recommended rules:

- Multiple auth profiles of the same provider should support rotation order, cooldown, and temporary disabled state.
- Auto-selected profile can maintain stickiness by session to reduce cache jitter.
- User-explicitly pinned profile has higher priority than auto-rotation, but when it fails, an auditable recovery path should still be provided.

## Caching Strategy

Caching is divided into at least three types:

- Layer 1 prompt static cache.
- Prompt caching.
- LLM response caching.

Goals:

- Reduce token waste from repeated context.
- Improve reuse rate of multi-agent homogeneous tasks.
- Provide a more stable foundation for cost prediction.

## Results

Advantages:

- Explainable, controllable, auditable.
- Easy to independently evolve tier selection for a certain class of roles.
- Does not lock into a single vendor, beneficial for future failover and enterprise deployment.

Constraints:

- Tier design must be maintained together with cost model, workflow path, and role responsibilities.
- New model integration requires regression testing, not just string replacement.
- Provider abstraction should avoid abstracting only the "least common denominator", otherwise high-value features will be lost.

## Cross References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-007 Evolution Engine](./007-evolution-engine.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

Note: After v4.3 migration, original §7.* section numbers have been restructured. This ADR's relevant content is now distributed across §15 (Model Gateway), §16 (Prompt Engineering), §22 (SDK and CLI).

v4.3 valid references:
- `§15.2` Model gateway routing and Provider abstraction
- `§16.2` Prompt lifecycle and caching
- `§22.1` SDK version handshake
