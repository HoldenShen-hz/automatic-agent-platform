# Token Budget Allocation Contract

## 1. Scope

This contract defines fine-grained token budget allocation rules across roles, steps, retries, and decision chains.

Related documents:

- `cost_and_budget_contract.md`
- `runtime_execution_contract.md`
- `monetization_metering_plane_contract.md`

## 2. Goal

Prevent a single role or single retry from swallowing the entire task budget.

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

- The task total budget is still the final upper limit.
- Role budget is only a guardrail layer and does not replace the task total budget.
- Retries should have an independent token cap.
- Context compaction and summary must also be counted into the budget.
- Each OAPEFLIR stage budget must be individually observable, covering at minimum `observe / assess / plan / execute / feedback / learn / improve / release`.
- If knowledge retrieval is enabled, it must be independently limited by `per_knowledge_retrieval_budget` and must not implicitly consume execute or feedback budget.
- KV cache fixed prefix / domain block / variable suffix must have separate budgets and cannot treat all context as a single arbitrarily compressible bucket.
- If Improve / Release stages need additional evaluation or rollout trial runs, they must be deducted from the independent stage budget, not written back to execute stage cost.

## 5A. KV Cache Token Partition

KV cache partition minimum model:

| Partition | Semantics | Budget Rules |
| --- | --- | --- |
| `fixed_prefix` | Stable system prefix, governance constraints, long-term unchanging instructions | Budget fixed reserved; does not participate in normal compaction |
| `domain_block` | Domain-bound knowledge blocks, terminology blocks, policy blocks | Budget upper limit fixed; can be adjusted by domain |
| `variable_suffix` | Current task context, immediate feedback, temporary tool results | Uses remaining budget; prioritized for trimming |

Rules:

- Reserved budget for `fixed_prefix` and `domain_block` should be calculated before `variable_suffix`.
- Budget allocation must be consistent with the KV cache partition strategy in `prompt_model_policy_governance_contract.md`.
- If the runtime does not support KV cache, the same logic should still be simulated for token quota to avoid prompt construction and cost attribution drift.

## 5. Closure Conclusion

Cost governance that only stops at the task total can easily get out of control in long tasks; fine-grained token budget is what truly makes the system controllable.
