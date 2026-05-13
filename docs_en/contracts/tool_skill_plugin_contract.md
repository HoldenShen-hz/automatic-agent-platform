# Tool Skill Plugin Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the registration, permissions, dependencies, lifecycle, and execution boundaries for tools, skills, plugins, and MCP extensions.

The current authoritative scope is phase1-4 landed tools and skill governance; Plugin SPI, Domain Registry, and marketplace platform capabilities belong to the `M2` extension surface, interfaces may be defined in this document, but must not be miswritten as all currently delivered.

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

- The authoritative input definition of a tool comes primarily from the structured schema, then the model-side / API-side schema is uniformly derived.
- Tool recovery, security, and path semantics follow `tool_metadata_and_recovery_contract.md` as the authoritative drilling document.
- Native wire-format tool calls always take priority; compatible fallback can only be limited to registered tool whitelist, with explicit audit markers.

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

- A skill can only orchestrate authorized tools, and cannot implicitly expand permissions.
- If a step declares `model_overrides`, the override target tool must also already be in the allowed set.
- Skills not meeting `activation_conditions` / `activation_paths` can remain in the registry, but are not in the model-visible surface by default.

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

- All plugin / extension must use manifest as the authoritative registration input.
- Extension / plugin production code can only interact with core through public SDK surface, and must not directly import core private modules or other extension private implementations.
- If a plugin needs a new runtime seam, should prioritize adding a clear public SDK subpath or facade, rather than exposing private implementation files.

### 5.2 Plugin SPI Four Canonical Interfaces

`§K` requires current document system to unify to four SPI types:

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

- `onLoad / onActivate / onDeactivate / onUnload` are canonical hooks for plugin lifecycle.
- Hook failures must not elevate permissions; default to disabling that SPI instance or blocking loading.
- SPI can only consume capabilities and settings declared in manifest, and must not secretly expand permissions at runtime.

## 6. Lifecycle and State Machine

Plugin lifecycle must cover at least:

`discovered -> installed -> enabled -> disabled -> reloaded -> removed`

SPI runtime lifecycle must cover at least:

`registered -> loaded -> active -> inactive -> unloaded`

Supplementary rules:

- `enabled` does not equal `active`; only allowed to enter active after passing compatibility, permission, and trust gates.
- `reloaded` must preserve before/after version, configuration summary, and error reasons to facilitate audit and rollback.
- Trust warnings, permission retries, and plugin settings can only serve as experience-layer safety valves, and cannot replace runtime policy, sandbox, and capability boundaries.
- SPI runtime lifecycle state naming must be consistent with the `PluginSpiRegistry` state machine in §4 of [plugin_spi_contract.md](./plugin_spi_contract.md); the two documents must not each define different SPI lifecycle state names.

## 7. Domain Tool Bundle

As tool / skill / plugin scale increases, the system should organize capabilities by domain bundle, rather than defaulting to stuffing everything into prompts.

`DomainToolBundle` minimum fields:

- `domain_id`
- `bundle_id`
- `tool_names`
- `skill_ids`
- `plugin_ids`
- `default_activation_policy`
- `knowledge_namespaces?`

Rules:

- Ownership of capabilities should be clearly attributed to plugin / extension / domain bundle as much as possible.
- Custom capabilities should not be temporarily assembled through core private reach-in.
- Domain bundle is the minimum governance unit for recommendation, retrieval, lazy loading, and explainability.

## 8. Skill Execution Semantics

### 8.1 Step Failure Modes

`SkillStepDefinition.onFailure` defines the handling strategy after step failure:

| Mode | Meaning |
| --- | --- |
| `fail` | Immediately terminate entire skill execution (default) |
| `continue` | Skip failed step, continue executing subsequent steps |
| `retry` | Retry according to `maxAttempts`, degrade to `fail` after exceeding count |

Rules:

- `retry` does not include backoff; retry immediately.
- Retry scheduling must emit `skill:retry_scheduled` event.
- Each retry counts as independent `skill:step_started` / `skill:step_failed` events.

### 8.2 Model Override Matching

Skill steps can declare `modelOverrides`:

- `profileNames`
- `tiers`
- `requiredCapabilities`

Matching rules:

- All non-empty conditions are AND between each other.
- Multiple values within the same condition are OR.

### 8.3 Skill Caching

Cache key derivation:

```
SHA256(skillId + version + parameters + workingDirectory + gitHead + sourceHash)
```

Cache eligibility conditions:

- Skill declares `cacheable: true`
- And at least one of `gitHead` or `sourceHash` is non-empty

Cache lifecycle:

| Stage | Description |
| --- | --- |
| `disabled` | Cache not enabled |
| `ineligible` | Does not meet eligibility conditions |
| `miss` | Eligibility passed but no matching cache |
| `hit` | Cache hit, skip execution and replay result |
| `stored` | Stored in cache after successful execution |

Rules:

- Only store when all steps of the skill succeed.
- When cache hits, insert `StepOutput` and mark `cacheHit: true`.
- When `cacheMaxEntries` is reached, eliminate by LRU.
- Cache metadata must record `gitHead`, `sourceHash`, `cacheKey`, and timestamp.

## 9. Skill Creator / Authoring

### 9.1 Skeleton Minimum Structure

Each skill generated through creator must contain at least:

- `<skill_root>/<skill_slug>/SKILL.md`

Optional additional structure:

- `<skill_root>/<skill_slug>/scripts/`
- `<skill_root>/<skill_slug>/references/`
- `<skill_root>/<skill_slug>/assets/`
- `<skill_root>/<skill_slug>/agents/openai.yaml`

### 9.2 Naming and Content Constraints

- `skill_slug` must use lowercase kebab-case.
- `skill_id` should be consistent with `skill_slug`, unless explicitly explained for compatibility reasons.
- `SKILL.md` must contain at least: `name`, `description`, `when to use`, `inputs`, `workflow`, `safety notes`.
- `SKILL.md` must not declare implicit capabilities beyond `required_tools` / `required_permissions`.

### 9.3 Creator Security Boundaries

- Creator must do `realpath` normalization and allowed-root verification.
- Default deny writing outside the specified root directory via symlinks.
- Must not overwrite existing non-empty directories unless explicitly declaring `overwrite_allowed`.
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

## 10. Registration, Review, and Validation

Registry must record at minimum:

- `id`
- `version`
- `permissions`
- `risk_level`
- `owner`
- `compatibility`
- `enabled`

Bundled / built-in extension inventory must execute at least before release:

- Manifest field lint
- Transport and field matching validation
- Critical execution field missing interception
- Inventory baseline / contract suite validation

For example:

- `streamable_http` type must provide `uri`
- `stdio` type must provide `cmd`

Validation output must contain at minimum:

- Item sequence number
- Name
- ID
- Recommended correction fields

## 11. Phase Boundary

### Current phase1-4 authoritative scope

- Tool registry, skill registry, permissions, and risk boundaries
- Skill activation / cache / authoring contract
- MCP / plugin / local tool can be unified at presentation layer, but trust levels must be explicitly distinguished at lower layer

### `M2` target-state scope

- Plugin SPI large-scale production use
- Domain Registry as unified backend
- External marketplace publish and revoke system
- Complete platform control surface for per-domain tool bundle

These contents can be defined in the contract in advance, but currently only allowed to state as target-state extensions, and must not be used as current completed readiness conclusions.