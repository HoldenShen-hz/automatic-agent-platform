# Workflow IO Compatibility Precheck Contract

## 1. Scope

This contract defines the input / output compatibility precheck rules for workflow steps before actual execution.

Related documents:

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. Goals

The minimum precheck goals for Phase 1a / 1b are:

- Discover missing keys or naming inconsistencies between steps as early as possible.
- Block obvious schema incompatibilities before actual execution.
- Separate the current deterministic rule-only capability from future semantic preconditions.

## 3. `WorkflowIoPrecheckResult`

| Field | Type | Description |
| --- | --- | --- |
| `workflow_id` | `string` | Workflow ID |
| `step_id` | `string` | Current step |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current loop stage |
| `compatible` | `boolean` | Whether compatible |
| `missing_keys` | `string[]` | Missing key inputs |
| `unexpected_keys` | `string[]` | Extra key fields |
| `schema_version` | `string?` | Schema version participating in comparison |
| `reason_code` | `string?` | Incompatibility reason code |
| `checked_at` | `timestamp` | Check time |

## 4. Precheck Content

At least check at the current phase:

- whether required keys exist
- whether field types belong to the allowed set
- whether the previous step's output schema version is compatible with the next step's declaration
- whether the referenced tool / role is available
- whether the OAPEFLIR stage transition is legal
- if `knowledge_namespace` is declared, whether the namespace exists and access is allowed
- if a plugin / domain tool bundle reference is declared, whether it is registered and matches the domain

Currently not required:

- whether the natural language semantics truly "understand consistently"
- complex cross-step business rule reasoning

## 5. Execution Timing

- After workflow creation, a static precheck can be performed once
- A dynamic precheck based on the current context must be performed again before the step is actually executed
- When resuming execution, if the input snapshot has changed, the precheck must be re-performed

## 6. Failure Semantics

- Incompatibility should return `validation.schema_mismatch`
- Missing required keys should return `validation.invalid_input`
- Precheck failure must not be disguised as an execution-stage error
- Illegal stage transition should return a stable reason code, e.g., `validation.invalid_stage_transition`

## 7. Boundary with Precondition

- This contract only covers deterministic rule-only checks
- Semantic precondition belongs to subsequent enhancement capabilities, and must not be pretended to be available in Phase 1a / 1b

## 8. Closure Conclusion

The goal of workflow IO precheck is not to be "completely smart", but to block the most common and cheapest-to-determine compatibility issues before execution.
