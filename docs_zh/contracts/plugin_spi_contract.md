# Plugin SPI Contract

> **OAPEFLIR 相关**：本 contract 定义 OAPEFLIR Domain Registry 的 Plugin SPI 接口体系，对应 ADR-066。
> **更新日期**：2026-04-17

## 1. 范围

本 contract 定义 Plugin 系统的 Service Provider Interface（SPI），包括四种 OAPEFLIR Domain Plugin 类型和 PluginSpiRegistry 生命周期管理。

相关文档：
- `tool_skill_plugin_contract.md`：Tool/Skill/Plugin 的关系。
- `sandbox_and_auth_contract.md`：Plugin 沙箱安全边界。
- [ADR-066 Plugin SPI Framework](../adr/066-plugin-spi-framework.md)

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

  // 生命周期
  initialize(config: PluginConfig): Promise<void>;
  activate(): Promise<void>;
  suspend(): Promise<void>;
  deactivate(): Promise<void>;
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

验证执行输入/输出是否符合 domain 规范。

```typescript
interface DomainValidatorPlugin {
  readonly pluginId: string;
  readonly pluginType: "validator";
  readonly domainId: string;

  // 验证输入/输出
  validate(input: unknown, context: ValidationContext): Promise<ValidationResult>;

  initialize(config: PluginConfig): Promise<void>;
  activate(): Promise<void>;
  suspend(): Promise<void>;
  deactivate(): Promise<void>;
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

为特定 domain 生成定制化执行计划。

```typescript
interface DomainPlannerPlugin {
  readonly pluginId: string;
  readonly pluginType: "planner";
  readonly domainId: string;

  // 为特定 domain 生成计划
  plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>;

  initialize(config: PluginConfig): Promise<void>;
  activate(): Promise<void>;
  suspend(): Promise<void>;
  deactivate(): Promise<void>;
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

将执行结果格式化为 domain 特定输出。

```typescript
interface DomainPresenterPlugin {
  readonly pluginId: string;
  readonly pluginType: "presenter";
  readonly domainId: string;

  // 格式化输出
  present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>;

  initialize(config: PluginConfig): Promise<void>;
  activate(): Promise<void>;
  suspend(): Promise<void>;
  deactivate(): Promise<void>;
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

## 3. ExternalAdapterPlugin（8 种适配类型）

| 适配器 | 用途 | 实现状态 |
|--------|------|---------|
| `github` | GitHub API 集成（issues/PRs/code search） | 已实现（github-adapter.ts, 120行） |
| `jira` | Jira ticket 管理 | 未实现 |
| `notion` | Notion 文档/数据库集成 | 未实现 |
| `figma` | Figma 设计文件预览 | 未实现 |
| `unity` | Unity Cloud Build 集成 | 未实现 |
| `obs` | OBS 直播控制 | 未实现 |
| `ad-platforms` | 广告平台数据集成 | 未实现 |
| `crm` | CRM 系统客户/交互数据 | 未实现 |

## 4. PluginSpiRegistry 生命周期状态机

```typescript
class PluginSpiRegistry {
  // 状态：unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded

  // 注册插件
  register(plugin: BasePlugin): void;

  // 初始化插件
  async initialize(pluginId: string, config: PluginConfig): Promise<void>;

  // 激活插件
  async activate(pluginId: string): Promise<void>;

  // 按类型查找
  getPlugins(type: PluginType): BasePlugin[];

  // 执行单插件
  async invoke(pluginId: string, method: string, args: unknown[]): Promise<unknown>;

  // 批量执行（fan-out）
  async invokeAll(type: PluginType, method: string, args: unknown[]): Promise<unknown[]>;

  // 挂起插件
  async suspend(pluginId: string): Promise<void>;

  // 停用插件
  async deactivate(pluginId: string): Promise<void>;

  // 卸载插件
  async unload(pluginId: string): Promise<void>;
}
```

## 5. Plugin 配置 Schema

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

| pluginId | 类型 | Domain | 状态 | 说明 |
|----------|------|--------|------|------|
| `plugin.core.basic-evaluator` | validator | — | 待实现 | 基础评分（correctness/completeness/efficiency/safety） |
| `plugin.core.basic-planner` | planner | — | 待实现 | 基础规划策略检索 |
| `plugin.builtin.coding-retriever` | retriever | coding | 待实现 | 代码库语义检索 |
| `plugin.builtin.coding-presenter` | presenter | coding | 待实现 | 代码 diff 格式化 |
| `plugin.builtin.github-adapter` | adapter | — | 已实现 | GitHub REST API 集成 |

## 7. OAPEFLIR 阶段集成

| OAPEFLIR 阶段 | Plugin 角色 |
|--------------|-----------|
| Observe | DomainRetrieverPlugin 检索上下文知识 |
| Assess | DomainValidatorPlugin 验证预执行条件 |
| Plan | DomainPlannerPlugin 生成 domain 特定 `PlanGraphBundle` |
| Execute | DomainValidatorPlugin 基于 `NodeAttemptReceipt` 验证执行输出 |
| Feedback | DomainRetrieverPlugin 收集反馈信号 |
| Learn | — |
| Improve | — |
| Release | DomainPresenterPlugin 格式化发布报告 |

## 8. 约束

- Plugin 必须在独立进程执行（`plugin-runtime-host.ts`）。
- Plugin 与宿主之间通过 `plugin-runtime-protocol.ts` 的序列化协议通信。
- 不信任 Plugin 返回的数据：所有返回值必须经过 schema 校验。
- Plugin 超时：`timeoutMs` 默认 30s，三级超时处理（warn → kill → dead-letter）。
- R4-TYPES 约束：Phase 1 仅支持 3 类学习 Plugin，不得扩展直到约束解除。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-38: 本文原先让 `DomainPlannerPlugin.plan()` 返回泛化 `Plan`，并在 OAPEFLIR 集成表中继续使用 `Rollout`，根因是 Plugin SPI 仍沿用早期“线性计划 + rollout”接口草案，没有随着 v4.3 的 `PlanGraphBundle` handoff 和 `Release` 阶段命名同步升级。修复：正文现把 planner 输出收敛到 `PlanGraphBundle`，验证上下文与输出验证对齐到 `harnessRunId / nodeRunId / attemptId / NodeAttemptReceipt`，阶段表也改回 `Release`。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
