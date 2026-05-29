# Debug Inspect Health Backpressure Contract

## 目的
defines调试、巡检、健康、背压相关的最小契约基线，约束日志、健康信号、检查结果vs背压告警的输出口径。

## 权威实现
- `src/platform/shared/observability/`
- `src/platform/five-plane-control-plane/incident-control/`
- `src/platform/five-plane-interface/channel-gateway/`

## 核心约束
- 健康vs背压信号应输出可观测事件、结构化日志或显式Status结果，不能静默吞错。
- inspect/debug 输出belongs to运维视图，不得as业务 truth。
- 告警threshold可以configure，但缺省情况下必须 fail-closed，而不is把缺失指标当作健康。

## Description
- 该文档defines的is contract baseline，不冻结所有 Prometheus 指标名。
- 具体指标、日志字段、事件名以对应实现中的 schema vs exporter 为准。
