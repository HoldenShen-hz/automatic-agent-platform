# Automatic Agent Platform — 代码架构参考文档

> **版本**: v12.0
> **分析日期**: 2026-04-20
> **分析范围**: src/（1,233 文件, 246,677 行）、tests/（1,155 文件, 250,208 行）、config/（34 文件）、deploy/（42 文件）、divisions/（11 个, 61 文件）
> **分析方法**: 逐目录静态分析 + 依赖追踪 + 测试覆盖对照 + 模式识别 + 设计文档交叉验证
> **文档定位**: 代码库现状的权威参考文档，记录实际架构、模块状态、技术债与重构基线
> **关联文档**: `00-platform-architecture.md` v2.7（设计规范）、`reviews/architecture-design-vs-implementation-review.md`（差距评审）

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

| 指标                | 数值                                                       |
| ------------------- | ---------------------------------------------------------- |
| 源码文件 (`src/`)   | 1,233 个 `.ts` 文件                                        |
| 源码行数            | 246,677 行                                                 |
| 测试文件 (`tests/`) | 1,155 个 `.test.ts` 文件                                   |
| 测试行数            | 250,208 行                                                 |
| 测试/源码比         | 1.01:1                                                     |
| 顶层模块数          | 10 个独立模块 + platform/ 含 13 子模块                     |
| 配置文件            | 34 个 JSON                                                 |
| 部署文件            | 42 个（Helm + Terraform + Scripts + Monitoring + Chaos）   |
| Division 定义       | 11 个（61 文件）                                           |
| npm 脚本            | 82+ 个（含 20 个 stable-\* 演练脚本）                      |
| 运行时依赖          | 10 个（zod, ioredis, postgres, ws, OTel 5 包, typescript） |
| 开发依赖            | 13 个（eslint, prettier, c8, stryker, tsx, husky 等）      |

### 1.2 源码模块规模分布

| 模块                   | 文件数    | 行数        | 占比  | Stub 数 | Stub 率   |
| ---------------------- | --------- | ----------- | ----- | ------- | --------- |
| `src/platform/`        | 839       | 197,077     | 79.9% | 88      | 10.5%     |
| `src/scale-ecosystem/` | 67        | 15,069      | 6.1%  | 22      | 32.8%     |
| `src/sdk/`             | 93        | 8,586       | 3.5%  | 25      | 26.9%     |
| `src/domains/`         | 47        | 8,573       | 3.5%  | 9       | 19.1%     |
| `src/ops-maturity/`    | 82        | 6,769       | 2.7%  | 42      | **51.2%** |
| `src/interaction/`     | 37        | 5,211       | 2.1%  | 10      | 27.0%     |
| `src/org-governance/`  | 33        | 3,449       | 1.4%  | 13      | **39.4%** |
| `src/plugins/`         | 20        | 1,672       | 0.7%  | 0       | **0%**    |
| `src/apps/`            | 4         | 50          | <0.1% | 4       | 100%\*    |
| `src/core/`            | 8         | 29          | <0.1% | 8       | 100%\*    |
| `src/testing/`         | 1         | 21          | <0.1% | —       | —         |
| `src/benchmarks/`      | 1         | 74          | <0.1% | —       | —         |
| **总计**               | **1,233** | **246,677** | 100%  | **221** | **17.9%** |

> \*`apps/` 为纯 manifest 声明，`core/` 为纯 re-export 兼容层，两者均属设计意图。

### 1.3 技术栈

| 类别      | 选型                                                              |
| --------- | ----------------------------------------------------------------- |
| 语言      | TypeScript 5.8+ (strict, ESM, `noUncheckedIndexedAccess`)         |
| 运行时    | Node.js 22+                                                       |
| 数据库    | SQLite (WAL) — 55 表 + PostgreSQL — 75+ 表（双后端适配）          |
| 缓存      | 内存 L1 + SQLite L2 + Redis L3 (ioredis ^5.10)                    |
| WebSocket | ws ^8.18                                                          |
| 可观测性  | OpenTelemetry (tracing + metrics)                                 |
| 验证      | Zod ^3.25 schema validation                                       |
| 测试      | `node:test` + `node:assert/strict` + c8 覆盖率 + Stryker 变异测试 |
| 构建      | tsc (ES2023 target, NodeNext module)                              |
| Lint      | ESLint 9 flat config + Prettier                                   |
| 容器      | 多阶段 Dockerfile, node:22-bookworm-slim                          |

### 1.4 判定标准：双维度状态体系

**维度 A — 实现状态**: Not Started → Skeleton → Partial → Implemented
**维度 B — 生产可信度**: Unverified → Test-covered → Staging-verified → Production-ready

> 当前代码库中**无模块达到 Staging-verified 或 Production-ready**。

### 1.5 架构阻塞项

| #   | 阻塞项                       | 严重度 | 说明                                                 |
| --- | ---------------------------- | ------ | ---------------------------------------------------- |
| B1  | PostgreSQL sync/async 双后端 | 高     | 7 组 sync/async 镜像文件（~14 文件），维护同步成本高 |
| B2  | E2E 测试覆盖不足             | 中     | `tests/e2e/` 仅 10 文件 2,807 行，覆盖 10 条流程     |

---

## 2. 模块清单与状态矩阵

### 2.1 `src/platform/` 模块清单（839 文件, 197,077 行）

| 子模块            | 文件 | 行数   | 核心服务                                                                              | 实现状态    | 可信度       |
| ----------------- | ---- | ------ | ------------------------------------------------------------------------------------- | ----------- | ------------ |
| execution/        | 177  | 48,934 | ExecutionDispatchService, ExecutionLeaseService, MultiStepSupervisor, PatchDslService | Implemented | Test-covered |
| state-evidence/   | 201  | 47,737 | AuthoritativeTaskStore, DurableEventBus, WorkerRepository (1,057), 55 SQLite 表       | Implemented | Test-covered |
| control-plane/    | 107  | 35,556 | PolicyCenterService, DoctorService, AutoStopLossService, CveIntelligenceService       | Implemented | Test-covered |
| shared/           | 113  | 26,794 | SloAlertingService (967), AnomalyDetectionService (795), OutboxService                | Implemented | Test-covered |
| interface/        | 62   | 12,080 | HttpApiServer (50+ 路由, 13 路由文件), ChannelGatewayService, ConsoleRoutes (461)     | Implemented | Test-covered |
| orchestration/    | 91   | 10,118 | OapeflirLoopService (439), IntakeRouter (724), AgentDelegation (8 文件 1,803 行)      | Implemented | Test-covered |
| model-gateway/    | 19   | 5,629  | UnifiedChatProvider (491), CircuitBreaker, ModelRoutingService                        | Implemented | Test-covered |
| contracts/        | 37   | 4,585  | AppError (526, 14 子类), PromptBundle 类型系统 (99), 信封契约                         | Implemented | Test-covered |
| prompt-engine/    | 19   | 4,020  | HierarchicalRegistryService (480), PromptVersionManager (213), PromptRolloutService   | Implemented | Test-covered |
| compliance/       | 9    | 1,483  | ComplianceCaseOrchestrationService (324)                                              | Partial     | Unverified   |
| cost-management/  | 1    | 26     | 占位模块                                                                              | Skeleton    | —            |
| agent-delegation/ | 1    | 69     | re-export（实际实现在 orchestration/agent-delegation/）                               | Legacy      | —            |
| prompt-registry/  | 1    | 30     | 占位模块                                                                              | Skeleton    | —            |

### 2.2 业务层模块清单

| 模块             | 文件 | 行数   | 核心服务                                                                                  | 实现状态    | 可信度       |
| ---------------- | ---- | ------ | ----------------------------------------------------------------------------------------- | ----------- | ------------ |
| scale-ecosystem/ | 67   | 15,069 | BillingService (792), MarketplaceGovernanceService (788), ConnectorFrameworkService (141) | Implemented | Unverified   |
| sdk/             | 93   | 8,586  | PackLifecycleOrchestrationService (490), 79 CLI 入口点 (含 22 stable-\*)                  | Implemented | Test-covered |
| ops-maturity/    | 82   | 6,769  | EvolutionMvpService (645), EdgeRuntimeSyncService (143), PlatformOpsAgentService (10)     | Partial     | Unverified   |
| domains/         | 47   | 8,573  | PluginSpiRegistry (829), PluginRuntimeHost (611), DivisionLoader (798)                    | Implemented | Unverified   |
| interaction/     | 37   | 5,211  | NlGatewayService (681), GoalDecomposer (397), DashboardWebSocketServer (382)              | Implemented | Unverified   |
| org-governance/  | 33   | 3,449  | ScimProvisionService (828), OidcIdentityService (432), SamlService (186)                  | Implemented | Unverified   |
| plugins/         | 20   | 1,672  | 5 Adapter + 6 Retriever + 3 Presenter + 1 Planner + 1 Evaluator（零桩文件）               | Implemented | Test-covered |
| apps/            | 4    | 50     | PlatformAppManifest (api/console/workers)                                                 | Implemented | —            |
| core/            | 8    | 29     | 纯 re-export 兼容层                                                                       | Legacy      | —            |

---

## 3. Platform 层深度分析

### 3.1 execution/（177 文件, 48,934 行）— 最大子模块

| 子目录            | 文件 | 行数    | 职责                                                                |
| ----------------- | ---- | ------- | ------------------------------------------------------------------- |
| tool-executor/    | 36   | ~13,500 | 工具执行、沙箱、补丁 DSL、文件系统工具                              |
| execution-engine/ | 30   | ~7,800  | 多步编排、循环检测、中间件、上下文压缩                              |
| recovery/         | 8    | ~943   | 执行恢复、重放、修复                                                |
| ha/               | 17   | ~6,000  | HA 协调、故障转移                                                   |
| worker-pool/      | 19   | ~3,300  | Worker 握手、写回、注册、负载均衡                                   |
| dispatcher/       | 11   | ~3,000  | 准入控制、分发服务                                                  |
| state-transition/ | 8    | ~4,000  | 执行状态机、转换服务                                                |
| lease/            | 5    | ~3,500  | 租约获取/续约/释放、fencing token                                   |
| startup/          | 5    | ~2,000  | 启动一致性、预检                                                    |
| queue/            | 4    | ~1,800  | 队列适配器                                                          |
| plugin-executor/  | 23   | ~6,600  | 插件执行（4 层沙箱: none/process/container/scoped_external_access） |
| hot-upgrade/      | 3    | ~1,200  | 热升级验证                                                          |
| distributed-lock/ | 8    | ~635    | 分布式锁（SQLite/PG/Redis）                                         |
| resource/         | 2    | ~365    | 进程资源跟踪                                                        |

### 3.2 state-evidence/（201 文件, 47,737 行）

| 子目录       | 文件 | 行数    | 职责                                                 |
| ------------ | ---- | ------- | ---------------------------------------------------- |
| truth/       | 112  | ~29,100 | 权威数据存储，55 SQLite 表 + PG 迁移，22+ Repository |
| knowledge/   | 15   | ~4,500  | 语义知识、向量存储、摄取管道                         |
| memory/      | 16   | ~3,500  | 多层记忆 (session/project/user)                      |
| events/      | 11   | ~2,500  | 持久化事件总线、类型化发布                           |
| artifacts/   | 8    | ~2,000  | 制品存储、发布、敏感内容扫描                         |
| audit/       | 5    | ~1,500  | 审计追踪、完整性验证                                 |
| checkpoints/ | 4    | ~1,200  | 执行检查点                                           |
| projections/ | 2    | ~800    | 读模型投影                                           |
| incident/    | 3    | ~600    | 事件记录                                             |
| dlq/         | 1    | ~300    | 死信队列                                             |

### 3.3 control-plane/（107 文件, 35,556 行）

| 子目录              | 文件 | 行数    | 核心服务                                                                  |
| ------------------- | ---- | ------- | ------------------------------------------------------------------------- |
| incident-control/   | 24   | ~10,800 | DoctorService, AutoStopLossService, HumanTakeoverService, RunbookExecutor |
| config-center/      | 31   | ~8,600  | 29 个环境配置加载器, ConfigGovernanceService, 版本化                      |
| iam/                | 20   | ~7,250  | PolicyEngine, SandboxPolicy, Secrets (Vault/AWS KMS/GCP), CVE             |
| approval-center/    | 11   | ~3,800  | ApprovalFlowEngine (962), 法定人数、升级、多方审批                        |
| compliance/         | 6    | ~2,200  | 数据驻留、加密密钥、擦除请求/报告                                         |
| rollout-controller/ | 5    | ~1,000  | RolloutStateMachine, AutoRollbackService                                  |
| tenant/             | 4    | ~500    | TenantService                                                             |
| risk-control/       | 3    | ~400    | RiskEvaluationEngine                                                      |
| cost-alert/         | 2    | ~300    | CostAlertService                                                          |
| audit-export/       | 1    | ~200    | AuditExportService                                                        |

### 3.4 其余 platform 子模块

| 子模块         | 文件 | 行数   | 要点                                                                 |
| -------------- | ---- | ------ | -------------------------------------------------------------------- |
| shared/        | 113  | 26,794 | SLO 告警 (967), 异常检测 (795), 三级缓存, Outbox, OTel, 演练套件     |
| interface/     | 62   | 12,080 | 50+ REST 路由 (13 路由文件), ChannelGateway, Console HTML, WebSocket |
| orchestration/ | 91   | 10,118 | OAPEFLIR 8 阶段 (439), IntakeRouter (724), Agent 委派 (1,803), HITL  |
| model-gateway/ | 19   | 5,629  | 三提供商 (Anthropic/OpenAI/MiniMax), 熔断器, 路由, 降级              |
| contracts/     | 37   | 4,585  | AppError (526, 14 子类), PromptBundle (99), 信封契约                 |
| prompt-engine/ | 19   | 4,020  | 层级注册表 (480), 版本管理 (213), Eval, Rollout                      |
| compliance/    | 9    | 1,483  | 合规编排: 分类→治理→驻留→加密→溯源→擦除                              |

---

## 4. 业务层深度分析

### 4.1 scale-ecosystem/（67 文件, 15,069 行）

| 子模块            | 文件 | 行数   | 核心服务                                                                            | 评估 |
| ----------------- | ---- | ------ | ----------------------------------------------------------------------------------- | ---- |
| marketplace/      | 32   | 11,972 | BillingService (792), MarketplaceGovernance (788), TenantPlatform (586), 3 支付网关 | 完整 |
| feedback-loop/    | 11   | 1,275  | FeedbackImprovementService, FineTuningExporter (277), QualityGrader (257)           | 中等 |
| multi-region/     | 7    | 1,265  | RegionHealthCheckService (462), CdcReplicationService (328), FailoverController     | 中等 |
| integration/      | 5    | 203    | ConnectorFrameworkService (141) — 框架完整，无实际连接器适配器                      | 薄   |
| sla-engine/       | 5    | 142    | SlaOperationsService (90) — 仅 Zod schema + 简单逻辑                                | 桩   |
| resource-manager/ | 5    | 118    | FairSchedulingService (69) — 仅基础队列逻辑                                         | 桩   |

### 4.2 sdk/（93 文件, 8,586 行）

| 子模块      | 文件 | 行数  | 评估                                                      |
| ----------- | ---- | ----- | --------------------------------------------------------- |
| cli/        | 79   | 6,231 | 79 个 CLI 入口点（含 22 个 stable-\* 演练脚本，工厂模式） |
| pack-sdk/   | 6    | 1,362 | 生命周期编排 (490), 脚手架, 兼容性检查                    |
| plugin-sdk/ | 4    | 579   | definePlugin/defineTool/defineAdapter DSL, 测试工具       |
| client-sdk/ | 2    | 249   | HTTP 客户端 + URL 构建器                                  |
| workbench/  | 1    | 137   | 快照构建, 安装计划, 发布就绪检查                          |

### 4.3 ops-maturity/（82 文件, 6,769 行）— Stub 率最高

| 子模块               | 文件 | 行数  | 核心服务                                                    | 评估                   |
| -------------------- | ---- | ----- | ----------------------------------------------------------- | ---------------------- |
| drift-detection/     | 15   | 2,399 | EvolutionMvpService (645), ProposalEngine, ReflectionEngine | **完整**               |
| agent-lifecycle/     | 8    | 994   | AgentLifecycleService (311), PerformanceProfiler            | 中等                   |
| version-management/  | 3    | 738   | SemverValidator (336), CompatibilityMatrix (380)            | 完整                   |
| explainability/      | 7    | 621   | ExplanationPipeline (121), SimplifiedExplainer (280)        | 中等                   |
| workflow-debugger/   | 6    | 353   | TimeTravelDebugService (214) + 3 桩子目录                   | 部分                   |
| multimodal/          | 7    | 269   | MultimodalGatewayService (187) + **4 桩处理器**             | **网关真实, 处理器桩** |
| emergency/           | 5    | 229   | PlatformPanicService (197) + 3 桩子目录                     | 部分                   |
| monitoring/          | 1    | 198   | AnomalyDetectionService                                     | 中等                   |
| capacity-planner/    | 5    | 193   | CapacityPlanningService (162) + 3 桩子目录                  | **桩**                 |
| chaos/               | 1    | 184   | ChaosExperimentScheduler                                    | 部分                   |
| edge-runtime/        | 6    | 177   | EdgeRuntimeSyncService (143) + **4 桩子模块**               | **同步真实, 子模块桩** |
| compliance-reporter/ | 5    | 174   | ComplianceReportPipeline + 3 桩子目录                       | **桩**                 |
| cost-optimizer/      | 5    | 153   | CostOptimizationService + 3 桩子目录                        | **桩**                 |
| platform-ops-agent/  | 7    | 40    | PlatformOpsAgentService (**10 行, 无类体**) + 5 桩          | **桩**                 |

### 4.4 domains/（47 文件, 8,573 行）

| 子模块         | 文件 | 行数   | 核心服务                                                          | 评估    |
| -------------- | ---- | ------ | ----------------------------------------------------------------- | ------- |
| registry/      | 15   | 2,753  | PluginSpiRegistry (829), PluginRuntimeHost (611, Fork/Container)  | 完整    |
| governance/    | 5    | 1,636  | DivisionLoader (798), HrRoleGovernanceService                     | 完整    |
| business-pack/ | 5    | 1,700  | PackManifest, Migration, Lifecycle, DomainAssociation             | 中等    |
| roadmap/       | 4    | 352    | RoadmapService, PhaseDeliveryService                              | 中等    |
| operations/    | 2    | 193    | DomainOnboardingService                                           | 中等    |
| 其他 7 子模块  | 16   | ~1,939 | prompt-library, eval-framework, risk-profile, knowledge-schema 等 | 桩-中等 |

### 4.5 interaction/（37 文件, 5,211 行）

| 子模块           | 文件 | 行数  | 核心服务                                            | 评估 |
| ---------------- | ---- | ----- | --------------------------------------------------- | ---- |
| nl-gateway/      | 6    | 1,270 | NlGatewayService (681), DisambiguationHandler (396) | 完整 |
| dashboard/       | 6    | 1,100 | DashboardProjection (346), WebSocketServer (382)    | 完整 |
| ux/              | 8    | 1,077 | ConversationHistory, Onboarding, UxEventTracking    | 中等 |
| proactive-agent/ | 5    | 694   | ProactiveAgentService (335), TriggerEngine          | 中等 |
| autonomy/        | 7    | 566   | AutonomyGovernanceService, TrustScorer, Promotion   | 中等 |
| goal-decomposer/ | 4    | 493   | GoalDecomposer (397), Validator, DependencyGraph    | 中等 |

### 4.6 org-governance/（33 文件, 3,449 行）

| 子模块                | 文件 | 行数  | 核心服务                                                         | 评估     |
| --------------------- | ---- | ----- | ---------------------------------------------------------------- | -------- |
| sso-scim/             | 8    | 1,669 | ScimProvisionService (828), OidcService (432), SamlService (186) | **完整** |
| org-model/            | 5    | 959   | OrgHierarchy, OrgNodeSync                                        | 完整     |
| delegated-governance/ | 4    | 406   | DelegatedGovernanceService, ScopeManager                         | 中等     |
| approval-routing/     | 5    | 162   | ApprovalRoutingService — 路由引擎薄                              | 桩       |
| knowledge-boundary/   | 5    | 121   | KnowledgeBoundaryService — 边界管理薄                            | 桩       |
| compliance-engine/    | 5    | 109   | ComplianceGovernanceService — 策略引擎薄                         | 桩       |

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

| 业务模块         | platform 引用数 | 耦合度                                           |
| ---------------- | --------------- | ------------------------------------------------ |
| sdk/             | 25+             | 最重 — CLI 覆盖全部 platform 服务                |
| scale-ecosystem/ | 25+             | 重 — marketplace 深度集成 config、billing、state |
| domains/         | 16              | 中 — contracts、config、execution、events        |
| interaction/     | 14              | 中 — routing、events、memory、projections        |
| ops-maturity/    | 10              | 轻 — contracts、approval、truth                  |
| org-governance/  | 5               | 最轻 — contracts、approval、tool-executor        |
| plugins/         | 3               | 极轻 — plugin-spi、contracts、egress-policy      |

### 6.3 潜在耦合风险

| 风险     | 涉及模块                     | 说明                                                              |
| -------- | ---------------------------- | ----------------------------------------------------------------- |
| 双向依赖 | control-plane/ ↔ execution/  | incident-control 引用 execution，execution 引用 config-center/iam |
| 双向依赖 | state-evidence/ ↔ execution/ | truth 引用 runtime-context，execution 重度依赖 truth              |
| 扇出过宽 | sdk/                         | CLI 脚本直接引用 platform 内部服务，跳过抽象层                    |

---

## 7. 代码质量分析

### 7.1 桩/占位文件统计

| 模块             | ≤ 1 行 | 2-10 行 | 11-20 行 | 总桩数  | 占比      |
| ---------------- | ------ | ------- | -------- | ------- | --------- |
| platform/        | 17     | 38      | 33       | 88      | 10.5%     |
| ops-maturity/    | 2      | 25      | 15       | 42      | **51.2%** |
| sdk/             | 0      | 22      | 3        | 25      | 26.9%     |
| scale-ecosystem/ | 0      | 12      | 10       | 22      | 32.8%     |
| org-governance/  | 0      | 7       | 6        | 13      | **39.4%** |
| interaction/     | 0      | 4       | 6        | 10      | 27.0%     |
| domains/         | 0      | 4       | 5        | 9       | 19.1%     |
| **总计**         | **19** | **112** | **78**   | **221** | **17.9%** |

### 7.2 大文件 TOP 10（> 700 行）

| 文件                                                              | 行数  | 所属模块        |
| ----------------------------------------------------------------- | ----- | --------------- |
| control-plane/incident-control/human-takeover-service-async.ts    | 1,165 | control-plane   |
| state-evidence/truth/sqlite/repositories/worker-repository.ts     | 1,057 | state-evidence  |
| state-evidence/truth/async-repositories/worker-repository.ts      | 1,052 | state-evidence  |
| shared/observability/slo-alerting-service.ts                      | 967   | shared          |
| control-plane/approval-center/approval-flow-engine.ts             | 962   | control-plane   |
| scale-ecosystem/marketplace/human-takeover-service-async.ts       | 926   | scale-ecosystem |
| state-evidence/truth/sqlite/repositories/operations-repository.ts | 868   | state-evidence  |
| execution/lease/execution-lease-service.ts                        | 796   | execution       |
| shared/observability/anomaly-detection-service.ts                 | 795   | shared          |
| state-evidence/truth/sqlite/repositories/billing-repository.ts    | 793   | state-evidence  |

### 7.3 Sync/Async 镜像重复（技术债）

7 组文件存在 sync (SQLite) / async (PostgreSQL) 镜像：

| Sync 文件                             | Async 文件                                  | 行数          | Async 状态 |
| ------------------------------------- | ------------------------------------------- | ------------- | ---------- |
| worker-repository.ts                  | async-repositories/worker-repository.ts     | 1,057 / 1,052 | 实现       |
| human-takeover-service.ts             | human-takeover-service-async.ts             | 741 / 1,165   | 实现       |
| execution-dispatch-service.ts         | execution-dispatch-service-async.ts         | 730 / 94      | 桩         |
| execution-worker-handshake-service.ts | execution-worker-handshake-service-async.ts | 789 / 82      | 桩         |
| execution-worker-writeback-service.ts | execution-worker-writeback-service-async.ts | 734 / 56      | 桩         |
| execution-lease-service.ts            | execution-lease-service-async.ts            | 796 / 504     | 部分       |
| durable-event-bus.ts                  | durable-event-bus-async.ts                  | 407 / 105     | 桩         |

**根因**: better-sqlite3 同步 API 与 PostgreSQL 异步 API 无法共享抽象层。
**估计重复代码**: ~4,200 行。

---

## 8. 测试分析

### 8.1 测试规模

| 类别        | 文件数    | 行数        | test()/it() 数 |
| ----------- | --------- | ----------- | -------------- |
| 单元测试    | 841       | 191,541     | 10,340         |
| 集成测试    | 289       | 53,421      | 1,098          |
| Golden 测试 | 8         | 1,330       | 55             |
| E2E 测试    | 10        | 2,807       | 29             |
| **总计**    | **1,155** | **250,208** | **11,548**     |

### 8.2 单元测试覆盖分布

| 目标模块              | 测试文件 | 测试行数 |
| --------------------- | -------- | -------- |
| platform/             | 588      | 137,111  |
| runtime/ (旧路径兼容) | 45       | 16,419   |
| scale-ecosystem/      | 51       | 10,169   |
| ops-maturity/         | 48       | 8,862    |
| domains/              | 31       | 6,515    |
| org-governance/       | 17       | 4,428    |
| interaction/          | 21       | 3,193    |
| plugins/              | 20       | 2,932    |
| sdk/                  | 13       | 1,526    |
| apps/                 | 4        | 39       |

### 8.3 覆盖率基线

全局最低要求: **84.1% lines, 82.8% functions, 79.8% branches**

### 8.4 E2E 测试场景（10 条）

task-lifecycle, oapeflir-full-loop, multi-step-workflow, lease-recovery, approval-event-flow, session-memory-flow, gateway-webhook-flow, streaming-response, error-propagation, operator-takeover

### 8.5 测试工具链

- 19 个 helper 文件; Stryker 变异测试 (break=50%); c8 覆盖率 (text/html/lcov)

---

## 9. 配置与部署架构

### 9.1 配置体系（34 文件）

| 配置目录            | 文件 | 用途                                               |
| ------------------- | ---- | -------------------------------------------------- |
| bootstrap/          | 1    | 平台启动参数 (phase_1a)                            |
| conversation/       | 1    | 对话模板 (81 行, 中文)                             |
| cost-alert/         | 1    | 成本告警阈值                                       |
| domains/            | 1    | 领域定义 (131 行: coding/devops/data-analysis)     |
| dr/                 | 1    | 灾难恢复 (RTO 3600s, RPO 300s)                     |
| environments/       | 5    | 环境覆盖 (dev/staging/pre-prod/prod/test)          |
| exception-recovery/ | 1    | 异常分类 + 重试策略 (129 行)                       |
| gateways/           | 1    | 默认网关 (cli, SSE enabled)                        |
| knowledge/          | 1    | 知识系统设置                                       |
| nl-gateway/         | 1    | NL 网关路由                                        |
| plugins/            | 1    | 插件默认配置 (73 行)                               |
| product/            | 1    | 计费方案 (community/pro/enterprise, 107 行)        |
| providers/          | 3    | LLM 模型目录 (gpt-5.2, claude-3-7-sonnet, MiniMax) |
| quality/            | 1    | 质量阈值                                           |
| risk/               | 1    | 风险评估规则 (82 行)                               |
| runtime/            | 6    | 运行时参数 (per-env, 1-8 并发, 120-600s 超时)      |
| security/           | 6    | 安全策略 (per-env)                                 |
| workflows/          | 1    | 工作流默认值 (single_agent_minimal)                |

### 9.2 部署架构（42 文件）

| 组件       | 文件数 | 要点                                                                |
| ---------- | ------ | ------------------------------------------------------------------- |
| Helm Chart | 15     | K8s deployment/service/ingress/HPA/PDB/secrets + 5 环境 values      |
| Terraform  | 8      | EKS + RDS + ElastiCache + ECR 模块化, 3 环境 tfvars + multi-region  |
| Scripts    | 4      | deploy.sh, dr-drill.sh (568 行), rollback.sh, verify-hot-upgrade.sh |
| Prometheus | 3      | 告警规则 (5xx>5%, task fail>10%), alertmanager, scrape 配置         |
| Grafana    | 2      | 仪表盘 JSON + provisioning                                          |
| Chaos Mesh | 4      | pod-kill, network-delay, postgres-disconnect, redis-disconnect      |
| Runbook    | 1      | 生产告警运行手册                                                    |

### 9.3 Division 定义（11 个, 61 文件）

覆盖领域: analytics, content, design, devops, engineering_ops, general_ops, operations, qa, research, security, support

每个包含: `division.yaml` + `roles/*.prompt.md` + `schemas/*.json` + `workflows/*.yaml`

---

## 10. 技术债与重构优先级

### 10.1 P0 — 架构阻塞

| #   | 债务项                          | 影响                     | 建议方案                                       | 估算       |
| --- | ------------------------------- | ------------------------ | ---------------------------------------------- | ---------- |
| 1   | Sync/Async 7 组镜像 (~4,200 行) | 维护成本翻倍，一致性风险 | 抽象 StoragePort 接口，sync/async 共享业务逻辑 | 10-15 人天 |
| 2   | PlatformOpsAgent 仅 40 行       | §69 设计无法交付         | 实现 PlatformOpsAgentService 类体 + 5 子模块   | 8-10 人天  |

### 10.2 P1 — 高优改进

| #   | 债务项                          | 影响               | 建议方案                                        | 估算       |
| --- | ------------------------------- | ------------------ | ----------------------------------------------- | ---------- |
| 3   | ops-maturity/ 51.2% 桩率        | 运维成熟度层不可用 | 聚焦 multimodal 处理器 + edge 子模块 + capacity | 10-15 人天 |
| 4   | org-governance/ 39.4% 桩率      | 治理能力薄弱       | 充实 approval-routing + knowledge-boundary      | 5-8 人天   |
| 5   | 221 个桩文件 (17.9%)            | 接口承诺但无实现   | 按模块优先级逐步填充或删除不实现的桩            | 20-30 人天 |
| 6   | E2E 测试仅 10 场景              | 回归风险           | 扩展到 25+ 场景                                 | 5-8 人天   |
| 7   | WorkerRepository 1,057 行       | God-class 风险     | 拆分为 Worker/Ticket/Lease/Heartbeat 四个 Repo  | 3-5 人天   |
| 8   | integration/ 无实际连接器适配器 | §57 无法演示       | 创建 3 个参考适配器 (GitHub/Jira/Slack)         | 5-8 人天   |

### 10.3 P2 — 建议改进

| #   | 债务项                                              | 建议方案                            | 估算     |
| --- | --------------------------------------------------- | ----------------------------------- | -------- |
| 9   | sdk/ CLI 直接引用 platform 内部服务                 | 引入 SDK facade 层                  | 5-8 人天 |
| 10  | scale-ecosystem/ resource-manager + sla-engine 为桩 | 填充核心调度和 SLA 逻辑             | 5-8 人天 |
| 11  | SAML 无 XML 签名验证                                | 添加 xmldsig 验证                   | 2-3 人天 |
| 12  | prompts 端点仅 30 行 (只读)                         | 扩展为完整 CRUD                     | 1-2 人天 |
| 13  | HumanTakeoverServiceAsync 跨模块重复                | 合并 control-plane/ 和 marketplace/ | 3-5 人天 |

---

## 11. 结论

### 代码库健康度总览

| 维度       | 评级  | 说明                                                                |
| ---------- | ----- | ------------------------------------------------------------------- |
| 架构一致性 | ★★★★☆ | 10 模块 + 13 platform 子模块分层清晰，contracts 作为共享核心        |
| 实现完成度 | ★★★☆☆ | 核心执行链完整，但 221 个桩文件 (17.9%) 表明边缘功能仅有接口        |
| 测试覆盖   | ★★★★☆ | 11,548 个断言，84%+ 行覆盖率，E2E 偏弱                              |
| 代码质量   | ★★★☆☆ | 严格 TypeScript，但 sync/async 重复和 ops-maturity 51.2% 桩率需关注 |
| 运维就绪   | ★★★☆☆ | Helm/Terraform/Prometheus/Chaos 完整，未经生产验证                  |
| 安全实践   | ★★★★☆ | 4 层沙箱, egress 策略, CVE 追踪, 数据分类, Secrets (Vault/KMS)      |

### 关键数字

- **1,233** 源文件，**246,677** 行 TypeScript
- **1,155** 测试文件，**250,208** 行测试代码
- **11,548** 个测试断言
- **84.1%** 行覆盖率基线
- **55** SQLite 表 + **75+** PostgreSQL 表
- **50+** REST API 路由
- **11** 个 Division 领域定义
- **82+** npm 脚本
- **42** 部署文件
- **221** 个桩文件待填充（17.9%）
- **~4,200** 行 sync/async 重复代码待消除
