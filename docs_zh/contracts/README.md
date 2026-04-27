# Contracts

> `contracts/` 是平台 authoritative 规范层。
> 这里定义 canonical object、最小字段、状态机、协议边界和测试要求；当前覆盖分析统一记录在 `docs_zh/analysis/`，不写在 contract 正文里。

## 1. 使用顺序

当你要改以下内容时，先看本目录：

- schema / DTO / event payload
- 状态机、生命周期、审批与预算约束
- 存储模型、执行协议、跨平面边界
- domain / interaction / org-governance / scale-ecosystem / ops-maturity 新能力

推荐顺序：

1. 先看本 README 的分组索引
2. 再看对应 ADR
3. 最后进入具体 contract

## 2. v4.3 Contract Freeze Scope

v4.3 的实现入口以 [ADR-109](../adr/109-contract-freeze.md)、[ADR-110](../adr/110-runtime-state-machine-authority.md)、[ADR-111](../adr/111-platform-fact-vs-oapeflir-view-events.md)、[ADR-112](../adr/112-mvp-ring-implementation-boundary.md) 和下表 contract 为准。

| 冻结契约 | contract 入口 | 架构章节 |
| --- | --- | --- |
| `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` | [task-intake-request-contract.md](./task-intake-request-contract.md) | `§5` / `§6` / `§39` |
| `HarnessRun` | [harness-run-contract.md](./harness-run-contract.md) | `§5` / `§25` / `§45` |
| `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` | [plan-graph-patch-contract.md](./plan-graph-patch-contract.md) | `§5` / `§13` / `§45` |
| `GraphPatch` / `GraphPatchOperation` | [plan-graph-patch-contract.md](./plan-graph-patch-contract.md) | `§13` / `§58` |
| `NodeRun` / `NodeAttempt` / `AttemptLineage` | [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md) | `§14` / `§25` / `§45` |
| `NodeAttemptReceipt` | [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md) | `§14` / `§45` |
| `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord` | [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md) | `§14` / `§25` / `§58` |
| `BudgetLedger` / `BudgetReservation` / `BudgetSettlement` | [budget-ledger-contract.md](./budget-ledger-contract.md) | `§18` / `§25` / `§45` |
| `RunVersionLock` / `ArtifactVersionLockSet` | [version-lock-contract.md](./version-lock-contract.md) | `§24` / `§25` / `§26` |
| `DecisionInputBundle` / `HarnessDecision` | [decision-hitl-contract.md](./decision-hitl-contract.md) | `§17` / `§21` / `§58` |
| `HumanResponsibilityRecord` | [decision-hitl-contract.md](./decision-hitl-contract.md) | `§21` / `§47` / `§58` |
| `EventEnvelope` / `PlatformFactEvent` / `OapeflirViewEvent` | [event-envelope-contract.md](./event-envelope-contract.md) | `§28` / `§58` |

兼容规则：

- `ExecutionPlan` 只允许作为 `PlanGraphBundle` 的 deprecated alias 或迁移说明。
- `ExecutionReceipt` 只允许作为 `NodeAttemptReceipt` 的 deprecated alias。
- `ControlDirective` 必须拆分为运行控制语义与业务裁决语义；业务裁决以 `HarnessDecision` 为入口。
- `StateCommand` / `StateMutationCommand` 只允许作为 `RuntimeStateMachine.transition(command)` 的内部兼容 wrapper。
- `workflow_run`、`WorkflowStep`、`StepOutput`、旧 `task.*` / `workflow.*` 事件只允许作为 legacy/deprecated/projection/历史语境，不作为 v4.3 新实现入口。
- `oapeflir.view.*` 与 `oapeflir.rationale.*` 是投影视图事件；truth consumer 只消费 `platform.*`。

## 3. 架构章节到 contract 组映射

| 架构章节 | 主要 ADR | contract 组 |
| --- | --- | --- |
| `§1-§5` | `001`, `019`, `060`, `088` | 架构治理、平面边界、上下文与结果协议 |
| `§6-§8` | `009`, `013`, `015`, `066`, `088` | API、通信、扩展与插件治理 |
| `§9-§12` | `005`, `008`, `009`, `089`, `090` | 稳定性、风险、安全、可观测性 |
| `§13-§19` | `006`, `016`, `018`, `019`, `072`, `075`, `089`, `090` | OAPEFLIR、runtime、provider、prompt、eval、成本、委托 |
| `§20-§32` | `009`, `012`, `013`, `017`, `020`, `078`, `079`, `080`, `088`, `089`, `090` | workflow、HITL、SDK、治理、配置、数据、HA、部署 |
| `§37-§44` | `081`, `082`, `083`, `084` | domain / interaction 扩展层 |
| `§46-§51` | `085` | org-governance 扩展层 |
| `§52-§57` | `086` | scale-ecosystem 扩展层 |
| `§59-§69` | `087` | ops-maturity 扩展层 |

说明：

- 原始架构文档未定义 `§34`、`§35`、`§45`、`§58`、`§70`。
- 覆盖状态见 [../analysis/00-architecture-coverage-matrix.md](../analysis/00-architecture-coverage-matrix.md)。

## 4. 分组索引

### 4.0 v4.3 Contract Freeze

- [task-intake-request-contract.md](./task-intake-request-contract.md)
- [harness-run-contract.md](./harness-run-contract.md)
- [plan-graph-patch-contract.md](./plan-graph-patch-contract.md)
- [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md)
- [side-effect-reconciliation-contract.md](./side-effect-reconciliation-contract.md)
- [budget-ledger-contract.md](./budget-ledger-contract.md)
- [version-lock-contract.md](./version-lock-contract.md)
- [decision-hitl-contract.md](./decision-hitl-contract.md)
- [event-envelope-contract.md](./event-envelope-contract.md)

### 4.1 核心执行与运行时

- [task_and_workflow_contract.md](./task_and_workflow_contract.md)
- [executable_unit_contract.md](./executable_unit_contract.md)
- [result_envelope_contract.md](./result_envelope_contract.md)
- [lifecycle_and_termination_contract.md](./lifecycle_and_termination_contract.md)
- [runtime_state_machine_contract.md](./runtime_state_machine_contract.md)
- [state_transition_matrix_contract.md](./state_transition_matrix_contract.md)
- [transition_service_contract.md](./transition_service_contract.md)
- [runtime_execution_contract.md](./runtime_execution_contract.md)
- [workflow_static_analysis_and_compensation_contract.md](./workflow_static_analysis_and_compensation_contract.md)
- [task_lease_and_fencing_contract.md](./task_lease_and_fencing_contract.md)
- [execution_plane_contract.md](./execution_plane_contract.md)
- [supervisor_contract.md](./supervisor_contract.md)

### 4.2 上下文、错误与平面间协议

- [context_propagation_contract.md](./context_propagation_contract.md)
- [app_error_contract.md](./app_error_contract.md)
- [error_code_registry_contract.md](./error_code_registry_contract.md)
- [control_vs_intelligence_boundary_contract.md](./control_vs_intelligence_boundary_contract.md)
- [architecture_governance_and_versioning_contract.md](./architecture_governance_and_versioning_contract.md)
- [project_structure_contract.md](./project_structure_contract.md)

### 4.3 事件、网关与流式输出

- [event_bus_contract.md](./event_bus_contract.md)
- [typed_event_bus_contract.md](./typed_event_bus_contract.md)
- [event_reliability_matrix_contract.md](./event_reliability_matrix_contract.md)
- [event_registry_and_ops_threshold_contract.md](./event_registry_and_ops_threshold_contract.md)
- [gateway_message_contract.md](./gateway_message_contract.md)
- [gateway_streaming_contract.md](./gateway_streaming_contract.md)
- [message_parts_contract.md](./message_parts_contract.md)

### 4.4 Tool / Skill / Plugin / Provider

- [tool_skill_plugin_contract.md](./tool_skill_plugin_contract.md)
- [tool_and_provider_execution_contract.md](./tool_and_provider_execution_contract.md)
- [model_gateway_routing_contract.md](./model_gateway_routing_contract.md)
- [tool_metadata_and_recovery_contract.md](./tool_metadata_and_recovery_contract.md)
- [idempotency_and_recovery_matrix_contract.md](./idempotency_and_recovery_matrix_contract.md)
- [edit_replacement_chain_contract.md](./edit_replacement_chain_contract.md)
- [tool_output_sanitization_contract.md](./tool_output_sanitization_contract.md)
- [workflow_io_compatibility_precheck_contract.md](./workflow_io_compatibility_precheck_contract.md)
- [context_compaction_and_overflow_contract.md](./context_compaction_and_overflow_contract.md)
- [plugin_spi_contract.md](./plugin_spi_contract.md)
- [api_surface_contract.md](./api_surface_contract.md)

### 4.5 Prompt、质量、成本与 AI 治理

- [prompt_engine_spi_contract.md](./prompt_engine_spi_contract.md)
- [prompt_model_policy_governance_contract.md](./prompt_model_policy_governance_contract.md)
- [quality_engineering_and_chaos_testing_contract.md](./quality_engineering_and_chaos_testing_contract.md)
- [cost_and_budget_contract.md](./cost_and_budget_contract.md)
- [token_budget_allocation_contract.md](./token_budget_allocation_contract.md)
- [monetization_metering_plane_contract.md](./monetization_metering_plane_contract.md)
- [data_classification_and_prompt_handling_contract.md](./data_classification_and_prompt_handling_contract.md)
- [memory_decay_and_quality_contract.md](./memory_decay_and_quality_contract.md)

### 4.6 存储、Artifact、观测与恢复

- [cache_contract.md](./cache_contract.md)
- [storage_schema_contract.md](./storage_schema_contract.md)
- [runtime_repository_and_migration_contract.md](./runtime_repository_and_migration_contract.md)
- [file_lock_contract.md](./file_lock_contract.md)
- [distributed_locking_contract.md](./distributed_locking_contract.md)
- [production_storage_and_queue_contract.md](./production_storage_and_queue_contract.md)
- [artifact_store_contract.md](./artifact_store_contract.md)
- [artifact_unified_model_contract.md](./artifact_unified_model_contract.md)
- [observability_contract.md](./observability_contract.md)
- [trace_and_root_cause_observability_contract.md](./trace_and_root_cause_observability_contract.md)
- [debug_inspect_health_backpressure_contract.md](./debug_inspect_health_backpressure_contract.md)
- [diagnostics_snapshot_and_repro_bundle_contract.md](./diagnostics_snapshot_and_repro_bundle_contract.md)
- [startup_consistency_and_recovery_drill_contract.md](./startup_consistency_and_recovery_drill_contract.md)
- [remote_coordination_and_disaster_recovery_contract.md](./remote_coordination_and_disaster_recovery_contract.md)
- [ha_coordinator_and_leader_election_contract.md](./ha_coordinator_and_leader_election_contract.md)
- [audit_lineage_and_retention_contract.md](./audit_lineage_and_retention_contract.md)
- [testing_singleton_reset_contract.md](./testing_singleton_reset_contract.md)
- [vcr_and_fixture_testing_contract.md](./vcr_and_fixture_testing_contract.md)

### 4.7 安全、审批与企业治理

- [approval_and_hitl_contract.md](./approval_and_hitl_contract.md)
- [sandbox_and_auth_contract.md](./sandbox_and_auth_contract.md)
- [policy_engine_contract.md](./policy_engine_contract.md)
- [enterprise_secret_management_contract.md](./enterprise_secret_management_contract.md)
- [supply_chain_and_dependency_security_contract.md](./supply_chain_and_dependency_security_contract.md)
- [release_rollout_and_rollback_contract.md](./release_rollout_and_rollback_contract.md)
- [admin_console_and_human_takeover_contract.md](./admin_console_and_human_takeover_contract.md)
- [hitl_experience_and_explainability_contract.md](./hitl_experience_and_explainability_contract.md)
- [tenant_and_organization_contract.md](./tenant_and_organization_contract.md)
- [tenant_isolation_and_shared_worker_safety_contract.md](./tenant_isolation_and_shared_worker_safety_contract.md)
- [governance_control_plane_contract.md](./governance_control_plane_contract.md)
- [enterprise_operations_plane_contract.md](./enterprise_operations_plane_contract.md)

### 4.8 配置、环境与平台表面

- [sdk_surface_contract.md](./sdk_surface_contract.md)
- [configuration_layers_and_defaults_contract.md](./configuration_layers_and_defaults_contract.md)
- [environment_and_configuration_governance_contract.md](./environment_and_configuration_governance_contract.md)
- [environment_readiness_registry_contract.md](./environment_readiness_registry_contract.md)
- [platform_promote_criteria_contract.md](./platform_promote_criteria_contract.md)
- [ui_console_and_cockpit_contract.md](./ui_console_and_cockpit_contract.md)
- [billing_and_tenant_contract.md](./billing_and_tenant_contract.md)
- [license_and_capability_boundary_contract.md](./license_and_capability_boundary_contract.md)
- [naming_and_engineering_boundary_contract.md](./naming_and_engineering_boundary_contract.md)
- [perception_contract.md](./perception_contract.md)
- [perception_intelligence_plane_contract.md](./perception_intelligence_plane_contract.md)
- [data_plane_contract.md](./data_plane_contract.md)
- [ecosystem_extension_plane_contract.md](./ecosystem_extension_plane_contract.md)

### 4.9 组织与角色

- [agent_contract.md](./agent_contract.md)
- [division_definition_contract.md](./division_definition_contract.md)
- [billing_and_tenant_contract.md](./billing_and_tenant_contract.md)

### 4.10 v2.7 `domains / interaction`

- [domain_descriptor_and_onboarding_contract.md](./domain_descriptor_and_onboarding_contract.md)
- [nl_entry_and_goal_decomposition_contract.md](./nl_entry_and_goal_decomposition_contract.md)
- [proactive_agent_and_autonomy_contract.md](./proactive_agent_and_autonomy_contract.md)
- [dashboard_and_operator_experience_contract.md](./dashboard_and_operator_experience_contract.md)

### 4.11 v2.7 `org-governance`

- [org_hierarchy_and_dynamic_approval_contract.md](./org_hierarchy_and_dynamic_approval_contract.md)
- [sso_scim_and_identity_sync_contract.md](./sso_scim_and_identity_sync_contract.md)
- [knowledge_boundary_and_federated_search_contract.md](./knowledge_boundary_and_federated_search_contract.md)
- [delegated_governance_contract.md](./delegated_governance_contract.md)

### 4.12 v2.7 `scale-ecosystem`

- [cross_region_routing_and_data_residency_contract.md](./cross_region_routing_and_data_residency_contract.md)
- [quota_preemption_and_fair_scheduling_contract.md](./quota_preemption_and_fair_scheduling_contract.md)
- [sla_tier_contract.md](./sla_tier_contract.md)
- [marketplace_catalog_and_revenue_contract.md](./marketplace_catalog_and_revenue_contract.md)
- [feedback_improvement_pipeline_contract.md](./feedback_improvement_pipeline_contract.md)
- [connector_framework_contract.md](./connector_framework_contract.md)

### 4.13 v2.7 `ops-maturity`

- [explainability_and_stage_rationale_contract.md](./explainability_and_stage_rationale_contract.md)
- [platform_panic_and_resume_contract.md](./platform_panic_and_resume_contract.md)
- [agent_definition_lifecycle_contract.md](./agent_definition_lifecycle_contract.md)
- [edge_runtime_and_sync_contract.md](./edge_runtime_and_sync_contract.md)
- [behavior_drift_detection_contract.md](./behavior_drift_detection_contract.md)
- [cost_attribution_and_optimization_contract.md](./cost_attribution_and_optimization_contract.md)
- [workflow_debugger_contract.md](./workflow_debugger_contract.md)
- [compliance_report_generation_contract.md](./compliance_report_generation_contract.md)
- [capacity_planning_contract.md](./capacity_planning_contract.md)
- [multimodal_gateway_contract.md](./multimodal_gateway_contract.md)
- [platform_ops_agent_contract.md](./platform_ops_agent_contract.md)

## 5. 与 ADR / analysis 的关系

- `adr/` 解释为什么做这个 contract。
- `contracts/` 定义 authoritative 对象与约束。
- `analysis/` 记录 contract 是否已被实现、哪些地方仍然偏弱。

推荐入口：

- ADR 索引见 [../adr/README.md](../adr/README.md)
- 覆盖矩阵见 [../analysis/00-architecture-coverage-matrix.md](../analysis/00-architecture-coverage-matrix.md)

## 6. 维护规则

- contract 只写规范，不写当前完成度。
- 字段、状态枚举、事件名、协议语义一旦进入实现，必须在这里保持 authoritative。
- 如果 contract 变化代表架构取舍变化，除修改 contract 外，还要补 ADR。
- 若实现与 contract 暂时不一致，把差距记到 `analysis/`，不要把临时状态写进 contract。
