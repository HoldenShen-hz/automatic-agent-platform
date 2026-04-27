# Billing And Tenant Contract

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

本 contract 定义计量、配额、账单、套餐边界和未来多租户隔离的最小对象模型。

## 2. 关键对象

- `UsageMeter`
- `QuotaPolicy`
- `BillingAccount`
- `PlanDefinition`
- `TenantBoundary`

## 3. UsageMeter 最小字段

- `usage_id`
- `subject_id`
- `task_id?`
- `metric_type`
- `quantity`
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

## 6. 行为约束

- 计量、配额和账单必须可追溯到任务或主体。
- Pro 与 Enterprise 的隔离策略不能只靠 UI 区分。
- 多租户设计进入实现前，必须先明确租户级存储边界和权限边界。
- 退款、冲正、欠费冻结和能力降级必须以独立账务事实表达，不得直接重写历史 usage。

## 7. 补充规则

### 7.1 支付提供者接口

支付提供者最少应支持：

- `create_subscription`
- `update_plan`
- `capture_invoice`
- `mark_payment_failed`
- `cancel_subscription`

### 7.2 发票与退款

- 发票、退款和冲正必须可追溯到 `billing_account` 与时间窗。
- 退款不得静默改写 usage ledger，应以独立 adjustment 记录表达。

### 7.3 Enterprise 账户模型

- `organization_account` 是 Enterprise 计费与策略归属主体。
- workspace / project 的资源消耗最终归集到 organization 级账务边界。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-40: 用UsageMeter而非架构§18.1的UsageRecord；未引用冻结的BudgetLedger/BudgetReservation。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
