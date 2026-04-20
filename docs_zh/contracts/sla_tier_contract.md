# SLA Tier Contract

## 1. 范围

本 contract 定义 `§54` 的 SLA 分级模型与 SLA 感知调度。

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

## 4. 运行规则

- SLA tier 必须参与队列、资源保留、抢占和升级。
- breach 检测必须区分排队超时、执行超时和依赖不可用。
- 低 tier 不得饿死高 tier；高 tier 也不得无限制抢占全局资源。

## 5. 测试要求

- unit：tier resolution、breach classification
- integration：SLA-aware scheduling
- contract：已承诺 tier 的对象必须保留可审计的 SLO 证据

