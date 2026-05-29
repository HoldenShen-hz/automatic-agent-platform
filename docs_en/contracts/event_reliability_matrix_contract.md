# Event Reliability Matrix Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR 双链拓扑的事件可靠性要求，对应 ADR-016。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines事件分级、可靠性要求、持久化策略、ack 策略和运维边界。

它补充 `event_bus_contract.md`，把 Tier 1 / 2 / 3 从principle下钻到矩阵。
更细的事件注册table、消费者关系和运维threshold以下钻文档 `event_registry_and_ops_threshold_contract.md` 为准。

## 2. 分级矩阵

| Tier | 保证级别 | 持久化 | ack | 重放 | 适用场景 |
|---|-------|--------| --- | --- | --- |
| `tier1` | 必达 / 可恢复 | 必须先写 DB | 必须按消费者确认 | 必须supported | 任务、审批、Status、恢复链 |
| `tier2` | 尽力送达 | optional持久化 | optional | Recommendationsupported | 重要进度、工具阶段、观测事件 |
| `tier3` | 可丢失 | 可不持久化 | 不要求 | 不要求 | 流式 chunk、heartbeat、transient进度 |

## 3. Ring 1 基线事件

| 事件class型 | Tier | 原因 |
|---|-------|--------|
| `platform.task.created` | `tier1` | 主链事实事件 |
| `platform.task.status_changed` | `tier1` | user主Status |
| `platform.harness.started` | `tier1` | Harness 生命cycle起点 |
| `platform.node.completed` | `tier1` | 下一节点推进relies on |
| `platform.harness.failed` | `tier1` | 恢复vsfailed归因 |
| `approval.requested` | `tier1` | HITL 主链 |
| `approval.resolved` | `tier1` | 恢复执lines前提 |
| `improve.candidate_accepted` | `tier1` | 候选accepts会改变后续策略和 rollout 轨迹 |
| `release.rollout_started` | `tier1` | 发布链起点，需要审计和恢复 |
| `release.rollout_completed` | `tier1` | 发布链终态，需要稳定留痕 |
| `release.rollback_triggered` | `tier1` | 回滚会改写 release 轨迹，必须可恢复 |
| `gateway.message_received` | `tier2` | 渠道输入较重要，但不directly驱动恢复 |
| `feedback.signal_received` | `tier2` | Impact learn / improve，但允许via evidence 补偿恢复 |
| `loop.iteration_completed` | `tier2` | 闭环观测关键事件，但不单独作为 authoritative 业务Status |
| `stream.chunk_emitted` | `tier3` | 展示classtransient流量 |

## 4. writes规则

- Tier 1：先写 `events`，再注册 `event_consumer_acks`，再尝试分发。
- Tier 2：可先 emit 再补持久化。
- Tier 3：defaults to走内存或展示层通道，不要求逐条持久化。

## 5. 运维规则

| 项目 | Tier 1 | Tier 2 | Tier 3 |
|---|-------|--------| --- |
| 丢失告警 | 必须 | optional | 不要求 |
| ack 积压告警 | 必须 | optional | 不要求 |
| 重放工具 | 必须 | optional | 不要求 |
| 消费者幂等要求 | 必须 | Recommendation | Recommendation |

## 6. 关联文档

- `event_bus_contract.md`
- `storage_schema_contract.md`
- `gateway_streaming_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 7. 收口Conclusion

事件分级的核心不is“给事件贴标签”，而is为每class事件明确可accepts的丢失代价和恢复成本。
