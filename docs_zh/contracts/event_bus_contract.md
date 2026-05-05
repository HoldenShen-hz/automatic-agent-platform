# Event Bus Contract

> **v4.3 兼容说明**：本文件定义总线语义、命名空间和消费约束。`EventEnvelope` canonical 字段以 [event-envelope-contract.md](./event-envelope-contract.md) 为准；truth event 只能使用 `platform.*`，`oapeflir.view.*` / `oapeflir.rationale.*` 只作为 projection。

> **更新日期**：2026-05-01

## 1. 范围

本 contract 定义平台事件总线、事件可靠性等级、持久化要求、命名约定和消费语义。

## 2. 关键对象

- `EventEnvelope`
- `EventTier`
- `EventConsumerAck`
- `EventSchemaRegistry`
- `RegisteredEventType`

## 3. EventEnvelope 与关联锚点

canonical `EventEnvelope` 字段见 [event-envelope-contract.md](./event-envelope-contract.md)。

本层额外约束：

- truth event 的关联锚点必须使用 `runId + aggregateType + aggregateId + aggregateSeq`。
- 若 payload 需要暴露具体运行链对象，必须优先使用 `harnessRunId`、`nodeRunId`、`planGraphId`、`attemptId`。
- `task_id`、`workflow_id`、`execution_id` 只允许出现在 legacy compatibility adapter 中，不得作为新事件 payload 的主关联字段。
- `EventEnvelope` 只描述事件本体，不承载某个消费者的消费状态。
- 多消费者确认必须通过独立 ack 记录表达，不能复用单个 `consumed_at` 字段。

## 4. EventConsumerAck

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ackId` | `string` | ack 记录 ID |
| `eventId` | `string` | 目标事件 |
| `consumerId` | `string` | 消费者稳定标识 |
| `status` | `pending \| acked \| failed \| skipped` | 消费状态 |
| `lastAttemptAt` | `timestamp?` | 最近尝试时间 |
| `ackedAt` | `timestamp?` | 确认时间 |
| `errorCode` | `string?` | 最近失败原因 |

规则：

- Tier 1 事件提交时，必须按注册表为所有必需消费者初始化 `pending` ack 记录。
- `consumerId` 必须是稳定标识，重启后不得随机变化。
- 重复 ack 同一 `eventId + consumerId` 默认视为幂等更新，而不是新消费事实。

## 5. 可靠性分级

- `tier1`: 先写 DB 再 emit，必须可恢复。
- `tier2`: 尽力送达，可接受小比例丢失。
- `tier3`: 高频瞬时事件，可优先走内存或流式通道。

## 6. 事件命名约定

统一采用：`<namespace>.<aggregate_or_domain>.<action>`

规则：

- truth event namespace 只能是 `platform.*`。
- OAPEFLIR 视图 / 解释事件只能是 `oapeflir.view.*` 或 `oapeflir.rationale.*`。
- `dispatch:*` / `worker:*` / `takeover:*` / `recovery:*` / `skill:*` 可以继续作为运维诊断或 compatibility 事件存在，但不得冒充 truth fact。
- 新增 event type 不得再把 `task.*`、`workflow.*`、`execution.*` 作为 canonical 运行事实命名。

Ring 1 之后仍保留的稳定 canonical 事件类型至少包括：

- `platform.harness_run.created`
- `platform.harness_run.admitted`
- `platform.harness_run.planning`
- `platform.harness_run.ready`
- `platform.harness_run.status_changed`
- `platform.harness_run.completed`
- `platform.harness_run.aborted`
- `platform.node_run.created`
- `platform.node_run.admitted`
- `platform.node_run.ready`
- `platform.node_run.status_changed`
- `platform.node_run.completed`
- `platform.node_run.failed`
- `platform.node_run.skipped`
- `platform.budget.reservation_created`
- `platform.budget.reservation_released`
- `platform.budget.exhausted`
- `platform.release.started`
- `platform.release.completed`
- `platform.release.rollback_triggered`
- `platform.approval.requested`
- `platform.approval.resolved`
- `platform.feedback.signal_received`
- `platform.learn.object_created`
- `platform.learn.object_promoted`
- `platform.improve.candidate_proposed`
- `platform.improve.candidate_accepted`
- `platform.loop.iteration_completed`
- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`

legacy / compatibility 映射：

- `platform.harness.run.*` -> `platform.harness_run.*`
- `platform.node.run.*` -> `platform.node_run.*`
- `approval.*` -> `platform.approval.*`（若承载 truth fact）
- `feedback.*` -> `platform.feedback.*`（若承载 truth fact）
- `learn.*` -> `platform.learn.*`（若承载 truth fact）
- `improve.*` -> `platform.improve.*`（若承载 truth fact）
- `release.*` -> `platform.release.*`（若承载 truth fact）
- `loop.*` -> `platform.loop.*`（若承载 truth fact）

## 7. Event Schema Registry

每个事件类型都必须在注册表中定义：

- `type`
- `tier`
- `payloadSchemaRef`
- `producer`
- `consumers`
- `compatibilityPolicy`
- `notes?`

规则：

- `payloadSchemaRef` 是 authoritative schema。
- producer 和 consumer 都不得依赖未注册事件类型。
- schema 破坏性变更必须走显式版本演进或新类型。

当前 OAPEFLIR 闭环最少要求以下事件具有显式 schema：

- `platform.harness_run.status_changed`
- `platform.node_run.status_changed`
- `platform.release.started`
- `platform.release.completed`
- `platform.release.rollback_triggered`
- `platform.feedback.signal_received`
- `platform.learn.object_created`
- `platform.improve.candidate_proposed`
- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`

## 8. StreamBridge 与 EventBus 边界

- EventBus 负责平台事实事件和可恢复事件语义。
- StreamBridge 负责把事件或进度翻译成渠道展示流。
- `stream.chunk_emitted` 可以是 EventBus 事件，但展示 chunk 本身不是上位事实源。
- 高频展示类流量可走 `tier3` 或仅走 StreamBridge，不得污染 `tier1` 恢复链。

## 9. 行为约束

- Tier 1 事件必须支持重放。
- 消费方必须是幂等的。
- 事件类型应稳定命名，不频繁变更。
- stream 类高频事件不应强制走重型持久化路径。
- Tier 1 若存在多个消费者，必须按 `eventId + consumerId` 分别确认。
- 单个消费者的失败不得覆盖其他消费者的确认状态。
- 启动补发时，必须只重放仍处于 `pending / failed` 的目标消费者，而不是重新广播给所有已确认消费者。

## 10. 失败语义

- emit 失败但已持久化：允许稍后重放。
- 消费失败：按消费者策略重试，不得直接删除 Tier 1 事件。
- 重复消费：消费者必须安全处理。
- 若某消费者长期未 ack，应通过 ack 表识别，而不是把整条事件视为“未消费”。

## 11. 补充规则

- 事件注册表在文档层 authoritative，代码层应映射到集中 schema registry 模块。
- 升级到跨进程总线时，事件类型名、tier 和 payload schema 保持不变，变化只发生在 transport 层。
- `release.*` 裸命名空间既不是 v4.3 truth namespace，也不是 OAPEFLIR 视图 namespace；若仍存在，必须在边界层显式映射到 `platform.release.*` 或 `oapeflir.view.release.*`。
