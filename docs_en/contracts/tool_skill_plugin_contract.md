# Tool Skill Plugin Contract

---

## OAPEFLIR Mapping

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

- **Observe**: signal collection and aggregation
- **Assess**: pre-execution evaluation and risk judgement
- **Plan**: task decomposition and DAG construction
- **Execute**: step execution and fault tolerance
- **Feedback**: signal collection and preprocessing
- **Learn**: pattern detection and knowledge extraction
- **Improve**: improvement candidate evaluation and rollout
- **Release**: controlled release and rollback

---

## 1. Scope

This contract defines the registration, permissions, dependencies, lifecycle, and execution boundaries of tools, skills, plugins, and MCP extensions.

The current authoritative scope is the tool and skill governance already landed in phase 1-4; Plugin SPI, Domain Registry, and marketplace platform capabilities belong to the `M2` extension surface, and are allowed to define interfaces in this document, but must not be misrepresented as already fully delivered.

## 2. Canonical Objects

- `ToolDefinition`
- `SkillDefinition`
- `PluginManifest`
- `PluginSpiRegistration`
- `McpBinding`
- `DomainToolBundle`

## 3. ToolDefinition Minimum Fields

- `tool_name`
- `description`
- `input_schema`
- `output_schema`
- `risk_level`
- `permissions`
- `execution_metadata`
- `model_overrides?`
- `recovery_policy?`
- `idempotency_hint?`

Constraints:

- The authoritative input definition of a tool should preferably come from the structured schema, and then uniformly derive the model-side / API-side schema.
- The recovery, security, and path semantics of a tool follow the drilldown document `tool_metadata_and_recovery_contract.md`.
- Native wire-format tool call always takes priority; compatibility fallback can only be restricted to the registered tool allowlist and carries an explicit audit marker.

## 4. SkillDefinition Minimum Fields

- `skill_id`
- `description`
- `applicable_roles`
- `required_tools`
- `steps`
- `version`
- `model_profile_name?`
- `activation_conditions?`
- `activation_paths?`
- `cacheable?`
- `cache_ttl_seconds?`

Constraints:

- A skill can only orchestrate authorized tools, and cannot implicitly expand its permissions.
- If a step declares `model_overrides`, the override target tool must also be in the allowed set.
- Skills that do not satisfy `activation_conditions` / `activation_paths` can remain in the registry, but by default do not enter the model-visible surface.

## 5. Plugin Manifest and SPI Types

### 5.1 `PluginManifest` Minimum Fields

- `plugin_id`
- `name`
- `version`
- `owner`
- `capabilities`
- `spi_types`
- `trust_level`
- `settings_schema?`
- `auth_requirements?`
- `plugin_api_range?`
- `built_with_platform_version?`
- `min_runtime_version?`
- `lifecycle_state?`
- `public_sdk_surface`

Rules:

- All plugins / extensions must use the manifest as the authoritative registration input.
- Extension / plugin production code can only interact with core through the public SDK surface, and must not directly import core private modules or other extensions' private implementations.
- If a plugin needs a new runtime seam, it should preferably add a clear public SDK subpath or facade, rather than exposing private implementation files.

### 5.2 Four Canonical Plugin SPI Interfaces

`§K` requires the current document body to unify on four SPIs:

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

Minimum interface semantics:

```ts
interface PluginLifecycleContext {
  pluginId: string;
  domainId?: string;
  capabilityIds: string[];
}

interface DomainRetrieverPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  retrieve(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainValidatorPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  validate(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainPlannerPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  plan(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}

interface DomainPresenterPlugin {
  onLoad?(ctx: PluginLifecycleContext): Promise<void> | void;
  onActivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  present(input: unknown): Promise<unknown>;
  onDeactivate?(ctx: PluginLifecycleContext): Promise<void> | void;
  onUnload?(ctx: PluginLifecycleContext): Promise<void> | void;
}
```

Constraints:

- `onLoad / onActivate / onDeactivate / onUnload` are the canonical hooks of the plugin lifecycle.
- Hook failure must not elevate permissions; by default degrade to disabling the SPI instance or blocking load.
- SPI can only consume capabilities and settings declared in the manifest, and must not secretly expand permissions at runtime.

## 6. Lifecycle and State Machine

The plugin lifecycle must at least cover:

`discovered -> installed -> enabled -> disabled -> reloaded -> removed`

The SPI runtime lifecycle must at least cover:

`registered -> loaded -> active -> inactive -> unloaded`

Additional rules:

- `enabled` is not equal to `active`; only after passing compatibility, permission, and trust gates is it allowed to enter active.
- `reloaded` must retain before / after versions, configuration summary, and error reason, to facilitate audit and rollback.
- Trust warning, permission retry, and plugin settings can only serve as experience-layer safety valves, and cannot replace runtime policy, sandbox, and capability boundary.
- SPI runtime lifecycle state names must be consistent with the `PluginSpiRegistry` state machine in [plugin_spi_contract.md](./plugin_spi_contract.md) §4; the two documents must not define different SPI lifecycle state names separately.

## 7. Domain Tool Bundle

When the scale of tool / skill / plugin grows, the system should organize capabilities through domain bundles, rather than stuffing them into prompts by default.

`DomainToolBundle` minimum fields:

- `domain_id`
- `bundle_id`
- `tool_names`
- `skill_ids`
- `plugin_ids`
- `default_activation_policy`
- `knowledge_namespaces?`

Rules:

- The ownership of capabilities should be clearly assigned to plugin / extension / domain bundle as much as possible.
- Custom capabilities should not be temporarily stitched together through private core reach-in.
- The domain bundle is the minimum governance unit for recommendation, retrieval, lazy loading, and explainability.

## 8. Skill Execution Semantics

### 8.1 Step Failure Modes

`SkillStepDefinition.onFailure` defines the handling policy after a step fails:

| Mode | Meaning |
| --- | --- |
| `fail` | Immediately terminate the entire skill execution (default) |
| `continue` | Skip the failed step and continue with subsequent steps |
| `retry` | Retry according to `maxAttempts`, and degrade to `fail` after exceeding the count |

Rules:

- `retry` does not include backoff; it retries immediately.
- Retry scheduling must emit the `skill:retry_scheduled` event.
- Each retry counts as an independent `skill:step_started` / `skill:step_failed` event.

### 8.2 Model Override Matching

Skill steps can declare `modelOverrides`:

- `profileNames`
- `tiers`
- `requiredCapabilities`

Matching rules:

- All non-empty conditions are AND.
- Multiple values within the same condition are OR.

### 8.3 Skill Cache

Cache key derivation:

```text
SHA256(skillId + version + parameters + workingDirectory + gitHead + sourceHash)
```

Cache eligibility conditions:

- Skill declares `cacheable: true`
- And at least one of `gitHead` or `sourceHash` is non-empty

Cache lifecycle:

| Stage | Description |
| --- | --- |
| `disabled` | Cache not enabled |
| `ineligible` | Eligibility conditions not met |
| `miss` | Eligibility passed but no matching cache |
| `hit` | Cache hit, skip execution and replay result |
| `stored` | Stored in cache after successful execution |

Rules:

- Stored only when all steps of the skill succeed.
- On cache hit, insert `StepOutput` and mark `cacheHit: true`.
- When `cacheMaxEntries` is reached, evict using LRU.
- Cache metadata must record `gitHead`, `sourceHash`, `cacheKey`, and timestamp.

## 9. Skill Creator / Authoring

### 9.1 Minimum Skeleton Structure

Each skill generated through the creator should at least contain:

- `<skill_root>/<skill_slug>/SKILL.md`

Optional additional structure:

- `<skill_root>/<skill_slug>/scripts/`
- `<skill_root>/<skill_slug>/references/`
- `<skill_root>/<skill_slug>/assets/`
- `<skill_root>/<skill_slug>/agents/openai.yaml`

### 9.2 Naming and Content Constraints

- `skill_slug` must use lowercase kebab-case.
- `skill_id` should be consistent with `skill_slug`, unless the compatibility reason is explicitly stated.
- `SKILL.md` must at least contain: `name`, `description`, `when to use`, `inputs`, `workflow`, `safety notes`.
- `SKILL.md` must not declare implicit capabilities beyond `required_tools` / `required_permissions`.

### 9.3 Creator Security Boundary

- The creator must perform `realpath` normalization and allowed-root verification.
- By default refuse to write to the specified root directory via symlink.
- Must not overwrite existing non-empty directories, unless `overwrite_allowed` is explicitly declared.
- Must not write secrets, tokens, private endpoints, or environment-specific credentials.

### 9.4 Creator Return Object

- `skill_id`
- `skill_slug`
- `skill_root`
- `skill_path`
- `created_files`
- `created_directories`
- `registered`
- `warnings`

## 10. Registration, Review, and Verification

The registry must at least record:

- `id`
- `version`
- `permissions`
- `risk_level`
- `owner`
- `compatibility`
- `enabled`

Bundled / built-in extension manifests must at least perform the following before release:

- manifest field lint
- transport and field matching verification
- blocking on missing key execution fields
- inventory baseline / contract suite verification

For example:

- `streamable_http` type must provide `uri`
- `stdio` type must provide `cmd`

Verification output must at least contain:

- entry index
- name
- ID
- suggested correction field

## 11. Phase Boundary

### Current Phase 1-4 Authoritative Scope

- tool registry, skill registry, permission and risk boundary
- skill activation / cache / authoring contract
- MCP / plugin / local tool can be unified at the presentation layer, but the underlying trust level must be explicitly distinguished

### `M2` Target-State Scope

- Large-scale production use of Plugin SPI
- Domain Registry as unified backend
- External marketplace release and revocation system
- Complete platformized control plane for per-domain tool bundle

These contents can be defined in the contract in advance, but currently can only be described as target-state extensions, and must not be presented as a current completed readiness conclusion.
