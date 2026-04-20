# Phase 2c Skills HR Evolution

## 1. Objectives

Supplement the platform's skill expansion, capability gap analysis, and limited evolution capabilities, while maintaining strong governance and rollback capability.

## 2. Entry Conditions

- 2b stability, audit, and governance chains are available
- Role versioning and skill registration boundaries have a source of truth
- High-risk changes have approval and rollback paths
- Before entering 2c, passed `documentation_completion_gate.md` current phase sign-off again

## 3. Required Scope

- Formalization of Skill system.
- HR Agent capability gap analysis and recommendation chain.
- Evolution engine MVP.
- Role versioning and change governance.

## 4. Non-Goals

- Unsupervised automatic privilege expansion.
- Unlimited self-replicating role growth.
- Full commercial ecosystem openness.

## 5. Key Contracts / Main Documents

- [tool_skill_plugin_contract.md](../../contracts/tool_skill_plugin_contract.md)
- [ecosystem_extension_plane_contract.md](../../contracts/ecosystem_extension_plane_contract.md)
- [adr/007-evolution-engine.md](../../adr/007-evolution-engine.md)
- [agent_contract.md](../../contracts/agent_contract.md)
- [module_acceptance_criteria_matrix.md](../module_acceptance_criteria_matrix.md)

## 6. Core Deliverables

- Skill registry and assembly documentation.
- HR Agent decision boundaries.
- Evolution proposal, approval, and application minimum closed loop.
- Phase 2c security review.

## 7. Acceptance and Exit Criteria

- New skills and role changes have approval chains.
- Evolution proposals are rollback-able and auditable.
- HR Agent does not cross governance boundaries.
- Modules involved in the current phase have met the "current-phase acceptable" standards in `module_acceptance_criteria_matrix.md`.

## 8. Risks and Control Points

- Risk: Skill / evolution becoming an implicit privilege expansion channel.
- Control: Any new capability must go through registration, approval, versioning, and rollback chain.
- Risk: HR Agent changing from advisor to automatic decider.
- Control: HR Agent only outputs proposals; it does not directly modify production configuration.

## 9. Hand-off to Next Phase

- Phase 3 takes over PMF, billing, and proactive capabilities; the enterprise full-scale complexity should not be introduced prematurely within 2c.
