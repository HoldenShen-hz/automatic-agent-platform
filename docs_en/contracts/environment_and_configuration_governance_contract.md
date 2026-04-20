# Environment And Configuration Governance Contract

## 1. Scope

This contract defines environment layering, configuration center governance, pre-release gates, and configuration change control.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, and prod.
- Make configuration versioned, approvable, diff-able, rollback-able, and broadcastable.
- Make release gates executable at the environment dimension rather than relying on manual experience judgment.
- Make external environment readiness a queryable registry rather than verbal status.

## 3. Environment Layering

| Environment | Primary Use | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | Mock provider, debug switches, relaxed lint |
| `test` | Automated testing | Fixture / VCR, fault injection |
| `staging` | Integration verification | Near-production configuration, canary validation |
| `pre-prod` | Pre-release rehearsal | Production model list, migration and rollback validation |
| `prod` | Production service | Least privilege, formal audit, strict approval |

## 4. Configuration Center Objects

- `ConfigBundle`
- `ConfigVersion`
- `ConfigApproval`
- `ConfigDiff`
- `ConfigRollbackTicket`
- `ConfigBroadcastEvent`

## 5. Configuration Governance Rules

- Each configuration change must generate a version number.
- Production configuration changes must have approval records.
- Configuration changes must be diff-able and rollback-able.
- Hot updates must be broadcast to affected components.
- The effective scope of feature flags, policies, and prompt bundles must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance and must not wander/remain outside configuration governance.
- Config schema should prioritize being generated from authoritative types / protocol schema rather than long-term manual maintenance.
- For configuration reading/writing, validation, warnings, and schema generation, it is best to share the same source of truth to avoid "documentation way" and "runtime parsing" diverging.
- Secret reading interface defaults to returning masked value or equivalent sanitized view and must not expose plaintext secrets to general configuration query surfaces.
- High-risk configuration objects such as custom provider profiles, model lists, and permission lists should prioritize having formal API/registry rather than scattered in command lines or private YAML.
- Metadata such as provider/model default context limits, request params, and canonical limits should be governed through registry unification rather than inferred separately at multiple entrypoints.
- If supporting multi-credential rotation for the same provider, pool strategy, cooldown TTL, reset hints, manual pinning, and disabled status should be formally included in config / registry rather than scattered in provider adapter internal state.
- Each layer should at minimum support deterministic overlay synthesis of `default.json + <environment>.json` to avoid "having environment name but no environment differences."
- Multi-environment deployments must have machine-readable deployment matrix, at minimum summarizing config version, readiness, deployment binding, promotion prerequisite, and target release bundle.
- Release / deployment config should at minimum declare `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref` three types of references; runtime and CLI only propagate refs and must not propagate secret plaintext.

## 6. Pre-Release Gates

At minimum automatically check:

- migration compatibility
- config schema validity
- workflow lint pass
- prompt lint pass
- eval threshold pass
- risk flag state healthy
- environment readiness registry pass
- runtime image provenance / digest pinning pass

### 6.1 Runtime Image Governance

Industrial-grade environments should at minimum support:

- Multi-stage builds to avoid bringing build toolchain directly into runtime image
- Base image digest pinning or equivalent reproducible constraints
- Choose runtime variant by capability, e.g., minimal runtime, browser runtime, sandbox runtime
- Optional re-dependency capabilities installed on demand rather than defaulting to bundling all dependencies into the same image

## 7. Priority Chain

Configuration override order:

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. Dynamic Configuration Constraint Override

- Configuration override cannot be unlimited "last write wins" and must explicitly declare overridable scope.
- At minimum distinguish: `global`, `environment`, `tenant/workspace`, `rollout/cohort`, `break-glass` five types of constraint layers.
- High-risk objects such as provider profiles, prompt bundles, policy rules, and feature flags must not be silently overridden by low-trust sources.
- All overrides must produce logs and audit evidence and be queryable in readiness / doctor views.
- Unknown override sources, illegal constraint combinations, or conflicting chains must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- Embedded SDKs that depend on specific CLI / app-server runtime should explicitly pin or declare compatibility windows.
- Protocol version, runtime version, and schema artifact version should be simultaneously queryable.
- Must not let SDK, CLI, and server each silently drift and then occasionally fail at runtime.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have clear promotion order.
- `staging / pre-prod / prod` default require environment readiness and deployment binding to both be satisfied; failing either should fail-close.
- `staging / pre-prod / prod` default also require secret/config injection plan to be complete; failing any of `config_bundle_ref`, `registry_credential_ref`, or `deployment_credential_ref` should fail-close.
- Before releasing to target environment, should explicitly validate prerequisites for preceding environment promotion rather than directly skip-level deploy.

## 8. Closure Conclusion

Industrial-grade configuration governance is not "just being able to hot-reload."

It must have:

- Environment isolation
- Version control
- Approval and diff
- Rollback
- Effect broadcast
- Readiness registry
