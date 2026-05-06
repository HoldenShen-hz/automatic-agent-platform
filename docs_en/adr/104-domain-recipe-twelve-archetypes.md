# ADR-104 Domain Recipe Twelve Archetypes

---

## OAPEFLIR Association

- **Observe**: Summarize 24-domain workflow patterns
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

## Context

The original recipe prototype was too few to cover 24 vertical business domains.

## Decision

`DomainRecipe` is expanded to twelve archetypes, covering CRUD, Analytics, Creative, Realtime, Trading, Compliance, Research, Adversarial, Moderation, Logistics, Conversational, and IncidentOps.

### Binding with DomainDescriptor.recipes

The twelve archetypes must be bound to the `DomainDescriptor.recipes` field (see ADR-081 §1 and ADR-100 §1), as a required extension point for domain onboarding. Each archetype must declare during domain registration:

- `archetype`: One of the twelve types
- `baselineRecipe`: The baseline recipe bundle for this archetype
- `adaptedDomains`: List of specific business domains covered by this archetype

### Integration with Four Phase Onboarding

Phase 1 (Modeling) and Phase 2 (Development) of domain onboarding (ADR-103 four-phase runbook) must complete archetype selection and baseline recipe binding before entering the certification phase. See ADR-081 §2 domain onboarding runbook for details.

### Default Mapping with ADR-105 Latency Tier

The twelve archetypes must also declare default `latency_tier` during domain registration to avoid recipes describing only workflow形态 without constraining execution latency boundaries. Recommended default mappings are as follows:

| Archetype | Default Latency Tier | Description |
|-----------|---------------------|-------------|
| CRUD | Near real-time | Read/write business usually responds in seconds |
| Analytics | Batch / Near real-time | Reporting and aggregation default to non-realtime hot path |
| Creative | Near real-time | Generation tasks allow LLM + standard harness |
| Realtime | Real-time | Interactive control plane and collaboration scenarios |
| Trading | Ultra-low latency (deterministic) or Real-time | If ultra-low latency is declared, must satisfy ADR-105's `deterministic_hot_path_only` |
| Compliance | Near real-time / Batch | Rule scanning and audit evaluation usually non-hot path |
| Research | Batch | Deep retrieval, analysis, and exploration default to offline-first |
| Adversarial | Near real-time | Adversarial evaluation and red team tasks need to preserve analysis chain |
| Moderation | Real-time | Content interception and security judgment need fast feedback |
| Logistics | Real-time / Near real-time | Scheduling and fulfillment tracking depends on scenario |
| Conversational | Real-time | Dialogue and collaboration default to <500ms P99 level |
| IncidentOps | Real-time / Near real-time | Alert handling prioritizes real-time, post-mortem analysis can degrade |

Rules:

- `DomainDescriptor.recipes[].archetype` and `latency_tier` must be registered simultaneously; cannot select recipe without declaring execution latency boundary.
- If archetype default mapping is `ultra-low latency (deterministic)`, the domain risk profile must simultaneously satisfy ADR-105's `deterministic_hot_path_only` constraint.
- When deviating from default mapping, must provide reason and supplementary guardrail in domain review to avoid mismatch between recipe selection and runtime capability.

## Consequences

- 24-domain baseline has a unified and extensible recipe model
- Archetype selection is a required step in domain onboarding, no longer optional
- Recipe archetype and latency tier form explicit binding, avoiding cross-ADR semantic discontinuities
