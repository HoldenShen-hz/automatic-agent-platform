# Ecosystem Extension Plane Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

This contract defines the extension ecosystem plane, including capability registry, Domain Registry, plugin SPI, domain tool bundle, review pipeline, marketplace, compatibility, and revocation mechanisms.

It extends [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) to answer "how external extensions are safely integrated, registered, published, upgraded, disabled, and rolled back".

## 2. Goals

- Let tool / skill / plugin / MCP extensions enter unified ecosystem governance model.
- Clarify capability declaration, review, version compatibility, revocation, and domain binding paths.
- Prevent third-party extensions from breaking platform security boundaries.
- Leave clear contract boundaries for `M2-EXT-01`'s `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry`.

## 3. Canonical Components

- `CapabilityRegistry`
- `DomainRegistry`
- `DomainToolBundleRegistry`
- `PluginSpiRegistry`
- `ExtensionReviewPipeline`
- `MarketplaceCatalog`
- `CompatibilityResolver`
- `RevocationService`

## 4. Canonical Objects

- `CapabilityDefinition`
- `DomainCapabilityRegistryEntry`
- `ExtensionPackage`
- `PluginManifest`
- `PluginSpiRegistration`
- `ReviewDecision`
- `CompatibilityMatrix`
- `RevocationRecord`

## 5. Domain Capability Registry

### 5.1 CapabilityDefinition Minimum Fields

- `capability_id`
- `provider_type`
- `declared_permissions`
- `risk_level`
- `version`
- `owner_ref`

### 5.2 DomainCapabilityRegistryEntry Minimum Fields

- `domain_id`
- `bundle_id`
- `capability_ids`
- `tool_names`
- `skill_ids`
- `plugin_ids`
- `knowledge_namespaces?`
- `default_activation_policy`
- `trust_tier`

Rules:

- All extensions must declare capability first before entering execution chain.
- Domain bundle binding is the authoritative entry for capability exposure to specific domains.
- Runtime must not load extension packages that have not passed compatibility, permission, and trust gates.

## 6. Plugin SPI Integration

Extension plane uniformly acknowledges four types of SPI:

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

`PluginSpiRegistration` records at least:

- `plugin_id`
- `spi_type`
- `domain_id?`
- `capability_ids`
- `lifecycle_state`
- `runtime_isolation`
- `cooldown_until?`
- `runtime_process_id?`
- `runtime_sandbox_root?`
- `last_invocation_started_at?`
- `last_invocation_completed_at?`
- `sdk_surface`
- `registered_at`

Rules:

- Lifecycle covers at least `registered -> loaded -> active -> inactive -> unloaded`.
- Current authoritative runtime isolation allows `shared_process`, `serialized_in_process`, `forked_process`, `sandboxed_process`, and `containerized_process`.
- `forked_process` represents independent subprocess isolation baseline; `sandboxed_process` represents stronger isolation mode with independent subprocess + exclusive sandbox root + minimal env whitelist + Node permission model.
- `containerized_process` represents launcher-based external isolation runtime interface, can be carried by `docker` / `podman` / `bwrap` or equivalent independent sandbox launcher; communication between host and child via stdio JSON protocol.
- Neither `sandboxed_process` nor `containerized_process` should be directly described as completed OCI orchestrator, VM, or microVM fleet orchestration; current repository provides auditable isolated runtime host and launcher interface, while real live infra still requires target environment validation.
- Isolated failures can set plugin to `degraded` or `disabled`, with optional cooldown window; cooldown state must be queryable by inventory, diagnostics, or API.
- If `forked_process`, `sandboxed_process`, or `containerized_process` is enabled, runtime process id should be queryable by inventory, diagnostics, or API, and host process must be able to回收 subprocess on unload / shutdown.
- If `sandboxed_process` or `containerized_process` is enabled, runtime sandbox root should also be queryable by inventory, diagnostics, or API for operator isolation root directory audit.
- Plugin invocation should publish at least `plugin:invocation_started` and `plugin:invocation_completed` typed audit events for audit and feedback projection consumption.
- SPI registration results must be queryable by inventory, diagnostics, and audit systems.
- Plugins can only interact with core through public SDK surface, must not reach-in to private implementations.

## 7. Review and Release Pipeline

Review workflow contains at least:

1. Submission
2. Static validation
3. Permission review
4. Compatibility check
5. Human review
6. Release
7. Revoke or rollback

`ReviewDecision` minimum fields:

- `decision_id`
- `extension_id`
- `status`
- `reason_codes`
- `reviewed_permissions`
- `compatibility_result`
- `signed_off_by`
- `decided_at`

Supplementary rules:

- Marketplace release must go through review decision.
- Published extensions must support revoke / disable / rollback.
- Extension packages should support signatures or equivalent integrity verification.

## 8. Compatibility Matrix

Semantic version compatibility is divided into at least three layers:

- `api_contract`
- `permission_surface`
- `runtime_capability`

`CompatibilityMatrix` covers at least:

- `plugin_api_range`
- `built_with_platform_version`
- `min_runtime_version`
- `supported_domain_ids`
- `breaking_changes`

Rules:

- `enabled` does not mean compatible; must fail-close when compatibility gate has not passed.
- Domain bundle upgrades that introduce higher permissions or trust tier changes must be re-reviewed.

## 9. Revocation and Rollback

`RevocationRecord` contains at least:

- `revocation_id`
- `target_type`
- `target_id`
- `reason`
- `scope`
- `rollback_target?`
- `created_at`

Revocation trigger scenarios include at least:

- Permission surface exceeds declaration
- Signature invalid or source untrusted
- Compatibility regression
- Sandbox / policy escape
- Domain bundle misbinding

## 10. Relationship with Existing Documents

- [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) defines internal registration, authoring, and SPI baseline.
- `sandbox_and_auth_contract.md` provides security boundaries for extension execution.
- `api_surface_contract.md`, `admin_console_and_human_takeover_contract.md` are responsible for extension plane management entry points.

## 11. Phase Boundaries

### Current phase1-4 authoritative scope

- Capability declaration must exist
- Contract boundaries for manifest / compatibility / permission / trust must be clear
- Domain bundle, plugin SPI, marketplace can exist as design boundaries, but should not currently be described as fully operational production plane

### M2 target-state scope

- Domain Registry as unified registration backend
- Per-domain tool bundle complete control plane
- Plugin SPI large-scale integration
- Marketplace release, review, revocation, and rollback automation

Therefore, this contract mainly undertakes governance definition of target-state extension plane; current readiness can only treat it as a boundary document, not a completed delivery proof.
