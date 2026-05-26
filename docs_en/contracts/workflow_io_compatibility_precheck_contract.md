# Workflow IO Compatibility Precheck Contract

## 1. Scope

This contract defines input/output compatibility precheck rules for workflow steps before actual execution.

Related documents:

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. Goals

Phase 1a / 1b minimum precheck goals:

- Detect missing or inconsistently named keys between steps early.
- Block obvious schema incompatibilities before actual execution.
- Separate current deterministic rule-only capability from future semantic precondition.

## 3. `WorkflowIoPrecheckResult`

| Field | Type | Description |
| --- | --- | --- |
| `workflow_id` | `string` | Workflow ID |
| `step_id` | `string` | Current step |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current closed-loop stage |
| `compatible` | `boolean` | Whether compatible |
| `missing_keys` | `string[]` | Missing key inputs |
| `unexpected_keys` | `string[]` | Extra key fields |
| `schema_version` | `string?` | Schema version participating in comparison |
| `reason_code` | `string?` | Incompatibility reason code |
| `checked_at` | `timestamp` | Check time |

## 4. Precheck Content

Current phase minimum checks:

- Required key existence
- Field type belongs to allowed set
- Previous step output schema version is compatible with next step declaration
- Referenced tool / role is available
- OAPEFLIR stage transition is legal
- If `knowledge_namespace` is declared, its namespace exists and access is allowed
- If plugin / domain tool bundle reference is declared, it is registered and matches the domain

Currently not required:

- Natural language semantic "understanding consistency"
- Complex cross-step business rule reasoning

## 5. Execution Timing

- Static precheck can be done once after workflow creation
- Dynamic precheck based on current context must be done before step actually executes
- When resuming execution, if input snapshot has changed, precheck must be rerun

## 6. Failure Semantics

- Incompatibility should return `validation.schema_mismatch`
- Missing required key should return `validation.invalid_input`
- Precheck failure must not be disguised as execution stage error
- Illegal stage transition should return stable reason code, e.g., `validation.invalid_stage_transition`

## 7. Boundary with Precondition

- This contract only covers deterministic rule-only checks
- Semantic precondition belongs to subsequent enhancement capability and must not be pretended as available in Phase 1a / 1b

## 8. Closure Conclusion

The goal of workflow IO precheck is not to be "completely smart", but to block the most common, cheapest-to-determine compatibility issues before execution.