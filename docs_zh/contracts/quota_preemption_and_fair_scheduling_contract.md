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

