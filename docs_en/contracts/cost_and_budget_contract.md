# Cost And Budget Contract

> **v4.3 Compatibility Note**: This file is retained for historical cost and budget documentation. v4.3 budget truth defers to [budget-ledger-contract.md](./budget-ledger-contract.md); cost reports, token counters, and `actual_cost_usd` can only be used as projection / report fields.

---

## OAPEFLIR Correlation

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

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
| `max_duration_ms` | `number` | Total runtime duration ceiling |
| `warn_at_ratio` | `number` | Warning threshold ratio |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Runtime mode when budget is in effect |

Compatibility Note:

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` are only permitted as billing / accounting projection guardrails, no longer as runtime canonical `BudgetPolicy` minimum fields.

## 4. CostEvent Minimum Fields

- `cost_event_id`
- `harness_run_id` (required - canonical runtime chain anchor)
- `node_run_id?`
- `attempt_id?`
- `task_id?` (deprecated - use harness_run_id instead)
- `session_id?`
- `agent_id?`
- `stage?`
- `provider`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `budget_reservation_id?` (links to BudgetReservation for settlement tracking)
- `created_at`

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
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenarios, "platform governance cost" and "user-provided model call cost" should be distinguished.
- Platform payment and BYOK must not be mixed in the same billing口径.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, not treated as "free" background behavior:

| Operation | Attribution Rule | CostEvent Annotation |
| --- | --- | --- |
| Context compaction (compaction stage 2 summarize) | Attributed to session and harness run that triggered compaction | `budget_scope: compaction`, associated `session_id` and `harness_run_id` |
| Model call after skill cache miss | Attributed to harness run and node run that triggered skill execution | `budget_scope: skill_execution`, associated `harness_run_id` and `node_run_id` + `attempt_id` |
| Self-healing / recovery retry | Attributed to original harness run (not newly created recovery task) | `budget_scope: recovery_retry`, associated original `harness_run_id` |
| Guardian / reviewer subagent reasoning | Attributed to harness run that triggered approval | `budget_scope: approval_review`, associated `harness_run_id` and `approval_id` |

Rules:

- Implicit costs must participate in budget threshold checks and cannot bypass `BudgetPolicy` cumulative checks.
- Skill cache hits do not generate model call costs, but cache storage and lookup computation costs are not counted toward token budget.
- If compaction cost causes run to exceed `max_cost_usd`, it should trigger the same threshold actions (alert, approval, or circuit break) as normal model calls, not silently pass through.
- The `budget_scope` field in CostEvent must distinguish the above scenarios so cost reports can aggregate by source dimension.

Supplementary Note:

- Token budget fine-grained allocation defers to the drilling document `token_budget_allocation_contract.md`.

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

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-41: This document previously reduced `BudgetPolicy` to three financial thresholds: `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd`. Root cause: the cost contract used report/billing口径 and did not upgrade to multi-dimensional budget constraints along with v4.3 runtime budget guard. Fix: The main text now changes canonical `BudgetPolicy` to `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`, with old daily/monthly statistics retained only as billing projection guardrails.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
