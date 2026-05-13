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

- Total task budget is still the final upper limit.
- Role budget is only one layer of guardrail, not a replacement for total task budget.
- Retries should have independent token caps.
- Context compaction and summary must also count toward budget.
- OAPEFLIR each stage's budget must be individually observable, covering at least `observe / assess / plan / execute / feedback / learn / improve / release`.
- If knowledge retrieval is enabled, it must be separately constrained by `per_knowledge_retrieval_budget`, and must not implicitly consume execute or feedback budget.
- KV cache's fixed prefix / domain block / variable suffix must have separate budgets; the entire context cannot be treated as a single arbitrarily compressible bucket.
- If Improve / Release stages require additional evaluation or rollout dry-run, they must be deducted from independent stage budget, not written back to execute stage cost.

## 4A. Binding with `BudgetReservation` State Machine

Fine-grained token budget is only a reservation slicing rule, cannot replace budget truth.

- Actual consumption of token budget must be expressed through `BudgetReservation`.
- Reservation lifecycle must obey state progression `reserved -> settled -> released` (or `expired / rejected`).
- `per_harness_run_budget / per_node_budget / per_retry_budget_cap / per_stage_budget` only determine "how much reservation to request" as allocation strategy, must not directly skip reservation to write final cost.
- If a `NodeAttempt` ends early or compaction / cache hit occurs, unconsumed token budget must be released back to `BudgetReservation`, must not be silently consumed.

## 5A. KV Cache Token Partitioning

KV cache partition minimum model:

| Partition | Semantic | Budget Rule |
| --- | --- | --- |
| `fixed_prefix` | Stable system prefix, governance constraints, long-term invariant instructions | Budget is fixed reserved, not participating in normal compaction |
| `domain_block` | Domain-bound knowledge blocks, terminology blocks, policy blocks | Budget ceiling is fixed, adjustable by domain |
| `variable_suffix` | Current task context, immediate feedback, temporary tool results | Uses remaining budget, prioritized for trimming |

Rules:

- Reserved budgets for `fixed_prefix` and `domain_block` should be calculated before `variable_suffix`.
- Budget allocation must be consistent with the KV cache partitioning strategy in `prompt_model_policy_governance_contract.md`.
- If the runtime does not support KV cache, token quota simulation should still be done with the same logic to avoid prompt construction and cost attribution drift.

## 5. Closure Conclusion

If cost governance only stops at the task total, it can easily get out of control in long tasks; fine-grained token budget only bound with `BudgetReservation` lifecycle makes the system truly controllable.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-48: This document originally wrote token budget as pure allocation dimension list. Root cause: documentation only covered prompt/token planning side, did not write how these budget slices land into frozen `BudgetReservation` truth state machine into the contract. Fix: This version adds binding rules with `BudgetReservation`, clarifying fine-grained token budget is only a reservation slicing strategy, actual consumption must obey `reserved -> settled -> released` lifecycle.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.