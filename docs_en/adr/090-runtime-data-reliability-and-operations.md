# ADR 090: Runtime, Data Reliability, and Operations

## Status

Accepted

## Date

2026-04-20

## Context

`§20`, `§24`-`§32`, `§33`, `§36` define long-running tasks, configuration governance, data consistency, storage, performance SLO, event/projection/DLQ, knowledge/memory/artifact, HA, deployment, and roadmap. These chapters together constitute the production operation foundation, but past ADRs were mostly recorded by single-point technical selection, lacking a unified decision for long-term operation.

## Decision

Platform runtime and data reliability adopt the following unified principles:

- Long-running tasks must have hibernation, wake, TTL, lease/fencing, recovery, and manual takeover capabilities.
- Configuration must be layered, versioned, staged, and auditable; runtime scattered configuration is not allowed.
- Truth table, event log, projection, artifact, and audit are different projections of the same State & Evidence Plane.
- Projection must be rebuildable; DLQ must be diagnosable, replayable, and upgradable to incident.
- HA, backup, restore, and deployment promotion must align with readiness/promote criteria contracts.
- Roadmap and success criteria are part of architecture governance, not temporary TODOs mixed into contracts.

## Trade-offs

- Do not treat projection as authoritative state.
- Do not rely on logs alone to recover critical workflows.
- Do not allow deployment and configuration changes to bypass release/readiness/promote criteria.

## Impact

Corresponding authoritative contracts:

- `lifecycle_and_termination_contract.md`
- `task_lease_and_fencing_contract.md`
- `configuration_layers_and_defaults_contract.md`
- `environment_and_configuration_governance_contract.md`
- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `production_storage_and_queue_contract.md`
- `artifact_store_contract.md`
- `artifact_unified_model_contract.md`
- `event_reliability_matrix_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `ha_coordinator_and_leader_election_contract.md`
- `remote_coordination_and_disaster_recovery_contract.md`
- `environment_readiness_registry_contract.md`
- `platform_promote_criteria_contract.md`

Corresponding implementation boundaries:

- `src/platform/execution/*`
- `src/platform/state-evidence/*`
- `src/platform/shared/stability/*`
- `src/platform/control-plane/config-center/*`
- `config/*`

## Testing Requirements

- Unit tests: State transition, lease/fencing, config resolution, projection rebuild.
- Integration tests: Long-running workflow, DLQ replay, startup recovery, release readiness.
- Contract tests: Executions or deployments without lease, evidence, or readiness must not enter production chain.