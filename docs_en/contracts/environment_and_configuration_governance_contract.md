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

This contract defines environment layering, configuration center governance, pre-release gates, and configuration change control.

Related documents:

- `configuration_layers_and_defaults_contract.md`
- `environment_readiness_registry_contract.md`
- `release_rollout_and_rollback_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_secret_management_contract.md`

## 2. Goals

- Clarify capability boundaries for dev, test, staging, pre-prod, and prod.
- Give configurations version, approval, diff, rollback, and broadcast capabilities.
- Make pre-release gates executable at the environment dimension rather than manually judged by experience.
- Make external environment readiness a queryable registry rather than口头 status.

## 3. Environment Layering

| Environment | Primary Purpose | Allowed Capabilities |
| --- | --- | --- |
| `dev` | Local development | Mock provider, debug switches, lenient lint |
| `test` | Automated testing | Fixtures / VCR, fault injection |
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

- Every configuration change must generate a version number.
- Production configuration changes must have approval records.
- Configuration changes must be diffable and rollbackable.
- Hot updates must be broadcast to affected components.
- Feature flag, policy, and prompt bundle effective scopes must be visible.
- Runtime image / sandbox image / bundled extension tree should also enter version and change governance and must not drift outside configuration governance.
- Config schema should preferably be generated from authoritative types / protocol schema rather than long-term manually maintained.
- For configuration read/write, validation, warnings, and schema generation, it is best to share the same source of truth, avoiding divergence between "documentation style" and "runtime parsing."
- Secret reading interfaces default to returning masked values or equivalent sanitized views and must not expose plaintext secrets to ordinary configuration query surfaces.
- High-risk configuration objects such as custom provider profiles, model lists, and permission lists should preferably have formal API/registry rather than scattered in command lines or private YAML.
- Provider/model default context limits, request params, canonical limits, and other metadata should be governed through registry unification rather than independently inferred across multiple entry points.
- If multi-credential rotation for the same provider is supported, pool strategy, cooldown TTL, reset hints, manual pinning, and disabled state should be included in formal config / registry rather than scattered in provider adapter internal state.
- Each layer should support at minimum `default.json + <environment>.json` deterministic overlay composition, avoiding "having an environment name but no environment differences."
- Multi-environment deployments must have machine-readable deployment matrix, summarizing config version, readiness, deployment binding, promotion prerequisite, and target release bundle.
- Release / deployment config should declare at minimum `config_bundle_ref`, `registry_credential_ref`, `deployment_credential_ref` three types of references; runtime and CLI only propagate refs and must not propagate secret plaintext.

## 6. Pre-Release Gates

At minimum automatically check:

- Migration compatibility.
- Config schema validity.
- Workflow lint pass.
- Prompt lint pass.
- Eval threshold pass.
- Risk flag state healthy.
- Environment readiness registry pass.
- Runtime image provenance / digest pinning pass.

### 6.1 Runtime Image Governance

Industrial-grade environments support at minimum:

- Multi-stage builds to avoid bringing build toolchain directly into runtime image.
- Base image digest pinning or equivalent reproducible constraints.
- Select runtime variant by capability, e.g., minimal runtime, browser runtime, sandbox runtime.
- Optional dependency capability installed on demand rather than defaulting to bundling all dependencies into the same image.

## 7. Priority Chain

Configuration override order:

1. Secret / secure override
2. Environment bundle
3. System config
4. Division config
5. Role config
6. Runtime override

## 7A. Dynamic Configuration Constraint Override

- Configuration override cannot be unrestricted "last write wins"; explicit override scope must be declared.
- Distinguish at minimum five constraint layers: `global`, `environment`, `tenant/workspace`, `rollout/cohort`, `break-glass`.
- High-risk objects such as provider profiles, prompt bundles, policy rules, and feature flags must not be silently overridden by low-trust sources.
- All overrides must produce logs and audit evidence and be queryable in readiness / doctor views.
- Unknown override sources, illegal constraint combinations, or conflicting chains must fail-close.

## 7.1 SDK / Runtime Compatibility Governance

- If embedded SDK depends on specific CLI / app-server runtime, explicit pin or compatibility window should be declared.
- Protocol version, runtime version, and schema artifact version should be simultaneously queryable.
- SDK, CLI, and server must not silently drift from each other and then fail at runtime by accident.

## 7.2 Multi-Environment Deployment Matrix

- `dev -> test -> staging -> pre-prod -> prod` must have explicit promotion order.
- `staging / pre-prod / prod` default requires environment readiness and deployment binding to be satisfied simultaneously; missing either should fail-close.
- `staging / pre-prod / prod` also default require complete secret/config injection plan; missing any of `config_bundle_ref`, `registry_credential_ref`, or `deployment_credential_ref` should fail-close.
- Before target environment release, explicit validation of prerequisite environments' promotion prerequisites should be performed rather than directly skipping levels for deployment.

## 8. Conclusion

Industrial-grade configuration governance is not "just able to hot-reload."

It must have:

- Environment isolation.
- Version control.
- Approval and diff.
- Rollback.
- Effect broadcast.
- Readiness registry.
