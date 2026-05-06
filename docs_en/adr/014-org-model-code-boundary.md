# ADR-014 Whether Org Model Directly Maps to Code Objects

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
- Decision Date: 2026-04-03

## Background

Automatic Agent uses anthropomorphic naming like CEO, VP, Lead, HR, and Division in product narrative, which helps express system roles and collaboration methods. But if these names directly enter code objects, protocol fields, and configuration primary keys, it will increase implementation complexity and make subsequent refactoring more easily led by product copy.

Need to clarify:

- Whether product narrative naming and engineering naming have a one-to-one direct mapping.
- What naming is authoritative at the code layer.

## Decision

Product narrative naming is retained, but engineering implementation, configuration, and protocols prioritize canonical id.

Unified rules:

- External narration, product materials, and onboarding documents can continue using business alias.
- Configuration, contract, API, status tables, events, and implementation code prioritize canonical id.
- Documents allow `canonical id + business alias` dual-layer naming.

## Alternative Solutions

### Solution A: Business Naming Directly into Code Objects

Advantages:

- Most intuitive for product expression.

Costs:

- Engineering object naming will be constrained by narrative layer.
- As roles evolve, naming drift and unclear implementation responsibilities easily appear.
- Local sub-agent, remote worker, and workflow planner abstractions become harder to unify.

### Solution B: Completely Remove Business Alias

Advantages:

- Most stable and clean engineering naming.

Costs:

- Unfriendly to business communication, roadmap expression, and role understanding.
- Will weaken the system's "organized agent collaboration" product narrative.

### Solution C: Current Decision Solution

- Engineering layer canonical id is authoritative
- Business alias retained as narrative layer
- Documents allow dual-layer naming, but contract / schema only based on canonical id

## Reasons for Choosing This Solution

- Balances product expression and engineering maintainability.
-有利于把组织层叙事与调度层实现解耦.
- Can reduce the amplification effect of "CEO/VP/Lead" naming on code complexity.

## Key Invariants

- contract, API, storage schema, and event types must not use business alias as sole primary key.
- Once canonical id enters implementation, should remain stable.
- If documents use dual-layer naming, canonical id must be first or at least clearly identifiable.
- Business alias changes must not force schema or core protocol renaming.

## Adoption Triggers

All current HQ / division / role naming should comply with this rule, especially:

- `intake_router`
- `workflow_planner`
- `division_lead`
- `strategic_governor`

## Exit Conditions

This decision does not have a "complete exit" goal, but if future product narrative undergoes major revision, should still keep canonical id layer stable, without needing to backfill business alias into implementation primary keys.

## Implementation Impact

Current implementation and documentation requirements:

- Configuration files, events, and API return fields prioritize canonical id
- When documents first appear, can write `canonical id (business alias)`
- Runtime dispatch model should be named by responsibility, not by organizational title

## Results

Advantages:

- Retains expressiveness while suppressing implementation complexity.
- Makes subsequent execution plane, policy engine, tool registry, and other technical layers easier to unify abstraction.
- Reduces engineering turbulence caused by product narrative changes.

Costs:

- Documentation and product materials need to maintain dual-layer mapping.
- New members need to first understand canonical id and alias correspondence.

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-015 Whether Skill and Plugin Converge to Single Marketplace](./015-unified-extension-marketplace.md)

## Source Sections

- `01_architecture_and_technical_design.md`
- `02_agents_governance_and_security.md`
