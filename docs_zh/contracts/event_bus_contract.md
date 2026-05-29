# Event Bus Contract

> Companion note:
> `EventEnvelope` 字段全集与事件命名 authority 在 `event-envelope-contract.md`。
> 本文只约束 durable bus 的投递、回放和失败语义。

## 目的
定义平台 durable event bus 的最小权威约束，覆盖事件追加、消费者回放、超时与失败语义。

## 核心约束
- 事件真相来源是权威事件仓储，不是投影缓存。
- Tier-1 consumer 必须可重放，且 `resetConsumerReplayState` 后重新进入待投递状态。
- `drainConsumer` / `replayConsumer` 必须返回结构化结果，不能用“空结果”伪装失败。
- 回放链路必须有超时保护；超时结果显式标记为 `timeout`。
- 事件总线操作日志必须保留 `consumerId`、`errorCode`、`pendingBefore/After`、`failedBefore/After`。

## 操作语义
- `drainConsumer(consumerId)`
  - 成功：`outcome = delivered`
  - 投递异常：`outcome = failed`
  - 超时：`outcome = timeout`
- `replayConsumer(consumerId)`
  - 先重置回放状态，再触发 drain
  - 必须返回 `replayedFromHistoryCount`

## 失败处理
- fetch / replay / drain 失败不可静默吞掉。
- 任何错误都必须落结构化日志，并携带可定位 consumer 的上下文。

## 相关实现
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/platform/five-plane-state-evidence/events/durable-event-bus.ts`
