# Cost And Budget Contract

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
| `max_task_cost_usd` | `number` | Per-task cost ceiling |
| `max_daily_cost_usd` | `number` | Daily cost ceiling |
| `max_monthly_cost_usd` | `number` | Monthly cost ceiling |
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

## 5. Behavioral Constraints

- Cost records should be as close to the actual call site as possible.
- Budget judgment should not only look at individual calls but at cumulative values.
- After triggering thresholds, there must be clear actions: alert, approval, pause, or circuit break.

## 6. Related Scope

Costs should at minimum cover:

- Headquarters calls.
- Division execution.
- Self-healing retries.
- Compaction and background tasks.
- Calls for each stage of Observe / Assess / Plan / Feedback / Learn / Improve / Release.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Minimum context, minimum governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning and standard governance chain
- `full`: Deep reasoning + extended context + complete governance chain

Rules:

- Each template must be bound to a default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

`CostEvent` extended fields should at minimum include:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenarios, "platform governance cost" and "user-provided model call cost" should be distinguished.
- Platform payment and BYOK must not be mixed in the same billing scope/definition.

### 7.4 Implicit Cost Attribution

The following system internal operations generate model call costs and must be included in cost tracking, not treated as "free" background behavior:

| Operation | Attribution Rule | CostEvent Annotation |
| --- | --- | --- |
| Context compression (compaction stage 2 summarize) | Attributed to the session and task that triggered compression | `budget_scope: compaction`, associated `session_id` and `task_id` |
| Model calls after skill cache miss | Attributed to the task and execution that triggered skill execution | `budget_scope: skill_execution`, associated `execution_id` |
| Self-healing / recovery retry | Attributed to the original task (not newly created recovery task) | `budget_scope: recovery_retry`, associated original `task_id` |
| Guardian / reviewer subagent reasoning | Attributed to the task that triggered approval | `budget_scope: approval_review`, associated `approval_id` |

Rules:

- Implicit costs must participate in budget threshold judgment and cannot bypass `BudgetPolicy` cumulative checks.
- Skill cache hits do not generate model call costs, but cache storage and lookup computation costs are not counted into token budget.
- If compaction cost causes a single task to exceed `max_task_cost_usd`, it should trigger the same threshold actions as regular model calls (alert, approval, or circuit break), not silently allow.
- `CostEvent`'s `budget_scope` field must distinguish the above scenarios so that cost reports can be aggregated by source dimension.

Supplementary notes:

- Token budget granularity allocation follows `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` should at minimum support:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically layerable.
- Implicit model costs such as Knowledge retrieval, Learn generation, Improve evaluation, and Release trial runs must not all be mixed into a single execute cost bucket.
- When stage cost exceeds threshold, it must trigger the same alert, approval, or circuit break semantics as regular model calls.
