# Phase 1a Foundation

## 1. Objectives

Establish a single-agent platform infrastructure closed loop, giving the system the minimum capabilities for executable, recoverable, approvable, billable, and observable operations.

## 2. Entry Conditions

- [document_readiness_review.md](../../reviews/document_readiness_review.md) shows `Phase 1a` as `ready`
- [phase_readiness_matrix.md](../../reviews/phase_readiness_matrix.md) shows `Phase 1a = ready`
- [operations-checklist.md](../operations-checklist.md) current phase items are signable
- [operations-checklist.md](../operations-checklist.md) items can be checked off one by one

## 3. Required Scope

- Directory skeletons for `src/`, `config/`, `divisions/`, `tests/`.
- Core types for tasks, workflows, approvals, events, and costs.
- SQLite single-machine storage, initial version.
- Single-agent happy path.
- Basic provider abstraction and tool execution abstraction.
- Edit tool three-layer replacement chain: exact match, whitespace normalization, indent normalization.
- Budget guard, approval guard, minimum recovery path.
- Test singleton reset infrastructure and fixture-only test baseline.
- `/healthz` baseline and minimal inspect query.

## 4. Non-Goals

- Multi-division parallel orchestration.
- Perception module.
- Complex memory extraction.
- Stage 2 compaction agent.
- Commercialization features.

## 5. Key Contracts / Main Documents

- [task_and_workflow_contract.md](../../contracts/task_and_workflow_contract.md)
- [runtime_state_machine_contract.md](../../contracts/runtime_state_machine_contract.md)
- [runtime_execution_contract.md](../../contracts/runtime_execution_contract.md)
- [storage_schema_contract.md](../../contracts/storage_schema_contract.md)
- [event_bus_contract.md](../../contracts/event_bus_contract.md)
- [policy_engine_contract.md](../../contracts/policy_engine_contract.md)
- [gap-analysis.md](../gap-analysis.md)
- [gap-analysis.md](../gap-analysis.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. Core Deliverables

- Phase 1a code skeleton.
- SQLite initial schema.
- Single-channel access capability.
- Test suite aligned with core contracts.

## 7. Acceptance and Exit Criteria

- Single-agent task success rate meets established baseline.
- Approval and recovery chains are verifiable.
- Cost records are traceable.
- Documentation and implementation have no significant conflicts.
- Modules involved in the current phase have met the "current-phase acceptable" standards in `operations-checklist.md`.
- Stable Core scope has not been implicitly breached; stability blockers have clear closure evidence.

## 8. Risks and Control Points

- Risk: Premature introduction of multi-agent, remote workers, complex memory.
- Control: Strictly close out via single-agent main chain; do not race ahead with subsequent phase capabilities.
- Risk: SQLite/single-machine design being mistaken for a long-term production solution.
- Control: Design interfaces still following PostgreSQL/queue semantics during implementation.

## 9. Hand-off to Next Phase

- Phase 1b can only be built on the premise that the 1a main chain is stable and status/recovery/approval are closed.
- Any incomplete items deemed "current-phase deferred" must remain on the roadmap; they must not implicitly drift into 1b.
