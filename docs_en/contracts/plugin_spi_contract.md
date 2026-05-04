# Plugin SPI Contract

> **OAPEFLIR Note**: This contract defines the Plugin SPI interface system for the OAPEFLIR Domain Registry, corresponding to ADR-066.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the Service Provider Interface (SPI) for the Plugin system, including four types of OAPEFLIR Domain Plugin types and PluginSpiRegistry lifecycle management.

Related documents:
- `tool_skill_plugin_contract.md`: Tool/Skill/Plugin relationships.
- `sandbox_and_auth_contract.md`: Plugin sandbox security boundaries.
- [ADR-066 Plugin SPI Framework](../adr/066-plugin-spi-framework.md)

### 1.1 Lifecycle Hook Naming Convention

**Canonical naming**: `onLoad` / `onActivate` / `onDeactivate` / `onUnload`

The old naming `initialize` / `activate` is deprecated but retained for backward compatibility. All new plugin implementations should use the `on` prefix convention consistent with `tool_skill_plugin_contract.md`.

```typescript
interface PluginLifecycleContext {
  pluginId: string;
  domainId?: string;
  capabilityIds: string[];
}
```

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

  // Lifecycle hooks (canonical naming per §K)
  // @deprecated Use onLoad/onActivate instead - kept for backward compatibility
  initialize?(config: PluginConfig): Promise<void>;
  activate?(): Promise<void>;
  // Canonical hooks (use these instead)
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  suspend?(): Promise<void>;
  deactivate?(): Promise<void>;
}

interface RetrievalRequest {
  query: string;
  namespace?: string;
  domainId?: string | null;
  limit?: number;
  retrievalLevel?: 'quick' | 'standard' | 'deep';  // corresponds to Knowledge Plane level 3 queries
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

  // Lifecycle hooks (canonical naming per §K)
  // @deprecated Use onLoad/onActivate instead - kept for backward compatibility
  initialize?(config: PluginConfig): Promise<void>;
  activate?(): Promise<void>;
  // Canonical hooks (use these instead)
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  suspend?(): Promise<void>;
  deactivate?(): Promise<void>;
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

  // Lifecycle hooks (canonical naming per §K)
  // @deprecated Use onLoad/onActivate instead - kept for backward compatibility
  initialize?(config: PluginConfig): Promise<void>;
  activate?(): Promise<void>;
  // Canonical hooks (use these instead)
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  suspend?(): Promise<void>;
  deactivate?(): Promise<void>;
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
  present(output: DualChannelStepOutput, format: OutputFormat): Promise<PresentedOutput>;

  // Lifecycle hooks (canonical naming per §K)
  // @deprecated Use onLoad/onActivate instead - kept for backward compatibility
  initialize?(config: PluginConfig): Promise<void>;
  activate?(): Promise<void>;
  // Canonical hooks (use these instead)
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  suspend?(): Promise<void>;
  deactivate?(): Promise<void>;
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
  // States: unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded

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

## 6. Builtin Plugin Inventory

| pluginId | Type | Domain | Status | Description |
|----------|------|--------|--------|-------------|
| `plugin.core.basic-evaluator` | validator | — | Pending implementation | Basic scoring (correctness/completeness/efficiency/safety) |
| `plugin.core.basic-planner` | planner | — | Pending implementation | Basic planning strategy retrieval |
| `plugin.builtin.coding-retriever` | retriever | coding | Pending implementation | Codebase semantic retrieval |
| `plugin.builtin.coding-presenter` | presenter | coding | Pending implementation | Code diff formatting |
| `plugin.builtin.github-adapter` | adapter | — | Implemented | GitHub REST API integration |

## 7. OAPEFLIR Stage Integration

| OAPEFLIR Stage | Plugin Role |
|--------------|-------------|
| Observe | DomainRetrieverPlugin retrieves contextual knowledge |
| Assess | DomainValidatorPlugin validates pre-execution conditions |
| Plan | DomainPlannerPlugin generates domain-specific `PlanGraphBundle` |
| Execute | DomainValidatorPlugin validates execution output based on `NodeAttemptReceipt` |
| Feedback | DomainRetrieverPlugin collects feedback signals |
| Learn | — |
| Improve | — |
| Release | DomainPresenterPlugin formats release report |

## 8. Constraints

- Plugins must execute in an isolated process (`plugin-runtime-host.ts`).
- Communication between Plugin and host uses the serialization protocol in `plugin-runtime-protocol.ts`.
- Do not trust Plugin returned data: all return values must be validated against schema.
- Plugin timeout: `timeoutMs` defaults to 30s, with three-level timeout handling (warn → kill → dead-letter).
- R4-TYPES constraint: Phase 1 only supports 3 categories of learning Plugins; no expansion allowed until constraint is lifted.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-38: This document previously had `DomainPlannerPlugin.plan()` return a generalized `Plan`, and continued using `Rollout` in the OAPEFLIR integration table. Root cause: the Plugin SPI still followed the early "linear plan + rollout" interface draft and had not been upgraded in sync with v4.3's `PlanGraphBundle` handoff and `Release` stage naming. Fix: the main text now converges planner output to `PlanGraphBundle`, aligns validation context and output validation to `harnessRunId / nodeRunId / attemptId / NodeAttemptReceipt`, and the stage table has been changed back to `Release`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
