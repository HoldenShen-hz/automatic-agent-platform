# Automatic Agent System — 代码架构分析与重构基线文档

> **分析日期**: 2026-04-17（第九版，全量重扫 + 新增模块覆盖 + OAPEFLIR 实现分析）
> **分析范围**: src/（797 文件, 174,585 行）、tests/（985 文件, 205,811 行）、config/、divisions/、根目录配置
> **分析方法**: 逐目录静态分析 + 依赖追踪 + 测试覆盖对照 + 模式识别
> **文档定位**: 源码现状、调用链、债务、重构依据；不直接代表上线可信度
> **文档性质**: 内部审计文档，非生产就绪证明。本文记录代码库的实际状态与技术债，作为后续重构任务的事实基线。

---

## 目录

1. [仓库总览与关键指标](#1-仓库总览与关键指标)

   * 1.4 [判定标准：双维度状态体系](#14-判定标准双维度状态体系)
   * 1.5 [架构阻塞项](#15-架构阻塞项-architecture-blockers)
2. [模块清单与状态矩阵（双维度）](#2-模块清单与状态矩阵)
3. [逐模块深度分析](#3-逐模块深度分析)
4. [核心调用链分析（含函数名+文件位置）](#4-核心调用链分析)
5. [模块依赖与边界分析](#5-模块依赖与边界分析)
6. [代码质量问题](#6-代码质量问题)
7. [安全与可靠性分析](#7-安全与可靠性分析)
8. [测试分析](#8-测试分析)
9. [配置与部署架构](#9-配置与部署架构)
10. [重构优先级](#10-重构优先级)
11. [结论](#11-结论)
12. [附录](#附录)（含测试覆盖三分类表）

---

## 1. 仓库总览与关键指标

### 1.1 代码规模

| 指标                | 数值                                        |
| ----------------- | ----------------------------------------- |
| 源码文件 (`src/`)     | 797 个 `.ts` 文件                            |
| 源码行数              | 174,585 行                                 |
| 测试文件 (`tests/`)   | 985 个 `.ts` 文件                            |
| 测试行数              | 205,811 行                                 |
| 测试/源码比            | 1.18:1                                    |
| `src/core/` 子目录   | 42 个 + 1 根文件 (`errors.ts`)                |
| `src/core/` 文件    | 698 个 `.ts` 文件                            |
| `src/core/` 行数    | 164,428 行                                 |
| `src/cli/` 文件     | 78 个                                      |
| `src/cli/` 行数     | 6,149 行                                   |
| `src/gateway/` 文件 | 13 个                                      |
| `src/gateway/` 行数 | 3,471 行                                   |
| `src/plugins/` 文件 | 7 个（**v9 新增顶层模块**）                        |
| `src/plugins/` 行数 | 440 行                                     |
| `src/index.ts`    | 97 行                                      |
| 运行时依赖             | 4 个 (`typescript`, `zod`, `ioredis`, `ws`) |
| Division 定义       | 10 个（56 文件）                               |
| 配置文件              | 24 个（8 层配置类别）                             |
| 文档文件              | 275 个                                     |

### 1.2 技术栈

| 类别   | 技术选型                                               |
| ---- | -------------------------------------------------- |
| 语言   | TypeScript 5.8+ (strict mode + ESM)                |
| 运行时  | Node.js 22+                                        |
| 数据库  | SQLite (WAL mode, ~52 表) + PostgreSQL（适配中）         |
| 缓存   | 内存 + SQLite + Redis (ioredis ^5.10.1)              |
| WebSocket | ws ^8.18.0                                     |
| 测试   | `node:test` + `node:assert/strict` + `c8` 覆盖率     |
| 构建   | `tsc` (build vs build:test 分离)                     |
| Lint | ESLint 9.x flat config + Prettier                  |
| 容器   | 多阶段 Dockerfile, `node:22-bookworm-slim`            |
| CI   | GitHub Actions (矩阵: Node 20/22)                    |

### 1.3 `as unknown as` 类型断言统计（第九版刷新）

| 指标            | 数值                                                   |
| ------------- | ---------------------------------------------------- |
| 总出现次数         | ~50 处                                                |
| 涉及文件数         | ~24 个                                                |
| `as any`      | 3 处                                                  |
| 剩余集中区域        | `tool-argument-coercion.ts` (6), `query-helper.ts` (6, 设计意图保留), 其他各 1-3 |

### 1.4 判定标准：双维度状态体系

本文档对每个模块采用双维度判定，**Implemented ≠ Production-ready，Partial ≠ 不可用**。

**维度 A — 实现状态 (Implementation Status)**

| 状态          | 含义                    |
| ----------- | --------------------- |
| Not Started | 零代码或仅占位文件             |
| Skeleton    | 接口/类型已定义，核心逻辑为空或 TODO |
| Partial     | 主路径已实现，次要路径或边界条件缺失    |
| Implemented | 功能代码完整，可编译通过          |

**维度 B — 生产可信度 (Production Confidence)**

| 等级               | 含义                          |
| ---------------- | --------------------------- |
| Unverified       | 无专项测试，或仅有编译通过               |
| Test-covered     | 有单元/集成测试覆盖主路径               |
| Staging-verified | 已在类生产环境（staging/pre-prod）验证 |
| Production-ready | 经流量验证、故障注入、监控闭环确认           |

> 当前代码库中**无任何模块达到 Staging-verified 或 Production-ready**，因为尚未进行类生产环境部署。

### 1.5 架构阻塞项 (Architecture Blockers)

以下 2 项为当前架构中最突出的阻塞性问题。

| #  | 阻塞项                                     | 严重度 | 位置                                                       | 说明                                                                        |
| -- | --------------------------------------- | --- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| B1 | **PostgreSQL async/sync 不兼容**           | 阻塞  | `postgres/sqlite-database-wrapper.ts` (~111 行) | 同步 API 包装异步 PG 连接，双后端无法切换                                                 |
| B2 | **E2E 测试覆盖不足**                          | 中   | `tests/e2e/` (9 文件, 2,559 行)                       | E2E 覆盖面仍需大幅扩展                                                   |

> **已解决的阻塞项（v5→v8 期间）**: B2-旧 `AuthoritativeTaskStore` God-class 结构性拆除已完成 — `legacy-compat` 从 8,469 行缩减至 308 行，delegating core 拆分为 5 个领域模块，22 个 Repository 合计 8,497 行已成为主承载层。

---

## 2. 模块清单与状态矩阵

### 2.1 `src/core/` 完整模块清单（双维度状态）

| 目录                  | 文件数    | 行数         | 核心服务/类                                                             | 实现状态        | 生产可信度            | 说明                                                         |
| ------------------- | ------ | ---------- | ------------------------------------------------------------------ | ----------- | ---------------- | ---------------------------------------------------------- |
| `errors.ts`         | 1      | 490        | `AppError` + 12 子类                                                 | Implemented | Test-covered     | 统一错误层次，零外部依赖                                               |
| `api/`              | 25     | 4,296      | `HttpApiServer` (450 行), `ApiAuthService`, `OidcOAuthService` (618 行) | Implemented | Test-covered     | HTTP API 层，含 `http-server/` 子目录                           |
| `approvals/`        | 3      | 495        | `ApprovalService`, `ApprovalTimeoutExecutor`                       | Implemented | Test-covered     | HITL 审批工作流 + 超时扫描                                          |
| `agent-loop/`       | **22** | **1,721**  | `OapefLirLoopService` (305), `RuntimeExecuteBridge` (344), `AssessmentService` | **Implemented** | **Unverified** | **v9 新增** OAPEFLIR 循环编排 + handoff + 12 类型文件              |
| `artifacts/`        | **13** | **1,092**  | `ArtifactStore`, `ArtifactPublishService`, `ArtifactPreviewService`, `SensitiveContentScanner` | Implemented | Test-covered     | v9 大幅扩展：发布/预览/治理/敏感内容扫描                                  |
| `cache/`            | 27     | 2,534      | `CacheFacade`, `CacheOrchestrationService`                         | Implemented | Test-covered     | 三级缓存 L1/L2/L3                                              |
| `compliance/`       | 2      | 346        | `AuditExportService`                                               | Implemented | Unverified       | SOC2/ISO/HIPAA/GDPR                                        |
| `config/`           | 27     | 6,776      | `ConfigGovernanceService`                                          | Implemented | Test-covered     | 分层配置 + schema 校验                                           |
| `constants/`        | 2      | 16         | 时间常量                                                               | Implemented | Unverified       | 叶子模块                                                       |
| `cost/`             | 2      | 64         | `BudgetGuard`                                                      | Implemented | Unverified       | 纯逻辑，无 DB 依赖                                                |
| `deployment/`       | 2      | 502        | `TrafficRoutingService`                                            | Implemented | Unverified       | 蓝绿/金丝雀发布                                                   |
| `divisions/`        | 4      | 1,632      | `DivisionLoader`, `DivisionRegistry`                               | Implemented | Test-covered     | Division 定义加载 + 校验                                         |
| `domain-registry/`  | **13** | **2,392**  | `PluginSpiRegistry` (829), `PluginRuntimeHost` (611), `DomainRegistryService` (251) | **Implemented** | **Unverified** | **v9 新增** Plugin SPI 注册 + 运行时宿主 + sandbox/protocol 子目录   |
| `evaluation/`       | **6**  | **1,429**  | `LLMEvalService`, `PromptModelPolicyGovernanceService` (636), `PostExecutionQualityGate` | Implemented | Test-covered     | v9 扩展：Prompt-Model 治理 + 执行后质量门                            |
| `events/`           | 8      | 1,864      | `DurableEventBus`, `TypedEventBus`, `TypedEventPublisher`          | Implemented | Test-covered     | 三层事件投递 + v9 新增 typed publisher                            |
| `evolution/`        | 12     | 2,264      | `EvolutionMvpService`, `ReflectionEngine`                          | Implemented | Unverified       | 自我改进流水线                                                    |
| `feedback/`         | **5**  | **532**    | `SignalPreprocessor` (239), `DomainEventFeedbackConsumer` (206), `FeedbackCollector` | **Implemented** | **Unverified** | **v9 新增** OAPEFLIR 信号预处理与收集                                |
| `hr/`               | 2      | 572        | `HrRoleGovernanceService`                                          | Implemented | Unverified       | 角色治理                                                       |
| `improvement/`      | **10** | **706**    | `PolicyRolloutService` (168), `RolloutScheduler` (131), `RolloutStateMachine` (119) | **Implemented** | **Unverified** | **v9 新增** 渐进发布 + 自动回滚 + 金丝雀路由 + guardrail                 |
| `knowledge/`        | **23** | **3,425**  | `KnowledgePlaneService` (388), `KnowledgeRetrieval` (386), `SemanticVectorStore` (330) | **Implemented** | **Unverified** | **v9 新增** 语义搜索/摄取/治理，含 retrieval/indexing/governance/archive 子目录 |
| `learning/`         | **12** | **437**    | `FailurePatternMiner` (84), `LearningObjectValidator` (65), 5 pattern detectors | **Implemented** | **Unverified** | **v9 新增** 失败模式挖掘 + 截断/权限/幻觉/schema-loop 检测器             |
| `lifecycle/`        | 3      | 276        | `ServiceRegistry` (268 行), `EvolutionMvpService` re-export        | Implemented | Test-covered     | 单例管理核心                                                     |
| `locking/`          | 8      | 640        | `DistributedLockAdapter` (SQLite/PG/Redis)                         | Implemented | Test-covered     | 策略模式 + 工厂                                                  |
| `memory/`           | 15     | 3,286      | `MemoryService`, `MemoryPlaneService`, `MemoryPromotionEngine`, `MemoryRetrievalService` | Implemented | Test-covered     | 分层记忆 + FTS5 + BM25 + v9 新增 plane/promotion/retrieval/consolidation |
| `messages/`         | 2      | 509        | `TokenEstimator`                                                   | Implemented | Test-covered     | 消息解析 + token 估算                                            |
| `observability/`    | 36     | 8,105      | `StructuredLogger`, `HealthService`, `DiagnosticsService`, v9 新增 `anomaly-detection/` + `otel-*` + `transports/` | Implemented | Test-covered     | 完整可观测性栈 + v9 新增异常检测/OTel/传输层                              |
| `ops/`              | 19     | 8,304      | `DoctorService`, `EnterpriseGovernanceService`                     | Implemented | Test-covered     | 运维工具集                                                      |
| `orchestration/`    | 3      | 1,054      | `IntakeRouter` (723 行), `AgentTeamService`                        | Implemented | Test-covered     | 请求路由 + 编排                                                  |
| `planning/`         | **9**  | **314**    | `PlanDagValidator` (67), `PlanBuilder` (63), `ReplanningService` (49), `TaskDecompositionService` | **Implemented** | **Unverified** | **v9 新增** DAG 任务规划 + 重规划                                    |
| `product/`          | 22     | 7,103      | `BillingService` (792 行), `MarketplaceGovernanceService` (788 行)  | Implemented | Test-covered     | 计费/市场/合规                                                   |
| `providers/`        | 10     | 4,399      | `UnifiedChatProvider`, `BaseChatProvider`, `CircuitBreaker`        | Implemented | Test-covered     | 多 Provider LLM 抽象 + 断路器                                    |
| `queue/`            | 6      | 771        | `QueueAdapter` (SQLite/Redis)                                      | Implemented | Test-covered     | 策略模式 + 工厂                                                  |
| `reliability/`      | 8      | 1,112      | `RepairPipeline`, `FailureClassification`                          | Implemented | Unverified       | 修复流水线                                                      |
| `resource/`         | 2      | 361        | `ProcessTracker`                                                   | Implemented | Test-covered     | 进程追踪（单例）                                                   |
| `results/`          | 2      | 390        | `ResultEnvelope`                                                   | Implemented | Unverified       | 标准化结果封装                                                    |
| `runtime/`          | **113** | **30,119** | `TransitionService`, `ExecutionLeaseService`, `AgentExecutor`      | Implemented | Test-covered     | **核心执行引擎**，含 9 个子目录                                       |
| `security/`         | 19     | 7,125      | `SandboxPolicy`, `PolicyEngine`, `SecretManagementService`         | Implemented | Test-covered     | 纵深防御                                                       |
| `stability/`        | 31     | 12,789     | `GoldenTaskRunner`, 18+ 排练套件                                       | Implemented | Test-covered     | 稳定性排练框架                                                    |
| `storage/`          | **101** | **26,026** | `AuthoritativeTaskStore` (已拆分为领域委托层 + 22 Repository) | Implemented | **Indirect**     | 双后端 SQLite/PG（PG 不可用）                                     |
| `storage/postgres/` | 11     | 1,966      | PG 适配                                                              | **Partial** | **Unverified**   | async/sync 不兼容                                             |
| `tools/`            | 36     | 13,500     | `CommandExecutor`, `PatchDslService`, `SkillExecutionService`      | Implemented | Test-covered     | 工具执行 + 安全                                                  |
| `types/`            | 21     | 2,887      | Domain 类型, IDs, Status 枚举                                          | Implemented | Unverified       | 纯类型定义                                                      |
| `utils/`            | 2      | 109        | `BoundedCache`                                                     | Implemented | Unverified       | 工具叶子模块，零测试                                                 |
| `workflow/`         | 4      | 992        | `WorkflowValidator`, `MinimalWorkflow`                             | Implemented | Test-covered     | 工作流定义 + 校验                                                 |

### 2.2 v5→v8 关键结构变化

| 变化                                 | v5                          | v8                                                     |
| ---------------------------------- | --------------------------- | ------------------------------------------------------ |
| `authoritative-task-store-*` 位置    | `storage/` 根目录 7 文件 9,695 行 | 移至 `sqlite/` 子目录，拆分为领域委托层 + facade                     |
| `legacy-compat`                    | 8,469 行                     | **308 行**（缩减 96%）                                      |
| delegating core                    | 单文件 756 行                   | 拆分为 5 个领域模块: base/lifecycle/runtime/engagement/governance |
| `sqlite/repositories/`             | 22 文件 5,874 行               | **22 文件 8,497 行**（+45%）                                |
| `runtime/` 子目录                    | 7 个                         | **9 个**（新增 `recovery/`, `worker/`）                     |
| `runtime/` 文件/行数                  | 76 / 23,032                 | **110 / 29,553**                                       |
| 运行时依赖                              | 2 个                         | **4 个**（新增 `ioredis`, `ws`）                            |
| `ha-coordinator-service.ts`        | 680 行                       | 2 行 re-export barrel → `ha-coordinator/` 5 文件 1,458 行 |

### 2.3 v8→v9 关键结构变化

| 变化                                 | v8                          | v9                                                     |
| ---------------------------------- | --------------------------- | ------------------------------------------------------ |
| `src/core/` 子目录数                  | 35                          | **42**（+7 新模块）                                        |
| `src/core/` 文件/行数                 | 564 / 150,462               | **698 / 164,428**（+134 文件, +13,966 行）                 |
| `src/` 总文件/行数                     | 654 / 159,747               | **797 / 174,585**（+143 文件, +14,838 行）                 |
| `tests/` 总文件/行数                   | 886 / 182,461               | **985 / 205,811**（+99 文件, +23,350 行）                  |
| **新增顶层模块** `src/plugins/`          | 不存在                        | **7 文件, 440 行** — 内置插件实现                              |
| **新增 OAPEFLIR 支撑模块**              | 不存在                        | `agent-loop/` (22/1,721) + `feedback/` (5/532) + `learning/` (12/437) + `improvement/` (10/706) + `planning/` (9/314) |
| **新增知识平面** `knowledge/`            | 不存在                        | **23 文件, 3,425 行** — 语义搜索/向量存储/摄取/治理                |
| **新增插件 SPI** `domain-registry/`    | 不存在                        | **13 文件, 2,392 行** — Plugin SPI 注册表 + 运行时宿主          |
| `artifacts/` 扩展                    | 2 文件, 370 行                | **13 文件, 1,092 行**（6.5× 增长）                           |
| `observability/` 扩展                | 26 文件, 7,013 行             | **36 文件, 8,105 行**（+异常检测/OTel/传输层）                   |
| `evaluation/` 扩展                   | 3 文件, 1,335 行              | **6 文件, 1,429 行**（+Prompt-Model 治理）                   |
| `memory/` 扩展                       | 11 文件, 3,058 行             | **15 文件, 3,286 行**（+plane/promotion/retrieval）        |

---

## 3. 逐模块深度分析

### 3.1 `src/core/runtime/` — 核心执行引擎

**规模**: 110 文件, 29,553 行 — 代码库最大、最复杂的模块。含 9 个子目录 + 81 个根文件 (21,610 行)。

#### 3.1.1 子目录结构（v8 新增）

| 子目录                | 文件数 | 行数    | 职责                                  |
| ------------------ | --- | ----- | ----------------------------------- |
| `recovery/`        | 4   | 2,196 | 恢复编排/决策/重放/修复                       |
| `worker/`          | 7   | 1,532 | Worker 注册/发现/负载均衡/握手支持/回写支持         |
| `ha-coordinator/`  | 5   | 1,458 | HA 协调器/异步版本/工厂/映射/类型                |
| `execution-lease/` | 2   | 685   | 租约类型和工具函数                           |
| `supervisor/`      | 1   | 522   | 监督器                                 |
| `planner/`         | 1   | 444   | 规划器                                 |
| `dispatcher/`      | 1   | 426   | 工具调度注册表                             |
| `orchestrator/`    | 2   | 369   | 编排器类型 + 入口                          |
| `orchestration/`   | 4   | 311   | phase1b 工具定义和工具函数                   |

#### 3.1.2 根文件按职能分组

**核心执行 (8 文件, ~3,800 行)**

| 文件                            | 行数   | 职责                                                                               |
| ----------------------------- | ---- | -------------------------------------------------------------------------------- |
| `agent-executor.ts`           | 304  | 正式执行骨架 + 中间件链 (before/after model hooks)                                         |
| `agent-middleware-chain.ts`   | 465  | 中间件管线: before_agent → before_model → wrap_model_call → after_model → after_agent |
| `transition-service.ts`       | 734  | 四套状态机 (Task/Workflow/Session/Execution) 集中管理                                     |
| `single-task-happy-path.ts`   | 594  | 单任务快乐路径                                                                          |
| `single-task-execution.ts`    | ~400 | 单任务执行路径                                                                          |
| `phase1a-happy-path.ts`       | ~350 | Phase1A 执行路径                                                                     |
| `phase1b-orchestration.ts`    | ~31  | **已重构为重导出**                                                                      |
| `model-call-provider.ts`      | 440  | Model 调用 Provider 单例                                                             |

**租约与 Worker 管理 (6 根文件, ~4,500 行 + worker/ 子目录 1,532 行)**

| 文件                                             | 行数   | 职责                 |
| ---------------------------------------------- | ---- | ------------------ |
| `execution-lease-service.ts`                   | 796  | 租约获取/续期/释放/回收/写入校验 |
| `execution-worker-handshake-service.ts`        | 789  | Worker 认领/心跳/远程日志  |
| `execution-worker-writeback-service.ts`        | 734  | Worker 结果回写        |
| `execution-dispatch-service.ts`                | 733  | 票据分发 + Worker 资格评估 |
| `execution-dispatch-support.ts`                | 337  | 调度支持工具函数           |
| `execution-dispatch-reconciliation-service.ts` | ~300 | 调度对账               |

**恢复与修复 (recovery/ 子目录 4 文件 2,196 行 + 根文件)**

| 文件                                        | 行数   | 职责          |
| ----------------------------------------- | ---- | ----------- |
| `runtime-recovery-service.ts`             | 546  | 恢复编排入口      |
| `runtime-recovery-decision-service.ts`    | 355  | 恢复决策逻辑      |
| `runtime-recovery-replay-service.ts`      | 700  | Tier-1 事件重放 |
| `runtime-repair-service.ts`               | 595  | 状态修复        |
| `stalled-execution-detector.ts`           | ~85  | 卡顿检测        |
| `stalled-execution-escalation-service.ts` | ~200 | 卡顿升级        |

**HA 与基础设施 (ha-coordinator/ 5 文件 1,458 行 + 根文件)**

| 文件                                      | 行数   | 职责                        |
| --------------------------------------- | ---- | ------------------------- |
| `ha-coordinator-service.ts`             | 2    | Re-export barrel → `ha-coordinator/` |
| `ha-coordinator/ha-coordinator-service.ts` | 680 | HA 协调器，领导选举               |
| `ha-coordinator/ha-coordinator-service-async.ts` | 525 | HA 异步版本                  |
| `cross-region-deployment-service.ts`    | 663  | 跨区域部署 (Experimental)      |
| `hot-upgrade-service.ts`                | 706  | 热升级 (Experimental)        |
| `hot-upgrade-service-async.ts`          | 448  | 热升级异步版本                   |
| `graceful-shutdown.ts`                  | 276  | 优雅关闭 + 信号处理               |
| `startup-preflight.ts`                  | ~200 | 启动前检查                     |
| `startup-consistency-checker.ts`        | 510  | 启动后一致性校验                  |

**中间件与检测 (根文件)**

| 文件                               | 行数   | 职责                    |
| -------------------------------- | ---- | --------------------- |
| `loop-detection.ts`              | 443  | Agent 循环模式检测          |
| `call-governance.ts`             | 747  | LLM 调用治理              |
| `admission-controller.ts`        | ~300 | 请求准入控制                |
| `effect-buffer.ts`               | 549  | 副作用缓冲                 |
| `license-enforcement-service.ts` | 584  | 许可证执行                 |
| `hitl-explainability-service.ts` | 582  | HITL 可解释性             |
| `execution-priority-preemption-service.ts` | 528 | 优先级抢占               |
| `orphan-cleanup-service.ts`      | 457  | 孤儿清理                  |
| `context-compaction-service.ts`  | ~250 | 上下文窗口压缩              |

#### 3.1.3 架构评价

**优点**:

* 中间件链模式 (`agent-middleware-chain.ts`) 提供良好的可扩展性
* 租约 + fencing token 模式完整实现
* 状态机转换服务集中且严格
* v8 新增 9 个子目录组织（`recovery/`, `worker/`, `ha-coordinator/` 等），扁平度显著改善
* HA 协调器已拆分为独立子目录含异步版本

**问题**:

* 根目录仍有 81 个文件 21,610 行，可进一步分组
* `stalled-execution-detector.ts` 仅 85 行，检测逻辑过简
* HA 协调器和跨区域部署仍为 Experimental 状态

---

### 3.2 `src/core/storage/` — 数据持久化层

**规模**: 99 文件, 25,355 行 — 代码库第二大模块。子目录: `sqlite/` (47 文件, 13,894 行, 含 `sqlite/repositories/` 22 文件 8,497 行), `postgres/` (11 文件, 1,966 行), `sql/` (6 文件, 838 行), `repositories/` (3 文件), `async-repositories/`, `migrations/`。

#### 3.2.1 AuthoritativeTaskStore 拆分现状（v8 重大变化）

**v5 → v8 核心变化**: 所有 `authoritative-task-store-*` 文件已从 `storage/` 根目录迁移至 `sqlite/` 子目录。`legacy-compat` 从 8,469 行**缩减至 308 行**（-96%），delegating core 拆分为 5 个领域委托模块。

| 层级                   | 文件                                                | 行数    | 说明                |
| -------------------- | ------------------------------------------------- | ----- | ----------------- |
| Facade               | `sqlite/authoritative-task-store-facade.ts`       | 12    | 向后兼容 facade alias |
| Core                 | `sqlite/authoritative-task-store-core.ts`         | 1     | 薄 re-export       |
| Delegating Base      | `sqlite/authoritative-task-store-delegating-base.ts` | 224 | 基础委托层             |
| Delegating Lifecycle | `sqlite/authoritative-task-store-delegating-lifecycle.ts` | 246 | 生命周期委托            |
| Delegating Runtime   | `sqlite/authoritative-task-store-delegating-runtime.ts` | 213 | 运行时委托             |
| Delegating Engagement | `sqlite/authoritative-task-store-delegating-engagement.ts` | 345 | 交互委托              |
| Delegating Governance | `sqlite/authoritative-task-store-delegating-governance.ts` | 346 | 治理委托              |
| Legacy compat        | `sqlite/authoritative-task-store-legacy-compat.ts` | **308** | 兼容语义承载层（原 8,469 行） |
| Compat               | `sqlite/authoritative-task-store-compat.ts`       | 5     | 向后兼容              |
| Repositories         | `sqlite/authoritative-task-store-repositories.ts` | 92    | repositories 装配   |
| Types                | `sqlite/authoritative-task-store-types.ts`        | 373   | 类型定义              |

**当前状态**: God-class 拆除**已基本完成**。Legacy compat 从 8,469 行缩减至 308 行，delegating core 拆分为 5 个领域模块（base 224 + lifecycle 246 + runtime 213 + engagement 345 + governance 346 = 1,374 行）。22 个 Repository 合计 8,497 行已成为主数据访问层。

**`sqlite/repositories/` 子目录 (22 文件, 8,497 行)** — 主承载层:

| Repository                  | 行数    | 职责                |
| --------------------------- | ----- | ----------------- |
| `worker-repository.ts`      | 1,057 | Worker 数据访问       |
| `operations-repository.ts`  | 868   | 运维操作数据访问          |
| `billing-repository.ts`     | 793   | 计费数据访问            |
| `release-repository.ts`     | 674   | 发布管理数据访问          |
| `event-repository.ts`       | 654   | 事件数据访问            |
| `organization-repository.ts`| 502   | 组织数据访问            |
| `session-repository.ts`     | 480   | 会话数据访问            |
| `marketplace-repository.ts` | 414   | 市场数据访问            |
| `intelligence-repository.ts`| 411   | 情报数据访问            |
| `approval-repository.ts`    | 365   | 审批数据访问            |
| `evolution-repository.ts`   | 339   | 进化数据访问            |
| `dispatch-repository.ts`    | 324   | 调度数据访问            |
| `secret-repository.ts`      | 278   | 密钥数据访问            |
| `execution-repository.ts`   | 268   | 执行数据访问            |
| `memory-repository.ts`      | 252   | 记忆数据访问            |
| `task-repository.ts`        | 219   | 任务数据访问            |
| `workflow-repository.ts`    | 186   | 工作流数据访问           |
| `lock-repository.ts`        | 164   | 锁数据访问             |
| `artifact-repository.ts`    | 118   | 产物数据访问            |
| `division-repository.ts`    | 70    | Division 数据访问     |
| `lease-repository.ts`       | 38    | 租约数据访问            |
| `index.ts`                  | 23    | 桶导出               |

#### 3.2.2 SQLite 基础设施

| 文件                                      | 行数   | 职责                             |
| --------------------------------------- | ---- | ------------------------------ |
| `sqlite-database.ts`                    | 698  | WAL-mode SQLite 封装，事务管理，迁移支持   |
| `sqlite-migration-runtime-part3.ts`     | 561  | 运行时迁移执行 (part 3)              |
| `sqlite-migration-runtime-part2.ts`     | 516  | 运行时迁移执行 (part 2)              |
| `sqlite-migration-plan.ts`              | 346  | 迁移计划 + checksum 校验             |
| `sqlite-reliability-service.ts`         | 236  | 备份、完整性检查、WAL 管理                |
| `sqlite-schema-compatibility-gate.ts`   | 212  | 兼容性门禁                          |
| `sqlite-migration-compatibility.ts`     | 186  | Schema 兼容性检查                   |
| `sqlite-async-adapter.ts`               | 129  | 异步适配器                          |
| `sqlite-migration-runtime-part1.ts`     | 126  | 运行时迁移执行 (part 1)              |
| `query-helper.ts`                       | 103  | SQL 查询辅助层                      |
| `session-summary-autogen.ts`            | 99   | 会话摘要自动生成                       |

#### 3.2.3 存储根文件

| 文件                             | 行数  | 职责                             |
| ------------------------------ | --- | ------------------------------ |
| `storage-backend-factory.ts`   | 462 | 统一后端创建入口                       |
| `session-dual-storage.ts`      | 357 | 双存储会话管理                        |
| `storage-quota-service.ts`     | 328 | 存储配额服务                         |
| `storage-backend-config.ts`    | 304 | 后端配置                           |
| `async-sql-database.ts`        | 177 | 异步 SQL 数据库接口                   |
| `async-query-helper.ts`        | 56  | 异步查询辅助                         |

#### 3.2.4 PostgreSQL 适配

| 文件                                      | 行数     | 说明              |
| --------------------------------------- | ------ | --------------- |
| `pg-migrations-product.ts`              | 670    | 产品迁移            |
| `pg-database.ts`                        | ~300   | PostgreSQL 封装   |
| `pg-schema.ts` + `pg-schema-support.ts` | ~500   | Schema 管理       |
| `sqlite-database-wrapper.ts`            | ~111   | SQLite 兼容性包装    |
| 其他迁移/DDL 文件                            | ~385   | DDL + 迁移        |

**PostgreSQL 适配问题**: async/sync 不兼容仍为 B1 阻塞项。

#### 3.2.5 架构评价

**优点**:

* WAL 模式 + busy timeout 配置合理
* 迁移系统有 checksum 校验
* **Repository 提取已完成** — 22 个 Repository 8,497 行为主承载层
* **God-class 拆除完成** — legacy compat 从 8,469 行缩减至 308 行
* delegating core 拆分为 5 个领域模块，职责清晰
* `StorageBackendFactory` 提供统一的后端创建入口

**问题**:

* PostgreSQL 后端不可用（async/sync 不兼容）
* `sqlite-database-wrapper.ts` 位于 `postgres/` 目录（模块归属混乱）
* 查询结果无运行时 schema 校验

---

### 3.3 `src/core/tools/` — 工具执行与安全

**规模**: 36 文件, 13,523 行

#### 3.3.1 核心文件

| 文件                               | 行数   | 职责                                          |
| -------------------------------- | ---- | ------------------------------------------- |
| `command-executor.ts`            | 512  | 沙箱化命令执行，并发限制 (max 16)，`spawnTracked` 已集成    |
| `command-security.ts`            | 388  | 命令风险评估，元字符/Fork bomb 检测                     |
| `patch-dsl-service.ts`           | 791  | Patch DSL 解析与应用                             |
| `edit-replacement-service.ts`    | 709  | 智能文件编辑 + 冲突检测                              |
| `semantic-repo-map-service.ts`   | 722  | 仓库语义映射                                      |
| `skill-execution-service.ts`     | ~500 | Skill 执行 + 缓存                              |
| `skill-governance-service.ts`    | ~475 | Skill 治理                                    |
| `tool-output-sanitizer.ts`       | ~459 | 输出清理，secret 脱敏，注入检测                         |
| `tool-parallel-executor.ts`      | ~436 | 工具并行执行                                      |

#### 3.3.2 安全链条（7 层防御）

```
1. 元字符检测: |, >, <, `, &&, ||, ;, $(...), ${...}, \r, \n
2. 命令策略: 未知命令默认拒绝
3. 参数验证: 脚本解释器必须带脚本路径
4. 远程管道检测: curl url | bash
5. Fork bomb 检测
6. Sandbox 路径验证 (realpath + symlink traversal)
7. 输出清理 (secret 脱敏 + 注入检测)
```

---

### 3.4 `src/core/security/` — 安全模块

**规模**: 18 文件, 7,012 行

| 子系统                 | 文件                                                                                                               | 行数   | 状态                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| 沙箱策略                | `sandbox-policy.ts`                                                                                              | 327  | Implemented — 3 模式: read_only / workspace_write / danger_full_access |
| 策略引擎                | `policy-engine.ts`                                                                                               | 320  | Implemented — 决策链: kill switch → budget → risk → approval → allow    |
| Secret 管理           | `secret-management-service.ts`                                                                                   | 510  | Implemented — 多 Provider 注册/轮换/审计                                    |
| Secret Provider (云) | `vault-http-secret-provider.ts`, `aws-kms-http-secret-provider.ts`, `gcp-secret-manager-http-secret-provider.ts` | ~750 | Partial — 未生产验证                                                      |
| CVE 情报              | `cve-intelligence-service.ts`                                                                                    | 748  | Implemented                                                          |
| 网络出口                | `network-egress-policy.ts`, `network-egress-audit.ts`, `outbound-url-policy.ts`                                  | ~600 | Implemented                                                          |
| 数据分类                | `data-classification-service.ts`                                                                                 | 730  | Implemented — PII/敏感数据分类                                             |
| 审计完整性               | `audit-event-integrity.ts`                                                                                       | ~200 | Implemented — Tier-1 审计事件链                                           |

---

### 3.5 `src/core/observability/` — 可观测性

**规模**: 26 文件, 7,013 行

| 子系统         | 核心文件                                                   | 行数    | 状态                                                      |
| ----------- | ------------------------------------------------------ | ----- | ------------------------------------------------------- |
| 结构化日志       | `structured-logger.ts`                                 | 342   | Implemented — 环形缓冲 + 文件 sink                            |
| 健康检查        | `health-service.ts`                                    | 498   | Implemented — ok → degraded → overloaded → unhealthy    |
| 诊断          | `diagnostics-service.ts` + `diagnostics-support.ts`    | 1,165 | Implemented — 快照/时间线/重现包                                |
| 指标          | `metrics-service.ts`                                   | 404   | Implemented — 运行时指标聚合                                   |
| 异常检测        | `anomaly-detection-service.ts`                         | 796   | Implemented — 统计异常检测                                    |
| Prometheus  | `prometheus-metrics-exporter.ts`                       | ~167  | Partial — 导出逻辑存在，HTTP 端点在 `health-routes.ts` 中暴露       |
| SLI/SLO     | `sli-collection-service.ts`, `slo-alerting-service.ts` | ~600  | Implemented — 集成未验证                                     |
| 追踪          | `trace-context.ts`                                     | ~200  | Implemented                                             |

---

### 3.6 `src/core/events/` — 事件基础设施

**规模**: 7 文件, 1,634 行

| 文件                        | 行数   | 职责                                |
| ------------------------- | ---- | --------------------------------- |
| `durable-event-bus.ts`    | 346  | 三层事件投递 + ack 追踪 + 指数退避重试 (max 3)  |
| `typed-event-bus.ts`      | ~186 | 类型安全事件总线 + `TypedEventPayloadMap` |
| `typed-event-payloads.ts` | ~200 | 事件 Payload 类型定义                   |
| `event-types.ts`          | 97   | Tier 1/2/3 事件分类                   |
| `event-registry.ts`       | ~330 | 事件 Schema 注册表                     |

**Tier 语义**:

* **Tier 1**: publish 前必须完成 DB 写入 + ack 记录创建，消费者必须确认
* **Tier 2**: 事件写入，ack 可选；用于 dispatch/worker/recovery
* **Tier 3**: 尽力而为，不创建 ack 记录；用于 SSE stream

---

### 3.7 `src/core/providers/` — LLM Provider 抽象

**规模**: 10 文件, 4,401 行

| 文件                                      | 行数   | 职责                                                            |
| --------------------------------------- | ---- | ------------------------------------------------------------- |
| `unified-chat-provider.ts`              | 452  | 统一聊天接口，多 Provider 抽象（集成断路器）                                   |
| `base-chat-provider.ts`                 | 326  | **抽象基类** — 重试/限流解析/凭证 failover 模板方法                           |
| `circuit-breaker.ts`                    | 289  | 断路器 — 防止 Provider 连续失败级联                                      |
| `model-routing-service.ts`              | 674  | 智能模型选择（route-class → coding/reasoning/classification/writing） |
| `provider-credential-pool.ts` + support | ~750 | 多密钥凭证管理 + 轮换                                                  |
| `anthropic/anthropic-chat-service.ts`   | ~580 | Anthropic Claude                                              |
| `openai/openai-chat-service.ts`         | ~617 | OpenAI GPT                                                    |
| `minimax/minimax-chat-service.ts`       | ~450 | MiniMax                                                       |

---

### 3.8 `src/gateway/` — 渠道网关

**规模**: 13 文件, 3,472 行

| 文件                                            | 行数  | 职责                                  |
| --------------------------------------------- | --- | ----------------------------------- |
| `channel-gateway-delivery-service.ts`         | 787 | 投递保障 — 重试追踪/限流/死信/HMAC 签名/nonce 防重放 |
| `channel-gateway-service.ts`                  | 631 | 路由消息至 Telegram/Slack/Webhook        |
| `stream/stream-bridge.ts`                     | 396 | SSE 流引擎 — 帧发射/序列号/重放缓冲 + 智能淘汰       |
| `targets/gateway-target-directory-service.ts` | 617 | 目标注册/查找/6 级解析                       |
| `channel-gateway-retry-executor.ts`           | 150 | 后台轮询器 — 每 15s 处理重试队列                |
| `storage-port.ts`                             | 32  | 端口接口（六边形架构）                         |
| `storage-adapter.ts`                          | ~50 | `GatewayStorageAdapter` 实现          |

**架构亮点**: 策略模式 + 六边形端口 + 多层重试 + SSE 重放缓冲 + 每通道限流

---

### 3.9 `src/cli/` — CLI 命令入口

**规模**: 76 文件, 5,721 行

#### 3.9.1 Bootstrap 三种模式

| 模式                          | 使用文件数 | 说明                       |
| --------------------------- | ----- | ------------------------ |
| `withCliStorage` + `main()` | ~38   | 主流模式：打开存储 → 迁移 → 执行 → 关闭 |
| `createStableCli()` 工厂      | 22    | 稳定性排练专用                  |
| 顶层命令式                       | ~5    | 无 `main()` 包装，直接执行       |

#### 3.9.2 CLI 分类

| 类别       | 文件数 | 代表文件                                                      |
| -------- | --- | --------------------------------------------------------- |
| 稳定性排练    | 24  | `stable-chaos.ts`, `stable-lease.ts`, ...                 |
| 运行时/执行   | 10  | `dispatch-execution.ts`, `worker-handshake.ts`, ...       |
| 可观测性/调试  | 6   | `inspect.ts`, `diagnostics.ts`, `doctor.ts`               |
| 存储/事件    | 5   | `authoritative-storage.ts`, `drain-events.ts`, ...        |
| 恢复/修复    | 3   | `repair.ts`, `replay-recovery.ts`, `ha-program.ts`        |
| 治理/合规    | 7   | `ops-governance.ts`, `enterprise-governance.ts`, ...      |
| 产品/平台    | 8   | `billing.ts`, `marketplace.ts`, `tenant-platform.ts`, ... |
| API 服务器  | 1   | `api-server.ts` (207 行)                                   |

#### 3.9.3 重复模式问题

| 重复模式                                                                          | 出现次数 | 说明                                                                               |
| ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {}`                | ~20  | 条件 dbPath 透传                                                                     |
| `console.log(JSON.stringify(output, null, 2))` vs `process.stdout.write(...)` | ~50  | 两种输出方式不一致                                                                        |
| 治理 CLI 大块服务实例化                                                                | 3    | `doctor.ts`, `ops-governance.ts`, `enterprise-governance.ts` 共享几乎相同的 10+ 服务初始化代码 |

---

### 3.10 `src/core/stability/` — 稳定性排练框架

**规模**: 31 文件, 12,789 行

#### 3.10.1 框架结构

| 层级   | 文件                                                                                        | 说明               |
| ---- | ----------------------------------------------------------------------------------------- | ---------------- |
| 运行器  | `golden-task-runner.ts`                                                                   | Golden path 任务执行 |
| 验收线  | `stable-acceptance-line.ts`                                                               | 验收标准校验           |
| 证据体系 | `stable-evidence-bundle.ts`, `stable-evidence-campaign.ts`, `stable-evidence-sequence.ts` | 证据收集/聚合框架        |
| 发布门禁 | `stable-release-gate.ts`                                                                  | 发布前评估            |
| VCR  | `vcr-replay-fixture.ts`                                                                   | 确定性回放测试          |

#### 3.10.2 排练套件 (18+)

| 排练         | 文件                                            | 测试场景   |
| ---------- | --------------------------------------------- | ------ |
| 混沌         | `stable-chaos-smoke.ts`                       | 故障注入   |
| 并发         | `stable-concurrency-rehearsal.ts`             | 并发执行   |
| 调度         | `stable-dispatch-rehearsal.ts`                | 调度路径   |
| 租约         | `stable-lease-rehearsal.ts`                   | 租约生命周期 |
| Worker 握手  | `stable-worker-handshake-rehearsal.ts`        | 握手协议   |
| Worker 回写  | `stable-worker-writeback-rehearsal.ts`        | 结果回写   |
| 备份恢复       | `stable-backup-restore-rehearsal.ts`          | 备份/恢复  |
| DB 可写性     | `stable-db-writability-rehearsal.ts`          | 数据库写入  |
| DB 队列断连    | `stable-db-queue-disconnect-rehearsal.ts`     | 断连修复   |
| 事件重放       | `stable-event-replay-rehearsal.ts`            | 事件回放   |
| 回滚         | `stable-rollback-rehearsal.ts`                | 版本回滚   |
| 滚动升级       | `stable-rolling-upgrade-rehearsal.ts`         | 热升级    |
| 灰度发布       | `stable-gray-release-rehearsal.ts`            | 金丝雀/灰度 |
| Schema 迁移  | `stable-migration-compatibility-rehearsal.ts` | 迁移兼容性  |
| Prompt 注入  | `stable-prompt-injection-red-team.ts`         | 安全红队   |
| 维护模式       | `stable-maintenance-rehearsal.ts`             | 维护期行为  |
| 跨 Division | `stable-cross-division-recovery-drill.ts`     | 跨部门恢复  |
| 浸泡测试       | `stable-runtime-soak-runner.ts`               | 长时间运行  |

---

### 3.11 其他模块概览

| 模块               | 文件 | 行数    | 核心服务                                         | 要点                                                                           |
| ---------------- | -- | ----- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `api/`           | 25 | 4,296 | `HttpApiServer` (450 行)                      | `http-server/` 子目录，`console-routes.ts` 461 行                              |
| `approvals/`     | 3  | 495   | `ApprovalService`, `ApprovalTimeoutExecutor` | break-glass 紧急旁路 + 审计 + 超时扫描                                                 |
| `cache/`         | 27 | 2,534 | `CacheFacade`                                | 三级缓存 L1/L2/L3，策略-per-namespace                                               |
| `config/`        | 26 | 6,395 | `ConfigGovernanceService`                    | 8 层配置校验 (bootstrap/runtime/security/providers/gateways/workflows/product/environments) |
| `evolution/`     | 12 | 2,275 | `EvolutionMvpService`                        | 完整自我改进管线: evidence → reflection → proposal → benchmark → promotion → rollout |
| `locking/`       | 8  | 640   | `DistributedLockAdapter`                     | SQLite + PG Advisory + Redis 三种后端，fencing token                              |
| `ops/`           | 19 | 8,338 | `DoctorService`                              | 15+ 诊断检查，聚合系统健康                                                              |
| `orchestration/` | 3  | 1,053 | `IntakeRouter` (723 行)                       | 关键字路由 + trigger 模式匹配 + intent 分类                                             |
| `product/`       | 22 | 7,103 | `BillingService` (792 行)                     | 完整计费: 账户/配额/使用/发票/支付网关                                                       |
| `queue/`         | 6  | 904   | `QueueAdapter`                               | SQLite + Redis 两种后端                                                          |
| `reliability/`   | 8  | 1,112 | `RepairPipeline`                             | Plan → Build → Review → Validate → Repair → Release/Escalate                 |
| `workflow/`      | 4  | 992   | `WorkflowValidator`                          | 空工作流/重复 ID/缺失角色/依赖环/无效配置检测                                                   |

### 3.12 `src/core/agent-loop/` — OAPEFLIR 循环编排（v9 新增）

**规模**: 22 文件, 1,721 行 — OAPEFLIR (Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Reflect) 循环的核心编排层。

#### 3.12.1 文件结构

| 文件/目录                         | 行数  | 职责                                   |
| ----------------------------- | --- | ------------------------------------ |
| `oapeflir-loop-service.ts`    | 305 | 循环主控：驱动 O→A→P→E→F→L→I→R 八阶段顺序执行     |
| `runtime-execute-bridge.ts`   | 344 | 桥接 OAPEFLIR 循环与 runtime 执行引擎         |
| `assessment-service.ts`       | 106 | Assess 阶段：评估当前状态并决定是否进入 Plan 阶段      |
| `handoff-builder.ts`          | ~80 | 阶段间数据交接构建器                           |
| `handoff-serializer.ts`       | ~60 | 交接数据序列化/反序列化                         |
| `types/` (12 文件)              | ~826 | 各阶段输入/输出类型定义 + 循环上下文 + 配置类型         |

#### 3.12.2 架构要点

- **八阶段循环**: 每轮循环依次执行 Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Reflect
- **桥接模式**: `RuntimeExecuteBridge` 将 OAPEFLIR 的 Execute 阶段委托给已有的 `runtime/` 执行引擎，避免重复实现
- **类型安全交接**: 每个阶段通过 `HandoffBuilder` 构建强类型交接数据，`HandoffSerializer` 支持持久化
- **依赖方向**: agent-loop → runtime (Execute 阶段)、agent-loop → feedback (F 阶段)、agent-loop → learning (L 阶段)、agent-loop → improvement (I 阶段)、agent-loop → planning (P 阶段)

### 3.13 `src/core/knowledge/` — 知识平面（v9 新增）

**规模**: 23 文件, 3,425 行 — 语义搜索、知识摄取、治理的统一平面。

#### 3.13.1 核心文件

| 文件                            | 行数  | 职责                                |
| ----------------------------- | --- | --------------------------------- |
| `knowledge-plane-service.ts`  | 388 | 知识平面入口：统一 CRUD + 检索接口             |
| `knowledge-retrieval.ts`      | 386 | 检索引擎：BM25 + 向量相似度混合排名             |
| `knowledge-query-service.ts`  | 374 | 查询服务：查询解析 + 意图识别 + 结果聚合           |
| `semantic-vector-store.ts`    | 330 | 向量存储：embedding 索引 + ANN 近似最近邻搜索  |
| `embedding-provider.ts`       | 270 | Embedding 提供者：多模型适配 + 缓存           |
| `semantic-knowledge-graph.ts` | 260 | 语义知识图谱：实体/关系建模 + 图遍历              |

#### 3.13.2 子目录结构

| 子目录            | 文件数 | 职责                        |
| -------------- | --- | ------------------------- |
| `retrieval/`   | ~4  | 检索策略：BM25/向量/混合            |
| `indexing/`    | ~4  | 索引构建与增量更新                  |
| `governance/`  | ~3  | 知识质量治理：过期/冲突/准确性检查         |
| `archive/`     | ~3  | 归档与版本化                     |
| `intake/`      | ~3  | 知识摄取管线：文档解析 → 分块 → embedding |

#### 3.13.3 架构要点

- **混合检索**: BM25 词频检索 + 向量相似度检索 → RRF (Reciprocal Rank Fusion) 融合排名
- **分层摄取**: 文档 → 分块 (chunking) → embedding → 向量索引 + 关键词索引
- **知识治理**: 过期知识自动降权、冲突检测、准确性评分

### 3.14 `src/core/domain-registry/` — Plugin SPI 注册表（v9 新增）

**规模**: 13 文件, 2,392 行 — 插件 SPI 注册、运行时宿主、沙箱隔离。

#### 3.14.1 核心文件

| 文件                          | 行数  | 职责                              |
| --------------------------- | --- | ------------------------------- |
| `plugin-spi-registry.ts`   | 829 | SPI 注册表：插件发现/注册/版本管理/依赖解析       |
| `plugin-runtime-host.ts`   | 611 | 运行时宿主：插件生命周期管理/通信协议/资源配额        |
| `domain-registry-service.ts` | 251 | 领域注册服务：将 SPI 注册表暴露为领域服务        |
| `plugin-runtime-child.ts`  | 202 | 子进程运行时：插件在独立进程中执行，通过 IPC 通信    |

#### 3.14.2 子目录

| 子目录          | 职责                           |
| ------------ | ---------------------------- |
| `sandbox/`   | 插件沙箱：文件系统隔离 + 网络限制 + 资源上限    |
| `protocol/`  | 宿主-插件通信协议定义                   |

#### 3.14.3 架构要点

- **SPI 模式**: 插件通过 `PluginSpiRegistry` 注册，宿主通过接口契约调用，无直接耦合
- **进程隔离**: 每个插件在 `PluginRuntimeChild` 子进程中运行，崩溃不影响主进程
- **资源治理**: CPU/内存/文件系统配额由 `sandbox/` 执行

### 3.15 `src/core/artifacts/` — 制品管理（v9 大幅扩展）

**规模**: 13 文件, 1,092 行（v8: 2 文件, 370 行，增长 6.5×）

#### 3.15.1 新增能力

| 文件                             | 行数  | 职责                         |
| ------------------------------ | --- | -------------------------- |
| `artifact-publish-service.ts`  | ~120 | 制品发布：版本化 + 签名 + 分发          |
| `artifact-preview-service.ts`  | ~100 | 制品预览：沙箱化渲染 + 安全过滤          |
| `artifact-governance-service.ts` | ~90 | 制品治理：保留策略 + 大小限制 + 合规检查    |
| `sensitive-content-scanner.ts` | ~80 | 敏感内容扫描：PII/密钥/凭证检测         |

#### 3.15.2 架构要点

- **完整生命周期**: 创建 → 存储 (SHA-256) → 扫描 → 预览 → 发布 → 治理 → 归档
- **安全扫描**: 发布前强制通过 `SensitiveContentScanner` 检测 PII 和密钥泄露

### 3.16 `src/core/evaluation/` — 评估与治理（v9 扩展）

**规模**: 6 文件, 1,429 行（v8: 3 文件, 1,335 行）

#### 3.16.1 新增能力

| 文件                                         | 行数  | 职责                                |
| ------------------------------------------ | --- | --------------------------------- |
| `prompt-model-policy-governance-service.ts` | 636 | Prompt-Model 策略治理：模型选择/Prompt 模板/成本控制 |
| `execution-outcome-evaluator.ts`           | ~80 | 执行结果评估：成功/失败/部分成功判定                |
| `post-execution-quality-gate.ts`           | ~60 | 执行后质量门：自动质检 + 人工审核触发条件             |

#### 3.16.2 架构要点

- **策略驱动**: `PromptModelPolicyGovernanceService` (636 行) 是 OAPEFLIR 循环中 Assess 阶段的策略决策核心
- **质量门控**: 每次执行后通过 `PostExecutionQualityGate` 决定是否需要人工介入

### 3.17 OAPEFLIR 支撑模块群（v9 新增）

#### 3.17.1 `feedback/` — 信号预处理（5 文件, 532 行）

| 文件                                   | 行数  | 职责                           |
| ------------------------------------ | --- | ---------------------------- |
| `signal-preprocessor.ts`             | 239 | 原始信号清洗：去噪/归一化/时间对齐            |
| `domain-event-feedback-consumer.ts`  | 206 | 领域事件消费：将 DurableEventBus 事件转换为反馈信号 |
| `feedback-collector.ts`              | 41  | 反馈收集聚合                        |

#### 3.17.2 `learning/` — 失败模式学习（12 文件, 437 行）

| 文件/目录                        | 行数 | 职责                           |
| ---------------------------- | -- | ---------------------------- |
| `failure-pattern-miner.ts`   | 84 | 失败模式挖掘：频繁模式提取 + 根因关联          |
| `learning-object-validator.ts` | 65 | 学习对象校验：确保学到的模式有效             |
| `pattern-detectors/` (5 文件)  | ~288 | 具体检测器：截断/权限/幻觉/schema-loop/通用 |

#### 3.17.3 `improvement/` — 渐进改进（10 文件, 706 行）

| 文件                                | 行数  | 职责                           |
| --------------------------------- | --- | ---------------------------- |
| `policy-rollout-service.ts`       | 168 | 策略发布服务：渐进式策略变更推送              |
| `rollout/rollout-scheduler.ts`    | 131 | 发布调度器：时间窗口 + 流量百分比            |
| `rollout/rollout-state-machine.ts` | 119 | 发布状态机：canary → staged → full  |
| `canary-traffic-router.ts`        | ~70 | 金丝雀流量路由                       |
| `guardrail-evaluator.ts`          | ~60 | 护栏评估器：自动回滚条件判断                |
| `autonomy-boundary-policy.ts`     | ~50 | 自治边界策略：限定 Agent 自动改进范围        |

#### 3.17.4 `planning/` — DAG 任务规划（9 文件, 314 行）

| 文件                             | 行数 | 职责                 |
| ------------------------------ | -- | ------------------ |
| `plan-dag-validator.ts`        | 67 | DAG 校验：环检测/孤立节点/依赖完整性 |
| `plan-builder.ts`              | 63 | 计划构建器：从任务描述生成 DAG   |
| `replanning-service.ts`        | 49 | 重规划服务：执行失败后触发重新规划   |
| `task-decomposition-service.ts` | 23 | 任务分解：将复杂任务拆分为子任务   |

### 3.18 `src/plugins/` — 内置插件实现（v9 新增）

**规模**: 7 文件, 440 行 — 通过 `domain-registry/` SPI 注册的内置插件实现。

| 文件                               | 行数  | 职责                              |
| -------------------------------- | --- | ------------------------------- |
| `adapters/github-adapter.ts`     | 120 | GitHub API 适配器：PR/Issue/Commit + egress 策略 |
| `planners/basic-planner.ts`      | 86  | 基础规划器：简单任务的线性规划                  |
| `retrievers/coding-retriever.ts` | 72  | 代码检索器：AST 感知的代码片段检索              |
| `validators/basic-evaluator.ts`  | 63  | 基础评估器：简单的成功/失败判定                 |
| `presenters/coding-presenter.ts` | 46  | 代码展示器：diff/patch 格式化输出            |
| `builtin-plugin-registry.ts`     | 28  | 内置插件注册表：自动注册上述 5 个内置插件           |

#### 3.18.1 架构要点

- **SPI 对接**: 每个插件实现 `domain-registry/` 中定义的 SPI 接口，通过 `builtin-plugin-registry.ts` 批量注册
- **egress 控制**: `github-adapter.ts` 遵循安全模块的出站策略（仅允许 api.github.com）
- **可替换**: 外部插件可通过相同 SPI 注册替换内置实现

---

## 4. 核心调用链分析

### 4.1 请求进入链

```
用户请求 (CLI/SDK/SSE)
    ↓
IntakeRouter.route()
  [src/core/orchestration/intake-router.ts:343]
    - 输入规范化 (title + request → lowercase)
    - 检测 orchestration hints
    - Intent 分类 (query/create/modify/approve/cancel/clarify/chitchat/correction)
    - Trigger 匹配选择 Division (按 priority 降序, 10→60)
    - 判断是否需要 orchestration
    ↓
DivisionLoader.loadAll() → DivisionRegistry (数据接口)
  [src/core/divisions/division-loader.ts:189]
    ↓
AgentExecutor.executeAgentRound()
  [src/core/runtime/agent-executor.ts:222]
    - before_agent 中间件
    - before_model 中间件
    - wrap_model_call 中间件 (LLM 调用)
    - after_model 中间件
    - after_agent 中间件
    ↓
TransitionService.transition() — 5 个重载 (Task/Workflow/Session/Execution/Approval)
  [src/core/runtime/transition-service.ts:228,275,307,333,374]
    ↓
DurableEventBus.publish() → dispatch:ticket_created (Tier-2 event)
  [src/core/events/durable-event-bus.ts:119]
```

### 4.2 调度分发链

```
ExecutionDispatchService.dispatchNext()
  [src/core/runtime/execution-dispatch-service.ts:174]
    ↓
evaluateWorkersForTicket() (私有方法)
  [src/core/runtime/execution-dispatch-service.ts:451]
    - Worker 资格检查
    - 负载偏斜分析
    ↓
ExecutionLeaseService.acquireLease()
  [src/core/runtime/execution-lease-service.ts:111]
    - fencing_token = latest + 1
    - 5 步验证
    ↓
ExecutionLease 创建
    ↓
DurableEventBus.publish() → dispatch:ticket_claimed (Tier-2 event)
```

### 4.3 工具执行链

```
SkillExecutionService.execute()
  [src/core/tools/skill-execution-core-methods.ts:64]
    ↓
Cache lookup (SHA256 based, 含 gitHead)
    ↓
For each step (sequential):
    Resource ceiling check
    Tool call via ToolRunner
        ↓
    CommandExecutor.execute()
      [src/core/tools/command-executor.ts]
        1. Concurrency check (max 16)
        2. CommandSecurity assessment (7 层)
        3. Sandbox path validation (realpath + symlink)
        4. Process spawn — spawnTracked()
        5. Output sanitization
        ↓
    sanitizeToolOutput()
      [src/core/tools/tool-output-sanitizer.ts:189]
    On failure: retry / continue / fail
    ↓
DurableEventBus.publish() → skill:step_*
```

### 4.4 事件投递链

```
DurableEventBus.publish(input: { eventType, payload, tier })
  [src/core/events/durable-event-bus.ts:119]
    ↓
db.transaction():
    Insert EventRecord
    Tier 1/2: Create ack records for required consumers
    Commit
    ↓
scheduleFanOut() 调度各消费者
    ↓
deliverPending() 串行投递 (deliveryChains 防并发)
    ↓
deliverSingleEvent() — 重试循环
  MAX_DELIVERY_RETRIES=3, calculateBackoff()
    ↓
Consumer ack() 或重试耗尽后标记 status:"failed"
```

### 4.5 Gateway 投递链

```
ChannelGatewayService.sendMessage(input)
  [src/gateway/channel-gateway-service.ts:95]
    ↓
GatewayTargetDirectoryService.resolveTarget(query)
  [src/gateway/targets/gateway-target-directory-service.ts:220]
    - 6 级解析: exact/prefix × targetId/displayName/alias
    ↓
deliverResolvedTarget() (私有方法)
    - Telegram: POST /sendMessage
    - Slack: POST /chat.postMessage
    - Webhook: POST with HMAC-SHA256 signature
    ↓
On failure:
    ChannelGatewayDeliveryService.recordDeliveryFailure()
    if retryable && attempts < 5 → schedule retry (backoff)
    else → dead letter queue
    ↓
ChannelGatewayRetryExecutor (每 15s):
    processRetryQueue() → batch 25
    rate limit check → re-deliver
```

### 4.6 恢复重放链

```
RuntimeRecoveryService.buildRuntimeRecoveryView()
  [src/core/runtime/recovery/runtime-recovery-service.ts:257]
    ↓
RuntimeRecoveryDecisionService.decide()
  [src/core/runtime/recovery/runtime-recovery-decision-service.ts:110]
    ↓
RuntimeRecoveryReplayService.buildTaskReplayReport()
  [src/core/runtime/recovery/runtime-recovery-replay-service.ts:233]
    - 读取 Tier-1 事件
    - 按时间顺序重放
    - 重建一致状态
    ↓
ExecutionLeaseService.acquireLease() — 回收过期租约
    ↓
TransitionService.transition() — 修复状态
```

---

## 5. 模块依赖与边界分析

### 5.1 架构分层

```
                    src/cli/ (78 files, 6,149 lines)
                          │
                    src/plugins/ (7 files, 440 lines)  ←── domain-registry/ (SPI)
                          │
                    src/core/api/ (25 files, 4,296 lines)
                          │
               src/core/orchestration/ → src/core/agent-loop/ (OAPEFLIR)
                                               │
                    ┌──────────┬────────────────┼────────────────┬──────────┐
                    │          │                │                │          │
              planning/   feedback/      src/core/runtime/   learning/  improvement/
              (Plan)      (Feedback)           │               (Learn)   (Improve)
                                    ┌─────────┼─────────┐
                                    │         │         │
                              providers/   tools/    storage/
                            (LLM 调用)   (命令执行)  (持久化)
                                    │         │         │
                              security/ ─── observability/ ─── events/
                                    │
                              knowledge/ (语义检索)
                                    │
                                    ↓
                         src/gateway/ (13 files, 3,471 lines)
```

### 5.2 叶子模块（零 src/core/ 内部依赖）

| 模块             | 行数  | 说明                    |
| -------------- | --- | --------------------- |
| `errors.ts`    | 490 | 所有错误子类的基类             |
| `constants/`   | 16  | 时间常量                  |
| `cost/`        | 64  | 纯预算计算逻辑               |
| `utils/`       | 109 | BoundedCache          |
| `types/ids.ts` | 47  | `newId()`, `nowIso()` |

### 5.3 核心依赖基座

```
types/ → errors.ts → observability/structured-logger → storage/ → 其他所有模块
```

### 5.4 异常依赖（抽象泄漏）

| 依赖                                    | 问题                 | 严重度 |
| ------------------------------------- | ------------------ | --- |
| 多个 service → `storage.sql` 直接        | 穿透 store 封装直接操作 DB | 中   |
| `tools/` → `runtime/` (值依赖)          | 工具执行依赖运行时上下文       | 中   |

### 5.5 单例管理

`lifecycle/service-registry.ts` (268 行) 管理以下模块级单例:

* `division-loader` (defaultRegistryCache)
* `tool-registry` (dispatcher/index.ts)
* `middleware-context`, `agent-executor-context`
* `network-egress-audit`, `network-egress-policy`
* `output-continuation`, `model-call-provider`
* `graceful-shutdown`, `process-tracker`

### 5.6 工厂模式

| 工厂                       | 可选后端                         | 文件                                   |
| ------------------------ | ---------------------------- | ------------------------------------ |
| `StorageBackendFactory`  | SQLite / PostgreSQL          | `storage/storage-backend-factory.ts` |
| `QueueAdapterFactory`    | SQLite / Redis               | `queue/`                             |
| `DistributedLockFactory` | SQLite / PG Advisory / Redis | `locking/`                           |

### 5.7 循环依赖

未发现显式循环导入。但通过模块级单例和 storage 层存在隐式耦合:

* 几乎所有 service → `storage/` → `types/` → 基座
* `runtime/` ↔ `tools/` 存在双向值依赖

---

## 6. 代码质量问题

### 6.1 类型安全

| 问题                 | 位置                                                                      | 数量    | 严重度 |
| ------------------ | ----------------------------------------------------------------------- | ----- | --- |
| `as unknown as`    | 24 个文件，共 ~50 处                                                         | ~50 处 | 中   |
| `as any`           | 3 处                                                                     | 3     | 低   |
| 无 schema 校验的查询结果   | 所有 store 方法                                                             | 全部    | 中   |
| 空值断言 `!`           | 多处                                                                      | 未统计   | 中   |

### 6.2 代码重复

| 问题                                                               | 行数     | 严重度 |
| ---------------------------------------------------------------- | ------ | --- |
| CLI 治理文件 (doctor/ops-governance/enterprise-governance) 共享大块初始化代码 | ~300 行 | 中   |
| CLI 输出方式不一致 (`console.log` vs `process.stdout.write`)            | ~50 处  | 低   |

### 6.3 复杂度中心

| 文件                                | 行数    | 公开方法 | 问题                   |
| --------------------------------- | ----- | ---- | -------------------- |
| `worker-repository.ts`            | 1,057 | ~30  | Repository 层最大文件     |
| `operations-repository.ts`        | 868   | ~25  | 运维操作数据访问复杂           |
| `anomaly-detection-service.ts`    | 796   | ~20  | 统计逻辑复杂               |
| `execution-lease-service.ts`      | 796   | ~15  | 多重验证链                |
| `billing-service.ts`              | 792   | ~30  | 完整计费引擎               |
| `patch-dsl-service.ts`            | 791   | ~10  | DSL 解析逻辑复杂           |
| `marketplace-governance-service.ts` | 788  | ~20  | 市场治理                 |

### 6.4 生命周期与资源管理

| 问题                   | 位置                                   | 严重度 |
| -------------------- | ------------------------------------ | --- |
| 无 dispose 方法         | `ProviderCredentialPool`             | 中   |
| 模块级状态无清理             | Runtime 单例                           | 中   |
| Timer/Interval 无统一清理 | `RetryExecutor` 使用 `.unref()` 但非通用方案 | 中   |

---

## 7. 安全与可靠性分析

### 7.1 安全能力矩阵

| 能力           | 状态              | 证据                                                                                | 评价               |
| ------------ | --------------- | --------------------------------------------------------------------------------- | ---------------- |
| Sandbox 路径验证 | **Implemented** | `sandbox-policy.ts` 327 行, 3 模式, realpath + symlink 检测                            | 完整               |
| Shell 注入防御   | **Implemented** | 7 层防御链, `command-security.ts` 388 行                                               | 完整               |
| 命令策略         | **Implemented** | deny-by-default, 未知命令拒绝                                                           | 完整               |
| 输出清理         | **Implemented** | `tool-output-sanitizer.ts`, secret 脱敏, 注入检测                                       | 完整               |
| OIDC/OAuth   | **Implemented** | `oidc-oauth-service.ts` 618 行, JWKS 获取, IdP 令牌校验                                  | 完整，需生产验证         |
| JWT 认证       | **Implemented** | `api-auth-service.ts`, HMAC 密钥交换, 角色授权                                            | 缺少算法白名单          |
| Secret 管理    | **Implemented** | 510 行, 多 Provider (Env/Vault/AWS KMS/GCP SM)                                      | 云 Provider 未生产验证 |
| CVE 情报       | **Implemented** | `cve-intelligence-service.ts` 748 行                                               | 完整               |
| 网络出口控制       | **Implemented** | `network-egress-policy.ts` + `outbound-url-policy.ts` + `network-egress-audit.ts` | 完整               |
| 数据分类         | **Implemented** | `data-classification-service.ts` 730 行, PII/敏感数据                                  | 完整               |
| 审计完整性        | **Implemented** | Tier-1 审计事件链 + 完整性验证                                                              | 完整               |
| MCP 工具防护     | **Implemented** | `mcp-tool-guard.ts`, 工具协议校验 + 清理                                                  | 完整               |

### 7.2 可靠性能力矩阵

| 能力                   | 状态               | 证据                                                     | 评价         |
| -------------------- | ---------------- | ------------------------------------------------------ | ---------- |
| 租约 + fencing token   | **Implemented**  | `execution-lease-service.ts` 796 行, 5 步验证              | 完整         |
| 事务性状态更新              | **Implemented**  | `db.transaction()` 包裹状态变更                              | 完整         |
| Tier-1 事件持久化         | **Implemented**  | `durable-event-bus.ts` 346 行                           | 完整         |
| 优雅关闭                 | **Implemented**  | `graceful-shutdown.ts` 276 行, 信号处理 + 有序 teardown       | 完整         |
| 进程追踪                 | **Implemented**  | `process-tracker.ts`, PID + PGID 追踪                    | 完整         |
| 循环检测                 | **Implemented**  | `loop-detection.ts` 443 行                              | 完整         |
| 准入控制                 | **Implemented**  | `admission-controller.ts` ~300 行                       | 完整         |
| 上下文压缩                | **Implemented**  | `context-compaction-service.ts` ~250 行                 | 完整         |
| Gateway 重试 + DLQ     | **Implemented**  | 指数退避, max 5 次, 限流, 死信队列                                | 完整         |
| 断路器                  | **Implemented**  | `circuit-breaker.ts` 289 行，`UnifiedChatProvider` 已集成   | 完整，需生产验证   |
| 热升级                  | **Experimental** | `hot-upgrade-service.ts` 706 行 + async 448 行           | 需验证        |
| 跨区域部署                | **Experimental** | `cross-region-deployment-service.ts` 663 行             | 需验证        |

### 7.3 可观测性能力矩阵

| 能力            | 状态              | 证据                                                                 |
| ------------- | --------------- | ------------------------------------------------------------------ |
| 结构化日志         | **Implemented** | `StructuredLogger` 342 行, 环形缓冲                                    |
| 健康检查          | **Implemented** | 4 级: ok → degraded → overloaded → unhealthy                        |
| Prometheus 导出 | **Partial**     | 导出逻辑在 `prometheus-metrics-exporter.ts`，HTTP 端点在 `health-routes.ts` |
| 诊断服务          | **Implemented** | 快照/时间线/重现包，1,165 行                                                 |
| 异常检测          | **Implemented** | 统计异常检测 796 行                                                      |
| SLI/SLO       | **Implemented** | 收集 + 告警，集成未验证                                                      |
| 分布式追踪         | **Partial**     | `trace-context.ts` 存在但无 OpenTelemetry 集成                           |

---

## 8. 测试分析

### 8.1 测试规模

| 类别                    | 文件数     | 行数          | 说明                    |
| --------------------- | ------- | ----------- | --------------------- |
| `tests/unit/`         | ~680    | ~142,000    | 隔离逻辑测试                |
| `tests/integration/`  | ~270    | ~55,000     | 跨服务测试                 |
| `tests/e2e/`          | ~10     | ~2,800      | 端到端测试                 |
| `tests/golden/`       | ~8      | ~1,400      | Golden path 回归        |
| `tests/performance/`  | ~7      | ~1,600      | 性能基准测试                |
| **合计**                | **985** | **205,811** |                       |

**测试执行结果** (v9 扫描):

* 总用例: ~9,400+ 个
* 测试/源码比: 1.18:1
* v8→v9 新增: +99 测试文件, +23,350 行

### 8.2 测试框架与模式

| 特性     | 说明                                                               |
| ------ | ---------------------------------------------------------------- |
| 框架     | `node:test` (非 Jest/Vitest)                                      |
| 断言库    | `node:assert/strict`                                             |
| 覆盖率    | `c8`, CI 门禁: 85%                                                |
| 主要模式   | 扁平 `test()` 调用 (~97% 文件)                                         |
| Mock   | 全部手写工厂函数 (`createMock*()`)，无第三方 mock 库                           |
| 数据库    | 多数集成测试使用真实 SQLite，通过 helpers 种子数据                                |
| 临时工作区  | `createTempWorkspace()` + `cleanupPath()` + `finally` 块          |
| 进程泄漏检测 | `createProcessGuard()` / `withProcessGuard()` (ADR-072)          |

### 8.3 覆盖状况

#### 覆盖优秀的模块 (单元 + 集成 ≥ 80% 路径覆盖)

| 模块               | 单元测试  | 集成测试  | 关键文件                                                                  |
| ---------------- | ----- | ----- | --------------------------------------------------------------------- |
| `runtime/`       | 37 文件 | 51 文件 | transition-service, execution-lease, dispatch, handshake, shutdown    |
| `security/`      | 16 文件 | 54 文件 | sandbox, policy-engine, secret-mgmt, network-egress                   |
| `api/`           | 6 文件  | 2 文件  | http-api-server, oidc-oauth                                          |
| `providers/`     | 5 文件  | —     | anthropic, openai, model-routing                                      |
| `gateway/`       | 5 文件  | —     | channel-gateway, delivery, stream-bridge                              |
| `tools/`         | 22 文件 | —     | command-executor, edit-replacement, skill-execution, output-sanitizer |
| `observability/` | 14 文件 | 5 文件  | health-service, inspect-service, slo-alerting                        |
| `product/`       | 11 文件 | 3 文件  | billing-payment-gateway, billing-service                              |
| `ops/`           | 11 文件 | 3 文件  | doctor, deployment-execution                                          |

#### 覆盖不足的模块

| 模块                | 缺失                                          | 风险 |
| ----------------- | ------------------------------------------- | -- |
| `providers/`      | `base-chat-provider.ts`, `unified-chat-provider.ts` 缺专项测试 | 中  |
| `security/`       | 3 个云 Secret Provider (Vault/AWS KMS/GCP SM) | 中  |
| `reliability/`    | repair-pipeline, failure-classification     | 中  |

#### 零测试或低测试模块

| 模块                       | 文件      | 风险        |
| ------------------------ | ------- | --------- |
| `utils/bounded-cache.ts` | 109 行   | 中         |
| `constants/time.ts`      | 16 行    | 低         |
| `types/` (全部)            | 2,887 行 | 低 — 纯类型定义 |
| `planning/` (v9 新增)      | 314 行   | 中 — 需验证覆盖 |
| `learning/` (v9 新增)      | 437 行   | 中 — 需验证覆盖 |
| `feedback/` (v9 新增)      | 532 行   | 中 — 需验证覆盖 |
| `improvement/` (v9 新增)   | 706 行   | 中 — 需验证覆盖 |

### 8.4 测试架构问题

| 问题                       | 影响                     | 严重度 |
| ------------------------ | ---------------------- | --- |
| 手写 mock 导致脆弱测试           | 接口变更时 mock 不会编译报错      | 中   |
| 模块级单例导致测试间隐式耦合           | `resetAllSingletons()` 可能遗漏 | 中   |
| 197 个浅层测试文件（仅 1-2 个用例）   | 覆盖深度不足                 | 中   |

---

## 9. 配置与部署架构

### 9.1 配置层级

```
config/
├── bootstrap/default.json              # 应用标识 + 阶段 (phase_1a)
├── runtime/{default,dev,test,staging,pre-prod,prod}.json
│                                       # 并发/超时/Agent 轮次/Tool 调用数
├── security/{default,dev,test,staging,pre-prod,prod}.json
│                                       # 审批模式/沙箱行为/破坏性操作
├── providers/{default,models,models.bundled}.json
│                                       # LLM 模型配置 (4 profile)
├── gateways/default.json               # 网关配置 (cli, SSE)
├── workflows/default.json              # 默认工作流
├── product/default.json                # 计费方案 (Community/Pro/Enterprise)
└── environments/{dev,test,staging,pre-prod,prod}.json
                                        # 部署环境 (registry, namespace, cluster)
```

### 9.2 环境梯度

| 环境       | 并发数 | 任务超时 | 审批模式       | 允许破坏性操作 | 发布策略                        |
| -------- | --- | ---- | ---------- | ------- | --------------------------- |
| dev      | 1   | 120s | auto       | —       | rolling, canary             |
| test     | 2   | 180s | supervised | —       | rolling, canary             |
| staging  | 4   | 240s | supervised | —       | rolling, canary, blue_green |
| pre-prod | 6   | 300s | supervised | false   | canary, blue_green          |
| prod     | 8   | 600s | **strict** | false   | canary, blue_green          |

### 9.3 Docker 部署

```dockerfile
# 多阶段构建
FROM node:22-bookworm-slim AS build
# npm ci + npm run build

FROM node:22-bookworm-slim AS runtime
# 仅拷贝 dist/, config/, divisions/, AGENTS.md, CLAUDE.md
# npm ci --omit=dev
# 非 root 用户 (node)
CMD ["node", "--enable-source-maps", "dist/src/index.js"]
```

```yaml
# docker-compose.yml
services:
  api-server:
    ports: ["3000:3000"]
    resources: { limits: { cpus: "1", memory: "512M" } }
    healthcheck: { test: "wget -qO- http://localhost:3000/healthz" }
    restart: unless-stopped
```

### 9.4 CI 管线

```yaml
# .github/workflows/ci.yml
triggers: push(main/master/codex/**) + PR
matrix: [Node 20, Node 22]
steps:
  - npm ci
  - npm run lint
  - npm audit --level high
  - npm run typecheck
  - npm run test (c8 coverage)
  - npm run validate:stable (2 iterations)
  - upload: test-results/ + coverage/
```

---

## 10. 重构优先级

### P0 — 阻塞生产部署

| # | 任务                           | 来源     | 说明                                                                       |
| - | ---------------------------- | ------ | ------------------------------------------------------------------------ |
| 1 | **PostgreSQL async/sync 修复** | §3.2.4 | `sqlite-database-wrapper.ts` 的同步包装不可用，双后端无法切换；且该文件位置错误（在 `postgres/` 目录） |

### P1 — 高优先级工程债

| # | 任务                         | 来源     | 说明                                                     |
| - | -------------------------- | ------ | ------------------------------------------------------ |
| 2 | **统一 CLI bootstrap**       | §3.9.3 | 76 个 CLI 文件 ad-hoc 初始化，治理 CLI 大块重复代码                   |
| 3 | **HTTP API 路由表抽象**         | §3.11  | if/else 分发路由需抽象                                        |

### P2 — 中长期能力建设

| #  | 任务                       | 来源     | 说明                                       |
| -- | ------------------------ | ------ | ---------------------------------------- |
| 4  | **runtime/ 根文件继续分组**     | §3.1.3 | 81 个根文件 21,610 行可进一步子目录化                 |
| 5  | **浅层测试加深**               | §8.4   | 197 个仅 1-2 用例的测试文件需加深覆盖                  |
| 6  | **HA 协调器生产验证**           | §3.1.2 | Experimental 状态                          |
| 7  | **热升级生产验证**              | §3.1.2 | Experimental 状态                          |
| 8  | **SLI/SLO 集成验证**         | §3.5   | 代码完整但集成未验证                               |
| 9  | **云 Secret Provider 验证** | §3.4   | Vault/AWS KMS/GCP SM 未生产验证               |
| 10 | **v9 新增模块测试覆盖**          | §3.12-3.18 | agent-loop/knowledge/domain-registry 等 7 新模块需补充测试 |
| 11 | **plugin-spi-registry 拆分** | §3.14  | 单文件 829 行偏大，考虑按职责拆分                     |

> **已完成（从 v5 P0/P1 移除）**: AuthoritativeTaskStore God-class 拆除 — legacy compat 96% 缩减，delegating core 5 领域拆分，22 Repository 为主承载层。

---

## 11. 结论

### 11.1 架构总体评价

**系统处于"功能完整、OAPEFLIR 循环落地、结构性重构基本收敛"阶段。** 核心执行引擎、安全链条、事件系统、可观测性栈均已实现。v9 全量重扫确认 v8 以来最大进展为 **OAPEFLIR 循环支撑模块群的新增**（agent-loop/feedback/learning/improvement/planning 共 58 文件 3,710 行）、**知识平面 knowledge/** (23 文件 3,425 行)、**Plugin SPI domain-registry/** (13 文件 2,392 行)，以及 artifacts 的 6.5× 扩展。`src/core/` 子目录从 35 增至 42，新增 7 个领域模块。测试覆盖持续增长至 985 文件 / 205,811 行 / 1.18:1 测试/源码比。

**优点**:

1. **OAPEFLIR 循环实现** — 八阶段循环编排已落地：agent-loop (1,721 行) 驱动 O→A→P→E→F→L→I→R，配套 feedback/learning/improvement/planning 支撑
2. **知识平面** — knowledge/ (23 文件 3,425 行) 实现语义搜索 (BM25 + 向量混合检索)、知识摄取、治理
3. **Plugin SPI 架构** — domain-registry/ (13 文件 2,392 行) + src/plugins/ (7 文件 440 行) 实现进程隔离的插件体系
4. **测试覆盖持续提升** — 985 测试文件 / 205,811 行 / 1.18:1 测试/源码比（v8: 886 / 182,461 / 1.14:1）
5. **God-class 拆除完成** — `authoritative-task-store-legacy-compat` 从 8,469 行缩减至 308 行
6. **极低供应链风险** — 仅 4 个运行时包 (`typescript`, `zod`, `ioredis`, `ws`)
7. **纵深安全防御** — 7 层 Shell 注入防御 + 沙箱 + 策略引擎 + 网络出口控制
8. **三层事件语义** — Tier 1/2/3 分层投递清晰，`DurableEventBus` 含完整 dispose
9. **完善的稳定性排练框架** — 18+ 排练套件 + 证据体系 + 发布门禁
10. **配置梯度** — 8 层配置类别从 dev 到 prod 渐进收紧
11. **Provider 抽象** — 模板方法基类 + 凭证池 + 智能路由 + 断路器
12. **Gateway 架构** — 六边形端口接口已落地 + 策略模式 + 完整重试/DLQ
13. **可观测性扩展** — 新增异常检测子目录、OTel 集成、传输层抽象

**仍存在的问题**:

1. **PostgreSQL 后端不可用** — async/sync 不兼容，且 wrapper 文件位置错误
2. **Runtime 根目录仍偏大** — 81 个文件 21,610 行
3. **v9 新增模块测试覆盖待验证** — agent-loop/knowledge/domain-registry/feedback/learning/improvement/planning 的测试深度未知
4. **浅层测试文件** — 仍有大量仅 1-2 个用例的测试文件

### 11.2 核心复杂度中心

| 排名 | 模块               | 文件数 | 行数     | 风险                                           |
| -- | ---------------- | --- | ------ | -------------------------------------------- |
| 1  | `runtime/`       | 113 | 30,119 | 最大最复杂，根文件仍需进一步分组                             |
| 2  | `storage/`       | 101 | 26,026 | God-class 已拆除，剩余风险集中在 PG 后端                  |
| 3  | `tools/`         | 36  | 13,500 | 面积大但组织合理                                     |
| 4  | `stability/`     | 31  | 12,789 | 面积大但结构良好                                     |
| 5  | `ops/`           | 19  | 8,304  | 运维工具集，多个 ~780 行文件                            |
| 6  | `observability/` | 36  | 8,105  | v9 扩展：异常检测/OTel/传输层                          |
| 7  | `security/`      | 19  | 7,125  | 功能完整                                         |
| 8  | `product/`       | 22  | 7,093  | 计费/市场/合规                                     |
| 9  | `knowledge/`     | 23  | 3,425  | **v9 新增** — 语义搜索/知识治理，新模块中最大                 |
| 10 | `domain-registry/` | 13 | 2,392 | **v9 新增** — Plugin SPI，单文件 829 行偏大             |

### 11.3 版本间关键变化

#### v2 → v3 (2026-04-12 → 2026-04-13)

| 项目                         | v2                | v3                                            |
| -------------------------- | ----------------- | --------------------------------------------- |
| `phase1b-orchestration.ts` | 2,172 行（复杂度中心）    | 31 行重导出（**已重构**）                              |
| `Phase1aStore`             | 8,798 行 God-class | 拆分为 17 文件 10,186 行 + 6 Repository（**40% 完成**） |
| `as unknown as`            | 104 处             | 136 处（方法文件集中 101 处）                           |
| `TypedEventBus`            | 无                 | **已实现**                                       |
| `query-helper.ts`          | 无                 | **已创建**                                       |
| `stable-runner-factory.ts` | 无                 | **已创建**，消除 22 个文件重复                           |
| 代码重复                       | 未检测               | **发现 6 对** 完全重复（2,001 行）                      |
| Provider 基类                | 无                 | **`BaseChatProvider` 已实现**                    |

#### v3 → v4 (2026-04-13 全量复核)

| 项目                              | v3            | v4                |
| ------------------------------- | ------------- | ----------------- |
| src/ 文件/行数                      | 556 / 143,981 | **568 / 146,381** |
| tests/ 文件/行数                    | 380 / 78,917  | **432 / 86,944**  |
| `as unknown as` (store methods) | 101 处 / 10 文件 | **0 处**（全部清理）     |
| `circuit-breaker.ts`            | 不存在           | **新增 289 行**      |
| `DurableEventBus.dispose()`     | 不存在           | **已实现**           |

#### v4 → v5 (2026-04-13 全量重扫)

| 项目                        | v4             | v5                                         |
| ------------------------- | -------------- | ------------------------------------------ |
| src/ 文件/行数                | 568 / 146,381  | **572 / 145,230**                          |
| tests/ 文件/行数              | 432 / 86,944   | **584 / 116,139**                          |
| 测试/源码比                    | 0.59:1         | **0.80:1**                                 |
| `sqlite/repositories/`    | 3 文件 577 行     | **22 文件 5,874 行**                          |
| AuthoritativeTaskStore    | 17 文件 10,064 行 | **7 文件 9,695 行**（methods-01~13 已删除）       |
| 重复代码                      | 6 对 2,001 行    | **0 对**（全部清理）                              |
| 架构阻塞项                     | 5 项            | **3 项**                                    |

#### v5 → v8 (2026-04-13 → 2026-04-15 全量重扫)

| 项目                            | v5              | v8                                          |
| ----------------------------- | --------------- | ------------------------------------------- |
| src/ 文件/行数                    | 572 / 145,230   | **654 / 159,747**                           |
| tests/ 文件/行数                  | 584 / 116,139   | **886 / 182,461**                           |
| 测试/源码比                        | 0.80:1          | **1.14:1**                                  |
| 测试用例                          | 2,919           | **8,387** (+187%)                           |
| 通过率                           | 96.95%          | **99.99%**                                  |
| 运行时依赖                         | 2 个             | **4 个** (新增 ioredis, ws)                    |
| `legacy-compat`               | 8,469 行         | **308 行** (-96%)                            |
| delegating core               | 单文件 756 行       | **5 领域模块 1,374 行**                         |
| `sqlite/repositories/`        | 22 文件 5,874 行   | **22 文件 8,497 行** (+45%)                   |
| `runtime/` 文件/行数              | 76 / 23,032     | **110 / 29,553**                            |
| `runtime/` 子目录                | 7 个             | **9 个** (新增 recovery/, worker/)             |
| `ha-coordinator-service.ts`   | 680 行           | 2 行 barrel → `ha-coordinator/` 5 文件 1,458 行 |
| `authoritative-task-store-*` | `storage/` 根 7 文件 | 全部移入 `sqlite/` 子目录                        |
| 架构阻塞项                         | 3 项             | **2 项** (Store God-class 已解决)               |

#### v8 → v9 (2026-04-15 → 2026-04-17 全量重扫)

| 项目                            | v8              | v9                                          |
| ----------------------------- | --------------- | ------------------------------------------- |
| src/ 文件/行数                    | 654 / 159,747   | **797 / 174,585** (+143 文件, +14,838 行)      |
| tests/ 文件/行数                  | 886 / 182,461   | **985 / 205,811** (+99 文件, +23,350 行)       |
| 测试/源码比                        | 1.14:1          | **1.18:1**                                  |
| `src/core/` 子目录               | 35              | **42** (+7 新模块)                              |
| `src/core/` 文件/行数             | 564 / 150,462   | **698 / 164,428** (+134 文件, +13,966 行)      |
| **新增** `agent-loop/`          | 不存在             | **22 文件, 1,721 行** — OAPEFLIR 循环编排           |
| **新增** `knowledge/`           | 不存在             | **23 文件, 3,425 行** — 知识平面                    |
| **新增** `domain-registry/`     | 不存在             | **13 文件, 2,392 行** — Plugin SPI              |
| **新增** `feedback/`            | 不存在             | **5 文件, 532 行** — 信号预处理                      |
| **新增** `improvement/`         | 不存在             | **10 文件, 706 行** — 渐进发布/自动回滚                 |
| **新增** `learning/`            | 不存在             | **12 文件, 437 行** — 失败模式学习                    |
| **新增** `planning/`            | 不存在             | **9 文件, 314 行** — DAG 任务规划                   |
| **新增** `src/plugins/`         | 不存在             | **7 文件, 440 行** — 内置插件实现                     |
| `artifacts/` 扩展               | 2 文件, 370 行     | **13 文件, 1,092 行** (6.5×)                   |
| `observability/` 扩展           | 26 文件, 7,013 行  | **36 文件, 8,105 行** (+异常检测/OTel/传输层)        |
| `evaluation/` 扩展              | 3 文件, 1,335 行   | **6 文件, 1,429 行** (+Prompt-Model 治理)        |
| `memory/` 扩展                  | 11 文件, 3,058 行  | **15 文件, 3,286 行** (+plane/promotion/retrieval) |

### 11.4 推荐执行顺序

```
Phase 1 (1-2 周): PostgreSQL async/sync 修复 → 统一 CLI bootstrap
Phase 2 (3-4 周): HTTP API 路由表抽象 → runtime/ 根文件继续分组
Phase 3 (5-8 周): v9 新增模块测试覆盖 → 浅层测试加深 → HA/热升级验证
Phase 4 (9-12 周): SLI/SLO 集成验证 → 云 Secret Provider 验证 → plugin-spi-registry 拆分
```

---

## 附录

### 附录 A: 源码文件 Top 20 (按行数)

| #  | 文件                                       | 行数    | 模块            |
| -- | ---------------------------------------- | ----- | ------------- |
| 1  | `worker-repository.ts`                   | 1,057 | storage       |
| 2  | `operations-repository.ts`               | 868   | storage       |
| 3  | `billing-repository.ts`                  | 793   | storage       |
| 4  | `execution-lease-service.ts`             | 796   | runtime       |
| 5  | `anomaly-detection-service.ts`           | 796   | observability |
| 6  | `billing-service.ts`                     | 792   | product       |
| 7  | `patch-dsl-service.ts`                   | 791   | tools         |
| 8  | `execution-worker-handshake-service.ts`  | 789   | runtime       |
| 9  | `marketplace-governance-service.ts`      | 788   | product       |
| 10 | `channel-gateway-delivery-service.ts`    | 787   | gateway       |
| 11 | `diagnostics-support.ts`                 | 787   | observability |
| 12 | `enterprise-governance-service.ts`       | 785   | ops           |
| 13 | `doctor-service.ts`                      | 782   | ops           |
| 14 | `call-governance.ts`                     | 747   | runtime       |
| 15 | `transition-service.ts`                  | 734   | runtime       |
| 16 | `execution-worker-writeback-service.ts`  | 734   | runtime       |
| 17 | `execution-dispatch-service.ts`          | 733   | runtime       |
| 18 | `data-classification-service.ts`         | 730   | security      |
| 19 | `semantic-repo-map-service.ts`           | 722   | tools         |
| 20 | `edit-replacement-service.ts`            | 709   | tools         |

### 附录 B: 模块依赖矩阵

```
                   storage/ (101 files, 26,026 lines)
                   ├── sqlite/repositories/ (22 files, 8,497 lines)
                   ├── sqlite/ (25 other files, ~5,400 lines)
                   ├── postgres/ (11 files, 1,966 lines)
                   └── root (~10 files, ~1,700 lines)
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
        runtime/ (113)     memory/ (15)       gateway/ (13)
            │                   │                   │
    ┌───────┴───────┐     ┌─────┴─────┐      ┌─────┴─────┐
    │               │     │           │      │           │
 tools/ (36)   events/ (8) services   store  delivery   stream
    │               │                         │
providers/ (10) typed-bus                retry-executor
    │
 security/ (19)
    │
 ── v9 新增模块 ──
    │
 agent-loop/ (22) ─── OAPEFLIR 循环编排
    ├── planning/ (9)
    ├── feedback/ (5)
    ├── learning/ (12)
    └── improvement/ (10)
    │
 knowledge/ (23) ─── 知识平面/语义检索
    │
 domain-registry/ (13) ←── plugins/ (7, 内置实现)
```

### 附录 C: `as unknown as` 分布（v9 更新）

| 文件                            | 出现次数                |
| ----------------------------- | ------------------- |
| `tool-argument-coercion.ts`   | 6                   |
| `query-helper.ts`             | 6（集中 cast 点，设计意图保留） |
| 其他 ~22 文件                    | 各 1-3               |
| **全部合计**                     | **~50**             |

### 附录 D: 测试覆盖分类表

覆盖类型定义：

* **Direct（直接）**: 模块有专项测试文件，包含针对该模块的断言
* **Indirect（间接）**: 模块通过上层集成路径被执行，但无专项断言
* **None（无有效覆盖）**: 基本未被测试

| 模块                | 覆盖类型         | 单元测试文件 | 集成测试文件 | 说明                                              |
| ----------------- | ------------ | ------ | ------ | ----------------------------------------------- |
| `runtime/`        | **Direct**   | 37     | 51     | 核心模块，覆盖最充分                                      |
| `security/`       | **Direct**   | 16     | 54     | sandbox/policy/secret/network 全路径               |
| `api/`            | **Direct**   | 6      | 2      | http-api-server + oidc-oauth                    |
| `providers/`      | **Direct**   | 5      | —      | anthropic/openai/model-routing 有专项测试            |
| `gateway/`        | **Direct**   | 5      | —      | channel-gateway/delivery/stream-bridge          |
| `tools/`          | **Direct**   | 22     | —      | command-executor/edit-replacement/skill 等        |
| `observability/`  | **Direct**   | 14     | 5      | health/inspect/slo-alerting                     |
| `product/`        | **Direct**   | 11     | 3      | billing/payment-gateway                         |
| `ops/`            | **Direct**   | 11     | 3      | doctor/deployment-execution                     |
| `memory/`         | **Direct**   | 3+     | —      | 主路径有测试                                          |
| `config/`         | **Direct**   | 4+     | —      | 配置校验有测试                                         |
| `events/`         | **Direct**   | 2      | 1      | durable-event-bus/typed-event-bus               |
| `storage/sqlite/` | **Direct**   | —      | —      | Repository 层通过 facade/contract/rehearsal 覆盖     |
| `cache/`          | **Direct**   | 21     | —      | 21+ 个测试文件                                       |
| `locking/`        | **Direct**   | 2      | —      | unit 1 + integration 1                          |
| `queue/`          | **Direct**   | 7      | —      | unit 2 + integration 5                          |
| `lifecycle/`      | **Direct**   | 6      | —      | service-registry + lifecycle-integration        |
| `utils/`          | **None**     | 0      | 0      | `bounded-cache.ts` 109 行，零测试                    |
| `agent-loop/`     | **Unverified** | —    | —      | **v9 新增** OAPEFLIR 循环，测试覆盖待确认                   |
| `knowledge/`      | **Unverified** | —    | —      | **v9 新增** 知识平面，测试覆盖待确认                          |
| `domain-registry/` | **Unverified** | —   | —      | **v9 新增** Plugin SPI，测试覆盖待确认                    |
| `feedback/`       | **Unverified** | —    | —      | **v9 新增** 信号预处理，测试覆盖待确认                         |
| `learning/`       | **Unverified** | —    | —      | **v9 新增** 失败模式学习，测试覆盖待确认                        |
| `improvement/`    | **Unverified** | —    | —      | **v9 新增** 渐进改进，测试覆盖待确认                          |
| `planning/`       | **Unverified** | —    | —      | **v9 新增** DAG 规划，测试覆盖待确认                        |
| `plugins/`        | **Unverified** | —    | —      | **v9 新增** 内置插件，测试覆盖待确认                          |
| `tests/e2e/`      | **Direct**   | ~10    | —      | 端到端测试                                           |
| `tests/golden/`   | **Direct**   | 8      | —      | Golden path 回归                                  |
| `tests/performance/` | **Direct** | 7     | —      | 性能基准测试                                          |
