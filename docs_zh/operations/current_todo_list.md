# Current Todo List

> Last updated: 2026-04-18
> 本文件只保留当前还需要推进的事项。
> 完整已完成记录已归档到 [archive/current_todo_list_20260414.md](./archive/current_todo_list_20260414.md)。

## 1. 当前主线

| ID | 事项 | 状态 | 说明 |
| --- | --- | --- | --- |
| `P1A-EVID-72` | `Stable Core` 72h 长时稳定性证据采集 | `[doing]` | 已于 `2026-04-17` 启动 fresh wall-clock 采证；当前最高优先级，不能用补代码替代 |
| `DOC-OAPEFLIR-01` | phase1-4 对应 `contract / ADR / governance` 全量同步 | `[done]` | `§K` 对应的 contract / ADR / governance 收口已完成；不再作为活跃余项 |
| `DOC-OAPEFLIR-02` | phase1-4 对应 operations / active docs 全量对齐 | `[done]` | 活跃 facts 源、phase docs 与 roadmap 边界已完成收口 |
| `IND-P0-01` | PostgreSQL 真实环境联调 | `[done]` | `2026-04-17` 已在 fresh DB `agent_company_os_pgvector_readiness_v4` 上完成 `pgvector` extension + semantic roundtrip readiness，结果 `ready=true` |
| `IND-P0-09` | live registry publish / CI-CD 联调 | `[done]` | `2026-04-17` 真实远端 `Publish Docker Image` run `24544905061` 已成功完成，镜像已成功 build and push |
| `IND-P0-10` | 多环境真实部署联调 | `[blocked]` | `2026-04-17` 真实远端 `Deploy to Environment` run `24544905569` 已通过镜像等待校验，当前唯一阻塞为 GitHub environment secrets `AWS_DEPLOY_ROLE_ARN`、`AWS_REGION`、`EKS_CLUSTER_NAME` 缺失 |
| `M2-EXT-01` | Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry baseline 落地 | `[done]` | 四个子系统 baseline 与后续 semantic graph、graph-aware retrieval ranking、local vector recall、domain feedback consumer、forked/sandboxed plugin runtime、pgvector semantic infra 深化已实现；剩余仅为真实外部基础设施联调与生产证据 |

## 2. 当前判断

- 当前代码主线已完成，`npm run build`、`npm run typecheck`、全量 raw test 与 `coverage:gate` 已在 `2026-04-18` 最新一轮回归中通过。
- `reviews/reference_new_requierment.md` 与 `reviews/opeli_detailed_design.md` 当前 revision 对应的 phase1-4 核心代码闭环已完成，且已通过完整 `npm test` 验证。
- 以上两份设计文档中延伸到 `Phase 2 / Phase 3 / 深化篇 / 长期 rollout` 的仓库内实现项，也已纳入完成确认；详见 [../reviews/opeli_reference_completion_review.md](../reviews/opeli_reference_completion_review.md)。
- `opeli_detailed_design.md §K` 要求的 phase1-4 文档同步已完成；当前不再保留仓库内文档收口余项。
- `readiness_review.md` 已回写为 `documentation signoff = done`，不再保留文档签收尾项。
- `DOC-OAPEFLIR-01` 已完成，当前不再把 `contract / ADR / governance` 作为活跃尾项维护。
- `DOC-OAPEFLIR-02` 已完成，当前文档层不再是主线阻塞。
- `AuthoritativeTaskStore` 结构重构已完成：`methods-01~13`、`methods-01b` 与 `Object.assign` 运行时拼装已删除，当前剩余工作不再是该项结构拆分。
- 当前剩余工作已收敛为两类：`72h` 长时证据，以及生产部署环境的最后一层外部 secret/binding 联调。
- `2026-04-17` 已重新启动 fresh `72h` wall-clock campaign；当前 `data/stable-evidence/72h/stable-evidence-campaign-state.json` 已记录首个 10 分钟 segment 通过，仍需继续累计到完整 `72h`。
- `IND-P0-01` 已完成：fresh PostgreSQL 样本库 `agent_company_os_pgvector_readiness_v4` 已成功执行 `CREATE EXTENSION vector`，`knowledge-semantic-readiness` 返回 `ready=true`，并完成 pgvector semantic roundtrip。
- `IND-P0-09` 已完成：远端 `Publish Docker Image` workflow 已证明从 preflight、build 到 push 的真实链路可用；当前不再把 registry publish 视为活跃尾项。
- `IND-P0-10` 已从“镜像/等待竞态”进一步压缩到“真实部署环境 secret 缺失”：`Deploy to Environment` 已成功等待镜像可见，最终 fail-close 于 `deployment-preflight`。
- `Knowledge Plane / Artifact Plane / Plugin SPI / Domain Registry` 当前除 live infra 验证外，已把仓库内可落的深水位 target-state 一并补齐：包括 `sandboxed_process` 独立受限 plugin runtime、`containerized_process` launcher-based isolated runtime、`runtimeSandboxRoot` inventory 暴露、`SemanticVectorStore(local_hash|pgvector)` 抽象、async semantic retrieval、以及 PostgreSQL `knowledge_semantic_vectors` / pgvector migration；当前剩余不再是功能缺口，而是 PG/pgvector 与外部 launcher 的真实环境联调。
- semantic infra 本轮已补齐启动期 fail-close、snapshot restore 后的 vector index 回填、`GET /v1/knowledge/semantic/inspect` inventory 面，以及 `knowledge-semantic-readiness` PG/pgvector readiness CLI；`2026-04-17` 又进一步修正了 PostgreSQL ESM driver load、DSN 透传与 migration statement splitting，使 fresh PG readiness 能真实跑到 `pgvector extension is unavailable` 的外部阻塞点。
- 同日已导出一份新的 acceptance readiness 工件，路径位于 `data/artifacts/acceptance_readiness/`；该工件把 4 个活跃尾项的当前状态固化为 machine-readable / markdown 证据。
- baseline 之上，本轮已进一步补齐 config-backed bootstrap、Knowledge snapshot 持久化、Artifact publish ledger 与对应 API/OpenAPI 回归；因此该四个子系统当前剩余缺口进一步收缩到更深 target-state。
- 如果 `P1A-EVID-72` 过程中出现新故障，先修稳定性问题，再继续采证，不并行扩展新功能。

## 3. 当前阻塞

| 阻塞项 | 类型 | 处理方式 |
| --- | --- | --- |
| 生产部署环境 secret 未注册 | 外部依赖 | 在 GitHub environment 中补齐 `AWS_DEPLOY_ROLE_ARN`、`AWS_REGION`、`EKS_CLUSTER_NAME` 后，重新执行 `IND-P0-10` |
| `72h` 证据未完成 | 时间型阻塞 | 保持 wall-clock campaign 连续运行并保存证据包，直到完整 `72h` 收口 |

## 4. 最近完成

- `2026-04-17T00:43:44Z` fresh `72h` 长时证据已重新起跑，首个 segment 已通过；当前主线仍是继续累计剩余 wall-clock 时长。
- `2026-04-17` 已导出新的 acceptance readiness 工件，明确当前 4 个活跃尾项中 3 个为外部基础设施阻塞、1 个为长时证据持续采集。
- `2026-04-17` 已完成 `IND-P0-01`：fresh PostgreSQL 数据库 `agent_company_os_pgvector_readiness_v4` 已成功通过 `knowledge-semantic-readiness`，其中 `pgvector_extension_installed`、`semantic_ivfflat_index_present` 与 `semantic_roundtrip` 全部为 `ok=true`。
- `2026-04-17` 已完成 `IND-P0-09`：远端 `Publish Docker Image` run `24544905061` 成功完成，证明真实 registry publish / CI-CD 主链路可用。
- `2026-04-17` 已把 `IND-P0-10` 压缩到最终外部阻塞：远端 `Deploy to Environment` run `24544905569` 已通过镜像等待校验，随后在 `deployment-preflight` 明确失败于 GitHub environment secrets `AWS_DEPLOY_ROLE_ARN`、`AWS_REGION`、`EKS_CLUSTER_NAME` 缺失。
- `2026-04-17` 同时确认本地旧库 `agent_company_os` 仍存在 schema drift，不适合作为 fresh readiness 样本库；fresh PG readiness 现已转由 `agent_company_os_pgvector_readiness_v4` 固化。
- OPELI / new requirement / reference 闭环模块已完成最终验证；`2026-04-18` 最新回归已确认：
  - `npm run build`
  - `npm run typecheck`
  - `node --test --test-concurrency=12 "dist/tests/**/*.test.js"` → `10606 / 10600 / 0 / 6`
  - `npm run coverage:gate`
- 绝大多数阶段性实现工作包已关闭，活跃待办不再维护历史完成流水账。
- `reviews/reference_new_requierment.md` 与 `reviews/opeli_detailed_design.md` 中当前 revision 需要落到仓库的显式闭环模块已完成：
  - `agent-loop/` DTO、assessment、handoff、OAPEFLIR loop
  - `planning/` plan builder / evaluator / repository / replanning
  - `evaluation/` outcome evaluator / post-execution-quality-gate
  - `feedback/` collector / model
  - `learning/` learning object / pattern miner / distillation / strategy learning
  - `improvement/` candidate registry / strategy versioning / rollout / autonomy boundary
  - `observability/` task situation / agent state / report
  - `runtime/` execution deviation detector
  - `domain-registry/` baseline
  - `knowledge/` ingestion baseline
- phase1-4 已同步完成的文档层收口：
  - 部分 `contract`
  - 部分 `ADR`
  - 部分 `governance`
  - `archive` 标记与活跃主文档术语清理
  - 活跃 `operations / status` 文档的一轮术语与边界对齐
- 本轮新增完成的 OAPEFLIR 核心 contract 收口：
  - `observability_contract.md`
  - `approval_and_hitl_contract.md`
  - `policy_engine_contract.md`
  - `runtime_execution_contract.md`
  - `event_bus_contract.md`
  - `event_registry_and_ops_threshold_contract.md`
  - `typed_event_bus_contract.md`
  - `event_reliability_matrix_contract.md`
  - `token_budget_allocation_contract.md`
  - `lifecycle_and_termination_contract.md`
  - `supervisor_contract.md`
  - `debug_inspect_health_backpressure_contract.md`
  - `task_and_workflow_contract.md`
  - `runtime_state_machine_contract.md`
  - `execution_plane_contract.md`
  - `result_envelope_contract.md`
  - `workflow_io_compatibility_precheck_contract.md`
  - `tool_and_provider_execution_contract.md`
  - `tool_metadata_and_recovery_contract.md`
  - `api_surface_contract.md`
  - `diagnostics_snapshot_and_repro_bundle_contract.md`
  - `tool_output_sanitization_contract.md`
  - `workflow_static_analysis_and_compensation_contract.md`
  - `idempotency_and_recovery_matrix_contract.md`
  - `startup_consistency_and_recovery_drill_contract.md`
  - `trace_and_root_cause_observability_contract.md`
  - `slo_alerting_and_runbook_contract.md`
  - `data_plane_contract.md`
  - `division_definition_contract.md`
  - `configuration_layers_and_defaults_contract.md`
  - `audit_lineage_and_retention_contract.md`
  - `admin_console_and_human_takeover_contract.md`
  - `naming_and_engineering_boundary_contract.md`
  - `artifact_store_contract.md`
  - `artifact_unified_model_contract.md`
  - `production_storage_and_queue_contract.md`
  - `data_classification_and_prompt_handling_contract.md`
  - `platform_promote_criteria_contract.md`
  - `quality_engineering_and_chaos_testing_contract.md`
  - `cost_and_budget_contract.md`
  - `runtime_repository_and_migration_contract.md`
  - `hitl_experience_and_explainability_contract.md`
  - `context_propagation_contract.md`
  - `control_vs_intelligence_boundary_contract.md`
  - `agent_contract.md`
  - `executable_unit_contract.md`
  - `state_transition_matrix_contract.md`
  - `perception_contract.md`（Observe 兼容收口）
  - `perception_intelligence_plane_contract.md`（Observe/Assess 兼容收口）
  - `project_structure_contract.md`
  - `contracts/README.md`
- 本轮新增完成的 `§K` residual contract / ADR 收口：
  - `adr-unified-resource-model.md`
  - `tool_skill_plugin_contract.md`
  - `ecosystem_extension_plane_contract.md`
  - `memory_decay_and_quality_contract.md`
  - `storage_schema_contract.md`
- 本轮新增完成的 active docs 收口：
  - `operations/phases/README.md`
  - `operations/phases/phase-4-enterprise-ecosystem.md`
  - `operations/operations-roadmap.md`
  - `operations/project_progress_tracker.md`
  - `reviews/readiness_review.md`
  - `reviews/current_status_and_gap_analysis.md`
- 本轮新增完成的 M2 baseline 落地：
  - `KnowledgePlaneService` 接通 `knowledge` namespace / ingestion / retrieval 与 domain retriever plugin 聚合
  - `ArtifactPlaneService` 收口 bundle / governance / preview / publish
  - `PluginSpiRegistry` 补齐 manifest / lifecycle / activation / health 闭环
  - `DomainRegistryService` 接入 plugin registry，支持 binding 解析与 capability entry 构建
  - 新增相关 unit tests 与 targeted integration 回归
- 本轮新增完成的 M2 深化收口：
  - `config/domains|plugins|knowledge` 默认层已接入 `api-server` 启动路径，不再只依赖测试 seed
  - `src/plugins/{retrievers,presenters,adapters}/` 已落地 builtin plugin baseline，并通过 manifest bootstrap 注册
  - `KnowledgeSnapshotStore` 已为 Knowledge Plane 提供本地 snapshot 持久化与恢复
  - `ArtifactPublishLedger` 已为 Artifact Plane 提供 append-only publish ledger，并新增 `GET /v1/artifacts/publishes`
  - `SemanticKnowledgeGraph` 已接入 Knowledge Plane，并新增 `GET /v1/knowledge/graph`
  - `KnowledgeRetrievalService` 已接入 graph-aware rerank，返回 keyword/shared-keyword/same-document/trust/freshness 组合排序信号
  - `KnowledgeIngestionPipeline` 已为 chunk 生成本地 hash embedding，Knowledge query 已补齐 lightweight semantic vector recall
  - `KnowledgePlaneService` 已新增 `SemanticVectorStore(local_hash|pgvector)` 抽象、`queryAsync/ingestAsync` 路径与 pgvector backend
  - PostgreSQL migration 已新增 `knowledge_semantic_vectors` 与 pgvector bootstrap，并已补齐 `knowledge-semantic-readiness` readiness / roundtrip CLI；但真实 PG / pgvector extension 验证仍依赖外部环境
  - semantic infra 已补齐 startup fail-close、snapshot restore vector rehydrate 与 `GET /v1/knowledge/semantic/inspect`
  - `domain:* / plugin:* / knowledge:*` 事件已注册到 typed event bus，并由 registry / plugin / knowledge 主路径发布
  - `DomainEventFeedbackConsumer` 已把 `domain/plugin/knowledge` 事件桥接为 feedback snapshot，`TypedEventBus` tier-2 订阅消费链路已补齐
  - `PluginSpiRegistry` 已补齐 timeout、namespace sandbox、failure degrade/disable、error isolation 事件
  - `PluginSpiRegistry` 已补齐 activation dedupe、serial invocation isolation、queue overflow guard 与运行时 invocation telemetry
  - `PluginSpiRegistry` 已把 `runtimeIsolation(shared_process|serialized_in_process)`、`cooldownMs`、`cooldownUntil` 与 `plugin:invocation_started|plugin:invocation_completed` typed audit 事件纳入 registry / API 主路径
  - `PluginSpiRegistry` 已新增 builtin plugin 的 `forked_process` 运行模式，并通过 `runtimeProcessId` 暴露子进程实例状态
  - `PluginSpiRegistry` 已进一步新增 `sandboxed_process` 运行模式，使用 dedicated sandbox root、env whitelist 与 Node permission model，并通过 `runtimeSandboxRoot` 暴露隔离根目录
  - `PluginSpiRegistry` 已新增 `containerized_process` launcher-based runtime host，支持通过外部 container / sandbox launcher 承载 child runtime，并沿用 runtime inventory / unload 回收闭环
  - `PluginSpiRegistry` 已补齐 `retriever / presenter / adapter` capability-specific invoke path，并把 network policy 校验纳入 adapter runtime path
  - 当前 plugin runtime 已从进程内隔离推进到 `forked_process` / `sandboxed_process` / `containerized_process` 三档 isolated runtime host；它仍不等于完整 container / microVM 编排，但仓库内运行时接缝已具备
  - OpenAPI / golden / integration 回归已同步更新并通过
- 本轮文档校验已通过：
  - `node --test dist/tests/unit/config/documentation-links.test.js dist/tests/unit/docs/documentation-health.test.js`
- 详细完成记录保留在 [archive/current_todo_list_20260414.md](./archive/current_todo_list_20260414.md)。

## 5. 文档边界

- 总体进度看 [project_progress_tracker.md](./project_progress_tracker.md)。
- 阶段范围与顺序看 [implementation_plan.md](./implementation_plan.md) 和 [operations-roadmap.md](./operations-roadmap.md)。
- 模块级缺口看 [module_remediation_backlog.md](./module_remediation_backlog.md)。
- 当前状态综述看 [../reviews/current_status_and_gap_analysis.md](../reviews/current_status_and_gap_analysis.md)。
- OAPEFLIR 设计输入与 phase 裁剪边界看 [../reviews/opeli_detailed_design.md](../reviews/opeli_detailed_design.md)。
