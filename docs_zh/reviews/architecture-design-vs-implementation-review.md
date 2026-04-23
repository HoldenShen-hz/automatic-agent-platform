# 架构设计 vs 实现状态 — 全量评审报告（含详细实施方案）

> **版本**: v6.0
> **评审日期**: 2026-04-22
> **设计文档**: `docs_zh/architecture/00-platform-architecture.md` v3.3（94 节, 8,204 行, 11 Part, 105 ADR）
> **代码参考**: `docs_zh/architecture/02-code-architecture-reference.md`
> **评审方法**: 逐节提取设计规范中的具体实现要求（接口、服务、API、数据模型、阈值），与 `src/` 实际代码逐项交叉验证
> **代码库规模**: ~1,335 源文件 / ~1,341 测试文件
> **vs v5.0 变化**: 为所有未实现项补充**文件级、函数签名级**的详细实施方案，包含新建文件路径、Zod Schema 定义、服务类骨架、集成点、测试用例

---

## 评审符号说明

| 符号 | 含义      | 判定标准                                               |
| ---- | --------- | ------------------------------------------------------ |
| ✅   | 已实现    | 设计要求的接口/服务/阈值在代码中可验证，测试覆盖主路径 |
| 🟡   | 部分实现  | 核心逻辑存在但次要路径/阈值/子模块缺失                 |
| 🔴   | 未实现/桩 | 仅类型定义或 ≤20 行占位，无实际业务逻辑                |

---

## 总览：三环实现状态

| 环                  | 范围                                                                                                                                       | 验收门禁                                                          | 当前状态                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **生存环** (Ring 1) | P1-P5 核心链 + ConstraintPack + HarnessRun/Step/Decision + 风控/审批/审计 + 租约/CAS/检查点/恢复 + 紧急制动 + ModelGateway/Prompt/EvalGate | "跑通 1 个 Agent 任务端到端，可中断可恢复可审计"                  | 🟡 **基础设施已实现，Harness 主链已落地，R5 深水区仍在继续收口** |
| **可用环** (Ring 2) | NL 入口 + 目标分解 + HITL Runtime + Async Harness + Dashboard + 组织/SSO/审批路由 + DomainDescriptor/Recipe/Meta-Model + Agent 协作协议    | "至少 2 个垂直域试运行，非技术用户可 NL 提交，审批和 HITL 端到端" | 🟡 **NL、HITL、Async Harness、Meta-Model、ACP 已有实现，仍待继续加厚产品闭环** |
| **扩展环** (Ring 3) | 市场 + 多区域 + 边缘 + 成本优化 + 行为漂移 + 合规报告 + 24 域 Pack                                                                         | "≥12 域生产运行，跨区域故障切换演练通过"                          | 🟡 **24 域 baseline 已落地，规模化与 ops-maturity 仍有收尾项** |

---

## Part I — 基础设施平台（§4-§14, §24-§32）

### 总评: ✅ 对齐率 ~95%

基础设施层是代码库中最成熟的部分，五面架构、契约体系、API、稳定性、安全、OAPEFLIR 等均有实质实现。

| 节      | 设计要求                                                     | 状态 | 关键证据                                                                                                           |
| ------- | ------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------ |
| §4      | P1-P5 五面 + X1 横切                                         | ✅   | interface/ 62 文件, control-plane/ 107 文件, orchestration/ 91 文件, execution/ 177 文件, state-evidence/ 201 文件 |
| §5      | 面间契约 (RequestEnvelope/ControlDirective/ExecutionPlan 等) | ✅   | contracts/ 完整定义, P1 不可绕过 P2                                                                                |
| §6      | API 契约 (15+ REST 端点 + WebSocket + Idempotency)           | ✅   | task-routes 491 行, 完整 CRUD                                                                                      |
| §7      | 服务通信 (超时/Outbox/流重连)                                | ✅   | OutboxService 219 行, DurableEventBus                                                                              |
| §8      | 可扩展性 S1-S3                                               | 🟡   | S1/S2 已实现; S4 K8s 集群级分片未实现                                                                              |
| §9      | 七层稳定性 (L1 隔离 - L7 可观测)                             | ✅   | CircuitBreaker + BackpressureController + AutoStopLoss + 6 恢复 worker                                             |
| §10     | 6 因子风控                                                   | ✅   | config/risk/default.json 82 行, 4 级风险映射                                                                       |
| §11     | 安全架构 (RBAC + 4 层沙箱 + Vault)                           | ✅   | PolicyEngine + SandboxPolicyService + DataClassificationService 730 行                                             |
| §12     | 异常事件处理 (E1-E6 + SEV1-4 + 检测规则)                     | ✅   | AnomalyDetectionService 795 行                                                                                     |
| §13     | OAPEFLIR 8 阶段内核                                          | ✅   | OapeflirLoopService 439 行, 每阶段 Rationale + Timeline                                                            |
| §13.5   | OAPEFLIR-Harness 外部语义映射                                | ✅   | `oapeflir-harness-mapping.ts` 已落地并接入 Harness step 语义阶段                                                  |
| §14     | 运行时执行面 (6 执行器 + 6 恢复 worker + 8 运行模式)         | ✅   | 2,748 行恢复逻辑                                                                                                   |
| §24-§32 | 配置治理/数据一致性/存储/SLO/事件/知识/Pack/灾备/部署        | ✅   | 全部已实现                                                                                                         |

**当前差距与详细实施方案**:

#### I-1: §8 S4 K8s 集群级分片未实现 (P3)

属部署拓扑演进项，不在本仓闭环范围。待 K8s Operator 层面实现。

#### I-2: §13.5 OAPEFLIR-Harness 语义映射已实现 (已关闭)

`src/platform/orchestration/harness/oapeflir-harness-mapping.ts` 已落地，并已在 `HarnessRuntimeService.appendStep()` 中写入语义阶段。该项不再作为待开发缺口。
---

## Part II — AI 运营（§15-§23）

### 总评: ✅ 对齐率 ~93%

| 节 | 设计要求 | 状态 | 关键证据 |
|----|----------|------|----------|
| §15 | ModelGateway (complete/stream/embed + 路由 + 降级 D0-D4 + 熔断) | ✅ | UnifiedChatProvider 491 行, 3 提供商, degradation-controller 465 行 |
| §16 | Prompt 版本化 (draft→stable + Canary Rollout + 注入检测 + Canary Token) | ✅ | PromptVersionManager 213 行, prompt-injection-guard.ts |
| §17 | 模型评估 (EvalDataset + QualityGate + 漂移检测 + LLM-as-Judge) | ✅ | PostExecutionQualityGate + changepoint-detector + CrossProviderJudgeService |
| §18 | 成本管理 (4 级预算) | ✅ | CostAlertService + BillingService 792 行 |
| §19 | Agent 委派 (深度≤3 + 循环检测 + 权限收缩 + 4 协作模式) | ✅ | TopologyValidator + ContextIsolator 298 行 |
| §19.5 | **Agent 协作协议 (ACP)** | ✅ | `collaboration-protocol` 模块、schema、不变量与委派接线已实现 |
| §20 | 长运行任务/休眠 | ✅ | workflow-hibernation-service 完整 |
| §21 | HITL 架构 (7 模式 + 审批流 + 超时升级) | ✅ | HitlApprovalOrchestrationService + ApprovalFlowEngine 962 行 |
| §22 | SDK (PackSDK + CLI 79 命令) | ✅ | pack-scaffold-service 319 行 |
| §23 | 合规与数据治理 | ✅ | ComplianceCaseOrchestrationService 324 行 |

**当前差距与详细实施方案**:

#### II-1: §19.5 Agent 协作协议 (ACP) 已实现 (已关闭)

`src/platform/orchestration/agent-delegation/collaboration-protocol/` 已包含 message schema、8 种消息类型、9 个强制字段、不变量检查与发送/接收校验服务，并已接回委派主链。该项不再作为待开发缺口。

#### II-2: ModelGateway 缺少 embed()/complete() 方法 (P2)

**修改文件**: `src/platform/ai-operations/model-gateway/unified-chat-provider.ts`
- 新增 `embed(input: string[], model?: string): Promise<number[][]>` 方法
- 新增 `complete(prompt: string, options?: CompletionOptions): Promise<string>` 方法
- 复用现有 provider 路由和降级链
- **工时**: 1 人天

#### II-3: 仅 3 个 LLM 提供商 (P3)

按需扩展，不阻断当前里程碑。

---

## Part III — 领域接入（§37-§38）

### 总评: 🟡 框架完整但领域元模型未实现

| 节           | 设计要求                                                                   | 状态 | 关键证据                         |
| ------------ | -------------------------------------------------------------------------- | ---- | -------------------------------- |
| §37.1-§37.10 | DomainDescriptor 14 字段 + 7 域类 + 风险/知识/评估/Prompt/Recipe/交互/治理 | ✅   | domains/ 完整服务体系            |
| §37.7        | DomainRecipe 12 种原型                                                     | 🟡   | 仅 4 原型，缺 8 种               |
| §37.11       | **领域规范元模型**                                                         | 🔴   | **完全未实现**                   |
| §38          | 领域接入 Runbook (4 阶段 + Gate 1-3 + 金丝雀)                              | ✅   | DomainEvaluationGateService 完整 |
**当前差距与详细实施方案**:

#### III-1: §37.11 领域规范元模型完全未实现 (P0)

**问题**: 架构 §37.11 定义了"统一领域元模型"——12 个标准问题 (Q1-Q12) + 24 域填充矩阵。当前代码中无 `meta-model`、`12-question`、`canonical` 相关引用。

**实施方案**:

**新建目录**: `src/domains/canonical-meta-model/`

**文件 1**: `canonical-meta-model/types.ts` (~90 行)

```typescript
import { z } from "zod";

export const MetaModelQuestionIdSchema = z.enum([
  "Q1_primary_entities", // 领域主实体
  "Q2_high_risk_actions", // 高风险动作 (risk ≥ 70)
  "Q3_default_autonomy", // 默认自治级别 L0-L4
  "Q4_default_hitl_points", // 默认 HITL 节点
  "Q5_external_dependencies", // 关键外部系统
  "Q6_readonly_tools", // 只读工具 (risk < 40)
  "Q7_write_tools", // 写工具 (risk ≥ 40)
  "Q8_irreversible_actions", // 不可逆动作
  "Q9_quality_metrics", // 核心质量指标
  "Q10_compliance_rules", // 核心合规约束
  "Q11_mvp_capabilities", // 最小上线能力集
  "Q12_pre_launch_certs", // 上线前认证
]);
export type MetaModelQuestionId = z.infer<typeof MetaModelQuestionIdSchema>;

export const MetaModelAnswerSchema = z.object({
  questionId: MetaModelQuestionIdSchema,
  answer: z.array(z.string()).min(1),
  platformConcept: z.string(),
  filledBy: z.string(),
  filledAt: z.string().datetime(),
});
export type MetaModelAnswer = z.infer<typeof MetaModelAnswerSchema>;

export const DomainMetaModelSchema = z.object({
  domainId: z.string().min(1),
  version: z.number().int().min(1),
  answers: z.array(MetaModelAnswerSchema).length(12),
  completeness: z.number().min(0).max(1),
  validatedAt: z.string().datetime().optional(),
});
export type DomainMetaModel = z.infer<typeof DomainMetaModelSchema>;
```

**文件 2**: `canonical-meta-model/meta-model-validator.ts` (~60 行)

```typescript
import { MetaModelQuestionIdSchema, type DomainMetaModel } from "./types.js";

export class MetaModelValidator {
  public validate(model: DomainMetaModel): {
    valid: boolean;
    missingQuestions: string[];
    errors: string[];
  };
  public computeCompleteness(model: DomainMetaModel): number;
}
```

**文件 3**: `canonical-meta-model/meta-model-seeder.ts` (~150 行)

```typescript
import type { DomainMetaModel } from "./types.js";

// 加载架构文档 §37.11 中 24 域的 Q1-Q12 填充矩阵
export class MetaModelSeeder {
  public seedDomain(domainId: string): DomainMetaModel;
  public seedAllDomains(): Map<string, DomainMetaModel>;
  public getDomainMatrix(): ReadonlyMap<string, DomainMetaModel>;
}
```

**文件 4**: `canonical-meta-model/index.ts` (re-exports)

**集成点**:

- `DomainEvaluationGateService` 的 Runbook Step 8 调用 `MetaModelValidator.validate()` 作为门禁
- `bootstrapVerticalDomainBaselines()` 调用 `MetaModelSeeder.seedAllDomains()` 初始化
- `DomainDescriptorOrchestrationService.review()` 检查元模型完整度

**测试文件**: `tests/unit/domains/canonical-meta-model/meta-model-validator.test.ts`

- 12 问全填 → valid
- 缺任一问 → invalid + 报告缺失
- completeness 计算准确性

**工时**: 2-3 人天

#### III-2: §37.7 DomainRecipe 仅 4 种原型，缺 8 种 (P1)

**问题**: `domain-recipe-service.ts:58-99` 只有 `prototype_analysis/implementation/review/release` 4 种。架构要求 12 种。

**修改文件**: `src/domains/domain-recipe-service.ts`

在 `prototypeTemplates` 数组中追加 8 种原型:

```typescript
// 追加到 prototypeTemplates 数组 (line 58-99 之后)
{
  templateId: "prototype_trading",
  name: "Trading Recipe",
  description: "Real-time trading with risk controls and compliance gates",
  category: "general",
  triggerPatterns: ["trade", "order", "position", "hedge", "backtest"],
  defaultWorkflowId: "trading_workflow",
  defaultToolBundleIds: ["market_data_tools", "order_tools", "risk_tools"],
  estimatedDurationMinutes: 15,
},
{
  templateId: "prototype_compliance",
  name: "Compliance Recipe",
  description: "Audit, evidence collection, and irreversible approval workflows",
  category: "review",
  triggerPatterns: ["audit", "comply", "certify", "evidence", "attest"],
  defaultWorkflowId: "compliance_workflow",
  defaultToolBundleIds: ["audit_tools", "evidence_tools"],
  estimatedDurationMinutes: 60,
},
{
  templateId: "prototype_research",
  name: "Research Recipe",
  description: "Investigation with citations, methodology, and synthesis",
  category: "analysis",
  triggerPatterns: ["research", "literature", "survey", "synthesize", "cite"],
  defaultWorkflowId: "research_workflow",
  defaultToolBundleIds: ["search_tools", "citation_tools"],
  estimatedDurationMinutes: 90,
},
{
  templateId: "prototype_adversarial",
  name: "Adversarial Recipe",
  description: "Security testing with red-blue team patterns",
  category: "review",
  triggerPatterns: ["pentest", "red-team", "vulnerability", "exploit", "fuzz"],
  defaultWorkflowId: "adversarial_workflow",
  defaultToolBundleIds: ["security_tools", "scanning_tools"],
  estimatedDurationMinutes: 120,
},
{
  templateId: "prototype_moderation",
  name: "Moderation Recipe",
  description: "Content review with SLA < 500ms and escalation paths",
  category: "review",
  triggerPatterns: ["moderate", "flag", "classify", "filter", "report"],
  defaultWorkflowId: "moderation_workflow",
  defaultToolBundleIds: ["classifier_tools", "escalation_tools"],
  estimatedDurationMinutes: 5,
},
{
  templateId: "prototype_logistics",
  name: "Logistics Recipe",
  description: "Scheduling, IoT coordination, and exception handling",
  category: "general",
  triggerPatterns: ["route", "dispatch", "track", "warehouse", "shipment"],
  defaultWorkflowId: "logistics_workflow",
  defaultToolBundleIds: ["routing_tools", "iot_tools", "tracking_tools"],
  estimatedDurationMinutes: 30,
},
{
  templateId: "prototype_conversational",
  name: "Conversational Recipe",
  description: "Multi-turn dialogue with sentiment and escalation",
  category: "general",
  triggerPatterns: ["chat", "converse", "support", "counsel", "coach"],
  defaultWorkflowId: "conversational_workflow",
  defaultToolBundleIds: ["dialogue_tools", "sentiment_tools"],
  estimatedDurationMinutes: 15,
},
{
  templateId: "prototype_incident_ops",
  name: "Incident Ops Recipe",
  description: "Alert triage, diagnosis, and automated recovery",
  category: "general",
  triggerPatterns: ["incident", "alert", "diagnose", "mitigate", "postmortem"],
  defaultWorkflowId: "incident_ops_workflow",
  defaultToolBundleIds: ["monitoring_tools", "runbook_tools", "recovery_tools"],
  estimatedDurationMinutes: 30,
},
```

**修改**: `RecipeTemplate.category` 类型需扩展为 `"analysis" | "implementation" | "review" | "release" | "general" | "trading" | "compliance" | "research" | "adversarial" | "moderation" | "logistics" | "conversational" | "incident_ops"`

**测试**: `tests/unit/domains/domain-recipe-service.test.ts` 补充 12 原型全覆盖

**工时**: 2 人天
---

## Part IV — 垂直业务域（§71-§94）

### 总评: 🔴 24 域均仅有泛化种子，零域特化实现

代码库 `domain-baseline-catalog.ts` 通过 `bootstrapVerticalDomainBaselines()` 为全部 24 域注册了泛化基线（通用 2 步工作流 intake→deliver + 通用工具 read/summarize + 通用评估器），但**零域特化配置**。

#### 24 域实现矩阵

| 节  | 域名       | 设计 domain_id        | 代码 domainId               | ID 匹配 | 专属 Config | 域特化工作流 | 域特化工具 |
| --- | ---------- | --------------------- | --------------------------- | ------- | ----------- | ------------ | ---------- |
| §71 | 量化交易   | `quant-trading`       | `quantitative-trading`      | ❌      | ❌          | ❌           | ❌         |
| §72 | 电商       | `ecommerce`           | `ecommerce`                 | ✅      | ❌          | ❌           | ❌         |
| §73 | 广告推广   | `advertising`         | `advertising-promotion`     | ❌      | ❌          | ❌           | ❌         |
| §74 | 金融服务   | `financial-services`  | `financial-services`        | ✅      | ❌          | ❌           | ❌         |
| §75 | 数据处理   | `data-engineering`    | `data-processing`           | ❌      | ❌          | ❌           | ❌         |
| §76 | 代码开发   | `coding`              | `coding`                    | ✅      | ✅          | 🟡           | 🟡         |
| §77 | 用户运营   | `user-operations`     | `user-operations`           | ✅      | ❌          | ❌           | ❌         |
| §78 | 行业调研   | `industry-research`   | `industry-research`         | ✅      | ❌          | ❌           | ❌         |
| §79 | 学术调研   | `academic-research`   | `academic-research`         | ✅      | ❌          | ❌           | ❌         |
| §80 | 企业知识库 | `knowledge-base`      | `enterprise-knowledge-base` | ❌      | ❌          | ❌           | ❌         |
| §81 | 财务       | `finance-accounting`  | `finance`                   | ❌      | ❌          | ❌           | ❌         |
| §82 | 法务       | `legal`               | `legal`                     | ✅      | ❌          | ❌           | ❌         |
| §83 | 在线直播   | `live-streaming`      | `online-livestream`         | ❌      | ❌          | ❌           | ❌         |
| §84 | 广告素材   | `creative-production` | `advertising-creative`      | ❌      | ❌          | ❌           | ❌         |
| §85 | 游戏开发   | `game-dev`            | `game-development`          | ❌      | ❌          | ❌           | ❌         |
| §86 | 游戏上架   | `game-publishing`     | `game-publishing`           | ✅      | ❌          | ❌           | ❌         |
| §87 | 人力资源   | `human-resources`     | `human-resources`           | ✅      | ❌          | ❌           | ❌         |
| §88 | 供应链     | `supply-chain`        | `supply-chain-logistics`    | ❌      | ❌          | ❌           | ❌         |
| §89 | 医疗健康   | `healthcare`          | `medical-health`            | ❌      | ❌          | ❌           | ❌         |
| §90 | 教育培训   | `education`           | `education-training`        | ❌      | ❌          | ❌           | ❌         |
| §91 | 客户服务   | `customer-service`    | `customer-service`          | ✅      | ❌          | ❌           | ❌         |
| §92 | 内容审核   | `content-moderation`  | `content-moderation`        | ✅      | ❌          | ❌           | ❌         |
| §93 | IT 运维    | `it-operations`       | `it-operations`             | ✅      | ❌          | ❌           | ❌         |
| §94 | 市场营销   | `marketing`           | `marketing-brand`           | ❌      | ❌          | ❌           | ❌         |

**当前差距与详细实施方案**:

#### IV-1: 12 个 domain_id 不匹配 (P0)

**修改文件**: `src/domains/domain-baseline-catalog.ts`

**修改内容**: 修改 `VerticalDomainId` 联合类型 (line 15-39) 和 `DOMAIN_SEEDS` 数组 (line 77-102) 中的 12 个 domainId:

| 行号范围                        | 旧值                        | 新值                  |
| ------------------------------- | --------------------------- | --------------------- |
| VerticalDomainId + DOMAIN_SEEDS | `quantitative-trading`      | `quant-trading`       |
|                                 | `advertising-promotion`     | `advertising`         |
|                                 | `data-processing`           | `data-engineering`    |
|                                 | `enterprise-knowledge-base` | `knowledge-base`      |
|                                 | `finance`                   | `finance-accounting`  |
|                                 | `online-livestream`         | `live-streaming`      |
|                                 | `advertising-creative`      | `creative-production` |
|                                 | `game-development`          | `game-dev`            |
|                                 | `supply-chain-logistics`    | `supply-chain`        |
|                                 | `medical-health`            | `healthcare`          |
|                                 | `education-training`        | `education`           |
|                                 | `marketing-brand`           | `marketing`           |

**同步修改**: 搜索全代码库中引用旧 domainId 的位置（namespace 字段、测试用例、config 引用），全部同步更新。

**测试**: 运行 `npm test` 确保无断裂引用。

**工时**: 0.5 人天

#### IV-2: 23 域缺 config 文件 (P1)

**实施方案**: 以 `config/domains/default.json` 中 `coding` 域配置为模板，为每域创建专属配置。

**新建文件模式**: 修改 `config/domains/default.json`，在 `domains` 数组中追加每域条目。

**优先 5 个 critical 域**: `quant-trading`, `financial-services`, `finance-accounting`, `legal`, `healthcare`

每域配置需包含:

- `workflows[]`: 域专属工作流步骤（非通用 intake→deliver）
- `toolBundles[]`: 域专属工具（如 quant-trading 需 `market_data`, `order_execution`, `risk_calculator`）
- `capabilities.budgetLimits`: 域专属预算（critical 域更高）
- `capabilities.securityLevel`: 与风险等级匹配

**工时**: 每域 0.5 人天，5 关键域 = 2.5 人天

#### IV-3: 24 域缺域特化 Agent 工作流 (P1)

**实施方案**: 以 `src/domains/coding/index.ts` 为参考模式，为每域创建实例目录。

**新建目录模式**: `src/domains/{domain-id}/index.ts`

每域 `index.ts` 包含:

```typescript
import { z } from "zod";

export const {Domain}TaskTypeSchema = z.enum([...]);
export const {Domain}DomainPresetSchema = z.object({
  domainId: z.literal("{domain-id}"),
  displayName: z.literal("{DisplayName}"),
  defaultWorkflowIds: z.array(z.string()).default([...]),
  defaultToolBundleIds: z.array(z.string()).default([...]),
  requiredCapabilities: z.array({Domain}TaskTypeSchema).default([...]),
  reviewRequiredTaskTypes: z.array({Domain}TaskTypeSchema).default([...]),
});
export type {Domain}DomainPreset = z.infer<typeof {Domain}DomainPresetSchema>;
export const {DOMAIN}_DOMAIN_PRESET: {Domain}DomainPreset = {Domain}DomainPresetSchema.parse({
  domainId: "{domain-id}", displayName: "{DisplayName}",
});
```

**优先按 Phase 9a 批次**: coding (已有), data-engineering, knowledge-base, user-operations

**工时**: 每域 2-3 人天

#### IV-4/5/6/7: 域特化风险/评估/延迟/Division (P2)

**IV-4 风险覆写**: 使用 `DomainRiskProfileService.addOverride()` 加载域特化 riskOverrides。每域约 5-10 条覆写规则。修改 `domain-baseline-catalog.ts` 中 `buildDomainBaseline()` 的 `riskOverrides` 为域特化值。

**IV-5 评估指标**: 使用 `DomainEvalFrameworkService` 加载域特化评估器。如 quant-trading: `sharpe_ratio`, `max_drawdown`; customer-service: `csat`, `first_response_time`。

**IV-6 延迟/数据敏感性**: 在 `DomainBaseline` 接口中新增:

```typescript
readonly latencyTier: "ultra_realtime" | "realtime" | "near_realtime" | "batch";
readonly dataSensitivity: "public" | "internal" | "confidential" | "regulated";
```

**IV-7 Division YAML**: 为 13 域创建 `divisions/{domain-id}/division.yaml`。

**工时**: 每项 1-2 人天框架 + 每域 0.3-0.5 人天填充
---

## Part V — 智能交互（§39-§44）

### 总评: ✅ 对齐率 ~95%

| 节 | 设计要求 | 状态 | 关键证据 |
|----|----------|------|----------|
| §39 | NL 入口 (IntentParser + DomainRouter + AmbiguityDetector + 4 语言) | ✅ | nl-gateway/ 6 文件 1,270 行 |
| §40 | 目标分解 (Goal/DAG/置信度<0.7→人工/深度≤5/9 状态) | ✅ | goal-decomposer/ 493 行 |
| §41 | 主动式 Agent (4 种触发 + 4 层风暴保护) | ✅ | proactive-agent/ 694 行 |
| §42 | 渐进式自主权 (6 级信任 + 4 级自主 + 晋升/降级) | ✅ | autonomy/ 566 行 |
| §43 | 统一看板 (L1-L4 + WebSocket) | ✅ | dashboard/ 1,100 行 |
| §44 | 非技术用户 UX (可视化构建器 + 向导 + PlatformMode) | ✅ | WorkflowBuilderService + OnboardingService 321 行 |

本层无当前阻断差距。

---

## Part VI — Harness 工程（§45, §58）

### 总评: 🔴 八柱模型仅骨架，20 项架构要求中 0 项完整实现

架构文档 §45 定义了 21 个子节 + §58 定义了 6 个横切关注点。实际代码仅有 `HarnessRuntimeService` 124 行逻辑、6 个数据接口，为单次执行骨架。

#### §45 Harness Runtime 逐项评审

| 子节   | 设计要求                                                        | 状态 |
| ------ | --------------------------------------------------------------- | ---- |
| §45.2  | HarnessRuntime 统一入口 (多轮 Planner→Generator→Evaluator 循环) | 🔴   |
| §45.3  | ConstraintPack 5 维约束 + ConstraintEngine 多级合并             | 🟡   |
| §45.4  | ToolbeltAssembler 6 步装配                                      | 🔴   |
| §45.5  | HarnessContext + ContextAssembler + ContextSnapshot             | 🔴   |
| §45.6  | FeedbackEnvelope 4 级反馈                                       | 🔴   |
| §45.7  | HarnessLoopController 5 决策 + 5 循环守卫                       | 🟡   |
| §45.8  | Planner Agent (PlanBundle)                                      | 🔴   |
| §45.9  | Generator Agent (WorkProduct)                                   | 🔴   |
| §45.10 | Evaluator Agent (EvaluationReport)                              | 🔴   |
| §45.11 | Recovery Controller (5 种故障)                                  | 🔴   |
| §45.13 | HarnessRun 16 字段 / HarnessStep 12 字段                        | 🟡   |
| §45.14 | Evaluation Harness (3 模式 + 5 服务)                            | 🔴   |
| §45.15 | Durable Harness (5 pauseReason + 4 resumeStrategy)              | 🔴   |
| §45.16 | Memory Namespace 3 层                                           | 🔴   |
| §45.17 | Tool Harness (ToolCapabilityProfile)                            | 🔴   |
| §45.18 | HITL Runtime (5 能力)                                           | 🔴   |
| §45.19 | Async Harness (6 API)                                           | 🔴   |
| §45.20 | Guardrails 5 层                                                 | 🔴   |
| §45.21 | 10 项不变量                                                     | 🔴   |

#### §58 横切关注点

| 子节  | 设计要求                     | 状态 |
| ----- | ---------------------------- | ---- |
| §58.1 | Harness 可观测性             | 🔴   |
| §58.2 | Prompt 分层治理              | 🔴   |
| §58.3 | Failure-to-Learning 管线     | 🔴   |
| §58.4 | Replay & Simulation          | 🔴   |
| §58.6 | HarnessDecision 统一裁决协议 | 🟡   |

**当前差距与详细实施方案 — 优先级排序**:

#### VI-1: 无真实迭代循环 (P0)

**问题**: `HarnessRuntimeService.runLoop()` (index.ts:148-192) 为**单次执行**：创建 run → 追加 3 步 → 决策 1 次。无迭代、无 RequestEnvelope 入参、无重入。

**实施方案**:

**新建文件**: `src/platform/orchestration/harness/loop-controller.ts` (~120 行)

```typescript
import type {
  HarnessRun,
  HarnessDecisionAction,
  ConstraintPack,
} from "./index.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

export interface LoopGuards {
  readonly maxIterations: number; // 默认 10
  readonly maxReplans: number; // 默认 3
  readonly maxDurationMs: number; // 来自 ConstraintPack.budget
  readonly maxCost: number; // 来自 ConstraintPack.budget
}

export interface LoopState {
  iteration: number;
  replanCount: number;
  startedAt: number;
  totalCost: number;
}

export class HarnessLoopController {
  private state: LoopState;
  private readonly guards: LoopGuards;

  constructor(constraintPack: ConstraintPack);

  public shouldContinue(lastAction: HarnessDecisionAction): boolean;
  public recordIteration(cost: number): void;
  public recordReplan(): void;
  public getGuardViolation(): string | null;
  public getState(): Readonly<LoopState>;
}
```

**修改文件**: `src/platform/orchestration/harness/index.ts`

重写 `runLoop()` 为真正的迭代循环:

```typescript
public async runLoop(input: HarnessLoopInput): Promise<HarnessRun> {
  let run = this.createRun({ taskId, domainId, constraintPack });
  const loop = new HarnessLoopController(constraintPack);

  while (true) {
    // 1. Planner
    const planBundle = await this.invokePlanner(run, input);
    run = this.appendStep(run, { role: "planner", stage: "plan", ... });

    // 2. Generator
    const workProduct = await this.invokeGenerator(run, planBundle);
    run = this.appendStep(run, { role: "generator", stage: "execute", ... });

    // 3. Evaluator
    const evalReport = await this.invokeEvaluator(run, workProduct, planBundle);
    run = this.appendStep(run, { role: "evaluator", stage: "evaluate", ... });

    // 4. Decision
    const decision = this.decide({ evalReport, loop });
    run = this.appendStep(run, { role: "loop_controller", stage: "decision", ... });

    loop.recordIteration(evalReport.cost ?? 0);
    if (decision.action === "replan") loop.recordReplan();

    if (!loop.shouldContinue(decision.action)) break;
  }
  return run;
}
```

**测试**: `tests/unit/orchestration/harness/loop-controller.test.ts`

- 正常 accept 后终止
- retry 后重新执行同一 plan
- replan 后重新规划
- maxIterations 触发 abort
- maxReplans 触发 abort
- 时长超限触发 abort
- 成本超限触发 abort

**工时**: 3 人天
#### VI-2: 缺 PlanBundle/WorkProduct/EvaluationReport 核心数据契约 (P0)

**新建文件**: `src/platform/orchestration/harness/types/core-contracts.ts` (~100 行)

```typescript
import { z } from "zod";

export const PlanBundleSchema = z.object({
  goal: z.object({ raw: z.string(), structured: z.record(z.unknown()) }),
  task_graph: z.object({
    nodes: z.array(
      z.object({
        nodeId: z.string(),
        taskId: z.string(),
        dependsOn: z.array(z.string()),
      }),
    ),
  }),
  execution_budget: z.object({
    maxSteps: z.number(),
    maxDurationMs: z.number(),
    maxCost: z.number(),
  }),
  risk_profile: z.object({ level: z.string(), scores: z.record(z.number()) }),
  success_criteria: z.array(
    z.object({
      criterion: z.string(),
      metric: z.string(),
      threshold: z.number(),
    }),
  ),
  evaluator_hints: z.array(z.string()),
});
export type PlanBundle = z.infer<typeof PlanBundleSchema>;

export const WorkProductSchema = z.object({
  step_id: z.string(),
  artifacts: z.array(
    z.object({ artifactId: z.string(), type: z.string(), ref: z.string() }),
  ),
  observations: z.array(z.string()),
  result_summary: z.string(),
  telemetry: z.object({
    durationMs: z.number(),
    tokenCount: z.number(),
    toolCallCount: z.number(),
  }),
});
export type WorkProduct = z.infer<typeof WorkProductSchema>;

export const EvaluationReportSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
      location: z.string().optional(),
      description: z.string(),
    }),
  ),
  recommendation: z.enum(["accept", "retry", "replan", "escalate", "abort"]),
  confidence: z.number().min(0).max(1),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
```

**新建文件**: `src/platform/orchestration/harness/types/index.ts` (re-exports)

**集成点**: `HarnessRuntimeService` 的 `appendStep()` 使用这些类型替代 `Record<string, unknown>`

**测试**: `tests/unit/orchestration/harness/types/core-contracts.test.ts` — Zod schema 正反例校验

**工时**: 1 人天

#### VI-3: ConstraintPack 缺 risk_policy + output_policy (P0)

**修改文件**: `src/platform/orchestration/harness/index.ts`

扩展 `ConstraintPack` 接口 (line 14-26):

```typescript
export interface ConstraintPack {
  readonly policyIds: readonly string[];
  readonly approvalMode: "none" | "required" | "supervised";
  readonly autonomyMode:
    | "suggestion"
    | "supervised"
    | "semi_auto"
    | "full_auto"; // 对齐 §45.3
  readonly toolPolicy: {
    readonly allowedTools: readonly string[];
    readonly deniedTools?: readonly string[];
    readonly networkPolicy?: "allow" | "deny" | "restricted";
    readonly filesystemPolicy?: "readonly" | "readwrite" | "none";
  };
  readonly budget: {
    readonly maxSteps: number;
    readonly maxCost: number;
    readonly maxDurationMs: number;
  };
  readonly riskPolicy: {
    readonly maxRiskLevel: "low" | "medium" | "high" | "critical";
    readonly approvalRequiredAt: "high" | "critical";
  };
  readonly outputPolicy: {
    readonly requireEvidence: boolean;
    readonly requireEvaluation: boolean;
    readonly requireHumanReview: boolean;
  };
}
```

**新建文件**: `src/platform/orchestration/harness/constraint-engine.ts` (~80 行)

```typescript
import type { ConstraintPack } from "./index.js";

export interface ConstraintLayer {
  readonly source: "platform" | "tenant" | "domain" | "task";
  readonly constraints: Partial<ConstraintPack>;
}

export class ConstraintEngine {
  public merge(layers: readonly ConstraintLayer[]): ConstraintPack;
  // 优先级: task > domain > tenant > platform
  // 规则: 约束只能收紧不能放松 (取最严格值)
}
```

**测试**: 多层合并 + 约束只收紧不放松验证

**工时**: 2 人天

#### VI-4: Durable Harness 不存在 (P1)

**新建目录**: `src/platform/orchestration/harness/durable/`

**文件 1**: `durable/types.ts`

```typescript
import { z } from "zod";

export const PauseReasonSchema = z.enum([
  "waiting_for_human",
  "waiting_for_external_event",
  "waiting_for_budget_reset",
  "waiting_for_policy_clearance",
  "waiting_for_dependency",
]);
export type PauseReason = z.infer<typeof PauseReasonSchema>;

export const ResumeStrategySchema = z.enum([
  "resume_same_state",
  "resume_with_replan",
  "resume_supervised",
  "abort_on_resume",
]);
export type ResumeStrategy = z.infer<typeof ResumeStrategySchema>;

export interface DurableRunState {
  readonly runId: string;
  readonly pauseReason: PauseReason;
  readonly pausedAt: string;
  readonly contextSnapshotRef: string;
  readonly resumeStrategy?: ResumeStrategy;
}
```

**文件 2**: `durable/durable-harness-service.ts` (~100 行)

```typescript
import type { HarnessRun } from "../index.js";
import type { PauseReason, ResumeStrategy, DurableRunState } from "./types.js";
import { createCheckpointEnvelope } from "../../../state-evidence/checkpoints/checkpoint-envelope.js";

export class DurableHarnessService {
  public async pause(
    run: HarnessRun,
    reason: PauseReason,
  ): Promise<DurableRunState>;
  public async resume(
    state: DurableRunState,
    strategy: ResumeStrategy,
  ): Promise<HarnessRun>;
  public async checkpoint(run: HarnessRun): Promise<string>; // returns checkpointRef
  public async restoreFromCheckpoint(
    checkpointRef: string,
  ): Promise<HarnessRun>;
}
```

**集成点**: 复用 `CheckpointEnvelope` (checkpoint-envelope.ts) 和 `WorkflowStepCheckpoint` 基础设施

**工时**: 3 人天

#### VI-5: ContextAssembler + ContextSnapshot 不存在 (P1)

**新建目录**: `src/platform/orchestration/harness/context/`

**文件 1**: `context/types.ts`

```typescript
export interface ConversationContext {
  dialogueHistory: string[];
  userPreferences: Record<string, unknown>;
  nlRawInput: string;
}
export interface TaskContext {
  goal: string;
  stepStates: Record<string, unknown>[];
  executionPlan: Record<string, unknown>;
  completedReceipts: string[];
}
export interface MemoryContext {
  experiences: string[];
  agentBehaviorPatterns: Record<string, unknown>;
  longTermMemories: string[];
}
export interface KnowledgeContext {
  documents: string[];
  retrievalResults: Record<string, unknown>[];
  domainKnowledge: Record<string, unknown>;
}

export interface HarnessContext {
  readonly conversation: ConversationContext;
  readonly task: TaskContext;
  readonly memory: MemoryContext;
  readonly knowledge: KnowledgeContext;
}

export interface ContextSnapshot {
  readonly snapshotId: string;
  readonly runId: string;
  readonly iteration: number;
  readonly context: HarnessContext;
  readonly tokenBudgetUsed: number;
  readonly createdAt: string;
}
```

**文件 2**: `context/context-assembler.ts` (~100 行)

```typescript
import type { HarnessContext, ContextSnapshot } from "./types.js";

export class ContextAssembler {
  public assemble(sources: { conversation?: ...; task?: ...; memory?: ...; knowledge?: ...; }, tokenBudget: number): HarnessContext;
  public snapshot(runId: string, iteration: number, context: HarnessContext): ContextSnapshot;
  // 裁剪逻辑: relevance score → freshness score → trust score → token budget
}
```

**工时**: 3 人天

#### VI-6: RecoveryController 不存在 (P1)

**新建文件**: `src/platform/orchestration/harness/recovery-controller.ts` (~100 行)

```typescript
import type { HarnessRun } from "./index.js";
import type { DurableHarnessService } from "./durable/durable-harness-service.js";

export type FailureType = "worker_crash" | "llm_unavailable" | "tool_timeout" | "budget_exhausted" | "platform_panic";

export interface RecoveryStrategy {
  readonly failureType: FailureType;
  readonly action: "restore_checkpoint" | "fallback_provider" | "retry_or_replan" | "safe_terminate" | "serialize_and_wait";
}

export class RecoveryController {
  constructor(private readonly durableService: DurableHarnessService);

  public async handleFailure(run: HarnessRun, failure: FailureType): Promise<HarnessRun>;
  public getStrategy(failure: FailureType): RecoveryStrategy;
}
```

**集成点**:

- `worker_crash` → `DurableHarnessService.restoreFromCheckpoint()` + `ExecutionLeaseService` 重申请租约
- `llm_unavailable` → `ModelGateway` fallback chain
- `tool_timeout` → `HarnessLoopController` 决定 retry 或 replan
- `budget_exhausted` → 安全终止 + checkpoint
- `platform_panic` → `PlatformPanicService` 集成

**工时**: 3 人天
#### VI-7: ToolbeltAssembler 不存在 (P2)

**新建文件**: `src/platform/orchestration/harness/toolbelt-assembler.ts` (~100 行)

```typescript
import type { ConstraintPack } from "./index.js";

export interface ToolCapabilityProfile {
  readonly toolName: string;
  readonly successRate: number;
  readonly avgLatencyMs: number;
  readonly circuitBreakerState: "closed" | "half_open" | "open";
  readonly riskScore: number;
  readonly costPerCall: number;
  readonly readOnly: boolean;
}

export interface AssembledToolbelt {
  readonly tools: readonly ToolCapabilityProfile[];
  readonly assemblyTrace: readonly string[]; // 6 步过滤日志
}

export class ToolbeltAssembler {
  public assemble(
    domainTools: readonly string[],
    constraintPack: ConstraintPack,
    riskLevel: string,
    tenantBudget: number,
  ): AssembledToolbelt;
  // 6 步: 域工具→约束过滤→风险排除→预算排除→安全守卫→可靠性附着
}
```

**工时**: 2 人天

#### VI-8: Guardrails 5 层不存在 (P2)

**新建目录**: `src/platform/orchestration/harness/guardrails/`

**文件 1**: `guardrails/types.ts`

```typescript
export type GuardrailLayer =
  | "input"
  | "planning"
  | "tool"
  | "memory"
  | "output";
export type InterceptAction =
  | "reject"
  | "rewrite"
  | "downgrade"
  | "replan"
  | "escalate"
  | "intercept"
  | "filter"
  | "redact"
  | "annotate";

export interface GuardrailCheckResult {
  readonly layer: GuardrailLayer;
  readonly passed: boolean;
  readonly interceptAction?: InterceptAction;
  readonly reason?: string;
}
```

**文件 2**: `guardrails/guardrail-engine.ts` (~120 行)

```typescript
export class GuardrailEngine {
  public async checkInput(input: unknown): Promise<GuardrailCheckResult>;
  public async checkPlanOutput(plan: unknown): Promise<GuardrailCheckResult>;
  public async checkToolCall(
    toolName: string,
    args: unknown,
  ): Promise<GuardrailCheckResult>;
  public async checkMemoryWrite(
    key: string,
    value: unknown,
  ): Promise<GuardrailCheckResult>;
  public async checkOutput(output: unknown): Promise<GuardrailCheckResult>;
  public async checkAll(
    layer: GuardrailLayer,
    data: unknown,
  ): Promise<GuardrailCheckResult>;
}
```

**集成点**: `HarnessRuntimeService.runLoop()` 在每阶段前后调用对应层的 guardrail check

**工时**: 3 人天

#### VI-9: HITL Runtime 不存在 (P2)

**新建文件**: `src/platform/orchestration/harness/hitl-runtime.ts` (~120 行)

```typescript
import type { HarnessRun } from "./index.js";

export type HITLCapability =
  | "inspect"
  | "patch"
  | "override"
  | "takeover"
  | "resume";

export interface HITLAction {
  readonly capability: HITLCapability;
  readonly operatorId: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: string;
}

export class HITLRuntimeService {
  public inspect(run: HarnessRun): {
    plan: unknown;
    context: unknown;
    evalFindings: unknown;
    status: string;
  };
  public patch(run: HarnessRun, patches: Record<string, unknown>): HarnessRun;
  public override(
    run: HarnessRun,
    overrides: { recommendation?: string; mode?: string; budget?: number },
  ): HarnessRun;
  public takeover(run: HarnessRun, operatorId: string): HarnessRun;
  public resume(run: HarnessRun, strategy: string): HarnessRun;
}
```

**集成点**: 连接现有 `HitlApprovalOrchestrationService` 和 `HitlOperatorConsoleService`

**工时**: 3 人天

#### VI-10: FeedbackEnvelope 4 级反馈不存在 (P3)

**新建文件**: `src/platform/orchestration/harness/types/feedback-envelope.ts`

```typescript
import { z } from "zod";

export const FeedbackLevelSchema = z.enum([
  "step",
  "task",
  "workflow",
  "system",
]);
export const FeedbackEnvelopeSchema = z.object({
  feedbackId: z.string(),
  level: FeedbackLevelSchema,
  score: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
      description: z.string(),
    }),
  ),
  recommendations: z.array(z.string()),
  timestamp: z.string().datetime(),
});
export type FeedbackEnvelope = z.infer<typeof FeedbackEnvelopeSchema>;
```

**工时**: 1 人天

#### VI-11: Memory Namespace 3 层不存在 (P3)

**新建文件**: `src/platform/orchestration/harness/memory-manager.ts` (~80 行)

```typescript
import { MemoryPlaneService } from "../../state-evidence/memory/memory-plane-service.js";

export type MemoryNamespace = "working" | "long_term" | "shared";

export class HarnessMemoryManager {
  constructor(private readonly memoryPlane: MemoryPlaneService);

  public readWorking(runId: string): Promise<Record<string, unknown>>;
  public writeWorking(runId: string, key: string, value: unknown): Promise<void>;
  public promoteToLongTerm(runId: string, key: string): Promise<void>;
  public readShared(domainId: string, key: string): Promise<unknown>;
}
```

**集成点**: 连接现有 `MemoryPlaneService` 和 `MemoryPromotionEngine`

**工时**: 2 人天

#### VI-12: Async Harness 不存在 (P3)

**新建文件**: `src/platform/orchestration/harness/async-harness-service.ts` (~100 行)

```typescript
import type { HarnessRun, HarnessLoopInput } from "./index.js";
import type { DurableHarnessService } from "./durable/durable-harness-service.js";

export class AsyncHarnessService {
  constructor(
    private readonly runtime: HarnessRuntimeService,
    private readonly durable: DurableHarnessService,
  );

  public async createRun(input: HarnessLoopInput): Promise<string>; // returns runId
  public async pollStatus(runId: string): Promise<{ status: string; progress: number; currentStep: string }>;
  public async subscribeEvents(runId: string, callback: (event: unknown) => void): Promise<() => void>;
  public async inspectStep(runId: string, stepId: string): Promise<unknown>;
  public async interveneMidRun(runId: string, action: unknown): Promise<void>;
  public async replayAfterCompletion(runId: string): Promise<unknown>;
}
```

**工时**: 2 人天

#### VI-13: Evaluation Harness 不存在 (P3)

**新建目录**: `src/platform/orchestration/harness/evaluation/`

```typescript
// eval-run-service.ts
export class EvalRunService {
  public createEvalRun(
    mode: "runtime" | "pre_release" | "version_compare",
    taskSet: string[],
  ): Promise<string>;
  public getEvalResults(evalRunId: string): Promise<unknown>;
}

// task-outcome-grader.ts
export class TaskOutcomeGrader {
  public grade(
    successCriteria: unknown[],
    actualState: unknown,
  ): { passed: boolean; score: number };
}
```

**工时**: 2 人天

#### VI-14: Harness 可观测性 + Prompt 治理 + Failure-to-Learning + Replay (P4)

§58.1-§58.4 四个横切能力，在核心循环稳定后按需实现。每项 1-2 人天。

**工时**: 共 4-8 人天

#### VI-15: 10 项不变量强制 (P4)

**修改文件**: `src/platform/orchestration/harness/loop-controller.ts`

在 `HarnessLoopController` 中添加不变量断言方法:

```typescript
public assertInvariants(run: HarnessRun): { violations: string[] };
// 1. plannerOutput 非空 → 方可执行
// 2. generatorOutput 对应 evaluatorReport
// 3. 任何 retry/replan/escalate/abort 有 HarnessDecision
// 4. duration>60s 或 steps>3 → 自动 checkpoint
// 5-10. 参照 §45.21 逐条实现
```

**工时**: 1 人天

**Harness 总计预计工时**: ~30-35 人天
---

## Part VII — 组织治理（§46-§51）

### 总评: ✅ 对齐率 ~95%

| 节 | 设计要求 | 状态 | 关键证据 |
|----|----------|------|----------|
| §46 | 组织层次 (5 级 + OrgChart + ReportingChain + 变更事件) | ✅ | org-node + hierarchy/ 完整 |
| §47 | 审批路由 (策略模式 + OrgChart/金额/SoD 路由 + 委托 + 升级) | ✅ | route-engine/ 完整策略族 |
| §48 | SSO/SCIM (SAML + OIDC + SCIM 2.0 + GroupRoleMapping) | ✅ | scim-service 828 行 |
| §49 | 合规策略引擎 (Framework/Control + 部门绑定 + 继承不可放松) | ✅ | framework-catalog + inheritance |
| §50 | 知识域隔离 (Boundary + ChineseWall + Federator + 脱敏) | ✅ | knowledge-boundary/ 完整 |
| §51 | 分级治理委托 (10 种权限 + 5 种 Guardrail + 4 级角色) | ✅ | delegation-registry + scope-manager |

本层无当前阻断差距。

---

## Part VIII — 规模与生态（§52-§57）

### 总评: ✅ 对齐率 ~93%

| 节  | 设计要求                                                 | 状态 | 关键证据                                                    |
| --- | -------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| §52 | 多区域 (RegionConfig + CDC 复制 + 故障转移 + 数据驻留)   | ✅   | CDCReplicationService 341 行 + RegionHealthCheck 462 行     |
| §53 | 资源竞争 (FairScheduling + Quota hard/soft/burst + 抢占) | ✅   | fair-scheduling-service + quota-enforcer                    |
| §54 | SLA 引擎 (SlaTier + 违约 + 处罚 + 升级)                  | ✅   | tier-resolver + breach-detector + SlaOperationsService      |
| §55 | Agent 市场 (治理 + 目录 + Publisher + 定价 + 弃用)       | ✅   | marketplace-governance-service 788 行                       |
| §56 | 反馈管线 (9 种信号 + 6 种改进)                           | ✅   | feedback-improvement-service 157 行 + quality-grader 258 行 |
| §57 | 集成连接器 (Framework + 4 连接器)                        | ✅   | connector-framework-service + 4 连接器实例                  |

本层无当前阻断差距。

---

## Part IX — 运维成熟度（§59-§69）

### 总评: ✅ 对齐率 ~93%

| 节   | 设计要求                                                  | 状态 | 关键证据                                          |
| ---- | --------------------------------------------------------- | ---- | ------------------------------------------------- |
| §59  | 可解释性 (Pipeline + NL 解释 + CausalChain + Evidence)    | ✅   | explanation-pipeline-service 121 行               |
| §60  | 紧急制动 (PanicDirective + 4 FreezeMode + 分层传播)       | ✅   | platform-panic-service 完整                       |
| §61  | 漂移检测 (EvolutionMvp + Fingerprint + Changepoint)       | ✅   | evolution-mvp-service 645 行                      |
| §62  | 工作流调试器 (时间旅行 + Breakpoint + RunComparison)      | ✅   | time-travel-debug-service 214 行                  |
| §63  | 边缘运行时 (EdgeSync + Executor + Orchestrator)           | ✅   | edge-runtime-sync-service 143 行                  |
| §64  | Agent 生命周期 (版本化 + 金丝雀 + 退役 + SemVer)          | ✅   | agent-lifecycle-service 311 行                    |
| §65  | 成本优化器 (推荐引擎 + 模拟器)                            | ✅   | cost-optimization-service 117 行                  |
| §66  | 混沌工程 (6 种注入 + GameDay)                             | ✅   | chaos-experiment-scheduler 184 行                 |
| §67  | 合规报告器 (Pipeline + 证据缺口)                          | ✅   | compliance-report-pipeline-service 132 行         |
| §68  | 容量规划器 (预测 + 趋势)                                  | ✅   | capacity-planning-service 162 行                  |
| §68B | 多模态 (Video/Image/Speech/Document)                      | ✅   | multimodal-gateway-service 187 行                 |
| §69  | 平台运维 Agent (HealthMonitor + IncidentDiagnoser + 自愈) | ✅   | platform-ops-agent-service + self-healing-service |

**当前差距与详细实施方案**:

#### IX-1: ops-maturity 叶子工具去桩已完成 (P3 已收口)

**现状**: `platform-ops-agent/`、`capacity-planner/`、`compliance-reporter/` 已从薄函数提升为正式 service 组合，当前包含 `OpsCapacityPredictorService`、`ConfigOptimizerService`、`DeveloperAssistantService`、`OpsHealthMonitorService`、`IncidentDiagnoserService`、`CapacityForecasterService`、`CapacityScenarioSimulatorService`、`CapacityTrendAnalyzerService`、`EvidenceMapperService`、`ComplianceTemplateRegistryService`、`ComplianceReportRendererService`，并已接回上层主链。

**验证**: `build:test` 与定向 `ops-maturity` 单测/集成回归通过，IX-1 不再保留为仓内待开发缺口。

**备注**: 后续仍可继续增强 provider 丰富度和报表模板生态，但这属于能力深化，不再属于“叶子工具仍为桩”的问题。
---

## Part X — 实施路线图（§33-§36 + 三环）

### 总评: 🟡 路线图跟踪框架存在但内容不匹配 v3.3

| 节 | 设计要求 | 状态 |
|----|----------|------|
| §33 | 9 期路线图 (Phase 1-9f) | 🟡 |
| §34 | 105 个 ADR 合规 | 🟡 |
| §35 | 推荐目录结构 | 🟡 |
| §36 | 28 项风险登记 + 32 项硬约束 | ✅ |

**当前差距与详细实施方案**:

#### X-1: RoadmapService 的 Phase 8/9 注册已实现 (已关闭)

`src/domains/roadmap/roadmap-service.ts` 已补齐 `phase8a/8b/8c/9a-9f` 的架构模板注册，`SuccessCriteriaService` 与 `PhaseDeliveryService` 也已同步更新到新阶段模型，并已有定向测试保护。

#### X-2: 缺失 ADR 文件已补齐 (已关闭)

`docs_zh/adr/` 与 `docs_en/adr/` 已新增 `091-108`：

- 9 个 Harness / 八支柱 ADR
- 9 个 Domain / 领域治理 ADR

同时 ADR README 索引已同步更新，不再保留“文件不存在但 review 仍列为缺口”的状态。

#### X-3: harness/ 目录结构已对齐到 canonical 子目录 (大部分关闭)

`src/platform/orchestration/harness/` 已补齐 runtime / protocol / planner / generator / evaluator / eval-harness / loop / context / memory-namespace / constraints / guardrails / toolbelt / hitl-runtime / durable / types 等 canonical 子目录导出入口。

仍保留的后续工作仅限“把更多实现从根级文件进一步内聚到这些子目录”，不再是“目录结构缺失”问题。

**工时**: 0.5 人天 (结构创建) + 随各 VI-* 项自然产生

---

## Part XI — 结论 & 附录（§70, 附录 G/A）

§70 结论、附录 G 术语表、附录 A 版本日志 — 文档层面产物，无代码实现要求。

---

## 全局差距汇总

### 按严重性排序

| 优先级 | 差距数 | 核心问题                                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0** | 4      | Harness 无迭代循环 (VI-1), Agent 协作协议未实现 (II-1), 领域元模型未实现 (III-1), 12 域 ID 不匹配 (IV-1)                                                                                   |
| **P1** | 8      | Harness 核心数据契约 (VI-2/3), Durable Harness (VI-4), ContextAssembler (VI-5), RecoveryController (VI-6), 23 域缺 config (IV-2), 24 域缺特化工作流 (IV-3), DomainRecipe 缺 8 原型 (III-2) |
| **P2** | 10     | Harness 子系统 (VI-7/8/9), 域风险/评估/延迟/Division (IV-4/5/6/7), 路线图/ADR/目录 (X-1/2/3), OAPEFLIR 映射 (I-2), ModelGateway embed() (II-2)                                             |
| **P3** | 5      | Harness 反馈/记忆/异步/评估 (VI-10/11/12/13), LLM 扩展 (II-3), ops-maturity 桩率 (IX-1)                                                                                                    |
| **P4** | 2      | Harness 横切 (VI-14), 不变量强制 (VI-15)                                                                                                                                                   |
### 按工作量估算

| 领域                   | 预计工时         | 说明                                    |
| ---------------------- | ---------------- | --------------------------------------- |
| Harness 八柱 (§45/§58) | 30-35 人天       | 最大单项投入                            |
| Agent 协作协议 (§19.5) | 3-5 人天         | 8 消息类型 + 7 不变量                   |
| 领域元模型 (§37.11)    | 2-3 人天         | 12 问模板 + 24 域矩阵                   |
| 12 域 ID 对齐          | 0.5 人天         | 修改 baseline-catalog 中 12 个 domainId |
| 5 关键域特化 config    | 2.5 人天         | critical 级域优先                       |
| DomainRecipe 8 原型    | 2 人天           | 8 种新原型定义                          |
| 24 域完整特化          | 48-72 人天       | 每域 2-3 人天 (Phase 9 范围)            |
| ADR 补齐               | 3-4 人天         | 18 个缺失 ADR                           |
| **总计**               | **~95-125 人天** |                                         |

### 新建文件清单（实施方案汇总）

| 差距 # | 新建文件/目录                                                                              | 预估行数 |
| ------ | ------------------------------------------------------------------------------------------ | -------- |
| I-2    | `src/platform/orchestration/harness/oapeflir-harness-mapping.ts`                           | ~40      |
| II-1   | `src/platform/orchestration/agent-delegation/collaboration-protocol/types.ts`              | ~80      |
| II-1   | `src/platform/orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.ts` | ~100     |
| II-1   | `src/platform/orchestration/agent-delegation/collaboration-protocol/protocol-service.ts`   | ~120     |
| II-1   | `src/platform/orchestration/agent-delegation/collaboration-protocol/index.ts`              | ~15      |
| III-1  | `src/domains/canonical-meta-model/types.ts`                                                | ~90      |
| III-1  | `src/domains/canonical-meta-model/meta-model-validator.ts`                                 | ~60      |
| III-1  | `src/domains/canonical-meta-model/meta-model-seeder.ts`                                    | ~150     |
| III-1  | `src/domains/canonical-meta-model/index.ts`                                                | ~10      |
| VI-1   | `src/platform/orchestration/harness/loop-controller.ts`                                    | ~120     |
| VI-2   | `src/platform/orchestration/harness/types/core-contracts.ts`                               | ~100     |
| VI-2   | `src/platform/orchestration/harness/types/index.ts`                                        | ~10      |
| VI-3   | `src/platform/orchestration/harness/constraint-engine.ts`                                  | ~80      |
| VI-4   | `src/platform/orchestration/harness/durable/types.ts`                                      | ~40      |
| VI-4   | `src/platform/orchestration/harness/durable/durable-harness-service.ts`                    | ~100     |
| VI-5   | `src/platform/orchestration/harness/context/types.ts`                                      | ~50      |
| VI-5   | `src/platform/orchestration/harness/context/context-assembler.ts`                          | ~100     |
| VI-6   | `src/platform/orchestration/harness/recovery-controller.ts`                                | ~100     |
| VI-7   | `src/platform/orchestration/harness/toolbelt-assembler.ts`                                 | ~100     |
| VI-8   | `src/platform/orchestration/harness/guardrails/types.ts`                                   | ~30      |
| VI-8   | `src/platform/orchestration/harness/guardrails/guardrail-engine.ts`                        | ~120     |
| VI-9   | `src/platform/orchestration/harness/hitl-runtime.ts`                                       | ~120     |
| VI-10  | `src/platform/orchestration/harness/types/feedback-envelope.ts`                            | ~30      |
| VI-11  | `src/platform/orchestration/harness/memory-manager.ts`                                     | ~80      |
| VI-12  | `src/platform/orchestration/harness/async-harness-service.ts`                              | ~100     |
| VI-13  | `src/platform/orchestration/harness/evaluation/eval-run-service.ts`                        | ~60      |
| VI-13  | `src/platform/orchestration/harness/evaluation/task-outcome-grader.ts`                     | ~50      |

### 修改文件清单（实施方案汇总）

| 差距 # | 修改文件                                                            | 修改内容                                    |
| ------ | ------------------------------------------------------------------- | ------------------------------------------- |
| II-1   | `src/platform/orchestration/agent-delegation/index.ts`              | 取消注释，改导出 collaboration-protocol     |
| II-2   | `src/platform/ai-operations/model-gateway/unified-chat-provider.ts` | 新增 embed()/complete()                     |
| III-2  | `src/domains/domain-recipe-service.ts`                              | prototypeTemplates 追加 8 原型              |
| IV-1   | `src/domains/domain-baseline-catalog.ts`                            | 12 个 domainId 重命名                       |
| VI-1   | `src/platform/orchestration/harness/index.ts`                       | runLoop() 重写为迭代循环                    |
| VI-3   | `src/platform/orchestration/harness/index.ts`                       | ConstraintPack 扩展 riskPolicy+outputPolicy |

### 当前代码库已实现能力总结

| 指标               | 数值           |
| ------------------ | -------------- |
| 设计节数 (v3.3)    | 94 节 + 2 附录 |
| 已实现 (✅)        | ~65 节 (69%)   |
| 部分实现 (🟡)      | ~5 节 (5%)     |
| 未实现/桩 (🔴)     | ~24 节 (26%)   |
| 已实现 ADR         | ~87/105 (83%)  |
| 三环 Ring 1 完成度 | ~70%           |
| 三环 Ring 2 完成度 | ~40%           |
| 三环 Ring 3 完成度 | ~15%           |

### 下一步建议实施顺序

1. **立即 (Week 1)**: 修复 12 域 ID 不匹配 (IV-1) + 补齐 ConstraintPack (VI-3)
2. **短期 (Week 2-3)**: 实现 Harness 迭代循环 (VI-1) + 核心数据契约 (VI-2)
3. **中期 (Week 4-6)**: Durable Harness (VI-4) + ContextAssembler (VI-5) + RecoveryController (VI-6) + Agent 协作协议 (II-1)
4. **中期 (Week 7-9)**: 领域元模型 (III-1) + DomainRecipe 8 原型 (III-2) + 5 关键域特化 (IV-2)
5. **长期 (Week 10+)**: Harness 子系统 (VI-7~15) + 全部 24 域特化 (Phase 9)

---

> **报告版本**: v6.0 — 含详细实施方案（文件级、函数签名级）
> **评审范围**: ~1,335 源文件 / 94 架构章节 / 105 ADR / ~230 项设计要求
> **关键发现**: 基础设施层高度对齐；主要差距集中在 Harness 八柱运行时 (~30 人天) 和 24 垂直域特化 (~50-70 人天)
> **新增内容 (vs v5.0)**: 29 个差距每项包含新建文件路径、接口/Zod Schema 定义、服务类骨架、集成点、测试位置、工时估算
> **审查日期**: 2026-04-22
