# Quota Preemption And Fair Scheduling Contract

## 1. 范围

本 contract 定义 `§53` 的资源配额、优先级抢占和公平调度。

## 2. Canonical 对象

- `QuotaPolicy`
- `SchedulingClass`
- `PreemptionDecision`
- `FairQueueSnapshot`
- `ResourceClaim`

## 3. `QuotaPolicy` 最小字段

- `scope`
- `resource_type`
- `hard_limit`
- `soft_limit`
- `burst_limit?`
- `reset_window`

## 4. 调度规则

- 调度至少考虑 `tenant / org / domain / sla_tier / priority` 五个维度。
- 抢占必须输出 `PreemptionDecision` 并记录被抢占对象与原因。
- 公平调度必须显式暴露饥饿保护与年龄加权。

## 5. 测试要求

- unit：quota match、preemption scoring、fair queue ordering
- integration：高优先级任务抢占低优先级任务
- contract：超配额任务不得静默进入执行

## 6. 关联与导出规则

- `PreemptionDecision` 导出时必须带 `harness_run_id`、`node_run_id?`、`attempt_id?`、`quota_policy_ref`、`reason_code`。
- `FairQueueSnapshot` 至少要暴露 `tenant`、`org`、`domain`、`sla_tier`、`priority` 维度的 backlog 和等待时间。
- `ResourceClaim` 不能只引用队列票据，必须可回链到 runtime truth 上的 `HarnessRun / NodeRun`。
- legacy `execution_id`、`workflow_id` 只允许作为迁移期查询 alias，不得成为配额裁决主键。

## 7. ContractEnvelope 对齐

- 所有对外发布的 quota / preemption / fairness 对象都必须声明 `schema_version`、`idempotency_key?`、`causation_id?`、`partition_key?`、`ttl?` 或等价 envelope 字段。
- 若对象仅在进程内使用，可省略 envelope；一旦进入 event、API 或审计导出链，必须补齐上述元数据。

## 8. 收口结论

- quota 决策必须能解释“为什么拦、为什么放、为什么抢占”。
- fair scheduling 必须能解释“为什么这个租户/域/优先级先执行”。
- 任何超配额放行都必须留下显式 policy / approval 例外证据。
- 资源抢占后的恢复或补偿路径也必须可审计，不得把被抢占对象静默丢回队列。
- 配额 contract 只冻结 canonical 运行时边界，不授予任何实现绕过 budget truth 的特权。

## v4.3 Contract Remediation

- T-45: 本文原先不足 60 行，缺少 ContractEnvelope 合规声明与 remediation section。v4.3 要求所有 contract 必须包含 v4.3 Contract Remediation 小节，记录历史偏差与修复结论。修复：本文新增本节，并要求新增对象必须携带 `harness_run_id` / `node_run_id` 关联字段。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger / BudgetReservation / BudgetSettlement`。
