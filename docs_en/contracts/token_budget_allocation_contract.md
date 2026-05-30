# Token Budget Allocation Contract

## 1. Scope

This contract defines fine-grained allocation rules for token budgets across roles, nodes, retries, and decision chains.

Related documents:

- `cost_and_budget_contract.md`
- `runtime_execution_contract.md`
- `monetization_metering_plane_contract.md`

## 2. Objectives

Prevent a single role or single retry from consuming the entire run budget.

## 3. Allocation Dimensions

- `per_harness_run_budget`
- `per_role_budget`
- `per_node_budget`
- `per_stage_budget`
- `per_retry_budget_cap`
- `per_decision_context_budget`
- `per_knowledge_retrieval_budget`
- `kv_cache_fixed_prefix_budget`
- `kv_cache_domain_block_budget`
- `kv_cache_variable_suffix_budget`

## 4. Rules

- The task total budget remains the final upper limit.
- Role budget is only a guardrail layer, not a replacement for the task total budget.
- Retries should have an independent token cap.
- Context compaction and summary must also be charged against the budget.
- OAPEFLIR stage budgets must be individually observable, covering at minimum `observe / assess / plan / execute / feedback / learn / improve / release`.
- If knowledge retrieval is enabled, it must be separately constrained by `per_knowledge_retrieval_budget`, not silently consuming execute or feedback budgets.
- KV cache fixed prefix / domain block / variable suffix must have separate budgets; the entire context cannot be treated as an arbitrarily compressible bucket.
- If Improve/Release stages need additional evaluation or rollout dry runs, they must be deducted from independent stage budgets, not written back as execute stage costs.

## 4A. Binding with `BudgetReservation` State Machine

Fine-grained token budgets are only reservation slicing rules and cannot replace budget truth.

- Actual token budget consumption must be expressed through `BudgetReservation`.
- Reservation lifecycle must follow `reserved -> settled -> released` (or `expired / rejected`) state progression.
- `per_harness_run_budget / per_node_budget / per_retry_budget_cap / per_stage_budget` only determine the allocation strategy of "how much reservation to apply", and must not skip reservation to write final costs directly.
- If a `NodeAttempt` ends early or experiences compaction/cache hit, unconsumed token budgets must be released back to `BudgetReservation`, not silently consumed.

## 5A. KV Cache Token Partitioning

KV cache partition minimum model:

| Partition | Semantics | Budget Rules |
| --- | --- | --- |
| `fixed_prefix` | Stable system prefix, governance constraints, long-term invariant instructions | Budget fixed and reserved, not participating in normal compaction |
| `domain_block` | Domain-bound knowledge blocks, terminology blocks, policy blocks | Budget upper limit fixed, adjustable per domain |
| `variable_suffix` | Current task context, immediate feedback, temporary tool results | Uses remaining budget, priority for trimming |

Rules:

- Reserved budgets for `fixed_prefix` and `domain_block` should be calculated before `variable_suffix`.
- Budget allocation must remain consistent with the KV cache partitioning strategy in `prompt_model_policy_governance_contract.md`.
- If the runtime environment does not support KV cache, token quota simulation should still follow the same logic to avoid prompt construction and cost attribution drift.

## 5. Conclusion

Cost governance that only stops at the task total easily goes out of control in long tasks; only when fine-grained token budgets are bound to the `BudgetReservation` lifecycle does the system become truly controllable.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-48: This document previously wrote token budget as a pure allocation dimension list. Root cause: the copy only covered the prompt/token planning side, without writing how these budget slices land on the frozen `BudgetReservation` truth state machine into the contract. Fix: The main text now adds binding rules with `BudgetReservation`, clarifying that fine-grained token budgets are only reservation slicing strategies, and actual consumption must follow the `reserved -> settled -> released` lifecycle.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.