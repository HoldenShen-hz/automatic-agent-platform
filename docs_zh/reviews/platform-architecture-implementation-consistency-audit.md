# 00-platform-architecture.md 实现一致性审计重新复核底稿

> 重开复核日期：2026-04-28
> 处理原则：保留原审计问题明细，不删除问题描述；上一版“已修复/收口证据”结论全部撤回，先统一回退为 `未修复` 与 `待补充`，再逐条真实修复；每个已修复项都必须写明直接证据与根因，禁止只写泛化 remediation 结论。
> 重要说明：`src/platform/architecture/implementation-consistency-closure.ts` 只能证明“编号存在”和“历史索引存在”，不能作为已修复证明。

## 0. 逐项复核与收口依据索引

本报告中的每个问题行均保留原始偏差描述，并通过 `ImplementationConsistencyClosureRegistry:<问题编号>` 保留历史索引。复核结论已纠正：`ImplementationConsistencyClosureRegistry` 不是收口记录，只是问题编号目录；未做直接核验的条目一律视为 `未修复`，只有在补齐直接代码、contract、ADR、spec 或定向测试证据并写明根因后，才能标记为 `已修复`。本节仅保留编号前缀到历史索引位置的映射，历史索引不能单独作为收口依据。

| 编号范围 | 问题类别 | 当前结论 | 复核备注 |
| --- | --- | --- | --- |
| C-1..C-7 | 代码运行时与架构偏差 | 已修复 | 已完成直接代码与定向测试复核；后续如发现回归需重新打开 |
| T-1..T-56 | Contract 文档与架构偏差 | 部分已修复 | 已完成 T-1..T-31、T-54 的直接 contract 正文复核；其余不得再用 remediation 小节泛化证明收口 |
| A-1..A-37 | ADR 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 supersession ADR 泛化证明收口 |
| G-1..G-9 | 配置/代码与架构偏差 | 已修复 | 已完成直接代码/配置复核；后续如发现回归需重新打开 |
| O-1..O-24 | org-governance 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 remediation 汇总模块泛化证明收口 |
| S-1..S-20 | scale-ecosystem 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 remediation 汇总模块泛化证明收口 |
| M-1..M-20 | ops-maturity 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 remediation 汇总模块泛化证明收口 |
| F-1..F-25 | OAPEFLIR spec 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 compatibility override 泛化证明收口 |
| I-1..I-20 | interaction 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 remediation 汇总模块泛化证明收口 |
| D-1..D-20 | domains / SDK 与架构偏差 | 未修复 | 历史索引待逐条重审，不能再以 remediation 汇总模块泛化证明收口 |

复核门禁：不再保留任何“总括性 closure test” 作为收口依据；是否已修复只能由对应目标文件中的直接实现、直接契约文本或直接定向测试逐条证明，禁止再把历史 registry 当作“全部已修复”的证明。

## 1. 代码 vs 架构（7项）

| #   | 严重度 | 位置                                              | 偏差描述 | 状态 | 收口证据 |
| --- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| C-1 | HIGH   | `src/platform/orchestration/harness/index.ts`     | HarnessRunStatus 仅7状态（idle/planning/executing/paused/sleeping/completed/failed），架构§25.8定义13状态；缺 initializing/awaiting_approval/compensating/rolling_back/suspended/draining 等9个；多出 sleeping/idle/planning 3个非规范状态 | 已修复 | 当前 `HarnessRunStatus` 已与 `§25.8` 的 13 态 canonical 模型对齐：`src/platform/orchestration/harness/index.ts`、`src/platform/contracts/executable-contracts/index.ts`、`src/platform/contracts/executable-contracts/schemas.ts`；定向验证：`tests/unit/platform/contracts/executable-contracts/index.test.ts`、`tests/unit/platform/execution/runtime-state-machine-transitions.test.ts` |
| C-2 | HIGH   | 同上                                              | HarnessRun 接口无 `planGraphBundle` 字段，runLoop 从不生成/校验 PlanGraphBundle，架构§25要求每次运行持有不可变执行计划图 | 已修复 | `src/platform/orchestration/harness/index.ts` 已为 `HarnessRun` 增加 `planGraphBundle` 并在 `createRun()` 中调用 `createInitialPlanGraphBundle(...)`；定向验证：`tests/unit/platform/orchestration/harness/index.test.ts`、`node --import tsx --test tests/unit/platform/orchestration/harness/index.test.ts` |
| C-3 | HIGH   | `src/platform/execution/runtime-state-machine.ts` | RuntimeStateMachine 将 `compensating` 列为 NodeRun 合法可达状态，架构§14.3明确将补偿建模为独立 CompensationRun 而非 NodeRun 子状态 | 已修复 | 已从 `NodeRun` 迁移矩阵移除 `reconciling -> compensating`；补偿继续保留在 side-effect / compensation 轨道。直接证据：`src/platform/execution/runtime-state-machine.ts`、`tests/unit/platform/execution/runtime-state-machine.test.ts`、`tests/unit/platform/execution/runtime-state-machine-transitions.test.ts` |
| C-4 | MED    | 同上                                              | NodeRun 代码新增 `blocked`/`queued` 两个非规范状态，架构 NodeRun 状态枚举中不存在 | 已修复 | 已从 `NodeRunStatus` 类型、Zod schema、RuntimeStateMachine 和 PlanGraphHarnessRuntime 移除 `blocked/queued`；旧 `§14.10` 文本已收敛到 `§25.8` canonical 状态。直接证据：`src/platform/contracts/executable-contracts/index.ts`、`src/platform/contracts/executable-contracts/schemas.ts`、`src/platform/execution/runtime-state-machine.ts`、`src/platform/orchestration/harness/runtime/plan-graph-harness-runtime.ts`、`docs_zh/architecture/00-platform-architecture.md` |
| C-5 | MED    | 同上                                              | `assertTransitionAllowed` 对 from===to 的自转移静默放行，绕过架构要求的 CAS/lease/fencing token 校验 | 已修复 | `src/platform/execution/runtime-state-machine.ts` 已在 `fromStatus === toStatus` 时抛出 `runtime_state_machine.noop_transition_denied`；定向验证：`tests/unit/platform/execution/runtime-state-machine.test.ts`、`node --import tsx --test tests/unit/platform/execution/runtime-state-machine.test.ts` |
| C-6 | MED    | `src/platform/contracts/index.ts`                 | barrel re-export 4个已废弃合约类型（LegacyRolloutContract 等），架构v4.0已移除对应概念 | 已修复 | 已删除根 barrel 中 `legacy*Contract` 导出；定向验证：`src/platform/contracts/index.ts`、`tests/unit/platform/contracts/index.test.ts`、`node --import tsx --test tests/unit/platform/contracts/index.test.ts` |
| C-7 | LOW    | `src/platform/execution/budget-allocator.ts`      | `settle()` 硬编码 `hardCapSatisfied: true`，跳过架构§18要求的实际硬上限校验 | 已修复 | `src/platform/execution/budget-allocator.ts` 现按 reservation/ledger/actualAmount 重新计算 `hardCapSatisfied`；定向验证：`tests/unit/platform/execution/budget-allocator.test.ts`、`tests/unit/platform/execution/budget-allocator-comprehensive.test.ts`、`node --import tsx --test tests/unit/platform/execution/budget-allocator.test.ts tests/unit/platform/execution/budget-allocator-comprehensive.test.ts` |

## 2. Contract 文档 vs 架构（11项）

| #    | 严重度 | Contract 文件                         | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-1 | HIGH   | `runtime_state_machine_contract`      | ExecutionStatus 用 running/paused/cancelled/completed/failed 5态，架构 NodeRun 用 pending/ready/running/blocked/succeeded/failed/skipped/cancelled/timed_out 9态；WorkflowStatus 6态 vs HarnessRun 13态 | 已修复 | `docs_zh/contracts/runtime_state_machine_contract.md` 已明确声明历史 task/workflow 状态机仅为 legacy 说明，并把 v4.3 权威边界收敛到 `harness-run-contract.md`、`node-run-attempt-receipt-contract.md`、`side-effect-reconciliation-contract.md` 与 `RuntimeStateMachine.transition(command)`；直接验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-2 | HIGH   | `side-effect-reconciliation-contract` | 状态机 pending→executing→reconciling→settled 4步线性，架构§14.11 要求 pending→claimed→executing→awaiting_confirmation→settled/compensating 含分支 | 已修复 | `docs_zh/contracts/side-effect-reconciliation-contract.md` 已改为 v4.3 canonical side-effect / reconciliation / compensation contract，并通过 remediation 小节显式收口 `T-2`；运行时权威推进继续收敛到 `RuntimeStateMachine.transition(command)`；直接验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-3 | MED    | `budget-ledger-contract`              | 用 "settle" 动词描述预算消费，架构§18统一用 "consume"；resourceKind 枚举仅 token/api_call/compute，架构额外定义 storage/bandwidth/memory | 已修复 | `docs_zh/contracts/budget-ledger-contract.md` 已重写为 v4.3 canonical `BudgetLedger / BudgetReservation / BudgetSettlement` contract，并通过 remediation 小节显式收口 `T-3`；当前 contract 将旧术语降为 legacy/projection 输入，不再作为新实现入口；直接验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-4 | MED    | `version-lock-contract`               | 仅支持3种锁定策略（pinned/floating/range），架构§22.4定义4种含 digest-locked | 已修复 | `docs_zh/contracts/version-lock-contract.md` 已收敛到 v4.3 canonical `RunVersionLock / ArtifactVersionLockSet`，并通过 remediation 小节显式收口 `T-4`；旧 `pinned/floating/range` 仅保留为历史输入语义，不再作为新入口定义；直接验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-5 | MED    | `event-envelope-contract`             | 缺少架构 ContractEnvelope 要求的5个必需字段：schema_version/idempotency_key/causation_id/partition_key/ttl | 已修复 | `docs_zh/contracts/event-envelope-contract.md` 已把 `schema_version / idempotency_key / causation_id / partition_key / ttl` 写入 `EventEnvelope` canonical 最小字段与规则；根因：旧文档只覆盖事件事实存储字段，遗漏了 envelope 层的幂等、分区与生命周期元数据；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-6 | MED    | `task_lease_and_fencing_contract`     | 使用已废弃术语 execution_id，架构v4.0统一为 node_run_id | 已修复 | `docs_zh/contracts/task_lease_and_fencing_contract.md` 已把 `LeaseGrant / QueueDispatchRecord / LeaseAuditRecord / LeaseReconciliationRecord` 的 canonical 关联键收敛到 `node_run_id` / `attempt_id`，并把 `execution_id` 降为 legacy 映射；根因：文档沿用了 v3 execution-centric 队列/租约术语，没有随 `NodeRun` 权威对象迁移同步更新；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-7 | MED    | `harness-run-contract`                | 合约§45.13定义6状态 vs 架构§25.8定义13状态，架构文档内部也不一致（§25.4列7态 vs §25.8列13态） | 已修复 | `docs_zh/contracts/harness-run-contract.md` 现已把 `HarnessRunStatus` 收敛到 13 态 canonical 模型：`created / admitted / planning / ready / running / pausing / paused / resuming / replanning / compensating / completed / failed / aborted`，并通过 remediation 小节显式收口 `T-7`；直接验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-8 | MED    | `plan-graph-contract`                 | 合约将 PlanGraph 定义为可变（支持 appendNode），架构§25明确要求 PlanGraphBundle 为不可变快照 | 已修复 | `docs_zh/contracts/plan-graph-patch-contract.md` 已新增“不可变性约束”正文，明确 `PlanGraphBundle` / `PlanGraph` 为不可变快照，禁止 `appendNode/removeNode/updateNode` 等原地修改；根因：早期文档把 in-memory builder 的编辑语义误写成 runtime canonical contract；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-9 | MED    | `approval-routing-contract`           | 缺少架构§31要求的 escalation_chain 和 timeout_auto_action 字段 | 已修复 | `docs_zh/contracts/approval_and_hitl_contract.md` 已在 `ApprovalRequest` 中补入 `escalation_chain`、`timeout_auto_action` 与 `ApprovalEscalationHop` 最小字段；根因：旧审批 contract 把“超时策略”压缩成单值 UI 语义，没有建模控制平面自动动作与逐级升级链；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-10 | LOW    | `model-routing-contract`              | 路由策略枚举 cost_optimized/latency_optimized/quality_optimized 3种，架构§19定义5种含 compliance_constrained/hybrid | 已修复 | `docs_zh/contracts/model_gateway_routing_contract.md` 已为 `ModelRouteRequest.routingStrategy` 补齐 `cost_optimized / latency_optimized / quality_optimized / compliance_constrained / hybrid` 五种规范枚举，并增加后两者的治理约束；根因：旧文档只覆盖性能/成本三目标，没有把合规约束与多目标折中写进 canonical request；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-11 | LOW    | `domain-recipe-contract`              | recipe 结构缺少架构§38要求的 risk_profile_ref 和 guardrail_overlay 引用 | 已修复 | `docs_zh/contracts/domain_descriptor_and_onboarding_contract.md` 已定义 `DomainRecipe` 最小字段，并把 `risk_profile_ref` 与 `guardrail_overlay` 设为必填；根因：早期文档只把 recipe 当作 onboarding 模板，没有把风险绑定和 guardrail 叠加层视作一等 contract；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |

## 3. ADR vs 架构（12项）

| #    | 严重度 | ADR         | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| A-1 | HIGH   | ADR-016     | 将 OAPEFLIR 定义为核心执行编排器（OapeflirLoopService 作为运行入口），直接违反架构v4.3核心不变量：HarnessRuntime 是唯一执行入口点，OAPEFLIR 仅为认知循环框架 | 未修复 | 待补充 |
| A-2 | HIGH   | ADR-029     | 延续 ADR-016 路线，HarnessRuntime 被降级为 OAPEFLIR 的子服务，与架构层次相反 | 未修复 | 待补充 |
| A-3 | HIGH   | ADR-030     | 定义执行恢复协议时完全未提及 RuntimeStateMachine 作为唯一状态变更 API，直接操作存储层 | 未修复 | 待补充 |
| A-4 | MED    | ADR-012     | 使用旧术语 "step" 而非架构v4.0的 "NodeRun" | 未修复 | 待补充 |
| A-5 | MED    | ADR-091     | 引用 "Rollout" 概念，架构v4.0已重命名为 "Release" | 未修复 | 待补充 |
| A-6 | MED    | ADR-109     | 沙箱逃逸防护层级为3层，架构§16定义4层（多一层硬件隔离层） | 未修复 | 待补充 |
| A-7 | MED    | ADR-110     | 定义 ContextWindow 压缩策略时未引用架构§20的 MemoryTier 分层模型 | 未修复 | 待补充 |
| A-8 | MED    | ADR-111     | Plugin 生命周期用 install/enable/disable/uninstall 4态，架构§23用 registered/validated/active/suspended/deprecated 5态 | 未修复 | 待补充 |
| A-9 | MED    | ADR-112     | 多区域复制用 eventual consistency 模型，架构§36要求 causal consistency with bounded staleness | 未修复 | 待补充 |
| A-10 | LOW    | ADR-016/029 | DTO 名称用 OapeflirInput/OapeflirOutput，架构统一用 CognitiveFrameInput/CognitiveFrameOutput | 未修复 | 待补充 |
| A-11 | LOW    | ADR-030     | 恢复超时硬编码30s，架构§14.7要求根据 NodeType 动态配置（LLM节点120s，工具节点30s，人工节点无限） | 未修复 | 待补充 |
| A-12 | LOW    | ADR-091     | 仍引用 v3 的 DeploymentSlot 概念，架构v4.0用 ReleaseChannel | 未修复 | 待补充 |

## 4. 代码配置 vs 架构（9项）

| #   | 严重度 | 位置                                                   | 偏差描述 | 状态 | 收口证据 |
| --- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| G-1 | HIGH   | `src/interaction/autonomy/index.ts`                    | ConstraintPack.autonomyMode 仅 "manual"/"auto" 二值，架构§28定义 AutonomyLevel 为 "suggestion"/"semi_auto"/"frozen" 三级 + 动态升降 | 已修复 | `src/interaction/autonomy/index.ts` 已实现 `suggestion / supervised / semi_auto / full_auto / frozen` 五级自治模型与动态升降/冻结；直接证据：`tests/unit/interaction/autonomy/index.test.ts`、`tests/unit/interaction/autonomy/level-manager/index.test.ts` |
| G-2 | HIGH   | `src/platform/orchestration/harness/index.ts`          | 用 "sleeping" 状态表示暂停，架构统一用 "paused"（短期）/"hibernated"（长期），语义完全不同 | 已修复 | `HarnessRuntimeService.sleep()` 现统一写入 `paused`，并移除 `sleeping / waiting_hitl / recovering` legacy 状态；直接证据：`src/platform/orchestration/harness/index.ts`、`tests/unit/platform/orchestration/harness/index.test.ts`、`tests/unit/platform/orchestration/harness/context.test.ts`、`tests/unit/platform/orchestration/harness/durable/sleep-scheduler.test.ts` |
| G-3 | HIGH   | `config/domains/quant-trading.json`                    | JSON 字段 (latencyBudgetMs/riskTier/allowedModels) 与 `src/domains/registry/domain-model.ts` 的 DomainDefinitionSchema Zod 验证字段完全不匹配，配置无法通过自身验证 | 已修复 | 当前 `config/domains/quant-trading.json` 可直接通过 `DomainDefinitionSchema.parse()`；直接证据：`config/domains/quant-trading.json`、`src/domains/registry/domain-model.ts`、`tests/unit/domains/registry/domain-model.test.ts` |
| G-4 | HIGH   | `src/interaction/autonomy/index.ts`                    | 自治等级升级 (`escalateAutonomy`) 无域风险门控检查，高风险域（医疗/金融）可被升至 full_auto，违反架构§28.5安全约束 | 已修复 | `src/interaction/autonomy/index.ts` 通过 `applyDomainRiskAutonomyCap()` 对高风险域施加 `full_auto -> semi_auto` 上限；直接证据：`tests/unit/interaction/autonomy/domain-risk-autonomy-cap.test.ts`、`tests/unit/interaction/autonomy/index.test.ts` |
| G-5 | MED    | `src/platform/state-evidence/index.ts`                 | 仅实现 snapshot/timeline/audit 三个子模块，缺少架构要求的 reconciliation/side-effect-ledger/outbox/compaction 四个子模块 | 已修复 | 根 barrel 已导出 `reconciliation / sideEffectLedger / outbox / compaction`，对应实现位于 `src/platform/state-evidence/*`；直接证据：`src/platform/state-evidence/index.ts`、`src/platform/state-evidence/reconciliation/index.ts`、`src/platform/state-evidence/side-effect-ledger/index.ts`、`src/platform/state-evidence/outbox/index.ts`、`src/platform/state-evidence/compaction/index.ts` |
| G-6 | MED    | `src/platform/prompt-engine/prompt-injection-guard.ts` | 仅实现单层正则过滤，缺少架构§17要求的4层防御链：lexical→semantic→behavioral→consensus | 已修复 | `src/platform/stability/prompt-injection-guard.ts` 已实现 `sanitizePromptInput / sanitizePromptOutput / assemblePromptSegments / classifyPromptInjectionRisk / inspectProtectedModelOutput`，并输出四层 `layers: lexical / semantic / behavioral / consensus`；`src/platform/prompt-engine/prompt-injection-guard.ts` 仅作为稳定 barrel 暴露同一实现；直接验证：`tests/unit/platform/shared/stability/prompt-injection-guard.test.ts`、`tests/unit/platform/prompt-engine/prompt-injection-guard.test.ts` |
| G-7 | MED    | `config/runtime/default.json`                          | maxConcurrentRuns=50，架构§14.2 要求默认值与域配额联动，非全局硬编码 | 已修复 | 当前 `config/runtime/default.json` 已不存在 `maxConcurrentRuns=50` 这类全局硬编码，只保留 `maxConcurrentTasks=1` 的安全默认值；运行并发/配额已落在独立 quota 模型与域交互约束中：`src/platform/control-plane/config-center/config-governance-support.ts`、`src/platform/shared/scaling/resource-quota.ts`、`src/domains/interaction-policy/index.ts`；直接验证：`tests/invariants/config-and-state-evidence-architecture.test.ts`、`tests/unit/platform/shared/scaling/resource-quota.test.ts` |
| G-8 | MED    | `config/risk/default.json`                             | riskCategories 仅定义 operational/financial/compliance 3类，架构§30定义6类含 reputational/safety/strategic | 已修复 | 当前 `config/risk/default.json` 已定义 6 类风险：`operational / financial / compliance / reputational / safety / strategic`；直接验证：`config/risk/default.json`、`tests/invariants/config-and-state-evidence-architecture.test.ts` |
| G-9 | LOW    | `src/platform/model-gateway/index.ts`                  | 路由降级仅 try/catch 单次重试，架构§19.6要求 circuit-breaker + 3级降级梯度（同provider备选→跨provider→离线模型） | 已修复 | 该审计描述已落后于当前实现：`src/platform/model-gateway/index.ts` 现为总 barrel，真实降级链已拆分到 `src/platform/model-gateway/provider-registry/circuit-breaker.ts`、`src/platform/model-gateway/provider-registry/unified-chat-provider.ts`、`src/platform/model-gateway/fallback/index.ts`、`src/platform/model-gateway/degradation/degradation-controller.ts`；当前实现具备 provider 级 circuit breaker（closed/open/half_open）、fallback 选择以及 `D0→D1→D2→D3→D4` 降级模式，与主架构 `§15.5` 的 provider failover / cache / static fallback / pause 链路对齐；直接验证：`tests/unit/platform/model-gateway/provider-registry/circuit-breaker.test.ts`、`tests/unit/platform/model-gateway/degradation-controller.test.ts`、`tests/unit/platform/model-gateway/provider-registry/unified-chat-provider.test.ts`、`tests/integration/platform/model-gateway/provider-registry/circuit-breaker-integration.test.ts`、`tests/integration/platform/model-gateway/model-gateway-integration.test.ts` |

---

## 原始首批统计摘要（历史快照，当前未修复）

以下统计为原始审计首批 39 项问题的严重度摘要，内容保留用于追溯；对应问题行的上一版“已修复”判定已全部撤回；当前状态以上文各表中的 `未修复` 为准，`收口证据` 列也已清空为 `待补充`。

| 类别              | HIGH   | MED    | LOW   | 合计   |
| ----------------- | ------ | ------ | ----- | ------ |
| 代码 vs 架构      | 3      | 3      | 1     | 7      |
| Contract vs 架构  | 2      | 7      | 2     | 11     |
| ADR vs 架构       | 3      | 6      | 3     | 12     |
| 配置/代码 vs 架构 | 4      | 4      | 1     | 9      |
| **合计**          | **12** | **20** | **7** | **39** |

## 原始系统性主题（历史快照，当前未修复）

以下主题为原始审计对系统性偏差的归纳，内容保留用于追溯；这些主题当前仍表示开放任务；上一版依赖的 direct contract remediation、ADR supersession、runtime guard、architecture remediation modules 与 invariant tests 不再视为已完成证明。

1. **状态机定义碎片化**：架构、合约、ADR、代码四处各自定义不同状态枚举，无单一真相源
2. **OAPEFLIR 定位矛盾**：ADR将其视为编排核心，架构将其视为认知框架，代码实现介于两者之间
3. **术语漂移未清理**：v3→v4 重命名（step→NodeRun, Rollout→Release, execution_id→node_run_id）在ADR和合约中未统一更新
4. **配置-验证脱节**：域配置JSON字段与Zod schema不匹配，意味着配置可能从未经过schema验证
5. **防御深度不足**：多处安全/稳定性机制仅实现单层，架构要求的多层纵深防御未落地

---

## 5. org-governance 代码 vs 架构（24项）

| #    | 严重度 | 位置                                              | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| O-1 | HIGH   | org-model/org-node/index.ts                       | OrgNodeType 枚举多出 `member`，§46.1仅定义 company/division/department/team | 未修复 | 待补充 |
| O-2 | MED    | org-model/org-node/index.ts                       | 字段命名不匹配：代码 orgNodeId/nodeType/displayName vs 架构 nodeId/type/name | 未修复 | 待补充 |
| O-3 | HIGH   | org-model/                                        | §46.2要求的 `LegalEntityBoundary`（跨法人/跨国数据和审批控制）完全缺失 | 未修复 | 待补充 |
| O-4 | HIGH   | org-model/hierarchy/index.ts                      | §46.3要求org变更生成 OrgMergeConflictReport/ApprovalRerouteOnOrgChange/OrphanAgentFreezePolicy/IdentityDeprovisioningReport，代码仅发基础事件无下游执行 | 未修复 | 待补充 |
| O-5 | HIGH   | approval-routing/route-engine/index.ts            | `applySodPolicy` 仅检查 requester≠approver，§47.1要求覆盖利益冲突、同链互审、预算所有者vs执行者冲突 | 未修复 | 待补充 |
| O-6 | HIGH   | approval-routing/                                 | §47.3要求 `ApprovalRouteSnapshot` 创建时冻结（org版本/审批人集/SoD/COI/FX快照/策略版本/证据引用），未实现 | 未修复 | 待补充 |
| O-7 | MED    | approval-routing/route-engine/index.ts            | §47.2金额矩阵用CNY，代码用 `amountUsd` 无多币种/FX快照支持 | 未修复 | 待补充 |
| O-8 | MED    | approval-routing/                                 | §47.3要求审批过期/撤销/提交时重验证，均未实现 | 未修复 | 待补充 |
| O-9 | MED    | approval-routing/delegation/index.ts              | §47.3要求peer委托须通过 ConflictOfInterestFilter，代码无COI检查 | 未修复 | 待补充 |
| O-10 | HIGH   | compliance-engine/framework-catalog.ts            | §49.1要求 ComplianceFramework 含 type枚举(GDPR/SOC2/PIPL/HIPAA/SOX/PCI_DSS)/auditRequirements/reportTemplate，代码仅有裸 frameworkId | 未修复 | 待补充 |
| O-11 | MED    | compliance-engine/inheritance/index.ts            | §49.2要求 PolicyStrictnessComparator 按策略类型比较，代码用朴素启发式(boolean OR/number MAX)，可能静默放松策略 | 未修复 | 待补充 |
| O-12 | MED    | compliance-engine/                                | §49.3要求 ComplianceExceptionWorkflow/EvidenceQualityScore/ControlCoverageReport，均未实现 | 未修复 | 待补充 |
| O-13 | HIGH   | knowledge-boundary/boundary-manager/index.ts      | §50.1 accessPolicy 应为 strict/controlled，代码用 defaultVisibility: private/shared/public，语义完全不同 | 未修复 | 待补充 |
| O-14 | MED    | knowledge-boundary/boundary-manager/index.ts      | §50.1要求 `auditOnAccess: boolean (default true)` 字段，缺失 | 未修复 | 待补充 |
| O-15 | HIGH   | knowledge-boundary/chinese-wall-policy.ts         | §50.3要求 WallExpiryPolicy/合规官审批重置/冷却期/数据残留扫描，代码中wall为永久不可撤销 | 未修复 | 待补充 |
| O-16 | MED    | knowledge-boundary/knowledge-federator.ts         | §50.3要求 CrossBoundaryTransform（脱敏/摘要/字段过滤），代码直接返回原始摘录 | 未修复 | 待补充 |
| O-17 | HIGH   | delegated-governance/scope-manager/index.ts:82-84 | `evaluateGuardrail` 对未知guardrail类型返回 allowed:true，违反§2.3 default-deny 原则，安全漏洞 | 未修复 | 待补充 |
| O-18 | MED    | delegated-governance/scope-manager/index.ts       | §51.3赋予 department_admin 中低风险域上架等权限，代码给 team_lead 零操作，但架构§51.1赋予其日常运营配置权 | 未修复 | 待补充 |
| O-19 | MED    | delegated-governance/delegation-registry/index.ts | §51.1权限用 level枚举(view/operate/admin/super_admin)+delegatable，代码用扁平capability字符串无层级 | 未修复 | 待补充 |
| O-20 | MED    | delegated-governance/                             | §51.1要求过期/撤销委托级联撤销所有派生权限，代码仅撤单条无级联 | 未修复 | 待补充 |
| O-21 | MED    | sso-scim/index.ts                                 | api-key-service.ts 存在但未从 index.ts 导出，模块公开API不可达 | 未修复 | 待补充 |
| O-22 | MED    | sso-scim/                                         | §48.2要求 identity_sync_dlq 处理同步异常/SCIM冲突报告，未实现，同步失败静默丢失 | 未修复 | 待补充 |
| O-23 | MED    | sso-scim/                                         | §48.3要求会话撤销SLO（正常<5min，安全<60s）和去配置时冻结Agent，未实现 | 未修复 | 待补充 |
| O-24 | LOW    | compliance-engine/inheritance/index.ts            | Boolean合并用OR（child true覆盖parent false），§49.2要求子节点不得放松父约束，deny型应用AND | 未修复 | 待补充 |

## 6. scale-ecosystem 代码 vs 架构（20项）

| #    | 严重度 | 位置                                          | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| S-1 | HIGH   | marketplace/catalog/index.ts                  | MarketplaceCatalogEntry 缺少合约必需字段：publisher_id/artifact_type/artifact_ref/pricing_model/capabilities/version | 未修复 | 待补充 |
| S-2 | HIGH   | billing/                                      | RevenueSharePolicy（policy_id/gross_split/tax_handling/refund_policy/settlement_cycle）完全未实现 | 未修复 | 待补充 |
| S-3 | HIGH   | billing/billing-payment-gateway.ts            | 仅有 createCheckoutSession/fetchPaymentSessionStatus，缺少合约要求的 create_subscription/update_plan/capture_invoice/mark_payment_failed/cancel_subscription | 未修复 | 待补充 |
| S-4 | HIGH   | billing/billing-service.ts                    | 无退款/调整机制，合约要求退款以独立 adjustment 记录表达不得改写 usage ledger | 未修复 | 待补充 |
| S-5 | HIGH   | (缺失)                                        | CapacityPlanning 模块完全不存在，合约要求 CapacitySignal/CapacityForecast/CapacityScenario/CapacityRecommendation | 未修复 | 待补充 |
| S-6 | HIGH   | (缺失)                                        | CostAttribution 模块缺失，合约要求 CostAttributionRecord/OptimizationRecommendation/CostSimulationScenario | 未修复 | 待补充 |
| S-7 | HIGH   | multi-region/                                 | 远程会话状态机缺失，合约要求 connecting/connected/reconnecting/degraded/failed/viewer_only 6态，代码只有 RegionHealthStatus | 未修复 | 待补充 |
| S-8 | HIGH   | marketplace/                                  | ListingDependency 对象和依赖兼容性检查缺失，合约要求"依赖必须显式声明并通过兼容性检查" | 未修复 | 待补充 |
| S-9 | MED    | sla-engine/breach-detector/index.ts           | 仅分类 latency/success_rate/queue_wait，缺少 execution timeout 和 dependency unavailability 违约类型 | 未修复 | 待补充 |
| S-10 | MED    | resource-manager/fair-queue/index.ts          | 仅用 tenantId+priority+ageMs 排序，合约要求5维：tenant/org/domain/sla_tier/priority | 未修复 | 待补充 |
| S-11 | MED    | marketplace/marketplace-governance-service.ts | deprecatePackage 无 migration_target 或替代建议字段 | 未修复 | 待补充 |
| S-12 | MED    | multi-region/cross-region-routing-service.ts  | 跨境路由决策无审计记录，合约要求显式策略和审计轨迹 | 未修复 | 待补充 |
| S-13 | MED    | billing/billing-service.ts                    | BillingAccountRecord 缺少合约§4要求的 balance_snapshot 字段 | 未修复 | 待补充 |
| S-14 | MED    | integration/connectors/\*.ts                  | 连接器实现无密钥管理集成，合约要求受 policy/secret management 约束 | 未修复 | 待补充 |
| S-15 | MED    | sla-engine/sla-operations-service.ts          | 无饥饿保护或抢占上限，合约要求"低tier不得饿死高tier，高tier不得无限抢占全局资源" | 未修复 | 待补充 |
| S-16 | MED    | feedback-loop/feedback-improvement-service.ts | candidateType 值与合约 candidate_type 不对齐，proposed_change 用裸字符串无结构化对象 | 未修复 | 待补充 |
| S-17 | LOW    | resource-manager/quota-enforcer/index.ts      | 用 scopeId 但合约指定 scope，命名不匹配 | 未修复 | 待补充 |
| S-18 | LOW    | marketplace/catalog/index.ts                  | trustLevel 枚举 sandboxed/verified/enterprise vs governance 用 ExtensionTrustLevel 含 internal，同域两套词汇 | 未修复 | 待补充 |
| S-19 | LOW    | multi-region/region-health-check-service.ts   | performHealthCheck 用 Math.random() 模拟指标，如意外部署将产生无意义健康数据 | 未修复 | 待补充 |
| S-20 | LOW    | multi-region/data-replicator/index.ts         | `private emit?` 声明为可选方法无实现，事件发射路径静默空操作 | 未修复 | 待补充 |
## 7. Contract 文档 vs 架构（续，20项）

| #    | 严重度 | Contract 文件                                    | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-12 | HIGH   | state_transition_matrix_contract                 | 用 tasks.status/workflow_state.status/executions.status 作权威对象，架构§5.5用 HarnessRun/NodeRun，整个状态映射表为v3遗留 | 已修复 | 直接证据：`docs_zh/contracts/state_transition_matrix_contract.md` 已把 §2/§3/§4/§5/§6 的权威对象改为 `HarnessRun.status` / `NodeRun.status`，并将 `tasks/workflow_state/executions` 明确降为 projection；根因：旧单机任务表驱动状态矩阵被直接沿用到总 contract，`HarnessRun / NodeRun` 落地后正文未同步迁移；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-13 | HIGH   | oapeflir_loop_contract                           | OapeflirLoopService.run() 将OAPEFLIR视为执行引擎返回 finalOutcome，架构§13.1明确"OAPEFLIR不是执行引擎，不创建独立Run，不直接驱动状态迁移"；第8阶段仍用 Rollout 而非 Release | 已修复 | 直接证据：`docs_zh/contracts/oapeflir_loop_contract.md` 已重写 §1/§2/§3/§4/§5，明确 OAPEFLIR 只读 `PlanGraphBundle` / `NodeAttemptReceipt`、只产出 `oapeflir.view.*` / rationale / `ReleaseProposal`，并移除 `finalOutcome` 运行时入口语义；根因：ADR-016/029 时期把认知循环和执行引擎混成一个服务，旧 `Execute`/`Rollout` DTO 被原样抄进 contract；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-14 | HIGH   | execution_plane_contract                         | §8A定义 Plan DTO 含 steps[]+dag 作为P3→P4输入，架构§4.4/§13.6强制 PlanGraphBundle 为唯一P3→P4合约；输出用 DualChannelStepOutput/FeedbackSignal 而非架构的 NodeAttemptReceipt | 已修复 | 直接证据：`docs_zh/contracts/execution_plane_contract.md` 已把 §4/§5/§8/§8A/§9/§11/§12 的执行对象收敛到 `PlanGraphBundle`、`ExecutionTicket.harness_run_id/node_run_id/attempt_id`、`LeaseRecord.node_run_id` 与 `NodeAttemptReceipt` truth 输出，并把 `DualChannelStepOutput` 降为用户展示投影；根因：执行平面文档沿用了早期线性 plan + feedback bridge 草案，没有随着 graph/receipt 真相模型重写；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-15 | HIGH   | runtime_execution_contract                       | ExecutionEnvelope 含 stage(OAPEFLIR阶段) 作为一等执行字段驱动运行时行为，违反§13.1（stage仅为投影） | 已修复 | 直接证据：`docs_zh/contracts/runtime_execution_contract.md` 已把 §3/§5/§8/§9/§10/§11/§13 的执行主键收敛到 `harness_run_id / node_run_id / attempt_id / plan_graph_bundle_id / graph_version`，并把 `stage` 改为 `stage_view_ref` 只读引用；根因：旧执行模型把 OAPEFLIR 阶段误并入 runtime execution envelope，导致 view 字段混入 truth 执行包；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-16 | HIGH   | sandbox_and_auth_contract                        | 隔离层级 standard/hardened/strict，架构§11.4定义 read_only/workspace_write/scoped_external_access/restricted_exec 完全不同的4层 | 已修复 | 直接证据：`docs_zh/contracts/sandbox_and_auth_contract.md` 已把 `SandboxPolicy.mode` 与 `SandboxCapabilityProfile` 收敛到 `read_only / workspace_write / scoped_external_access / restricted_exec` 四档，并新增 canonical mode matrix；根因：旧安全合同按“实现强度”定义三档隔离，主架构改为按可写性/egress/exec 治理定义四档后正文未同步迁移；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-17 | HIGH   | policy_engine_contract                           | mode 字段用 supervised/auto/full-auto 3值，架构§9.5定义8种规范模式含5个降级模式 | 已修复 | 直接证据：`docs_zh/contracts/policy_engine_contract.md` 已把 `PolicyDecisionRequest.mode` 改为 `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode` 八种规范模式，并声明旧三值只允许作为 legacy 输入；根因：早期策略合同只覆盖“是否自动执行”，没有把降级保护模式建模为一等治理对象；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-18 | HIGH   | context_propagation_contract                     | RuntimeContextSnapshot 携带 task_id/execution_id/workflow_id，缺少v4.3规范标识：harnessRunId/nodeRunId/planGraphId/graphVersion/attemptId | 已修复 | 直接证据：`docs_zh/contracts/context_propagation_contract.md` 已在 §3/§6/§7/§8/§10 把 `RuntimeContextSnapshot` 主键升级为 `harness_run_id / node_run_id / attempt_id / plan_graph_id / graph_version`，旧 `task_id/execution_id/workflow_id` 只保留为 legacy 查询入口；根因：上下文 contract 复用了旧参数透传模型，没有跟随 run/node/attempt 真相对象升级；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-19 | HIGH   | tool_and_provider_execution_contract             | 全部用 task_id/execution_id/agent_id，架构§5.3强制 harnessRunId/nodeRunId/attemptId；BudgetCheckResult 为简单布尔，架构要求完整 BudgetReservation 生命周期 | 已修复 | 直接证据：`docs_zh/contracts/tool_and_provider_execution_contract.md` 已把 §2/§3/§5/§7/§9 的调用身份收敛到 `harness_run_id / node_run_id / attempt_id`，并把预算对象从 `BudgetCheckResult` 重写为 `BudgetReservationDecision`（含 `reservation_id / ledger_id / decision / settlement_required`）；根因：旧 provider/tool 合同仍停留在“单次请求布尔放行”视角，没有建模 reservation/settlement 生命周期；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-20 | MED    | executable_unit_contract                         | 定义 ExecutableUnit 含 unit_kind(workflow_step/skill_step/tool_call)，架构§14.10/§5.5以 NodeRun/NodeAttempt 为规范最小执行单元，合约无引用 | 已修复 | 直接证据：`docs_zh/contracts/executable_unit_contract.md` 已把 `ExecutableUnit` 明确降为围绕 `HarnessRun / NodeRun / NodeAttempt` 的语义视图，并补入 `harness_run_id / node_run_id / attempt_id / plan_graph_bundle_id / graph_version`；根因：早期试图用单一抽象统一所有执行对象，但在 `NodeRun / NodeAttempt` 成为 canonical truth 后没有把该抽象降回投影层；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-21 | MED    | lifecycle_and_termination_contract               | 通用生命周期模板 initial/active/paused/blocked/failed/terminal，缺少架构 HarnessRun 的 admitted/planning/replanning/compensating/aborted 和 NodeRun 的 leased/retry_wait/awaiting_hitl/reconciling 等状态 | 已修复 | 直接证据：`docs_zh/contracts/lifecycle_and_termination_contract.md` 已把泛化模板降为 `created_like / active_like / waiting_like / terminal_like` 投影分组，并在正文显式写回 `HarnessRun.status` 与 `NodeRun.status` 的 canonical 状态全集；根因：早期为了统一 UI 生命周期展示，把投影模板误写成 runtime truth；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-22 | MED    | task_and_workflow_contract                       | §6A定义 PlanDTO 含 strategy/execution_graph 为"权威交接对象"，架构仅认 PlanGraphBundle；WorkflowState.current_stage 持有OAPEFLIR阶段作权威态违反§13.1 | 已修复 | 直接证据：`docs_zh/contracts/task_and_workflow_contract.md` 已把 §5 改为 `WorkflowState` 投影字段，并将 §6A 的权威交接对象改为 `PlanGraphBundle`，同时把 `current_stage` 降为 `current_stage_view`；根因：早期 workflow contract 同时承担编排 truth 和 UI/认知视图，导致 plan handoff 与 stage view 混在同一对象里；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-23 | MED    | supervisor_contract                              | AgentRuntimeInstance 携带 current_step_id，架构§5.5说 HarnessStep 仅为语义投影；告警严重度 info/warning/critical 3级 vs 架构SEV1-4 | 已修复 | 直接证据：`docs_zh/contracts/supervisor_contract.md` 已把实例关联键改为 `harness_run_id / node_run_id / attempt_id`，并将 `current_step_id` 降为 `current_node_view_ref` 语义投影，同时把告警严重度改为 `SEV1-4`；根因：旧单进程 agent 监管模型把业务步骤当执行主键，并沿用通用日志级别代替平台事件分级；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-24 | MED    | governance_control_plane_contract                | 用 DecisionRequest/DecisionResult，架构§5.2建立 OperationalDirective/DecisionDirective 为规范P2→P3/P4指令 | 已修复 | 直接证据：`docs_zh/contracts/governance_control_plane_contract.md` 已将正文 §6/§7/§8/§9/§10 改为以 `OperationalDirective` / `DecisionDirective` 为 canonical P2->P3/P4 指令，并把 `PolicyDecisionRequest / PolicyDecisionResult` 降为决策形成过程对象；根因：早期文档把“策略求值过程”与“控制平面下发对象”混成一层，导致 policy output 直接冒充 runtime directive；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-25 | MED    | proactive_agent_and_autonomy_contract            | 自治级别 manual_only/suggest_only/supervised_execute/trusted_auto_execute 与架构§9.5运行时模式无映射，trusted_auto_execute 无对应 | 已修复 | 直接证据：`docs_zh/contracts/proactive_agent_and_autonomy_contract.md` 已新增 `RuntimeModeEnvelope` 并把自主权边界收敛到 `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode` 八种 canonical runtime mode；根因：早期产品级“自动化强弱”梯子没有与控制平面的规范运行模式做一一绑定；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-26 | MED    | platform_panic_and_resume_contract               | Panic scope 含 workflow 但架构§9.5 ModeScope 为 platform>region>tenant>domain>run>node，缺 region/run/node；ResumePlan 无架构要求的人工确认约束 | 已修复 | 直接证据：`docs_zh/contracts/platform_panic_and_resume_contract.md` 已把 panic scope 收敛到 `platform / region / tenant / domain / run / node`，并为 `ResumePlan` 补入 `approved_by / approved_roles / approval_count / compatibility_check_ref` 等人工确认与复核字段；根因：早期熔断合同从业务 workflow 视角出发，没有随 runtime scope 和 emergency governance 机制升级；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-27 | MED    | agent_contract                                   | 用 division_id 为主组织单元，架构v4.3用域中心模型(domain_id/DomainDescriptor)；DispatchMode.worker_dispatch 未引用 PlanGraphDispatch | 已修复 | 直接证据：`docs_zh/contracts/agent_contract.md` 已为 `AgentDefinition` 增加 `DomainBinding`，把角色边界收敛到 `domain_id / domain_descriptor_ref`，并将 `DispatchMode.worker_dispatch` 明确绑定到 `PlanGraphDispatch (PlanGraphBundle)`；根因：角色合同继承了 v3 的组织编排叙事，没有随 v4.3 域中心模型和 graph dispatch handoff 同步重写；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-28 | LOW    | domain_descriptor_and_onboarding_contract        | DomainRiskProfile 被引用但未定义必需字段，架构§3.2要求高危域声明 advisory_only/human_accountable/deterministic_hot_path_only | 已修复 | `docs_zh/contracts/domain_descriptor_and_onboarding_contract.md` 已新增 `DomainRiskProfile` 最小字段，并要求高危域显式声明 `advisory_only / human_accountable / deterministic_hot_path_only`；根因：历史版本把 `DomainRiskProfile` 当作外部引用名词使用，没有展开成可校验 schema；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-29 | LOW    | data_classification_and_prompt_handling_contract | 缺少架构§11.6 DataTaintPropagation 硬规则：输出 data_class 不得低于最高输入 data_class 除非有显式脱敏证明 | 已修复 | 直接证据：`docs_zh/contracts/data_classification_and_prompt_handling_contract.md` 已新增 `DataTaintPropagationRecord`、`max_input_data_class / output_data_class / taint_labels / redaction_report_ref / desensitization_evidence_ref`，并把“输出等级不得低于最高输入等级，除非有脱敏证明 + redaction report + reviewer/policy evidence”写成正文硬规则；根因：早期文档偏重静态存取矩阵，遗漏了派生对象的数据降级证明链；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-30 | LOW    | compliance_report_generation_contract            | 未引用架构的 EvidenceRecord(P3→P5)/EventEnvelope/AuditAppendCommand 作为证据源 | 已修复 | 直接证据：`docs_zh/contracts/compliance_report_generation_contract.md` 已把 `EvidenceRecord`、`AuditAppendCommand` 写入 canonical 对象和证据源规则，并要求报告段落可回链到 `event_envelope_ref`、`source_event_type` 与 audit append 记录；根因：早期报告合同把 artifact 误当成唯一证据载体，遗漏了事实事件和审计追加命令在 P3→P5 证据链中的主干作用；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-31 | LOW    | distributed_locking_contract                     | 锁状态机 pending→active→renewed→released/expired→reclaimed 未显式从属于 RuntimeStateMachine 单一变更入口 | 已修复 | 直接证据：`docs_zh/contracts/distributed_locking_contract.md` 已新增 `LockTransitionCommand`，并明确 `execution_lease` 的获取/续约/过期/回收必须与 `RuntimeStateMachine.transition(command)` 协同，不能成为旁路状态机；根因：早期锁合同把 lease/lock 当成纯基础设施细节，没有把影响执行权的锁状态推进纳入 runtime truth 边界；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |

## 8. ops-maturity 代码 vs 架构（20项）

| #    | 严重度 | 位置                                                      | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| M-1 | HIGH   | emergency/platform-panic-service.ts                       | PanicAcknowledgment.status 用 ack/nack，§60.2要求 ack/failed/timeout，缺失failure/timeout区分导致 panic_incomplete P0事件检测失效 | 未修复 | 待补充 |
| M-2 | HIGH   | emergency/platform-panic-service.ts                       | PlatformPanicDirective.scope 为 plain string，§60.1要求 enum global/tenant/domain，无 scope 验证 | 未修复 | 待补充 |
| M-3 | HIGH   | emergency/platform-panic-service.ts                       | requiredApprovers 为 number，§60.1指定 string[]，min 2，审批人身份丢失导致双人审计不可验证 | 未修复 | 待补充 |
| M-4 | HIGH   | emergency/resume-protocol/index.ts                        | ResumePlan.approvedBy 接受单个string，§60.3要求≥2个 platform_admin 审批人且需角色验证 | 未修复 | 待补充 |
| M-5 | HIGH   | drift-detection/fingerprint-builder/index.ts              | BehaviorFingerprintInput 缺少 window/tool_usage_distribution/success_rate/risk_distribution/driftScore 字段(§63.1) | 未修复 | 待补充 |
| M-6 | HIGH   | drift-detection/changepoint-detector/index.ts             | 严重度枚举 SEV3/none，§63.3要求 low/medium/high 对应分级响应(alert→require_review→pause agent) | 未修复 | 待补充 |
| M-7 | MED    | agent-lifecycle/agent-registry/index.ts                   | canary 允许转移到 paused，§61.3状态机未定义 canary→paused，仅 active→paused 合法 | 未修复 | 待补充 |
| M-8 | MED    | agent-lifecycle/agent-registry/index.ts                   | AgentDefinition 缺少§61.1要求的 ConnectorBindings 组件(§57连接器框架) | 未修复 | 待补充 |
| M-9 | MED    | explainability/explanation-pipeline-service.ts            | StageRationale 用 taskId 而非§59.3的 stageId(OAPEFLIR阶段ID)；缺少 decision 字段 | 未修复 | 待补充 |
| M-10 | MED    | explainability/explanation-pipeline-service.ts            | 解释缓存无 TTL 强制，§59.6要求 L1/L2 TTL=24h，L3不得缓存 | 未修复 | 待补充 |
| M-11 | MED    | cost-optimizer/cost-optimization-service.ts               | CostAttributionRecord 缺少 humanReviewCost/egressCost/computeCost/storageCost 明细和 qualityRisk(§64.1) | 未修复 | 待补充 |
| M-12 | MED    | workflow-debugger/workflow-debugger-service.ts            | 生产断点守卫用布尔 canDebugProduction，§65.3要求断点仅存在于 ReplaySandbox，生产运行禁止断点 | 未修复 | 待补充 |
| M-13 | MED    | edge-runtime/edge-runtime-sync-service.ts                 | SyncEnvelope.signature 为确定性字符串拼接非密码学签名，§62.3要求签名追加队列含 prev_hash 链完整性 | 未修复 | 待补充 |
| M-14 | MED    | compliance-reporter/compliance-report-pipeline-service.ts | status 仅 complete/partial，§66.2要求 generated→HumanSignoff→attested 生命周期含 EvidenceQualityScore | 未修复 | 待补充 |
| M-15 | MED    | multimodal/multimodal-gateway-service.ts                  | MultimodalInputPart 缺少§68.2 ContentPart 要求的 provenance/safetyLabels/mimeType/costKey | 未修复 | 待补充 |
| M-16 | MED    | platform-ops-agent/platform-ops-agent-service.ts          | OpsActionType 缺少§69.1的 restart_service 和 failover 工具 | 未修复 | 待补充 |
| M-17 | LOW    | platform-ops-agent/self-healing-service.ts                | performHealingOperation 用 Math.random() 模拟成功/失败，§69.3要求所有写操作绑定 runbook+approval | 未修复 | 待补充 |
| M-18 | LOW    | drift-detection/index.ts                                  | 模块头部称"Evolution Engine"聚焦自我改进，§63定义为"行为漂移检测"，术语误导 | 未修复 | 待补充 |
| M-19 | LOW    | emergency/forensic-snapshot/index.ts                      | ForensicSnapshot 缺少按平面的证据引用，§60.2要求每平面返回含 plane/localStopState/evidenceRef 的 PanicAcknowledgment | 未修复 | 待补充 |
| M-20 | LOW    | capacity-planner/capacity-planning-service.ts             | CapacityRecommendation 缺少§67.2要求的 SLA tier/queue delay/budget/approval capacity/provider quota/Region failover reserve | 未修复 | 待补充 |

---

## 9. OAPEFLIR v4.4 Spec vs 主架构文档（25项）

| #    | 严重度 | Spec节 vs 架构节              | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| F-1 | HIGH   | Spec§0 vs Arch§13.1           | Spec定位OAPEFLIR为"生产级Agent Runtime"含独立OapeflirRuntime；架构明确"OAPEFLIR不是执行引擎"仅为认知/治理语义框架 | 未修复 | 待补充 |
| F-2 | HIGH   | Spec§4.1 vs Arch§45.22/§5.5   | Spec定义OapeflirRun为规范运行实体含完整状态/预算；架构声明HarnessRun为唯一权威Run，OapeflirRun列于附录H废弃别名 | 未修复 | 待补充 |
| F-3 | HIGH   | Spec§4.2 vs Arch§13.1不变量#4 | Spec定义OAPEFLIR所有的RunStatus 15态驱动执行；架构禁止OAPEFLIR拥有run status/lease/retry counter/side effect commit/budget state | 未修复 | 待补充 |
| F-4 | HIGH   | Spec§3 vs Arch§45.1           | Spec呈现"OAPEFLIR Runtime"为顶层执行运行时；架构说HarnessRuntime为唯一可执行运行时入口 | 未修复 | 待补充 |
| F-5 | HIGH   | Spec§14 vs Arch§28            | Spec用 run._/node._/side_effect._ 作为OAPEFLIR事件；架构强制OAPEFLIR仅用 oapeflir.view._/oapeflir.rationale.\* | 未修复 | 待补充 |
| F-6 | HIGH   | Spec§12 vs Arch§14/§45        | Spec将Graph Scheduler置于OAPEFLIR Runtime内；架构将其置于P4执行平面HarnessRuntime管辖下 | 未修复 | 待补充 |
| F-7 | HIGH   | Spec§20.2 vs Arch§8           | Spec假设LLM可确定性重放(reexecute_with_same_seed)；架构明确"不假设LLM可确定性重放"，默认Trace Replay | 未修复 | 待补充 |
| F-8 | HIGH   | Spec§34 vs Arch§6.2/§58       | Spec用OAPEFLIR.\*错误码命名空间；架构强制PLATFORM.{plane}.{component}.{category}并禁止OAPEFLIR进入错误码命名空间 | 未修复 | 待补充 |
| F-9 | MED    | Spec§5.2 vs Arch§14           | Spec定义13个NodeRunStatus含compensating/compensated由OAPEFLIR管辖；架构规范定义在HarnessRuntime下，所有权冲突 | 未修复 | 待补充 |
| F-10 | MED    | Spec§7.3 vs Arch§13.8         | PlanNode字段名Spec用type(14种)，架构用kind | 未修复 | 待补充 |
| F-11 | MED    | Spec§15 vs Arch§18.3          | Spec将BudgetLedger置于OAPEFLIR所有含直接reservation语义；架构BudgetReservation归P5/Budget服务 | 未修复 | 待补充 |
| F-12 | MED    | Spec§16 vs Arch§14.11         | Spec将SideEffectManager置于OAPEFLIR Runtime内；架构置于P4执行平面HarnessRuntime治理下 | 未修复 | 待补充 |
| F-13 | MED    | Spec§39 vs Arch§35            | Spec建议所有运行时代码在src/platform/oapeflir/；架构推荐Harness中心目录结构，OAPEFLIR仅为trace/projection适配器 | 未修复 | 待补充 |
| F-14 | MED    | Spec§42 vs Arch§8版本         | Spec声称v4.4为核心Runtime设计基线；架构v4.3将v4.4 Spec降级为"迁移输入"非权威基线 | 未修复 | 待补充 |
| F-15 | MED    | Spec§24 vs Arch§45.25         | Spec的DecisionInputBundle缺少hitlState/nodeState；架构额外含riskState/guardrailFindings | 未修复 | 待补充 |
| F-16 | MED    | Spec§19 vs Arch§45.24         | Spec含observe/summarizer prompt角色；架构仅认Planner/Generator/Evaluator | 未修复 | 待补充 |
| F-17 | MED    | Spec§25 vs Arch§14.8/§42      | Spec定义5个RuntimeProfile层级(core/durable/governed/enterprise/learning)作OAPEFLIR内置；架构§14.8/§42为独立定义 | 未修复 | 待补充 |
| F-18 | LOW    | Spec§26 vs Arch§45.27         | Spec列6种HITL能力；架构§45.27额外含reject | 未修复 | 待补充 |
| F-19 | LOW    | Spec§23 vs Arch§45.20         | 两者均定义5层Guardrail但Spec置于OAPEFLIR治理，架构置于Harness§45.20 + P2控制平面 | 未修复 | 待补充 |
| F-20 | LOW    | Spec§22 vs Arch§45.16         | Spec定义6种Memory scope；架构用3层模型(Working/Long-term/Shared Knowledge)，分类法不同 | 未修复 | 待补充 |
| F-21 | LOW    | Spec§35 vs Arch§58.1          | Spec用oapeflir.run._指标前缀；架构用harness.run._ | 未修复 | 待补充 |
| F-22 | LOW    | Spec§40 vs Arch§33            | Spec用4阶段交付(A-D)；架构用3环模型(MVP/Hardening/Enterprise) | 未修复 | 待补充 |
| F-23 | LOW    | Spec§7.1 vs Arch§5.3/§13.8    | Spec含generatedBy含repair_worker；架构PlanGraphBundle无此字段，出处通过evidence refs追踪 | 未修复 | 待补充 |
| F-24 | LOW    | Spec§30 vs Arch§45.3          | Spec列9级策略优先级；架构ConstraintPack用4级合并(平台<租户<业务域<任务) | 未修复 | 待补充 |
| F-25 | LOW    | Spec§2 Execute产出            | Spec Execute阶段产出ExecutionReceipt；架构标注为废弃，规范为NodeAttemptReceipt | 未修复 | 待补充 |

## 10. interaction 代码 vs 架构（20项）

| #    | 严重度 | 位置                              | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| I-1 | HIGH   | nl-gateway/index.ts               | 无TaskDraft/ClarificationState/UserConfirmationReceipt预入口对象，buildTask()直接跳至RequestEnvelope绕过§39.2入口管线 | 未修复 | 待补充 |
| I-2 | HIGH   | nl-gateway/index.ts:414           | 默认澄清阈值0.7，§39.3强制intent_confidence_threshold=0.80/slot_confidence_threshold=0.85 | 未修复 | 待补充 |
| I-3 | HIGH   | nl-gateway/index.ts               | 无多轮对话状态机(Idle→IntentParsing→Clarifying→Building→Confirming→Executing→Reporting)§39.5要求 | 未修复 | 待补充 |
| I-4 | HIGH   | nl-gateway/                       | NL管线无任何Prompt Injection防御，违反§39.6安全约束(引用§16.5) | 未修复 | 待补充 |
| I-5 | HIGH   | nl-gateway/index.ts               | 缺少§39.3要求的ContextEnricher/ResponseFormatter组件 | 未修复 | 待补充 |
| I-6 | HIGH   | nl-gateway/index.ts:71            | DetectedIntent.intentType含"system_config"无架构对应定义 | 未修复 | 待补充 |
| I-7 | MED    | goal-decomposer/index.ts          | 无GoalLifecycleState状态机(draft→decomposing→decomposed→executing→completed…)§40.5要求 | 未修复 | 待补充 |
| I-8 | MED    | goal-decomposer/index.ts          | 输出tasks/dependencyGraph但不产出§40.2要求的GoalGraphDraft/TaskGraphDraft，无draft→planner交接 | 未修复 | 待补充 |
| I-9 | MED    | goal-decomposer/index.ts          | 分解时无budget/risk/permission/capability约束传播(§40.2)，仅事后buildRiskSummary | 未修复 | 待补充 |
| I-10 | HIGH   | proactive-agent/index.ts:5        | TriggerDefinition.type用"threshold"而非架构"condition"(§41.2: schedule/event/condition/webhook)；"webhook_inbound" vs "webhook" | 未修复 | 待补充 |
| I-11 | MED    | proactive-agent/index.ts          | 无ProactiveBudgetPool或UserInitiatedReserveRatio(≥60%)强制(§41.4) | 未修复 | 待补充 |
| I-12 | MED    | proactive-agent/index.ts          | 无触发器间反馈环路检测(§41.4要求检测互触发循环并创建incident) | 未修复 | 待补充 |
| I-13 | MED    | proactive-agent/index.ts:43       | TriggerDefinition缺少§41.2要求的maxFireCount/boundAgentId字段 | 未修复 | 待补充 |
| I-14 | HIGH   | dashboard/                        | 无MetricRegistry含metric_owner/freshness_slo/stale_behavior/redaction(§43.1) | 未修复 | 待补充 |
| I-15 | MED    | dashboard/                        | NL摘要生成无evidence_refs/freshness/confidence/redaction_policy/source_projection_version元数据(§43.6) | 未修复 | 待补充 |
| I-16 | MED    | dashboard/                        | 无仪表盘操作风险门控(§43.6)：按钮不应直接触发高风险指令 | 未修复 | 待补充 |
| I-17 | MED    | autonomy/trust-scorer/index.ts:14 | TrustLevel 6值枚举与架构§42.2自治级别(suggestion/supervised/semi_auto/full_auto)无正式映射桥接 | 未修复 | 待补充 |
| I-18 | MED    | autonomy/                         | 无TrustDecayWorker或每日衰减机制(§42.3)；无降级前的AutonomyChangeImpactReport(§42.4) | 未修复 | 待补充 |
| I-19 | MED    | ux/workflow-builder-service.ts    | 可视化工作流构建器保存前不执行§44.3要求的PlanGraph Normalize/Validate/RiskPropagation/WorstPathAnalysis | 未修复 | 待补充 |
| I-20 | LOW    | nl-gateway/index.ts               | deriveUrgency将"critical"关键词映射为"high"而非"critical"，低估紧急度 | 未修复 | 待补充 |

## 11. domains + sdk 代码 vs 架构（20项）

| #    | 严重度 | 位置                                                  | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| D-1 | HIGH   | domains/canonical-meta-model/types.ts                 | 元模型仅12问(Q1-Q12)，架构§37.11要求15问(缺Q13 liability_owner/Q14 compensation_model/Q15 adversarial_scenarios) | 未修复 | 待补充 |
| D-2 | HIGH   | sdk/pack-sdk/pack-manifest.ts                         | BusinessPackManifest缺少§30.2强制字段：domain_id(用domain)/side_effects/data_classes/max_risk_class/tools/connectors/plugins/eval_requirements/compatibility | 未修复 | 待补充 |
| D-3 | HIGH   | domains/registry/domain-model.ts:77                   | 域状态枚举 draft/testing/active/deprecated 不匹配§37.10生命周期 Draft/Validated/Registered/Active/Updating/Deprecated/Archived | 未修复 | 待补充 |
| D-4 | HIGH   | domains/(缺失)                                        | 架构§37.2 v4.3分解规格(DomainCoreDescriptor/DomainExecutionProfile/DomainRiskSpec/DomainKnowledgeSpec/DomainEvalSpec/DomainGovernanceSpec/DomainInteractionSpec)无类型实现 | 未修复 | 待补充 |
| D-5 | HIGH   | sdk/(缺失)                                            | 架构§22.1要求4层SDK；Admin SDK完全缺失 | 未修复 | 待补充 |
| D-6 | HIGH   | domains/domain-descriptor-orchestration-service.ts:15 | lifecycleState枚举含validating/certified/canary不在§37.10状态机中；缺registered/updating/archived | 未修复 | 待补充 |
| D-7 | MED    | sdk/plugin-sdk/plugin-definition.ts:9                 | PluginType含"presenter"不在架构§22.1(tool/adapter/retriever/evaluator)中 | 未修复 | 待补充 |
| D-8 | MED    | domains/registry/domain-model.ts:60                   | PluginBinding.pluginType枚举retriever/validator/planner/presenter/adapter与架构tool/adapter/retriever/evaluator不匹配 | 未修复 | 待补充 |
| D-9 | MED    | domains/recipes/index.ts:3                            | DomainRecipe缺少archetype字段，架构§37.7定义12种recipe原型无枚举或类型 | 未修复 | 待补充 |
| D-10 | MED    | sdk/client-sdk/api-client.ts                          | 无规范API端点的类型化方法(/api/v1/harness-runs, /api/v1/packs, abort/pause per §6) | 未修复 | 待补充 |
| D-11 | MED    | domains/governance/domain-governance-policy.ts        | 缺少§37.9治理字段：slo_profile/budget_constraints/max_hibernation_renewals/compliance_rules/recertification/waiver | 未修复 | 待补充 |
| D-12 | MED    | domains/operations/index.ts:3                         | 上架阶段 modeling/development_validation/security_certification/canary_launch 不对齐§37.10+§38 runbook | 未修复 | 待补充 |
| D-13 | MED    | sdk/pack-sdk/pack-manifest.ts:3                       | BusinessPackCapability用非正式maturity字段代替架构§30.2的PackCapabilityProfile结构 | 未修复 | 待补充 |
| D-14 | MED    | domains/(缺失)                                        | 无execution_mode/hot_path_mode/planning_mode字段，§37.2要求用于确定性热路径强制 | 未修复 | 待补充 |
| D-15 | MED    | sdk/pack-sdk/pack-manifest.ts:17                      | validateBusinessPackManifest不验证domain_id指向Active DomainDescriptor(§30.2) | 未修复 | 待补充 |
| D-16 | LOW    | sdk/workbench/index.ts:134                            | 预览URL用旧/tasks和/approvals路径而非规范/harness-runs(§6) | 未修复 | 待补充 |
| D-17 | LOW    | sdk/plugin-sdk/plugin-definition.ts:29                | PluginDefinition缺少§22.4 PluginManifest字段：spiTypes/domainIds/SBOM/signing | 未修复 | 待补充 |
| D-18 | LOW    | sdk/pack-sdk/pack-scaffold-service.ts                 | 脚手架不生成domain lint/domain validate集成，§37要求Gate 2前通过domain lint | 未修复 | 待补充 |
| D-19 | LOW    | sdk/harness-sdk/index.ts:16                           | HarnessSdkAppendStepInput用旧stage/inputs/outputs术语而非规范nodeRunId/planGraphId(§5/§45) | 未修复 | 待补充 |
| D-20 | LOW    | domains/registry/domain-registry-service.ts:64        | activate()从任意状态直接转active，无§37.10要求的Draft→Validated→Registered→Active路径守卫 | 未修复 | 待补充 |
## 12. Contract 文档 vs 架构（第3批，25项）

| #    | 严重度 | Contract 文件                                      | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| T-32 | HIGH   | transition_service_contract                        | TransitionCommand.entity_kind用pre-v4.3类型(task/workflow/session/approval/execution)，架构§5.3用harness_run/node_run/side_effect/budget_reservation | 未修复 | 待补充 |
| T-33 | HIGH   | storage_schema_contract                            | 核心表(tasks/workflow_state/executions)无映射到v4.3规范对象(HarnessRun/NodeRun/PlanGraphBundle)，缺对应表或迁移路径 | 未修复 | 待补充 |
| T-34 | HIGH   | storage_schema_contract                            | memories表DDL遗漏合约自身§13声明的最小列：layer_level/token_budget/freshness_state/source_refs_json | 未修复 | 待补充 |
| T-35 | HIGH   | monetization_metering_plane_contract               | 引入BillingLedger/LedgerEntry但架构§18用BudgetLedger/BudgetSettlement为冻结合约(§1.5)，命名碰撞 | 未修复 | 待补充 |
| T-36 | HIGH   | marketplace_catalog_and_revenue_contract           | 定义RevenueSharePolicy含结算/分成字段，架构§55.4明确"收益分成/计费结算不属于核心运行架构"禁止影响Pack执行/安全 | 未修复 | 待补充 |
| T-37 | HIGH   | idempotency_and_recovery_matrix_contract           | 全文使用"workflow step"/"step"术语(§4 Step级矩阵)，架构v4.3§5.5声明NodeRun/NodeAttempt为规范，stepId仅为legacy投影 | 未修复 | 待补充 |
| T-38 | MED    | plugin_spi_contract                                | DomainPlannerPlugin.plan()返回Plan而非规范PlanGraphBundle；§7 OAPEFLIR表用"Rollout"而非"Release" | 未修复 | 待补充 |
| T-39 | MED    | trace_and_root_cause_observability_contract        | "一个task=一个trace"，架构§5.5声明HarnessRun为规范run truth；应为"一个HarnessRun=一个trace" | 未修复 | 待补充 |
| T-40 | MED    | billing_and_tenant_contract                        | 用UsageMeter而非架构§18.1的UsageRecord；未引用冻结的BudgetLedger/BudgetReservation | 未修复 | 待补充 |
| T-41 | MED    | cost_and_budget_contract                           | BudgetPolicy仅max_task/daily/monthly_cost_usd，架构§18.3强制多维：max_cost/max_model_tokens/max_context_tokens/max_output_tokens/max_steps/max_duration_ms | 未修复 | 待补充 |
| T-42 | MED    | cross_region_routing_and_data_residency_contract   | RegionDescriptor缺provider/endpoints/dataResidencyPolicy(§52.1)；缺写边界规则CAS/Lease/Fencing(§52.3) | 未修复 | 待补充 |
| T-43 | MED    | marketplace_catalog_and_revenue_contract           | lifecycle_state用draft/submitted/certified/published/deprecated/retired，架构§55.5用active/deprecated/sunset/removed，不兼容 | 未修复 | 待补充 |
| T-44 | MED    | sso_scim_and_identity_sync_contract                | 缺架构§48.2要求的identity_sync_dlq；遗漏SAML 2.0(架构标注"必须") | 未修复 | 待补充 |
| T-45 | MED    | edge_runtime_and_sync_contract                     | 缺架构§8.3要求EdgeRuntime声明stateful=true/lease_migration_supported/checkpoint_required_before_preempt | 未修复 | 待补充 |
| T-46 | MED    | node-run-attempt-receipt-contract                  | Receipt主键字段为nodeAttemptReceiptId，架构§5.3 NodeAttemptReceipt用receiptId | 未修复 | 待补充 |
| T-47 | MED    | observability_contract                             | RuntimeMetricsSummary用oapeflirMetrics.convergenceRate为顶层指标，架构§5.5/§13声明OAPEFLIR仅为投影/trace非truth | 未修复 | 待补充 |
| T-48 | MED    | token_budget_allocation_contract                   | 定义10种预算维度含KV cache分区但未引用冻结的BudgetReservation状态机(reserved→settled→released) | 未修复 | 待补充 |
| T-49 | MED    | supply_chain_and_dependency_security_contract      | 缺架构§11.7 PluginTrustStore要求：trust root/signing key rotation/revocation list/security advisory/quarantine/tenant impact | 未修复 | 待补充 |
| T-50 | LOW    | enterprise_secret_management_contract              | 提到短期凭证但未强制架构§11.3硬TTL上限"secret注入短时有效(TTL≤300s)" | 未修复 | 待补充 |
| T-51 | LOW    | tenant_isolation_and_shared_worker_safety_contract | 无架构§9.1自动隔离阈值(failure rate>30%+min_sample_size)，仅定性规则无定量触发器 | 未修复 | 待补充 |
| T-52 | LOW    | tool_output_sanitization_contract                  | 用"Phase 1a"术语，架构§1.4/§33声明"旧Phase 1-9仅作为历史排期映射"已废弃 | 未修复 | 待补充 |
| T-53 | LOW    | cost_attribution_and_optimization_contract         | CostAttributionRecord.decision_ref为通用string，架构要求可追踪到HarnessRun/NodeRun/BudgetSettlement | 未修复 | 待补充 |
| T-54 | LOW    | approval_and_hitl_contract                         | 仍用OapeflirStage作为一等stage_ref字段，架构§5.5不变量"oapeflir.\*事件不得作为truth source" | 已修复 | `docs_zh/contracts/approval_and_hitl_contract.md` 已把权威关联键改为 `harness_run_id / node_run_id`，并将 `stage_ref` 收敛为仅视图语义的 `stage_view_ref`；根因：历史审批流把 OAPEFLIR 阶段既当解释视图又当权威关联键，混淆了 projection 与 runtime truth；定向验证：`tests/invariants/contract-and-oapeflir-remediation.test.ts` |
| T-55 | LOW    | monetization_metering_plane_contract               | UsageEvent.source枚举(runtime/api/gateway/admin)缺tool/model/side_effect，架构§18.1 cost_source含provider_invoice/internal_compute/human_review/storage/egress | 未修复 | 待补充 |
| T-56 | LOW    | runtime_repository_and_migration_contract          | Repository方法(markExecutionStarted等)直操作executions表，架构§5.3强制所有状态转换经RuntimeStateMachine.transition() | 未修复 | 待补充 |

## 13. ADR vs 架构（第2批，25项）

| #    | 严重度 | ADR            | 偏差描述 | 状态 | 收口证据 |
| ---- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| A-13 | HIGH   | ADR-021        | 用废弃ControlDirective为规范P2→P3合约；架构§5.2拆分为OperationalDirective/DecisionDirective | 未修复 | 待补充 |
| A-14 | HIGH   | ADR-021        | 用废弃ExecutionPlan含线性steps[]为P3→P4合约；架构§5.3强制PlanGraphBundle | 未修复 | 待补充 |
| A-15 | HIGH   | ADR-021        | 用废弃ExecutionReceipt为P4→P3结果；架构§5.3强制NodeAttemptReceipt(attemptId+nodeRunId) | 未修复 | 待补充 |
| A-16 | HIGH   | ADR-027        | Principal类型含pack/tenant代替worker/plugin；架构§11.1规范集为user/service/agent/worker/plugin/system | 未修复 | 待补充 |
| A-17 | HIGH   | ADR-027        | 沙箱层级SANDBOX_NONE/SANDBOX_READonly/SANDBOX_NETWORK_ISOLATED/SANDBOX_FULL与架构§11.4完全不同；SANDBOX_NONE违反default-deny | 未修复 | 待补充 |
| A-18 | HIGH   | ADR-026        | 风险模型6因子(stepTypeRisk/targetSystemRisk等)名称权重均不同于架构§10.2的8因子 | 未修复 | 待补充 |
| A-19 | HIGH   | ADR-025        | PolicyMode含supervised/degraded/maintenance/emergency不存在于架构§9.5/§14.8规范集 | 未修复 | 待补充 |
| A-20 | HIGH   | ADR-073        | 用tasks/workflow/execution/ExecutionEnvelope为规范资源；架构§5.5强制HarnessRun/NodeRun/PlanGraphBundle | 未修复 | 待补充 |
| A-21 | HIGH   | ADR-004        | 用v3 "VP运营/VP编排/事业部/Lead Agent/CEO"代理层次；架构v4.3以五平面+HarnessRuntime替代 | 未修复 | 待补充 |
| A-22 | MED    | ADR-005        | 运行时模式supervised/auto/full-auto不匹配架构§14.8规范8种枚举 | 未修复 | 待补充 |
| A-23 | MED    | ADR-064        | CostDimension用废弃workflow_id/step_id；架构§12.4/§5.5强制harnessRunId/nodeRunId | 未修复 | 待补充 |
| A-24 | MED    | ADR-052        | 列出sync复制模式RPO=0；架构§25.11明确"v4.2不承诺多主truth写入"仅async | 未修复 | 待补充 |
| A-25 | MED    | ADR-058        | 紧急停止级别L0-L4未引用PlatformPanicDirective或OperationalDirective(type=kill)架构§5.2/§60正式机制 | 未修复 | 待补充 |
| A-26 | MED    | ADR-098        | 用waiting_hitl为NodeRun状态；架构§14.10/§25.8规范为awaiting_hitl | 未修复 | 待补充 |
| A-27 | MED    | ADR-066-plugin | DomainPlannerPlugin.plan()返回Promise<Plan>；架构强制PlanGraphBundle | 未修复 | 待补充 |
| A-28 | MED    | ADR-040        | Goal生命周期9态不对齐HarnessRun §25.8的13态状态机 | 未修复 | 待补充 |
| A-29 | MED    | ADR-073        | 全文用"phase1-4"；架构§33声明旧Phase命名仅为历史映射，强制Ring 1/2/3 | 未修复 | 待补充 |
| A-30 | MED    | ADR-094        | 引用"phase 8b"为交付门禁；同上phase命名矛盾 | 未修复 | 待补充 |
| A-31 | MED    | ADR-099        | 引用"phase 8c"；同上 | 未修复 | 待补充 |
| A-32 | MED    | ADR-037        | DomainClass仅7种；架构§1/§30覆盖24垂直域，缺17种域分类 | 未修复 | 待补充 |
| A-33 | LOW    | ADR-092        | 用"step"/"decision"记录时间线；架构规范为NodeRun/NodeAttempt，HarnessStep仅语义投影 | 未修复 | 待补充 |
| A-34 | LOW    | ADR-042        | 自治level 4 full_auto暗示无限制；架构§3.2禁止高危域full_auto除非显式DomainRiskSpec | 未修复 | 待补充 |
| A-35 | LOW    | ADR-075        | Rollout L1命名shadow与已废弃ADR-018 L2 shadow冲突，级别编号不一致 | 未修复 | 待补充 |
| A-36 | LOW    | ADR-066-plugin | Plugin隔离描述为Worker线程；架构§11.7要求不可信插件用独立进程+IPC边界 | 未修复 | 待补充 |
| A-37 | LOW    | ADR-093        | ConstraintPack仅含risk_policy+output_policy；架构§13.4/§14.2要求含budget envelope/sandbox requirement/approval requirement | 未修复 | 待补充 |

## 原始最终系统性主题（历史快照，当前未修复）

以下主题为原始最终审计的风险归纳，内容保留用于历史追踪；当前所有对应编号均已重开，统一标记为 `未修复`，直接证据路径待逐条补齐。

1. **OAPEFLIR 身份危机（最严重）**：v4.4 Spec将其视为完整Runtime拥有Run/Status/Budget/Events/ErrorCodes/GraphScheduler/SideEffectManager；主架构明确降级为认知投影层。ADR/合约/代码各取一边，整个系统对"谁驱动执行"无共识
2. **v3→v4术语迁移未执行**：~60%的合约和~40%的ADR仍使用 task/workflow/execution/step/Rollout/ControlDirective/ExecutionPlan/ExecutionReceipt 等v3术语，架构已全部重命名
3. **状态机碎片化**：HarnessRun在不同位置定义为5/6/7/13/15态；NodeRun有5/9/13态变体；无单一真相源
4. **安全关键default-allow**：delegated-governance未知类型允许、sandbox tier含NONE、自治升级无风险门控、panic恢复缺双人验证
5. **完整模块/字段群缺失**：Admin SDK、CapacityPlanning、CostAttribution、LegalEntityBoundary、RevenueShare实现、DomainRiskSpec 7个子规格、15问元模型等
6. **防御深度系统性不足**：prompt injection/sandbox/drift/compliance/edge-sync均仅实现单层，架构要求3-5层
7. **配置-schema-架构三方脱节**：域配置JSON字段、Zod schema、架构定义三者互不匹配
8. **合约自身内部不一致**：storage_schema memories表DDL遗漏自身§13声明的列；harness-run-contract内部§45.13 vs §25.8态数不同
9. **规范对象标识不统一**：context/trace/billing/cost各自使用不同key(task_id/execution_id/workflow_id vs harnessRunId/nodeRunId/attemptId)
10. **交付里程碑术语分裂**：部分文档用Phase 1-9，部分用Ring 1/2/3，部分用A/B/C/D，三套命名并存
