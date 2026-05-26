# Cost And Budget Contract

> **v4.3 Compatibility Note**: This file is preserved as historical cost and budget documentation. v4.3 budget truth is based on [budget-ledger-contract.md](./budget-ledger-contract.md); cost reports, token counter, and `actual_cost_usd` can only be used as projection / report fields.

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines cost estimation, real-time cost recording, budget thresholds, and circuit breaker rules.

## 2. Key Objects

- `CostEstimate`
- `CostEvent`
- `BudgetPolicy`
- `CostKillSwitch`

## 3. BudgetPolicy Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `max_cost_usd` | `number` | Total cost ceiling for this run |
| `max_model_tokens` | `number` | Model token total ceiling |
| `max_context_tokens` | `number` | Input context token ceiling |
| `max_output_tokens` | `number` | Output token ceiling |
| `max_steps` | `number` | Maximum allowed node completion count |
| `max_node_runs` | `number` | Maximum allowed NodeRun creation count |
| `max_duration_ms` | `number` | Total runtime duration ceiling |
| `warn_at_ratio` | `number` | Warning threshold |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Runtime mode when budget is active (orthogonal to sandbox isolation level) |
| `rollout_guard` | `no_rollout \| approval_required \| rollout_allowed` | Release protection when budget exceeds threshold |
| `sandbox_policy_mode` | `read_only \| workspace_write \| scoped_external_access \| restricted_exec` | Execution sandbox isolation level (orthogonal to runtime_mode; when combined, must be validated for legality via PolicyEngine) |

Compatibility notes:

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` are only allowed as billing / accounting projection guardrail, no longer as runtime canonical `BudgetPolicy` minimum field.

## 4. CostEvent Minimum Fields

- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `session_id?`
- `agent_id?`
- `stage?`
- `provider`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `budget_reservation_id`
- `created_at`

Rules:

- `harness_run_id` is the budget subject association key (required).
- `task_id` is only used for legacy traceability queries and must not be used as the primary budget judgment key.
- `budget_reservation_id` associates the cost to the BudgetReservation to which it belongs, and must be filled when entering budget settlement chain.
- CostEvent must not use deprecated legacy execution keys; cost attribution must be associated to `harness_run_id / node_run_id / attempt_id`.

## 5. Behavioral Constraints

- Cost records should be as close to the actual call point as possible.
- Budget judgment should not only look at a single call, but at cumulative value, and align with `BudgetLedger / BudgetReservation / BudgetSettlement` truth.
- After triggering threshold, there must be explicit action: alert, approval, pause, or circuit break.

## 6. Association Scope

Cost must cover at minimum:

- HQ layer calls.
- Business division execution.
- Self-healing retry.
- Compaction and background tasks.
- Observe / Assess / Plan / Feedback / Learn / Improve / Release stage calls.
- Node retry, tool calls, side effect confirmation, and human review calls.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Minimum context, minimum governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning + standard governance chain
- `full`: Deep reasoning + extended context + complete governance chain

Rules:

- Each template must bind default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

`CostEvent` extended fields must include at minimum:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `budget_reservation_id`
- `pricing_version`

### 7.3 BYOK Differentiation

- In BYOK scenario, should differentiate "platform governance cost" and "user-provided model call cost".
- Platform payment and BYOK must not be mixed in the same billing metric.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, must not be treated as "free" background behavior:

| Operation | Attribution Rule (v4.3 canonical) | CostEvent Annotation |
| --- | --- | --- |
| Context compaction (compaction stage 2 summarize) | Attributed to the harness run that triggered compaction | `budget_scope: compaction`, associated `harness_run_id` (legacy can trace `task_id`) |
| Skill cache miss followed by model call | Attributed to the harness run and node run that triggered skill execution | `budget_scope: skill_execution`, associated `harness_run_id / node_run_id` |
| Self-healing / recovery retry | Attributed to original harness run (not new recovery task) | `budget_scope: recovery_retry`, associated original `harness_run_id` and `node_run_id / attempt_id` |
| Guardian / reviewer subagent reasoning | Attributed to the harness run that triggered approval | `budget_scope: approval_review`, associated `approval_id`, `harness_run_id` |

Rules:

- Implicit costs must participate in budget threshold judgment and must not bypass `BudgetPolicy` cumulative check.
- All cost attribution associations must use `harness_run_id / node_run_id / attempt_id` and must not use deprecated legacy execution keys.
- `task_id` is only a legacy traceability field and must not participate in budget judgment logic.
- Skill cache hit does not generate model call cost, but cache storage and lookup computational cost is not counted into token budget.
- If compaction cost causes run to exceed `max_cost_usd`, should trigger the same threshold action as normal model calls (alert, approval, or circuit break), must not silently pass.
- CostEvent's `budget_scope` field must differentiate the above scenarios so that cost reports can be aggregated by source dimension.

Supplementary notes:

- Token budget granular allocation is based on the drilling document `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` must support at minimum:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically layerable.
- Implicit model costs such as Knowledge retrieval, Learn generation, Improve evaluation, and Release trial run must not all be mixed into a single execute cost bucket.
- When stage cost exceeds threshold, must trigger alert, approval, or circuit break semantics consistent with normal model calls.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-41: This document originally reduced `BudgetPolicy` to three financial thresholds `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd`. Root cause: cost contract followed billing/statement metric and did not upgrade along with v4.3 runtime budget guard becoming multi-dimensional budget constraint. Fix: The body now changes canonical `BudgetPolicy` to `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`, and old daily/monthly statistics are retained only as billing projection guardrail.
- T-15: Original `CostEvent` had `task_id` as required but `harness_run_id` as optional, reversing the budget subject hierarchy. Fix: `harness_run_id` is changed to required, and `task_id` is demoted to optional legacy traceability field.
- T-16: Implicit cost attribution rules still referenced deprecated old execution keys, not aligned with `node_run_id/attempt_id`. Fix: Attribution rules comprehensively changed to use `harness_run_id / node_run_id / attempt_id`, and old execution keys must no longer be used.
- T-17: `CostEvent.budget_reservation_id` in the original document was only marked as optional, but v4.3 budget settlement requires mandatory BudgetReservation association. Fix: Both `CostEvent` and its extended fields list are unified to explicitly carry `budget_reservation_id`, which must be filled when entering settlement chain.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.