# ADR-010 Commercial Model

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform's overall goal includes "profitable," but if only technical architecture is designed without defining commercialization path in advance, subsequent billing, permissions, marketplace, and tenant capabilities will be difficult to add.

## Decision

Incorporate commercial design into target architecture but clarify implementation pace:

- Phase 1-2: No charging, infrastructure maturity and user feedback as first priority.
- Phase 3: Validate PMF, launch Pro commercialization.
- Phase 4: Enter Enterprise, Marketplace, ecosystem, and industry solution phases.

## Commercial Positioning

Core positioning is not "AI programming tool" but:

- AI-driven universal automation company runtime.
- Programming is just one division.
- Any business that can be workflow-ized should have opportunity to connect to this platform.

## Commercial Units

Commercialization revolves around several types of units:

- Division: Revenue unit.
- Usage: Metered billing unit.
- Skill/Plugin: Ecosystem distribution unit.
- Deployment mode: Community, Professional, Enterprise differentiated units.

## Pricing and Pace

In principle adopt three-tier structure:

- Community: Low-barrier trial or BYOK.
- Pro: Small/medium teams and individual entrepreneurs.
- Enterprise: Private deployment, compliance, SSO, audit, and stronger quota control.

But constraints are important:

- Should not charge prematurely when infrastructure is immature.
- Pricing numbers should not be locked before market validation.
- Commercialization capabilities must land simultaneously with cost model, tenant isolation, security, and usage tracking.

## Commercialization Prerequisites

At least these technical prerequisites are needed:

- UsageMeter.
- QuotaManager.
- BillingEngine or equivalent billing infrastructure.
- Multi-tenant isolation.
- User experience observability and error friendliness.
- Compliance roadmap and enterprise security enhancement reservation.

## Results

Benefits:

- Commercialization is not an附加 layer but planned synchronously with cost, tenant, security, and channels.
- Can earlier identify which technical capabilities are prerequisites for commercialization.
- Reserved architecture space for Marketplace, industry solutions, and Enterprise capabilities.

Constraints:

- Phase 1-2 cannot be kidnapped by commercialization requirements.
- Pricing, compliance, and market strategy must retain adjustment space before real market validation.
- Any charging design must close the loop with real cost model.

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
