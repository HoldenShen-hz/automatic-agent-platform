# Cost And Budget Contract

---

## OAPEFLIR Association

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
| `max_task_cost_usd` | `number` | Per-task cost cap |
| `max_daily_cost_usd` | `number` | Daily cost cap |
| `max_monthly_cost_usd` | `number` | Monthly cost cap |
| `warn_at_ratio` | `number` | Warning threshold ratio |
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

- Cost recording should be as close as possible to the actual call site.
- Budget checks must look at cumulative values, not just individual calls.
- When thresholds are triggered, there must be a clear action: alert, approval, pause, or circuit break.

## 6. Scope of Coverage

Costs must cover at least:

- Headquarters-level calls.
- Division execution.
- Self-healing retries.
- Compaction and background tasks.
- Calls across all stages: Observe / Assess / Plan / Feedback / Learn / Improve / Release.

## 7. Supplementary Rules

### 7.1 Estimation Templates

- `passthrough`: Minimal context, minimal governance overhead
- `fast`: Fast model + lightweight toolchain
- `standard`: Default reasoning + standard governance chain
- `full`: Deep reasoning + extended context + full governance chain

Rules:

- Each template must be bound to a default model tier, token ceiling, and budget multiplier.

### 7.2 Cost Event Structure

`CostEvent` extended fields include at minimum:

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `pricing_version`

### 7.3 BYOK Distinction

- In BYOK scenarios, "platform governance cost" and "user-provided model call cost" should be distinguished.
- Platform payment and BYOK must not be mixed in the same billing口径.

### 7.4 Implicit Cost Attribution

The following internal system operations generate model call costs and must be included in cost tracking; they cannot be treated as "free" background behavior:

| Operation | Attribution Rule | CostEvent Annotation |
| --- | --- | --- |
| Context compression (compaction stage 2 summarize) | Attributed to the session and task that triggered compaction | `budget_scope: compaction`, associated `session_id` and `task_id` |
| Model calls after skill cache miss | Attributed to the task and execution that triggered skill execution | `budget_scope: skill_execution`, associated `execution_id` |
| Self-healing / recovery retry | Attributed to the original task (not the newly created recovery task) | `budget_scope: recovery_retry`, associated original `task_id` |
| Guardian / reviewer subagent reasoning | Attributed to the task that triggered approval | `budget_scope: approval_review`, associated `approval_id` |

Rules:

- Implicit costs must participate in budget threshold checks and must not bypass `BudgetPolicy` cumulative checks.
- Skill cache hits do not generate model call costs, but cache storage and lookup computational costs are not charged to token budget.
- If compaction cost causes a single task to exceed `max_task_cost_usd`, it should trigger the same threshold action as normal model calls (alert, approval, or circuit break), and must not silently pass through.
- The `budget_scope` field in CostEvent must distinguish the above scenarios so that cost reports can be aggregated by source dimension.

Supplementary note:

- Token budget fine-grained allocation follows the drilling document `token_budget_allocation_contract.md`.

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` must support at minimum:

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

Rules:

- Cost attribution for Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release must be statistically separable by layer.
- Implicit model costs such as Knowledge retrieval, Learn generation, Improve evaluation, and Release trial runs must not all be mixed into a single execute cost bucket.
- When stage costs exceed thresholds, they must trigger the same alert, approval, or circuit break semantics as normal model calls.
