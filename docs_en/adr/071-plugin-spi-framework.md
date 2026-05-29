# ADR-071 Plugin SPI Interface System and Lifecycle

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-015 Unified Extension Marketplace

## Background

The OAPEFLIR eight-stage architecture needs to provide differentiated retrieval, validation, planning, and presentation capabilities for different business domains (coding/operations/growth/game-dev/asset-production/livestream). Meanwhile, external systems (Jira/GitHub/Notion/Figma/OBS/Ad/CRM) need to access through a unified interface.

The existing `PluginSPIRegistry` (`plugin-spi-registry.ts`, 829 lines) has already implemented a complete lifecycle state machine. This ADR formally establishes Plugin SPI as the formal extension boundary for platform domain registry; OAPEFLIR only consumes its projection views and results, does not own plugin execution rights.

## Decision

### 1. Plugin SPI 4 Core Interfaces

| Interface | Responsibility | Method Signature |
|-----------|----------------|------------------|
| `DomainRetrieverPlugin` | Retrieve relevant content from knowledge base/memory/context | `retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>` |
| `DomainValidatorPlugin` | Validate whether execution input/output complies with domain specifications | `validate(input: unknown, context: ValidationContext): Promise<ValidationResult>` |
| `DomainPlannerPlugin` | Generate customized execution plans for specific domains | `plan(assessment: UnifiedAssessment, domain: DomainId): Promise<PlanGraphBundle>` |
| `DomainPresenterPlugin` | Format execution results as domain-specific output | `present(receipt: NodeAttemptReceipt, format: OutputFormat): Promise<PresentedOutput>` |

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
| `inactive` | Completely disabled | `unload()` |
| `unloaded` | Unloaded | — |
| `error` | Error state (recoverable) | `reset()` |

### 3. ExternalAdapterPlugin 8 Adapter Types

| Adapter | Purpose | Implementation Status |
|---------|---------|---------------------|
| `github` | GitHub API integration (issues/PRs/code search) | Implemented (`github-adapter.ts`, 120 lines) |
| `jira` | Jira ticket management | Not implemented |
| `notion` | Notion document/database integration | Not implemented |
| `figma` | Figma design file preview | Not implemented |
| `unity` | Unity Cloud Build integration | Not implemented |
| `obs` | OBS live streaming control | Not implemented |
| `ad-platforms` | Ad platform data integration | Not implemented |
| `crm` | CRM system customer/interaction data | Not implemented |

### 4. Plugin Isolation and Security

- **Process Isolation**: Untrusted Plugins must run in independent processes, managed through `plugin-runtime-host.ts` IPC boundary; Worker threads must not serve as the final isolation boundary for untrusted plugins.
- **Permission Boundaries**: Plugins can only access permission sets declared in `PluginBinding`.
- **Resource Limits**: Single Plugin execution timeout 30s, memory limit 512MB.
- **Configuration Injection Prevention**: `domain-config.json` must be validated by `PluginConfigValidator`.

### 4.1 Version Negotiation

- `manifest.version` only represents the plugin's own semantic version.
- Runtime compatibility must simultaneously declare SPI surface, host platform lower/upper bounds, and pack/marketplace required compatibility metadata.
- `PluginSPIRegistry` does not allow implicit compatibility inference based solely on `version` string; must fail-closed when compatibility metadata is missing.

### 4.2 Sandbox Tiers

- `allowFilesystemWrite`, `allowNetworkEgress`, `allowedKnowledgeNamespaces`, `runtimeIsolation` together define actual sandbox tier.
- `runtimeIsolation` canonical tiers are:
  - `serialized_in_process`
  - `isolated_process`
  - `sandboxed_process`
- Wide permission declarations in manifest cannot bypass host-side stricter runtime policy; effective permissions are the intersection.

### 4.3 Taint Tracking

- Plugin output must carry source pluginId/label lineage, entering unified taint tracker.
- Taint label is part of runtime contract, not an optional diagnostic field.
- Plugins that are revoked or demoted must still have their existing taint lineage traceable, not allowed to be lost during replay/export.

### 4.4 Container/Subprocess Startup Format

- Untrusted plugin launcher input must be structured schema, not concatenated command strings.
- Host is responsible for validating: pluginId, sandboxRoot, argv, env allowlist, resource limits, stdio/IPC channels.
- Legitimacy of container or subprocess startup parameters is part of SPI framework contract, must be validated before startup.

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

## Alternative Solutions

### Option A: Hard-coded Domain Logic

Advantages: Best performance, no plugin overhead.
Trade-offs: Each new Domain requires modifying core code, cannot be dynamically loaded.

### Option B: Plugin SPI Dynamic Loading (selected)

Advantages: Domain logic decoupled, supports hot update, multi-team parallel development.
Trade-offs: Adds runtime overhead (~5-10ms per invoke), requires isolation mechanism.

## Consequences

- `plugin-spi-registry.ts` (829 lines) as core registry.
- `plugin-runtime-host.ts` provides independent process + IPC isolation.
- Each Domain needs to implement 4 Plugin interfaces.
- `PluginConfigValidator` prevents malicious configuration injection.
- Ring 2 prioritizes implementing Operations Domain (reusing GitHub adapter).

## Cross References

- [ADR-015 Unified Extension Marketplace](./015-unified-extension-marketplace.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Section

Note: After v4.3 migration, original §B/§G appendices have been restructured into modular contract documents. This ADR related content is now distributed across the following contract documents:

v4.3 Valid References:
- `docs_zh/contracts/plugin_spi_contract.md` Plugin SPI core interfaces
- `docs_zh/contracts/plugin_spi_contract.md §2.4` 4 core interfaces
- `docs_zh/contracts/plugin_spi_contract.md §2.7` ExternalAdapterPlugin
- `docs_zh/contracts/plugin_spi_contract.md §2.11` Plugin lifecycle state machine
- `docs_zh/contracts/marketplace_contract.md §2` Per-domain tool bundles

## v4.3 ADR Remediation

- A-27: This ADR originally let `DomainPlannerPlugin.plan()` return `Promise<Plan>`, root cause being Plugin SPI ADR followed early linear plan interface draft without updating with graph handoff contract upgrade. Fix: Body now converges planner output to `Promise<PlanGraphBundle>`.
- A-36: This ADR originally described untrusted plugin isolation as Worker threads, root cause being implementation early onprototype-in-process concurrency first, documentation never upgraded to main architecture requirement of independent process + IPC boundary. Fix: Body now explicitly states untrusted plugins must go through independent process isolation.