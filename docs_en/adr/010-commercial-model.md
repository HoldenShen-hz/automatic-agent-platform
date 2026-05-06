# ADR-010 Commercial Model

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

The platform's overall goal includes "profitable", but if we only design technical architecture without defining the commercialization path in advance, subsequent billing, permissions, marketplace, and tenant capabilities will be difficult to add.

## Decision

Incorporate commercial design into target architecture, but clarify implementation pace:

- Phase 1-2: No charging, infrastructure maturity and user feedback are the first goal.
- Phase 3: Verify PMF, start Pro commercialization.
- Phase 4: Enter Enterprise, Marketplace, ecosystem, and industry solutions stage.

## Commercial Positioning

Core positioning is not "AI programming tool", but:

- AI-driven general-purpose automation company runtime.
- Programming is just one division.
- Any business that can be workflow-ized should have the opportunity to connect to this platform.

## Commercial Units

Commercialization revolves around several types of units:

- Division: Revenue unit.
- Usage: Metering and billing unit.
- Skill / Plugin: Ecosystem distribution unit.
- Deployment mode: Community, Pro, Enterprise differentiated units.

## Pricing and Pace

In principle, adopt three-tier structure:

- Community: Low-barrier trial or BYOK.
- Pro: Small/medium teams and individual entrepreneurs.
- Enterprise: Private deployment, compliance, SSO, audit, and stronger quota control.

But constraints are important:

- Should not charge prematurely when infrastructure is immature.
- Pricing numbers should not be locked before market validation.
- Commercialization capabilities must land synchronized with cost model, tenant isolation, security, and usage tracking.

## Commercialization Prerequisites

At least these technical prerequisites are needed:

- UsageMeter.
- QuotaManager.
- BillingEngine or equivalent billing infrastructure.
- Multi-tenant isolation.
- User experience observability and user-friendly errors.
- Compliance roadmap and enterprise security enhancement reservation.

## Results

Advantages:

- Commercialization is not an additional layer, but planned synchronized with cost, tenant, security, and channel.
- Can earlier identify which technical capabilities are prerequisites for commercialization.
- Reserved architecture space for Marketplace, industry solutions, and Enterprise capabilities.

Constraints:

- Phase 1-2 cannot be kidnapped by commercialization requirements.
- Pricing, compliance, and market strategy must retain adjustment space before real market validation.
- Any charging design must close the loop with real cost model.

## Cross References

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
