# ADR-066 Plugin SPI Interface System and Lifecycle

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-015 Unified Extension Marketplace

## Context

The OAPEFLIR eight-stage architecture needs to provide differentiated retrieval, validation, planning, and presentation capabilities for different business domains (coding/operations/growth/game-dev/asset-production/livestream). External systems (Jira/GitHub/Notion/Figma/OBS/Ad/CRM) need to connect through a unified interface.

The existing `PluginSPIRegistry` (`plugin-spi-registry.ts`, 829 lines) has implemented a complete lifecycle state machine. This ADR formally establishes Plugin SPI as the official extension mechanism for OAPEFLIR.

## Decision

### 1. Plugin SPI 4 Core Interfaces

| Interface | Responsibility | Method Signature |
|-----------|----------------|------------------|
| `DomainRetrieverPlugin` | Retrieve relevant content from knowledge base/memory/context | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | Validate whether execution input/output conforms to domain specifications | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | Generate customized execution plans for specific domains | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>` |
| `DomainPresenterPlugin` | Format execution results into domain-specific output | `present(output: DualChannelStepOutput, format: OutputFormat): Promise<PresentedOutput>` |

### 2. Plugin Lifecycle State Machine

```
unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded
                                      ↓
                                  error (recoverable)
```

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| `unregistered` | Plugin not registered | `register()` |
| `loading` | Loading in progress | — |
| `registered` | Registered, pending initialization | `initialize()` |
| `initialized` | Initialized, pending activation | `activate()` |
| `active` | Normal operation | `invoke()`, `suspend()` |
| `suspended` | Temporarily suspended | `resume()`, `deactivate()` |
| `inactive` | Fully disabled | `unload()` |
| `unloaded` | Unloaded | — |
| `error` | Error state (recoverable) | `reset()` |

### 3. ExternalAdapterPlugin 8 Adapter Types

| Adapter | Purpose | Implementation Status |
|---------|---------|----------------------|
| `github` | GitHub API integration (issues/PRs/code search) | Implemented (`github-adapter.ts`, 120 lines) |
| `jira` | Jira ticket management | Not implemented |
| `notion` | Notion document/database integration | Not implemented |
| `figma` | Figma design file preview | Not implemented |
| `unity` | Unity Cloud Build integration | Not implemented |
| `obs` | OBS live streaming control | Not implemented |
| `ad-platforms` | Ad platform data integration | Not implemented |
| `crm` | CRM system customer/interaction data | Not implemented |

### 4. Plugin Isolation and Security

- **Process Isolation**: Untrusted plugins must run in independent processes, managed through IPC boundaries in `plugin-runtime-host.ts`; Worker threads must not serve as the final isolation boundary for untrusted plugins.
- **Permission Boundaries**: Plugins can only access permission sets declared in `PluginBinding`.
- **Resource Limits**: Single plugin execution timeout is 30s, memory limit is 512MB.
- **Configuration Injection Prevention**: `domain-config.json` must be validated by `PluginConfigValidator`.

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

## Alternative Approaches

### Approach A: Hardcoded Domain Logic

Advantages: Best performance, no plugin overhead.
Drawbacks: Each new domain requires core code changes, cannot be dynamically loaded.

### Approach B: Plugin SPI Dynamic Loading (Selected)

Advantages: Domain logic decoupled, supports hot updates, parallel team development.
Drawbacks: Adds runtime overhead (~5-10ms per invoke), requires isolation mechanism.

## Consequences

- `plugin-spi-registry.ts` (829 lines) serves as the core registry.
- `plugin-runtime-host.ts` provides independent process + IPC isolation.
- Each domain needs to implement 4 Plugin interfaces.
- `PluginConfigValidator` prevents malicious configuration injection.
- Ring 2 prioritizes Operations Domain implementation (reusing GitHub adapter).

## Cross References

- [ADR-015 Unified Extension Marketplace](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Section

- `§B` Plugin SPI Interface Definition
- `§B.2-B.5` 4 Core Interfaces
- `§B.7` ExternalAdapterPlugin
- `§B.11` Plugin Lifecycle State Machine
- `§G.1-G.2` Per-domain tool bundles & 8 adapters

## v4.3 ADR Remediation

- A-27: This ADR originally had `DomainPlannerPlugin.plan()` return `Promise<Plan>`. Root cause: Plugin SPI ADR followed an early linear plan interface draft and did not upgrade with the graph handoff contract. Fix: The main text now converges the planner output to `Promise<PlanGraphBundle>`.
- A-36: This ADR originally described untrusted plugin isolation as Worker threads. Root cause: Early implementation used same-process concurrency prototypes, but documentation was not upgraded to the main architecture's independent process + IPC boundary requirements. Fix: The main text now explicitly requires untrusted plugins to use independent process isolation.
