# Ecosystem Extension Plane Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义扩展生态平面，包括 capability registry、Domain Registry、plugin SPI、domain tool bundle、review pipeline、marketplace、兼容性与撤销机制。

它扩展 [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md)，用于回答“外部扩展如何被安全接入、注册、发布、升级、禁用和回滚”。

## 2. 目标

- 让 tool / skill / plugin / MCP 扩展进入统一生态治理模型。
- 明确 capability 声明、审核、版本兼容、撤销和 domain 绑定路径。
- 避免第三方扩展打穿平台安全边界。
- 为 `M2-EXT-01` 的 `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` 留出明确合同边界。

## 3. Canonical 组件

- `CapabilityRegistry`
- `DomainRegistry`
- `DomainToolBundleRegistry`
- `PluginSpiRegistry`
- `ExtensionReviewPipeline`
- `MarketplaceCatalog`
- `CompatibilityResolver`
- `RevocationService`

## 4. Canonical 对象

- `CapabilityDefinition`
- `DomainCapabilityRegistryEntry`
- `ExtensionPackage`
- `PluginManifest`
- `PluginSpiRegistration`
- `ReviewDecision`
- `CompatibilityMatrix`
- `RevocationRecord`

## 5. Domain Capability Registry

### 5.1 `CapabilityDefinition` 最小字段

- `capability_id`
- `provider_type`
- `declared_permissions`
- `risk_level`
- `version`
- `owner_ref`

### 5.2 `DomainCapabilityRegistryEntry` 最小字段

- `domain_id`
- `bundle_id`
- `capability_ids`
- `tool_names`
- `skill_ids`
- `plugin_ids`
- `knowledge_namespaces?`
- `default_activation_policy`
- `trust_tier`

规则：

- 所有扩展都必须先声明 capability，再进入执行链。
- domain bundle 绑定是 capability 暴露给具体 domain 的权威入口。
- runtime 不得加载未通过 compatibility、permission 和 trust gate 的扩展包。

## 6. Plugin SPI 集成

extension plane 统一承认四类 SPI：

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

`PluginSpiRegistration` 至少记录：

- `plugin_id`
- `spi_type`
- `domain_id?`
- `capability_ids`
- `lifecycle_state`
- `runtime_isolation`
- `cooldown_until?`
- `runtime_process_id?`
- `runtime_sandbox_root?`
- `last_invocation_started_at?`
- `last_invocation_completed_at?`
- `sdk_surface`
- `registered_at`

规则：

- lifecycle 至少覆盖 `registered -> loaded -> active -> inactive -> unloaded`。
- 当前 authoritative runtime isolation 允许 `shared_process`、`serialized_in_process`、`forked_process`、`sandboxed_process` 与 `containerized_process`。
- `forked_process` 表示独立子进程隔离基线；`sandboxed_process` 表示独立子进程 + 专属 sandbox root + 最小 env 白名单 + Node permission model 的更强隔离模式。
- `containerized_process` 表示 launcher-based 的外部隔离 runtime 接口，可由 `docker` / `podman` / `bwrap` 或等价独立沙箱 launcher 承载；宿主与 child 之间通过 stdio JSON protocol 通信。
- `sandboxed_process` 与 `containerized_process` 都不应被直接表述为已完成的 OCI orchestrator、VM 或 microVM fleet 编排；当前仓库提供的是可审计的 isolated runtime host 与 launcher 接口，而真实 live infra 仍需目标环境验证。
- isolated failure 可把 plugin 置为 `degraded` 或 `disabled`，并可附带 cooldown 窗口；cooldown 状态必须可被 inventory、diagnostics 或 API 查询。
- 若启用 `forked_process`、`sandboxed_process` 或 `containerized_process`，runtime process id 应可被 inventory、diagnostics 或 API 查询，且宿主进程必须能在 unload / shutdown 时回收子进程。
- 若启用 `sandboxed_process` 或 `containerized_process`，runtime sandbox root 也应可被 inventory、diagnostics 或 API 查询，以便 operator 做隔离根目录审计。
- plugin invocation 至少应发布 `plugin:invocation_started` 与 `plugin:invocation_completed` typed audit 事件，供审计和反馈投影消费。
- SPI 注册结果必须能被 inventory、diagnostics 和审计系统查询。
- plugin 只能通过 public SDK surface 与 core 交互，不得 reach-in 私有实现。

## 7. Review 与发布流水线

review workflow 至少包含：

1. 提交
2. 静态校验
3. 权限审查
4. 兼容性检查
5. 人工审核
6. 发布
7. 撤销或回滚

`ReviewDecision` 最小字段：

- `decision_id`
- `extension_id`
- `status`
- `reason_codes`
- `reviewed_permissions`
- `compatibility_result`
- `signed_off_by`
- `decided_at`

补充规则：

- marketplace 发布必须经过 review decision。
- 已发布扩展必须支持 revoke / disable / rollback。
- extension package 应支持签名或等价完整性校验。

## 8. Compatibility Matrix

semantic version 兼容性至少分三层：

- `api_contract`
- `permission_surface`
- `runtime_capability`

`CompatibilityMatrix` 至少覆盖：

- `plugin_api_range`
- `built_with_platform_version`
- `min_runtime_version`
- `supported_domain_ids`
- `breaking_changes`

规则：

- `enabled` 不代表兼容；compatibility gate 未通过时必须 fail-close。
- domain bundle 升级若引入更高权限或 trust tier 变化，必须重新 review。

## 9. 撤销与回滚

`RevocationRecord` 至少包含：

- `revocation_id`
- `target_type`
- `target_id`
- `reason`
- `scope`
- `rollback_target?`
- `created_at`

撤销触发场景至少包括：

- 权限面超出声明
- 签名失效或来源不可信
- compatibility regression
- sandbox / policy escape
- domain bundle 误绑定

## 10. 与现有文档的关系

- [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) 定义内部注册、authoring 和 SPI 基线。
- `sandbox_and_auth_contract.md` 提供扩展执行的安全边界。
- `api_surface_contract.md`、`admin_console_and_human_takeover_contract.md` 负责 extension plane 的管理入口。

## 11. 分阶段边界

### 当前 phase1-4 authoritative 范围

- capability 声明必须存在
- manifest / compatibility / permission / trust 的 contract 边界必须明确
- domain bundle、plugin SPI、marketplace 可以作为设计边界存在，但当前不应被表述为 fully operational production plane

### `M2` target-state 范围

- Domain Registry 作为统一注册后端
- per-domain tool bundle 完整控制面
- plugin SPI 大规模集成
- marketplace 发布、审核、撤销和回滚自动化

因此本 contract 主要承担 target-state extension plane 的治理定义；当前 readiness 只能把它视为边界文档，而不是已完成交付证明。
