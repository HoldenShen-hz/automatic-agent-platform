# Phase 3 PMF Commercialization

## 1. Objectives

Based on the stability of the first two phases, verify PMF, establish billing capabilities, and begin introducing proactive mode capabilities.

## 2. Entry Conditions

- 2a / 2b / 2c platform main chain, governance, and evolution boundaries are basically stable
- Skill, billing, tenant, and perception have upstream contracts
- Observability, metering, and product metrics chain are available
- Before entering 3, passed `documentation_completion_gate.md` current phase sign-off again

## 3. Required Scope

- Pro billing capabilities and plan boundaries.
- Perception module version 1.
- More complete Web / API user experience.
- Operations metrics, retention, conversion, and cost dashboards.
- Support for richer interactions and workspace experience.

## 4. Non-Goals

- Full enterprise ecosystem and marketplace fully open.
- Large-scale organizational governance all at once.

## 5. Key Contracts / Main Documents

- [billing_and_tenant_contract.md](../../contracts/billing_and_tenant_contract.md)
- [monetization_metering_plane_contract.md](../../contracts/monetization_metering_plane_contract.md)
- [perception_contract.md](../../contracts/perception_contract.md)
- [perception_intelligence_plane_contract.md](../../contracts/perception_intelligence_plane_contract.md)
- [license_and_capability_boundary_contract.md](../../contracts/license_and_capability_boundary_contract.md)
- [hitl_experience_and_explainability_contract.md](../../contracts/hitl_experience_and_explainability_contract.md)
- [module_acceptance_criteria_matrix.md](../module_acceptance_criteria_matrix.md)

## 6. Core Deliverables

- Billing plan and permission boundaries.
- Perception module MVP.
- PMF metrics tracking system.
- Phase 3 commercialization acceptance documentation.

## 7. Acceptance and Exit Criteria

- Paying users receive stable value.
- Unit economics model begins to hold.
- Perception module does not break main task chain stability.
- Modules involved in the current phase have met the "current-phase acceptable" standards in `module_acceptance_criteria_matrix.md`.

## 8. Risks and Control Points

- Risk: Billing capabilities not truly closed with runtime/entitlement.
- Control: Plans, metering, quota, and policy must be governed from the same source.
- Risk: Perception module directly polluting main task chain.
- Control: Perception defaults to proposing only; it does not directly modify task truth.

## 9. Hand-off to Next Phase

- Phase 4 takes over enterprise-level organizational governance, ecosystem, and scaled operations; enterprise full-scale complexity should not be introduced all at once within Phase 3.
