# ADR-121 Timeout vs Worker Liveness Hierarchy

- Status：Accepted
- Decision日期：2026-05-25

## Background

接口层、网关层、执lines层都已via有timeout/心跳参数，但此前没有统一Description它们的层级关系，导致 review 把多个不同目标的threshold混为一谈。

## Decision

### 1. HTTP timeout层级

- server socket timeout 必须大于等于 request handler timeout。
- request handler timeout 必须大于等于下游 channel gateway/request adapter timeout。
- defaults to语义：
  - socket timeout 负责connect生命cycle上界
  - handler timeout 负责单iterations API handle上界
  - gateway timeout 负责单iterations外呼上界

### 2. Worker 心跳threshold

- `DEFAULT_WORKER_HEARTBEAT_STALENESS_MS` is本地 dispatch/handshake 的 worker liveness gate。
- 它used for快速判断“此 worker 当前isno可被调度”，不is跨 region failover 的 RTO SLA。
- cross-region RTO 仍由 failover / health-check / reconciliation 体系负责。

### 3. principle

- 本地 liveness gate 可以比跨区域 RTO 严格得多。
- 不允许把 “worker stale” directly解释为 “应立即触发 region failover”。
- 调度thresholdvs failover threshold必须分别调优、分别观测。

## 结果

- `30s` worker heartbeat stale threshold vs `minutes` 级 region RTO 目标不再被视为semantic conflict。
- timeoutconfigure的设计意图从“数值凑巧相等”改为“明确分层、各司其职”。
