# Event Registry And Ops Threshold Contract

## 目的
约束事件注册tablevs运维threshold之间的关系，确保defaults to consumer 集、重放范围和运linesthreshold有统一来源。

## 权威规则
- defaults to Tier-1 consumer 集来源于事件 schema registry。
- 运维面读取 registry 后生成defaults to drain/replay 目标，不允许手工维护第二份 consumer 白名单。
- 事件运维threshold至少覆盖：
  - 单iterations replay timeout
  - 单iterations drain timeout
  - backlog / failed queue 观测threshold

## 一致性要求
- 注册table新增 consumer 时，event ops defaults to消费者集合应自动contains该 consumer。
- registry vs ops 文档references用必须指向同一 contract，不允许只在code里隐式约定。

## Runtime-Service Operational Signals

以下异步 runtime-service 观测信号belongs to contract surface，新增、删除或重命名时必须synchronous更新本节并via CI 审计：

- `event_published`: durable event bus 完成单条事件发布。
- `event_delivered`: durable event bus 完成单个 consumer 投递。
- `event_delivery_failed`: durable event bus 对单个 consumer 投递failed。
- `event_dead_lettered`: durable event bus 将exceeds过threshold的投递送入 dead-letter。
- `subscriber_added`: durable event bus 新增订阅方。
- `subscriber_removed`: durable event bus 移除订阅方。
- `batch_flush`: batching runtime service 执lines批iterations冲刷。
- `circuit_breaker_open`: dispatch / handshake / writeback / event bus / takeover 异步保护器打开。
- `circuit_breaker_close`: dispatch / handshake / writeback / event bus / takeover 异步保护器关闭。
- `operation_start`: dispatch / handshake / takeover 异步操作开始。
- `operation_complete`: dispatch / handshake / takeover 异步操作结束。
- `operation_retry`: dispatch / handshake / takeover 异步操作进入重试。
- `operation_timeout`: dispatch / handshake / takeover 异步操作timeout。
- `queue_overflow`: dispatch / handshake / writeback / takeover 异步队列达到upper limit。
- `writeback_start`: worker writeback 异步写回开始。
- `writeback_complete`: worker writeback 异步写回结束。
- `writeback_retry`: worker writeback 异步写回进入重试。
- `writeback_timeout`: worker writeback 异步写回timeout。
- `writeback_coalesced`: worker writeback 合并窗口将多iterations写回收敛为单iterations提交。
- `session_opened`: async human takeover service 打开人工接管会话。
- `session_closed`: async human takeover service 关闭人工接管会话。

### 约束

- 上述信号的命名权威来源is `src/scale-ecosystem/runtime-services/*.ts` 中对外 `type` union，而不is日志自由文本。
- 这些信号used for可观测性、容量保护vs运linesStatus审计；它们不is业务领域事件 schema 的替代品。
- 若多个 runtime service 复用同名信号，必须保持语义层级一致，例如 `operation_*` table示异步操作生命cycle，`circuit_breaker_*` table示保护器Status转换。

## 相关实现
- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`
- `src/scale-ecosystem/runtime-services/durable-event-bus-async.ts`
- `src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts`
- `src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts`
- `src/scale-ecosystem/runtime-services/human-takeover-service-async.ts`
