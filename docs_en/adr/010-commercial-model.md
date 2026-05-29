# ADR-010 Commercial Model

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

The platform's overall goal includes "profitability", but if only designing technical architecture without defining commercialization path in advance, subsequent billing, permissions, marketplace, and tenant capabilities will be difficult to add.

## Decision

Incorporate commercial design into target architecture, but clarify implementation节奏:

- Phase 1-2: No charging, infrastructure maturity and user feedback as first goal.
- Phase 3: Validate PMF, start Pro commercialization.
- Phase 4: Enter Enterprise, Marketplace, ecosystem, and industry solutions stage.

## Commercial Positioning

Core positioning is not "AI programming tool", but:

- AI-driven general automation company runtime.
- Programming is just one division.
- Any workflow-decomposable business should have opportunity to connect to this platform.

## Commercial Units

Commercialization revolves around several unit types:

- Division: Revenue unit.
- Usage: Metering billing unit.
- Skill/Plugin: Ecosystem distribution unit.
- Deployment mode: Community, professional, enterprise differentiation units.

## Pricing and Rhythm

In principle adopt three-layer structure:

- Community: Low barrier trial or BYOK.
- Pro: Small/medium teams and individual entrepreneurs.
- Enterprise: Private deployment, compliance, SSO, audit, and stronger quota control.

But constraints are important:

- Should not charge prematurely when infrastructure is immature.
- Pricing numbers should not be locked before market verification.
- Commercialization capabilities must synchronize with cost model, tenant isolation, security, and usage tracking landing.

## Commercialization Prerequisites

At minimum need these technical prerequisites:

- UsageMeter.
- QuotaManager.
- BillingEngine or equivalent billing infrastructure.
- Multi-tenant isolation.
- User-experience observability and error friendliness.
- Compliance roadmap and enterprise security enhancement reservation.

## Results

Benefits:

- Commercialization is not an附加 layer, but planned synchronously with cost, tenant, security, and channels.
- Can earlier identify which technical capabilities are prerequisites for commercialization.
- Reserved architectural space for Marketplace, industry solutions, and Enterprise capabilities.

Constraints:

- Phase 1-2 cannot be kidnapped by commercialization requirements.
- Pricing, compliance, and market strategy must retain adjustment space before real market verification.
- Any charging design must form a closed loop with real cost model.

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