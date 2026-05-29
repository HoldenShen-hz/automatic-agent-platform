# Ecosystem Extension Plane Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines扩展生态平面，includes capability registry、Domain Registry、plugin SPI、domain tool bundle、review pipeline、marketplace、兼容性vs撤销机制。

它扩展 [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md)，used for回答“外部扩展如何被security接入、注册、发布、升级、disabled和回滚”。

## 2. 目标

- 让 tool / skill / plugin / MCP 扩展进入统一生态治理模型。
- 明确 capability 声明、审核、版本兼容、撤销和 domain 绑定路径。
- 避免第三方扩展打穿平台security边界。
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

- 所有扩展都必须先声明 capability，再进入执lines链。
- domain bundle 绑定is capability 暴露给具体 domain 的权威入口。
- runtime 不得加载未via compatibility、permission 和 trust gate 的扩展包。

## 6. Plugin SPI 集成

extension plane 统一承认四class SPI：

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

`PluginSpiRegistration` 至少record：

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
- 当前 authoritative runtime isolation 允许 `shared_process`、`serialized_in_process`、`forked_process`、`sandboxed_process` vs `containerized_process`。
- `forked_process` table示独立子进程隔离基线；`sandboxed_process` table示独立子进程 + 专属 sandbox root + 最小 env 白名单 + Node permission model 的更强隔离模式。
- `containerized_process` table示 launcher-based 的外部隔离 runtime 接口，可由 `docker` / `podman` / `bwrap` 或等价独立沙箱 launcher 承载；宿主vs child 之间via stdio JSON protocol communication。
- `sandboxed_process` vs `containerized_process` 都不应被directlytable述为completed的 OCI orchestrator、VM 或 microVM fleet 编排；当前仓库提供的is可审计的 isolated runtime host vs launcher 接口，而真实 live infra 仍需目标环境验证。
- isolated failure 可把 plugin 置为 `degraded` 或 `disabled`，并可附带 cooldown 窗口；cooldown Status必须可被 inventory、diagnostics 或 API 查询。
- 若enabled `forked_process`、`sandboxed_process` 或 `containerized_process`，runtime process id 应可被 inventory、diagnostics 或 API 查询，且宿主进程必须能在 unload / shutdown 时回收子进程。
- 若enabled `sandboxed_process` 或 `containerized_process`，runtime sandbox root 也应可被 inventory、diagnostics 或 API 查询，以便 operator 做隔离根目录审计。
- plugin invocation 至少应发布 `plugin:invocation_started` vs `plugin:invocation_completed` typed audit 事件，供审计和反馈投影消费。
- SPI 注册结果必须能被 inventory、diagnostics 和审计系统查询。
- plugin 只能via public SDK surface vs core 交互，不得 reach-in 私有实现。

## 7. Review vs发布流水线

review workflow 至少contains：

1. 提交
2. 静态校验
3. permission审查
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

- marketplace 发布必须via过 review decision。
- 已发布扩展必须supported revoke / disable / rollback。
- extension package 应supported签名或等价完整性校验。

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

- `enabled` 不代table兼容；compatibility gate 未via时必须 fail-close。
- domain bundle 升级若references入更高permission或 trust tier 变化，必须重新 review。

## 9. 撤销vs回滚

`RevocationRecord` 至少contains：

- `revocation_id`
- `target_type`
- `target_id`
- `reason`
- `scope`
- `rollback_target?`
- `created_at`

撤销触发场景至少includes：

- permission面exceeds出声明
- 签名失效或来源不可信
- compatibility regression
- sandbox / policy escape
- domain bundle 误绑定

## 10. vs现有文档的关系

- [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) defines内部注册、authoring 和 SPI 基线。
- `sandbox_and_auth_contract.md` 提供扩展执lines的security边界。
- `api_surface_contract.md`、`admin_console_and_human_takeover_contract.md` 负责 extension plane 的manage入口。

## 11. 分阶段边界

### 当前 phase1-4 authoritative 范围

- capability 声明必须存在
- manifest / compatibility / permission / trust 的 contract 边界必须明确
- domain bundle、plugin SPI、marketplace 可以作为设计边界存在，但当前不应被table述为 fully operational production plane

### `M2` target-state 范围

- Domain Registry 作为统一注册后端
- per-domain tool bundle 完整Control Plane
- plugin SPI 大规模集成
- marketplace 发布、审核、撤销和回滚自动化

因此本 contract 主要承担 target-state extension plane 的治理defines；当前 readiness 只能把它视为边界文档，而不iscompleted交付证明。
