# Workflow IO Compatibility Precheck Contract

## 1. Scope

This contract defines input/output compatibility precheck rules for workflow steps before actual execution.

Related documents:

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. Goals

Phase 1a / 1b minimum precheck goals:

- Detect missing keys or naming inconsistencies between steps as early as possible.
- Block obvious schema incompatibilities before actual execution.
- Separate current deterministic rule-only capability from future semantic precondition.

## 3. `WorkflowIoPrecheckResult`

| Field | Type | Description |
| --- | --- | --- |
| `workflow_id` | `string` | Workflow ID |
| `step_id` | `string` | Current step |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current loop stage |
| `compatible` | `boolean` | Whether compatible |
| `missing_keys` | `string[]` | Missing critical inputs |
| `unexpected_keys` | `string[]` | Extra critical fields |
| `schema_version` | `string?` | Schema version participating in comparison |
| `reason_code` | `string?` | Incompatibility reason code |
| `checked_at` | `timestamp` | Check time |

## 4. Precheck Content

Current phase minimum checks:

- Whether required keys exist
- Whether field types belong to the allowed set
- Whether the previous step output schema version is compatible with the next step declaration
- Whether referenced tools / roles are available
- Whether OAPEFLIR stage transitions are legal
- If `knowledge_namespace` is declared, whether its namespace exists and is accessible
- If plugin / domain tool bundle references are declared, whether they are registered and match the domain

Currently not required:

- Whether natural language semantics are truly "understood consistently"
- Complex cross-step business rule reasoning

## 5. Execution Timing

- One static precheck can be performed after workflow creation
- One dynamic precheck based on current context must be performed before step actual execution
- During recovery execution, if input snapshots have changed, precheck must be re-run

## 6. Failure Semantics

- Incompatibility should return `validation.schema_mismatch`
- Missing required keys should return `validation.invalid_input`
- Precheck failures must not be disguised as execution stage errors
- Illegal stage transitions should return stable reason codes, e.g. `validation.invalid_stage_transition`

## 7. Boundary with Precondition

- This contract only covers deterministic rule-only checks
- Semantic precondition belongs to subsequent enhanced capability and must not be pretended as available in Phase 1a / 1b

## 8. Closure Conclusion

The goal of workflow IO precheck is not to be "completely smart", but to block the most common, cheapest-to-determine compatibility issues before execution.