# ADR-014 Whether Organization Model Directly Maps to Code Objects

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-phase cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Automatic Agent uses anthropomorphic naming like CEO, VP, Lead, HR, and divisions in product narrative, which helps express system roles and collaboration methods. However, if these names directly enter code objects, protocol fields, and configuration primary keys, it will increase implementation complexity and make subsequent refactoring easier to be led by product copy.

Need to clarify:

- Whether product narrative naming and engineering naming are one-to-one direct mapping.
- What naming is authoritative at code layer.

## Decision

Product narrative naming preserved, but engineering implementation, configuration, and protocols prioritize canonical id.

Unified rules:

- External narration, product materials, and onboarding documentation may continue using business alias.
- Configuration, contract, API, state tables, events, and implementation code prioritize canonical id.
- Documentation allows `canonical id + business alias` dual naming.

## Alternatives

### Option A: Business Naming Directly into Code Objects

Benefits:

- Most intuitive for product expression.

Costs:

- Engineering object naming will be constrained by narrative layer.
- As roles evolve, naming drift and unclear implementation responsibilities easily occur.
- Abstracting local sub-agent, remote worker, workflow planner, etc. becomes harder to unify.

### Option B: Completely Remove Business Alias

Benefits:

- Most stable and clean engineering naming.

Costs:

- Unfriendly for business communication, roadmap expression, and role understanding.
- Will weaken the product narrative of "organized agent collaboration".

### Option C: Current Decision

- Engineering layer canonical id as authoritative
- Business alias preserved as narrative layer
- Documentation allows dual naming, but contract/schema only uses canonical id as standard

## Reasons for Choosing This Approach

- Balances product expression and engineering maintainability.
- Helps decouple organizational layer narrative from scheduling layer implementation.
- Reduces the amplification effect of "CEO/VP/Lead" naming on code complexity.

## Key Invariants

- Contract, API, storage schema, and event types must not use business alias as sole primary key.
- Once canonical id enters implementation, should remain stable.
- If documentation uses dual naming, canonical id must be first or at least clearly identifiable.
- Business alias changes must not force schema or core protocol renaming.

## Adoption Triggers

All current HQ/division/role naming should follow this rule, especially:

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## Exit Conditions

This decision has no "complete exit" goal, but if major product narrative redesign occurs in the future, should still keep canonical id layer stable, no need to flood business alias back into implementation primary keys.

## Implementation Impact

Current implementation and documentation requirements:

- Configuration files, events, and API return fields prioritize canonical id
- When documentation first appears, may write `canonical id (business alias)`
- Runtime dispatch model should name by responsibility rather than by organizational title

## Results

Benefits:

- Preserves expressiveness while suppressing implementation complexity.
- Makes subsequent technical layers like execution plane, policy engine, tool registry easier to unify.
- Reduces engineering turbulence from product narrative changes.

Costs:

- Documentation and product materials need to maintain dual mapping.
- New members need to first understand canonical id and alias correspondence.

## Cross-References

- [ADR-001 Three-Layer Distributed Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-015 Whether Skill and Plugin Converge to Single Marketplace](./015-unified-extension-marketplace.md)

## Source Sections

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
