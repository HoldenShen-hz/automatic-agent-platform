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
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines environment layering, configuration center governance, pre-release gates and configuration change control.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, prod.
- Give configuration version, approval, diff, rollback and broadcast capabilities.
- Make release gates executable at environment dimension, rather than human experience-based judgment.
- Make external environment readiness a queryable registry rather than verbal state.

## 3. Environment Layering

| Environment | Primary Use | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | mock provider, debug switch, lenient lint |
| `test` | Automated testing | fixture / VCR, fault injection |
| `staging` | Integration verification | near-production config, gray-scale validation |
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

- Every configuration change must generate a version number.
- Production configuration changes require approval records.
- Configuration changes must be diff-able and roll-backable.
- After hot update, must broadcast to affected components.
- Effective scope of feature flag, policy, prompt bundle must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance, should not be游离于 configuration governance.
- Config schema should preferably be generated from authoritative types / protocol schema, rather than long-term manually maintained.
- For configuration read/write, validation, warnings and schema generation, best to share the same source of truth, to avoid "document写法" and "runtime parsing" diverging.
- Secret read interface defaults to returning masked value or equivalent desensitized view, must not expose plaintext secret to ordinary configuration query surface.
- High-risk configuration objects like custom provider profile, model list, permission list should preferably have formal API/registry, rather than scattered in command line or private YAML.
- Provider/model default context upper bound, request params, canonical limits and other metadata should be governed through registry uniformly, rather than individually inferred across multiple entries.
- If supporting same provider multi-credential rotation, pool strategy, cooldown TTL, reset hints, manual pinning and disabled state should be included in formal config / registry, rather than scattered in provider adapter internal state.
- Each layer should support at minimum `default.json + <environment>.json` deterministic overlay composition, avoiding "has environment name but no environment difference".
- Multi-environment deployment must have machine-readable deployment matrix, summarizing at minimum config version, readiness, deployment binding, promotion prerequisite and target release bundle.
- Release / deployment config should declare at minimum `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref` three types of references; runtime and CLI only propagate ref, not secret plaintext.

## 6. Pre-Release Gates

At minimum automatic checks:

- migration compatibility
- config schema validity
- workflow lint pass
- prompt lint pass
- eval threshold pass
- risk flag state healthy
- environment readiness registry pass
- runtime image provenance / digest pinning pass

## 6.1 Runtime Image Governance

Industrial-grade environments should support at minimum:

- Multi-stage build, avoiding bringing build toolchain directly into runtime image
- Base image digest pinning or equivalent reproducible constraint
- Choose runtime variant by capability, e.g., minimum runtime, browser runtime, sandbox runtime
- Optional re-dependency capabilities installed on demand, rather than defaulting all dependencies into same image

## 7. Priority Chain

Configuration override order:

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. Dynamic Configuration Constraint Override

- Configuration override cannot be unrestricted "last write wins", must explicitly declare overridable scope.
- Distinguish at minimum: `global`, `environment`, `tenant/workspace`, `rollout/cohort`, `break-glass` five types of constraint layers.
- High-risk objects such as provider profile, prompt bundle, policy rule, feature flag must not be silently overridden by low-trust sources.
- All overrides must produce logs and audit evidence, and be queryable in readiness / doctor view.
- Unknown override source, illegal constraint combination or conflict chain must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- Embedded SDK relying on specific CLI / app-server runtime should explicitly pin or declare compatibility window.
- Protocol version, runtime version, schema artifact version should be simultaneously queryable.
- Must not let SDK, CLI, server each silently drift and then fail occasionally at runtime.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have clear promotion order.
- `staging / pre-prod / prod` default requires environment readiness and deployment binding to be simultaneously satisfied; missing either should fail-close.
- `staging / pre-prod / prod` default also requires secret/config injection plan complete; missing any of `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref` should fail-close.
- Before target environment release, should explicitly validate preceding environment promotion prerequisite, rather than directly skipping-level deploying.

## 8. Closure Conclusion

Industrial-grade configuration governance is not "just able to hot reload".

It must have:

- Environment isolation
- Version control
- Approval and diff
- Rollback
- Effective broadcast
- Readiness registry
