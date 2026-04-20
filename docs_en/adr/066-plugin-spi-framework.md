# ADR-066 Plugin SPI Framework and Lifecycle

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-015 Unified Extension Marketplace

## Context

The OAPEFLIR eight-stage architecture needs to provide differentiated retrieval, validation, planning, and presentation capabilities for different business domains (coding/operations/growth/game-dev/asset-production/livestream). External systems (Jira/GitHub/Notion/Figma/OBS/Ad/CRM) need to connect through a unified interface.

The existing `PluginSPIRegistry` (`plugin-spi-registry.ts`, 829 lines) has implemented a complete lifecycle state machine. This ADR formally establishes Plugin SPI as the official extension mechanism for OAPEFLIR.

## Decision

### 1. Plugin SPI 4 Core Interfaces

| Interface | Responsibility | Method Signature |
|------|------|---------|
| `DomainRetrieverPlugin` | Retrieve relevant content from knowledge base/memory/context | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | Validate whether execution input/output conforms to domain specifications | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | Generate customized execution plans for a specific domain | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<Plan>` |
| `DomainPresenterPlugin` | Format execution results into domain-specific output | `present(output: DualChannelStepOutput, format: OutputFormat): Promise<PresentedOutput>` |

### 2. Plugin Lifecycle State Machine

```
unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded
                                      ↓
                                  error (recoverable)
```

| State | Description | Allowed Operations |
|------|------|----------|
| `unregistered` | Plugin not registered | `register()` |
| `loading` | Currently loading | — |
| `registered` | Registered, pending initialization | `initialize()` |
| `initialized` | Initialized, pending activation | `activate()` |
| `active` | Normal operation | `invoke()`, `suspend()` |
| `suspended` | Temporarily suspended | `resume()`, `deactivate()` |
| `inactive` | Fully disabled | `unload()` |
| `unloaded` | Unloaded | — |
| `error` | Error state (recoverable) | `reset()` |

### 3. ExternalAdapterPlugin 8 Adapter Types

| Adapter | Purpose | Implementation Status |
|--------|------|---------|
| `github` | GitHub API integration (issues/PRs/code search) | Implemented (`github-adapter.ts`, 120 lines) |
| `jira` | Jira ticket management | Not implemented |
| `notion` | Notion document/database integration | Not implemented |
| `figma` | Figma design file preview | Not implemented |
| `unity` | Unity Cloud Build integration | Not implemented |
| `obs` | OBS live streaming control | Not implemented |
| `ad-platforms` | Ad platform data integration | Not implemented |
| `crm` | CRM system customer/interaction data | Not implemented |

### 4. Plugin Isolation and Security

- **Process Isolation**: Each Plugin runs in an independent Worker thread, managed by `plugin-runtime-host.ts`.
- **Permission Boundary**: Plugins can only access the permission set declared in `PluginBinding`.
- **Resource Limits**: Single Plugin execution timeout 30s, memory limit 512MB.
- **Configuration Injection Protection**: `domain-config.json` must be validated by `PluginConfigValidator`.

### 5. Plugin Loading and Registration

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

## Alternatives

### Option A: Hardcoded Domain Logic

Pros: Best performance, no plugin overhead.
Cons: Each new Domain requires modifying core code, cannot be dynamically loaded.

### Option B: Plugin SPI Dynamic Loading (Chosen)

Pros: Domain logic decoupled, supports hot updates, parallel multi-team development.
Cons: Runtime overhead added (~5-10ms per invoke), requires isolation mechanism.

## Consequences

- `plugin-spi-registry.ts` (829 lines) as the core registry.
- `plugin-runtime-host.ts` provides process isolation.
- Each Domain needs to implement 4 Plugin interfaces.
- `PluginConfigValidator` prevents malicious configuration injection.
- M2 Phase 1 prioritizes implementing Operations Domain (reusing GitHub adapter).

## Cross References

- [ADR-015 Unified Extension Marketplace](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Sections

- `§B` Plugin SPI Interface Definition
- `§B.2-B.5` 4 Core Interfaces
- `§B.7` ExternalAdapterPlugin
- `§B.11` Plugin Lifecycle State Machine
- `§G.1-G.2` Per-domain tool bundles & 8 adapters
