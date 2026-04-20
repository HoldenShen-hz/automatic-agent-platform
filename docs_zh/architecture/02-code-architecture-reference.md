# Automatic Agent Platform — 代码架构参考文档

> **版本**: v11.0
> **分析日期**: 2026-04-20
> **分析范围**: src/（1,170 文件, 220,534 行）、tests/（1,096 文件, 229,785 行）、config/、deploy/、divisions/
> **分析方法**: 逐目录静态分析 + 依赖追踪 + 测试覆盖对照 + 模式识别
> **文档定位**: 代码库现状的权威参考文档，记录实际架构、模块状态、技术债与重构基线

---

## 目录

1. [仓库总览与关键指标](#1-仓库总览与关键指标)
2. [模块清单与状态矩阵](#2-模块清单与状态矩阵)
3. [Platform 层深度分析](#3-platform-层深度分析)
4. [业务层深度分析](#4-业务层深度分析)
5. [核心调用链分析](#5-核心调用链分析)
6. [模块依赖与边界分析](#6-模块依赖与边界分析)
7. [代码质量分析](#7-代码质量分析)
8. [测试分析](#8-测试分析)
9. [配置与部署架构](#9-配置与部署架构)
10. [技术债与重构优先级](#10-技术债与重构优先级)
11. [结论](#11-结论)

---

## 1. 仓库总览与关键指标

### 1.1 代码规模

| 指标                | 数值                                                     |
| ------------------- | -------------------------------------------------------- |
| 源码文件 (`src/`)   | 1,170 个 `.ts` 文件                                      |
| 源码行数            | 220,534 行                                               |
| 测试文件 (`tests/`) | 1,096 个 `.test.ts` 文件                                 |
| 测试行数            | 229,785 行                                               |
| 测试/源码比         | 1.04:1                                                   |
| 顶层模块数          | 13 个                                                    |
| 配置文件            | 34 个 JSON（1,020 行）                                   |
| 部署文件            | 42 个（Helm + Terraform + Scripts + Monitoring + Chaos） |
| Division 定义       | 10 个（61 文件）                                         |
| npm 脚本            | 110+ 个                                                  |

### 1.2 源码模块规模分布

| 模块                   | 文件数 | 行数    | 占比  |
| ---------------------- | ------ | ------- | ----- |
| `src/platform/`        | 793    | 178,309 | 80.9% |
| `src/scale-ecosystem/` | 62     | 10,712  | 4.9%  |
| `src/sdk/`             | 93     | 8,557   | 3.9%  |
| `src/ops-maturity/`    | 86     | 6,964   | 3.2%  |
| `src/domains/`         | 35     | 5,842   | 2.6%  |
| `src/interaction/`     | 37     | 5,198   | 2.4%  |
| `src/org-governance/`  | 33     | 3,009   | 1.4%  |
| `src/plugins/`         | 20     | 1,672   | 0.8%  |
| `src/apps/`            | 4      | 50      | <0.1% |
| `src/core/`            | 8      | 29      | <0.1% |

### 1.3 技术栈

| 类别      | 选型                                                              |
| --------- | ----------------------------------------------------------------- |
| 语言      | TypeScript 5.8+ (strict, ESM, `noUncheckedIndexedAccess`)         |
| 运行时    | Node.js 22+                                                       |
| 数据库    | SQLite (WAL, better-sqlite3) + PostgreSQL (适配中)                |
| 缓存      | 内存 L1 + SQLite L2 + Redis L3 (ioredis ^5.10)                    |
| WebSocket | ws ^8.18                                                          |
| 可观测性  | OpenTelemetry (tracing + metrics)                                 |
| 验证      | Zod schema validation                                             |
| 测试      | `node:test` + `node:assert/strict` + c8 覆盖率 + Stryker 变异测试 |
| 构建      | tsc (ES2023 target, NodeNext module)                              |
| Lint      | ESLint 9 flat config + Prettier                                   |
| 容器      | 多阶段 Dockerfile, node:22-bookworm-slim                          |
| CI        | GitHub Actions (Node 20/22 矩阵)                                  |

### 1.4 判定标准：双维度状态体系

**维度 A — 实现状态**

| 状态        | 含义                                 |
| ----------- | ------------------------------------ |
| Not Started | 零代码或仅占位文件                   |
| Skeleton    | 接口/类型已定义，核心逻辑为空        |
| Partial     | 主路径已实现，次要路径或边界条件缺失 |
| Implemented | 功能代码完整，可编译通过             |

**维度 B — 生产可信度**

| 等级             | 含义                               |
| ---------------- | ---------------------------------- |
| Unverified       | 无专项测试，仅编译通过             |
| Test-covered     | 有单元/集成测试覆盖主路径          |
| Staging-verified | 已在类生产环境验证                 |
| Production-ready | 经流量验证、故障注入、监控闭环确认 |

> 当前代码库中**无模块达到 Staging-verified 或 Production-ready**。

### 1.5 架构阻塞项

| #   | 阻塞项                       | 严重度 | 说明                                                                                                          |
| --- | ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| B1  | PostgreSQL sync/async 双后端 | 高     | 同步 SQLite API 包装异步 PG 连接，双后端切换存在风险。5 组 sync/async 镜像文件（共 ~10 个文件）需要维护同步。 |
| B2  | E2E 测试覆盖不足             | 中     | `tests/e2e/` 仅 10 文件 2,807 行，覆盖 10 条流程                                                              |

---

## 2. 模块清单与状态矩阵

### 2.1 `src/platform/` 模块清单（793 文件, 178,309 行）

| 子模块          | 文件 | 行数   | 核心服务                                                                                                                             | 实现状态    | 生产可信度   |
| --------------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------ |
| execution/      | 173  | 46,455 | ExecutionDispatchService, ExecutionLeaseService, MultiStepSupervisor, TransitionService, PatchDslService                             | Implemented | Test-covered |
| state-evidence/ | 175  | 38,448 | AuthoritativeTaskStore, DurableEventBus, MemoryPlaneService, KnowledgePlaneService, WorkerRepository (1,057 行)                      | Implemented | Test-covered |
| control-plane/  | 96   | 29,165 | PolicyCenterService, DoctorService (782), EnterpriseGovernanceService (773), AutoStopLossService (768), CveIntelligenceService (748) | Implemented | Test-covered |
| shared/         | 113  | 26,784 | SloAlertingService (967), AnomalyDetectionService (795), DiagnosticsSupport (782), OutboxService, StructuredLogger                   | Implemented | Test-covered |
| interface/      | 58   | 11,637 | ChannelGatewayService (631), ChannelGatewayDeliveryService (786), HttpApiServer, ApiAuthService                                      | Implemented | Test-covered |
| orchestration/  | 91   | 10,118 | OapeflirLoopService (439), IntakeRouter (724), PlanBuilder, HitlApprovalOrchestrationService                                         | Implemented | Test-covered |
| model-gateway/  | 19   | 5,629  | UnifiedChatProvider (491), CircuitBreaker, ModelRoutingService                                                                       | Implemented | Test-covered |
| contracts/      | 37   | 4,585  | AppError + 14 子类 (526), 域类型, 信封契约                                                                                           | Implemented | Test-covered |
| prompt-engine/  | 19   | 3,889  | ConversationTemplateService (405), ExecutionOutcomeEvaluator, PromptRolloutService                                                   | Implemented | Test-covered |
| compliance/     | 9    | 1,480  | ComplianceCaseOrchestrationService (324)                                                                                             | Partial     | Unverified   |

### 2.2 业务层模块清单

| 模块             | 文件 | 行数   | 核心服务                                                                                                              | 实现状态    | 生产可信度   |
| ---------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------- | ----------- | ------------ |
| scale-ecosystem/ | 62   | 10,712 | BillingService (792), MarketplaceGovernanceService (788), TenantPlatformService (586), RegionHealthCheckService (462) | Implemented | Unverified   |
| sdk/             | 93   | 8,557  | PackLifecycleOrchestrationService (490), ApiClient (245), 77 CLI 脚本                                                 | Implemented | Test-covered |
| ops-maturity/    | 86   | 6,964  | EvolutionMvpService (645), SemverValidator (336), AgentLifecycleService (311), PlatformOpsAgentService (258)          | Partial     | Unverified   |
| domains/         | 35   | 5,842  | PluginSpiRegistry (829), PluginRuntimeHost (611), DivisionLoader (798), DomainRegistryService (251)                   | Implemented | Unverified   |
| interaction/     | 37   | 5,198  | NlGatewayService (681), DashboardWebSocketServer (382), GoalDecomposer (397), ProactiveAgentService (335)             | Implemented | Unverified   |
| org-governance/  | 33   | 3,009  | ScimSyncService (595), OidcService (397), HrRoleGovernanceService (571)                                               | Implemented | Unverified   |
| plugins/         | 20   | 1,672  | 5 Adapter + 6 Retriever + 3 Presenter + 1 Planner + 1 Evaluator                                                       | Implemented | Test-covered |
| apps/            | 4    | 50     | PlatformAppManifest (api/console/workers)                                                                             | Implemented | —            |
| core/            | 8    | 29     | 纯 re-export 兼容层，零原始逻辑                                                                                       | Legacy      | —            |

---

## 3. Platform 层深度分析

### 3.1 execution/（173 文件, 46,455 行）— 最大子模块

**架构模式**: Lease-based 并发控制 + 有限状态机 + Worker Pool 负载均衡 + 准入控制

**子目录结构**:

| 子目录            | 文件 | 行数    | 职责                                    |
| ----------------- | ---- | ------- | --------------------------------------- |
| execution-engine/ | 30   | ~12,000 | 多步执行监督、调用治理、runtime context |
| worker-pool/      | 13   | ~8,000  | Worker 握手、心跳、写回、调度           |
| dispatcher/       | 11   | ~5,000  | 任务分发、优先级抢占、背压控制          |
| tool-executor/    | 10   | ~4,500  | 工具执行、补丁 DSL、编辑替换链          |
| state-transition/ | 8    | ~4,000  | 执行状态机、转换服务                    |
| lease/            | 5    | ~3,500  | 租约获取/续约/释放、fencing token       |
| recovery/         | 6    | ~2,500  | 故障恢复、孤儿清理                      |
| startup/          | 5    | ~2,000  | 启动一致性、预检                        |
| queue/            | 4    | ~1,800  | 队列适配器                              |
| hot-upgrade/      | 3    | ~1,200  | 热升级验证                              |
| ha/               | 3    | ~800    | HA 协调（部分桩）                       |
| distributed-lock/ | 3    | ~600    | 分布式锁适配（SQLite/PG/Redis）         |
| resource/         | 2    | ~300    | 进程资源跟踪                            |
| plugin-executor/  | 2    | ~250    | 插件执行（薄层，委托 sandbox）          |

**关键服务**:

- `ExecutionDispatchService` (733 行): 创建执行票据，基于负载/亲和性/隔离度选择 Worker，实现背压和优先级抢占
- `ExecutionLeaseService` (796 行): 时间约束独占租约 + fencing token 防止脑裂
- `MultiStepSupervisor` (779 行): 多步工作流监督，含重试策略、检查点、崩溃注入
- `CallGovernance` (747 行): 单次模型/工具调用的治理
- `TransitionService` (734 行): 执行生命周期状态机转换
- `PatchDslService` (791 行): 文件编辑 DSL

**Sync/Async 镜像文件** (技术债):

- `execution-dispatch-service.ts` / `execution-dispatch-service-async.ts`
- `execution-worker-handshake-service.ts` / `execution-worker-handshake-service-async.ts`
- `execution-worker-writeback-service.ts` / `execution-worker-writeback-service-async.ts`

### 3.2 state-evidence/（175 文件, 38,448 行）

**架构模式**: Repository Pattern + Event Sourcing (轻量) + CQRS + DLQ

**子目录结构**:

| 子目录       | 文件 | 行数    | 职责                                         |
| ------------ | ---- | ------- | -------------------------------------------- |
| truth/       | 50+  | ~16,000 | 权威数据存储 (SQLite + PG)，22 个 Repository |
| knowledge/   | 15   | ~4,500  | 语义知识图谱、向量存储、摄取管道             |
| memory/      | 16   | ~3,500  | 多层记忆 (session/project/user)、晋升、合并  |
| events/      | 11   | ~2,500  | 持久化事件总线、类型化发布                   |
| artifacts/   | 8    | ~2,000  | 制品存储、发布、预览、敏感内容扫描           |
| audit/       | 5    | ~1,500  | 审计追踪、完整性验证                         |
| checkpoints/ | 4    | ~1,200  | 执行检查点                                   |
| projections/ | 2    | ~800    | 读模型投影                                   |
| incident/    | 3    | ~600    | 事件记录                                     |
| dlq/         | 1    | ~300    | 死信队列                                     |

**最大文件**: `WorkerRepository` (1,057 行 SQLite / 1,052 行 Async) — 覆盖 worker、ticket、lease、heartbeat 的全部 SQL 映射。

### 3.3 control-plane/（96 文件, 29,165 行）

**架构模式**: 策略引擎 + 命令管道 + 诊断聚合

| 子目录              | 核心服务                                                                                                      | 行数    |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| incident-control/   | DoctorService (782), EnterpriseGovernanceService (773), AutoStopLossService (768), HumanTakeoverService (741) | ~12,000 |
| iam/                | CveIntelligenceService (748), DataClassificationService (730), SandboxPolicyService, SecretManagementService  | ~8,000  |
| config-center/      | ConfigGovernanceService, BillingPlanCatalog, 29 个配置文件                                                    | ~4,000  |
| policy-center/      | PolicyCenterService (298) — kill-switch/RBAC/budget/scope 四层决策                                            | ~1,500  |
| approval-center/    | ApprovalService, ApprovalTimeoutExecutor                                                                      | ~1,200  |
| rollout-controller/ | RolloutStateMachine, RolloutScheduler, AutoRollbackService                                                    | ~1,000  |
| tenant/             | TenantService                                                                                                 | ~500    |
| risk-control/       | RiskEvaluationEngine                                                                                          | ~400    |
| cost-alert/         | CostAlertService                                                                                              | ~300    |
| audit-export/       | AuditExportService                                                                                            | ~200    |

### 3.4 shared/（113 文件, 26,784 行）

**架构模式**: 横切关注点 + SLO 驱动运维 + 演练/混沌模式

| 子目录                   | 核心能力                                                                                                                      | 行数    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| observability/ (34 文件) | SloAlertingService (967), AnomalyDetectionService (795), DiagnosticsSupport (782), StructuredLogger, HealthService, OTel 集成 | ~14,000 |
| stability/ (32 文件)     | Golden task runner, 演练套件 (dispatch/lease/worker/backup/chaos/migration/queue)                                             | ~8,000  |
| cache/                   | CacheFacade, 三级缓存 L1(内存)/L2(SQLite)/L3(Redis), 中间件/策略/存储                                                         | ~3,000  |
| outbox/ (6 文件)         | OutboxService (219) — 事务性 outbox 模式，可靠事件投递                                                                        | ~800    |
| scaling/                 | 自动伸缩策略                                                                                                                  | ~500    |
| lifecycle/               | ServiceRegistry, 单例管理                                                                                                     | ~300    |

### 3.5 其余 platform 子模块

| 子模块         | 文件 | 行数   | 要点                                                                      |
| -------------- | ---- | ------ | ------------------------------------------------------------------------- |
| interface/     | 58   | 11,637 | ChannelGateway (631+786 行双服务), HTTP/gRPC/GraphQL 适配, OIDC, 联邦路由 |
| orchestration/ | 91   | 10,118 | OAPEFLIR 8 阶段循环 (439 行), IntakeRouter (724 行), Planner, HITL, FSM   |
| model-gateway/ | 19   | 5,629  | 三提供商统一接口 (Anthropic/OpenAI/MiniMax, 491 行), 熔断器, 路由         |
| contracts/     | 37   | 4,585  | AppError 体系 (526 行, 14 子类), 域类型, 信封契约, ID 生成                |
| prompt-engine/ | 19   | 3,889  | 对话模板 (405 行), 评估器, 质量门, rollout                                |
| compliance/    | 9    | 1,480  | 合规编排 (324 行): 分类→治理→驻留→加密→溯源→擦除                          |

---

## 4. 业务层深度分析

### 4.1 scale-ecosystem/（62 文件, 10,712 行）

**最大子模块**: marketplace/ (27 文件, 7,954 行) — 上层最完整实现区域。

| 子模块            | 核心服务                                                                                                                                                                                                             | 行数  | 评估 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---- |
| marketplace/      | BillingService (792), MarketplaceGovernanceService (788), PerceptionService (656), DataPlaneFlowService (649), EnterpriseCapabilityMatrixService (641), TenantPlatformService (586), LicenseEnforcementService (584) | 7,954 | 完整 |
| feedback-loop/    | FeedbackImprovementService (157), FineTuningExporter (277), QualityGrader (257)                                                                                                                                      | 1,275 | 中等 |
| multi-region/     | RegionHealthCheckService (462), CdcReplicationService (328)                                                                                                                                                          | 926   | 中等 |
| integration/      | ConnectorFrameworkService (141)                                                                                                                                                                                      | ~300  | 桩   |
| resource-manager/ | FairSchedulingService (69)                                                                                                                                                                                           | ~200  | 桩   |
| sla-engine/       | SlaOperationsService (90)                                                                                                                                                                                            | ~200  | 桩   |

### 4.2 sdk/（93 文件, 8,557 行）

| 子模块      | 文件 | 行数  | 评估                                             |
| ----------- | ---- | ----- | ------------------------------------------------ |
| cli/        | 77   | 6,231 | 完整 — 77 个 CLI 入口点覆盖全部运维流程          |
| pack-sdk/   | 6    | 1,362 | 完整 — 生命周期编排 (490 行)、脚手架、兼容性检查 |
| plugin-sdk/ | 4    | 579   | 完整 — 定义 DSL、上下文注入、测试工具            |
| client-sdk/ | 2    | 246   | 完整 — HTTP 客户端 + 重试                        |
| workbench/  | 1    | 134   | 基础                                             |

### 4.3 ops-maturity/（86 文件, 6,964 行）

**特征**: 桩比例最高的模块 — 77 文件中 41 个 ≤ 20 行。

| 子模块              | 核心服务                                                                | 行数  | 评估                |
| ------------------- | ----------------------------------------------------------------------- | ----- | ------------------- |
| drift-detection/    | EvolutionMvpService (645), ProposalEngine (266), ReflectionEngine (152) | 2,399 | **完整** — 无桩文件 |
| version-management/ | SemverValidator (336), VersionCompatibilityMatrix (380)                 | 737   | 完整                |
| agent-lifecycle/    | AgentLifecycleService (311), AgentPerformanceProfiler (142)             | 994   | 中等                |
| explainability/     | SimplifiedExplainer (280), ExplanationPipelineService (121)             | ~600  | 中等                |
| platform-ops-agent/ | PlatformOpsAgentService (258) + 5 个桩子目录                            | ~300  | 部分                |
| workflow-debugger/  | TimeTravelDebugService (214) + 3 个桩子目录                             | ~350  | 部分                |
| chaos/              | ChaosExperimentScheduler (184)                                          | ~200  | 部分                |
| edge-runtime/       | EdgeRuntimeSyncService (143) + 4 个桩子目录                             | ~170  | 桩                  |
| multimodal/         | MultimodalGatewayService (178) + 4 个桩子目录                           | ~200  | 桩                  |
| emergency/          | PlatformPanicService (197) + 3 个桩子目录                               | ~230  | 部分                |
| capacity-planner/   | CapacityPlanningService (162) + 3 个桩子目录                            | ~190  | 桩                  |

### 4.4 domains/（35 文件, 5,842 行）

| 子模块         | 核心服务                                                                                            | 行数  | 评估    |
| -------------- | --------------------------------------------------------------------------------------------------- | ----- | ------- |
| registry/      | PluginSpiRegistry (829), PluginRuntimeHost (611), DomainRegistryService (251)                       | 2,753 | 完整    |
| governance/    | DivisionLoader (798), HrRoleGovernanceService (571)                                                 | 1,636 | 完整    |
| business-pack/ | BusinessPackManifest (497)                                                                          | 497   | 中等    |
| operations/    | DomainOnboardingService (161)                                                                       | ~200  | 中等    |
| 其他           | eval-framework, prompt-library, knowledge-schema, risk-profile, coding, recipes, interaction-policy | ~750  | 桩-中等 |

### 4.5 interaction/（37 文件, 5,198 行）

| 子模块           | 核心服务                                                                         | 行数  | 评估 |
| ---------------- | -------------------------------------------------------------------------------- | ----- | ---- |
| nl-gateway/      | NlGatewayService (681), DisambiguationHandler (396)                              | 1,270 | 完整 |
| dashboard/       | DashboardProjectionService (346), DashboardWebSocketServer (382)                 | 1,100 | 完整 |
| ux/              | ConversationHistoryService (304), OnboardingService (321), UxEventTracking (221) | 1,064 | 中等 |
| proactive-agent/ | ProactiveAgentService (335), UserPreferenceTracker (315)                         | 694   | 中等 |
| autonomy/        | AutonomyService (225)                                                            | 566   | 中等 |
| goal-decomposer/ | GoalDecomposer (397)                                                             | 493   | 中等 |

### 4.6 org-governance/（33 文件, 3,009 行）

| 子模块                | 核心服务                                                      | 行数  | 评估     |
| --------------------- | ------------------------------------------------------------- | ----- | -------- |
| sso-scim/             | ScimSyncService (595), OidcService (397), ApiKeyService (147) | 1,229 | **完整** |
| org-model/            | HrRoleGovernanceService (571), OrgHierarchy (174)             | 959   | 完整     |
| delegated-governance/ | DelegatedGovernanceService (193), ScopeManager (134)          | 406   | 中等     |
| approval-routing/     | ApprovalRoutingService (75)                                   | ~200  | 部分     |
| knowledge-boundary/   | KnowledgeBoundaryService (53)                                 | ~120  | 桩       |
| compliance-engine/    | ComplianceGovernanceService (58)                              | ~100  | 桩       |

### 4.7 plugins/（20 文件, 1,672 行）— 最干净的模块

零桩文件，全部为实际实现。SPI 模式: Adapter / Planner / Presenter / Retriever / Validator。
5 个适配器 (GitHub/CRM/GameDev/AssetProduction/Livestream)，6 个检索器，3 个展示器。

---

## 5. 核心调用链分析

### 5.1 任务提交 → 执行完成

```
HttpApiServer.handleRequest()
  → PolicyCenterService.evaluate()         // kill-switch / RBAC / budget / scope
  → IntakeRouter.route()                   // 基于关键词和触发模式路由到 Division
  → OapeflirLoopService.runLoop()          // OAPEFLIR 8 阶段循环
    → AssessmentService.assess()           // Observe + Assess
    → PlanBuilder.build()                  // Plan (DAG 验证)
    → ExecutionDispatchService.dispatch()  // Execute (创建票据、选择 Worker)
      → ExecutionLeaseService.acquire()    // 获取租约 + fencing token
      → MultiStepSupervisor.execute()      // 多步执行 + 检查点
        → CallGovernance.govern()          // 单次调用治理
        → UnifiedChatProvider.chat()       // LLM 调用 (Anthropic/OpenAI/MiniMax)
      → TransitionService.transition()     // 状态转换
      → ExecutionWorkerWritebackService.writeback()  // 结果写回 truth store
    → FeedbackCollector.collect()          // Feedback
    → StrategyLearningService.learn()      // Learn
    → EvolutionMvpService.propose()        // Improve
    → RolloutStateMachine.advance()        // Release
```

### 5.2 Worker 生命周期

```
ExecutionWorkerHandshakeService.claim()    // Worker 认领任务
  → ExecutionLeaseService.acquire()        // 租约绑定
  → heartbeatLoop()                        // 定期心跳续约
    → ExecutionLeaseService.renew()
  → executeAndReport()                     // 执行并报告
  → ExecutionWorkerWritebackService.writeback()  // 写回结果
  → ExecutionLeaseService.release()        // 释放租约
```

### 5.3 事件流

```
DurableEventBus.publish(event)
  → OutboxService.enqueue()                // 写入 outbox 表（同事务）
  → OutboxService.poll()                   // 异步轮询
  → TypedEventPublisher.emit()             // 类型化事件分发
  → subscriber handlers                    // 订阅者处理
  → ack / DLQ                              // 确认或死信队列
```

---

## 6. 模块依赖与边界分析

### 6.1 依赖层次图

```
Layer 0 (基础):  contracts/ ← 全部模块引用
Layer 1 (横切):  shared/ (observability, outbox, stability, cache)
Layer 2 (存储):  state-evidence/ (truth, events, memory, knowledge)
Layer 3 (执行):  execution/ ←→ model-gateway/
Layer 4 (控制):  control-plane/ ← execution/ + state-evidence/
Layer 5 (编排):  orchestration/ → prompt-engine/ + scale-ecosystem/
Layer 6 (接口):  interface/ → execution/ + control-plane/ + orchestration/
Layer 7 (合规):  compliance/ → control-plane/iam/ + org-governance/
```

### 6.2 业务层对 platform 的依赖

| 业务模块         | platform 引用数 | 耦合度                                             |
| ---------------- | --------------- | -------------------------------------------------- |
| sdk/             | 25+             | 最重 — 作为用户层，覆盖全部 platform 服务          |
| scale-ecosystem/ | 25+             | 重 — marketplace 深度集成 config、billing、state   |
| domains/         | 16              | 中 — 主要引用 contracts、config、execution、events |
| interaction/     | 14              | 中 — 引用 routing、events、memory、projections     |
| ops-maturity/    | 10              | 轻 — 主要引用 contracts、approval、truth           |
| org-governance/  | 5               | 最轻 — 仅引用 contracts、approval、tool-executor   |
| plugins/         | 3               | 极轻 — 仅引用 plugin-spi、contracts、egress-policy |

### 6.3 潜在耦合风险

| 风险     | 涉及模块                     | 说明                                                                                                          |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 双向依赖 | control-plane/ ↔ execution/  | incident-control 引用 execution 子模块，execution 引用 config-center 和 iam。不同子路径，非真循环，但耦合紧密 |
| 双向依赖 | state-evidence/ ↔ execution/ | truth 引用 execution-engine 的 runtime-context，execution 重度依赖 truth                                      |
| 扇出过宽 | sdk/                         | CLI 脚本直接引用 platform 内部服务，跳过抽象层                                                                |

---

## 7. 代码质量分析

### 7.1 桩/占位文件统计

| 模块             | ≤ 1 行 | 2-10 行 | 11-20 行 | 总桩数  | 占比      |
| ---------------- | ------ | ------- | -------- | ------- | --------- |
| platform/        | 17     | 20      | 12       | 49      | 6.2%      |
| ops-maturity/    | 2      | 25      | 14       | 41      | 47.7%     |
| scale-ecosystem/ | 0      | 12      | 11       | 23      | 37.1%     |
| interaction/     | 0      | 4       | 6        | 10      | 27.0%     |
| org-governance/  | 0      | 6       | 8        | 14      | 42.4%     |
| domains/         | 0      | 3       | 5        | 8       | 22.9%     |
| **总计**         | **19** | **70**  | **56**   | **145** | **12.4%** |

**关键观察**: `contracts/projection-update/index.ts` 和 `contracts/evidence-record/index.ts` 为 **0 行空文件**。

### 7.2 大文件 TOP 10（> 700 行）

| 文件                                                              | 行数  | 所属模块       |
| ----------------------------------------------------------------- | ----- | -------------- |
| state-evidence/truth/sqlite/repositories/worker-repository.ts     | 1,057 | state-evidence |
| state-evidence/truth/async-repositories/worker-repository.ts      | 1,052 | state-evidence |
| shared/observability/slo-alerting-service.ts                      | 967   | shared         |
| state-evidence/truth/sqlite/repositories/operations-repository.ts | 868   | state-evidence |
| execution/lease/execution-lease-service.ts                        | 796   | execution      |
| shared/observability/anomaly-detection-service.ts                 | 795   | shared         |
| state-evidence/truth/sqlite/repositories/billing-repository.ts    | 793   | state-evidence |
| execution/tool-executor/patch-dsl-service.ts                      | 791   | execution      |
| execution/worker-pool/execution-worker-handshake-service.ts       | 789   | execution      |
| interface/channel-gateway/channel-gateway-delivery-service.ts     | 786   | interface      |

### 7.3 Sync/Async 镜像重复（技术债）

5 组文件存在 sync (SQLite) / async (PostgreSQL) 镜像，逻辑近乎完全相同：

| Sync 文件                             | Async 文件                              | 行数          |
| ------------------------------------- | --------------------------------------- | ------------- |
| worker-repository.ts                  | async-repositories/worker-repository.ts | 1,057 / 1,052 |
| execution-dispatch-service.ts         | execution-dispatch-service-async.ts     | ~730 / ~730   |
| execution-worker-handshake-service.ts | -async.ts                               | ~789 / ~789   |
| execution-worker-writeback-service.ts | -async.ts                               | ~734 / ~734   |
| durable-event-bus.ts                  | durable-event-bus-async.ts              | ~407 / ~407   |

**根因**: better-sqlite3 是同步 API，PostgreSQL 是异步 API，两者无法共享抽象层。
**估计重复代码**: ~3,700 行。

---

## 8. 测试分析

### 8.1 测试规模

| 类别        | 文件数    | 行数        | test()/it() 数 |
| ----------- | --------- | ----------- | -------------- |
| 单元测试    | 782       | 168,968     | 9,171          |
| 集成测试    | 289       | 53,317      | 1,103          |
| Golden 测试 | 8         | 1,330       | 57             |
| E2E 测试    | 10        | 2,807       | 29             |
| 性能测试    | 6         | 874         | 16             |
| Fixture     | 1         | 235         | 12             |
| **总计**    | **1,096** | **229,785** | **10,388**     |

### 8.2 单元测试覆盖分布

| 目标模块              | 测试文件 | 测试行数 |
| --------------------- | -------- | -------- |
| platform/             | 564      | 124,290  |
| runtime/ (旧路径兼容) | 45       | 15,050   |
| scale-ecosystem/      | 44       | 9,130    |
| ops-maturity/         | 32       | 5,406    |
| domains/              | 27       | 5,341    |
| interaction/          | 21       | 3,177    |
| plugins/              | 18       | 2,644    |
| org-governance/       | 12       | 2,135    |
| sdk/                  | 12       | 1,409    |
| apps/                 | 4        | 386      |

### 8.3 覆盖率基线

全局最低要求: **84.1% lines, 82.8% functions, 79.8% branches**

| 覆盖率区间 | 典型模块                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| 95-100%    | constants, cost, stability, deployment, lifecycle, compliance, learning, config, artifacts |
| 85-95%     | events, feedback, memory, knowledge, observability, execution, cache                       |
| 75-85%     | api, approval, agent-loop, evolution, improvement                                          |
| < 75%      | types (6.8%), queue (68.7%), locking (69.6%), providers (71.3%)                            |

### 8.4 E2E 测试场景

| 测试                 | 覆盖场景                |
| -------------------- | ----------------------- |
| task-lifecycle       | 任务完整生命周期        |
| oapeflir-full-loop   | OAPEFLIR 8 阶段完整循环 |
| multi-step-workflow  | 多步工作流              |
| lease-recovery       | 租约故障恢复            |
| approval-event-flow  | 审批事件流              |
| session-memory-flow  | 会话记忆流              |
| gateway-webhook-flow | 网关 Webhook 流         |
| streaming-response   | 流式响应                |
| error-propagation    | 错误传播                |
| operator-takeover    | 人工接管                |

### 8.5 测试工具链

- 19 个 helper 文件 (2,120 行): api.ts, fixtures/, concurrent-runner.ts, typed-factories.ts, integration-context.ts, e2e-harness.ts, seed.ts, golden.ts, repository-harness.ts
- Stryker 变异测试: 覆盖关键 API 路由、agent-loop、redis-client，阈值 break=50%
- c8 覆盖率报告: text/html/lcov/json-summary

---

## 9. 配置与部署架构

### 9.1 配置体系（34 文件, 1,020 行）

| 配置目录            | 文件 | 用途                                      |
| ------------------- | ---- | ----------------------------------------- |
| bootstrap/          | 1    | 平台启动参数                              |
| conversation/       | 1    | 对话模板 (81 行)                          |
| cost-alert/         | 1    | 成本告警阈值                              |
| domains/            | 1    | 领域定义 (131 行)                         |
| dr/                 | 1    | 灾难恢复参数                              |
| environments/       | 5    | 环境覆盖 (dev/staging/pre-prod/prod/test) |
| exception-recovery/ | 1    | 异常分类 + 重试策略 (129 行)              |
| knowledge/          | 1    | 知识系统设置                              |
| nl-gateway/         | 1    | NL 网关路由                               |
| plugins/            | 1    | 插件默认配置 (73 行)                      |
| product/            | 1    | 产品配置 (107 行)                         |
| providers/          | 3    | LLM 模型定义 (含 bundled models)          |
| quality/            | 1    | 质量阈值                                  |
| risk/               | 1    | 风险评估规则 (82 行)                      |
| runtime/            | 6    | 运行时参数 (per-env)                      |
| security/           | 6    | 安全策略 (per-env)                        |
| workflows/          | 1    | 工作流默认值                              |

### 9.2 部署架构（42 文件）

| 组件       | 文件数 | 要点                                                                                 |
| ---------- | ------ | ------------------------------------------------------------------------------------ |
| Helm Chart | 15     | K8s deployment/service/ingress/HPA/PDB/secrets + 5 环境 values                       |
| Terraform  | 7      | EKS + RDS + ElastiCache + ECR 模块化 IaC, 3 环境 tfvars                              |
| Scripts    | 4      | deploy.sh (209 行), dr-drill.sh (568 行), rollback.sh (94 行), verify-hot-upgrade.sh |
| Prometheus | 3      | 告警规则、alertmanager、prometheus 配置                                              |
| Grafana    | 2      | 仪表盘 JSON (341 行) + provisioning                                                  |
| Chaos      | 4      | network-delay, pod-kill, postgres-disconnect, redis-disconnect                       |

### 9.3 Division 定义（10 个, 61 文件）

每个 Division 包含: `division.yaml` + `roles/*.prompt.md` + `schemas/minimal-output.json` + `workflows/*.yaml`

覆盖领域: analytics, content, design, devops, engineering_ops, general_ops, operations, qa, research, security

---

## 10. 技术债与重构优先级

### 10.1 P0 — 架构阻塞

| #   | 债务项                                          | 影响                     | 建议方案                                           | 估算       |
| --- | ----------------------------------------------- | ------------------------ | -------------------------------------------------- | ---------- |
| 1   | Sync/Async 镜像文件 (~3,700 行重复)             | 维护成本翻倍，一致性风险 | 抽象 StoragePort 接口，sync/async 实现共享业务逻辑 | 10-15 人天 |
| 2   | 空契约文件 (projection-update, evidence-record) | 契约层不完整             | 实现完整契约类型定义                               | 1 人天     |

### 10.2 P1 — 高优改进

| #   | 债务项                     | 影响                 | 建议方案                                                   | 估算       |
| --- | -------------------------- | -------------------- | ---------------------------------------------------------- | ---------- |
| 3   | 145 个桩文件 (12.4%)       | 接口承诺但无实现     | 按模块优先级逐步填充，或删除不会实现的桩                   | 20-30 人天 |
| 4   | ops-maturity/ 桩比例 47.7% | 运维成熟度功能不可用 | 聚焦 edge-runtime 和 multimodal 两个关键桩区域             | 8-12 人天  |
| 5   | WorkerRepository 1,057 行  | God-class 风险       | 拆分为 WorkerRepo + TicketRepo + LeaseRepo + HeartbeatRepo | 3-5 人天   |
| 6   | E2E 测试仅 10 场景         | 回归风险             | 扩展到 25+ 场景，覆盖错误路径和边界条件                    | 5-8 人天   |

### 10.3 P2 — 建议改进

| #   | 债务项                                              | 建议方案                 | 估算     |
| --- | --------------------------------------------------- | ------------------------ | -------- |
| 7   | sdk/ CLI 直接引用 platform 内部服务                 | 引入 SDK facade 层       | 5-8 人天 |
| 8   | scale-ecosystem/resource-manager 和 sla-engine 为桩 | 填充核心调度和 SLA 逻辑  | 5-8 人天 |
| 9   | org-governance/ 合规子模块为桩                      | 按合规需求优先级填充     | 3-5 人天 |
| 10  | types 目录覆盖率仅 6.8%                             | 类型文件可豁免覆盖率要求 | 0.5 人天 |

---

## 11. 结论

### 代码库健康度总览

| 维度       | 评级  | 说明                                                          |
| ---------- | ----- | ------------------------------------------------------------- |
| 架构一致性 | ★★★★☆ | 13 模块分层清晰，contracts 作为共享核心，依赖方向基本正确     |
| 实现完成度 | ★★★☆☆ | 核心执行链完整，但 145 个桩文件 (12.4%) 表明部分功能仅有接口  |
| 测试覆盖   | ★★★★☆ | 10,388 个断言，84%+ 行覆盖率，但 E2E 偏弱                     |
| 代码质量   | ★★★☆☆ | 严格 TypeScript 配置，但 sync/async 重复和大文件需要关注      |
| 运维就绪   | ★★★☆☆ | Helm/Terraform/Prometheus/Chaos 完整，但未经生产验证          |
| 安全实践   | ★★★★☆ | 沙箱隔离、路径检查、egress 策略、CVE 追踪、数据分类全部有实现 |

### 关键数字

- **1,170** 源文件，**220,534** 行 TypeScript
- **1,096** 测试文件，**229,785** 行测试代码
- **10,388** 个测试断言
- **84.1%** 行覆盖率基线
- **10** 个 Division 领域定义
- **110+** npm 脚本
- **42** 部署文件（Helm + Terraform + Monitoring + Chaos）
- **145** 个桩文件待填充
- **~3,700** 行 sync/async 重复代码待消除
