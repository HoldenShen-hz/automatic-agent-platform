> 2026-04-29 逐编号重审结果见：
> [platform-architecture-implementation-consistency-audit_round_reaudit.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md)
>
> 说明：
> - 本文件保留为 append-only 历史快照，不直接代表当前活跃缺陷清单。
> - 逐编号的“当前结论 / 根因 / 依据 / 本轮动作”统一以 `audit_round_reaudit.md` 为准。

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
| R3-80 | LOW    | explainability_and_stage_rationale_contract.md     | 无 remediation section；未引用 §59 "解释不可篡改纳入 Evidence Plane" + "解释必须 permission-aware"         |

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
| R4-50 | RESOLVED | tests/invariants/                  | §2.4 要求 9个 invariant test 文件——**已存在** (truth-event-atomicity/harness-run-authority/plan-graph-only-dispatch/budget-reserve-before-execute/no-side-effect-in-replay/side-effect-ambiguous-reconciles/deny-by-default 等)                                                                                                                    |
| R4-51 | RESOLVED | tests/invariants/budget-reserve-before-execute.test.ts | INV-BUDGET-001 测试覆盖存在                                                                                                                                                                                                          |
| R4-52 | RESOLVED | tests/invariants/no-side-effect-in-replay.test.ts      | INV-REPLAY-001 测试覆盖存在                                                                                                                                                                                                          |
| R4-53 | RESOLVED | tests/invariants/side-effect-ambiguous-reconciles.test.ts | INV-SIDEEFFECT-001 测试覆盖存在                                                                                                                                                                                                      |
| R4-54 | RESOLVED | tests/invariants/deny-by-default.test.ts               | INV-POLICY-001 测试覆盖存在                                                                                                                                                                                                          |
| R4-55 | RESOLVED | config/runtime/default.json        | 已移除废弃 defaultStepTimeoutMs；canonical RuntimeStateMachine/五平面 配置完整 (87字段)                                                                                                                                              |
| R4-56 | RESOLVED | config/risk/default.json           | 已移除废弃 stepTypeRisk/stepTypeRiskValues；§28 Event Registry/DLQ 模型对齐完整                                                                                                                                                      |
| R4-57 | HIGH     | config/domains/\*.json             | 域 workflow 配置用线性 steps[] + stepName——§13/§45 要求 PlanGraph                                                                                                                                                                  |
| R4-58 | HIGH     | config/domains/\*.json             | 无 DomainRiskSpec(advisory_only/human_accountable/deterministic_hot_path_only)——quant-trading 高危域无风险声明                                                                                                                     |
| R4-59 | HIGH     | platform-architecture-bootstrap.ts | 注册为扁平目录无强制启动序(§7 要求 P5→X1→P2→P3→P4→P1)                                                                                                                                                                              |
| R4-60 | MEDIUM   | platform-architecture-types.ts     | 无 canonical runtime 对象类型(HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation)——仅基础设施类型                                                                                                                                |
| R4-61 | MEDIUM   | domains-runtime-catalog.ts         | 仍用 phase9a-9f 旧分期(§33 明确"仅历史映射"，canonical 为 Ring 1/2/3)                                                                                                                                                              |
| R4-62 | MEDIUM   | index.ts                           | main() 无架构启动不变量检查(ArchitectureInvariantRegistry/NonOverridableInvariantRegistry §2.4)                                                                                                                                    |
| R4-63 | MEDIUM   | index.ts                           | runPlatformRootDemo 用 snapshot.workflow.currentStepIndex/stepOutputs 废弃对象作为主输出                                                                                                                                           |
| R4-64 | MEDIUM   | tests/                             | 无 contract-naming-consistency.test.ts(§6.4 要求 CI lint 扫描废弃术语)     |

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
| R5-67 | MEDIUM   | ADR-047             | auto_action 超时自动执行无风险级别守卫(§10.3 high/critical 默认 deny)     |

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
| R7-15 | P0     | src/interaction/dashboard/dashboard-projection-service | 仅产出 totalTasks/tasksByStatus 等 4字段；UI spec §4.7.7 要求 success_rate/avg_duration_ms/active_agents 等 10+ 字段 |
| R7-16 | P0     | src/interaction/dashboard/dashboard-websocket-server   | WS 消息类型 dashboard_delta/snapshot 与 UI spec task.status_changed/approval.resolved 等 domain event 模型不匹配     |
| R7-17 | P0     | src/interaction/dashboard/dashboard-websocket-server   | 订阅模型为 dashboard-ID-based；UI spec 要求 channel-based (global/task:{id}/approvals/admin)                         |
| R7-18 | P1     | src/interaction/dashboard/                             | DashboardProjectionService 与 DashboardWebSocketServer 未集成（有 TODO）                                             |
| R7-19 | P1     | src/interaction/dashboard/metric-aggregator/           | 仅覆盖 ~15% 所需指标；UI spec 4层 28面板要求完整 metric 集                                                           |
| R7-20 | P1     | src/interaction/dashboard/health-scorer/               | 返回单一数值；UI spec StabilityPanelView 要求 8字段（uptime/error_rate/p99 等）                                      |
| R7-21 | P1     | src/interaction/dashboard/alert-router/                | 仅排序；无实时路由/overlay/push/haptic 通知                                                                          |
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
| R8-61 | P0     | docs_zh/adr/066-\*.md (×2)                                  | 已解决：Plugin SPI ADR 已重编号为 `ADR-071`，README/迁移文档/交叉引用已同步，文档唯一编号守护测试已通过                                                                        |
| R8-62 | P0     | docs_zh/adr/060-explicit-planning-hub.md                    | 已解决：ADR-060 已把 `PlanGraphBundle` 写为唯一 P3→P4 handoff，`RuntimeExecuteBridge` 明确降为 compatibility seam                                                               |
| R8-63 | P0     | docs_zh/adr/033-phased-roadmap.md                           | 已解决：ADR-033 已标记为 `Superseded by ADR-112`，仅保留历史 phase→ring 映射，不再作为现行 canonical roadmap                                                                     |
| R8-64 | P1     | docs_zh/contracts/event-envelope-contract.md                | 已解决：canonical EventEnvelope 已统一为 camelCase，并把 snake_case 下沉为 legacy wire alias 映射                                                                                |
| R8-65 | P1     | docs_zh/contracts/event_bus_contract.md                     | 已解决：event bus contract 已收敛到 `runId + aggregate` 与 `platform.harness_run.* / platform.node_run.* / platform.release.*` 权威命名                                      |
| R8-66 | P1     | docs_zh/adr/019-agent-handoff-four-layer-protocol.md        | 已解决：ADR-019 已把 handoff 回执锚点收敛到 `NodeAttemptReceipt / HarnessRun / NodeRun`，不再引用废弃 `StepResult`                                                             |
| R8-67 | P1     | 缺失 contract: Agent Delegation / Multi-Agent Collaboration | 已解决：已新增 `docs_zh/contracts/agent_handoff_contract.md`，冻结 `DelegationRequest / DelegationReceipt / ACPMessage / AgentHandoff / C1-C7`                                |
| R8-68 | P1     | docs_zh/contracts/task-intake-request-contract.md           | 已修复：canonical `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` 已补 `domainId`，并在 intake / nl-gateway 入口归一化 legacy division/domain alias                 |
| R8-69 | P1     | docs_zh/contracts/harness-run-contract.md                   | 已修复：canonical `HarnessRun`、adapter 与 goal-decomposer 路由已携带 `domainId`，run truth 不再依赖 tenant/division 投影反推域绑定                                       |
| R8-70 | P1     | 缺失 contract: ReleaseDecisionView / ReleaseChannel         | 已解决：release contract 已补 `ReleaseDecisionView` 与 `ReleaseChannel`，release 阶段 truth/projection 边界已冻结                                                             |
| R8-71 | P1     | docs_zh/adr/012-sqlite-phase-1-2-primary-store.md           | 已解决：ADR-012 已改写为 `Ring 1 MVP / Ring 2 readiness` 语义，不再以 Phase 1a/1b 作为现行边界                                                                                |
| R8-72 | P1     | docs_zh/adr/013-eventemitter-phase-2-boundary.md            | 已解决：ADR-013 已把边界切到 Ring 语义，并移除已失效的 “Phase 2 是否替换” 触发器                                                                                                |
| R8-73 | P2     | docs_zh/contracts/typed_event_bus_contract.md §3A           | 已解决：typed event bus contract 已把 OAPEFLIR 事件命名收敛到 `oapeflir.view.* / oapeflir.rationale.*`，truth 关联切到 `harnessRunId + aggregate`                         |
| R8-74 | P2     | docs_zh/adr/072-oapeflir-testing-strategy.md                | 已解决：ADR-072 已改为验证 `HarnessRun / NodeRun / NodeAttemptReceipt` truth 与 `oapeflir.view.*` 投影连续性，并移除不存在测试目录的既成事实引用                           |
| R8-75 | P2     | docs_zh/contracts/runtime_state_machine_contract.md §1A     | 已解决：runtime state machine contract 已把 `OapeflirStageView` 明确为 projection-only，不再把 OAPEFLIR 当工作流状态机                                                        |
| R8-76 | P2     | docs_zh/adr/002-division-system.md                          | 已解决：ADR-002 已标记 superseded，`division` 仅保留历史 alias，现行主体切到 `DomainDescriptor + OrgUnit`                                                                     |
| R8-77 | P2     | docs_zh/contracts/task_and_workflow_contract.md             | 已解决：task/workflow contract 已改为 `domain_id` + `legacy_division_alias`，不再把 `division_id` 当 canonical workflow 锚点                                                  |


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


### 50. 控制平面深层缺口（IAM / Config Center / Stability）

| #      | 严重度 | 文件/领域                                                                    | 问题                                                                                                                               |
| ------ | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R10-01 | P0     | src/platform/control-plane/iam/access-model.ts:270                           | 无权限继承模型；§11.2 要求三层(RBAC→Capability→Context-aware)；ROLE_CAPABILITY_MAP 扁平+手动重复无层级链                           |
| R10-02 | P0     | src/platform/control-plane/iam/ (缺失)                                       | 无会话管理；§11.1/§11.2 要求 access_token TTL=15min/refresh_token=24h/revocation/rotation；IAM 内零会话生命周期代码                |
| R10-03 | P0     | src/platform/control-plane/iam/ (缺失)                                       | 无 MFA 强制；§11+§48 要求企业 SSO/SCIM 含 MFA；无 challenge/enrollment/verification 代码                                           |
| R10-04 | P1     | src/platform/control-plane/iam/ (缺失)                                       | 无 service-to-service auth(mTLS/JWT)；§11.2 要求内部 API mTLS/service token；§8 worker pool 通信要求 mTLS+service identity         |
| R10-05 | P1     | src/platform/control-plane/iam/field-encryption.ts:14                        | normalizeKey() 用 SHA-256 哈希任意长度密码为 AES key 无 proper KDF(PBKDF2/scrypt/argon2)；1字节 key 通过验证(§11.9 要求 Vault/KMS) |
| R10-06 | P1     | src/platform/control-plane/config-center/hierarchical-config-loader.ts:16-20 | Config 层级缺 environment 和 runtime 动态层；§24.1 要求 platform→environment→tenant→pack→runtime 5层                               |
| R10-07 | P1     | src/platform/control-plane/config-center/config-versioning-service.ts:115    | 配置版本化纯内存(Map)；进程重启丢失全部历史；§24.2 要求完整历史+回滚能力                                                           |
| R10-08 | P1     | src/platform/control-plane/config-center/ (缺失)                             | 无动态配置热重载机制；§24.1 要求 hot_reloadable_config+config.changed 事件触发组件热加载；无 file-watcher/push/subscription        |
| R10-09 | P1     | src/platform/control-plane/config-center/config-audit-service.ts:142         | 配置审计轨迹纯内存数组；重启丢失；§24.4 要求 who/when/what/why 合规持久记录                                                        |
| R10-10 | P1     | src/platform/stability/ (缺失)                                               | 无复合健康评分模型；§9/§27 要求加权多维度数值 HealthScore；仅有 4级状态(ok/degraded/overloaded/unhealthy)                          |
| R10-11 | P1     | src/platform/stability/ (缺失)                                               | 无事件响应自动化；§12.2 SEV1-4/§60 emergency brake/§28 incident DLQ 均未实现；stability 仅含 rehearsal/drill                       |
| R10-12 | P1     | divisions/                                                                   | 仅 10个通用运营 division；§37 要求 24个垂直业务域+DomainDescriptor/DomainRiskProfile/DomainEvalSpec 结构化层级                     |
| R10-13 | P2     | src/platform/shared/async/sync-backed-async-service.ts.bak                   | .bak 备份文件提交到源码树；卫生问题                                                                                                |
| R10-14 | P2     | src/platform/control-plane/config-center/config-rollout-service.ts:134       | startRollout 跳到目标阶段(percentage>=target)而非从 PENDING 开始；§24.3 要求强制 canary→10%→full 递进                              |
| R10-15 | P2     | src/platform/control-plane/config-center/config-store.ts:116                 | 变更检测用引用相等(===)；对象/数组永远报变更，mutation-in-place 漏检测                                                             |

### 51. UI Feature 模块 / API Client / Mobile 深层问题

| #      | 严重度 | 文件/领域                                                                    | 问题                                                                                                              |
| ------ | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R10-16 | P0     | ui/packages/shared/api-client/src/rest-client.ts:170-189                     | 无重试或 circuit-breaker；§5.4.1 要求指数退避重试+circuit breaker；HttpTransport.send() 失败即抛异常零重试        |
| R10-17 | P0     | ui/packages/shared/api-client/src/ws-client.ts:100-113                       | WS 断连后永不重连；onclose/onerror 仅设状态 "reconnecting" 从不调 connect()；§5.3 要求指数退避重连(1s~30s+jitter) |
| R10-18 | P0     | ui/packages/features/approval,task-cockpit,workflow-cockpit,settings (hooks) | 所有 mutation 仅更新本地 state 从不调 REST API；approve()/reject()/delegate()/escalateTask() 等全部 setState only |
| R10-19 | P1     | ui/packages/shared/api-client/src/rest-client.ts                             | 无 Accept-Version header；§1.8 要求每个请求携带 Accept-Version:v1 + 处理 406 响应                                 |
| R10-20 | P1     | ui/packages/features/task-cockpit/src/hooks/                                 | TaskCockpit 仅实现 L1-L2 drill-down；§4.2.2 要求 L3 StepOutputViewer/L4 EvidenceChainViewer/L5 TimelineViewer     |
| R10-21 | P1     | ui/packages/shared/api-client/src/endpoints.ts                               | 所有 list fetch 无分页/过滤/排序参数；§5.4.6 要求标准化 page/pageSize/sort/filter                                 |
| R10-22 | P1     | ui/packages/shared/api-client/src/interceptors.ts:62-77                      | Offline-queue interceptor 入队后不短路请求；请求继续到 fetch() 失败；§5.5 要求离线写被捕获+乐观响应               |
| R10-23 | P1     | ui/packages/ui-mobile/src/                                                   | Mobile 包零 React Native 组件；仅 TS 类型描述+静态导航配置；§2.5.5/§2.5.6 要求手势/推送/生物认证/widget           |
| R10-24 | P1     | ui/packages/features/hitl/src/hooks/                                         | HITL hook 全静态/硬编码返回 3个固定项无 API 集成；§4.6.2 要求真实审批路由+4种恢复模式+live PlanBundle 展示        |
| R10-25 | P2     | ui/packages/shared/api-client/src/ws-client.ts:88                            | WS auth token 作为 URL query param 发送；§6.5.4 要求 token 不出现在 URL(被代理/CDN 日志记录)                      |
| R10-26 | P2     | ui/packages/features/conversation/src/hooks/                                 | Conversation 用内存 ConversationClient 无 WS streaming；§4.6.1 要求实时 nl.session.updated/nl.plan.created 事件   |
| R10-27 | P2     | ui/packages/features/analytics/src/hooks/                                    | Analytics 无多层 KPI breakdown/chart-type 配置；§4.2.8 要求 7种图表+角色自适应指标集                              |
| R10-28 | P2     | ui/apps/web/src/runtime.ts:39                                                | Auth token 硬编码字符串 "ui-runtime-access"；interceptor 发送无效 Bearer token 到后端                             |

### 52. Prompt Engine / Injection Guard / 测试体系深层问题

| #      | 严重度 | 文件/领域                                                      | 问题                                                                                                                                  |
| ------ | ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R10-29 | P0     | src/platform/stability/prompt-injection-guard.ts:213-236       | §16.5.2 明确"Classifier 不得单独作为 production hard deny"；实现 blocked:true 直接硬拒绝——违反规格                                    |
| R10-30 | P1     | src/platform/prompt-engine/registry/index.ts                   | §16.2 要求 PromptTemplate status:draft/review/staging/canary/stable/deprecated 生命周期；PromptTemplateRecord 无 status 字段          |
| R10-31 | P1     | src/platform/prompt-engine/registry/prompt-version-manager.ts  | §16.2 要求 version:number(递增整数)；实现用 semver 字符串(v1.0.0)——版本模型矛盾                                                       |
| R10-32 | P1     | src/platform/prompt-engine/registry/                           | §16.1 要求 {{variable}} 模板组合+变量绑定/展开；无模板变量渲染实现；variableSuffixTemplate 存储但从不求值                             |
| R10-33 | P1     | src/platform/prompt-engine/registry/                           | §16.4 要求 PromptBundleCompatibilityMatrix(Tool/Evaluator/DomainDescriptor/Model 兼容)；无兼容矩阵验证                                |
| R10-34 | P1     | src/platform/stability/prompt-injection-guard.ts:117-148       | §16.5.1 要求 ML Classifier；buildSemanticAssessment 纯正则启发式；MLInjectionClassifierConfig 命名误导无真实 ML                       |
| R10-35 | P1     | src/platform/stability/prompt-injection-guard.ts               | §16.5.2 要求联动 Tool Guardrails/Egress Control/Context Assembly/Output Validator；实现为独立纯函数模块零集成点                       |
| R10-36 | P1     | tests/golden/config-file-generation.test.ts:32-42              | 3个 golden test 捕获 schema 验证错误后 assert.ok(true)；schema 变更时测试静默通过——锁定"broken passes"行为                            |
| R10-37 | P1     | tests/e2e/prompt-injection-guard-e2e.test.ts:27                | E2E 直接 import src/platform/stability/ 绕过 canonical prompt-engine/ re-export；模块移动后测试指向错误入口                           |
| R10-38 | P2     | tests/e2e/harness-loop-e2e.test.ts:379-418                     | Duration guard 测试接受 completed∣aborted 两态为通过；无法检测 duration guard 失效                                                    |
| R10-39 | P2     | tests/e2e/harness-loop-e2e.test.ts:46-79                       | HarnessRun lifecycle 测试用静态构造参数；loop 从不调真实 planner/generator/evaluator——仅测编排簿记非执行合约                          |
| R10-40 | P2     | tests/golden/golden-tasks.test.ts:22                           | 硬编码 assert.equal(results.length, 7)；新增 golden task 类即失败(脆弱断言)                                                           |
| R10-41 | P2     | src/platform/stability/prompt-injection-guard.ts:86-94 vs :219 | sanitizePromptInput 和 classifyPromptInjectionRisk 操作不同表示(escaped vs raw NFKC)；分类和清洗不一致                                |
| R10-42 | P2     | tests/e2e/ (缺失)                                              | 无 per-execution budget enforcement e2e 测试；budgetUsdLimit 字段被设置但从不断言实际阻断超支执行                                     |
| R10-43 | P2     | src/platform/prompt-engine/registry/index.ts                   | §16.2 role:planner/generator/evaluator/system；实现用 channel:system/developer/user——完全不同枚举映射 LLM 消息角色非 Harness 管线角色 |

### 53. ADR 新发现矛盾（Round 10）

| #      | 严重度 | 文件/领域                                           | 问题                                                                                                                                         |
| ------ | ------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R10-44 | P0     | docs_zh/adr/054-\*.md (SLA tiers)                   | Platinum 99.99% 无前置条件；§2.5 要求"99.99 只能绑定自动 failover+quorum+演练证据"——ADR 无此约束                                             |
| R10-45 | P0     | docs_zh/adr/096-\*.md (phase 8b)                    | 仍用 "phase 8b" 作为 release gate；§33 明确废弃 Phase 1-9 仅保留历史映射；ADR 未被 remediate                                                 |
| R10-46 | P0     | docs_zh/adr/041-\*.md (create_task bypass)          | TriggerAction.create_task 直接建任务绕过 intake pipeline(RawInput→TaskDraft→Clarification→ConfirmedTaskSpec→RequestEnvelope)；违反 §4.2/§5.3 |
| R10-47 | P1     | docs_zh/adr/070-\*.md (Phase 1-7 roadmap)           | 仍以 Phase 1-7 为 canonical 演进模型；§33 要求 Ring 1/2/3；未标 Superseded                                                                   |
| R10-48 | P1     | docs_zh/adr/059-\*.md (DecisionRecord)              | DecisionRecord 以 agent_id 为键无 harnessRunId/nodeRunId/planGraphId；§5.5 要求所有决策链接到 HarnessRun                                     |
| R10-49 | P1     | docs_zh/adr/083-\*.md vs ADR-042 (autonomy levels)  | ADR-083 定义 4级(manual_only/suggest_only/supervised_execute/trusted_auto_execute)；ADR-042 定义 5级(0-4)；§42 引用 5级模型——两 ADR 互相矛盾 |
| R10-50 | P1     | docs_zh/adr/055-\*.md (Marketplace certification)   | 认证仅含 Prompt Injection 检查；§11.7 要求签名/SBOM/依赖漏扫/最小权限/sandbox egress/tool-call 攻击模拟                                      |
| R10-51 | P1     | docs_zh/adr/048-\*.md (SCIM lifecycle)              | SCIM 入职/转岗/离职为简单自动动作；§2.4 要求 prepare/commit/compensate/audit 四段 Saga 语义                                                  |
| R10-52 | P1     | docs_zh/adr/078-\*.md (Knowledge Plane)             | 将 Knowledge 定位为独立架构平面；v4.3 §4 仅定义 5 plane+X1，Knowledge 属 P5 State&Evidence(§29)                                              |
| R10-53 | P2     | docs_zh/adr/047-\*.md (ApprovalTimeout auto_action) | 超时 auto_action(自动执行预设动作)；§10.3 critical 操作要求 break-glass+双人审批；§2.1 审批延迟时"安全停住"非自动执行                        |
| R10-54 | P2     | docs_zh/adr/051-\*.md (governance delegation)       | 允许 platform 级"全部权限"委托；§2.4 NonOverridableInvariantRegistry 不得被任何管理员/域 owner 关闭——未排除不可覆盖不变量                    |
| R10-55 | P2     | docs_zh/adr/056-\*.md (Learn→Release)               | Learn→Improve→Release 六级发布无 P2 Release Governance 门控；§13.1 明确"Release 是 P2 决策非 OAPEFLIR 自行发布"                              |
| R10-56 | P2     | docs_zh/adr/053-\*.md (ResourcePool)                | 定义 ResourcePool/ResourceAllocation(reserved/used)与 §1.5 冻结的 BudgetLedger/BudgetReservation/BudgetSettlement 并行；无集成/引用          |
| R10-57 | P2     | docs_zh/adr/046-\*.md (OrgTree mutation)            | OrgTree 级联变更无补偿语义；§2.4 要求 prepare/commit/compensate/audit 四段 Saga                                                              |


### 55. 编排平面深层缺口（Evaluator / Observer / Budget / Termination / Truth）

| #      | 严重度 | 文件/领域                                                                     | 问题                                                                                                                      |
| ------ | ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| R11-01 | P0     | src/platform/orchestration/evaluator/ (缺失)                                  | 无 Evaluator 服务；§13.5 定义 Evaluator 为 Harness 一级角色(质量门控/目标偏离/风险升级/决策产出)；整个目录不存在          |
| R11-02 | P0     | src/platform/orchestration/observer/ (缺失)                                   | 无 Observer 服务；§13.2 定义 Observe 为 OAPEFLIR 首阶段产出 ObservationBundle(信号收集/上下文组装)；目录不存在            |
| R11-03 | P1     | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts                | 仅基于 feedback signal 计数评分；缺 §13.5 要求的 constraint compliance/budget adherence/risk boundary/timing SLO 评估维度 |
| R11-04 | P1     | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts:70             | Evaluator 消费 legacy Plan 非 PlanGraphBundle；无法访问图级元数据(节点风险/预算预留/图版本)                               |
| R11-05 | P1     | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts:39             | 质量门控阈值硬编码(defaultPassThreshold:0.5)；§17.3 要求按风险等级+域可配置                                               |
| R11-06 | P1     | src/platform/execution/budget-allocator.ts                                    | 无水位告警/自动限流/跨 run 优先级；§18.2-18.3 要求 watermark alert+auto-throttle+platform→tenant→pack→step 层级预算       |
| R11-07 | P1     | src/platform/execution/budget-allocator.ts:35-44                              | reserve() 无预留过期清扫器+无流式增量 reserve/settle(§18.3 要求 Sweeper+streaming 每 N token settle)                      |
| R11-08 | P1     | src/platform/execution/run-termination-cleanup.ts                             | 无 state evidence flush/compensation trigger/notification；§8.6 要求优雅终止含证据刷写+副作用补偿+通知发送                |
| R11-09 | P1     | src/platform/state-evidence/projections/projection-rebuild-service.ts:217     | 每次 handler(null, event) 传 null 不线程化状态；projection rebuild 无法跨事件累积状态(§25.4 rebuild 失效)                 |
| R11-10 | P1     | src/platform/state-evidence/projections/projection-rebuild-service.ts         | 无 shadow-build/compare/cutover 协议；§28.6 要求影子投影→hash 比对→切换→保留旧版回滚+API stale marker                     |
| R11-11 | P2     | src/platform/execution/run-termination-cleanup.ts:65                          | 始终返回 complete:true 不论实际清理成功/失败；无 partial-failure 追踪/incident 创建(§12 异常处理)                         |
| R11-12 | P2     | src/platform/state-evidence/truth/ (全域)                                     | 无 snapshot 版本化；worker-snapshot-repository 用 bare UPSERT 无 version 列/CAS/乐观并发(§25.3/§25.10)                    |
| R11-13 | P2     | src/platform/state-evidence/events/projections/workflow-run-projection.ts:196 | processedEventIds 无界数组+includes() O(n) 去重；长运行工作流内存/性能恶化；需 Set 或 watermark 去重                      |
| R11-14 | P2     | src/plugins/validators/basic-evaluator.ts                                     | Evaluator 插件仅验证字段存在/类型；无质量评分/目标偏离检测/风险检查/HarnessDecision 产出(§13.5)                           |

### 56. 交互子系统深层缺口（Wizard / Template / NL Pipeline / Dashboard）

| #      | 严重度 | 文件/领域                                                                 | 问题                                                                                                                                     |
| ------ | ------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R11-15 | P1     | src/interaction/ux/wizard/index.ts                                        | §44.2 要求后退导航+步骤历史栈；WizardSession 仅 currentStepId+canAdvanceWizard()无 goBack()/history                                      |
| R11-16 | P1     | src/interaction/ux/wizard/index.ts                                        | §44.2 要求进度持久化(跨会话 save/restore)；WizardSession 纯内存 Zod schema 无序列化/session storage/resume                               |
| R11-17 | P1     | src/interaction/ux/wizard/index.ts                                        | §44.2 要求条件步骤(基于前序答案 show/hide)；steps 为静态扁平数组无条件谓词/skip/分支                                                     |
| R11-18 | P1     | src/interaction/ux/template-engine/index.ts                               | 16行 stub；§44.3 要求域模板+参数化工作流+模板市场集成；InteractionTemplate 仅含 templateId/title/steps:string[]                          |
| R11-19 | P1     | src/interaction/nl-gateway/index.ts:804-898                               | §39.5 要求对话上下文跨轮携带(Memory §29.2)；ConversationContextManager 存在但从未被 parseDetailed/buildTask 调用——每次解析无状态         |
| R11-20 | P1     | src/interaction/nl-gateway/intent-parser/index.ts                         | §39.3 IntentParser 应通过 ModelGateway 做多语言意图识别；实现纯正则(parseIntentTokens)+硬编码模式无 LLM/置信度评分                       |
| R11-21 | P1     | src/interaction/nl-gateway/slot-resolver/index.ts                         | §39.2 要求迭代 slot-filling(Clarification loop)；resolveRequiredSlots 单 pass 返回缺失 slot 无多轮填充/提示生成/ClarificationState 驱动  |
| R11-22 | P1     | src/interaction/goal-decomposer/planner/index.ts                          | §40.2 要求优先级调度；buildExecutionBatches 仅拓扑序——Goal.priority 从不被咨询；critical 任务不会优先于 low                              |
| R11-23 | P1     | src/interaction/goal-decomposer/llm-plan-generator.ts:49                  | §40.2 要求预算传播到子任务；generate() 所有任务 estimatedCost.confidence="low"/sampleCount=0；目标预算约束未按子任务比例分配             |
| R11-24 | P1     | src/interaction/dashboard/alert-router/index.ts                           | §43 要求多通道路由(dashboard/push/NL summary)；仅含 sortAttentionQueue()纯排序函数无路由/dispatch/escalation/确认                        |
| R11-25 | P1     | src/interaction/dashboard/metric-aggregator/index.ts                      | §43.2-43.5 要求时序聚合/趋势/SLO 比较/域级分组；summarizeTaskMetrics 仅 4状态单快照计数无窗口/P50/P95/SLO gap                            |
| R11-26 | P2     | src/interaction/nl-gateway/ (ambiguity-handler vs disambiguation-handler) | 重复 detectAmbiguity 函数(不同逻辑)从两个模块导出——import 冲突风险+行为不一致                                                            |
| R11-27 | P2     | src/interaction/ux/onboarding/index.ts:310                                | recommendDomains() 硬编码正则关键词匹配；§44.4 要求基于业务上下文的智能域推荐(LLM/用户历史/DomainRegistry)                               |
| R11-28 | P2     | src/interaction/ux/onboarding/index.ts                                    | §44.5 要求 progressive disclosure(按用户模式隐藏复杂度)；buildVisualWorkflowBuilder/buildDomainOnboardingWizard 不按模式区分返回相同结构 |
| R11-29 | P2     | src/interaction/dashboard/dashboard-websocket-server.ts:330-346           | performHeartbeat() 标记超时连接 isConnected=false 但不从 connections/subscribers 移除——无界内存增长+stale 推送                           |

### 57. 跨切面架构问题（错误处理 / 日志 / 类型安全 / 平面耦合）

| #      | 严重度 | 文件/领域                                                                              | 问题                                                                                                                           |
| ------ | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| R11-30 | P0     | src/platform/control-plane/incident-control/auto-stop-loss-service.ts:803              | executePlaybook() .catch(()=>{}) 静默吞没全部错误；健康事件期间 runbook 失败不可见——§9.6 要求分类+证据记录                     |
| R11-31 | P1     | src/platform/shared/observability/structured-logger.ts:42-59                           | StructuredLogEntry 缺 tenantId/harnessRunId；§7.1 要求每条日志含 traceId+spanId+tenantId+harnessRunId                          |
| R11-32 | P1     | src/platform/interface/channel-gateway/stream-bridge.ts:147,251                        | JSON.parse() as T 无 schema 验证在 inter-plane 边界；§5.2 要求所有平面间通信 schema-validated                                  |
| R11-33 | P1     | src/platform/interface/channel-gateway/channel-gateway-delivery-service.ts:540,698,746 | 三处 JSON.parse() as Record<string,unknown> 无运行时验证；DB payload_json 反序列化越过平面边界无校验                           |
| R11-34 | P1     | src/platform/interface/channel-gateway/websocket-bridge.ts:135                         | WS 消息 JSON.parse() as WebSocketMessageType 无 schema 验证；外部客户端输入在入口边界需运行时 schema 检查                      |
| R11-35 | P1     | src/platform/interface/api/http-server/prompt-routes.ts:44                             | schema.parse 后立即 payload as any 转交——验证产出的类型安全被 any 抹除；字段漂移静默通过                                       |
| R11-36 | P1     | src/platform/execution/lease/execution-lease-service-async.ts:502                      | audit as any 在 lease audit 插入处抹除类型安全——执行平面与证据平面间类型合约断裂                                               |
| R11-37 | P1     | src/org-governance/org-model/hr-role-governance-service.ts:24                          | 跨平面深度 import：org-governance 直接导入 platform/execution/tool-executor/tool-recommend-service.ts 绕过 contracts 层        |
| R11-38 | P1     | src/platform/compliance/compliance-case-orchestration-service.ts:4                     | Platform 平面导入 org-governance/compliance-engine/ 形成双向依赖——违反平面间单向依赖规则                                       |
| R11-39 | P1     | src/platform/interface/api/http-server/dashboard-routes.ts:14                          | Platform API 层直接导入 interaction/ux/ 跨平面边界无 contract 接口                                                             |
| R11-40 | P1     | src/platform/contracts/errors.ts                                                       | 异常分类法缺 ResourceError/SecurityError/BusinessRuleError(§9.6 要求 transient/permanent/resource/security/business-rule 五类) |
| R11-41 | P2     | src/interaction/ux/ux-event-tracking-service.ts:122,136                                | 双重 as any 转换使 UX 事件逃逸类型检查；分析管线可收到畸形数据                                                                 |
| R11-42 | P2     | src/domains/registry/plugin-spi-registry.ts:488                                        | .catch(()=>undefined) 静默丢弃 Promise rejection；插件超时原因丢失无日志/证据                                                  |
| R11-43 | P2     | src/platform/state-evidence/events/durable-event-bus.ts:474,508,523                    | 多处 .catch(()=>undefined/0) 使事件投递链失败对证据平面不可见；交付顺序错误无法追踪                                            |
| R11-44 | P2     | src/sdk/cli/stable-runner-factory.ts:166                                               | (runner as any)(runnerArgs) 擦除 runner 函数签名；参数合约不匹配仅运行时暴露                                                   |

### 58. ADR 新矛盾（Round 11）

| #      | 严重度 | 文件/领域                                    | 问题                                                                                                                                                        |
| ------ | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R11-45 | P0     | docs_zh/adr/069-\*.md (Self-operating agent) | 自运维 agent restart_service/scale_up/rotate_secrets 不经 RuntimeStateMachine.transition()/OperationalDirective；§5.3 要求所有状态变更走 canonical 控制路径 |
| R11-46 | P1     | docs_zh/adr/065-\*.md (Debugger)             | 使用 workflow_id/WorkflowDAGView/StepInspector/step_over 等废弃模型；§5.5 要求 PlanGraph+NodeRun 操作；无 remediation                                       |
| R11-47 | P1     | docs_zh/adr/062-\*.md (Edge sync)            | last_write_wins 冲突解决与 §25.11/§52.3 single-leader truth write+fencing 矛盾；未区分 truth vs projection 对象                                             |
| R11-48 | P1     | docs_zh/adr/094-\*.md (OAPEFLIR Execute)     | "落盘 run、step、decision" 使用 step 作为持久执行单元；§5.5 step 仅为语义投影，NodeRun/NodeAttempt 为持久 truth                                             |
| R11-49 | P1     | docs_zh/adr/101-\*.md (Domain risk override) | 域风险画像优先于平台默认但未引用 DomainRiskSpec 必填字段(advisory_only/human_accountable/deterministic_hot_path_only)；不可强制                             |
| R11-50 | P1     | docs_zh/adr/095-\*.md (OAPEFLIR context)     | "为 Harness step 提供上下文输入"——§45 要求上下文按 NodeRun 组装非 step                                                                                      |
| R11-51 | P1     | docs_zh/adr/044-\*.md (User roles)           | 角色(business_operator/team_lead/executive/admin)未对齐 §46 组织层级(enterprise/business_unit/department/team/seat)                                         |
| R11-52 | P1     | docs_zh/adr/057-\*.md (External adapter)     | circuit_break/retry 本地重实现；§4.7 X1 Reliability Fabric 要求为中间件/库级关注点；缺 SideEffectRecord 集成                                                |
| R11-53 | P1     | docs_zh/adr/104-\*.md (Domain recipes)       | 12种 recipe archetype 未绑定 DomainDescriptor.recipes 字段(ADR-081/100)或四阶段 onboarding(ADR-103)；与 §37-§38 集成断裂                                    |
| R11-54 | P2     | docs_zh/adr/085/086/087-\*.md                | 引用 "v2.7" 为来源版本；当前架构 v4.3——版本引用过时造成混淆                                                                                                 |
| R11-55 | P2     | docs_zh/adr/049-\*.md (CompliancePolicy)     | 用 department_id 作范围；§46 OrgNode 层级(enterprise→team→seat)要求 orgNodeId 支持所有层级                                                                  |
| R11-56 | P2     | docs_zh/adr/067-\*.md (Capacity planning)    | 无 Ring 分配标签；§33 将 capacity planning 置于 Ring 3(Enterprise)——可能导致 MVP 阶段过早实现                                                               |
| R11-57 | P2     | docs_zh/adr/105-\*.md (Latency tiers)        | 超低延迟 tier 未引用 §3.2 deterministic_hot_path_only 约束(不可用 LLM/Harness loop)；tier 分类未强制 v4.3 非目标边界                                        |


### 60. 事件总线与流式基础设施深层缺陷

| #      | 严重度 | 文件/领域                                                             | 问题                                                                                                                               |
| ------ | ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R12-01 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:93            | 无 partition-by-aggregate 排序保证；§7.3/§28.3 要求同聚合内 sequence 单调递增+分区 outbox；flat subscribers Map 无聚合分区         |
| R12-02 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:534           | 无 consumer group 隔离；§7.3 要求 EventInbox.consumeOnce per consumer；所有订阅者同等处理无独立 offset/优先级/组级 circuit-breaker |
| R12-03 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:378           | DLQ 仅日志无持久队列；§28.8 要求 DLQ 含 category/reason/retry_count/operator_action_log+inspect/redrive/discard with approval      |
| R12-04 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:436           | Polling 10ms 硬编码无 back-pressure；§9.2 要求 queue-depth graduated back-pressure(reject low priority→DLQ→incident)               |
| R12-05 | P1     | src/platform/state-evidence/events/transactional-event-appender.ts:96 | 手动 BEGIN/COMMIT/ROLLBACK 绕过 db.transaction() wrapper；嵌套事务冲突风险(§25.2 原子 truth+event 保证)                            |
| R12-06 | P1     | src/platform/state-evidence/events/dlq-service.ts:112                 | DLQ 纯内存 Map；进程重启丢失全部死信；§28.8 要求持久化 DLQ+redrive 支持                                                            |
| R12-07 | P1     | src/platform/interface/channel-gateway/websocket-bridge.ts:269        | WS broadcast 无 back-pressure；不检查 buffered amount/send queue depth；慢客户端造成服务端内存无界增长                             |
| R12-08 | P1     | src/platform/interface/channel-gateway/websocket-bridge.ts:77         | WS 无 last_event_id resume/replay；§7 要求断连重连+从 last_event_id 恢复+stream_gap 事件；客户端丢事件                             |
| R12-09 | P2     | src/platform/interface/channel-gateway/stream-bridge.ts:379           | Replay buffer 满时 splice(0,1) 丢最老帧不论类型——可丢 completed/failed/approval_requested 关键事件                                 |
| R12-10 | P2     | src/platform/state-evidence/events/projections/ (全部 7文件)          | idempotency 用 Array.includes() O(n)+无界增长；需 Set 或 watermark 去重(§28.6 高效可重建)                                          |
| R12-11 | P2     | src/platform/state-evidence/events/projections/ (全部 7文件)          | 无 freshness/stale 元数据；§28.6/§25.5 要求投影暴露 lastProjectedAt/lagMs/stale 标志                                               |
| R12-12 | P2     | src/platform/interface/channel-gateway/channel-gateway-service.ts:401 | 仅支持 3协议(telegram/slack/webhook)硬编码；§6 要求可插拔协议适配器注册表+协议翻译层                                               |

### 61. 安全模型深层缺陷（Sandbox / PDP / Secret / Command）

| #      | 严重度 | 文件/领域                                                        | 问题                                                                                                                               |
| ------ | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R12-13 | P0     | src/platform/control-plane/iam/policy-engine.ts:246              | full-auto 模式对所有风险类别(含 destructive/irreversible/prod_affecting)直接放行；§10.1 要求 deny-by-default+高风险强制升级        |
| R12-14 | P0     | src/platform/control-plane/iam/sandbox-policy.ts:433-442         | restricted_exec 模式跳过路径边界检查(containsPathTraversalOutside 被豁免)；任意路径(/etc/shadow 等)通过验证(§10.3 filesystem jail) |
| R12-15 | P0     | src/platform/control-plane/iam/sandbox-policy.ts                 | 无 time/memory/CPU 资源限制；§10.3 要求 per-tier 时间上限/内存上限/网络隔离——完全未建模                                            |
| R12-16 | P1     | src/platform/control-plane/iam/audit-event-integrity.ts:270      | 审计链用 plain SHA-256 无 HMAC/签名密钥；DB 写入攻击者可重算全链——§11.5 要求 tamper-evident 审计                                   |
| R12-17 | P1     | src/platform/control-plane/iam/policy-engine.ts                  | 策略决策(evaluate())不发射审计事件；auditPayload 填充后从不调用审计服务——§11.5 要求所有授权决策产出审计记录                        |
| R12-18 | P1     | src/platform/control-plane/iam/access-model.ts:270-277           | evaluateAuthorizationContext() 无匹配规则时默认 allowed:true(context.default_allow)；§10.1 要求 deny-by-default                    |
| R12-19 | P1     | src/platform/control-plane/iam/vault-http-secret-provider.ts:173 | 静态 Vault token 缓存任意 1h TTL 无实际过期验证；已撤销 token 继续使用长达 1小时                                                   |
| R12-20 | P1     | src/platform/control-plane/iam/network-egress-policy.ts:219      | Egress 默认 audit_only 模式——blocked destination 决策仍返回 allowed:true；无显式 env 配置时 egress 从不实际阻断                    |
| R12-21 | P1     | src/platform/control-plane/iam/                                  | secret resolution / policy evaluation 无速率限制；可暴力枚举 secret 引用或洪泛 PDP                                                 |
| R12-22 | P1     | src/platform/execution/tool-executor/command-security.ts:99      | curl/wget 允许(allowed:true riskLevel:high)无 URL/目的地限制；不经 NetworkEgressPolicyService——可 curl 任意内部端点                |
| R12-23 | P2     | src/platform/execution/tool-executor/command-security.ts:79      | env/printenv 允许(riskLevel:medium)——暴露全进程环境含 AA*VAULT_TOKEN/AA_SECRET*\* 等密钥                                           |
| R12-24 | P2     | src/platform/control-plane/iam/vault-http-secret-provider.ts:232 | isAvailable() 发送 X-Vault-Token:"dummy" 作 fallback——泄漏意图到 Vault 审计日志+可能触发锁定策略                                   |

### 62. UI 状态管理 / 构建 / 安全 / 可观测 + 平台剩余缺口

| #      | 严重度 | 文件/领域                                    | 问题                                                                                                                               |
| ------ | ------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R12-25 | P1     | ui/packages/shared/state/src/stores/         | 缺 notification/theme 全局 store；§5.1 要求 auth+theme+notifications 三个全局 Zustand store                                        |
| R12-26 | P1     | ui/packages/shared/state/src/                | 零 mutation/useMutation/optimistic update；§5.6.5 要求乐观更新(onMutate→cache patch→rollback on error)；UI 全只读无写路径          |
| R12-27 | P1     | ui/apps/web/vite.config.ts                   | 无 production source maps(build.sourcemap 未设置默认 false)；§7.1 要求生产环境可调试                                               |
| R12-28 | P1     | ui/packages/shared/telemetry/src/index.ts    | 无 Core Web Vitals/RUM 追踪(LCP/FCP/CLS/INP)；§7.3 要求性能指标采集；web-vitals 未列入依赖                                         |
| R12-29 | P1     | ui/apps/web/index.html:8                     | CSP 含 'unsafe-inline' for styles；§6.5.4 要求 nonce/hash-based style-src                                                          |
| R12-30 | P1     | src/platform/execution/ (缺失)               | 无 ReconciliationWorker/CompensationManager 实现；§14.12/§14.13 要求模糊副作用解决+可逆副作用修复；INV-SIDEEFFECT-001 无运行时强制 |
| R12-31 | P1     | src/platform/ (缺失)                         | 无 HibernationRecord/WakeEngine 实现；§20.2 要求休眠/唤醒条件/恢复兼容性检查；长运行工作流无法休眠/恢复                            |
| R12-32 | P2     | ui/apps/web/index.html:7-8                   | CSP 通过 meta 标签而非 HTTP header 投递——frame-ancestors 被忽略+无 report-uri/report-to                                            |
| R12-33 | P2     | ui/package.json (CI scripts)                 | CI 无依赖漏洞扫描(npm audit/Snyk/Trivy)；§6.5 要求供应链安全扫描                                                                   |
| R12-34 | P2     | ui/scripts/perf-budget.mjs                   | 性能预算检查原始字节非 gzip；§2.5.1/§7.3.4 目标为 gzip 大小；实际传输尺寸未验证                                                    |
| R12-35 | P2     | ui/packages/shared/state/src/query-client.ts | QueryClient retry=1 + flat staleTime:30s 全局；§5.1.2 要求按数据重要性分层 staleTime(实时数据→0/静态配置→长)                       |

### 63. 运维成熟度 / 市场 / Model Gateway 深层缺口

| #      | 严重度 | 文件/领域                                                                     | 问题                                                                                                                                      |
| ------ | ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| R12-36 | P0     | src/platform/orchestration/oapeflir/types/feedback-signal.ts                  | §56.2 FeedbackSignal 须携带 FeedbackTrustScore(来源可信度/历史准确率/攻击面)；schema 无此字段——低信任/对抗反馈不过滤流入学习管线          |
| R12-37 | P1     | src/ops-maturity/drift-detection/changepoint-detector/index.ts                | §63.2 要求 4检测窗口(1h Z-Score/7d CUSUM/30d Bayesian/90d KL-JS)；仅单一 24h 滑窗+固定 -10% 阈值；缺 5个 canonical 指标维度               |
| R12-38 | P1     | src/ops-maturity/drift-detection/fingerprint-builder/index.ts                 | §63.1 BehaviorFingerprint.window 须为 1h/7d/30d/90d 枚举+含 avg_step_count；实现为自由 {start,end} 日期范围无枚举+缺字段                  |
| R12-39 | P1     | src/ops-maturity/drift-detection/cross-agent-analyzer/index.ts                | §63.4 要求 CrossAgentDriftAlert+domain peer group+anti-gaming filter；仅返回 generic recommendation 字符串无告警/域分组/过滤              |
| R12-40 | P1     | src/platform/model-gateway/provider-registry/unified-chat-provider.ts         | ChatCompletionUsage 缺 estimatedCost 字段；§15.2 per-provider usage metering 无法通过统一接口上报成本                                     |
| R12-41 | P1     | src/platform/model-gateway/provider-registry/model-routing-service.ts         | ModelRouteRequest 缺 data_residency/pii_input_detected/pii_output_possible/model_training_opt_out/judge_independence 约束字段(§15.3)      |
| R12-42 | P0     | src/ops-maturity/compliance-reporter/template-registry/index.ts               | §66.1 template 须含 lockedOnGeneration/reportVersionLock/requiredDataSources/legal_version/migration_rule；Zod schema 仅 6字段严重不足    |
| R12-43 | P1     | src/ops-maturity/compliance-reporter/evidence-mapper/index.ts                 | §66.2 要求 ControlMapper(control point+pass/fail/partial)+GapAnalyzer(remediation/owner/deadline)；仅按类型分组无 control point 映射      |
| R12-44 | P1     | src/scale-ecosystem/marketplace/certification/index.ts                        | §55.1 Quality&Security Gate 要求自动扫描/SBOM/签名/兼容性测试/sandbox 验证；14行仅含 3态枚举+boolean check                                |
| R12-45 | P2     | src/scale-ecosystem/marketplace/marketplace-governance-service.ts             | §55.5 要求 4阶段(active→deprecated→sunset→removed)+sunset 180d 阻新安装+migration_threshold≥95%；仅 deprecated/retired 两态无 sunset/阈值 |
| R12-46 | P2     | src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts:82 | §66.2 报告须经 HumanSignoff 才标 attested；generate()返回 generated/partial 状态无 signoff 强制/signoff_due_at/escalation                 |


### 65. 学习与改进子系统深层缺陷

| #      | 严重度 | 文件/领域                                                              | 问题                                                                                                                                                      |
| ------ | ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R13-01 | P0     | src/platform/orchestration/learn/learning-object-model.ts              | LearningObject promotionStatus 缺 quarantine 态；§29.4 要求"LearningCandidate 默认进入 quarantine"；代码从不隔离                                          |
| R13-02 | P0     | src/platform/orchestration/learn/learning-object-validator.ts          | 无 PII/secret scan/holdout dedup/contamination check/diversity check(§29.4/§56.2)；仅检查 evidence ref count+confidence                                   |
| R13-03 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:318       | ImprovementCandidate register 后立即 approved 无 EvaluationGate/离线评测/回归集/风险扫描/人工审批(§13.14)                                                 |
| R13-04 | P1     | src/ops-maturity/drift-detection/benchmark-runner.ts:62                | baseline 硬编码(successRateBefore=0.60/avgCostBefore=0.30)+Math.random()模拟——§56.4 要求锁定真实输入样本+eval version                                     |
| R13-05 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts                  | 仅分析失败(filter !success)；§20/§58.3 要求成功+失败关联模式提取；成功模式被丢弃                                                                          |
| R13-06 | P1     | src/ops-maturity/drift-detection/ vs src/platform/orchestration/learn/ | 两套并行断开的学习管线(EvolutionIntegrationService vs StrategyLearningService)；§56 定义统一管线——学习从不合并                                            |
| R13-07 | P1     | src/platform/state-evidence/knowledge/semantic-knowledge-graph.ts      | 无学习衍生边类型(learned_from/failure_pattern/causal_relationship/temporal_correlation)；promoted knowledge 为扁平文档无图级洞察                          |
| R13-08 | P1     | src/platform/state-evidence/knowledge/knowledge-model.ts:3             | TrustLevel(verified/reviewed/community/unverified) 与 §29.1(private_unverified/team_reviewed/official/authoritative)不匹配                                |
| R13-09 | P2     | src/platform/orchestration/learn/knowledge-promotion-service.ts:97     | 多 LearningObject 批量推广事件仅报首个对象 metadata——后续对象可追溯性丢失(§28 每个 fact event 独立可追踪)                                                 |
| R13-10 | P2     | src/ops-maturity/drift-detection/rollout-manager.ts                    | 无自动回滚触发(metric threshold→rollback_pending)；§56.4 要求质量/成本/安全指标触发阈值时自动进入 rollback                                                |
| R13-11 | P2     | src/ops-maturity/drift-detection/proposal-engine.ts:160                | 所有自动生成 proposal 硬编码 risk:'low'(含安全相关 prompt_patch)；§56.5 涉及核心 Prompt/风控变更须人工审核                                                |
| R13-12 | P2     | src/ops-maturity/ (结构)                                               | 无 learning/improvement 子目录(§35 推荐)；学习在 orchestration/learn/，改进在 orchestration/improve-rollout/，ops-maturity 含独立 evolution——违反目录合约 |

### 66. Worker Pool / Dispatch / Retry 深层缺陷

| #      | 严重度 | 文件/领域                                                           | 问题                                                                                                                |
| ------ | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| R13-13 | P0     | src/platform/orchestration/harness/recovery-controller.ts           | 无重试限制/退避/预算；§9.3 要求指数退避(base=1s/max=60s)+max retries+retry_exhausted 升级；可能无限重试循环         |
| R13-14 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:176 | Dispatch 队列无优先级排序——insertion order 遍历；§8.5/§14 要求优先级队列；urgent ticket 须等前序全部失败            |
| R13-15 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:174 | 无租户公平调度；单租户洪泛可垄断全部 worker；§9.1/§53 要求 per-tenant 隔离/round-robin/加权公平队列                 |
| R13-16 | P1     | src/platform/orchestration/harness/recovery-controller.ts           | 无 node-vs-graph 重试范围区分；§45.15 定义 5种暂停原因+4种恢复策略+retry_same_plan(节点级) vs replan(图级)          |
| R13-17 | P2     | src/platform/orchestration/harness/loop/index.ts:48-54              | retry_same_plan 立即重执行无退避；§9.3 要求指数退避+jitter(base=1s/max=60s)；瞬态故障造成雷群放大                   |
| R13-18 | P2     | src/platform/execution/worker-pool/ (全域)                          | 无自动扩缩信号发射；§8.1 "队列积压>阈值→增加 worker"——无 scale-up/scale-down 信号或 warm-pool 预留                  |
| R13-19 | P2     | src/platform/execution/worker-pool/worker-service-identity.ts:27    | WorkerServiceIdentityRegistry 纯内存 Map；coordinator 重启后所有 worker identity 丢失——§8.2 要求 P5 持久化          |
| R13-20 | P2     | src/platform/execution/lease/execution-lease-service.ts:331         | Lease handover 不验证新 worker capabilities/isolation level/repo version；可将执行放到缺必要工具或沙盒强度的 worker |

### 67. Scale-Ecosystem 深层缺口（Federation / Multi-Region / Tenant / Marketplace）

| #      | 严重度 | 文件/领域                                                          | 问题                                                                                                          |
| ------ | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| R13-21 | P0     | src/scale-ecosystem/federation/ (缺失)                             | Federation 模块完全不存在；§52 要求跨平台发现/信任建立/workload 委托/联邦身份/数据主权强制                    |
| R13-22 | P0     | src/scale-ecosystem/multi-region/                                  | 无 split-brain 防护；§52 要求 quorum/consensus/split-brain 检测与解决；failover 纯延迟判断无分布式共识        |
| R13-23 | P0     | src/scale-ecosystem/multi-region/                                  | 无 RPO/RTO 保证；data-replicator 无 lag 测量/SLA 断言；failover 无有界完成时间                                |
| R13-24 | P1     | src/scale-ecosystem/multi-region/                                  | 无 active-active vs active-passive 拓扑声明；§52 要求显式模式；所有 region 同等处理无冲突解决或提升协议       |
| R13-25 | P1     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts     | 无 tenant lifecycle management(suspend/deactivate/decommission)；§50 要求完整生命周期；仅有 createTenant      |
| R13-26 | P1     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts     | 无 per-tenant 静态加密；encryptionPolicy 仅元数据标签无实际密钥供应/加密实现(§50)                             |
| R13-27 | P1     | src/scale-ecosystem/tenant-platform/                               | 无 noisy-neighbor 防护；quota-enforcer 为纯函数从未被 tenant-platform 调用；无资源隔离/CPU/内存限制/限流(§50) |
| R13-28 | P1     | src/scale-ecosystem/marketplace/catalog/index.ts:56                | 依赖验证忽略 versionRange——不解析 semver 范围(§55 version compatibility matrix)                               |
| R13-29 | P1     | src/scale-ecosystem/marketplace/catalog/index.ts                   | 无传递依赖图解析/环检测(§55 dependency graph)；仅 depth-1 直接依赖检查                                        |
| R13-30 | P1     | src/scale-ecosystem/marketplace/                                   | 无自动升级路径计算/breaking change 检测(§55)；compatibilityJson 存储但从不跨版本比较                          |
| R13-31 | P2     | src/scale-ecosystem/tenant-platform/data-plane-flow-service.ts:611 | scopeCompatibility tenantId:null 时绕过——global namespace 可自由与任何 tenant-scoped namespace 交换数据       |
| R13-32 | P2     | src/scale-ecosystem/tenant-platform/                               | tenant-scoped quota 从不在 tenant-platform 中检查；创建 workspace/namespace/binding 无资源配额限制            |

### 68. 架构合约缺失确认（§ 级未实现）

| #      | 严重度 | 文件/领域                                                             | 问题                                                                                                                  |
| ------ | ------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| R13-33 | P0     | src/ (全域缺失)                                                       | §3.2 ResponsibilityBoundary 类型完全不存在；advisory_only/human_accountable 边界模式无定义无运行时强制                |
| R13-34 | P0     | src/platform/orchestration/hitl/                                      | §45.18 HITL 5能力中 modify-and-approve/override-decision/force-terminate 3项零实现——无类型/handler/枚举               |
| R13-35 | P1     | src/platform/contracts/executable-contracts/index.ts:407              | §14.11 SideEffectRecord 缺 rollback_handler/timeout 字段(每效果截止时间+内联回滚处理器)                               |
| R13-36 | P1     | src/ops-maturity/drift-detection/proposal-engine.ts:17                | §20.3 ImprovementProposal 生命周期偏离 spec(缺 draft/reviewed/staged/stable/retired 态)；primitives.ts 又一套不同枚举 |
| R13-37 | P1     | src/platform/orchestration/hitl/hitl-modes.ts                         | §45.18 force-terminate 能力缺失——7种交互模式无一映射到强制终止动作                                                    |
| R13-38 | P1     | src/platform/orchestration/hitl/hitl-modes.ts                         | §45.18 override-decision 能力缺失——无 action type 允许人类覆盖先前自动/人工决策                                       |
| R13-39 | P1     | src/scale-ecosystem/resource-manager/quota-enforcer/index.ts          | §53 QuotaEnforcer 无状态——无持久 per-tenant 用量累积/租户注册；scopeId optional 从不绑定租户                          |
| R13-40 | P2     | src/platform/contracts/executable-contracts/index.ts:407              | §14.11 SideEffectRecord 缺 compensation_plan 内联字段(CompensationRecord 独立存在但 SideEffectRecord 无直接引用)      |
| R13-41 | P2     | src/platform/model-gateway/degradation/deterministic-hot-path-gate.ts | §3.2 deterministic_hot_path_only 仅用于延迟路由而非责任边界强制；无运行时阻止 agent 超越其边界                        |


### §70 Incident/SLO/Reliability 深层缺陷

| #      | 严重度 | 文件/位置               | 问题                                                                                                                                                             |
| ------ | ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R14-01 | P0     | platform-panic/         | 无 Platform Panic 实现——仅有 "panic_stop" 字符串枚举，无实际传播/状态保存/恢复协议(§60 要求 cascade halt+PanicAcknowledgment+dual-admin PlatformResumeDirective) |
| R14-02 | P0     | incident-detector.ts    | Incident severity 用 p1-p4 非 SEV1-4(§12.2)；与 runbook priority P0-P3 混淆无映射                                                                                |
| R14-03 | P1     | incident-control/       | Incident lifecycle 仅 4态(open/acknowledged/resolved/closed)缺 triaged/mitigating/reviewed(§12.5)；缺 reviewed→closed post-mortem 门                             |
| R14-04 | P1     | incident-control/       | 无 post-mortem 自动化(§12.5/§60.3 要求 72h 内 Post-Incident Report)                                                                                              |
| R14-05 | P1     | incident-detector.ts    | 仅检测 p1/p2 两级；§12.3 定义 5条规则映射 SEV1-3 含自动动作；无可配置规则引擎                                                                                    |
| R14-06 | P1     | slo-alerting-service.ts | SLO 无 per-domain 范围——slo_definitions 表无 domainId/tenantId 列(§27/§37.9)                                                                                     |
| R14-07 | P1     | slo-alerting-service.ts | SLO breach 仅冻结 rollout——§27.6 要求梯度响应(50-80%减速/80-100%冻结/>100%全冻+可靠性冲刺)                                                                       |
| R14-08 | P1     | slo-alerting-service.ts | Burn-rate alerting 无 multi-window 策略(§27.6 要求 1h>14.4x→SEV2/6h>6x→SEV3)                                                                                     |
| R14-09 | P1     | chaos/                  | Chaos experiment 假设违反仅记录 status="violated" 无自动回滚/爆炸半径控制(§61)                                                                                   |
| R14-10 | P2     | incident-control/       | 无 war-room 协调服务(SEV1 多参与者协调)                                                                                                                          |
| R14-11 | P2     | incident-detector.ts    | Incident ID 用 Math.random() 非加密唯一——并发可碰撞                                                                                                              |

### §71 代码质量/实现 Bug

| #      | 严重度 | 文件/位置                                  | 问题                                                                                             |
| ------ | ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| R14-12 | P0     | oapeflir-loop-service.ts:273               | knowledgePromotion.promote() 无 await——Promise rejection 静默丢失                                |
| R14-13 | P0     | task-routes.ts:255                         | PATCH /v1/tasks/:id 传旧 inputJson 不传新 title——title 静默丢弃(数据丢失 bug)                    |
| R14-14 | P1     | oapeflir-loop-service.ts:358               | 返回原始未验证 assessment/observation 非实际使用的 validated 版本——下游数据不一致                |
| R14-15 | P1     | chargeback-service.ts:38                   | 跨币种 currency 被最后一条覆盖+金额天真求和——多币种 chargeback 静默错误                          |
| R14-16 | P1     | response-hardening.ts:12                   | CORS allowedOrigins:["*"]+credentials:true echoing origin——任何来源可发送凭据请求                |
| R14-17 | P1     | incident-routes.ts:66                      | tenantId 解析后 void——incidents 无租户范围限制(跨租户数据泄漏)                                   |
| R14-18 | P1     | task-routes.ts:73                          | queryTaskInspectSummaries 始终 fetch 200 条内存分页——over-fetch 不可扩展                         |
| R14-19 | P1     | rollout/index.ts:78                        | rollbackRollout 无状态机守卫——允许从任何状态 rollback 包括 draft/rolled_back                     |
| R14-20 | P2     | billing-routes.ts:36                       | webhook handler 在未版本化和 /v1/ 路由间完整 copy-paste；legacy 路由缺 Deprecation/Sunset header |
| R14-21 | P2     | prompt-release-orchestration-service.ts:82 | createRelease autoActivate 不检查 evaluationReport.gateDecision——eval gate "hold" 可被绕过       |
| R14-22 | P2     | authoritative-task-store-decorator.ts:5    | SharedArrayBuffer+decoratorMetrics 全局单例——并发操作跨 store 指标误导+Atomics.wait 阻塞线程     |

### §72 UI Feature 最终缺口 + Contract 缺失

| #      | 严重度 | 文件/位置                                   | 问题                                                                                          |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R14-23 | P0     | ui/packages/features/alerts/                | 无优先级排序——§4.7 要求优先级排序队列                                                         |
| R14-24 | P0     | ui/packages/features/alerts/                | 无 dismiss action——§4.7 要求 acknowledge/dismiss/escalate 三核心动作                          |
| R14-25 | P0     | ui/packages/features/governance-compliance/ | 缺审计轨迹查看器——§4.8 要求独立审计轨迹面板                                                   |
| R14-26 | P1     | ui/packages/features/alerts/                | 无 severity/domain/time 过滤(§4.7)                                                            |
| R14-27 | P1     | ui/packages/features/alerts/                | 无 WS 实时更新——用 polling(§4.7 要求 WS 推送)                                                 |
| R14-28 | P1     | ui/packages/features/governance-compliance/ | 缺 exception management 面板(§4.8)                                                            |
| R14-29 | P1     | ui/packages/features/domain-wizard/         | 无多步向导流程——渲染扁平 panel 列表(§4.3 要求 stepper+step navigation)                        |
| R14-30 | P1     | ui/packages/features/domain-wizard/         | hooks 无 risk profile/capability configuration 字段(§4.3)                                     |
| R14-31 | P1     | docs_zh/contracts/                          | 缺 ring-model contract——release contract 无 ring-based 渐进部署+ring promotion criteria(§33)  |
| R14-32 | P1     | docs_zh/contracts/                          | 缺 CI/CD pipeline contract——无 build/test/package/publish/artifact promotion(§13 pre-release) |
| R14-33 | P2     | response-hardening.ts                       | CORS wildcard+credentials(重复确认为安全反模式)                                               |
| R14-34 | P2     | src/platform/interface/api/                 | 缺 Content-Type validation middleware(§6.2 input sanitization)                                |


### §74 SDK/Plugin/Domain Registry 深层缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                                                  |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R15-01 | P0     | src/sdk/client-sdk/api-client.ts:208-214       | SDK 重试所有非 OK 响应包括 POST/PUT/DELETE——§22 要求幂等感知，重试非幂等写操作导致重复副作用                                          |
| R15-02 | P0     | src/sdk/client-sdk/api-client.ts               | §22.2 要求 X-Platform-Version/X-SDK-Version/X-Contract-Version header+版本握手——所有 SDK 均无发送                                     |
| R15-03 | P0     | src/sdk/client-sdk/api-client.ts               | SDK contract §5 要求区分 network/auth/business 错误类型——实现抛原始 Error 无类型鉴别                                                  |
| R15-04 | P1     | src/sdk/ (全部)                                | SdkReleaseDescriptor(sdk_semver/platform_min/max_version/deprecation_policy)代码不存在                                                |
| R15-05 | P1     | src/sdk/plugin-sdk/plugin-definition.ts:9      | PluginType="tool\|adapter\|retriever\|evaluator" vs PluginSpiType="retriever\|validator\|planner\|presenter\|adapter"——类型系统不兼容 |
| R15-06 | P1     | src/sdk/plugin-sdk/plugin-test-harness.ts:196  | executePlugin() 硬编码 mock——§22.3 要求 MockModelGateway+record/replay 无实际执行                                                     |
| R15-07 | P1     | src/sdk/pack-sdk/ + plugin-sdk/                | §22.3 要求 fixture auto-redact secrets/hash PII——无任何脱敏逻辑                                                                       |
| R15-08 | P1     | plugin-spi-registry.ts vs contract §4          | 生命周期状态不匹配：contract 有 suspended/loading/initialized 代码有 degraded/disabled——互不兼容                                      |
| R15-09 | P1     | src/domains/registry/plugin-spi.ts             | Contract 定义 suspend() 方法——PluginLifecycleHooks 无 suspend() 实现                                                                  |
| R15-10 | P1     | domain-registry-service.ts:106                 | deprecate() 从任何状态转换——§37.10 仅允许 Active→Deprecated                                                                           |
| R15-11 | P1     | src/domains/domain-specs.ts vs domain-model.ts | §37.2 v4.3 拆分为7个独立 Descriptor——DomainDefinitionSchema 仍为 monolithic 旧结构                                                    |
| R15-12 | P1     | domain-registry-service.ts                     | 无 Updating 状态(§37.10 Active→Updating→Active)；无 update 方法                                                                       |
| R15-13 | P2     | builtin-plugin-registry.ts                     | basic-evaluator 注册名含 "evaluator" 但 spiType="validator"——命名混淆                                                                 |
| R15-14 | P2     | src/sdk/plugin-sdk/plugin-context.ts           | PluginContext.set() 允许覆写 "system.\*" key——无命名空间隔离违反沙箱                                                                  |
| R15-15 | P2     | pack-lifecycle-orchestration-service.ts:297    | supportWindowDays≥180 但 §22.4 规定≥90天——过严阻塞合法弃用                                                                            |
| R15-16 | P2     | domain-smoke-test.ts                           | 不验证 executionProfile——§37.2 要求 lint 检查 risk/HITL/tool/eval/SLO 覆盖                                                            |
| R15-17 | P2     | domain-registry-service.ts                     | 无 Archived 状态(§37.10 Deprecated→Archived)；无 archive() 方法                                                                       |
| R15-18 | P2     | src/sdk/harness-sdk/index.ts                   | Harness SDK 无 auth/tenant/budget 检查即暴露 createRun                                                                                |

### §75 Ops-Maturity 深层缺陷（Explainability/Drift/Debugger/Edge/Compliance）

| #      | 严重度 | 文件/位置                                           | 问题                                                                                                          |
| ------ | ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| R15-19 | P0     | explanation-pipeline-service.ts:23-32               | StageRationale 缺 rationaleId/alternatives/confidence/decisionInputRef/versionLockRef/visibilityLabels(§59.3) |
| R15-20 | P0     | explanation-pipeline-service.ts:56                  | 无 versionLockRef 强制——历史解释可被静默改写(§59.6)                                                           |
| R15-21 | P0     | time-travel-debug-service.ts:91-280                 | 无 ReplaySandboxPolicy——replay 直接重放原始事件无隔离，可触发真实副作用(§65.3)                                |
| R15-22 | P0     | compliance-reporter/template-registry/index.ts:3-10 | Template 缺 lockedOnGeneration/reportVersionLock/legal_version/effective_date/migration_rule(§66.1)           |
| R15-23 | P0     | edge-runtime-sync-service.ts:58-75                  | 无 risk_level≤medium 检查——任何任务可离线执行(§62.2)                                                          |
| R15-24 | P1     | explanation-pipeline-service.ts:56-92               | 不区分 recorded facts/model rationale/inferred summary——全部扁平文本(§59.1)                                   |
| R15-25 | P1     | explanation-pipeline-service.ts:53                  | 无解释审计轨迹——谁何时查看了什么解释(§59.6)                                                                   |
| R15-26 | P1     | explanation-pipeline-service.ts:56                  | 无 forensic_explanation_budget 预留即生成 L3(§59.6)                                                           |
| R15-27 | P1     | fingerprint-builder/index.ts:3-17                   | BehaviorFingerprintInput 缺 avg_step_count(§63.1)                                                             |
| R15-28 | P1     | cross-agent-analyzer/index.ts:15-37                 | 无 CrossAgentDriftAlert 发射——仅返回 score(§63.4)                                                             |
| R15-29 | P1     | cross-agent-analyzer/index.ts                       | 无 anti-gaming——不区分真实/合成/keepalive 任务(§63.4)                                                         |
| R15-30 | P1     | time-travel-debug-service.ts:105                    | 无 auth/权限检查——§65.3 要求双因子+最小权限+短寿命会话+审计                                                   |
| R15-31 | P1     | workflow-debugger-service.ts:86-100                 | Run comparison 仅 diff step status——缺 decision/cost/duration/outcome diff(§65.4)                             |
| R15-32 | P1     | workflow-debugger-service.ts:86-100                 | 无 regression_detected 自动标记(§65.4)                                                                        |
| R15-33 | P1     | workflow-debugger/                                  | 无 WS 实时 debug stream /ws/v1/debug/{workflow_id}(§65.2)                                                     |
| R15-34 | P1     | workflow-debugger-service.ts:5-11                   | DebugBreakpointDefinition 缺 replay-condition 类型(§65.3)                                                     |
| R15-35 | P1     | evidence-mapper/index.ts                            | 无 control-point mapping(pass/fail/partial/not_applicable)——仅按类型分组(§66.2)                               |
| R15-36 | P1     | compliance-report-pipeline-service.ts:85            | evidenceQualityScore 仅覆盖率——缺 freshness/trustworthiness/tamper-proof(§66.2)                               |
| R15-37 | P1     | compliance-report-pipeline-service.ts:111-136       | HumanSignoff 缺 escalation_owner/timeout_action(§66.2)                                                        |
| R15-38 | P1     | edge-runtime-sync-service.ts                        | 无 offline_max_duration 强制——maxLocalRetentionHours 声明后无检查(§62.2)                                      |
| R15-39 | P1     | edge-runtime-sync-service.ts                        | 无 key-lease/device-attestation/certificate-revocation(§62.2)                                                 |
| R15-40 | P1     | sync-queue/index.ts                                 | SyncQueue 缺 sequence_no/side_effect_dependency_refs——§62.3 要求签名 append-only+拓扑排序                     |
| R15-41 | P1     | edge-runtime/                                       | 无 remote_wipe/edge_quarantine 指令处理(§62.3)                                                                |
| R15-42 | P2     | changepoint-detector/index.ts:26-31                 | 阈值硬编码无 sample-size/分布假设/误报处理声明(§63.2)                                                         |
| R15-43 | P2     | workflow-debugger/                                  | 无 side-effect diff(expected vs actual)(§65.1)                                                                |
| R15-44 | P2     | compliance-reporter/                                | 无 GapAnalyzer+remediation owner 分配(§66.2)                                                                  |
| R15-45 | P2     | compliance-reporter/                                | 无按框架频率调度(SOC2 quarterly/HIPAA monthly)(§66.3)                                                         |
| R15-46 | P2     | compliance-reporter/                                | 无 AuditorAccess PII auto-redaction+per-framework 最小权限(§66.4)                                             |
| R15-47 | P2     | edge-runtime/                                       | 部署模式分类(Edge-Micro/Standard/Mobile/Hybrid)§62.4 未建模                                                   |
| R15-48 | P2     | chaos-experiment-scheduler.ts:10-11                 | 引用 "§68/§66" 但均不对应 chaos——模块无架构锚点                                                               |

### §76 Scale-Ecosystem 深层缺陷（Multi-region/Tenant/Marketplace/SLA）

| #      | 严重度 | 文件/位置                                 | 问题                                                                                                                                                        |
| ------ | ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R15-49 | P0     | failover-controller/index.ts:1-46         | Failover 无 fencing epoch——§52.3 要求 promote epoch+旧 leader 降级；实现为无状态函数                                                                        |
| R15-50 | P0     | multi-region/ (全部)                      | 无 FailoverReconciliationJob——§52.3+§31 要求列出未复制写/开放预算/待审批/outbox gap+restricted-write                                                        |
| R15-51 | P0     | cross-region-routing-service.ts:44-95     | 路由不区分读写——§52.3 要求 truth write 仅在 partition leader；读写统一路由                                                                                  |
| R15-52 | P1     | region-router/index.ts:3-11               | RegionDescriptor 缺 provider/endpoints/dataResidencyPolicy(§52.1)                                                                                           |
| R15-53 | P1     | multi-region/ (全部)                      | 无跨境传输合规链——§52.4 Jurisdiction Classifier→Transfer Impact Assessor→Mechanism Selector(SCC/BCR/DPF)→Data Minimizer→Output Scanner→Transfer Logger 全缺 |
| R15-54 | P1     | data-replicator/index.ts:163-189          | recordEvent() 不检查 shouldReplicateToRegion() 对 residency policy——数据可能复制到禁止区域                                                                  |
| R15-55 | P1     | region-health-check-service.ts:283-315    | performHealthCheck 用字符串长度模拟延迟——非真实网络探测，failover 决策不可靠                                                                                |
| R15-56 | P1     | data-replicator/index.ts:240-247          | pendingCount=events.length(总批次)非实际 pending——复制 lag 指标错误                                                                                         |
| R15-57 | P1     | tenant-platform-service.ts:367-397        | createTenant() 接受 isolationMode 但无实际执行——dedicated_pool 租户无真实隔离(§9.8)                                                                         |
| R15-58 | P1     | quota-enforcer/index.ts:3-12              | Quota 为单资源模型——§53.2 要求 MultiResourceQuotaVector(worker/QPS/TPM/budget/storage 同时)                                                                 |
| R15-59 | P1     | preemption/index.ts:7-13                  | 抢占无 checkpoint-before-preempt——§53.4 要求先完成 checkpoint 再抢占                                                                                        |
| R15-60 | P1     | fair-queue/index.ts:11-22                 | 按 orgId/domainId 字典序排序非 WFQ——§53.4 要求加权公平队列+保证配额+借用+回收                                                                               |
| R15-61 | P1     | marketplace/catalog/index.ts:3-33         | CatalogEntry 用 listingId 非 entryId+packId(§55.2)；缺 installCount/rating/certificationStatus                                                              |
| R15-62 | P1     | marketplace/ (全部)                       | 无 SBOM/provenance/PluginTrustStore——§55.1+§11 要求签名验证+信任根+撤销列表+隔离                                                                            |
| R15-63 | P1     | marketplace-governance-service.ts:614-662 | 弃用跳过 sunset 状态——§55.5 要求 active→deprecated→sunset→removed 含30天倒计时                                                                              |
| R15-64 | P1     | marketplace/ (全部)                       | 无反向依赖检查——§55.6 要求 uninstall/deprecation 检查依赖图并阻止                                                                                           |
| R15-65 | P1     | sla-engine/tier-resolver/index.ts:3-12    | SLA tier 缺 availability/approvalLatencySlo/incidentResponseSlo/costMultiplier/supportLevel(§54.1)                                                          |
| R15-66 | P2     | cdc-replication-service.ts:97-289         | CDC 无时间 lag 监控(§52 ≤30s SLA)——getReplicationLag() 返回事件数非时间                                                                                     |
| R15-67 | P2     | region-health-check-service.ts:418-445    | orchestrateFailover() fire-and-forget 无 FailoverRecord/FencingEpochChanged event(§31)                                                                      |
| R15-68 | P2     | fair-scheduling-service.ts:44-68          | 无 promotion_budget 强制——§53.4 要求每租户每小时/天升级预算                                                                                                 |
| R15-69 | P2     | resource-pool-service.ts:21-77            | ResourcePool 无 tenant/org scope——§9.8 要求 failure_rate>30% 自动隔离                                                                                       |
| R15-70 | P2     | certification/index.ts:3-14               | 认证仅 pending/approved/revoked——缺 SBOM scan/sandbox cert/egress review(§55.1)                                                                             |
| R15-71 | P2     | marketplace-governance-service.ts:482-579 | publishPackage() 不检查 SBOM/sandbox cert/egress policy(§55.1 Quality & Security Gate)                                                                      |
| R15-72 | P2     | sla-operations-service.ts:58-128          | 无 SLA-aware 延迟预测/自动扩缩——§54.3 要求预判+自动 scaling/preemption                                                                                      |

### §77 Config/Channel Gateway/Bootstrap/Org-Governance 深层缺陷

| #      | 严重度 | 文件/位置                             | 问题                                                                                                                    |
| ------ | ------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R15-73 | P0     | config-rollout-service.ts:134         | startRollout() 对 target=100 找到 FULL stage 直接跳过 canary——§24.3 canary pipeline 完全失效                            |
| R15-74 | P0     | config-center/                        | ConfigImpactAnalyzer(§24.4 pre-publish 影响分析门)完全缺失——无文件/类型/引用                                            |
| R15-75 | P0     | config-center/                        | §24.1 四种 config 生命周期类型(admission_locked/checkpoint_revalidated/hot_reloadable/emergency_override)无实现无类型   |
| R15-76 | P1     | config-rollout-service.ts             | Rollout 无健康门(max_error_rate/max_latency_regression/max_incident_rate)——纯按时间推进(§24.3)                          |
| R15-77 | P1     | config-drift-reconciler.ts            | Drift reconciler 不发 config.drift_detected incident——无 EventBus 依赖，纯被动报告(§24.2)                               |
| R15-78 | P1     | config-versioning-service.ts:115      | 版本快照存内存 Map——重启丢失全部版本历史(§24.2 "保留完整历史")                                                          |
| R15-79 | P1     | config-rollout-service.ts:105         | 活跃 rollout 存内存 Map——重启后 canary@25% 静默变为 fully-applied                                                       |
| R15-80 | P1     | websocket-bridge.ts                   | WS 无 message ack/delivery guarantee/sequence number——与 SSE StreamBridge(有 sequence+replay)不对称(§6.7 at-least-once) |
| R15-81 | P1     | websocket-bridge.ts:99                | JWT 作为 URL query ?token=——暴露于 access log/proxy log/Referer header(§11 安全)                                        |
| R15-82 | P1     | org-governance-saga.ts:17-39          | execute() 仅分类 steps 并返回——无 prepare/commit/compensate 执行(已知 stub 但无法接线)                                  |
| R15-83 | P1     | config/runtime/default.json           | 缺 circuit_breaker/retry_max/rate_limit 默认值——§24.1 要求平台级默认                                                    |
| R15-84 | P2     | config-store.ts:116                   | Change listener 用 !== 引用比较——deep-equal 对象变更不触发(事件契约违反)                                                |
| R15-85 | P2     | hierarchical-config-loader.ts:243-251 | 版本 hash 用 djb2(32-bit 高碰撞) vs config-versioning-service 用 SHA-256——两套不一致                                    |
| R15-86 | P2     | src/index.ts:178-243                  | buildPlatformRootSummary() 顺序调用无 error boundary——单 plan 失败 crash 整体(§9 稳定性)                                |
| R15-87 | P2     | tests/e2e/                            | 无 config-rollout/config-drift/config-governance e2e 测试                                                               |
| R15-88 | P2     | config/gateways/default.json          | 无 WS 配置(max connections/heartbeat/message size)——WS bridge 已实现但无配置(§8)                                        |


### §79 Model Gateway 深层缺陷

| #      | 严重度 | 文件/位置                                              | 问题                                                                                                                                           |
| ------ | ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| R16-01 | P0     | circuit-breaker.ts:277                                 | getRecentFailureRate() 计算 (failures/windowSeconds)\*10 非真实失败率(failures/total)——无 total request 计数，§15.4 失败率阈值永远无法正确触发 |
| R16-02 | P0     | degradation-controller.ts:357-359                      | getFallbackCandidates() 始终返回[]——D1 fallback 路径为死代码，任何 D0 失败直接递归升级                                                         |
| R16-03 | P0     | llm-eval-service.ts:356-358                            | runAbTest 使用硬编码假分数(control=0.85/treatment=0.90)——A/B 测试结果完全伪造                                                                  |
| R16-04 | P0     | rollout/index.ts:7                                     | PromptRolloutStatus="draft\|ready\|active\|blocked\|rolled_back" 完全偏离 §16.1 lifecycle(draft→review→staging→canary→stable→deprecated)       |
| R16-05 | P1     | circuit-breaker.ts:270-278                             | 监控窗口仅存 failure timestamps 无 total requests——无法计算真实 failure rate                                                                   |
| R16-06 | P1     | unified-chat-provider.ts:297-336                       | createStreamingChatCompletion 无 circuit breaker 保护——streaming 绕过容错                                                                      |
| R16-07 | P1     | unified-chat-provider.ts:40-55                         | ChatCompletionResult 缺 requestId/estimatedCost/latencyMs(§15.2)                                                                               |
| R16-08 | P1     | unified-chat-provider.ts:57-67                         | ChatCompletionRequest 缺 timeout 参数(§15.2)                                                                                                   |
| R16-09 | P1     | model-routing-service.ts:54-77                         | ModelRouteRequest 缺 data_residency/pii_input_detected/model_training_opt_out(§15.3)                                                           |
| R16-10 | P1     | degradation-controller.ts:209-241                      | routeD0 递归升级无重试计数限制——D2/D3 也失败时可 stack overflow                                                                                |
| R16-11 | P1     | budget-guard.ts:12-18                                  | BudgetPolicy 仅有 USD 上限——§18.3 要求 max_model_tokens/max_steps/max_duration_ms 独立限制                                                     |
| R16-12 | P1     | prompt-rollout-stage.ts:1-12                           | PROMPT_ROLLOUT_STAGES(shadow/canary_5/partial_25...) 与 PromptRolloutStatus 类型系统不一致                                                     |
| R16-13 | P1     | rollout/index.ts:65-76                                 | activateRollout 仅允许 ready→active——无 canary 流量分割阶段(§16.3)                                                                             |
| R16-14 | P1     | platform-prompt-release-orchestration-service.ts:53-99 | 无 domain_owner_approval/rollback_plan_present 发布门(§17.3)                                                                                   |
| R16-15 | P1     | hierarchical-registry-service.ts:238-270               | resolveBundleForTraffic hash % 100 无 RunVersionLock——同一 run 可能用不同 PromptBundle                                                         |
| R16-16 | P1     | llm-eval-service.ts:307-311                            | completeRun 使用 80% pass 判定 degraded——§17.3 要求 ≥95% + critical 100%                                                                       |
| R16-17 | P1     | llm-eval-service.ts:348-378                            | A/B test 无 judge independence(§17.5 要求不同 model/family/provider)                                                                           |
| R16-18 | P1     | execution-outcome-evaluator.ts:39-61                   | defaultPassThreshold=0.5 但 §17.3 要求 delta-based(quality_score_delta≥-0.05)——质量模型根本不同                                                |
| R16-19 | P1     | prompt-injection-guard.ts:306-314                      | blocked=true 时 hard deny——§16.5.2 禁止注入分类器单独作 production hard deny                                                                   |
| R16-20 | P2     | unified-chat-provider.ts:127-149                       | detectProviderFromModel 未知模型静默默认 "openai"——应 throw/warn                                                                               |
| R16-21 | P2     | unified-chat-provider.ts:289                           | recordLlmLatency TTFT=totalSeconds(未实际测量)——§15.6 TTFT>10s 触发永远不火                                                                    |
| R16-22 | P2     | degradation-controller.ts:97-103                       | escalateLatencyP99Ms=5000 但 §15.6 TTFT 阈值=10s——不区分 P99 与 TTFT                                                                           |
| R16-23 | P2     | deterministic-hot-path-gate.ts:26-33                   | allowed:true + routeMode:"deterministic_hot_path_only" 矛盾                                                                                    |
| R16-24 | P2     | fallback/index.ts:16-38                                | selectFallback 仅按 cost 排序——忽略 tier affinity(§15.4)                                                                                       |
| R16-25 | P2     | prompt-injection-guard.ts:317-330                      | 任何 URL 触发 blocked——raw_url_exfiltration 对含合法 URL 输出过度攻击                                                                          |

### §80 State-Evidence 平面深层缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                                                  |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R16-26 | P0     | transactional-event-appender.ts:97-121         | 使用原始 BEGIN/COMMIT/ROLLBACK 绕过 db.transaction()——并发调用可交错事务导致静默腐败(§25.3)                                           |
| R16-27 | P0     | durable-event-bus.ts:178-195                   | publish() 写 event+ack 但不共写 truth table——§25.2 要求 truth+event log 原子同事务                                                    |
| R16-28 | P0     | projection-rebuild-service.ts:217              | rebuildProjection() 对每个 event 传 null state——不累积状态，rebuild 产出空/单事件投影                                                 |
| R16-29 | P1     | event-registry.ts vs event-types.ts            | event-types.ts 定义 26 个 Tier-1 事件但 RAW_EVENT_SCHEMA_REGISTRY 不含——getEventSchema() 运行时 throw                                 |
| R16-30 | P1     | event-registry.ts:580-653 vs :63-371           | RUNTIME_EVENT_REPLAY_METADATA(platform.\*)与 RAW_EVENT_SCHEMA_REGISTRY(colon-delimited)命名不一致无互引——§28.2 EventEnvelope 字段缺失 |
| R16-31 | P1     | workflow-step-checkpoint.ts                    | Checkpoint 用 readFileSync 纯文件 IO——无原子写/WAL/fencing token；crash mid-write 腐败(§25.6 <20ms P99)                               |
| R16-32 | P1     | projection-rebuild-service.ts:244-253          | rebuildAll() 16个投影顺序扫描 offset 0——无 shadow-build→compare→cutover(§28.6)                                                        |
| R16-33 | P1     | semantic-knowledge-graph.ts:219-243            | collectAdjacent() BFS 每次 pop 遍历全部 edges——O(V×E) 不可用于千级 chunk 图(§29.1)                                                    |
| R16-34 | P1     | semantic-knowledge-graph.ts                    | §29.1 要求 Trust Level 层级(private_unverified→team_reviewed→official→authoritative)+contested 降级——图节点无 trust level             |
| R16-35 | P1     | cas/cas-service.ts:46                          | CAS 纯内存 Map——§25.3 要求 CAS+lease+fencing 用于所有 truth write；无持久化无跨进程保护                                               |
| R16-36 | P2     | durable-event-bus.ts:48                        | ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS=10(100次/秒/consumer)——不必要 CPU 烧耗                                                             |
| R16-37 | P2     | dlq-service.ts:112                             | DLQ 纯内存 Map——§28.8 要求持久 DLQ 含 first/last_failed_at+incident linking；重启丢失                                                 |
| R16-38 | P2     | memory-layer-model.ts:46-51                    | Promotion rules 跳过 runtime→session——working layer supportsPromotion=true 但无对应规则                                               |
| R16-39 | P2     | memory-layer-model.ts:549-554                  | working facts shouldEvict() 无 loss-report/escalation——§29.2 禁止静默丢弃                                                             |
| R16-40 | P2     | layered-event-inbox.ts vs durable-event-bus.ts | 两套独立 event inbox 无共享状态/consumer registry/统一 replay——双轨并行                                                               |
| R16-41 | P2     | semantic-knowledge-graph.ts:260-272            | addEdge() 无去重——重复 upsertRecord 产生重复 edge 膨胀结果                                                                            |

### §81 UI Shared 基础设施深层缺陷

| #      | 严重度 | 文件/位置                                    | 问题                                                                                                                 |
| ------ | ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R16-42 | P0     | sync/src/conflict-resolver.ts:15-26          | "merge" 策略为天真 shallow spread——无 CRDT/vector clock/版本比较(§5.4.5 要求 CRDT offline-first)                     |
| R16-43 | P0     | sync/src/types.ts:1-9                        | OfflineMutation 缺 idempotencyKey/retryCount/status(pending/syncing/conflict/failed)(§5.4.5)                         |
| R16-44 | P0     | sync/src/sync-coordinator.ts:33-38           | flush() 仅本地清空队列——无 HTTP replay/服务端提交/retry/conflict-detection(§5.4.5 recovery flow)                     |
| R16-45 | P0     | api-client/src/ws-client.ts:88               | WS token 作 URL query——泄漏于 server log/referrer/history(§5.3.3/§6.5)                                               |
| R16-46 | P0     | api-client/src/interceptors.ts:29-37         | createAuthInterceptor 接受静态 string token——无动态 TokenManager/auto-refresh/refresh-lock(§5.4.4)                   |
| R16-47 | P0     | apps/web/src/runtime.ts:39                   | Auth token 硬编码 "ui-runtime-access"——绕过整个 auth 流程                                                            |
| R16-48 | P0     | auth/src/auth-service.ts:36-40               | handleSsoCallback 从 URL query 读 access_token/refresh_token 明文——应用 authorization code flow(§5.4.4)              |
| R16-49 | P0     | apps/web/src/app-shell.tsx:8-22              | Route guard 使用硬编码 demoGuardContext+静态 permissions——无真实 RBAC 集成                                           |
| R16-50 | P1     | state/src/query-client.ts:7-9                | 全局 staleTime=30s/retry=1——§5.1.2 要求 per-type staleTime(tasks=2min/approvals=30s/config=1h)                       |
| R16-51 | P1     | state/src/stores/auth-store.ts:3-8           | AuthStore 仅 authenticated+locale——缺 user/token/permissions/tenantId/login/logout/refreshToken/switchTenant(§5.1.1) |
| R16-52 | P1     | state/src/stores/ui-store.ts:3-8             | UIStore 仅 activeRoute+activeFeature——缺 theme/sidebarCollapsed/nlPanelOpen/commandPaletteOpen(§5.1.1)               |
| R16-53 | P1     | state/src/stores/sync-store.ts:3-9           | SyncStore 缺 online/conflicts/syncStatus:"error"/resolveConflict/retrySync(§5.1.1)                                   |
| R16-54 | P1     | state/src/stores/realtime-store.ts:3-12      | RealtimeStore 缺 activeSubscriptions/pendingApprovalCount/activeIncidents/subscribe/unsubscribe(§5.1.1)              |
| R16-55 | P1     | telemetry/src/index.ts:78-92                 | OTLP exporter 格式错误——wraps 在 scopeMetrics[].logs 非 resourceLogs[].scopeLogs[]；collector 会拒绝                 |
| R16-56 | P1     | telemetry/src/index.ts:27-30                 | TelemetrySink.record() 逐事件 HTTP POST——无 batching/flush interval/buffer(§7.3)                                     |
| R16-57 | P1     | telemetry/src/index.ts                       | 无 analytics consent 检查——record() 不调用 PlatformAdapter.getAnalyticsConsent()(§6.5.5+GDPR)                        |
| R16-58 | P1     | api-client/src/interceptors.ts               | 缺 RetryInterceptor(exponential backoff+jitter)和 DedupeInterceptor(§5.4)                                            |
| R16-59 | P1     | api-client/src/interceptors.ts:62-76         | OfflineQueueInterceptor enqueue 后仍发请求失败——应 short-circuit 返回合成响应                                        |
| R16-60 | P1     | api-client/src/rest-client.ts                | 无 Accept-Version:v1 header——§1.8 要求版本头+406 mismatch 处理                                                       |
| R16-61 | P1     | api-client/src/ws-event-router.ts            | 无 heartbeat(§5.3.2.1 30s ping/45s pong timeout)；无 SharedWorker 多路复用(§5.3.4)                                   |
| R16-62 | P1     | api-client/src/endpoints.ts                  | 所有 list endpoint 返回扁平数组——无 cursor pagination/useInfiniteQuery(§5.4.6)                                       |
| R16-63 | P1     | state/src/queries/                           | 无 persistQueryClient——§5.1.4 要求 cache 持久化到 IndexedDB/SQLite 离线支持                                          |
| R16-64 | P1     | platform/src/web-platform-adapter.ts         | 无 notification/biometric/WebAuthn 能力(§2.6.2/§2.5.7)                                                               |
| R16-65 | P1     | apps/web/src/runtime.ts:40                   | tenantId 硬编码 "tenant-default"——非从 auth context 获取；多租户路由失效                                             |
| R16-66 | P1     | apps/web/src/app-shell.tsx                   | 无 ErrorBoundary——§5.6 要求 per-severity 降级(fallback UI/retry/report)                                              |
| R16-67 | P1     | apps/web/src/app-shell.tsx                   | 无 PlatformAdapterProvider——§3.7.4 要求 adapter 通过 Provider 注入                                                   |
| R16-68 | P2     | apps/web/src/feature-registry.ts:1-57        | 27个 feature 模块 eager import——无 React.lazy()/dynamic import(§4.4.1 per-route code split)                          |
| R16-69 | P2     | sync/src/offline-queue.ts:19-22              | enqueue() 无容量上限——§5.5 离线存储需有界队列                                                                        |
| R16-70 | P2     | telemetry/src/index.ts                       | 无 Web Vitals(FCP/LCP/CLS/INP)采集(§7.3 G-3)                                                                         |
| R16-71 | P2     | api-client/src/rest-client.ts:177-178        | HTTP error 抛泛型 Error——无 §5.6.6 status→UI 行为映射(401→redirect/403→denied/429→backoff)                           |
| R16-72 | P2     | apps/web/src/runtime.ts:51-55                | registerWebServiceWorker 引用 aa-sw.js 但文件不存在——L1 静态缓存不工作(§5.5.1)                                       |
| R16-73 | P2     | features/settings/src/hooks/index.ts:105-107 | save() 同步 setState 无 API 调用/ETag(§4.7.8 要求 If-Match)                                                          |
| R16-74 | P2     | apps/web/src/runtime.ts                      | 启动无 contract version check——§1.8 要求 /api/v1/meta/contract-version+mismatch banner                               |

### §82 ADR/Contract 系统性一致性缺陷

| #      | 严重度 | 文件/位置                                                         | 问题                                                                                                                    |
| ------ | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R16-75 | P0     | adr/060-explicit-planning-hub.md                                  | 已解决：ADR-060 已把 `PlanGraphBundle` 定为唯一 P3→P4 handoff，旧 `Plan DTO` 不再作为 active canonical contract              |
| R16-76 | P0     | adr/060:59 + runtime-execute-bridge.ts:199                        | RuntimeExecuteBridge.executePlan() 仍接受旧 Plan 类型非 PlanGraphBundle——代码实际走废弃路径                             |
| R16-77 | P0     | src/platform/contracts/execution-plan/index.ts                    | ExecutionPlan 仍导出+有 createExecutionPlan() 工厂——ADR-109 已明确禁止                                                  |
| R16-78 | P0     | src/platform/contracts/control-directive/index.ts                 | ControlDirective 仍导出+有工厂——ADR-109 已禁止                                                                          |
| R16-79 | P0     | src/platform/contracts/state-command/index.ts                     | StateCommand 仍导出+有工厂——ADR-109 已禁止                                                                              |
| R16-80 | P1     | contracts/artifact_unified_model_contract.md:22                   | OAPEFLIR stages 列 "Rollout" 非 "Release"(ADR-091 已改名)                                                               |
| R16-81 | P1     | contracts/context_compaction_and_overflow_contract.md:139         | OAPEFLIR stage 表用 "Rollout"+RolloutRecord(应为 Release)                                                               |
| R16-82 | P1     | contracts/release_rollout_and_rollback_contract.md:8              | 已解决：release contract 标题与正文都已回写为 `Release` 阶段语义，`Rollout` 仅保留为受控发布机制                           |
| R16-83 | P1     | 40+ contracts                                                     | 锅炉板 OAPEFLIR 块用 "改进候选评估与 rollout"——大规模术语过时                                                           |
| R16-84 | P1     | adr/093 vs harness/index.ts:57-77                                 | ConstraintPack 缺 sandbox_requirement/approval_requirement/budget_envelope(ADR-093 要求)                                |
| R16-85 | P1     | contracts/task-intake-request-contract.md:56                      | 已解决：`ConstraintPackRef` 已冻结为 `constraint_pack:${id}` 字符串引用类型                                               |
| R16-86 | P1     | architecture/05-cross-platform-ui-architecture.md:7               | UI 架构基线为 00-platform-architecture v3.2——当前已 v4.3，UI arch 未 re-baseline                                        |
| R16-87 | P1     | adr/063 + contracts/behavior_drift_detection_contract.md          | ADR 定义4种 drift type+统计检测——代码仅有 golden-test regression；DriftDetector/DriftAlert/DriftMitigationAction 不存在 |
| R16-88 | P1     | contracts/event_bus_contract.md:84 + event-envelope-contract.md:7 | 已解决：truth release 事件已统一为 `platform.release.*`，裸 `release.*` 仅保留为历史/adapter 输入                         |
| R16-89 | P1     | event-registry.ts:73-109                                          | Event producers 注册为 workflow_runtime 非 platform.\* namespace——不遵循 canonical 命名                                 |
| R16-90 | P1     | adr/060:108                                                       | 已解决：ADR-060 已移除 `src/core/planning/` 旧路径引用，并明确落点为 `src/platform/orchestration/`                        |
| R16-91 | P1     | architecture §19                                                  | 已解决：已新增 `docs_zh/contracts/agent_handoff_contract.md` 作为 handoff/delegation 专属 contract                         |
| R16-92 | P1     | architecture §68                                                  | Multimodal video pipeline 无 contract(multimodal_gateway_contract.md 缺 video scene/keyframe/transcript)                |
| R16-93 | P1     | src/platform/contracts/types/platform-contracts.ts:70             | ExecutionPlan 完整接口(budget/steps/fallback) 与 PlanGraphBundle 并行——同包两套竞争类型                                 |
| R16-94 | P2     | adr/072-oapeflir-testing-strategy.md:18                           | 已解决：ADR-072 已把现存测试根收敛为 `tests/unit|integration|golden|e2e|invariants`，不存在目录不再被当成既有事实       |
| R16-95 | P2     | adr/003-memory-seven-layers.md                                    | 文件名 "seven-layers" 但内容/标题为 "六层"——ADR-007 交叉引用为 "六层" 链接到此文件                                      |
| R16-96 | P2     | architecture §62                                                  | Edge runtime contract 不引用 RunVersionLock——离线节点无版本锁冻结语义                                                   |
### §79 Model Gateway 深层缺陷

| #      | 严重度 | 文件/位置                                              | 问题                                                                                                                                           |
| ------ | ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| R16-01 | P0     | circuit-breaker.ts:277                                 | getRecentFailureRate() 计算 (failures/windowSeconds)\*10 非真实失败率(failures/total)——无 total request 计数，§15.4 失败率阈值永远无法正确触发 |
| R16-02 | P0     | degradation-controller.ts:357-359                      | getFallbackCandidates() 始终返回[]——D1 fallback 路径为死代码，任何 D0 失败直接递归升级                                                         |
| R16-03 | P0     | llm-eval-service.ts:356-358                            | runAbTest 使用硬编码假分数(control=0.85/treatment=0.90)——A/B 测试结果完全伪造                                                                  |
| R16-04 | P0     | rollout/index.ts:7                                     | PromptRolloutStatus="draft\|ready\|active\|blocked\|rolled_back" 完全偏离 §16.1 lifecycle(draft→review→staging→canary→stable→deprecated)       |
| R16-05 | P1     | circuit-breaker.ts:270-278                             | 监控窗口仅存 failure timestamps 无 total requests——无法计算真实 failure rate                                                                   |
| R16-06 | P1     | unified-chat-provider.ts:297-336                       | createStreamingChatCompletion 无 circuit breaker 保护——streaming 绕过容错                                                                      |
| R16-07 | P1     | unified-chat-provider.ts:40-55                         | ChatCompletionResult 缺 requestId/estimatedCost/latencyMs(§15.2)                                                                               |
| R16-08 | P1     | unified-chat-provider.ts:57-67                         | ChatCompletionRequest 缺 timeout 参数(§15.2)                                                                                                   |
| R16-09 | P1     | model-routing-service.ts:54-77                         | ModelRouteRequest 缺 data_residency/pii_input_detected/model_training_opt_out(§15.3)                                                           |
| R16-10 | P1     | degradation-controller.ts:209-241                      | routeD0 递归升级无重试计数限制——D2/D3 也失败时可 stack overflow                                                                                |
| R16-11 | P1     | budget-guard.ts:12-18                                  | BudgetPolicy 仅有 USD 上限——§18.3 要求 max_model_tokens/max_steps/max_duration_ms 独立限制                                                     |
| R16-12 | P1     | prompt-rollout-stage.ts:1-12                           | PROMPT_ROLLOUT_STAGES(shadow/canary_5/partial_25...) 与 PromptRolloutStatus 类型系统不一致                                                     |
| R16-13 | P1     | rollout/index.ts:65-76                                 | activateRollout 仅允许 ready→active——无 canary 流量分割阶段(§16.3)                                                                             |
| R16-14 | P1     | platform-prompt-release-orchestration-service.ts:53-99 | 无 domain_owner_approval/rollback_plan_present 发布门(§17.3)                                                                                   |
| R16-15 | P1     | hierarchical-registry-service.ts:238-270               | resolveBundleForTraffic hash % 100 无 RunVersionLock——同一 run 可能用不同 PromptBundle                                                         |
| R16-16 | P1     | llm-eval-service.ts:307-311                            | completeRun 使用 80% pass 判定 degraded——§17.3 要求 ≥95% + critical 100%                                                                       |
| R16-17 | P1     | llm-eval-service.ts:348-378                            | A/B test 无 judge independence(§17.5 要求不同 model/family/provider)                                                                           |
| R16-18 | P1     | execution-outcome-evaluator.ts:39-61                   | defaultPassThreshold=0.5 但 §17.3 要求 delta-based(quality_score_delta≥-0.05)——质量模型根本不同                                                |
| R16-19 | P1     | prompt-injection-guard.ts:306-314                      | blocked=true 时 hard deny——§16.5.2 禁止注入分类器单独作 production hard deny                                                                   |
| R16-20 | P2     | unified-chat-provider.ts:127-149                       | detectProviderFromModel 未知模型静默默认 "openai"——应 throw/warn                                                                               |
| R16-21 | P2     | unified-chat-provider.ts:289                           | recordLlmLatency TTFT=totalSeconds(未实际测量)——§15.6 TTFT>10s 触发永远不火                                                                    |
| R16-22 | P2     | degradation-controller.ts:97-103                       | escalateLatencyP99Ms=5000 但 §15.6 TTFT 阈值=10s——不区分 P99 与 TTFT                                                                           |
| R16-23 | P2     | deterministic-hot-path-gate.ts:26-33                   | allowed:true + routeMode:"deterministic_hot_path_only" 矛盾                                                                                    |
| R16-24 | P2     | fallback/index.ts:16-38                                | selectFallback 仅按 cost 排序——忽略 tier affinity(§15.4)                                                                                       |
| R16-25 | P2     | prompt-injection-guard.ts:317-330                      | 任何 URL 触发 blocked——raw_url_exfiltration 对含合法 URL 输出过度攻击                                                                          |

### §80 State-Evidence 平面深层缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                                                  |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R16-26 | P0     | transactional-event-appender.ts:97-121         | 使用原始 BEGIN/COMMIT/ROLLBACK 绕过 db.transaction()——并发调用可交错事务导致静默腐败(§25.3)                                           |
| R16-27 | P0     | durable-event-bus.ts:178-195                   | publish() 写 event+ack 但不共写 truth table——§25.2 要求 truth+event log 原子同事务                                                    |
| R16-28 | P0     | projection-rebuild-service.ts:217              | rebuildProjection() 对每个 event 传 null state——不累积状态，rebuild 产出空/单事件投影                                                 |
| R16-29 | P1     | event-registry.ts vs event-types.ts            | event-types.ts 定义 26 个 Tier-1 事件但 RAW_EVENT_SCHEMA_REGISTRY 不含——getEventSchema() 运行时 throw                                 |
| R16-30 | P1     | event-registry.ts:580-653 vs :63-371           | RUNTIME_EVENT_REPLAY_METADATA(platform.\*)与 RAW_EVENT_SCHEMA_REGISTRY(colon-delimited)命名不一致无互引——§28.2 EventEnvelope 字段缺失 |
| R16-31 | P1     | workflow-step-checkpoint.ts                    | Checkpoint 用 readFileSync 纯文件 IO——无原子写/WAL/fencing token；crash mid-write 腐败(§25.6 <20ms P99)                               |
| R16-32 | P1     | projection-rebuild-service.ts:244-253          | rebuildAll() 16个投影顺序扫描 offset 0——无 shadow-build→compare→cutover(§28.6)                                                        |
| R16-33 | P1     | semantic-knowledge-graph.ts:219-243            | collectAdjacent() BFS 每次 pop 遍历全部 edges——O(V×E) 不可用于千级 chunk 图(§29.1)                                                    |
| R16-34 | P1     | semantic-knowledge-graph.ts                    | §29.1 要求 Trust Level 层级(private_unverified→team_reviewed→official→authoritative)+contested 降级——图节点无 trust level             |
| R16-35 | P1     | cas/cas-service.ts:46                          | CAS 纯内存 Map——§25.3 要求 CAS+lease+fencing 用于所有 truth write；无持久化无跨进程保护                                               |
| R16-36 | P2     | durable-event-bus.ts:48                        | ACTIVE_SUBSCRIBER_POLL_INTERVAL_MS=10(100次/秒/consumer)——不必要 CPU 烧耗                                                             |
| R16-37 | P2     | dlq-service.ts:112                             | DLQ 纯内存 Map——§28.8 要求持久 DLQ 含 first/last_failed_at+incident linking；重启丢失                                                 |
| R16-38 | P2     | memory-layer-model.ts:46-51                    | Promotion rules 跳过 runtime→session——working layer supportsPromotion=true 但无对应规则                                               |
| R16-39 | P2     | memory-layer-model.ts:549-554                  | working facts shouldEvict() 无 loss-report/escalation——§29.2 禁止静默丢弃                                                             |
| R16-40 | P2     | layered-event-inbox.ts vs durable-event-bus.ts | 两套独立 event inbox 无共享状态/consumer registry/统一 replay——双轨并行                                                               |
| R16-41 | P2     | semantic-knowledge-graph.ts:260-272            | addEdge() 无去重——重复 upsertRecord 产生重复 edge 膨胀结果                                                                            |

### §81 UI Shared 基础设施深层缺陷

| #      | 严重度 | 文件/位置                                    | 问题                                                                                                                 |
| ------ | ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R16-42 | P0     | sync/src/conflict-resolver.ts:15-26          | "merge" 策略为天真 shallow spread——无 CRDT/vector clock/版本比较(§5.4.5 要求 CRDT offline-first)                     |
| R16-43 | P0     | sync/src/types.ts:1-9                        | OfflineMutation 缺 idempotencyKey/retryCount/status(pending/syncing/conflict/failed)(§5.4.5)                         |
| R16-44 | P0     | sync/src/sync-coordinator.ts:33-38           | flush() 仅本地清空队列——无 HTTP replay/服务端提交/retry/conflict-detection(§5.4.5 recovery flow)                     |
| R16-45 | P0     | api-client/src/ws-client.ts:88               | WS token 作 URL query——泄漏于 server log/referrer/history(§5.3.3/§6.5)                                               |
| R16-46 | P0     | api-client/src/interceptors.ts:29-37         | createAuthInterceptor 接受静态 string token——无动态 TokenManager/auto-refresh/refresh-lock(§5.4.4)                   |
| R16-47 | P0     | apps/web/src/runtime.ts:39                   | Auth token 硬编码 "ui-runtime-access"——绕过整个 auth 流程                                                            |
| R16-48 | P0     | auth/src/auth-service.ts:36-40               | handleSsoCallback 从 URL query 读 access_token/refresh_token 明文——应用 authorization code flow(§5.4.4)              |
| R16-49 | P0     | apps/web/src/app-shell.tsx:8-22              | Route guard 使用硬编码 demoGuardContext+静态 permissions——无真实 RBAC 集成                                           |
| R16-50 | P1     | state/src/query-client.ts:7-9                | 全局 staleTime=30s/retry=1——§5.1.2 要求 per-type staleTime(tasks=2min/approvals=30s/config=1h)                       |
| R16-51 | P1     | state/src/stores/auth-store.ts:3-8           | AuthStore 仅 authenticated+locale——缺 user/token/permissions/tenantId/login/logout/refreshToken/switchTenant(§5.1.1) |
| R16-52 | P1     | state/src/stores/ui-store.ts:3-8             | UIStore 仅 activeRoute+activeFeature——缺 theme/sidebarCollapsed/nlPanelOpen/commandPaletteOpen(§5.1.1)               |
| R16-53 | P1     | state/src/stores/sync-store.ts:3-9           | SyncStore 缺 online/conflicts/syncStatus:"error"/resolveConflict/retrySync(§5.1.1)                                   |
| R16-54 | P1     | state/src/stores/realtime-store.ts:3-12      | RealtimeStore 缺 activeSubscriptions/pendingApprovalCount/activeIncidents/subscribe/unsubscribe(§5.1.1)              |
| R16-55 | P1     | telemetry/src/index.ts:78-92                 | OTLP exporter 格式错误——wraps 在 scopeMetrics[].logs 非 resourceLogs[].scopeLogs[]；collector 会拒绝                 |
| R16-56 | P1     | telemetry/src/index.ts:27-30                 | TelemetrySink.record() 逐事件 HTTP POST——无 batching/flush interval/buffer(§7.3)                                     |
| R16-57 | P1     | telemetry/src/index.ts                       | 无 analytics consent 检查——record() 不调用 PlatformAdapter.getAnalyticsConsent()(§6.5.5+GDPR)                        |
| R16-58 | P1     | api-client/src/interceptors.ts               | 缺 RetryInterceptor(exponential backoff+jitter)和 DedupeInterceptor(§5.4)                                            |
| R16-59 | P1     | api-client/src/interceptors.ts:62-76         | OfflineQueueInterceptor enqueue 后仍发请求失败——应 short-circuit 返回合成响应                                        |
| R16-60 | P1     | api-client/src/rest-client.ts                | 无 Accept-Version:v1 header——§1.8 要求版本头+406 mismatch 处理                                                       |
| R16-61 | P1     | api-client/src/ws-event-router.ts            | 无 heartbeat(§5.3.2.1 30s ping/45s pong timeout)；无 SharedWorker 多路复用(§5.3.4)                                   |
| R16-62 | P1     | api-client/src/endpoints.ts                  | 所有 list endpoint 返回扁平数组——无 cursor pagination/useInfiniteQuery(§5.4.6)                                       |
| R16-63 | P1     | state/src/queries/                           | 无 persistQueryClient——§5.1.4 要求 cache 持久化到 IndexedDB/SQLite 离线支持                                          |
| R16-64 | P1     | platform/src/web-platform-adapter.ts         | 无 notification/biometric/WebAuthn 能力(§2.6.2/§2.5.7)                                                               |
| R16-65 | P1     | apps/web/src/runtime.ts:40                   | tenantId 硬编码 "tenant-default"——非从 auth context 获取；多租户路由失效                                             |
| R16-66 | P1     | apps/web/src/app-shell.tsx                   | 无 ErrorBoundary——§5.6 要求 per-severity 降级(fallback UI/retry/report)                                              |
| R16-67 | P1     | apps/web/src/app-shell.tsx                   | 无 PlatformAdapterProvider——§3.7.4 要求 adapter 通过 Provider 注入                                                   |
| R16-68 | P2     | apps/web/src/feature-registry.ts:1-57        | 27个 feature 模块 eager import——无 React.lazy()/dynamic import(§4.4.1 per-route code split)                          |
| R16-69 | P2     | sync/src/offline-queue.ts:19-22              | enqueue() 无容量上限——§5.5 离线存储需有界队列                                                                        |
| R16-70 | P2     | telemetry/src/index.ts                       | 无 Web Vitals(FCP/LCP/CLS/INP)采集(§7.3 G-3)                                                                         |
| R16-71 | P2     | api-client/src/rest-client.ts:177-178        | HTTP error 抛泛型 Error——无 §5.6.6 status→UI 行为映射(401→redirect/403→denied/429→backoff)                           |
| R16-72 | P2     | apps/web/src/runtime.ts:51-55                | registerWebServiceWorker 引用 aa-sw.js 但文件不存在——L1 静态缓存不工作(§5.5.1)                                       |
| R16-73 | P2     | features/settings/src/hooks/index.ts:105-107 | save() 同步 setState 无 API 调用/ETag(§4.7.8 要求 If-Match)                                                          |
| R16-74 | P2     | apps/web/src/runtime.ts                      | 启动无 contract version check——§1.8 要求 /api/v1/meta/contract-version+mismatch banner                               |

### §82 ADR/Contract 系统性一致性缺陷

| #      | 严重度 | 文件/位置                                                         | 问题                                                                                                                    |
| ------ | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| R16-75 | P0     | adr/060-explicit-planning-hub.md                                  | 已解决：ADR-060 已把 `PlanGraphBundle` 定为唯一 P3→P4 handoff，旧 `Plan DTO` 不再作为 active canonical contract              |
| R16-76 | P0     | adr/060:59 + runtime-execute-bridge.ts:199                        | RuntimeExecuteBridge.executePlan() 仍接受旧 Plan 类型非 PlanGraphBundle——代码实际走废弃路径                             |
| R16-77 | P0     | src/platform/contracts/execution-plan/index.ts                    | ExecutionPlan 仍导出+有 createExecutionPlan() 工厂——ADR-109 已明确禁止                                                  |
| R16-78 | P0     | src/platform/contracts/control-directive/index.ts                 | ControlDirective 仍导出+有工厂——ADR-109 已禁止                                                                          |
| R16-79 | P0     | src/platform/contracts/state-command/index.ts                     | StateCommand 仍导出+有工厂——ADR-109 已禁止                                                                              |
| R16-80 | P1     | contracts/artifact_unified_model_contract.md:22                   | OAPEFLIR stages 列 "Rollout" 非 "Release"(ADR-091 已改名)                                                               |
| R16-81 | P1     | contracts/context_compaction_and_overflow_contract.md:139         | OAPEFLIR stage 表用 "Rollout"+RolloutRecord(应为 Release)                                                               |
| R16-82 | P1     | contracts/release_rollout_and_rollback_contract.md:8              | 已解决：release contract 标题与正文都已回写为 `Release` 阶段语义，`Rollout` 仅保留为受控发布机制                           |
| R16-83 | P1     | 40+ contracts                                                     | 锅炉板 OAPEFLIR 块用 "改进候选评估与 rollout"——大规模术语过时                                                           |
| R16-84 | P1     | adr/093 vs harness/index.ts:57-77                                 | ConstraintPack 缺 sandbox_requirement/approval_requirement/budget_envelope(ADR-093 要求)                                |
| R16-85 | P1     | contracts/task-intake-request-contract.md:56                      | 已解决：`ConstraintPackRef` 已冻结为 `constraint_pack:${id}` 字符串引用类型                                               |
| R16-86 | P1     | architecture/05-cross-platform-ui-architecture.md:7               | UI 架构基线为 00-platform-architecture v3.2——当前已 v4.3，UI arch 未 re-baseline                                        |
| R16-87 | P1     | adr/063 + contracts/behavior_drift_detection_contract.md          | ADR 定义4种 drift type+统计检测——代码仅有 golden-test regression；DriftDetector/DriftAlert/DriftMitigationAction 不存在 |
| R16-88 | P1     | contracts/event_bus_contract.md:84 + event-envelope-contract.md:7 | 已解决：truth release 事件已统一为 `platform.release.*`，裸 `release.*` 仅保留为历史/adapter 输入                         |
| R16-89 | P1     | event-registry.ts:73-109                                          | Event producers 注册为 workflow_runtime 非 platform.\* namespace——不遵循 canonical 命名                                 |
| R16-90 | P1     | adr/060:108                                                       | 已解决：ADR-060 已移除 `src/core/planning/` 旧路径引用，并明确落点为 `src/platform/orchestration/`                        |
| R16-91 | P1     | architecture §19                                                  | 已解决：已新增 `docs_zh/contracts/agent_handoff_contract.md` 作为 handoff/delegation 专属 contract                         |
| R16-92 | P1     | architecture §68                                                  | Multimodal video pipeline 无 contract(multimodal_gateway_contract.md 缺 video scene/keyframe/transcript)                |
| R16-93 | P1     | src/platform/contracts/types/platform-contracts.ts:70             | ExecutionPlan 完整接口(budget/steps/fallback) 与 PlanGraphBundle 并行——同包两套竞争类型                                 |
| R16-94 | P2     | adr/072-oapeflir-testing-strategy.md:18                           | 已解决：ADR-072 已把现存测试根收敛为 `tests/unit|integration|golden|e2e|invariants`，不存在目录不再被当成既有事实       |
| R16-95 | P2     | adr/003-memory-seven-layers.md                                    | 文件名 "seven-layers" 但内容/标题为 "六层"——ADR-007 交叉引用为 "六层" 链接到此文件                                      |
| R16-96 | P2     | architecture §62                                                  | Edge runtime contract 不引用 RunVersionLock——离线节点无版本锁冻结语义                                                   |

## Round 17：Orchestration/Execution + Interaction/NL + Desktop/Mobile + Security/IAM

### §84 Orchestration/Execution 深层缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                                                               |
| ------ | ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R17-01 | P0     | delegation-manager.service.ts:409-411    | narrowPermissions 使用 child resources 原样(非空时)不与 parent 取交集——子代可请求父代无权资源(§19.2 child⊆parent)                  |
| R17-02 | P0     | delegation-manager.service.ts:180        | cancel() 直接修改 delegation.status 无 CAS/fencing——并发 cancel+complete 竞态产生不一致状态                                        |
| R17-03 | P0     | run-termination-cleanup.ts:50-53         | execute() 仅分类资源为 cleaned/skipped 列表但无实际清理逻辑(无 lease release/secret revoke/budget release)——始终返回 complete:true |
| R17-04 | P0     | command-security.ts:258-261              | validateCommandSignature 阻止所有以 `-` 开头的 args——合法 `python script.py --verbose` 被误拒为 interpreter_flag_denied            |
| R17-05 | P1     | delegation-manager.service.ts:274        | createDelegationContext 不重新验证 parent permissions 是否被撤销——过期权限持续生效                                                 |
| R17-06 | P1     | call-depth-budget.ts:18-22               | effectiveCallDepth 用 Math.max 非 sum——depth=3 delegate+depth=5 decompose 读为5非8，可绕过限制                                     |
| R17-07 | P1     | topology-validator.ts:119-122            | 循环检测仅检查 chain 内 packId——fan-out 拓扑中兄弟分支环不可检测                                                                   |
| R17-08 | P1     | execution-lease-service-async.ts:247-265 | releaseLeaseSync 不检查 lease.status!="active"——可释放已过期/已释放的 lease                                                        |
| R17-09 | P1     | execution-lease-service-async.ts:424-431 | handoverLeaseSync 不检查前 lease 是否过期——可从死 lease 创建新活跃 lease                                                           |
| R17-10 | P1     | escalation/index.ts:23-50                | EscalationService decide() 返回结构但不创建 approval_request/不通知操作员/不阻塞执行                                               |
| R17-11 | P1     | budget-allocator.ts:59-62                | hardCapSatisfied=false 时 settle 仍继续——budget hard cap 未在结算时强制(§26)                                                       |
| R17-12 | P1     | worker-service-identity.ts:29-31         | register() 静默覆写已有 identity 无验证——可劫持合法 worker mTLS 指纹                                                               |
| R17-13 | P2     | delegation-manager.service.ts:55-57      | 所有 delegation 状态纯内存——重启丢失活跃 delegations                                                                               |
| R17-14 | P2     | delegation-manager.service.ts:282        | Spec 定义 10态状态机——实现仅 6态，缺 capability_discovery/bid/award/verified/closed                                                |
| R17-15 | P2     | delegation-manager.service.ts:463-466    | timeout 无上限——可设 MAX_SAFE_INTEGER 创建不死 delegation                                                                          |
| R17-16 | P2     | execution-dispatch-service.ts:357        | 始终选 eligibleWorkers[0]——等分 worker 间无随机化，确定性热点                                                                      |
| R17-17 | P2     | command-security.ts:54-111               | DEFAULT_COMMAND_POLICY_ENTRIES 有 mkdir/touch 重复条目——Map 静默丢弃前者配置                                                       |
| R17-18 | P2     | improvement-candidate-registry.ts:17     | 内存 Map 无 eviction/size cap——无界内存增长                                                                                        |
| R17-19 | P2     | escalation/index.ts:38                   | 成本阈值硬编码 $10 无 tenant/domain 可配——§12 要求策略驱动                                                                         |

### §85 Interaction/NL/Autonomy 深层缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                                                                    |
| ------ | ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R17-20 | P0     | nl-gateway/index.ts:677-762              | buildTask() 跳过 ClarificationSession→ConfirmedTaskSpec 管线(§5.3)；直接从 parse 结果构建 RequestEnvelope                               |
| R17-21 | P0     | nl-gateway/index.ts:164                  | UserConfirmationReceipt.state 仅 "not_required"\|"pending"——缺 "confirmed" 终态；确认不可表示                                           |
| R17-22 | P0     | dashboard-websocket-server.ts:106        | registerClient() 仅接受 dashboardIds——无 principal/tenantId/scope/auth 检查(§7.1 要求认证绑定+租户过滤)                                 |
| R17-23 | P0     | proactive-agent/index.ts:316-322         | evaluate() 在 requireConfirmation=false 时允许 auto_execute 不管 riskLevel——critical-risk 可自动触发(§41.1 medium+必须 suggestion mode) |
| R17-24 | P1     | nl-gateway/index.ts:804-806              | ConversationContextManager 纯内存 Map——§39.1 要求持久化到 Memory 跨会话恢复                                                             |
| R17-25 | P1     | nl-gateway/index.ts:620-675              | parseDetailed() 不消费 ConversationContextManager——多轮上下文从不注入意图解析(§39.5)                                                    |
| R17-26 | P1     | intent-parser/index.ts:6-21              | Intent parser 纯 regex/keyword——§39.7 要求 LLM-based 多语言意图识别                                                                     |
| R17-27 | P1     | slot-resolver/index.ts:3-17              | resolveRequiredSlots() 导出但从未被 NlEntryService 调用——域 slot 验证为死代码                                                           |
| R17-28 | P1     | goal-decomposer/index.ts:66-73           | GoalLifecycleState 缺 "partially_completed"(§40.5)                                                                                      |
| R17-29 | P1     | goal-decomposer/index.ts:200-218         | parseConstraintEnvelope 提取 budgetLimitUsd 但不按子任务比例分配(§40.2)                                                                 |
| R17-30 | P1     | autonomy/index.ts:155-167                | scoreCapability() 返回 0-100——§42.1 定义 0-1000；10x 不匹配                                                                             |
| R17-31 | P1     | autonomy/index.ts:296-330                | evaluateProfile() auto-promotes approvedBy:"auto"——§42.2 要求 domain_owner/platform_team 审批                                           |
| R17-32 | P1     | autonomy/index.ts:203-250                | decideLevel() 无成本/预算检查——§42.2 "成本超预算200%→降至supervised" 缺失                                                               |
| R17-33 | P1     | dashboard-websocket-server.ts:330-347    | 无 last_event_id/delta replay/stream_gap——§7.1 要求断连恢复+gap 检测                                                                    |
| R17-34 | P1     | ux/workflow-builder-service.ts:153-196   | Builder 自建 nodes/edges 不映射 PlanNode/PlanEdge/ConstraintPack——§44.3 要求可视化构建器为 PlanGraph projection                         |
| R17-35 | P2     | nl-gateway/index.ts:448-461              | detectPromptInjection() 用 pattern.exec() 仅报第一个匹配——多注入仅报首个                                                                |
| R17-36 | P2     | nl-gateway/index.ts:677                  | 无 dry-run preview for high/critical NL 请求(§39.1)                                                                                     |
| R17-37 | P2     | goal-decomposer/index.ts:245-350         | 分解前无 capability validation against DomainDescriptor(§40.2)                                                                          |
| R17-38 | P2     | dashboard-projection-service.ts:40-42    | 仅3种 projection type——§43.2-43.5 要求 agent health/SLO/budget/approval/resource/cost 等                                                |
| R17-39 | P2     | dashboard-websocket-server.ts:67-69      | 无 schema_version 协商(UI arch §1.8)                                                                                                    |
| R17-40 | P2     | proactive-agent/index.ts:200-231         | trigger declarations 不验证 against DomainDescriptor(§41.1)                                                                             |
| R17-41 | P2     | autonomy/promotion-engine/index.ts:14-38 | assessPromotion 忽略 incident severity 分级和 humanOverrides rate(§42.2)                                                                |

### §86 Desktop/Mobile 应用 + Platform Stability 缺陷

| #      | 严重度 | 文件/位置                                               | 问题                                                                                                |
| ------ | ------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R17-42 | P0     | ui/apps/electron-win/package.json                       | 无 electron 依赖声明——`electron .` 启动必失败                                                       |
| R17-43 | P0     | ui/apps/electron-win/src/main.ts                        | 无 BrowserWindow/app.whenReady()/Tray/Menu——仅导出配置对象非 Electron 主进程                        |
| R17-44 | P0     | ui/apps/electron-win/src/preload.ts                     | 无 contextBridge.exposeInMainWorld()——IPC channel 声明但未接线                                      |
| R17-45 | P0     | ui/apps/tauri-macos/src-tauri/src/lib.rs:12             | run_shell 执行任意命令无沙箱——违反 §2.5.3 App Sandbox+Hardened Runtime                              |
| R17-46 | P0     | ui/apps/tauri-linux/src-tauri/src/lib.rs:12             | 同上——run_shell 无限制任意命令执行                                                                  |
| R17-47 | P0     | ui/apps/mobile/package.json                             | 无 react-native 依赖——app 无法构建                                                                  |
| R17-48 | P0     | ui/apps/mobile/src/App.tsx:7                            | 使用 HTML div/span 非 RN View/Text——设备上 crash                                                    |
| R17-49 | P0     | src/platform/stability/                                 | SLO tracking 模块完全不存在——§27 mandates per-domain SLO+error budget+breach response               |
| R17-50 | P1     | ui/apps/electron-win/                                   | §2.5.2 system tray/Jump List/Notification Center/multi-window 全缺                                  |
| R17-51 | P1     | ui/apps/electron-win/                                   | §2.5.2 keyboard shortcuts(Ctrl+K/N/Shift+D) 无 globalShortcut 注册                                  |
| R17-52 | P1     | ui/apps/electron-win/                                   | §2.5.2 auto-update(electron-updater) 无代码无依赖                                                   |
| R17-53 | P1     | ui/apps/electron-win/index.html:9                       | 无 script 标签加载 app bundle——页面为静态文本                                                       |
| R17-54 | P1     | ui/apps/tauri-macos/src-tauri/src/lib.rs                | 仅3个 stub commands(healthcheck/open_deep_link/run_shell)全返回硬编码字符串                         |
| R17-55 | P1     | ui/apps/tauri-macos/src-tauri/Cargo.toml:7              | 无 Tauri plugins(updater/notification/shell/os)——§2.5.3 Menu Bar/Notification/Keychain/Sparkle 全缺 |
| R17-56 | P1     | ui/apps/tauri-macos/src-tauri/tauri.conf.json           | 无 security/allowlist/updater 配置；缺 CSP policy(§6.5.4)                                           |
| R17-57 | P1     | ui/apps/tauri-linux/                                    | §2.5.4 system tray(SNI)/D-Bus notifications/Wayland/XDG/dark-light theme 全缺                       |
| R17-58 | P1     | ui/apps/mobile/src/index.ts                             | §2.5.5/§2.5.6 push(FCM/APNs)/biometric/offline SQLite/gestures/widgets——manifest 声明但无原生接线   |
| R17-59 | P1     | ui/apps/mobile/src/navigation.ts                        | Navigation 为 plain objects 无 @react-navigation stack/tab(§4.4.2)                                  |
| R17-60 | P1     | ui/packages/ui-mobile/src/native-modules/index.ts       | Native module 仅为 boolean config——无 NativeModules/TurboModule 绑定                                |
| R17-61 | P1     | ui/packages/ui-mobile/src/components/index.ts           | 无 RN 组件(View/Text/TouchableOpacity)——仅 TS interface+factory                                     |
| R17-62 | P1     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:93 | 所有状态纯内存——重启丢失实验状态                                                                    |
| R17-63 | P1     | src/ops-maturity/chaos/                                 | §61 blast radius 范围守卫——ExperimentTarget 有 labels 但无实际范围限制                              |
| R17-64 | P1     | src/ops-maturity/chaos/:161                             | auto-terminate 仅检查时间——假设违反无自动回滚/补偿                                                  |
| R17-65 | P1     | src/ops-maturity/chaos/:155                             | injectFault() 返回 config 但不执行实际注入——stub                                                    |
| R17-66 | P2     | ui/apps/tauri-macos/src-tauri/tauri.conf.json           | 无 minWidth/minHeight(Electron 有 1180×760)                                                         |
| R17-67 | P2     | ui/apps/tauri-linux/src/index.ts:7                      | supportsBackgroundAgent:true 但无背景服务代码；其他平台无此字段                                     |
| R17-68 | P2     | ui/apps/mobile/metro.config.js                          | 无 monorepo workspace resolver——@aa/\* 包无法解析                                                   |
| R17-69 | P2     | ui/packages/ui-mobile/src/navigation/index.ts           | §4.4.2 5-tab(Home/Tasks/Approvals/Dashboard/More)——实现含 marketplace 替代 dashboard                |
| R17-70 | P2     | ui/packages/ui-core/src/components/index.ts             | §6.3.2 缺 Modal/Dialog/Dropdown/Toast/Tabs/Badge/Avatar/Tooltip——仅6组件                            |
| R17-71 | P2     | ui/packages/ui-core/src/layouts/index.ts:30             | ThreePaneLayout 固定 CSS grid 无响应式断点(§2.5.1 1440/1024/768px)                                  |
| R17-72 | P2     | src/ops-maturity/chaos/:126                             | recordSteadyStateResult 首轮后终止——无持续监控循环(§61)                                             |

### §87 Security/IAM/Compliance 深层缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                                         |
| ------ | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| R17-73 | P0     | access-model.ts:183                             | resolvePrincipalAccessProfile 使用 caller 提供的 capabilities 原样(非空时)绕过 role-capability map——权限提升 |
| R17-74 | P0     | data-classification-service.ts:673-675          | clearAuditLog() 擦除全部分类审计轨迹无 authz 检查/无 audit-of-clear event——违反 §46 不可变审计               |
| R17-75 | P1     | access-model.ts:259-268                         | manualTakeoverActive=true 无条件允许所有动作(含 production/regulated-data)无角色门——接管即全能               |
| R17-76 | P1     | field-encryption.ts:14-16                       | normalizeKey SHA-256 hash 任何长度 key——接受 1 字节密码无最小强度(§43)                                       |
| R17-77 | P1     | field-encryption.ts:20-41                       | 密文无 key-ID/versioning——密钥轮换需重加密所有数据(§43 要求轮换支持)                                         |
| R17-78 | P1     | policy-engine.ts:93-106                         | subjectType 仅 user\|agent\|system——access-model 定义 6种 principal；service/worker/plugin 绕过策略引擎      |
| R17-79 | P1     | vault-http-secret-provider.ts:147-159           | AppRole login 失败静默吞没(无 throw/log)——降级到 static token 调用者无感知                                   |
| R17-80 | P1     | network-egress-policy.ts:248-249                | 默认 mode="audit_only"——被阻止域/内部主机仅日志实际放行；出口限制为空操作                                    |
| R17-81 | P1     | sandbox-policy.ts:410-443                       | 所有工厂策略 deniedRoots:[]——/etc、/proc、~/.ssh 无默认拒绝                                                  |
| R17-82 | P1     | data-classification-service.ts:719-720          | matchesRule 用用户定义 pattern 构建 new RegExp() 无复杂度守卫——ReDoS 向量                                    |
| R17-83 | P1     | compliance-case-orchestration-service.ts:63,307 | governance=null 时 governance?.allowed??true——所有合规转移无治理评估直接批准                                 |
| R17-84 | P1     | compliance-governance-service.ts:95-109         | createExceptionWorkflow 返回 plain object 无持久化/追踪；expiresAt 无未来验证；compensating controls 不强制  |
| R17-85 | P1     | evidence-collector.ts:42                        | Evidence 纯内存 Map——重启丢失，无完整性保护(§46 要求持久 evidence+链式 hash)                                 |
| R17-86 | P1     | audit-event-integrity.ts:256                    | latestChainHash 读 entries.at(-1) 从未排序输入——可能引用错误链尾                                             |
| R17-87 | P2     | vault-http-secret-provider.ts:173-174           | Static token 硬编码 1h 过期不管实际 TTL——过期 token 在 buffer 窗口内被服务                                   |
| R17-88 | P2     | vault-http-secret-provider.ts:232-233           | isAvailable() 发送 "dummy" 作 X-Vault-Token——触发 Vault 审计噪音                                             |
| R17-89 | P2     | approval-routing/escalation/index.ts:12-21      | shouldEscalateApproval 无 max-depth/cooldown；仅 first match(.find)；无 SLA-breach 通知(§40)                 |
| R17-90 | P2     | approval-routing/route-engine/index.ts:170      | applySodPolicy 可返回空 approver chain——无 fail-closed/显式拒绝；零审批人通过                                |
| R17-91 | P2     | access-model.ts:95-101                          | agent_runtime 默认角色无条件授予 exec:command+fs:write——§11 要求破坏性操作需审批                             |

### §89 Harness Runtime/HITL/Learn 深层缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                                                                                          |
| ------ | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R18-01 | P0     | harness/index.ts:57-77                            | ConstraintPack.budget 缺 max_model_tokens/max_context_tokens/max_output_tokens——仅3/6维度(§45.3)                                              |
| R18-02 | P0     | harness/index.ts:168-198                          | HarnessRun 缺 tenantId/traceId/riskLevel/ownership/auditRefs——多租户隔离和审计链断裂(§45.13)                                                  |
| R18-03 | P0     | harness/index.ts:585-616                          | decide() 仅消费 evaluatorScore 忽略 policy/budget/risk/sideEffect/guardrail/HITL——§45.25 "LLM-as-Judge cannot override deterministic failure" |
| R18-04 | P0     | harness/recovery-controller.ts:4                  | HarnessFailureType 仅3/5种——缺 llm_provider_unavailable(fallback chain)/budget_exhausted(safe terminate)/platform_panic(§45.11)               |
| R18-05 | P0     | harness/guardrails/guardrail-vibration-breaker.ts | VibrationBreaker 从未接入 GuardrailEngine/runLoop——§45.20 振荡检测为死代码；run 可无限 replan                                                 |
| R18-06 | P1     | harness/index.ts:148-158                          | HarnessStep 缺 nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction(§45.13)                                             |
| R18-07 | P1     | harness/index.ts:315-316                          | appendStep 设 startedAt=completedAt——step duration 恒为0违反 §58.1 harness.run.duration                                                       |
| R18-08 | P1     | harness/index.ts:57-60                            | ConstraintPack.autonomyMode 用 "manual"\|"auto"——§45.3 为 "suggestion"\|"semi_auto"；§42 映射断裂                                             |
| R18-09 | P1     | oapeflir-harness-mapping.ts:13-29                 | mapHarnessStepToOapeflirPhase 永不返回 "learn"/"release"——8阶段中2阶段不可达(§45.22)                                                          |
| R18-10 | P1     | learn/knowledge-promotion-service.ts:102-103      | 批量 promote 事件 payload 硬编码 learningObjects[0]——N>1 时丢失 N-1 对象元数据                                                                |
| R18-11 | P1     | learn/learning-object-model.ts:14                 | createdAt 为 z.number().int()(epoch) 但 Harness 用 ISO string(nowIso())——类型不匹配无法关联                                                   |
| R18-12 | P1     | harness/index.ts:99-104                           | FeedbackEnvelope 为扁平 signals:string[]——缺 §45.6 四级层次(Step/Task/Workflow/System)和结构化信号                                            |
| R18-13 | P2     | harness/sandbox/                                  | 目录不存在——§45.4 step 5 要求 per-tool sandbox-layer 绑定                                                                                     |
| R18-14 | P2     | harness/index.ts:39-55                            | HarnessRunStatus 有 16态 vs spec 7态——额外态无文档无 FSM guard                                                                                |
| R18-15 | P2     | harness/index.ts:633-805                          | runLoop 复用相同静态 plannerOutput/generatorOutput/evaluatorOutput——replan/retry 循环无法收敛                                                 |
| R18-16 | P2     | harness/recovery-controller.ts:26-28              | tool_timeout 直接 resume() 跳过 LoopController retry/replan 决策(§45.11)                                                                      |

### §90 Tests/Bootstrap/Types 系统性缺陷

| #      | 严重度 | 文件/位置                                                 | 问题                                                                                                              |
| ------ | ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R18-17 | P0     | tests/e2e/multi-step-workflow.test.ts:15                  | E2E 测试直接操作 WorkflowStateRecord(legacy)非 HarnessRun/PlanGraphBundle——验证废弃路径                           |
| R18-18 | P0     | tests/e2e/critical-workflows.test.ts:367+                 | ~30处使用 store.insertWorkflowState()/getWorkflowState() legacy API 非 HarnessRuntimeService                      |
| R18-19 | P0     | tests/e2e/workflow-resume-flow.test.ts:128+               | Resume 测试直接调用 store.updateWorkflowState() 绕过 fencing/CAS/lease——即使不变量失效测试仍通过                  |
| R18-20 | P1     | src/platform-architecture-types.ts                        | 无 HarnessRun/HarnessRunStatus/PlanGraphBundle/NodeRun 类型——仅含 app-layer types(§45/§13 canonical objects 缺失) |
| R18-21 | P1     | src/index.ts:41                                           | PlatformRootEntryMode 与 PlatformStartupTargetKind 重复定义相同 union——漂移风险                                   |
| R18-22 | P1     | src/index.ts:125-171                                      | runPlatformRootDemo() 输出 TaskRecord/WorkflowStateRecord 形态——demo 暴露 legacy 非 canonical                     |
| R18-23 | P1     | config/runtime/default.json                               | 缺 §24 必须 keys：circuitBreaker.threshold/configSchemaVersion/configDriftReconciler interval                     |
| R18-24 | P1     | config/bootstrap/default.json                             | 仅3 keys(appName/phase/stableCoreEnabled)——缺 layer 启动顺序/health-check timeout/readiness-probe(§3/§32)         |
| R18-25 | P1     | platform-architecture-bootstrap.ts:128-148                | registerPlatformArchitectureServices() register 后立即 get()——强制 eager init 破坏 lazy DAG                       |
| R18-26 | P2     | tests/e2e/                                                | 无 PlanGraphBundle dispatch e2e 测试——canonical P3→P4 路径零覆盖                                                  |
| R18-27 | P2     | tests/golden/                                             | 无 HarnessRun/PlanGraphBundle 响应 shape golden test——golden tests 引用 TaskRecord-era 形态                       |
| R18-28 | P2     | config/risk/default.json                                  | riskCategories 数组缺 "ai" 类别(register.json:14 有)——AI risk undeclared                                          |
| R18-29 | P2     | src/platform/shared/lifecycle/service-registry.ts:316-322 | 循环依赖 topologicalSort() 仅 warn 不 throw——bootstrap 可静默以不完整顺序继续(§3)                                 |

### §91 Observability/Channel Gateway/API 层缺陷

| #      | 严重度 | 文件/位置                               | 问题                                                                                                        |
| ------ | ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R18-30 | P0     | middleware/ (目录)                      | 无 idempotency-key enforcement middleware——§6.2 要求所有写操作携带+去重                                     |
| R18-31 | P0     | All route files (task-routes.ts:67 etc) | 路由用 /v1/_ 非 /api/v1/_——§6.3 canonical paths 为 /api/v1/harness-runs 等                                  |
| R18-32 | P1     | http-server/index.ts                    | 无 harness-runs routes——§6.3/§6.8 定义 /api/v1/harness-runs 为 canonical 执行入口；仅有 legacy /v1/tasks    |
| R18-33 | P1     | response-hardening.ts:102-129           | decorateResponseHeaders 无 X-Trace-Id——§6.2 要求 X-Request-Id + X-Trace-Id                                  |
| R18-34 | P1     | websocket-bridge.ts:282-288             | broadcastToTask 不检查 ws.bufferedAmount——§7.1 要求 server-side backpressure(buffer full→drop low-priority) |
| R18-35 | P1     | stream-bridge.ts                        | StreamBridge 无连接 client 追踪/slow-consumer 检测——§7.1 要求 per-connection backpressure+stream_gap event  |
| R18-36 | P1     | structured-logger.ts:42-59              | StructuredLogEntry 有 correlationId 无 causationId——§5.2 ContractEnvelope 要求两者支持 causal chain         |
| R18-37 | P1     | middleware/ (目录)                      | 无 request-deduplication middleware——§4.2 P1 职责明确包含"请求去重"                                         |
| R18-38 | P2     | structured-logger.ts:247-302            | 无最低 log-level 过滤——所有 debug 级别命中 buffer+file；production 无抑制配置                               |
| R18-39 | P2     | channel-gateway-service.ts:468-510      | 外部 provider HTTP 调用(Telegram/Slack/Webhook)无 circuit breaker(§9.1/§7.1)                                |
| R18-40 | P2     | websocket-bridge.ts:210-222             | 无 per-client subscription cap——单 client 可订阅无界 taskIds 导致内存耗尽(§9 isolation)                     |
| R18-41 | P2     | channel-gateway-service.ts:487,541,606  | fetchImpl() 无 timeout——§7.1 要求 default 5s/max 30s                                                        |

### §92 ADR/Contract 终审缺陷

| #      | 严重度 | 文件/位置                                                             | 问题                                                                                                                                                         |
| ------ | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R18-42 | P0     | adr/096-harness-recovery-controller.md:14                             | 引用 "phase 8b" 作 release gate——ADR-094 已修正为 Ring 2 但本 ADR 未同步(§33 three-ring model)                                                               |
| R18-43 | P0     | src/domains/recipes/index.ts:18-27                                    | DomainRecipeSchema 缺 contract 必须字段：risk_profile_ref/guardrail_overlay/recommended_workflow_ids/default_prompt_bundle_ref/acceptance_checklist_ref      |
| R18-44 | P0     | src/domains/domain-specs.ts:18-26                                     | Domain lifecycle states(validated/registered/active/updating/archived)不匹配 contract(validating/certified/canary/active/deprecated/retired)——缺 canary 阶段 |
| R18-45 | P1     | src/domains/domain-specs.ts:55-61                                     | DomainRiskSpec 缺 contract 必须字段：advisory_only/human_accountable/deterministic_hot_path_only/allowed_capability_overrides/required_approval_policies     |
| R18-46 | P1     | contracts/workflow_static_analysis_and_compensation_contract.md:31,34 | StaticCompatibilityIssue 和 WorkflowTemplate 代码库中不存在                                                                                                  |
| R18-47 | P1     | contracts/gateway_streaming_contract.md:26-30                         | Contract 定义 StreamChannel/ProgressChunk/FinalChunk/ErrorChunk——代码用 StreamEventFrame(类型不匹配)                                                         |
| R18-48 | P1     | architecture/05-cross-platform-ui-architecture.md:7                   | UI arch 基线为 v3.2——落后两个大版本(当前 v4.3)；缺五平面/PlanGraphBundle/NodeAttemptReceipt                                                                  |
| R18-49 | P1     | divisions/ 目录                                                       | AGENTS.md 声明 "division definitions live in divisions/" 但目录不存在                                                                                        |
| R18-50 | P1     | adr/109-contract-freeze.md:39                                         | 引用 ADR-110 但 110 不在 v4.3 Contract Freeze Scope——forward reference 到未冻结 ADR                                                                          |
| R18-51 | P2     | adr/104-domain-recipe-twelve-archetypes.md:27                         | 12个 archetypes 与 ADR-105 latency_tier 4级无映射——cross-ADR 语义 gap                                                                                        |
| R18-52 | P2     | contracts/multimodal_gateway_contract.md:9-12                         | 4个 canonical objects 仅为 plain TS interface 非 Zod schema——contract §5 测试要求不满足                                                                      |
| R18-53 | P2     | contracts/capacity_planning_contract.md:8-12                          | CapacitySignal 在 architecture-remediation.ts(shim)非 ops-maturity 模块——canonical type 位置错误                                                             |
| R18-54 | P2     | docs_zh/operations/capacity-planning.md                               | 描述 Pod/PostgreSQL/Redis sizing 但不引用 CapacityForecast/CapacityScenario contract 对象                                                                    |
| R18-55 | P2     | adr/094-harness-durable-execution.md:10                               | OAPEFLIR 部分仍用 "step"——ADR-092 修正为 NodeRun/NodeAttempt                                                                                                 |
### §89 Harness Runtime/HITL/Learn 深层缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                                                                                          |
| ------ | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R18-01 | P0     | harness/index.ts:57-77                            | ConstraintPack.budget 缺 max_model_tokens/max_context_tokens/max_output_tokens——仅3/6维度(§45.3)                                              |
| R18-02 | P0     | harness/index.ts:168-198                          | HarnessRun 缺 tenantId/traceId/riskLevel/ownership/auditRefs——多租户隔离和审计链断裂(§45.13)                                                  |
| R18-03 | P0     | harness/index.ts:585-616                          | decide() 仅消费 evaluatorScore 忽略 policy/budget/risk/sideEffect/guardrail/HITL——§45.25 "LLM-as-Judge cannot override deterministic failure" |
| R18-04 | P0     | harness/recovery-controller.ts:4                  | HarnessFailureType 仅3/5种——缺 llm_provider_unavailable(fallback chain)/budget_exhausted(safe terminate)/platform_panic(§45.11)               |
| R18-05 | P0     | harness/guardrails/guardrail-vibration-breaker.ts | VibrationBreaker 从未接入 GuardrailEngine/runLoop——§45.20 振荡检测为死代码；run 可无限 replan                                                 |
| R18-06 | P1     | harness/index.ts:148-158                          | HarnessStep 缺 nodeRunRefs/rationale/evidenceRefs/toolCalls/latency/cost/error/nextAction(§45.13)                                             |
| R18-07 | P1     | harness/index.ts:315-316                          | appendStep 设 startedAt=completedAt——step duration 恒为0违反 §58.1 harness.run.duration                                                       |
| R18-08 | P1     | harness/index.ts:57-60                            | ConstraintPack.autonomyMode 用 "manual"\|"auto"——§45.3 为 "suggestion"\|"semi_auto"；§42 映射断裂                                             |
| R18-09 | P1     | oapeflir-harness-mapping.ts:13-29                 | mapHarnessStepToOapeflirPhase 永不返回 "learn"/"release"——8阶段中2阶段不可达(§45.22)                                                          |
| R18-10 | P1     | learn/knowledge-promotion-service.ts:102-103      | 批量 promote 事件 payload 硬编码 learningObjects[0]——N>1 时丢失 N-1 对象元数据                                                                |
| R18-11 | P1     | learn/learning-object-model.ts:14                 | createdAt 为 z.number().int()(epoch) 但 Harness 用 ISO string(nowIso())——类型不匹配无法关联                                                   |
| R18-12 | P1     | harness/index.ts:99-104                           | FeedbackEnvelope 为扁平 signals:string[]——缺 §45.6 四级层次(Step/Task/Workflow/System)和结构化信号                                            |
| R18-13 | P2     | harness/sandbox/                                  | 目录不存在——§45.4 step 5 要求 per-tool sandbox-layer 绑定                                                                                     |
| R18-14 | P2     | harness/index.ts:39-55                            | HarnessRunStatus 有 16态 vs spec 7态——额外态无文档无 FSM guard                                                                                |
| R18-15 | P2     | harness/index.ts:633-805                          | runLoop 复用相同静态 plannerOutput/generatorOutput/evaluatorOutput——replan/retry 循环无法收敛                                                 |
| R18-16 | P2     | harness/recovery-controller.ts:26-28              | tool_timeout 直接 resume() 跳过 LoopController retry/replan 决策(§45.11)                                                                      |

### §90 Tests/Bootstrap/Types 系统性缺陷

| #      | 严重度 | 文件/位置                                                 | 问题                                                                                                              |
| ------ | ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R18-17 | P0     | tests/e2e/multi-step-workflow.test.ts:15                  | E2E 测试直接操作 WorkflowStateRecord(legacy)非 HarnessRun/PlanGraphBundle——验证废弃路径                           |
| R18-18 | P0     | tests/e2e/critical-workflows.test.ts:367+                 | ~30处使用 store.insertWorkflowState()/getWorkflowState() legacy API 非 HarnessRuntimeService                      |
| R18-19 | P0     | tests/e2e/workflow-resume-flow.test.ts:128+               | Resume 测试直接调用 store.updateWorkflowState() 绕过 fencing/CAS/lease——即使不变量失效测试仍通过                  |
| R18-20 | P1     | src/platform-architecture-types.ts                        | 无 HarnessRun/HarnessRunStatus/PlanGraphBundle/NodeRun 类型——仅含 app-layer types(§45/§13 canonical objects 缺失) |
| R18-21 | P1     | src/index.ts:41                                           | PlatformRootEntryMode 与 PlatformStartupTargetKind 重复定义相同 union——漂移风险                                   |
| R18-22 | P1     | src/index.ts:125-171                                      | runPlatformRootDemo() 输出 TaskRecord/WorkflowStateRecord 形态——demo 暴露 legacy 非 canonical                     |
| R18-23 | P1     | config/runtime/default.json                               | 缺 §24 必须 keys：circuitBreaker.threshold/configSchemaVersion/configDriftReconciler interval                     |
| R18-24 | P1     | config/bootstrap/default.json                             | 仅3 keys(appName/phase/stableCoreEnabled)——缺 layer 启动顺序/health-check timeout/readiness-probe(§3/§32)         |
| R18-25 | P1     | platform-architecture-bootstrap.ts:128-148                | registerPlatformArchitectureServices() register 后立即 get()——强制 eager init 破坏 lazy DAG                       |
| R18-26 | P2     | tests/e2e/                                                | 无 PlanGraphBundle dispatch e2e 测试——canonical P3→P4 路径零覆盖                                                  |
| R18-27 | P2     | tests/golden/                                             | 无 HarnessRun/PlanGraphBundle 响应 shape golden test——golden tests 引用 TaskRecord-era 形态                       |
| R18-28 | P2     | config/risk/default.json                                  | riskCategories 数组缺 "ai" 类别(register.json:14 有)——AI risk undeclared                                          |
| R18-29 | P2     | src/platform/shared/lifecycle/service-registry.ts:316-322 | 循环依赖 topologicalSort() 仅 warn 不 throw——bootstrap 可静默以不完整顺序继续(§3)                                 |

### §91 Observability/Channel Gateway/API 层缺陷

| #      | 严重度 | 文件/位置                               | 问题                                                                                                        |
| ------ | ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R18-30 | P0     | middleware/ (目录)                      | 无 idempotency-key enforcement middleware——§6.2 要求所有写操作携带+去重                                     |
| R18-31 | P0     | All route files (task-routes.ts:67 etc) | 路由用 /v1/_ 非 /api/v1/_——§6.3 canonical paths 为 /api/v1/harness-runs 等                                  |
| R18-32 | P1     | http-server/index.ts                    | 无 harness-runs routes——§6.3/§6.8 定义 /api/v1/harness-runs 为 canonical 执行入口；仅有 legacy /v1/tasks    |
| R18-33 | P1     | response-hardening.ts:102-129           | decorateResponseHeaders 无 X-Trace-Id——§6.2 要求 X-Request-Id + X-Trace-Id                                  |
| R18-34 | P1     | websocket-bridge.ts:282-288             | broadcastToTask 不检查 ws.bufferedAmount——§7.1 要求 server-side backpressure(buffer full→drop low-priority) |
| R18-35 | P1     | stream-bridge.ts                        | StreamBridge 无连接 client 追踪/slow-consumer 检测——§7.1 要求 per-connection backpressure+stream_gap event  |
| R18-36 | P1     | structured-logger.ts:42-59              | StructuredLogEntry 有 correlationId 无 causationId——§5.2 ContractEnvelope 要求两者支持 causal chain         |
| R18-37 | P1     | middleware/ (目录)                      | 无 request-deduplication middleware——§4.2 P1 职责明确包含"请求去重"                                         |
| R18-38 | P2     | structured-logger.ts:247-302            | 无最低 log-level 过滤——所有 debug 级别命中 buffer+file；production 无抑制配置                               |
| R18-39 | P2     | channel-gateway-service.ts:468-510      | 外部 provider HTTP 调用(Telegram/Slack/Webhook)无 circuit breaker(§9.1/§7.1)                                |
| R18-40 | P2     | websocket-bridge.ts:210-222             | 无 per-client subscription cap——单 client 可订阅无界 taskIds 导致内存耗尽(§9 isolation)                     |
| R18-41 | P2     | channel-gateway-service.ts:487,541,606  | fetchImpl() 无 timeout——§7.1 要求 default 5s/max 30s                                                        |

### §92 ADR/Contract 终审缺陷

| #      | 严重度 | 文件/位置                                                             | 问题                                                                                                                                                         |
| ------ | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R18-42 | P0     | adr/096-harness-recovery-controller.md:14                             | 引用 "phase 8b" 作 release gate——ADR-094 已修正为 Ring 2 但本 ADR 未同步(§33 three-ring model)                                                               |
| R18-43 | P0     | src/domains/recipes/index.ts:18-27                                    | DomainRecipeSchema 缺 contract 必须字段：risk_profile_ref/guardrail_overlay/recommended_workflow_ids/default_prompt_bundle_ref/acceptance_checklist_ref      |
| R18-44 | P0     | src/domains/domain-specs.ts:18-26                                     | Domain lifecycle states(validated/registered/active/updating/archived)不匹配 contract(validating/certified/canary/active/deprecated/retired)——缺 canary 阶段 |
| R18-45 | P1     | src/domains/domain-specs.ts:55-61                                     | DomainRiskSpec 缺 contract 必须字段：advisory_only/human_accountable/deterministic_hot_path_only/allowed_capability_overrides/required_approval_policies     |
| R18-46 | P1     | contracts/workflow_static_analysis_and_compensation_contract.md:31,34 | StaticCompatibilityIssue 和 WorkflowTemplate 代码库中不存在                                                                                                  |
| R18-47 | P1     | contracts/gateway_streaming_contract.md:26-30                         | Contract 定义 StreamChannel/ProgressChunk/FinalChunk/ErrorChunk——代码用 StreamEventFrame(类型不匹配)                                                         |
| R18-48 | P1     | architecture/05-cross-platform-ui-architecture.md:7                   | UI arch 基线为 v3.2——落后两个大版本(当前 v4.3)；缺五平面/PlanGraphBundle/NodeAttemptReceipt                                                                  |
| R18-49 | P1     | divisions/ 目录                                                       | AGENTS.md 声明 "division definitions live in divisions/" 但目录不存在                                                                                        |
| R18-50 | P1     | adr/109-contract-freeze.md:39                                         | 引用 ADR-110 但 110 不在 v4.3 Contract Freeze Scope——forward reference 到未冻结 ADR                                                                          |
| R18-51 | P2     | adr/104-domain-recipe-twelve-archetypes.md:27                         | 12个 archetypes 与 ADR-105 latency_tier 4级无映射——cross-ADR 语义 gap                                                                                        |
| R18-52 | P2     | contracts/multimodal_gateway_contract.md:9-12                         | 4个 canonical objects 仅为 plain TS interface 非 Zod schema——contract §5 测试要求不满足                                                                      |
| R18-53 | P2     | contracts/capacity_planning_contract.md:8-12                          | CapacitySignal 在 architecture-remediation.ts(shim)非 ops-maturity 模块——canonical type 位置错误                                                             |
| R18-54 | P2     | docs_zh/operations/capacity-planning.md                               | 描述 Pod/PostgreSQL/Redis sizing 但不引用 CapacityForecast/CapacityScenario contract 对象                                                                    |
| R18-55 | P2     | adr/094-harness-durable-execution.md:10                               | OAPEFLIR 部分仍用 "step"——ADR-092 修正为 NodeRun/NodeAttempt                                                                                                 |


### §94 OAPEFLIR Loop/FSM/Assessment 深层缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                                                                             |
| ------ | ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| R19-01 | P0     | stage-transition-fsm.ts (全文件)  | FSM 从未被 OapeflirLoopService.run() 实例化或查询——所有阶段排序为隐式过程代码；FSM 为死代码                                      |
| R19-02 | P0     | stage-transition-fsm.ts:122-129   | FSM 硬阻止所有向后转换——§13 GraphPatch/Replan 即使 FSM 接入也不可能                                                              |
| R19-03 | P0     | oapeflir-loop-service.ts:276-284  | replanDecision 计算后无动作——quality-gate 失败产出决策对象但从未触发重执行/graph patching                                        |
| R19-04 | P1     | oapeflir-loop-service.ts:210-211  | 执行前无 budget reservation——§15.3 要求 LLM/tool 调用前 reserve budget；bridge 直接 fire                                         |
| R19-05 | P1     | final-response.ts:27-48           | FinalResponse 缺 §27 必须字段：audience/runId/limitations/citationsRequired/evidenceRefs/dataClass/redactionApplied/safetyLabels |
| R19-06 | P1     | oapeflir-loop-service.ts (run())  | 全过程零 event emission——§14.3 要求所有 state change 发射 platform._ facts 或 oapeflir.view._ projections                        |
| R19-07 | P1     | assessment-service.ts:65          | routingDecision.division 硬编码 "coding"——永不路由到其他 division(§2.1 Assess routing)                                           |
| R19-08 | P1     | oapeflir-loop-service.ts:405-418  | buildFeedbackSignals 所有 step 硬编码 category:"success"——失败 step 产生虚假正向反馈                                             |
| R19-09 | P1     | runtime-execute-bridge.ts:228-240 | Bridge 委托 runMultiStepOrchestration 内部重新规划——绕过 OAPEFLIR Plan stage 已验证的 PlanGraphBundle                            |
| R19-10 | P2     | stage-transition-fsm.ts:187-195   | recordStageSkipped(stage, reasonCode) 静默丢弃 reasonCode——无存储/证据                                                           |
| R19-11 | P2     | runtime-execute-bridge.ts:103     | validationPassed = record.validationJson!=null——存在≠通过；应解析检查结果                                                        |
| R19-12 | P2     | assessment-service.ts:87-105      | 复杂度仅用 file/blocker/memory 硬编码阈值——无 §32 EvaluationGate 数值评分模型                                                    |
| R19-13 | P2     | oapeflir-loop-service.ts:145-165  | O→A 降级 hardcode confidence:0.5 低于阈值 0.65——保证触发 risk escalation；自放大故障                                             |
| R19-14 | P2     | feedback-signal.ts:4              | FeedbackCategorySchema 缺 blocker/regression 类别——§31 contamination check 和 incident regression 无法表示                       |

### §95 Truth/Routing/RSM/Transition 深层缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R19-15 | P0     | transition-service.ts:500-526                     | TaskTerminalTransitionService.apply() 用非 CAS 方法(updateTaskStatus 等)——TOCTOU race；§25.3 要求 CAS+lease+fencing                                                          |
| R19-16 | P0     | intake-router.ts:348-402                          | IntakeRouter.route() 从 raw text 直接到 workflow/division——跳过 RawInput→TaskDraft→ClarificationSession→ConfirmedTaskSpec→RequestEnvelope(§5.3/§4.2)                         |
| R19-17 | P0     | agent-team-service.ts:56-148                      | AgentTeamService.buildPlan() 无 §19.5 协作不变量：无 delegation depth check(max 3/global 8)、无 permission subsetting(C1)、无 risk_mode guard(C2)、无 budget propagation(C6) |
| R19-18 | P1     | intake-router.ts:286-291                          | IntakeRouteInput 仅 title+request——缺 tenantId/trace_id/idempotency_key/principal/confirmedTaskSpecId(§5.3)                                                                  |
| R19-19 | P1     | transition-service.ts:286-287                     | WorkflowTransitionService.transition() 无 db.transaction() 包裹(TaskTransition 有)——workflow 状态非原子                                                                      |
| R19-20 | P1     | transition-service.ts:296-360                     | Workflow/Session/Execution TransitionService.apply() 不发 tier-1 status event——仅 Task 发射；§28 要求所有状态变更发事件                                                      |
| R19-21 | P1     | agent-team-service.ts:13-21                       | AgentTeamLane 缺 depth/budget_remaining/correlation_id/parent_run_id/domain_id/risk_level/trace_id(§19.5)                                                                    |
| R19-22 | P1     | async-repositories/delegation-repository.ts:57-76 | updateDelegation() 无 CAS/expected-status guard——并发覆写(§25.3)                                                                                                             |
| R19-23 | P1     | runtime-state-machine.ts:319-332                  | assertAuditRef() 仅在 auditRef 提供时验证非空——从不强制要求；§25.3 HarnessRun/SideEffect 转换需强制 auditRef                                                                 |
| R19-24 | P2     | compliance-case-orchestration-service.ts:117-123  | allowRedactedRestrictedTransfer flag 覆盖 deny decision——§23 compliance 应 fail-closed                                                                                       |
| R19-25 | P2     | async-repositories/event-repository.ts:19-68      | insertEvent() 不验证 tenantId——§5.2 ContractEnvelope tenantId 必须；多租户 event 隔离断裂                                                                                    |
| R19-26 | P2     | agent-team-service.ts:146                         | executionLoop 硬编码固定序列——§19 high-risk 需更严格 review loop；无 risk-adaptive 组合                                                                                      |

### §96 UI Tests/Perf/Build 系统缺陷

| #      | 严重度 | 文件/位置                              | 问题                                                                                              |
| ------ | ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R19-27 | P0     | ui/vitest.config.ts:16-19              | 覆盖率阈值 30%/20%——§7.2.6 要求 shared≥90%/ui-core≥80%/features≥70%/apps≥50%                      |
| R19-28 | P0     | ui/.github/workflows/ui-quality.yml:28 | CI 用 Node.js 20——§2.3 要求 Node.js 22 LTS                                                        |
| R19-29 | P0     | ui/.github/workflows/ui-quality.yml    | 无 Lighthouse CI step——§7.1.1/§7.3.1 要求 FCP/LCP/CLS/INP CI 门为 PR-blocking                     |
| R19-30 | P0     | ui/scripts/perf-budget.mjs:6-8         | Budget 用 raw bytes(550KB JS/1200KB total)非 gzip——§7.3.1 要求 <200KB gz main/<100KB gz per route |
| R19-31 | P0     | ui/scripts/perf-budget.mjs             | 无 per-library budget——§7.3.4 要求 ECharts<150KB gz/Monaco<200KB gz 独立 CI 门                    |
| R19-32 | P1     | ui/tests/ (全部)                       | 零 accessibility 测试——§7.2.4 要求 axe-core(Playwright)+VoiceOver；无 axe-core 依赖               |
| R19-33 | P1     | ui/tests/ (全部)                       | 零 visual regression 测试——§7.2.3 要求 Chromatic/Percy                                            |
| R19-34 | P1     | ui/tools/mock-server/src/index.ts      | Mock server 仅3路由内存 stub——§7.2.4 要求 MSW(Mock Service Worker)                                |
| R19-35 | P1     | ui/tools/e2e/src/index.ts              | E2E "tool" 仅为7个场景 data catalog——无 Playwright/Detox runner/assertions                        |
| R19-36 | P1     | ui/turbo.json:7-13                     | typecheck/lint/test 无 outputs——Turborepo 无法缓存(§7.1.1 incremental build)                      |
| R19-37 | P1     | ui/tests/features/flows.test.tsx       | 仅5/28 features 有交互流测试——23个 feature 零覆盖                                                 |
| R19-38 | P2     | ui/tests/ (全部)                       | 无 offline→recovery 集成测试(§7.2.2 断网→排队→恢复→同步→冲突)                                     |
| R19-39 | P2     | ui/tests/ (全部)                       | 无 multi-tab WS SharedWorker 测试(§7.2.2)                                                         |
| R19-40 | P2     | ui/tests/ (全部)                       | 无 SSO login flow e2e(§7.2.2 OIDC→Token→API auth→refresh)                                         |
| R19-41 | P2     | ui/tools/codegen/src/index.ts          | Codegen 仅生成 path 常量——无 OpenAPI/contract-driven DTO type gen(§5.2.3)                         |
| R19-42 | P2     | ui/turbo.json                          | 无 inputs 过滤——所有文件变更触发所有 task 重跑                                                    |

### §97 跨系统集成/平面边界违规

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                                        |
| ------ | ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| R19-43 | P0     | runtime-execute-bridge.ts:228                  | P3 Orchestration 动态导入 ../../../core/runtime/orchestrator/(P4外 src/core/)——跨五平面边界直接耦合                         |
| R19-44 | P0     | execution-outcome-evaluator.ts:12              | P2 AI-Ops(prompt-engine) 直接导入 scale-ecosystem/feedback-loop/(Part VIII)——跨层直接耦合绕过 event bus                     |
| R19-45 | P1     | execution-dispatch-service.ts:15,229           | P4 Execution 内联实例化 HealthService(db,store)——直接耦合 P5 Evidence 内部                                                  |
| R19-46 | P1     | model-routing-service.ts:36                    | Model Gateway(P2) 导入 prompt-engine/eval/ ModelGovernanceSnapshot——兄弟平面耦合应走 contracts/                             |
| R19-47 | P1     | state-evidence/events/projections/ (全部9文件) | 无 projection 消费 dispatch:ticket_created/claimed/decision_recorded 事件——dispatch 事件无投影(P5 盲点)                     |
| R19-48 | P2     | dashboard/metric-aggregator/index.ts           | summarizeTaskMetrics 接受 raw string[] statuses(用"done"/"in_progress")——不匹配 authoritative status("completed"/"running") |
| R19-49 | P2     | dashboard/health-scorer/index.ts:1             | P1 Interaction 直接导入 src/platform/shared/observability/ SystemSituation——应通过 DashboardPort                            |
| R19-50 | P2     | dashboard/alert-router/index.ts                | sortAttentionQueue 无调用者——死代码集成点                                                                                   |
| R19-51 | P2     | runtime-execute-bridge.ts:144                  | extractStepOutputRecords 用 unsafe cast (snapshot as {...})——无类型契约保证字段存在                                         |
| R19-52 | P2     | src/platform/cost-management/index.ts:26       | P2 Control Plane 导入 scale-ecosystem/marketplace/cost-estimation-service——跨层依赖                                         |
### §94 OAPEFLIR Loop/FSM/Assessment 深层缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                                                                             |
| ------ | ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| R19-01 | P0     | stage-transition-fsm.ts (全文件)  | FSM 从未被 OapeflirLoopService.run() 实例化或查询——所有阶段排序为隐式过程代码；FSM 为死代码                                      |
| R19-02 | P0     | stage-transition-fsm.ts:122-129   | FSM 硬阻止所有向后转换——§13 GraphPatch/Replan 即使 FSM 接入也不可能                                                              |
| R19-03 | P0     | oapeflir-loop-service.ts:276-284  | replanDecision 计算后无动作——quality-gate 失败产出决策对象但从未触发重执行/graph patching                                        |
| R19-04 | P1     | oapeflir-loop-service.ts:210-211  | 执行前无 budget reservation——§15.3 要求 LLM/tool 调用前 reserve budget；bridge 直接 fire                                         |
| R19-05 | P1     | final-response.ts:27-48           | FinalResponse 缺 §27 必须字段：audience/runId/limitations/citationsRequired/evidenceRefs/dataClass/redactionApplied/safetyLabels |
| R19-06 | P1     | oapeflir-loop-service.ts (run())  | 全过程零 event emission——§14.3 要求所有 state change 发射 platform._ facts 或 oapeflir.view._ projections                        |
| R19-07 | P1     | assessment-service.ts:65          | routingDecision.division 硬编码 "coding"——永不路由到其他 division(§2.1 Assess routing)                                           |
| R19-08 | P1     | oapeflir-loop-service.ts:405-418  | buildFeedbackSignals 所有 step 硬编码 category:"success"——失败 step 产生虚假正向反馈                                             |
| R19-09 | P1     | runtime-execute-bridge.ts:228-240 | Bridge 委托 runMultiStepOrchestration 内部重新规划——绕过 OAPEFLIR Plan stage 已验证的 PlanGraphBundle                            |
| R19-10 | P2     | stage-transition-fsm.ts:187-195   | recordStageSkipped(stage, reasonCode) 静默丢弃 reasonCode——无存储/证据                                                           |
| R19-11 | P2     | runtime-execute-bridge.ts:103     | validationPassed = record.validationJson!=null——存在≠通过；应解析检查结果                                                        |
| R19-12 | P2     | assessment-service.ts:87-105      | 复杂度仅用 file/blocker/memory 硬编码阈值——无 §32 EvaluationGate 数值评分模型                                                    |
| R19-13 | P2     | oapeflir-loop-service.ts:145-165  | O→A 降级 hardcode confidence:0.5 低于阈值 0.65——保证触发 risk escalation；自放大故障                                             |
| R19-14 | P2     | feedback-signal.ts:4              | FeedbackCategorySchema 缺 blocker/regression 类别——§31 contamination check 和 incident regression 无法表示                       |

### §95 Truth/Routing/RSM/Transition 深层缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                                                                                                                         |
| ------ | ------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R19-15 | P0     | transition-service.ts:500-526                     | TaskTerminalTransitionService.apply() 用非 CAS 方法(updateTaskStatus 等)——TOCTOU race；§25.3 要求 CAS+lease+fencing                                                          |
| R19-16 | P0     | intake-router.ts:348-402                          | IntakeRouter.route() 从 raw text 直接到 workflow/division——跳过 RawInput→TaskDraft→ClarificationSession→ConfirmedTaskSpec→RequestEnvelope(§5.3/§4.2)                         |
| R19-17 | P0     | agent-team-service.ts:56-148                      | AgentTeamService.buildPlan() 无 §19.5 协作不变量：无 delegation depth check(max 3/global 8)、无 permission subsetting(C1)、无 risk_mode guard(C2)、无 budget propagation(C6) |
| R19-18 | P1     | intake-router.ts:286-291                          | IntakeRouteInput 仅 title+request——缺 tenantId/trace_id/idempotency_key/principal/confirmedTaskSpecId(§5.3)                                                                  |
| R19-19 | P1     | transition-service.ts:286-287                     | WorkflowTransitionService.transition() 无 db.transaction() 包裹(TaskTransition 有)——workflow 状态非原子                                                                      |
| R19-20 | P1     | transition-service.ts:296-360                     | Workflow/Session/Execution TransitionService.apply() 不发 tier-1 status event——仅 Task 发射；§28 要求所有状态变更发事件                                                      |
| R19-21 | P1     | agent-team-service.ts:13-21                       | AgentTeamLane 缺 depth/budget_remaining/correlation_id/parent_run_id/domain_id/risk_level/trace_id(§19.5)                                                                    |
| R19-22 | P1     | async-repositories/delegation-repository.ts:57-76 | updateDelegation() 无 CAS/expected-status guard——并发覆写(§25.3)                                                                                                             |
| R19-23 | P1     | runtime-state-machine.ts:319-332                  | assertAuditRef() 仅在 auditRef 提供时验证非空——从不强制要求；§25.3 HarnessRun/SideEffect 转换需强制 auditRef                                                                 |
| R19-24 | P2     | compliance-case-orchestration-service.ts:117-123  | allowRedactedRestrictedTransfer flag 覆盖 deny decision——§23 compliance 应 fail-closed                                                                                       |
| R19-25 | P2     | async-repositories/event-repository.ts:19-68      | insertEvent() 不验证 tenantId——§5.2 ContractEnvelope tenantId 必须；多租户 event 隔离断裂                                                                                    |
| R19-26 | P2     | agent-team-service.ts:146                         | executionLoop 硬编码固定序列——§19 high-risk 需更严格 review loop；无 risk-adaptive 组合                                                                                      |

### §96 UI Tests/Perf/Build 系统缺陷

| #      | 严重度 | 文件/位置                              | 问题                                                                                              |
| ------ | ------ | -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R19-27 | P0     | ui/vitest.config.ts:16-19              | 覆盖率阈值 30%/20%——§7.2.6 要求 shared≥90%/ui-core≥80%/features≥70%/apps≥50%                      |
| R19-28 | P0     | ui/.github/workflows/ui-quality.yml:28 | CI 用 Node.js 20——§2.3 要求 Node.js 22 LTS                                                        |
| R19-29 | P0     | ui/.github/workflows/ui-quality.yml    | 无 Lighthouse CI step——§7.1.1/§7.3.1 要求 FCP/LCP/CLS/INP CI 门为 PR-blocking                     |
| R19-30 | P0     | ui/scripts/perf-budget.mjs:6-8         | Budget 用 raw bytes(550KB JS/1200KB total)非 gzip——§7.3.1 要求 <200KB gz main/<100KB gz per route |
| R19-31 | P0     | ui/scripts/perf-budget.mjs             | 无 per-library budget——§7.3.4 要求 ECharts<150KB gz/Monaco<200KB gz 独立 CI 门                    |
| R19-32 | P1     | ui/tests/ (全部)                       | 零 accessibility 测试——§7.2.4 要求 axe-core(Playwright)+VoiceOver；无 axe-core 依赖               |
| R19-33 | P1     | ui/tests/ (全部)                       | 零 visual regression 测试——§7.2.3 要求 Chromatic/Percy                                            |
| R19-34 | P1     | ui/tools/mock-server/src/index.ts      | Mock server 仅3路由内存 stub——§7.2.4 要求 MSW(Mock Service Worker)                                |
| R19-35 | P1     | ui/tools/e2e/src/index.ts              | E2E "tool" 仅为7个场景 data catalog——无 Playwright/Detox runner/assertions                        |
| R19-36 | P1     | ui/turbo.json:7-13                     | typecheck/lint/test 无 outputs——Turborepo 无法缓存(§7.1.1 incremental build)                      |
| R19-37 | P1     | ui/tests/features/flows.test.tsx       | 仅5/28 features 有交互流测试——23个 feature 零覆盖                                                 |
| R19-38 | P2     | ui/tests/ (全部)                       | 无 offline→recovery 集成测试(§7.2.2 断网→排队→恢复→同步→冲突)                                     |
| R19-39 | P2     | ui/tests/ (全部)                       | 无 multi-tab WS SharedWorker 测试(§7.2.2)                                                         |
| R19-40 | P2     | ui/tests/ (全部)                       | 无 SSO login flow e2e(§7.2.2 OIDC→Token→API auth→refresh)                                         |
| R19-41 | P2     | ui/tools/codegen/src/index.ts          | Codegen 仅生成 path 常量——无 OpenAPI/contract-driven DTO type gen(§5.2.3)                         |
| R19-42 | P2     | ui/turbo.json                          | 无 inputs 过滤——所有文件变更触发所有 task 重跑                                                    |

### §97 跨系统集成/平面边界违规

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                                        |
| ------ | ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| R19-43 | P0     | runtime-execute-bridge.ts:228                  | P3 Orchestration 动态导入 ../../../core/runtime/orchestrator/(P4外 src/core/)——跨五平面边界直接耦合                         |
| R19-44 | P0     | execution-outcome-evaluator.ts:12              | P2 AI-Ops(prompt-engine) 直接导入 scale-ecosystem/feedback-loop/(Part VIII)——跨层直接耦合绕过 event bus                     |
| R19-45 | P1     | execution-dispatch-service.ts:15,229           | P4 Execution 内联实例化 HealthService(db,store)——直接耦合 P5 Evidence 内部                                                  |
| R19-46 | P1     | model-routing-service.ts:36                    | Model Gateway(P2) 导入 prompt-engine/eval/ ModelGovernanceSnapshot——兄弟平面耦合应走 contracts/                             |
| R19-47 | P1     | state-evidence/events/projections/ (全部9文件) | 无 projection 消费 dispatch:ticket_created/claimed/decision_recorded 事件——dispatch 事件无投影(P5 盲点)                     |
| R19-48 | P2     | dashboard/metric-aggregator/index.ts           | summarizeTaskMetrics 接受 raw string[] statuses(用"done"/"in_progress")——不匹配 authoritative status("completed"/"running") |
| R19-49 | P2     | dashboard/health-scorer/index.ts:1             | P1 Interaction 直接导入 src/platform/shared/observability/ SystemSituation——应通过 DashboardPort                            |
| R19-50 | P2     | dashboard/alert-router/index.ts                | sortAttentionQueue 无调用者——死代码集成点                                                                                   |
| R19-51 | P2     | runtime-execute-bridge.ts:144                  | extractStepOutputRecords 用 unsafe cast (snapshot as {...})——无类型契约保证字段存在                                         |
| R19-52 | P2     | src/platform/cost-management/index.ts:26       | P2 Control Plane 导入 scale-ecosystem/marketplace/cost-estimation-service——跨层依赖                                         |

### §99 Planner/Projections/Worker Pool 深层缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                                                                              |
| ------ | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R20-01 | P0     | plan-builder.ts:41,50             | DAG validation result(valid/issues)完全被忽略——cyclic/broken plan 静默使用 fallback orderedSteps 继续                             |
| R20-02 | P0     | plan-dag-validator.ts:64          | 检测到 cycle 时返回原始未排序 steps 作 orderedSteps(非失败)——下游消费无效排序                                                     |
| R20-03 | P0     | worker-drain-protocol.ts (全文件) | Drain 为无状态 receipt factory——无 checkpoint coordination、无 lease release、无 RecoveryWorker 集成(§9 要求先 checkpoint 再释放) |
| R20-04 | P1     | plan-evaluator.ts:23              | 资源估算=steps.length\*1000 天真启发——无 per-step cost/tool cost/parallelism cost(§13)                                            |
| R20-05 | P1     | plan-evaluator.ts                 | 无 parallelism limit check——§13 要求验证并行分支 vs worker pool capacity                                                          |
| R20-06 | P1     | plan-builder.ts:44                | Plan 输出缺 PlanGraphBundle 必须字段：planGraphId/graphVersion/schedulerPolicy/budget/riskProfile/validationReport                |
| R20-07 | P1     | projections/ (全部9文件)          | processedEventIds 为无界 string[] + Array.includes() O(n)——rebuild 长实体退化为 O(n²)                                             |
| R20-08 | P1     | projections/ (全部9文件)          | Shallow spread 后直接修改嵌套对象——破坏前 state 引用，replay 幂等性失效                                                           |
| R20-09 | P1     | workflow-run-projection.ts        | 不处理 workflow_run.created/completed/failed——无法从 run 创建/完成进入对应状态                                                    |
| R20-10 | P1     | governance-projection.ts:204-208  | 未知 approval/decision 事件 fallback 推断为 approval_granted——静默将拒绝视为授权                                                  |
| R20-11 | P1     | worker-drain-protocol.ts:8-14     | WorkerDrainRequest 缺 drainReason；Receipt 缺 forcedHandoffCount/cleanupResult(§9)                                                |
| R20-12 | P1     | worker-drain-protocol.ts:32       | Deadline 用 ISO string > 比较——混合 timezone/format 破坏排序                                                                      |
| R20-13 | P2     | worker-status-projection.ts       | 不处理 worker:registered/deregistered/drain_started——pool 成员变更不可追踪                                                        |
| R20-14 | P2     | tool-usage-projection.ts:224-230  | plugin:invocation_completed 不设 status="completed"——永远停在 "started"                                                           |
| R20-15 | P2     | approval-queue-projection.ts      | 不处理 decision:expired/cancelled——过期审批永远停在 "requested"                                                                   |
| R20-16 | P2     | task-decomposition-service.ts:17  | 每个 step 无条件添加 "read" 作首 tool                                                                                             |
| R20-17 | P2     | worker-registry-service.ts        | listStaleWorkers() 无周期调用——stale worker 不转 dead/不生成 incident(§9)                                                         |

### §100 API Routes / UX 缺陷

| #      | 严重度 | 文件/位置                        | 问题                                                                                 |
| ------ | ------ | -------------------------------- | ------------------------------------------------------------------------------------ |
| R20-18 | P0     | billing-routes.ts:47-59          | Auth bypass——任何非空 Authorization 或 x-api-key header 即跳过 HMAC 签名验证         |
| R20-19 | P0     | billing-routes.ts:36-106         | Handler body 完整重复35行出现在 POST /usage 和 POST /settle 两条路由中——逻辑分叉风险 |
| R20-20 | P1     | incident-routes.ts               | tenantId/principal 从 header 解析后丢弃——incidents 查询无租户隔离                    |
| R20-21 | P1     | incident-routes.ts               | total=incidents.length(slice 后)非实际总数——分页 contract 违反                       |
| R20-22 | P1     | prompt-routes.ts:62              | 404 返回 {bundle:null} 非统一 ErrorEnvelope 结构                                     |
| R20-23 | P1     | prompt-routes.ts:77-84           | deprecate 端点不检查 bundle 是否存在——静默成功                                       |
| R20-24 | P1     | prompt-routes.ts:12              | Zod schema 使用 .passthrough()——允许任意未验证字段进入                               |
| R20-25 | P1     | utils.ts:167-175                 | buildJsonResponse 无 X-Trace-Id header——违反 observability contract                  |
| R20-26 | P2     | dashboard-routes.ts:53-96        | 每请求 new 5个 service 实例(无 DI)——GC 压力 + 无状态共享                             |
| R20-27 | P2     | template-engine/ (全目录)        | 仅16行——无版本/domain/risk 感知                                                      |
| R20-28 | P2     | wizard/ (全目录)                 | 无 step validation/progress persistence/risk preview                                 |
| R20-29 | P2     | onboarding/ (全目录)             | sessions 存储为内存 Map——重启丢失所有进度                                            |
| R20-30 | P2     | incident/prompt/dashboard routes | 均无 cursor pagination——仅 offset/limit 对大数据集性能差                             |

### §101 Graceful Shutdown / Concurrency 缺陷

| #      | 严重度 | 文件/位置                              | 问题                                                                       |
| ------ | ------ | -------------------------------------- | -------------------------------------------------------------------------- |
| R20-31 | P0     | degradation-controller.ts (routeD0)    | 递归调用无 max-depth guard——provider 链构成环时无限递归导致栈溢出          |
| R20-32 | P0     | service-registry.ts (teardownAll)      | Promise.all 并发 teardown——违反 §9 要求的顺序 drain→flush→close            |
| R20-33 | P1     | websocket-bridge.ts                    | WS listeners 不 removeAllListeners on disconnect——listener leak            |
| R20-34 | P1     | websocket-bridge.ts (close)            | close() 无 timeout——misbehaving client 挂起 shutdown                       |
| R20-35 | P1     | stream-bridge.ts                       | 无 dispose()——per-stream maps 无界增长                                     |
| R20-36 | P1     | durable-event-bus.ts                   | 10ms poll interval = 100次/秒/consumer 无自适应 backoff                    |
| R20-37 | P1     | worker-drain-protocol.ts:32            | ISO string > 比较——mixed timezone 破坏排序                                 |
| R20-38 | P1     | cli/api-server.ts (shutdown)           | 缺 DurableEventBus/WS/ServiceRegistry/ProviderPool/process-tracker cleanup |
| R20-39 | P2     | circuit-breaker.ts (failureTimestamps) | 无上限数组——高吞吐场景可达 600k+ entries                                   |
| R20-40 | P2     | service-registry.ts (reset)            | clear 在 teardown 前执行——teardown 中访问 registry 报 undefined            |
| R20-41 | P2     | durable-event-bus.ts (deliveryChains)  | Promise chain 无界增长——长运行进程内存线性递增                             |
| R20-42 | P2     | graceful-shutdown.ts (handlers)        | 按插入逆序执行非依赖感知——顺序脆弱                                         |

### §102 Side-Effect / Eval Gate / Static Analysis 缺陷

| #      | 严重度 | 文件/位置                                   | 问题                                                                                                    |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| R20-43 | P0     | side-effect-manager.ts (全文件)             | 无 ReconciliationWorker/周期 side-effect sweep——仅 apply 不 probe/不对账                                |
| R20-44 | P0     | side-effect-manager.ts                      | 无初始注册阶段(proposed→reserved→committing)和 pre-commit re-validation                                 |
| R20-45 | P1     | workflow-validator.ts                       | 缺 5/12 contract 要求的静态分析检查(resource-bound, auth-scope, idempotency, timeout-budget, data-flow) |
| R20-46 | P1     | workflow-validator.ts (返回类型)            | 结果类型 WorkflowLintReport vs contract 要求的 StaticCompatibilityIssue[]                               |
| R20-47 | P1     | workflow-builder.ts (normalizeGraph)        | 不映射 MinimalWorkflowDefinition 到 PlanGraphBundle——输出缺必须字段                                     |
| R20-48 | P1     | workflow-builder.ts (propagateRisk)         | 用 regex 匹配 tool name 推断 risk——应基于 compensationModel/sideEffectProfile                           |
| R20-49 | P1     | post-execution-quality-gate.ts              | 仅 post-execution gate——§17 要求 pre-release gate 阻止未达标 promotion                                  |
| R20-50 | P1     | connector-framework-service.ts (connectors) | 4个 first-party connectors 全返回 stub 数据——无 callback/webhook 实际 path                              |
| R20-51 | P2     | connector-framework-service.ts              | manifests/bindings 纯内存存储无持久化——重启丢失所有注册                                                 |
| R20-52 | P2     | runtime-state-machine.ts (side-effect FSM)  | 16态 vs contract 定义11态——5态无文档且无对应 contract transition                                        |
| R20-53 | P2     | workflow-builder.ts (analyzeWorstPath)      | 非真实 critical-path 算法——仅 reduce sum 而非 DAG longest path                                          |


### §104 Multi-region / Federation / Tenant 缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                              |
| ------ | ------ | --------------------------------- | --------------------------------------------------------------------------------- |
| R21-01 | P0     | cdc-replication-service.ts:97     | CDC 无冲突解决(LWW+vector clock)——事件复制无 merge strategy                       |
| R21-02 | P0     | multi-region/ (全目录)            | 无 split-brain 检测/fencing epoch——failover 无隔离令牌                            |
| R21-03 | P0     | failover-controller/index.ts:17   | 无 FailoverReconciliationJob——resolveRegionFailover 是无状态纯函数无重试/对账循环 |
| R21-04 | P0     | region-health-check-service.ts:92 | 无 per-region circuit breaker 状态机(closed/open/half-open)                       |
| R21-05 | P0     | multi-region/ (全目录)            | 无读写分离——无 read replica/write routing/read-after-write 一致性                 |
| R21-06 | P0     | multi-region/ (全目录)            | RPO<1min/RTO<30s 未强制——CDC 无 lag 监控,failover 无计时强制                      |
| R21-07 | P0     | federation/ (目录不存在)          | Federation 模块完全缺失——FederationGateway/跨组织信任/能力委托/审计轨迹均无       |
| R21-08 | P0     | tenant-platform-service.ts:220    | 无资源配额+抢占——超额时无法驱逐低优先级租户负载                                   |
| R21-09 | P0     | tenant-platform/ (全目录)         | 无 fair scheduling——无加权公平队列/优先级队列/租户感知调度                        |
| R21-10 | P0     | tenant-platform/ (全目录)         | 无 per-tenant SLO 定义和强制                                                      |

### §105 Ops-maturity 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                           |
| ------ | ------ | ----------------------------------------- | ------------------------------------------------------------------------------ |
| R21-11 | P1     | explanation-pipeline-service.ts:56        | ExplanationBundle 无 versionLockRef——决策无法绑定产生它的精确模型/prompt 版本  |
| R21-12 | P1     | changepoint-detector/index.ts:26          | 仅单窗口(24h baseline+3h recent)——spec 要求多窗口(1h/6h/24h/7d)                |
| R21-13 | P1     | cross-agent-analyzer/index.ts:40          | 用硬编码线性公式算 composite score——无统计 changepoint/显著性检验              |
| R21-14 | P1     | changepoint-detector/index.ts:88          | 无统计 changepoint 算法(CUSUM/Bayesian/PELT)——仅均值对比+固定阈值              |
| R21-15 | P1     | edge-runtime-sync-service.ts:103          | Edge 执行无 risk gate——离线执行跳过所有风险评估                                |
| R21-16 | P1     | edge-runtime-sync-service.ts:137          | Conflict resolution 永远 "merge" 但无实际 merge 逻辑——冲突 envelope 直接接受   |
| R21-17 | P1     | chaos-experiment-scheduler.ts:155         | injectFault() 是 no-op stub——返回 fault config 不执行注入,无 blast radius 控制 |
| R21-18 | P1     | chaos-experiment-scheduler.ts:148         | steady-state results 可重复累积——重复 hypothesis 评估导致提前错误完成          |
| R21-19 | P1     | time-travel-debug-service.ts:193          | getVariableState 累积所有历史值不去重——应返回时间点最新值                      |
| R21-20 | P1     | auto-stop-loss-service.ts:619             | 升级级别基于 string.includes("emergency")——脆弱文本匹配非实际严重度            |
| R21-21 | P1     | ha-program-service.ts:186                 | overallStatus 三元条件永远 true——.some() 检查组件存在而非检查不健康组件        |
| R21-22 | P2     | data-replicator/index.ts:246              | pendingCount=events.length 而非实际失败数                                      |
| R21-23 | P2     | data-replicator/index.ts:225              | 重试成功时 lastSequence 双重计数                                               |
| R21-24 | P2     | data-replicator/index.ts:112              | ReplicationEventBuffer timer flush 返回值无消费——事件丢失                      |
| R21-25 | P2     | region-health-check-service.ts:330        | determineStatus 用引用相等比较 metrics——永远不匹配                             |
| R21-26 | P2     | edge-runtime-sync-service.ts:109          | .reverse() 导致低优先级先处理——违反同步策略                                    |
| R21-27 | P2     | compliance-report-pipeline-service.ts:119 | 迟签(signed_at > due)被视为 not_attested_expired——无 "signed_late" 状态        |

### §106 Org-governance / Domains / SDK / Plugins 缺陷

| #      | 严重度 | 文件/位置                                   | 问题                                                                                              |
| ------ | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R21-28 | P0     | org-governance-saga.ts                      | Saga 是 stub——分类步骤但从不执行 prepare/commit/compensate/audit,部分完成无补偿                   |
| R21-29 | P0     | client-sdk/api-client.ts                    | 无 ContractEnvelope 实现——§5.2 要求所有跨平面调用使用含 schemaVersion/commandId/idempotencyKey 等 |
| R21-30 | P0     | plugin-definition.ts:144-148                | definePlugin 检查签名字段存在但从不验证密码学签名——插件信任无意义                                 |
| R21-31 | P0     | domain-model.ts                             | 缺 canary 生命周期状态——spec 要求 draft→canary→active→deprecated→archived                         |
| R21-32 | P0     | evidence-collector.ts                       | Evidence 纯内存(Map),无持久化/hash chain/防篡改——spec 要求 tamper-proof 审计证据                  |
| R21-33 | P1     | api-client.ts:208                           | RetryableApiClient 重试所有非 ok 响应含 4xx——应仅重试 5xx/429/网络错误                            |
| R21-34 | P1     | plugins/index.ts                            | 生命周期 registered→loaded→active→inactive 缺 validated 和 suspended 状态                         |
| R21-35 | P1     | plugin-spi.ts                               | SPI 类型含 retriever/validator/planner 但缺 tool/evaluator——与 plugin-sdk PluginDefinition 不一致 |
| R21-36 | P1     | escalation/index.ts:158                     | 仅匹配首条规则——无多级升级链/无审批步骤超时                                                       |
| R21-37 | P1     | admin-sdk/index.ts                          | 极薄 wrapper——缺租户管理/策略管理/域生命周期/rollout 控制                                         |
| R21-38 | P1     | plugin-test-harness.ts:196                  | executePlugin 全是 mock 硬编码返回;timeoutMs 存储但从不强制                                       |
| R21-39 | P1     | chinese-wall-access-saga.ts                 | Stub saga——同 OrgGovernanceSaga,无实际编排/补偿                                                   |
| R21-40 | P1     | domain-registry-service.ts:76               | activate() 仅允许从 "registered" 转换——无 canary 部署门                                           |
| R21-41 | P2     | governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo >= 0 永远 true——死逻辑                                                           |
| R21-42 | P2     | route-engine/index.ts:256                   | 硬编码 FX rate 7.2 USD→CNY——应用汇率服务或配置                                                    |
| R21-43 | P2     | domain-smoke-test.ts                        | 无实际运行时集成测试——仅验证 config 结构                                                          |
| R21-44 | P2     | api-client.ts                               | 无版本握手/无幂等 key/无事件订阅能力                                                              |
| R21-45 | P2     | builtin-plugin-registry.ts                  | Plugin factories 硬编码——无动态加载/无 marketplace/无认证流程                                     |
| R21-46 | P2     | plugin-definition.ts                        | sbomRef 接受但从不验证——无安全扫描                                                                |

### §107 Config Center / Bootstrap / Tests 缺陷

| #      | 严重度 | 文件/位置                                   | 问题                                                                                          |
| ------ | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R21-47 | P0     | config-center/ (缺失)                       | ConfigImpactAnalyzer 完全未实现——§24.4 要求为高风险 config publish 强制门禁                   |
| R21-48 | P0     | config-drift-reconciler.ts:21-52            | Drift 不生成 config.drift_detected incident,安全/预算/egress/sandbox 类 drift 不 fail-closed  |
| R21-49 | P0     | config/bootstrap/default.json               | 缺 dependencyOrder/healthCheckTimeout/degradationPolicy/readinessGates                        |
| R21-50 | P0     | config-rollout-service.ts:44-51             | Canary 阶段与 spec 不匹配(5%→25%→50%→100% vs spec 的 canary→30min→10%→full)                   |
| R21-51 | P0     | config-rollout-service.ts (缺失)            | Rollout 无 guardrail metrics(max_error_rate/latency_regression 等)——无自动回滚                |
| R21-52 | P1     | hierarchical-config-loader.ts:16-20         | 层级缺 environment 层,用 task_type 替代 runtime_dynamic                                       |
| R21-53 | P1     | config-center/ (缺失)                       | 无4种 config lifecycle 类型(admission_locked/checkpoint_revalidated/hot_reloadable/emergency) |
| R21-54 | P1     | platform-architecture-bootstrap.ts:128-148  | 无 health check before ready——服务注册后立即可用无健康探针                                    |
| R21-55 | P1     | platform-architecture-bootstrap.ts:128-148  | 无 graceful degradation——任何 registry.get() 抛异常则全部 bootstrap 失败                      |
| R21-56 | P1     | config/runtime/default.json                 | 无 configVersion 字段——不支持版本追踪和回滚                                                   |
| R21-57 | P1     | golden/config-file-generation.test.ts:71    | 断言 semver 格式但实现产生 hex hash——catch 块 assert.ok(true) 静默吞噬失败                    |
| R21-58 | P1     | golden/config-file-generation.test.ts:30-75 | 两个 golden test 全在 catch 中 assert(true)——schema 验证失败被静默忽略                        |
| R21-59 | P1     | config-store.ts:116                         | Change listener 用 !== 引用相等比较对象——结构相同的新对象永远触发                             |
| R21-60 | P2     | config-override-governance.ts:314-318       | Dead code——!validation.allowed 已在310行 return,此分支不可达                                  |
| R21-61 | P2     | config-rollout-service.ts:134               | startRollout targetPercentage=100 跳过整个 canary 进程直接返回 FULL                           |
| R21-62 | P2     | config/gateways/default.json                | 仅 defaultGateway+sseEnabled——缺 rate limit/CORS/auth/size limits                             |
| R21-63 | P2     | config-center/index.ts                      | 未导出 drift-reconciler/config-store/config-loader——消费者不可见                              |

### §108 Contract 文档 vs 实现偏差

| #      | 严重度 | 文件/位置                             | 问题                                                                                                   |
| ------ | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| R21-64 | P1     | rollout-record.ts:3-12                | Rollout level 与 release_rollout contract 不匹配——缺 evaluate_0/stable_75/stable_100,多 suggest/shadow |
| R21-65 | P1     | improvement-candidate.ts:13-23        | Schema 与 contract 完全不同——缺 learningObjectId/source enum/targetScope/guardrails[]                  |
| R21-66 | P1     | rollout-record.ts:27-38               | RolloutRecord 缺 triggeredBy/metrics(errorRate/latencyP99)/auditContext                                |
| R21-67 | P1     | rollout-record.ts:13-25               | 状态机与 contract 不匹配——缺 candidate_created/under_review/evaluation_enabled/released                |
| R21-68 | P1     | artifact-model.ts:3-19                | ArtifactRecord 字段集完全偏离 contract——缺 planId/refs/publishStatus/metadata                          |
| R21-69 | P1     | artifact-model.ts:3-19                | ArtifactType 无 OAPEFLIR 类型(evidence_bundle/timeline_export/workflow_checkpoint 等)                  |
| R21-70 | P1     | artifact-model.ts:79                  | BundleType 仅 incident_bundle 部分匹配 contract——缺 task_result/promotion_evidence/canary_metrics      |
| R21-71 | P1     | artifact-model.ts:81                  | publishStatus lifecycle preview→archived 变为 review→recalled——非 contract 值                          |
| R21-72 | P2     | fingerprint-builder/index.ts:3-17     | BehaviorFingerprint 缺 subject_type/baseline_ref 字段                                                  |
| R21-73 | P2     | changepoint-detector/index.ts:19      | Drift response actions 缺 throttle/downgrade/rollback/freeze——仅有 observe/require_review/pause        |
| R21-74 | P2     | drift-detection/ (全目录)             | Contract canonical objects DriftSignal/DriftResponsePlan 无实现——仅有 DriftSample                      |
| R21-75 | P2     | context-compaction-service.ts:229-233 | CompactionRecord 缺 covered_message_range                                                              |
| R21-76 | P2     | context-compaction-service.ts:78-89   | FeedbackSignal/LearningObject 摘要未列为 protected_parts——可被压缩删除                                 |
| R21-77 | P2     | context-compaction-service.ts:279-289 | kvCacheFixedPrefixCacheKey 声明但从不填充                                                              |
| R21-78 | P2     | stream-bridge.ts                      | 无 transport state tracking(connected/reconnecting/failed)——违反 gateway_streaming §10                 |

### §110 UI Shared Packages 深层缺陷

| #      | 严重度 | 文件/位置                              | 问题                                                                                          |
| ------ | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| R22-01 | P0     | auth/token-manager.ts:4                | Token 存储在 JS 变量中——刷新即丢失,无安全存储集成                                             |
| R22-02 | P0     | auth/auth-service.ts:36-39             | handleSsoCallback 从 URL 直读 token——无 PKCE(code_verifier/code_challenge/authorization code) |
| R22-03 | P0     | platform/web-platform-adapter.ts:9-13  | readSecureValue/writeSecureValue 用 localStorage——XSS 可读 token,§6 明确禁止                  |
| R22-04 | P0     | api-client/ws-client.ts:100-104        | onclose 设 "reconnecting" 但从不实际重连——无重连逻辑/指数退避/重试定时器                      |
| R22-05 | P0     | api-client/ws-client.ts:88             | Auth token 作为 URL query param——暴露在日志/代理/浏览器历史中                                 |
| R22-06 | P0     | web/feature-registry.ts:1-27           | 27个 feature 全静态导入无 lazy loading——违反 §10 bundle<200KB                                 |
| R22-07 | P0     | api-client/interceptors.ts:62-76       | Offline queue interceptor 入队后仍放行原始请求——请求会网络失败                                |
| R22-08 | P1     | state/stores/ (全部4个)                | Zustand stores 无 middleware(persist/devtools/immer)——§4 要求全部三种                         |
| R22-09 | P1     | auth/auth-service.ts:7-14              | login() 无 token refresh 逻辑——§6 要求 sliding-window 刷新                                    |
| R22-10 | P1     | auth/session-guard.ts                  | 无 session timeout warning——过期直接抛异常无预警                                              |
| R22-11 | P1     | api-client/ws-client.ts:73-170         | 无 heartbeat/ping-pong——静默断开不可检测                                                      |
| R22-12 | P1     | api-client/interceptors.ts:29-37       | Auth interceptor 捕获静态 string token——refresh 后发送过期 token                              |
| R22-13 | P1     | web/app-shell.tsx:58-108               | 无 per-feature error boundary——单 feature crash 击穿全应用                                    |
| R22-14 | P1     | web/app-shell.tsx:8-22                 | demoGuardContext 硬编码全权限——生产环境绕过真实 auth                                          |
| R22-15 | P1     | web/public/aa-sw.js:27-31              | ServiceWorker sync handler 是 no-op——§7 要求 background sync replay offline queue             |
| R22-16 | P1     | sync/offline-queue.ts:19-21            | enqueue 不 await readyPromise——IndexedDB 水合可覆盖已入队项                                   |
| R22-17 | P1     | sync/conflict-resolver.ts:15-26        | mergeValues shallow spread local wins——无 LWW timestamp/OT                                    |
| R22-18 | P1     | telemetry/index.ts:16-47               | 仅 structured event——缺 performance marks/error boundary reporting/user journey               |
| R22-19 | P1     | telemetry/index.ts:78-92               | OTLP exporter 把 logs 放 scopeMetrics[].logs——无效格式,collector 会丢弃                       |
| R22-20 | P1     | web/runtime.ts:44-46                   | wsClient 创建忽略 config.wsUrl——WS URL 从不传给 connect()                                     |
| R22-21 | P1     | tauri-macos/src-tauri/src/lib.rs:16-20 | 仅注册3命令,TS bridge 调用12+命令——运行时全部 "command not found"                             |
| R22-22 | P1     | tauri-linux/src-tauri/src/lib.rs:16-20 | 同 tauri-macos——仅3命令 vs 12+ expected                                                       |
| R22-23 | P1     | state/index.ts:80                      | 硬编码 access_token=ui-runtime-access 在生产可达路径——mock token 用于真实 API                 |
| R22-24 | P1     | web/app-shell.tsx:100-104              | 无 shell lifecycle phases(boot→auth→load→render→idle)——feature 立即渲染无等待 auth            |
| R22-25 | P2     | web/vite.config.ts:20-21               | 所有 features 打入单一 chunk——应 per-route code split                                         |
| R22-26 | P2     | api-client/ws-event-router.ts:51-94    | 事件路由用 plain string——无 discriminated union 编译期穷尽检查                                |
| R22-27 | P2     | sync/sync-coordinator.ts:33-38         | flush() 清空队列但从不发送到服务器——离线 mutation 静默丢弃                                    |
| R22-28 | P2     | web/public/aa-sw.js:9-24               | SW 缓存所有 GET(含 API)——陈旧 API 响应永久从缓存提供                                          |
| R22-29 | P2     | mobile/App.tsx:5                       | Platform 硬编码 "android"——iOS 用户获得错误适配器                                             |
| R22-30 | P2     | electron-win/src/main.ts:1-41          | Electron 主进程仅配置——无 BrowserWindow/IPC handler/auto-update                               |

### §111 Event Bus / State / Execution 深层缺陷

| #      | 严重度 | 文件/位置                                           | 问题                                                              |
| ------ | ------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| R22-31 | P0     | transactional-event-appender.ts                     | Truth table 未在同一事务更新——event+truth 非原子违反 §25.2        |
| R22-32 | P0     | cas/cas-service.ts                                  | CAS store 纯内存 Map——重启丢失,§8 要求持久化权威存储              |
| R22-33 | P0     | dlq-service.ts (markRetryExhausted)                 | 将 status 设回 "pending" 而非终态——耗尽项重入处理队列             |
| R22-34 | P0     | transition-service.ts (TaskTerminalTransition)      | Terminal transition 无 CAS——并发竞态可覆盖状态                    |
| R22-35 | P0     | budget-allocator.ts (settle)                        | Ledger version 内存自增无 CAS 校验——并发 settle 可覆盖            |
| R22-36 | P0     | degradation-controller.ts (getFallbackCandidates)   | 永远返回[]——D1 fallback 是死代码,立即升级到 D2                    |
| R22-37 | P0     | unified-chat-provider.ts (streaming)                | Streaming path 绕过 circuit breaker——失败不计入,无保护            |
| R22-38 | P1     | durable-event-bus.ts                                | 无 per-aggregate 有序投递——§7 要求按 aggregateId 有序             |
| R22-39 | P1     | cas/fencing-token-service.ts                        | validateFencingToken 按"-"split 但 ID 可含"-"——解析错误           |
| R22-40 | P1     | cas/fencing-token-service.ts (acquireFence)         | expiresAt 永远 null——过期 fence 永久阻塞新获取                    |
| R22-41 | P1     | cas/fencing-token-service.ts                        | static activeFences 是进程本地 Map——非分布式,违反分布式 fencing   |
| R22-42 | P1     | durable-event-bus.ts (retry)                        | attempt <= MAX 执行 MAX+1 次——off-by-one                          |
| R22-43 | P1     | budget-allocator.ts                                 | 无层级预算(platform→domain→task)——仅 flat ledger                  |
| R22-44 | P1     | budget-allocator.ts                                 | 无 watermark alerts                                               |
| R22-45 | P1     | circuit-breaker.ts (getState)                       | 读状态有副作用(open→half_open 转换)——side-effecting getter        |
| R22-46 | P1     | circuit-breaker.ts (getRecentFailureRate)           | (failures/windowSec)\*10 公式——3次/60s=50% 过易 trip              |
| R22-47 | P1     | failure-classification.ts                           | 用 L1/L2/L3 而非 spec 的 transient/permanent/unknown              |
| R22-48 | P1     | execution-lease-service-async.ts (releaseLeaseSync) | 不检查 lease.status !== "active"——可释放已释放的 lease            |
| R22-49 | P2     | durable-event-bus.ts (DLQ)                          | 标记 "failed" 非 "dead_lettered"——不与 DlqService 集成            |
| R22-50 | P2     | dlq-service.ts (scheduleRetry)                      | 不检查 maxRetries 即自增 retryCount——可超限重试                   |
| R22-51 | P2     | layered-event-inbox.ts (drain)                      | Cursor 跳过 filtered-out events——limit 满时消费者可能错过相关事件 |
| R22-52 | P2     | state-transition-machine.ts (assertTransition)      | 允许 no-op(current===next)——与 RSM 行为不一致                     |

### §112 UI Feature Packages 缺陷

| #      | 严重度 | 文件/位置                                          | 问题                                                                                  |
| ------ | ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R22-53 | P0     | features/task-cockpit/web/index.tsx:47-53          | 缺 pause/cancel 按钮——spec 要求 pause/resume/cancel/retry                             |
| R22-54 | P0     | features/task-cockpit/web/index.tsx                | 无 resource usage 面板                                                                |
| R22-55 | P0     | features/workflow-cockpit/web/index.tsx:34         | 无 DAG 可视化——label 说"DAG"但渲染 flat KeyValueTable                                 |
| R22-56 | P0     | features/workflow-cockpit/web/index.tsx            | 缺 parallel branch display 和 error highlighting                                      |
| R22-57 | P0     | features/hitl/hooks/index.ts:5-12                  | 静态 stub——返回硬编码3项,缺 inline approval/bulk ops/SLA countdown/escalation display |
| R22-58 | P0     | features/approval/hooks/index.ts                   | 缺多级审批/timeout 处理/batch approve-reject——仅支持单级 approve/reject/delegate      |
| R22-59 | P0     | features/conversation/web/index.tsx                | 缺 streaming responses/code syntax highlighting/file attachments                      |
| R22-60 | P0     | features/governance-compliance/hooks/index.ts:5-12 | 静态 stub——缺 policy editor/approval queue/audit log/compliance dashboard             |
| R22-61 | P1     | features/analytics/web/index.tsx                   | 缺 time-range selector/drill-down/export/pie chart                                    |
| R22-62 | P1     | features/task-cockpit/hooks/index.ts:5-15          | VM 无 retry 动作方法                                                                  |
| R22-63 | P1     | features/workflow-cockpit/hooks/index.ts:5-16      | VM 无 cancel 动作                                                                     |
| R22-64 | P1     | features/takeover/hooks/index.ts:1-13              | 静态 stub——无查询/状态变更/实际接管功能                                               |
| R22-65 | P1     | tests/features/structure.test.ts:10                | 期望28个包但 registry.test.ts 期望27个——计数不匹配                                    |
| R22-66 | P1     | features/approval/hooks/index.ts:86-97             | delegate 仅追加 history 不修改审批状态                                                |
| R22-67 | P2     | ui-core/components/index.ts                        | 缺 DAGVisualization/TimelineChart/SLACountdown/CodeBlock/FileAttachment/PieChart 组件 |
| R22-68 | P2     | tests/features/                                    | 无 ViewModel 行为测试——全是结构/doc-alignment 测试,零业务逻辑覆盖                     |


### §114 NL Gateway / Interaction / Autonomy 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                 |
| ------ | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| R23-01 | P0     | nl-gateway/index.ts:722-762                     | 未确认高风险 TaskSpec 即生成 RequestEnvelope——§39.6 要求仅 confirmed 才可 dispatch   |
| R23-02 | P0     | proactive-agent/index.ts:316-322                | medium/high risk 允许 auto_execute——§41.1 要求 medium+ 走 suggestion mode            |
| R23-03 | P0     | autonomy/level-manager/index.ts:3-9             | AUTONOMY_LEVEL_ORDER frozen 在 full_auto 后——frozen 被视为更高级别导致降级判定为升级 |
| R23-04 | P0     | goal-decomposer/index.ts:326-349                | 检测到循环依赖仅 warning 不拒绝——§40.2 要求环即拒绝报错                              |
| R23-05 | P1     | proactive-agent/index.ts:249-331                | evaluate() 无 trust score/autonomy level 门控——§42.5 要求 semi_auto+ 才允许触发      |
| R23-06 | P1     | autonomy/promotion-engine/index.ts:14-38        | shouldPromote=true 无审批——§42.2 要求 domain_owner/platform_team 审批                |
| R23-07 | P1     | autonomy/index.ts:214-215                       | P0 incident 设 "frozen" 而非 spec 的 "suggestion"                                    |
| R23-08 | P1     | autonomy/index.ts:218-228                       | P2/P3 incident 也 freeze——spec 仅 P0/P1 触发降级                                     |
| R23-09 | P1     | dashboard/dashboard-websocket-server.ts:106-140 | registerClient 无 auth/tenantId——WS 订阅无租户过滤                                   |
| R23-10 | P1     | nl-gateway/nl-gateway-config-loader.ts:69-70    | 置信阈值 0.7 vs spec 要求 0.80——0.7-0.79 绕过澄清                                    |
| R23-11 | P1     | goal-decomposer/llm-plan-generator.ts:48-77     | LLM 计划仅 shape 验证——缺 DAG/capability/risk/budget propagation 验证                |
| R23-12 | P1     | proactive-agent/index.ts:416-421                | detectFeedbackLoop 报告的 triggerIds 不完整(DFS stack 被 backtrack 清空)             |
| R23-13 | P2     | nl-gateway/index.ts:1-2                         | wildcard re-export shadows named export detectAmbiguity——外部消费者不可达            |
| R23-14 | P2     | dashboard/dashboard-websocket-server.ts:330-346 | heartbeat timeout 设 isConnected=false 但不从 map 移除——stale 无限累积               |
| R23-15 | P2     | ux/ux-event-tracking-service.ts:122             | 硬编码 eventType "test:many_events" as any 泄入生产                                  |
| R23-16 | P2     | ux/conversation-history-service.ts:235-237      | listUserSessions 无 tenant 过滤——读全部租户后客户端过滤                              |
| R23-17 | P2     | autonomy/index.ts:280-291                       | Trust score 用全量累计非 90d 滑动窗口                                                |
| R23-18 | P2     | goal-decomposer/index.ts:343                    | depthUsed 永远0——无递归子分解,层次化分解不实际工作                                   |
| R23-19 | P2     | nl-gateway/index.ts:463-478                     | 低风险任务跳过 "Confirming" 直达 "Executing"——违反状态机                             |

### §115 IAM / Security / Sandbox 缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                            |
| ------ | ------ | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| R23-20 | P0     | compliance/encryption/index.ts:61-62           | protectValue 用 base64url 编码伪装加密——零机密性,任何人可 decode                |
| R23-21 | P0     | gcp-secret-manager-http-secret-provider.ts:184 | extractSecretName 取 parts[-1] 得到 version 而非 secret name——获取错误密钥      |
| R23-22 | P1     | web-fetch.ts:141-165                           | 无协议限制——file:///data:///ftp: 绕过 SSRF 防护                                 |
| R23-23 | P1     | web-fetch.ts:156                               | DNS rebinding——解析时检查 IP 但 fetch 时 DNS 可指向内网                         |
| R23-24 | P1     | aws-kms-http-secret-provider.ts:128-133        | SigV4 credential scope 缺 date prefix——签名永远失败,AWS KMS 不可用              |
| R23-25 | P1     | aws-kms-http-secret-provider.ts:356            | KMS Decrypt 发 DynamoDB 格式 CiphertextBlob——KMS JSON API 期望 base64 string    |
| R23-26 | P1     | gcp-secret-manager-http-secret-provider.ts:211 | URL 用未清洗的 project/secret/version——path traversal 可访问越权密钥            |
| R23-27 | P1     | shadow-snapshot-service.ts:197,431             | gitBinary 选项接受任意路径无验证——可执行任意二进制                              |
| R23-28 | P1     | web-search.ts:117                              | extractSearchResults 中 new URL(url) 对畸形 URL 抛异常未捕获——crash search tool |
| R23-29 | P1     | compliance/encryption/index.ts:65-66           | Key fingerprint 仅 48bits(12 hex)——碰撞风险导致错误 keyRef 解密                 |
| R23-30 | P2     | skill-governance-service.ts:409                | LIKE 模式注入——user tag 中%和\_未转义                                           |
| R23-31 | P2     | edit-snapshot-service.ts:37-38                 | 无界内存 Map(edit history)——长会话 OOM                                          |
| R23-32 | P2     | lineage/index.ts:62                            | cloneMetadata shallow clone——嵌套对象共享引用可变异历史                         |

### §116 Harness / Prompt Engine / Learn / Improve 缺陷

| #      | 严重度 | 文件/位置                                            | 问题                                                                      |
| ------ | ------ | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| R23-33 | P0     | harness/hitl-runtime.ts:3                            | HITL 仅 approved/rejected——缺 edit/delegate/escalate(5能力中缺3)          |
| R23-34 | P0     | harness/hitl-runtime.ts:41                           | resolve() 无幂等/双重解析防护——已解析请求可重复变更                       |
| R23-35 | P0     | harness/recovery-controller.ts:4                     | 无 retry budget——无计数/退避/耗尽检查,可无限重试                          |
| R23-36 | P0     | harness/recovery-controller.ts:26-27                 | tool_timeout 立即 resume 无记录——违反 INV-STATE-001 证据追踪              |
| R23-37 | P0     | learn/learning-object-model.ts:13                    | 缺 quarantine 生命周期——无 untrusted/validating/quarantined 状态          |
| R23-38 | P0     | learn/learning-object-validator.ts:24-61             | 无 PII/taint 检查——仅验证 evidence count 和 confidence floor              |
| R23-39 | P1     | harness/index.ts:39-55                               | HarnessRunStatus 缺 cancelled(有 aborted 但语义不同)                      |
| R23-40 | P1     | guardrail-vibration-breaker.ts:34                    | 仅计连续相同 signature——交替签名永不 trip;无时间窗口                      |
| R23-41 | P1     | guardrail-vibration-breaker.ts:19-48                 | VibrationBreaker 从未集成到 GuardrailEngine/HarnessRuntimeService——死代码 |
| R23-42 | P1     | knowledge-promotion-service.ts:72                    | promote() 无审批门——validated 直接 auto-promote                           |
| R23-43 | P1     | improve-rollout/index.ts:18-19                       | Rollout levels 非 L0-L5——用 shadow/canary_5/partial_25 等                 |
| R23-44 | P1     | improve-rollout/auto-rollback-service.ts:37          | evaluate() 不触发实际 rollback——返回决策但不变更状态                      |
| R23-45 | P1     | improve-rollout/improvement-candidate-registry.ts:17 | 纯内存 Map 无持久化——重启丢失所有候选                                     |
| R23-46 | P1     | prompt-engine/rollout/index.ts:6                     | PromptRolloutMode 仅3阶段(off/suggest/shadow)——缺 canary/partial/stable   |
| R23-47 | P1     | prompt-engine/eval/llm-eval-service.ts:356-358       | A/B test 用硬编码 mock scores 0.85/0.90——统计显著性基于伪造数据           |
| R23-48 | P1     | prompt-engine/registry/hierarchical-registry.ts:50   | 4层(global→domain→pack→task-type) vs spec 3层(platform→domain→task)       |
| R23-49 | P2     | harness/index.ts:315                                 | startedAt===completedAt(同一 nowIso)——步骤时长永远0                       |
| R23-50 | P2     | harness/hitl-runtime.ts:17-18                        | HITL 请求纯内存 Map 无 TTL——pending 永不过期                              |
| R23-51 | P2     | improve-rollout/rollout-state-machine.ts:18-29       | 允许自转换(draft→draft)——绕过 guardrails 创建误导审计事件                 |
| R23-52 | P2     | improve-rollout/canary-traffic-router.ts:29-34       | Hash 函数分布偏斜——短 ID 聚集在窄范围                                     |
| R23-53 | P2     | escalation/index.ts:22-50                            | EscalationService 无消费者——决策不路由到 HITL/panic controller            |
| R23-54 | P2     | prompt-injection-guard.ts:328-329                    | 输出含任何 URL 即 block——合法模型输出含链接被误拦截                       |

### §117 Contract 深层偏差（typed_event_bus / sandbox_auth / hitl / cost_budget / platform_panic）

| #      | 严重度 | 文件/位置                            | 问题                                                                                                                      |
| ------ | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| R23-55 | P0     | typed-event-payloads.ts              | Contract 要求15个 OAPEFLIR payload 类型——全部不存在                                                                       |
| R23-56 | P0     | typed-event-bus.ts:32                | 无 `<stage>:<event>` 格式事件(observe:/assess:/plan:/execute:/feedback:/learn:/improve:/release:)                         |
| R23-57 | P0     | typed-event-payloads.ts:184          | PluginIsolationEventPayload 缺 phase 字段且名称为 PluginLifecycleEventPayload                                             |
| R23-58 | P1     | sandbox-policy.ts:69-90              | SandboxPolicy 缺 filesystem_rules/network_rules/process_rules/created_at                                                  |
| R23-59 | P1     | (缺失)                               | SandboxCapabilityProfile 类型完全不存在                                                                                   |
| R23-60 | P1     | (缺失)                               | AuthSession/AuthProviderBinding 类型不存在——认证会话模型未实现                                                            |
| R23-61 | P1     | budget-guard.ts:12-18                | BudgetPolicy 用废弃字段(maxTaskCostUsd/maxDailyCostUsd)——contract 已将其降为 billing-only                                 |
| R23-62 | P1     | budget-guard.ts:17                   | runtime_mode 仅3值 vs contract 8值——缺5种模式                                                                             |
| R23-63 | P1     | (缺失)                               | CostEvent 运行时类型不存在——仅在 DB schema 中                                                                             |
| R23-64 | P1     | (缺失)                               | StageBudgetPolicy(per-OAPEFLIR-stage 预算)不存在                                                                          |
| R23-65 | P1     | platform-panic-service.ts:16-26      | PanicDirective 缺 scope_ref/expires_at——无法自动过期                                                                      |
| R23-66 | P1     | (缺失)                               | PanicDrillRecord 不存在——panic drill 能力未实现                                                                           |
| R23-67 | P1     | resume-protocol/index.ts:3-11        | ResumePlan 缺6/9必须字段(plan_id/scope_ref/approval_count/compatibility_check_ref/mode/created_at)                        |
| R23-68 | P1     | (缺失)                               | 4/5 Explainability 对象缺失(RoutingExplanation/RiskExplanation/FallbackExplanation/TakeoverJustification)                 |
| R23-69 | P1     | hitl-explainability-service.ts:30-42 | DecisionExplanation 缺 matched_rule_or_policy/reason_source/remediation_hint                                              |
| R23-70 | P1     | human-takeover-service.ts            | 缺 feedback signal 注入/improvement candidate 创建/rollout 管理动作                                                       |
| R23-71 | P1     | (缺失)                               | ManualOverride/IncidentContextBundle 类型不存在                                                                           |
| R23-72 | P2     | event-registry.ts                    | 事件定义缺 producer/consumers/compatibility_policy 元数据                                                                 |
| R23-73 | P2     | (缺失)                               | Cost estimation templates(passthrough/fast/standard/full)不存在                                                           |
| R23-74 | P2     | (缺失)                               | BYOK 成本隔离逻辑不存在——平台治理成本 vs 用户模型成本混合                                                                 |
| R23-75 | P2     | sandbox-policy.ts                    | Contract 要求 PKCE 为 OAuth 默认——IAM 无 PKCE 实现                                                                        |
| R23-76 | P2     | compliance/ (全模块)                 | Contract 5/6 canonical types 缺失(EvidenceMappingRule/ComplianceReportRequest/Artifact/EvidenceRecord/AuditAppendCommand) |

### §119 Marketplace / SLA Engine / Resource Manager 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                             |
| ------ | ------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| R24-01 | P0     | certification/index.ts:6                  | 认证状态 pending/approved/revoked——缺 reviewing/published/suspended(3个必须状态) |
| R24-02 | P0     | catalog/index.ts:22                       | reviewStatus 缺 reviewing/published/suspended                                    |
| R24-03 | P0     | pack-security-service.ts:204              | 静态分析扫描 URI string 而非实际代码——安全检查是 no-op                           |
| R24-04 | P0     | pack-security-service.ts:65-79            | 无依赖供应链安全审计(CVE/漏洞扫描)——仅检查版本冲突                               |
| R24-05 | P0     | resource-pool-service.ts:21-77            | 无 per-consumer 资源分解——不可能检测 noisy neighbor                              |
| R24-06 | P0     | fair-queue/index.ts:15-20                 | 按 orgId 字典序排序优先于 score——"aaa" 永远优先于 "zzz" 不论 SLA                 |
| R24-07 | P1     | quota-enforcer/index.ts:28                | 用 burstLimit 而非 hardLimit 作拒绝阈值——hard limit 无强制                       |
| R24-08 | P1     | sla-operations-service.ts:104-108         | 惩罚为 string enum 无金额/无 credit 发放/无补偿跟踪                              |
| R24-09 | P1     | tier-resolver/index.ts:16-17              | 无 tenantId 参数——无法做 per-tenant tier 解析                                    |
| R24-10 | P1     | sla-operations-service.ts:111             | preemptionCapApplied 永远 true——死常量                                           |
| R24-11 | P1     | resource-allocator/index.ts:6-10          | reservedPercent 总和不验证 ≤100——可超额分配                                      |
| R24-12 | P1     | fair-scheduling-service.ts:50             | 抢占用 burstLimit 而非 hardLimit 触发——太晚                                      |
| R24-13 | P1     | marketplace-governance-service.ts:501-506 | reviewRequired=false 的 package 仍必须有 review record 才能 publish              |
| R24-14 | P2     | service-registry.ts:146-148               | Dead code: if(!has) delete——no-op                                                |
| R24-15 | P2     | structured-logger.ts:412-414              | Race: sync statSync + async appendFile——并发写可超 maxBytes                      |
| R24-16 | P2     | preemption/index.ts:7-13                  | 无 protected/minPriority 阈值——系统执行也可被驱逐                                |
| R24-17 | P2     | resource-pool-service.ts:55-63            | release 无 consumerId——任何调用者可释放任何 pool 资源                            |

### §120 Knowledge / Memory / Checkpoints / Truth 缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                         |
| ------ | ------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| R24-18 | P0     | knowledge-retrieval.ts:296                        | 语义搜索反转: vectorStore 存在时返回[]——配置 vector store 后丢失全部语义匹配 |
| R24-19 | P0     | memory-layer-model.ts:337                         | shouldEvict 对 LRU 层永不触发——priority=epoch ms(~10¹²)永远>0.5              |
| R24-20 | P0     | workflow-step-checkpoint.ts:255-258               | 验证拒绝有效 checkpoint——compensationModel typeof!=="string" 但实际为 object |
| R24-21 | P1     | semantic-knowledge-graph.ts:4                     | 仅3种 edge type——缺 derives_from/contradicts/specializes/related_to          |
| R24-22 | P1     | semantic-knowledge-graph.ts:225                   | collectAdjacent O(V×E)——遍历全部 edges 而非用 adjacencyByNodeId              |
| R24-23 | P1     | semantic-knowledge-graph.ts:269-271               | addEdge 无去重——重复 upsert 导致 adjacency 无界增长                          |
| R24-24 | P1     | memory-layer-model.ts vs layer-transition-service | 双重不一致 promotion 规则集(4 rules vs 5 rules,不同阈值/层名)                |
| R24-25 | P1     | knowledge/ (全目录)                               | 无跨域知识联邦——单 namespace 查询无路由/merge/冲突解决                       |
| R24-26 | P1     | knowledge/archive/knowledge-archive.ts:19-46      | 无版本历史——upsert 覆盖前版本无回滚/diff                                     |
| R24-27 | P1     | checkpoints/ (全目录)                             | 无 checkpoint 恢复逻辑——有创建无 restoreFromCheckpoint                       |
| R24-28 | P1     | checkpoints/ (全目录)                             | 无 checkpoint 版本管理——单一 v1 无迁移/比较/回滚                             |
| R24-29 | P1     | memory/ (全目录)                                  | 无 ContextTruncationReport——spec 要求记录被压缩/排除/降级内容                |
| R24-30 | P1     | truth/sqlite/repositories/ (全部)                 | 无乐观锁——直接 INSERT/UPDATE 无 version/CAS 检查                             |
| R24-31 | P2     | projections/ (artifact/governance/risk)           | processedEventIds 用 Array.includes() O(n²) + 无界增长                       |
| R24-32 | P2     | memory-consolidation.ts:36-101                    | 无 loss report——spec 要求压缩时记录丢失内容                                  |
| R24-33 | P2     | memory-layer-model.ts:193-195                     | 未知层 silent fallback "project"——错误配置静默错路由                         |
| R24-34 | P2     | truth/ (全部 repositories)                        | 非 event-sourced——直接 CRUD 而非从事件 replay 投影                           |

### §121 UI i18n / Tools / Design System / Features 缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                    |
| ------ | ------ | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| R24-35 | P0     | i18n/index.ts:62-81                      | Locale catalogs 内联硬编码而非 lazy-loaded bundles——全部语言打入初始包                  |
| R24-36 | P0     | i18n/ (全目录)                           | 无 RTL 支持——无 dir 属性/logical CSS/RTL 检测                                           |
| R24-37 | P0     | features/alerts/ (全目录)                | 无实时 alert stream——仅 REST polling 无 WebSocket 订阅                                  |
| R24-38 | P0     | features/alerts/hooks/index.ts:9-16      | 缺 snooze/dismiss/alert history——仅有 ack/mute/escalate 且无 mutation 实现              |
| R24-39 | P0     | features/domain-wizard/ (全目录)         | 无多步骤 wizard——flat list 无 step state machine/stepper/表单验证/持久化/预览           |
| R24-40 | P0     | tools/e2e/index.ts                       | 无 Playwright 测试——仅静态场景目录数组无 test()/browser launch                          |
| R24-41 | P0     | tools/codegen/index.ts                   | 无 OpenAPI codegen——仅从手写数组生成路径常量字符串                                      |
| R24-42 | P0     | tools/mock-server/index.ts               | 无 HTTP server——3个纯函数返回内存对象无端口/请求处理                                    |
| R24-43 | P1     | ui-core/design-tokens/index.ts:69-84     | 原始 hex 值非语义 token——无 primitive→semantic 间接层                                   |
| R24-44 | P1     | ui-core/components/index.ts:6-306        | 几乎零 accessibility——1个 aria-label,无 role/aria-selected/keyboard nav/focus/aria-live |
| R24-45 | P1     | ui-core/layouts/index.ts:30              | ThreePaneLayout 无响应式——固定 grid 无 @media 断点折叠                                  |
| R24-46 | P1     | ui-core/design-tokens/index.ts:119-123   | Breakpoint 值 640/960/1280 vs spec 768/1024/1440——不匹配                                |
| R24-47 | P1     | features/settings/hooks/index.ts:105-107 | save() 同步翻转状态无 API 调用——偏好不持久化到后端                                      |
| R24-48 | P1     | features/settings/ (全目录)              | 缺 API key management 和 notification settings                                          |
| R24-49 | P1     | .github/workflows/ui-quality.yml         | CI workflow 文件不存在                                                                  |
| R24-50 | P1     | ui/ (全目录)                             | 无 visual regression testing——零截图对比工具                                            |
| R24-51 | P2     | i18n/index.ts:17-18                      | setLocale 无事件发射——组件不会因语言切换 re-render                                      |
| R24-52 | P2     | ui-core/components/index.ts:93,128-129   | 硬编码中文字符串绕过 i18n                                                               |
| R24-53 | P2     | ui-core/components/index.ts:201          | 硬编码 #12201a 不在 design tokens 中                                                    |
| R24-54 | P2     | scripts/perf-budget.mjs:6-9              | 仅检查文件大小——无 Lighthouse CI/Core Web Vitals 强制                                   |
| R24-55 | P2     | features/settings/web/index.tsx:21       | 语言选择器是 free-text input 非 select——可输入无效 locale                               |

### §122 ADR 实现偏差 + E2E/Integration Tests 缺陷

| #      | 严重度 | 文件/位置                                    | 问题                                                                                         |
| ------ | ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| R24-56 | P0     | risk-evaluation-engine.ts:122-158            | ADR-026 8因子模型未实现——仍用 legacy 6因子+除数75(应为8因子+除数18)                          |
| R24-57 | P0     | risk-control/types.ts:42-49                  | RiskFactorsSchema 用废弃字段名——缺 autonomyModeRisk/tenantImpact/evidenceConfidence          |
| R24-58 | P0     | contracts/request-envelope/index.ts:4-14     | ADR-021 RequestEnvelope 缺4/8必须字段(principal/source_plane/target_plane/directives)        |
| R24-59 | P0     | src/ (全代码库)                              | ADR-021 OperationalDirective/DecisionDirective 完全未实现——directive-based P2→P3/P4 控制缺失 |
| R24-60 | P1     | memory-layer-model.ts:48-49                  | ADR-020 promotion 阈值偏离 spec ~20-40%(accessCount 10→8, qualityScore 0.8→0.75 等)          |
| R24-61 | P1     | memory-layer-model.ts:50                     | ADR-020 L5→L6 要求 manual-only——实现有自动 rule(minHitCount:20)                              |
| R24-62 | P1     | tests/e2e/workflow-state-transitions.test.ts | E2E 全测 legacy(TransitionService/WorkflowState)——零 RuntimeStateMachine 覆盖                |
| R24-63 | P1     | tests/e2e/execution-flow.test.ts             | E2E 8个测试全 legacy path——无 canonical HarnessRun/NodeRun/PlanGraphBundle                   |
| R24-64 | P1     | tests/e2e/task-lifecycle.test.ts             | E2E 10个测试全 legacy——无 RSM.transition(command) 使用                                       |
| R24-65 | P1     | tests/e2e/multi-step-workflow.test.ts        | 直接 updateWorkflowState 绕过 RSM——验证已被 ADR-030 禁止的行为                               |
| R24-66 | P1     | tests/e2e/harness-loop-e2e.test.ts:347-377   | INV-BUDGET 无 E2E 覆盖——maxCost 是死代码,注释承认 guard 不会触发                             |
| R24-67 | P1     | tests/e2e/ (全目录)                          | 无 PlanGraphBundle→NodeAttemptReceipt 端到端测试——canonical P3→P4→P5 零覆盖                  |
| R24-68 | P2     | tests/e2e/oapeflir-full-loop.test.ts:19      | OAPEFLIR 独立运行不经 HarnessRuntime——违反 ADR-029 架构分层                                  |
| R24-69 | P2     | risk-evaluation-engine.ts:57                 | MAX_POSSIBLE_SCORE=75 vs ADR-026 应为18——归一化分数完全错误                                  |
| R24-70 | P2     | tests/e2e/execution-flow.test.ts:379         | 测试验证 blocked→executing 有效——RSM 明确拒绝此转换                                          |
| R24-71 | P2     | memory-layer-model.ts:157                    | L5 supportsPromotion=false 但有 user→evolution rule——模块内自相矛盾                          |
| R24-72 | P2     | tests/e2e/ (~75文件)                         | ~95% E2E 仅测 legacy 类型——canonical runtime 接近零 E2E 覆盖                                 |

### §124 Platform Interface / API / Channel Gateway 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                                            |
| ------ | ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| R25-01 | P0     | request-helpers.ts:19                     | matchRoute 仅允许 GET/POST/OPTIONS——PATCH/DELETE handler 完全不可达(task-routes 定义但永远404)  |
| R25-02 | P0     | response-hardening.ts:13                  | CORS allowedOrigins=["*"]+credentials=true——生产默认 wildcard,§6 明确禁止                       |
| R25-03 | P1     | api-error.ts:65-77                        | instanceof 检查顺序错——GatewayTarget\*Error extends AppError 被先匹配为 AppError,特殊处理死代码 |
| R25-04 | P1     | utils.ts:192 / http-api-server.ts:604     | 错误响应缺 traceId 和 details 字段——不符 §7 标准化错误格式                                      |
| R25-05 | P1     | channel-gateway-delivery-service.ts:287   | generateNonce 产生16字节而非32字节熵(64 hex truncate to 32)                                     |
| R25-06 | P1     | channel-gateway-delivery-service.ts:336   | createDeliveryMessage 未尝试即返回 finalStatus:"success"——消费者收到虚假投递确认                |
| R25-07 | P1     | channel-gateway-delivery-service.ts:77-82 | Rate limiting per-channel 而非 per-tenant——§7 要求 per-tenant                                   |
| R25-08 | P1     | websocket-bridge.ts:97-160                | 无 server-initiated heartbeat——死连接不可检测,clients map 无界增长                              |
| R25-09 | P2     | stream-bridge.ts:180-395                  | 无 backpressure——producer 无流控信号,replay buffer 无界增长                                     |
| R25-10 | P2     | websocket-bridge.ts:133-139               | 无 WS 消息大小限制——可 OOM DoS                                                                  |
| R25-11 | P2     | websocket-bridge.ts:128-129               | 无 tenant scope 检查——任何用户可订阅任何 task 更新                                              |
| R25-12 | P2     | http-api-server.ts:375-378                | Rate limit key 含 path params——每个唯一 taskId 独立 bucket,有效无限流                           |
| R25-13 | P2     | http-api-server.ts:362-368                | Body read 在 timeout wrapper 外——slow-drip request 绕过超时保护                                 |

### §125 Platform Contracts / Domain Types / Dispatch 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                          |
| ------ | ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R25-14 | P0     | contracts/state-command/index.ts:6-15           | StateCommand 缺 §5.3 必须字段(leaseId/fencingToken/event/principal/traceId/expectedStatus)    |
| R25-15 | P0     | contracts/types/domain/core-types.ts:72-77      | TransitionCommand 缺 leaseId/fencingToken/event/payload/expectedVersion/principal             |
| R25-16 | P0     | domain types (全目录)                           | §5.5 五核心对象(HarnessRun/NodeRun/NodeAttempt/BudgetReservation/SideEffectRecord)均不存在    |
| R25-17 | P1     | contracts/execution-plan/index.ts:4-19          | 第三份重复 ExecutionPlan——仍用 flat steps[] 非 PlanGraph(node/edge/entry/terminal)            |
| R25-18 | P1     | contracts/execution-receipt/index.ts:6-17       | Legacy ExecutionReceipt 作一等 contract 导出——缺 harnessRunId/planGraphId/nodeRunId/attemptId |
| R25-19 | P1     | contracts/model-request/index.ts:9-18           | ModelRequest 无 budgetReservationId——LLM 调用不引用预算预留                                   |
| R25-20 | P1     | contracts/delegation-request/index.ts:6-17      | DelegationRequest 无 budgetEnvelope/budgetReservationId                                       |
| R25-21 | P1     | contracts/types/domain/primitives.ts:55         | RunKind 缺 "node_run"——canonical 最小执行单元无法表达                                         |
| R25-22 | P1     | contracts/types/domain/execution-types.ts:33-61 | ExecutionRecord 用 agentId/roleId 而非 nodeRunId/planGraphId——身份模型偏离 canonical          |
| R25-23 | P1     | contracts/types/domain/workspace-types.ts:101   | TenantRecord.quotas optional——dispatch 可绕过租户配额限制                                     |
| R25-24 | P2     | contracts/projection-update/index.ts            | 从 legacy platform-contracts.ts re-export 而非 executable-contracts/                          |
| R25-25 | P2     | contracts/prompt-bundle/index.ts:8-99           | PromptBundle 无 factory/validation 函数——无输入验证                                           |

### §126 ADR 001-019 + Stability 缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                                |
| ------ | ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R25-26 | P1     | ADR-005 / harness/index.ts:60            | ConstraintPack.autonomyMode 用 legacy 4值 enum——ADR-005 canonical 为8-mode UnifiedRuntimeMode       |
| R25-27 | P1     | ADR-007+001 / learning-object-model.ts:5 | learningType 5种超出 ADR-007 Phase 1 scope(仅3种)——无 superseding ADR                               |
| R25-28 | P1     | ADR-019 / handoff-serializer.ts:7-13     | Layer 语义反转(L1=FactLayer vs ADR L1=ContextSummary) + 无 L4(Full) + token budgets 不匹配          |
| R25-29 | P1     | ADR-016 / oapeflir-loop-service.ts:86    | ADR-016 A-1 废弃独立 OapeflirLoopService——仍作为 primary export 独立编排执行                        |
| R25-30 | P2     | ADR-003 / 003-memory-seven-layers.md     | 文件名 "seven-layers" 实际内容为6层——文件名过时                                                     |
| R25-31 | P2     | stability/stable-evidence-bundle.ts      | Evidence bundle 遗漏 3个 rehearsal(dispatch/worker-handshake/worker-writeback)——release gate 不验证 |
| R25-32 | P2     | ADR-005 / agent-registry/index.ts:52     | Agent registry 用独立4值 autonomy enum——与 ConstraintPack 同问题但不同子系统,两套不互通             |
| R25-33 | P2     | ADR-019 / handoff-model.ts               | 无 HandoffLevel enum——serializeHandoff 仅接受 totalMaxTokens,不支持 per-level 查询                  |

### §127 UI Mobile / Charts / Feature Mutations 缺陷

| #      | 严重度 | 文件/位置                               | 问题                                                                                             |
| ------ | ------ | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R25-34 | P0     | vitest.config.ts:16-19                  | Coverage 阈值 30/30/30/20%——§7.2.6 要求 >80%                                                     |
| R25-35 | P0     | mobile/App.tsx:7                        | 渲染 div/span(React DOM)——§11 要求 React Native 0.79+Hermes+Fabric                               |
| R25-36 | P0     | ws-client.ts:100-102                    | onclose 后永不重连——WS 永久丢失违反 §5.3 UP-5                                                    |
| R25-37 | P0     | task-cockpit/hooks:58-78                | mutation 仅 setState 无 API 调用——optimistic update with rollback 完全缺失(同 workflow/approval) |
| R25-38 | P1     | charts/echart-surface-runtime.tsx:8     | 缺 DataZoomComponent——§4.2.8 要求 data zoom                                                      |
| R25-39 | P1     | charts/echart-surface-runtime.tsx:38,46 | 硬编码颜色绕过 theme——§6.3.3 要求 theme-aware chart colors                                       |
| R25-40 | P1     | charts/echart-surface-runtime.tsx:52-53 | Resize 用 window event 非 ResizeObserver——sidebar toggle 不触发 reflow                           |
| R25-41 | P1     | charts/ (全目录)                        | 无 D3 集成——仅 ECharts LineChart,缺 bar/pie/scatter/gauge/heatmap/sparkline(7种中缺6)            |
| R25-42 | P1     | conversation/hooks/index.ts:18-65       | 无 TanStack Query/无 WS 集成——raw useState 违反 §4/§5.1.2                                        |
| R25-43 | P1     | ui-mobile/navigation/index.ts:3-9       | Tab list 缺 conversation——§4.4.2 NL 为 mobile 主入口                                             |
| R25-44 | P1     | ui-mobile/native-modules/index.ts:1-9   | Native modules 仅 boolean flags——无 NativeModules/TurboModule 绑定                               |
| R25-45 | P1     | pnpm-workspace.yaml + turbo.json        | 用 pnpm+Turborepo——ADR-UI-001 选型为 npm workspaces                                              |
| R25-46 | P1     | state/query-client.ts:4-12              | 缺 refetchOnWindowFocus/refetchOnReconnect/per-domain staleTime                                  |
| R25-47 | P2     | charts/echart-surface-runtime.tsx:27-50 | 无 aria enabled/decal——screen reader 无法叙述图表                                                |
| R25-48 | P2     | rest-client.ts:200-218                  | 无 Accept-Version header——§1.8 版本协商缺失                                                      |
| R25-49 | P2     | analytics/web/index.tsx:8               | 仅单一 LineChart——§4.2.8 要求7种图表类型                                                         |

### §129 Dispatch / Delegation / Lease 缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                        |
| ------ | ------ | ---------------------------------------------- | --------------------------------------------------------------------------- |
| R26-01 | P0     | context-isolator.ts:175                        | Division by zero: parent 0 actions→Infinity→匹配>=0.9→授予 FULL 权限        |
| R26-02 | P0     | delegation-audit-service.ts:47                 | Audit trail 纯内存 array——重启丢失全部委托审计历史                          |
| R26-03 | P1     | context-isolator.ts:216-220                    | MINIMAL 隔离在 resources/actions 为空时回退到 parent 全部权限——权限提升     |
| R26-04 | P1     | context-isolator.ts:151                        | mergePermissions 不取交集——override resources 可超出 base 范围              |
| R26-05 | P1     | context-isolator.ts:281-289                    | mergeDomainLists denied 域用交集而非并集——denied 域可被丢弃                 |
| R26-06 | P1     | invariant-enforcer.ts:82                       | checkDepthLimit 比较 message.depth<=context.globalCallDepth——允许无限嵌套   |
| R26-07 | P1     | delegation-audit-service.ts:122,140            | recordDelegation Completed/Failed 硬编码 depth:0——实际深度丢失              |
| R26-08 | P1     | lease-repository-sqlite.ts:90-94               | updateLeaseStatus 无状态机 guard——允许反向转换(closed→active)               |
| R26-09 | P2     | lease-repository-sqlite.ts:102-110             | updateLeaseRelease 无条件覆盖 status=released——已 closed/expired 的也被重写 |
| R26-10 | P2     | lease-repository-sqlite.ts:96-99               | updateLeaseHeartbeat 不延长 expires_at——lease TTL 实际不可续期              |
| R26-11 | P2     | execution-worker-writeback-service-async.ts:46 | CJS require() in ESM via createRequire——脆弱模块解析,破坏 tree-shaking      |

### §130 Compliance / Gateway / Eval 缺陷

| #      | 严重度 | 文件/位置                                           | 问题                                                                                      |
| ------ | ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| R26-12 | P0     | crypto-shredding-service.ts:encryptRecordForSubject | 返回值含明文 PII 字段——加密后仍泄漏原始数据                                               |
| R26-13 | P0     | compliance/encryption/index.ts:protectValue         | 使用 base64url 编码伪装加密——无密钥、无 IV、可逆                                          |
| R26-14 | P0     | dek-manager.ts:markRotated                          | 删除旧 DEK——已加密密文永久不可解密                                                        |
| R26-15 | P1     | fallback/index.ts                                   | selectFallback 选最便宜模型忽略 tier 兼容性——降级可能违反 SLA                             |
| R26-16 | P1     | degradation/index.ts                                | deterministic-hot-path-gate allowed:false 但 routeMode:"deterministic_hot_path_only" 矛盾 |
| R26-17 | P1     | metric-aggregator/index.ts                          | 仅维护计数器——无 real-time windowed rollup/percentile                                     |
| R26-18 | P1     | health-scorer/index.ts                              | 无 composite indicator weighting——单维度健康评分                                          |
| R26-19 | P1     | alert-router/index.ts                               | 仅按严重度排序——无实际路由/升级/通知逻辑                                                  |
| R26-20 | P1     | llm-eval-service.ts                                 | A/B test 硬编码 mock scores 0.85/0.90——非真实评估                                         |
| R26-21 | P1     | execution-outcome-evaluator.ts                      | qualityScoreWeights 总和 1.2 非 1.0——加权平均偏高                                         |
| R26-22 | P1     | quality-config-loader.ts                            | bare catch 吞噬所有错误——配置加载失败静默使用默认值                                       |
| R26-23 | P1     | prompt-injection-guard.ts                           | 输出含任何 URL 即 block——误杀合法 URL 引用                                                |
| R26-24 | P2     | dek-manager.ts:encryptForSubject                    | 返回错误 IV（固定值非随机生成）                                                           |
| R26-25 | P2     | compliance-case-orchestration-service.ts            | governance 调用无 try/catch——异常中断整个合规流程                                         |
| R26-26 | P2     | lineage/index.ts                                    | cloneMetadata shallow clone——嵌套对象共享引用导致污染                                     |
| R26-27 | P2     | fallback/index.ts                                   | attemptedProfiles 含未尝试的 provider——误导重试逻辑                                       |
| R26-28 | P2     | cross-provider-judge-service.ts                     | "fastest" 策略实为 "cheapest"（按 cost 排序）                                             |
| R26-29 | P2     | dashboard-projection-service.ts                     | attention queue 按 createdAt 排序非 priority——紧急事项被埋没                              |

### §131 ADR 080-109 + Contract 偏差

| #      | 严重度 | 文件/位置                                     | 问题                                                                                                     |
| ------ | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R26-30 | P0     | ADR-098 vs harness/index.ts                   | harness 用 waiting_hitl vs canonical awaiting_hitl——两个冲突状态值共存                                   |
| R26-31 | P0     | contracts/model_gateway_routing vs 实现       | ModelRouteRequest 接口完全不同(routeClass/riskLevel vs requestId/taskId/purpose/routingStrategy)         |
| R26-32 | P0     | contracts/model_gateway_routing vs 实现       | ModelRouteDecision 字段完全偏离——contract 和代码无重叠字段                                               |
| R26-33 | P0     | contracts/model_gateway_routing vs 实现       | RouteFailureCode 5个 contract 值(no_capacity/budget_exceeded/risk_blocked/provider_down/timeout)全不存在 |
| R26-34 | P1     | ADR-080 vs learn/index.ts                     | learningType 5种超出 Phase 1 scope(仅3种)——实现与 ADR 范围不匹配                                         |
| R26-35 | P1     | ADR-080 vs learn/index.ts                     | LearningObject 字段名/结构偏离(learningObjectId vs objectId, flat vs union discriminator)                |
| R26-36 | P1     | ADR-093 vs 实现                               | ConstraintPack 缺 sandbox_requirement/approval_requirement 字段                                          |
| R26-37 | P1     | ADR-097 vs guardrails/                        | guardrail layers 仅 tool 重叠——缺 input/planning/memory/output 四层                                      |
| R26-38 | P1     | contracts/observability vs metrics-service.ts | RuntimeMetricsSummary 9/14 维度缺失                                                                      |
| R26-39 | P1     | ADR-096                                       | 仍用 "phase 8b" 未迁移到 "Ring 2" 术语                                                                   |
| R26-40 | P1     | ADR-106 vs quant-trading/                     | trading 无 PreTradeRisk guard/position limits/loss limits                                                |
| R26-41 | P2     | ADR-108 vs legal/                             | legal domain 无 attorney-review 强制流程                                                                 |
| R26-42 | P2     | ADR-105 vs provider-registry                  | latency tier "interactive" 不在 ADR 定义中                                                               |
| R26-43 | P2     | contracts/observability vs 实现               | metrics 命名不符 oapeflir*<stage>*<metric> 规范                                                          |
| R26-44 | P2     | ADR-081 vs domain-specs.ts                    | DomainDescriptor 缺 governancePolicy/interactionPolicy 字段                                              |

### §132 UI State / API Deep 缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                  |
| ------ | ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R26-45 | P0     | ui/packages/shared/state/stores/auth-store     | 仅 boolean isAuthenticated——缺 token/permissions/user/tenantId/login/logout/refreshToken/switchTenant |
| R26-46 | P0     | ui/packages/shared/state/stores/auth-store     | 无 auth state machine(unauthenticated→authenticating→authenticated→refreshing→expired)                |
| R26-47 | P0     | ui/packages/shared/api-client/ws-client        | WS 从不重连 + 无 event replay——断线后状态永久丢失                                                     |
| R26-48 | P0     | ui/packages/shared/state/stores/\*             | 4个 Zustand stores 零 middleware(无 persist/devtools/immer)                                           |
| R26-49 | P0     | ui/packages/shared/state/stores/\*             | useAuthState/useUiState/useSyncState select 全量 store——破坏 selector-based 性能优化                  |
| R26-50 | P1     | ui/packages/shared/state/stores/ui-store       | 缺 theme/sidebar/NL panel/command palette state                                                       |
| R26-51 | P1     | ui/packages/shared/state/stores/realtime-store | 缺 subscription tracking/incident counters                                                            |
| R26-52 | P1     | ui/packages/shared/state/stores/sync-store     | 缺 online flag/conflicts/error status/retrySync                                                       |
| R26-53 | P1     | ui/packages/shared/state/query-client          | staleTime 30s vs spec 5min + 缺 refetchOnWindowFocus/Reconnect                                        |
| R26-54 | P1     | ui/packages/shared/api-client/interceptors     | 缺 RetryInterceptor/DedupeInterceptor                                                                 |
| R26-55 | P1     | ui/packages/shared/api-client/endpoints        | 缺 body/response type fields——类型不安全                                                              |
| R26-56 | P1     | ui/packages/shared/api-client/interceptors     | auth interceptor 静态 token 无动态获取/401 refresh/并发队列                                           |
| R26-57 | P1     | ui/packages/shared/api-client/ws-event-router  | 无 heartbeat 管理——无法检测 zombie 连接                                                               |
| R26-58 | P1     | ui/turbo.json                                  | 无 inputs/outputs hash/globalDependencies/env passthrough                                             |
| R26-59 | P1     | ui/apps/web/vite.config.ts                     | 无 source-map staging-only 配置                                                                       |
| R26-60 | P1     | ui/packages/features/\*                        | 28个 feature 无 i18n keys/独立 route definition                                                       |
| R26-61 | P2     | ui/apps/web/main.tsx                           | UiRuntimeProvider 硬编码 mock token                                                                   |
| R26-62 | P2     | ui/packages/shared/api-client/rest-client      | DefaultRESTClient 默认 MockTransport——生产请求不发出                                                  |
| R26-63 | P2     | ui/packages/shared/api-client/ws-client        | WS token 在 URL query 中——日志/代理可截获                                                             |
| R26-64 | P2     | ui/packages/shared/state/stores/\*             | 无 state normalization for collections——O(n) lookup                                                   |
| R26-65 | P2     | ui/packages/shared/state/query-client          | 无 per-type staleTime 覆盖——所有查询同一缓存策略                                                      |
| R26-66 | P2     | ui/packages/shared/api-client/interceptors     | 无 X-Idempotency-Key interceptor——重试可重复写入                                                      |
### §129 Dispatch / Delegation / Lease 缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                        |
| ------ | ------ | ---------------------------------------------- | --------------------------------------------------------------------------- |
| R26-01 | P0     | context-isolator.ts:175                        | Division by zero: parent 0 actions→Infinity→匹配>=0.9→授予 FULL 权限        |
| R26-02 | P0     | delegation-audit-service.ts:47                 | Audit trail 纯内存 array——重启丢失全部委托审计历史                          |
| R26-03 | P1     | context-isolator.ts:216-220                    | MINIMAL 隔离在 resources/actions 为空时回退到 parent 全部权限——权限提升     |
| R26-04 | P1     | context-isolator.ts:151                        | mergePermissions 不取交集——override resources 可超出 base 范围              |
| R26-05 | P1     | context-isolator.ts:281-289                    | mergeDomainLists denied 域用交集而非并集——denied 域可被丢弃                 |
| R26-06 | P1     | invariant-enforcer.ts:82                       | checkDepthLimit 比较 message.depth<=context.globalCallDepth——允许无限嵌套   |
| R26-07 | P1     | delegation-audit-service.ts:122,140            | recordDelegation Completed/Failed 硬编码 depth:0——实际深度丢失              |
| R26-08 | P1     | lease-repository-sqlite.ts:90-94               | updateLeaseStatus 无状态机 guard——允许反向转换(closed→active)               |
| R26-09 | P2     | lease-repository-sqlite.ts:102-110             | updateLeaseRelease 无条件覆盖 status=released——已 closed/expired 的也被重写 |
| R26-10 | P2     | lease-repository-sqlite.ts:96-99               | updateLeaseHeartbeat 不延长 expires_at——lease TTL 实际不可续期              |
| R26-11 | P2     | execution-worker-writeback-service-async.ts:46 | CJS require() in ESM via createRequire——脆弱模块解析,破坏 tree-shaking      |

### §130 Compliance / Gateway / Eval 缺陷

| #      | 严重度 | 文件/位置                                           | 问题                                                                                      |
| ------ | ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| R26-12 | P0     | crypto-shredding-service.ts:encryptRecordForSubject | 返回值含明文 PII 字段——加密后仍泄漏原始数据                                               |
| R26-13 | P0     | compliance/encryption/index.ts:protectValue         | 使用 base64url 编码伪装加密——无密钥、无 IV、可逆                                          |
| R26-14 | P0     | dek-manager.ts:markRotated                          | 删除旧 DEK——已加密密文永久不可解密                                                        |
| R26-15 | P1     | fallback/index.ts                                   | selectFallback 选最便宜模型忽略 tier 兼容性——降级可能违反 SLA                             |
| R26-16 | P1     | degradation/index.ts                                | deterministic-hot-path-gate allowed:false 但 routeMode:"deterministic_hot_path_only" 矛盾 |
| R26-17 | P1     | metric-aggregator/index.ts                          | 仅维护计数器——无 real-time windowed rollup/percentile                                     |
| R26-18 | P1     | health-scorer/index.ts                              | 无 composite indicator weighting——单维度健康评分                                          |
| R26-19 | P1     | alert-router/index.ts                               | 仅按严重度排序——无实际路由/升级/通知逻辑                                                  |
| R26-20 | P1     | llm-eval-service.ts                                 | A/B test 硬编码 mock scores 0.85/0.90——非真实评估                                         |
| R26-21 | P1     | execution-outcome-evaluator.ts                      | qualityScoreWeights 总和 1.2 非 1.0——加权平均偏高                                         |
| R26-22 | P1     | quality-config-loader.ts                            | bare catch 吞噬所有错误——配置加载失败静默使用默认值                                       |
| R26-23 | P1     | prompt-injection-guard.ts                           | 输出含任何 URL 即 block——误杀合法 URL 引用                                                |
| R26-24 | P2     | dek-manager.ts:encryptForSubject                    | 返回错误 IV（固定值非随机生成）                                                           |
| R26-25 | P2     | compliance-case-orchestration-service.ts            | governance 调用无 try/catch——异常中断整个合规流程                                         |
| R26-26 | P2     | lineage/index.ts                                    | cloneMetadata shallow clone——嵌套对象共享引用导致污染                                     |
| R26-27 | P2     | fallback/index.ts                                   | attemptedProfiles 含未尝试的 provider——误导重试逻辑                                       |
| R26-28 | P2     | cross-provider-judge-service.ts                     | "fastest" 策略实为 "cheapest"（按 cost 排序）                                             |
| R26-29 | P2     | dashboard-projection-service.ts                     | attention queue 按 createdAt 排序非 priority——紧急事项被埋没                              |

### §131 ADR 080-109 + Contract 偏差

| #      | 严重度 | 文件/位置                                     | 问题                                                                                                     |
| ------ | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R26-30 | P0     | ADR-098 vs harness/index.ts                   | harness 用 waiting_hitl vs canonical awaiting_hitl——两个冲突状态值共存                                   |
| R26-31 | P0     | contracts/model_gateway_routing vs 实现       | ModelRouteRequest 接口完全不同(routeClass/riskLevel vs requestId/taskId/purpose/routingStrategy)         |
| R26-32 | P0     | contracts/model_gateway_routing vs 实现       | ModelRouteDecision 字段完全偏离——contract 和代码无重叠字段                                               |
| R26-33 | P0     | contracts/model_gateway_routing vs 实现       | RouteFailureCode 5个 contract 值(no_capacity/budget_exceeded/risk_blocked/provider_down/timeout)全不存在 |
| R26-34 | P1     | ADR-080 vs learn/index.ts                     | learningType 5种超出 Phase 1 scope(仅3种)——实现与 ADR 范围不匹配                                         |
| R26-35 | P1     | ADR-080 vs learn/index.ts                     | LearningObject 字段名/结构偏离(learningObjectId vs objectId, flat vs union discriminator)                |
| R26-36 | P1     | ADR-093 vs 实现                               | ConstraintPack 缺 sandbox_requirement/approval_requirement 字段                                          |
| R26-37 | P1     | ADR-097 vs guardrails/                        | guardrail layers 仅 tool 重叠——缺 input/planning/memory/output 四层                                      |
| R26-38 | P1     | contracts/observability vs metrics-service.ts | RuntimeMetricsSummary 9/14 维度缺失                                                                      |
| R26-39 | P1     | ADR-096                                       | 仍用 "phase 8b" 未迁移到 "Ring 2" 术语                                                                   |
| R26-40 | P1     | ADR-106 vs quant-trading/                     | trading 无 PreTradeRisk guard/position limits/loss limits                                                |
| R26-41 | P2     | ADR-108 vs legal/                             | legal domain 无 attorney-review 强制流程                                                                 |
| R26-42 | P2     | ADR-105 vs provider-registry                  | latency tier "interactive" 不在 ADR 定义中                                                               |
| R26-43 | P2     | contracts/observability vs 实现               | metrics 命名不符 oapeflir*<stage>*<metric> 规范                                                          |
| R26-44 | P2     | ADR-081 vs domain-specs.ts                    | DomainDescriptor 缺 governancePolicy/interactionPolicy 字段                                              |

### §132 UI State / API Deep 缺陷

| #      | 严重度 | 文件/位置                                      | 问题                                                                                                  |
| ------ | ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R26-45 | P0     | ui/packages/shared/state/stores/auth-store     | 仅 boolean isAuthenticated——缺 token/permissions/user/tenantId/login/logout/refreshToken/switchTenant |
| R26-46 | P0     | ui/packages/shared/state/stores/auth-store     | 无 auth state machine(unauthenticated→authenticating→authenticated→refreshing→expired)                |
| R26-47 | P0     | ui/packages/shared/api-client/ws-client        | WS 从不重连 + 无 event replay——断线后状态永久丢失                                                     |
| R26-48 | P0     | ui/packages/shared/state/stores/\*             | 4个 Zustand stores 零 middleware(无 persist/devtools/immer)                                           |
| R26-49 | P0     | ui/packages/shared/state/stores/\*             | useAuthState/useUiState/useSyncState select 全量 store——破坏 selector-based 性能优化                  |
| R26-50 | P1     | ui/packages/shared/state/stores/ui-store       | 缺 theme/sidebar/NL panel/command palette state                                                       |
| R26-51 | P1     | ui/packages/shared/state/stores/realtime-store | 缺 subscription tracking/incident counters                                                            |
| R26-52 | P1     | ui/packages/shared/state/stores/sync-store     | 缺 online flag/conflicts/error status/retrySync                                                       |
| R26-53 | P1     | ui/packages/shared/state/query-client          | staleTime 30s vs spec 5min + 缺 refetchOnWindowFocus/Reconnect                                        |
| R26-54 | P1     | ui/packages/shared/api-client/interceptors     | 缺 RetryInterceptor/DedupeInterceptor                                                                 |
| R26-55 | P1     | ui/packages/shared/api-client/endpoints        | 缺 body/response type fields——类型不安全                                                              |
| R26-56 | P1     | ui/packages/shared/api-client/interceptors     | auth interceptor 静态 token 无动态获取/401 refresh/并发队列                                           |
| R26-57 | P1     | ui/packages/shared/api-client/ws-event-router  | 无 heartbeat 管理——无法检测 zombie 连接                                                               |
| R26-58 | P1     | ui/turbo.json                                  | 无 inputs/outputs hash/globalDependencies/env passthrough                                             |
| R26-59 | P1     | ui/apps/web/vite.config.ts                     | 无 source-map staging-only 配置                                                                       |
| R26-60 | P1     | ui/packages/features/\*                        | 28个 feature 无 i18n keys/独立 route definition                                                       |
| R26-61 | P2     | ui/apps/web/main.tsx                           | UiRuntimeProvider 硬编码 mock token                                                                   |
| R26-62 | P2     | ui/packages/shared/api-client/rest-client      | DefaultRESTClient 默认 MockTransport——生产请求不发出                                                  |
| R26-63 | P2     | ui/packages/shared/api-client/ws-client        | WS token 在 URL query 中——日志/代理可截获                                                             |
| R26-64 | P2     | ui/packages/shared/state/stores/\*             | 无 state normalization for collections——O(n) lookup                                                   |
| R26-65 | P2     | ui/packages/shared/state/query-client          | 无 per-type staleTime 覆盖——所有查询同一缓存策略                                                      |
| R26-66 | P2     | ui/packages/shared/api-client/interceptors     | 无 X-Idempotency-Key interceptor——重试可重复写入                                                      |

### §134 Execution / Model-Gateway / Ops-Maturity 缺陷

| #      | 严重度 | 文件/位置                                                               | 问题                                                                                                                          |
| ------ | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R27-01 | P0     | shared/observability/transports/fluentd-transport.ts:119                | flush() 监听 drain 事件但 socket 已可写时 drain 永不触发——Promise 永久挂起(死锁)                                              |
| R27-02 | P0     | model-gateway/provider-registry/minimax/minimax-chat-service.ts:391     | streaming 中 assertMiniMaxBusinessSuccess 异常被 generic catch 以 debug 级别吞噬——业务错误静默丢失                            |
| R27-03 | P0     | model-gateway/provider-registry/openai/openai-chat-service.ts:464       | streaming 从 first chunk 取 finalFinishReason 但首 SSE chunk finish_reason 恒为 null——content_filter/tool_calls/length 全丢失 |
| R27-04 | P1     | worker-pool/worker/worker-registry-service.ts:240                       | parseJsonArray() 无 try/catch(对比 handshake-support.ts 有)——corrupt JSON 直接 crash                                          |
| R27-05 | P1     | worker-pool/worker/ (handshake+writeback)                               | parseJsonArray/toWorkerStatus/buildAgentExecutionRecord/persistRemoteLogs 跨文件复制粘贴——维护分歧                            |
| R27-06 | P1     | worker-pool/worker/worker-registry-service.ts:577                       | getWorker() unsafe `as` cast 访问 legacy store 方法——绕过类型安全,死代码路径                                                  |
| R27-07 | P1     | agent-lifecycle/version-manager/agent-version-manager.ts:84             | assignDeploymentSlot() 在 zod-parsed 不可变对象上直接 mutate 字段——共享引用数据损坏                                           |
| R27-08 | P1     | agent-lifecycle/version-manager/agent-version-manager.ts:86-122         | assignDeploymentSlot 清除对面 slot vs switchSlot 注释"保持双活"——blue-green 语义矛盾                                          |
| R27-09 | P1     | shared/observability/transports/datadog-transport.ts:59                 | flushInternal HTTP 错误时 resolve() 静默——日志条目丢失无重试/无指标/无背压                                                    |
| R27-10 | P1     | model-gateway/provider-registry/anthropic/anthropic-chat-service.ts:463 | streaming message_delta 不提取 stop_reason/usage——finalStopReason 永为 null                                                   |
| R27-11 | P2     | drift-detection/cross-agent-analyzer/index.ts:28                        | metrics.length===1 时 bestAgentId===worstAgentId——误导输出                                                                    |
| R27-12 | P2     | drift-detection/changepoint-detector/index.ts:93                        | DRIFT_THRESHOLD+EPSILON 使阈值比文档-10%微偏——实际~-9.9999999%触发                                                            |
| R27-13 | P2     | shared/observability/transports/fluentd-transport.ts:65                 | handleConnected drain loop 无 write 错误处理——中途失败剩余条目丢失                                                            |
| R27-14 | P2     | agent-lifecycle/retirement/index.ts:45                                  | canRetireAgent ISO 字符串比较忽略时区——混合 UTC/local 结果错误                                                                |

### §135 ADR 020-039 / 061-069 偏差

| #      | 严重度 | ADR + 代码文件                              | 问题                                                                                                     |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R27-15 | P0     | ADR-026 vs risk-evaluation-engine.ts        | ADR 要求 8 因子风险模型(/18 除数)；代码仍为 legacy 6 因子(MAX_POSSIBLE_SCORE=75)                         |
| R27-16 | P0     | ADR-021 vs platform-contracts.ts            | ADR 要求 OperationalDirective/DecisionDirective 替代 ControlDirective——新类型完全不存在                  |
| R27-17 | P0     | ADR-021 vs platform-contracts.ts:12         | RequestEnvelope 缺 ADR 要求的 source_plane/target_plane 字段——无跨平面路由                               |
| R27-18 | P1     | ADR-027 vs plugin-definition.ts:26          | ADR 禁止 SANDBOX_NONE；代码允许 sandboxTier:"none" 跨 plugin/pack/delegation 类型                        |
| R27-19 | P1     | ADR-020 vs memory-promotion-engine.ts       | ADR 要求 evaluateDemotion()+runPromotionCycle()→PromotionResult；代码仅有同步 promote()                  |
| R27-20 | P1     | ADR-020 vs memory-layer-model.ts:48         | ADR L3→L4: accessCount≥10, qualityScore≥0.8；代码用 minHitCount:8, minQualityScore:0.75                  |
| R27-21 | P1     | ADR-025 vs policy-center/index.ts:35        | PolicyMode 保留 ADR 已删除的 supervised/degraded/maintenance/emergency 值                                |
| R27-22 | P1     | ADR-027 vs executable-contracts/index.ts:60 | PrincipalRef 缺 type discriminant——ADR 要求 6 种 typed variants                                          |
| R27-23 | P1     | ADR-029/039 vs nl-gateway/index.ts:66       | DetectedIntent 5 types 缺 ADR 要求的 cancel_task/create_goal/decompress_goal                             |
| R27-24 | P1     | ADR-064 vs cost-optimization-service.ts:24  | CostAttributionRecord 维度用 subjectType/subjectId——ADR 要求 harness_run_id/node_run_id                  |
| R27-25 | P1     | ADR-062 vs edge-runtime-sync-service.ts:39  | 冲突解决策略 taxonomy 不匹配(accept_edge/cloud/merge/reject vs last_write_wins/server_wins/merge/manual) |
| R27-26 | P1     | ADR-061 vs agent-registry/index.ts:6        | lifecycle 状态偏离：production→active, retired→archived, 多出 canary/paused                              |
| R27-27 | P2     | ADR-020 vs memory-layer-model.ts:17         | 层名不匹配：ADR L1-L6 RuntimeCache/.../Evolution vs 代码 working/session/.../meta                        |
| R27-28 | P2     | ADR-039 vs nl-gateway/index.ts:96           | RiskPreview 字段 snake_case(ADR) vs camelCase(代码)命名规范不一致                                        |
| R27-29 | P2     | ADR-026 vs risk-evaluation-engine.ts:11     | 代码注释引用旧 §10.2 权重=4；ADR 规定所有因子权重 1-3                                                    |

### §136 未审计 Contract 偏差

| #      | 严重度 | Contract + 代码文件                                                     | 问题                                                                                                                                              |
| ------ | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R27-30 | P0     | approval_and_hitl_contract vs approval-service.ts:54                    | ApprovalRequest 缺 contract 要求的 escalation_chain/timeout_auto_action/stage_view_ref/harness_run_id/node_run_id                                 |
| R27-31 | P0     | policy_engine_contract vs iam/policy-engine.ts:121                      | mode 仅3 legacy 值(supervised/auto/full-auto)；contract 要求 8 canonical modes                                                                    |
| R27-32 | P0     | policy_engine_contract vs iam/policy-engine.ts:100                      | action 缺 contract 要求值：dispatch_execution/set_isolation_level/promote_improvement/advance_rollout/modify_knowledge_trust/promote_memory_layer |
| R27-33 | P0     | policy_engine_contract vs iam/policy-engine.ts:112                      | riskCategory 缺 contract 要求的 strategy_affecting/governance_sensitive                                                                           |
| R27-34 | P0     | distributed_locking_contract vs src/                                    | LockTransitionCommand 类型完全不存在——contract 要求与 RSM.transition(command) 集成                                                                |
| R27-35 | P0     | edge_runtime_contract vs edge-runtime-sync-service.ts:8                 | EdgeRuntimeProfile 缺 contract 要求的 stateful/lease_migration_supported/checkpoint_required_before_preempt                                       |
| R27-36 | P1     | policy_engine_contract vs policy-engine.ts:134                          | PolicyDecisionResult 缺 decisionTtlMs/matchedRuleRefs；无 PolicyDecisionExplain/PolicyAuditRecord 类型                                            |
| R27-37 | P1     | policy_engine_contract vs policy-center/index.ts:35                     | PolicyMode 用非 canonical 名(read-only/maintenance/degraded/emergency vs contract 的 read_only/no-write/no-external-call/no-rollout/manual_only)  |
| R27-38 | P1     | knowledge_boundary_contract vs boundary-manager/index.ts:3              | KnowledgeBoundary 缺 contract 要求的 classification_rules/share_policy                                                                            |
| R27-39 | P1     | knowledge_boundary_contract vs src/                                     | FederatedSearchRequest/FederatedSearchResult canonical 类型不存在——用 ad-hoc 无类型接口                                                           |
| R27-40 | P1     | knowledge_boundary_contract vs src/                                     | ChineseWallConstraint canonical 类型不存在——用 inline policy objects                                                                              |
| R27-41 | P1     | org_hierarchy_contract vs org-node/index.ts:14                          | OrgNodeType 用 company/division/department/team；contract 要求 enterprise/business_unit/department/team/seat                                      |
| R27-42 | P1     | org_hierarchy_contract vs org-node/index.ts:88                          | OrgNode 缺 contract 要求的 effective_policies/status 字段                                                                                         |
| R27-43 | P1     | org_hierarchy_contract vs src/                                          | OrgHierarchySnapshot/ApprovalLimitMatrix/CompliancePolicyBinding canonical 类型不存在                                                             |
| R27-44 | P1     | approval_and_hitl_contract vs hitl-approval-orchestration-service.ts:28 | ApprovalFeedbackLink 缺 loop_iteration/ref_id/feedback_signal_id                                                                                  |
| R27-45 | P1     | slo_alerting_contract vs operations-governance-service.ts:57            | Runbook catalog 缺 contract 要求的 oapeflir_loop_stalled/rollout_blocked_or_rollback                                                              |
| R27-46 | P1     | tenant_isolation_contract vs src/                                       | 无自动隔离触发(failure_rate>30% min_sample≥20)——contract §5A 要求                                                                                 |
| R27-47 | P2     | approval_and_hitl_contract vs approval-service.ts:54                    | ApprovalRequest 用 taskId 而非 contract 的 harness_run_id 作关联键                                                                                |
| R27-48 | P2     | remote_coordination_contract vs src/                                    | Remote worker session states(connecting/connected/reconnecting/degraded/failed/viewer_only)未实现                                                 |
| R27-49 | P2     | ha_coordinator_contract vs execution/ha/types.ts:1                      | CoordinatorNode 缺 metadata 限制 follower 动作——无类型级 guard                                                                                    |

### §137 Org-Governance / Scale-Ecosystem / Interaction 缺陷

| #      | 严重度 | 文件/位置                                                                       | 问题                                                                                                |
| ------ | ------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R27-50 | P0     | interaction/proactive-agent/trigger-engine/index.ts:7                           | high-risk actions auto-execute 当 requireConfirmation=false——§42/§10 要求 high 级审批               |
| R27-51 | P0     | org-governance/sso-scim/scim-service.ts:300-325                                 | listUsers/listGroups 无租户隔离——返回所有租户用户,违反 §11 多租户安全                               |
| R27-52 | P0     | org-governance/sso-scim/api-key-service.ts:94                                   | 过期 API key 在 validateApiKey 中不标记 expired——保持 active 状态,可在竞态窗口被轮换                |
| R27-53 | P1     | org-governance/delegated-governance/governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo 条件 >=0 恒为 true(数组长度不可能负)——SLO 检查是死代码                             |
| R27-54 | P1     | org-governance/sso-scim/scim-service.ts:532                                     | SCIM patchGroup remove members 清除全部成员而非解析 path 表达式指定的特定成员                       |
| R27-55 | P1     | org-governance/sso-scim/scim-service.ts:791                                     | applyFilter 忽略属性名——displayName eq "x" 实际匹配 userName                                        |
| R27-56 | P1     | org-governance/knowledge-boundary/knowledge-boundary-service.ts:163             | requiredGrantBoundaryIds 检查逻辑错误——跨 boundary 授权请求永远失败                                 |
| R27-57 | P1     | scale-ecosystem/multi-region/region-health-check-service.ts:330                 | determineStatus 用 reference equality(===)找 regionId——永不匹配,延迟降级是死代码                    |
| R27-58 | P1     | org-governance/sso-scim/scim-service.ts:419                                     | deleteGroup 不发 provision event——与 deleteUser 发 user_deleted 不一致                              |
| R27-59 | P1     | org-governance/sso-scim/scim-service.ts:497                                     | removeMemberFromGroup 传空字符串 tenantId 给 updateGroup——审计事件无租户上下文                      |
| R27-60 | P1     | org-governance/delegated-governance/delegated-governance-service.ts:77          | checkOperation 仅评估 grantorId==="platform_team" 的护栏——忽略 §51.2 层级继承                       |
| R27-61 | P1     | interaction/autonomy/level-manager/index.ts:3                                   | AUTONOMY_LEVEL_ORDER frozen 在 index 4(>full_auto)——compareAutonomyLevels 视 frozen 为最高级别      |
| R27-62 | P2     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts:15                | Chinese Wall saga 无 prepare/commit/compensate/audit——仅纯 boolean 检查,违反 §2.4 saga              |
| R27-63 | P2     | scale-ecosystem/sla-engine/sla-operations-service.ts:111                        | preemptionCapApplied <= 对最高优先级恒 true——条件是 no-op                                           |
| R27-64 | P2     | interaction/autonomy/promotion-engine/index.ts:16                               | failedExecutions>2(strictly greater)——恰好2次失败+低rate仍可晋升                                    |
| R27-65 | P2     | org-governance/compliance-engine/evidence-collector.ts:21                       | normalizeEvidenceInput ?? "unknown" 掩盖 required 字段缺失——静默生成坏数据                          |
| R27-66 | P2     | scale-ecosystem/multi-region/cdc-replication-service.ts:277                     | 复制队列无界增长——enqueueBatch 只推不排,无背压/max_queue_depth                                      |
| R27-67 | P2     | scale-ecosystem/marketplace/catalog/index.ts:71                                 | validateListingDependencies 检查自身 compatibility 而非依赖方——逻辑反转                             |
| R27-68 | P2     | org-governance/knowledge-boundary/boundary-manager/index.ts:7                   | defaultVisibility "public" 选项存在但 canAccessKnowledgeBoundary 不检查——public boundary 仍拒绝访问 |
### §134 Execution / Model-Gateway / Ops-Maturity 缺陷

| #      | 严重度 | 文件/位置                                                               | 问题                                                                                                                          |
| ------ | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R27-01 | P0     | shared/observability/transports/fluentd-transport.ts:119                | flush() 监听 drain 事件但 socket 已可写时 drain 永不触发——Promise 永久挂起(死锁)                                              |
| R27-02 | P0     | model-gateway/provider-registry/minimax/minimax-chat-service.ts:391     | streaming 中 assertMiniMaxBusinessSuccess 异常被 generic catch 以 debug 级别吞噬——业务错误静默丢失                            |
| R27-03 | P0     | model-gateway/provider-registry/openai/openai-chat-service.ts:464       | streaming 从 first chunk 取 finalFinishReason 但首 SSE chunk finish_reason 恒为 null——content_filter/tool_calls/length 全丢失 |
| R27-04 | P1     | worker-pool/worker/worker-registry-service.ts:240                       | parseJsonArray() 无 try/catch(对比 handshake-support.ts 有)——corrupt JSON 直接 crash                                          |
| R27-05 | P1     | worker-pool/worker/ (handshake+writeback)                               | parseJsonArray/toWorkerStatus/buildAgentExecutionRecord/persistRemoteLogs 跨文件复制粘贴——维护分歧                            |
| R27-06 | P1     | worker-pool/worker/worker-registry-service.ts:577                       | getWorker() unsafe `as` cast 访问 legacy store 方法——绕过类型安全,死代码路径                                                  |
| R27-07 | P1     | agent-lifecycle/version-manager/agent-version-manager.ts:84             | assignDeploymentSlot() 在 zod-parsed 不可变对象上直接 mutate 字段——共享引用数据损坏                                           |
| R27-08 | P1     | agent-lifecycle/version-manager/agent-version-manager.ts:86-122         | assignDeploymentSlot 清除对面 slot vs switchSlot 注释"保持双活"——blue-green 语义矛盾                                          |
| R27-09 | P1     | shared/observability/transports/datadog-transport.ts:59                 | flushInternal HTTP 错误时 resolve() 静默——日志条目丢失无重试/无指标/无背压                                                    |
| R27-10 | P1     | model-gateway/provider-registry/anthropic/anthropic-chat-service.ts:463 | streaming message_delta 不提取 stop_reason/usage——finalStopReason 永为 null                                                   |
| R27-11 | P2     | drift-detection/cross-agent-analyzer/index.ts:28                        | metrics.length===1 时 bestAgentId===worstAgentId——误导输出                                                                    |
| R27-12 | P2     | drift-detection/changepoint-detector/index.ts:93                        | DRIFT_THRESHOLD+EPSILON 使阈值比文档-10%微偏——实际~-9.9999999%触发                                                            |
| R27-13 | P2     | shared/observability/transports/fluentd-transport.ts:65                 | handleConnected drain loop 无 write 错误处理——中途失败剩余条目丢失                                                            |
| R27-14 | P2     | agent-lifecycle/retirement/index.ts:45                                  | canRetireAgent ISO 字符串比较忽略时区——混合 UTC/local 结果错误                                                                |

### §135 ADR 020-039 / 061-069 偏差

| #      | 严重度 | ADR + 代码文件                              | 问题                                                                                                     |
| ------ | ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R27-15 | P0     | ADR-026 vs risk-evaluation-engine.ts        | ADR 要求 8 因子风险模型(/18 除数)；代码仍为 legacy 6 因子(MAX_POSSIBLE_SCORE=75)                         |
| R27-16 | P0     | ADR-021 vs platform-contracts.ts            | ADR 要求 OperationalDirective/DecisionDirective 替代 ControlDirective——新类型完全不存在                  |
| R27-17 | P0     | ADR-021 vs platform-contracts.ts:12         | RequestEnvelope 缺 ADR 要求的 source_plane/target_plane 字段——无跨平面路由                               |
| R27-18 | P1     | ADR-027 vs plugin-definition.ts:26          | ADR 禁止 SANDBOX_NONE；代码允许 sandboxTier:"none" 跨 plugin/pack/delegation 类型                        |
| R27-19 | P1     | ADR-020 vs memory-promotion-engine.ts       | ADR 要求 evaluateDemotion()+runPromotionCycle()→PromotionResult；代码仅有同步 promote()                  |
| R27-20 | P1     | ADR-020 vs memory-layer-model.ts:48         | ADR L3→L4: accessCount≥10, qualityScore≥0.8；代码用 minHitCount:8, minQualityScore:0.75                  |
| R27-21 | P1     | ADR-025 vs policy-center/index.ts:35        | PolicyMode 保留 ADR 已删除的 supervised/degraded/maintenance/emergency 值                                |
| R27-22 | P1     | ADR-027 vs executable-contracts/index.ts:60 | PrincipalRef 缺 type discriminant——ADR 要求 6 种 typed variants                                          |
| R27-23 | P1     | ADR-029/039 vs nl-gateway/index.ts:66       | DetectedIntent 5 types 缺 ADR 要求的 cancel_task/create_goal/decompress_goal                             |
| R27-24 | P1     | ADR-064 vs cost-optimization-service.ts:24  | CostAttributionRecord 维度用 subjectType/subjectId——ADR 要求 harness_run_id/node_run_id                  |
| R27-25 | P1     | ADR-062 vs edge-runtime-sync-service.ts:39  | 冲突解决策略 taxonomy 不匹配(accept_edge/cloud/merge/reject vs last_write_wins/server_wins/merge/manual) |
| R27-26 | P1     | ADR-061 vs agent-registry/index.ts:6        | lifecycle 状态偏离：production→active, retired→archived, 多出 canary/paused                              |
| R27-27 | P2     | ADR-020 vs memory-layer-model.ts:17         | 层名不匹配：ADR L1-L6 RuntimeCache/.../Evolution vs 代码 working/session/.../meta                        |
| R27-28 | P2     | ADR-039 vs nl-gateway/index.ts:96           | RiskPreview 字段 snake_case(ADR) vs camelCase(代码)命名规范不一致                                        |
| R27-29 | P2     | ADR-026 vs risk-evaluation-engine.ts:11     | 代码注释引用旧 §10.2 权重=4；ADR 规定所有因子权重 1-3                                                    |

### §136 未审计 Contract 偏差

| #      | 严重度 | Contract + 代码文件                                                     | 问题                                                                                                                                              |
| ------ | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| R27-30 | P0     | approval_and_hitl_contract vs approval-service.ts:54                    | ApprovalRequest 缺 contract 要求的 escalation_chain/timeout_auto_action/stage_view_ref/harness_run_id/node_run_id                                 |
| R27-31 | P0     | policy_engine_contract vs iam/policy-engine.ts:121                      | mode 仅3 legacy 值(supervised/auto/full-auto)；contract 要求 8 canonical modes                                                                    |
| R27-32 | P0     | policy_engine_contract vs iam/policy-engine.ts:100                      | action 缺 contract 要求值：dispatch_execution/set_isolation_level/promote_improvement/advance_rollout/modify_knowledge_trust/promote_memory_layer |
| R27-33 | P0     | policy_engine_contract vs iam/policy-engine.ts:112                      | riskCategory 缺 contract 要求的 strategy_affecting/governance_sensitive                                                                           |
| R27-34 | P0     | distributed_locking_contract vs src/                                    | LockTransitionCommand 类型完全不存在——contract 要求与 RSM.transition(command) 集成                                                                |
| R27-35 | P0     | edge_runtime_contract vs edge-runtime-sync-service.ts:8                 | EdgeRuntimeProfile 缺 contract 要求的 stateful/lease_migration_supported/checkpoint_required_before_preempt                                       |
| R27-36 | P1     | policy_engine_contract vs policy-engine.ts:134                          | PolicyDecisionResult 缺 decisionTtlMs/matchedRuleRefs；无 PolicyDecisionExplain/PolicyAuditRecord 类型                                            |
| R27-37 | P1     | policy_engine_contract vs policy-center/index.ts:35                     | PolicyMode 用非 canonical 名(read-only/maintenance/degraded/emergency vs contract 的 read_only/no-write/no-external-call/no-rollout/manual_only)  |
| R27-38 | P1     | knowledge_boundary_contract vs boundary-manager/index.ts:3              | KnowledgeBoundary 缺 contract 要求的 classification_rules/share_policy                                                                            |
| R27-39 | P1     | knowledge_boundary_contract vs src/                                     | FederatedSearchRequest/FederatedSearchResult canonical 类型不存在——用 ad-hoc 无类型接口                                                           |
| R27-40 | P1     | knowledge_boundary_contract vs src/                                     | ChineseWallConstraint canonical 类型不存在——用 inline policy objects                                                                              |
| R27-41 | P1     | org_hierarchy_contract vs org-node/index.ts:14                          | OrgNodeType 用 company/division/department/team；contract 要求 enterprise/business_unit/department/team/seat                                      |
| R27-42 | P1     | org_hierarchy_contract vs org-node/index.ts:88                          | OrgNode 缺 contract 要求的 effective_policies/status 字段                                                                                         |
| R27-43 | P1     | org_hierarchy_contract vs src/                                          | OrgHierarchySnapshot/ApprovalLimitMatrix/CompliancePolicyBinding canonical 类型不存在                                                             |
| R27-44 | P1     | approval_and_hitl_contract vs hitl-approval-orchestration-service.ts:28 | ApprovalFeedbackLink 缺 loop_iteration/ref_id/feedback_signal_id                                                                                  |
| R27-45 | P1     | slo_alerting_contract vs operations-governance-service.ts:57            | Runbook catalog 缺 contract 要求的 oapeflir_loop_stalled/rollout_blocked_or_rollback                                                              |
| R27-46 | P1     | tenant_isolation_contract vs src/                                       | 无自动隔离触发(failure_rate>30% min_sample≥20)——contract §5A 要求                                                                                 |
| R27-47 | P2     | approval_and_hitl_contract vs approval-service.ts:54                    | ApprovalRequest 用 taskId 而非 contract 的 harness_run_id 作关联键                                                                                |
| R27-48 | P2     | remote_coordination_contract vs src/                                    | Remote worker session states(connecting/connected/reconnecting/degraded/failed/viewer_only)未实现                                                 |
| R27-49 | P2     | ha_coordinator_contract vs execution/ha/types.ts:1                      | CoordinatorNode 缺 metadata 限制 follower 动作——无类型级 guard                                                                                    |

### §137 Org-Governance / Scale-Ecosystem / Interaction 缺陷

| #      | 严重度 | 文件/位置                                                                       | 问题                                                                                                |
| ------ | ------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| R27-50 | P0     | interaction/proactive-agent/trigger-engine/index.ts:7                           | high-risk actions auto-execute 当 requireConfirmation=false——§42/§10 要求 high 级审批               |
| R27-51 | P0     | org-governance/sso-scim/scim-service.ts:300-325                                 | listUsers/listGroups 无租户隔离——返回所有租户用户,违反 §11 多租户安全                               |
| R27-52 | P0     | org-governance/sso-scim/api-key-service.ts:94                                   | 过期 API key 在 validateApiKey 中不标记 expired——保持 active 状态,可在竞态窗口被轮换                |
| R27-53 | P1     | org-governance/delegated-governance/governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo 条件 >=0 恒为 true(数组长度不可能负)——SLO 检查是死代码                             |
| R27-54 | P1     | org-governance/sso-scim/scim-service.ts:532                                     | SCIM patchGroup remove members 清除全部成员而非解析 path 表达式指定的特定成员                       |
| R27-55 | P1     | org-governance/sso-scim/scim-service.ts:791                                     | applyFilter 忽略属性名——displayName eq "x" 实际匹配 userName                                        |
| R27-56 | P1     | org-governance/knowledge-boundary/knowledge-boundary-service.ts:163             | requiredGrantBoundaryIds 检查逻辑错误——跨 boundary 授权请求永远失败                                 |
| R27-57 | P1     | scale-ecosystem/multi-region/region-health-check-service.ts:330                 | determineStatus 用 reference equality(===)找 regionId——永不匹配,延迟降级是死代码                    |
| R27-58 | P1     | org-governance/sso-scim/scim-service.ts:419                                     | deleteGroup 不发 provision event——与 deleteUser 发 user_deleted 不一致                              |
| R27-59 | P1     | org-governance/sso-scim/scim-service.ts:497                                     | removeMemberFromGroup 传空字符串 tenantId 给 updateGroup——审计事件无租户上下文                      |
| R27-60 | P1     | org-governance/delegated-governance/delegated-governance-service.ts:77          | checkOperation 仅评估 grantorId==="platform_team" 的护栏——忽略 §51.2 层级继承                       |
| R27-61 | P1     | interaction/autonomy/level-manager/index.ts:3                                   | AUTONOMY_LEVEL_ORDER frozen 在 index 4(>full_auto)——compareAutonomyLevels 视 frozen 为最高级别      |
| R27-62 | P2     | org-governance/knowledge-boundary/chinese-wall-access-saga.ts:15                | Chinese Wall saga 无 prepare/commit/compensate/audit——仅纯 boolean 检查,违反 §2.4 saga              |
| R27-63 | P2     | scale-ecosystem/sla-engine/sla-operations-service.ts:111                        | preemptionCapApplied <= 对最高优先级恒 true——条件是 no-op                                           |
| R27-64 | P2     | interaction/autonomy/promotion-engine/index.ts:16                               | failedExecutions>2(strictly greater)——恰好2次失败+低rate仍可晋升                                    |
| R27-65 | P2     | org-governance/compliance-engine/evidence-collector.ts:21                       | normalizeEvidenceInput ?? "unknown" 掩盖 required 字段缺失——静默生成坏数据                          |
| R27-66 | P2     | scale-ecosystem/multi-region/cdc-replication-service.ts:277                     | 复制队列无界增长——enqueueBatch 只推不排,无背压/max_queue_depth                                      |
| R27-67 | P2     | scale-ecosystem/marketplace/catalog/index.ts:71                                 | validateListingDependencies 检查自身 compatibility 而非依赖方——逻辑反转                             |
| R27-68 | P2     | org-governance/knowledge-boundary/boundary-manager/index.ts:7                   | defaultVisibility "public" 选项存在但 canAccessKnowledgeBoundary 不检查——public boundary 仍拒绝访问 |

### §139 State-Evidence / Repository SQL 缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                        |
| ------ | ------ | --------------------------------- | --------------------------------------------------------------------------- |
| R28-01 | P0     | release-repository.ts:65          | INSERT 26列但仅25个 VALUES 占位符($1-$25)——exported_at 无 $26,INSERT 恒失败 |
| R28-02 | P0     | release-repository.ts:105         | INSERT 28列但仅27个 VALUES 占位符($1-$27)——同类 off-by-one,INSERT 恒失败    |
| R28-03 | P0     | release-repository.ts:228         | `WHERE environment IS $1`——无效 PG 语法(IS 仅接 NULL/TRUE/FALSE 字面量)     |
| R28-04 | P0     | marketplace-repository.ts:169+8处 | `tenant_id IS $N`——无效 PG 语法,影响9个查询位置                             |
| R28-05 | P0     | operations-repository.ts:175+2处  | `tenant_id IS $N`——无效 PG 语法,影响3个查询位置                             |
| R28-06 | P1     | prompt-repository.ts:266          | setCurrentVersion 两次 UPDATE 无事务——并发可导致 0 或多个 current version   |
| R28-07 | P1     | prompt-repository.ts:191,215,240  | PG async repo 用 SQLite boolean 字面量 `deprecated = 0`——PG 需 `= false`    |
| R28-08 | P1     | prompt-repository.ts:329          | `is_current = 1` SQLite 风格——PG boolean 需 `= true`                        |
| R28-09 | P2     | marketplace-repository-ext.ts:344 | listDownloadsByListing limit 无 sanitization(无 Math.max/Math.trunc)        |
| R28-10 | P2     | prompt-repository.ts:62,250,340   | 直接 this.conn.execute() 跳过 asyncExecute() helper——不一致                 |

### §140 Prompt-Engine / Plugins / SDK / Channel-Gateway 缺陷

| #      | 严重度 | 文件/位置                                                   | 问题                                                                                  |
| ------ | ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R28-11 | P0     | plugins/adapters/crm-adapter.ts:56                          | action 参数未过滤直接拼入 URL 路径(`/crm/v3/objects/${action}`)——路径遍历到任意 API   |
| R28-12 | P0     | plugins/adapters/crm-adapter.ts:55                          | execute() 不检查 credentialFingerprint——未认证即执行(github-adapter 有门控)           |
| R28-13 | P0     | plugins/adapters/game-dev-adapter.ts:29                     | execute() 无 auth 检查+无 egress policy——任何调用者可无认证调用                       |
| R28-14 | P0     | plugins/adapters/asset-production-adapter.ts:29             | execute() 无 auth 检查+无 egress policy——同上                                         |
| R28-15 | P0     | plugins/adapters/livestream-adapter.ts:30                   | execute() 无 auth 检查+无 egress policy——同上                                         |
| R28-16 | P0     | channel-gateway-delivery-service.ts:287                     | generateNonce `randomBytes(len).toString("hex").slice(0,len)` 熵减半(32 hex=16 bytes) |
| R28-17 | P1     | prompt-engine/rollout/prompt-rollout-stage.ts:26            | nextPromptRolloutStage("stable") 返回 "rolled_back"——terminal 阶段应返回 null         |
| R28-18 | P1     | prompt-engine/registry/hierarchical-registry-service.ts:395 | findBundle 接受 version 参数但从不使用——总返回默认 bundle 忽略版本请求                |
| R28-19 | P1     | prompt-engine/registry/prompt-version-manager.ts:89         | compareVersions 文档说返回 -1/0/1 但返回原始差值(如5)——调用方依赖符号会 break         |
| R28-20 | P1     | plugins/adapters/game-dev+asset+livestream:authenticate()   | authenticate() 是 no-op——凭证接受但从不验证或存储                                     |
| R28-21 | P1     | plugins/adapters/game-dev+asset+livestream:healthCheck()    | healthCheck() 硬编码 return true——永不验证连通性,掩盖故障                             |
| R28-22 | P1     | prompt-engine/registry/prompt-version-manager.ts:234        | VersionLineage interface 重复声明(line 18 和 234)——类型冲突/覆盖                      |
| R28-23 | P1     | sdk/pack-sdk/pack-scaffold-service.ts:267                   | packId 含 $ 字符时 regex replace 静默损坏生成代码                                     |
| R28-24 | P2     | prompt-engine/registry/prompt-version-manager.ts:42         | versionCache Map 声明但从未 populate/read——死代码                                     |
| R28-25 | P2     | channel-gateway/websocket-bridge.ts:99                      | JWT token 作 URL query 参数——泄漏到 access log/referrer header                        |
| R28-26 | P2     | plugins/adapters/crm-adapter.ts:61                          | execute() 返回硬编码 stub 字符串"CRM ${action} stub"——生产代码返回假数据              |
| R28-27 | P2     | channel-gateway-delivery-service.ts:336                     | createDeliveryMessage 创建时即设 finalStatus:"success"——未投递就标记成功              |
| R28-28 | P2     | sdk/pack-sdk/pack-scaffold-service.ts:302                   | packId regex 允许点和下划线——拼入目录路径时产生歧义                                   |

### §141 UI Deep Dive 缺陷

| #      | 严重度 | 文件/位置                                  | 问题                                                                                |
| ------ | ------ | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| R28-29 | P0     | shared/platform/web-platform-adapter.ts:9  | "Secure" 值存 plaintext localStorage(`aa.secure.*`)——XSS 可直接读取                 |
| R28-30 | P0     | shared/auth/auth-service.ts:37             | handleSsoCallback 参数缺失时回退到硬编码 "mock-access-token"——生产 SSO 返回假 token |
| R28-31 | P0     | apps/web/runtime.ts:44-46                  | wsUrl 配置被忽略——两个分支创建相同 BrowserWSClient(WebSocket, InMemoryWSClient())   |
| R28-32 | P0     | apps/web/app-shell.tsx:1-124               | 无 ErrorBoundary——未捕获渲染错误导致整个 UI 白屏崩溃                                |
| R28-33 | P1     | shared/sync/conflict-resolver.ts:15        | spec 要求 CRDT 冲突解决；merge 策略仅 shallow spread({...server,...local})——非 CRDT |
| R28-34 | P1     | features/hitl/hooks/index.ts:5-13          | HITL hook 返回硬编码静态字符串——无 API 调用/无状态/完全惰性                         |
| R28-35 | P1     | features/approval/hooks/index.ts:80-85     | approve()/reject() 仅更新本地 state 不调 REST API——审批决策静默丢弃                 |
| R28-36 | P1     | shared/auth/auth-service.ts:7              | refreshToken 存储但从不使用——无 token 刷新流程,过期即断线                           |
| R28-37 | P1     | shared/api-client/interceptors.ts:65       | offline queue interceptor enqueue 后仍放行请求到网络(无 early return)——重复提交     |
| R28-38 | P1     | apps/web/app-shell.tsx:8-22                | Guard context 硬编码全部权限——无动态用户权限解析,所有功能对所有人开放               |
| R28-39 | P1     | ui-core/index.tsx:61                       | 所有 feature 设 codeSplit:false——无路由级代码分割,违反 <200KB bundle 预算           |
| R28-40 | P1     | features/approval/web/index.tsx:46         | Delegate input 无 aria-label；Approve/Reject 无 aria-describedby——WCAG 2.1 AA 缺口  |
| R28-41 | P1     | features/alerts/hooks/index.ts:19-21       | alerts VM 只读；ack/mute/escalate 按钮从不调后端 API                                |
| R28-42 | P2     | shared/telemetry/index.ts:28               | TelemetrySink.record() void Promise.all——export 错误静默丢失                        |
| R28-43 | P2     | ui-core/components/index.ts:28             | ListCard 用 item.title 作 React key——重复标题导致 key 冲突和渲染 bug                |
| R28-44 | P2     | shared/sync/offline-queue.ts:19-22         | enqueue() 同步但 void persist()——标签关闭前 mutation 可丢失                         |
| R28-45 | P2     | features/conversation/hooks/index.ts:19    | ConversationClient per-hook useMemo 实例化——无共享实例,remount 丢状态               |
| R28-46 | P2     | ui-core/themes/index.ts:1-50               | resolveTheme 存在但 designTokens 是模块常量——组件直接 import,切换主题无效           |
| R28-47 | P2     | features/task-cockpit/hooks/index.ts:58-63 | claimTask/escalateTask 仅本地 mutate——无 API/无乐观更新回滚                         |

### §142 Tests / Config / Bootstrap 缺陷

| #      | 严重度 | 文件/位置                                                          | 问题                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| R28-48 | P0     | tests/integration/security/input-validation.test.ts:414            | "blocks control characters" 测试用 maliciousCommand="echo"(干净字符串)断言 blocked——验证错误行为为正确 |
| R28-49 | P0     | platform-architecture-bootstrap.ts:150                             | getPlatformArchitectureServices 每次调用重新 register——掩盖幂等性 bug                                  |
| R28-50 | P0     | shared/lifecycle/service-registry.ts:146                           | register() 条件 `if(!has(name)){delete(name)}`——反逻辑,stale 实例永不被重注册驱逐                      |
| R28-51 | P1     | tests/integration/orchestration/\*-integration.test.ts             | "Integration" 测试零真实服务导入——全部 mock 对象+手动赋值,实为 unit test                               |
| R28-52 | P1     | tests/integration/stability/\*-integration.test.ts                 | 同上：仅测试数据结构构造,无真实服务集成                                                                |
| R28-53 | P1     | config/security/default.json:7                                     | allowedCapabilities 含 "mcp" 但无 MCP 沙箱约束/速率限制/egress policy                                  |
| R28-54 | P1     | config/risk/default.json:62-66                                     | riskLevelActions.medium autoExecute:true + requiresApproval:false——中风险操作无审批自动执行            |
| R28-55 | P1     | config/gateways/default.json:3                                     | sseEnabled:true 无 sseMaxConnections/sseIdleTimeoutMs——资源耗尽攻击向量                                |
| R28-56 | P1     | config/runtime/default.json:2                                      | maxConcurrentTasks:1——无法验证并发行为,无集成测试覆盖并发场景                                          |
| R28-57 | P1     | divisions/ trigger overlap                                         | "fix" 同时匹配 engineering_ops(pri50)+support(pri25)；"bug" 匹配3个 division——无消歧测试               |
| R28-58 | P1     | tests/integration/security/                                        | 无 sandbox deniedRoots:[] 测试——默认配置 workspace_write 模式下 /etc /proc /sys 未显式拒绝             |
| R28-59 | P2     | config/bootstrap/default.json:3                                    | phase:"phase_1a" 固定——无配置级 guard 阻止此早期 phase 进入生产                                        |
| R28-60 | P2     | config/domains/default.json:96                                     | coding domain 含 shell_exec 工具但 securityLevel:"standard"——应为 "elevated"                           |
| R28-61 | P2     | tests/integration/plugins/plugin-execution-integration.test.ts:138 | 硬编码 `ghp_test_token_12345`——匹配 GitHub PAT 前缀,可触发 secret scanner                              |
| R28-62 | P2     | shared/lifecycle/service-registry.ts:316                           | topological sort 循环依赖仅 warn 不 throw——静默允许破坏 teardown 顺序                                  |
| R28-63 | P2     | divisions/operations/division.yaml:11                              | "deployment" trigger 同时匹配 operations(pri20)+devops(pri45)——路由歧义                                |

### §144 Orchestration / Planner / Escalation / Learn / Improve-Rollout 缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                                        |
| ------ | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R29-01 | P0     | learning-artifact-model.ts:74            | fallback checksum 用 learningObjectId 填充(含 `_`/`g-z`)——不满足 `^[a-f0-9]{64}$` 校验恒 throw              |
| R29-02 | P1     | plan-strategy-selector.ts:23             | hierarchical 策略在 critical-risk 检查前选定——critical-risk multi-division 得到 hierarchical 而非 reflexive |
| R29-03 | P1     | plan-builder.ts:41-50                    | DAG valid===false 时仍用 orderedSteps 构建 plan——循环图/缺失依赖被静默接受                                  |
| R29-04 | P1     | rollout-state-machine.ts:29              | paused 可直接跳转 stable——绕过 canary→partial→stable 渐进发布                                               |
| R29-05 | P1     | autonomy-boundary-policy.ts:31           | learningObjects.every() 对空数组返回 true——零证据即允许 auto-rollout                                        |
| R29-06 | P1     | knowledge-promotion-service.ts:102       | batch promotion event 仅引用 learningObjects[0]——误导下游 consumer                                          |
| R29-07 | P1     | escalation/index.ts:5-14                 | EscalationRequest 无 SLA/timeout 字段；decide() 无超时/SLA-aware 路由                                       |
| R29-08 | P1     | policy-rollout-service.ts:59             | approval gate 仅对 shadow 级强制——非 shadow 的 candidate 可直接 start() 跳过审批                            |
| R29-09 | P2     | truncation-detector.ts:26                | finishReasonLength 计算后从未引用——死代码                                                                   |
| R29-10 | P2     | plan-repository.ts:6-10                  | save() 无去重——同一 plan 多次 save 产生重复条目                                                             |
| R29-11 | P2     | plan-evaluator.ts:23                     | 资源估算 flat `steps.length*1000`——忽略 per-step 工具差异,系统性低估                                        |
| R29-12 | P2     | canary-traffic-router.ts:32              | hashToBucket 弱乘法哈希(\*31)——短 taskId 产生非均匀分布,偏斜 canary 流量                                    |
| R29-13 | P2     | experience-distillation-service.ts:22-30 | buildRecommendation 仅处理 failure_pattern/recovery_playbook——3种类型落入 generic default                   |

### §145 Dispatcher / HA / Recovery / State-Transition 缺陷

| #      | 严重度 | 文件/位置                                     | 问题                                                                                               |
| ------ | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| R29-14 | P0     | ha-coordinator-service-inner.ts:353           | renewLeadership 返回 fencingToken=currentLease.ttlMs——TTL 毫秒值冒充 fencing token                 |
| R29-15 | P1     | ha-coordinator-service-inner.ts:77,701        | fencingTokenCounter 每次实例化重置——重启后重发旧 token,破坏 fencing 安全                           |
| R29-16 | P1     | ha-coordinator-service-inner.ts:530-543       | authorizeAction leader_only: activeLease===null 时 fallthrough 到 authorized:true——无 lease 即授权 |
| R29-17 | P1     | cross-region-event-replication-service.ts:178 | processReplicationQueue() async 无 await——Promise 丢弃,错误静默,replicate() 提前返回               |
| R29-18 | P1     | patch-bundle.ts:107                           | 错误消息 copy-paste bug: 显示实际值两次,不显示限制值                                               |
| R29-19 | P1     | exception-recovery-config-loader.ts:28        | 模块级 cachedConfig 忽略 configPath 参数——第二次不同路径调用静默返回 stale config                  |
| R29-20 | P1     | cross-region-deployment-service.ts:548-558    | completeFailoverStep failure 时剩余 steps 保持 "pending"——不标记 "skipped",状态不一致              |
| R29-21 | P1     | ha-coordinator-service-inner.ts:640-648       | triggerFailover 记录 FailoverDecision 用 stale fencingToken(acquireLeadership 前的值)              |
| R29-22 | P2     | execution-recovery-worker.ts:49-54            | runRecoveryCycle 列出候选但从不执行恢复动作——itemsRecovered 是计数非实际恢复                       |
| R29-23 | P2     | cross-region-event-replication-service.ts:356 | retry setTimeout 重入 processReplicationQueue 但队列已排空——重试是 no-op                           |

### §146 Interaction / API Routes / NL-Gateway / Dashboard 缺陷

| #      | 严重度 | 文件/位置                             | 问题                                                                                   |
| ------ | ------ | ------------------------------------- | -------------------------------------------------------------------------------------- |
| R29-24 | P0     | billing-routes.ts:47-51               | 任何 Authorization/x-api-key header(即使无效)即跳过 webhook 签名验证——auth bypass      |
| R29-25 | P0     | request-helpers.ts:19                 | matchRoute 仅允许 GET/POST/OPTIONS——所有 PATCH/PUT/DELETE 路由不可达(死代码)           |
| R29-26 | P1     | conversation-history-service.ts:207   | getSession 忽略 tenantId——任何租户可检索任何 session(IDOR)                             |
| R29-27 | P1     | task-routes.ts:255-256                | PATCH title: 调用 updateTaskInput 传旧 inputJson,新 title 从未写入——更新是 no-op       |
| R29-28 | P1     | intent-parser/index.ts:17             | fallback normalized.length>12 一律 classify 为 task_create——误分类                     |
| R29-29 | P1     | nl-gateway/index.ts:1-2               | named export detectAmbiguity 覆盖 `export *` 中同名——调用方获得错误实现                |
| R29-30 | P1     | dashboard-websocket-server.ts:337-345 | performHeartbeat 标记超时 client isConnected=false 但不移除——死连接累积阻塞 maxClients |
| R29-31 | P1     | conversation-history-service.ts:121   | memoryLayer==="layer_3"时 addTurn 跳过持久化——但 persistSession 默认 layer_3,逻辑矛盾  |
| R29-32 | P2     | incident-routes.ts:86                 | incidentId 无 validation(task routes 有 validateTaskId)——不一致                        |
| R29-33 | P2     | incident-routes.ts:91                 | 用户提供的 incidentId 直接反射到错误消息——日志注入/信息泄漏                            |
| R29-34 | P2     | conversation-history-service.ts:246   | listUserSessions limit 在排序前截断——返回任意子集而非最新 N 条                         |
| R29-35 | P2     | ux-event-tracking-service.ts:91       | eventLog 数组无界增长无驱逐——长时间运行进程内存泄漏                                    |
| R29-36 | P2     | ux-event-tracking-service.ts:122      | UX analytics 发布硬编码 "test:many_events" type via `as any`——生产错误事件类型         |
| R29-37 | P2     | task-routes.ts:73                     | 内部 hardcoded limit:200——>200 tasks 在 cursor 分页前静默截断                          |
| R29-38 | P2     | billing-routes.ts:39-106              | /billing/ 和 /v1/billing/ 逻辑完全重复——维护风险                                       |
| R29-39 | P2     | prompt-routes.ts:12                   | schema .passthrough() + `payload as any`——任意字段未验证直接转发 registry              |

### §147 Compliance / Model-Gateway / Incident-Control / IAM / Chaos 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                                                       |
| ------ | ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R29-40 | P0     | auto-stop-loss-service.ts:731             | approvePendingExecution 标记 approved 但从不执行保护动作——审批是 no-op                                     |
| R29-41 | P0     | degradation-controller.ts:430             | deescalate() 重置 consecutiveHealthyCount=0 后引用——报告永远显示 recovered_after_0                         |
| R29-42 | P1     | auto-stop-loss-service.ts:715             | getHourKey month+day 无分隔符——1月11日与11月1日碰撞,速率限制被绕过                                         |
| R29-43 | P1     | auto-stop-loss-service.ts:627             | 人工审批路径不调 lastExecutionTime.set()——审批后 playbook 冷却期不生效                                     |
| R29-44 | P1     | tenant-execution-isolation-service.ts:323 | usage.status==="critical" 重置 overallStatus="active"——反逻辑,critical 应升级非重置                        |
| R29-45 | P1     | unified-chat-provider.ts:329              | MiniMax streaming 始终 isFinal=false——consumer 永收不到流结束信号                                          |
| R29-46 | P1     | model-routing-service.ts:343              | compareProfiles 次排序 a.maxOutputTokens-b.maxOutputTokens 偏好较低值——注释说 higher=more capable,排序反转 |
| R29-47 | P1     | chaos-experiment-scheduler.ts:148         | 完成检查不按 hypothesis name 去重——重复调用同 hypothesis 触发 premature completion                         |
| R29-48 | P1     | data-classification-service.ts:720        | matchesRule 将用户 rule.patterns 直接传给 new RegExp()——ReDoS via defineRule()                             |
| R29-49 | P1     | auto-stop-loss-service.ts:619             | 升级级别用 string.includes("emergency")——应使用 severity 参数而非字符串匹配                                |
| R29-50 | P1     | cve-intelligence-service.ts:281           | source.url! non-null assertion 但 CveSourceConfig.url 是 optional——undefined 传入 fetch crash              |
| R29-51 | P1     | vault-http-secret-provider.ts:209         | 单段 ref `secret://mykey` 产生空路径段 `secret/data/`——Vault 返回 404                                      |
| R29-52 | P2     | degradation-controller.ts:236             | D0 failure 递归 this.route 最多4层无显式深度 guard——修改 enum 可致栈溢出                                   |
| R29-53 | P2     | compliance-report-pipeline-service.ts:119 | ISO 日期字典序比较在混合时区/精度下失败                                                                    |
| R29-54 | P2     | auto-stop-loss-service.ts:697             | executionHistory splice O(n) shift each recordEvent + executionCounts map key 永不清理                     |
| R29-55 | P2     | audit-event-integrity.ts:256              | latestChainHash 从未排序 entries.at(-1) 读取——输入非预排序时报告错误 hash                                  |
### §144 Orchestration / Planner / Escalation / Learn / Improve-Rollout 缺陷

| #      | 严重度 | 文件/位置                                | 问题                                                                                                        |
| ------ | ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R29-01 | P0     | learning-artifact-model.ts:74            | fallback checksum 用 learningObjectId 填充(含 `_`/`g-z`)——不满足 `^[a-f0-9]{64}$` 校验恒 throw              |
| R29-02 | P1     | plan-strategy-selector.ts:23             | hierarchical 策略在 critical-risk 检查前选定——critical-risk multi-division 得到 hierarchical 而非 reflexive |
| R29-03 | P1     | plan-builder.ts:41-50                    | DAG valid===false 时仍用 orderedSteps 构建 plan——循环图/缺失依赖被静默接受                                  |
| R29-04 | P1     | rollout-state-machine.ts:29              | paused 可直接跳转 stable——绕过 canary→partial→stable 渐进发布                                               |
| R29-05 | P1     | autonomy-boundary-policy.ts:31           | learningObjects.every() 对空数组返回 true——零证据即允许 auto-rollout                                        |
| R29-06 | P1     | knowledge-promotion-service.ts:102       | batch promotion event 仅引用 learningObjects[0]——误导下游 consumer                                          |
| R29-07 | P1     | escalation/index.ts:5-14                 | EscalationRequest 无 SLA/timeout 字段；decide() 无超时/SLA-aware 路由                                       |
| R29-08 | P1     | policy-rollout-service.ts:59             | approval gate 仅对 shadow 级强制——非 shadow 的 candidate 可直接 start() 跳过审批                            |
| R29-09 | P2     | truncation-detector.ts:26                | finishReasonLength 计算后从未引用——死代码                                                                   |
| R29-10 | P2     | plan-repository.ts:6-10                  | save() 无去重——同一 plan 多次 save 产生重复条目                                                             |
| R29-11 | P2     | plan-evaluator.ts:23                     | 资源估算 flat `steps.length*1000`——忽略 per-step 工具差异,系统性低估                                        |
| R29-12 | P2     | canary-traffic-router.ts:32              | hashToBucket 弱乘法哈希(\*31)——短 taskId 产生非均匀分布,偏斜 canary 流量                                    |
| R29-13 | P2     | experience-distillation-service.ts:22-30 | buildRecommendation 仅处理 failure_pattern/recovery_playbook——3种类型落入 generic default                   |

### §145 Dispatcher / HA / Recovery / State-Transition 缺陷

| #      | 严重度 | 文件/位置                                     | 问题                                                                                               |
| ------ | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| R29-14 | P0     | ha-coordinator-service-inner.ts:353           | renewLeadership 返回 fencingToken=currentLease.ttlMs——TTL 毫秒值冒充 fencing token                 |
| R29-15 | P1     | ha-coordinator-service-inner.ts:77,701        | fencingTokenCounter 每次实例化重置——重启后重发旧 token,破坏 fencing 安全                           |
| R29-16 | P1     | ha-coordinator-service-inner.ts:530-543       | authorizeAction leader_only: activeLease===null 时 fallthrough 到 authorized:true——无 lease 即授权 |
| R29-17 | P1     | cross-region-event-replication-service.ts:178 | processReplicationQueue() async 无 await——Promise 丢弃,错误静默,replicate() 提前返回               |
| R29-18 | P1     | patch-bundle.ts:107                           | 错误消息 copy-paste bug: 显示实际值两次,不显示限制值                                               |
| R29-19 | P1     | exception-recovery-config-loader.ts:28        | 模块级 cachedConfig 忽略 configPath 参数——第二次不同路径调用静默返回 stale config                  |
| R29-20 | P1     | cross-region-deployment-service.ts:548-558    | completeFailoverStep failure 时剩余 steps 保持 "pending"——不标记 "skipped",状态不一致              |
| R29-21 | P1     | ha-coordinator-service-inner.ts:640-648       | triggerFailover 记录 FailoverDecision 用 stale fencingToken(acquireLeadership 前的值)              |
| R29-22 | P2     | execution-recovery-worker.ts:49-54            | runRecoveryCycle 列出候选但从不执行恢复动作——itemsRecovered 是计数非实际恢复                       |
| R29-23 | P2     | cross-region-event-replication-service.ts:356 | retry setTimeout 重入 processReplicationQueue 但队列已排空——重试是 no-op                           |

### §146 Interaction / API Routes / NL-Gateway / Dashboard 缺陷

| #      | 严重度 | 文件/位置                             | 问题                                                                                   |
| ------ | ------ | ------------------------------------- | -------------------------------------------------------------------------------------- |
| R29-24 | P0     | billing-routes.ts:47-51               | 任何 Authorization/x-api-key header(即使无效)即跳过 webhook 签名验证——auth bypass      |
| R29-25 | P0     | request-helpers.ts:19                 | matchRoute 仅允许 GET/POST/OPTIONS——所有 PATCH/PUT/DELETE 路由不可达(死代码)           |
| R29-26 | P1     | conversation-history-service.ts:207   | getSession 忽略 tenantId——任何租户可检索任何 session(IDOR)                             |
| R29-27 | P1     | task-routes.ts:255-256                | PATCH title: 调用 updateTaskInput 传旧 inputJson,新 title 从未写入——更新是 no-op       |
| R29-28 | P1     | intent-parser/index.ts:17             | fallback normalized.length>12 一律 classify 为 task_create——误分类                     |
| R29-29 | P1     | nl-gateway/index.ts:1-2               | named export detectAmbiguity 覆盖 `export *` 中同名——调用方获得错误实现                |
| R29-30 | P1     | dashboard-websocket-server.ts:337-345 | performHeartbeat 标记超时 client isConnected=false 但不移除——死连接累积阻塞 maxClients |
| R29-31 | P1     | conversation-history-service.ts:121   | memoryLayer==="layer_3"时 addTurn 跳过持久化——但 persistSession 默认 layer_3,逻辑矛盾  |
| R29-32 | P2     | incident-routes.ts:86                 | incidentId 无 validation(task routes 有 validateTaskId)——不一致                        |
| R29-33 | P2     | incident-routes.ts:91                 | 用户提供的 incidentId 直接反射到错误消息——日志注入/信息泄漏                            |
| R29-34 | P2     | conversation-history-service.ts:246   | listUserSessions limit 在排序前截断——返回任意子集而非最新 N 条                         |
| R29-35 | P2     | ux-event-tracking-service.ts:91       | eventLog 数组无界增长无驱逐——长时间运行进程内存泄漏                                    |
| R29-36 | P2     | ux-event-tracking-service.ts:122      | UX analytics 发布硬编码 "test:many_events" type via `as any`——生产错误事件类型         |
| R29-37 | P2     | task-routes.ts:73                     | 内部 hardcoded limit:200——>200 tasks 在 cursor 分页前静默截断                          |
| R29-38 | P2     | billing-routes.ts:39-106              | /billing/ 和 /v1/billing/ 逻辑完全重复——维护风险                                       |
| R29-39 | P2     | prompt-routes.ts:12                   | schema .passthrough() + `payload as any`——任意字段未验证直接转发 registry              |

### §147 Compliance / Model-Gateway / Incident-Control / IAM / Chaos 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                                                       |
| ------ | ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R29-40 | P0     | auto-stop-loss-service.ts:731             | approvePendingExecution 标记 approved 但从不执行保护动作——审批是 no-op                                     |
| R29-41 | P0     | degradation-controller.ts:430             | deescalate() 重置 consecutiveHealthyCount=0 后引用——报告永远显示 recovered_after_0                         |
| R29-42 | P1     | auto-stop-loss-service.ts:715             | getHourKey month+day 无分隔符——1月11日与11月1日碰撞,速率限制被绕过                                         |
| R29-43 | P1     | auto-stop-loss-service.ts:627             | 人工审批路径不调 lastExecutionTime.set()——审批后 playbook 冷却期不生效                                     |
| R29-44 | P1     | tenant-execution-isolation-service.ts:323 | usage.status==="critical" 重置 overallStatus="active"——反逻辑,critical 应升级非重置                        |
| R29-45 | P1     | unified-chat-provider.ts:329              | MiniMax streaming 始终 isFinal=false——consumer 永收不到流结束信号                                          |
| R29-46 | P1     | model-routing-service.ts:343              | compareProfiles 次排序 a.maxOutputTokens-b.maxOutputTokens 偏好较低值——注释说 higher=more capable,排序反转 |
| R29-47 | P1     | chaos-experiment-scheduler.ts:148         | 完成检查不按 hypothesis name 去重——重复调用同 hypothesis 触发 premature completion                         |
| R29-48 | P1     | data-classification-service.ts:720        | matchesRule 将用户 rule.patterns 直接传给 new RegExp()——ReDoS via defineRule()                             |
| R29-49 | P1     | auto-stop-loss-service.ts:619             | 升级级别用 string.includes("emergency")——应使用 severity 参数而非字符串匹配                                |
| R29-50 | P1     | cve-intelligence-service.ts:281           | source.url! non-null assertion 但 CveSourceConfig.url 是 optional——undefined 传入 fetch crash              |
| R29-51 | P1     | vault-http-secret-provider.ts:209         | 单段 ref `secret://mykey` 产生空路径段 `secret/data/`——Vault 返回 404                                      |
| R29-52 | P2     | degradation-controller.ts:236             | D0 failure 递归 this.route 最多4层无显式深度 guard——修改 enum 可致栈溢出                                   |
| R29-53 | P2     | compliance-report-pipeline-service.ts:119 | ISO 日期字典序比较在混合时区/精度下失败                                                                    |
| R29-54 | P2     | auto-stop-loss-service.ts:697             | executionHistory splice O(n) shift each recordEvent + executionCounts map key 永不清理                     |
| R29-55 | P2     | audit-event-integrity.ts:256              | latestChainHash 从未排序 entries.at(-1) 读取——输入非预排序时报告错误 hash                                  |


### §149 State-Evidence / CAS / Projections / Knowledge / Memory 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                          |
| ------ | ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R30-01 | P0     | fencing-token-service.ts:100                    | validateFencingToken split("-") 但 executionId 含连字符(UUID)——parts[1] 提取错误段,验证恒失败 |
| R30-02 | P1     | knowledge-archive.ts:20-41                      | upsert 新 checksum 时旧 documentsByChecksum 条目未移除——stale 记录泄漏                        |
| R30-03 | P1     | knowledge-archive.ts:36-38                      | upsert checksum 匹配时旧 chunks 不从 recordsByChunkId 清除——stale chunks 仍可查询             |
| R30-04 | P1     | semantic-knowledge-graph.ts:269                 | addEdge 无去重——重复 upsertRecord 产生重复边,膨胀图查询结果                                   |
| R30-05 | P1     | cas-service.ts:183                              | setValue 无条件重置 version=1——破坏并发 compareAndSet 的单调版本预期                          |
| R30-06 | P1     | fencing-token-service.ts:61                     | tokenCounter per-instance 但 activeFences static——多实例产生碰撞 token 值                     |
| R30-07 | P1     | approval-queue-projection.ts:356                | handleDecisionRejected 设 rejectionsReceived=approvalsRequired——单次拒绝计为全员拒绝          |
| R30-08 | P1     | fencing-token-service.ts:149-156                | acquireFence 不阻止同节点重获 exclusive 也不检查他节点 shared fence——锁语义损坏               |
| R30-09 | P2     | semantic-knowledge-graph.ts:225                 | collectAdjacent 遍历全部 edges 而非用 adjacencyByNodeId——O(V·E) vs O(V+E)                     |
| R30-10 | P2     | workflow-run-projection.ts:135 (9个 projection) | isEventProcessed 用 Array.includes()——O(n) per event 使 replay O(n²)                          |
| R30-11 | P2     | layered-event-inbox.ts:21                       | records 无界增长无 compaction——长时间运行内存泄漏                                             |
| R30-12 | P2     | tool-usage-projection.ts:224                    | invocation_completed 时 successCount++ 但不设 status——状态停留 "started"                      |
| R30-13 | P2     | knowledge-snapshot-store.ts:54                  | load() JSON.parse 无 schema validation——损坏/篡改快照静默返回无效数据                         |
| R30-14 | P2     | layer-transition-service.ts:315                 | age 用 createdAt 非 time-in-current-layer——晋升后下次转换过早触发                             |

### §150 Harness / Sandbox / Tool-Executor / Guardrails 缺陷

| #      | 严重度 | 文件/位置                    | 问题                                                                                           |
| ------ | ------ | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| R30-15 | P0     | command-security.ts:97       | chmod writePathArgPositions:[0] 校验 mode 字符串而非 arg[1] 实际路径——sandbox 路径检查绕过     |
| R30-16 | P0     | command-security.ts:98       | chown writePathArgPositions:[0] 校验 owner:group 而非 arg[1] 实际路径——同上                    |
| R30-17 | P1     | hitl-runtime.ts:42-53        | resolve() 允许对已决议请求再次决议(approved→rejected)——无状态 guard                            |
| R30-18 | P1     | tool-output-sanitizer.ts:20  | ANSI_REGEX 仅匹配 SGR(\e[…m)——CSI cursor/erase、OSC 等终端控制序列未剥离                       |
| R30-19 | P1     | tool-metadata.ts:491-495     | WEB_SEARCH readOnly:false + approvalMode:"never"——搜索为只读却标记可变且免审批                 |
| R30-20 | P1     | tool-metadata.ts:522-525     | WEB_FETCH readOnly:false + approvalMode:"never"——同上,HTTP GET 标记为可变                      |
| R30-21 | P1     | command-security.ts:70-71    | grep/rg pathArgPositions:[-1] 仅验证最后 arg——`grep pattern file1 file2` 中 file1 绕过检查     |
| R30-22 | P1     | web-fetch.ts:156             | isInternalUrl 检查 hostname 字符串非解析后 IP——DNS rebinding(域解析到 127.0.0.1)绕过 SSRF 防护 |
| R30-23 | P1     | command-security.ts:259      | 脚本解释器 flag 检查阻止所有 `-` 前缀参数——`python script.py --verbose` 被误拒                 |
| R30-24 | P2     | loop/index.ts:74,77          | iterations 用 `>=`(0-indexed) 但 replans 用 `>`——允许 maxReplans+1 次 replan                   |
| R30-25 | P2     | command-security.ts:92,109   | mkdir/touch 重复条目——Map last-wins 使第一条(无 writePathArgPositions)成死代码                 |
| R30-26 | P2     | guardrail-engine.ts:91-95    | suggestedAction 含 "retry_same_plan" 但 engine 从不返回——consumer 死代码路径                   |
| R30-27 | P2     | tool-output-sanitizer.ts:28  | CONTROL_CHARS \u000B-\u001A 不含 ESC(\u001B)——裸 ESC 字节通过未剥离                            |
| R30-28 | P2     | recovery-controller.ts:26-30 | worker_crash 只调 recover() 不调 resume()——恢复的 run 停留非运行态                             |

### §151 Middleware / Approval-Routing / Domains / Async 缺陷

| #      | 严重度 | 文件/位置                                                | 问题                                                                                             |
| ------ | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --- | ----------------------------------------------------- |
| R30-29 | P0     | shared/async/sync-backed-async-service.ts:9              | asPromise 在 Promise.resolve() 前同步执行 operation——同步抛出变为未捕获异常而非 rejected Promise |
| R30-30 | P0     | approval-routing/route-engine/index.ts:97                | OrgChartRoutingStrategy selectNode fallback nodes[0]——orgNodeId 未找到时静默路由到任意节点       |
| R30-31 | P1     | domains/registry/plugin-ecosystem-runtime-service.ts:134 | buildPlan 调用两次(L108,L134)——状态可在两次间变化(TOCTOU),产生不同 plan                          |
| R30-32 | P1     | approval-routing/approval-routing-service.ts:79          | audit recordId=requesterId_orgNodeId 无时间戳——同人同节点重复审批请求 ID 碰撞                    |
| R30-33 | P1     | api/middleware/sdk-version-handshake.ts:86               | parseInt(part,10)                                                                                |     | 0 将恶意版本 "a.b.c" 解析为 0.0.0——可绕过最低版本检查 |
| R30-34 | P1     | approval-routing/route-engine/index.ts:118               | amountCny < threshold 严格小于——恰好等于阈值跳过匹配规则,非预期升级到公司级审批                  |
| R30-35 | P1     | approval-routing/delegation/index.ts:27-28               | ISO 日期 string <= 比较在不同 offset 格式下失败(Z vs +00:00 vs +08:00)                           |
| R30-36 | P1     | approval-routing/route-engine/index.ts:147               | SoD 阻止全部 node owner 后可产生空 approverChain——无 fallback/escalation guard                   |
| R30-37 | P1     | domains/registry/plugin-runtime-host.ts:255              | IPC 消息 cast as PluginRuntimeMessage 无 schema validation——被攻破子进程可注入任意数据           |
| R30-38 | P2     | domains/recipes/recipe-executor.ts:34                    | workflow existence check 是 regex stub(/^nonexistent/)——任何 ID "成功"                           |
| R30-39 | P2     | domains/registry/plugin-runtime-child.ts:12,123          | 变量名 stdoutBuffer 实际累积 stdin 数据——copy-paste 命名错误                                     |
| R30-40 | P2     | domains/registry/domain-registry-service.ts:107          | deprecate() 无状态 guard——允许从 draft/archived 直接 deprecate                                   |
| R30-41 | P2     | approval-routing/route-engine/index.ts:288               | USD→CNY 硬编码汇率 7.2 无 staleness check/rate source 验证                                       |
| R30-42 | P2     | shared/async/sync-backed-async-service.ts.bak            | .bak 备份文件残留在源码树——不应被跟踪/部署                                                       |

### §152 UI Features / Electron / Tauri / Charts 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                        |
| ------ | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| R30-43 | P0     | electron-win/src/preload.ts:33                  | installElectronBridge 直接赋值 window.**AA_ELECTRON** 绕过 contextBridge——破坏上下文隔离    |
| R30-44 | P0     | electron-win/src/preload.ts:6-7                 | preload 暴露 shell:run/shell:spawn 通道无命令白名单——renderer 可执行任意 shell 命令         |
| R30-45 | P0     | tauri-macos/src-tauri/tauri.conf.json:1         | 无 security section——缺 CSP/dangerousRemoteDomainIpcAccess/capability scoping               |
| R30-46 | P0     | tauri-linux/src-tauri/tauri.conf.json:1         | 同上：无 security/CSP 配置                                                                  |
| R30-47 | P0     | electron-win/index.html:3                       | 无 Content-Security-Policy meta tag——spec §6.5.4 要求 CSP baseline                          |
| R30-48 | P1     | features/governance-compliance/hooks/index.ts:6 | hook 返回硬编码静态数组——无 API 调用,spec 要求完整审计轨迹+后端集成                         |
| R30-49 | P1     | features/takeover/hooks/index.ts:5              | hook 返回硬编码静态数组——无 WS 订阅/状态传输逻辑,spec 要求 live state transfer              |
| R30-50 | P1     | ui-core/charts/echart-surface-runtime.tsx:26    | init() 仅接受静态 values prop+全量重建——无 appendData/streaming 支持                        |
| R30-51 | P1     | ui-core/charts/index.tsx:18                     | MiniTrendBars 无 role/aria-label——`<span>` 无语义,WCAG 2.1 AA 失败                          |
| R30-52 | P1     | ui-core/layouts/index.ts:30                     | ThreePaneLayout 固定 gridTemplateColumns——无响应式断点,违反 spec §2.5.1                     |
| R30-53 | P1     | features/analytics/hooks/index.ts:12            | trendSummary 映射 "up"/"flat"/"down" 到 3/2/1——chart 收到无意义序数非真实指标值             |
| R30-54 | P1     | features/governance-compliance/web/index.tsx:11 | actions 定义 id/label/tone 但无 onClick——governance 操作(escalate/review)完全惰性           |
| R30-55 | P1     | features/takeover/web/index.tsx:11              | takeover actions(start/annotate/resume)无 onClick——关键管理操作不可执行                     |
| R30-56 | P1     | ui-mobile/native-modules/index.ts:1             | nativeModulesBaseline 是 flat boolean 配置——无实际 bridge/permission/capability negotiation |
| R30-57 | P2     | ui-core/charts/index.tsx:5                      | MetricGrid 无 role="group"/aria-label——screen reader 无法识别指标区域                       |
| R30-58 | P2     | features/workflow-cockpit/hooks/index.ts:41     | selectedWorkflow fallback workflows[0]——删除后 stale selection 显示错误 workflow            |
| R30-59 | P2     | features/settings/hooks/index.ts:42-47          | useEffect 依赖 primitive 但内部读 object property——identity mismatch 可跳过同步             |
| R30-60 | P2     | electron-win/src/main.ts:15-16                  | channels 无 tier/permission 分组——shell:run 与 secure-store 同信任级别                      |
| R30-61 | P2     | features/domain-wizard/hooks/index.ts:12        | 用户控制的 domain.owner 直接嵌入模板——若渲染为 HTML 存 XSS 风险                             |
| R30-62 | P2     | ui-core/charts/echart-surface-runtime.tsx:52    | resize 监听 window 非 ResizeObserver on container——panel 变化时 chart 不刷新                |
### §149 State-Evidence / CAS / Projections / Knowledge / Memory 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                          |
| ------ | ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R30-01 | P0     | fencing-token-service.ts:100                    | validateFencingToken split("-") 但 executionId 含连字符(UUID)——parts[1] 提取错误段,验证恒失败 |
| R30-02 | P1     | knowledge-archive.ts:20-41                      | upsert 新 checksum 时旧 documentsByChecksum 条目未移除——stale 记录泄漏                        |
| R30-03 | P1     | knowledge-archive.ts:36-38                      | upsert checksum 匹配时旧 chunks 不从 recordsByChunkId 清除——stale chunks 仍可查询             |
| R30-04 | P1     | semantic-knowledge-graph.ts:269                 | addEdge 无去重——重复 upsertRecord 产生重复边,膨胀图查询结果                                   |
| R30-05 | P1     | cas-service.ts:183                              | setValue 无条件重置 version=1——破坏并发 compareAndSet 的单调版本预期                          |
| R30-06 | P1     | fencing-token-service.ts:61                     | tokenCounter per-instance 但 activeFences static——多实例产生碰撞 token 值                     |
| R30-07 | P1     | approval-queue-projection.ts:356                | handleDecisionRejected 设 rejectionsReceived=approvalsRequired——单次拒绝计为全员拒绝          |
| R30-08 | P1     | fencing-token-service.ts:149-156                | acquireFence 不阻止同节点重获 exclusive 也不检查他节点 shared fence——锁语义损坏               |
| R30-09 | P2     | semantic-knowledge-graph.ts:225                 | collectAdjacent 遍历全部 edges 而非用 adjacencyByNodeId——O(V·E) vs O(V+E)                     |
| R30-10 | P2     | workflow-run-projection.ts:135 (9个 projection) | isEventProcessed 用 Array.includes()——O(n) per event 使 replay O(n²)                          |
| R30-11 | P2     | layered-event-inbox.ts:21                       | records 无界增长无 compaction——长时间运行内存泄漏                                             |
| R30-12 | P2     | tool-usage-projection.ts:224                    | invocation_completed 时 successCount++ 但不设 status——状态停留 "started"                      |
| R30-13 | P2     | knowledge-snapshot-store.ts:54                  | load() JSON.parse 无 schema validation——损坏/篡改快照静默返回无效数据                         |
| R30-14 | P2     | layer-transition-service.ts:315                 | age 用 createdAt 非 time-in-current-layer——晋升后下次转换过早触发                             |

### §150 Harness / Sandbox / Tool-Executor / Guardrails 缺陷

| #      | 严重度 | 文件/位置                    | 问题                                                                                           |
| ------ | ------ | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| R30-15 | P0     | command-security.ts:97       | chmod writePathArgPositions:[0] 校验 mode 字符串而非 arg[1] 实际路径——sandbox 路径检查绕过     |
| R30-16 | P0     | command-security.ts:98       | chown writePathArgPositions:[0] 校验 owner:group 而非 arg[1] 实际路径——同上                    |
| R30-17 | P1     | hitl-runtime.ts:42-53        | resolve() 允许对已决议请求再次决议(approved→rejected)——无状态 guard                            |
| R30-18 | P1     | tool-output-sanitizer.ts:20  | ANSI_REGEX 仅匹配 SGR(\e[…m)——CSI cursor/erase、OSC 等终端控制序列未剥离                       |
| R30-19 | P1     | tool-metadata.ts:491-495     | WEB_SEARCH readOnly:false + approvalMode:"never"——搜索为只读却标记可变且免审批                 |
| R30-20 | P1     | tool-metadata.ts:522-525     | WEB_FETCH readOnly:false + approvalMode:"never"——同上,HTTP GET 标记为可变                      |
| R30-21 | P1     | command-security.ts:70-71    | grep/rg pathArgPositions:[-1] 仅验证最后 arg——`grep pattern file1 file2` 中 file1 绕过检查     |
| R30-22 | P1     | web-fetch.ts:156             | isInternalUrl 检查 hostname 字符串非解析后 IP——DNS rebinding(域解析到 127.0.0.1)绕过 SSRF 防护 |
| R30-23 | P1     | command-security.ts:259      | 脚本解释器 flag 检查阻止所有 `-` 前缀参数——`python script.py --verbose` 被误拒                 |
| R30-24 | P2     | loop/index.ts:74,77          | iterations 用 `>=`(0-indexed) 但 replans 用 `>`——允许 maxReplans+1 次 replan                   |
| R30-25 | P2     | command-security.ts:92,109   | mkdir/touch 重复条目——Map last-wins 使第一条(无 writePathArgPositions)成死代码                 |
| R30-26 | P2     | guardrail-engine.ts:91-95    | suggestedAction 含 "retry_same_plan" 但 engine 从不返回——consumer 死代码路径                   |
| R30-27 | P2     | tool-output-sanitizer.ts:28  | CONTROL_CHARS \u000B-\u001A 不含 ESC(\u001B)——裸 ESC 字节通过未剥离                            |
| R30-28 | P2     | recovery-controller.ts:26-30 | worker_crash 只调 recover() 不调 resume()——恢复的 run 停留非运行态                             |

### §151 Middleware / Approval-Routing / Domains / Async 缺陷

| #      | 严重度 | 文件/位置                                                | 问题                                                                                             |
| ------ | ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --- | ----------------------------------------------------- |
| R30-29 | P0     | shared/async/sync-backed-async-service.ts:9              | asPromise 在 Promise.resolve() 前同步执行 operation——同步抛出变为未捕获异常而非 rejected Promise |
| R30-30 | P0     | approval-routing/route-engine/index.ts:97                | OrgChartRoutingStrategy selectNode fallback nodes[0]——orgNodeId 未找到时静默路由到任意节点       |
| R30-31 | P1     | domains/registry/plugin-ecosystem-runtime-service.ts:134 | buildPlan 调用两次(L108,L134)——状态可在两次间变化(TOCTOU),产生不同 plan                          |
| R30-32 | P1     | approval-routing/approval-routing-service.ts:79          | audit recordId=requesterId_orgNodeId 无时间戳——同人同节点重复审批请求 ID 碰撞                    |
| R30-33 | P1     | api/middleware/sdk-version-handshake.ts:86               | parseInt(part,10)                                                                                |     | 0 将恶意版本 "a.b.c" 解析为 0.0.0——可绕过最低版本检查 |
| R30-34 | P1     | approval-routing/route-engine/index.ts:118               | amountCny < threshold 严格小于——恰好等于阈值跳过匹配规则,非预期升级到公司级审批                  |
| R30-35 | P1     | approval-routing/delegation/index.ts:27-28               | ISO 日期 string <= 比较在不同 offset 格式下失败(Z vs +00:00 vs +08:00)                           |
| R30-36 | P1     | approval-routing/route-engine/index.ts:147               | SoD 阻止全部 node owner 后可产生空 approverChain——无 fallback/escalation guard                   |
| R30-37 | P1     | domains/registry/plugin-runtime-host.ts:255              | IPC 消息 cast as PluginRuntimeMessage 无 schema validation——被攻破子进程可注入任意数据           |
| R30-38 | P2     | domains/recipes/recipe-executor.ts:34                    | workflow existence check 是 regex stub(/^nonexistent/)——任何 ID "成功"                           |
| R30-39 | P2     | domains/registry/plugin-runtime-child.ts:12,123          | 变量名 stdoutBuffer 实际累积 stdin 数据——copy-paste 命名错误                                     |
| R30-40 | P2     | domains/registry/domain-registry-service.ts:107          | deprecate() 无状态 guard——允许从 draft/archived 直接 deprecate                                   |
| R30-41 | P2     | approval-routing/route-engine/index.ts:288               | USD→CNY 硬编码汇率 7.2 无 staleness check/rate source 验证                                       |
| R30-42 | P2     | shared/async/sync-backed-async-service.ts.bak            | .bak 备份文件残留在源码树——不应被跟踪/部署                                                       |

### §152 UI Features / Electron / Tauri / Charts 缺陷

| #      | 严重度 | 文件/位置                                       | 问题                                                                                        |
| ------ | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| R30-43 | P0     | electron-win/src/preload.ts:33                  | installElectronBridge 直接赋值 window.**AA_ELECTRON** 绕过 contextBridge——破坏上下文隔离    |
| R30-44 | P0     | electron-win/src/preload.ts:6-7                 | preload 暴露 shell:run/shell:spawn 通道无命令白名单——renderer 可执行任意 shell 命令         |
| R30-45 | P0     | tauri-macos/src-tauri/tauri.conf.json:1         | 无 security section——缺 CSP/dangerousRemoteDomainIpcAccess/capability scoping               |
| R30-46 | P0     | tauri-linux/src-tauri/tauri.conf.json:1         | 同上：无 security/CSP 配置                                                                  |
| R30-47 | P0     | electron-win/index.html:3                       | 无 Content-Security-Policy meta tag——spec §6.5.4 要求 CSP baseline                          |
| R30-48 | P1     | features/governance-compliance/hooks/index.ts:6 | hook 返回硬编码静态数组——无 API 调用,spec 要求完整审计轨迹+后端集成                         |
| R30-49 | P1     | features/takeover/hooks/index.ts:5              | hook 返回硬编码静态数组——无 WS 订阅/状态传输逻辑,spec 要求 live state transfer              |
| R30-50 | P1     | ui-core/charts/echart-surface-runtime.tsx:26    | init() 仅接受静态 values prop+全量重建——无 appendData/streaming 支持                        |
| R30-51 | P1     | ui-core/charts/index.tsx:18                     | MiniTrendBars 无 role/aria-label——`<span>` 无语义,WCAG 2.1 AA 失败                          |
| R30-52 | P1     | ui-core/layouts/index.ts:30                     | ThreePaneLayout 固定 gridTemplateColumns——无响应式断点,违反 spec §2.5.1                     |
| R30-53 | P1     | features/analytics/hooks/index.ts:12            | trendSummary 映射 "up"/"flat"/"down" 到 3/2/1——chart 收到无意义序数非真实指标值             |
| R30-54 | P1     | features/governance-compliance/web/index.tsx:11 | actions 定义 id/label/tone 但无 onClick——governance 操作(escalate/review)完全惰性           |
| R30-55 | P1     | features/takeover/web/index.tsx:11              | takeover actions(start/annotate/resume)无 onClick——关键管理操作不可执行                     |
| R30-56 | P1     | ui-mobile/native-modules/index.ts:1             | nativeModulesBaseline 是 flat boolean 配置——无实际 bridge/permission/capability negotiation |
| R30-57 | P2     | ui-core/charts/index.tsx:5                      | MetricGrid 无 role="group"/aria-label——screen reader 无法识别指标区域                       |
| R30-58 | P2     | features/workflow-cockpit/hooks/index.ts:41     | selectedWorkflow fallback workflows[0]——删除后 stale selection 显示错误 workflow            |
| R30-59 | P2     | features/settings/hooks/index.ts:42-47          | useEffect 依赖 primitive 但内部读 object property——identity mismatch 可跳过同步             |
| R30-60 | P2     | electron-win/src/main.ts:15-16                  | channels 无 tier/permission 分组——shell:run 与 secure-store 同信任级别                      |
| R30-61 | P2     | features/domain-wizard/hooks/index.ts:12        | 用户控制的 domain.owner 直接嵌入模板——若渲染为 HTML 存 XSS 风险                             |
| R30-62 | P2     | ui-core/charts/echart-surface-runtime.tsx:52    | resize 监听 window 非 ResizeObserver on container——panel 变化时 chart 不刷新                |


### §154 OAPEFLIR Loop / Harness-Mapping / Stage-FSM 缺陷

| #      | 严重度 | 文件/位置                         | 问题                                                                                             |
| ------ | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| R31-01 | P0     | oapeflir-loop-service.ts:118      | 阶段转换间无 budget/guard 检查——spec §15.3 要求每次 LLM/tool 调用前 budget reserve               |
| R31-02 | P0     | oapeflir-loop-service.ts:118      | eventPublisher 在阶段边界从未使用——spec §14.3 要求所有状态变更由事件驱动                         |
| R31-03 | P0     | oapeflir-harness-mapping.ts:13-29 | mapHarnessStepToOapeflirPhase 永不返回 "learn" 或 "release"——两个 OAPEFLIR 阶段完全无映射路径    |
| R31-04 | P0     | oapeflir-loop-service.ts:195      | Plan 类型是 flat PlanStep[]——spec §6.1 明确禁止线性 steps,要求 PlanGraphBundle                   |
| R31-05 | P1     | stage-timeline.ts:3               | OapeflirStageSchema 含第9值 "knowledge_promotion" 不在 spec 或 FSM OAPEFLIR_STAGES 中——类型分歧  |
| R31-06 | P1     | oapeflir-loop-service.ts:118      | StageTransitionFSM 从未实例化/查询——stages 硬编码顺序执行,FSM guard 逻辑完全绕过                 |
| R31-07 | P1     | stage-transition-fsm.ts:87        | getCurrentStage index=8 溢出数组(length 8)——release 后返回 undefined 但有 ! assertion            |
| R31-08 | P1     | oapeflir-loop-service.ts:359      | 返回未验证 assessment 而非 validatedAssessment——下游接收可能未通过 A→P 边界验证的数据            |
| R31-09 | P1     | final-response.ts:27              | FinalResponse 缺 spec §27 要求字段: audience/limitations/dataClass/redactionApplied/safetyLabels |
| R31-10 | P1     | assessment-service.ts:20          | assess() 计算风险但从不检查 budget feasibility——spec §11 要求 worst-path 预算分析                |
| R31-11 | P1     | stage-transition-fsm.ts:187       | recordStageSkipped 接受 reasonCode 但静默丢弃——不存储/不传播到审计记录                           |
| R31-12 | P2     | agent-team-service.ts:3-9         | AgentTeamStage(plan/build/review/validate/repair/release) 与 OAPEFLIR 7阶段无语义映射            |
| R31-13 | P2     | intake-router.ts:14               | docstring 声称负责 "budget entry" 但 route() 不检查/不附加 budget 信息                           |
| R31-14 | P2     | oapeflir-harness-mapping.ts:23-25 | hitl_operator 映射到 "assess"——spec §26 定义 HITL 为跨切面非阶段                                 |
| R31-15 | P2     | runtime-execute-bridge.ts:228     | 动态 import() 无超时/断路器——延迟不可控,违反 X1 可靠性要求                                       |
| R31-16 | P2     | oapeflir-loop-service.ts:210-211  | Execute 阶段短路到 input.stepOutputs 不验证——预提供输出绕过全部执行 guardrails                   |

### §155 Event-Bus / DLQ / Repositories 缺陷

| #      | 严重度 | 文件/位置                                    | 问题                                                                                       |
| ------ | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| R31-17 | P0     | event-registry.ts:674                        | getRegisteredConsumers 对 replay 事件返回 undefined——tier-1 ack 创建静默跳过 consumer      |
| R31-18 | P0     | durable-event-bus.ts:358                     | retry 循环 0..3 执行4次但报告 MAX_DELIVERY_RETRIES=3——off-by-one 掩盖真实重试次数          |
| R31-19 | P0     | durable-event-bus.ts:534-543                 | ensurePendingAcks 对同时在 activeConsumerRefCounts 和 registry 的 consumer 创建重复 ack    |
| R31-20 | P1     | durable-event-bus.ts:197                     | tier-2/3 同时 dispatchVolatile + scheduleFanOut——事件被投递两次(volatile+pending ack poll) |
| R31-21 | P1     | dlq-service.ts:155-174                       | scheduleRetry 增 retryCount 不检查 maxRetries——maxRetries 字段纯装饰,实际无限重试          |
| R31-22 | P1     | dlq-service.ts:112                           | DLQ 纯内存 Map——进程重启丢失所有 dead-letter 记录,违反持久性要求                           |
| R31-23 | P1     | transactional-event-appender.ts:97           | 手动 BEGIN TRANSACTION via exec() 绕过 db.transaction()——嵌套时外层 txn 被自动提交         |
| R31-24 | P1     | organization-repository.ts:218,351,416,477   | SQL `WHERE x IS $N`(4处)——PG 非标准等值,非 NULL 参数时返回错误结果                         |
| R31-25 | P1     | durable-event-bus.ts:302-306                 | deliverPendingNow 无 handler 时返回 pending.length 声称成功——事件实未处理                  |
| R31-26 | P2     | event-registry.ts:544-563                    | tier-2 事件无 payload validator——genericEventPayloadSchema 接受任意形状,schema 不强制      |
| R31-27 | P2     | durable-event-bus.ts:470-496                 | dispatchVolatile 吞噬 handler 错误仅 warn——无 ack 更新/无 dead-letter 路径                 |
| R31-28 | P2     | async-repositories/session-repository.ts:113 | `LIMIT ${limit}` 字符串插值——limit 为用户输入时 SQL 注入                                   |
| R31-29 | P2     | delegation-repository.ts:151                 | listExpiredDelegations 用 SQLite datetime('now')——PG 不兼容,运行时崩溃                     |
| R31-30 | P2     | async-repositories/worker-repository.ts:743  | strftime SQLite 函数在 PG async repo——PG 运行时失败                                        |
| R31-31 | P2     | authoritative-task-store-decorator.ts:94-162 | Proxy get trap 包裹所有属性访问(含非方法子对象)——破坏嵌套 repository namespace 访问        |

### §156 SDK / CLI 缺陷

| #      | 严重度 | 文件/位置                                 | 问题                                                                             |
| ------ | ------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| R31-32 | P0     | sdk/cli/migrate-sqlite-to-pg.ts:68        | SQL 注入：table name 未参数化直接插入 `SELECT COUNT(*) FROM ${table}`(+L96,L103) |
| R31-33 | P0     | sdk/cli/migrate-sqlite-to-pg.ts:125       | PG DSN(含凭证)明文输出到 stdout JSON                                             |
| R31-34 | P0     | sdk/cli/dlq-manager.ts:156                | purge 删除全部 DLQ 记录无确认提示——破坏性批量操作                                |
| R31-35 | P1     | sdk/client-sdk/api-client.ts:208          | 重试所有非 OK 响应(含 400/401/403/409)——应仅重试 429/5xx                         |
| R31-36 | P1     | sdk/client-sdk/api-client.ts:217          | 非 OK 响应被解析为成功返回——4xx/5xx 不抛错                                       |
| R31-37 | P1     | sdk/client-sdk/api-client.ts:148          | parseInt x-total-count 不检查 NaN——NaN 作为 totalCount 传播                      |
| R31-38 | P1     | sdk/admin-sdk/index.ts:17                 | registerDomain body:unknown 无输入验证——admin 可注册任意 payload                 |
| R31-39 | P1     | sdk/admin-sdk/index.ts:6                  | AdminSdk 无 role/permission 检查——与 client SDK 同级别,无 admin gate             |
| R31-40 | P1     | sdk/cli/dlq-manager.ts:135                | retry 重置所有 dead-letter 的 attempts=0 无批次限制——重试风暴                    |
| R31-41 | P1     | sdk/cli/authoritative-storage-admin.ts:50 | down migration 无确认——破坏性 schema rollback 无 gate                            |
| R31-42 | P1     | sdk/harness-sdk/index.ts:37               | stage 缺失时 fallback 到 nodeRunId——语义错误的默认值                             |
| R31-43 | P1     | sdk/cli/shadow-snapshot.ts:32             | 模块级副作用 loadShadowSnapshotCliEnv() import 时执行——破坏测试和 lazy loading   |
| R31-44 | P2     | sdk/client-sdk/api-client.ts:111          | POST/PUT 重试无 idempotency key——非幂等写重复执行                                |
| R31-45 | P2     | sdk/cli/orphan-cleanup.ts:37              | repair 删除孤儿记录无 dry-run/确认                                               |
| R31-46 | P2     | sdk/harness-sdk/index.ts:78               | sleep 接受 resumeAt string 无 ISO-8601 验证                                      |
| R31-47 | P2     | sdk/cli/billing.ts:114                    | ownerId 缺省为空字符串——创建无 owner 的账户                                      |

### §157 Cross-Cutting Integration / Delegation / Risk 断裂

| #      | 严重度 | 文件/位置                            | 问题                                                                                                         |
| ------ | ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| R31-48 | P0     | delegation-manager.service.ts:129    | delegate() 从不调 DelegationGovernanceService.evaluate()——governance 规则完全绕过                            |
| R31-49 | P0     | delegation-manager.service.ts:129    | delegate() 从不调 DelegationAuditService——委托生命周期无审计轨迹                                             |
| R31-50 | P0     | model-routing-service.ts:49          | ModelRouteRiskLevel 独立重复定义 RiskLevel——与 risk-control/types.ts 无导入/无共享 contract                  |
| R31-51 | P1     | delegation-manager.service.ts:129    | delegate() 内联重实现权限收窄/上下文隔离——不使用同目录 ContextIsolator 类                                    |
| R31-52 | P1     | delegation-manager.service.ts:129    | delegate() 从不调 CallDepthBudget.evaluate()——call-depth 预算检查完全未接入                                  |
| R31-53 | P1     | budget-allocator.ts:1                | BudgetAllocator 与 model-gateway 无集成——UnifiedChatProvider 返回 token usage 但无路径回馈 budget settlement |
| R31-54 | P1     | risk-evaluation-engine.ts:1          | RiskEvaluationEngine 未被 execution/orchestration 层导入——风险评分完全与 dispatch/execution 断裂             |
| R31-55 | P1     | delegation-manager.service.ts:244    | fail() 接受 \_error 参数但静默丢弃——错误原因不存储到 DelegationResult                                        |
| R31-56 | P1     | risk-config-loader.ts:39             | JSON.parse(raw) 无 schema validation——config 畸形时产生 TypeError 非领域错误                                 |
| R31-57 | P1     | response-hardening.ts:13             | CORS allowedOrigins:["*"] + credentials:true——spec 禁止此组合                                                |
| R31-58 | P1     | delegation-tracker.ts:281            | getMetrics() 对所有节点无条件 activeCount++——completedCount/failedCount/averageDurationMs 恒为 0             |
| R31-59 | P2     | service-registry.ts:233              | teardownAll 计算逆拓扑序后 Promise.all——丢失顺序保证                                                         |
| R31-60 | P2     | delegation-manager.service.ts:226    | completeWithEvidence 传 Number.MAX_SAFE_INTEGER 作 parentBudgetRemaining——非真实预算                         |
| R31-61 | P2     | delegation-tracker.ts:134            | recordDelegation 硬编码 agentType:""——树可视化显示空 agent 类型                                              |
| R31-62 | P2     | delegation-manager.service.ts:503    | updateDelegationChain 不同步 DelegationTracker——两套 chain 存储运行时分歧                                    |
| R31-63 | P2     | delegation-governance-service.ts:224 | matchesCondition agentType 是自由字符串 vs subjectType 期望 enum——条件永不匹配真实 agent                     |


### §159 Tool-Executor / State-Transition / Startup 缺陷

| #      | 严重度 | 文件/位置                          | 问题                                                                                     |
| ------ | ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| R32-01 | P0     | transition-service.ts:500-526      | TaskTerminalTransitionService.apply 用非 CAS updateXxxStatus——并发 terminal 转换互相覆盖 |
| R32-02 | P0     | tool-path-scope.ts:36-43           | normalizePath realpathSync 失败时 fallback resolve()——不解引用 symlink,路径作用域绕过    |
| R32-03 | P0     | tool-execution-access.ts:133-138   | execution=null 时返回 allowedTools:undefined(无限制)+仅 errorCode——调用方不检查即无限制  |
| R32-04 | P0     | mcp-tool-guard.ts:131              | builtin 碰撞检查用 remoteToolName 而非完整 toolName——MCP 工具名含 builtin 后缀未检测     |
| R32-05 | P1     | tool-parallel-executor.ts:380-403  | exclusive 工具在所有并行工具之后执行——原始顺序被破坏,写在前读在后反转                    |
| R32-06 | P1     | loop/index.ts:32                   | maxIterations=Math.floor(maxSteps/3) 当 maxSteps=1-2 时为0——循环立即终止无法执行         |
| R32-07 | P1     | guardrail-vibration-breaker.ts:36  | maxRepeatedActions=0 仍允许1次——off-by-one,`> maxRepeat` 非 `>=`                         |
| R32-08 | P1     | transition-service.ts:93-101       | session paused→open 转换缺失——暂停 session 无法恢复,与注释"可恢复"矛盾                   |
| R32-09 | P1     | web-search.ts:117                  | new URL(url) 对 DDG 畸形结果 throw——整个搜索操作崩溃而非跳过坏结果                       |
| R32-10 | P1     | process-error-handlers.ts:94-99    | error.name string matching("StorageError")——minification 后名称变化导致不匹配            |
| R32-11 | P1     | startup-consistency-checker.ts:470 | P0 发现后继续运行全部检查——应 short-circuit 避免查询潜在损坏的 DB                        |
| R32-12 | P2     | tool-parallel-executor.ts:406      | results as T[] 含 undefined holes——调用方按 index 取值无类型安全                         |
| R32-13 | P2     | tool-contract-validator.ts:47      | metadata.toolName.trim() 无类型 guard——undefined/null 时 throw                           |
| R32-14 | P2     | web-fetch.ts:230                   | parseInt Content-Length 忽略尾部垃圾——"1234abc"=1234 可能允许超大响应                    |
| R32-15 | P2     | tool-argument-coercion.ts:524-532  | 原地 delete+reassign input.args——持有旧引用的中间件观察到 mid-flight mutation            |
| R32-16 | P2     | tool-output-sanitizer.ts:354-359   | secret regex 用 /g flag 作模块常量——lastIndex 状态跨调用持续,交替 match/miss             |

### §160 Model-Gateway Provider / Cost-Tracker / Credential 缺陷

| #      | 严重度 | 文件/位置                               | 问题                                                                                          |
| ------ | ------ | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| R32-17 | P0     | credential-pool.ts:200                  | markFailure 对4xx(401/403/408)不标记 cooldown/disable——永久拒绝的 key 持续重用                |
| R32-18 | P1     | anthropic-chat-service.ts:464           | message_delta usage(仅output_tokens)覆盖 accumulatedUsage——丢失 message_start 的 input_tokens |
| R32-19 | P1     | chargeback-service.ts:35                | tenantId ?? undefined: null 转 undefined 时获取所有租户报告而非仅平台级                       |
| R32-20 | P1     | unified-chat-provider.ts:137            | detectProviderFromModel lowercase 后 includes 混合大小写 prefix——MiniMax 模型永不匹配         |
| R32-21 | P1     | anthropic-chat-service.ts:267           | retry list 缺 402(Payment Required)——credential disable 但无 failover,OpenAI/MiniMax 有       |
| R32-22 | P1     | base-chat-provider.ts:258               | transformRequest 与外层都设 stream:true——provider 可 double-set 或冲突                        |
| R32-23 | P2     | cost-report-service.ts:98               | listBudgetSummaries 仅保留最新 report period——丢弃最早边界,显示错误时间范围                   |
| R32-24 | P2     | provider-credential-pool-support.ts:258 | cooldownUntil ISO 字符串比较在不同 UTC offset 下失败                                          |
| R32-25 | P2     | budget-guard.ts:69                      | warnAtRatio=1.0 + cost=limit 时返回 allowed:true+requiresApproval:true 而非 block             |
| R32-26 | P2     | openai-chat-service.ts:471              | streaming refusal 用赋值非拼接——多 chunk refusal 仅保留最后 delta 文本                        |

### §161 NL-Gateway / Goal-Decomposer / Proactive-Agent / Autonomy 缺陷

| #      | 严重度 | 文件/位置                                         | 问题                                                                                    |
| ------ | ------ | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R32-27 | P0     | proactive-agent/index.ts:373                      | change_rate_gt 计算 abs(v-prev) 而非 abs(v-prev)/prev——绝对差非变化率,阈值比较语义错误  |
| R32-28 | P0     | goal-decomposer/llm-plan-generator.ts:64          | task.estimatedCostUsd.toFixed(4) 对 LLM 返回非数字直接 crash(TypeError)                 |
| R32-29 | P1     | autonomy/index.ts:376 vs level-manager/index.ts:3 | compareLevels frozen=index 0 vs level-manager frozen=index 4——晋升/降级检测用错误比较器 |
| R32-30 | P1     | ux/ux-event-tracking-service.ts:162               | AB test 按 userId 为 key——同用户第二次分配覆盖第一次,丢失前次分配                       |
| R32-31 | P1     | goal-decomposer/index.ts:170                      | goalId 取 goal.slice(0,16)——相同16字符前缀的不同目标 ID 碰撞                            |
| R32-32 | P1     | nl-gateway/slot-resolver/index.ts:9               | `entityType in resolved` 检查原型链——"constructor"/"toString" 等名称误判为已解析        |
| R32-33 | P1     | goal-decomposer/index.ts:330                      | estimatedDuration 硬编码 `${tasks.length}d`——忽略各 task 实际 estimatedDuration         |
| R32-34 | P1     | autonomy/autonomy-governance-service.ts:84        | frozen(=4)>full_auto(=3) 导致推荐 frozen 时 promoted:true——降级报告为晋升               |
| R32-35 | P1     | autonomy/historical-metrics-provider.ts:64        | incidents 计数包含所有有 last_error_code 的行——瞬态错误与真实事件混同,触发误冻结        |
| R32-36 | P2     | nl-gateway/ambiguity-handler/index.ts:1           | detectAmbiguity 与 disambiguation-handler 同名不同实现——import 路径决定行为             |
| R32-37 | P2     | goal-decomposer/index.ts:370                      | normalized=description.toLowerCase() 声明后从不引用——死变量                             |
| R32-38 | P2     | proactive-agent/index.ts:418                      | detectFeedbackLoop 捕获 mid-DFS stack 作 triggerIds——含遍历路径节点非仅环成员           |
| R32-39 | P2     | goal-decomposer/llm-plan-generator.ts:117         | parsePlan 验证 array 但不验证单个 task shape——缺失字段/负数静默通过                     |
| R32-40 | P2     | nl-gateway/nl-gateway-config-loader.ts:92         | JSON.parse as Partial<Config> 无 schema 验证——恶意/畸形 config 静默接受                 |

### §162 Contract Types 系统性冲突

| #      | 严重度 | 文件/位置                                                               | 问题                                                                                              |
| ------ | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R32-41 | P0     | executable-contracts:67 vs domain/task-types.ts:29                      | ArtifactRef 两处定义形状不兼容(4字段 vs 7字段)                                                    |
| R32-42 | P0     | executable-contracts:407 vs platform-contracts.ts:55                    | SideEffectRecord 两处定义不兼容(12字段 vs 6字段)                                                  |
| R32-43 | P0     | executable-contracts:60 vs platform-contracts.ts:4                      | PrincipalRef vs PlatformPrincipal: principalId vs actorId, tenantId required vs nullable          |
| R32-44 | P0     | executable-contracts:126 vs platform-contracts:12 vs request-envelope:4 | RequestEnvelope 3处定义3种形状——完全不兼容                                                        |
| R32-45 | P1     | schemas.ts:574 vs executable-contracts:580                              | ContractReplayBehavior "simulate" vs EventReplayBehavior "simulate_projection"——enum 值不匹配     |
| R32-46 | P1     | execution-plan/index.ts:12 vs platform-contracts.ts:70                  | ExecutionPlan 两处定义不兼容(taskId/version/steps vs workflowRunId/principal/budget/steps)        |
| R32-47 | P1     | execution-receipt/index.ts:6 vs platform-contracts.ts:89                | ExecutionReceipt 两处定义不兼容(taskId/workerId/resultRef vs durationMs/sideEffects/evidenceRefs) |
| R32-48 | P1     | state-command/index.ts:6 vs platform-contracts.ts:106                   | StateCommand 两处定义不兼容(entityKind/entityId/action vs type/aggregateId/fencingToken)          |
| R32-49 | P1     | control-directive/index.ts:6 vs platform-contracts.ts:37                | ControlDirective 两处定义: kind/issuedBy:string vs type/issuedBy:PlatformPrincipal                |
| R32-50 | P1     | platform-contracts.ts:47,64,83                                          | SideEffectExpectation/ExecutionPlanBudget/ExecutionReceiptErrorDetail 导出但从无导入——死类型      |
| R32-51 | P1     | types/index.ts:9-15                                                     | barrel 不 re-export domain/ 子模块——所有 domain types 通过 types/index 路径不可达                 |
| R32-52 | P2     | contracts/index.ts:18,29                                                | RequestEnvelope 同时 re-export 为 PlatformRequestEnvelope 和 PlaneRequestEnvelope——歧义           |
| R32-53 | P2     | oapeflir/ref-types.ts:29 vs domain/task-types:29 vs exec-contracts:67   | ArtifactRef 存在3处: string alias / rich interface / 另一 interface                               |
| R32-54 | P2     | platform-contracts.ts:1                                                 | contracts 层 import 编排层 PlanStep——向上依赖违反分层                                             |
| R32-55 | P2     | executable-contracts:632                                                | CONTRACT_JSON_SCHEMAS additionalProperties:true——无严格验证,额外字段静默通过                      |


## Round 33 — Dispatcher/RSM/Budget · Scale-Ecosystem/Ops · UI Build/Perf/SW · Security Holistic

### §164 Dispatcher / RSM / Budget 深层缺陷

| #    | 严重度 | 文件                                                            | 问题                                                                                 |
| ---- | ------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1899 | P0     | src/platform/execution/runtime-state-machine.ts                 | NodeRun→cancelled/aborted 转换跳过 lease+fencing 检查——任何 actor 可取消运行中节点   |
| 1900 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts | lease 在 claim 事务外获取(TOCTOU)——可产生双工 worker 分配                            |
| 1901 | P1     | src/platform/execution/budget-allocator.ts                      | settle() 绕过 RSM 直接 mutate ledger——无 CAS/无 fact event                           |
| 1902 | P1     | src/platform/execution/budget-allocator.ts                      | call-depth-budget effectiveCallDepth 用 max 而非 sum——(4,4,4) 被视为 depth 4 而非 12 |
| 1903 | P1     | src/platform/execution/runtime-state-machine.ts                 | SideEffectRecord/BudgetReservation applyStatus 不增 version——CAS 永久失效            |
| 1904 | P1     | src/platform/execution/dispatcher/dispatch-reconciliation.ts    | ticket 失效和替换在分离事务——并发产生重复 ticket                                     |
| 1905 | P2     | src/platform/execution/dispatcher/execution-dispatch-service.ts | activeLeaseCount 用 Math.max 永不减少                                                |
| 1906 | P2     | src/platform/execution/dispatcher/execution-dispatch-service.ts | preemption 用 worker 级 timestamp 非 execution 级                                    |
| 1907 | P2     | src/platform/execution/dispatcher/execution-dispatch-service.ts | spawnDepth 无上限限制                                                                |
| 1908 | P2     | src/platform/execution/dispatcher/execution-dispatch-service.ts | preemption 仅 urgent 优先级触发,忽略 high/critical                                   |
| 1909 | P2     | src/platform/execution/runtime-state-machine.ts                 | applyStatus 返回 void 非 Result 类型——调用方无法区分成功/失败                        |
| 1910 | P2     | src/platform/execution/dispatcher/dispatch-reconciliation.ts    | reconcile 扫描全量 tickets 无分页——大规模下 OOM                                      |
| 1911 | P2     | src/platform/execution/budget-allocator.ts                      | reserve() 无原子预留——并发 reserve 可超额                                            |
| 1912 | P2     | src/platform/execution/budget-allocator.ts                      | 无水位告警/层级预算继承                                                              |

### §165 Scale-Ecosystem / Ops-Maturity 深层缺陷

| #    | 严重度 | 文件                                                            | 问题                                                                                          |
| ---- | ------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1913 | P0     | src/scale-ecosystem/multi-region/ha-program-service.ts          | overallStatus "fail" 分支条件 `=== "coordinator" \|\| "postgres"` 恒 true——永不返回 "warning" |
| 1914 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts          | stopTrace/abortTrace 不从 activeTraces 移除——无界内存泄漏                                     |
| 1915 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts          | getTrace 第二分支 trace! 保证 undefined——潜在 null 解引用                                     |
| 1916 | P1     | src/ops-maturity/explainability/explanation-renderer.ts         | calculateDepth 不递归——maxDepth 恒为 0                                                        |
| 1917 | P1     | src/ops-maturity/workflow-debugger/health-monitor.ts            | 扫描全部历史——一次旧 "failed" 永久毒化状态                                                    |
| 1918 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | buildReplayState cursor fromEventIndex 总等于 toEventIndex(赋值后读取)                        |
| 1919 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | getVariableState 不去重——同名变量无界重复                                                     |
| 1920 | P1     | src/scale-ecosystem/integration/connector-framework.ts          | bindings/health map 无界增长(无 eviction)                                                     |
| 1921 | P1     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts  | createOrganization 默认租户检查 no-op                                                         |
| 1922 | P2     | src/ops-maturity/workflow-debugger/run-comparator.ts            | 仅检测左→右差异,忽略右→左                                                                     |
| 1923 | P2     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts | evictOldestSession 泄漏 eventStore 引用                                                       |
| 1924 | P2     | src/ops-maturity/workflow-debugger/execution-tracer.ts          | durationMs 在 trace 未结束时返回 NaN                                                          |
| 1925 | P2     | src/scale-ecosystem/multi-region/data-plane-flow.ts             | async wrapper 缺 syncState/resolveConflict/getReplicationLag 方法                             |
| 1926 | P2     | src/ops-maturity/explainability/explanation-renderer.ts         | simplifiedExplainer 每次 new RegExp 无缓存                                                    |
| 1927 | P2     | src/ops-maturity/workflow-debugger/health-monitor.ts            | check interval 硬编码无配置                                                                   |

### §166 UI Build / Performance / Service Worker 缺陷

| #    | 严重度 | 文件                          | 问题                                                                       |
| ---- | ------ | ----------------------------- | -------------------------------------------------------------------------- |
| 1928 | P0     | ui/apps/web/public/aa-sw.js   | sync handler 是 no-op(Promise.resolve())——background sync 完全未实现       |
| 1929 | P0     | ui/apps/web/public/aa-sw.js   | 所有 GET(含 /api/\* JSON)缓存在同一 bucket 无 TTL——永远返回 stale API data |
| 1930 | P0     | ui/scripts/perf-budget.mjs    | 仅检查 bundle 字节——无 FCP/TTI 时间强制(spec 要求 FCP<1.5s, TTI<3.5s)      |
| 1931 | P1     | ui/apps/web/public/aa-sw.js   | activate 不清理旧缓存版本                                                  |
| 1932 | P1     | ui/apps/web/public/aa-sw.js   | install 不预缓存 app shell/offline fallback                                |
| 1933 | P1     | ui/apps/web/vite.config.ts    | 无 build.target 设置;manualChunks unmatched 归入单块                       |
| 1934 | P1     | ui/apps/web/vite.config.ts    | maxJsChunkBytes 550KB 是 spec 200KB 的 2.75x                               |
| 1935 | P1     | ui/vitest.config.ts           | branches 覆盖率阈值 20% 低于其他维度 30%(spec 要求 80%)                    |
| 1936 | P2     | ui/apps/web/public/aa-sw.js   | 缓存 key 含 query string——同资源重复缓存                                   |
| 1937 | P2     | ui/scripts/perf-budget.mjs    | 硬编码路径无存在检查——文件缺失时静默通过                                   |
| 1938 | P2     | ui/tools/mock-server/index.ts | path.includes 子串匹配——/api/v1/tasks 匹配 /api/v1/tasks-archive           |
| 1939 | P2     | ui/apps/web/vite.config.ts    | 无 terser/esbuild minify 配置——依赖默认行为                                |
| 1940 | P2     | ui/scripts/perf-budget.mjs    | 无 CI 集成钩子——仅手动运行                                                 |

### §167 Security Holistic 深层缺陷

| #    | 严重度 | 文件                                                        | 问题                                                                                    |
| ---- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1941 | P0     | src/platform/control-plane/iam/access-model.ts              | evaluateAuthorizationContext 从不检查 role→capability 映射——viewer 可授权 exec_command  |
| 1942 | P0     | src/platform/control-plane/iam/policy-engine.ts             | evaluate() 不验证 subject role/capability——任何 subjectType 可通过任何 action           |
| 1943 | P1     | src/platform/control-plane/iam/secret-management-service.ts | resolveSecret 零授权——任何调用者获取任何 secret                                         |
| 1944 | P1     | src/platform/compliance/encryption/field-encryption.ts      | normalizeKey 接受 1 字符 key(~7 bit entropy)无最低强度检查                              |
| 1945 | P1     | src/plugins/plugin-runtime-host.ts                          | renderContainerizedToken 用未 sanitize 的 pluginId——可操纵容器挂载/镜像                 |
| 1946 | P1     | src/platform/control-plane/iam/access-model.ts              | roleGrantsCapabilities/inferCapabilitiesForAction 定义但从未调用——RBAC 能力强制是死代码 |
| 1947 | P1     | src/platform/control-plane/iam/secret-management-service.ts | secret rotation 无版本追踪——旧版本立即不可达                                            |
| 1948 | P1     | src/platform/control-plane/iam/policy-engine.ts             | policy 缓存无失效机制——策略变更不生效                                                   |
| 1949 | P2     | src/sdk/cli/secret-commands.ts                              | secret 输出到 stdout 无 auth gate                                                       |
| 1950 | P2     | src/platform/control-plane/iam/external-secret-provider.ts  | 从环境变量路径读文件无 sandbox 验证                                                     |
| 1951 | P2     | src/platform/control-plane/iam/external-secret-provider.ts  | vault path 无 `..` 路径遍历拒绝                                                         |
| 1952 | P2     | src/platform/shared/observability/redis-lock.ts             | JSON.parse 无 schema 验证——恶意 payload 可注入                                          |


## Round 34 — Prompt-Engine/Stability · Domains/Org-Governance · Config/Bootstrap · SDK/Plugins

### §169 Prompt-Engine / Stability 缺陷

| #    | 严重度 | 文件                                                                         | 问题                                                                         |
| ---- | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1953 | P0     | src/platform/stability/stable-evidence-bundle.ts                             | 无密码学签名——spec 要求 tamper-evident,实际写纯 JSON 无 HMAC/签名/哈希链     |
| 1954 | P0     | src/platform/prompt-engine/eval/quality-config-loader.ts:70                  | 裸 `catch {}` 吞掉所有错误静默返回宽松默认值——攻击者修改配置无告警           |
| 1955 | P0     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:210     | 直接 mutate "不可变"快照对象(deprecated/updatedAt)——违反 spec 不可变快照要求 |
| 1956 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts                   | 阶段顺序 shadow 在 canary 之前——spec 要求 canary→shadow→staged→full          |
| 1957 | P1     | src/platform/prompt-engine/rollout/index.ts:6                                | PromptRolloutMode 仅 off/suggest/shadow——无 canary/staged/full 模式          |
| 1958 | P1     | src/platform/prompt-engine/rollout/index.ts:30-119                           | 无自动回滚机制——spec 要求 metric regression 自动回滚                         |
| 1959 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:348-378                  | A/B test 硬编码 0.85/0.90 分数——统计显著性测试无意义                         |
| 1960 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:367                      | 显著性检验仅为阈值比较——非真正统计检验(t-test/bootstrap)                     |
| 1961 | P1     | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts:46-49         | 质量分权重和 1.2>1.0——clamp 丢失分辨率                                       |
| 1962 | P1     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:388-409 | findBundle 忽略 version 参数——永远选默认 bundle                              |
| 1963 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:24-29             | stable→rolled_back 自动前进——语义错误                                        |
| 1964 | P2     | src/platform/prompt-engine/registry/prompt-version-manager.ts:234-238        | VersionLineage 接口重复声明(死代码)                                          |
| 1965 | P2     | src/platform/prompt-engine/eval/cross-provider-judge-service.ts:200          | agreementScore 仅测 promote 比率——全票 rollback 得 0.0                       |
| 1966 | P2     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:260-268 | traffic slot 未归一化权重——分配不公平                                        |
| 1967 | P2     | src/platform/prompt-engine/eval/llm-eval-service.ts:566-568                  | JSON.parse(suite.cases) 无 try/catch                                         |
| 1968 | P2     | src/platform/stability/stable-evidence-bundle-support.ts:441-450             | overrides 可运行时替换 name 字段(TS Omit 不阻止 JS)                          |

### §170 Domains / Org-Governance 缺陷

| #    | 严重度 | 文件                                                                                | 问题                                                          |
| ---- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1969 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237                                | 无 PKCE 支持——auth code 流易被拦截                            |
| 1970 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237,519                            | userinfo 失败 fallback 到 mock admin 用户——攻击者故障注入提权 |
| 1971 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:329-335                            | refresh token 不轮换——spec 要求 token rotation                |
| 1972 | P0     | src/org-governance/sso-scim/scim-sync/scim-service.ts:135                           | 无租户隔离——全局 Map 返回任何租户数据                         |
| 1973 | P0     | src/org-governance/knowledge-boundary/sharing-gate/index.ts:28                      | grant expiry 检查逻辑错误+字符串比较非日期比较                |
| 1974 | P1     | src/domains/registry/domain-registry-service.ts:106-111                             | 缺 canary 状态——直接 registered→active 跳过 canary            |
| 1975 | P1     | src/domains/registry/domain-registry-service.ts                                     | 无 archived 状态转换方法                                      |
| 1976 | P1     | src/domains/registry/domain-model.ts:66-76                                          | DomainManifest 缺 resource quotas(CPU/内存/并发)              |
| 1977 | P1     | src/org-governance/delegated-governance/delegated-governance-service.ts:46-53       | delegation 不做权限交集——grantee 可超越 grantor 权限          |
| 1978 | P1     | src/org-governance/approval-routing/route-engine/index.ts:118                       | 金额阈值用 < 非 <=——恰等金额 fall through                     |
| 1979 | P1     | src/org-governance/approval-routing/approval-routing-service.ts:78-91               | audit recordId 无时间戳/随机——同 requester+node 碰撞          |
| 1980 | P1     | src/org-governance/compliance-engine/policy-resolver/index.ts:4-18                  | 无 deny-by-default——无策略时返回空对象=允许                   |
| 1981 | P1     | src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo 恒 true(length>=0 恒真)                      |
| 1982 | P2     | src/org-governance/sso-scim/oidc/oidc-service.ts:426-433                            | 过期 session 清理多等 24h                                     |
| 1983 | P2     | src/domains/recipes/recipe-executor.ts:34                                           | workflow 存在检查是正则 stub 非真实查询                       |
| 1984 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:533-535                       | SCIM patch remove members 清空全部而非目标                    |
| 1985 | P2     | src/org-governance/knowledge-boundary/knowledge-boundary-service.ts:163             | requiredGrantBoundaryIds 检查逻辑反——恒失败                   |
| 1986 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:791-818                       | SCIM filter 忽略属性名——错误匹配 userName                     |

### §171 Config / Bootstrap / Divisions 缺陷

| #    | 严重度 | 文件                                           | 问题                                                                |
| ---- | ------ | ---------------------------------------------- | ------------------------------------------------------------------- |
| 1987 | P0     | config/risk/default.json                       | 仍为 6 因子风险模型——spec 要求 8 因子                               |
| 1988 | P0     | config/security/dev.json                       | approvalMode:"auto" 绕过所有审批门                                  |
| 1989 | P0     | config/security/default.json                   | sandboxMode:"workspace_write" 过度宽松默认——违反最小权限            |
| 1990 | P0     | config/bootstrap/default.json                  | 无依赖顺序/健康检查门/层级声明——spec 要求严格依赖序                 |
| 1991 | P1     | config/bootstrap/default.json                  | 无热重载/影响分析/canary 配置                                       |
| 1992 | P1     | src/platform-architecture-bootstrap.ts:150-152 | getPlatformArchitectureServices 无条件重复注册                      |
| 1993 | P1     | src/platform-architecture-bootstrap.ts:143-146 | register 后立即 get 无就绪门——可获取未初始化数据                    |
| 1994 | P1     | divisions/\*/division.yaml                     | 无 division 声明 resource_boundaries 或 fault_domains               |
| 1995 | P1     | divisions/devops+operations                    | trigger 重叠:deployment/monitoring 无消歧规则                       |
| 1996 | P1     | divisions/engineering_ops+qa                   | trigger 重叠:bug/fix 无消歧规则                                     |
| 1997 | P1     | divisions/general_ops+research                 | trigger 重叠:research/analyze/review 靠隐式优先级                   |
| 1998 | P1     | config/risk/default.json                       | medium risk autoExecute:true+requiresApproval:false——违反纵深防御   |
| 1999 | P2     | config/security/default.json                   | remoteWorkerRegistration.allowedCapabilities 含 "bash"——prod 无覆写 |
| 2000 | P2     | config/domains/default.json                    | outputContracts schema {"type":"object"} 无属性——严格验证=无验证    |
| 2001 | P2     | config/gateways/default.json                   | 网关配置无 rate limit/auth/CORS/TLS 设置                            |
| 2002 | P2     | src/index.ts:41                                | PlatformRootEntryMode 与 PlatformStartupTargetKind 重复定义         |
| 2003 | P2     | config/runtime/default.json                    | maxToolCalls:8/maxAgentRounds:6 过低——复杂流程静默截断              |
| 2004 | P2     | config/security/threat-matrix.json             | STRIDE 模型缺 TAMPERING(config)/INFO_DISCLOSURE(agent memory)缓解   |

### §172 SDK / Plugins 缺陷

| #    | 严重度 | 文件                                              | 问题                                                                        |
| ---- | ------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 2005 | P0     | src/sdk/client-sdk/api-client.ts:208              | 重试所有非 OK 含 4xx——POST/DELETE 重复执行                                  |
| 2006 | P0     | src/sdk/client-sdk/api-client.ts                  | 无 ContractEnvelope 包装——spec 强制要求                                     |
| 2007 | P0     | src/sdk/plugin-sdk/plugin-definition.ts:144-148   | 签名验证从不执行——spec 要求签名强制                                         |
| 2008 | P0     | src/plugins/adapters/crm-adapter.ts:55-72         | execute 返回硬编码 mock——生产代码无实际 API 调用                            |
| 2009 | P1     | src/sdk/harness-sdk/index.ts                      | 缺 beforeRun/afterRun/onError/onTimeout 生命周期钩子                        |
| 2010 | P1     | src/sdk/client-sdk/api-client.ts                  | 无版本握手协议                                                              |
| 2011 | P1     | src/sdk/client-sdk/api-client.ts                  | 无类型化错误——HTTP 错误被吞                                                 |
| 2012 | P1     | src/sdk/admin-sdk/index.ts                        | 缺租户管理/配置操作/审计访问                                                |
| 2013 | P1     | src/sdk/pack-sdk/pack-manifest.ts:42-104          | 无安全扫描/制品签名                                                         |
| 2014 | P1     | src/plugins/adapters/game-dev-adapter.ts:26-28    | authenticate 是 no-op,execute 无 auth guard(同 asset-production/livestream) |
| 2015 | P1     | src/sdk/plugin-sdk/plugin-definition.ts:140       | resourceLimits/sandboxTier 仅存储不强制——sandboxTier:"none" 无告警          |
| 2016 | P1     | src/plugins/validators/basic-evaluator.ts:42      | requiredFields 空时跳过类型验证                                             |
| 2017 | P1     | src/plugins/validators/basic-evaluator.ts:53      | null 被类型化为 "object"——通过 object 类型检查                              |
| 2018 | P2     | src/sdk/plugin-sdk/plugin-test-harness.ts:196-213 | executePlugin 是 mock 永不运行真实插件代码                                  |
| 2019 | P2     | src/sdk/workbench/index.ts:8-10                   | validatePluginManifest 是 no-op pass-through                                |
| 2020 | P2     | src/plugins/adapters/github-adapter.ts:81         | repository 参数未 sanitize——URL 路径遍历                                    |
| 2021 | P2     | src/sdk/pack-sdk/pack-scaffold-service.ts:266-273 | packId 模板注入——特殊字符注入生成文件                                       |
## Round 34 — Prompt-Engine/Stability · Domains/Org-Governance · Config/Bootstrap · SDK/Plugins

### §169 Prompt-Engine / Stability 缺陷

| #    | 严重度 | 文件                                                                         | 问题                                                                         |
| ---- | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1953 | P0     | src/platform/stability/stable-evidence-bundle.ts                             | 无密码学签名——spec 要求 tamper-evident,实际写纯 JSON 无 HMAC/签名/哈希链     |
| 1954 | P0     | src/platform/prompt-engine/eval/quality-config-loader.ts:70                  | 裸 `catch {}` 吞掉所有错误静默返回宽松默认值——攻击者修改配置无告警           |
| 1955 | P0     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:210     | 直接 mutate "不可变"快照对象(deprecated/updatedAt)——违反 spec 不可变快照要求 |
| 1956 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts                   | 阶段顺序 shadow 在 canary 之前——spec 要求 canary→shadow→staged→full          |
| 1957 | P1     | src/platform/prompt-engine/rollout/index.ts:6                                | PromptRolloutMode 仅 off/suggest/shadow——无 canary/staged/full 模式          |
| 1958 | P1     | src/platform/prompt-engine/rollout/index.ts:30-119                           | 无自动回滚机制——spec 要求 metric regression 自动回滚                         |
| 1959 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:348-378                  | A/B test 硬编码 0.85/0.90 分数——统计显著性测试无意义                         |
| 1960 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:367                      | 显著性检验仅为阈值比较——非真正统计检验(t-test/bootstrap)                     |
| 1961 | P1     | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts:46-49         | 质量分权重和 1.2>1.0——clamp 丢失分辨率                                       |
| 1962 | P1     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:388-409 | findBundle 忽略 version 参数——永远选默认 bundle                              |
| 1963 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:24-29             | stable→rolled_back 自动前进——语义错误                                        |
| 1964 | P2     | src/platform/prompt-engine/registry/prompt-version-manager.ts:234-238        | VersionLineage 接口重复声明(死代码)                                          |
| 1965 | P2     | src/platform/prompt-engine/eval/cross-provider-judge-service.ts:200          | agreementScore 仅测 promote 比率——全票 rollback 得 0.0                       |
| 1966 | P2     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:260-268 | traffic slot 未归一化权重——分配不公平                                        |
| 1967 | P2     | src/platform/prompt-engine/eval/llm-eval-service.ts:566-568                  | JSON.parse(suite.cases) 无 try/catch                                         |
| 1968 | P2     | src/platform/stability/stable-evidence-bundle-support.ts:441-450             | overrides 可运行时替换 name 字段(TS Omit 不阻止 JS)                          |

### §170 Domains / Org-Governance 缺陷

| #    | 严重度 | 文件                                                                                | 问题                                                          |
| ---- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1969 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237                                | 无 PKCE 支持——auth code 流易被拦截                            |
| 1970 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237,519                            | userinfo 失败 fallback 到 mock admin 用户——攻击者故障注入提权 |
| 1971 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:329-335                            | refresh token 不轮换——spec 要求 token rotation                |
| 1972 | P0     | src/org-governance/sso-scim/scim-sync/scim-service.ts:135                           | 无租户隔离——全局 Map 返回任何租户数据                         |
| 1973 | P0     | src/org-governance/knowledge-boundary/sharing-gate/index.ts:28                      | grant expiry 检查逻辑错误+字符串比较非日期比较                |
| 1974 | P1     | src/domains/registry/domain-registry-service.ts:106-111                             | 缺 canary 状态——直接 registered→active 跳过 canary            |
| 1975 | P1     | src/domains/registry/domain-registry-service.ts                                     | 无 archived 状态转换方法                                      |
| 1976 | P1     | src/domains/registry/domain-model.ts:66-76                                          | DomainManifest 缺 resource quotas(CPU/内存/并发)              |
| 1977 | P1     | src/org-governance/delegated-governance/delegated-governance-service.ts:46-53       | delegation 不做权限交集——grantee 可超越 grantor 权限          |
| 1978 | P1     | src/org-governance/approval-routing/route-engine/index.ts:118                       | 金额阈值用 < 非 <=——恰等金额 fall through                     |
| 1979 | P1     | src/org-governance/approval-routing/approval-routing-service.ts:78-91               | audit recordId 无时间戳/随机——同 requester+node 碰撞          |
| 1980 | P1     | src/org-governance/compliance-engine/policy-resolver/index.ts:4-18                  | 无 deny-by-default——无策略时返回空对象=允许                   |
| 1981 | P1     | src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo 恒 true(length>=0 恒真)                      |
| 1982 | P2     | src/org-governance/sso-scim/oidc/oidc-service.ts:426-433                            | 过期 session 清理多等 24h                                     |
| 1983 | P2     | src/domains/recipes/recipe-executor.ts:34                                           | workflow 存在检查是正则 stub 非真实查询                       |
| 1984 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:533-535                       | SCIM patch remove members 清空全部而非目标                    |
| 1985 | P2     | src/org-governance/knowledge-boundary/knowledge-boundary-service.ts:163             | requiredGrantBoundaryIds 检查逻辑反——恒失败                   |
| 1986 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:791-818                       | SCIM filter 忽略属性名——错误匹配 userName                     |

### §171 Config / Bootstrap / Divisions 缺陷

| #    | 严重度 | 文件                                           | 问题                                                                |
| ---- | ------ | ---------------------------------------------- | ------------------------------------------------------------------- |
| 1987 | P0     | config/risk/default.json                       | 仍为 6 因子风险模型——spec 要求 8 因子                               |
| 1988 | P0     | config/security/dev.json                       | approvalMode:"auto" 绕过所有审批门                                  |
| 1989 | P0     | config/security/default.json                   | sandboxMode:"workspace_write" 过度宽松默认——违反最小权限            |
| 1990 | P0     | config/bootstrap/default.json                  | 无依赖顺序/健康检查门/层级声明——spec 要求严格依赖序                 |
| 1991 | P1     | config/bootstrap/default.json                  | 无热重载/影响分析/canary 配置                                       |
| 1992 | P1     | src/platform-architecture-bootstrap.ts:150-152 | getPlatformArchitectureServices 无条件重复注册                      |
| 1993 | P1     | src/platform-architecture-bootstrap.ts:143-146 | register 后立即 get 无就绪门——可获取未初始化数据                    |
| 1994 | P1     | divisions/\*/division.yaml                     | 无 division 声明 resource_boundaries 或 fault_domains               |
| 1995 | P1     | divisions/devops+operations                    | trigger 重叠:deployment/monitoring 无消歧规则                       |
| 1996 | P1     | divisions/engineering_ops+qa                   | trigger 重叠:bug/fix 无消歧规则                                     |
| 1997 | P1     | divisions/general_ops+research                 | trigger 重叠:research/analyze/review 靠隐式优先级                   |
| 1998 | P1     | config/risk/default.json                       | medium risk autoExecute:true+requiresApproval:false——违反纵深防御   |
| 1999 | P2     | config/security/default.json                   | remoteWorkerRegistration.allowedCapabilities 含 "bash"——prod 无覆写 |
| 2000 | P2     | config/domains/default.json                    | outputContracts schema {"type":"object"} 无属性——严格验证=无验证    |
| 2001 | P2     | config/gateways/default.json                   | 网关配置无 rate limit/auth/CORS/TLS 设置                            |
| 2002 | P2     | src/index.ts:41                                | PlatformRootEntryMode 与 PlatformStartupTargetKind 重复定义         |
| 2003 | P2     | config/runtime/default.json                    | maxToolCalls:8/maxAgentRounds:6 过低——复杂流程静默截断              |
| 2004 | P2     | config/security/threat-matrix.json             | STRIDE 模型缺 TAMPERING(config)/INFO_DISCLOSURE(agent memory)缓解   |

### §172 SDK / Plugins 缺陷

| #    | 严重度 | 文件                                              | 问题                                                                        |
| ---- | ------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 2005 | P0     | src/sdk/client-sdk/api-client.ts:208              | 重试所有非 OK 含 4xx——POST/DELETE 重复执行                                  |
| 2006 | P0     | src/sdk/client-sdk/api-client.ts                  | 无 ContractEnvelope 包装——spec 强制要求                                     |
| 2007 | P0     | src/sdk/plugin-sdk/plugin-definition.ts:144-148   | 签名验证从不执行——spec 要求签名强制                                         |
| 2008 | P0     | src/plugins/adapters/crm-adapter.ts:55-72         | execute 返回硬编码 mock——生产代码无实际 API 调用                            |
| 2009 | P1     | src/sdk/harness-sdk/index.ts                      | 缺 beforeRun/afterRun/onError/onTimeout 生命周期钩子                        |
| 2010 | P1     | src/sdk/client-sdk/api-client.ts                  | 无版本握手协议                                                              |
| 2011 | P1     | src/sdk/client-sdk/api-client.ts                  | 无类型化错误——HTTP 错误被吞                                                 |
| 2012 | P1     | src/sdk/admin-sdk/index.ts                        | 缺租户管理/配置操作/审计访问                                                |
| 2013 | P1     | src/sdk/pack-sdk/pack-manifest.ts:42-104          | 无安全扫描/制品签名                                                         |
| 2014 | P1     | src/plugins/adapters/game-dev-adapter.ts:26-28    | authenticate 是 no-op,execute 无 auth guard(同 asset-production/livestream) |
| 2015 | P1     | src/sdk/plugin-sdk/plugin-definition.ts:140       | resourceLimits/sandboxTier 仅存储不强制——sandboxTier:"none" 无告警          |
| 2016 | P1     | src/plugins/validators/basic-evaluator.ts:42      | requiredFields 空时跳过类型验证                                             |
| 2017 | P1     | src/plugins/validators/basic-evaluator.ts:53      | null 被类型化为 "object"——通过 object 类型检查                              |
| 2018 | P2     | src/sdk/plugin-sdk/plugin-test-harness.ts:196-213 | executePlugin 是 mock 永不运行真实插件代码                                  |
| 2019 | P2     | src/sdk/workbench/index.ts:8-10                   | validatePluginManifest 是 no-op pass-through                                |
| 2020 | P2     | src/plugins/adapters/github-adapter.ts:81         | repository 参数未 sanitize——URL 路径遍历                                    |
| 2021 | P2     | src/sdk/pack-sdk/pack-scaffold-service.ts:266-273 | packId 模板注入——特殊字符注入生成文件                                       |

## Round 35 — Orchestration/State-Evidence · Interaction/Interface · ADR/Contract · UI Features/Shared

### §174 Orchestration / State-Evidence 深层缺陷

| #    | 严重度 | 文件                                                                        | 问题                                                                                   |
| ---- | ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2022 | P0     | src/platform/orchestration/oapeflir/stage-transition-fsm.ts:122             | FSM 阻止 feedback→observe 反向转换——OAPEFLIR 闭环不可能                                |
| 2023 | P0     | src/platform/orchestration/oapeflir/stage-transition-fsm.ts:182             | recordStageCompletion("release") 设 index=8 越界——后续查询 crash                       |
| 2024 | P0     | src/platform/state-evidence/events/cas/cas-service.ts:46-47                 | CAS 纯内存 Map——read-check-write 非原子,无分布式并发控制                               |
| 2025 | P0     | src/platform/state-evidence/events/transactional-event-appender.ts:97       | 手动 BEGIN/COMMIT 绕过 db.transaction()——SQLite 无嵌套事务导致边界损坏                 |
| 2026 | P1     | src/platform/state-evidence/events/cas/fencing-token-service.ts:100-110     | fencing token 按 `-` split 解析——UUID executionId 含连字符被错误切割                   |
| 2027 | P1     | src/platform/state-evidence/memory/memory-service.ts:158                    | 内容 hash 截断至 16 hex(64-bit)——~10K 记录时碰撞概率显著                               |
| 2028 | P1     | src/platform/state-evidence/memory/memory-decay-service.ts:194-195          | scope→SixLayerMemoryType 无映射——"project"等真实 scope 全回退 session 衰减率           |
| 2029 | P1     | src/platform/state-evidence/knowledge/knowledge-ingestion-pipeline.ts:169   | 知识摄入跳过 quarantine——spec 要求隔离+推广生命周期                                    |
| 2030 | P1     | src/platform/state-evidence/checkpoints/workflow-step-checkpoint.ts:255-258 | compensationModel 类型判断 typeof==="string" 但实际类型是 object——有效 checkpoint 被拒 |
| 2031 | P1     | src/platform/state-evidence/memory/memory-service.ts:138-140                | 大小检查用 .length(UTF-16 码元)非字节——CJK 内容可超 1MB                                |
| 2032 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:361-365        | 返回原始 assessment 而非 validatedAssessment——下游收到未验证数据                       |
| 2033 | P2     | src/platform/state-evidence/events/durable-event-bus.ts:358                 | 重试循环 0..<=MAX(3) 实际 4 次——描述说"3次重试"                                        |
| 2034 | P2     | src/platform/state-evidence/events/event-registry.ts:670-675                | getRegisteredConsumers 对 runtime 类型 undefined 解引 crash                            |
| 2035 | P2     | src/platform/orchestration/harness/memory-manager.ts:10-39                  | HarnessMemoryManager 无 eviction/max-size——无界增长                                    |
| 2036 | P2     | src/platform/state-evidence/memory/knowledge-promotion-service.ts:403       | verificationStatus 原地 mutate——违反追加-only 不可变审计                               |
| 2037 | P2     | src/platform/state-evidence/memory/memory-retrieval-service.ts:288          | 参数化查询前手动转义引号——含引号 ID 永远 DELETE 不到                                   |

### §175 Interaction / Interface 缺陷

| #    | 严重度 | 文件                                                               | 问题                                                             |
| ---- | ------ | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 2038 | P0     | src/platform/interface/api/http-server/response-hardening.ts:12-18 | CORS origin:"\*"+credentials:true——回显任意 Origin=无 CORS       |
| 2039 | P0     | src/platform/interface/api/http-server/approval-routes.ts:73,119   | approvalId 无校验/无 authz——任意 ID 注入批准/查看决策            |
| 2040 | P0     | src/interaction/dashboard/dashboard-websocket-server.ts:330-346    | heartbeat 标记断开但不 unregister——连接/订阅 Map 无界泄漏        |
| 2041 | P1     | src/interaction/goal-decomposer/index.ts:297-324                   | 检测到循环图仍设 ready_for_planner——planner 收到循环 DAG         |
| 2042 | P1     | src/interaction/autonomy/level-manager/index.ts:3-9                | "frozen" 排序在 "full_auto" 之上——frozen agent 被比作更高自治    |
| 2043 | P1     | src/platform/interface/api/http-server/task-routes.ts:255-256      | PATCH title 更新死代码——写入旧值不生效                           |
| 2044 | P1     | src/interaction/goal-decomposer/index.ts:343-344                   | currentDepth 恒0/maxDepthReached 恒 false——递归深度防护无效      |
| 2045 | P1     | src/platform/interface/api/http-server/admin-routes.ts:217         | listTenants(MAX_SAFE_INTEGER) 加载全量计算 total——OOM DoS        |
| 2046 | P1     | src/interaction/proactive-agent/index.ts:392-421                   | 循环检测 stack.delete 在捕获前——incident 记录不完整 trigger 集   |
| 2047 | P1     | src/platform/interface/channel-gateway/channel-gateway-service.ts  | 仅 outbound——inbound webhook 存原始 payload 不转 RequestEnvelope |
| 2048 | P2     | src/interaction/proactive-agent/trigger-engine/index.ts:1-9        | resolveTriggerActionMode 导出但从未调用(死代码)                  |
| 2049 | P2     | src/interaction/nl-gateway/index.ts:463-478 vs :668                | 状态机不一致——parseDetailed 返回 "Building" 但 buildTask 跳过    |
| 2050 | P2     | src/interaction/dashboard/index.ts:402                             | attention queue 按 createdAt 排序忽略 priority                   |
| 2051 | P2     | src/interaction/nl-gateway/index.ts:804-899                        | 会话上下文 Map 无 max-size/LRU——无界内存增长                     |
| 2052 | P2     | src/platform/interface/api/middleware/                             | 无 rate limiting 中间件接入 pipeline                             |
| 2053 | P2     | src/interaction/nl-gateway/index.ts:448-461                        | 注入检测 per-pattern 仅返回首个匹配——低估攻击严重度              |

### §176 ADR / Contract 文档偏差

| #    | 严重度 | 文件                                                           | 问题                                                                                         |
| ---- | ------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2054 | P0     | docs_zh/adr/060-explicit-planning-hub.md                       | 定义 `Plan{steps:PlanStep[]}` 作为 P3→P4 规范——spec/ADR-109 要求 PlanGraphBundle(DAG)        |
| 2055 | P0     | docs_zh/adr/083-proactive-agent-and-progressive-autonomy.md    | 4 级自治——spec §9.5 已改为 8 种 canonical runtime mode                                       |
| 2056 | P0     | docs_zh/adr/065-workflow-visual-debugger.md                    | 引用 WorkflowState 为权威——spec §5.5 已改为 HarnessRun/NodeRun                               |
| 2057 | P1     | docs_zh/contracts/workflow_debugger_contract.md                | BreakpointDefinition 用 workflow_id+step_selector——应为 harnessRunId+nodeRunId               |
| 2058 | P1     | docs_zh/contracts/perception_intelligence_plane_contract.md    | completeness_score 用 "steps" 单位——应为 NodeRun                                             |
| 2059 | P1     | docs_zh/contracts/app_error_contract.md                        | 导出 WorkflowStateError——应为 HarnessRunError/NodeRunError                                   |
| 2060 | P1     | docs_zh/contracts/platform_ops_agent_contract.md               | OpsMaturityLevel 用 legacy 4 值——应为 canonical runtime modes                                |
| 2061 | P1     | docs_zh/adr/073-unified-resource-model.md                      | 将 TaskRecord/WorkflowState 列为"canonical objects"——spec §5.5 定义为 non-authoritative 投影 |
| 2062 | P1     | docs_zh/adr/054-sla-tiered-guarantees.md                       | platinum 99.99% 无 failover/quorum/演练前提——spec §2.5 禁止                                  |
| 2063 | P1     | docs_zh/adr/026-risk-control-architecture.md                   | 风险因子名/权重与 spec §10.2 八因子不匹配——因子已重命名重加权                                |
| 2064 | P1     | docs_zh/adr/066-\*.md                                          | 已解决：Plugin SPI ADR 已迁移为 `ADR-071`，重复编号已消除并由文档测试守护                         |
| 2065 | P2     | docs_zh/adr/060-explicit-planning-hub.md                       | 引用 RuntimeExecuteBridge——不存在于任何 contract/spec                                        |
| 2066 | P2     | docs_zh/contracts/domain_descriptor_and_onboarding_contract.md | DomainDescriptor 缺 latency_tier——ADR-105 要求                                               |
| 2067 | P2     | docs_zh/contracts/cost_and_budget_contract.md                  | BudgetPolicy 含 max_steps——应为 max_node_runs                                                |
| 2068 | P2     | docs_zh/adr/069-platform-self-operating-agent.md               | self-ops 能力无 OpsActionProposal/governance gate 引用                                       |

### §177 UI Features / Shared Packages 缺陷

| #    | 严重度 | 文件                                                         | 问题                                                             |
| ---- | ------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 2069 | P0     | ui/packages/shared/auth/src/auth-service.ts:37               | SSO token 从 URL query 提取——泄漏至 history/Referer/日志         |
| 2070 | P0     | ui/packages/shared/api-client/src/ws-client.ts:88            | WS auth token 嵌入 URL query——代理/CDN 可见                      |
| 2071 | P1     | ui/packages/shared/api-client/src/interceptors.ts:29         | auth interceptor 闭包捕获初始 token——refresh 后仍发旧 token      |
| 2072 | P1     | ui/packages/shared/api-client/src/interceptors.ts:51         | CSRF interceptor 读取一次 meta tag——rotation 后 403              |
| 2073 | P1     | ui/packages/shared/sync/src/offline-queue.ts:19-22           | enqueue 在 IndexedDB 加载前调用——persist 覆写未加载数据          |
| 2074 | P1     | ui/packages/shared/sync/src/conflict-resolver.ts:19-23       | merge 仅浅展开——嵌套对象 server 值被覆盖=数据丢失                |
| 2075 | P1     | ui/packages/shared/sync/src/sync-coordinator.ts:33-38        | flush() 返回 mutations 但不发送——离线变更被丢弃                  |
| 2076 | P1     | ui/packages/shared/telemetry/src/index.ts:17,27              | events 数组无上限——长时间会话无界内存泄漏                        |
| 2077 | P1     | ui/packages/shared/api-client/src/rest-client.ts:60-147      | MockTransport 忽略 HTTP method——POST/DELETE 返回 GET 数据        |
| 2078 | P1     | ui/packages/ui-core/src/index.tsx:61                         | createFeatureModule 硬编码 codeSplit:false——spec 要求 lazy load  |
| 2079 | P2     | ui/packages/shared/telemetry/src/index.ts:28-30              | telemetry export 错误静默吞——数据丢失无告警                      |
| 2080 | P2     | ui/packages/shared/sync/src/offline-queue.ts:87-101          | 每次 readAll/writeAll 新建 IndexedDB 连接——无复用                |
| 2081 | P2     | ui/packages/ui-core/src/layouts/index.ts:30                  | ThreePaneLayout 最小 720px——移动端溢出                           |
| 2082 | P2     | ui/packages/ui-core/src/components/index.ts:156              | onChange 用 DOM Event 非 React.ChangeEvent——类型安全缺口         |
| 2083 | P2     | ui/packages/ui-core/src/themes/index.ts:5-22                 | darkTheme 缺 accent/danger/success/warning 覆写——WCAG AAA 不达标 |
| 2084 | P2     | ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:58 | useEffect deps 缺 theme ref——主题切换后图表颜色 stale            |


## Round 36 — Model-Gateway/Compliance · Tests/Ops-Maturity · Control-Plane/Scale-Eco · Execution/Shared

### §179 Model-Gateway / Compliance 深层缺陷

| #    | 严重度 | 文件                                                                                     | 问题                                                                        |
| ---- | ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2085 | P0     | src/platform/compliance/crypto-shredding/crypto-shredding-service.ts:249                 | encryptRecordForSubject 返回 originalValue(明文 PII)——调用方日志/持久化泄漏 |
| 2086 | P0     | src/platform/compliance/crypto-shredding/dek-manager.ts:207-208                          | markRotated() 删除旧 key——已加密数据无法解密,rotation 是破坏性的            |
| 2087 | P0     | src/platform/model-gateway/cost-tracker/chargeback-service.ts:40-73                      | 成本追踪与执行非原子——crash 间丢失成本记录                                  |
| 2088 | P1     | src/platform/model-gateway/provider-registry/circuit-breaker.ts:270-277                  | failureRate=(failures/windowSec)\*10——无请求总数分母,3次失败即50%触发 open  |
| 2089 | P1     | src/platform/model-gateway/provider-registry/openai/openai-chat-service.ts:463-465       | streaming finish_reason 从首个 chunk 读——首 chunk 恒为 null,结果恒"stop"    |
| 2090 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts:357-359                 | getFallbackCandidates() 硬编码返回 []——D1 永不生效直跳 D2                   |
| 2091 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts:209-241                 | 递归 escalation 无深度限制——D1-D4 全失败时 stack overflow                   |
| 2092 | P1     | src/platform/compliance/lineage/index.ts:17                                              | lineage DAG 可变(plain array)——无 append-only/完整性哈希/篡改检测           |
| 2093 | P1     | src/platform/model-gateway/provider-registry/unified-chat-provider.ts:297-335            | streaming 绕过 circuit breaker——流失败不计入/open 时不拒绝                  |
| 2094 | P2     | src/platform/compliance/crypto-shredding/dek-manager.ts:386                              | 返回 stale IV(元数据)非实际加密使用的 IV                                    |
| 2095 | P2     | src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.ts:305-306 | message role 映射是恒等——死代码                                             |
| 2096 | P2     | src/platform/model-gateway/degradation/degradation-controller.ts:425-447                 | de-escalation 忽略 latency P99——高延迟持续振荡                              |
| 2097 | P2     | src/platform/model-gateway/provider-registry/circuit-breaker.ts:155                      | 无最小样本量——3次失败即 open 忽略千次成功                                   |
| 2098 | P2     | src/platform/compliance/encryption/index.ts:61-63                                        | field encryption 仍为 base64url 编码非 AES-256-GCM                          |
| 2099 | P2     | src/platform/model-gateway/provider-registry/unified-chat-provider.ts:136-137            | MiniMax 表查找死代码——大小写不匹配永不命中                                  |

### §180 Tests / Ops-Maturity 缺陷

| #    | 严重度 | 文件                                                                           | 问题                                                                            |
| ---- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 2100 | P0     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:155                       | injectFault() 仅返回配置不注入——无真实故障注入能力                              |
| 2101 | P0     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:148                       | recordSteadyStateResult 按计数非按 hypothesis ID 去重——同假设重复记录可完成实验 |
| 2102 | P0     | src/ops-maturity/drift-detection/benchmark-runner.ts:119                       | benchmark 用 Math.random() 模拟结果——promotion gate 决策无意义                  |
| 2103 | P0     | src/ops-maturity/agent-lifecycle/agent-registry/index.ts:144                   | deprecated→active 有效——绕过所有 stage gate 直接回生产                          |
| 2104 | P1     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:161                       | autoTerminate 不回滚已注入故障——spec 要求自动回滚                               |
| 2105 | P1     | src/ops-maturity/agent-lifecycle/agent-lifecycle-service.ts:263                | bindTask 允许 draft/testing/staging 状态 agent                                  |
| 2106 | P1     | src/ops-maturity/drift-detection/rollout-manager.ts:42                         | rollout 纯内存无持久化——重启丢失;rollback() 仅改状态无实际回滚                  |
| 2107 | P1     | src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts:119 | ISO 时间字符串比较——非 UTC 格式静默错误;overdue/expired 反转                    |
| 2108 | P1     | src/ops-maturity/agent-lifecycle/agent-performance-profiler.ts:65              | eviction 按 Map 插入序非按活跃度——最近活跃可被淘汰                              |
| 2109 | P1     | tests/unit/ops-maturity/agent-lifecycle/agent-lifecycle-service.test.ts:10     | 测试用非法 shape——服务不验证 schema,测试无法检测 contract 违规                  |
| 2110 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:44                       | 需≥2次同类失败才反思——单次严重安全事件被忽略                                    |
| 2111 | P2     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:94                        | steadyStateCache 声明但从未读写(死代码)                                         |
| 2112 | P2     | tests/integration/ops-maturity/chaos/ integration test:296                     | 测试断言通过原因错误——实验已提前完成而非仍 running                              |
| 2113 | P2     | src/ops-maturity/drift-detection/cross-agent-analyzer/index.ts:29              | 单 agent 时 best===worst——语义误导                                              |
| 2114 | P2     | src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts:66  | generate() 双重查找——fallback 是死代码                                          |
| 2115 | P2     | src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.ts:86   | blue-green 互斥 revoke——只有单 slot 活跃,违反零停机切换                         |

### §181 Control-Plane / Scale-Ecosystem 缺陷

| #    | 严重度 | 文件                                                                                     | 问题                                                            |
| ---- | ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2116 | P0     | src/platform/control-plane/config-center/config-rollout-service.ts:134                   | canary rollout target=100 直跳 FULL——跳过 5%/25%/50% 阶段       |
| 2117 | P0     | src/scale-ecosystem/marketplace/pack-security-service.ts:154-169                         | sandbox test 仅扫权限列表不执行代码——恶意运行时行为通过         |
| 2118 | P0     | src/scale-ecosystem/marketplace/auto-stop-loss-service.ts:727-741                        | human-approved playbook actions 永不执行——审批后 no-op          |
| 2119 | P1     | src/platform/control-plane/incident-control/runbook-executor/markdown-parser.ts:48       | 严重度 pattern `\bhight\b` 拼写错误——P1 永不匹配 "high"         |
| 2120 | P1     | src/platform/control-plane/config-center/config-versioning-service.ts:339                | rollback 浅拷贝——嵌套对象共享引用,修改腐败历史版本              |
| 2121 | P1     | src/platform/control-plane/risk-control/risk-evaluation-engine.ts:14-16                  | 仅 6 因子——缺 reversibility+temporal_context(spec §10.2 要求 8) |
| 2122 | P1     | src/platform/control-plane/risk-control/risk-config-loader.ts:39-73                      | JSON.parse 无 schema 验证——畸形配置直接 TypeError crash         |
| 2123 | P1     | src/scale-ecosystem/sla-engine/sla-operations-service.ts:111                             | preemptionCapApplied 恒 true(值≤max 恒成立)                     |
| 2124 | P1     | src/scale-ecosystem/integration/connector-framework-service.ts:95-105                    | 无 circuit breaker——单次 healthy 即信任,无状态机                |
| 2125 | P1     | src/platform/control-plane/incident-control/incident-detector.ts:63-84                   | 仅生成 P1/P2——P3/P4 检查结果不创建 incident                     |
| 2126 | P2     | src/platform/control-plane/incident-control/takeover-escalation-manager.ts:406-413       | 未确认 session 永不淘汰——Map 无界增长                           |
| 2127 | P2     | src/platform/control-plane/incident-control/auto-stop-loss-service.ts:700-706            | executionCounts hourly key 无清理——慢泄漏                       |
| 2128 | P2     | src/platform/control-plane/incident-control/auto-stop-loss-service.ts:619                | 升级级别靠 string includes "emergency"——大小写/措辞变体误判     |
| 2129 | P2     | src/platform/control-plane/config-center/config-override-governance.ts:314-318           | requireAudit && !allowed 分支不可达(死代码)                     |
| 2130 | P2     | src/platform/control-plane/incident-control/runbook-executor/runbook-executor.ts:238-241 | "只读"正则匹配 kubectl delete/docker rm 等破坏性命令            |
| 2131 | P2     | src/scale-ecosystem/sla-engine/breach-detector/index.ts:17-24                            | 无 burn-rate/error-budget 追踪——仅点快照阈值                    |

### §182 Execution / Shared Infrastructure 缺陷

| #    | 严重度 | 文件                                                                   | 问题                                                                               |
| ---- | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2132 | P0     | src/platform/execution/tool-executor/command-executor.ts:368-380       | stdout/stderr 无 maxBuffer——恶意命令输出 OOM                                       |
| 2133 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:676-679      | verifyWriteAuthority 用 >=——stale leader 持当前 token 被接受,破坏 split-brain 防护 |
| 2134 | P0     | src/platform/execution/ha/wal-checkpoint-service.ts:119                | sequenceCounter 纯内存——crash 后重置为 0 产生重复 WAL 序号                         |
| 2135 | P1     | src/platform/shared/lifecycle/service-registry.ts:316-323              | 拓扑排序循环仅 warn——cycled 服务跳过 teardown 导致资源泄漏                         |
| 2136 | P1     | src/platform/execution/tool-executor/command-security.ts:259           | 脚本后所有 flag 被阻——`python script.py --output foo` 被拒                         |
| 2137 | P1     | src/platform/execution/tool-executor/command-security.ts:120           | META_SYNTAX_PATTERN 匹配 glob——`ls *.ts` 被误拒                                    |
| 2138 | P1     | src/platform/shared/lifecycle/graceful-shutdown.ts:227                 | 超时 handler 继续后台运行——Promise.race 后 zombie async                            |
| 2139 | P1     | src/platform/shared/observability/structured-logger.ts:437             | rotationScheduled per-instance 但 fileSink 全局——并发 rotation 文件损坏            |
| 2140 | P1     | src/platform/execution/ha/leader-election-service.ts:512-514           | setInterval 无 unref()——阻止进程正常退出                                           |
| 2141 | P1     | src/platform/execution/ha/leader-election-service.ts:545-547           | heartbeat setInterval 无 unref()——同上                                             |
| 2142 | P1     | src/platform/execution/ha/wal-checkpoint-service.ts:597-599            | checkpoint interval 无 unref()——同上                                               |
| 2143 | P1     | src/platform/execution/tool-executor/tool-parallel-executor.ts:406-407 | results 数组含 undefined hole——下游收到意外 undefined 元素                         |
| 2144 | P2     | src/platform/shared/lifecycle/service-registry.ts:146-149              | `if(!has){delete}` 是 no-op——条件写反                                              |
| 2145 | P2     | src/platform/execution/tool-executor/command-security.ts:92-111        | touch/mkdir 重复条目——Map last-wins 首条死代码                                     |
| 2146 | P2     | src/platform/execution/tool-executor/tool-output-sanitizer.ts:28       | CONTROL_CHARS_REGEX 漏 0x1C-0x1F——FS/GS/RS/US 未清理                               |
## Round 36 — Model-Gateway/Compliance · Tests/Ops-Maturity · Control-Plane/Scale-Eco · Execution/Shared

### §179 Model-Gateway / Compliance 深层缺陷

| #    | 严重度 | 文件                                                                                     | 问题                                                                        |
| ---- | ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2085 | P0     | src/platform/compliance/crypto-shredding/crypto-shredding-service.ts:249                 | encryptRecordForSubject 返回 originalValue(明文 PII)——调用方日志/持久化泄漏 |
| 2086 | P0     | src/platform/compliance/crypto-shredding/dek-manager.ts:207-208                          | markRotated() 删除旧 key——已加密数据无法解密,rotation 是破坏性的            |
| 2087 | P0     | src/platform/model-gateway/cost-tracker/chargeback-service.ts:40-73                      | 成本追踪与执行非原子——crash 间丢失成本记录                                  |
| 2088 | P1     | src/platform/model-gateway/provider-registry/circuit-breaker.ts:270-277                  | failureRate=(failures/windowSec)\*10——无请求总数分母,3次失败即50%触发 open  |
| 2089 | P1     | src/platform/model-gateway/provider-registry/openai/openai-chat-service.ts:463-465       | streaming finish_reason 从首个 chunk 读——首 chunk 恒为 null,结果恒"stop"    |
| 2090 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts:357-359                 | getFallbackCandidates() 硬编码返回 []——D1 永不生效直跳 D2                   |
| 2091 | P1     | src/platform/model-gateway/degradation/degradation-controller.ts:209-241                 | 递归 escalation 无深度限制——D1-D4 全失败时 stack overflow                   |
| 2092 | P1     | src/platform/compliance/lineage/index.ts:17                                              | lineage DAG 可变(plain array)——无 append-only/完整性哈希/篡改检测           |
| 2093 | P1     | src/platform/model-gateway/provider-registry/unified-chat-provider.ts:297-335            | streaming 绕过 circuit breaker——流失败不计入/open 时不拒绝                  |
| 2094 | P2     | src/platform/compliance/crypto-shredding/dek-manager.ts:386                              | 返回 stale IV(元数据)非实际加密使用的 IV                                    |
| 2095 | P2     | src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.ts:305-306 | message role 映射是恒等——死代码                                             |
| 2096 | P2     | src/platform/model-gateway/degradation/degradation-controller.ts:425-447                 | de-escalation 忽略 latency P99——高延迟持续振荡                              |
| 2097 | P2     | src/platform/model-gateway/provider-registry/circuit-breaker.ts:155                      | 无最小样本量——3次失败即 open 忽略千次成功                                   |
| 2098 | P2     | src/platform/compliance/encryption/index.ts:61-63                                        | field encryption 仍为 base64url 编码非 AES-256-GCM                          |
| 2099 | P2     | src/platform/model-gateway/provider-registry/unified-chat-provider.ts:136-137            | MiniMax 表查找死代码——大小写不匹配永不命中                                  |

### §180 Tests / Ops-Maturity 缺陷

| #    | 严重度 | 文件                                                                           | 问题                                                                            |
| ---- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 2100 | P0     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:155                       | injectFault() 仅返回配置不注入——无真实故障注入能力                              |
| 2101 | P0     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:148                       | recordSteadyStateResult 按计数非按 hypothesis ID 去重——同假设重复记录可完成实验 |
| 2102 | P0     | src/ops-maturity/drift-detection/benchmark-runner.ts:119                       | benchmark 用 Math.random() 模拟结果——promotion gate 决策无意义                  |
| 2103 | P0     | src/ops-maturity/agent-lifecycle/agent-registry/index.ts:144                   | deprecated→active 有效——绕过所有 stage gate 直接回生产                          |
| 2104 | P1     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:161                       | autoTerminate 不回滚已注入故障——spec 要求自动回滚                               |
| 2105 | P1     | src/ops-maturity/agent-lifecycle/agent-lifecycle-service.ts:263                | bindTask 允许 draft/testing/staging 状态 agent                                  |
| 2106 | P1     | src/ops-maturity/drift-detection/rollout-manager.ts:42                         | rollout 纯内存无持久化——重启丢失;rollback() 仅改状态无实际回滚                  |
| 2107 | P1     | src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts:119 | ISO 时间字符串比较——非 UTC 格式静默错误;overdue/expired 反转                    |
| 2108 | P1     | src/ops-maturity/agent-lifecycle/agent-performance-profiler.ts:65              | eviction 按 Map 插入序非按活跃度——最近活跃可被淘汰                              |
| 2109 | P1     | tests/unit/ops-maturity/agent-lifecycle/agent-lifecycle-service.test.ts:10     | 测试用非法 shape——服务不验证 schema,测试无法检测 contract 违规                  |
| 2110 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:44                       | 需≥2次同类失败才反思——单次严重安全事件被忽略                                    |
| 2111 | P2     | src/ops-maturity/chaos/chaos-experiment-scheduler.ts:94                        | steadyStateCache 声明但从未读写(死代码)                                         |
| 2112 | P2     | tests/integration/ops-maturity/chaos/ integration test:296                     | 测试断言通过原因错误——实验已提前完成而非仍 running                              |
| 2113 | P2     | src/ops-maturity/drift-detection/cross-agent-analyzer/index.ts:29              | 单 agent 时 best===worst——语义误导                                              |
| 2114 | P2     | src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts:66  | generate() 双重查找——fallback 是死代码                                          |
| 2115 | P2     | src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.ts:86   | blue-green 互斥 revoke——只有单 slot 活跃,违反零停机切换                         |

### §181 Control-Plane / Scale-Ecosystem 缺陷

| #    | 严重度 | 文件                                                                                     | 问题                                                            |
| ---- | ------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2116 | P0     | src/platform/control-plane/config-center/config-rollout-service.ts:134                   | canary rollout target=100 直跳 FULL——跳过 5%/25%/50% 阶段       |
| 2117 | P0     | src/scale-ecosystem/marketplace/pack-security-service.ts:154-169                         | sandbox test 仅扫权限列表不执行代码——恶意运行时行为通过         |
| 2118 | P0     | src/scale-ecosystem/marketplace/auto-stop-loss-service.ts:727-741                        | human-approved playbook actions 永不执行——审批后 no-op          |
| 2119 | P1     | src/platform/control-plane/incident-control/runbook-executor/markdown-parser.ts:48       | 严重度 pattern `\bhight\b` 拼写错误——P1 永不匹配 "high"         |
| 2120 | P1     | src/platform/control-plane/config-center/config-versioning-service.ts:339                | rollback 浅拷贝——嵌套对象共享引用,修改腐败历史版本              |
| 2121 | P1     | src/platform/control-plane/risk-control/risk-evaluation-engine.ts:14-16                  | 仅 6 因子——缺 reversibility+temporal_context(spec §10.2 要求 8) |
| 2122 | P1     | src/platform/control-plane/risk-control/risk-config-loader.ts:39-73                      | JSON.parse 无 schema 验证——畸形配置直接 TypeError crash         |
| 2123 | P1     | src/scale-ecosystem/sla-engine/sla-operations-service.ts:111                             | preemptionCapApplied 恒 true(值≤max 恒成立)                     |
| 2124 | P1     | src/scale-ecosystem/integration/connector-framework-service.ts:95-105                    | 无 circuit breaker——单次 healthy 即信任,无状态机                |
| 2125 | P1     | src/platform/control-plane/incident-control/incident-detector.ts:63-84                   | 仅生成 P1/P2——P3/P4 检查结果不创建 incident                     |
| 2126 | P2     | src/platform/control-plane/incident-control/takeover-escalation-manager.ts:406-413       | 未确认 session 永不淘汰——Map 无界增长                           |
| 2127 | P2     | src/platform/control-plane/incident-control/auto-stop-loss-service.ts:700-706            | executionCounts hourly key 无清理——慢泄漏                       |
| 2128 | P2     | src/platform/control-plane/incident-control/auto-stop-loss-service.ts:619                | 升级级别靠 string includes "emergency"——大小写/措辞变体误判     |
| 2129 | P2     | src/platform/control-plane/config-center/config-override-governance.ts:314-318           | requireAudit && !allowed 分支不可达(死代码)                     |
| 2130 | P2     | src/platform/control-plane/incident-control/runbook-executor/runbook-executor.ts:238-241 | "只读"正则匹配 kubectl delete/docker rm 等破坏性命令            |
| 2131 | P2     | src/scale-ecosystem/sla-engine/breach-detector/index.ts:17-24                            | 无 burn-rate/error-budget 追踪——仅点快照阈值                    |

### §182 Execution / Shared Infrastructure 缺陷

| #    | 严重度 | 文件                                                                   | 问题                                                                               |
| ---- | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2132 | P0     | src/platform/execution/tool-executor/command-executor.ts:368-380       | stdout/stderr 无 maxBuffer——恶意命令输出 OOM                                       |
| 2133 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:676-679      | verifyWriteAuthority 用 >=——stale leader 持当前 token 被接受,破坏 split-brain 防护 |
| 2134 | P0     | src/platform/execution/ha/wal-checkpoint-service.ts:119                | sequenceCounter 纯内存——crash 后重置为 0 产生重复 WAL 序号                         |
| 2135 | P1     | src/platform/shared/lifecycle/service-registry.ts:316-323              | 拓扑排序循环仅 warn——cycled 服务跳过 teardown 导致资源泄漏                         |
| 2136 | P1     | src/platform/execution/tool-executor/command-security.ts:259           | 脚本后所有 flag 被阻——`python script.py --output foo` 被拒                         |
| 2137 | P1     | src/platform/execution/tool-executor/command-security.ts:120           | META_SYNTAX_PATTERN 匹配 glob——`ls *.ts` 被误拒                                    |
| 2138 | P1     | src/platform/shared/lifecycle/graceful-shutdown.ts:227                 | 超时 handler 继续后台运行——Promise.race 后 zombie async                            |
| 2139 | P1     | src/platform/shared/observability/structured-logger.ts:437             | rotationScheduled per-instance 但 fileSink 全局——并发 rotation 文件损坏            |
| 2140 | P1     | src/platform/execution/ha/leader-election-service.ts:512-514           | setInterval 无 unref()——阻止进程正常退出                                           |
| 2141 | P1     | src/platform/execution/ha/leader-election-service.ts:545-547           | heartbeat setInterval 无 unref()——同上                                             |
| 2142 | P1     | src/platform/execution/ha/wal-checkpoint-service.ts:597-599            | checkpoint interval 无 unref()——同上                                               |
| 2143 | P1     | src/platform/execution/tool-executor/tool-parallel-executor.ts:406-407 | results 数组含 undefined hole——下游收到意外 undefined 元素                         |
| 2144 | P2     | src/platform/shared/lifecycle/service-registry.ts:146-149              | `if(!has){delete}` 是 no-op——条件写反                                              |
| 2145 | P2     | src/platform/execution/tool-executor/command-security.ts:92-111        | touch/mkdir 重复条目——Map last-wins 首条死代码                                     |
| 2146 | P2     | src/platform/execution/tool-executor/tool-output-sanitizer.ts:28       | CONTROL_CHARS_REGEX 漏 0x1C-0x1F——FS/GS/RS/US 未清理                               |


## Round 37 — State-Transition/Recovery · Desktop/Mobile · Routing/Escalation/Delegation · Multi-Region/Tenant

### §184 State-Transition / Recovery / Lease 缺陷

| #    | 严重度 | 文件                                                                         | 问题                                                                            |
| ---- | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2147 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts:298              | stale 阈值 `Date.now()+thresholdMs` 加法反了——所有 run 被标记为 stale           |
| 2148 | P0     | src/platform/execution/state-transition/transition-service.ts:286-288        | WorkflowTransitionService.transition() 无事务——read+write 非原子,并发丢更新     |
| 2149 | P1     | src/platform/execution/state-transition/transition-service.ts:97             | Session `paused` 状态无入边——状态图孤立节点,永不可达                            |
| 2150 | P1     | src/platform/execution/lease/execution-lease-service.ts:556-664              | validateWriteAccess 不检查 lease TTL 过期——过期 lease 仍可写                    |
| 2151 | P1     | src/platform/execution/lease/execution-lease-service-async.ts:247-289        | async releaseLeaseSync 无 active 状态守卫——可重复释放已终止 lease               |
| 2152 | P1     | src/platform/execution/recovery/runtime-recovery-decision-service.ts:162-196 | decision apply() 事务外读取——TOCTOU 基于陈旧数据做决策                          |
| 2153 | P1     | src/platform/execution/recovery/repair-pipeline.ts:88-95                     | transitionTo 无状态验证——terminal 状态可退出/任意跳转                           |
| 2154 | P1     | src/platform/execution/recovery/repair-pipeline.ts:192-222                   | handleReviewFailure 绕过 repair budget——无限修复循环                            |
| 2155 | P1     | src/platform/execution/side-effect-manager.ts:89-101                         | targetStatusForReconciliation 无 default case——unknown action→undefined 状态    |
| 2156 | P1     | src/platform/execution/recovery/replay-boundary-guard.ts:22                  | reexecution_replay 允许 real side effects——恢复重放产生重复外部变更             |
| 2157 | P2     | src/platform/execution/state-transition/transition-service.ts:763-773        | resolveExistingExecutionId 绕过 repository 用 raw SQL——非 SQLite 后端无 FK 校验 |
| 2158 | P2     | src/platform/execution/recovery/repair-pipeline.ts:233-239                   | escalate()/fail() 丢弃 reason 参数——审计不可追溯                                |
| 2159 | P2     | src/platform/execution/lease/execution-lease-service-async.ts:207            | TTL 过期用字符串比较——timezone/精度不同时错误                                   |
| 2160 | P2     | src/platform/execution/run-termination-cleanup.ts:47-48                      | 未知 resourceKind indexOf=-1 排最前——依赖序反转                                 |
| 2161 | P2     | src/platform/execution/state-transition/transition-service.ts:43-46          | self-transition 静默 no-op——掩盖幂等性 bug,terminal 状态不触发补偿              |

### §185 Desktop / Mobile 应用缺陷

| #    | 严重度 | 文件                                         | 问题                                                                                |
| ---- | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2162 | P0     | ui/apps/electron-win/src/main.ts:15-16       | IPC shell:run/shell:spawn 暴露——renderer 可执行任意 shell 命令                      |
| 2163 | P0     | ui/apps/electron-win/src/preload.ts:33-34    | bridge 直接赋 window 属性非 contextBridge.exposeInMainWorld——绕过 context isolation |
| 2164 | P0     | ui/apps/web/src/app-shell.tsx:8-22           | demoGuardContext 硬编码全管理员权限——所有路由守卫 no-op                             |
| 2165 | P0     | ui/apps/electron-win/src/main.ts:21-23       | IPC files:read/files:write 无路径白名单——任意文件读写                               |
| 2166 | P1     | ui/apps/web/src/runtime.ts:34                | API base URL fallback http://localhost:3000——非本地部署不安全                       |
| 2167 | P1     | ui/apps/web/src/runtime.ts:44-46             | wsUrl 被忽略——WS 永远用 InMemoryWSClient(死代码)                                    |
| 2168 | P1     | ui/apps/electron-win/index.html:2-10         | 无 CSP meta tag——XSS 可加载远程脚本+调用 IPC                                        |
| 2169 | P1     | ui/apps/mobile/src/App.tsx:5                 | 平台硬编码 "android"——iOS 用户获得错误 adapter                                      |
| 2170 | P1     | ui/apps/tauri-macos/src-tauri/src/lib.rs:7-8 | open_deep_link 无 scheme 验证——可打开 file:///javascript: URL                       |
| 2171 | P1     | ui/apps/tauri-macos+linux Cargo.toml         | 无 tauri-plugin-updater——无自动更新/签名验证                                        |
| 2172 | P2     | ui/apps/tauri-linux/src/index.ts:4-8         | DesktopShellManifest 缺 updateChannel                                               |
| 2173 | P2     | ui/apps/electron-win/package.json            | 无 electron 依赖/无打包签名配置                                                     |
| 2174 | P2     | ui/apps/mobile/package.json                  | 无 react-native 依赖——无法构建                                                      |
| 2175 | P2     | ui/apps/web/src/runtime.ts:39                | createAuthInterceptor 用硬编码字符串非 session token                                |
| 2176 | P2     | ui/apps/web/src/runtime.ts:55                | registerWebServiceWorker 注册不存在的 sw 文件——404                                  |

### §186 Routing / Escalation / Delegation 缺陷

| #    | 严重度 | 文件                                                                                        | 问题                                                                    |
| ---- | ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2177 | P0     | src/platform/orchestration/escalation/index.ts:23-50                                        | 无分层升级策略——spec 要求 agent→team→human→incident,实际仅 flat 条件链  |
| 2178 | P0     | src/platform/orchestration/agent-delegation/context-isolator.ts:174-175                     | parent.permissions.actions=0 时除零→Infinity→错误隔离级别               |
| 2179 | P0     | src/platform/orchestration/agent-delegation/context-isolator.ts:213-221                     | MINIMAL 隔离从 requiredPermissions 取值不与 parent 交集——子可超越父权限 |
| 2180 | P1     | src/platform/orchestration/routing/intake-router.ts:348-403                                 | 无 skill taxonomy/负载均衡——仅关键词匹配+字符长度启发                   |
| 2181 | P1     | src/platform/orchestration/routing/workflow-planner.ts:97-99,163                            | 无 DAG 环检测——循环依赖导致无限执行                                     |
| 2182 | P1     | src/platform/orchestration/routing/agent-team-service.ts:146                                | repair→validate 无限循环无退出——无 max retry/escalation 出口            |
| 2183 | P1     | src/platform/orchestration/agent-delegation/delegation-manager.service.ts:104-116           | eviction 淘汰 active delegation——"not found"错误                        |
| 2184 | P1     | src/platform/orchestration/agent-delegation/delegation-governance-service.ts:230-234        | delegationDepth 条件短路后续检查——depth+risk 组合规则永不匹配           |
| 2185 | P1     | src/platform/orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.ts:82 | depth<=maxDepth 用 parent depth——实际允许 max+1                         |
| 2186 | P1     | src/platform/orchestration/agent-delegation/delegation-governance-service.ts:191-193        | addRule 允许重复 ruleId——delete 只删首个,重复 deny 不可覆盖             |
| 2187 | P1     | src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.ts:18-29           | 自转换允许——重复记录+重置 transitionedAt 绕过 dwell-time                |
| 2188 | P1     | src/platform/orchestration/learn/knowledge-promotion-service.ts:98-110                      | 批量 promotion event 仅引用首个 object——其余丢失 lineage                |
| 2189 | P2     | src/platform/orchestration/agent-delegation/delegation-tracker.ts:281-285                   | getMetrics activeCount 恒等于 nodes 总数——completed/failed 恒0          |
| 2190 | P2     | src/platform/orchestration/learn/learning-object-validator.ts:63-67                         | validateMany 静默丢弃无效对象无审计——诊断信号丢失                       |
| 2191 | P2     | src/platform/orchestration/improve-rollout/canary-traffic-router.ts:29-34                   | hash 函数短 ID 有偏——canary_5 实际偏离目标                              |

### §187 Multi-Region / Tenant / SLA 缺陷

| #    | 严重度 | 文件                                                                    | 问题                                                          |
| ---- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2192 | P0     | src/scale-ecosystem/tenant-platform/data-plane-flow-service.ts:613      | scope null 绕过租户隔离——数据跨 tenant 泄漏到全局命名空间     |
| 2193 | P0     | src/scale-ecosystem/multi-region/region-health-check-service.ts:330-331 | latency 降级是死代码——引用等式永不匹配,高延迟地区恒 healthy   |
| 2194 | P0     | src/scale-ecosystem/multi-region/data-replicator/index.ts:112-114       | timer flush 返回值被丢弃——事件永久丢失                        |
| 2195 | P0     | src/scale-ecosystem/sla-engine/resource-allocator/index.ts:6-10         | 无 ≤100% 验证——tiers 超额分配物理不存在的容量                 |
| 2196 | P0     | src/scale-ecosystem/multi-region/cdc-replication-service.ts:277-280     | 复制队列只入不出——无界内存增长至 OOM                          |
| 2197 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:246           | checkpoint pendingCount 用 total 非 errors——复制 lag 永久虚高 |
| 2198 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:218-234       | retry 成功后 sequence 双重计数——ReplicationResult 不一致      |
| 2199 | P1     | src/scale-ecosystem/multi-region/region-health-check-service.ts:347-349 | degraded 不累积 consecutiveFailures——failover 阈值永不触发    |
| 2200 | P1     | src/scale-ecosystem/multi-region/region-health-check-service.ts:240-248 | 串行 health check——N regions O(N\*T) 延迟非 O(T)              |
| 2201 | P1     | src/platform/execution/startup/startup-consistency-checker.ts:470-474   | fail_closed 不阻止接收流量——报告但不执行                      |
| 2202 | P1     | src/scale-ecosystem/multi-region/failover-controller/index.ts:34-36     | failover 盲选 candidates[0]——无 health/latency 检查           |
| 2203 | P2     | src/scale-ecosystem/multi-region/remote-session-state.ts:14-15          | failed→connected 无过渡——掩盖未解决故障                       |
| 2204 | P2     | src/scale-ecosystem/multi-region/data-replicator/index.ts:170           | event ID Date.now()+random 非唯一保证——并发碰撞               |
## Round 37 — State-Transition/Recovery · Desktop/Mobile · Routing/Escalation/Delegation · Multi-Region/Tenant

### §184 State-Transition / Recovery / Lease 缺陷

| #    | 严重度 | 文件                                                                         | 问题                                                                            |
| ---- | ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2147 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts:298              | stale 阈值 `Date.now()+thresholdMs` 加法反了——所有 run 被标记为 stale           |
| 2148 | P0     | src/platform/execution/state-transition/transition-service.ts:286-288        | WorkflowTransitionService.transition() 无事务——read+write 非原子,并发丢更新     |
| 2149 | P1     | src/platform/execution/state-transition/transition-service.ts:97             | Session `paused` 状态无入边——状态图孤立节点,永不可达                            |
| 2150 | P1     | src/platform/execution/lease/execution-lease-service.ts:556-664              | validateWriteAccess 不检查 lease TTL 过期——过期 lease 仍可写                    |
| 2151 | P1     | src/platform/execution/lease/execution-lease-service-async.ts:247-289        | async releaseLeaseSync 无 active 状态守卫——可重复释放已终止 lease               |
| 2152 | P1     | src/platform/execution/recovery/runtime-recovery-decision-service.ts:162-196 | decision apply() 事务外读取——TOCTOU 基于陈旧数据做决策                          |
| 2153 | P1     | src/platform/execution/recovery/repair-pipeline.ts:88-95                     | transitionTo 无状态验证——terminal 状态可退出/任意跳转                           |
| 2154 | P1     | src/platform/execution/recovery/repair-pipeline.ts:192-222                   | handleReviewFailure 绕过 repair budget——无限修复循环                            |
| 2155 | P1     | src/platform/execution/side-effect-manager.ts:89-101                         | targetStatusForReconciliation 无 default case——unknown action→undefined 状态    |
| 2156 | P1     | src/platform/execution/recovery/replay-boundary-guard.ts:22                  | reexecution_replay 允许 real side effects——恢复重放产生重复外部变更             |
| 2157 | P2     | src/platform/execution/state-transition/transition-service.ts:763-773        | resolveExistingExecutionId 绕过 repository 用 raw SQL——非 SQLite 后端无 FK 校验 |
| 2158 | P2     | src/platform/execution/recovery/repair-pipeline.ts:233-239                   | escalate()/fail() 丢弃 reason 参数——审计不可追溯                                |
| 2159 | P2     | src/platform/execution/lease/execution-lease-service-async.ts:207            | TTL 过期用字符串比较——timezone/精度不同时错误                                   |
| 2160 | P2     | src/platform/execution/run-termination-cleanup.ts:47-48                      | 未知 resourceKind indexOf=-1 排最前——依赖序反转                                 |
| 2161 | P2     | src/platform/execution/state-transition/transition-service.ts:43-46          | self-transition 静默 no-op——掩盖幂等性 bug,terminal 状态不触发补偿              |

### §185 Desktop / Mobile 应用缺陷

| #    | 严重度 | 文件                                         | 问题                                                                                |
| ---- | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2162 | P0     | ui/apps/electron-win/src/main.ts:15-16       | IPC shell:run/shell:spawn 暴露——renderer 可执行任意 shell 命令                      |
| 2163 | P0     | ui/apps/electron-win/src/preload.ts:33-34    | bridge 直接赋 window 属性非 contextBridge.exposeInMainWorld——绕过 context isolation |
| 2164 | P0     | ui/apps/web/src/app-shell.tsx:8-22           | demoGuardContext 硬编码全管理员权限——所有路由守卫 no-op                             |
| 2165 | P0     | ui/apps/electron-win/src/main.ts:21-23       | IPC files:read/files:write 无路径白名单——任意文件读写                               |
| 2166 | P1     | ui/apps/web/src/runtime.ts:34                | API base URL fallback http://localhost:3000——非本地部署不安全                       |
| 2167 | P1     | ui/apps/web/src/runtime.ts:44-46             | wsUrl 被忽略——WS 永远用 InMemoryWSClient(死代码)                                    |
| 2168 | P1     | ui/apps/electron-win/index.html:2-10         | 无 CSP meta tag——XSS 可加载远程脚本+调用 IPC                                        |
| 2169 | P1     | ui/apps/mobile/src/App.tsx:5                 | 平台硬编码 "android"——iOS 用户获得错误 adapter                                      |
| 2170 | P1     | ui/apps/tauri-macos/src-tauri/src/lib.rs:7-8 | open_deep_link 无 scheme 验证——可打开 file:///javascript: URL                       |
| 2171 | P1     | ui/apps/tauri-macos+linux Cargo.toml         | 无 tauri-plugin-updater——无自动更新/签名验证                                        |
| 2172 | P2     | ui/apps/tauri-linux/src/index.ts:4-8         | DesktopShellManifest 缺 updateChannel                                               |
| 2173 | P2     | ui/apps/electron-win/package.json            | 无 electron 依赖/无打包签名配置                                                     |
| 2174 | P2     | ui/apps/mobile/package.json                  | 无 react-native 依赖——无法构建                                                      |
| 2175 | P2     | ui/apps/web/src/runtime.ts:39                | createAuthInterceptor 用硬编码字符串非 session token                                |
| 2176 | P2     | ui/apps/web/src/runtime.ts:55                | registerWebServiceWorker 注册不存在的 sw 文件——404                                  |

### §186 Routing / Escalation / Delegation 缺陷

| #    | 严重度 | 文件                                                                                        | 问题                                                                    |
| ---- | ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2177 | P0     | src/platform/orchestration/escalation/index.ts:23-50                                        | 无分层升级策略——spec 要求 agent→team→human→incident,实际仅 flat 条件链  |
| 2178 | P0     | src/platform/orchestration/agent-delegation/context-isolator.ts:174-175                     | parent.permissions.actions=0 时除零→Infinity→错误隔离级别               |
| 2179 | P0     | src/platform/orchestration/agent-delegation/context-isolator.ts:213-221                     | MINIMAL 隔离从 requiredPermissions 取值不与 parent 交集——子可超越父权限 |
| 2180 | P1     | src/platform/orchestration/routing/intake-router.ts:348-403                                 | 无 skill taxonomy/负载均衡——仅关键词匹配+字符长度启发                   |
| 2181 | P1     | src/platform/orchestration/routing/workflow-planner.ts:97-99,163                            | 无 DAG 环检测——循环依赖导致无限执行                                     |
| 2182 | P1     | src/platform/orchestration/routing/agent-team-service.ts:146                                | repair→validate 无限循环无退出——无 max retry/escalation 出口            |
| 2183 | P1     | src/platform/orchestration/agent-delegation/delegation-manager.service.ts:104-116           | eviction 淘汰 active delegation——"not found"错误                        |
| 2184 | P1     | src/platform/orchestration/agent-delegation/delegation-governance-service.ts:230-234        | delegationDepth 条件短路后续检查——depth+risk 组合规则永不匹配           |
| 2185 | P1     | src/platform/orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.ts:82 | depth<=maxDepth 用 parent depth——实际允许 max+1                         |
| 2186 | P1     | src/platform/orchestration/agent-delegation/delegation-governance-service.ts:191-193        | addRule 允许重复 ruleId——delete 只删首个,重复 deny 不可覆盖             |
| 2187 | P1     | src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.ts:18-29           | 自转换允许——重复记录+重置 transitionedAt 绕过 dwell-time                |
| 2188 | P1     | src/platform/orchestration/learn/knowledge-promotion-service.ts:98-110                      | 批量 promotion event 仅引用首个 object——其余丢失 lineage                |
| 2189 | P2     | src/platform/orchestration/agent-delegation/delegation-tracker.ts:281-285                   | getMetrics activeCount 恒等于 nodes 总数——completed/failed 恒0          |
| 2190 | P2     | src/platform/orchestration/learn/learning-object-validator.ts:63-67                         | validateMany 静默丢弃无效对象无审计——诊断信号丢失                       |
| 2191 | P2     | src/platform/orchestration/improve-rollout/canary-traffic-router.ts:29-34                   | hash 函数短 ID 有偏——canary_5 实际偏离目标                              |

### §187 Multi-Region / Tenant / SLA 缺陷

| #    | 严重度 | 文件                                                                    | 问题                                                          |
| ---- | ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| 2192 | P0     | src/scale-ecosystem/tenant-platform/data-plane-flow-service.ts:613      | scope null 绕过租户隔离——数据跨 tenant 泄漏到全局命名空间     |
| 2193 | P0     | src/scale-ecosystem/multi-region/region-health-check-service.ts:330-331 | latency 降级是死代码——引用等式永不匹配,高延迟地区恒 healthy   |
| 2194 | P0     | src/scale-ecosystem/multi-region/data-replicator/index.ts:112-114       | timer flush 返回值被丢弃——事件永久丢失                        |
| 2195 | P0     | src/scale-ecosystem/sla-engine/resource-allocator/index.ts:6-10         | 无 ≤100% 验证——tiers 超额分配物理不存在的容量                 |
| 2196 | P0     | src/scale-ecosystem/multi-region/cdc-replication-service.ts:277-280     | 复制队列只入不出——无界内存增长至 OOM                          |
| 2197 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:246           | checkpoint pendingCount 用 total 非 errors——复制 lag 永久虚高 |
| 2198 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:218-234       | retry 成功后 sequence 双重计数——ReplicationResult 不一致      |
| 2199 | P1     | src/scale-ecosystem/multi-region/region-health-check-service.ts:347-349 | degraded 不累积 consecutiveFailures——failover 阈值永不触发    |
| 2200 | P1     | src/scale-ecosystem/multi-region/region-health-check-service.ts:240-248 | 串行 health check——N regions O(N\*T) 延迟非 O(T)              |
| 2201 | P1     | src/platform/execution/startup/startup-consistency-checker.ts:470-474   | fail_closed 不阻止接收流量——报告但不执行                      |
| 2202 | P1     | src/scale-ecosystem/multi-region/failover-controller/index.ts:34-36     | failover 盲选 candidates[0]——无 health/latency 检查           |
| 2203 | P2     | src/scale-ecosystem/multi-region/remote-session-state.ts:14-15          | failed→connected 无过渡——掩盖未解决故障                       |
| 2204 | P2     | src/scale-ecosystem/multi-region/data-replicator/index.ts:170           | event ID Date.now()+random 非唯一保证——并发碰撞               |


## Round 38 — Platform Contracts/Types · UI Features · Contract Docs · Event Bus/Truth/Harness

### §189 Platform Contracts / Types 类型系统冲突

| #    | 严重度 | 文件                                                                                                                    | 问题                                                                               |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2205 | P0     | src/platform/contracts/executable-contracts/index.ts:67 vs types/domain/task-types.ts:29                                | ArtifactRef 双定义不兼容——字段集完全不同,barrel 导出 type shadowing                |
| 2206 | P0     | src/platform/contracts/execution-plan/index.ts:12 vs types/platform-contracts.ts:70                                     | ExecutionPlan 双定义——steps 类型/budget/traceId 全部冲突                           |
| 2207 | P0     | src/platform/contracts/execution-receipt/index.ts:6 vs types/platform-contracts.ts:89                                   | ExecutionReceipt 双定义——status enum 完全不同                                      |
| 2208 | P0     | src/platform/contracts/control-directive/index.ts:6 vs types/platform-contracts.ts:37                                   | ControlDirective 双定义——kind/type/issuedBy 类型/scope 全冲突                      |
| 2209 | P0     | src/platform/contracts/state-command/index.ts:6 vs types/platform-contracts.ts:106                                      | StateCommand 双定义——action/type/entityId/aggregateId 冲突,子目录版缺 fencingToken |
| 2210 | P0     | src/platform/contracts/request-envelope/index.ts:4 + types/platform-contracts.ts:12 + executable-contracts/index.ts:126 | RequestEnvelope 三重定义——三套不兼容字段集                                         |
| 2211 | P1     | src/platform/contracts/executable-contracts/index.ts:158                                                                | HarnessRun 缺 §5.5 字段:orgId/budgetEnvelope/riskProfile/auditTrail/fencingToken   |
| 2212 | P1     | src/platform/contracts/executable-contracts/index.ts:316                                                                | NodeRun 缺 §5.5 字段:sideEffects[]/compensation 未内嵌,leaseId/fencingToken 可选   |
| 2213 | P1     | src/platform/contracts/executable-contracts/index.ts:583                                                                | PlatformFactEvent 缺 source/correlationId(必填)/schemaVersion                      |
| 2214 | P1     | 整个代码库                                                                                                              | ContractEnvelope 类型完全不存在——§5.5 要求 {version,schema,payload,signature,ttl}  |
| 2215 | P1     | src/platform/contracts/executable-contracts/schemas.ts:574 vs index.ts:580                                              | replayBehavior "simulate" vs "simulate_projection" 字符串不匹配——运行时比对失败    |
| 2216 | P1     | src/platform-architecture-types.ts:1                                                                                    | 架构层类型文件零引用 §5.5 canonical types——canonical object map 无代码表示         |
| 2217 | P2     | src/platform/contracts/index.ts:8-31                                                                                    | barrel 导出 RequestEnvelope 三个别名——消费方混淆                                   |
| 2218 | P2     | src/platform/contracts/types/platform-contracts.ts:55 vs executable-contracts/index.ts:407                              | SideEffectRecord 双定义——effectId vs sideEffectId,6字段 vs 12+字段                 |

### §190 Contract 文档偏差（续）

| #    | 严重度 | 文件                                                                          | 问题                                                                                                                                                                                                                                                                         |
| ---- | ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2219 | P0     | docs_zh/contracts/ (缺失)                                                     | 14/16 spec-required contracts 不存在(distributed_consensus/data_lifecycle/execution_sandbox/evidence_chain/federation/harness_run_lifecycle/hitl/knowledge_lifecycle/prompt_management/multi_region_replication/recovery/risk_assessment/security_baseline/tenant_isolation) |
| 2220 | P0     | docs_zh/contracts/app_error_contract.md:37-38                                 | AppError 用 task_id/execution_id——无 harness_run_id/node_run_id                                                                                                                                                                                                              |
| 2221 | P0     | docs_zh/contracts/model_gateway_routing_contract.md:18                        | ModelRouteRequest.taskId 用 legacy 非 harnessRunId/nodeRunId                                                                                                                                                                                                                 |
| 2222 | P1     | docs_zh/contracts/observability_contract.md:22-29                             | LogEvent 含 task_id 无 harness_run_id/node_run_id——日志无法与 runtime truth 关联                                                                                                                                                                                             |
| 2223 | P1     | docs_zh/contracts/perception_intelligence_plane_contract.md:70-73             | ExecutionAssessment 用 execution_id+"steps"——应为 nodeRunId+NodeRun 计数                                                                                                                                                                                                     |
| 2224 | P1     | docs_zh/contracts/audit_lineage_and_retention_contract.md:72                  | audit 字段含 execution_id? 无 harness_run_id——审计记录不可链接                                                                                                                                                                                                               |
| 2225 | P1     | docs_zh/contracts/tool_skill_plugin_contract.md:60                            | SkillDefinition 用 steps——应引用 graph nodes                                                                                                                                                                                                                                 |
| 2226 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract.md:51-58         | GuidedOnboardingSession/WorkflowBuilderDraft 用 steps——应产 PlanGraph                                                                                                                                                                                                        |
| 2227 | P1     | docs_zh/contracts/knowledge_spi_contract.md:27                                | KnowledgeArchive 指定 SQLite——spec 限 MVP-only,知识平面需生产存储                                                                                                                                                                                                            |
| 2228 | P1     | docs_zh/contracts/cross_region_routing_and_data_residency_contract.md:13      | ReplicationPolicy 列为 canonical 但无字段定义                                                                                                                                                                                                                                |
| 2229 | P1     | docs_zh/contracts/prompt_engine_spi_contract.md:16-27                         | PromptDefinition 缺 tenantId——违反多租户隔离                                                                                                                                                                                                                                 |
| 2230 | P2     | docs_zh/contracts/observability_contract.md:67-72                             | legacy metric alias taskMetrics/executionMetrics 无对应维度                                                                                                                                                                                                                  |
| 2231 | P2     | docs_zh/contracts/model_gateway_routing_contract.md:19                        | ModelRouteRequest.sessionId 无生命周期 contract 定义                                                                                                                                                                                                                         |
| 2232 | P2     | docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md:37-46 | 一致性章节仅 bullet 无对象定义/failure_behavior                                                                                                                                                                                                                              |

### §191 Event Bus / Truth / Harness 缺陷

| #    | 严重度 | 文件                                                                              | 问题                                                                                    |
| ---- | ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2233 | P0     | src/platform/state-evidence/events/dlq-service.ts:155                             | scheduleRetry 无 maxRetries 上限——无限重试,无 poison-pill quarantine                    |
| 2234 | P0     | src/platform/state-evidence/truth/runtime-truth-repository.ts:196                 | storeAggregate 用 Map.set 覆写——truth 非 append-only 非不可变                           |
| 2235 | P0     | src/platform/orchestration/harness/index.ts:633-656                               | runLoop planner/generator/evaluator 全在 budget gate 前执行——spec 要求每阶段前检查      |
| 2236 | P0     | src/platform/orchestration/oapeflir/types/feedback-signal.ts:7-16                 | FeedbackSignal 缺 trustScore 和 evidenceRefs——spec 必需字段                             |
| 2237 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:534-543                   | ensurePendingAcks 为所有 consumer 创建 ack 不过滤 eventType——虚假 pending 计数          |
| 2238 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:301-306                   | deliverPendingNow 无 handler 时返回 pending.length 作为"已投递"——误导指标               |
| 2239 | P1     | src/platform/state-evidence/events/projections/workflow-run-projection.ts:322     | subtask:failed 立即设 workflow=failed——无重试/fallback 路径                             |
| 2240 | P1     | src/platform/state-evidence/events/projections/ (all 9)                           | processedEventIds 用 Array.includes() O(n) 去重——100K 事件重建 O(n²)                    |
| 2241 | P1     | src/platform/orchestration/oapeflir/assessment-service.ts:66                      | routingDecision.division 硬编码 "coding"——非编码任务全部误路由                          |
| 2242 | P1     | src/platform/state-evidence/events/layered-event-inbox.ts:21                      | records 数组只增不减无压缩——内存泄漏                                                    |
| 2243 | P2     | src/platform/orchestration/harness/index.ts:505-506                               | non-accept decision 的 feedbackEnvelope 仅 assertInvariants 检查——appendStep 路径可绕过 |
| 2244 | P2     | src/platform/state-evidence/events/projections/artifact-catalog-projection.ts:283 | artifact:updated 版本自增——乱序重放产生确定性但语义无意义的 version                     |
| 2245 | P2     | src/platform/orchestration/harness/index.ts:508-523                               | hasOpenExecutionBlockers 仅 terminal run 检查——活跃 run 的 blocked-tool 不触发          |
| 2246 | P2     | src/platform/orchestration/harness/evaluation/eval-run-service.ts:23              | actualEvidenceRefs 混入 reasonCodes——与 requiredEvidence 比对产生误匹配                 |
| 2247 | P2     | src/platform/state-evidence/events/projections/governance-projection.ts:203-204   | mapEventToActionType fallback 将含"decision"事件映射为 approval_granted——语义错误       |
## Round 38 — Platform Contracts/Types · UI Features · Contract Docs · Event Bus/Truth/Harness

### §189 Platform Contracts / Types 类型系统冲突

| #    | 严重度 | 文件                                                                                                                    | 问题                                                                               |
| ---- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2205 | P0     | src/platform/contracts/executable-contracts/index.ts:67 vs types/domain/task-types.ts:29                                | ArtifactRef 双定义不兼容——字段集完全不同,barrel 导出 type shadowing                |
| 2206 | P0     | src/platform/contracts/execution-plan/index.ts:12 vs types/platform-contracts.ts:70                                     | ExecutionPlan 双定义——steps 类型/budget/traceId 全部冲突                           |
| 2207 | P0     | src/platform/contracts/execution-receipt/index.ts:6 vs types/platform-contracts.ts:89                                   | ExecutionReceipt 双定义——status enum 完全不同                                      |
| 2208 | P0     | src/platform/contracts/control-directive/index.ts:6 vs types/platform-contracts.ts:37                                   | ControlDirective 双定义——kind/type/issuedBy 类型/scope 全冲突                      |
| 2209 | P0     | src/platform/contracts/state-command/index.ts:6 vs types/platform-contracts.ts:106                                      | StateCommand 双定义——action/type/entityId/aggregateId 冲突,子目录版缺 fencingToken |
| 2210 | P0     | src/platform/contracts/request-envelope/index.ts:4 + types/platform-contracts.ts:12 + executable-contracts/index.ts:126 | RequestEnvelope 三重定义——三套不兼容字段集                                         |
| 2211 | P1     | src/platform/contracts/executable-contracts/index.ts:158                                                                | HarnessRun 缺 §5.5 字段:orgId/budgetEnvelope/riskProfile/auditTrail/fencingToken   |
| 2212 | P1     | src/platform/contracts/executable-contracts/index.ts:316                                                                | NodeRun 缺 §5.5 字段:sideEffects[]/compensation 未内嵌,leaseId/fencingToken 可选   |
| 2213 | P1     | src/platform/contracts/executable-contracts/index.ts:583                                                                | PlatformFactEvent 缺 source/correlationId(必填)/schemaVersion                      |
| 2214 | P1     | 整个代码库                                                                                                              | ContractEnvelope 类型完全不存在——§5.5 要求 {version,schema,payload,signature,ttl}  |
| 2215 | P1     | src/platform/contracts/executable-contracts/schemas.ts:574 vs index.ts:580                                              | replayBehavior "simulate" vs "simulate_projection" 字符串不匹配——运行时比对失败    |
| 2216 | P1     | src/platform-architecture-types.ts:1                                                                                    | 架构层类型文件零引用 §5.5 canonical types——canonical object map 无代码表示         |
| 2217 | P2     | src/platform/contracts/index.ts:8-31                                                                                    | barrel 导出 RequestEnvelope 三个别名——消费方混淆                                   |
| 2218 | P2     | src/platform/contracts/types/platform-contracts.ts:55 vs executable-contracts/index.ts:407                              | SideEffectRecord 双定义——effectId vs sideEffectId,6字段 vs 12+字段                 |

### §190 Contract 文档偏差（续）

| #    | 严重度 | 文件                                                                          | 问题                                                                                                                                                                                                                                                                         |
| ---- | ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2219 | P0     | docs_zh/contracts/ (缺失)                                                     | 14/16 spec-required contracts 不存在(distributed_consensus/data_lifecycle/execution_sandbox/evidence_chain/federation/harness_run_lifecycle/hitl/knowledge_lifecycle/prompt_management/multi_region_replication/recovery/risk_assessment/security_baseline/tenant_isolation) |
| 2220 | P0     | docs_zh/contracts/app_error_contract.md:37-38                                 | AppError 用 task_id/execution_id——无 harness_run_id/node_run_id                                                                                                                                                                                                              |
| 2221 | P0     | docs_zh/contracts/model_gateway_routing_contract.md:18                        | ModelRouteRequest.taskId 用 legacy 非 harnessRunId/nodeRunId                                                                                                                                                                                                                 |
| 2222 | P1     | docs_zh/contracts/observability_contract.md:22-29                             | LogEvent 含 task_id 无 harness_run_id/node_run_id——日志无法与 runtime truth 关联                                                                                                                                                                                             |
| 2223 | P1     | docs_zh/contracts/perception_intelligence_plane_contract.md:70-73             | ExecutionAssessment 用 execution_id+"steps"——应为 nodeRunId+NodeRun 计数                                                                                                                                                                                                     |
| 2224 | P1     | docs_zh/contracts/audit_lineage_and_retention_contract.md:72                  | audit 字段含 execution_id? 无 harness_run_id——审计记录不可链接                                                                                                                                                                                                               |
| 2225 | P1     | docs_zh/contracts/tool_skill_plugin_contract.md:60                            | SkillDefinition 用 steps——应引用 graph nodes                                                                                                                                                                                                                                 |
| 2226 | P1     | docs_zh/contracts/dashboard_and_operator_experience_contract.md:51-58         | GuidedOnboardingSession/WorkflowBuilderDraft 用 steps——应产 PlanGraph                                                                                                                                                                                                        |
| 2227 | P1     | docs_zh/contracts/knowledge_spi_contract.md:27                                | KnowledgeArchive 指定 SQLite——spec 限 MVP-only,知识平面需生产存储                                                                                                                                                                                                            |
| 2228 | P1     | docs_zh/contracts/cross_region_routing_and_data_residency_contract.md:13      | ReplicationPolicy 列为 canonical 但无字段定义                                                                                                                                                                                                                                |
| 2229 | P1     | docs_zh/contracts/prompt_engine_spi_contract.md:16-27                         | PromptDefinition 缺 tenantId——违反多租户隔离                                                                                                                                                                                                                                 |
| 2230 | P2     | docs_zh/contracts/observability_contract.md:67-72                             | legacy metric alias taskMetrics/executionMetrics 无对应维度                                                                                                                                                                                                                  |
| 2231 | P2     | docs_zh/contracts/model_gateway_routing_contract.md:19                        | ModelRouteRequest.sessionId 无生命周期 contract 定义                                                                                                                                                                                                                         |
| 2232 | P2     | docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md:37-46 | 一致性章节仅 bullet 无对象定义/failure_behavior                                                                                                                                                                                                                              |

### §191 Event Bus / Truth / Harness 缺陷

| #    | 严重度 | 文件                                                                              | 问题                                                                                    |
| ---- | ------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2233 | P0     | src/platform/state-evidence/events/dlq-service.ts:155                             | scheduleRetry 无 maxRetries 上限——无限重试,无 poison-pill quarantine                    |
| 2234 | P0     | src/platform/state-evidence/truth/runtime-truth-repository.ts:196                 | storeAggregate 用 Map.set 覆写——truth 非 append-only 非不可变                           |
| 2235 | P0     | src/platform/orchestration/harness/index.ts:633-656                               | runLoop planner/generator/evaluator 全在 budget gate 前执行——spec 要求每阶段前检查      |
| 2236 | P0     | src/platform/orchestration/oapeflir/types/feedback-signal.ts:7-16                 | FeedbackSignal 缺 trustScore 和 evidenceRefs——spec 必需字段                             |
| 2237 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:534-543                   | ensurePendingAcks 为所有 consumer 创建 ack 不过滤 eventType——虚假 pending 计数          |
| 2238 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:301-306                   | deliverPendingNow 无 handler 时返回 pending.length 作为"已投递"——误导指标               |
| 2239 | P1     | src/platform/state-evidence/events/projections/workflow-run-projection.ts:322     | subtask:failed 立即设 workflow=failed——无重试/fallback 路径                             |
| 2240 | P1     | src/platform/state-evidence/events/projections/ (all 9)                           | processedEventIds 用 Array.includes() O(n) 去重——100K 事件重建 O(n²)                    |
| 2241 | P1     | src/platform/orchestration/oapeflir/assessment-service.ts:66                      | routingDecision.division 硬编码 "coding"——非编码任务全部误路由                          |
| 2242 | P1     | src/platform/state-evidence/events/layered-event-inbox.ts:21                      | records 数组只增不减无压缩——内存泄漏                                                    |
| 2243 | P2     | src/platform/orchestration/harness/index.ts:505-506                               | non-accept decision 的 feedbackEnvelope 仅 assertInvariants 检查——appendStep 路径可绕过 |
| 2244 | P2     | src/platform/state-evidence/events/projections/artifact-catalog-projection.ts:283 | artifact:updated 版本自增——乱序重放产生确定性但语义无意义的 version                     |
| 2245 | P2     | src/platform/orchestration/harness/index.ts:508-523                               | hasOpenExecutionBlockers 仅 terminal run 检查——活跃 run 的 blocked-tool 不触发          |
| 2246 | P2     | src/platform/orchestration/harness/evaluation/eval-run-service.ts:23              | actualEvidenceRefs 混入 reasonCodes——与 requiredEvidence 比对产生误匹配                 |
| 2247 | P2     | src/platform/state-evidence/events/projections/governance-projection.ts:203-204   | mapEventToActionType fallback 将含"decision"事件映射为 approval_granted——语义错误       |


## Round 39 — IAM/SSO · UI Features · CLI/SDK · Cross-Cutting Architecture

### §193 IAM / SSO 深层缺陷

| #    | 严重度 | 文件                                                                  | 问题                                                                                  |
| ---- | ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2248 | P0     | src/org-governance/sso-scim/saml/index.ts:226                         | consumeAssertion 不传 IdP 公钥——xml-crypto 用 XML 内嵌 key,攻击者自签伪造断言         |
| 2249 | P0     | src/platform/control-plane/iam/access-model.ts:183                    | resolvePrincipalAccessProfile 用 input.capabilities 替换非交集——viewer 可声称任意能力 |
| 2250 | P0     | src/platform/control-plane/iam/access-model.ts:259-268                | manualTakeoverActive=true 时无条件 allowed:true——任何调用方注入此标志绕过全部检查     |
| 2251 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237-252              | fetchUserInfo 任何错误 fallback mock admin——allowMockFallback=false 时仍执行          |
| 2252 | P1     | src/platform/control-plane/iam/field-encryption.ts:14-15              | normalizeKey 单次 SHA-256 无 salt/stretching——1字符密码即有效 key                     |
| 2253 | P1     | src/platform/control-plane/iam/secret-management-service.ts:168-196   | requireSecret 返回明文无审计记录——绕过审计                                            |
| 2254 | P1     | src/org-governance/sso-scim/oidc/oidc-service.ts:261-276              | token 比较用 === 非 timingSafeEqual——timing side-channel                              |
| 2255 | P1     | src/org-governance/sso-scim/oidc/oidc-service.ts:302-307              | createSession 无并发 session 上限——无界增长                                           |
| 2256 | P1     | src/org-governance/sso-scim/oidc/oidc-service.ts:404-409              | touchSession 不延 expiresAt——无滑动窗口过期                                           |
| 2257 | P1     | src/platform/control-plane/iam/policy-engine.ts:246-263               | full-auto 绕过所有 risk escalation——高风险操作无审批                                  |
| 2258 | P1     | src/platform/control-plane/iam/vault-http-secret-provider.ts:173-174  | vault token 硬编码 1h 假设 TTL——实际 TTL 短时静默失败                                 |
| 2259 | P2     | src/platform/control-plane/iam/data-classification-service.ts:719-720 | 用户定义 regex 无 ReDoS 防护                                                          |
| 2260 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:792             | applyFilter 丢弃字段名——所有过滤落 userName                                           |
| 2261 | P2     | src/platform/control-plane/iam/audit-integrity-repository.ts:63-78    | chainPosition 无唯一性/顺序验证——完整性链可损坏                                       |
| 2262 | P2     | src/org-governance/sso-scim/group-role-mapping-service.ts:9-11        | register 无 authz/roleId 验证——任何调用方映射 admin 角色                              |

### §194 UI Features 深层缺陷

| #    | 严重度 | 文件                                                          | 问题                                                                      |
| ---- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2263 | P0     | ui/packages/features/hitl/src/hooks/index.ts:5-13             | HITL 仅 3 静态文本项——spec 5 能力(approve/reject/edit/escalate/defer)全缺 |
| 2264 | P0     | ui/packages/features/takeover/src/hooks/index.ts:5-13         | takeover 无状态保持机制——无执行快照/上下文传递/所有权转移                 |
| 2265 | P0     | ui/packages/features/domain-wizard/src/web/index.tsx          | 无多步向导/草稿持久化/后退导航——仅 3 按钮平面面板                         |
| 2266 | P0     | ui/packages/features/governance-compliance/src/hooks/index.ts | 缺策略编辑器/审批队列/审计轨迹——仅 3 静态描述字符串                       |
| 2267 | P1     | ui/packages/features/analytics/src/web/index.tsx              | 无时序图表/导出/自定义日期——trend 映射为整数非时间数据                    |
| 2268 | P1     | ui/packages/features/task-cockpit/src/hooks/index.ts          | 无实时监控——无 polling/WS/refetchInterval                                 |
| 2269 | P1     | ui/packages/features/settings/src/hooks/index.ts:105-107      | save() 同步设 saving→saved——React batch 使 saving 不可见                  |
| 2270 | P1     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:41   | selectedId 不同步 fallback——高亮与详情面板不一致                          |
| 2271 | P1     | ui/packages/features/task-cockpit/src/hooks/index.ts:40       | 同上 ghost selection bug                                                  |
| 2272 | P1     | ui/packages/features/conversation/src/hooks/index.ts:42-45    | sendPrompt 每次强制 requestClarification——无法直接执行                    |
| 2273 | P1     | ui/packages/features/workflow-cockpit/src/web/index.tsx:45-48 | 破坏性操作(release/pause)无确认对话框                                     |
| 2274 | P2     | ui/packages/features/task-cockpit/src/web/index.tsx:48-53     | operator/escalation target 无输入验证——注入无效状态值                     |
| 2275 | P2     | ui/packages/features/settings/src/hooks/index.ts:108-114      | activityItems 无界增长(同 workflow-cockpit/task-cockpit)                  |
| 2276 | P2     | ui/packages/features/conversation/src/hooks/index.ts:19       | ConversationClient remount 丢失全部历史——无持久化                         |
| 2277 | P2     | ui/packages/features/settings/src/hooks/index.ts:46-47        | useEffect deps 不含全部同步字段——部分偏好变更不触发                       |

### §195 CLI / SDK 缺陷

| #    | 严重度 | 文件                                        | 问题                                                           |
| ---- | ------ | ------------------------------------------- | -------------------------------------------------------------- |
| 2278 | P0     | src/sdk/cli/migrate-sqlite-to-pg.ts:68      | 表名+列名直接拼入 SQL——二阶注入(attacker-controlled SQLite DB) |
| 2279 | P0     | src/sdk/cli/migrate-sqlite-to-pg.ts:123-128 | PG DSN(含密码)输出到 stdout——凭证泄漏                          |
| 2280 | P0     | src/sdk/cli/api-server.ts:160-168           | AA_API_KEYS/JWT_SECRET 空时认证完全禁用——全端点无保护          |
| 2281 | P1     | src/sdk/cli/api-server.ts:198               | webhookSecret 无最低熵检查——空/弱 secret 允许伪造              |
| 2282 | P1     | src/sdk/cli/dlq-manager.ts:131-149          | retryDeadLetters 重置 ALL 死信为 waiting——无限制无确认         |
| 2283 | P1     | src/sdk/cli/dlq-manager.ts:152-165          | purgeDeadLetters 硬删除无审计/归档——不可恢复                   |
| 2284 | P1     | src/sdk/harness-sdk/index.ts:1-126          | 无 deterministic replay 方法——spec 要求                        |
| 2285 | P1     | src/sdk/admin-sdk/index.ts:6-31             | 无 bulk 操作/事务语义——spec 要求                               |
| 2286 | P1     | src/sdk/cli/index.ts:1-82                   | 无 PKCE OAuth login 命令——CLI 仅用 env bearer token            |
| 2287 | P1     | src/sdk/cli/billing.ts:56-64                | Stripe secret key 明文内存无 redaction wrapper                 |
| 2288 | P2     | src/sdk/cli/migrate-sqlite-to-pg.ts:79-117  | 跨表无单事务——中途崩溃破坏引用完整性                           |
| 2289 | P2     | src/sdk/cli/shadow-snapshot.ts:34-44        | sandbox policy 限 workspaceRoot 但写 shadowRoot——超出策略范围  |
| 2290 | P2     | src/sdk/cli/data-plane.ts:38-46             | ArtifactStore 无 sandboxPolicy——无约束文件写                   |
| 2291 | P2     | src/sdk/client-sdk/api-client.ts:258-265    | cursor JSON.parse 无 schema 验证——注入任意属性                 |

### §196 Cross-Cutting 架构级缺陷

| #    | 严重度 | 文件                                                                 | 问题                                                                     |
| ---- | ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | --- |
| 2292 | P0     | src/platform/interface/api/http-server/task-routes.ts:196-229        | POST /v1/tasks 无 idempotencyKey——重试创建重复任务                       |
| 2293 | P0     | src/platform/interface/api/http-server/request-helpers.ts:17-28      | matchRoute 仅允许 GET/POST/OPTIONS——PATCH/DELETE 路由不可达              |
| 2294 | P0     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:86-116  | 核心编排 hard-instantiate 12+ 服务无 DI——不可测/不可替换/不可断路        |
| 2295 | P1     | src/platform/interface/api/http-server/ (全部路由)                   | 无 correlationId 从 HTTP header 传播——下游事件/RSM/span 无法关联         |
| 2296 | P1     | src/platform/interface/api/http-server/task-routes.ts:207-226        | 任务创建直写 store 绕过 RSM——不产生 PlatformFactEvent 违反 INV-STATE-001 |
| 2297 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:48           | 10ms poll 无 backpressure/max_queue_depth——无流控                        |
| 2298 | P1     | src/platform/interface/api/http-server/response-hardening.ts:105     | API 版本仅静态 /v1/ 路径——无版本协商/弃用 header/content-type 版本       |
| 2299 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:398-402 | 错误丢失阶段/任务/span 上下文——调试困难                                  |
| 2300 | P2     | task-routes.ts + durable-event-bus.ts                                | 任务写入与事件发布在分离事务——crash 间产生孤立任务                       |
| 2301 | P2     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:144-165 | 边界验证失败静默降级无 incident/metric——掩盖系统性漂移                   |
| 2302 | P2     | src/platform/shared/lifecycle/service-registry.ts:66-67              | ServiceRegistry 全局单例——多租户/多 worker 共享无隔离                    |
| 2303 | P2     | src/platform/execution/runtime-state-machine.ts:150-189              | RSM 创建 event 但不持久化——调用方可忘记写入                              |     |


## Round 40 — Domains · Testing · Prompt-Engine/Proactive · HTTP Routes

### §198 Domains (Quant-Trading / Legal / Registry) 缺陷

| #    | 严重度 | 文件                                                             | 问题                                                                        |
| ---- | ------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2304 | P0     | src/domains/quant-trading/index.ts:7                             | 无领域特定风险因子(loss-limit/position-size/market-hours)——金融操作无安全门 |
| 2305 | P0     | src/domains/legal/index.ts:7                                     | 无合规检查(jurisdiction/privilege/confidentiality)——违反知识边界门要求      |
| 2306 | P0     | src/domains/quant-trading+legal/index.ts                         | 无 PlanGraphBundle——域 workflow 无 DAG 结构(spec 要求)                      |
| 2307 | P0     | src/domains/recipes/recipe-executor.ts:34                        | workflow 可用性检查仅 regex——非"nonexistent"开头的任意 ID 报告成功但不执行  |
| 2308 | P1     | src/domains/registry/plugin-ecosystem-runtime-service.ts:108-134 | buildPlan 调用两次——首次结果丢弃,两次间状态可变                             |
| 2309 | P1     | src/domains/registry/plugin-ecosystem-runtime-service.ts:96      | ready 检查忽略 degraded/registered/loaded 插件——不可用插件被视为就绪        |
| 2310 | P1     | src/domains/registry/domain-smoke-test.ts:56-64                  | 跨 workflow step 名碰撞——依赖图被覆写,环检测错误                            |
| 2311 | P1     | src/domains/registry/domain-smoke-test.ts:80-81                  | 悬空依赖 continue 跳过——断裂 workflow 通过检查                              |
| 2312 | P1     | src/domains/registry/domain-model.ts:87-91                       | bindingRole preprocess 非法值返回 undefined 非拒绝——掩盖类型错误            |
| 2313 | P1     | src/domains/recipes/recipe-registry.ts:37-39                     | trigger phrase 子串首匹配——短词("trade")遮蔽长词("trade options")           |
| 2314 | P1     | src/domains/registry/domain-registry-service.ts:41-43            | validated→registered 自动提升无事件——审计断裂                               |
| 2315 | P2     | src/domains/registry/plugin-runtime-child.ts:89-92               | sandbox root 从 env 取无路径遍历检查                                        |
| 2316 | P2     | src/domains/recipes/index.ts:22                                  | name 可选——注册无名 recipe 不可调试                                         |
| 2317 | P2     | src/domains/registry/domain-registry-service.ts:106-111          | deprecate 无状态守卫——draft/archived 均可 deprecate                         |
| 2318 | P2     | src/domains/registry/plugin-spi-registry.ts:646                  | failure threshold off-by-one: >maxFail 非 >=——第4次才禁用                   |

### §199 Testing 基础设施缺陷

| #    | 严重度 | 文件                                                                                     | 问题                                                         |
| ---- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2319 | P0     | tests/unit/platform/workspace/sandbox-policy-security.test.ts:171                        | 断言 `allowed===true\|\|false` 恒真——命令注入测试永不失败    |
| 2320 | P0     | tests/integration/core/runtime/distributed-lock-service.test.ts:21                       | `keys.length>=0` 恒真——分布式锁集成测试验证零行为            |
| 2321 | P0     | tests/unit/platform/stability/stable-concurrency-rehearsal.test.ts:75                    | failedScenarios>0 时跳过断言——失败时测试仍通过               |
| 2322 | P0     | tests/golden/config-file-generation.test.ts:38                                           | catch{assert.ok(true)} 吞掉所有失败——3个 golden 测试是 no-op |
| 2323 | P1     | tests/unit/platform/stability/stable-chaos-smoke.test.ts:88                              | 仅断言 typeof fn==="function"——从不调用被测函数              |
| 2324 | P1     | tests/unit/platform/stability/stable-evidence-campaign.test.ts:15-98                     | 测试自己的字面量——零生产代码执行                             |
| 2325 | P1     | tests/unit/platform/stability/stable-chaos-smoke.test.ts:7-86                            | 共享 /tmp 无隔离——并行运行互相污染                           |
| 2326 | P1     | tests/integration/security/input-validation.test.ts:408-436                              | 测试输入无控制字符——验证错误行为(合法命令被阻止)             |
| 2327 | P1     | tests/unit/platform/stability/stable-concurrency-rehearsal.comprehensive.test.ts:179-231 | 类型 shape 自我断言——无生产代码覆盖                          |
| 2328 | P1     | tests/e2e/distributed-lock-e2e.test.ts:270-327                                           | "并发"测试顺序执行——无 Promise.all/无 worker/无竞态          |
| 2329 | P2     | tests/integration/security/path-traversal.test.ts:81-110                                 | 编码遍历测试先解码再传入——从未测试编码绕过                   |
| 2330 | P2     | tests/integration/security/command-injection.test.ts:450-478                             | if(blocked){fail}——unknown status 静默通过                   |
| 2331 | P2     | tests/integration/security/input-validation.test.ts:497-524                              | 断言 includes 3 个值覆盖全部结果——恒通过                     |
| 2332 | P2     | tests/unit/platform/stability/stable-concurrency-rehearsal.test.ts:8-66                  | 每个场景测试跑全套——4x 冗余                                  |
| 2333 | P2     | tests/integration/security/input-validation.test.ts:439-466                              | ok(succeeded\|\|blocked)——双值覆盖无信号                     |

### §200 Prompt-Engine / Proactive-Agent 深层缺陷

| #    | 严重度 | 文件                                                                         | 问题                                                              |
| ---- | ------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 2334 | P0     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:25-29             | nextStage("stable")→"rolled_back"——语义错误                       |
| 2335 | P0     | src/interaction/proactive-agent/trigger-engine/index.ts:6-7                  | critical risk+!requireConfirmation→silent_record——违反自治边界    |
| 2336 | P0     | src/platform/prompt-engine/rollout/index.ts:6                                | PromptRolloutMode 无 "canary"——mode 与 stage 断连                 |
| 2337 | P0     | src/platform/prompt-engine/rollout/index.ts:65-76                            | activateRollout ready→active 无 dwell-time——跳过所有渐进阶段      |
| 2338 | P1     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:261-268 | traffic slot 权重不归一——高于 total 的 slot 永不匹配              |
| 2339 | P1     | src/platform/prompt-engine/registry/hierarchical-registry-service.ts:388-409 | findBundle 忽略 version 参数——deprecate 错误 bundle               |
| 2340 | P1     | src/platform/prompt-engine/eval/cross-provider-judge-service.ts:200          | agreementScore=promoteCount/total——全票 rollback 得 0             |
| 2341 | P1     | src/platform/prompt-engine/eval/cross-provider-judge-service.ts:21-22        | parallelEvaluation 声明未使用——judges 恒串行                      |
| 2342 | P1     | src/platform/prompt-engine/eval/eval-dataset-judge-service.ts:490            | criterion scores 无 [0,1] range 验证——999/-5 腐败加权             |
| 2343 | P1     | src/platform/prompt-engine/eval/eval-dataset-judge-service.ts:263-393        | 无 hold-out set 分割——全数据集训练+评估,违反统计严格性            |
| 2344 | P1     | src/interaction/proactive-agent/index.ts:270-271                             | Math.max(0.6,...) 硬编码覆盖配置——proactive budget 强制≤40%       |
| 2345 | P1     | src/interaction/proactive-agent/index.ts:392-430                             | detectFeedbackLoop 禁用整个祖先链非仅循环成员                     |
| 2346 | P2     | src/platform/prompt-engine/registry/prompt-version-manager.ts:89-105         | compareVersions 返回任意整数非 -1/0/1——严格比较调用方 break       |
| 2347 | P2     | src/interaction/proactive-agent/index.ts:316-322 vs trigger-engine           | 重复 action-mode 逻辑——行为不一致                                 |
| 2348 | P2     | src/interaction/proactive-agent/index.ts:358-360                             | input.event 可 undefined 但 .name 无 optional chaining——TypeError |

### §201 HTTP Routes / Interface 深层缺陷

| #    | 严重度 | 文件                                                                           | 问题                                                                |
| ---- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 2349 | P0     | src/platform/interface/api/http-server/incident-routes.ts:88                   | GET incident 无 tenant 隔离——void principal 后跨租户读              |
| 2350 | P0     | src/platform/interface/api/http-server/incident-routes.ts:129                  | PATCH incident 无 tenant 隔离——跨租户修改                           |
| 2351 | P0     | src/platform/interface/api/http-server/incident-routes.ts:66-67                | list incidents void tenantId——返回全租户数据                        |
| 2352 | P0     | src/platform/interface/api/http-server/websocket-bridge.ts:99                  | JWT token 在 URL query——泄漏至日志/代理/Referer                     |
| 2353 | P1     | src/platform/interface/api/http-server/incident-routes.ts:86                   | incidentId 无格式验证——任意字符串传入                               |
| 2354 | P1     | src/platform/interface/api/middleware/sanitize.ts:22-39                        | JSON sanitize 无递归深度限制——10k 嵌套 stack overflow DoS           |
| 2355 | P1     | src/platform/interface/api/http-server/websocket-bridge.ts:134                 | WS 无消息大小限制——GB 级 frame OOM DoS                              |
| 2356 | P1     | src/platform/interface/api/http-server/billing-routes.ts:36-71                 | 无版本前缀 shadow route /billing/webhooks/reconcile——未文档化攻击面 |
| 2357 | P1     | src/platform/interface/api/http-server/gateway-routes.ts:129-142               | webhookSecret=null 时签名验证静默跳过——无告警                       |
| 2358 | P1     | src/platform/interface/api/http-server/incident-routes.ts:136-143              | PATCH 仅含 owner 时 throw "transition to undefined"——逻辑 bug       |
| 2359 | P2     | src/platform/interface/api/http-server/gateway-routes.ts:101                   | POST send 返回 200 非 201——语义错误                                 |
| 2360 | P2     | src/platform/interface/api/http-server/gateway-routes.ts:93-108                | POST send 无 idempotency-key                                        |
| 2361 | P2     | src/platform/interface/api/http-server/stream-bridge.ts:182-184                | sequence/replay/dropped maps 无界增长——慢泄漏                       |
| 2362 | P2     | src/platform/interface/api/http-server/incident-routes.ts:99                   | POST /v1/incidents 无 idempotency-key                               |
| 2363 | P2     | src/platform/interface/channel-gateway/channel-gateway-delivery-service.ts:287 | generateNonce slice(0,32) 熵减半(128-bit 非 256-bit)                |


## Round 41 — 深度补充审计（ops-maturity / scale-ecosystem / SDK / plugins / config / UI-shared / bootstrap）

### §203 Ops-Maturity 深层缺陷（workflow-debugger / drift-detection / explainability / SLA）

| #    | 严重度 | 文件                                                                | 问题                                                                            |
| ---- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2364 | P0     | src/ops-maturity/drift-detection/benchmark-runner.ts:118            | Math.random() 模拟基准结果——晋升决策不确定，违反规范确定性证据驱动评估          |
| 2365 | P0     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:91  | 重放执行无 ReplaySandboxPolicy 守卫——违反 INV-REPLAY-001 重放不得产生真实副作用 |
| 2366 | P0     | src/scale-ecosystem/integration/connector-framework-service.ts:107  | execute() 未经 SideEffectManager 记录——违反 INV-SIDEEFFECT-001                  |
| 2367 | P0     | src/platform/shared/observability/slo-alerting-service.ts:240       | 通知 fetch 发送前即返回 delivered:true——投递失败静默吞没                        |
| 2368 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts:28           | workflowId/stepId 使用废弃术语——应为 PlanGraph/NodeRun/NodeAttempt              |
| 2369 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:18  | DebugSnapshot 使用 executionId/stepId——与§5.5 canonical 对象模型不一致          |
| 2370 | P1     | src/ops-maturity/drift-detection/evidence-store.ts:46               | InMemoryEvidenceStore.records 无上界——持续 append OOM                           |
| 2371 | P1     | src/scale-ecosystem/sla-engine/resource-allocator/index.ts:6        | allocateReservedCapacity 未校验 reservedPercent ≤100%——可超额分配               |
| 2372 | P1     | src/platform/shared/lifecycle/service-registry.ts:146               | if(!has){delete}——死代码无效果                                                  |
| 2373 | P1     | src/ops-maturity/explainability/explanation-pipeline-service.ts:80  | L3 depth ttlHours:0 但无 TTL 驱逐——条目永驻内存                                 |
| 2374 | P1     | src/platform/shared/observability/slo-alerting-service.ts:620       | acknowledgeAlert 直接 mutate readonly 语义对象                                  |
| 2375 | P1     | src/ops-maturity/drift-detection/rollout-manager.ts:43              | rollouts Map 无容量限制——已完成 rollout 无清理                                  |
| 2376 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:62            | 自增 counter 生成 ID——重启后冲突                                                |
| 2377 | P1     | src/ops-maturity/drift-detection/proposal-engine.ts:100             | 同上 prop\_${++counter}——重启后 ID 冲突                                         |
| 2378 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts:103          | durationMs = now - traceStart——测量的是总经过时间非单事件时长                   |
| 2379 | P1     | src/platform/shared/observability/slo-alerting-service.ts:738       | executeRunbook() 恒标 completed——无实际执行逻辑                                 |
| 2380 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:94            | new Date() 替代平台 nowIso()——测试不确定                                        |
| 2381 | P1     | src/ops-maturity/drift-detection/proposal-engine.ts:93              | 同上 new Date() 替代 nowIso()                                                   |
| 2382 | P1     | src/scale-ecosystem/integration/connector-framework-service.ts:107  | execute() 返回模拟结果非实际调用——connector 功能未实现                          |
| 2383 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:124 | breakpoints 赋值可变数组至 readonly 字段——绕过只读约束                          |

### §204 SDK / Plugins / Config / Divisions 缺陷

| #    | 严重度 | 文件                                                | 问题                                                                               |
| ---- | ------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2384 | P0     | config/security/default.json:7                      | allowedCapabilities 含 "mcp" 但 PluginSandboxPolicy 无此能力类型——违反默认安全收敛 |
| 2385 | P0     | src/plugins/adapters/crm-adapter.ts:52              | token 明文前 8 字符存入 fingerprint——泄露敏感凭据片段                              |
| 2386 | P1     | src/sdk/admin-sdk/index.ts:6                        | 缺 resumeHarnessRun/listWorkers/getConfig 等 Admin API——运维脚本化能力不足         |
| 2387 | P1     | src/sdk/admin-sdk/index.ts:1                        | 未发送 X-Platform-Version/X-SDK-Version 请求头——违反 SDK 兼容性契约                |
| 2388 | P1     | src/sdk/harness-sdk/index.ts:34                     | appendStep 用 stage 字段映射 nodeRunId——应为 NodeRun/NodeAttempt                   |
| 2389 | P1     | src/sdk/harness-sdk/index.ts:27                     | 缺 reserveBudget/settleBudget——违反 INV-BUDGET-001 先预留再执行                    |
| 2390 | P1     | config/runtime/default.json:4                       | defaultStepTimeoutMs 使用废弃 step 术语——应为 defaultNodeRunTimeoutMs              |
| 2391 | P1     | config/risk/default.json:2                          | $schema 引用 .ts 文件——非合法 JSON Schema                                          |
| 2392 | P1     | src/plugins/validators/basic-evaluator.ts:14        | initialize/shutdown 空实现——跳过 PluginLifecycleHooks 完整生命周期                 |
| 2393 | P1     | src/plugins/adapters/game-dev-adapter.ts:26         | authenticate() 空实现——接受任意凭据                                                |
| 2394 | P1     | src/plugins/builtin-plugin-registry.ts:21           | 无插件生命周期状态跟踪(registered→loaded→active→inactive→unloaded)                 |
| 2395 | P1     | src/plugins/operations-config.ts:160                | operations 域缺 monitoring_review workflow 输出合约                                |
| 2396 | P1     | config/bootstrap/default.json:2                     | phase "phase_1a" 使用废弃 Phase 术语——应为 Ring 1/2/3                              |
| 2397 | P1     | src/domains/recipes/index.ts:3                      | DomainRecipeSchema 缺 riskLevel/budgetHint/requiredApproval                        |
| 2398 | P1     | src/sdk/pack-sdk/pack-manifest.ts:26                | BusinessPackManifest 缺 rollbackStrategy——违反"先可恢复再自动化"宪法               |
| 2399 | P1     | src/plugins/adapters/asset-production-adapter.ts:15 | adapterType "figma" 不在 ExternalAdapterPlugin 联合类型中——类型不匹配              |
| 2400 | P2     | config/security/default.json:3                      | sandboxMode 默认 "workspace_write"——应为 "read_only"                               |
| 2401 | P2     | config/gateways/default.json:1                      | 缺 timeout/circuitBreaker/fallbackMode 字段                                        |
| 2402 | P2     | divisions/operations/schemas/ops-output.json:1      | draft-07 vs 其他 division 的 draft/2020-12——schema 版本不统一                      |
| 2403 | P2     | config/domains/default.json:98                      | coding 域 status "testing" 与 Pack 生命周期状态命名不一致                          |
| 2404 | P2     | divisions/analytics/division.yaml:1                 | analytics/devops/operations trigger "monitoring" 重叠——无优先级仲裁                |
| 2405 | P2     | src/plugins/growth-config.ts:201                    | externalAdapters 声明 jira 但无实现——声明与实现不一致                              |
| 2406 | P2     | src/domains/recipes/recipe-executor.ts:34           | 硬编码 regex stub 判断 workflow 不存在——应查询 WorkflowRegistry                    |

### §205 UI Shared 层 / Features 深层缺陷

| #    | 严重度 | 文件                                                              | 问题                                                                                |
| ---- | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2407 | P0     | ui/packages/shared/platform/src/web-platform-adapter.ts:9         | 安全凭证存 localStorage——XSS 完全暴露，违反 UP-6 Token 安全存储                     |
| 2408 | P0     | ui/packages/shared/platform/src/mobile-platform-adapter.ts:10     | analyticsConsentDefault:true——违反 GDPR opt-in 原则                                 |
| 2409 | P0     | ui/packages/features/conversation/src/hooks/index.ts:46           | 跳过 intake pipeline 本地模拟 execute——违反 P1→P2 必经控制面不变量                  |
| 2410 | P0     | src/platform/contracts/control-directive/index.ts:4               | ControlDirective 仍为 canonical 导出——§5.2 要求 v4.2 起为 deprecated alias          |
| 2411 | P0     | src/platform/contracts/execution-plan/index.ts:17                 | ExecutionPlan 仍用线性 steps[]——§5.3 要求 PlanGraphBundle 为唯一执行契约            |
| 2412 | P1     | ui/packages/features/settings/src/hooks/index.ts:106              | save() 无实际 API 调用——违反 UP-1 API-First 原则                                    |
| 2413 | P1     | ui/packages/shared/sync/src/conflict-resolver.ts:12               | merge 用 {...server,...local} 简单覆盖——local 无条件覆写 server 可致数据丢失        |
| 2414 | P1     | ui/packages/shared/sync/src/offline-queue.ts:19                   | enqueue 后 persist 失败仅存内存——崩溃丢失离线变更                                   |
| 2415 | P1     | ui/packages/shared/sync/src/types.ts:1                            | OfflineMutation 缺 tenantId/traceId/principal——flush 后无法满足 ContractEnvelope    |
| 2416 | P1     | ui/packages/shared/telemetry/src/index.ts:74                      | OTLP POST 无认证头——违反多租户隔离                                                  |
| 2417 | P1     | ui/packages/shared/platform/src/base-platform-adapter.ts:96       | runShell(command) 无白名单——命令注入风险                                            |
| 2418 | P1     | ui/packages/shared/nl-client/src/index.ts:16                      | 纯内存客户端模拟无后端交互——UI 状态与 truth 不同步                                  |
| 2419 | P1     | docs_zh/adr/018-rollout-eleven-state-machine.md:1                 | Superseded ADR 仍含可执行规格——与 ADR-075 六级状态机不兼容                          |
| 2420 | P1     | src/platform/execution/state-transition/transition-service.ts:228 | 仍用 TaskStatus/WorkflowStatus TransitionCommand——应统一为 RuntimeTransitionCommand |
| 2421 | P2     | ui/packages/features/alerts/src/hooks/index.ts:6                  | 告警无权限过滤——违反最小权限展示                                                    |
| 2422 | P2     | ui/packages/features/conversation/src/index.tsx:7                 | NL 作为主入口归入 Extended 组——与§UX-1 主入口定位矛盾                               |
| 2423 | P2     | ui/packages/shared/sync/src/sync-coordinator.ts:35                | flush drain 后未等发送确认——变更可永久丢失                                          |
| 2424 | P2     | ui/packages/shared/telemetry/src/index.ts:28                      | record() fire-and-forget 无重试/DLQ                                                 |
| 2425 | P2     | ui/packages/shared/platform/src/desktop-platform-adapter.ts:9     | Web screenSecurityDefault:false vs 桌面 true——安全基线不统一                        |
| 2426 | P2     | ui/packages/features/settings/src/hooks/index.ts:20               | 7 个查询无并行加载——违反 FCP<1.5s 性能目标                                          |

### §206 Bootstrap / 初始化 / 测试基础设施 缺陷

| #    | 严重度 | 文件                                                             | 问题                                                                    |
| ---- | ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2427 | P0     | src/index.ts:264                                                 | main() 未调用 registerProcessErrorHandlers——进程异常无有序关闭兜底      |
| 2428 | P0     | src/index.ts:125                                                 | runPlatformRootDemo 未注册 GracefulShutdown——崩溃时无优雅关停           |
| 2429 | P1     | src/index.ts:178                                                 | buildPlatformRootSummary 绕过 ServiceRegistry 直接调用 build 函数       |
| 2430 | P1     | src/platform-architecture-bootstrap.ts:150                       | getPlatformArchitectureServices 每次重新 register——覆盖缓存实例         |
| 2431 | P1     | src/index.ts:13                                                  | buildFivePlaneRuntimeCatalog 未 re-export——公共 API 不对称              |
| 2432 | P1     | src/index.ts:10                                                  | buildAiOperationsStartupPlan/buildFivePlaneStartupPlan 未根导出         |
| 2433 | P1     | src/platform/execution/startup/graceful-shutdown.ts:274          | globalShutdownInstance 模块级单例未纳入 ServiceRegistry——双单例泄漏风险 |
| 2434 | P1     | src/platform/execution/startup/process-error-handlers.ts:19      | processLogger 模块顶层构造——绕过生命周期管理，测试间状态泄漏            |
| 2435 | P1     | src/platform-architecture-bootstrap.ts:111                       | buildBootstrapSummary 与 registerServices 双源分歧——运行时数据不一致    |
| 2436 | P1     | src/platform-application-kernel.ts:130                           | registerKernel 未声明 dependsOn——ServiceRegistry 无法保障初始化顺序     |
| 2437 | P1     | tests/integration/                                               | 无 graceful-shutdown/process-error-handlers 集成测试                    |
| 2438 | P2     | tests/unit/runtime/graceful-shutdown.test.ts:6                   | 测试路径不符合规范目录结构                                              |
| 2439 | P2     | tests/e2e/ui-web-flow.test.ts:7                                  | 硬编码路径且未检查 multi-shell 路由清单一致性                           |
| 2440 | P2     | tests/golden/prompt-assembly.test.ts:19                          | golden 测试硬编码模型标识——model-metadata 变更则快照静默失效            |
| 2441 | P2     | src/index.ts:41                                                  | PlatformRootEntryMode 定义在根入口而非 types 文件——类型分散             |
| 2442 | P2     | package.json:6                                                   | exports 缺 ./platform/execution/startup 子路径                          |
| 2443 | P2     | src/platform/execution/startup/startup-consistency-checker.ts:16 | 硬依赖 DispatchReconciliation 构造——增加启动耦合                        |
## Round 41 — 深度补充审计（ops-maturity / scale-ecosystem / SDK / plugins / config / UI-shared / bootstrap）

### §203 Ops-Maturity 深层缺陷（workflow-debugger / drift-detection / explainability / SLA）

| #    | 严重度 | 文件                                                                | 问题                                                                            |
| ---- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2364 | P0     | src/ops-maturity/drift-detection/benchmark-runner.ts:118            | Math.random() 模拟基准结果——晋升决策不确定，违反规范确定性证据驱动评估          |
| 2365 | P0     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:91  | 重放执行无 ReplaySandboxPolicy 守卫——违反 INV-REPLAY-001 重放不得产生真实副作用 |
| 2366 | P0     | src/scale-ecosystem/integration/connector-framework-service.ts:107  | execute() 未经 SideEffectManager 记录——违反 INV-SIDEEFFECT-001                  |
| 2367 | P0     | src/platform/shared/observability/slo-alerting-service.ts:240       | 通知 fetch 发送前即返回 delivered:true——投递失败静默吞没                        |
| 2368 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts:28           | workflowId/stepId 使用废弃术语——应为 PlanGraph/NodeRun/NodeAttempt              |
| 2369 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:18  | DebugSnapshot 使用 executionId/stepId——与§5.5 canonical 对象模型不一致          |
| 2370 | P1     | src/ops-maturity/drift-detection/evidence-store.ts:46               | InMemoryEvidenceStore.records 无上界——持续 append OOM                           |
| 2371 | P1     | src/scale-ecosystem/sla-engine/resource-allocator/index.ts:6        | allocateReservedCapacity 未校验 reservedPercent ≤100%——可超额分配               |
| 2372 | P1     | src/platform/shared/lifecycle/service-registry.ts:146               | if(!has){delete}——死代码无效果                                                  |
| 2373 | P1     | src/ops-maturity/explainability/explanation-pipeline-service.ts:80  | L3 depth ttlHours:0 但无 TTL 驱逐——条目永驻内存                                 |
| 2374 | P1     | src/platform/shared/observability/slo-alerting-service.ts:620       | acknowledgeAlert 直接 mutate readonly 语义对象                                  |
| 2375 | P1     | src/ops-maturity/drift-detection/rollout-manager.ts:43              | rollouts Map 无容量限制——已完成 rollout 无清理                                  |
| 2376 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:62            | 自增 counter 生成 ID——重启后冲突                                                |
| 2377 | P1     | src/ops-maturity/drift-detection/proposal-engine.ts:100             | 同上 prop\_${++counter}——重启后 ID 冲突                                         |
| 2378 | P1     | src/ops-maturity/workflow-debugger/execution-tracer.ts:103          | durationMs = now - traceStart——测量的是总经过时间非单事件时长                   |
| 2379 | P1     | src/platform/shared/observability/slo-alerting-service.ts:738       | executeRunbook() 恒标 completed——无实际执行逻辑                                 |
| 2380 | P1     | src/ops-maturity/drift-detection/reflection-engine.ts:94            | new Date() 替代平台 nowIso()——测试不确定                                        |
| 2381 | P1     | src/ops-maturity/drift-detection/proposal-engine.ts:93              | 同上 new Date() 替代 nowIso()                                                   |
| 2382 | P1     | src/scale-ecosystem/integration/connector-framework-service.ts:107  | execute() 返回模拟结果非实际调用——connector 功能未实现                          |
| 2383 | P1     | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts:124 | breakpoints 赋值可变数组至 readonly 字段——绕过只读约束                          |

### §204 SDK / Plugins / Config / Divisions 缺陷

| #    | 严重度 | 文件                                                | 问题                                                                               |
| ---- | ------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2384 | P0     | config/security/default.json:7                      | allowedCapabilities 含 "mcp" 但 PluginSandboxPolicy 无此能力类型——违反默认安全收敛 |
| 2385 | P0     | src/plugins/adapters/crm-adapter.ts:52              | token 明文前 8 字符存入 fingerprint——泄露敏感凭据片段                              |
| 2386 | P1     | src/sdk/admin-sdk/index.ts:6                        | 缺 resumeHarnessRun/listWorkers/getConfig 等 Admin API——运维脚本化能力不足         |
| 2387 | P1     | src/sdk/admin-sdk/index.ts:1                        | 未发送 X-Platform-Version/X-SDK-Version 请求头——违反 SDK 兼容性契约                |
| 2388 | P1     | src/sdk/harness-sdk/index.ts:34                     | appendStep 用 stage 字段映射 nodeRunId——应为 NodeRun/NodeAttempt                   |
| 2389 | P1     | src/sdk/harness-sdk/index.ts:27                     | 缺 reserveBudget/settleBudget——违反 INV-BUDGET-001 先预留再执行                    |
| 2390 | P1     | config/runtime/default.json:4                       | defaultStepTimeoutMs 使用废弃 step 术语——应为 defaultNodeRunTimeoutMs              |
| 2391 | P1     | config/risk/default.json:2                          | $schema 引用 .ts 文件——非合法 JSON Schema                                          |
| 2392 | P1     | src/plugins/validators/basic-evaluator.ts:14        | initialize/shutdown 空实现——跳过 PluginLifecycleHooks 完整生命周期                 |
| 2393 | P1     | src/plugins/adapters/game-dev-adapter.ts:26         | authenticate() 空实现——接受任意凭据                                                |
| 2394 | P1     | src/plugins/builtin-plugin-registry.ts:21           | 无插件生命周期状态跟踪(registered→loaded→active→inactive→unloaded)                 |
| 2395 | P1     | src/plugins/operations-config.ts:160                | operations 域缺 monitoring_review workflow 输出合约                                |
| 2396 | P1     | config/bootstrap/default.json:2                     | phase "phase_1a" 使用废弃 Phase 术语——应为 Ring 1/2/3                              |
| 2397 | P1     | src/domains/recipes/index.ts:3                      | DomainRecipeSchema 缺 riskLevel/budgetHint/requiredApproval                        |
| 2398 | P1     | src/sdk/pack-sdk/pack-manifest.ts:26                | BusinessPackManifest 缺 rollbackStrategy——违反"先可恢复再自动化"宪法               |
| 2399 | P1     | src/plugins/adapters/asset-production-adapter.ts:15 | adapterType "figma" 不在 ExternalAdapterPlugin 联合类型中——类型不匹配              |
| 2400 | P2     | config/security/default.json:3                      | sandboxMode 默认 "workspace_write"——应为 "read_only"                               |
| 2401 | P2     | config/gateways/default.json:1                      | 缺 timeout/circuitBreaker/fallbackMode 字段                                        |
| 2402 | P2     | divisions/operations/schemas/ops-output.json:1      | draft-07 vs 其他 division 的 draft/2020-12——schema 版本不统一                      |
| 2403 | P2     | config/domains/default.json:98                      | coding 域 status "testing" 与 Pack 生命周期状态命名不一致                          |
| 2404 | P2     | divisions/analytics/division.yaml:1                 | analytics/devops/operations trigger "monitoring" 重叠——无优先级仲裁                |
| 2405 | P2     | src/plugins/growth-config.ts:201                    | externalAdapters 声明 jira 但无实现——声明与实现不一致                              |
| 2406 | P2     | src/domains/recipes/recipe-executor.ts:34           | 硬编码 regex stub 判断 workflow 不存在——应查询 WorkflowRegistry                    |

### §205 UI Shared 层 / Features 深层缺陷

| #    | 严重度 | 文件                                                              | 问题                                                                                |
| ---- | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2407 | P0     | ui/packages/shared/platform/src/web-platform-adapter.ts:9         | 安全凭证存 localStorage——XSS 完全暴露，违反 UP-6 Token 安全存储                     |
| 2408 | P0     | ui/packages/shared/platform/src/mobile-platform-adapter.ts:10     | analyticsConsentDefault:true——违反 GDPR opt-in 原则                                 |
| 2409 | P0     | ui/packages/features/conversation/src/hooks/index.ts:46           | 跳过 intake pipeline 本地模拟 execute——违反 P1→P2 必经控制面不变量                  |
| 2410 | P0     | src/platform/contracts/control-directive/index.ts:4               | ControlDirective 仍为 canonical 导出——§5.2 要求 v4.2 起为 deprecated alias          |
| 2411 | P0     | src/platform/contracts/execution-plan/index.ts:17                 | ExecutionPlan 仍用线性 steps[]——§5.3 要求 PlanGraphBundle 为唯一执行契约            |
| 2412 | P1     | ui/packages/features/settings/src/hooks/index.ts:106              | save() 无实际 API 调用——违反 UP-1 API-First 原则                                    |
| 2413 | P1     | ui/packages/shared/sync/src/conflict-resolver.ts:12               | merge 用 {...server,...local} 简单覆盖——local 无条件覆写 server 可致数据丢失        |
| 2414 | P1     | ui/packages/shared/sync/src/offline-queue.ts:19                   | enqueue 后 persist 失败仅存内存——崩溃丢失离线变更                                   |
| 2415 | P1     | ui/packages/shared/sync/src/types.ts:1                            | OfflineMutation 缺 tenantId/traceId/principal——flush 后无法满足 ContractEnvelope    |
| 2416 | P1     | ui/packages/shared/telemetry/src/index.ts:74                      | OTLP POST 无认证头——违反多租户隔离                                                  |
| 2417 | P1     | ui/packages/shared/platform/src/base-platform-adapter.ts:96       | runShell(command) 无白名单——命令注入风险                                            |
| 2418 | P1     | ui/packages/shared/nl-client/src/index.ts:16                      | 纯内存客户端模拟无后端交互——UI 状态与 truth 不同步                                  |
| 2419 | P1     | docs_zh/adr/018-rollout-eleven-state-machine.md:1                 | Superseded ADR 仍含可执行规格——与 ADR-075 六级状态机不兼容                          |
| 2420 | P1     | src/platform/execution/state-transition/transition-service.ts:228 | 仍用 TaskStatus/WorkflowStatus TransitionCommand——应统一为 RuntimeTransitionCommand |
| 2421 | P2     | ui/packages/features/alerts/src/hooks/index.ts:6                  | 告警无权限过滤——违反最小权限展示                                                    |
| 2422 | P2     | ui/packages/features/conversation/src/index.tsx:7                 | NL 作为主入口归入 Extended 组——与§UX-1 主入口定位矛盾                               |
| 2423 | P2     | ui/packages/shared/sync/src/sync-coordinator.ts:35                | flush drain 后未等发送确认——变更可永久丢失                                          |
| 2424 | P2     | ui/packages/shared/telemetry/src/index.ts:28                      | record() fire-and-forget 无重试/DLQ                                                 |
| 2425 | P2     | ui/packages/shared/platform/src/desktop-platform-adapter.ts:9     | Web screenSecurityDefault:false vs 桌面 true——安全基线不统一                        |
| 2426 | P2     | ui/packages/features/settings/src/hooks/index.ts:20               | 7 个查询无并行加载——违反 FCP<1.5s 性能目标                                          |

### §206 Bootstrap / 初始化 / 测试基础设施 缺陷

| #    | 严重度 | 文件                                                             | 问题                                                                    |
| ---- | ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2427 | P0     | src/index.ts:264                                                 | main() 未调用 registerProcessErrorHandlers——进程异常无有序关闭兜底      |
| 2428 | P0     | src/index.ts:125                                                 | runPlatformRootDemo 未注册 GracefulShutdown——崩溃时无优雅关停           |
| 2429 | P1     | src/index.ts:178                                                 | buildPlatformRootSummary 绕过 ServiceRegistry 直接调用 build 函数       |
| 2430 | P1     | src/platform-architecture-bootstrap.ts:150                       | getPlatformArchitectureServices 每次重新 register——覆盖缓存实例         |
| 2431 | P1     | src/index.ts:13                                                  | buildFivePlaneRuntimeCatalog 未 re-export——公共 API 不对称              |
| 2432 | P1     | src/index.ts:10                                                  | buildAiOperationsStartupPlan/buildFivePlaneStartupPlan 未根导出         |
| 2433 | P1     | src/platform/execution/startup/graceful-shutdown.ts:274          | globalShutdownInstance 模块级单例未纳入 ServiceRegistry——双单例泄漏风险 |
| 2434 | P1     | src/platform/execution/startup/process-error-handlers.ts:19      | processLogger 模块顶层构造——绕过生命周期管理，测试间状态泄漏            |
| 2435 | P1     | src/platform-architecture-bootstrap.ts:111                       | buildBootstrapSummary 与 registerServices 双源分歧——运行时数据不一致    |
| 2436 | P1     | src/platform-application-kernel.ts:130                           | registerKernel 未声明 dependsOn——ServiceRegistry 无法保障初始化顺序     |
| 2437 | P1     | tests/integration/                                               | 无 graceful-shutdown/process-error-handlers 集成测试                    |
| 2438 | P2     | tests/unit/runtime/graceful-shutdown.test.ts:6                   | 测试路径不符合规范目录结构                                              |
| 2439 | P2     | tests/e2e/ui-web-flow.test.ts:7                                  | 硬编码路径且未检查 multi-shell 路由清单一致性                           |
| 2440 | P2     | tests/golden/prompt-assembly.test.ts:19                          | golden 测试硬编码模型标识——model-metadata 变更则快照静默失效            |
| 2441 | P2     | src/index.ts:41                                                  | PlatformRootEntryMode 定义在根入口而非 types 文件——类型分散             |
| 2442 | P2     | package.json:6                                                   | exports 缺 ./platform/execution/startup 子路径                          |
| 2443 | P2     | src/platform/execution/startup/startup-consistency-checker.ts:16 | 硬依赖 DispatchReconciliation 构造——增加启动耦合                        |


## Round 42 — 深度审计（compliance / HA-execution / UI-apps / contracts-implementation 交叉验证）

### §208 Compliance / Model-Gateway / Prompt-Engine 深层缺陷

| #    | 严重度 | 文件                                                                          | 问题                                                                            |
| ---- | ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2444 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:1                  | 渐进阶段 canary_5/partial_25/50/75 与 spec 定义的 canary(5%)/canary(20%) 不一致 |
| 2445 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:24                 | nextStage() 允许 stable→rolled_back 顺序推进——stable 应为终态                   |
| 2446 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:348                       | runAbTest() 硬编码 0.85/0.90 分数——A/B 测试结果完全虚假                         |
| 2447 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:308                       | verdict 不区分 critical case——仅用 80% 阈值，critical_case_pass==100% 未实现    |
| 2448 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:525                       | detectRegression 缺 latency_regression≤120% 和 cost_regression≤150% 门禁        |
| 2449 | P1     | src/platform/prompt-engine/conversation-template-service.ts:374               | next() 对已注销 template 调用 registry.get() 抛异常而非返回 null                |
| 2450 | P1     | src/platform/execution/budget-allocator.ts:82                                 | settle() 内存计算 ledger——无 SQL CAS 原子操作，并发 settle 余额不一致           |
| 2451 | P1     | src/platform/execution/runtime-state-machine.ts:322                           | assertAuditRef 不校验 null——requiresAudit=true 时转换可不提供 auditRef          |
| 2452 | P1     | src/platform/state-evidence/memory/memory-decay-service.ts:161                | access boost 指数增长致 freshness 恒=1.0——高频记忆永不衰减违反 6 层模型         |
| 2453 | P1     | src/platform/state-evidence/events/cas/cas-service.ts:46                      | CAS 纯内存 Map——多节点无一致性保证                                              |
| 2454 | P2     | src/platform/execution/budget-reservation-sweeper.ts:31                       | expiresAt 格式异常时 Date.parse 返回 NaN——孤儿 reservation 永不释放             |
| 2455 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:97              | fencingCounter 实例级——多 pod 各自从 0 递增，无全局单调性                       |
| 2456 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:130             | extendAsync Lua 不更新 JSON.ttlMs——inspect 返回过期值                           |
| 2457 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:182             | forceSteal SET XX——原 lock 过期被 Redis 删除后 steal 失败                       |
| 2458 | P2     | src/platform/execution/distributed-lock/pg-advisory-lock-adapter.ts:31        | lockKey hash 仅 32-bit——碰撞概率高                                              |
| 2459 | P2     | src/platform/execution/distributed-lock/pg-advisory-lock-adapter.ts:66        | extend() 返回 inspect() 恒 null——扩展静默失败                                   |
| 2460 | P2     | src/platform/state-evidence/events/cas/fencing-token-service.ts:58            | activeFences static Map 但 tokenCounter 实例级——不同实例可生成相同 token        |
| 2461 | P2     | src/platform/state-evidence/events/cas/fencing-token-service.ts:100           | split("-") 解析——executionId/nodeId 含 "-" 时解析错误                           |
| 2462 | P2     | src/ops-maturity/explainability/explanation-pipeline-service.ts:80            | L3 TTL=0 条目仍写入缓存——审计解释不可检索                                       |
| 2463 | P2     | src/platform/prompt-engine/eval/prompt-model-policy-governance-service.ts:162 | reviewRequired=false 直接 approved——跳过 staging eval gate                      |

### §209 HA / Lease / Recovery / Worker-Pool / Dispatcher 深层缺陷

| #    | 严重度 | 文件                                                                | 问题                                                                                    |
| ---- | ------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2464 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:353       | renewLeadership 返回 currentLease.ttlMs 而非 fencing token——续约后 stale-write 校验失效 |
| 2465 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:228       | 异步版同样返回 ttlMs 作为 fencing token                                                 |
| 2466 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:701       | fencingTokenCounter 内存变量——重启归零可复用旧 token                                    |
| 2467 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:510       | 异步版 counter 各节点独立递增——无全局唯一性                                             |
| 2468 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:102       | acquireLeadership 无事务——并发可同时获得 leadership 脑裂                                |
| 2469 | P0     | src/platform/execution/ha/lease-reclaimer-service.ts:387            | getExpiredLeases 依赖 getActiveLease(只返回未过期)——永远找不到过期租约                  |
| 2470 | P0     | src/platform/execution/ha/lease-reclaimer-service.ts:415            | expireLease 仅打日志不执行状态变更——过期租约无法回收                                    |
| 2471 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts:298     | findStaleExecuting 用 now+threshold 而非 now-threshold——所有执行被判 stale              |
| 2472 | P1     | src/platform/execution/ha/ha-coordinator-service-async.ts:487       | verifyWriteAuthority >= 比较——旧 leader 持当前 token 仍可写入                           |
| 2473 | P1     | src/platform/execution/ha/ha-coordinator-service-async.ts:503       | purgeOldFailoverDecisions 硬编码返回 0——failover 历史永不清理                           |
| 2474 | P1     | src/platform/execution/ha/leader-election-service.ts:176            | HA_1 单节点无续约定时器——租约过期后不自动续期                                           |
| 2475 | P1     | src/platform/execution/ha/stuck-run-sweeper-service.ts:559          | killRun 先设 status="killed" 再调回调——回调失败时状态已污染                             |
| 2476 | P1     | src/platform/execution/ha/recovery-orchestrator-service.ts:27       | recovery worker 串行 for-of await——无并行度，大量待恢复项延迟高                         |
| 2477 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:401 | 嵌套事务——SQLite 不支持 SAVEPOINT 嵌套可静默失败                                        |
| 2478 | P1     | src/platform/execution/lease/execution-lease-service-async.ts:247   | releaseLeaseSync 不检查 lease.status——已过期租约可被再次释放                            |
| 2479 | P1     | src/platform/execution/tool-executor/tool-parallel-executor.ts:407  | results 数组含 undefined 空洞——返回类型断言 T[] 致下游 NPE                              |
| 2480 | P1     | src/platform/execution/tool-executor/command-executor.ts:162        | activeProcessCount static 无锁——高并发可超限                                            |
| 2481 | P2     | src/platform/execution/tool-executor/command-executor.ts:99         | Windows/Unix 使用相同 SIGTERM——Windows 上无效                                           |
| 2482 | P2     | src/platform/execution/tool-executor/command-security.ts:259        | 过度拦截脚本参数——python --verbose 等合法用法被拒绝                                     |
| 2483 | P2     | src/platform/execution/lease/execution-lease-service.ts:797         | getLatestFencingToken fallback 返回 0——任何 token 校验均通过                            |
| 2484 | P2     | src/platform/execution/ha/lease-reclaimer-service.ts:406            | getStaleNodes 硬编码返回空数组——心跳超时节点永不检测                                    |

### §210 UI Apps (Electron/Tauri/Mobile) + Features (HITL/Approval/Cockpit) 缺陷

| #    | 严重度 | 文件                                                        | 问题                                                              |
| ---- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 2485 | P0     | ui/apps/tauri-macos/src-tauri/src/lib.rs:12                 | run_shell 任意字符串无校验——远程代码执行                          |
| 2486 | P0     | ui/apps/tauri-linux/src-tauri/src/lib.rs:12                 | 同上 Linux 端无输入过滤                                           |
| 2487 | P0     | ui/apps/electron-win/src/preload.ts:33                      | 直接赋值 window.**AA_ELECTRON** 绕过 contextBridge——安全模式失效  |
| 2488 | P0     | ui/apps/electron-win/index.html:1                           | 缺 CSP meta 标签——违反§6.5.4 安全基线                             |
| 2489 | P0     | ui/apps/tauri-macos/src-tauri/tauri.conf.json:1             | 缺 security 段/CSP/allowlist——默认开放全部 IPC                    |
| 2490 | P0     | ui/apps/tauri-linux/src-tauri/tauri.conf.json:1             | 同上 Linux Tauri 配置缺 security                                  |
| 2491 | P1     | ui/packages/features/hitl/src/hooks/index.ts:5              | HITL 缺 Patch+Override 能力——仅实现 Inspect/Takeover/Resume (3/5) |
| 2492 | P1     | ui/packages/features/hitl/src/web/index.tsx:9               | HITL 仅渲染静态 ListCard——无实际交互表单/按钮                     |
| 2493 | P1     | ui/packages/features/approval/src/hooks/index.ts:13         | 缺 request_more_context 动作——最小动作集不完整                    |
| 2494 | P1     | ui/packages/features/approval/src/web/index.tsx:33          | 缺 deadline 倒计时/policy_source/recommended_option               |
| 2495 | P1     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:59 | pause/resume/recover 仅修改本地 state——未调用 REST API            |
| 2496 | P1     | ui/packages/features/task-cockpit/src/hooks/index.ts:58     | claim/resume/escalate 同理——仅本地变更无 API 调用                 |
| 2497 | P1     | ui/packages/features/workflow-cockpit/src/web/index.tsx:34  | 缺 DAGViewer 组件——§4.2.3 L2 必需                                 |
| 2498 | P1     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:5  | 缺 approval_nodes/evidence_refs 字段                              |
| 2499 | P1     | ui/apps/mobile/src/App.tsx:5                                | 硬编码 "android"——iOS 设备获得错误平台标识                        |
| 2500 | P1     | ui/apps/mobile/src/navigation.ts:8                          | 移动端缺 workflow-cockpit 入口                                    |
| 2501 | P2     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:30 | useWorkflowsQuery + useState 双持——缓存一致性偏差                 |
| 2502 | P2     | ui/packages/features/task-cockpit/src/web/index.tsx:12      | 缺 L3-L5 下钻子路由                                               |
| 2503 | P2     | ui/packages/features/approval/src/hooks/index.ts:80         | approve/reject 仅本地移除——未调用后端 POST decisions              |
| 2504 | P2     | ui/apps/electron-win/src/main.ts:15                         | IPC shell:run/shell:spawn 无命令白名单                            |
| 2505 | P2     | ui/packages/features/approval/src/mobile/index.ts:4         | 移动端审批无交互——规格要求通知栏快捷操作                          |
| 2506 | P2     | ui/packages/features/hitl/src/mobile/index.ts:3             | HITL 移动端完全不可用                                             |
| 2507 | P2     | ui/apps/mobile/src/navigation.ts:14                         | settings 缺子路由——无法导航到 7 个配置子页面                      |

### §211 Contracts-Implementation 交叉验证（OAPEFLIR / EventBus / NL-Gateway / Goal-Decomposer）

| #    | 严重度 | 文件                                                              | 问题                                                                          |
| ---- | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2508 | P0     | src/platform/contracts/types/domain/session-types.ts:237          | EventRecord 缺 sequence/causationId/correlationId/payloadHash/idempotencyKey  |
| 2509 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:358       | dead-letter 仅内存 Map 非独立 DLQ 表——违反"Event 不允许物理删除"              |
| 2510 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:178       | publish() 未维护 run 内单调递增 sequence——违反§14.3 第 3 条                   |
| 2511 | P1     | src/platform/orchestration/oapeflir/stage-timeline.ts:3           | 含 knowledge_promotion 第 9 阶段——spec 定义 OAPEFLIR 仅八阶段                 |
| 2512 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:52   | 使用 PlannedWorkflow 而非 PlanGraphBundle——Plan 为线性 steps                  |
| 2513 | P1     | src/platform/orchestration/oapeflir/types/plan.ts:32              | PlanSchema 仅 steps[]——缺 nodes/edges/entryNodeIds/graphConstraints           |
| 2514 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:62   | 缺 normalizationReport/validationReport/riskPropagation/worstPath             |
| 2515 | P1     | src/platform/orchestration/oapeflir/stage-transition-fsm.ts:53    | FSM 严格线性——不支持 retry_wait→ready 等非线性迁移                            |
| 2516 | P1     | src/platform/state-evidence/events/event-registry.ts:63           | 事件命名 task:/workflow: 与 spec platform.harness*run.*/node*run.* 完全不匹配 |
| 2517 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:197       | bus 层未强制 event append 与 truth update 同事务                              |
| 2518 | P1     | src/interaction/nl-gateway/index.ts:620                           | parseDetailed 缺完整 Input Guardrail 层——仅 regex injection 检测              |
| 2519 | P2     | src/interaction/goal-decomposer/index.ts:43                       | 返回 PlannedTask[] 非 PlanGraphBundle                                         |
| 2520 | P2     | src/interaction/goal-decomposer/index.ts:6                        | SuccessCriterion 缺 operator/threshold 量化字段                               |
| 2521 | P2     | src/platform/orchestration/harness/oapeflir-harness-mapping.ts:13 | 缺 learn/release 映射——L/R 阶段永不被触发                                     |
| 2522 | P2     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:276  | Feedback 结果未包装为 DecisionInputBundle(缺 budgetState/riskState)           |
| 2523 | P2     | src/platform/state-evidence/events/event-types.ts:42              | TIER_1 含 26 类型但 registry 仅注册原始 9 个——新 tier-1 缺 schema/validator   |
| 2524 | P2     | src/platform/state-evidence/events/typed-event-bus.ts:32          | TypedEventPayloadMap 未覆盖 delegation/prompt/tenant 等事件 payload 定义      |
| 2525 | P2     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:118  | run() 未调用 StageTransitionFSM——FSM 死代码                                   |
| 2526 | P2     | src/interaction/nl-gateway/index.ts:677                           | buildTask 缺 RuntimeMode/AutonomyMode 注入——critical risk 未降级 autonomy     |
| 2527 | P2     | src/platform/orchestration/harness/harness-bootstrap.ts:18        | 仅注册 2 个 service ID——缺 NodeRuntime/SideEffectMgr/Evaluator/GraphScheduler |
## Round 42 — 深度审计（compliance / HA-execution / UI-apps / contracts-implementation 交叉验证）

### §208 Compliance / Model-Gateway / Prompt-Engine 深层缺陷

| #    | 严重度 | 文件                                                                          | 问题                                                                            |
| ---- | ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 2444 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:1                  | 渐进阶段 canary_5/partial_25/50/75 与 spec 定义的 canary(5%)/canary(20%) 不一致 |
| 2445 | P1     | src/platform/prompt-engine/rollout/prompt-rollout-stage.ts:24                 | nextStage() 允许 stable→rolled_back 顺序推进——stable 应为终态                   |
| 2446 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:348                       | runAbTest() 硬编码 0.85/0.90 分数——A/B 测试结果完全虚假                         |
| 2447 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:308                       | verdict 不区分 critical case——仅用 80% 阈值，critical_case_pass==100% 未实现    |
| 2448 | P1     | src/platform/prompt-engine/eval/llm-eval-service.ts:525                       | detectRegression 缺 latency_regression≤120% 和 cost_regression≤150% 门禁        |
| 2449 | P1     | src/platform/prompt-engine/conversation-template-service.ts:374               | next() 对已注销 template 调用 registry.get() 抛异常而非返回 null                |
| 2450 | P1     | src/platform/execution/budget-allocator.ts:82                                 | settle() 内存计算 ledger——无 SQL CAS 原子操作，并发 settle 余额不一致           |
| 2451 | P1     | src/platform/execution/runtime-state-machine.ts:322                           | assertAuditRef 不校验 null——requiresAudit=true 时转换可不提供 auditRef          |
| 2452 | P1     | src/platform/state-evidence/memory/memory-decay-service.ts:161                | access boost 指数增长致 freshness 恒=1.0——高频记忆永不衰减违反 6 层模型         |
| 2453 | P1     | src/platform/state-evidence/events/cas/cas-service.ts:46                      | CAS 纯内存 Map——多节点无一致性保证                                              |
| 2454 | P2     | src/platform/execution/budget-reservation-sweeper.ts:31                       | expiresAt 格式异常时 Date.parse 返回 NaN——孤儿 reservation 永不释放             |
| 2455 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:97              | fencingCounter 实例级——多 pod 各自从 0 递增，无全局单调性                       |
| 2456 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:130             | extendAsync Lua 不更新 JSON.ttlMs——inspect 返回过期值                           |
| 2457 | P2     | src/platform/execution/distributed-lock/redis-lock-adapter.ts:182             | forceSteal SET XX——原 lock 过期被 Redis 删除后 steal 失败                       |
| 2458 | P2     | src/platform/execution/distributed-lock/pg-advisory-lock-adapter.ts:31        | lockKey hash 仅 32-bit——碰撞概率高                                              |
| 2459 | P2     | src/platform/execution/distributed-lock/pg-advisory-lock-adapter.ts:66        | extend() 返回 inspect() 恒 null——扩展静默失败                                   |
| 2460 | P2     | src/platform/state-evidence/events/cas/fencing-token-service.ts:58            | activeFences static Map 但 tokenCounter 实例级——不同实例可生成相同 token        |
| 2461 | P2     | src/platform/state-evidence/events/cas/fencing-token-service.ts:100           | split("-") 解析——executionId/nodeId 含 "-" 时解析错误                           |
| 2462 | P2     | src/ops-maturity/explainability/explanation-pipeline-service.ts:80            | L3 TTL=0 条目仍写入缓存——审计解释不可检索                                       |
| 2463 | P2     | src/platform/prompt-engine/eval/prompt-model-policy-governance-service.ts:162 | reviewRequired=false 直接 approved——跳过 staging eval gate                      |

### §209 HA / Lease / Recovery / Worker-Pool / Dispatcher 深层缺陷

| #    | 严重度 | 文件                                                                | 问题                                                                                    |
| ---- | ------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2464 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:353       | renewLeadership 返回 currentLease.ttlMs 而非 fencing token——续约后 stale-write 校验失效 |
| 2465 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:228       | 异步版同样返回 ttlMs 作为 fencing token                                                 |
| 2466 | P0     | src/platform/execution/ha/ha-coordinator-service-inner.ts:701       | fencingTokenCounter 内存变量——重启归零可复用旧 token                                    |
| 2467 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:510       | 异步版 counter 各节点独立递增——无全局唯一性                                             |
| 2468 | P0     | src/platform/execution/ha/ha-coordinator-service-async.ts:102       | acquireLeadership 无事务——并发可同时获得 leadership 脑裂                                |
| 2469 | P0     | src/platform/execution/ha/lease-reclaimer-service.ts:387            | getExpiredLeases 依赖 getActiveLease(只返回未过期)——永远找不到过期租约                  |
| 2470 | P0     | src/platform/execution/ha/lease-reclaimer-service.ts:415            | expireLease 仅打日志不执行状态变更——过期租约无法回收                                    |
| 2471 | P0     | src/platform/execution/recovery/runtime-recovery-service.ts:298     | findStaleExecuting 用 now+threshold 而非 now-threshold——所有执行被判 stale              |
| 2472 | P1     | src/platform/execution/ha/ha-coordinator-service-async.ts:487       | verifyWriteAuthority >= 比较——旧 leader 持当前 token 仍可写入                           |
| 2473 | P1     | src/platform/execution/ha/ha-coordinator-service-async.ts:503       | purgeOldFailoverDecisions 硬编码返回 0——failover 历史永不清理                           |
| 2474 | P1     | src/platform/execution/ha/leader-election-service.ts:176            | HA_1 单节点无续约定时器——租约过期后不自动续期                                           |
| 2475 | P1     | src/platform/execution/ha/stuck-run-sweeper-service.ts:559          | killRun 先设 status="killed" 再调回调——回调失败时状态已污染                             |
| 2476 | P1     | src/platform/execution/ha/recovery-orchestrator-service.ts:27       | recovery worker 串行 for-of await——无并行度，大量待恢复项延迟高                         |
| 2477 | P1     | src/platform/execution/dispatcher/execution-dispatch-service.ts:401 | 嵌套事务——SQLite 不支持 SAVEPOINT 嵌套可静默失败                                        |
| 2478 | P1     | src/platform/execution/lease/execution-lease-service-async.ts:247   | releaseLeaseSync 不检查 lease.status——已过期租约可被再次释放                            |
| 2479 | P1     | src/platform/execution/tool-executor/tool-parallel-executor.ts:407  | results 数组含 undefined 空洞——返回类型断言 T[] 致下游 NPE                              |
| 2480 | P1     | src/platform/execution/tool-executor/command-executor.ts:162        | activeProcessCount static 无锁——高并发可超限                                            |
| 2481 | P2     | src/platform/execution/tool-executor/command-executor.ts:99         | Windows/Unix 使用相同 SIGTERM——Windows 上无效                                           |
| 2482 | P2     | src/platform/execution/tool-executor/command-security.ts:259        | 过度拦截脚本参数——python --verbose 等合法用法被拒绝                                     |
| 2483 | P2     | src/platform/execution/lease/execution-lease-service.ts:797         | getLatestFencingToken fallback 返回 0——任何 token 校验均通过                            |
| 2484 | P2     | src/platform/execution/ha/lease-reclaimer-service.ts:406            | getStaleNodes 硬编码返回空数组——心跳超时节点永不检测                                    |

### §210 UI Apps (Electron/Tauri/Mobile) + Features (HITL/Approval/Cockpit) 缺陷

| #    | 严重度 | 文件                                                        | 问题                                                              |
| ---- | ------ | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 2485 | P0     | ui/apps/tauri-macos/src-tauri/src/lib.rs:12                 | run_shell 任意字符串无校验——远程代码执行                          |
| 2486 | P0     | ui/apps/tauri-linux/src-tauri/src/lib.rs:12                 | 同上 Linux 端无输入过滤                                           |
| 2487 | P0     | ui/apps/electron-win/src/preload.ts:33                      | 直接赋值 window.**AA_ELECTRON** 绕过 contextBridge——安全模式失效  |
| 2488 | P0     | ui/apps/electron-win/index.html:1                           | 缺 CSP meta 标签——违反§6.5.4 安全基线                             |
| 2489 | P0     | ui/apps/tauri-macos/src-tauri/tauri.conf.json:1             | 缺 security 段/CSP/allowlist——默认开放全部 IPC                    |
| 2490 | P0     | ui/apps/tauri-linux/src-tauri/tauri.conf.json:1             | 同上 Linux Tauri 配置缺 security                                  |
| 2491 | P1     | ui/packages/features/hitl/src/hooks/index.ts:5              | HITL 缺 Patch+Override 能力——仅实现 Inspect/Takeover/Resume (3/5) |
| 2492 | P1     | ui/packages/features/hitl/src/web/index.tsx:9               | HITL 仅渲染静态 ListCard——无实际交互表单/按钮                     |
| 2493 | P1     | ui/packages/features/approval/src/hooks/index.ts:13         | 缺 request_more_context 动作——最小动作集不完整                    |
| 2494 | P1     | ui/packages/features/approval/src/web/index.tsx:33          | 缺 deadline 倒计时/policy_source/recommended_option               |
| 2495 | P1     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:59 | pause/resume/recover 仅修改本地 state——未调用 REST API            |
| 2496 | P1     | ui/packages/features/task-cockpit/src/hooks/index.ts:58     | claim/resume/escalate 同理——仅本地变更无 API 调用                 |
| 2497 | P1     | ui/packages/features/workflow-cockpit/src/web/index.tsx:34  | 缺 DAGViewer 组件——§4.2.3 L2 必需                                 |
| 2498 | P1     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:5  | 缺 approval_nodes/evidence_refs 字段                              |
| 2499 | P1     | ui/apps/mobile/src/App.tsx:5                                | 硬编码 "android"——iOS 设备获得错误平台标识                        |
| 2500 | P1     | ui/apps/mobile/src/navigation.ts:8                          | 移动端缺 workflow-cockpit 入口                                    |
| 2501 | P2     | ui/packages/features/workflow-cockpit/src/hooks/index.ts:30 | useWorkflowsQuery + useState 双持——缓存一致性偏差                 |
| 2502 | P2     | ui/packages/features/task-cockpit/src/web/index.tsx:12      | 缺 L3-L5 下钻子路由                                               |
| 2503 | P2     | ui/packages/features/approval/src/hooks/index.ts:80         | approve/reject 仅本地移除——未调用后端 POST decisions              |
| 2504 | P2     | ui/apps/electron-win/src/main.ts:15                         | IPC shell:run/shell:spawn 无命令白名单                            |
| 2505 | P2     | ui/packages/features/approval/src/mobile/index.ts:4         | 移动端审批无交互——规格要求通知栏快捷操作                          |
| 2506 | P2     | ui/packages/features/hitl/src/mobile/index.ts:3             | HITL 移动端完全不可用                                             |
| 2507 | P2     | ui/apps/mobile/src/navigation.ts:14                         | settings 缺子路由——无法导航到 7 个配置子页面                      |

### §211 Contracts-Implementation 交叉验证（OAPEFLIR / EventBus / NL-Gateway / Goal-Decomposer）

| #    | 严重度 | 文件                                                              | 问题                                                                          |
| ---- | ------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2508 | P0     | src/platform/contracts/types/domain/session-types.ts:237          | EventRecord 缺 sequence/causationId/correlationId/payloadHash/idempotencyKey  |
| 2509 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:358       | dead-letter 仅内存 Map 非独立 DLQ 表——违反"Event 不允许物理删除"              |
| 2510 | P0     | src/platform/state-evidence/events/durable-event-bus.ts:178       | publish() 未维护 run 内单调递增 sequence——违反§14.3 第 3 条                   |
| 2511 | P1     | src/platform/orchestration/oapeflir/stage-timeline.ts:3           | 含 knowledge_promotion 第 9 阶段——spec 定义 OAPEFLIR 仅八阶段                 |
| 2512 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:52   | 使用 PlannedWorkflow 而非 PlanGraphBundle——Plan 为线性 steps                  |
| 2513 | P1     | src/platform/orchestration/oapeflir/types/plan.ts:32              | PlanSchema 仅 steps[]——缺 nodes/edges/entryNodeIds/graphConstraints           |
| 2514 | P1     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:62   | 缺 normalizationReport/validationReport/riskPropagation/worstPath             |
| 2515 | P1     | src/platform/orchestration/oapeflir/stage-transition-fsm.ts:53    | FSM 严格线性——不支持 retry_wait→ready 等非线性迁移                            |
| 2516 | P1     | src/platform/state-evidence/events/event-registry.ts:63           | 事件命名 task:/workflow: 与 spec platform.harness*run.*/node*run.* 完全不匹配 |
| 2517 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:197       | bus 层未强制 event append 与 truth update 同事务                              |
| 2518 | P1     | src/interaction/nl-gateway/index.ts:620                           | parseDetailed 缺完整 Input Guardrail 层——仅 regex injection 检测              |
| 2519 | P2     | src/interaction/goal-decomposer/index.ts:43                       | 返回 PlannedTask[] 非 PlanGraphBundle                                         |
| 2520 | P2     | src/interaction/goal-decomposer/index.ts:6                        | SuccessCriterion 缺 operator/threshold 量化字段                               |
| 2521 | P2     | src/platform/orchestration/harness/oapeflir-harness-mapping.ts:13 | 缺 learn/release 映射——L/R 阶段永不被触发                                     |
| 2522 | P2     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:276  | Feedback 结果未包装为 DecisionInputBundle(缺 budgetState/riskState)           |
| 2523 | P2     | src/platform/state-evidence/events/event-types.ts:42              | TIER_1 含 26 类型但 registry 仅注册原始 9 个——新 tier-1 缺 schema/validator   |
| 2524 | P2     | src/platform/state-evidence/events/typed-event-bus.ts:32          | TypedEventPayloadMap 未覆盖 delegation/prompt/tenant 等事件 payload 定义      |
| 2525 | P2     | src/platform/orchestration/oapeflir/oapeflir-loop-service.ts:118  | run() 未调用 StageTransitionFSM——FSM 死代码                                   |
| 2526 | P2     | src/interaction/nl-gateway/index.ts:677                           | buildTask 缺 RuntimeMode/AutonomyMode 注入——critical risk 未降级 autonomy     |
| 2527 | P2     | src/platform/orchestration/harness/harness-bootstrap.ts:18        | 仅注册 2 个 service ID——缺 NodeRuntime/SideEffectMgr/Evaluator/GraphScheduler |


## Round 43 — 深度审计（org-governance / state-evidence / interaction-autonomy / scale-ecosystem）

### §213 Org-Governance 深层缺陷（delegation / approval / SSO-SCIM）

| #    | 严重度 | 文件                                                                                | 问题                                                                           |
| ---- | ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 2528 | P0     | src/org-governance/delegated-governance/delegated-governance-service.ts:96          | attemptedValue===undefined 时跳过所有 guardrail——未传值操作绕过全部约束        |
| 2529 | P0     | src/org-governance/delegated-governance/governance-console-service.ts:146           | revokeDelegation 不校验 actorId 权限——任意用户可撤销任意委托                   |
| 2530 | P0     | src/org-governance/sso-scim/oidc/oidc-service.ts:237                                | fetchUserInfo 错误时回退 simulateUserInfo——生产环境可产生虚假会话              |
| 2531 | P0     | src/org-governance/delegated-governance/delegated-governance-service.ts:189         | validateInheritanceRule 对 delete 无条件 allowed:true——低级角色可删除上级约束  |
| 2532 | P1     | src/org-governance/delegated-governance/delegated-governance-service.ts:77          | checkOperation 仅收集 platform_team guardrails——忽略 division/dept admin 层级  |
| 2533 | P1     | src/org-governance/approval-routing/route-engine/index.ts:179                       | 无汇率快照时 createdAt 回退至 epoch 1970——审计时间戳失义                       |
| 2534 | P1     | src/org-governance/approval-routing/route-engine/index.ts:256                       | normalizeThresholdCny 硬编码汇率 7.2——与动态 fxRateSnapshot 不一致             |
| 2535 | P1     | src/org-governance/sso-scim/scim-sync/scim-service.ts:533                           | SCIM remove 清空全部 members——未解析 members[value eq "xxx"] 精确移除          |
| 2536 | P1     | src/org-governance/sso-scim/scim-sync/scim-service.ts:164                           | createUser 未校验 userName 唯一性——重复 userName 覆盖索引                      |
| 2537 | P1     | src/org-governance/sso-scim/saml/index.ts:150                                       | consumedAssertionIds Map 无 TTL——无限增长内存泄漏                              |
| 2538 | P1     | src/org-governance/approval-routing/delegation/index.ts:30                          | coiReviewStatus=failed 的委托仍生效——利益冲突审查被绕过                        |
| 2539 | P1     | src/org-governance/delegated-governance/governance-delegation-revocation-saga.ts:28 | cascadeWithinSlo 条件 >=0 恒 true——级联撤销失败永不标记                        |
| 2540 | P1     | src/org-governance/sso-scim/api-key-service.ts:94                                   | API Key 过期后 status 仍 "active"——后续操作基于 status 判断不一致              |
| 2541 | P1     | src/org-governance/sso-scim/oidc/oidc-service.ts:261                                | validateAccessToken O(n) 线性扫描所有 session——无 token→sessionId 索引         |
| 2542 | P2     | src/org-governance/approval-routing/approval-routing-service.ts:79                  | recordId 无时间戳/随机因子——同请求者+同节点 ID 冲突                            |
| 2543 | P2     | src/org-governance/approval-routing/approval-routing-service.ts:64                  | 升级审批人追加到 chain 末尾——sequential 模式下升级反而最后审批                 |
| 2544 | P2     | src/org-governance/org-model/hierarchy/index.ts:73                                  | listAncestorNodeIds 无环检测——环形引用致无限循环                               |
| 2545 | P2     | src/org-governance/delegated-governance/governance-console-service.ts:126           | createDelegation 硬编码 level:"view"/delegatable:false——所有委托只读不可再委托 |
| 2546 | P2     | src/org-governance/sso-scim/scim-sync/scim-service.ts:791                           | applyFilter 忽略 emails.value 等标准 SCIM 过滤字段                             |
| 2547 | P2     | src/org-governance/org-model/hierarchy/index.ts:226                                 | employee_transfer toTeamId 设为父节点 ID——调动目标记录错误                     |
| 2548 | P2     | src/org-governance/sso-scim/oidc/oidc-service.ts:427                                | cleanupExpiredSessions 延迟最长 24h——过期会话长期占内存                        |

### §214 State-Evidence 深层缺陷（Truth / Checkpoints / Knowledge / Projections / Inbox）

| #    | 严重度 | 文件                                                                             | 问题                                                                      |
| ---- | ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2549 | P0     | src/platform/state-evidence/truth/runtime-truth-repository.ts:196                | storeAggregate 对已存在聚合 Map.set 覆写——违反 append-only 不变量         |
| 2550 | P0     | src/platform/state-evidence/events/layered-event-inbox/layered-event-inbox.ts:51 | drain 无事件去重——同一 EventEnvelope append 两次 consumer 收到两条        |
| 2551 | P1     | src/platform/state-evidence/events/durable-event-bus.ts:358                      | 重试 attempt<=MAX(3) 实际执行 4 次(0..3)——比声明多一次                    |
| 2552 | P1     | src/platform/state-evidence/events/layered-event-inbox/layered-event-inbox.ts:65 | drain 对不匹配 consumer 的事件仍推进 cursor——跨 consumer 事件可能丢失     |
| 2553 | P1     | src/platform/state-evidence/events/transactional-event-appender.ts:97            | 手动 BEGIN 绕过 WAL 栅栏——嵌套事务时静默提交或回滚范围错误                |
| 2554 | P1     | src/platform/state-evidence/knowledge/knowledge-query-service.ts:186             | Deep 同步回退用 Standard 逻辑——语义不一致                                 |
| 2555 | P1     | src/platform/state-evidence/knowledge/knowledge-retrieval.ts:296                 | pgvector 后端时同步查询无语义候选——collectSemanticCandidates 返回空       |
| 2556 | P1     | src/platform/state-evidence/checkpoints/session-dual-storage.ts:120              | task-index 写入失败仅 log——session 已落盘但索引缺失，replay 一致性破坏    |
| 2557 | P1     | src/platform/state-evidence/checkpoints/checkpoint-envelope.ts:149               | 错误消息报告 originalSize 非 compressedSize——运维排查信息错误             |
| 2558 | P1     | src/platform/state-evidence/events/projections/worker-status-projection.ts:137   | isEventProcessed Array.includes O(n²)——长期运行性能退化                   |
| 2559 | P1     | src/platform/state-evidence/events/cas/cas-service.ts:182                        | setValue 重置 version=1 而非递增——破坏 version 单调递增不变量             |
| 2560 | P2     | src/platform/state-evidence/truth/cross-region-truth-leader.ts:31                | leader 已迁移后合法写入被永久拒绝——不支持 leader failover                 |
| 2561 | P2     | src/platform/state-evidence/knowledge/knowledge-query-service.ts:352             | truncateHits 固定截断每个 hit——总 token 可能远超 maxTokens                |
| 2562 | P2     | src/platform/state-evidence/events/projections/workflow-run-projection.ts:322    | 单 subtask:failed 直接标 workflow failed——未考虑容错策略                  |
| 2563 | P2     | src/platform/state-evidence/events/projections/approval-queue-projection.ts:356  | rejectionsReceived 设为 approvalsRequired 非递增——多次 rejection 计数丢失 |
| 2564 | P2     | src/platform/state-evidence/events/durable-event-bus.ts:48                       | POLL 10ms/consumer 无 backoff——高 consumer 数 CPU 开销大                  |
| 2565 | P2     | src/platform/state-evidence/knowledge/knowledge-ingestion-pipeline.ts:220        | semantic chunking 回退到 fixed 分割——违反 ChunkingConfig 契约             |
| 2566 | P2     | src/platform/state-evidence/knowledge/storage-quota-service.ts:159               | rmSync 失败中断整个清理——应 catch 继续                                    |

### §215 Interaction 层深层缺陷（Autonomy / Dashboard / UX / Proactive-Agent）

| #    | 严重度 | 文件                                                        | 问题                                                                        |
| ---- | ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2567 | P0     | src/interaction/autonomy/index.ts:215                       | P0 incident 直接 freeze——§42.2 规定应降至 suggestion 非 frozen              |
| 2568 | P0     | src/interaction/autonomy/autonomy-governance-service.ts:71  | trustScore<30 降级不检查 incident severity——高风险 incident 绕过 P0/P1 降级 |
| 2569 | P0     | src/interaction/autonomy/index.ts:258                       | 高风险域仅压 full_auto→semi_auto——§42.5 要求写操作最高 supervised           |
| 2570 | P1     | src/interaction/autonomy/level-manager/index.ts:3           | frozen 放在 full_auto 之后(index=4)——compare 认为 frozen>full_auto 语义错误 |
| 2571 | P1     | src/interaction/autonomy/index.ts:172                       | 模块内 AUTONOMY_LEVEL_ORDER 不含 frozen，level-manager 含——三处排序互相矛盾 |
| 2572 | P1     | src/interaction/autonomy/index.ts:194                       | demoteOneLevel 对 frozen→full_auto——§42 要求 frozen 恢复需人工审批          |
| 2573 | P1     | src/interaction/autonomy/promotion-engine/index.ts:16       | incidents>0 全部阻止晋升——未区分 P2/P3 低级别 incident                      |
| 2574 | P1     | src/interaction/dashboard/dashboard-websocket-server.ts:106 | WS registerClient 无认证/鉴权——违反§11.7 要求 authenticated principal       |
| 2575 | P1     | src/interaction/dashboard/dashboard-websocket-server.ts:208 | pushDelta 按 metric 匹配但 subscriber 按 dashboardId 注册——永远匹配不到     |
| 2576 | P1     | src/interaction/dashboard/index.ts:402                      | attentionQueue 按 createdAt 升序(最旧在前)——应按紧急度排序                  |
| 2577 | P1     | src/interaction/dashboard/dashboard-websocket-server.ts:330 | heartbeat 超时标 isConnected=false 但不清理 Map——幽灵连接内存泄漏           |
| 2578 | P2     | src/interaction/autonomy/autonomy-audit-service.ts:39       | audit id 用递增序号——多实例重复 id                                          |
| 2579 | P2     | src/interaction/autonomy/historical-metrics-provider.ts:49  | SQL 未按 capabilityId 过滤——返回 agent 级非 capability 级 metrics           |
| 2580 | P2     | src/interaction/autonomy/historical-metrics-provider.ts:64  | error_code!=null 算 incident——不等于真正 incident                           |
| 2581 | P2     | src/interaction/ux/conversation-history-service.ts:121      | memoryLayer!=="layer_3" 才持久化，默认 "layer_3"——条件矛盾永不持久化        |
| 2582 | P2     | src/interaction/ux/conversation-history-service.ts:199      | recall 不过滤 tenantId——跨租户会话泄露                                      |
| 2583 | P2     | src/interaction/dashboard/index.ts:183                      | successRate 分母含 pending/in_progress——导致 rate 偏低                      |
| 2584 | P2     | src/interaction/ux/ux-event-tracking-service.ts:162         | abTestAssignments 以 userId 为 key——多并行 A/B test 互相覆盖                |

### §216 Scale-Ecosystem 深层缺陷（Tenant / Marketplace / SLA / Multi-Region）

| #    | 严重度 | 文件                                                                  | 问题                                                                         |
| ---- | ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2585 | P0     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:267    | addWorkspaceMembership 未验证调用者权限——任意用户可向任意 workspace 添加成员 |
| 2586 | P0     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:342    | addOrganizationMembership 无鉴权——任意用户可自添 admin 角色，权限提升        |
| 2587 | P0     | src/scale-ecosystem/tenant-platform/data-plane-flow-service.ts:611    | scope tenantId/orgId=null 时跳过边界检查——可绕过租户隔离                     |
| 2588 | P1     | src/scale-ecosystem/marketplace/pack-security-service.ts:202          | runStaticAnalysis 仅正则扫描 sourceUri 字符串——实际源代码未扫描              |
| 2589 | P1     | src/scale-ecosystem/marketplace/pack-security-service.ts:238          | 危险 capability ≤3 不告警——检测阈值过高                                      |
| 2590 | P1     | src/scale-ecosystem/sla-engine/sla-operations-service.ts:84           | 缺 maxExecutionTimeoutRate/minDependencyAvailability——SLA 违约检测不完整     |
| 2591 | P1     | src/scale-ecosystem/sla-engine/sla-operations-service.ts:111          | preemptionCapApplied 条件恒 true——标志无法正确判断                           |
| 2592 | P1     | src/scale-ecosystem/multi-region/cdc-replication-service.ts:98        | checkpoint/queue 纯内存——重启后复制进度丢失，违反 RPO                        |
| 2593 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:170         | eventId = Date.now()+Math.random()——高并发 ID 冲突                           |
| 2594 | P1     | src/scale-ecosystem/multi-region/data-replicator/index.ts:244         | flush checkpoint sequence 为局部计数器——重启归零致重复消费                   |
| 2595 | P1     | src/scale-ecosystem/multi-region/cdc-replication-service.ts:209       | recordFailure 仅记日志无 retry 入队——失败 batch 静默丢弃                     |
| 2596 | P1     | src/scale-ecosystem/multi-region/region-health-check-service.ts:347   | degraded 不重置 consecutiveFailures——恢复后仍累积旧计数触发误 failover       |
| 2597 | P1     | src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:312    | createOrganization 校验条件恒 false——校验被绕过                              |
| 2598 | P1     | src/scale-ecosystem/marketplace/marketplace-governance-service.ts:501 | reviewRequired=0 的 internal 包也必须有 review——与文档矛盾                   |
| 2599 | P2     | src/scale-ecosystem/marketplace/marketplace-governance-service.ts:590 | revokePublication 未检查当前 status——已 revoked 可重复 revoke                |
| 2600 | P2     | src/scale-ecosystem/marketplace/certification/index.ts:12             | 不检查 approvedAt 存在——status=approved 但 approvedAt=null 视为已认证        |
| 2601 | P2     | src/scale-ecosystem/marketplace/publisher/index.ts:16                 | reputationScore>=0.4 硬编码——sandboxed publisher 也可发布                    |
| 2602 | P2     | src/scale-ecosystem/marketplace/catalog/index.ts:63                   | validateListingDependencies 无循环检测——循环依赖致安装无限递归               |
| 2603 | P2     | src/scale-ecosystem/multi-region/region-health-check-service.ts:240   | checkAllRegions 串行 await——大量 region 延迟线性增长                         |
| 2604 | P2     | src/scale-ecosystem/multi-region/failover-controller/index.ts:36      | failover 取 candidateRegionIds[0]——未考虑健康状态和复制 lag                  |
