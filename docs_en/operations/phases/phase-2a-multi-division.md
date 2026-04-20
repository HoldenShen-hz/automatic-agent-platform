# Phase 2a Multi Division

## 1. Objectives

Verify that the platform is not a single programming tool, but a universal automation company runtime that can host multiple divisions.

## 2. Entry Conditions

- Phase 1b orchestration closed loop is stable
- Division / role / workflow basic loading chain is operational
- Artifact and recovery can support cross-division trace
- Before entering 2a, passed `documentation_completion_gate.md` current phase sign-off again

## 3. Required Scope

- Deployment verification with at least two or more divisions.
- Formal loading chain for `division.yaml`, role prompts, and workflow schema.
- SubAgent and artifact usage enhancement.
- Cross-task dependency and recovery enhancement.
- Stricter contract alignment testing.

## 4. Non-Goals

- Full perception module rollout.
- Enterprise privatization matrix.
- Marketplace.

## 5. Key Contracts / Main Documents

- [division_definition_contract.md](../../contracts/division_definition_contract.md)
- [project_structure_contract.md](../../contracts/project_structure_contract.md)
- [artifact_unified_model_contract.md](../../contracts/artifact_unified_model_contract.md)
- [guides/division-authoring.md](../../guides/division-authoring.md)
- [module_acceptance_criteria_matrix.md](../module_acceptance_criteria_matrix.md)

## 6. Core Deliverables

- Multi-division samples and real configurations.
- Division loader and validator.
- Artifact reference and traceability enhancement.
- Phase 2a acceptance report.

## 7. Acceptance and Exit Criteria

- Multi-division tasks execute stably.
- Division configuration additions require no core code changes.
- Recovery and traceability cover cross-division scenarios.
- Modules involved in the current phase have met the "current-phase acceptable" standards in `module_acceptance_criteria_matrix.md`.

## 8. Risks and Control Points

- Risk: "Multi-division" becoming a pile of hardcoded examples.
- Control: Must be based on declarative loading and validatable configuration.
- Risk: Artifact, sub-agent, and cross-task dependency semantics becoming confused.
- Control: Unify via artifact / execution / workflow contract.

## 9. Hand-off to Next Phase

- 2b takes over long-term stability, memory, and governance; it should not go back to fix basic division loader.
