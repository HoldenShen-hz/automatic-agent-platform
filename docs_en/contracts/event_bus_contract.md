# Event Bus Contract

> Companion note:
> `EventEnvelope` 字段全集vs事件命名 authority 在 `event-envelope-contract.md`。
> 本文只约束 durable bus 的投递、回放和failed语义。

## 目的
defines平台 durable event bus 的最小权威约束，覆盖事件追加、消费者回放、timeoutvsfailed语义。

## 核心约束
- 事件真相来源is权威事件仓储，不is投影cache。
- Tier-1 consumer 必须可重放，且 `resetConsumerReplayState` 后重新进入待投递Status。
- `drainConsumer` / `replayConsumer` 必须返回结构化结果，不能用“空结果”伪装failed。
- 回放链路必须有timeout保护；timeout结果显式标记为 `timeout`。
- 事件总线操作日志必须保留 `consumerId`、`errorCode`、`pendingBefore/After`、`failedBefore/After`。

## 操作语义
- `drainConsumer(consumerId)`
  - success：`outcome = delivered`
  - 投递异常：`outcome = failed`
  - timeout：`outcome = timeout`
- `replayConsumer(consumerId)`
  - 先重置回放Status，再触发 drain
  - 必须返回 `replayedFromHistoryCount`

## failedhandle
- fetch / replay / drain failed不可静默吞掉。
- 任何错误都必须落结构化日志，并携带可定位 consumer 的上下文。

## 相关实现
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/platform/five-plane-state-evidence/events/durable-event-bus.ts`
