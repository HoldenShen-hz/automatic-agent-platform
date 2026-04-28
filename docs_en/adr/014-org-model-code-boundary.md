# ADR-014 Org Model Direct Mapping to Code Objects

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Automatic Agent uses anthropomorphic naming in its product narrative, such as CEO, VP, Lead, HR, and business division. This helps express system roles and collaboration methods. However, if these names directly enter code objects, protocol fields, and configuration primary keys, it increases implementation complexity and makes subsequent refactoring more susceptible to being driven by product copy.

Need to clarify:

- Whether product narrative naming and engineering naming have a one-to-one direct mapping.
- What naming should be authoritative at the code layer.

## Decision

Product narrative naming is preserved, but engineering implementation, configuration, and protocols prioritize canonical id.

Unified rules:

- External presentations, product materials, and onboarding documents may continue using business aliases.
- Configuration, contracts, APIs, state tables, events, and implementation code prioritize canonical id.
- Documents may use `canonical id + business alias` dual-layer naming.

## Alternatives

### Option A: Business Naming Directly Entering Code Objects

Pros:

- Most intuitive for product expression.

Costs:

- Engineering object naming is constrained by the narrative layer.
- As roles evolve, naming drift and unclear implementation responsibilities easily emerge.
- Abstractions like local sub-agent, remote worker, and workflow planner are harder to unify.

### Option B: Completely Remove Business Aliases

Pros:

- Most stable and clean engineering naming.

Costs:

- Unfriendly to business communication, roadmap expression, and role understanding.
- Weakens the system's "organized agent collaboration" product narrative.

### Option C: Current Decision

- Engineering layer canonical id is authoritative
- Business alias is preserved as narrative layer
- Documents allow dual-layer naming, but contracts/schemas only use canonical id as standard

## Reasons for Selecting This Option

- Balances product expression and engineering maintainability.
- Helps decouple organizational layer narrative from scheduling layer implementation.
- Reduces the amplification effect of "CEO/VP/Lead" naming on code complexity.

## Key Invariants

- Contracts, APIs, storage schemas, and event types must not use business alias as the sole primary key.
- Once canonical id enters implementation, it should remain stable.
- If documents use dual-layer naming, canonical id must come first or at least be clearly identifiable.
- Business alias changes must not force schema or core protocol renaming.

## Adoption Conditions

All current HQ / division / role naming should follow this rule, especially:

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## Exit Conditions

This decision has no "complete exit" goal, but if product narrative undergoes a major revision in the future, the canonical id layer should remain stable without needing to backfill business aliases into implementation primary keys.

## Implementation Impact

Current implementation and documentation requirements:

- Configuration files, events, and API return fields prioritize canonical id
- First occurrence in documentation may be written as `canonical id (business alias)`
- Runtime dispatch models should be named by responsibility rather than organizational title

## Results

Pros:

- Preserves expressiveness while controlling implementation complexity.
- Makes subsequent execution plane, policy engine, tool registry, and other technical layers easier to unify.
- Reduces engineering turbulence caused by product narrative changes.

Costs:

- Documentation and product materials need to maintain dual-layer mapping.
- New members need to first understand the correspondence between canonical id and alias.

## Cross-References

- [ADR-001 Three-Layer Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-015 Skill and Plugin Convergence to Single Marketplace](./015-unified-extension-marketplace.md)

## Source Sections

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
