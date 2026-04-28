## 2026-04-28 复核结论

以下状态矩阵覆盖本文件原始发现的当前实况；原始分项清单保留在后文作为历史发现快照。判定依据只采信实际源码、配置与 contract/ADR/spec 文本，不再使用 closure test、closure script 或 supersede 占位说明。

| 主题 | 当前状态 | 根因 | 当前证据 |
| --- | --- | --- | --- |
| S1 OAPEFLIR 身份危机 | 已修复 | 根因是 OAPEFLIR spec/ADR 曾把认知投影视图写成 runtime truth，v4.3 迁移初期只改了局部 contract，引用链没有一起收口。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已降为 `Reference Draft`；`docs_zh/adr/070-conclusion.md`、`072-oapeflir-testing-strategy.md`、`066-plugin-spi-framework.md` 以及 `docs_zh/contracts/workflow_debugger_contract.md`、`plugin_spi_contract.md` 已把 OAPEFLIR 明确收回为 projection/view。 |
| S2 废弃术语迁移未执行 | 部分修复 | 根因不是“还有几个旧词”这么简单，而是 v3 `workflow/execution/stepId` 兼容层长期停留在一等模型位置，代码、contract、ADR 各自继续复用旧键，迁移没有形成单一 canonical 边界。 | 本轮已把 `src/platform/execution/plugin-executor/sub-workflow-executor.ts` 收敛为 `nodeId` 内部主键、`src/platform/state-evidence/events/projections/workflow-timeline-projection.ts` 补上 `planGraphBundleId / harnessRunId / nodeId` canonical 轴、`src/domains/registry/plugin-spi.ts` 把 `stepId/workflowId` 降为 alias；但 `src/scale-ecosystem/billing/types.ts` 及后文 2.4 / 3.4 所列部分 contract/ADR 残留仍未完全迁移。 |
| S3 RuntimeStateMachine 被绕过 | 已修复 | 根因是 Harness / delegation / replay 曾各自维护局部状态，导致运行态修改散落在业务逻辑里。 | 复核实际文件后，`src/platform/orchestration/harness/index.ts` 的 `runLoop()` 已经经由 `transitionRunStatus()` 驱动状态迁移；`src/platform/orchestration/agent-delegation/delegation-manager.service.ts` 已改为状态机路径；`src/platform/execution/ha/replay-worker.ts` 有 `assertReplayPolicySafe()` 门禁。 |
| S4 Sandbox 含 `none` 档位 | 部分修复 | 根因是 sandbox canonical tier 只在安全策略层定义，但业务包、插件 SDK、delegation 上下文长期直接暴露 legacy alias，兼容输入与 canonical 输出没有分层。 | 本次已把 `src/sdk/plugin-sdk/plugin-definition.ts`、`src/sdk/plugin-sdk/plugin-context.ts`、`src/platform/orchestration/agent-delegation/delegation-types.ts` 的公共类型收敛到 canonical 4 档；但 `src/platform/control-plane/iam/sandbox-policy.ts` 与 `src/domains/business-pack/business-pack-manifest.ts` 仍保留 alias 兼容解析，所以不能宣称“完全消失”。 |
| S5 Budget 保护缺失 | 部分修复 | 根因已从“完全没有 reservation”转为“预算职责分散”: orchestration 先做门禁、执行方再单独预留，失败时缺少统一 release/settle 生命周期，导致重复预留与泄漏风险。 | `src/platform/model-gateway/cost-tracker/budget-guard.ts` 现负责执行前门禁；本次补齐 `src/platform/execution/budget-allocator.ts` 的 `release()`，并把 `src/interaction/goal-decomposer/llm-plan-generator.ts`、`src/scale-ecosystem/billing/billing-service.ts` 改为失败即释放 reservation；`src/interaction/goal-decomposer/index.ts` 不再在上层重复预留。 |
| S6 Trust Score 绕过安全边界 | 原发现已过时 | 根因是此前审计基于旧快照，未反映后续已落地的风险封顶和 full-auto 禁止逻辑。 | `src/interaction/autonomy/trust-scorer/index.ts` 把 `fully_trusted` 映射到 `semi_auto`；`src/interaction/autonomy/promotion-engine/index.ts` 明确阻止 `semi_auto -> full_auto` 自动提升；`src/interaction/proactive-agent/trigger-engine/index.ts` 对 `high` 风险返回 `suggest`，不是 `auto_execute`。 |
| S7 域风险规格缺失 | 已修复 | 根因是高风险域先完成 baseline onboarding，治理约束后来才补，导致风险规格在模型层缺席。 | `src/domains/domain-specs.ts` 已包含 `advisoryOnly / humanAccountable / deterministicHotPathOnly`，并内置 `healthcare / quant-trading / financial-services / legal` 的默认 `DomainRiskSpec`。 |
| S8 存储 Schema 基于废弃对象 | 已修复 | 根因是存储合同直接复用了 v3 单机表模型，后来 runtime truth 表族补进后，文档没有同步换主链。 | `docs_zh/contracts/storage_schema_contract.md` 现以 `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_*` 为 authoritative truth，并显式把 `executions` 等旧表降级为 projection / compatibility。 |
| S9 Phase 1-9 仍作为 canonical 分期 | 已修复 | 根因是上一轮所谓 ring migration 只改了展示层，`domains` 的 canonical bootstrap service id 和依赖链仍然绑在历史 phase 上。 | 本次已把 `src/domains/domains-bootstrap.ts`、`src/domains-runtime-catalog.ts`、`src/domains-startup-plan.ts`、`src/domains-runtime-orchestrator.ts` 收敛到 `ring1 / ring2 / ring3` 作为 runtime truth；legacy `9a-9f` 仅保留为 bootstrap 输入映射。 |
| S10 Saga 语义缺失 | 已修复 | 根因是组织治理 saga 早期只是“根据输入拼回执”，没有真正的执行器抽象去承载 `prepare/commit/compensate/audit`，所以失败点和补偿路径都只是内存推导。 | 本次复核后，`src/org-governance/org-model/org-governance-saga.ts`、`src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts`、`src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` 都改为可注入 handler 的可执行编排器，失败时会真实调用补偿 handler，并把 `failedStepId/failedStage/executionLog` 落入回执。 |

## 复核方法

- 只以实际文件内容为依据。
- contract/ADR/spec 若仍引用旧术语，但已显式降级为 `legacy / projection / migration input`，不再计为 canonical 冲突。
- 历史发现中若已被源码或文档实改消除，后文原始条目不再代表当前未修复状态。
- 本轮仅执行定向验证，不执行全量测试；已验证 `domains` ring 启动、`provider-registry` 请求上下文、budget allocator / llm plan generator、SDK / delegation sandbox，以及 `sub-workflow-executor / workflow-timeline-projection / plugin-spi` 兼容边界迁移相关测试。

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

| Contract                                             | 问题                                                                            | 状态   | 根因与修复 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- | ------ | ---------- |
| `api_surface_contract.md:§3`                         | GET /executions/:executionId/inspect 用废弃 executionId；无 /harness-runs/ 端点 | 已修复 | 根因：API contract 沿用旧 execution-centric 观测模型。修复：T-61 已将 harness-runs/node-runs inspect 提升为权威端点，/executions/:executionId/inspect 只保留兼容别名 |
| `artifact_unified_model_contract.md:§3.1`            | ArtifactRecord 用 executionId/planId（应为 harnessRunId/planGraphId）           | 已修复 | 根因：artifact contract 复用旧 workflow-step 输出模型。修复：T-62 已以 harnessRunId/nodeRunId/planGraphBundleId 为权威 lineage |
| `file_lock_contract.md:§3.1-3.2`                     | FileLockRequest/Record 用 execution_id/holder_execution_id                      | 已修复 | 根因：File lock 使用废弃 execution ID。修复：本文已更新服务入口方法名从 `releaseAllByExecution(executionId)` / `listLocksByExecution(executionId)` 改为 `releaseAllByHarnessRun(harnessRunId)` / `listLocksByHarnessRun(harnessRunId)` |
| `debug_inspect_health_backpressure_contract.md:§3.2` | TaskInspectView 用 workflow_state + executions[]                                | 已修复 | 根因：调试 contract 继承旧 workflow/execution 观测模型。修复：T-63 已将 inspect 主链收口到 Task → HarnessRun → NodeRun[] |
| `artifact_store_contract.md:§3`                      | ArtifactRecord 仅 task_id，缺 harness_run_id/node_run_id                        | 已修复 | 根因：artifact store contract 早于 v4.3 executable contract。修复：T-64 已要求 harness_run_id/node_run_id/plan_graph_bundle_id 作为最小运行链主键 |
| `audit_lineage_and_retention_contract.md:§5`         | 用 execution_id，缺 harness_run_id/node_run_id                                  | 已修复 | 根因：审计 lineage 使用废弃 execution_id。修复：本文 §5 已将 harness_run_id/node_run_id 设为 canonical 关联键，execution_id 仅保留兼容查询 |
| `cost_and_budget_contract.md:§4`                     | CostEvent 用 task_id 为主键，harness_run_id/node_run_id 为 optional             | 已修复 | 根因：成本合同以 task_id 为必填，harness_run_id 为可选。修复：架构 §18 以 HarnessRun 为预算主体，CostEvent 已将 harness_run_id 设为关联主体 |
| `gateway_message_contract.md:§5`                     | DecisionRequest 用 task_id                                                      | 已修复 | 根因：网关消息 contract 按任务级 UI 模型定义审批。修复：T-65 已将 harness_run_id/node_run_id 提升为决策链权威关联键 |
| `gateway_streaming_contract.md:§3`                   | StreamEvent 用 task_id                                                          | 已修复 | 根因：streaming contract 沿用任务级 gateway 模型。修复：T-66 已改用 harness_run_id/node_run_id 主链 |
| `policy_engine_contract.md:§3.1`                     | PolicyDecisionRequest 用 execution_id                                           | 已修复 | 根因：policy engine 在执行模型升级后仍引用旧 runtime 参数。修复：T-67 已将 harness_run_id/node_run_id/attempt_id 提升为权威关联键 |
| `runtime_execution_contract.md:§3`                   | ExecutionEnvelope 含 workflow_id                                                | 已修复 | 根因：ExecutionEnvelope 使用废弃 workflow_id。修复：本文 §3 已将 workflow_id 标注为 legacy projection 引用，非 truth 主键 |
| `explainability_and_stage_rationale_contract.md:§3`  | StageRationale 用 task_id 为主键                                                | 已修复 | 根因：解释层复用旧认知视图草案，未绑定到具体运行链。修复：T-68 已以 harness_run_id/node_run_id/stage_view_ref 为权威键 |

### 2.5 HIGH — 关键 Contract 缺失 canonical 字段

| Contract                                  | 问题                                                                                            | 状态   | 根因与修复 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | ---------- |
| `node-run-attempt-receipt-contract.md:§4` | NodeAttemptReceipt 缺 harnessRunId/planGraphBundleId/graphVersion/duration（架构§5.3 明确要求） | 已修复 | 根因：contract 跟随底层存储命名暴露 table-shaped 字段名。修复：T-46 已将主键收敛到 receiptId，并补齐 harnessRunId/planGraphBundleId/graphVersion/durationMs |
| `event_bus_contract.md:§3`                | EventEnvelope 缺 schema_version/idempotency_key/causation_id/partition_key/ttl/payloadHash      | 已修复 | 根因：EventEnvelope 字段定义不完整。修复：本文 §3 最小字段表已包含全部 6 个字段（schema_version/idempotency_key/causation_id/partition_key/ttl/payloadHash）及使用规则 |
| `plugin_spi_contract.md:§2.4`             | DomainPresenterPlugin.present() 接收废弃 DualChannelStepOutput 而非 NodeAttemptReceipt          | 已修复 | 根因：Plugin SPI 仍沿用旧 step output 类型。修复：本文 §2.4 已明确 present() 接收 NodeAttemptReceipt，并在 §3 强制规则中标注 DualChannelStepOutput 为废弃警告 |

### 2.6 HIGH — workflow_debugger_contract 完全基于废弃模型

| Contract                               | 问题                                                                                                         | 状态   | 修复说明                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `workflow_debugger_contract.md` (全文) | 用 workflow_id/step_selector 作为 breakpoint 锚点；无 HarnessRun/NodeRun/PlanGraph 引用；无 v4.3 remediation | 已修复 | 根因：contract 基于废弃 workflow 调试器原型。修复：全文迁移到 HarnessRun/NodeRun/PlanGraph 语义；新增完整模型定义及 remediation 说明 |

### 2.7 MED — 其他 Contract 问题

| Contract                                              | 问题                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `admin_console_and_human_takeover_contract.md:§4` | Human takeover 用 step 语义，不要求 RuntimeStateMachine.transition()，无 budget reservation | 已修复 | 根因：takeover contract 未对齐 state machine。修复：§4 现强制所有状态变更必须通过 RuntimeStateMachine.transition() 并要求 budget reservation |
| `agent_definition_lifecycle_contract.md:§3` | lifecycle_state 迁移无 RuntimeStateMachine enforcement | 已修复 | 根因：lifecycle contract 只给状态枚举，未定义受控迁移路径。修复：§3 现明确 lifecycle_state 变更必须通过 RuntimeStateMachine.transition() 执行 |
| `division_definition_contract.md:§2` | default_workflow/orchestration_workflow 作为 canonical reference | 已修复 | 根因：contract 使用废弃 workflow 引用。修复：§2 现以 default_plan_blueprint_ref/orchestration_plan_blueprint_ref 为 canonical，旧 workflow 键仅保留兼容别名 |
| `sla_tier_contract.md` | 无 HarnessRun/NodeRun 集成点，无 v4.3 remediation | 已修复 | 根因：SLA contract 未对齐 v4.3。修复：新增 §4A 明确集成字段表，要求 SLA 证据回链到 HarnessRun/NodeRun/NodeAttemptReceipt |
| `knowledge_boundary_and_federated_search_contract.md` | FederatedSearchRequest 缺 harnessRunId/nodeRunId 审计链 | 已修复 | 根因：search request 缺少审计字段。修复：FederatedSearchRequest 现包含 requester_tenant_id/harness_run_id/node_run_id 审计链字段 |
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
| R3-16 | CRITICAL | scale-ecosystem/multi-region/region-router/                   | 已修复：RegionDescriptorSchema 含 provider/endpoints/dataResidencyPolicy；status 为 active/standby/draining(非 degraded/disabled)。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/multi-region/region-router/index.ts` |
| R3-17 | CRITICAL | scale-ecosystem/multi-region/failover-controller/             | 已修复：RegionFailoverDecision 含 fencingEpoch；getNextFencingEpoch() 在每次 failover 时递增。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/multi-region/failover-controller/index.ts` |
| R3-18 | CRITICAL | scale-ecosystem/integration/connector-registry/               | 已修复：ConnectorManifestSchema 含 capabilityProfile: ConnectorCapabilityProfileSchema，含 actionRiskProfiles/permissionProbes/quotaProbes/credentialRotationPolicy。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/integration/connector-registry/index.ts` |
| R3-19 | HIGH     | scale-ecosystem/sla-engine/tier-resolver/                     | 已修复：SlaTierSchema 含 availability/externalP95/internalP99/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel（均有默认值）。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/sla-engine/tier-resolver/index.ts` |
| R3-20 | HIGH     | scale-ecosystem/sla-engine/sla-operations-service.ts          | 已修复：WORKFLOW_CLASS_LATENCY_MULTIPLIER 对 deterministic(0.5x)/llm_assisted(1.5x)/hitl_waiting(2.0x) 分别承诺；evaluate() 用 latencyMultiplier 调整 commitment。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/sla-engine/sla-operations-service.ts` |
| R3-21 | HIGH     | scale-ecosystem/marketplace/catalog/                          | 已修复：MarketplaceCatalogEntrySchema 用 entryId（含 packId/rating/installCount）；certificationStatus 为 unc_certified/self_certified/third_party_certified/platform_certified。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/marketplace/catalog/index.ts` |
| R3-22 | HIGH     | org-governance/compliance-engine/framework-catalog.ts         | 已修复：auditRequirements 已定义为 AuditSpec[]（含 frequency/evidenceType/retentionPeriod）。根因：审计快照未反映本轮修复。源码：`src/org-governance/compliance-engine/framework-catalog.ts` |
| R3-23 | HIGH     | org-governance/compliance-engine/inheritance/                  | 已修复：PolicyStrictnessComparator 接口已定义，comparePolicyStrictness() 在 incomparable 时返回 requiresComplianceApproval:true。根因：审计快照未反映本轮修复。源码：`src/org-governance/compliance-engine/inheritance/index.ts` |
| R3-24 | HIGH     | org-governance/approval-routing/route-engine/                  | 已修复：isInSameApprovalChain() 现双向遍历链（requester→ancestors 和 approver→ancestors），捕获同链互批关系。根因：原实现仅检查 requester 的祖先链，未检查 approver 的祖先链是否包含 requester。源码：`src/org-governance/approval-routing/route-engine/index.ts` |
| R3-25 | HIGH     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts  | 已修复：ChineseWallAccessSaga.execute() 实现完整两阶段提交（prepare→commit→compensate），prepare 必须先于 commit，失败时执行补偿。根因：审计快照未反映本轮修复。源码：`src/org-governance/knowledge-boundary/chinese-wall-access-saga.ts` |
| R3-26 | HIGH     | scale-ecosystem/resource-manager/quota-enforcer/               | 已修复：QuotaPolicySchema 含 multiResourceHardLimits: MultiResourceQuotaVectorSchema；evaluateMultiDimensionalQuota() 遍历全部 7 维（worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io）并返回 failedDimensions。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/resource-manager/quota-enforcer/index.ts` |
| R3-27 | MEDIUM   | org-governance/delegated-governance/                           | 已修复：GovernanceDelegationRevocationSaga 支持 cascadeScope 参数，DEFAULT_CASCADE_SCOPE 覆盖 pendingApprovals/activeSessions/secretLeases/workerLeases/scheduledTriggers。根因：审计快照未反映本轮修复。源码：`src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts` |
| R3-28 | MEDIUM   | org-governance/org-model/org-governance-saga.ts               | 已修复：executeWithReceipt() 返回 OrgGovernanceSagaReceipt，含 phaseCommitOrder: PHASE_ORDER (identity→approval→budget→domain→agent)及 preparedByPhase/committedByPhase/compensatedByPhase。根因：审计快照未反映本轮修复。源码：`src/org-governance/org-model/org-governance-saga.ts` |
| R3-29 | MEDIUM   | org-governance/sso-scim/identity-sync-service.ts              | 已修复：bootstrap() 调用 processDlqWithRetry() 和 generateDailyReconciliation()，返回 IdentityReconciliationReport；retryDlqRecord() 实现指数退避 (BASE_BACKOFF_MS*2^retryCount)。根因：审计快照未反映本轮修复。源码：`src/org-governance/sso-scim/identity-sync-service.ts` |
| R3-30 | MEDIUM   | scale-ecosystem/multi-region/cross-region-routing-service.ts  | 已修复：executeCrossBorderTransferChain() 实现完整 5 步链（JurisdictionClassifier→TransferImpactAssessor→MechanismSelector→DataMinimizer→OutputScanner），返回 CrossBorderTransferChainResult。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/multi-region/cross-region-routing-service.ts` |
| R3-31 | MEDIUM   | scale-ecosystem/billing/types.ts                              | 已修复：RecordUsageInput 含 metricDimensions: ReadonlyArray<{dimensionKey, dimensionValue}>；RecordUsageResult 含 dimensionQuotaCounters: ReadonlyArray<QuotaCounterRecord>。根因：审计快照未反映本轮修复。源码：`src/scale-ecosystem/billing/types.ts` |
| R3-32 | MEDIUM   | org-governance/knowledge-boundary/sharing-gate/               | 已修复：evaluateKnowledgeShare() 返回 CrossBoundaryTransformResult | null（含 mode: summary | field_filter 和 allowedFieldKeys）。根因：审计快照未反映本轮修复。源码：`src/org-governance/knowledge-boundary/sharing-gate/index.ts` |

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
| R3-65 | HIGH   | typed_event_bus_contract.md                        | OAPEFLIR 事件 payload 全部用 task_id/workflow_id/execution_id；§5.5 要求 harnessRunId/nodeRunId/planGraphId                                         | 已修复 | 根因：早期事件设计未接入 v4.3 运行链标识体系。修复：3A 节所有 payload 类型现以 harnessRunId/nodeRunId/planGraphId 为权威锚点 |
| R3-66 | HIGH   | typed_event_bus_contract.md                        | PlanCreatedPayload 用 step_count 暗示线性步骤；§5 要求 PlanGraph(图结构)                                                                            | 已修复 | 根因：payload 使用线性模型。修复：用 nodeCount + edgeCount 取代 step_count，显式表达图结构 |
| R3-67 | HIGH   | typed_event_bus_contract.md                        | ExecutionCompletedPayload 定义 execution_id/outcome/output_refs 为执行结果模型；与 §5 NodeAttemptReceipt(receiptId/nodeRunId/attemptId/status) 冲突 | 已修复 | 根因：payload 使用废弃 execution 模型。修复：现使用 NodeAttemptReceipt 模型字段 |
| R3-68 | HIGH   | explainability_and_stage_rationale_contract.md     | StageRationale 仅 7字段；§59.3 要求 11字段(缺 rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives)                 | 已修复 | 根因：stage rationale 缺少架构要求字段。修复：现扩展到 14 字段，含 rationaleId/decisionInputRef/versionLockRef/visibilityLabels/confidence/alternatives |
| R3-69 | HIGH   | workflow_debugger_contract.md                      | BreakpointDefinition 用 workflow_id/step_selector；§5.5 应为 harnessRunId/nodeRunId                                                                 | 已修复 | 根因：contract 基于废弃模型。修复：全文迁移到 harness_run_id/node_run_id/node_selector 锚点 |
| R3-70 | HIGH   | startup_consistency_and_recovery_drill_contract.md | 一致性矩阵用 current_step_index/workflow_state；应为 HarnessRun.status/NodeRun.status/PlanGraph                                                     |
| R3-71 | MEDIUM | budget-ledger-contract.md                          | BudgetReservation.resourceKind 枚举缺 §18 要求的 storage/bandwidth/memory                                                                           |
| R3-72 | MEDIUM | naming_and_engineering_boundary_contract.md        | §2 列 WorkflowExecutor 为 canonical 工程名；§5 canonical 入口为 HarnessRuntime                                                                      |
| R3-73 | MEDIUM | admin_console_and_human_takeover_contract.md       | takeover 操作用步骤语言(修改下一步/跳过某步/重试某步)；§5.5 操作粒度为 NodeRun                                                                      | 已修复 | 根因：takeover contract 未对齐 state machine。修复：§4 现锚定到 HarnessRun/NodeRun/NodeAttempt，强制状态迁移与预算预留走正式控制链 |
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
| R4-6  | HIGH     | platform/contracts/executable-contracts/       | NodeAttemptReceipt 缺 harnessRunId/planGraphId/graphVersion/duration/error_detail(§5.3 必填)                                                           | 已修复   | 根因：NodeAttemptReceipt 类型定义不完整。修复：executable-contracts/index.ts:362-379 已补全全部字段(harnessRunId/planGraphId/graphVersion/duration/errorDetail)，createNodeAttemptReceipt() 工厂已同步更新 |
| R4-7  | HIGH     | platform/contracts/executable-contracts/       | RequestEnvelope 缺 confirmedTaskSpecId/principal(typed)/idempotencyKey/priority(§5.3 intake pipeline)                                                  | 已修复   | 根因：executable-contracts RequestEnvelope 缺少 intake pipeline 必填字段。修复：index.ts:126-139 已补全 priority 字段，createRequestEnvelopeFromConfirmedTask() 已支持 priority 参数 |
| R4-8  | HIGH     | platform/contracts/state-command/              | StateCommand 无 leaseId/fencingToken/event/principal——无法满足 INV-STATE-001                                                                           | 已修复   | 根因：StateCommand 类型定义不完整。修复：state-command/index.ts:13-27 已补全 leaseId/fencingToken/event/principal 全部缺失字段 |
| R4-9  | HIGH     | platform/contracts/                            | 缺 EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand 三个 §5.3 inter-plane 契约模块                                                           | 已修复   | 根因：inter-plane contracts 从未创建。修复：state-command/index.ts:63-103 已定义全部三个 inter-plane command 接口(EventAppendCommand/AuditAppendCommand/ArtifactWriteCommand) |
| R4-10 | HIGH     | platform/contracts/types/platform-contracts.ts | SideEffectRecord 仅 4态(proposed/committed/rolled_back/failed)；executable-contracts 定义 16态——两套冲突共存                                           | 已修复   | 根因：dual SideEffectRecord state definitions。修复：platform-contracts.ts 仅保留 SideEffectExpectation(非 SideEffectRecord)，SideEffectRecord 统一使用 executable-contracts 的 16 态定义 |
| R4-11 | MEDIUM   | platform/contracts/executable-contracts/       | LEGACY_CONTRACT_NAMES 列表无强制机制——无 deprecation warning/re-export guard/CI lint 阻止新代码导入废弃模块                                            | 已修复   | 根因：无 CI enforcement for deprecated contracts。修复：eslint.config.js 已添加 no-restricted-imports 规则，阻止从 request-envelope/control-directive/execution-plan/execution-receipt/state-command 导入 |
| R4-12 | MEDIUM   | platform/contracts/index.ts                    | Barrel 导出优先废弃类型(requestEnvelopeContract)而非 executable-contracts——激励消费废弃接口                                                            | 已修复   | 根因：barrel export 未优先 canonical。修复：index.ts:44-47 已移除 createRequestEnvelope 导出，仅导出 canonical RequestEnvelope 类型，legacy 导出仅保留 createLegacyRequestEnvelope 别名 |
| R4-13 | MEDIUM   | platform/contracts/executable-contracts/       | EventEnvelope 缺必填 runId(§28.1)；replayBehavior 为 optional(§28.1 要求 explicitly declared)；eventVersion 为 string 而非 §28.1 numeric schemaVersion | 已修复   | 根因：EventEnvelope fields incomplete。修复：index.ts:565-584 runId 已作为必填字段(非 optional)，replayBehavior 为必填(非 optional)，schemas.ts:628-629 已统一使用 schemaVersion 而非 eventVersion |
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

| #     | 严重度   | 文件                                            | 问题                                                                                                                    | 当前状态 | 根因与证据 |
| ----- | -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- | --------- |
| R5-1  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | Plan 阶段产出线性 Plan{steps[]}——非 PlanGraphBundle(§13.7 "Plan must be Graph")                                         | 已修复   | 根因：旧实现直接返回线性 Plan；修复：lines 299-343 已用 `createPlanGraphBundle()` 将 Plan 转为 PlanGraphBundle（nodes/edges/graphHash/validationReport）；`plan-builder.ts:64-156` 有完整 `buildGraphBundle()` 方法含 §13.9-13.12 图规范化/验证/风险传播/最坏路径分析 |
| R5-2  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | run() 是单程管线(O→A→P→E→F→L→I→R→return)；replanDecision 计算后无重入——不是循环(§45.7 要求重入 Plan/Execute)            | 已修复   | 根因：旧实现为线性管线无循环；修复：lines 183-673 已有 `while (shouldContinue)` 循环，replanDecision.shouldReplan 为 true 时通过 lines 578-652 重入 plan 阶段（shouldContinue=true，loopIteration++） |
| R5-3  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 StageTransitionFSM——FSM 为死代码；阶段转换无校验                                                                 | 已修复   | 根因：FSM 创建后从未调用；修复：lines 196-201/231-237/268-274/346-352/391-397 等处均调用 `stageFsm.canTransitionTo()` + `recordStageEntry()` 进行转换校验；stage-transition-fsm.ts:122-134 已支持 feedback→plan 后向转换（replan） |
| R5-4  | CRITICAL | orchestration/oapeflir/oapeflir-loop-service.ts | 未集成 HarnessLoopController——无 max-iteration/max-replan/max-duration/max-cost 守卫                                    | 已修复   | 根因：HarnessLoopController 未实例化；修复：lines 176-181 用 ConstraintPack 初始化 loopController；lines 361-378 执行前调用 `loopController.getGuardViolation()` 检查并 abort；lines 580-651 重plan时调用 `recordIteration()/recordReplan()/evaluateProgress()` |
| R5-5  | HIGH     | orchestration/harness/index.ts decide()         | 无 downgrade_mode 决策分支(§58.6 要求 6种基础决策)                                                                      | 已修复   | 根因：HarnessDecisionAction 缺 downgrade_mode；修复：harness/index.ts:824 已添加 `action = "downgrade_mode"` 分支（riskScore > 0.8 时触发） |
| R5-6  | HIGH     | orchestration/oapeflir/assessment-service.ts    | Assess 不消费/产出 ConstraintPack/EffectivePolicySnapshot/RiskAssessment(§13.1.1)                                       | 部分修复 | 根因：AssessmentService 独立开发未接入 policy engine；当前 assessment-service.ts:40-47 已产出 riskAssessment（level/factors），但 ConstraintPack 消费和 EffectivePolicySnapshot 产出尚未实现；需在 assess() 输入/输出中增加这些类型 |
| R5-7  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Evaluator 产出 ExecutionOutcomeEvaluation 而非 §45.10 EvaluationReport(passed/score/issues[]/recommendation/confidence) | 已修复   | 根因：旧实现返回 ExecutionOutcomeEvaluation；修复：lines 479-486 已构造 EvaluationReport（passed/score/issues[]/recommendation/confidence）；lines 107-108 在 OapeflirLoopResult 中已包含 evaluationReport 字段 |
| R5-8  | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Release 阶段调 PolicyRolloutService.start() 无 EvaluationGate/approval/canary/rollback(§13.14)                          | 已修复   | 根因：rollout.start() 无质量门；修复：lines 531-536 调用 `rollout.startWithGating()` 传入 evaluationGate(evaluationReport)/requireApproval/canaryPercent/rollbackOnFailure；policy-rollout-service.ts:71-96 有 startWithGating 实现 |
| R5-9  | HIGH     | orchestration/planner/plan-builder.ts           | 无 Graph Normalization/Validation/Risk Propagation/Worst-Path Analysis(§13.9-13.12)                                     | 已修复   | 根因：build() 只返回线性 Plan；修复：buildGraphBundle() (lines 64-156) 包含：§13.9 图规范化（nodes/edges 构建）、§13.10 扩展验证（performExtendedValidation）、§13.11 风险传播（computeRiskPropagation）、§13.12 最坏路径（dagValidator.analyzeWorstPath） |
| R5-10 | HIGH     | orchestration/oapeflir/stage-transition-fsm.ts  | FSM 禁止所有后向转换——replan 在结构上不可能(§45.7/§13.4 要求 feedback→plan)                                             | 已修复   | 根因：原 FSM 仅允许前向转换；修复：stage-transition-fsm.ts:122-134 已实现 feedback_driven_replan 逻辑，允许 feedback/learn/improve/release → plan/assess/execute 后向转换 |
| R5-11 | HIGH     | orchestration/oapeflir/oapeflir-loop-service.ts | Observer 仅合并 TaskSituation+SystemSituation；缺事件流/目标分解/记忆/前次运行上下文(§45.8)                             | 已修复   | 根因：Observer 只合并两个 Situation；修复：lines 214-221 用 previousRunContext 注入 eventFlowRefs/goalDecompositionRef/memoryRefs；OapeflirLoopInput (lines 67-74) 已定义 previousRunContext 类型 |
| R5-12 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Replan 无 GraphPatch 产出(§13.13 要求 baseGraphVersion+operations[]+compatibilityReport)                                | 已修复   | 根因：replan 只返回 Plan 无 GraphPatch；修复：lines 594-610 已在 replan 分支构造 createGraphPatch（baseGraphVersion/newGraphVersion/operations[]/affectedExecutedNodes/compatibilityClass）；OapeflirLoopResult (line 112) 包含 graphPatch 字段 |
| R5-13 | MEDIUM   | orchestration/oapeflir/oapeflir-loop-service.ts | Execute 用 flat ExecuteBridge 无 subgraph/child-run 支持(§13.7 要求子任务/委托显式建模)                                 | 部分修复 | 根因：ExecuteBridge.executePlan() 只处理单 Plan；当前：lines 381-387 注释标注 "R5-13: Execute with subgraph/child-run support if parentContext provided"；parentContext 类型已在 OapeflirLoopInput (lines 76-80) 定义；但 ExecuteBridge 实现尚未支持 subgraph 执行 |
| R5-14 | LOW      | orchestration/oapeflir/oapeflir-loop-service.ts | OapeflirLoopResult 无 HarnessDecision 字段——OAPEFLIR 层与 Harness 决策模型断连                                          | 已修复   | 根因：Result 缺 harnessDecision；修复：lines 113-114 已在 OapeflirLoopResult 添加 `harnessDecision: HarnessDecision | null`；lines 367-377/641-650 在 guard 触发时构造并返回 HarnessDecision |

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
| R5-67 | MEDIUM   | ADR-047             | auto_action 超时自动执行无风险级别守卫(§10.3 high/critical 默认 deny)                                                   |



### 29. Intake 准入 + Dispatcher 调度缺口（§5.3/§14/§25.4）

| #     | 严重度 | 文件                                                      | 问题                                                                                                     |
| ----- | ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R6-1  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | §5.3 ClarificationSession 阶段完全缺失；admit() 直接 RawTaskInput→TaskDraft→ConfirmedTaskSpec 无澄清循环 |
| R6-2  | HIGH   | orchestration/harness/runtime/intake-admission-service.ts | high/critical 任务不强制 UserConfirmationReceipt(§39.6)——confirmationReceipt 可选且 critical 时仍放行    |
| R6-3  | HIGH   | execution/dispatcher/admission-controller.ts              | 缺 §14.2 调度因子：无 risk-class 隔离路由/无 tenant-quota/无 sandbox 匹配/无 capability-class 门禁       |
| R6-4  | HIGH   | execution/dispatcher/                                     | 无确定性图调度器(§14.9)——应按 priority/risk_class/critical_path_rank/created_order/scheduler_seed 调度   |
| R6-5  | HIGH   | execution/dispatcher/                                     | 缺 §14.9 emergency lane(critical NodeRun 独立通道)                                                       |
| R6-6  | HIGH   | execution/dispatcher/                                     | 缺 dispatch_backpressure_rejected 事件+DLQ 集成(§14.9)                                                   |
| R6-7  | HIGH   | execution/dispatcher/                                     | §14.9 scheduler events 缺 ready_set/selected_node_ids/ordering_policy_version/worker_pool_snapshot_ref   |
| R6-8  | MEDIUM | execution/dispatcher/admission-controller.ts              | priority 用 "urgent" 而非 §5.3 canonical "critical"                                                      |
| R6-9  | MEDIUM | execution/dispatcher/                                     | dispatch 前不验证 budget reservation 存在(§14.2 无 active reservation 不得调度)                          |
| R6-10 | MEDIUM | execution/worker-pool/worker-registry-service.ts          | 无 heartbeat staleness 检测(§14: gap>30s 触发 worker_heartbeat_missing 事件+lease_reclaim)               |
| R6-11 | MEDIUM | orchestration/routing/intake-router.ts                    | 仅关键词匹配无 LLM intent extraction/confidence threshold(0.80)/AmbiguityResolver(§39.3)                 |
| R6-12 | MEDIUM | orchestration/harness/runtime/intake-admission-service.ts | policyGuard.allowed 硬编码 true——§25.4/§45.2 准入时策略/能力/风险检查为虚设                              |

### 30. 类型系统 + API 序列化 + 共享层问题

| #     | 严重度   | 文件                                                       | 问题                                                                                                             |
| ----- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| R6-13 | CRITICAL | harness/index.ts vs contracts/executable-contracts/        | 两套冲突 HarnessRun 接口(runId+steps[] vs harnessRunId+confirmedTaskSpecId+currentSeq)——无统一 re-export/adapter |
| R6-14 | CRITICAL | contracts/control-directive/ + types/platform-contracts.ts | 两套不兼容 ControlDirective(kind enum vs type enum)——废弃类型双重存在且无 canonical 替代                         |
| R6-15 | CRITICAL | contracts/execution-plan/ + types/platform-contracts.ts    | 两套 ExecutionPlan(均线性 steps[])——废弃类型双重可构造无 @deprecated 注解                                        |
| R6-16 | CRITICAL | interface/api/http-server/task-routes.ts                   | POST /v1/tasks 接受 {title,priority,source} 完全绕过 §5.3 intake pipeline                                        |
| R6-17 | HIGH     | interface/api/http-server/schemas.ts                       | Task status 枚举(queued/pending/in_progress/done/failed/cancelled)无法表示 canonical 13态 HarnessRunStatus       |
| R6-18 | HIGH     | 全 src/                                                    | OperationalDirective/DecisionDirective 零实现/零 schema/零 import——§5.2 contract 矩阵完全未落地                  |
| R6-19 | HIGH     | 全 src/ 870+ 处                                            | stepId 仍为普遍执行标识(plugin-spi/域注册/presenter/migration/SDK)——§5.5 仅允许作 legacy projection              |
| R6-20 | HIGH     | harness/index.ts:174                                       | HarnessRun 含 steps:HarnessStep[] 为第一级字段——§5.5 HarnessStep 仅为 semantic projection，嵌入使违规天然化      |
| R6-21 | MEDIUM   | execution/lease/execution-lease-service-async.ts:502       | `as any` cast 在 lease audit 关键路径——绕过类型安全                                                              |
| R6-22 | MEDIUM   | ops-maturity/edge-runtime/edge-orchestrator/               | EdgeExecutionPlan 用线性 orderedTaskIds 而非 PlanGraph(§4.4)                                                     |
| R6-23 | MEDIUM   | contracts/executable-contracts/schemas.ts:650              | validateExecutableContract() 返回 unknown——校验后无类型收窄                                                      |
| R6-24 | MEDIUM   | orchestration/harness/runtime/runtime-entry-guard.ts       | assertNoLegacyTruthWrite() 仅运行时拦截——无编译时 @deprecated/no import 强制                                     |

### 31. 测试体系编码错误模型（阻断迁移）

| #     | 严重度   | 文件                                                | 问题                                                                                                                       |
| ----- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| R6-25 | CRITICAL | tests/unit/platform/contracts/execution-plan/       | 400+ 行验证 createExecutionPlan/ExecutionPlanStep+stepId 为正确行为——将废弃 contract 作为正确性基线                        |
| R6-26 | CRITICAL | tests/e2e/multi-step-workflow-comprehensive.test.ts | 7个场景全部驱动 WorkflowState CRUD 线性步骤模型——迁移到 canonical 会破坏全部 e2e                                           |
| R6-27 | CRITICAL | tests/e2e/multi-step-task-execution.test.ts         | 18+ WorkflowState 调用断言线性步进——编码废弃执行模型为正确                                                                 |
| R6-28 | CRITICAL | tests/e2e/critical-workflows.test.ts                | 16+ WorkflowState 调用断言废弃状态转换(running→paused→completed)                                                           |
| R6-29 | CRITICAL | tests/unit/platform/contracts/control-directive/    | 50+ 断言验证 createControlDirective 为正确——废弃 contract 有完整回归保护                                                   |
| R6-30 | HIGH     | tests/integration/platform/contracts/               | 集成测试导入并验证 createExecutionPlan+createControlDirective 流——作为回归门禁阻止废弃删除                                 |
| R6-31 | HIGH     | tests/golden/workflow-validation.test.ts            | golden snapshot 编码线性 steps[]+stepId+dependsOnStepIds——PlanGraph 迁移会破坏快照                                         |
| R6-32 | HIGH     | tests/helpers/fixtures/base.ts+composite.ts         | 所有 fixture 工厂产出 TaskRecord+ExecutionRecord 无 HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation                   |
| R6-33 | HIGH     | tests/e2e/oapeflir-full-loop.test.ts                | E2E 用 stepId-based PlanStep/StepResult 驱动 OAPEFLIR 为执行运行时(§2.4 OAPEFLIR 不为 truth source)                        |
| R6-34 | HIGH     | tests/e2e/ 全部                                     | 零 e2e 测试走 canonical intake pipeline；零 e2e 测试验证 BudgetReservation 前置；零 e2e 测试验证 SideEffectRecord 生命周期 |

### 32. 剩余 Contract 批量缺口

| #     | 严重度   | 文件                                                                                                | 问题                                                                                                                   |
| ----- | -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R6-35 | CRITICAL | event_bus_contract.md                                                                               | 事件名 task.status*changed/workflow.step_completed/execution.* 与架构 platform.harness*run.*/platform.node_run.\* 冲突 |
| R6-36 | CRITICAL | event_registry_and_ops_threshold_contract.md                                                        | 阈值规则绑定 execution._ 废弃事件类型——ops 告警无法捕获 canonical platform._ 事件                                      |
| R6-37 | CRITICAL | result_envelope_contract.md                                                                         | buildTaskResultEnvelope(task, stepOutputs, artifacts) 完全基于 pre-v4.3 模型                                           |
| R6-38 | CRITICAL | debug_inspect_health_backpressure_contract.md                                                       | TaskInspectView.executions[] + /executions/:executionId/inspect 全为废弃实体                                           |
| R6-39 | HIGH     | data_plane_contract.md                                                                              | ArtifactRef.source_execution_id 应为 source_harness_run_id/source_node_run_id                                          |
| R6-40 | HIGH     | app_error_contract.md                                                                               | AppError.execution_id 用 legacy 标识符                                                                                 |
| R6-41 | HIGH     | audit_lineage_and_retention_contract.md                                                             | 审计记录用 execution_id 无 harness_run_id/node_run_id——谱系链断裂                                                      |
| R6-42 | HIGH     | context_compaction_and_overflow_contract.md                                                         | CompactionRecord 用 session_id/task_id 无 harness_run_id/node_run_id                                                   |
| R6-43 | HIGH     | workflow_io_compatibility_precheck_contract.md                                                      | 主字段 workflow_id/step_id 无 PlanGraphBundle/NodeRun                                                                  |
| R6-44 | HIGH     | knowledge_spi_contract.md                                                                           | 无 harness_run_id 集成；TrustLevel 4级未引用 §29 知识边界规则                                                          |
| R6-45 | MEDIUM   | sla_tier_contract.md / quota_preemption / multimodal_gateway / org_hierarchy / feedback_improvement | 均不足 60行，缺 ContractEnvelope compliance + remediation section                                                      |

### 33. ADR 与架构矛盾（第三批）

| #     | 严重度   | ADR     | 问题                                                                                                                  |
| ----- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| R6-46 | CRITICAL | ADR-079 | FeedbackSignal 用 taskId+executionId 为关联键；v4.3 canonical 为 harnessRunId/nodeRunId——学习对象无法 join truth      |
| R6-47 | CRITICAL | ADR-080 | FailurePattern/EvidenceRef 用 executionId——同 R6-46，Learning 子系统与 truth 断连                                     |
| R6-48 | CRITICAL | ADR-033 | Status Accepted 定义 Phase 1-7 为 canonical roadmap 含 evaluatePhaseAdvance() gate；§33 明确仅历史映射——应 Superseded |
| R6-49 | HIGH     | ADR-038 | Canary stages CANARY_5/20/50/100 与 ADR-075 canonical rollout 态(canary_5/partial_25/50/75/stable) 冲突               |
| R6-50 | HIGH     | ADR-009 | 用 src/core/ 作为 canonical 目录+workflow_state 作为恢复表——v4.3 §35 用 src/platform/ + harness_runs                  |
| R6-51 | HIGH     | ADR-007 | "Supervisor" 拥有重启/暂停/升级/终止 Agent 权限——v4.3 §45 将全部生命周期控制归 HarnessRuntime                         |
| R6-52 | HIGH     | ADR-070 | Status Accepted 列 Phase 1-7 + "OAPEFLIR 循环不变" 无 v4.3 限定(仅 projection)——应 Superseded                         |
| R6-53 | HIGH     | ADR-041 | TriggerAction.create_task 绕过 §5.3 intake pipeline                                                                   |
| R6-54 | MEDIUM   | ADR-069 | OpsCapability 含 restart_service/scale_up_down 直接执行——未经 HarnessRuntime+PlanGraphBundle                          |
| R6-55 | MEDIUM   | ADR-072 | 测试矩阵按 OAPEFLIR 模块目录组织而非 v4.3 canonical runtime 模块                                                      |
| R6-56 | MEDIUM   | ADR-078 | Knowledge TrustLevel 无 §10 risk model inherent_risk+trust_score 分离映射——可能隐式降低风险                           |


### 35. UI Monorepo 实现 vs UI 架构规格（§1-§7）

| #     | 严重度 | 文件/领域                                        | 问题                                                                                           |
| ----- | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| R7-1  | P0     | ui/apps/web/src/feature-registry.ts              | 27个 feature 全部 eager import 无 code split；§4.4.1 要求除 / 和 /login 外全部 React.lazy      |
| R7-2  | P0     | ui/vitest.config.ts                              | 覆盖率阈值(lines:30%/branches:20%) 远低于 §7.2.6(shared≥90%/ui-core≥80%/features≥70%/apps≥50%) |
| R7-3  | P0     | ui/scripts/perf-budget.mjs                       | JS chunk 550KB/total 1200KB——§7.3.1 要求 main<200KB gz/lazy chunk<100KB gz(超 2.75-5.5x)       |
| R7-4  | P1     | ui/apps/web/src/app-shell.tsx                    | 路由为扁平单路径——无 §4.4.1 L2-L5 嵌套下钻路由(/tasks/:id/evidence 等)                         |
| R7-5  | P1     | ui/packages/features/                            | 缺 feature-flags 模块(§4.1 Admin 下独立路由 /admin/feature-flags)                              |
| R7-6  | P1     | ui/packages/features/settings/                   | Settings 无子路由导航——§4.2.9 定义 8个子页面均缺失                                             |
| R7-7  | P1     | ui/packages/shared/api-client/                   | 缺 /api/v1/meta/contract-version 端点(§1.8 契约版本协商)                                       |
| R7-8  | P1     | ui/packages/shared/api-client/ws-event-router.ts | 缺 nl.clarification_needed 事件映射(§5.3)                                                      |
| R7-9  | P1     | ui/ root                                         | 缺 Playwright/Detox/Spectron/axe-core 依赖(§7.2.4 E2E+无障碍测试)                              |
| R7-10 | P1     | ui/packages/shared/i18n/                         | 仅 4个翻译 key/2 locale——§6.4 要求全模块覆盖                                                   |
| R7-11 | P2     | ui/packages/ui-core/src/design-tokens/           | 无 primitive/semantic token 分层(§6.3.1)                                                       |
| R7-12 | P2     | ui/apps/web/src/app-shell.tsx                    | 路由守卫硬编码 demo 权限——§4.4.3 要求 5层动态 guard chain                                      |
| R7-13 | P2     | ui/packages/shared/api-client/rest-client.ts     | 缺 Idempotency-Key header 支持(§5.6.4)                                                         |
| R7-14 | P2     | ui/pnpm-workspace.yaml + turbo.json              | 与 §2.2 ADR 选定的 npm workspaces 冲突——vestigial 配置                                         |

### 36. 后端 UI 服务 vs UI 架构规格（§4-§5）

| #     | 严重度 | 文件/领域                                              | 问题                                                                                                                 |
| ----- | ------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| R7-15 | P0     | src/interaction/dashboard/dashboard-projection-service | FIXED - DashboardProjectionState (lines 392-410) now includes 13 fields per UI spec §4.7.7: successRate, avgDurationMs, activeAgents, queueDepth, errorRate, p50LatencyMs, p99LatencyMs, budgetUtilizationPercent, approvalPendingCount, systemHealthScore plus base metrics |
| R7-16 | P0     | src/interaction/dashboard/dashboard-websocket-server   | FIXED - DashboardPushMessageType (lines 27-39) now uses domain events per UI spec: task.status_changed/created/completed/failed, approval.requested/resolved, incident.opened/resolved, system.health_changed |
| R7-17 | P0     | src/interaction/dashboard/dashboard-websocket-server   | FIXED - Subscription model is now channel-based per UI spec (lines 65-74): DashboardChannel type with global/task/approvals/admin and ChannelSubscription interface |
| R7-18 | P1     | src/interaction/dashboard/                             | FIXED - DashboardWebSocketServer.integrateWithProjectionService() (lines 402-417) and setDeltaHandler() (lines 392-394) provide full integration |
| R7-19 | P1     | src/interaction/dashboard/metric-aggregator/           | FIXED - metric-aggregator/index.ts provides 6 metric interfaces plus DashboardMetricSummary (lines 45-55) combining tasks/workflows/system/cost/approvals/alerts with activeAgents/successRate/avgDurationMs |
| R7-20 | P1     | src/interaction/dashboard/health-scorer/               | FIXED - StructuredHealthScore interface (health-scorer/index.ts lines 7-16) returns 9 fields per UI spec StabilityPanelView: overall, uptime, errorRate, p50LatencyMs, p99LatencyMs, queueDepth, activeWorkers, budgetUtilizationPercent, findings |
| R7-21 | P1     | src/interaction/dashboard/alert-router/                | FIXED - AlertRouter class (alert-router/index.ts lines 73-201) implements routeNotifications(), getOverlayAlerts(), getPushNotifications(), getHapticAlerts() with delivery history tracking |
| R7-22 | P1     | src/platform/interface/api/mission-control-service     | MissionControlSnapshot DTO 与 UI spec Dashboard wireframe 字段不匹配                                                 |
| R7-23 | P1     | src/platform/interface/api/mission-control-service     | getWorkflowCockpit() 返回 inspect-oriented shape 而非 UI spec presentation shape                                     |
| R7-24 | P1     | src/platform/interface/api/mission-control-service     | getStabilityPanel() 返回数组而非 UI spec 要求的标量计数                                                              |
| R7-25 | P1     | src/interaction/ux/workflow-builder-service            | 仅内部方法无 REST 端点；UI spec 要求 CRUD + validate + publish API                                                   |
| R7-26 | P1     | src/interaction/ux/conversation-history-service        | 缺 clarificationState/riskPreview/actionOptions[] 字段                                                               |
| R7-27 | P1     | src/interaction/ux/conversation-history-service        | 无 WS 事件发射；UI spec 要求 nl.clarification_needed 实时推送                                                        |
| R7-28 | P2     | src/interaction/ux/ux-event-tracking-service           | 硬编码 "test:many_events" 事件类型；无 §5.4 规定的 standard event taxonomy                                           |
| R7-29 | P2     | src/interaction/ux/platform-workbench-snapshot-service | 路由与 UI spec §4.4.1 /workbench/:view 不匹配                                                                        |
| R7-30 | P2     | src/interaction/dashboard/                             | DashboardAggregationService 与 DashboardProjectionService 两套并行未集成                                             |

### 37. UI 相关 Contract/ADR 与 UI 架构矛盾

| #     | 严重度 | 文件/领域                                                     | 问题                                                                                         |
| ----- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R7-31 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | TaskCockpit 用 task_id/task_status/current_step——均为废弃术语（应为 harness_run_id/NodeRun） |
| R7-32 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | WorkflowCockpit 用 workflow_id/steps/current_step_index——废弃线性模型                        |
| R7-33 | P0     | docs_zh/contracts/ui_console_and_cockpit_contract             | AdminTakeoverConsole 用 retry_step/skip_step/override_step_output——废弃操作                  |
| R7-34 | P1     | docs_zh/contracts/admin_console_and_human_takeover_contract   | 同样使用步骤语言(step_id/step_status)而非 PlanGraph NodeRun                                  |
| R7-35 | P1     | docs_zh/contracts/ui_console_and_cockpit_contract             | Contract 导航仅 4组；UI spec 有 Extended/Shared Features 含 12+ 模块                         |
| R7-36 | P1     | docs_zh/contracts/gateway_message_contract                    | 无 console WebSocket 推送协议定义                                                            |
| R7-37 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract  | WorkflowBuilderDraft.steps 用线性模型——应为 DAG nodes/edges                                  |
| R7-38 | P1     | docs_zh/contracts/hitl_experience_and_explainability_contract | 用废弃 step 术语（step_id/step_output/step_retry）                                           |
| R7-39 | P2     | ui/docs/adr/                                                  | 仅 placeholder README；UI spec 引用的 ADR-UI-001~009 全部不存在                              |
| R7-40 | P2     | docs_zh/contracts/sdk_surface_contract                        | 无 MissionControlService typed 端点定义                                                      |

### 38. 剩余平台缺口（API 网关/安全/可靠性）

| #     | 严重度 | 文件/领域                                    | 问题                                                                         |
| ----- | ------ | -------------------------------------------- | ---------------------------------------------------------------------------- |
| R7-41 | P0     | src/platform/interface/api/middleware/       | 无 rate-limiting middleware；§9.2 要求 per-endpoint-class 速率限制           |
| R7-42 | P0     | src/platform/interface/api/middleware/       | 无 Idempotency-Key middleware；§6.2 要求幂等保证                             |
| R7-43 | P0     | src/platform/interface/api/http-server/      | 响应缺 X-Trace-Id header；§6.2 要求全链路追踪透传                            |
| R7-44 | P0     | src/platform/contracts/                      | 无 inter-plane ContractEnvelope 签名验证；§5.2 要求签名+版本校验             |
| R7-45 | P0     | src/platform/                                | 无 bulkhead isolation pattern；§9.1 要求平面间故障隔离                       |
| R7-46 | P0     | src/platform/control-plane/iam/              | SAML 实现缺 X.509 trust-chain 验证/C14N/encrypted assertion（安全关键 TODO） |
| R7-47 | P1     | src/platform/interface/api/                  | 无 API 版本路由/协商机制；§6.4 要求 Accept-Version header 路由               |
| R7-48 | P1     | src/platform/stability/                      | 仅 rehearsal runner 无可复用可靠性库（circuit-breaker/retry/timeout 均缺失） |
| R7-49 | P1     | src/platform/interface/api/middleware/       | CORS 默认 allowedOrigins:["*"] + credentials:true——安全反模式                |
| R7-50 | P1     | src/platform/execution/worker-pool/          | WorkerDrainProtocol 40行 stub 缺 §8.2 drain-quiesce-terminate 三阶段行为     |
| R7-51 | P1     | src/org-governance/                          | 治理控制台缺持久审计日志 + RBAC 检查（标注 TODO）                            |
| R7-52 | P2     | src/platform/shared/stability/ vs stability/ | 重复模块树；职责边界不清                                                     |


### 40. 平台核心深层缺口（Model Gateway / Planner / Recovery / Evidence）

| #     | 严重度 | 文件/领域                                                             | 问题                                                                                                                                |
| ----- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R8-01 | P0     | src/platform/model-gateway/cost-tracker/budget-guard.ts               | Budget 检查为无状态比较；§18.3 要求原子 reserve→execute→settle + BudgetReservation 状态机；并发可超支                               |
| R8-02 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts           | Recovery 服务只读——分类故障并建议动作但从不执行；无 saga rollback/compensation executor/CompensationRecord                          |
| R8-03 | P0     | src/platform/orchestration/planner/plan-builder.ts                    | 构建 legacy Plan(steps array) 而非 PlanGraphBundle DAG；无 §13.9 图规范化/§13.11 风险传播/§13.12 最坏路径分析                       |
| R8-04 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | 无延迟 SLO 强制；缺 latency_optimized 路由策略/P99 追踪/data_residency/pii_input_detected 约束                                      |
| R8-05 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts | 路由决策仅内存——无持久化到 BudgetLedger 或 evidence store；缺模型选择审计轨迹                                                       |
| R8-06 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts      | getFallbackCandidates() 返回空数组使 D1 降级死代码；递归 route() 可栈溢出                                                           |
| R8-07 | P1     | src/platform/model-gateway/provider-registry/circuit-breaker.ts       | 失败率公式 `(failures/windowSec)*10` 非百分比；50% 阈值(§9.4)语义错误                                                               |
| R8-08 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts                   | runAbTest() 使用硬编码分数(0.85/0.90)模拟评估；无真实 LLM 调用/统计显著性检验                                                       |
| R8-09 | P1     | src/platform/state-evidence/events/event-registry.ts                  | 主事件类型用 legacy 命名(task:status_changed)；canonical platform.harness_run.\* 未接入主注册表                                     |
| R8-10 | P1     | src/platform/state-evidence/checkpoints/                              | Checkpoint 基于 workflow-step 而非 NodeRun/NodeAttempt；缺 graphVersion/planGraphId 无法与 PlanGraph 对齐                           |
| R8-11 | P1     | src/platform/state-evidence/knowledge/semantic-knowledge-graph.ts     | 仅3种边类型(contains/shared_keyword/same_document)；缺实体关系边/信任传播/knowledge.trust_downgraded 事件；纯内存无持久层           |
| R8-12 | P1     | src/platform/orchestration/planner/plan-evaluator.ts                  | 成本估算为 `steps.length * 1000` 硬编码常数；无 token 估算/并行分支检测(§13.8)/风险加权成本                                         |
| R8-13 | P1     | src/platform/orchestration/planner/plan-dag-validator.ts              | 仅验证环/自依赖/缺失依赖；不检查入口/终端节点存在性/executor 可用性/risk/budget/tool/sandbox 完整性(§13.10)                         |
| R8-14 | P1     | src/platform/execution/recovery/failure-classification.ts             | 分类器针对 coding-agent 错误(schema_error/lint_error/test_failure)；非通用平台恢复分类器(§9.6 异常分类法)                           |
| R8-15 | P2     | src/platform/model-gateway/cost-tracker/chargeback-service.ts         | 无多币种/汇率支持；§18.4 要求 original_currency/base_currency/FX snapshot                                                           |
| R8-16 | P2     | src/platform/model-gateway/fallback/index.ts                          | Fallback 选最便宜健康替代；无有序回退链(primary→secondary→tertiary) §15.4                                                           |
| R8-17 | P2     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts            | 管线 draft→review→staging→shadow→canary_5→partial_25→50→75→stable；§16.3 仅 canary(5%)→canary(20%)→stable；多余阶段无自动回滚质量门 |
| R8-18 | P2     | src/platform/state-evidence/memory/memory-layer-model.ts              | working 层 LRU 驱逐无 ContextTruncationReport；§29.2 要求"事实不可静默丢弃，压缩需附损失报告"                                       |

### 41. SDK / 插件 / 域注册 / 多区域 / 运维成熟度

| #     | 严重度 | 文件/领域                                                       | 问题                                                                                                        |
| ----- | ------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R8-19 | P0     | src/sdk/client-sdk/api-client.ts                                | 无 ContractEnvelope 包装；§5.2 要求所有 inter-plane 消息含 schemaVersion/commandId/correlationId/signature  |
| R8-20 | P0     | src/sdk/client-sdk/                                             | 无事件订阅/流式 API；§6/§28 要求 typed event subscription(PlatformFactEvent/ProjectionUpdate/run lifecycle) |
| R8-21 | P0     | src/sdk/harness-sdk/index.ts                                    | appendStep() 仍用 stage 字符串路由；不产出 NodeAttemptReceipt(§5.3)；nodeRunId/planGraphId 塞入 inputs bag  |
| R8-22 | P1     | src/sdk/harness-sdk/index.ts                                    | 无 PlanGraphBundle 构建/验证 API；§22 SDK 须暴露图级规划操作                                                |
| R8-23 | P1     | src/sdk/admin-sdk/index.ts                                      | 无 OperationalDirective/DecisionDirective typed 方法；pauseHarnessRun/abortHarnessRun 绕过指令信封模型      |
| R8-24 | P1     | src/plugins/builtin-plugin-registry.ts                          | 内置插件无 PluginManifest；§10 要求 owner/trustLevel/sbomRef/publicSdkSurface                               |
| R8-25 | P1     | src/plugins/adapters/github-adapter.ts                          | 插件加载无签名验证；§10 要求 signing.keyId/signature/algorithm 验证后才激活                                 |
| R8-26 | P1     | src/plugins/ (所有内置插件)                                     | 无完整生命周期钩子；仅 initialize/healthCheck/shutdown，缺 onLoad/onActivate/onDeactivate/onUnload(§10)     |
| R8-27 | P0     | src/domains/registry/domain-model.ts                            | 无 DomainManifest 类型；§37 要求含 capability matrix/risk classification/schema registry 引用               |
| R8-28 | P1     | src/domains/domain-specs.ts                                     | DomainRiskSpecSchema 缺 advisory_only/human_accountable/deterministic_hot_path_only 字段(§3.2 责任边界)     |
| R8-29 | P1     | src/domains/registry/                                           | 无专用 SchemaRegistry；§37 要求域输入/输出 schema 版本管理+兼容性检查                                       |
| R8-30 | P1     | src/domains/registry/domain-registry-service.ts                 | register() 自动 validated→registered 无冒烟测试门控；§37 要求验证门                                         |
| R8-31 | P2     | src/domains/registry/domain-model.ts:45                         | WorkflowConfigSchema.steps 为线性 z.array(StepTemplateConfigSchema)——§13 禁止复杂任务使用线性步骤           |
| R8-32 | P1     | src/scale-ecosystem/multi-region/                               | 无 fencing token/single-leader 写强制；§25.11/§52.3 要求 truth/budget/side-effect 写仅通过 fencing 单领导者 |
| R8-33 | P1     | src/scale-ecosystem/multi-region/cdc-replication-service.ts     | CDC 复制无冲突解决；applyBatch() 盲目应用事件无 epoch/版本 fencing 检查                                     |
| R8-34 | P2     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts  | 无 Chinese Wall 强制/跨租户数据移动阻断(§50 知识域隔离)                                                     |
| R8-35 | P1     | src/ops-maturity/workflow-debugger/workflow-debugger-service.ts | Debugger 使用 stepId/workflowId 术语而非 nodeRunId/planGraphId(§65)                                         |
| R8-36 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | Time-travel 用 stepId/executionId 作主键；应为 nodeRunId/harnessRunId(§5.5)                                 |
| R8-37 | P2     | src/ops-maturity/explainability/                                | 无 StageRationale/OAPEFLIR 投影消费；§59 要求渲染 OAPEFLIR StageRationale 为审计解释                        |
| R8-38 | P2     | src/ops-maturity/edge-runtime/                                  | Edge orchestrator 为单文件 stub；缺 §62 离线能力/本地模型执行/sync-queue+冲突解决/确定性回退                |
| R8-39 | P2     | src/ops-maturity/                                               | 无 OpsMaturityScore 聚合模型；§69 要求跨 drift/compliance/cost/explainability 维度评分                      |
| R8-40 | P1     | src/sdk/plugin-sdk/plugin-test-harness.ts                       | executePlugin() 全 mock 返回硬编码响应；§22.4 测试 harness 须在沙盒中执行真实插件生命周期                   |
| R8-41 | P2     | src/scale-ecosystem/marketplace/                                | 无 AgentCertification/PackCertificationGate；§55 发布前须经安全扫描/eval gate/SBOM 认证管线                 |
| R8-42 | P2     | src/sdk/plugin-sdk/plugin-definition.ts:26                      | PluginSecurityConfig.sandboxTier 含 "none"；§10 插件默认不信任——"none" 违反 INV-POLICY-001                  |

### 42. UI 深层缺口（组件库 / 无障碍 / 原生壳 / 离线 / 工具链）

| #     | 严重度 | 文件/领域                                               | 问题                                                                                                          |
| ----- | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R8-43 | P0     | ui/packages/shared/auth/src/auth-service.ts             | 无 token refresh 逻辑；§5.4.4 要求到期前 60s 主动静默刷新+并发锁+401→redirect                                 |
| R8-44 | P0     | ui/packages/shared/auth/src/auth-service.ts             | 无 PKCE 支持；handleSsoCallback 直接从 URL 参数读 token 无 code_verifier/code_challenge/授权码交换            |
| R8-45 | P0     | ui/packages/shared/platform/src/web-platform-adapter.ts | Token 明文存入 localStorage；§6.5.2 要求 HttpOnly Secure Cookie 或 memory-only                                |
| R8-46 | P1     | ui/packages/ui-core/src/components/                     | 极少 ARIA 覆盖；§6.4.3+§6.4.5 要求全交互元素含 role/aria-live/aria-label；ListCard/KeyValueTable/按钮均缺     |
| R8-47 | P1     | ui/packages/ui-core/src/components/                     | 无键盘焦点管理；§6.4.3 要求可见焦点环；designTokens.shadows.focusRing 已定义但组件未消费                      |
| R8-48 | P1     | ui/packages/ui-core/src/design-tokens/                  | 扁平 token 结构无 primitive/semantic/domain 分层；缺 risk-level/autonomy-level/status/domain 色阶(§6.3.1)     |
| R8-49 | P1     | ui/packages/ui-core/                                    | 无动画系统/prefers-reduced-motion 支持；§6.4.3 + §6.3.1 要求 animation.ts 含 fast/normal/slow/easing          |
| R8-50 | P1     | ui/packages/ui-core/src/components/                     | 组件库严重不完整；§6.3.2 要求 50+ 组件(8类)；当前仅 7个(StatusPill/ListCard/KeyValueTable/FeatureScaffold 等) |
| R8-51 | P1     | ui/packages/ui-core/src/themes/                         | Theme 为 JS 对象非 CSS Custom Properties；§6.3.3 要求 CSS vars + prefers-color-scheme media query             |
| R8-52 | P1     | ui/tools/mock-server/src/index.ts                       | Mock server 仅覆盖 3端点(dashboard/tasks/workflows)；§5.2 定义 30+ 端点；缺 approval/agent/policy/WS mock     |
| R8-53 | P1     | ui/tools/codegen/src/index.ts                           | Codegen 仅生成路径常量；§5.4.3 要求 typed endpoint 函数+query key factories+DTO 类型                          |
| R8-54 | P1     | ui/apps/mobile/src/App.tsx                              | 移动平台硬编码 android；§2.5.5/2.5.6 要求 Android+iOS 支持；无运行时平台检测                                  |
| R8-55 | P2     | ui/apps/electron-win/, ui/apps/tauri-\*/                | 无自动更新机制；§7.1.5+§2.5.2 要求 electron-updater/Sparkle/Tauri updater；桌面壳为清单 stub                  |
| R8-56 | P2     | ui/packages/shared/sync/src/offline-queue.ts            | OfflineMutation 缺 idempotencyKey/retryCount/status 字段(§5.4.5)                                              |
| R8-57 | P2     | ui/packages/shared/sync/src/conflict-resolver.ts        | 仅 server_wins/local_wins/shallow-merge；§5.5.4 要求数据类型特定冲突解决(CAS/幂等/先到先得)                   |
| R8-58 | P2     | ui/packages/features/\*/src/index.tsx                   | 无 Error Boundary；§5.6 要求 P0-P3 错误分级+fallback UI；单组件崩溃拖垮全应用                                 |
| R8-59 | P2     | ui/apps/tauri-macos/, ui/apps/tauri-linux/              | 无 Tauri 原生集成(Keychain/native menu/Spotlight/D-Bus/XDG/Wayland)；src-tauri/ 无 main.rs                    |
| R8-60 | P2     | ui/packages/ui-core/src/charts/                         | 图表无表格替代视图；§6.4.3 要求所有图表提供 table fallback 供屏幕阅读器使用                                   |

### 43. ADR / Contract 新发现矛盾与缺失

| #     | 严重度 | 文件/领域                                                   | 问题                                                                                                                                                                           |
| ----- | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R8-61 | P0     | docs_zh/adr/066-\*.md (×2)                                  | ADR-066 编号重复：compliance-report-auto-generation 与 plugin-spi-framework 共用同一编号                                                                                       |
| R8-62 | P0     | docs_zh/adr/060-explicit-planning-hub.md                    | 定义 Plan DTO(planId/taskId/steps:PlanStep[]/DAGStructure) 作为 P3→P4 canonical contract；v4.3 用 PlanGraphBundle/PlanGraph/PlanNode/PlanEdge——完全不同对象名；未标 superseded |
| R8-63 | P0     | docs_zh/adr/033-phased-roadmap.md                           | 定义 7-Phase 路线图；v4.3 §33 已替换为 Ring 1/2/3 模型；ADR 仍 Accepted 无 Ring 引用                                                                                           |
| R8-64 | P1     | docs_zh/contracts/event-envelope-contract.md                | 同一 schema 内混合 snake_case(schema_version/idempotency_key) 和 camelCase(eventId/eventType)                                                                                  |
| R8-65 | P1     | docs_zh/contracts/event_bus_contract.md                     | Legacy EventEnvelope 用 task_id 作关联字段；v4.3 要求 harnessRunId + aggregate 关联；parallel schema 未重定向                                                                  |
| R8-66 | P1     | docs_zh/adr/019-agent-handoff-four-layer-protocol.md        | HandoffSerializer.buildFromStepResult(result: StepResult) 引用废弃类型；v4.3 用 NodeAttemptReceipt                                                                             |
| R8-67 | P1     | 缺失 contract: Agent Delegation / Multi-Agent Collaboration | §19 定义完整委托协议(DelegationRequest/DelegationReceipt/depth C1-C7)；无对应 contract 文件                                                                                    |
| R8-68 | P1     | docs_zh/contracts/task-intake-request-contract.md           | TaskDraft/ConfirmedTaskSpec 无 domainId 字段；§30/§37 要求每个进入执行的任务携带已验证 domain_id                                                                               |
| R8-69 | P1     | docs_zh/contracts/harness-run-contract.md                   | HarnessRun 有 tenantId 无 domainId；§37 要求域绑定用于风险覆盖/知识边界/prompt 库选择                                                                                          |
| R8-70 | P1     | 缺失 contract: ReleaseDecisionView / ReleaseChannel         | §13 列 ReleaseDecisionView 为 canonical OAPEFLIR 投影对象；ADR-091 要求 ReleaseChannel；均无 contract                                                                          |
| R8-71 | P1     | docs_zh/adr/012-sqlite-phase-1-2-primary-store.md           | 仍 Accepted 范围为 "Phase 1a/1b"；v4.3 用 Ring 1 MVP；退出条件未映射到 Ring 边界                                                                                               |
| R8-72 | P1     | docs_zh/adr/013-eventemitter-phase-2-boundary.md            | 同上——范围 "Phase 1a/1b/Phase 2" 无 Ring 映射；退出触发器("Phase 2 是否替换")已无定义                                                                                          |
| R8-73 | P2     | docs_zh/contracts/typed_event_bus_contract.md §3A           | 所有 OAPEFLIR 事件载荷用 task_id/workflow_id 作主关联字段；v4.3 用 harnessRunId+aggregate 关联                                                                                 |
| R8-74 | P2     | docs_zh/adr/072-oapeflir-testing-strategy.md                | 测试 OAPEFLIR 为独立执行管线("O→A→P→E→F happy path" E2E)；v4.3 降级 OAPEFLIR 为仅投影/视图                                                                                     |
| R8-75 | P2     | docs_zh/contracts/runtime_state_machine_contract.md §1A     | 定义 OapeflirStage 为工作流级状态机(observe→assess→plan→...)；v4.3 说 OAPEFLIR 阶段仅为投影非状态机转换                                                                        |
| R8-76 | P2     | docs_zh/adr/002-division-system.md                          | 用"事业部"建模(division_id)；v4.3 §37/§46 用 DomainDescriptor+OrgUnit；ADR 仍 Accepted 未标废弃                                                                                |
| R8-77 | P2     | docs_zh/contracts/task_and_workflow_contract.md             | WorkflowState 含 division_id 必填字段；v4.3 canonical 对象(HarnessRun/TaskDraft/RequestEnvelope)无此字段                                                                       |

### 45. 执行平面深层缺陷（Lease / Dispatch / State-Transition / Delegation）

| #     | 严重度 | 文件/领域                                                                                 | 问题                                                                                                                                     |
| ----- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R9-01 | P0     | src/platform/execution/lease/execution-lease-service.ts:556-663                           | validateWriteAccess 不检查 expiresAt vs 当前时间；TTL 过期但未回收的 lease 仍允许写入(§8.3 stale detection)                              |
| R9-02 | P0     | src/platform/execution/state-transition/transition-service.ts:500-526                     | TaskTerminalTransitionService.apply() 用非 CAS 更新(updateTaskStatus/updateWorkflowState)；并发终态转换可互相覆盖，违反 RT-01 不变量     |
| R9-03 | P0     | src/platform/execution/lease/execution-lease-service-async.ts:247-289                     | releaseLeaseSync 不检查 lease.status!=="active"；已过期/已回收 lease 可被重新释放，破坏审计轨迹+双释放 worker slot                       |
| R9-04 | P1     | src/platform/execution/state-transition/transition-service.ts:110-119                     | EXECUTION_TRANSITIONS 仅定义 8态；§45.13 要求 13态(缺 queued/dispatching/paused/recovering/timed_out)                                    |
| R9-05 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:223-251                   | 无 poison-pill 检测；永久无匹配 worker 的 ticket 无限循环消耗扫描时间，无失败计数/重试限制/死信机制                                      |
| R9-06 | P1     | src/platform/orchestration/agent-delegation/delegation-manager.service.ts:55-76           | 所有委托状态(delegationStore/chainStore)纯内存 Map；进程重启丢失活跃委托链；SQLite delegation-repository 存在但从未接入                  |
| R9-07 | P1     | src/platform/orchestration/agent-delegation/delegation-manager.service.ts:405-428         | narrowPermissions 将父资源替换为子请求资源(非交集)；子 agent 可请求父未持有的资源，违反 §19 信任继承/仅收窄规则                          |
| R9-08 | P1     | src/platform/execution/lease/types.ts vs execution-lease-service.ts                       | MIN_LEASE_TTL_MS(5s)/MAX_LEASE_TTL_MS(30s) 定义但 acquireLease 从不强制；可传入 ttlMs:1 或 999999999(§8.3 TTL bounds)                    |
| R9-09 | P1     | src/platform/orchestration/routing/intake-router.ts                                       | 路由纯关键词匹配无 capability matching；§8.5 要求匹配 worker/agent 能力注册+容量                                                         |
| R9-10 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:227                       | 每 ticket 迭代实例化新 HealthService(backpressureSnapshot==null时)；O(n) 健康扫描+同批次票据间背压决策不一致                             |
| R9-11 | P2     | src/platform/orchestration/agent-delegation/call-depth-budget.ts vs topology-validator.ts | maxCallDepth=8 vs DEFAULT_MAX_DEPTH=3 两套独立深度限制互不协调；§19 要求单一权威深度限制                                                 |
| R9-12 | P2     | src/platform/state-evidence/truth/async-repositories/event-repository.ts                  | 无投影版本化；listEventsForTask 返回原始事件无 snapshot cursor/版本戳；每次读全量重放(§4.2 snapshot optimization)                        |
| R9-13 | P2     | src/platform/orchestration/routing/agent-team-service.ts:146                              | 执行循环硬编码 ["plan","build","review","validate","repair","validate","release"]；低风险单文件变更仍走完整 7阶段(§8.5 adaptive routing) |

### 46. OAPEFLIR / Harness / Bootstrap 深层问题

| #     | 严重度 | 文件/领域                                                                   | 问题                                                                                                                            |
| ----- | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R9-14 | P0     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:210            | OAPEFLIR 含直接执行逻辑(executeViaBridge 调用 executeBridge.executePlan)；§45 规定仅投影/视图，执行须委托执行平面               |
| R9-15 | P0     | src/index.ts:179-189                                                        | buildPlatformRootSummary 初始化所有平面目录无依赖顺序；§2 要求 control-plane→state-evidence→execution→orchestration→interaction |
| R9-16 | P1     | src/platform/orchestration/oapeflir/ (loop-service vs stage-transition-fsm) | StageTransitionFSM 完整实现(236行)但从未被 OapeflirLoopService.run() 实例化/咨询；FSM 为死代码，阶段顺序无强制                  |
| R9-17 | P1     | src/platform/orchestration/oapeflir/assessment-service.ts:65                | routingDecision.division 硬编码 "coding"；非编码域任务永远被误路由                                                              |
| R9-18 | P1     | src/platform/orchestration/oapeflir/final-response.ts:27-48                 | FinalResponse 接口 10字段；§A.3 要求 13字段(缺 executionDurationMs/modelId/retryCount)                                          |
| R9-19 | P1     | config/runtime/default.json                                                 | 仅 7字段；缺 §8 要求的 healthCheckIntervalMs/shutdownGracePeriodMs/logLevel/metricsEnabled/tracingEnabled/retryPolicy           |
| R9-20 | P1     | src/platform/orchestration/harness/index.ts:57-77                           | ConstraintPack 混合 camelCase(toolPolicy) 和 snake_case(risk_policy/output_policy)；序列化不一致                                |
| R9-21 | P1     | src/platform/orchestration/harness/hitl-runtime.ts:18                       | HitlRuntime 所有请求存内存 Map 无持久化；进程重启丢失全部待审批请求(§45 要求 HITL 状态存活崩溃)                                 |
| R9-22 | P1     | src/platform/orchestration/harness/recovery-controller.ts:12-31             | handleFailure 恢复期间不发事件到 state-evidence plane；§45 要求所有生命周期转换有 evidence 记录                                 |
| R9-23 | P1     | src/platform-architecture-bootstrap.ts:128-148                              | registerPlatformArchitectureServices 注册后立即 get() 无健康/就绪门控；init 失败静默传播                                        |
| R9-24 | P1     | config/risk/default.json:2                                                  | $schema 指向 .ts 文件非 JSON Schema；运行时无法做 JSON Schema 验证                                                              |
| R9-25 | P2     | config/domains/default.json:98                                              | domain status:"testing" 非 canonical(§11: draft/active/deprecated/retired)                                                      |
| R9-26 | P2     | config/domains/default.json:7                                               | domain version:1(integer)；§11 要求 semver string("1.0.0") 用于兼容性检查                                                       |
| R9-27 | P2     | src/platform/orchestration/harness/oapeflir-harness-mapping.ts:24           | hitl_operator 映射到 OAPEFLIR "assess" 阶段；§45 HITL 是 feedback/gate 机制非自动风险评估                                       |
| R9-28 | P2     | src/platform/orchestration/harness/guardrails/guardrail-engine.ts:91-95     | 永远不返回 retry_same_plan；HarnessDecisionAction 联合含此值但护栏无法触发                                                      |
| R9-29 | P2     | src/platform/orchestration/oapeflir/runtime-execute-bridge.ts:228           | 动态 import ../../../core/runtime/orchestrator/index.js——路径在 src/platform/ 外部；耦合未声明的 core/ 模块                     |
| R9-30 | P2     | tests/integration/                                                          | 无跨平面事件传播/事件溯源重放/OAPEFLIR FSM 验证/PlanGraph 执行集成测试；§45 核心行为零覆盖                                      |

### 47. 组织治理 / NL 交互 / 自治引擎深层问题

| #     | 严重度 | 文件/领域                                                     | 问题                                                                                                                                             |
| ----- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-31 | P0     | src/org-governance/org-model/org-governance-saga.ts           | §46.3 要求 OrgGovernanceSaga 冻结 orgVersion+计算影响差异+有序子步骤+补偿；实现为 stub 仅按类型分组无实际逻辑                                    |
| R9-32 | P0     | src/interaction/nl-gateway/index.ts:722                       | §39.6 规定仅 confirmed TaskSpec 可生成 RequestEnvelope；buildTask() 在 confirmationReceipt.state="pending_user_confirmation" 时即预构建 envelope |
| R9-33 | P1     | src/org-governance/approval-routing/route-engine/index.ts:155 | §47.1 要求 parallel 会签+sequential 逐级审批模式；仅实现单线性链无并行/会签                                                                      |
| R9-34 | P1     | src/org-governance/approval-routing/route-engine/index.ts:257 | normalizeThresholdCny 硬编码 USD→CNY 汇率 7.2；§47.2 要求 base_currency+FX snapshot                                                              |
| R9-35 | P1     | src/org-governance/approval-routing/route-engine/index.ts:46  | ApprovalRouteSnapshot 无 expiresAt；§47.3 要求 expiry/revocation/commit-time revalidation                                                        |
| R9-36 | P1     | src/org-governance/approval-routing/escalation/index.ts       | 超时升级用静态 escalateToApproverId 不遍历 OrgTree；§47.1 要求向上走组织层级                                                                     |
| R9-37 | P1     | src/org-governance/compliance-engine/inheritance/index.ts     | §49.2 要求 PolicyStrictnessComparator+不可比策略进入 compliance approval；用硬编码启发式无比较器接口                                             |
| R9-38 | P1     | src/org-governance/compliance-engine/                         | §49 要求 ComplianceExceptionWorkflow(scope/expiresAt/compensating controls) + EvidenceQualityScore/ControlCoverageReport——全部未实现             |
| R9-39 | P1     | src/org-governance/compliance-engine/evidence-collector.ts    | §49.3 要求定期自动证据收集(季度 SOX/持续 HIPAA)；实现仅按需调用无调度器/周期/新鲜度强制                                                          |
| R9-40 | P1     | src/interaction/nl-gateway/index.ts:161                       | UserConfirmationReceipt 仅 not_required/pending 两态；缺 confirmed 态+risk preview version/scope/actor/timestamp(§39)                            |
| R9-41 | P1     | src/interaction/nl-gateway/index.ts:480                       | §39 high/critical 指令须 dry-run preview；buildRiskPreview 纯关键词匹配无实际 dry-run 执行/副作用预览                                            |
| R9-42 | P1     | src/interaction/goal-decomposer/index.ts                      | §40.2 要求 capability validation+risk propagation through task graph；无 DomainDescriptor 能力检查；风险逐节点不传播                             |
| R9-43 | P1     | src/interaction/autonomy/promotion-engine/index.ts:27-31      | §42.2 要求 human override rate <5%/<1% 才可升级；assessPromotion 仅检查 totalExecutions/successRate 从不评估 override rate                       |
| R9-44 | P1     | src/interaction/autonomy/index.ts:329                         | §42.2 要求 domain_owner/platform_team 审批升级；所有升级 approvedBy:"auto" 无审批门                                                              |
| R9-45 | P2     | src/interaction/autonomy/promotion-engine/index.ts:24-31      | §42.2 要求 per-level 无事件窗口(30d/60d/90d)；仅全局 incidents>0 检查无时间窗约束                                                                |
| R9-46 | P2     | src/interaction/goal-decomposer/index.ts:368                  | §40.3 模板匹配应用 DomainRecipe(§37.7)；detectTemplate 用 5个硬编码正则无 DomainRecipe/DomainDescriptor 集成                                     |
| R9-47 | P2     | src/interaction/proactive-agent/index.ts:76                   | §41.5 Suggestion 管线(Context Builder→Generator→Queue→dashboard)；enqueueSuggestion 无上下文构建/质量评分                                        |

### 48. Contract 深层矛盾与缺口（新发现）

| #     | 严重度 | 文件/领域                                                               | 问题                                                                                                                                                                                                         |
| ----- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R9-48 | P0     | docs_zh/contracts/platform_panic_and_resume_contract.md §3              | PlatformPanicDirective 含可选 expires_at TTL；§2.4 不变量明确"Panic 不得 TTL 自动解除，恢复必须人工确认"                                                                                                     |
| R9-49 | P1     | docs_zh/contracts/observability_contract.md §3                          | LogEvent 用 task_id? 作主关联键缺 harness_run_id/node_run_id/attempt_id；§5.5 要求 HarnessRun 为 canonical 关联                                                                                              |
| R9-50 | P1     | docs_zh/contracts/model_gateway_routing_contract.md §2                  | ModelRouteRequest 用 taskId 无 harnessRunId/nodeRunId；INV-BUDGET-001 要求 harnessRunId 才能验证预算预留                                                                                                     |
| R9-51 | P1     | docs_zh/contracts/budget-ledger-contract.md §3                          | BudgetReservation.resourceKind 枚举(token/tool/api/compute/human/side_effect/other)与 §53 ResourceKind(worker_concurrency/tool_qps/model_tpm/model_rpm/budget_amount/approval_capacity/storage_io)完全不匹配 |
| R9-52 | P1     | docs_zh/contracts/side-effect-reconciliation-contract.md §2             | SideEffectStatus 枚举缺 approved/committed/confirming/manual_review_required/compensation_required 态；多出 reserved 态(§14.11 无此态)                                                                       |
| R9-53 | P1     | docs_zh/contracts/cost_and_budget_contract.md §4                        | CostEvent 以 task_id 为必填主键，harness_run_id/node_run_id/attempt_id 为可选；与 budget-ledger(要求 harnessRunId)对接断裂                                                                                   |
| R9-54 | P1     | docs_zh/contracts/cost_and_budget_contract.md §3                        | BudgetPolicy.runtime_mode 8态(full_auto/supervised_auto/read_only/no-write/...) 与 sandbox_and_auth_contract §3 4态(read_only/workspace_write/scoped_external_access/restricted_exec)完全不重叠              |
| R9-55 | P1     | docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md | 全文使用 step 术语("不可达步骤检测"/"step id 唯一性检查"/"每个有副作用的 step")；v4.3 用 PlanNode/nodeId；无迁移段                                                                                           |
| R9-56 | P2     | docs_zh/contracts/multimodal_gateway_contract.md                        | MultimodalRequest 缺 harnessRunId/nodeRunId/tenantId/traceId(§5.2 ContractEnvelope 必填)；无 BudgetReservation 引用                                                                                          |
| R9-57 | P2     | docs_zh/contracts/connector_framework_contract.md                       | ConnectorExecutionRequest/Result 无最小字段定义；缺 harnessRunId/nodeRunId/sideEffectId 关联(§14.11 外部写须注册 SideEffectRecord)                                                                           |
| R9-58 | P2     | docs_zh/contracts/capacity_planning_contract.md                         | CapacitySignal 无 tenantId/harnessRunId；resource_type 为 plain string 未对齐 §53 ResourceKind canonical 枚举                                                                                                |
| R9-59 | P2     | docs_zh/contracts/gateway_streaming_contract.md §3                      | StreamEvent 用 task_id 作主关联键无 harness_run_id/node_run_id；§6.8 legacy task 端点须解析到 harnessRunId                                                                                                   |
| R9-60 | P2     | docs_zh/contracts/observability_contract.md §4.3                        | StageMetricSample/LoopIterationTrace 携带 task_id? 作关联字段但 T-47 remediation 降级 OAPEFLIR 指标为 view-only——定位矛盾                                                                                    |
| R9-61 | P2     | docs_zh/contracts/plugin_spi_contract.md §2.4                           | DomainPresenterPlugin.present() 接受 DualChannelStepOutput(含 Step 的废弃类型)；v4.3 用 NodeAttemptReceipt                                                                                                   |
