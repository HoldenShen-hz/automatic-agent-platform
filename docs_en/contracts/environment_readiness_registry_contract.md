# Environment Readiness Registry Contract

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

This contract defines the readiness registry for external environments and critical runtime dependencies.

It answers the question: Before entering staging, pre-prod, or prod, how does the system uniformly record whether external dependencies such as providers, gateways, sandboxes, worker fleets, and artifact stores are ready.

Related documents:

- `environment_and_configuration_governance_contract.md`
- `enterprise_secret_management_contract.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Objectives

- Transform readiness from "relying on human memory" to a unified registry.
- Provide authoritative readiness facts for release gates, go-live gates, and incident diagnostics.
- Unified modeling of credentials, secondary gates, owners, and last verified time.

## 3. Key Objects

- `EnvironmentReadinessRecord`
- `EnvironmentReadinessGateSet`
- `EnvironmentReadinessSummary`

## 4. `EnvironmentReadinessRecord` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `readiness_id` | `string` | Readiness record ID |
| `environment` | `dev \| test \| staging \| pre-prod \| prod` | Environment |
| `component_type` | `provider \| gateway \| sandbox \| worker_fleet \| artifact_store \| notification_channel \| external_service` | Component type |
| `component_id` | `string` | Component identifier |
| `credential_ready` | `boolean` | Whether credentials are ready |
| `secondary_gates_json` | `json` | Secondary gates such as webhook, moderation, quota, attestation |
| `owner` | `string` | Maintenance owner |
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

- When `credential_ready = false`, all formal operations depending on this component fail-closed by default.
- When secondary gates fail, the corresponding capability should be blocked, not just logged as a warning.
- When `last_verified_at` is too old, the system may degrade readiness to `stale` and trigger re-verification.

## 6. `EnvironmentReadinessSummary`

Minimum fields:

- `environment`
- `component_type`
- `total`
- `ready`
- `not_ready`
- `stale`
- `all_ready`

## 7. Relationship with Release Gates

- Staging / pre-prod / prod go-live gates should reference the readiness registry rather than manual verbal confirmation.
- Release gates must be able to answer:
  - Which external dependencies are not ready
  - Who is responsible
  - When was the last verification

## 8. Current Boundaries

Currently prioritized coverage:

- provider
- gateway
- sandbox
- artifact store
- worker fleet

Currently excluded:

- Fine-grained readiness sub-tables for each third-party business platform
- Directly copying business-domain-specific readiness models into the current system

## 9. Closure Conclusion

Environment readiness should not exist only in verbal release checks.

It should become a first-class registry that is queryable, auditable, and consumable by release gates.