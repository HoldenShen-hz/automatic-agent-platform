# ADR 090: Runtime, Data Reliability, and Operations

- Status: Accepted
- Decision Date: 2026-04-20

## Background

`§20`, `§24`-`§32`, `§33`, `§36` define long-running tasks, configuration governance, data consistency, storage, performance SLO, event / projection / DLQ, knowledge / memory / artifact, HA, deployment, and roadmap. These sections together constitute production operation foundation, but past ADRs mostly recorded single-point technical selections, lacking a unified decision面向长期运行.

## Decision

Platform runtime and data reliability adopt the following unified principles:

- Long-running tasks must have hibernation, wake-up, TTL, lease/fencing, recovery, and manual takeover capabilities.
- Configuration must be layered, versioned, canary-deployable, auditable, runtime configuration not allowed to scatter.
- Truth table, event log, projection, artifact, audit are different projections of the same State & Evidence Plane.
- Projection must be rebuildable; DLQ must be diagnosable, replayable, incident-upgradeable.
- HA, backup, restore, deployment promotion must align with readiness / promote criteria contract.
- Roadmap and success criteria are part of architecture governance, cannot be mixed into contract as temporary TODO.

## Trade-offs

- Do not treat projection as authoritative state.
- Do not allow critical workflow recovery relying solely on logs.
- Do not allow deployment and configuration changes to bypass release / readiness / promote criteria.

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

- `src/platform/five-plane-execution/*`
- `src/platform/five-plane-state-evidence/*`
- `src/platform/shared/stability/*`
- `src/platform/five-plane-control-plane/config-center/*`
- `config/*`

## Testing Requirements

- unit tests: state transition, lease/fencing, config resolution, projection rebuild.
- integration tests: long-running workflow, DLQ replay, startup recovery, release readiness.
- contract tests: execution or deployment without lease, without evidence, without readiness must not enter production chain.