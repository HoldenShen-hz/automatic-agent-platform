# ADR-023 服务通信架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

平面内服务和跨平面服务调用需要统一的超时、重连和事件投递机制，避免单点故障和信息丢失。

## 决策

### 超时策略

- 同步调用默认超时：5s
- 最大超时：30s
- 支持 header 覆盖，但不超过 max clamp
- 配置统一在 `config/runtime/default.json`

### 流重连机制

- DurableEventBus 支持 last_event_id 恢复
- 断连后自动从最后一个确认事件继续

### Outbox 模式

- 同事务写事件：业务操作和事件投递必须在同一数据库事务中
- OutboxService (219 行) 实现可靠事件投递
- 确保事件不丢失

### Phase 1 架构

- Phase 1 为单体架构
- 进程内调用走直接函数调用
- 跨进程调用走 HTTP

## 后果

优点：

- 统一超时配置避免请求无限等待
- Outbox 模式保证事件可靠性
- last_event_id 使流重连成为可能

代价：

- Outbox 模式增加事务复杂度
- 超时配置需要全局协调

## 交叉引用

- [ADR-021 平面间通信契约](./021-inter-plane-communication-contract.md)
- [ADR-012 SQLite 是否作为 Phase 1-2 唯一主存储](./012-sqlite-phase-1-2-primary-store.md)

## 来源章节

- `§7` 服务通信架构
