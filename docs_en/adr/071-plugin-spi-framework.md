# ADR-071 Plugin SPI 接口体系vs生命cycle

- Status：Accepted
- Decision日期：2026-04-17
- 相关：ADR-015 统一扩展市场

## Background

OAPEFLIR 八阶段Architecture需要对不同业务域（coding/operations/growth/game-dev/asset-production/livestream）提供差异化的检索、验证、规划和展示能力。同时，外部系统（Jira/GitHub/Notion/Figma/OBS/Ad/CRM）需要via统一接口接入。

现有 `PluginSPIRegistry`（`plugin-spi-registry.ts`，829 lines）已实现完整的生命cycleStatus机，本 ADR 正式确立 Plugin SPI 作为平台 domain registry 的正式扩展边界；OAPEFLIR 只消费其投影视图vs结果，不拥有插件执lines权。

## Decision

### 1. Plugin SPI 4 大核心接口

| 接口 | 职责 | 方法签名 |
|------|------|---------|
| `DomainRetrieverPlugin` | 从知识库/内存/上下文中检索相关内容 | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | 验证执lines输入/输出isno符合 domain 规范 | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | 为特定 domain 生成定制化执lines计划 | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>` |
| `DomainPresenterPlugin` | 将执lines结果格式化为 domain 特定输出 | `present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>` |

### 2. Plugin 生命cycleStatus机

```
unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded
                                      ↓
                                  error (可恢复)
```

| Status | Description | 允许的操作 |
|------|------|----------|
| `unregistered` | 插件未注册 | `register()` |
| `loading` | 正在加载 | — |
| `registered` | 已注册，待初始化 | `initialize()` |
| `initialized` | 已初始化，待激活 | `activate()` |
| `active` | 正常运lines | `invoke()`, `suspend()` |
| `suspended` | 临时挂起 | `resume()`, `deactivate()` |
| `inactive` | 完全停用 | `unload()` |
| `unloaded` | 已卸载 | — |
| `error` | 错误Status（可恢复） | `reset()` |

### 3. ExternalAdapterPlugin 8 种适配class型

| 适配器 | 用途 | 实现Status |
|--------|------|---------|
| `github` | GitHub API 集成（issues/PRs/code search） | 已实现（`github-adapter.ts`，120 lines） |
| `jira` | Jira ticket manage | 未实现 |
| `notion` | Notion 文档/data库集成 | 未实现 |
| `figma` | Figma 设计文件预览 | 未实现 |
| `unity` | Unity Cloud Build 集成 | 未实现 |
| `obs` | OBS 直播控制 | 未实现 |
| `ad-platforms` | 广告平台data集成 | 未实现 |
| `crm` | CRM 系统客户/交互data | 未实现 |

### 4. Plugin 隔离vssecurity

- **进程隔离**：不可信 Plugin 必须运lines在独立进程，via `plugin-runtime-host.ts` 的 IPC 边界manage；Worker 线程不得作为不可信插件的最终隔离边界。
- **permission边界**：Plugin 只能访问 `PluginBinding` 中声明的permission集合。
- **资源限制**：单个 Plugin 执linestimeout 30s，内存upper limit 512MB。
- **configure注入防护**：`domain-config.json` 必须via过 `PluginConfigValidator` 校验。

### 4.1 版本协商

- `manifest.version` 只table示插件自身语义版本。
- 运lines时兼容性必须同时声明 SPI surface、宿主平台下界/上界、以及 pack/marketplace 所需的 compatibility metadata。
- `PluginSPIRegistry` 不允许only凭 `version` 字符串做隐式兼容推断；缺少 compatibility metadata 时必须 fail-closed。

### 4.2 Sandbox 分层

- `allowFilesystemWrite`、`allowNetworkEgress`、`allowedKnowledgeNamespaces`、`runtimeIsolation` 共同defines实际 sandbox tier。
- `runtimeIsolation` 的 canonical 分层为：
  - `serialized_in_process`
  - `isolated_process`
  - `sandboxed_process`
- Manifest 中的宽permission声明不能bypassing host 侧更严格的 runtime policy；最终生效permission取交集。

### 4.3 Taint Tracking

- 插件输出必须携带来源 pluginId / label lineage，进入统一 taint tracker。
- taint label belongs to运lines时契约的一部分，而不isoptional诊断字段。
- 被撤销或降权的插件，其已有 taint lineage 必须仍可追溯，不允许在 replay/export 时丢失。

### 4.4 容器/子进程启动格式

- 不可信插件的 launcher 输入必须is结构化 schema，而不is拼接命令字符串。
- host 负责校验：pluginId、sandboxRoot、argv、env allowlist、资源upper limit、stdio/IPC 通道。
- 容器或子进程启动参数的合法性belongs to SPI framework 契约的一部分，必须在启动前完成验证。

### 5. Plugin 加载vs注册

```typescript
interface PluginRegistryService {
  register(plugin: PluginDescriptor): Promise<void>;
  initialize(pluginId: string, config: PluginConfig): Promise<void>;
  activate(pluginId: string): Promise<void>;
  invoke(pluginId: string, input: unknown): Promise<unknown>;
  suspend(pluginId: string): Promise<void>;
  deactivate(pluginId: string): Promise<void>;
  unload(pluginId: string): Promise<void>;
}
```

## 备选方案

### 方案 A：hardcodes Domain 逻辑

优点：性能最优，no插件开销。
代价：每个新 Domain 需要修改核心code，no法dynamically加载。

### 方案 B：Plugin SPI dynamically加载（已选）

优点：Domain 逻辑解耦，supported热更新，多团队并lines开发。
代价：增加运lines时开销（~5-10ms per invoke），需要隔离机制。

## Consequences

- `plugin-spi-registry.ts`（829 lines）作为核心注册table。
- `plugin-runtime-host.ts` 提供独立进程 + IPC 隔离。
- 每个 Domain 需要实现 4 个 Plugin 接口。
- `PluginConfigValidator` 防止恶意configure注入。
- Ring 2 优先实现 Operations Domain（复用 GitHub adapter）。

## 交叉references用

- [ADR-015 统一扩展市场](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## 来源章节

注：v4.3 迁移后，原 §B/§G 附录已重构为模块化 contract 文档。本 ADR 相关内容现分布于以下 contract 文档：

v4.3 有效references用：
- `docs_zh/contracts/plugin_spi_contract.md` Plugin SPI 核心接口
- `docs_zh/contracts/plugin_spi_contract.md §2.4` 4 大核心接口
- `docs_zh/contracts/plugin_spi_contract.md §2.7` ExternalAdapterPlugin
- `docs_zh/contracts/plugin_spi_contract.md §2.11` Plugin 生命cycleStatus机
- `docs_zh/contracts/marketplace_contract.md §2` Per-domain tool bundles

## v4.3 ADR Remediation

- A-27: 本 ADR 原先让 `DomainPlannerPlugin.plan()` 返回 `Promise<Plan>`，Root cause:  Plugin SPI ADR accesses along用了早期线性计划接口草案，没有随着 graph handoff contract 升级。修复：正文现把 planner 输出收敛到 `Promise<PlanGraphBundle>`。
- A-36: 本 ADR 原先把不可信插件隔离Description成 Worker 线程，Root cause: 实现早期先落了同进程concurrent原型，文档却没有再升级到主Architecture要求的独立进程 + IPC 边界。修复：正文现明确不可信插件必须走独立进程隔离。
