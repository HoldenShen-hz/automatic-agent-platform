## 2026-04-28 复核结论

以下状态矩阵覆盖本文件原始发现的当前实况；原始分项清单保留在后文作为历史发现快照。判定依据只采信实际源码、配置与 contract/ADR/spec 文本，不再使用 closure test、closure script 或 supersede 占位说明。

| 主题 | 当前状态 | 根因 | 当前证据 |
| --- | --- | --- | --- |
| S1 OAPEFLIR 身份危机 | 已修复 | OAPEFLIR spec 与多份 ADR/contract 曾把认知投影视图和 runtime truth 混写，根因是 v4.3 迁移时只修了局部 contract，没有把引用链一起收口。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已改为 `Reference Draft`；`docs_zh/adr/070-conclusion.md`、`072-oapeflir-testing-strategy.md`、`066-plugin-spi-framework.md` 与 `docs_zh/contracts/workflow_debugger_contract.md`、`plugin_spi_contract.md` 已明确 OAPEFLIR 只消费/产出 projection，不拥有执行权。 |
| S2 废弃术语迁移未执行 | 已修复 | v3 execution-centric 文档长期被后续 contract/ADR 直接复用，根因是旧 workflow/execution 对象被当成“先兼容后治理”的临时桥接层，却没有再降级为 compatibility alias。 | 代码侧 legacy contract 工厂已 fail-fast；`src/platform/control-plane/approval-center/*`、`src/platform/contracts/types/domain/billing-types.ts`、`src/domains/registry/plugin-spi.ts` 已补 canonical `HarnessRun / NodeRun / NodeAttempt` 键；`docs_zh/contracts/api_surface_contract.md`、`artifact_unified_model_contract.md`、`gateway_*`、`policy_engine_contract.md`、`node-run-attempt-receipt-contract.md` 及相关 ADR 已把旧键明确降级为 legacy alias。 |
| S3 RuntimeStateMachine 被绕过 | 已修复 | Harness / delegation / replay 路径各自维护局部状态，历史上直接 spread/赋值 status。 | `src/platform/orchestration/harness/index.ts`、`src/platform/orchestration/agent-delegation/delegation-manager.service.ts`、`src/platform/execution/ha/replay-worker.ts` 已统一到状态机/守卫语义。 |
| S4 Sandbox 含 `none` 档位 | 已修复 | 业务包、插件 SDK 与 delegation 类型各自扩展 sandbox 名称，未收敛到 canonical 4 档。 | `src/platform/control-plane/iam/sandbox-policy.ts` 与业务包 / plugin / delegation 类型已统一为 canonical sandbox tier。 |
| S5 Budget 保护缺失 | 已修复 | 预算控制原先是事后记账或布尔检查，没有在 LLM / usage writeback 前做 reservation。 | `src/platform/model-gateway/cost-tracker/budget-guard.ts`、`src/interaction/goal-decomposer/*`、`src/scale-ecosystem/billing/*` 已引入 reservation + settlement。 |
| S6 Trust Score 绕过安全边界 | 已修复 | 自治提升策略只看成功率和量，没有把域风险规格与固有风险上限接入决策。 | `src/interaction/autonomy/index.ts`、`trust-scorer`、`promotion-engine`、`proactive-agent/trigger-engine` 已接入风险封顶与 default deny。 |
| S7 域风险规格缺失 | 已修复 | 高风险域 onboarding 先有 baseline，后补治理约束，导致 `DomainRiskSpec` 迟迟未补全。 | `src/domains/domain-specs.ts` 已补齐约束；高风险域 baseline 与 `config/domains/quant-trading.json`、`config/domains/healthcare.json` 已补风险配置。 |
| S8 存储 Schema 基于废弃对象 | 已修复 | 旧 `tasks / workflow / executions` DDL 长期被当成主链 schema，而 runtime truth 表族后来补进但未同步审计。 | `docs_zh/contracts/storage_schema_contract.md` 已以 `harness_runs / node_runs / node_attempts / budget_*` 为 authoritative schema，并保留旧表为 projection/compatibility。 |
| S9 Phase 1-9 仍作为 canonical 分期 | 已修复 | 对外 runtime catalog/startup summary 直接暴露历史 9a-9f 批次，未把它们降级为 bootstrap input。 | `src/domains-runtime-catalog.ts`、`src/domains-startup-plan.ts`、`src/index.ts` 已改为 `ring1 / ring2 / ring3`；`config/domains/quant-trading.json`、`config/domains/healthcare.json` 已改为 `ringId`。 |
| S10 Saga 语义缺失 | 已修复 | saga 实现只返回状态标签，没有补偿路径、失败点与补偿资源记录。 | `src/org-governance/org-model/org-governance-saga.ts`、`chinese-wall-access-saga.ts`、`governance-delegation-revocation-saga.ts` 已补 prepare/commit/compensation 语义与执行日志。 |

## 复核方法

- 只以实际文件内容为依据。
- contract/ADR/spec 若仍引用旧术语，但已显式降级为 `legacy / projection / migration input`，不再计为 canonical 冲突。
- 历史发现中若已被源码或文档实改消除，后文原始条目不再代表当前未修复状态。

## 系统性问题总结

| #   | 系统性主题                                                                                            | 严重度   | 影响范围                                 |
| --- | ----------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| S1  | OAPEFLIR 身份危机：v4.4 Spec 自定义全套 Runtime 对象与状态机，与主架构"仅投影"定位根本冲突            | CRITICAL | spec + 10+ ADR + 5+ contract             |
| S2  | v3→v4 术语迁移未执行：ExecutionPlan/ControlDirective/stepId/executionId/workflow_run 仍作为 canonical | CRITICAL | ~60% contract + ~40% ADR + ~30% code     |
| S3  | RuntimeStateMachine 被绕过：Harness/Delegation/Recovery 直接修改 status                               | HIGH     | 核心运行时代码                           |
| S4  | Sandbox 含 "none" 档位：架构只允许4档，代码含5档(含none)                                              | HIGH     | 3+ 模块                                  |
| S5  | Budget 保护缺失：多处 LLM/执行调用无 BudgetReservation 前置                                           | HIGH     | billing + goal-decomposer + budget-guard |
| S6  | Trust Score 可绕过安全边界：直接映射 full_auto 无 inherent risk 检查                                  | CRITICAL | autonomy + promotion-engine              |
| S7  | 域风险规格缺失：高危域(量化/金融/医疗/法务)无 DomainRiskSpec                                          | HIGH     | 4+ 域                                    |
| S8  | 存储 Schema 基于废弃对象：DDL 以 executions 表为核心，无 canonical truth 表                           | CRITICAL | storage_schema_contract                  |
| S9  | Phase 1-9 仍作为 canonical 分期：Ring 1/2/3 未落地                                                    | HIGH     | config + ADR + code                      |
| S10 | Saga 语义缺失：org-governance saga 无实际 compensate/rollback                                         | HIGH     | org-governance                           |

---

## 1. 代码 vs 架构

### 1.1 CRITICAL — RuntimeStateMachine 被绕过

| 位置                                                                                            | 问题                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/platform/orchestration/harness/index.ts:627-696`                                           | `runLoop()` 直接用 spread 修改 status (`status: "running"/"aborted"/"completed"/"waiting_hitl"`)，完全绕过 RuntimeStateMachine.transition() |
| `src/platform/orchestration/agent-delegation/delegation-manager.service.ts:180,195,246,251,343` | 直接赋值 `delegation.status = "cancelled"` 等，绕过状态机                                                                                   |
| `src/platform/execution/ha/replay-worker.ts:39-77`                                              | ReplayWorker 无 ReplaySandboxPolicy 守卫，违反 INV-REPLAY-001（replay 不得产生真实副作用）                                                  |

### 1.2 CRITICAL — 废弃合约作为一等公民导出

| 位置                                                        | 问题                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/platform/contracts/execution-plan/index.ts`            | 定义 `ExecutionPlan` + 线性 `steps: ExecutionPlanStep[]` 作为活跃合约（架构要求 deprecated only）                        |
| `src/platform/contracts/control-directive/index.ts`         | 定义 `ControlDirective` + `createControlDirective()` 工厂（架构 v4.3 废弃，须用 OperationalDirective/DecisionDirective） |
| `src/platform/contracts/execution-receipt/index.ts`         | 定义 `ExecutionReceipt` + `stepId` 字段（架构要求 NodeAttemptReceipt + nodeRunId/attemptId）                             |
| `src/platform/contracts/types/platform-contracts.ts:70-205` | 完整定义 ExecutionPlan/ControlDirective/ExecutionReceipt 接口 + createExecutionPlan() 工厂                               |
| `src/platform/contracts/types/platform-contracts.ts:55-62`  | SideEffectRecord 仅4状态(proposed/committed/rolled_back/failed)，缺 ambiguous/reconciling/confirming                     |

### 1.3 HIGH — Budget 保护缺失

| 位置                                                            | 问题                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/platform/model-gateway/cost-tracker/budget-guard.ts:51-77` | BudgetGuard 是事后检查，非执行前原子 BudgetReservation，违反 INV-BUDGET-001 |
| `src/interaction/goal-decomposer/index.ts:248-349`              | 调用 LLM 生成计划时无 budget reservation                                    |
| `src/interaction/goal-decomposer/llm-plan-generator.ts:39-46`   | LLM complete() 调用无预算守卫                                               |
| `src/scale-ecosystem/billing/billing-service.ts:260-277`        | recordUsage 事后记账，无 BudgetReservation 前置                             |

### 1.4 CRITICAL — Trust Score 绕过安全边界

| 位置                                                          | 问题                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/interaction/autonomy/trust-scorer/index.ts:25-39`        | `mapTrustLevelToAutonomyLevel` 将 fully_trusted 直接映射 full_auto，无 inherent risk/compliance/sandbox 检查 |
| `src/interaction/autonomy/index.ts:240-248`                   | `decideLevel()` 仅按成功率/量提升 full_auto，不查询固有风险                                                  |
| `src/interaction/autonomy/promotion-engine/index.ts:30-31`    | 500次/99%成功即提升 full_auto，high/critical 域可被自动提升越过安全边界                                      |
| `src/interaction/autonomy/index.ts:252-261`                   | `applyDomainRiskAutonomyCap` 只用硬编码列表限 high→semi_auto，不查 DomainRiskSpec，critical 域无 cap         |
| `src/interaction/proactive-agent/trigger-engine/index.ts:1-9` | high-risk action 在 requireConfirmation=false 时返回 auto_execute（架构要求 default deny）                   |

### 1.5 HIGH — Sandbox "none" 档位

| 位置                                                                 | 问题                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/domains/business-pack/business-pack-manifest.ts:73,236`         | SandboxTier 含 "none"（Zod schema 也含）；架构只定义4档无 none      |
| `src/sdk/plugin-sdk/plugin-definition.ts:26`                         | sandboxTier 含 "none"                                               |
| `src/sdk/plugin-sdk/plugin-context.ts:15`                            | sandboxTier 含 "none"                                               |
| `src/platform/orchestration/agent-delegation/delegation-types.ts:19` | sandboxTier 含 "none"/"process"/"container"（非 canonical 4档命名） |

### 1.6 HIGH — 域风险规格缺失

| 位置                                | 问题                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domains/domain-specs.ts:55-61` | DomainRiskSpecSchema 缺 advisory_only/human_accountable/deterministic_hot_path_only |
| `src/domains/quant-trading/`        | 无 DomainRiskSpec 声明（high-risk 金融域）                                          |
| `src/domains/financial-services/`   | 无 DomainRiskSpec 声明                                                              |
| `src/domains/healthcare/`           | 无 DomainRiskSpec 声明（arch 明确要求 advisory_only）                               |
| `src/domains/legal/`                | 无 DomainRiskSpec 声明                                                              |

### 1.7 HIGH — Saga 无实际补偿

| 位置                                                                                     | 问题                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/org-governance/org-model/org-governance-saga.ts:17-39`                              | execute() 只分类步骤，无 prepare→commit→compensate 编排；失败无回滚 |
| `src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts:14-23`                | execute() 返回 rolled_back 但不执行实际补偿/撤销                    |
| `src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:17-31` | 无四阶段(prepare/commit/compensate/audit)语义                       |

### 1.8 MED — 废弃术语在非 legacy 代码中使用

| 位置                                                                                     | 术语问题                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/platform/state-evidence/events/event-registry.ts:73-109`                            | producer = "workflow_runtime"（应为 HarnessRuntime）      |
| `src/platform/state-evidence/events/projections/workflow-timeline-projection.ts:282-398` | 消费 workflow_run.created/failed/completed 事件作为 truth |
| `src/platform/control-plane/approval-center/approval-flow-engine.ts:114`                 | workflowRunId 在审批记录中                                |
| `src/platform/contracts/types/domain/billing-types.ts:124`                               | UsageEventRecord 用 stepId 做成本归因                     |
| `src/platform/execution/plugin-executor/sub-workflow-executor.ts:20-36`                  | 定义 WorkflowStep/stepId，线性步骤执行                    |
| `src/ops-maturity/edge-runtime/edge-orchestrator/index.ts`                               | 定义 EdgeExecutionPlan（应为 PlanGraphBundle）            |
| `src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts:45`                          | 定义 EdgeExecutionReceipt（应为 NodeAttemptReceipt）      |
| `src/ops-maturity/platform-ops-agent/platform-ops-agent-service.ts:52`                   | 定义 OpsExecutionReceipt                                  |
| `src/ops-maturity/workflow-debugger/` (全模块)                                           | 基于 stepId/workflow_id 构建，无 NodeRun/HarnessRun 概念  |
| `src/scale-ecosystem/billing/types.ts:61`                                                | RecordUsageInput 有 stepId 字段                           |
| `src/domains/registry/plugin-spi.ts:8`                                                   | MachineOutput.stepId                                      |
| `src/domains/business-pack/pack-migration-service.ts:24,51,90`                           | Migration plan 全程用 stepId                              |

### 1.9 MED — HarnessRun 接口重复定义且不一致

| 位置                                                  | 问题                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/platform/orchestration/harness/index.ts:168-198` | 本地 HarnessRun 用 runId（非 harnessRunId），含 sleeping/waiting_hitl/recovering 等非 canonical 状态 |
| `src/platform/orchestration/harness/index.ts:160-166` | 本地 HarnessDecision 缺 decisionInputBundleId/deciderType/deciderRef/reasonCode                      |

### 1.10 MED — 其他

| 位置                                                                        | 问题                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/org-governance/knowledge-boundary/knowledge-boundary-service.ts:48-66` | evaluateAccess 无 tenantId 参数（架构要求租户级隔离）                       |
| `src/org-governance/knowledge-boundary/knowledge-federator.ts:36-82`        | 联邦搜索无租户隔离，仅按 orgNodeId 过滤                                     |
| `src/interaction/goal-decomposer/index.ts:248-349`                          | 产出 TaskGraphDraft 但不经 HarnessRuntime 路由                              |
| `src/platform/orchestration/harness/index.ts` (runLoop)                     | HarnessRun 接口无 planGraphBundle 字段，runLoop 不生成/校验 PlanGraphBundle |

---

## 2. Contract 文档 vs 架构

### 2.1 CRITICAL — 存储 Schema 基于废弃对象

| Contract                             | 问题                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage_schema_contract.md:§15 DDL` | DDL 以 `executions` 表为核心 PK，7张表 FK 到 execution_id；无 harness_runs/plan_graph_bundles/node_runs/node_attempts/budget_ledgers canonical truth 表 DDL |
| `storage_schema_contract.md:§6`      | workflow_step_outputs 用 step_id TEXT NOT NULL + UNIQUE(task_id, step_id)                                                                                   |
| `storage_schema_contract.md:§5`      | workflow_state 用 current_step_index INTEGER + resumable_from_step TEXT（线性模型）                                                                         |
| `storage_schema_contract.md:§11`     | events 表用 execution_id FK，无 harness_run_id/node_run_id 列                                                                                               |
| `storage_schema_contract.md:§15`     | node_attempt_receipts PK 用 node_attempt_receipt_id（T-46 已废弃，应为 receiptId）                                                                          |
| `storage_schema_contract.md:§15`     | event_consumer_acks DDL 遗漏 §11 要求的 attempt_count 列                                                                                                    |

### 2.2 CRITICAL — runtime_state_machine_contract 以废弃对象为权威

| Contract                                | 问题                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `runtime_state_machine_contract.md:§6`  | ExecutionStatus 对齐 executions.status，将废弃实体当权威                       |
| `runtime_state_machine_contract.md:§3`  | WorkflowStatus 独立状态机，未标记为 projection-only                            |
| `runtime_state_machine_contract.md:§1`  | 用 "Phase 1a" 限定 scope（应为 Ring 1）                                        |
| `runtime_state_machine_contract.md:§1A` | OAPEFLIR 8-stage state machine 作为 truth-grade 状态机（应为 projection-only） |

### 2.3 HIGH — 事件命名空间错误

| Contract                                          | 问题                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `event_bus_contract.md:§6`                        | task.status_changed/workflow.started/workflow.step_completed/workflow.failed 作为 Phase 1a 稳定事件（应为 platform.\* 命名空间） |
| `event_registry_and_ops_threshold_contract.md:§4` | task._/workflow._/execution.\* 注册为 Tier 1 truth 事件                                                                          |
| `event_reliability_matrix_contract.md:§3`         | 同上                                                                                                                             |
| `event_bus_contract.md:§6`                        | oapeflir.observe._/oapeflir.assess._/oapeflir.plan._ 未用 oapeflir.view._ 前缀                                                   |

### 2.4 HIGH — 使用废弃 ID 作为 canonical key

| Contract                                             | 问题                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `api_surface_contract.md:§3`                         | GET /executions/:executionId/inspect 用废弃 executionId；无 /harness-runs/ 端点 |
| `artifact_unified_model_contract.md:§3.1`            | ArtifactRecord 用 executionId/planId（应为 harnessRunId/planGraphId）           |
| `file_lock_contract.md:§3.1-3.2`                     | FileLockRequest/Record 用 execution_id/holder_execution_id                      |
| `debug_inspect_health_backpressure_contract.md:§3.2` | TaskInspectView 用 workflow_state + executions[]                                |
| `artifact_store_contract.md:§3`                      | ArtifactRecord 仅 task_id，缺 harness_run_id/node_run_id                        |
| `audit_lineage_and_retention_contract.md:§5`         | 用 execution_id，缺 harness_run_id/node_run_id                                  |
| `cost_and_budget_contract.md:§4`                     | CostEvent 用 task_id 为主键，harness_run_id/node_run_id 为 optional             |
| `gateway_message_contract.md:§5`                     | DecisionRequest 用 task_id                                                      |
| `gateway_streaming_contract.md:§3`                   | StreamEvent 用 task_id                                                          |
| `policy_engine_contract.md:§3.1`                     | PolicyDecisionRequest 用 execution_id                                           |
| `runtime_execution_contract.md:§3`                   | ExecutionEnvelope 含 workflow_id                                                |
| `explainability_and_stage_rationale_contract.md:§3`  | StageRationale 用 task_id 为主键                                                |

### 2.5 HIGH — 关键 Contract 缺失 canonical 字段

| Contract                                  | 问题                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `node-run-attempt-receipt-contract.md:§4` | NodeAttemptReceipt 缺 harnessRunId/planGraphBundleId/graphVersion/duration（架构§5.3 明确要求） |
| `event_bus_contract.md:§3`                | EventEnvelope 缺 schema_version/idempotency_key/causation_id/partition_key/ttl/payloadHash      |
| `plugin_spi_contract.md:§2.4`             | DomainPresenterPlugin.present() 接收废弃 DualChannelStepOutput 而非 NodeAttemptReceipt          |

### 2.6 HIGH — workflow_debugger_contract 完全基于废弃模型

| Contract                               | 问题                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `workflow_debugger_contract.md` (全文) | 用 workflow_id/step_selector 作为 breakpoint 锚点；无 HarnessRun/NodeRun/PlanGraph 引用；无 v4.3 remediation |

### 2.7 MED — 其他 Contract 问题

| Contract                                              | 问题                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `admin_console_and_human_takeover_contract.md:§4`     | Human takeover 用 step 语义，不要求 RuntimeStateMachine.transition()，无 budget reservation |
| `agent_definition_lifecycle_contract.md:§3`           | lifecycle_state 迁移无 RuntimeStateMachine enforcement                                      |
| `division_definition_contract.md:§2`                  | default_workflow/orchestration_workflow 作为 canonical reference                            |
| `sla_tier_contract.md`                                | 无 HarnessRun/NodeRun 集成点，无 v4.3 remediation                                           |
| `knowledge_boundary_and_federated_search_contract.md` | FederatedSearchRequest 缺 harnessRunId/nodeRunId 审计链                                     |
| `execution_plane_contract.md:§17`                     | 引用不存在的 governance_control_plane_contract.md                                           |

---

## 3. ADR vs 架构

### 3.1 HIGH — ADR 定义与架构冲突的 canonical 对象

| ADR                               | 问题                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `060-explicit-planning-hub.md`    | 定义 Plan DTO + PlanStep[] 线性步骤 + RuntimeExecuteBridge.executePlan()；与 PlanGraphBundle 根本冲突 |
| `060:R3 constraints`              | "Execute 层只能接收 Plan DTO"——架构要求 P4 只接收 PlanGraphBundle                                     |
| `065-workflow-visual-debugger.md` | 全文用 workflow_id/current_step/WorkflowDAGView/StepInspector（废弃对象）                             |
| `070-conclusion.md:演进路线`      | 用 Phase 1-7 路线图（架构明确废弃为历史映射）                                                         |
| `070-conclusion.md:关键不变量`    | "OAPEFLIR 循环不变"作为 key invariant（应为 HarnessRuntime + RuntimeStateMachine）                    |

### 3.2 HIGH — Phase 分期未迁移至 Ring

| ADR                                     | 问题                               |
| --------------------------------------- | ---------------------------------- |
| `033-phased-roadmap.md`                 | 定义 Phase 1-7 为 canonical 路线图 |
| `003-memory-seven-layers.md`            | MVP 用 Phase 1/2/3/4               |
| `011-effect-ts-adoption.md`             | Phase 1a/1b                        |
| `012-sqlite-phase-1-2-primary-store.md` | Phase 1/2                          |
| `013-eventemitter-phase-2-boundary.md`  | Phase 2                            |
| `075-controlled-rollout-release.md`     | "Phase 1 简化版"                   |
| `080-learn-hub-pattern-detection.md`    | "Phase 1 仅支持这 3 类"            |
| `096-harness-recovery-controller.md`    | "phase 8b 门禁"                    |

### 3.3 MED — OAPEFLIR 被当作 Runtime

| ADR                                        | 问题                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `072-oapeflir-testing-strategy.md:E2E`     | 把 OAPEFLIR 当可执行 8 阶段链测试"无阶段被跳过"                       |
| `072:Test 3`                               | "新 Plan 从失败步骤后继续"用废弃 step 术语                            |
| `066-plugin-spi-framework.md:OAPEFLIR关联` | 描述 OAPEFLIR 为"正式扩展机制"（应为 projection）                     |
| 10+ ADR boilerplate                        | OAPEFLIR Execute 描述为"步骤执行与 Dual-Channel 输出"（应为认知投影） |

### 3.4 MED — 废弃术语作为 canonical

| ADR                                               | 问题                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `019-agent-handoff-four-layer-protocol.md`        | buildFromStepResult(result: StepResult) 用废弃 StepResult/stepId |
| `022-api-contract-and-versioning.md`              | /api/v1/workflow-runs 作为 canonical 端点                        |
| `028-incident-and-event-handling-architecture.md` | Span "service → operation → step"（应为 nodeRun/nodeAttempt）    |
| `079-feedback-hub-signals.md`                     | FeedbackSignal 用 executionId 替代 harnessRunId/nodeRunId        |
| `080-learn-hub-pattern-detection.md`              | EvidenceRef 用 executionId/signalId                              |
| `094-harness-durable-execution.md:OAPEFLIR关联`   | "Execute: 落盘 run、step、decision"用 step 作为 truth 单元       |
| `095-harness-context-assembly.md:OAPEFLIR关联`    | "Execute: 为 Harness step 提供上下文输入"                        |

### 3.5 LOW — SLA 前置条件缺失

| ADR                                     | 问题                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `054-sla-tiered-guarantees.md:platinum` | 提供 99.99% SLA 但未声明自动 failover/quorum/演练证据前置条件 |

---

## 4. OAPEFLIR v4.4 Spec vs 主架构

### 4.1 CRITICAL — Spec 自定义全套 Runtime 对象

| 章节                | 问题                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| §3 "总体运行架构"   | OAPEFLIR 作为与 HarnessRuntime 平行的 Runtime Overlay，含 "Node Execution Runtime"            |
| §5 "NodeRun 状态机" | 定义完整 NodeRunStatus enum + transition rules（应属 RuntimeStateMachine 独有）               |
| §5.4 rule 4         | 声称 "由 OAPEFLIR 拥有的节点状态"（OAPEFLIR 不拥有任何 truth 状态）                           |
| §7 "PlanGraph 契约" | 定义 PlanGraphBundle/PlanGraph/PlanNode/PlanEdge 全套 schema（应属 P3→P4 canonical contract） |
| §2.1 Execute stage  | 声称产出 NodeRun / NodeAttemptReceipt（这些是 P4 执行对象，不是 OAPEFLIR 输出）               |
| §0 "核心结论"       | 声称 OAPEFLIR 定义"什么状态可迁移/什么图可执行/什么副作用可提交"                              |

### 4.2 HIGH — Spec 定义属于其他平面的对象

| 章节                     | 问题                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| §12 "Graph Scheduler"    | 定义 ReadyNodeSchedulingPolicy 类型 + 5条调度规则（属 P4 HarnessRuntime）       |
| §15 "Budget Ledger"      | 定义 BudgetLedger/BudgetReservation 类型（属 P5 BudgetAllocator）               |
| §16 "SideEffect Manager" | 定义 SideEffectRecord/Status/ExecutionContract/ReversibilityProfile（属 P4/P5） |
| §17 "Reconciliation"     | 定义 ReconciliationRecord/Status（属 P5）                                       |

### 4.3 MED — 其他冲突

| 章节                    | 问题                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| §34 Error Code          | OapeflirError 类型（架构前缀为 PLATFORM.{plane}.{component}.{category}）   |
| §37 Capability Matrix   | Core/Durable/Governed/Enterprise/Learning 分级（不对齐 Ring 1/2/3）        |
| §41 ADR                 | 18个 ADR-OAPEFLIR-\* 前缀（暗示 OAPEFLIR 独立权威域）                      |
| §14.1 OapeflirEvent     | 独立 event envelope 类型（可能被当作 truth source，违反 invariant）        |
| §20 LLM Decision Record | isolated_reexecution_replay 作为 first-class mode（架构默认 trace replay） |
| §Title                  | "Executable Specification"（与 "仅作为迁移输入" 定位冲突）                 |

---

## 5. Config / Bootstrap vs 架构

### 5.1 CRITICAL — 域配置用废弃 Phase + 缺风险规格

| 文件                                  | 问题                                           |
| ------------------------------------- | ---------------------------------------------- |
| `config/domains/quant-trading.json:7` | "phase": "9b"（应为 Ring）                     |
| `config/domains/healthcare.json:3`    | "phase": "9e"（应为 Ring）                     |
| `config/domains/quant-trading.json`   | 缺 riskProfile/riskSpec 块（high-risk 金融域） |
| `config/domains/healthcare.json`      | 缺 riskProfile/riskSpec 块（critical-risk 域） |

### 5.2 HIGH — Bootstrap / Catalog 用废弃分期

| 文件                                   | 问题                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `src/domains-runtime-catalog.ts:12-17` | phase9a-phase9f 命名                                    |
| `src/domains-startup-plan.ts:27`       | DOMAIN_PHASES 用 "9a"-"9f"                              |
| `src/index.ts:49-54`                   | PlatformRootSummary.capabilityCounts 用 phase9a-phase9f |

### 5.3 HIGH — 五平面结构不完整

| 文件                                         | 问题                                                |
| -------------------------------------------- | --------------------------------------------------- |
| `src/platform/five-plane-startup-plan.ts:29` | FivePlaneStartupStepId 只定义 P1-P5，缺 X1 横切平面 |
| `src/platform-architecture-bootstrap.ts`     | 无显式 P1-P5 + X1 平面标识                          |

### 7. AI 运营层代码 vs 架构（§15-§23）

| #     | 严重度   | 代码位置                                         | 问题                                                                                                |
| ----- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| R2-1  | CRITICAL | model-gateway/unified-chat-provider.ts           | ChatCompletionRequest 缺 traceId/tenantId/costTag 必填字段，架构 §15.2 明确要求                     |
| R2-2  | CRITICAL | model-gateway/unified-chat-provider.ts stream()  | 无 AbortSignal / 增量预算扣减 / partial response validation，架构 §15.4 要求流式预算实时控制        |
| R2-3  | CRITICAL | prompt-engine/prompt-injection-guard.ts          | PromptInjectionDefenseChain 为单层正则，无架构 §20.3 要求的多层链编排器(regex→classifier→LLM judge) |
| R2-4  | CRITICAL | prompt-engine/eval/                              | EvalDataset 无按风险级别最小样本数校验，架构 §21.5 要求 critical≥200/high≥100/medium≥50             |
| R2-5  | CRITICAL | plugins/builtin-plugin-registry.ts               | 插件系统无 DataTaintPropagation 追踪，架构 §23.4 要求跨插件数据污染标记传递                         |
| R2-6  | HIGH     | model-gateway/cost-tracker/budget-guard.ts       | BudgetPolicy 仅支持 task 级预算，缺架构 §18 要求的 platform/pack/step 三级预算层次                  |
| R2-7  | HIGH     | model-gateway/cost-tracker/chargeback-service.ts | ChargebackAllocation 缺 fx_rate/cost_source 字段，架构 §18.7 要求多币种归因                         |
| R2-8  | HIGH     | prompt-engine/registry/                          | Prompt lifecycle 缺 deprecated 阶段，架构 §20.6 定义 draft→active→deprecated→archived 四阶段        |
| R2-9  | HIGH     | plugins/builtin-plugin-registry.ts               | 无 BundleRevocationSeverity 机制，架构 §23.6 要求插件撤回严重度分级                                 |
| R2-10 | HIGH     | prompt-engine/eval/                              | LLM-as-Judge 无按风险级别独立性强制（高风险需外部独立评审），架构 §21.7 明确要求                    |
| R2-11 | HIGH     | plugins/ PluginContext                           | 无 call_depth/delegation_depth 追踪，架构 §23.2 要求防止插件无限递归委托                            |
| R2-12 | HIGH     | prompt-engine/eval/                              | critical_case_pass==100% 只加 finding 不阻断发布，架构 §21.5 要求作为硬门禁                         |

### 8. 剩余 Contract vs 架构

| #     | 严重度 | 文件                                                    | 问题                                                                                                                                      |
| ----- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R2-13 | HIGH   | runtime_state_machine_contract.md                       | §6 ExecutionStatus 8态机与架构 §25.8 NodeRun 14态生命周期冲突，缺 admitted/planning/ready/pausing/replanning/compensating                 |
| R2-14 | HIGH   | runtime_state_machine_contract.md                       | §3 WorkflowStatus 7态缺架构 13态 HarnessRun 的 created/admitted/planning/ready/pausing/replanning/compensating/aborted                    |
| R2-15 | HIGH   | cost_and_budget_contract.md                             | §4 CostEvent 以 task_id 为必填但 harness_run_id 为可选，架构 §18 以 HarnessRun 为预算主体                                                 |
| R2-16 | HIGH   | cost_and_budget_contract.md                             | §7.4 隐式成本归属仍用废弃 execution_id，应为 node_run_id/attempt_id                                                                       |
| R2-17 | MEDIUM | cost_and_budget_contract.md                             | §4 CostEvent 缺 budget_reservation_id，架构 §18.3 要求 reserve-before-execute 链接                                                        |
| R2-18 | MEDIUM | task_and_workflow_contract.md                           | §6-§7 WorkflowStep/StepOutput 以 step_id 为主键，应为 node_run_id                                                                         |
| R2-19 | MEDIUM | policy_engine_contract.md                               | §3.1 PolicyDecisionRequest 用废弃 execution_id                                                                                            |
| R2-20 | MEDIUM | execution_plane_contract.md                             | §8 ExecutionTicket isolation_level 用废弃 standard/hardened/strict，应为 read_only/workspace_write/scoped_external_access/restricted_exec |
| R2-21 | MEDIUM | model_gateway_routing_contract.md                       | ModelRouteRequest 缺 harness_run_id/node_run_id，无法满足 INV-BUDGET-001 预算门禁                                                         |
| R2-22 | MEDIUM | observability_contract.md                               | §3 LogEvent 缺 harness_run_id/node_run_id 必填字段                                                                                        |
| R2-23 | LOW    | plugin_spi_contract.md vs tool_skill_plugin_contract.md | 生命周期钩子命名互相矛盾（initialize/activate vs onLoad/onActivate）                                                                      |
| R2-24 | MEDIUM | runtime_state_machine_contract.md                       | 用 ExecutionStatus 名称而非 canonical NodeRun.status                                                                                      |

### 9. 架构文档内部一致性

| #     | 严重度 | 位置            | 问题                                                                       |
| ----- | ------ | --------------- | -------------------------------------------------------------------------- |
| R2-25 | HIGH   | §45.13 vs §25.8 | HarnessRun 状态数矛盾：§45.13 定义 6态，§25.8 定义 13态                    |
| R2-26 | HIGH   | §45.13 vs §58.6 | finalDecision 取值矛盾：§45.13 允许 4值，§58.6 HarnessDecision 列出 6值    |
| R2-27 | HIGH   | §58.6           | 标题称"六种裁决"但表格实际列出 10种，自相矛盾                              |
| R2-28 | MEDIUM | §45.7 vs §58.6  | LoopController 决策类型：§45.7 列 5种，§58.6 要求 6种（缺 downgrade_mode） |
| R2-29 | MEDIUM | §45.9           | Generator WorkProduct 仍用废弃 step_id 字段                                |
| R2-30 | MEDIUM | §59.2           | ExplanationRequest 用废弃 workflow_id/step_id                              |
| R2-31 | MEDIUM | §35             | contracts/ 目录结构含废弃命名子目录（execution-plan/、workflow-run/）      |
| R2-32 | LOW    | §36.3           | 仍用 Phase 1-9 作为 canonical 成功标准，与 Ring 1/2/3 体系矛盾             |


### 11. Harness Runtime 深层实现缺口（§45）

| #     | 严重度   | 文件                                         | 问题                                                                                                                                    |
| ----- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1  | CRITICAL | orchestration/harness/guardrail-engine.ts    | 护栏仅 policy/risk/tool/evidence/budget 5层；§45.20 要求 Input(注入防御)/Planning/Tool/Memory/Output 五层——Input 和 Memory 护栏完全缺失 |
| R3-2  | CRITICAL | orchestration/harness/hitl-runtime.ts        | 仅支持 open/resolve(approve/reject)；§45.18 要求 5种 HITL：Inspect/Patch/Override/Takeover/Resume 含完整状态机                          |
| R3-3  | CRITICAL | orchestration/harness/index.ts               | HumanResponsibilityRecord(§45.27) 未实现——每次 HITL 操作需产出 actor/action/scope/rationale/beforeRef/afterRef/expiresAt/auditRef       |
| R3-4  | HIGH     | orchestration/harness/index.ts               | autonomyMode 用 manual/supervised/auto/full_auto；§42.1 要求 suggestion/supervised/semi_auto/full_auto                                  |
| R3-5  | HIGH     | orchestration/harness/index.ts               | HarnessRun 缺 §45.13 要求的 tenantId/goal/mode/riskLevel/ownership/auditRefs/traceId 7字段                                              |
| R3-6  | HIGH     | orchestration/harness/index.ts               | HarnessStep 缺 §45.13 要求的 nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction 8字段                           |
| R3-7  | HIGH     | orchestration/harness/index.ts               | HarnessDecision 仅 6值；§58.6 要求追加 quarantine/revoke_approval/pause_for_external/require_revalidation                               |
| R3-8  | HIGH     | orchestration/harness/toolbelt-assembler.ts  | 仅做 allowed/blocked 集合交集；§45.4 要求 6步装配：domain→constraint→risk→budget→security→reliability                                   |
| R3-9  | HIGH     | orchestration/harness/recovery-controller.ts | 仅处理 3种故障；§45.11 要求 5种含 llm_provider_unavailable/budget_exhausted/platform_panic                                              |
| R3-10 | HIGH     | orchestration/harness/memory-manager.ts      | 命名空间 run/domain/shared 无治理；§45.16 要求 Working/Long-term/Shared 含晋升/降级策略+防自我强化                                      |
| R3-11 | HIGH     | orchestration/harness/index.ts               | assertInvariants 仅检查 budget/state；§45.21 定义 10项不变量（INV-1~INV-10）均未强制                                                    |
| R3-12 | HIGH     | orchestration/harness/index.ts               | PromptExecutionRecord(§45.24) 未实现——需冻结 promptVersion/modelRoute/inputHash/outputHash/contextSnapshotRef/guardrailResult/usage     |
| R3-13 | HIGH     | orchestration/harness/index.ts               | DecisionInputBundle(§45.25) 未实现——决策前需冻结 evaluator/policy/budget/risk/node/sideEffect/hitl/guardrail 状态                       |
| R3-14 | MEDIUM   | orchestration/harness/context-assembler.ts   | 直接复制源对象；§45.5 要求 token budget trimming + relevance scoring + freshness scoring + trust filtering                              |
| R3-15 | MEDIUM   | orchestration/harness/index.ts               | ContextAssemblyContract(§45.23) 未实现——需 per-role context 隔离含 taintPolicy/rankingPolicy/redactionPolicy                            |

### 12. 组织治理 + 规模生态深层缺口（§46-§57）

| #     | 严重度   | 文件                                                          | 问题                                                                                                                                                                    |
| ----- | -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-16 | CRITICAL | scale-ecosystem/multi-region/region-router/                   | RegionDescriptor 缺 provider/endpoints/dataResidencyPolicy；status 用 active/degraded/disabled 而非架构要求 active/standby/draining                                     |
| R3-17 | CRITICAL | scale-ecosystem/multi-region/failover-controller/             | 无 fencing epoch；§52.3 要求 failover 提升 epoch，旧 leader 恢复后只能 follower 加入                                                                                    |
| R3-18 | CRITICAL | scale-ecosystem/integration/connector-registry/               | ConnectorManifest 缺整个 ConnectorCapabilityProfile(§57.1)：actionRiskProfiles/permissionProbes/quotaProbes/credentialRotationPolicy                                    |
| R3-19 | HIGH     | scale-ecosystem/sla-engine/tier-resolver/                     | SlaTierSchema 缺 §54.1 要求的 availability/externalP95/internalP99/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel                                   |
| R3-20 | HIGH     | scale-ecosystem/sla-engine/sla-operations-service.ts          | 无按 workflow class 拆分 SLA（§54.3 要求 deterministic/LLM-assisted/HITL-waiting 分别承诺）                                                                             |
| R3-21 | HIGH     | scale-ecosystem/marketplace/catalog/                          | 用 listingId 代替 §55.2 entryId，缺 packId/rating/installCount；certificationStatus 枚举不匹配                                                                          |
| R3-22 | HIGH     | org-governance/compliance-engine/framework-catalog.ts         | auditRequirements 是 string[] 而非 §49.1 要求的 AuditSpec[]（含 frequency/evidenceType/retentionPeriod）                                                                |
| R3-23 | HIGH     | org-governance/compliance-engine/inheritance/                 | 无 PolicyStrictnessComparator(§49.2)；不可比策略静默 fallback 到 Math.min 而非进入合规审批                                                                              |
| R3-24 | HIGH     | org-governance/approval-routing/route-engine/                 | applySodPolicy 未阻止同链互批(§47.1)——同一审批链两人可互相审批对方请求                                                                                                  |
| R3-25 | HIGH     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts | 缺 §50.3 两阶段提交（prepare lock→atomic commit→failure reconciliation）；仅做简单 pass/fail 分类                                                                       |
| R3-26 | HIGH     | scale-ecosystem/resource-manager/quota-enforcer/              | QuotaPolicy 单维度；§53.2 要求 7维 MultiResourceQuotaVector（worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io）全部通过才准入 |
| R3-27 | MEDIUM   | org-governance/delegated-governance/                          | GovernanceDelegationRevocationSaga 缺级联范围(§51.1)：需覆盖 pending approval/active session/secret lease/worker lease/scheduled trigger                                |
| R3-28 | MEDIUM   | org-governance/org-model/org-governance-saga.ts               | §46.3 要求 commit 固定序(identity→approval→budget→domain→agent)含 OrgGovernanceSagaReceipt；实际无序无 receipt                                                          |
| R3-29 | MEDIUM   | org-governance/sso-scim/identity-sync-service.ts              | DLQ 仅记录无重试；§48.2 要求 retry/backoff + 每日对账 + IdentityReconciliationReport                                                                                    |
| R3-30 | MEDIUM   | scale-ecosystem/multi-region/cross-region-routing-service.ts  | 跨境传输仅 boolean allowCrossBorder；§52.4 要求 5步链：JurisdictionClassifier→TransferImpactAssessor→MechanismSelector→DataMinimizer→OutputScanner                      |
| R3-31 | MEDIUM   | scale-ecosystem/billing/types.ts                              | RecordUsageInput 单 metricType；§53.2 要求多维准入守卫                                                                                                                  |
| R3-32 | MEDIUM   | org-governance/knowledge-boundary/sharing-gate/               | evaluateKnowledgeShare 返回 boolean；§50.3 要求经 CrossBoundaryTransform（脱敏/摘要/字段过滤）                                                                          |

### 13. 运维成熟度 + SDK 缺口（§51-§69）

| #     | 严重度 | 文件                                                        | 问题                                                                                                                                    |
| ----- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-33 | HIGH   | ops-maturity/explainability/explanation-pipeline-service.ts | StageRationale 缺 §59.3 的 rationaleId/alternatives/confidence/decisionInputRef/versionLockRef/visibilityLabels/renderedExplanation     |
| R3-34 | HIGH   | ops-maturity/emergency/platform-panic-service.ts            | PlatformPanicDirective 缺 §60.1 severity(full/partial)/reconfirmationAfterSeconds/rollbackStrategy                                      |
| R3-35 | HIGH   | ops-maturity/agent-lifecycle/agent-registry/                | AgentLifecycleState 缺 removed 态(§61.3 要求9态)；transitions 缺 archived→removed 和 paused→canary                                      |
| R3-36 | HIGH   | ops-maturity/edge-runtime/edge-runtime-sync-service.ts      | EdgeRuntimeProfile 缺 §62.2 deviceId/offlineMaxDuration/keyLease/risk_level≤medium 门禁                                                 |
| R3-37 | HIGH   | ops-maturity/edge-runtime/sync-queue/                       | EdgeSyncEnvelope 缺 §62.3 device_id/sequence_no/prev_hash/side_effect_dependency_refs/signature/local_time_offset                       |
| R3-38 | HIGH   | sdk/client-sdk/api-client.ts                                | 未发送 §22.2 要求的 X-Platform-Version/X-SDK-Version/X-Contract-Version 版本握手头                                                      |
| R3-39 | HIGH   | sdk/cli/index.ts                                            | 缺 §22.3 要求的 pack create/test/validate/publish CLI 命令                                                                              |
| R3-40 | MEDIUM | ops-maturity/edge-runtime/                                  | 冲突解决含 accept_edge；§62.3 要求 central wins + 生成 Incident 人工审查                                                                |
| R3-41 | MEDIUM | sdk/pack-sdk/pack-manifest.ts                               | BusinessPackManifest 缺 §22.2 sdk_semver/platform_min_version/platform_max_version/contract_test_generator                              |
| R3-42 | MEDIUM | ops-maturity/cost-optimizer/                                | CostAttributionRecord 用单一 amountUsd；§64.1 要求 7维分解(llm/tool/compute/storage/egress/humanReview/total)                           |
| R3-43 | MEDIUM | ops-maturity/compliance-reporter/                           | 缺 ControlCoverageReport + GapAnalyzer(§66.2)；evidence-to-control mapping 缺 controlId/freshness/owner/exception                       |
| R3-44 | MEDIUM | ops-maturity/chaos/                                         | 缺 PanicDrillReport(§60.4)：ingress_block_time/execution_quiescence_time/plane_ack_success_rate 等                                      |
| R3-45 | MEDIUM | ops-maturity/multimodal/                                    | MultimodalInputPart 缺 §68.2 provenance(C2PA/watermark/hash/license)/artifactRef；SafetyFinding 缺 confidence/policyDecision/appealPath |
| R3-46 | MEDIUM | ops-maturity/drift-detection/cross-agent-analyzer/          | 不产出 CrossAgentDriftAlert(§63.4)；缺 alert severity + anti-gaming 区分                                                                |
| R3-47 | MEDIUM | ops-maturity/platform-ops-agent/                            | OpsAgentDefinition 缺 §69.1 ops_data_boundary 声明（仅平台指标/日志/配置，禁止业务 payload）                                            |
| R3-48 | LOW    | ops-maturity/capacity-planner/                              | failoverReservePercent 硬编码 15%；§67.2 要求按 SLA tier 动态 N+1                                                                       |
| R3-49 | LOW    | sdk/harness-sdk/                                            | 缺 traceReplay/sideEffectReconciliation 方法(§22)                                                                                       |
| R3-50 | LOW    | sdk/admin-sdk/                                              | 缺 triggerPanic/resumePanic/manageAgentLifecycle/rotateSecrets(§22.1)                                                                   |

### 14. ADR 与架构矛盾（新发现）

| #     | 严重度 | ADR     | 问题                                                                                                                                                 |
| ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-51 | HIGH   | ADR-060 | 定义 Plan DTO + RuntimeExecuteBridge 作为 P3→P4 contract；§5.3/INV-GRAPH-001 要求 PlanGraphBundle 为唯一 canonical P3→P4 交接物                      |
| R3-52 | HIGH   | ADR-061 | 生命周期 6态(draft/testing/staging/production/deprecated/retired)；§61.3 要求 9态，缺 canary/active/paused/archived/removed，多出 production/retired |
| R3-53 | HIGH   | ADR-054 | Platinum 承诺 99.99%；§54.2 限定 99.95%（99.99% 仅在专用部署档单独承诺）                                                                             |
| R3-54 | HIGH   | ADR-042 | 自治等级 supervised/assisted/partial_auto/high_auto/full_auto(5级)；§42.1 仅 suggestion/supervised/semi_auto/full_auto(4级)                          |
| R3-55 | HIGH   | ADR-083 | 又一套自治命名 manual_only/suggest_only/supervised_execute/trusted_auto_execute——第三套互不兼容                                                      |
| R3-56 | MEDIUM | ADR-058 | GlobalCircuitBreaker.open_duration_ms 隐含 TTL 自动解除；§60.3 明确禁止 Panic TTL 自动解除，恢复需人工双人确认                                       |
| R3-57 | MEDIUM | ADR-022 | 暴露 /api/v1/workflow-runs 为 canonical API；§5.5 声明 workflow_run 仅为 query projection                                                            |
| R3-58 | MEDIUM | ADR-065 | 用 WorkflowDAGView/StepInspector 全为废弃概念，无 v4.3 remediation                                                                                   |
| R3-59 | MEDIUM | ADR-040 | goal decomposition MAX_DEPTH=5 未引用全局 call_depth 硬帽=8 及反乘法规则(§19.2)                                                                      |
| R3-60 | MEDIUM | ADR-062 | 边缘同步列 last_write_wins 为合法策略；§25.11 真相数据要求单主写入，LWW 违反不变量                                                                   |
| R3-61 | MEDIUM | ADR-060 | 引用 §L.6/§H.2 节——架构 v4.3 无此节号，cross-ref 失效                                                                                                |
| R3-62 | LOW    | ADR-003 | 标题"六层"文件名"seven-layers"实际架构和 ADR-020 均为六层——命名全面混乱                                                                              |
| R3-63 | LOW    | ADR-075 | ImprovementCandidate 12态机无架构支撑；§56.4 LearningCandidate 仅 quarantine/approved/rejected/released                                              |
| R3-64 | LOW    | ADR-019 | 声称源节 §12 "Agent Handoff"；实际 §12 是"异常事件处理架构"——section ref 错误                                                                        |

### 15. 剩余 Contract 深层缺口

| #     | 严重度 | 文件                                               | 问题                                                                                                                                                |
| ----- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-65 | HIGH   | typed_event_bus_contract.md                        | OAPEFLIR 事件 payload 全部用 task_id/workflow_id/execution_id；§5.5 要求 harnessRunId/nodeRunId/planGraphId                                         |
| R3-66 | HIGH   | typed_event_bus_contract.md                        | PlanCreatedPayload 用 step_count 暗示线性步骤；§5 要求 PlanGraph(图结构)                                                                            |
| R3-67 | HIGH   | typed_event_bus_contract.md                        | ExecutionCompletedPayload 定义 execution_id/outcome/output_refs 为执行结果模型；与 §5 NodeAttemptReceipt(receiptId/nodeRunId/attemptId/status) 冲突 |
| R3-68 | HIGH   | explainability_and_stage_rationale_contract.md     | StageRationale 仅 7字段；§59.3 要求 11字段(缺 rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives)                 |
| R3-69 | HIGH   | workflow_debugger_contract.md                      | BreakpointDefinition 用 workflow_id/step_selector；§5.5 应为 harnessRunId/nodeRunId                                                                 |
| R3-70 | HIGH   | startup_consistency_and_recovery_drill_contract.md | 一致性矩阵用 current_step_index/workflow_state；应为 HarnessRun.status/NodeRun.status/PlanGraph                                                     |
| R3-71 | MEDIUM | budget-ledger-contract.md                          | BudgetReservation.resourceKind 枚举缺 §18 要求的 storage/bandwidth/memory                                                                           |
| R3-72 | MEDIUM | naming_and_engineering_boundary_contract.md        | §2 列 WorkflowExecutor 为 canonical 工程名；§5 canonical 入口为 HarnessRuntime                                                                      |
| R3-73 | MEDIUM | admin_console_and_human_takeover_contract.md       | takeover 操作用步骤语言(修改下一步/跳过某步/重试某步)；§5.5 操作粒度为 NodeRun                                                                      |
| R3-74 | MEDIUM | nl_entry_and_goal_decomposition_contract.md        | IntentParseResult 含 suggested_workflow_id；§5 所有执行为 HarnessRun，NL 应建议 domain/pack/recipe                                                  |
| R3-75 | MEDIUM | typed_event_bus_contract.md                        | OAPEFLIR payload 缺 derivedFromEventId；event-envelope-contract §4 要求声明 derivation source                                                       |
| R3-76 | MEDIUM | governance_control_plane_contract.md               | §15A release_transition_gate 值 off/suggest/shadow 与 §61.3 lifecycle 9态不映射                                                                     |
| R3-77 | MEDIUM | explainability_and_stage_rationale_contract.md     | ExplanationDepth 用 brief/standard/audit；§59.4 要求 L1 Summary/L2 Reasoning/L3 Forensic                                                            |
| R3-78 | LOW    | typed_event_bus_contract.md                        | ReplanTriggeredPayload 用 old_version/new_version 未引用 GraphPatch(baseGraphVersion→newGraphVersion)                                               |
| R3-79 | LOW    | capacity_planning_contract.md                      | 缺 CapacityAlert 输出对象(§67.2 要求 forecast 超阈值时产出)                                                                                         |
| R3-80 | LOW    | explainability_and_stage_rationale_contract.md     | 无 remediation section；未引用 §59 "解释不可篡改纳入 Evidence Plane" + "解释必须 permission-aware" 

### 17. Platform Contracts 层根本性问题

| #     | 严重度   | 文件                                           | 问题                                                                                                                                                   |
| ----- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R4-1  | CRITICAL | platform/contracts/control-directive/          | ControlDirective 仍作为第一级导出活跃消费；§5.2 明确废弃，canonical 替代 OperationalDirective/DecisionDirective 全代码库不存在                         |
| R4-2  | CRITICAL | platform/contracts/execution-plan/             | ExecutionPlan 用线性 steps[] 作为活跃 contract；§5.3 禁止线性步骤，PlanGraphBundle(graph nodes/edges) 为唯一 P3→P4 交接物                              |
| R4-3  | CRITICAL | platform/contracts/execution-receipt/          | ExecutionReceipt 以 stepId 为主键仍为活跃 contract；§5.5 canonical 为 NodeAttemptReceipt(nodeRunId+attemptId)                                          |
| R4-4  | CRITICAL | platform/contracts/types/platform-contracts.ts | 同文件含第二份 ExecutionPlan + ExecutionReceipt + ControlDirective 定义——两套废弃 contract 并行存在                                                    |
| R4-5  | CRITICAL | platform/five-plane-\*/                        | 架构 §4 要求五平面目录(P1-P5)，**实际无 five-plane-\* 目录**——平面分离在结构上不可强制                                                                 |
| R4-6  | HIGH     | platform/contracts/executable-contracts/       | NodeAttemptReceipt 缺 harnessRunId/planGraphId/graphVersion/duration/error_detail(§5.3 必填)                                                           |
| R4-7  | HIGH     | platform/contracts/request-envelope/           | RequestEnvelope 缺 confirmedTaskSpecId/principal(typed)/idempotencyKey/priority(§5.3 intake pipeline)                                                  |
| R4-8  | HIGH     | platform/contracts/state-command/              | StateCommand 无 leaseId/fencingToken/event/principal——无法满足 INV-STATE-001                                                                           |
| R4-9  | HIGH     | platform/contracts/                            | 缺 EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand 三个 §5.3 inter-plane 契约模块                                                           |
| R4-10 | HIGH     | platform/contracts/types/platform-contracts.ts | SideEffectRecord 仅 4态(proposed/committed/rolled_back/failed)；executable-contracts 定义 16态——两套冲突共存                                           |
| R4-11 | MEDIUM   | platform/contracts/executable-contracts/       | LEGACY_CONTRACT_NAMES 列表无强制机制——无 deprecation warning/re-export guard/CI lint 阻止新代码导入废弃模块                                            |
| R4-12 | MEDIUM   | platform/contracts/index.ts                    | Barrel 导出优先废弃类型(requestEnvelopeContract)而非 executable-contracts——激励消费废弃接口                                                            |
| R4-13 | MEDIUM   | platform/contracts/executable-contracts/       | EventEnvelope 缺必填 runId(§28.1)；replayBehavior 为 optional(§28.1 要求 explicitly declared)；eventVersion 为 string 而非 §28.1 numeric schemaVersion |
| R4-14 | MEDIUM   | platform/control-plane/                        | P2 模块无任何 OperationalDirective/DecisionDirective 发射或消费——P2→P3/P4 治理门禁结构性缺失                                                           |

### 18. Execution + State-Evidence 平面缺口（§13-§14）

| #     | 严重度 | 文件                                                   | 问题                                                                                                                          |
| ----- | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R4-15 | HIGH   | execution/state-transition/transition-service.ts       | 并行 legacy TransitionService 直接操作 task/workflow/session/execution 状态，完全绕过 RuntimeStateMachine——INV-STATE-001 旁路 |
| R4-16 | HIGH   | execution/runtime-state-machine.ts                     | RuntimeTransitionCommand 缺 commandId(UUID)/entityType/entityId/principal(§5.3 必填)                                          |
| R4-17 | HIGH   | execution/recovery/                                    | 无 RecoveryCadence/RecoveryReport 类型；§14.7 要求每个 Recovery Worker 声明检查间隔+产出报告                                  |
| R4-18 | HIGH   | state-evidence/checkpoints/workflow-step-checkpoint.ts | Checkpoint 用 stepId/workflowId/executionId 而非 harnessRunId/nodeRunId/planGraphId                                           |
| R4-19 | MEDIUM | execution/state-transition/state-transition-machine.ts | 允许 no-op transition(current==next 静默返回)；RuntimeStateMachine 明确拒绝——两套机器行为矛盾                                 |
| R4-20 | MEDIUM | execution/recovery/replay-boundary-guard.ts            | 仅实现 trace_replay/reexecution_replay 两种模式；§28.5 定义三种含 projection_replay                                           |
| R4-21 | MEDIUM | execution/run-termination-cleanup.ts                   | 始终返回 complete:true 无实际清理；§14.10 要求发射 cleanup_completed/cleanup_failed 事件                                      |
| R4-22 | MEDIUM | execution/run-termination-cleanup.ts                   | CleanupResourceKind 缺 callback 类型(§14.10 清理序列含"cancel pending callbacks")                                             |
| R4-23 | MEDIUM | execution/budget-allocator.ts                          | reserve() 不经 RuntimeStateMachine.transition()；§25.9 预算变更需同 CAS+event 事务路径                                        |
| R4-24 | MEDIUM | execution/queue/bounded-dispatch-event.ts              | BoundedDispatchEvent 缺 nodeRunId/tenantId/traceId/ordering_policy_version/queue_class(§14.9)                                 |

### 19. 核心不变量未强制执行（最严重系统性问题）

| #     | 严重度   | 不变量                                               | 旁路证据                                                                                                                                                                              |
| ----- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-25 | CRITICAL | INV-BUDGET-001 reserve-before-execute                | single-task-happy-path 和 multi-step-agent-round-loop 所有 LLM/Tool 调用无 BudgetReservation；BudgetAllocator.reserve() 存在但从未在执行路径调用；仅 AdmissionController 做粗粒度估算 |
| R4-26 | CRITICAL | INV-GRAPH-001 PlanGraphBundle 为唯一 P3→P4 contract  | 实际执行路径(single-task-happy-path/multi-step-orchestration) 创建 TaskRecord+WorkflowState+线性步骤直接执行，无 PlanGraphBundle；RuntimeEntryGuard 存在但从未被调用                  |
| R4-27 | CRITICAL | INV-RUN-001 HarnessRuntime 唯一执行入口              | 两个主执行路径均不创建 HarnessRun；用 legacy TaskRecord/ExecutionRecord 直接执行；RuntimeEntryGuard 未接入任何 dispatch 路径                                                          |
| R4-28 | CRITICAL | INV-STATE-001 Truth mutation 必须同事务 append event | single-task-happy-path 插入 task/workflow/execution 不 append PlatformFactEvent；用 legacy TransitionService 而非 RuntimeStateMachine                                                 |
| R4-29 | CRITICAL | INV-REPLAY-001 Replay 禁止产生真实副作用             | ReplayWorker 委托 replayService 但不调用 ReplayBoundaryGuard；无 ReplaySandboxPolicy 实现                                                                                             |
| R4-30 | HIGH     | INV-FENCING fencing token on state writes            | RuntimeStateMachine.assertLeaseAndFencing() 仅检查 NodeRun；HarnessRun/SideEffectRecord/BudgetLedger 跳过 fencing；legacy 路径完全绕过                                                |
| R4-31 | HIGH     | INV-SANDBOX 无 sandbox 不执行                        | executeToolCall()/executeAgentRoundLoop() 无 sandbox policy 检查；todo_write 硬编码空策略 {allow:[],deny:[]} 从不 enforce                                                             |
| R4-32 | HIGH     | INV-APPROVAL risk-proportional approval              | single-task-happy-path 硬编码 requiresApproval:0；multi-step-supervisor 同；PolicyEngine 未接入执行路径                                                                               |
| R4-33 | HIGH     | INV-SIDEEFFECT-001 ambiguous→reconciliation          | 无执行路径创建 SideEffectRecord；web_fetch/web_search 产生真实副作用但未记录/追踪/调和                                                                                                |
| R4-34 | HIGH     | INV-POLICY-001 deny-by-default                       | executeToolCall 用硬编码 switch-case dispatch，无 PolicyEngine/CapabilityGate 前置检查                                                                                                |
| R4-35 | HIGH     | All decisions→immutable evidence                     | LLM 调用和 tool 执行不产出 EvidenceRecord/DecisionInputBundle/HarnessDecision                                                                                                         |
| R4-36 | MEDIUM   | INV-SINGLE-LEADER                                    | 主执行路径直接 SQLite store.\* 写入无 leader check；HACoordinator 未接入                                                                                                              |

### 20. 安全/可观测/错误处理跨切面

| #     | 严重度   | 文件/领域                                           | 问题                                                                               |
| ----- | -------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| R4-37 | CRITICAL | control-plane/iam/network-egress-policy.ts          | 默认 mode="audit_only"——egress 违规仅日志不阻断(§11.5 要求 deny 为正式安全事件)    |
| R4-38 | CRITICAL | interaction/dashboard/dashboard-websocket-server.ts | registerClient() 无鉴权/无 tenantId/无 principal(§11.1 要求所有操作关联 principal) |
| R4-39 | HIGH     | 全 src/                                             | DataTaintPropagation(§11.6) 零实现——taint_label 从不出现在代码中                   |
| R4-40 | HIGH     | model-gateway/unified-chat-provider.ts              | LLM 调用无 principal/tenantId/audit/PolicyOutcome(§11.1-11.2)                      |
| R4-41 | HIGH     | model-gateway/circuit-breaker.ts                    | 状态变更仅写日志不发 event bus 事件(§9.4)                                          |
| R4-42 | HIGH     | shared/observability/runtime-metrics-registry.ts    | 10+ canonical harness.\* 指标仅 1个被记录(§12.4)                                   |
| R4-43 | HIGH     | shared/observability/structured-logger.ts           | 缺 crosscutting_fabric 字段(§12.4 要求 reliability/security/governance 分类)       |
| R4-44 | HIGH     | execution/plugin-executor/adapter-executor.ts       | retry 用固定延迟无 exponential backoff 无 jitter 无幂等检查(§9.3)                  |
| R4-45 | MEDIUM   | interaction/ux/conversation-history-service.ts      | tenant 隔离依赖后置 client-side filter 而非查询级隔离(§9.1)                        |
| R4-46 | MEDIUM   | model-gateway/unified-chat-provider.ts              | createChatCompletion 不传播 traceId/spanId(§12.7 断链)                             |
| R4-47 | MEDIUM   | model-gateway/degradation-controller.ts             | 降级切换不发 OperationalDirective 不与 mode 合成链交互(§9.5)                       |
| R4-48 | MEDIUM   | execution/plugin-executor/adapter-executor.ts       | retry 耗尽静默返回 error 无 incident/DLQ/error_code(§12.1)                         |
| R4-49 | LOW      | model-gateway/circuit-breaker.ts                    | failure rate 公式无成功数分母——阈值比较数学错误                                    |

### 21. 测试/配置/引导对齐

| #     | 严重度   | 文件/领域                          | 问题                                                                                                                                                                                                                               |
| ----- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-50 | CRITICAL | tests/invariants/                  | §2.4 要求 9个 invariant test 文件——**全部不存在**(truth-event-atomicity/harness-run-authority/plan-graph-only-dispatch/budget-reserve-before-execute/no-side-effect-in-replay/side-effect-ambiguous-reconciles/deny-by-default 等) |
| R4-51 | CRITICAL | tests/                             | INV-BUDGET-001 零测试覆盖                                                                                                                                                                                                          |
| R4-52 | CRITICAL | tests/                             | INV-REPLAY-001 零测试覆盖                                                                                                                                                                                                          |
| R4-53 | CRITICAL | tests/                             | INV-SIDEEFFECT-001 零测试覆盖                                                                                                                                                                                                      |
| R4-54 | CRITICAL | tests/                             | INV-POLICY-001 零测试覆盖                                                                                                                                                                                                          |
| R4-55 | HIGH     | config/runtime/default.json        | 用废弃 defaultStepTimeoutMs；无 canonical 状态机/五平面/RuntimeStateMachine 配置——仅 7字段 stub                                                                                                                                    |
| R4-56 | HIGH     | config/risk/default.json           | 用废弃 stepTypeRisk/stepTypeRiskValues；无 §28 Event Registry/DLQ 模型对齐                                                                                                                                                         |
| R4-57 | HIGH     | config/domains/\*.json             | 域 workflow 配置用线性 steps[] + stepName——§13/§45 要求 PlanGraph                                                                                                                                                                  |
| R4-58 | HIGH     | config/domains/\*.json             | 无 DomainRiskSpec(advisory_only/human_accountable/deterministic_hot_path_only)——quant-trading 高危域无风险声明                                                                                                                     |
| R4-59 | HIGH     | platform-architecture-bootstrap.ts | 注册为扁平目录无强制启动序(§7 要求 P5→X1→P2→P3→P4→P1)                                                                                                                                                                              |
| R4-60 | MEDIUM   | platform-architecture-types.ts     | 无 canonical runtime 对象类型(HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation)——仅基础设施类型                                                                                                                                |
| R4-61 | MEDIUM   | domains-runtime-catalog.ts         | 仍用 phase9a-9f 旧分期(§33 明确"仅历史映射"，canonical 为 Ring 1/2/3)                                                                                                                                                              |
| R4-62 | MEDIUM   | index.ts                           | main() 无架构启动不变量检查(ArchitectureInvariantRegistry/NonOverridableInvariantRegistry §2.4)                                                                                                                                    |
| R4-63 | MEDIUM   | index.ts                           | runPlatformRootDemo 用 snapshot.workflow.currentStepIndex/stepOutputs 废弃对象作为主输出                                                                                                                                           |
| R4-64 | MEDIUM   | tests/                             | 无 contract-naming-consistency.test.ts(§6.4 要求 CI lint 扫描废弃术语)  

### 23. OAPEFLIR 编排循环实现缺口（§13/§45/§58）

| #     | 严重度   | 文件                                            | 问题                                                                                                                    |
| ----- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R5-1  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Plan 阶段产出线性 Plan{steps[]}——非 PlanGraphBundle(§13.7 "Plan must be Graph")                                         |
| R5-2  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | run() 是单程管线(O→A→P→E→F→L→I→R→return)；replanDecision 计算后无重入——不是循环(§45.7 要求重入 Plan/Execute)            |
| R5-3  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 StageTransitionFSM——FSM 为死代码；阶段转换无校验                                                                 |
| R5-4  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 HarnessLoopController——无 max-iteration/max-replan/max-duration/max-cost 守卫                                    |
| R5-5  | HIGH     | orchestration/harness/index.ts decide()         | 无 downgrade_mode 决策分支(§58.6 要求 6种基础决策)                                                                      |
| R5-6  | HIGH     | orchestration/oapeflir/assessment-service.ts    | Assess 不消费/产出 ConstraintPack/EffectivePolicySnapshot/RiskAssessment(§13.1.1)                                       |
| R5-7  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Evaluator 产出 ExecutionOutcomeEvaluation 而非 §45.10 EvaluationReport(passed/score/issues[]/recommendation/confidence) |
| R5-8  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Release 阶段调 PolicyRolloutService.start() 无 EvaluationGate/approval/canary/rollback(§13.14)                          |
| R5-9  | HIGH     | orchestration/planner/plan-builder.ts           | 无 Graph Normalization/Validation/Risk Propagation/Worst-Path Analysis(§13.9-13.12)                                     |
| R5-10 | HIGH     | orchestration/oapeflir/stage-transition-fsm.ts  | FSM 禁止所有后向转换——replan 在结构上不可能(§45.7/§13.4 要求 feedback→plan)                                             |
| R5-11 | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Observer 仅合并 TaskSituation+SystemSituation；缺事件流/目标分解/记忆/前次运行上下文(§45.8)                             |
| R5-12 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Replan 无 GraphPatch 产出(§13.13 要求 baseGraphVersion+operations[]+compatibilityReport)                                |
| R5-13 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Execute 用 flat ExecuteBridge 无 subgraph/child-run 支持(§13.7 要求子任务/委托显式建模)                                 |
| R5-14 | LOW      | orchestration/oapeflir/oapeflir-loop-service.ts | OapeflirLoopResult 无 HarnessDecision 字段——OAPEFLIR 层与 Harness 决策模型断连                                          |

### 24. NL 入口 + 目标分解 + 主动代理缺口（§8/§19/§40-§42）

| #     | 严重度   | 文件                                           | 问题                                                                                           |
| ----- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R5-15 | CRITICAL | interaction/nl-gateway/index.ts                | pending_user_confirmation 状态仍发射 RequestEnvelope(§39.2 要求仅 confirmed TaskSpec 方可产生) |
| R5-16 | CRITICAL | interaction/nl-gateway/index.ts                | 无独立 classify_risk 管线阶段(§39.2 要求作为独立准入门禁)                                      |
| R5-17 | HIGH     | interaction/nl-gateway/index.ts                | DetectedIntent.intentType 缺 "why"(§39 新增解释查询类型)                                       |
| R5-18 | HIGH     | interaction/goal-decomposer/index.ts           | 无委托链深度限制(§19.2 max=3)和全局 call_depth 硬帽(=8)；无反乘法守卫                          |
| R5-19 | HIGH     | interaction/goal-decomposer/index.ts           | 无预算按比例分配到子任务(§40.2)；无风险传播到子任务                                            |
| R5-20 | HIGH     | interaction/goal-decomposer/index.ts           | GoalLifecycleState 缺 partially_completed(§40.5)                                               |
| R5-21 | HIGH     | interaction/autonomy/index.ts                  | TrustScore 范围 0-100；§42.1 要求 0-1000                                                       |
| R5-22 | HIGH     | interaction/autonomy/index.ts                  | 晋升规则无时间窗口 incident-free 检查(§42.2 要求 30d/60d/90d 零事件)                           |
| R5-23 | HIGH     | interaction/autonomy/index.ts                  | 无成本超预算 200% 降级规则(§42.2)                                                              |
| R5-24 | HIGH     | interaction/proactive-agent/index.ts           | medium 风险主动动作可 auto_execute(§41.1 禁止 medium+ 直接执行)                                |
| R5-25 | HIGH     | interaction/proactive-agent/trigger-engine/    | resolveTriggerActionMode() 同样对 medium/high 返回 auto_execute(§41.1 违规)                    |
| R5-26 | MEDIUM   | interaction/autonomy/index.ts                  | TrustDecayWorker 无 180d 无执行→suggestion 降级(§42.3)；无 30d 冻结晋升                        |
| R5-27 | MEDIUM   | interaction/autonomy/index.ts                  | 自治等级不与主动触发器联动(§42.5 要求 semi_auto 以上才允许自动执行)                            |
| R5-28 | MEDIUM   | interaction/goal-decomposer/index.ts           | 无能力验证(§40.2 要求验证目标域暴露所需 DomainCapability)；无权限收窄传播                      |
| R5-29 | MEDIUM   | interaction/proactive-agent/index.ts           | batch_window 配置存在但 evaluate() 无事件批量聚合(§41.4)                                       |
| R5-30 | MEDIUM   | interaction/nl-gateway/index.ts                | ClarificationState 无 rounds/maxRounds 追踪——可能无限澄清循环(§39.5)                           |
| R5-31 | LOW      | interaction/ux/conversation-history-service.ts | restricted/regulated 对话数据写入 long-term memory(§39.6 要求仅存 session memory)              |
| R5-32 | LOW      | interaction/nl-gateway/index.ts                | UserConfirmationReceipt 缺 scope/time/riskPreviewVersion(§39.3 审计匹配要求)                   |

### 25. 事件流 + API Surface 缺口（§6/§28）

| #     | 严重度   | 文件                                             | 问题                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5-33 | CRITICAL | platform/contracts/types/domain/session-types.ts | EventRecord 缺 §28.1 必填字段：schemaVersion/aggregateId/runId/sequence/replayBehavior/principal/evidenceRefs                                                 |
| R5-34 | CRITICAL | platform/state-evidence/events/event-registry.ts | 两套不互通事件注册表共存：legacy task:_ colon 命名空间 vs canonical platform._ dot 命名空间；platform.\* 无 Tier-1 路由/Zod 验证/typed payload                |
| R5-35 | CRITICAL | platform/interface/api/http-server/              | 无 /api/v1/harness-runs 及子资源路由(§6 canonical API)；仅有 legacy /v1/tasks                                                                                 |
| R5-36 | HIGH     | platform/interface/api/http-server/              | 缺 /api/v1/replay-sessions(§28.5 MVP)；admin routes 缺所有写方法(PUT config/POST panic-directives/POST resume-directives)                                     |
| R5-37 | HIGH     | state-evidence/events/durable-event-bus.ts       | publish() 不持久化 aggregateId/runId/sequence/schemaVersion——replay ordering 不可能(§28.5)                                                                    |
| R5-38 | HIGH     | state-evidence/events/event-types.ts             | Tier-1 列表含非架构事件(delegation:_/prompt:_/tenant:_)但缺架构核心事实(platform.harness_run._/platform.node*run.*/platform.side*effect.*/platform.budget.\*) |
| R5-39 | MEDIUM   | platform/interface/api/http-server/              | WebSocket 绑定 /ws 而非 §6 要求的 /ws/v1/stream；task-routes 用 /v1/tasks 无 /api/ 前缀                                                                       |
| R5-40 | MEDIUM   | state-evidence/events/event-registry.ts          | replayBehavior 用 simulate_projection 而非 §28.1 canonical simulate                                                                                           |
| R5-41 | MEDIUM   | state-evidence/events/typed-event-bus.ts         | TypedEventPayloadMap 不含 platform._/oapeflir._ 事件——编译时类型检查静默排除所有 canonical 运行时事件                                                         |

### 26. 委托 + 版本锁 + 记忆 + Truth 深层缺口（§19/§24/§25/§29）

| #     | 严重度 | 文件                                                           | 问题                                                                                                        |
| ----- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R5-42 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult 缺 §19.1 必填：summary/artifact_refs/trust_level/taint_labels/evidence_refs/policy_outcome |
| R5-43 | HIGH   | orchestration/agent-delegation/collaboration-protocol/types.ts | ACP 消息缺 §19.1 必填：delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline       |
| R5-44 | HIGH   | state-evidence/truth/runtime-truth-repository.ts               | transition() 对 HarnessRun 无 lease/fencing 验证(§25.3)                                                     |
| R5-45 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult 无 taint_labels/data_class——跨委托数据分类链断裂                                           |
| R5-46 | MEDIUM | orchestration/agent-delegation/call-depth-budget.ts            | 用 Math.max() 非求和——全局深度限制=8 实际无效(§19.2)                                                        |
| R5-47 | MEDIUM | orchestration/agent-delegation/delegation-manager.service.ts   | delegate() 不调 CallDepthBudget.evaluate()——直接委托绕过深度检查                                            |
| R5-48 | MEDIUM | state-evidence/truth/runtime-truth-repository.ts               | transaction() 内存 clone-and-rollback 无数据库事务——truth+event 原子性无崩溃安全(§25.6)                     |
| R5-49 | MEDIUM | state-evidence/knowledge/knowledge-query-service.ts            | 查询无 tenant/domain 边界校验(§45.16+§50)                                                                   |
| R5-50 | MEDIUM | state-evidence/memory/memory-decay-service.ts                  | working/procedural 施加指数衰减——§29.2 禁止静默丢弃 working、禁止丢弃 procedural                            |
| R5-51 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | 仅 pipeline/negotiation 模式；缺 §19.1 broadcast+AggregationPolicy                                          |
| R5-52 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | DelegationStatus 缺 discovery/bid/awarded(§19.1 竞标)                                                       |
| R5-53 | MEDIUM | interface/api/middleware/sdk-version-handshake.ts              | 缺 platform_min_version 兼容检查(§24)                                                                       |
| R5-54 | LOW    | control-plane/config-center/config-versioning-service.ts       | 发 config.version.created 非 §24.2 config.changed 热加载事件                                                |

### 27. ADR 与架构矛盾（第二批）

| #     | 严重度   | ADR                 | 问题                                                                                                                  |
| ----- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R5-55 | CRITICAL | ADR-026             | 风险因子模型(8因子/权重/18分制)与 §10.2 canonical(impact×4/irreversibility×4/…)完全不兼容                             |
| R5-56 | CRITICAL | ADR-001             | 将 OAPEFLIR 映射为活跃编排循环(OapeflirLoopService 编排 8 阶段)；§13/§45 明确 OAPEFLIR 仅为 StageRationale/Audit View |
| R5-57 | HIGH     | ADR-039             | 定义 cancel_task intent；§6.3 明确移除——调用方必须用 abort/pause/panic kill                                           |
| R5-58 | HIGH     | ADR-001             | 三层 CEO/VP 架构作为 Accepted 决策无 remediation；v4.3 §4 已用五平面+X1 替代                                          |
| R5-59 | HIGH     | ADR-002             | "事业部" YAML division 模型无 remediation；v4.3 用 DomainDescriptor+BusinessPack+DomainRiskSpec                       |
| R5-60 | HIGH     | ADR-004             | workflow 数据传递仍用 WorkflowState/StepOutput(§5.5 废弃)无 remediation                                               |
| R5-61 | HIGH     | ADR-034             | ADR freeze 规则"不允许直接修改已冻结内容"——v4.3 remediation 过程直接修改 30+ ADR 违反此规则                           |
| R5-62 | HIGH     | ADR-041             | TriggerAction.create_task 直接创建任务绕过 §5.3 intake pipeline(TaskDraft→ConfirmedTaskSpec→RequestEnvelope)          |
| R5-63 | MEDIUM   | ADR-006/008/005/002 | 源节引用全部指向旧版节号(§7/§8/§2)——v4.3 对应节已完全更替；cross-ref 批量失效                                         |
| R5-64 | MEDIUM   | ADR-028             | trace span 用 "service→operation→step"——step 为废弃术语(§5.5)                                                         |
| R5-65 | MEDIUM   | ADR-066             | 引用不存在的 §B/§G appendix；v4.3 无此附录                                                                            |
| R5-66 | MEDIUM   | ADR-046             | 用 CEO/VP 作为治理层级——v4.3 §46-§51 用 OrgNode 层次                                                                  |
| R5-67 | MEDIUM   | ADR-047             | auto_action 超时自动执行无风险级别守卫(§10.3 high/critical 默认 deny)    