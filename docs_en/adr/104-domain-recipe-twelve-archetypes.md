# ADR-104: Domain Recipe Twelve Archetypes

---

## OAPEFLIR Relationship

- **Observe**: Aggregate 24-domain workflow patterns
- **Assess**: Consolidate into archetypes
- **Plan**: Generate baseline recipe for archetype
- **Execute**: Drive domain baseline creation
- **Feedback**: Validate archetype adoption rate
- **Learn**: Update archetype classification
- **Improve**: Reduce specialization cost
- **Release**: archetype becomes domain onboarding baseline asset

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Original recipe prototypes were too few to cover 24 vertical business domains.

## Decision

`DomainRecipe` expanded to twelve archetypes, covering CRUD, Analytics, Creative, Realtime, Trading, Compliance, Research, Adversarial, Moderation, Logistics, Conversational, IncidentOps.

Each archetype must trace back to `DomainDescriptor.recipe`, and cannot be disconnected from `DomainDescriptor` as a second set of domain onboarding metadata.

## Consequences

- 24-domain baseline has a unified and extensible recipe model