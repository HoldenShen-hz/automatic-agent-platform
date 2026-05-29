# SLA Tier Contract

## 1. 范围

本 contract defines `§54` 的 SLA 分级模型vs SLA 感知调度。

## 2. Canonical 对象

- `SlaTier`
- `SlaCommitment`
- `SlaRoutingHint`
- `SlaBreachRecord`

## 3. `SlaTier` 最小字段

- `tier_id`
- `display_name`
- `target_latency_ms`
- `target_success_rate`
- `max_queue_wait_ms`
- `preemption_priority`
- `reserved_capacity_percent`

## 4. 运lines规则

- SLA tier 必须参vs队列、资源保留、抢占和升级。
- breach 检测必须区分排队timeout、执linestimeout和relies on不可用。
- 低 tier 不得饿死高 tier；高 tier 也不得no限制抢占globally资源。
- SLA 证据至少要能回链到 `harness_run_id`、`node_run_id` vs对应 `NodeAttemptReceipt`。
- `platinum` 等级只有在 failover、quorum、演练vs容量保留证据全部就绪时才能对外承诺。

## 5. 测试要求

- unit：tier resolution、breach classification
- integration：SLA-aware scheduling
- contract：已承诺 tier 的对象必须保留可审计的 SLO 证据

## v4.3 Contract Remediation

- T-73: 本文原先只defines SLA 等级本身，没有绑定运lines链证据vs高等级前置条件，Root cause:  SLA contract 先写了业务承诺，后补 runtime 可验证性。修复：正文现要求 SLA 证据回链到 `HarnessRun / NodeRun / NodeAttemptReceipt`，并把 `platinum` 前置条件显式化。
