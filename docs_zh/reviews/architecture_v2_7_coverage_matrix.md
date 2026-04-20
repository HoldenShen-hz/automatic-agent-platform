# Architecture v2.7 Coverage Matrix

> 范围：对照 `docs_zh/automatic_agent_patform_arthitecture_design.md` 的主章节，映射当前 authoritative ADR、contract、`src/`、`tests/` 覆盖面。
>
> 状态定义：
>
> - `exists`：已有稳定 ADR/contract/实现/测试闭环
> - `partial`：已有主要边界，但仍缺部分 contract、实现或测试
> - `missing`：缺 authoritative 设计与实现映射
> - `skeleton`：目录或入口已建，但主体能力仍以空壳/barrel/最小 mock 为主

| 节 | 主题 | ADR | Contract | Src / Tests | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 文档概述 | `001` | `architecture_governance_and_versioning_contract` | `docs_zh/`, `tests/unit/docs` | exists |
| 2 | 平台根假设与设计目标 | `001`, `005` | `architecture_governance_and_versioning_contract` | `src/platform`, `tests/unit/docs` | exists |
| 3 | 平台定义与非目标 | `001` | `project_structure_contract` | `src/`, `tests/unit/docs` | exists |
| 4 | 五平面 + 控制织网 | `001`, `020` | `execution_plane_contract`, `data_plane_contract`, `governance_control_plane_contract`, `enterprise_operations_plane_contract` | `src/platform/*`, `tests/integration/platform` | exists |
| 5 | 平面间通信契约 | `019`, `060` | `context_propagation_contract`, `result_envelope_contract`, `typed_event_bus_contract` | `src/platform/contracts`, `tests/integration/contract` | exists |
| 6 | API 契约与版本化 | `009` | `api_surface_contract` | `src/apps/api`, `src/platform/interface/api`, `tests/integration/api` | partial |
| 7 | 服务通信架构 | `013` | `event_bus_contract`, `event_reliability_matrix_contract` | `src/platform/state-evidence/events`, `tests/integration/events` | partial |
| 8 | 可扩展性架构 | `015`, `066` | `plugin_spi_contract`, `ecosystem_extension_plane_contract` | `src/plugins`, `src/domains/registry`, `tests/unit/plugins` | partial |
| 9 | 稳定性架构 | `009`, `075` | `slo_alerting_and_runbook_contract`, `startup_consistency_and_recovery_drill_contract` | `src/platform/shared/stability`, `tests/integration/stability` | exists |
| 10 | 风险控制架构 | `005`, `008` | `policy_engine_contract`, `cost_and_budget_contract` | `src/platform/control-plane/policy-center`, `tests/integration/approvals` | exists |
| 11 | 安全可靠架构 | `005` | `sandbox_and_auth_contract`, `enterprise_secret_management_contract`, `supply_chain_and_dependency_security_contract` | `src/platform/control-plane/iam`, `tests/integration/security` | exists |
| 12 | 异常事件处理架构 | `009` | `observability_contract`, `trace_and_root_cause_observability_contract`, `event_registry_and_ops_threshold_contract` | `src/platform/shared/observability`, `tests/integration/observability` | exists |
| 13 | OAPEFLIR 受控认知内核 | `016`, `060`, `072` | `oapeflir_loop_contract` | `src/platform/orchestration/oapeflir`, `tests/integration/platform/orchestration` | exists |
| 14 | Runtime Execution Plane | `001`, `075` | `runtime_execution_contract`, `runtime_state_machine_contract`, `supervisor_contract` | `src/platform/execution`, `tests/integration/platform/execution` | exists |
| 15 | LLM Provider 抽象与故障切换 | `006` | `tool_and_provider_execution_contract`, `prompt_model_policy_governance_contract` | `src/platform/model-gateway`, `tests/integration/platform/model-gateway` | exists |
| 16 | Prompt 管理与版本化 | `006` | `prompt_model_policy_governance_contract` | `src/platform/prompt-engine`, `tests/integration/platform/prompt-engine` | partial |
| 17 | 模型评估与质量门禁 | `072` | `quality_engineering_and_chaos_testing_contract`, `prompt_model_policy_governance_contract` | `src/domains/eval-framework`, `tests/integration/evaluation` | partial |
| 18 | 成本管理与 Token 计量 | `008` | `cost_and_budget_contract`, `token_budget_allocation_contract`, `monetization_metering_plane_contract` | `src/platform/model-gateway/cost-tracker`, `tests/integration/cost` | exists |
| 19 | Agent 间委托与协作 | `019` | `agent_contract`, `context_propagation_contract` | `src/platform/contracts/delegation-request`, `src/platform/execution/dispatcher`, `tests/unit/runtime` | exists |
| 20 | 长时任务与 Workflow 休眠 | `018` | `lifecycle_and_termination_contract`, `task_and_workflow_contract` | `src/platform/interface/scheduler`, `src/platform/state-evidence/checkpoints`, `tests/integration/workflow` | partial |
| 21 | 人机协作模式 | `016` | `approval_and_hitl_contract`, `hitl_experience_and_explainability_contract`, `admin_console_and_human_takeover_contract` | `src/platform/orchestration/hitl`, `tests/integration/approvals` | partial |
| 22 | SDK 与开发者体验 | `066` | `plugin_spi_contract`, `tool_skill_plugin_contract` | `src/sdk`, `tests/integration/sdk` | partial |
| 23 | 合规与数据治理 | `005` | `audit_lineage_and_retention_contract`, `data_classification_and_prompt_handling_contract`, `tenant_and_organization_contract` | `src/platform/compliance`, `tests/integration/compliance` | partial |
| 24 | 配置治理 | `009` | `configuration_layers_and_defaults_contract`, `environment_and_configuration_governance_contract` | `config/`, `src/platform/control-plane/config-center`, `tests/integration/config` | exists |
| 25 | 数据一致性模型 | `012`, `013` | `storage_schema_contract`, `runtime_repository_and_migration_contract`, `state_transition_matrix_contract` | `src/platform/state-evidence/truth`, `tests/integration/storage` | exists |
| 26 | 存储抽象 | `012` | `runtime_repository_and_migration_contract`, `production_storage_and_queue_contract` | `src/platform/state-evidence/truth`, `tests/integration/migration` | exists |
| 27 | 性能与 SLO | `009` | `slo_alerting_and_runbook_contract`, `quality_engineering_and_chaos_testing_contract` | `tests/performance`, `src/platform/shared/stability` | partial |
| 28 | 事件、Projection、DLQ | `013` | `event_bus_contract`, `event_reliability_matrix_contract`, `typed_event_bus_contract` | `src/platform/state-evidence/events`, `src/platform/state-evidence/dlq`, `tests/integration/events` | partial |
| 29 | Knowledge / Memory / Artifact / Learning | `017`, `020`, `078`, `079`, `080` | `knowledge_spi_contract`, `memory_decay_and_quality_contract`, `artifact_store_contract` | `src/platform/state-evidence/knowledge`, `src/platform/state-evidence/memory`, `tests/integration/memory` | partial |
| 30 | Business Pack / Plugin 治理 | `015`, `066` | `tool_skill_plugin_contract`, `plugin_spi_contract`, `license_and_capability_boundary_contract` | `src/plugins`, `src/sdk/pack-sdk`, `tests/unit/plugins` | partial |
| 31 | HA / 备份恢复 | `009`, `075` | `ha_coordinator_and_leader_election_contract`, `remote_coordination_and_disaster_recovery_contract` | `src/platform/execution/ha`, `tests/integration/reliability` | partial |
| 32 | 部署架构 | `009` | `environment_readiness_registry_contract`, `platform_promote_criteria_contract` | `src/platform/shared/stability`, `tests/integration/deployment` | partial |
| 33 | 路线图与 phase 规划 | `009` | `architecture_governance_and_versioning_contract` | `docs_zh/`, `tests/unit/docs` | partial |
| 36 | 风险、约束、成功标准 | `005`, `009` | `architecture_governance_and_versioning_contract`, `platform_promote_criteria_contract` | `docs_zh/`, `tests/unit/docs` | partial |
| 37 | DomainDescriptor 结构化领域建模 | `081` | `domain_descriptor_and_onboarding_contract` | `src/domains/registry`, `tests/unit/domains/registry` | partial |
| 38 | 四阶段接入 Runbook | `081` | `domain_descriptor_and_onboarding_contract` | `src/domains/*`, `tests/integration/domains` | partial |
| 39 | 自然语言任务入口 | `082` | `nl_entry_and_goal_decomposition_contract` | `src/interaction/nl-gateway`, `tests/unit/interaction/nl-gateway` | partial |
| 40 | 目标分解引擎 | `082` | `nl_entry_and_goal_decomposition_contract` | `src/interaction/goal-decomposer`, `tests/unit/interaction/goal-decomposer` | partial |
| 41 | 主动式 Agent | `083` | `proactive_agent_and_autonomy_contract` | `src/interaction/proactive-agent`, `tests/unit/interaction/proactive-agent` | partial |
| 42 | 渐进式自主权 | `083` | `proactive_agent_and_autonomy_contract` | `src/interaction/autonomy`, `tests/unit/interaction/autonomy` | partial |
| 43 | 统一运营看板 | `084` | `dashboard_and_operator_experience_contract` | `src/interaction/dashboard`, `tests/unit/interaction/dashboard` | partial |
| 44 | 非技术用户 UX | `084` | `dashboard_and_operator_experience_contract` | `src/interaction/ux`, `tests/unit/interaction` | skeleton |
| 46 | 组织层次模型 | `085` | `org_hierarchy_and_dynamic_approval_contract` | `src/org-governance/org-model`, `tests/unit/org-governance/org-model` | partial |
| 47 | 组织架构审批路由 | `085` | `org_hierarchy_and_dynamic_approval_contract` | `src/org-governance/approval-routing`, `tests/integration/approvals` | skeleton |
| 48 | 企业 SSO / SCIM 集成 | `085` | `sso_scim_and_identity_sync_contract` | `src/org-governance/sso-scim`, `tests/integration/org-governance` | skeleton |
| 49 | 分部门合规策略 | `085` | `org_hierarchy_and_dynamic_approval_contract`, `delegated_governance_contract` | `src/org-governance/compliance-engine`, `tests/integration/org-governance` | skeleton |
| 50 | 知识域隔离与受控共享 | `085` | `knowledge_boundary_and_federated_search_contract` | `src/org-governance/knowledge-boundary`, `tests/integration/org-governance` | skeleton |
| 51 | 分级治理委托 | `085` | `delegated_governance_contract` | `src/org-governance/delegated-governance`, `tests/integration/org-governance` | skeleton |
| 52 | 多 Region 部署 | `086` | `cross_region_routing_and_data_residency_contract` | `src/scale-ecosystem/multi-region`, `tests/integration/scale-ecosystem` | skeleton |
| 53 | 规模化资源竞争管理 | `086` | `quota_preemption_and_fair_scheduling_contract` | `src/scale-ecosystem/resource-manager`, `tests/integration/platform/execution` | skeleton |
| 54 | SLA 分级保障 | `086` | `sla_tier_contract` | `src/scale-ecosystem/sla-engine`, `tests/integration/scale-ecosystem` | skeleton |
| 55 | Agent 市场与生态 | `086` | `marketplace_catalog_and_revenue_contract` | `src/scale-ecosystem/marketplace`, `tests/unit/scale-ecosystem/marketplace` | partial |
| 56 | 反馈驱动持续改进 | `086` | `feedback_improvement_pipeline_contract` | `src/scale-ecosystem/feedback-loop`, `tests/unit/scale-ecosystem/feedback-loop` | partial |
| 57 | 外部系统集成框架 | `086` | `connector_framework_contract` | `src/scale-ecosystem/integration`, `tests/integration/scale-ecosystem` | skeleton |
| 59 | Agent 可解释性 | `087` | `explainability_and_stage_rationale_contract` | `src/ops-maturity/explainability`, `tests/integration/ops-maturity` | skeleton |
| 60 | 紧急制动与全局熔断 | `087` | `platform_panic_and_resume_contract` | `src/ops-maturity/emergency`, `tests/integration/ops` | skeleton |
| 61 | Agent 统一生命周期管理 | `087` | `agent_definition_lifecycle_contract` | `src/ops-maturity/agent-lifecycle`, `tests/integration/lifecycle` | skeleton |
| 62 | 离线与边缘部署 | `087` | `edge_runtime_and_sync_contract` | `src/ops-maturity/edge-runtime`, `tests/integration/ops-maturity` | skeleton |
| 63 | Agent 行为漂移检测 | `087` | `behavior_drift_detection_contract` | `src/ops-maturity/drift-detection`, `tests/integration/ops-maturity/drift-detection` | partial |
| 64 | 成本归因与优化 | `087` | `cost_attribution_and_optimization_contract` | `src/ops-maturity/cost-optimizer`, `tests/integration/cost` | skeleton |
| 65 | 工作流可视化调试器 | `087` | `workflow_debugger_contract` | `src/ops-maturity/workflow-debugger`, `tests/integration/platform/execution` | skeleton |
| 66 | 合规报告自动生成 | `087` | `compliance_report_generation_contract` | `src/ops-maturity/compliance-reporter`, `tests/integration/compliance` | skeleton |
| 67 | 容量规划与成本预测 | `087` | `capacity_planning_contract` | `src/ops-maturity/capacity-planner`, `tests/performance` | skeleton |
| 68 | 多模态能力架构 | `087` | `multimodal_gateway_contract` | `src/ops-maturity/multimodal`, `tests/integration/providers` | skeleton |
| 69 | 平台自运维 Agent | `087` | `platform_ops_agent_contract` | `src/ops-maturity/platform-ops-agent`, `tests/integration/ops` | skeleton |

## 优先补齐清单

### Authoritative 设计优先

1. `081`-`087` ADR 已补齐，用于收敛 `§37-§69` 的分组决策。
2. `domains / interaction / org-governance / scale-ecosystem / ops-maturity` 对应 contract 需先成为 authoritative，再推进实现。

### 实现优先级

1. `src/domains/*`
2. `src/interaction/*`
3. `src/org-governance/*`
4. `src/scale-ecosystem/*`
5. `src/ops-maturity/*`

### 测试优先级

1. schema / zod / state-machine unit tests
2. cross-plane integration tests
3. API / event / contract edge tests

