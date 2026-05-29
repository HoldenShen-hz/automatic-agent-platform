# Billing And Tenant Contract

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

本 contract defines计量、配额、账单、套餐边界和未来多租户隔离的最小对象模型。

## 2. 关键对象

- `UsageRecord`
- `QuotaPolicy`
- `BillingAccount`
- `BudgetLedger`
- `BudgetReservation`
- `PlanDefinition`
- `TenantBoundary`

Description：

- `UsageRecord` is计量事实对象。
- `BudgetLedger / BudgetReservation` 的 truth defines冻结在 `budget-ledger-contract.md`，本文只defines它们vs tenant / billing subject 的关系，不repeats发明第二套budget账本。

## 3. UsageRecord 最小字段

- `usage_id`
- `subject_id`
- `tenant_id`
- `workspace_id?`
- `harness_run_id?`
- `node_run_id?`
- `task_id?`
- `metric_type`
- `quantity`
- `cost_source?`
- `captured_at`

## 4. BillingAccount 最小字段

- `account_id`
- `owner_id`
- `plan_id`
- `status`
- `balance_snapshot?`
- `created_at`

## 5. TenantBoundary 最小字段

- `tenant_id`
- `storage_scope`
- `artifact_scope`
- `identity_scope`
- `policy_scope`

## 6. lines为约束

- 计量、配额和账单必须可追溯到 `tenant / subject / harness_run / node_run`。
- Pro vs Enterprise 的隔离策略不能只靠 UI 区分。
- 多租户设计进入实现前，必须先明确租户级storage边界和permission边界。
- 退款、冲正、欠费冻结和能力降级必须以独立账务事实table达，不得directly重写历史 usage。
- 账单聚合不得bypassing `BudgetLedger / BudgetReservation / BudgetSettlement` truth；usage vs budget 只能向 billing projection 单向派生。

## 7. 补充规则

### 7.1 支付提供者接口

支付提供者最少应supported：

- `create_subscription`
- `update_plan`
- `capture_invoice`
- `mark_payment_failed`
- `cancel_subscription`

### 7.2 发票vs退款

- 发票、退款和冲正必须可追溯到 `billing_account` vstime窗。
- 退款不得静默改写 `UsageRecord` 或 `BudgetLedger` 历史，应以独立 adjustment recordtable达。

### 7.3 Enterprise 账户模型

- `organization_account` is Enterprise 计费vs策略归属主体。
- workspace / project 的资源消耗最终归集到 organization 级账务边界。
- organization 级 billing projection 必须能回链到租户下的 `UsageRecord` vs `BudgetLedger`。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-40: 本文原先继续uses `UsageMeter`，且完全没有把 tenant 账单vs冻结的 `BudgetLedger / BudgetReservation` 关系写进正文，Root cause: 计费合同长期停留在产品套餐/账单视角，没有随着 v4.3 的 usage fact vsbudget truth 模型synchronous升级。修复：正文现把计量事实收敛为 `UsageRecord`，并显式references用 `BudgetLedger / BudgetReservation` 作为budget真相主链，只允许向 billing projection 派生。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
