## 2026-04-28 复核Conclusion

以下Status矩阵覆盖本文件原始发现的当前实况；原始分项清单保留在后文作为历史发现快照。判定依据只采信实际源码、configurevs contract/ADR/spec 文本，不再uses closure test、closure script 或 supersede 占位Description。

| 主题 | 当前Status | Root Cause | 当前证据 |
|---|-------|--------| --- |
| S1 OAPEFLIR 身份危机 | 已修复 | Root cause:  OAPEFLIR spec/ADR 曾把认知投影视图写成 runtime truth，v4.3 迁移初期只改了局部 contract，references用链没有一起收口。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已降为 `Reference Draft`；`docs_zh/adr/070-conclusion.md`、`072-oapeflir-testing-strategy.md`、`071-plugin-spi-framework.md` 以及 `docs_zh/contracts/workflow_debugger_contract.md`、`plugin_spi_contract.md` 已把 OAPEFLIR 明确收回为 projection/view。 |
| S2 废弃术语迁移未执lines | 部分修复 | Root Cause不is“还有几个旧词”这么简单，而is v3 `workflow/execution/stepId` 兼容层长期停留在一等模型位置，code、contract、ADR each继续复用旧键，迁移没有形成单一 canonical 边界。 | 本轮已把 `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts` 收敛为 `nodeId` 内部主键、`src/platform/five-plane-state-evidence/events/projections/workflow-timeline-projection.ts` 补上 `planGraphBundleId / harnessRunId / nodeId` canonical 轴、`src/domains/registry/plugin-spi.ts` 把 `stepId/workflowId` 降为 alias；但 `src/scale-ecosystem/billing/types.ts` 及后文 2.4 / 3.4 所列部分 contract/ADR 残留仍未完全迁移。 |
| S3 RuntimeStateMachine 被bypassing | 已修复 | Root cause:  Harness / delegation / replay 曾each维护局部Status，导致运lines态修改散落在业务逻辑里。 | 复核实际文件后，`src/platform/five-plane-orchestration/harness/index.ts` 的 `runLoop()` 已viavia由 `transitionRunStatus()` 驱动Status迁移；`src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts` 已改为Status机路径；`src/platform/five-plane-execution/ha/replay-worker.ts` 有 `assertReplayPolicySafe()` 门禁。 |
| S4 Sandbox 含 `none` 档位 | 部分修复 | Root cause:  sandbox canonical tier 只在security策略层defines，但业务包、插件 SDK、delegation 上下文长期directly暴露 legacy alias，兼容输入vs canonical 输出没有分层。 | 本iterations已把 `src/sdk/plugin-sdk/plugin-definition.ts`、`src/sdk/plugin-sdk/plugin-context.ts`、`src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts` 的公共class型收敛到 canonical 4 档；但 `src/platform/five-plane-control-plane/iam/sandbox-policy.ts` vs `src/domains/business-pack/business-pack-manifest.ts` 仍保留 alias 兼容解析，所以不能宣称“完全消失”。 |
| S5 Budget 保护缺失 | 部分修复 | Root Cause已从“完全没有 reservation”转为“budget职责分散”: orchestration 先做门禁、执lines方再单独预留，failed时缺少统一 release/settle 生命cycle，导致repeats预留vs泄漏风险。 | `src/platform/model-gateway/cost-tracker/budget-guard.ts` 现负责执lines前门禁；本iterations补齐 `src/platform/five-plane-execution/budget-allocator.ts` 的 `release()`，并把 `src/interaction/goal-decomposer/llm-plan-generator.ts`、`src/scale-ecosystem/billing/billing-service.ts` 改为failed即释放 reservation；`src/interaction/goal-decomposer/index.ts` 不再在上层repeats预留。 |
| S6 Trust Score bypassingsecurity边界 | 原发现已过时 | Root cause: 此前审计based on旧快照，未反映后续已落地的风险封顶和 full-auto 禁止逻辑。 | `src/interaction/autonomy/trust-scorer/index.ts` 把 `fully_trusted` 映射到 `semi_auto`；`src/interaction/autonomy/promotion-engine/index.ts` 明确阻止 `semi_auto -> full_auto` 自动提升；`src/interaction/proactive-agent/trigger-engine/index.ts` 对 `high` 风险返回 `suggest`，不is `auto_execute`。 |
| S7 域风险规格缺失 | 已修复 | Root cause: 高风险域先完成 baseline onboarding，治理约束后来才补，导致风险规格在模型层缺席。 | `src/domains/domain-specs.ts` 已contains `advisoryOnly / humanAccountable / deterministicHotPathOnly`，并内置 `healthcare / quant-trading / financial-services / legal` 的defaults to `DomainRiskSpec`。 |
| S8 storage Schema based on废弃对象 | 已修复 | Root cause: storage合同directly复用了 v3 单机table模型，后来 runtime truth table族补进后，文档没有synchronous换主链。 | `docs_zh/contracts/storage_schema_contract.md` 现以 `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_*` 为 authoritative truth，并显式把 `executions` 等旧table降级为 projection / compatibility。 |
| S9 Phase 1-9 仍作为 canonical 分期 | 已修复 | Root cause: 上一轮所谓 ring migration 只改了展示层，`domains` 的 canonical bootstrap service id 和relies on链仍然绑在历史 phase 上。 | 本iterations已把 `src/domains/domains-bootstrap.ts`、`src/domains-runtime-catalog.ts`、`src/domains-startup-plan.ts`、`src/domains-runtime-orchestrator.ts` 收敛到 `ring1 / ring2 / ring3` 作为 runtime truth；legacy `9a-9f` only保留为 bootstrap 输入映射。 |
| S10 Saga 语义缺失 | 已修复 | Root cause: 组织治理 saga 早期只is“根据输入拼回执”，没有真正的执lines器抽象去承载 `prepare/commit/compensate/audit`，所以failed点和补偿路径都只is内存推导。 | 本iterations复核后，`src/org-governance/org-model/org-governance-saga.ts`、`src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts`、`src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` 都改为可注入 handler 的可执lines编排器，failed时会真实call补偿 handler，并把 `failedStepId/failedStage/executionLog` 落入回执。 |

## 复核方法

- 只以实际文件内容为依据。
- contract/ADR/spec 若仍references用旧术语，但已显式降级为 `legacy / projection / migration input`，不再计为 canonical conflicts。
- 历史发现中若已被源码或文档实改消除，后文原始条目不再代table当前未修复Status。
- 本轮only执lines定向验证，不执linesfull测试；已验证 `domains` ring 启动、`provider-registry` request上下文、budget allocator / llm plan generator、SDK / delegation sandbox，以及 `sub-workflow-executor / workflow-timeline-projection / plugin-spi` 兼容边界迁移相关测试。

## 系统性Issue总结

| #   | 系统性主题                                                                                            | 严重度   | Impact范围                                 |
| --- | ----------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| S1  | OAPEFLIR 身份危机：v4.4 Spec 自defines全套 Runtime 对象vsStatus机，vs主Architecture"only投影"定位根本conflicts            | CRITICAL | spec + 10+ ADR + 5+ contract             |
| S2  | v3→v4 术语迁移未执lines：ExecutionPlan/ControlDirective/stepId/executionId/workflow_run 仍作为 canonical | CRITICAL | ~60% contract + ~40% ADR + ~30% code     |
| S3  | RuntimeStateMachine 被bypassing：Harness/Delegation/Recovery directly修改 status                               | HIGH     | 核心运lines时code                           |
| S4  | Sandbox 含 "none" 档位：Architecture只允许4档，code含5档(含none)                                              | HIGH     | 3+ 模块                                  |
| S5  | Budget 保护缺失：多occurrences LLM/执linescallno BudgetReservation 前置                                           | HIGH     | billing + goal-decomposer + budget-guard |
| S6  | Trust Score 可bypassingsecurity边界：directly映射 full_auto no inherent risk 检查                                  | CRITICAL | autonomy + promotion-engine              |
| S7  | 域风险规格缺失：高危域(量化/金融/医疗/法务)no DomainRiskSpec                                          | HIGH     | 4+ 域                                    |
| S8  | storage Schema based on废弃对象：DDL 以 executions table为核心，no canonical truth table                           | CRITICAL | storage_schema_contract                  |
| S9  | Phase 1-9 仍作为 canonical 分期：Ring 1/2/3 未落地                                                    | HIGH     | config + ADR + code                      |
| S10 | Saga 语义缺失：org-governance saga no实际 compensate/rollback                                         | HIGH     | org-governance                           |

---

## 1. code vs Architecture

### 1.1 CRITICAL — RuntimeStateMachine 被bypassing

| 位置                                                                                            | Issue                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/platform/five-plane-orchestration/harness/index.ts:627-696`                                           | `runLoop()` directly用 spread 修改 status (`status: "running"/"aborted"/"completed"/"waiting_hitl"`)，完全bypassing RuntimeStateMachine.transition() |
| `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:180,195,246,251,343` | directly赋值 `delegation.status = "cancelled"` 等，bypassingStatus机                                                                                   |
| `src/platform/five-plane-execution/ha/replay-worker.ts:39-77`                                              | ReplayWorker no ReplaySandboxPolicy 守卫，违反 INV-REPLAY-001（replay 不得产生真实副作用）                                                  |

### 1.2 CRITICAL — 废弃合约作为一等公民export

| 位置                                                        | Issue                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/platform/contracts/execution-plan/index.ts`            | defines `ExecutionPlan` + 线性 `steps: ExecutionPlanStep[]` 作为活跃合约（Architecture要求 deprecated only）                        |
| `src/platform/contracts/control-directive/index.ts`         | defines `ControlDirective` + `createControlDirective()` 工厂（Architecture v4.3 废弃，须用 OperationalDirective/DecisionDirective） |
| `src/platform/contracts/execution-receipt/index.ts`         | defines `ExecutionReceipt` + `stepId` 字段（Architecture要求 NodeAttemptReceipt + nodeRunId/attemptId）                             |
| `src/platform/contracts/types/platform-contracts.ts:70-205` | 完整defines ExecutionPlan/ControlDirective/ExecutionReceipt 接口 + createExecutionPlan() 工厂                               |
| `src/platform/contracts/types/platform-contracts.ts:55-62`  | SideEffectRecord only4Status(proposed/committed/rolled_back/failed)，缺 ambiguous/reconciling/confirming                     |

### 1.3 HIGH — Budget 保护缺失

| 位置                                                            | Issue                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/platform/model-gateway/cost-tracker/budget-guard.ts:51-77` | BudgetGuard is事后检查，非执lines前原子 BudgetReservation，违反 INV-BUDGET-001 |
| `src/interaction/goal-decomposer/index.ts:248-349`              | call LLM 生成计划时no budget reservation                                    |
| `src/interaction/goal-decomposer/llm-plan-generator.ts:39-46`   | LLM complete() callnobudget守卫                                               |
| `src/scale-ecosystem/billing/billing-service.ts:260-277`        | recordUsage 事后记账，no BudgetReservation 前置                             |

### 1.4 CRITICAL — Trust Score bypassingsecurity边界

| 位置                                                          | Issue                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/interaction/autonomy/trust-scorer/index.ts:25-39`        | `mapTrustLevelToAutonomyLevel` 将 fully_trusted directly映射 full_auto，no inherent risk/compliance/sandbox 检查 |
| `src/interaction/autonomy/index.ts:240-248`                   | `decideLevel()` only按success率/量提升 full_auto，不查询固有风险                                                  |
| `src/interaction/autonomy/promotion-engine/index.ts:30-31`    | 500iterations/99%success即提升 full_auto，high/critical 域可被自动提升越过security边界                                      |
| `src/interaction/autonomy/index.ts:252-261`                   | `applyDomainRiskAutonomyCap` 只用hardcodes列table限 high→semi_auto，不查 DomainRiskSpec，critical 域no cap         |
| `src/interaction/proactive-agent/trigger-engine/index.ts:1-9` | high-risk action 在 requireConfirmation=false 时返回 auto_execute（Architecture要求 default deny）                   |

### 1.5 HIGH — Sandbox "none" 档位

| 位置                                                                 | Issue                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/domains/business-pack/business-pack-manifest.ts:73,236`         | SandboxTier 含 "none"（Zod schema 也含）；Architecture只defines4档no none      |
| `src/sdk/plugin-sdk/plugin-definition.ts:26`                         | sandboxTier 含 "none"                                               |
| `src/sdk/plugin-sdk/plugin-context.ts:15`                            | sandboxTier 含 "none"                                               |
| `src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts:19` | sandboxTier 含 "none"/"process"/"container"（非 canonical 4档命名） |

### 1.6 HIGH — 域风险规格缺失

| 位置                                | Issue                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| `src/domains/domain-specs.ts:55-61` | DomainRiskSpecSchema 缺 advisory_only/human_accountable/deterministic_hot_path_only |
| `src/domains/quant-trading/`        | no DomainRiskSpec 声明（high-risk 金融域）                                          |
| `src/domains/financial-services/`   | no DomainRiskSpec 声明                                                              |
| `src/domains/healthcare/`           | no DomainRiskSpec 声明（arch 明确要求 advisory_only）                               |
| `src/domains/legal/`                | no DomainRiskSpec 声明                                                              |

### 1.7 HIGH — Saga no实际补偿

| 位置                                                                                     | Issue                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/org-governance/org-model/org-governance-saga.ts:17-39`                              | execute() 只分class步骤，no prepare→commit→compensate 编排；failedno回滚 |
| `src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts:14-23`                | execute() 返回 rolled_back 但不执lines实际补偿/撤销                    |
| `src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:17-31` | no四阶段(prepare/commit/compensate/audit)语义                       |

### 1.8 MED — 废弃术语在非 legacy code中uses

| 位置                                                                                     | 术语Issue                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/platform/five-plane-state-evidence/events/event-registry.ts:73-109`                            | producer = "workflow_runtime"（应为 HarnessRuntime）      |
| `src/platform/five-plane-state-evidence/events/projections/workflow-timeline-projection.ts:282-398` | 消费 workflow_run.created/failed/completed 事件作为 truth |
| `src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts:114`                 | workflowRunId 在审批record中                                |
| `src/platform/contracts/types/domain/billing-types.ts:124`                               | UsageEventRecord 用 stepId 做成本归因                     |
| `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:20-36`                  | defines WorkflowStep/stepId，线性步骤执lines                    |
| `src/ops-maturity/edge-runtime/edge-orchestrator/index.ts`                               | defines EdgeExecutionPlan（应为 PlanGraphBundle）            |
| `src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts:45`                          | defines EdgeExecutionReceipt（应为 NodeAttemptReceipt）      |
| `src/ops-maturity/platform-ops-agent/platform-ops-agent-service.ts:52`                   | defines OpsExecutionReceipt                                  |
| `src/ops-maturity/workflow-debugger/` (全模块)                                           | based on stepId/workflow_id 构建，no NodeRun/HarnessRun 概念  |
| `src/scale-ecosystem/billing/types.ts:61`                                                | RecordUsageInput 有 stepId 字段                           |
| `src/domains/registry/plugin-spi.ts:8`                                                   | MachineOutput.stepId                                      |
| `src/domains/business-pack/pack-migration-service.ts:24,51,90`                           | Migration plan 全程用 stepId                              |

### 1.9 MED — HarnessRun 接口repeatsdefines且inconsistent

| 位置                                                  | Issue                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/platform/five-plane-orchestration/harness/index.ts:168-198` | 本地 HarnessRun 用 runId（非 harnessRunId），含 sleeping/waiting_hitl/recovering 等非 canonical Status |
| `src/platform/five-plane-orchestration/harness/index.ts:160-166` | 本地 HarnessDecision 缺 decisionInputBundleId/deciderType/deciderRef/reasonCode                      |

### 1.10 MED — 其他

| 位置                                                                        | Issue                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/org-governance/knowledge-boundary/knowledge-boundary-service.ts:48-66` | evaluateAccess no tenantId 参数（Architecture要求租户级隔离）                       |
| `src/org-governance/knowledge-boundary/knowledge-federator.ts:36-82`        | 联邦搜索no租户隔离，only按 orgNodeId 过滤                                     |
| `src/interaction/goal-decomposer/index.ts:248-349`                          | 产出 TaskGraphDraft 但不via HarnessRuntime 路由                              |
| `src/platform/five-plane-orchestration/harness/index.ts` (runLoop)                     | HarnessRun 接口no planGraphBundle 字段，runLoop 不生成/校验 PlanGraphBundle |

---

## 2. Contract 文档 vs Architecture

### 2.1 CRITICAL — storage Schema based on废弃对象

| Contract                             | Issue                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage_schema_contract.md:§15 DDL` | DDL 以 `executions` table为核心 PK，7张table FK 到 execution_id；no harness_runs/plan_graph_bundles/node_runs/node_attempts/budget_ledgers canonical truth table DDL |
| `storage_schema_contract.md:§6`      | workflow_step_outputs 用 step_id TEXT NOT NULL + UNIQUE(task_id, step_id)                                                                                   |
| `storage_schema_contract.md:§5`      | workflow_state 用 current_step_index INTEGER + resumable_from_step TEXT（线性模型）                                                                         |
| `storage_schema_contract.md:§11`     | events table用 execution_id FK，no harness_run_id/node_run_id 列                                                                                               |
| `storage_schema_contract.md:§15`     | node_attempt_receipts PK 用 node_attempt_receipt_id（T-46 已废弃，应为 receiptId）                                                                          |
| `storage_schema_contract.md:§15`     | event_consumer_acks DDL 遗漏 §11 要求的 attempt_count 列                                                                                                    |

### 2.2 CRITICAL — runtime_state_machine_contract 以废弃对象为权威

| Contract                                | Issue                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `runtime_state_machine_contract.md:§6`  | ExecutionStatus 对齐 executions.status，将废弃实体当权威                       |
| `runtime_state_machine_contract.md:§3`  | WorkflowStatus 独立Status机，未标记为 projection-only                            |
| `runtime_state_machine_contract.md:§1`  | 用 "Phase 1a" 限定 scope（应为 Ring 1）                                        |
| `runtime_state_machine_contract.md:§1A` | OAPEFLIR 8-stage state machine 作为 truth-grade Status机（应为 projection-only） |

### 2.3 HIGH — 事件命名空间错误

| Contract                                          | Issue                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `event_bus_contract.md:§6`                        | task.status_changed/workflow.started/workflow.step_completed/workflow.failed 作为 Phase 1a 稳定事件（应为 platform.\* 命名空间） |
| `event_registry_and_ops_threshold_contract.md:§4` | task._/workflow._/execution.\* 注册为 Tier 1 truth 事件                                                                          |
| `event_reliability_matrix_contract.md:§3`         | 同上                                                                                                                             |
| `event_bus_contract.md:§6`                        | oapeflir.observe._/oapeflir.assess._/oapeflir.plan._ 未用 oapeflir.view._ 前缀                                                   |

### 2.4 HIGH — uses废弃 ID 作为 canonical key

| Contract                                             | Issue                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `api_surface_contract.md:§3`                         | GET /executions/:executionId/inspect 用废弃 executionId；no /harness-runs/ 端点 |
| `artifact_unified_model_contract.md:§3.1`            | ArtifactRecord 用 executionId/planId（应为 harnessRunId/planGraphId）           |
| `file_lock_contract.md:§3.1-3.2`                     | FileLockRequest/Record 用 execution_id/holder_execution_id                      |
| `debug_inspect_health_backpressure_contract.md:§3.2` | TaskInspectView 用 workflow_state + executions[]                                |
| `artifact_store_contract.md:§3`                      | ArtifactRecord only task_id，缺 harness_run_id/node_run_id                        |
| `audit_lineage_and_retention_contract.md:§5`         | 用 execution_id，缺 harness_run_id/node_run_id                                  |
| `cost_and_budget_contract.md:§4`                     | CostEvent 用 task_id 为主键，harness_run_id/node_run_id 为 optional             |
| `gateway_message_contract.md:§5`                     | DecisionRequest 用 task_id                                                      |
| `gateway_streaming_contract.md:§3`                   | StreamEvent 用 task_id                                                          |
| `policy_engine_contract.md:§3.1`                     | PolicyDecisionRequest 用 execution_id                                           |
| `runtime_execution_contract.md:§3`                   | ExecutionEnvelope 含 workflow_id                                                |
| `explainability_and_stage_rationale_contract.md:§3`  | StageRationale 用 task_id 为主键                                                |

### 2.5 HIGH — 关键 Contract 缺失 canonical 字段

| Contract                                  | Issue                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `node-run-attempt-receipt-contract.md:§4` | NodeAttemptReceipt 缺 harnessRunId/planGraphBundleId/graphVersion/duration（Architecture§5.3 明确要求） |
| `event_bus_contract.md:§3`                | EventEnvelope 缺 schema_version/idempotency_key/causation_id/partition_key/ttl/payloadHash      |
| `plugin_spi_contract.md:§2.4`             | DomainPresenterPlugin.present() 接收废弃 DualChannelStepOutput 而非 NodeAttemptReceipt          |

### 2.6 HIGH — workflow_debugger_contract 完全based on废弃模型

| Contract                               | Issue                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `workflow_debugger_contract.md` (全文) | 用 workflow_id/step_selector 作为 breakpoint 锚点；no HarnessRun/NodeRun/PlanGraph references用；no v4.3 remediation |

### 2.7 MED — 其他 Contract Issue

| Contract                                              | Issue                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `admin_console_and_human_takeover_contract.md:§4`     | Human takeover 用 step 语义，不要求 RuntimeStateMachine.transition()，no budget reservation |
| `agent_definition_lifecycle_contract.md:§3`           | lifecycle_state 迁移no RuntimeStateMachine enforcement                                      |
| `division_definition_contract.md:§2`                  | default_workflow/orchestration_workflow 作为 canonical reference                            |
| `sla_tier_contract.md`                                | no HarnessRun/NodeRun 集成点，no v4.3 remediation                                           |
| `knowledge_boundary_and_federated_search_contract.md` | FederatedSearchRequest 缺 harnessRunId/nodeRunId 审计链                                     |
| `execution_plane_contract.md:§17`                     | references用non-existent governance_control_plane_contract.md                                           |

---

## 3. ADR vs Architecture

### 3.1 HIGH — ADR definesvsArchitectureconflicts的 canonical 对象

| ADR                               | Issue                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `060-explicit-planning-hub.md`    | defines Plan DTO + PlanStep[] 线性步骤 + RuntimeExecuteBridge.executePlan()；vs PlanGraphBundle 根本conflicts |
| `060:R3 constraints`              | "Execute 层只能接收 Plan DTO"——Architecture要求 P4 只接收 PlanGraphBundle                                     |
| `065-workflow-visual-debugger.md` | 全文用 workflow_id/current_step/WorkflowDAGView/StepInspector（废弃对象）                             |
| `070-conclusion.md:演进路线`      | 用 Phase 1-7 路线图（Architecture明确废弃为历史映射）                                                         |
| `070-conclusion.md:关键不variable`    | "OAPEFLIR 循环不变"作为 key invariant（应为 HarnessRuntime + RuntimeStateMachine）                    |

### 3.2 HIGH — Phase 分期未迁移至 Ring

| ADR                                     | Issue                               |
| --------------------------------------- | ---------------------------------- |
| `033-phased-roadmap.md`                 | defines Phase 1-7 为 canonical 路线图 |
| `003-memory-seven-layers.md`            | MVP 用 Phase 1/2/3/4               |
| `011-effect-ts-adoption.md`             | Phase 1a/1b                        |
| `012-sqlite-phase-1-2-primary-store.md` | Phase 1/2                          |
| `013-eventemitter-phase-2-boundary.md`  | Phase 2                            |
| `075-controlled-rollout-release.md`     | "Phase 1 简化版"                   |
| `080-learn-hub-pattern-detection.md`    | "Phase 1 onlysupported这 3 class"            |
| `096-harness-recovery-controller.md`    | "phase 8b 门禁"                    |

### 3.3 MED — OAPEFLIR 被当作 Runtime

| ADR                                        | Issue                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `072-oapeflir-testing-strategy.md:E2E`     | 把 OAPEFLIR 当可执lines 8 阶段链测试"no阶段被跳过"                       |
| `072:Test 3`                               | "新 Plan 从failed步骤后继续"用废弃 step 术语                            |
| `071-plugin-spi-framework.md:OAPEFLIR关联` | Description OAPEFLIR 为"正式扩展机制"（应为 projection）                     |
| 10+ ADR boilerplate                        | OAPEFLIR Execute Description为"步骤执linesvs Dual-Channel 输出"（应为认知投影） |

### 3.4 MED — 废弃术语作为 canonical

| ADR                                               | Issue                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `019-agent-handoff-four-layer-protocol.md`        | buildFromStepResult(result: StepResult) 用废弃 StepResult/stepId |
| `022-api-contract-and-versioning.md`              | /api/v1/workflow-runs 作为 canonical 端点                        |
| `028-incident-and-event-handling-architecture.md` | Span "service → operation → step"（应为 nodeRun/nodeAttempt）    |
| `079-feedback-hub-signals.md`                     | FeedbackSignal 用 executionId 替代 harnessRunId/nodeRunId        |
| `080-learn-hub-pattern-detection.md`              | EvidenceRef 用 executionId/signalId                              |
| `094-harness-durable-execution.md:OAPEFLIR关联`   | "Execute: 落盘 run、step、decision"用 step 作为 truth 单元       |
| `095-harness-context-assembly.md:OAPEFLIR关联`    | "Execute: 为 Harness step 提供上下文输入"                        |

### 3.5 LOW — SLA 前置条件缺失

| ADR                                     | Issue                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `054-sla-tiered-guarantees.md:platinum` | 提供 99.99% SLA 但未声明自动 failover/quorum/演练证据前置条件 |

---

## 4. OAPEFLIR v4.4 Spec vs 主Architecture

### 4.1 CRITICAL — Spec 自defines全套 Runtime 对象

| 章节                | Issue                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- |
| §3 "总体运linesArchitecture"   | OAPEFLIR 作为vs HarnessRuntime 平lines的 Runtime Overlay，含 "Node Execution Runtime"            |
| §5 "NodeRun Status机" | defines完整 NodeRunStatus enum + transition rules（应属 RuntimeStateMachine 独有）               |
| §5.4 rule 4         | 声称 "由 OAPEFLIR 拥有的节点Status"（OAPEFLIR 不拥有任何 truth Status）                           |
| §7 "PlanGraph 契约" | defines PlanGraphBundle/PlanGraph/PlanNode/PlanEdge 全套 schema（应属 P3→P4 canonical contract） |
| §2.1 Execute stage  | 声称产出 NodeRun / NodeAttemptReceipt（这些is P4 执lines对象，不is OAPEFLIR 输出）               |
| §0 "核心Conclusion"       | 声称 OAPEFLIR defines"什么Status可迁移/什么图可执lines/什么副作用可提交"                              |

### 4.2 HIGH — Spec definesbelongs to其他平面的对象

| 章节                     | Issue                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| §12 "Graph Scheduler"    | defines ReadyNodeSchedulingPolicy class型 + 5条调度规则（属 P4 HarnessRuntime）       |
| §15 "Budget Ledger"      | defines BudgetLedger/BudgetReservation class型（属 P5 BudgetAllocator）               |
| §16 "SideEffect Manager" | defines SideEffectRecord/Status/ExecutionContract/ReversibilityProfile（属 P4/P5） |
| §17 "Reconciliation"     | defines ReconciliationRecord/Status（属 P5）                                       |

### 4.3 MED — 其他conflicts

| 章节                    | Issue                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| §34 Error Code          | OapeflirError class型（Architecture前缀为 PLATFORM.{plane}.{component}.{category}）   |
| §37 Capability Matrix   | Core/Durable/Governed/Enterprise/Learning 分级（不对齐 Ring 1/2/3）        |
| §41 ADR                 | 18个 ADR-OAPEFLIR-\* 前缀（暗示 OAPEFLIR 独立权威域）                      |
| §14.1 OapeflirEvent     | 独立 event envelope class型（可能被当作 truth source，违反 invariant）        |
| §20 LLM Decision Record | isolated_reexecution_replay 作为 first-class mode（Architecturedefaults to trace replay） |
| §Title                  | "Executable Specification"（vs "only作为迁移输入" 定位conflicts）                 |

---

## 5. Config / Bootstrap vs Architecture

### 5.1 CRITICAL — 域configure用废弃 Phase + 缺风险规格

| 文件                                  | Issue                                           |
| ------------------------------------- | ---------------------------------------------- |
| `config/domains/quant-trading.json:7` | "phase": "9b"（应为 Ring）                     |
| `config/domains/healthcare.json:3`    | "phase": "9e"（应为 Ring）                     |
| `config/domains/quant-trading.json`   | 缺 riskProfile/riskSpec 块（high-risk 金融域） |
| `config/domains/healthcare.json`      | 缺 riskProfile/riskSpec 块（critical-risk 域） |

### 5.2 HIGH — Bootstrap / Catalog 用废弃分期

| 文件                                   | Issue                                                    |
| -------------------------------------- | ------------------------------------------------------- |
| `src/domains-runtime-catalog.ts:12-17` | phase9a-phase9f 命名                                    |
| `src/domains-startup-plan.ts:27`       | DOMAIN_PHASES 用 "9a"-"9f"                              |
| `src/index.ts:49-54`                   | PlatformRootSummary.capabilityCounts 用 phase9a-phase9f |

### 5.3 HIGH — Five-Plane结构不完整

| 文件                                         | Issue                                                |
| -------------------------------------------- | --------------------------------------------------- |
| `src/platform/five-plane-startup-plan.ts:29` | FivePlaneStartupStepId 只defines P1-P5，缺 X1 横切平面 |
| `src/platform-architecture-bootstrap.ts`     | no显式 P1-P5 + X1 平面标识                          |

### 7. AI 运营层code vs Architecture（§15-§23）

| #     | 严重度   | code位置                                         | Issue                                                                                                |
| ----- | -------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| R2-1  | CRITICAL | model-gateway/unified-chat-provider.ts           | ChatCompletionRequest 缺 traceId/tenantId/costTag 必填字段，Architecture §15.2 明确要求                     |
| R2-2  | CRITICAL | model-gateway/unified-chat-provider.ts stream()  | no AbortSignal / 增量budget扣减 / partial response validation，Architecture §15.4 要求流式budget实时控制        |
| R2-3  | CRITICAL | prompt-engine/prompt-injection-guard.ts          | PromptInjectionDefenseChain 为单层正则，noArchitecture §20.3 要求的多层链编排器(regex→classifier→LLM judge) |
| R2-4  | CRITICAL | prompt-engine/eval/                              | EvalDataset no按风险级别最小样本数校验，Architecture §21.5 要求 critical≥200/high≥100/medium≥50             |
| R2-5  | CRITICAL | plugins/builtin-plugin-registry.ts               | 插件系统no DataTaintPropagation 追踪，Architecture §23.4 要求跨插件data污染标记传递                         |
| R2-6  | HIGH     | model-gateway/cost-tracker/budget-guard.ts       | BudgetPolicy onlysupported task 级budget，缺Architecture §18 要求的 platform/pack/step 三级budget层iterations                  |
| R2-7  | HIGH     | model-gateway/cost-tracker/chargeback-service.ts | ChargebackAllocation 缺 fx_rate/cost_source 字段，Architecture §18.7 要求多币种归因                         |
| R2-8  | HIGH     | prompt-engine/registry/                          | Prompt lifecycle 缺 deprecated 阶段，Architecture §20.6 defines draft→active→deprecated→archived 四阶段        |
| R2-9  | HIGH     | plugins/builtin-plugin-registry.ts               | no BundleRevocationSeverity 机制，Architecture §23.6 要求插件撤回严重度分级                                 |
| R2-10 | HIGH     | prompt-engine/eval/                              | LLM-as-Judge no按风险级别独立性mandatory（高风险需外部独立评审），Architecture §21.7 明确要求                    |
| R2-11 | HIGH     | plugins/ PluginContext                           | no call_depth/delegation_depth 追踪，Architecture §23.2 要求防止插件no限递归委托                            |
| R2-12 | HIGH     | prompt-engine/eval/                              | critical_case_pass==100% 只加 finding 不阻断发布，Architecture §21.5 要求作为硬门禁                         |

### 8. 剩余 Contract vs Architecture

| #     | 严重度 | 文件                                                    | Issue                                                                                                                                      |
| ----- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R2-13 | HIGH   | runtime_state_machine_contract.md                       | §6 ExecutionStatus 8态机vsArchitecture §25.8 NodeRun 14态生命cycleconflicts，缺 admitted/planning/ready/pausing/replanning/compensating                 |
| R2-14 | HIGH   | runtime_state_machine_contract.md                       | §3 WorkflowStatus 7态缺Architecture 13态 HarnessRun 的 created/admitted/planning/ready/pausing/replanning/compensating/aborted                    |
| R2-15 | HIGH   | cost_and_budget_contract.md                             | §4 CostEvent 以 task_id 为必填但 harness_run_id 为optional，Architecture §18 以 HarnessRun 为budget主体                                                 |
| R2-16 | HIGH   | cost_and_budget_contract.md                             | §7.4 隐式成本归属仍用废弃 execution_id，应为 node_run_id/attempt_id                                                                       |
| R2-17 | MEDIUM | cost_and_budget_contract.md                             | §4 CostEvent 缺 budget_reservation_id，Architecture §18.3 要求 reserve-before-execute 链接                                                        |
| R2-18 | MEDIUM | task_and_workflow_contract.md                           | §6-§7 WorkflowStep/StepOutput 以 step_id 为主键，应为 node_run_id                                                                         |
| R2-19 | MEDIUM | policy_engine_contract.md                               | §3.1 PolicyDecisionRequest 用废弃 execution_id                                                                                            |
| R2-20 | MEDIUM | execution_plane_contract.md                             | §8 ExecutionTicket isolation_level 用废弃 standard/hardened/strict，应为 read_only/workspace_write/scoped_external_access/restricted_exec |
| R2-21 | MEDIUM | model_gateway_routing_contract.md                       | ModelRouteRequest 缺 harness_run_id/node_run_id，no法满足 INV-BUDGET-001 budget门禁                                                         |
| R2-22 | MEDIUM | observability_contract.md                               | §3 LogEvent 缺 harness_run_id/node_run_id 必填字段                                                                                        |
| R2-23 | LOW    | plugin_spi_contract.md vs tool_skill_plugin_contract.md | 生命cycle钩子命名互相矛盾（initialize/activate vs onLoad/onActivate）                                                                      |
| R2-24 | MEDIUM | runtime_state_machine_contract.md                       | 用 ExecutionStatus 名称而非 canonical NodeRun.status                                                                                      |

### 9. Architecture文档内部一致性

| #     | 严重度 | 位置            | Issue                                                                       |
| ----- | ------ | --------------- | -------------------------------------------------------------------------- |
| R2-25 | HIGH   | §45.13 vs §25.8 | HarnessRun Status数矛盾：§45.13 defines 6态，§25.8 defines 13态                    |
| R2-26 | HIGH   | §45.13 vs §58.6 | finalDecision 取值矛盾：§45.13 允许 4值，§58.6 HarnessDecision 列出 6值    |
| R2-27 | HIGH   | §58.6           | 标题称"六种裁决"但table格实际列出 10种，自相矛盾                              |
| R2-28 | MEDIUM | §45.7 vs §58.6  | LoopController Decisionclass型：§45.7 列 5种，§58.6 要求 6种（缺 downgrade_mode） |
| R2-29 | MEDIUM | §45.9           | Generator WorkProduct 仍用废弃 step_id 字段                                |
| R2-30 | MEDIUM | §59.2           | ExplanationRequest 用废弃 workflow_id/step_id                              |
| R2-31 | MEDIUM | §35             | contracts/ 目录结构含废弃命名子目录（execution-plan/、workflow-run/）      |
| R2-32 | LOW    | §36.3           | 仍用 Phase 1-9 作为 canonical success标准，vs Ring 1/2/3 体系矛盾             |


### 11. Harness Runtime 深层实现缺口（§45）

| #     | 严重度   | 文件                                         | Issue                                                                                                                                    |
| ----- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-1  | CRITICAL | orchestration/harness/guardrail-engine.ts    | 护栏only policy/risk/tool/evidence/budget 5层；§45.20 要求 Input(注入防御)/Planning/Tool/Memory/Output 五层——Input 和 Memory 护栏完全缺失 |
| R3-2  | CRITICAL | orchestration/harness/hitl-runtime.ts        | onlysupported open/resolve(approve/reject)；§45.18 要求 5种 HITL：Inspect/Patch/Override/Takeover/Resume 含完整Status机                          |
| R3-3  | CRITICAL | orchestration/harness/index.ts               | HumanResponsibilityRecord(§45.27) 未实现——每iterations HITL 操作需产出 actor/action/scope/rationale/beforeRef/afterRef/expiresAt/auditRef       |
| R3-4  | HIGH     | orchestration/harness/index.ts               | autonomyMode 用 manual/supervised/auto/full_auto；§42.1 要求 suggestion/supervised/semi_auto/full_auto                                  |
| R3-5  | HIGH     | orchestration/harness/index.ts               | HarnessRun 缺 §45.13 要求的 tenantId/goal/mode/riskLevel/ownership/auditRefs/traceId 7字段                                              |
| R3-6  | HIGH     | orchestration/harness/index.ts               | HarnessStep 缺 §45.13 要求的 nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction 8字段                           |
| R3-7  | HIGH     | orchestration/harness/index.ts               | HarnessDecision only 6值；§58.6 要求追加 quarantine/revoke_approval/pause_for_external/require_revalidation                               |
| R3-8  | HIGH     | orchestration/harness/toolbelt-assembler.ts  | only做 allowed/blocked 集合交集；§45.4 要求 6步装配：domain→constraint→risk→budget→security→reliability                                   |
| R3-9  | HIGH     | orchestration/harness/recovery-controller.ts | onlyhandle 3种故障；§45.11 要求 5种含 llm_provider_unavailable/budget_exhausted/platform_panic                                              |
| R3-10 | HIGH     | orchestration/harness/memory-manager.ts      | 命名空间 run/domain/shared no治理；§45.16 要求 Working/Long-term/Shared 含晋升/降级策略+防自我强化                                      |
| R3-11 | HIGH     | orchestration/harness/index.ts               | assertInvariants only检查 budget/state；§45.21 defines 10项不variable（INV-1~INV-10）均未mandatory                                                    |
| R3-12 | HIGH     | orchestration/harness/index.ts               | PromptExecutionRecord(§45.24) 未实现——需冻结 promptVersion/modelRoute/inputHash/outputHash/contextSnapshotRef/guardrailResult/usage     |
| R3-13 | HIGH     | orchestration/harness/index.ts               | DecisionInputBundle(§45.25) 未实现——Decision前需冻结 evaluator/policy/budget/risk/node/sideEffect/hitl/guardrail Status                       |
| R3-14 | MEDIUM   | orchestration/harness/context-assembler.ts   | directly复制源对象；§45.5 要求 token budget trimming + relevance scoring + freshness scoring + trust filtering                              |
| R3-15 | MEDIUM   | orchestration/harness/index.ts               | ContextAssemblyContract(§45.23) 未实现——需 per-role context 隔离含 taintPolicy/rankingPolicy/redactionPolicy                            |

### 12. 组织治理 + 规模生态深层缺口（§46-§57）

| #     | 严重度   | 文件                                                          | Issue                                                                                                                                                                    |
| ----- | -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-16 | CRITICAL | scale-ecosystem/multi-region/region-router/                   | RegionDescriptor 缺 provider/endpoints/dataResidencyPolicy；status 用 active/degraded/disabled 而非Architecture要求 active/standby/draining                                     |
| R3-17 | CRITICAL | scale-ecosystem/multi-region/failover-controller/             | no fencing epoch；§52.3 要求 failover 提升 epoch，旧 leader 恢复后只能 follower 加入                                                                                    |
| R3-18 | CRITICAL | scale-ecosystem/integration/connector-registry/               | ConnectorManifest 缺整个 ConnectorCapabilityProfile(§57.1)：actionRiskProfiles/permissionProbes/quotaProbes/credentialRotationPolicy                                    |
| R3-19 | HIGH     | scale-ecosystem/sla-engine/tier-resolver/                     | SlaTierSchema 缺 §54.1 要求的 availability/externalP95/internalP99/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel                                   |
| R3-20 | HIGH     | scale-ecosystem/sla-engine/sla-operations-service.ts          | no按 workflow class 拆分 SLA（§54.3 要求 deterministic/LLM-assisted/HITL-waiting 分别承诺）                                                                             |
| R3-21 | HIGH     | scale-ecosystem/marketplace/catalog/                          | 用 listingId 代替 §55.2 entryId，缺 packId/rating/installCount；certificationStatus 枚举不匹配                                                                          |
| R3-22 | HIGH     | org-governance/compliance-engine/framework-catalog.ts         | auditRequirements is string[] 而非 §49.1 要求的 AuditSpec[]（含 frequency/evidenceType/retentionPeriod）                                                                |
| R3-23 | HIGH     | org-governance/compliance-engine/inheritance/                 | no PolicyStrictnessComparator(§49.2)；不可比策略静默 fallback 到 Math.min 而非进入合规审批                                                                              |
| R3-24 | HIGH     | org-governance/approval-routing/route-engine/                 | applySodPolicy 未阻止同链互批(§47.1)——同一审批链两人可互相审批对方request                                                                                                  |
| R3-25 | HIGH     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts | 缺 §50.3 两阶段提交（prepare lock→atomic commit→failure reconciliation）；only做简单 pass/fail 分class                                                                       |
| R3-26 | HIGH     | scale-ecosystem/resource-manager/quota-enforcer/              | QuotaPolicy 单维度；§53.2 要求 7维 MultiResourceQuotaVector（worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io）全部via才准入 |
| R3-27 | MEDIUM   | org-governance/delegated-governance/                          | GovernanceDelegationRevocationSaga 缺级联范围(§51.1)：需覆盖 pending approval/active session/secret lease/worker lease/scheduled trigger                                |
| R3-28 | MEDIUM   | org-governance/org-model/org-governance-saga.ts               | §46.3 要求 commit 固定序(identity→approval→budget→domain→agent)含 OrgGovernanceSagaReceipt；实际no序no receipt                                                          |
| R3-29 | MEDIUM   | org-governance/sso-scim/identity-sync-service.ts              | DLQ onlyrecordno重试；§48.2 要求 retry/backoff + 每日对账 + IdentityReconciliationReport                                                                                    |
| R3-30 | MEDIUM   | scale-ecosystem/multi-region/cross-region-routing-service.ts  | 跨境传输only boolean allowCrossBorder；§52.4 要求 5步链：JurisdictionClassifier→TransferImpactAssessor→MechanismSelector→DataMinimizer→OutputScanner                      |
| R3-31 | MEDIUM   | scale-ecosystem/billing/types.ts                              | RecordUsageInput 单 metricType；§53.2 要求多维准入守卫                                                                                                                  |
| R3-32 | MEDIUM   | org-governance/knowledge-boundary/sharing-gate/               | evaluateKnowledgeShare 返回 boolean；§50.3 要求via CrossBoundaryTransform（脱敏/摘要/字段过滤）                                                                          |

### 13. 运维成熟度 + SDK 缺口（§51-§69）

| #     | 严重度 | 文件                                                        | Issue                                                                                                                                    |
| ----- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R3-33 | HIGH   | ops-maturity/explainability/explanation-pipeline-service.ts | StageRationale 缺 §59.3 的 rationaleId/alternatives/confidence/decisionInputRef/versionLockRef/visibilityLabels/renderedExplanation     |
| R3-34 | HIGH   | ops-maturity/emergency/platform-panic-service.ts            | PlatformPanicDirective 缺 §60.1 severity(full/partial)/reconfirmationAfterSeconds/rollbackStrategy                                      |
| R3-35 | HIGH   | ops-maturity/agent-lifecycle/agent-registry/                | AgentLifecycleState 缺 removed 态(§61.3 要求9态)；transitions 缺 archived→removed 和 paused→canary                                      |
| R3-36 | HIGH   | ops-maturity/edge-runtime/edge-runtime-sync-service.ts      | EdgeRuntimeProfile 缺 §62.2 deviceId/offlineMaxDuration/keyLease/risk_level≤medium 门禁                                                 |
| R3-37 | HIGH   | ops-maturity/edge-runtime/sync-queue/                       | EdgeSyncEnvelope 缺 §62.3 device_id/sequence_no/prev_hash/side_effect_dependency_refs/signature/local_time_offset                       |
| R3-38 | HIGH   | sdk/client-sdk/api-client.ts                                | 未发送 §22.2 要求的 X-Platform-Version/X-SDK-Version/X-Contract-Version 版本握手头                                                      |
| R3-39 | HIGH   | sdk/cli/index.ts                                            | 缺 §22.3 要求的 pack create/test/validate/publish CLI 命令                                                                              |
| R3-40 | MEDIUM | ops-maturity/edge-runtime/                                  | conflicts解决含 accept_edge；§62.3 要求 central wins + 生成 Incident 人工审查                                                                |
| R3-41 | MEDIUM | sdk/pack-sdk/pack-manifest.ts                               | BusinessPackManifest 缺 §22.2 sdk_semver/platform_min_version/platform_max_version/contract_test_generator                              |
| R3-42 | MEDIUM | ops-maturity/cost-optimizer/                                | CostAttributionRecord 用单一 amountUsd；§64.1 要求 7维分解(llm/tool/compute/storage/egress/humanReview/total)                           |
| R3-43 | MEDIUM | ops-maturity/compliance-reporter/                           | 缺 ControlCoverageReport + GapAnalyzer(§66.2)；evidence-to-control mapping 缺 controlId/freshness/owner/exception                       |
| R3-44 | MEDIUM | ops-maturity/chaos/                                         | 缺 PanicDrillReport(§60.4)：ingress_block_time/execution_quiescence_time/plane_ack_success_rate 等                                      |
| R3-45 | MEDIUM | ops-maturity/multimodal/                                    | MultimodalInputPart 缺 §68.2 provenance(C2PA/watermark/hash/license)/artifactRef；SafetyFinding 缺 confidence/policyDecision/appealPath |
| R3-46 | MEDIUM | ops-maturity/drift-detection/cross-agent-analyzer/          | 不产出 CrossAgentDriftAlert(§63.4)；缺 alert severity + anti-gaming 区分                                                                |
| R3-47 | MEDIUM | ops-maturity/platform-ops-agent/                            | OpsAgentDefinition 缺 §69.1 ops_data_boundary 声明（only平台指标/日志/configure，禁止业务 payload）                                            |
| R3-48 | LOW    | ops-maturity/capacity-planner/                              | failoverReservePercent hardcodes 15%；§67.2 要求按 SLA tier dynamically N+1                                                                       |
| R3-49 | LOW    | sdk/harness-sdk/                                            | 缺 traceReplay/sideEffectReconciliation 方法(§22)                                                                                       |
| R3-50 | LOW    | sdk/admin-sdk/                                              | 缺 triggerPanic/resumePanic/manageAgentLifecycle/rotateSecrets(§22.1)                                                                   |

### 14. ADR vsArchitecture矛盾（新发现）

| #     | 严重度 | ADR     | Issue                                                                                                                                                 |
| ----- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-51 | HIGH   | ADR-060 | defines Plan DTO + RuntimeExecuteBridge 作为 P3→P4 contract；§5.3/INV-GRAPH-001 要求 PlanGraphBundle 为唯一 canonical P3→P4 交接物                      |
| R3-52 | HIGH   | ADR-061 | 生命cycle 6态(draft/testing/staging/production/deprecated/retired)；§61.3 要求 9态，缺 canary/active/paused/archived/removed，多出 production/retired |
| R3-53 | HIGH   | ADR-054 | Platinum 承诺 99.99%；§54.2 限定 99.95%（99.99% only在专用部署档单独承诺）                                                                             |
| R3-54 | HIGH   | ADR-042 | 自治等级 supervised/assisted/partial_auto/high_auto/full_auto(5级)；§42.1 only suggestion/supervised/semi_auto/full_auto(4级)                          |
| R3-55 | HIGH   | ADR-083 | 又一套自治命名 manual_only/suggest_only/supervised_execute/trusted_auto_execute——第三套互不兼容                                                      |
| R3-56 | MEDIUM | ADR-058 | GlobalCircuitBreaker.open_duration_ms 隐含 TTL 自动解除；§60.3 明确禁止 Panic TTL 自动解除，恢复需人工双人确认                                       |
| R3-57 | MEDIUM | ADR-022 | 暴露 /api/v1/workflow-runs 为 canonical API；§5.5 声明 workflow_run only为 query projection                                                            |
| R3-58 | MEDIUM | ADR-065 | 用 WorkflowDAGView/StepInspector 全为废弃概念，no v4.3 remediation                                                                                   |
| R3-59 | MEDIUM | ADR-040 | goal decomposition MAX_DEPTH=5 未references用globally call_depth 硬帽=8 及反乘法规则(§19.2)                                                                      |
| R3-60 | MEDIUM | ADR-062 | 边缘synchronous列 last_write_wins 为合法策略；§25.11 真相data要求单主writes，LWW 违反不variable                                                                   |
| R3-61 | MEDIUM | ADR-060 | references用 §L.6/§H.2 节——Architecture v4.3 no此节号，cross-ref 失效                                                                                                |
| R3-62 | LOW    | ADR-003 | 标题"六层"文件名"seven-layers"实际Architecture和 ADR-020 均为六层——命名全面混乱                                                                              |
| R3-63 | LOW    | ADR-075 | ImprovementCandidate 12态机noArchitecture支撑；§56.4 LearningCandidate only quarantine/approved/rejected/released                                              |
| R3-64 | LOW    | ADR-019 | 声称源节 §12 "Agent Handoff"；实际 §12 is"异常事件handleArchitecture"——section ref 错误                                                                        |

### 15. 剩余 Contract 深层缺口

| #     | 严重度 | 文件                                               | Issue                                                                                                                                                |
| ----- | ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| R3-65 | HIGH   | typed_event_bus_contract.md                        | OAPEFLIR 事件 payload 全部用 task_id/workflow_id/execution_id；§5.5 要求 harnessRunId/nodeRunId/planGraphId                                         |
| R3-66 | HIGH   | typed_event_bus_contract.md                        | PlanCreatedPayload 用 step_count 暗示线性步骤；§5 要求 PlanGraph(图结构)                                                                            |
| R3-67 | HIGH   | typed_event_bus_contract.md                        | ExecutionCompletedPayload defines execution_id/outcome/output_refs 为执lines结果模型；vs §5 NodeAttemptReceipt(receiptId/nodeRunId/attemptId/status) conflicts |
| R3-68 | HIGH   | explainability_and_stage_rationale_contract.md     | StageRationale only 7字段；§59.3 要求 11字段(缺 rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives)                 |
| R3-69 | HIGH   | workflow_debugger_contract.md                      | BreakpointDefinition 用 workflow_id/step_selector；§5.5 应为 harnessRunId/nodeRunId                                                                 |
| R3-70 | HIGH   | startup_consistency_and_recovery_drill_contract.md | 一致性矩阵用 current_step_index/workflow_state；应为 HarnessRun.status/NodeRun.status/PlanGraph                                                     |
| R3-71 | MEDIUM | budget-ledger-contract.md                          | BudgetReservation.resourceKind 枚举缺 §18 要求的 storage/bandwidth/memory                                                                           |
| R3-72 | MEDIUM | naming_and_engineering_boundary_contract.md        | §2 列 WorkflowExecutor 为 canonical 工程名；§5 canonical 入口为 HarnessRuntime                                                                      |
| R3-73 | MEDIUM | admin_console_and_human_takeover_contract.md       | takeover 操作用步骤语言(修改下一步/跳过某步/重试某步)；§5.5 操作粒度为 NodeRun                                                                      |
| R3-74 | MEDIUM | nl_entry_and_goal_decomposition_contract.md        | IntentParseResult 含 suggested_workflow_id；§5 所有执lines为 HarnessRun，NL 应Recommendation domain/pack/recipe                                                  |
| R3-75 | MEDIUM | typed_event_bus_contract.md                        | OAPEFLIR payload 缺 derivedFromEventId；event-envelope-contract §4 要求声明 derivation source                                                       |
| R3-76 | MEDIUM | governance_control_plane_contract.md               | §15A release_transition_gate 值 off/suggest/shadow vs §61.3 lifecycle 9态不映射                                                                     |
| R3-77 | MEDIUM | explainability_and_stage_rationale_contract.md     | ExplanationDepth 用 brief/standard/audit；§59.4 要求 L1 Summary/L2 Reasoning/L3 Forensic                                                            |
| R3-78 | LOW    | typed_event_bus_contract.md                        | ReplanTriggeredPayload 用 old_version/new_version 未references用 GraphPatch(baseGraphVersion→newGraphVersion)                                               |
| R3-79 | LOW    | capacity_planning_contract.md                      | 缺 CapacityAlert 输出对象(§67.2 要求 forecast exceedsthreshold时产出)                                                                                         |
| R3-80 | LOW    | explainability_and_stage_rationale_contract.md     | no remediation section；未references用 §59 "解释不can be tampered纳入 Evidence Plane" + "解释必须 permission-aware" 

### 17. Platform Contracts 层根本性Issue

| #     | 严重度   | 文件                                           | Issue                                                                                                                                                   |
| ----- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R4-1  | CRITICAL | platform/contracts/control-directive/          | ControlDirective 仍作为第一级export活跃消费；§5.2 明确废弃，canonical 替代 OperationalDirective/DecisionDirective 全code库don't exist                         |
| R4-2  | CRITICAL | platform/contracts/execution-plan/             | ExecutionPlan uses linear steps[] 作为活跃 contract；§5.3 禁止线性步骤，PlanGraphBundle(graph nodes/edges) 为唯一 P3→P4 交接物                              |
| R4-3  | CRITICAL | platform/contracts/execution-receipt/          | ExecutionReceipt 以 stepId 为主键仍为活跃 contract；§5.5 canonical 为 NodeAttemptReceipt(nodeRunId+attemptId)                                          |
| R4-4  | CRITICAL | platform/contracts/types/platform-contracts.ts | 同文件含第二份 ExecutionPlan + ExecutionReceipt + ControlDirective defines——两套废弃 contract 并lines存在                                                    |
| R4-5  | CRITICAL | platform/five-plane-\*/                        | Architecture §4 要求Five-Plane目录(P1-P5)，**实际no five-plane-\* 目录**——平面分离在结构上不可mandatory                                                                 |
| R4-6  | HIGH     | platform/contracts/executable-contracts/       | NodeAttemptReceipt 缺 harnessRunId/planGraphId/graphVersion/duration/error_detail(§5.3 必填)                                                           |
| R4-7  | HIGH     | platform/contracts/request-envelope/           | RequestEnvelope 缺 confirmedTaskSpecId/principal(typed)/idempotencyKey/priority(§5.3 intake pipeline)                                                  |
| R4-8  | HIGH     | platform/contracts/state-command/              | StateCommand no leaseId/fencingToken/event/principal——no法满足 INV-STATE-001                                                                           |
| R4-9  | HIGH     | platform/contracts/                            | 缺 EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand 三个 §5.3 inter-plane 契约模块                                                           |
| R4-10 | HIGH     | platform/contracts/types/platform-contracts.ts | SideEffectRecord only 4态(proposed/committed/rolled_back/failed)；executable-contracts defines 16态——两套conflicts共存                                           |
| R4-11 | MEDIUM   | platform/contracts/executable-contracts/       | LEGACY_CONTRACT_NAMES 列tablenomandatory机制——no deprecation warning/re-export guard/CI lint 阻止新codeimport废弃模块                                            |
| R4-12 | MEDIUM   | platform/contracts/index.ts                    | Barrel export优先废弃class型(requestEnvelopeContract)而非 executable-contracts——激励消费废弃接口                                                            |
| R4-13 | MEDIUM   | platform/contracts/executable-contracts/       | EventEnvelope 缺必填 runId(§28.1)；replayBehavior 为 optional(§28.1 要求 explicitly declared)；eventVersion 为 string 而非 §28.1 numeric schemaVersion |
| R4-14 | MEDIUM   | platform/five-plane-control-plane/                        | P2 模块no任何 OperationalDirective/DecisionDirective 发射或消费——P2→P3/P4 治理门禁结构性缺失                                                           |

### 18. Execution + State-Evidence 平面缺口（§13-§14）

| #     | 严重度 | 文件                                                   | Issue                                                                                                                          |
| ----- | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R4-15 | HIGH   | execution/state-transition/transition-service.ts       | 并lines legacy TransitionService directly操作 task/workflow/session/execution Status，完全bypassing RuntimeStateMachine——INV-STATE-001 旁路 |
| R4-16 | HIGH   | execution/runtime-state-machine.ts                     | RuntimeTransitionCommand 缺 commandId(UUID)/entityType/entityId/principal(§5.3 必填)                                          |
| R4-17 | HIGH   | execution/recovery/                                    | no RecoveryCadence/RecoveryReport class型；§14.7 要求每个 Recovery Worker 声明检查间隔+产出报告                                  |
| R4-18 | HIGH   | state-evidence/checkpoints/workflow-step-checkpoint.ts | Checkpoint 用 stepId/workflowId/executionId 而非 harnessRunId/nodeRunId/planGraphId                                           |
| R4-19 | MEDIUM | execution/state-transition/state-transition-machine.ts | 允许 no-op transition(current==next 静默返回)；RuntimeStateMachine 明确拒绝——两套机器lines为矛盾                                 |
| R4-20 | MEDIUM | execution/recovery/replay-boundary-guard.ts            | only实现 trace_replay/reexecution_replay 两种模式；§28.5 defines三种含 projection_replay                                           |
| R4-21 | MEDIUM | execution/run-termination-cleanup.ts                   | 始终返回 complete:true no实际清理；§14.10 要求发射 cleanup_completed/cleanup_failed 事件                                      |
| R4-22 | MEDIUM | execution/run-termination-cleanup.ts                   | CleanupResourceKind 缺 callback class型(§14.10 清理序列含"cancel pending callbacks")                                             |
| R4-23 | MEDIUM | execution/budget-allocator.ts                          | reserve() 不via RuntimeStateMachine.transition()；§25.9 budget变更需同 CAS+event 事务路径                                        |
| R4-24 | MEDIUM | execution/queue/bounded-dispatch-event.ts              | BoundedDispatchEvent 缺 nodeRunId/tenantId/traceId/ordering_policy_version/queue_class(§14.9)                                 |

### 19. 核心不variable未mandatory执lines（最严重系统性Issue）

| #     | 严重度   | 不variable                                               | 旁路证据                                                                                                                                                                              |
| ----- | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-25 | CRITICAL | INV-BUDGET-001 reserve-before-execute                | single-task-happy-path 和 multi-step-agent-round-loop 所有 LLM/Tool callno BudgetReservation；BudgetAllocator.reserve() exists but从未在执lines路径call；only AdmissionController 做粗粒度估算 |
| R4-26 | CRITICAL | INV-GRAPH-001 PlanGraphBundle 为唯一 P3→P4 contract  | 实际执lines路径(single-task-happy-path/multi-step-orchestration) 创建 TaskRecord+WorkflowState+线性步骤directly执lines，no PlanGraphBundle；RuntimeEntryGuard exists but从未被call                  |
| R4-27 | CRITICAL | INV-RUN-001 HarnessRuntime 唯一执lines入口              | 两个主执lines路径均不创建 HarnessRun；用 legacy TaskRecord/ExecutionRecord directly执lines；RuntimeEntryGuard 未接入任何 dispatch 路径                                                          |
| R4-28 | CRITICAL | INV-STATE-001 Truth mutation 必须同事务 append event | single-task-happy-path 插入 task/workflow/execution 不 append PlatformFactEvent；用 legacy TransitionService 而非 RuntimeStateMachine                                                 |
| R4-29 | CRITICAL | INV-REPLAY-001 Replay 禁止产生真实副作用             | ReplayWorker 委托 replayService 但不call ReplayBoundaryGuard；no ReplaySandboxPolicy 实现                                                                                             |
| R4-30 | HIGH     | INV-FENCING fencing token on state writes            | RuntimeStateMachine.assertLeaseAndFencing() only检查 NodeRun；HarnessRun/SideEffectRecord/BudgetLedger 跳过 fencing；legacy 路径完全bypassing                                                |
| R4-31 | HIGH     | INV-SANDBOX no sandbox 不执lines                        | executeToolCall()/executeAgentRoundLoop() no sandbox policy 检查；todo_write hardcodes空策略 {allow:[],deny:[]} 从不 enforce                                                             |
| R4-32 | HIGH     | INV-APPROVAL risk-proportional approval              | single-task-happy-path hardcodes requiresApproval:0；multi-step-supervisor 同；PolicyEngine 未接入执lines路径                                                                               |
| R4-33 | HIGH     | INV-SIDEEFFECT-001 ambiguous→reconciliation          | no执lines路径创建 SideEffectRecord；web_fetch/web_search 产生真实副作用但未record/追踪/调和                                                                                                |
| R4-34 | HIGH     | INV-POLICY-001 deny-by-default                       | executeToolCall 用hardcodes switch-case dispatch，no PolicyEngine/CapabilityGate 前置检查                                                                                                |
| R4-35 | HIGH     | All decisions→immutable evidence                     | LLM call和 tool 执lines不产出 EvidenceRecord/DecisionInputBundle/HarnessDecision                                                                                                         |
| R4-36 | MEDIUM   | INV-SINGLE-LEADER                                    | 主执lines路径directly SQLite store.\* writesno leader check；HACoordinator 未接入                                                                                                              |

### 20. security/可观测/错误handle跨切面

| #     | 严重度   | 文件/领域                                           | Issue                                                                               |
| ----- | -------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| R4-37 | CRITICAL | control-plane/iam/network-egress-policy.ts          | defaults to mode="audit_only"——egress 违规only日志不阻断(§11.5 要求 deny 为正式security事件)    |
| R4-38 | CRITICAL | interaction/dashboard/dashboard-websocket-server.ts | registerClient() no鉴权/no tenantId/no principal(§11.1 要求所有操作关联 principal) |
| R4-39 | HIGH     | 全 src/                                             | DataTaintPropagation(§11.6) 零实现——taint_label 从不出现在code中                   |
| R4-40 | HIGH     | model-gateway/unified-chat-provider.ts              | LLM callno principal/tenantId/audit/PolicyOutcome(§11.1-11.2)                      |
| R4-41 | HIGH     | model-gateway/circuit-breaker.ts                    | Status变更only写日志不发 event bus 事件(§9.4)                                          |
| R4-42 | HIGH     | shared/observability/runtime-metrics-registry.ts    | 10+ canonical harness.\* 指标only 1个被record(§12.4)                                   |
| R4-43 | HIGH     | shared/observability/structured-logger.ts           | 缺 crosscutting_fabric 字段(§12.4 要求 reliability/security/governance 分class)       |
| R4-44 | HIGH     | execution/plugin-executor/adapter-executor.ts       | retry 用固定delayno exponential backoff no jitter no幂等检查(§9.3)                  |
| R4-45 | MEDIUM   | interaction/ux/conversation-history-service.ts      | tenant 隔离relies on后置 client-side filter 而非查询级隔离(§9.1)                        |
| R4-46 | MEDIUM   | model-gateway/unified-chat-provider.ts              | createChatCompletion 不传播 traceId/spanId(§12.7 断链)                             |
| R4-47 | MEDIUM   | model-gateway/degradation-controller.ts             | 降级切换不发 OperationalDirective 不vs mode 合成链交互(§9.5)                       |
| R4-48 | MEDIUM   | execution/plugin-executor/adapter-executor.ts       | retry 耗尽静默返回 error no incident/DLQ/error_code(§12.1)                         |
| R4-49 | LOW      | model-gateway/circuit-breaker.ts                    | failure rate 公式nosuccess数分母——threshold比较数学错误                                    |

### 21. 测试/configure/references导对齐

| #     | 严重度   | 文件/领域                          | Issue                                                                                                                                                                                                                               |
| ----- | -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R4-50 | CRITICAL | tests/invariants/                  | §2.4 要求 9个 invariant test 文件——**全部don't exist**(truth-event-atomicity/harness-run-authority/plan-graph-only-dispatch/budget-reserve-before-execute/no-side-effect-in-replay/side-effect-ambiguous-reconciles/deny-by-default 等) |
| R4-51 | CRITICAL | tests/                             | INV-BUDGET-001 零测试覆盖                                                                                                                                                                                                          |
| R4-52 | CRITICAL | tests/                             | INV-REPLAY-001 零测试覆盖                                                                                                                                                                                                          |
| R4-53 | CRITICAL | tests/                             | INV-SIDEEFFECT-001 零测试覆盖                                                                                                                                                                                                      |
| R4-54 | CRITICAL | tests/                             | INV-POLICY-001 零测试覆盖                                                                                                                                                                                                          |
| R4-55 | HIGH     | config/runtime/default.json        | 用废弃 defaultStepTimeoutMs；no canonical Status机/Five-Plane/RuntimeStateMachine configure——only 7字段 stub                                                                                                                                    |
| R4-56 | HIGH     | config/risk/default.json           | 用废弃 stepTypeRisk/stepTypeRiskValues；no §28 Event Registry/DLQ 模型对齐                                                                                                                                                         |
| R4-57 | HIGH     | config/domains/\*.json             | 域 workflow configureuses linear steps[] + stepName——§13/§45 要求 PlanGraph                                                                                                                                                                  |
| R4-58 | HIGH     | config/domains/\*.json             | no DomainRiskSpec(advisory_only/human_accountable/deterministic_hot_path_only)——quant-trading 高危域no风险声明                                                                                                                     |
| R4-59 | HIGH     | platform-architecture-bootstrap.ts | 注册为扁平目录nomandatory启动序(§7 要求 P5→X1→P2→P3→P4→P1)                                                                                                                                                                              |
| R4-60 | MEDIUM   | platform-architecture-types.ts     | no canonical runtime 对象class型(HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation)——only基础设施class型                                                                                                                                |
| R4-61 | MEDIUM   | domains-runtime-catalog.ts         | 仍用 phase9a-9f 旧分期(§33 明确"only历史映射"，canonical 为 Ring 1/2/3)                                                                                                                                                              |
| R4-62 | MEDIUM   | index.ts                           | main() noArchitecture启动不variable检查(ArchitectureInvariantRegistry/NonOverridableInvariantRegistry §2.4)                                                                                                                                    |
| R4-63 | MEDIUM   | index.ts                           | runPlatformRootDemo 用 snapshot.workflow.currentStepIndex/stepOutputs 废弃对象作为主输出                                                                                                                                           |
| R4-64 | MEDIUM   | tests/                             | no contract-naming-consistency.test.ts(§6.4 要求 CI lint 扫描废弃术语)  

### 23. OAPEFLIR 编排循环实现缺口（§13/§45/§58）

| #     | 严重度   | 文件                                            | Issue                                                                                                                    |
| ----- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R5-1  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Plan 阶段产出线性 Plan{steps[]}——非 PlanGraphBundle(§13.7 "Plan must be Graph")                                         |
| R5-2  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | run() is单程管线(O→A→P→E→F→L→I→R→return)；replanDecision 计算后no重入——不is循环(§45.7 要求重入 Plan/Execute)            |
| R5-3  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 StageTransitionFSM——FSM 为死code；阶段转换no校验                                                                 |
| R5-4  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 HarnessLoopController——no max-iteration/max-replan/max-duration/max-cost 守卫                                    |
| R5-5  | HIGH     | orchestration/harness/index.ts decide()         | no downgrade_mode Decision分支(§58.6 要求 6种基础Decision)                                                                      |
| R5-6  | HIGH     | orchestration/oapeflir/assessment-service.ts    | Assess 不消费/产出 ConstraintPack/EffectivePolicySnapshot/RiskAssessment(§13.1.1)                                       |
| R5-7  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Evaluator 产出 ExecutionOutcomeEvaluation 而非 §45.10 EvaluationReport(passed/score/issues[]/recommendation/confidence) |
| R5-8  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Release 阶段调 PolicyRolloutService.start() no EvaluationGate/approval/canary/rollback(§13.14)                          |
| R5-9  | HIGH     | orchestration/planner/plan-builder.ts           | no Graph Normalization/Validation/Risk Propagation/Worst-Path Analysis(§13.9-13.12)                                     |
| R5-10 | HIGH     | orchestration/oapeflir/stage-transition-fsm.ts  | FSM 禁止所有后向转换——replan 在结构上不可能(§45.7/§13.4 要求 feedback→plan)                                             |
| R5-11 | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Observer only合并 TaskSituation+SystemSituation；缺事件流/目标分解/记忆/前iterations运lines上下文(§45.8)                             |
| R5-12 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Replan no GraphPatch 产出(§13.13 要求 baseGraphVersion+operations[]+compatibilityReport)                                |
| R5-13 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Execute 用 flat ExecuteBridge no subgraph/child-run supported(§13.7 要求子任务/委托显式建模)                                 |
| R5-14 | LOW      | orchestration/oapeflir/oapeflir-loop-service.ts | OapeflirLoopResult no HarnessDecision 字段——OAPEFLIR 层vs Harness Decision模型断连                                          |

### 24. NL 入口 + 目标分解 + 主动代理缺口（§8/§19/§40-§42）

| #     | 严重度   | 文件                                           | Issue                                                                                           |
| ----- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| R5-15 | CRITICAL | interaction/nl-gateway/index.ts                | pending_user_confirmation Status仍发射 RequestEnvelope(§39.2 要求only confirmed TaskSpec 方可产生) |
| R5-16 | CRITICAL | interaction/nl-gateway/index.ts                | no独立 classify_risk 管线阶段(§39.2 要求作为独立准入门禁)                                      |
| R5-17 | HIGH     | interaction/nl-gateway/index.ts                | DetectedIntent.intentType 缺 "why"(§39 新增解释查询class型)                                       |
| R5-18 | HIGH     | interaction/goal-decomposer/index.ts           | no委托链深度限制(§19.2 max=3)和globally call_depth 硬帽(=8)；no反乘法守卫                          |
| R5-19 | HIGH     | interaction/goal-decomposer/index.ts           | nobudget按比例分配到子任务(§40.2)；no风险传播到子任务                                            |
| R5-20 | HIGH     | interaction/goal-decomposer/index.ts           | GoalLifecycleState 缺 partially_completed(§40.5)                                               |
| R5-21 | HIGH     | interaction/autonomy/index.ts                  | TrustScore 范围 0-100；§42.1 要求 0-1000                                                       |
| R5-22 | HIGH     | interaction/autonomy/index.ts                  | 晋升规则notime窗口 incident-free 检查(§42.2 要求 30d/60d/90d 零事件)                           |
| R5-23 | HIGH     | interaction/autonomy/index.ts                  | no成本exceedsbudget 200% 降级规则(§42.2)                                                              |
| R5-24 | HIGH     | interaction/proactive-agent/index.ts           | medium 风险主动动作可 auto_execute(§41.1 禁止 medium+ directly执lines)                                |
| R5-25 | HIGH     | interaction/proactive-agent/trigger-engine/    | resolveTriggerActionMode() 同样对 medium/high 返回 auto_execute(§41.1 违规)                    |
| R5-26 | MEDIUM   | interaction/autonomy/index.ts                  | TrustDecayWorker no 180d no执lines→suggestion 降级(§42.3)；no 30d 冻结晋升                        |
| R5-27 | MEDIUM   | interaction/autonomy/index.ts                  | 自治等级不vs主动触发器联动(§42.5 要求 semi_auto 以上才允许自动执lines)                            |
| R5-28 | MEDIUM   | interaction/goal-decomposer/index.ts           | no能力验证(§40.2 要求验证目标域暴露所需 DomainCapability)；nopermission收窄传播                      |
| R5-29 | MEDIUM   | interaction/proactive-agent/index.ts           | batch_window configureexists but evaluate() no事件批量聚合(§41.4)                                       |
| R5-30 | MEDIUM   | interaction/nl-gateway/index.ts                | ClarificationState no rounds/maxRounds 追踪——可能no限澄清循环(§39.5)                           |
| R5-31 | LOW      | interaction/ux/conversation-history-service.ts | restricted/regulated 对话datawrites long-term memory(§39.6 要求only存 session memory)              |
| R5-32 | LOW      | interaction/nl-gateway/index.ts                | UserConfirmationReceipt 缺 scope/time/riskPreviewVersion(§39.3 审计匹配要求)                   |

### 25. 事件流 + API Surface 缺口（§6/§28）

| #     | 严重度   | 文件                                             | Issue                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5-33 | CRITICAL | platform/contracts/types/domain/session-types.ts | EventRecord 缺 §28.1 必填字段：schemaVersion/aggregateId/runId/sequence/replayBehavior/principal/evidenceRefs                                                 |
| R5-34 | CRITICAL | platform/five-plane-state-evidence/events/event-registry.ts | 两套不互通事件注册table共存：legacy task:_ colon 命名空间 vs canonical platform._ dot 命名空间；platform.\* no Tier-1 路由/Zod 验证/typed payload                |
| R5-35 | CRITICAL | platform/five-plane-interface/api/http-server/              | no /api/v1/harness-runs 及子资源路由(§6 canonical API)；only有 legacy /v1/tasks                                                                                 |
| R5-36 | HIGH     | platform/five-plane-interface/api/http-server/              | 缺 /api/v1/replay-sessions(§28.5 MVP)；admin routes 缺所有写方法(PUT config/POST panic-directives/POST resume-directives)                                     |
| R5-37 | HIGH     | state-evidence/events/durable-event-bus.ts       | publish() 不持久化 aggregateId/runId/sequence/schemaVersion——replay ordering 不可能(§28.5)                                                                    |
| R5-38 | HIGH     | state-evidence/events/event-types.ts             | Tier-1 列table含非Architecture事件(delegation:_/prompt:_/tenant:_)但缺Architecture核心事实(platform.harness_run._/platform.node*run.*/platform.side*effect.*/platform.budget.\*) |
| R5-39 | MEDIUM   | platform/five-plane-interface/api/http-server/              | WebSocket 绑定 /ws 而非 §6 要求的 /ws/v1/stream；task-routes 用 /v1/tasks no /api/ 前缀                                                                       |
| R5-40 | MEDIUM   | state-evidence/events/event-registry.ts          | replayBehavior 用 simulate_projection 而非 §28.1 canonical simulate                                                                                           |
| R5-41 | MEDIUM   | state-evidence/events/typed-event-bus.ts         | TypedEventPayloadMap 不含 platform._/oapeflir._ 事件——编译时class型检查静默排除所有 canonical 运lines时事件                                                         |

### 26. 委托 + 版本锁 + 记忆 + Truth 深层缺口（§19/§24/§25/§29）

| #     | 严重度 | 文件                                                           | Issue                                                                                                        |
| ----- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R5-42 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult 缺 §19.1 必填：summary/artifact_refs/trust_level/taint_labels/evidence_refs/policy_outcome |
| R5-43 | HIGH   | orchestration/agent-delegation/collaboration-protocol/types.ts | ACP 消息缺 §19.1 必填：delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline       |
| R5-44 | HIGH   | state-evidence/truth/runtime-truth-repository.ts               | transition() 对 HarnessRun no lease/fencing 验证(§25.3)                                                     |
| R5-45 | HIGH   | orchestration/agent-delegation/delegation-types.ts             | DelegationResult no taint_labels/data_class——跨委托data分class链断裂                                           |
| R5-46 | MEDIUM | orchestration/agent-delegation/call-depth-budget.ts            | 用 Math.max() 非求和——globally深度限制=8 实际no效(§19.2)                                                        |
| R5-47 | MEDIUM | orchestration/agent-delegation/delegation-manager.service.ts   | delegate() 不调 CallDepthBudget.evaluate()——directly委托bypassing深度检查                                            |
| R5-48 | MEDIUM | state-evidence/truth/runtime-truth-repository.ts               | transaction() 内存 clone-and-rollback nodata库事务——truth+event 原子性no崩溃security(§25.6)                     |
| R5-49 | MEDIUM | state-evidence/knowledge/knowledge-query-service.ts            | 查询no tenant/domain 边界校验(§45.16+§50)                                                                   |
| R5-50 | MEDIUM | state-evidence/memory/memory-decay-service.ts                  | working/procedural 施加指数衰减——§29.2 禁止静默丢弃 working、禁止丢弃 procedural                            |
| R5-51 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | only pipeline/negotiation 模式；缺 §19.1 broadcast+AggregationPolicy                                          |
| R5-52 | MEDIUM | orchestration/agent-delegation/delegation-types.ts             | DelegationStatus 缺 discovery/bid/awarded(§19.1 竞标)                                                       |
| R5-53 | MEDIUM | interface/api/middleware/sdk-version-handshake.ts              | 缺 platform_min_version 兼容检查(§24)                                                                       |
| R5-54 | LOW    | control-plane/config-center/config-versioning-service.ts       | 发 config.version.created 非 §24.2 config.changed 热加载事件                                                |

### 27. ADR vsArchitecture矛盾（第二批）

| #     | 严重度   | ADR                 | Issue                                                                                                                  |
| ----- | -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R5-55 | CRITICAL | ADR-026             | 风险因子模型(8因子/权重/18分制)vs §10.2 canonical(impact×4/irreversibility×4/…)完全不兼容                             |
| R5-56 | CRITICAL | ADR-001             | 将 OAPEFLIR 映射为活跃编排循环(OapeflirLoopService 编排 8 阶段)；§13/§45 明确 OAPEFLIR only为 StageRationale/Audit View |
| R5-57 | HIGH     | ADR-039             | defines cancel_task intent；§6.3 明确移除——call方必须用 abort/pause/panic kill                                           |
| R5-58 | HIGH     | ADR-001             | 三层 CEO/VP Architecture作为 Accepted Decisionno remediation；v4.3 §4 已用Five-Plane+X1 替代                                          |
| R5-59 | HIGH     | ADR-002             | "事业部" YAML division 模型no remediation；v4.3 用 DomainDescriptor+BusinessPack+DomainRiskSpec                       |
| R5-60 | HIGH     | ADR-004             | workflow data传递仍用 WorkflowState/StepOutput(§5.5 废弃)no remediation                                               |
| R5-61 | HIGH     | ADR-034             | ADR freeze 规则"不允许directly修改已冻结内容"——v4.3 remediation 过程directly修改 30+ ADR 违反此规则                           |
| R5-62 | HIGH     | ADR-041             | TriggerAction.create_task directly创建任务bypassing §5.3 intake pipeline(TaskDraft→ConfirmedTaskSpec→RequestEnvelope)          |
| R5-63 | MEDIUM   | ADR-006/008/005/002 | 源节references用全部指向旧版节号(§7/§8/§2)——v4.3 对应节已完全更替；cross-ref 批量失效                                         |
| R5-64 | MEDIUM   | ADR-028             | trace span 用 "service→operation→step"——step 为废弃术语(§5.5)                                                         |
| R5-65 | MEDIUM   | ADR-066             | references用non-existent §B/§G appendix；v4.3 no此附录                                                                            |
| R5-66 | MEDIUM   | ADR-046             | 用 CEO/VP 作为治理层级——v4.3 §46-§51 用 OrgNode 层iterations                                                                  |
| R5-67 | MEDIUM   | ADR-047             | auto_action timeout自动执linesno风险级别守卫(§10.3 high/critical defaults to deny)                                                   |



### 29. Intake 准入 + Dispatcher 调度缺口（§5.3/§14/§25.4）

| #     | 严重度 | 文件                                                      | Issue                                                                                                     |
| ----- | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R6-1  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | §5.3 ClarificationSession 阶段完全缺失；admit() directly RawTaskInput→TaskDraft→ConfirmedTaskSpec no澄清循环 |
| R6-2  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | high/critical 任务不mandatory UserConfirmationReceipt(§39.6)——confirmationReceipt optional且 critical 时仍放lines    |
| R6-3  | HIGH   | execution/dispatcher/admission-controller.ts              | 缺 §14.2 调度因子：no risk-class 隔离路由/no tenant-quota/no sandbox 匹配/no capability-class 门禁       |
| R6-4  | HIGH   | execution/dispatcher/                                     | no确定性图调度器(§14.9)——应按 priority/risk_class/critical_path_rank/created_order/scheduler_seed 调度   |
| R6-5  | HIGH   | execution/dispatcher/                                     | 缺 §14.9 emergency lane(critical NodeRun 独立通道)                                                       |
| R6-6  | HIGH   | execution/dispatcher/                                     | 缺 dispatch_backpressure_rejected 事件+DLQ 集成(§14.9)                                                   |
| R6-7  | HIGH   | execution/dispatcher/                                     | §14.9 scheduler events 缺 ready_set/selected_node_ids/ordering_policy_version/worker_pool_snapshot_ref   |
| R6-8  | MEDIUM | execution/dispatcher/admission-controller.ts              | priority 用 "urgent" 而非 §5.3 canonical "critical"                                                      |
| R6-9  | MEDIUM | execution/dispatcher/                                     | dispatch 前不验证 budget reservation 存在(§14.2 no active reservation 不得调度)                          |
| R6-10 | MEDIUM | execution/worker-pool/worker-registry-service.ts          | no heartbeat staleness 检测(§14: gap>30s 触发 worker_heartbeat_missing 事件+lease_reclaim)               |
| R6-11 | MEDIUM | orchestration/routing/intake-router.ts                    | only关键词匹配no LLM intent extraction/confidence threshold(0.80)/AmbiguityResolver(§39.3)                 |
| R6-12 | MEDIUM | orchestration/harness/runtime/intake-admission-service.ts | policyGuard.allowed hardcodes true——§25.4/§45.2 准入时策略/能力/风险检查为虚设                              |

### 30. class型系统 + API 序列化 + 共享层Issue

| #     | 严重度   | 文件                                                       | Issue                                                                                                             |
| ----- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R6-13 | CRITICAL | harness/index.ts vs contracts/executable-contracts/        | 两套conflicts HarnessRun 接口(runId+steps[] vs harnessRunId+confirmedTaskSpecId+currentSeq)——no统一 re-export/adapter |
| R6-14 | CRITICAL | contracts/control-directive/ + types/platform-contracts.ts | 两套不兼容 ControlDirective(kind enum vs type enum)——废弃class型双重存在且no canonical 替代                         |
| R6-15 | CRITICAL | contracts/execution-plan/ + types/platform-contracts.ts    | 两套 ExecutionPlan(均线性 steps[])——废弃class型双重可构造no @deprecated 注解                                        |
| R6-16 | CRITICAL | interface/api/http-server/task-routes.ts                   | POST /v1/tasks accepts {title,priority,source} 完全bypassing §5.3 intake pipeline                                        |
| R6-17 | HIGH     | interface/api/http-server/schemas.ts                       | Task status 枚举(queued/pending/in_progress/done/failed/cancelled)no法table示 canonical 13态 HarnessRunStatus       |
| R6-18 | HIGH     | 全 src/                                                    | OperationalDirective/DecisionDirective 零实现/零 schema/零 import——§5.2 contract 矩阵完全未落地                  |
| R6-19 | HIGH     | 全 src/ 870+ occurrences                                            | stepId 仍为普遍执lines标识(plugin-spi/域注册/presenter/migration/SDK)——§5.5 only允许作 legacy projection              |
| R6-20 | HIGH     | harness/index.ts:174                                       | HarnessRun 含 steps:HarnessStep[] 为第一级字段——§5.5 HarnessStep only为 semantic projection，嵌入使违规天然化      |
| R6-21 | MEDIUM   | execution/lease/execution-lease-service-async.ts:502       | `as any` cast 在 lease audit 关键路径——bypassingclass型security                                                              |
| R6-22 | MEDIUM   | ops-maturity/edge-runtime/edge-orchestrator/               | EdgeExecutionPlan uses linear orderedTaskIds 而非 PlanGraph(§4.4)                                                     |
| R6-23 | MEDIUM   | contracts/executable-contracts/schemas.ts:650              | validateExecutableContract() 返回 unknown——校验后noclass型收窄                                                      |
| R6-24 | MEDIUM   | orchestration/harness/runtime/runtime-entry-guard.ts       | assertNoLegacyTruthWrite() only运lines时拦截——no编译时 @deprecated/no import mandatory                                     |

### 31. 测试体系编码错误模型（阻断迁移）

| #     | 严重度   | 文件                                                | Issue                                                                                                                       |
| ----- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| R6-25 | CRITICAL | tests/unit/platform/contracts/execution-plan/       | 400+ lines验证 createExecutionPlan/ExecutionPlanStep+stepId 为正确lines为——将废弃 contract 作为正确性基线                        |
| R6-26 | CRITICAL | tests/e2e/multi-step-workflow-comprehensive.test.ts | 7个场景全部驱动 WorkflowState CRUD 线性步骤模型——迁移到 canonical 会破坏全部 e2e                                           |
| R6-27 | CRITICAL | tests/e2e/multi-step-task-execution.test.ts         | 18+ WorkflowState call断言线性步进——编码废弃执lines模型为正确                                                                 |
| R6-28 | CRITICAL | tests/e2e/critical-workflows.test.ts                | 16+ WorkflowState call断言废弃Status转换(running→paused→completed)                                                           |
| R6-29 | CRITICAL | tests/unit/platform/contracts/control-directive/    | 50+ 断言验证 createControlDirective 为正确——废弃 contract 有完整回归保护                                                   |
| R6-30 | HIGH     | tests/integration/platform/contracts/               | 集成测试import并验证 createExecutionPlan+createControlDirective 流——作为回归门禁阻止废弃删除                                 |
| R6-31 | HIGH     | tests/golden/workflow-validation.test.ts            | golden snapshot 编码线性 steps[]+stepId+dependsOnStepIds——PlanGraph 迁移会破坏快照                                         |
| R6-32 | HIGH     | tests/helpers/fixtures/base.ts+composite.ts         | 所有 fixture 工厂产出 TaskRecord+ExecutionRecord no HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation                   |
| R6-33 | HIGH     | tests/e2e/oapeflir-full-loop.test.ts                | E2E 用 stepId-based PlanStep/StepResult 驱动 OAPEFLIR 为执lines运lines时(§2.4 OAPEFLIR 不为 truth source)                        |
| R6-34 | HIGH     | tests/e2e/ 全部                                     | 零 e2e 测试走 canonical intake pipeline；零 e2e 测试验证 BudgetReservation 前置；零 e2e 测试验证 SideEffectRecord 生命cycle |

### 32. 剩余 Contract 批量缺口

| #     | 严重度   | 文件                                                                                                | Issue                                                                                                                   |
| ----- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R6-35 | CRITICAL | event_bus_contract.md                                                                               | 事件名 task.status*changed/workflow.step_completed/execution.* vsArchitecture platform.harness*run.*/platform.node_run.\* conflicts |
| R6-36 | CRITICAL | event_registry_and_ops_threshold_contract.md                                                        | threshold规则绑定 execution._ 废弃事件class型——ops 告警no法捕获 canonical platform._ 事件                                      |
| R6-37 | CRITICAL | result_envelope_contract.md                                                                         | buildTaskResultEnvelope(task, stepOutputs, artifacts) 完全based on pre-v4.3 模型                                           |
| R6-38 | CRITICAL | debug_inspect_health_backpressure_contract.md                                                       | TaskInspectView.executions[] + /executions/:executionId/inspect 全为废弃实体                                           |
| R6-39 | HIGH     | data_plane_contract.md                                                                              | ArtifactRef.source_execution_id 应为 source_harness_run_id/source_node_run_id                                          |
| R6-40 | HIGH     | app_error_contract.md                                                                               | AppError.execution_id 用 legacy 标识符                                                                                 |
| R6-41 | HIGH     | audit_lineage_and_retention_contract.md                                                             | 审计record用 execution_id no harness_run_id/node_run_id——谱系链断裂                                                      |
| R6-42 | HIGH     | context_compaction_and_overflow_contract.md                                                         | CompactionRecord 用 session_id/task_id no harness_run_id/node_run_id                                                   |
| R6-43 | HIGH     | workflow_io_compatibility_precheck_contract.md                                                      | 主字段 workflow_id/step_id no PlanGraphBundle/NodeRun                                                                  |
| R6-44 | HIGH     | knowledge_spi_contract.md                                                                           | no harness_run_id 集成；TrustLevel 4级未references用 §29 知识边界规则                                                          |
| R6-45 | MEDIUM   | sla_tier_contract.md / quota_preemption / multimodal_gateway / org_hierarchy / feedback_improvement | 均不足 60lines，缺 ContractEnvelope compliance + remediation section                                                      |

### 33. ADR vsArchitecture矛盾（第三批）

| #     | 严重度   | ADR     | Issue                                                                                                                  |
| ----- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| R6-46 | CRITICAL | ADR-079 | FeedbackSignal 用 taskId+executionId 为关联键；v4.3 canonical 为 harnessRunId/nodeRunId——学习对象no法 join truth      |
| R6-47 | CRITICAL | ADR-080 | FailurePattern/EvidenceRef 用 executionId——同 R6-46，Learning 子系统vs truth 断连                                     |
| R6-48 | CRITICAL | ADR-033 | Status Accepted defines Phase 1-7 为 canonical roadmap 含 evaluatePhaseAdvance() gate；§33 明确only历史映射——应 Superseded |
| R6-49 | HIGH     | ADR-038 | Canary stages CANARY_5/20/50/100 vs ADR-075 canonical rollout 态(canary_5/partial_25/50/75/stable) conflicts               |
| R6-50 | HIGH     | ADR-009 | 用 src/core/ 作为 canonical 目录+workflow_state 作为恢复table——v4.3 §35 用 src/platform/ + harness_runs                  |
| R6-51 | HIGH     | ADR-007 | "Supervisor" 拥有重启/暂停/升级/终止 Agent permission——v4.3 §45 将全部生命cycle控制归 HarnessRuntime                         |
| R6-52 | HIGH     | ADR-070 | Status Accepted 列 Phase 1-7 + "OAPEFLIR 循环不变" no v4.3 限定(only projection)——应 Superseded                         |
| R6-53 | HIGH     | ADR-041 | TriggerAction.create_task bypassing §5.3 intake pipeline                                                                   |
| R6-54 | MEDIUM   | ADR-069 | OpsCapability 含 restart_service/scale_up_down directly执lines——未via HarnessRuntime+PlanGraphBundle                          |
| R6-55 | MEDIUM   | ADR-072 | test matrix按 OAPEFLIR 模块目录组织而非 v4.3 canonical runtime 模块                                                      |
| R6-56 | MEDIUM   | ADR-078 | Knowledge TrustLevel no §10 risk model inherent_risk+trust_score 分离映射——可能隐式降低风险                           |


### 35. UI Monorepo 实现 vs UI Architecture规格（§1-§7）

| #     | 严重度 | 文件/领域                                        | Issue                                                                                           |
| ----- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| R7-1  | P0     | ui/apps/web/src/feature-registry.ts              | 27个 feature 全部 eager import no code split；§4.4.1 要求除 / 和 /login 外全部 React.lazy      |
| R7-2  | P0     | ui/vitest.config.ts                              | 覆盖率threshold(lines:30%/branches:20%) 远低于 §7.2.6(shared≥90%/ui-core≥80%/features≥70%/apps≥50%) |
| R7-3  | P0     | ui/scripts/perf-budget.mjs                       | JS chunk 550KB/total 1200KB——§7.3.1 要求 main<200KB gz/lazy chunk<100KB gz(exceeds 2.75-5.5x)       |
| R7-4  | P1     | ui/apps/web/src/app-shell.tsx                    | 路由为扁平单路径——no §4.4.1 L2-L5 嵌套下钻路由(/tasks/:id/evidence 等)                         |
| R7-5  | P1     | ui/packages/features/                            | 缺 feature-flags 模块(§4.1 Admin 下独立路由 /admin/feature-flags)                              |
| R7-6  | P1     | ui/packages/features/settings/                   | Settings no子路由导航——§4.2.9 defines 8个子页面均缺失                                             |
| R7-7  | P1     | ui/packages/shared/api-client/                   | 缺 /api/v1/meta/contract-version 端点(§1.8 契约版本协商)                                       |
| R7-8  | P1     | ui/packages/shared/api-client/ws-event-router.ts | 缺 nl.clarification_needed 事件映射(§5.3)                                                      |
| R7-9  | P1     | ui/ root                                         | 缺 Playwright/Detox/Spectron/axe-core relies on(§7.2.4 E2E+no障碍测试)                              |
| R7-10 | P1     | ui/packages/shared/i18n/                         | only 4个翻译 key/2 locale——§6.4 要求全模块覆盖                                                   |
| R7-11 | P2     | ui/packages/ui-core/src/design-tokens/           | no primitive/semantic token 分层(§6.3.1)                                                       |
| R7-12 | P2     | ui/apps/web/src/app-shell.tsx                    | 路由守卫hardcodes demo permission——§4.4.3 要求 5层dynamically guard chain                                      |
| R7-13 | P2     | ui/packages/shared/api-client/rest-client.ts     | 缺 Idempotency-Key header supported(§5.6.4)                                                         |
| R7-14 | P2     | ui/pnpm-workspace.yaml + turbo.json              | vs §2.2 ADR 选定的 npm workspaces conflicts——vestigial configure                                         |

### 36. 后端 UI 服务 vs UI Architecture规格（§4-§5）

| #     | 严重度 | 文件/领域                                              | Issue                                                                                                                 |
| ----- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| R7-15 | P0     | src/interaction/dashboard/dashboard-projection-service | only产出 totalTasks/tasksByStatus 等 4字段；UI spec §4.7.7 要求 success_rate/avg_duration_ms/active_agents 等 10+ 字段 |
| R7-16 | P0     | src/interaction/dashboard/dashboard-websocket-server   | WS 消息class型 dashboard_delta/snapshot vs UI spec task.status_changed/approval.resolved 等 domain event 模型不匹配     |
| R7-17 | P0     | src/interaction/dashboard/dashboard-websocket-server   | 订阅模型为 dashboard-ID-based；UI spec 要求 channel-based (global/task:{id}/approvals/admin)                         |
| R7-18 | P1     | src/interaction/dashboard/                             | DashboardProjectionService vs DashboardWebSocketServer 未集成（有 TODO）                                             |
| R7-19 | P1     | src/interaction/dashboard/metric-aggregator/           | only覆盖 ~15% 所需指标；UI spec 4层 28面板要求完整 metric 集                                                           |
| R7-20 | P1     | src/interaction/dashboard/health-scorer/               | 返回单一数值；UI spec StabilityPanelView 要求 8字段（uptime/error_rate/p99 等）                                      |
| R7-21 | P1     | src/interaction/dashboard/alert-router/                | only排序；no实时路由/overlay/push/haptic 通知                                                                          |
| R7-22 | P1     | src/platform/five-plane-interface/api/mission-control-service     | MissionControlSnapshot DTO vs UI spec Dashboard wireframe 字段不匹配                                                 |
| R7-23 | P1     | src/platform/five-plane-interface/api/mission-control-service     | getWorkflowCockpit() 返回 inspect-oriented shape 而非 UI spec presentation shape                                     |
| R7-24 | P1     | src/platform/five-plane-interface/api/mission-control-service     | getStabilityPanel() 返回数组而非 UI spec 要求的标量计数                                                              |
| R7-25 | P1     | src/interaction/ux/workflow-builder-service            | only内部方法no REST 端点；UI spec 要求 CRUD + validate + publish API                                                   |
| R7-26 | P1     | src/interaction/ux/conversation-history-service        | 缺 clarificationState/riskPreview/actionOptions[] 字段                                                               |
| R7-27 | P1     | src/interaction/ux/conversation-history-service        | no WS 事件发射；UI spec 要求 nl.clarification_needed 实时推送                                                        |
| R7-28 | P2     | src/interaction/ux/ux-event-tracking-service           | hardcodes "test:many_events" 事件class型；no §5.4 规定的 standard event taxonomy                                           |
| R7-29 | P2     | src/interaction/ux/platform-workbench-snapshot-service | 路由vs UI spec §4.4.1 /workbench/:view 不匹配                                                                        |
| R7-30 | P2     | src/interaction/dashboard/                             | DashboardAggregationService vs DashboardProjectionService 两套并lines未集成                                             |

### 37. UI 相关 Contract/ADR vs UI Architecture矛盾

| #     | 严重度 | 文件/领域                                                     | Issue                                                                                         |
| ----- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R7-31 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | TaskCockpit 用 task_id/task_status/current_step——均为废弃术语（应为 harness_run_id/NodeRun） |
| R7-32 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | WorkflowCockpit 用 workflow_id/steps/current_step_index——废弃线性模型                        |
| R7-33 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | AdminTakeoverConsole 用 retry_step/skip_step/override_step_output——废弃操作                  |
| R7-34 | P1     | docs_zh/contracts/admin_console_and_human_takeover_contract   | 同样uses步骤语言(step_id/step_status)而非 PlanGraph NodeRun                                  |
| R7-35 | P1     | docs_zh/contracts/ui_console_and_cockpit_contract             | Contract 导航only 4组；UI spec 有 Extended/Shared Features 含 12+ 模块                         |
| R7-36 | P1     | docs_zh/contracts/gateway_message_contract                    | no console WebSocket 推送协议defines                                                            |
| R7-37 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract  | WorkflowBuilderDraft.steps uses linear模型——应为 DAG nodes/edges                                  |
| R7-38 | P1     | docs_zh/contracts/hitl_experience_and_explainability_contract | 用废弃 step 术语（step_id/step_output/step_retry）                                           |
| R7-39 | P2     | ui/docs/adr/                                                  | only placeholder README；UI spec references用的 ADR-UI-001~009 全部don't exist                              |
| R7-40 | P2     | docs_zh/contracts/sdk_surface_contract                        | no MissionControlService typed 端点defines                                                      |

### 38. 剩余平台缺口（API 网关/security/可靠性）

| #     | 严重度 | 文件/领域                                    | Issue                                                                         |
| ----- | ------ | -------------------------------------------- | ---------------------------------------------------------------------------- |
| R7-41 | P0     | src/platform/five-plane-interface/api/middleware/       | no rate-limiting middleware；§9.2 要求 per-endpoint-class 速率限制           |
| R7-42 | P0     | src/platform/five-plane-interface/api/middleware/       | no Idempotency-Key middleware；§6.2 要求幂等保证                             |
| R7-43 | P0     | src/platform/five-plane-interface/api/http-server/      | response缺 X-Trace-Id header；§6.2 要求全链路追踪透传                            |
| R7-44 | P0     | src/platform/contracts/                      | no inter-plane ContractEnvelope 签名验证；§5.2 要求签名+版本校验             |
| R7-45 | P0     | src/platform/                                | no bulkhead isolation pattern；§9.1 要求平面间故障隔离                       |
| R7-46 | P0     | src/platform/five-plane-control-plane/iam/              | SAML 实现缺 X.509 trust-chain 验证/C14N/encrypted assertion（security关键 TODO） |
| R7-47 | P1     | src/platform/five-plane-interface/api/                  | no API 版本路由/协商机制；§6.4 要求 Accept-Version header 路由               |
| R7-48 | P1     | src/platform/stability/                      | only rehearsal runner no可复用可靠性库（circuit-breaker/retry/timeout 均缺失） |
| R7-49 | P1     | src/platform/five-plane-interface/api/middleware/       | CORS defaults to allowedOrigins:["*"] + credentials:true——security反模式                |
| R7-50 | P1     | src/platform/five-plane-execution/worker-pool/          | WorkerDrainProtocol 40lines stub 缺 §8.2 drain-quiesce-terminate 三阶段lines为     |
| R7-51 | P1     | src/org-governance/                          | 治理控制台缺持久审计日志 + RBAC 检查（标注 TODO）                            |
| R7-52 | P2     | src/platform/shared/stability/ vs stability/ | repeats模块树；职责边界不清                                                     |


### 40. 平台核心深层缺口（Model Gateway / Planner / Recovery / Evidence）

| #     | 严重度 | 文件/领域                                                             | Issue                                                                                                                                |
| ----- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R8-01 | P0     | src/platform/model-gateway/cost-tracker/budget-guard.ts               | Budget 检查为noStatus比较；§18.3 要求原子 reserve→execute→settle + BudgetReservation Status机；concurrent可exceeds支                               |
| R8-02 | P0     | src/platform/five-plane-execution/recovery/runtime-recovery-service.ts           | Recovery 服务只读——分class故障并Recommendation动作但从不执lines；no saga rollback/compensation executor/CompensationRecord                          |
| R8-03 | P0     | src/platform/five-plane-orchestration/planner/plan-builder.ts                    | 构建 legacy Plan(steps array) 而非 PlanGraphBundle DAG；no §13.9 图规范化/§13.11 风险传播/§13.12 最坏路径分析                       |
| R8-04 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | nodelay SLO mandatory；缺 latency_optimized 路由策略/P99 追踪/data_residency/pii_input_detected 约束                                      |
| R8-05 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | 路由Decisiononly内存——no持久化到 BudgetLedger 或 evidence store；缺模型选择审计轨迹                                                       |
| R8-06 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts      | getFallbackCandidates() 返回空数组使 D1 降级死code；递归 route() 可栈溢出                                                           |
| R8-07 | P1     | src/platform/model-gateway/provider-registry/circuit-breaker.ts       | failed率公式 `(failures/windowSec)*10` 非百分比；50% threshold(§9.4)语义错误                                                               |
| R8-08 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts                   | runAbTest() useshardcodes分数(0.85/0.90)模拟评估；no真实 LLM call/统计显著性检验                                                       |
| R8-09 | P1     | src/platform/five-plane-state-evidence/events/event-registry.ts                  | 主事件class型用 legacy 命名(task:status_changed)；canonical platform.harness_run.\* 未接入主注册table                                     |
| R8-10 | P1     | src/platform/five-plane-state-evidence/checkpoints/                              | Checkpoint based on workflow-step 而非 NodeRun/NodeAttempt；缺 graphVersion/planGraphId no法vs PlanGraph 对齐                           |
| R8-11 | P1     | src/platform/five-plane-state-evidence/knowledge/semantic-knowledge-graph.ts     | only3种边class型(contains/shared_keyword/same_document)；缺实体关系边/信任传播/knowledge.trust_downgraded 事件；纯内存no持久层           |
| R8-12 | P1     | src/platform/five-plane-orchestration/planner/plan-evaluator.ts                  | 成本估算为 `steps.length * 1000` hardcodes常数；no token 估算/并lines分支检测(§13.8)/风险加权成本                                         |
| R8-13 | P1     | src/platform/five-plane-orchestration/planner/plan-dag-validator.ts              | only验证环/自relies on/缺失relies on；doesn't check入口/终端节点存在性/executor 可用性/risk/budget/tool/sandbox 完整性(§13.10)                         |
| R8-14 | P1     | src/platform/five-plane-execution/recovery/failure-classification.ts             | 分class器针对 coding-agent 错误(schema_error/lint_error/test_failure)；非通用平台恢复分class器(§9.6 异常分class法)                           |
| R8-15 | P2     | src/platform/model-gateway/cost-tracker/chargeback-service.ts         | no多币种/汇率supported；§18.4 要求 original_currency/base_currency/FX snapshot                                                           |
| R8-16 | P2     | src/platform/model-gateway/fallback/index.ts                          | Fallback 选最便宜健康替代；no有序回退链(primary→secondary→tertiary) §15.4                                                           |
| R8-17 | P2     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts            | 管线 draft→review→staging→shadow→canary_5→partial_25→50→75→stable；§16.3 only canary(5%)→canary(20%)→stable；多余阶段no自动回滚质量门 |
| R8-18 | P2     | src/platform/five-plane-state-evidence/memory/memory-layer-model.ts              | working 层 LRU 驱逐no ContextTruncationReport；§29.2 要求"事实不可静默丢弃，压缩需附损失报告"                                       |

### 41. SDK / 插件 / 域注册 / 多区域 / 运维成熟度

| #     | 严重度 | 文件/领域                                                       | Issue                                                                                                        |
| ----- | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R8-19 | P0     | src/sdk/client-sdk/api-client.ts                                | no ContractEnvelope 包装；§5.2 要求所有 inter-plane 消息含 schemaVersion/commandId/correlationId/signature  |
| R8-20 | P0     | src/sdk/client-sdk/                                             | no事件订阅/流式 API；§6/§28 要求 typed event subscription(PlatformFactEvent/ProjectionUpdate/run lifecycle) |
| R8-21 | P0     | src/sdk/harness-sdk/index.ts                                    | appendStep() 仍用 stage 字符串路由；不产出 NodeAttemptReceipt(§5.3)；nodeRunId/planGraphId 塞入 inputs bag  |
| R8-22 | P1     | src/sdk/harness-sdk/index.ts                                    | no PlanGraphBundle 构建/验证 API；§22 SDK 须暴露图级规划操作                                                |
| R8-23 | P1     | src/sdk/admin-sdk/index.ts                                      | no OperationalDirective/DecisionDirective typed 方法；pauseHarnessRun/abortHarnessRun bypassing指令信封模型      |
| R8-24 | P1     | src/plugins/builtin-plugin-registry.ts                          | 内置插件no PluginManifest；§10 要求 owner/trustLevel/sbomRef/publicSdkSurface                               |
| R8-25 | P1     | src/plugins/adapters/github-adapter.ts                          | 插件加载no签名验证；§10 要求 signing.keyId/signature/algorithm 验证后才激活                                 |
| R8-26 | P1     | src/plugins/ (所有内置插件)                                     | no完整生命cycle钩子；only initialize/healthCheck/shutdown，缺 onLoad/onActivate/onDeactivate/onUnload(§10)     |
| R8-27 | P0     | src/domains/registry/domain-model.ts                            | no DomainManifest class型；§37 要求含 capability matrix/risk classification/schema registry references用               |
| R8-28 | P1     | src/domains/domain-specs.ts                                     | DomainRiskSpecSchema 缺 advisory_only/human_accountable/deterministic_hot_path_only 字段(§3.2 责任边界)     |
| R8-29 | P1     | src/domains/registry/                                           | no专用 SchemaRegistry；§37 要求域输入/输出 schema 版本manage+兼容性检查                                       |
| R8-30 | P1     | src/domains/registry/domain-registry-service.ts                 | register() 自动 validated→registered no冒烟测试门控；§37 要求验证门                                         |
| R8-31 | P2     | src/domains/registry/domain-model.ts:45                         | WorkflowConfigSchema.steps 为线性 z.array(StepTemplateConfigSchema)——§13 禁止复杂任务uses线性步骤           |
| R8-32 | P1     | src/scale-ecosystem/multi-region/                               | no fencing token/single-leader 写mandatory；§25.11/§52.3 要求 truth/budget/side-effect 写onlyvia fencing 单领导者 |
| R8-33 | P1     | src/scale-ecosystem/multi-region/cdc-replication-service.ts     | CDC 复制noconflicts解决；applyBatch() 盲目应用事件no epoch/版本 fencing 检查                                     |
| R8-34 | P2     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts  | no Chinese Wall mandatory/跨租户data移动阻断(§50 知识域隔离)                                                     |
| R8-35 | P1     | src/ops-maturity/workflow-debugger/workflow-debugger-service.ts | Debugger uses stepId/workflowId 术语而非 nodeRunId/planGraphId(§65)                                         |
| R8-36 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | Time-travel 用 stepId/executionId 作主键；应为 nodeRunId/harnessRunId(§5.5)                                 |
| R8-37 | P2     | src/ops-maturity/explainability/                                | no StageRationale/OAPEFLIR 投影消费；§59 要求渲染 OAPEFLIR StageRationale 为审计解释                        |
| R8-38 | P2     | src/ops-maturity/edge-runtime/                                  | Edge orchestrator 为单文件 stub；缺 §62 离线能力/本地模型执lines/sync-queue+conflicts解决/确定性回退                |
| R8-39 | P2     | src/ops-maturity/                                               | no OpsMaturityScore 聚合模型；§69 要求跨 drift/compliance/cost/explainability 维度评分                      |
| R8-40 | P1     | src/sdk/plugin-sdk/plugin-test-harness.ts                       | executePlugin() 全 mock 返回hardcodesresponse；§22.4 测试 harness 须在沙盒中执lines真实插件生命cycle                   |
| R8-41 | P2     | src/scale-ecosystem/marketplace/                                | no AgentCertification/PackCertificationGate；§55 发布前须viasecurity扫描/eval gate/SBOM authentication管线                 |
| R8-42 | P2     | src/sdk/plugin-sdk/plugin-definition.ts:26                      | PluginSecurityConfig.sandboxTier 含 "none"；§10 插件defaults to不信任——"none" 违反 INV-POLICY-001                  |

### 42. UI 深层缺口（组件库 / no障碍 / 原生壳 / 离线 / 工具链）

| #     | 严重度 | 文件/领域                                               | Issue                                                                                                          |
| ----- | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R8-43 | P0     | ui/packages/shared/auth/src/auth-service.ts             | no token refresh 逻辑；§5.4.4 要求到期前 60s 主动静默刷新+concurrent锁+401→redirect                                 |
| R8-44 | P0     | ui/packages/shared/auth/src/auth-service.ts             | no PKCE supported；handleSsoCallback directly从 URL 参数读 token no code_verifier/code_challenge/authorization码交换            |
| R8-45 | P0     | ui/packages/shared/platform/src/web-platform-adapter.ts | Token 明文存入 localStorage；§6.5.2 要求 HttpOnly Secure Cookie 或 memory-only                                |
| R8-46 | P1     | ui/packages/ui-core/src/components/                     | 极少 ARIA 覆盖；§6.4.3+§6.4.5 要求全交互元素含 role/aria-live/aria-label；ListCard/KeyValueTable/按钮均缺     |
| R8-47 | P1     | ui/packages/ui-core/src/components/                     | no键盘焦点manage；§6.4.3 要求可见焦点环；designTokens.shadows.focusRing 已defines但组件未消费                      |
| R8-48 | P1     | ui/packages/ui-core/src/design-tokens/                  | 扁平 token 结构no primitive/semantic/domain 分层；缺 risk-level/autonomy-level/status/domain 色阶(§6.3.1)     |
| R8-49 | P1     | ui/packages/ui-core/                                    | no动画系统/prefers-reduced-motion supported；§6.4.3 + §6.3.1 要求 animation.ts 含 fast/normal/slow/easing          |
| R8-50 | P1     | ui/packages/ui-core/src/components/                     | 组件库严重不完整；§6.3.2 要求 50+ 组件(8class)；当前only 7个(StatusPill/ListCard/KeyValueTable/FeatureScaffold 等) |
| R8-51 | P1     | ui/packages/ui-core/src/themes/                         | Theme 为 JS 对象非 CSS Custom Properties；§6.3.3 要求 CSS vars + prefers-color-scheme media query             |
| R8-52 | P1     | ui/tools/mock-server/src/index.ts                       | Mock server only覆盖 3端点(dashboard/tasks/workflows)；§5.2 defines 30+ 端点；缺 approval/agent/policy/WS mock     |
| R8-53 | P1     | ui/tools/codegen/src/index.ts                           | Codegen only生成路径constant；§5.4.3 要求 typed endpoint function+query key factories+DTO class型                          |
| R8-54 | P1     | ui/apps/mobile/src/App.tsx                              | 移动平台hardcodes android；§2.5.5/2.5.6 要求 Android+iOS supported；no运lines时平台检测                                  |
| R8-55 | P2     | ui/apps/electron-win/, ui/apps/tauri-\*/                | no自动更新机制；§7.1.5+§2.5.2 要求 electron-updater/Sparkle/Tauri updater；桌面壳为清单 stub                  |
| R8-56 | P2     | ui/packages/shared/sync/src/offline-queue.ts            | OfflineMutation 缺 idempotencyKey/retryCount/status 字段(§5.4.5)                                              |
| R8-57 | P2     | ui/packages/shared/sync/src/conflict-resolver.ts        | only server_wins/local_wins/shallow-merge；§5.5.4 要求dataclass型特定conflicts解决(CAS/幂等/先到先得)                   |
| R8-58 | P2     | ui/packages/features/\*/src/index.tsx                   | no Error Boundary；§5.6 要求 P0-P3 错误分级+fallback UI；单组件崩溃拖垮全应用                                 |
| R8-59 | P2     | ui/apps/tauri-macos/, ui/apps/tauri-linux/              | no Tauri 原生集成(Keychain/native menu/Spotlight/D-Bus/XDG/Wayland)；src-tauri/ no main.rs                    |
| R8-60 | P2     | ui/packages/ui-core/src/charts/                         | 图tablenotable格替代视图；§6.4.3 要求所有图table提供 table fallback 供屏幕阅读器uses                                   |

### 43. ADR / Contract 新发现矛盾vs缺失

| #     | 严重度 | 文件/领域                                                   | Issue                                                                                                                                                                           |
| ----- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R8-61 | P0     | docs_zh/adr/066-\*.md (×2)                                  | ADR-066 #repeats：compliance-report-auto-generation vs plugin-spi-framework 共用同一#                                                                                       |
| R8-62 | P0     | docs_zh/adr/060-explicit-planning-hub.md                    | defines Plan DTO(planId/taskId/steps:PlanStep[]/DAGStructure) 作为 P3→P4 canonical contract；v4.3 用 PlanGraphBundle/PlanGraph/PlanNode/PlanEdge——完全不同对象名；未标 superseded |
| R8-63 | P0     | docs_zh/adr/033-phased-roadmap.md                           | defines 7-Phase 路线图；v4.3 §33 已替换为 Ring 1/2/3 模型；ADR 仍 Accepted no Ring references用                                                                                           |
| R8-64 | P1     | docs_zh/contracts/event-envelope-contract.md                | 同一 schema 内混合 snake_case(schema_version/idempotency_key) 和 camelCase(eventId/eventType)                                                                                  |
| R8-65 | P1     | docs_zh/contracts/event_bus_contract.md                     | Legacy EventEnvelope 用 task_id 作关联字段；v4.3 要求 harnessRunId + aggregate 关联；parallel schema 未重定向                                                                  |
| R8-66 | P1     | docs_zh/adr/019-agent-handoff-four-layer-protocol.md        | HandoffSerializer.buildFromStepResult(result: StepResult) references用废弃class型；v4.3 用 NodeAttemptReceipt                                                                             |
| R8-67 | P1     | 缺失 contract: Agent Delegation / Multi-Agent Collaboration | §19 defines完整委托协议(DelegationRequest/DelegationReceipt/depth C1-C7)；no对应 contract 文件                                                                                    |
| R8-68 | P1     | docs_zh/contracts/task-intake-request-contract.md           | TaskDraft/ConfirmedTaskSpec no domainId 字段；§30/§37 要求每个进入执lines的任务携带已验证 domain_id                                                                               |
| R8-69 | P1     | docs_zh/contracts/harness-run-contract.md                   | HarnessRun 有 tenantId no domainId；§37 要求域绑定used for风险覆盖/知识边界/prompt 库选择                                                                                          |
| R8-70 | P1     | 缺失 contract: ReleaseDecisionView / ReleaseChannel         | §13 列 ReleaseDecisionView 为 canonical OAPEFLIR 投影对象；ADR-091 要求 ReleaseChannel；均no contract                                                                          |
| R8-71 | P1     | docs_zh/adr/012-sqlite-phase-1-2-primary-store.md           | 仍 Accepted 范围为 "Phase 1a/1b"；v4.3 用 Ring 1 MVP；退出条件未映射到 Ring 边界                                                                                               |
| R8-72 | P1     | docs_zh/adr/013-eventemitter-phase-2-boundary.md            | 同上——范围 "Phase 1a/1b/Phase 2" no Ring 映射；退出触发器("Phase 2 isno替换")已nodefines                                                                                          |
| R8-73 | P2     | docs_zh/contracts/typed_event_bus_contract.md §3A           | 所有 OAPEFLIR 事件载荷用 task_id/workflow_id 作主关联字段；v4.3 用 harnessRunId+aggregate 关联                                                                                 |
| R8-74 | P2     | docs_zh/adr/072-oapeflir-testing-strategy.md                | 测试 OAPEFLIR 为独立执lines管线("O→A→P→E→F happy path" E2E)；v4.3 降级 OAPEFLIR 为only投影/视图                                                                                     |
| R8-75 | P2     | docs_zh/contracts/runtime_state_machine_contract.md §1A     | defines OapeflirStage 为工作流级Status机(observe→assess→plan→...)；v4.3 说 OAPEFLIR 阶段only为投影非Status机转换                                                                        |
| R8-76 | P2     | docs_zh/adr/002-division-system.md                          | 用"事业部"建模(division_id)；v4.3 §37/§46 用 DomainDescriptor+OrgUnit；ADR 仍 Accepted 未标废弃                                                                                |
| R8-77 | P2     | docs_zh/contracts/task_and_workflow_contract.md             | WorkflowState 含 division_id 必填字段；v4.3 canonical 对象(HarnessRun/TaskDraft/RequestEnvelope)no此字段                                                                       |

### 45. 执lines平面深层缺陷（Lease / Dispatch / State-Transition / Delegation）

| #     | 严重度 | 文件/领域                                                                                 | Issue                                                                                                                                     |
| ----- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R9-01 | P0     | src/platform/five-plane-execution/lease/execution-lease-service.ts:556-663                           | validateWriteAccess doesn't check expiresAt vs 当前time；TTL 过期但未回收的 lease still allowswrites(§8.3 stale detection)                              |
| R9-02 | P0     | src/platform/five-plane-execution/state-transition/transition-service.ts:500-526                     | TaskTerminalTransitionService.apply() 用非 CAS 更新(updateTaskStatus/updateWorkflowState)；concurrent终态转换可互相覆盖，违反 RT-01 不variable     |
| R9-03 | P0     | src/platform/five-plane-execution/lease/execution-lease-service-async.ts:247-289                     | releaseLeaseSync doesn't check lease.status!=="active"；已过期/已回收 lease 可被重新释放，破坏审计轨迹+双释放 worker slot                       |
| R9-04 | P1     | src/platform/five-plane-execution/state-transition/transition-service.ts:110-119                     | EXECUTION_TRANSITIONS onlydefines 8态；§45.13 要求 13态(缺 queued/dispatching/paused/recovering/timed_out)                                    |
| R9-05 | P1     | src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:223-251                   | no poison-pill 检测；永久no匹配 worker 的 ticket no限循环消耗扫描time，nofailed计数/重试限制/死信机制                                      |
| R9-06 | P1     | src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:55-76           | 所有委托Status(delegationStore/chainStore)纯内存 Map；进程重启丢失活跃委托链；SQLite delegation-repository exists but从未接入                  |
| R9-07 | P1     | src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:405-428         | narrowPermissions 将父资源替换为子request资源(非交集)；子 agent 可request父未持有的资源，违反 §19 信任继承/only收窄规则                          |
| R9-08 | P1     | src/platform/five-plane-execution/lease/types.ts vs execution-lease-service.ts                       | MIN_LEASE_TTL_MS(5s)/MAX_LEASE_TTL_MS(30s) defines但 acquireLease 从不mandatory；可传入 ttlMs:1 或 999999999(§8.3 TTL bounds)                    |
| R9-09 | P1     | src/platform/five-plane-orchestration/routing/intake-router.ts                                       | 路由纯关键词匹配no capability matching；§8.5 要求匹配 worker/agent 能力注册+容量                                                         |
| R9-10 | P1     | src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:227                       | 每 ticket 迭代实例化新 HealthService(backpressureSnapshot==null时)；O(n) 健康扫描+同批iterations票据间背压Decisioninconsistent                             |
| R9-11 | P2     | src/platform/five-plane-orchestration/agent-delegation/call-depth-budget.ts vs topology-validator.ts | maxCallDepth=8 vs DEFAULT_MAX_DEPTH=3 两套独立深度限制互不协调；§19 要求单一权威深度限制                                                 |
| R9-12 | P2     | src/platform/five-plane-state-evidence/truth/async-repositories/event-repository.ts                  | no投影版本化；listEventsForTask 返回原始事件no snapshot cursor/版本戳；每iterations读full重放(§4.2 snapshot optimization)                        |
| R9-13 | P2     | src/platform/five-plane-orchestration/routing/agent-team-service.ts:146                              | 执lines循环hardcodes ["plan","build","review","validate","repair","validate","release"]；低风险单文件变更仍走完整 7阶段(§8.5 adaptive routing) |

### 46. OAPEFLIR / Harness / Bootstrap 深层Issue

| #     | 严重度 | 文件/领域                                                                   | Issue                                                                                                                            |
| ----- | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R9-14 | P0     | src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:210            | OAPEFLIR 含directly执lines逻辑(executeViaBridge call executeBridge.executePlan)；§45 规定only投影/视图，执lines须委托执lines平面               |
| R9-15 | P0     | src/index.ts:179-189                                                        | buildPlatformRootSummary 初始化所有平面目录norelies on顺序；§2 要求 control-plane→state-evidence→execution→orchestration→interaction |
| R9-16 | P1     | src/platform/five-plane-orchestration/oapeflir/ (loop-service vs stage-transition-fsm) | StageTransitionFSM 完整实现(236lines)但从未被 OapeflirLoopService.run() 实例化/咨询；FSM 为死code，阶段顺序nomandatory                  |
| R9-17 | P1     | src/platform/five-plane-orchestration/oapeflir/assessment-service.ts:65                | routingDecision.division hardcodes "coding"；非编码域任务永远被误路由                                                              |
| R9-18 | P1     | src/platform/five-plane-orchestration/oapeflir/final-response.ts:27-48                 | FinalResponse 接口 10字段；§A.3 要求 13字段(缺 executionDurationMs/modelId/retryCount)                                          |
| R9-19 | P1     | config/runtime/default.json                                                 | only 7字段；缺 §8 要求的 healthCheckIntervalMs/shutdownGracePeriodMs/logLevel/metricsEnabled/tracingEnabled/retryPolicy           |
| R9-20 | P1     | src/platform/five-plane-orchestration/harness/index.ts:57-77                           | ConstraintPack 混合 camelCase(toolPolicy) 和 snake_case(risk_policy/output_policy)；序列化inconsistent                                |
| R9-21 | P1     | src/platform/five-plane-orchestration/harness/hitl-runtime.ts:18                       | HitlRuntime 所有request存内存 Map no持久化；进程重启丢失全部待审批request(§45 要求 HITL Status存活崩溃)                                 |
| R9-22 | P1     | src/platform/five-plane-orchestration/harness/recovery-controller.ts:12-31             | handleFailure 恢复期间不发事件到 state-evidence plane；§45 要求所有生命cycle转换有 evidence record                                 |
| R9-23 | P1     | src/platform-architecture-bootstrap.ts:128-148                              | registerPlatformArchitectureServices 注册后立即 get() no健康/就绪门控；init failed静默传播                                        |
| R9-24 | P1     | config/risk/default.json:2                                                  | $schema 指向 .ts 文件非 JSON Schema；运lines时no法做 JSON Schema 验证                                                              |
| R9-25 | P2     | config/domains/default.json:98                                              | domain status:"testing" 非 canonical(§11: draft/active/deprecated/retired)                                                      |
| R9-26 | P2     | config/domains/default.json:7                                               | domain version:1(integer)；§11 要求 semver string("1.0.0") used for兼容性检查                                                       |
| R9-27 | P2     | src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.ts:24           | hitl_operator 映射到 OAPEFLIR "assess" 阶段；§45 HITL is feedback/gate 机制非自动风险评估                                       |
| R9-28 | P2     | src/platform/five-plane-orchestration/harness/guardrails/guardrail-engine.ts:91-95     | 永远不返回 retry_same_plan；HarnessDecisionAction 联合含此值但护栏no法触发                                                      |
| R9-29 | P2     | src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:228           | dynamically import ../../../core/runtime/orchestrator/index.js——路径在 src/platform/ 外部；耦合未声明的 core/ 模块                     |
| R9-30 | P2     | tests/integration/                                                          | no跨平面事件传播/事件溯源重放/OAPEFLIR FSM 验证/PlanGraph 执lines集成测试；§45 核心lines为零覆盖                                      |

### 47. 组织治理 / NL 交互 / 自治references擎深层Issue

| #     | 严重度 | 文件/领域                                                     | Issue                                                                                                                                             |
| ----- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-31 | P0     | src/org-governance/org-model/org-governance-saga.ts           | §46.3 要求 OrgGovernanceSaga 冻结 orgVersion+计算Impact差异+有序子步骤+补偿；实现为 stub only按class型分组no实际逻辑                                    |
| R9-32 | P0     | src/interaction/nl-gateway/index.ts:722                       | §39.6 规定only confirmed TaskSpec 可生成 RequestEnvelope；buildTask() 在 confirmationReceipt.state="pending_user_confirmation" 时即预构建 envelope |
| R9-33 | P1     | src/org-governance/approval-routing/route-engine/index.ts:155 | §47.1 要求 parallel 会签+sequential 逐级审批模式；only实现单线性链no并lines/会签                                                                      |
| R9-34 | P1     | src/org-governance/approval-routing/route-engine/index.ts:257 | normalizeThresholdCny hardcodes USD→CNY 汇率 7.2；§47.2 要求 base_currency+FX snapshot                                                              |
| R9-35 | P1     | src/org-governance/approval-routing/route-engine/index.ts:46  | ApprovalRouteSnapshot no expiresAt；§47.3 要求 expiry/revocation/commit-time revalidation                                                        |
| R9-36 | P1     | src/org-governance/approval-routing/escalation/index.ts       | timeout升级用静态 escalateToApproverId 不遍历 OrgTree；§47.1 要求向上走组织层级                                                                     |
| R9-37 | P1     | src/org-governance/compliance-engine/inheritance/index.ts     | §49.2 要求 PolicyStrictnessComparator+不可比策略进入 compliance approval；用hardcodes启发式no比较器接口                                             |
| R9-38 | P1     | src/org-governance/compliance-engine/                         | §49 要求 ComplianceExceptionWorkflow(scope/expiresAt/compensating controls) + EvidenceQualityScore/ControlCoverageReport——全部未实现             |
| R9-39 | P1     | src/org-governance/compliance-engine/evidence-collector.ts    | §49.3 要求定期自动证据收集(季度 SOX/持续 HIPAA)；实现only按需callno调度器/cycle/新鲜度mandatory                                                          |
| R9-40 | P1     | src/interaction/nl-gateway/index.ts:161                       | UserConfirmationReceipt only not_required/pending 两态；缺 confirmed 态+risk preview version/scope/actor/timestamp(§39)                            |
| R9-41 | P1     | src/interaction/nl-gateway/index.ts:480                       | §39 high/critical 指令须 dry-run preview；buildRiskPreview 纯关键词匹配no实际 dry-run 执lines/副作用预览                                            |
| R9-42 | P1     | src/interaction/goal-decomposer/index.ts                      | §40.2 要求 capability validation+risk propagation through task graph；no DomainDescriptor 能力检查；风险逐节点不传播                             |
| R9-43 | P1     | src/interaction/autonomy/promotion-engine/index.ts:27-31      | §42.2 要求 human override rate <5%/<1% 才可升级；assessPromotion only检查 totalExecutions/successRate 从不评估 override rate                       |
| R9-44 | P1     | src/interaction/autonomy/index.ts:329                         | §42.2 要求 domain_owner/platform_team 审批升级；所有升级 approvedBy:"auto" no审批门                                                              |
| R9-45 | P2     | src/interaction/autonomy/promotion-engine/index.ts:24-31      | §42.2 要求 per-level no事件窗口(30d/60d/90d)；onlyglobally incidents>0 检查notime窗约束                                                                |
| R9-46 | P2     | src/interaction/goal-decomposer/index.ts:368                  | §40.3 模板匹配应用 DomainRecipe(§37.7)；detectTemplate 用 5个hardcodes正则no DomainRecipe/DomainDescriptor 集成                                     |
| R9-47 | P2     | src/interaction/proactive-agent/index.ts:76                   | §41.5 Suggestion 管线(Context Builder→Generator→Queue→dashboard)；enqueueSuggestion no上下文构建/质量评分                                        |

### 48. Contract 深层矛盾vs缺口（新发现）

| #     | 严重度 | 文件/领域                                                               | Issue                                                                                                                                                                                                         |
| ----- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-48 | P0     | docs_zh/contracts/platform_panic_and_resume_contract.md §3              | PlatformPanicDirective 含optional expires_at TTL；§2.4 不variable明确"Panic 不得 TTL 自动解除，恢复必须人工确认"                                                                                                     |
| R9-49 | P1     | docs_zh/contracts/observability_contract.md §3                          | LogEvent 用 task_id? 作主关联键缺 harness_run_id/node_run_id/attempt_id；§5.5 要求 HarnessRun 为 canonical 关联                                                                                              |
| R9-50 | P1     | docs_zh/contracts/model_gateway_routing_contract.md §2                  | ModelRouteRequest 用 taskId no harnessRunId/nodeRunId；INV-BUDGET-001 要求 harnessRunId 才能验证budget预留                                                                                                     |
| R9-51 | P1     | docs_zh/contracts/budget-ledger-contract.md §3                          | BudgetReservation.resourceKind 枚举(token/tool/api/compute/human/side_effect/other)vs §53 ResourceKind(worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io)完全不匹配 |
| R9-52 | P1     | docs_zh/contracts/side-effect-reconciliation-contract.md §2             | SideEffectStatus 枚举缺 approved/committed/confirming/manual_review_required/compensation_required 态；多出 reserved 态(§14.11 no此态)                                                                       |
| R9-53 | P1     | docs_zh/contracts/cost_and_budget_contract.md §4                        | CostEvent 以 task_id 为必填主键，harness_run_id/node_run_id/attempt_id 为optional；vs budget-ledger(要求 harnessRunId)对接断裂                                                                                   |
| R9-54 | P1     | docs_zh/contracts/cost_and_budget_contract.md §3                        | BudgetPolicy.runtime_mode 8态(full_auto/supervised_auto/read_only/no-write/...) vs sandbox_and_auth_contract §3 4态(read_only/workspace_write/scoped_external_access/restricted_exec)完全不overlaps              |
| R9-55 | P1     | docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md | 全文uses step 术语("不可达步骤检测"/"step id 唯一性检查"/"每个有副作用的 step")；v4.3 用 PlanNode/nodeId；no迁移段                                                                                           |
| R9-56 | P2     | docs_zh/contracts/multimodal_gateway_contract.md                        | MultimodalRequest 缺 harnessRunId/nodeRunId/tenantId/traceId(§5.2 ContractEnvelope 必填)；no BudgetReservation references用                                                                                          |
| R9-57 | P2     | docs_zh/contracts/connector_framework_contract.md                       | ConnectorExecutionRequest/Result no最小字段defines；缺 harnessRunId/nodeRunId/sideEffectId 关联(§14.11 外部写须注册 SideEffectRecord)                                                                           |
| R9-58 | P2     | docs_zh/contracts/capacity_planning_contract.md                         | CapacitySignal no tenantId/harnessRunId；resource_type 为 plain string 未对齐 §53 ResourceKind canonical 枚举                                                                                                |
| R9-59 | P2     | docs_zh/contracts/gateway_streaming_contract.md §3                      | StreamEvent 用 task_id 作主关联键no harness_run_id/node_run_id；§6.8 legacy task 端点须解析到 harnessRunId                                                                                                   |
| R9-60 | P2     | docs_zh/contracts/observability_contract.md §4.3                        | StageMetricSample/LoopIterationTrace 携带 task_id? 作关联字段但 T-47 remediation 降级 OAPEFLIR 指标为 view-only——定位矛盾                                                                                    |
| R9-61 | P2     | docs_zh/contracts/plugin_spi_contract.md §2.4                           | DomainPresenterPlugin.present() accepts DualChannelStepOutput(含 Step 的废弃class型)；v4.3 用 NodeAttemptReceipt                                                                                                   |
