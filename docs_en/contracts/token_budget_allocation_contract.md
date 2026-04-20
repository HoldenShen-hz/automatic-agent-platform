# Token Budget Allocation Contract

## 1. Scope

This contract defines fine-grained allocation rules for token budgets across roles, steps, retries, and decision chains.

Related documents:

- `cost_and_budget_contract.md`
- `runtime_execution_contract.md`
- `monetization_metering_plane_contract.md`

## 2. Objectives

Prevent a single role or single retry from consuming the entire task budget.

## 3. Allocation Dimensions

- `per_task_budget`
- `per_role_budget`
- `per_step_budget`
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

If cost governance only stops at the task total, it can easily get out of control in long tasks; fine-grained token budget is what makes the system truly controllable.
