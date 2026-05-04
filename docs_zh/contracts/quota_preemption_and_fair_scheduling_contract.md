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

## v4.3 Contract Remediation

- T-45: 本文原先不足 60 行，缺少 ContractEnvelope 合规声明与 remediation section。v4.3 要求所有 contract 必须包含 v4.3 Contract Remediation 小节，记录历史偏差与修复结论。修复：本文新增本节，并要求新增对象必须携带 `harness_run_id` / `node_run_id` 关联字段。

