# ADR-104 Domain Recipe Twelve Archetypes

---

## OAPEFLIR Association

- **Observe**: Summarize 24 domain workflow patterns
- **Assess**: Merge into archetypes
- **Plan**: Generate baseline recipe for archetype
- **Execute**: Drive domain baseline creation
- **Feedback**: Verify archetype adaptation rate
- **Learn**: Update archetype classification
- **Improve**: Reduce specialization cost
- **Release**: Archetype becomes domain onboarding baseline asset

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Original recipe prototypes were too few to cover 24 vertical business domains.

## Decision

`DomainRecipe` expanded to twelve archetypes, covering CRUD, Analytics, Creative, Realtime, Trading, Compliance, Research, Adversarial, Moderation, Logistics, Conversational, IncidentOps.

Each archetype must eventually write back to `DomainDescriptor.recipe`, cannot become a second set of domain onboarding metadata disconnected from `DomainDescriptor`.

## Consequences

- 24 domain baseline has unified and extensible recipe model