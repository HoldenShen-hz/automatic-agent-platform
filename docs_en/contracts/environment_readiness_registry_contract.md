# Environment Readiness Registry Contract

## 1. Scope

This contract defines the readiness registry for external environments and key runtime dependencies.

It answers the question: Before entering staging, pre-prod, or prod, how does the system uniformly record whether external dependencies such as providers, gateways, sandboxes, worker fleets, and artifact stores are ready.

Related documents:

- `environment_and_configuration_governance_contract.md`
- `enterprise_secret_management_contract.md`
- `release_rollout_and_rollback_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Transform readiness from " relying on human memory" to a unified registry.
- Provide authoritative readiness facts for release gates, go-live gates, and incident diagnostics.
- Uniformly model credentials, secondary gates, owners, and last verified time.

## 3. Key Objects

- `EnvironmentReadinessRecord`
- `EnvironmentReadinessGateSet`
- `EnvironmentReadinessSummary`

## 4. `EnvironmentReadinessRecord` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `readiness_id` | `string` | Readiness record ID |
| `environment` | `dev \| test \| staging \| pre-prod \| prod` | Belongs to environment |
| `component_type` | `provider \| gateway \| sandbox \| worker_fleet \| artifact_store \| notification_channel \| external_service` | Component type |
| `component_id` | `string` | Component identifier |
| `credential_ready` | `boolean` | Whether credentials are ready |
| `secondary_gates_json` | `json` | Secondary gates such as webhook, moderation, quota, attestation |
| `owner` | `string` | Maintaining owner |
| `last_verified_at` | `timestamp` | Last verification time |
| `is_active` | `boolean` | Whether currently effective |
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
- When secondary gates fail, should block corresponding capabilities rather than just issue/warn warnings.
- When `last_verified_at` is too old, the system can degrade readiness to `stale` and trigger review.

## 6. `EnvironmentReadinessSummary`

Minimum fields:

- `environment`
- `component_type`
- `total`
- `ready`
- `not_ready`
- `stale`
- `all_ready`

## 7. Relationship with Release Gate

- Staging / pre-prod / prod go-live gate should reference readiness registry rather than manual verbal confirmation.
- Release gate must be able to answer:
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

Currently does not do:

- Fine-grained readiness sub-table explosions for each third-party business platform
- Directly copying business domain-specialized readiness models into the current system

## 9. Closure Conclusion

Environment readiness must not only exist in release verbal checks.

It should become a first-class registry that is queryable, auditable, and consumable by release gates.
