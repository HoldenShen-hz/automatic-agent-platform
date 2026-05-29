# Plugin SPI Contract

> **OAPEFLIR 相关**：本 contract defines OAPEFLIR Domain Registry 的 Plugin SPI 接口体系，对应 ADR-071。
> **更新日期**：2026-04-17

## 1. 范围

本 contract defines Plugin 系统的 Service Provider Interface（SPI），includes四种 OAPEFLIR Domain Plugin class型和 PluginSpiRegistry 生命cyclemanage。

相关文档：
- `tool_skill_plugin_contract.md`：Tool/Skill/Plugin 的关系。
- `sandbox_and_auth_contract.md`：Plugin 沙箱security边界。
- [ADR-071 Plugin SPI Framework](../adr/071-plugin-spi-framework.md)

## 2. 四种 OAPEFLIR Domain Plugin SPI 接口

### 2.1 DomainRetrieverPlugin

从知识库/内存/上下文中检索相关内容。

```typescript
interface DomainRetrieverPlugin {
  readonly pluginId: string;
  readonly pluginType: "retriever";
  readonly domainId: string;  // e.g., "coding", "operations", "growth"

  // 检索相关知识
  retrieve(request: RetrievalRequest): Promise<RetrievalHit[]>;

  // 生命cycle
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface PluginLifecycleContext {
  pluginId: string;
  domainId?: string;
  capabilityIds: string[];
}

interface RetrievalRequest {
  query: string;
  namespace?: string;
  domainId?: string | null;
  limit?: number;
  retrievalLevel?: 'quick' | 'standard' | 'deep';  // 对应 Knowledge Plane 3 级查询
}
```

### 2.2 DomainValidatorPlugin

验证执lines输入/输出isno符合 domain 规范。

```typescript
interface DomainValidatorPlugin {
  readonly pluginId: string;
  readonly pluginType: "validator";
  readonly domainId: string;

  // 验证输入/输出
  validate(input: unknown, context: ValidationContext): Promise<ValidationResult>;

  // 生命cycle
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface ValidationContext {
  phase: 'pre-execution' | 'post-execution' | 'on-demand';
  harnessRunId: string;
  nodeRunId?: string;
  attemptId?: string;
  target: unknown;  // PlanGraphBundle | NodeAttemptReceipt | Artifact
  domainContext: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  score: number;           // 0-1
  verdict: "pass" | "warn" | "fail";
  reasons: string[];
  suggestions?: string[];
  violations?: ValidationViolation[];
}

interface ValidationViolation {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}
```

### 2.3 DomainPlannerPlugin

为特定 domain 生成定制化执lines计划。

```typescript
interface DomainPlannerPlugin {
  readonly pluginId: string;
  readonly pluginType: "planner";
  readonly domainId: string;

  // 为特定 domain 生成计划
  plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>;

  // 生命cycle
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface UnifiedAssessment {
  harnessRunId: string;
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  riskLevel: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  resourceRequirements: ResourceEstimate;
  estimatedDuration: number;
  confidence: number;
  metadata: Record<string, unknown>;
}
```

### 2.4 DomainPresenterPlugin

将执lines结果格式化为 domain 特定输出。

```typescript
interface DomainPresenterPlugin {
  readonly pluginId: string;
  readonly pluginType: "presenter";
  readonly domainId: string;

  // 格式化输出
  present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>;

  // 生命cycle
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface OutputFormat {
  type: 'summary' | 'detailed' | 'diff' | 'stream';
  includeMetrics?: boolean;
  includeArtifacts?: boolean;
}

interface PresentedOutput {
  content: string;
  format: OutputFormat;
  artifacts?: ArtifactReference[];
  metrics?: OutputMetrics;
}
```

`NodeAttemptReceipt` 至少要携带：`harnessRunId`、`planGraphBundleId`、`graphVersion`、`nodeRunId`、`nodeAttemptId`、`status`、`outputRef?`、`evidenceRefs[]`。

## 3. ExternalAdapterPlugin（8 种适配class型）

| 适配器 | 用途 | 实现Status |
|--------|------|---------|
| `github` | GitHub API 集成（issues/PRs/code search） | 已实现（github-adapter.ts, 120lines） |
| `jira` | Jira ticket manage | 未实现 |
| `notion` | Notion 文档/data库集成 | 未实现 |
| `figma` | Figma 设计文件预览 | 未实现 |
| `unity` | Unity Cloud Build 集成 | 未实现 |
| `obs` | OBS 直播控制 | 未实现 |
| `ad-platforms` | 广告平台data集成 | 未实现 |
| `crm` | CRM 系统客户/交互data | 未实现 |

## 4. PluginSpiRegistry 生命cycleStatus机

```typescript
class PluginSpiRegistry {
  // Status：unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded

  // 注册插件
  register(plugin: BasePlugin): void;

  // 初始化插件
  async initialize(pluginId: string, config: PluginConfig): Promise<void>;

  // 激活插件
  async activate(pluginId: string): Promise<void>;

  // 按class型查找
  getPlugins(type: PluginType): BasePlugin[];

  // 执lines单插件
  async invoke(pluginId: string, method: string, args: unknown[]): Promise<unknown>;

  // 批量执lines（fan-out）
  async invokeAll(type: PluginType, method: string, args: unknown[]): Promise<unknown[]>;

  // 挂起插件
  async suspend(pluginId: string): Promise<void>;

  // 停用插件
  async deactivate(pluginId: string): Promise<void>;

  // 卸载插件
  async unload(pluginId: string): Promise<void>;
}
```

## 5. Plugin configure Schema

```typescript
const PluginConfigSchema = z.object({
  pluginId: z.string(),
  domainId: z.string().optional(),  // OAPEFLIR Domain ID
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
  config: z.record(z.string(), z.unknown()).default({}),
  timeoutMs: z.number().int().positive().default(30000),
  retryPolicy: RetryPolicySchema.optional(),
  isolationLevel: z.enum(['process', 'thread', 'sandbox']).default('process'),
});

const PluginDescriptorSchema = z.object({
  pluginId: z.string(),
  pluginType: z.enum(['retriever', 'validator', 'planner', 'presenter', 'adapter']),
  domainId: z.string().optional(),
  version: z.string(),
  description: z.string().optional(),
  capabilities: z.array(z.string()),
});
```

## 6. Builtin 插件清单

| pluginId | class型 | Domain | Status | Description |
|----------|------|--------|------|------|
| `plugin.core.basic-evaluator` | validator | — | 待实现 | 基础评分（correctness/completeness/efficiency/safety） |
| `plugin.core.basic-planner` | planner | — | 待实现 | 基础规划策略检索 |
| `plugin.builtin.coding-retriever` | retriever | coding | 待实现 | code库语义检索 |
| `plugin.builtin.coding-presenter` | presenter | coding | 待实现 | code diff 格式化 |
| `plugin.builtin.github-adapter` | adapter | — | 已实现 | GitHub REST API 集成 |

## 7. OAPEFLIR 阶段集成

| OAPEFLIR 阶段 | Plugin 角色 |
|--------------|-----------|
| Observe | DomainRetrieverPlugin 检索上下文知识 |
| Assess | DomainValidatorPlugin 验证预执lines条件 |
| Plan | DomainPlannerPlugin 生成 domain 特定 `PlanGraphBundle` |
| Execute | DomainValidatorPlugin based on `NodeAttemptReceipt` 验证执lines输出 |
| Feedback | DomainRetrieverPlugin 收集反馈信号 |
| Learn | — |
| Improve | — |
| Release | DomainPresenterPlugin 格式化发布报告 |

## 8. 约束

- Plugin 生命cycle hook 命名统一为 `onLoad / onActivate / onDeactivate / onUnload`。
- Plugin 必须在独立进程执lines（`plugin-runtime-host.ts`）。
- Plugin vs宿主之间via `plugin-runtime-protocol.ts` 的序列化协议communication。
- 不信任 Plugin 返回的data：所有返回值必须via过 schema 校验。
- Plugin timeout：`timeoutMs` defaults to 30s，三级timeouthandle（warn → kill → dead-letter）。
- hook failed不得提升permission；defaults to降级为disabled该 SPI 实例或阻断加载。
- SPI 只能消费 manifest 声明过的 capability vs setting，不得运lines时偷偷扩权。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-38: 本文原先让 `DomainPlannerPlugin.plan()` 返回泛化 `Plan`，并在 OAPEFLIR 集成table中继续uses `Rollout`，Root cause:  Plugin SPI 仍accesses along用早期“线性计划 + rollout”接口草案，没有随着 v4.3 的 `PlanGraphBundle` handoff 和 `Release` 阶段命名synchronous升级。修复：正文现把 planner 输出收敛到 `PlanGraphBundle`，验证上下文vs输出验证对齐到 `harnessRunId / nodeRunId / attemptId / NodeAttemptReceipt`，阶段table也改回 `Release`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
