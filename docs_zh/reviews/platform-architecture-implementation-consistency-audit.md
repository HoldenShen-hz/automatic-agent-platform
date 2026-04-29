## 2026-04-28 复核结论

以下状态矩阵覆盖本文件原始发现的当前实况；原始分项清单保留在后文作为历史发现快照。判定依据只采信实际源码、配置与 contract/ADR/spec 文本，不再使用 closure test、closure script 或 supersede 占位说明。

| 主题 | 当前状态 | 根因 | 当前证据 |
| --- | --- | --- | --- |
| S1 OAPEFLIR 身份危机 | 部分修复 | 根因是 OAPEFLIR spec/ADR 曾把认知投影视图写成 runtime truth，v4.3 迁移初期只改了局部 contract，引用链没有一起收口。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已降为 `Reference Draft`，多数 ADR/contract 也已把 OAPEFLIR 收回为 projection/view；但 spec 仍保留 `Graph Scheduler`、`OapeflirEvent`、`Budget Ledger`、`SideEffect Manager`、`Reconciliation` 等 truth-like 类型块，不能宣称完全闭合。 |
| S2 废弃术语迁移未执行 | 部分修复 | 根因不是“还有几个旧词”这么简单，而是 v3 `workflow/execution/stepId` 兼容层长期停留在一等模型位置，代码、contract、ADR 各自继续复用旧键，迁移没有形成单一 canonical 边界。 | 本轮已把 `src/platform/execution/plugin-executor/sub-workflow-executor.ts` 收敛为 `nodeId` 内部主键、`src/platform/state-evidence/events/projections/workflow-timeline-projection.ts` 补上 `planGraphBundleId / harnessRunId / nodeId` canonical 轴、`src/domains/registry/plugin-spi.ts` 把 `stepId/workflowId` 降为 alias；但 `src/scale-ecosystem/billing/types.ts` 及后文 2.4 / 3.4 所列部分 contract/ADR 残留仍未完全迁移。 |
| S3 RuntimeStateMachine 被绕过 | 已修复 | 根因是 Harness / delegation / replay 曾各自维护局部状态，导致运行态修改散落在业务逻辑里。 | 复核实际文件后，`src/platform/orchestration/harness/index.ts` 的 `runLoop()` 已经经由 `transitionRunStatus()` 驱动状态迁移；`src/platform/orchestration/agent-delegation/delegation-manager.service.ts` 已改为状态机路径；`src/platform/execution/ha/replay-worker.ts` 有 `assertReplayPolicySafe()` 门禁。 |
| S4 Sandbox 含 `none` 档位 | 已修复 | 根因是 sandbox canonical tier 只在安全策略层定义，但业务包、插件 SDK、delegation 上下文长期直接暴露 legacy alias，兼容输入与 canonical 输出没有分层。 | `src/sdk/plugin-sdk/plugin-definition.ts`、`src/sdk/plugin-sdk/plugin-context.ts`、`src/platform/orchestration/agent-delegation/delegation-types.ts`、`src/platform/interface/api/pack-catalog-service.ts` 已全部收敛到 canonical 4 档；`src/domains/business-pack/business-pack-manifest.ts` 与 `src/platform/control-plane/iam/sandbox-policy.ts` 只在 ingress normalization 层保留 `process/container` 兼容映射，不再把旧值暴露为运行时/public type。 |
| S5 Budget 保护缺失 | 已修复 | 根因已从“完全没有 reservation”转为“预算职责分散”: orchestration 先做门禁、执行方再单独预留，失败时缺少统一 release/settle 生命周期，导致重复预留与泄漏风险。 | `src/platform/model-gateway/cost-tracker/budget-guard.ts` 现负责执行前门禁；`src/platform/execution/budget-allocator.ts` 已具备 `reserve/settle/release` 生命周期；`src/interaction/goal-decomposer/llm-plan-generator.ts`、`src/scale-ecosystem/billing/billing-service.ts` 失败即释放 reservation；本轮进一步修复 `src/interaction/goal-decomposer/index.ts`，移除与 generator 重复的上层 reservation。 |
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
以下分项覆盖本文件原始 1-12 章的当前复核结论。旧的长表格已整体移除，因为其中大量条目已经过时，继续保留会把“历史快照”误读成“当前待修列表”。

| 状态 | 含义 |
| --- | --- |
| 已修复 | 当前源码 / contract / ADR 已与主架构收口，旧发现不再成立。 |
| 部分修复 | 主链已纠正，但仍有残留兼容层或文档定义需要继续清理。 |
| 原发现已过时 | 原结论基于旧快照；当前文件内容已不能支持该指控。 |
| 移出本审计范围 | 属架构主文档自身一致性问题，不应继续作为 implementation consistency 问题挂账。 |

### 1. 代码 vs 架构

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 1.1 RuntimeStateMachine 被绕过 | 已修复 | 早期 Harness / delegation / replay 各自维护局部状态，状态迁移散落在业务逻辑。 | `src/platform/orchestration/harness/index.ts` 已通过状态机路径推进；`src/platform/orchestration/agent-delegation/delegation-manager.service.ts` 已转到状态机语义；`src/platform/execution/ha/replay-worker.ts` 有 replay 安全门禁。 | 无。 |
| 1.2 废弃合约作为一等公民导出 | 原发现已过时 | v3 兼容导出曾没有明确降级，后来 contract barrel 补了 deprecated / compatibility 边界。 | `src/platform/contracts/execution-plan/index.ts`、`control-directive/index.ts`、`execution-receipt/index.ts`、`types/platform-contracts.ts` 已不再把旧对象当新实现入口。 | 无。 |
| 1.3 Budget 保护缺失 | 已修复 | 根因已从“完全缺失”转为“门禁与 reservation 生命周期拆散”，导致重复预留与失败泄漏。 | `src/platform/model-gateway/cost-tracker/budget-guard.ts` 负责预算门禁；`src/platform/execution/budget-allocator.ts` 具备 `reserve/settle/release`；`src/interaction/goal-decomposer/llm-plan-generator.ts`、`src/scale-ecosystem/billing/billing-service.ts` 已在失败路径释放；本轮进一步修复 `src/interaction/goal-decomposer/index.ts`，移除与 generator 重复的 reservation。 | 无。 |
| 1.4 Trust Score 绕过安全边界 | 原发现已过时 | 原审计基于未含风险封顶逻辑的旧实现。 | `src/interaction/autonomy/trust-scorer/index.ts` 不再把 `fully_trusted` 直接映射为无条件 `full_auto`；`promotion-engine/index.ts` 阻止越权提升；`proactive-agent/trigger-engine/index.ts` 对高风险路径不再默认自动执行。 | 无。 |
| 1.5 Sandbox `none` 档位 | 已修复 | 旧系统把 ingress 兼容值和 runtime/public type 混在一起。 | `src/sdk/plugin-sdk/plugin-definition.ts`、`plugin-context.ts`、`src/platform/orchestration/agent-delegation/delegation-types.ts`、`src/platform/interface/api/pack-catalog-service.ts` 已收敛到 canonical 4 档；`src/domains/business-pack/business-pack-manifest.ts` 和 `src/platform/control-plane/iam/sandbox-policy.ts` 只在 normalization 入口接受 `process/container` 映射。 | 无。 |
| 1.6 域风险规格缺失 | 已修复 | 高风险域先完成 baseline onboarding，治理规格后来补。 | `src/domains/domain-specs.ts` 已补 `advisoryOnly / humanAccountable / deterministicHotPathOnly`，`config/domains/quant-trading.json`、`config/domains/healthcare.json` 已含 `riskSpec`。 | 无。 |
| 1.7 Saga 无实际补偿 | 已修复 | 早期 saga 只有回执拼装，没有真实执行 handler 和补偿路径。 | `src/org-governance/org-model/org-governance-saga.ts`、`knowledge-boundary/chinese-wall-access-saga.ts`、`delegated-governance/governance-delegation-revocation-saga.ts` 均已具备 prepare/commit/compensate 语义。 | 无。 |
| 1.8 废弃术语在非 legacy 代码中使用 | 部分修复 | v3→v4 迁移没有一次性完成，部分兼容层仍把旧键作为内部或适配字段保留。 | 本轮已修复 `src/platform/state-evidence/events/projections/workflow-timeline-projection.ts`、`src/domains/registry/plugin-spi.ts`、`src/scale-ecosystem/billing/billing-service.ts` 的 canonical 轴；但 `src/platform/control-plane/approval-center/approval-flow-engine.ts`、`src/ops-maturity/workflow-debugger/`、`src/platform/execution/plugin-executor/sub-workflow-executor.ts`、`src/domains/business-pack/pack-migration-service.ts` 仍保留 `workflowRunId/stepId/executionId` 兼容字段或内部命名。 | 继续把旧键压缩到 `@deprecated alias / compatibility only` 边界，避免内部新逻辑再以其为主键。 |
| 1.9 HarnessRun 接口重复定义且不一致 | 部分修复 | `HarnessRun` 主体已切到 canonical 合约，但内部 runtime state 与 decision 投影仍保留一层本地包装。 | `src/platform/orchestration/harness/index.ts` 中 `HarnessRun` 已是 `CanonicalHarnessRun` 别名，`HarnessRunRuntimeState` 也已有 `harnessRunId / planGraphBundle / tenantId / traceId`；但 `HarnessDecision` 仍未补齐 `decisionInputBundleId / deciderType / deciderRef` 等权威字段，本地 `runId` 兼容键也仍存在。 | 需要把本地 decision 投影继续向 executable contract 靠齐。 |
| 1.10 其他 | 部分修复 | 这组条目混合了已修复的隔离问题与仍存在的编排边界问题。 | `src/org-governance/knowledge-boundary/knowledge-boundary-service.ts`、`knowledge-federator.ts` 已有 `tenantId` 过滤；`src/platform/orchestration/harness/index.ts` 已持有 `planGraphBundle`；但 `src/interaction/goal-decomposer/index.ts` 仍只输出 `TaskGraphDraft + PlannerHandoffReceipt`，并未直接路由到 `HarnessRuntime`。 | 需补 planner/harness handoff 的真正执行入口，而不是停在 handoff receipt。 |

### 2. Contract 文档 vs 架构

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 2.1 存储 Schema 基于废弃对象 | 已修复 | 存储合同长期沿用 v3 单机表模型，truth 表族补进后文档未同步换主链。 | `docs_zh/contracts/storage_schema_contract.md` 已以 `harness_runs / plan_graph_bundles / node_runs / node_attempts / node_attempt_receipts / budget_*` 为权威表族。 | 无。 |
| 2.2 runtime_state_machine_contract 以废弃对象为权威 | 已修复 | 旧 contract 把 `ExecutionStatus / WorkflowStatus` 当 truth 状态机。 | `docs_zh/contracts/runtime_state_machine_contract.md` 已显式把旧状态降为 legacy / projection，并把强制规则收敛到 `RuntimeStateMachine.transition()`、`PlanGraphBundle`、`NodeAttemptReceipt`。 | 无。 |
| 2.3 事件命名空间错误 | 已修复 | 旧文档把 `workflow.* / task.* / execution.*` 当 truth event。 | `docs_zh/contracts/event_bus_contract.md` 及相关 event contract 已将 truth 事件收敛到 `platform.*`，并把 OAPEFLIR 明确为 `oapeflir.view.*`。 | 无。 |
| 2.4 使用废弃 ID 作为 canonical key | 已修复 | 大量 contract 在 v4.3 后仍沿用 execution/workflow/step 主键。 | `api_surface_contract.md`、`artifact_unified_model_contract.md`、`cost_and_budget_contract.md`、`policy_engine_contract.md` 等已改为 `harness_run_id / node_run_id / attempt_id` 主链。 | 无。 |
| 2.5 关键 contract 缺少 canonical 字段 | 已修复 | 部分 contract 直接暴露 table-shaped 字段，未补齐执行链主键。 | `node-run-attempt-receipt-contract.md`、`event_bus_contract.md`、`plugin_spi_contract.md` 已补齐 `harnessRunId / planGraphBundleId / graphVersion / idempotency_key / payloadHash` 等字段。 | 无。 |
| 2.6 workflow_debugger_contract 基于废弃模型 | 已修复 | 旧调试合同承接 workflow debugger 原型，没有迁到 harness/node 语义。 | `docs_zh/contracts/workflow_debugger_contract.md` 已改到 `HarnessRun / NodeRun / PlanGraph` 锚点，并显式写出 remediation。 | 无。 |
| 2.7 其他 contract 问题 | 已修复 | 多份边缘 contract 长期没有随 canonical contract 一起重写。 | `admin_console_and_human_takeover_contract.md`、`agent_definition_lifecycle_contract.md`、`division_definition_contract.md`、`sla_tier_contract.md`、`knowledge_boundary_and_federated_search_contract.md`、`execution_plane_contract.md` 已补 state machine / harness-node / SLA 证据链约束。 | 无。 |

### 3. ADR vs 架构

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 3.1 ADR 定义与架构冲突的 canonical 对象 | 原发现已过时 | 早期 ADR 记录的是迁移前的设计草案，后续已加入 remediation 而原审计未刷新。 | `docs_zh/adr/060-explicit-planning-hub.md` 已转为 `PlanGraphBundle -> NodeAttemptReceipt`；`065-workflow-visual-debugger.md` 已改 harness/node 锚点；`070-conclusion.md` 已使用 ring 口径。 | 无。 |
| 3.2 Phase 分期未迁移到 Ring | 已修复 | Phase 术语曾长期残留在 roadmap 和 domain 引导文档。 | `docs_zh/adr/033-phased-roadmap.md`、`070-conclusion.md`、`080-learn-hub-pattern-detection.md` 已改为 Ring 语义或显式降级为历史映射。 | 无。 |
| 3.3 OAPEFLIR 被当作 Runtime | 原发现已过时 | 多份 ADR 曾把 OAPEFLIR 当执行主链描述，后续已回收到投影语义。 | `docs_zh/adr/072-oapeflir-testing-strategy.md`、`066-plugin-spi-framework.md` 等已把 OAPEFLIR 改写为 projection / rationale。 | 无。 |
| 3.4 废弃术语作为 canonical | 部分修复 | ADR 层大部分已修正，但实现兼容层还残留旧别名，导致个别 ADR 仍保留历史叙述。 | `docs_zh/adr/079-feedback-hub-signals.md`、`080-learn-hub-pattern-detection.md` 已切到 `harnessRunId / nodeRunId`；`019-agent-handoff-four-layer-protocol.md`、`022-api-contract-and-versioning.md` 等主体已不再把旧对象当权威。 | 剩余问题主要不在 ADR，而在实现兼容层，见 1.8 / 1.9。 |
| 3.5 SLA 前置条件缺失 | 已修复 | 旧 ADR 只有等级承诺，没有把 failover/quorum/演练证据写成前提。 | `docs_zh/adr/054-sla-tiered-guarantees.md` 已明确：99.99% 仅限专用部署层级，且必须具备自动 failover、quorum、容量预留与演练证据。 | 无。 |

### 4. OAPEFLIR v4.4 Spec vs 主架构

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 4.1 Spec 自定义 Runtime truth 对象 | 部分修复 | spec 虽然已降级，但“迁移输入”和“canonical contract 指针”没有彻底拆分。 | `docs_zh/architecture/oapeflir-v4.4-executable-spec.md` 已标成 `Reference Draft`；但标题仍是 `Executable Specification Edition`，且目录 / 正文仍保留 `NodeRun`、`PlanGraph`、`Execute` 等 truth-like 类型块。 | 继续把可执行类型定义替换为对 `00-platform-architecture.md` 与 executable contract 的引用。 |
| 4.2 Spec 定义其他平面的对象 | 部分修复 | 预算、side effect、reconciliation 等章节从旧草案直接保留到了 reference draft。 | 同一 spec 仍保留 `§12 Graph Scheduler`、`§15 Budget Ledger`、`§16 SideEffect Manager`、`§17 Reconciliation State Machine` 的具体类型定义。 | 把这些章节改成“设计意图 + canonical pointer”，不要再保留独立 truth schema。 |
| 4.3 Spec 仍带独立权威信号 | 部分修复 | 命名和附录没有完全去权威化。 | `§14.1 OapeflirEvent` 仍定义独立 envelope，附录仍列 `ADR-OAPEFLIR-*` 前缀清单。 | 需要改成 migration appendix / rationale appendix 命名，避免被误读为并行权威域。 |

### 5. Config / Bootstrap vs 架构

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 5.1 域配置用废弃 Phase 且缺风险规格 | 已修复 | 早期 domain config 沿用 phase 编排且缺 `riskSpec`。 | `config/domains/quant-trading.json` 已使用 `ringId: ring1` 且含 `riskSpec`；`config/domains/healthcare.json` 已使用 `ringId: ring3` 且含 `riskProfile + riskSpec`。 | 无。 |
| 5.2 Bootstrap / Catalog 用废弃分期 | 已修复 | runtime catalog / startup plan 曾把 phase 当 canonical bootstrap key。 | `src/domains-runtime-catalog.ts`、`src/domains-startup-plan.ts`、`src/index.ts` 已全部改为 `ring1 / ring2 / ring3`。 | 无。 |
| 5.3 五平面结构不完整 | 已修复 | X1 横切平面原先只在架构图里存在，没有落到 bootstrap 顺序。 | `src/platform/five-plane-startup-plan.ts`、`src/platform-architecture-bootstrap.ts` 已明确 `P5 -> X1 -> P2 -> P3 -> P4 -> P1`。 | 无。 |

### 6. AI 运营层代码 vs 架构（原 7.*）

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 6.1 Model gateway 请求上下文 / abort / streaming 预算 | 已修复 | 旧 provider 接口未统一 trace/tenant/cost/abort 上下文。 | `src/platform/model-gateway/provider-registry/unified-chat-provider.ts` 已要求 `traceId / tenantId / costTag / abortSignal`；OpenAI / Anthropic / MiniMax provider 已透传中断信号。 | 无。 |
| 6.2 Prompt defense / eval 门禁 | 已修复 | 旧 prompt/eval 实现只覆盖局部静态规则，没有风险级别样本门禁与独立 judge。 | `src/platform/prompt-engine/prompt-injection-guard.ts` 已切到 shared guard 链；`eval-dataset-judge-service.ts` 已强制 `critical=200 / high=100 / medium=50` 样本下限、`criticalPassRate==100%` 硬门禁、cross-provider judge 独立性检查。 | 无。 |
| 6.3 Plugin runtime 治理 | 已修复 | 插件运行时原先缺污染传播、撤回分级和递归深度防护。 | `src/plugins/builtin-plugin-registry.ts` 已有 `DataTaintPropagation` 与 `BundleRevocationSeverity`；`src/sdk/plugin-sdk/plugin-context.ts` 已有 `callDepth / delegationDepth`。 | 无。 |
| 6.4 Budget / chargeback / prompt lifecycle | 已修复 | 预算层级、归因字段和 prompt 生命周期曾分别停留在半迁移状态。 | `budget-guard.ts` 已支持 task/pack/platform；`chargeback-service.ts` 本轮补齐 `fxRateToBase / costSource` 归因链；`prompt-engine/registry/` 已支持 `deprecated` 生命周期。 | 无。 |

### 7. 其余 Contract / ADR / 深层实现条目（原 8.* / 9.* / 11.* / 12.*）

| 条目 | 当前状态 | 根因 | 当前证据 | 剩余缺口 |
| --- | --- | --- | --- | --- |
| 7.1 原 8.* 剩余 contract 条目 | 已修复 | 旧 contract 零散继承 execution/workflow/step 语义，没有随 v4.3 truth contract 同步。 | `runtime_state_machine_contract.md`、`cost_and_budget_contract.md`、`task_and_workflow_contract.md`、`policy_engine_contract.md`、`execution_plane_contract.md`、`observability_contract.md`、`plugin_spi_contract.md` 已统一到 `PlanGraphBundle / HarnessRun / NodeRun / NodeAttemptReceipt`。 | 无。 |
| 7.2 原 9.* 架构文档内部一致性 | 移出本审计范围 | 这组问题属于 `00-platform-architecture.md` 主文档自身一致性，不是实现与架构之间的不一致。 | 本轮不再把 9.* 当成 implementation closure 证据，也不再据此宣称代码未修。 | 如需继续，应单开 architecture-doc consistency audit。 |
| 7.3 原 11.* Harness Runtime 深层实现缺口 | 原发现已过时 | 旧审计基于缺少 HITL / context / guardrail / memory / decision bundle 的早期 harness 快照。 | `src/platform/orchestration/harness/hitl-runtime.ts` 已有 `inspect / patch / override / takeover / resume` 与 `HumanResponsibilityRecord`；`harness/index.ts` 已有 `PromptExecutionRecord`、`DecisionInputBundle`、`taintPolicy / rankingPolicy / redactionPolicy`、canonical `autonomyMode`；`guardrail-engine.ts` 已有 input/tool/evidence/risk/budget/memory 层检查。 | 本轮未发现还能支撑旧 11.* 长表的证据。 |
| 7.4 原 12.* 组织治理 + 规模生态深层缺口 | 已修复 | 这组条目在最近几轮已经陆续落到真实实现，但旧审计正文没有同步收口。 | `multi-region/region-router`、`failover-controller`、`connector-registry`、`sla-engine`、`compliance-engine`、`quota-enforcer`、`cross-region-routing-service`、`billing/types.ts` 等文件已具备原审计要求的字段或执行链。 | 无。 |

### 本轮新增实修

| 位置 | 根因 | 修复 |
| --- | --- | --- |
| `src/interaction/goal-decomposer/index.ts` | 上层 `GoalDecompositionService` 在做预算门禁时又重复尝试 reservation，而 `llm-plan-generator` 已负责 `reserve/settle/release`，导致双重预留和泄漏风险。 | 改为只做 `BudgetGuard.evaluateExecutionChain()` 门禁，不再在上层创建 reservation。 |
| `src/platform/model-gateway/cost-tracker/chargeback-service.ts` | `ChargebackAllocation` contract 要求 `costSource`，但实现组装 allocation 时没有填充，导致多币种归因链缺少来源。 | 增加 `resolveCostSource()`，优先取 `resource.metadata.costSource`，缺省回退到 `resourceType`。 |
| `tests/unit/platform/model-gateway/cost-tracker/chargeback-service.test.ts` | 旧测试仍假设 `buildReport()` 返回“最后一份报表原币种”，与当前“统一折算到 baseCurrency”语义冲突。 | 将断言改为验证默认 `baseCurrency=USD`，避免继续把旧语义当现状。 |

### 本轮定向验证

- `./node_modules/.bin/tsx --test tests/unit/interaction/goal-decomposer/index.test.ts tests/unit/interaction/goal-decomposer.test.ts`
- `./node_modules/.bin/tsx --test tests/unit/platform/model-gateway/cost-tracker/chargeback-service.test.ts`
