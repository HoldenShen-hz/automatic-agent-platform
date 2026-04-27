# Environment And Configuration Governance Contract

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

This contract defines environment layering, configuration center governance, pre-release gate, and configuration change control.

Related Documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, prod.
- Enable configuration to have version, approval, diff, rollback, and broadcast capabilities.
- Make pre-release gate executable at environment dimension, rather than human experience-based judgment.
- Make external environment readiness a queryable registry, not verbal status.

## 3. Environment Layering

| Environment | Primary Use | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | Mock providers, debug switches, relaxed lint |
| `test` | Automated testing | Fixtures / VCR, fault injection |
| `staging` | Integration validation | Near-production configuration, canary validation |
| `pre-prod` | Pre-release rehearsal | Production model list, migration and rollback validation |
| `prod` | Production service | Minimum privilege, formal audit, strict approval |

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
- Configuration changes must be diffable,rollable.
- Hot updates must broadcast to affected components.
- Feature flag, policy, prompt bundle effective scope must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance, not remain outside configuration governance.
- Config schema should preferably be generated from authoritative types / protocol schema, rather than long-term manually maintained.
- For configuration read/write, validation, warnings, and schema generation, best to share the same source of truth, avoiding "documentation approach" and "runtime parsing" divergence.
- Secret read interface by default only returns masked value or equivalent desensitization view; must not expose plaintext secrets to regular configuration query surface.
- High-risk configuration objects like custom provider profiles, model lists, permission lists should preferably have formal API/registry, rather than scattered in command lines or private YAML.
- Metadata like provider/model default context limits, request params, canonical limits should be governed through registry, rather than separately inferred at multiple entry points.
- If supporting multi-credential rotation for the same provider, pool strategy, cooldown TTL, reset hints, manual pinning, and disabled status should be included in formal config / registry, not scattered in provider adapter internal state.
- Each layer should at least support deterministic overlay composition of `default.json + <environment>.json`, avoiding "environment name exists but no environment difference".
- Multi-environment deployments must have machine-readable deployment matrix, at least summarizing config version, readiness, deployment binding, promotion prerequisite, and target release bundle.
- Release / deployment config should at least declare three types of references: `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref`; runtime and CLI only propagate refs, not secret plaintext.

## 6. Pre-Release Gate

At least automatically check:

- migration compatibility
- config schema validity
- workflow lint pass
- prompt lint pass
- eval threshold pass
- risk flag state healthy
- environment readiness registry pass
- runtime image provenance / digest pinning pass

## 6.1 Runtime Image Governance

Industrial-grade environments should at least support:

- Multi-stage builds, avoiding bringing build toolchain directly into runtime image
- Base image digest pinning or equivalent reproducible constraints
- Selecting runtime variant by capability, e.g., minimal runtime, browser runtime, sandbox runtime
- Optional heavy-dependency capabilities installed on demand, rather than defaulting to打包 all dependencies into the same image

## 7. Priority Chain

Configuration override order:

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. Dynamic Configuration Constraint Override

- Configuration override cannot be unrestricted "last write wins"; must explicitly declare overridable scope.
- At least distinguish five types of constraint layers: `global`, `environment`, `tenant/workspace`, `rollout/cohort`, `break-glass`.
- High-risk objects like provider profile, prompt bundle, policy rule, feature flag must not be silently overridden by low-trust sources.
- All overrides must generate logs and audit evidence, and be queryable in readiness / doctor views.
- Unknown override sources, illegal constraint combinations, or conflict chains must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- Embedded SDKs that depend on specific CLI / app-server runtime should explicitly pin or declare compatibility windows.
- Protocol version, runtime version, schema artifact version should be simultaneously queryable.
- Must not let SDK, CLI, server each silently drift then fail at runtime by chance.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have clear promotion sequence.
- `staging / pre-prod / prod` by default require both environment readiness and deployment binding to be satisfied; missing either should fail-close.
- `staging / pre-prod / prod` by default also require secret/config injection plan to be complete; missing any of `config_bundle_ref`, `registry_credential_ref`, or `deployment_credential_ref` should fail-close.
- Before target environment release, should explicitly validate prerequisites from previous environment promotion, rather than directly skipping levels for deployment.

## 8. Closure Conclusion

Industrial-grade configuration governance is not "just able to hot reload".

It must have:

- Environment isolation
- Version control
- Approval and diff
- Rollback
- Effect broadcast
- Readiness registry
