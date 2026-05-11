# ADR-006 LLM Provider Strategy

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform includes headquarters roles, execution roles, review roles, and backend tasks, with vastly different quality, speed, and cost requirements across roles. If the LLM decides which model to use on-the-fly each time, it introduces uncontrollable costs and unexplainable behavior.

## Decision

Adopt a combined strategy of "model tiers + Provider abstraction + rule-based selection":

- Use four tiers — `reasoning`, `coding`, `balanced`, `fast` — to describe capability stratification.
- Role-to-tier mappings are declared at the configuration layer, not re-evaluated at runtime by the LLM.
- Unify Provider interfaces to mask underlying vendor differences.
- Handle retries, backoff, failover, caching, and rate limiting uniformly at the Provider layer.
- Further distinguish intra-provider auth profile rotation from inter-provider model fallback.

## Model Tiering Principles

Typical mappings:

- `reasoning`: High-quality judgment scenarios such as CEO, architects, Reviewers, etc.
- `coding`: Execution-intensive scenarios such as Developers, data engineers, etc.
- `balanced`: Comprehensive balanced scenarios such as PM, Testers, researchers, VP orchestration, etc.
- `fast`: Low-cost scenarios such as VP operations fallback classification, proofreading, QA, compression, etc.

Key constraints:

- Role-to-tier mappings must be configurable and auditable.
- The same named tier may switch to different underlying models across versions, but behavior should have regression verification.

## Provider Layer Responsibilities

The Provider layer is not just "sending requests"; it must also uniformly handle:

- Credential loading.
- Auth profile selection and rotation.
- Request / response adaptation.
- Retry with exponential backoff.
- Provider failover.
- Token counting and billing instrumentation.
- Prompt caching and response caching.

It is also recommended to maintain a unified provider / model metadata registry to carry:

- capability labels
- context / output limits
- pricing
- modalities
- auth methods
- status (`active | degraded | disabled | deprecated`)
- metadata source (`bundled_snapshot | local_override | remote_refresh`)

This registry should try to avoid scattering model capabilities across call sites via string-matching hardcoding.

## Cost and Reliability

Provider strategy must coordinate with the cost model:

- High-value roles use stronger models, but unlimited upgrades are not allowed.
- Compression, fallback classification, and backend organization prioritize cheaper models.
- Rate limit strategy and daily budget strategy must be clearly defined.

When LLM is unavailable:

- Failover to backup provider is allowed.
- If completely unavailable, suspend the task and notify the user instead of blindly retrying.
- When the system enters degraded mode, only safe capabilities that do not depend on LLM are allowed to execute.

Intra-provider recommended rules:

- Multiple auth profiles within the same provider should support rotation order, cooldown, and temporary disabled state.
- Auto-selected profiles can maintain stickiness per session to reduce cache churn.
- User-explicitly pinned profiles have higher priority than auto-rotation, but failures should still provide an auditable recovery path.

## Caching Strategy

Caching is divided into at least three categories:

- Layer 1 prompt static cache.
- Prompt caching.
- LLM response caching.

Goals:

- Reduce token waste from repetitive contexts.
- Improve reuse rate for multi-agent homogeneous tasks.
- Provide a more stable foundation for cost prediction.

## Results

Advantages:

- Explainable, controllable, and auditable.
- Facilitates independent evolution of tier selection for specific role categories.
- Does not lock into a single vendor, benefiting future failover and enterprise deployment.

Constraints:

- Tier design must be maintained together with cost model, workflow paths, and role responsibilities.
- New model onboarding requires running regression tests; string replacement alone is insufficient.
- Provider abstraction must avoid only abstracting the "least common denominator," otherwise high-value features will be lost.

## Cross References

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

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (such as `§7.1`/`§7.3`, etc.), which have now been updated to the correct section mappings in the architecture doc.
