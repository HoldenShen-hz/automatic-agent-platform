# Cost And Budget Contract

> **v4.3 Compatibility Note**: This file is retained for historical cost and budget descriptions. v4.3 budget truth is governed by [budget-ledger-contract.md](./budget-ledger-contract.md); cost reports, token counters, and `actual_cost_usd` can only be used as projection/report fields.

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR 8-phase cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
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
|---|-------|--------|
| `max_cost_usd` | `number` | Maximum total cost this run can consume |
| `max_model_tokens` | `number` | Model token total limit |
| `max_context_tokens` | `number` | Input context token limit |
| `max_output_tokens` | `number` | Output token limit |
| `max_steps` | `number` | Maximum number of nodes allowed to complete |
| `max_node_runs` | `number` | Maximum number of NodeRuns allowed |
| `max_duration_ms` | `number` | Total runtime duration limit |
| `warn_at_ratio` | `number` | Warning threshold |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Runtime mode when budget is active (orthogonal to sandbox isolation level) |
| `rollout_guard` | `no_rollout \| approval_required \| rollout_allowed` | Release protection when budget exceeds threshold |
| `sandbox_policy_mode` | `read_only \| workspace_write \| scoped_external_access \| restricted_exec` | Execution sandbox isolation level (orthogonal to runtime_mode; combined use requires PolicyEngine validation) |

Compatibility note:

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` are only allowed as billing / accounting projection guardrails, no longer as runtime canonical `BudgetPolicy` minimum fields.

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
- `task_id` is only used for legacy trace queries and must not be used as budget judgment primary key.
- `budget_reservation_id` associates with the BudgetReservation that this cost belongs to, used for budget settlement; must be filled when entering the budget settlement chain.
- CostEvent must not use deprecated legacy execution keys; cost attribution must associate to `harness_run_id / node_run_id / attempt_id`.

## 5. Behavior Constraints

- Cost recording should be as close to the actual call point as possible.
- Budget judgment must not look at a single call but cumulative value, aligned with `BudgetLedger / BudgetReservation / BudgetSettlement` truth.
- After triggering threshold, there must be a clear action: alert, approval, pause, or circuit break.

## 6. Association Scope

Cost covers at minimum:

- Headquarters level calls.
- Division execution.
- Self-healing retries.
- Compaction and background tasks.
- Observe / Assess / Plan / Feedback / Learn / Improve / Release stage calls.
- Node retries, tool calls, side effect confirmations, and manual review calls.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Lowest context, lowest governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning + standard governance chain
- `full`: Deep reasoning + extended context + complete governance chain

Rules:

- Each template must bind default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

CostEvent extended fields include at minimum:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `budget_reservation_id`
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenarios, distinguish between "platform governance cost" and "customer-provided model call cost".
- Platform payment and BYOK must not be mixed in the same billing口径.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, not treated as "free" background behavior:

| Operation | Attribution Rule (v4.3 canonical) | CostEvent Annotation |
|---|-------|--------|
| Context compression (compaction stage 2 summarize) | Attributed to the harness run that triggered compression | `budget_scope: compaction`, associates `harness_run_id` (legacy can trace `task_id`) |
| Model call after skill cache miss | Attributed to the harness run and node run that triggered skill execution | `budget_scope: skill_execution`, associates `harness_run_id / node_run_id` |
| Self-healing / recovery retry | Attributed to the original harness run (not newly created recovery task) | `budget_scope: recovery_retry`, associates original `harness_run_id` and `node_run_id / attempt_id` |
| Guardian / reviewer subagent reasoning | Attributed to the harness run that triggered approval | `budget_scope: approval_review`, associates `approval_id`, `harness_run_id` |

Rules:

- Implicit costs must participate in budget threshold checks and must not bypass `BudgetPolicy` cumulative checks.
- All cost attribution associations must use `harness_run_id / node_run_id / attempt_id` and must not use deprecated legacy execution keys.
- `task_id` is only a legacy trace field and must not participate in budget judgment logic.
- Skill cache hits do not generate model call costs, but cache storage and lookup computation costs are not counted in token budget.
- If compaction cost causes run to exceed `max_cost_usd`, should trigger the same threshold action as normal model calls (alert, approval, or circuit break), and must not silently proceed.
- CostEvent's `budget_scope` field must distinguish the above scenarios, enabling cost reports to aggregate by source dimension.

Supplementary note:

- Token budget granular allocation follows `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` should support at minimum:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically divisible by stage.
- Implicit model costs such as knowledge retrieval, Learn generation, Improve evaluation, and Release trial runs must not all be mixed into a single execute cost bucket.
- When stage cost exceeds threshold, must trigger the same alert, approval, or circuit break semantics as normal model calls.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-41: This document originally reduced `BudgetPolicy` to `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` three financial thresholds. Root cause: Cost contract followed billing/accounting口径 and did not upgrade with v4.3 runtime budget guard to multi-dimensional budget constraints. Fix: The body now changes canonical `BudgetPolicy` to `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`, with old daily/monthly statistics retained only as billing projection guardrails.
- T-15: Original `CostEvent` had `task_id` as required but `harness_run_id` as optional, budget subject level inverted. Fix: `harness_run_id` changed to required, `task_id` demoted to optional legacy trace field.
- T-16: Implicit cost attribution rules still referenced deprecated old execution keys, not aligned with `node_run_id/attempt_id`. Fix: Attribution rules comprehensively changed to use `harness_run_id / node_run_id / attempt_id` and must no longer use old execution keys.
- T-17: `CostEvent.budget_reservation_id` was only marked as optional in the original text, but v4.3 budget settlement requires associating to BudgetReservation. Fix: Both `CostEvent` and its extended fields list are uniformly changed to explicitly carry `budget_reservation_id`, required when entering settlement chain.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.