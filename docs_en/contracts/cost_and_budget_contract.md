# Cost And Budget Contract

> **v4.3 兼容Description**：本文件保留为历史成本vsbudgetDescription。v4.3 budget truth 以 [budget-ledger-contract.md](./budget-ledger-contract.md) 为准；成本报table、token counter vs `actual_cost_usd` 只能作为 projection / report 字段。

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines成本估算、实时成本record、budgetthreshold和熔断规则。

## 2. 关键对象

- `CostEstimate`
- `CostEvent`
- `BudgetPolicy`
- `CostKillSwitch`

## 3. BudgetPolicy 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `max_cost_usd` | `number` | 本iterations run 可消耗的总成本upper limit |
| `max_model_tokens` | `number` | 模型 token 总upper limit |
| `max_context_tokens` | `number` | 输入上下文 token upper limit |
| `max_output_tokens` | `number` | 输出 token upper limit |
| `max_steps` | `number` | 允许完成的 node 数upper limit |
| `max_node_runs` | `number` | 允许创建的 NodeRun 数upper limit |
| `max_duration_ms` | `number` | 总运lines时长upper limit |
| `warn_at_ratio` | `number` | 预警threshold |
| `runtime_mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | budget生效时的运lines模式（vs sandbox 隔离级别正交） |
| `rollout_guard` | `no_rollout \| approval_required \| rollout_allowed` | budgetexceedsthreshold时的发布保护 |
| `sandbox_policy_mode` | `read_only \| workspace_write \| scoped_external_access \| restricted_exec` | 执lines沙箱隔离级别（vs runtime_mode 正交，组合uses时需via PolicyEngine 校验合法性） |

兼容Description：

- `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` 只允许作为 billing / accounting projection guardrail，不再作为 runtime canonical `BudgetPolicy` 最小字段。

## 4. CostEvent 最小字段

- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `session_id?`
- `agent_id?`
- `stage?`
- `provider`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `budget_reservation_id`
- `created_at`

规则：

- `harness_run_id` isbudget主体关联键（必填）。
- `task_id` onlyused for legacy 追溯查询，不得作为budget判断主键。
- `budget_reservation_id` 关联本iterations成本所属的 BudgetReservation，used forbudget结算，进入budget结算链时必须填写。
- CostEvent 不得uses废弃的 legacy execution 键；成本归属必须关联到 `harness_run_id / node_run_id / attempt_id`。

## 5. lines为约束

- 成本record应尽量靠近真实call点。
- budget判断不能只看单iterationscall，应看累计值，并vs `BudgetLedger / BudgetReservation / BudgetSettlement` truth 对齐。
- 触发threshold后必须有明确动作：告警、审批、暂停或熔断。

## 6. 关联范围

成本至少覆盖：

- 总部层call。
- 事业部执lines。
- 自愈重试。
- 压缩vs后台任务。
- Observe / Assess / Plan / Feedback / Learn / Improve / Release 各阶段call。
- node 重试、tool call、副作用确认vs人工复核call。

## 7. 补充规则

### 7.1 估算模板

- `passthrough`: 最低上下文、最低治理开销
- `fast`: 快速模型 + 轻量工具链
- `standard`: defaults to推理vs标准治理链
- `full`: 深推理 + 扩展上下文 + 完整治理链

规则：

- 每个模板都必须绑定defaults to模型档位、token ceiling 和budget倍率。

### 7.2 成本事件结构

`CostEvent` 扩展字段至少includes：

- `cost_event_id`
- `provider_request_id?`
- `budget_scope`
- `budget_reservation_id`
- `pricing_version`

### 7.3 BYOK 区分

- BYOK 场景下应区分“平台治理成本”和“user自带模型call成本”。
- 平台代付vs BYOK 不得混在同一账单口径里。

### 7.4 隐式成本归属

以下系统内部操作会产生模型call成本，必须纳入成本追踪，不得作为"免费"后台lines为：

| 操作 | 归属规则（v4.3 canonical） | CostEvent 标注 |
|---|-------|--------|
| 上下文压缩（compaction stage 2 summarize） | 归属到触发压缩的 harness run | `budget_scope: compaction`、关联 `harness_run_id`（legacy 可追溯 `task_id`） |
| skill cache未命中后的模型call | 归属到触发 skill 执lines的 harness run 和 node run | `budget_scope: skill_execution`、关联 `harness_run_id / node_run_id` |
| 自愈 / 恢复重试 | 归属到原始 harness run（非新建恢复任务） | `budget_scope: recovery_retry`、关联原始 `harness_run_id` 和 `node_run_id / attempt_id` |
| guardian / reviewer subagent 推理 | 归属到触发审批的 harness run | `budget_scope: approval_review`、关联 `approval_id`、`harness_run_id` |

规则：

- 隐式成本必须参vsbudgetthreshold判断，不得bypassing `BudgetPolicy` 的累计检查。
- 所有成本归属关联必须uses `harness_run_id / node_run_id / attempt_id`，不得uses废弃的 legacy execution 键。
- `task_id` only作为 legacy 追溯字段，不得参vsbudget判断逻辑。
- skill cache命中时不产生模型call成本，但cachestorage和查找的计算成本不计入 token budget。
- compaction 成本若使 run exceeds过 `max_cost_usd`，应触发vs普通模型call相同的threshold动作（告警、审批或熔断），不得静默放lines。
- CostEvent 的 `budget_scope` 字段必须区分上述场景，使成本报告可按来源维度聚合。

补充Description：

- token budget细粒度分配以下钻文档 `token_budget_allocation_contract.md` 为准。

### 7.5 Per-Stage Budget Allocation

`StageBudgetPolicy` 至少应supported：

- `stage`
- `budget_limit_usd`
- `warn_ratio`
- `hard_stop`

规则：

- Observe / Assess / Plan / Execute / Feedback / Learn / Improve / Release 的成本归属必须可分层统计。
- Knowledge 检索、Learn 生成、Improve 评估、Release 试跑等隐式模型成本不得全部混进单一 execute 成本桶。
- stage 成本exceedsthreshold时，必须触发vs普通模型call一致的告警、审批或熔断语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-41: 本文原先把 `BudgetPolicy` 缩减成 `max_task_cost_usd / max_daily_cost_usd / max_monthly_cost_usd` 三个财务threshold，Root cause: 成本合同accesses along用了报table/账单口径，没有随着 v4.3 runtime budget guard 升级为多维budget约束。修复：正文现把 canonical `BudgetPolicy` 改为 `max_cost_usd / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms`，旧日/月统计只保留为 billing projection guardrail。
- T-15: 原 `CostEvent` 以 `task_id` 为必填但 `harness_run_id` 为optional，budget主体层级倒置。修复：`harness_run_id` 改为必填，`task_id` 降为optional legacy 追溯字段。
- T-16: 隐式成本归属规则仍references用废弃的旧 execution 键，未对齐 `node_run_id/attempt_id`。修复：归属规则全面改用 `harness_run_id / node_run_id / attempt_id`，不得再uses旧 execution 键。
- T-17: `CostEvent.budget_reservation_id` 在原文中only标记为optional，但 v4.3 budget结算要求必须关联 BudgetReservation。修复：`CostEvent` vs其扩展字段列table都统一改为显式携带 `budget_reservation_id`，used for结算链路时必须填写。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
