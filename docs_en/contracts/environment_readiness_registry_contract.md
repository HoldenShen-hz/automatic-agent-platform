# Environment Readiness Registry Contract

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

This contract defines the readiness registry for external environments and key runtime dependencies.

The question it answers: Before entering staging, pre-prod, or prod, how does the system uniformly record whether external dependencies like providers, gateways, sandboxes, worker fleets, artifact stores are ready.

Related Documents:

- `environment_and_configuration_governance_contract.md`
- `enterprise_secret_management_contract.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Transform readiness from "relying on human memory" to unified registry.
- Provide authoritative readiness facts for release gate, go-live gate, and incident diagnostics.
- Unify modeling of credentials, secondary gates, owner, last verified time.

## 3. Key Objects

- `EnvironmentReadinessRecord`
- `EnvironmentReadinessGateSet`
- `EnvironmentReadinessSummary`

## 4. EnvironmentReadinessRecord Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `readiness_id` | `string` | Readiness record ID |
| `environment` | `dev \| test \| staging \| pre-prod \| prod` | Owning environment |
| `component_type` | `provider \| gateway \| sandbox \| worker_fleet \| artifact_store \| notification_channel \| external_service` | Component type |
| `component_id` | `string` | Component identifier |
| `credential_ready` | `boolean` | Whether credentials are ready |
| `secondary_gates_json` | `json` | Secondary gates such as webhook, moderation, quota, attestation |
| `owner` | `string` | Maintaining owner |
| `last_verified_at` | `timestamp` | Last verification time |
| `is_active` | `boolean` | Whether currently active |
| `notes?` | `string` | Supplementary notes |

## 5. Gate Semantics

Minimum gate model:

- `credential_ready`
- `network_ready?`
- `webhook_ready?`
- `moderation_ready?`
- `quota_ready?`
- `attestation_ready?`
- `artifact_namespace_ready?`

Rules:

- When `credential_ready = false`, all formal operations depending on that component default to fail-closed.
- When secondary gates fail, should block corresponding capability, not just issue warnings.
- When `last_verified_at` is too old, system can degrade readiness to `stale` and trigger review.

## 6. EnvironmentReadinessSummary

Minimum fields:

- `environment`
- `component_type`
- `total`
- `ready`
- `not_ready`
- `stale`
- `all_ready`

## 7. Relationship with Release Gate

- Staging / pre-prod / prod go-live gates should reference readiness registry, not human verbal confirmation.
- Release gate must be able to answer:
  - Which external dependencies are not ready
  - Who is responsible
  - When was the last verification

## 8. Current Boundaries

Current priority coverage:

- provider
- gateway
- sandbox
- artifact store
- worker fleet

Currently not doing:

- Fine-grained readiness sub-table explosion for each third-party business platform
- Directly copying business domain-specific readiness models into current system

## 9. Closure Conclusion

Environment readiness should not only exist in release verbal checks.

It should become a first-class registry that is queryable, auditable, and consumable by release gates.
