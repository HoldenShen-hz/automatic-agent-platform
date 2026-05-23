# Workflow Static Analysis And Compensation Contract

## 1. Scope

This contract defines pre-execution static analysis rules for workflows, compensation transaction boundaries, and long-task segmentation with partial commit semantics.

Related documents:

- `task_and_workflow_contract.md`
- `workflow_io_compatibility_precheck_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `runtime_execution_contract.md`

## 2. Goals

- Catch obvious errors before execution, not expose them during execution.
- Provide a formal compensation model for steps with side effects.
- Provide unified semantics for long tasks, subgraph recovery, and phased commits.

## 3. Static Analysis Minimum Checks

At least the following must be checked before execution:

- Infinite loop detection
- Unreachable node detection
- Dependency cycle detection
- Missing required input keys
- Schema incompatibility
- Missing or illegal timeout / retry
- Node type and side effect level inconsistency
- Node ID uniqueness check
- Output key duplicate check
- Unknown dependency reference check
- OAPEFLIR stage order validity
- Plugin / domain tool bundle reference existence
- Release rollback declares compensating_action or equivalent compensation strategy

## 4. Analysis Result Objects

- `WorkflowLintReport`
- `StaticCompatibilityIssue`
- `DependencyCycle`
- `CompensationPlan`
- `CheckpointPlan`
- `WorkflowTemplate`

v4.3 alignment notes:

- On the code side, `StaticCompatibilityIssue` is now exported as the canonical compatibility alias of `WorkflowLintIssue`, for contract call surfaces to directly consume issue arrays.
- On the code side, `WorkflowTemplate` is now exported as the compatibility alias of `MinimalWorkflowDefinition`, pointing uniformly to the authoritative workflow definition structure in the repository, rather than maintaining a second separate template entity.

## 5. Compensation Model

Each node with side effects must declare one of the following:

- `idempotent_replay`
- `compare_and_swap_write`
- `compensating_action`
- `manual_reconciliation_required`

Compensation actions must at least specify:

- Trigger condition
- Compensation owner
- Compensation timeout
- Compensation idempotency
- Evidence artifact

## 6. Long Task Segmentation

Long tasks must support at least:

- Checkpoint segmentation
- Subgraph recovery
- Phased commits
- Task-level partial commit

Rules:

- Checkpoints can only be established after side effect boundaries.
- Subgraph recovery must not cross nodes with incomplete compensation.
- Partial commits must be auditable and traceable to corresponding node groups.
- If an upstream node enters `failed` or `skipped` and dependencies can no longer be satisfied, downstream nodes must not remain in `blocked` indefinitely; the system should have clear cascade-fail or cascade-skip semantics.

## 6.1 Templated Workflow / Recipe

If the system supports workflow / recipe templates, templates must explicitly declare at least:

- `version`
- `title`
- `description`
- `instructions`
- `parameters`
- `required_extensions_or_capabilities`
- `prompt_or_execution_entry`

Rules:

- Templates must not be free-text prompts only; parameters, extension dependencies, and execution entry must be structured.
- New templates must pass structural validation and minimum security scan before entering shared directories, marketplaces, or team distribution.
- Template author guidelines must clarify: which fields are required, which extensions require trust confirmation, which parameters must be explicitly input.
- If the system simultaneously has server, web console, desktop, or other editing entry points, template validation rules should be derived from a unified authoritative schema artifact as much as possible, rather than manually maintaining multiple parallel validation logics.
- `$ref`, composite types, and dependency fields in template schemas must be consistently parsed across all entry points, avoiding "server passes but editor fails" or vice versa.

## 7. Pre-execution Gate

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

- Unreachable node
- More complete schema compatibility
- Compensation templates
- Partial commit orchestration
- Release rollback orchestration

## 9. Closure Conclusion

Industrial-grade workflows cannot just "run along".

They must know before starting:

- Whether structure is valid
- Which nodes have side effects
- How to compensate after failure
- How to segment and recover long tasks