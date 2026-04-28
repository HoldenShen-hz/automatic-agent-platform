# ADR-066 Plugin SPI 接口体系与生命周期

- 状态：Accepted
- 决策日期：2026-04-17
- 相关：ADR-015 统一扩展市场

## 背景

OAPEFLIR 八阶段架构需要对不同业务域（coding/operations/growth/game-dev/asset-production/livestream）提供差异化的检索、验证、规划和展示能力。同时，外部系统（Jira/GitHub/Notion/Figma/OBS/Ad/CRM）需要通过统一接口接入。

现有 `PluginSPIRegistry`（`plugin-spi-registry.ts`，829 行）已实现完整的生命周期状态机，本 ADR 正式确立 Plugin SPI 作为 OAPEFLIR 的正式扩展机制。

## 决策

### 1. Plugin SPI 4 大核心接口

| 接口 | 职责 | 方法签名 |
|------|------|---------|
| `DomainRetrieverPlugin` | 从知识库/内存/上下文中检索相关内容 | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | 验证执行输入/输出是否符合 domain 规范 | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | 为特定 domain 生成定制化执行计划 | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>` |
| `DomainPresenterPlugin` | 将执行结果格式化为 domain 特定输出 | `present(output: DualChannelStepOutput, format: OutputFormat): Promise<PresentedOutput>` |

### 2. Plugin 生命周期状态机

```
unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded
                                      ↓
                                  error (可恢复)
```

| 状态 | 说明 | 允许的操作 |
|------|------|----------|
| `unregistered` | 插件未注册 | `register()` |
| `loading` | 正在加载 | — |
| `registered` | 已注册，待初始化 | `initialize()` |
| `initialized` | 已初始化，待激活 | `activate()` |
| `active` | 正常运行 | `invoke()`, `suspend()` |
| `suspended` | 临时挂起 | `resume()`, `deactivate()` |
| `inactive` | 完全停用 | `unload()` |
| `unloaded` | 已卸载 | — |
| `error` | 错误状态（可恢复） | `reset()` |

### 3. ExternalAdapterPlugin 8 种适配类型

| 适配器 | 用途 | 实现状态 |
|--------|------|---------|
| `github` | GitHub API 集成（issues/PRs/code search） | 已实现（`github-adapter.ts`，120 行） |
| `jira` | Jira ticket 管理 | 未实现 |
| `notion` | Notion 文档/数据库集成 | 未实现 |
| `figma` | Figma 设计文件预览 | 未实现 |
| `unity` | Unity Cloud Build 集成 | 未实现 |
| `obs` | OBS 直播控制 | 未实现 |
| `ad-platforms` | 广告平台数据集成 | 未实现 |
| `crm` | CRM 系统客户/交互数据 | 未实现 |

### 4. Plugin 隔离与安全

- **进程隔离**：不可信 Plugin 必须运行在独立进程，通过 `plugin-runtime-host.ts` 的 IPC 边界管理；Worker 线程不得作为不可信插件的最终隔离边界。
- **权限边界**：Plugin 只能访问 `PluginBinding` 中声明的权限集合。
- **资源限制**：单个 Plugin 执行超时 30s，内存上限 512MB。
- **配置注入防护**：`domain-config.json` 必须经过 `PluginConfigValidator` 校验。

### 5. Plugin 加载与注册

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

### 方案 A：硬编码 Domain 逻辑

优点：性能最优，无插件开销。
代价：每个新 Domain 需要修改核心代码，无法动态加载。

### 方案 B：Plugin SPI 动态加载（已选）

优点：Domain 逻辑解耦，支持热更新，多团队并行开发。
代价：增加运行时开销（~5-10ms per invoke），需要隔离机制。

## 后果

- `plugin-spi-registry.ts`（829 行）作为核心注册表。
- `plugin-runtime-host.ts` 提供独立进程 + IPC 隔离。
- 每个 Domain 需要实现 4 个 Plugin 接口。
- `PluginConfigValidator` 防止恶意配置注入。
- Ring 2 优先实现 Operations Domain（复用 GitHub adapter）。

## 交叉引用

- [ADR-015 统一扩展市场](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§B` Plugin SPI 接口定义
- `§B.2-B.5` 4 大核心接口
- `§B.7` ExternalAdapterPlugin
- `§B.11` Plugin 生命周期状态机
- `§G.1-G.2` Per-domain tool bundles & 8 adapters

## v4.3 ADR Remediation

- A-27: 本 ADR 原先让 `DomainPlannerPlugin.plan()` 返回 `Promise<Plan>`，根因是 Plugin SPI ADR 沿用了早期线性计划接口草案，没有随着 graph handoff contract 升级。修复：正文现把 planner 输出收敛到 `Promise<PlanGraphBundle>`。
- A-36: 本 ADR 原先把不可信插件隔离描述成 Worker 线程，根因是实现早期先落了同进程并发原型，文档却没有再升级到主架构要求的独立进程 + IPC 边界。修复：正文现明确不可信插件必须走独立进程隔离。
