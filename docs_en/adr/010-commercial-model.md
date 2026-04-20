# ADR-010 Commercial Model

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

The platform's overall goal includes "profitable," but if commercial path is not defined upfront, billing, permissions, marketplace, and tenant capabilities will be hard to add later.

## Decision

Incorporate commercial design into target architecture but clarify implementation rhythm:

- Phase 1-2: No charging; infrastructure maturity and user feedback are the first goal.
- Phase 3: Validate PMF; start Pro commercialization.
- Phase 4: Enter Enterprise, Marketplace, ecosystem, and industry solution stages.

## Commercial Positioning

Core positioning is not "AI programming tool" but:

- AI-driven general automation company runtime.
- Programming is just one division.
- Any business that can be workflow-ized should have opportunity to connect to this platform.

## Commercial Units

Commercialization revolves around several unit types:

- Division: Revenue unit.
- Usage: Metered billing unit.
- Skill/Plugin: Ecosystem distribution unit.
- Deployment mode: Community, Pro, Enterprise differentiated units.

## Pricing and Rhythm

Principle adopts a three-layer structure:

- Community: Low barrier trial or BYOK.
- Pro: Small/medium teams and individual entrepreneurs.
- Enterprise: Private deployment, compliance, SSO, audit, and stronger quota control.

But constraints are important:

- Should not charge prematurely when infrastructure is immature.
- Pricing numbers should not be locked before market validation.
- Commercialization capabilities must land synchronously with cost model, tenant isolation, security, and usage tracking.

## Commercialization Prerequisites

At minimum these technical prerequisites are needed:

- UsageMeter.
- QuotaManager.
- BillingEngine or equivalent billing infrastructure.
- Multi-tenant isolation.
- User-experience observability and user-friendly errors.
- Compliance roadmap and enterprise security enhancement reservation.

## Consequences

Advantages:

- Commercialization is not an additional layer but planned synchronously with cost, tenant, security, and channel.
- Can earlier identify which technical capabilities are commercialization prerequisites.
- Architecture space reserved for Marketplace, industry solutions, and Enterprise capabilities.

Constraints:

- Phase 1-2 cannot be kidnapped by commercialization requirements.
- Pricing, compliance, and market strategy must all retain adjustment room before real market validation.
- Any billing design must close the loop with real cost model.

## Cross-References

- [ADR-008 Cost Model](./008-cost-model.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [Quickstart](../guides/quickstart.md)

## Source Sections

- `§11`
- `§11.1`
- `§11.2`
- `§11.3`
- `§11.4`
- `§11.5`
- `§11.6`
- `§11.7`
- `§11.8`
- `§11.9`
- `§11.10`
- `§11.11`
- `§11.12`
