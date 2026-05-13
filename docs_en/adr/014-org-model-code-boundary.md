# ADR-014 Whether the Organization Model Maps Directly to Code Objects

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Automatic Agent uses personified naming in its product narrative, such as CEO, VP, Lead, HR, and business division, which helps express system roles and collaboration patterns. However, if these names directly enter code objects, protocol fields, and configuration primary keys, they increase implementation complexity and make subsequent refactoring more susceptible to being driven by product copy.

We need to clarify:

- Whether product narrative naming has a one-to-one direct mapping with engineering naming.
- Which naming convention is authoritative at the code layer.

## Decision

Product narrative naming is preserved, but engineering implementation, configuration, and protocols prioritize canonical id.

Unified rules:

- External presentations, product materials, and onboarding documents may continue using business aliases.
- Configuration, contracts, APIs, state tables, events, and implementation code prioritize canonical id.
- Documents may use `canonical id + business alias` dual-layer naming.

## Alternative Solutions

### Option A: Business Naming Directly Enters Code Objects

Advantages:

- Most intuitive for product expression.

Costs:

- Engineering object naming is constrained by the narrative layer.
- As roles evolve, naming drift and unclear implementation responsibilities are likely.
- Abstracting local sub-agents, remote workers, and workflow planners becomes more difficult.

### Option B: Completely Remove Business Aliases

Advantages:

- Engineering naming is most stable and clean.

Costs:

- Unfriendly to business communication, roadmap expression, and role understanding.
- Weakens the system's product narrative of "organized agent collaboration."

### Option C: Current Decision

- Engineering layer canonical id is authoritative
- Business alias is preserved as the narrative layer
- Documents allow dual-layer naming, but contracts/schemas use only canonical id as the standard

## Reasons for Selecting This Option

- Balances product expression and engineering maintainability.
- Facilitates decoupling of organizational layer narrative from scheduling layer implementation.
- Reduces the amplifying effect of "CEO/VP/Lead" naming on code complexity.

## Key Invariants

- Contracts, APIs, storage schemas, and event types must not use business alias as the sole primary key.
- Once canonical id enters implementation, it should remain stable.
- If documents use dual-layer naming, canonical id must come first or at least be clearly identifiable.
- Changes to business aliases must not force schema or core protocol renaming.

## Adoption Trigger Conditions

All current HQ/division/role naming should adhere to this rule, especially:

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## Exit Conditions

This decision does not have a "complete exit" goal, but if the product narrative undergoes major changes in the future, the canonical id layer should remain stable and there is no need to reintroduce business aliases into implementation primary keys.

## Implementation Impact

Current implementation and documentation requirements:

- Configuration files, events, and API return fields prioritize canonical id
- Documents may write `canonical id (business alias)` on first occurrence
- Runtime dispatch models should be named by responsibility, not by organizational title

## Results

Advantages:

- Preserves expressiveness while constraining implementation complexity.
- Makes it easier for subsequent technical layers such as execution plane, policy engine, and tool registry to unify abstractions.
- Reduces engineering turbulence caused by product narrative changes.

Costs:

- Documentation and product materials need to maintain dual-layer mappings.
- New members need to first understand the correspondence between canonical id and aliases.

## Cross-References

- [ADR-001 Three-Layer Separation of Powers Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-015 Convergence of Skills and Plugins into Single Marketplace](./015-unified-extension-marketplace.md)

## Source Sections

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
