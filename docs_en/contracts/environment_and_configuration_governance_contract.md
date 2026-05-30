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

This contract defines environment layering, configuration center governance, pre-release gate, and configuration change control.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, prod.
- Give configurations version, approval, diff, rollback, and broadcast capabilities.
- Make release gate executable at environment dimension, not manual experience-based judgment.
- Make external environment readiness a queryable registry, not verbal status.

## 3. Environment Layering

| Environment | Primary Use | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | Mock provider, debug switches, lenient lint |
| `test` | Automated testing | Fixture / VCR, fault injection |
| `staging` | Integration verification | Near-production config, canary validation |
| `pre-prod` | Pre-release rehearsal | Production model list, migration and rollback verification |
| `prod` | Production service | Minimum privilege, formal audit, strict approval |

## 4. Configuration Center Objects

- `ConfigBundle`
- `ConfigVersion`
- `ConfigApproval`
- `ConfigDiff`
- `ConfigRollbackTicket`
- `ConfigBroadcastEvent`

## 5. Configuration Governance Rules

- Every configuration change must generate a version number.
- Production configuration changes must have approval records.
- Configuration changes must be diffable and roll-backable.
- Hot updates must broadcast to affected components.
- Effective scope of feature flags, policies, and prompt bundles must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance, not游离于配置治理之外.
- Config schema should preferably be generated from authoritative types / protocol schema, not maintained by long-term manual writing.
- For configuration read/write, validation, warnings, and schema generation, best to share the same source of truth, avoiding "documentation approach" and "runtime parsing" divergence.
- Secret read interface defaults to returning masked value or equivalent sanitized view; must not expose plaintext secret to ordinary configuration query surface.
- High-risk configuration objects like custom provider profile, model list, and permission list should preferably have formal API/registry, not scattered in command line or private YAML.
- Provider/model metadata like default context upper limit, request params, and canonical limits should be governed through registry centrally, not inferred separately at multiple entry points.
- If supporting multi-credential rotation for same provider, pool strategy, cooldown TTL, reset hints, manual pinning, and disabled status should be included in formal config / registry, not scattered in provider adapter internal state.
- Each layer should support at minimum `default.json + <environment>.json` deterministic overlay composition, avoiding "environment name exists but no environment difference".
- Multi-environment deployment must have machine-readable deployment matrix, summarizing at minimum config version, readiness, deployment binding, promotion prerequisite, and target release bundle.
- Release / deployment config should declare at minimum three types of references: `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref`; runtime and CLI only propagate ref, not plaintext secret.

## 6. Pre-Release Gate

At minimum automatically checks:

- Migration compatibility
- Config schema validity
- Workflow lint pass
- Prompt lint pass
- Eval threshold pass
- Risk flag state healthy
- Environment readiness registry pass
- Runtime image provenance / digest pinning pass

## 6.1 Runtime Image Governance

Industrial-grade environments should support at minimum:

- Multi-stage build, avoiding bringing build toolchain directly into runtime image
- Base image digest pinning or equivalent reproducible constraint
- Select runtime variant by capability, e.g., minimal runtime, browser runtime, sandbox runtime
- Optional dependency capability installed on demand, not defaulting all dependencies into same image

## 7. Priority Chain

Configuration override order:

1. secret / secure override
2. environment bundle
3. system config
4. division config
5. role config
6. runtime override

## 7A. Dynamic Configuration Constraint Override

- Configuration override cannot be unlimited "last write wins"; must explicitly declare overridable scope.
- Distinguish at minimum five constraint layers: `global`, `environment`, `tenant/workspace`, `rollout/cohort`, `break-glass`.
- High-risk objects like provider profile, prompt bundle, policy rule, and feature flag must not be silently overridden by low-trust sources.
- All overrides must produce logs and audit evidence, and be queryable in readiness / doctor view.
- Unknown override source, illegal constraint combination, or conflict chain must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- Embedded SDK if depending on specific CLI / app-server runtime should explicitly pin or declare compatibility window.
- Protocol version, runtime version, schema artifact version should be simultaneously queryable.
- Must not let SDK, CLI, server each silently drift and then occasionally fail at runtime.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have explicit promotion order.
- `staging / pre-prod / prod` default requires environment readiness and deployment binding to be simultaneously satisfied; missing either should fail-close.
- `staging / pre-prod / prod` default also requires secret/config injection plan complete; missing any of `config_bundle_ref`, `registry_credential_ref`, or `deployment_credential_ref` should fail-close.
- Before releasing to target environment, should explicitly validate previous environment promotion prerequisite, not directly skip-level deploy.

## 8. Conclusion

Industrial-grade configuration governance is not "just able to hot-reload".

It must have:

- Environment isolation
- Version control
- Approval and diff
- Rollback
- Effect broadcast
- Readiness registry