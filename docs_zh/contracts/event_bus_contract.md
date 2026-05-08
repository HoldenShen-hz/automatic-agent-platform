# Event Bus Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR 8 阶段的事件总线机制，对应 ADR-016 §双链拓扑 和 ADR-079/ADR-080。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义平台事件总线、事件可靠性等级、持久化要求、命名约定和消费语义。

## 2. 关键对象

- `BusEvent`
- `EventEnvelope`
- `EventTier`
- `EventConsumerAck`
- `EventSchemaRegistry`
- `LoopEventEnvelope`

## 3. EventEnvelope 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 事件唯一 ID |
| `type` | `string` | 事件类型 |
| `tier` | `tier1 \| tier2 \| tier3` | 可靠性等级 |
| `task_id` | `string?` | 关联任务 |
| `session_id` | `string?` | 关联会话 |
| `loop_iteration` | `integer?` | OAPEFLIR 第几轮 |
| `stage` | `string?` | 关联 OAPEFLIR stage |
| `trace_id` | `string?` | 链路追踪 ID |
| `payload` | `json` | 事件正文 |
| `created_at` | `timestamp` | 创建时间 |

规则：

- `EventEnvelope` 只描述事件本体，不承载某个消费者的消费状态。
- 多消费者确认必须通过独立的 ack 记录表达，不能复用单个 `consumed_at` 字段。

## 4. `EventConsumerAck` 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ack_id` | `string` | ack 记录 ID |
| `event_id` | `string` | 目标事件 |
| `consumer_id` | `string` | 消费者稳定标识 |
| `status` | `pending \| acked \| failed \| skipped` | 消费状态 |
| `last_attempt_at` | `timestamp?` | 最近尝试时间 |
| `acked_at` | `timestamp?` | 确认时间 |
| `error_code?` | `string` | 最近失败原因 |

规则：

- Tier 1 事件提交时，必须按注册表为所有必需消费者初始化 `pending` ack 记录。
- `consumer_id` 必须是稳定标识，重启后不得随机变化。
- 重复 ack 同一 `event_id + consumer_id` 默认视为幂等更新，而不是新消费事实。

## 5. 可靠性分级

- `tier1`: 先写 DB 再 emit，必须可恢复。
- `tier2`: 尽力送达，可接受小比例丢失。
- `tier3`: 高频瞬时事件，可优先走内存或流式通道。

## 6. 事件命名约定

统一采用：`<domain><separator><action>`

当前口径：

- 面向业务 / 闭环 / 用户语义的事件，canonical 命名使用点号：`domain.action`。
- 历史 dispatch / worker / recovery / skill 运维事件当前保留冒号格式：`domain:action`。
- 新增 OAPEFLIR、feedback、improve、release 类事件不得再引入新的冒号命名。

Ring 1 之后仍保留的稳定事件类型至少包括：

- `platform.task.status_changed`
- `platform.node.completed`
- `approval.requested`
- `approval.resolved`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `loop.iteration_completed`
- `platform.gateway.message_received`
- `platform.stream.chunk_emitted`
- `dispatch:ticket_created`
- `dispatch:ticket_claimed`
- `dispatch:decision_recorded`
- `worker:claim_accepted`
- `worker:writeback_recorded`
- `takeover:initiated`
- `takeover:completed`
- `recovery:started`
- `recovery:completed`
- `skill:execution_started`
- `skill:execution_completed`

完整注册表见 `event_registry_and_ops_threshold_contract.md`。

规则：

- `domain` 使用稳定名词，不使用实现细节词。
- `action` 使用过去式或完成态语义，避免模糊词。
- 新事件类型进入实现前必须先登记到 schema 注册表。

## 7. Event Schema Registry

每个事件类型都必须在注册表中定义：

- `type`
- `tier`
- `payload_schema`
- `producer`
- `consumers`
- `notes?`

规则：

- `payload_schema` 是 authoritative schema。
- producer 和 consumer 都不得依赖未注册事件类型。
- schema 破坏性变更必须走显式版本演进或新类型。

当前 OAPEFLIR 闭环最少要求以下投影视图事件具有显式 schema：

- `oapeflir.view.observe.signals_collected`
- `oapeflir.view.assess.evaluation_completed`
- `oapeflir.view.plan.proposal_created`
- `feedback.signal_received`
- `learn.object_created`
- `learn.object_promoted`
- `improve.candidate_proposed`
- `improve.candidate_accepted`
- `release.rollout_started`
- `release.rollout_completed`
- `release.rollback_triggered`
- `loop.iteration_completed`

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
- Tier 1 若存在多个消费者，必须按 `event_id + consumer_id` 分别确认。
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
