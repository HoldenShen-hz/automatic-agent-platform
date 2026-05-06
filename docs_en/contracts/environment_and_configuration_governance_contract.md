# Environment And Configuration Governance Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and release
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines environment layering, configuration center governance, pre-release gate checks, and configuration change control.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, prod.
- Enable configuration with version, approval, diff, rollback, and broadcast capabilities.
- Make release gate enforceable at environment dimension, not relying on human experience.
- Make external environment readiness a queryable registry, not verbal state.

## 3. Environment Layering

| Environment | Primary Purpose | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | mock provider, debug switches, relaxed lint |
| `test` | Automated testing | fixture / VCR, fault injection |
| `staging` | Integration verification | near-production config, canary validation |
| `pre-prod` | Pre-release rehearsal | production model list, migration and rollback validation |
| `prod` | Production service | minimum privilege, formal audit, strict approval |

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
- Configuration changes must be diffable and rollbackable.
- Hot updates must broadcast to affected components.
- Effective scope of feature flags, policies, prompt bundles must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance, not wander outside configuration governance.
- Config schema should preferably be generated from authoritative types / protocol schema, not maintained by long-term handwritten maintenance.
- For configuration read/write, validation, warnings, and schema generation, it is best to share the same source of truth to avoid "documentation approach" and "runtime parsing" divergence.
- Secret read interfaces default to returning masked value or equivalent desensitized view, must not expose plaintext secret to regular configuration query surface.
- High-risk configuration objects like custom provider profiles, model lists, permission lists should preferably have formal API/registry, not scattered in command line or private YAML.
- Default context limits, request params, canonical limits, etc. for provider/model metadata should be governed through registry, not inferred separately at multiple entry points.
- If supporting same-provider multi-credential rotation, pool strategy, cooldown TTL, reset hints, manual pinning, and disabled state should be included in formal config / registry, not scattered in provider adapter internal state.
- Each layer should at least support deterministic overlay synthesis of `default.json + <environment>.json` to avoid "having environment name but no environment difference".
- Multi-environment deployments must have machine-readable deployment matrix, summarizing at least: config version, readiness, deployment binding, promotion prerequisite, and target release bundle.
- Release / deployment config should at least declare `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref` three types of references; runtime and CLI only propagate refs, not plaintext secrets.

## 6. Pre-Release Gate

At minimum automatically check:

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

- Multi-stage build, avoid bringing build toolchain directly into runtime image
- Base image digest pinning or equivalent reproducible constraints
- Select runtime variant by capability, e.g., minimum runtime, browser runtime, sandbox runtime
- Optional re-dependency capabilities installed on demand, not all dependencies bundled into the same image by default

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
- At least distinguish: `global`, `environment`, `tenant/workspace`, `release/cohort`, `break-glass` five constraint layers.
- High-risk objects like provider profile, prompt bundle, policy rule, feature flag must not be silently overridden by low-trust sources.
- All overrides must generate logs and audit evidence, and be queryable in readiness / doctor view.
- Unknown override source, illegal constraint combination, or conflict chain must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- Embedded SDK depending on specific CLI / app-server runtime should explicitly pin or declare compatibility window.
- Protocol version, runtime version, schema artifact version should be simultaneously queryable.
- Must not let SDK, CLI, server each silently drift and then occasionally fail at runtime.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have clear promotion order.
- `staging / pre-prod / prod` by default require both environment readiness and deployment binding to be satisfied; fail-close if either is missing.
- `staging / pre-prod / prod` by default also require secret/config injection plan to be complete; fail-close if any of `config_bundle_ref`, `registry_credential_ref`, or `deployment_credential_ref` is missing.
- Before publishing to target environment, should explicitly validate preceding environment promotion prerequisite, not directly skip-level deploy.

## 8. Conclusion

Industrial-grade configuration governance is not "as long as it can hot-reload".

It must have:

- Environment isolation
- Version control
- Approval and diff
- Rollback
- Effective broadcast
- Readiness registry
