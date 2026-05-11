# ADR-010 Commercial Model

---

## OAPEFLIR Correlation

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 types of feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform's overarching goal includes "profitable operations," but if we only design the technical architecture without defining the commercialization path in advance, subsequent billing, permissions, marketplace, and tenant capabilities will be difficult to integrate.

## Decision

Incorporate commercial design into the target architecture, but with a clear implementation cadence:

- Phase 1-2: No charging. Infrastructure maturity and user feedback are the primary goals.
- Phase 3: Validate PMF and launch Pro commercialization.
- Phase 4: Enter Enterprise, Marketplace, ecosystem, and industry solutions stages.

## Commercial Positioning

The core positioning is not an "AI programming tool," but rather:

- An AI-driven general-purpose automation company runtime.
- Programming is only one business unit.
- Any business that can be workflow-ized should have the opportunity to connect to this platform.

## Commercial Units

Commercialization revolves around several types of units:

- Business Unit: Revenue unit.
- Usage: Billing metering unit.
- Skill / Plugin: Ecosystem distribution unit.
- Deployment Mode: Community, Professional, and Enterprise editions as differentiated units.

## Pricing and Cadence

The principle is to adopt a three-tier structure:

- Community: Low-barrier trial or BYOK.
- Pro: Small/medium teams and individual entrepreneurs.
- Enterprise: Private deployment, compliance, SSO, audit, and stronger quota control.

But constraints are important:

- Charging should not be introduced prematurely before infrastructure is mature.
- Pricing figures should not be locked in before market validation.
- Commercialization capabilities must be implemented in tandem with cost models, tenant isolation, security, and usage tracking.

## Pre-commercialization Capabilities

At minimum, these technical prerequisites are required:

- UsageMeter.
- QuotaManager.
- BillingEngine or equivalent billing infrastructure.
- Multi-tenant isolation.
- User experience observability and error friendliness.
- Compliance roadmap and enterprise security enhancement provisions.

## Results

Pros:

- Commercialization is not an add-on layer, but is planned in sync with cost, tenant, security, and channels.
- Ability to identify earlier which technical capabilities are prerequisites for commercialization.
- Architecture space is reserved for Marketplace, industry solutions, and Enterprise capabilities.

Constraints:

- Phase 1-2 must not be held hostage by commercialization requirements.
- Pricing, compliance, and market strategy must all retain flexibility for adjustment before real market validation.
- Any charging design must be closed-loop with a real cost model.

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
