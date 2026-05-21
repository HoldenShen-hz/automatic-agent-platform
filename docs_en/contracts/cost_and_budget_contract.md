# Cost And Budget Contract

> **v4.3 Compatibility Note**: This file is retained for historical cost and budget documentation. v4.3 budget truth defers to [budget-ledger-contract.md](./budget-ledger-contract.md); cost reports, token counters, and `actual_cost_usd` can only be used as projection / report fields.

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

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
| --- | --- | --- |
| `max_cost_usd` | `number` | Total cost ceiling for this run |
| `max_model_tokens` | `number` | Total model token ceiling |
| `max_context_tokens` | `number` | Input context token ceiling |
| `max_output_tokens` | `number` | Output token ceiling |
| `max_steps` | `number` | Maximum allowed completed node count |
| `max_node_runs` | `number` | Maximum allowed NodeRun count |
| `max_duration_ms` | `number` | Total runtime duration ceiling |
| `warn_at_ratio` | `number` | Warning threshold ratio |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Runtime mode when budget is in effect (orthogonal to sandbox isolation level) |
| `rollout_guard` | `no_rollout \| approval_required \| rollout_allowed` | Release protection when budget threshold exceeded |
| `sandbox_policy_mode` | `read_only \| workspace_write \| scoped_external_access \| restricted_exec` | Execution sandbox isolation level (orthogonal to runtime_mode, when combined must be validated through PolicyEngine for legitimacy) |

Compatibility Note:

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` are only permitted as billing / accounting projection guardrails, no longer as runtime canonical `BudgetPolicy` minimum fields.

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
- `task_id` is only used for legacy traceable queries and must not be used as the budget judgment primary key.
- `budget_reservation_id` associates the current cost with the BudgetReservation to which it belongs, used for budget settlement chain and must be filled when entering settlement chain.
- CostEvent must not use the deprecated legacy execution key; cost attribution must be associated with `harness_run_id / node_run_id / attempt_id`.

## 5. Behavioral Constraints

- Cost recording should be as close to the actual call point as possible.
- Budget judgment should not look at single calls alone, but at cumulative values, aligned with `BudgetLedger / BudgetReservation / BudgetSettlement` truth.
- Threshold triggers must have explicit actions: alert, approval, pause, or circuit break.

## 6. Correlation Scope

Cost must cover at minimum:

- Headquarters-level calls.
- Business unit execution.
- Self-healing retries.
- Compaction and background tasks.
- Observe / Assess / Plan / Feedback / Learn / Improve / Release stage calls.
- Node retries, tool calls, side effect confirmation, and human review calls.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Minimum context, minimum governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning + standard governance chain
- `full`: Deep reasoning + extended context + complete governance chain

Rules:

- Each template must bind a default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

`CostEvent` extended fields must include at minimum:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `budget_reservation_id`
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenarios, should distinguish between "platform governance cost" and "user-provided model call cost."
- Platform payment and BYOK must not be mixed in the same billing口径.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, not treated as "free" background behavior:

| Operation | Attribution Rule (v4.3 canonical) | CostEvent Annotation |
| --- | --- | --- |
| Context compaction (compaction stage 2 summarize) | Attributed to the harness run that triggered compaction | `budget_scope: compaction`, associated `harness_run_id` (legacy can trace `task_id`) |
| Model call after skill cache miss | Attributed to the harness run and node run that triggered skill execution | `budget_scope: skill_execution`, associated `harness_run_id / node_run_id` |
| Self-healing / recovery retry | Attributed to the original harness run (not newly created recovery task) | `budget_scope: recovery_retry`, associated original `harness_run_id` and `node_run_id / attempt_id` |
| Guardian / reviewer subagent reasoning | Attributed to the harness run that triggered approval | `budget_scope: approval_review`, associated `approval_id`, `harness_run_id` |

Rules:

- Implicit costs must participate in budget threshold checks and cannot bypass `BudgetPolicy` cumulative checks.
- All cost attribution associations must use `harness_run_id / node_run_id / attempt_id` and must not use the deprecated legacy execution key.
- `task_id` is only a legacy traceable field and must not participate in budget judgment logic.
- Skill cache hits do not generate model call costs, but cache storage and lookup computation costs are not counted toward token budget.
- If compaction cost causes run to exceed `max_cost_usd`, it should trigger the same threshold actions (alert, approval, or circuit break) as normal model calls and must not silently pass through.
- The `budget_scope` field in CostEvent must distinguish the above scenarios so cost reports can aggregate by source dimension.

Supplementary Note:

- Token budget fine-grained allocation defers to `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` must support at minimum:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically separable by layer.
- Implicit model costs such as Knowledge retrieval, Learn generation, Improve evaluation, and Release trial runs must not all be mixed into a single execute cost bucket.
- When stage cost exceeds threshold, it must trigger the same alert, approval, or circuit break semantics as normal model calls.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-41: This document previously reduced `BudgetPolicy` to three financial thresholds: `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd`. Root cause: the cost contract used report/billing口径 and did not upgrade to multi-dimensional budget constraints along with v4.3 runtime budget guard. Fix: The main text now changes canonical `BudgetPolicy` to `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`, with old daily/monthly statistics retained only as billing projection guardrails.
- T-15: Original `CostEvent` used `task_id` as required but `harness_run_id` as optional, budget subject hierarchy inverted. Fix: `harness_run_id` is now required, `task_id` demoted to optional legacy traceable field.
- T-16: Implicit cost attribution rules still referenced the deprecated legacy execution key, not aligned with `node_run_id/attempt_id`. Fix: Attribution rules comprehensively changed to use `harness_run_id / node_run_id / attempt_id` and must no longer use legacy execution key.
- T-17: `CostEvent.budget_reservation_id` was only marked as optional in original text, but v4.3 budget settlement requires association with BudgetReservation. Fix: both the core and extended `CostEvent` field lists now explicitly carry `budget_reservation_id`, and settlement paths must fill it.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.