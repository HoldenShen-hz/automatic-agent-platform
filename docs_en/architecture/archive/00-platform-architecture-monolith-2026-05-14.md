# <企业级 Agent 平台总体技术架构设计文档>

> **文档版本**: v4.3
> **文档state**: 已归档历史版本 (非当前权威源) 
> **文档定位**: 企业级 / 平台级 Agent System 总体技术架构设计文档 (稳定性优先 · AI 运营完备 · 业务域接入完备 · 垂直业务域深化完备 (24 域)  · 统一领域元模型 · 多 Agent 协作协议 · 智能交互完备 · 组织治理完备 · 规模化生态完备 · 运营成熟度完备 · Harness 权威runtime · OAPEFLIR 受控认知框架 · 最小生产闭环 · 三环实施优先级 · 落地导向版) 
> **适用对象**: 架构委员会, 平台研发团队, Runtime 团队, SRE, 安全团队, 治理团队, 业务域接入团队, AI/ML 工程团队, 业务线负责人, 非技术业务操作者, 组织manage层, 合规/审计团队, 生态合作伙伴, 边缘/现场ops团队, **垂直业务域架构师 (量化交易·电商·广告·金融·data·代码·运营·行业调研·学术调研·知识库·财务·法务·在线直播·广告素材·游戏开发·游戏上架·人力资源·供应链·医疗健康·教育培训·客户服务·content审核·ITops·市场营销) **
> **设计目标**: 构建一套以稳定性, risk控制, 安全可靠, 异常handle为第一principle的企业级 Agent 平台, 使 Agent 作为高riskauto化单元在企业环境中可控, 可恢复, 可审计地长期运行; 同时具备完整的 AI 运营能力 (LLM 抽象, Prompt 治理, 模型质量, 成本管控) , 确保平台在 AI 层面同样可控, 可演进; 提供结构化的业务域建模与接入框架; 构建面向非技术user的智能交互层; 建立完整的组织治理体系和规模化运行生态层; 补齐运营成熟度层; **并以 HarnessRuntime 作为唯一可executeruntime, 将 OAPEFLIR 收敛为受控认知与治理框架, 使 Agent 从"一次性模型call"升级为"受约束, graphplan, 可恢复, 可审计, 可ops"的生产级system**
> **v4.3 版本定位**: 规格固化版. 本版本收敛权威对象, MVP 物理边界, runtimenaming和可testing invariant; 历史 v4.1 与 OAPEFLIR v4.4 Executable Spec only作为迁移输入. implementation优先级以 §33 MVP / Hardening / Enterprise 三环为准. HarnessRuntime 是唯一可executeentry, HarnessRun 是唯一权威 Run, PlanGraphBundle 是 P3 → P4 的 canonical execution contract, OAPEFLIR 阶段只作为 StageRationale / TraceProjection / Audit View; defaultuses Trace Replay, 不假设 LLM 可确定性replay. 

> **权威源模型**: Executable Runtime Contract, Schema / Zod / OpenAPI / Event Registry 是机器验收权威; 本文档是人类架构权威; ADR 是变更裁决权威. 若机器contract与本文档conflict, 必须via同一 PR/ADR 修正文档或 schema, 不allowsimplementationsilentlycoverage; 安全, risk, 合规与data保护类conflict在不改变权威对象归属的前提下以更严格者为准. 

---

## 归档说明 (2026-05-26) 

1. 本文档已转入 `docs_zh/architecture/archive/`, 保留其历史设计语义, 章节编号和迁移背景, 不再作为当前system的唯一上位设计源. 
2. 当前权威架构文档请优先阅读: 
   - [00-platform-architecture.md](../00-platform-architecture.md)
   - [01-code-structure.md](../01-code-structure.md)
   - [03-module-diagrams.md](../03-module-diagrams.md)
   - [04-runtime-sequence.md](../04-runtime-sequence.md)
   - [05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md)
3. 本文档与当前implementation如有conflict, 以当前权威文档, 机器contract, OpenAPI, Schema, Review 回写为准. 

### 与当前implementation的关键差异提示

| 主题 | 本归档文档中的历史口径 | 当前system口径 |
|---|---|---|
| 架构权威源 | 本文档作为“总体技术架构设计文档”directly承载顶层权威 | 当前唯一上位设计源是 [00-platform-architecture.md](../00-platform-architecture.md), 本fileonly保留为历史归档 |
| UI 公共query层 | 历史上allowsvia `/api/v1/admin/workers`, `/api/v1/admin/*` 表达partialmanage面能力 | 当前公共 UI contract已收敛到 Layer C 的 `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/dashboard/metrics` 等entry |
| 前端 API path体系 | 历史正文multiple places以 `/api/v1/*` directly描述前后端interface | 当前前端runtimedefault `baseUrl=/api`, endpoint catalog 统一为 `/v1/*`, 拼接后形成 `/api/v1/*` |
| 联邦治理persistence | 归档版本中的联邦审计, trust relationship 更偏规格承诺 | 当前implementation已经补齐 `FederationAudit`, `TrustRelationship` 的persistence, 恢复, 归档与strategy enforce |
| 事件reliability | 归档版本强调 Tier-1 事件reliability与failure可见性 | 当前implementation已修复 `DurableEventBusAsync` 吞掉异步failure的问题, failure重新回到主链handle |
| Electron 平台桥 | 归档期未固化桌面桥接naming差异 | 当前implementation已统一 `AA_ELECTRON` / `__AA_ELECTRON__` 桥接compatibility层 |

### 当前implementation证据entry

1. system级审查与修复回写: [system-review-2026-05-26.md](../../reviews/system-review-2026-05-26.md)
2. 当前架构目录index: [README.md](../README.md)
3. 当前公共 API 与路由导出面: `src/platform/five-plane-interface/api/http-server/`, `src/platform/five-plane-interface/api/openapi-document.ts`

---

# 目录

> 本文档按**十层架构**组织为 11 个 Part, 章节编号保持稳定以compatibility历史references. 

**前言 (§1-§3) **

1. [文档概述](#1-文档概述)
2. [平台根假设与设计目标](#2-平台根假设与设计目标)
3. [平台定义与非目标](#3-平台定义与非目标)

**Part I — 基础设施层 (§4-§14, §24-§32) ** 4. [总体架构: 五平面 + 一横切控制织网](#4-总体架构五平面--一横切控制织网) 5. [平面间通信contract](#5-平面间通信contract) 6. [API contract与版本化架构](#6-api-contract与版本化架构) 7. [服务通信架构](#7-服务通信架构) 8. [可扩展性架构](#8-可扩展性架构) 9. [稳定性架构](#9-稳定性架构) 10. [risk控制架构](#10-risk控制架构) 11. [安全可靠架构](#11-安全可靠架构) 12. [异常事件handle架构](#12-异常事件handle架构) 13. [OAPEFLIR 受控认知框架](#13-oapeflir-受控认知框架) 14. [Runtime Execution Plane](#14-runtime-execution-plane) 24. [configure治理架构](#24-configure治理架构) 25. [data与state一致性架构](#25-data与state一致性架构) 26. [存储架构](#26-存储架构) 27. [性能架构与 SLO](#27-性能架构与-slo) 28. [Event Registry / Projection / Incident / DLQ 模型](#28-event-registry--projection--incident--dlq-模型) 29. [Knowledge / Memory / Artifact / Learning 边界](#29-knowledge--memory--artifact--learning-边界) 30. [业务接入约束与 Business Pack 模型](#30-业务接入约束与-business-pack-模型) 31. [容灾与高可用架构](#31-容灾与高可用架构) 32. [部署架构](#32-部署架构)

**Part II — AI 运营层 (§15-§23) ** 15. [LLM Provider 抽象与故障切换架构](#15-llm-provider-抽象与故障切换架构) 16. [Prompt manage与版本化架构](#16-prompt-manage与版本化架构) 17. [模型评估与质量门禁架构](#17-模型评估与质量门禁架构) 18. [成本manage与 Token 计量架构](#18-成本manage与-token-计量架构) 19. [Agent 间委托与协作架构](#19-agent-间委托与协作架构) 20. [长时task与 Workflow 休眠架构](#20-长时task与-workflow-休眠架构) 21. [人机协作模式架构](#21-人机协作模式架构) 22. [SDK 与开发者体验架构](#22-sdk-与开发者体验架构) 23. [合规与data治理架构](#23-合规与data治理架构)

**Part III — 业务域接入层 (§37-§38) ** 37. [业务域建模与接入架构](#37-业务域建模与接入架构) 38. [业务域接入 Runbook](#38-业务域接入-runbook)

**Part IV — 垂直业务域深化层 (§71-§94) ** 71. [量化交易域架构](#71-量化交易域架构) 72. [电商域架构](#72-电商域架构) 73. [广告推广域架构](#73-广告推广域架构) 74. [金融服务域架构](#74-金融服务域架构) 75. [datahandle域架构](#75-datahandle域架构) 76. [代码开发域架构](#76-代码开发域架构) 77. [user运营域架构](#77-user运营域架构) 78. [行业调研域架构](#78-行业调研域架构) 79. [学术调研域架构](#79-学术调研域架构) 80. [企业知识库域架构](#80-企业知识库域架构) 81. [财务域架构](#81-财务域架构) 82. [法务域架构](#82-法务域架构) 83. [在线直播域架构](#83-在线直播域架构) 84. [广告素材制作域架构](#84-广告素材制作域架构) 85. [游戏开发域架构](#85-游戏开发域架构) 86. [游戏上架域架构](#86-游戏上架域架构) 87. [人力资源域架构](#87-人力资源域架构) 88. [供应链与物流域架构](#88-供应链与物流域架构) 89. [医疗健康域架构](#89-医疗健康域架构) 90. [教育培训域架构](#90-教育培训域架构) 91. [客户服务域架构](#91-客户服务域架构) 92. [content审核与安全域架构](#92-content审核与安全域架构) 93. [IT ops SRE/DevOps 域架构](#93-it-ops-sredevops-域架构) 94. [市场营销与品牌域架构](#94-市场营销与品牌域架构)

**Part V — 智能交互层 (§39-§44) ** 39. [自然语言taskentry架构](#39-自然语言taskentry架构) 40. [目标分解引擎架构](#40-目标分解引擎架构) 41. [主动式 Agent 框架](#41-主动式-agent-框架) 42. [渐进式自主权模型](#42-渐进式自主权模型) 43. [统一运营看板架构](#43-统一运营看板架构) 44. [非技术user体验架构](#44-非技术user体验架构)

**Part VI — Harness 权威runtime与八支柱深化层 (§45, §58) ** 45. [Harness Runtime 权威execute模型](#45-harness-runtime-权威execute模型) 58. [Harness 横切关注面](#58-harness-横切关注面)

**Part VII — 组织治理层 (§46-§51) ** 46. [组织层次模型](#46-组织层次模型) 47. [组织架构审批路由](#47-组织架构审批路由) 48. [企业 SSO/SCIM 集成架构](#48-企业-ssoscim-集成架构) 49. [分部门合规strategy引擎](#49-分部门合规strategy引擎) 50. [知识域隔离与受控shared](#50-知识域隔离与受控shared) 51. [分级治理委托](#51-分级治理委托)

**Part VIII — 规模化运行层与生态层 (§52-§57) ** 52. [多 Region 部署架构](#52-多-region-部署架构) 53. [规模化资源竞争manage](#53-规模化资源竞争manage) 54. [SLA 分级保障](#54-sla-分级保障) 55. [Agent 市场与生态](#55-agent-市场与生态) 56. [反馈驱动持续改进管线](#56-反馈驱动持续改进管线) 57. [外部system集成框架](#57-外部system集成框架)

**Part IX — 运营成熟度层 (§59-§69) ** 59. [Agent 可解释性与决策透明度架构](#59-agent-可解释性与决策透明度架构) 60. [紧急制动与globally熔断架构](#60-紧急制动与globally熔断架构) 61. [Agent 统一生命周期manage架构](#61-agent-统一生命周期manage架构) 62. [离线与边缘部署架构](#62-离线与边缘部署架构) 63. [Agent 行为drift检测架构](#63-agent-行为drift检测架构) 64. [成本归因与优化引擎](#64-成本归因与优化引擎) 65. [工作流可视化调试器架构](#65-工作流可视化调试器架构) 66. [合规报告auto生成引擎](#66-合规报告auto生成引擎) 67. [容量规划与成本预测引擎](#67-容量规划与成本预测引擎) 68. [多模态能力架构](#68-多模态能力架构) 69. [平台自ops Agent 架构](#69-平台自ops-agent-架构)

**Part X — 落地路线与汇总 (§33-§36) ** 33. [分阶段落地路线](#33-分阶段落地路线) 34. [ADR 冻结建议](#34-adr-冻结建议) 35. [推荐代码目录](#35-推荐代码目录) 36. [risk, 约束与success标准](#36-risk约束与success标准)

**Part XI — 结论与附录** 70. [结论](#70-结论)
[附录 G: 术语表与缩写index](#附录-g术语表与缩写index)
[附录 H: OAPEFLIR v4.4 Executable Spec 与 v4.2 收敛规则](#附录-hoapeflir-v44-executable-spec-与-v42-收敛规则)
[附录 A: 版本变更历史](#附录-a版本变更历史)

---

# 全书主骨架总览

本节以五张graph概括整份架构文档的核心结构, 读者可先建立globally画面再按需deeply. 

### graph 1 — static架构 (五平面 + 跨切面) 

```text
┌─────────────────────────────────────────────────────────┐
│                   P1  Interface Plane                    │  §5-§7, §39, §44
├─────────────────────────────────────────────────────────┤
│                   P2  Control Plane                      │  §10, §12, §24, §46-§51, §60
├─────────────────────────────────────────────────────────┤
│         P3  Orchestration Plane (Harness Runtime)        │  §13, §19-§21, §40-§42, §45, §58
├─────────────────────────────────────────────────────────┤
│                   P4  Execution Plane                    │  §14, §45, §57
├─────────────────────────────────────────────────────────┤
│                   P5  Evidence Plane                     │  §25-§29
├─────────────────────────────────────────────────────────┤
│  X1 Reliability Fabric (跨五平面: 重试/熔断/隔离/审计)   │  §9-§12, §31-§32, §52, §60
└─────────────────────────────────────────────────────────┘
```

### graph 2 — runtime主链 (一次task的典型path) 

```text
Request
  ─→ ConstraintPack
  ─→ Observe / Assess
  ─→ PlanGraph
  ─→ Deterministic Graph Scheduler
  ─→ Node Execution Runtime
  ─→ SideEffect Manager / HITL / Reconciliation
  ─→ Evaluator
  ─→ HarnessDecision
  ─→ Result + Evidence
```

### graph 3 — 治理闭环 (持续改进循环) 

```text
Run ──→ Evidence ──→ Feedback ──→ Learn/Drift-Detect
 ↑                                        │
 └── Release ← Improve ← Evaluation ←────┘
```

### graph 4 — 演进路线 (Phase 总览, 详见 §33) 

```text
Ring 1 MVP Slice (8-12w)
  HarnessRuntime entry · PlanGraphBundle · NodeRun · BudgetReservation
  SideEffectManager · HITL basic · Trace Replay · CLI inspect
        │
        ▼
Ring 2 Hardening (3-6m)
  Recovery · Projection rebuild · Incident/DLQ · Config governance
  Org approval · Prompt/Eval rollout · Domain pilots
        │
        ▼
Ring 3 Enterprise (6-18m)
  Multi-region · Marketplace · Edge · Advanced domains

旧 Phase 1-9 only作为历史排期映射; Phase 8a-8d 已拆入 Ring 1/2 交付包. 
```

### graph 5 — HarnessRuntime + OAPEFLIR 语义投影

```text
RequestEnvelope
   │
   ▼
HarnessRun admitted
   │
   ▼
OAPEFLIR StageRationale: Observe ─→ Assess ─→ PlanGraph
                                      │
                                      ▼
                         Graph Normalize / Validate / Risk Propagate
                                      │
                                      ▼
                           Deterministic Graph Scheduler
                                      │
                                      ▼
                               Node Execution
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
              Tool / LLM          HITL Wait          Subgraph
                  │                   │                   │
                  ▼                   ▼                   ▼
            SideEffect Manager   HumanDecision       Child HarnessRun
                  │
                  ▼
         Confirm / Reconcile / Compensate
                  │
                  ▼
              Evaluator
                  │
       accept / retry / replan / escalate / abort
                  │
                  ▼
          Feedback → Learn → Improve → Release
```

---

# 1. 文档概述

## 1.1 背景

企业对 Agent 的期望, 已经从"问答system"演进为"能接system, 能跑流程, 能做execute, 能被治理, 能被审计, 能持续演进"的智能auto化平台. 

但大多数 Agent system在工程上仍exists明显短板: 

- default相信模型output
- default工具call会success
- default外部system可用
- default workflow 只要编排好就能跑
- default异常只需logrecord
- default上线后行为可accepts

这些假设在企业生产环境中都不成立. 

企业级 Agent 平台首先面对的不是"能力不够强", 而是"失控risk太高". 
因此, 本版架构把以下问题前置为主设计对象: 

- system如何在failure时不失控
- 高risk动作如何被识别并收敛
- 外部dependency异常时如何降级
- worker crashed后如何恢复
- side effect 如何被控制与追责
- 发布failure如何rollback
- projection 偏差如何重建
- 审批延迟时system如何安全停住

## 1.2 文档目标

- 定义稳定性优先的企业级 Agent 平台总体架构
- 建立以"default不可信, default会failure"为前提的设计principle
- 将稳定性, risk, 安全, 异常handle提升为平台一级主架构
- 明确五平面 + 横切织网的system结构, **并定义平面间的正式interface协议**
- 重构 Runtime 为可恢复, 可降级, 可审计的受控executesystem
- **给出可落地的渐进式演进path**, 而不是一步到位的理想态
- 为subsequent详细设计, Schema, ADR, implementation分阶段落地提供基线

## 1.3 非目标

- 单个业务 Agent 的 prompt details
- 单个插件或 adapter 的interfaceimplementation说明
- UI 交互视觉稿
- 某个模型供应商专项接入implementation
- 某个业务域完整领域模型
- 基础设施物理拓扑和采购方案

## 1.4 implementation边界声明

本文档描述目标态架构, 但 v4.2 的implementation边界以 §33 Ring 1 / MVP Slice 为准. 未进入 MVP Slice 的章节只作为compatibility性设计和演进预留, 不得blocks HarnessRuntime, PlanGraphBundle, NodeRun, BudgetReservation, SideEffectManager, HITL basic, Trace Replay 与 Evidence 闭环交付. 

文档split目标: 当前 `00-platform-architecture.md` 作为主index和人类架构权威; subsequent权威content应收敛为 `00-core-architecture.md`, `01-runtime-executable-contract.md`, `02-state-event-evidence.md`, `03-ai-ops-governance.md`, `04-domain-framework.md`, `05-enterprise-operations.md` 六份文档. split完成前, 本file保留稳定章节号和迁移index. 

正文能力default标注为四类成熟度之一: 

| 标签 | 含义 |
| --- | --- |
| MVP | Ring 1 必须交付, missing则平台不可投产 |
| Hardening | Ring 2 完成, used for生产reliability和企业治理 |
| Enterprise | Ring 3 完成, used for规模化, 多域和多 Region |
| Future | 目标态预留, 不作为当前implementation承诺 |

## 1.5 v4.3 Contract Freeze Scope

v4.3 冻结不再新增平台能力, 只冻结implementation团队必须共同遵守的最小可executecontract. 以下contract必须具备 Zod/JSON Schema, state机, 事件清单, Repository API, contract test, replay behavior 和 failure behavior; missing任一项不得进入implementation冻结. 

| 冻结contract | 权威章节 |
| --- | --- |
| TaskDraft / ConfirmedTaskSpec / RequestEnvelope | §5 / §6 / §39 |
| HarnessRun | §5 / §25 / §45 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | §5 / §13 / §45 |
| GraphPatch / GraphPatchOperation | §13 / §58 |
| NodeRun / NodeAttempt / AttemptLineage | §14 / §25 |
| NodeAttemptReceipt | §5 / §14 / §45 |
| SideEffectRecord / ReconciliationRecord / CompensationRecord | §14 / §25 / §57 |
| BudgetLedger / BudgetReservation / BudgetSettlement | §18 / §25 / §26 |
| RunVersionLock / ArtifactVersionLockSet | §20 / §25 / §29 |
| DecisionInputBundle / HarnessDecision | §45 / §58 |
| HumanResponsibilityRecord | §21 / §45 / §47 |
| EventEnvelope / PlatformFactEvent / OapeflirViewEvent | §28 / §58 |

---

# 2. 平台根假设与设计目标

## 2.1 平台根假设

本平台default假设以下情况都会发生: 

- agent 会犯错
- 工具会failure
- 外部system会timeout
- worker 会crashed
- 模型会产生erroroutput
- configure会配错
- 审批会延迟
- 事件会duplicate
- 投影会落后
- 发布会rollback

因此平台必须围绕一句话设计: 

> **default不可信, default会failure, default要可控, 可恢复, 可审计. **

## 2.2 平台设计宪法

### default不可信

- 模型output不可信
- 插件不可信
- 外部dependency不可信
- 输入不可信
- 知识可能expiry
- 学习结果可能带噪声

### default会failure

- 远程call会timeout
- worker 会丢心跳
- event fanout 会failure
- projection 会延迟
- rollout 会failure
- repair / replay 也可能failure

### default收敛

未被明确allows的动作default进入保守path: deny / degrade / require approval / supervised / no-write / no-external-call / manual-only. 

### 先可恢复, 再auto化

没有 replay / repair / rebuild / rollback 能力的auto化, 不应进入关键流程. 

### state与证据同等重要

平台不only要"做成", 还要record: 谁触发, 为什么execute, 用了什么上下文, call了什么system, 产生了什么副作用, failure后如何恢复. 

## 2.3 八个硬目标

1. **稳定运行**: 即使partial组件failure, 平台也不能整体失控
2. **risk隔离**: 高risk动作必须被识别, 分级, 隔离, 审批, 可rollback
3. **安全default收敛**: 不明确allows的能力default禁止, 不做 fail-open
4. **异常可恢复**: 重要链路中断后, 要么恢复继续, 要么安全终止, 要么转人工
5. **data可追溯**: 每个关键动作都可追踪其触发者, basis, 上下文, 结果和副作用
6. **发布可控**: workflow, agent, pack, plugin, policy 的变更必须可灰度, 可rollback
7. **多tenant安全**: 不同tenant, 团队, 项目, 业务域之间不得串data, 串permissions, 串execute环境
8. **业务可扩展但不侵入核心**: 新业务接入不能破坏平台的稳定性与安全模型

## 2.4 ArchitectureInvariantRegistry

设计宪法必须落到可testing invariant. 每条 invariant 至少声明 enforcement point, failure行为, testingreferences和 phase; missing少这些field的principle不得作为implementation验收basis. 

```yaml
id: INV-STATE-001
statement: 每次 HarnessRun/NodeRun truth mutation 必须同transaction追加 event
enforcement_point: StateStore.UnitOfWork
test_ref: tests/invariants/truth-event-atomicity.test.ts
failure_behavior: reject mutation and emit incident
phase: MVP
```

v4.2 不可降级核心不变量: 

| Invariant | Enforcement point | Phase |
| --- | --- | --- |
| HarnessRuntime 是唯一executeentry, P4 不accepts旁路execute | P1/P2 admission + P4 dispatch guard | MVP |
| P3 → P4 canonical contract 只能是 `PlanGraphBundle` | PlanGraph validator + dispatch schema | MVP |
| Budget reserve 必须先于 LLM / Tool / SideEffect / Evaluation | BudgetLedger guard | MVP |
| SideEffect ambiguous 不得视为 success | SideEffectManager + ReconciliationWorker | MVP |
| Replay 不得产生真实外部副作用 | ReplaySandboxPolicy | MVP |
| Panic 不得 TTL auto解除, 恢复必须人工confirmation | PanicController | MVP |
| `oapeflir.*` 事件不得作为 truth source | EventRegistry consumer contract tests | MVP |
| TrustScore 不得降低 inherent risk | RiskEngine policy test | Hardening |

### NonOverridableInvariantRegistry

RuntimeInvariant, SecurityInvariant, AuditInvariant 进入 `NonOverridableInvariantRegistry` 后不得被任何manage员, 域 owner, Pack 或 emergency override 关闭. `super_admin` 只能提交 policy proposal 或收紧strategy; 临时例外必须via break-glass, dual control, forensic logging, expiry 和 post-review, 并且不得bypass RuntimeStateMachine, SideEffectManager, BudgetAllocator, Event/Audit append. 

### Invariant Coverage Matrix

每条设计宪法和硬目标必须映射到可executecheck. `ArchitectureInvariantRegistry` 中missing少 `test_ref`, `failure_behavior`, `owner` 或 `phase` 的条目只能作为设计意graph, 不能作为验收项或发布门禁. 

| principle / 硬目标 | Invariant ID | Enforcement point | Test ref | Failure behavior | Owner | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| state与证据同等重要 | INV-STATE-001 | StateStore.UnitOfWork | `tests/invariants/truth-event-atomicity.test.ts` | reject mutation + incident | Runtime | MVP |
| HarnessRuntime 唯一executeentry | INV-RUN-001 | AdmissionController + DispatchGuard | `tests/invariants/harness-run-authority.test.ts` | reject bypass dispatch | Runtime | MVP |
| PlanGraphBundle 是 P3→P4 唯一executecontract | INV-GRAPH-001 | PlanGraph validator + dispatch schema | `tests/invariants/plan-graph-only-dispatch.test.ts` | reject dispatch | Orchestration | MVP |
| Budget reserve 先于任何execute成本 | INV-BUDGET-001 | BudgetLedger guard | `tests/invariants/budget-reserve-before-execute.test.ts` | fail closed + release partial reservation | Finance Platform | MVP |
| Replay 不产生真实副作用 | INV-REPLAY-001 | ReplaySandboxPolicy | `tests/invariants/no-side-effect-in-replay.test.ts` | abort replay + incident | Evidence | MVP |
| SideEffect ambiguous 不等于 success | INV-SIDEEFFECT-001 | SideEffectManager | `tests/invariants/side-effect-ambiguous-reconciles.test.ts` | enter reconciliation | Execution | MVP |
| default安全收敛 | INV-POLICY-001 | PolicyEngine + CapabilityGate | `tests/invariants/deny-by-default.test.ts` | deny / require approval | Security | MVP |
| 高risk域责任边界 | INV-DOMAIN-001 | DomainRiskSpec validator | `tests/invariants/high-risk-domain-boundary.test.ts` | block domain release | Domain Platform | Hardening |
| TrustScore 不降低 inherent risk | INV-RISK-001 | RiskEngine | `tests/invariants/trust-score-no-risk-lowering.test.ts` | ignore trust downgrade + audit | Risk | Hardening |

## 2.5 Architecture Design Review Resolution Matrix

`docs_zh/reviews/architecture-design-review.md` 中的设计审查项必须按“权威contract → enforcement point → test gate”吸收. 本文不以散落建议作为implementationbasis; 下表是subsequent ADR, contract, 代码与testing的entryindex. 

| Review 主题 | 架构决议 | 正文落点 | 必需门禁 |
| --- | --- | --- | --- |
| OAPEFLIR vs Harness state权威 | HarnessRuntime 是唯一runtimestate权威; OAPEFLIR 只是语义投影 | §13, §45.22, §58.6 | state机 invariant + projection consumer test |
| MVP 与长期路线 | 先交付 P1 + P3 + P4 + P5 最小闭环, Enterprise / Marketplace / Multi-Region 后置 | §1.4, §33, 三环优先级 | MVP closure checklist |
| SLA 与故障转移 | default 99.95; 99.99 只能绑定auto failover, quorum 与演练证据 | §31, §52, §54 | DR drill pass/fail + SLA eligibility test |
| call深度矛盾 | `call_depth` globally硬upper limit = 8, 不与目标分解和委托局部upper limit相乘 | §19.2, §40 | delegation depth test |
| Phase 1 存储range | SQLite 只承载 MVP 表子集; 完整逻辑模型随 Phase 启用 | §26.2, §26.3, §33 | migration subset test |
| 跨 Region truth 写入 | truth / budget / side effect 只allows单 leader 写; CRDT onlyused for非关键统计 | §25.11, §52.3 | fencing epoch + failover reconciliation test |
| 低延迟业务 vs LLM call | 实时/量化热pathuses离线规划 + 确定性execute, LLM 不在微秒级热path内 | §15, §37, §71 | domain latency mode validation |
| Replay 确定性 | Trace Replay 只replayrecord事实; Re-execution Replay 必须声明不可确定性 | §45.24, §58.4, §65 | no-side-effect replay test |
| 预算竞态 | 所有成本资源先原子 reserve, 再execute, 再 settle/release | §18.3, §25.9, §36.2 | concurrent hard-cap test |
| TrustScore permissions边界 | TrustScore 只减少审批摩擦, 不降低 inherent risk 或扩大permissions | §42.5, §10 | risk policy test |

### Systemic Failure Mode Guardrails

以下system性主题是不可忽略的架构missing口, 必须在implementation中explicitly建模: 

- **多步治理操作必须 Saga 化**: OrgTree 级联, Chinese Wall 解除, 治理委托撤销, SCIM deprovisioning, approval reroute 均必须contains prepare / commit / compensate / audit 四段语义, 禁止“partial完成但无补偿”的治理写入. 
- **正反馈环路必须可断路**: Memory 自augmentation, Guardrail replan 振荡, Priority auto-upgrade 膨胀, Trust maintained型低价值task必须有 `loop_counter`, `cooldown`, `promotion_budget`, `human_breaker` 或统计异常检测. 
- **bottleneck必须有背压模型**: Evaluator, BudgetAllocator, ApprovalQueue, DispatchQueue 都必须声明 `max_queue_depth`, 准入reject语义, 降级模式和 DLQ/incident path. 
- **资源释放必须终态驱动**: Run 终态, NodeRun 终态, Plugin crashed, TaskDraft expiry, Secret lease, ContextSnapshot retention 均必须由 sweeper 或 terminal cleanup 协议关闭. 

---

# 3. 平台定义与非目标

## 3.1 平台定义

> 一套面向企业环境的, 以稳定性优先为核心principle的受控auto化平台. 
> 它把 Agent 视为高riskauto化单元, via五个架构平面和一层横切控制织网, 对其进行严格控制, 隔离, 恢复, 审计和治理. 

## 3.2 它不是什么

- **不是单个聊天机器人** — 聊天只是entry之一
- **不是纯 Workflow Engine** — Workflow 不解决治理, 恢复, 审批, 审计
- **不是纯 Tool Calling 壳层** — 工具只是execute手段
- **不是 "Prompt + 模型 + 少量工具" 的薄应用** — missing乏隔离, 治理, 恢复
- **不是 "auto化越多越好" 的system** — 平台追求**受控auto化**
- **不是医疗诊断主体, 法律意见主体, 金融最终授信主体或证券交易热pathexecute引擎** — 平台只能辅助生成建议, 证据, plan和候选动作; 高risk域最终责任由具备法定资质或组织authorization的人/system承担
- **不是超低延迟确定性system的替代品** — 交易撮合, 实时竞价, 急救response, 直播断流等热path不得dependency通用 LLM/Harness loop; 只能uses确定性strategy, 编译 artifact, 预先批准规则或离线规划结果

所有 high/critical 域必须在 DomainRiskSpec 中explicitly声明 `advisory_only`, `human_accountable`, `deterministic_hot_path_only` 或等价责任边界; 未声明时平台按更保守模式handle, default不allows full_auto. 

---

# Part I — 基础设施层 (§4-§14, §24-§32) 

---

# 4. 总体架构: 五平面 + 一横切控制织网

## 4.1 架构总graph

```text
┌──────────────────────────────────────────────────────────────┐
│                    P1 Interface Plane                         │
│     API Gateway · Webhook · Scheduler · Console · Ingress    │
├──────────────────────────────────────────────────────────────┤
│                    P2 Control Plane                           │
│     Policy · Approval · Rollout · Incident · Config          │
├──────────────────────────────────────────────────────────────┤
│                P3 Orchestration Plane                         │
│     HarnessRuntime · Planning · Evaluation · Routing          │
├──────────────────────────────────────────────────────────────┤
│                 P4 Execution Plane                            │
│     Dispatcher · Workers · Tools · Plugins · Recovery        │
├──────────────────────────────────────────────────────────────┤
│             P5 State & Evidence Plane                         │
│     Truth · Events · Projections · Artifacts · Audit         │
├──────────────────────────────────────────────────────────────┤
│         X1 Reliability & Security Fabric (横切全层)           │
│     AuthN/Z · Sandbox · Circuit Breaker · DLQ · Backpressure │
└──────────────────────────────────────────────────────────────┘
```

## 4.2 P1 Interface Plane

对外接入层. 

**contains**: API Gateway / Webhook / Scheduler trigger / Admin Console backend / External event ingress

**职责**: 输入validation · identity认证 · 限流 · requestdeduplication · 基础路由 · 附件references化 · 幂等键handle

**不负责**: execute业务逻辑 · 修改核心state · bypassControl Planedirectly调execute器

P1 必须暴露标准化的 API contract (见 §6) . 自然语言, Webhook, UI 表单或外部事件不得directly生成可execute RequestEnvelope; 必须先进入 `RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope` intake pipeline. 只有 `ConfirmedTaskSpec` 可生成 RequestEnvelope, 且必须contains trace_id, idempotency_key, principal, tenant_id. 

## 4.3 P2 Control Plane

控制与治理层, 是平台的治理外壳. 

**contains**: policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management

**职责**: 定义与版本治理 · 审批与自治边界控制 · risk与预算guard · 发布, 灰度, rollback · incident 升级与处置 · repair / replay / rebuild 的ops控制

P2 via `OperationalDirective` 或 `DecisionDirective` 向 P3/P4 发送指令, 而非directly操作底层state. 旧名 `ControlDirective` only作为 deprecated alias, 不得出现在新 schema, API 或事件中. 

## 4.4 P3 Orchestration Plane

编排与决策层. 

**contains**: P3a HarnessRuntime 协调entry / P3b Planning Services / P3c Evaluation Services / P3d Routing & Escalation Services / OAPEFLIR trace projection adapter

**职责**: 决定做什么 · 决定下一步谁execute · 决定何时暂停 · 决定何时转人工 · 决定何时重规划, 降级, 终止

P3 output标准化的 `PlanGraphBundle` (见 §13) . `ExecutionPlan` 是 deprecated alias, 只allows出现在历史compatibility适配器, 术语表和迁移说明中; 新implementation不得消费线性 `steps`. 

## 4.5 P4 Execution Plane

统一execute层. 

**contains**: scheduler / dispatcher / execution engine / worker pool / tool executor / plugin executor / adapter executor / browser executor / human wait executor / recovery workers

**职责**: 真正execute动作 · 获取并maintained lease · execute结果回写 · 提议与提交 side effect · 在故障时触发恢复动作

P4 必须via `NodeAttemptReceipt` 向 P3/P5 回报execute结果, Receipt 以 `attemptId` + `nodeRunId` 为主键, contains harnessRunId / planGraphId / graphVersion / nodeRunId / attemptId / status / duration / side_effects / evidence_refs / error_detail. 旧 `ExecutionReceipt` 与 `stepId` 只allows出现在 legacy adapter 或 projection, 不得作为 P4 execute回执field. 

## 4.6 P5 State & Evidence Plane

state与证据平面. 

**contains**: truth tables / event log / artifact store / memory / knowledge / audit / projections / checkpoints / evidence bundles / incident records / DLQ records

**职责**: 保存当前控制真相 · 保留历史changes轨迹 · 支撑恢复和回放 · 保留审计证据 · 支撑控制台query

P5 via统一的 Repository interface对外暴露, 上层不directly操作存储implementation. Repository interface支持多后端切换 (见 §26) . 

P5 内部必须按生命周期和一致性边界分module: P5a truth-store, P5b event-store, P5c projection-store, P5d artifact-store, P5e audit-store. shared Repository facade 可以统一暴露, 但transaction语义, retention, GC, legal hold 和 rebuild strategy不得混写. 

## 4.7 X1 Reliability & Security Fabric

横跨所有平面的生命支持system. 

**contains**: authn/authz / sandbox / secrets / egress control / quotas / circuit breakers / timeouts / retries / rate limits / health checks / anomaly detection / backpressure / DLQ / incident hooks

**定位**: 这不是辅助能力, 而是平台的基础生命支持system. X1 能力必须声明落地形态: library middleware, sidecar / interceptor 或 central service. default优先 library / interceptor; 只有跨processsharedstate, globally配额, Panic, 密钥租约等需要concentrated协调的能力才做 central service. 

`X1DeploymentMatrix`: 

| 能力 | 落地形态 | state源 | failurestrategy |
| --- | --- | --- | --- |
| AuthZ / Policy check | library interceptor + P2 policy cache | PolicyOutcome / EffectivePolicySnapshot | fail closed |
| Budget reserve | central service + library client | BudgetLedger / BudgetAllocator | fail closed / queue |
| Panic / Kill switch | central service + plane local handler | PlatformPanicDirective | fail closed / isolate |
| RateLimit / Backpressure | library + gateway interceptor | Quota / ResourceVector | reject / degrade |
| CircuitBreaker | library + telemetry feed | CircuitBreakerState | degrade / no-external-call |
| SecretLease | central service + short lease client | KMS/Vault lease registry | revoke / awaiting_hitl |
| EgressControl | sidecar / network policy + library guard | EgressPolicy / destination registry | deny + incident |

---

# 5. 平面间通信contract

> 定义五个平面之间的interface协议, 将平面间通信正式化. 

## 5.1 设计principle

- 平面间只能via**正式contract对象**通信, 不能directlycall对方内部implementation
- 每个contract对象都是**可序列化, 可审计, 可replay**的
- synchronouscalluses typed interface, 异步notificationuses domain event

## 5.2 平面间contract矩阵

| call方 → 被调方 | contract对象           | 通信方式  | 说明                                                       |
| --------------- | ------------------ | --------- | ---------------------------------------------------------- |
| P1 → P2         | `RequestEnvelope`  | synchronous      | 所有request先经 P2 做strategy/准入check                            |
| P2 → P3         | `OperationalDirective` | synchronous/事件 | 模式切换, 暂停, 恢复, 配额调整, rollout 控制                |
| HITL/Approval → P3/P4 | `DecisionDirective` | synchronous/事件 | approve / deny / override / expire_approval 等业务裁决      |
| P3 → P4         | `PlanGraphDispatch` (`PlanGraphBundle`) | synchronous | 编排层output给execute层的 canonical graphplan                       |
| P4 → P3         | `NodeAttemptReceipt` | synchronous      | NodeAttempt execute结果回报给编排层                           |
| P4 → P5         | `TransitionCommand` (`RuntimeStateMachine.transition`) | synchronous  | 推进 truth state, 必须同transaction追加 platform fact event          |
| P4/P5 → EventLog | `EventAppendCommand` | synchronous/transaction | 追加事实事件或投影事件                                     |
| P4/P5 → Audit   | `AuditAppendCommand` | synchronous/transaction | 追加审计record                                               |
| P3 → P5         | `EvidenceRecord`   | 异步      | 决策证据写入                                               |
| P2 → P4         | `OperationalDirective(type=kill)` | synchronous | only限紧急制动直达execute层 (§60)                               |
| P5 → P2         | `ProjectionUpdate` | 事件      | Projection changesnotificationControl Plane                                  |
| arbitrary → X1       | middleware injection    | 切面      | 不viaexplicitlycall, via装饰器/拦截器                          |

### ContractEnvelope

所有平面间命令, 事件和审计追加均uses统一 envelope, 业务 payload 只放在 `body` 中: 

| field | 要求 |
| --- | --- |
| schemaVersion / commandId | 必填, 支持版本化和幂等 |
| tenantId / runId / traceId | 必填, 支撑隔离与追踪 |
| correlationId / causationId | 必填, 支撑因果链和 replay |
| issuedBy / issuedAt / expiresAt | 必填, expiry命令必须reject |
| idempotencyKey | 写操作必填 |
| signature | 跨process或跨信任边界必填 |

## 5.3 核心contract对象定义

### Intake Pipeline 与 RequestEnvelope

P1 → P2 的标准request信封只接收已confirmationtask. 入站request必须按以下state推进: 

```text
RawInput → TaskDraft → ClarificationSession → ConfirmedTaskSpec → RequestEnvelope
```

`RawInput` 可以来自自然语言, Webhook, UI, CLI 或定时触发; `TaskDraft` 只used for澄清, risk预览和草稿保存; `ClarificationSession` 收集missing意graph与高riskconfirmation; `ConfirmedTaskSpec` 是唯一可转换为 RequestEnvelope 的前置对象. high/critical task必须有explicitly `UserConfirmationReceipt`, low risk可按 `ambiguity_policy` uses安全default值, medium 需要confirmation关键参数. 

RequestEnvelope 封装已confirmationtask的元信息与task规格. 

| field         | type          | 说明                                     |
| ------------ | ------------- | ---------------------------------------- |
| requestId    | string (UUID) | request唯一标识                             |
| tenantId     | string        | tenant ID, used for多tenant隔离                  |
| confirmedTaskSpecId | string | 关联 ConfirmedTaskSpec, 不directly承接 RawInput |
| taskSpec     | ConfirmedTaskSpec | 已confirmationtask规格 (目标, 输入, 约束)        |
| priority     | enum          | 优先级 (critical / high / normal / low)  |
| traceContext | TraceContext  | 分布式追踪上下文, 贯穿全链路             |
| principal    | Principal     | 发起人identity与permissions声明                     |
| timestamp    | ISO-8601      | request发起时间戳                           |

### OperationalDirective / DecisionDirective

P2 → P3/P4 的控制指令, used forstrategyexecute, 审批决策和紧急制动. 

v4.2 起 `ControlDirective` only为 deprecated alias. 新contract必须明确uses以下两类对象, 避免把运行控制与业务裁决混在同一枚举中: 

| 分类 | 典型type | 作用域 | 约束 |
| --- | --- | --- | --- |
| OperationalDirective | pause / resume / abort / rollback / kill / mode_switch / quota_adjust | HarnessRun, NodeRun, Plane, Tenant, Region | 只改变运行控制state, 不表达业务 approve / deny |
| DecisionDirective | approve / deny / override / request_changes / expire_approval | decisionId, sideEffectId, hitlTaskId, budgetReservationId | 只能由 HITL / Policy / Approval 流程生成, 必须声明 scope 与 expiresAt |

P2 → P4 的直达控制只allows `OperationalDirective(type=kill)`, 且onlyused for §60 PlatformPanicDirective 或等价 P0 安全事件; 常规审批不得bypass HarnessRuntime. 

| field        | type          | 说明                                                                  |
| ----------- | ------------- | --------------------------------------------------------------------- |
| directiveId | string (UUID) | 指令唯一标识                                                          |
| category    | enum          | operational / decision                                                |
| type        | enum          | 分类内指令type                                                        |
| targetRunId | string        | 目标运行实例 ID                                                       |
| reason      | string        | 指令原因 (审计用)                                                     |
| issuedBy    | Principal     | 签发人identity                                                            |
| traceId     | string        | 关联追踪 ID                                                           |

### PlanGraphBundle

P3 → P4 的标准executeplan. `PlanGraphBundle` 是 canonical contract; `ExecutionPlan` 不再作为新implementationcontract名称, 只能作为 deprecated alias 映射到 `PlanGraphBundle`. 所有task, 包括简单task, 都以 PlanGraph 形式下发给 P4; 简单task退化为单节点graph. Graph Scheduler 按确定性strategy调度 NodeRun. 

| field             | type             | 说明                                 |
| ---------------- | ---------------- | ------------------------------------ |
| planId           | string (UUID)    | plan唯一标识                         |
| planGraphId      | string (UUID)    | graphplan唯一标识                       |
| graphVersion     | number           | graph版本, GraphPatch 后递增            |
| graph            | PlanGraph        | 可executegraph, contains node / edge / entry / terminal |
| schedulerPolicy  | ReadyNodeSchedulingPolicy | ready node 的确定性调度strategy |
| toolRequirements | ToolRef[]        | 所需工具声明                         |
| budget           | BudgetEnvelope   | 预算约束 (token / 时间 / 费用)       |
| riskProfile      | RiskProfile      | risk评估摘要                         |
| validationReport | GraphValidationReport | graphvalidation结果                      |
| riskPropagationReport | GraphRiskPropagationReport | risk传播结果              |
| worstPathAnalysis | GraphWorstPathAnalysis | 最坏path耗时, 成本, riskanalysis |
| rollbackStrategy | RollbackStrategy | rollbackstrategy (逐步rollback / fullrollback / 无)  |
| evidenceRefs     | string[]         | plan生成, validation, 评估证据             |

**PlanGraph 硬规则**: 

1. 简单task可以退化为单节点 PlanGraph. 
2. 复杂task不得uses线性 steps directlyexecute. 
3. PlanGraph 必须经过 Normalize → Validate → Risk Propagation → Worst-Path Analysis 后才能进入 ready. 
4. P4 不得execute `validationReport.valid=false` 的 PlanGraph. 

### NodeAttemptReceipt

P4 → P3/P5 的execute回执, record单次 NodeAttempt 的execute结果与遥测data. Receipt 不再以 step 为权威对象; HarnessStep 只是语义/展示层, NodeRun / NodeAttempt 才是execute层事实. 旧 `ExecutionReceipt` only由 legacy adapter 派生. 

| field        | type          | 说明                                   |
| ----------- | ------------- | -------------------------------------- |
| receiptId   | string (UUID) | 回执唯一标识                           |
| harnessRunId | string       | 关联 HarnessRun                        |
| planGraphId | string        | 关联 PlanGraphBundle / PlanGraph       |
| graphVersion | number       | 回执对应的 PlanGraph 版本              |
| nodeRunId   | string        | 关联 NodeRun, P4 回执的 canonical key   |
| attemptId   | string        | 关联 NodeAttempt / AttemptLineage       |
| status      | enum          | executestate (success / failed / skipped)  |
| artifacts   | Artifact[]    | 产出物列表 (file, 变量等)              |
| telemetry   | Telemetry     | 遥测data (延迟, token 用量, 重试次数)  |
| sideEffects | SideEffect[]  | 副作用声明 (file写入, API call等)      |
| error       | ErrorDetail?  | error详情 (onlyfailure时)                    |
| duration    | number (ms)   | execute耗时                               |

### RuntimeStateMachine.transition(command)

`RuntimeStateMachine.transition(command)` 是 HarnessRun / NodeRun / SideEffect / Budget state推进的唯一正式entry. P2/P3/P4/Recovery/HITL 不得directly更新 truth 表; 它们只能提交 TransitionCommand, 由 RuntimeStateMachine 统一validationstate机, CAS, active lease, fencing token, RunVersionLock, policy guard, budget precondition 和 side-effect safety. 

| field            | type          | 说明                                          |
| --------------- | ------------- | --------------------------------------------- |
| commandId       | string (UUID) | 命令唯一标识                                  |
| entityType      | string        | harness_run / node_run / side_effect / budget_reservation |
| entityId        | string        | 目标实体 ID                                   |
| transition      | enum          | state迁移动作                                  |
| expectedStatus  | enum          | 期望state                                      |
| nextStatus      | enum          | 目标state                                      |
| leaseId         | string?       | execute态迁移必填                                |
| fencingToken    | string?       | execute态迁移必填                                |
| event           | EventEnvelope | 与 truth mutation 同transaction追加的事实事件        |
| payload         | JSON          | 写入data                                      |
| expectedVersion | number        | 期望版本号 (CAS optimisticlock)                       |
| principal       | Principal     | 操作发起人identity                                |
| traceId         | string        | 关联追踪 ID                                   |

旧 `StateMutationCommand` 只allows作为 `RuntimeStateMachine.transition(command)` 的内部compatibility wrapper, 不得作为新moduledirectly写 truth 的公共 API. 

### EventAppendCommand / AuditAppendCommand / ArtifactWriteCommand

| 命令 | transaction语义 | Description |
| --- | --- | --- |
| EventAppendCommand | 与 truth mutation 同transaction或 outbox 同transaction | 事实事件和 OAPEFLIR 投影事件都必须注册到 Event Registry |
| AuditAppendCommand | append-only, allows与业务transaction同提交 | record who / what / why / policy outcome |
| ArtifactWriteCommand | content-addressed, 先写 artifact 后写 ref | large object不得内联到 event 或 truth payload |

## 5.4 contract遵守规则

1. **不可bypass**: P1 不可skip P2 directly调 P4
2. **P5 被动principle**: P5 不可向 P3/P4 发指令 (只能被读/被写) ; P5 → P2 only限 ProjectionUpdate 事件notification, 不可发送 OperationalDirective 或触发state变更
3. **P2 → P4 only限紧急通道**: P2 在紧急制动(§60)场景下可bypass P3 直达 P4 发送 `OperationalDirective(type=kill)`, 此pathonly限 `PlatformPanicDirective` 场景, 常规指令仍须经 P3 编排
4. **必须signature**: 每个contract对象必须contains principal 和 trace_id
5. **必须幂等**: 所有 StateMutationCommand 必须based on expected_version 做 CAS
6. **必须可replay**: 所有contract对象必须可序列化为 JSON

## 5.5 Canonical Runtime Object Map

| 对象 | 权威state | 唯一职责 | 非权威/legacy 用法 |
| --- | --- | --- | --- |
| TaskDraft | canonical pre-admission | NL / UI 草稿, 澄清, risk预览 | 不得进入 P4 |
| RequestEnvelope | canonical ingress | 已confirmationrequest进入 P1/P2 的标准信封 | 不承载executestate |
| HarnessRun | canonical run truth | 一次完整运行的唯一权威 Run | workflow_run only为 query projection |
| HarnessStep | semantic projection | 面向user/解释/产品的语义step | P4 不消费 HarnessStep execute |
| PlanBundle | product/debug wrapper | goal, taskGraph, successCriteria 的产品wrapper | 不作为 P3→P4 executecontract |
| PlanGraphBundle | canonical execution contract | P3→P4 唯一executeplan | ExecutionPlan 为 deprecated alias |
| NodeRun | canonical execution truth | 可租约, 可重试, 可审计的最小execute单元 | stepId only legacy projection |
| NodeAttempt | canonical attempt lineage | retry/redrive 的追加式 attempt | 不coverage NodeRun 历史 |
| SideEffectRecord | canonical side effect truth | 外部副作用生命周期与对账事实 | 工具success不等于 side effect success |
| BudgetReservation | canonical budget gate | LLM/Tool/SideEffect/Eval 前置预算硬门 | 发票 reconciliation 不是准入basis |
| NodeAttemptReceipt | canonical P4 result | NodeAttempt 结果回执 | 旧 ExecutionReceipt only legacy adapter |
| EventEnvelope | canonical event fact | state变更, 审计, projection rebuild 输入 | `oapeflir.view.*` / `oapeflir.rationale.*` 只做投影事件 |

---

# 6. API contract与版本化架构

> 将 API 作为一级架构关注点. 

## 6.1 API 分层

| API 层       | 面向             | 协议                                       | 认证方式             |
| ------------ | ---------------- | ------------------------------------------ | -------------------- |
| Public API   | 业务system, CI/CD  | REST + WebSocket                           | API Key + JWT        |
| Admin API    | ops人员, 控制台 | REST                                       | JWT + RBAC           |
| Internal API | 平面间call       | typed interface (process内) 或 gRPC (跨process)  | mTLS / service token |
| Plugin API   | 插件 / adapter   | IPC / sandbox boundary                     | capability token     |

## 6.2 Public API 设计规范

- 资源naminguses kebab-case 复数形式; canonical executeentryuses `/api/v1/harness-runs`
- 所有写操作必须携带 `Idempotency-Key` header
- 所有responsecontains `X-Request-Id` 和 `X-Trace-Id`
- errorresponseuses统一结构: 

```json
{
  "error_code": "PLATFORM.P4.TOOL.TIMEOUT",
  "message": "human readable summary",
  "retryable": true,
  "recoverability": "retry|replan|compensate|manual_review|abort",
  "side_effect_state": "none|proposed|committing|ambiguous|confirmed|compensation_required",
  "severity": "warning|error|critical",
  "user_action": "retry later or contact operator",
  "operator_action": "inspect nodeRunId and reconciliation status",
  "trace_id": "trace-..."
}
```

## 6.3 API 资源总览

| 资源                               | 方法                | 说明                   |
| ---------------------------------- | ------------------- | ---------------------- |
| `/api/v1/harness-runs`             | POST / GET          | canonical run 创建与query |
| `/api/v1/harness-runs/{id}`        | GET                 | query HarnessRun truth / summary |
| `/api/v1/harness-runs/{id}/abort-requests` | POST      | request安全 abort, 常规cancel语义 |
| `/api/v1/harness-runs/{id}/pause-requests` | POST      | request safe pause, 不等同 panic kill |
| `/api/v1/tasks`                    | POST / GET          | compatibility layer; 创建后必须转为 HarnessRun |
| `/api/v1/tasks/{id}`               | GET                 | query TaskDraft / compatibility projection |
| `/api/v1/workflow-runs`            | GET                 | legacy query projection, 只读 |
| `/api/v1/workflow-runs/{id}`       | GET                 | legacy query projection, 只读 |
| `/api/v1/harness-runs/{id}/plan-graph` | GET             | query权威 PlanGraphBundle |
| `/api/v1/harness-runs/{id}/node-runs` | GET              | query NodeRun 列表与state |
| `/api/v1/harness-runs/{id}/side-effects` | GET           | query副作用record与对账state |
| `/api/v1/harness-runs/{id}/budget-reservations` | GET    | query预算预留, settlement 与释放 |
| `/api/v1/harness-runs/{id}/node-runs/{nodeRunId}/attempts` | GET | query NodeAttempt 与 NodeAttemptReceipt |
| `/api/v1/harness-runs/{id}/forensic-snapshot` | GET      | query取证快照references       |
| `/api/v1/replay-sessions`          | POST                | 创建 Trace / Re-execution Replay |
| `/api/v1/replay-sessions/{id}`     | GET                 | query ReplaySession     |
| `/api/v1/approvals`                | GET                 | 待审批列表             |
| `/api/v1/approvals/{id}`           | POST                | 提交审批决策           |
| `/api/v1/incidents`                | GET                 | Incident 列表          |
| `/api/v1/knowledge`                | GET / POST          | Knowledge query/写入    |
| `/api/v1/packs`                    | GET / POST          | Pack 注册与query        |
| `/api/v1/packs/{id}/versions`      | GET / POST          | Pack 版本manage          |
| `/api/v1/plugins`                  | GET / POST          | Plugin 注册与query      |
| `/api/v1/prompts`                  | GET                 | Prompt 版本query        |
| `/api/v1/cost-reports`             | GET                 | 成本报表query           |
| `/api/v1/webhooks`                 | GET / POST / DELETE | Webhook 订阅manage       |
| `/api/v1/admin/workers`            | GET                 | Worker state            |
| `/api/v1/admin/config`             | GET / PUT           | configuremanage               |
| `/api/v1/admin/rollouts`           | GET / POST          | Rollout manage           |
| `/api/v1/admin/tenants`            | GET / POST / PUT    | Tenant manage            |
| `/api/v1/admin/budgets`            | GET / PUT           | 预算configure               |
| `/api/v1/admin/panic-directives`   | POST                | 发布 PlatformPanicDirective |
| `/api/v1/admin/resume-directives`  | POST                | 发布 PlatformResumeDirective |
| `/ws/v1/stream`                    | WebSocket           | 实时事件流             |

`/api/v1/workflow-runs/{id}/steps` only作为 legacy projection 保留; 新控制台和 SDK 必须优先读取 NodeRun 与 PlanGraph. `DELETE /tasks/{id}` 不再表达模糊cancel语义; call方必须选择 abort, pause 或 panic kill 的explicitly控制端点. 

## 6.8 Canonical API vs Legacy Projection

| 类别 | 端点 | 语义 |
| --- | --- | --- |
| Canonical execution | `POST /api/v1/harness-runs` | 唯一创建 HarnessRun 的executeentry |
| Canonical control | `/harness-runs/{id}/abort-requests`, `/pause-requests` | 受 P2/HarnessRuntime 控制的运行控制 |
| Canonical read | `/harness-runs/{id}/plan-graph`, `/node-runs`, `/side-effects`, `/budget-reservations` | 读取权威运行对象或其受控 projection |
| Compatibility | `/api/v1/tasks` | compatibility旧call方; 必须落为 TaskDraft 或 HarnessRun |
| Legacy projection | `/api/v1/workflow-runs*` | 只读query投影, 不得作为 truth 或executeentry |

API compatibility层不得把 `workflow_run`, `task` 或 `stepId` 重新提升为权威对象. 所有 compatibility handler 必须在entry处生成或解析 `harnessRunId`, `planGraphId`, `nodeRunId`, 并在response中用 `legacyProjection=true` 标记旧field来源. 

## 6.4 版本compatibilitystrategy

- API 版本via URL path distinguish (`/api/v1/`, `/api/v2/`) 
- 同一大版本内只做**向后compatibility**变更 (新增field, 新增端点) 
- 破坏性变更必须升大版本, 旧版本至少maintained 6 个月
- Event schema uses `schema_version` field, consumer 按版本分派
- Schema diff gate 必须阻止 deprecated term 进入新写path; CI 必须contains `contract-naming-consistency.test.ts`, 扫描 OpenAPI, Zod schema, Event Registry, SDK type和 runtime-contracts, 确保 `ExecutionPlan`, `ControlDirective`, `StateCommand`, `stepId` 只出现在术语表, 迁移说明或 legacy projection adapter 中. 
- 内部 TypeScript interface 变更via Zod schema 做runtimevalidation

## 6.5 认证流程

**API Key + JWT 双模式**: 

| 场景         | 认证方式                               | 说明                         |
| ------------ | -------------------------------------- | ---------------------------- |
| 服务间call   | API Key (Header: `X-API-Key`)          | 有到期时间, 作用域和最后uses时间, 按 tenant 颁发 |
| user操作     | JWT (Header: `Authorization: Bearer`)  | OAuth2 / OIDC 颁发, 短期有效 |
| 控制台       | JWT + CSRF token                       | 浏览器安全防护               |
| Webhook 回调 | HMAC signature验证                          | `X-Signature-256` header     |

**Token 生命周期**: access_token TTL = 15min, refresh_token TTL = 24h. API key 必须声明 `expiresAt`, `scopes`, `lastUsedAt`, `createdBy` 和 `rotationPolicy`; 异常来源, 泄露迹象或 scope drift触发auto吊销, 手动rotation只是补充能力. 

## 6.6 pagination与filter

- 列表interface统一uses cursor-based pagination: `?cursor=xxx&limit=20`
- responsecontains `next_cursor`, 为 null 时表示最后一页
- filterusesquery参数: `?status=running&tenant_id=xxx&created_after=2026-01-01`
- sort: `?sort=created_at:desc`
- 单页最大 100 条

## 6.7 Webhook 投递保证

- 投递uses at-least-once 语义 (outbox pattern) 
- 每次投递contains `X-Webhook-Id` (幂等键) 和 `X-Signature-256` (HMAC signature) 
- 目标return 2xx 视为success, 否则按 retry policy handle

Webhook retry policy: 

| response/error | strategy |
| --- | --- |
| 429 | 遵守 `Retry-After`, missing时按 5xx strategy |
| 5xx / timeout | exponential backoff + jitter, 最大间隔 15min |
| 4xx permanent | 连续 10 次禁用 subscription, notification tenant manage员 |
| signature mismatch | 立即禁用并生成 security incident |

---

# 7. 服务通信架构

> 明确三种通信模式及适用场景. 

## 7.1 三种通信模式

### synchronousrequest/response

适用: P1→P2 准入check, P3→P4 dispatch, P4→P5 truth write

要求: 

- 必须设置 timeout (default 5s, 最大 30s) 
- 必须有 fallback (降级 / reject / queue) 
- 必须有 circuit breaker 保护

### 异步事件notification

适用: P4→P5 event append, P5→P2 projection update, P4→X1 incident hook

要求: 

- uses outbox pattern 保证 at-least-once
- consumer 必须uses `event_inbox` 幂等消费 (based on event_id / dedupe_key deduplication) 
- failure事件进入 DLQ
- projection, webhook, DLQ redrive, external callback consumer 都不得各自手写deduplication逻辑; 必须via `EventInbox.consumeOnce` record consumerId, eventId, dedupeKey, processedAt 和 failure reason. 

### 流式推送

适用: P5→P1 实时事件流 (WebSocket) , worker heartbeat

要求: 

- 连接断开auto重连 + 从 last_event_id 恢复
- 服务端背压 (buffer 满则丢弃低优先级事件) 
- `last_event_id` 在 24h 保留window内时execute delta replay
- `last_event_id` expiry时return snapshot + delta 恢复指令
- 检测到事件 gap 时发送 `stream_gap` 事件, 客户端必须重新synchronous
- WebSocket / SSE subscription 必须绑定 authenticated principal, tenantId, allowed domains 和 projection scope; 服务端逐事件execute tenantId / scope filter, 不得只dependency客户端filter. 跨tenant事件命中订阅filter器时必须丢弃并生成 security telemetry. 

## 7.2 通信拓扑

```text
                     常规path
P1 ──sync──> P2 ──sync/event──> P3 ──sync──> P4
                                              │
                                              ▼
                                    P4 ──sync──> P5 (RuntimeStateMachine.transition)
                                    P4 ──event─> P5 (event append)

                     反馈path
P5 ──event──> P2 (ProjectionUpdate notification)
P5 ──stream─> P1 (WebSocket 实时推送)
P4 ──sync──> P3 (NodeAttemptReceipt 回报)

                     紧急通道 (only §60 PlatformPanic) 
P2 ──sync──> P4 (OperationalDirective kill)

                     横切injection
X1 ──middleware──> P1, P2, P3, P4, P5
```

## 7.3 Outbox Pattern 设计

所有需要保证送达的事件, 采用 outbox pattern: 

1. 业务操作和事件写入在**同一个data库transaction**中完成
2. independent的 outbox poller 异步读取未发送事件
3. 发送success后标记 sent
4. 发送failure超过阈值后转入 DLQ
5. Poller 本身via lease 保证单实例运行

Poller 运行约束: 

```yaml
outbox_poller:
  lease_ttl_seconds: 10
  heartbeat_interval_seconds: 3
  standby_pollers: 1
  max_delivery_gap_p99_seconds: 10
  max_batch_size: 500
```

standby poller 只能在 lease TTL expiry且 fencing epoch 更新后接管. Projection lag ≤5s 是正常path目标; poller failover 后必须在 `max_delivery_gap_p99_seconds` 内恢复投递, 否则触发 incident. 

高吞吐部署必须uses partitioned outbox: 按 tenant / aggregate shard 分区, 每个 shard independent lease, fencing token 和 retry cursor. ordering 只在同一 aggregate 内保证; 跨 aggregate 不承诺全序, 只via causationId, correlationId 和 occurredAt 做因果关联. 

## 7.4 process内 vs 跨process

| 阶段                | 通信方式                    | 说明               |
| ------------------- | --------------------------- | ------------------ |
| Phase 1 (单体)      | process内 typed interface call | 所有平面在同一process |
| Phase 2 (初步split)  | process内 + Redis pub/sub      | event 通道异步化   |
| Phase 3 (微服务化)  | gRPC + event bus            | 平面间independent部署     |

这保证了从单体到微服务的平滑演进, 而不是一开始就要求 18 个服务. 

Redis / pub-sub 只能used for cache, ephemeral queue, leader hint 或低risknotification, 不得承载 truth, budget hard cap, side effect commit, approval decision 或 audit evidence. 任何 Redis dataloss都不得导致 HarnessRun / NodeRun / Budget / SideEffect truth loss. 

---

# 8. 可扩展性架构

> 定义从单节点到集群的扩展strategy. 

## 8.1 扩展维度

| 维度            | 扩展strategy                        | 触发条件                        |
| --------------- | ------------------------------- | ------------------------------- |
| Worker concurrent     | 增加 worker process/容器           | 队列积压 > 阈值                 |
| 存储容量        | SQLite → PostgreSQL → 分表/归档 | data量 > 阈值                   |
| Event 吞吐      | Partition by tenant_id          | Event rate > 单 poller handle能力 |
| API 吞吐        | API Gateway 水平扩展            | QPS > 单实例upper limit                |
| Projection 延迟 | 增加 projector 实例             | Projection lag > SLO            |

## 8.2 无state化principle

- P1 / P3 / P4 设计为无state, 所有持久state存 P5
- Worker via lease 机制避免state绑定
- Session statevia checkpoint persistence, 而非in-memory保持
- 任何process可以被杀死并在另一个节点恢复

WorkerDrainProtocol 是扩缩容, 发布和 panic 传播的必备协议: worker 进入 `draining` 后不得领取新 lease; 可 checkpoint 的 NodeRun 先写 checkpoint 再释放 lease; 处于 side effect commit window 的 NodeRun 只能完成当前 fenced commit 或进入 reconciliation, 不得被硬杀; 超过 drain deadline 后由 `RunTerminationCleanup` 和 RecoveryWorker 接管. 每次 drain 必须record drain reason, deadline, active leases, forced handoff count 和 cleanup result. 

## 8.3 分片strategy

当单节点不够时, 按以下维度分片: 

- **dispatch queue**: 按 tenant_id hash 分片
- **event outbox**: 按 aggregate_type 分区
- **projection rebuild**: 按 projection_name parallel
- **worker pool**: 按 capability_class 分池 (coding / operations / browser) 

`PartitioningSpec` 必须声明: 

| field | Description |
| --- | --- |
| partition_key | tenant_id / aggregate_id / region / capability 的组合 |
| hot_partition_detection | 热点阈值, window, 最小样本量和 owner |
| split_merge_protocol | split plan, shadow route, dual read compare, cutover, cleanup |
| rebalance_read_strategy | rebalancing 期间读取 old/new/shadow projection 的规则 |
| rebalance_write_strategy | rebalancing 期间写入 leader, fencing 和幂等handle |
| rollback_policy | cutover failure后的恢复, 事件补偿和 projection rebuild strategy |

## 8.4 扩展阶段

| 阶段      | 架构                            | 支撑规模                   | 备注                                                                            |
| --------- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| S1 单体   | 单process + SQLite                 | 10 concurrent workflow, 5 worker | 对应落地 Phase 1-2                                                              |
| S2 多process | 主process + worker process + Redis    | 50 concurrent, 20 worker         | 对应落地 Phase 3-4                                                              |
| S3a 分布式 | 微服务 + PostgreSQL + event bus | 200 concurrent, 50 worker       | 对应 Hardening 压测基线                                                          |
| S3b 分布式 | 微服务 + PostgreSQL + event bus | 500 concurrent, 100 worker      | 对应 Enterprise 前置压测                                                         |
| S4 集群   | Kubernetes + PG 分片 + 多 AZ    | 5000+ concurrent                 | 需要多tenant调度器(§53) + 跨 Pod 协调机制 + 多 Region 部署(§52), 对应落地 Phase 6 |

分片再均衡必须遵循 `ShardRebalanceProtocol`: detect hot partition → create split plan → shadow route → dual read compare → cutover → cleanup. state性 worker (Browser Session, long-running tool, EdgeRuntime) 必须声明 `stateful=true`, `lease_migration_supported` 和 `checkpoint_required_before_preempt`, 不得被普通无state调度假设coverage. 

---

# 9. 稳定性架构

> 七层稳定性模型, 每层定义**auto化机制**和**触发规则**. 

## 9.1 稳定性层 1: 隔离

**隔离维度**: tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**设计要求**: coding 与 operations 分池 · 高risk adapter independent池 · browser executor 不和普通 tool executor 混跑 · 高risk tenant 可专属资源池

当某 tenant 的 failure rate > 30% 且满足 `min_sample_size` 时, auto将该 tenant 隔离到independent worker pool, 不影响其他 tenant. 低流量tenant不因 1-2 次failure被auto隔离; 样本不足时只告警和降速. 

## 9.2 稳定性层 2: 限流与背压

**限流点**: API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

限流必须按 endpoint class 声明, 不得让昂贵端点和廉价queryshared同一桶. 至少distinguish: `read_query`, `create_run`, `control_command`, `side_effect_commit`, `webhook_ingress`, `admin_mutation`, `debug_replay`. 每类端点必须声明 `rate_limit`, `burst`, `cost_weight`, `max_queue_depth`, `overflow_policy` 和 `retry_after_policy`. 

**背压strategy**: queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

背压strategy按**梯度auto升级**: 

```text
Level 0 (正常)     → queue_lag < 10s
Level 1 (预警)     → queue_lag 10-30s → 延迟低优先级
Level 2 (限流)     → queue_lag 30-60s → reject低优先级 + supervised mode
Level 3 (保护)     → queue_lag > 60s  → onlyallows critical workflow + manual_only
```

队列背压不得只看 lag; Admission Controller 必须同时check `queue_depth >= max_queue_depth`, oldest age, worker health, approval capacity, budget allocator latency 和 evaluator capacity. 达到 `max_queue_depth` 时必须 fail closed: 低优先级requestreturn 429 / `retry_after`, 不可丢弃的内部事件进入 bounded DLQ 并生成 incident. 不同bottleneckuses不同降级: Evaluator bottleneck降级到 deterministic validators + HITL; Budget bottleneckreject新成本预留; Approval bottleneck暂停高risk新 run; Dispatch bottleneck停止非关键 workflow admission. 

## 9.3 稳定性层 3: timeout与重试

**三层timeout**: step timeout · attempt timeout · tool/adapter timeout

**重试规则**: 

- only retryable failure auto重试
- only幂等操作allowsauto重试
- backoffstrategy: exponential backoff with jitter, base=1s, max=60s
- 重试用尽后进入explicitly `retry_exhausted` state, 触发 escalation

## 9.4 稳定性层 4: 断路器

**断路器对象**: 第三方 API · 外部 adapter · 模型 provider · 高failure率工具 · plugin runtime

**state机**: closed → open (failure_rate > 50% in 60s window) → half-open (30s 后小流量探测) → closed

断路器statechanges必须发射 `circuit_breaker.state_changed` 事件, 触发告警和 mode switching 评估. 

## 9.5 稳定性层 5: 降级模式

**正式模式**: full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

模式切换via `OperationalDirective` 发出, 支持auto触发规则: 

| 触发条件                      | auto切换到                     |
| ----------------------------- | ------------------------------ |
| worker pool unhealthy > 50%   | supervised_auto                |
| external adapter circuit open | no-external-call               |
| security incident detected    | incident-mode                  |
| rollout guardrail breach      | no-rollout                     |
| approval_backlog / approval_processing_capacity > threshold | manual_only (暂停新 workflow)  |

模式合成优先级fixed为: 

```text
incident-mode > manual_only > no-write > no-external-call > read_only > supervised_auto > full_auto
```

ModeScope 优先级fixed为: 

```text
platform > region > tenant > domain > run > node
```

最终execute模式由 scope 优先级与模式严格度共同决定: 高优先级 scope 的收紧strategy优先生效; 同一 scope 内取更严格模式. 低优先级 scope 不得放松高优先级 scope 的limit. 

auto切换必须声明 `min_sample_size`, `window`, `cooldown_window`, `stable_recovery_window`, `owner` 和 `manual_override`, 恢复条件满足前不得反复震荡. 

## 9.6 稳定性层 6: 恢复能力

**恢复组件**: lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

每个恢复组件必须有independent的 health check, 并via `RecoveryReport` 向 Control Plane 汇报恢复success率. 

## 9.7 稳定性层 7: 可观测性

**最少能力**: metrics · structured logs · traces · audit · event timeline · health snapshot

定义核心可观测性指标 (见 §27 性能与 SLO) . 

---

# 10. risk控制架构

> 四分法risk模型, 含**risk评分算法**和**auto化risk控制引擎**. 

## 10.1 risk模型四分法

- **R1 executerisk**: errorexecute · duplicateexecute · concurrentconflict · stale write
- **R2 业务risk**: error改代码 · error切流量 · error发notification · error发布
- **R3 安全risk**: 越权访问 · data泄露 · secret 暴露 · 非authorization外联
- **R4 平台risk**: rollout 失控 · projection 失真 · replay 误操作 · worker pool 雪崩

## 10.2 risk评分算法

> 定义risk评分公式, 将 "low/medium/high/critical" 四级量化. 

```text
risk_score = Σ(factor_weight × factor_value) / max_possible_score

因子权重: 
  impact:               weight=4
  irreversibility:      weight=4
  external_side_effect: weight=4
  data_sensitivity:     weight=3
  regulatory_exposure:  weight=3
  financial_exposure:   weight=3
  operator_scope:       weight=2
  model_uncertainty:    weight=2

映射: 
  0.0 - 0.25  →  low
  0.25 - 0.50 →  medium
  0.50 - 0.75 →  high
  0.75 - 1.00 →  critical
```

`RiskCalibrationGuide` 必须同时给出归一化 0 / 25 / 50 / 75 / 100 锚点和implementation侧 0 / 1 / 3 / 5 打分表, 含正反例, 审批人, 证据要求, 领域覆写理由和复核 owner. 跨域放松risk锚点必须走 P2 policy approval; high/critical 域每季度校准一次. 

| factor_value | 归一化锚点 | 含义 | 证据要求 |
| --- | --- | --- | --- |
| 0 | 0 | 无实质影响, 无敏感data, 无外部写 | autorecord |
| 1 | 25 | 可逆低影响或只读敏感上下文 | evidence_ref + policy check |
| 3 | 50/75 | 有限外部写, 有限财务/合规影响, 可补偿 | HITL 或 deterministic guard |
| 5 | 100 | 不可逆, 高金额, 受监管, 跨tenant或安全影响 | high/critical gate + 责任record |

## 10.3 riskauto控制引擎

v4.2 将固有risk, 信任分与审批strategy拆开建模: 

```text
inherent_risk = f(operation, domain, data_class, blast_radius, reversibility)
automation_mode = f(trust_score, domain_cap, policy)
approval_policy = f(inherent_risk, automation_mode, org_policy)
```

硬约束: 

- `trust_score` 不得降低 `inherent_risk`, 只能降低低risktask的confirmation频率, 排队摩擦或人工复核强度. 
- `trust_score` 不得bypass合规审批, data分级, sandbox, egress 控制, budget hard cap 或不可逆副作用confirmation. 
- DomainRiskProfile 可以提高固有risk, 也可以收紧审批; 放松平台defaultrisk必须有审计理由和 P2 policy approval. 

TrustScore 只allows影响: low-risk confirmation frequency, 同一 risk tier 内的 queue priority, post-execution sampling rate. 不得影响: approval required threshold, sandbox level, egress policy, budget hard cap, 不可逆副作用confirmation. 

```text
RiskAssessmentRequest
  → 计算 risk_score
  → query tenant riskstrategycoverage
  → 确定 risk_level
  → 匹配 risk_action_rule
  → output RiskDecision { level, actions[], requires_approval, evidence_level }
```

**risk控制动作矩阵**: 

| risk_level | autoexecute | log级别 | 审批        | side effect | evidence |
| ---------- | -------- | -------- | ----------- | ----------- | -------- |
| low        | ✅       | info     | 否          | 正常        | 基础     |
| medium     | ✅       | warn     | 否          | 正常 + validation | augmentation     |
| high       | ❌       | error    | 必须        | 受限        | 完整     |
| critical   | ❌       | critical | break-glass | default禁止; onlyallows受限可追责动作 | 法务级   |

critical default deny. break-glass 只能在限时, 限 scope, 双人审批, forensic logging, 事后复盘的条件下allows受控动作request, 不得bypass SideEffectManager, BudgetAllocator, RuntimeStateMachine 或 NonOverridableInvariantRegistry; 不可逆副作用仍需 confirmation / reconciliation / compensation path. 

## 10.4 risk缓释机制

sandbox mode · read_only mode · write_limited mode · approval gate · dry_run · shadow mode · canary · rollback plan mandatory · evidence bundle mandatory

---

# 11. 安全可靠架构

## 11.1 统一identity模型

所有动作都必须有 principal. 

**principal type**: user · service · agent · worker · plugin · system

**要求**: 所有 event / audit / decision / incident 关联 principal. 所有 incident 可追 principal chain. 

## 11.2 统一authorization模型

三层: 

- **RBAC**: 角色级permissions
- **Capability**: 能力级permissions (can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events) 
- **Context-aware policy**: 结合 tenant / project / workflow / environment / risk level / data class dynamic决策

authorization决策record为 `PolicyOutcome`, contains decision / matched_rules / evaluation_duration, 支持审计和strategy调优. 

## 11.3 Secret 安全

- secret onlyallowsreferences, 不明文传递
- secret injection短时有效 (TTL ≤ 300s) 
- secret 不进入 memory / knowledge
- artifact output前做 secret scan
- logs / traces / audit 统一做 secret redaction

## 11.4 Sandbox 安全

四档: read_only · workspace_write · scoped_external_access · restricted_exec

任何高risk动作都不应directly full access. 

**技术implementation规格**: 

| Sandbox Tier           | 隔离技术         | filesystem                | 网络                  | process   | 资源limit    |
| ---------------------- | ---------------- | ----------------------- | --------------------- | ------ | ----------- |
| read_only              | 子process + seccomp | 只读挂载                | 禁止                  | 单process | 256MB / 10s |
| workspace_write        | 子process + seccomp | tmpfs 写 + workspace 写 | 禁止                  | 单process | 512MB / 30s |
| scoped_external_access | 容器 (可选)      | tmpfs 写                | egress allowlist only | 多process | 1GB / 60s   |
| restricted_exec        | 容器             | overlay fs              | egress allowlist      | 多process | 2GB / 300s  |

每个 sandbox tier 必须声明 Linux / macOS / Windows / Kubernetes 的可implementation方式, 不可用时降级strategy和逃逸testing用例. 无法提供等价隔离时只能降级到更严格模式或rejectexecute, 不得silentlyuses host full access. 

## 11.5 网络出站安全

所有外部call经过 egress control. 控制维度: destination allowlist · adapter binding · credential binding · data class · environment · operation type. egress deny 必须作为正式安全事件record. 

## 11.6 data分级

基础分级: public · internal · confidential · restricted

扩展标签: pii · regulated · secret-bearing

分级影响: 可否入模型 · 可否外发 · 可否进入知识 · 是否必须审批

DataTaintPropagation 硬规则: 任何output, artifact, memory candidate, tool result 或 summary 的 data_class 不得below其输入集合中的最高 data_class, 除非existsexplicitlysanitized证明, field级 redaction report 和 reviewer / policy evidence. taint_labels 必须随 DelegationResult, ToolOutput, PromptExecutionRecord, MemoryWriteRequest 和 Explanation artifact 传播. 

## 11.7 插件安全

插件视为不可信扩展. 要求: independentprocess · 资源limit · IPC 边界 · capability 白名单 · outputvalidation · crashed隔离 · 可 quarantine · 可热禁用. 

供应链安全基线: plugin signing, SBOM required, dependency vulnerability scan, runtime minimum privilege, sandbox egress allowlist, prompt-injection-to-tool-call attack simulation. 无signature, 无 SBOM 或高危dependency未处置的第三方插件不得进入 production registry. 

`PluginTrustStore` 必须声明 trust root, signing key rotation, signature revocation list, security advisory channel 和 quarantine policy. signature密钥泄露, SBOM 高危未修复或 advisory forced patch 触发时, 平台必须支持冻结新安装, 隔离活跃运行, 生成 tenant impact report, 并保留只读导出和rollback说明. 

Secret lease 规则: checkpoint never stores secret value; resume must request new secret lease; secret lease renewal requires active run + policy recheck; 续租failure必须回收凭证并将 NodeRun 转入 awaiting_hitl 或 failed-safe state. 

插件crashed或 quarantine 必须触发 cleanup hook: 关闭filehandle, socket, 临时目录, 浏览器会话, secret lease 和外部 callback subscription. cleanup hook timeout后由 PluginSupervisor force隔离process, 并向 `RunTerminationCleanup` 追加 plugin cleanup receipt; 不得让crashed插件继续持有外部资源至 TTL 自然expiry. 

## 11.8 威胁模型 (STRIDE) 

| 威胁                       | 攻击面                        | 缓释措施                                                |
| -------------------------- | ----------------------------- | ------------------------------------------------------- |
| **S**poofing (masks)        | API call, Agent identity          | JWT/API Key 认证 + Principal 链追溯                     |
| **T**ampering (tamper)       | event log, artifact, prompt   | append-only event + CAS + content hash validation             |
| **R**epudiation (抵赖)     | 操作不可追溯                  | 全链路审计 + evidence bundle + 不可变 audit log         |
| **I**nformation Disclosure | Prompt 泄露, Secret 泄露, PII | Secret redaction + data分级 + Prompt 不对终端暴露       |
| **D**enial of Service      | API 过载, Worker 耗尽         | 限流 + 背压 + 按 tenant 配额 + circuit breaker          |
| **E**levation of Privilege | Plugin 越权, Agent 提权       | Sandbox tier + capability 白名单 + context-aware policy |

**补充威胁**: 

| 威胁                      | 攻击面                     | 缓释措施                                        |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| Prompt Injection          | user输入injectionmalicious指令       | 输入 sanitization + output validation + Sandbox limit  |
| Model Manipulation        | malicious fine-tune / jailbreak | 质量门禁 (§17) + output安全check                   |
| Data Exfiltration via LLM | 模型记忆敏感data           | data_classification 路由 (§15.3) + PII 不入模型 |

## 11.9 加密strategy

传输加密, 存储加密和 Key manage详见 §23.5 加密架构. 本节强调安全层的约束: 

- 所有平面间通信必须 TLS 1.3 (process内除外) 
- P5 存储的 PII field必须应用级加密 (不dependencydata库 TDE) 
- Secret 存储集成 Vault (或等效 KMS) , 应用层only持有references
- 审计log必须containsintegritysignature (HMAC) , 防止事后tamper

---

# 12. 异常事件handle架构

> E1-E6 分类和 SEV1-4 分级, 含**可观测性data模型**和**auto检测规则**. 

## 12.1 异常事件分类

- **E1 业务异常**: validation fail · wrong output · no result · low confidence
- **E2 execute异常**: timeout · worker crash · lease expired · retry exhausted
- **E3 外部dependency异常**: adapter failure · provider timeout · rate limit · circuit open
- **E4 安全异常**: unauthorized access · secret leak risk · egress deny · policy violation
- **E5 data异常**: stale projection · event append failure · invariant break · replay inconsistency
- **E6 治理异常**: rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 异常等级

- SEV4: 局部轻微, 可auto恢复
- SEV3: 单 workflow / 单 worker 影响
- SEV2: 单业务域 / 单tenant明显受影响
- SEV1: 平台级影响 / 安全事件 / 生产严重risk

## 12.3 异常检测规则引擎

> 将异常检测从"hardcoded"升级为"规则引擎". 

**内置规则示例**: 

| 规则                      | 条件                       | 等级 | 动作                                         |
| ------------------------- | -------------------------- | ---- | -------------------------------------------- |
| worker_heartbeat_missing  | heartbeat_gap > 30s        | SEV3 | create_incident + lease_reclaim              |
| execution_timeout_spike   | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised)             |
| projection_lag_high       | lag > 30s                  | SEV3 | notify + rebuild_trigger                     |
| security_policy_violation | any violation              | SEV2 | create_incident + quarantine                 |
| platform_wide_failure     | error_rate > 50% in 1min   | SEV1 | create_incident + mode_switch(incident-mode) |

## 12.4 可观测性data模型

> 定义可观测性具体指标. 

### 核心 Metrics

| 指标名                         | type      | 标签               | 说明            |
| ------------------------------ | --------- | ------------------ | --------------- |
| `harness.run.total`             | counter   | tenant, status     | HarnessRun 总数 |
| `harness.run.duration_ms`       | histogram | tenant, run_type   | Run 端到端耗时  |
| `harness.node_run.duration_ms`  | histogram | tenant, node_kind  | NodeRun execute耗时 |
| `harness.node_attempt.failure_rate` | gauge | tenant, error_type | Attempt failure率  |
| `harness.dispatch.queue_depth`  | gauge     | queue_class        | 队列深度        |
| `harness.dispatch.queue_max_depth` | gauge   | queue_class        | 队列硬upper limit      |
| `harness.dispatch.latency_ms`   | histogram | queue_class        | 调度延迟        |
| `harness.worker.active`         | gauge     | pool, capability   | 活跃 worker 数  |
| `harness.projection.lag_seconds` | gauge    | projection_name    | Projection 延迟 |
| `harness.approval.pending_count` | gauge    | severity           | 待审批数        |
| `harness.budget.orphaned_reservation_count` | gauge | tenant, resource_type | 超过 TTL 且未 settle/release 的预算预留数 |
| `harness.circuit_breaker.state` | gauge     | target             | 断路器state      |
| `harness.dlq.depth`             | gauge     | category           | DLQ 深度        |

Legacy `agent.*` / `workflow_run.*` / `step.*` metrics 只能由 compatibility adapter 从 harness metrics 派生, 不得作为新告警, SLO 或容量规划的data源. 

### Structured Log 规范

每条log必须为 JSON 格式, contains以下必填field: 

| field                | type    | 说明                                              |
| ------------------- | ------- | ------------------------------------------------- |
| `timestamp`         | ISO8601 | 毫秒precision, UTC 时区                                |
| `traceId`           | string  | 关联分布式 Trace (§12.7)                          |
| `spanId`            | string  | 当前 Span 标识                                    |
| `level`             | enum    | DEBUG / INFO / WARN / ERROR / FATAL               |
| `service`           | string  | 发出log的服务名                                  |
| `plane`             | enum    | P1-P5 / X1, 标识所属平面                          |
| `crosscutting_fabric` | enum? | reliability / security / governance, only X1 loguses |
| `message`           | string  | 人类can read的简短描述                                |
| `structuredPayload` | object  | 业务上下文键值对 (tenantId, domainId, taskId 等)  |

**log级别uses准则**: DEBUG onlyused forlocal开发; INFO record正常业务流转; WARN record可auto恢复的异常; ERROR record需人工介入的故障; FATAL record导致process退出的严重error. 生产环境default级别为 INFO. 

## 12.5 DLQ 与 Incident

**DLQ 必须有**: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ 不是垃圾桶, 必须可运营. 

state机: 

```text
IncidentState = detected → triaged → mitigating → resolved → reviewed → closed
DLQState = recorded → claimed → replaying → resolved | discarded | escalated
```

每个异常类必须绑定 `error_code_namespace`, `incident_severity`, `mode_switch_rule`, `owner_team`, `replay_allowed` 和 `side_effect_safe_to_replay`. DLQ redrive 可能重新触发外部副作用时, 必须先进入 simulation 或完成幂等confirmation. 

**Incident 必须关联**: affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution. 

## 12.6 告警路由架构

> Incident 产生后必须路由到正确的人. 

| SEV 级别 | notification渠道              | response SLA   | 升级规则              |
| -------- | --------------------- | ---------- | --------------------- |
| SEV4     | 平台控制台 + log     | 下个工作日 | 无                    |
| SEV3     | IM notification (Slack/飞书)  | 4h         | 4h 无response → SEV2      |
| SEV2     | IM + Email + on-call  | 1h         | 1h 无response → SEV1      |
| SEV1     | IM + 电话 + 全员广播  | 15min      | 15min 无response → manage层 |

**外部集成**: via Webhook 对接 PagerDuty / OpsGenie / 企业 IM. 平台不内置告警通道implementation, only定义路由规则和投递interface. 

告警路由必须支持 dedupe, suppression, maintenance window 和 escalation cooldown; 同一 root cause 的duplicate告警不得bypass冷却windowdirectly升级. 

## 12.7 分布式 Tracing 架构

> 定义 trace → span → log → metric 的关联模型. 

**Span 层级**: 

```text
Trace (harnessRunId)
  └─ Span: harness_run
       ├─ Span: stage_rationale.observe
       ├─ Span: stage_rationale.assess
       ├─ Span: plan_graph
       │    └─ Span: llm_call (model_gateway)
       ├─ Span: dispatch
       ├─ Span: node_run
       │    └─ Span: node_attempt
       │         └─ Span: tool_call / llm_call / hitl_wait / side_effect
       └─ Span: state_write
```

**关联规则**: 

- 所有 StructuredLog 必须contains trace_id + span_id (已有) 
- Metrics via exemplar 关联 trace_id (高基数指标采样) 
- Incident 关联 trigger trace_id, 支持从 incident 追溯到完整call链
- 采样strategy: error trace 100% 采集, normal trace 按 tenant configure (default 10%) 

---

# 13. OAPEFLIR 受控认知框架

> v4.2 收敛口径: OAPEFLIR 是 Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release 的认知与治理框架, 不是execute引擎. 唯一可executeruntimeentry是 HarnessRuntime, 唯一权威运行实体是 HarnessRun. OAPEFLIR 阶段只能作为 StageRationale, TraceProjection, Audit View 和解释视graphexists, 不拥有independentexecute权. 

一句话概括: 

```text
OAPEFLIR v4.2 = Controlled Cognitive/Governance Semantics over HarnessRuntime
```

## 13.1 定位: 语义框架, 不是execute引擎

OAPEFLIR 定义每个 HarnessRun 在认知, 治理, 反馈和发布上的阶段语义. 它不创建independent Run, 不directly驱动state迁移, 不directly调度 worker, 也不directly提交 side effect. 

**force不变量**: 

1. 任何task只能创建一个 HarnessRun. 
2. OAPEFLIR 不创建independent Run. 
3. OAPEFLIR 阶段state只能作为 trace / projection / rationale exists. 
4. HarnessRun state迁移是唯一可executestate迁移. 
5. OapeflirTraceProjection 可从 HarnessRun / HarnessStep / NodeRun 事件派生, 但不得反向驱动execute. 

OAPEFLIR 只allows产出以下投影对象: `StageRationale`, `AssessmentSummary`, `PlanRationale`, `FeedbackSummary`, `LearningCandidate`, `ImprovementProposal`, `ReleaseDecisionView`. 禁止 OAPEFLIR 拥有 run status, step status, lease, retry counter, side effect commit state 或 budget state. 

Learn / Improve / Release 归口: Learn 只生成候选; Improve 只准备 proposal; Release 是 P2 Release Governance decision, 不是 OAPEFLIR 自行发布. 

## 13.1.1 OAPEFLIR → HarnessRun 投影关系

| OAPEFLIR 阶段 | Harness 权威对象 | record形态 |
| --- | --- | --- |
| Observe | HarnessRun.input / ContextSnapshot | StageRationale + observation projection |
| Assess | ConstraintPack / RiskAssessment / PolicyOutcome | StageRationale + risk/audit projection |
| Plan | HarnessRun.plannerOutput.planGraphBundle | StageRationale + plan graph artifact |
| Execute | HarnessStep / NodeRun / ToolCall / SideEffectRecord | execution trace + node events |
| Feedback | EvaluationReport / HarnessDecision | feedback envelope + decision record |
| Learn | LearningCandidate | async intelligence job + quarantine state |
| Improve | ImprovementChangeSet | proposed change artifact |
| Release | P2 ReleaseRecord / EvaluationGate | rollout / approval / audit projection |

## 13.2 八阶段职责边界

| 阶段 | 职责 | 标准产物 | 是否可directly产生副作用 |
| --- | --- | --- | --- |
| Observe | 观察输入, 事件, 上下文, 目标 | ObservationBundle | 否 |
| Assess | risk, permissions, 可行性, 预算, strategy评估 | AssessmentBundle | 否 |
| Plan | 生成可execute PlanGraph | PlanGraphBundle | 否 |
| Execute | execute Graph Node, call工具 / LLM / HITL / Subgraph | NodeRun / NodeAttemptReceipt | 受控 |
| Feedback | 对execute结果, 偏差, 质量, risk进行反馈 | FeedbackEnvelope | 否 |
| Learn | 从反馈中提取候选经验 | LearningCandidate | 否 |
| Improve | 生成 Prompt / Policy / Tool / Domain 改进候选 | ImprovementChangeSet | 否 |
| Release | 评测, 审批, 灰度, 发布, rollback | ReleaseRecord | 是, only限configure发布 |

## 13.3 OAPEFLIR 与五平面关系

| 平面 | OAPEFLIR-Harness 关系 | 关键contract |
| --- | --- | --- |
| P1 Interface | 输入统一进入 RequestEnvelope, 不把原始自然语言直传 Runtime | RequestEnvelope, SessionContext |
| P2 Control | 提供strategy, 审批, 预算, 版本lock和发布治理 | EffectivePolicySnapshot, OperationalDirective, DecisionDirective, EvaluationGate |
| P3 Orchestration | 承载 Observe / Assess / Plan / Feedback / Learn / Improve / Release 语义 | HarnessRun, PlanGraphBundle, DecisionInputBundle, OapeflirTraceProjection |
| P4 Execution | execute ready NodeRun, 不可bypass Graph validation和副作用治理 | NodeRun, SideEffectRecord, ReconciliationRecord |
| P5 State & Evidence | 保存 truth, event, checkpoint, artifact, audit, 支持 replay 与 lineage query | Event Registry, BudgetLedger, RunVersionLock |

## 13.4 阶段间data流

```text
RequestEnvelope
  └─→ Observe ─→ ObservationBundle
        └─→ Assess ─→ AssessmentBundle + EffectivePolicySnapshot
              └─→ Plan ─→ PlanGraphBundle
                    └─→ Normalize / Validate / Risk Propagate / Worst-Path
                          └─→ Graph Scheduler ─→ NodeRun
                                ├─→ Tool / LLM / HITL / Subgraph
                                ├─→ SideEffect Manager
                                ├─→ Reconciliation / Compensation
                                └─→ NodeAttemptReceipt
                                      └─→ Feedback ─→ HarnessDecision
                                            ├─ accept
                                            ├─ retry_same_plan
                                            ├─ replan → GraphPatch
                                            ├─ escalate_to_human
                                            ├─ downgrade_mode
                                            └─ abort

FeedbackEnvelope ─→ Learn ─→ LearningCandidate
                         └─→ Improve ─→ ImprovementChangeSet
                                  └─→ Release ─→ EvaluationGate / Approval / Canary / Rollback
```

## 13.5 Harness 外部语义映射

OAPEFLIR 八阶段是平台内部认知内核. 对产品方, 业务方和多 Agent 协作场景, 提供一层简化的 **Harness 角色映射**: 

| Harness 角色        | OAPEFLIR 阶段映射                       | 职责边界                                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| **Planner**         | Observe + Assess + Plan                 | 理解目标, 分解task, 识别risk, 生成executeplan, 选择工具与资源预算, 产生验收标准 |
| **Generator**       | Execute (委托 P4)                       | call工具, executestep, 写回证据, 生成阶段性结果, 遇到blocks时request帮助而非硬闯     |
| **Evaluator**       | Feedback + 局部评估 + 质量门            | 判断结果质量, check目标偏离, checkrisk升高, 决定via/重做/降级/升级到 HITL     |
| **Loop Controller** | Learn + Improve + Replan + Release gate | 控制循环次数, 决定何时 replanning, 何时审批, 何时终止, 何时发布改进结果      |

```text
            ┌─────────────────────────────────┐
            │       Harness Runtime (§45)      │
            │                                  │
            │  ┌─────────┐    ┌───────────┐   │
 Request ──>│  │ Planner │───>│ Generator │   │
            │  │(O+A+P)  │    │(Execute)  │   │
            │  └────┬────┘    └─────┬─────┘   │
            │       │               │          │
            │       │    ┌──────────▼────────┐ │
            │       │    │    Evaluator      │ │
            │       │    │(Feedback+Quality) │ │
            │       │    └──────────┬────────┘ │
            │       │               │          │
            │  ┌────▼───────────────▼────────┐ │
            │  │     Loop Controller         │ │
            │  │  (Learn+Improve+Replan+     │ │
            │  │   Release gate)             │ │──> Result
            │  └─────────────────────────────┘ │
            └─────────────────────────────────┘
```

两层映射的意义: 

- **对内**: OAPEFLIR 保持精细阶段控制, 每个阶段有independentinterfacecontract和 Zod validation
- **对外**: Harness 四角色语义更易理解, 便于多 Agent 协作协议标准化
- **对调试**: 可在 Harness 粒度观测全链路, 也可下钻到 OAPEFLIR 单阶段

**双模型uses硬规则**: 对外协议一律uses Harness 角色语义 (Planner/Generator/Evaluator/Decision) ; 对内implementationallows继续以 OAPEFLIR 八阶段细分. 

| 受众视角    | uses模型               | 典型场景                             |
| ----------- | ---------------------- | ------------------------------------ |
| 产品/业务   | Harness 四角色         | 需求沟通, 能力介绍, API 文档         |
| runtime/调度 | HarnessRun / PlanGraph | execute引擎, LoopController, state机推进 |
| 审计/合规   | HarnessRun/HarnessStep | 运行证据链, 合规报告, 审批record       |
| ML/算法     | OAPEFLIR 八阶段        | 模型评测, prompt 调优, 阶段性能analysis  |

## 13.6 OAPEFLIR-Harness 核心不变量

1. HarnessRun / NodeRun state机必须封闭, 终态不得迁出. 
2. 所有state迁移必须 event-driven, 且 truth update 与 event append 同transaction. 
3. 复杂task的 Plan 必须是 Graph; 线性 steps only可作为单节点或 legacy 展示. 
4. Graph execute前必须完成 Normalize, Validate, Risk Propagation, Worst-Path Analysis. 
5. Graph Scheduler 必须 deterministic; 每次 ready node 选择必须写事件, 支持 Trace Replay. 
6. Retry / Redrive 必须追加 AttemptLineage, 不得coverage旧 attempt. 
7. LLM / Tool / SideEffect / Evaluation 前必须 reserve budget; budget exhausted 优先于 retry / replan. 
8. SideEffect ambiguous 不得auto视为 success, 不可逆副作用必须 confirmation / reconciliation / manual review. 
9. Replay 不得产生真实副作用. 
10. Learn / Improve 不得directly上线, 必须进入 EvaluationGate 与 P2 Release 治理. 

## 13.7 Plan 必须是 Graph

PlanGraph 是 HarnessRun plannerOutput 的主execute结构, 也是 OAPEFLIR Plan 阶段的投影视graph. 它explicitly表达concurrent, dependency, join, terminal, 补偿和risk传播边界, 避免线性 steps 隐藏真实dependency. 

**graph化硬规则**: 

- 每个 PlanGraph 必须至少有一个 entry node 和一个 terminal node. 
- 所有 nodeId / edgeId 必须稳定, 便于 event, checkpoint, lineage references. 
- concurrent只由 ready node 集合表达, 不allows worker 自行推断. 
- 高risk node 必须带 `riskProfile`, `approvalRequirement`, `compensationPolicy`. 
- 子task, 委托, 多 Agent 协作必须作为 Subgraph 或 ChildRun explicitly建模. 

## 13.8 PlanGraph contract

| 对象 | 必填content | Description |
| --- | --- | --- |
| PlanGraphBundle | planGraphId, graphVersion, graph, schedulerPolicy, budget, riskProfile, validationReport, evidenceRefs | P3 → P4 的正式executeplan载体 |
| PlanGraph | nodes, edges, entryNodeIds, terminalNodeIds, graphMetadata | 可executegraph本体 |
| PlanNode | nodeId, kind, inputs, expectedOutputs, toolPolicy, riskProfile, budgetReservationHint | 最小execute单元 |
| PlanEdge | edgeId, from, to, condition, edgeKind | dependency, 条件, 补偿, failurepath |
| GraphPatch | baseGraphVersion, operations, compatibilityReport, reason, auditRef | Replan 的追加式变更 |

## 13.9 Graph Normalization

Normalization 将 Planner 产物收敛为可executegraph: 

- 生成稳定 nodeId / edgeId
- 补齐 entry / terminal / failure terminal
- 将隐式serialorder转为explicitly edge
- 将高risk node 标注 approval / compensation / sandbox
- 将预算提示split到 node 级 reservation hint

Normalization 必须output `GraphNormalizationReport`, 并作为 evidence 保存. 

## 13.10 Graph Validation

Validation 是 P4 execute前的force准入门. 必须至少validation: 

- DAG / 受控循环合法性
- entry / terminal exists且可达
- no deadlock / no orphan / no impossible join
- node kind 有对应 executor 或 HITL handler
- risk, 预算, tool, sandbox, approval configure完整
- 不可逆副作用有 confirmation / reconciliation / manual review path
- GraphPatch 与 baseGraphVersion compatibility

`validationReport.valid=false` 的graph不得进入 `ready`, 只能 replan, escalate 或 abort. 

受控循环必须explicitly建模为 `LoopNode`, 不得用隐式 edge cycle 表达. LoopNode 必须声明 `max_iterations`, `budget_per_iteration`, `termination_condition`, `loop_evidence_ref`, `state_carryover_policy` 和 `timeout_action`; missing少任一field时 Graph Validation failure. 

## 13.11 Graph Risk Propagation

risk不是 node 局部属性. GraphRiskPropagator 必须沿dependency边传播risk, 计算: 

- 全graph最高risk
- 每条path累计risk
- 高risk node 对下游 output / memory / side effect 的 taint
- 需要审批, 隔离 worker, 降级模式的 node 集合

## 13.12 Graph Worst-Path Analysis

Worst-Path Analysis 在execute前估计最坏path的时间, 成本, token, 工具call, 审批等待和补偿成本. 未知概率按 worst-case; 可选branch按最大成本path; parallel join 按 max latency + sum cost; LoopNode 按 max_iterations 估算. 若最坏path超过 ConstraintPack 或 BudgetLedger 的硬upper limit, PlanGraph 不得execute, 必须 replan 或 escalate. 

## 13.13 GraphPatch 与 Replan

Replan 不coverage旧graph, 而是追加 GraphPatch: 

```text
PlanGraph(v1) + GraphPatch(v2 operations) → PlanGraph(v2)
```

GraphPatch 必须声明 baseGraphVersion, patch reason, 受影响 node/edge, compatibility性报告和审计references. 已完成或已提交不可逆副作用的 node 不得被silently删除; 只能via补偿, skipsubsequentpath, 追加修复节点或人工接管handle. 

`GraphPatchOperation` 是闭合枚举, 禁止自定义字符串扩展: 

| operation | Description | 硬约束 |
| --- | --- | --- |
| add_node | 追加新节点 | 必须声明 node kind, budget hint, risk class |
| add_edge | 追加dependency边 | 不得形成未authorization循环 |
| disable_edge | 禁用未executepath上的边 | 必须证明不会skip已提交副作用的补偿path |
| add_compensation_node | 追加补偿节点 | 必须关联 sideEffectId / compensationPlanRef |
| add_failure_path | 追加failurehandlepath | 必须连接到 failure terminal 或 HITL |
| mark_skipped | 标记未execute节点skip | 只能used for未 leased / running / terminal 节点 |
| append_subgraph | 追加子graph | 子graph必须via完整 Graph Validation |

GraphPatch schema 必须contains: `patchId`, `baseGraphVersion`, `newGraphVersion`, `operations[]`, `affectedExecutedNodes[]`, `affectedSideEffects[]`, `compatibilityClass`, `compensationPlanRef?`, `policyProofRef`, `auditRef`. `compatibilityClass` 只能是 `safe_append / requires_checkpoint_revalidation / requires_human_approval / incompatible_restart_required`. 已execute节点, 已有 NodeAttemptReceipt, confirmed/ambiguous SideEffect 的语义不得被改写. 

## 13.14 OAPEFLIR 与 Evaluation / Learning / Release 的闭环关系

Feedback 只产生事实与建议; Learn 只产生 LearningCandidate; Improve 只产生 ImprovementChangeSet. 任何 Prompt / Policy / Tool / Domain 改进必须进入 EvaluationGate, 经过离线评测, 回归集, risk扫描, 审批, 灰度与rollbackstrategy后才可 Release. LLM-as-Judge 可作为辅助评分, 但不能coverage确定性failure, strategyreject, 安全违规, 预算耗尽或 replay inconsistent. 

---

# 14. Runtime Execution Plane

> 核心职责定义, 含**executestrategy模式**和**Executor 注册机制**. 

## 14.1 核心职责

HarnessRun / PlanGraph / NodeRun / NodeAttempt 生命周期 · dispatch / queue / worker 调度 · lease / fencing · executor call · side effect 受控提交 · retry / timeout / recovery · mode-aware execution · NodeAttemptReceipt 回报 · platform fact 事件发射

## 14.2 Dispatcher 智能调度

Dispatcher 同时是risk隔离点, 调度决策矩阵: 

| 因子                | 影响                             |
| ------------------- | -------------------------------- |
| worker capability   | 匹配 node 所需能力               |
| worker health       | 排除不健康 worker                |
| queue class         | priority / standard / background |
| node risk class     | 高risk node 分配到隔离 pool 或 HITL |
| node budget state   | 无 active reservation 的 node 不得调度 |
| tenant quota        | 单 tenant 不超过配额             |
| sandbox requirement | 匹配 sandbox tier                |

## 14.3 executestrategy模式

> 将executestrategy从hardcoded升级为可configure模式. 

每个 Business Pack 可以声明自己的 ExecutionStrategy coveragedefault值. 

## 14.4 Executor 注册机制

> 将 executor 从hardcoded升级为可插拔注册. 

**内置 Executor type**: ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect 提议与提交entry

1. Executor return proposed side effect
2. Policy / approval 决定是否allows进入 commit
3. SideEffect Manager record delivery semantics 与confirmationstrategy
4. 提交后进入 confirmation / reconciliation / compensation (见 §14.11-§14.13) 

> 工具executesuccess, 不等于副作用已正式生效; 只有 confirmed 的副作用才可作为success事实. 

## 14.6 HumanWait 是正式execute器

审批等待不是旁路. HumanWait 负责: creates decision → blocks execution → waits resolution → resumes flow. 

## 14.7 Recovery Worker 族

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

每个 Recovery Worker 必须声明自己的 `RecoveryCadence` (check间隔, 最大concurrent恢复数, timeout) , 并via `RecoveryReport` 汇报结果. 

## 14.8 Runtime 模式切换

**规范模式集** (与 §9.5 一致) : full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

其中 `full_auto` 对应旧称 `normal`, `supervised_auto` 对应旧称 `degraded`/`supervised`. 所有runtime模式必须uses此规范枚举. 

模式切换权归 P2 Control Plane, via `OperationalDirective(type: "mode_switch")` 下发. 

## 14.9 Deterministic Graph Scheduler

P4 不再消费隐含order的 steps, 而是消费 `PlanGraphBundle`. Graph Scheduler 只调度满足dependency, strategy, 预算, lease, worker capability, risk isolation 的 ready node, 并按确定性strategysort. 

| strategy因子 | Description |
| --- | --- |
| priority | node explicitly优先级, 数值越高越先调度 |
| risk_class | 高risk node 优先进入隔离队列或 HITL |
| critical_path_rank | 位于 worst path 的 node 可优先减少尾延迟 |
| created_order | 作为稳定 tie-breaker, 保证 replay 一致 |
| scheduler_seed | 同一 graph + policy + recorded ready set 产生同一调度order; 调度决策必须写事件 |

Scheduler 不得根据 worker local时间, 随机数或不可回放外部state决定order; 所有调度选择必须写入事件. 

Scheduler event 必须record: 

```yaml
ready_set:
selected_node_ids:
ordering_policy_version:
worker_pool_snapshot_ref:
decision_reason:
queue_class:
queue_depth_before:
max_queue_depth:
```

DispatchQueue 必须是 bounded queue. `queue_depth >= max_queue_depth` 时不得继续接收普通 NodeRun; critical NodeRun 只能usesindependent emergency lane, 且 lane 也必须有硬upper limit. 超过硬upper limit的可重试调度request进入 `dispatch_backpressure_rejected` 事件; 不可丢弃事件写入 DLQ, 等待 operator redrive. 

## 14.10 NodeRun State Machine

`NodeRun` 是 P4 的最小executestate实体. 标准state: 

```text
created → ready
ready → leased → running → succeeded
                         ├→ failed
                         ├→ retry_wait → ready
                         ├→ awaiting_hitl
                         ├→ reconciling
                         ├→ dependency_failed
                         ├→ policy_blocked
                         └→ cancelled / aborted
```

终态集合为 `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted`. dependency未满足或调度未挑选的节点不得以 `blocked/queued` masks成可execute NodeRun; 此时应保持在 PlanGraph 调度视graph中, 待可execute后再instantiation为 `NodeRun` 并进入 `ready`. `retry_wait` 是非终态, 必须record `wakeAt`, `retryPolicyRef`, `attemptId` 和 backoff reason, 到期后只能via RuntimeStateMachine 迁回 ready 或进入 failed/aborted. 补偿不是 NodeRun success终态; 补偿事实必须record在 SideEffectRecord / CompensationRecord. 终态不可迁出; retry / redrive 必须创建新 attempt 并追加 AttemptLineage. 所有state迁移必须based on RuntimeStateMachine + CAS + active lease + fencing token. 

实体边界: `HarnessStep` 是语义 step, 可展开成一个或多个 `NodeRun`; `NodeRun` 是可executegraph节点实例; `NodeAttempt` 是 `NodeRun` 下的 retry / redrive attempt. 重试不得新建 NodeRun, 除非 GraphPatch 明确追加新节点. 

### RunTerminationCleanup

HarnessRun 或 NodeRun 进入终态后必须synchronous触发 `RunTerminationCleanup`, 并以 cleanup receipt 作为终态证据的一partial. cleanuporderfixed为: 

```text
stop new leases
→ revoke active secret leases
→ release / settle open budget reservations
→ close plugin/browser/file/socket resources
→ cancel pending timers and callbacks
→ mark pending HITL / approval scopes expired
→ compact or schedule-retain ContextSnapshot
→ emit cleanup_completed or cleanup_failed
```

任一cleanupstepfailure不得rollback终态; 必须生成 `cleanup_failed` incident, 并由 RecoveryWorker / Sweeper 按幂等键重试. Secret lease 与 budget reservation 的释放必须与 cleanup event 同transaction或via outbox 保证最终可见. 

## 14.15 NodeRun Terminal Reason Codes

| reasonCode | 适用state | Description |
| --- | --- | --- |
| `success_criteria_met` | succeeded | 节点success且验收条件满足 |
| `tool_error_retry_exhausted` | failed | 可重试工具error已耗尽 |
| `schema_validation_failed` | failed / policy_blocked | output或输入 schema 不合法 |
| `policy_denied` | policy_blocked | P2 / Guardrail 明确reject |
| `budget_exhausted` | failed / aborted | 预算耗尽且不可继续 |
| `dependency_failed` | dependency_failed | 上游必需节点failure |
| `condition_not_met` | skipped | branch条件未命中 |
| `human_cancelled` | cancelled | 人工cancel或 takeover 后终止 |
| `panic_aborted` | aborted | PlatformPanic / kill 指令中止 |
| `compensation_completed_after_failure` | failed / aborted | 原动作failure或终止后, 关联 CompensationRecord 已完成; NodeRun state不改写为 compensated |

failure, skip, cancel和strategy阻断必须用 terminal reason code distinguish, 禁止把所有非success统一塞入 `failed`. 

## 14.11 SideEffect Manager v4.4

SideEffect 从"两阶段record"升级为交付语义完整的state机: 

```text
proposed
  → approved
      ├→ committing
      │    → committed
      │    → confirming
      │    → confirmed
      ├→ revoked
      └→ expired

committing / confirming
  → ambiguous
  → reconciling
  → confirmed | compensation_required | manual_review_required
```

**副作用硬规则**: 

- 工具return success 不等于副作用 confirmed. 
- `ambiguous` 不得auto视为 success. 
- `approved` 只是authorizationwindow, 不是提交事实; approval expiry, 撤回或 scope 不匹配时必须进入 `expired` / `revoked`, 两者均为不可提交终态; 若需继续execute, 必须重新创建 SideEffectRecord 或重新审批. 
- commit 前必须重新validation: approval 仍有效, budget reservation 已持有, policy 仍compatibility, risk 未升高或已被explicitlyaccepts, operator scope coverage本次副作用. 
- 不可逆副作用必须有 confirmation, reconciliation 或 manual review. 
- compensation 只能追加补偿record, 不得删除原始副作用证据. 
- replay / simulation 环境必须禁用真实 side effect, 只能产出 simulated receipt. 

## 14.12 Reconciliation Worker

当外部system timeout, 连接中断, commit receipt loss或幂等键state不明时, Reconciliation Worker 接管对账: 

| Status | 触发 | subsequent动作 |
| --- | --- | --- |
| pending | SideEffect ambiguous | query外部state或幂等键 |
| matched | 外部state与预期一致 | 标记 confirmed |
| diverged | 外部state与预期inconsistent | 创建 incident + compensation_required |
| unknown | 无法confirmation | 升级 manual_review_required |
| expired | 对账windowexpiry | 按risk等级 escalate / abort / compensate |

Reconciliation 结果必须关联原始 SideEffectRecord, NodeRun, traceId, external idempotency key 与 evidence bundle. 

## 14.13 Compensation Manager

Compensation Manager manage可逆, 副作用补偿和人工修复path. 补偿不是rollbackdata库state, 而是对外部世界追加一个可审计的修复动作. 不可补偿的副作用必须在 PlanGraph 阶段标记为 `irreversible`, 并在execute前提高审批与confirmation要求. 

补偿state机: 

```text
compensation_required
  → compensation_planned
  → compensation_approved
  → compensation_committing
  → compensation_confirmed | compensation_failed | manual_review_required
```

补偿failure不得删除原始 side effect; 必须保留原始证据, 补偿尝试, 外部response和人工confirmationrecord. 

## 14.14 Retry / Redrive / AttemptLineage

Retry 是同一 NodeRun 的auto重试strategy; Redrive 是人工或恢复流程触发的新 attempt. 两者都必须追加 AttemptLineage: 

| field | Description |
| --- | --- |
| attemptId | 单次尝试唯一标识 |
| parentAttemptId | retry / redrive 来源 |
| reason | timeout / transient_error / operator_redrive / reconciliation_fix |
| inputSnapshotRef | 本次尝试uses的冻结输入 |
| outputRef | output或errorreferences |
| budgetReservationRef | 预算预留record |
| terminalStatus | 本次尝试终态 |

AttemptLineage 是审计和 replay 的事实来源, 不得coverage, 压缩或删除. 

---

# 24. configure治理架构

> 定义完整的configure治理模型. 

## 24.1 configure分层

| 层         | 示例                          | 变更频率 | 审批要求    |
| ---------- | ----------------------------- | -------- | ----------- |
| 平台default   | retry_max=3, timeout=5000ms   | 极低     | ADR 级      |
| 环境coverage   | prod.timeout=10000ms          | 低       | P2 审批     |
| tenantcoverage   | tenant_A.max_concurrent=50    | 中       | tenantmanage员  |
| 业务包coverage | coding.retry_max=5            | 中       | Pack 负责人 |
| runtimedynamic | circuit_breaker.threshold=0.3 | 高       | auto规则    |

runtimeconfigure按生效边界再分为: 

| Type | Description |
| --- | --- |
| admission_locked_config | run admitted 时冻结进 RunVersionLock, 运行中不变 |
| checkpoint_revalidated_config | resume / redrive / checkpoint 恢复时重新validation |
| hot_reloadable_config | 可热更新, 但不得改变已运行 NodeRun 的语义 |
| emergency_override_config | 安全紧急coverage; 只能收紧strategy并追加 P0 审计和 Evidence |

`emergency_override_config` 只能execute deny, pause, egress block, sandbox harden, secret revoke, admission stop, forced pause/abort 等收紧动作; 不得放松strategy, 扩大 capability, 切换到更危险工具, 降低 sandbox tier, 提高预算 hard cap 或bypass RunVersionLock. hot_reloadable 只能影响新 admission 或下一 checkpoint revalidation, 不得改变正在运行的 NodeRun 语义. 

## 24.2 configure版本化

- 每次configure变更生成新版本, 保留完整历史
- 支持 diff: 展示两个版本间的差异
- 支持 rollback: 一键fallback到arbitrary历史版本
- configure变更发射 `config.changed` 事件, 触发相关组件热加载

runtime必须周期性execute `ConfigDriftReconciler`: 对比 versioned defaults, 环境coverage, tenantcoverage, 实际process加载值和 RunVersionLock 中的冻结值. 发现未authorizationdrift, 热加载failure, 不同 worker pool configureinconsistent或 emergency override expiry未恢复时, 生成 `config.drift_detected` incident; 影响安全, 预算, egress, sandbox 或 approval 的drift必须 fail closed. 

## 24.3 configure灰度

高riskconfigure变更 (如 timeout, 限流阈值) 支持灰度: 

1. 先应用到 canary 环境
2. 观察 30 分钟无异常
3. 扩展到 10% 流量
4. full发布

configure灰度必须声明 rollback guardrail: 

```yaml
rollback_metrics:
  max_error_rate:
  max_policy_denial_spike:
  max_latency_regression:
  max_incident_rate:
```

## 24.4 configure安全

- 敏感configure (secret, credential) 只存references, 不存明文
- configure变更审计, record who / when / what / why
- 关键configure (sandbox tier, egress allowlist) 变更必须 P2 审批

`ConfigImpactAnalyzer` 是高riskconfigure发布前的force门禁, 必须列出受影响 tenant, active HarnessRun, domain, pack, connector, policy, budget 和 approval route. 若影响 high/critical run, egress, sandbox, secret, budget 或 policy strictness, 必须阻止directlyfull发布, 改走 canary / checkpoint revalidation / explicit override. 

---

# 25. data与state一致性架构

平台的state分为五个层次, 自上而下分别服务于控制, execute, 上下文, 知识和证据. 各层在隔离性, 生命周期和一致性要求上各不相同: 

```text
┌─────────────────────────────────────────────────────┐
│  L1  Control State     (Policy/Approval/Budget)      │  §11-§13, §45.20
│      生命周期: 跨 run · 强一致 · 变更需审批          │
├─────────────────────────────────────────────────────┤
│  L2  Execution State   (HarnessRun/NodeRun/Checkpoint) │  §14-§16, §45.15
│      生命周期: 单 run · transaction一致 · checkpoint 可恢复  │
├─────────────────────────────────────────────────────┤
│  L3  Context State     (Session/Turn/Variables)      │  §45.5 ContextManager
│      生命周期: 单 session · 最终一致 · 可快照         │
├─────────────────────────────────────────────────────┤
│  L4  Knowledge State   (Working/Long-term/Shared)    │  §45.16 Memory Namespace
│      生命周期: 跨 run/跨 agent · 异步synchronous · 可晋升   │
├─────────────────────────────────────────────────────┤
│  L5  Evidence State    (Event/Trace/Metric/Audit)    │  §25-§29, §58-§59
│      生命周期: 永久追加 · 不可变 · 可回放重建         │
└─────────────────────────────────────────────────────┘
```

五层之间的关键不变式: L2 的每次state变更必须synchronous追加 L5 事件; L3→L4 的晋升由 Evaluator 裁决 (§45.16) ; L1 变更必须经 P2 审批后才可作used for L2/L3. 

## 25.1 一致性principle

不追求globally强一致, 追求: truth state transaction一致 · event append 同transaction · projection 最终一致 · replay 可重建 · side effect 可审计. 

## 25.2 真相表 + Event Log 双模型

- 真相表保存当前state (读优化) 
- Event log 保存历史changes (审计/回放优化) 
- 两者在同一transaction中更新, 保证一致

## 25.3 CAS + Lease + Fencing

所有关键更新必须based on: expected status CAS · active lease · fencing token. 这是execute层一致性的硬约束. 

所有 truth 写入必须via唯一transactionentry: 

```text
RuntimeStateMachine.transition(command)
```

该entry必须在同一transaction内validation expectedStatus, active lease, fencing token, RunVersionLock, policy guard, budget precondition 和 side-effect safety, 并synchronous写入 truth update + platform fact event + outbox + audit ref. bypass该entrydirectly更新 truth 表视为 invariant violation. 

## 25.4 Projection 必须可重建

所有 projection 都必须: idempotent · replay-safe · event_id deduplication · 支持 rebuild · 不反写真相. 

## 25.5 State & Evidence 分层

| 层         | content         | 用途                                     |
| ---------- | ------------ | ---------------------------------------- |
| Truth      | 当前控制真相 | state判断, concurrent控制, 调度推进             |
| Event      | 历史changes轨迹 | 时间线重建, 回放, 故障解释               |
| Projection | query模型     | Console, 报表, 审批队列                  |
| Audit      | 审计record     | 谁对什么做了什么                         |
| Artifact   | large objectcontent   | observation/plan/log/evidence/screenshot |
| Checkpoint | execute恢复点   | 断点恢复, repair, replay 起点            |

## 25.6 一致性模型与保证级别

| 操作              | 一致性保证                    | implementation机制                                  |
| ----------------- | ----------------------------- | ----------------------------------------- |
| Truth table 写入  | 强一致 (单分区线性一致)       | CAS + fencing token + 同transaction event append |
| Event append      | 强一致 (与 truth 同transaction)      | outbox pattern (§7.3)                     |
| Projection 读取   | 最终一致 (lag ≤ 5s SLO, §27)  | 异步 projector + event_id deduplication            |
| Cross-tenant query | 最终一致                      | Projection 聚合, 不跨 truth transaction          |
| Cross-region 复制 | 最终一致 (lag ≤ 30s, §52)     | 异步 replication + failover reconciliation for unreplicated leader writes |

**Read-your-own-writes 保证**: 写入 truth table 后, 同一 principal 的subsequent读requestvia read-after-write token directly读 truth table, 不dependency projection. Projection path不保证 read-your-own-writes. 

**Projection 最终一致window**: 正常运行 lag ≤ 5s; event bus 背压时 lag 可达 60s (触发 Level 2 告警, §9.2) ; Projection rebuild 期间特定 projection 暂时不可用, Console 显示 stale 标记. 

读path矩阵: 

| 场景 | 读取来源 |
| --- | --- |
| approval decision page | truth, 禁止 stale projection |
| dashboard aggregate | projection, 可显示 freshness |
| run detail after mutation | truth + read-after-write token |
| audit report | event/audit store |
| incident forensic view | truth + event + artifact evidence |

CAS 热点重试strategy: `max_retries=3`, backoff = `20ms, 50ms, 100ms + jitter`; 仍failure则 requeue scheduler tick, 不得忙等. 

## 25.7 Schema 迁移strategy

当前 `SchemaInventoryService` 会从 authoritative schema 与 extension DDL 汇总完整逻辑表 inventory (§26.3) , 但 MVP 交付不得以full inventory 为验收口径. Ring 1 只allowsuses §26.5 的 MVP 表集; 其余表必须标注 Phase/Ring 后再迁移. 

- **向后compatibility变更** (新增列, 新增index) : 在线 migration, 无停机
- **破坏性变更** (列rename, type变更, 表split) : 双写window (old schema + new schema 同时写入 → 切换读path → 停写旧 schema → cleanup) 
- **Migration 版本追踪**: 每个 migration 脚本有 monotonic version, via `schema_migrations` 表追踪已execute版本
- **rollback能力**: 每个 migration 必须有对应 rollback 脚本
- **存储演进关联**: Schema migration strategy与存储演进path (§26.2 E1→E4) 对齐 -- E1/E2 uses SQLite migration, E3/E4 uses PostgreSQL migration

## 25.8 HarnessRun / NodeRun state一致性

v4.2 将 HarnessRun 与 NodeRun state作为 P5 truth 的一级对象. OAPEFLIR 阶段state只作为 `OapeflirTraceProjection` 派生, 不参与可executestate迁移. 所有state迁移必须满足: 

- expected status CAS success
- active lease 未expiry
- fencing token 匹配
- state迁移在state机allows集合内
- truth update 与 event append 在同一transaction内完成

`HarnessRun` 标准state: created · admitted · planning · ready · running · pausing · paused · resuming · replanning · compensating · completed · failed · aborted. 

`NodeRun` 标准state: created · ready · leased · running · retry_wait · awaiting_hitl · reconciling · succeeded · failed · skipped · cancelled · dependency_failed · policy_blocked · aborted. 

终态封闭规则: completed / failed / aborted / succeeded / skipped / cancelled / dependency_failed / policy_blocked 作为终态后不得迁出; 任何修复必须以 redrive, compensation, GraphPatch 或 child run 追加方式表达. `retry_wait`, `awaiting_hitl`, `reconciling` 是非终态等待态, 必须有 wake condition 或 external resolution record. 

## 25.9 Budget Ledger 一致性

Budget Ledger 是 run 级预算事实来源, 不再dependency分散的 token 统计. LLM, Tool, SideEffect, Evaluation, HITL 等可能消耗预算的动作必须先 reserve, 再 consume 或 release. 

```text
reserve → consume
        └→ release
        └→ expire
```

预算硬规则: 

- budget exhausted 优先级高于 retry / replan / evaluator accept. 
- reservation 必须绑定 runId, nodeRunId, attemptId, principal, reason. 
- consume 不得超过 reservation; 超额必须创建 incident 或 require approval. 
- replay defaultuses shadow ledger, 不影响真实预算. 

## 25.10 RunVersionLock

每个 HarnessRun 在 admitted 时冻结 `RunVersionLock`, lock定本次运行uses的 Prompt, Policy, Tool, Domain, Model, Eval, Guardrail, RuntimeProfile 和 schema version. 运行中configure发布不得改变已运行 run 的语义; 只能viaexplicitly GraphPatch, OperationalDirective 或 redrive uses新版本. 

RunVersionLock 目标: 

- 支撑 Trace Replay 与事故审计
- 避免半途中 Prompt / Policy drift
- 支撑事故审计和发布rollback
- 明确 learn / improve 生成候选时的来源版本

### VersionLockOverridePolicy

GraphPatch 与 RunVersionLock conflict时, 必须按以下strategyhandle: 

| strategy | Description |
| --- | --- |
| inherit_lock | GraphPatch 必须uses原版本 |
| compatible_minor_only | 只allowscompatibility minor 版本 |
| explicit_override | 可突破lock, 但必须 HITL + Evidence + Replay Isolation |
| force_restart | 不allows patch, 必须新建 HarnessRun |

defaultstrategy: low / medium riskuses `compatible_minor_only`; high / critical riskuses `inherit_lock`. 

## 25.11 多 Region 写入边界

v4.2 不承诺多主 truth 写入. CAS, Lease, Fencing, Budget Ledger 和 SideEffect Commit 只在 partition leader 内有效: 

```text
single-leader per partition
follower reads
async replication
controlled failover
```

硬规则: 

- Follower region 不accepts truth writes. 
- Failover 后生成新的 fencing epoch. 
- 旧 leader 恢复后必须作为 follower 加入. 
- CRDT onlyallowsused for非关键, 非财务, 非副作用的统计型 aggregate. 

---

# 26. 存储架构

> 先定义**存储抽象层**, 再给出**渐进式演进path**. 

## 26.1 Repository 抽象层

所有上层代码via Repository interface 访问存储, 不directly操作data库. 

这一层的意义: 

- 上层不关心底层是 SQLite / PostgreSQL / 其他
- 可以单元testing时uses in-memory implementation
- 可以渐进式从 SQLite 迁移到 PostgreSQL

## 26.2 存储演进path

| 阶段          | 存储引擎              | 适用场景         | 切换方式            |
| ------------- | --------------------- | ---------------- | ------------------- |
| E1 开发/原型  | SQLite (WAL mode)     | 单节点, 10 concurrent  | default                |
| E2 小规模生产 | SQLite + Redis cache  | 单节点, 50 concurrent  | configure切换            |
| E3 中规模生产 | PostgreSQL            | 多节点, 500 concurrent | Repository implementation替换 |
| E4 大规模生产 | PostgreSQL + 分表归档 | 集群, 5000+ concurrent | Schema 演进         |

**切换principle**: Repository interface 不变, 只替换implementation. 先迁移读多写少的表 (projection, audit) , 后迁移核心写path (truth, event) . 

## 26.3 核心表设计 (逻辑模型) 

> 当前仓内via `src/platform/five-plane-state-evidence/truth/schema-inventory-service.ts` maintained authoritative table inventory. 文档保留两种互补视graph: 一套服务于迁移execute, 一套服务于架构沟通. 

**execute/迁移视graph (4 类) **: 

- `core_truth`: 55 表
- `runtime_extension`: 18 表
- `governance_extension`: 9 表
- `reliability_extension`: 4 表

**架构/认知视graph (7 Group) **: 

### Group 1: Workflow & Execution (21 表) 

task, execute, 租约, 事件, 会话, worker 与 workflow 主链. 
代表表: tasks · executions · execution_* · workflow_* · sessions · session_events · worker_snapshots · outbox

### Group 2: Decision & Policy (12 表) 

审批, strategy, 配额, 治理门禁与操作决策. 
代表表: approvals · action_proposals · entitlement_decisions · governance_gate_events · quota_counters · skill_execution_policies

### Group 3: Knowledge & Artifact (13 表) 

artifact, memory, experience cache, pack/prompt 资源, marketplace listing 与感知资料. 
代表表: artifacts · memories · experience_cache · pack_* · prompt_* · marketplace_listings · perception_sources

### Group 4: Ops & Governance (10 表) 

DLQ, 死信, 实例快照, 远程log, 密钥租约与企业治理报表. 
代表表: dead_letters · dlq_records · event_dead_letters · secret_leases · remote_log_entries · enterprise_governance_reports

### Group 5: AI Operations (9 表) 

评测, 成本, usage 与analysis事实. 
代表表: eval_* · cost_* · usage_events · analytics_facts · pmf_validation_reports

### Group 6: Domain & Organization (12 表) 

tenant, 组织, naming空间, 账单与部署绑定. 
代表表: tenants · tenant_* · organizations · workspaces · data_namespaces · deployment_bindings · billing_*

### Group 7: Maturity & Lifecycle (9 表) 

发布, 归档, 演化, 环境推进, data迁移与 replay data集. 
代表表: release_* · archive_bundles · evolution_logs · environment_promotion_history · replay_datasets

**完整 inventory 当前为 86 张逻辑表**. 该数字只used for架构沟通和 schema inventory golden test, 不是 MVP 建表目标. implementation时按 `category`, `documentedGroup` 和 delivery ring 渐进迁移; 未标注 Ring/Phase, owner, migration, rollback 和 test_ref 的表不得进入主线 migration. 

## 26.4 v4.2 Runtime 表落点

v4.2 收敛后的 Harness / OAPEFLIR 运行对象必须在存储层有明确落点. implementation时优先复用现有 truth / event / execution 表; 确需物化为新表时, 必须synchronous更新 `SchemaInventoryService`, migration 版本, §26.3 inventory 和rollback脚本. 

| 运行实体 | 推荐表 / Repository | 存储strategy | 所属 Group | 迁移阶段 |
| --- | --- | --- | --- | --- |
| HarnessRun | `harness_run` | 唯一权威 run truth; OAPEFLIR 只生成 trace projection | Group 1 | E1 |
| NodeRun | `node_run` | NodeRun 作为最小execute truth; 旧 step projection 由 adapter 派生 | Group 1 | E1 |
| NodeAttempt / AttemptLineage | `node_attempt` | append-only, 关联 nodeRunId / parentAttemptId | Group 1 | E1 |
| PlanGraphBundle | `plan_graph` + artifact ref | graph JSON 存 artifact, truth 表存 id/version/hash/status | Group 1 / Group 3 | E1 |
| GraphPatch | `graph_patch` | append-only, baseGraphVersion + operations + auditRef | Group 1 | E1 |
| BudgetLedger | `budget_ledger` + `budget_reservation` | reservation / consume / release 同transaction写 event; MVP 真实 LLM/tool 前置 | Group 2 / Group 5 | E1 |
| RunVersionLock | `run_version_lock` | admitted 时冻结, subsequent只读 | Group 7 | E1 |
| SideEffectRecord | `side_effect` | proposed→confirmed state机, 外部幂等键唯一index | Group 1 / Group 4 | E1 |
| ReconciliationRecord | `reconciliation_record` | ambiguous 后创建, 对账结果 append-only; 真实外部写前必须上线 | Group 4 | E2 |
| DecisionInputBundle | artifact ref + `decision_record` | bundle large object入 artifact, 裁决摘要入 truth | Group 2 / Group 3 | E1/E2 |
| HumanResponsibilityRecord | `human_responsibility_record` | 人工操作责任边界, 关联 audit log | Group 2 / Group 4 | E1 |
| LearningCandidate | `learning_candidates` 扩展或 `oapeflir_learning_candidates` | quarantine / approved / rejected / released state机 | Group 5 / Group 7 | E3 |
| Event Registry Metadata | `event_registry_entries` | 事件type, schemaVersion, replayBehavior 注册表 | Group 4 | E1/E2 |

**迁移约束**: 

- v4.3 第一批 migration 必须coverage HarnessRun, NodeRun, NodeAttempt, PlanGraphBundle, GraphPatch, BudgetLedger, BudgetReservation, Event Registry Metadata, RunVersionLock. 
- BudgetLedger, SideEffectRecord 必须在任何 LLM/tool/side effect execute前完成; ReconciliationRecord 必须在任何真实外部写操作上线前完成. 
- 旧 workflow / execution 表进入compatibility期后只allows adapter 读写, 不得再新增bypass NodeRun 的executepath. 
- 若新表导致 inventory 统计changes, 必须在同一 PR 更新 §26.3, 版本历史和 schema inventory golden testing. 

## 26.5 MVP 表集裁剪

v4.3 MVP 不以 86 表full模型为交付目标, 而以 22 张以内完成最小生产闭环: 

```text
tenant
principal
task_draft
confirmed_task_spec
idempotency_record
harness_run
plan_graph
graph_patch
node_run
node_attempt
lease_record
budget_ledger
budget_reservation
side_effect
approval_request
decision_record
human_responsibility_record
event_log
event_outbox
event_inbox
checkpoint
artifact_record
audit_record
tool_definition
tool_call
```

`task` 不作为 MVP truth 表; `task_draft` 和 `confirmed_task_spec` 是 pre-admission intake truth, used for阻止未confirmation自然语言directly进入 RequestEnvelope. `lease_record` 是 MVP 必需 truth, used for NodeRun active lease, fencing token, expiry扫描和 worker crash recovery. 若必须严格 ≤20 张表, 可合并 `task_draft + confirmed_task_spec`, `event_inbox + event_outbox`, `approval_request + decision_record`, 但不建议删除 `lease_record`, `graph_patch` 或 `human_responsibility_record`. 

`lease_record` 最小index: 

```text
primary key (lease_id)
unique active lease (entity_type, entity_id) where status = 'active'
index (expires_at, status)
index (worker_id, status)
```

Hardening Ring 追加表: 

```text
worker
dlq_record
incident
recovery_job
reconciliation_job
compensation_record
projection_rebuild_job
config_version
prompt_version
model_provider
usage_record
health_snapshot
```

其余表进入 Enterprise Ring. 任何新表必须标注所属 ring, owner, migration, rollback 和 golden test. 

## 26.6 MVP Physical Schema Baseline

MVP 第一批 migration 必须围绕 Intake / HarnessRun / PlanGraphBundle / GraphPatch / NodeRun / NodeAttempt / Lease / Event Inbox-Outbox / Budget / SideEffect / HITL / Audit 建立真实物理边界. 下表是首批 schema 的最小验收, 不要求一次implementation 86 张逻辑表. 

| 表 | 必备field | 必备index / 约束 | 写entry |
| --- | --- | --- | --- |
| `task_draft` | `task_draft_id`, `tenant_id`, `raw_input_ref`, `risk_preview`, `clarification_state`, `status` | `(tenant_id, status)` | `IntakeService.createDraft/clarify` |
| `confirmed_task_spec` | `confirmed_task_spec_id`, `task_draft_id`, `confirmation_receipt_ref`, `task_spec_hash`, `status` | unique `(task_draft_id)` | `IntakeService.confirm` |
| `harness_run` | `harness_run_id`, `tenant_id`, `status`, `confirmed_task_spec_id`, `request_hash`, `constraint_pack_ref`, `version_lock_id` | `(tenant_id, status)`, `request_hash` 幂等index | `RuntimeStateMachine.transition` |
| `plan_graph` | `plan_graph_id`, `harness_run_id`, `graph_version`, `artifact_ref`, `graph_hash`, `status` | unique `(harness_run_id, graph_version)` | `PlanGraphRepository.appendVersion` |
| `graph_patch` | `graph_patch_id`, `harness_run_id`, `base_graph_version`, `new_graph_version`, `operations_ref`, `compatibility_class`, `affected_side_effects_ref` | unique `(harness_run_id, new_graph_version)` | `PlanGraphRepository.appendPatch` |
| `node_run` | `node_run_id`, `harness_run_id`, `plan_graph_id`, `node_id`, `status`, `attempt_count`, `terminal_reason` | unique `(harness_run_id, node_id)`, `(status, updated_at)` | `RuntimeStateMachine.transition` |
| `node_attempt` | `attempt_id`, `node_run_id`, `attempt_no`, `started_at`, `finished_at`, `result_ref` | unique `(node_run_id, attempt_no)` | `NodeAttemptRepository.record` |
| `lease_record` | `lease_id`, `entity_type`, `entity_id`, `worker_id`, `fencing_token`, `expires_at`, `status` | unique active `(entity_type, entity_id)`, `(expires_at, status)` | `LeaseManager.acquire/renew/release` |
| `event_log` | `event_id`, `aggregate_type`, `aggregate_id`, `aggregate_seq`, `event_type`, `payload_hash`, `occurred_at` | unique `(aggregate_type, aggregate_id, aggregate_seq)` | `RuntimeStateMachine.appendPlatformFact` |
| `event_outbox` | `outbox_id`, `partition_key`, `event_id`, `status`, `lease_id`, `next_attempt_at` | `(partition_key, status, next_attempt_at)` | `OutboxPublisher.enqueue` |
| `event_inbox` | `inbox_id`, `consumer_id`, `event_id`, `dedupe_key`, `status`, `processed_at` | unique `(consumer_id, event_id)`, unique `(consumer_id, dedupe_key)` | `EventInbox.consumeOnce` |
| `budget_ledger` | `ledger_id`, `subject_id`, `limit_amount`, `allocated`, `reserved`, `settled`, `currency`, `period` | unique `(subject_id, period)` | `BudgetAllocator.allocate/settle` |
| `budget_reservation` | `reservation_id`, `harness_run_id`, `node_run_id`, `bucket_id`, `amount`, `currency`, `status` | `(bucket_id, status)`, `(harness_run_id, status)` | `BudgetAllocator.reserve/release/settle` |
| `side_effect` | `side_effect_id`, `node_run_id`, `external_idempotency_key`, `status`, `confirmation_ref`, `compensation_ref` | unique `(connector_id, external_idempotency_key)` | `SideEffectManager` |
| `approval_request` | `approval_id`, `harness_run_id`, `node_run_id`, `route_snapshot_id`, `status`, `expires_at` | `(status, expires_at)` | `HITLRuntime` |
| `human_responsibility_record` | `responsibility_id`, `approval_id`, `principal_id`, `decision_type`, `scope`, `evidence_ref` | `(principal_id, decision_type)` | `HITLRuntime.recordResponsibility` |
| `audit_record` | `audit_id`, `principal_id`, `action`, `resource_ref`, `evidence_ref`, `created_at` | `(principal_id, created_at)`, `(resource_ref)` | `AuditLogger` |

任何 MVP schema PR 必须同时提供 migration, rollback, repository contract test 和 `runtime-contracts` 对应 schema; 不能只修改data库或只修改文档. 

---

# 27. 性能架构与 SLO

v4.2 将指标口径拆为三类, 避免 P95/P99 混用: 

| 指标type | 口径 | 用途 |
| --- | --- | --- |
| Internal Platform SLO | P99 | 平台内部组件, 调度, 写入, 恢复, projection |
| User-visible E2E SLA | P95/P99 by tier | user可感知端到端体验, contains LLM/tool provider 延迟 |
| Provider Observed SLO | provider latency/error rate | LLM, 工具, 外部system可用性和路由basis |

## 27.1 OAPEFLIR 阶段性能目标

| 阶段     | P99 目标     | 说明                                |
| -------- | ------------ | ----------------------------------- |
| Observe  | < 50ms       | 信号采集与聚合 (不含外部call)       |
| Assess   | < 30ms       | 评估决策 (不含 LLM call)            |
| Plan     | < 100ms      | DAG 构建与strategy选择 (不含 LLM call)  |
| Execute  | 视 tool 而定 | 受外部dependency约束, 不设统一目标        |
| Feedback | < 10ms       | 信号预handle与deduplication                    |
| Learn    | < 500ms      | 模式检测 (异步, 不blocks主链)         |
| Improve  | < 1s         | Candidate 生成 (异步)               |

## 27.2 Runtime SLO

以下 SLO 是 D3/S3b 以上部署的目标; D1/D2 不得被 Enterprise P99 卡死. MVP 验收优先看功能正确, state一致, replay 可用和稳态阈值. 

| 指标                 | P99 目标 | 降级阈值                 |
| -------------------- | -------- | ------------------------ |
| Dispatch latency     | < 200ms  | > 1s 触发告警            |
| Lease acquisition    | < 50ms   | > 200ms 触发告警         |
| Heartbeat round-trip | < 100ms  | > 500ms 标记 unhealthy   |
| Recovery detection   | < 30s    | > 60s 触发 SEV3 incident |
| Projection lag       | < 5s     | > 30s 触发 rebuild       |
| Checkpoint write     | < 20ms   | > 100ms 触发告警         |
| Event append         | < 10ms   | > 50ms 触发告警          |

## 27.8 Deployment-tier SLO Matrix

| 指标 | D1 单体 / MVP | D2 Worker 分离 | D3 平面分离 | S4 集群 / Enterprise |
| --- | --- | --- | --- | --- |
| Event append P99 | 功能正确 + <100ms 稳态 | <50ms | <20ms | <10ms |
| Checkpoint write P99 | 功能正确 + <200ms 稳态 | <100ms | <50ms | <20ms |
| Lease acquisition P99 | <200ms | <100ms | <50ms | <30ms |
| Dispatch latency P99 | <1s | <500ms | <200ms | <100ms |
| Projection lag P99 | <30s | <15s | <5s | <3s |
| Trace Replay rebuild | 可重建单 run | 可重建batch run | 可重建 projection slice | 可支撑审计batch replay |

D1 只承诺 single-tenant controlled production; regulated/high-risk 域必须 D3+, 跨 Region SLA 必须 S4 + §52 多 Region 规则. 

## 27.3 可用性目标

| 组件            | 可用性 | 降级strategy                  |
| --------------- | ------ | ------------------------- |
| API Gateway     | 99.95% | staticerror页                |
| Control Plane   | 99.9%  | Read-only degradation     |
| Execution Plane | 99.9%  | Worker pool failover      |
| State Plane     | 99.95% | WAL + checkpoint recovery; 99.99% 需auto failover + quorum + warm standby |
| Observability   | 99.5%  | 可丢指标, 不可丢审计      |

## 27.4 容量规划

| 维度          | S1 单体    | S2 多process   | S3a 分布式 | S3b 分布式 | S4 集群 |
| ------------- | ---------- | ----------- | ---------- | ---------- | ------- |
| concurrent workflow | 10         | 50          | 200        | 500        | 1000+   |
| 活跃 worker   | 5          | 20          | 50         | 100        | 200+    |
| Event/s       | 100        | 500         | 2,000      | 5,000      | 10,000+ |
| 存储          | 1GB SQLite | 10GB SQLite | 50GB PG    | 100GB+ PG  | PG 分区 |

## 27.5 性能testing要求

- 每次重大变更前必须运行 load test
- Load test 场景: normal load / peak load / degradation / recovery
- 结果record为 evidence, 与 rollout 关联

## 27.6 Error Budget strategy

> 定义 SLO violates时的组织response. 

**Error Budget 定义**: 可用性 SLO 99.9% → 月度 Error Budget = 43.2 分钟不可用时间. 

| Budget 消耗 | Status | response                                      |
| ----------- | ---- | ----------------------------------------- |
| 0-50%       | 正常 | 正常发布节奏                              |
| 50-80%      | 预警 | 减缓非紧急变更发布                        |
| 80-100%     | 冻结 | onlyallows修复性发布, 暂停 feature rollout    |
| > 100%      | 超额 | 全面冻结 + 专项reliability修复 + manage层 review |

**Burn Rate 告警**: 

- 1h burn rate > 14.4x (1h 内消耗 2% budget) → SEV2 告警
- 6h burn rate > 6x (6h 内消耗 5% budget) → SEV3 告警
- 采用 multi-window strategy减少false positive

## 27.7 LLM 延迟拆解

LLM call通常主导端到端延迟. 必须单独建模: 

| 延迟组成                        | P99 目标 | 说明                                   |
| ------------------------------- | -------- | -------------------------------------- |
| Prompt 渲染                     | < 5ms    | 模板填充 + 变量injection                    |
| ModelGateway 路由               | < 10ms   | Provider 选择 + 预算check               |
| LLM TTFT (Time to First Token)  | < 2s     | Provider SLA, 不可控                   |
| LLM 完整生成                    | < 30s    | dependency output length, 设 max_tokens limit |
| Response 解析 + validation            | < 20ms   | JSON parse + Zod validation                  |
| 总 LLM call                     | < 35s    | 超过则 timeout                         |

**LLM 延迟不计入 Internal Platform SLO**, 但必须计入 User-visible E2E SLA, 并independent作为 Provider Observed SLO 监控. 当 LLM P99 延迟 > 基线 200% 时, 触发 ModelGateway 降级strategy (见 §15.4) . 

---

# 28. Event Registry / Projection / Incident / DLQ 模型

## 28.1 Event Registry 设计principle

Event Registry 是平台事实事件与 OAPEFLIR 语义视graph事件的type, payload schema, replay 行为和 projection 消费规则注册表. 所有事件必须可validation, 可回放, 可deduplication, 可追溯. 

硬规则: 

- 事实事件名采用 `platform.object.action`, 例如 `platform.node_run.succeeded`; OAPEFLIR 只能uses `oapeflir.view.*` 或 `oapeflir.rationale.*`, 不得uses看似 truth 的 `oapeflir.node.*`, `oapeflir.side_effect.*`, `oapeflir.budget.*`. 
- 每个事件必须声明 schemaVersion, aggregateId, runId, sequence, traceId. 
- 每个事件type必须声明 `source_of_truth`, `replayable`, `side_effect_safe_to_replay`, `schema_owner` 和 `consumer_contract_tests`. 
- run 内 sequence monotonic递增; consumer 必须based on eventId deduplication. 
- replayBehavior 必须explicitly声明: `replay_as_fact`, `skip_side_effect`, `simulate`, `forbidden`. 
- 事件 append 与 truth update 同transaction; outbox 投递failure进入 DLQ, 不影响 truth 一致性. 

## 28.2 Event Registry 分层与compatibilitystrategy

v4.3 后 Event Registry 分为三层: `EventEnvelope` 是统一事件信封, `platform.*` 保留平台级事实事件, `oapeflir.view.*` / `oapeflir.rationale.*` 只承载 OAPEFLIR 语义投影事件. 所有层shared eventId, traceId, replayBehavior, schemaVersion 和 projection 订阅模型, 但 truth projection 的权威输入只能是 platform facts. 

| 层级 | 事件range | 用途 |
| --- | --- | --- |
| EventEnvelope | eventId, eventType, aggregateId, runId, sequence, traceId, schemaVersion, replayBehavior | 所有事件的统一信封与validationentry |
| PlatformEvent (`platform.*`) | harness_run, node_run, tool_call, side_effect, budget, approval_flow, rollout, incident, dlq, cost, circuit_breaker, config | truth projection, incident, dashboard, billing, ops 链路的事实来源 |
| OapeflirViewEvent (`oapeflir.view.*` / `oapeflir.rationale.*`) | stage, graph, attempt, decision, hitl, memory, eval, learning, semantic_view | OAPEFLIR 阶段解释, 审计视graph, 语义投影; 不得作为 truth source |

**compatibility映射**: 

| legacy / platform 事件 | v4.2 事实事件 | OAPEFLIR 投影 | handle方式 |
| --- | --- | --- | --- |
| workflow_run.created / failed / completed | platform.harness_run.created / failed / completed | oapeflir.view.run_lifecycle.* | truth projection 消费 platform.harness_run; OAPEFLIR run 事件only作生命周期解释 |
| step_run.* / execution.* | platform.node_run.* | oapeflir.view.node_lifecycle.* | 新implementation以 NodeRun platform fact 为 truth; 旧 step projection 由 adapter 派生 |
| step_attempt.* | platform.node_attempt.* | oapeflir.view.attempt_lineage.* | retry / redrive 统一转为 AttemptLineage, OAPEFLIR 只解释因果链 |
| tool_call.succeeded / failed | platform.tool_call.* | oapeflir.view.tool_output.* | 工具call事实保留 platform 事件, 节点语义投影由 adapter 派生 |
| side_effect.proposed / committed | platform.side_effect.* | oapeflir.view.side_effect.* | committed 后仍需 confirmed / reconciliation 才能作为success事实 |
| decision.requested / approved | platform.decision.* / platform.approval_flow.* | oapeflir.rationale.decision.* / oapeflir.view.hitl.* | auto裁决与人工责任recordsplit |
| rollout.* / eval.* | platform.rollout.* / platform.eval.* | oapeflir.view.eval.* | 发布治理保留 platform rollout, 评测门禁可派生 OAPEFLIR eval 投影 |
| cost.* | platform.cost.* / platform.budget.* | oapeflir.view.budget.* | 财务账单与运行预算事实保留 platform 事件, OAPEFLIR 只投影预算阶段 |
| circuit_breaker.* / config.changed | platform.* | 无或 oapeflir.view.stage.* | 不迁入 OAPEFLIR truth, onlyvia OperationalDirective 影响 HarnessRun |

迁移硬规则: truth projection 必须优先订阅 `platform.harness_run.*`, `platform.node_run.*`, `platform.side_effect.*`, `platform.budget.*` 等事实事件; `oapeflir.view.*` / `oapeflir.rationale.*` 只能used for阶段解释, 审计视graph和语义投影. 旧 projection 在迁移期via adapter 从 platform facts 派生 legacy 事件, adapter 事件必须标记 `derivedFromEventId`; 同一事实不得被 platform 与 OAPEFLIR view 双重计数. 

## 28.3 OapeflirEvent 标准结构

| field | Type | Description |
| --- | --- | --- |
| eventId | string | globally唯一事件 ID |
| eventType | OapeflirEventType | 注册表事件type |
| schemaVersion | number | payload schema 版本 |
| runId | string | 关联 HarnessRun |
| nodeRunId | string? | 关联 NodeRun |
| aggregateId | string | truth 聚合 ID |
| sequence | number | run 内monotonic序号 |
| occurredAt | ISO8601 | 发生时间 |
| principal | Principal | 触发主体 |
| traceId | string | 分布式追踪 ID |
| payload | object | 事件载荷 |
| replayBehavior | enum | 回放行为 |
| evidenceRefs | string[] | 关联证据 |

sequence 是 aggregate-local sequence, 不是globally序号. concurrent NodeRun 只能在同一 aggregate 内dependency sequence 判断order; 跨 aggregate 只能uses causationId, correlationId, traceId 和 occurredAt 推断因果, 不承诺全序. 

## 28.4 OapeflirViewEventType 注册表

| naming空间 | 代表事件 | Description |
| --- | --- | --- |
| oapeflir.view.run_lifecycle | created / admitted / paused / resumed / completed / failed / aborted | HarnessRun 生命周期投影事件, 不代表independent OAPEFLIR 运行实体 |
| oapeflir.view.stage | observing / assessed / planned / feedback_recorded / learned / improved / released | 八阶段推进 |
| oapeflir.view.graph | normalized / validated / validation_failed / risk_propagated / patch_applied | PlanGraph 生命周期 |
| oapeflir.view.node_lifecycle | ready / leased / started / succeeded / failed / awaiting_hitl / reconciling | NodeRun 语义视graph |
| oapeflir.view.attempt_lineage | started / retry_scheduled / redriven / exhausted | AttemptLineage |
| oapeflir.view.budget | reserved / consumed / released / exhausted | Budget 阶段视graph |
| oapeflir.view.side_effect | proposed / approved / committed / ambiguous / confirmed / compensation_required | 副作用治理视graph |
| oapeflir.view.reconciliation | started / matched / diverged / unknown / expired | 对账state视graph |
| oapeflir.rationale.decision | input_frozen / accepted / retry_requested / replan_requested / escalated / aborted | Decision Engine 理由 |
| oapeflir.view.llm | response_recorded / schema_validated / guardrail_blocked | 已record的 LLM output与validation结果 |
| oapeflir.view.tool_output | recorded / tainted / rejected | 已record的工具output与pollute传播 |
| oapeflir.view.scheduler | decision_recorded / lease_assigned / ready_set_evaluated | 可回放的调度决策视graph |
| oapeflir.view.hitl | lock_acquired / requested / approved / rejected / overridden / takeover / timed_out | HITL Runtime 视graph |
| oapeflir.view.memory | write_requested / approved / rejected / promoted | Memory Governance 视graph |
| oapeflir.view.eval | gate_started / gate_passed / gate_failed / regression_detected | EvaluationGate 视graph |
| oapeflir.view.learning | candidate_created / quarantined / approved / rejected / released | LearningCandidate 视graph |

## 28.5 Event Replay Semantics

Replay 分三类: 

| Type | 目的 | 副作用行为 |
| --- | --- | --- |
| projection_replay | 重建query模型 | 只 apply projection, 不call外部system |
| trace_replay | 审计, 事故复盘, 调试, 投影重建 | replay已record events / LLM output / Tool output / Scheduler decisions, 不发起新call |
| re_execution_replay | 回归testing, Prompt 对比, 工具迁移仿真 | 可重新call LLM / Tool, 必须标记 nondeterministic, 不写 production truth |

default审计能力是 Trace Replay, 不假设 LLM 可确定性replay. Re-execution Replay 的output只能进入隔离 evidence namespace, 不得coverage原 HarnessRun 证据. Replay 永远不得真实发送邮件, 付款, 部署, 写外部system或修改生产环境. 需要验证外部state时只能创建 ReconciliationRecord 或人工 review task. 

## 28.6 Projection (9 个) 

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection

Projection 必须 idempotent · replay-safe · event_id dedupe · 可 rebuild · 不反写真相. 

Projection rebuild 流程fixed为: build shadow projection → compare counts/hash → cutover → retain old projection for rollback. rebuild 期间 API 必须return freshness/stale 标记, 不得silently读取半成品 projection. 

## 28.7 Incident 约束

incident 必须链接到: affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record. v4.2 runtime incident 还必须关联 HarnessRun runId, nodeRunId, attemptId, eventId, sideEffectId 或 reconciliationId (如适用) . 

## 28.8 DLQ 约束

DLQ 必须有: category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status. DLQ 不是垃圾桶, 必须支持 inspect, redrive, discard with approval 和 incident linking. 

---

# 29. Knowledge / Memory / Artifact / Learning 边界

本节按四个 contract manage: `MemoryContract`, `KnowledgeTrustContract`, `ArtifactContract`, `LearningCandidateContract`. 四者都可被 P3/P4 读取, 但只有 P5 truth/event/audit 是控制事实来源. 

## 29.1 Knowledge

shared事实, 规则, 流程, 稳定模式. 

**层级**: Personal → Team → Company

**Trust Level**: private_unverified → team_reviewed → official → authoritative

**Promotion**: personal → team → company. 保留 lineage / reviewer decision / trust change / audit event. 

Knowledge contested state下default仍可被检索, 但必须降低 trust, force显示争议来源, 并禁止作为 high/critical autoexecute的唯一basis. authoritative 知识降级必须发出 `knowledge.trust_downgraded` 事件notification消费者. 

## 29.2 Memory

运行态短中期上下文. 会衰减 · 会压缩 · 会被coverage · used for上下文装配. 

Memory 分层明确为 6 层: working → session → episodic → semantic → procedural → meta. 每层有independent的 TTL, 压缩和淘汰strategy. 

default淘汰order: 

| 层 | strategy |
| --- | --- |
| working | facts cannot be silently dropped; compress with loss report |
| procedural | never drop, summarize if needed |
| semantic | rank by trust + relevance + freshness |
| episodic | summarize first, then evict |
| session | bounded by session policy |
| meta | policy-controlled |

ContextAssembly 必须output `ContextTruncationReport`, record被压缩, 被排除, 被降权的 context refs, 原因, data等级和是否影响 high/critical 决策. working facts 不能silently丢弃; 若 token budget 不足, 必须要求 replan, summarize-with-evidence 或 escalate. 

## 29.3 Artifact

execute产物与large object, 不承担控制真相职责. viareferences (artifact_ref) 关联到 HarnessRun / NodeRun / NodeAttempt, 不内联到 event. 

Artifact 必须 immutable, content-addressed, 并record hash, signature, creator, data_class, retention, legal_hold, provenance 和 redaction policy. 对象存储 GC 不得删除仍被 event/audit/legal hold references的 artifact. 

## 29.4 Learning

从反馈中提炼候选模式. Learn 不directly改变线上行为. LearningObject 必须经过 Improve → Validation → Approval → Rollout 才能生效. 

LearningCandidate default进入 quarantine. 候选样本必须viapollute防护, PII/secret scan, holdout deduplication, 多样性check和人工/评测审批; 未发布候选不得影响 production routing, Prompt 或 Memory promotion. 

---

# 30. 业务接入约束与 Business Pack 模型

> Business Pack 必须关联 DomainDescriptor(§37), Pack 的风控, 知识检索, 评估strategy由领域描述符驱动. 

## 30.1 业务包不能bypass的平台能力

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 每个 Business Pack 必须声明

> **约束**: `domain_id` 为必填field, 必须指向已注册且state为 Active 的 DomainDescriptor. Pack 注册时平台autovalidation `domain_id` 有效性, 并将 DomainRiskProfile 的risk覆写应用到 Pack 的 risk_matrix 之上. 

PackCapabilityProfile 为强 schema, 不得用自由text替代: 

```yaml
PackCapabilityProfile:
  tools:
  side_effects:
  data_classes:
  max_risk_class:
  requires_human_roles:
  supported_execution_modes:
```

Pack / Plugin / Connector 生命周期边界: Pack 是业务能力包, Plugin 是受沙箱约束的扩展代码, Connector 是外部system动作边界. Pack 可dependency Plugin 和 Connector, 但不得bypass Connector action-level risk profile 或 Plugin 安全认证. 

`BusinessPackManifest.v1` 必须是强 schema, 至少contains: 

| field | Description |
| --- | --- |
| pack_id / version | Pack identity与 semver |
| domain_id | 关联 Active DomainCoreDescriptor / DomainDescriptor |
| capabilities | 结构化 PackCapabilityProfile, 不allows自由text |
| tools / connectors / plugins | dependency项, 版本range, permissions和 sandbox 要求 |
| side_effects | action-level SideEffect type, 幂等键, 补偿和对账strategy |
| data_classes | 可handledata等级, PII/secret/regulated 标签 |
| eval_requirements | 发布前 eval dataset, golden set 和 denial-path testing |
| compatibility | platform_min_version, schema version, migration policy |

## 30.3 高risk业务default supervised

operations · growth write actions · production release · finance-like actions → 第一阶段default supervised, 不allows full_auto. 

Pack emergency disable strategy: 

| 情况 | handle |
| --- | --- |
| new run | blocked |
| in-flight low risk | continue until next checkpoint |
| in-flight high risk | pause at checkpoint |
| critical security disable | abort immediately + revoke credentials |

## 30.4 Pack 生命周期

> 定义 Pack 从开发到废弃的完整流程. 

| 阶段 | 说明                                 | 要求                     | 产出                           |
| ---- | ------------------------------------ | ------------------------ | ------------------------------ |
| 开发 | uses Pack SDK local开发               | 遵循 Manifest schema     | 代码 + Manifest + eval dataset |
| testing | local mock testing + staging 集成testing    | coverage率 ≥ 80% + eval via | TestReport                     |
| 认证 | 安全审查 + risk评估 + 平台compatibility性check | via Pack check清单       | CertificationRecord            |
| 发布 | 注册到 Pack Registry + rollout       | semver 版本化            | RolloutRecord                  |
| 运行 | 受平台治理约束execute                   | 持续质量监控             | metrics + incidents            |
| 废弃 | 标记 deprecated + 迁移指引           | 至少maintained 6 个月          | DeprecationNotice              |

## 30.5 Pack API compatibility性contract

- Pack Manifest schema 遵循 semver: minor 版本只新增field, major 版本allows破坏性变更
- 平台升级时必须运行 Pack compatibility性testing套件
- 破坏性变更提前 2 个 minor 版本发出 deprecation warning
- 提供 `agent-platform pack migrate` 命令辅助 Pack 升级

Pack compatibility性testing套件由 Platform SDK team 拥有, 并由 `PackCompatibilityTestGenerator` 从 Manifest, OpenAPI, Event Registry, Contract Schema 和 declared capabilities 生成. 每个 Pack 发布时必须保存生成器版本, fixture 版本和testing报告; 平台升级若无法生成或运行compatibility性套件, 升级门禁 fail closed. 

## 30.6 Plugin 治理

| 治理维度 | strategy                                      |
| -------- | ----------------------------------------- |
| 版本manage | semver + Plugin Registry                  |
| dependencymanage | 声明式dependency + conflict检测                     |
| 安全认证 | auto安全扫描 + 人工审查 (高permissions plugin)   |
| 废弃strategy | deprecated 标记 → 3 个月迁移期 → archived |
| compatibility性   | 每个 plugin 声明 min_platform_version     |

---

# 31. 容灾与高可用架构

> 定义从单节点到多 AZ 的高可用strategy. 

## 31.1 单点故障消除

| 组件         | 单点risk | 消除strategy                                  |
| ------------ | -------- | ----------------------------------------- |
| API Gateway  | processcrashed | 多实例 + 负载均衡                         |
| Dispatcher   | 调度中断 | Leader election (lease-based)             |
| Worker       | execute中断 | Lease timeout → auto reclaim                 |
| Event Poller | 事件堆积 | Lease-based 单实例 + 健康check             |
| Database     | dataloss | WAL + 定时备份 / PG streaming replication |

## 31.2 高可用分级

| 级别      | 架构                                 | RTO     | RPO           |
| --------- | ------------------------------------ | ------- | ------------- |
| HA-1 基础 | 单节点 + 定时备份                    | < 1h    | < 15min       |
| HA-2 标准 | 双节点 active-passive + WAL shipping | < 10min | < 1min        |
| HA-3 企业 | 多 AZ active-passive / 单 leader + synchronous复制 | < 1min  | 0 (synchronous复制)  |

HA-3 的 RPO=0 只适used for in-region multi-AZ synchronous复制; cross-region failover default RPO>0, 且只allows metadata-only 预复制或按data驻留strategy复制. 不得把跨 Region data驻留场景写成 RPO=0. 

每次 leader 切换或 failover 必须生成 `FailoverRecord`, `FencingEpochChanged` 和 `RecoveryValidationReport`. 新的 leader 只有在 fencing epoch 更新, 旧 lease 失效, truth/event 一致性validationvia后才能accepts写入. 

跨 Region failover 还必须生成 `FailoverReconciliationJob`, 列出 unreplicated writes, open budget reservations, ambiguous side effects, pending approvals, outbox gaps 和 projection freshness watermark. 该 job 完成前只能进入受限写入模式: 禁止不可逆 side effect, 预算upper limit提升和strategy放松. 

read-only degraded 模式下只保留query, 审计导出, forensic inspection, state看板和人工恢复操作; 禁止新 HarnessRun admission, 外部 side effect, 预算变更, strategy放松和 Pack 发布. 

## 31.3 备份与恢复

- **data备份**: SQLite 阶段uses `.backup()` API, PG 阶段uses pg_basebackup
- **事件回放**: 从 event_log 重建所有 projection 和 artifact catalog
- **configure备份**: config_version 表自带历史, 可arbitraryfallback
- **灾难恢复演练**: 每季度至少一次, record RTO/RPO 实测值
- **恢复validation**: 每次恢复必须对 truth/event/projection 计数, hash, 水位线和抽样业务对象做validation, 并把报告写入 Evidence Plane

DR drill pass/fail 标准: 

| check项 | Pass 条件 |
| --- | --- |
| RTO/RPO | 实测值不超过声明 tier |
| Fencing | 旧 leader 无法继续写 truth / budget / side effect |
| Event replay | projection rebuild 后 hash, 水位线和抽样对象一致 |
| Open obligations | budget reservation, pending approval, ambiguous side effect 均有 reconciliation 结果 |
| Evidence | `RecoveryValidationReport` 与 operator signoff 写入 P5 |

Event replay 不假设无限log保留. P5 必须分层保留: truth/event 最小可恢复window, audit legal hold, artifact retention, projection 可重建cached. GDPR / PIPL 删除via tombstone, 不可逆摘要和 crypto-shredding execute; tombstone 保留最小审计field, 不含 PII/PHI/secret, replay 时used for证明对象已删除而不是恢复原文. 

## 31.4 dataintegrity保护

- 所有写操作via CAS + Lease + Fencing 保护
- Event log uses append-only 模式, 不allows修改历史事件
- Checkpoint uses WAL 保护, processcrashed后可恢复
- Truth table 与 event log 在同一transaction中更新

---

# 32. 部署架构

> 采用**单体优先, 渐进split**strategy. 

## 32.1 部署演进

部署形态必须explicitly声明 security isolation level, tenant isolation level, worker isolation level, supported risk tier 和 not supported capabilities; 不得把单体阶段的逻辑隔离表述为生产强隔离. 

### Phase D1: module化单体

```text
┌─────────────────────────────────────────┐
│            Agent Platform (单process)        │
│                                          │
│  P1 Interface  ──→  P2 Control           │
│       │               │                  │
│       ▼               ▼                  │
│  P3 Orchestration ──→ P4 Execution       │
│       │               │                  │
│       ▼               ▼                  │
│          P5 State & Evidence             │
│                                          │
│        X1 Fabric (middleware)            │
│                                          │
│  [SQLite]  [Redis (optional)]            │
└─────────────────────────────────────────┘
```

适用: 开发, testing, 小规模生产 (≤10 concurrent) . D1 只提供逻辑隔离, 不支持 regulated critical domains, untrusted third-party plugin, multi-tenant strong isolation, 跨tenantshared市场和高risk浏览器/data库写入auto化. 

### Phase D2: Worker 分离

```text
┌─────────────────────┐     ┌──────────────────┐
│   Main Process       │     │  Worker Process   │
│   P1 + P2 + P3 + P5 │────→│  P4 Execution     │
│   + X1               │     │  + tool executors  │
└─────────────────────┘     └──────────────────┘
        │
   [SQLite / PG]  [Redis]
```

适用: 中规模生产 (≤50 concurrent) , worker 可水平扩展. D2 支持 worker 级隔离和partial高risk池, 但不承诺多 AZ 容灾, 跨 Region failover 或第三方插件强沙箱. 

### Phase D3: 平面分离

```text
┌──────────┐  ┌─────────────┐  ┌──────────────┐
│ API GW   │→│ Control +     │→│ Execution    │
│ (P1)     │  │ Orchestration │  │ Workers (P4) │
└──────────┘  │ (P2 + P3)    │  └──────────────┘
              └─────────────┘
                    │
              ┌─────────────┐
              │ State (P5)   │
              │ [PostgreSQL] │
              └─────────────┘
```

适用: 大规模生产 (≤500 concurrent) , 各平面independent扩展. D3 才allows承载强多tenant隔离, 受监管高risk域, untrusted plugin sandbox, browser executor independent池和跨 AZ HA; 进入 S4/Kubernetes 多 Region 前必须完成state迁移演练和 rollback plan. 

| 部署形态 | security isolation | tenant isolation | worker isolation | supported risk tier | not supported capabilities |
| --- | --- | --- | --- | --- | --- |
| D1 | process内逻辑隔离 | 单tenant/弱多tenant | shared worker | low/medium | critical regulated, untrusted plugin, 强多tenant |
| D2 | process/worker 隔离 | tenant 逻辑分区 | independent worker pool | low/high (受限)  | 多 AZ RPO/RTO, 跨 Region, 第三方强沙箱 |
| D3 | 服务/网络/池隔离 | tenant 分区 + policy enforcement | 高risk/浏览器/插件池隔离 | high/critical (需专用池)  | 全球多 Region truth failover |
| S4 | Kubernetes + 多 AZ + 分片 | 强多tenant + home region | Pod/Sandbox/专属池 | enterprise critical | 需要 §52 多 Region 规则约束 |

## 32.2 环境划分

| 环境     | 用途           | 部署形态           | data隔离                |
| -------- | -------------- | ------------------ | ----------------------- |
| dev      | 开发调试       | localprocess /Docker   | 无隔离, shared开发 DB     |
| test     | 单元/集成testing  | CI 环境, 单节点    | testingtenantdata隔离        |
| staging  | 预发布验证     | K8s 单集群         | 按 tenant 分区          |
| pre-prod | 正式发布前灰度 | K8s 多集群         | 生产级隔离              |
| prod     | 正式生产环境   | 多 Region K8s 集群 | 强tenant隔离 + 跨 AZ 容灾 |

**环境Promotionstrategy**: 

```
dev → test → staging → pre-prod → prod
```

- 代码合并到 main 后auto部署到 dev
- PR via后部署到 test
- Release tag 触发 staging 部署
- 预发布验证后手动 promote 到 pre-prod, 再confirmation prod

每次 promotion 必须绑定 rollback runbook: rollback目标版本, schema rollback/forward-fix strategy, config rollback, worker drain, event consumer compatibility, projection rebuild 和 customer impact notice. D1 → D2 → D3 演进不是单向线性流程; 任一环境的 guardrail breach 必须allowsfallback到上一可用部署形态或进入 read-only degraded. 

Emergency hotfix 可bypass常规等待window, 但不得bypass security scan, schema compatibility, contract tests, dual approval, blast radius limit和 post-deploy verification. hotfix promotion 必须声明 expiry, follow-up release 和 evidence bundle; 未在window内补齐正式 release 时auto触发 incident. 

## 32.3 资源池隔离

Worker Pool implementation多层级隔离, 保障不同risk等级和tenant的业务互不影响: 

| Pool 名称                 | 用途                                   | 隔离级别 | 资源配额         |
| ------------------------- | -------------------------------------- | -------- | ---------------- |
| read-only worker pool     | only读操作task (dataquery, 报告生成)      | 低risk   | shared但限流       |
| write-enabled worker pool | 写操作task (state变更, data修改)        | 中risk   | independent资源池       |
| high-risk isolated pool   | 高risk操作 (删除, batch修改, 外部call)  | 高risk   | independent集群+限流    |
| browser worker pool       | 浏览器auto化task (Web 抓取, UI testing)   | independent     | independent worker process |
| plugin isolated pool      | 第三方插件execute                         | 最强隔离 | independent Pod/Sandbox |

**隔离principle**: 

- 不同 pool 之间**网络隔离**, 跨池通信需via API Gateway
- 高risk tenant 可申请**专属 worker pool**, 独占物理资源
- Pool 间调度via**优先级队列**manage, 防止低优先级饿死
- 所有 pool 均支持**水平扩展**, based on queue depth auto scale
- Worker pool 与 P1/P2/P3/P5 之间的跨process通信必须uses mTLS + service identity; 每个 worker lease 绑定 identity, pool, capability 和 fencing token. identity不匹配或证书expiry时不得领取 NodeRun. 

---

# Part II — AI 运营层 (§15-§23) 

---

# 15. LLM Provider 抽象与故障切换架构

> 将 LLM 视为平台最关键的外部dependency, 定义 provider 抽象, 路由strategy和不可用时的降级模式. 

## 15.1 设计principle

- 平台不绑定任何单一 LLM provider
- 所有 LLM callvia统一的 ModelGateway 发出, 上层不directlycall provider SDK
- ModelGateway 是 X1 Fabric 的一partial, 横切 P3 Orchestration 和 P4 Execution
- LLM call视为**高risk外部dependency**, 必须有 timeout, circuit breaker, fallback, cost tracking

## 15.2 ModelGateway interface

ModelGateway 是所有 LLM call的唯一出口, 上层服务禁止directlycall provider SDK. 

| 方法         | 参数                                                 | return值                              | 说明                    |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ----------------------- |
| `chat()`     | modelId, messages[], temperature, maxTokens, timeout | ModelResponse (choices + usage)     | 多轮对话, 最常用entry    |
| `complete()` | modelId, prompt, temperature, maxTokens, timeout     | ModelResponse (text + usage)        | 单次补全, 适合生成场景  |
| `stream()`   | modelId, messages/prompt, maxTokens, timeout, abortSignal | AsyncIterable<ModelStreamChunk> | 流式output, chunk 必须带 sequence, usageDelta, finishReason, validationState |
| `embed()`    | modelId, input (string \| string[]), timeout         | EmbeddingResponse (vectors + usage) | 向量化, used for检索/相似度 |

ModelResponse 统一contains: `requestId`, `model`, `choices`, `usage { promptTokens, completionTokens, totalTokens, estimatedCost }` 和 `latencyMs`. ModelStreamChunk 必须支持 abort, incremental reserve/settle 和 partial validation; resume 只能恢复传输, 不得把未validation partial 当作业务output. 所有callauto附加 traceId, tenantId, costTag, 并纳入 §18 成本计量. 

## 15.3 Provider 注册与路由

**路由strategy**: 

| strategy              | 适用场景          | 说明                             |
| ----------------- | ----------------- | -------------------------------- |
| priority          | default              | 按 priority sort, 首选最高优先级 |
| cost_optimized    | batch/低优先级task | 选择单价最低的可用 provider      |
| latency_optimized | 实时交互          | 选择 P99 延迟最低的 provider     |
| data_residency    | 合规要求          | only选择满足data驻留的 provider    |
| capability_match  | 特殊能力          | 匹配 required_capabilities       |

Provider routing 必须输入以下约束, 不得只按价格或延迟选择模型: 

```yaml
data_residency:
pii_input_detected:
pii_output_possible:
model_training_opt_out_required:
judge_independence_required:
latency_tier:
cost_tier:
```

## 15.4 故障切换链

```text
Primary Provider
  │ timeout / error / circuit_open
  ▼
Secondary Provider (fallback)
  │ timeout / error / circuit_open
  ▼
Tertiary Provider (emergency)
  │ timeout / error / circuit_open
  ▼
Degradation Mode (见 §15.5) 
```

**切换规则**: 

- 单次request timeout (default 30s) → auto切换到下一 provider 重试
- 连续failure > 5 次 (60s window) → 触发 circuit breaker, provider 标记为 unhealthy
- 所有 provider unhealthy → 进入 LLM Degradation Mode
- provider 恢复后via half-open 探测auto回升

## 15.5 LLM 不可用降级模式

当所有 LLM provider 不可用时, 平台必须有明确的降级strategy, 而非简单报错: 

| 降级级别 | 触发条件                          | 平台行为                                                  |
| -------- | --------------------------------- | --------------------------------------------------------- |
| D0 正常  | 至少一个 provider healthy         | 正常路由                                                  |
| D1 受限  | primary down, secondary available | auto切换 + 告警 + limit新 workflow 启动速率                |
| D2 cached  | 所有 provider unhealthy, cached可用 | 对精确cached命中returncached结果; 语义cacheddefault不used for MVP        |
| D3 static  | cached不可用                        | uses预置的 static fallback plan (only低risktask)            |
| D4 暂停  | 所有降级不可用                    | 暂停所有新 workflow, 保护在途 workflow checkpoint, 转人工 |

**cached设计**: 

- `ExactPromptCache`: based on `prompt_ref + canonical params hash + model routing constraints`, 只在输入完全规范化一致时命中
- `SemanticCache`: based on embedding similarity + safe class + human-approved domain; 必须有相似阈值, tenant/data域隔离, cache poisoning 防护和人工批准
- MVP default只implementation ExactPromptCache, 禁止把“语义相似request复用”当作确定性cacheduses
- TTL 按 data_classification 分级: public=1h, internal=15min, confidential=不cached
- cached命中必须标记 `cached: true`, 不计入模型质量评估

Cache warming 是启动门禁的一partial: 每次发布, provider failover 或模型路由变更后, 平台必须预热 health prompt, critical static fallback plan, 低risk模板和 contract test prompts. cached未预热不得把 D2/D3 作为可用降级能力计入 SLA; 只能标记为 `degradation_unready` 并进入 D4/HITL path. 

## 15.6 流式response与errorhandle

`ModelGateway.stream()` 的额外约束: 

| 关注点         | handlestrategy                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 流中断         | 已接收 token 只能作为 partial artifact 保存; 是否可用由 Output Completeness Validator 判定, 不得用length比例启发式                              |
| Token 超限预检 | 发送前根据 `ModelRequest.messages` 估算 input token 数, 若 > provider 的 `context_window - max_tokens` 则reject并return `TOKEN_LIMIT_EXCEEDED`   |
| response格式validation   | stream 完成后对完整output进行 Zod schema validation; validationfailure触发一次 retry (附加 format reminder) ; 二次failurerecord为 `llm.response.validation_failed` |
| timeout           | 流式首 token timeout (TTFT > 10s) 触发 provider 切换; 总时长timeout按 `ModelConstraints.max_latency_ms` execute                                       |
| 背压           | 消费者handle速度 < 生产速度时, 暂停流读取 (backpressure) , 不丢弃 token                                                                        |

## 15.8 Output Completeness Validators

Streaming partial response 只有via格式感知integrityvalidation后才可进入subsequentexecute; 否则只能作为调试 artifact, 不得used for PlanGraph, SQL, 代码, 决策或副作用. 

| outputtype | integrityvalidation |
| --- | --- |
| JSON / schema output | JSON parse success + Zod/schema valid |
| PlanGraphBundle | graph schema valid + 至少一个 entry/terminal + terminal reachable |
| SQL | parser/AST parse success + 只读/写入strategyvalidation + statement 完整结束 |
| 代码/Patch | AST 或 patch parser success + file边界完整 + testing/扫描门禁可运行 |
| Markdown / text | terminal marker 或 provider finish reason 正常; 低置信 partial 必须explicitly标注 |
| HarnessDecision | 枚举合法 + DecisionInputBundle ref exists + precedence policy 可验证 |

## 15.7 可观测性

| 指标                     | type      | 说明                     |
| ------------------------ | --------- | ------------------------ |
| `llm.request.total`      | counter   | 按 provider/model/tenant |
| `llm.request.latency_ms` | histogram | 按 provider/model        |
| `llm.request.error_rate` | gauge     | 按 provider/error_type   |
| `llm.token.usage`        | counter   | 按 provider/model/tenant |
| `llm.cost.total`         | counter   | 按 provider/tenant       |
| `llm.cache.hit_rate`     | gauge     | cached命中率               |
| `llm.fallback.triggered` | counter   | 降级触发次数             |

---

# 16. Prompt manage与版本化架构

> Prompt 是 Agent 的"源代码", 作为一级架构关注点, 定义存储, 版本化, 灰度发布和rollback机制. 

## 16.1 设计principle

- Prompt 不内联在代码中, 而是作为**版本化资源**independentmanage
- 每个 Prompt 有完整的生命周期: draft → review → staging → canary → stable → deprecated
- Prompt 变更等同于代码变更, 必须经过质量门禁 (见 §17) 
- Prompt 与 model 的组合构成 Agent 行为的核心, 两者变更需协同manage

## 16.2 Prompt data模型

每个 Prompt 以 PromptTemplate 为存储单元, 支持多版本manage: 

| field        | type                                                          | 说明                               |
| ----------- | ------------------------------------------------------------- | ---------------------------------- |
| `promptId`  | string (ULID)                                                 | globally唯一标识                       |
| `version`   | number                                                        | 递增版本号, 每次变更 +1            |
| `role`      | enum: planner / generator / evaluator / system                | 标识在 Harness 中的用途            |
| `content`   | string                                                        | 模板正文, uses `{{variable}}` placeholder |
| `variables` | VariableDef[]                                                 | 变量名, type, 是否必填, default值     |
| `metadata`  | object                                                        | 作者, 描述, 标签, 预期 token range  |
| `domainId`  | string                                                        | 所属业务域, 控制可见性与permissions       |
| `status`    | enum: draft / review / staging / canary / stable / deprecated | 生命周期state                       |

同一 `promptId` 可exists多个 version, 但同一时刻only一个 version 处于 `stable` state. 

## 16.3 发布与灰度

**发布流程**: 

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (质量不达标)
                                               rolled_back
```

- staging 阶段必须via eval gate (见 §17) 
- canary 阶段与 stable 版本parallel运行, 按比例分流
- canary 期间持续对比新旧版本的质量指标
- 任何时刻可手动或auto rollback 到上一个 stable 版本

## 16.4 Prompt 组合manage

一个 OAPEFLIR 循环涉及多个阶段的 Prompt, 它们必须作为**原子组合**manage: 

**约束**: 同一 workflow run 内所有阶段uses同一 PromptBundle 版本, 中途不切换. 

PromptBundle 必须声明 `PromptBundleCompatibilityMatrix`, coverage Tool schema, Evaluator schema, DomainDescriptor schema 和 Model routing profile. rollback 或 revocation default只影响新 run; in-flight run 受 RunVersionLock 保护, 除非触发 `BundleRevocationEvent` 并经 HITL / P2 emergency override. 

`BundleRevocationSeverity`: 

| severity | 影响range | 适用场景 |
| --- | --- | --- |
| soft_new_only | 只阻止新 admission | 普通质量fallback |
| checkpoint_switch | 下个 checkpoint revalidation 后切换 | medium riskcompatibility修复 |
| forced_pause | high/critical in-flight run 暂停并等待复核 | injection, 泄露, 坏 canary |
| forced_abort | 立即 abort 受影响 run | 已confirmation安全/合规事故 |

forced_pause / forced_abort 必须生成 platform fact event, incident link 和 affected HarnessRun 列表; 不得silently改变已运行节点的 Prompt 语义. 

Full prompt logging 遵循 `PromptLogRedactionPolicy`: log和 artifact 中的 secret, PII, 客户专有 payload 必须先sanitized或references化, 禁止为了调试完整record敏感 prompt. 

## 16.5 Prompt 安全与injection防御

### 16.5.1 Prompt Injection 防御架构

```text
user输入 / 外部data
    │
    ▼
┌──────────────────┐
│ Input Sanitizer  │  regex + 黑名单 + Unicode 规范化
├──────────────────┤
│ Injection        │  based on分类器检测 injection pattern
│ Detector (ML)    │  (system/user boundary 混淆, 指令coverage, 角色masks)
├──────────────────┤
│ Prompt Assembler │  system/user/assistant 段严格分离
│                  │  usercontentonlyinjection user 段, 绝不进入 system 段
├──────────────────┤
│ Output Validator │  检测 LLM output中的 exfiltration 尝试
│                  │  (URL injection, Markdown link 泄露, 隐蔽指令回传)
└──────────────────┘
```

### 16.5.2 防御strategy

| 层次   | strategy                 | 说明                                                                           |
| ------ | -------------------- | ------------------------------------------------------------------------------ |
| 输入层 | Variable Escaping    | 所有user输入变量injection前做 XML/Markdown 转义, 消除控制字符                       |
| 输入层 | Boundary Markers     | system 和 user 段uses LLM provider 原生 role 分隔, 不dependencytext标记              |
| 检测层 | Injection Classifier | 轻量级分类模型对 injection 概率评分; 只能触发 sanitize / escalate / require_human, 不得单独作为 production hard deny |
| 检测层 | Canary Token         | 在 system prompt 中嵌入 canary token, 若 LLM outputcontains该 token 则判定 injection |
| output层 | Output Sanitizer     | LLM output经过 URL/link filter, PII 检测, 指令模式检测                             |
| 审计层 | Full Prompt Logging  | 每次渲染的完整 prompt 保存为 artifact (confidential 级别以上可选关闭)          |

`PromptInjectionDefenseChain` 不只属于 Prompt manage, 必须联动 Tool Guardrails, Egress Control, Context Assembly 和 Output Validator. 若 Injection Classifier 未有训练data, false positive率, 漏报率和更新流程record, 则只能作为辅助信号; 阻断必须以规则, permissions, data分级, egress, tool capability, sandbox 和最小permissions工程防线为主. 

### 16.5.3 基本principle

- Prompt content不暴露给终端user (防信息泄露) 
- Prompt 变量injection前必须做 sanitization
- contains secret / PII 的变量在 artifact 中做 redaction
- 多轮对话中历史 assistant 消息不可被usertamper
- 外部工具return值视为不可信输入, injection前同样经过 sanitization

---

# 17. 模型评估与质量门禁架构

> 无评估能力的 Agent 平台等于"bare奔上线". 定义模型/Prompt 变更的质量门禁框架. 

## 17.1 评估层次

| 层次     | 触发时机                | 评估content                   | 阻断能力      |
| -------- | ----------------------- | -------------------------- | ------------- |
| 离线评估 | Prompt/Model 变更提交时 | 标准 eval dataset 回归testing | 阻断发布      |
| 灰度评估 | canary 期间             | 新旧版本实时质量对比       | auto rollback |
| 在线监控 | 持续运行                | 质量指标drift检测           | 触发告警/降级 |

## 17.2 Eval Dataset manage

EvalDataset 是质量门禁 (§17.3) 的核心输入, 按业务域independentmaintained: 

| field        | type                         | 说明                                         |
| ----------- | ---------------------------- | -------------------------------------------- |
| `datasetId` | string (ULID)                | globally唯一标识                                 |
| `taskType`  | string                       | 关联的tasktype (如 summarization, routing)   |
| `samples`   | Sample[]                     | 每条contains input, expectedOutput, evalCriteria |
| `version`   | number                       | data集版本, 变更后递增                       |
| `domainId`  | string                       | 所属业务域                                   |
| `split`     | enum: train / eval / holdout | data集划分, holdout onlyused for最终发布门禁       |

**manage要求**: eval 集按risk分级确定最小规模; holdout 集only质量门禁autocall, 禁止在开发/调试阶段uses; data集变更需经 domain_owner 审批. 

| risk等级 | 最小 eval 样本 | 附加要求 |
| --- | --- | --- |
| low | ≥ 50 | coverage主path和常见failure |
| medium | ≥ 200 | coverage边界输入, permissionsreject和成本异常 |
| high | ≥ 500 | 增加对抗样本, 人工标注复核和回归 holdout |
| critical | 领域专家集 + adversarial set + holdout (建议 ≥ 1000)  | 必须contains监管/安全/误用案例, 发布前人工签核 |

## 17.3 质量门禁规则

**内置门禁规则**: 

| 规则                 | 条件                | 说明                              |
| -------------------- | ------------------- | --------------------------------- |
| regression_pass_rate | >= 95%              | eval dataset via率不below基线     |
| critical_case_pass   | == 100%             | critical 标记的 case 必须全部via |
| latency_regression   | <= 120% of baseline | 延迟不超过基线的 120%             |
| cost_regression      | <= 150% of baseline | 成本不超过基线的 150%             |
| quality_score_delta  | >= -0.05            | 质量分不below基线 5 个百分点       |

发布门禁必须同时满足: 

```text
offline_eval_pass
critical_case_pass
online_canary_no_regression
domain_owner_approval
rollback_plan_present
```

## 17.4 在线质量监控

**drift检测**: 

- 滑动window (1h/24h) 统计质量分布
- 当 24h window质量均值下降 > 10%, 触发 SEV3 告警
- 当 1h window质量均值下降 > 20%, 触发auto降级为 supervised mode
- 所有质量信号写入 P5 Evidence Plane, 支撑 Learn 阶段的模式提取

## 17.5 LLM-as-Judge

对于无法用规则判断的质量场景 (如"回答是否合理") , uses LLM-as-Judge: 

- Judge independent性按risk分级: low 可同模型; medium 必须不同模型; high 必须不同 model family; critical 必须不同 provider + deterministic checks
- Judge 结果cached (同一 input+output 不duplicate评估) 
- Judge call本身有成本预算limit (见 §18) 
- Judge 评估结果纳入质量门禁, 但只能补充质量判断, 不得coverage确定性failure
- LLM-as-Judge 不能作为监管级证据, 只能作为辅助质量信号; 监管, 财务, 医疗, 法务等关键结论必须绑定确定性check, 人工签核或外部权威证据. 

当 Judge provider, judge model family 或 Evaluation Harness 不可用时, canary 不得继续auto放量. low/medium risk可降级为 D1 deterministic checks + 人工抽样; high/critical 必须暂停 canary, 保持旧版本或 rollback, 直到independent judge 恢复并补齐评测证据. 

**不可coveragefailure**: policy deny · schema validation failure · budget exhausted · security violation · state-machine invalid · replay mismatch · event append failure · side effect ambiguous · secret / PII leakage. 任一不可coveragefailure出现时, EvaluationGate 必须 fail closed; LLM-as-Judge 不得via加权平均, 人工不可见阈值或二次评审将其改判为via. 

---

# 18. 成本manage与 Token 计量架构

> LLM call成本主导平台 OPEX. 定义按 tenant 计量, 预算force和 chargeback 机制. 

## 18.1 计量模型

**计量点**: ModelGateway 在每次 LLM call完成后synchronous写入 UsageRecord, 作为 provider usage evidence. 运行预算事实以 BudgetLedger / BudgetSettlement 为准; chargeback 以 settlement 为财务事实, provider invoice 与 UsageRecord 只used for对账, 不得反向提高预算硬upper limit. 

`UsageRecord` 必须支持multi-currency, 内部算力, 人审和 provider 发票对账: 

| field | Description |
| --- | --- |
| currency | 原始费用币种 |
| fx_snapshot | 换算为 base_currency 时uses的汇率, 来源和时间 |
| cost_source | provider_invoice / internal_compute / human_review / storage / egress |
| provider_invoice_reconciliation_id | 与 provider 发票或内部账单对账的references |

## 18.2 预算层级

| 层级    | 预算主体           | 控制粒度             | 超预算行为                         |
| ------- | ------------------ | -------------------- | ---------------------------------- |
| 平台级  | 整个平台           | 月度总额             | SEV1 告警 + 新 workflow 暂停       |
| tenant级  | 单个 tenant        | 月度配额             | 告警 + 该 tenant workflow 排队降速 |
| Pack 级 | 单个 Business Pack | 单次 workflow upper limit   | 该 workflow 降级为 supervised      |
| Step 级 | 单个 step          | 单步 token/cost upper limit | step 中止 + replan                 |

## 18.3 预算force

```text
ModelRequest
  → estimate cost / tokens / duration
  → atomic reserve
    → 若 used + reserved + estimate > limit → rejectrequest / 降级strategy
  → execute LLM call
  → settle actual
  → release unused reservation
```

预算force必须uses原子预留, 避免concurrent LLM / Tool / Replan 在check与消费之间穿透upper limit. 标准流程: 

```text
estimate → atomic reserve → execute → settle actual → release unused
```

BudgetReservation state机: 

```text
reserved → settled
reserved → partially_settled → settled
reserved → released
reserved → expired
reserved → cancelled
```

关键field: reservationId, subjectId, runId, nodeRunId, attemptId, resource_type, estimatedCost, estimatedInputTokens, estimatedOutputTokens, expiresAt, status, settledCost, releasedCost, traceId. `resource_type` 必须是 money / model_tokens / context_tokens / output_tokens / tool_calls / human_review / duration_ms. 预留到期由 Sweeper 释放, 释放与事件写入必须同transaction. Sweeper 必须usesdata库时间或 monotonic lease time, 并保留 clock skew safety margin; 不得因单个 worker localclock快进而提前释放活跃预留. 

concurrent预算仲裁必须在 BudgetLedger 内完成, 示例 SQL: 

```sql
UPDATE budget_ledger
SET reserved = reserved + :estimate
WHERE subject_id = :tenant_id
  AND used + reserved + :estimate <= limit;
```

受影响的硬upper limit必须split为 `max_cost`, `max_model_tokens`, `max_context_tokens`, `max_output_tokens`, `max_steps`, `max_duration_ms`. `max_cost` 不能替代 token 或时延upper limit. 

热门tenant预算账本必须支持 `BudgetAllocator` + `budget_sub_ledger` / `reservation_shard`, 例如 `tenant_monthly_budget → tenant_budget_bucket[0..N]`. globally hard cap 的原子边界在 BudgetAllocator, 不在各 bucket 内部; Allocator 先给 bucket 分配额度, bucket 只能在已分配额度内原子 reserve, 周期 reconciliation 只used for校准和回收, 不得替代硬upper limitcheck. 

BudgetAllocator 硬规则: 

```text
tenant hard cap
  → allocator atomic allocate bucket quota
  → bucket atomic reserve
  → settle/release
  → allocator reclaim unused quota
```

任何 bucket 预留不得使 `allocated_total > tenant_limit`; Allocator 写热点可分片读, 但分配额度的提交必须经单 leader / fencing 保护. 对 streaming LLM 或分段工具execute, 必须每 N tokens 或每 provider chunk 做 incremental reserve / settle; 超限必须 stop generation 并record partial output 为调试 artifact, 不得进入 PlanGraph, 代码, SQL, 决策或 side effect. 所有 streaming partial settlement 必须record `reservation_estimation_error_metric`; 估算过低触发 overrun_policy, 估算过高导致假耗尽时必须可auto release 或重估. 

## 18.4 Chargeback 报表

- 按 tenant / pack / model / provider 维度汇总
- 日报 + 月报auto生成
- 支持导出为 CSV / JSON
- 与 Admin API 集成: `/api/v1/admin/cost-reports`
- 报表必须同时展示 original currency, base currency, FX snapshot 和 invoice reconciliation status, 避免multi-currency成本在审计时不可追溯. 

## 18.5 成本优化strategy

| strategy           | 说明                                         | 适用场景               |
| -------------- | -------------------------------------------- | ---------------------- |
| Prompt cached    | ExactPromptCache default; SemanticCache only限人工批准安全域 (见 §15.5)  | read-only / 低changes场景 |
| Token 预算裁剪 | context 超长时auto压缩 memory/knowledge 输入 | 大上下文task           |
| Model 降级     | 低risktaskauto选择低成本 model               | background queue       |
| batch合并       | 多个相似 step 合并为一次 LLM call            | batchanalysis场景           |

---

# 19. Agent 间委托与协作架构

> 复杂企业task需要多个 Agent 协作. 定义 Agent 间委托协议, 上下文传递和authorization模型. 

## 19.1 委托模型

Agent 间via标准委托协议进行task分派, 支持三种模式: 

| 模式     | 说明                                             |
| -------- | ------------------------------------------------ |
| synchronous委托 | 委托方blocks等待被委托方return结果, 适used for短时子task |
| 异步委托 | 委托方提交后继续execute, via回调或轮询获取结果     |
| 广播委托 | 委托方向多个 Agent 同时发起request, 聚合最优结果    |

委托request (DelegationRequest) contains: delegator (委托方 ID) , delegate (被委托方 ID) , taskScope (taskrange) , constraints (约束条件) , timeout (timeout时限) . 委托回执 (DelegationReceipt) contains: result (execute结果) , telemetry (遥测data) , artifacts (产出物列表) . 所有委托链必须遵守 §19.2 中的拓扑约束. 

Delegation state机: 

```text
created → capability_discovery? → task_proposal → bid/decline? → award? → accepted/rejected → child_run_created → running → reported → verified → closed
                                                                                              ├→ timed_out
                                                                                              └→ cancelled
```

委托消息必须携带 `messageId`, `idempotency_key`, `delegationId`, `parentRunId`, `childRunId`, `sequence_no`, `expectedPreviousSequence`, `capabilityIntersection`, `budgetCap`, `dataBoundary` 和 `deadline`. 乱序, duplicate, 预算超界或 capability intersection 为空时reject委托. `idempotency_key` 的作用域为 parentRunId + delegationId + message type; duplicate消息只return原handle结果, 不得duplicate扣预算, duplicate创建 child run 或duplicate结算. 

如需多候选竞标, 必须usesindependent discovery/bid/award 流程: `capability_discovery → task_proposal → bid/decline → award → accept → child_run_created → report → verify → close`. default委托协议不contains child 主动 offer, 避免 parent 未选定 child 前出现乱序语义. 广播委托必须声明 `AggregationPolicy = first_valid | best_score | majority | human_arbitration`; 无聚合strategy时不得auto选择结果. 

委托 deadline 到期必须进入 `timed_out` 终态, 释放 child run 未uses预算, 关闭 pending approval, cancel未完成 bid, 并向 parent run 追加 `delegation.timed_out` 事件. 广播委托未达到 quorum 时按 `AggregationPolicy` 的 `quorum_failure_policy = abort | best_available | human_arbitration | retry_once` handle; 落选 bid 的 discovery / proposal token 成本计入 parent run, 不得loss成本归因. 

## 19.2 委托拓扑约束

- **深度limit**: 委托链最大深度 = 3 (防止无限递归) 
- **与目标分解的交互**: 目标分解引擎(§40)递归深度upper limit = 5, 委托链最大深度 = 3, 但两者不得相乘扩张. 平台实施**globallycall深度硬upper limit = 8** (`call_depth` field随 trace 传播) , 每次 decompose, delegate 或进入子 graph 均 +1; 任一局部upper limit或globallyupper limit触发时, reject新委托并触发 escalation. 
- **环检测**: 同一 pack_id 不可在同一委托链中出现两次
- **隔离**: 子 workflow independent lease, independent checkpoint, 不与父 workflow sharedstate
- **预算继承**: 子 workflow 预算从父 workflow 剩余预算中扣除
- **permissions收缩**: 子 workflow permissions ≤ 父 workflow permissions (最小permissionsprinciple) 

## 19.3 上下文传递安全

- 父 → 子: only传递 DelegationContext 中声明的references, 不传递原始data
- 子 → 父: onlyvia DelegationResult return, contains summary, artifact_refs, trust_level, taint_labels, evidence_refs 和 policy_outcome
- 跨 tenant 委托: default禁止, 需 P2 explicitlyauthorization
- data分级向上compatibility: 子 workflow 产出data的分级 ≥ 输入data分级

## 19.4 协作模式

| 模式     | 说明                          | 适用场景          |
| -------- | ----------------------------- | ----------------- |
| serial委托 | A 委托 B, 等 B 完成后继续     | 简单子task        |
| parallel扇出 | A 同时委托 B1/B2/B3, 聚合结果 | parallelanalysis          |
| 管道     | A → B → C, 链式传递           | 多阶段handle        |
| 协商     | A 和 B 交替execute, shared上下文   | 代码 review + fix |

## 19.5 多 Agent 协作协议 (Agent Collaboration Protocol) 

当平台从单 Agent Runtime 走向多 Agent Runtime 时, 必须有一套标准化的协作协议防止permissions泄露, 预算失控和审计断链. 本协议定义消息type, forcefield和不可violates规则, 与 §45 Harness Runtime 和 §19.2 委托拓扑约束协同execute. 

### 消息type

| 消息type             | 方向           | 语义         | 触发条件                              |
| -------------------- | -------------- | ------------ | ------------------------------------- |
| `capability_discovery` | parent → candidates | 能力发现 | only竞标/多候选模式                    |
| `task_proposal`      | parent → child | 发起task提案 | Planner 分解出子task                  |
| `task_accept`        | child → parent | accepts委托     | child 评估能力, 预算, permissions后回复      |
| `task_reject`        | child → parent | reject委托     | child 能力/预算/permissions不足              |
| `partial_result`     | child → parent | 中间结果上报 | child 完成阶段性产出                  |
| `escalation_request` | child → parent | request升级     | child 遇到超出自治permissions的决策          |
| `completion_report`  | child → parent | task完成报告 | child 完成全部工作                    |
| `verification_report` | parent → child/P2 | 验证结果 | parent 验证子结果                     |
| `close_notice`       | parent → child | 关闭委托     | 结果已验收或终止                      |
| `takeover_notice`    | parent → child | 接管notification     | parent 因timeout/异常/人工介入接管子task |
| `bid`                | child → parent | 竞标response     | only discovery/bid/award 模式uses       |
| `decline`            | child → parent | 竞标reject     | only discovery/bid/award 模式uses       |
| `award`              | parent → child | 竞标授予     | parent 从多个 bid 中选定 child        |
| `child_run_created`  | child → parent | 子 run 创建  | child 已创建受控 HarnessRun           |

### forcefield

每条协作消息必须携带以下field, missing任一field则消息被reject: 

| field                | type         | 来源                      | 用途                                |
| ------------------- | ------------ | ------------------------- | ----------------------------------- |
| `correlation_id`    | UUID         | 首条 task_request 生成    | 关联同一协作会话的所有消息          |
| `parent_run_id`     | HarnessRunId | §45.13 HarnessRun         | 关联父级execute上下文                  |
| `depth`             | uint8        | 从 §19.2 globallycall深度继承 | 防止递归爆炸 (≤ call_depth hard cap)  |
| `sender_agent_id`   | AgentId      | 发送方                    | identity标识与审计                      |
| `receiver_agent_id` | AgentId      | 接收方                    | 路由与permissionsvalidation                      |
| `domain_id`         | DomainId     | §37 DomainDescriptor      | 域级strategy匹配                        |
| `risk_level`        | RiskScore    | 消息负载中最高risk操作    | 触发审批/HITL                       |
| `budget_remaining`  | TokenBudget  | 从父级预算继承            | 防止子 Agent 超支                   |
| `trace_id`          | TraceId      | §12 分布式 Tracing        | 全链路可观测性                      |

### 协作不可violates规则 (Collaboration Invariants) 

以下规则由 Harness Runtime 在消息收发时forcevalidation, violates任一条则消息被reject并触发 Incident: 

| #   | 规则                                                                                  | validation时机             | violates后果                 |
| --- | ------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| C1  | 子 Agent 不得扩大permissions -- child.permissions ⊆ parent.permissions                         | task_accept 时       | reject委托 + 告警          |
| C2  | 子 Agent 不得提升risk模式 -- child.risk_mode ≤ parent.risk_mode                         | task_accept 时       | reject委托 + 告警          |
| C3  | 子 Agent 不得bypass parent ConstraintPack -- child.constraints ⊇ parent.constraints       | task_request construction时  | 消息被拒                 |
| C4  | 子 Agent output必须可被 parent Evaluator 复核 -- completion_report 必须contains evidence field | completion_report 时 | 结果不被采纳             |
| C5  | 任何 takeover 都必须写审计 -- takeover_notice 触发不可tamper审计record                      | takeover_notice 时   | 平台force写入 (不可skip)  |
| C6  | budget_remaining 不得超过 parent 剩余预算                                             | task_request 时      | 消息被拒                 |
| C7  | depth 不得超过 call_depth hard cap (§19.2 定义, default 8)                               | task_request 时      | 消息被拒 + escalation    |

### 与现有架构的关系

- **§19.1-19.4**: 本协议将已有委托模型从"约定"升级为"force协议", 所有委托消息必须遵循本节格式
- **§45 Harness Runtime**: HarnessLoopController 在发起子task时autoconstruction符合本协议的 task_request
- **§58.6 HarnessDecision**: 子 Agent 的 Evaluator 裁决via completion_report 回传, parent Evaluator 可对其进行二次裁决
- **§12 异常事件handle**: 协作消息timeout/reject/违规均映射为 Incident, 走统一告警路由

---

# 20. 长时task与 Workflow 休眠架构

> 企业场景中 workflow 可能持续数小时甚至数天 (等审批, 等外部system回调) . 定义休眠/唤醒机制. 

## 20.1 长时task分类

| type     | 持续时间  | 原因                    | 示例               |
| -------- | --------- | ----------------------- | ------------------ |
| 审批等待 | 分钟→天   | HumanWait executor blocks | 高risk操作审批     |
| 外部回调 | 分钟→小时 | 等第三方system完成        | CI/CD 构建完成回调 |
| 定时调度 | 确定时间  | 等待特定时间window        | 非工作时间execute     |
| 多阶段   | 天→周     | 业务流程多阶段审批      | 发布审批链         |

## 20.2 Workflow 休眠机制

**休眠流程**: 

1. NodeRun 进入等待state → 创建完整 checkpoint
2. 释放 worker lease (worker 不再占用) 
3. 创建 HibernationRecord, 注册 wake_conditions
4. HarnessRun state设为 `paused` 或 `hibernated`
5. 所有in-memory上下文persistence到 P5

**唤醒流程**: 

1. wake_condition 满足 → WakeEngine 触发
2. execute `ResumeCompatibilityCheck`
3. 从 checkpoint 恢复 workflow 上下文
4. 重新申请 worker lease
5. 从断点处继续execute

`ResumeCompatibilityCheck` 必须coverage: RunVersionLock, Prompt/Model/Tool/Policy 版本lock, DomainDescriptor/Domain Spec 版本, connector auth 与 action schema, secret lease reacquire, approval validity, budget reservation refresh, external callback signature, policy diff, provider/model/prompt deprecation. 任一 high/critical compatibility性failure必须进入 `require_revalidation` 或 `abort_on_resume`, 不得silently继续. 

`ResumeCompatibilityCheck` 必须有总timeout (default 30s, 可由域strategy收紧或放宽到最大 5min) . checktimeout不得default恢复; 必须进入 `resume_check_timed_out`, 并按 risk tier 选择 supervised resume, require_revalidation 或 abort_on_resume. 休眠超过 DomainDescriptor compatibilitywindow的 run 必须force生成 `ResumeDiffReport`, 由 owner 决定迁移, 重规划或终止. 

MVP 只承诺 approval_request + checkpoint 支撑基础 HITL wait 和process重启后的安全恢复; 通用长时休眠, 复杂 wake_conditions, calendar timer 和 provider callback resume 进入 Hardening, 并需要independent `hibernation_record` / timer 表. 若某部署未启用 hibernation_record, 超过 checkpoint TTL 的长时等待必须进入 `paused_requires_operator`, 不得silently恢复. 

## 20.3 持久定时器

- 定时器persistence到data库, 不dependencyprocessin-memory
- TimerPoller (类似 outbox poller) 定期扫描到期 timer
- process重启后 timer 不loss
- timer precision: ± 30s (非实时system, 不追求毫秒级) 
- 需要 <30s SLO 的 IT ops, 客服或交易控制task必须声明 `high_precision_timer=true`, usesindependent高precision调度器和更小扫描window; 未声明时不得承诺亚 30s 唤醒. 

## 20.4 TTL 与timeout保护

- 每个 hibernation 必须有 TTL (default 7 天, 最大 30 天) 
- TTL 到期后execute timeout_action
- 超长 workflow 每 24h 发一次 `workflow.still_hibernated` 健康事件
- 超过 TTL 50% 的 hibernation 触发提醒notification
- **超长审批场景**: 监管审批链可能需要数月, via `renewal` 机制延续 -- TTL 到期前 24h autorequest domain_owner confirmation续期 (每次续期最大 30 天) , 总续期次数upper limit由 DomainGovernancePolicy(§37.9) 的 `max_hibernation_renewals` (default 6, 即最长 ~210 天) 控制, 超过upper limit则force终止并notification发起人

## 20.5 跨部署安全

- checkpoint 格式向后compatibility (版本化 schema) 
- 平台升级部署时, hibernated workflow 不受影响
- 若 checkpoint schema 不compatibility, workflow 进入 `recovery_needed` state, 由 Recovery Worker handle

---

# 21. 人机协作模式架构

> 定义完整的 HITL 模式目录. 

## 21.1 HITL 模式目录

| 模式     | 说明                             | 触发条件                 | timeout行为           |
| -------- | -------------------------------- | ------------------------ | ------------------ |
| 单人审批 | 一个审批人决策                   | risk_level ≥ high        | timeout → 升级        |
| 多方审批 | 多人independent审批, 投票决策           | critical 操作 / 跨域影响 | timeout → autoreject    |
| 委托审批 | 审批人可转给他人                 | 原审批人不在线           | 委托后 TTL reset    |
| 迭代反馈 | 人给出修改意见, Agent 重做       | output不满意               | 最大迭代次数后终止 |
| 协同编辑 | 人和 Agent 交替修改同一 artifact | 代码/文档协作            | 无timeout, 手动结束   |
| notification_only | onlynotification, 无需审批                 | no-side-effect 或低risk可逆动作 | autovia           |
| 断路人工 | LLM 不可用时转人工决策           | D4 降级模式 (见 §15.5)   | 人工timeout → abort   |

## 21.2 审批流引擎

ApprovalFlow 定义一次审批的完整execute结构: 

| field                | type                                 | 说明                                           |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| `flowId`            | string (ULID)                        | 审批流唯一标识                                 |
| `steps`             | ApprovalStep[]                       | 有序step列表, 支持 sequential 和 parallel 模式 |
| `approvers`         | dynamic解析                             | 由 §47 审批路由引擎根据组织架构实时计算        |
| `timeout_per_step`  | Duration                             | 单步timeout (default 24h) , timeout触发 escalation      |
| `escalation_policy` | enum: upgrade_sev / delegate / abort | timeout后升级strategy                                 |
| `delegation_rules`  | DelegationRule[]                     | 不在位时的代理规则 (见 §47.3)                  |

审批流引擎支持step间条件branch (如risk金额决定是否追加高层审批) , parallel会签 (所有人via才放行) 以及任一via (一人via即放行) 三种决策模式. 

## 21.3 迭代反馈循环

**流程**: Agent 产出 → 人审查 → 给出 guidance → Agent replan + 重做 → 循环, 直到 approve 或达到 max_iterations. 

协同编辑defaultuses strict turn-taking token, 避免 Agent 与人工同时修改同一 artifact. 人工介入命令必须标准化: 

```yaml
interventionType: inspect | patch | override | takeover | resume
authority:
scope:
expiresAt:
auditReason:
```

人工 `takeover` 后 Agent 不得继续自主execute, 除非收到 scope 匹配且未expiry的 `resume` DecisionDirective. 

`notification_only` 不是审批bypass机制, 只能used for无副作用或低risk可逆动作. 任何写 truth, 外发data, 提交 side effect, 改变预算, 扩大permissions或不可逆操作都必须uses approval / HITL 模式. 

审批委托 TTL reset必须受 `max_delegation_chain_length` 和 `max_total_approval_wait` 约束; 每次委托都必须重新execute ConflictOfInterestFilter, SoD check和 scope 收缩. 达到链长或总等待upper limit后只能升级或 abort, 不得无限转委托. 

## 21.4 notification与渠道

| 渠道                  | 用途                | 集成方式           |
| --------------------- | ------------------- | ------------------ |
| 平台控制台            | default审批界面        | 内置               |
| Webhook               | 外部system集成        | 出站 HTTP          |
| Email                 | 异步notification            | SMTP adapter       |
| IM (Slack/飞书/企微)  | 即时notification + 快捷审批 | Webhook + 回调 API |

---

# 22. SDK 与开发者体验架构

> 无 SDK 的平台无法被业务团队采纳. 定义 Pack 开发工具链和local开发体验. 

## 22.1 SDK 分层

| SDK 层     | 面向角色   | 功能                                        |
| ---------- | ---------- | ------------------------------------------- |
| Pack SDK   | 业务开发者 | 创建/testing/发布 Business Pack                |
| Plugin SDK | 插件开发者 | 开发 tool / adapter / retriever / evaluator |
| Client SDK | 外部集成方 | call平台 Public API                         |
| Admin SDK  | ops团队   | call Admin API, 脚本化ops                  |

## 22.2 Pack SDK 核心能力

Pack SDK 为业务开发者提供从创建到发布的完整工具链: 

| 能力             | 说明                                                          |
| ---------------- | ------------------------------------------------------------- |
| Scaffold CLI     | `pack create` 生成标准目录结构, Manifest 模板和示例代码       |
| Local Dev Server | 内置轻量runtime, 支持热重载, 模拟 P3/P4 execute流程               |
| Type-safe API    | 提供 Tool, Prompt, Eval 的type安全定义interface, 编译期validation合约    |
| Test Harness     | 集成 MockModelGateway 和 MockToolExecutor, 支持录制/回放testing  |
| Publish CLI      | `pack publish` 一键打包, validation Manifest 合规性并推送至目标环境 |
| Versioning       | based on semver auto版本manage, 发布时force changelog                |

MVP SDK range限定为: `create-pack`, `validate-manifest`, `run-local-simulation`, `generate-contract-tests`, `publish-dry-run`. 其他 IDE, Playground, 市场发布体验进入 Hardening / Enterprise. 

SDK compatibility性contract: 

| field | Description |
| --- | --- |
| sdk_semver | SDK 自身语义化版本 |
| platform_min_version / platform_max_version | 支持的平台版本window |
| contract_test_generator | based on Manifest / OpenAPI / Event Registry 生成contracttesting |
| plugin_sandbox_test_harness | 插件沙箱, egress, secret, filesystem 和 symlink denial-path testing |
| deprecation_policy | SDK API 废弃window, 迁移提示和 CI 警告规则 |

所有 SDK request必须发送 `X-Platform-Version`, `X-SDK-Version` 和 `X-Contract-Version`. 平台在 admission 前execute版本握手: below min version return `upgrade_required`, 超过 max tested version return `compatibility_warning` 或要求 dry-run; 已废弃 API 只能在 deprecation window 内call, 并在response中return migration hint. SDK 不得silentlycall legacy projection 写path. 

## 22.3 local开发环境

- `agent-platform dev` — 启动local平台 (SQLite + in-process workers) 
- `agent-platform pack create` — 创建 Pack 脚手架
- `agent-platform pack test` — 运行 Pack testing (mock LLM + mock tools) 
- `agent-platform pack validate` — validation Manifest 合规性
- `agent-platform pack publish --target staging` — 发布到 staging 环境

**local模拟器**: 

- 内置 MockModelGateway: return预configure的 LLM response, used for确定性testing
- 内置 MockToolExecutor: 模拟 tool execute结果
- testing录制/回放: 将真实 LLM call录制为 fixture, subsequenttesting回放 (不消耗 token) 

record/replay fixture 必须autosanitized: redact secrets, hash PII, strip proprietary payload unless approved. local模拟只能验证 contract 和确定性逻辑, 不能证明生产 SideEffect 安全. 

## 22.4 Plugin 生命周期

| 阶段 | 说明                        | 要求                     |
| ---- | --------------------------- | ------------------------ |
| 开发 | local开发 + Plugin SDK       | 必须声明 PluginManifest  |
| testing | 单元testing + sandbox 集成testing | coverage率 ≥ 80%             |
| 认证 | 安全扫描 + 能力审查         | via Plugin 安全check清单 |
| 发布 | 注册到 Plugin Registry      | 版本语义化 (semver)      |
| 运行 | 受 sandbox 约束execute         | 资源limit + 能力白名单    |
| 废弃 | 标记 deprecated + 迁移指引  | 至少maintained 3 个月          |

## 22.5 文档与示例

- 每个 SDK 必须有 API reference (从 TypeScript typeauto生成) 
- 提供 3 个标准示例 Pack: simple-qa / coding-fix / operations-resolve
- 提供 Playground 环境: 在线试用 Pack 开发 (可选, Phase 4) 

---

# 23. 合规与data治理架构

> 企业级平台必须满足合规要求. 定义 GDPR/SOC2 相关的data治理架构. 

## 23.1 data生命周期manage

| datatype     | 保留strategy              | 删除方式                | 说明                      |
| ------------ | --------------------- | ----------------------- | ------------------------- |
| Truth table  | 按业务需要            | 逻辑删除 + 定期物理cleanup | 控制真相                  |
| Event log    | default 365 天           | 归档后删除              | append-only, 归档到冷存储 |
| Audit record | default 3 年             | 不可删除 (合规要求)     | 法律保留期                |
| Artifact     | default 90 天            | 物理删除                | large object                    |
| Memory       | 按 TTL autocleanup       | 物理删除                | 运行态短期data            |
| Knowledge    | 按 trust level 差异化 | 逻辑删除                | 长期shareddata              |
| LLM callrecord | default 90 天            | 物理删除                | 含 prompt/completion      |
| Cost record  | default 3 年             | 归档                    | 财务审计                  |

## 23.2 Right-to-Erasure (GDPR Art.17) 

append-only event log 与 right-to-erasure exists架构conflict. 解决方案: 

**Crypto-shredding**: 

1. 每个 tenant 的 PII datausesindependent的 data encryption key (DEK) 加密后存储
2. DEK 由 key management service manage, 与 tenant_id 关联
3. 删除request到达时, 销毁该 tenant 的 DEK
4. event log 中的加密data变为不可解密 (逻辑等效于删除) 
5. 审计record保留删除操作本身的record

删除权与 immutable audit 的边界: destroy encrypted payload, retain non-PII audit envelope, retain hash/digest for integrity. 删除后生成 `ErasureTombstone`, 不可再被 Memory/Knowledge/Prompt fixture references. 

Erasure state机: 

```text
requested → classified → payload_shredded → backup_expiry_wait → tombstoned → verified
       └──────────────→ legal_hold_exception
```

`legal_hold_exception` 必须record hold reason, legal owner, review date 和可见性limit; 解除 legal hold 后回到 `classified` 继续删除流程. backup 中的 payload 不要求立即物理coverage, 但必须有到期等待, 密钥销毁证明和最终 verified 证据. 

## 23.3 data驻留

- 每个 tenant 可configure data_residency 约束 (如 "CN" / "EU" / "US") 
- LLM call必须路由到满足data驻留的 provider (见 §15.3 data_residency 路由) 
- 存储引擎按 region 分片 (Phase S3+ 支持) 
- 跨 region data传输default禁止, 需explicitlyauthorization

跨境与法律basis必须物化为证据对象: `DataTransferRecord`, `LegalBasisRecord`, `RetentionOverride`, `TenantNeutralAuditDigest`. Legal hold 优先于普通 retention/delete request, 但只保留必要 envelope 和摘要, 敏感 payload 按 legal basis 加密封存. 

## 23.4 SOC2 控制映射

| SOC2 控制域    | 平台对应能力                     | 证据来源                        |
| -------------- | -------------------------------- | ------------------------------- |
| CC6.1 逻辑访问 | §11 统一identity与authorization               | PolicyOutcome + audit record    |
| CC6.3 加密     | §23.5 加密架构                   | key rotation log                |
| CC7.2 监控     | §12 异常事件检测                 | incident + metrics              |
| CC8.1 变更manage | §24 configure治理 + §16 Prompt 版本化 | config_version + prompt_version |
| CC9.1 risk缓释 | §10 risk评分引擎                 | RiskDecision + evidence bundle  |
| A1.2 容灾      | §31 容灾架构                     | DR 演练报告                     |

## 23.5 加密架构

| 层面         | strategy           | implementation                                              |
| ------------ | -------------- | ------------------------------------------------- |
| 传输加密     | TLS 1.3 force   | 所有 HTTP/gRPC/WebSocket 连接                     |
| 存储加密     | AES-256        | data库级 TDE 或应用级field加密                     |
| PII field加密 | Per-tenant DEK | 支撑 crypto-shredding                             |
| Secret 存储  | Vault 集成     | references式访问, TTL ≤ 300s                            |
| Key rotation     | auto 90 天     | DEK rotation不影响历史data解密 (envelope encryption)  |

## 23.6 data血缘

每个决策和output都可追溯到其data来源: 

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (PlanGraphBundle)
    → Execute (NodeAttemptReceipt) → Side Effect
```

- via trace_id + evidence_refs 构建血缘链
- 支持正向query (某个 knowledge 影响了哪些决策) 和反向query (某个 side effect dependency了哪些输入) 
- 血缘data写入 P5 Evidence Plane, 不单独建存储

---

# Part III — 业务域接入层 (§37-§38) 

---

# 37. 业务域建模与接入架构

> 解决"平台搭好了怎么承接企业内部多元业务"的核心问题. 
> 关联: §30 Business Pack 模型 · §22 SDK/DX · §10 risk控制 · §16 Prompt manage · §17 模型评估 · §29 Knowledge/Memory

## 37.1 问题陈述

企业内部 24 个垂直业务线在以下维度exists根本差异: 

| 维度       | 量化交易          | 电商              | 广告推广          | 金融服务            | datahandle        | 代码开发         |
| ---------- | ----------------- | ----------------- | ----------------- | ------------------- | --------------- | ---------------- |
| risk等级   | Critical (资金)   | High (超卖/定价)  | Medium (预算)     | Critical (合规)     | Medium (data)   | High (生产变更)  |
| 时间敏感性 | 微秒~毫秒级       | 秒级 (search/风控)  | 小时级 (竞价)     | 秒~天级             | SLA 驱动        | 分钟级           |
| 知识时效   | 行情 Tick 实时    | 库存/价格分钟级   | 投放data小时级    | 征信/法规季度级     | Schema 按需     | 代码库实时       |
| 评估维度   | Sharpe/回撤/滑点  | GMV/转化率/CSAT   | ROAS/CPA/CTR      | 基尼/KS/赔付率      | SLA 达成率/质量 | 编译+testing+安全   |
| 审批要求   | strategy上线force审批  | 大额价格变动审批  | 投放启动+创意审批 | 超阈值贷款/SAR force | Schema 迁移审批 | Code Review      |
| 可逆性     | 平仓 (有成本)     | 退款/补偿         | 暂停投放          | 冲正 (受限)         | fallback到良好data  | Git revert       |
| HITL 强度  | 高                | 中                | 中                | 极高                | 中              | 高               |
| 延迟层级   | 超低延迟 (<10ms)  | 实时 (<1s)        | 准实时 (<5min)    | 实时~批handle         | SLA 驱动        | 实时 (<1s)       |

| 维度       | user运营        | 行业调研          | 学术调研          | 企业知识库        | 财务             | 法务               |
| ---------- | --------------- | ----------------- | ----------------- | ----------------- | ---------------- | ------------------ |
| risk等级   | Medium (隐私)   | Low (信息)        | Low (学术声誉)    | Medium (泄露)     | Critical (资金)  | Critical (法律)    |
| 时间敏感性 | 分钟级 (触发)   | 小时~天级         | 天~周级           | 秒级 (search)       | 天级 (月结)      | 小时~天级          |
| 知识时效   | user行为实时    | 报告季度级        | 论文月级          | 文档周级          | 法规季度级       | 法规/判例月级      |
| 评估维度   | 留存率/LTV/NPS  | 事实准确率/coverage率 | references准确率/可复现 | MRR/忠实度/coverage率 | 准确性/合规/时效 | 召回率/准确性/时效 |
| 审批要求   | 活动content审批    | 发布前人工审核    | 全部人工审核      | 访问控制/纠错     | 四眼+职责分离    | **全部律师审核**   |
| 可逆性     | 停止活动        | 更正声明          | 勘误/撤稿         | 版本fallback          | 冲正/对账        | 不可逆 (已生效)    |
| HITL 强度  | 中              | 高                | 高                | 中                | 极高             | **最高**           |
| 延迟层级   | 准实时 (<5min)  | 批handle            | 批handle            | 实时 (<1s)        | 批handle           | 批handle             |

| 维度       | 在线直播            | 广告素材制作        | 游戏开发        | 游戏上架            | 人力资源           | 供应链与物流      |
| ---------- | ------------------- | ------------------- | --------------- | ------------------- | ------------------ | ----------------- |
| risk等级   | High (监管/舆情)    | Medium (品牌/版权)  | Medium (质量)   | High (合规/分级)    | High (隐私/歧视)   | High (资金/运营)  |
| 时间敏感性 | 毫秒~秒级 (实时流)  | 小时~天级           | 分钟~小时级     | 天级 (审核周期)     | 天级 (招聘流程)    | 小时级 (调度)     |
| 知识时效   | 实时 (弹幕/画面)    | 素材库周级          | 代码库/引擎实时 | 平台政策月级        | 法规/政策季度级    | 库存/物流实时     |
| 评估维度   | 违规检出率/延迟     | 创意质量/合规率     | 编译/testing/性能  | 一次via率/上线时间 | 招聘周期/AIR       | 预测准确率/成本   |
| 审批要求   | 违规处置审批        | 创意发布审批        | 版本发布审批    | 每平台合规审批      | 录用/晋升审批      | 大额采购审批      |
| 可逆性     | 断流 (不可逆播出)   | 版本fallback            | Git revert      | 下架 (有时间window)   | 撤回 offer (受限)  | 退货/调拨         |
| HITL 强度  | 高                  | 中                  | 中              | 高                  | 高                 | 中                |
| 延迟层级   | 实时 (<2s)          | 批handle              | 实时 (<1s)      | 批handle              | 批handle             | 准实时 (<5min)    |

| 维度       | 医疗健康             | 教育培训            | 客户服务       | content审核              | IT ops SRE      | 市场营销            |
| ---------- | -------------------- | ------------------- | -------------- | --------------------- | ---------------- | ------------------- |
| risk等级   | **Critical (生命) ** | Medium (隐私/教育)  | Medium (声誉)  | High (法律/安全)      | High (可用性)    | Medium (品牌/法律)  |
| 时间敏感性 | 分钟级 (急诊) ~天级  | 天~周级 (课程)      | 秒级 (对话)    | 毫秒~秒级 (实时审核)  | 秒级 (告警response)  | 小时级 (舆情)       |
| 知识时效   | 指南/药品月级        | 教材学期级          | FAQ/知识库周级 | 政策/法规月级         | configure/拓扑实时    | 市场data日级        |
| 评估维度   | 诊断准确率/安全性    | 学习效果/完成率     | CSAT/FCR/AHT   | 召回率/精确率/延迟    | MTTR/MTTD/可用性 | ROAS/SOV/互动率     |
| 审批要求   | **全部医师审核**     | 课程content审核        | 超permissions承诺审批 | 处置申诉审批          | 变更window审批     | 品牌content审批        |
| 可逆性     | 不可逆 (已execute医嘱)  | 课程调整            | 补偿/退款      | 解封/恢复             | rollback变更         | 撤稿/更正           |
| HITL 强度  | **最高**             | 中                  | 中             | 高                    | 高               | 中                  |
| 延迟层级   | 实时~批handle          | 批handle              | 实时 (<1s)     | 实时 (<2s)            | 实时 (<1s)       | 准实时 (<15min)     |

**当前 §30 Business Pack 将上述差异压缩为一个平坦的 `BusinessPackManifest`**, 无法表达领域语义, 无法驱动差异化风控, 无法指导领域 Prompt strategy. v3.0 via §71-§82 对原始 12 个垂直域逐一深化, v3.1 via §83-§94 扩展至 24 个垂直域全coverage. 

## 37.2 DomainDescriptor — 领域描述符

每个业务域在接入平台时必须提供结构化的领域描述符, 作为平台理解, 约束, 优化该域 Agent 行为的基础: 

**设计决策**: DomainDescriptor 不替代 BusinessPackManifest(§30), 而是作为 Pack 的**领域语义层**. 一个 Pack 关联一个 DomainDescriptor, 多个 Pack 可shared同一 DomainDescriptor (例如"HR 入职 Pack"和"HR 薪酬 Pack"shared `domain_id: "hr"`) . 

v4.3 将单一大 DomainDescriptor 拆为多份可independent版本化的 Domain Spec, 避免一个 schema 承载过多语义. `DomainCoreDescriptor` 只保留领域identity和关联index, 其余能力由专用 spec via同一 `domainId` 关联: 

| Spec | 职责 | 版本strategy |
| --- | --- | --- |
| DomainCoreDescriptor | domainId, owner, primary entities, recipe archetype, lifecycle | 2 个版本支持window |
| DomainExecutionProfile | execution_mode, latency tier, hot path, compiled artifact | 热path变更需重新认证 |
| DomainRiskSpec | risk覆写, side effect, 审批阈值, liability owner | high/critical 变更需 P2 approval |
| DomainKnowledgeSpec | knowledge source, ACL, freshness, conflict policy | 可independent灰度 |
| DomainEvalSpec | eval baseline, critical cases, acceptance threshold | 发布门禁输入 |
| DomainGovernanceSpec | HITL, policy, recertification, waiver | 只能收紧上级strategy |
| DomainInteractionSpec | NL, dashboard, proactive trigger, user体验strategy | 不得bypassexecute约束 |

compatibility期内 `DomainDescriptor` 可作为聚合视graph保留, 但新implementation必须读写上述分解 spec. 

主架构文档只保留域硬约束, 元模型和少量代表性示例; 24 个垂直域的可execute规范entry已落到 `docs_zh/domains/<domain>/domain-spec.md`, 由 domain owner maintained. §71-§94 保留为历史compatibility章节和迁移index, 不作为核心平台 milestone 的blocks项. 

每个independent Domain Spec 必须至少声明以下机器contract, 主文档只保留index: 

| 域type | 必填机器contract示例 |
| --- | --- |
| 交易/金融/财务 | StrategyArtifact / PreTradeRiskCheck / monetary FX snapshot / SoD / adverse-action evidence |
| 电商/广告/客服 | InventoryReservation / SpendReconciliation / PromiseAndRemedyPolicy / refund compensation |
| data/代码/知识库 | lineage / schema compatibility / CODEOWNER + SAST/license/dependency scan / principal-aware ACL |
| 医疗/法务/HR/教育 | professional signoff / bias audit / consent record / advisory_only boundary |
| 直播/content审核/多模态创意 | StreamInterventionStateMachine / jurisdiction escalation / provenance / similarity/license evidence |
| 供应链/ITops/市场营销 | export/hazmat policy / CMDB blast radius / rollback window / claim evidence source |

每个 Domain Spec 必须via `domain lint` 后才能进入 Gate 2: risk action coverage, HITL coverage, tool permission coverage, eval coverage, SLO profile, data boundary lint, critical action responsibility record coverage率均必须可机器validation. critical 域每个 critical action 必须绑定 HITL + HumanResponsibilityRecord; missing时 DomainReleaseGate fail closed. 

v4.3 保留execute模式field, used fordistinguish LLM 辅助规划与确定性热pathexecute: 

```yaml
schemaVersion:
domainId:
execution_mode:
  planning_mode: llm_assisted | deterministic_only
  hot_path_mode: deterministic_only | llm_allowed
  llm_in_hot_path_allowed: boolean
  max_hot_path_latency_ms: number
riskProfile:
dataClasses:
sideEffectTypes:
humanReviewPolicy:
sloProfile:
conflictResolutionPolicy:
```

高risk或超低延迟热path (如量化下单, 实时风控, 直播断流, IT auto修复) 必须uses `hot_path_mode: deterministic_only`. LLM 可以参与离线规划, 候选方案生成, 解释和复盘, 但不得进入要求确定性, 微秒/毫秒级延迟或不可逆副作用的execute热path. 

`conflictResolutionPolicy` 必须references平台支持枚举或注册的插件interface, 不得填写自由text. DomainDescriptor schema 支持window为 2 个版本; `cdm-v1`, `cdm-v2` parallel期结束前必须完成迁移, 否则新 run admission reject. 

`CompiledPlanArtifact` used for deterministic hot path: 

| field | Description |
| --- | --- |
| sourceGraphRef | 来源 PlanGraph / strategy graph |
| compilerVersion | 编译器和规则版本 |
| signature | artifact signature与发布者 |
| policyProofRef | risk, permissions, 预算, data边界证明 |
| dryRunEvidenceRef | dry-run / replay / shadow compare 证据 |
| runtimeLimits | latency, parallelism, notional, blast radius, side effect 限额 |

## 37.3 DomainRiskProfile — 领域risk画像

通用risk矩阵(§10)提供平台级default值, DomainRiskProfile 提供**领域级覆写**, 使同一动作在不同业务域下触发不同风控strategy: 

**领域risk画像应用示例**: 

| 场景              | 平台default risk | 领域覆写 risk               | 结果             |
| ----------------- | ------------- | --------------------------- | ---------------- |
| `tool.http.post`  | 60            | 财务域 → 90                 | force四眼审批     |
| `tool.http.post`  | 60            | 客服域 → 40                 | autoexecute         |
| `tool.file.write` | 50            | 代码研发域 → 70 (生产branch)  | Code Review 门禁 |
| `tool.file.write` | 50            | 素材制作域 → 30             | auto保存草稿     |

## 37.4 DomainKnowledgeSchema — 领域知识结构

定义每个业务域的知识检索strategy, 时效性要求和conflict解决规则, 对接 §29 Knowledge/Memory 层: 

**领域知识差异示例**: 

| 业务域     | 检索模式                   | 时效要求            | conflictstrategy                        |
| ---------- | -------------------------- | ------------------- | ------------------------------- |
| 量化交易   | api_realtime (行情 Tick)   | 微秒~毫秒级         | source_priority (交易所优先)    |
| 电商       | api_realtime (库存/价格)   | 分钟级              | source_priority (库存system优先)  |
| 金融服务   | structured_query (征信API) | 天~季度级           | human_review                    |
| 代码研发   | structured_query (AST/Git) | 实时 (HEAD commit)  | timestamp_latest                |
| 学术调研   | semantic_search (论文库)   | 月级                | citation_count_priority         |
| 企业知识库 | hybrid (语义+关键词)       | 周级                | domain_rule (版本号最高优先)    |
| 财务       | structured_query (ERP API) | 天级 (T+1 对账)     | human_review                    |
| 法务       | structured_query (法律库)  | 月级                | jurisdiction_priority           |

## 37.5 DomainEvalFramework — 领域评估框架

通用模型评估(§17)提供平台级质量门禁, DomainEvalFramework 定义**领域专属的质量轴和评估标准**: 

**领域评估维度差异**: 

| 业务域     | 核心质量轴                       | autocheck                      | 回归data来源         |
| ---------- | -------------------------------- | ----------------------------- | -------------------- |
| 量化交易   | Sharpe/回撤/滑点, execute质量       | 盘前合理性check + 风控限额validation | 回测绩效基线         |
| 电商       | GMV/转化率/CSAT, 库存准确性      | 价格合理性 + 库存synchronousvalidation     | A/B testing历史data     |
| 广告推广   | ROAS/CPA/CTR, 预算合规, 创意合规 | 预算upper limitcheck + 广告法规check   | A/B testing历史data     |
| 金融服务   | 基尼/KS/赔付率, AML 检测率       | 公平性testing + PSI 监控         | 专家标注+监管反馈    |
| 代码研发   | 编译via, testingcoverage, 安全扫描     | AST lint + 单测运行           | PR review via的代码 |
| 学术调研   | references准确率, 统计正确性, 可复现性 | DOI 验证 + 查重               | 已发表论文           |
| 企业知识库 | MRR/忠实度/coverage率, 访问控制合规  | references验证 + permissionscheck           | 人工标注 QA 对       |
| 财务       | 数值准确性, 合规性, 审计可追溯   | 金额validation + 法规规则引擎       | 专家审计样本         |
| 法务       | risk条款召回率, 判例准确性       | 法律data库交叉验证            | 律师审核标注         |

## 37.6 DomainPromptLibrary — 领域 Prompt 库

对接 §16 Prompt managesystem, 为每个业务域提供**领域级 Prompt 资产**, 避免散落各处的 Prompt 碎片: 

**Prompt 库与 Prompt managesystem(§16)的关系**: DomainPromptLibrary 是领域级 Prompt 资产, 注册到 §16 的 PromptRegistry 中. Prompt 的版本化, 灰度, rollback能力由 §16 提供, 领域 Prompt 库只负责**content定义和领域适配**. 

## 37.7 DomainRecipe — 领域模板与原型

将常见业务域归纳为十二种**原型模板**, 新业务接入时选择最接近的原型, based on模板快速生成 DomainDescriptor 骨架: 

| 原型                            | 核心模式                     | 适用业务域                                         | 典型 Workflow                           |
| ------------------------------- | ---------------------------- | -------------------------------------------------- | --------------------------------------- |
| **CRUD-heavy**                  | 读→查→改→confirmation                | 企业知识库, user运营, 人力资源                     | 问题受理→query→handle→反馈                 |
| **Analytics**                   | 采集→analysis→可视化→决策        | 行业调研, user运营, 广告报表, 市场营销             | dataquery→analysis→生成报表→推荐行动         |
| **Creative**                    | 生成→审核→迭代→发布          | 广告推广, 电商 (商品描述) , 广告素材制作, 游戏开发 | 需求理解→生成→人工审核→迭代→发布        |
| **Realtime**                    | 监控→检测→response→record          | 量化交易, 电商 (风控) , 在线直播                   | 事件流监听→异常检测→autoresponse→事后复盘   |
| **Trading**                     | 信号→风控→execute→结算          | 量化交易, 金融服务                                 | 信号生成→盘前风控→订单execute→持仓结算     |
| **Compliance**                  | 监控→检测→评估→报告          | 金融服务, 财务, 法务, 游戏上架                     | 规则监控→异常检测→合规评估→监管报告     |
| **Research**                    | 收集→analysis→综合→发表          | 行业调研, 学术调研                                 | 多源采集→结构化analysis→综合→审核发布       |
| **Adversarial**                 | 攻击面→防御→审计→修复        | 代码开发 (安全) , 法务 (诉讼)                      | 威胁/risk识别→防御措施→审计验证→修复    |
| **Moderation** (v3.1 新增)      | 摄入→多模态检测→处置→申诉    | content审核与安全, 在线直播 (审核链路)                | content摄入→AI 检测→分级处置→人工申诉复核  |
| **Logistics** (v3.1 新增)       | 预测→优化→调度→追踪→异常handle | 供应链与物流, 游戏上架 (发行调度)                  | 需求预测→path优化→调度execute→实时追踪     |
| **Conversational** (v3.1 新增)  | 意graph识别→知识检索→回答→反馈  | 客户服务, 教育培训 (辅导) , 医疗健康 (分诊)        | user意graph→知识库检索→生成回答→满意度反馈 |
| **IncidentOps** (v3.1 新增)     | 告警→诊断→修复→复盘→预防     | IT ops SRE/DevOps                                 | 告警接收→Root Cause诊断→auto修复→事后复盘     |

**uses流程**: 

1. 业务方via CLI 选择原型 (12 种可选) : `agent-platform domain init --archetype=crud_heavy --name=hr`
2. system生成 DomainDescriptor 骨架, 标记所有 `customization_points`
3. 业务方填充必填项 (实体, 工具绑定, 审批规则等) 
4. CLI 运行 `agent-platform domain validate` validationintegrity
5. via后进入 §38 接入 Runbook 流程

## 37.8 DomainInteractionPolicy — 跨域交互strategy

当多个业务域的 Agent 需要协作时 (例如广告域 Agent calldataanalysis域 Agent 生成报表) , 需要明确的**边界strategy和补偿机制**: 

**跨域交互矩阵示例**: 

| 源域 → 目标域       | data流向           | 委托                     | failurestrategy                |
| ------------------- | ------------------ | ------------------------ | ----------------------- |
| 广告 → dataanalysis     | 聚合data, 禁 PII   | allows(depth=1)            | retry(3) → human_review |
| HR → 财务           | 薪酬data, 加密传输 | allows(depth=1, intersect) | rollback_source         |
| 直播 → 库存         | 实时库存query       | 禁止(只读 API)           | fallback cached           |
| 代码研发 → 安全ops | 代码扫描结果       | allows(depth=1)            | log_and_continue        |

## 37.9 DomainGovernancePolicy — 领域治理模型

每个业务域必须有明确的**治理归属**, 包括 ownership, SLO, 预算和变更manage: 

**治理模型与平台能力的映射**: 

| 治理维度    | 平台能力对接                    | auto化程度          |
| ----------- | ------------------------------- | ------------------- |
| Ownership   | §6 API permissions + §11 IAM           | 全auto (RBAC)       |
| SLO         | §27 SLO 监控 + Error Budget     | 全auto (告警+降级)  |
| Budget      | §18 Token 计量 + 预算force       | 全auto (配额+熔断)  |
| Change Mgmt | §16 Prompt 灰度 + §30 Pack 发布 | 半auto (审批+灰度)  |

## 37.10 DomainDescriptor 注册与生命周期

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (业务方编写) │     │ (CLI validation)   │     │ (平台注册)    │     │ (生产运行)   │
└─────────────┘     └─────────────┘     └──────────────┘     └──────┬───────┘
                                                                     │
                         ┌──────────────┐     ┌──────────────┐      │
                         │  Deprecated   │◀────│  Updating    │◀─────┘
                         │ (废弃迁移中)   │     │ (版本升级中)  │
                         └──────┬───────┘     └──────────────┘
                                │
                         ┌──────▼───────┐
                         │   Archived   │
                         │ (归档只读)    │
                         └──────────────┘
```

**state流转规则**: 

| 当前state   | 可转移至   | 条件                                      |
| ---------- | ---------- | ----------------------------------------- |
| Draft      | Validated  | `agent-platform domain validate` 全部via |
| Validated  | Registered | 安全审查 + 平台compatibility性checkvia             |
| Registered | Active     | 至少一个关联 Pack 发布success                |
| Active     | Updating   | 业务方提交新版本 descriptor               |
| Updating   | Active     | 新版本validation+注册via                       |
| Active     | Deprecated | domain_owner 发起废弃, 审批via           |
| Deprecated | Archived   | 所有关联 Pack 迁移或下线完成              |

## 37.11 Canonical Domain Meta-Model — 统一领域元模型

每个垂直业务域接入平台时, 必须uses统一元模型回答以下 **15 个标准问题**. 该元模型是平台"按域configure驱动"的基础, 也是看板, 审批, risk, 评测统一生成的data来源. 新增第 25 个域时, 只需填写同一模板即可完成接入定义. 

### 元模型 15 问

| #   | 元模型问题                 | 对应平台概念                              | 填写规范                     |
| --- | -------------------------- | ----------------------------------------- | ---------------------------- |
| Q1  | 领域主实体是什么           | DomainDescriptor.primary_entities         | 列举 3-5 个核心业务实体      |
| Q2  | 高risk动作是什么           | DomainRiskProfile (risk ≥ 70 的操作)      | 从 DomainRiskProfile 表提取  |
| Q3  | default自治级别是什么         | DomainDescriptor.default_autonomy         | L0-L4 (参考 §42)             |
| Q4  | default HITL 节点是什么       | DomainInteractionPolicy.hitl_points       | 列举force人工决策节点         |
| Q5  | 关键外部system有哪些         | DomainDescriptor.external_dependencies    | 列举核心上下游system           |
| Q6  | 关键只读工具有哪些         | DomainRiskProfile (risk < 40 且无副作用)  | 从 DomainRiskProfile 表提取  |
| Q7  | 关键写工具有哪些           | DomainRiskProfile (risk ≥ 40 或有副作用)  | 从 DomainRiskProfile 表提取  |
| Q8  | 不可逆动作有哪些           | DomainDescriptor.irreversible_actions     | 列举所有不可rollback操作         |
| Q9  | 核心质量指标是什么         | DomainEvalFramework.primary_metrics       | 列举 3-5 个核心 KPI          |
| Q10 | 核心合规约束是什么         | DomainGovernancePolicy.compliance_rules   | 列举适用法规与force规则       |
| Q11 | 最小上线能力集是什么       | DomainDescriptor.mvp_capabilities         | 列举灰度上线必备的最小功能集 |
| Q12 | 灰度上线前必须完成什么认证 | §38 Gate3 SecurityCert + 域专项check       | 列举必须via的认证/审查项    |
| Q13 | 责任主体是谁               | DomainRiskSpec.liability_owner            | 法定资质, 业务 owner, 审批责任 |
| Q14 | failure补偿/rollback模型是什么    | DomainRiskSpec.compensation_model         | refund, reversal, appeal, manual repair |
| Q15 | 红队/对抗场景是什么        | DomainEvalSpec.adversarial_scenarios      | prompt injection, 越权, 欺诈, 极端输入 |

### 24 域元模型填充矩阵 (Q1-Q6) 

| 域         | Q1 主实体                           | Q2 高risk动作                                                 | Q3 default自治 | Q4 default HITL 节点                           | Q5 关键外部system                | Q6 只读工具                    |
| ---------- | ----------------------------------- | ------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------ | ------------------------------ |
| 量化交易   | strategy·订单·持仓·行情·风控限额        | order.submit · strategy.deploy · risk_limit.modify            | L1          | strategy上线·风控限额变更·资金分配              | 交易所·行情源·风控system         | market_data.read               |
| 电商       | 商品·订单·库存·价格·退款            | price.update · refund.issue · listing.publish                 | L2          | 超阈值价格变动·超额退款·管控品类上架        | ERP·WMS·支付网关·search引擎      | inventory.sync                 |
| 广告推广   | 活动·创意·受众·出价·预算            | campaign.launch · creative.publish · audience.create          | L2          | 投放启动·创意上线·敏感品类受众定向          | 广告平台API·DMP·创意工具       | —                              |
| 金融服务   | 信贷申请·KYCrecord·保险单·理赔·SAR    | credit.approve · sar.submit · claim.adjudicate · model.deploy | L0          | 超阈值贷款·SAR报告·模型部署·不利信贷决策    | 征信system·核心银行·监管报送     | —                              |
| datahandle   | 管线·Schema·data集·血缘·质量规则    | schema.migrate · pipeline.deploy_prod · data.delete           | L2          | Schema迁移·生产部署·data删除·敏感data访问   | 数仓·计算引擎·调度system         | pipeline.retry                 |
| 代码开发   | 代码库·PR·CI管线·漏洞·dependency          | code.merge · deploy.production · security.fix                 | L1          | 代码合并·生产部署·安全漏洞修复·架构决策     | Git·CI/CD·SAST/DAST·制品库     | —                              |
| user运营   | user分群·活动·notification·A/Btesting·LTV      | campaign.send · segment.create                                | L2          | 活动content·敏感属性分群·notification频率·激励预算     | CDP·推送平台·analysissystem          | —                              |
| 行业调研   | 报告·data源·趋势·竞品·监管政策      | report.publish · data.scrape                                  | L1          | 研究发布·前瞻性声明·版权合规                | 行业data库·新闻API·监管网站    | alert.send                     |
| 学术调研   | 文献·假设·实验·手稿·references            | manuscript.submit · citation.insert · analysis.run            | L1          | 发表审核·假设选择·实验设计·统计方法         | 学术data库·DOI注册·查重system    | literature.search              |
| 企业知识库 | 文档·知识graph谱·FAQ·permissions·检索index     | document.ingest · answer.synthesize · content.retire          | L2          | 新文档源接入·低置信度回答·content退役          | 文档system·SSO·search引擎          | search.query                   |
| 财务       | 发票·凭证·GL·税务·预算              | journal.post · financial.signoff · tax.file                   | L0          | 超阈值凭证·报表签字·税务申报·坏账核销       | ERP·金税system·银行interface·审计system | —                              |
| 法务       | 合同·判例·诉讼·IP·合规record          | legal_opinion.draft · contract.review · ediscovery.classify   | L0          | **全部output** (执业律师审核)                 | 法律data库·电子发现·合同manage   | ip.search                      |
| 在线直播   | 直播流·弹幕·商品·主播·审核record      | moderation.realtime · commerce.shelf · stream.publish         | L1          | 涉政/涉恐断流·带货违规处置·大型活动开播     | 推流CDN·电商system·审核平台      | danmaku.filter                 |
| 广告素材   | 创意·品牌资产·模板·效果data         | brand.compliance · creative.generate                          | L2          | 品牌类素材·强监管行业素材·名人肖像          | DAM·投放system·品牌manage          | asset.adapt                    |
| 游戏开发   | 设计文档·美术资产·代码·数值configure·Bug | game.asset_generate · game.balance_sim                        | L2          | 核心玩法·美术风格·版本发布·P0/P1 Bug修复    | 游戏引擎·美术工具·CI/CD        | game.qa_run                    |
| 游戏上架   | 版本包·提审材料·local化·活动configure     | store.submit · compliance.check · liveops.config              | L1          | 版号提审·重大版本·大型活动·敏感local化       | 商店API·支付渠道·分级机构      | localization.translate         |
| 人力资源   | 简历·Offer·薪酬·绩效·合同           | offer_generate · payroll_calc · resume_screen                 | L0          | Offer发放·解雇·绩效评级·薪酬调整·组织变更   | HCM·招聘平台·薪酬system·背调     | —                              |
| 供应链     | 采购订单·库存·运输路线·关务·供应商  | customs_declare · route_plan · inventory_optimize             | L1          | 大额采购·新供应商准入·关务异常·危险品运输   | ERP·WMS·TMS·海关system           | scm.forecast                   |
| 医疗健康   | 病历·处方·影像·分诊·药物交互        | clinical.diagnose · drug.interaction_check · imaging.analyze  | L0          | **全部临床决策** (执业医师confirmation)             | HIS·PACS·药品data库·医保system   | —                              |
| 教育培训   | 课程·题库·学习path·学情·评测        | content_generate · assess · tutor                             | L2          | content上线·主观题评分·敏感话题·未成年人data   | LMS·题库·学情system·家长平台     | learning_path                  |
| 客户服务   | 工单·对话·知识库·路由·质检record      | cs.respond · cs.quality_score                                 | L2          | 超permissions退款·投诉升级·法律问题·VIP异常        | CRM·知识库·工单system·CTI        | cs.route · cs.knowledge_search |
| content审核   | content项·审核record·strategy规则·申诉·报告  | moderation.classify · moderation.appeal · compliance.report   | L1          | CSAM即时处置·申诉裁决·strategy变更·边界案例     | 审核平台·法律合规·举报system     | —                              |
| ITops     | 告警·事件·部署·变更·漏洞            | ops.deploy · ops.incident_respond · security_scan             | L1          | 高risk变更CAB·安全事件·新修复strategy·预算采购  | 监控system·CMDB·CI/CD·SIEM       | ops.capacity_plan              |
| 市场营销   | Campaign·品牌资产·SEO·社交content·舆情 | social.publish · marketing.campaign                           | L2          | 对外content审核·品牌危机接管·营销预算·品牌合作 | 广告平台·社交API·舆情system      | brand.monitor · seo.optimize   |

### 24 域元模型填充矩阵 (Q7-Q12) 

| 域         | Q7 写工具                                                                        | Q8 不可逆动作                          | Q9 核心质量指标                        | Q10 核心合规约束                  | Q11 最小上线能力集          | Q12 灰度前认证                |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------- | --------------------------- | ----------------------------- |
| 量化交易   | order.submit · strategy.deploy · risk_limit.modify                               | 订单提交 (平仓有成本) · strategy部署       | Sharpe · 最大回撤 · 风控遵从率         | 证监会/SEC/MiFID II               | 信号生成+风控+execute链路      | 风控system联调·交易所沙箱验证   |
| 电商       | price.update · refund.issue · listing.publish                                    | 价格发布 (底价约束) · 退款支付         | GMV · 转化率 · CSAT                    | 电商法/消保法/PCI-DSS             | 商品上架+定价+基础客服      | 支付安全扫描·压测             |
| 广告推广   | campaign.launch · bid.adjust · creative.publish · audience.create                | 投放预算消耗 (已花费不可回收)          | ROAS · CPA · CTR                       | 广告法/平台政策/GDPR              | 投放创建+竞价+基础报告      | 广告法合规check·预算控制验证   |
| 金融服务   | credit.approve · sar.submit · claim.adjudicate · model.deploy                    | 贷款放款·SAR提交·赔付支付              | 基尼/KS · 赔付率 · PSI                 | Basel III/反洗钱法/EU AI Act      | 信贷评估+KYC+风控           | 公平性testing·监管报表联调       |
| datahandle   | schema.migrate · pipeline.deploy_prod · data.delete                              | data删除 (不可恢复) · Schema破坏性变更 | SLA达成率 · data质量via率             | GDPR删除权/data驻留               | 管线编排+质量check+血缘      | data安全分级·访问控制验证     |
| 代码开发   | code.merge · deploy.production · code.generate · security.fix                    | 生产部署 (需rollback) · dependency版本lock定       | testingvia率 · Bug检测率 · 采纳率        | 许可证/SOC2                       | 代码生成+审查+CI集成        | 安全扫描·许可证合规           |
| user运营   | campaign.send · segment.create · notification.push · ab_test.launch              | batchnotification推送 (已发不可撤回)            | 留存率 · LTV/CAC · NPS                 | PIPL/GDPR/CAN-SPAM                | 分群+活动推送+基础analysis      | 隐私合规·退出机制验证         |
| 行业调研   | report.publish · data.scrape · forecast.generate                                 | 报告发布 (影响决策)                    | 事实正确率 · 来源references率                | 证券法/data许可/版权              | data采集+报告生成+审核流    | data源许可·版权合规           |
| 学术调研   | manuscript.submit · citation.insert · analysis.run                               | 论文提交 (声誉影响)                    | references准确率100% · 可复现性              | 研究伦理/发表伦理                 | 文献综述+写作辅助+references验证  | DOI验证·查重system集成          |
| 企业知识库 | document.ingest · answer.synthesize · content.retire                             | content退役 (知识lossrisk)                | MRR/NDCG · 答案忠实度                  | data留存/访问控制                 | 文档handle+语义search+permissions      | 访问控制验证·search质量基线     |
| 财务       | journal.post · financial.signoff · tax.file                                      | 税务申报提交·GL过账 (需冲正)           | 直通handle率 · GL准确率 · 审计发现数     | CAS/SOX/金税四期                  | 发票handle+凭证+对账          | 审计合规·职责分离验证         |
| 法务       | legal_opinion.draft · contract.review · ediscovery.classify                      | 法律意见发出 (法律后果)                | risk条款召回率 · 判例准确性            | 民法典/职业伦理/GDPR              | 合同审查+判例检索+合规      | 法律data库集成·特权检测验证   |
| 在线直播   | moderation.realtime · commerce.shelf · stream.publish                            | 直播断流 (影响user体验) · 违规处置     | 违规检出率 · 处置延迟<3s · GPM         | 互联网直播manage规定/未成年人保护法 | 推流+实时审核+弹幕filter      | 多模态审核模型·断流恢复演练   |
| 广告素材   | creative.generate · brand.compliance                                             | 素材发布 (品牌影响)                    | 品牌合规via率 · 平台审核一次via率    | 广告法/版权法/肖像权              | 文案生成+graph片生成+合规check  | 广告法词库·品牌资产库集成     |
| 游戏开发   | game.asset_generate · game.balance_sim · game.design_assist                      | 版本发布 (玩家体验影响)                | 风格一致性(FID) · Bug发现率            | 版号/防沉迷/content审查              | QAauto化+美术生成+数值模拟  | content审查预筛·防沉迷验证       |
| 游戏上架   | store.submit · compliance.check · liveops.config                                 | 版号提审 (零容错) · 版本上线           | 提审一次via率>90% · DAU/留存          | 版号/分级/防沉迷/PIPL             | 提审auto化+合规check+灰度    | 分级合规矩阵·防沉迷链路       |
| 人力资源   | resume_screen · offer_generate · payroll_calc · compliance_check                 | Offer发出·解雇execute·薪酬发放            | 招聘周期 · 薪酬公平性 · 偏见审计       | 劳动法/PIPL/EU AI Act             | 简历筛选+Offer生成+合规check | 偏见检测·公平性testing·可解释性  |
| 供应链     | inventory_optimize · route_plan · customs_declare                                | 采购订单提交·关务申报·危险品运输       | MAPE · OTIF · HS分类准确率             | 海关法/出口管制/危险品/ESG        | 需求预测+库存优化+path规划  | 出口管制清单集成·危险品合规   |
| 医疗健康   | clinical.diagnose · drug.interaction_check · imaging.analyze · triage.assess     | 诊断建议发出 (患者安全) · 处方开具     | 诊断敏感度 · 病灶召回率 · 药物交互召回 | 医疗器械条例/HIPAA/FDA SaMD       | 分诊+药物交互check+辅助诊断  | SaMD认证·临床验证·data加密    |
| 教育培训   | content_generate · assess · tutor                                                | 评分发布 (影响学业) · 不当content暴露     | 知识点掌握率 · 评分一致性(κ≥0.8)       | 未成年人保护法/FERPA/COPPA        | content生成+智能评测+辅导      | content安全filter·未成年人保护验证 |
| 客户服务   | cs.respond · cs.quality_score                                                    | 退款支付·error承诺 (幻觉)               | CSAT · FCR · AIindependent解决率 · 幻觉率     | 消保法/TCPA/GDPR                  | 多渠道对话+路由+知识检索    | 幻觉率基线·情绪检测验证       |
| content审核   | moderation.classify · moderation.appeal · adversarial.detect · compliance.report | CSAM报告提交·content删除                  | 精确率/召回率 · 违规在线时长           | 网络安全法/DSA/CSAMforce报告       | text审核+graph片审核+strategy引擎  | 多模型交叉验证·红队testing       |
| ITops     | ops.incident_respond · ops.deploy · security_scan                                | 生产变更 (需rollback) · 安全修复           | MTTR · MTTD · SLO达成率                | 等保2.0/ISO 27001/SOC 2           | 事件response+部署auto化+监控    | 变更manage流程·爆炸半径验证     |
| 市场营销   | social.publish · marketing.campaign                                              | 对外content发布 (品牌影响) · 预算消耗     | ROAS · SOV · 互动率 · 危机预警准确率   | 广告法/FTC/GDPR/CAN-SPAM          | Campaign编排+品牌监测+SEO   | 广告法合规·品牌调性基线       |

### 生产责任补充矩阵 (Q13-Q15) 

| Issue | 机器contract落点 | 填写要求 |
| --- | --- | --- |
| Q13 责任主体是谁 | `DomainRiskSpec.liability_owner` | 指定业务 owner, 法定资质责任人, 审批责任人和事故response owner; critical 域不得uses团队邮箱作为唯一 owner |
| Q14 failure补偿/rollback模型是什么 | `DomainRiskSpec.compensation_model` | 每个不可逆或外部写动作必须声明 refund / reversal / appeal / manual repair / no_compensation, 并绑定 SideEffect compensation policy |
| Q15 红队/对抗场景是什么 | `DomainEvalSpec.adversarial_scenarios` | 至少coverage prompt injection, 越权访问, 欺诈/滥用, 极端输入, 跨域dataleaks和高成本触发; high/critical 域必须有independent holdout |

### 元模型的平台价值

- **模板化域接入**: 新增第 25 个域时, 填写 15 问元模型即完成接入定义的 80%
- **configure驱动内核**: 平台内核读取元模型field, autoconfigure ConstraintPack · Toolbelt · EvalFramework · ApprovalRoute
- **统一看板生成**: §43 运营看板按元模型fieldauto聚合域级视graph (risk热graph, 质量趋势, 合规state) 
- **审批路由auto化**: §47 审批路由根据 Q2/Q4 auto生成域级审批链
- **评测auto化**: §17 模型评估根据 Q9 auto生成域级评测套件
- **文档一致性**: 24 域描述结构统一, 不会随域数量增长而发散

---

# 38. 业务域接入 Runbook

> 定义新业务域从零到生产的标准化接入流程. 
> 关联: §37 业务域建模 · §37.11 统一领域元模型 · §30 Business Pack · §22 SDK/DX · §34 ADR

## 38.1 接入四阶段总览

```text
Phase 1              Phase 2              Phase 3              Phase 4
领域建模              开发验证              安全认证              灰度上线
(1-2 周)             (2-4 周)             (1 周)               (1-2 周)
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ Domain    │───────▶│ Pack     │───────▶│ Security │───────▶│ Rollout  │
│ Modeling  │  Gate1 │ Dev+Test │  Gate2 │ Cert     │  Gate3 │ Canary   │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| 阶段    | 负责方                | 产出物                                            | 门禁条件                                |
| ------- | --------------------- | ------------------------------------------------- | --------------------------------------- |
| Phase 1 | 业务方 + 平台 Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | 平台架构评审via                        |
| Phase 2 | 业务方                | Pack 代码 + 单元testing + 集成testing + eval dataset    | testingcoverage ≥ 80% + eval via              |
| Phase 3 | 安全团队 + 平台团队   | CertificationRecord + risk评审record                | 安全扫描无 Critical/High + risk评审via |
| Phase 4 | 平台 SRE + 业务方     | RolloutRecord + 监控 Dashboard                    | canary 7 天无 P0/P1 + eval 质量不退化   |

接入path按risk分层: low = fast-track, medium = standard, high = enhanced, critical = regulated. low-risk 内部域可合并partial人工会议审查; critical regulated 域必须增加领域专家, 合规团队和生产演练签核. 

| riskpath | 目标周期 | Description |
| --- | --- | --- |
| low | 1-2 周 | 只读/低risk内部流程, 可合并人工会议 |
| medium | 3-6 周 | 标准四阶段门禁 |
| high | 6-10 周 | 增加安全, 红队, rollback演练和 domain_owner 签核 |
| critical | 3-6 个月 | 领域专家, 法务/合规, 生产演练和监管证据齐备后才可灰度 |

每个 Gate 必须声明 `automated_check`, `human_signoff`, `evidence_required` 和 `waiver_policy`, 并output machine-readable `DomainCertificationRecord`. waiver 只能有 expiry, owner, compensating control 和审计record, 不能豁免机器不变量. 

## 38.2 Phase 1: 领域建模

**目标**: 业务方与平台团队协作, 产出结构化的 DomainDescriptor. 

**step**: 

| #   | 活动                     | execute者        | 产出                    | 工具                             |
| --- | ------------------------ | ------------- | ----------------------- | -------------------------------- |
| 1   | 选择领域原型(§37.7)      | 业务方        | Recipe 选择             | `agent-platform domain init`     |
| 2   | 填充领域实体和能力       | 业务方        | entities + capabilities | YAML/JSON 编辑                   |
| 3   | 定义领域risk画像         | 业务方 + 安全 | DomainRiskProfile       | risk评估模板                     |
| 4   | 定义知识来源和检索strategy   | 业务方 + data | DomainKnowledgeSchema   | 知识源清单模板                   |
| 5   | 定义评估维度和标准       | 业务方 + AI   | DomainEvalFramework     | eval 模板                        |
| 6   | 构建领域 Prompt 库       | 业务方 + AI   | DomainPromptLibrary     | Prompt 工程模板                  |
| 7   | 确定治理归属             | 业务负责人    | DomainGovernancePolicy  | 治理contract模板                     |
| 8   | 填写 15 问元模型(§37.11) | 业务方 + 平台 | Meta-Model 填充表       | 元模型模板                       |
| 9   | validationintegrity               | 业务方        | validation报告                | `agent-platform domain validate` |

**Gate 1 check清单**: 

- [ ] DomainDescriptor 所有必填field已填充
- [ ] 至少 5 个 few-shot examples 已标注
- [ ] risk画像已经过安全团队初审
- [ ] 知识源已confirmation可达且有authorization
- [ ] eval dataset 满足 §17 risk分级下限: low ≥50, medium ≥200, high ≥500, critical 建议 ≥1000 + 专家签核 + holdout
- [ ] 治理contract已由 domain_owner 签署
- [ ] 跨域交互strategy已与相关域confirmation (如有) 
- [ ] 15 问元模型(§37.11)全部填写完成且viavalidation
- [ ] 平台架构评审会议via
- [ ] **垂直域专项**: 延迟层级声明完成; Critical risk域 (量化交易/金融服务/财务/法务/医疗健康) 须额外提交监管合规映射表和 HITL coverage方案; High risk域 (人力资源/在线直播/content审核/ITops/游戏上架) 须提交领域专属风控方案

## 38.3 Phase 2: 开发验证

**目标**: based on DomainDescriptor 开发 Business Pack, vialocal和 staging 环境验证. 

**step**: 

| #   | 活动              | execute者       | 产出             | 工具                                       |
| --- | ----------------- | ------------ | ---------------- | ------------------------------------------ |
| 1   | 初始化 Pack 工程  | 业务方       | Pack 代码骨架    | `agent-platform pack create --domain=<id>` |
| 2   | implementation Tool 适配器  | 业务方       | Tool bundle 代码 | Pack SDK(§22)                              |
| 3   | 编写单元testing      | 业务方       | testing用例         | 标准testing框架                               |
| 4   | local Mock testing    | 业务方       | localtesting报告     | `agent-platform pack test --local`         |
| 5   | 构建 eval dataset | 业务方 + AI  | 评估data集       | eval 工具链                                |
| 6   | Staging 集成testing  | 业务方 + SRE | 集成testing报告     | staging 环境                               |
| 7   | 运行领域评估      | 业务方       | eval 质量报告    | `agent-platform eval run --domain=<id>`    |

**Gate 2 check清单**: 

- [ ] 单元testingcoverage率 ≥ 80%
- [ ] 集成testing全部via
- [ ] 领域 eval 所有质量轴达到 acceptance_threshold
- [ ] 无已知 P0/P1 Bug
- [ ] Pack Manifest 与 DomainDescriptor 一致性validationvia
- [ ] Tool permissions声明与risk画像匹配
- [ ] **垂直域专项**: 域专属评估指标全部有autocheckimplementation; Critical risk域须via领域专家 (律师/风控/审计师/执业医师) 评审; 人力资源域须via偏见审计

## 38.4 Phase 3: 安全认证

**目标**: 安全团队和平台团队对 Pack 进行安全审查和risk评估. 

| #   | check项                | execute者   | 标准                       |
| --- | --------------------- | -------- | -------------------------- |
| 1   | static代码扫描          | auto化   | 无 Critical/High 漏洞      |
| 2   | dependency漏洞扫描          | auto化   | 无已知 CVE (Critical)      |
| 3   | Sandbox 逃逸testing      | 安全团队 | 无逃逸path                 |
| 4   | Prompt Injection testing | 安全团队 | injection防护有效               |
| 5   | data泄露testing          | 安全团队 | 无 PII/凭证泄露            |
| 6   | risk画像一致性        | 平台团队 | RiskProfile 与实际行为匹配 |
| 7   | 跨域strategy合规          | 安全团队 | DataFlowRule execute正确      |
| 8   | 合规性审查(§23)       | 合规团队 | 满足行业监管要求           |

**Gate 3 check清单**: 

- [ ] 所有安全扫描via
- [ ] Prompt Injection 防护coverage率 100%
- [ ] risk画像评审record已归档
- [ ] CertificationRecord 已签发
- [ ] 合规团队无阻断意见
- [ ] **垂直域专项**: 量化交易域完成盘前风控压力testing; 金融服务域完成 AML 检测coverage率验证; 法务域完成特权分类准确性testing; 财务域完成职责分离forcecheck; 医疗健康域完成医师审核coverage率验证; content审核域完成 CSAM 上报时效testing; 人力资源域完成招聘偏见审计; IT ops域完成爆炸半径limit验证; 在线直播域完成实时审核延迟压测

## 38.5 Phase 4: 灰度上线

**目标**: via渐进式灰度发布, 确保生产环境稳定. 

**灰度strategy**: 

```text
Day 1-2     Day 3-5     Day 6-7     Day 8+
Canary 1%   Canary 10%  Canary 50%  GA 100%
┌─────┐    ┌──────┐    ┌──────┐    ┌──────┐
│ 内部 │───▶│ 小range│───▶│ 半量 │───▶│ full │
│ testing │    │ 真实  │    │ 真实 │    │ 发布 │
└─────┘    └──────┘    └──────┘    └──────┘
   ▲           ▲           ▲           ▲
   │           │           │           │
  手动验证    auto指标    auto指标    SLO 达标
  + eval     + eval     + eval     confirmation
```

**每阶段autocheck**: 

| 指标              | 阈值                   | 不达标动作          |
| ----------------- | ---------------------- | ------------------- |
| Error rate        | < 1%                   | autorollback            |
| P95 latency       | < domain SLO           | 告警 + 人工决策     |
| Eval quality      | ≥ acceptance_threshold | autorollback            |
| Token cost        | < budget × (canary%)   | 告警 + 人工决策     |
| user反馈 negative | < 5%                   | 暂停灰度 + 人工评审 |

**Gate 4 (GA 准入) check清单**: 

- [ ] Canary 7 天无 P0/P1 Incident
- [ ] 所有 SLO 指标达标
- [ ] Eval 质量不below Gate 2 基线
- [ ] Token 成本在预算range内
- [ ] 监控 Dashboard 已configure并告警已路由
- [ ] Runbook (故障handle手册) 已编写并交付 SRE
- [ ] Domain Owner 签署 GA confirmation

## 38.6 接入后持续运营

业务域上线后进入**持续运营模式**, 平台autoexecute以下周期性活动: 

| 活动                  | 频率                | 负责方                    | 触发条件             |
| --------------------- | ------------------- | ------------------------- | -------------------- |
| Eval 回归testing         | 每日                | auto                      | 定时 + Prompt 变更后 |
| 成本报表              | 每周                | auto → domain_owner       | 定时                 |
| SLO 报告              | 每月                | auto → domain_owner + SRE | 定时                 |
| 安全扫描              | 每月                | auto                      | 定时 + dependency更新时    |
| DomainDescriptor 审查 | 每季度              | 业务方 + 平台             | 定时                 |
| 知识源时效性check      | 按 freshness_policy | auto                      | 持续                 |
| 跨域strategy审查          | 每季度              | 安全团队                  | 定时 + 新域接入时    |

持续治理state包括: initial certification, periodic recertification, incident-triggered recertification, domain descriptor drift review. DomainDescriptor 与 Pack 行为出现 drift 时, 平台可暂停新 run admission, 直到复审完成. 

---

# Part IV — 垂直业务域深化层 (§71-§94) 

本 Part 保留 24 个域的架构概要, used for展示 Domain Meta-Model 在高risk行业中的映射. v4.2 实施不要求一次性创建 24 个域生产implementation目录; 产品化域规范entry已split到 `docs_zh/domains/<domain>/domain-spec.md`, 主文档只maintained跨域不变量, 代表性约束和迁移index. 

## Part IV 域专项硬约束总表

| 域 | 必须吸收的专项约束 |
| --- | --- |
| 量化交易 | LLM onlyused for离线研究, strategy解释和候选plan; 下单热path不得经过通用 Harness loop, LLM 或 HITL; 上线物必须是signature的 compiled strategy artifact, 带回测证据, 盘前确定性风控, 硬性限额, kill switch 和盘后审计 |
| 电商 | 定价, 库存, 退款全部作为 SideEffect manage; 必须有 price floor, 库存预留, 退款阈值, 活动rollbackwindow和 oversell incident workflow |
| 广告推广 | 广告消耗usesindependent `ad_spend_ledger`; 创意审批与投放execute分离; 实时竞价uses确定性strategy和 bid adjustment bounds, 不dependency LLM 热path |
| 金融服务 | 不利信贷/授信决策必须生成 adverse action explanation, 公平性评估包和监管证据包; LLM-as-Judge 不得作为最终合规裁决; 高risk动作需持牌/authorization复核人签核 |
| datahandle | Sink 必须声明 idempotency contract; Replay 必须感知 lineage; data质量规则是版本化资产; 破坏性迁移需 shadow compare 与人工审批 |
| 代码开发 | Agent 写代码default branch-only; merge 必须 PR, CI, SAST, dependency/license/secret scan 和 CODEOWNER review via |
| user运营 | 触达频控是平台硬limit; 分群需敏感属性/代理变量检测; 实验需 consent, holdout protection 和伦理边界 |
| 行业调研 | 每个事实主张default需要 citation; 来源必须via license/ToS check; 预测类output必须给出置信区间或不确定性说明 |
| 学术调研 | references必须经 DOI/CrossRef/PubMed 等解析器验证; 统计analysisoutput可复现 notebook artifact; 必须execute plagiarism/authorship policy |
| 企业知识库 | query时实时 ACL check; 回答default带references; permissions镜像有 freshness SLO; expiry知识触发 stale alert 和 trust downgrade |
| 财务 | multi-currency动作必须record base_currency 与 FX snapshot; 四眼审批/SoD 为平台级能力; 凭证, 报表和财务证据包不可变且带签核链 |
| 法务 | default只提供 legal information; 形成 legal advice, 外发text或可被采取行动的output前必须 attorney review; privilege, jurisdiction, legal hold 是一等分类field |
| 在线直播 | 实时审核热path优先 edge/deterministic moderation; 断流是高risk副作用, 必须有 stream kill switch, appeal/reinstate workflow 和未成年人保护strategy |
| 广告素材制作 | 生成资产必须带 provenance, C2PA, 水印, 版权/商标相似性扫描和品牌规则版本; 不得directly发布到外部渠道 |
| 游戏开发 | 资产需 IP similarity scan; 数值平衡configure不得auto写生产; QA 证据与 release gate 绑定 |
| 游戏上架 | 每个平台independent合规矩阵; 年龄分级, 防沉迷, 支付, 地区政策版本化; LiveOps configure需审批 |
| 人力资源 | 招聘/晋升output recommendation-only, 不得auto淘汰; 必须进行 bias audit 和 protected attribute handling; HR datadefault不进入长期/shared memory |
| 供应链与物流 | 大额采购, 危险品, 出口管制触发硬审批; 预测异常触发 circuit breaker; 离线 side effect 按 dependency graph 拓扑提交 |
| 医疗健康 | 平台only提供 clinical decision support, 不是诊断主体; PHI 强隔离; 诊疗建议需 physician signoff; 急救/紧急path不得dependency LLM; 医疗证据包不可tamper |
| 教育培训 | 未成年人data需 guardian/school consent; 按年龄分级strategy提供content; default Socratic tutoring mode; 学术诚信 guardrail 防止directly代做 |
| 客户服务 | 业务承诺需 promise checker; 退款/补偿按阈值审批; `max_unresolved_turns = 3` 后转人工; 负面情绪触发升级 |
| content审核与安全 | CSAM/极端content按辖区流程上报; 申诉与证据留存有专门state机; 审核员保护作为治理要求record |
| IT ops SRE/DevOps | auto修复only限 known-runbook-only; 爆炸半径limit为单节点/单服务; 遵守 change window; 平台故障需 out-of-band break-glass |
| 市场营销与品牌 | 对外content需品牌一致性, 广告法/行业法check, claim evidence 和危机公关升级path |

---

# 71. 量化交易域架构

> 关联: §37 业务域建模 · §30 Business Pack · §10 risk控制 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §1

**DomainDescriptor 映射**: 

- `domain_id`: `quant-trading` · `recipe_archetype`: Trading + Realtime
- `risk_level`: Critical · `latency_tier`: ultra_low (executepath <10ms) 
- `hitl_intensity`: High · `regulatory_density`: Critical (证监会/SEC/MiFID II) 

**核心 Agent 角色**: 信号生成 · 回测 · execute · riskmanage · 组合优化

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | ------------------------ |
| `tool.order.submit` | 60 | 95 | force盘前风控+仓位限额check |
| `tool.strategy.deploy` | 50 | 90 | 人工审批 + 回测验证 |
| `tool.risk_limit.modify` | 50 | 95 | domain_owner + 风控经理双审批 |
| `tool.market_data.read` | 20 | 20 | autoexecute |

**DomainEvalFramework**: Sharpe Ratio ≥ 阈值 · 最大回撤 ≤ 限额 · Implementation Shortfall · 风控限额遵从率 · system可用性 99.99%

**DomainKnowledgeSchema**: 行情data实时 API · 风控参数结构化query · strategyconfigure版本化 · conflictstrategy source_priority (交易所 > 备用源) 

**HITL strategy**: strategy上线/风控限额变更/资金分配变更force人工审批; 实时盈亏仪表盘 + 一键 kill-switch; 盘后合规审查每日签字

**关键护栏**: 盘前合理性check (最大单量/最大名义金额/速率limit) · 硬性仓位限额不可由 Agent coverage · data源stale >N 秒auto平仓 · 熔断器

**Agent 工作流 (详细) **: 

- 信号生成 Agent: data摄入 → 特征工程 → 模型推理 → 信号sort → 风控filter → 订单生成
- 回测 Agent: strategy定义 → 历史回放 → 模拟成交 (含滑点/手续费) → 绩效报告
- execute Agent: 目标组合 → executeplan (TWAP/VWAP/IS) → 跨交易所路由 → 成交监控 → 算法参数实时调整
- riskmanage Agent: 持续监控敞口 (行业/因子/Greeks) → 仓位limit → 熔断 → VaR/CVaR → 追保notification
- 组合优化 Agent: 均值方差/Black-Litterman/risk平价 → 约束 (换手率/行业upper limit/ESG) 

**关键工具/集成**: 
| 类别 | 具体工具 |
| -------- | ---- |
| 行情data | Bloomberg B-PIPE, Refinitiv Elektron, Wind, CTP/FEMAS, IEX Cloud, Polygon.io |
| 交易execute | FIX 4.2/4.4 网关, 券商 OMS/EMS API (IB/中信/华泰 PB) , DMA 直连 |
| 回测引擎 | Zipline, Backtrader, QuantConnect, 自研事件驱动引擎 |
| 风控 | RiskMetrics, Axioma, Barra 因子模型, 内部 VaR 引擎 |
| 基础设施 | KDB+/q 时序data库, Redis, Kafka, FPGA/内核旁路 |

**data敏感度分级**: 

- 极度机密: 交易strategy, alpha 信号, 持仓, 盈亏 (核心 IP) 
- 机密: 回测结果, 风控参数, 客户组合configure
- 内部: 行情data (许可证limit再分发) , executeanalysis

**性能/延迟预算**: 

- 行情handle: HFT <1ms tick-to-signal; 中频 <100ms
- 下单: 个位数微秒 (FPGA) 到低毫秒级
- 风控check: 盘前check <50μs 附加延迟
- 回测: 数年 Tick data分钟级回放 (parallel化) 
- 可用性: 交易时段 99.99%

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| data源corrupted/延迟 | 切换备用源, staledata检测, missing口 >N秒 auto平仓 |
| strategy产生极端信号 | 盘前合理性check, 熔断器 |
| execute场所断连 | auto路由备用场所, 订单排队, notification人工 |
| 风控限额突破 | 立即平仓, 禁用strategy, notification风控经理 |
| 模型过拟合 | 在线监控信号衰减, auto降低权重, regime 检测 |

---

# 72. 电商域架构

> 关联: §37 业务域建模 · §30 Business Pack · §21 HITL · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §2

**DomainDescriptor 映射**: 

- `domain_id`: `ecommerce` · `recipe_archetype`: CRUD-heavy + Realtime
- `risk_level`: High · `latency_tier`: realtime (search/推荐 <200ms, 风控 <500ms) 
- `hitl_intensity`: Medium · `regulatory_density`: Medium (电商法/消保法/PCI-DSS) 

**核心 Agent 角色**: 商品上架 · 定价 · 库存履约 · 客服 · 推荐 · 交易风控

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ----------------------- | ------------- | ----------- | --------------------- |
| `tool.price.update` | 40 | 80 | 超阈值变动人工审批 |
| `tool.refund.issue` | 50 | 70 | 超金额阈值人工审批 |
| `tool.listing.publish` | 30 | 60 | 管控品类人工审核 |
| `tool.inventory.sync` | 30 | 30 | autoexecute |

**DomainEvalFramework**: GMV · 转化率 · CSAT/NPS · 库存周转率 · 风控精确率/召回率 · 推荐 CTR

**HITL strategy**: 价格变动 >X% 人工审批 · 超阈值退款人工审批 · 管控品类上架审核 · 客服前 N 次回复训练期审核

**关键护栏**: 底价约束 (防止定价 ¥0.01) · 库存安全缓冲 · 客服回复based on政策检索 (防止幻觉承诺) · 多 PSP 支付切换

**Agent 工作流 (详细) **: 

- 商品上架 Agent: 生成描述 → 标题 SEO → 分类 → graph片属性提取 → 多平台上架 (天猫/京东/Amazon) 
- 定价 Agent: 竞品监控 → dynamic定价模型 (弹性/库存/利润) → 降价/促销execute
- 库存履约 Agent: 需求预测 → 补货触发 → 仓库分配 → 三方物流协调 → 拆包发货
- 客服 Agent: 售前咨询 → 售后handle → 复杂案例升级 → 回复模板生成
- 推荐 Agent: user画像 → 协同filter/混合模型 → 个性化 → A/B testing
- 风控 Agent: 实时评分 (速率/设备/地址) → 可疑订单标记 → 拒付争议

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 平台 | Shopify API, 天猫/淘宝开放平台, 京东开普勒, Amazon SP-API, 拼多多 |
| 支付 | 支付宝, 微信支付, Stripe, PayPal, Adyen |
| 物流 | 顺丰 API, 菜鸟, FedEx/UPS/DHL, WMS (Manhattan, Blue Yonder)  |
| search/推荐 | Elasticsearch, Algolia, Pinecone, TensorFlow Recommenders |
| CRM | Salesforce, HubSpot, 有赞, 微盟 |

**data敏感度分级**: 

- PII (高) : 客户姓名, 地址, 手机号, 支付信息 (PCI-DSS range) 
- 机密: 定价strategy, 供应商成本, 利润data, 库存水位
- 内部: 商品目录, 聚合销售data, A/B testing结果

**性能/延迟预算**: 

- search/推荐: p99 <200ms
- 价格更新: 竞争response <5分钟, plan促销batch
- 风控评分: 每笔交易 <500ms (synchronous结账) 
- 客服: 聊天首次response <3s, 工单 <2h
- 库存synchronous: 多渠道 <1分钟

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 价格机器人战 | 底价约束, 利润护栏, 阈值人工告警 |
| 库存synchronous延迟致超卖 | 预留库存manage, 安全库存缓冲, auto补偿 |
| 客服 Agent 幻觉政策 | based on政策检索的接地生成, forcereferences政策file |
| 推荐冷启动 | 热门商品兜底, 人口统计default值, 偏好收集 |
| 支付网关故障 | 多 PSP 切换, 排队重试, 客户notification |

---

# 73. 广告推广域架构

> 关联: §37 业务域建模 · §18 成本manage · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §3

**DomainDescriptor 映射**: 

- `domain_id`: `advertising` · `recipe_archetype`: Creative + Analytics
- `risk_level`: Medium · `latency_tier`: near_realtime (竞价 <100ms, 报告 15min 延迟可accepts) 
- `hitl_intensity`: Medium · `regulatory_density`: Medium (广告法/平台政策/GDPR 跟踪同意) 

**核心 Agent 角色**: 投放规划 · 创意生成 · 竞价优化 · 受众manage · 归因报告

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.launch` | 40 | 75 | 预算承诺 + 创意审批 |
| `tool.bid.adjust` | 30 | 50 | 超预算阈值人工审批 |
| `tool.creative.publish` | 30 | 70 | 品牌/法务审核后才可上线 |
| `tool.audience.create` | 20 | 50 | 敏感属性定向需隐私审核 |

**DomainEvalFramework**: ROAS · CPA · CTR · 品牌提升 · 预算节奏准确性 · 创意质量分 · 归因准确性

**HITL strategy**: 投放启动审批 (预算承诺) · 创意上线前品牌/法务审核 · 敏感品类受众定向审核 · 预算增加 >X% 审批

**关键护栏**: 硬性每日/每小时预算upper limit · 提交前合规check (广告法绝对化用语检测) · auto受众扩展兜底 · 频次upper limitforce

**Agent 工作流 (详细) **: 

- 投放规划 Agent: 商业目标analysis → 媒介plan (渠道/预算/排期/定向) 
- 创意生成 Agent: 平台规格适配 (抖音竖版/朋友圈卡片/Google 自适应) → A/B 变体
- 竞价优化 Agent: 跨 DSP 实时竞价 → 转化概率/预算节奏/竞争调整 → 目标 CPA/ROAS
- 受众manage Agent: 一方/二方/三方data构建分群 → Lookalike → 频次upper limit → 跨设备打通
- 归因与报告 Agent: 跨触点转化收集 → 多触点归因 (Shapley/Markov) → 效果看板

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 广告平台 | Google Ads, Meta Marketing, 巨量引擎, 腾讯广告, 百度营销, 快手磁力 |
| DSP | The Trade Desk, DV360, MediaMath |
| 创意 | Canva API, Figma API, Midjourney/DALL-E, RunwayML |
| analysis | Google Analytics, Adobe Analytics, AppsFlyer/Adjust |
| 品牌安全 | IAS, DoubleVerify, MOAT |

**data敏感度分级**: 

- PII (高) : 客户邮件列表, CRM data, 设备 ID
- 机密: 投放效果, 竞价strategy, 获客成本, 创意testing结果
- 内部: 聚合触达/频次data, 市场基准

**性能/延迟预算**: 

- 竞价决策: RTB <100ms
- 投放调整: 每小时预算节奏, 每日出价优化
- 创意生成: 文案分钟级, graph片/视频小时级 (异步) 
- 报告: 准实时看板 15分钟延迟

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 竞价error致预算超支 | 硬性每日/每小时预算upper limit, 实时支出监控auto暂停 |
| 创意被平台reject | 提交前合规check Agent, 已审核via模板库 |
| 受众过窄无法投放 | auto受众扩展触发, Lookalike 兜底 |
| 归因dataloss | 模型化转化, MMM 备份 |
| 广告疲劳 | auto创意rotation, 频次upper limitforce, 刷新触发器 |

---

# 74. 金融服务域架构

> 关联: §37 业务域建模 · §23 合规 · §49 合规strategy引擎 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §4

**DomainDescriptor 映射**: 

- `domain_id`: `financial-services` · `recipe_archetype`: Compliance + Trading
- `risk_level`: Critical · `latency_tier`: realtime~batch (欺诈 <200ms, KYC <30s, 监管报表批handle) 
- `hitl_intensity`: Critical · `regulatory_density`: Critical (Basel III/反洗钱法/偿二代/EU AI Act) 

**核心 Agent 角色**: 信贷评估 · KYC/AML · 保险承保 · 理赔handle · 监管报表

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.credit.approve` | 50 | 95 | 超阈值force人工审批 + 可解释性 |
| `tool.sar.submit` | 50 | 95 | 法律要求人工审核 |
| `tool.claim.adjudicate` | 50 | 80 | 超auto裁决限额人工审核 |
| `tool.model.deploy` | 50 | 90 | 公平性testing + 人工审批 |

**DomainEvalFramework**: 基尼系数/KS 统计量 · SAR 质量 (监管反馈) · 赔付率/综合成本率 · 模型稳定性 (PSI) · 监管check发现数

**HITL strategy**: 超阈值贷款审批force · SAR/STR 报告法律要求人工审核 · 模型部署/重训force审批 · 不利信贷决策必须可复查 · 许多辖区要求"有意义的人工参与"

**关键护栏**: 公平性testing (差异影响analysis) · PSI 监控autofallback · 对账check + data血缘追踪 · 多因素 KYC 验证

**Agent 工作流 (详细) **: 

- 信贷评估 Agent: 申请人data收集 → 评分卡/ML 评分 → 审批建议+解释 → 贷款条款结构化
- KYC/AML Agent: 证件 OCR+活体检测 → 制裁名单筛查 (OFAC/UN/EU) → 可疑交易监控 → SAR/STR 报告
- 保险承保 Agent: risk因子analysis → 保单定价 → 除外责任 → 保单file生成
- 理赔handle Agent: 申请接收 → 保障验证 → 欺诈检测 → 赔付估算 → 路由审核或auto审批
- 监管报表 Agent: 跨system汇总 → 报表生成 (Basel III/CCAR) → integrity验证 → 提交

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 征信 | 人行征信, Experian, Equifax, TransUnion, 百行征信 |
| 制裁/AML | World-Check, Dow Jones, OFAC SDN, Chainalysis |
| 文档handle | ABBYY, Tesseract OCR, AWS Textract |
| 核心银行 | Temenos, FIS, 长亮科技, 中电金信 |
| 保险平台 | Guidewire, Duck Creek, 中科软 |

**data敏感度分级**: 

- 极度敏感 (PII+金融) : identity证号/SSN, 银行账号, 征信报告, 医疗record (保险) , 纳税申报
- 机密: 风控模型, 定价算法, 持仓信息, 客户名单
- 受监管: 所有交易data留存 5-7 年

**性能/延迟预算**: 

- 欺诈评分: <200ms · 信用预审: <5s
- KYC 验证: auto <30s, augmentation尽职调查 <24h
- 理赔handle: 简单auto裁决 <1min, 复杂含人工 <48h
- 监管报表: 批handle, 严格截止 (T+1 或月度) 

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 模型drift致不良信贷 | PSI 监控, 冠军-挑战者testing, autofallback |
| AML false positive过载 | based onrisk优先sort, 反馈循环优化, 分层审查 |
| 监管报表datainconsistent | 对账check, data血缘追踪, 提交前验证 |
| 部署有偏见模型 | 部署前公平性testing, 按受保护群体持续监控 |
| KYC 证件伪造 | 多因素验证, 活体检测, 政府data库交叉comparison |

---

# 75. datahandle域架构

> 关联: §37 业务域建模 · §29 Knowledge/Memory · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §5

**DomainDescriptor 映射**: 

- `domain_id`: `data-engineering` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: sla_driven (批handle SLA 驱动, 流handle亚秒级) 
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data治理/GDPR 删除权/data驻留) 

**核心 Agent 角色**: 管线编排 · data质量 · Schema manage · data血缘 · 异常检测

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --------------------------- | ------------- | ----------- | -------------------------- |
| `tool.schema.migrate` | 50 | 85 | 破坏性变更force人工审批 |
| `tool.pipeline.deploy_prod` | 50 | 75 | 首次生产运行前审核代码 |
| `tool.data.delete` | 60 | 90 | data删除requestforce审批 |
| `tool.pipeline.retry` | 20 | 20 | autoexecute (幂等保证)  |

**DomainEvalFramework**: SLA 达成率 · data质量checkvia率 · 管线生成正确率 · 计算成本趋势 · 血缘coverage率

**HITL strategy**: Schema 迁移审批 (破坏性变更) · 生产管线部署 · data删除request · 敏感data集访问authorization

**关键护栏**: Schema drift检测 · 幂等写入模式 · 预算告警 + execute前query成本估算 · 敏感data最小化访问

**Agent 工作流 (详细) **: 

- 管线编排 Agent: 自然语言需求 → DAG 生成 (Airflow/Dagster) → 调度/重试/dependencymanage
- data质量 Agent: 入站 Profiling → validation规则 (Schema/range/唯一性/referencesintegrity) → 坏record隔离 → 质量报告
- Schema manage Agent: 源system变更检测 → 迁移脚本 → 下游影响评估 → Schema 注册中心
- data血缘 Agent: 源头到消费追踪 → 血缘graph谱 → 影响analysis → 审计追踪
- 异常检测 Agent: data量/新鲜度/分布drift/管线延迟监控 → Root Cause告警

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 编排 | Apache Airflow, Dagster, Prefect, dbt, Luigi |
| 流handle | Kafka, Flink, Spark Structured Streaming, Pulsar |
| 存储 | Snowflake, Databricks, BigQuery, Delta Lake, Iceberg |
| 质量 | Great Expectations, dbt tests, Monte Carlo, Soda |
| 目录/血缘 | Apache Atlas, DataHub, Amundsen, OpenLineage |

**data敏感度分级**: 

- 高: PII 列 (须sanitized/令牌化) , 金融data, 健康data
- 中: 业务指标, 运营data
- 低: publicdata集, 参考data
- Agent 需访问元data, 应最小化对实际敏感data的访问

**性能/延迟预算**: 

- 批handle管线: SLA 驱动 (如每日聚合早6点前就绪) 
- 流handle: 实时亚秒级, 准实时秒级
- data质量check: 不增加 >10% 管线runtime间
- 血缘query: 影响analysis <5s
- Agent response: 管线生成秒级, 复杂优化分钟级

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 管线运行中failure | check点, 幂等操作, autobackoff重试 |
| 源 Schema 变更中断 | drift检测, 新增fieldauto适配, 破坏性变更人工审核 |
| data质量fallback | auto隔离坏批次, fallback最后良好data, SLA 违规告警 |
| 成本失控 | 预算告警, 扩缩容limit, query成本估算 |
| 重试导致duplicate | 幂等写入 (upsert/deduplication键) , 精确一次语义 |

---

# 76. 代码开发域架构

> 关联: §37 业务域建模 · §30 Business Pack · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §6
> 已有实例: `src/domains/coding/`

**DomainDescriptor 映射**: 

- `domain_id`: `coding` · `recipe_archetype`: Creative + Adversarial
- `risk_level`: High · `latency_tier`: realtime (补全 <500ms, 审查 <5min) 
- `hitl_intensity`: High · `regulatory_density`: Low-Medium (许可证/SOC2/行业特定) 

**核心 Agent 角色**: 代码生成 · 代码审查 · testing · CI/CD · 安全扫描 · 调试

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.code.merge` | 50 | 80 | force人工开发者审查 |
| `tool.deploy.production` | 60 | 90 | 人工审批 + 安全扫描via |
| `tool.code.generate` | 30 | 40 | 合并前必须人工审查 |
| `tool.security.fix` | 40 | 60 | 安全团队审批 |

**DomainEvalFramework**: 生成代码testingvia率 · Bug 检测真阳性率 · 建议采纳率 · 漏洞检测率 · 许可证合规率

**HITL strategy**: 所有生成代码合并前必须人工审查 · 生产部署需人工审批 · 安全漏洞修复决策 · 架构决策

**关键护栏**: 预提交安全扫描 hook · 许可证合规check · lock定dependency版本验证 · range受限上下文window

**Agent 工作流 (详细) **: 

- 代码生成 Agent: 自然语言需求 → 理解代码库上下文 → 生成implementation + testing
- 代码审查 Agent: PR analysis → Bug/安全漏洞/风格/性能/架构问题 → 行级comment + 修复建议
- testing Agent: 单元/集成/E2E testing生成 → 未testingpath识别 → 夹具和 Mock → coverage率目标
- CI/CD Agent: 构建管线manage → failure解读 → 部署编排 → 功能开关 → 金丝雀analysis
- 安全扫描 Agent: SAST/DAST/SCA → 分类 → 减少false positive → 修复建议 → 漏洞生命周期
- 调试 Agent: errorlog/堆栈追踪analysis → Root Cause假设 → 修复建议 → testing环境复现

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 版本控制 | GitHub, GitLab, Bitbucket API |
| CI/CD | GitHub Actions, Jenkins, GitLab CI, CircleCI, ArgoCD |
| 安全 | Snyk, SonarQube, Semgrep, Trivy, Dependabot, CodeQL |
| testing | Jest, Pytest, JUnit, Playwright, Cypress, k6 |
| 代码analysis | Tree-sitter, Language Servers (LSP), ESLint, Ruff |
| 监控 | Sentry, Datadog, PagerDuty, Grafana |

**data敏感度分级**: 

- 极度敏感: 源代码 (核心 IP) , 密钥/凭证, 部署configure
- 机密: 构建log, 安全扫描结果, 架构graph
- 内部: publicdependency信息, 通用编码标准

**性能/延迟预算**: 

- 代码补全: 内联建议 <500ms (IDE 体验) 
- 代码审查: 典型 PR <5分钟 (异步可accepts) 
- testing生成: 单函数秒级, module分钟级
- 安全扫描: 增量分钟级, 全代码库小时级
- CI/CD: 构建/testing不应被 Agent bottleneck

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 生成代码无法编译 | 迭代修复循环: 编译→解析error→修复→重试 (最多 N 次)  |
| Agent 建议已弃用 API | lock定dependency版本, 验证实际安装包 API |
| 引入安全漏洞 | 预提交安全扫描 hook, 敏感fileforce安全审查 |
| testing不稳定 | 确定性testing模式, explicitly Mock, 重试检测标记 |
| 修改errorrange | range受限上下文window, 多file变更confirmation提示 |

---

# 77. user运营域架构

> 关联: §37 业务域建模 · §23 合规 (PIPL/GDPR) · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §7

**DomainDescriptor 映射**: 

- `domain_id`: `user-operations` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: near_realtime (触发式活动 <5min, batch分群每日) 
- `hitl_intensity`: Medium · `regulatory_density`: Medium (PIPL/GDPR/CAN-SPAM/TCPA) 

**核心 Agent 角色**: 分群 · 生命周期manage · 流失预测 · 营销auto化 · 群组analysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.send` | 30 | 60 | 活动content审批 |
| `tool.segment.create` | 20 | 50 | 敏感属性分群需隐私审核 |
| `tool.notification.push` | 20 | 40 | 频次upper limitforce |
| `tool.ab_test.launch` | 30 | 40 | A/B testing启动审核 |

**DomainEvalFramework**: 留存率 (D1/D7/D30) · 流失率 · LTV/CAC 比率 · 活动打开率/CTR · NPS/CSAT

**HITL strategy**: 活动content审批 · 敏感属性新分群审核 · notification频率strategy变更 · 激励活动预算分配

**关键护栏**: 频次upper limitforce · 参与度评分门控 · 发送前分群size验证 · 实时偏好中心synchronous · 退出名单硬性force

**Agent 工作流 (详细) **: 

- 分群 Agent: 行为dataanalysis (事件/交易/互动) → RFM/行为聚类/预测属性 → dynamic分群
- 生命周期manage Agent: 获取→激活→留存→变现→推荐 → 阶段干预 → 个性化触点
- 流失预测 Agent: 行为信号 (参与度下降/工单/功能放弃) → 流失模型 → 高risk列表 + 干预建议
- 营销auto化 Agent: 多触点活动 (Push/邮件/应用内/短信) → 发送时间优化 → 频次upper limit
- 群组analysis Agent: 获客渠道/时间/行为 → 留存曲线 → 高价值群组识别 → 洞察报告

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| CDP/analysis | Segment, Amplitude, Mixpanel, 神策data, GrowingIO, 友盟 |
| 营销auto化 | Braze, CleverTap, 极光, 个推, Iterable |
| 通信 | Twilio (短信) , SendGrid (邮件) , APNs/FCM, 微信/企微 API |
| A/B testing | Optimizely, LaunchDarkly, Firebase Remote Config |
| data仓库 | Snowflake, BigQuery, ClickHouse |

**data敏感度分级**: 

- PII (高) : user画像, 联系方式, 与可识别user关联的行为data
- 敏感行为: 位置, 健康/健身, 金融行为, 浏览历史
- 聚合 (低) : 群组级指标, 匿名漏斗data

**性能/延迟预算**: 

- 分群更新: 触发式 <5分钟延迟, batch每日
- 活动触发: 实时事件到消息投递 <1分钟
- 流失预测: 每日评分, 高价值user实时
- A/B testing结果: 统计显著性监控, 每日报告

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| notification疲劳 (退订激增)  | 频次upper limit, 参与度评分门控, auto冷静期 |
| error个性化 | content安全审查, fallback通用消息, 敏感话题检测 |
| 流失模型false positive | 分级干预 (先低成本) , A/B testing干预, 反馈至模型 |
| 发送到error分群 | 发送前分群size验证, 沙箱testing, 渐进发布 |
| 未尊重退出偏好 | 实时偏好中心synchronous, 发送层硬性退出force |

---

# 78. 行业调研域架构

> 关联: §37 业务域建模 · §29 Knowledge/Memory · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §8

**DomainDescriptor 映射**: 

- `domain_id`: `industry-research` · `recipe_archetype`: Research + Analytics
- `risk_level`: Low · `latency_tier`: batch (报告小时~天级, 突发告警 <15min) 
- `hitl_intensity`: High · `regulatory_density`: Low (证券法/data许可/版权) 

**核心 Agent 角色**: 市场analysis · 竞争情报 · 趋势预测 · 报告生成 · 监管追踪

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.report.publish` | 30 | 80 | 人工analysis师审核后才可发布 |
| `tool.data.scrape` | 40 | 60 | 版权/许可合规check |
| `tool.forecast.generate` | 30 | 50 | 前瞻性声明须加免责声明 |
| `tool.alert.send` | 20 | 30 | autoexecute (低risk信息推送)  |

**DomainEvalFramework**: 事实正确率 · 来源references率 · 洞察产出时间 · 相关来源coverage率 · analysis师满意度

**HITL strategy**: 所有发布研究必须人工analysis师审核 · 定量声明必须references来源 · 前瞻性声明必须加免责声明

**关键护栏**: 所有定量声明force来源references · data时间戳 + 新鲜度check · 改写比率监控 (防版权侵犯) · 反面证据partial要求

**Agent 工作流 (详细) **: 

- 市场analysis Agent: 多来源data收集 (金融data库/新闻/统计/报告) → 市场规模/增长/竞争格局 → 结构化报告
- 竞争情报 Agent: 竞争对手活动监控 (产品/定价/招聘/专利/监管) → 竞品档案 → changes告警
- 趋势预测 Agent: 专利/论文/融资/社交/政策信号 → 新兴趋势识别 → 置信度前瞻
- 报告生成 Agent: 发现→结构化报告 (execute摘要/方法论/建议) → 多格式 → references严谨
- 监管追踪 Agent: 跨辖区监管changes → 业务影响评估 → 合规差距analysis → 变更日历

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| data源 | Wind, Bloomberg, Statista, IBISWorld, 国家统计局, Euromonitor |
| 新闻/媒体 | NewsAPI, GDELT, 财新/36kr API, 社交聆听 |
| 专利 | WIPO, USPTO, CNIPA, Google Patents |
| 财务报告 | SEC EDGAR, 巨潮资讯网, ExFact |
| NLP | 情感analysis, NER, 摘要生成 |

**data敏感度分级**: 

- 机密: 专有研究发现, 客户特定analysis, 竞争strategy建议
- authorization许可: 第三方data (Bloomberg/Wind) 许可证limit再分发
- public: 政府统计, 已public报告, public新闻

**性能/延迟预算**: 

- 告警生成: 突发新闻/监管changes <15分钟
- 报告生成: 小时到天级 (异步) , 综合报告可能数小时
- data刷新: 市场每日, 竞争每周, 深度每季度

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 幻觉统计data | 所有定量声明force来源references, 验证 Agent 交叉check |
| staledata当现data | 所有data点加时间戳, 新鲜度check, 超阈值标记 |
| 版权侵犯 | 归因摘要, 合理uses指南, 改写比率监控 |
| misses关键竞品 | 多来源交叉references, missing口检测清单, 人工range审核 |
| 趋势识别偏见 | 反面证据要求, 多视角 Prompting, 不确定性量化 |

---

# 79. 学术调研域架构

> 关联: §37 业务域建模 · §29 Knowledge/Memory · §23 合规 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §9

**DomainDescriptor 映射**: 

- `domain_id`: `academic-research` · `recipe_archetype`: Research
- `risk_level`: Low · `latency_tier`: batch (文献综述小时~天级, 写作辅助实时) 
- `hitl_intensity`: High · `regulatory_density`: Medium (研究伦理/发表伦理/data法规) 

**核心 Agent 角色**: 文献综述 · 假设生成 · 实验设计 · dataanalysis · 写作与发表

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.manuscript.submit` | 30 | 90 | 人工研究者完整审核 |
| `tool.citation.insert` | 10 | 70 | 每条references必须 DOI 验证 |
| `tool.analysis.run` | 20 | 50 | 假设check + 人工统计师审核 |
| `tool.literature.search` | 10 | 10 | autoexecute |

**DomainEvalFramework**: references准确率 100% (零捏造) · 统计正确性 · 可复现性 · 文献coverage率 · 写作质量

**HITL strategy**: 所有发表content必须人工研究者审核 · 假设选择/实验设计审批 · 统计方法选择 · 研究者必须承担知识产权

**关键护栏**: 每条referencesauto DOI/data库验证 · 查重工具集成 · 假设check Agent 层 · 隔离handle环境 (防data泄露) 

**Agent 工作流 (详细) **: 

- 文献综述 Agent: 学术data库search (Semantic Scholar/PubMed/CNKI/arXiv) → sort → 关键发现提取 → 研究空白 → 规范referencesmanage
- 假设生成 Agent: 跨论文发现analysis → 矛盾/未探索交叉 → 可检验假设 + 实验方法建议
- 实验设计 Agent: 样本量计算 → 对照组 → 统计检验 → 混淆变量 → 预注册文档
- dataanalysis Agent: 统计analysis (回归/ANOVA/生存analysis) → 可视化 → 常见errorcheck (p-hacking/多重比较) 
- 写作与发表 Agent: 期刊排版 → 摘要生成 → 参考文献 (BibTeX/EndNote) → 投稿包

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 学术data库 | Semantic Scholar, PubMed/MEDLINE, arXiv, CNKI, Web of Science, Scopus |
| referencesmanage | Zotero, Mendeley, EndNote |
| dataanalysis | R, Python (scipy/statsmodels/pandas) , SPSS, Stata |
| LaTeX | Overleaf API, LaTeX 编译工具链 |
| 可复现性 | Jupyter, R Markdown, Docker, DVC, MLflow |
| 预注册 | OSF, AsPredicted |

**data敏感度分级**: 

- 高: 人体受试者data (IRB) , 患者data (HIPAA) , 未发表成果, 基金申请书
- 中: 预发表稿件, 初步结果, 同行评审意见
- 低: 已发表论文, publicdata集

**性能/延迟预算**: 

- 文献search: 初始 <30s, 全面检索分钟级
- 统计analysis: 秒到分钟级
- 写作辅助: 实时或准实时
- 完整文献综述: 小时到天级 (异步) 

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| references捏造 | 每条referencesauto DOI/data库验证 |
| 统计方法误用 | 假设check层, 诊断testing, 人工统计师审核 |
| 生成text抄袭 | 集成查重 (Turnitin/iThenticate) , 原创性评分 |
| misses相关文献 | 多data库search, references链追踪, 专家coverage审核 |
| 未发表成果泄露 | 严格访问控制, 隔离handle环境 |

---

# 80. 企业知识库域架构

> 关联: §37 业务域建模 · §50 知识域隔离 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §10

**DomainDescriptor 映射**: 

- `domain_id`: `knowledge-base` · `recipe_archetype`: CRUD-heavy
- `risk_level`: Medium · `latency_tier`: realtime (search <2s, 综合答案 <5s) 
- `hitl_intensity`: Medium · `regulatory_density`: Medium (data留存/访问控制/隐私) 

**核心 Agent 角色**: 文档handle · 知识graph谱 · 语义search · FAQ 生成 · 知识missing口analysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| ---------------------------- | ------------- | ----------- | -------------------------- |
| `tool.search.query` | 10 | 40 | query时实时访问permissionscheck |
| `tool.document.ingest` | 20 | 50 | 新文档源接入需审批 |
| `tool.answer.synthesize` | 20 | 60 | 低置信度回答"我不知道" |
| `tool.content.retire` | 30 | 70 | content退役需 domain_owner 决策 |

**DomainEvalFramework**: MRR/NDCG/precision@k · 答案忠实度 · references准确性 · coverage率 · 零未authorization访问事件

**HITL strategy**: 访问控制strategy定义 · 敏感文档分级 · Agent 回答error时纠错 · content退役决策

**关键护栏**: 源systempermissions镜像 + query时访问check · forcereferences可验证链接 · 文档新鲜度追踪 + stale告警 · 层次化分块

**Agent 工作流 (详细) **: 

- 文档handle Agent: 多格式摄入 (PDF/Word/PPT/Confluence/邮件/会议纪要) → 结构化提取 → 分块 → 元datamaintained
- 知识graph谱 Agent: NLP 实体/关系提取 → graph谱构建 (人物/项目/技术/流程) → 歧义解决 → 跨域关联
- 语义search Agent: 自然语言query → 混合search (关键词+向量) → re-sort序 → 带references综合答案
- FAQ 生成 Agent: 高频问题识别 (工单/聊天/search) → FAQ 生成maintained → 过时检测
- 知识missing口analysis Agent: 未文档化流程 → stalecontent → 矛盾 → 持续无法匹配的query

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 文档源 | Confluence, SharePoint, Google Drive, Notion, 飞书, 钉钉 |
| 向量data库 | Pinecone, Weaviate, Milvus, Qdrant, pgvector |
| 知识graph谱 | Neo4j, Amazon Neptune, TigerGraph |
| 嵌入模型 | OpenAI Embeddings, BGE, Cohere Embed, Jina |
| 文档解析 | Unstructured.io, LlamaParse, Adobe PDF Services |
| search引擎 | Elasticsearch, OpenSearch, Typesense |

**data敏感度分级**: 

- 极度机密: 高管战略文档, 并购材料, 人事档案, 法律意见
- 机密: 内部政策, 技术架构, 项目文档, 财务data
- 内部: 通用流程, 培训材料, 产品文档
- 必须implementation与源systempermissions一致的文档级访问控制

**性能/延迟预算**: 

- search/query: 结果 <2s, LLM 综合答案 <5s
- 文档摄入: 分钟到小时级 (批handle可accepts) 
- 知识graph谱更新: 关键文档准实时, 通用每日batch
- 可用性: 工作时间 99.9%

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| search泄露机密 | 源systempermissions镜像, query时访问check, 审计log |
| 幻觉答案 | forcereferences链接, 忠实度评分, 低置信度回答"我不知道" |
| returnstalecontent | 新鲜度追踪, autostale告警, 弃用工作流 |
| 分块质量差 | 层次化分块带overlap, 父子检索, 元data丰富 |
| 知识graph谱inconsistent | conflict检测, 来源追踪, 人工仲裁工作流 |

---

# 81. 财务域架构

> 关联: §37 业务域建模 · §23 合规 · §49 合规strategy引擎 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §11

**DomainDescriptor 映射**: 

- `domain_id`: `finance-accounting` · `recipe_archetype`: Compliance + CRUD-heavy
- `risk_level`: Critical · `latency_tier`: batch (月结window驱动, 即席query <30s) 
- `hitl_intensity`: Critical · `regulatory_density`: Critical (CAS/US GAAP/SOX/金税四期/IFRS) 

**核心 Agent 角色**: 发票handle · 费控 · 财务报告 · 税务合规 · 对账 · 预算预测

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.journal.post` | 50 | 85 | 超阈值凭证force审批 |
| `tool.financial.signoff` | 50 | 95 | CFO/财务总监签字 |
| `tool.tax.file` | 50 | 95 | 税务申报提交force人工审批 |
| `tool.invoice.process` | 30 | 50 | 三单匹配via后auto过账 |

**DomainEvalFramework**: 直通handle率 · GL 过账准确率 · 对账匹配率 · 月结天数 · 审计发现数 · 职责分离违规数

**HITL strategy**: 超阈值记账凭证审批 · 财务报表签字 (CFO/Controller) · 税务申报提交 · 坏账核销 · SOX 要求文档化审核 · 职责分离force

**关键护栏**: OCR 置信度评分 + below阈值人工审核 · 三单匹配验证 · duplicate付款检测 · 汇率源验证 (央行/ECB) · 期末截止规则

**Agent 工作流 (详细) **: 

- 发票handle Agent: 接收 (邮件/扫描/电子发票) → OCR → 三单匹配 → 审批路由 → ERP 过账
- 费控 Agent: 报销单政策合规审核 → 异常标记 → 合规内auto审批 → 异常人工路由
- 财务报告 Agent: 子账簿汇总 → 合并 (多实体/multi-currency) → 三表生成 → 差异analysis
- 税务合规 Agent: 税务负债计算 (增值税/所得税/代扣) → 纳税申报 → 转让定价文档
- 对账 Agent: 跨system匹配 (银行 vs 总账/公司间/子账簿) → 差异识别 → 解决建议
- 预算与预测 Agent: 历史+驱动因素 → 预测 → 情景analysis → 预算 vs 实际 → 滚动预测

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| ERP | SAP S/4HANA, Oracle ERP Cloud, 用友 U8/NC, 金蝶 K/3/Cloud |
| 费控 | SAP Concur, Expensify, Ramp |
| 税务 | Thomson Reuters ONESOURCE, Avalara, 航天信息 (金税system)  |
| 银行 | 银行 API (PSD2/Open Banking) , SWIFT, 银企直连 |
| OCR | ABBYY, Kofax, 百度AI/腾讯AI OCR |
| BI | Tableau, Power BI, 帆软 FineReport |

**data敏感度分级**: 

- 极度机密: 未public财务结果, 高管薪酬, 并购估值, 税务头寸
- 机密: 总账data, 供应商合同, 员工报销, 银行账户
- 受监管: 所有财务record SOX/审计留存 (7-10年) 

**性能/延迟预算**: 

- 发票handle: OCR+匹配 <1min, 当日过账
- 月结: 目标 3-5 天 (从 10+天缩短) , 批handle在月结window内完成
- 税务申报: 严格监管截止 (中国增值税每月15日前) 
- 对账: 银行每日, 其他每月
- 报告: 即席 <30s, 定时报表批handlewindow内

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| OCR 误读发票金额 | 置信度评分+低阈值人工审核, 三单匹配验证 |
| 会计期间归属error | 期末截止规则, 与采购/交货日期验证, 反向记账 |
| 合并汇率error | 汇率源验证 (央行/ECB) , 折算与重新计量对账 |
| 税款计算error | 多方法验证, 上期比较, 税率表验证 |
| duplicate付款 | duplicate检测 (供应商+金额+日期+发票号) , 审批工作流 |

---

# 82. 法务域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §12

**DomainDescriptor 映射**: 

- `domain_id`: `legal` · `recipe_archetype`: Compliance + Adversarial
- `risk_level`: Critical · `latency_tier`: batch (合同审查 <1h, 电子发现吞吐量优先) 
- `hitl_intensity`: **最高** (所有output必须经执业律师审核) · `regulatory_density`: Critical (民法典/反垄断法/GDPR/职业伦理) 

**核心 Agent 角色**: 合同审查 · 监管合规 · 诉讼支持 · 知识产权manage · 尽职调查 · 政策起草

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | ------------------------------ |
| `tool.contract.review` | 30 | 80 | 所有结果必须律师审核 |
| `tool.legal_opinion.draft` | 50 | 99 | 绝不auto外发, force律师审核 |
| `tool.ediscovery.classify` | 40 | 85 | 特权判定force人工审核 |
| `tool.ip.search` | 20 | 30 | autoexecute (辅助信息收集)  |

**DomainEvalFramework**: risk条款检测召回率 (必须捕获所有) · 判例references准确性 · 电子发现召回率 · 审查时间缩减 · 截止日期遵从

**HITL strategy**: **所有法律output在被采取行动前必须经执业律师审核** -- 本域 HITL 要求为 24 域最高 (与医疗健康域并列) . 合同谈判 · 诉讼strategy · 监管申报 · 法律意见 · 特权判定全部force人工. Agent 只提供"法律信息"而非"法律意见". 

**关键护栏**: 保守strategy (标记所有异常content) · 判例references必须法律data库验证 · 多因素特权检测 · explicitly辖区标注 · 监管日历 + 多源冗余告警

**Agent 工作流 (详细) **: 

- 合同审查 Agent: 逐条 vs 标准条款手册 → 偏离识别 → risk标记 (无限责任/不利赔偿/auto续约) → 谈判建议 → 红线标注
- 监管合规 Agent: 跨辖区法规changes监控 → 法规→业务流程映射 → 差距analysis → 整改追踪
- 诉讼支持 Agent: 电子发现文档审查 → 相关性/特权分类 → 案件时间线 → 法律研究
- IP manage Agent: 商标/专利监控 → 续期追踪 → FTO 检索 → 侵权识别 → 组合manage
- 尽职调查 Agent: 目标公司file审查 → 关键条款提取 → 负债/或有事项 → 危险信号
- 政策起草 Agent: 辖区要求 → 隐私政策/ToS/合规政策 → 版本manage

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 合同manage | DocuSign CLM, Ironclad, 法大大, 上上签, Icertis |
| 法律研究 | Westlaw, LexisNexis, 北大法宝, 威科先行 |
| 电子发现 | Relativity, Nuix, Logikcull, DISCO |
| 知识产权 | Thomson Reuters IP, MaxVal, 国家知识产权局 |
| 合规 | OneTrust, LogicGate, SAI360 |

**data敏感度分级**: 

- 律师-客户特权: 法律意见, 诉讼strategy, 和解讨论 -- 最高保护
- 极度机密: 并购file, 监管调查, IP 商业秘密, 劳动争议
- 机密: 标准合同, 政策, 合规record
- 受监管: 法院文书 (partialpublic) , 监管提交

**性能/延迟预算**: 

- 合同审查: 标准 <1h, 复杂多方 <24h
- 监管监控: 每日扫描, 关键changes实时告警
- 电子发现: 每小时数千文档 (吞吐量 > 延迟) 
- 法律研究: 初始判例 <30s, 完整备忘录分钟级

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| misses关键合同条款 | 标记所有异常, 全面条款手册, 所有合同人工审核 |
| 捏造判例references | force法律data库验证, 绝不呈现未验证references |
| 特权分类error | 多因素检测, 所有特权判定人工审核 |
| 辖区不匹配 | explicitly标注辖区, 辖区专属条款手册, conflict标记 |
| 错过法规变更 | 多源监控, 冗余告警, 带人工责任的监管日历 |

---

# 83. 在线直播域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §13

**DomainDescriptor 映射**: 

- `domain_id`: `live-streaming` · `recipe_archetype`: Realtime + Moderation
- `risk_level`: High · `latency_tier`: realtime (推流 <1s, 弹幕审核 <200ms) 
- `hitl_intensity`: **高** (涉政/涉恐审核, 直播带货违规处置) · `regulatory_density`: High (互联网直播服务manage规定/未成年人保护法/广告法) 

**核心 Agent 角色**: 直播编排 · 互动运营 · 实时content审核 · 电商转化 · dataanalysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.stream.publish` | 25 | 60 | 推流前需validation主播资质与content标签 |
| `tool.moderation.realtime` | 40 | 95 | 涉政/涉恐/涉未成年人content即时断流, force人工复核 |
| `tool.commerce.shelf` | 30 | 70 | 商品上架需合规validation, 违禁品auto拦截 |
| `tool.danmaku.filter` | 20 | 50 | 敏感词实时filter, 边缘case人工抽检 |

**DomainEvalFramework**: 违规检出率 (涉政/涉黄/涉未成年人零漏放) · false positive率 (<2%避免falsely flagged正常content) · 处置延迟 (断流 <3s) · GPM (千次观看成交额) · 推流success率

**HITL strategy**: 涉政/涉恐/涉未成年人contentforce人工审核后方可恢复直播流; 直播带货违规处置需运营confirmation; 大型活动开播前预审force人工签核. Agent 承担实时初筛与编排调度, 最终处置决定权归属审核运营团队. 

**关键护栏**: 多模态实时审核流水线 (音频+视频+文字parallel) · 未成年人保护时段硬limit · 敏感时期auto提升审核等级 · 断流熔断机制 (误判可快速恢复) · 电商合规双重validation (平台规则+广告法) 

**Agent 工作流 (详细) **: 

- 直播编排 Agent: 推流初始化 → 多平台分发 (抖音/快手/B站/视频号) → 转码configure → CDN 调度 → 质量监控 → 回放生成
- 互动运营 Agent: 弹幕情感analysis → 互动玩法 (红包/答题/投票/连麦) → 热度曲线调节 → 粉丝等级体系
- 实时审核 Agent: 多模态流采样 (视频/音频/弹幕) → AI 分类 → risk评分 → 处置 (警告/禁言/断流) 
- 直播电商 Agent: 商品上下架节奏 → 优惠券时机 → 库存lock定 → 实时销售看板 → 促销dynamic调整
- dataanalysis Agent: 实时指标追踪 (在线/互动/转化/礼物/GPM) → 复盘报告 → 历史对比 → 优化建议

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 直播平台 | 抖音/快手/B站/视频号/淘宝直播/YouTube Live/Twitch API |
| 推流/转码 | OBS SDK, FFmpeg, SRS, 阿里云直播, 腾讯云直播, 声网 Agora |
| content审核 | 阿里云绿网, 腾讯天御, 百度content安全, Amazon Rekognition |
| 电商 | 抖音小店, 快手小店, 淘宝联盟, 有赞 |
| data | 蝉妈妈, 飞瓜data, ClickHouse, Apache Flink |

**data敏感度分级**: 

- 高 (PII+金融) : user实名信息, 支付账户, 打赏/交易record, 主播收入
- 机密: 运营strategy, 选品data, MCN 合同, 分成比例, 推荐参数
- 内部: 聚合观看data, 互动统计, public回放
- 实时流data含主播肖像/环境信息, 需按场景分级

**性能/延迟预算**: 

- 推流: 低延迟 <1s, 超低延迟 (连麦) <400ms, 标准 <3s
- 审核: 视频帧 <500ms, 弹幕 <200ms (synchronousfilter) 
- 互动: 红包/投票/连麦 <1s
- 电商: 商品上下架 <2s, 库存lock定 <500ms
- 可用性: 直播期间 99.99%

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 推流中断/CDN 故障 | auto切换备用地址和 CDN, 断流重连, 观众端无缝切换 |
| 审核漏检违规 | 多模型级联, 人工巡查兜底, 事后追溯, 实时举报通道 |
| 直播电商库存超卖 | 库存预lock定, 安全库存缓冲, 超卖auto补偿 |
| 打赏system异常 | 幂等性设计, 对账实时validation, 异常冻结+人工复核 |
| 大规模concurrent过载 | 弹性扩缩容, 限流降级, 核心链路保护 (推流优先)  |

---

# 84. 广告素材制作域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §14

**DomainDescriptor 映射**: 

- `domain_id`: `creative-production` · `recipe_archetype`: Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (文案 <10s, graph片 <30s, 合规check <5s) 
- `hitl_intensity`: **中** (品牌类素材发布前审批, 医疗/金融素材法务审核) · `regulatory_density`: Medium (广告法/版权法/肖像权) 

**核心 Agent 角色**: 创意生成 · 品牌合规check · 素材适配 · 效果预测 · 工作流manage

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.creative.generate` | 25 | 55 | 生成素材auto标注 AI 生成水印, 品牌素材需人工审批 |
| `tool.brand.compliance` | 30 | 75 | 医疗/金融/教育行业素材force法务审核 |
| `tool.asset.adapt` | 15 | 25 | 尺寸/格式适配autoexecute |
| `tool.creative.predict` | 20 | 35 | 效果预测结果only供参考, 不auto触发投放决策 |

**DomainEvalFramework**: 品牌合规via率 (品牌调性一致) · 平台审核一次via率 (>95%) · CTR/CVR 预测准确性 · 素材产出速度 (较人工提效倍数) 

**HITL strategy**: 效果类素材batch生成可auto流转至投放system; 品牌类素材, 医疗/金融/教育等强监管行业素材发布前force人工审批. 涉及名人肖像或第三方版权素材需法务confirmationauthorization链integrity. 

**关键护栏**: 版权素材溯源链路 (所有references素材可追溯authorization) · 绝对化用语auto检测 (广告法禁用词库实时更新) · 肖像权usesauthorizationvalidation · 行业敏感词filter (医疗/金融/教育分级词库) · 生成content AI 水印forceinjection

**Agent 工作流 (详细) **: 

- 创意生成 Agent: Brief 解析 → 创意strategy → 多格式素材 (文案/graph片/视频脚本/落地页) → 品牌validation → A/B 变体
- 品牌合规check Agent: 素材摄入 → 品牌规范匹配 (Logo/色彩/字体/调性) → 广告法validation → risk标注 → 修改建议
- 素材适配 Agent: 源素材解析 → 平台规格匹配 (9:16/1:1/16:9/3:4) → 智能裁切/re-sort → batchoutput
- 效果预测 Agent: 历史+素材特征 (色调/情感/CTA/人物占比) → CTR/CVR 预测 → sort → 优化方向
- 工作流manage Agent: 需求池 → task分配 → 审批流转 → 版本manage → 素材资产库 → 全链路state

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| graph像生成 | Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly, 即梦 AI |
| 视频制作 | RunwayML, Pika, Sora, 剪映 API, Adobe Premiere SDK |
| 设计 | Figma API, Canva API, Adobe CC SDK, 蓝湖 |
| 文案生成 | GPT-4, Claude, 文心一言, 通义千问 |
| DAM | Bynder, Brandfolder, Adobe AEM Assets |
| 效果analysis | 巨量创意, 腾讯广告创意中心, Google Ads Creative Studio |

**data敏感度分级**: 

- 机密: 未发布创意strategy, 品牌规范手册, 竞品analysis, 预测模型参数
- 内部: 已发布素材, 投放效果data, A/B testing结果, 素材资产库
- 低: public广告素材, 行业创意参考

**性能/延迟预算**: 

- 文案生成: 单条 <10s, batch (100变体) <5min
- graph片生成: 单张 <30s, batch适配 (10尺寸) <3min
- 视频生成: 15秒短视频 <10min, 长视频小时级 (异步) 
- 品牌合规check: 单素材 <5s
- 效果预测: batch评分 <1min

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 生成素材侵犯版权 | 相似度检测 (对比版权graph库) , 溯源水印, 侵权auto下架 |
| 品牌规范偏离 | 规范嵌入 Prompt, 风格参考graph约束, 多轮validation |
| 广告法违规文案 | 禁用词库实时filter, 合规 Agent 前置审核, 违规auto替换 |
| batch质量失控 | 质量评分门槛filter, 抽样人工审核, 低分auto打回 |
| 效果预测失准 | 持续 A/B 校准, 模型定期重训, 偏差监控 |

---

# 85. 游戏开发域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §15

**DomainDescriptor 映射**: 

- `domain_id`: `game-dev` · `recipe_archetype`: Creative + Research
- `risk_level`: Medium · `latency_tier`: batch (QA <2h, 数值模拟 <10min) 
- `hitl_intensity`: **高** (核心玩法设计/美术风格定调/版本发布审批) · `regulatory_density`: High (版号/防沉迷/content审查/ESRB/PEGI) 

**核心 Agent 角色**: 设计辅助 · 美术资产生成 · QA auto化 · 数值平衡 · 代码生成

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.game.design_assist` | 20 | 40 | 设计建议only供参考, 核心玩法决策force人工 |
| `tool.game.asset_generate` | 25 | 65 | 美术资产需主美confirmation风格一致性后方可入库 |
| `tool.game.qa_run` | 15 | 20 | auto化testing自主execute, Bug 报告auto归档 |
| `tool.game.balance_sim` | 30 | 55 | 数值调整建议需策划审核, 不auto写入configure表 |

**DomainEvalFramework**: 美术风格一致性 (FID/CLIP-Score) · Bug 发现率 (auto化 vs 人工对比) · 代码生成采纳率 · 基尼系数 (经济/数值平衡性) 

**HITL strategy**: 核心玩法设计, 美术风格定调, 版本发布审批为force人工决策节点. 数值平衡模拟结果需策划团队confirmation后方可应用. QA auto化可independentexecute, 但 P0/P1 级 Bug 修复方案需开发负责人签核. 

**关键护栏**: 生成资产版权合规check (与已知 IP 相似度检测) · content审查预筛 (版号申报合规前置validation) · 防沉迷机制预埋验证 · 代码生成安全扫描 (injection/漏洞auto检测) · 数值模拟异常值熔断

**Agent 工作流 (详细) **: 

- 设计辅助 Agent: 设计意graph → 参考analysis → system设计 (玩法循环/关卡/经济/叙事) → 数值框架 → GDD
- 美术生成 Agent: 风格参考 → 资产需求解析 → 生成 (概念graph/2D/3D/UI/场景) → 风格一致性validation → 格式导出
- QA Agent: 功能testing (task/UI/存档) → 性能testing (帧率/in-memory/加载) → compatibility性testing → crashedanalysis → Bug 报告
- 数值平衡 Agent: 经济system/属性/难度曲线 → 蒙特卡洛模拟 → 平衡性评估 → 破解strategy检测
- 代码生成 Agent: Gameplay/Shader/AI 行为树/网络synchronous → 适配引擎 (Unity/Unreal) → 代码规范

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 引擎 | Unity (C#) , Unreal (C++/Blueprint) , Godot, Cocos Creator |
| 美术 | Midjourney, Stable Diffusion (ControlNet/LoRA) , Substance 3D, Meshy |
| 版本控制 | Perforce Helix Core, Git LFS, PlasticSCM |
| testing | Unity Test Framework, Unreal Automation, Appium, GameBench |
| 数值 | Python (NumPy/SciPy) , MATLAB, 自研模拟器 |

**data敏感度分级**: 

- 极度机密: 未公布 GDD, 核心玩法专利, 源代码, 未发布美术资产
- 机密: 内部testingdata, 性能基准, 数值模型, 项目排期
- 内部: 已public预告素材, 开发者博客, 已上线资产

**性能/延迟预算**: 

- 美术生成: 概念graph <30s, 2D batch <5min, 3D 提示 <1min
- QA testing: 单轮回归 <2h (parallel) , crashedanalysis <5min
- 数值模拟: 单次 <10min (1万次蒙特卡洛) , 参数扫描小时级
- 代码生成: 单函数 <10s, module <2min
- 构建: 增量 <5min, 完整 <1h

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 美术风格偏离 | ControlNet/LoRA 约束, Art Director 审核门控 |
| 数值模拟偏差 | 上线 A/B 验证, 玩家data回馈, 热更新调整 |
| autotesting漏检 | 多strategy组合 (随机+定向+探索) , 人工补充, 玩家反馈 |
| 生成代码性能问题 | Profiling auto集成, 性能预算门控 |
| 程序化contentduplicate | 变异种子多样化, 手工+生成混合比例, 新鲜度监控 |

---

# 86. 游戏上架域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §16

**DomainDescriptor 映射**: 

- `domain_id`: `game-publishing` · `recipe_archetype`: Compliance + Logistics
- `risk_level`: High · `latency_tier`: near-realtime (Live Ops <5min, 提审 <1h) 
- `hitl_intensity`: **高** (版号提审材料/重大版本发布/大型活动configure/敏感local化) · `regulatory_density`: Critical (版号/分级/防沉迷/PIPL/GDPR/支付合规) 

**核心 Agent 角色**: 商店提审auto化 · 合规审查 · local化 · Live Ops · dataanalysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.store.submit` | 35 | 85 | 提审材料force人工终审, 版号相关content零容错 |
| `tool.compliance.check` | 40 | 90 | 防沉迷/支付合规/隐私协议autovalidation+人工复核 |
| `tool.localization.translate` | 20 | 45 | 常规textautoexecute, 文化敏感/法律textforce人工 |
| `tool.liveops.config` | 25 | 65 | 大型活动configure需产品+运营双重审批 |

**DomainEvalFramework**: 提审一次via率 (>90%为目标) · DAU/留存率 (版本健康度) · 活动参与率 · ASO 排名 (商店优化效果) · LQA Bug 密度 (local化质量) 

**HITL strategy**: 版号提审材料, 重大版本发布, 大型活动configure为force人工审批节点. 敏感地区local化content需local法务+文化顾问双重签核. 支付相关configure变更需财务合规confirmation. Live Ops 常规活动可auto上线, 异常指标触发人工介入. 

**关键护栏**: 多地distinguish级合规矩阵 (auto匹配目标市场法规) · 防沉迷实名认证链路validation · 支付合规multi-currency审计 · local化文化敏感词库 (宗教/政治/历史) · 版本rollback热备机制 (异常指标auto触发) 

**Agent 工作流 (详细) **: 

- 提审auto化 Agent: 材料准备 → 平台规格适配 (App Store/Google Play/Steam/TapTap) → auto提交 → state追踪 → 拒审analysis重提
- 合规审查 Agent: 版号材料准备 → 分级评估 (ESRB/PEGI/CERO) → content敏感度check → 合规差距报告
- local化 Agent: UI 翻译 → 语音协调 → 文化适配 (节日/naming/视觉) → 术语一致性 → LQA testing
- Live Ops Agent: 版本更新plan → 活动configure (限时/赛季/节日) → 公告 → 服务器manage → 热更新
- dataanalysis Agent: 下载/DAU/MAU/留存/付费/LTV → 评价趋势 → 竞品对标 → 运营建议

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 应用商店 | App Store Connect, Google Play Console, Steamworks, TapTap, 华为 AppGallery |
| data | data.ai, Sensor Tower, GameAnalytics, Firebase, ThinkingData |
| local化 | Crowdin, Lokalise, Transifex, memoQ |
| 运营 | Firebase Remote Config, LaunchDarkly, Apollo configure中心 |
| CI/CD | Jenkins, Fastlane, Unity Cloud Build |

**data敏感度分级**: 

- 极度机密: 版号申请材料, 未公布发行plan, 合同/分成, user付费data
- 机密: 运营data, 活动configure, A/B 结果, 竞品analysis
- 内部: 已public商店页面, public评价, 行业基准

**性能/延迟预算**: 

- 提审handle: 材料准备 <1h, auto提交 <5min, state轮询每小时
- local化: UI text <24h (auto翻译+人工校对) 
- Live Ops: 活动上下线 <5min (热更新) , 紧急下线 <1min
- dataanalysis: 实时看板 <5min 延迟, 日报auto生成

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 平台审核reject | 拒审auto分类+方案推荐, 历史 Case 库, 快速重提 |
| Live Ops configureerror | 双人审核, 灰度发布 (1%验证) , 紧急rollback, 补偿方案 |
| local化error致差评 | 反馈分类, 热更新修复, LQA 加强, 社区快速response |
| 版号审批延迟 | 合规risk前置, 备选方案 (海外先行) , 预审服务 |
| 大版本致玩家流失 | A/B 前置验证, 灰度监控留存, 快速rollback, 沟通plan |

---

# 87. 人力资源域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §17

**DomainDescriptor 映射**: 

- `domain_id`: `human-resources` · `recipe_archetype`: CRUD-heavy + Compliance
- `risk_level`: High · `latency_tier`: near-realtime (简历筛选 <5s) + batch (薪酬核算 <2h) 
- `hitl_intensity`: **极高** (Offer/解雇/绩效评级/薪酬调整/组织架构变更) · `regulatory_density`: Critical (劳动法/劳动合同法/PIPL/GDPR/EU AI Act) 

**核心 Agent 角色**: 招聘 · 入职 · 绩效analysis · 薪酬建模 · 合规监控

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.hr.resume_screen` | 35 | 80 | 筛选结果only为推荐sort, 禁止auto淘汰, 需HR复核 |
| `tool.hr.offer_generate` | 40 | 95 | Offer contentforceHRBP+法务双重审批后方可发出 |
| `tool.hr.payroll_calc` | 45 | 90 | 薪酬核算结果需财务+HR双签, 异常偏差auto拦截 |
| `tool.hr.compliance_check` | 30 | 70 | 合同条款合规autovalidation, risk条款人工复核 |

**DomainEvalFramework**: 招聘周期 (Time-to-Hire) · Offer accepts率 · 薪酬公平性指数 (性别/年龄/族裔维度) · 劳动仲裁案件数 (趋势监控) · 偏见审计via率 (EU AI Act 合规) 

**HITL strategy**: Offer 发放, 解雇决策, 绩效评级, 薪酬调整, 组织架构变更全部force人工决策. 简历筛选 Agent only提供sort建议, 最终面试邀约由 HR confirmation. EU AI Act 要求高risk AI system透明度, 所有算法决策需可解释. 

**关键护栏**: 偏见检测流水线 (性别/年龄/学历等保护属性sanitized+公平性指标监控) · 薪酬data加密隔离 (最小permissions访问) · 员工data PIPL/GDPR 合规存储与删除 · 解雇决策审计log不可tamper · 算法决策可解释性报告auto生成

**Agent 工作流 (详细) **: 

- 招聘 Agent: 需求收集 → JD 生成 → 简历筛选评分 → 面试协调 → 问题生成 → 评估汇总 → Offer 审批
- 入职 Agent: 材料收集 → IT 账号开通 → 培训plan → 导师匹配 → 试用期目标 → 体验跟踪
- 绩效analysis Agent: OKR/KPI 辅助 → data收集 → 360度汇总 → 绩效校准建议 → 改进plan
- 薪酬建模 Agent: 市场对标 → 薪酬带宽模型 → 调薪/奖金模拟 (预算+公平性) → 报告
- 合规监控 Agent: 劳动合同到期追踪 → 社保公积金 → 工时manage → 假期余额 → risk预警

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| HCM/HRIS | Workday, SAP SuccessFactors, Oracle HCM, 北森, 用友人力云, 钉钉 |
| 招聘 | LinkedIn Recruiter, Boss 直聘, 猎聘, Greenhouse, Lever |
| 薪酬data | Mercer, Aon/Radford, 中智薪酬, LinkedIn Salary |
| 学习 | Cornerstone, 云学堂, 酷学院, LinkedIn Learning |
| 签署 | DocuSign, 法大大, e签宝 |

**data敏感度分级**: 

- 极度敏感 (PII+) : identity证号, 银行账号, 薪酬, 医疗体检, 背调, 纪律处分
- 机密: 绩效评估, 晋升候选, 组织调整, 劳动仲裁
- 内部: 组织架构, 岗位描述, 培训目录, 考勤汇总

**性能/延迟预算**: 

- 简历筛选: 单份 <5s, batch (1000份) <30min
- 薪酬计算: 月度核算 <2h (批handle) , 个人query <3s
- 合规check: 合同到期提前30天预警, 工时超限实时告警
- 入职: IT 账号 <1h, 培训plan <5min

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 简历筛选偏见 | 定期偏见审计, 多维评估, 人工复核低分样本 |
| 薪资核算error | 双轨validation, 异常值标记, 发放前抽检 |
| 劳动合同到期未续 | 90/60/30天三级预警, auto续签触发, 法务升级 |
| 员工data泄露 | field级加密, 访问审计, 异常告警, 应急预案 |
| 绩效评估争议 | 申诉流程触发, data完整回溯, independent复核委员会 |

---

# 88. 供应链与物流域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §18

**DomainDescriptor 映射**: 

- `domain_id`: `supply-chain` · `recipe_archetype`: Logistics + Analytics
- `risk_level`: High · `latency_tier`: near-realtime (path改道 <30s) + batch (需求预测每日) 
- `hitl_intensity`: **高** (大额采购/新供应商准入/关务异常/危险品运输/供应链中断应急) · `regulatory_density`: High (海关法/出口管制/危险品运输/ESG) 

**核心 Agent 角色**: 需求预测 · 库存优化 · path规划 · 供应商评估 · 关务合规

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.scm.forecast` | 20 | 35 | 预测结果auto流入库存system, 异常波动告警人工复核 |
| `tool.scm.inventory_optimize` | 30 | 60 | 常规补货autoexecute, 大额采购订单force审批 |
| `tool.scm.route_plan` | 25 | 70 | 危险品运输pathforce人工审核, 常规pathautoexecute |
| `tool.scm.customs_declare` | 40 | 90 | HS 编码分类需关务专员confirmation, 出口管制商品force合规审查 |

**DomainEvalFramework**: MAPE/WMAPE (需求预测准确度) · 库存周转率 · 准时交付率 (OTIF) · HS 分类准确率 · 关税优化节约 (合规前提下的税费最优化) 

**HITL strategy**: 大额采购决策, 新供应商准入评估, 关务异常handle, 危险品运输审批, 供应链中断应急response为force人工决策节点. 常规补货与path规划在阈值内autoexecute, 超出阈值auto升级至供应链经理. 出口管制清单匹配结果零容错, force合规官签核. 

**关键护栏**: 出口管制实体清单实时synchronous (BIS/OFAC/EU) · 危险品运输合规矩阵 (UN 编号+运输方式交叉validation) · 供应商 ESG 评分持续监控 · 需求预测异常波动熔断 (防止牛鞭效应放大) · 关务申报data不可tamper审计链

**Agent 工作流 (详细) **: 

- 需求预测 Agent: 历史+趋势+促销+天气/节假日 → 预测模型 (ARIMA/Prophet/DeepAR) → 多层级预测 → 安全库存建议
- 库存优化 Agent: 预测+供应约束 → 再订货点/EOQ/安全库存 → 多仓调拨 → 周转 vs 服务水平平衡
- path规划 Agent: 订单池 → 约束建模 (车辆/时间窗/交通/成本) → VRP 求解 → 调度 → 实时改道
- 供应商评估 Agent: 多维评估 (质量/交付/价格/response/ESG) → riskanalysis (财务/地缘/单源) → 采购辅助
- 关务合规 Agent: HS 编码分类 → 关税计算 → 原产地验证 → 制裁筛查 → 报关单 → 贸易协定优化

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| ERP/SCM | SAP SCM/IBP, Oracle SCM Cloud, Blue Yonder, 金蝶/用友供应链 |
| WMS | Manhattan, Blue Yonder WMS, SAP EWM, 富勒 FLUX |
| TMS | Oracle TMS, SAP TM, G7, 运满满/货车帮 |
| 预测 | Amazon Forecast, Vertex AI, Prophet, 自研 ML |
| 关务 | Descartes, Thomson Reuters, 单一window (中国海关)  |
| IoT | GPS/温湿度传感器, RFID, 阿里云/AWS IoT |

**data敏感度分级**: 

- 机密: 供应商合同/定价, 采购成本, 库存strategy, 预测模型
- 商业敏感: 库存水位, 物流path, 仓库布局, 供应商评估
- 受监管: 海关申报, 原产地证明, 危险品运输record (5-10年) 
- IoT: GPS 轨迹, 温湿度 -- 可能涉及位置隐私

**性能/延迟预算**: 

- 需求预测: 每日batch, 突发事件触发即时重算 <30min
- 库存优化: 每日补货建议, 紧急补货 <1h
- path规划: 初始 <5min (数百订单) , 实时改道 <30s
- 关务申报: 单票 <10min, batch小时级
- IoT 监控: 异常告警 <1min

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 需求预测严重偏差 | 预测 vs 实际监控, 偏差告警, 人工校正, 安全库存缓冲 |
| 供应链中断 | 多源供应, 安全库存前置, 替代供应商激活, 应急物流 |
| path异常致延误 | 实时 GPS, dynamic改道, 预设应急路线, 客户notification |
| HS 编码分类error | 多模型交叉验证, 历史comparison, 海关预裁定, 报关员复核 |
| 仓库实物inconsistent | 周期/循环盘点, RFID auto盘点, 差异告警, 冻结调查 |

---

# 89. 医疗健康域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §19

**DomainDescriptor 映射**: 

- `domain_id`: `healthcare` · `recipe_archetype`: Compliance + Conversational
- `risk_level`: Critical · `latency_tier`: realtime (分诊 <5s, 药物check <2s) + batch (影像analysis <5min) 
- `hitl_intensity`: **最高** (所有诊断建议/处方/影像报告必须执业医师confirmation) · `regulatory_density`: Critical (医疗器械监督manage条例/HIPAA/FDA SaMD/EU MDR/NMPA) 

**核心 Agent 角色**: 临床决策支持 · 智能分诊 · 病历analysis · 药物交互check · 医学影像analysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.clinical.diagnose` | 50 | 99 | 绝不autooutput诊断结论, force执业医师审核 |
| `tool.triage.assess` | 40 | 85 | 高危分级force人工复核, 低危可辅助auto |
| `tool.drug.interaction_check` | 35 | 90 | 所有禁忌/严重交互force药师confirmation |
| `tool.imaging.analyze` | 45 | 95 | 影像报告only作辅助参考, 必须影像科医师签发 |

**DomainEvalFramework**: 诊断敏感度/特异度 · 病灶检测召回率 (漏检零容忍) · 药物交互召回率 · 分诊一致率 (与高年资医师对比) · 影像analysis假阴性率

**HITL strategy**: **所有临床决策output必须经执业医师confirmation后方可used for患者诊疗** -- 本域与法务域并列 HITL 要求最高. 诊断建议 · 处方开具 · 影像报告 · 分诊分级 · 药物方案全部force人工. Agent only提供"临床决策辅助信息"而非"医疗诊断". 

**关键护栏**: 高敏感度优先strategy (宁可false positive不可漏报) · 药物交互多源data库交叉验证 · 患者data端到端加密与最小化访问 · 影像analysis置信度阈值below 95% force人工 · 急诊场景熔断兜底至人工通道

**Agent 工作流 (详细) **: 

- 临床决策支持 Agent: 病历摄入 → 结构化提取 → 临床推理 → 指南匹配 (UpToDate/临床path) → 鉴别诊断sort → 医师审核
- 智能分诊 Agent: 症状自述 → 标准化问诊 → ESI/Manchester 评估 → 分诊级别 → 科室路由
- 病历analysis Agent: 非结构化病历 NLP 提取 (诊断/用药/手术/过敏) → 时间线 → 信息missing/矛盾 → 结构化摘要
- 药物交互 Agent: 用药列表+新处方 → DrugBank/MCDEX → 交互严重度 → 肝肾禁忌 → 剂量合理性
- 影像analysis Agent: DICOM 接收 → 预训练模型 (肺结节/骨折/眼底) → 可疑区域标注 → 报告草稿

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| EMR | Epic, Cerner, 卫宁健康, 东华软件, 创业慧康, OpenMRS |
| 临床知识库 | UpToDate, DXplain, 中国临床path, NICE, Cochrane |
| 药物data库 | DrugBank, MCDEX, Lexicomp, PASS |
| 影像 | DICOM, PACS (GE/Philips/Siemens) , MONAI, 3D Slicer |
| 互操作 | HL7 FHIR R4, ICD-10/11, SNOMED CT, LOINC, DRG/DIP |

**data敏感度分级**: 

- 极度敏感 (PHI) : 患者identity, 诊断, 基因组, 精神科/HIV/生殖 (特殊保护) 
- 机密: 临床模型参数, 医院运营, 科研中间data, 医师绩效
- 内部: sanitized聚合统计, public指南, 药品说明书

**性能/延迟预算**: 

- 急诊分诊: 危险信号 <5s (零延迟容忍) , 完整 <30s
- 药物交互: 处方validation <2s (嵌入医嘱synchronous流程) 
- 影像analysis: X光 <30s, CT 序列 <5min (GPU 加速) 
- 临床决策: 建议 <10s (门诊等待时间有限) 
- 可用性: 99.99% (急诊 7×24) 

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 影像system性漏检 | 多模型集成投票, 新标注data回归, 漏检反馈闭环 |
| 药物data库更新延迟 | 多data源交叉validation, 上市公告触发刷新 |
| EMR 集成中断 | localcached关键data, 降级手动输入, auto重连补synchronous |
| 分诊对罕见急症不足 | 危险信号hardcoded兜底, 低置信度force人工复核 |
| PHI data暴露 | 实时 PHI 检测sanitized, 访问审计, 72h 监管通报 |

---

# 90. 教育培训域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §20

**DomainDescriptor 映射**: 

- `domain_id`: `education` · `recipe_archetype`: Conversational + Creative
- `risk_level`: Medium · `latency_tier`: realtime (辅导 <3s, testing <1s) + batch (content生成) 
- `hitl_intensity`: **高** (课程content上线前教师审核/主观题评分抽检/未成年人datauses需家长同意) · `regulatory_density`: High (未成年人保护法/FERPA/COPPA/EU AI Act) 

**核心 Agent 角色**: 学习path优化 · content生成 · 智能评测 · 智能辅导 · 学情analysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.edu.learning_path` | 20 | 45 | path推荐可autoexecute, 定期教师审核 |
| `tool.edu.content_generate` | 30 | 70 | 所有生成content上线前必须教师审核 |
| `tool.edu.assess` | 35 | 75 | 主观题评分force抽检, 客观题可auto |
| `tool.edu.tutor` | 25 | 60 | 实时辅导allowsauto, 敏感话题触发人工介入 |

**DomainEvalFramework**: 知识点掌握率提升 · 评分一致性 (Cohen's Kappa ≥ 0.8) · 完课率 · 苏格拉底式引导比例 (引导而非directly给答案) · content准确率

**HITL strategy**: 课程content发布前必须经学科教师审核, 未成年人场景execute最严格data保护. content生成 · 主观题评分 · 学习path重大调整 · 敏感话题辅导force人工介入. 涉及未成年人个人data采集需家长explicitly同意. Agent 定位为"学习辅助工具"而非"教师替代". 

**关键护栏**: 未成年人content安全filter (暴力/色情/不当价值观零容忍) · 答案泄露防护 (引导优先于直答) · 年龄分级contentstrategy · data最小化采集与家长知情同意 · 学术诚信检测集成

**Agent 工作流 (详细) **: 

- 学习path Agent: 前测/历史评估 → 知识graph谱 → 个性化path (知识点序列/难度/资源) → dynamic调整
- content生成 Agent: 教学大纲+知识点 → 讲义/练习/案例/课件 → 多难度/多语言 → Bloom 层次
- 评测 Agent: 题目生成 (选择/填空/主观/编程) → auto评分 → 个性化反馈 → 薄弱项 → CAT
- 辅导 Agent: 一对一对话 → 苏格拉底式提问 → 困惑点识别 → 分步解释和类比
- 学情analysis Agent: 学习行为汇总 (时长/完成/错题/参与) → 学员画像 → risk预测 → 干预建议

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| LMS | Moodle, Canvas, Blackboard, 学堂在线, 中国大学MOOC, Coursera |
| 知识graph谱 | Neo4j, 自建学科知识graph谱, ConceptNet |
| 评测 | Gradescope, Turnitin, CodeGrader, OJ system |
| 视频/直播 | Zoom SDK, 腾讯会议, 钉钉课堂, OBS |
| dataanalysis | xAPI/LRS, Amplitude, 自建学情仪表盘 |

**data敏感度分级**: 

- 高 (未成年人data) : 学生identity, 学习行为, 成绩, 心理评估
- 机密: 试题库 (未public) , 评分标准, 教学算法参数
- 内部: 课程大纲, 已public材料, 聚合统计

**性能/延迟预算**: 

- 辅导对话: response <3s (timeout注意力流失) 
- 自适应testing: 题目推荐 <1s
- content生成: 单知识点 <1min, 完整课程小时级 (异步) 
- 评测评分: 客观题即时, 主观题 <30s/篇

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| content含知识error | 学科知识库validation, 教师审核工作流, 学员纠错反馈 |
| 主观题评分偏差 | 校准 (标杆样卷) , 低置信度转人工, 多维评分量表 |
| 学习path死循环 | 掌握度阈值调校, path多样性约束, 手动skip |
| 辅导directly给答案 | 教学strategy护栏 (force引导) , 作业场景检测, 答案filter |
| 高concurrent考试过载 | 弹性扩容, 题目localcached, 降级离线考试 |

---

# 91. 客户服务域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §21

**DomainDescriptor 映射**: 

- `domain_id`: `customer-service` · `recipe_archetype`: Conversational
- `risk_level`: Medium · `latency_tier`: realtime (聊天 <3s, 路由 <1s) 
- `hitl_intensity`: **中** (超permissions退款审批/投诉升级/法律问题/VIP 异常工单/低置信度转人工) · `regulatory_density`: Medium (消费者权益保护法/TCPA/GDPR) 

**核心 Agent 角色**: 多渠道对话 · 智能路由 · 知识检索 · 质检评分 · 升级manage

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.cs.respond` | 20 | 40 | 常规咨询auto回复, 低置信度转人工 |
| `tool.cs.route` | 15 | 25 | autoexecute智能路由, VIP 工单优先队列 |
| `tool.cs.knowledge_search` | 10 | 15 | autoexecute (辅助信息检索)  |
| `tool.cs.quality_score` | 25 | 55 | 质检评分供参考, 申诉/争议需人工复核 |

**DomainEvalFramework**: CSAT (客户满意度) · FCR (首次解决率) · AI independent解决率 · 幻觉率 (严格趋零) · AHT (平均handle时长) · 升级率

**HITL strategy**: 超permissions操作与高risk场景force人工介入, 常规咨询allows全auto闭环. 退款超阈值 · 法律/监管问题 · 投诉升级 · VIP 异常工单 · 置信度below阈值auto转人工坐席. Agent 须在对话开始时明确 AI identity, user可随时request人工服务. 

**关键护栏**: 情绪检测与升级熔断 (检测到愤怒/威胁立即转人工) · 承诺一致性validation (不承诺超出strategyrangecontent) · 多渠道上下文synchronous · 敏感信息sanitized展示 · 退款/补偿操作金额分级审批

**Agent 工作流 (详细) **: 

- 多渠道对话 Agent: 渠道接入 (聊天/电话ASR/邮件/社交) → 意graph识别 → 知识检索 → 回答生成 → 满意度confirmation → 工单归档
- 智能路由 Agent: 工单content (意graph/情感/紧急度) + 客户属性 (VIP/历史/LTV) + 坐席state → 最优路由 → 排队/溢出
- 知识检索 Agent: 语义search+精确匹配混合 → 产品/服务知识库 → 带references答案 → 知识missing口识别
- 质检评分 Agent: fullauto质检 (合规用语/态度/解决度/流程) → 评分卡 → 低分标记人工复检
- 升级manage Agent: 场景检测 (情绪激动/超permissions/技术问题/投诉) → auto升级至主管/专家/跨部门 → SLA 保障

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 全渠道 | Zendesk, Salesforce Service Cloud, Freshdesk, 网易七鱼, 智齿, Udesk |
| 语音/CTI | Genesys Cloud, Avaya, Amazon Connect, Twilio Voice, 合力亿捷 |
| 知识库 | Confluence, Guru, 自建 RAG (Pinecone/Milvus + LLM)  |
| NLP | 意graph分类, 情感analysis (BERT 微调) , ASR (讯飞/Google)  |
| CRM | Salesforce, HubSpot, 纷享销客 |

**data敏感度分级**: 

- PII (高) : 客户姓名/电话/地址/账户, 对话中支付/订单data
- 机密: 定价strategy, 补偿permissions矩阵, 未public产品plan, 投诉详情
- 内部: 聚合服务指标, FAQ content, 培训材料

**性能/延迟预算**: 

- 在线聊天: 首次response <3s, subsequent每轮 <5s
- 电话 IVR: 意graph识别 <2s, 路由 <1s
- 邮件: auto回复 <30min, 含人工 <4h
- 质检: 实时滞后 <5min, 日报次日上午
- 知识检索: 含 LLM 答案 <3s

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 承诺不exists的退款政策 | RAG 接地生成, 政策合规validation, 承诺类force人工confirmation |
| 高峰system过载 | 弹性扩容, 排队回拨, 溢出外包坐席 |
| 情感误判致投诉升级 | 多维检测 (text+语调) , 负面阈值降低触发 |
| 知识库expiry | 新鲜度追踪, 产品/政策变更触发更新, 版本标记 |
| 跨渠道上下文loss | 统一会话manage, 全渠道历史synchronous, identity统一 |

---

# 92. content审核与安全域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §22

**DomainDescriptor 映射**: 

- `domain_id`: `content-moderation` · `recipe_archetype`: Moderation + Adversarial
- `risk_level`: High · `latency_tier`: realtime (text <500ms, graph片 <1s, 视频 <30s) 
- `hitl_intensity`: **高** (申诉裁决/CSAM 案件/边界案例/strategy变更) , 审核员心理健康保护 · `regulatory_density`: Critical (网络安全法/Section 230/DSA/CSAM force报告) 

**核心 Agent 角色**: 多模态审核 · strategy引擎 · 申诉handle · 对抗检测 · 合规报告

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.moderation.classify` | 30 | 65 | 明确违规auto处置, 边界案例force人工审核 |
| `tool.moderation.appeal` | 40 | 85 | 所有申诉裁决必须人工审核员终审 |
| `tool.adversarial.detect` | 35 | 75 | 对抗样本检测结果需安全团队confirmation后入库 |
| `tool.compliance.report` | 25 | 90 | CSAM 等force报告场景立即上报并lock定证据链 |

**DomainEvalFramework**: 精确率/召回率/F1 · 违规content平均在线时长 (趋零) · 对抗样本检测率 · 申诉handle时效 · 误判率 (过度审核监控) 

**HITL strategy**: CSAM 及极端暴力contentforce即时人工处置并依法报告, 边界案例进入人工队列. 申诉裁决 · strategy规则变更 · 新型违规模式定义 · 跨文化敏感content全部force人工. 审核员暴露保护机制: content模糊化预览 · 轮岗制度 · 心理健康定期评估 · 极端content接触时长limit. 

**关键护栏**: 多模型交叉验证降低单模型偏差 · 对抗攻击持续红队testing · 证据链integrity保障 (不可tamper审计log) · 辖区差异化strategy引擎 · 审核员心理健康保护forceexecute · 误判auto申诉通道

**Agent 工作流 (详细) **: 

- 多模态审核 Agent: content接收 → 格式解析 → 多模型parallel (text/graph片/视频/音频) → 规则引擎叠加 → 置信度分级 → 处置
- strategy引擎 Agent: 审核strategymanage (平台/法规/广告主) → 版本manage → 灰度/A/B → 法规→规则auto转化
- 申诉handle Agent: 申诉接收 → 原始content重审 → 补充信息 → 复核建议 (维持/撤销/改判) 
- 对抗检测 Agent: 规避手段识别 (谐音/拼音/graph片嵌字/语义masks) → 持续学习 → 规则auto更新
- 合规报告 Agent: 按监管要求生成报告 (审核量/违规分布/时效/申诉) → 监管对接 → 证据留存

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| text | 自研 NLP (BERT 微调) , 阿里绿网, 腾讯天御, Perspective API |
| graph片/视频 | 自研 CV, PhotoDNA (CSAM) , AWS Rekognition, CLIP |
| 音频 | ASR (讯飞/Google/Whisper) , 音频分类 |
| strategy引擎 | 自建规则引擎 (Drools/DSL) , 特征平台, 实时决策 |
| 监管对接 | 网信办举报中心, NCMEC CyberTipline, DSA 透明度报告 |

**data敏感度分级**: 

- 极度敏感: CSAM -- 法律force报告, 专门流程, 严格访问控制
- 高: usercontent原始data (含 PII) , 审核决策, 举报人信息
- 机密: 审核strategy规则 (泄露后被利用规避) , 对抗模型参数
- 内部: 聚合统计, 模型性能, public社区准则

**性能/延迟预算**: 

- 发布前审核: text <500ms, graph片 <1s, 短视频 <30s
- 吞吐量: 日均数亿条, 峰值弹性扩容
- 对抗response: 新模式发现到规则上线 <4h (紧急) /<24h (常规) 
- 申诉: auto复核 <1h, 含人工 <24h
- CSAM: 零延迟 -- 检测即阻断+立即报告

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 新对抗大规模bypass | 实时样本收集, 紧急规则热更新, 临时提高严格度 |
| 模型更新致误审飙升 | 灰度发布 (1%→100%) , autorollback, A/B 验证 |
| 审核system宕机 | 降级 (高risk排队/低risk放行) , 多可用区容灾 |
| 人工审核队列过长 | dynamic优先级, 临时扩充, AI 预sort加速 |
| CSAM 漏检 | PhotoDNA+多模型冗余, 哈希库更新, 定期红队testing |

---

# 93. IT ops SRE/DevOps 域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §23

**DomainDescriptor 映射**: 

- `domain_id`: `it-operations` · `recipe_archetype`: IncidentOps
- `risk_level`: High · `latency_tier`: realtime (告警analysis <30s, auto修复 <2min) 
- `hitl_intensity`: **高** (高risk变更 CAB 审批/安全事件取证/auto修复strategy上线/预算采购) · `regulatory_density`: High (等保 2.0/ISO 27001/SOC 2/PCI-DSS/NIST) 

**核心 Agent 角色**: 事件response · 监控analysis · 部署auto化 · 容量规划 · 安全运营

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.ops.incident_respond` | 35 | 70 | 已知 Runbook autoexecute, 未知模式force人工 |
| `tool.ops.deploy` | 40 | 80 | 生产环境部署必须 CAB 审批 + 灰度验证 |
| `tool.ops.capacity_plan` | 20 | 35 | auto生成规划建议, 采购决策需manage层审批 |
| `tool.ops.security_scan` | 25 | 60 | 扫描autoexecute, 高危漏洞修复方案需安全团队confirmation |

**DomainEvalFramework**: MTTR (平均修复时间) · MTTD (平均检测时间) · SLO 达成率 · auto修复success率 · 部署failure率 · 告警噪声比 (信噪比优化) 

**HITL strategy**: 生产环境高risk变更force CAB 审批, 安全事件force安全团队介入. Runbook coverage的已知故障可auto修复, 但需事后审计. 部署rollback · 安全事件取证 · 容量采购 · 新auto修复strategy上线全部force人工. Agent 操作range严格限定于预authorization资源. 

**关键护栏**: 爆炸半径控制 (auto修复only限单节点/单服务, 跨域操作需人工) · 变更windowforceexecute · 操作审计全链路不可tamper · 安全扫描结果分级response · auto修复熔断器 (连续failureauto停止并告警) 

**Agent 工作流 (详细) **: 

- 事件response Agent: 告警接收 (Prometheus/PagerDuty) → 聚合 → 拓扑关联 → Root Cause假设 → auto修复 (Runbook) → 升级/闭环
- 监控analysis Agent: 指标/log/链路追踪持续analysis → dynamic基线 → 异常检测 → 告警降噪
- 部署auto化 Agent: CI/CD 管线 → 金丝雀发布 (渐进流量+指标监控) → rollback → 功能开关 → dependency编排
- 容量规划 Agent: 历史负载+增长预测 → 资源建模 → 扩容建议 → 预算预测 → 浪费识别
- 安全运营 Agent: IDS/IPS/WAF/漏洞扫描 → 威胁情报匹配 → autoresponse (IP 封禁/账号lock定) → 漏洞修复优先级

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 监控 | Prometheus, Grafana, Datadog, New Relic, Splunk, Zabbix |
| log | ELK, Loki, Splunk, Fluentd/Fluent Bit |
| 链路追踪 | Jaeger, Zipkin, SkyWalking, Datadog APM |
| 事件manage | PagerDuty, OpsGenie, VictorOps |
| 部署/IaC | Kubernetes, ArgoCD, Terraform, Ansible, Helm |
| 安全 | CrowdStrike, Snort/Suricata, Cloudflare WAF, Nessus/Qualys |

**data敏感度分级**: 

- 极度敏感: 生产凭证 (SSH/API Key/data库密码) , 漏洞详情, 渗透testing
- 机密: system架构拓扑, IP 段, 容量data, 事件复盘, 安全strategy
- 内部: 聚合性能指标, 部署历史, public监控仪表盘
- log: 可能含 PII (需sanitized) , 受留存/审计约束

**性能/延迟预算**: 

- 告警response: 触发到 Agent analysis <30s, auto修复 <2min
- 监控采集: 指标 15-60s 间隔, log <10s 延迟
- 部署: CI 构建+testing <15min, 金丝雀观测window可configure
- 安全检测: 实时入侵 <1s, 漏洞扫描每日/每周
- 监控system可用性: 99.99%

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| auto修复引发级联故障 | 影响rangelimit, 操作可逆, 单次only N% 实例, 熔断器 |
| 告警风暴淹没response | 聚合deduplication, 拓扑感知抑制, dynamic抑制规则 |
| 金丝雀未检测慢性missing陷 | 多维指标监控, 延长观测window, Sticky Canary |
| 监控自身故障 | independent meta-monitoring, 多path告警 (短信/电话/IM)  |
| 安全事件凭证泄露 | auto凭证rotation, Vault/KMS, 泄露即时吊销重签 |

---

# 94. 市场营销与品牌域架构

> 关联: §37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研data见 `v3.0-domain-research.md` §24

**DomainDescriptor 映射**: 

- `domain_id`: `marketing` · `recipe_archetype`: Analytics + Creative
- `risk_level`: Medium · `latency_tier`: near-realtime (舆情 <15min) + batch (Campaign 报告) 
- `hitl_intensity`: **中** (品牌传播content审批/营销预算审批/品牌危机公关接管/法律riskcontent法务审核) · `regulatory_density`: Medium (广告法/互联网广告manage办法/FTC/GDPR/CAN-SPAM) 

**核心 Agent 角色**: Campaign 编排 · 品牌监测 · SEO/SEM 优化 · 社交媒体manage · 客户分群analysis

**DomainRiskProfile 覆写**: 
| 操作 | 平台default risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.marketing.campaign` | 25 | 55 | 投放strategyauto优化, 预算超阈值需审批 |
| `tool.brand.monitor` | 15 | 30 | autoexecute舆情监测, 危机信号立即告警 |
| `tool.seo.optimize` | 20 | 35 | autoexecute关键词与content优化建议 |
| `tool.social.publish` | 30 | 70 | 所有外发content必须品牌团队审核后发布 |

**DomainEvalFramework**: ROAS (广告支出回报率) · CPA/CPL · 品牌 SOV (声量份额) · 互动率 · 危机预警准确率 · content合规via率

**HITL strategy**: 所有对外发布contentforce品牌团队审核, 品牌危机事件立即公关团队接管. 营销预算变更 · 品牌合作审批 · 法律riskcontent法务审核 · 危机公关声明全部force人工. dataanalysis · 舆情监测 · SEO 建议可autoexecute. Agent 生成contentonly作为草稿供人工优化. 

**关键护栏**: 广告法合规auto检测 (绝对化用语/虚假宣传/对比广告) · 品牌调性一致性check · 竞品data采集合规边界 · user画像data匿名化 · 危机舆情分级response预案 · 营销邮件退订合规 (CAN-SPAM/GDPR) 

**Agent 工作流 (详细) **: 

- Campaign 编排 Agent: 营销目标 → 跨渠道方案 (时间线/渠道/预算/受众) → content协调 → 效果监控 → dynamic调整
- 品牌监测 Agent: 全网品牌提及监控 (社交/新闻/论坛/短视频) → 情感analysis/话题聚类 → 危机检测 → 健康度报告
- SEO/SEM Agent: 排名+流量analysis → 关键词研究 → content优化 + 技术 SEO → SEM 竞价 → 排名监控
- 社交媒体 Agent: 多平台发布 (公众号/微博/抖音/小红书/LinkedIn) → 适配content → 发布时间 → 互动manage
- 客户分群 Agent: 多源data (CRM/行为/交易/社交) → 聚类+RFM → 高价值人群 → 定向建议

**关键工具/集成**: 
| 类别 | 具体工具 |
| ---- | ---- |
| 营销auto化 | HubSpot, Marketo, Pardot, 致趣百川, 径硕 |
| 社交媒体 | 微信公众平台, 微博, 抖音/巨量引擎, 小红书, Hootsuite |
| SEO/SEM | Google Search Console, SEMrush, Ahrefs, 百度search, 5118 |
| 舆情 | 清博大data, 新榜, Brandwatch, Meltwater |
| data | GA4, Adobe Analytics, 神策data, GrowingIO |

**data敏感度分级**: 

- PII (高) : 客户联系信息, 行为画像, CRM 交易record和偏好
- 机密: 品牌strategy, 未public上市plan, 营销预算, 竞品analysis
- 内部: content日历, A/B 方案, 聚合营销指标

**性能/延迟预算**: 

- 舆情监测: 负面检测 <15min (黄金response时间) , 常规每小时
- 社交发布: content生成 <5min/条, graph片/视频小时级
- SEO: 排名追踪每日, 技术审计每周
- Campaign 报告: 准实时 <15min 延迟
- 客户分群: batch每日, 触发式 <5min

**常见故障与恢复**: 
| 故障模式 | 恢复strategy |
| ---- | ---- |
| 舆情危机期间auto发布 | 危机检测全渠道暂停, notification公关团队, 预案response模板 |
| contentviolates广告法 | 发布前合规扫描 (绝对化/虚假声明) , 法务审核流 |
| SEO strategy致search惩罚 | 白帽 SEO 护栏, 排名异常监控, 惩罚恢复流程 |
| 归因模型失真 | 多归因模型对比, 增量testing校准 |
| 跨平台发布failure | 队列重试, 规格自适应转换, 多平台state监控 |

---

# Part V — 智能交互层 (§39-§44) 

---

# 39. 自然语言taskentry架构

> 使非技术uservia自然语言directly与平台交互, 替代手写 JSON/API call. 
> 关联: §6 API contract · §13 OAPEFLIR · §37 业务域建模 · §40 目标分解 · §44 非技术user体验

## 39.1 设计principle

- 自然语言是**一等交互方式**, 与 REST API 平权, 不是 API 之上的语法糖
- 所有 NL 交互先转化为 `TaskDraft`; 只有userconfirmation后的 `TaskSpec` 才能进入标准 `RequestEnvelope`(§5.3), 复用已有Control Plane和Execution Plane
- 歧义必须explicitly消解, 不猜测user意graph -- 宁可多问一句, 不可误execute高risk动作
- 对话上下文persistence到 Memory(§29.2), 跨会话可恢复
- Intent Parser output必须经过 schema validation, risk preview 和 policy check; 不得directly信任 LLM 生成的 TaskSpec
- high/critical 自然语言指令必须先生成 dry-run preview, userconfirmation后也仍需走 §10/§47 risk与审批

## 39.2 NL 交互管线

```text
user输入 (自然语言) 
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ TaskDraft    │
│ (意graph识别)    │     │ (域路由)     │     │ (task构建)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   有歧义时回环
    └──────┬───────┘     └──────────────┘
           │ userconfirmation
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ Confirmation │────▶│ RequestEnvelope │──▶ P1
    │ (risk预览)   │     │ Receipt      │     │ (标准contract)      │
    └──────────────┘     └──────────────┘     └──────────────┘
```

NL entry的 admission 边界: 

```text
TaskDraft + ClarificationState + RiskPreview
  → UserConfirmationReceipt
  → confirmed TaskSpec
  → RequestEnvelope
```

`TaskDraft` 和 `ClarificationState` 是 pre-admission 对象, 不得进入 P4, 也不得创建 HarnessRun. 高risk, permissions不完整, slot missing或 policy uncertain 的草稿必须停留在澄清/confirmation态. 

## 39.3 核心组件

| 组件              | 职责                                                |
| ----------------- | --------------------------------------------------- |
| IntentParser      | 解析user自然语言输入, 提取意graph标签与置信度          |
| TaskSpecBuilder   | 将已confirmation的 TaskDraft 映射为 TaskSpec(§6), 填充域, 参数与约束 |
| AmbiguityResolver | 当置信度below阈值时生成澄清问题, strategy见 §39.4        |
| ContextEnricher   | injectionuser角色, 历史对话, 域上下文等环境信息          |
| ResponseFormatter | 将execute结果转换为user友好的自然语言回复或结构化卡片  |

| pre-admission 对象 | 职责 | 进入 RequestEnvelope 条件 |
| --- | --- | --- |
| TaskDraft | 保存解析出的目标, slot, 候选域, risk预览和missing项 | 无; 只能生成 confirmed TaskSpec |
| ClarificationState | 保存追问轮次, 未决问题, user回答和置信度 | 所有 required slot resolved |
| UserConfirmationReceipt | 保存userconfirmationtext, risk预览版本, scope, time 和 actor | receipt 有效且 scope 与 TaskSpec 匹配 |

置信阈值default值: `intent_confidence_threshold=0.80`, `slot_confidence_threshold=0.85`. below阈值必须进入 Clarification Dialog; 涉及高risk动作时阈值不得被域configure放松. 

## 39.4 歧义消解strategy

| 歧义type | 示例               | 消解方式                                           |
| -------- | ------------------ | -------------------------------------------------- |
| 域歧义   | "做一份报表"       | 追问"是财务报表还是广告报表? "                     |
| range歧义 | "cleanupexpirydata"     | 追问"cleanup哪个域的data? 时间range? "                 |
| risk歧义 | "更新产品价格"     | 展示risk预览 + confirmation"这会影响线上 X 个商品"         |
| 时间歧义 | "尽快完成"         | 映射为 urgency=high, 告知预计完成时间              |
| permissions歧义 | "帮我审批这些request" | checkpermissions, 无权时提示"你没有审批permissions, 需要转发给 X" |

## 39.5 多轮对话state机

```text
         ┌─────┐
         │ Idle │◀──────────────────────────┐
         └──┬──┘                            │
            │ user输入                       │ task完成/cancel
            ▼                               │
    ┌───────────────┐                       │
    │ Intent Parsing │                      │
    └───────┬───────┘                       │
            │                               │
     ┌──────┴──────┐                        │
     │有歧义?       │                        │
     ▼ Yes         ▼ No                     │
┌──────────┐  ┌──────────┐                  │
│Clarifying│  │ Building │                  │
│(追问中)   │  │(构建task) │                  │
└────┬─────┘  └────┬─────┘                  │
     │ user回答      │                       │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │ (risk预览+confirmation)│                       │
    └───────┬───────┘                       │
            │ userconfirmation                       │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (execute中)      │     │ (结果报告)  │
    └───────────────┘     └────────────┘
```

## 39.6 安全约束

- NL entry的所有output必须via Prompt Injection 防护(§16.5)
- 高risk意graph (risk ≥ high) **必须**explicitlyconfirmation, 不allows NL directly触发
- 只有 confirmed TaskSpec 可生成 RequestEnvelope; TaskDraft, ClarificationState 和未匹配 UserConfirmationReceipt 的输入必须 fail closed
- 对话历史受data分级(§11.6)约束, confidential/restricted content不回显
- NL entry的permissions等同于call方的 API permissions, 不额外提权
- 多轮上下文进入 memory 前必须按 §29 MemoryContract 做data分级; restricted/regulated 对话default只存 session memory, 不进入 long-term/shared memory

## 39.7 多语言与国际化 (i18n) 

| 层次                 | 国际化strategy                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Intent Parser        | 多语言意graph识别: via ModelGateway(§15) call支持多语言的 LLM; 语言检测后路由到对应 locale 的 Prompt 模板 |
| Clarification Dialog | response语言跟随user输入语言 (auto-detect) , 或遵循user profile 中的 `preferred_locale` 设置                |
| Risk Preview         | risk描述, 成本预估usesuser locale 的货币/日期格式                                                       |
| NL state摘要(§43)     | 看板摘要按user locale 生成; 金额/日期/数字遵循 ICU 格式                                                 |
| error消息             | 平台标准error码映射到多语言 message catalog; fallback 语言为 en-US                                       |

---

# 40. 目标分解引擎架构

> 在 OAPEFLIR(§13) 之上增加 Goal → Task 分解层, uses户可以描述业务目标而非单个task. 
> 关联: §13 OAPEFLIR · §19 Agent 委托 · §37 业务域建模 · §39 NL entry · §41 主动 Agent

## 40.1 三层分解模型

```text
Goal (业务目标) 
  "发起 X 产品的春季营销活动"
    │
    ▼  GoalDecomposer
TaskGraph (域taskgraph)                        ← 新增层
  ├── [content-production] 制作 3 套广告素材
  ├── [advertising] configure并投放广告plan
  ├── [data-analysis] 设置 ROI 追踪看板
  └── [legal] 审核广告合规性
    │
    ▼  OAPEFLIR/Harness Planner (§13/§45)
PlanGraphBundle (executegraph)                    ← P4 唯一execute输入
  ├── tool.design.generate_creative
  ├── tool.ad_platform.create_campaign
  └── ...
```

## 40.2 GoalDecomposer interface

核心方法 `decompose(goal, constraints) → GoalGraphDraft → TaskGraphDraft`, 将高层目标拆解为可validation草稿. GoalDecomposer 不directly产出可execute PlanGraphBundle; 草稿必须交给 Harness Planner execute Normalize / Validate / Risk Propagation / Worst-Path Analysis 后, 才能形成 PlanGraphBundle. 

| 参数/特性   | 说明                                                    |
| ----------- | ------------------------------------------------------- |
| goal        | 结构化目标描述, 含目标text, 所属域与优先级              |
| constraints | 分解约束: 最大深度(default 5), 预算upper limit(§18), 截止时间     |
| return值      | GoalGraphDraft / TaskGraphDraft  --  节点为 TaskSpec draft, 边为dependency关系          |
| 环检测      | 构建 TaskGraph 时autoexecute拓扑sort, 检测到环即reject并报错 |
| 预算分配    | 按子task预估成本比例将总预算分配到各节点                |

目标分解必须传播 budget, risk, permission, data boundary 和 capability constraints; LLM 分解结果必须经过 deterministic DAG validation, capability validation, risk propagation 与 budget propagation 后才能进入 Harness Planner. 只有 Planner output的 PlanGraphBundle 是 P4 可execute输入. 

## 40.3 分解strategy

| strategy         | 适用场景                                    | 机制                                                      |
| ------------ | ------------------------------------------- | --------------------------------------------------------- |
| **模板匹配** | 目标匹配已有 DomainRecipe(§37.7) 或跨域模板 | directlyinstantiation模板, 填充参数                                  |
| **LLM 规划** | 无匹配模板的新场景                          | call ModelGateway(§15) 进行分解, 受 DomainDescriptor 约束 |
| **混合式**   | partial匹配                                    | 模板骨架 + LLM 填充missing环节                               |
| **人工辅助** | 置信度 < 0.7 或涉及 critical risk           | 生成初步分解方案, request人工审核和调整                      |

## 40.4 跨域dependencygraphmanage

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     素材制作              合规审核       投放上线          效果追踪
         │                                  │
         └──────────parallel────────────────┘
                 (素材制作和投放configure可parallel)
```

- dependencygraphauto拓扑sort, 识别可parallel的task
- **循环dependency检测**: 分解完成后对 dependency_graph 进行 DAG validation, 若检测到环路则rejectexecute并return环路path给user/GoalDecomposer 重试
- 关键path计算, 预估总工期
- 单个 Task failure时, 根据dependencytype决定: `blocks` → blocks下游, `soft_dependency` → 告警但继续
- 跨域data传递遵循 DomainInteractionPolicy(§37.8)

## 40.5 Goal 生命周期

| state                | 说明                     | 可转移至                               |
| ------------------- | ------------------------ | -------------------------------------- |
| draft               | 目标创建, 尚未分解       | decomposing, cancelled                 |
| decomposing         | 正在分解为 Task          | decomposed, failed                     |
| decomposed          | 分解完成, 等待confirmation       | executing, cancelled                   |
| executing           | Task 正在execute中          | completed, partially_completed, failed |
| completed           | 所有 Task + success标准达成 | archived                               |
| partially_completed | partial Task 完成, partialfailure | executing(retry), completed, cancelled |
| failed              | 分解或executefailure           | decomposing(retry), cancelled          |
| cancelled           | usercancel                 | archived                               |

---

# 41. 主动式 Agent 框架

> 使 Agent 能based on事件触发和定时调度主动发起task, 而非onlyresponse API call. 
> 关联: §4.2 P1 Interface Plane · §20 长时task · §37 业务域建模 · §40 目标分解

## 41.1 设计principle

- 主动式 Agent 是**受控的auto化**, 不是不受约束的自主行为
- 所有触发器必须在 DomainDescriptor(§37) 中声明, 未声明的触发器不allows注册
- 触发产生的task与 API 创建的task走**完全相同的风控管线**(§10)
- 主动行为产生的成本计入对应 domain 的预算(§18)
- 主动task不得抢占usertask保留预算; `user_task_budget_reserve >= 60%`
- medium+ 主动动作default suggestion mode, 不得directly execution

## 41.2 触发器模型

每个触发器由 `TriggerDefinition` 描述, 注册时需在 DomainDescriptor(§37) 中声明: 

| field         | type                                   | 说明                                           |
| ------------ | -------------------------------------- | ---------------------------------------------- |
| triggerId    | string                                 | globally唯一标识                                   |
| type         | schedule / event / condition / webhook | 触发方式: 定时, 事件驱动, 条件表达式, 外部回调 |
| filter       | object                                 | 事件filter条件或 cron 表达式                     |
| cooldown     | duration                               | 最小触发间隔, 防止高频duplicate触发                 |
| maxFireCount | number \| null                         | 最大触发次数, null 表示无限                    |
| boundAgentId | string                                 | 绑定的execute Agent, 触发后由该 Agent handle        |

## 41.3 触发模式

| 模式         | 行为                                   | 适用场景                                  | risk控制                                    |
| ------------ | -------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| **autoexecute** | 触发后directly创建task                     | 低risk定时task (日报生成, datasynchronous)       | require_confirmation=false + risk_level=low |
| **建议模式** | 触发后向user推送建议, userconfirmation后execute   | 中高risk事件response (CTR 下降→建议调整出价)  | require_confirmation=true                   |
| **silentlyrecord** | 触发后onlyrecord事件和analysis结果, 不主动notification | data积累 (user行为模式识别)               | action_type=update_dashboard                |

## 41.4 触发风暴防护

- **max_fire_rate**: 每个触发器有最大触发频率, 超出auto降级为silentlyrecord
- **cooldown**: 两次触发间force冷却, 防止duplicateexecute
- **batch_window**: 事件触发器可configurebatchwindow, 合并短时间内多个事件为一次触发
- **circuit_breaker**: 连续 N 次触发taskfailure后, auto禁用触发器并告警
- **globally触发预算**: 每个 domain 有每日最大auto触发次数, 防止失控
- **proactive_budget_cap**: 按 tenant/domain 设定主动task成本upper limit, 超出后只生成建议
- **ProactiveBudgetPool**: 主动taskusesindependent预算池, 不得消耗user发起task保留预算
- **UserInitiatedReserveRatio**: user发起task预算保留比例default ≥ 60%, 触发器不得突破
- **feedback loop detection**: 触发器之间若形成互相触发闭环, auto禁用相关触发器并创建 incident

## 41.5 主动建议管线

```text
触发器 fire
    │
    ▼
┌────────────────┐     ┌──────────────┐
│ Context Builder │────▶│ Suggestion   │
│ (上下文构建)    │     │ Generator    │
└────────────────┘     └──────┬───────┘
                              │
                       ┌──────▼───────┐
                       │ Suggestion   │
                       │ Queue        │──▶ user看板(§43) / 推送notification
                       └──────┬───────┘
                              │ userconfirmation
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ 标准execute管线
                       │ Creator      │
                       └──────────────┘
```

---

# 42. 渐进式自主权模型

> based on历史绩效data驱动 Agent 自主权的dynamic晋升/降级, 减少人工监督负担. 
> 关联: §10 risk控制 · §17 模型评估 · §21 人机协作 · §37.2 DomainCapability · §41 主动 Agent

## 42.1 信任积分模型

每个 Agent maintained一个 `TrustScore` record, 驱动自主权级别(§42.2)的晋升与降级: 

| field          | type                                            | 说明                                         |
| ------------- | ----------------------------------------------- | -------------------------------------------- |
| agentId       | string                                          | 关联 Agent 的唯一标识                        |
| currentScore  | number (0-1000)                                 | 当前信任积分, 由executesuccess/failure/覆写等事件累计 |
| level         | suggestion / supervised / semi_auto / full_auto | 当前自主权级别, 由积分区间映射               |
| historyWindow | duration (default 90d)                             | 计算积分所用的滑动windowlength, uses连续权重而非断崖window |
| decayRate     | number (default 0.05)                              | 无活动时的每周期衰减系数, 详见 §42.3         |

## 42.2 自主权晋升/降级规则

**default晋升阶梯**: 

| 当前级别   | 晋升至     | 条件                                                            | 审批          |
| ---------- | ---------- | --------------------------------------------------------------- | ------------- |
| suggestion | supervised | ≥ 50 次execute + success率 ≥ 95% + 0 incident(30d)                    | domain_owner  |
| supervised | semi_auto  | ≥ 200 次execute + success率 ≥ 98% + 人工覆写率 < 5% + 0 incident(60d) | domain_owner  |
| semi_auto  | full_auto  | ≥ 500 次execute + success率 ≥ 99% + 人工覆写率 < 1% + 0 incident(90d) | platform_team |

**即时降级触发器**: 

| 事件             | 降级动作            | 恢复条件                      |
| ---------------- | ------------------- | ----------------------------- |
| 引发 P0 Incident | directly降至 suggestion | 人工调查 + platform_team 审批 |
| 引发 P1 Incident | 降一级              | 30d 无 incident               |
| 连续 3 次failure    | 降一级              | 10 次连续success                 |
| 成本超预算 200%  | 降至 supervised     | 预算调整 + domain_owner confirmation  |

## 42.3 信任分衰减机制

长期无execute的 Agent 信任分应逐步衰减, 避免历史高信任 Agent 在行为环境changes后仍持有过高自主权: 

| 条件 | 衰减行为 | Description |
| --- | --- | --- |
| 连续无execute | 每日按 `decayRate` 平滑衰减, 最低不below当前级别下限 | 避免 90d 断崖式生产突变 |
| 30d 无execute | 触发提醒 + 冻结晋升 | 不auto降级 |
| 90d 无execute且risk加权样本不足 | 降一级需 platform policy allows并record原因 | 高risk Agent default先进入 supervised review |
| 180d 无execute | 自主权降至 suggestion | Agent 视为"休眠态", 需 domain_owner 重新激活 |

衰减评估由 `TrustDecayWorker` 每日运行, 变更record `agent.autonomy.decayed` 事件到 event_log(§28). domain_owner 可via DomainGovernancePolicy(§37.9) 收紧衰减参数, 但不得豁免平台级 max autonomy cap, risk-weighted trust score 或 high/critical side effect 的人工confirmation. 

## 42.4 自主权变更审计

所有自主权变更record到 event_log(§28): 

auto降级或暂停前必须生成 `AutonomyChangeImpactReport`, 说明影响的 active run, SLA, 审批队列, 预算和业务 owner. 关键业务可configure grace period 或人工confirmation; P0/P1 安全事件除外, 必须立即降级或暂停. 

## 42.5 与现有架构的集成

| 现有组件               | 集成方式                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| §10 risk控制           | trust_score 只影响 automation_mode 与复核摩擦, 不降低 inherent_risk       |
| §17 模型评估           | eval 质量退化auto触发信任降级                                             |
| §21 HITL               | 自主权决定 HITL 模式 -- suggestion 级必须人工confirmation, full_auto 级silentlyexecute     |
| §37.2 DomainCapability | `max_automation_level` 作为天花板 -- 信任再高也不能超过域设定的upper limit         |
| §41 主动 Agent         | 只有 semi_auto 以上才allowsautoexecute触发器, 否则走建议模式                   |

---

# 43. 统一运营看板架构

> 为一人公司到万人企业提供分层运营视graph, 替代面向 SRE 的基础设施级 metrics. 
> 关联: §12 异常事件 · §18 成本manage · §27 SLO · §37.9 治理 · §42 自主权

## 43.1 看板分层

```text
┌─────────────────────────────────────────┐
│  L1 操作者视graph (一人公司 / 业务负责人)     │  "一切是否正常? 什么需要我关注? "
├─────────────────────────────────────────┤
│  L2 域manage视graph (部门 Agent manage员)         │  "我的域有哪些 Agent? 绩效如何? "
├─────────────────────────────────────────┤
│  L3 平台ops视graph (平台 SRE 团队)          │  "基础设施健康? 资源利用率? "
├─────────────────────────────────────────┤
│  L4 舰队manage视graph (万人企业平台团队)        │  "哪个部门有问题? globally容量? "
└─────────────────────────────────────────┘
```

所有看板指标必须注册到 `MetricRegistry`, 声明 metric_owner, source_of_truth, freshness_slo, actionability, permission_filter 和 stale_behavior. L1/L2 的自然语言摘要必须先做 redaction, 禁止泄露隐藏知识, 跨tenant信息或审批details. 

## 43.2 L1 操作者视graph

面向非技术user的业务导向视graph: 

| 面板         | content                                       | 刷新频率 |
| ------------ | ------------------------------------------ | -------- |
| 我的taskstate | 进行中 / 已完成 / failuretask列表及进度百分比 | 实时     |
| 最近结果     | 最近 24h 已完成task的摘要与output链接        | 5min     |
| 待handle审批   | 需要当前userconfirmation的审批request, 按紧急度sort   | 实时     |
| Agent 健康   | 所属域 Agent 的可用率与当前自主权级别(§42) | 1min     |
| 预算概览     | 本月已用额度 / 剩余额度(§18)               | 1h       |

## 43.3 L2 域manage视graph

面向部门 Agent manage员的域运营视graph: 

| 面板          | content                                                  | 刷新频率 |
| ------------- | ----------------------------------------------------- | -------- |
| 域task吞吐量  | 按小时/天的task提交数与完成数趋势graph                   | 5min     |
| Agent 利用率  | 域内各 Agent 的execute占比, 排队深度, 空闲率             | 1min     |
| 域级 SLO 达成 | P50/P95 延迟, success率与 DomainDescriptor(§37) SLO 对比 | 5min     |
| Top failuretask  | 按failure次数sort的tasktype, 含Root Cause分类与关联 Incident   | 5min     |
| 成本分布      | 域预算消耗明细: 模型call / 工具call / 存储(§18)       | 1h       |

## 43.4 L3 平台ops视graph

面向 SRE 团队的基础设施ops视graph: 

| 面板            | content                                                | 刷新频率 |
| --------------- | --------------------------------------------------- | -------- |
| 五面体健康      | P1-P5 Plane(§4) 各自的存活state与组件 Ready 比例     | 10s      |
| 资源利用率      | CPU / in-memory / GPU / 队列深度的集群级热力graph           | 30s      |
| error率趋势      | 按服务维度的 4xx/5xx error率与环比changes               | 1min     |
| 延迟分布        | P50/P95/P99 延迟, 按 Interface→Execution→Model split | 1min     |
| Incident 时间线 | 活跃 Incident 列表与auto修复进度(§26)               | 实时     |

## 43.5 L4 舰队manage视graph

面向万人企业平台团队的globallyops视graph: 

| 面板         | content                                             | 刷新频率 |
| ------------ | ------------------------------------------------ | -------- |
| 跨区域state   | 各 Region 集群的可用性, synchronous延迟与故障转移就绪度 | 1min     |
| 舰队成本总览 | 全组织按域/区域/tenant的成本分布与同比趋势(§18)    | 1h       |
| tenant对比     | tenant级 QPS, success率, 资源消耗的横向对比排名       | 5min     |
| 容量预测     | based on历史趋势的 7d/30d 资源需求预测与扩容建议     | 6h       |
| 合规态势     | 审计strategycoverage率, 敏感操作审批率, 合规偏差数(§10)  | 1h       |

## 43.6 NL state摘要生成

看板支持自然语言摘要, 由 ModelGateway(§15) 生成: 

- **每日简报**: "今天 5 个 Agent 完成 23 个task (success率 96%) , 花费 ¥45. 广告域 Agent 表现优秀 (ROI 2.8x) . 有 2 个审批等待你handle, 1 个预算告警需要关注. "
- **异常简报**: "过去 1 小时, 客服域 Agent success率从 95% 降至 78%, 主要原因是知识库 API response变慢. 已auto降级到cached模式. 建议你check知识库服务state. "
- **离开回来简报**: "你离开的 8 小时内: 完成 12 个task, 花费 ¥80. 财务域有 1 个 P1 Incident (已auto恢复) . 3 个审批已timeoutautohandle. 无需立即行动. "

看板操作按钮不得directly触发高risk OperationalDirective 或 DecisionDirective. 任何会写 truth, 外发data, 提交副作用, 变更预算或影响模式的操作必须走 dashboard action risk gate, 二次confirmation和审计. 

每条 LLM 生成摘要必须携带 evidence_refs, freshness, confidence, redaction_policy 和 source_projection_version; missing少证据或 freshness expiry时只能显示“证据不足”, 不得生成确定性结论. 

---

# 44. 非技术user体验架构

> 使非开发者 (业务负责人, independent运营者) 能via可视化界面uses平台全部能力. 
> 关联: §22 SDK/DX · §38 接入 Runbook · §39 NL entry · §43 看板

## 44.1 user角色分层

| 角色         | 技术水平 | 主要交互方式                 | 看板层级 |
| ------------ | -------- | ---------------------------- | -------- |
| independent运营者   | 非技术   | NL 对话(§39) + L1 看板(§43)  | L1       |
| 业务线负责人 | 非技术   | L1 看板 + 可视化configure         | L1       |
| 域manage员     | 低代码   | 可视化configure + 偶尔 CLI        | L2       |
| Pack 开发者  | 技术     | SDK + CLI(§22)               | L2/L3    |
| 平台 SRE     | 技术     | CLI + Admin API + L3/L4 看板 | L3/L4    |

## 44.2 可视化域接入向导

替代 §38 中面向技术人员的 CLI + YAML 流程: 

```text
Step 1               Step 2               Step 3               Step 4
选择业务type          configure核心能力          设置风控规则          激活上线
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "你的业务 │        │ 拖拽选择  │        │ 风控规则  │        │ 一键激活  │
│  是哪类? "│───────▶│ 需要的能力│───────▶│ 审批规则  │───────▶│ 灰度开始  │
│ [卡片选择]│        │ [工具面板]│        │ [预设模板]│        │ [进度条]  │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| 传统方式(§38)                                       | 可视化方式(§44)             |
| --------------------------------------------------- | --------------------------- |
| `agent-platform domain init --archetype=crud_heavy` | 卡片选择"客户服务类"        |
| 手动编辑 DomainDescriptor YAML                      | 表单填写 + 智能推荐         |
| `agent-platform domain validate`                    | 实时validation + 红绿灯提示       |
| 多团队协作 5-9 周                                   | 向导引导 1-3 天 (低risk域)  |

可视化域接入向导只适used for low-risk fast-track. medium/high/critical 域只能展示只读configure, 待办门禁和证据state; UI 不得提供“risk滑块”来降低 inherent risk, risk只能由 DomainRiskSpec 和 PolicyEngine 计算. 

## 44.3 可视化 Workflow 构建器

面向非技术user的 workflow 编排界面: 

可视化构建器必须是 PlanGraph 的 projection/editor, 而不是另一套 DSL. 保存前必须via Graph Normalize / Validate / Risk Propagation / Worst-Path Analysis; 任何 UI 节点都必须能映射到 PlanGraph node, edge, ConstraintPack 或 HITL decision. 

## 44.4 智能引导式上手

```text
首次登录
    │
    ▼
┌──────────────────┐
│ "你好! 我是你的   │
│  AI 业务助手.     │
│  你想用我做什么? "│
└───────┬──────────┘
        │ user描述业务
        ▼
┌──────────────────┐
│ auto推荐          │
│ • 适合的域模板    │
│ • 需要的集成      │
│ • 预估成本        │
└───────┬──────────┘
        │ userconfirmation
        ▼
┌──────────────────┐
│ 一键configure          │
│ • 创建 Domain     │
│ • 安装基础 Pack   │
│ • 设置default风控    │
│ • 激活首个 Agent  │
└───────┬──────────┘
        │ 3 分钟后
        ▼
┌──────────────────┐
│ "你的第一个 Agent │
│  已就绪! 试着说:   │
│ '帮我...'        │
└──────────────────┘
```

## 44.5 单人模式 vs 企业模式

平台根据user数auto调整 UX 复杂度: 

| 维度     | 单人模式                                    | 企业模式            |
| -------- | ------------------------------------------- | ------------------- |
| tenant     | auto创建单tenant, 隐藏 tenant 概念            | 完整多tenantmanage      |
| 审批     | 自审批 (低/中riskautovia, 高risk弹窗confirmation)  | 完整审批流引擎(§21) |
| 安全审查 | 内置安全checkauto运行, 无需人工安全团队      | independent安全团队审查    |
| 接入流程 | 向导引导 3 分钟                             | 四阶段 Runbook(§38) |
| 看板     | L1 操作者视graph only                          | L1-L4 全层级        |
| 成本     | 个人预算视graph + 省钱建议                     | 部门级 chargeback   |
| 治理     | 简化 (自己是 domain_owner)                  | 完整组织治理        |

单人模式高risk动作仍必须 dry-run + cooldown + rollback/compensation window; 不可逆或受监管动作不得via自审批directly full_auto. 

## 44.6 无障碍访问 (WCAG 2.1 AA) 

| WCAG principle | 平台实施                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| 可感知    | 所有graph表提供 alt text / data表替代视graph; 颜色不作为唯一信息载体 (搭配形状/标签)     |
| 可操作    | 全部功能可via键盘操作 (Tab order, Enter confirmation, Esc cancel) ; NL entry支持语音输入(§68) |
| 可理解    | error消息明确指出问题和修复建议; 表单标签与输入explicitly关联                             |
| 健壮性    | 语义化 HTML; ARIA 标注关键交互控件 (看板卡片, 审批按钮, workflow 画布节点)         |

**审计与testing**: 每次前端发布前auto运行 axe-core 扫描; WCAG AA 违规视为 release blocker. 

**前端implementation要求**: WCAG 2.1 AA 合规需要实际的前端 UI implementation (React/Vue/Angular 等框架) . 平台 TypeScript 代码提供data模型, 颜色对比度令牌 (`getSeverityColorTokens()`) 和可访问性标签构建函数 (`buildAccessibleLabel()`) , 但实际 UI 组件必须在具体前端框架中implementation. §21 HITL notification组件 (`src/platform/five-plane-interface/console/hitl/notification.ts`) 提供 TypeScript 逻辑, 颜色值符合 WCAG AA 对比度要求 (≥4.5:1) , 但渲染和交互implementation由前端负责. 

---

# Part VI — Harness 工程化与八支柱深化层 (§45, §58) 

---

# 45. Harness Runtime 权威execute模型

> 将平台分散的约束, 工具, 上下文, 反馈能力收敛为统一的 Harness Runtime -- 标准化的 Agent 运行底座. 融合 Anthropic 角色化闭环, LangGraph 持久runtime, OpenAI 治理与 Guardrails 原语三大行业流派的八支柱模型. HarnessRuntime 不替代业务module; 但替代所有分散executeentry, 成为唯一executeentry, 并把既有module编排成闭环runtime. 
> 关联: §13 OAPEFLIR · §5 平面间通信contract · §10 risk控制 · §14 Execution Plane · §19.5 多 Agent 协作协议 · §21 HITL · §29 Memory/Knowledge · §37 业务域建模 · §42 渐进式自主权

## 45.1 Harness 核心公理

> **八支柱**: Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay

Harness 将一次性模型call升级为"受约束, 可execute, 可记忆, 可反馈, 可恢复, 可评测, 可介入, 可观测"的闭环system. 八支柱扩展来自三大行业流派的统一抽象: Anthropic 的 harness/eval harness (角色化闭环 + 评测runtime) , LangGraph 的 durable runtime (持久execute + 记忆分层 + HITL interrupt/resume) , OpenAI 的 agents primitives/guardrails (工具治理 + 分层护栏 + 编排) . 

| 支柱                 | 职责                                                   | 核心module                                            |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Constraints          | 统一约束 (Policy/Approval/Risk/Sandbox/Budget/Org)     | §45.3 ConstraintPack · §45.20 Guardrails            |
| Tools                | 统一工具 (Executor/Plugin/Connector/MCP)               | §45.4 ToolbeltAssembler · §45.17 Tool Harness       |
| State/Memory         | 统一state (Truth/Event/Checkpoint/Memory/Knowledge)     | §45.5 HarnessContext · §45.16 Memory Namespace      |
| Feedback             | 统一反馈 (Step/Task/Workflow/System 级)                | §45.6 FeedbackEnvelope                              |
| Durability           | 统一持久execute (checkpoint/pause/resume/replay)          | §45.11 Recovery Controller · §45.15 Durable Harness |
| Evaluation Harness   | 统一评测 (runtime裁决 + 离线评测 + 版本对比)            | §45.10 Evaluator Agent · §45.14 Evaluation Harness  |
| HITL Runtime         | 统一人机协作 (inspect/patch/override/takeover/resume)  | §21 HITL 审批 · §45.18 HITL Runtime                 |
| Observability/Replay | 统一可观测与回放 (run trace + replay + audit)          | §58.1/§58.4 · §45.19 Async Harness                  |

每次task运行都via HarnessRuntime 统一entry, 装配约束, 工具, 上下文, 驱动 Planner→Generator→Evaluator 多轮闭环, 产出最终结果与证据链. v4.2 起 HarnessRuntime 是唯一可executeruntime, HarnessRun 是唯一权威 Run; OAPEFLIR 只提供 StageRationale, TraceProjection 与 Audit View, 不创建independent运行实体. Harness 中的 `PlanBundle` 是产品层 wrapper, 内部 canonical execution contract 必须是 `PlanGraphBundle`; P4 只按 PlanGraph / NodeRun 语义executetask. 

Planner, Generator, Evaluator 在本章default表示 Runtime Role, 不要求部署为三个independent Agent. 只有在多 Agent 部署中, 它们才映射为independent Agent 实例; 无论部署形态如何, Prompt, ContextAssemblyContract, Evidence 和责任主体必须按 role 隔离. 

## 45.1.1 Single Definition Table

为避免 §13, §14, §25, §28, §45, §58 duplicate定义造成drift, 以下对象只有一个规范落点, 其他章节只能references或说明 projection: 

| 概念 | 规范落点 | 其他章节角色 |
| --- | --- | --- |
| HarnessRun / HarnessStep | §45.13 | §13/§58 只解释语义和观测 |
| PlanGraphBundle / PlanGraph | §5.3 / §13.8 | §40/§44 只产生 draft 或 projection |
| NodeRun / NodeAttempt | §14.10 / §14.15 | §25/§28 只描述statepersistence和事件 |
| SideEffectRecord | §14.11 | §57 只声明 connector action contract |
| BudgetReservation | §18.3 | §25/§58 只references预算事实 |
| Event Registry | §28 | §58 Runtime Test Matrix 只定义testingcoverage |
| HarnessDecision / DecisionInputBundle | §58.6 / §45.25 | §21/§47 只消费裁决和人工责任 |

**Harness 在五平面中的定位**: Harness 是 P3 Orchestration Plane 的统一runtime内核, via协议下沉到 P4, viastate上收于 P5, via治理受控于 P2. 

| 平面             | Harness 交互方式             | 关键协议/data                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------------- |
| P1 Interface     | 接收request信封                 | RequestEnvelope, SessionContext                                |
| P2 Control       | 消费治理指令                 | OperationalDirective, DecisionDirective, Policy, Approval, Budget, Guardrails(§45.20) |
| P3 Orchestration | **Harness 即 P3 统一编排器** | HarnessRuntime, Planner/Generator/Evaluator 闭环               |
| P4 Execution     | 下发executeplan                 | PlanGraphBundle, NodeRun, ToolCall, HITLWait, AsyncDispatch |
| P5 Evidence      | 写入运行证据                 | HarnessRun, HarnessStep, NodeRun, OapeflirTraceProjection, ContextSnapshot, Evidence |

## 45.2 HarnessRuntime 总体架构

```text
User / API / Webhook / Scheduler
        ↓
  P1 Interface Plane
        ↓
┌───────────────────────────────────────────────────────────┐
│                    Harness Runtime                         │
│                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │  Constraint   │ │  Tool        │ │  Context          │ │
│  │  Engine +     │ │  Harness +   │ │  Assembler +      │ │
│  │  Guardrails   │ │  Toolbelt    │ │  Memory Namespace │ │
│  └──────┬───────┘ └──────┬───────┘ └─────────┬─────────┘ │
│         │                │                    │           │
│         ▼                ▼                    ▼           │
│  ┌───────────────────────────────────────────────────┐   │
│  │            HarnessLoopController                  │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌───────────┐  ┌────────────────┐ │   │
│  │  │ Planner  │─>│ Generator │─>│   Evaluator    │ │   │
│  │  │ Agent    │  │ Agent     │  │ Agent + Eval   │ │   │
│  │  └────┬─────┘  └───────────┘  │ Harness        │ │   │
│  │       │                        └───────┬────────┘ │   │
│  │       │         ┌──────────┐           │          │   │
│  │       │         │ HITL     │◄──escalate┘          │   │
│  │       │         │ Runtime  │                      │   │
│  │       │         └────┬─────┘                      │   │
│  │       └── replan ◄───┴── resume ──────────────────┘   │
│  └───────────────────────────────────────────────────┘   │
│         │                    │                            │
│  ┌──────▼──────┐     ┌──────▼──────┐                     │
│  │  Durable     │     │  Recovery    │                     │
│  │  Harness     │     │  Controller  │                     │
│  └─────────────┘     └─────────────┘                     │
└───────────────────────────────────────────────────────────┘
        ↓                    ↓                 ↓
  P4 Execution        P5 State &         P2 Control
  Plane               Evidence           Plane
```

## 45.3 ConstraintPack — task级约束信封

每次task运行携带一个explicitly的约束包, 使约束从隐含逻辑变为一级输入: 

| 约束维度      | 说明                                                         | 来源                                             |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| autonomy_mode | suggestion / supervised / semi_auto / full_auto              | §42 渐进式自主权 + §37.2 DomainCapability 天花板 |
| budget        | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms | §18 成本manage + §37.9 DomainGovernancePolicy |
| tool_policy   | allowed/denied tools + network/filesystem policy             | §11 安全 + §30 Pack Manifest + DomainDescriptor  |
| risk_policy   | max_risk_level + approval_required_at                        | §10 risk控制 + §37.3 DomainRiskProfile           |
| output_policy | require_evidence / require_evaluation / require_human_review | §21 HITL + §59 可解释性                          |

ConstraintPack 在 HarnessRuntime entry由 ConstraintEngine 装配, 合并平台defaultstrategy, tenant覆写, 业务域覆写和task级覆写 (优先级递增) . 

**现有module映射**: PolicyCenterService · ApprovalService · RiskEvaluationEngine · CostAlertService

## 45.4 ToolbeltAssembler — task级工具装配

根据tasktype, 业务域, risk等级, tenantstrategy和当前上下文, 装配最小可用工具集: 

**装配流程**: 

1. 从 DomainDescriptor(§37) 获取域allows的工具列表
2. 根据 ConstraintPack.tool_policy filter
3. 根据risk等级排除高risk工具 (read_only 模式下排除所有写工具) 
4. 根据tenant预算排除超预算工具
5. 附加安全guard (输入 schema validation, output secret 扫描, 沙箱层级绑定) 
6. 附加工具reliability画像 (success率, 平均耗时, 熔断state) , 供 Planner 选择参考

**工具证据标准**: 每次工具executeauto产出输入摘要, output摘要, telemetry, artifact_ref, error_class, retryability, 纳入 Evidence Plane(§P5). 

**现有module映射**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor

## 45.5 HarnessContext — 统一runtime上下文

将分散的state/记忆/知识/工件统一为runtime上下文对象, 由 ContextAssembler 在每轮 loop 开始时装配: 

**四类上下文**: 

| 上下文               | content                                                        | 生命周期 |
| -------------------- | ----------------------------------------------------------- | -------- |
| Conversation Context | user对话, 指令, 偏好, NL 原始输入(§39)                      | 会话级   |
| Task Context         | 当前task目标, PlanGraphBundle, NodeRun state, 已完成节点的 Receipt | task级   |
| Memory Context       | 历史经验, 长期记忆, Agent 行为模式(§29)                     | persistence   |
| Knowledge Context    | 外部知识, 文档, 检索结果, DomainKnowledgeSchema(§37.4)      | 按需检索 |

**上下文预算**: 不是所有content都能塞给模型. ContextAssembler 对每轮 loop 的上下文execute: 

- Token budget 裁剪 (总 token 预算 = ConstraintPack.budget.max_cost 换算) 
- Relevance score sort (与当前step目标的相关性) 
- Freshness score sort (最近的上下文优先) 
- Trust score filter (不可信来源的知识标记 confidence) 

**上下文快照**: 每轮 loop 保存 `ContextSnapshot` 到 P5 Checkpoint, used forcrashed恢复, 回放, 差异analysis, 调试器时间旅行(§65). 

**现有module映射**: MemoryPlaneService · KnowledgePlaneService · AuthoritativeTaskStore · ArtifactStore

## 45.6 FeedbackEnvelope — 统一反馈协议

将分散的反馈信号收口为标准化信封, 建立四段反馈闭环: 

**四段闭环**: 

| 反馈层级    | 触发时机                   | 评估content                               | 产出                                |
| ----------- | -------------------------- | -------------------------------------- | ----------------------------------- |
| Step 级     | 单次工具/模型call完成后    | output质量, 耗时, 成本, 是否偏离预期     | 立即判断: continue / retry / replan |
| Task 级     | 一个 Task 所有 step 完成后 | 是否达成 Task 目标, 是否符合验收标准   | 汇总评分 + 改进建议                 |
| Workflow 级 | 多步流程全部完成后         | 是否达成业务目标, 端到端质量           | 最终评估报告                        |
| System 级   | 累积足够反馈信号后 (异步)  | 是否需要更新 prompt/policy/tool_config | LearningCandidate / ImprovementChangeSet → P2 Release |

Step 级反馈由 Evaluator Agent 实时产出; Task/Workflow 级由 Evaluator 汇总; System 级由 Learn/Improve(§13.2) 异步handle. 

**现有module映射**: FeedbackCollector · PostExecutionQualityGate · StrategyLearningService · ApprovalContextSummaryService

## 45.7 HarnessLoopController — 统一闭环控制

将循环控制逻辑从分散的多个 service 收口到单一控制器: 

**控制决策矩阵**: 

| Evaluator output | Loop 行为                 | 条件                        |
| -------------- | ------------------------- | --------------------------- |
| accept         | 推进到下一步 (或完成)     | score ≥ quality_threshold   |
| retry_same_plan | 重试当前step (同一 plan)  | retry_count < max_retries   |
| replan         | 触发 Planner 重新规划并生成 GraphPatch / 新 graphVersion | replan_count < max_replans  |
| escalate_to_human | 转人工(§21 HITL)       | risk 升高 / confidence 过低 |
| downgrade_mode | 降级运行模式              | 成本/risk接近阈值           |
| abort          | 安全终止 + record证据       | 预算耗尽 / 不可恢复error     |

**循环guard**: 

- 最大循环次数 (default 10, 由 ConstraintPack.budget.max_steps 约束) 
- 最大 replan 次数 (default 3) 
- 总耗时upper limit (由 ConstraintPack.budget.max_duration_ms 约束) 
- 总成本upper limit (由 ConstraintPack.budget.max_cost 约束) 
- 任一guard触发 → force终止 + escalate

**现有module映射**: OapeflirLoopService · RolloutStateMachine · TransitionService

## 45.8 Planner Agent — 规划职责

Planner Agent 负责理解目标, 分解task, 识别risk, 生成executeplan. 

**标准化output PlanBundle / PlanGraphBundle**: 

`PlanBundle` 是面向产品, 调试和解释层的 wrapper; `PlanGraphBundle` 是 P3→P4 的 canonical execution contract. Planner 可以先生成 GoalSpec / task_graph / success_criteria, 但进入execute前必须转换为 PlanGraphBundle, 并完成 Normalize / Validate / Risk Propagation / Worst-Path Analysis. 

| field             | 说明                                    |
| ---------------- | --------------------------------------- |
| goal             | 原始目标 + 结构化 GoalSpec              |
| task_graph       | taskdependency DAG (复用 §40 GoalDecomposer)  |
| plan_graph_bundle | 可execute PlanGraphBundle (P4 唯一execute输入)  |
| execution_budget | step/时间/成本预算分配                  |
| risk_profile     | risk评估快照 (复用 §10 RiskAssessment)  |
| success_criteria | 可量化的验收标准列表                    |
| evaluator_hints  | 给 Evaluator 的评估提示 (关注哪些指标)  |

**Prompt 分离**: Planner uses专用 Planner Prompt (从 DomainPromptLibrary §37.6 获取) , 不与 Generator/Evaluator 共用模板. 

**现有可复用module**: IntakeRouter · AssessmentService · PlanGraphBuilder · GraphNormalizer · GoalDecomposer · PolicyCenterService

## 45.9 Generator Agent — execute职责

Generator Agent 负责call工具, executestep, 写回证据, 生成阶段性结果. 

**标准化output WorkProduct**: 

| field           | 说明                                         |
| -------------- | -------------------------------------------- |
| harnessStepId  | 当前execute语义step ID (与 §45.13 一致)          |
| artifacts      | 产出的工件references列表                           |
| observations   | execute过程中的观察record                         |
| result_summary | 结果摘要 (供 Evaluator 评估)                 |
| telemetry      | step级遥测 (耗时, token 消耗, 工具call次数)  |

**关键行为约束**: 

- 遇到blocks (工具不可用, permissions不足, 外部timeout) 时request帮助 (触发 escalate) , 不硬闯
- 所有工具callvia Toolbelt filter, 不可directlycall未装配的工具
- 每步execute完auto产出证据 (输入/output/side_effect) , 写入 P5

**现有可复用module**: ExecutionDispatchService · MultiStepSupervisor · ToolExecutor · PluginExecutor · UnifiedChatProvider

## 45.10 Evaluator Agent — 评估职责

Evaluator Agent 负责判断结果质量, check目标偏离, 决定下一步行动. 

**标准化output EvaluationReport**: 

| field           | 说明                                       |
| -------------- | ------------------------------------------ |
| passed         | 是否via                                   |
| score          | 质量评分 0-100                             |
| issues         | 发现的问题列表 (type + 严重程度 + 位置)    |
| recommendation | accept / retry / replan / escalate / abort |
| confidence     | 评估置信度 0.0-1.0                         |

**评估维度**: 

- **目标偏离**: 当前结果与 PlanBundle.success_criteria / PlanGraph terminal criteria 的距离
- **质量门禁**: 复用 §17 模型评估 + DomainEvalFramework(§37.5)
- **riskchanges**: execute后risk是否升高 (对比 PlanGraphBundle.riskProfile 与 GraphRiskPropagationReport) 
- **成本合理性**: 实际 token/时间消耗是否在预算range内

**Prompt 分离**: Evaluator uses专用 Evaluator Prompt, 不与 Planner/Generator 共用. 

**现有可复用module**: FeedbackCollector · StrategyLearningService · PostExecutionQualityGate · ApprovalContextSummaryService · SloAlertingService

## 45.11 Recovery Controller

当 Harness 运行过程中发生故障 (worker crashed, 外部timeout, 模型不可用) , Recovery Controller based on ContextSnapshot(§45.5) execute恢复: 

| 故障type            | 恢复strategy                                                    |
| ------------------- | ----------------------------------------------------------- |
| Worker crashed         | 从最近 ContextSnapshot 恢复, 重新申请 lease, 从断点继续     |
| LLM Provider 不可用 | 触发 ModelGateway(§15) fallback chain, 切换 provider 后继续 |
| 工具timeout            | 由 LoopController 决定 retry (同工具) 或 replan (替换工具)  |
| 预算耗尽            | 安全终止 + 保存当前state + notificationuser                          |
| PlatformPanic(§60)  | 立即序列化完整state到 checkpoint, 等待平台恢复subsequent接         |

复用现有 Recovery Workers (LeaseReclaimer · StuckRunSweeper) 和 Checkpoint 机制(§14). 

## 45.12 与现有架构的集成

| 现有组件            | Harness 集成方式                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------- |
| §5 平面间contract       | HarnessRuntime 作为 P3 Orchestration 的统一entry, 接收 RequestEnvelope, output PlanGraphBundle |
| §10 risk控制        | ConstraintPack.risk_policy 由 RiskAssessmentEngine 装配                                   |
| §13 OAPEFLIR        | Planner/Generator/Evaluator/Loop 是 OAPEFLIR 八阶段的外部简化映射(§13.5)                  |
| §14 Execution Plane | Generator Agent via标准 PlanGraphBundle → Graph Scheduler → NodeRun → NodeAttemptReceipt pathexecute |
| §21 HITL            | LoopController 的 escalate pathdirectlycall HITL 审批流                                       |
| §37 业务域建模      | DomainDescriptor 驱动 ConstraintPack/Toolbelt/Context 的域级configure                          |
| §42 渐进式自主权    | ConstraintPack.autonomy_mode 由 AgentTrustProfile 决定                                    |
| §59 可解释性        | 每轮 loop 的 PlanBundle/PlanGraphBundle/WorkProduct/EvaluationReport auto纳入解释管线      |
| §65 调试器          | ContextSnapshot 序列支撑时间旅行调试                                                      |

## 45.13 HarnessRun / HarnessStep — 统一运行contract

> 将运行实体和step实体定义为一级contract. 

**HarnessRun** 代表一次完整的 Harness task运行: 

| field             | 说明                                                      |
| ---------------- | --------------------------------------------------------- |
| runId            | globally唯一 run 标识                                         |
| tenantId         | tenant                                                      |
| goal             | 原始目标 + 结构化 GoalSpec                                |
| mode             | sync / async (§45.19)                                     |
| riskLevel        | runtimerisk等级 (由 ConstraintPack 决定)                   |
| budget           | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms |
| constraintPack   | 本次 run 的约束快照 (§45.3)                               |
| plannerOutput    | PlanBundle / PlanGraphBundle (§45.8)                      |
| steps            | HarnessStep 序列                                          |
| currentIteration | 当前 loop 轮次                                            |
| maxIterations    | 由 ConstraintPack 约束                                    |
| finalDecision    | 见 §58.6 HarnessDecision: 基础六种裁决 + 四种扩展裁决     |
| status           | pending / running / paused / completed / failed / aborted |
| traceId          | 分布式 trace 关联                                         |
| ownership        | 归属 agent / tenant / domain                              |
| auditRefs        | 审计证据references列表                                          |

**HarnessStep** 代表一个executestep: 

| field         | 说明                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| harnessStepId | 语义step标识; 不得作为 P4 execute或回执主键                                 |
| nodeRunRefs  | 关联的一个或多个 NodeRun; execute事实以 NodeRun 为准                         |
| phase        | plan / execute / evaluate / hitl / decision                               |
| role         | planner / generator / evaluator / hitl_operator / loop_controller         |
| inputs       | step输入 (上下文快照references)                                                 |
| outputs      | stepoutput (PlanBundle / PlanGraphBundle / GraphPatch / WorkProduct / EvaluationReport / HarnessDecision)  |
| rationale    | 决策理由 (纳入 §59 可解释性)                                              |
| evidenceRefs | P5 证据references                                                               |
| toolCalls    | 工具callrecord列表                                                          |
| latency      | step耗时                                                                  |
| cost         | token/API 成本                                                            |
| error        | error信息 (如有)                                                           |
| nextAction   | 下一动作 (由 HarnessDecision 决定)                                        |

**HarnessDecision** 采用 §58.6 的统一裁决协议: 基础六种裁决 `accept / retry_same_plan / replan / escalate_to_human / downgrade_mode / abort`, 并allows生产扩展裁决 `quarantine / revoke_approval / pause_for_external / require_revalidation`. 

MVP Harness slice 只要求: ConstraintPack, minimal Toolbelt, minimal ContextSnapshot, PlanGraphBundle, NodeRun, basic Evaluator, HITL approval, Trace Replay. 完整 Memory Namespace, Learning pipeline, IDE Debugger 和高级 Evaluation Harness 后置到 Hardening/Enterprise. 

**现有module映射**: AuthoritativeTaskStore · NodeAttemptReceipt · OapeflirViewProjectionService · AuditService. 旧 ExecutionReceipt / OapeflirLoopService only迁移期 adapter uses. 

## 45.14 Evaluation Harness — 统一评测runtime

> §45.10 Evaluator Agent 负责runtime裁决. 本节补齐**离线评测, 预发布评测, 版本对比**三类评测能力, 构成完整的 Evaluation Harness. 
> 行业参考: Anthropic "最终 outcome 比 transcript 更重要"; evaluation harness 应在受控环境中运行task, 观察环境state, 聚合结果. 

**三类评测模式**: 

| 评测模式     | 触发时机                                      | 评测content                                               | 产出                         |
| ------------ | --------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| runtime评测   | 每步 / 每task完成后                           | Evaluator Agent 实时裁决 (§45.10)                      | EvaluationReport             |
| 预发布评测   | 新 Prompt/Planner/Evaluator/ToolBundle 上线前 | 在隔离沙箱中运行标准task集                             | via率 / 回归对比 / 质量分布 |
| 版本对比评测 | 定期 / 灰度期间                               | 对比新旧版本的success率/迭代轮数/成本/failure模式/升级人工率 | 对比报告 + 灰度决策建议      |

**评测重点 -- outcome 而非 transcript**: 

- task是否真正完成 (环境state是否到达目标态) 
- 是否violates治理与合规
- 是否比旧版本更稳定
- 端到端成本与效率

**评测runtime组件**: 

- EvalRunService: manage评测task的创建, 调度, 隔离execute
- TaskOutcomeGrader: based on success_criteria 和环境stateassertion评分
- EnvironmentStateAssertionService: 在受控环境中验证最终state
- AgentTrajectoryRecorder: record完整execute轨迹供回放analysis
- EvalAggregationService: 聚合多task评测结果, 生成统计报告

**现有module映射**: PostExecutionQualityGate · §17 模型评估 · DomainEvalFramework(§37.5)

## 45.15 Durable Harness — 持久execute支柱

> §45.11 Recovery Controller handle故障恢复. 本节将持久execute从恢复strategy升级为一级支柱 -- checkpoint/pause/resume 是 Harness 的基础能力, 不是附加能力. 
> 行业参考: LangGraph "durable execution = 流程在关键点保存进度, 之后可以暂停并从原位置恢复". 

**暂停原因注册表**: 

| pauseReason                  | 说明                   | 典型场景                       |
| ---------------------------- | ---------------------- | ------------------------------ |
| waiting_for_human            | 等待人工审批/介入      | HITL Runtime(§45.18) escalate  |
| waiting_for_external_event   | 等待外部system回调       | Webhook / 第三方审批 / CI 结果 |
| waiting_for_budget_reset     | 预算耗尽, 等待下一周期 | Token/成本预算触顶             |
| waiting_for_policy_clearance | 等待strategy审核via       | 高risk动作需 P2 审批           |
| waiting_for_dependency       | 等待上游task/data就绪  | DAG dependency未满足                 |

**恢复strategy**: 

| resumeStrategy     | 说明                         | 适用场景                   |
| ------------------ | ---------------------------- | -------------------------- |
| resume_same_state  | 从精确断点恢复, state不变     | 人工审批via, 外部回调到达 |
| resume_with_replan | 恢复时触发 Planner 重新规划  | 上下文已changes, strategy已更新   |
| resume_supervised  | 恢复后进入 supervised 模式   | 高risk恢复, 信任降级       |
| abort_on_resume    | 恢复时判断不可继续, 安全终止 | timeout过久, 环境已不可逆     |

**关键机制**: 

- 每轮 loop 的 ContextSnapshot(§45.5) 是 Durable Harness 的persistence基础
- §20 长时task休眠机制作为 Durable Harness 的底层implementation
- pause 时序列化完整 HarnessRun state到 P5 Checkpoint
- resume 时由 ResumeStrategyService 根据 pauseReason + 当前环境选择strategy

**现有module映射**: HibernationService · RecoveryWorker · LeaseReclaimer · StuckRunSweeper · CheckpointService

## 45.16 Memory Namespace 与strategy

> §45.5 HarnessContext 将记忆作为上下文type. 本节补齐三层记忆naming空间和晋升strategy. 
> 行业参考: LangGraph 明确distinguish thread-scoped 短期记忆和跨线程长期记忆; OpenAI 把 state/memory 作为核心原语. 

**三层记忆naming空间**: 

| 层次                    | 作用域                    | content                                                                                     | 生命周期                         |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| Working Memory          | 当前 run / 当前 iteration | 当前目标摘要, plan摘要, 问题清单, 预算余量, risk与模式, 已选工具, 最近failure原因, 关键证据 | run 结束后归档                   |
| Long-term Memory        | 跨 run / 跨 project       | 历史经验, Agent 行为模式, tasksuccess/failure模式, 常用工具组合                                | persistence, 按 retention policy expiry |
| Shared Knowledge Memory | 可提升为通用经验的知识层  | 跨 agent / 跨 domain 的最佳实践, 常见failure的恢复方案, 评估规则建议                        | 需人工审核后晋升                 |

**记忆晋升strategy**: 

- Working → Long-term: run 结束后, Evaluator 标记为"有价值"的 observation auto候选晋升, 经 MemoryPromotionPolicy 审核
- Long-term → Shared Knowledge: 累积 N 次跨 agent 验证后候选晋升, 需人工审核
- 反向降级: Long-term 中连续 M 次无references的条目auto标记为 stale, 超期cleanup
- 防自augmentation: Evaluator 不能单独把自己刚产生的判断directly晋升为 Long-term Memory; 必须经过 holdout task, 不同模型/不同 judge 或人工审核之一. 被标记 contested, 低置信, 来自failure run 或来自未验证工具output的记忆只能进入 quarantine, 不得影响subsequent Evaluator. 

**ContextSnapshot retention / compaction**: 

- 每轮 loop 必须写 checkpoint, 但长期保留按 tier 分层: 最近 N 次完整快照, 关键决策快照, 终态快照, 其余压缩为摘要 + hash + artifact refs
- retention 到期后execute compaction, 不删除 legal hold, audit evidence, HITL responsibility record 和 side effect evidence
- ContextEvictionPolicy fixed优先级: policy/approval/budget/risk > current truth > confirmed user spec > recent evidence > memory > knowledge retrieval > generated summary

**naming空间隔离**: 

- tenant隔离: 不同 tenant 的 Long-term Memory 物理隔离
- 域隔离: 同一 tenant 内不同 domain 的 Working Memory 逻辑隔离
- 跨域shared: 需经过 §50 知识域隔离与受控shared 的访问控制

**现有module映射**: MemoryPlaneService · KnowledgePlaneService · §29 Memory/Knowledge 边界 · §50 知识域隔离

## 45.17 Tool Harness — 工具治理

> §45.4 ToolbeltAssembler 负责按task装配工具子集. 本节将工具从"能调就行"升级为"被治理的一级资源". 
> 行业参考: OpenAI/Anthropic 都指出工具的 schema, 适用边界, 可信度, call成本和failure语义都应被治理. 

**工具能力画像 (Tool Capability Profile) **: 
每个注册工具必须附带: 

| 画像field            | 说明                                                         |
| ------------------- | ------------------------------------------------------------ |
| toolId              | globally唯一标识                                                 |
| capabilityType      | read / write / compute / network / filesystem / browser / db |
| riskLevel           | low / medium / high / critical                               |
| expectedLatency     | P50/P99 预期耗时                                             |
| expectedCost        | 每次call的 token/API 成本估算                                |
| reliabilityScore    | 历史success率 (dynamic更新)                                        |
| requiredPermissions | 所需permissions列表                                                 |
| allowedDataClasses  | allowshandle的data分类 (PII/confidential/public)                 |
| allowedTenants      | tenant白名单 (空=全部)                                         |
| allowedDomains      | 域白名单 (空=全部)                                           |
| outputTrustLevel    | output可信度等级 (verified / unverified / untrusted)           |

**工具call治理record**: 
每次工具callautorecord: 

- 选择理由 (由 Planner/Generator 的哪个推理step选择) 
- call结果 (success/partialsuccess/failure) 
- output是否可信
- 是否进入 Long-term Memory
- 是否触发 fallback
- 是否触发 Guardrails(§45.20)

**工具生命周期**: registered → active → deprecated → retired, 与 §30 Pack 生命周期对齐. 

**现有module映射**: ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor · §30 Pack Manifest

**工具选择治理** (Tool Selection Governance) : 

工具call并非自由选择, 而是受治理约束的三阶段流程: 

| 阶段     | 对象                   | 说明                                                    |
| -------- | ---------------------- | ------------------------------------------------------- |
| 候选筛选 | ToolSelectionCandidate | ConstraintPack + domain + risk-tier filter后的可用工具集  |
| 选择决策 | ToolSelectionDecision  | record Planner/Generator 选择此工具的推理basis与备选项     |
| fallbackstrategy | ToolFallbackPolicy     | 工具callfailure时的 fallback 链 (降级工具 → 人工 → abort)  |

四条硬规则: 

1. Planner 只能从 ToolSelectionCandidate 集合中选择工具, 不得跳出约束边界
2. Generator 不得bypass Planner 的选择结果directlycall未选工具
3. Evaluator 事后评估工具选择合理性, 不合理时可要求 Planner 重选
4. risk-tier ≥ high 的工具必须configure ToolFallbackPolicy, 否则 ConstraintPack validation不via

## 45.18 HITL Runtime — 人机协作runtime

> §21 定义 HITL 审批模式, §45.7 LoopController 提供 escalate path. 本节将 HITL 从审批流升级为 Harness 原生runtime -- 人类不是只在流程边审批, 而是能在运行中看state, 改state, 继续execute. 
> 行业参考: LangGraph "checkpointer 让人类可以在运行中check, 打断, 批准, 修改state后恢复"; OpenAI "guardrails 与 human review 共同决定 run 何时继续, 暂停或停止". 

**五类 HITL 能力**: 

| 能力     | 说明                                                                   | 触发方式                       |
| -------- | ---------------------------------------------------------------------- | ------------------------------ |
| Inspect  | 查看当前 run state, plan, context, evaluator findings                   | 主动查看 / 看板(§43) entry      |
| Patch    | 修改 planner output / working context / constraints / success criteria | 人工在 HITL 界面修改后写回     |
| Override | coverage evaluator recommendation / mode / budget / selected tools         | 人工coverage裁决                   |
| Takeover | directly人工接管execute, Generator 暂停                                       | 高risk / 信任不足 / 紧急场景   |
| Resume   | 人工handle后恢复auto运行 (关联 §45.15 resumeStrategy)                    | Patch/Override/Takeover 后触发 |

**HITL 与 Durable Harness 的关系**: 

- HITL 触发 → Durable Harness pause (pauseReason = waiting_for_human) 
- 人工完成 → Durable Harness resume (resumeStrategy 由人工选择或auto推荐) 
- 所有 HITL 操作写入审计log (§12 审计 + §59 可解释性) 

**HITL timeoutstrategy**: 

- default等待时长由 §21 HITL 模式configure
- timeout后按 ConstraintPack 的 escalation_policy 升级到更高审批层级或 abort

**现有module映射**: ApprovalService · TakeoverController · §21 HITL 模式 · §47 审批路由

**HITL state机**: 

```text
                      ┌──────────────────────────────────────────┐
                      │                                          │
  ┌─────────┐  HITL触发  ┌──────────────────┐                   │
  │ Running │──────────→│ Paused_for_Human │                    │
  └─────────┘           └────────┬─────────┘                    │
                                 │                               │
              ┌──────────┬───────┼────────┬──────────┐          │
              ↓          ↓       ↓        ↓          ↓          │
         Inspecting  Patched  Overridden  Manual   Timeout      │
              │          │       │      Takeover     │          │
              │          │       │        │          │          │
              └──────────┴───────┴────────┘          │          │
                         │                           ↓          │
                    resume/approve              Escalate/Abort  │
                         │                           │          │
                         ↓                           ↓          │
                    ┌─────────┐              ┌───────────┐      │
                    │ Resumed │              │  Aborted  │      │
                    └────┬────┘              └───────────┘      │
                         │                                      │
                         └──────────────────────────────────────┘
                                  回到 Running
```

**state转换规则**: 

| 操作     | 前置state                           | 后置state                      | 影响range                            |
| -------- | ---------------------------------- | ----------------------------- | ----------------------------------- |
| Inspect  | Paused_for_Human                   | Inspecting → Paused_for_Human | 只读, 不改变 run state               |
| Patch    | Paused_for_Human                   | Patched → 等待 resume         | 修改 context/variables, 不改变 plan |
| Override | Paused_for_Human                   | Overridden → 等待 resume      | 替换当前 plan 或 step 结果          |
| Takeover | Paused_for_Human                   | Manual_Takeover → 等待 resume | 人工全权接管, agent 暂停推理        |
| Resume   | Patched/Overridden/Manual_Takeover | Resumed → Running             | 恢复autoexecute, 携带人工修改          |
| Abort    | arbitrary Paused 子state                 | Aborted                       | 终止 run, record终止原因              |

## 45.19 Async Harness — 异步运行模式

> 补齐异步运行模式, 适配企业多小时/多轮/多审批的异步工作场景. 
> 行业参考: Anthropic "预构建, 可configure, 运行在托管基础设施中的 agent harness, 适合长时task和异步工作". 

**两种运行模式**: 

| 模式          | 适用场景                                                           | 交互方式                                   |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Sync Harness  | 秒级task, 会话内response, 简单工具链                                   | request-response, blocks等待结果                    |
| Async Harness | 多小时task, 多轮协作, 多次审批, 长时analysis, auto化流水线, batchtask群 | 创建 run → 轮询/订阅 → 中途介入 → 最终结果 |

**Async Harness 能力**: 

- create_run: 创建异步 HarnessRun, return runId
- poll_status: 按 runId query当前state和进度
- subscribe_events: via Webhook/SSE 订阅 run 事件流
- inspect_step: 查看arbitrarystep的详细信息
- intervene_mid_run: 中途触发 HITL Runtime(§45.18) 的arbitrary操作
- replay_after_completion: 完成后回放analysis (§58.4) 

**Async 与 Durable 的关系**: Async Harness dependency Durable Harness(§45.15) 的 checkpoint/pause/resume 机制. 每个 Async run 天然支持中断和恢复. 

**现有module映射**: §20 长时task · WebhookDeliveryService · §43 看板 · EventBus

## 45.20 Guardrails 分层架构

> §45.3 ConstraintPack 将约束收口为task级信封. 本节在 ConstraintPack 之上建立五层 Guardrails, 使护栏贯穿 Harness 全流程. 
> 行业参考: OpenAI "guardrails 不应该只在entry做统一risk评估, 而应分层进入全流程". 

**五层 Guardrails**: 

| 层次                | check时机            | checkcontent                                                             | 拦截动作               |
| ------------------- | ------------------- | -------------------------------------------------------------------- | ---------------------- |
| Input Guardrails    | request进入 Harness 前 | prompt injection · 敏感request分类 · 不支持的目标检测 · 输入格式validation    | reject / 改写 / 降级     |
| Planning Guardrails | Planner output后      | 禁止的 plan 模式 · 越权委托 · 过宽工具range · unsafe的目标分解        | 要求 replan / escalate |
| Tool Guardrails     | 工具call前后        | 不可信工具output · unsafe API 目标 · 过宽file/DB 访问 · 高risk动作升级 | 拦截 / 降权 / 要求confirmation |
| Memory Guardrails   | 记忆读写时          | 禁止留存content · unsafe的 Long-term 晋升 · 跨tenantleaks · 边界violates       | reject写入 / sanitized        |
| Output Guardrails   | 结果return前          | strategy违规 · unsafeexecute建议 · 受管制content · 过高置信度无basis声明        | filter / 改写 / 标注     |

**Guardrails 与 ConstraintPack 的关系**: ConstraintPack 定义"约束是什么", Guardrails 定义"约束在哪里execute, 怎么拦截". 两者互补: ConstraintPack 是static约束信封, Guardrails 是dynamicexecutecheck点. 

Guardrail conflict采用最严胜出: `abort > deny > escalate > replan > filter > allow`. 每个 run 必须maintained `guardrail_action_count`, `last_guardrail_signature` 和 `guardrail_cooldown_until`; 同一signature连续触发超过upper limit即判定为 guardrail vibration, 必须 abort 或 escalate_to_human, 不得继续 replan 消耗预算. 

**现有module映射**: §10 risk控制 · §11 安全 · §16.5 Prompt injection防御 · §23 合规 · §68 多模态安全

## 45.21 Harness 十条不变量

> 企业级 Harness 运行的底线规则. 任何implementation和configure都不可bypass. 

1. 任何复杂task必须先有 PlannerOutput, 禁止无plandirectlyexecute
2. 任何 GeneratorOutput 必须对应 EvaluatorReport, 禁止skip评估
3. 任何 retry / replan / escalate / abort 必须record HarnessDecision 及原因
4. 任何长task (duration > 60s 或 steps > 3) 必须有 iteration checkpoint
5. 任何工具output进入 Long-term Memory 前必须经过 trust/promotion 规则 (§45.16/§45.17) 
6. 任何人工 override 必须写入审计log, 关联 traceId 和 operator identity
7. 任何多 agent run 必须明确 planner/generator/evaluator/controller 责任主体
8. 任何 async run 必须支持statequery (poll_status) 与中途介入 (intervene_mid_run) 
9. 任何高risk run (risk_level ≥ high) 必须支持 downgrade_mode 或 HITL escalate
10. 任何 harness run 必须可 trace (§58.1) , 可 replay (§58.4) , 可 audit (§12) 

## 45.22 OAPEFLIR-Harness 收敛contract

Harness 是唯一可executeruntime; OAPEFLIR 是运行语义, 治理阶段和解释投影. 两者的收敛关系: 

| Harness 对象 | OAPEFLIR v4.2 投影 / contract | Description |
| --- | --- | --- |
| HarnessRun | OapeflirTraceProjection | OAPEFLIR 阶段视graph由 HarnessRun / HarnessStep / NodeRun 事件派生 |
| HarnessStep / NodeRun | Execute 阶段投影 | step与节点是权威execute实体, OAPEFLIR 只解释其阶段语义 |
| PlanBundle / PlanGraphBundle | Plan 阶段output视graph | Planner output必须graph化, validation, risk传播, PlanGraph 属于 `HarnessRun.plannerOutput` |
| HarnessDecision | DecisionInputBundle + Decision Engine | 裁决前冻结输入, 裁决后事件化 |
| ContextSnapshot | ContextAssemblyContract output | 每轮上下文装配可回放 |
| Evaluation Harness | EvaluationGate | runtime评估与发布前门禁统一 |
| HITL Runtime | HumanResponsibilityRecord | 人工批准 scope 与责任边界explicitlyrecord |

Harness Runtime 不得bypass PlanGraph, Event Registry, Budget Ledger, SideEffect Manager 和 EvaluationGate; OAPEFLIR 投影也不得反向驱动 HarnessRun state迁移. 

## 45.23 Context Assembly Contract

Planner, Generator, Evaluator 必须usesindependent ContextAssemblyContract, 避免角色间上下文pollute. 

| field | Description |
| --- | --- |
| role | planner / generator / evaluator |
| inputRefs | Request, Observation, Assessment, PlanGraph, NodeRun, Artifact, Memory references |
| taintPolicy | 工具output, user输入, 外部知识的 taint 传播规则 |
| budget | token / latency / retrieval 次数预算 |
| rankingPolicy | relevance / freshness / trust / recency sort |
| redactionPolicy | secret / PII / regulated data sanitized规则 |
| outputSnapshotRef | 冻结后的上下文快照 |

Context 装配必须output可审计快照; LLM call只消费 snapshot, 不directly读arbitrary运行态对象. 

ContextAssemblyContract 必须声明输入源优先级, token budget, eviction / truncation report, taint propagation, PII/secret redaction 和 loss impact. default输入优先级: policy / approval / budget / risk > current NodeRun truth > user confirmed TaskSpec > recent evidence > memory > knowledge retrieval > model-generated summary. 

## 45.24 Prompt Execution Contract

Prompt execute前必须冻结以下信息: 

- promptId, promptVersion, role, model policy, output schema
- contextSnapshotRef, toolOutputTaint, memoryReadRefs
- budgetReservationRef, traceId, runVersionLockRef
- trace replay 所需的 recorded output refs, scheduler decision refs, 或 re-execution replay 的不可确定性声明

Planner / Generator / Evaluator Prompt 必须independent版本化, independent rollout, independent评测. LLM output必须经过 schema validation, guardrail, taint propagation 和 Evaluation 约束后才能进入下一阶段. 

每次 Prompt call必须生成 `PromptExecutionRecord`: 

| field | Description |
| --- | --- |
| promptVersion | PromptBundle / role prompt 的冻结版本 |
| modelRoute | ModelGateway 路由, provider, model 和 fallback path |
| inputHash / outputHash | 输入output哈希, 支撑 Trace Replay 与tamper检测 |
| contextSnapshotRef | 本次call消费的上下文快照 |
| guardrailResult | 输入, output和工具护栏结果 |
| usage | token, latency, cost, currency 和 BudgetReservation references |

## 45.25 DecisionInputBundle

Decision Engine 裁决前必须冻结 DecisionInputBundle: 

| 输入 | 来源 |
| --- | --- |
| evaluatorReport | Evaluator Agent / Evaluation Harness |
| policyOutcome | P2 Policy Center |
| budgetState | Budget Ledger |
| riskState | Assess + Graph Risk Propagation |
| nodeState | NodeRun truth |
| sideEffectState | SideEffect / Reconciliation |
| hitlState | HITL Runtime |
| guardrailFindings | 五层 Guardrails |

DecisionInputBundle 是 HITL / Evaluator / Audit 的统一 evidence artifact, 必须在 §6 API, §26 表落点和 §58 Trace Replay 中可references. 

裁决优先级: deterministic failure / policy deny / budget exhausted / critical guardrail block 优先于 LLM evaluator accept. LLM-as-Judge 不能coverage确定性failure. 

Guardrail conflict优先级fixed为: `abort > deny > escalate > replan > filter > allow`. 每个 run 必须设置 `guardrail_action_count` upper limit; 超过upper limit说明循环无法收敛, 必须 abort 或 escalate_to_human. 

## 45.26 Memory Write Governance

Memory 写入不是 Generator 的自由副作用. 任何写入 Long-term Memory 或 Shared Knowledge 的request必须形成 `MemoryWriteRequest`, contains source, confidence, taint, data class, TTL, promotion target 和 reviewer policy. 禁止 secret, 未sanitized PII, holdout eval data, 低置信工具outputdirectly进入长期记忆. 

## 45.27 HITL Responsibility Record

每次人工 approve, reject, patch, override, takeover, resume 都必须生成 HumanResponsibilityRecord: 

| field | Description |
| --- | --- |
| actor | 人工主体与组织归属 |
| action | approve / reject / patch / override / takeover / resume |
| scope | 本次批准或coverage影响的 run / node / sideEffect / budget / policy range |
| rationale | 人工决策理由 |
| beforeRef / afterRef | 变更前后快照 |
| expiresAt | authorization有效期 |
| auditRef | 审计record |

HITL approve 只批准声明的 scope, 不得隐式扩大到subsequent node, child run 或不可逆副作用. 

---

# 58. Harness 横切关注面

> Harness Runtime(§45) 引入后产生的横切工程化需求 -- Harness 级可观测性, Prompt 分层治理, Failure-to-Learning 管线, Replay/Simulation, 架构remaining问题收口, 以及统一裁决协议. 
> 关联: §45 Harness Runtime · §12 异常事件 · §16 Prompt manage · §27 SLO · §65 调试器

## 58.1 Harness 级可观测性

现有可观测性(§9.7, §12, §27)面向基础设施和平面粒度. Harness 需要**按 run 粒度**观测全链路: 

| 指标                              | 说明                              | SLO                                         |
| --------------------------------- | --------------------------------- | ------------------------------------------- |
| harness.run.duration              | 单次 HarnessRun 端到端耗时        | default P99 < 60s, 或uses DomainDescriptor.sloProfile 覆写 |
| harness.loop.count                | 单次 run 的 loop 次数             | mean < 3, max ≤ ConstraintPack.max_steps    |
| harness.replan.count              | 重规划次数                        | mean < 1                                    |
| harness.evaluator.score           | Evaluator 评分分布                | P50 ≥ 80                                    |
| harness.constraint.rejection_rate | ConstraintPack 拦截率             | < 5% (过高说明约束过严或task描述不清)       |
| harness.context.token_utilization | 上下文 token 预算利用率           | 60%-90% (过低浪费, 过高可能truncated关键上下文)  |
| harness.tool.reliability          | Toolbelt 中各工具的实时reliability画像 | success率 ≥ 95%                                |

所有指标via Harness Telemetry Middleware auto采集, 写入 P5 Evidence Plane, 供 §43 看板和 §65 调试器消费. 

若 DomainDescriptor 未定义 SLO, defaultuses §27 deployment-tier SLO fallback; 不得把“业务域未定义”解释为无 SLO 或 best effort. Harness 指标必须recorduses的 slo_source = domain_override / platform_tier_default / emergency_override. 

## 58.2 Prompt 分层治理

Harness 三类 Agent 各需independent Prompt strategy, 不可混用: 

| Prompt type      | 职责                                   | 治理要求                                                        |
| ---------------- | -------------------------------------- | --------------------------------------------------------------- |
| Planner Prompt   | 目标理解, task分解, risk识别, plan生成 | via §17 质量门禁后才能发布; 与 DomainPromptLibrary(§37.6) 关联 |
| Generator Prompt | 工具选择, stepexecute, 结果生成           | independent版本化; A/B testingvia后才能full                              |
| Evaluator Prompt | 质量判断, 目标偏离检测, 改进建议       | independent于被评估对象; 不可与 Generator Prompt shared版本              |

Prompt 分层纳入 §16 Prompt manage体系, 每类 Prompt 有independent的 rollout channel. 

## 58.3 Failure-to-Learning 管线

将failure样例auto沉淀为平台知识资产: 

```text
Step failure
  → FeedbackEnvelope(outcome=failed)
    → failure模式分类 (error_class + root_cause_category) 
      → auto生成 candidate:
         ├── Recovery Playbook (恢复操作手册) 
         ├── Prompt Patch Candidate (Prompt 修补建议) 
         ├── Risk Rule Candidate (risk规则建议) 
         └── Evaluator Rule Candidate (评估规则建议) 
      → 人工审核 → P2 Release 治理 → 灰度上线
```

关键约束: 所有 candidate 只是建议, 必须经过 §34 ADR-Quality-Gate-Before-Prompt-Release 和 P2 审批后才能生效. LearningCandidate 必须via quality gate: 偏差check, 多样性check, pollute防护, PII/secret scan, holdout 隔离和 domain_owner 复核. 

## 58.4 Harness Replay 与 Simulation

based on Event Registry, ContextSnapshot 序列(§45.5)和已record的 LLM/Tool/Scheduler output, 支持: 

| 能力         | 说明                                              | 用途               |
| ------------ | ------------------------------------------------- | ------------------ |
| Trace Replay | 对已完成的 HarnessRun 按事件, recordoutput和调度决策重建 | 故障定位, 审计取证, 投影重建 |
| strategy对比     | 隔离环境中用不同 ConstraintPack 重新execute          | 约束调优           |
| Prompt A/B   | 隔离环境中用不同 Planner/Generator/Evaluator Prompt 重新execute | Prompt 优化 |
| 工具替换模拟 | 在 Toolbelt 中替换工具后重新execute                  | 工具迁移评估       |
| What-if analysis | 修改 ContextSnapshot 中某个值后重新execute           | Root Causeanalysis           |

default Replay 是 Trace Replay: 不重新call LLM / Tool, 不写 production truth, 不产生真实 SideEffect. ReplaySession 必须声明 `sideEffectMode=disabled/simulated/mock_only`, default `disabled`; 任何未explicitly声明的 replay 都不得触达外部system. strategy对比, Prompt A/B, 工具替换模拟和 What-if 属于 Re-execution Replay, 必须标记 nondeterministic, 在隔离沙箱中运行(§34 ADR-Workflow-Debug-Session-Isolated), 结果不得coverage原 HarnessRun evidence. 

ReplaySandboxPolicy: 所有 Re-execution Replay usesindependent budget, independent data namespace, 只读 production evidence, 模拟 external side effect, 并explicitly标记 `nondeterministic=true`. strategy对比, Prompt A/B 和工具替换结果只能作为 proposal evidence. 

## 58.5 架构remaining问题收口

收口以下跨章节remaining问题: 

本表只保留为can read性index; 长期治理必须迁移到 `LegacyResolutionRegistry` / ADR / issue registry, 避免正文永久承载历史债. 

| 问题                                                                   | 所在章节     | 收口方式                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §21 HITL 审批 vs §47 组织审批路由职责overlap                              | §21, §47     | §21 定义 HITL 模式和审批语义; §47 定义审批路由解析 -- §21 决定"需不需要审批, 什么模式", §47 决定"审批人是谁, 路由到哪"                                                                                             |
| §23 合规架构 vs §49 分部门合规引擎职责overlap                             | §23, §49     | §23 定义平台级合规框架 (GDPR/SOC2/加密/血缘) ; §49 定义组织级合规strategy分发 -- §23 是"合规能力", §49 是"合规strategy在组织树上的继承与差异化"                                                                            |
| §31 HA 架构 vs §52 多 Region 架构rangeoverlap                              | §31, §52     | §31 定义单 Region 内 HA-1/HA-2/HA-3 分级; §52 定义跨 Region 部署. 映射关系: HA-1 = 单节点单 Region, HA-2 = 双节点单 Region, HA-3 = 多 AZ 单 Region, §52 = 多 Region 单写入权威 + follower read + 受控 failover |
| §32 部署阶段 D1-D3 vs §8.4 扩展阶段 S1-S4 vs §33 落地 Phase 1-7 无对照 | §8, §32, §33 | 映射: D1+S1 = Phase 1-2, D2+S2 = Phase 3-4, D3+S3 = Phase 5-6, S4 = Phase 6-7. 三套分类的视角不同 -- D 看部署形态, S 看扩展能力, Phase 看交付节奏                                                                  |
| 无统一error分类体系                                                     | §6.2         | error码按层级组织: `PLATFORM.{plane}.{component}.{category}`, 例如 `PLATFORM.P4.TOOL.TIMEOUT`, `PLATFORM.P2.POLICY.DENIED`. OAPEFLIR 只能作为 tag / trace projection field, 不进入error码naming空间. 每个error码关联 retryable/severity/user_message 三元组                                  |
| §61 AgentDefinition.autonomy_config vs §42 渐进式自主权无explicitly关联      | §42, §61     | autonomy_config 由 §42 AgentTrustProfile 驱动生成, AgentDefinition 中的 autonomy_config 是快照 -- 创建时从 TrustProfile 获取初始值, runtime由 §42 TrustScorer dynamic更新                                              |

## 58.6 HarnessDecision — 统一裁决协议

> LoopController(§45.7) 的裁决升级为一级协议. 基础六种裁决为 accept/retry/replan/escalate/downgrade_mode/abort; 生产扩展裁决used for隔离, 撤销authorization, 等待外部system和重新validation. 

**十种裁决 (基础六种 + 扩展四种) **: 

| 裁决              | 语义                      | 触发条件                               | subsequent动作                                        |
| ----------------- | ------------------------- | -------------------------------------- | ----------------------------------------------- |
| accept            | 当前step/taskvia         | score ≥ threshold, 无 critical issues  | 推进下一步或完成 run                            |
| retry_same_plan   | 用同一 plan 重试当前step  | transient故障, 工具timeout, retry_count < max  | Generator 重新execute同一step                      |
| replan            | 触发 Planner 重新规划     | 目标偏离, risk升高, replan_count < max | Planner 生成 GraphPatch 或新 PlanGraphBundle    |
| escalate_to_human | 转交 HITL Runtime(§45.18) | risk 升高 / confidence 过低 / strategy要求 | Durable Harness pause + HITL 介入               |
| downgrade_mode    | 降级运行模式              | 信任不足 / 预算紧张 / risk接近阈值     | autonomy_mode 降一级 (如 semi_auto→supervised)  |
| abort             | 安全终止                  | 预算耗尽 / 不可恢复error / strategy禁止     | 保存state + record证据 + notificationuser                  |
| quarantine        | 隔离 run / agent / pack   | pollute, 泄露, 供应链或行为driftrisk       | 停止新execute + 进入安全审查                       |
| revoke_approval   | 撤销已批准authorization            | scope 不匹配, approval expiry, risk升高  | SideEffect 进入 revoked / expired              |
| pause_for_external | 等待外部system或人类window    | 外部system不可query, 合规等待, maintainedwindow    | Durable Harness pause                           |
| require_revalidation | 要求重新validation            | version/policy/domain/config drift       | 重新运行 Validation / Policy / Budget checks    |

**HarnessDecision 标准化field**: 

- decision: §58.6 统一裁决之一 (基础六种或扩展四种) 
- reason: 结构化原因 (error_class + root_cause_category) 
- evaluatorReport: 触发裁决的 EvaluationReport references
- confidence: 裁决置信度 0.0-1.0
- suggestedNextAction: 对下一步的建议 (供 LoopController 参考) 
- auditRef: 审计证据references

## 58.7 Runtime Metrics

v4.2 runtime指标以 HarnessRun / NodeRun 为主键, 至少contains: 

| 指标 | Description | 触发用途 |
| --- | --- | --- |
| runtime.run.admission_latency | RequestEnvelope 到 HarnessRun admitted 的耗时 | 准入bottleneck排查 |
| runtime.graph.ready_queue_depth | PlanGraph ready node 队列深度 | 调度拥塞判断 |
| runtime.budget.reservation_conflict_rate | Budget atomic reserve conflict率 | 预算竞态和容量预警 |
| runtime.side_effect.ambiguous_rate | 副作用 ambiguous 占比 | 外部systemreliability与对账告警 |
| runtime.trace_replay.success_rate | Trace Replay success重建比例 | 审计与事故复盘健康度 |
| runtime.re_execution.drift_rate | 重新execute与原 evidence 差异比例 | Prompt / Tool 变更risk |

## 58.8 Incident Rules

以下事件必须auto生成 Incident 或升级已有 Incident: 

| 规则 | 触发条件 | default级别 |
| --- | --- | --- |
| replay_mismatch | Trace Replay 无法重建原 projection 或 evidence hash inconsistent | P1 |
| budget_reservation_stuck | reservation 超过 TTL 未 settle / release | P2 |
| side_effect_ambiguous_timeout | ambiguous 超过 reconciliation SLA | P1 |
| scheduler_nondeterministic | 同一 ready set 的 scheduler decision missing或不可replay | P1 |
| panic_incomplete | PlatformPanicDirective 未收到全部平面 ack | P0 |
| policy_bypass_attempt | P4 收到未经 P3/HarnessRuntime authorization的常规executerequest | P0 |

## 58.9 Error Code Taxonomy

平台error码按以下格式naming: 

```text
PLATFORM.{plane}.{component}.{category}
```

示例: 

- `PLATFORM.P3.GRAPH.VALIDATION.NO_ENTRY_NODE`
- `PLATFORM.P3.GRAPH.VALIDATION.UNBOUNDED_LOOP`
- `PLATFORM.P4.NODE.STATE.INVALID_TRANSITION`
- `PLATFORM.P4.SIDEEFFECT.CONFIRMATION.TIMEOUT`
- `PLATFORM.P3.HITL.LOCK.CONFLICT`
- `PLATFORM.P5.REPLAY.NONDETERMINISTIC_INPUT`
- `PLATFORM.P2.LEARNING.CANDIDATE.PII_DETECTED`

每个error码必须声明 retryable, severity, userMessage, operatorAction, incidentRule 和 replayBehavior. 

## 58.10 Runtime Test Matrix

OAPEFLIR-Harness 最小testing矩阵: 

| testing类别 | coveragecontent |
| --- | --- |
| state机testing | HarnessRun / NodeRun 合法迁移, 非法迁移, 终态封闭 |
| Graph testing | DAG validation, deadlock, join, risk propagation, worst-path, GraphPatch |
| Scheduler testing | deterministic scheduling, Trace Replay schedule consistency |
| SideEffect testing | proposed→approved→committed→confirmed, ambiguous, reconciliation, compensation |
| Guardrail testing | critical block 优先级, LLM judge 不能coverage确定性failure |
| HITL testing | lock, scope approval, timeout escalation, manual takeover |
| Learning testing | holdout contamination, PII/secret block, EvaluationGate |
| Fault Injection | worker crash, LLM timeout, tool timeout after commit, event append failure, checkpoint restore |

该矩阵是 Phase 8d 的验收基线, 也必须纳入 executable runtime contract 和 CI 必跑发布门禁; 任何 runtime schema, state machine, event registry, budget 或 side effect 变更都必须更新对应testing. 

## 58.11 Executable Runtime Contract Package

机器验收entry必须落在 `runtime-contracts/`, 文档只描述 intent; schema, state机和 invariant test 才是implementation冻结basis. 最小目录: 

```text
runtime-contracts/
  task-draft.schema.ts
  confirmed-task-spec.schema.ts
  harness-run.schema.ts
  plan-graph-bundle.schema.ts
  graph-patch.schema.ts
  node-run.schema.ts
  node-attempt.schema.ts
  node-attempt-receipt.schema.ts
  side-effect.schema.ts
  reconciliation-record.schema.ts
  compensation-record.schema.ts
  budget-ledger.schema.ts
  budget-reservation.schema.ts
  budget-settlement.schema.ts
  event-envelope.schema.ts
  platform-fact-event.schema.ts
  oapeflir-view-event.schema.ts
  decision-input-bundle.schema.ts
  decision-directive.schema.ts
  operational-directive.schema.ts
  human-responsibility-record.schema.ts
  replay-session.schema.ts
  invariants/
    truth-event-atomicity.test.ts
    no-side-effect-in-replay.test.ts
    budget-reserve-before-execute.test.ts
    node-terminal-closed.test.ts
    contract-naming-consistency.test.ts
    event-consumer-platform-facts-only.test.ts
    graph-patch-side-effect-safety.test.ts
    hitl-responsibility-record.test.ts
    budget-concurrency-hard-cap.test.ts
```

发布门禁: 

| Gate | 必须check | failurehandle |
| --- | --- | --- |
| Schema diff gate | OpenAPI / Zod / SDK type与 runtime-contracts 一致 | block merge |
| Naming consistency | deprecated term 未进入新写path | block merge |
| State-machine invariant | HarnessRun / NodeRun / SideEffect 终态封闭 | block release |
| Replay safety | Replay 不call真实 LLM, Tool, Connector 或外部写 API | block release + incident |
| Budget precondition | LLM / Tool / SideEffect / Eval 前均有 active reservation | block release |
| Event atomicity | truth mutation 与 event append 同transaction | block merge |
| Event consumer safety | truth projector 只消费 platform facts, 不消费 oapeflir view events | block merge |
| GraphPatch safety | 已execute节点不可删除; affectedSideEffects 必须声明 | block merge |
| HITL responsibility | approve / override / takeover / resume 均生成 HumanResponsibilityRecord | block release |
| Budget concurrency | 1000 concurrent reserve 不穿透 tenant hard cap | block release |

---

# Part VII — 组织治理层 (§46-§51) 

---

# 46. 组织层次模型

> 在 tenant/domain/pack 之上叠加 company/division/department/team 组织架构层, 驱动审批, 预算, 隔离, 合规的分层治理. 
> 关联: §11 安全 · §18 成本 · §21 HITL · §37 业务域 · §47 审批路由 · §48 SSO/SCIM

## 46.1 组织模型

OrgNode 是组织架构的基本单元, 组成树形结构 (OrgTree) : 

| field       | type                                         | 说明                                 |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `nodeId`   | string (ULID)                                | globally唯一标识                         |
| `type`     | enum: company / division / department / team | 组织层级type                         |
| `parentId` | string \| null                               | 父节点 ID, company 节点为 null       |
| `name`     | string                                       | 组织单元名称                         |
| `metadata` | object                                       | 扩展属性 (成本中心, 地域, 负责人等)  |

OrgTree 支持dynamic重组 -- 节点的增删改auto触发下游permissions刷新, 审批路由重算 (§47) 和预算重分配. 所有变更record审计log. 

## 46.2 组织层次与平台层次的映射

```text
组织架构                        平台架构
company ──────────────────── platform (单实例)
  ├── division ────────────── tenant_group (预算汇总)
  │   ├── department ──────── tenant (隔离单元)
  │   │   ├── team ────────── domain + pack_group
  │   │   └── team ────────── domain + pack_group
  │   └── department ──────── tenant
  └── division ────────────── tenant_group
```

| 组织层级   | 平台映射        | 治理permissions                           |
| ---------- | --------------- | ---------------------------------- |
| company    | platform config | globallystrategy, 平台级 SLO, 合规总纲     |
| division   | tenant_group    | 事业部预算, 跨部门 workflow strategy   |
| department | tenant          | 部门预算, 部门 SLO, 域manage, 审批链 |
| team       | domain/pack     | 域configure, Pack 开发, 日常运营        |

`LegalEntityBoundary` independent于 OrgNode 树exists, used for标记法人, 国家/地区和监管边界. 跨法人或跨国家的data, 审批, 预算, 知识shareddefault按跨 tenant handle, 必须走 §50 controlled sharing, §52 跨境合规和 §47 审批路由. 

## 46.3 组织变更auto适配

| 组织变更事件 | 平台autoresponse                                                      |
| ------------ | ----------------------------------------------------------------- |
| 员工入职     | SCIM synchronous → 创建 principal → 分配到 team → 继承 team permissions         |
| 员工调动     | 更新 reporting_chain → 调整 tenant/domain permissions → 迁移审批委托     |
| 员工离职     | SCIM deprovisioning → 撤销所有permissions → 转移 domain_owner → 审计record |
| 部门合并     | 合并 tenant → 合并预算 → 重新计算 SLO → 迁移 Pack 归属            |
| 组织重组     | 重建 reporting_chain → 刷新审批路由 → notification受影响的 domain_owner   |

组织变更必须生成 `OrgMergeConflictReport`, `ApprovalRerouteOnOrgChange` 或 `OrphanAgentFreezePolicy` (按需) . 无人接管的 owned Agent default冻结新 run admission; in-flight approval 重新路由但保留原审批 evidence. 

员工离职, 停用或高risk调岗必须触发 revoke sessions, reassign pending approvals, cancel secret leases, freeze delegated authority 和 owned Agent admission freeze; 完成后output `IdentityDeprovisioningReport`. 

OrgTree 级联变更必须via `OrgGovernanceSaga` execute: prepare 阶段冻结 orgVersion, 影响range, 预算/审批/知识边界 diff; commit 阶段按fixedorder更新 identity, approval route, budget owner, domain owner 和 agent ownership; compensate 阶段rollback未完成子step或冻结受影响资源; audit 阶段output `OrgGovernanceSagaReceipt`. 部门合并遇到域strategyconflict时fixed采用 stricter wins; 无法比较的strategy进入 compliance approval, 不得auto合并. 

---

# 47. 组织架构审批路由

> based on org-chart 的dynamic审批路由, 替代static approver list. 
> 关联: §21 HITL · §46 组织层次 · §10 risk控制

## 47.1 dynamic审批路由引擎

审批路由引擎根据request上下文dynamic计算审批链, 替代static approver list: 

| 路由因子 | 说明                                      |
| -------- | ----------------------------------------- |
| risk等级 | risk_level (§10) 越高, 审批层级越高       |
| 成本阈值 | 按 §18 成本估算匹配审批额度矩阵 (§47.2)   |
| 组织层级 | 沿 OrgTree (§46) 向上查找对应层级的审批人 |
| 委托规则 | 审批人不在位时auto路由到代理人 (§47.3)    |

引擎支持多审批人会签 (parallel) 与逐级审批 (sequential) 两种模式. 每步设independenttimeout, timeout后按 escalation_policy auto升级到更高组织层级. 职责分离 (SoD) check由strategy引擎execute, 不限于 requester != approver, 还必须coverage利益conflict, 同一审批链互批, 预算 owner 与execute owner conflict. 

## 47.2 审批额度矩阵

| risk金额  | auto | Manager | Director | VP  | CFO/CTO |
| --------- | ---- | ------- | -------- | --- | ------- |
| < ¥1,000  | ✓    |         |          |     |         |
| ¥1K-10K   |      | ✓       |          |     |         |
| ¥10K-100K |      |         | ✓        |     |         |
| ¥100K-1M  |      |         |          | ✓   |         |
| > ¥1M     |      |         |          |     | ✓       |

multi-currency审批必须统一为 `base_currency + FX snapshot` 后比较阈值; 审批record保存 FX rate, rate source 和 snapshot time. 

## 47.3 不在位auto代理

当审批人不在位时, system按以下优先级寻找代理: 

1. explicitly委托代理人 (DelegationOfAuthority) 
2. org-chart 向上一级 (skip-level manager) 
3. 同级别同部门 peer (如configureallows) 
4. timeout后execute ApprovalTimeoutPolicy(§21)

peer delegate 必须经过 ConflictOfInterestFilter. 所有 approval 必须有 expiry, revocation 和 commit-time revalidation; SideEffect commit 前必须confirmation approval 仍在有效期且 scope 匹配. 

审批创建时必须冻结 `ApprovalRouteSnapshot`, contains org chart version, approver set, SoD/COI check结果, base_currency + FX snapshot, route policy version 和 evidence refs. 组织变更只影响新审批或 checkpoint revalidation, 不得原地改写历史审批链. 

---

# 48. 企业 SSO/SCIM 集成架构

> 与企业identity提供商集成, implementationautouser生命周期manage. 
> 关联: §6.5 认证 · §11 安全 · §46 组织层次

## 48.1 identity集成协议

| 协议         | 用途                     | 优先级 |
| ------------ | ------------------------ | ------ |
| **OIDC**     | SSO 登录 (已有 §6.5)     | 已支持 |
| **SAML 2.0** | SSO 登录 (传统企业 IdP)  | 必须   |
| **SCIM 2.0** | user/组autosynchronous          | 必须   |
| **HR API**   | 组织架构synchronous (可选)      | 可选   |

## 48.2 SCIM 集成模型

平台implementation SCIM 2.0 Server 端点, 接收企业 IdP 推送的user和组变更: 

| 端点      | 支持操作                          | 说明                                     |
| --------- | --------------------------------- | ---------------------------------------- |
| `/Users`  | GET / POST / PUT / PATCH / DELETE | user增删改查, 映射到平台 principal       |
| `/Groups` | GET / POST / PUT / PATCH / DELETE | 组增删改查, 映射到 OrgNode (§46) 的 team |

SCIM synchronousautomaintained principal ↔ OrgNode 的关联关系. user停用 (deprovisioning) 时立即撤销活跃 session 并暂停其名下 Agent, 确保零residual访问. 所有synchronous操作record审计log, conflict时以 IdP 为权威源. IdP sync 异常进入 `identity_sync_dlq`, 并生成 SCIM conflict report. 

`identity_sync_dlq` 必须有 retry/backoff 和周期对账: 429 遵守 Retry-After, 5xx uses exponential backoff, schema/conflict error进入人工handle; 每日 reconciliation 对比 IdP group/user snapshot 与平台 principal/org mapping, 发现drift即生成 `IdentityReconciliationReport`. deprovisioning 属于安全关键path, DLQ 不得blocks session revoke 和 secret lease cancel. 

## 48.3 user生命周期auto化

```text
IdP 事件                    平台response
─────────                   ────────
User Created ──────────▶ 创建 principal + 分配 role + 加入 org_node + 欢迎引导
User Updated ──────────▶ synchronous属性 + 更新 reporting_chain + 调整permissions
User Deactivated ──────▶ 立即撤销所有活跃 session + 暂停所有 owned Agent
User Deleted ──────────▶ 转移 domain_owner + 归档审计record + 触发 data_retention
Group Changed ─────────▶ batch更新 role mapping + 刷新审批路由(§47)
```

Session revocation SLO: 普通离职 < 5min, 安全事件停用 < 60s. shared/team agent 必须声明 owner fallback; 无 fallback 时进入 paused/frozen. 

---

# 49. 分部门合规strategy引擎

> 使不同部门可execute不同合规框架 (SOX + HIPAA + PCI-DSS + GDPR 共存) . 
> 关联: §23 合规 · §37.3 DomainRiskProfile · §46 组织层次

## 49.1 合规框架注册表

ComplianceFramework 定义可激活的合规框架, 支持多框架共存: 

| field                | type                                             | 说明                         |
| ------------------- | ------------------------------------------------ | ---------------------------- |
| `frameworkId`       | string (ULID)                                    | globally唯一标识                 |
| `type`              | enum: GDPR / SOC2 / PIPL / HIPAA / SOX / PCI_DSS | 合规框架type                 |
| `rules`             | ComplianceRule[]                                 | 具体控制项列表               |
| `auditRequirements` | AuditSpec[]                                      | 审计频率, 证据type, 留存期限 |
| `reportTemplate`    | string                                           | 合规报告模板 ID              |

框架按 tenant 粒度激活 -- 同一平台内不同部门可execute不同合规组合 (§49.2 继承机制) . 框架变更需 platform_admin 审批, 激活后autoinjection对应的 ConstraintPack 约束. 

## 49.2 合规strategy继承

```text
company:  [基础安全strategy] + [data分级strategy]
    │
    ├── finance_division:  继承 + [SOX]
    │   ├── accounting_dept: 继承 + [SOX-404 强化]
    │   └── payment_dept:   继承 + [PCI-DSS]
    │
    ├── healthcare_division: 继承 + [HIPAA]
    │
    └── eu_operations:      继承 + [GDPR]
```

规则: 子节点**继承**父节点所有合规约束, 可**追加**但不可**放松**. strategy合并语义fixed为: deny overrides allow; 安全/合规维度 stricter wins; 配额, 组织结构, data边界等结构性conflict必须进入 ADR 或合规审批, 不能靠“更严格”auto猜测. 由于严格性并非总是全序, 每类strategy必须提供 `PolicyStrictnessComparator`; 无法比较时按更严格pathexecute或要求合规审批. 

## 49.3 auto合规证据收集

| 合规控制         | 证据来源                   | 收集方式                 |
| ---------------- | -------------------------- | ------------------------ |
| SOX 访问审查     | §11.2 RBAC + §28 audit log | 季度auto导出访问permissions快照 |
| SOX 职责分离     | §47 SodRouting             | auto验证审批链无违规     |
| HIPAA data加密   | §23.5 加密架构             | 持续监控加密state         |
| PCI-DSS rangelimit | §46 tenant 隔离            | auto验证 CDE 边界        |
| GDPR 删除权      | §23.2 crypto-shredding     | autorecord删除execute证据     |

合规例外必须走 `ComplianceExceptionWorkflow`, contains scope, expiresAt, approver, compensating controls 和 auditRef. 合规运营指标包括 `EvidenceQualityScore` 与 `ControlCoverageReport`. 

---

# 50. 知识域隔离与受控shared

> force隔离不同部门的知识资产, 提供审批式跨域shared. 
> 关联: §29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 组织层次 · §11 安全

## 50.1 知识隔离模型

KnowledgeBoundary 定义知识资产的隔离边界, defaultreject跨域访问: 

| field               | type                      | 说明                                         |
| ------------------ | ------------------------- | -------------------------------------------- |
| `boundaryId`       | string (ULID)             | 边界唯一标识                                 |
| `ownerOrgNode`     | string                    | 所属组织节点 (§46) , 决定归属                |
| `accessPolicy`     | enum: strict / controlled | strict=完全隔离, controlled=审批后可shared     |
| `allowedConsumers` | OrgNodeRef[]              | 已authorization的消费方列表 (only controlled 模式生效)  |
| `auditOnAccess`    | boolean (default true)       | 每次访问是否写入审计log                     |

所有知识query在execute时经 KnowledgeFederator (§50.2) forcevalidation边界. 未authorization的跨边界request不only被reject, 且不暴露目标知识的exists性. 

## 50.2 知识联邦search

当 Agent search知识时, KnowledgeFederator 按permissionsfilter结果: 

```text
Agent searchrequest
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [本边界内知识] → directlyreturn
    ├──▶ [controlled 边界知识] → check CrossBoundaryRule → 有authorization则return (可能经 transform) 
    └──▶ [strict 边界知识] → 完全不可见 (连"exists"都不暴露) 
```

## 50.3 信息隔离墙 (Chinese Wall) 

金融服务场景要求: 

- M&A 团队的知识对其他部门**完全不可见**
- 同一人不能同时访问利益conflict方的知识
- 一旦访问了 A 方知识, auto禁止访问 B 方知识 (dynamic隔离墙) 

Chinese Wall 必须有 `WallExpiryPolicy` / reset 流程, 避免user长期uses后permissions只收紧不可恢复. 解除或到期必须经 compliance officer 审批, cooling period, full audit 和 data residue scan; 审计/debug 需求由 `ComplianceOfficerAuditView` 满足, 不向普通call者暴露知识exists性. controlled sharing 必须via `CrossBoundaryTransform` 做sanitized, 摘要和field级filter. 

Chinese Wall grant/release 必须uses两阶段提交: prepare 先lock定 subject, conflict set, knowledge boundary 和 expiry; commit 时同时写 boundary state 与 audit event; failure时保持原隔离墙不变并生成 reconciliation task. release 不得先删除limit再补审计; 审计写入failure时 release failure. 

---

# 51. 分级治理委托

> 使部门manage员在平台团队设定的护栏内自助治理, 平台团队不再是所有治理变更的bottleneck. 
> 关联: §24 configure治理 · §37.9 DomainGovernancePolicy · §46 组织层次

## 51.1 治理permissions分层

GovernancePermission 定义各组织层级的治理操作permissions: 

| field           | type                                       | 说明                          |
| -------------- | ------------------------------------------ | ----------------------------- |
| `permissionId` | string (ULID)                              | permissions唯一标识                  |
| `scope`        | { orgNode: string, resourceType: string }  | 作用range: 组织节点 + 资源type |
| `level`        | enum: view / operate / admin / super_admin | permissions级别, 逐级递增            |
| `delegatable`  | boolean                                    | 是否allows向下委托              |
| `expiresAt`    | ISO8601 \| null                            | expiry时间, null 表示永久       |

permissions遵循最小permissionsprinciple: view only查看; operate 可execute日常操作; admin 可修改域级strategy; super_admin 可修改globally护栏. 委托的permissions不可超过委托人自身级别. 

RuntimeInvariant 不可被任何 admin coverage, 包括 super_admin. super_admin 只能提交 policy proposal; 不可降级 invariant 的临时例外必须via break-glass, dual control, post-review 和auto恢复window, 不allowsdirectly关闭. 治理委托必须声明 DelegationScope, DelegationExpiry, revocation policy 和 PolicyComparator; expiry或撤销后所有派生permissions即时失效. 

委托撤销必须有有界传播 SLO: 普通治理permissions < 5min, 高risk或安全事件 < 60s. 撤销via `GovernanceDelegationRevocationSaga` 级联到派生委托, pending approval, active session, secret lease, worker lease 和 scheduled trigger; 无法confirmation的下游资源进入 frozen/quarantined, 不得继续execute. 

## 51.2 治理继承与覆写规则

```text
platform_team 设定globally护栏
    │
    ▼ 继承 (不可放松) 
division_admin 设定事业部strategy
    │
    ▼ 继承 (不可放松) + 可追加
department_admin 设定部门strategy
    │
    ▼ 继承 (不可放松) + 可追加
team_lead 日常运营configure
```

| 操作                      | 上级可            | 下级可            |
| ------------------------- | ----------------- | ----------------- |
| 收紧strategy (降低 max_risk)  | ✓                 | ✓                 |
| 放松strategy (提高 max_risk)  | ✓                 | ✗                 |
| 追加约束                  | ✓                 | ✓                 |
| 删除上级约束              | ✓ (自己设的)      | ✗                 |
| 分配预算                  | ✓ (在自己配额内)  | ✓ (在自己配额内)  |

## 51.3 自助治理操作台

| 功能                   | 部门manage员可用      | 平台团队可用 |
| ---------------------- | ------------------- | ------------ |
| 域接入向导(§44.2)      | ✓ (低/中risk域)     | ✓ (所有域)   |
| 修改审批规则           | ✓ (在额度upper limit内)    | ✓ (无limit)   |
| 发布 Pack              | ✓ (经auto安全扫描)  | ✓            |
| 调整 Agent 自主权(§42) | ✓ (不超过域upper limit)    | ✓            |
| 创建触发器(§41)        | ✓ (低/中risk)       | ✓            |
| 修改globally护栏           | ✗                   | ✓            |
| 跨部门strategy             | ✗                   | ✓            |

---

# Part VIII — 规模化运行层与生态层 (§52-§57) 

---

# 52. 多 Region 部署架构

> 支持全球化企业跨 Region 合规运行, data主权, 流量路由, 故障隔离. 
> 关联: §31 容灾 · §32 部署 · §23 合规 · §46 组织层次

## 52.1 Region 模型

| field                | type                        | 说明                                               |
| ------------------- | --------------------------- | -------------------------------------------------- |
| regionId            | string                      | globally唯一, 如 `cn-east-1`, `eu-west-1`              |
| provider            | AWS / GCP / Azure / private | 底层基础设施供应商                                 |
| status              | active / standby / draining | active 为主用; standby 预热待切换; draining 迁出中 |
| endpoints           | `{ api, ws, internal }[]`   | 各平面entry地址                                     |
| dataResidencyPolicy | string                      | allows驻留的data法域, 如 `EU-only`, `CN-only`        |

多 Region 部署要求每个 Region 至少达到 §31 HA-3 等级 (多 AZ 部署) , 但 v4.2 不承诺多主 truth 写入. 每个 tenant / partition 同一时刻只能有一个写入 leader, 其他 Region 提供 follower read, 异步复制和受控 failover. 

## 52.2 Region 感知架构

```text
                    ┌──────────────────────┐
                    │  Global Control Plane │ (metadata-only 联邦)
                    │  Region 路由 · strategysynchronous │
                    └──────────┬───────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ CN Region     │ │ EU Region     │ │ US Region     │
    │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
    │ │ P1-P5     │ │ │ │ P1-P5     │ │ │ │ P1-P5     │ │
    │ │ 完整五平面 │ │ │ │ 完整五平面 │ │ │ │ 完整五平面 │ │
    │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
    │ data驻留: CN  │ │ data驻留: EU  │ │ data驻留: US  │
    │ 合规: PIPL    │ │ 合规: GDPR    │ │ 合规: SOX     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## 52.3 跨 Region Workflow 路由

| 场景                                | 路由strategy                        | datahandle                     |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| user在 EU, task只涉及 EU data       | Region 亲和, 留在 EU            | localhandle                     |
| user在 CN, 需要call US 的 LLM       | CN execute, LLM request路由到 US      | 输入扫描 + output扫描均confirmation无 PII/regulated data 时allows跨境 |
| 跨 Region 协作 (EU 市场 + US 工程)  | 各自 Region execute, metadata synchronous | only交换匿名化/聚合data        |
| Region 故障 failover                | 手动/半auto切换到备用 Region    | 元data预复制, 业务data不跨境 |

写入边界: 

- CAS, Lease, Fencing, Budget Ledger, SideEffect Commit 和 HarnessRun truth update 只allows在 partition leader 内execute. 
- follower Region 只能读 projection, 提交待路由request或承接 failover 后的新 leader epoch. 
- failover 必须提升 fencing epoch; 旧 leader 恢复后只能作为 follower 加入, 未confirmation复制的写入进入 reconciliation. 
- CRDT / multi-master only可used for非关键统计, cached或聚合 telemetry, 不得承载 truth, 预算或副作用提交. 
- Global Control Plane 只保存 metadata, routing policy, region health 和 home-region mapping; 不得保存业务 payload, PII, PHI, secret 或 tenant truth. 每个 tenant/partition 必须声明 home region 与 failover tier. metadata 必须有 quorum/backup, home-region mapping restore 流程和 routing policy version lock; failover 后的路由不得读取未lock定strategy. 

## 52.4 跨境data传输合规

| 法域       | 合规框架                                             | 平台机制                                                                                                  |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| EU → 非EU  | GDPR Chapter V — SCCs (Standard Contractual Clauses) | 跨 Region LLM callauto附加 SCC datahandle协议references; 传输前 DPIA (Data Protection Impact Assessment) auto评估 |
| EU → US    | EU-US Data Privacy Framework                         | 验证 provider 是否在 DPF 清单; 未列入则fallback至 SCC                                                         |
| CN → 海外  | PIPL 第 38 条 — 安全评估 / 标准合同                  | 跨境前auto触发data量评估; 超阈值需安全评估record                                                            |
| 集团内跨境 | BCRs (Binding Corporate Rules)                       | 企业级 BCR 模板, 平台auto在跨境传输中references BCR 编号并record                                                  |

**跨境传输控制链**: 

```text
跨 Region datarequest
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  识别 source/target 法域
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  auto DPIA 评分; high impact → 人工审批
│ Assessor          │
├──────────────────┤
│ Mechanism         │  选择合规机制: SCC / BCR / DPF / 安全评估
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  only传输必要field; PII sanitized/假名化
├──────────────────┤
│ Output Scanner    │  对 LLM/tool output做 PII/regulated data 扫描; 命中则阻断跨境return并生成 incident
├──────────────────┤
│ Transfer Logger   │  完整record传输log (source, target, 法律basis, data量, 时间) 
└──────────────────┘
```

---

# 53. 规模化资源竞争manage

> 5000+ concurrent workflow 场景下的公平调度, 优先级抢占, 容量保障. 
> 关联: §8 可扩展性 · §9 稳定性 · §14 Runtime · §46 组织层次 · §54 SLA

## 53.1 调度层次

```text
┌─────────────────────────────────┐
│  Admission Controller           │  globally准入控制
│  (reject超出平台容量的request)         │
├─────────────────────────────────┤
│  Quota Manager                  │  部门级配额manage
│  (保障/limit每个部门的资源份额)     │
├─────────────────────────────────┤
│  Priority Scheduler             │  优先级调度
│  (SLA 感知 + 抢占)              │
├─────────────────────────────────┤
│  Worker Pool                    │  execute层
└─────────────────────────────────┘
```

## 53.2 资源配额模型

| field           | type                                  | 说明                                       |
| -------------- | ------------------------------------- | ------------------------------------------ |
| quotaId        | string                                | 配额唯一标识                               |
| tenantId       | string                                | 所属部门/tenant                              |
| resourceVector | `MultiResourceQuotaVector`            | worker, tool QPS, model TPM/RPM, budget, approval capacity 的组合向量 |
| limit          | `Map<ResourceKind, number>`           | 各资源upper limit值                               |
| used           | `Map<ResourceKind, number>`           | 当前已用量 (实时更新)                      |
| reserved       | `Map<ResourceKind, number>`           | 已预留但未结算的资源                       |
| period         | hourly / daily / monthly              | 配额周期, 周期结束autoreset used            |
| overflowPolicy | queue / reject / burst                | 超额strategy: 排队等待, directlyreject, allows短时突发 |

`ResourceKind` 至少contains: `worker_concurrency`, `tool_qps`, `model_tpm`, `model_rpm`, `budget_amount`, `approval_capacity`, `storage_io`. Admission Controller 只有在整个 `resourceVector` 都可满足时才allows进入队列, 避免 token, 审批席位或预算任一维度被隐性打爆. `approval_capacity` 也必须 reserve/release; 高risk run 无审批容量时必须 admission deny 或排队, 不得先execute再等人. 

## 53.3 优先级抢占

| 优先级          | 场景              | 抢占strategy              | 启动 SLA |
| --------------- | ----------------- | --------------------- | -------- |
| critical(1000)  | 线上事故修复      | 可抢占所有非 critical | < 10s    |
| high(800)       | 电商订单handle      | 可抢占 standard 以下  | < 30s    |
| standard(500)   | 日常业务 workflow | 不抢占                | < 5min   |
| background(200) | batchanalysis / 报表   | 不抢占, 空闲时运行    | 尽力     |
| best_effort(0)  | 实验性task        | 不抢占, 随时可被抢占  | 无保证   |

## 53.4 公平调度

- **Weighted Fair Queuing**: 每个部门按 guaranteed 配额获得权重
- **Borrowing**: 部门未用满 guaranteed 配额时, 空闲资源可被其他部门 burst uses
- **Reclaim**: 当原部门需要时, borrowed 资源在当前 step 完成后归还 (graceful reclaim) 
- **Weighted Aging**: 排队时间按 `effective_priority = base_priority * sla_weight + aging_factor` 计算, aging 只提升调度order, 不改变 SLA Tier 或risk等级
- **Promotion Budget**: 每个 tenant 每日/每小时有independent `promotion_budget`, 排队升级消耗该预算; 预算耗尽后只告警和扩容建议, 防止高负载下所有task都被升级为 high
- **Checkpoint-before-preempt**: 抢占任何 durable run 前必须完成 checkpoint, 并record `preempted_by`, `checkpoint_ref`, `resume_policy`; 不可 checkpoint 的 side effect window 禁止抢占, 只能限流或 drain
- **Starvation Prevention**: standard task排队超过阈值后进入 weighted aging, 不得无配额地directly升级为 high

---

# 54. SLA 分级保障

> 为不同业务重要度提供差异化 SLA 保障, 含资源预留和违约response. 
> 关联: §27 SLO · §37.9 DomainGovernancePolicy · §53 资源竞争

## 54.1 SLA Tier 模型

| field           | type                                    | 说明                                    |
| -------------- | --------------------------------------- | --------------------------------------- |
| tierId         | string                                  | Tier 唯一标识                           |
| name           | platinum / gold / silver / bronze       | Tier 名称, 与 §54.2 矩阵对应            |
| availability   | number (%)                              | 承诺可用性; 手动/半auto failover default最高 99.95% |
| externalP95Latency | number (ms)                         | user可见 P95 延迟upper limit                   |
| internalP99Latency | number (ms)                         | 平台内部 P99 延迟upper limit                   |
| approvalLatencySlo | duration                            | 审批等待目标                            |
| incidentResponseSlo | duration                           | Incident response目标                       |
| priorityWeight | number (1-100)                          | 调度优先级权重, Platinum=100, Bronze=10 |
| costMultiplier | number                                  | 相对 Bronze 的资源成本系数              |
| supportLevel   | 24x7_dedicated / 24x7 / 8x5 / community | 对应支持等级                            |

## 54.2 SLA Tier 矩阵

| Tier         | 可用性 | E2E P95 延迟 | Internal P99 延迟 | 排队upper limit | 恢复优先 | 适用场景           |
| ------------ | ------ | ------------ | ----------------- | -------- | -------- | ------------------ |
| **Platinum** | 99.95% | < 2s         | < 500ms           | < 5s     | 最高     | 线上交易, 实时风控 |
| **Gold**     | 99.9%  | < 5s         | < 1s              | < 30s    | 高       | 核心业务 workflow  |
| **Silver**   | 99.5%  | < 15s        | < 2s              | < 5min   | 中       | 日常运营           |
| **Bronze**   | best effort | < 60s   | < 5s              | < 30min  | 低       | 内部工具, 实验     |

99.99% 只allows在auto failover, quorum 写入, 热备容量和跨 Region 演练均via的专用部署档中单独承诺, 不作为 v4.2 default SLA Tier. 

SLA 必须按 workflow class split: deterministic 可承诺低秒级; LLM-assisted 只承诺平台内部调度/队列 SLO, 模型延迟单独统计; HITL-waiting 不把人工等待计入平台故障, 但必须承诺notification, 提醒和升级时限. 

## 54.3 SLA 感知调度

Dispatcher(§14.2) 在调度时考虑 SLA Tier: 

1. **排队check**: workflow 排队时indirectly近 `max_queue_time` 时auto升级优先级
2. **延迟预测**: based on历史data预测 workflow 是否会violates SLA, 提前扩容或抢占
3. **资源预留**: Platinum/Gold tier 的 `resource_reservation` 始终为其预留, 不可被 burst 占用
4. **违约response**: SLA violates时按 `ViolationResponse` autoexecute (告警/扩容/抢占/升级) 

---

# 55. Agent 市场与生态

> MVP 只构建企业内部 Pack Registry; 外部 Marketplace, 商业分发和收益结算属于 Enterprise/Future 能力. 
> 关联: §30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 Registry / Marketplace 分层

```text
┌───────────────────────────────────────────┐
│  Internal Pack Registry [MVP]             │
│  ├── Pack Store      (业务域 Pack)        │
│  ├── Connector Store (内部连接器)          │
│  ├── Template Store  (Workflow 模板)       │
│  └── Eval Store      (评估data集)          │
├───────────────────────────────────────────┤
│  Quality & Security Gate [MVP]            │
│  auto扫描 · SBOM · signature · compatibility性testing · 沙箱验证 │
├───────────────────────────────────────────┤
│  External Marketplace [Enterprise/Future] │
│  第三方发布 · 评分 · 商业条款 · 推荐       │
└───────────────────────────────────────────┘
```

MVP 禁止把外部第三方 Pack 作为default安装来源. 第三方 Pack/Plugin/Connector 进入任何生产 tenant 前, 必须via §11 安全基线: SBOM, artifact signing, provenance, sandbox certification, egress policy, secret access review 和最小permissions Capability Profile. 

## 55.2 市场条目模型

| field                | type                               | 说明                            |
| ------------------- | ---------------------------------- | ------------------------------- |
| entryId             | string                             | 条目唯一标识                    |
| packId              | string                             | 关联的 Pack/Plugin/Connector ID |
| publisher           | string                             | 发布者 (组织或个人)             |
| version             | semver                             | 当前发布版本                    |
| pricing             | free / enterprise_included / paid  | 定价模式, 详见 §55.4            |
| rating              | number (0-5)                       | user综合评分                    |
| installCount        | number                             | 累计安装量                      |
| certificationStatus | uncertified / verified / certified | 平台认证state                    |
| dependencies        | `{ item_id, version_range }[]`     | dependency项列表, 详见 §55.6          |

## 55.3 安装与治理

| 发布者type           | 安装审批              | 安全要求                | 更新strategy   |
| -------------------- | --------------------- | ----------------------- | ---------- |
| platform_official    | auto安装              | 平台团队已审查          | auto更新   |
| enterprise_internal  | 部门manage员审批        | auto安全扫描            | notification后auto |
| verified_third_party | 部门manage员 + 安全团队 | auto扫描 + 人工审查     | 手动confirmation   |
| community            | 平台团队审批          | 完整安全审查 + 沙箱testing | 手动confirmation   |

## 55.4 商业条款边界

收益分成, 计费结算, 信用积分和外部商业规则不属于核心运行架构, 不得影响 Pack 安装, execute, permissions或安全裁决. Enterprise/Future Marketplace 可在independent商业规范中定义 `CommercialTerms`, 但核心平台只消费认证state, 版本, dependency, permissions和安全元data. 

## 55.5 条目废弃生命周期

| 阶段       | 触发条件                                                 | 平台动作                                                         |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| active     | 正常运行                                                 | —                                                                |
| deprecated | publisher 标记废弃 或 90 天无maintained更新 + exists已知安全漏洞 | 安装页面显示废弃警告; 新安装需confirmation; 推荐替代品                   |
| sunset     | deprecated 后 180 天                                     | 阻止新安装; 已安装的发送迁移notification(30 天倒计时)                    |
| removed    | sunset 倒计时结束 + 迁移门槛达成                         | 从 Registry removal; 已安装实例冻结 (不execute新task) , data保留 90 天 |

进入 `removed` 前必须满足 `migration_threshold`: 无 critical business Agent 仍dependency该条目; 已迁移安装数 ≥ 95%; 剩余安装均有explicitlyriskacceptsrecord; 安全漏洞场景可紧急冻结execute, 但仍须保留只读data和迁移导出能力. 

## 55.6 dependencymanage

- 每个 MarketplaceItem 声明 `dependencies: { item_id: string; version_range: string }[]`
- 安装时auto解析dependency树, 检测版本conflict (类似 npm/cargo resolution) 
- 卸载时check反向dependency, 若有其他 item dependency则阻止卸载并提示
- dependency项被 deprecated 时, autonotification所有dependency方 publisher 和安装user
- Marketplace 必须maintained dependency graph, security advisory, forced patch, quarantine 和 tenant impact report. critical advisory 可force冻结或补丁升级, 但必须保留只读导出, rollback说明和tenant影响清单. 

---

# 56. 反馈驱动持续改进管线

> 将 §13 Learn/Improve 黑盒interface具象化为可运行的auto改进管线. 
> 关联: §13 OAPEFLIR L-I-R · §17 模型评估 · §37.5 DomainEvalFramework · §42 渐进式自主权

## 56.1 改进管线总览

```text
生产executedata
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (信号采集)    │     │ (模式analysis)    │     │ (改进生成)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │
                                           │ (质量门禁)    │──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ via
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt 灰度
                                           └──────────────┘
```

## 56.2 信号采集

**设计决策: 3D FeedbackSignal 结构 vs 扁平枚举**

上面 architecture 文档中的 `FeedbackSignalType` uses扁平的 9 type枚举. 实际implementation (`src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.ts`) 采用 3D 正交结构: 

**为什么用 3D 而非扁平 9 type枚举: **

| 设计考量 | 扁平枚举                   | 3D 正交结构                            |
| -------- | -------------------------- | -------------------------------------- |
| 可组合性 | 9 种fixed组合               | 5×5×4=100 种potential组合                   |
| 扩展性   | 新type需修改枚举           | independent扩展arbitrary维度                       |
| filterquery | 需要 N 个 OR 条件          | 可independent按 source/category/severity filter |
| 空missing组合 | 可能exists无意义的"合法"组合 | 业务逻辑决定哪些组合有效               |

这种设计使 FeedbackSignal 可以表达更细粒度的反馈, 同时保持维度间的正交性, 便于analysis和路由. 架构文档中的扁平枚举used for概念说明, 实际implementation遵循 3D 结构. 

每条 FeedbackSignal 必须附带 `FeedbackTrustScore`: 来源可信度, 历史准确率, 是否经过identity验证, 是否来自同一攻击面, 是否与 holdout/eval dataoverlap. 低可信反馈可进入analysis队列, 但不得directly生成上线候选. 

训练样本选择同时计算 `CandidateDataQualityScore`, `CandidateDiversityScore`, `ContaminationScanResult` 和 `HoldoutCheckResult`, coverage tenant, domain, 语言, task难度, failuretype和risk等级, 避免只从最活跃user或单一failure模式学习. 任何候选若命中 PII, secret, 受限data, holdout contamination 或 eval leakage, 必须进入 quarantine 并阻断发布. 

Feedback Analysis 必须contains collective anomaly detection: 当同一tenant, 同一组织, 同一外部来源或同一时间window内的反馈高度同质且推动同一strategy放松时, 候选进入 `bias_suspected` / quarantined, 由人工审核. 低信任反馈不得影响 holdout, risk threshold 或 autonomy promotion. 

## 56.3 auto改进type

| 改进type          | 触发条件                         | auto化程度                       | 产出                                   |
| ----------------- | -------------------------------- | -------------------------------- | -------------------------------------- |
| **Few-shot 收割** | user approval 累积 > 10 条       | 全auto                           | 新增 few-shot example 到 PromptLibrary |
| **Prompt 微调**   | 同类 user_correction > 5 条      | 半auto (生成候选→人工审核)       | Prompt 修改建议                        |
| **模型路由优化**  | cost_anomaly 或 latency_anomaly  | 全auto                           | ModelGateway 路由规则更新              |
| **风控规则调整**  | 连续 false positive 审批 > 10 次 | 半auto (建议→domain_owner confirmation)  | risk阈值调整建议                       |
| **知识库更新**    | quality_drift + 知识源expiry       | 全auto                           | 触发知识源刷新                         |
| **自主权调整**    | 累积绩效data满足晋升条件         | 按 §42 规则                      | 自主权晋升/降级                        |

模型路由优化必须uses `DataResidencyConstrainedOptimization`: 候选 provider, region, cache, fallback 和训练/log用途都先viadata驻留, 客户合同, 模型independent性和合规strategyfilter, 再计算成本或延迟收益. 优化建议不得bypass §15 ModelGateway, §17 EvaluationGate 或 §23 data治理. 

## 56.4 改进候选state机

```text
collected → analyzed → candidate_generated → quarantined
                                  │
                                  ▼
                             eval_pending → eval_passed → approval_pending → rollout_canary → released → rollback_pending → rolled_back
                                  │              │                 │
                                  ▼              ▼                 ▼
                              rejected      rejected          rejected
```

`ImprovementCandidateStateMachine` 与 §16 Prompt Rollout, §17 EvaluationGate, §34 ADR 和 §42 自主权晋升共用同一发布门禁. 任何候选上线前必须lock定输入样本, 评估版本, policy 版本, Prompt/Model/Tool/Domain 版本和审批责任人. 

released 不是不可逆终态. 任何候选发布后必须保留 rollback target, release evidence, impact window 和 automatic rollback metrics; 质量, 成本, 安全, 人工升级率或投诉指标触发阈值时进入 `rollback_pending`, 完成rollback后进入 `rolled_back` 并生成 postmortem. rollback 不得删除原 released 事件, 只追加补偿事实. 

## 56.5 安全护栏

- auto改进**永远不能**放松安全strategy或合规控制
- 全auto改进only限**非risk变更** (few-shot 增加, 路由优化, 知识刷新) 
- 涉及 Prompt 核心逻辑或风控规则的变更必须经人工审核
- 所有auto改进record到 event_log, 可审计可rollback

---

# 57. 外部system集成框架

> 提供标准化连接器框架和预构建连接器目录, 使 Agent 能对接真实业务system. 
> 关联: §14.4 Executor · §11.5 出站控制 · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 连接器抽象

| interface方法                  | 说明                                           |
| ------------------------- | ---------------------------------------------- |
| `connect(config)`         | 建立连接, 传入凭证和端点configure                   |
| `execute(action, params)` | execute指定操作 (CRUD/query/call) , return标准化结果 |
| `healthCheck()`           | 探活检测, return连接state和延迟                   |
| `disconnect()`            | 优雅关闭连接, 释放资源                         |

支持协议: REST / gRPC / MCP / Database (JDBC/ODBC) / File (S3/NFS) / Browser (Headless). 每个连接器附带 `ConnectorManifest`, 声明支持的 action 列表, 认证方式, 速率limit和所需permissions, 供 Toolbelt(§14.4) dynamic发现. 

`ConnectorManifest` 必须contains `ConnectorCapabilityProfile`: 

| field | Description |
| --- | --- |
| actionRiskProfiles | `ActionRiskProfile[]`, 每个 action 的 read/write/delete/payment/egress/irreversible risk, 审批要求和 SideEffect 语义 |
| permissionProbes | `PermissionProbe[]`, 验证identity, scope, 对象级permissions, tenant边界和最小permissions是否仍有效 |
| quotaProbes | 验证外部 API quota, rate limit, concurrent和 provider 熔断state |
| businessCapabilityProbes | 验证关键业务能力是否可用, 例如订单可写, 退款开关, 审批回调, schema 版本 |
| credentialRotationPolicy | `CredentialRotationPolicy`, 与 §11 Secret Lease 对齐的rotation周期, 双写window, 失效检测和auto吊销规则 |

`healthCheck()` 不得只return网络连通性; 必须coverage permission, quota 和 business capability. 任何 action-level profile missing的连接器不得被 ToolbeltAssembler 装配到生产task. 

每个 write action 必须声明 idempotency key semantics, external status query, compensation availability 和 reconciliation timeout. 无法query外部state且无补偿path的 action default risk ≥ high, 并force HITL. 

## 57.2 连接器risk分层

| 连接器type | risk重点 | defaultlimit |
| --- | --- | --- |
| HTTP/REST/gRPC | egress, 认证 scope, 幂等性 | 必须声明 idempotency, retry 和 response schema |
| Database | 大range读写, schema drift, transaction边界 | default read-only; 写入需 action-level 审批和 row/table scope |
| Browser | 视觉误判, 会话劫持, 不可预测 DOM | 隔离 session, 录屏审计, 禁止default保存 credential |
| MCP | 工具能力dynamic暴露, 远端信任边界 | 必须fixed server identity, capability allowlist 和signature manifest |
| File/S3/NFS | dataleaked, path穿越, batch删除 | force content scan, path allowlist, delete threshold approval |

## 57.3 连接器生命周期

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│ (安装)    │     │ (configure)    │     │ (authorization)    │     │ (运行中)  │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                 ┌──────▼─────┐
                                                 │ Monitor    │
                                                 │ (健康监控)  │
                                                 └──────┬─────┘
                                                        │ 异常
                                                 ┌──────▼─────┐
                                                 │ Degrade/   │
                                                 │ Reconnect  │
                                                 └────────────┘
```

## 57.4 预构建连接器目录 (Phase 1) 

| 类别   | 连接器           | 优先级 | 能力                         |
| ------ | ---------------- | ------ | ---------------------------- |
| 通信   | 飞书/企微/钉钉   | P0     | 消息发送, 审批推送, 日历读取 |
| 通信   | 邮件(SMTP/IMAP)  | P0     | 发送, 接收, search             |
| 存储   | 阿里云 OSS / S3  | P0     | 上传, 下载, 列表             |
| 开发   | GitHub/GitLab    | P0     | PR, Issue, 代码search          |
| data库 | MySQL/PostgreSQL | P0     | query, 写入                   |
| 社交   | 微信公众号       | P1     | 消息推送, 菜单manage           |
| 电商   | 有赞             | P1     | 订单query, 商品manage           |
| 财务   | 用友             | P1     | 凭证query, 报表导出           |
| analysis   | 神策             | P1     | 事件query, user画像           |
| 支付   | 支付宝/微信支付  | P2     | 下单, 退款, query             |

## 57.5 Connector SDK

社区和企业内部团队可via Connector SDK 开发自定义连接器, 发布到 Marketplace(§55). 

---

# Part IX — 运营成熟度层 (§59-§69) 

---

# 59. Agent 可解释性与决策透明度架构

> 为每个 Agent 决策构建面向user的因果解释能力, 满足 EU AI Act / GDPR Article 22 合规要求, 并为渐进式自主权(§42)提供信任基础. 
> 关联: §12.7 Tracing · §13 OAPEFLIR · §17 质量门禁 · §23.6 data血缘 · §39 NL entry · §42 渐进式自主权

## 59.1 设计principle

- 每个 OAPEFLIR 循环的每个阶段**必须在决策时**生成 `DecisionRationale` / `StageRationale` record, 不allows事后让 LLM 猜测原因
- 解释按需生成 (lazy) , 不增加正常executepath开销
- 解释深度按领域configure: 金融需要 forensic-level, 客服需要 summary-level
- 解释cached避免duplicate LLM call
- 解释不可tamper, 纳入 Evidence Plane
- 解释必须 permission-aware: 同一 run 对不同查看者可return不同证据可见集, 但不得改变底层不可tamper rationale
- 解释必须distinguish recorded facts, model rationale 和 inferred summary. 界面不得把 LLM 事后渲染的理由当作已record事实; 所有 inferred summary 必须显示 evidence_refs 与置信度. 

## 59.2 解释管线

```text
user问"为什么? "
    │
    ▼
ExplanationRequest { harnessRunId, harnessStepId?, depth }
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← 从 P5 收集决策时冻结的 Rationale + ToolCallLog + KnowledgeCitation
└────────┬────────┘
         ▼
┌─────────────────┐
│ CausalChainBuilder│  ← 构建 Observe→Assess→Plan→Execute 的因果链
└────────┬────────┘
         ▼
┌─────────────────┐
│ ExplanationRenderer│  ← 按 depth 和 locale 渲染为 NL text
└────────┬────────┘
         ▼
ExplanationResponse { summary, causal_chain[], evidence_refs[], confidence }
```

## 59.3 StageRationale data模型

| field                | type            | 说明                                                    |
| ------------------- | --------------- | ------------------------------------------------------- |
| rationaleId         | string          | 唯一标识                                                |
| stageId             | string          | 关联的 OAPEFLIR 阶段 ID                                 |
| decision            | string          | 该阶段做出的决策 (如选择的工具, 生成的方案)             |
| reason              | string          | 决策理由的结构化描述                                    |
| alternatives        | `Alternative[]` | 被放弃的备选方案及放弃原因                              |
| confidence          | number (0-1)    | 决策置信度                                              |
| evidenceRefs        | `string[]`      | 支撑决策的证据references (ToolCallLog, KnowledgeCitation 等)  |
| decisionInputRef    | string          | 决策时冻结的 DecisionInputBundle references                   |
| versionLockRef      | string          | Prompt/Policy/PlanGraph/Tool/Model/Domain 版本lockreferences    |
| visibilityLabels    | `string[]`      | permissionsfilter标签, 解释渲染时按userpermissions裁剪                  |
| renderedExplanation | string (lazy)   | 面向user的自然语言解释, 按需渲染并cached                  |

## 59.4 解释深度分级

| 深度         | 适用场景                 | content                                                  |
| ------------ | ------------------------ | ----------------------------------------------------- |
| L1 Summary   | 非技术user日常查看       | 一句话概述: "因为检测到异常流量, auto扩容了 2 个实例" |
| L2 Reasoning | 业务负责人审查           | 因果链 + 关键data点 + 备选方案                        |
| L3 Forensic  | 合规审计 / Incident 调查 | 完整证据链 + 所有输入output + 知识references + 模型call详情   |

## 59.5 与 NL entry集成

§39 NL 交互管线增加 `why` Intent type: 

user可via自然语言问"上次发布为什么rollback了? ", system解析为 WhyQuery 并call解释管线. 

## 59.6 解释cached与安全

- L1/L2 解释cached TTL = 24h, L3 不cached (确保最新证据) 
- 解释content受 §50 知识域隔离约束 -- 只能看到自己有permissions的证据
- 解释log本身纳入审计(§23), record谁在什么时候查看了什么解释
- L3 forensic 解释必须先via `forensic_explanation_budget` 预留, 超预算时return证据index和分段生成plan, 不得在 incident 期间挤占 P4 execute预算
- 解释渲染器只可based on `versionLockRef` 对应的 Prompt/Policy/PlanGraph 版本工作; 运行后strategy变更不能重写历史解释, 只能追加新版解释视graph

---

# 60. 紧急制动与globally熔断架构

> 提供单一原子操作快速阻断entry并使Execution Plane进入silently, used for安全事件, Prompt injection 攻击, Agent 逃逸等紧急场景. 
> 关联: §9 稳定性 · §10 risk控制 · §11 安全 · §12 异常事件 · §52 多 Region

## 60.1 PlatformPanicDirective

| field              | type                     | 说明                                               |
| ----------------- | ------------------------ | -------------------------------------------------- |
| directiveId       | string                   | 指令唯一标识                                       |
| severity          | full / partial           | full = 全平台停止; partial = 限定range停止          |
| scope             | global / tenant / domain | 熔断生效range                                       |
| reason            | string                   | 触发原因 (安全事件描述)                            |
| issuedBy          | string                   | 发起人identity                                         |
| requiredApprovers | string[] (min 2)         | 双人审批要求, 防止单点误操作                       |
| reconfirmationAfterSeconds | number          | 到期后触发重新confirmation提醒, 不auto解除熔断             |
| rollbackStrategy  | freeze / graceful_drain  | freeze 立即冻结; graceful_drain 等待运行中step完成 |

Platform Panic default无限期生效. `reconfirmationAfterSeconds` 只触发重新confirmation, 升级提醒和证据快照刷新, 不得auto解除熔断; 恢复必须via §60.3 `PlatformResumeDirective` 且满足双人审批. 

## 60.2 熔断传播机制

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: reject所有新request(503), 关闭 WebSocket
    │
    ├──▶ P2 Control Plane: 撤销所有 active Agent token
    │
    ├──▶ P3 Orchestration Plane: 挂起所有 in-flight HarnessRun 与 OAPEFLIR 投影更新
    │
    ├──▶ P4 Execution Plane: 中止新 side effect, 对 ambiguous side effect 做 reconciliation, 支持时execute compensation
    │
    ├──▶ P5 State Plane: 生成 ForensicSnapshot, 设置 read-only 模式
    │
    └──▶ X1 Fabric: 阻断所有 egress, 触发告警到所有渠道
```

**SLA**: split为两个指标: `ingress_block_time < 5s` (同 Region) / `<15s` (跨 Region) ; `execution_quiescence_time` 按部署形态定义, D1 < 10s, D2 < 30s, D3/S4 < 120s. 不得把entry阻断和所有 worker 已停止混为一个指标. 

每个平面必须return `PanicAcknowledgment`: 

| field | Description |
| --- | --- |
| directiveId | 对应 PlatformPanicDirective |
| plane | P1 / P2 / P3 / P4 / P5 / X1 |
| status | ack / failed / timeout |
| localStopState | 本平面实际停止range与未完成项 |
| timestamp | confirmation时间 |
| evidenceRef | local取证快照或logreferences |

若任一平面 failed / timeout, 必须生成 `panic_incomplete` P0 incident, 并触发基础设施级 kill, 网络隔离或凭证吊销等外部止血动作. 

## 60.3 安全恢复协议

| step | 操作                         | 要求                                               |
| ---- | ---------------------------- | -------------------------------------------------- |
| 1    | ForensicSnapshot 审查        | 安全团队confirmation威胁已消除                             |
| 2    | PlatformResumeDirective 发布 | 需要 ≥ 2 名 platform_admin 双人审批                |
| 3    | 渐进恢复                     | 先恢复 read-only query → 低risk workflow → 全面恢复 |
| 4    | 事后报告                     | 72h 内发布 Post-Incident Report                    |

**Admin 不可用降级方案**: 若 platform_admin 不足 2 人在线超过 4 小时, 启用以下降级恢复path: 

1. system向所有 platform_admin 发送多渠道紧急notification (短信 + 电话 + 企微/飞书/钉钉) 
2. 超过 4h 无response, authorization `break_glass` 机制 -- arbitrary 1 名 platform_admin + 1 名 security_team 成员组合审批可替代双 admin 审批
3. 超过 8h 仍无response, 只allows恢复 forensic / monitoring / read-only inspection; 禁止新 workflow, 写操作, 外部 side effect 和 policy 放松, 完整恢复仍需双人审批
4. 所有 `break_glass` 恢复操作record为 P0 级审计事件, 72h 内必须补充 platform_admin 复核

## 60.4 定期演练

- 每季度至少一次紧急制动演练 (选定 tenant range) 
- 演练结果纳入 §36 success标准
- 演练期间产生的 ForensicSnapshot used for验证取证integrity
- 每次演练output `PanicDrillReport`, 至少contains ingress_block_time, execution_quiescence_time, egress_block_time, credential_revoke_time, plane_ack_success_rate, manual_recovery_time 和 unresolved_findings. 

---

# 61. Agent 统一生命周期manage架构

> 将 Agent 建模为一等实体 -- Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config 的复合体, manage从创建到退役的完整生命周期. 
> 关联: §16 Prompt · §30 Pack · §42 渐进式自主权 · §41 主动式 Agent · §55 Marketplace

## 61.1 AgentDefinition 复合实体

AgentDefinition 是 Agent 的完整定义, 由以下组件复合而成: 

| 组件              | 来源               | 说明                                    |
| ----------------- | ------------------ | --------------------------------------- |
| Pack              | §30 Business Pack  | 业务域能力包                            |
| PromptSet         | §16 Prompt Library | Planner/Generator/Evaluator Prompt 集合 |
| ModelBinding      | §15 ModelGateway   | 模型路由configure (主模型 + fallback)        |
| TrustProfile      | §42 渐进式自主权   | 信任等级与自主权configure                    |
| TriggerPolicy     | §41 主动式 Agent   | 触发条件与调度strategy                      |
| ConnectorBindings | §57 连接器框架     | 绑定的外部system连接器                    |

AgentDefinition 按版本不可变 -- 任何组件变更都产生新的 AgentVersion. 

## 61.2 AgentVersion 快照

| field           | type                                           | 说明                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| versionId      | string                                         | 版本唯一标识                          |
| agentId        | string                                         | 所属 Agent ID                         |
| definition     | AgentDefinition (snapshot)                     | 该版本的完整定义快照, 不可变          |
| status         | draft / testing / staging / canary / active / paused / deprecated / archived / removed | 版本state, 详见 §61.3 state机 |
| compatibilityMatrix | `ComponentCompatibilityMatrix`           | Pack, Prompt, Model, Tool, Policy, Domain, Eval, connector action schema 版本compatibility性 |
| publishedAt    | timestamp                                      | 发布时间                              |
| publishedBy    | string                                         | 发布者identity                            |
| rollbackTarget | versionId?                                     | rollback目标版本, used for一键复合rollback(§61.4) |

## 61.3 生命周期state机

```text
draft ◀──▶ testing ◀──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived ──▶ removed
```

| 转换                | 触发条件          | 门禁                                 |
| ------------------- | ----------------- | ------------------------------------ |
| draft→testing       | 开发者提交        | 所有组件版本lock定                     |
| testing→staging     | testingvia          | §17 质量门禁 + 安全扫描              |
| staging→canary      | 预发布审批        | 域manage员审批                         |
| canary→active       | 灰度指标达标      | auto晋升 (error率 < 阈值 + 性能达标)  |
| active→paused       | 手动/auto暂停     | 行为drift检测(§63)触发或手动操作      |
| paused→active/canary | 恢复运行          | resume revalidation: 重新评估 trust, policy, DomainDescriptor, Connector permissions, budget 与 incident state |
| active→deprecated   | 版本替代/业务变更 | 责任转移到新版本完成                 |
| deprecated→archived | TTL expiry          | 所有历史references标记为 archived          |
| archived→removed    | cleanup资源          | 无 critical business dependency, 迁移门槛达成, 只读导出可用 |

## 61.4 复合灰度发布

Agent 灰度以 AgentVersion 为单位 (非单组件) : 

- **流量分割**: canary 版本接收 5%→20%→50%→100% 流量
- **复合rollback**: 一键fallback到上一个 AgentVersion (所有组件原子fallback) 
- **比较testing**: 对同一输入同时运行两个 AgentVersion, 比较output差异

## 61.5 Agent 退役与责任转移

| 阶段      | 动作                                   | 时间要求      |
| --------- | -------------------------------------- | ------------- |
| deprecate | 标记版本为 deprecated, 发布废弃notification    | T+0           |
| notify    | notification所有下游消费者和dependency方             | T+0 ~ T+7d    |
| migrate   | 将进行中task迁移到替代 Agent/版本      | T+7d ~ T+25d  |
| transfer  | 转移知识资产, 历史上下文到继任者       | T+25d ~ T+28d |
| archive   | 冻结execute能力, 保留只读历史data         | T+30d         |
| delete    | clearruntime资源, 历史data按保留strategy保留 | T+30d+        |

force **30 天废弃window期**, 期间旧版本仍可handle存量task, 确保业务连续性. 

关键业务 Agent 不allows从 `deprecated` directly进入 `removed`. 必须先完成迁移报告: 下游dependency清单, 未完成 run handle方式, 替代版本验证结果, rollbackwindow, 业务负责人签核和data保留strategy. 

---

# 62. 离线与边缘部署架构

> 支持工厂车间, 零售门店, 移动设备等间歇连接场景下的 Agent execute, 以local优先+最终synchronous模式运行. 
> 关联: §15 ModelGateway · §32 部署 · §52 多 Region · §10 risk控制

## 62.1 EdgeRuntime 最小化runtime

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime (local设备/门店服务器)           │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │P3-Lite   │  │P4-Lite   │  │P5-Local││
│  │Orchestr. │  │Execution │  │State   ││
│  └──────────┘  └──────────┘  └────────┘│
│  ┌──────────┐  ┌──────────┐            │
│  │LocalModel│  │SyncQueue │            │
│  │(sLLM)   │  │(offline) │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
         ▲ 连接恢复时 ▼
┌─────────────────────────────────────────┐
│  Central Platform (Cloud)               │
│  P1 + P2 + P3 + P4 + P5 + X1           │
└─────────────────────────────────────────┘
```

## 62.2 离线execute约束

| 约束       | 说明                                                            |
| ---------- | --------------------------------------------------------------- |
| riskupper limit   | 离线模式只allowsexecute risk_level ≤ medium 的动作                   |
| 模型降级   | useslocal sLLM (如 Qwen-7B/Llama-3-8B) , 不call云端 ModelGateway |
| 副作用排队 | 所有 side effect 写入local SyncQueue, 连接恢复后batch提交         |
| 审批挂起   | 需要审批的step进入 pending state, 等待连接恢复                   |
| cachedplan   | EdgeRuntime 定期从 Central 预拉取 PlanGraphBundle 模板          |
| 设备identity   | 每台设备必须有硬件/软件绑定 device identity, 证书吊销后禁止synchronous |
| local加密   | Secret, PII, PHI 和 SyncQueue 在local磁盘加密, 密钥受租约和远程吊销控制 |
| tamper防护   | 支持 secure boot / attestation 的设备必须启用; 不支持时降级为 read-only 或低risk模式 |
| 离线时长   | 每个 EdgeRuntime 必须声明 offline max duration; 超过后只读或冻结 |
| 密钥租约   | local key lease 到期后禁止继续execute写动作; 恢复连接前必须重新 attestation 和吊销check |

## 62.3 synchronous协议

**conflict解决principle**: Central state为权威源; 离线期间的 side effect 如与 Central conflict, default Central wins + 生成 Incident 供人工审查. 

SyncQueue 必须是 signed append-only queue, 每条recordcontains `device_id`, `sequence_no`, `prev_hash`, `side_effect_dependency_refs`, `signature` 和 `local_time_offset`. 恢复连接后按 side effect dependency graph 拓扑提交; dependency未confirmation的subsequent副作用保持 pending, 不得乱序提交. 

模型, Prompt, 规则和连接器 manifest 的边缘更新必须signature, 支持 staged rollout 和 rollback. Central 可下发 `remote_wipe` 或 `edge_quarantine` 指令; 设备在重新上线时必须先execute吊销check, 再上传业务变更. 

## 62.4 部署模式

| 模式          | 硬件要求                | 适用场景                 |
| ------------- | ----------------------- | ------------------------ |
| Edge-Micro    | ARM/x86 单板机, 4GB RAM | 零售门店 POS, IoT 网关   |
| Edge-Standard | 8C/32GB 服务器          | 工厂车间, 仓库           |
| Edge-Mobile   | iOS/Android App         | 移动外勤, 现场服务       |
| Hybrid        | local GPU 服务器         | 需要local推理的高吞吐场景 |

---

# 63. Agent 行为drift检测架构

> 超越单维度质量指标, 建立多维行为画像和长周期变点检测, 在 Agent 行为渐变导致业务risk前发出预警. 
> 关联: §17 质量门禁 · §42 渐进式自主权 · §43 看板 · §56 反馈改进

## 63.1 行为fingerprinting模型

| field                    | type                 | 说明                                        |
| ----------------------- | -------------------- | ------------------------------------------- |
| agentId                 | string               | 目标 Agent                                  |
| window                  | 1h / 7d / 30d / 90d  | fingerprinting统计window                                |
| tool_usage_distribution | `Map<toolId, ratio>` | 工具call分布, 检测工具偏好drift              |
| avg_step_count          | number               | 平均step数, 检测复杂度changes                  |
| avg_cost                | number               | 平均成本, 检测成本异常                      |
| success_rate            | number (0-1)         | success率                                      |
| risk_distribution       | `Map<level, ratio>`  | risk等级分布                                |
| driftScore              | number (0-1)         | 当前window与基线的综合drift分数, >0.7 触发告警 |

## 63.2 变点检测引擎

| window     | 检测算法                    | 灵敏度 | 用途                            |
| -------- | --------------------------- | ------ | ------------------------------- |
| 1h 滑窗  | Z-Score 异常检测            | 高     | 突变 (模型更新, Prompt 变更后)  |
| 7d 滑窗  | CUSUM                       | 中     | 短期趋势 (知识库变更影响)       |
| 30d 滑窗 | Bayesian Online Changepoint | 中     | 月度drift (业务环境changes)         |
| 90d 滑窗 | Drift Distance (KL/JS 散度) | 低     | 长期基线偏移                    |

MVP 只forceimplementation简单阈值和趋势指标: `success_rate_drop`, `override_rate_spike`, `cost_spike`, `tool_usage_shift`, `incident_count`. CUSUM, Bayesian Online Changepoint, KL/JS 等高级统计属于 Hardening/Enterprise, 不得blocks MVP. 

所有阈值必须声明样本量, 分布假设和false positivehandlestrategy; 不得把“偏移 > 2σ”作为非正态业务data的唯一success标准. driftresponsedefault先告警, 降速或要求人工复核; auto降级必须考虑业务连续性和 SLA. 

## 63.3 driftresponsestrategy

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → record到 §43 看板, 标记 "drift_warning"
    │
    ├── severity=medium → require_review + 降速/建议模式, default不directly降级
    │
    └── severity=high → 暂停 Agent(§61 paused) + 触发 Incident(§12) + 要求人工审查
```

## 63.4 跨 Agent 异常检测

同一 DomainDescriptor 下的多个 Agent 形成对照组. 当一个 Agent 的行为fingerprinting与对照组显著偏离时, 即使该 Agent 自身没有触发单 Agent 阈值, 也应发出 `CrossAgentDriftAlert`. 

防博弈要求: 行为fingerprinting必须distinguish真实usertask, 合成评测task和低价值“保活”task; TrustScore, drift基线和晋升统计不得由未验证的假task单独推动. 

---

# 64. 成本归因与优化引擎

> 在 §18 成本计量的基础上, 增加决策级成本归因, auto优化建议, What-if 仿真, 使成本data从"可看"变为"可行动". 
> 关联: §18 成本manage · §15 ModelGateway · §43 看板 · §54 SLA

## 64.1 决策级成本归因

| field         | type                           | 说明                                        |
| ------------ | ------------------------------ | ------------------------------------------- |
| decisionId   | string                         | 关联的 HarnessDecision ID                   |
| llmCost      | number                         | 该决策产生的 LLM call费用                   |
| toolCost     | number                         | 外部工具/API call费用                       |
| computeCost  | number                         | 计算资源 (Worker 时间) 费用                 |
| storageCost  | number                         | artifact, event, projection, checkpoint 存储费用 |
| egressCost   | number                         | 跨 Region / 外部网络传输费用                |
| humanReviewCost | number                      | 审批, 复核, 审核员handle成本                  |
| totalCost    | number                         | 各项之和                                    |
| attributedTo | agent / tenant / domain / task | 成本归属维度, 支持多维下钻                  |
| qualityRisk  | low / medium / high            | 该决策的质量risk标记, used for成本-质量权衡analysis |

成本事实来源是 §18 `BudgetReservation`, settlement 和 release record; 指标聚合不得directly从 provider 发票反推单次 run 成本. `totalCost = llm + tool + worker + storage + egress + human_review`. 

## 64.2 auto优化建议

| 建议type       | 检测条件                             | 建议content                               | 预期节省 |
| -------------- | ------------------------------------ | -------------------------------------- | -------- |
| ModelDowngrade | 低risk step uses高端模型             | 切换到 cost_optimized 路由             | 30-60%   |
| CacheHit       | 相同 query duplicatecall                  | 启用 ExactPromptCache; SemanticCache only限人工批准安全域 | 40-80%   |
| TokenTrim      | 平均 input_tokens > 4x output_tokens | 优化 Prompt 或启用 context compression | 20-40%   |
| BatchMerge     | 多个independent step 可合并                 | 合并为单次 LLM call                    | 50-70%   |
| ScheduleShift  | 非紧急task在高峰时段execute             | 调度到低成本时段                       | 10-30%   |

## 64.3 What-if 成本仿真

支持对以下变更场景进行成本影响模拟: 

| 仿真场景    | 输入参数                    | output                         |
| ----------- | --------------------------- | ---------------------------- |
| 模型切换    | 目标模型, 适用 step range    | projectedCost, 质量影响预估  |
| Prompt 变更 | 新 Prompt 的 token lengthchanges | token 成本changes, call次数影响 |
| 工具替换    | 替代工具及其单价            | 工具成本差异, 延迟影响       |
| concurrent量调整  | 目标concurrent数                  | 计算资源成本, 排队时间changes   |

每次仿真output `projectedCost`, `qualityImpact`, `qualityRisk`, `slaImpact`, `regressionTestRequirement` 和 `recommendation` (建议 / 不建议 / 需进一步验证) . 

所有auto优化建议都必须受 policy, data residency, quality gate, SLA 和合规约束. What-if outputonly为 advisory, 不得directly修改 ModelGateway 路由, Prompt, Tool 或预算configure; 上线仍走 §16/§17/§24/§56 的发布门禁. 

## 64.4 成本看板集成

§43 统一运营看板增加 "Cost Intelligence" 面板: 

- 本月 Top 10 高成本 Agent / Domain / Workflow
- 可行动的节省机会 (按预期节省额sort) 
- 成本趋势与预算对比
- What-if 仿真entry

---

# 65. 工作流可视化调试器架构

> 为运行中/已完成的工作流提供可视化调试和check能力, 支持实时execute跟踪, OAPEFLIR 步入调试, 时间旅行回放. 
> 关联: §12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow 构建器 · §59 可解释性

## 65.1 调试器能力矩阵

调试器按成熟度分三档: 

| 档位 | 能力边界 | 上线阶段 |
| --- | --- | --- |
| Debug Lite | timeline, evidence inspect, rationale 查看, 只读log | MVP/Hardening |
| Debug Pro | Trace Replay, run compare, side effect diff, regression 标记 | Hardening |
| Debug IDE | replay breakpoint, replay variable inspect, step_replay, 变量check | Enterprise, only replay sandbox |

| 能力          | 运行中 Workflow | 已完成 Workflow | 说明                                          |
| ------------- | --------------- | --------------- | --------------------------------------------- |
| execute时间线    | ✓ (实时)        | ✓               | 每个 step 的开始/结束/state可视化              |
| OAPEFLIR 步入 | ✓               | ✓               | 展开单个 step 查看 O/A/P/E/F/L/I/R 各阶段详情 |
| data流视graph    | ✓               | ✓               | step 间的输入/outputdata流                      |
| 副作用 Diff   | ✗               | ✓               | 预期副作用 vs 实际副作用对比                  |
| 断点调试      | ✗               | sandbox only    | only Replay Sandbox 支持, 不暂停生产 run        |
| 时间旅行      | ✗               | ✓               | based on Trace Replay 重建, 不重写真相            |
| 运行对比      | ✗               | ✓               | 两次运行的并排对比                            |

## 65.2 实时execute流

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← 当前execute位置│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR 展开│                             │
│              │ O: 收集到 3 个信号                          │
│              │ A: risk评分 0.4 (medium)                    │
│              │ P: 选择方案 B (理由:...)                     │
│              │ E: ▶ execute中...                              │
│              └─────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 65.3 ReplaySandbox Breakpoint API

断点 API 只属于 ReplaySandbox / Debug IDE, 不作used for生产 HarnessRun. 

| 断点type | Description | 操作 |
| --- | --- | --- |
| replay-step | 在 replay 的指定 PlanGraph node / HarnessStep 处停止 | set / remove / list |
| replay-condition | replay evidence 满足条件时停止 (on error / risk ≥ 阈值 / cost ≥ 阈值)  | set(condition) / remove |
| replay-variable | only观察 sandbox 中的变量或 context diff | inspect / diff |

断点命中后只有 sandbox session 进入 paused, via WebSocket 推送 `breakpoint_hit` 事件. 调试者可check ContextSnapshot 后execute `resume_replay`, `step_replay` 或 `abort_replay`; 这些操作不得修改 production truth, 不得触发真实 Tool/LLM/SideEffect, 也不得改变原 HarnessRun state. 

生产 run 只支持 `inspect`, `safe_pause_request` 和 `abort_request`, 且必须走 §6 canonical control API, §21 HITL / §47 审批和审计. 生产 run 不支持断点命中暂停, 交互式单步, 变量观察点或变量热修改. Debugger permissions等同高敏证据访问: 必须双因素认证, 最小permissions, 短期 session, full审计和导出水印. 任何 re-execution replay 都必须运行在 ReplaySandboxPolicy 下, 真实外部 side effect 被force替换为 mock/recorded adapter. 

## 65.4 运行对比

支持两次 HarnessRun 的并排对比analysis: 

| 对比维度      | 说明                              |
| ------------- | --------------------------------- |
| step diff     | step数量, order, 新增/missingstep     |
| decision diff | 每个 step 的 HarnessDecision 差异 |
| cost diff     | 各阶段及总成本对比                |
| duration diff | 端到端耗时及各 step 耗时对比      |
| outcome diff  | 最终结果差异, 质量评分差异        |

支持回归检测: 当新版本的关键指标劣于旧版本时auto标记 `regression_detected`. 

---

# 66. 合规报告auto生成引擎

> 将平台收集的证据auto组装为审计就绪的合规报告, 支持 SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS 等多框架. 
> 关联: §23 合规 · §49 分部门合规 · §12 异常事件 · §50 知识隔离

## 66.1 报告模板注册

| field                | type                             | 说明                                          |
| ------------------- | -------------------------------- | --------------------------------------------- |
| templateId          | string                           | 模板唯一标识                                  |
| framework           | GDPR / SOC2 / SOX / HIPAA / PIPL | 对应合规框架                                  |
| version             | semver                           | 模板版本, 框架更新时synchronous迭代                  |
| sections            | `Section[]`                      | 报告章节定义 (控制点映射 + 证据要求)          |
| requiredDataSources | `string[]`                       | 所需data源 (audit_log / metrics / config 等)  |
| outputFormat        | PDF / HTML / JSON                | 支持的output格式                                |
| lockedOnGeneration  | boolean                          | 生成后lock定模板快照, 确保审计可追溯            |
| reportVersionLock   | `ReportVersionLock`              | lock定 schema, policy, data snapshot, template, renderer 版本 |

`ComplianceTemplateRegistry` 必须额外保存 legal_version, change_source, effective_date 和 migration_rule. 法律或框架变更不得只更新模板text; 必须生成影响analysis, 迁移task和旧报告适用性说明. 

## 66.2 报告生成管线

```text
ScheduledTrigger / OnDemandRequest
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← 从 P5, 审计log, configure快照, metrics 收集证据
└────────┬────────┘
         ▼
┌─────────────────┐
│ ControlMapper   │  ← 将证据映射到控制点, 标记 pass/fail/partial
└────────┬────────┘
         ▼
┌─────────────────┐
│ GapAnalyzer     │  ← 识别证据不足的控制点, 生成补救建议
└────────┬────────┘
         ▼
┌─────────────────┐
│ ReportRenderer  │  ← 按框架模板生成 PDF + CSV + JSON
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```

报告auto生成不等于合规confirmation. `ComplianceReport` 进入 `generated` 后必须经过 `HumanSignoff` 才能标记为 `attested` 或对外提供. 报告同时output `EvidenceQualityScore` (integrity, freshness, 来源可信度, 不可tamper性) 和 `ControlCoverageReport` (pass/fail/partial/not_applicable, 证据missing口, 补救 owner) . 

`HumanSignoff` 必须声明 `signoff_due_at`, escalation owner 和 timeout action. 超expiry限仍停留在 `generated` 的报告进入 `signoff_overdue`, auto提醒责任人并升级给 compliance owner; 超过最大等待window后标记 `not_attested_expired`, 不得对外发布为已confirmation报告. 

Evidence control mapping 必须机器可验证: 

| field | Description |
| --- | --- |
| controlId | 合规控制点 ID |
| evidenceType | audit_log / metric / config_snapshot / approval / report / artifact |
| freshness | 证据最大allows年龄和实际采集时间 |
| owner | 证据责任人或system owner |
| exception | 例外, 补偿控制和expiry时间 |

## 66.3 报告type与频率

| 框架         | 频率 | range   | 典型消费者     |
| ------------ | ---- | ------ | -------------- |
| SOC2 Type II | 季度 | 全平台 | 审计师 / 客户  |
| SOX 302/404  | 季度 | 财务域 | CFO / 外部审计 |
| HIPAA        | 月度 | 医疗域 | HIPAA Officer  |
| GDPR         | 月度 | 全平台 | DPO            |
| PCI-DSS      | 季度 | 支付域 | QSA            |
| ISO 27001    | 半年 | 全平台 | CISO           |

## 66.4 审计员只读访问

审计员via `AuditorAccess` 获得受限只读视graph: 

- **可见range**: runs / decisions / evidence / compliance reports, 按 tenant + timeRange + framework filter
- **permissions控制**: only read 操作, 无法修改, 删除或导出原始data
- **PII 保护**: returndata经过 §23 data分级check, 未via分级审核的fieldautosanitized
- **审计追踪**: 审计员的每次query操作本身纳入审计log(§23), recordquery人, 时间, range
- **最小permissions**: AuditorAccess 按 framework, tenant, timeRange, controlId 和 evidence type authorization, default不可见业务原文, secret, PHI 和跨tenant证据
- **版本冻结**: 已签核报告只能追加补充说明或勘误, 不得原地coverage; 重新生成必须产生新 report version

---

# 67. 容量规划与成本预测引擎

> based on历史趋势的预测性容量建模, 支持扩容时机建议, 成本趋势预测和 What-if 容量仿真. 
> 关联: §18 成本 · §27 SLO · §43 看板 · §54 SLA · §64 成本优化

## 67.1 资源维度追踪

| 维度              | 采集来源           | 预警阈值               |
| ----------------- | ------------------ | ---------------------- |
| Worker concurrent数     | P4 Execution Plane | 当前容量 80%           |
| 存储用量          | P5 State Plane     | 当前容量 85%           |
| LLM Token 消耗/日 | §18 CostTracker    | 月度预算 70%           |
| API QPS           | P1 Interface Plane | 当前容量 75%           |
| Event Log 增长率  | P5 Event Store     | 存储容量 80%           |
| 队列深度          | P4 Fair Queue      | 平均等待时间 > SLA 50% |

## 67.2 预测模型

MVP 容量规划不dependency高级预测模型, 只force五项能力: threshold alert, trend projection, queue depth forecast, provider quota monitor, failover capacity reserve. 复杂预测准确率指标属于 Hardening/Enterprise 验收, 不得作为 MVP 出口条件. 

| 预测目标     | 算法                         | 预测周期       |
| ------------ | ---------------------------- | -------------- |
| Token 消耗量 | 线性回归 + 季节性分解        | 7d / 30d / 90d |
| 计算资源用量 | 线性回归 + 季节性分解        | 7d / 30d / 90d |
| 存储增长     | 指数平滑 + 容量upper limit外推      | 30d / 90d      |
| concurrent运行需求 | 峰值回归 + 工作日/节假日校正 | 7d / 30d       |

预测结果auto输入 §67.1 预警阈值判断, 当预测值在预测周期内将突破容量阈值时生成 `CapacityAlert`. 

容量建议必须同时check SLA Tier, 队列延迟, budget, approval capacity, provider quota 和 Region failover reserve. Enterprise SLA tenant admission 必须把 N+1 / failover capacity reserve 作为硬门禁; 任一关键 provider quota 接近upper limit时, system生成降级/限流建议, 而不是只扩 Worker. 

每个预测window结束后必须record forecast vs actual: 误差, 低估/高估方向, 触发的扩容动作和业务影响. 连续两个window超过误差阈值时, ForecastModel 进入 `needs_recalibration`, 容量建议降级为人工复核, 不得继续auto扩容或auto收缩. 

## 67.3 What-if 容量仿真

支持对以下场景进行容量影响模拟: 

| 仿真场景        | 输入参数                    | output                                 |
| --------------- | --------------------------- | ------------------------------------ |
| 新tenant上线      | 预估用量, SLA Tier          | 所需额外容量, 成本增量               |
| 流量尖峰        | 峰值倍数, 持续时间          | bottleneck资源, 扩容建议                   |
| Region 故障切换 | 失效 Region, 流量迁移比例   | 目标 Region 剩余容量, 是否需要预扩容 |
| 模型迁移        | 新模型 token 效率, 延迟changes | Token 消耗changes, Worker concurrent影响      |

每次仿真output `requiredCapacity`, `estimatedCost`, `bottleneckWarnings`. 

## 67.4 财务预算支持

- 月度成本趋势报告 (实际 vs 预算 vs 预测) 
- 季度容量规划建议 (面向财务团队审批预算) 
- 年度 TCO 预测 (含硬件 + LLM API + 人力成本) 

---

# 68. 多模态能力架构

> 扩展 ModelGateway 支持graph像, 语音, 文档等多模态输入/output, 使平台能承接素材制作, 客服graph片handle, 语音交互等场景. 
> 关联: §15 ModelGateway · §26 存储 · §37 业务域 · §39 NL entry

## 68.1 多模态 ModelGateway 扩展

在 §15 ModelGateway 基础上扩展多模态能力: 

- **模态检测**: auto识别request中contains的输入模态 (text / image / audio / video / document) 
- **能力路由**: 根据所需模态auto选择支持该模态的 Provider (详见 §68.3 ModalityRouter) 
- **格式转换**: 输入/output在 Provider 间格式inconsistent时auto转换 (如 base64 ↔ URL ↔ binary) 
- **Fallback 链**: 多模态 Provider 不可用时按 §68.3 Fallback configure降级

## 68.2 多模态 ModelRequest 扩展

在标准 ModelRequest 基础上增加多模态field: 

| field             | type            | 说明                                          |
| ---------------- | --------------- | --------------------------------------------- |
| inputModalities  | `string[]`      | requestcontains的输入模态列表                        |
| outputModalities | `string[]`      | 期望的output模态列表                            |
| contentParts     | `ContentPart[]` | 混合content块 (text + image + audio 可交错排列)  |

每种模态independentexecute安全check (§68.4) , 任一模态未viacheck则整个requestreject. 

`ContentPart` schema: 

| field | Type | Description |
| --- | --- | --- |
| partId | string | content块唯一标识 |
| modality | text / image / audio / video / document | 模态 |
| text | string? | onlyallows小段text内联 |
| artifactRef | string? | 二进制或large object必须references §26 Artifact, 不得内联 base64 |
| mimeType | string | 媒体type |
| provenance | `ProvenanceMetadata` | 来源, 生成方式, C2PA/水印, 许可证, hash |
| safetyLabels | `string[]` | content安全扫描标签 |
| costKey | string | modality cost ledger 计费键 |

## 68.3 ModalityRouter

| 模态             | default Provider                 | Fallback                       | 成本模型      |
| ---------------- | ----------------------------- | ------------------------------ | ------------- |
| Text LLM         | GPT-4o / Claude               | Qwen / DeepSeek                | per-token     |
| Image Analysis   | GPT-4o Vision / Claude Vision | Qwen-VL                        | per-image     |
| Image Generation | DALL-E 3 / Midjourney API     | Stable Diffusion (self-hosted) | per-image     |
| Speech-to-Text   | Whisper API                   | Paraformer (self-hosted)       | per-minute    |
| Text-to-Speech   | Azure TTS / ElevenLabs        | CosyVoice (self-hosted)        | per-character |
| Document Parse   | Document Intelligence         | Marker / Docling (self-hosted) | per-page      |

## 68.4 多模态安全

- graph像输入经过 content moderation (色情/暴力/敏感信息检测) 
- 生成graph像附带 C2PA 元data水印
- 语音输入 PII 检测 (电话号码, identity证号autosanitized) 
- 文档解析结果受 §50 知识域隔离约束
- 视频, 音频, graph像, 文档分别uses modality-specific guardrails, 不得复用text安全阈值
- 所有生成或转换后的二进制output先写 Artifact Store, 经安全扫描, provenance 写入和成本结算后再return artifact_ref

`ModalitySafetyResult` schema: 

| field | Description |
| --- | --- |
| labels | 检出的安全标签 |
| confidence | 每个标签的置信度 |
| provider | 安全check provider / model |
| policyDecision | allow / filter / escalate / deny |
| appealPath | 申诉或人工复核path |

## 68.5 多模态成本追踪

§18 CostTracker 扩展 `modality` 维度: 

| field | Description |
| --- | --- |
| modality | text / image / audio / video / document |
| unit | token / image / second / minute / page / byte |
| providerCost | provider 原始计费 |
| processingCost | 转码, OCR, 向量化, 安全扫描成本 |
| storageCost | Artifact 存储与出站成本 |

---

# 69. 平台自ops Agent 架构

> 平台uses自身 Agent 能力进行自我ops (dog-fooding) , coverage Incident auto诊断, 常见故障自修复, configure优化建议, 开发者问答. 
> 关联: §12 异常事件 · §14 Execution · §37 业务域 · §41 主动 Agent · §43 看板

## 69.1 PlatformOps DomainDescriptor

平台自ops作为一个特殊业务域注册到 §37 域框架: 

| field          | 值                                                                  |
| ------------- | ------------------------------------------------------------------- |
| domain        | `platform_ops`                                                      |
| riskProfile   | high (涉及生产环境写操作)                                           |
| tools         | `metrics_query`, `config_patch`, `restart_service`, `scale_replica` |
| evalFramework | SLO-based (以 §27 SLO 达成率作为 Agent 表现评估标准)                |
| autonomy_cap  | 只读操作最高 auto; 写操作最高 supervised (§42)                      |

PlatformOps 必须explicitly声明 ops data boundary: 只能读取平台opsdata (metrics, logs, traces, config, deployment, incident, capacity) , default不can read取业务 payload, 客户原文, PHI/PII 或跨tenant证据. 需要关联业务证据时只读取sanitized摘要和 evidence_ref. 

## 69.2 自ops Agent 目录

| Agent             | 触发条件            | 能力                             | 自主权upper limit  |
| ----------------- | ------------------- | -------------------------------- | ----------- |
| IncidentDiagnoser | Incident 创建事件   | 收集log, analysisRoot Cause, 生成诊断报告 | semi_auto   |
| ConfigOptimizer   | 每周定时 + 性能偏离 | analysisconfigure, 建议优化, 估算影响     | supervised  |
| CapacityPredictor | 每日定时            | analysis趋势, 预测bottleneck, 建议扩容     | supervised  |
| DevAssistant      | 开发者提问          | query文档, search代码, 生成示例     | semi_auto   |
| HealthMonitor     | 连续运行            | 巡检平台健康, 生成日报           | auto (只读) |

## 69.3 安全护栏

- 所有生产环境写操作**必须**经过人工审批
- PlatformOps Agent 的 ModelGateway call有independent的 cost budget 和 rate limit
- PlatformOps Agent 不能访问业务域data, 只能访问平台opsdata
- PlatformOps Agent 的所有操作纳入independent审计流(§23), 与业务审计隔离
- default read-only; `config_patch`, `restart_service`, `scale_replica`, `failover` 等写动作必须绑定 runbook, 审批, blast radius 和 rollback plan
- 自ops不得成为唯一恢复path. 每个 P0/P1 平台故障必须有 out-of-band recovery runbook, 可在 Chat, Agent, ModelGateway 或 P1/P3/P4/P5 任一平面不可用时由人工和基础设施Control Planeexecute

## 69.4 自ops成熟度等级

| 等级 | Description | 验收边界 |
| ---- | ---- | -------- |
| L0   | 纯手动ops, Agent only辅助文档query | 不接触生产Control Plane |
| L1   | Agent 生成诊断报告, 日报, 容量趋势和只读问答 | 不execute生产写操作 |
| L2   | Agent 生成修复方案, configure补丁候选并预execute验证 | 人工审批后由标准变更systemexecute |
| L3   | Agent autohandle受限 P3/P4 级别问题 | only known-runbook, 低爆炸半径, 可rollback动作, 且需事后复核 |

初始部署从 L0 开始, basis §42 渐进式自主权逐步晋升. 

---

# Part X — 落地路线与汇总 (§33-§36) 

---

## 三环实施优先级 (Three-Ring Implementation Priority) 

v4.2 将历史大平台蓝graph收敛为 MVP / Hardening / Enterprise 三个生产交付环, 明确"先做最小生产闭环 → 再做运行加固 → 最后做企业扩张". 三环是 §33 的权威实施模型, 从**能力维度**而非**时间维度**划分优先级. 

### 第一环: 平台生存环 (Platform Survival Ring) 

> **没有第一环, 不谈大规模接入. ** 第一环不是完整 Phase 1 / Phase 2 / Phase 8a / Phase 8d 的总和, 而是从这些 Phase 中切出的 MVP slice. 目标是 8-12 周交付可运行, 可审计, 可停止, 可 Trace Replay 的最小生产闭环; 各 Phase 的完整能力进入 Hardening Ring 延展. 

**MVP slice 边界**: 

| 来源 Phase | 第一环必须交付 | 延后到 Hardening Ring |
| --- | --- | --- |
| Phase 1 | harness_run, node_run, event_log, checkpoint, lease, CAS, idempotency, 最小 CLI inspect | 完整 schema inventory, 全部 Group 1/2 表, 复杂 projection rebuild |
| Phase 2 | Harness 主链最小 O→A→P→E→F, risk/approval basic, SideEffect proposed→committed→confirmed 最小链路 | 多 Pack 扩展, 完整恢复 worker, 复杂降级strategy |
| Phase 8a | HarnessRuntime.run() entry, ConstraintPack, Planner/Generator/Evaluator 分离, HarnessDecision 六种裁决 | 完整 Memory Namespace, 完整 Toolbelt 画像, 复杂 feedback pipeline |
| Phase 8d | PlanGraph DAG, NodeRun state机, Event Registry facts, Budget atomic reserve, Trace Replay, SideEffect Reconciliation baseline | GraphPatch 完整strategy, LearningCandidate, EvaluationGate full矩阵, 完整 Runtime Test Matrix |

必须最先交付的最小闭环能力集, missing任一项则平台不可投产: 

| 能力                                       | 对应章节         | 交付标准                                  |
| ------------------------------------------ | ---------------- | ----------------------------------------- |
| P1-P5 核心链路                             | §4-§7, §14       | 五平面通信端到端可达                      |
| ConstraintPack                             | §45.3            | task级约束信封可加载, 可validation              |
| HarnessRun / HarnessStep / HarnessDecision | §45.13, §58.6    | Planner→Generator→Evaluator 闭环可运行    |
| PlanGraph / Event Registry / SideEffect Reconciliation | §13, §14, §28 | 复杂taskgraph化, state事件化, 副作用可对账 |
| Risk / Approval / Audit                    | §10, §47, §23    | risk评分→审批路由→审计写入全链路          |
| Lease / CAS / Checkpoint / Recovery        | §14, §25, §45.15 | statepersistence, 故障恢复可演示                |
| Panic / Incident / Replay                  | §9, §12, §60     | 紧急制动可触发, 事件可回放                |
| ModelGateway / Prompt / Eval Gate          | §15, §16, §17    | LLM call有网关, Prompt 有版本, 质量有门禁 |

**第一环验收门**: 可在受控环境中端到端运行一个 Agent task (从entry到结果产出) , 复杂task以 PlanGraph execute, 预算原子预留生效, task可被中断, 恢复, 审计, Trace Replay, 且真实 side effect 不会在 replay 中duplicate发生. 第一环明确不contains Multi-Region, Marketplace, 24 垂直域, Edge Runtime, PlatformOps Agent, 完整 Evaluation Harness, 完整组织治理, 完整多模态或完整合规报告. 

MVP Eval Gate 只要求 deterministic contract tests + small golden set + denial-path regression; 完整 Prompt canary, 跨模型评测和大规模 holdout 进入 Hardening. 

### 第二环: 平台可用环 (Platform Usability Ring) 

> **做到第二环, 平台能支撑真实业务试点. ** 对应 §33 Phase 3-5 + Phase 8b-8c. Phase 8c 的治理与评测必须在 Phase 8d 的 PlanGraph / Event / SideEffect / Budget 基线完成后才能验收. 

在第一环基础上补齐面向user和企业的闭环: 

| 能力                                                  | 对应章节          | 交付标准                                                            |
| ----------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| NL entry                                               | §39               | 自然语言task提交可用                                                |
| Goal Decomposition                                    | §40               | 目标分解引擎可将复合task拆解                                        |
| HITL Runtime                                          | §45.18            | inspect / patch / override / takeover / resume 五种人工介入模式可用 |
| Async Harness                                         | §45.19            | 长时task可休眠/唤醒                                                 |
| Dashboard                                             | §43               | L0/L1 看板视graph可用                                                  |
| Org / SSO / Approval Routing                          | §46-§48           | 组织层次→审批路由→SSO 集成                                          |
| DomainDescriptor / DomainRecipe / DomainEvalFramework | §37, §37.7, §37.5 | 域建模框架可用, 至少 2 个域完成接入                                 |
| Canonical Domain Meta-Model                           | §37.11            | 元模型 15 问模板可填写, 可validation                                      |
| Agent Collaboration Protocol                          | §19.5             | 多 Agent 协作消息可收发, 不可violates规则可validation                         |

**第二环验收门**: 至少 2 个垂直域 (推荐选 1 个 Critical + 1 个 Medium risk域) 完成试点上线, 非技术user可via NL entry提交task, 审批和 HITL 流程可走通. 

### 第三环: 平台扩张环 (Platform Expansion Ring) 

> **做到第三环, 才能谈 24 域规模化. ** 对应 §33 Phase 6-9. 

在前两环基础上补齐规模化和持续优化能力: 

| 能力                     | 对应章节 | 交付标准                                      |
| ------------------------ | -------- | --------------------------------------------- |
| Marketplace              | §55      | Agent 市场可发布/订阅/废弃                    |
| Multi-Region             | §52      | 至少 2 Region 可部署                          |
| Edge Runtime             | §62      | 离线/边缘场景可运行                           |
| Cost Optimizer           | §64      | 成本归因到域/Agent/task级别                   |
| Behavior Drift Detection | §63      | drift检测基线建立, 告警可触发                  |
| Compliance Reporter      | §66      | 合规报告可auto生成                            |
| 24 Domain Packs          | §71-§94  | 全部 24 域完成元模型填写并via §38 四阶段门禁 |

**第三环验收门**: ≥ 12 个域在生产环境运行, 跨 Region 故障切换演练via, 平台自ops Agent (§69) 可handle P3/P4 级别问题. 

### 三环与 §33 Phase 映射

```text
第一环 (生存)     第二环 (可用)          第三环 (扩张) 
 Phase 1/2/8a/8d   Phase 3-5+8b/8c        Phase 6-9
 MVP slices only
 ┌─────────┐      ┌───────────────┐      ┌────────────────────────┐
 │ 骨架+    │─────▶│ NLentry+HITL+  │─────▶│ Marketplace+Multi-     │
 │ Harness核│      │ Org+域试点+   │      │ Region+Edge+Cost+      │
 │ 心+Trace │      │ 协作协议+评测 │      │ Drift+24域全coverage       │
 └─────────┘      └───────────────┘      └────────────────────────┘
 约 8-12 周          约 12-24 周             约 24 周以后
```

### 实施决策建议

- **资源有限时**: 只做第一环 + 第二环中的 DomainDescriptor/HITL, 足以支撑 POC
- **时间压力大时**: 第二环的 NL entry可用简化版 (结构化表单) 替代, Dashboard 可延后
- **域数量可伸缩**: 第三环的 24 域可按 §33 Phase 9 的 6 批节奏分批上线, 无需一次全部交付

---

# 33. 分阶段落地路线

> v4.2 以三环为权威交付模型: MVP 8-12 周, Hardening 3-6 个月, Enterprise 6-18 个月. 旧 Phase 1-9 only作为历史映射和详细拆解, 不再作为并列路线; Phase 8a-8d 已拆入 Ring 1/2 交付包, Phase 9 域波次不blocks平台核心 milestone. 

本节的 Ring 是唯一权威实施路线; subsequent Phase 1-9 是历史映射和详细拆解, 不作为 backlog source 或parallel路线. 

## 33.0 v4.2 权威交付环

| Ring | 时间窗 | 必须交付 | 不得blocks项 |
| --- | --- | --- | --- |
| MVP Slice | 8-12 周 | HarnessRuntime entry, PlanGraphBundle, NodeRun, BudgetReservation, SideEffectManager, HITL basic, Trace Replay, CLI inspect | Marketplace, 24 域, Edge, PlatformOps, 完整 UI |
| Hardening | 3-6 个月 | Recovery, Projection rebuild, Incident/DLQ, Config governance, Org approval, Prompt/Eval rollout, Domain pilots | Multi-region GA, 外部市场, IDE 调试器 |
| Enterprise | 6-18 个月 | Multi-region, Marketplace, Edge, Advanced domains, Compliance reporter, Cost optimizer | 不再扩大核心运行语义 |

平台 milestone 按能力验收, 不按域数量验收. Phase 9 改为 independent domain waves: 平台目标是 `N/24 domains GA`, 单个域延期不得blocks Harness / State / Evidence / Governance 主链. 

### 33.0.1 Operational Readiness Matrix

Operational readiness 按 Ring 渐进验收, 避免 MVP 被 Enterprise 目标拖垮, 也避免 Enterprise 宣称生产级但missing少ops闭环. 

| 能力 | MVP | Hardening | Enterprise |
| --- | --- | --- | --- |
| Incident | 手动创建 + linked evidence | auto检测 + routing | SLO / error budget 联动 |
| DLQ | inspect + discard | redrive + simulation | bulk remediation |
| Replay | trace replay, 无真实副作用 | replay compare + deterministic diff | simulation lab |
| Panic | local kill / admission block | plane ack + safe recovery | cross-region drill |
| Budget | run / node reserve | sub-ledger + allocator bucket | cross-region reconciliation |
| Domain | 2 pilot specs | 6-12 domains with gate evidence | 24 domain waves |
| Config | versioned defaults + manual rollback | ConfigImpactAnalyzer + canary | cross-region rollout lock |
| Approval | basic approve / deny | capacity reserve / route snapshot | delegated authority simulation |
| Evidence | event + audit + artifact refs | control mapping + quality score | compliance package generation |

## Phase 1: 稳态骨架 (8 周) 

### 交付物

- HarnessRun / NodeRun truth tables + event log + UoW (MVP physical schema) 
- lease / fencing / CAS
- idempotency
- artifact ref
- policy outcome + decision model (Group 2 表) 
- 最小ops CLI (doctor / inspect) 
- Unit test ≥ 80% coverage

### 验收门

- [ ] HarnessRun 可稳定创建和推进 (无降级) 
- [ ] lease timeout后auto reclaim
- [ ] CAS conflict被正确reject
- [ ] 事件追加与真相表在同一transaction

### dependency

无外部dependency. SQLite + Node.js 即可启动. 

## Phase 2: 受控auto化 (8 周) 

### 交付物

- HarnessRuntime 主链 + OAPEFLIR StageRationale 投影
- risk assessment engine
- approval gates (basic) 
- side effect tracking
- recovery workers (LeaseReclaimer + StuckRunSweeper) 
- 2 个 Business Pack: coding.fix_bug + operations.resolve_incident

### 验收门

- [ ] 主链端到端跑通 (task 创建 → execute → 完成) 
- [ ] 高risk step 触发审批阻断
- [ ] worker crashed后 30s 内恢复execute
- [ ] side effect 可query可审计

### dependency

Phase 1 全部验收via. 

## Phase 3: 企业可靠化 (12 周) 

### 交付物

- Feedback / Learn / Improve / Release 治理闭环
- circuit breaker + degradation mode switching
- backpressure (4 模式) 
- incident management + DLQ 运营
- projection rebuild
- replay / repair
- configure治理 (版本化 + 灰度) 
- 多tenant隔离强化
- PostgreSQL 迁移 (可选) 

### 验收门

- [ ] 外部dependency熔断后auto降级, 恢复后auto回升
- [ ] DLQ 可query可重试可关闭
- [ ] Incident 闭环处置链打通
- [ ] Projection rebuild 后data一致
- [ ] configure变更可rollback

### dependency

Phase 2 全部验收via. 

## Phase 4: 规模化扩展 (持续) 

### 交付物

- Worker 分离部署 (Phase D2) 
- 更多 Business Pack
- 浏览器execute深化
- 插件生态
- SLO auto化监控
- 合规导出
- 容灾演练

### 验收门

- [ ] 50 concurrent workflow 稳定运行
- [ ] 多 tenant 隔离验证via
- [ ] Load test 符合 §27 SLO
- [ ] 容灾演练 RTO < 10min

## Phase 5: 智能交互 + 组织治理 + 域接入框架 (12 周) 

> 智能交互层 + 组织治理层 + 统一领域元模型 + 多 Agent 协作协议. 

### 交付物

- 自然语言taskentry(§39) + 目标分解引擎(§40)
- 主动式 Agent 框架(§41) + 渐进式自主权模型(§42)
- 统一运营看板(§43) + 非技术user体验(§44)
- 组织层次模型(§46) + 审批路由(§47) + SSO/SCIM(§48)
- 合规strategy引擎(§49) + 知识域隔离(§50) + 治理委托(§51)
- 统一领域元模型 15 问模板与validation工具(§37.11)
- 多 Agent 协作协议消息格式与不可violates规则validation(§19.5)

### 验收门

- [ ] 非技术user可via自然语言创建和managetask
- [ ] 目标分解引擎auto将业务目标拆解为可executetaskgraph
- [ ] 渐进式自主权 L0→L3 升级path端到端验证
- [ ] 组织架构三级层次正确驱动审批路由
- [ ] SSO/SCIM autosynchronoususer且停用账户 < 5min 生效
- [ ] 知识域隔离零leaks, 受控shared审计完整
- [ ] 15 问元模型模板可填写, 可validation, 至少 2 个域完成填充
- [ ] 多 Agent 协作消息收发端到端可达, 7 条不可violates规则autovalidation

### dependency

Phase 4 全部验收via. 

## Phase 6: 规模化与生态 (12 周) 

> 规模化运行层 + 生态层. 

### 交付物

- 多 Region 部署(§52) + 资源竞争manage(§53) + SLA 分级(§54)
- Internal Pack Registry(§55) + 反馈改进管线(§56) + 外部集成框架(§57)

### 验收门

- [ ] 双 Region 单 leader / follower read 部署, 受控 failover 演练via, 单 Region 故障 RTO < 5min
- [ ] active-active 只used for非 truth 的cached, 遥测或聚合统计, 不承载 HarnessRun / Budget / SideEffect 写入
- [ ] 1000 concurrent workflow 下高优先级task不饥饿
- [ ] SLA Tier P0 task 99.9% 在承诺时间内完成
- [ ] Internal Pack Registry 至少 3 个核心 Pack via认证; 外部 Marketplace 20 个认证 Pack 作为 Enterprise/Future independent验收
- [ ] user反馈→改进闭环 < 7 天

### dependency

Phase 5 全部验收via. 

## Phase 7: 运营成熟度 (持续) 

> 运营成熟度层. 

### 交付物

- 可解释性(§59) + 紧急制动(§60) + 生命周期manage(§61)
- 离线/边缘部署(§62) + 行为drift检测(§63) + 成本优化(§64)
- 可视化调试器(§65) + 合规报告(§66) + 容量规划(§67)
- 多模态能力(§68) + 平台自ops Agent(§69)

### 验收门

- [ ] user可对arbitrary step query解释, L1 延迟 < 2s
- [ ] 紧急制动演练: 全平台停止 < 5s, 恢复 < 30min
- [ ] EdgeRuntime 断网 24h 恢复后datasynchronous零loss
- [ ] 行为drift > 2σ 时 100% 触发告警
- [ ] 合规报告 SOC2 Type II 控制点coverage率 ≥ 95%
- [ ] PlatformOps Agent L1 成熟度验证via

### dependency

Phase 6 全部验收via. 

## Phase 8a: Harness 统一运行协议 (8 周) 

> Harness 工程化层. 可与 Phase 3 parallel启动. 

### 交付物

- HarnessRun/HarnessStep 统一contract(§45.13) + HarnessDecision(§58.6)
- Harness Runtime 主entry + HarnessLoopController(§45.7)
- ConstraintPack 装配引擎(§45.3) + ToolbeltAssembler(§45.4)
- ContextAssembler + ContextSnapshot(§45.5) + 最小 Working Memory(§45.16)
- Planner/Generator/Evaluator Agent 角色分离(§45.8-45.10)
- FeedbackEnvelope 四段闭环(§45.6)
- 基础 Evaluator (runtime裁决) 

### 验收门

- [ ] 所有taskexecutevia HarnessRuntime.run() entry, 无旁路
- [ ] ConstraintPack 正确合并平台→tenant→域→task四级约束
- [ ] Planner/Generator/Evaluator usesindependent Prompt, 不共用
- [ ] 每步execute后 Evaluator 评估via率 ≥ 95%
- [ ] HarnessRun/HarnessStep contract完整coverage所有运行和step
- [ ] HarnessDecision 六种裁决均有testingcoverage

## Phase 8b: Harness 长时与人机 (6 周) 

> 八支柱深化. dependency Phase 8a 完成. 

### 交付物

- Durable Harness 持久execute(§45.15): pauseReason 注册表 + resumeStrategy
- HITL Runtime(§45.18): inspect/patch/override/takeover/resume 五类能力
- Async Harness(§45.19): create_run/poll_status/subscribe_events/intervene_mid_run
- Memory Namespace(§45.16): Working/Long-term/Shared Knowledge 三层 + 晋升strategy
- Harness Prompt 分层治理(§58.2)
- Failure-to-Learning 管线(§58.3)
- 在线反馈闭环

### 验收门

- [ ] ContextSnapshot 支撑crashed恢复, 恢复后state一致
- [ ] Durable Harness 支持 5 种 pauseReason 和 4 种 resumeStrategy
- [ ] HITL Runtime 的 inspect/patch/override 在 §43 看板可操作
- [ ] Async run 支持 poll_status 和 intervene_mid_run
- [ ] Memory 三层naming空间隔离viatenant/域隔离testing

## Phase 8c: Harness 治理与评测 (6 周) 

> 八支柱深化. dependency Phase 8b + Phase 8d 完成. 

### 交付物

- Evaluation Harness(§45.14): 预发布评测 + 版本对比评测
- Tool Harness(§45.17): 工具能力画像 + 工具call治理record
- Guardrails 分层(§45.20): input/planning/tool/memory/output 五层
- Harness Replay/Simulation(§58.4)
- Harness 十条不变量(§45.21) forcecheck
- Harness 级 metrics 在 §43 看板可见(§58.1)

### 验收门

- [ ] Evaluation Harness 能在沙箱中运行标准task集并output对比报告
- [ ] Tool Harness 的 Capability Profile coverage所有已注册工具
- [ ] Guardrails 五层均有拦截testingcoverage
- [ ] Harness Replay 能完整回放已完成的 run
- [ ] 十条不变量有对应的auto化check (violates即 CI failure) 

### dependency

Phase 8a → Phase 8d; Phase 8d → Phase 8b; Phase 8b + Phase 8d → Phase 8c. Phase 8a 可与 Phase 3-7 parallel推进; Phase 8d 是 Phase 8b/8c 的运行语义基线. Phase 5 之前必须完成 Phase 8c. 

## Phase 8d: OAPEFLIR-Harness 收敛运行contract (8 周) 

> OAPEFLIR-Harness 收敛contract. dependency Phase 8a, 是 Phase 8b/8c 的运行语义基线; Phase 8b 的长时/HITL 能力可以局部parallel开发, 但验收必须以 Phase 8d 的 HarnessRun / NodeRun / Event / SideEffect / Budget contract为准. 

### 交付物

- HarnessRun / NodeRun State Machine
- Event Registry + Trace Replay Semantics
- PlanGraph + GraphPatch
- Graph Normalizer / Validator / Risk Propagator / Worst-Path Analyzer
- Deterministic Graph Scheduler decision recording
- Budget Ledger
- SideEffect Manager + Reconciliation State Machine + Compensation Manager
- DecisionInputBundle + Decision Engine precedence
- ContextAssemblyContract + PromptExecutionContract
- HITL Responsibility Record
- Memory Write Governance
- EvaluationGate + LearningCandidate State Machine
- Runtime Test Matrix

### 验收门

- [ ] 所有state迁移有单元testingcoverage, 终态不可迁出. 
- [ ] PlanGraph validation可拦截 deadlock / missing terminal / missing compensation. 
- [ ] 同一 graph 的 scheduler decision 可 Trace Replay; Re-execution Replay 标记 nondeterministic. 
- [ ] SideEffect ambiguous 可进入 reconciliation, 不会被误判 success. 
- [ ] Budget exhausted 可阻断 retry / replan. 
- [ ] HITL approve scope 生效, 不会扩大authorization. 
- [ ] LearningCandidate pollutecheck可阻断 holdout / PII / secret. 
- [ ] EvaluationGate 可阻断不合格 Prompt / Policy / Tool / Domain 发布. 
- [ ] Replay 不产生真实 side effect. 

## Phase 9: 垂直业务域深化落地 (48 周, 分 6 批) 

> 24 个垂直业务域的 DomainDescriptor instantiation, 领域工具集成, 领域评估基线建立和灰度上线. dependency Phase 5 + Phase 8c 完成. 前 3 批coverage原始 12 域 (v3.0) , 后 3 批coverage新增 12 域 (v3.1) . 

### Phase 9a: 高优先级域 (8 周)  -- 代码开发 · datahandle · 企业知识库 · user运营

选择标准: 平台已有 coding/operations 实例, risk可控, 可快速验证域框架. 

#### 交付物

- 4 个域的 DomainDescriptor 实例 (含 RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy) 
- 4 个域的 Business Pack (至少各 2 个核心 Workflow) 
- 4 个域via §38 四阶段门禁 (建模→开发→认证→灰度) 
- 域级评估基线和回归data集

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] 每个域 eval 所有质量轴达到 acceptance_threshold
- [ ] 域级 SLO 达标率 ≥ 95%
- [ ] 跨域交互strategy验证via (代码开发↔datahandle) 

### Phase 9b: 中优先级域 (8 周)  -- 量化交易 · 金融服务 · 电商 · 广告推广

选择标准: 高业务价值, Critical risk域需更严格认证. 

#### 交付物

- 4 个域的 DomainDescriptor 实例 (含领域专属风控规则和合规映射) 
- Trading/Compliance 原型模板验证
- 量化交易域超低延迟path验证
- 金融服务域监管报表 Agent 端到端验证

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] Critical risk域 (量化交易/金融服务) HITL coverage率 100%
- [ ] 量化交易域executepath延迟 < 10ms (不含 LLM) 
- [ ] 金融服务域 AML/KYC 合规checkvia

### Phase 9c: 完善域 (8 周)  -- 行业调研 · 学术调研 · 财务 · 法务

选择标准: 高 HITL 要求, 监管密集, 需律师/审计师参与验证. 

#### 交付物

- 4 个域的 DomainDescriptor 实例
- Research/Adversarial 原型模板验证
- 法务域律师审核工作流端到端验证
- 财务域 SOX 合规审计轨迹验证

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] 法务域所有output 100% 经律师审核
- [ ] 财务域审计轨迹integritycheckvia
- [ ] 学术调研域references准确率 100% (零捏造) 
- [ ] 前 12 个域全部在线运行, 跨域交互矩阵验证via

### Phase 9d: 高优先级新域 (8 周)  -- 客户服务 · IT ops SRE/DevOps · content审核与安全 · 在线直播

选择标准: 运营刚需, 实时性要求高, 已有成熟工具生态可集成. 

#### 交付物

- 4 个域的 DomainDescriptor 实例 (含 RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy) 
- 客户服务域多轮对话闭环端到端验证
- IT ops域告警→诊断→修复auto化链路验证
- content审核域 CSAM 即时报告合规流程验证
- 在线直播域实时流审核延迟 < 2s 验证

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] 客户服务域首次解决率 ≥ 70%, CSAT ≥ 4.0
- [ ] IT ops域 MTTR 降低 ≥ 30% (对比人工基线) 
- [ ] content审核域违规content召回率 ≥ 99.5%, CSAM 100% 即时上报
- [ ] 在线直播域实时流审核端到端延迟 < 2s

### Phase 9e: 中优先级新域 (8 周)  -- 医疗健康 · 人力资源 · 供应链与物流 · 教育培训

选择标准: 高合规要求, 强 HITL 域, 需领域专家深度参与认证. 

#### 交付物

- 4 个域的 DomainDescriptor 实例 (含领域专属合规映射和审批工作流) 
- 医疗健康域执业医师审核工作流端到端验证
- 人力资源域招聘偏见审计via
- 供应链域需求预测→调度→异常handle链路验证
- 教育培训域个性化学习path推荐验证

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] 医疗健康域所有诊疗建议 100% 经执业医师审核
- [ ] 人力资源域招聘流程偏见审计via (Adverse Impact Ratio ≥ 0.8) 
- [ ] 供应链域需求预测准确率 ≥ 85% (MAPE ≤ 15%) 
- [ ] 教育培训域学习效果提升 ≥ 15% (对比基线) 

### Phase 9f: 完善新域 (8 周)  -- 广告素材制作 · 游戏开发 · 游戏上架 · 市场营销与品牌

选择标准: 创意密集型, 发布流程复杂, 需多方协作验证. 

#### 交付物

- 4 个域的 DomainDescriptor 实例
- 广告素材域多模态生成→合规审核→迭代链路验证
- 游戏开发域代码生成→testing→性能验证链路验证
- 游戏上架域多平台合规check→提交→监控链路验证
- 市场营销域 Campaign 编排→投放→效果analysis闭环验证

#### 验收门

- [ ] 4 个域全部达到 GA state
- [ ] 广告素材域创意合规via率 ≥ 95% (首次提交) 
- [ ] 游戏开发域代码生成编译via率 ≥ 90%
- [ ] 游戏上架域多平台合规一次via率 ≥ 85%
- [ ] 24 个域全部在线运行, 跨域交互矩阵 24×24 验证via

### dependency

Phase 9a dependency Phase 5 + Phase 8c 完成. Phase 9a→9b→9c→9d→9e→9f 线性推进, 总计 48 周. Phase 9d 可在 Phase 9c 完成后立即启动. 

## 33.1 Legacy Phase dependencygraph (only映射) 

以下graphonly保留历史referencescompatibility, 不作为 v4.2 实施order权威; 实际交付按 §33.0 三环验收. 

```text
Phase 1 (稳态骨架)
    │
    ▼
Phase 2 (受控auto化)
    ├──────────────────────────────┐
    │                              │
    ▼                              ▼
Phase 3 (企业可靠化)    Phase 8a (统一运行协议)
    │                              │
    ▼                              ▼
Phase 4 (规模化扩展)    Phase 8d (OAPEFLIR-Harness)
    │                              ├──────────────┐
    ▼                              ▼              │
Phase 5 (智能交互与组织治理) ◄─ Phase 8b (长时与人机)
                                   │
                                   ▼
                          Phase 8c (治理与评测)
    │                              │
    ├──────────────────────────────┘
    │
    ▼
Phase 6 (规模化与生态)
    │
    ▼
Phase 7 (运营成熟度)
    │
    ▼
Phase 9a (高优先级域: 代码·data·知识库·运营)
    │
    ▼
Phase 9b (中优先级域: 量化·金融·电商·广告)
    │
    ▼
Phase 9c (完善域: 调研·学术·财务·法务)
    │
    ▼
Phase 9d (高优先级新域: 客服·ITops·content审核·直播)
    │
    ▼
Phase 9e (中优先级新域: 医疗·HR·供应链·教育)
    │
    ▼
Phase 9f (完善新域: 素材·游戏开发·游戏上架·营销)
```

Phase 9a 从 Phase 5 + Phase 8c 完成后即可启动 (可与 Phase 6-7 parallel推进早期准备工作) . Phase 9a→9b→9c→9d→9e→9f 线性推进, 总计 48 周. 

## 33.2 生产最小闭环 (Production Minimum Closure) 

为确保平台可分批交付并尽早进入生产验证, 将功能划分为三个交付批次: 

**Batch A — 可控运行闭环** (Phase 1-2 交付) : 
P1-P5 平面骨架 · OAPEFLIR/Harness 主链 · ConstraintPack · Toolbelt · Evaluator 基础裁决 · Checkpoint/Recovery · Approval/Policy/Audit 基础流程. 交付后可在受控环境运行端到端task. 

**Batch B — 企业运行闭环** (Phase 3-4 交付) : 
Async Harness · HITL Runtime · Memory Namespace · Tool Harness 治理 · Guardrails 五层 · Multi-tenant/Org/Compliance · Drift Detection 基础. 交付后可支撑企业多团队, 多审批, 长时task场景. 

**Batch C — 平台优化闭环** (Phase 5-8c 交付) : 
Evaluation Harness (离线评测 + 版本对比) · Replay/Simulation · Cost 优化 · Drift auto修复 · PlatformOps Agent · Marketplace. 交付后平台具备自ops与持续改进能力. 

各批次交付标准: 全链路冒烟via · 关键path E2E testingcoverage · 安全扫描无 P0/P1 · ops手册就绪. 

---

# 34. ADR 冻结建议

共 123 个 ADR: 

ADR 不再按“越多越安全”冻结. v4.2 只冻结会影响runtimecontract, state真相, 安全治理和域合规边界的决策; 产品体验, 商业条款, 示例implementation和future能力不得进入 P0/P1 ADR blocks主线. 

ADR 冻结分三类: `MVP-blocking` 必须在 Ring 1 前冻结; `Hardening-before-production` 必须在真实生产tenant前冻结; `Enterprise-before-scale` 必须在多 Region / Marketplace / 24 域规模化前冻结. 只冻结 MVP-blocking 不代表其余 ADR 可bypass, 而是避免 ADR 数量反向blocks最小生产闭环. 

## 34.0 ADR 元data模板与优先级

每个 ADR 必须contains以下field, missing少 runtime/schema/test 映射的 ADR 只能处于 `draft`: 

```yaml
adr_id:
phase: MVP | Hardening | Enterprise | Future
priority: P0 Runtime | P1 State/Evidence | P2 Safety/Governance | P3 Domain | P4 Product
freeze_class: MVP-blocking | Hardening-before-production | Enterprise-before-scale | Future
status: proposed | accepted | superseded | deprecated
decision:
runtime_contract_ref:
schema_ref:
test_ref:
supersedes:
owner:
review_after:
trigger:
linked_invariant:
linked_test:
```

ADR 分组规则: 

| 优先级 | 冻结range | 示例 |
| --- | --- | --- |
| P0 Runtime | HarnessRun, PlanGraph, NodeRun, SideEffect, Budget, Replay 等不可bypass运行contract | 改动需synchronous schema, API, testing |
| P1 State/Evidence | truth/event/projection/artifact/audit 的一致性和证据语义 | 改动需 migration + rebuild strategy |
| P2 Safety/Governance | policy, approval, panic, secret, egress, tenant isolation | 改动需 denial-path regression |
| P3 Domain | 高risk域边界, 监管证据, HITL/资质要求 | 改动需域 owner 签核 |
| P4 Product | UI, 商业, 推荐, 市场化体验 | 不blocks MVP runtime |

**平台基础 (19 个) **: 
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**平面通信与部署 (4 个) **: 

- **ADR-Plane-Communication-Contracts** — 五平面间必须via正式contract对象通信
- **ADR-Repository-Abstraction-Layer** — 所有存储访问via Repository interface
- **ADR-Single-Process-First** — 部署从单体开始, 验证后再split
- **ADR-API-Versioning-Strategy** — API 版本化与向后compatibilitystrategy

**AI 运营 (9 个) **: 

- **ADR-ModelGateway-As-Single-LLM-Entry** — 所有 LLM call必须via ModelGateway, 禁止directlycall provider SDK
- **ADR-Prompt-As-Versioned-Resource** — Prompt 不内联代码, 作为版本化资源independentmanage
- **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model 变更必须via质量门禁
- **ADR-Per-Tenant-Cost-Metering** — 所有 LLM 成本必须按 tenant 计量
- **ADR-Delegation-Depth-Limit** — Agent 间委托最大深度 = 3
- **ADR-Workflow-Hibernation-Model** — 长时等待 workflow 必须释放 worker 并persistencestate
- **ADR-Crypto-Shredding-For-Erasure** — GDPR 删除via crypto-shredding implementation
- **ADR-Pack-Semver-Compatibility** — Pack Manifest API 遵循 semver compatibility性contract
- **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM 延迟independent监控, 不计入平台自身 SLO

**业务域接入 (4 个) **: 

- **ADR-Domain-Descriptor-As-Semantic-Layer** — 每个 Business Pack 必须关联 DomainDescriptor, 领域语义不内嵌 Pack 代码
- **ADR-Domain-Risk-Override-Over-Platform-Default** — 领域risk画像覆写优先于平台defaultrisk矩阵, 覆写需审计理由
- **ADR-Domain-Recipe-As-Onboarding-Accelerator** — 新业务域必须从十二种原型模板之一开始, 禁止空白接入
- **ADR-Four-Phase-Domain-Onboarding** — 业务域接入必须via四阶段门禁 (建模→开发→认证→灰度) , 不allowsskip

**智能交互 (6 个) **: 

- **ADR-NL-Intent-Must-Resolve-To-Confirmed-TaskSpec** — 自然语言输入必须经过 Intent 解析生成 TaskDraft, 经澄清和userconfirmation后才可形成 TaskSpec / RequestEnvelope(§5.3), 禁止将原始textdirectly传递给 Agent
- **ADR-Goal-Decomposition-Max-Depth** — 目标分解引擎递归深度upper limit = 5, 超过需人工confirmation分解方案
- **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — 主动式 Agent 必须绑定 TriggerPolicy, 禁止无条件轮询
- **ADR-Autonomy-Level-Guarded-Progression** — 渐进式自主权等级defaultmonotonic递增 (晋升需满足积分门槛 + 审批) ; 降级only在 §42.2 定义的安全触发条件下发生 (P0 Incident / 连续failure / 成本超限) , 降级execute后须人工审批confirmation并record原因, 恢复path遵循晋升规则
- **ADR-Dashboard-Metric-Source-Of-Truth** — 统一运营看板data必须来自 State & Evidence Plane, 禁止directly读取 Runtime 内部state
- **ADR-No-Code-UX-Maps-To-Standard-API** — 非技术user界面操作必须映射到标准 Public API, 禁止旁路

**组织治理 (6 个) **: 

- **ADR-Org-Hierarchy-As-First-Class-Model** — 组织层次 (企业→事业群→部门→团队) 作为一等模型, 所有资源归属必须关联 OrgNode
- **ADR-Approval-Route-From-Org-Chart** — 审批路由必须从组织架构dynamic派生, 禁止hardcoded审批人列表
- **ADR-SSO-As-Single-Identity-Source** — 企业 SSO 为唯一identity来源, 平台不maintainedindependentuser密码
- **ADR-Compliance-Policy-Inherits-Down** — 合规strategy沿组织树向下继承, 子节点只能收紧不能放松
- **ADR-Knowledge-Boundary-Default-Deny** — 知识域default隔离, 跨部门shared需explicitlyauthorization并record审计log
- **ADR-Governance-Delegation-Requires-Scope** — 治理权委托必须限定 scope (资源type + OrgNode range) , 禁止globally委托

**规模化与生态 (6 个) **: 

- **ADR-Multi-Region-Single-Leader-Per-Partition** — 多 Region 采用每 partition 单 leader 写入, follower read + 异步复制 + 受控 failover, 禁止多主 truth 写入
- **ADR-Resource-Contention-Fair-Queue** — 规模化部署必须uses加权公平队列, 禁止简单 FIFO 导致高优先级task饥饿
- **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA 等级决定资源配额, 队列优先级和故障恢复order
- **ADR-Marketplace-Pack-Must-Pass-Certification** — Agent 市场上架的 Pack 必须via平台认证 (安全扫描 + 沙箱testing + 性能基线) 
- **ADR-Feedback-Loop-Closed-Within-SLA** — user反馈必须在 SLA 定义的时间窗内形成闭环 (采集→analysis→改进→验证) 
- **ADR-Integration-Through-Unified-Connector** — 外部system集成必须via统一 Connector 框架, 禁止业务代码directlycall外部 API

**运营成熟度 (11 个) **: 

- **ADR-Every-Decision-Must-Have-Rationale** — OAPEFLIR 每个阶段必须生成 StageRationale, 决策解释按需渲染
- **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective 必须在 5 秒内原子停止全平台, 恢复需双人审批
- **ADR-Agent-As-Composite-Entity** — Agent 作为 Pack+Prompt+Model+Trust+Trigger 的复合实体, 以 AgentVersion 为发布和rollback单位
- **ADR-Edge-Runtime-Risk-Ceiling** — 离线 EdgeRuntime 只allowsexecute risk_level ≤ medium 的动作, 高risk动作等待连接恢复
- **ADR-Behavior-Fingerprint-Mandatory** — 每个 Agent 必须maintained BehaviorFingerprint, drift检测coverage 1h/7d/30d/90d 四个window
- **ADR-Cost-Attribution-Per-Decision** — 成本归因必须精确到决策级 (单个 LLM call) , 优化建议必须附带 quality_risk 评估
- **ADR-Workflow-Debug-Session-Isolated** — 调试 session 在隔离沙箱中运行, 断点暂停不影响其他 workflow
- **ADR-Compliance-Report-Template-Versioned** — 合规报告模板必须版本化, 报告生成时lock定模板版本
- **ADR-Capacity-Forecast-Drives-Scaling** — 容量预测结果必须关联到扩容建议, 扩容建议必须附带成本影响估算
- **ADR-Multimodal-Safety-Check-Before-Output** — 多模态output (graph片/语音) 必须经过content安全check后才能交付给user
- **ADR-PlatformOps-Agent-Read-Only-Default** — 平台自ops Agent default只读, 生产写操作必须经过人工审批

**Harness 工程化 (7 个) **: 

- **ADR-Harness-As-First-Class-Runtime** — Harness Runtime 作为一级架构对象, 所有taskexecute必须via HarnessRuntime.run() entry, 禁止bypass Harness 直调 P4
- **ADR-ConstraintPack-Per-Run** — 每次 HarnessRun 必须携带explicitly ConstraintPack, 约束来源按平台→tenant→域→task优先级合并
- **ADR-Planner-Generator-Evaluator-Prompt-Isolation** — Planner/Generator/Evaluator 三类 Agent 的 Prompt 必须independent版本化和independent rollout, 禁止共用 Prompt 模板
- **ADR-Step-Level-Evaluation-Mandatory** — 每步execute完成后必须经过 Evaluator 评估, 禁止skip评估directly推进下一步
- **ADR-Toolbelt-Minimum-Privilege** — Toolbelt 按最小permissions装配, onlycontains当前task + 域 + risk等级allows的工具子集
- **ADR-ContextSnapshot-Per-Loop** — 每轮 Harness loop 必须保存 ContextSnapshot 到 P5 Checkpoint, 支撑crashed恢复和 Replay
- **ADR-Global-Call-Depth-Limit** — 目标分解(depth≤5), 委托链(depth≤3), globallycall深度硬upper limit = 8; decompose / delegate / subgraph 均 +1, 局部upper limit不得相乘

**Harness 八支柱 (9 个) **: 

- **ADR-Harness-Eight-Pillar-Model** — Harness 从五元组升级为八支柱 (Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay) , 所有支柱必须有independent验收门
- **ADR-HarnessRun-As-First-Class-Entity** — HarnessRun 作为一级实体, 具有完整生命周期 (pending→running→paused→completed/failed/aborted) , 所有state转换必须写入审计log
- **ADR-HarnessDecision-Six-Way** — HarnessDecision fixed六种裁决 (accept/retry_same_plan/replan/escalate_to_human/downgrade_mode/abort) , 禁止自定义裁决type
- **ADR-Evaluation-Harness-Outcome-Over-Transcript** — 评测以最终 outcome (环境state是否到达目标态) 为主要指标, transcript only为辅助
- **ADR-Durable-Harness-Pause-Resume** — 所有 async run 必须支持explicitly pause/resume, pause 时完整序列化到 P5 Checkpoint
- **ADR-Memory-Three-Namespace-Isolation** — Working/Long-term/Shared Knowledge 三层记忆必须naming空间隔离, 跨层晋升需strategy审核
- **ADR-Tool-Capability-Profile-Mandatory** — 每个注册工具必须附带 Capability Profile, 无 profile 的工具禁止被 ToolbeltAssembler 装配
- **ADR-HITL-As-Runtime-Primitive** — HITL 作为 Harness 原生runtimesteptype (phase=hitl) , 不only是 escalation path
- **ADR-Guardrails-Five-Layer** — Guardrails 分 input/planning/tool/memory/output 五层, 每层independentconfigure, independent拦截, independent审计

**OAPEFLIR-Harness 收敛运行规范 (18 个) **: 

- **ADR-OAPEFLIR-Plan-Is-Graph** — 复杂task Plan 必须是 PlanGraph, 线性 steps only作为 legacy 展示或单节点退化形式
- **ADR-OAPEFLIR-Event-Registry-As-Source-Of-Replay** — Event Registry 是 replay, projection rebuild, causal lineage 的事件事实来源
- **ADR-OAPEFLIR-Deterministic-Graph-Scheduler** — Graph Scheduler 决策必须record并可 Trace Replay, 不dependency不可复现外部state
- **ADR-OAPEFLIR-Terminal-State-Immutability** — HarnessRun / NodeRun 终态不可迁出, 修复只能追加 redrive, compensation 或 GraphPatch
- **ADR-OAPEFLIR-Retry-Append-Only-Lineage** — Retry / Redrive 必须追加 AttemptLineage, 不得coverage历史 attempt
- **ADR-OAPEFLIR-SideEffect-Delivery-Semantics** — 所有副作用必须声明交付语义和confirmation机制
- **ADR-OAPEFLIR-Reconciliation-For-Ambiguous-External-State** — 外部state不确定必须进入 Reconciliation, 不得误判success
- **ADR-OAPEFLIR-DecisionInputBundle-Frozen-Before-Decision** — Decision Engine 裁决前必须冻结 DecisionInputBundle
- **ADR-OAPEFLIR-Budget-Reservation-Before-LLM-And-Tool** — LLM / Tool / SideEffect / Evaluation 前必须 reserve budget
- **ADR-OAPEFLIR-ContextAssembly-Per-Role** — Planner / Generator / Evaluator 必须usesindependent上下文装配contract
- **ADR-OAPEFLIR-Prompt-Role-Isolation** — Planner / Generator / Evaluator Prompt independent版本化, 评测和发布
- **ADR-OAPEFLIR-Memory-Write-Governance** — 长期记忆和shared知识写入必须via MemoryWriteGovernance
- **ADR-OAPEFLIR-HITL-Responsibility-Record** — 人工 approve / override / takeover 必须record scope 与责任边界
- **ADR-OAPEFLIR-Run-Version-Lock** — 每次 Run admitted 时冻结 Prompt / Policy / Tool / Model / Domain / Eval 版本
- **ADR-OAPEFLIR-Learning-Quarantine-Before-Release** — LearningCandidate 必须隔离, 评测, 审批后才能进入发布
- **ADR-OAPEFLIR-Evaluation-Gate-Before-Online-Change** — Prompt / Policy / Tool / Domain 改进上线前必须via EvaluationGate
- **ADR-OAPEFLIR-LLM-Judge-Cannot-Override-Deterministic-Failure** — LLM-as-Judge 不能coveragestrategyreject, 安全违规, 预算耗尽, state机非法等确定性failure
- **ADR-OAPEFLIR-Replay-Never-Produces-Real-SideEffect** — Replay / Simulation 永远不得产生真实外部副作用

**垂直业务域深化 (24 个) **: 

- **ADR-Domain-Recipe-Twelve-Archetypes** — DomainRecipe 从八种扩展为十二种原型 (CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps) , coverage 24 个垂直域工作流模式
- **ADR-Quant-Trading-Pre-Trade-Risk-Mandatory** — 量化交易域所有订单必须经过盘前风控check, 风控延迟不得 >50μs, 硬性仓位/损失限额不可由 Agent coverage
- **ADR-Financial-Services-Explainable-Decisions** — 金融服务域所有不利信贷决策必须附带可解释的reject理由, 符合公平借贷法规
- **ADR-Legal-Output-Attorney-Review-Mandatory** — 法务域所有 Agent output在外发或被采取行动前必须经执业律师审核, Agent 只提供"法律信息"而非"法律意见"
- **ADR-Finance-Accounting-Segregation-Of-Duties** — 财务域必须execute职责分离 (创建人≠审批人) , 符合 SOX 内控要求
- **ADR-Ecommerce-Price-Change-Guardrail** — 电商域价格变动超过当前价 X% 必须触发人工审批, 防止乌龙定价
- **ADR-Academic-Research-Zero-Citation-Fabrication** — 学术调研域每条references必须可解析到真实论文 (DOI/data库验证) , 零捏造容忍
- **ADR-Knowledge-Base-Source-Permission-Mirroring** — 企业知识库域必须镜像源system文档级permissions, query时execute实时访问check
- **ADR-Advertising-Budget-Hard-Cap** — 广告推广域必须有平台层硬性每日/每小时预算upper limit, 竞价error不得突破upper limit
- **ADR-Data-Engineering-Schema-Migration-Approval** — datahandle域破坏性 Schema 变更必须经人工审批, auto评估下游影响
- **ADR-User-Operations-Frequency-Cap-Mandatory** — user运营域所有消息触达必须execute频次upper limit, 防止notification疲劳
- **ADR-Domain-Latency-Tier-Classification** — 每个域必须声明延迟层级 (超低延迟/实时/准实时/批handle) , 平台据此分配资源和调度strategy
- **ADR-Healthcare-Physician-Review-Mandatory** — 医疗健康域所有诊疗建议必须经执业医师审核后才能呈现给患者, Agent 只提供"医疗信息"而非"医疗意见"
- **ADR-Content-Moderation-CSAM-Immediate-Report** — content审核域检测到 CSAM content必须在 1 分钟内上报至指定机构, 零容忍零延迟
- **ADR-HR-Bias-Audit-Mandatory** — 人力资源域招聘/晋升决策必须via偏见审计 (Adverse Impact Ratio ≥ 0.8) , 禁止未经审计的auto化决策
- **ADR-Supply-Chain-Forecast-Approval-Before-Procurement** — 供应链域大额采购订单必须based on审批via的需求预测, 禁止 Agent 自行触发超阈值采购
- **ADR-Live-Streaming-Realtime-Moderation-SLA** — 在线直播域实时流审核延迟必须 < 2s, 违规content必须在检测后 5s 内execute下架/断流
- **ADR-Game-Publishing-Multi-Platform-Compliance** — 游戏上架域每个目标平台必须independentvia合规check (年龄分级/content审核/支付合规) , 禁止跨平台复用审核结果
- **ADR-Customer-Service-Escalation-Timeout** — 客户服务域 Agent 无法在 3 轮对话内解决问题必须auto转接人工坐席, 禁止无限循环
- **ADR-IT-Operations-Blast-Radius-Limit** — IT ops域auto修复操作爆炸半径limit为单节点/单服务, 跨域操作必须人工审批
- **ADR-Education-Minor-Data-Protection** — 教育培训域涉及未成年人data必须遵循 COPPA/未成年人保护法, data收集最小化且需监护人同意
- **ADR-Creative-Production-IP-Verification** — 广告素材制作域所有 AI 生成content必须via版权/商标侵权check, 禁止uses未authorization素材
- **ADR-Game-Dev-IP-Similarity-Check** — 游戏开发域 AI 生成美术资产必须via已知 IP 相似度检测, 防止版权侵权
- **ADR-Marketing-Brand-Consistency-Check** — 市场营销域所有对外发布content必须via品牌调性一致性check和广告法合规检测

---

# 35. 推荐代码目录

目录树是目标态index, 不是一次性 scaffold 清单. MVP 只创建实际交付所需目录, 避免 24 域和futuremodule产生空壳. 

MVP 目录子集: 

```text
src/platform/contracts
src/platform/five-plane-orchestration/harness
src/platform/five-plane-orchestration/harness/runtime
src/platform/five-plane-orchestration/harness/eval-harness
src/platform/five-plane-orchestration/harness/durable
src/platform/five-plane-orchestration/harness/hitl-runtime
src/platform/execution
src/platform/state-evidence
src/platform/control-plane
src/platform/model-gateway
src/domains/registry
src/domains/business-pack
src/packs/core
tests/invariants
tests/contracts
tests/replay
tests/side_effects
tests/budget
```

Hardening 增量目录只在对应能力进入implementation时创建: 

```text
src/platform/incident
src/platform/projections
src/platform/config-center
src/org-governance
src/interaction
tests/dlq
tests/projection_rebuild
tests/org_governance
```

Enterprise 增量目录只在规模化能力进入implementation时创建: 

```text
src/scale-ecosystem
src/ops-maturity
src/domains/<domain>
tests/multi_region
tests/marketplace
tests/edge_runtime
```

24 个垂直域目录按产品化接入节奏创建; 未进入试点的域只保留文档规范和 DomainDescriptor 示例, 不创建空implementation目录. 

```text
src/
  apps/                # 应用级entry与聚合
  benchmarks/          # 基准testing与性能实验
  core/                # 通用runtime抽象/compatibility层
  platform/
    interface/          # P1
      api/
      webhook/
      scheduler/
      console-backend/
      ingress/

    control-plane/      # P2
      tenant/
      iam/
      policy-center/
      approval-center/
      rollout-controller/
      incident-control/
      replay-repair-control/
      config-center/
      audit-export/
      shared/

    orchestration/      # P3
      oapeflir/          # OAPEFLIR 语义框架与投影适配 (canonical path) 
        stage-rationale/
        trace-projection/
        semantic-contracts/
        audit-view/
        harness-adapter/
      planner/
      replan/
      routing/
      escalation/
      hitl/
      agent-delegation/
      harness/            # Harness Runtime (P3 唯一可executeruntime子域) 
        runtime/            # HarnessRuntime 主entry
        protocol/           # Harness contract (HarnessRun/HarnessStep/HarnessDecision/PlanBundle/WorkProduct/EvaluationReport/FeedbackEnvelope) 
        planner/            # Planner Agent implementation
        generator/          # Generator Agent implementation
        evaluator/          # Evaluator Agent implementation
        eval-harness/       # Evaluation Harness (预发布评测/版本对比/TaskOutcomeGrader) 
        loop/               # HarnessLoopController
        context/            # ContextAssembler + ContextSnapshot
        memory-namespace/   # Working/Long-term/Shared Knowledge 三层记忆 + MemoryPromotionPolicy
        constraints/        # ConstraintEngine + ConstraintPack 装配
        guardrails/         # 五层 Guardrails (input/planning/tool/memory/output) 
        toolbelt/           # ToolbeltAssembler + 工具reliability画像
        hitl-runtime/       # HITL Runtime (inspect/patch/override/takeover/resume) 
        durable/            # Durable Harness (pause/resume/checkpoint strategy) 
        async/              # Async Harness (create_run/poll/subscribe/intervene) 
        recovery/           # Harness Recovery Controller
        runtime/plan-graph-harness-runtime.ts # PlanGraph / scheduler / NodeRun MVP runtime
        runtime/intake-admission-service.ts   # RequestEnvelope admission
        runtime/runtime-entry-guard.ts        # legacy bypass guard

    oapeflir/           # deprecated re-export barrel (若exists, only转发到 orchestration/oapeflir) 
      index.ts

    execution/          # P4
      dispatcher/
      execution-engine/
      worker-pool/
      tool-executor/
      plugin-executor/
      adapter-executor/
      browser-executor/
      human-wait-executor/
      recovery/
      # 注: scheduler 在 interface/scheduler/ 下

    state-evidence/     # P5
      truth/
      events/
      projections/
      artifacts/
      memory/
      knowledge/
      audit/
      incident/        # (plan中)
      checkpoints/     # (plan中)
      dlq/             # (plan中)

    shared/             # X1 横切织网 (观测, cached, 事件总线, reliability) 
    cost-management/    # 成本治理与预算护栏
    prompt-registry/    # Prompt 资源注册表compatibility层
    stability/          # 稳定性/降级/容错strategy

    model-gateway/      # LLM 抽象层
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt manage
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # 合规与data治理
      crypto-shredding/
      data-residency/  # (plan中)
      erasure/          # (plan中)
      encryption/       # (plan中)
      lineage/          # (plan中)

    contracts/          # 平面间contract
      request-envelope/
      control-directive/
      execution-plan/
      execution-receipt/
      state-command/
      delegation-request/
      model-request/

  domains/                # 业务域建模
    registry/             # DomainDescriptor 注册与生命周期
    risk-profile/         # DomainRiskProfile 领域risk画像
    knowledge-schema/     # DomainKnowledgeSchema 领域知识结构
    eval-framework/       # DomainEvalFramework 领域评估
    prompt-library/       # DomainPromptLibrary 领域 Prompt 库
    recipes/              # DomainRecipe 原型模板
    interaction-policy/   # DomainInteractionPolicy 跨域strategy
    governance/           # DomainGovernancePolicy 领域治理
    coding/               # 代码研发域实例
    operations/           # 通用运营域实例 (区别于 it-operations 的 SRE/DevOps 专项域) 
    quant-trading/        # 量化交易域实例 (§71)
    ecommerce/            # 电商域实例 (§72)
    advertising/          # 广告推广域实例 (§73)
    financial-services/   # 金融服务域实例 (§74)
    data-engineering/     # datahandle域实例 (§75)
    user-operations/      # user运营域实例 (§77)
    industry-research/    # 行业调研域实例 (§78)
    academic-research/    # 学术调研域实例 (§79)
    knowledge-base/       # 企业知识库域实例 (§80)
    finance-accounting/   # 财务域实例 (§81)
    legal/                # 法务域实例 (§82)
    live-streaming/       # 在线直播域实例 (§83)
    creative-production/  # 广告素材制作域实例 (§84)
    game-dev/             # 游戏开发域实例 (§85)
    game-publishing/      # 游戏上架域实例 (§86)
    human-resources/      # 人力资源域实例 (§87)
    supply-chain/         # 供应链与物流域实例 (§88)
    healthcare/           # 医疗健康域实例 (§89)
    education/            # 教育培训域实例 (§90)
    customer-service/     # 客户服务域实例 (§91)
    content-moderation/   # content审核与安全域实例 (§92)
    it-operations/        # IT ops SRE/DevOps 域实例 (§93)
    marketing/            # 市场营销与品牌域实例 (§94)
    agriculture/          # 孵化域: 农业
    executive-assistant/  # 孵化域: 高管助理
    facilities/           # 孵化域: 设施/园区
    manufacturing/        # 孵化域: 制造
    product-management/   # 孵化域: 产品manage
    project-management/   # 孵化域: 项目manage
    quality-assurance/    # 孵化域: 质量保障
    business-pack/        # 元域: Business Pack 运行模型
    canonical-meta-model/ # 元域: 规范化元模型
    roadmap/              # 路线graph与落地编排

  interaction/            # 智能交互层
    nl-gateway/           # 自然语言taskentry
      intent-parser/
      slot-resolver/
      ambiguity-handler/
    goal-decomposer/      # 目标分解引擎
      planner/
      dependency-graph/
      validator/
    proactive-agent/      # 主动式 Agent 框架
      trigger-engine/
      schedule-manager/
      event-watcher/
    autonomy/             # 渐进式自主权
      trust-scorer/
      level-manager/
      promotion-engine/
    dashboard/            # 统一运营看板
      metric-aggregator/
      health-scorer/
      alert-router/
    ux/                   # 非技术user体验
      wizard/
      template-engine/
      onboarding/

  org-governance/         # 组织治理层
    org-model/            # 组织层次模型
      hierarchy/
      org-node/
      sync/
    approval-routing/     # 组织架构审批路由
      route-engine/
      escalation/
      delegation/
    sso-scim/             # SSO/SCIM 集成
      saml/
      oidc/
      scim-sync/
    compliance-engine/    # 分部门合规strategy引擎
      policy-resolver/
      inheritance/
      audit-enforcer/
    knowledge-boundary/   # 知识域隔离与受控shared
      boundary-manager/
      sharing-gate/
      access-log/
    delegated-governance/ # 分级治理委托
      scope-manager/
      delegation-registry/

  scale-ecosystem/        # 规模化运行层 + 生态层
    multi-region/         # 多 Region 部署
      region-router/
      data-replicator/
      failover-controller/
    resource-manager/     # 资源竞争manage
      fair-queue/
      quota-enforcer/
      preemption/
    sla-engine/           # SLA 分级保障
      tier-resolver/
      resource-allocator/
      breach-detector/
    marketplace/          # Agent 市场与生态
      catalog/
      certification/
      publisher/
    feedback-loop/        # 反馈驱动持续改进
      collector/
      analyzer/
      improvement-tracker/
    integration/          # 外部system集成框架
      connector-registry/
      connector-runtime/
      health-monitor/

  ops-maturity/           # 运营成熟度层
    explainability/       # Agent 可解释性
      evidence-collector/
      causal-chain-builder/
      explanation-renderer/
      explanation-cache/
    emergency/            # 紧急制动
      panic-controller/
      forensic-snapshot/
      resume-protocol/
    agent-lifecycle/      # Agent 统一生命周期
      agent-registry/
      version-manager/
      canary-controller/
      retirement/
    edge-runtime/         # 离线与边缘部署
      edge-orchestrator/
      edge-executor/
      local-model/
      sync-queue/
    drift-detection/      # 行为drift检测
      fingerprint-builder/
      changepoint-detector/
      cross-agent-analyzer/
    cost-optimizer/       # 成本归因与优化
      attribution-engine/
      recommendation-engine/
      simulator/
    workflow-debugger/    # 可视化调试器
      timeline-renderer/
      breakpoint-manager/
      run-comparator/
    compliance-reporter/  # 合规报告引擎
      template-registry/
      evidence-mapper/
      report-renderer/
    capacity-planner/     # 容量规划
      trend-analyzer/
      forecaster/
      simulator/
    multimodal/           # 多模态能力
      image-processor/
      speech-processor/
      document-parser/
      modality-router/
    platform-ops-agent/   # 平台自ops Agent
      incident-diagnoser/
      config-optimizer/
      capacity-predictor/
      dev-assistant/
      health-monitor/

  plugins/
    adapters/
    retrievers/
    planners/
    evaluators/
    presenters/

  sdk/                  # SDK
    pack-sdk/
    plugin-sdk/
    client-sdk/
    cli/

  apps/
    api/
    console/
    workers/
  testing/
  types/
```

补充说明: 

- `src/platform/five-plane-orchestration/harness/` 是 P3 Harness Runtime 的 canonical implementation path, 承载 HarnessRun, PlanGraph, NodeRun, Budget, SideEffect, Replay 等生产语义; 新增 Harness runtime implementation不得写入 `src/platform/harness/`. 
- `src/platform/five-plane-orchestration/oapeflir/` 是 OAPEFLIR 语义框架, StageRationale, TraceProjection 与审计视graph的 canonical path. 
- `src/platform/oapeflir/` 如exists, 只能作为 deprecated re-export barrel 保留, 新增implementation不得写入该目录. 
- `§71-§94` 只作为 **24 个产品化垂直域** 的历史compatibility章节和示例index; 可execute域规范entry以 `docs_zh/domains/<domain>/domain-spec.md` 的independent Domain Spec 为准. 
- `src/domains/` 中额外exists的目录属于孵化域, 元域或平台性支撑目录, 不要求与 `§71-§94` 一一对应. 

---

# 36. risk, 约束与success标准

## 36.1 主要risk

以下列表是risk目录; 进入实施 backlog 时必须转换为 `RiskRegister` record: 

```yaml
risk_id:
severity: P0 | P1 | P2 | P3
likelihood: low | medium | high
impact:
owner:
mitigation:
test_or_drill:
status: open | mitigated | accepted | transferred
review_after:
trigger:
linked_invariant:
linked_test:
```

- 模型output不稳定
- 工具副作用不可控
- 恢复链路不足导致auto化不可托底
- projection 偏差被误当真相
- 误学习导致行为drift
- 多tenant隔离不彻底
- Pack 模型不收敛导致平台被业务反侵入
- 预算失控
- replay / rebuild 误操作放大问题
- **PlanGraph validation不足导致 deadlock, 不可达 terminal 或missing补偿path**
- **Graph Scheduler 非确定性导致 replay 与线上executeinconsistent**
- **SideEffect ambiguous 被误判为success导致外部statedrift**
- **Budget reservation missing导致 retry / replan 放大成本**
- **RunVersionLock missing导致事故回放无法复现**
- **LearningCandidate pollute holdout, PII 或 secret 后进入线上**
- **LLM provider 全面不可用导致平台瘫痪**
- **Prompt 变更引入行为回归**
- **LLM 成本失控 (token 超支) **
- **Agent 委托链递归失控**
- **NL Intent 解析歧义导致errortask创建**
- **目标分解递归过深导致task爆炸**
- **主动式 Agent 无限触发形成风暴**
- **渐进式自主权误升级导致高risk动作失控**
- **组织架构变更synchronous延迟导致审批路由error**
- **知识隔离configureerror导致跨部门dataleaks**
- **治理权委托rangetoo large导致安全降级**
- **跨 Region data复制延迟导致一致性问题**
- **资源竞争manage失效导致高优先级task饥饿**
- **Marketplace malicious Pack via认证后造成安全事件**
- **解释管线 LLM call成本失控 (频繁 forensic-level 解释) **
- **紧急制动误触导致全平台无故停机**
- **Agent 复合版本灰度testingcoverage不足导致组合missing陷逃逸**
- **EdgeRuntime 离线state积累大量 side effect, 连接恢复时conflict爆炸**
- **行为drift检测false positive导致 Agent 频繁降级影响业务**
- **多模态content安全check漏判导致违规contentoutput**
- **量化交易域 Agent 下错单导致灾难性财务损失 (乌龙指) **
- **金融服务域 AML 漏检导致巨额监管罚款**
- **法务域 Agent output被当作法律意见uses (非authorization执业risk) **
- **电商域定价 Agent 设置极端低价在法律上构成约束力**
- **学术调研域references捏造构成学术欺诈**
- **财务域error记账导致财报错报和审计failure**
- **企业知识库域permissions泄露导致机密文档被非authorizationuser检索**
- **广告推广域竞价error导致预算在低质流量上耗尽**
- **医疗健康域 Agent output被当作诊疗意见uses导致误诊/延误治疗 (生命安全risk) **
- **content审核域漏检 CSAM 等违法content导致刑事责任和平台关停**
- **人力资源域招聘 Agent 算法偏见导致system性歧视和法律诉讼**
- **在线直播域违规content未及时下架导致监管处罚和社会舆论事件**
- **供应链域需求预测严重偏差导致大规模库存积压或断货**
- **IT ops域auto修复操作扩散导致级联故障 (爆炸半径失控) **
- **客户服务域 Agent 提供error信息或承诺导致企业法律和经济risk**
- **教育培训域涉未成年人data泄露导致 COPPA/未成年人保护法违规**
- **游戏开发域 AI 生成资产侵犯已有 IP 版权导致法律纠纷**
- **游戏上架域年龄分级error导致未成年人接触不当content**
- **市场营销域品牌危机公关失当导致企业声誉不可逆损害**

## 36.2 硬约束

硬约束按execute方式分层, 避免把机器可验证不变量, strategy规则, 人工流程和领域合规混成一类: 

| 层级 | execute方式 | 示例 |
| --- | --- | --- |
| machine-enforced invariant | 代码, schema, state机, CI autoreject | CAS + Lease + Fencing, Replay 不产生真实副作用, 终态不可迁出 |
| policy-enforced rule | Policy Engine / Approval Engine 判定 | 高risk动作审批, data驻留, 预算upper limit, egress allowlist |
| human-governed process | 人工签核, 演练, 复核, 事故报告 | break-glass 复核, 合规报告签核, 律师/医师审核 |
| domain-specific compliance | 域规范和监管证据 | CSAM 上报, SOX SoD, PHI 隔离, 交易热path无 LLM |

- Runtime 只消费发布态定义
- Projection 不反写真相
- Learn 不directly驱动线上变更
- Secret 不进入 Memory / Knowledge / 对外 Artifact
- 所有外呼经过 egress control
- 所有 side effect 都必须对象化record
- 高risk动作必须审批或explicitly deny
- CAS + Lease + Fencing 为写回硬约束
- 平面间通信必须via正式contract对象
- **所有 LLM call必须via ModelGateway**
- **Prompt 变更必须via质量门禁**
- **LLM 成本必须按 tenant 计量**
- **Agent 委托深度 ≤ 3**
- **PII data删除via crypto-shredding implementation**
- **NL 输入必须经过 Intent 解析生成 TaskDraft, 并在userconfirmation后形成 TaskSpec / RequestEnvelope(§5.3), 禁止原始text直传**
- **目标分解递归深度 ≤ 5**
- **主动式 Agent 必须绑定 TriggerPolicy**
- **自主权等级defaultmonotonic递增; 降级only限 §42.2 安全触发条件, execute后须人工审批confirmation**
- **所有资源归属必须关联 OrgNode**
- **合规strategy沿组织树向下继承, 子节点只能收紧**
- **知识域default隔离, 跨部门shared需explicitlyauthorization**
- **SSO 为唯一identity来源**
- **每个 tenant 必须指定 Home Region**
- **Marketplace Pack 必须via认证后才能上架**
- **外部system集成必须via统一 Connector 框架**
- **OAPEFLIR 每个阶段必须生成 StageRationale**
- **PlatformPanicDirective 同 Region < 5s, 跨 Region < 15s 停止全平台**
- **Agent 发布和rollback以 AgentVersion (复合快照) 为单位**
- **EdgeRuntime 离线模式 risk_level ≤ medium**
- **每个 Agent 必须maintained BehaviorFingerprint**
- **多模态output必须经过content安全check**
- **PlatformOps Agent default只读, 生产写操作需人工审批**
- **量化交易域必须有盘前风控check和硬性仓位/损失限额**
- **金融服务域所有不利信贷决策必须可解释且可人工复查**
- **法务域所有 Agent output必须经执业律师审核后才能外发**
- **财务域必须execute职责分离 (创建人≠审批人) **
- **电商域价格变动超阈值必须人工审批**
- **学术调研域references必须可解析到真实论文 (零捏造容忍) **
- **企业知识库域必须镜像源system文档级permissions**
- **医疗健康域所有诊疗建议必须经执业医师审核, Agent 不得替代医嘱**
- **content审核域 CSAM 检测后 1 分钟内必须上报, 零容忍零延迟**
- **人力资源域招聘/晋升决策必须via偏见审计 (AIR ≥ 0.8) **
- **在线直播域违规content检测后 5s 内必须execute下架/断流**
- **供应链域超阈值采购订单必须based on审批via的需求预测**
- **IT ops域auto修复爆炸半径limit为单节点/单服务**
- **客户服务域 3 轮未解决必须转接人工坐席**
- **教育培训域涉未成年人data需监护人同意且最小化收集**
- **游戏上架域每个目标平台必须independentvia合规check**
- **广告素材域 AI 生成content必须via版权/商标侵权check**
- **市场营销域对外content必须via品牌调性一致性check和广告法合规检测**
- **复杂task Plan 必须是 PlanGraph, 不allows线性 steps directlyexecute**
- **PlanGraph 必须经过 Normalize / Validate / Risk Propagation / Worst-Path Analysis**
- **Graph Scheduler 决策必须可 Trace Replay**
- **所有 HarnessRun / NodeRun state迁移必须 Event-driven**
- **终态 HarnessRun / NodeRun 不得迁出**
- **Retry / Redrive 必须追加 AttemptLineage, 不得coverage旧record**
- **LLM / Tool / SideEffect / Evaluation 前必须 reserve budget**
- **SideEffect ambiguous 不得auto视为success**
- **不可逆副作用必须支持 confirmation / reconciliation / manual review**
- **Replay 不得产生真实副作用**
- **DecisionInputBundle 必须冻结后才能裁决**
- **Planner / Generator / Evaluator 必须usesindependent ContextAssemblyContract**
- **Prompt / Policy / Tool / Domain 改进不得bypass EvaluationGate directly上线**

## 36.3 success标准

所有success标准必须能映射到auto化testing, 演练record, 审计证据或人工签核record; 不能验证的描述只能作为目标说明, 不得作为 gate. 

平台success标准与域success标准分离: 平台核心只看 Harness / State / Evidence / Governance 的可运行闭环; 24 域, 12 原型和域 GA 数量按 domain wave 验收, 不得反向blocks核心平台投产. 

Ring 1 / Ring 2 / Ring 3a / Ring 3b / Ring 3c 是本节的权威 gate naming; 旧 Phase 1-9 只保留为历史映射. MVP 只要求 Ring 1 中与 Harness 可execute闭环有关的最小切片; 24 域 GA 属于 Ring 3c 扩张 gate, 以 `N/24 domains GA` 作为进度指标, 不blocks核心平台投产. 

### Phase 1 success标准

- HarnessRun 可稳定创建和推进; workflow_run only作为只读 projection 可query
- lease timeoutauto reclaim
- CAS conflict被正确reject

### Phase 2 success标准

- HarnessRuntime 主链端到端跑通, OAPEFLIR StageRationale 可由事件投影生成
- worker crashed后 30s 内恢复
- 高risk动作可被审批阻断

### Phase 3 success标准

- incident / replay / repair / DLQ 可运营
- 外部dependency熔断→降级→恢复auto化
- projection 可重建且data一致

### Phase 4 success标准

- 50 concurrent workflow 稳定运行
- Load test 符合 SLO
- 容灾演练 RTO < 10min

### Phase 5 success标准

- 非技术user可via自然语言创建和managetask
- 目标分解引擎auto将业务目标拆解为可executetaskgraph
- 主动式 Agent 按 TriggerPolicy auto触发且无风暴
- 渐进式自主权 Level 0→3 升级path端到端验证
- 组织架构三级层次 (公司→部门→团队) 正确驱动审批路由
- SSO/SCIM autosynchronoususer且停用账户 < 5min 生效
- 知识域隔离零leaks, 受控shared审计完整

### Ring 3a success标准 (历史 Phase 6) 

- 双 Region 单 leader / follower read 部署, 受控 failover 演练via, 单 Region 故障 RTO < 5min
- active-active onlyused for非 truth 的cached, 遥测或聚合统计
- 1000 concurrent workflow 下高优先级task不饥饿
- SLA Tier P0 task 99.9% 在承诺时间内完成
- Internal Pack Registry 至少 3 个核心 Pack via认证; 外部 Marketplace 20 个认证 Pack 属于 Enterprise/Future independent gate
- user反馈→改进闭环 < 7 天
- 预构建 Connector coverage P0 类别全部system

### Ring 3b success标准 (历史 Phase 7) 

- user可对arbitrary workflow step query解释, L1 延迟 < 2s, L3 延迟 < 10s
- 紧急制动演练: 同 Region 全平台停止 < 5s, 恢复 < 30min
- AgentVersion 复合灰度发布端到端验证 (canary→active auto晋升) 
- EdgeRuntime 在断网 24h 后恢复连接, datasynchronous零loss
- 行为drift检测coverage success_rate_drop, override_rate_spike, cost_spike, tool_usage_shift, incident_count 五类 MVP 指标; 高级统计阈值需声明样本量和false positivehandle
- 成本优化建议节省率 ≥ 20% (对比未优化基线) 
- 合规报告 SOC2 Type II 全auto生成, 控制点coverage率 ≥ 95%
- 容量预测 30 天准确度 ≥ 85%
- 多模态: graph片analysis + 语音转文字端到端可用
- PlatformOps Agent L1 成熟度验证: auto诊断报告生成 < 5min

### Ring 1 / Ring 2 success标准 (历史 Phase 8) 

- Harness Runtime 端到端可运行: ConstraintPack 加载 + Planner→Generator→Evaluator 闭环 + HarnessDecision 裁决
- HarnessRun / HarnessStep 全部fieldpersistence且可query
- Durable Harness 5 种 pauseReason 全部有testingcoverage
- HITL Runtime 5 种介入模式 (inspect/patch/override/takeover/resume) 可用
- Async Harness 休眠/唤醒端到端验证
- Evaluation Harness 沙箱评测 + 版本对比报告可生成
- Guardrails 五层均有拦截testingcoverage
- Harness Replay 可完整回放已完成 run
- 十条不变量auto化checkvia (violates即 CI failure) 
- Tool Harness Capability Profile coverage所有已注册工具
- Phase 8d 验收: HarnessRun / NodeRun state机, PlanGraph, Event Registry, Budget Ledger, SideEffect Reconciliation, EvaluationGate, Runtime Test Matrix 均有auto化coverage
- Replay 验证不产生真实 side effect, 且 Trace Replay 可重建 scheduler decision

### Ring 3c success标准 (历史 Phase 9) 

- 24 个垂直业务域全部达到 GA state (via §38 四阶段门禁) 
- 12 种 DomainRecipe 原型模板全部有至少一个域实例验证via
- Critical risk域 (量化交易/金融服务/财务/法务/医疗健康) HITL coverage率 100%
- 跨域交互矩阵 24×24 验证via, 无未authorizationdata流
- 每个域的 eval 所有质量轴达到各自 acceptance_threshold
- 量化交易域超低延迟path < 10ms (不含 LLM call) 
- 法务域所有output 100% 经执业律师审核后才可外发
- 学术调研域references准确率 100% (零捏造) 
- 医疗健康域所有诊疗建议 100% 经执业医师审核
- content审核域 CSAM 上报 100% 在 1 分钟内完成
- 人力资源域招聘流程偏见审计全部via (AIR ≥ 0.8) 
- IT ops域auto修复 MTTR 降低 ≥ 30%
- 客户服务域首次解决率 ≥ 70%

---

# Part XI — 结论与附录

---

# 70. 结论

这不是"一个会auto做事的 Agent 平台", 而是: 

> **一个把 Agent 当作高riskauto化单元进行严格控制, 隔离, 恢复, 审计和治理的企业操作system -- 从一人公司到万人企业, 以十层架构coverage基础设施, AI 运营, 业务域接入, 垂直业务域深化, 智能交互, Harness 工程化, Harness 八支柱深化, 组织治理, 规模化生态, 运营成熟度的全栈能力. **

它的核心不是"多智能", 而是: 

- default保守
- 高risk必须受控
- 异常必须分类handle
- execute必须可恢复
- state必须可回放
- 行为必须可审计
- 平台必须可降级
- 业务必须可插拔但不可bypass底座
- **业务域必须被结构化理解, 而非视为opaque黑盒**
- **非技术user必须能directlyuses, 无需理解底层架构**
- **组织治理必须适配企业层级, 而非假设扁平结构**
- **规模化运行必须有资源公平调度和 SLA 差异化保障**
- **Agent 决策必须可解释, 行为drift必须可检测**
- **平台必须能紧急制动, Agent 必须有统一生命周期**
- **离线/边缘场景必须可运行, 断网不等于停摆**
- **多模态输入output必须纳入统一安全管控, 不可bypasscontent审查**
- **Agent 能力必须工程化 -- 一次性模型call必须升级为受约束, 可execute, 可记忆, 可反馈, 可恢复, 可评测, 可介入, 可观测的 Harness 八支柱闭环system**
- **OAPEFLIR 必须可落地为 Harness 语义约束与审计投影 -- 复杂task的认知阶段, 阶段理由, risk传播, 对账解释和学习发布治理必须能由 HarnessRun / PlanGraph / Event Registry 派生, 而不是形成第二套executeruntime**
- **业务域必须以统一元模型描述(§37.11) -- 15 问模板确保 24 域结构一致, configure驱动, 新域可模板化接入**
- **多 Agent 协作必须遵循force协议(§19.5) -- permissions不扩大, risk不提升, 约束不bypass, 审计不断链**
- **实施必须分环推进 -- 生存环保底, 可用环试点, 扩张环规模化, 避免面面俱到导致无一落地**

v4.3 的success不是一次性coverage全部域, 全部市场能力和全部运营成熟度, 而是先形成稳定的 Harness + State + Evidence + Governance 最小闭环; 只有这个闭环可testing, 可审计, 可恢复, 24 域和生态扩张才有安全基础. 

### 十层架构总览

| 层次                  | 解决问题                    | 核心章节                | 文档分篇  |
| --------------------- | --------------------------- | ----------------------- | --------- |
| 基础设施层            | 平台怎么搭                  | §4-§14, §24-§32         | Part I    |
| AI 运营层             | AI 怎么运营                 | §15-§23                 | Part II   |
| 业务域接入层          | 业务怎么接                  | §37-§38                 | Part III  |
| **垂直业务域深化层**  | **24 个垂直域怎么落地深化** | **§71-§94**             | Part IV   |
| 智能交互层            | user怎么用                  | §39-§44                 | Part V    |
| Harness 工程化层      | 能力怎么收口                | §45.1-45.12, §58.1-58.5 | Part VI   |
| Harness 八支柱深化层  | 能力怎么深化                | §45.13-45.21, §58.6     | Part VI   |
| 组织治理层            | 组织怎么管                  | §46-§51                 | Part VII  |
| 规模化运行层 + 生态层 | 规模怎么扛 + 生态怎么建     | §52-§57                 | Part VIII |
| 运营成熟度层          | 怎么用好 + 怎么安全运行     | §59-§69                 | Part IX   |

### Harness 八支柱能力总结

| 问题                     | 改进前                                                | 当前                                                                |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Harness 定义模型?        | 五元组 (Constraints+Tools+Context+Feedback+Recovery)  | 八支柱 (+Durability+Evaluation Harness+HITL Runtime+Observability)  |
| 运行和step有一级contract吗?  | only HarnessRunRequest                                  | §45.13 HarnessRun/HarnessStep 完整生命周期                          |
| 裁决有统一协议吗?        | LoopController 五种output                               | §58.6 HarnessDecision 六种裁决标准化                                |
| 离线评测能力?            | onlyruntime Evaluator                                    | §45.14 Evaluation Harness (预发布+版本对比+outcome assertion)            |
| 长时task怎么暂停恢复?    | Recovery Controller 故障恢复                          | §45.15 Durable Harness (5 种 pauseReason + 4 种 resumeStrategy)     |
| 记忆怎么分层治理?        | HarnessContext 四类上下文                             | §45.16 Memory Namespace (Working/Long-term/Shared + 晋升strategy)       |
| 工具怎么被治理?          | ToolbeltAssembler 装配                                | §45.17 Tool Harness (Capability Profile + 生命周期 + 信任度)        |
| 人机协作是什么级别?      | escalate 到 §21 HITL                                  | §45.18 HITL Runtime (inspect/patch/override/takeover/resume)        |
| 异步task怎么manage?        | 无explicitly异步模式                                        | §45.19 Async Harness (create/poll/subscribe/intervene)              |
| 护栏在哪里execute?          | 隐含在 ConstraintPack                                 | §45.20 Guardrails 五层 (input/planning/tool/memory/output)          |
| 有底线规则吗?            | 分散在各 ADR                                          | §45.21 十条不变量                                                   |
| OAPEFLIR 是否可execute?     | 受控认知流程                                          | 不作为independentexecuteruntime; execute权威为 HarnessRuntime, OAPEFLIR only提供 StageRationale / TraceProjection / Audit View |
| 副作用state不确定怎么办?  | 工具success即视为完成                                    | SideEffect Manager + Reconciliation + Compensation, 不把 ambiguous 当 success |

只有同时具备**基础设施层的稳定性**, **AI 运营层的可控性**, **业务域接入层的结构化**, **垂直业务域深化层的领域专精**, **智能交互层的易用性**, **Harness 工程化层的标准化**, **Harness 八支柱的深化**, **组织治理层的适配性**, **规模化运行层的可扩展性**和**运营成熟度层的可投产性**, 企业才能把 Agent 平台从架构设计, 升级为真正coverage一人公司到万人企业, 24 个垂直业务线的企业级生产力操作system. 

---

# 附录 G: 术语表与缩写index

术语治理state: 

| term | status | canonical_term | runtime_entity | owner_section |
| --- | --- | --- | --- | --- |
| PlanGraphBundle | canonical | PlanGraphBundle | true | §5 / §13 |
| PlanGraph | canonical | PlanGraph | true | §13 |
| NodeRun | canonical | NodeRun | true | §14 |
| NodeAttempt | canonical | NodeAttempt | true | §14 |
| HarnessStep | semantic_projection | NodeRun for execution | false | §14 / §45 |
| PlanBundle | alias | PlanGraphBundle for execution; PlanBundle only for product/debug wrapper | false | §45 |
| ExecutionPlan | deprecated | PlanGraphBundle | false | §5 |
| ControlDirective | deprecated | OperationalDirective / DecisionDirective | false | §5 |
| workflow step | deprecated | HarnessStep projection or NodeRun depending context | false | §14 |

新 schema, API, 事件和代码目录不得新增 deprecated term; 只能在compatibility adapter, 迁移脚本, 历史 ADR 和术语表中出现. 

| 缩写/术语                | 全称                                                       | 说明                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAPEFLIR                 | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release | Agent 核心循环的八个阶段(§13)                                                                                                                       |
| PlanGraph                | Harness Plan Graph                                         | HarnessRun plannerOutput 的graph结构plan模型, 也是 OAPEFLIR Plan 阶段投影视graph, 替代复杂task中的线性 steps(§13.7)                                      |
| Graph Scheduler          | Deterministic Graph Scheduler                              | based on ready node 的确定性graph调度器, 调度决策写事件并可 Trace Replay(§14.9)                                                                            |
| GraphPatch               | PlanGraph Patch                                            | 对运行中或暂停中 PlanGraph 的受控追加式变更(§13.13)                                                                                                  |
| Event Registry           | Platform + OAPEFLIR Event Registry                         | platform.* 与 oapeflir.* 事件type, payload, replay 行为和 projection 消费规则注册表(§28)                                                            |
| AttemptLineage           | Attempt Lineage                                            | retry / redrive 的追加式execute谱系(§14.14)                                                                                                             |
| Budget Ledger            | Runtime Budget Ledger                                      | 预算预留, 消耗, 释放和耗尽的运行账本(§25.9)                                                                                                          |
| SideEffect Delivery Semantics | SideEffect Delivery Semantics                        | 副作用 at-most-once / at-least-once / effectively-once 与confirmation/对账语义(§14.11)                                                                       |
| Reconciliation           | Reconciliation State Machine                               | 外部副作用state不确定时的对账机制(§14.12)                                                                                                             |
| ContextAssemblyContract  | Context Assembly Contract                                  | 面向 Planner / Generator / Evaluator 的上下文装配contract(§45.23)                                                                                        |
| PromptExecutionContract  | Prompt Execution Contract                                  | Prompt 角色, 版本, 上下文 taint, output schema 的executecontract(§45.24)                                                                                      |
| DecisionInputBundle      | Decision Input Bundle                                      | DecisionEngine 冻结后的统一裁决输入(§45.25)                                                                                                          |
| HumanResponsibilityRecord | Human Responsibility Record                               | 人工审批, coverage, 接管后的责任边界record(§45.27)                                                                                                         |
| EvaluationGate           | Evaluation Gate                                            | 发布前质量, 成本, 安全, 回归门禁(§45.14, §58.10)                                                                                                     |
| LearningCandidate        | Learning Candidate                                         | Learn 阶段产生的候选经验对象, 需隔离, 评测, 审批后才能上线(§13.14)                                                                                   |
| HITL                     | Human-In-The-Loop                                          | 人机协作模式, 人工参与 Agent 决策链(§21)                                                                                                            |
| DLQ                      | Dead Letter Queue                                          | 死信队列, 无法handle的消息/事件的暂存区(§28.8)                                                                                                        |
| CAS                      | Compare-And-Swap                                           | optimisticconcurrent控制原语, used for StateMutationCommand 幂等写入(§5.4)                                                                                          |
| SLO / SLA                | Service Level Objective / Agreement                        | 服务水平目标/协议(§27, §54)                                                                                                                         |
| SEV1-4                   | Severity 1-4                                               | 事件严重等级 (1 最高) (§12)                                                                                                                         |
| TTFT                     | Time To First Token                                        | LLM 流式response中首 token 到达延迟(§27.7)                                                                                                              |
| SCC                      | Standard Contractual Clauses                               | GDPR 标准合同条款, 跨境data传输法律机制(§52.4)                                                                                                      |
| BCR                      | Binding Corporate Rules                                    | 约束性企业规则, 集团内跨境data传输机制(§52.4)                                                                                                       |
| DPIA                     | Data Protection Impact Assessment                          | data保护影响评估(§52.4)                                                                                                                             |
| PIPL                     | Personal Information Protection Law                        | 中国个人信息保护法(§52)                                                                                                                             |
| WCAG                     | Web Content Accessibility Guidelines                       | 无障碍访问指南(§44.6)                                                                                                                               |
| SCIM                     | System for Cross-domain Identity Management                | 跨域identitymanage协议(§48)                                                                                                                               |
| SSO                      | Single Sign-On                                             | 单点登录(§48)                                                                                                                                       |
| RBAC                     | Role-Based Access Control                                  | based on角色的访问控制(§11)                                                                                                                             |
| DAG                      | Directed Acyclic Graph                                     | 有向无环graph, used for目标分解和taskdependency(§40)                                                                                                             |
| Pack                     | Business Pack                                              | 业务域功能包, Agent 的可部署单元(§30)                                                                                                               |
| UoW                      | Unit of Work                                               | 工作单元, transaction性操作的原子边界                                                                                                                      |
| WAL                      | Write-Ahead Log                                            | 预写log, 保障crashed恢复的persistence机制(§31)                                                                                                             |
| P1-P5                    | Plane 1-5                                                  | 五平面架构 (Interface·Control·Orchestration·Execution·State & Evidence) (§4)                                                                        |
| X1                       | Cross-cutting Fabric                                       | 横切关注面 (Reliability·Governance·Intelligence) (§4)                                                                                               |
| NL                       | Natural Language                                           | 自然语言(§39)                                                                                                                                       |
| sLLM                     | Small LLM                                                  | 小型local化语言模型, used for边缘/离线场景(§62)                                                                                                          |
| RTO / RPO                | Recovery Time / Point Objective                            | 恢复时间/点目标(§31)                                                                                                                                |
| Harness                  | Agent Harness Runtime                                      | 八支柱runtime (约束·工具·state/记忆·反馈·持久execute·评测·人机协作·可观测) (§45)                                                                         |
| PlanBundle               | Planner Agent 标准化output                                   | contains goal/taskGraph/budget/riskProfile/successCriteria(§45.8)                                                                                       |
| WorkProduct              | Generator Agent 标准化output                                 | contains nodeRunId/artifacts/observations/telemetry(§45.9)                                                                                              |
| EvaluationReport         | Evaluator Agent 标准化output                                 | contains passed/score/issues/recommendation/confidence(§45.10)                                                                                          |
| FeedbackEnvelope         | 统一反馈信封                                               | 四段反馈闭环 (Step/Task/Workflow/System 级) 的标准化output(§45.6)                                                                                     |
| ConstraintPack           | task级约束包                                               | 每次 HarnessRun 携带的explicitly约束信封(§45.3)                                                                                                           |
| Toolbelt                 | task级工具集                                               | 按最小permissionsprinciple装配的工具子集(§45.4)                                                                                                                 |
| HarnessRun               | Harness 运行实体                                           | 一次完整 Harness task运行的一级实体, 含生命周期和审计(§45.13)                                                                                       |
| HarnessStep              | Harness step实体                                           | 单个executestepcontract, 含 phase/role/inputs/outputs/rationale(§45.13)                                                                                    |
| HarnessDecision          | Harness 统一裁决                                           | 六种裁决: accept/retry/replan/escalate/downgrade/abort(§58.6)                                                                                       |
| Evaluation Harness       | 统一评测runtime                                             | runtime裁决+预发布评测+版本对比的评测system(§45.14)                                                                                                    |
| Durable Harness          | 持久execute支柱                                               | checkpoint/pause/resume 作为 Harness 基础能力(§45.15)                                                                                               |
| Memory Namespace         | 记忆naming空间                                               | Working/Long-term/Shared Knowledge 三层隔离与晋升(§45.16)                                                                                           |
| Tool Harness             | 工具治理层                                                 | 工具 Capability Profile + 生命周期 + 信任度治理(§45.17)                                                                                             |
| HITL Runtime             | 人机协作runtime                                             | inspect/patch/override/takeover/resume 五类能力(§45.18)                                                                                             |
| Async Harness            | 异步运行模式                                               | 多小时/多轮/多审批的异步 Harness execute模式(§45.19)                                                                                                   |
| Guardrails               | 分层护栏                                                   | input/planning/tool/memory/output 五层dynamiccheck点(§45.20)                                                                                            |
| DomainRecipe             | 领域模板原型                                               | 十二种原型 (CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps) (§37.7) |
| Trading Archetype        | 交易原型                                                   | 信号→风控→execute→结算工作流模式(§37.7, §71, §74)                                                                                                      |
| Compliance Archetype     | 合规原型                                                   | 监控→检测→评估→报告工作流模式(§37.7, §74, §81, §82)                                                                                                 |
| Research Archetype       | 研究原型                                                   | 收集→analysis→综合→发表工作流模式(§37.7, §78, §79)                                                                                                      |
| Adversarial Archetype    | 对抗原型                                                   | 攻击面→防御→审计→修复工作流模式(§37.7, §76, §82)                                                                                                    |
| FTO                      | Freedom-to-Operate                                         | 自由实施检索, 知识产权领域术语(§82)                                                                                                                 |
| SAR/STR                  | Suspicious Activity/Transaction Report                     | 可疑活动/交易报告, 反洗钱法规要求(§74)                                                                                                              |
| PSI                      | Population Stability Index                                 | 模型稳定性指数, 金融服务模型监控指标(§74)                                                                                                           |
| VaR/CVaR                 | Value at Risk / Conditional VaR                            | risk价值/条件risk价值, 量化交易风控指标(§71)                                                                                                        |
| ROAS                     | Return on Ad Spend                                         | 广告投资回报率(§73)                                                                                                                                 |
| MRR                      | Mean Reciprocal Rank                                       | 平均倒数排名, search质量指标(§80)                                                                                                                     |
| NDCG                     | Normalized Discounted Cumulative Gain                      | 归一化折损累积增益, search排名指标(§80)                                                                                                               |
| Moderation Archetype     | 审核原型                                                   | content摄入→多模态检测→处置→申诉工作流模式(§37.7, §83, §92)                                                                                            |
| Logistics Archetype      | 物流原型                                                   | 预测→优化→调度→追踪→异常handle工作流模式(§37.7, §86, §88)                                                                                             |
| Conversational Archetype | 对话原型                                                   | 意graph识别→知识检索→回答→反馈工作流模式(§37.7, §89, §90, §91)                                                                                         |
| IncidentOps Archetype    | 事件ops原型                                               | 告警→诊断→修复→复盘→预防工作流模式(§37.7, §93)                                                                                                      |
| CSAM                     | Child Sexual Abuse Material                                | 儿童性虐待材料, content审核领域法定force上报content(§92)                                                                                                   |
| AIR                      | Adverse Impact Ratio                                       | 不利影响比率, HR 招聘公平性指标, 合规要求 ≥ 0.8(§87)                                                                                                |
| MTTR                     | Mean Time To Repair/Resolve                                | 平均修复时间, IT ops核心效率指标(§93)                                                                                                              |
| MTTD                     | Mean Time To Detect                                        | 平均检测时间, IT ops告警效率指标(§93)                                                                                                              |
| FCR                      | First Contact Resolution                                   | 首次联系解决率, 客服核心质量指标(§91)                                                                                                               |
| AHT                      | Average Handle Time                                        | 平均handle时长, 客服效率指标(§91)                                                                                                                     |
| COPPA                    | Children's Online Privacy Protection Act                   | 美国儿童在线隐私保护法(§90)                                                                                                                         |
| SOV                      | Share of Voice                                             | 品牌声量份额, 市场营销效果指标(§94)                                                                                                                 |
| CDM                      | Canonical Domain Meta-Model                                | 统一领域元模型, 24 域uses同一 15 问模板描述(§37.11)                                                                                                 |
| ACP                      | Agent Collaboration Protocol                               | 多 Agent 协作协议, 定义 8 种消息type + 7 条不可violates规则(§19.5)                                                                                      |
| 三环实施法               | Three-Ring Implementation Priority                         | 生存环→可用环→扩张环分层实施优先级(Part X 前言)                                                                                                     |

---

# 附录 H: OAPEFLIR v4.4 Executable Spec 与 v4.2 收敛规则

OAPEFLIR v4.4 Executable Spec 是 v4.2 的历史输入与迁移来源, 不再作为directlyimplementation权威. v4.2 的运行contract以正文, Executable Runtime Contract, Schema / Zod / OpenAPI / Event Registry 为准; 附录 H 只used for说明 v4.4 能力已经落到哪些正文章节. 

conflict裁决order: 

1. Executable Runtime Contract
2. Schema / Zod / OpenAPI / Event Registry
3. Core Architecture (本文档) 
4. ADR
5. Domain Spec
6. Example / Appendix / historical spec

结构性conflict按上述order裁决; 安全, risk, 合规与data保护类conflict在不改变权威对象归属的前提下, 以更严格者为准. 

## H.1 正文落点

| v4.4 能力 | 主文档落点 |
| --- | --- |
| 八阶段职责, PlanGraph, GraphPatch, risk传播, 最坏pathanalysis | §13 |
| Graph Scheduler, NodeRun, SideEffect, Reconciliation, Compensation, AttemptLineage | §14 |
| HarnessRun / NodeRun state一致性, Budget Ledger, RunVersionLock | §25 |
| Event Registry, Replay Semantics, Projection, Incident, DLQ | §28 |
| ContextAssemblyContract, PromptExecutionContract, DecisionInputBundle, Memory Governance, HITL Responsibility | §45 |
| Error Code Taxonomy, Runtime Test Matrix | §58 |
| Phase 8d, ADR, 代码目录, 硬约束, success标准 | §33-§36 |

## H.2 v4.4 完整规范章节index

| 规范章节 | 主题 |
| --- | --- |
| 0-3 | 核心结论, 设计目标, 八阶段, 总体运行架构 |
| 4-5 | HarnessRun 收敛后的 RunStatus 投影, NodeRun state机 |
| 6-13 | PlanGraph, Graph Normalization, Validation, Risk Propagation, Worst-Path, Scheduler, GraphPatch |
| 14-17 | Event Registry, Budget Ledger, SideEffect Manager, Reconciliation State Machine |
| 18-24 | Context Assembly, Prompt Execution, LLM Decision Record, Tool Output Taint, Memory Governance, Guardrails, Decision Engine |
| 25-30 | Runtime Mode, HITL, Final Output, Causal Lineage, Run Version Lock, Effective Policy Snapshot |
| 31-33 | Learning Candidate, Evaluation Harness, Release 管线 |
| 34-38 | Error Code Taxonomy, Observability Metrics, Incident Rules, Capability Matrix, Runtime Test Matrix |
| 39-42 | implementation目录, 最小落地路线, ADR, 最终判断 |

## H.3 v4.4 对象收敛映射

v4.4 对象不按原名directly成为 v4.2 权威implementation对象; 以下映射used forconfirmation“已吸收但改名/降级/投影化”的contract边界. 

| v4.4 对象 | v4.2 收敛对象 / state | 主文档落点 |
| --- | --- | --- |
| OapeflirRun | HarnessRun; 旧名不再作为权威运行实体 | §13, §45.13, §25.9 |
| RunStatus | HarnessRun status + OapeflirTraceProjection 阶段视graph | §25.9, §13 |
| NodeRun / NodeRunStatus | NodeRun + NodeAttempt state机 | §14.1, §25.9 |
| AttemptLineage | retry / redrive 的 append-only 谱系 | §14.14, §28 |
| ObservationBundle / AssessmentBundle | Observation/Assessment 投影对象, 不拥有state | §13.2, §13.5 |
| PlanGraphBundle / PlanGraph / PlanNode / PlanEdge | canonical execution contract | §5.3, §13.6-§13.12 |
| GraphNormalizationReport | PlanGraph normalize output | §13.8 |
| GraphValidationReport | PlanGraph validate output | §13.9 |
| GraphRiskPropagationReport | graphrisk传播output | §13.10 |
| GraphWorstPathAnalysis | 最坏pathanalysisoutput | §13.11 |
| ReadyNodeSchedulingPolicy | Graph Scheduler policy | §13.12, §14.3 |
| GraphPatch / GraphPatchOperation / GraphPatchCompatibilityReport | 追加式 Replan contract | §13.13 |
| OapeflirEvent / OapeflirEventType | `oapeflir.*` projection event; truth 只能来自 `platform.*` facts | §28.2-§28.4 |
| BudgetLedger / BudgetReservation | 预算账本与原子预留 | §18, §25.10 |
| SideEffectRecord / SideEffectType / SideEffectStatus | SideEffect truth + state机 | §14.5, §28 |
| SideEffectExecutionContract / ReversibilityProfile | SideEffect delivery semantics 与可逆性画像 | §14.5 |
| ReconciliationRecord / ReconciliationStatus | 对账state机 | §14.6 |
| ContextAssemblyContract / ContextItemRef | 角色隔离上下文装配contract | §45.23 |
| PromptExecutionContract | Prompt executecontract | §45.24 |
| LlmDecisionRecord / DeterministicRuntimeSeed | LLM recordoutput与 Trace Replay 种子; default replay 复用 recorded output | §45.24, §58.4 |
| ToolOutputTaint | 工具outputpollute标签与 taint propagation | §45.23, §45.24, §45.26 |
| MemoryWriteRequest | Memory Write Governance 输入 | §45.26 |
| GuardrailHookResult | 五层 Guardrails 的 hook 结果 | §45.20, §58.10 |
| DecisionInputBundle | Decision Engine 冻结输入 | §45.25 |
| HarnessDecision | 统一裁决协议, 含生产扩展裁决 | §58.6 |
| RuntimeProfile / RuntimeMode / AutonomyMode | RuntimeProfile, 运行保护模式, 自主权模式三者分离 | §14.8, §42, §45.3 |
| HitlLock / HitlEscalationPolicy | HITL lock, timeout, escalation strategy | §21, §45.18 |
| HumanResponsibilityRecord / HumanDecision | 人工责任record与 DecisionDirective | §45.27, §5.3 |
| FinalOutputContract | Final output / artifact / evidence outputcontract | §45.9, §59, §68 |
| CausalLineageQuery | lineage / explanation / forensic query能力 | §23.6, §28, §59 |
| RunVersionLock | admitted 时冻结版本 | §25.10 |
| EffectivePolicySnapshot | 生效strategy快照 | §13.5, §24, §45.25 |
| LearningCandidate / LearningCandidateType | LearningCandidate quarantine / release gate | §13.14, §29.4, §56 |
| EvaluationGate / EvaluationReport | 发布前与runtime评测门禁 | §17, §45.10, §58.10 |
| ReleaseRecord | P2 Release Governance / rollout record | §13.2, §16, §56 |
| RepairRecord | repair / redrive / recovery 的追加证据 | §12, §14.14, §31 |
| ResumeCompatibilityPolicy | pause/resume 版本compatibilitystrategy | §20, §25.10, §45.15 |
| VerificationResult | deterministic verification / EvaluationReport 输入 | §13.9, §45.25 |
| PrincipalRef | Principal / issuedBy / actor 统一identityreferences | §5, §6.5, §45.27 |

## H.4 不可降级条款

以下条款不可降级; 其中 Run 权威对象按 v4.2 收敛为 HarnessRun, 并已移入 §2.4 ArchitectureInvariantRegistry: 

1. 复杂task Plan 必须是 PlanGraph. 
2. Graph Scheduler 决策必须可 Trace Replay. 
3. HarnessRun / NodeRun 终态不可迁出. 
4. Event append 与 truth update 必须同transaction. 
5. SideEffect ambiguous 不得视为 success. 
6. Trace Replay 不得重新call LLM / Tool; 任何 Replay 不得产生真实 side effect. 
7. LearningCandidate 不得directly上线. 
8. LLM-as-Judge 不得coverage确定性failure. 

---

# 附录 A: 版本变更历史

| 版本 | 日期       | 变更content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-04    | 初始五平面架构 + 稳定性七层 + OAPEFLIR 概念设计                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v1.1 | 2026-04    | 增加risk矩阵, DLQ 模型, 部署建议                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.2 | 2026-04    | 增加data模型 44 表, 事件naming空间, ADR 建议, 推荐目录                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.0 | 2026-04-18 | **基础设施改善版**: 新增平面间通信contract(§5), API contract(§6), 服务通信(§7), 可扩展性(§8), configure治理(§24), 性能 SLO(§27), 容灾高可用(§31); 改善risk评分(§10), OAPEFLIR interface(§13), 存储抽象(§26), 部署(§32), 路线graph(§33); 解决 v1.2 的 14 项设计missing陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.1 | 2026-04-19 | **AI 运营完备版**: 新增 LLM Provider 抽象与故障切换(§15), Prompt manage与版本化(§16), 模型评估与质量门禁(§17), 成本manage与 Token 计量(§18), Agent 间委托与协作(§19), 长时task与 Workflow 休眠(§20), 人机协作模式(§21), SDK 与开发者体验(§22), 合规与data治理(§23); 改善 API 认证与 Webhook(§6), 安全威胁模型(§11), 告警路由与分布式 Tracing(§12), Error Budget 与 LLM 延迟(§27), Pack 生命周期与 Plugin 治理(§30); 新增 9 个 ADR; 解决 v2.0 的 14 项 AI 运营层missing陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v2.2 | 2026-04-19 | **业务域接入完备版**: 新增业务域建模与接入架构(§37) -- DomainDescriptor 结构化领域建模, DomainRiskProfile 领域risk画像, DomainKnowledgeSchema 领域知识结构, DomainEvalFramework 领域评估框架, DomainPromptLibrary 领域 Prompt 库, DomainRecipe 领域模板原型, DomainInteractionPolicy 跨域交互strategy, DomainGovernancePolicy 领域治理模型; 新增业务域接入 Runbook(§38) -- 四阶段门禁流程 (建模→开发→认证→灰度) ; 改善 Business Pack 模型(§30)关联 DomainDescriptor; 新增 4 个 ADR; 解决 v2.1 的 10 项业务域接入层missing陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.3 | 2026-04-19 | **智能交互完备版**: 新增自然语言taskentry架构(§39), 目标分解引擎架构(§40), 主动式 Agent 框架(§41), 渐进式自主权模型(§42), 统一运营看板架构(§43), 非技术user体验架构(§44); 新增 6 个 ADR; 使平台从"Agent 基础设施"升级为面向非技术user的"Agent 操作system"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| v2.4 | 2026-04-19 | **组织治理完备版**: 新增组织层次模型(§46), 组织架构审批路由(§47), 企业 SSO/SCIM 集成(§48), 分部门合规strategy引擎(§49), 知识域隔离与受控shared(§50), 分级治理委托(§51); 新增 6 个 ADR; 使平台能适配从一人公司到万人企业的组织复杂度                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.5 | 2026-04-19 | **规模化生态完备版**: 新增多 Region 部署架构(§52), 规模化资源竞争manage(§53), SLA 分级保障(§54), Agent 市场与生态(§55), 反馈驱动持续改进管线(§56), 外部system集成框架(§57); 新增 6 个 ADR; 补齐跨 Region 高可用, 资源公平调度, SLA 差异化保障, 开放生态和持续自我改进能力                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v2.6 | 2026-04-19 | **运营成熟度完备版**: 新增 Agent 可解释性与决策透明度(§59), 紧急制动与globally熔断(§60), Agent 统一生命周期manage(§61), 离线与边缘部署(§62), Agent 行为drift检测(§63), 成本归因与优化引擎(§64), 工作流可视化调试器(§65), 合规报告auto生成引擎(§66), 容量规划与成本预测(§67), 多模态能力(§68), 平台自ops Agent(§69); 新增 11 个 ADR; 补齐从"架构设计完整"到"可投产运营"的运营成熟度层                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.7 | 2026-04-19 | **质量修正版**: 修复 ADR 自主权等级矛盾 (monotonic→guarded progression) ; 统一 §9.5/§14.8 模式枚举为 8 模式规范集; 补全 ExecutionPlan/StateCommand missing的 principal/trace_id field; 扩展 Prompt injection防御架构(§16.5); 修复 ADR-NL TaskSpec→RequestEnvelope references; 补全 §26 data模型 (44→71 表) 和 §28 事件naming空间 (17→25) ; 补全 §33 路线graph Phase 5-7; 补全 §43 L2/L3 看板视graph定义; 新增 §39.7 i18n, §44.6 WCAG, §52.4 GDPR 跨境传输, §55.4-55.6 市场收益/废弃/dependencymanage, §15.6 流式errorhandle; 新增 §40 循环dependency检测, §5.2 P2→P4 通信path; 修复 §62 typo 和 §70 结论misses; 新增附录 G 术语表                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v2.8 | 2026-04-21 | **Harness 工程化版**: 新增 Harness Runtime 架构(§45) -- HarnessRuntime 统一entry, ConstraintPack task级约束信封, ToolbeltAssembler dynamic工具装配, HarnessContext 统一上下文与 token 预算, FeedbackEnvelope 四段反馈闭环, HarnessLoopController 统一闭环控制, Planner/Generator/Evaluator 三类 Agent 角色标准化, Recovery Controller 故障恢复; 新增 Harness 横切关注面(§58) -- Harness 级可观测性, Prompt 分层治理, Failure-to-Learning 管线, Replay/Simulation 能力, 架构remaining问题收口 (§21/§47 审批边界, §23/§49 合规边界, §31/§52 HA 映射, §32/§8/§33 阶段对照, 统一error分类, §42/§61 自主权关联) ; 新增 §13.5 OAPEFLIR→Harness 外部语义映射; 新增 7 个 ADR; 补全 §25.6 一致性模型与保证级别, §25.7 Schema 迁移strategy; 修复 §5.4 P5 通信integrity规则, §7.2 通信拓扑graph, §8.4 S4 阶段 TODO, §19.2 globallycall深度upper limit, §20.4 超长审批续期机制, §42.3 信任分衰减机制, §60.3 Admin 不可用降级方案; 更新 §33 路线graph新增 Phase 8 + paralleldependencygraph; 更新 §35 代码目录新增 harness/; 更新附录 G 术语表新增 9 项 Harness 术语                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.9 | 2026-04-21 | **Harness 八支柱深化版**: Harness 从五元组升级为八支柱模型 (Constraints·Tools·State/Memory·Feedback·Durability·Evaluation Harness·HITL Runtime·Observability/Replay) , 融合 Anthropic 角色化闭环, LangGraph 持久runtime, OpenAI 治理与 Guardrails 原语三大行业流派; 新增 §45.13 HarnessRun/HarnessStep 统一运行contract, §45.14 Evaluation Harness 统一评测runtime (预发布评测+版本对比+outcome assertion) , §45.15 Durable Harness 持久execute支柱 (5 种 pauseReason+4 种 resumeStrategy) , §45.16 Memory Namespace 三层记忆naming空间 (Working/Long-term/Shared Knowledge+晋升strategy) , §45.17 Tool Harness 工具治理 (Capability Profile+生命周期+信任度) , §45.18 HITL Runtime 人机协作runtime (inspect/patch/override/takeover/resume) , §45.19 Async Harness 异步运行模式, §45.20 Guardrails 五层架构 (input/planning/tool/memory/output) , §45.21 十条不变量; 新增 §58.6 HarnessDecision 统一裁决协议 (六种裁决标准化) ; 更新 §45.1 核心公理升级八支柱+行业映射表, §45.2 总体架构graph增加新组件; 更新 §33 路线graph Phase 8 split为 8a/8b/8c 三阶段 (20 周) ; 新增 9 个 ADR (共 81 个) ; 更新 §35 代码目录新增 7 个 harness 子目录; 更新 §70 结论升级九层架构; 更新附录 G 术语表新增 11 项 Harness 术语                                                                                                                                                                                                                                                                           |
| v3.0 | 2026-04-22 | **垂直业务域深化版**: 新增 12 个垂直业务域架构章节(§71-§82) -- 量化交易·电商·广告推广·金融服务·datahandle·代码开发·user运营·行业调研·学术调研·企业知识库·财务·法务; DomainRecipe 从 4 种原型扩展为 8 种 (新增 Trading/Compliance/Research/Adversarial) ; §37.1 问题陈述表扩展为 12 域×8 维度全景对比; §37.4/§37.5 知识和评估表扩展coverage 12 域代表场景; §33 路线graph新增 Phase 9 (垂直业务域深化落地, 3 批×8 周=24 周) 含 Phase dependencygraph更新; §34 新增 12 个域专属 ADR (共 93 个) ; §35 代码目录新增 11 个域实例目录; §36 新增 8 项域专属risk和 7 项域专属硬约束; §38 接入 Runbook 三个 Gate 增加垂直域专项check清单; §70 结论从九层架构升级为十层架构 (新增垂直业务域深化层) ; 附录 G 新增 13 项域专属术语                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v3.1 | 2026-04-22 | **24 域全coverage版**: 新增 12 个垂直业务域架构章节(§83-§94) -- 在线直播·广告素材制作·游戏开发·游戏上架·人力资源·供应链与物流·医疗健康·教育培训·客户服务·content审核与安全·ITopsSRE/DevOps·市场营销与品牌; DomainRecipe 从 8 种原型扩展为 12 种 (新增 Moderation/Logistics/Conversational/IncidentOps) ; §37.1 问题陈述表扩展为 24 域×8 维度全景对比 (4 张表) ; §33 路线graph Phase 9 从 3 批扩展为 6 批 (9a-9f, 总计 48 周) 含dependencygraph更新; §34 新增 12 个域专属 ADR (共 105 个) ; §35 代码目录新增 12 个域实例目录; §36 新增 11 项域专属risk和 11 项域专属硬约束; §36.3 Phase 9 success标准扩展至 24 域; §38 接入 Runbook 三个 Gate 扩展 Critical/High risk域check清单; §70 结论 12→24 垂直域; 附录 G 新增 13 项域专属术语 (4 种新原型 + CSAM/AIR/MTTR/MTTD/FCR/AHT/COPPA/SOV/SOV) ; **结构重组**: 全文按十层架构re-sort为 Part I-XI 分篇结构 -- 基础设施层(§4-§14,§24-§32)整合为 Part I, §58 Harness横切合并到 §45 之后(Part VI), §71-§94 垂直域移至 §38 之后(Part IV), §33-§36 落地汇总移至 Part X, §70 结论移至全文末尾(Part XI); 章节编号保持稳定以compatibility历史references                                                                                                                                                                                                                                                                                                                                                                                                                |
| v3.2 | 2026-04-22 | **架构深化版**: 新增统一领域元模型(§37.11) -- Canonical Domain Meta-Model 定义 12 问标准模板, 24 域填充矩阵 (Q1-Q6 + Q7-Q12 两张表) , 使新域接入模板化, 平台内核configure驱动, 看板/审批/评测统一生成; 新增多 Agent 协作协议(§19.5) -- Agent Collaboration Protocol 定义 8 种消息type (task_request/task_offer/task_accept/task_reject/partial_result/escalation_request/completion_report/takeover_notice) , 9 个forcefield, 7 条不可violates规则 (permissions不扩大/risk不提升/约束不bypass/output可复核/接管必审计/预算不超支/深度不超限) , 将 §19.1-19.4 委托模型从约定升级为force协议; 新增三环实施优先级 (Part X 前言)  -- 第一环平台生存环 (P1-P5+ConstraintPack+HarnessRun+Risk/Audit+Lease/Recovery+Panic/Incident+ModelGateway, 对应 Phase 1-2+8a, 约 16 周) , 第二环平台可用环 (NLentry+GoalDecomposition+HITL+AsyncHarness+Dashboard+Org/SSO+DomainDescriptor+元模型+协作协议, 对应 Phase 3-5+8b/8c, 约 24 周) , 第三环平台扩张环 (Marketplace+MultiRegion+Edge+CostOptimizer+BehaviorDrift+ComplianceReporter+24 DomainPacks, 对应 Phase 6-9, 约 40+ 周) ; 更新 §70 结论新增 3 条核心principle (元模型统一·协作协议force·分环实施) ; **Review 修正**: §38 接入 Runbook 新增元模型step和门禁项(§37.11), §45 Harness Runtime 新增协作协议关联(§19.5), §33 Phase 5 交付物新增元模型+协作协议, §33 dependency Phase 8b→8c 修正, §36.3 补全 Phase 8 success标准, §34 域 ADR 标签 12→24+补全游戏开发域 ADR(共 105), §36.1 补全游戏开发域risk(共 11 项), §82 法务域 12→24 域修正, 三环 Phase 映射修正 |
| v3.3 | 2026-04-22 | **域章节深化版**: 24 个垂直业务域章节(§71-§94)从 ~28 行模板扩展至 ~65 行, 每域新增 5 个子节: Agent 工作流 (详细)  -- 每个 Agent 的完整多step流程; 关键工具/集成 -- 按类别列出具体产品和 API; data敏感度分级 -- 按机密等级划分datatype; 性能/延迟预算 -- 逐操作 SLA 指标; 常见故障与恢复 -- 5 行故障模式×恢复strategy表. content源自 v3.0-domain-research.md 调研data, 总计新增 ~895 行                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v4.0 | 2026-04-27 | **OAPEFLIR v4.4 可execute运行规范集成版**: 将 OAPEFLIR 从"受控认知内核"升级为"可execute Runtime Spec". 新增 PlanGraph 作为 ExecutionPlan 的内部结构; 引入 Graph Normalization, Graph Validation, Graph Risk Propagation, Worst-Path Analysis, Deterministic Graph Scheduler, GraphPatch; 新增 Run / Node state机终态封闭规则, AttemptLineage, Event Registry, Event Replay Semantics, Budget Ledger, SideEffect Delivery Semantics, Reconciliation State Machine, ContextAssemblyContract, PromptExecutionContract, DecisionInputBundle, HITL Responsibility Record, Memory Write Governance, LearningCandidate, EvaluationGate, Runtime Test Matrix; 补齐 Phase 8d 三环映射, PlanBundle/PlanGraphBundle compatibility语义, platform.* 与 oapeflir.* 事件compatibility层, v4.0 Runtime 表落点, LLM-as-Judge 不可coveragefailure; 更新 §5, §13, §14, §17, §25, §26, §28, §45, §58, §33, §34, §35, §36, §70 与附录 G/H.  |
| v4.1 | 2026-04-27 | **OAPEFLIR-Harness 收敛版 + 最小生产闭环版**: 明确 HarnessRuntime 是唯一可executeruntime, HarnessRun 是唯一权威 Run, OAPEFLIR only作为 StageRationale / TraceProjection / Audit View; 将 Replay 收敛为default Trace Replay 与隔离 Re-execution Replay; 补强 Budget atomic reservation, SideEffect revoked/expired 与 commit 前重validation, Panic ack / resume 规则, TrustScore 不降低 inherent risk, 热path确定性execute, 多 Region 单 leader 写入, SLA default 99.95 upper limit, globallycall深度 8; 更新 §5, §10, §14, §18, §19, §28, §31, §37, §42, §45, §52, §54, §58, §60, §33-§36 与附录 H.  |
| v4.2 | 2026-04-27 | **可implementation规格收敛版**: 统一 v4.1/v4.4 权威关系, 明确正文与 runtime/schema/event registry 为implementation权威; 废弃 `ExecutionPlan` canonical 名称并收敛为 `PlanGraphBundle`; 将 `ControlDirective` 拆为 `OperationalDirective` / `DecisionDirective`; 补齐核心运行对象 API, Webhook retry, Outbox poller failover, SLO P95/P99 口径, §25 读path矩阵, §26 MVP 20 表upper limit, §29 Memory/Knowledge/Artifact/Learning contract, §33 MVP/Hardening/Enterprise 三环路线与附录 H conflict裁决规则.  |
