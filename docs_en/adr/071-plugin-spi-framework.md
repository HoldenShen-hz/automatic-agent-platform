# ADR-071 Plugin SPI Interface System and Lifecycle

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-015 Unified Extension Marketplace

## Context

OAPEFLIR's eight-stage architecture needs to provide differentiated retrieval, validation, planning, and presentation capabilities for different business domains (coding/operations/growth/game-dev/asset-production/livestream). At the same time, external systems (Jira/GitHub/Notion/Figma/OBS/Ad/CRM) need unified interface access.

The existing `PluginSPIRegistry` (`plugin-spi-registry.ts`, 829 lines) has already implemented a complete lifecycle state machine. This ADR formally establishes Plugin SPI as the formal extension boundary for the platform domain registry; OAPEFLIR only consumes its projection views and results, and does not own plugin execution rights.

## Decision

### 1. Plugin SPI 4 Core Interfaces

| Interface | Responsibility | Method Signature |
|-----------|---------------|-------------------|
| `DomainRetrieverPlugin` | Retrieve relevant content from knowledge base/memory/context | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | Validate whether execution input/output complies with domain specifications | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | Generate customized execution plans for specific domains | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>` |
| `DomainPresenterPlugin` | Format execution results into domain-specific output | `present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>` |

### 2. Plugin Lifecycle State Machine

```
unregistered → loading → registered → initialized → active ↔ suspended → inactive → unloaded
                                      ↓
                                  error (recoverable)
```

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| `unregistered` | Plugin not registered | `register()` |
| `loading` | Currently loading | — |
| `registered` | Registered, pending initialization | `initialize()` |
| `initialized` | Initialized, pending activation | `activate()` |
| `active` | Normal operation | `invoke()`, `suspend()` |
| `suspended` | Temporarily suspended | `resume()`, `deactivate()` |
| `inactive` | Fully deactivated | `unload()` |
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

- **Process Isolation**: Untrusted plugins must run in separate processes, managed through IPC boundaries in `plugin-runtime-host.ts`; Worker threads must not serve as the final isolation boundary for untrusted plugins
- **Permission Boundary**: Plugins can only access the permission set declared in `PluginBinding`
- **Resource Limits**: Single plugin execution timeout 30s, memory limit 512MB
- **Configuration Injection Prevention**: `domain-config.json` must be validated by `PluginConfigValidator`

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

Advantages: Best performance, no plugin overhead
Costs: Each new domain requires modifying core code, cannot be dynamically loaded

### Option B: Plugin SPI Dynamic Loading (Selected)

Advantages: Domain logic decoupled, supports hot updates, parallel multi-team development
Costs: Adds runtime overhead (~5-10ms per invoke), requires isolation mechanism

## Consequences

- `plugin-spi-registry.ts` (829 lines) as core registry
- `plugin-runtime-host.ts` provides separate process + IPC isolation
- Each domain needs to implement 4 Plugin interfaces
- `PluginConfigValidator` prevents malicious configuration injection
- Ring 2 prioritizes implementing Operations Domain (reusing GitHub adapter)

## Cross-References

- [ADR-015 Unified Extension Marketplace](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Section

Note: After v4.3 migration, the original §B/§G appendices have been restructured into modular contract documents. This ADR's related content is now distributed across the following contract documents:

v4.3 valid references:
- `docs_zh/contracts/plugin_spi_contract.md` Plugin SPI core interfaces
- `docs_zh/contracts/plugin_spi_contract.md §2.4` 4 core interfaces
- `docs_zh/contracts/plugin_spi_contract.md §2.7` ExternalAdapterPlugin
- `docs_zh/contracts/plugin_spi_contract.md §2.11` Plugin lifecycle state machine
- `docs_zh/contracts/marketplace_contract.md §2` Per-domain tool bundles

## v4.3 ADR Remediation

- A-27: This ADR originally had `DomainPlannerPlugin.plan()` return `Promise<Plan>`. The root cause was that the Plugin SPI ADR followed an early linear plan interface draft and did not upgrade with the graph handoff contract. Fix: The main text now converges planner output to `Promise<PlanGraphBundle>`.
- A-36: This ADR originally described untrusted plugin isolation as Worker threads. The root cause was that the implementation early on first delivered a same-process concurrency prototype, but the documentation never upgraded to the main architecture's requirement for separate process + IPC boundaries. Fix: The main text now explicitly states that untrusted plugins must go through separate process isolation.
