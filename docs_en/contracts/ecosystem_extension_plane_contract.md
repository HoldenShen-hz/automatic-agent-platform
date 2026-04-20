# Ecosystem Extension Plane Contract

## 1. Scope

This contract defines the extension ecosystem plane of the final platform, including capability registry, plugin review, marketplace, compatibility, and revocation mechanisms.

It extends `tool_skill_plugin_contract.md` to answer "how external extensions are safely integrated, published, upgraded, and disabled."

## 2. Goals

- Let tool / skill / plugin / MCP extensions enter unified ecosystem governance model.
- Clarify capability declaration, review, version compatibility, and revocation paths.
- Prevent third-party extensions from breaking platform security boundaries.

## 3. Key Components

- `CapabilityRegistry`
- `ExtensionReviewPipeline`
- `MarketplaceCatalog`
- `CompatibilityResolver`
- `RevocationService`

## 4. Key Objects

- `CapabilityDefinition`
- `ExtensionPackage`
- `ReviewDecision`
- `CompatibilityMatrix`
- `RevocationRecord`

## 5. CapabilityDefinition Minimum Fields

- `capability_id`
- `provider_type`
- `declared_permissions`
- `risk_level`
- `version`
- `owner_ref`

## 6. Behavioral Constraints

- All extensions must first declare capability before entering execution chain.
- Marketplace publication must go through review decision.
- Published extensions must support revoke / disable / rollback.
- Runtime must not load extension packages that failed compatibility check.

## 7. Relationship with Existing Documents

- `tool_skill_plugin_contract.md` is the internal registration and permission baseline.
- This contract defines the platform layer after external ecosystemization.
- `sandbox_and_auth_contract.md` provides the security boundary for extension execution.

## 8. Phased Introduction

- Phase 4: Formal marketplace and ecosystem governance.

## 9. Supplementary Rules

- Extension package should support signature or equivalent integrity verification.
- Review workflow at minimum includes: submission, static validation, permission review, human review, publication, revocation.
- Semantic version compatibility at minimum distinguishes: `api_contract`, `permission_surface`, `runtime_capability` three layers.
