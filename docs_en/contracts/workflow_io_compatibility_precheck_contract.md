# Workflow IO Compatibility Precheck Contract

## 1. Scope

This contract defines workflow step input/output compatibility precheck rules before actual execution.

Related documents:

- `task_and_workflow_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `tool_and_provider_execution_contract.md`

## 2. Goals

Phase 1a / 1b minimum precheck goal is:

- Early discover missing or inconsistent step inter key.
- Block obvious schema incompatibility before actual execution.
- Separate current deterministic rule-only capability from future semantic precondition.

## 3. `WorkflowIoPrecheckResult`

| Field | Type | Description |
| --- | --- | --- |
| `workflow_id` | `string` | Workflow ID |
| `step_id` | `string` | Current step |
| `compatible` | `boolean` | Whether compatible |
| `missing_keys` | `string[]` | Missing key inputs |
| `unexpected_keys` | `string[]` | Extra key fields |
| `schema_version` | `string?` | Schema version participating in comparison |
| `reason_code` | `string?` | Incompatibility reason code |
| `checked_at` | `timestamp` | Check time |

## 4. Precheck Content

Current phase minimum checks:

- Required key exists
- Field type belongs to allowed set
- Previous step output schema version compatible with next step declaration
- Referenced tool / role available

Currently does not require:

- Whether natural language semantics truly "understood consistently"
- Complex cross-step business rule reasoning

## 5. Execution Timing

- Static precheck can be done after workflow creation
- Dynamic precheck based on current context must be done before step actually executes
- During recovery execution, if input snapshot has changed, must re-precheck

## 6. Failure Semantics

- Incompatibility should return `validation.schema_mismatch`
- Missing required key should return `validation.invalid_input`
- Precheck failure must not impersonate execution phase error

## 7. Boundary with Precondition

- This contract only covers deterministic rule-only checks
- Semantic precondition belongs to subsequent enhancement capability and must not impersonate Phase 1a / 1b availability

## 8. Closure Conclusion

Workflow IO precheck goal is not to be "completely smart" but to block the most common, cheapest-to-determine compatibility problems before execution.
