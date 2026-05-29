# Automatic Agent Platform — codeArchitecture参考文档

> **版本**: v13.0
> **分析日期**: 2026-04-23
> **分析范围**: src/（1,387 文件, 265,020 lines）、tests/（1,825 文件, 440,180 lines）、config/（60 文件）、deploy/（42 文件）、divisions/（11 个, 61 文件）
> **分析方法**: 逐目录静态分析 + relies on追踪 + 测试覆盖对照 + 模式识别 + 设计文档交叉验证
> **文档定位**: code库现状的权威参考文档，record实际Architecture、模块Status、技术债vs重构基线
> **关联文档**: `00-platform-architecture.md` v3.2（设计规范）、`05-cross-platform-ui-architecture.md` v3.0（UI Architecture）、`reviews/architecture-design-vs-implementation-review.md` v7.0（差距评审）
> **v13.0 变更**: full重新扫描code库（+154 源文件 / +18,343 lines源码 / +670 测试文件 / +189,972 lines测试）；更新全部模块统计；新增 `constitution/` configure目录、13 个 root-level orchestrator 文件、`plugins/validators/` 子模块；synchronous async 镜像从 7 组扩展到 10+ 组

---

## 目录

1. [仓库总览vs关键指标](#1-仓库总览vs关键指标)
2. [模块清单vsStatus矩阵](#2-模块清单vsStatus矩阵)
3. [Platform 层深度分析](#3-platform-层深度分析)
4. [业务层深度分析](#4-业务层深度分析)
5. [核心call链分析](#5-核心call链分析)
6. [模块relies onvs边界分析](#6-模块relies onvs边界分析)
7. [code质量分析](#7-code质量分析)
8. [测试分析](#8-测试分析)
9. [configurevs部署Architecture](#9-configurevs部署Architecture)
10. [技术债vs重构优先级](#10-技术债vs重构优先级)
11. [Conclusion](#11-Conclusion)

---

## 1. 仓库总览vs关键指标

### 1.1 code规模

| 指标                | 数值                                                        | vs v12.0          |
| ------------------- | ----------------------------------------------------------- | ----------------- |
| 源码文件 (`src/`)   | 1,387 个 `.ts` 文件                                         | +154 (+12.5%)     |
| 源码lines数            | 265,020 lines                                                  | +18,343 (+7.4%)   |
| 测试文件 (`tests/`) | 1,825 个 `.test.ts` 文件                                    | +670 (+58.0%)     |
| 测试lines数            | 440,180 lines                                                  | +189,972 (+76.0%) |
| 测试/源码比         | 1.66:1                                                      | ↑ from 1.01:1     |
| 顶层模块数          | 10 个独立模块 + platform/ 含 13 子模块 + 13 root-level 文件 | +13 orchestrators |
| configure文件            | 60 个 JSON（19 目录）                                       | +26               |
| 部署文件            | 42 个（Helm + Terraform + Scripts + Monitoring + Chaos）    |                   |
| Division defines       | 11 个（61 文件）                                            |                   |
| npm 脚本            | 103 个（含 26 个 stable-\* 演练脚本）                       | +21               |
| 运lines时relies on          | 11 个                                                       | +1                |
| 开发relies on            | 14 个                                                       | +1                |

### 1.2 源码模块规模分布

| 模块                   | 文件数    | lines数        | 占比  | Stub 数 | Stub 率   | vs v12.0 文件 | vs v12.0 lines |
| ---------------------- | --------- | ----------- | ----- | ------- | --------- | ------------- | ----------- |
| `src/platform/`        | 941       | 207,967     | 78.5% | 121     | 12.9%     | +102          | +10,890     |
| `src/scale-ecosystem/` | 74        | 15,507      | 5.9%  | 23      | 31.1%     | +7            | +438        |
| `src/domains/`         | 56        | 10,579      | 4.0%  | 10      | 17.9%     | +9            | +2,006      |
| `src/sdk/`             | 93        | 8,749       | 3.3%  | 25      | 26.9%     | —             | +163        |
| `src/ops-maturity/`    | 88        | 8,957       | 3.4%  | 23      | **26.1%** | +6            | +2,188      |
| `src/interaction/`     | 41        | 5,587       | 2.1%  | 10      | 24.4%     | +4            | +376        |
| `src/org-governance/`  | 41        | 4,445       | 1.7%  | 13      | **31.7%** | +8            | +996        |
| `src/plugins/`         | 25        | 1,686       | 0.6%  | 5       | 20.0%     | +5            | +14         |
| `src/apps/`            | 4         | 112         | <0.1% | 3       | 75%\*     | —             | +62         |
| `src/core/`            | 8         | 29          | <0.1% | 8       | 100%\*    | —             | —           |
| `src/` root files      | 13        | 1,298       | 0.5%  | 0       | 0%        | **新增**      | **+1,298**  |
| `src/testing/`         | 1         | 21          | <0.1% | —       | —         | —             | —           |
| `src/benchmarks/`      | 1         | 74          | <0.1% | —       | —         | —             | —           |
| `src/types/`           | 1         | 9           | <0.1% | —       | —         | **新增**      | **+9**      |
| **总计**               | **1,387** | **265,020** | 100%  | **242** | **17.4%** | **+154**      | **+18,343** |

> \*`apps/` 为纯 manifest 声明，`core/` 为纯 re-export 兼容层，两者均属设计意图。

### 1.3 Root-Level Orchestrator 文件（v13.0 新增）

| 文件                                             | lines数 | 职责                     |
| ------------------------------------------------ | ---- | ------------------------ |
| `index.ts`                                       | 272  | 平台主入口 barrel export |
| `platform-architecture-bootstrap.ts`             | 152  | Five-Plane启动编排           |
| `platform-application-kernel.ts`                 | 142  | 应用内核relies on注入         |
| `domains-runtime-orchestrator.ts`                | 127  | 域运lines时编排（24 域）    |
| `interaction-governance-runtime-orchestrator.ts` | 132  | 交互+治理运lines时编排      |
| `scale-ops-runtime-orchestrator.ts`              | 132  | 规模+运维运lines时编排      |
| `domains-startup-plan.ts`                        | 53   | 域启动计划               |
| `interaction-governance-startup-plan.ts`         | 62   | 交互+治理启动计划        |
| `scale-ops-startup-plan.ts`                      | 62   | 规模+运维启动计划        |
| `domains-runtime-catalog.ts`                     | 51   | 域运lines时目录             |
| `interaction-governance-runtime-catalog.ts`      | 39   | 交互+治理运lines时目录      |
| `scale-ops-runtime-catalog.ts`                   | 39   | 规模+运维运lines时目录      |
| `platform-architecture-types.ts`                 | 35   | Architectureclass型defines             |

### 1.4 技术栈

| class别      | 选型                                                              |
| --------- | ----------------------------------------------------------------- |
| 语言      | TypeScript 5.8+ (strict, ESM, `noUncheckedIndexedAccess`)         |
| 运lines时    | Node.js 22+                                                       |
| data库    | SQLite (WAL) — 55 table + PostgreSQL — 75+ table（双后端适配）          |
| cache      | 内存 L1 + SQLite L2 + Redis L3 (ioredis ^5.10)                    |
| WebSocket | ws ^8.18                                                          |
| 可观测性  | OpenTelemetry (tracing + metrics)                                 |
| 验证      | Zod ^3.25 schema validation                                       |
| 测试      | `node:test` + `node:assert/strict` + c8 覆盖率 + Stryker 变异测试 |
| 构建      | tsc (ES2023 target, NodeNext module)                              |
| Lint      | ESLint 9 flat config + Prettier                                   |
| 容器      | 多阶段 Dockerfile, node:22-bookworm-slim                          |

### 1.5 判定标准：双维度Status体系

**维度 A — 实现Status**: Not Started → Skeleton → Partial → Implemented
**维度 B — 生产可信度**: Unverified → Test-covered → Staging-verified → Production-ready

> 当前code库中**no模块达到 Staging-verified 或 Production-ready**。

### 1.6 Architecture阻塞项

| #   | 阻塞项                       | 严重度 | Description                                                    |
| --- | ---------------------------- | ------ | ------------------------------------------------------- |
| B1  | PostgreSQL sync/async 双后端 | 高     | 10+ 组 sync/async 镜像文件（~6,934 lines），维护synchronous成本高 |
| B2  | E2E 测试场景偏少             | 中     | `tests/e2e/` 17 文件 6,687 lines，覆盖 ~17 条流程          |

---

## 2. 模块清单vsStatus矩阵

### 2.1 `src/platform/` 模块清单（941 文件, 207,967 lines）

| 子模块            | 文件 | lines数   | 核心服务                                                                                  | 实现Status    | 可信度       | vs v12.0   |
| ----------------- | ---- | ------ | ----------------------------------------------------------------------------------------- | ----------- | ------------ | ---------- |
| execution/        | 188  | 50,695 | ExecutionDispatchService, ExecutionLeaseService, MultiStepSupervisor, PatchDslService     | Implemented | Test-covered | +11/+1,761 |
| state-evidence/   | 212  | 49,461 | AuthoritativeTaskStore, DurableEventBus, WorkerRepository, 55 SQLite table                   | Implemented | Test-covered | +11/+1,724 |
| control-plane/    | 114  | 36,793 | PolicyCenterService, DoctorService, AutoStopLossService, CveIntelligenceService           | Implemented | Test-covered | +7/+1,237  |
| shared/           | 120  | 28,169 | SloAlertingService (1,021), AnomalyDetectionService (795), StabilityFramework (13,642)    | Implemented | Test-covered | +7/+1,375  |
| interface/        | 69   | 12,881 | HttpApiServer (50+ 路由, 17 路由文件), ChannelGatewayService (3,480), ConsoleRoutes       | Implemented | Test-covered | +7/+801    |
| orchestration/    | 129  | 12,312 | OapeflirLoopService (5,678), IntakeRouter, AgentDelegation (2,176), HITL (1,474), Harness | Implemented | Test-covered | +38/+2,194 |
| model-gateway/    | 23   | 5,807  | UnifiedChatProvider, CircuitBreaker, ModelRoutingService, 三提供商 (4,500 lines registry)    | Implemented | Test-covered | +4/+178    |
| contracts/        | 38   | 4,633  | AppError (14 子class), PromptBundle class型系统, 信封契约                                       | Implemented | Test-covered | +1/+48     |
| prompt-engine/    | 24   | 4,562  | HierarchicalRegistryService, PromptVersionManager, PromptRolloutService                   | Implemented | Test-covered | +5/+542    |
| compliance/       | 12   | 1,647  | ComplianceCaseOrchestrationService (324)                                                  | Partial     | Test-covered | +3/+164    |
| cost-management/  | 1    | 26     | 占位模块                                                                                  | Skeleton    | —            | —          |
| agent-delegation/ | 1    | 71     | re-export（实际实现在 orchestration/agent-delegation/）                                   | Legacy      | —            | —          |
| prompt-registry/  | 1    | 30     | 占位模块                                                                                  | Skeleton    | —            | —          |

### 2.2 业务层模块清单

| 模块             | 文件 | lines数   | 核心服务                                                                               | 实现Status    | 可信度       | vs v12.0  |
| ---------------- | ---- | ------ | -------------------------------------------------------------------------------------- | ----------- | ------------ | --------- |
| scale-ecosystem/ | 74   | 15,507 | BillingService (792), MarketplaceGovernanceService (866), ConnectorFrameworkService    | Implemented | Unverified   | +7/+438   |
| domains/         | 56   | 10,579 | DomainBaselineCatalog (1,113), PluginSpiRegistry (829), DivisionLoader (798)           | Implemented | Test-covered | +9/+2,006 |
| sdk/             | 93   | 8,749  | PackLifecycleOrchestrationService, 79 CLI 入口点（含 26 stable-\* 演练脚本，工厂模式） | Implemented | Test-covered | —/+163    |
| ops-maturity/    | 88   | 8,957  | EvolutionMvpService (645), PlatformOpsAgentService (1,306), EdgeRuntimeSyncService     | Partial     | Unverified   | +6/+2,188 |
| interaction/     | 41   | 5,587  | NlGatewayService (681), GoalDecomposer (397), DashboardWebSocketServer (382)           | Implemented | Unverified   | +4/+376   |
| org-governance/  | 41   | 4,445  | ScimProvisionService (828), OidcIdentityService (432), SamlService (186)               | Implemented | Unverified   | +8/+996   |
| plugins/         | 25   | 1,686  | 6 Adapter + 7 Retriever + 4 Presenter + 2 Planner + 2 Validator（5 桩文件）            | Implemented | Test-covered | +5/+14    |
| apps/            | 4    | 112    | PlatformAppManifest (api/console/workers)                                              | Implemented | —            | —/+62     |
| core/            | 8    | 29     | 纯 re-export 兼容层                                                                    | Legacy      | —            | —         |

---

## 3. Platform 层深度分析

### 3.1 execution/（188 文件, 50,695 lines）— 最大子模块

| 子目录            | 文件 | lines数   | 职责                                                                | vs v12.0       |
| ----------------- | ---- | ------ | ------------------------------------------------------------------- | -------------- |
| tool-executor/    | 37   | 13,540 | 工具执lines、沙箱、补丁 DSL、文件系统工具                              | +1/+40         |
| execution-engine/ | 30   | 7,698  | 多步编排、循环检测、中间件、上下文压缩                              | —/−102         |
| recovery/         | 23   | 6,811  | 执lines恢复、重放、修复                                                | **+15/+5,868** |
| ha/               | 18   | 6,115  | HA 协调、故障转移                                                   | +1/+115        |
| worker-pool/      | 20   | 3,310  | Worker 握手、写回、注册、负载均衡                                   | +1/+10         |
| dispatcher/       | 11   | 3,028  | 准入控制、分发服务                                                  | —/+28          |
| plugin-executor/  | 5    | 2,296  | 插件执lines（4 层沙箱: none/process/container/scoped_external_access） | −18/−4,304     |
| hot-upgrade/      | 7    | 1,968  | 热升级验证                                                          | +4/+768        |
| lease/            | 9    | 1,822  | 租约获取/续约/释放、fencing token                                   | +4/−1,678      |
| startup/          | 5    | 1,197  | 启动一致性、预检                                                    | —/−803         |
| queue/            | 7    | 975    | 队列适配器                                                          | +3/−825        |
| state-transition/ | 3    | 839    | 执linesStatus机、转换服务                                                | −5/−3,161      |
| distributed-lock/ | 8    | 630    | 分布式锁（SQLite/PG/Redis）                                         | —/−5           |
| resource/         | 2    | 361    | 进程资源跟踪                                                        | —/−4           |

> **重点变化**: recovery/ 从 8 文件 943 lines大幅扩展到 23 文件 6,811 lines，成为执lines层第三大子模块。plugin-executor/ 精简合并（从 23 文件缩减到 5 文件）。

### 3.2 state-evidence/（212 文件, 49,461 lines）

| 子目录       | 文件 | lines数   | 职责                                                 | vs v12.0       |
| ------------ | ---- | ------ | ---------------------------------------------------- | -------------- |
| truth/       | 118  | 30,058 | 权威datastorage，55 SQLite table + PG 迁移，22+ Repository | +6/+958        |
| events/      | 26   | 7,021  | 持久化事件总线、class型化发布                           | **+15/+4,521** |
| memory/      | 20   | 5,519  | 多层记忆 (session/project/user)                      | +4/+2,019      |
| knowledge/   | 24   | 3,910  | 语义知识、向量storage、摄取管道                         | +9/−590        |
| artifacts/   | 13   | 1,095  | 制品storage、发布、敏感内容扫描                         | +5/−905        |
| checkpoints/ | 3    | 757    | 执lines检查点                                           | −1/−443        |
| projections/ | 2    | 584    | 读模型投影                                           | —/−216         |
| dlq/         | 1    | 284    | 死信队列                                             | —/−16          |
| incident/    | 1    | 96     | 事件record                                             | −2/−504        |
| audit/       | 1    | 44     | 审计追踪、完整性验证                                 | −4/−1,456      |

> **重点变化**: events/ 从 11 文件扩展到 26 文件（+4,521 lines），DurableEventBus 生态大幅充实。memory/ 从 16 文件扩展到 20 文件（+2,019 lines）。audit/ 精简合并。

### 3.3 control-plane/（114 文件, 36,793 lines）

| 子目录                 | 文件 | lines数   | 核心服务                                                                  | vs v12.0    |
| ---------------------- | ---- | ------ | ------------------------------------------------------------------------- | ----------- |
| incident-control/      | 26   | 11,145 | DoctorService, AutoStopLossService, HumanTakeoverService, RunbookExecutor | +2/+345     |
| config-center/         | 32   | 8,900  | 29 个环境configure加载器, ConfigGovernanceService, 版本化                      | +1/+300     |
| iam/                   | 21   | 7,386  | PolicyEngine, SandboxPolicy, Secrets (Vault/AWS KMS/GCP), CVE             | +1/+136     |
| approval-center/       | 11   | 3,919  | ApprovalFlowEngine (1,017), 法定人数、升级、多方审批                      | —/+119      |
| compliance/            | 6    | 2,220  | data驻留、encryptionkey、擦除request/报告                                         | —/+20       |
| cost-alert/            | 4    | 902    | CostAlertService                                                          | **+2/+602** |
| rollout-controller/    | 2    | 502    | RolloutStateMachine, AutoRollbackService                                  | −3/−498     |
| risk-control/          | 4    | 493    | RiskEvaluationEngine                                                      | +1/+93      |
| policy-center/         | 1    | 409    | PolicyCenterService                                                       | **新增**    |
| audit-export/          | 2    | 353    | AuditExportService                                                        | +1/+153     |
| replay-repair-control/ | 1    | 183    | ReplayRepairControlService                                                | **新增**    |
| tenant/                | 1    | 282    | TenantService                                                             | −3/−218     |

> **重点变化**: cost-alert/ 从 2 文件 300 lines扩展到 4 文件 902 lines。新增 policy-center/ 和 replay-repair-control/。

### 3.4 其余 platform 子模块

| 子模块         | 文件 | lines数   | 要点                                                                     | vs v12.0       |
| -------------- | ---- | ------ | ------------------------------------------------------------------------ | -------------- |
| shared/        | 120  | 28,169 | SLO 告警 (1,021), 异常检测 (795), **Stability (13,642)**, 三级cache, OTel | +7/+1,375      |
| orchestration/ | 129  | 12,312 | OAPEFLIR 64 文件 (5,678), AgentDelegation (2,176), HITL (1,474), Harness | **+38/+2,194** |
| interface/     | 69   | 12,881 | 50+ REST 路由 (17 路由文件), ChannelGateway (3,480), Console, WebSocket  | +7/+801        |
| model-gateway/ | 23   | 5,807  | 三提供商 (Anthropic/OpenAI/MiniMax), 熔断器, ProviderRegistry (4,500)    | +4/+178        |
| contracts/     | 38   | 4,633  | AppError (14 子class), PromptBundle (99), 信封契约                          | +1/+48         |
| prompt-engine/ | 24   | 4,562  | 层级注册table, 版本manage, Eval, Rollout                                      | +5/+542        |
| compliance/    | 12   | 1,647  | 合规编排: 分class→治理→驻留→encryption→溯源→擦除                                  | +3/+164        |

> **重点变化**: orchestration/ 从 91 文件增长到 129 文件（+38），OAPEFLIR 从单文件 439 lines扩展到 64 文件 5,678 lines。shared/stability/ 成为 shared/ 最大子模块（13,642 lines）。

---

## 4. 业务层深度分析

### 4.1 scale-ecosystem/（74 文件, 15,507 lines）

| 子模块            | 文件 | lines数   | 核心服务                                                                                    | 评估 |
| ----------------- | ---- | ------ | ------------------------------------------------------------------------------------------- | ---- |
| marketplace/      | 32   | 11,972 | BillingService (792), MarketplaceGovernance (866), TenantPlatform, 3 支付网关, 6 async 镜像 | 完整 |
| feedback-loop/    | 11   | 1,275  | FeedbackImprovementService, FineTuningExporter (277), QualityGrader (257)                   | 中等 |
| multi-region/     | 7    | 1,265  | RegionHealthCheckService (462), CdcReplicationService (328), FailoverController             | 中等 |
| integration/      | 5    | 203    | ConnectorFrameworkService (141) — 框架完整，no实际connect器适配器                              | 薄   |
| sla-engine/       | 5    | 142    | SlaOperationsService (90) — only Zod schema + 简单逻辑                                        | 桩   |
| resource-manager/ | 5    | 118    | FairSchedulingService (69) — only基础队列逻辑                                                 | 桩   |

> marketplace/ 新增 6 个 async 镜像文件（handshake/writeback/dispatch/event-bus/human-takeover/governance），总计 ~4,867 lines。

### 4.2 domains/（56 文件, 10,579 lines）

| 子模块                | 文件 | lines数  | 核心服务                                                         | 评估     | vs v12.0    |
| --------------------- | ---- | ----- | ---------------------------------------------------------------- | -------- | ----------- |
| registry/             | 15   | 2,753 | PluginSpiRegistry (829), PluginRuntimeHost (611, Fork/Container) | 完整     | —           |
| business-pack/        | 6    | 1,833 | PackManifest, Migration, Lifecycle, DomainAssociation            | 中等     | +1/+133     |
| governance/           | 6    | 1,672 | DivisionLoader (798), HrRoleGovernanceService                    | 完整     | +1/+36      |
| roadmap/              | 5    | 647   | RoadmapService, PhaseDeliveryService                             | 中等     | +1/+295     |
| operations/           | 2    | 193   | DomainOnboardingService                                          | 中等     | —           |
| canonical-meta-model/ | 4    | 140   | CanonicalMetaModel, Validator, Seeder, CompletenessCalculator    | **新增** | **+4/+140** |
| prompt-library/       | 2    | 182   | PromptLibraryService                                             | 桩-中等  | —           |
| eval-framework/       | 2    | 159   | JudgeProviderRegistry, QualityGate                               | 桩-中等  | —           |
| interaction-policy/   | 1    | 96    | InteractionPolicyService                                         | **新增** | **+1/+96**  |
| risk-profile/         | 1    | 79    | DomainRiskProfile                                                | 桩       | —           |
| knowledge-schema/     | 1    | 62    | KnowledgeSchemaService                                           | 桩       | —           |
| coding/               | 1    | 31    | CodingDomainDescriptor                                           | **新增** | **+1/+31**  |
| recipes/              | 1    | 18    | DomainRecipeService                                              | 桩       | —           |

> **重点变化**: 新增 canonical-meta-model/（4 文件）、interaction-policy/、coding/ 三个子模块。DomainBaselineCatalog（root-level, 1,113 lines）成为 domains 最大单文件。

### 4.3 ops-maturity/（88 文件, 8,957 lines）

| 子模块               | 文件 | lines数  | 核心服务                                                    | 评估                  | vs v12.0      |
| -------------------- | ---- | ----- | ----------------------------------------------------------- | --------------------- | ------------- |
| drift-detection/     | 15   | 2,484 | EvolutionMvpService (645), ProposalEngine, ReflectionEngine | **完整**              | —/+85         |
| platform-ops-agent/  | 9    | 1,306 | PlatformOpsAgentService + 子模块                            | **中等**（↑ from 桩） | **+2/+1,266** |
| agent-lifecycle/     | 8    | 1,022 | AgentLifecycleService (311), PerformanceProfiler            | 中等                  | —/+28         |
| version-management/  | 3    | 738   | SemverValidator (336), CompatibilityMatrix (380)            | 完整                  | —             |
| explainability/      | 7    | 660   | ExplanationPipeline (121), SimplifiedExplainer (280)        | 中等                  | —/+39         |
| workflow-debugger/   | 6    | 454   | TimeTravelDebugService (214) + 3 桩子目录                   | 部分                  | —/+101        |
| multimodal/          | 7    | 381   | MultimodalGatewayService (187) + handle器                     | **中等**（↑ from 桩） | —/+112        |
| emergency/           | 5    | 284   | PlatformPanicService (197) + 3 桩子目录                     | 部分                  | —/+55         |
| chaos/               | 2    | 261   | ChaosExperimentScheduler                                    | 部分                  | +1/+77        |
| compliance-reporter/ | 5    | 261   | ComplianceReportPipeline + 3 桩子目录                       | 部分（↑ from 桩）     | —/+87         |
| capacity-planner/    | 5    | 258   | CapacityPlanningService (162) + 3 桩子目录                  | 部分（↑ from 桩）     | —/+65         |
| cost-optimizer/      | 5    | 246   | CostOptimizationService + 3 桩子目录                        | **桩**                | —/+93         |
| edge-runtime/        | 6    | 214   | EdgeRuntimeSyncService (143) + 子模块                       | **桩**                | —/+37         |
| monitoring/          | 2    | 212   | AnomalyDetectionService                                     | 中等                  | +1/+14        |

> **重点变化**: platform-ops-agent/ 从 10 lines空壳大幅充实到 1,306 lines（+1,266）。Stub 率从 51.2% 降至 26.1%。

### 4.4 interaction/（41 文件, 5,587 lines）

| 子模块           | 文件 | lines数  | 核心服务                                            | 评估 |
| ---------------- | ---- | ----- | --------------------------------------------------- | ---- |
| nl-gateway/      | 6    | 1,270 | NlGatewayService (681), DisambiguationHandler (396) | 完整 |
| dashboard/       | 6    | 1,100 | DashboardProjection (346), WebSocketServer (382)    | 完整 |
| ux/              | 8    | 1,077 | ConversationHistory, Onboarding, UxEventTracking    | 中等 |
| proactive-agent/ | 5    | 694   | ProactiveAgentService (335), TriggerEngine          | 中等 |
| autonomy/        | 7    | 566   | AutonomyGovernanceService, TrustScorer, Promotion   | 中等 |
| goal-decomposer/ | 4    | 493   | GoalDecomposer (397), Validator, DependencyGraph    | 中等 |

### 4.5 org-governance/（41 文件, 4,445 lines）

| 子模块                | 文件 | lines数  | 核心服务                                                         | 评估     | vs v12.0 |
| --------------------- | ---- | ----- | ---------------------------------------------------------------- | -------- | -------- |
| sso-scim/             | 8    | 1,669 | ScimProvisionService (828), OidcService (432), SamlService (186) | **完整** | —        |
| org-model/            | 5    | 959   | OrgHierarchy, OrgNodeSync                                        | 完整     | —        |
| delegated-governance/ | 4    | 406   | DelegatedGovernanceService, ScopeManager                         | 中等     | —        |
| approval-routing/     | 5    | 162   | ApprovalRoutingService — 路由references擎薄                              | 桩       | —        |
| knowledge-boundary/   | 5    | 121   | KnowledgeBoundaryService — 边界manage薄                            | 桩       | —        |
| compliance-engine/    | 5    | 109   | ComplianceGovernanceService — 策略references擎薄                         | 桩       | —        |

> org-governance/ 文件数从 33 增到 41（+8），lines数从 3,449 增到 4,445（+996），但 approval-routing/knowledge-boundary/compliance-engine 仍为桩。

---

## 5. 核心call链分析

### 5.1 OAPEFLIR 8 阶段循环（orchestration/oapeflir/ — 64 文件, 5,678 lines）

OAPEFLIR（Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release）is平台的核心认知管线，将任务目标转化为可执lines工作、评估结果、提取学习并optional地滚动发布策略改进。

#### 5.1.1 阶段call链

```
OapeflirLoopService.run()
│
├─ 1. OBSERVE
│  ├─ TaskSituationBuilder.build()           → TaskSituation
│  ├─ SystemSituationBuilder.build()         → SystemSituation
│  └─ ObservationAggregator.aggregate()      → UnifiedObservation
│
├─ 2. ASSESS
│  └─ AssessmentService.assess()             → UnifiedAssessment
│     ├─ 风险因子分析（阻塞严重性、意图置信度、工具风险）
│     ├─ 复杂度推导（trivial/simple/moderate/complex/critical）
│     └─ 路由Decision（单步/多步、模型class别、timeout、审批策略）
│
├─ 3. PLAN
│  └─ PlanBuilder.build()                    → Plan
│
├─ 4. EXECUTE
│  └─ RuntimeExecuteBridge.executePlan()     → DualChannelStepOutput[]
│     └─ runMultiStepOrchestration()         ← core/runtime/orchestrator
│
├─ 5. FEEDBACK
│  ├─ FeedbackCollector.collect()            → FeedbackBatch
│  └─ FeedbackCollector.toLearningSignals() → LearningSignal[]
│
├─ 6. LEARN
│  ├─ FailurePatternMiner.mine()            （4 探测器: hallucination/truncation/permission/schema-loop）
│  ├─ LLMImprovementGenerationService.generateImprovements()
│  ├─ LearningObjectValidator.validateMany()
│  └─ KnowledgePromotionService.promote()   → state-evidence/knowledge
│
├─ 7. IMPROVE（条件性 — only当 learningObjects 存在时）
│  ├─ AutonomyBoundaryPolicy.decide()
│  └─ ImprovementCandidateRegistry.register()
│
├─ 8. RELEASE（条件性 — only当改进候选被批准时）
│  ├─ PolicyRolloutService.start()           → RolloutRecord
│  ├─ RolloutStateMachine.transition()
│  ├─ GuardrailEvaluator.evaluate()
│  └─ RolloutFreezeManager check
│
└─ POST-LOOP
   ├─ ExecutionOutcomeEvaluator.evaluate()   → ExecutionOutcomeEvaluation
   ├─ PostExecutionQualityGate.decide()      → PostExecutionQualityGateDecision
   └─ ReplanningService.decide()             → ReplanningDecision
```

每个阶段uses `startActiveSpan()` (OpenTelemetry) 包装并via `runtimeMetricsRegistry` record进出指标。阶段间uses Zod schema 进lines边界验证。

#### 5.1.2 OAPEFLIR 子目录结构

| 子目录           | 文件 | lines数  | 职责                                             |
| ---------------- | ---- | ----- | ------------------------------------------------ |
| root files       | 15   | 2,007 | 主循环服务、FSM、执lines桥、交接构建/序列化、class型   |
| types/           | 16   | 498   | 阶段间dataclass型（assessment/plan/observation 等） |
| schemas/         | 2    | 319   | Zod 验证器 + schema index                        |
| workflow/        | 5    | 1,015 | 工作流验证、输出 schema、重试策略                |
| learn/           | 16   | 911   | 学习管线: 模式挖掘、知识提升、策略学习           |
| improve-rollout/ | 11   | 928   | 发布管线: 调度器、Status机、护栏、canary 路由      |

#### 5.1.3 OAPEFLIR 跨模块relies on

| relies on目标                             | 用途                                           |
| ------------------------------------ | ---------------------------------------------- |
| `platform/shared/observability/`     | 任务/系统态势构建、OTel tracing、冻结manage器    |
| `platform/five-plane-execution/`                | MultiStepOrchestrationResult、StepOutputRecord |
| `platform/prompt-engine/eval/`       | 执lines结果评估器、质量门                         |
| `platform/five-plane-state-evidence/knowledge/` | 知识平面（Learn 阶段知识提升）                 |
| `platform/five-plane-state-evidence/events/`    | TypedEventPublisher（学习事件发布）            |
| `platform/contracts/`                | ID 生成、time戳、错误class型                      |
| `platform/model-gateway/`            | LLM 改进生成                                   |
| `scale-ecosystem/feedback-loop/`     | FeedbackCollector、FeedbackModel               |
| `domains/governance/`                | DivisionLoader（工作流验证）                   |

### 5.2 执linescall链（execution/ → state-evidence/ → control-plane/）

```
ExecutionDispatchService.dispatch()
├─ AdmissionController.evaluate()         ← control-plane/iam/sandbox-policy
├─ ExecutionLeaseService.acquire()        ← fencing token
├─ AuthoritativeTaskStore.create()        ← state-evidence/truth/
├─ WorkerPool.assign()
│  ├─ ExecutionWorkerHandshakeService.handshake()
│  └─ ExecutionWorkerWritebackService.writeback()
├─ MultiStepSupervisor.run()
│  ├─ ToolExecutor.execute()              ← 4 层沙箱 (none/process/container/scoped)
│  ├─ PatchDslService.apply()
│  └─ ContextCompressor.compress()
├─ ExecutionLeaseService.release()
└─ DurableEventBus.publish()              ← state-evidence/events/
```

### 5.3 HITL 审批call链

```
HitlApprovalOrchestrationService.requestApproval()
├─ ApprovalContextSummaryService.produce()
├─ HITLExplainabilityService.explain()    （583 lines，生成人class可读审批理由）
├─ ApprovalFlowEngine.submit()            ← control-plane/approval-center/ (1,017 lines)
│  ├─ 法定人数投票
│  ├─ 升级策略
│  └─ 多方审批
├─ HitlInboxService.enqueue()
└─ HitlOperatorConsoleService.notify()
```

### 5.4 Agent 委派call链

```
DelegationManagerService.delegate()
├─ TopologyValidator.validate()           （深度/扇出/环检测）
├─ ContextIsolator.createSandboxedContext() （IsolationLevel）
├─ DelegationGovernanceService.enforce()
├─ CollaborationProtocolService.validate() （ACP 消息验证）
│  └─ InvariantEnforcer.enforce()         （permission收窄、budget、风险不variable）
├─ DelegationTracker.track()              （树状委派追踪）
└─ DelegationAuditService.record()
```

---

## 6. 模块relies onvs边界分析

### 6.1 relies on层iterations模型

```
Layer 4 (Entry)     src/*.ts root orchestrators (13 文件)
                    ↓ imports
Layer 3 (Business)  scale-ecosystem/ | domains/ | ops-maturity/ | interaction/ | org-governance/
                    ↓ imports
Layer 2 (Platform)  orchestration/ | execution/ | interface/ | model-gateway/ | prompt-engine/
                    ↓ imports
Layer 1 (Core)      state-evidence/ | control-plane/ | shared/ | contracts/ | compliance/
                    ↓ imports
Layer 0 (Infra)     node:* stdlib | zod | ioredis | postgres | ws | @opentelemetry/*
```

### 6.2 跨模块耦合度（按 import 频iterations）

| 源模块 → 目标模块                           | import iterations数 | 耦合评估   |
| ------------------------------------------- | ----------- | ---------- |
| execution/ → contracts/ (ids/errors/domain) | 132         | 高（合理） |
| execution/ → state-evidence/truth/          | 97          | 高（合理） |
| execution/ → shared/observability/          | 48          | 中         |
| orchestration/ → contracts/ (ids/errors)    | 22          | 中（合理） |
| orchestration/ → scale-ecosystem/feedback/  | 5           | 低（跨层） |
| orchestration/ → shared/observability/      | 4           | 低         |
| execution/ → control-plane/iam/             | 14          | 中（合理） |

### 6.3 Architecture边界违规分析

| #   | 违规class型    | Description                                                                                   | 严重度 |
| --- | ----------- | -------------------------------------------------------------------------------------- | ------ |
| V1  | 跨层relies on    | orchestration/ (L2) → scale-ecosystem/feedback-loop/ (L3)：OAPEFLIR 学习管线relies on业务层 | 中     |
| V2  | 缺失抽象    | marketplace/ 中 5 个 async 镜像缺少 sync 对应文件，directly实现 PG 特化逻辑                | 中     |
| V3  | 巨型 barrel | `src/index.ts` (272 lines) export全部模块，no选择性 tree-shaking                            | 低     |

### 6.4 模块内聚度评估

| 模块             | 内聚度 | Description                                                                                        |
| ---------------- | ------ | ------------------------------------------------------------------------------------------- |
| execution/       | 高     | 14 子目录职责清晰，recovery/ 扩展后仍保持独立                                               |
| state-evidence/  | 高     | truth/events/memory/knowledge 四大子系统边界明确                                            |
| control-plane/   | 高     | 12 子目录each独立，新增 policy-center/ 和 replay-repair-control/ 不Impact既有模块             |
| orchestration/   | **中** | OAPEFLIR 从单文件扩展到 64 文件后，内部 learn/ 和 improve-rollout/ 可能需要提取为独立子模块 |
| shared/          | 中     | stability/ (13,642 lines) 过大，可能需要拆分                                                   |
| scale-ecosystem/ | 中     | marketplace/ (11,972 lines) 占 77%，vs其他 5 个子模块体量失衡                                  |
| ops-maturity/    | 中     | 14 子模块中 6 个仍为桩/部分实现，但 stub 率持续下降                                         |

---

## 7. code质量分析

### 7.1 Stub 统计

| 指标             | v13.0                   | vs v12.0 |
| ---------------- | ----------------------- | -------- |
| 总 Stub 文件数   | 242                     | +21      |
| 总 Stub 率       | 17.4%                   | ↓ 0.5pp  |
| 最高 Stub 率模块 | org-governance/ (31.7%) | —        |
| 最低 Stub 率模块 | platform/ (12.9%)       | —        |

> Stub 率计算：Stub 文件数 / 模块总文件数。apps/ (75%) 和 core/ (100%) 为设计意图，不计入评估。

#### 7.1.1 模块 Stub 率分布

| 模块             | Stub 率   | vs v12.0                |
| ---------------- | --------- | ----------------------- |
| platform/        | 12.9%     | ↓（orchestration 充实） |
| domains/         | 17.9%     | ↓（+3 新子模块）        |
| plugins/         | 20.0%     | ↓（+validators）        |
| interaction/     | 24.4%     | —                       |
| ops-maturity/    | **26.1%** | **↓ from 51.2%**        |
| sdk/             | 26.9%     | —                       |
| scale-ecosystem/ | 31.1%     | —                       |
| org-governance/  | **31.7%** | —                       |

### 7.2 Top 15 最大源文件

| 排名 | lines数  | 文件                                                            | 职责                             |
| ---- | ----- | --------------------------------------------------------------- | -------------------------------- |
| 1    | 1,113 | `domains/domain-baseline-catalog.ts`                            | 24 垂直域基线目录                |
| 2    | 1,052 | `state-evidence/truth/async-repositories/worker-repository.ts`  | 异步 Worker data访问层           |
| 3    | 1,021 | `shared/observability/slo-alerting-service.ts`                  | SLO 告警references擎                     |
| 4    | 1,017 | `control-plane/approval-center/approval-flow-engine.ts`         | 审批流references擎（法定人数+升级）      |
| 5    | 926   | `scale-ecosystem/marketplace/human-takeover-service-async.ts`   | 人工接管异步镜像                 |
| 6    | 868   | `state-evidence/truth/sqlite/repositories/operations-repo.ts`   | 运维聚合仓储                     |
| 7    | 867   | `scale-ecosystem/marketplace/worker-writeback-service-async.ts` | Worker 写回异步镜像              |
| 8    | 866   | `scale-ecosystem/marketplace/marketplace-governance-service.ts` | 市场治理（发布/审核/撤回）       |
| 9    | 850   | `state-evidence/truth/sqlite/sqlite-database.ts`                | SQLite data库manage (WAL+迁移)     |
| 10   | 829   | `domains/registry/plugin-spi-registry.ts`                       | 插件 SPI 注册table                  |
| 11   | 828   | `org-governance/sso-scim/scim-sync/scim-service.ts`             | SCIM 2.0 user/组synchronous             |
| 12   | 802   | `scale-ecosystem/marketplace/worker-handshake-service-async.ts` | Worker 握手异步镜像              |
| 13   | 798   | `domains/governance/division-loader.ts`                         | Division defines加载器              |
| 14   | 796   | `execution/lease/execution-lease-service.ts`                    | 执lines租约（fencing token）        |
| 15   | 795   | `shared/observability/anomaly-detection-service.ts`             | 时序异常检测（z-score/IQR/EWMA） |

> 4 文件exceeds过 1,000 lines（vs v12.0: 2 文件）。Top 15 中 4 个为 async 镜像文件。

### 7.3 Sync/Async 镜像分析

| 指标                 | v13.0         | vs v12.0     |
| -------------------- | ------------- | ------------ |
| 总 async 镜像文件    | 19            | +12          |
| 总 async 镜像lines数    | 6,934         | +5,000+      |
| 目录分组数           | 5             | +2           |
| 有 sync 对应的       | 14 (73.7%)    | —            |
| **缺少 sync 对应的** | **5 (26.3%)** | **新增风险** |

#### 7.3.1 按模块分布

| 模块                                       | async 文件 | lines数  | 缺少 sync 对应 |
| ------------------------------------------ | ---------- | ----- | -------------- |
| `scale-ecosystem/marketplace/`             | 9          | 4,215 | **5**          |
| `platform/five-plane-execution/` (跨 4 子目录)        | 7          | 1,766 | 0              |
| `platform/five-plane-control-plane/incident-control/` | 1          | 784   | 0              |
| `platform/five-plane-state-evidence/events/`          | 1          | 121   | 0              |
| `ops-maturity/drift-detection/`            | 1          | 48    | 0              |

> **风险**: marketplace/ 的 5 个no sync 对应的 async 文件（human-takeover/handshake/writeback/dispatch/event-bus）占总 async lines数的 61%。这些文件directly实现 PG 特化逻辑而非包装现有 sync 服务。

---

## 8. 测试分析

### 8.1 测试规模总览

| 指标              | v13.0               | vs v12.0          |
| ----------------- | ------------------- | ----------------- |
| 测试文件total      | 1,825 个 `.test.ts` | +670 (+58.0%)     |
| 测试lines数          | 440,180 lines          | +189,972 (+76.0%) |
| 测试/源码比       | 1.66:1              | ↑ from 1.01:1     |
| `test()` 用例数   | 21,682              | —                 |
| `it()` 用例数     | 536                 | —                 |
| `describe()` 块数 | 285                 | —                 |
| **总用例数**      | **22,218**          | —                 |
| `test.skip()` 数  | 74                  | —                 |

> 97.6% 用例uses `node:test` 原生 `test()` 风格，2.4% uses `it()`/`describe()` 风格。

### 8.2 测试分class分布

| 分class         | 文件数 | lines数    | test() | it() | Description                           |
| ------------ | ------ | ------- | ------ | ---- | ------------------------------ |
| unit/        | 1,398  | 346,906 | 19,678 | 473  | 模块隔离测试                   |
| integration/ | 360    | 77,159  | 1,709  | 32   | 跨服务/CLI/运lines时/沙箱测试     |
| golden/      | 14     | 2,033   | 80     | —    | API response/CLI 输出/OpenAPI 快照 |
| e2e/         | 17     | 6,687   | 133    | —    | 端到端流程（~17 条流程）       |
| performance/ | 15     | 4,893   | 72     | 31   | 性能基准                       |

> **helpers/**: 19 文件 2,126 lines（api/pmf/concurrent-runner/typed-factories/e2e-harness/integration-context/seed/process-guard/golden/repository-harness 等）
> **fixtures/**: 7 文件 513 lines（迁移快照 + prompt-engine 模板）

### 8.3 单元测试模块分布（tests/unit/）

| 子目录           | 文件 | lines数    | 占比  |
| ---------------- | ---- | ------- | ----- |
| platform/        | 902  | 245,676 | 70.9% |
| ops-maturity/    | 103  | 21,485  | 6.2%  |
| runtime/         | 48   | 16,683  | 4.8%  |
| scale-ecosystem/ | 70   | 14,402  | 4.2%  |
| domains/         | 55   | 11,918  | 3.4%  |
| org-governance/  | 42   | 10,357  | 3.0%  |
| sdk/             | 65   | 10,113  | 2.9%  |
| interaction/     | 47   | 7,774   | 2.2%  |
| plugins/         | 24   | 3,269   | 0.9%  |
| core/            | 13   | 3,084   | 0.9%  |
| root-level       | 14   | 941     | 0.3%  |
| 其他             | 15   | 1,204   | 0.3%  |

### 8.4 集成测试模块分布（tests/integration/）

| 子目录                  | 文件 | lines数   |
| ----------------------- | ---- | ------ |
| platform/               | 272  | 59,664 |
| sdk/                    | 35   | 9,139  |
| domains/                | 17   | 3,267  |
| ops-maturity/           | 17   | 2,597  |
| scale-ecosystem/        | 7    | 500    |
| interaction-governance/ | 1    | 453    |
| scale-ops/              | 1    | 405    |
| interaction/            | 3    | 287    |
| stability/              | 2    | 263    |
| workflow/               | 2    | 218    |
| org-governance/         | 2    | 194    |
| orchestration/          | 1    | 185    |

### 8.5 覆盖率configure

| configure项           | 值                                               |
| ---------------- | ------------------------------------------------ |
| 工具             | c8 ^11.0.0                                       |
| 报告格式         | text, html, lcov, json-summary                   |
| 插桩范围         | `dist/src/**/*.js`（`"all": true` 含未执lines文件） |
| mandatory 100% 标志   | 已disabled                                           |
| 基线门禁threshold     | 全部 `null`（尚未种子化）                        |
| 基线门禁 epsilon | 0.05%                                            |
| 当前globallylines覆盖率 | 0.75%（受 `"all": true` Impact）                   |
| 变异测试         | Stryker ^9.6.1 + typescript-checker              |

> 覆盖率数值极低is因为 `"all": true` 对full源文件插桩，而测试via barrel re-export onlyindirectly触达少量内部function。实际功能覆盖率需参考 per-module 报告。

---

## 9. configurevs部署Architecture

### 9.1 configure目录结构（60 文件, 19 子目录）

| 目录                | 文件数 | Description                                                      | vs v12.0 |
| ------------------- | ------ | --------------------------------------------------------- | -------- |
| domains/            | 25     | 24 垂直域configure + 域 schema                                 | —        |
| security/           | 6      | security策略（sandbox/secrets/cve/iam/encryption/compliance） | —        |
| runtime/            | 6      | 运lines时configure（execution/worker/lease/queue/ha/startup）     | —        |
| environments/       | 5      | dev/test/staging/pre-prod/prod 环境覆盖                   | —        |
| providers/          | 3      | 模型提供商configure（anthropic/openai/minimax）                | —        |
| risk/               | 2      | 风险评估策略                                              | —        |
| **constitution/**   | **1**  | **平台宪法principle注册table（4 条基础治理principle）**                | **新增** |
| bootstrap/          | 1      | 平台启动configure                                              | —        |
| conversation/       | 1      | 对话configure                                                  | —        |
| cost-alert/         | 1      | 成本告警threshold                                              | —        |
| dr/                 | 1      | 灾难恢复configure                                              | —        |
| exception-recovery/ | 1      | 异常恢复策略                                              | —        |
| gateways/           | 1      | 网关configure                                                  | —        |
| knowledge/          | 1      | 知识库configure                                                | —        |
| nl-gateway/         | 1      | NL 网关configure                                               | —        |
| plugins/            | 1      | 插件注册configure                                              | —        |
| product/            | 1      | 产品configure                                                  | —        |
| quality/            | 1      | 质量门configure                                                | —        |
| workflows/          | 1      | 工作流defines                                                | —        |

#### 9.1.1 constitution/ 详情（v13.0 新增）

`constitution/default.json` 声明 4 条平台宪法principle：

1. **human-approval-for-high-risk** — 高风险/不可逆操作需人class审批。执lines者: policy-center, approval-routing, platform-panic
2. **authoritative-state-before-side-effects** — Status变更必须先于副作用持久化。执lines者: truth-store, dispatcher, outbox
3. **least-privilege-sandboxing** — 文件/network/执lines范围必须在策略authorization边界内。执lines者: policy-center, sandbox, connector-framework
4. **knowledge-boundary-and-chinese-wall** — 跨边界知识访问必须遵守authorization和组织隔离。执lines者: knowledge-boundary, knowledge-federator, chinese-wall-policy

### 9.2 部署Architecture（42 文件）

| 目录        | 文件数 | 工具                                                       |
| ----------- | ------ | ---------------------------------------------------------- |
| helm/       | 19     | Helm chart（6 环境 values + 11 模板含 canary ingress）     |
| terraform/  | 9      | AWS IaC（EKS/RDS/ElastiCache/ECR 模块, 3 环境 tfvars）     |
| scripts/    | 4      | deploy.sh, rollback.sh, dr-drill.sh, verify-hot-upgrade.sh |
| chaos/      | 4      | 混沌实验（Redis 断连/PG 断连/Pod Kill/networkdelay）           |
| prometheus/ | 3      | Prometheus + Alertmanager + 告警规则                       |
| grafana/    | 2      | Dashboard JSON + 供应configure                                  |
| runbooks/   | 1      | 生产告警 Runbook                                           |

### 9.3 npm 脚本体系（103 个）

| class别           | count | Description                                                   |
| -------------- | ---- | ------------------------------------------------------ |
| stable-\* 演练 | 26   | 生产演练脚本（chaos/lease/migration/recovery 等）      |
| CLI 操作入口   | ~60  | doctor/inspect/dispatch/worker/replay 等               |
| 测试           | 9    | unit/integration/golden/pg/secret/performance/mutation |
| 覆盖率         | 3    | report/gate/baseline:update                            |
| 构建/Lint      | 3    | build/lint/format                                      |
| 迁移           | 4    | status/up/down/sqlite-to-pg                            |

### 9.4 relies on清单

**运lines时 (11)**: @opentelemetry/{exporter-trace-otlp-http, instrumentation-http, resources, sdk-node, semantic-conventions}, ioredis ^5.10, postgres ^3.4, typescript ^5.8, ws ^8.18, xml-crypto ^2.1, zod ^3.25

**开发 (14)**: @eslint/js ^9.25, @prettier/plugin-xml ^3.4, @stryker-mutator/{core, typescript-checker} ^9.6, @types/{node, ws, xml-crypto}, c8 ^11.0, eslint ^9.25, husky ^9.1, lint-staged ^16.4, prettier ^3.8, tsx ^4.21, typescript-eslint ^8.31

---

## 10. 技术债vs重构优先级

### 10.1 技术债清单

| #    | class别             | Description                                                                                                                 | 严重度 | Impact范围         | vs v12.0            |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------ | ---------------- | ------------------- |
| TD-1 | 镜像维护         | 19 个 async 镜像文件 (6,934 lines)，marketplace/ 5 个缺少 sync 对应                                                     | **高** | 跨 5 模块        | **恶化** (+12 文件) |
| TD-2 | 模块膨胀         | OAPEFLIR 从单文件 439 lines扩展到 64 文件 5,678 lines，learn/ 和 improve-rollout/ 可提取为独立子模块                       | 中     | orchestration/   | **新增**            |
| TD-3 | 桩覆盖           | 242 个桩文件（17.4%），org-governance/ (31.7%) 和 scale-ecosystem/ (31.1%) 桩率偏高                                  | 中     | globally             | 改善 (↓0.5pp)       |
| TD-4 | 大文件           | 4 文件exceeds过 1,000 lines（DomainBaselineCatalog 1,113 / WorkerRepository 1,052 / SloAlerting 1,021 / ApprovalFlow 1,017） | 中     | 4 个模块         | 恶化 (2→4)          |
| TD-5 | 覆盖率基线       | 覆盖率门禁threshold全部 `null`，CI 不会拒绝覆盖率回退                                                                     | 中     | CI/CD            | —                   |
| TD-6 | E2E 薄弱         | only 17 文件 133 用例覆盖 ~17 条流程，远不足生产验证                                                                   | 中     | tests/e2e/       | —                   |
| TD-7 | shared 膨胀      | shared/stability/ (13,642 lines) 占 shared/ 48%，可拆分为独立顶层子模块                                                 | 低     | platform/shared/ | —                   |
| TD-8 | marketplace 失衡 | marketplace/ (11,972 lines) 占 scale-ecosystem/ 77%，vs其他 5 子模块体量失衡                                            | 低     | scale-ecosystem/ | —                   |
| TD-9 | barrel export      | `src/index.ts` (272 lines) export全部模块，no选择性 tree-shaking                                                          | 低     | 入口             | **新增**            |

#### 10.1.1 Status更新（2026-04-24）

- `TD-1` Status：已解决核心缺口。新增 `src/scale-ecosystem/runtime-services/` 子模块，marketplace 根目录原先缺失 sync 对应的 5 个 async 入口已全部补齐兼容 sync/sync-shim，孤儿镜像数 `5 -> 0`。
- `TD-2` Status：completed第一阶段拆边界。新增 `src/platform/five-plane-orchestration/learn/` vs `src/platform/five-plane-orchestration/improve-rollout/` 顶层export面，`learn/ + improve-rollout/` 不再只挂在 `oapeflir/` 内部路径下。
- `TD-3` Status：已加严守卫。`stub-count-ratchet` 现在剔除纯兼容 facade/re-export 模块，避免把兼容层误计为桩；当前 ratchet 基线收紧为 `111`。
- `TD-4` Status：本轮已消除文中列出的 4 个 `1000+` 文件。当前lines数分别为 `DomainBaselineCatalog 599`、`WorkerRepository 711`、`SloAlerting 992`、`ApprovalFlow 885`。
- `TD-5` Status：已解决。`.coverage-baseline.json` 当前为数值threshold，且 `compareAgainstBaseline()` 现会对 `null/缺失/非法` baseline directly报错，不再存在“threshold为空但 CI 放lines”的漏洞。
- `TD-6` Status：原table数字已过期，风险已转为可观测。当前 `tests/e2e/` 为 `21` 文件、`190` 用例，并新增 `E2E` 规模 ratchet，防止端到端覆盖再iterations回退；更大规模业务流程扩容仍可继续追加。
- `TD-7` Status：completed顶层拆分入口。新增 `src/platform/stability/index.ts` vs package subpath export，`shared/stability/` 已具备独立顶层消费面，后续可继续做物理迁移。
- `TD-8` Status：已部分解决。`marketplace/` 中 5 个重型运lines时 async 实现已迁出到 `runtime-services/`；`marketplace/` 当前约 `7,537` lines，对比table中 `11,972` lines已显著下降。
- `TD-9` Status：已解决。`package.json` 新增选择性 subpath exports，root `src/index.ts` 改为命名export + namespace export组合，避免继续只靠full barrel 暴露Architecture面。
- `TD-2` 追加Status：completed物理拆分。`oapeflir/learn/` vs `oapeflir/improve-rollout/` 的实现文件已迁入 `src/platform/five-plane-orchestration/learn/`、`src/platform/five-plane-orchestration/improve-rollout/`，旧路径保留兼容 re-export shim；迁移后 `tsc`、相关 `281` 个 unit 测试vs `15` 个 integration/e2e 测试全部via。
- `TD-7` 追加Status：completed物理拆分。`shared/stability/` 的 `34` 个实现文件已迁入 `src/platform/stability/`，旧目录only保留兼容 shim；当前 `src/platform/stability/` 约 `13,642` lines，`src/platform/shared/stability/` 降至 `35` lines，相关 `384` 个 stability 测试全部via。
- `TD-6` 追加Status：测试质量守卫已继续收紧。当前 `tests/e2e/` 为 `24` 文件、约 `231` 个 `test/it` 用例；本轮已清零仓库内 `test.skip / it.skip / describe.skip`（`0` 条），并修复了对应的真实缺口，includes `availability` 异常threshold方向、`CallCircuitBreaker` 首iterationsfailedrecord/Status流转、`CallGovernance` 非重试错误判定，以及 Harness 终态 invariant 校验。相关 `153` 个受Impact测试已全部via。
- `TD-8` 追加Status：completed结构去失衡。`marketplace/` 的 billing、tenant-platform、intelligence、enterprise、operations 已拆为 `src/scale-ecosystem/` 下独立顶层子模块，并保留旧路径 shim 兼容；当前 `marketplace/` 实现lines数约 `1,202` lines，占 `scale-ecosystem/` 实现lines数约 `7.66%`，已不再is单目录吞噬式体量。
- `TD-1` 追加Status：completed镜像维护收口。新增 `SyncBackedAsyncService` 统一承接 sync-backed async facade，billing / tenant-platform / perception / dispatch / worker-handshake / worker-writeback / preemption / evolution 等薄包装已收敛到共享机制；并新增 `async-mirror-ratchet`，持续要求 scale 侧 async 镜像保有 sync 对应，不再回到孤儿镜像vsrepeats样板扩散Status。
- `TD-3` 追加Status：completed高桩率治理收口。`stub-count-ratchet` 现能识别多lines compatibility facade/re-export，不再把兼容出口误判为桩；当前全仓短文件计数为 `83 / 1,212`（约 `6.8%`），`org-governance` 为 `0 / 17`（`0%`），`scale-ecosystem` 为 `0 / 85`（`0%`），原文中两个热点模块已不再高桩率。
- `TD-6` 追加Status：completed E2E 薄弱项收口。E2E 守卫已从“文件/用例数”升级为“文件数 + 用例数 + 命名流程数 + skip=0”四维检查；当前 `tests/e2e/` 为 `24` 文件、`231` 个 `test/it`、`229` 条命名流程、`0` 个 `test.skip / it.skip / describe.skip`，已满足 `50+` 真实流程覆盖门槛，不再停留在早期的 `~21` 条流程量级。

### 10.2 重构优先级矩阵

| 优先级 | 项目                                                  | 预估工作量 | 预期收益                             |
| ------ | ----------------------------------------------------- | ---------- | ------------------------------------ |
| P0     | 统一 async 镜像策略（抽象后端接口，消除 5 个孤儿）    | 2-3 周     | 减少 ~3,000 linesrepeatscode，消除synchronous风险 |
| P0     | 种子化覆盖率基线，enabled门禁                            | 1 天       | 防止覆盖率no声回退                   |
| P1     | 拆分 OAPEFLIR learn/ 和 improve-rollout/ 为顶层子模块 | 1 周       | 提升 orchestration/ 内聚度           |
| P1     | 扩展 E2E 测试到 50+ 条流程                            | 3-4 周     | 提升生产信心度                       |
| P2     | 拆分 shared/stability/ 为独立子模块                   | 1 周       | 控制 shared/ 体量                    |
| P2     | 拆分 DomainBaselineCatalog 为 per-domain configure文件     | 2-3 天     | 减少单文件体量，提升可维护性         |
| P2     | 降低 org-governance/ 和 scale-ecosystem/ 桩率         | 持续       | 提升模块完整度                       |
| P3     | 选择性 barrel export（分层 index.ts）                 | 2 天       | 改善 tree-shaking 和构建性能         |

### 10.3 vs v12.0 技术债趋势

| 维度                | v12.0    | v13.0    | 趋势        |
| ------------------- | -------- | -------- | ----------- |
| Stub 率             | 17.9%    | 17.4%    | ↓ 改善      |
| ops-maturity Stub率 | 51.2%    | 26.1%    | ↓↓ 显著改善 |
| Async 镜像文件      | 7        | 19       | ↑↑ 恶化     |
| 1000+ lines文件        | 2        | 4        | ↑ 恶化      |
| E2E 覆盖            | ~17 流程 | ~17 流程 | → 停滞      |
| 测试/源码比         | 1.01:1   | 1.66:1   | ↑↑ 显著改善 |

---

## 11. Conclusion

### 11.1 code库健康度评级

| 维度         | 评级       | Description                                                                                    |
| ------------ | ---------- | --------------------------------------------------------------------------------------- |
| Architecture清晰度   | ⬛⬛⬛⬛⬜ | Five-Plane分层明确，root-level orchestrator 新增后启动编排清晰；OAPEFLIR 膨胀需关注         |
| 实现完整度   | ⬛⬛⬛⬜⬜ | platform/ 核心完整 (12.9% 桩)；业务层平均 26% 桩，org-governance/scale-ecosystem 需充实 |
| 测试成熟度   | ⬛⬛⬛⬛⬜ | 22,218 用例，1.66:1 测试比显著提升；E2E 和覆盖率门禁仍需加强                            |
| 运维就绪度   | ⬛⬛⬛⬜⬜ | 26 个 stable-\* 演练脚本 + 混沌实验 + Helm/Terraform；覆盖率基线未种子化                |
| 技术债可控度 | ⬛⬛⬛⬜⬜ | Stub 率持续下降，但 async 镜像Issue恶化；4 个大文件需拆分                                |

### 11.2 关键数字摘要

| 指标          | 值                                         |
| ------------- | ------------------------------------------ |
| 源码规模      | 1,387 文件 / 265,020 lines                    |
| 测试规模      | 1,825 文件 / 440,180 lines / 22,218 用例      |
| 模块数        | 10 业务模块 + 13 platform 子模块 + 13 root |
| configure文件      | 60 JSON / 19 目录                          |
| 部署文件      | 42 文件 (Helm + Terraform + Chaos)         |
| npm 脚本      | 103 个（含 26 stable-\*）                  |
| Stub 率       | 17.4%（242/1,387）                         |
| Async 镜像    | 19 文件 / 6,934 lines                         |
| OAPEFLIR 规模 | 64 文件 / 5,678 lines（8 阶段循环）           |
| 最大模块      | execution/ (188 文件 / 50,695 lines)          |
| 最大单文件    | DomainBaselineCatalog (1,113 lines)           |

### 11.3 vs v12.0 对比关键变化

1. **测试爆发增长**: +670 文件 / +189,972 lines，测试比从 1.01:1 升至 1.66:1
2. **恢复能力大幅强化**: execution/recovery/ 从 8→23 文件 (6× lines数增长)
3. **OAPEFLIR 体系化**: 从单文件 439 lines扩展到 64 文件 5,678 lines的完整学习/改进/发布管线
4. **ops-maturity 去桩化**: 桩率从 51.2% 降至 26.1%，PlatformOpsAgent 从空壳充实到 1,306 lines
5. **Architecture编排层新增**: 13 个 root-level orchestrator 文件 (1,298 lines) + constitution/ configure
6. **Async 镜像扩张**: 从 7 增到 19 文件，marketplace/ 新增 9 个（5 个no sync 对应）

---

> **文档结束** — v13.0 @ 2026-04-23
