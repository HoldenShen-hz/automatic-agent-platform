# Plugin SPI Contract

> **OAPEFLIR Related**: This contract defines the OAPEFLIR Domain Registry's Plugin SPI interface system, corresponding to ADR-071.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the Service Provider Interface (SPI) of the Plugin system, including four types of OAPEFLIR Domain Plugin and PluginSpiRegistry lifecycle management.

Related documents:
- `tool_skill_plugin_contract.md`: Tool/Skill/Plugin relationships.
- `sandbox_and_auth_contract.md`: Plugin sandbox security boundaries.
- [ADR-071 Plugin SPI Framework](../adr/071-plugin-spi-framework.md)

## 2. Four OAPEFLIR Domain Plugin SPI Interfaces

### 2.1 DomainRetrieverPlugin

Retrieves relevant content from knowledge base/memory/context.

```typescript
interface DomainRetrieverPlugin {
  readonly pluginId: string;
  readonly pluginType: "retriever";
  readonly domainId: string;  // e.g., "coding", "operations", "growth"

  // Retrieve relevant knowledge
  retrieve(request: RetrievalRequest): Promise<RetrievalHit[]>;

  // Lifecycle
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
  retrievalLevel?: 'quick' | 'standard' | 'deep';  // Corresponding to Knowledge Plane 3-level query
}
```

### 2.2 DomainValidatorPlugin

Validates whether execution input/output conforms to domain specifications.

```typescript
interface DomainValidatorPlugin {
  readonly pluginId: string;
  readonly pluginType: "validator";
  readonly domainId: string;

  // Validate input/output
  validate(input: unknown, context: ValidationContext): Promise<ValidationResult>;

  // Lifecycle
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

Generates customized execution plans for specific domains.

```typescript
interface DomainPlannerPlugin {
  readonly pluginId: string;
  readonly pluginType: "planner";
  readonly domainId: string;

  // Generate plan for specific domain
  plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>;

  // Lifecycle
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

Formats execution results into domain-specific output.

```typescript
interface DomainPresenterPlugin {
  readonly pluginId: string;
  readonly pluginType: "presenter";
  readonly domainId: string;

  // Format output
  present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>;

  // Lifecycle
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

`NodeAttemptReceipt` must carry at minimum: `harnessRunId`, `planGraphBundleId`, `graphVersion`, `nodeRunId`, `nodeAttemptId`, `status`, `outputRef?`, `evidenceRefs[]`.

## 3. ExternalAdapterPlugin (8 Adapter Types)

| Adapter | Purpose | Implementation Status |
|---------|---------|----------------------|
| `github` | GitHub API integration (issues/PRs/code search) | Implemented (github-adapter.ts, 120 lines) |
| `jira` | Jira ticket management | Not implemented |
| `notion` | Notion document/database integration | Not implemented |
| `figma` | Figma design file preview | Not implemented |
| `unity` | Unity Cloud Build integration | Not implemented |
| `obs` | OBS live streaming control | Not implemented |
| `ad-platforms` | Ad platform data integration | Not implemented |
| `crm` | CRM system customer/interaction data | Not implemented |

## 4. PluginSpiRegistry Lifecycle State Machine

```typescript
class PluginSpiRegistry {
  // State: unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded

  // Register plugin
  register(plugin: BasePlugin): void;

  // Initialize plugin
  async initialize(pluginId: string, config: PluginConfig): Promise<void>;

  // Activate plugin
  async activate(pluginId: string): Promise<void>;

  // Find by type
  getPlugins(type: PluginType): BasePlugin[];

  // Invoke single plugin
  async invoke(pluginId: string, method: string, args: unknown[]): Promise<unknown>;

  // Batch invoke (fan-out)
  async invokeAll(type: PluginType, method: string, args: unknown[]): Promise<unknown[]>;

  // Suspend plugin
  async suspend(pluginId: string): Promise<void>;

  // Deactivate plugin
  async deactivate(pluginId: string): Promise<void>;

  // Unload plugin
  async unload(pluginId: string): Promise<void>;
}
```

## 5. Plugin Configuration Schema

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

## 6. Builtin Plugin List

| pluginId | Type | Domain | Status | Description |
|----------|------|--------|--------|-------------|
| `plugin.core.basic-evaluator` | validator | — | Pending | Basic scoring (correctness/completeness/efficiency/safety) |
| `plugin.core.basic-planner` | planner | — | Pending | Basic planning strategy retrieval |
| `plugin.builtin.coding-retriever` | retriever | coding | Pending | Codebase semantic retrieval |
| `plugin.builtin.coding-presenter` | presenter | coding | Pending | Code diff formatting |
| `plugin.builtin.github-adapter` | adapter | — | Implemented | GitHub REST API integration |

## 7. OAPEFLIR Stage Integration

| OAPEFLIR Stage | Plugin Role |
|----------------|-------------|
| Observe | DomainRetrieverPlugin retrieves context knowledge |
| Assess | DomainValidatorPlugin validates pre-execution conditions |
| Plan | DomainPlannerPlugin generates domain-specific `PlanGraphBundle` |
| Execute | DomainValidatorPlugin validates execution output based on `NodeAttemptReceipt` |
| Feedback | DomainRetrieverPlugin collects feedback signals |
| Learn | — |
| Improve | — |
| Release | DomainPresenterPlugin formats release report |

## 8. Constraints

- Plugin lifecycle hooks are uniformly named `onLoad / onActivate / onDeactivate / onUnload`.
- Plugin must execute in an independent process (`plugin-runtime-host.ts`).
- Communication between Plugin and host uses serialized protocol in `plugin-runtime-protocol.ts`.
- Do not trust Plugin returned data: all return values must be validated through schema.
- Plugin timeout: `timeoutMs` defaults to 30s, with three-level timeout handling (warn → kill → dead-letter).
- Hook failures must not elevate permissions; defaults to degrading to disabling that SPI instance or blocking loading.
- SPI can only consume capabilities and settings declared in manifest; must not secretly expand permissions at runtime.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-38: The original text had `DomainPlannerPlugin.plan()` return a generalized `Plan` and continued using `Rollout` in the OAPEFLIR integration table. Root cause: Plugin SPI still used the early "linear plan + rollout" interface draft and did not upgrade synchronously with v4.3's `PlanGraphBundle` handoff and `Release` stage naming. Fix: The main text now converges planner output to `PlanGraphBundle`, validation context and output validation align to `harnessRunId / nodeRunId / attemptId / NodeAttemptReceipt`, and the stage table reverts to `Release`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only act as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.