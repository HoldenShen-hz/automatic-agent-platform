# Event Registry And Ops Threshold Contract

## 目的
约束事件注册表与运维阈值之间的关系，确保默认 consumer 集、重放范围和运行阈值有统一来源。

## 权威规则
- 默认 Tier-1 consumer 集来源于事件 schema registry。
- 运维面读取 registry 后生成默认 drain/replay 目标，不允许手工维护第二份 consumer 白名单。
- 事件运维阈值至少覆盖：
  - 单次 replay 超时
  - 单次 drain 超时
  - backlog / failed queue 观测阈值

## 一致性要求
- 注册表新增 consumer 时，event ops 默认消费者集合应自动包含该 consumer。
- registry 与 ops 文档引用必须指向同一 contract，不允许只在代码里隐式约定。

## 相关实现
- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`

