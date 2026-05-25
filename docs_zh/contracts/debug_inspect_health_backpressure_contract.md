# Debug Inspect Health Backpressure Contract

## 目的
定义调试、巡检、健康、背压相关的最小契约基线，约束日志、健康信号、检查结果与背压告警的输出口径。

## 权威实现
- `src/platform/shared/observability/`
- `src/platform/five-plane-control-plane/incident-control/`
- `src/platform/five-plane-interface/channel-gateway/`

## 核心约束
- 健康与背压信号应输出可观测事件、结构化日志或显式状态结果，不能静默吞错。
- inspect/debug 输出属于运维视图，不得伪装成业务 truth。
- 告警阈值可以配置，但缺省情况下必须 fail-closed，而不是把缺失指标当作健康。

## 说明
- 该文档定义的是 contract baseline，不冻结所有 Prometheus 指标名。
- 具体指标、日志字段、事件名以对应实现中的 schema 与 exporter 为准。
