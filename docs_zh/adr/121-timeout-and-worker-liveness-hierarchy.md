# ADR-121 Timeout 与 Worker Liveness Hierarchy

- 状态：Accepted
- 决策日期：2026-05-25

## 背景

接口层、网关层、执行层都已经有超时/心跳参数，但此前没有统一说明它们的层级关系，导致 review 把多个不同目标的阈值混为一谈。

## 决策

### 1. HTTP 超时层级

- server socket timeout 必须大于等于 request handler timeout。
- request handler timeout 必须大于等于下游 channel gateway/request adapter timeout。
- 默认语义：
  - socket timeout 负责连接生命周期上界
  - handler timeout 负责单次 API 处理上界
  - gateway timeout 负责单次外呼上界

### 2. Worker 心跳阈值

- `DEFAULT_WORKER_HEARTBEAT_STALENESS_MS` 是本地 dispatch/handshake 的 worker liveness gate。
- 它用于快速判断“此 worker 当前是否可被调度”，不是跨 region failover 的 RTO SLA。
- cross-region RTO 仍由 failover / health-check / reconciliation 体系负责。

### 3. 原则

- 本地 liveness gate 可以比跨区域 RTO 严格得多。
- 不允许把 “worker stale” 直接解释为 “应立即触发 region failover”。
- 调度阈值与 failover 阈值必须分别调优、分别观测。

## 结果

- `30s` worker heartbeat stale threshold 与 `minutes` 级 region RTO 目标不再被视为语义冲突。
- 超时配置的设计意图从“数值凑巧相等”改为“明确分层、各司其职”。
