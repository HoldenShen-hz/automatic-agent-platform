# ADR 088: Platform Surface, Communication, and Extensibility

## 状态

Accepted

## 日期

2026-04-20

## 背景

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) 的 `§6`、`§7`、`§8`、`§22`、`§30` 定义了 API、服务通信、可扩展性、SDK/DX、Business Pack / Plugin 治理。这些章节以前分散映射到 API、event bus、plugin SPI、tool/skill/plugin contract，但缺少一个统一 ADR 解释为什么这些边界必须作为平台表面能力统一治理。

## 决策

平台表面能力统一按以下边界治理：

- 外部请求必须先进入 API / Gateway / Webhook / Scheduler 等 Interface Plane，不得直接进入执行层。
- 平面间通信必须优先使用契约化 envelope、typed event、outbox / DLQ 机制，不允许隐式共享状态。
- 扩展能力必须通过 Plugin SPI、Tool / Skill / Plugin contract、Business Pack 生命周期进入平台。
- SDK / DX 只提供受控接入能力，不提供绕过 policy、approval、sandbox、budget 的捷径。
- Business Pack 必须声明 domain、capability、risk、tool bundle、API compatibility，且受同一 extension governance 约束。

## 取舍

- 不为每种 API 或 SDK 动作单独创建 ADR，避免架构决策碎片化。
- 不把 extension runtime 的实现细节写入 ADR；字段、状态、失败语义放入 contracts。
- 不允许“内部 SDK 特权路径”，所有扩展都必须经过统一授权、审计和发布边界。

## 影响

对应 authoritative contracts：

- `api_surface_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `event_bus_contract.md`
- `typed_event_bus_contract.md`
- `event_reliability_matrix_contract.md`
- `plugin_spi_contract.md`
- `tool_skill_plugin_contract.md`
- `ecosystem_extension_plane_contract.md`
- `license_and_capability_boundary_contract.md`

对应实现边界：

- `src/gateway/*`
- `src/platform/state-evidence/events/*`
- `src/domains/registry/*`
- `src/plugins/*`
- `src/scale-ecosystem/marketplace/*`

## 测试要求

- contract tests：API / event / gateway envelope 不得绕过 contract。
- integration tests：event bus、plugin lifecycle、marketplace install / publish 流必须能跨边界运行。
- denial tests：未认证、未授权、未验证、未声明 capability 的扩展不得进入生产执行链。
