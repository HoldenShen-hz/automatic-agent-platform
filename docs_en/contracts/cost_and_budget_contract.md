# Cost And Budget Contract

> **v4.3 Compatibility Note**: This file is preserved as historical cost and budget documentation. v4.3 budget truth is based on [v4_3_budget_ledger_contract.md](./v4_3_budget_ledger_contract.md); cost reports, token counters, and `actual_cost_usd` can only be used as projection / report fields.

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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
| `max_task_cost_usd` | `number` | Single task upper limit |
| `max_daily_cost_usd` | `number` | Daily upper limit |
| `max_monthly_cost_usd` | `number` | Monthly upper limit |
| `warn_at_ratio` | `number` | Warning threshold |
| `mode` | `supervised \| auto \| full-auto` | Execution mode |

## 4. CostEvent Minimum Fields

- `task_id`
- `session_id?`
- `agent_id?`
- `stage?`
- `provider`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `created_at`

## 5. Behavior Constraints

- Cost records should be as close to the actual call site as possible.
- Budget judgment should not only look at single call, but at cumulative value.
- After triggering threshold, there must be explicit actions: alert, approval, pause, or circuit break.

## 6. Associated Scope

Costs cover at least:

- HQ level calls.
- Division execution.
- Self-healing retries.
- Compaction and background tasks.
- Observe / Assess / Plan / Feedback / Learn / Improve / Release phase calls.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Lowest context, lowest governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning and standard governance chain
- `full`: Deep reasoning + extended context + complete governance chain

Rules:

- Each template must bind default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

`CostEvent` extended fields include at least:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenario, should distinguish "platform governance cost" and "user-provided model call cost".
- Platform payment and BYOK must not be mixed in the same billing scope.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, not treated as "free" background behavior:

| Operation | Attribution Rule | CostEvent Annotation |
| --- | --- | --- |
| Context compaction (compaction stage 2 summarize) | Attributed to the session and task that triggered compaction | `budget_scope: compaction`, associated `session_id` and `task_id` |
| Skill cache miss subsequent model calls | Attributed to the task and execution that triggered skill execution | `budget_scope: skill_execution`, associated `execution_id` |
| Self-healing / recovery retry | Attributed to original task (not new recovery task) | `budget_scope: recovery_retry`, associated original `task_id` |
| Guardian / reviewer subagent reasoning | Attributed to the task that triggered approval | `budget_scope: approval_review`, associated `approval_id` |

Rules:

- Implicit costs must participate in budget threshold judgment and must not bypass `BudgetPolicy` cumulative checks.
- Skill cache hits do not generate model call costs, but computational costs for cache storage and lookup are not counted into token budget.
- If compaction cost causes single task to exceed `max_task_cost_usd`, should trigger the same threshold action as normal model calls (alert, approval, or circuit break), not silently release.
- CostEvent's `budget_scope` field must distinguish the above scenarios so that cost reports can be aggregated by source dimension.

Supplementary notes:

- Token budget granular allocation is based on the drilling document `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` should at least support:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically layerable.
- Knowledge retrieval, Learn generation, Improve evaluation, Release trial runs and other implicit model costs must not all be mixed into a single execute cost bucket.
- When stage cost exceeds threshold, must trigger the same alert, approval, or circuit break semantics as normal model calls.
