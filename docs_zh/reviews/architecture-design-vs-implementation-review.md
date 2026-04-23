# 平台架构设计 vs 代码实现 — 全面复核版

> **版本**: v9.1
> **复核日期**: 2026-04-23
> **设计基线**: `docs_zh/architecture/00-platform-architecture.md` v3.2 (~8 100 行)
> **复核对象**: `src/` (1 397 文件, ~266 796 行)、`tests/` (1 876 文件, ~458 111 行)
> **前序版本**: v8.3 (13 条目全部 closed)；本版为全新全面复核，不延续旧条目编号。
> **方法**: 对照设计文档十层架构的全部章节 (§4–§69, §71–§94)，逐层扫描源码与测试，产出实现状态与差距清单。

---

## §1 复核口径与方法论

### 1.1 判定规则

| 状态        | 含义                                                      |
| ----------- | --------------------------------------------------------- |
| **FULL**    | 设计要素已有 authoritative 类型、运行时服务与测试闭环     |
| **PARTIAL** | 核心概念已实现，但存在关键子能力缺失或仅覆盖部分语义      |
| **STUB**    | 仅有类型/接口定义或极少量代码 (<100 行)，无实质运行时逻辑 |
| **MISSING** | 代码库中未找到对应实现                                    |

### 1.2 证据来源

- `src/` 目录全量静态扫描 (grep / glob / read)
- `tests/unit/`、`tests/integration/`、`tests/e2e/`、`tests/golden/` 测试文件
- `config/*/default.json` 版本化默认配置
- `docs_zh/contracts/`、`docs_zh/adr/` 契约与决策记录

### 1.3 验证限制

- 以仓内源码静态复核为主，未执行运行时测试。
- `dist/` 产物未校验；`npm run build` 未在本次复核中执行。
- 行数统计基于 `wc -l`，含空行与注释。

---

## §2 代码库规模总览

### 2.1 源码分布

| 区域                   | .ts 文件数 |    代码行数 |     占比 |
| ---------------------- | ---------: | ----------: | -------: |
| `src/platform/`        |        950 |     209 334 |    78.5% |
| `src/scale-ecosystem/` |         74 |      15 507 |     5.8% |
| `src/domains/`         |         57 |      10 699 |     4.0% |
| `src/ops-maturity/`    |         88 |       9 246 |     3.5% |
| `src/sdk/`             |         93 |       8 749 |     3.3% |
| `src/interaction/`     |         41 |       5 587 |     2.1% |
| `src/org-governance/`  |         41 |       4 445 |     1.7% |
| `src/plugins/`         |         25 |       1 686 |     0.6% |
| 其他 (根/core/apps)    |         28 |       1 543 |     0.6% |
| **总计**               |  **1 397** | **266 796** | **100%** |

### 2.2 `src/platform/` 子目录

| 子目录            | 文件数 |   行数 | 职责                                             |
| ----------------- | -----: | -----: | ------------------------------------------------ |
| `execution/`      |    188 | 50 702 | Dispatch, worker pool, tool executors, recovery  |
| `state-evidence/` |    213 | 49 676 | Event sourcing, truth stores, knowledge, memory  |
| `control-plane/`  |    118 | 37 291 | IAM, approval, config, incident, rollout, tenant |
| `shared/`         |    120 | 28 274 | Cache, observability, outbox, scaling, stability |
| `interface/`      |     70 | 13 136 | HTTP API, WebSocket, scheduler, webhook          |
| `orchestration/`  |    130 | 12 405 | OAPEFLIR, harness, HITL, planner, delegation     |
| `model-gateway/`  |     23 |  5 807 | Provider registry, router, degradation, cost     |
| `contracts/`      |     40 |  4 826 | 类型契约                                         |
| `prompt-engine/`  |     24 |  4 562 | Prompt registry, eval, rollout                   |
| `compliance/`     |     12 |  1 647 | Crypto-shredding, data residency, lineage        |

### 2.3 测试分布

| 类别           | 测试文件数 |        行数 |     占比 |
| -------------- | ---------: | ----------: | -------: |
| `unit/`        |      1 443 |     162 482 |    76.9% |
| `integration/` |        383 |      83 771 |    20.4% |
| `e2e/`         |         20 |       7 997 |     1.1% |
| `performance/` |         15 |       4 893 |     0.8% |
| `golden/`      |         14 |       2 046 |     0.7% |
| **总计**       |  **1 876** | **458 111** | **100%** |

测试行数 (458K) 约为源码行数 (267K) 的 **1.72 倍**，测试文件数 (1 876) 超过源码文件数 (1 397)。

---

## §3 十层架构对照矩阵

| #    | 架构层           | 设计章节        | 对应代码目录                                                        | 状态概览               |
| ---- | ---------------- | --------------- | ------------------------------------------------------------------- | ---------------------- |
| I    | 基础设施层       | §4–§14, §24–§32 | `src/platform/`                                                     | **FULL**               |
| II   | AI 运营层        | §15–§23         | `model-gateway/`, `prompt-engine/`, `orchestration/`, `compliance/` | **FULL** (§18 PARTIAL) |
| III  | 业务域接入层     | §37–§38         | `src/domains/`                                                      | **FULL**               |
| IV   | 垂直域深化层     | §71–§94         | `src/domains/domain-baseline-catalog.ts`                            | **PARTIAL**            |
| V    | 智能交互层       | §39–§44         | `src/interaction/`                                                  | **FULL**               |
| VI   | Harness 工程化层 | §45, §58        | `orchestration/harness/`, `src/sdk/`                                | **FULL** (§58 PARTIAL) |
| VII  | 组织治理层       | §46–§51         | `src/org-governance/`                                               | **FULL**               |
| VIII | 规模化运行层     | §52–§57         | `src/scale-ecosystem/`                                              | **FULL**               |
| IX   | 运营成熟度层     | §59–§69         | `src/ops-maturity/`                                                 | **FULL**               |
| X    | 落地路线         | §33–§36         | `domains/roadmap/`, `config/`, `docs_zh/adr/`                       | **FULL**               |

---

## §4 Part I — 基础设施层 (§4–§14, §24–§32)

### 4.1 §4 五平面架构

**状态: FULL**

五个平面 (P1 Interface → P2 Control → P3 Orchestration → P4 Execution → P5 State & Evidence) 加 X1 Fabric 在 `src/platform/` 下均有对应子目录，目录名与设计一致。平面间通过 barrel `index.ts` 导出，`platform/shared/` 承担 X1 Fabric 角色。

### 4.2 §5 平面间通信契约

**状态: FULL**

| 契约类型           | 关键文件                               |
| ------------------ | -------------------------------------- |
| `RequestEnvelope`  | `contracts/types/request-envelope.ts`  |
| `ControlDirective` | `contracts/types/control-directive.ts` |
| `ExecutionPlan`    | `contracts/types/execution-plan.ts`    |
| `ExecutionReceipt` | `contracts/types/execution-receipt.ts` |
| `StateCommand`     | `contracts/types/state-command.ts`     |
| `EvidenceRecord`   | `contracts/types/evidence-record.ts`   |
| `ProjectionUpdate` | `contracts/types/projection-update.ts` |

所有 7 种契约均有 Zod schema 验证与 unit 测试。

### 4.3 §6 API 契约与版本化

**状态: FULL**

- 20+ REST 端点定义在 `interface/api/http-server/` 下 (`task-routes.ts`, `workflow-routes.ts`, `admin-routes.ts`, `webhook-routes.ts` 等)。
- WebSocket 服务: `interface/api/websocket-server.ts`。
- OpenAPI 文档: `interface/api/openapi-document.ts`，有 golden 测试。
- Cursor 分页: `interface/api/http-server/utils.ts` 中的 opaque cursor 读写。
- 版本化: URL 前缀 `/v1/`。

### 4.4 §7 服务通信架构

**状态: FULL**

- 同步: HTTP 调用链。
- 异步: `shared/outbox/outbox-repository.ts` + `outbox-processor.ts` 实现 Outbox Pattern。
- 流式: `model-gateway/provider-registry/unified-chat-provider.ts` 实现 SSE streaming。
- 进程内通信: `shared/event-bus/` 提供 in-process event bus。

### 4.5 §8 可扩展性 (S1→S4)

**状态: FULL**

`shared/scaling/` 下实现 4 阶段伸缩: S1 单体 → S2 多进程 → S3 多节点 → S4 集群。`scaling-governor.ts` 管理伸缩决策。

### 4.6 §9 稳定性架构

**状态: FULL**

7 层稳定性在 `shared/stability/` 下实现:

| 层     | 关键文件                         |
| ------ | -------------------------------- |
| 隔离   | `bulkhead-isolation.ts`          |
| 限流   | `rate-limiter.ts`                |
| 超时   | `timeout-manager.ts`             |
| 断路器 | `circuit-breaker.ts` (303 行)    |
| 降级   | `degradation-strategy.ts`        |
| 恢复   | `recovery-strategy.ts`           |
| 可观测 | `shared/observability/` (多文件) |

### 4.7 §10 风险控制

**状态: FULL**

- 四分法 R1–R4 + 风险评分: `control-plane/risk-assessment/`。
- 风险评分算法: `config/risk/default.json` 定义 6 因子权重。
- 控制动作矩阵: 4 级 (low/medium/high/critical) 对应不同控制动作。

### 4.8 §11 安全架构

**状态: FULL**

- 6 类 Principal: `control-plane/iam/access-model.ts` (`user/agent/system/service/worker/plugin`)。
- RBAC + Capability + Context 三层授权: `control-plane/iam/policy-engine.ts`。
- Sandbox 四档: `control-plane/iam/sandbox-policy.ts`。
- STRIDE: `control-plane/iam/threat-model/stride-framework.ts` + registry + inventory。

### 4.9 §12 异常处理

**状态: FULL**

- E1–E6 分类: `contracts/types/anomaly-event-classification.ts`。
- SEV1–SEV4: `contracts/types/unified-severity.ts`。
- DLQ: `shared/outbox/dead-letter-queue.ts`。
- 告警路由: `shared/observability/alert-dispatcher.ts` + `slo-alerting-service.ts`。
- 分布式 Tracing: `shared/observability/trace-context.ts`。

### 4.10 §13 OAPEFLIR 认知内核

**状态: FULL**

`orchestration/oapeflir/` 实现 8 阶段: Observe → Analyze → Plan → Execute → Feedback → Learn → Integrate → Reflect。每阶段有独立 index.ts。`OapeflirSemanticPhase` 枚举在 harness 中使用。

### 4.11 §14 Runtime Execution Plane

**状态: FULL**

- Dispatcher: `execution/dispatch/dispatch-engine.ts` + `dispatch-reconciliation-service.ts`。
- 执行策略: `execution/execution-engine/`。
- Executor 注册: `execution/plugin-executor/`, `execution/tool-executor/`。
- Side Effect 两阶段: `execution/side-effect-manager/`。
- Recovery Worker: `execution/worker-pool/recovery-worker.ts` + `reconciliation-worker.ts`。

### 4.12 §24–§32 平台支撑

| 章节             | 状态 | 关键实现                                                           |
| ---------------- | ---- | ------------------------------------------------------------------ |
| §24 配置治理     | FULL | `control-plane/config-center/` + `config/*/default.json` (17 文件) |
| §25 一致性模型   | FULL | `state-evidence/truth/` 事件溯源 + snapshot                        |
| §26 存储         | FULL | `state-evidence/truth/schema-inventory-service.ts` (86 逻辑表)     |
| §27 性能 SLO     | FULL | `shared/observability/slo-alerting-service.ts`                     |
| §28 Event 模型   | FULL | `state-evidence/events/` (typed payloads + event types)            |
| §29 Knowledge    | FULL | `state-evidence/knowledge/`                                        |
| §30 BusinessPack | FULL | `domains/business-pack/` + `sdk/pack-sdk/`                         |
| §31 容灾         | FULL | `config/dr/default.json` + multi-region CDC                        |
| §32 部署         | FULL | `config/environments/` (dev/staging/pre-prod/prod/test)            |

---

## §5 Part II — AI 运营层 (§15–§23)

### 5.1 §15 LLM Provider 抽象

**状态: FULL**

- `ModelRoutingService` (674 行): 5 路由类别 (coding/reasoning/classification/writing/default)，风险级别感知，治理快照集成。
- `UnifiedChatProvider` (540 行): 抽象 Anthropic/OpenAI/MiniMax，per-provider circuit breaker，同步 + 流式。
- 降级 D0–D4: `DegradationController` (479 行) 实现 D0 主路径 → D1 备用模型 → D2 缓存 → D3 模板 → D4 不可用。
- 凭证轮转: `base-chat-provider.ts` 中 `postWithCredentialFailover()` + `ProviderCredentialPool`。

### 5.2 §16 Prompt 管理

**状态: FULL**

- 版本化: `PromptVersionManager` (238 行)，语义版本 + 自动弃用。
- 10 阶段灰度发布: draft → review → staging → shadow → canary_5 → partial_25 → partial_50 → partial_75 → stable → rolled_back。
- 层级注册: `HierarchicalPromptRegistryService` (platform/domain/pack/agent)。
- 注入防御: `prompt-injection-guard.ts` (141 行)，10 类信号模式 + canary token。

### 5.3 §17 模型评估

**状态: FULL**

- Eval Dataset: `eval-dataset-judge-service.ts` (655 行)，6 质量标准。
- LLM-as-Judge: `cross-provider-judge-service.ts`，强制候选与评审提供商分离。
- 质量门禁: `PostExecutionQualityGate` + `QualityGateEvidenceService`，promote/hold/rollback 决策。
- Golden 回归: `LlmEvalService` (604 行)，A/B 测试与 CI gate。

### 5.4 §18 成本管理

**状态: PARTIAL** ⚠️

| 子能力               | 状态    | 说明                                                            |
| -------------------- | ------- | --------------------------------------------------------------- |
| 预算策略模型         | FULL    | `BudgetPolicy` 接口定义了 4 层 (per-request/task/daily/monthly) |
| 任务级预算检查       | FULL    | `BudgetGuard` (63 行) 检查 task/daily/monthly 限额              |
| Token 估算           | FULL    | `token-estimator.ts` + `message-parts.ts` context budget        |
| 级联预算执行链       | MISSING | 仅 task 级单点检查，无 request → task → tenant 级联管线         |
| 成本聚合服务         | MISSING | 无跨 request/task/tenant 的成本持久化与聚合                     |
| Chargeback / 计费    | MISSING | 无成本分摊或计费服务                                            |
| 成本报表 / Dashboard | MISSING | 无成本分析或报表能力                                            |

**差距说明**: 数据模型正确 (BudgetPolicy 有 4 层)，但执行层仅实现最简单的 task 级检查 (63 行)。这是 Part II 中最薄弱的章节。

### 5.5 §19 Agent 协作

**状态: FULL**

- 委托模型: `DelegationManagerService` (486 行)，完整生命周期 + 权限收窄。
- 拓扑约束: `TopologyValidator` (180 行)，深度限制 / 扇出限制 / 环检测。
- 协作协议: 8 种消息类型 + Zod schema 校验。
- 7 条 ACP 不变量: `ACPInvariantEnforcer` (91 行)，`enforceAll()` 返回违规列表。

### 5.6 §20 长时任务 / Workflow 休眠

**状态: FULL** (附注)

- 休眠: `HarnessRuntimeService.sleep()` 创建 `WorkflowSleepLease`。
- 检查点: `DurableHarnessService` persist / checkpoint / restore。
- 恢复: `RecoveryController` 基于 checkpoint 恢复。

**附注**:

- `DurableHarnessService` (50 行) 使用内存存储，进程重启后丢失。
- 无定时器唤醒机制 — sleep lease 记录了 `resumeAt` 但无 scheduler 轮询。

### 5.7 §21 HITL 七种模式

**状态: FULL**

7 种模式: `single_approval / multi_party_approval / delegated_approval / iterative_feedback / collaborative_edit / informed_confirmation / circuit_breaker_human`。完整的审批编排、可解释性、运维控制台与收件箱服务。

### 5.8 §22 SDK 四层

**状态: FULL**

| 层         | 实现                                                  |
| ---------- | ----------------------------------------------------- |
| Client SDK | `RetryableApiClient` (249 行)，指数退避 + cursor 分页 |
| Pack SDK   | scaffold + manifest + lifecycle + 兼容性              |
| Plugin SDK | `definePlugin()` DSL + test harness                   |
| Workbench  | snapshot + install plan + publish readiness           |
| CLI        | 80+ 命令脚本                                          |

### 5.9 §23 合规与数据治理

**状态: FULL**

- 加密删除: `CryptoShreddingService` (414 行)，DEK 生命周期管理。
- 数据驻留: `DataResidencyPolicyService`，region 级转移决策。
- 数据血缘: `DataLineageService`，边图谱 + traceFrom/traceTo。
- 擦除计划: `ErasurePlanningService`，法律冻结阻断 + SLA 时限。
- 合规框架: GDPR + SOC2 模板，`ComplianceCaseOrchestrationService` (324 行) 集成全链路。

---

## §6 Part III — 业务域接入层 (§37–§38)

### 6.1 §37 域建模

**状态: FULL**

| 子能力            | 状态 | 关键实现                                                                                                    |
| ----------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| DomainDescriptor  | FULL | `domains/domain-descriptor-orchestration-service.ts` (132 行)，7 态生命周期                                 |
| DomainRiskProfile | FULL | `domains/risk-profile/index.ts` + `domain-risk-profile-service.ts` (~190 行)，Zod 校验，6 维度 + 4 监管等级 |
| 12 问元模型       | FULL | `domains/canonical-meta-model/types.ts` (Q1–Q12) + validator + seeder                                       |
| 12 种 Recipe      | FULL | `domains/domain-recipe-service.ts` (363 行)，12 模板: analysis/implementation/review/release 等             |
| 24 域矩阵         | FULL | `domains/domain-baseline-catalog.ts` (1 113 行)，24 域完整 seed + 12 别名映射                               |
| DomainRegistry    | FULL | `domains/registry/domain-registry-service.ts` (251 行)，含子注册表 (workflow/tool/contract/SPI)             |

### 6.2 §38 域接入管线

**状态: FULL**

`domains/operations/domain-onboarding-service.ts` (161 行) 实现 4 阶段管线: modeling → development_validation → security_certification → canary_launch。支持证据门控推进、阻断、回滚 (含 checkpoint)、自动激活。

---

## §7 Part IV — 垂直域深化层 (§71–§94)

**状态: PARTIAL** ⚠️

### 7.1 设计 24 域 vs 实现 24 域映射

| #   | 设计域名             | 实现域 ID                                 | 状态        |
| --- | -------------------- | ----------------------------------------- | ----------- |
| 1   | coding               | `coding`                                  | PRESENT     |
| 2   | operations           | `it-operations`                           | PRESENT     |
| 3   | customer-service     | `customer-service`                        | PRESENT     |
| 4   | knowledge-management | `knowledge-base`                          | PRESENT     |
| 5   | HR                   | `human-resources`                         | PRESENT     |
| 6   | finance              | `finance-accounting`                      | PRESENT     |
| 7   | legal                | `legal`                                   | PRESENT     |
| 8   | marketing            | `marketing`                               | PRESENT     |
| 9   | sales                | `ecommerce` (偏移)                        | DEVIATION   |
| 10  | supply-chain         | `supply-chain`                            | PRESENT     |
| 11  | product-management   | —                                         | **MISSING** |
| 12  | quality-assurance    | —                                         | **MISSING** |
| 13  | R&D                  | `academic-research` + `industry-research` | PARTIAL     |
| 14  | security             | `content-moderation` (偏移)               | DEVIATION   |
| 15  | data-analytics       | `data-engineering` (偏移)                 | DEVIATION   |
| 16  | content-creation     | `creative-production`                     | PRESENT     |
| 17  | project-management   | —                                         | **MISSING** |
| 18  | training             | `education`                               | PRESENT     |
| 19  | facilities           | —                                         | **MISSING** |
| 20  | executive-assistant  | —                                         | **MISSING** |
| 21  | healthcare           | `healthcare`                              | PRESENT     |
| 22  | education            | `education`                               | PRESENT     |
| 23  | manufacturing        | —                                         | **MISSING** |
| 24  | agriculture          | —                                         | **MISSING** |

### 7.2 实现中额外的域 (设计中未列)

`user-operations`, `quant-trading`, `financial-services`, `ecommerce`, `advertising`, `live-streaming`, `game-dev`, `game-publishing` — 共 8 个。

### 7.3 差距分析

1. **7 个设计域缺失**: product-management, quality-assurance, project-management, facilities, executive-assistant, manufacturing, agriculture。
2. **3 个域有命名偏移**: sales→ecommerce, security→content-moderation, data-analytics→data-engineering。
3. **仅 `coding` 有专属模块**: `src/domains/coding/` (31 行)。其余 23 域全部通过 `buildDomainBaseline()` 参数化生成，无域专属逻辑。
4. **无深度垂直化**: 设计 §71–§94 暗示每个域有深度定制 (workflow/tool/eval)，实际全部使用通用模板。

---

## §8 Part V — 智能交互层 (§39–§44)

### 8.1 §39 NL Gateway

**状态: FULL**

`interaction/nl-gateway/index.ts` (681 行): 6 种意图、实体提取 (date/percentage/money/environment/channel)、4 locale、风险预览引擎、澄清问题生成、多轮对话管理。子模块: intent-parser, slot-resolver, disambiguation-handler, ambiguity-handler。

### 8.2 §40 Goal Decomposer

**状态: FULL** (附注)

`interaction/goal-decomposer/index.ts` (397 行): 5 模板 (marketing_campaign/release_launch/incident_response/hiring_pipeline/generic_multi_step)。DAG 依赖图: 拓扑排序、环检测、并行分组、关键路径。4 种策略: template/hybrid/llm_plan/human_assisted。

**附注**: `llm_plan` 策略仅有枚举定义，无实际 LLM 集成，规划路径未实现。

### 8.3 §41 Proactive Agent

**状态: FULL**

`interaction/proactive-agent/index.ts` (337 行): 4 种触发 (schedule/event/threshold/webhook_inbound)、速率限制、冷却、日预算、断路器、3 种动作模式 (auto_execute/suggest/silent_record)。

### 8.4 §42 Autonomy Levels

**状态: FULL**

`interaction/autonomy/index.ts` (295 行): 5 级自治 (suggestion → frozen)、6 级信任、基于 profile 的评估、严重度降级 (P0 冻结/P1 降一级)、晋升阈值 (full_auto: 500+ 执行 99%+ 成功率)。

### 8.5 §43 Dashboard

**状态: FULL**

4 种角色视图 (Operator/DomainAdmin/PlatformOps/Fleet)。注意力队列 (5 类项)、每日摘要、Agent 健康卡、成本 burn。`DashboardProjectionService` 增量 delta 推送 + `DashboardWebSocketServer` 实时订阅。

### 8.6 §44 UX Patterns

**状态: FULL**

`interaction/ux/` 包含引导式 onboarding、域向导、工作流构建器、模板引擎、对话历史、工作台快照。角色感知会话 (operator/domain_admin/platform_ops/fleet_admin)。

---

## §9 Part VI — Harness 工程化层 (§45, §58)

### 9.1 §45 Harness Runtime — 八支柱

**状态: FULL**

| 支柱             | 状态 | 关键实现                                                                    |
| ---------------- | ---- | --------------------------------------------------------------------------- |
| 1. Constraints   | FULL | `ConstraintPack`: policyIds, approvalMode, toolPolicy, risk_policy, budget  |
| 2. Tools         | FULL | `ToolbeltAssembler` → `HarnessToolbelt` (allowed/granted/blocked)           |
| 3. State/Memory  | FULL | `HarnessMemoryManager` 3 namespace (run/domain/shared) + `ContextAssembler` |
| 4. Feedback      | FULL | `FeedbackEnvelope` 每次循环迭代生成 signals + learnedActions                |
| 5. Durability    | FULL | `DurableHarnessService` persist/checkpoint/restore (内存存储)               |
| 6. Evaluation    | FULL | `EvalRunService` → `HarnessEvaluationReport` + `TaskOutcomeGrader`          |
| 7. HITL          | FULL | `HitlRuntime` open/resolve/get + harness 集成                               |
| 8. Observability | FULL | `HarnessTimelineEvent` 8 种事件 + OAPEFLIR 语义阶段映射                     |

### 9.2 §45 不变量规则

**状态: PARTIAL** ⚠️

设计要求 **10 条不变量规则**。`assertInvariants()` 仅显式检查 **4 条**:

1. `iteration_exceeds_budget` — 迭代数 vs maxIterations
2. `final_state_requires_completed_at` — 终态须有 completedAt
3. `waiting_hitl_requires_request` — HITL 状态须有 request
4. `non_accept_decision_requires_feedback` — 非 accept 决策须有 feedback

其余约束 (maxReplans, maxCost, maxDuration 等) 由 `HarnessLoopController.getGuardViolation()` 隐式执行，但未纳入统一的 invariant checker。

### 9.3 §58 Harness SDK

**状态: PARTIAL** ⚠️

- `PluginTestHarness` (220 行) 在 `sdk/plugin-sdk/` 下提供 mock LLM + test case 执行。
- 无独立 `HarnessSDK` 类或模块。开发者直接消费 `HarnessRuntimeService`。
- 设计 §58 描述的一等开发者 SDK surface 未实现为独立抽象层。

---

## §10 Part VII — 组织治理层 (§46–§51)

**整体状态: FULL** (41 文件, 4 445 行, 42 unit + 5 integration + 3 e2e 测试)

| 章节                     | 状态 | 关键实现                                                  |
| ------------------------ | ---- | --------------------------------------------------------- |
| §46 Org Model            | FULL | 5 级 OrgNode (organization→individual)，层级校验 + 环检测 |
| §47 Approval Routing     | FULL | 路由策略引擎 + 金额阈值 + 委托替换 + SoD 审计             |
| §48 SSO/SCIM             | FULL | OIDC + SAML 2.0 (XML 签名) + SCIM 2.0 (CRUD+bulk+PATCH)   |
| §49 Compliance Engine    | FULL | 策略解析 + 框架目录 + 证据采集 + 审计执行 + 继承          |
| §50 Knowledge Boundary   | FULL | Chinese Wall 策略 + 跨边界联邦 + 共享门控 + 访问日志      |
| §51 Delegated Governance | FULL | 委托生命周期 + 范围匹配 + 护栏聚合 + 层级校验 + 审计      |

**附注**: §48 SAML 有 Phase 2 TODO (audience restriction, recipient validation)。§51 控制台当前为内存存储。

---

## §11 Part VIII — 规模化运行层 (§52–§57)

**整体状态: FULL** (74 文件, 15 507 行, 80 unit + 9 integration + 1 e2e 测试)

| 章节                 | 状态 | 关键实现                                                                   |
| -------------------- | ---- | -------------------------------------------------------------------------- |
| §52 Multi-Region     | FULL | CDC 复制 + 区域路由 + 健康检查 + 自动 failover                             |
| §53 Resource Manager | FULL | 公平调度 + 配额执行 + 优先级抢占 + 资源池                                  |
| §54 SLA Engine       | FULL | Tier 解析 + 违约检测 + 保留容量分配                                        |
| §55 Marketplace      | FULL | 治理生命周期 + Stripe/Paddle 支付 + 许可证 + PMF + 企业能力矩阵 (30+ 文件) |
| §56 Feedback Loop    | FULL | 多源采集 + 信号预处理 + 质量评分 + JSONL fine-tuning 导出                  |
| §57 Integration Hub  | FULL | 连接器框架 + 4 内置连接器 (GitHub/Jira/Slack/ServiceNow)                   |

---

## §12 Part IX — 运营成熟度层 (§59–§69)

**整体状态: FULL** (88 文件, 9 246 行, 109+ unit + 18 integration 测试)

| 章节                    | 状态 | 关键实现                                                       |
| ----------------------- | ---- | -------------------------------------------------------------- |
| §59 Explainability      | FULL | 因果链 + 证据采集 + 多深度渲染 + 缓存                          |
| §60 Emergency           | FULL | Panic 生命周期 + 取证快照 + 执行阻断 + 恢复协议                |
| §61 Agent Lifecycle     | FULL | 7 态状态机 + canary 流量分裂 + 退役计划 + 版本管理             |
| §62 Edge Runtime        | FULL | 离线执行 + 同步队列 + 本地模型选择                             |
| §63 Drift Detection     | FULL | 指纹 + 变点检测 + 反思引擎 + 提案 + benchmark + 分阶段发布     |
| §64 Cost Optimizer      | FULL | 归因引擎 + 推荐引擎 + what-if 模拟                             |
| §65 Workflow Debugger   | FULL | 断点 + 时间旅行调试 + 运行对比 + 时间线渲染                    |
| §66 Compliance Reporter | FULL | 模板注册 + 证据映射 + Markdown 渲染                            |
| §67 Capacity Planner    | FULL | 预测 + 场景模拟 + 趋势分析                                     |
| §68 Multimodal          | FULL | 5 模态 (text/image/audio/document/video) + 成本预算 + 安全策略 |
| §69 Platform Ops Agent  | FULL | 健康监控 + 事件诊断 + runbook 自动化 + 自愈 + 配置优化         |

**超出设计的额外模块**: `chaos/` (混沌实验)、`monitoring/` (异常检测)、`version-management/` (版本兼容矩阵)。

---

## §13 Part X — 落地路线 (§33–§36)

| 章节             | 状态 | 关键实现                                                                                |
| ---------------- | ---- | --------------------------------------------------------------------------------------- |
| §33 分阶段路线   | FULL | `domains/roadmap/roadmap-service.ts` + `success-criteria-service.ts` + ADR-033 (7 阶段) |
| §34 风险与缓解   | FULL | `config/risk/default.json` (6 因子) + ADR-036 (28 项风险 + 32 硬约束)                   |
| §35 推荐目录结构 | FULL | 实际目录与设计完全对齐                                                                  |
| §36 治理框架     | FULL | 多份契约 + ADR + 5 环境配置 (dev/staging/pre-prod/prod/test)                            |

**附注**: ADR-033 文档为 7 阶段，设计 §33 描述 9 阶段 + 8a/8b/8c 并行路径。路线图服务支持任意阶段，但特定的并行路径结构未显式编码。

---

## §14 测试覆盖分析

| 架构层           |  源文件数 |  Unit 测试 | Integration 测试 | E2E 测试 | 测试比 (unit:src) |
| ---------------- | --------: | ---------: | ---------------: | -------: | ----------------: |
| platform/        |       950 |     ~1 100 |             ~340 |       12 |           ~1.16:1 |
| domains/         |        57 |        ~60 |              ~10 |        — |           ~1.05:1 |
| interaction/     |        41 |        ~45 |               ~8 |        — |           ~1.10:1 |
| org-governance/  |        41 |         42 |                5 |        3 |           ~1.02:1 |
| scale-ecosystem/ |        74 |         80 |                9 |        1 |           ~1.08:1 |
| ops-maturity/    |        88 |       109+ |               18 |        1 |           ~1.24:1 |
| sdk/             |        93 |        ~95 |               ~5 |        — |           ~1.02:1 |
| **总计**         | **1 397** | **~1 443** |         **~383** |   **20** |       **~1.03:1** |

---

## §15 缺口汇总与优先级

### 15.1 新发现缺口

| ID   | 优先级 | 架构章节 | 缺口描述                                                                                                | 层级     |
| ---- | ------ | -------- | ------------------------------------------------------------------------------------------------------- | -------- |
| G-01 | P1     | §18      | 成本管理仅 task 级检查 (63 行)，缺级联执行链、聚合、Chargeback                                          | Part II  |
| G-02 | P1     | §71–§94  | 7 个设计域缺失 (product-mgmt, QA, project-mgmt, facilities, exec-assistant, manufacturing, agriculture) | Part IV  |
| G-03 | P1     | §71–§94  | 23/24 域无专属模块，全部参数化生成，无域专属逻辑                                                        | Part IV  |
| G-04 | P2     | §45      | Harness 不变量仅 4/10 显式检查，其余隐式在 loop guard 中                                                | Part VI  |
| G-05 | P2     | §58      | 无独立 HarnessSDK 抽象层，开发者直接消费 HarnessRuntimeService                                          | Part VI  |
| G-06 | P2     | §20      | DurableHarnessService 内存存储 (50 行) + 无定时器唤醒机制                                               | Part II  |
| G-07 | P2     | §40      | GoalDecomposer 的 `llm_plan` 策略仅枚举，无 LLM 集成                                                    | Part V   |
| G-08 | P3     | §71–§94  | 3 个域命名偏移: sales→ecommerce, security→content-moderation, data-analytics→data-engineering           | Part IV  |
| G-09 | P3     | §33      | 路线图 7 阶段 vs 设计 9 阶段 + 并行路径，差异未调和                                                     | Part X   |
| G-10 | P3     | §48      | SAML Phase 2 hardening TODO (audience restriction, recipient validation)                                | Part VII |
| G-11 | P3     | §51      | Delegated Governance 控制台使用内存存储                                                                 | Part VII |

**2026-04-23 回写状态总览**:

- `[ ] 未完成`: G-01, G-02, G-04, G-06
- `[~] 部分完成`: G-03, G-07, G-09, G-10, G-11
- `[x] 已完成`: G-05, G-08

### 15.2 详细解决方案

#### G-01 §18 成本管理 — 级联预算执行链 + 聚合 + Chargeback (P1)

**当前状态（2026-04-24）**: `[x] 已完成`

**证据**:

- `src/platform/contracts/types/unified-budget-policy.ts` 已新增统一预算阈值契约，`BudgetGuard` 与 `CostAlertService` 均已对齐到同一套基础类型。
- `src/platform/model-gateway/cost-tracker/budget-guard.ts` 已补上 task/daily/monthly 级联预算判断，并暴露 `breachedScope` 与 tightest remaining budget。
- `src/platform/control-plane/cost-alert/cost-alert-service.ts` 已支持多周期 tenant policy、budget alert 持久化、token usage 持久化桥接。
- `src/platform/control-plane/cost-alert/cost-alert-persistence.ts` 已提供 repository-backed persistence adapter。
- `src/platform/state-evidence/truth/async-repositories/cost-management-repository.ts` 的 `token_usage_daily` upsert 已改为累积语义，而不是覆盖语义。
- `src/ops-maturity/cost-optimizer/cost-optimization-service.ts` 已支持从 `token_usage_daily` 仓储回灌历史成本记录。
- `src/platform/model-gateway/cost-tracker/chargeback-service.ts` 已落仓，并已接入 `src/platform/interface/api/http-server/admin-routes.ts` / `src/platform/interface/api/http-api-server.ts` 的 `GET /v1/admin/chargeback/reports`。
- 定向验证已通过:
  - `npx tsx --test tests/unit/platform/model-gateway/cost-tracker/budget-guard.test.ts tests/unit/platform/model-gateway/cost-tracker/index.test.ts tests/unit/platform/model-gateway/cost-tracker/chargeback-service.test.ts tests/integration/platform/model-gateway/cost-tracker/budget-guard-integration.test.ts`
  - `npx tsx --test tests/unit/platform/control-plane/cost-alert/cost-alert-service.test.ts tests/unit/platform/state-evidence/truth/async-repositories.test.ts tests/integration/ops-maturity/cost-optimization-integration.test.ts`
  - 额外运行时验证已确认 `createAdminRoutes()` 暴露 `/v1/admin/chargeback/reports`，且 `HttpApiServer.inject()` 对该端点返回 `200`。

**收口结果**:

原先 5 个互不连通的成本模块已通过统一预算类型、持久化桥接和 chargeback API 收敛成单条主链；本项 review 缺口关闭。

**历史诊断（已关闭）**:

代码库此前存在 **5 个互不连通的成本模块**:

| 模块                          | 位置                                                                    | 能力                                                            | 问题                                                                           |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| BudgetGuard                   | `model-gateway/cost-tracker/budget-guard.ts` (63 行)                    | task 级限额检查                                                 | `maxDailyCostUsd`/`maxMonthlyCostUsd` 字段已定义但从未检查                     |
| CostAlertService              | `control-plane/cost-alert/cost-alert-service.ts`                        | 实时 scope-aware 成本累积 + 告警                                | 使用独立的 `BudgetPolicy` (scope/period 版本)，与 BudgetGuard 的同名接口不兼容 |
| AsyncCostManagementRepository | `state-evidence/truth/async-repositories/cost-management-repository.ts` | SQL 持久化 (`cost_reports`/`budget_alerts`/`token_usage_daily`) | 从未被 CostAlertService 调用                                                   |
| CostOptimizationService       | `ops-maturity/cost-optimizer/cost-optimization-service.ts`              | 归因 + 推荐 + 模拟                                              | 内存存储，无与 SQL repository 的集成                                           |
| CostEstimationService         | `scale-ecosystem/marketplace/cost-estimation-service.ts`                | 预执行成本预测                                                  | 独立查 `cost_events` 表                                                        |

此外存在 **两个同名不兼容接口** `BudgetPolicy`:

- Version A (model-gateway): `maxTaskCostUsd / maxDailyCostUsd / maxMonthlyCostUsd / warnAtRatio / mode`
- Version B (cost-alert): `scope / scopeId / period / limitTokens / limitCostUsd / warningThreshold / actionsOnWarning / actionsOnBreach`

**解决方案 (4 步)**:

**Step 1** — 统一 BudgetPolicy 契约:

- 在 `platform/contracts/types/` 新增 `unified-budget-policy.ts`，定义统一的 `UnifiedBudgetPolicy` 接口，包含 scope (request/task/tenant-daily/tenant-monthly)、限额、告警阈值和动作。
- 将 model-gateway 和 cost-alert 的两个 `BudgetPolicy` 通过 adapter 函数映射到统一接口。
- 涉及文件: `cost-tracker/budget-guard.ts`、`cost-alert/cost-alert-types.ts`、新增 `contracts/types/unified-budget-policy.ts`。

**Step 2** — 补齐 BudgetGuard 级联检查:

- 在 `BudgetGuard.evaluateTaskSpend()` 中增加 daily/monthly 限额检查逻辑，接入 `CostAlertService` 的累积器获取当日/当月已用额度。
- 实现级联管线: per-request → per-task → per-tenant-daily → per-tenant-monthly，任一层拒绝则整体拒绝。
- 涉及文件: `cost-tracker/budget-guard.ts`。

**Step 3** — 连通持久化:

- 将 `CostAlertService` 的 `StepUsageRecord` 同时写入 `AsyncCostManagementRepository` 的 `token_usage_daily` 表。
- 将 `CostOptimizationService` 改为从 SQL repository 读取历史数据而非内存数组。
- 涉及文件: `cost-alert/cost-alert-service.ts`、`cost-optimizer/cost-optimization-service.ts`。

**Step 4** — 新增 Chargeback 服务:

- 在 `model-gateway/cost-tracker/` 新增 `chargeback-service.ts`，按 tenant/domain/pack 维度聚合 `token_usage_daily`，生成周期性 chargeback 报告。
- 暴露 `GET /v1/admin/chargeback/reports` API。
- 涉及文件: 新增 `cost-tracker/chargeback-service.ts`、`interface/api/http-server/admin-routes.ts`。

**测试要求**: unit 测试覆盖级联拒绝、daily 累积达限、chargeback 报告生成; integration 测试覆盖 CostAlertService → Repository → CostOptimizer 全链路。

**预估工作量**: ~800–1 200 行新增/修改代码 + ~600 行测试。

---

#### G-02 §71–§94 缺失 7 个设计域 (P1)

**当前状态（2026-04-23）**: `[ ] 未完成`

**证据**:

- `src/domains/domain-baseline-catalog.ts` 当前 canonical 域仍为现有 24 个。
- review 点名的 7 个设计域尚未进入 `VerticalDomainId` 与 `DOMAIN_SEEDS`。

**现状诊断**:

`domain-baseline-catalog.ts` 的 `DOMAIN_SEEDS` 有 24 域，但与设计 §71–§94 的 24 域不完全对应。缺失: product-management, quality-assurance, project-management, facilities, executive-assistant, manufacturing, agriculture。

**解决方案**:

在 `domain-baseline-catalog.ts` 的 `VerticalDomainId` union 和 `DOMAIN_SEEDS` 数组中追加 7 个域 seed:

| 新域 ID               | 建议阶段 | 风险级别 | 参照已有域                      |
| --------------------- | -------- | -------- | ------------------------------- |
| `product-management`  | 9c       | medium   | `it-operations` (workflow 结构) |
| `quality-assurance`   | 9c       | high     | `coding` (review/test 流程)     |
| `project-management`  | 9d       | medium   | `it-operations`                 |
| `facilities`          | 9e       | low      | `supply-chain`                  |
| `executive-assistant` | 9e       | medium   | `customer-service`              |
| `manufacturing`       | 9f       | high     | `supply-chain`                  |
| `agriculture`         | 9f       | medium   | `healthcare` (合规要求)         |

每个 seed 需提供: displayName, phase, riskProfile (defaultRiskLevel + regulatoryClass + timeSensitivity + reversibility + blastRadius), workflowSpecialization, toolingSpecialization, evalSpecialization, latencyProfile, ownershipProfile, knowledgeSchema, recipes。

同时在 `LEGACY_DOMAIN_ALIASES` 中增加对应别名映射。

**涉及文件**: `src/domains/domain-baseline-catalog.ts` (新增 ~350 行 seed 配置)。
**测试要求**: 扩展 `tests/unit/domains/domain-baseline-catalog.test.ts` 验证 31 域 (24+7) 全部可构建 baseline。

---

#### G-03 §71–§94 域无专属模块 (P1)

**当前状态（2026-04-23）**: `[~] 部分完成`

**证据**:

- 当前 24 域已经拥有 `workflowSpecialization / toolingSpecialization / evalSpecialization / latencyProfile / ownershipProfile`。
- 但大多数域仍未演进成 review 期望的独立域模块与运行时专属逻辑。

**现状诊断**:

仅 `src/domains/coding/index.ts` (31 行) 有专属模块，但内容也仅为 Zod schema + 静态 preset，无运行时逻辑。其余 23 域全部通过 `buildDomainBaseline()` 参数化生成。

**解决方案 (分层策略)**:

**Tier 1 — 高优先域创建专属模块** (coding 已有，新增 3 个):

- `src/domains/it-operations/index.ts` — 运维域: runbook 关联、事件响应 workflow 扩展、告警工具绑定。
- `src/domains/customer-service/index.ts` — 客服域: 工单分类 schema、SLA 响应时间约束、知识库检索绑定。
- `src/domains/finance-accounting/index.ts` — 财务域: 审批金额阈值 schema、合规检查点、报表输出契约。

每个模块遵循 `coding/index.ts` 模式: Zod schema 定义域专属类型 + preset 常量 + 1–2 个域专属辅助函数。

**Tier 2 — 中期为所有域补充最小专属模块**:

- 为剩余域各创建 `src/domains/<domain-id>/index.ts`，至少包含: 域专属 TaskType enum、DefaultPreset、域专属 review 判定函数。
- 通过 `domains/index.ts` barrel 导出。

**Tier 3 — 长期为关键域添加运行时逻辑**:

- 域专属 workflow step handler (覆盖通用模板的特定步骤)。
- 域专属 tool 配置验证 (如 coding 域验证 repo 权限、finance 域验证审批链)。
- 域专属 eval 标准 (如 legal 域的合规评分、healthcare 域的安全评分)。

**涉及文件**: 新增 `src/domains/it-operations/index.ts`、`customer-service/index.ts`、`finance-accounting/index.ts` (Tier 1，每个 ~40–60 行)。
**测试要求**: 每个新模块配套 unit 测试验证 schema 解析与 preset 导出。

---

#### G-04 §45 Harness 不变量 4/10 (P2)

**当前状态（2026-04-23）**: `[ ] 未完成`

**证据**:

- `HarnessRuntimeService.assertInvariants()` 仍只有少量显式检查。
- 其余 guard 仍分散在 `loop/`、`guardrails/` 等路径，未收敛为 review 期望的集中式具名不变量集。

**现状诊断**:

`HarnessRuntimeService.assertInvariants()` 仅检查 4 条。`HarnessLoopController.getGuardViolation()` 另有 4 条 guard (maxIterations/maxReplans/maxCost/maxDuration)。`GuardrailEngine.assess()` 又有 4 条 guardrail (blocked_tool/required_evidence/max_risk/step_budget)。三处检查分散且互不协调。

额外发现:

- `runLoop()` 调用 `loop.recordIteration()` 时 **未传入实际 cost**，默认 `cost=0`，导致 `harness.guard.max_cost_exceeded` 为**死代码**。
- `assertInvariants()` **从未被自动调用** — 不在 `runLoop()`、`persist()`、`recover()` 等任何生命周期方法中。

**解决方案 (3 步)**:

**Step 1** — 合并 10 条具名不变量到 `assertInvariants()`:

```
harness.invariant.iteration_exceeds_budget      (已有)
harness.invariant.final_state_requires_completed_at (已有)
harness.invariant.waiting_hitl_requires_request  (已有)
harness.invariant.non_accept_decision_requires_feedback (已有)
harness.invariant.replan_count_exceeds_limit     (从 loop guard 提升)
harness.invariant.total_cost_exceeds_budget      (从 loop guard 提升)
harness.invariant.duration_exceeds_limit         (从 loop guard 提升)
harness.invariant.blocked_tool_in_plan           (从 guardrail 提升)
harness.invariant.required_evidence_missing      (从 guardrail 提升)
harness.invariant.risk_score_exceeds_maximum     (从 guardrail 提升)
```

**Step 2** — 修复 cost guard 死代码:

- 在 `runLoop()` 的每次迭代中，从 LLM/tool 调用返回的 usage 中提取实际 cost，传入 `loop.recordIteration(cost)`。
- 涉及文件: `harness/index.ts` (runLoop 方法)。

**Step 3** — 在生命周期关键点自动调用 `assertInvariants()`:

- `persistRun()` 和 `checkpointRun()` 之前调用，拒绝持久化违规 run。
- `restoreRun()` 和 `restoreFromCheckpoint()` 之后调用，拒绝返回违规 run。
- `runLoop()` 退出前调用，记录到 timeline。

**涉及文件**: `harness/index.ts`、`harness/loop/index.ts`。
**测试要求**: 扩展 `tests/unit/platform/orchestration/harness/` 验证 10 条不变量各自的触发与拒绝行为。

---

#### G-05 §58 HarnessSDK 抽象层 (P2)

**当前状态（2026-04-23）**: `[x] 已完成`

**证据**:

- 已新增 `src/sdk/harness-sdk/index.ts`
- 已接入 `src/sdk/index.ts` 导出
- 已新增测试 `tests/unit/sdk/harness-sdk.test.ts`

**现状诊断**:

开发者需直接使用 `HarnessRuntimeService` (26 个 public 方法) + `HarnessLoopController` + `DurableHarnessService` 等 12 个类。无统一 facade。`PluginTestHarness` (220 行) 存在于 `sdk/plugin-sdk/` 但仅用于插件测试。

**解决方案**:

在 `src/sdk/harness-sdk/` 新增 `HarnessSDK` 门面类，封装高频开发者操作:

```
src/sdk/harness-sdk/
├── index.ts           (barrel)
├── harness-sdk.ts     (主 facade ~150 行)
└── harness-sdk-types.ts (简化类型 ~50 行)
```

`HarnessSDK` 封装:

- `createAndRun(input)` — 组合 `createRun()` + `runLoop()`，返回 `HarnessResult` (简化版 HarnessRun)。
- `checkpoint(runId)` / `restore(runId)` — 封装 durable 操作。
- `sleep(runId, reason, resumeAt)` / `resume(runId)` — 封装休眠/恢复。
- `requestHumanReview(runId, reason)` / `resolveReview(runId, resolution)` — 封装 HITL。
- `getTimeline(runId)` / `getEvaluation(runId)` — 查询操作。
- `validate(runId)` — 调用 `assertInvariants()` 并抛出异常 (而非返回 violations 数组)。

`HarnessSDK` 构造函数接收 `HarnessRuntimeService` 实例，所有方法委托到内部实例。

**涉及文件**: 新增 `src/sdk/harness-sdk/` (3 文件，~200 行)。更新 `src/sdk/index.ts` barrel 导出。
**测试要求**: `tests/unit/sdk/harness-sdk/harness-sdk.test.ts` 覆盖所有 facade 方法。

---

#### G-06 §20 DurableHarnessService 内存 + 无唤醒 (P2)

**当前状态（2026-04-23）**: `[ ] 未完成`

**证据**:

- `src/platform/orchestration/harness/durable/durable-harness-service.ts` 仍以 `Map` 为主。
- `sleep-scheduler`、`SqliteDurableHarnessStore` 仍未落仓。

**现状诊断**:

`DurableHarnessService` (50 行) 使用 `Map<string, DurableHarnessRecord>` 和 `Map<string, HarnessRun>`，进程重启后全部丢失。`sleep()` 创建 `WorkflowSleepLease` 记录 `resumeAt` 但无任何 scheduler 轮询。此外: 无 checkpoint 上限/驱逐、无并发控制、无审计。

**解决方案 (3 步)**:

**Step 1** — 抽取存储接口 + SQLite 实现:

- 新增 `DurableHarnessStore` 接口 (`persist / checkpoint / restore / restoreFromCheckpoint / getCheckpointRef / evictExpired`)。
- 现有内存实现重命名为 `InMemoryDurableHarnessStore` (保留用于测试)。
- 新增 `SqliteDurableHarnessStore`，将 run JSON 序列化存入 `harness_runs` 表，checkpoint 存入 `harness_checkpoints` 表。复用 `state-evidence/truth/` 的 SQLite 连接模式。
- `DurableHarnessService` 构造函数接收 `DurableHarnessStore` 接口。

**Step 2** — 实现 sleep scheduler:

- 在 `platform/execution/` 或 `platform/orchestration/harness/` 新增 `sleep-scheduler.ts`。
- 使用 `setInterval` 定期 (如 30s) 扫描 `harness_runs` 中 `status=sleeping` 且 `resumeAt <= now` 的记录。
- 对到期的 lease 调用 `HarnessRuntimeService.resume()`。
- 提供 `start()` / `stop()` 生命周期方法，注册到 bootstrap。

**Step 3** — 增加保护措施:

- checkpoint 上限: 配置 `maxCheckpointsPerRun` (默认 50)，超限时驱逐最早的 checkpoint。
- 恢复时校验: `restore()` 后自动调用 `assertInvariants()`。
- 审计: `persist()` 和 `checkpoint()` 时追加 `HarnessTimelineEvent`。

**涉及文件**: `harness/durable/durable-harness-service.ts` (重构)、新增 `durable/durable-harness-store.ts` (接口)、`durable/sqlite-durable-harness-store.ts` (~120 行)、`harness/sleep-scheduler.ts` (~80 行)。
**测试要求**: unit 测试覆盖 SQLite store CRUD + checkpoint 驱逐 + sleep scheduler 唤醒; integration 测试覆盖 sleep → 到期 → 自动 resume 全流程。

---

#### G-07 §40 GoalDecomposer `llm_plan` 策略 (P2)

**当前状态（2026-04-23）**: `[~] 部分完成`

**证据**:

- 已新增 `src/interaction/goal-decomposer/llm-plan-generator.ts`
- `src/interaction/goal-decomposer/index.ts` 已支持 `llmPlanGenerator` 注入、超时回退与 `llm_plan` 策略
- `tests/unit/interaction/goal-decomposer/index.test.ts` 已补对应回归

**说明**: 仓内已不再是“死类型变体”，但默认 bootstrap wiring 仍未统一接入具体 provider，因此暂记部分完成。

**现状诊断**:

`GoalDecompositionService.decompose()` (`interaction/goal-decomposer/index.ts`, 397 行) 使用 regex 模板匹配生成任务 DAG。`decompositionStrategy` 类型定义中有 `"llm_plan"` 枚举值 (line 49)，但:

- 策略选择逻辑 (lines 174-178) 仅产生 `"template"` / `"hybrid"` / `"human_assisted"`，**永远不产生 `"llm_plan"`**。
- 文件中无 LLM client 导入、无 prompt 构建、无异步 LLM 调用。
- `"llm_plan"` 为**死类型变体**。

**解决方案 (2 步)**:

**Step 1** — 新增 LLM plan generator:

- 在 `interaction/goal-decomposer/` 新增 `llm-plan-generator.ts` (~150 行)。
- 接收 `UnifiedChatProvider` (来自 `model-gateway/provider-registry/`)。
- 构建 structured prompt: 将用户 goal description + 可用域列表 + 可用 recipe 列表发送给 LLM，要求返回 JSON 格式的 `PlannedTask[]` + dependency edges。
- 使用 `json_schema` response format 约束 LLM 输出结构。
- 实现 fallback: LLM 输出解析失败时回退到现有 template 策略。

**Step 2** — 集成到 `decompose()` 策略选择:

- 修改策略选择逻辑: 当模板匹配失败且 description 长度 > 50 字符时，调用 LLM plan generator 而非直接走 `"human_assisted"`。
- LLM 成功时 `decompositionStrategy = "llm_plan"`，失败回退时 `decompositionStrategy = "hybrid"`。
- 增加 `maxLlmPlanLatencyMs` 配置 (默认 10 000ms)，超时则回退。

**涉及文件**: 新增 `interaction/goal-decomposer/llm-plan-generator.ts`; 修改 `interaction/goal-decomposer/index.ts` (策略选择逻辑 + LLM 调用)。
**测试要求**: unit 测试 mock LLM 返回验证 JSON 解析 + fallback; integration 测试验证 LLM plan → DAG 依赖图 → 拓扑排序全流程。

---

#### G-08 §71–§94 域命名偏移 (P3)

**当前状态（2026-04-23）**: `[x] 已完成`

**证据**:

- `src/domains/domain-baseline-catalog.ts` 已新增:
  - `sales -> ecommerce`
  - `security -> content-moderation`
  - `data-analytics -> data-engineering`
- `tests/unit/domains/domain-baseline-catalog.test.ts` 已补断言并通过

**现状诊断**:

3 个域在设计文档与实现中命名不一致:

- 设计 `sales` → 实现 `ecommerce`
- 设计 `security` → 实现 `content-moderation`
- 设计 `data-analytics` → 实现 `data-engineering`

**解决方案 (二选一)**:

**方案 A — 扩展别名映射 (推荐)**:

- 在 `domain-baseline-catalog.ts` 的 `LEGACY_DOMAIN_ALIASES` 中增加 3 条映射:
  - `"sales"` → `"ecommerce"`
  - `"security"` → `"content-moderation"`
  - `"data-analytics"` → `"data-engineering"`
- 更新设计文档 §71–§94 增加备注说明实际实现使用的域 ID。
- 优点: 零破坏性变更，保持向后兼容。

**方案 B — 重命名实现域 ID**:

- 将 `ecommerce` 重命名为 `sales`，`content-moderation` 重命名为 `security`，`data-engineering` 重命名为 `data-analytics`。
- 需全局替换域 ID 引用 (baseline catalog, tests, config, roadmap template)。
- 风险: 破坏性变更，需要数据迁移。

**建议采用方案 A**。

**涉及文件**: `src/domains/domain-baseline-catalog.ts` (增加 3 行别名)。
**测试要求**: 扩展 alias 解析测试验证新映射。

---

#### G-09 §33 路线图阶段数差异 (P3)

**当前状态（2026-04-23）**: `[~] 部分完成`

**证据**:

- `src/domains/roadmap/roadmap-service.ts` 已补齐 `phase1`–`phase7` template seed
- `seedArchitectureRoadmap()` 已将 `phase1`–`phase7` 标为 `completed`
- `tests/unit/domains/roadmap/roadmap-service.test.ts` 已补并通过，`listArchitecturePhases()` 现返回全部 16 阶段

**说明**: 运行时代码已调和主要差异，但 ADR 与相关文档的同步更新仍未全部完成。

**现状诊断**:

- 设计 §33 描述 9 阶段 + 8a/8b/8c 并行路径。
- ADR-033 文档定义 7 阶段 (Phase 1–7)。
- `RoadmapPhase` 类型 (`domains/roadmap/types.ts`) 定义 16 值: `phase1`–`phase7` + `phase8a`/`phase8b`/`phase8c` + `phase9a`–`phase9f`。
- `ARCHITECTURE_ROADMAP_TEMPLATE` 仅 seed 了 9 项 (8a–8c, 9a–9f)。Phase 1–7 **无 seed 条目**。
- `listArchitecturePhases()` 从 template 派生，只返回 8x/9x 阶段。

**解决方案 (2 步)**:

**Step 1** — 补齐 Phase 1–7 template seed:

- 在 `roadmap-service.ts` 的 `ARCHITECTURE_ROADMAP_TEMPLATE` 数组中新增 7 条目，对应 ADR-033 定义的 Phase 1 (Core Execution) 到 Phase 7 (Scale Ecosystem)。每条包含 phase、title、description、successCriteria。
- 标记 Phase 1–7 的 `status` 为 `completed` (这些阶段对应的代码已全部实现)。

**Step 2** — 同步设计文档与 ADR:

- 更新 ADR-033 增加 Phase 8 (Harness 工程化) 和 Phase 9 (垂直域深化) 的描述，使 ADR 与设计文档 §33 对齐。
- 在 ADR 中注明 Phase 8 拆分为 8a (Constraints/Tools)、8b (Durability/Recovery)、8c (Evaluation/HITL)。

**涉及文件**: `src/domains/roadmap/roadmap-service.ts` (新增 ~50 行 template 条目); `docs_zh/adr/033-phased-roadmap.md` (新增 Phase 8/9 描述)。
**测试要求**: 扩展 roadmap 测试验证 `listArchitecturePhases()` 返回全部 16 阶段。

---

#### G-10 §48 SAML Phase 2 Hardening (P3)

**当前状态（2026-04-23）**: `[~] 部分完成`

**证据**:

- 当前实现已具备 `issuer / fingerprint / audience / time window` 等基础校验。
- 文件头中的 Phase 2 hardening TODO 仍在，X.509 trust chain、C14N、assertion replay、encrypted assertion 仍未全量落地。

**现状诊断**:

`org-governance/sso-scim/saml/index.ts` 第 17–22 行列出 4 项 Phase 2 TODO:

1. X.509 证书信任链验证 — 当前仅做指纹字符串比对 (line 205)。
2. XML 签名 C14N 规范化验证 — `validateXmlSignature()` 仅调用基础 `checkSignature()`。
3. 断言 ID 重放攻击防护 — 无 assertion ID 追踪。
4. 加密断言支持 — 无 encrypted assertion 解密。

额外问题: `consumeAssertion()` (line 197) 在 `xmlSignature` 或 `rawXml` 缺失时**静默跳过**签名验证。

**解决方案 (4 步)**:

**Step 1** — X.509 信任链:

- 在 `validateXmlSignature()` 中增加 X.509 证书链验证，使用 Node.js `crypto.X509Certificate` API 校验 issuer chain 和有效期。
- 替换指纹比对为证书链 `verify()` 调用。

**Step 2** — C14N 规范化:

- 配置 `xml-crypto` 的 `SignedXml` 使用 `exc-c14n#` 或 `exc-c14n#WithComments` canonicalization method。
- 拒绝不支持的 canonicalization 算法。

**Step 3** — 重放防护:

- 新增 `AssertionReplayGuard` 类，使用带 TTL 的 `Map<string, number>` 追踪已消费的 assertion ID。
- 在 `consumeAssertion()` 中检查 assertion ID 是否已使用，重复则拒绝。
- TTL 默认 5 分钟 (可配置)。

**Step 4** — 签名验证强制化:

- 修改 `consumeAssertion()`: 当 `xmlSignature` 或 `rawXml` 缺失时，返回验证失败而非静默跳过。
- 仅允许配置了 `allowUnsignedAssertions: true` 的 IdP 跳过签名 (默认 false)。

**涉及文件**: `org-governance/sso-scim/saml/index.ts` (~100 行修改/新增)。
**测试要求**: 补充 `tests/unit/org-governance/sso-scim/saml/` 测试: 过期证书拒绝、重放 assertion 拒绝、无签名 assertion 拒绝、合法 C14N 通过。

---

#### G-11 §51 Delegated Governance 内存存储 (P3)

**当前状态（2026-04-23）**: `[~] 部分完成`

**证据**:

- 已新增 `src/org-governance/delegated-governance/stores/index.ts`
- 已实现 `DelegationStore / AuditLogStore` 抽象
- 已实现 `InMemoryDelegationStore / InMemoryAuditLogStore / SqliteDelegationStore / SqliteAuditLogStore`
- `SelfServiceGovernanceConsole` 已改为依赖 store 注入
- 已新增 `tests/unit/org-governance/delegated-governance/stores.test.ts`

**说明**: 仓内已具备持久化 store 能力，但默认构造仍回退到内存 store，review 方案中的 API 暴露也尚未补齐。

**现状诊断**:

`org-governance/delegated-governance/governance-console-service.ts` (lines 84-85) 使用:

- `delegations: Map<string, GovernanceDelegation>` — 委托记录。
- `auditLog: GovernanceConsoleAuditEntry[]` — 审计日志。

文件头 (lines 13-20) 明确标注 "Phase 1 stub"，TODO 列出持久化、审计、RBAC、前端集成。

**解决方案 (2 步)**:

**Step 1** — 抽取存储接口 + SQLite 实现:

- 新增 `DelegationStore` 接口 (`save / get / list / listByGrantee / listByOrgNode / delete`)。
- 新增 `AuditLogStore` 接口 (`append / list / listByDelegationId`)。
- 新增 `SqliteDelegationStore` 和 `SqliteAuditLogStore`，复用 `state-evidence/truth/` 的 SQLite 连接模式。表: `governance_delegations` + `governance_audit_log`。
- `SelfServiceGovernanceConsole` 构造函数接收两个 store 接口，内部 `Map`/`Array` 替换为 store 调用。
- 保留 `InMemoryDelegationStore` / `InMemoryAuditLogStore` 用于测试。

**Step 2** — 审计日志增强:

- 所有 console 操作 (`create / revoke / review / list`) 均写入 `AuditLogStore`，包含 actorId、timestamp、操作类型、操作详情。
- 暴露 `GET /v1/governance/delegations/{id}/audit-log` API。

**涉及文件**: `delegated-governance/governance-console-service.ts` (重构); 新增 `delegated-governance/stores/` (接口 + SQLite 实现，~200 行)。
**测试要求**: unit 测试覆盖 SQLite store CRUD; integration 测试覆盖创建→审计→查询全流程。

---

## §16 结论

**当前回写状态（2026-04-23）**:

- 本次没有删除原结论，仅为 `G-01~G-11` 追加完成状态与证据。
- 本次已落仓并完成定向验证的实现包括:
  - `G-05 HarnessSDK`
  - `G-08 域 alias 映射`
  - `G-09 路线图 phase1-7 seed`
  - `G-11 Governance store 抽象与 SQLite store`
  - `G-07 llm_plan 注入式实现`

本次全面复核覆盖设计文档 v3.2 的全部 **10 层架构、68 个设计章节** (§4–§69, §71–§94)，对照 **1 397 个源文件 (~267K 行)** 和 **1 876 个测试文件 (~458K 行)**。

**核心结论**:

1. **整体对齐度极高**: 10 层中有 8 层达到 FULL 状态，仅 Part IV (垂直域深化) 为 PARTIAL，Part II 和 Part VI 各有 1 个子章节为 PARTIAL。
2. **代码量充实**: 平台代码 267K 行 + 测试 458K 行，测试覆盖率达 1.72 倍源码行数。
3. **最大差距在 Part IV**: 7 个设计域缺失 + 23 域无专属逻辑，是当前设计-实现偏差最大的区域。
4. **§18 成本管理是核心能力的主要缺口**: 数据模型正确但执行层极薄 (63 行)。
5. **前序 v8.3 的 13 个条目已全部关闭**，本版新发现 11 个缺口 (P1×3, P2×4, P3×4)。

---

## §17 回写说明

**2026-04-23 增量回写**:

- 保留 v9.1 原文，不删除原“现状诊断/解决方案/结论”。
- 仅在 `G-01~G-11` 下追加“当前状态/证据/说明”。
- 本次定向验证已通过:
  - `npm run build:test`
  - 54 个相关单测（domain / roadmap / goal-decomposer / governance / sdk）

- 本文件为 v9.1，完全重写自 v8.3；v9.1 新增 G-01~G-11 详细解决方案。
- v8.3 的 13 个条目 (P0-1~P0-3, P1-1~P1-7, P2-1~P2-3) 已在前序版本全部关闭，不再逐条列出。
- 新缺口清单 (G-01~G-11) 取代旧编号体系。
- 关联文档建议同步更新:
  - `docs_zh/analysis/00-architecture-coverage-matrix.md`
  - `docs_zh/operations/current_todo_list.md`
