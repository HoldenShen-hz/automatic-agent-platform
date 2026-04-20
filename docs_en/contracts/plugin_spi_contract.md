# Plugin SPI Contract

## 1. Scope

This contract defines the Service Provider Interface (SPI) for the Plugin system, including four Plugin types and PluginSpiRegistry lifecycle management.

Related documents:
- `tool_skill_plugin_contract.md`: Relationship between Tool/Skill/Plugin.
- `sandbox_and_auth_contract.md`: Plugin sandbox security boundary.

## 2. Four Plugin SPI Interfaces

### 2.1 RetrieverPlugin (Empty Shell Exists)

```typescript
interface RetrieverPlugin {
  readonly pluginId: string;
  readonly pluginType: "retriever";

  // Retrieve related knowledge
  retrieve(request: RetrievalRequest): Promise<RetrievalHit[]>;

  // Lifecycle
  init(config: PluginConfig): Promise<void>;
  destroy(): Promise<void>;
}

interface RetrievalRequest {
  query: string;
  namespace?: string;
  domainId?: string | null;
  limit?: number;
}
```

** Builtin retriever**: `coding-retriever` (to implement, should connect to SemanticRepoMapService).

### 2.2 EvaluatorPlugin

```typescript
interface EvaluatorPlugin {
  readonly pluginId: string;
  readonly pluginType: "evaluator";

  // Evaluate input or output
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;

  init(config: PluginConfig): Promise<void>;
  destroy(): Promise<void>;
}

interface EvaluationInput {
  type: "pre-execution" | "post-execution" | "on-demand";
  taskId: string;
  target: unknown; // Plan | StepResult | Artifact
  context: EvaluationContext;
}

interface EvaluationResult {
  score: number;           // 0-1
  verdict: "pass" | "warn" | "fail";
  reasons: string[];
  suggestions?: string[];
}
```

** builtin evaluator**: `basic-evaluator` (to implement).

### 2.3 TransformerPlugin

```typescript
interface TransformerPlugin {
  readonly pluginId: string;
  readonly pluginType: "transformer";

  // Transform input/output
  transform(input: unknown, direction: "encode" | "decode"): Promise<unknown>;

  init(config: PluginConfig): Promise<void>;
  destroy(): Promise<void>;
}
```

** builtin transformer**: `json-transformer` (to implement).

### 2.4 GuardPlugin

```typescript
interface GuardPlugin {
  readonly pluginId: string;
  readonly pluginType: "guard";

  // Security check
  guard(request: GuardRequest): Promise<GuardResult>;

  init(config: PluginConfig): Promise<void>;
  destroy(): Promise<void>;
}

interface GuardRequest {
  operation: "tool_call" | "file_access" | "network_access" | "code_execution";
  target: string;
  context: GuardContext;
}

interface GuardResult {
  allowed: boolean;
  reason?: string;
  fallbackAction?: "block" | "sanitize" | "allow_with_warning";
}
```

** builtin guard**: `safety-guard` (to implement, should integrate OutboundUrlPolicy + FileRootPolicy).

## 3. PluginSpiRegistry Lifecycle

```typescript
class PluginSpiRegistry {
  // Register plugin
  register(plugin: BasePlugin): void;

  // Find by type
  getPlugins(type: PluginType): BasePlugin[];

  // Execute single plugin
  async execute(
    pluginId: string,
    method: string,
    args: unknown[]
  ): Promise<unknown>;

  // Batch execution (fan-out)
  async executeAll(
    type: PluginType,
    method: string,
    args: unknown[]
  ): Promise<unknown[]>;

  // Initialize all registered plugins
  async initializeAll(): Promise<void>;

  // Destroy all plugins
  async destroyAll(): Promise<void>;
}
```

## 4. Plugin Configuration Schema

```typescript
const PluginConfigSchema = z.object({
  pluginId: z.string(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50),
  config: z.record(z.string(), z.unknown()).default({}),
  timeoutMs: z.number().int().positive().default(30000),
  retryPolicy: RetryPolicySchema.optional(),
});
```

## 5. Builtin Plugin List

| pluginId | Type | Status | Description |
|----------|------|--------|-------------|
| `plugin.core.basic-evaluator` | evaluator | To implement | Basic scoring (correctness/completeness/efficiency/safety) |
| `plugin.core.basic-planner` | retriever | To implement | Basic planning strategy retrieval |
| `plugin.core.json-transformer` | transformer | To implement | JSON encode/decode |
| `plugin.core.safety-guard` | guard | To implement | Integrate OutboundUrlPolicy + FileRootPolicy |
| `plugin.builtin.coding-retriever` | retriever | To implement | Codebase semantic retrieval |
| `plugin.builtin.coding-presenter` | transformer | To implement | Code diff formatting |
| `plugin.builtin.github-adapter` | retriever | To implement | GitHub REST API integration |

## 6. Constraints

- Plugin must execute in independent process (`plugin-runtime-child.ts`).
- Communication between Plugin and host through serialized protocol in `plugin-runtime-protocol.ts`.
- Do not trust Plugin returned data: all return values must pass schema validation.
- Plugin timeout: `timeoutMs` default 30s, three-level timeout handling (warn → kill → dead-letter).
