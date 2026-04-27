# Current Todo List

> 本文件当前以 v4.3 Executable Specification Freeze 为主索引。下方“2026-04-25 全量测试失败清单”保留为历史测试基线，用于回归对账；它不再作为 v4.3 新路线的唯一优先级来源。

## v4.3 Executable Specification Freeze 当前待办

## 00-platform-architecture.md 实现一致性审计当前待办

> 本轮审计以 `docs_zh/architecture/00-platform-architecture.md` 为权威输入，逐条核对实现是否完成、是否与文档描述一致；先产出事实矩阵与差距清单，再决定后续实现批次。

### I1 审计未完成项收口批次

- [x] 补齐 intake/admission 主链：RawInput -> TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope -> HarnessRun，并在 admission 时冻结 RunVersionLock。
- [x] 补齐 PlanGraph normalize / validate / risk propagation / worst-path analysis，并让 scheduler 输出 platform fact decision event。
- [x] 补齐 RuntimeStateMachine 权威边界：RunVersionLock、policy guard、budget precondition、side-effect safety、audit append 与 NodeRun lease/fencing 强制校验。
- [x] 补齐 runtime repository contract：Repository interface、append-only receipt、runtime truth transaction、outbox/audit 事件边界与 v4.3 physical schema baseline。
- [x] 补齐 Event Registry metadata/replayBehavior/consumer contract tests，并接入 v4.3 EventEnvelope 描述符。
- [x] 补齐 BudgetAllocator、SideEffect commit 前复检、HITL responsibility 链路和 HarnessRuntime executor/evaluator/decision 基础闭环。
- [x] 增加 bypass invariant tests，证明 legacy ExecutionPlan/workflow/step 不能作为 v4.3 runtime 入口或直接写 truth。
- [x] 更新 `docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`，将已实现项改为完成，将 ADR-112 后续环标为非 Ring 1 阻塞项。
- [x] 执行 source-only build、定向 runtime/contracts/storage/event 测试与 diff 检查。

### I0 审计后实现批次 1

- [x] 为 `src/platform/contracts/executable-contracts/` 增加 executable contract package，覆盖 28 个 v4.3 canonical contract 的 Zod schema、JSON Schema 摘要、replay behavior、failure behavior 与校验入口。
- [x] 将 GraphPatch operation enum 对齐 `00-platform-architecture.md`：`add_node` / `add_edge` / `disable_edge` / `add_compensation_node` / `add_failure_path` / `mark_skipped` / `append_subgraph`。
- [x] 为 `NodeRun` 补齐 `blocked` 状态与 `blocked -> ready/skipped/cancelled/dependency_failed/policy_blocked/aborted` 状态推进。
- [x] 更新中文 contract 与 v4.3 定向测试，验证 executable contract package、GraphPatch safety、NodeRun blocked gating。

### A0 审计计划

- [x] 提取 `00-platform-architecture.md` 的可检查架构承诺，按 Contract Freeze、五平面、Runtime/OAPEFLIR、State & Evidence、治理与扩展层分组。
- [x] 建立实现核对口径：完成、部分完成、文档/实现不一致、未实现、超出 v4.3 MVP 范围。
- [x] 保留 v4.3 已完成实现与历史测试基线边界，避免把既有无关失败归因到本轮审计。

### A1 逐项核对

- [x] 核对 v4.3 Contract Freeze 12 个核心契约与 `docs_zh/contracts/`、`src/platform/contracts/executable-contracts/`、单测是否一致。
- [x] 核对 RuntimeStateMachine、Graph Scheduler、NodeRun、NodeAttemptReceipt、SideEffect、Budget、HITL、Event 分层是否符合架构主链。
- [x] 核对五平面与推荐目录在 `src/platform/`、`src/domains/`、`src/interaction/`、`src/org-governance/`、`src/scale-ecosystem/`、`src/ops-maturity/` 的实现覆盖。
- [x] 核对 State & Evidence、Event Registry、Projection、DLQ/Incident、Repository/Storage 与架构文档的一致性。
- [x] 核对 AI 运营层、业务域接入层、智能交互层、组织治理层、规模生态层、运营成熟度层的实现状态与范围边界。

### A2 审计输出

- [x] 生成中文实现一致性审计报告，记录逐项状态、证据路径、主要偏差与建议优先级：`docs_zh/reviews/platform-architecture-implementation-consistency-audit.md`。
- [x] 更新本 todo 的审计项状态。
- [x] 执行文档 diff 检查与必要的定向验证命令。

### P0 文档冻结

- [x] 新增 ADR-109 至 ADR-112，冻结 v4.3 契约范围、状态机权威、事件分层与 MVP 三环边界。
- [x] 更新 `docs_zh/adr/README.md`，将 ADR-109 至 ADR-112 标为 v4.3 实现入口。
- [x] 更新 `docs_zh/contracts/README.md`，新增 `v4.3 Contract Freeze Scope` 分组。
- [x] 新增 v4.3 中文 contract 文档，覆盖 `00-platform-architecture.md` 已冻结的 12 个核心契约。
- [x] 明确旧 `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / `workflow_run` / `step` 只能出现在 legacy、deprecated、projection 或历史语境，不再作为新实现入口。

### P1 契约实现

- [x] 在 `src/platform/contracts/` 建立 v4.3 canonical 类型、schema 与 factory。
- [x] 建立 contract naming consistency test，阻止旧名重新进入 canonical 类型导出。
- [x] 将 `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope` 接入 intake contract。
- [x] 将 `PlanGraphBundle` / `GraphPatch` / `NodeRun` / `NodeAttemptReceipt` 接入 runtime contract。
- [x] 将 `BudgetLedger` / `SideEffectRecord` / `RunVersionLock` / `DecisionInputBundle` / `HumanResponsibilityRecord` 接入治理 contract。

### P2 Runtime MVP

- [x] 实现 `RuntimeStateMachine.transition(command)`，作为 `HarnessRun` / `NodeRun` / `SideEffect` / `Budget` 状态推进唯一入口。
- [x] 实现 `EventInbox` / `PlatformFactEvent` / `OapeflirViewEvent` 分层，确保 truth projector 只消费 `platform.*`。
- [x] 接入 HarnessRuntime MVP 主链：`PlanGraphBundle -> Graph Scheduler -> NodeRun -> NodeAttemptReceipt -> Event/Audit/Evidence`。
- [x] 接入 GraphPatch 安全校验，禁止静默改写已执行节点、已提交副作用或已记录 receipt。
- [x] 接入 SideEffect reconciliation / compensation 最小闭环。
- [x] 接入 v4.3 runtime repository，验证 truth mutation 与 `platform.*` fact event append 的原子边界。

### P3 测试门禁

- [x] 新增 runtime state-machine transition tests。
- [x] 新增 event consumer test：truth consumer 不消费 `oapeflir.view.*`。
- [x] 新增 GraphPatch safety test。
- [x] 新增 budget hard-cap concurrency test。
- [x] 新增 HITL responsibility record test。
- [x] 新增 runtime repository atomic transition/event append test。
- [x] 执行 v4.3 范围的 source-only build validation 与 runtime/contracts/storage/event 定向测试。完整 `npm run typecheck`、`npm run test:unit` 与广域 integration sweep 仍由下方历史基线管理，因为它们仍包含既有无关失败。

### P4 后续扩展

- [x] Hardening Ring：已记录 replay、recovery、lease/fencing、DLQ、diagnostics 与 evidence bundle 为 v4.3 MVP 之后的下一环范围。
- [x] Enterprise Ring：已记录组织治理、SSO/SCIM、多租户隔离、跨区域、Marketplace、Edge 与 PlatformOps 为三环架构下的后续范围。
- [x] 24 域与 DomainRecipe 已确认为不阻塞 v4.3 Contract Freeze MVP；仅在核心 runtime 语义稳定后进入批量接入。

## 历史测试基线：全量测试失败清单（2026-04-25）

> 以下清单保留为 2026-04-25 的历史失败基线，用于后续对比 v4.3 修复是否扩大或缩小回归面；不删除、不重排。

## 9. 全量测试失败清单（2026-04-25 更新）


### 测试结果汇总

| 测试套件 | 通过 | 失败 | 状态 |
|---------|------|------|------|
| Build | - | 0 | ✓ |
| Unit | 30,963 | 354 | 有失败 |
| Integration | - | - | 待运行 |
| **总计** | **30,963** | **354** | |

### Unit 失败（354个）

**整体测试**: 31,317 tests / 30,963 pass / 354 fail / 0 cancelled

---

## 按目录分类的测试失败

### 1. unit/platform/state-evidence/truth (84个失败)
- SQLite repositories 相关测试

### 2. unit/platform/shared/observability (55个失败)
- observability 相关测试

### 3. unit/platform/interface/api (52个失败)
- API 接口相关测试

### 4. unit/platform/orchestration/oapeflir (50个失败)
- oapeflir 相关测试

### 5. unit/platform/shared/stability (43个失败)
- stability 相关测试

### 6. unit/platform/shared/cache (35个失败)
- cache 相关测试

### 7. unit/platform/state-evidence/knowledge (33个失败)
- knowledge 相关测试

### 8. unit/platform/state-evidence/events (30个失败)
- events 相关测试

### 9. unit/platform/orchestration/harness (30个失败)
- harness 相关测试

### 10. unit/platform/state-evidence/memory (24个失败)
- memory 相关测试

### 11. unit/platform/execution/worker-pool (22个失败)
- worker-pool 相关测试

### 12. unit/platform/interface/channel-gateway (16个失败)
- channel-gateway 相关测试

### 13. unit/platform/model-gateway/provider-registry (15个失败)
- provider-registry 相关测试

### 14. unit/platform/orchestration/agent-delegation (14个失败)
- agent-delegation 相关测试

### 15. unit/platform/state-evidence/artifacts (13个失败)
- artifacts 相关测试

### 16. 其他目录（约50个失败）
- prompt-engine/eval: 10个
- orchestration/hitl: 9个
- interface/ingress: 9个
- orchestration/planner: 8个
- orchestration/learn: 7个
- state-evidence/checkpoints: 6个
- shared/scaling: 6个
- shared/outbox: 6个
- interaction/autonomy: 5个
- scale-ecosystem/integration/connectors: 4个
- feedback-loop/collector: 4个
- orchestration/routing: 4个
- interface/webhook: 4个
- interface/scheduler: 4个
- 其他零散失败

---

## 详细测试失败列表（354个）

### eval-framework (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 815 | LlmEvalService.runCiGate reports regressions | runCiGate 回归检测 |
| 817 | LlmEvalService.runCiGate respects passingVerdicts option | passingVerdicts 选项 |

### execution-outcome-evaluator (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 841 | ExecutionOutcomeEvaluator.evaluate suggests approve for low quality score | 低质量分数建议审批 |

### DomainGovernancePolicySchema (3个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 1041 | DomainGovernancePolicySchema rejects duplicate roles across arrays | 重复角色 |
| 1042 | DomainGovernancePolicySchema accepts empty restrictedDataClasses | 空 restrictedDataClasses |
| 1043 | DomainGovernancePolicySchema accepts empty mandatoryEvidence | 空 mandatoryEvidence |

### HrRoleGovernanceService (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 1089 | HrRoleGovernanceService submitProposal returns null approvalRequest when validation fails | 验证失败时返回 null |
| 1093 | HrRoleGovernanceService registerApprovedRole throws when proposal invalid | 无效提案 |

### state-transition (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 1125 | activate changes status to active and records timestamp | 状态激活 |

### detectAmbiguity (5个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 2331 | detectAmbiguity returns false for high confidence regardless of entities | 高置信度 |
| 15076 | detectAmbiguity treats confidence of 0.7 and above as not low | 0.7及以上 |
| 15078 | detectAmbiguity with exact entity count matches required | 精确实体计数 |

### AgentVersionManager (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 2868 | AgentVersionManager.switchSlot returns null when no current version | switchSlot 返回 null |
| 2934 | AgentVersionManager: blue-green deployment ping-pong | 蓝绿部署 |

### buildForensicSnapshot (4个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 3735 | buildForensicSnapshot returns distinct copies | 返回不同副本 |
| 1 | filters by stepId | 按 stepId 过滤 |
| 2 | filters by eventType | 按 eventType 过滤 |
| 4 | combines multiple filters | 组合过滤 |
| 8 | filterEvents | 过滤事件 |

### ExecutionTracer (3个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 4540 | ExecutionTracer | 执行追踪器 |
| 1 | creates step with running status | 创建运行中步骤 |
| 2 | overwrites existing step state when called again | 覆盖现有状态 |
| 5 | failStep | 失败步骤 |

### StepInspector (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 4564 | StepInspector | 步骤检查器 |

### PlatformApplicationKernel (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 5874 | buildStartupPlan includes domains startup plan when required | 包含 domains 启动计划 |
| 5876 | buildStartupPlan includes interactionGovernance plans when interaction layer required | 包含 interactionGovernance 计划 |

### coverage-baseline-guard (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 446 | coverage-baseline-guard | 覆盖率基线守卫 |

### PromptVersionManager (4个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 6337 | compareVersions returns -1 when v1 < v2 | v1 < v2 |
| 6339 | compareVersions returns 1 when v1 > v2 | v1 > v2 |
| 6341 | compareVersions treats version without patch as less than with patch | 无 patch 版本 |
| 6367 | compareVersions handles large version differences | 大版本差异 |

### CostReportService (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 10061 | CostReportService creates cost reports with resource breakdown | 成本报告 |

### dispatchNext (约20个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 10198-10219 | dispatchNext 相关测试 | Worker 调度选择 |

### IntakeRouter (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 10496 | handles follow-up with orchestration for retry scenario | 重试场景 |
| 10518 | matchedRules contains keywords that triggered intent | 匹配规则 |

### OrphanCleanupService (4个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 11316 | enforce applies close_orphan_session for orphan sessions | 孤儿会话 |
| 11317 | marks applied false when session already terminal | 会话已终结 |
| 11319 | applies clean_worker_execution_refs for worker orphans | 清理 worker 引用 |
| 11325 | cleans multiple orphan refs in single worker | 清理多个孤儿引用 |

### parseStepOutput (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 11457 | handles single line content | 单行内容 |
| 11567 | handles single word content | 单字内容 |

### FailoverController (3个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 11756 | initiateFailover rejects non-idle state | 非空闲状态 |
| 11779 | onFail callback is called on error | 错误回调 |
| 11783 | concurrent initiation attempts are rejected | 并发尝试 |

### LeaderElectionService (约12个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 11893-11930 | LeaderElectionService 系列测试 | HA 领导者选举 |

### Postgres/Redis Lock Adapter (约25个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 12338-12425 | PgAdvisoryLockAdapter / RedisLockAdapter 系列测试 | 锁适配器 |

### retryJob (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 12823 | returns null for non-dead-letter job | 非死信任务 |

### execution-plane-bootstrap (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 13562 | bootstrap is immutable | bootstrap 不可变 |

### sandbox (3个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 14119 | read-only workspace mode blocks write operations | 只读工作区 |
| 14120 | command execution populates data.injectionRisk | 注入风险 |
| 14121 | command failure with non-zero exit code returns failed status | 命令失败 |

### ToolExecutor (1个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 14315 | executeParallel reports failures in errors array | 并行执行失败 |

### WorkerRegistryService (3个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 14833 | issueChallenge normalizes and deduplicates capabilities | 能力规范化 |
| 14876 | listEligibleWorkers strict does not meet hardened requirement | 严格要求 |

### assessPromotion/calculateTrustScore (约15个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 15019-15068 | assessPromotion / calculateTrustScore / scoreSystemHealth 系列 | 信任评分和晋升 |

### detectAmbiguity (2个失败)
| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 15076 | treats confidence of 0.7 and above as not low | 0.7 及以上 |
| 15078 | with exact entity count matches required | 精确计数 |

### 其他零散失败

| # | 测试名称 | 错误描述 |
|---|---------|---------|
| 15094 | resolveTriggerActionMode handles undefined risk level | 未定义风险等级 |
| 15474 | normalizeError returns original AppError unchanged | 错误规范化 |
| 16419 | ChannelGatewayService resolves target by targetId directly | 目标解析 |
| 16877 | ingress module with mocks | 入口模块 |
| 17101 | LongRunningWorkflowService.sweepExpired with remain_pending | 过期工作流 |
| 17120-17149 | DequeueResult / nack 系列测试 | 队列操作 |
| 17206-17214 | WebhookIngressService 系列测试 | Webhook 入口 |
| 17356-17464 | BudgetGuard / estimateMessageTokens 系列 | 预算和令牌计算 |
| 17715-18062 | model routing / UnifiedChatProvider / SloAlertingService 系列 | 模型路由和 SLO |
| 18091 | StructuredLogger configureGlobalFileSink accepts file path string | 结构化日志 |
| 18167-18211 | BenchmarkRunner / ProposalEngine 系列 | 基准和提案 |
| 19166-19317 | ExperienceDistillationService / FailurePatternMiner / StrategyLearningService 系列 | 学习服务 |
| 19866-19881 | PlanSchema / PlanStepSchema 系列 | 计划模式 |
| 20612-20622 | ConnectorManifestSchema 系列 | 连接器清单 |
| 21569-21579 | ServiceRegistry 系列 | 服务注册表 |
| 22686-23228 | FairScheduler / HorizontalScalingController / EnvironmentReadinessOrchestrationService 系列 | 调度和扩展 |
| 23257-23276 | classifyPromptInjectionRisk / protectSystemPrompt 系列 | 安全分类 |
| 23287-23468 | StableAcceptanceLineReport / StableChaosSmoke / StableConcurrencyRehearsal 系列 | 稳定性测试 |
| 23767 | CheckpointManager | 检查点管理 |
| 23926-23933 | durable event bus 系列 | 持久事件总线 |
| 24000 | EventReliabilityInventoryService | 事件可靠性清单 |
| 26133-26134 | isSqliteWriteContentionError | SQLite 写争用 |
| 26183 | ExecutionRepository updateExecutionStatus | 执行仓储 |
| 26611-26632 | SessionDualStorageService 系列 | 会话双存储 |
| 26776 | AuthoritativeTaskStore with mocked database | 任务存储 |
| 26958-26986 | domainDefinition 系列 | 领域定义 |
| 27116-27170 | platform root / LoopDetectionState / buildContinuationPrompt 系列 | 平台根和循环检测 |
| 27766-27776 | routeComplexity / LoopDetectionState 系列 | 路由复杂度和循环检测 |
| 27805 | parseOptionalStringArray | 可选字符串数组解析 |
| 27888 | BillingServiceAsync throws for non-existent account | 计费服务 |
| 28013-28026 | assertIdentifier / monthWindow 系列 | 断言和窗口 |
| 28467-28516 | PerceptionService / PmfValidationService 系列 | 感知和 PMF 验证 |
| 29186-29235 | OpsHealthMonitorService / PlatformOperatorService 系列 | 运营健康监控 |
| 29339-29404 | isQuotaExceeded / TenantPlatformService / scale-ops 系列 | 配额和租户平台 |
| 29765-29769 | loadModelRoutingCliEnv 系列 | 模型路由 CLI |
| 29927 | create action does not require snapshotId | 创建操作 |
| 30383 | createTempWorkspace creates a temporary directory with correct prefix | 临时工作区 |

---

## 根因分析

1. **测试断言与实现不匹配** - 多个测试的预期值与实际实现不一致
2. **Mock 对象不完整** - mock 数据库/服务未正确模拟实际行为
3. **并发测试问题** - 测试并发执行时的竞态条件
4. **环境/配置问题** - 测试需要特定环境配置但未提供



### 建议

1. **对于测试断言错误**：需要检查测试文件中的断言是否与最新实现匹配
2. **对于 mock 问题**：需要更新 mock 对象以正确模拟实际服务行为
3. **对于并发问题**：考虑降低测试并发度或添加适当的同步机制

---

## 待处理任务清单

| 任务ID | 目录 | 失败数 | 状态 |
|-------|------|--------|------|
| #15 | unit/platform/shared/observability | 55 | 待处理 |
| #16 | unit/platform/state-evidence/memory | 24 | 待处理 |
| #17 | unit/platform/interface/channel-gateway | 16 | 待处理 |
| #18 | unit/platform/execution/worker-pool | 22 | 待处理 |
| #19 | unit/platform/model-gateway/provider-registry | 15 | 待处理 |
| #20 | unit/platform/state-evidence/knowledge | 33 | 待处理 |
| #21 | unit/platform/state-evidence/artifacts | 13 | 待处理 |
| #22 | unit/platform/orchestration/agent-delegation | 14 | 待处理 |
| #23 | 其他目录 | ~50 | 待处理 |
| #24 | unit/platform/state-evidence/events | 30 | 待处理 |
| #25 | unit/platform/orchestration/harness | 30 | 待处理 |
| #26 | unit/platform/shared/stability | 43 | 待处理 |
| #27 | unit/platform/state-evidence/truth | 84 | 待处理 |
| #28 | unit/platform/orchestration/oapeflir | 50 | 待处理 |
| #29 | unit/platform/shared/cache | 35 | 待处理 |
| #30 | unit/platform/interface/api | 52 | 待处理 |

**总计**: 354 个测试失败，分布在 16 个主要目录
