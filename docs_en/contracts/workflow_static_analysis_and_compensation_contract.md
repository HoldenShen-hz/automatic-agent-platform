# Workflow Static Analysis And Compensation Contract

## 1. Scope

This contract defines static analysis rules for workflows before execution, compensation transaction boundaries, and long-task sharding and partial commit semantics.

Related documents:

- `task_and_workflow_contract.md`
- `workflow_io_compatibility_precheck_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `runtime_execution_contract.md`

## 2. Objectives

- Block obvious errors before execution, rather than exposing them during execution.
- Provide a formal compensation model for steps with side effects.
- Provide unified semantics for long tasks, subgraph recovery, and phased commits.

## 3. Minimum Static Analysis Checks

Before execution, must check at least:

- Infinite loop detection
- Unreachable step detection
- Dependency cycle detection
- Required input key missing
- Schema incompatibility
- Timeout / retry missing or illegal
- Step type and side effect level inconsistency
- Step ID uniqueness check
- Output key duplicate check
- Unknown dependency reference check
- Whether OAPEFLIR stage order is legal
- Whether plugin / domain tool bundle references exist
- Whether release rollback declares compensating_action or equivalent compensation strategy

## 4. Analysis Result Objects

- `WorkflowLintReport`
- `StaticCompatibilityIssue`
- `DependencyCycle`
- `CompensationPlan`
- `CheckpointPlan`
- `WorkflowTemplate`

## 5. Compensation Model

Each step with side effects must declare one of:

- `idempotent_replay`
- `compare_and_swap_write`
- `compensating_action`
- `manual_reconciliation_required`

Compensation action must at least explain:

- Trigger condition
- Compensation owner
- Compensation timeout
- Compensation idempotency
- Evidence artifact

## 6. Long-Task Sharding

Long tasks must support at least:

- Checkpoint sharding
- Subgraph recovery
- Phased commit
- Task-level partial commit

Rules:

- Checkpoints can only be established after side effect boundaries.
- Subgraph recovery must not cross steps with incomplete compensation.
- Partial commit must be auditable and traceable to corresponding step group.
- If an upstream step enters `failed` or `skipped` and dependencies cannot be re-satisfied, downstream steps must not indefinitely remain `blocked`; the system should have clear cascade-fail or cascade-skip semantics.

## 6.1 Templated Workflow / Recipe

If the system supports workflow / recipe templates, templates must explicitly declare:

- `version`
- `title`
- `description`
- `instructions`
- `parameters`
- `required_extensions_or_capabilities`
- `prompt_or_execution_entry`

Rules:

- Templates should not be just free-text prompts; parameters, extension dependencies, and execution entries must be structured.
- New templates should pass structural validation and minimum security scan before entering shared directory, marketplace, or team distribution.
- Template author guide should clarify: which fields are required, which extensions need trust confirmation, which parameters must be explicitly input.
- If the system simultaneously has server, web console, desktop, or other editing entries, template validation rules should be derived from a unified authoritative schema artifact as much as possible, rather than manually maintaining multiple parallel validation logics.
- `$ref`, composite types, and dependency fields in template schema should be consistently parsed across all entries, avoiding "server passes but editor fails" or vice versa.

## 7. Pre-Execution Gate

```mermaid
flowchart TD
    A["Load Workflow"] --> B["Static Analysis"]
    B --> C{"Blocking Issues?"}
    C -- "Yes" --> D["Reject Start"]
    C -- "No" --> E["Build Compensation / Checkpoint Plan"]
    E --> F["Create Execution Ticket"]
```

## 8. Phase Boundaries

Phase 1a:

- Key existence
- Dependency cycle
- Timeout / retry presence
- Side effect declaration required
- OAPEFLIR stage order validity

Phase 1b / 2:

- Unreachable step
- More complete schema compatibility
- Compensation templates
- Partial commit orchestration
- Release rollback orchestration

## 9. Closure Conclusion

Industrial-grade workflow cannot only "execute along the path".

It must know before starting:

- Whether structure is valid
- Which steps have side effects
- How to compensate after failure
- How to shard-recover long tasks
