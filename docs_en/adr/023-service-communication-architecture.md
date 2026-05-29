# ADR-023 服务communicationArchitecture

- Status：Accepted
- Decision日期：2026-04-03

## Background

平面内服务和跨平面服务call需要统一的timeout、重连和事件投递机制，避免单点故障和信息丢失。

## Decision

### timeout策略

- synchronouscalldefaults totimeout：5s
- 最大timeout：30s
- supported header 覆盖，但不exceeds过 max clamp
- configure统一在 `config/runtime/default.json`

### 流重连机制

- DurableEventBus supported last_event_id 恢复
- 断连后自动从最后一个确认事件继续

### Outbox 模式

- 同事务写事件：业务操作和事件投递必须在同一data库事务中
- OutboxService (219 lines) 实现可靠事件投递
- 确保事件不丢失

### Phase 1 Architecture

- Phase 1 为单体Architecture
- 进程内call走directlyfunctioncall
- 跨进程call走 HTTP

## Consequences

优点：

- 统一timeoutconfigure避免requestno限等待
- Outbox 模式保证事件可靠性
- last_event_id 使流重连成为可能

代价：

- Outbox 模式增加事务复杂度
- timeoutconfigure需要globally协调

## 交叉references用

- [ADR-021 平面间communication契约](./021-inter-plane-communication-contract.md)
- [ADR-012 SQLite isno作为 Phase 1-2 唯一主storage](./012-sqlite-phase-1-2-primary-store.md)

## 来源章节

- `§7` 服务communicationArchitecture
