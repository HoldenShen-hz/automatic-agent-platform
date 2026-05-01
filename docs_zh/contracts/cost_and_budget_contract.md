# Cost And Budget Contract

> **v4.3 兼容说明**：本文件保留为历史成本与预算说明。v4.3 预算 truth 以 [budget-ledger-contract.md](./budget-ledger-contract.md) 为准；成本报表、token counter 与 `actual_cost_usd` 只能作为 projection / report 字段。

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义成本估算、实时成本记录、预算阈值和熔断规则。

## 2. 关键对象

- `CostEstimate`
- `CostEvent`
- `BudgetPolicy`
- `CostKillSwitch`

## 3. BudgetPolicy 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `max_cost_usd` | `number` | 本次 run 可消耗的总成本上限 |
| `max_model_tokens` | `number` | 模型 token 总上限 |
| `max_context_tokens` | `number` | 输入上下文 token 上限 |
| `max_output_tokens` | `number` | 输出 token 上限 |
| `max_node_runs` | `number` | 允许完成的 node 数上限 |
| `max_duration_ms` | `number` | 总运行时长上限 |
| `warn_at_ratio` | `number` | 预警阈值 |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no_write \| no_external_call \| no_rollout \| manual_only \| incident_mode` | 预算生效时的运行模式（4 states 对齐 sandbox_and_auth_contract §3） |

兼容说明：

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` 只允许作为 billing / accounting projection guardrail，不再作为 runtime canonical `BudgetPolicy` 最小字段。

## 4. CostEvent 最小字段

- `cost_event_id`
- `harness_run_id` — 关联 HarnessRun，架构 §18 以 HarnessRun 为预算主体
- `node_run_id?`
- `attempt_id?`
- `budget_reservation_id?` — 关联 BudgetReservation，架构 §18.3 要求 reserve-before-execute 链接
- `task_id?` — 兼容查询入口；非 truth 主键
- `session_id?`
- `agent_id?`
- `stage?`
- `provider`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `created_at`
- `provider_request_id?`
- `budget_scope`
- `pricing_version`

## 5. 行为约束

- 成本记录应尽量靠近真实调用点。
- 预算判断不能只看单次调用，应看累计值，并与 `BudgetLedger / BudgetReservation / BudgetSettlement` truth 对齐。
- 触发阈值后必须有明确动作：告警、审批、暂停或熔断。

## 6. 关联范围

成本至少覆盖：

- 总部层调用。
- 事业部执行。
- 自愈重试。
- 压缩与后台任务。
- Observe / Assess / Plan / Feedback / Learn / Improve / Release 各阶段调用。
- node 重试、tool 调用、副作用确认与人工复核调用。

## 7. 补充规则

### 7.1 估算模板

- `passthrough`: 最低上下文、最低治理开销
- `fast`: 快速模型 + 轻量工具链
- `standard`: 默认推理与标准治理链
- `full`: 深推理 + 扩展上下文 + 完整治理链

规则：

- 每个模板都必须绑定默认模型档位、token ceiling 和预算倍率。

### 7.2 成本事件结构

`CostEvent` 扩展字段至少包括：

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `pricing_version`

### 7.3 BYOK 区分

- BYOK 场景下应区分“平台治理成本”和“用户自带模型调用成本”。
- 平台代付与 BYOK 不得混在同一账单口径里。

### 7.4 隐式成本归属

以下系统内部操作会产生模型调用成本，必须纳入成本追踪，不得作为"免费"后台行为：

| 操作 | 归属规则 | CostEvent 标注 |
| --- | --- | --- |
| 上下文压缩（compaction stage 2 summarize） | 归属到触发压缩的 session 和 task | `budget_scope: compaction`、关联 `session_id` 和 `task_id` |
| skill 缓存未命中后的模型调用 | 归属到触发 skill 执行的 harness run 和 node run | `budget_scope: skill_execution`、关联 `harness_run_id / node_run_id` |
| 自愈 / 恢复重试 | 归属到原始 task（非新建恢复任务） | `budget_scope: recovery_retry`、关联原始 `task_id` |
| guardian / reviewer subagent 推理 | 归属到触发审批的 task | `budget_scope: approval_review`、关联 `approval_id` |

规则：

- 隐式成本必须参与预算阈值判断，不得绕过 `BudgetPolicy` 的累计检查。
- skill 缓存命中时不产生模型调用成本，但缓存存储和查找的计算成本不计入 token 预算。
- compaction 成本若使 run 超过 `max_cost_usd`，应触发与普通模型调用相同的阈值动作（告警、审批或熔断），不得静默放行。
- CostEvent 的 `budget_scope` 字段必须区分上述场景，使成本报告可按来源维度聚合。
- 隐式成本归因必须使用 canonical 标识符：`harness_run_id / node_run_id / attempt_id`，不得使用废弃的 `execution_id`。

补充说明：

- token 预算细粒度分配以下钻文档 `token_budget_allocation_contract.md` 为准。

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` 至少应支持：

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

规则：

- Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release 的成本归属必须可分层统计。
- Knowledge 检索、Learn 生成、Improve 评估、Release 试跑等隐式模型成本不得全部混进单一 execute 成本桶。
- stage 成本超阈值时，必须触发与普通模型调用一致的告警、审批或熔断语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-41: 本文原先把 `BudgetPolicy` 缩减成 `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` 三个财务阈值，根因是成本合同沿用了报表/账单口径，没有随着 v4.3 runtime budget guard 升级为多维预算约束。修复：正文现把 canonical `BudgetPolicy` 改为 `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`，旧日/月统计只保留为 billing projection guardrail。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
