# Ecosystem Extension Plane Contract

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

This contract defines the Extension Ecosystem Plane, including the Capability Registry, Domain Registry, Plugin SPI, Domain Tool Bundle, Review Pipeline, Marketplace, Compatibility and Revocation mechanisms.

It extends [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) to answer "how external extensions are safely onboarded, registered, published, upgraded, disabled, and rolled back."

## 2. Objectives

- Bring tool / skill / plugin / MCP extensions into a unified ecosystem governance model.
- Clarify capability declaration, review, version compatibility, revocation, and domain binding paths.
- Prevent third-party extensions from breaching platform security boundaries.
- Reserve explicit contract boundaries for `M2-EXT-01`'s `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry`.

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

### 5.1 `CapabilityDefinition` Minimum Fields

- `capability_id`
- `provider_type`
- `declared_permissions`
- `risk_level`
- `version`
- `owner_ref`

### 5.2 `DomainCapabilityRegistryEntry` Minimum Fields

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

- All extensions must declare capability before entering the execution chain.
- Domain bundle binding is the authoritative entry point for exposing capabilities to specific domains.
- Runtime must not load extension packages that have not passed compatibility, permission, and trust gates.

## 6. Plugin SPI Integration

The extension plane uniformly recognizes four SPI types:

- `DomainRetrieverPlugin`
- `DomainValidatorPlugin`
- `DomainPlannerPlugin`
- `DomainPresenterPlugin`

`PluginSpiRegistration` records at minimum:

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

- Lifecycle covers at minimum `registered -> loaded -> active -> inactive -> unloaded`.
- The current authoritative runtime isolation allows `shared_process`, `serialized_in_process`, `forked_process`, `sandboxed_process`, and `containerized_process`.
- `forked_process` represents an independent subprocess isolation baseline; `sandboxed_process` represents a stronger isolation mode with independent subprocess + dedicated sandbox root + minimal env whitelist + Node permission model.
- `containerized_process` represents a launcher-based external isolation runtime interface, which can be hosted by `docker` / `podman` / `bwrap` or equivalent standalone sandbox launchers; communication between host and child is via stdio JSON protocol.
- Neither `sandboxed_process` nor `containerized_process` should be directly characterized as completed OCI orchestrator, VM, or microVM fleet orchestration; the current repository provides auditable isolated runtime host and launcher interfaces, while real live infra still requires target environment verification.
- Isolated failure can set a plugin to `degraded` or `disabled`, and may include a cooldown window; cooldown state must be queryable by inventory, diagnostics, or API.
- If `forked_process`, `sandboxed_process`, or `containerized_process` is enabled, the runtime process ID should be queryable by inventory, diagnostics, or API, and the host process must be able to reap child processes during unload / shutdown.
- If `sandboxed_process` or `containerized_process` is enabled, the runtime sandbox root should also be queryable by inventory, diagnostics, or API, so operators can perform isolation root directory audits.
- Plugin invocation should publish at minimum `plugin:invocation_started` and `plugin:invocation_completed` typed audit events for audit and feedback projection consumption.
- SPI registration results must be queryable by inventory, diagnostics, and audit systems.
- Plugins can only interact with core through public SDK surfaces and must not reach into private implementations.

## 7. Review and Release Pipeline

Review workflow contains at minimum:

1. Submission
2. Static validation
3. Permission review
4. Compatibility check
5. Manual review
6. Release
7. Revocation or rollback

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
- Extension package should support signature or equivalent integrity verification.

## 8. Compatibility Matrix

Semantic version compatibility is divided into at least three layers:

- `api_contract`
- `permission_surface`
- `runtime_capability`

`CompatibilityMatrix` covers at minimum:

- `plugin_api_range`
- `built_with_platform_version`
- `min_runtime_version`
- `supported_domain_ids`
- `breaking_changes`

Rules:

- `enabled` does not mean compatible; must fail-close when compatibility gate is not passed.
- Domain bundle upgrades that introduce higher permissions or trust tier changes require re-review.

## 9. Revocation and Rollback

`RevocationRecord` contains at minimum:

- `revocation_id`
- `target_type`
- `target_id`
- `reason`
- `scope`
- `rollback_target?`
- `created_at`

Revocation trigger scenarios include at minimum:

- Permission surface exceeds declaration
- Signature invalid or source untrusted
- Compatibility regression
- Sandbox / policy escape
- Domain bundle misbinding

## 10. Relationship with Existing Documentation

- [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md) defines internal registration, authoring, and SPI baseline.
- `sandbox_and_auth_contract.md` provides security boundaries for extension execution.
- `api_surface_contract.md`, `admin_console_and_human_takeover_contract.md` are responsible for extension plane management entry points.

## 11. Phased Boundaries

### Current phase1-4 authoritative scope

- Capability declaration must exist
- Contract boundaries for manifest / compatibility / permission / trust must be explicit
- Domain bundle, plugin SPI, marketplace may exist as design boundaries, but should not be characterized as fully operational production plane currently

### `M2` target-state scope

- Domain Registry as unified registration backend
- Per-domain tool bundle complete control plane
- Plugin SPI large-scale integration
- Marketplace release, review, revocation, and rollback automation

Therefore, this contract primarily undertakes governance definition for target-state extension plane; current readiness can only treat it as a boundary document, not as a completed delivery proof.
