# ADR 088: Platform Surface, Communication, and Extensibility

- Status：Accepted
- Decision日期：2026-04-20

## Background

[`../architecture/00-platform-architecture.md`](../architecture/00-platform-architecture.md) 的 `§6`、`§7`、`§8`、`§22`、`§30` defines了 API、服务communication、可扩展性、SDK/DX、Business Pack / Plugin 治理。这些章节以前分散映射到 API、event bus、plugin SPI、tool/skill/plugin contract，但缺少一个统一 ADR 解释为什么这些边界必须作为平台table面能力统一治理。

## Decision

平台table面能力统一按以下边界治理：

- 外部request必须先进入 API / Gateway / Webhook / Scheduler 等 Interface Plane，不得directly进入执lines层。
- 平面间communication必须优先uses契约化 envelope、typed event、outbox / DLQ 机制，不允许隐式共享Status。
- 扩展能力必须via Plugin SPI、Tool / Skill / Plugin contract、Business Pack 生命cycle进入平台。
- SDK / DX 只提供受控接入能力，不提供bypassing policy、approval、sandbox、budget 的捷径。
- Business Pack 必须声明 domain、capability、risk、tool bundle、API compatibility，且受同一 extension governance 约束。

## 取舍

- 不为每种 API 或 SDK 动作单独创建 ADR，避免ArchitectureDecision碎片化。
- 不把 extension runtime 的implementation detailswrites ADR；字段、Status、failed语义放入 contracts。
- 不允许“内部 SDK 特权路径”，所有扩展都必须via过统一authorization、审计和发布边界。

## Impact

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
- `src/platform/five-plane-state-evidence/events/*`
- `src/domains/registry/*`
- `src/plugins/*`
- `src/scale-ecosystem/marketplace/*`

## 测试要求

- contract tests：API / event / gateway envelope 不得bypassing contract。
- integration tests：event bus、plugin lifecycle、marketplace install / publish 流必须能跨边界运lines。
- denial tests：未authentication、未authorization、未验证、未声明 capability 的扩展不得进入生产执lines链。

## 备选方案

1. **为每种 API/SDK 动作单独创建 ADR**：避免ArchitectureDecision碎片化，但导致 ADR count膨胀，难以维护一致性。
2. **将 extension runtime implementation detailswrites ADR**：信息更全面，但 ADR 变得臃肿，且实现变更需要更新 ADR。
3. **允许"内部 SDK 特权路径"**：降低开发门槛，但破坏平台边界，增加security风险。
4. **采用本Decision**：统一治理平台table面，平衡扩展性vssecurity性。

## 交叉references用

- [ADR-071 Plugin SPI 框架](./071-plugin-spi-framework.md)
- [ADR-089 AI Operations 治理vs质量](./089-ai-operations-governance-and-quality.md)

## 来源章节

- `§6 Interface Plane`
- `§7 Platform Contracts`
- `§8 Extensibility`
- `§22 SDK/DX`
- `§30 Business Pack / Plugin`
