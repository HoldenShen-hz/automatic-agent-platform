## 2026-04-28 复核结论

以下状态矩阵覆盖本文件原始发现的当前实况；原始分项清单保留在后文作为历史发现快照。判定依据只采信实际源码、配置与 contract/ADR/spec 文本，不再使用 closure test、closure script 或 supersede 占位说明。

| 主题 | 当前状态 | 根因 | 当前证据 |
| --- | --- | --- | --- |
| S1 OAPEFLIR 身份危机 | 部分修复 | v4.4 spec 在保留迁移输入时仍混入了可执行权威措辞，导致 projection 与 runtime truth 边界模糊。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已改为 `Reference Draft`、补充 `HarnessRuntime` 权威声明，并把 NodeRun 章节收敛为 canonical contract 引用。 |
| S2 废弃术语迁移未执行 | 部分修复 | v3 execution-centric 文档长期被后续 contract/ADR 直接复用，导致 `execution_id / workflow / step` 在部分兼容字段里残留。 | 代码侧 legacy contract 工厂已 fail-fast；`docs_zh/contracts/README.md`、`file_lock_contract.md`、`app_error_contract.md`、`audit_lineage_and_retention_contract.md`、`cost_and_budget_contract.md` 已把 canonical 键切到 `HarnessRun / NodeRun`。 |
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
