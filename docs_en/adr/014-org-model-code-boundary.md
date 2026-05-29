# ADR-014 Whether Organization Model Directly Maps to Code Objects

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
- Decision Date: 2026-04-03

## Background

Automatic Agent uses anthropomorphic naming like CEO, VP, Lead, HR, Division in product narrative. This helps express system roles and collaboration methods. But if these names directly enter code objects, protocol fields, and configuration primary keys, it increases implementation complexity and makes subsequent refactoring more easily led by product text.

Need to clarify:

- Whether product narrative naming and engineering naming are one-to-one direct mapping.
- What naming is authoritative at code layer.

## Decision

Product narrative naming retained, but engineering implementation, configuration, and protocols priority use canonical id.

Unified rules:

- External presentations, product materials, and onboarding documents may continue using business aliases.
- Configuration, contracts, API, state tables, events, and implementation code priority use canonical id.
- Documentation allows `canonical id + business alias` dual naming.

## Alternative Options

### Option A: Business Naming Directly Enters Code Objects

Benefits:

- Most intuitive for product expression.

Costs:

- Engineering object naming constrained by narrative layer.
- As roles evolve, prone to naming drift and unclear implementation responsibilities.
- Abstractions like local sub-agent, remote worker, workflow planner harder to unify.

### Option B: Completely Remove Business Alias

Benefits:

- Most stable, cleanest engineering naming.

Costs:

- Unfriendly to business communication, roadmap expression, and role understanding.
- Weakens system "organized agent collaboration" product narrative.

### Option C: Current Decision

- Engineering layer canonical id as authoritative
- Business alias retained as narrative layer
- Documentation allows dual naming, but contracts/schemas only based on canonical id

## Reasons for This Choice

- Balances product expression and engineering maintainability.
-有利于把组织层叙事与调度层实现解耦.
- Reduces "CEO/VP/Lead" naming amplification effect on code complexity.

## Key Invariants

- Contracts, API, storage schemas, and event types must not use business alias as sole primary key.
- Once canonical id enters implementation, should remain stable.
- If documentation uses dual naming, canonical id must be first or at least clearly identifiable.
- Business alias changes must not force schema or core protocol renaming.

## Adoption Triggers

All HQ/division/role naming should comply with this rule, especially:

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## Exit Conditions

This decision has no "complete exit" goal. But if future product narrative undergoes major revision, should still keep canonical id layer stable, no need to backfill business alias into implementation primary keys.

## Implementation Impact

Current implementation and documentation requirements:

- Configuration files, events, and API return fields priority canonical id
- Documentation first occurrence may write `canonical id (business alias)`
- Runtime dispatch model should name by responsibility, not by organizational title

## Results

Benefits:

- Retains expressiveness while suppressing implementation complexity.
- Makes subsequent execution plane, policy engine, tool registry and other technical layers easier to unify.
- Reduces engineering turbulence from product narrative changes.

Costs:

- Documentation and product materials need maintain dual-layer mapping.
- New members need first understand canonical id and alias correspondence.

## Cross-References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-015 Whether Skill and Plugin Converge to Single Marketplace](./015-unified-extension-marketplace.md)

## Source Sections

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`