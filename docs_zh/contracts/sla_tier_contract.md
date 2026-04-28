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
- SLA 证据至少要能回链到 `harness_run_id`、`node_run_id` 与对应 `NodeAttemptReceipt`。
- `platinum` 等级只有在 failover、quorum、演练与容量保留证据全部就绪时才能对外承诺。

## 4A. HarnessRun / NodeRun 集成点

| 集成场景 | 必填字段 | 说明 |
| --- | --- | --- |
| SLA 承诺绑定 | `harness_run_id`、`tier_id` | 每个 HarnessRun 必须携带 SLA tier 标识 |
| 延迟追踪 | `harness_run_id`、`node_run_id`、`queued_at`、`started_at`、`completed_at` | 用于计算队列等待与执行延迟 |
| 成功率统计 | `harness_run_id`、`node_run_id`、`attempt_id`、`status` | 按 `NodeAttemptReceipt.status` 聚合 |
| 预算关联 | `harness_run_id`、`node_run_id`、`budget_reservation_id` | 用于 SLA 成本核算 |
| 断点回链 | `harness_run_id`、`node_run_id`、`receipt_id` | `SlaBreachRecord` 必须引用 `NodeAttemptReceipt` |

**v4.3 Remediation**：原文档仅声明"回链到 HarnessRun/NodeRun"，未明确集成字段列表。修复：正文现补充上表，明确每种集成场景的必填字段，确保实现侧有一致锚点。

## 5. 测试要求

- unit：tier resolution、breach classification
- integration：SLA-aware scheduling
- contract：已承诺 tier 的对象必须保留可审计的 SLO 证据

## v4.3 Contract Remediation

- T-73: 本文原先只定义 SLA 等级本身，没有绑定运行链证据与高等级前置条件，根因是 SLA contract 先写了业务承诺，后补 runtime 可验证性。修复：正文现要求 SLA 证据回链到 `HarnessRun / NodeRun / NodeAttemptReceipt`，并把 `platinum` 前置条件显式化。
