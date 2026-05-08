# Token Budget Allocation Contract

## 1. 范围

本 contract 定义 token 预算在角色、节点、重试和决策链上的细粒度分配规则。

相关文档：

- `cost_and_budget_contract.md`
- `runtime_execution_contract.md`
- `monetization_metering_plane_contract.md`

## 2. 目标

避免单个角色或单次重试吞掉整个 run 预算。

## 3. 分配维度

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

## 4. 规则

- 任务总预算仍是最终上限。
- 角色预算只是一层 guardrail，不替代任务总预算。
- 重试应有独立 token cap。
- context compaction 和 summary 也必须计入预算。
- OAPEFLIR 各 stage 的 budget 必须可单独观测，至少覆盖 `observe / assess / plan / execute / feedback / learn / improve / release`。
- knowledge retrieval 若启用，必须单独受 `per_knowledge_retrieval_budget` 限制，不能隐式吞掉 execute 或 feedback 预算。
- KV cache 的 fixed prefix / domain block / variable suffix 必须拆分预算，不能把全部上下文当成一个可任意挤压的桶。
- Improve / Release 阶段若需要额外评估或 rollout 试跑，必须从独立 stage budget 扣减，而不是回写 execute 阶段成本。

## 4A. 与 `BudgetReservation` 状态机的绑定

细粒度 token 预算只是 reservation 切片规则，不能替代预算 truth。

- token 预算的实际占用必须通过 `BudgetReservation` 表达。
- reservation 生命周期必须遵守 `reserved -> settled -> released`（或 `expired / rejected`）状态推进。
- `per_harness_run_budget / per_node_budget / per_retry_budget_cap / per_stage_budget` 只是决定“申请多少 reservation”的分配策略，不得直接跳过 reservation 写最终成本。
- 若一次 `NodeAttempt` 提前结束或发生 compaction / cache 命中，未消费的 token 预算必须释放回 `BudgetReservation`，不得静默吞掉。

## 5A. KV Cache Token 分区

KV cache 分区最小模型：

| 分区 | 语义 | 预算规则 |
| --- | --- | --- |
| `fixed_prefix` | 稳定系统前缀、治理约束、长期不变指令 | 预算固定保留，不参与普通 compaction |
| `domain_block` | domain 绑定知识块、术语块、策略块 | 预算上限固定，可按 domain 调整 |
| `variable_suffix` | 当前任务上下文、即时反馈、临时工具结果 | 使用剩余预算，优先被裁剪 |

规则：

- `fixed_prefix` 与 `domain_block` 的保留预算应先于 `variable_suffix` 计算。
- 预算分配必须与 `prompt_model_policy_governance_contract.md` 的 KV cache 分区策略保持一致。
- 若运行环境不支持 KV cache，仍应按相同逻辑做 token 配额模拟，避免 prompt 构建和成本归因漂移。

## 5. 收口结论

成本治理若只停在任务总额，很容易在长任务里失控；细粒度 token budget 只有与 `BudgetReservation` 生命周期绑定，系统才真正可控。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-48: 本文原先把 token budget 写成纯分配维度列表，根因是文案只覆盖 prompt/token 规划侧，没有把这些预算切片如何落到冻结的 `BudgetReservation` truth 状态机写进合同。修复：正文现新增与 `BudgetReservation` 的绑定规则，明确细粒度 token 预算只是 reservation 切片策略，实际占用必须遵守 `reserved -> settled -> released` 生命周期。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
