# Contracts

> `contracts/` is the formal specification layer.
> This defines authoritative data structures, message protocols, directory boundaries, state machines, and behavioral constraints, and is not responsible for maintaining current completion status.

## 1. Usage

If you need to:

- Write code
- Modify schema
- Modify task state machine or event protocol
- Modify storage, approval, budget, or security boundaries
- Add new division/tool/provider/gateway capability

First look at this file, then enter the corresponding contract.

## 2. Contract Grouping Overview

| Scope | Topic | Main Documents |
|-------|-------|----------------|
| Core Execution | task, workflow, executable unit, result envelope, lifecycle, state matrix, transition service, runtime execution, workflow static analysis, compensation, context, error model, startup recovery drill | `task_and_workflow_contract.md`, `executable_unit_contract.md`, `result_envelope_contract.md`, `lifecycle_and_termination_contract.md`, `runtime_state_machine_contract.md`, `state_transition_matrix_contract.md`, `transition_service_contract.md`, `runtime_execution_contract.md`, `workflow_static_analysis_and_compensation_contract.md`, `context_propagation_contract.md`, `app_error_contract.md`, `error_code_registry.md`, `startup_consistency_and_recovery_drill_contract.md` |
| Organization and Roles | agent, division, supervisor | `agent_contract.md`, `division_definition_contract.md`, `supervisor_contract.md` |
| Events and Channels | event bus, typed event bus, event reliability, event registry, gateway, streaming, message parts | `event_bus_contract.md`, `typed_event_bus_contract.md`, `event_reliability_matrix_contract.md`, `event_registry_and_ops_threshold_contract.md`, `gateway_message_contract.md`, `gateway_streaming_contract.md`, `message_parts_contract.md` |
| Tool / Provider | tool, skill, plugin, provider execution, tool metadata, idempotency, edit replacement, output sanitization, workflow IO precheck, context overflow, data classification | `tool_skill_plugin_contract.md`, `tool_and_provider_execution_contract.md`, `tool_metadata_and_recovery_contract.md`, `idempotency_and_recovery_matrix_contract.md`, `edit_replacement_chain_contract.md`, `tool_output_sanitization_contract.md`, `workflow_io_compatibility_precheck_contract.md`, `context_compaction_and_overflow_contract.md`, `data_classification_and_prompt_handling_contract.md` |
| Data and Storage | storage, runtime repository, file lock, distributed locking, production PG/queue, artifact, artifact unified model, observability, trace/RCA, debug/inspect/health/backpressure, diagnostics, testing reset, VCR/fixture, quality matrix, chaos, audit lineage | `storage_schema_contract.md`, `runtime_repository_and_migration_contract.md`, `file_lock_contract.md`, `distributed_locking_contract.md`, `production_storage_and_queue_contract.md`, `artifact_store_contract.md`, `artifact_unified_model_contract.md`, `observability_contract.md`, `trace_and_root_cause_observability_contract.md`, `debug_inspect_health_backpressure_contract.md`, `diagnostics_snapshot_and_repro_bundle_contract.md`, `testing_singleton_reset_contract.md`, `vcr_and_fixture_testing_contract.md`, `quality_engineering_and_chaos_testing_contract.md`, `audit_lineage_and_retention_contract.md` |
| Governance and Security | approval, sandbox, auth, budget, policy engine, secret management, prompt/model/policy governance, supply chain, rollout/rollback, human takeover, HITL explainability, control vs intelligence | `approval_and_hitl_contract.md`, `sandbox_and_auth_contract.md`, `cost_and_budget_contract.md`, `policy_engine_contract.md`, `enterprise_secret_management_contract.md`, `prompt_model_policy_governance_contract.md`, `supply_chain_and_dependency_security_contract.md`, `slo_alerting_and_runbook_contract.md`, `release_rollout_and_rollback_contract.md`, `admin_console_and_human_takeover_contract.md`, `hitl_experience_and_explainability_contract.md`, `control_vs_intelligence_boundary_contract.md` |
| Platform Surface | API, directory structure, architecture governance, version governance, config layering, environment governance, environment readiness, platform promote criteria, UI console/cockpit, tenant, billing, license, observe (legacy perception file), memory quality, naming boundary, token budget | `api_surface_contract.md`, `project_structure_contract.md`, `architecture_governance_and_versioning_contract.md`, `configuration_layers_and_defaults_contract.md`, `environment_and_configuration_governance_contract.md`, `environment_readiness_registry_contract.md`, `platform_promote_criteria_contract.md`, `ui_console_and_cockpit_contract.md`, `billing_and_tenant_contract.md`, `license_and_capability_boundary_contract.md`, `perception_contract.md`, `memory_decay_and_quality_contract.md`, `naming_and_engineering_boundary_contract.md`, `token_budget_allocation_contract.md` |
| Long-term Platform Layer | execution plane, HA coordinator, data plane, tenant/org, tenant isolation, governance, observe/assess intelligence (legacy perception-intelligence file), ecosystem, metering, enterprise ops, remote coordination, disaster recovery | `execution_plane_contract.md`, `ha_coordinator_and_leader_election_contract.md`, `data_plane_contract.md`, `tenant_and_organization_contract.md`, `tenant_isolation_and_shared_worker_safety_contract.md`, `governance_control_plane_contract.md`, `perception_intelligence_plane_contract.md`, `ecosystem_extension_plane_contract.md`, `monetization_metering_plane_contract.md`, `enterprise_operations_plane_contract.md`, `remote_coordination_and_disaster_recovery_contract.md` |

## 3. Finding Contract by Topic

### 3.1 Core System and Execution Main Chain

Priority reading:

1. [task_and_workflow_contract.md](./task_and_workflow_contract.md)
2. [executable_unit_contract.md](./executable_unit_contract.md)
3. [result_envelope_contract.md](./result_envelope_contract.md)
4. [lifecycle_and_termination_contract.md](./lifecycle_and_termination_contract.md)
5. [runtime_state_machine_contract.md](./runtime_state_machine_contract.md)
6. [state_transition_matrix_contract.md](./state_transition_matrix_contract.md)
7. [transition_service_contract.md](./transition_service_contract.md)
8. [runtime_execution_contract.md](./runtime_execution_contract.md)
9. [workflow_static_analysis_and_compensation_contract.md](./workflow_static_analysis_and_compensation_contract.md)
10. [task_lease_and_fencing_contract.md](./task_lease_and_fencing_contract.md)
11. [context_propagation_contract.md](./context_propagation_contract.md)
12. [app_error_contract.md](./app_error_contract.md)
13. [error_code_registry.md](./error_code_registry.md)
14. [startup_consistency_and_recovery_drill_contract.md](./startup_consistency_and_recovery_drill_contract.md)
15. [control_vs_intelligence_boundary_contract.md](./control_vs_intelligence_boundary_contract.md)
16. [agent_contract.md](./agent_contract.md)
17. [division_definition_contract.md](./division_definition_contract.md)

### 3.2 Events, Gateway, and Streaming Output

Priority reading:

1. [event_bus_contract.md](./event_bus_contract.md)
2. [typed_event_bus_contract.md](./typed_event_bus_contract.md)
3. [event_reliability_matrix_contract.md](./event_reliability_matrix_contract.md)
4. [event_registry_and_ops_threshold_contract.md](./event_registry_and_ops_threshold_contract.md)
5. [gateway_message_contract.md](./gateway_message_contract.md)
6. [gateway_streaming_contract.md](./gateway_streaming_contract.md)
7. [message_parts_contract.md](./message_parts_contract.md)
8. [supervisor_contract.md](./supervisor_contract.md)

### 3.3 Storage, Artifact, and Observability

Priority reading:

1. [storage_schema_contract.md](./storage_schema_contract.md)
2. [runtime_repository_and_migration_contract.md](./runtime_repository_and_migration_contract.md)
3. [file_lock_contract.md](./file_lock_contract.md)
4. [distributed_locking_contract.md](./distributed_locking_contract.md)
5. [production_storage_and_queue_contract.md](./production_storage_and_queue_contract.md)
6. [artifact_store_contract.md](./artifact_store_contract.md)
7. [artifact_unified_model_contract.md](./artifact_unified_model_contract.md)
8. [observability_contract.md](./observability_contract.md)
9. [trace_and_root_cause_observability_contract.md](./trace_and_root_cause_observability_contract.md)
10. [debug_inspect_health_backpressure_contract.md](./debug_inspect_health_backpressure_contract.md)
11. [diagnostics_snapshot_and_repro_bundle_contract.md](./diagnostics_snapshot_and_repro_bundle_contract.md)
12. [audit_lineage_and_retention_contract.md](./audit_lineage_and_retention_contract.md)
13. [testing_singleton_reset_contract.md](./testing_singleton_reset_contract.md)
14. [vcr_and_fixture_testing_contract.md](./vcr_and_fixture_testing_contract.md)
15. [quality_engineering_and_chaos_testing_contract.md](./quality_engineering_and_chaos_testing_contract.md)

### 3.4 Security, Approval, Budget

Priority reading:

1. [approval_and_hitl_contract.md](./approval_and_hitl_contract.md)
2. [sandbox_and_auth_contract.md](./sandbox_and_auth_contract.md)
3. [cost_and_budget_contract.md](./cost_and_budget_contract.md)
4. [policy_engine_contract.md](./policy_engine_contract.md)
5. [enterprise_secret_management_contract.md](./enterprise_secret_management_contract.md)
6. [prompt_model_policy_governance_contract.md](./prompt_model_policy_governance_contract.md)
7. [supply_chain_and_dependency_security_contract.md](./supply_chain_and_dependency_security_contract.md)
8. [slo_alerting_and_runbook_contract.md](./slo_alerting_and_runbook_contract.md)
9. [release_rollout_and_rollback_contract.md](./release_rollout_and_rollback_contract.md)
10. [admin_console_and_human_takeover_contract.md](./admin_console_and_human_takeover_contract.md)
11. [hitl_experience_and_explainability_contract.md](./hitl_experience_and_explainability_contract.md)

### 3.5 Tool, Skill, Plugin, Provider

Priority reading:

1. [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md)
2. [tool_and_provider_execution_contract.md](./tool_and_provider_execution_contract.md)
3. [tool_metadata_and_recovery_contract.md](./tool_metadata_and_recovery_contract.md)
4. [idempotency_and_recovery_matrix_contract.md](./idempotency_and_recovery_matrix_contract.md)
5. [edit_replacement_chain_contract.md](./edit_replacement_chain_contract.md)
6. [tool_output_sanitization_contract.md](./tool_output_sanitization_contract.md)
7. [workflow_io_compatibility_precheck_contract.md](./workflow_io_compatibility_precheck_contract.md)
8. [context_compaction_and_overflow_contract.md](./context_compaction_and_overflow_contract.md)
9. [data_classification_and_prompt_handling_contract.md](./data_classification_and_prompt_handling_contract.md)
10. [api_surface_contract.md](./api_surface_contract.md)

Supplementary notes:

- Research items like `question`, `todo_write`, progressive `tool_result` summary, network egress audit, Unicode steganography cleaning, tool recommend/deferred loading, skill conditional activation, etc. have been incorporated into this group of contracts and are no longer split into separate parallel specifications.
- Skill author entry point see [guides/skill-authoring.md](../guides/skill-authoring.md).

### 3.6 Platform Structure and Future Extensions

Priority reading:

1. [project_structure_contract.md](./project_structure_contract.md)
2. [architecture_governance_and_versioning_contract.md](./architecture_governance_and_versioning_contract.md)
3. [configuration_layers_and_defaults_contract.md](./configuration_layers_and_defaults_contract.md)
4. [environment_and_configuration_governance_contract.md](./environment_and_configuration_governance_contract.md)
5. [environment_readiness_registry_contract.md](./environment_readiness_registry_contract.md)
6. [platform_promote_criteria_contract.md](./platform_promote_criteria_contract.md)
7. [ui_console_and_cockpit_contract.md](./ui_console_and_cockpit_contract.md)
8. [billing_and_tenant_contract.md](./billing_and_tenant_contract.md)
9. [license_and_capability_boundary_contract.md](./license_and_capability_boundary_contract.md)
10. [perception_contract.md](./perception_contract.md) (Observe compatible file)
11. [memory_decay_and_quality_contract.md](./memory_decay_and_quality_contract.md)
12. [naming_and_engineering_boundary_contract.md](./naming_and_engineering_boundary_contract.md)
13. [token_budget_allocation_contract.md](./token_budget_allocation_contract.md)

Supplementary notes:

- Research items like dynamic configuration constraint coverage, memory retrieval and experience reuse, session dual storage, etc. have been incorporated into `environment_and_configuration_governance`, `memory_decay_and_quality`, `storage_schema` respectively.

### 3.7 Long-term Platform Evolution

Priority reading:

1. [execution_plane_contract.md](./execution_plane_contract.md)
2. [ha_coordinator_and_leader_election_contract.md](./ha_coordinator_and_leader_election_contract.md)
3. [data_plane_contract.md](./data_plane_contract.md)
4. [tenant_and_organization_contract.md](./tenant_and_organization_contract.md)
5. [tenant_isolation_and_shared_worker_safety_contract.md](./tenant_isolation_and_shared_worker_safety_contract.md)
6. [governance_control_plane_contract.md](./governance_control_plane_contract.md)
7. [perception_intelligence_plane_contract.md](./perception_intelligence_plane_contract.md) (Observe/Assess compatible file)
8. [ecosystem_extension_plane_contract.md](./ecosystem_extension_plane_contract.md)
9. [monetization_metering_plane_contract.md](./monetization_metering_plane_contract.md)
10. [enterprise_operations_plane_contract.md](./enterprise_operations_plane_contract.md)
11. [remote_coordination_and_disaster_recovery_contract.md](./remote_coordination_and_disaster_recovery_contract.md)

## 4. Finding Entry Point by Task

| Task | Recommended Entry |
|------|-------------------|
| Write task execution main chain | `task_and_workflow`, `executable_unit`, `result_envelope`, `lifecycle_and_termination`, `runtime_state_machine`, `state_transition_matrix`, `transition_service`, `runtime_execution`, `workflow_static_analysis_and_compensation`, `context_propagation`, `app_error`, `agent` |
| Write event system or recovery chain | `event_bus`, `typed_event_bus`, `event_reliability_matrix`, `event_registry_and_ops_threshold`, `runtime_execution`, `task_lease_and_fencing`, `storage_schema` |
| Write CLI/Web/Telegram streaming output | `gateway_message`, `gateway_streaming` |
| Write SQLite tables and repository layer | `storage_schema`, `runtime_repository_and_migration`, `file_lock`, `distributed_locking`, `production_storage_and_queue`, `artifact_store`, `artifact_unified_model`, `trace_and_root_cause_observability`, `debug_inspect_health_backpressure`, `diagnostics_snapshot_and_repro_bundle`, `audit_lineage_and_retention`, `testing_singleton_reset`, `vcr_and_fixture_testing`, `quality_engineering_and_chaos_testing` |
| Write approval, risk control, budget guard | `approval_and_hitl`, `sandbox_and_auth`, `cost_and_budget`, `policy_engine`, `enterprise_secret_management`, `prompt_model_policy_governance`, `supply_chain_and_dependency_security`, `slo_alerting_and_runbook`, `release_rollout_and_rollback`, `admin_console_and_human_takeover`, `hitl_experience_and_explainability`, `control_vs_intelligence_boundary` |
| Write provider/tool executor | `tool_and_provider_execution`, `tool_skill_plugin`, `tool_metadata_and_recovery`, `idempotency_and_recovery_matrix`, `edit_replacement_chain`, `tool_output_sanitization`, `workflow_io_compatibility_precheck`, `context_compaction_and_overflow`, `data_classification_and_prompt_handling` |
| Plan project directory, API, and Console/Cockpit boundaries | `project_structure`, `architecture_governance_and_versioning`, `api_surface`, `ui_console_and_cockpit` |
| Design configuration and environment governance | `configuration_layers_and_defaults`, `environment_and_configuration_governance` |
| Design future tenant/billing/observe | `billing_and_tenant`, `license_and_capability_boundary`, `perception`, `memory_decay_and_quality`, `tenant_and_organization`, `monetization_metering` |
| Design long-term platform evolution layer | `execution_plane`, `ha_coordinator_and_leader_election`, `data_plane`, `tenant_isolation_and_shared_worker_safety`, `governance_control_plane`, `enterprise_operations_plane`, `remote_coordination_and_disaster_recovery` |

## 5. Relationship with Other Documents

- Main documents `01` ~ `07` define system goals, structure, and boundaries.
- `contracts/` drill these boundaries down to fields, states, protocols, and failure semantics.
- `adr/` explains why the current contract's approach was adopted.
- `guides/` explains how to extend and implement according to contracts.
- `reviews/` only records whether contracts have been implemented or still have gaps.

## 6. Maintenance Rules

- Contracts only define specifications, do not record loop-level todos and completion percentages.
- If implementation is inconsistent with contract, record the gap in `reviews/`, do not mix temporary status notes into contracts.
- Once any field, state enum, event type, protocol semantics enter implementation, must remain authoritative here.
- If contract change represents architectural trade-off change, besides modifying contract, should supplement ADR.

## 7. What Should Not Be Here

The following should not continue to be written into `contracts/`:

- How much functionality is currently completed
- Current test pass rate
- How many tasks remain in current phase
- Current loop fix order
- Current architecture review conclusions

These contents are uniformly written to:

- [reviews/readiness_review.md](../reviews/readiness_review.md)
