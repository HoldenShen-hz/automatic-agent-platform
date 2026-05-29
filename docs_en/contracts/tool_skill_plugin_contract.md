# Tool Skill Plugin Contract

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

本 contract defines工具、技能、插件vs MCP 扩展的注册、permission、relies on、生命cycle和执lines边界。

当前 authoritative 范围is phase1-4 已落地的工具vs技能治理；Plugin SPI、Domain Registry 和 marketplace 平台化能力belongs to `M2` 扩展面，允许在本文defines接口，但不得误写为当前全部已交付。

## 2. Canonical 对象

- `ToolDefinition`
- `SkillDefinition`
- `PluginManifest`
- `PluginSpiRegistration`
- `McpBinding`
- `DomainToolBundle`

## 3. ToolDefinition 最小字段

- `tool_name`
- `description`
- `input_schema`
- `output_schema`
- `risk_level`
- `permissions`
- `execution_metadata`
- `model_overrides?`
- `recovery_policy?`
- `idempotency_hint?`

约束：

- tool 的 authoritative 输入defines优先来自结构化 schema，再统一派生模型侧 / API 侧 schema。
- tool 的恢复、security和路径语义以下钻文档 `tool_metadata_and_recovery_contract.md` 为准。
- 原生 wire-format tool call 永远优先；兼容 fallback 只能限制在已注册工具白名单内，并带显式审计标记。

## 4. SkillDefinition 最小字段

- `skill_id`
- `description`
- `applicable_roles`
- `required_tools`
- `steps`
- `version`
- `model_profile_name?`
- `activation_conditions?`
- `activation_paths?`
- `cacheable?`
- `cache_ttl_seconds?`

约束：

- skill 只能编排已authorization工具，不能隐式扩权。
- 若 step 声明 `model_overrides`，override 目标工具也必须已在允许集合内。
- 未满足 `activation_conditions` / `activation_paths` 的 skill 可以保留在 registry 中，但defaults to不进入模型可见面。

## 5. Plugin Manifest vs SPI class型

### 5.1 `PluginManifest` 最小字段

- `plugin_id`
- `name`
- `version`
- `owner`
- `capabilities`
- `spi_types`
- `trust_level`
- `settings_schema?`
- `auth_requirements?`
- `plugin_api_range?`
- `built_with_platform_version?`
- `min_runtime_version?`
- `lifecycle_state?`
- `public_sdk_surface`

规则：

- 所有 plugin / extension 必须以 manifest 作为 authoritative 注册输入。
- extension / plugin 生产code只能via公共 SDK surface vs core 交互，不得directlyimport core 私有模块或其他 extension 私有实现。
- 若 plugin 需要新的 runtime seam，应优先新增明确 public SDK subpath 或 facade，而不is暴露私有实现文件。

### 5.2 Plugin SPI 四class canonical 接口

`§K` 要求当前文档体系统一到四class SPI：

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

最小接口语义：

```ts
interface PluginLifecycleContext {
  pluginId: string;
  domainId?: string;
  capabilityIds: string[];
}

interface DomainRetrieverPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  retrieve(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainValidatorPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  validate(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainPlannerPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  plan(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainPresenterPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  present(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}
```

约束：

- `onLoad / onActivate / onDeactivate / onUnload` 为 plugin lifecycle 的 canonical hook。
- hook failed不得提升permission；defaults to降级为disabled该 SPI 实例或阻断加载。
- SPI 只能消费 manifest 声明过的 capability vs setting，不得运lines时偷偷扩权。

## 6. Lifecycle vsStatus机

plugin lifecycle 至少覆盖：

`discovered -> installed -> enabled -> disabled -> reloaded -> removed`

SPI runtime lifecycle 至少覆盖：

`registered -> loaded -> active -> inactive -> unloaded`

补充规则：

- `enabled` 不等于 `active`；只有via compatibility、permission 和 trust gate 后才允许进入 active。
- `reloaded` 必须保留前后版本、configure摘要和错误原因，方便审计vs回滚。
- trust warning、permission retry、plugin settings 只能作为体验层security阀，不能替代 runtime policy、sandbox 和 capability boundary。
- SPI runtime lifecycle Status命名必须vs [plugin_spi_contract.md](./plugin_spi_contract.md) §4 的 `PluginSpiRegistry` Status机一致；两文档不得eachdefines不同的 SPI lifecycle Status名称。

## 7. Domain Tool Bundle

当 tool / skill / plugin 规模增大后，系统应以 domain bundle 组织能力，而不isdefaults tofull塞入 prompt。

`DomainToolBundle` 最小字段：

- `domain_id`
- `bundle_id`
- `tool_names`
- `skill_ids`
- `plugin_ids`
- `default_activation_policy`
- `knowledge_namespaces?`

规则：

- capability 的拥有权应尽量明确归属到 plugin / extension / domain bundle。
- 自defines能力不应via core 私有 reach-in 临时拼接。
- domain bundle is推荐、检索、delay加载和 explainability 的最小治理单元。

## 8. Skill 执lines语义

### 8.1 步骤failed模式

`SkillStepDefinition.onFailure` defines步骤failed后的handle策略：

| 模式 | 含义 |
| --- | --- |
| `fail` | 立即终止整个 skill 执lines（defaults to） |
| `continue` | 跳过failed步骤，继续执lines后续步骤 |
| `retry` | 按 `maxAttempts` 重试，exceeds过iterations数后降级为 `fail` |

规则：

- `retry` 不带退避，立即重试。
- 重试调度必须发出 `skill:retry_scheduled` 事件。
- 每iterations重试计入独立的 `skill:step_started` / `skill:step_failed` 事件。

### 8.2 Model Override 匹配

skill 步骤可声明 `modelOverrides`：

- `profileNames`
- `tiers`
- `requiredCapabilities`

匹配规则：

- 所有非空条件之间为 AND。
- 同一条件内多值为 OR。

### 8.3 Skill cache

cache key 派生：

```text
SHA256(skillId + version + parameters + workingDirectory + gitHead + sourceHash)
```

cache资格条件：

- skill 声明 `cacheable: true`
- 且 `gitHead` 或 `sourceHash` 至少有一个非空

cache生命cycle：

| 阶段 | Description |
| --- | --- |
| `disabled` | cache未enabled |
| `ineligible` | 不满足资格条件 |
| `miss` | 资格via但no匹配cache |
| `hit` | 命中cache，跳过执lines并回放结果 |
| `stored` | 执linessuccess后存入cache |

规则：

- only在 skill 全部步骤success时storage。
- 命中cache时插入 `StepOutput` 并标记 `cacheHit: true`。
- 达到 `cacheMaxEntries` 时按 LRU 淘汰。
- cache元data必须record `gitHead`、`sourceHash`、`cacheKey` 和time戳。

## 9. Skill Creator / Authoring

### 9.1 骨架最小结构

每个via creator 生成的 skill 至少应contains：

- `<skill_root>/<skill_slug>/SKILL.md`

optional附加结构：

- `<skill_root>/<skill_slug>/scripts/`
- `<skill_root>/<skill_slug>/references/`
- `<skill_root>/<skill_slug>/assets/`
- `<skill_root>/<skill_slug>/agents/openai.yaml`

### 9.2 命名vs内容约束

- `skill_slug` 必须uses lowercase kebab-case。
- `skill_id` 应vs `skill_slug` 保持一致，除非显式Description兼容原因。
- `SKILL.md` 至少contains：`name`、`description`、`when to use`、`inputs`、`workflow`、`safety notes`。
- `SKILL.md` 不得声明exceeds出 `required_tools` / `required_permissions` 的隐式能力。

### 9.3 Creator security边界

- creator 必须做 `realpath` 归一化和 allowed-root 校验。
- defaults to拒绝via symlink 写出指定根目录。
- 不得覆盖已存在的非空目录，除非显式声明 `overwrite_allowed`。
- 不得writes secrets、token、私有 endpoint 或环境专属凭证。

### 9.4 Creator 返回对象

- `skill_id`
- `skill_slug`
- `skill_root`
- `skill_path`
- `created_files`
- `created_directories`
- `registered`
- `warnings`

## 10. 注册、审核vs校验

注册table最少record：

- `id`
- `version`
- `permissions`
- `risk_level`
- `owner`
- `compatibility`
- `enabled`

bundled / 内置扩展清单在发布前至少执lines：

- manifest 字段 lint
- transport vs字段匹配校验
- 关键执lines字段缺失拦截
- inventory baseline / contract suite 校验

例如：

- `streamable_http` class型必须提供 `uri`
- `stdio` class型必须提供 `cmd`

校验输出至少contains：

- 条目序号
- 名称
- ID
- Recommendation修正字段

## 11. Phase Boundary

### 当前 phase1-4 authoritative 范围

- tool registry、skill registry、permissionvs风险边界
- skill activation / cache / authoring contract
- MCP / plugin / local tool 在呈现层可统一，但底层信任等级必须显式区分

### `M2` target-state 范围

- Plugin SPI 大规模生产uses
- Domain Registry 作为统一后端
- 外部 marketplace 发布vs撤销体系
- per-domain tool bundle 的完整平台化Control Plane

这些内容可以在 contract 中提前defines，但当前只允许table述为目标态扩展，不得作为当前completed readiness Conclusion。
