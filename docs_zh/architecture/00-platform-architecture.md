# 《企业级 Agent 平台总体技术架构设计文档》

> **文档版本**：v4.2
> **文档状态**：可实现规格收敛版 / Release Candidate
> **文档定位**：企业级 / 平台级 Agent System 总体技术架构设计文档（稳定性优先 · AI 运营完备 · 业务域接入完备 · 垂直业务域深化完备（24 域） · 统一领域元模型 · 多 Agent 协作协议 · 智能交互完备 · 组织治理完备 · 规模化生态完备 · 运营成熟度完备 · Harness 权威运行时 · OAPEFLIR 受控认知框架 · 最小生产闭环 · 三环实施优先级 · 落地导向版）
> **适用对象**：架构委员会、平台研发团队、Runtime 团队、SRE、安全团队、治理团队、业务域接入团队、AI/ML 工程团队、业务线负责人、非技术业务操作者、组织管理层、合规/审计团队、生态合作伙伴、边缘/现场运维团队、**垂直业务域架构师（量化交易·电商·广告·金融·数据·代码·运营·行业调研·学术调研·知识库·财务·法务·在线直播·广告素材·游戏开发·游戏上架·人力资源·供应链·医疗健康·教育培训·客户服务·内容审核·IT运维·市场营销）**
> **设计目标**：构建一套以稳定性、风险控制、安全可靠、异常处理为第一原则的企业级 Agent 平台，使 Agent 作为高风险自动化单元在企业环境中可控、可恢复、可审计地长期运行；同时具备完整的 AI 运营能力（LLM 抽象、Prompt 治理、模型质量、成本管控），确保平台在 AI 层面同样可控、可演进；提供结构化的业务域建模与接入框架；构建面向非技术用户的智能交互层；建立完整的组织治理体系和规模化运行生态层；补齐运营成熟度层；**并以 HarnessRuntime 作为唯一可执行运行时，将 OAPEFLIR 收敛为受控认知与治理框架，使 Agent 从"一次性模型调用"升级为"受约束、图计划、可恢复、可审计、可运维"的生产级系统**
> **v4.2 版本定位**：可实现规格收敛版。本版本以本文档正文为 Core Architecture 唯一权威源，历史 v4.1 与 OAPEFLIR v4.4 Executable Spec 仅作为迁移输入；实现优先级以 §33 MVP / Hardening / Enterprise 三环为准。HarnessRuntime 是唯一可执行入口，HarnessRun 是唯一权威 Run，PlanGraphBundle 是 P3 → P4 的 canonical execution contract，OAPEFLIR 阶段只作为 StageRationale / TraceProjection / Audit View；默认使用 Trace Replay，不假设 LLM 可确定性重放。

> **权威源优先级**：1. Executable Runtime Contract；2. Schema / Zod / OpenAPI / Event Registry；3. 本 Core Architecture；4. ADR；5. Domain Spec；6. Example / Appendix。若附录、历史 spec 或示例与正文冲突，以优先级更高者为准。

---

# 目录

> 本文档按**十层架构**组织为 11 个 Part，章节编号保持稳定以兼容历史引用。

**前言（§1-§3）**

1. [文档概述](#1-文档概述)
2. [平台根假设与设计目标](#2-平台根假设与设计目标)
3. [平台定义与非目标](#3-平台定义与非目标)

**Part I — 基础设施层（§4-§14, §24-§32）** 4. [总体架构：五平面 + 一横切控制织网](#4-总体架构五平面--一横切控制织网) 5. [平面间通信契约](#5-平面间通信契约) 6. [API 契约与版本化架构](#6-api-契约与版本化架构) 7. [服务通信架构](#7-服务通信架构) 8. [可扩展性架构](#8-可扩展性架构) 9. [稳定性架构](#9-稳定性架构) 10. [风险控制架构](#10-风险控制架构) 11. [安全可靠架构](#11-安全可靠架构) 12. [异常事件处理架构](#12-异常事件处理架构) 13. [OAPEFLIR 受控认知框架](#13-oapeflir-受控认知框架) 14. [Runtime Execution Plane](#14-runtime-execution-plane) 24. [配置治理架构](#24-配置治理架构) 25. [数据与状态一致性架构](#25-数据与状态一致性架构) 26. [存储架构](#26-存储架构) 27. [性能架构与 SLO](#27-性能架构与-slo) 28. [Event Registry / Projection / Incident / DLQ 模型](#28-event-registry--projection--incident--dlq-模型) 29. [Knowledge / Memory / Artifact / Learning 边界](#29-knowledge--memory--artifact--learning-边界) 30. [业务接入约束与 Business Pack 模型](#30-业务接入约束与-business-pack-模型) 31. [容灾与高可用架构](#31-容灾与高可用架构) 32. [部署架构](#32-部署架构)

**Part II — AI 运营层（§15-§23）** 15. [LLM Provider 抽象与故障切换架构](#15-llm-provider-抽象与故障切换架构) 16. [Prompt 管理与版本化架构](#16-prompt-管理与版本化架构) 17. [模型评估与质量门禁架构](#17-模型评估与质量门禁架构) 18. [成本管理与 Token 计量架构](#18-成本管理与-token-计量架构) 19. [Agent 间委托与协作架构](#19-agent-间委托与协作架构) 20. [长时任务与 Workflow 休眠架构](#20-长时任务与-workflow-休眠架构) 21. [人机协作模式架构](#21-人机协作模式架构) 22. [SDK 与开发者体验架构](#22-sdk-与开发者体验架构) 23. [合规与数据治理架构](#23-合规与数据治理架构)

**Part III — 业务域接入层（§37-§38）** 37. [业务域建模与接入架构](#37-业务域建模与接入架构) 38. [业务域接入 Runbook](#38-业务域接入-runbook)

**Part IV — 垂直业务域深化层（§71-§94）** 71. [量化交易域架构](#71-量化交易域架构) 72. [电商域架构](#72-电商域架构) 73. [广告推广域架构](#73-广告推广域架构) 74. [金融服务域架构](#74-金融服务域架构) 75. [数据处理域架构](#75-数据处理域架构) 76. [代码开发域架构](#76-代码开发域架构) 77. [用户运营域架构](#77-用户运营域架构) 78. [行业调研域架构](#78-行业调研域架构) 79. [学术调研域架构](#79-学术调研域架构) 80. [企业知识库域架构](#80-企业知识库域架构) 81. [财务域架构](#81-财务域架构) 82. [法务域架构](#82-法务域架构) 83. [在线直播域架构](#83-在线直播域架构) 84. [广告素材制作域架构](#84-广告素材制作域架构) 85. [游戏开发域架构](#85-游戏开发域架构) 86. [游戏上架域架构](#86-游戏上架域架构) 87. [人力资源域架构](#87-人力资源域架构) 88. [供应链与物流域架构](#88-供应链与物流域架构) 89. [医疗健康域架构](#89-医疗健康域架构) 90. [教育培训域架构](#90-教育培训域架构) 91. [客户服务域架构](#91-客户服务域架构) 92. [内容审核与安全域架构](#92-内容审核与安全域架构) 93. [IT 运维 SRE/DevOps 域架构](#93-it-运维-sredevops-域架构) 94. [市场营销与品牌域架构](#94-市场营销与品牌域架构)

**Part V — 智能交互层（§39-§44）** 39. [自然语言任务入口架构](#39-自然语言任务入口架构) 40. [目标分解引擎架构](#40-目标分解引擎架构) 41. [主动式 Agent 框架](#41-主动式-agent-框架) 42. [渐进式自主权模型](#42-渐进式自主权模型) 43. [统一运营看板架构](#43-统一运营看板架构) 44. [非技术用户体验架构](#44-非技术用户体验架构)

**Part VI — Harness 权威运行时与八支柱深化层（§45, §58）** 45. [Harness Runtime 权威执行模型](#45-harness-runtime-权威执行模型) 58. [Harness 横切关注面](#58-harness-横切关注面)

**Part VII — 组织治理层（§46-§51）** 46. [组织层次模型](#46-组织层次模型) 47. [组织架构审批路由](#47-组织架构审批路由) 48. [企业 SSO/SCIM 集成架构](#48-企业-ssoscim-集成架构) 49. [分部门合规策略引擎](#49-分部门合规策略引擎) 50. [知识域隔离与受控共享](#50-知识域隔离与受控共享) 51. [分级治理委托](#51-分级治理委托)

**Part VIII — 规模化运行层与生态层（§52-§57）** 52. [多 Region 部署架构](#52-多-region-部署架构) 53. [规模化资源竞争管理](#53-规模化资源竞争管理) 54. [SLA 分级保障](#54-sla-分级保障) 55. [Agent 市场与生态](#55-agent-市场与生态) 56. [反馈驱动持续改进管线](#56-反馈驱动持续改进管线) 57. [外部系统集成框架](#57-外部系统集成框架)

**Part IX — 运营成熟度层（§59-§69）** 59. [Agent 可解释性与决策透明度架构](#59-agent-可解释性与决策透明度架构) 60. [紧急制动与全局熔断架构](#60-紧急制动与全局熔断架构) 61. [Agent 统一生命周期管理架构](#61-agent-统一生命周期管理架构) 62. [离线与边缘部署架构](#62-离线与边缘部署架构) 63. [Agent 行为漂移检测架构](#63-agent-行为漂移检测架构) 64. [成本归因与优化引擎](#64-成本归因与优化引擎) 65. [工作流可视化调试器架构](#65-工作流可视化调试器架构) 66. [合规报告自动生成引擎](#66-合规报告自动生成引擎) 67. [容量规划与成本预测引擎](#67-容量规划与成本预测引擎) 68. [多模态能力架构](#68-多模态能力架构) 69. [平台自运维 Agent 架构](#69-平台自运维-agent-架构)

**Part X — 落地路线与汇总（§33-§36）** 33. [分阶段落地路线](#33-分阶段落地路线) 34. [ADR 冻结建议](#34-adr-冻结建议) 35. [推荐代码目录](#35-推荐代码目录) 36. [风险、约束与成功标准](#36-风险约束与成功标准)

**Part XI — 结论与附录** 70. [结论](#70-结论)
[附录 G：术语表与缩写索引](#附录-g术语表与缩写索引)
[附录 H：OAPEFLIR v4.4 Executable Spec 与 v4.1 收敛规则](#附录-hoapeflir-v44-executable-spec-与-v41-收敛规则)
[附录 A：版本变更历史](#附录-a版本变更历史)

---

# 全书主骨架总览

本节以五张图概括整份架构文档的核心结构，读者可先建立全局画面再按需深入。

### 图 1 — 静态架构（五平面 + 跨切面）

```text
┌─────────────────────────────────────────────────────────┐
│                   P1  Interface Plane                    │  §5-§10
├─────────────────────────────────────────────────────────┤
│                   P2  Control Plane                      │  §11-§13
├─────────────────────────────────────────────────────────┤
│         P3  Orchestration Plane（Harness Runtime）       │  §14-§22, §45
├─────────────────────────────────────────────────────────┤
│                   P4  Execution Plane                    │  §23-§24
├─────────────────────────────────────────────────────────┤
│                   P5  Evidence Plane                     │  §25-§29
├─────────────────────────────────────────────────────────┤
│  X1 Reliability Fabric（跨五平面：重试/熔断/隔离/审计）  │  §56-§60
└─────────────────────────────────────────────────────────┘
```

### 图 2 — 运行时主链（一次任务的典型路径）

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

### 图 3 — 治理闭环（持续改进循环）

```text
Run ──→ Evidence ──→ Feedback ──→ Learn/Drift-Detect
 ↑                                        │
 └── Release ← Improve ← Evaluation ←────┘
```

### 图 4 — 演进路线（Phase 总览，详见 §33）

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

旧 Phase 1-9 仅作为历史排期映射；Phase 8a-8d 已拆入 Ring 1/2 交付包。
```

### 图 5 — HarnessRuntime + OAPEFLIR 语义投影

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

企业对 Agent 的期望，已经从"问答系统"演进为"能接系统、能跑流程、能做执行、能被治理、能被审计、能持续演进"的智能自动化平台。

但大多数 Agent 系统在工程上仍存在明显短板：

- 默认相信模型输出
- 默认工具调用会成功
- 默认外部系统可用
- 默认 workflow 只要编排好就能跑
- 默认异常只需日志记录
- 默认上线后行为可接受

这些假设在企业生产环境中都不成立。

企业级 Agent 平台首先面对的不是"能力不够强"，而是"失控风险太高"。
因此，本版架构把以下问题前置为主设计对象：

- 系统如何在失败时不失控
- 高风险动作如何被识别并收敛
- 外部依赖异常时如何降级
- worker 崩溃后如何恢复
- side effect 如何被控制与追责
- 发布失败如何回滚
- projection 偏差如何重建
- 审批延迟时系统如何安全停住

## 1.2 文档目标

- 定义稳定性优先的企业级 Agent 平台总体架构
- 建立以"默认不可信、默认会失败"为前提的设计原则
- 将稳定性、风险、安全、异常处理提升为平台一级主架构
- 明确五平面 + 横切织网的系统结构，**并定义平面间的正式接口协议**
- 重构 Runtime 为可恢复、可降级、可审计的受控执行系统
- **给出可落地的渐进式演进路径**，而不是一步到位的理想态
- 为后续详细设计、Schema、ADR、实现分阶段落地提供基线

## 1.3 非目标

- 单个业务 Agent 的 prompt 细节
- 单个插件或 adapter 的接口实现说明
- UI 交互视觉稿
- 某个模型供应商专项接入实现
- 某个业务域完整领域模型
- 基础设施物理拓扑和采购方案

## 1.4 实现边界声明

本文档描述目标态架构，但 v4.2 的实现边界以 §33 Ring 1 / MVP Slice 为准。未进入 MVP Slice 的章节只作为兼容性设计和演进预留，不得阻塞 HarnessRuntime、PlanGraphBundle、NodeRun、BudgetReservation、SideEffectManager、HITL basic、Trace Replay 与 Evidence 闭环交付。

正文能力默认标注为四类成熟度之一：

| 标签 | 含义 |
| --- | --- |
| MVP | Ring 1 必须交付，缺失则平台不可投产 |
| Hardening | Ring 2 完成，用于生产可靠性和企业治理 |
| Enterprise | Ring 3 完成，用于规模化、多域和多 Region |
| Future | 目标态预留，不作为当前实现承诺 |

---

# 2. 平台根假设与设计目标

## 2.1 平台根假设

本平台默认假设以下情况都会发生：

- agent 会犯错
- 工具会失败
- 外部系统会超时
- worker 会崩溃
- 模型会产生错误输出
- 配置会配错
- 审批会延迟
- 事件会重复
- 投影会落后
- 发布会回滚

因此平台必须围绕一句话设计：

> **默认不可信，默认会失败，默认要可控、可恢复、可审计。**

## 2.2 平台设计宪法

### 默认不可信

- 模型输出不可信
- 插件不可信
- 外部依赖不可信
- 输入不可信
- 知识可能过期
- 学习结果可能带噪声

### 默认会失败

- 远程调用会超时
- worker 会丢心跳
- event fanout 会失败
- projection 会延迟
- rollout 会失败
- repair / replay 也可能失败

### 默认收敛

未被明确允许的动作默认进入保守路径：deny / degrade / require approval / supervised / no-write / no-external-call / manual-only。

### 先可恢复，再自动化

没有 replay / repair / rebuild / rollback 能力的自动化，不应进入关键流程。

### 状态与证据同等重要

平台不仅要"做成"，还要记录：谁触发、为什么执行、用了什么上下文、调用了什么系统、产生了什么副作用、失败后如何恢复。

## 2.3 八个硬目标

1. **稳定运行**：即使部分组件失败，平台也不能整体失控
2. **风险隔离**：高风险动作必须被识别、分级、隔离、审批、可回滚
3. **安全默认收敛**：不明确允许的能力默认禁止，不做 fail-open
4. **异常可恢复**：重要链路中断后，要么恢复继续，要么安全终止，要么转人工
5. **数据可追溯**：每个关键动作都可追踪其触发者、依据、上下文、结果和副作用
6. **发布可控**：workflow、agent、pack、plugin、policy 的变更必须可灰度、可回滚
7. **多租户安全**：不同租户、团队、项目、业务域之间不得串数据、串权限、串执行环境
8. **业务可扩展但不侵入核心**：新业务接入不能破坏平台的稳定性与安全模型

## 2.4 ArchitectureInvariantRegistry

设计宪法必须落到可测试 invariant。每条 invariant 至少声明 enforcement point、失败行为、测试引用和 phase；缺少这些字段的原则不得作为实现验收依据。

```yaml
id: INV-STATE-001
statement: 每次 HarnessRun/NodeRun truth mutation 必须同事务追加 event
enforcement_point: StateStore.UnitOfWork
test_ref: tests/invariants/truth-event-atomicity.test.ts
failure_behavior: reject mutation and emit incident
phase: MVP
```

v4.2 不可降级核心不变量：

| Invariant | Enforcement point | Phase |
| --- | --- | --- |
| HarnessRuntime 是唯一执行入口，P4 不接受旁路执行 | P1/P2 admission + P4 dispatch guard | MVP |
| P3 → P4 canonical contract 只能是 `PlanGraphBundle` | PlanGraph validator + dispatch schema | MVP |
| Budget reserve 必须先于 LLM / Tool / SideEffect / Evaluation | BudgetLedger guard | MVP |
| SideEffect ambiguous 不得视为 success | SideEffectManager + ReconciliationWorker | MVP |
| Replay 不得产生真实外部副作用 | ReplaySandboxPolicy | MVP |
| Panic 不得 TTL 自动解除，恢复必须人工确认 | PanicController | MVP |
| `oapeflir.*` 事件不得作为 truth source | EventRegistry consumer contract tests | MVP |
| TrustScore 不得降低 inherent risk | RiskEngine policy test | Hardening |

---

# 3. 平台定义与非目标

## 3.1 平台定义

> 一套面向企业环境的、以稳定性优先为核心原则的受控自动化平台。
> 它把 Agent 视为高风险自动化单元，通过五个架构平面和一层横切控制织网，对其进行严格控制、隔离、恢复、审计和治理。

## 3.2 它不是什么

- **不是单个聊天机器人** — 聊天只是入口之一
- **不是纯 Workflow Engine** — Workflow 不解决治理、恢复、审批、审计
- **不是纯 Tool Calling 壳层** — 工具只是执行手段
- **不是 "Prompt + 模型 + 少量工具" 的薄应用** — 缺乏隔离、治理、恢复
- **不是 "自动化越多越好" 的系统** — 平台追求**受控自动化**
- **不是医疗诊断主体、法律意见主体、金融最终授信主体或证券交易热路径执行引擎** — 平台只能辅助生成建议、证据、计划和候选动作；高风险域最终责任由具备法定资质或组织授权的人/系统承担
- **不是超低延迟确定性系统的替代品** — 交易撮合、实时竞价、急救响应、直播断流等热路径不得依赖通用 LLM/Harness loop；只能使用确定性策略、编译 artifact、预先批准规则或离线规划结果

---

# Part I — 基础设施层（§4-§14, §24-§32）

---

# 4. 总体架构：五平面 + 一横切控制织网

## 4.1 架构总图

```text
┌──────────────────────────────────────────────────────────────┐
│                    P1 Interface Plane                         │
│     API Gateway · Webhook · Scheduler · Console · Ingress    │
├──────────────────────────────────────────────────────────────┤
│                    P2 Control Plane                           │
│     Policy · Approval · Rollout · Incident · Config          │
├──────────────────────────────────────────────────────────────┤
│                P3 Orchestration Plane                         │
│     OAPEFLIR Loop · Planner · Routing · Escalation           │
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

对外接入层。

**包含**：API Gateway / Webhook / Scheduler trigger / Admin Console backend / External event ingress

**职责**：输入校验 · 身份认证 · 限流 · 请求去重 · 基础路由 · 附件引用化 · 幂等键处理

**不负责**：执行业务逻辑 · 修改核心状态 · 绕过控制面直接调执行器

P1 必须暴露标准化的 API 契约（见 §6），所有进入平台的请求必须通过统一的 RequestEnvelope 封装，包含 trace_id、idempotency_key、principal、tenant_id。

## 4.3 P2 Control Plane

控制与治理层，是平台的治理外壳。

**包含**：policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management

**职责**：定义与版本治理 · 审批与自治边界控制 · 风险与预算守卫 · 发布、灰度、回滚 · incident 升级与处置 · repair / replay / rebuild 的运维控制

P2 通过 ControlDirective 向 P3/P4 发送指令，而非直接操作底层状态。Directive 类型包括：ModeSwitchDirective / PauseDirective / RollbackDirective / QuotaAdjustDirective。

## 4.4 P3 Orchestration Plane

编排与决策层。

**包含**：OAPEFLIR loop / workflow orchestration / planning & replanning / PlanGraph builder / graph scheduler policy / routing & escalation

**职责**：决定做什么 · 决定下一步谁执行 · 决定何时暂停 · 决定何时转人工 · 决定何时重规划、降级、终止

P3 输出标准化的 ExecutionPlan / PlanGraphBundle（见 §13），所有决策都必须可序列化、可审计、可重放。

## 4.5 P4 Execution Plane

统一执行层。

**包含**：scheduler / dispatcher / execution engine / worker pool / tool executor / plugin executor / adapter executor / browser executor / human wait executor / recovery workers

**职责**：真正执行动作 · 获取并维护 lease · 执行结果回写 · 提议与提交 side effect · 在故障时触发恢复动作

P4 必须通过 ExecutionReceipt 向 P3/P5 回报执行结果，Receipt 包含 status / duration / side_effects / evidence_refs / error_detail。

## 4.6 P5 State & Evidence Plane

状态与证据平面。

**包含**：truth tables / event log / artifact store / memory / knowledge / audit / projections / checkpoints / evidence bundles / incident records / DLQ records

**职责**：保存当前控制真相 · 保留历史变化轨迹 · 支撑恢复和回放 · 保留审计证据 · 支撑控制台查询

P5 通过统一的 Repository 接口对外暴露，上层不直接操作存储实现。Repository 接口支持多后端切换（见 §26）。

## 4.7 X1 Reliability & Security Fabric

横跨所有平面的生命支持系统。

**包含**：authn/authz / sandbox / secrets / egress control / quotas / circuit breakers / timeouts / retries / rate limits / health checks / anomaly detection / backpressure / DLQ / incident hooks

**定位**：这不是辅助能力，而是平台的基础生命支持系统。X1 的每个能力都以 middleware / interceptor / decorator 形式注入各平面，不作为独立服务部署。

---

# 5. 平面间通信契约

> 定义五个平面之间的接口协议，将平面间通信正式化。

## 5.1 设计原则

- 平面间只能通过**正式契约对象**通信，不能直接调用对方内部实现
- 每个契约对象都是**可序列化、可审计、可重放**的
- 同步调用使用 typed interface，异步通知使用 domain event

## 5.2 平面间契约矩阵

| 调用方 → 被调方 | 契约对象           | 通信方式  | 说明                                                       |
| --------------- | ------------------ | --------- | ---------------------------------------------------------- |
| P1 → P2         | `RequestEnvelope`  | 同步      | 所有请求先经 P2 做策略/准入检查                            |
| P2 → P3         | `ControlDirective` | 同步/事件 | 模式切换、暂停、配额调整                                   |
| P3 → P4         | `ExecutionPlan / PlanGraphBundle` | 同步 | 编排层输出给执行层的标准执行计划；复杂任务必须为 PlanGraph |
| P4 → P3         | `ExecutionReceipt` | 同步      | 执行结果回报给编排层                                       |
| P4 → P5         | `StateCommand`     | 同步      | 写真相表、追加事件                                         |
| P3 → P5         | `EvidenceRecord`   | 异步      | 决策证据写入                                               |
| P2 → P4         | `ControlDirective` | 同步      | 紧急制动/模式切换直达执行层（§4.3 提及，§60 紧急制动场景） |
| P5 → P2         | `ProjectionUpdate` | 事件      | Projection 变化通知控制面                                  |
| 任意 → X1       | middleware 注入    | 切面      | 不通过显式调用，通过装饰器/拦截器                          |

## 5.3 核心契约对象定义

### RequestEnvelope

P1 → P2 的标准请求信封，封装所有入站请求的元信息与任务规格。

| 字段         | 类型          | 说明                                     |
| ------------ | ------------- | ---------------------------------------- |
| requestId    | string (UUID) | 请求唯一标识                             |
| tenantId     | string        | 租户 ID，用于多租户隔离                  |
| taskSpec     | TaskSpec      | 任务规格（目标、输入、约束）             |
| priority     | enum          | 优先级（critical / high / normal / low） |
| traceContext | TraceContext  | 分布式追踪上下文，贯穿全链路             |
| principal    | Principal     | 发起人身份与权限声明                     |
| timestamp    | ISO-8601      | 请求发起时间戳                           |

### ControlDirective

P2 → P3/P4 的控制指令，用于策略执行、审批决策和紧急制动。

v4.1 起 `ControlDirective` 分为两类，避免把运行控制与业务裁决混在同一枚举中：

| 分类 | 典型类型 | 作用域 | 约束 |
| --- | --- | --- | --- |
| OperationalDirective | pause / resume / abort / rollback / kill / mode_switch / quota_adjust | HarnessRun、NodeRun、Plane、Tenant、Region | 只改变运行控制状态，不表达业务 approve / deny |
| DecisionDirective | approve / deny / override / request_changes / expire_approval | decisionId、sideEffectId、hitlTaskId、budgetReservationId | 只能由 HITL / Policy / Approval 流程生成，必须声明 scope 与 expiresAt |

P2 → P4 的直达控制只允许 `OperationalDirective(type=kill)`，且仅用于 §60 PlatformPanicDirective 或等价 P0 安全事件；常规审批不得绕过 HarnessRuntime。

| 字段        | 类型          | 说明                                                                  |
| ----------- | ------------- | --------------------------------------------------------------------- |
| directiveId | string (UUID) | 指令唯一标识                                                          |
| category    | enum          | operational / decision                                                |
| type        | enum          | 分类内指令类型                                                        |
| targetRunId | string        | 目标运行实例 ID                                                       |
| reason      | string        | 指令原因（审计用）                                                    |
| issuedBy    | Principal     | 签发人身份                                                            |
| traceId     | string        | 关联追踪 ID                                                           |

### ExecutionPlan / PlanGraphBundle

P3 → P4 的标准执行计划。自 v4.1 起，`ExecutionPlan` 保留为平面间契约名称，但其内部结构从线性 `steps: Step[]` 升级为 `PlanGraphBundle`。所有复杂任务必须以 PlanGraph 形式下发给 P4，由 Graph Scheduler 按确定性策略调度 NodeRun。

| 字段             | 类型             | 说明                                 |
| ---------------- | ---------------- | ------------------------------------ |
| planId           | string (UUID)    | 计划唯一标识                         |
| planGraphId      | string (UUID)    | 图计划唯一标识                       |
| graphVersion     | number           | 图版本，GraphPatch 后递增            |
| graph            | PlanGraph        | 可执行图，包含 node / edge / entry / terminal |
| schedulerPolicy  | ReadyNodeSchedulingPolicy | ready node 的确定性调度策略 |
| toolRequirements | ToolRef[]        | 所需工具声明                         |
| budget           | BudgetEnvelope   | 预算约束（token / 时间 / 费用）      |
| riskProfile      | RiskProfile      | 风险评估摘要                         |
| validationReport | GraphValidationReport | 图校验结果                      |
| riskPropagationReport | GraphRiskPropagationReport | 风险传播结果              |
| worstPathAnalysis | GraphWorstPathAnalysis | 最坏路径耗时、成本、风险分析 |
| rollbackStrategy | RollbackStrategy | 回滚策略（逐步回滚 / 全量回滚 / 无） |
| evidenceRefs     | string[]         | 计划生成、校验、评估证据             |

**PlanGraph 硬规则**：

1. 简单任务可以退化为单节点 PlanGraph。
2. 复杂任务不得使用线性 steps 直接执行。
3. PlanGraph 必须经过 Normalize → Validate → Risk Propagation → Worst-Path Analysis 后才能进入 ready。
4. P4 不得执行 `validationReport.valid=false` 的 PlanGraph。

### ExecutionReceipt

P4 → P3/P5 的执行回执，记录单步或整体执行结果与遥测数据。

| 字段        | 类型          | 说明                                   |
| ----------- | ------------- | -------------------------------------- |
| receiptId   | string (UUID) | 回执唯一标识                           |
| stepId      | string        | 关联步骤 ID                            |
| status      | enum          | 执行状态（success / failed / skipped） |
| artifacts   | Artifact[]    | 产出物列表（文件、变量等）             |
| telemetry   | Telemetry     | 遥测数据（延迟、token 用量、重试次数） |
| sideEffects | SideEffect[]  | 副作用声明（文件写入、API 调用等）     |
| error       | ErrorDetail?  | 错误详情（仅失败时）                   |
| duration    | number (ms)   | 执行耗时                               |

### StateCommand

P3/P4 → P5 的状态写入指令，基于 CAS 保证幂等写入。

| 字段            | 类型          | 说明                                          |
| --------------- | ------------- | --------------------------------------------- |
| commandId       | string (UUID) | 命令唯一标识                                  |
| entityType      | string        | 目标实体类型（task / workflow / artifact 等） |
| entityId        | string        | 目标实体 ID                                   |
| operation       | enum          | 操作类型（create / update / patch / delete）  |
| payload         | JSON          | 写入数据                                      |
| expectedVersion | number        | 期望版本号（CAS 乐观锁）                      |
| principal       | Principal     | 操作发起人身份                                |
| traceId         | string        | 关联追踪 ID                                   |

## 5.4 契约遵守规则

1. **不可绕过**：P1 不可跳过 P2 直接调 P4
2. **P5 被动原则**：P5 不可向 P3/P4 发指令（只能被读/被写）；P5 → P2 仅限 ProjectionUpdate 事件通知，不可发送 ControlDirective 或触发状态变更
3. **P2 → P4 仅限紧急通道**：P2 在紧急制动(§60)场景下可绕过 P3 直达 P4 发送 `ControlDirective(type=kill)`，此路径仅限 `PlatformPanicDirective` 场景，常规指令仍须经 P3 编排
4. **必须签名**：每个契约对象必须包含 principal 和 trace_id
5. **必须幂等**：所有 StateCommand 必须基于 expected_version 做 CAS
6. **必须可重放**：所有契约对象必须可序列化为 JSON

---

# 6. API 契约与版本化架构

> 将 API 作为一级架构关注点。

## 6.1 API 分层

| API 层       | 面向             | 协议                                       | 认证方式             |
| ------------ | ---------------- | ------------------------------------------ | -------------------- |
| Public API   | 业务系统、CI/CD  | REST + WebSocket                           | API Key + JWT        |
| Admin API    | 运维人员、控制台 | REST                                       | JWT + RBAC           |
| Internal API | 平面间调用       | typed interface（进程内）或 gRPC（跨进程） | mTLS / service token |
| Plugin API   | 插件 / adapter   | IPC / sandbox boundary                     | capability token     |

## 6.2 Public API 设计规范

- 资源命名使用 kebab-case 复数形式：`/api/v1/workflow-runs`
- 所有写操作必须携带 `Idempotency-Key` header
- 所有响应包含 `X-Request-Id` 和 `X-Trace-Id`
- 错误响应使用统一结构：

## 6.3 API 资源总览

| 资源                               | 方法                | 说明                   |
| ---------------------------------- | ------------------- | ---------------------- |
| `/api/v1/tasks`                    | POST / GET          | 创建任务、查询任务列表 |
| `/api/v1/tasks/{id}`               | GET / DELETE        | 查询/取消单个任务      |
| `/api/v1/workflow-runs`            | GET                 | 查询 workflow 运行列表 |
| `/api/v1/workflow-runs/{id}`       | GET                 | 查询单次运行详情       |
| `/api/v1/workflow-runs/{id}/steps` | GET                 | 查询步骤列表           |
| `/api/v1/approvals`                | GET                 | 待审批列表             |
| `/api/v1/approvals/{id}`           | POST                | 提交审批决策           |
| `/api/v1/incidents`                | GET                 | Incident 列表          |
| `/api/v1/knowledge`                | GET / POST          | Knowledge 查询/写入    |
| `/api/v1/packs`                    | GET / POST          | Pack 注册与查询        |
| `/api/v1/packs/{id}/versions`      | GET / POST          | Pack 版本管理          |
| `/api/v1/plugins`                  | GET / POST          | Plugin 注册与查询      |
| `/api/v1/prompts`                  | GET                 | Prompt 版本查询        |
| `/api/v1/cost-reports`             | GET                 | 成本报表查询           |
| `/api/v1/webhooks`                 | GET / POST / DELETE | Webhook 订阅管理       |
| `/api/v1/admin/workers`            | GET                 | Worker 状态            |
| `/api/v1/admin/config`             | GET / PUT           | 配置管理               |
| `/api/v1/admin/rollouts`           | GET / POST          | Rollout 管理           |
| `/api/v1/admin/tenants`            | GET / POST / PUT    | Tenant 管理            |
| `/api/v1/admin/budgets`            | GET / PUT           | 预算配置               |
| `/ws/v1/stream`                    | WebSocket           | 实时事件流             |

## 6.4 版本兼容策略

- API 版本通过 URL path 区分（`/api/v1/`, `/api/v2/`）
- 同一大版本内只做**向后兼容**变更（新增字段、新增端点）
- 破坏性变更必须升大版本，旧版本至少维护 6 个月
- Event schema 使用 `schema_version` 字段，consumer 按版本分派
- 内部 TypeScript interface 变更通过 Zod schema 做运行时校验

## 6.5 认证流程

**API Key + JWT 双模式**：

| 场景         | 认证方式                               | 说明                         |
| ------------ | -------------------------------------- | ---------------------------- |
| 服务间调用   | API Key（Header: `X-API-Key`）         | 长期有效，按 tenant 颁发     |
| 用户操作     | JWT（Header: `Authorization: Bearer`） | OAuth2 / OIDC 颁发，短期有效 |
| 控制台       | JWT + CSRF token                       | 浏览器安全防护               |
| Webhook 回调 | HMAC 签名验证                          | `X-Signature-256` header     |

**Token 生命周期**：access_token TTL = 15min, refresh_token TTL = 24h, API key 支持手动轮换。

## 6.6 分页与过滤

- 列表接口统一使用 cursor-based 分页：`?cursor=xxx&limit=20`
- 响应包含 `next_cursor`，为 null 时表示最后一页
- 过滤使用查询参数：`?status=running&tenant_id=xxx&created_after=2026-01-01`
- 排序：`?sort=created_at:desc`
- 单页最大 100 条

## 6.7 Webhook 投递保证

- 投递使用 at-least-once 语义（outbox pattern）
- 每次投递包含 `X-Webhook-Id`（幂等键）和 `X-Signature-256`（HMAC 签名）
- 目标返回 2xx 视为成功，否则按 retry_policy 重试
- 连续失败 > 50 次后自动禁用 subscription，通知 tenant 管理员

---

# 7. 服务通信架构

> 明确三种通信模式及适用场景。

## 7.1 三种通信模式

### 同步请求/响应

适用：P1→P2 准入检查、P3→P4 dispatch、P4→P5 truth write

要求：

- 必须设置 timeout（默认 5s，最大 30s）
- 必须有 fallback（降级 / reject / queue）
- 必须有 circuit breaker 保护

### 异步事件通知

适用：P4→P5 event append、P5→P2 projection update、P4→X1 incident hook

要求：

- 使用 outbox pattern 保证 at-least-once
- consumer 必须幂等（基于 event_id 去重）
- 失败事件进入 DLQ

### 流式推送

适用：P5→P1 实时事件流（WebSocket）、worker heartbeat

要求：

- 连接断开自动重连 + 从 last_event_id 恢复
- 服务端背压（buffer 满则丢弃低优先级事件）

## 7.2 通信拓扑

```text
                     常规路径
P1 ──sync──> P2 ──sync/event──> P3 ──sync──> P4
                                              │
                                              ▼
                                    P4 ──sync──> P5 (StateCommand)
                                    P4 ──event─> P5 (event append)

                     反馈路径
P5 ──event──> P2 (ProjectionUpdate 通知)
P5 ──stream─> P1 (WebSocket 实时推送)
P4 ──sync──> P3 (ExecutionReceipt 回报)

                     紧急通道（仅 §60 PlatformPanic）
P2 ──sync──> P4 (ControlDirective kill)

                     横切注入
X1 ──middleware──> P1, P2, P3, P4, P5
```

## 7.3 Outbox Pattern 设计

所有需要保证送达的事件，采用 outbox pattern：

1. 业务操作和事件写入在**同一个数据库事务**中完成
2. 独立的 outbox poller 异步读取未发送事件
3. 发送成功后标记 sent
4. 发送失败超过阈值后转入 DLQ
5. Poller 本身通过 lease 保证单实例运行

## 7.4 进程内 vs 跨进程

| 阶段                | 通信方式                    | 说明               |
| ------------------- | --------------------------- | ------------------ |
| Phase 1（单体）     | 进程内 typed interface 调用 | 所有平面在同一进程 |
| Phase 2（初步拆分） | 进程内 + Redis pub/sub      | event 通道异步化   |
| Phase 3（微服务化） | gRPC + event bus            | 平面间独立部署     |

这保证了从单体到微服务的平滑演进，而不是一开始就要求 18 个服务。

---

# 8. 可扩展性架构

> 定义从单节点到集群的扩展策略。

## 8.1 扩展维度

| 维度            | 扩展策略                        | 触发条件                        |
| --------------- | ------------------------------- | ------------------------------- |
| Worker 并发     | 增加 worker 进程/容器           | 队列积压 > 阈值                 |
| 存储容量        | SQLite → PostgreSQL → 分表/归档 | 数据量 > 阈值                   |
| Event 吞吐      | Partition by tenant_id          | Event rate > 单 poller 处理能力 |
| API 吞吐        | API Gateway 水平扩展            | QPS > 单实例上限                |
| Projection 延迟 | 增加 projector 实例             | Projection lag > SLO            |

## 8.2 无状态化原则

- P1 / P3 / P4 设计为无状态，所有持久状态存 P5
- Worker 通过 lease 机制避免状态绑定
- Session 状态通过 checkpoint 持久化，而非内存保持
- 任何进程可以被杀死并在另一个节点恢复

## 8.3 分片策略

当单节点不够时，按以下维度分片：

- **dispatch queue**：按 tenant_id hash 分片
- **event outbox**：按 aggregate_type 分区
- **projection rebuild**：按 projection_name 并行
- **worker pool**：按 capability_class 分池（coding / operations / browser）

## 8.4 扩展阶段

| 阶段      | 架构                            | 支撑规模                   | 备注                                                                            |
| --------- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| S1 单体   | 单进程 + SQLite                 | 10 并发 workflow, 5 worker | 对应落地 Phase 1-2                                                              |
| S2 多进程 | 主进程 + worker 进程 + Redis    | 50 并发, 20 worker         | 对应落地 Phase 3-4                                                              |
| S3 分布式 | 微服务 + PostgreSQL + event bus | 500 并发, 100 worker       | 对应落地 Phase 5-6                                                              |
| S4 集群   | Kubernetes + PG 分片 + 多 AZ    | 5000+ 并发                 | 需要多租户调度器(§53) + 跨 Pod 协调机制 + 多 Region 部署(§52)，对应落地 Phase 6 |

---

# 9. 稳定性架构

> 七层稳定性模型，每层定义**自动化机制**和**触发规则**。

## 9.1 稳定性层 1：隔离

**隔离维度**：tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**设计要求**：coding 与 operations 分池 · 高风险 adapter 独立池 · browser executor 不和普通 tool executor 混跑 · 高风险 tenant 可专属资源池

当某 tenant 的 failure rate > 30% 时，自动将该 tenant 隔离到独立 worker pool，不影响其他 tenant。

## 9.2 稳定性层 2：限流与背压

**限流点**：API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

**背压策略**：queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

背压策略按**梯度自动升级**：

```text
Level 0 (正常)     → queue_lag < 10s
Level 1 (预警)     → queue_lag 10-30s → 延迟低优先级
Level 2 (限流)     → queue_lag 30-60s → 拒绝低优先级 + supervised mode
Level 3 (保护)     → queue_lag > 60s  → 仅允许 critical workflow + manual_only
```

## 9.3 稳定性层 3：超时与重试

**三层超时**：step timeout · attempt timeout · tool/adapter timeout

**重试规则**：

- 仅 retryable failure 自动重试
- 仅幂等操作允许自动重试
- 退避策略：exponential backoff with jitter，base=1s, max=60s
- 重试用尽后进入显式 `retry_exhausted` 状态，触发 escalation

## 9.4 稳定性层 4：断路器

**断路器对象**：第三方 API · 外部 adapter · 模型 provider · 高失败率工具 · plugin runtime

**状态机**：closed → open（failure_rate > 50% in 60s window）→ half-open（30s 后小流量探测）→ closed

断路器状态变化必须发射 `circuit_breaker.state_changed` 事件，触发告警和 mode switching 评估。

## 9.5 稳定性层 5：降级模式

**正式模式**：full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

模式切换通过 `ControlDirective` 发出，支持自动触发规则：

| 触发条件                      | 自动切换到                     |
| ----------------------------- | ------------------------------ |
| worker pool unhealthy > 50%   | supervised_auto                |
| external adapter circuit open | no-external-call               |
| security incident detected    | incident-mode                  |
| rollout guardrail breach      | no-rollout                     |
| approval backlog > 100        | manual_only（暂停新 workflow） |

## 9.6 稳定性层 6：恢复能力

**恢复组件**：lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

每个恢复组件必须有独立的 health check，并通过 `RecoveryReport` 向 Control Plane 汇报恢复成功率。

## 9.7 稳定性层 7：可观测性

**最少能力**：metrics · structured logs · traces · audit · event timeline · health snapshot

定义核心可观测性指标（见 §27 性能与 SLO）。

---

# 10. 风险控制架构

> 四分法风险模型，含**风险评分算法**和**自动化风险控制引擎**。

## 10.1 风险模型四分法

- **R1 执行风险**：错误执行 · 重复执行 · 并发冲突 · stale write
- **R2 业务风险**：错误改代码 · 错误切流量 · 错误发通知 · 错误发布
- **R3 安全风险**：越权访问 · 数据泄露 · secret 暴露 · 非授权外联
- **R4 平台风险**：rollout 失控 · projection 失真 · replay 误操作 · worker pool 雪崩

## 10.2 风险评分算法

> 定义风险评分公式，将 "low/medium/high/critical" 四级量化。

```text
risk_score = Σ(factor_weight × factor_value) / max_possible_score

因子权重：
  step_type_risk:      weight=3  (read=1, write=3, delete=5, external_call=4)
  target_system_risk:  weight=4  (internal=1, staging=2, production=5)
  data_class_risk:     weight=3  (public=1, internal=2, confidential=4, restricted=5)
  blast_radius:        weight=2  (single_task=1, workflow=2, tenant=3, platform=5)
  prior_failure_rate:  weight=2  (0-10%=1, 10-30%=2, 30-50%=3, >50%=5)
  confidence:          weight=1  (high=1, medium=3, low=5)

映射：
  0.0 - 0.25  →  low
  0.25 - 0.50 →  medium
  0.50 - 0.75 →  high
  0.75 - 1.00 →  critical
```

## 10.3 风险自动控制引擎

v4.1 将固有风险、信任分与审批策略拆开建模：

```text
inherent_risk = f(operation, domain, data_class, blast_radius, reversibility)
automation_mode = f(trust_score, domain_cap, policy)
approval_policy = f(inherent_risk, automation_mode, org_policy)
```

硬约束：

- `trust_score` 不得降低 `inherent_risk`，只能降低低风险任务的确认频率、排队摩擦或人工复核强度。
- `trust_score` 不得绕过合规审批、数据分级、sandbox、egress 控制、budget hard cap 或不可逆副作用确认。
- DomainRiskProfile 可以提高固有风险，也可以收紧审批；放松平台默认风险必须有审计理由和 P2 policy approval。

```text
RiskAssessmentRequest
  → 计算 risk_score
  → 查询 tenant 风险策略覆盖
  → 确定 risk_level
  → 匹配 risk_action_rule
  → 输出 RiskDecision { level, actions[], requires_approval, evidence_level }
```

**风险控制动作矩阵**：

| risk_level | 自动执行 | 日志级别 | 审批        | side effect | evidence |
| ---------- | -------- | -------- | ----------- | ----------- | -------- |
| low        | ✅       | info     | 否          | 正常        | 基础     |
| medium     | ✅       | warn     | 否          | 正常 + 校验 | 增强     |
| high       | ❌       | error    | 必须        | 受限        | 完整     |
| critical   | ❌       | critical | break-glass | 禁止        | 法务级   |

## 10.4 风险缓释机制

sandbox mode · read_only mode · write_limited mode · approval gate · dry_run · shadow mode · canary · rollback plan mandatory · evidence bundle mandatory

---

# 11. 安全可靠架构

## 11.1 统一身份模型

所有动作都必须有 principal。

**principal 类型**：user · service · agent · worker · plugin · system

**要求**：所有 event / audit / decision / incident 关联 principal。所有 incident 可追 principal chain。

## 11.2 统一授权模型

三层：

- **RBAC**：角色级权限
- **Capability**：能力级权限（can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events）
- **Context-aware policy**：结合 tenant / project / workflow / environment / risk level / data class 动态决策

授权决策记录为 `PolicyOutcome`，包含 decision / matched_rules / evaluation_duration，支持审计和策略调优。

## 11.3 Secret 安全

- secret 仅允许引用，不明文传递
- secret 注入短时有效（TTL ≤ 300s）
- secret 不进入 memory / knowledge
- artifact 输出前做 secret scan
- logs / traces / audit 统一做 secret redaction

## 11.4 Sandbox 安全

四档：read_only · workspace_write · scoped_external_access · restricted_exec

任何高风险动作都不应直接 full access。

**技术实现规格**：

| Sandbox Tier           | 隔离技术         | 文件系统                | 网络                  | 进程   | 资源限制    |
| ---------------------- | ---------------- | ----------------------- | --------------------- | ------ | ----------- |
| read_only              | 子进程 + seccomp | 只读挂载                | 禁止                  | 单进程 | 256MB / 10s |
| workspace_write        | 子进程 + seccomp | tmpfs 写 + workspace 写 | 禁止                  | 单进程 | 512MB / 30s |
| scoped_external_access | 容器（可选）     | tmpfs 写                | egress allowlist only | 多进程 | 1GB / 60s   |
| restricted_exec        | 容器             | overlay fs              | egress allowlist      | 多进程 | 2GB / 300s  |

## 11.5 网络出站安全

所有外部调用经过 egress control。控制维度：destination allowlist · adapter binding · credential binding · data class · environment · operation type。egress deny 必须作为正式安全事件记录。

## 11.6 数据分级

基础分级：public · internal · confidential · restricted

扩展标签：pii · regulated · secret-bearing

分级影响：可否入模型 · 可否外发 · 可否进入知识 · 是否必须审批

## 11.7 插件安全

插件视为不可信扩展。要求：独立进程 · 资源限制 · IPC 边界 · capability 白名单 · 输出校验 · 崩溃隔离 · 可 quarantine · 可热禁用。

## 11.8 威胁模型（STRIDE）

| 威胁                       | 攻击面                        | 缓释措施                                                |
| -------------------------- | ----------------------------- | ------------------------------------------------------- |
| **S**poofing（伪装）       | API 调用、Agent 身份          | JWT/API Key 认证 + Principal 链追溯                     |
| **T**ampering（篡改）      | event log、artifact、prompt   | append-only event + CAS + content hash 校验             |
| **R**epudiation（抵赖）    | 操作不可追溯                  | 全链路审计 + evidence bundle + 不可变 audit log         |
| **I**nformation Disclosure | Prompt 泄露、Secret 泄露、PII | Secret redaction + 数据分级 + Prompt 不对终端暴露       |
| **D**enial of Service      | API 过载、Worker 耗尽         | 限流 + 背压 + 按 tenant 配额 + circuit breaker          |
| **E**levation of Privilege | Plugin 越权、Agent 提权       | Sandbox tier + capability 白名单 + context-aware policy |

**补充威胁**：

| 威胁                      | 攻击面                     | 缓释措施                                        |
| ------------------------- | -------------------------- | ----------------------------------------------- |
| Prompt Injection          | 用户输入注入恶意指令       | 输入 sanitization + output 校验 + Sandbox 限制  |
| Model Manipulation        | 恶意 fine-tune / jailbreak | 质量门禁（§17）+ 输出安全检查                   |
| Data Exfiltration via LLM | 模型记忆敏感数据           | data_classification 路由（§15.3）+ PII 不入模型 |

## 11.9 加密策略

传输加密、存储加密和 Key 管理详见 §23.5 加密架构。本节强调安全层的约束：

- 所有平面间通信必须 TLS 1.3（进程内除外）
- P5 存储的 PII 字段必须应用级加密（不依赖数据库 TDE）
- Secret 存储集成 Vault（或等效 KMS），应用层仅持有引用
- 审计日志必须包含完整性签名（HMAC），防止事后篡改

---

# 12. 异常事件处理架构

> E1-E6 分类和 SEV1-4 分级，含**可观测性数据模型**和**自动检测规则**。

## 12.1 异常事件分类

- **E1 业务异常**：validation fail · wrong output · no result · low confidence
- **E2 执行异常**：timeout · worker crash · lease expired · retry exhausted
- **E3 外部依赖异常**：adapter failure · provider timeout · rate limit · circuit open
- **E4 安全异常**：unauthorized access · secret leak risk · egress deny · policy violation
- **E5 数据异常**：stale projection · event append failure · invariant break · replay inconsistency
- **E6 治理异常**：rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 异常等级

- SEV4：局部轻微，可自动恢复
- SEV3：单 workflow / 单 worker 影响
- SEV2：单业务域 / 单租户明显受影响
- SEV1：平台级影响 / 安全事件 / 生产严重风险

## 12.3 异常检测规则引擎

> 将异常检测从"硬编码"升级为"规则引擎"。

**内置规则示例**：

| 规则                      | 条件                       | 等级 | 动作                                         |
| ------------------------- | -------------------------- | ---- | -------------------------------------------- |
| worker_heartbeat_missing  | heartbeat_gap > 30s        | SEV3 | create_incident + lease_reclaim              |
| execution_timeout_spike   | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised)             |
| projection_lag_high       | lag > 30s                  | SEV3 | notify + rebuild_trigger                     |
| security_policy_violation | any violation              | SEV2 | create_incident + quarantine                 |
| platform_wide_failure     | error_rate > 50% in 1min   | SEV1 | create_incident + mode_switch(incident-mode) |

## 12.4 可观测性数据模型

> 定义可观测性具体指标。

### 核心 Metrics

| 指标名                         | 类型      | 标签               | 说明            |
| ------------------------------ | --------- | ------------------ | --------------- |
| `agent.task.total`             | counter   | tenant, status     | 任务总数        |
| `agent.execution.duration_ms`  | histogram | tenant, step_type  | 执行耗时        |
| `agent.execution.failure_rate` | gauge     | tenant, error_type | 失败率          |
| `agent.dispatch.queue_depth`   | gauge     | queue_class        | 队列深度        |
| `agent.dispatch.latency_ms`    | histogram | queue_class        | 调度延迟        |
| `agent.worker.active`          | gauge     | pool, capability   | 活跃 worker 数  |
| `agent.projection.lag_seconds` | gauge     | projection_name    | Projection 延迟 |
| `agent.approval.pending_count` | gauge     | severity           | 待审批数        |
| `agent.circuit_breaker.state`  | gauge     | target             | 断路器状态      |
| `agent.dlq.depth`              | gauge     | category           | DLQ 深度        |

### Structured Log 规范

每条日志必须为 JSON 格式，包含以下必填字段：

| 字段                | 类型    | 说明                                              |
| ------------------- | ------- | ------------------------------------------------- |
| `timestamp`         | ISO8601 | 毫秒精度，UTC 时区                                |
| `traceId`           | string  | 关联分布式 Trace（§12.7）                         |
| `spanId`            | string  | 当前 Span 标识                                    |
| `level`             | enum    | DEBUG / INFO / WARN / ERROR / FATAL               |
| `service`           | string  | 发出日志的服务名                                  |
| `plane`             | enum    | P1-P5 / X1-X2，标识所属平面                       |
| `message`           | string  | 人类可读的简短描述                                |
| `structuredPayload` | object  | 业务上下文键值对（tenantId、domainId、taskId 等） |

**日志级别使用准则**：DEBUG 仅用于本地开发；INFO 记录正常业务流转；WARN 记录可自动恢复的异常；ERROR 记录需人工介入的故障；FATAL 记录导致进程退出的严重错误。生产环境默认级别为 INFO。

## 12.5 DLQ 与 Incident

**DLQ 必须有**：category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status。DLQ 不是垃圾桶，必须可运营。

**Incident 必须关联**：affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution。

## 12.6 告警路由架构

> Incident 产生后必须路由到正确的人。

| SEV 级别 | 通知渠道              | 响应 SLA   | 升级规则              |
| -------- | --------------------- | ---------- | --------------------- |
| SEV4     | 平台控制台 + 日志     | 下个工作日 | 无                    |
| SEV3     | IM 通知（Slack/飞书） | 4h         | 4h 无响应 → SEV2      |
| SEV2     | IM + Email + on-call  | 1h         | 1h 无响应 → SEV1      |
| SEV1     | IM + 电话 + 全员广播  | 15min      | 15min 无响应 → 管理层 |

**外部集成**：通过 Webhook 对接 PagerDuty / OpsGenie / 企业 IM。平台不内置告警通道实现，仅定义路由规则和投递接口。

## 12.7 分布式 Tracing 架构

> 定义 trace → span → log → metric 的关联模型。

**Span 层级**：

```text
Trace (task_id)
  └─ Span: workflow_run
       ├─ Span: oapeflir_cycle
       │    ├─ Span: observe
       │    ├─ Span: assess
       │    ├─ Span: plan
       │    │    └─ Span: llm_call (model_gateway)
       │    └─ Span: feedback
       ├─ Span: dispatch
       ├─ Span: execution (step)
       │    └─ Span: tool_call / llm_call / human_wait
       └─ Span: state_write
```

**关联规则**：

- 所有 StructuredLog 必须包含 trace_id + span_id（已有）
- Metrics 通过 exemplar 关联 trace_id（高基数指标采样）
- Incident 关联 trigger trace_id，支持从 incident 追溯到完整调用链
- 采样策略：error trace 100% 采集，normal trace 按 tenant 配置（默认 10%）

---

# 13. OAPEFLIR 受控认知框架

> v4.1 收敛口径：OAPEFLIR 是 Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release 的认知与治理框架，不是执行引擎。唯一可执行运行时入口是 HarnessRuntime，唯一权威运行实体是 HarnessRun。OAPEFLIR 阶段只能作为 StageRationale、TraceProjection、Audit View 和解释视图存在，不拥有独立执行权。

一句话概括：

```text
OAPEFLIR v4.1 = Controlled Cognitive/Governance Semantics over HarnessRuntime
```

## 13.1 定位：语义框架，不是执行引擎

OAPEFLIR 定义每个 HarnessRun 在认知、治理、反馈和发布上的阶段语义。它不创建独立 Run，不直接驱动状态迁移，不直接调度 worker，也不直接提交 side effect。

**强制不变量**：

1. 任何任务只能创建一个 HarnessRun。
2. OAPEFLIR 不创建独立 Run。
3. OAPEFLIR 阶段状态只能作为 trace / projection / rationale 存在。
4. HarnessRun 状态迁移是唯一可执行状态迁移。
5. OapeflirTraceProjection 可从 HarnessRun / HarnessStep / NodeRun 事件派生，但不得反向驱动执行。

## 13.1.1 OAPEFLIR → HarnessRun 投影关系

| OAPEFLIR 阶段 | Harness 权威对象 | 记录形态 |
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

| 阶段 | 职责 | 标准产物 | 是否可直接产生副作用 |
| --- | --- | --- | --- |
| Observe | 观察输入、事件、上下文、目标 | ObservationBundle | 否 |
| Assess | 风险、权限、可行性、预算、策略评估 | AssessmentBundle | 否 |
| Plan | 生成可执行 PlanGraph | PlanGraphBundle | 否 |
| Execute | 执行 Graph Node，调用工具 / LLM / HITL / Subgraph | NodeRun / ExecutionReceipt | 受控 |
| Feedback | 对执行结果、偏差、质量、风险进行反馈 | FeedbackEnvelope | 否 |
| Learn | 从反馈中提取候选经验 | LearningCandidate | 否 |
| Improve | 生成 Prompt / Policy / Tool / Domain 改进候选 | ImprovementChangeSet | 否 |
| Release | 评测、审批、灰度、发布、回滚 | ReleaseRecord | 是，仅限配置发布 |

## 13.3 OAPEFLIR 与五平面关系

| 平面 | OAPEFLIR-Harness 关系 | 关键契约 |
| --- | --- | --- |
| P1 Interface | 输入统一进入 RequestEnvelope，不把原始自然语言直传 Runtime | RequestEnvelope、SessionContext |
| P2 Control | 提供策略、审批、预算、版本锁和发布治理 | EffectivePolicySnapshot、ControlDirective、EvaluationGate |
| P3 Orchestration | 承载 Observe / Assess / Plan / Feedback / Learn / Improve / Release 语义 | HarnessRun、PlanGraphBundle、DecisionInputBundle、OapeflirTraceProjection |
| P4 Execution | 执行 ready NodeRun，不可绕过 Graph 校验和副作用治理 | NodeRun、SideEffectRecord、ReconciliationRecord |
| P5 State & Evidence | 保存 truth、event、checkpoint、artifact、audit，支持 replay 与 lineage 查询 | Event Registry、BudgetLedger、RunVersionLock |

## 13.4 阶段间数据流

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
                                └─→ ExecutionReceipt
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

OAPEFLIR 八阶段是平台内部认知内核。对产品方、业务方和多 Agent 协作场景，提供一层简化的 **Harness 角色映射**：

| Harness 角色        | OAPEFLIR 阶段映射                       | 职责边界                                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| **Planner**         | Observe + Assess + Plan                 | 理解目标、分解任务、识别风险、生成执行计划、选择工具与资源预算、产生验收标准 |
| **Generator**       | Execute（委托 P4）                      | 调用工具、执行步骤、写回证据、生成阶段性结果、遇到阻塞时请求帮助而非硬闯     |
| **Evaluator**       | Feedback + 局部评估 + 质量门            | 判断结果质量、检查目标偏离、检查风险升高、决定通过/重做/降级/升级到 HITL     |
| **Loop Controller** | Learn + Improve + Replan + Release gate | 控制循环次数、决定何时 replanning、何时审批、何时终止、何时发布改进结果      |

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

两层映射的意义：

- **对内**：OAPEFLIR 保持精细阶段控制，每个阶段有独立接口契约和 Zod 校验
- **对外**：Harness 四角色语义更易理解，便于多 Agent 协作协议标准化
- **对调试**：可在 Harness 粒度观测全链路，也可下钻到 OAPEFLIR 单阶段

**双模型使用硬规则**：对外协议一律使用 Harness 角色语义（Planner/Generator/Evaluator/Decision）；对内实现允许继续以 OAPEFLIR 八阶段细分。

| 受众视角    | 使用模型               | 典型场景                             |
| ----------- | ---------------------- | ------------------------------------ |
| 产品/业务   | Harness 四角色         | 需求沟通、能力介绍、API 文档         |
| 运行时/调度 | HarnessRun / PlanGraph | 执行引擎、LoopController、状态机推进 |
| 审计/合规   | HarnessRun/HarnessStep | 运行证据链、合规报告、审批记录       |
| ML/算法     | OAPEFLIR 八阶段        | 模型评测、prompt 调优、阶段性能分析  |

## 13.6 OAPEFLIR-Harness 核心不变量

1. HarnessRun / NodeRun 状态机必须封闭，终态不得迁出。
2. 所有状态迁移必须 event-driven，且 truth update 与 event append 同事务。
3. 复杂任务的 Plan 必须是 Graph；线性 steps 仅可作为单节点或 legacy 展示。
4. Graph 执行前必须完成 Normalize、Validate、Risk Propagation、Worst-Path Analysis。
5. Graph Scheduler 必须 deterministic；每次 ready node 选择必须写事件，支持 Trace Replay。
6. Retry / Redrive 必须追加 AttemptLineage，不得覆盖旧 attempt。
7. LLM / Tool / SideEffect / Evaluation 前必须 reserve budget；budget exhausted 优先于 retry / replan。
8. SideEffect ambiguous 不得自动视为 success，不可逆副作用必须 confirmation / reconciliation / manual review。
9. Replay 不得产生真实副作用。
10. Learn / Improve 不得直接上线，必须进入 EvaluationGate 与 P2 Release 治理。

## 13.7 Plan 必须是 Graph

PlanGraph 是 HarnessRun plannerOutput 的主执行结构，也是 OAPEFLIR Plan 阶段的投影视图。它显式表达并发、依赖、join、terminal、补偿和风险传播边界，避免线性 steps 隐藏真实依赖。

**图化硬规则**：

- 每个 PlanGraph 必须至少有一个 entry node 和一个 terminal node。
- 所有 nodeId / edgeId 必须稳定，便于 event、checkpoint、lineage 引用。
- 并发只由 ready node 集合表达，不允许 worker 自行推断。
- 高风险 node 必须带 `riskProfile`、`approvalRequirement`、`compensationPolicy`。
- 子任务、委托、多 Agent 协作必须作为 Subgraph 或 ChildRun 显式建模。

## 13.8 PlanGraph 契约

| 对象 | 必填内容 | 说明 |
| --- | --- | --- |
| PlanGraphBundle | planGraphId、graphVersion、graph、schedulerPolicy、budget、riskProfile、validationReport、evidenceRefs | P3 → P4 的正式执行计划载体 |
| PlanGraph | nodes、edges、entryNodeIds、terminalNodeIds、graphMetadata | 可执行图本体 |
| PlanNode | nodeId、kind、inputs、expectedOutputs、toolPolicy、riskProfile、budgetReservationHint | 最小执行单元 |
| PlanEdge | edgeId、from、to、condition、edgeKind | 依赖、条件、补偿、失败路径 |
| GraphPatch | baseGraphVersion、operations、compatibilityReport、reason、auditRef | Replan 的追加式变更 |

## 13.9 Graph Normalization

Normalization 将 Planner 产物收敛为可执行图：

- 生成稳定 nodeId / edgeId
- 补齐 entry / terminal / failure terminal
- 将隐式串行顺序转为显式 edge
- 将高风险 node 标注 approval / compensation / sandbox
- 将预算提示拆分到 node 级 reservation hint

Normalization 必须输出 `GraphNormalizationReport`，并作为 evidence 保存。

## 13.10 Graph Validation

Validation 是 P4 执行前的强制准入门。必须至少校验：

- DAG / 受控循环合法性
- entry / terminal 存在且可达
- no deadlock / no orphan / no impossible join
- node kind 有对应 executor 或 HITL handler
- 风险、预算、tool、sandbox、approval 配置完整
- 不可逆副作用有 confirmation / reconciliation / manual review 路径
- GraphPatch 与 baseGraphVersion 兼容

`validationReport.valid=false` 的图不得进入 `ready`，只能 replan、escalate 或 abort。

## 13.11 Graph Risk Propagation

风险不是 node 局部属性。GraphRiskPropagator 必须沿依赖边传播风险，计算：

- 全图最高风险
- 每条路径累计风险
- 高风险 node 对下游 output / memory / side effect 的 taint
- 需要审批、隔离 worker、降级模式的 node 集合

## 13.12 Graph Worst-Path Analysis

Worst-Path Analysis 在执行前估计最坏路径的时间、成本、token、工具调用、审批等待和补偿成本。若最坏路径超过 ConstraintPack 或 BudgetLedger 的硬上限，PlanGraph 不得执行，必须 replan 或 escalate。

## 13.13 GraphPatch 与 Replan

Replan 不覆盖旧图，而是追加 GraphPatch：

```text
PlanGraph(v1) + GraphPatch(v2 operations) → PlanGraph(v2)
```

GraphPatch 必须声明 baseGraphVersion、patch reason、受影响 node/edge、兼容性报告和审计引用。已完成或已提交不可逆副作用的 node 不得被静默删除；只能通过补偿、跳过后续路径、追加修复节点或人工接管处理。

## 13.14 OAPEFLIR 与 Evaluation / Learning / Release 的闭环关系

Feedback 只产生事实与建议；Learn 只产生 LearningCandidate；Improve 只产生 ImprovementChangeSet。任何 Prompt / Policy / Tool / Domain 改进必须进入 EvaluationGate，经过离线评测、回归集、风险扫描、审批、灰度与回滚策略后才可 Release。LLM-as-Judge 可作为辅助评分，但不能覆盖确定性失败、策略拒绝、安全违规、预算耗尽或 replay 不一致。

---

# 14. Runtime Execution Plane

> 核心职责定义，含**执行策略模式**和**Executor 注册机制**。

## 14.1 核心职责

session / task / workflow_run / execution 生命周期 · dispatch / queue / worker 调度 · lease / fencing · executor 调用 · side effect 受控提交 · retry / timeout / recovery · mode-aware execution · 事件发射

## 14.2 Dispatcher 智能调度

Dispatcher 同时是风险隔离点，调度决策矩阵：

| 因子                | 影响                             |
| ------------------- | -------------------------------- |
| worker capability   | 匹配 step 所需能力               |
| worker health       | 排除不健康 worker                |
| queue class         | priority / standard / background |
| risk class          | 高风险步骤分配到隔离 pool        |
| tenant quota        | 单 tenant 不超过配额             |
| sandbox requirement | 匹配 sandbox tier                |

## 14.3 执行策略模式

> 将执行策略从硬编码升级为可配置模式。

每个 Business Pack 可以声明自己的 ExecutionStrategy 覆盖默认值。

## 14.4 Executor 注册机制

> 将 executor 从硬编码升级为可插拔注册。

**内置 Executor 类型**：ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect 提议与提交入口

1. Executor 返回 proposed side effect
2. Policy / approval 决定是否允许进入 commit
3. SideEffect Manager 记录 delivery semantics 与确认策略
4. 提交后进入 confirmation / reconciliation / compensation（见 §14.11-§14.13）

> 工具执行成功，不等于副作用已正式生效；只有 confirmed 的副作用才可作为成功事实。

## 14.6 HumanWait 是正式执行器

审批等待不是旁路。HumanWait 负责：creates decision → blocks execution → waits resolution → resumes flow。

## 14.7 Recovery Worker 族

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

每个 Recovery Worker 必须声明自己的 `RecoveryCadence`（检查间隔、最大并发恢复数、超时），并通过 `RecoveryReport` 汇报结果。

## 14.8 Runtime 模式切换

**规范模式集**（与 §9.5 一致）：full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

其中 `full_auto` 对应旧称 `normal`，`supervised_auto` 对应旧称 `degraded`/`supervised`。所有运行时模式必须使用此规范枚举。

模式切换权归 P2 Control Plane，通过 `ControlDirective(type: "mode_switch")` 下发。

## 14.9 Deterministic Graph Scheduler

P4 不再消费隐含顺序的 steps，而是消费 `PlanGraphBundle`。Graph Scheduler 只调度满足依赖、策略、预算、lease、worker capability、risk isolation 的 ready node，并按确定性策略排序。

| 策略因子 | 说明 |
| --- | --- |
| priority | node 显式优先级，数值越高越先调度 |
| risk_class | 高风险 node 优先进入隔离队列或 HITL |
| critical_path_rank | 位于 worst path 的 node 可优先减少尾延迟 |
| created_order | 作为稳定 tie-breaker，保证 replay 一致 |
| scheduler_seed | 同一 graph + policy + recorded ready set 产生同一调度顺序；调度决策必须写事件 |

Scheduler 不得根据 worker 本地时间、随机数或不可回放外部状态决定顺序；所有调度选择必须写入事件。

## 14.10 NodeRun State Machine

`NodeRun` 是 P4 的最小执行状态实体。标准状态：

```text
created → ready → leased → running → succeeded
                         ├→ failed
                         ├→ retry_wait
                         ├→ awaiting_hitl
                         ├→ reconciling
                         ├→ compensated
                         └→ aborted
```

终态集合为 `succeeded / failed / compensated / aborted`。终态不可迁出；retry / redrive 必须创建新 attempt 并追加 AttemptLineage。所有状态迁移必须基于 CAS + active lease + fencing token。

## 14.11 SideEffect Manager v4.4

SideEffect 从"两阶段记录"升级为交付语义完整的状态机：

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

**副作用硬规则**：

- 工具返回 success 不等于副作用 confirmed。
- `ambiguous` 不得自动视为 success。
- `approved` 只是授权窗口，不是提交事实；approval 过期、撤回或 scope 不匹配时必须进入 `expired` / `revoked`，两者均为不可提交终态；若需继续执行，必须重新创建 SideEffectRecord 或重新审批。
- commit 前必须重新校验：approval 仍有效、budget reservation 已持有、policy 仍兼容、risk 未升高或已被显式接受、operator scope 覆盖本次副作用。
- 不可逆副作用必须有 confirmation、reconciliation 或 manual review。
- compensation 只能追加补偿记录，不得删除原始副作用证据。
- replay / simulation 环境必须禁用真实 side effect，只能产出 simulated receipt。

## 14.12 Reconciliation Worker

当外部系统 timeout、连接中断、commit receipt 丢失或幂等键状态不明时，Reconciliation Worker 接管对账：

| 状态 | 触发 | 后续动作 |
| --- | --- | --- |
| pending | SideEffect ambiguous | 查询外部状态或幂等键 |
| matched | 外部状态与预期一致 | 标记 confirmed |
| diverged | 外部状态与预期不一致 | 创建 incident + compensation_required |
| unknown | 无法确认 | 升级 manual_review_required |
| expired | 对账窗口过期 | 按风险等级 escalate / abort / compensate |

Reconciliation 结果必须关联原始 SideEffectRecord、NodeRun、traceId、external idempotency key 与 evidence bundle。

## 14.13 Compensation Manager

Compensation Manager 管理可逆、副作用补偿和人工修复路径。补偿不是回滚数据库状态，而是对外部世界追加一个可审计的修复动作。不可补偿的副作用必须在 PlanGraph 阶段标记为 `irreversible`，并在执行前提高审批与确认要求。

## 14.14 Retry / Redrive / AttemptLineage

Retry 是同一 NodeRun 的自动重试策略；Redrive 是人工或恢复流程触发的新 attempt。两者都必须追加 AttemptLineage：

| 字段 | 说明 |
| --- | --- |
| attemptId | 单次尝试唯一标识 |
| parentAttemptId | retry / redrive 来源 |
| reason | timeout / transient_error / operator_redrive / reconciliation_fix |
| inputSnapshotRef | 本次尝试使用的冻结输入 |
| outputRef | 输出或错误引用 |
| budgetReservationRef | 预算预留记录 |
| terminalStatus | 本次尝试终态 |

AttemptLineage 是审计和 replay 的事实来源，不得覆盖、压缩或删除。

---

# 24. 配置治理架构

> 定义完整的配置治理模型。

## 24.1 配置分层

| 层         | 示例                          | 变更频率 | 审批要求    |
| ---------- | ----------------------------- | -------- | ----------- |
| 平台默认   | retry_max=3, timeout=5000ms   | 极低     | ADR 级      |
| 环境覆盖   | prod.timeout=10000ms          | 低       | P2 审批     |
| 租户覆盖   | tenant_A.max_concurrent=50    | 中       | 租户管理员  |
| 业务包覆盖 | coding.retry_max=5            | 中       | Pack 负责人 |
| 运行时动态 | circuit_breaker.threshold=0.3 | 高       | 自动规则    |

## 24.2 配置版本化

- 每次配置变更生成新版本，保留完整历史
- 支持 diff：展示两个版本间的差异
- 支持 rollback：一键回退到任意历史版本
- 配置变更发射 `config.changed` 事件，触发相关组件热加载

## 24.3 配置灰度

高风险配置变更（如 timeout、限流阈值）支持灰度：

1. 先应用到 canary 环境
2. 观察 30 分钟无异常
3. 扩展到 10% 流量
4. 全量发布

## 24.4 配置安全

- 敏感配置（secret、credential）只存引用，不存明文
- 配置变更审计，记录 who / when / what / why
- 关键配置（sandbox tier、egress allowlist）变更必须 P2 审批

---

# 25. 数据与状态一致性架构

平台的状态分为五个层次，自上而下分别服务于控制、执行、上下文、知识和证据。各层在隔离性、生命周期和一致性要求上各不相同：

```text
┌─────────────────────────────────────────────────────┐
│  L1  Control State    （Policy/Approval/Budget）     │  §11-§13, §45.20
│      生命周期：跨 run · 强一致 · 变更需审批          │
├─────────────────────────────────────────────────────┤
│  L2  Execution State  （TaskRun/Step/Checkpoint）    │  §14-§16, §45.15
│      生命周期：单 run · 事务一致 · checkpoint 可恢复  │
├─────────────────────────────────────────────────────┤
│  L3  Context State    （Session/Turn/Variables）     │  §45.5 ContextManager
│      生命周期：单 session · 最终一致 · 可快照         │
├─────────────────────────────────────────────────────┤
│  L4  Knowledge State  （Working/Long-term/Shared）   │  §45.16 Memory Namespace
│      生命周期：跨 run/跨 agent · 异步同步 · 可晋升   │
├─────────────────────────────────────────────────────┤
│  L5  Evidence State   （Event/Trace/Metric/Audit）   │  §25-§29, §58-§59
│      生命周期：永久追加 · 不可变 · 可回放重建         │
└─────────────────────────────────────────────────────┘
```

五层之间的关键不变式：L2 的每次状态变更必须同步追加 L5 事件；L3→L4 的晋升由 Evaluator 裁决（§45.16）；L1 变更必须经 P2 审批后才可作用于 L2/L3。

## 25.1 一致性原则

不追求全局强一致，追求：truth state 事务一致 · event append 同事务 · projection 最终一致 · replay 可重建 · side effect 可审计。

## 25.2 真相表 + Event Log 双模型

- 真相表保存当前状态（读优化）
- Event log 保存历史变化（审计/回放优化）
- 两者在同一事务中更新，保证一致

## 25.3 CAS + Lease + Fencing

所有关键更新必须基于：expected status CAS · active lease · fencing token。这是执行层一致性的硬约束。

## 25.4 Projection 必须可重建

所有 projection 都必须：idempotent · replay-safe · event_id 去重 · 支持 rebuild · 不反写真相。

## 25.5 State & Evidence 分层

| 层         | 内容         | 用途                                     |
| ---------- | ------------ | ---------------------------------------- |
| Truth      | 当前控制真相 | 状态判断、并发控制、调度推进             |
| Event      | 历史变化轨迹 | 时间线重建、回放、故障解释               |
| Projection | 查询模型     | Console、报表、审批队列                  |
| Audit      | 审计记录     | 谁对什么做了什么                         |
| Artifact   | 大对象内容   | observation/plan/log/evidence/screenshot |
| Checkpoint | 执行恢复点   | 断点恢复、repair、replay 起点            |

## 25.6 一致性模型与保证级别

| 操作              | 一致性保证                    | 实现机制                                  |
| ----------------- | ----------------------------- | ----------------------------------------- |
| Truth table 写入  | 强一致（单分区线性一致）      | CAS + fencing token + 同事务 event append |
| Event append      | 强一致（与 truth 同事务）     | outbox pattern（§7.3）                    |
| Projection 读取   | 最终一致（lag ≤ 5s SLO，§27） | 异步 projector + event_id 去重            |
| Cross-tenant 查询 | 最终一致                      | Projection 聚合，不跨 truth 事务          |
| Cross-region 复制 | 最终一致（lag ≤ 30s，§52）    | 异步 replication + conflict resolution    |

**Read-your-own-writes 保证**：写入 truth table 后，同一 principal 的后续读请求通过 read-after-write token 直接读 truth table，不依赖 projection。Projection 路径不保证 read-your-own-writes。

**Projection 最终一致窗口**：正常运行 lag ≤ 5s；event bus 背压时 lag 可达 60s（触发 Level 2 告警，§9.2）；Projection rebuild 期间特定 projection 暂时不可用，Console 显示 stale 标记。

## 25.7 Schema 迁移策略

当前 `SchemaInventoryService` 会从 authoritative schema 与 extension DDL 汇总 86 张逻辑表（§26.3），需要通过版本化 schema 演进收口：

- **向后兼容变更**（新增列、新增索引）：在线 migration，无停机
- **破坏性变更**（列重命名、类型变更、表拆分）：双写窗口（old schema + new schema 同时写入 → 切换读路径 → 停写旧 schema → 清理）
- **Migration 版本追踪**：每个 migration 脚本有 monotonic version，通过 `schema_migrations` 表追踪已执行版本
- **回滚能力**：每个 migration 必须有对应 rollback 脚本
- **存储演进关联**：Schema migration 策略与存储演进路径（§26.2 E1→E4）对齐——E1/E2 使用 SQLite migration，E3/E4 使用 PostgreSQL migration

## 25.8 HarnessRun / NodeRun 状态一致性

v4.1 将 HarnessRun 与 NodeRun 状态作为 P5 truth 的一级对象。OAPEFLIR 阶段状态只作为 `OapeflirTraceProjection` 派生，不参与可执行状态迁移。所有状态迁移必须满足：

- expected status CAS 成功
- active lease 未过期
- fencing token 匹配
- 状态迁移在状态机允许集合内
- truth update 与 event append 在同一事务内完成

`HarnessRun` 标准状态：created · admitted · planning · ready · running · pausing · paused · resuming · replanning · compensating · completed · failed · aborted。

`NodeRun` 标准状态：created · ready · leased · running · retry_wait · awaiting_hitl · reconciling · succeeded · failed · compensated · aborted。

终态封闭规则：completed / failed / aborted / succeeded / compensated 作为终态后不得迁出；任何修复必须以 redrive、compensation、GraphPatch 或 child run 追加方式表达。

## 25.9 Budget Ledger 一致性

Budget Ledger 是 run 级预算事实来源，不再依赖分散的 token 统计。LLM、Tool、SideEffect、Evaluation、HITL 等可能消耗预算的动作必须先 reserve，再 consume 或 release。

```text
reserve → consume
        └→ release
        └→ expire
```

预算硬规则：

- budget exhausted 优先级高于 retry / replan / evaluator accept。
- reservation 必须绑定 runId、nodeRunId、attemptId、principal、reason。
- consume 不得超过 reservation；超额必须创建 incident 或 require approval。
- replay 默认使用 shadow ledger，不影响真实预算。

## 25.10 RunVersionLock

每个 HarnessRun 在 admitted 时冻结 `RunVersionLock`，锁定本次运行使用的 Prompt、Policy、Tool、Domain、Model、Eval、Guardrail、RuntimeProfile 和 schema version。运行中配置发布不得改变已运行 run 的语义；只能通过显式 GraphPatch、ControlDirective 或 redrive 使用新版本。

RunVersionLock 目标：

- 支撑 Trace Replay 与事故审计
- 避免半途中 Prompt / Policy 漂移
- 支撑事故审计和发布回滚
- 明确 learn / improve 生成候选时的来源版本

### VersionLockOverridePolicy

GraphPatch 与 RunVersionLock 冲突时，必须按以下策略处理：

| 策略 | 说明 |
| --- | --- |
| inherit_lock | GraphPatch 必须使用原版本 |
| compatible_minor_only | 只允许兼容 minor 版本 |
| explicit_override | 可突破锁，但必须 HITL + Evidence + Replay Isolation |
| force_restart | 不允许 patch，必须新建 HarnessRun |

默认策略：low / medium 风险使用 `compatible_minor_only`；high / critical 风险使用 `inherit_lock`。

## 25.11 多 Region 写入边界

v4.1 不承诺多主 truth 写入。CAS、Lease、Fencing、Budget Ledger 和 SideEffect Commit 只在 partition leader 内有效：

```text
single-leader per partition
follower reads
async replication
controlled failover
```

硬规则：

- Follower region 不接受 truth writes。
- Failover 后生成新的 fencing epoch。
- 旧 leader 恢复后必须作为 follower 加入。
- CRDT 仅允许用于非关键、非财务、非副作用的统计型 aggregate。

---

# 26. 存储架构

> 先定义**存储抽象层**，再给出**渐进式演进路径**。

## 26.1 Repository 抽象层

所有上层代码通过 Repository interface 访问存储，不直接操作数据库。

这一层的意义：

- 上层不关心底层是 SQLite / PostgreSQL / 其他
- 可以单元测试时使用 in-memory 实现
- 可以渐进式从 SQLite 迁移到 PostgreSQL

## 26.2 存储演进路径

| 阶段          | 存储引擎              | 适用场景         | 切换方式            |
| ------------- | --------------------- | ---------------- | ------------------- |
| E1 开发/原型  | SQLite (WAL mode)     | 单节点，10 并发  | 默认                |
| E2 小规模生产 | SQLite + Redis cache  | 单节点，50 并发  | 配置切换            |
| E3 中规模生产 | PostgreSQL            | 多节点，500 并发 | Repository 实现替换 |
| E4 大规模生产 | PostgreSQL + 分表归档 | 集群，5000+ 并发 | Schema 演进         |

**切换原则**：Repository interface 不变，只替换实现。先迁移读多写少的表（projection, audit），后迁移核心写路径（truth, event）。

## 26.3 核心表设计（逻辑模型）

> 当前仓内通过 `src/platform/state-evidence/truth/schema-inventory-service.ts` 维护 authoritative table inventory。文档保留两种互补视图：一套服务于迁移执行，一套服务于架构沟通。

**执行/迁移视图（4 类）**：

- `core_truth`：55 表
- `runtime_extension`：18 表
- `governance_extension`：9 表
- `reliability_extension`：4 表

**架构/认知视图（7 Group）**：

### Group 1: Workflow & Execution（21 表）

任务、执行、租约、事件、会话、worker 与 workflow 主链。
代表表：tasks · executions · execution_* · workflow_* · sessions · session_events · worker_snapshots · outbox

### Group 2: Decision & Policy（12 表）

审批、策略、配额、治理门禁与操作决策。
代表表：approvals · action_proposals · entitlement_decisions · governance_gate_events · quota_counters · skill_execution_policies

### Group 3: Knowledge & Artifact（13 表）

artifact、memory、experience cache、pack/prompt 资源、marketplace listing 与感知资料。
代表表：artifacts · memories · experience_cache · pack_* · prompt_* · marketplace_listings · perception_sources

### Group 4: Ops & Governance（10 表）

DLQ、死信、实例快照、远程日志、密钥租约与企业治理报表。
代表表：dead_letters · dlq_records · event_dead_letters · secret_leases · remote_log_entries · enterprise_governance_reports

### Group 5: AI Operations（9 表）

评测、成本、usage 与分析事实。
代表表：eval_* · cost_* · usage_events · analytics_facts · pmf_validation_reports

### Group 6: Domain & Organization（12 表）

租户、组织、命名空间、账单与部署绑定。
代表表：tenants · tenant_* · organizations · workspaces · data_namespaces · deployment_bindings · billing_*

### Group 7: Maturity & Lifecycle（9 表）

发布、归档、演化、环境推进、数据迁移与 replay 数据集。
代表表：release_* · archive_bundles · evolution_logs · environment_promotion_history · replay_datasets

**总计**：86 表。实现时按 `category` 渐进迁移、按 `documentedGroup` 做架构沟通与评审，不要求一次性全部到位。

## 26.4 v4.1 Runtime 表落点

v4.1 收敛后的 Harness / OAPEFLIR 运行对象必须在存储层有明确落点。实现时优先复用现有 truth / event / execution 表；确需物化为新表时，必须同步更新 `SchemaInventoryService`、migration 版本、§26.3 表数量和回滚脚本。

| 运行实体 | 推荐表 / Repository | 存储策略 | 所属 Group | 迁移阶段 |
| --- | --- | --- | --- | --- |
| HarnessRun | `harness_run` | 唯一权威 run truth；OAPEFLIR 只生成 trace projection | Group 1 | E1 |
| NodeRun | `oapeflir_node_runs` 或 `execution_steps` 扩展 | NodeRun 作为最小执行 truth；旧 step projection 由 adapter 派生 | Group 1 | E1/E2 |
| AttemptLineage | `oapeflir_attempts` | append-only，关联 nodeRunId / parentAttemptId | Group 1 | E1/E2 |
| PlanGraphBundle | `oapeflir_plan_graphs` + artifact ref | graph JSON 存 artifact，truth 表存 id/version/hash/status | Group 1 / Group 3 | E1/E2 |
| GraphPatch | `oapeflir_graph_patches` | append-only，baseGraphVersion + operations + auditRef | Group 1 | E1/E2 |
| BudgetLedger | `oapeflir_budget_ledgers` + `oapeflir_budget_reservations` | reservation / consume / release 同事务写 event | Group 2 / Group 5 | E2 |
| RunVersionLock | `run_version_lock` | admitted 时冻结，后续只读 | Group 7 | E1 |
| SideEffectRecord | `side_effects` 扩展或 `oapeflir_side_effects` | proposed→confirmed 状态机，外部幂等键唯一索引 | Group 1 / Group 4 | E2 |
| ReconciliationRecord | `oapeflir_reconciliations` | ambiguous 后创建，对账结果 append-only | Group 4 | E2 |
| DecisionInputBundle | artifact ref + `oapeflir_decisions` | bundle 大对象入 artifact，裁决摘要入 truth | Group 2 / Group 3 | E2 |
| HumanResponsibilityRecord | `hitl_responsibility_records` | 人工操作责任边界，关联 audit log | Group 2 / Group 4 | E2 |
| LearningCandidate | `learning_candidates` 扩展或 `oapeflir_learning_candidates` | quarantine / approved / rejected / released 状态机 | Group 5 / Group 7 | E3 |
| Event Registry Metadata | `event_registry_entries` | 事件类型、schemaVersion、replayBehavior 注册表 | Group 4 | E1/E2 |

**迁移约束**：

- v4.1 第一批 migration 必须覆盖 HarnessRun、NodeRun、PlanGraphBundle、Event Registry Metadata、RunVersionLock。
- BudgetLedger、SideEffectRecord、ReconciliationRecord 必须在任何真实外部写操作上线前完成。
- 旧 workflow / execution 表进入兼容期后只允许 adapter 读写，不得再新增绕过 NodeRun 的执行路径。
- 若新表导致 86 表统计变化，必须在同一 PR 更新 §26.3、版本历史和 schema inventory golden 测试。

## 26.5 MVP 表集裁剪

v4.1 MVP 不以 86 表全量模型为交付目标，而以 18 张表完成最小生产闭环：

```text
tenant
principal
task
harness_run
harness_step
plan_graph
node_run
event_log
event_outbox
artifact_record
tool_definition
tool_call
side_effect
budget_ledger
decision_record
approval_request
checkpoint
idempotency_record
```

Hardening Ring 追加 14 张表：

```text
execution_lease
worker
dlq_record
incident
recovery_job
reconciliation_job
compensation_record
audit_record
projection_rebuild_job
config_version
prompt_version
model_provider
usage_record
health_snapshot
```

其余表进入 Enterprise Ring。任何新表必须标注所属 ring、owner、migration、rollback 和 golden test。

---

# 27. 性能架构与 SLO

## 27.1 OAPEFLIR 阶段性能目标

| 阶段     | P99 目标     | 说明                                |
| -------- | ------------ | ----------------------------------- |
| Observe  | < 50ms       | 信号采集与聚合（不含外部调用）      |
| Assess   | < 30ms       | 评估决策（不含 LLM 调用）           |
| Plan     | < 100ms      | DAG 构建与策略选择（不含 LLM 调用） |
| Execute  | 视 tool 而定 | 受外部依赖约束，不设统一目标        |
| Feedback | < 10ms       | 信号预处理与去重                    |
| Learn    | < 500ms      | 模式检测（异步，不阻塞主链）        |
| Improve  | < 1s         | Candidate 生成（异步）              |

## 27.2 Runtime SLO

| 指标                 | P99 目标 | 降级阈值                 |
| -------------------- | -------- | ------------------------ |
| Dispatch latency     | < 200ms  | > 1s 触发告警            |
| Lease acquisition    | < 50ms   | > 200ms 触发告警         |
| Heartbeat round-trip | < 100ms  | > 500ms 标记 unhealthy   |
| Recovery detection   | < 30s    | > 60s 触发 SEV3 incident |
| Projection lag       | < 5s     | > 30s 触发 rebuild       |
| Checkpoint write     | < 20ms   | > 100ms 触发告警         |
| Event append         | < 10ms   | > 50ms 触发告警          |

## 27.3 可用性目标

| 组件            | 可用性 | 降级策略                  |
| --------------- | ------ | ------------------------- |
| API Gateway     | 99.95% | 静态错误页                |
| Control Plane   | 99.9%  | Read-only degradation     |
| Execution Plane | 99.9%  | Worker pool failover      |
| State Plane     | 99.95% | WAL + checkpoint recovery；99.99% 需自动 failover + quorum + warm standby |
| Observability   | 99.5%  | 可丢指标，不可丢审计      |

## 27.4 容量规划

| 维度          | S1 单体    | S2 多进程   | S3 分布式 |
| ------------- | ---------- | ----------- | --------- |
| 并发 workflow | 10         | 50          | 500       |
| 活跃 worker   | 5          | 20          | 100       |
| Event/s       | 100        | 500         | 5,000     |
| 存储          | 1GB SQLite | 10GB SQLite | 100GB+ PG |

## 27.5 性能测试要求

- 每次重大变更前必须运行 load test
- Load test 场景：normal load / peak load / degradation / recovery
- 结果记录为 evidence，与 rollout 关联

## 27.6 Error Budget 策略

> 定义 SLO 违反时的组织响应。

**Error Budget 定义**：可用性 SLO 99.9% → 月度 Error Budget = 43.2 分钟不可用时间。

| Budget 消耗 | 状态 | 响应                                      |
| ----------- | ---- | ----------------------------------------- |
| 0-50%       | 正常 | 正常发布节奏                              |
| 50-80%      | 预警 | 减缓非紧急变更发布                        |
| 80-100%     | 冻结 | 仅允许修复性发布，暂停 feature rollout    |
| > 100%      | 超额 | 全面冻结 + 专项可靠性修复 + 管理层 review |

**Burn Rate 告警**：

- 1h burn rate > 14.4x（1h 内消耗 2% budget）→ SEV2 告警
- 6h burn rate > 6x（6h 内消耗 5% budget）→ SEV3 告警
- 采用 multi-window 策略减少误报

## 27.7 LLM 延迟拆解

LLM 调用通常主导端到端延迟。必须单独建模：

| 延迟组成                        | P99 目标 | 说明                                   |
| ------------------------------- | -------- | -------------------------------------- |
| Prompt 渲染                     | < 5ms    | 模板填充 + 变量注入                    |
| ModelGateway 路由               | < 10ms   | Provider 选择 + 预算检查               |
| LLM TTFT（Time to First Token） | < 2s     | Provider SLA，不可控                   |
| LLM 完整生成                    | < 30s    | 依赖 output length，设 max_tokens 限制 |
| Response 解析 + 校验            | < 20ms   | JSON parse + Zod 校验                  |
| 总 LLM 调用                     | < 35s    | 超过则 timeout                         |

**LLM 延迟不计入平台自身 SLO**，但需要独立监控和告警。当 LLM P99 延迟 > 基线 200% 时，触发 ModelGateway 降级策略（见 §15.4）。

---

# 28. Event Registry / Projection / Incident / DLQ 模型

## 28.1 Event Registry 设计原则

Event Registry 是平台事件与 OAPEFLIR 语义事件的类型、payload schema、replay 行为和 projection 消费规则注册表。所有事件必须可校验、可回放、可去重、可追溯。

硬规则：

- 事件名采用 `namespace.object.action`，例如 `oapeflir.node.succeeded`。
- 每个事件必须声明 schemaVersion、aggregateId、runId、sequence、traceId。
- run 内 sequence 单调递增；consumer 必须基于 eventId 去重。
- replayBehavior 必须显式声明：`apply_to_projection`、`skip_side_effect`、`simulate_only`、`manual_only`。
- 事件 append 与 truth update 同事务；outbox 投递失败进入 DLQ，不影响 truth 一致性。

## 28.2 Event Registry 分层与兼容策略

v4.1 后 Event Registry 分为三层：`EventEnvelope` 是统一事件信封，`platform.*` 保留平台级事实事件，`oapeflir.*` 只承载 OAPEFLIR 语义投影事件。所有层共享 eventId、traceId、replayBehavior、schemaVersion 和 projection 订阅模型，但 truth projection 的权威输入只能是 platform facts。

| 层级 | 事件范围 | 用途 |
| --- | --- | --- |
| EventEnvelope | eventId、eventType、aggregateId、runId、sequence、traceId、schemaVersion、replayBehavior | 所有事件的统一信封与校验入口 |
| PlatformEvent (`platform.*`) | harness_run、node_run、tool_call、side_effect、budget、approval_flow、rollout、incident、dlq、cost、circuit_breaker、config | truth projection、incident、dashboard、billing、ops 链路的事实来源 |
| OapeflirProjectionEvent (`oapeflir.*`) | stage、graph、attempt、decision、hitl、memory、eval、learning、semantic_view | OAPEFLIR 阶段解释、审计视图、语义投影；不得作为 truth source |

**兼容映射**：

| legacy / platform 事件 | v4.1 事实事件 | OAPEFLIR 投影 | 处理方式 |
| --- | --- | --- | --- |
| workflow_run.created / failed / completed | platform.harness_run.created / failed / completed | oapeflir.run.created / failed / completed | truth projection 消费 platform.harness_run；OAPEFLIR run 事件仅作生命周期解释 |
| step_run.* / execution.* | platform.node_run.* | oapeflir.node.* | 新实现以 NodeRun platform fact 为 truth；旧 step projection 由 adapter 派生 |
| step_attempt.* | platform.node_attempt.* | oapeflir.attempt.* | retry / redrive 统一转为 AttemptLineage，OAPEFLIR 只解释因果链 |
| tool_call.succeeded / failed | platform.tool_call.* | oapeflir.node.* / oapeflir.tool_output.* | 工具调用事实保留 platform 事件，节点语义投影由 adapter 派生 |
| side_effect.proposed / committed | platform.side_effect.* | oapeflir.side_effect.* | committed 后仍需 confirmed / reconciliation 才能作为成功事实 |
| decision.requested / approved | platform.decision.* / platform.approval_flow.* | oapeflir.decision.* / oapeflir.hitl.* | 自动裁决与人工责任记录拆分 |
| rollout.* / eval.* | platform.rollout.* / platform.eval.* | oapeflir.eval.* | 发布治理保留 platform rollout，评测门禁可派生 OAPEFLIR eval 投影 |
| cost.* | platform.cost.* / platform.budget.* | oapeflir.budget.* | 财务账单与运行预算事实保留 platform 事件，OAPEFLIR 只投影预算阶段 |
| circuit_breaker.* / config.changed | platform.* | 无或 oapeflir.stage.* | 不迁入 OAPEFLIR truth，仅通过 ControlDirective 影响 HarnessRun |

迁移硬规则：truth projection 必须优先订阅 `platform.harness_run.*`、`platform.node_run.*`、`platform.side_effect.*`、`platform.budget.*` 等事实事件；`oapeflir.*` 只能用于阶段解释、审计视图和语义投影。旧 projection 在迁移期通过 adapter 从 platform facts 派生 legacy 事件；同一事实不得被 platform 与 oapeflir 双重计数。

## 28.3 OapeflirEvent 标准结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| eventId | string | 全局唯一事件 ID |
| eventType | OapeflirEventType | 注册表事件类型 |
| schemaVersion | number | payload schema 版本 |
| runId | string | 关联 HarnessRun |
| nodeRunId | string? | 关联 NodeRun |
| aggregateId | string | truth 聚合 ID |
| sequence | number | run 内单调序号 |
| occurredAt | ISO8601 | 发生时间 |
| principal | Principal | 触发主体 |
| traceId | string | 分布式追踪 ID |
| payload | object | 事件载荷 |
| replayBehavior | enum | 回放行为 |
| evidenceRefs | string[] | 关联证据 |

## 28.4 OapeflirEventType 注册表

| 命名空间 | 代表事件 | 说明 |
| --- | --- | --- |
| oapeflir.run | created / admitted / paused / resumed / completed / failed / aborted | HarnessRun 生命周期投影事件，不代表独立 OAPEFLIR 运行实体 |
| oapeflir.stage | observing / assessed / planned / feedback_recorded / learned / improved / released | 八阶段推进 |
| oapeflir.graph | normalized / validated / validation_failed / risk_propagated / patch_applied | PlanGraph 生命周期 |
| oapeflir.node | ready / leased / started / succeeded / failed / awaiting_hitl / reconciling / compensated | NodeRun 状态 |
| oapeflir.attempt | started / retry_scheduled / redriven / exhausted | AttemptLineage |
| oapeflir.budget | reserved / consumed / released / exhausted | Budget Ledger |
| oapeflir.side_effect | proposed / approved / committed / ambiguous / confirmed / compensation_required | 副作用治理 |
| oapeflir.reconciliation | started / matched / diverged / unknown / expired | 对账状态 |
| oapeflir.decision | input_frozen / accepted / retry_requested / replan_requested / escalated / aborted | Decision Engine |
| oapeflir.llm | response_recorded / schema_validated / guardrail_blocked | 已记录的 LLM 输出与校验结果 |
| oapeflir.tool_output | recorded / tainted / rejected | 已记录的工具输出与污染传播 |
| oapeflir.scheduler | decision_recorded / lease_assigned / ready_set_evaluated | 可回放的调度决策 |
| oapeflir.hitl | lock_acquired / requested / approved / rejected / overridden / takeover / timed_out | HITL Runtime |
| oapeflir.memory | write_requested / approved / rejected / promoted | Memory Governance |
| oapeflir.eval | gate_started / gate_passed / gate_failed / regression_detected | EvaluationGate |
| oapeflir.learning | candidate_created / quarantined / approved / rejected / released | LearningCandidate |

## 28.5 Event Replay Semantics

Replay 分三类：

| 类型 | 目的 | 副作用行为 |
| --- | --- | --- |
| projection_replay | 重建查询模型 | 只 apply projection，不调用外部系统 |
| trace_replay | 审计、事故复盘、调试、投影重建 | 重放已记录 events / LLM output / Tool output / Scheduler decisions，不发起新调用 |
| re_execution_replay | 回归测试、Prompt 对比、工具迁移仿真 | 可重新调用 LLM / Tool，必须标记 nondeterministic，不写 production truth |

默认审计能力是 Trace Replay，不假设 LLM 可确定性重放。Re-execution Replay 的输出只能进入隔离 evidence namespace，不得覆盖原 HarnessRun 证据。Replay 永远不得真实发送邮件、付款、部署、写外部系统或修改生产环境。需要验证外部状态时只能创建 ReconciliationRecord 或人工 review 任务。

## 28.6 Projection（9 个）

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection

Projection 必须 idempotent · replay-safe · event_id dedupe · 可 rebuild · 不反写真相。

## 28.7 Incident 约束

incident 必须链接到：affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record。v4.1 runtime incident 还必须关联 HarnessRun runId、nodeRunId、attemptId、eventId、sideEffectId 或 reconciliationId（如适用）。

## 28.8 DLQ 约束

DLQ 必须有：category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status。DLQ 不是垃圾桶，必须支持 inspect、redrive、discard with approval 和 incident linking。

---

# 29. Knowledge / Memory / Artifact / Learning 边界

## 29.1 Knowledge

共享事实、规则、流程、稳定模式。

**层级**：Personal → Team → Company

**Trust Level**：private_unverified → team_reviewed → official → authoritative

**Promotion**：personal → team → company。保留 lineage / reviewer decision / trust change / audit event。

## 29.2 Memory

运行态短中期上下文。会衰减 · 会压缩 · 会被覆盖 · 用于上下文装配。

Memory 分层明确为 6 层：working → session → episodic → semantic → procedural → meta。每层有独立的 TTL 和淘汰策略。

## 29.3 Artifact

执行产物与大对象，不承担控制真相职责。通过引用（artifact_ref）关联到 workflow_run / step，不内联到 event。

## 29.4 Learning

从反馈中提炼候选模式。Learn 不直接改变线上行为。LearningObject 必须经过 Improve → Validation → Approval → Rollout 才能生效。

---

# 30. 业务接入约束与 Business Pack 模型

> Business Pack 必须关联 DomainDescriptor(§37)，Pack 的风控、知识检索、评估策略由领域描述符驱动。

## 30.1 业务包不能绕过的平台能力

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 每个 Business Pack 必须声明

> **约束**：`domain_id` 为必填字段，必须指向已注册且状态为 Active 的 DomainDescriptor。Pack 注册时平台自动校验 `domain_id` 有效性，并将 DomainRiskProfile 的风险覆写应用到 Pack 的 risk_matrix 之上。

## 30.3 高风险业务默认 supervised

operations · growth write actions · production release · finance-like actions → 第一阶段默认 supervised，不允许 full_auto。

## 30.4 Pack 生命周期

> 定义 Pack 从开发到废弃的完整流程。

| 阶段 | 说明                                 | 要求                     | 产出                           |
| ---- | ------------------------------------ | ------------------------ | ------------------------------ |
| 开发 | 使用 Pack SDK 本地开发               | 遵循 Manifest schema     | 代码 + Manifest + eval dataset |
| 测试 | 本地 mock 测试 + staging 集成测试    | 覆盖率 ≥ 80% + eval 通过 | TestReport                     |
| 认证 | 安全审查 + 风险评估 + 平台兼容性检查 | 通过 Pack 检查清单       | CertificationRecord            |
| 发布 | 注册到 Pack Registry + rollout       | semver 版本化            | RolloutRecord                  |
| 运行 | 受平台治理约束执行                   | 持续质量监控             | metrics + incidents            |
| 废弃 | 标记 deprecated + 迁移指引           | 至少维护 6 个月          | DeprecationNotice              |

## 30.5 Pack API 兼容性契约

- Pack Manifest schema 遵循 semver：minor 版本只新增字段，major 版本允许破坏性变更
- 平台升级时必须运行 Pack 兼容性测试套件
- 破坏性变更提前 2 个 minor 版本发出 deprecation warning
- 提供 `agent-platform pack migrate` 命令辅助 Pack 升级

## 30.6 Plugin 治理

| 治理维度 | 策略                                      |
| -------- | ----------------------------------------- |
| 版本管理 | semver + Plugin Registry                  |
| 依赖管理 | 声明式依赖 + 冲突检测                     |
| 安全认证 | 自动安全扫描 + 人工审查（高权限 plugin）  |
| 废弃策略 | deprecated 标记 → 3 个月迁移期 → archived |
| 兼容性   | 每个 plugin 声明 min_platform_version     |

---

# 31. 容灾与高可用架构

> 定义从单节点到多 AZ 的高可用策略。

## 31.1 单点故障消除

| 组件         | 单点风险 | 消除策略                                  |
| ------------ | -------- | ----------------------------------------- |
| API Gateway  | 进程崩溃 | 多实例 + 负载均衡                         |
| Dispatcher   | 调度中断 | Leader election（lease-based）            |
| Worker       | 执行中断 | Lease 超时 → 自动 reclaim                 |
| Event Poller | 事件堆积 | Lease-based 单实例 + 健康检查             |
| Database     | 数据丢失 | WAL + 定时备份 / PG streaming replication |

## 31.2 高可用分级

| 级别      | 架构                                 | RTO     | RPO           |
| --------- | ------------------------------------ | ------- | ------------- |
| HA-1 基础 | 单节点 + 定时备份                    | < 1h    | < 15min       |
| HA-2 标准 | 双节点 active-passive + WAL shipping | < 10min | < 1min        |
| HA-3 企业 | 多 AZ active-passive / 单 leader + 同步复制 | < 1min  | 0（同步复制） |

## 31.3 备份与恢复

- **数据备份**：SQLite 阶段使用 `.backup()` API，PG 阶段使用 pg_basebackup
- **事件回放**：从 event_log 重建所有 projection 和 artifact catalog
- **配置备份**：config_version 表自带历史，可任意回退
- **灾难恢复演练**：每季度至少一次，记录 RTO/RPO 实测值

## 31.4 数据完整性保护

- 所有写操作通过 CAS + Lease + Fencing 保护
- Event log 使用 append-only 模式，不允许修改历史事件
- Checkpoint 使用 WAL 保护，进程崩溃后可恢复
- Truth table 与 event log 在同一事务中更新

---

# 32. 部署架构

> 采用**单体优先、渐进拆分**策略。

## 32.1 部署演进

### Phase D1：模块化单体

```text
┌─────────────────────────────────────────┐
│            Agent Platform (单进程)        │
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

适用：开发、测试、小规模生产（≤10 并发）。

### Phase D2：Worker 分离

```text
┌─────────────────────┐     ┌──────────────────┐
│   Main Process       │     │  Worker Process   │
│   P1 + P2 + P3 + P5 │────→│  P4 Execution     │
│   + X1               │     │  + tool executors  │
└─────────────────────┘     └──────────────────┘
        │
   [SQLite / PG]  [Redis]
```

适用：中规模生产（≤50 并发），worker 可水平扩展。

### Phase D3：平面分离

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

适用：大规模生产（≤500 并发），各平面独立扩展。

## 32.2 环境划分

| 环境     | 用途           | 部署形态           | 数据隔离                |
| -------- | -------------- | ------------------ | ----------------------- |
| dev      | 开发调试       | 本地进程 /Docker   | 无隔离，共享开发 DB     |
| test     | 单元/集成测试  | CI 环境，单节点    | 测试租户数据隔离        |
| staging  | 预发布验证     | K8s 单集群         | 按 tenant 分区          |
| pre-prod | 正式发布前灰度 | K8s 多集群         | 生产级隔离              |
| prod     | 正式生产环境   | 多 Region K8s 集群 | 强租户隔离 + 跨 AZ 容灾 |

**环境Promotion策略**：

```
dev → test → staging → pre-prod → prod
```

- 代码合并到 main 后自动部署到 dev
- PR 通过后部署到 test
- Release tag 触发 staging 部署
- 预发布验证后手动 promote 到 pre-prod，再确认 prod

## 32.3 资源池隔离

Worker Pool 实现多层级隔离，保障不同风险等级和租户的业务互不影响：

| Pool 名称                 | 用途                                   | 隔离级别 | 资源配额         |
| ------------------------- | -------------------------------------- | -------- | ---------------- |
| read-only worker pool     | 仅读操作任务（数据查询、报告生成）     | 低风险   | 共享但限流       |
| write-enabled worker pool | 写操作任务（状态变更、数据修改）       | 中风险   | 独立资源池       |
| high-risk isolated pool   | 高风险操作（删除、批量修改、外部调用） | 高风险   | 独立集群+限流    |
| browser worker pool       | 浏览器自动化任务（Web 抓取、UI 测试）  | 独立     | 独立 worker 进程 |
| plugin isolated pool      | 第三方插件执行                         | 最强隔离 | 独立 Pod/Sandbox |

**隔离原则**：

- 不同 pool 之间**网络隔离**，跨池通信需通过 API Gateway
- 高风险 tenant 可申请**专属 worker pool**，独占物理资源
- Pool 间调度通过**优先级队列**管理，防止低优先级饿死
- 所有 pool 均支持**水平扩展**，基于 queue depth 自动 scale

---

# Part II — AI 运营层（§15-§23）

---

# 15. LLM Provider 抽象与故障切换架构

> 将 LLM 视为平台最关键的外部依赖，定义 provider 抽象、路由策略和不可用时的降级模式。

## 15.1 设计原则

- 平台不绑定任何单一 LLM provider
- 所有 LLM 调用通过统一的 ModelGateway 发出，上层不直接调用 provider SDK
- ModelGateway 是 X1 Fabric 的一部分，横切 P3 Orchestration 和 P4 Execution
- LLM 调用视为**高风险外部依赖**，必须有 timeout、circuit breaker、fallback、cost tracking

## 15.2 ModelGateway 接口

ModelGateway 是所有 LLM 调用的唯一出口，上层服务禁止直接调用 provider SDK。

| 方法         | 参数                                                 | 返回值                              | 说明                    |
| ------------ | ---------------------------------------------------- | ----------------------------------- | ----------------------- |
| `chat()`     | modelId, messages[], temperature, maxTokens, timeout | ModelResponse (choices + usage)     | 多轮对话，最常用入口    |
| `complete()` | modelId, prompt, temperature, maxTokens, timeout     | ModelResponse (text + usage)        | 单次补全，适合生成场景  |
| `embed()`    | modelId, input (string \| string[]), timeout         | EmbeddingResponse (vectors + usage) | 向量化，用于检索/相似度 |

ModelResponse 统一包含：`requestId`、`model`、`choices`、`usage { promptTokens, completionTokens, totalTokens, estimatedCost }` 和 `latencyMs`。所有调用自动附加 traceId、tenantId、costTag，并纳入 §18 成本计量。

## 15.3 Provider 注册与路由

**路由策略**：

| 策略              | 适用场景          | 说明                             |
| ----------------- | ----------------- | -------------------------------- |
| priority          | 默认              | 按 priority 排序，首选最高优先级 |
| cost_optimized    | 批量/低优先级任务 | 选择单价最低的可用 provider      |
| latency_optimized | 实时交互          | 选择 P99 延迟最低的 provider     |
| data_residency    | 合规要求          | 仅选择满足数据驻留的 provider    |
| capability_match  | 特殊能力          | 匹配 required_capabilities       |

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
Degradation Mode（见 §15.5）
```

**切换规则**：

- 单次请求 timeout（默认 30s）→ 自动切换到下一 provider 重试
- 连续失败 > 5 次（60s 窗口）→ 触发 circuit breaker，provider 标记为 unhealthy
- 所有 provider unhealthy → 进入 LLM Degradation Mode
- provider 恢复后通过 half-open 探测自动回升

## 15.5 LLM 不可用降级模式

当所有 LLM provider 不可用时，平台必须有明确的降级策略，而非简单报错：

| 降级级别 | 触发条件                          | 平台行为                                                  |
| -------- | --------------------------------- | --------------------------------------------------------- |
| D0 正常  | 至少一个 provider healthy         | 正常路由                                                  |
| D1 受限  | primary down, secondary available | 自动切换 + 告警 + 限制新 workflow 启动速率                |
| D2 缓存  | 所有 provider unhealthy, 缓存可用 | 对相似请求返回缓存结果（仅 read-only 场景）               |
| D3 静态  | 缓存不可用                        | 使用预置的 static fallback plan（仅低风险任务）           |
| D4 暂停  | 所有降级不可用                    | 暂停所有新 workflow，保护在途 workflow checkpoint，转人工 |

**缓存设计**：

- 基于 prompt_ref + 参数 hash 的语义缓存
- TTL 按 data_classification 分级：public=1h, internal=15min, confidential=不缓存
- 缓存命中必须标记 `cached: true`，不计入模型质量评估

## 15.6 流式响应与错误处理

`ModelGateway.stream()` 的额外约束：

| 关注点         | 处理策略                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 流中断         | 已接收 token 缓存为 partial response；若 partial 可用（≥ 80% 预期长度）则标记 `partial: true` 使用；否则切换 provider 重试                   |
| Token 超限预检 | 发送前根据 `ModelRequest.messages` 估算 input token 数，若 > provider 的 `context_window - max_tokens` 则拒绝并返回 `TOKEN_LIMIT_EXCEEDED`   |
| 响应格式校验   | stream 完成后对完整输出进行 Zod schema 校验；校验失败触发一次 retry（附加 format reminder）；二次失败记录为 `llm.response.validation_failed` |
| 超时           | 流式首 token 超时（TTFT > 10s）触发 provider 切换；总时长超时按 `ModelConstraints.max_latency_ms` 执行                                       |
| 背压           | 消费者处理速度 < 生产速度时，暂停流读取（backpressure），不丢弃 token                                                                        |

## 15.7 可观测性

| 指标                     | 类型      | 说明                     |
| ------------------------ | --------- | ------------------------ |
| `llm.request.total`      | counter   | 按 provider/model/tenant |
| `llm.request.latency_ms` | histogram | 按 provider/model        |
| `llm.request.error_rate` | gauge     | 按 provider/error_type   |
| `llm.token.usage`        | counter   | 按 provider/model/tenant |
| `llm.cost.total`         | counter   | 按 provider/tenant       |
| `llm.cache.hit_rate`     | gauge     | 缓存命中率               |
| `llm.fallback.triggered` | counter   | 降级触发次数             |

---

# 16. Prompt 管理与版本化架构

> Prompt 是 Agent 的"源代码"，作为一级架构关注点，定义存储、版本化、灰度发布和回滚机制。

## 16.1 设计原则

- Prompt 不内联在代码中，而是作为**版本化资源**独立管理
- 每个 Prompt 有完整的生命周期：draft → review → staging → canary → stable → deprecated
- Prompt 变更等同于代码变更，必须经过质量门禁（见 §17）
- Prompt 与 model 的组合构成 Agent 行为的核心，两者变更需协同管理

## 16.2 Prompt 数据模型

每个 Prompt 以 PromptTemplate 为存储单元，支持多版本管理：

| 字段        | 类型                                                          | 说明                               |
| ----------- | ------------------------------------------------------------- | ---------------------------------- |
| `promptId`  | string (ULID)                                                 | 全局唯一标识                       |
| `version`   | number                                                        | 递增版本号，每次变更 +1            |
| `role`      | enum: planner / generator / evaluator / system                | 标识在 Harness 中的用途            |
| `content`   | string                                                        | 模板正文，使用 `{{variable}}` 占位 |
| `variables` | VariableDef[]                                                 | 变量名、类型、是否必填、默认值     |
| `metadata`  | object                                                        | 作者、描述、标签、预期 token 范围  |
| `domainId`  | string                                                        | 所属业务域，控制可见性与权限       |
| `status`    | enum: draft / review / staging / canary / stable / deprecated | 生命周期状态                       |

同一 `promptId` 可存在多个 version，但同一时刻仅一个 version 处于 `stable` 状态。

## 16.3 发布与灰度

**发布流程**：

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (质量不达标)
                                               rolled_back
```

- staging 阶段必须通过 eval gate（见 §17）
- canary 阶段与 stable 版本并行运行，按比例分流
- canary 期间持续对比新旧版本的质量指标
- 任何时刻可手动或自动 rollback 到上一个 stable 版本

## 16.4 Prompt 组合管理

一个 OAPEFLIR 循环涉及多个阶段的 Prompt，它们必须作为**原子组合**管理：

**约束**：同一 workflow run 内所有阶段使用同一 PromptBundle 版本，中途不切换。

## 16.5 Prompt 安全与注入防御

### 16.5.1 Prompt Injection 防御架构

```text
用户输入 / 外部数据
    │
    ▼
┌──────────────────┐
│ Input Sanitizer  │  正则 + 黑名单 + Unicode 规范化
├──────────────────┤
│ Injection        │  基于分类器检测 injection pattern
│ Detector (ML)    │  (system/user boundary 混淆, 指令覆盖, 角色伪装)
├──────────────────┤
│ Prompt Assembler │  system/user/assistant 段严格分离
│                  │  用户内容仅注入 user 段，绝不进入 system 段
├──────────────────┤
│ Output Validator │  检测 LLM 输出中的 exfiltration 尝试
│                  │  (URL 注入、Markdown link 泄露、隐蔽指令回传)
└──────────────────┘
```

### 16.5.2 防御策略

| 层次   | 策略                 | 说明                                                                           |
| ------ | -------------------- | ------------------------------------------------------------------------------ |
| 输入层 | Variable Escaping    | 所有用户输入变量注入前做 XML/Markdown 转义，消除控制字符                       |
| 输入层 | Boundary Markers     | system 和 user 段使用 LLM provider 原生 role 分隔，不依赖文本标记              |
| 检测层 | Injection Classifier | 轻量级分类模型对每次用户输入进行 injection 概率评分，> 0.7 拒绝                |
| 检测层 | Canary Token         | 在 system prompt 中嵌入 canary token，若 LLM 输出包含该 token 则判定 injection |
| 输出层 | Output Sanitizer     | LLM 输出经过 URL/link 过滤、PII 检测、指令模式检测                             |
| 审计层 | Full Prompt Logging  | 每次渲染的完整 prompt 保存为 artifact（confidential 级别以上可选关闭）         |

### 16.5.3 基本原则

- Prompt 内容不暴露给终端用户（防信息泄露）
- Prompt 变量注入前必须做 sanitization
- 包含 secret / PII 的变量在 artifact 中做 redaction
- 多轮对话中历史 assistant 消息不可被用户篡改
- 外部工具返回值视为不可信输入，注入前同样经过 sanitization

---

# 17. 模型评估与质量门禁架构

> 无评估能力的 Agent 平台等于"裸奔上线"。定义模型/Prompt 变更的质量门禁框架。

## 17.1 评估层次

| 层次     | 触发时机                | 评估内容                   | 阻断能力      |
| -------- | ----------------------- | -------------------------- | ------------- |
| 离线评估 | Prompt/Model 变更提交时 | 标准 eval dataset 回归测试 | 阻断发布      |
| 灰度评估 | canary 期间             | 新旧版本实时质量对比       | 自动 rollback |
| 在线监控 | 持续运行                | 质量指标漂移检测           | 触发告警/降级 |

## 17.2 Eval Dataset 管理

EvalDataset 是质量门禁（§17.3）的核心输入，按业务域独立维护：

| 字段        | 类型                         | 说明                                         |
| ----------- | ---------------------------- | -------------------------------------------- |
| `datasetId` | string (ULID)                | 全局唯一标识                                 |
| `taskType`  | string                       | 关联的任务类型（如 summarization、routing）  |
| `samples`   | Sample[]                     | 每条包含 input、expectedOutput、evalCriteria |
| `version`   | number                       | 数据集版本，变更后递增                       |
| `domainId`  | string                       | 所属业务域                                   |
| `split`     | enum: train / eval / holdout | 数据集划分，holdout 仅用于最终发布门禁       |

**管理要求**：eval 集不少于 50 条样本；holdout 集仅质量门禁自动调用，禁止在开发/调试阶段使用；数据集变更需经 domain_owner 审批。

## 17.3 质量门禁规则

**内置门禁规则**：

| 规则                 | 条件                | 说明                              |
| -------------------- | ------------------- | --------------------------------- |
| regression_pass_rate | >= 95%              | eval dataset 通过率不低于基线     |
| critical_case_pass   | == 100%             | critical 标记的 case 必须全部通过 |
| latency_regression   | <= 120% of baseline | 延迟不超过基线的 120%             |
| cost_regression      | <= 150% of baseline | 成本不超过基线的 150%             |
| quality_score_delta  | >= -0.05            | 质量分不低于基线 5 个百分点       |

## 17.4 在线质量监控

**漂移检测**：

- 滑动窗口（1h/24h）统计质量分布
- 当 24h 窗口质量均值下降 > 10%，触发 SEV3 告警
- 当 1h 窗口质量均值下降 > 20%，触发自动降级为 supervised mode
- 所有质量信号写入 P5 Evidence Plane，支撑 Learn 阶段的模式提取

## 17.5 LLM-as-Judge

对于无法用规则判断的质量场景（如"回答是否合理"），使用 LLM-as-Judge：

- Judge LLM 与被评估 LLM 必须来自不同 provider（避免 bias）
- Judge 结果缓存（同一 input+output 不重复评估）
- Judge 调用本身有成本预算限制（见 §18）
- Judge 评估结果纳入质量门禁，但只能补充质量判断，不得覆盖确定性失败

**不可覆盖失败**：policy deny · schema validation failure · budget exhausted · security violation · state-machine invalid · replay mismatch · event append failure · side effect ambiguous · secret / PII leakage。任一不可覆盖失败出现时，EvaluationGate 必须 fail closed；LLM-as-Judge 不得通过加权平均、人工不可见阈值或二次评审将其改判为通过。

---

# 18. 成本管理与 Token 计量架构

> LLM 调用成本主导平台 OPEX。定义按 tenant 计量、预算强制和 chargeback 机制。

## 18.1 计量模型

**计量点**：ModelGateway 在每次 LLM 调用完成后同步写入 UsageRecord，作为计费的唯一数据源。

## 18.2 预算层级

| 层级    | 预算主体           | 控制粒度             | 超预算行为                         |
| ------- | ------------------ | -------------------- | ---------------------------------- |
| 平台级  | 整个平台           | 月度总额             | SEV1 告警 + 新 workflow 暂停       |
| 租户级  | 单个 tenant        | 月度配额             | 告警 + 该 tenant workflow 排队降速 |
| Pack 级 | 单个 Business Pack | 单次 workflow 上限   | 该 workflow 降级为 supervised      |
| Step 级 | 单个 step          | 单步 token/cost 上限 | step 中止 + replan                 |

## 18.3 预算强制

```text
ModelRequest
  → estimate cost / tokens / duration
  → atomic reserve
    → 若 used + reserved + estimate > limit → 拒绝请求 / 降级策略
  → 执行 LLM 调用
  → settle actual
  → release unused reservation
```

预算强制必须使用原子预留，避免并发 LLM / Tool / Replan 在检查与消费之间穿透上限。标准流程：

```text
estimate → atomic reserve → execute → settle actual → release unused
```

BudgetReservation 状态机：

```text
reserved → settled
reserved → released
reserved → expired
reserved → cancelled
```

关键字段：reservationId、subjectId、runId、nodeRunId、estimatedCost、estimatedInputTokens、estimatedOutputTokens、expiresAt、status、settledCost、releasedCost、traceId。预留到期由 Sweeper 释放，释放与事件写入必须同事务。

并发预算仲裁必须在 BudgetLedger 内完成，示例 SQL：

```sql
UPDATE budget_ledger
SET reserved = reserved + :estimate
WHERE subject_id = :tenant_id
  AND used + reserved + :estimate <= limit;
```

受影响的硬上限必须拆分为 `max_cost`、`max_model_tokens`、`max_context_tokens`、`max_output_tokens`、`max_steps`、`max_duration_ms`。`max_cost` 不能替代 token 或时延上限。

## 18.4 Chargeback 报表

- 按 tenant / pack / model / provider 维度汇总
- 日报 + 月报自动生成
- 支持导出为 CSV / JSON
- 与 Admin API 集成：`/api/v1/admin/cost-reports`

## 18.5 成本优化策略

| 策略           | 说明                                         | 适用场景               |
| -------------- | -------------------------------------------- | ---------------------- |
| Prompt 缓存    | 语义相似请求复用（见 §15.5）                 | read-only / 低变化场景 |
| Token 预算裁剪 | context 超长时自动压缩 memory/knowledge 输入 | 大上下文任务           |
| Model 降级     | 低风险任务自动选择低成本 model               | background queue       |
| 批量合并       | 多个相似 step 合并为一次 LLM 调用            | 批量分析场景           |

---

# 19. Agent 间委托与协作架构

> 复杂企业任务需要多个 Agent 协作。定义 Agent 间委托协议、上下文传递和授权模型。

## 19.1 委托模型

Agent 间通过标准委托协议进行任务分派，支持三种模式：

| 模式     | 说明                                             |
| -------- | ------------------------------------------------ |
| 同步委托 | 委托方阻塞等待被委托方返回结果，适用于短时子任务 |
| 异步委托 | 委托方提交后继续执行，通过回调或轮询获取结果     |
| 广播委托 | 委托方向多个 Agent 同时发起请求，聚合最优结果    |

委托请求（DelegationRequest）包含：delegator（委托方 ID）、delegate（被委托方 ID）、taskScope（任务范围）、constraints（约束条件）、timeout（超时时限）。委托回执（DelegationReceipt）包含：result（执行结果）、telemetry（遥测数据）、artifacts（产出物列表）。所有委托链必须遵守 §19.2 中的拓扑约束。

## 19.2 委托拓扑约束

- **深度限制**：委托链最大深度 = 3（防止无限递归）
- **与目标分解的交互**：目标分解引擎(§40)递归深度上限 = 5，委托链最大深度 = 3，但两者不得相乘扩张。平台实施**全局调用深度硬上限 = 8**（`call_depth` 字段随 trace 传播），每次 decompose、delegate 或进入子 graph 均 +1；任一局部上限或全局上限触发时，拒绝新委托并触发 escalation。
- **环检测**：同一 pack_id 不可在同一委托链中出现两次
- **隔离**：子 workflow 独立 lease、独立 checkpoint，不与父 workflow 共享状态
- **预算继承**：子 workflow 预算从父 workflow 剩余预算中扣除
- **权限收缩**：子 workflow 权限 ≤ 父 workflow 权限（最小权限原则）

## 19.3 上下文传递安全

- 父 → 子：仅传递 DelegationContext 中声明的引用，不传递原始数据
- 子 → 父：仅通过 DelegationResult 返回，包含 summary + artifact_refs
- 跨 tenant 委托：默认禁止，需 P2 显式授权
- 数据分级向上兼容：子 workflow 产出数据的分级 ≥ 输入数据分级

## 19.4 协作模式

| 模式     | 说明                          | 适用场景          |
| -------- | ----------------------------- | ----------------- |
| 串行委托 | A 委托 B，等 B 完成后继续     | 简单子任务        |
| 并行扇出 | A 同时委托 B1/B2/B3，聚合结果 | 并行分析          |
| 管道     | A → B → C，链式传递           | 多阶段处理        |
| 协商     | A 和 B 交替执行，共享上下文   | 代码 review + fix |

## 19.5 多 Agent 协作协议（Agent Collaboration Protocol）

当平台从单 Agent Runtime 走向多 Agent Runtime 时，必须有一套标准化的协作协议防止权限泄露、预算失控和审计断链。本协议定义消息类型、强制字段和不可违反规则，与 §45 Harness Runtime 和 §19.2 委托拓扑约束协同执行。

### 消息类型

| 消息类型             | 方向           | 语义         | 触发条件                              |
| -------------------- | -------------- | ------------ | ------------------------------------- |
| `task_request`       | parent → child | 发起任务委托 | Planner 分解出子任务                  |
| `task_offer`         | child → parent | 声明可承接   | child 评估能力后回复                  |
| `task_accept`        | parent → child | 确认委托     | parent 选定 child                     |
| `task_reject`        | child → parent | 拒绝委托     | child 能力/预算/权限不足              |
| `partial_result`     | child → parent | 中间结果上报 | child 完成阶段性产出                  |
| `escalation_request` | child → parent | 请求升级     | child 遇到超出自治权限的决策          |
| `completion_report`  | child → parent | 任务完成报告 | child 完成全部工作                    |
| `takeover_notice`    | parent → child | 接管通知     | parent 因超时/异常/人工介入接管子任务 |

### 强制字段

每条协作消息必须携带以下字段，缺失任一字段则消息被拒绝：

| 字段                | 类型         | 来源                      | 用途                                |
| ------------------- | ------------ | ------------------------- | ----------------------------------- |
| `correlation_id`    | UUID         | 首条 task_request 生成    | 关联同一协作会话的所有消息          |
| `parent_run_id`     | HarnessRunId | §45.13 HarnessRun         | 关联父级执行上下文                  |
| `depth`             | uint8        | 从 §19.2 全局调用深度继承 | 防止递归爆炸（≤ call_depth hard cap） |
| `sender_agent_id`   | AgentId      | 发送方                    | 身份标识与审计                      |
| `receiver_agent_id` | AgentId      | 接收方                    | 路由与权限校验                      |
| `domain_id`         | DomainId     | §37 DomainDescriptor      | 域级策略匹配                        |
| `risk_level`        | RiskScore    | 消息负载中最高风险操作    | 触发审批/HITL                       |
| `budget_remaining`  | TokenBudget  | 从父级预算继承            | 防止子 Agent 超支                   |
| `trace_id`          | TraceId      | §12 分布式 Tracing        | 全链路可观测性                      |

### 协作不可违反规则（Collaboration Invariants）

以下规则由 Harness Runtime 在消息收发时强制校验，违反任一条则消息被拒绝并触发 Incident：

| #   | 规则                                                                                  | 校验时机             | 违反后果                 |
| --- | ------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| C1  | 子 Agent 不得扩大权限——child.permissions ⊆ parent.permissions                         | task_accept 时       | 拒绝委托 + 告警          |
| C2  | 子 Agent 不得提升风险模式——child.risk_mode ≤ parent.risk_mode                         | task_accept 时       | 拒绝委托 + 告警          |
| C3  | 子 Agent 不得绕过 parent ConstraintPack——child.constraints ⊇ parent.constraints       | task_request 构造时  | 消息被拒                 |
| C4  | 子 Agent 输出必须可被 parent Evaluator 复核——completion_report 必须包含 evidence 字段 | completion_report 时 | 结果不被采纳             |
| C5  | 任何 takeover 都必须写审计——takeover_notice 触发不可篡改审计记录                      | takeover_notice 时   | 平台强制写入（不可跳过） |
| C6  | budget_remaining 不得超过 parent 剩余预算                                             | task_request 时      | 消息被拒                 |
| C7  | depth 不得超过 call_depth hard cap（§19.2 定义，默认 8）                              | task_request 时      | 消息被拒 + escalation    |

### 与现有架构的关系

- **§19.1-19.4**：本协议将已有委托模型从"约定"升级为"强制协议"，所有委托消息必须遵循本节格式
- **§45 Harness Runtime**：HarnessLoopController 在发起子任务时自动构造符合本协议的 task_request
- **§58.6 HarnessDecision**：子 Agent 的 Evaluator 裁决通过 completion_report 回传，parent Evaluator 可对其进行二次裁决
- **§12 异常事件处理**：协作消息超时/拒绝/违规均映射为 Incident，走统一告警路由

---

# 20. 长时任务与 Workflow 休眠架构

> 企业场景中 workflow 可能持续数小时甚至数天（等审批、等外部系统回调）。定义休眠/唤醒机制。

## 20.1 长时任务分类

| 类型     | 持续时间  | 原因                    | 示例               |
| -------- | --------- | ----------------------- | ------------------ |
| 审批等待 | 分钟→天   | HumanWait executor 阻塞 | 高风险操作审批     |
| 外部回调 | 分钟→小时 | 等第三方系统完成        | CI/CD 构建完成回调 |
| 定时调度 | 确定时间  | 等待特定时间窗口        | 非工作时间执行     |
| 多阶段   | 天→周     | 业务流程多阶段审批      | 发布审批链         |

## 20.2 Workflow 休眠机制

**休眠流程**：

1. step 进入等待状态 → 创建完整 checkpoint
2. 释放 worker lease（worker 不再占用）
3. 创建 HibernationRecord，注册 wake_conditions
4. workflow_run 状态设为 `hibernated`
5. 所有内存上下文持久化到 P5

**唤醒流程**：

1. wake_condition 满足 → WakeEngine 触发
2. 从 checkpoint 恢复 workflow 上下文
3. 重新申请 worker lease
4. 从断点处继续执行

## 20.3 持久定时器

- 定时器持久化到数据库，不依赖进程内存
- TimerPoller（类似 outbox poller）定期扫描到期 timer
- 进程重启后 timer 不丢失
- timer 精度：± 30s（非实时系统，不追求毫秒级）

## 20.4 TTL 与超时保护

- 每个 hibernation 必须有 TTL（默认 7 天，最大 30 天）
- TTL 到期后执行 timeout_action
- 超长 workflow 每 24h 发一次 `workflow.still_hibernated` 健康事件
- 超过 TTL 50% 的 hibernation 触发提醒通知
- **超长审批场景**：监管审批链可能需要数月，通过 `renewal` 机制延续——TTL 到期前 24h 自动请求 domain_owner 确认续期（每次续期最大 30 天），总续期次数上限由 DomainGovernancePolicy(§37.9) 的 `max_hibernation_renewals`（默认 6，即最长 ~210 天）控制，超过上限则强制终止并通知发起人

## 20.5 跨部署安全

- checkpoint 格式向后兼容（版本化 schema）
- 平台升级部署时，hibernated workflow 不受影响
- 若 checkpoint schema 不兼容，workflow 进入 `recovery_needed` 状态，由 Recovery Worker 处理

---

# 21. 人机协作模式架构

> 定义完整的 HITL 模式目录。

## 21.1 HITL 模式目录

| 模式     | 说明                             | 触发条件                 | 超时行为           |
| -------- | -------------------------------- | ------------------------ | ------------------ |
| 单人审批 | 一个审批人决策                   | risk_level ≥ high        | 超时 → 升级        |
| 多方审批 | 多人独立审批，投票决策           | critical 操作 / 跨域影响 | 超时 → 自动拒绝    |
| 委托审批 | 审批人可转给他人                 | 原审批人不在线           | 委托后 TTL 重置    |
| 迭代反馈 | 人给出修改意见，Agent 重做       | 输出不满意               | 最大迭代次数后终止 |
| 协同编辑 | 人和 Agent 交替修改同一 artifact | 代码/文档协作            | 无超时，手动结束   |
| 知情确认 | 仅通知，无需审批                 | 低风险 side effect       | 自动通过           |
| 断路人工 | LLM 不可用时转人工决策           | D4 降级模式（见 §15.5）  | 人工超时 → abort   |

## 21.2 审批流引擎

ApprovalFlow 定义一次审批的完整执行结构：

| 字段                | 类型                                 | 说明                                           |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| `flowId`            | string (ULID)                        | 审批流唯一标识                                 |
| `steps`             | ApprovalStep[]                       | 有序步骤列表，支持 sequential 和 parallel 模式 |
| `approvers`         | 动态解析                             | 由 §47 审批路由引擎根据组织架构实时计算        |
| `timeout_per_step`  | Duration                             | 单步超时（默认 24h），超时触发 escalation      |
| `escalation_policy` | enum: upgrade_sev / delegate / abort | 超时后升级策略                                 |
| `delegation_rules`  | DelegationRule[]                     | 不在位时的代理规则（见 §47.3）                 |

审批流引擎支持步骤间条件分支（如风险金额决定是否追加高层审批）、并行会签（所有人通过才放行）以及任一通过（一人通过即放行）三种决策模式。

## 21.3 迭代反馈循环

**流程**：Agent 产出 → 人审查 → 给出 guidance → Agent replan + 重做 → 循环，直到 approve 或达到 max_iterations。

## 21.4 通知与渠道

| 渠道                  | 用途                | 集成方式           |
| --------------------- | ------------------- | ------------------ |
| 平台控制台            | 默认审批界面        | 内置               |
| Webhook               | 外部系统集成        | 出站 HTTP          |
| Email                 | 异步通知            | SMTP adapter       |
| IM（Slack/飞书/企微） | 即时通知 + 快捷审批 | Webhook + 回调 API |

---

# 22. SDK 与开发者体验架构

> 无 SDK 的平台无法被业务团队采纳。定义 Pack 开发工具链和本地开发体验。

## 22.1 SDK 分层

| SDK 层     | 面向角色   | 功能                                        |
| ---------- | ---------- | ------------------------------------------- |
| Pack SDK   | 业务开发者 | 创建/测试/发布 Business Pack                |
| Plugin SDK | 插件开发者 | 开发 tool / adapter / retriever / evaluator |
| Client SDK | 外部集成方 | 调用平台 Public API                         |
| Admin SDK  | 运维团队   | 调用 Admin API，脚本化运维                  |

## 22.2 Pack SDK 核心能力

Pack SDK 为业务开发者提供从创建到发布的完整工具链：

| 能力             | 说明                                                          |
| ---------------- | ------------------------------------------------------------- |
| Scaffold CLI     | `pack create` 生成标准目录结构、Manifest 模板和示例代码       |
| Local Dev Server | 内置轻量运行时，支持热重载，模拟 P3/P4 执行流程               |
| Type-safe API    | 提供 Tool、Prompt、Eval 的类型安全定义接口，编译期校验合约    |
| Test Harness     | 集成 MockModelGateway 和 MockToolExecutor，支持录制/回放测试  |
| Publish CLI      | `pack publish` 一键打包、校验 Manifest 合规性并推送至目标环境 |
| Versioning       | 基于 semver 自动版本管理，发布时强制 changelog                |

## 22.3 本地开发环境

- `agent-platform dev` — 启动本地平台（SQLite + in-process workers）
- `agent-platform pack create` — 创建 Pack 脚手架
- `agent-platform pack test` — 运行 Pack 测试（mock LLM + mock tools）
- `agent-platform pack validate` — 校验 Manifest 合规性
- `agent-platform pack publish --target staging` — 发布到 staging 环境

**本地模拟器**：

- 内置 MockModelGateway：返回预配置的 LLM 响应，用于确定性测试
- 内置 MockToolExecutor：模拟 tool 执行结果
- 测试录制/回放：将真实 LLM 调用录制为 fixture，后续测试回放（不消耗 token）

## 22.4 Plugin 生命周期

| 阶段 | 说明                        | 要求                     |
| ---- | --------------------------- | ------------------------ |
| 开发 | 本地开发 + Plugin SDK       | 必须声明 PluginManifest  |
| 测试 | 单元测试 + sandbox 集成测试 | 覆盖率 ≥ 80%             |
| 认证 | 安全扫描 + 能力审查         | 通过 Plugin 安全检查清单 |
| 发布 | 注册到 Plugin Registry      | 版本语义化（semver）     |
| 运行 | 受 sandbox 约束执行         | 资源限制 + 能力白名单    |
| 废弃 | 标记 deprecated + 迁移指引  | 至少维护 3 个月          |

## 22.5 文档与示例

- 每个 SDK 必须有 API reference（从 TypeScript 类型自动生成）
- 提供 3 个标准示例 Pack：simple-qa / coding-fix / operations-resolve
- 提供 Playground 环境：在线试用 Pack 开发（可选，Phase 4）

---

# 23. 合规与数据治理架构

> 企业级平台必须满足合规要求。定义 GDPR/SOC2 相关的数据治理架构。

## 23.1 数据生命周期管理

| 数据类型     | 保留策略              | 删除方式                | 说明                      |
| ------------ | --------------------- | ----------------------- | ------------------------- |
| Truth table  | 按业务需要            | 逻辑删除 + 定期物理清理 | 控制真相                  |
| Event log    | 默认 365 天           | 归档后删除              | append-only，归档到冷存储 |
| Audit record | 默认 3 年             | 不可删除（合规要求）    | 法律保留期                |
| Artifact     | 默认 90 天            | 物理删除                | 大对象                    |
| Memory       | 按 TTL 自动清理       | 物理删除                | 运行态短期数据            |
| Knowledge    | 按 trust level 差异化 | 逻辑删除                | 长期共享数据              |
| LLM 调用记录 | 默认 90 天            | 物理删除                | 含 prompt/completion      |
| Cost record  | 默认 3 年             | 归档                    | 财务审计                  |

## 23.2 Right-to-Erasure（GDPR Art.17）

append-only event log 与 right-to-erasure 存在架构冲突。解决方案：

**Crypto-shredding**：

1. 每个 tenant 的 PII 数据使用独立的 data encryption key (DEK) 加密后存储
2. DEK 由 key management service 管理，与 tenant_id 关联
3. 删除请求到达时，销毁该 tenant 的 DEK
4. event log 中的加密数据变为不可解密（逻辑等效于删除）
5. 审计记录保留删除操作本身的记录

## 23.3 数据驻留

- 每个 tenant 可配置 data_residency 约束（如 "CN" / "EU" / "US"）
- LLM 调用必须路由到满足数据驻留的 provider（见 §15.3 data_residency 路由）
- 存储引擎按 region 分片（Phase S3+ 支持）
- 跨 region 数据传输默认禁止，需显式授权

## 23.4 SOC2 控制映射

| SOC2 控制域    | 平台对应能力                     | 证据来源                        |
| -------------- | -------------------------------- | ------------------------------- |
| CC6.1 逻辑访问 | §11 统一身份与授权               | PolicyOutcome + audit record    |
| CC6.3 加密     | §23.5 加密架构                   | key rotation log                |
| CC7.2 监控     | §12 异常事件检测                 | incident + metrics              |
| CC8.1 变更管理 | §24 配置治理 + §16 Prompt 版本化 | config_version + prompt_version |
| CC9.1 风险缓释 | §10 风险评分引擎                 | RiskDecision + evidence bundle  |
| A1.2 容灾      | §31 容灾架构                     | DR 演练报告                     |

## 23.5 加密架构

| 层面         | 策略           | 实现                                              |
| ------------ | -------------- | ------------------------------------------------- |
| 传输加密     | TLS 1.3 强制   | 所有 HTTP/gRPC/WebSocket 连接                     |
| 存储加密     | AES-256        | 数据库级 TDE 或应用级字段加密                     |
| PII 字段加密 | Per-tenant DEK | 支撑 crypto-shredding                             |
| Secret 存储  | Vault 集成     | 引用式访问，TTL ≤ 300s                            |
| Key 轮换     | 自动 90 天     | DEK 轮换不影响历史数据解密（envelope encryption） |

## 23.6 数据血缘

每个决策和输出都可追溯到其数据来源：

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (ExecutionPlan)
    → Execute (ExecutionReceipt) → Side Effect
```

- 通过 trace_id + evidence_refs 构建血缘链
- 支持正向查询（某个 knowledge 影响了哪些决策）和反向查询（某个 side effect 依赖了哪些输入）
- 血缘数据写入 P5 Evidence Plane，不单独建存储

---

# Part III — 业务域接入层（§37-§38）

---

# 37. 业务域建模与接入架构

> 解决"平台搭好了怎么承接企业内部多元业务"的核心问题。
> 关联：§30 Business Pack 模型 · §22 SDK/DX · §10 风险控制 · §16 Prompt 管理 · §17 模型评估 · §29 Knowledge/Memory

## 37.1 问题陈述

企业内部 24 个垂直业务线在以下维度存在根本差异：

| 维度       | 量化交易          | 电商              | 广告推广          | 金融服务            | 数据处理        | 代码开发         |
| ---------- | ----------------- | ----------------- | ----------------- | ------------------- | --------------- | ---------------- |
| 风险等级   | Critical（资金）  | High（超卖/定价） | Medium（预算）    | Critical（合规）    | Medium（数据）  | High（生产变更） |
| 时间敏感性 | 微秒~毫秒级       | 秒级（搜索/风控） | 小时级（竞价）    | 秒~天级             | SLA 驱动        | 分钟级           |
| 知识时效   | 行情 Tick 实时    | 库存/价格分钟级   | 投放数据小时级    | 征信/法规季度级     | Schema 按需     | 代码库实时       |
| 评估维度   | Sharpe/回撤/滑点  | GMV/转化率/CSAT   | ROAS/CPA/CTR      | 基尼/KS/赔付率      | SLA 达成率/质量 | 编译+测试+安全   |
| 审批要求   | 策略上线强制审批  | 大额价格变动审批  | 投放启动+创意审批 | 超阈值贷款/SAR 强制 | Schema 迁移审批 | Code Review      |
| 可逆性     | 平仓（有成本）    | 退款/补偿         | 暂停投放          | 冲正（受限）        | 回退到良好数据  | Git revert       |
| HITL 强度  | 高                | 中                | 中                | 极高                | 中              | 高               |
| 延迟层级   | 超低延迟（<10ms） | 实时（<1s）       | 准实时（<5min）   | 实时~批处理         | SLA 驱动        | 实时（<1s）      |

| 维度       | 用户运营        | 行业调研          | 学术调研          | 企业知识库        | 财务             | 法务               |
| ---------- | --------------- | ----------------- | ----------------- | ----------------- | ---------------- | ------------------ |
| 风险等级   | Medium（隐私）  | Low（信息）       | Low（学术声誉）   | Medium（泄露）    | Critical（资金） | Critical（法律）   |
| 时间敏感性 | 分钟级（触发）  | 小时~天级         | 天~周级           | 秒级（搜索）      | 天级（月结）     | 小时~天级          |
| 知识时效   | 用户行为实时    | 报告季度级        | 论文月级          | 文档周级          | 法规季度级       | 法规/判例月级      |
| 评估维度   | 留存率/LTV/NPS  | 事实准确率/覆盖率 | 引用准确率/可复现 | MRR/忠实度/覆盖率 | 准确性/合规/时效 | 召回率/准确性/时效 |
| 审批要求   | 活动内容审批    | 发布前人工审核    | 全部人工审核      | 访问控制/纠错     | 四眼+职责分离    | **全部律师审核**   |
| 可逆性     | 停止活动        | 更正声明          | 勘误/撤稿         | 版本回退          | 冲正/对账        | 不可逆（已生效）   |
| HITL 强度  | 中              | 高                | 高                | 中                | 极高             | **最高**           |
| 延迟层级   | 准实时（<5min） | 批处理            | 批处理            | 实时（<1s）       | 批处理           | 批处理             |

| 维度       | 在线直播            | 广告素材制作        | 游戏开发        | 游戏上架            | 人力资源           | 供应链与物流      |
| ---------- | ------------------- | ------------------- | --------------- | ------------------- | ------------------ | ----------------- |
| 风险等级   | High（监管/舆情）   | Medium（品牌/版权） | Medium（质量）  | High（合规/分级）   | High（隐私/歧视）  | High（资金/运营） |
| 时间敏感性 | 毫秒~秒级（实时流） | 小时~天级           | 分钟~小时级     | 天级（审核周期）    | 天级（招聘流程）   | 小时级（调度）    |
| 知识时效   | 实时（弹幕/画面）   | 素材库周级          | 代码库/引擎实时 | 平台政策月级        | 法规/政策季度级    | 库存/物流实时     |
| 评估维度   | 违规检出率/延迟     | 创意质量/合规率     | 编译/测试/性能  | 一次通过率/上线时间 | 招聘周期/AIR       | 预测准确率/成本   |
| 审批要求   | 违规处置审批        | 创意发布审批        | 版本发布审批    | 每平台合规审批      | 录用/晋升审批      | 大额采购审批      |
| 可逆性     | 断流（不可逆播出）  | 版本回退            | Git revert      | 下架（有时间窗口）  | 撤回 offer（受限） | 退货/调拨         |
| HITL 强度  | 高                  | 中                  | 中              | 高                  | 高                 | 中                |
| 延迟层级   | 实时（<2s）         | 批处理              | 实时（<1s）     | 批处理              | 批处理             | 准实时（<5min）   |

| 维度       | 医疗健康             | 教育培训            | 客户服务       | 内容审核              | IT 运维 SRE      | 市场营销            |
| ---------- | -------------------- | ------------------- | -------------- | --------------------- | ---------------- | ------------------- |
| 风险等级   | **Critical（生命）** | Medium（隐私/教育） | Medium（声誉） | High（法律/安全）     | High（可用性）   | Medium（品牌/法律） |
| 时间敏感性 | 分钟级（急诊）~天级  | 天~周级（课程）     | 秒级（对话）   | 毫秒~秒级（实时审核） | 秒级（告警响应） | 小时级（舆情）      |
| 知识时效   | 指南/药品月级        | 教材学期级          | FAQ/知识库周级 | 政策/法规月级         | 配置/拓扑实时    | 市场数据日级        |
| 评估维度   | 诊断准确率/安全性    | 学习效果/完成率     | CSAT/FCR/AHT   | 召回率/精确率/延迟    | MTTR/MTTD/可用性 | ROAS/SOV/互动率     |
| 审批要求   | **全部医师审核**     | 课程内容审核        | 超权限承诺审批 | 处置申诉审批          | 变更窗口审批     | 品牌内容审批        |
| 可逆性     | 不可逆（已执行医嘱） | 课程调整            | 补偿/退款      | 解封/恢复             | 回滚变更         | 撤稿/更正           |
| HITL 强度  | **最高**             | 中                  | 中             | 高                    | 高               | 中                  |
| 延迟层级   | 实时~批处理          | 批处理              | 实时（<1s）    | 实时（<2s）           | 实时（<1s）      | 准实时（<15min）    |

**当前 §30 Business Pack 将上述差异压缩为一个平坦的 `BusinessPackManifest`**，无法表达领域语义、无法驱动差异化风控、无法指导领域 Prompt 策略。v3.0 通过 §71-§82 对原始 12 个垂直域逐一深化，v3.1 通过 §83-§94 扩展至 24 个垂直域全覆盖。

## 37.2 DomainDescriptor — 领域描述符

每个业务域在接入平台时必须提供结构化的领域描述符，作为平台理解、约束、优化该域 Agent 行为的基础：

**设计决策**：DomainDescriptor 不替代 BusinessPackManifest(§30)，而是作为 Pack 的**领域语义层**。一个 Pack 关联一个 DomainDescriptor，多个 Pack 可共享同一 DomainDescriptor（例如"HR 入职 Pack"和"HR 薪酬 Pack"共享 `domain_id: "hr"`）。

v4.1 新增执行模式字段，用于区分 LLM 辅助规划与确定性热路径执行：

```yaml
execution_mode:
  planning_mode: llm_assisted | deterministic_only
  hot_path_mode: deterministic_only | llm_allowed
  llm_in_hot_path_allowed: boolean
  max_hot_path_latency_ms: number
```

高风险或超低延迟热路径（如量化下单、实时风控、直播断流、IT 自动修复）必须使用 `hot_path_mode: deterministic_only`。LLM 可以参与离线规划、候选方案生成、解释和复盘，但不得进入要求确定性、微秒/毫秒级延迟或不可逆副作用的执行热路径。

## 37.3 DomainRiskProfile — 领域风险画像

通用风险矩阵(§10)提供平台级默认值，DomainRiskProfile 提供**领域级覆写**，使同一动作在不同业务域下触发不同风控策略：

**领域风险画像应用示例**：

| 场景              | 平台默认 risk | 领域覆写 risk               | 结果             |
| ----------------- | ------------- | --------------------------- | ---------------- |
| `tool.http.post`  | 60            | 财务域 → 90                 | 强制四眼审批     |
| `tool.http.post`  | 60            | 客服域 → 40                 | 自动执行         |
| `tool.file.write` | 50            | 代码研发域 → 70（生产分支） | Code Review 门禁 |
| `tool.file.write` | 50            | 素材制作域 → 30             | 自动保存草稿     |

## 37.4 DomainKnowledgeSchema — 领域知识结构

定义每个业务域的知识检索策略、时效性要求和冲突解决规则，对接 §29 Knowledge/Memory 层：

**领域知识差异示例**：

| 业务域     | 检索模式                   | 时效要求            | 冲突策略                        |
| ---------- | -------------------------- | ------------------- | ------------------------------- |
| 量化交易   | api_realtime (行情 Tick)   | 微秒~毫秒级         | source_priority（交易所优先）   |
| 电商       | api_realtime (库存/价格)   | 分钟级              | source_priority（库存系统优先） |
| 金融服务   | structured_query (征信API) | 天~季度级           | human_review                    |
| 代码研发   | structured_query (AST/Git) | 实时（HEAD commit） | timestamp_latest                |
| 学术调研   | semantic_search (论文库)   | 月级                | citation_count_priority         |
| 企业知识库 | hybrid (语义+关键词)       | 周级                | domain_rule（版本号最高优先）   |
| 财务       | structured_query (ERP API) | 天级（T+1 对账）    | human_review                    |
| 法务       | structured_query (法律库)  | 月级                | jurisdiction_priority           |

## 37.5 DomainEvalFramework — 领域评估框架

通用模型评估(§17)提供平台级质量门禁，DomainEvalFramework 定义**领域专属的质量轴和评估标准**：

**领域评估维度差异**：

| 业务域     | 核心质量轴                       | 自动检查                      | 回归数据来源         |
| ---------- | -------------------------------- | ----------------------------- | -------------------- |
| 量化交易   | Sharpe/回撤/滑点、执行质量       | 盘前合理性检查 + 风控限额校验 | 回测绩效基线         |
| 电商       | GMV/转化率/CSAT、库存准确性      | 价格合理性 + 库存同步校验     | A/B 测试历史数据     |
| 广告推广   | ROAS/CPA/CTR、预算合规、创意合规 | 预算上限检查 + 广告法规检查   | A/B 测试历史数据     |
| 金融服务   | 基尼/KS/赔付率、AML 检测率       | 公平性测试 + PSI 监控         | 专家标注+监管反馈    |
| 代码研发   | 编译通过、测试覆盖、安全扫描     | AST lint + 单测运行           | PR review 通过的代码 |
| 学术调研   | 引用准确率、统计正确性、可复现性 | DOI 验证 + 查重               | 已发表论文           |
| 企业知识库 | MRR/忠实度/覆盖率、访问控制合规  | 引用验证 + 权限检查           | 人工标注 QA 对       |
| 财务       | 数值准确性、合规性、审计可追溯   | 金额校验 + 法规规则引擎       | 专家审计样本         |
| 法务       | 风险条款召回率、判例准确性       | 法律数据库交叉验证            | 律师审核标注         |

## 37.6 DomainPromptLibrary — 领域 Prompt 库

对接 §16 Prompt 管理系统，为每个业务域提供**领域级 Prompt 资产**，避免散落各处的 Prompt 碎片：

**Prompt 库与 Prompt 管理系统(§16)的关系**：DomainPromptLibrary 是领域级 Prompt 资产，注册到 §16 的 PromptRegistry 中。Prompt 的版本化、灰度、回滚能力由 §16 提供，领域 Prompt 库只负责**内容定义和领域适配**。

## 37.7 DomainRecipe — 领域模板与原型

将常见业务域归纳为十二种**原型模板**，新业务接入时选择最接近的原型，基于模板快速生成 DomainDescriptor 骨架：

| 原型                            | 核心模式                     | 适用业务域                                         | 典型 Workflow                           |
| ------------------------------- | ---------------------------- | -------------------------------------------------- | --------------------------------------- |
| **CRUD-heavy**                  | 读→查→改→确认                | 企业知识库、用户运营、人力资源                     | 问题受理→查询→处理→反馈                 |
| **Analytics**                   | 采集→分析→可视化→决策        | 行业调研、用户运营、广告报表、市场营销             | 数据查询→分析→生成报表→推荐行动         |
| **Creative**                    | 生成→审核→迭代→发布          | 广告推广、电商（商品描述）、广告素材制作、游戏开发 | 需求理解→生成→人工审核→迭代→发布        |
| **Realtime**                    | 监控→检测→响应→记录          | 量化交易、电商（风控）、在线直播                   | 事件流监听→异常检测→自动响应→事后复盘   |
| **Trading**                     | 信号→风控→执行→结算          | 量化交易、金融服务                                 | 信号生成→盘前风控→订单执行→持仓结算     |
| **Compliance**                  | 监控→检测→评估→报告          | 金融服务、财务、法务、游戏上架                     | 规则监控→异常检测→合规评估→监管报告     |
| **Research**                    | 收集→分析→综合→发表          | 行业调研、学术调研                                 | 多源采集→结构化分析→综合→审核发布       |
| **Adversarial**                 | 攻击面→防御→审计→修复        | 代码开发（安全）、法务（诉讼）                     | 威胁/风险识别→防御措施→审计验证→修复    |
| **Moderation**（v3.1 新增）     | 摄入→多模态检测→处置→申诉    | 内容审核与安全、在线直播（审核链路）               | 内容摄入→AI 检测→分级处置→人工申诉复核  |
| **Logistics**（v3.1 新增）      | 预测→优化→调度→追踪→异常处理 | 供应链与物流、游戏上架（发行调度）                 | 需求预测→路径优化→调度执行→实时追踪     |
| **Conversational**（v3.1 新增） | 意图识别→知识检索→回答→反馈  | 客户服务、教育培训（辅导）、医疗健康（分诊）       | 用户意图→知识库检索→生成回答→满意度反馈 |
| **IncidentOps**（v3.1 新增）    | 告警→诊断→修复→复盘→预防     | IT 运维 SRE/DevOps                                 | 告警接收→根因诊断→自动修复→事后复盘     |

**使用流程**：

1. 业务方通过 CLI 选择原型（12 种可选）：`agent-platform domain init --archetype=crud_heavy --name=hr`
2. 系统生成 DomainDescriptor 骨架，标记所有 `customization_points`
3. 业务方填充必填项（实体、工具绑定、审批规则等）
4. CLI 运行 `agent-platform domain validate` 校验完整性
5. 通过后进入 §38 接入 Runbook 流程

## 37.8 DomainInteractionPolicy — 跨域交互策略

当多个业务域的 Agent 需要协作时（例如广告域 Agent 调用数据分析域 Agent 生成报表），需要明确的**边界策略和补偿机制**：

**跨域交互矩阵示例**：

| 源域 → 目标域       | 数据流向           | 委托                     | 失败策略                |
| ------------------- | ------------------ | ------------------------ | ----------------------- |
| 广告 → 数据分析     | 聚合数据，禁 PII   | 允许(depth=1)            | retry(3) → human_review |
| HR → 财务           | 薪酬数据，加密传输 | 允许(depth=1, intersect) | rollback_source         |
| 直播 → 库存         | 实时库存查询       | 禁止(只读 API)           | fallback 缓存           |
| 代码研发 → 安全运维 | 代码扫描结果       | 允许(depth=1)            | log_and_continue        |

## 37.9 DomainGovernancePolicy — 领域治理模型

每个业务域必须有明确的**治理归属**，包括 ownership、SLO、预算和变更管理：

**治理模型与平台能力的映射**：

| 治理维度    | 平台能力对接                    | 自动化程度          |
| ----------- | ------------------------------- | ------------------- |
| Ownership   | §6 API 权限 + §11 IAM           | 全自动（RBAC）      |
| SLO         | §27 SLO 监控 + Error Budget     | 全自动（告警+降级） |
| Budget      | §18 Token 计量 + 预算强制       | 全自动（配额+熔断） |
| Change Mgmt | §16 Prompt 灰度 + §30 Pack 发布 | 半自动（审批+灰度） |

## 37.10 DomainDescriptor 注册与生命周期

```text
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Draft      │────▶│  Validated   │────▶│  Registered  │────▶│   Active     │
│ (业务方编写) │     │ (CLI 校验)   │     │ (平台注册)    │     │ (生产运行)   │
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

**状态流转规则**：

| 当前状态   | 可转移至   | 条件                                      |
| ---------- | ---------- | ----------------------------------------- |
| Draft      | Validated  | `agent-platform domain validate` 全部通过 |
| Validated  | Registered | 安全审查 + 平台兼容性检查通过             |
| Registered | Active     | 至少一个关联 Pack 发布成功                |
| Active     | Updating   | 业务方提交新版本 descriptor               |
| Updating   | Active     | 新版本校验+注册通过                       |
| Active     | Deprecated | domain_owner 发起废弃，审批通过           |
| Deprecated | Archived   | 所有关联 Pack 迁移或下线完成              |

## 37.11 Canonical Domain Meta-Model — 统一领域元模型

每个垂直业务域接入平台时，必须使用统一元模型回答以下 **12 个标准问题**。该元模型是平台"按域配置驱动"的基础，也是看板、审批、风险、评测统一生成的数据来源。新增第 25 个域时，只需填写同一模板即可完成接入定义。

### 元模型 12 问

| #   | 元模型问题                 | 对应平台概念                              | 填写规范                     |
| --- | -------------------------- | ----------------------------------------- | ---------------------------- |
| Q1  | 领域主实体是什么           | DomainDescriptor.primary_entities         | 列举 3-5 个核心业务实体      |
| Q2  | 高风险动作是什么           | DomainRiskProfile（risk ≥ 70 的操作）     | 从 DomainRiskProfile 表提取  |
| Q3  | 默认自治级别是什么         | DomainDescriptor.default_autonomy         | L0-L4（参考 §42）            |
| Q4  | 默认 HITL 节点是什么       | DomainInteractionPolicy.hitl_points       | 列举强制人工决策节点         |
| Q5  | 关键外部系统有哪些         | DomainDescriptor.external_dependencies    | 列举核心上下游系统           |
| Q6  | 关键只读工具有哪些         | DomainRiskProfile（risk < 40 且无副作用） | 从 DomainRiskProfile 表提取  |
| Q7  | 关键写工具有哪些           | DomainRiskProfile（risk ≥ 40 或有副作用） | 从 DomainRiskProfile 表提取  |
| Q8  | 不可逆动作有哪些           | DomainDescriptor.irreversible_actions     | 列举所有不可回滚操作         |
| Q9  | 核心质量指标是什么         | DomainEvalFramework.primary_metrics       | 列举 3-5 个核心 KPI          |
| Q10 | 核心合规约束是什么         | DomainGovernancePolicy.compliance_rules   | 列举适用法规与强制规则       |
| Q11 | 最小上线能力集是什么       | DomainDescriptor.mvp_capabilities         | 列举灰度上线必备的最小功能集 |
| Q12 | 灰度上线前必须完成什么认证 | §38 Gate3 SecurityCert + 域专项检查       | 列举必须通过的认证/审查项    |

### 24 域元模型填充矩阵（Q1-Q6）

| 域         | Q1 主实体                           | Q2 高风险动作                                                 | Q3 默认自治 | Q4 默认 HITL 节点                           | Q5 关键外部系统                | Q6 只读工具                    |
| ---------- | ----------------------------------- | ------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------ | ------------------------------ |
| 量化交易   | 策略·订单·持仓·行情·风控限额        | order.submit · strategy.deploy · risk_limit.modify            | L1          | 策略上线·风控限额变更·资金分配              | 交易所·行情源·风控系统         | market_data.read               |
| 电商       | 商品·订单·库存·价格·退款            | price.update · refund.issue · listing.publish                 | L2          | 超阈值价格变动·超额退款·管控品类上架        | ERP·WMS·支付网关·搜索引擎      | inventory.sync                 |
| 广告推广   | 活动·创意·受众·出价·预算            | campaign.launch · creative.publish · audience.create          | L2          | 投放启动·创意上线·敏感品类受众定向          | 广告平台API·DMP·创意工具       | —                              |
| 金融服务   | 信贷申请·KYC记录·保险单·理赔·SAR    | credit.approve · sar.submit · claim.adjudicate · model.deploy | L0          | 超阈值贷款·SAR报告·模型部署·不利信贷决策    | 征信系统·核心银行·监管报送     | —                              |
| 数据处理   | 管线·Schema·数据集·血缘·质量规则    | schema.migrate · pipeline.deploy_prod · data.delete           | L2          | Schema迁移·生产部署·数据删除·敏感数据访问   | 数仓·计算引擎·调度系统         | pipeline.retry                 |
| 代码开发   | 代码库·PR·CI管线·漏洞·依赖          | code.merge · deploy.production · security.fix                 | L1          | 代码合并·生产部署·安全漏洞修复·架构决策     | Git·CI/CD·SAST/DAST·制品库     | —                              |
| 用户运营   | 用户分群·活动·通知·A/B测试·LTV      | campaign.send · segment.create                                | L2          | 活动内容·敏感属性分群·通知频率·激励预算     | CDP·推送平台·分析系统          | —                              |
| 行业调研   | 报告·数据源·趋势·竞品·监管政策      | report.publish · data.scrape                                  | L1          | 研究发布·前瞻性声明·版权合规                | 行业数据库·新闻API·监管网站    | alert.send                     |
| 学术调研   | 文献·假设·实验·手稿·引用            | manuscript.submit · citation.insert · analysis.run            | L1          | 发表审核·假设选择·实验设计·统计方法         | 学术数据库·DOI注册·查重系统    | literature.search              |
| 企业知识库 | 文档·知识图谱·FAQ·权限·检索索引     | document.ingest · answer.synthesize · content.retire          | L2          | 新文档源接入·低置信度回答·内容退役          | 文档系统·SSO·搜索引擎          | search.query                   |
| 财务       | 发票·凭证·GL·税务·预算              | journal.post · financial.signoff · tax.file                   | L0          | 超阈值凭证·报表签字·税务申报·坏账核销       | ERP·金税系统·银行接口·审计系统 | —                              |
| 法务       | 合同·判例·诉讼·IP·合规记录          | legal_opinion.draft · contract.review · ediscovery.classify   | L0          | **全部输出**（执业律师审核）                | 法律数据库·电子发现·合同管理   | ip.search                      |
| 在线直播   | 直播流·弹幕·商品·主播·审核记录      | moderation.realtime · commerce.shelf · stream.publish         | L1          | 涉政/涉恐断流·带货违规处置·大型活动开播     | 推流CDN·电商系统·审核平台      | danmaku.filter                 |
| 广告素材   | 创意·品牌资产·模板·效果数据         | brand.compliance · creative.generate                          | L2          | 品牌类素材·强监管行业素材·名人肖像          | DAM·投放系统·品牌管理          | asset.adapt                    |
| 游戏开发   | 设计文档·美术资产·代码·数值配置·Bug | game.asset_generate · game.balance_sim                        | L2          | 核心玩法·美术风格·版本发布·P0/P1 Bug修复    | 游戏引擎·美术工具·CI/CD        | game.qa_run                    |
| 游戏上架   | 版本包·提审材料·本地化·活动配置     | store.submit · compliance.check · liveops.config              | L1          | 版号提审·重大版本·大型活动·敏感本地化       | 商店API·支付渠道·分级机构      | localization.translate         |
| 人力资源   | 简历·Offer·薪酬·绩效·合同           | offer_generate · payroll_calc · resume_screen                 | L0          | Offer发放·解雇·绩效评级·薪酬调整·组织变更   | HCM·招聘平台·薪酬系统·背调     | —                              |
| 供应链     | 采购订单·库存·运输路线·关务·供应商  | customs_declare · route_plan · inventory_optimize             | L1          | 大额采购·新供应商准入·关务异常·危险品运输   | ERP·WMS·TMS·海关系统           | scm.forecast                   |
| 医疗健康   | 病历·处方·影像·分诊·药物交互        | clinical.diagnose · drug.interaction_check · imaging.analyze  | L0          | **全部临床决策**（执业医师确认）            | HIS·PACS·药品数据库·医保系统   | —                              |
| 教育培训   | 课程·题库·学习路径·学情·评测        | content_generate · assess · tutor                             | L2          | 内容上线·主观题评分·敏感话题·未成年人数据   | LMS·题库·学情系统·家长平台     | learning_path                  |
| 客户服务   | 工单·对话·知识库·路由·质检记录      | cs.respond · cs.quality_score                                 | L2          | 超权限退款·投诉升级·法律问题·VIP异常        | CRM·知识库·工单系统·CTI        | cs.route · cs.knowledge_search |
| 内容审核   | 内容项·审核记录·策略规则·申诉·报告  | moderation.classify · moderation.appeal · compliance.report   | L1          | CSAM即时处置·申诉裁决·策略变更·边界案例     | 审核平台·法律合规·举报系统     | —                              |
| IT运维     | 告警·事件·部署·变更·漏洞            | ops.deploy · ops.incident_respond · security_scan             | L1          | 高风险变更CAB·安全事件·新修复策略·预算采购  | 监控系统·CMDB·CI/CD·SIEM       | ops.capacity_plan              |
| 市场营销   | Campaign·品牌资产·SEO·社交内容·舆情 | social.publish · marketing.campaign                           | L2          | 对外内容审核·品牌危机接管·营销预算·品牌合作 | 广告平台·社交API·舆情系统      | brand.monitor · seo.optimize   |

### 24 域元模型填充矩阵（Q7-Q12）

| 域         | Q7 写工具                                                                        | Q8 不可逆动作                          | Q9 核心质量指标                        | Q10 核心合规约束                  | Q11 最小上线能力集          | Q12 灰度前认证                |
| ---------- | -------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------- | --------------------------- | ----------------------------- |
| 量化交易   | order.submit · strategy.deploy · risk_limit.modify                               | 订单提交（平仓有成本）· 策略部署       | Sharpe · 最大回撤 · 风控遵从率         | 证监会/SEC/MiFID II               | 信号生成+风控+执行链路      | 风控系统联调·交易所沙箱验证   |
| 电商       | price.update · refund.issue · listing.publish                                    | 价格发布（底价约束）· 退款支付         | GMV · 转化率 · CSAT                    | 电商法/消保法/PCI-DSS             | 商品上架+定价+基础客服      | 支付安全扫描·压测             |
| 广告推广   | campaign.launch · bid.adjust · creative.publish · audience.create                | 投放预算消耗（已花费不可回收）         | ROAS · CPA · CTR                       | 广告法/平台政策/GDPR              | 投放创建+竞价+基础报告      | 广告法合规检查·预算控制验证   |
| 金融服务   | credit.approve · sar.submit · claim.adjudicate · model.deploy                    | 贷款放款·SAR提交·赔付支付              | 基尼/KS · 赔付率 · PSI                 | Basel III/反洗钱法/EU AI Act      | 信贷评估+KYC+风控           | 公平性测试·监管报表联调       |
| 数据处理   | schema.migrate · pipeline.deploy_prod · data.delete                              | 数据删除（不可恢复）· Schema破坏性变更 | SLA达成率 · 数据质量通过率             | GDPR删除权/数据驻留               | 管线编排+质量检查+血缘      | 数据安全分级·访问控制验证     |
| 代码开发   | code.merge · deploy.production · code.generate · security.fix                    | 生产部署（需回滚）· 依赖版本锁定       | 测试通过率 · Bug检测率 · 采纳率        | 许可证/SOC2                       | 代码生成+审查+CI集成        | 安全扫描·许可证合规           |
| 用户运营   | campaign.send · segment.create · notification.push · ab_test.launch              | 批量通知推送（已发不可撤回）           | 留存率 · LTV/CAC · NPS                 | PIPL/GDPR/CAN-SPAM                | 分群+活动推送+基础分析      | 隐私合规·退出机制验证         |
| 行业调研   | report.publish · data.scrape · forecast.generate                                 | 报告发布（影响决策）                   | 事实正确率 · 来源引用率                | 证券法/数据许可/版权              | 数据采集+报告生成+审核流    | 数据源许可·版权合规           |
| 学术调研   | manuscript.submit · citation.insert · analysis.run                               | 论文提交（声誉影响）                   | 引用准确率100% · 可复现性              | 研究伦理/发表伦理                 | 文献综述+写作辅助+引用验证  | DOI验证·查重系统集成          |
| 企业知识库 | document.ingest · answer.synthesize · content.retire                             | 内容退役（知识丢失风险）               | MRR/NDCG · 答案忠实度                  | 数据留存/访问控制                 | 文档处理+语义搜索+权限      | 访问控制验证·搜索质量基线     |
| 财务       | journal.post · financial.signoff · tax.file                                      | 税务申报提交·GL过账（需冲正）          | 直通处理率 · GL准确率 · 审计发现数     | CAS/SOX/金税四期                  | 发票处理+凭证+对账          | 审计合规·职责分离验证         |
| 法务       | legal_opinion.draft · contract.review · ediscovery.classify                      | 法律意见发出（法律后果）               | 风险条款召回率 · 判例准确性            | 民法典/职业伦理/GDPR              | 合同审查+判例检索+合规      | 法律数据库集成·特权检测验证   |
| 在线直播   | moderation.realtime · commerce.shelf · stream.publish                            | 直播断流（影响用户体验）· 违规处置     | 违规检出率 · 处置延迟<3s · GPM         | 互联网直播管理规定/未成年人保护法 | 推流+实时审核+弹幕过滤      | 多模态审核模型·断流恢复演练   |
| 广告素材   | creative.generate · brand.compliance                                             | 素材发布（品牌影响）                   | 品牌合规通过率 · 平台审核一次通过率    | 广告法/版权法/肖像权              | 文案生成+图片生成+合规检查  | 广告法词库·品牌资产库集成     |
| 游戏开发   | game.asset_generate · game.balance_sim · game.design_assist                      | 版本发布（玩家体验影响）               | 风格一致性(FID) · Bug发现率            | 版号/防沉迷/内容审查              | QA自动化+美术生成+数值模拟  | 内容审查预筛·防沉迷验证       |
| 游戏上架   | store.submit · compliance.check · liveops.config                                 | 版号提审（零容错）· 版本上线           | 提审一次通过率>90% · DAU/留存          | 版号/分级/防沉迷/PIPL             | 提审自动化+合规检查+灰度    | 分级合规矩阵·防沉迷链路       |
| 人力资源   | resume_screen · offer_generate · payroll_calc · compliance_check                 | Offer发出·解雇执行·薪酬发放            | 招聘周期 · 薪酬公平性 · 偏见审计       | 劳动法/PIPL/EU AI Act             | 简历筛选+Offer生成+合规检查 | 偏见检测·公平性测试·可解释性  |
| 供应链     | inventory_optimize · route_plan · customs_declare                                | 采购订单提交·关务申报·危险品运输       | MAPE · OTIF · HS分类准确率             | 海关法/出口管制/危险品/ESG        | 需求预测+库存优化+路径规划  | 出口管制清单集成·危险品合规   |
| 医疗健康   | clinical.diagnose · drug.interaction_check · imaging.analyze · triage.assess     | 诊断建议发出（患者安全）· 处方开具     | 诊断敏感度 · 病灶召回率 · 药物交互召回 | 医疗器械条例/HIPAA/FDA SaMD       | 分诊+药物交互检查+辅助诊断  | SaMD认证·临床验证·数据加密    |
| 教育培训   | content_generate · assess · tutor                                                | 评分发布（影响学业）· 不当内容暴露     | 知识点掌握率 · 评分一致性(κ≥0.8)       | 未成年人保护法/FERPA/COPPA        | 内容生成+智能评测+辅导      | 内容安全过滤·未成年人保护验证 |
| 客户服务   | cs.respond · cs.quality_score                                                    | 退款支付·错误承诺（幻觉）              | CSAT · FCR · AI独立解决率 · 幻觉率     | 消保法/TCPA/GDPR                  | 多渠道对话+路由+知识检索    | 幻觉率基线·情绪检测验证       |
| 内容审核   | moderation.classify · moderation.appeal · adversarial.detect · compliance.report | CSAM报告提交·内容删除                  | 精确率/召回率 · 违规在线时长           | 网络安全法/DSA/CSAM强制报告       | 文本审核+图片审核+策略引擎  | 多模型交叉验证·红队测试       |
| IT运维     | ops.incident_respond · ops.deploy · security_scan                                | 生产变更（需回滚）· 安全修复           | MTTR · MTTD · SLO达成率                | 等保2.0/ISO 27001/SOC 2           | 事件响应+部署自动化+监控    | 变更管理流程·爆炸半径验证     |
| 市场营销   | social.publish · marketing.campaign                                              | 对外内容发布（品牌影响）· 预算消耗     | ROAS · SOV · 互动率 · 危机预警准确率   | 广告法/FTC/GDPR/CAN-SPAM          | Campaign编排+品牌监测+SEO   | 广告法合规·品牌调性基线       |

### 元模型的平台价值

- **模板化域接入**：新增第 25 个域时，填写 12 问元模型即完成接入定义的 80%
- **配置驱动内核**：平台内核读取元模型字段，自动配置 ConstraintPack · Toolbelt · EvalFramework · ApprovalRoute
- **统一看板生成**：§43 运营看板按元模型字段自动聚合域级视图（风险热图、质量趋势、合规状态）
- **审批路由自动化**：§47 审批路由根据 Q2/Q4 自动生成域级审批链
- **评测自动化**：§17 模型评估根据 Q9 自动生成域级评测套件
- **文档一致性**：24 域描述结构统一，不会随域数量增长而发散

---

# 38. 业务域接入 Runbook

> 定义新业务域从零到生产的标准化接入流程。
> 关联：§37 业务域建模 · §37.11 统一领域元模型 · §30 Business Pack · §22 SDK/DX · §34 ADR

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
| Phase 1 | 业务方 + 平台 Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | 平台架构评审通过                        |
| Phase 2 | 业务方                | Pack 代码 + 单元测试 + 集成测试 + eval dataset    | 测试覆盖 ≥ 80% + eval 通过              |
| Phase 3 | 安全团队 + 平台团队   | CertificationRecord + 风险评审记录                | 安全扫描无 Critical/High + 风险评审通过 |
| Phase 4 | 平台 SRE + 业务方     | RolloutRecord + 监控 Dashboard                    | canary 7 天无 P0/P1 + eval 质量不退化   |

## 38.2 Phase 1：领域建模

**目标**：业务方与平台团队协作，产出结构化的 DomainDescriptor。

**步骤**：

| #   | 活动                     | 执行者        | 产出                    | 工具                             |
| --- | ------------------------ | ------------- | ----------------------- | -------------------------------- |
| 1   | 选择领域原型(§37.7)      | 业务方        | Recipe 选择             | `agent-platform domain init`     |
| 2   | 填充领域实体和能力       | 业务方        | entities + capabilities | YAML/JSON 编辑                   |
| 3   | 定义领域风险画像         | 业务方 + 安全 | DomainRiskProfile       | 风险评估模板                     |
| 4   | 定义知识来源和检索策略   | 业务方 + 数据 | DomainKnowledgeSchema   | 知识源清单模板                   |
| 5   | 定义评估维度和标准       | 业务方 + AI   | DomainEvalFramework     | eval 模板                        |
| 6   | 构建领域 Prompt 库       | 业务方 + AI   | DomainPromptLibrary     | Prompt 工程模板                  |
| 7   | 确定治理归属             | 业务负责人    | DomainGovernancePolicy  | 治理契约模板                     |
| 8   | 填写 12 问元模型(§37.11) | 业务方 + 平台 | Meta-Model 填充表       | 元模型模板                       |
| 9   | 校验完整性               | 业务方        | 校验报告                | `agent-platform domain validate` |

**Gate 1 检查清单**：

- [ ] DomainDescriptor 所有必填字段已填充
- [ ] 至少 5 个 few-shot examples 已标注
- [ ] 风险画像已经过安全团队初审
- [ ] 知识源已确认可达且有授权
- [ ] eval dataset ≥ 20 条（含 golden answer）
- [ ] 治理契约已由 domain_owner 签署
- [ ] 跨域交互策略已与相关域确认（如有）
- [ ] 12 问元模型(§37.11)全部填写完成且通过校验
- [ ] 平台架构评审会议通过
- [ ] **垂直域专项**：延迟层级声明完成；Critical 风险域（量化交易/金融服务/财务/法务/医疗健康）须额外提交监管合规映射表和 HITL 覆盖方案；High 风险域（人力资源/在线直播/内容审核/IT运维/游戏上架）须提交领域专属风控方案

## 38.3 Phase 2：开发验证

**目标**：基于 DomainDescriptor 开发 Business Pack，通过本地和 staging 环境验证。

**步骤**：

| #   | 活动              | 执行者       | 产出             | 工具                                       |
| --- | ----------------- | ------------ | ---------------- | ------------------------------------------ |
| 1   | 初始化 Pack 工程  | 业务方       | Pack 代码骨架    | `agent-platform pack create --domain=<id>` |
| 2   | 实现 Tool 适配器  | 业务方       | Tool bundle 代码 | Pack SDK(§22)                              |
| 3   | 编写单元测试      | 业务方       | 测试用例         | 标准测试框架                               |
| 4   | 本地 Mock 测试    | 业务方       | 本地测试报告     | `agent-platform pack test --local`         |
| 5   | 构建 eval dataset | 业务方 + AI  | 评估数据集       | eval 工具链                                |
| 6   | Staging 集成测试  | 业务方 + SRE | 集成测试报告     | staging 环境                               |
| 7   | 运行领域评估      | 业务方       | eval 质量报告    | `agent-platform eval run --domain=<id>`    |

**Gate 2 检查清单**：

- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 领域 eval 所有质量轴达到 acceptance_threshold
- [ ] 无已知 P0/P1 Bug
- [ ] Pack Manifest 与 DomainDescriptor 一致性校验通过
- [ ] Tool 权限声明与风险画像匹配
- [ ] **垂直域专项**：域专属评估指标全部有自动检查实现；Critical 风险域须通过领域专家（律师/风控/审计师/执业医师）评审；人力资源域须通过偏见审计

## 38.4 Phase 3：安全认证

**目标**：安全团队和平台团队对 Pack 进行安全审查和风险评估。

| #   | 检查项                | 执行者   | 标准                       |
| --- | --------------------- | -------- | -------------------------- |
| 1   | 静态代码扫描          | 自动化   | 无 Critical/High 漏洞      |
| 2   | 依赖漏洞扫描          | 自动化   | 无已知 CVE（Critical）     |
| 3   | Sandbox 逃逸测试      | 安全团队 | 无逃逸路径                 |
| 4   | Prompt Injection 测试 | 安全团队 | 注入防护有效               |
| 5   | 数据泄露测试          | 安全团队 | 无 PII/凭证泄露            |
| 6   | 风险画像一致性        | 平台团队 | RiskProfile 与实际行为匹配 |
| 7   | 跨域策略合规          | 安全团队 | DataFlowRule 执行正确      |
| 8   | 合规性审查(§23)       | 合规团队 | 满足行业监管要求           |

**Gate 3 检查清单**：

- [ ] 所有安全扫描通过
- [ ] Prompt Injection 防护覆盖率 100%
- [ ] 风险画像评审记录已归档
- [ ] CertificationRecord 已签发
- [ ] 合规团队无阻断意见
- [ ] **垂直域专项**：量化交易域完成盘前风控压力测试；金融服务域完成 AML 检测覆盖率验证；法务域完成特权分类准确性测试；财务域完成职责分离强制检查；医疗健康域完成医师审核覆盖率验证；内容审核域完成 CSAM 上报时效测试；人力资源域完成招聘偏见审计；IT 运维域完成爆炸半径限制验证；在线直播域完成实时审核延迟压测

## 38.5 Phase 4：灰度上线

**目标**：通过渐进式灰度发布，确保生产环境稳定。

**灰度策略**：

```text
Day 1-2     Day 3-5     Day 6-7     Day 8+
Canary 1%   Canary 10%  Canary 50%  GA 100%
┌─────┐    ┌──────┐    ┌──────┐    ┌──────┐
│ 内部 │───▶│ 小范围│───▶│ 半量 │───▶│ 全量 │
│ 测试 │    │ 真实  │    │ 真实 │    │ 发布 │
└─────┘    └──────┘    └──────┘    └──────┘
   ▲           ▲           ▲           ▲
   │           │           │           │
  手动验证    自动指标    自动指标    SLO 达标
  + eval     + eval     + eval     确认
```

**每阶段自动检查**：

| 指标              | 阈值                   | 不达标动作          |
| ----------------- | ---------------------- | ------------------- |
| Error rate        | < 1%                   | 自动回滚            |
| P95 latency       | < domain SLO           | 告警 + 人工决策     |
| Eval quality      | ≥ acceptance_threshold | 自动回滚            |
| Token cost        | < budget × (canary%)   | 告警 + 人工决策     |
| 用户反馈 negative | < 5%                   | 暂停灰度 + 人工评审 |

**Gate 4（GA 准入）检查清单**：

- [ ] Canary 7 天无 P0/P1 Incident
- [ ] 所有 SLO 指标达标
- [ ] Eval 质量不低于 Gate 2 基线
- [ ] Token 成本在预算范围内
- [ ] 监控 Dashboard 已配置并告警已路由
- [ ] Runbook（故障处理手册）已编写并交付 SRE
- [ ] Domain Owner 签署 GA 确认

## 38.6 接入后持续运营

业务域上线后进入**持续运营模式**，平台自动执行以下周期性活动：

| 活动                  | 频率                | 负责方                    | 触发条件             |
| --------------------- | ------------------- | ------------------------- | -------------------- |
| Eval 回归测试         | 每日                | 自动                      | 定时 + Prompt 变更后 |
| 成本报表              | 每周                | 自动 → domain_owner       | 定时                 |
| SLO 报告              | 每月                | 自动 → domain_owner + SRE | 定时                 |
| 安全扫描              | 每月                | 自动                      | 定时 + 依赖更新时    |
| DomainDescriptor 审查 | 每季度              | 业务方 + 平台             | 定时                 |
| 知识源时效性检查      | 按 freshness_policy | 自动                      | 持续                 |
| 跨域策略审查          | 每季度              | 安全团队                  | 定时 + 新域接入时    |

---

# Part IV — 垂直业务域深化层（§71-§94）

---

# 71. 量化交易域架构

> 关联：§37 业务域建模 · §30 Business Pack · §10 风险控制 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §1

**DomainDescriptor 映射**：

- `domain_id`: `quant-trading` · `recipe_archetype`: Trading + Realtime
- `risk_level`: Critical · `latency_tier`: ultra_low（执行路径 <10ms）
- `hitl_intensity`: High · `regulatory_density`: Critical（证监会/SEC/MiFID II）

**核心 Agent 角色**：信号生成 · 回测 · 执行 · 风险管理 · 组合优化

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | ------------------------ |
| `tool.order.submit` | 60 | 95 | 强制盘前风控+仓位限额检查 |
| `tool.strategy.deploy` | 50 | 90 | 人工审批 + 回测验证 |
| `tool.risk_limit.modify` | 50 | 95 | domain_owner + 风控经理双审批 |
| `tool.market_data.read` | 20 | 20 | 自动执行 |

**DomainEvalFramework**：Sharpe Ratio ≥ 阈值 · 最大回撤 ≤ 限额 · Implementation Shortfall · 风控限额遵从率 · 系统可用性 99.99%

**DomainKnowledgeSchema**：行情数据实时 API · 风控参数结构化查询 · 策略配置版本化 · 冲突策略 source_priority（交易所 > 备用源）

**HITL 策略**：策略上线/风控限额变更/资金分配变更强制人工审批；实时盈亏仪表盘 + 一键 kill-switch；盘后合规审查每日签字

**关键护栏**：盘前合理性检查（最大单量/最大名义金额/速率限制）· 硬性仓位限额不可由 Agent 覆盖 · 数据源陈旧 >N 秒自动平仓 · 熔断器

**Agent 工作流（详细）**：

- 信号生成 Agent：数据摄入 → 特征工程 → 模型推理 → 信号排序 → 风控过滤 → 订单生成
- 回测 Agent：策略定义 → 历史回放 → 模拟成交（含滑点/手续费）→ 绩效报告
- 执行 Agent：目标组合 → 执行计划（TWAP/VWAP/IS）→ 跨交易所路由 → 成交监控 → 算法参数实时调整
- 风险管理 Agent：持续监控敞口（行业/因子/Greeks）→ 仓位限制 → 熔断 → VaR/CVaR → 追保通知
- 组合优化 Agent：均值方差/Black-Litterman/风险平价 → 约束（换手率/行业上限/ESG）

**关键工具/集成**：
| 类别 | 具体工具 |
| -------- | ---- |
| 行情数据 | Bloomberg B-PIPE, Refinitiv Elektron, Wind, CTP/FEMAS, IEX Cloud, Polygon.io |
| 交易执行 | FIX 4.2/4.4 网关, 券商 OMS/EMS API（IB/中信/华泰 PB）, DMA 直连 |
| 回测引擎 | Zipline, Backtrader, QuantConnect, 自研事件驱动引擎 |
| 风控 | RiskMetrics, Axioma, Barra 因子模型, 内部 VaR 引擎 |
| 基础设施 | KDB+/q 时序数据库, Redis, Kafka, FPGA/内核旁路 |

**数据敏感度分级**：

- 极度机密：交易策略、alpha 信号、持仓、盈亏（核心 IP）
- 机密：回测结果、风控参数、客户组合配置
- 内部：行情数据（许可证限制再分发）、执行分析

**性能/延迟预算**：

- 行情处理：HFT <1ms tick-to-signal；中频 <100ms
- 下单：个位数微秒（FPGA）到低毫秒级
- 风控检查：盘前检查 <50μs 附加延迟
- 回测：数年 Tick 数据分钟级回放（并行化）
- 可用性：交易时段 99.99%

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 数据源损坏/延迟 | 切换备用源、陈旧数据检测、缺口 >N秒 自动平仓 |
| 策略产生极端信号 | 盘前合理性检查、熔断器 |
| 执行场所断连 | 自动路由备用场所、订单排队、通知人工 |
| 风控限额突破 | 立即平仓、禁用策略、通知风控经理 |
| 模型过拟合 | 在线监控信号衰减、自动降低权重、regime 检测 |

---

# 72. 电商域架构

> 关联：§37 业务域建模 · §30 Business Pack · §21 HITL · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §2

**DomainDescriptor 映射**：

- `domain_id`: `ecommerce` · `recipe_archetype`: CRUD-heavy + Realtime
- `risk_level`: High · `latency_tier`: realtime（搜索/推荐 <200ms，风控 <500ms）
- `hitl_intensity`: Medium · `regulatory_density`: Medium（电商法/消保法/PCI-DSS）

**核心 Agent 角色**：商品上架 · 定价 · 库存履约 · 客服 · 推荐 · 交易风控

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ----------------------- | ------------- | ----------- | --------------------- |
| `tool.price.update` | 40 | 80 | 超阈值变动人工审批 |
| `tool.refund.issue` | 50 | 70 | 超金额阈值人工审批 |
| `tool.listing.publish` | 30 | 60 | 管控品类人工审核 |
| `tool.inventory.sync` | 30 | 30 | 自动执行 |

**DomainEvalFramework**：GMV · 转化率 · CSAT/NPS · 库存周转率 · 风控精确率/召回率 · 推荐 CTR

**HITL 策略**：价格变动 >X% 人工审批 · 超阈值退款人工审批 · 管控品类上架审核 · 客服前 N 次回复训练期审核

**关键护栏**：底价约束（防止定价 ¥0.01）· 库存安全缓冲 · 客服回复基于政策检索（防止幻觉承诺）· 多 PSP 支付切换

**Agent 工作流（详细）**：

- 商品上架 Agent：生成描述 → 标题 SEO → 分类 → 图片属性提取 → 多平台上架（天猫/京东/Amazon）
- 定价 Agent：竞品监控 → 动态定价模型（弹性/库存/利润）→ 降价/促销执行
- 库存履约 Agent：需求预测 → 补货触发 → 仓库分配 → 三方物流协调 → 拆包发货
- 客服 Agent：售前咨询 → 售后处理 → 复杂案例升级 → 回复模板生成
- 推荐 Agent：用户画像 → 协同过滤/混合模型 → 个性化 → A/B 测试
- 风控 Agent：实时评分（速率/设备/地址）→ 可疑订单标记 → 拒付争议

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 平台 | Shopify API, 天猫/淘宝开放平台, 京东开普勒, Amazon SP-API, 拼多多 |
| 支付 | 支付宝, 微信支付, Stripe, PayPal, Adyen |
| 物流 | 顺丰 API, 菜鸟, FedEx/UPS/DHL, WMS（Manhattan, Blue Yonder） |
| 搜索/推荐 | Elasticsearch, Algolia, Pinecone, TensorFlow Recommenders |
| CRM | Salesforce, HubSpot, 有赞, 微盟 |

**数据敏感度分级**：

- PII（高）：客户姓名、地址、手机号、支付信息（PCI-DSS 范围）
- 机密：定价策略、供应商成本、利润数据、库存水位
- 内部：商品目录、聚合销售数据、A/B 测试结果

**性能/延迟预算**：

- 搜索/推荐：p99 <200ms
- 价格更新：竞争响应 <5分钟，计划促销批量
- 风控评分：每笔交易 <500ms（同步结账）
- 客服：聊天首次响应 <3s，工单 <2h
- 库存同步：多渠道 <1分钟

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 价格机器人战 | 底价约束、利润护栏、阈值人工告警 |
| 库存同步延迟致超卖 | 预留库存管理、安全库存缓冲、自动补偿 |
| 客服 Agent 幻觉政策 | 基于政策检索的接地生成、强制引用政策文件 |
| 推荐冷启动 | 热门商品兜底、人口统计默认值、偏好收集 |
| 支付网关故障 | 多 PSP 切换、排队重试、客户通知 |

---

# 73. 广告推广域架构

> 关联：§37 业务域建模 · §18 成本管理 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §3

**DomainDescriptor 映射**：

- `domain_id`: `advertising` · `recipe_archetype`: Creative + Analytics
- `risk_level`: Medium · `latency_tier`: near_realtime（竞价 <100ms，报告 15min 延迟可接受）
- `hitl_intensity`: Medium · `regulatory_density`: Medium（广告法/平台政策/GDPR 跟踪同意）

**核心 Agent 角色**：投放规划 · 创意生成 · 竞价优化 · 受众管理 · 归因报告

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.launch` | 40 | 75 | 预算承诺 + 创意审批 |
| `tool.bid.adjust` | 30 | 50 | 超预算阈值人工审批 |
| `tool.creative.publish` | 30 | 70 | 品牌/法务审核后才可上线 |
| `tool.audience.create` | 20 | 50 | 敏感属性定向需隐私审核 |

**DomainEvalFramework**：ROAS · CPA · CTR · 品牌提升 · 预算节奏准确性 · 创意质量分 · 归因准确性

**HITL 策略**：投放启动审批（预算承诺）· 创意上线前品牌/法务审核 · 敏感品类受众定向审核 · 预算增加 >X% 审批

**关键护栏**：硬性每日/每小时预算上限 · 提交前合规检查（广告法绝对化用语检测）· 自动受众扩展兜底 · 频次上限强制

**Agent 工作流（详细）**：

- 投放规划 Agent：商业目标分析 → 媒介计划（渠道/预算/排期/定向）
- 创意生成 Agent：平台规格适配（抖音竖版/朋友圈卡片/Google 自适应）→ A/B 变体
- 竞价优化 Agent：跨 DSP 实时竞价 → 转化概率/预算节奏/竞争调整 → 目标 CPA/ROAS
- 受众管理 Agent：一方/二方/三方数据构建分群 → Lookalike → 频次上限 → 跨设备打通
- 归因与报告 Agent：跨触点转化收集 → 多触点归因（Shapley/Markov）→ 效果看板

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 广告平台 | Google Ads, Meta Marketing, 巨量引擎, 腾讯广告, 百度营销, 快手磁力 |
| DSP | The Trade Desk, DV360, MediaMath |
| 创意 | Canva API, Figma API, Midjourney/DALL-E, RunwayML |
| 分析 | Google Analytics, Adobe Analytics, AppsFlyer/Adjust |
| 品牌安全 | IAS, DoubleVerify, MOAT |

**数据敏感度分级**：

- PII（高）：客户邮件列表、CRM 数据、设备 ID
- 机密：投放效果、竞价策略、获客成本、创意测试结果
- 内部：聚合触达/频次数据、市场基准

**性能/延迟预算**：

- 竞价决策：RTB <100ms
- 投放调整：每小时预算节奏、每日出价优化
- 创意生成：文案分钟级、图片/视频小时级（异步）
- 报告：准实时看板 15分钟延迟

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 竞价错误致预算超支 | 硬性每日/每小时预算上限、实时支出监控自动暂停 |
| 创意被平台拒绝 | 提交前合规检查 Agent、已审核通过模板库 |
| 受众过窄无法投放 | 自动受众扩展触发、Lookalike 兜底 |
| 归因数据丢失 | 模型化转化、MMM 备份 |
| 广告疲劳 | 自动创意轮换、频次上限强制、刷新触发器 |

---

# 74. 金融服务域架构

> 关联：§37 业务域建模 · §23 合规 · §49 合规策略引擎 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §4

**DomainDescriptor 映射**：

- `domain_id`: `financial-services` · `recipe_archetype`: Compliance + Trading
- `risk_level`: Critical · `latency_tier`: realtime~batch（欺诈 <200ms，KYC <30s，监管报表批处理）
- `hitl_intensity`: Critical · `regulatory_density`: Critical（Basel III/反洗钱法/偿二代/EU AI Act）

**核心 Agent 角色**：信贷评估 · KYC/AML · 保险承保 · 理赔处理 · 监管报表

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.credit.approve` | 50 | 95 | 超阈值强制人工审批 + 可解释性 |
| `tool.sar.submit` | 50 | 95 | 法律要求人工审核 |
| `tool.claim.adjudicate` | 50 | 80 | 超自动裁决限额人工审核 |
| `tool.model.deploy` | 50 | 90 | 公平性测试 + 人工审批 |

**DomainEvalFramework**：基尼系数/KS 统计量 · SAR 质量（监管反馈）· 赔付率/综合成本率 · 模型稳定性（PSI）· 监管检查发现数

**HITL 策略**：超阈值贷款审批强制 · SAR/STR 报告法律要求人工审核 · 模型部署/重训强制审批 · 不利信贷决策必须可复查 · 许多辖区要求"有意义的人工参与"

**关键护栏**：公平性测试（差异影响分析）· PSI 监控自动回退 · 对账检查 + 数据血缘追踪 · 多因素 KYC 验证

**Agent 工作流（详细）**：

- 信贷评估 Agent：申请人数据收集 → 评分卡/ML 评分 → 审批建议+解释 → 贷款条款结构化
- KYC/AML Agent：证件 OCR+活体检测 → 制裁名单筛查（OFAC/UN/EU）→ 可疑交易监控 → SAR/STR 报告
- 保险承保 Agent：风险因子分析 → 保单定价 → 除外责任 → 保单文件生成
- 理赔处理 Agent：申请接收 → 保障验证 → 欺诈检测 → 赔付估算 → 路由审核或自动审批
- 监管报表 Agent：跨系统汇总 → 报表生成（Basel III/CCAR）→ 完整性验证 → 提交

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 征信 | 人行征信, Experian, Equifax, TransUnion, 百行征信 |
| 制裁/AML | World-Check, Dow Jones, OFAC SDN, Chainalysis |
| 文档处理 | ABBYY, Tesseract OCR, AWS Textract |
| 核心银行 | Temenos, FIS, 长亮科技, 中电金信 |
| 保险平台 | Guidewire, Duck Creek, 中科软 |

**数据敏感度分级**：

- 极度敏感（PII+金融）：身份证号/SSN、银行账号、征信报告、医疗记录（保险）、纳税申报
- 机密：风控模型、定价算法、持仓信息、客户名单
- 受监管：所有交易数据留存 5-7 年

**性能/延迟预算**：

- 欺诈评分：<200ms · 信用预审：<5s
- KYC 验证：自动 <30s，增强尽职调查 <24h
- 理赔处理：简单自动裁决 <1min，复杂含人工 <48h
- 监管报表：批处理，严格截止（T+1 或月度）

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 模型漂移致不良信贷 | PSI 监控、冠军-挑战者测试、自动回退 |
| AML 误报过载 | 基于风险优先排序、反馈循环优化、分层审查 |
| 监管报表数据不一致 | 对账检查、数据血缘追踪、提交前验证 |
| 部署有偏见模型 | 部署前公平性测试、按受保护群体持续监控 |
| KYC 证件伪造 | 多因素验证、活体检测、政府数据库交叉比对 |

---

# 75. 数据处理域架构

> 关联：§37 业务域建模 · §29 Knowledge/Memory · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §5

**DomainDescriptor 映射**：

- `domain_id`: `data-engineering` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: sla_driven（批处理 SLA 驱动，流处理亚秒级）
- `hitl_intensity`: Medium · `regulatory_density`: Medium（数据治理/GDPR 删除权/数据驻留）

**核心 Agent 角色**：管线编排 · 数据质量 · Schema 管理 · 数据血缘 · 异常检测

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --------------------------- | ------------- | ----------- | -------------------------- |
| `tool.schema.migrate` | 50 | 85 | 破坏性变更强制人工审批 |
| `tool.pipeline.deploy_prod` | 50 | 75 | 首次生产运行前审核代码 |
| `tool.data.delete` | 60 | 90 | 数据删除请求强制审批 |
| `tool.pipeline.retry` | 20 | 20 | 自动执行（幂等保证） |

**DomainEvalFramework**：SLA 达成率 · 数据质量检查通过率 · 管线生成正确率 · 计算成本趋势 · 血缘覆盖率

**HITL 策略**：Schema 迁移审批（破坏性变更）· 生产管线部署 · 数据删除请求 · 敏感数据集访问授权

**关键护栏**：Schema 漂移检测 · 幂等写入模式 · 预算告警 + 执行前查询成本估算 · 敏感数据最小化访问

**Agent 工作流（详细）**：

- 管线编排 Agent：自然语言需求 → DAG 生成（Airflow/Dagster）→ 调度/重试/依赖管理
- 数据质量 Agent：入站 Profiling → 校验规则（Schema/范围/唯一性/引用完整性）→ 坏记录隔离 → 质量报告
- Schema 管理 Agent：源系统变更检测 → 迁移脚本 → 下游影响评估 → Schema 注册中心
- 数据血缘 Agent：源头到消费追踪 → 血缘图谱 → 影响分析 → 审计追踪
- 异常检测 Agent：数据量/新鲜度/分布漂移/管线延迟监控 → 根因告警

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 编排 | Apache Airflow, Dagster, Prefect, dbt, Luigi |
| 流处理 | Kafka, Flink, Spark Structured Streaming, Pulsar |
| 存储 | Snowflake, Databricks, BigQuery, Delta Lake, Iceberg |
| 质量 | Great Expectations, dbt tests, Monte Carlo, Soda |
| 目录/血缘 | Apache Atlas, DataHub, Amundsen, OpenLineage |

**数据敏感度分级**：

- 高：PII 列（须脱敏/令牌化）、金融数据、健康数据
- 中：业务指标、运营数据
- 低：公开数据集、参考数据
- Agent 需访问元数据，应最小化对实际敏感数据的访问

**性能/延迟预算**：

- 批处理管线：SLA 驱动（如每日聚合早6点前就绪）
- 流处理：实时亚秒级，准实时秒级
- 数据质量检查：不增加 >10% 管线运行时间
- 血缘查询：影响分析 <5s
- Agent 响应：管线生成秒级，复杂优化分钟级

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 管线运行中失败 | 检查点、幂等操作、自动退避重试 |
| 源 Schema 变更中断 | 漂移检测、新增字段自动适配、破坏性变更人工审核 |
| 数据质量回退 | 自动隔离坏批次、回退最后良好数据、SLA 违规告警 |
| 成本失控 | 预算告警、扩缩容限制、查询成本估算 |
| 重试导致重复 | 幂等写入（upsert/去重键）、精确一次语义 |

---

# 76. 代码开发域架构

> 关联：§37 业务域建模 · §30 Business Pack · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §6
> 已有实例：`src/domains/coding/`

**DomainDescriptor 映射**：

- `domain_id`: `coding` · `recipe_archetype`: Creative + Adversarial
- `risk_level`: High · `latency_tier`: realtime（补全 <500ms，审查 <5min）
- `hitl_intensity`: High · `regulatory_density`: Low-Medium（许可证/SOC2/行业特定）

**核心 Agent 角色**：代码生成 · 代码审查 · 测试 · CI/CD · 安全扫描 · 调试

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ------------------------- | ------------- | ----------- | -------------------------- |
| `tool.code.merge` | 50 | 80 | 强制人工开发者审查 |
| `tool.deploy.production` | 60 | 90 | 人工审批 + 安全扫描通过 |
| `tool.code.generate` | 30 | 40 | 合并前必须人工审查 |
| `tool.security.fix` | 40 | 60 | 安全团队审批 |

**DomainEvalFramework**：生成代码测试通过率 · Bug 检测真阳性率 · 建议采纳率 · 漏洞检测率 · 许可证合规率

**HITL 策略**：所有生成代码合并前必须人工审查 · 生产部署需人工审批 · 安全漏洞修复决策 · 架构决策

**关键护栏**：预提交安全扫描 hook · 许可证合规检查 · 锁定依赖版本验证 · 范围受限上下文窗口

**Agent 工作流（详细）**：

- 代码生成 Agent：自然语言需求 → 理解代码库上下文 → 生成实现 + 测试
- 代码审查 Agent：PR 分析 → Bug/安全漏洞/风格/性能/架构问题 → 行级注释 + 修复建议
- 测试 Agent：单元/集成/E2E 测试生成 → 未测试路径识别 → 夹具和 Mock → 覆盖率目标
- CI/CD Agent：构建管线管理 → 失败解读 → 部署编排 → 功能开关 → 金丝雀分析
- 安全扫描 Agent：SAST/DAST/SCA → 分类 → 减少误报 → 修复建议 → 漏洞生命周期
- 调试 Agent：错误日志/堆栈追踪分析 → 根因假设 → 修复建议 → 测试环境复现

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 版本控制 | GitHub, GitLab, Bitbucket API |
| CI/CD | GitHub Actions, Jenkins, GitLab CI, CircleCI, ArgoCD |
| 安全 | Snyk, SonarQube, Semgrep, Trivy, Dependabot, CodeQL |
| 测试 | Jest, Pytest, JUnit, Playwright, Cypress, k6 |
| 代码分析 | Tree-sitter, Language Servers (LSP), ESLint, Ruff |
| 监控 | Sentry, Datadog, PagerDuty, Grafana |

**数据敏感度分级**：

- 极度敏感：源代码（核心 IP）、密钥/凭证、部署配置
- 机密：构建日志、安全扫描结果、架构图
- 内部：公开依赖信息、通用编码标准

**性能/延迟预算**：

- 代码补全：内联建议 <500ms（IDE 体验）
- 代码审查：典型 PR <5分钟（异步可接受）
- 测试生成：单函数秒级，模块分钟级
- 安全扫描：增量分钟级，全代码库小时级
- CI/CD：构建/测试不应被 Agent 瓶颈

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 生成代码无法编译 | 迭代修复循环：编译→解析错误→修复→重试（最多 N 次） |
| Agent 建议已弃用 API | 锁定依赖版本，验证实际安装包 API |
| 引入安全漏洞 | 预提交安全扫描 hook、敏感文件强制安全审查 |
| 测试不稳定 | 确定性测试模式、显式 Mock、重试检测标记 |
| 修改错误范围 | 范围受限上下文窗口、多文件变更确认提示 |

---

# 77. 用户运营域架构

> 关联：§37 业务域建模 · §23 合规（PIPL/GDPR）· §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §7

**DomainDescriptor 映射**：

- `domain_id`: `user-operations` · `recipe_archetype`: Analytics + CRUD-heavy
- `risk_level`: Medium · `latency_tier`: near_realtime（触发式活动 <5min，批量分群每日）
- `hitl_intensity`: Medium · `regulatory_density`: Medium（PIPL/GDPR/CAN-SPAM/TCPA）

**核心 Agent 角色**：分群 · 生命周期管理 · 流失预测 · 营销自动化 · 群组分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.campaign.send` | 30 | 60 | 活动内容审批 |
| `tool.segment.create` | 20 | 50 | 敏感属性分群需隐私审核 |
| `tool.notification.push` | 20 | 40 | 频次上限强制 |
| `tool.ab_test.launch` | 30 | 40 | A/B 测试启动审核 |

**DomainEvalFramework**：留存率（D1/D7/D30）· 流失率 · LTV/CAC 比率 · 活动打开率/CTR · NPS/CSAT

**HITL 策略**：活动内容审批 · 敏感属性新分群审核 · 通知频率策略变更 · 激励活动预算分配

**关键护栏**：频次上限强制 · 参与度评分门控 · 发送前分群大小验证 · 实时偏好中心同步 · 退出名单硬性强制

**Agent 工作流（详细）**：

- 分群 Agent：行为数据分析（事件/交易/互动）→ RFM/行为聚类/预测属性 → 动态分群
- 生命周期管理 Agent：获取→激活→留存→变现→推荐 → 阶段干预 → 个性化触点
- 流失预测 Agent：行为信号（参与度下降/工单/功能放弃）→ 流失模型 → 高风险列表 + 干预建议
- 营销自动化 Agent：多触点活动（Push/邮件/应用内/短信）→ 发送时间优化 → 频次上限
- 群组分析 Agent：获客渠道/时间/行为 → 留存曲线 → 高价值群组识别 → 洞察报告

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| CDP/分析 | Segment, Amplitude, Mixpanel, 神策数据, GrowingIO, 友盟 |
| 营销自动化 | Braze, CleverTap, 极光, 个推, Iterable |
| 通信 | Twilio（短信）, SendGrid（邮件）, APNs/FCM, 微信/企微 API |
| A/B 测试 | Optimizely, LaunchDarkly, Firebase Remote Config |
| 数据仓库 | Snowflake, BigQuery, ClickHouse |

**数据敏感度分级**：

- PII（高）：用户画像、联系方式、与可识别用户关联的行为数据
- 敏感行为：位置、健康/健身、金融行为、浏览历史
- 聚合（低）：群组级指标、匿名漏斗数据

**性能/延迟预算**：

- 分群更新：触发式 <5分钟延迟，批量每日
- 活动触发：实时事件到消息投递 <1分钟
- 流失预测：每日评分，高价值用户实时
- A/B 测试结果：统计显著性监控、每日报告

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 通知疲劳（退订激增） | 频次上限、参与度评分门控、自动冷静期 |
| 错误个性化 | 内容安全审查、回退通用消息、敏感话题检测 |
| 流失模型误报 | 分级干预（先低成本）、A/B 测试干预、反馈至模型 |
| 发送到错误分群 | 发送前分群大小验证、沙箱测试、渐进发布 |
| 未尊重退出偏好 | 实时偏好中心同步、发送层硬性退出强制 |

---

# 78. 行业调研域架构

> 关联：§37 业务域建模 · §29 Knowledge/Memory · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §8

**DomainDescriptor 映射**：

- `domain_id`: `industry-research` · `recipe_archetype`: Research + Analytics
- `risk_level`: Low · `latency_tier`: batch（报告小时~天级，突发告警 <15min）
- `hitl_intensity`: High · `regulatory_density`: Low（证券法/数据许可/版权）

**核心 Agent 角色**：市场分析 · 竞争情报 · 趋势预测 · 报告生成 · 监管追踪

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.report.publish` | 30 | 80 | 人工分析师审核后才可发布 |
| `tool.data.scrape` | 40 | 60 | 版权/许可合规检查 |
| `tool.forecast.generate` | 30 | 50 | 前瞻性声明须加免责声明 |
| `tool.alert.send` | 20 | 30 | 自动执行（低风险信息推送） |

**DomainEvalFramework**：事实正确率 · 来源引用率 · 洞察产出时间 · 相关来源覆盖率 · 分析师满意度

**HITL 策略**：所有发布研究必须人工分析师审核 · 定量声明必须引用来源 · 前瞻性声明必须加免责声明

**关键护栏**：所有定量声明强制来源引用 · 数据时间戳 + 新鲜度检查 · 改写比率监控（防版权侵犯）· 反面证据部分要求

**Agent 工作流（详细）**：

- 市场分析 Agent：多来源数据收集（金融数据库/新闻/统计/报告）→ 市场规模/增长/竞争格局 → 结构化报告
- 竞争情报 Agent：竞争对手活动监控（产品/定价/招聘/专利/监管）→ 竞品档案 → 变化告警
- 趋势预测 Agent：专利/论文/融资/社交/政策信号 → 新兴趋势识别 → 置信度前瞻
- 报告生成 Agent：发现→结构化报告（执行摘要/方法论/建议）→ 多格式 → 引用严谨
- 监管追踪 Agent：跨辖区监管变化 → 业务影响评估 → 合规差距分析 → 变更日历

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 数据源 | Wind, Bloomberg, Statista, IBISWorld, 国家统计局, Euromonitor |
| 新闻/媒体 | NewsAPI, GDELT, 财新/36kr API, 社交聆听 |
| 专利 | WIPO, USPTO, CNIPA, Google Patents |
| 财务报告 | SEC EDGAR, 巨潮资讯网, ExFact |
| NLP | 情感分析、NER、摘要生成 |

**数据敏感度分级**：

- 机密：专有研究发现、客户特定分析、竞争策略建议
- 授权许可：第三方数据（Bloomberg/Wind）许可证限制再分发
- 公开：政府统计、已公开报告、公开新闻

**性能/延迟预算**：

- 告警生成：突发新闻/监管变化 <15分钟
- 报告生成：小时到天级（异步），综合报告可能数小时
- 数据刷新：市场每日、竞争每周、深度每季度

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 幻觉统计数据 | 所有定量声明强制来源引用、验证 Agent 交叉检查 |
| 陈旧数据当现数据 | 所有数据点加时间戳、新鲜度检查、超阈值标记 |
| 版权侵犯 | 归因摘要、合理使用指南、改写比率监控 |
| 遗漏关键竞品 | 多来源交叉引用、缺口检测清单、人工范围审核 |
| 趋势识别偏见 | 反面证据要求、多视角 Prompting、不确定性量化 |

---

# 79. 学术调研域架构

> 关联：§37 业务域建模 · §29 Knowledge/Memory · §23 合规 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §9

**DomainDescriptor 映射**：

- `domain_id`: `academic-research` · `recipe_archetype`: Research
- `risk_level`: Low · `latency_tier`: batch（文献综述小时~天级，写作辅助实时）
- `hitl_intensity`: High · `regulatory_density`: Medium（研究伦理/发表伦理/数据法规）

**核心 Agent 角色**：文献综述 · 假设生成 · 实验设计 · 数据分析 · 写作与发表

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | -------------------------- |
| `tool.manuscript.submit` | 30 | 90 | 人工研究者完整审核 |
| `tool.citation.insert` | 10 | 70 | 每条引用必须 DOI 验证 |
| `tool.analysis.run` | 20 | 50 | 假设检查 + 人工统计师审核 |
| `tool.literature.search` | 10 | 10 | 自动执行 |

**DomainEvalFramework**：引用准确率 100%（零捏造）· 统计正确性 · 可复现性 · 文献覆盖率 · 写作质量

**HITL 策略**：所有发表内容必须人工研究者审核 · 假设选择/实验设计审批 · 统计方法选择 · 研究者必须承担知识产权

**关键护栏**：每条引用自动 DOI/数据库验证 · 查重工具集成 · 假设检查 Agent 层 · 隔离处理环境（防数据泄露）

**Agent 工作流（详细）**：

- 文献综述 Agent：学术数据库搜索（Semantic Scholar/PubMed/CNKI/arXiv）→ 排序 → 关键发现提取 → 研究空白 → 规范引用管理
- 假设生成 Agent：跨论文发现分析 → 矛盾/未探索交叉 → 可检验假设 + 实验方法建议
- 实验设计 Agent：样本量计算 → 对照组 → 统计检验 → 混淆变量 → 预注册文档
- 数据分析 Agent：统计分析（回归/ANOVA/生存分析）→ 可视化 → 常见错误检查（p-hacking/多重比较）
- 写作与发表 Agent：期刊排版 → 摘要生成 → 参考文献（BibTeX/EndNote）→ 投稿包

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 学术数据库 | Semantic Scholar, PubMed/MEDLINE, arXiv, CNKI, Web of Science, Scopus |
| 引用管理 | Zotero, Mendeley, EndNote |
| 数据分析 | R, Python（scipy/statsmodels/pandas）, SPSS, Stata |
| LaTeX | Overleaf API, LaTeX 编译工具链 |
| 可复现性 | Jupyter, R Markdown, Docker, DVC, MLflow |
| 预注册 | OSF, AsPredicted |

**数据敏感度分级**：

- 高：人体受试者数据（IRB）、患者数据（HIPAA）、未发表成果、基金申请书
- 中：预发表稿件、初步结果、同行评审意见
- 低：已发表论文、公开数据集

**性能/延迟预算**：

- 文献搜索：初始 <30s，全面检索分钟级
- 统计分析：秒到分钟级
- 写作辅助：实时或准实时
- 完整文献综述：小时到天级（异步）

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 引用捏造 | 每条引用自动 DOI/数据库验证 |
| 统计方法误用 | 假设检查层、诊断测试、人工统计师审核 |
| 生成文本抄袭 | 集成查重（Turnitin/iThenticate）、原创性评分 |
| 遗漏相关文献 | 多数据库搜索、引用链追踪、专家覆盖审核 |
| 未发表成果泄露 | 严格访问控制、隔离处理环境 |

---

# 80. 企业知识库域架构

> 关联：§37 业务域建模 · §50 知识域隔离 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §10

**DomainDescriptor 映射**：

- `domain_id`: `knowledge-base` · `recipe_archetype`: CRUD-heavy
- `risk_level`: Medium · `latency_tier`: realtime（搜索 <2s，综合答案 <5s）
- `hitl_intensity`: Medium · `regulatory_density`: Medium（数据留存/访问控制/隐私）

**核心 Agent 角色**：文档处理 · 知识图谱 · 语义搜索 · FAQ 生成 · 知识缺口分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| ---------------------------- | ------------- | ----------- | -------------------------- |
| `tool.search.query` | 10 | 40 | 查询时实时访问权限检查 |
| `tool.document.ingest` | 20 | 50 | 新文档源接入需审批 |
| `tool.answer.synthesize` | 20 | 60 | 低置信度回答"我不知道" |
| `tool.content.retire` | 30 | 70 | 内容退役需 domain_owner 决策 |

**DomainEvalFramework**：MRR/NDCG/precision@k · 答案忠实度 · 引用准确性 · 覆盖率 · 零未授权访问事件

**HITL 策略**：访问控制策略定义 · 敏感文档分级 · Agent 回答错误时纠错 · 内容退役决策

**关键护栏**：源系统权限镜像 + 查询时访问检查 · 强制引用可验证链接 · 文档新鲜度追踪 + 陈旧告警 · 层次化分块

**Agent 工作流（详细）**：

- 文档处理 Agent：多格式摄入（PDF/Word/PPT/Confluence/邮件/会议纪要）→ 结构化提取 → 分块 → 元数据维护
- 知识图谱 Agent：NLP 实体/关系提取 → 图谱构建（人物/项目/技术/流程）→ 歧义解决 → 跨域关联
- 语义搜索 Agent：自然语言查询 → 混合搜索（关键词+向量）→ 重排序 → 带引用综合答案
- FAQ 生成 Agent：高频问题识别（工单/聊天/搜索）→ FAQ 生成维护 → 过时检测
- 知识缺口分析 Agent：未文档化流程 → 陈旧内容 → 矛盾 → 持续无法匹配的查询

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 文档源 | Confluence, SharePoint, Google Drive, Notion, 飞书, 钉钉 |
| 向量数据库 | Pinecone, Weaviate, Milvus, Qdrant, pgvector |
| 知识图谱 | Neo4j, Amazon Neptune, TigerGraph |
| 嵌入模型 | OpenAI Embeddings, BGE, Cohere Embed, Jina |
| 文档解析 | Unstructured.io, LlamaParse, Adobe PDF Services |
| 搜索引擎 | Elasticsearch, OpenSearch, Typesense |

**数据敏感度分级**：

- 极度机密：高管战略文档、并购材料、人事档案、法律意见
- 机密：内部政策、技术架构、项目文档、财务数据
- 内部：通用流程、培训材料、产品文档
- 必须实现与源系统权限一致的文档级访问控制

**性能/延迟预算**：

- 搜索/查询：结果 <2s，LLM 综合答案 <5s
- 文档摄入：分钟到小时级（批处理可接受）
- 知识图谱更新：关键文档准实时，通用每日批量
- 可用性：工作时间 99.9%

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 搜索泄露机密 | 源系统权限镜像、查询时访问检查、审计日志 |
| 幻觉答案 | 强制引用链接、忠实度评分、低置信度回答"我不知道" |
| 返回陈旧内容 | 新鲜度追踪、自动陈旧告警、弃用工作流 |
| 分块质量差 | 层次化分块带重叠、父子检索、元数据丰富 |
| 知识图谱不一致 | 冲突检测、来源追踪、人工仲裁工作流 |

---

# 81. 财务域架构

> 关联：§37 业务域建模 · §23 合规 · §49 合规策略引擎 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §11

**DomainDescriptor 映射**：

- `domain_id`: `finance-accounting` · `recipe_archetype`: Compliance + CRUD-heavy
- `risk_level`: Critical · `latency_tier`: batch（月结窗口驱动，即席查询 <30s）
- `hitl_intensity`: Critical · `regulatory_density`: Critical（CAS/US GAAP/SOX/金税四期/IFRS）

**核心 Agent 角色**：发票处理 · 费控 · 财务报告 · 税务合规 · 对账 · 预算预测

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | ---------------------------- |
| `tool.journal.post` | 50 | 85 | 超阈值凭证强制审批 |
| `tool.financial.signoff` | 50 | 95 | CFO/财务总监签字 |
| `tool.tax.file` | 50 | 95 | 税务申报提交强制人工审批 |
| `tool.invoice.process` | 30 | 50 | 三单匹配通过后自动过账 |

**DomainEvalFramework**：直通处理率 · GL 过账准确率 · 对账匹配率 · 月结天数 · 审计发现数 · 职责分离违规数

**HITL 策略**：超阈值记账凭证审批 · 财务报表签字（CFO/Controller）· 税务申报提交 · 坏账核销 · SOX 要求文档化审核 · 职责分离强制

**关键护栏**：OCR 置信度评分 + 低于阈值人工审核 · 三单匹配验证 · 重复付款检测 · 汇率源验证（央行/ECB）· 期末截止规则

**Agent 工作流（详细）**：

- 发票处理 Agent：接收（邮件/扫描/电子发票）→ OCR → 三单匹配 → 审批路由 → ERP 过账
- 费控 Agent：报销单政策合规审核 → 异常标记 → 合规内自动审批 → 异常人工路由
- 财务报告 Agent：子账簿汇总 → 合并（多实体/多币种）→ 三表生成 → 差异分析
- 税务合规 Agent：税务负债计算（增值税/所得税/代扣）→ 纳税申报 → 转让定价文档
- 对账 Agent：跨系统匹配（银行 vs 总账/公司间/子账簿）→ 差异识别 → 解决建议
- 预算与预测 Agent：历史+驱动因素 → 预测 → 情景分析 → 预算 vs 实际 → 滚动预测

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| ERP | SAP S/4HANA, Oracle ERP Cloud, 用友 U8/NC, 金蝶 K/3/Cloud |
| 费控 | SAP Concur, Expensify, Ramp |
| 税务 | Thomson Reuters ONESOURCE, Avalara, 航天信息（金税系统） |
| 银行 | 银行 API（PSD2/Open Banking）, SWIFT, 银企直连 |
| OCR | ABBYY, Kofax, 百度AI/腾讯AI OCR |
| BI | Tableau, Power BI, 帆软 FineReport |

**数据敏感度分级**：

- 极度机密：未公开财务结果、高管薪酬、并购估值、税务头寸
- 机密：总账数据、供应商合同、员工报销、银行账户
- 受监管：所有财务记录 SOX/审计留存（7-10年）

**性能/延迟预算**：

- 发票处理：OCR+匹配 <1min，当日过账
- 月结：目标 3-5 天（从 10+天缩短），批处理在月结窗口内完成
- 税务申报：严格监管截止（中国增值税每月15日前）
- 对账：银行每日，其他每月
- 报告：即席 <30s，定时报表批处理窗口内

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| OCR 误读发票金额 | 置信度评分+低阈值人工审核、三单匹配验证 |
| 会计期间归属错误 | 期末截止规则、与采购/交货日期验证、反向记账 |
| 合并汇率错误 | 汇率源验证（央行/ECB）、折算与重新计量对账 |
| 税款计算错误 | 多方法验证、上期比较、税率表验证 |
| 重复付款 | 重复检测（供应商+金额+日期+发票号）、审批工作流 |

---

# 82. 法务域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §12

**DomainDescriptor 映射**：

- `domain_id`: `legal` · `recipe_archetype`: Compliance + Adversarial
- `risk_level`: Critical · `latency_tier`: batch（合同审查 <1h，电子发现吞吐量优先）
- `hitl_intensity`: **最高**（所有输出必须经执业律师审核）· `regulatory_density`: Critical（民法典/反垄断法/GDPR/职业伦理）

**核心 Agent 角色**：合同审查 · 监管合规 · 诉讼支持 · 知识产权管理 · 尽职调查 · 政策起草

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| -------------------------- | ------------- | ----------- | ------------------------------ |
| `tool.contract.review` | 30 | 80 | 所有结果必须律师审核 |
| `tool.legal_opinion.draft` | 50 | 99 | 绝不自动外发，强制律师审核 |
| `tool.ediscovery.classify` | 40 | 85 | 特权判定强制人工审核 |
| `tool.ip.search` | 20 | 30 | 自动执行（辅助信息收集） |

**DomainEvalFramework**：风险条款检测召回率（必须捕获所有）· 判例引用准确性 · 电子发现召回率 · 审查时间缩减 · 截止日期遵从

**HITL 策略**：**所有法律输出在被采取行动前必须经执业律师审核**——本域 HITL 要求为 24 域最高（与医疗健康域并列）。合同谈判 · 诉讼策略 · 监管申报 · 法律意见 · 特权判定全部强制人工。Agent 只提供"法律信息"而非"法律意见"。

**关键护栏**：保守策略（标记所有异常内容）· 判例引用必须法律数据库验证 · 多因素特权检测 · 显式辖区标注 · 监管日历 + 多源冗余告警

**Agent 工作流（详细）**：

- 合同审查 Agent：逐条 vs 标准条款手册 → 偏离识别 → 风险标记（无限责任/不利赔偿/自动续约）→ 谈判建议 → 红线标注
- 监管合规 Agent：跨辖区法规变化监控 → 法规→业务流程映射 → 差距分析 → 整改追踪
- 诉讼支持 Agent：电子发现文档审查 → 相关性/特权分类 → 案件时间线 → 法律研究
- IP 管理 Agent：商标/专利监控 → 续期追踪 → FTO 检索 → 侵权识别 → 组合管理
- 尽职调查 Agent：目标公司文件审查 → 关键条款提取 → 负债/或有事项 → 危险信号
- 政策起草 Agent：辖区要求 → 隐私政策/ToS/合规政策 → 版本管理

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 合同管理 | DocuSign CLM, Ironclad, 法大大, 上上签, Icertis |
| 法律研究 | Westlaw, LexisNexis, 北大法宝, 威科先行 |
| 电子发现 | Relativity, Nuix, Logikcull, DISCO |
| 知识产权 | Thomson Reuters IP, MaxVal, 国家知识产权局 |
| 合规 | OneTrust, LogicGate, SAI360 |

**数据敏感度分级**：

- 律师-客户特权：法律意见、诉讼策略、和解讨论——最高保护
- 极度机密：并购文件、监管调查、IP 商业秘密、劳动争议
- 机密：标准合同、政策、合规记录
- 受监管：法院文书（部分公开）、监管提交

**性能/延迟预算**：

- 合同审查：标准 <1h，复杂多方 <24h
- 监管监控：每日扫描，关键变化实时告警
- 电子发现：每小时数千文档（吞吐量 > 延迟）
- 法律研究：初始判例 <30s，完整备忘录分钟级

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 遗漏关键合同条款 | 标记所有异常、全面条款手册、所有合同人工审核 |
| 捏造判例引用 | 强制法律数据库验证、绝不呈现未验证引用 |
| 特权分类错误 | 多因素检测、所有特权判定人工审核 |
| 辖区不匹配 | 显式标注辖区、辖区专属条款手册、冲突标记 |
| 错过法规变更 | 多源监控、冗余告警、带人工责任的监管日历 |

---

# 83. 在线直播域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §13

**DomainDescriptor 映射**：

- `domain_id`: `live-streaming` · `recipe_archetype`: Realtime + Moderation
- `risk_level`: High · `latency_tier`: realtime（推流 <1s，弹幕审核 <200ms）
- `hitl_intensity`: **高**（涉政/涉恐审核，直播带货违规处置）· `regulatory_density`: High（互联网直播服务管理规定/未成年人保护法/广告法）

**核心 Agent 角色**：直播编排 · 互动运营 · 实时内容审核 · 电商转化 · 数据分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.stream.publish` | 25 | 60 | 推流前需校验主播资质与内容标签 |
| `tool.moderation.realtime` | 40 | 95 | 涉政/涉恐/涉未成年人内容即时断流，强制人工复核 |
| `tool.commerce.shelf` | 30 | 70 | 商品上架需合规校验，违禁品自动拦截 |
| `tool.danmaku.filter` | 20 | 50 | 敏感词实时过滤，边缘case人工抽检 |

**DomainEvalFramework**：违规检出率（涉政/涉黄/涉未成年人零漏放）· 误报率（<2%避免误伤正常内容）· 处置延迟（断流 <3s）· GPM（千次观看成交额）· 推流成功率

**HITL 策略**：涉政/涉恐/涉未成年人内容强制人工审核后方可恢复直播流；直播带货违规处置需运营确认；大型活动开播前预审强制人工签核。Agent 承担实时初筛与编排调度，最终处置决定权归属审核运营团队。

**关键护栏**：多模态实时审核流水线（音频+视频+文字并行）· 未成年人保护时段硬限制 · 敏感时期自动提升审核等级 · 断流熔断机制（误判可快速恢复）· 电商合规双重校验（平台规则+广告法）

**Agent 工作流（详细）**：

- 直播编排 Agent：推流初始化 → 多平台分发（抖音/快手/B站/视频号）→ 转码配置 → CDN 调度 → 质量监控 → 回放生成
- 互动运营 Agent：弹幕情感分析 → 互动玩法（红包/答题/投票/连麦）→ 热度曲线调节 → 粉丝等级体系
- 实时审核 Agent：多模态流采样（视频/音频/弹幕）→ AI 分类 → 风险评分 → 处置（警告/禁言/断流）
- 直播电商 Agent：商品上下架节奏 → 优惠券时机 → 库存锁定 → 实时销售看板 → 促销动态调整
- 数据分析 Agent：实时指标追踪（在线/互动/转化/礼物/GPM）→ 复盘报告 → 历史对比 → 优化建议

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 直播平台 | 抖音/快手/B站/视频号/淘宝直播/YouTube Live/Twitch API |
| 推流/转码 | OBS SDK, FFmpeg, SRS, 阿里云直播, 腾讯云直播, 声网 Agora |
| 内容审核 | 阿里云绿网, 腾讯天御, 百度内容安全, Amazon Rekognition |
| 电商 | 抖音小店, 快手小店, 淘宝联盟, 有赞 |
| 数据 | 蝉妈妈, 飞瓜数据, ClickHouse, Apache Flink |

**数据敏感度分级**：

- 高（PII+金融）：用户实名信息、支付账户、打赏/交易记录、主播收入
- 机密：运营策略、选品数据、MCN 合同、分成比例、推荐参数
- 内部：聚合观看数据、互动统计、公开回放
- 实时流数据含主播肖像/环境信息，需按场景分级

**性能/延迟预算**：

- 推流：低延迟 <1s，超低延迟（连麦）<400ms，标准 <3s
- 审核：视频帧 <500ms，弹幕 <200ms（同步过滤）
- 互动：红包/投票/连麦 <1s
- 电商：商品上下架 <2s，库存锁定 <500ms
- 可用性：直播期间 99.99%

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 推流中断/CDN 故障 | 自动切换备用地址和 CDN、断流重连、观众端无缝切换 |
| 审核漏检违规 | 多模型级联、人工巡查兜底、事后追溯、实时举报通道 |
| 直播电商库存超卖 | 库存预锁定、安全库存缓冲、超卖自动补偿 |
| 打赏系统异常 | 幂等性设计、对账实时校验、异常冻结+人工复核 |
| 大规模并发过载 | 弹性扩缩容、限流降级、核心链路保护（推流优先） |

---

# 84. 广告素材制作域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §14

**DomainDescriptor 映射**：

- `domain_id`: `creative-production` · `recipe_archetype`: Creative
- `risk_level`: Medium · `latency_tier`: near-realtime（文案 <10s，图片 <30s，合规检查 <5s）
- `hitl_intensity`: **中**（品牌类素材发布前审批，医疗/金融素材法务审核）· `regulatory_density`: Medium（广告法/版权法/肖像权）

**核心 Agent 角色**：创意生成 · 品牌合规检查 · 素材适配 · 效果预测 · 工作流管理

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.creative.generate` | 25 | 55 | 生成素材自动标注 AI 生成水印，品牌素材需人工审批 |
| `tool.brand.compliance` | 30 | 75 | 医疗/金融/教育行业素材强制法务审核 |
| `tool.asset.adapt` | 15 | 25 | 尺寸/格式适配自动执行 |
| `tool.creative.predict` | 20 | 35 | 效果预测结果仅供参考，不自动触发投放决策 |

**DomainEvalFramework**：品牌合规通过率（品牌调性一致）· 平台审核一次通过率（>95%）· CTR/CVR 预测准确性 · 素材产出速度（较人工提效倍数）

**HITL 策略**：效果类素材批量生成可自动流转至投放系统；品牌类素材、医疗/金融/教育等强监管行业素材发布前强制人工审批。涉及名人肖像或第三方版权素材需法务确认授权链完整性。

**关键护栏**：版权素材溯源链路（所有引用素材可追溯授权）· 绝对化用语自动检测（广告法禁用词库实时更新）· 肖像权使用授权校验 · 行业敏感词过滤（医疗/金融/教育分级词库）· 生成内容 AI 水印强制注入

**Agent 工作流（详细）**：

- 创意生成 Agent：Brief 解析 → 创意策略 → 多格式素材（文案/图片/视频脚本/落地页）→ 品牌校验 → A/B 变体
- 品牌合规检查 Agent：素材摄入 → 品牌规范匹配（Logo/色彩/字体/调性）→ 广告法校验 → 风险标注 → 修改建议
- 素材适配 Agent：源素材解析 → 平台规格匹配（9:16/1:1/16:9/3:4）→ 智能裁切/重排 → 批量输出
- 效果预测 Agent：历史+素材特征（色调/情感/CTA/人物占比）→ CTR/CVR 预测 → 排序 → 优化方向
- 工作流管理 Agent：需求池 → 任务分配 → 审批流转 → 版本管理 → 素材资产库 → 全链路状态

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 图像生成 | Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly, 即梦 AI |
| 视频制作 | RunwayML, Pika, Sora, 剪映 API, Adobe Premiere SDK |
| 设计 | Figma API, Canva API, Adobe CC SDK, 蓝湖 |
| 文案生成 | GPT-4, Claude, 文心一言, 通义千问 |
| DAM | Bynder, Brandfolder, Adobe AEM Assets |
| 效果分析 | 巨量创意, 腾讯广告创意中心, Google Ads Creative Studio |

**数据敏感度分级**：

- 机密：未发布创意策略、品牌规范手册、竞品分析、预测模型参数
- 内部：已发布素材、投放效果数据、A/B 测试结果、素材资产库
- 低：公开广告素材、行业创意参考

**性能/延迟预算**：

- 文案生成：单条 <10s，批量（100变体）<5min
- 图片生成：单张 <30s，批量适配（10尺寸）<3min
- 视频生成：15秒短视频 <10min，长视频小时级（异步）
- 品牌合规检查：单素材 <5s
- 效果预测：批量评分 <1min

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 生成素材侵犯版权 | 相似度检测（对比版权图库）、溯源水印、侵权自动下架 |
| 品牌规范偏离 | 规范嵌入 Prompt、风格参考图约束、多轮校验 |
| 广告法违规文案 | 禁用词库实时过滤、合规 Agent 前置审核、违规自动替换 |
| 批量质量失控 | 质量评分门槛过滤、抽样人工审核、低分自动打回 |
| 效果预测失准 | 持续 A/B 校准、模型定期重训、偏差监控 |

---

# 85. 游戏开发域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §15

**DomainDescriptor 映射**：

- `domain_id`: `game-dev` · `recipe_archetype`: Creative + Research
- `risk_level`: Medium · `latency_tier`: batch（QA <2h，数值模拟 <10min）
- `hitl_intensity`: **高**（核心玩法设计/美术风格定调/版本发布审批）· `regulatory_density`: High（版号/防沉迷/内容审查/ESRB/PEGI）

**核心 Agent 角色**：设计辅助 · 美术资产生成 · QA 自动化 · 数值平衡 · 代码生成

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.game.design_assist` | 20 | 40 | 设计建议仅供参考，核心玩法决策强制人工 |
| `tool.game.asset_generate` | 25 | 65 | 美术资产需主美确认风格一致性后方可入库 |
| `tool.game.qa_run` | 15 | 20 | 自动化测试自主执行，Bug 报告自动归档 |
| `tool.game.balance_sim` | 30 | 55 | 数值调整建议需策划审核，不自动写入配置表 |

**DomainEvalFramework**：美术风格一致性（FID/CLIP-Score）· Bug 发现率（自动化 vs 人工对比）· 代码生成采纳率 · 基尼系数（经济/数值平衡性）

**HITL 策略**：核心玩法设计、美术风格定调、版本发布审批为强制人工决策节点。数值平衡模拟结果需策划团队确认后方可应用。QA 自动化可独立执行，但 P0/P1 级 Bug 修复方案需开发负责人签核。

**关键护栏**：生成资产版权合规检查（与已知 IP 相似度检测）· 内容审查预筛（版号申报合规前置校验）· 防沉迷机制预埋验证 · 代码生成安全扫描（注入/漏洞自动检测）· 数值模拟异常值熔断

**Agent 工作流（详细）**：

- 设计辅助 Agent：设计意图 → 参考分析 → 系统设计（玩法循环/关卡/经济/叙事）→ 数值框架 → GDD
- 美术生成 Agent：风格参考 → 资产需求解析 → 生成（概念图/2D/3D/UI/场景）→ 风格一致性校验 → 格式导出
- QA Agent：功能测试（任务/UI/存档）→ 性能测试（帧率/内存/加载）→ 兼容性测试 → 崩溃分析 → Bug 报告
- 数值平衡 Agent：经济系统/属性/难度曲线 → 蒙特卡洛模拟 → 平衡性评估 → 破解策略检测
- 代码生成 Agent：Gameplay/Shader/AI 行为树/网络同步 → 适配引擎（Unity/Unreal）→ 代码规范

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 引擎 | Unity（C#）, Unreal（C++/Blueprint）, Godot, Cocos Creator |
| 美术 | Midjourney, Stable Diffusion（ControlNet/LoRA）, Substance 3D, Meshy |
| 版本控制 | Perforce Helix Core, Git LFS, PlasticSCM |
| 测试 | Unity Test Framework, Unreal Automation, Appium, GameBench |
| 数值 | Python（NumPy/SciPy）, MATLAB, 自研模拟器 |

**数据敏感度分级**：

- 极度机密：未公布 GDD、核心玩法专利、源代码、未发布美术资产
- 机密：内部测试数据、性能基准、数值模型、项目排期
- 内部：已公开预告素材、开发者博客、已上线资产

**性能/延迟预算**：

- 美术生成：概念图 <30s，2D 批量 <5min，3D 提示 <1min
- QA 测试：单轮回归 <2h（并行），崩溃分析 <5min
- 数值模拟：单次 <10min（1万次蒙特卡洛），参数扫描小时级
- 代码生成：单函数 <10s，模块 <2min
- 构建：增量 <5min，完整 <1h

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 美术风格偏离 | ControlNet/LoRA 约束、Art Director 审核门控 |
| 数值模拟偏差 | 上线 A/B 验证、玩家数据回馈、热更新调整 |
| 自动测试漏检 | 多策略组合（随机+定向+探索）、人工补充、玩家反馈 |
| 生成代码性能问题 | Profiling 自动集成、性能预算门控 |
| 程序化内容重复 | 变异种子多样化、手工+生成混合比例、新鲜度监控 |

---

# 86. 游戏上架域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §16

**DomainDescriptor 映射**：

- `domain_id`: `game-publishing` · `recipe_archetype`: Compliance + Logistics
- `risk_level`: High · `latency_tier`: near-realtime（Live Ops <5min，提审 <1h）
- `hitl_intensity`: **高**（版号提审材料/重大版本发布/大型活动配置/敏感本地化）· `regulatory_density`: Critical（版号/分级/防沉迷/PIPL/GDPR/支付合规）

**核心 Agent 角色**：商店提审自动化 · 合规审查 · 本地化 · Live Ops · 数据分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.store.submit` | 35 | 85 | 提审材料强制人工终审，版号相关内容零容错 |
| `tool.compliance.check` | 40 | 90 | 防沉迷/支付合规/隐私协议自动校验+人工复核 |
| `tool.localization.translate` | 20 | 45 | 常规文本自动执行，文化敏感/法律文本强制人工 |
| `tool.liveops.config` | 25 | 65 | 大型活动配置需产品+运营双重审批 |

**DomainEvalFramework**：提审一次通过率（>90%为目标）· DAU/留存率（版本健康度）· 活动参与率 · ASO 排名（商店优化效果）· LQA Bug 密度（本地化质量）

**HITL 策略**：版号提审材料、重大版本发布、大型活动配置为强制人工审批节点。敏感地区本地化内容需本地法务+文化顾问双重签核。支付相关配置变更需财务合规确认。Live Ops 常规活动可自动上线，异常指标触发人工介入。

**关键护栏**：多地区分级合规矩阵（自动匹配目标市场法规）· 防沉迷实名认证链路校验 · 支付合规多币种审计 · 本地化文化敏感词库（宗教/政治/历史）· 版本回滚热备机制（异常指标自动触发）

**Agent 工作流（详细）**：

- 提审自动化 Agent：材料准备 → 平台规格适配（App Store/Google Play/Steam/TapTap）→ 自动提交 → 状态追踪 → 拒审分析重提
- 合规审查 Agent：版号材料准备 → 分级评估（ESRB/PEGI/CERO）→ 内容敏感度检查 → 合规差距报告
- 本地化 Agent：UI 翻译 → 语音协调 → 文化适配（节日/命名/视觉）→ 术语一致性 → LQA 测试
- Live Ops Agent：版本更新计划 → 活动配置（限时/赛季/节日）→ 公告 → 服务器管理 → 热更新
- 数据分析 Agent：下载/DAU/MAU/留存/付费/LTV → 评价趋势 → 竞品对标 → 运营建议

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 应用商店 | App Store Connect, Google Play Console, Steamworks, TapTap, 华为 AppGallery |
| 数据 | data.ai, Sensor Tower, GameAnalytics, Firebase, ThinkingData |
| 本地化 | Crowdin, Lokalise, Transifex, memoQ |
| 运营 | Firebase Remote Config, LaunchDarkly, Apollo 配置中心 |
| CI/CD | Jenkins, Fastlane, Unity Cloud Build |

**数据敏感度分级**：

- 极度机密：版号申请材料、未公布发行计划、合同/分成、用户付费数据
- 机密：运营数据、活动配置、A/B 结果、竞品分析
- 内部：已公开商店页面、公开评价、行业基准

**性能/延迟预算**：

- 提审处理：材料准备 <1h，自动提交 <5min，状态轮询每小时
- 本地化：UI 文本 <24h（自动翻译+人工校对）
- Live Ops：活动上下线 <5min（热更新），紧急下线 <1min
- 数据分析：实时看板 <5min 延迟，日报自动生成

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 平台审核拒绝 | 拒审自动分类+方案推荐、历史 Case 库、快速重提 |
| Live Ops 配置错误 | 双人审核、灰度发布（1%验证）、紧急回滚、补偿方案 |
| 本地化错误致差评 | 反馈分类、热更新修复、LQA 加强、社区快速响应 |
| 版号审批延迟 | 合规风险前置、备选方案（海外先行）、预审服务 |
| 大版本致玩家流失 | A/B 前置验证、灰度监控留存、快速回滚、沟通计划 |

---

# 87. 人力资源域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §17

**DomainDescriptor 映射**：

- `domain_id`: `human-resources` · `recipe_archetype`: CRUD-heavy + Compliance
- `risk_level`: High · `latency_tier`: near-realtime（简历筛选 <5s）+ batch（薪酬核算 <2h）
- `hitl_intensity`: **极高**（Offer/解雇/绩效评级/薪酬调整/组织架构变更）· `regulatory_density`: Critical（劳动法/劳动合同法/PIPL/GDPR/EU AI Act）

**核心 Agent 角色**：招聘 · 入职 · 绩效分析 · 薪酬建模 · 合规监控

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.hr.resume_screen` | 35 | 80 | 筛选结果仅为推荐排序，禁止自动淘汰，需HR复核 |
| `tool.hr.offer_generate` | 40 | 95 | Offer 内容强制HRBP+法务双重审批后方可发出 |
| `tool.hr.payroll_calc` | 45 | 90 | 薪酬核算结果需财务+HR双签，异常偏差自动拦截 |
| `tool.hr.compliance_check` | 30 | 70 | 合同条款合规自动校验，风险条款人工复核 |

**DomainEvalFramework**：招聘周期（Time-to-Hire）· Offer 接受率 · 薪酬公平性指数（性别/年龄/族裔维度）· 劳动仲裁案件数（趋势监控）· 偏见审计通过率（EU AI Act 合规）

**HITL 策略**：Offer 发放、解雇决策、绩效评级、薪酬调整、组织架构变更全部强制人工决策。简历筛选 Agent 仅提供排序建议，最终面试邀约由 HR 确认。EU AI Act 要求高风险 AI 系统透明度，所有算法决策需可解释。

**关键护栏**：偏见检测流水线（性别/年龄/学历等保护属性脱敏+公平性指标监控）· 薪酬数据加密隔离（最小权限访问）· 员工数据 PIPL/GDPR 合规存储与删除 · 解雇决策审计日志不可篡改 · 算法决策可解释性报告自动生成

**Agent 工作流（详细）**：

- 招聘 Agent：需求收集 → JD 生成 → 简历筛选评分 → 面试协调 → 问题生成 → 评估汇总 → Offer 审批
- 入职 Agent：材料收集 → IT 账号开通 → 培训计划 → 导师匹配 → 试用期目标 → 体验跟踪
- 绩效分析 Agent：OKR/KPI 辅助 → 数据收集 → 360度汇总 → 绩效校准建议 → 改进计划
- 薪酬建模 Agent：市场对标 → 薪酬带宽模型 → 调薪/奖金模拟（预算+公平性）→ 报告
- 合规监控 Agent：劳动合同到期追踪 → 社保公积金 → 工时管理 → 假期余额 → 风险预警

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| HCM/HRIS | Workday, SAP SuccessFactors, Oracle HCM, 北森, 用友人力云, 钉钉 |
| 招聘 | LinkedIn Recruiter, Boss 直聘, 猎聘, Greenhouse, Lever |
| 薪酬数据 | Mercer, Aon/Radford, 中智薪酬, LinkedIn Salary |
| 学习 | Cornerstone, 云学堂, 酷学院, LinkedIn Learning |
| 签署 | DocuSign, 法大大, e签宝 |

**数据敏感度分级**：

- 极度敏感（PII+）：身份证号、银行账号、薪酬、医疗体检、背调、纪律处分
- 机密：绩效评估、晋升候选、组织调整、劳动仲裁
- 内部：组织架构、岗位描述、培训目录、考勤汇总

**性能/延迟预算**：

- 简历筛选：单份 <5s，批量（1000份）<30min
- 薪酬计算：月度核算 <2h（批处理），个人查询 <3s
- 合规检查：合同到期提前30天预警，工时超限实时告警
- 入职：IT 账号 <1h，培训计划 <5min

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 简历筛选偏见 | 定期偏见审计、多维评估、人工复核低分样本 |
| 薪资核算错误 | 双轨校验、异常值标记、发放前抽检 |
| 劳动合同到期未续 | 90/60/30天三级预警、自动续签触发、法务升级 |
| 员工数据泄露 | 字段级加密、访问审计、异常告警、应急预案 |
| 绩效评估争议 | 申诉流程触发、数据完整回溯、独立复核委员会 |

---

# 88. 供应链与物流域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §18

**DomainDescriptor 映射**：

- `domain_id`: `supply-chain` · `recipe_archetype`: Logistics + Analytics
- `risk_level`: High · `latency_tier`: near-realtime（路径改道 <30s）+ batch（需求预测每日）
- `hitl_intensity`: **高**（大额采购/新供应商准入/关务异常/危险品运输/供应链中断应急）· `regulatory_density`: High（海关法/出口管制/危险品运输/ESG）

**核心 Agent 角色**：需求预测 · 库存优化 · 路径规划 · 供应商评估 · 关务合规

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.scm.forecast` | 20 | 35 | 预测结果自动流入库存系统，异常波动告警人工复核 |
| `tool.scm.inventory_optimize` | 30 | 60 | 常规补货自动执行，大额采购订单强制审批 |
| `tool.scm.route_plan` | 25 | 70 | 危险品运输路径强制人工审核，常规路径自动执行 |
| `tool.scm.customs_declare` | 40 | 90 | HS 编码分类需关务专员确认，出口管制商品强制合规审查 |

**DomainEvalFramework**：MAPE/WMAPE（需求预测准确度）· 库存周转率 · 准时交付率（OTIF）· HS 分类准确率 · 关税优化节约（合规前提下的税费最优化）

**HITL 策略**：大额采购决策、新供应商准入评估、关务异常处理、危险品运输审批、供应链中断应急响应为强制人工决策节点。常规补货与路径规划在阈值内自动执行，超出阈值自动升级至供应链经理。出口管制清单匹配结果零容错，强制合规官签核。

**关键护栏**：出口管制实体清单实时同步（BIS/OFAC/EU）· 危险品运输合规矩阵（UN 编号+运输方式交叉校验）· 供应商 ESG 评分持续监控 · 需求预测异常波动熔断（防止牛鞭效应放大）· 关务申报数据不可篡改审计链

**Agent 工作流（详细）**：

- 需求预测 Agent：历史+趋势+促销+天气/节假日 → 预测模型（ARIMA/Prophet/DeepAR）→ 多层级预测 → 安全库存建议
- 库存优化 Agent：预测+供应约束 → 再订货点/EOQ/安全库存 → 多仓调拨 → 周转 vs 服务水平平衡
- 路径规划 Agent：订单池 → 约束建模（车辆/时间窗/交通/成本）→ VRP 求解 → 调度 → 实时改道
- 供应商评估 Agent：多维评估（质量/交付/价格/响应/ESG）→ 风险分析（财务/地缘/单源）→ 采购辅助
- 关务合规 Agent：HS 编码分类 → 关税计算 → 原产地验证 → 制裁筛查 → 报关单 → 贸易协定优化

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| ERP/SCM | SAP SCM/IBP, Oracle SCM Cloud, Blue Yonder, 金蝶/用友供应链 |
| WMS | Manhattan, Blue Yonder WMS, SAP EWM, 富勒 FLUX |
| TMS | Oracle TMS, SAP TM, G7, 运满满/货车帮 |
| 预测 | Amazon Forecast, Vertex AI, Prophet, 自研 ML |
| 关务 | Descartes, Thomson Reuters, 单一窗口（中国海关） |
| IoT | GPS/温湿度传感器, RFID, 阿里云/AWS IoT |

**数据敏感度分级**：

- 机密：供应商合同/定价、采购成本、库存策略、预测模型
- 商业敏感：库存水位、物流路径、仓库布局、供应商评估
- 受监管：海关申报、原产地证明、危险品运输记录（5-10年）
- IoT：GPS 轨迹、温湿度——可能涉及位置隐私

**性能/延迟预算**：

- 需求预测：每日批量，突发事件触发即时重算 <30min
- 库存优化：每日补货建议，紧急补货 <1h
- 路径规划：初始 <5min（数百订单），实时改道 <30s
- 关务申报：单票 <10min，批量小时级
- IoT 监控：异常告警 <1min

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 需求预测严重偏差 | 预测 vs 实际监控、偏差告警、人工校正、安全库存缓冲 |
| 供应链中断 | 多源供应、安全库存前置、替代供应商激活、应急物流 |
| 路径异常致延误 | 实时 GPS、动态改道、预设应急路线、客户通知 |
| HS 编码分类错误 | 多模型交叉验证、历史比对、海关预裁定、报关员复核 |
| 仓库实物不一致 | 周期/循环盘点、RFID 自动盘点、差异告警、冻结调查 |

---

# 89. 医疗健康域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §19

**DomainDescriptor 映射**：

- `domain_id`: `healthcare` · `recipe_archetype`: Compliance + Conversational
- `risk_level`: Critical · `latency_tier`: realtime（分诊 <5s，药物检查 <2s）+ batch（影像分析 <5min）
- `hitl_intensity`: **最高**（所有诊断建议/处方/影像报告必须执业医师确认）· `regulatory_density`: Critical（医疗器械监督管理条例/HIPAA/FDA SaMD/EU MDR/NMPA）

**核心 Agent 角色**：临床决策支持 · 智能分诊 · 病历分析 · 药物交互检查 · 医学影像分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.clinical.diagnose` | 50 | 99 | 绝不自动输出诊断结论，强制执业医师审核 |
| `tool.triage.assess` | 40 | 85 | 高危分级强制人工复核，低危可辅助自动 |
| `tool.drug.interaction_check` | 35 | 90 | 所有禁忌/严重交互强制药师确认 |
| `tool.imaging.analyze` | 45 | 95 | 影像报告仅作辅助参考，必须影像科医师签发 |

**DomainEvalFramework**：诊断敏感度/特异度 · 病灶检测召回率（漏检零容忍）· 药物交互召回率 · 分诊一致率（与高年资医师对比）· 影像分析假阴性率

**HITL 策略**：**所有临床决策输出必须经执业医师确认后方可用于患者诊疗**——本域与法务域并列 HITL 要求最高。诊断建议 · 处方开具 · 影像报告 · 分诊分级 · 药物方案全部强制人工。Agent 仅提供"临床决策辅助信息"而非"医疗诊断"。

**关键护栏**：高敏感度优先策略（宁可误报不可漏报）· 药物交互多源数据库交叉验证 · 患者数据端到端加密与最小化访问 · 影像分析置信度阈值低于 95% 强制人工 · 急诊场景熔断兜底至人工通道

**Agent 工作流（详细）**：

- 临床决策支持 Agent：病历摄入 → 结构化提取 → 临床推理 → 指南匹配（UpToDate/临床路径）→ 鉴别诊断排序 → 医师审核
- 智能分诊 Agent：症状自述 → 标准化问诊 → ESI/Manchester 评估 → 分诊级别 → 科室路由
- 病历分析 Agent：非结构化病历 NLP 提取（诊断/用药/手术/过敏）→ 时间线 → 信息缺失/矛盾 → 结构化摘要
- 药物交互 Agent：用药列表+新处方 → DrugBank/MCDEX → 交互严重度 → 肝肾禁忌 → 剂量合理性
- 影像分析 Agent：DICOM 接收 → 预训练模型（肺结节/骨折/眼底）→ 可疑区域标注 → 报告草稿

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| EMR | Epic, Cerner, 卫宁健康, 东华软件, 创业慧康, OpenMRS |
| 临床知识库 | UpToDate, DXplain, 中国临床路径, NICE, Cochrane |
| 药物数据库 | DrugBank, MCDEX, Lexicomp, PASS |
| 影像 | DICOM, PACS（GE/Philips/Siemens）, MONAI, 3D Slicer |
| 互操作 | HL7 FHIR R4, ICD-10/11, SNOMED CT, LOINC, DRG/DIP |

**数据敏感度分级**：

- 极度敏感（PHI）：患者身份、诊断、基因组、精神科/HIV/生殖（特殊保护）
- 机密：临床模型参数、医院运营、科研中间数据、医师绩效
- 内部：脱敏聚合统计、公开指南、药品说明书

**性能/延迟预算**：

- 急诊分诊：危险信号 <5s（零延迟容忍），完整 <30s
- 药物交互：处方校验 <2s（嵌入医嘱同步流程）
- 影像分析：X光 <30s，CT 序列 <5min（GPU 加速）
- 临床决策：建议 <10s（门诊等待时间有限）
- 可用性：99.99%（急诊 7×24）

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 影像系统性漏检 | 多模型集成投票、新标注数据回归、漏检反馈闭环 |
| 药物数据库更新延迟 | 多数据源交叉校验、上市公告触发刷新 |
| EMR 集成中断 | 本地缓存关键数据、降级手动输入、自动重连补同步 |
| 分诊对罕见急症不足 | 危险信号硬编码兜底、低置信度强制人工复核 |
| PHI 数据暴露 | 实时 PHI 检测脱敏、访问审计、72h 监管通报 |

---

# 90. 教育培训域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §20

**DomainDescriptor 映射**：

- `domain_id`: `education` · `recipe_archetype`: Conversational + Creative
- `risk_level`: Medium · `latency_tier`: realtime（辅导 <3s，测试 <1s）+ batch（内容生成）
- `hitl_intensity`: **高**（课程内容上线前教师审核/主观题评分抽检/未成年人数据使用需家长同意）· `regulatory_density`: High（未成年人保护法/FERPA/COPPA/EU AI Act）

**核心 Agent 角色**：学习路径优化 · 内容生成 · 智能评测 · 智能辅导 · 学情分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.edu.learning_path` | 20 | 45 | 路径推荐可自动执行，定期教师审核 |
| `tool.edu.content_generate` | 30 | 70 | 所有生成内容上线前必须教师审核 |
| `tool.edu.assess` | 35 | 75 | 主观题评分强制抽检，客观题可自动 |
| `tool.edu.tutor` | 25 | 60 | 实时辅导允许自动，敏感话题触发人工介入 |

**DomainEvalFramework**：知识点掌握率提升 · 评分一致性（Cohen's Kappa ≥ 0.8）· 完课率 · 苏格拉底式引导比例（引导而非直接给答案）· 内容准确率

**HITL 策略**：课程内容发布前必须经学科教师审核，未成年人场景执行最严格数据保护。内容生成 · 主观题评分 · 学习路径重大调整 · 敏感话题辅导强制人工介入。涉及未成年人个人数据采集需家长显式同意。Agent 定位为"学习辅助工具"而非"教师替代"。

**关键护栏**：未成年人内容安全过滤（暴力/色情/不当价值观零容忍）· 答案泄露防护（引导优先于直答）· 年龄分级内容策略 · 数据最小化采集与家长知情同意 · 学术诚信检测集成

**Agent 工作流（详细）**：

- 学习路径 Agent：前测/历史评估 → 知识图谱 → 个性化路径（知识点序列/难度/资源）→ 动态调整
- 内容生成 Agent：教学大纲+知识点 → 讲义/练习/案例/课件 → 多难度/多语言 → Bloom 层次
- 评测 Agent：题目生成（选择/填空/主观/编程）→ 自动评分 → 个性化反馈 → 薄弱项 → CAT
- 辅导 Agent：一对一对话 → 苏格拉底式提问 → 困惑点识别 → 分步解释和类比
- 学情分析 Agent：学习行为汇总（时长/完成/错题/参与）→ 学员画像 → 风险预测 → 干预建议

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| LMS | Moodle, Canvas, Blackboard, 学堂在线, 中国大学MOOC, Coursera |
| 知识图谱 | Neo4j, 自建学科知识图谱, ConceptNet |
| 评测 | Gradescope, Turnitin, CodeGrader, OJ 系统 |
| 视频/直播 | Zoom SDK, 腾讯会议, 钉钉课堂, OBS |
| 数据分析 | xAPI/LRS, Amplitude, 自建学情仪表盘 |

**数据敏感度分级**：

- 高（未成年人数据）：学生身份、学习行为、成绩、心理评估
- 机密：试题库（未公开）、评分标准、教学算法参数
- 内部：课程大纲、已公开材料、聚合统计

**性能/延迟预算**：

- 辅导对话：响应 <3s（超时注意力流失）
- 自适应测试：题目推荐 <1s
- 内容生成：单知识点 <1min，完整课程小时级（异步）
- 评测评分：客观题即时，主观题 <30s/篇

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 内容含知识错误 | 学科知识库校验、教师审核工作流、学员纠错反馈 |
| 主观题评分偏差 | 校准（标杆样卷）、低置信度转人工、多维评分量表 |
| 学习路径死循环 | 掌握度阈值调校、路径多样性约束、手动跳过 |
| 辅导直接给答案 | 教学策略护栏（强制引导）、作业场景检测、答案过滤 |
| 高并发考试过载 | 弹性扩容、题目本地缓存、降级离线考试 |

---

# 91. 客户服务域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §21

**DomainDescriptor 映射**：

- `domain_id`: `customer-service` · `recipe_archetype`: Conversational
- `risk_level`: Medium · `latency_tier`: realtime（聊天 <3s，路由 <1s）
- `hitl_intensity`: **中**（超权限退款审批/投诉升级/法律问题/VIP 异常工单/低置信度转人工）· `regulatory_density`: Medium（消费者权益保护法/TCPA/GDPR）

**核心 Agent 角色**：多渠道对话 · 智能路由 · 知识检索 · 质检评分 · 升级管理

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.cs.respond` | 20 | 40 | 常规咨询自动回复，低置信度转人工 |
| `tool.cs.route` | 15 | 25 | 自动执行智能路由，VIP 工单优先队列 |
| `tool.cs.knowledge_search` | 10 | 15 | 自动执行（辅助信息检索） |
| `tool.cs.quality_score` | 25 | 55 | 质检评分供参考，申诉/争议需人工复核 |

**DomainEvalFramework**：CSAT（客户满意度）· FCR（首次解决率）· AI 独立解决率 · 幻觉率（严格趋零）· AHT（平均处理时长）· 升级率

**HITL 策略**：超权限操作与高风险场景强制人工介入，常规咨询允许全自动闭环。退款超阈值 · 法律/监管问题 · 投诉升级 · VIP 异常工单 · 置信度低于阈值自动转人工坐席。Agent 须在对话开始时明确 AI 身份，用户可随时请求人工服务。

**关键护栏**：情绪检测与升级熔断（检测到愤怒/威胁立即转人工）· 承诺一致性校验（不承诺超出策略范围内容）· 多渠道上下文同步 · 敏感信息脱敏展示 · 退款/补偿操作金额分级审批

**Agent 工作流（详细）**：

- 多渠道对话 Agent：渠道接入（聊天/电话ASR/邮件/社交）→ 意图识别 → 知识检索 → 回答生成 → 满意度确认 → 工单归档
- 智能路由 Agent：工单内容（意图/情感/紧急度）+ 客户属性（VIP/历史/LTV）+ 坐席状态 → 最优路由 → 排队/溢出
- 知识检索 Agent：语义搜索+精确匹配混合 → 产品/服务知识库 → 带引用答案 → 知识缺口识别
- 质检评分 Agent：全量自动质检（合规用语/态度/解决度/流程）→ 评分卡 → 低分标记人工复检
- 升级管理 Agent：场景检测（情绪激动/超权限/技术问题/投诉）→ 自动升级至主管/专家/跨部门 → SLA 保障

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 全渠道 | Zendesk, Salesforce Service Cloud, Freshdesk, 网易七鱼, 智齿, Udesk |
| 语音/CTI | Genesys Cloud, Avaya, Amazon Connect, Twilio Voice, 合力亿捷 |
| 知识库 | Confluence, Guru, 自建 RAG（Pinecone/Milvus + LLM） |
| NLP | 意图分类、情感分析（BERT 微调）、ASR（讯飞/Google） |
| CRM | Salesforce, HubSpot, 纷享销客 |

**数据敏感度分级**：

- PII（高）：客户姓名/电话/地址/账户、对话中支付/订单数据
- 机密：定价策略、补偿权限矩阵、未公开产品计划、投诉详情
- 内部：聚合服务指标、FAQ 内容、培训材料

**性能/延迟预算**：

- 在线聊天：首次响应 <3s，后续每轮 <5s
- 电话 IVR：意图识别 <2s，路由 <1s
- 邮件：自动回复 <30min，含人工 <4h
- 质检：实时滞后 <5min，日报次日上午
- 知识检索：含 LLM 答案 <3s

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 承诺不存在的退款政策 | RAG 接地生成、政策合规校验、承诺类强制人工确认 |
| 高峰系统过载 | 弹性扩容、排队回拨、溢出外包坐席 |
| 情感误判致投诉升级 | 多维检测（文本+语调）、负面阈值降低触发 |
| 知识库过期 | 新鲜度追踪、产品/政策变更触发更新、版本标记 |
| 跨渠道上下文丢失 | 统一会话管理、全渠道历史同步、身份统一 |

---

# 92. 内容审核与安全域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §22

**DomainDescriptor 映射**：

- `domain_id`: `content-moderation` · `recipe_archetype`: Moderation + Adversarial
- `risk_level`: High · `latency_tier`: realtime（文本 <500ms，图片 <1s，视频 <30s）
- `hitl_intensity`: **高**（申诉裁决/CSAM 案件/边界案例/策略变更），审核员心理健康保护 · `regulatory_density`: Critical（网络安全法/Section 230/DSA/CSAM 强制报告）

**核心 Agent 角色**：多模态审核 · 策略引擎 · 申诉处理 · 对抗检测 · 合规报告

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.moderation.classify` | 30 | 65 | 明确违规自动处置，边界案例强制人工审核 |
| `tool.moderation.appeal` | 40 | 85 | 所有申诉裁决必须人工审核员终审 |
| `tool.adversarial.detect` | 35 | 75 | 对抗样本检测结果需安全团队确认后入库 |
| `tool.compliance.report` | 25 | 90 | CSAM 等强制报告场景立即上报并锁定证据链 |

**DomainEvalFramework**：精确率/召回率/F1 · 违规内容平均在线时长（趋零）· 对抗样本检测率 · 申诉处理时效 · 误判率（过度审核监控）

**HITL 策略**：CSAM 及极端暴力内容强制即时人工处置并依法报告，边界案例进入人工队列。申诉裁决 · 策略规则变更 · 新型违规模式定义 · 跨文化敏感内容全部强制人工。审核员暴露保护机制：内容模糊化预览 · 轮岗制度 · 心理健康定期评估 · 极端内容接触时长限制。

**关键护栏**：多模型交叉验证降低单模型偏差 · 对抗攻击持续红队测试 · 证据链完整性保障（不可篡改审计日志）· 辖区差异化策略引擎 · 审核员心理健康保护强制执行 · 误判自动申诉通道

**Agent 工作流（详细）**：

- 多模态审核 Agent：内容接收 → 格式解析 → 多模型并行（文本/图片/视频/音频）→ 规则引擎叠加 → 置信度分级 → 处置
- 策略引擎 Agent：审核策略管理（平台/法规/广告主）→ 版本管理 → 灰度/A/B → 法规→规则自动转化
- 申诉处理 Agent：申诉接收 → 原始内容重审 → 补充信息 → 复核建议（维持/撤销/改判）
- 对抗检测 Agent：规避手段识别（谐音/拼音/图片嵌字/语义伪装）→ 持续学习 → 规则自动更新
- 合规报告 Agent：按监管要求生成报告（审核量/违规分布/时效/申诉）→ 监管对接 → 证据留存

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 文本 | 自研 NLP（BERT 微调）, 阿里绿网, 腾讯天御, Perspective API |
| 图片/视频 | 自研 CV, PhotoDNA（CSAM）, AWS Rekognition, CLIP |
| 音频 | ASR（讯飞/Google/Whisper）, 音频分类 |
| 策略引擎 | 自建规则引擎（Drools/DSL）, 特征平台, 实时决策 |
| 监管对接 | 网信办举报中心, NCMEC CyberTipline, DSA 透明度报告 |

**数据敏感度分级**：

- 极度敏感：CSAM——法律强制报告、专门流程、严格访问控制
- 高：用户内容原始数据（含 PII）、审核决策、举报人信息
- 机密：审核策略规则（泄露后被利用规避）、对抗模型参数
- 内部：聚合统计、模型性能、公开社区准则

**性能/延迟预算**：

- 发布前审核：文本 <500ms，图片 <1s，短视频 <30s
- 吞吐量：日均数亿条，峰值弹性扩容
- 对抗响应：新模式发现到规则上线 <4h（紧急）/<24h（常规）
- 申诉：自动复核 <1h，含人工 <24h
- CSAM：零延迟——检测即阻断+立即报告

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 新对抗大规模绕过 | 实时样本收集、紧急规则热更新、临时提高严格度 |
| 模型更新致误审飙升 | 灰度发布（1%→100%）、自动回滚、A/B 验证 |
| 审核系统宕机 | 降级（高风险排队/低风险放行）、多可用区容灾 |
| 人工审核队列过长 | 动态优先级、临时扩充、AI 预排序加速 |
| CSAM 漏检 | PhotoDNA+多模型冗余、哈希库更新、定期红队测试 |

---

# 93. IT 运维 SRE/DevOps 域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §23

**DomainDescriptor 映射**：

- `domain_id`: `it-operations` · `recipe_archetype`: IncidentOps
- `risk_level`: High · `latency_tier`: realtime（告警分析 <30s，自动修复 <2min）
- `hitl_intensity`: **高**（高风险变更 CAB 审批/安全事件取证/自动修复策略上线/预算采购）· `regulatory_density`: High（等保 2.0/ISO 27001/SOC 2/PCI-DSS/NIST）

**核心 Agent 角色**：事件响应 · 监控分析 · 部署自动化 · 容量规划 · 安全运营

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.ops.incident_respond` | 35 | 70 | 已知 Runbook 自动执行，未知模式强制人工 |
| `tool.ops.deploy` | 40 | 80 | 生产环境部署必须 CAB 审批 + 灰度验证 |
| `tool.ops.capacity_plan` | 20 | 35 | 自动生成规划建议，采购决策需管理层审批 |
| `tool.ops.security_scan` | 25 | 60 | 扫描自动执行，高危漏洞修复方案需安全团队确认 |

**DomainEvalFramework**：MTTR（平均修复时间）· MTTD（平均检测时间）· SLO 达成率 · 自动修复成功率 · 部署失败率 · 告警噪声比（信噪比优化）

**HITL 策略**：生产环境高风险变更强制 CAB 审批，安全事件强制安全团队介入。Runbook 覆盖的已知故障可自动修复，但需事后审计。部署回滚 · 安全事件取证 · 容量采购 · 新自动修复策略上线全部强制人工。Agent 操作范围严格限定于预授权资源。

**关键护栏**：爆炸半径控制（自动修复仅限单节点/单服务，跨域操作需人工）· 变更窗口强制执行 · 操作审计全链路不可篡改 · 安全扫描结果分级响应 · 自动修复熔断器（连续失败自动停止并告警）

**Agent 工作流（详细）**：

- 事件响应 Agent：告警接收（Prometheus/PagerDuty）→ 聚合 → 拓扑关联 → 根因假设 → 自动修复（Runbook）→ 升级/闭环
- 监控分析 Agent：指标/日志/链路追踪持续分析 → 动态基线 → 异常检测 → 告警降噪
- 部署自动化 Agent：CI/CD 管线 → 金丝雀发布（渐进流量+指标监控）→ 回滚 → 功能开关 → 依赖编排
- 容量规划 Agent：历史负载+增长预测 → 资源建模 → 扩容建议 → 预算预测 → 浪费识别
- 安全运营 Agent：IDS/IPS/WAF/漏洞扫描 → 威胁情报匹配 → 自动响应（IP 封禁/账号锁定）→ 漏洞修复优先级

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 监控 | Prometheus, Grafana, Datadog, New Relic, Splunk, Zabbix |
| 日志 | ELK, Loki, Splunk, Fluentd/Fluent Bit |
| 链路追踪 | Jaeger, Zipkin, SkyWalking, Datadog APM |
| 事件管理 | PagerDuty, OpsGenie, VictorOps |
| 部署/IaC | Kubernetes, ArgoCD, Terraform, Ansible, Helm |
| 安全 | CrowdStrike, Snort/Suricata, Cloudflare WAF, Nessus/Qualys |

**数据敏感度分级**：

- 极度敏感：生产凭证（SSH/API Key/数据库密码）、漏洞详情、渗透测试
- 机密：系统架构拓扑、IP 段、容量数据、事件复盘、安全策略
- 内部：聚合性能指标、部署历史、公开监控仪表盘
- 日志：可能含 PII（需脱敏），受留存/审计约束

**性能/延迟预算**：

- 告警响应：触发到 Agent 分析 <30s，自动修复 <2min
- 监控采集：指标 15-60s 间隔，日志 <10s 延迟
- 部署：CI 构建+测试 <15min，金丝雀观测窗口可配置
- 安全检测：实时入侵 <1s，漏洞扫描每日/每周
- 监控系统可用性：99.99%

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 自动修复引发级联故障 | 影响范围限制、操作可逆、单次仅 N% 实例、熔断器 |
| 告警风暴淹没响应 | 聚合去重、拓扑感知抑制、动态抑制规则 |
| 金丝雀未检测慢性缺陷 | 多维指标监控、延长观测窗口、Sticky Canary |
| 监控自身故障 | 独立 meta-monitoring、多路径告警（短信/电话/IM） |
| 安全事件凭证泄露 | 自动凭证轮换、Vault/KMS、泄露即时吊销重签 |

---

# 94. 市场营销与品牌域架构

> 关联：§37 业务域建模 · §23 合规 · §11 安全 · §45 Harness Runtime
> 详细调研数据见 `v3.0-domain-research.md` §24

**DomainDescriptor 映射**：

- `domain_id`: `marketing` · `recipe_archetype`: Analytics + Creative
- `risk_level`: Medium · `latency_tier`: near-realtime（舆情 <15min）+ batch（Campaign 报告）
- `hitl_intensity`: **中**（品牌传播内容审批/营销预算审批/品牌危机公关接管/法律风险内容法务审核）· `regulatory_density`: Medium（广告法/互联网广告管理办法/FTC/GDPR/CAN-SPAM）

**核心 Agent 角色**：Campaign 编排 · 品牌监测 · SEO/SEM 优化 · 社交媒体管理 · 客户分群分析

**DomainRiskProfile 覆写**：
| 操作 | 平台默认 risk | 域覆写 risk | 结果 |
| --- | --- | --- | --- |
| `tool.marketing.campaign` | 25 | 55 | 投放策略自动优化，预算超阈值需审批 |
| `tool.brand.monitor` | 15 | 30 | 自动执行舆情监测，危机信号立即告警 |
| `tool.seo.optimize` | 20 | 35 | 自动执行关键词与内容优化建议 |
| `tool.social.publish` | 30 | 70 | 所有外发内容必须品牌团队审核后发布 |

**DomainEvalFramework**：ROAS（广告支出回报率）· CPA/CPL · 品牌 SOV（声量份额）· 互动率 · 危机预警准确率 · 内容合规通过率

**HITL 策略**：所有对外发布内容强制品牌团队审核，品牌危机事件立即公关团队接管。营销预算变更 · 品牌合作审批 · 法律风险内容法务审核 · 危机公关声明全部强制人工。数据分析 · 舆情监测 · SEO 建议可自动执行。Agent 生成内容仅作为草稿供人工优化。

**关键护栏**：广告法合规自动检测（绝对化用语/虚假宣传/对比广告）· 品牌调性一致性检查 · 竞品数据采集合规边界 · 用户画像数据匿名化 · 危机舆情分级响应预案 · 营销邮件退订合规（CAN-SPAM/GDPR）

**Agent 工作流（详细）**：

- Campaign 编排 Agent：营销目标 → 跨渠道方案（时间线/渠道/预算/受众）→ 内容协调 → 效果监控 → 动态调整
- 品牌监测 Agent：全网品牌提及监控（社交/新闻/论坛/短视频）→ 情感分析/话题聚类 → 危机检测 → 健康度报告
- SEO/SEM Agent：排名+流量分析 → 关键词研究 → 内容优化 + 技术 SEO → SEM 竞价 → 排名监控
- 社交媒体 Agent：多平台发布（公众号/微博/抖音/小红书/LinkedIn）→ 适配内容 → 发布时间 → 互动管理
- 客户分群 Agent：多源数据（CRM/行为/交易/社交）→ 聚类+RFM → 高价值人群 → 定向建议

**关键工具/集成**：
| 类别 | 具体工具 |
| ---- | ---- |
| 营销自动化 | HubSpot, Marketo, Pardot, 致趣百川, 径硕 |
| 社交媒体 | 微信公众平台, 微博, 抖音/巨量引擎, 小红书, Hootsuite |
| SEO/SEM | Google Search Console, SEMrush, Ahrefs, 百度搜索, 5118 |
| 舆情 | 清博大数据, 新榜, Brandwatch, Meltwater |
| 数据 | GA4, Adobe Analytics, 神策数据, GrowingIO |

**数据敏感度分级**：

- PII（高）：客户联系信息、行为画像、CRM 交易记录和偏好
- 机密：品牌策略、未公开上市计划、营销预算、竞品分析
- 内部：内容日历、A/B 方案、聚合营销指标

**性能/延迟预算**：

- 舆情监测：负面检测 <15min（黄金响应时间），常规每小时
- 社交发布：内容生成 <5min/条，图片/视频小时级
- SEO：排名追踪每日，技术审计每周
- Campaign 报告：准实时 <15min 延迟
- 客户分群：批量每日，触发式 <5min

**常见故障与恢复**：
| 故障模式 | 恢复策略 |
| ---- | ---- |
| 舆情危机期间自动发布 | 危机检测全渠道暂停、通知公关团队、预案响应模板 |
| 内容违反广告法 | 发布前合规扫描（绝对化/虚假声明）、法务审核流 |
| SEO 策略致搜索惩罚 | 白帽 SEO 护栏、排名异常监控、惩罚恢复流程 |
| 归因模型失真 | 多归因模型对比、增量测试校准 |
| 跨平台发布失败 | 队列重试、规格自适应转换、多平台状态监控 |

---

# Part V — 智能交互层（§39-§44）

---

# 39. 自然语言任务入口架构

> 使非技术用户通过自然语言直接与平台交互，替代手写 JSON/API 调用。
> 关联：§6 API 契约 · §13 OAPEFLIR · §37 业务域建模 · §40 目标分解 · §44 非技术用户体验

## 39.1 设计原则

- 自然语言是**一等交互方式**，与 REST API 平权，不是 API 之上的语法糖
- 所有 NL 交互最终转化为标准 `RequestEnvelope`(§5.3)，复用已有控制面和执行面
- 歧义必须显式消解，不猜测用户意图——宁可多问一句，不可误执行高风险动作
- 对话上下文持久化到 Memory(§29.2)，跨会话可恢复

## 39.2 NL 交互管线

```text
用户输入（自然语言）
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Intent Parser │────▶│ Domain Router│────▶│ Task Builder │
│ (意图识别)    │     │ (域路由)     │     │ (任务构建)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
    ┌──────────────┐     ┌──────────────┐        │
    │ Clarification│◀────│ Ambiguity    │◀───────┘
    │ Dialog       │     │ Detector     │   有歧义时回环
    └──────┬───────┘     └──────────────┘
           │ 用户确认
           ▼
    ┌──────────────┐     ┌──────────────┐
    │ Risk Preview │────▶│ RequestEnvelope│──▶ P1 Interface Plane
    │ (风险预览)   │     │ (标准契约)     │
    └──────────────┘     └──────────────┘
```

## 39.3 核心组件

| 组件              | 职责                                                |
| ----------------- | --------------------------------------------------- |
| IntentParser      | 解析用户自然语言输入，提取意图标签与置信度          |
| TaskSpecBuilder   | 将结构化意图映射为 TaskSpec(§6)，填充域、参数与约束 |
| AmbiguityResolver | 当置信度低于阈值时生成澄清问题，策略见 §39.4        |
| ContextEnricher   | 注入用户角色、历史对话、域上下文等环境信息          |
| ResponseFormatter | 将执行结果转换为用户友好的自然语言回复或结构化卡片  |

## 39.4 歧义消解策略

| 歧义类型 | 示例               | 消解方式                                           |
| -------- | ------------------ | -------------------------------------------------- |
| 域歧义   | "做一份报表"       | 追问"是财务报表还是广告报表？"                     |
| 范围歧义 | "清理过期数据"     | 追问"清理哪个域的数据？时间范围？"                 |
| 风险歧义 | "更新产品价格"     | 展示风险预览 + 确认"这会影响线上 X 个商品"         |
| 时间歧义 | "尽快完成"         | 映射为 urgency=high，告知预计完成时间              |
| 权限歧义 | "帮我审批这些请求" | 检查权限，无权时提示"你没有审批权限，需要转发给 X" |

## 39.5 多轮对话状态机

```text
         ┌─────┐
         │ Idle │◀──────────────────────────┐
         └──┬──┘                            │
            │ 用户输入                       │ 任务完成/取消
            ▼                               │
    ┌───────────────┐                       │
    │ Intent Parsing │                      │
    └───────┬───────┘                       │
            │                               │
     ┌──────┴──────┐                        │
     │有歧义？      │                        │
     ▼ Yes         ▼ No                     │
┌──────────┐  ┌──────────┐                  │
│Clarifying│  │ Building │                  │
│(追问中)   │  │(构建任务) │                  │
└────┬─────┘  └────┬─────┘                  │
     │ 用户回答      │                       │
     └──────┬──────┘                        │
            ▼                               │
    ┌───────────────┐                       │
    │ Confirming    │                       │
    │ (风险预览+确认)│                       │
    └───────┬───────┘                       │
            │ 用户确认                       │
            ▼                               │
    ┌───────────────┐     ┌────────────┐    │
    │ Executing     │────▶│ Reporting  │────┘
    │ (执行中)      │     │ (结果报告)  │
    └───────────────┘     └────────────┘
```

## 39.6 安全约束

- NL 入口的所有输出必须通过 Prompt Injection 防护(§16.5)
- 高风险意图（risk ≥ high）**必须**显式确认，不允许 NL 直接触发
- 对话历史受数据分级(§11.6)约束，confidential/restricted 内容不回显
- NL 入口的权限等同于调用方的 API 权限，不额外提权

## 39.7 多语言与国际化（i18n）

| 层次                 | 国际化策略                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Intent Parser        | 多语言意图识别：通过 ModelGateway(§15) 调用支持多语言的 LLM；语言检测后路由到对应 locale 的 Prompt 模板 |
| Clarification Dialog | 响应语言跟随用户输入语言（auto-detect），或遵循用户 profile 中的 `preferred_locale` 设置                |
| Risk Preview         | 风险描述、成本预估使用用户 locale 的货币/日期格式                                                       |
| NL 状态摘要(§43)     | 看板摘要按用户 locale 生成；金额/日期/数字遵循 ICU 格式                                                 |
| 错误消息             | 平台标准错误码映射到多语言 message catalog；fallback 语言为 en-US                                       |

---

# 40. 目标分解引擎架构

> 在 OAPEFLIR(§13) 之上增加 Goal → Task 分解层，使用户可以描述业务目标而非单个任务。
> 关联：§13 OAPEFLIR · §19 Agent 委托 · §37 业务域建模 · §39 NL 入口 · §41 主动 Agent

## 40.1 三层分解模型

```text
Goal（业务目标）
  "发起 X 产品的春季营销活动"
    │
    ▼  GoalDecomposer
Task（域任务）                              ← 新增层
  ├── [content-production] 制作 3 套广告素材
  ├── [advertising] 配置并投放广告计划
  ├── [data-analysis] 设置 ROI 追踪看板
  └── [legal] 审核广告合规性
    │
    ▼  OAPEFLIR Planner (§13)
Step（执行步骤）                            ← 已有层
  ├── tool.design.generate_creative
  ├── tool.ad_platform.create_campaign
  └── ...
```

## 40.2 GoalDecomposer 接口

核心方法 `decompose(goal, constraints) → TaskGraph`，将高层目标拆解为可执行的任务依赖图。

| 参数/特性   | 说明                                                    |
| ----------- | ------------------------------------------------------- |
| goal        | 结构化目标描述，含目标文本、所属域与优先级              |
| constraints | 分解约束：最大深度(默认 5)、预算上限(§18)、截止时间     |
| 返回值      | TaskGraph —— 节点为 TaskSpec(§6)，边为依赖关系          |
| 环检测      | 构建 TaskGraph 时自动执行拓扑排序，检测到环即拒绝并报错 |
| 预算分配    | 按子任务预估成本比例将总预算分配到各节点                |

## 40.3 分解策略

| 策略         | 适用场景                                    | 机制                                                      |
| ------------ | ------------------------------------------- | --------------------------------------------------------- |
| **模板匹配** | 目标匹配已有 DomainRecipe(§37.7) 或跨域模板 | 直接实例化模板，填充参数                                  |
| **LLM 规划** | 无匹配模板的新场景                          | 调用 ModelGateway(§15) 进行分解，受 DomainDescriptor 约束 |
| **混合式**   | 部分匹配                                    | 模板骨架 + LLM 填充缺失环节                               |
| **人工辅助** | 置信度 < 0.7 或涉及 critical 风险           | 生成初步分解方案，请求人工审核和调整                      |

## 40.4 跨域依赖图管理

```text
[content-production]──▶[legal]──▶[advertising]──▶[data-analysis]
     素材制作              合规审核       投放上线          效果追踪
         │                                  │
         └──────────parallel────────────────┘
                 (素材制作和投放配置可并行)
```

- 依赖图自动拓扑排序，识别可并行的任务
- **循环依赖检测**：分解完成后对 dependency_graph 进行 DAG 校验，若检测到环路则拒绝执行并返回环路路径给用户/GoalDecomposer 重试
- 关键路径计算，预估总工期
- 单个 Task 失败时，根据依赖类型决定：`blocks` → 阻塞下游，`soft_dependency` → 告警但继续
- 跨域数据传递遵循 DomainInteractionPolicy(§37.8)

## 40.5 Goal 生命周期

| 状态                | 说明                     | 可转移至                               |
| ------------------- | ------------------------ | -------------------------------------- |
| draft               | 目标创建，尚未分解       | decomposing, cancelled                 |
| decomposing         | 正在分解为 Task          | decomposed, failed                     |
| decomposed          | 分解完成，等待确认       | executing, cancelled                   |
| executing           | Task 正在执行中          | completed, partially_completed, failed |
| completed           | 所有 Task + 成功标准达成 | archived                               |
| partially_completed | 部分 Task 完成，部分失败 | executing(retry), completed, cancelled |
| failed              | 分解或执行失败           | decomposing(retry), cancelled          |
| cancelled           | 用户取消                 | archived                               |

---

# 41. 主动式 Agent 框架

> 使 Agent 能基于事件触发和定时调度主动发起任务，而非仅响应 API 调用。
> 关联：§4.2 P1 Interface Plane · §20 长时任务 · §37 业务域建模 · §40 目标分解

## 41.1 设计原则

- 主动式 Agent 是**受控的自动化**，不是不受约束的自主行为
- 所有触发器必须在 DomainDescriptor(§37) 中声明，未声明的触发器不允许注册
- 触发产生的任务与 API 创建的任务走**完全相同的风控管线**(§10)
- 主动行为产生的成本计入对应 domain 的预算(§18)

## 41.2 触发器模型

每个触发器由 `TriggerDefinition` 描述，注册时需在 DomainDescriptor(§37) 中声明：

| 字段         | 类型                                   | 说明                                           |
| ------------ | -------------------------------------- | ---------------------------------------------- |
| triggerId    | string                                 | 全局唯一标识                                   |
| type         | schedule / event / condition / webhook | 触发方式：定时、事件驱动、条件表达式、外部回调 |
| filter       | object                                 | 事件过滤条件或 cron 表达式                     |
| cooldown     | duration                               | 最小触发间隔，防止高频重复触发                 |
| maxFireCount | number \| null                         | 最大触发次数，null 表示无限                    |
| boundAgentId | string                                 | 绑定的执行 Agent，触发后由该 Agent 处理        |

## 41.3 触发模式

| 模式         | 行为                                   | 适用场景                                  | 风险控制                                    |
| ------------ | -------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| **自动执行** | 触发后直接创建任务                     | 低风险定时任务（日报生成、数据同步）      | require_confirmation=false + risk_level=low |
| **建议模式** | 触发后向用户推送建议，用户确认后执行   | 中高风险事件响应（CTR 下降→建议调整出价） | require_confirmation=true                   |
| **静默记录** | 触发后仅记录事件和分析结果，不主动通知 | 数据积累（用户行为模式识别）              | action_type=update_dashboard                |

## 41.4 触发风暴防护

- **max_fire_rate**：每个触发器有最大触发频率，超出自动降级为静默记录
- **cooldown**：两次触发间强制冷却，防止重复执行
- **batch_window**：事件触发器可配置批量窗口，合并短时间内多个事件为一次触发
- **circuit_breaker**：连续 N 次触发任务失败后，自动禁用触发器并告警
- **全局触发预算**：每个 domain 有每日最大自动触发次数，防止失控

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
                       │ Queue        │──▶ 用户看板(§43) / 推送通知
                       └──────┬───────┘
                              │ 用户确认
                       ┌──────▼───────┐
                       │ Task/Goal    │──▶ 标准执行管线
                       │ Creator      │
                       └──────────────┘
```

---

# 42. 渐进式自主权模型

> 基于历史绩效数据驱动 Agent 自主权的动态晋升/降级，减少人工监督负担。
> 关联：§10 风险控制 · §17 模型评估 · §21 人机协作 · §37.2 DomainCapability · §41 主动 Agent

## 42.1 信任积分模型

每个 Agent 维护一个 `TrustScore` 记录，驱动自主权级别(§42.2)的晋升与降级：

| 字段          | 类型                                            | 说明                                         |
| ------------- | ----------------------------------------------- | -------------------------------------------- |
| agentId       | string                                          | 关联 Agent 的唯一标识                        |
| currentScore  | number (0-1000)                                 | 当前信任积分，由执行成功/失败/覆写等事件累计 |
| level         | suggestion / supervised / semi_auto / full_auto | 当前自主权级别，由积分区间映射               |
| historyWindow | duration (默认 90d)                             | 计算积分所用的滑动窗口长度                   |
| decayRate     | number (默认 0.05)                              | 无活动时的每周期衰减系数，详见 §42.3         |

## 42.2 自主权晋升/降级规则

**默认晋升阶梯**：

| 当前级别   | 晋升至     | 条件                                                            | 审批          |
| ---------- | ---------- | --------------------------------------------------------------- | ------------- |
| suggestion | supervised | ≥ 50 次执行 + 成功率 ≥ 95% + 0 incident(30d)                    | domain_owner  |
| supervised | semi_auto  | ≥ 200 次执行 + 成功率 ≥ 98% + 人工覆写率 < 5% + 0 incident(60d) | domain_owner  |
| semi_auto  | full_auto  | ≥ 500 次执行 + 成功率 ≥ 99% + 人工覆写率 < 1% + 0 incident(90d) | platform_team |

**即时降级触发器**：

| 事件             | 降级动作            | 恢复条件                      |
| ---------------- | ------------------- | ----------------------------- |
| 引发 P0 Incident | 直接降至 suggestion | 人工调查 + platform_team 审批 |
| 引发 P1 Incident | 降一级              | 30d 无 incident               |
| 连续 3 次失败    | 降一级              | 10 次连续成功                 |
| 成本超预算 200%  | 降至 supervised     | 预算调整 + domain_owner 确认  |

## 42.3 信任分衰减机制

长期无执行的 Agent 信任分应逐步衰减，避免历史高信任 Agent 在行为环境变化后仍持有过高自主权：

| 无执行时长  | 衰减行为                                      | 说明                                         |
| ----------- | --------------------------------------------- | -------------------------------------------- |
| 30d 无执行  | trust_score × 0.95                            | 轻度衰减，触发提醒                           |
| 60d 无执行  | trust_score × 0.80                            | 中度衰减，自主权冻结在当前级别（不可晋升）   |
| 90d 无执行  | 自主权降一级 + trust_score 重置为目标级别下限 | 需重新积累执行记录才能恢复                   |
| 180d 无执行 | 自主权降至 suggestion                         | Agent 视为"休眠态"，需 domain_owner 重新激活 |

衰减评估由 `TrustDecayWorker` 每日运行，变更记录 `agent.autonomy.decayed` 事件到 event_log(§28)。domain_owner 可通过 DomainGovernancePolicy(§37.9) 调整衰减参数或对特定 Agent 豁免。

## 42.4 自主权变更审计

所有自主权变更记录到 event_log(§28)：

## 42.5 与现有架构的集成

| 现有组件               | 集成方式                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| §10 风险控制           | trust_score 只影响 automation_mode 与复核摩擦，不降低 inherent_risk       |
| §17 模型评估           | eval 质量退化自动触发信任降级                                             |
| §21 HITL               | 自主权决定 HITL 模式——suggestion 级必须人工确认，full_auto 级静默执行     |
| §37.2 DomainCapability | `max_automation_level` 作为天花板——信任再高也不能超过域设定的上限         |
| §41 主动 Agent         | 只有 semi_auto 以上才允许自动执行触发器，否则走建议模式                   |

---

# 43. 统一运营看板架构

> 为一人公司到万人企业提供分层运营视图，替代面向 SRE 的基础设施级 metrics。
> 关联：§12 异常事件 · §18 成本管理 · §27 SLO · §37.9 治理 · §42 自主权

## 43.1 看板分层

```text
┌─────────────────────────────────────────┐
│  L1 操作者视图（一人公司 / 业务负责人）    │  "一切是否正常？什么需要我关注？"
├─────────────────────────────────────────┤
│  L2 域管理视图（部门 Agent 管理员）        │  "我的域有哪些 Agent？绩效如何？"
├─────────────────────────────────────────┤
│  L3 平台运维视图（平台 SRE 团队）         │  "基础设施健康？资源利用率？"
├─────────────────────────────────────────┤
│  L4 舰队管理视图（万人企业平台团队）       │  "哪个部门有问题？全局容量？"
└─────────────────────────────────────────┘
```

## 43.2 L1 操作者视图

面向非技术用户的业务导向视图：

| 面板         | 内容                                       | 刷新频率 |
| ------------ | ------------------------------------------ | -------- |
| 我的任务状态 | 进行中 / 已完成 / 失败任务列表及进度百分比 | 实时     |
| 最近结果     | 最近 24h 已完成任务的摘要与输出链接        | 5min     |
| 待处理审批   | 需要当前用户确认的审批请求，按紧急度排序   | 实时     |
| Agent 健康   | 所属域 Agent 的可用率与当前自主权级别(§42) | 1min     |
| 预算概览     | 本月已用额度 / 剩余额度(§18)               | 1h       |

## 43.3 L2 域管理视图

面向部门 Agent 管理员的域运营视图：

| 面板          | 内容                                                  | 刷新频率 |
| ------------- | ----------------------------------------------------- | -------- |
| 域任务吞吐量  | 按小时/天的任务提交数与完成数趋势图                   | 5min     |
| Agent 利用率  | 域内各 Agent 的执行占比、排队深度、空闲率             | 1min     |
| 域级 SLO 达成 | P50/P95 延迟、成功率与 DomainDescriptor(§37) SLO 对比 | 5min     |
| Top 失败任务  | 按失败次数排序的任务类型，含根因分类与关联 Incident   | 5min     |
| 成本分布      | 域预算消耗明细：模型调用 / 工具调用 / 存储(§18)       | 1h       |

## 43.4 L3 平台运维视图

面向 SRE 团队的基础设施运维视图：

| 面板            | 内容                                                | 刷新频率 |
| --------------- | --------------------------------------------------- | -------- |
| 五面体健康      | P1-P5 Plane(§4) 各自的存活状态与组件 Ready 比例     | 10s      |
| 资源利用率      | CPU / 内存 / GPU / 队列深度的集群级热力图           | 30s      |
| 错误率趋势      | 按服务维度的 4xx/5xx 错误率与环比变化               | 1min     |
| 延迟分布        | P50/P95/P99 延迟，按 Interface→Execution→Model 拆分 | 1min     |
| Incident 时间线 | 活跃 Incident 列表与自动修复进度(§26)               | 实时     |

## 43.5 L4 舰队管理视图

面向万人企业平台团队的全局运维视图：

| 面板         | 内容                                             | 刷新频率 |
| ------------ | ------------------------------------------------ | -------- |
| 跨区域状态   | 各 Region 集群的可用性、同步延迟与故障转移就绪度 | 1min     |
| 舰队成本总览 | 全组织按域/区域/租户的成本分布与同比趋势(§18)    | 1h       |
| 租户对比     | 租户级 QPS、成功率、资源消耗的横向对比排名       | 5min     |
| 容量预测     | 基于历史趋势的 7d/30d 资源需求预测与扩容建议     | 6h       |
| 合规态势     | 审计策略覆盖率、敏感操作审批率、合规偏差数(§10)  | 1h       |

## 43.6 NL 状态摘要生成

看板支持自然语言摘要，由 ModelGateway(§15) 生成：

- **每日简报**："今天 5 个 Agent 完成 23 个任务（成功率 96%），花费 ¥45。广告域 Agent 表现优秀（ROI 2.8x）。有 2 个审批等待你处理，1 个预算告警需要关注。"
- **异常简报**："过去 1 小时，客服域 Agent 成功率从 95% 降至 78%，主要原因是知识库 API 响应变慢。已自动降级到缓存模式。建议你检查知识库服务状态。"
- **离开回来简报**："你离开的 8 小时内：完成 12 个任务，花费 ¥80。财务域有 1 个 P1 Incident（已自动恢复）。3 个审批已超时自动处理。无需立即行动。"

---

# 44. 非技术用户体验架构

> 使非开发者（业务负责人、独立运营者）能通过可视化界面使用平台全部能力。
> 关联：§22 SDK/DX · §38 接入 Runbook · §39 NL 入口 · §43 看板

## 44.1 用户角色分层

| 角色         | 技术水平 | 主要交互方式                 | 看板层级 |
| ------------ | -------- | ---------------------------- | -------- |
| 独立运营者   | 非技术   | NL 对话(§39) + L1 看板(§43)  | L1       |
| 业务线负责人 | 非技术   | L1 看板 + 可视化配置         | L1       |
| 域管理员     | 低代码   | 可视化配置 + 偶尔 CLI        | L2       |
| Pack 开发者  | 技术     | SDK + CLI(§22)               | L2/L3    |
| 平台 SRE     | 技术     | CLI + Admin API + L3/L4 看板 | L3/L4    |

## 44.2 可视化域接入向导

替代 §38 中面向技术人员的 CLI + YAML 流程：

```text
Step 1               Step 2               Step 3               Step 4
选择业务类型          配置核心能力          设置风控规则          激活上线
┌──────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ "你的业务 │        │ 拖拽选择  │        │ 风险滑块  │        │ 一键激活  │
│  是哪类？"│───────▶│ 需要的能力│───────▶│ 审批规则  │───────▶│ 灰度开始  │
│ [卡片选择]│        │ [工具面板]│        │ [预设模板]│        │ [进度条]  │
└──────────┘        └──────────┘        └──────────┘        └──────────┘
```

| 传统方式(§38)                                       | 可视化方式(§44)             |
| --------------------------------------------------- | --------------------------- |
| `agent-platform domain init --archetype=crud_heavy` | 卡片选择"客户服务类"        |
| 手动编辑 DomainDescriptor YAML                      | 表单填写 + 智能推荐         |
| `agent-platform domain validate`                    | 实时校验 + 红绿灯提示       |
| 多团队协作 5-9 周                                   | 向导引导 1-3 天（低风险域） |

## 44.3 可视化 Workflow 构建器

面向非技术用户的 workflow 编排界面：

## 44.4 智能引导式上手

```text
首次登录
    │
    ▼
┌──────────────────┐
│ "你好！我是你的   │
│  AI 业务助手。    │
│  你想用我做什么？"│
└───────┬──────────┘
        │ 用户描述业务
        ▼
┌──────────────────┐
│ 自动推荐          │
│ • 适合的域模板    │
│ • 需要的集成      │
│ • 预估成本        │
└───────┬──────────┘
        │ 用户确认
        ▼
┌──────────────────┐
│ 一键配置          │
│ • 创建 Domain     │
│ • 安装基础 Pack   │
│ • 设置默认风控    │
│ • 激活首个 Agent  │
└───────┬──────────┘
        │ 3 分钟后
        ▼
┌──────────────────┐
│ "你的第一个 Agent │
│  已就绪！试着说：  │
│ '帮我...'        │
└──────────────────┘
```

## 44.5 单人模式 vs 企业模式

平台根据用户数自动调整 UX 复杂度：

| 维度     | 单人模式                                    | 企业模式            |
| -------- | ------------------------------------------- | ------------------- |
| 租户     | 自动创建单租户，隐藏 tenant 概念            | 完整多租户管理      |
| 审批     | 自审批（低/中风险自动通过，高风险弹窗确认） | 完整审批流引擎(§21) |
| 安全审查 | 内置安全检查自动运行，无需人工安全团队      | 独立安全团队审查    |
| 接入流程 | 向导引导 3 分钟                             | 四阶段 Runbook(§38) |
| 看板     | L1 操作者视图 only                          | L1-L4 全层级        |
| 成本     | 个人预算视图 + 省钱建议                     | 部门级 chargeback   |
| 治理     | 简化（自己是 domain_owner）                 | 完整组织治理        |

## 44.6 无障碍访问（WCAG 2.1 AA）

| WCAG 原则 | 平台实施                                                                           |
| --------- | ---------------------------------------------------------------------------------- |
| 可感知    | 所有图表提供 alt text / 数据表替代视图；颜色不作为唯一信息载体（搭配形状/标签）    |
| 可操作    | 全部功能可通过键盘操作（Tab 顺序、Enter 确认、Esc 取消）；NL 入口支持语音输入(§68) |
| 可理解    | 错误消息明确指出问题和修复建议；表单标签与输入显式关联                             |
| 健壮性    | 语义化 HTML；ARIA 标注关键交互控件（看板卡片、审批按钮、workflow 画布节点）        |

**审计与测试**：每次前端发布前自动运行 axe-core 扫描；WCAG AA 违规视为 release blocker。

**前端实现要求**：WCAG 2.1 AA 合规需要实际的前端 UI 实现（React/Vue/Angular 等框架）。平台 TypeScript 代码提供数据模型、颜色对比度令牌（`getSeverityColorTokens()`）和可访问性标签构建函数（`buildAccessibleLabel()`），但实际 UI 组件必须在具体前端框架中实现。§21 HITL 通知组件（`src/platform/interface/console/hitl/notification.ts`）提供 TypeScript 逻辑，颜色值符合 WCAG AA 对比度要求（≥4.5:1），但渲染和交互实现由前端负责。

---

# Part VI — Harness 工程化与八支柱深化层（§45, §58）

---

# 45. Harness Runtime 权威执行模型

> 将平台分散的约束、工具、上下文、反馈能力收敛为统一的 Harness Runtime——标准化的 Agent 运行底座。融合 Anthropic 角色化闭环、LangGraph 持久运行时、OpenAI 治理与 Guardrails 原语三大行业流派的八支柱模型。Harness 不替代现有模块，而是把它们编排成闭环运行时。
> 关联：§13 OAPEFLIR · §5 平面间通信契约 · §10 风险控制 · §14 Execution Plane · §19.5 多 Agent 协作协议 · §21 HITL · §29 Memory/Knowledge · §37 业务域建模 · §42 渐进式自主权

## 45.1 Harness 核心公理

> **八支柱**：Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay

Harness 将一次性模型调用升级为"受约束、可执行、可记忆、可反馈、可恢复、可评测、可介入、可观测"的闭环系统。八支柱扩展来自三大行业流派的统一抽象：Anthropic 的 harness/eval harness（角色化闭环 + 评测运行时）、LangGraph 的 durable runtime（持久执行 + 记忆分层 + HITL interrupt/resume）、OpenAI 的 agents primitives/guardrails（工具治理 + 分层护栏 + 编排）。

| 支柱                 | 职责                                                   | 核心模块                                            |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Constraints          | 统一约束（Policy/Approval/Risk/Sandbox/Budget/Org）    | §45.3 ConstraintPack · §45.20 Guardrails            |
| Tools                | 统一工具（Executor/Plugin/Connector/MCP）              | §45.4 ToolbeltAssembler · §45.17 Tool Harness       |
| State/Memory         | 统一状态（Truth/Event/Checkpoint/Memory/Knowledge）    | §45.5 HarnessContext · §45.16 Memory Namespace      |
| Feedback             | 统一反馈（Step/Task/Workflow/System 级）               | §45.6 FeedbackEnvelope                              |
| Durability           | 统一持久执行（checkpoint/pause/resume/replay）         | §45.11 Recovery Controller · §45.15 Durable Harness |
| Evaluation Harness   | 统一评测（运行时裁决 + 离线评测 + 版本对比）           | §45.10 Evaluator Agent · §45.14 Evaluation Harness  |
| HITL Runtime         | 统一人机协作（inspect/patch/override/takeover/resume） | §21 HITL 审批 · §45.18 HITL Runtime                 |
| Observability/Replay | 统一可观测与回放（run trace + replay + audit）         | §58.1/§58.4 · §45.19 Async Harness                  |

每次任务运行都通过 HarnessRuntime 统一入口，装配约束、工具、上下文，驱动 Planner→Generator→Evaluator 多轮闭环，产出最终结果与证据链。v4.1 起 HarnessRuntime 是唯一可执行运行时，HarnessRun 是唯一权威 Run；OAPEFLIR 只提供 StageRationale、TraceProjection 与 Audit View，不创建独立运行实体。Harness 中的 `PlanBundle` 是产品层 wrapper，内部 canonical execution contract 必须是 `PlanGraphBundle`；P4 只按 PlanGraph / NodeRun 语义执行复杂任务。

**Harness 在五平面中的定位**：Harness 是 P3 Orchestration Plane 的统一运行时内核，通过协议下沉到 P4、通过状态上收于 P5、通过治理受控于 P2。

| 平面             | Harness 交互方式             | 关键协议/数据                                                  |
| ---------------- | ---------------------------- | -------------------------------------------------------------- |
| P1 Interface     | 接收请求信封                 | RequestEnvelope、SessionContext                                |
| P2 Control       | 消费治理指令                 | ControlDirective、Policy、Approval、Budget、Guardrails(§45.20) |
| P3 Orchestration | **Harness 即 P3 统一编排器** | HarnessRuntime、Planner/Generator/Evaluator 闭环               |
| P4 Execution     | 下发执行计划                 | ExecutionPlan / PlanGraphBundle、NodeRun、ToolCall、HITLWait、AsyncDispatch |
| P5 Evidence      | 写入运行证据                 | HarnessRun、HarnessStep、NodeRun、OapeflirTraceProjection、ContextSnapshot、Evidence |

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

## 45.3 ConstraintPack — 任务级约束信封

每次任务运行携带一个显式的约束包，使约束从隐含逻辑变为一级输入：

| 约束维度      | 说明                                                         | 来源                                             |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| autonomy_mode | suggestion / supervised / semi_auto / full_auto              | §42 渐进式自主权 + §37.2 DomainCapability 天花板 |
| budget        | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms | §18 成本管理 + §37.9 DomainGovernancePolicy |
| tool_policy   | allowed/denied tools + network/filesystem policy             | §11 安全 + §30 Pack Manifest + DomainDescriptor  |
| risk_policy   | max_risk_level + approval_required_at                        | §10 风险控制 + §37.3 DomainRiskProfile           |
| output_policy | require_evidence / require_evaluation / require_human_review | §21 HITL + §59 可解释性                          |

ConstraintPack 在 HarnessRuntime 入口由 ConstraintEngine 装配，合并平台默认策略、租户覆写、业务域覆写和任务级覆写（优先级递增）。

**现有模块映射**：PolicyCenterService · ApprovalService · RiskEvaluationEngine · CostAlertService

## 45.4 ToolbeltAssembler — 任务级工具装配

根据任务类型、业务域、风险等级、租户策略和当前上下文，装配最小可用工具集：

**装配流程**：

1. 从 DomainDescriptor(§37) 获取域允许的工具列表
2. 根据 ConstraintPack.tool_policy 过滤
3. 根据风险等级排除高风险工具（read_only 模式下排除所有写工具）
4. 根据租户预算排除超预算工具
5. 附加安全守卫（输入 schema 校验、输出 secret 扫描、沙箱层级绑定）
6. 附加工具可靠性画像（成功率、平均耗时、熔断状态），供 Planner 选择参考

**工具证据标准**：每次工具执行自动产出输入摘要、输出摘要、telemetry、artifact_ref、error_class、retryability，纳入 Evidence Plane(§P5)。

**现有模块映射**：ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor

## 45.5 HarnessContext — 统一运行时上下文

将分散的状态/记忆/知识/工件统一为运行时上下文对象，由 ContextAssembler 在每轮 loop 开始时装配：

**四类上下文**：

| 上下文               | 内容                                                        | 生命周期 |
| -------------------- | ----------------------------------------------------------- | -------- |
| Conversation Context | 用户对话、指令、偏好、NL 原始输入(§39)                      | 会话级   |
| Task Context         | 当前任务目标、PlanGraphBundle、NodeRun 状态、已完成节点的 Receipt | 任务级   |
| Memory Context       | 历史经验、长期记忆、Agent 行为模式(§29)                     | 持久化   |
| Knowledge Context    | 外部知识、文档、检索结果、DomainKnowledgeSchema(§37.4)      | 按需检索 |

**上下文预算**：不是所有内容都能塞给模型。ContextAssembler 对每轮 loop 的上下文执行：

- Token budget 裁剪（总 token 预算 = ConstraintPack.budget.max_cost 换算）
- Relevance score 排序（与当前步骤目标的相关性）
- Freshness score 排序（最近的上下文优先）
- Trust score 过滤（不可信来源的知识标记 confidence）

**上下文快照**：每轮 loop 保存 `ContextSnapshot` 到 P5 Checkpoint，用于崩溃恢复、回放、差异分析、调试器时间旅行(§65)。

**现有模块映射**：MemoryPlaneService · KnowledgePlaneService · AuthoritativeTaskStore · ArtifactStore

## 45.6 FeedbackEnvelope — 统一反馈协议

将分散的反馈信号收口为标准化信封，建立四段反馈闭环：

**四段闭环**：

| 反馈层级    | 触发时机                   | 评估内容                               | 产出                                |
| ----------- | -------------------------- | -------------------------------------- | ----------------------------------- |
| Step 级     | 单次工具/模型调用完成后    | 输出质量、耗时、成本、是否偏离预期     | 立即判断：continue / retry / replan |
| Task 级     | 一个 Task 所有 step 完成后 | 是否达成 Task 目标、是否符合验收标准   | 汇总评分 + 改进建议                 |
| Workflow 级 | 多步流程全部完成后         | 是否达成业务目标、端到端质量           | 最终评估报告                        |
| System 级   | 累积足够反馈信号后（异步） | 是否需要更新 prompt/policy/tool_config | LearningCandidate / ImprovementChangeSet → P2 Release |

Step 级反馈由 Evaluator Agent 实时产出；Task/Workflow 级由 Evaluator 汇总；System 级由 Learn/Improve(§13.2) 异步处理。

**现有模块映射**：FeedbackCollector · PostExecutionQualityGate · StrategyLearningService · ApprovalContextSummaryService

## 45.7 HarnessLoopController — 统一闭环控制

将循环控制逻辑从分散的多个 service 收口到单一控制器：

**控制决策矩阵**：

| Evaluator 输出 | Loop 行为                 | 条件                        |
| -------------- | ------------------------- | --------------------------- |
| accept         | 推进到下一步（或完成）    | score ≥ quality_threshold   |
| retry          | 重试当前步骤（同一 plan） | retry_count < max_retries   |
| replan         | 触发 Planner 重新规划并生成 GraphPatch / 新 graphVersion | replan_count < max_replans  |
| escalate       | 转人工(§21 HITL)          | risk 升高 / confidence 过低 |
| abort          | 安全终止 + 记录证据       | 预算耗尽 / 不可恢复错误     |

**循环守卫**：

- 最大循环次数（默认 10，由 ConstraintPack.budget.max_steps 约束）
- 最大 replan 次数（默认 3）
- 总耗时上限（由 ConstraintPack.budget.max_duration_ms 约束）
- 总成本上限（由 ConstraintPack.budget.max_cost 约束）
- 任一守卫触发 → 强制终止 + escalate

**现有模块映射**：OapeflirLoopService · RolloutStateMachine · TransitionService

## 45.8 Planner Agent — 规划职责

Planner Agent 负责理解目标、分解任务、识别风险、生成执行计划。

**标准化输出 PlanBundle / PlanGraphBundle**：

`PlanBundle` 是面向产品、调试和解释层的 wrapper；`PlanGraphBundle` 是 P3→P4 的 canonical execution contract。Planner 可以先生成 GoalSpec / task_graph / success_criteria，但进入执行前必须转换为 PlanGraphBundle，并完成 Normalize / Validate / Risk Propagation / Worst-Path Analysis。

| 字段             | 说明                                    |
| ---------------- | --------------------------------------- |
| goal             | 原始目标 + 结构化 GoalSpec              |
| task_graph       | 任务依赖 DAG（复用 §40 GoalDecomposer） |
| plan_graph_bundle | 可执行 PlanGraphBundle（P4 唯一执行输入） |
| execution_budget | 步骤/时间/成本预算分配                  |
| risk_profile     | 风险评估快照（复用 §10 RiskAssessment） |
| success_criteria | 可量化的验收标准列表                    |
| evaluator_hints  | 给 Evaluator 的评估提示（关注哪些指标） |

**Prompt 分离**：Planner 使用专用 Planner Prompt（从 DomainPromptLibrary §37.6 获取），不与 Generator/Evaluator 共用模板。

**现有可复用模块**：IntakeRouter · AssessmentService · PlanGraphBuilder · GraphNormalizer · GoalDecomposer · PolicyCenterService

## 45.9 Generator Agent — 执行职责

Generator Agent 负责调用工具、执行步骤、写回证据、生成阶段性结果。

**标准化输出 WorkProduct**：

| 字段           | 说明                                         |
| -------------- | -------------------------------------------- |
| step_id        | 当前执行步骤 ID                              |
| artifacts      | 产出的工件引用列表                           |
| observations   | 执行过程中的观察记录                         |
| result_summary | 结果摘要（供 Evaluator 评估）                |
| telemetry      | 步骤级遥测（耗时、token 消耗、工具调用次数） |

**关键行为约束**：

- 遇到阻塞（工具不可用、权限不足、外部超时）时请求帮助（触发 escalate），不硬闯
- 所有工具调用通过 Toolbelt 过滤，不可直接调用未装配的工具
- 每步执行完自动产出证据（输入/输出/side_effect），写入 P5

**现有可复用模块**：ExecutionDispatchService · MultiStepSupervisor · ToolExecutor · PluginExecutor · UnifiedChatProvider

## 45.10 Evaluator Agent — 评估职责

Evaluator Agent 负责判断结果质量、检查目标偏离、决定下一步行动。

**标准化输出 EvaluationReport**：

| 字段           | 说明                                       |
| -------------- | ------------------------------------------ |
| passed         | 是否通过                                   |
| score          | 质量评分 0-100                             |
| issues         | 发现的问题列表（类型 + 严重程度 + 位置）   |
| recommendation | accept / retry / replan / escalate / abort |
| confidence     | 评估置信度 0.0-1.0                         |

**评估维度**：

- **目标偏离**：当前结果与 PlanBundle.success_criteria / PlanGraph terminal criteria 的距离
- **质量门禁**：复用 §17 模型评估 + DomainEvalFramework(§37.5)
- **风险变化**：执行后风险是否升高（对比 PlanGraphBundle.riskProfile 与 GraphRiskPropagationReport）
- **成本合理性**：实际 token/时间消耗是否在预算范围内

**Prompt 分离**：Evaluator 使用专用 Evaluator Prompt，不与 Planner/Generator 共用。

**现有可复用模块**：FeedbackCollector · StrategyLearningService · PostExecutionQualityGate · ApprovalContextSummaryService · SloAlertingService

## 45.11 Recovery Controller

当 Harness 运行过程中发生故障（worker 崩溃、外部超时、模型不可用），Recovery Controller 基于 ContextSnapshot(§45.5) 执行恢复：

| 故障类型            | 恢复策略                                                    |
| ------------------- | ----------------------------------------------------------- |
| Worker 崩溃         | 从最近 ContextSnapshot 恢复，重新申请 lease，从断点继续     |
| LLM Provider 不可用 | 触发 ModelGateway(§15) fallback chain，切换 provider 后继续 |
| 工具超时            | 由 LoopController 决定 retry（同工具）或 replan（替换工具） |
| 预算耗尽            | 安全终止 + 保存当前状态 + 通知用户                          |
| PlatformPanic(§60)  | 立即序列化完整状态到 checkpoint，等待平台恢复后续接         |

复用现有 Recovery Workers（LeaseReclaimer · StuckRunSweeper）和 Checkpoint 机制(§14)。

## 45.12 与现有架构的集成

| 现有组件            | Harness 集成方式                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------- |
| §5 平面间契约       | HarnessRuntime 作为 P3 Orchestration 的统一入口，接收 RequestEnvelope，输出 ExecutionPlan / PlanGraphBundle |
| §10 风险控制        | ConstraintPack.risk_policy 由 RiskAssessmentEngine 装配                                   |
| §13 OAPEFLIR        | Planner/Generator/Evaluator/Loop 是 OAPEFLIR 八阶段的外部简化映射(§13.5)                  |
| §14 Execution Plane | Generator Agent 通过标准 PlanGraphBundle → Graph Scheduler → NodeRun → ExecutionReceipt 路径执行 |
| §21 HITL            | LoopController 的 escalate 路径直接调用 HITL 审批流                                       |
| §37 业务域建模      | DomainDescriptor 驱动 ConstraintPack/Toolbelt/Context 的域级配置                          |
| §42 渐进式自主权    | ConstraintPack.autonomy_mode 由 AgentTrustProfile 决定                                    |
| §59 可解释性        | 每轮 loop 的 PlanBundle/PlanGraphBundle/WorkProduct/EvaluationReport 自动纳入解释管线      |
| §65 调试器          | ContextSnapshot 序列支撑时间旅行调试                                                      |

## 45.13 HarnessRun / HarnessStep — 统一运行契约

> 将运行实体和步骤实体定义为一级契约。

**HarnessRun** 代表一次完整的 Harness 任务运行：

| 字段             | 说明                                                      |
| ---------------- | --------------------------------------------------------- |
| runId            | 全局唯一 run 标识                                         |
| tenantId         | 租户                                                      |
| goal             | 原始目标 + 结构化 GoalSpec                                |
| mode             | sync / async（§45.19）                                    |
| riskLevel        | 运行时风险等级（由 ConstraintPack 决定）                  |
| budget           | max_cost / max_model_tokens / max_context_tokens / max_output_tokens / max_steps / max_duration_ms |
| constraintPack   | 本次 run 的约束快照（§45.3）                              |
| plannerOutput    | PlanBundle / PlanGraphBundle（§45.8）                     |
| steps            | HarnessStep 序列                                          |
| currentIteration | 当前 loop 轮次                                            |
| maxIterations    | 由 ConstraintPack 约束                                    |
| finalDecision    | accept / abort / escalate / timeout                       |
| status           | pending / running / paused / completed / failed / aborted |
| traceId          | 分布式 trace 关联                                         |
| ownership        | 归属 agent / tenant / domain                              |
| auditRefs        | 审计证据引用列表                                          |

**HarnessStep** 代表一个执行步骤：

| 字段         | 说明                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| stepId       | 步骤标识                                                                  |
| phase        | plan / execute / evaluate / hitl / decision                               |
| role         | planner / generator / evaluator / hitl_operator / loop_controller         |
| inputs       | 步骤输入（上下文快照引用）                                                |
| outputs      | 步骤输出（PlanBundle / PlanGraphBundle / GraphPatch / WorkProduct / EvaluationReport / HarnessDecision） |
| rationale    | 决策理由（纳入 §59 可解释性）                                             |
| evidenceRefs | P5 证据引用                                                               |
| toolCalls    | 工具调用记录列表                                                          |
| latency      | 步骤耗时                                                                  |
| cost         | token/API 成本                                                            |
| error        | 错误信息（如有）                                                          |
| nextAction   | 下一动作（由 HarnessDecision 决定）                                       |

**HarnessDecision** 固定六种裁决（详见 §58.6）：accept · retry_same_plan · replan · escalate_to_human · downgrade_mode · abort。

**现有模块映射**：AuthoritativeTaskStore · ExecutionReceipt · OapeflirLoopService · AuditService

## 45.14 Evaluation Harness — 统一评测运行时

> §45.10 Evaluator Agent 负责运行时裁决。本节补齐**离线评测、预发布评测、版本对比**三类评测能力，构成完整的 Evaluation Harness。
> 行业参考：Anthropic "最终 outcome 比 transcript 更重要"；evaluation harness 应在受控环境中运行任务、观察环境状态、聚合结果。

**三类评测模式**：

| 评测模式     | 触发时机                                      | 评测内容                                               | 产出                         |
| ------------ | --------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| 运行时评测   | 每步 / 每任务完成后                           | Evaluator Agent 实时裁决（§45.10）                     | EvaluationReport             |
| 预发布评测   | 新 Prompt/Planner/Evaluator/ToolBundle 上线前 | 在隔离沙箱中运行标准任务集                             | 通过率 / 回归对比 / 质量分布 |
| 版本对比评测 | 定期 / 灰度期间                               | 对比新旧版本的成功率/迭代轮数/成本/失败模式/升级人工率 | 对比报告 + 灰度决策建议      |

**评测重点——outcome 而非 transcript**：

- 任务是否真正完成（环境状态是否到达目标态）
- 是否违反治理与合规
- 是否比旧版本更稳定
- 端到端成本与效率

**评测运行时组件**：

- EvalRunService：管理评测任务的创建、调度、隔离执行
- TaskOutcomeGrader：基于 success_criteria 和环境状态断言评分
- EnvironmentStateAssertionService：在受控环境中验证最终状态
- AgentTrajectoryRecorder：记录完整执行轨迹供回放分析
- EvalAggregationService：聚合多任务评测结果，生成统计报告

**现有模块映射**：PostExecutionQualityGate · §17 模型评估 · DomainEvalFramework(§37.5)

## 45.15 Durable Harness — 持久执行支柱

> §45.11 Recovery Controller 处理故障恢复。本节将持久执行从恢复策略升级为一级支柱——checkpoint/pause/resume 是 Harness 的基础能力，不是附加能力。
> 行业参考：LangGraph "durable execution = 流程在关键点保存进度，之后可以暂停并从原位置恢复"。

**暂停原因注册表**：

| pauseReason                  | 说明                   | 典型场景                       |
| ---------------------------- | ---------------------- | ------------------------------ |
| waiting_for_human            | 等待人工审批/介入      | HITL Runtime(§45.18) escalate  |
| waiting_for_external_event   | 等待外部系统回调       | Webhook / 第三方审批 / CI 结果 |
| waiting_for_budget_reset     | 预算耗尽，等待下一周期 | Token/成本预算触顶             |
| waiting_for_policy_clearance | 等待策略审核通过       | 高风险动作需 P2 审批           |
| waiting_for_dependency       | 等待上游任务/数据就绪  | DAG 依赖未满足                 |

**恢复策略**：

| resumeStrategy     | 说明                         | 适用场景                   |
| ------------------ | ---------------------------- | -------------------------- |
| resume_same_state  | 从精确断点恢复，状态不变     | 人工审批通过、外部回调到达 |
| resume_with_replan | 恢复时触发 Planner 重新规划  | 上下文已变化、策略已更新   |
| resume_supervised  | 恢复后进入 supervised 模式   | 高风险恢复、信任降级       |
| abort_on_resume    | 恢复时判断不可继续，安全终止 | 超时过久、环境已不可逆     |

**关键机制**：

- 每轮 loop 的 ContextSnapshot(§45.5) 是 Durable Harness 的持久化基础
- §20 长时任务休眠机制作为 Durable Harness 的底层实现
- pause 时序列化完整 HarnessRun 状态到 P5 Checkpoint
- resume 时由 ResumeStrategyService 根据 pauseReason + 当前环境选择策略

**现有模块映射**：HibernationService · RecoveryWorker · LeaseReclaimer · StuckRunSweeper · CheckpointService

## 45.16 Memory Namespace 与策略

> §45.5 HarnessContext 将记忆作为上下文类型。本节补齐三层记忆命名空间和晋升策略。
> 行业参考：LangGraph 明确区分 thread-scoped 短期记忆和跨线程长期记忆；OpenAI 把 state/memory 作为核心原语。

**三层记忆命名空间**：

| 层次                    | 作用域                    | 内容                                                                                     | 生命周期                         |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| Working Memory          | 当前 run / 当前 iteration | 当前目标摘要、计划摘要、问题清单、预算余量、风险与模式、已选工具、最近失败原因、关键证据 | run 结束后归档                   |
| Long-term Memory        | 跨 run / 跨 project       | 历史经验、Agent 行为模式、任务成功/失败模式、常用工具组合                                | 持久化，按 retention policy 过期 |
| Shared Knowledge Memory | 可提升为通用经验的知识层  | 跨 agent / 跨 domain 的最佳实践、常见失败的恢复方案、评估规则建议                        | 需人工审核后晋升                 |

**记忆晋升策略**：

- Working → Long-term：run 结束后，Evaluator 标记为"有价值"的 observation 自动候选晋升，经 MemoryPromotionPolicy 审核
- Long-term → Shared Knowledge：累积 N 次跨 agent 验证后候选晋升，需人工审核
- 反向降级：Long-term 中连续 M 次无引用的条目自动标记为 stale，超期清理

**命名空间隔离**：

- 租户隔离：不同 tenant 的 Long-term Memory 物理隔离
- 域隔离：同一 tenant 内不同 domain 的 Working Memory 逻辑隔离
- 跨域共享：需经过 §50 知识域隔离与受控共享 的访问控制

**现有模块映射**：MemoryPlaneService · KnowledgePlaneService · §29 Memory/Knowledge 边界 · §50 知识域隔离

## 45.17 Tool Harness — 工具治理

> §45.4 ToolbeltAssembler 负责按任务装配工具子集。本节将工具从"能调就行"升级为"被治理的一级资源"。
> 行业参考：OpenAI/Anthropic 都指出工具的 schema、适用边界、可信度、调用成本和失败语义都应被治理。

**工具能力画像（Tool Capability Profile）**：
每个注册工具必须附带：

| 画像字段            | 说明                                                         |
| ------------------- | ------------------------------------------------------------ |
| toolId              | 全局唯一标识                                                 |
| capabilityType      | read / write / compute / network / filesystem / browser / db |
| riskLevel           | low / medium / high / critical                               |
| expectedLatency     | P50/P99 预期耗时                                             |
| expectedCost        | 每次调用的 token/API 成本估算                                |
| reliabilityScore    | 历史成功率（动态更新）                                       |
| requiredPermissions | 所需权限列表                                                 |
| allowedDataClasses  | 允许处理的数据分类（PII/confidential/public）                |
| allowedTenants      | 租户白名单（空=全部）                                        |
| allowedDomains      | 域白名单（空=全部）                                          |
| outputTrustLevel    | 输出可信度等级（verified / unverified / untrusted）          |

**工具调用治理记录**：
每次工具调用自动记录：

- 选择理由（由 Planner/Generator 的哪个推理步骤选择）
- 调用结果（成功/部分成功/失败）
- 输出是否可信
- 是否进入 Long-term Memory
- 是否触发 fallback
- 是否触发 Guardrails(§45.20)

**工具生命周期**：registered → active → deprecated → retired，与 §30 Pack 生命周期对齐。

**现有模块映射**：ToolExecutor · PluginExecutor · BrowserExecutor · AdapterExecutor · §30 Pack Manifest

**工具选择治理**（Tool Selection Governance）：

工具调用并非自由选择，而是受治理约束的三阶段流程：

| 阶段     | 对象                   | 说明                                                    |
| -------- | ---------------------- | ------------------------------------------------------- |
| 候选筛选 | ToolSelectionCandidate | ConstraintPack + domain + risk-tier 过滤后的可用工具集  |
| 选择决策 | ToolSelectionDecision  | 记录 Planner/Generator 选择此工具的推理依据与备选项     |
| 回退策略 | ToolFallbackPolicy     | 工具调用失败时的 fallback 链（降级工具 → 人工 → abort） |

四条硬规则：

1. Planner 只能从 ToolSelectionCandidate 集合中选择工具，不得跳出约束边界
2. Generator 不得绕过 Planner 的选择结果直接调用未选工具
3. Evaluator 事后评估工具选择合理性，不合理时可要求 Planner 重选
4. risk-tier ≥ high 的工具必须配置 ToolFallbackPolicy，否则 ConstraintPack 校验不通过

## 45.18 HITL Runtime — 人机协作运行时

> §21 定义 HITL 审批模式，§45.7 LoopController 提供 escalate 路径。本节将 HITL 从审批流升级为 Harness 原生运行时——人类不是只在流程边审批，而是能在运行中看状态、改状态、继续执行。
> 行业参考：LangGraph "checkpointer 让人类可以在运行中检查、打断、批准、修改状态后恢复"；OpenAI "guardrails 与 human review 共同决定 run 何时继续、暂停或停止"。

**五类 HITL 能力**：

| 能力     | 说明                                                                   | 触发方式                       |
| -------- | ---------------------------------------------------------------------- | ------------------------------ |
| Inspect  | 查看当前 run 状态、plan、context、evaluator findings                   | 主动查看 / 看板(§43) 入口      |
| Patch    | 修改 planner output / working context / constraints / success criteria | 人工在 HITL 界面修改后写回     |
| Override | 覆盖 evaluator recommendation / mode / budget / selected tools         | 人工覆盖裁决                   |
| Takeover | 直接人工接管执行，Generator 暂停                                       | 高风险 / 信任不足 / 紧急场景   |
| Resume   | 人工处理后恢复自动运行（关联 §45.15 resumeStrategy）                   | Patch/Override/Takeover 后触发 |

**HITL 与 Durable Harness 的关系**：

- HITL 触发 → Durable Harness pause（pauseReason = waiting_for_human）
- 人工完成 → Durable Harness resume（resumeStrategy 由人工选择或自动推荐）
- 所有 HITL 操作写入审计日志（§12 审计 + §59 可解释性）

**HITL 超时策略**：

- 默认等待时长由 §21 HITL 模式配置
- 超时后按 ConstraintPack 的 escalation_policy 升级到更高审批层级或 abort

**现有模块映射**：ApprovalService · TakeoverController · §21 HITL 模式 · §47 审批路由

**HITL 状态机**：

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

**状态转换规则**：

| 操作     | 前置状态                           | 后置状态                      | 影响范围                            |
| -------- | ---------------------------------- | ----------------------------- | ----------------------------------- |
| Inspect  | Paused_for_Human                   | Inspecting → Paused_for_Human | 只读，不改变 run 状态               |
| Patch    | Paused_for_Human                   | Patched → 等待 resume         | 修改 context/variables，不改变 plan |
| Override | Paused_for_Human                   | Overridden → 等待 resume      | 替换当前 plan 或 step 结果          |
| Takeover | Paused_for_Human                   | Manual_Takeover → 等待 resume | 人工全权接管，agent 暂停推理        |
| Resume   | Patched/Overridden/Manual_Takeover | Resumed → Running             | 恢复自动执行，携带人工修改          |
| Abort    | 任意 Paused 子状态                 | Aborted                       | 终止 run，记录终止原因              |

## 45.19 Async Harness — 异步运行模式

> 补齐异步运行模式，适配企业多小时/多轮/多审批的异步工作场景。
> 行业参考：Anthropic "预构建、可配置、运行在托管基础设施中的 agent harness，适合长时任务和异步工作"。

**两种运行模式**：

| 模式          | 适用场景                                                           | 交互方式                                   |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| Sync Harness  | 秒级任务、会话内响应、简单工具链                                   | 请求-响应，阻塞等待结果                    |
| Async Harness | 多小时任务、多轮协作、多次审批、长时分析、自动化流水线、批量任务群 | 创建 run → 轮询/订阅 → 中途介入 → 最终结果 |

**Async Harness 能力**：

- create_run：创建异步 HarnessRun，返回 runId
- poll_status：按 runId 查询当前状态和进度
- subscribe_events：通过 Webhook/SSE 订阅 run 事件流
- inspect_step：查看任意步骤的详细信息
- intervene_mid_run：中途触发 HITL Runtime(§45.18) 的任意操作
- replay_after_completion：完成后回放分析（§58.4）

**Async 与 Durable 的关系**：Async Harness 依赖 Durable Harness(§45.15) 的 checkpoint/pause/resume 机制。每个 Async run 天然支持中断和恢复。

**现有模块映射**：§20 长时任务 · WebhookDeliveryService · §43 看板 · EventBus

## 45.20 Guardrails 分层架构

> §45.3 ConstraintPack 将约束收口为任务级信封。本节在 ConstraintPack 之上建立五层 Guardrails，使护栏贯穿 Harness 全流程。
> 行业参考：OpenAI "guardrails 不应该只在入口做统一风险评估，而应分层进入全流程"。

**五层 Guardrails**：

| 层次                | 检查时机            | 检查内容                                                             | 拦截动作               |
| ------------------- | ------------------- | -------------------------------------------------------------------- | ---------------------- |
| Input Guardrails    | 请求进入 Harness 前 | prompt injection · 敏感请求分类 · 不支持的目标检测 · 输入格式校验    | 拒绝 / 改写 / 降级     |
| Planning Guardrails | Planner 输出后      | 禁止的 plan 模式 · 越权委托 · 过宽工具范围 · 不安全的目标分解        | 要求 replan / escalate |
| Tool Guardrails     | 工具调用前后        | 不可信工具输出 · 不安全 API 目标 · 过宽文件/DB 访问 · 高风险动作升级 | 拦截 / 降权 / 要求确认 |
| Memory Guardrails   | 记忆读写时          | 禁止留存内容 · 不安全的 Long-term 晋升 · 跨租户泄漏 · 边界违反       | 拒绝写入 / 脱敏        |
| Output Guardrails   | 结果返回前          | 策略违规 · 不安全执行建议 · 受管制内容 · 过高置信度无依据声明        | 过滤 / 改写 / 标注     |

**Guardrails 与 ConstraintPack 的关系**：ConstraintPack 定义"约束是什么"，Guardrails 定义"约束在哪里执行、怎么拦截"。两者互补：ConstraintPack 是静态约束信封，Guardrails 是动态执行检查点。

**现有模块映射**：§10 风险控制 · §11 安全 · §16.5 Prompt 注入防御 · §23 合规 · §68 多模态安全

## 45.21 Harness 十条不变量

> 企业级 Harness 运行的底线规则。任何实现和配置都不可绕过。

1. 任何复杂任务必须先有 PlannerOutput，禁止无计划直接执行
2. 任何 GeneratorOutput 必须对应 EvaluatorReport，禁止跳过评估
3. 任何 retry / replan / escalate / abort 必须记录 HarnessDecision 及原因
4. 任何长任务（duration > 60s 或 steps > 3）必须有 iteration checkpoint
5. 任何工具输出进入 Long-term Memory 前必须经过 trust/promotion 规则（§45.16/§45.17）
6. 任何人工 override 必须写入审计日志，关联 traceId 和 operator 身份
7. 任何多 agent run 必须明确 planner/generator/evaluator/controller 责任主体
8. 任何 async run 必须支持状态查询（poll_status）与中途介入（intervene_mid_run）
9. 任何高风险 run（risk_level ≥ high）必须支持 downgrade_mode 或 HITL escalate
10. 任何 harness run 必须可 trace（§58.1）、可 replay（§58.4）、可 audit（§12）

## 45.22 OAPEFLIR-Harness 收敛契约

Harness 是唯一可执行运行时；OAPEFLIR 是运行语义、治理阶段和解释投影。两者的收敛关系：

| Harness 对象 | OAPEFLIR v4.1 投影 / 契约 | 说明 |
| --- | --- | --- |
| HarnessRun | OapeflirTraceProjection | OAPEFLIR 阶段视图由 HarnessRun / HarnessStep / NodeRun 事件派生 |
| HarnessStep / NodeRun | Execute 阶段投影 | 步骤与节点是权威执行实体，OAPEFLIR 只解释其阶段语义 |
| PlanBundle / PlanGraphBundle | Plan 阶段输出视图 | Planner 输出必须图化、校验、风险传播，PlanGraph 属于 `HarnessRun.plannerOutput` |
| HarnessDecision | DecisionInputBundle + Decision Engine | 裁决前冻结输入，裁决后事件化 |
| ContextSnapshot | ContextAssemblyContract output | 每轮上下文装配可回放 |
| Evaluation Harness | EvaluationGate | 运行时评估与发布前门禁统一 |
| HITL Runtime | HumanResponsibilityRecord | 人工批准 scope 与责任边界显式记录 |

Harness Runtime 不得绕过 PlanGraph、Event Registry、Budget Ledger、SideEffect Manager 和 EvaluationGate；OAPEFLIR 投影也不得反向驱动 HarnessRun 状态迁移。

## 45.23 Context Assembly Contract

Planner、Generator、Evaluator 必须使用独立 ContextAssemblyContract，避免角色间上下文污染。

| 字段 | 说明 |
| --- | --- |
| role | planner / generator / evaluator |
| inputRefs | Request、Observation、Assessment、PlanGraph、NodeRun、Artifact、Memory 引用 |
| taintPolicy | 工具输出、用户输入、外部知识的 taint 传播规则 |
| budget | token / latency / retrieval 次数预算 |
| rankingPolicy | relevance / freshness / trust / recency 排序 |
| redactionPolicy | secret / PII / regulated data 脱敏规则 |
| outputSnapshotRef | 冻结后的上下文快照 |

Context 装配必须输出可审计快照；LLM 调用只消费 snapshot，不直接读任意运行态对象。

## 45.24 Prompt Execution Contract

Prompt 执行前必须冻结以下信息：

- promptId、promptVersion、role、model policy、output schema
- contextSnapshotRef、toolOutputTaint、memoryReadRefs
- budgetReservationRef、traceId、runVersionLockRef
- trace replay 所需的 recorded output refs、scheduler decision refs，或 re-execution replay 的不可确定性声明

Planner / Generator / Evaluator Prompt 必须独立版本化、独立 rollout、独立评测。LLM 输出必须经过 schema validation、guardrail、taint propagation 和 Evaluation 约束后才能进入下一阶段。

## 45.25 DecisionInputBundle

Decision Engine 裁决前必须冻结 DecisionInputBundle：

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

裁决优先级：deterministic failure / policy deny / budget exhausted / critical guardrail block 优先于 LLM evaluator accept。LLM-as-Judge 不能覆盖确定性失败。

## 45.26 Memory Write Governance

Memory 写入不是 Generator 的自由副作用。任何写入 Long-term Memory 或 Shared Knowledge 的请求必须形成 `MemoryWriteRequest`，包含 source、confidence、taint、data class、TTL、promotion target 和 reviewer policy。禁止 secret、未脱敏 PII、holdout eval 数据、低置信工具输出直接进入长期记忆。

## 45.27 HITL Responsibility Record

每次人工 approve、reject、patch、override、takeover、resume 都必须生成 HumanResponsibilityRecord：

| 字段 | 说明 |
| --- | --- |
| actor | 人工主体与组织归属 |
| action | approve / reject / patch / override / takeover / resume |
| scope | 本次批准或覆盖影响的 run / node / sideEffect / budget / policy 范围 |
| rationale | 人工决策理由 |
| beforeRef / afterRef | 变更前后快照 |
| expiresAt | 授权有效期 |
| auditRef | 审计记录 |

HITL approve 只批准声明的 scope，不得隐式扩大到后续 node、child run 或不可逆副作用。

---

# 58. Harness 横切关注面

> Harness Runtime(§45) 引入后产生的横切工程化需求——Harness 级可观测性、Prompt 分层治理、Failure-to-Learning 管线、Replay/Simulation、架构遗留问题收口、以及统一裁决协议。
> 关联：§45 Harness Runtime · §12 异常事件 · §16 Prompt 管理 · §27 SLO · §65 调试器

## 58.1 Harness 级可观测性

现有可观测性(§9.7, §12, §27)面向基础设施和平面粒度。Harness 需要**按 run 粒度**观测全链路：

| 指标                              | 说明                              | SLO                                         |
| --------------------------------- | --------------------------------- | ------------------------------------------- |
| harness.run.duration              | 单次 HarnessRun 端到端耗时        | P99 < 业务域 SLO 定义                       |
| harness.loop.count                | 单次 run 的 loop 次数             | mean < 3，max ≤ ConstraintPack.max_steps    |
| harness.replan.count              | 重规划次数                        | mean < 1                                    |
| harness.evaluator.score           | Evaluator 评分分布                | P50 ≥ 80                                    |
| harness.constraint.rejection_rate | ConstraintPack 拦截率             | < 5%（过高说明约束过严或任务描述不清）      |
| harness.context.token_utilization | 上下文 token 预算利用率           | 60%-90%（过低浪费，过高可能截断关键上下文） |
| harness.tool.reliability          | Toolbelt 中各工具的实时可靠性画像 | 成功率 ≥ 95%                                |

所有指标通过 Harness Telemetry Middleware 自动采集，写入 P5 Evidence Plane，供 §43 看板和 §65 调试器消费。

## 58.2 Prompt 分层治理

Harness 三类 Agent 各需独立 Prompt 策略，不可混用：

| Prompt 类型      | 职责                                   | 治理要求                                                        |
| ---------------- | -------------------------------------- | --------------------------------------------------------------- |
| Planner Prompt   | 目标理解、任务分解、风险识别、计划生成 | 通过 §17 质量门禁后才能发布；与 DomainPromptLibrary(§37.6) 关联 |
| Generator Prompt | 工具选择、步骤执行、结果生成           | 独立版本化；A/B 测试通过后才能全量                              |
| Evaluator Prompt | 质量判断、目标偏离检测、改进建议       | 独立于被评估对象；不可与 Generator Prompt 共享版本              |

Prompt 分层纳入 §16 Prompt 管理体系，每类 Prompt 有独立的 rollout channel。

## 58.3 Failure-to-Learning 管线

将失败样例自动沉淀为平台知识资产：

```text
Step 失败
  → FeedbackEnvelope(outcome=failed)
    → 失败模式分类（error_class + root_cause_category）
      → 自动生成 candidate:
         ├── Recovery Playbook（恢复操作手册）
         ├── Prompt Patch Candidate（Prompt 修补建议）
         ├── Risk Rule Candidate（风险规则建议）
         └── Evaluator Rule Candidate（评估规则建议）
      → 人工审核 → P2 Release 治理 → 灰度上线
```

关键约束：所有 candidate 只是建议，必须经过 §34 ADR-Quality-Gate-Before-Prompt-Release 和 P2 审批后才能生效。

## 58.4 Harness Replay 与 Simulation

基于 Event Registry、ContextSnapshot 序列(§45.5)和已记录的 LLM/Tool/Scheduler 输出，支持：

| 能力         | 说明                                              | 用途               |
| ------------ | ------------------------------------------------- | ------------------ |
| Trace Replay | 对已完成的 HarnessRun 按事件、记录输出和调度决策重建 | 故障定位、审计取证、投影重建 |
| 策略对比     | 隔离环境中用不同 ConstraintPack 重新执行          | 约束调优           |
| Prompt A/B   | 隔离环境中用不同 Planner/Generator/Evaluator Prompt 重新执行 | Prompt 优化 |
| 工具替换模拟 | 在 Toolbelt 中替换工具后重新执行                  | 工具迁移评估       |
| What-if 分析 | 修改 ContextSnapshot 中某个值后重新执行           | 根因分析           |

默认 Replay 是 Trace Replay：不重新调用 LLM / Tool，不写 production truth，不产生真实 SideEffect。策略对比、Prompt A/B、工具替换模拟和 What-if 属于 Re-execution Replay，必须标记 nondeterministic，在隔离沙箱中运行(§34 ADR-Workflow-Debug-Session-Isolated)，结果不得覆盖原 HarnessRun evidence。

## 58.5 架构遗留问题收口

收口以下跨章节遗留问题：

| 问题                                                                   | 所在章节     | 收口方式                                                                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §21 HITL 审批 vs §47 组织审批路由职责重叠                              | §21, §47     | §21 定义 HITL 模式和审批语义；§47 定义审批路由解析——§21 决定"需不需要审批、什么模式"，§47 决定"审批人是谁、路由到哪"                                                                                             |
| §23 合规架构 vs §49 分部门合规引擎职责重叠                             | §23, §49     | §23 定义平台级合规框架（GDPR/SOC2/加密/血缘）；§49 定义组织级合规策略分发——§23 是"合规能力"，§49 是"合规策略在组织树上的继承与差异化"                                                                            |
| §31 HA 架构 vs §52 多 Region 架构范围重叠                              | §31, §52     | §31 定义单 Region 内 HA-1/HA-2/HA-3 分级；§52 定义跨 Region 部署。映射关系：HA-1 = 单节点单 Region，HA-2 = 双节点单 Region，HA-3 = 多 AZ 单 Region，§52 = 多 Region 单写入权威 + follower read + 受控 failover |
| §32 部署阶段 D1-D3 vs §8.4 扩展阶段 S1-S4 vs §33 落地 Phase 1-7 无对照 | §8, §32, §33 | 映射：D1+S1 = Phase 1-2，D2+S2 = Phase 3-4，D3+S3 = Phase 5-6，S4 = Phase 6-7。三套分类的视角不同——D 看部署形态，S 看扩展能力，Phase 看交付节奏                                                                  |
| 无统一错误分类体系                                                     | §6.2         | 错误码按层级组织：`PLATFORM.{plane}.{category}.{specific}`，例如 `PLATFORM.P4.TOOL.TIMEOUT`、`PLATFORM.P2.POLICY.DENIED`。每个错误码关联 retryable/severity/user_message 三元组                                  |
| §61 AgentDefinition.autonomy_config vs §42 渐进式自主权无显式关联      | §42, §61     | autonomy_config 由 §42 AgentTrustProfile 驱动生成，AgentDefinition 中的 autonomy_config 是快照——创建时从 TrustProfile 获取初始值，运行时由 §42 TrustScorer 动态更新                                              |

## 58.6 HarnessDecision — 统一裁决协议

> LoopController(§45.7) 的裁决升级为一级协议（六种裁决：accept/retry/replan/escalate/downgrade_mode/abort），每种裁决定义标准化字段。

**六种裁决**：

| 裁决              | 语义                      | 触发条件                               | 后续动作                                        |
| ----------------- | ------------------------- | -------------------------------------- | ----------------------------------------------- |
| accept            | 当前步骤/任务通过         | score ≥ threshold, 无 critical issues  | 推进下一步或完成 run                            |
| retry_same_plan   | 用同一 plan 重试当前步骤  | 瞬时故障、工具超时、retry_count < max  | Generator 重新执行同一步骤                      |
| replan            | 触发 Planner 重新规划     | 目标偏离、风险升高、replan_count < max | Planner 生成 GraphPatch 或新 PlanGraphBundle    |
| escalate_to_human | 转交 HITL Runtime(§45.18) | risk 升高 / confidence 过低 / 策略要求 | Durable Harness pause + HITL 介入               |
| downgrade_mode    | 降级运行模式              | 信任不足 / 预算紧张 / 风险接近阈值     | autonomy_mode 降一级（如 semi_auto→supervised） |
| abort             | 安全终止                  | 预算耗尽 / 不可恢复错误 / 策略禁止     | 保存状态 + 记录证据 + 通知用户                  |

**HarnessDecision 标准化字段**：

- decision：六种裁决之一
- reason：结构化原因（error_class + root_cause_category）
- evaluatorReport：触发裁决的 EvaluationReport 引用
- confidence：裁决置信度 0.0-1.0
- suggestedNextAction：对下一步的建议（供 LoopController 参考）
- auditRef：审计证据引用

## 58.7 Runtime Metrics

v4.1 运行时指标以 HarnessRun / NodeRun 为主键，至少包含：

| 指标 | 说明 | 触发用途 |
| --- | --- | --- |
| runtime.run.admission_latency | RequestEnvelope 到 HarnessRun admitted 的耗时 | 准入瓶颈排查 |
| runtime.graph.ready_queue_depth | PlanGraph ready node 队列深度 | 调度拥塞判断 |
| runtime.budget.reservation_conflict_rate | Budget atomic reserve 冲突率 | 预算竞态和容量预警 |
| runtime.side_effect.ambiguous_rate | 副作用 ambiguous 占比 | 外部系统可靠性与对账告警 |
| runtime.trace_replay.success_rate | Trace Replay 成功重建比例 | 审计与事故复盘健康度 |
| runtime.re_execution.drift_rate | 重新执行与原 evidence 差异比例 | Prompt / Tool 变更风险 |

## 58.8 Incident Rules

以下事件必须自动生成 Incident 或升级已有 Incident：

| 规则 | 触发条件 | 默认级别 |
| --- | --- | --- |
| replay_mismatch | Trace Replay 无法重建原 projection 或 evidence hash 不一致 | P1 |
| budget_reservation_stuck | reservation 超过 TTL 未 settle / release | P2 |
| side_effect_ambiguous_timeout | ambiguous 超过 reconciliation SLA | P1 |
| scheduler_nondeterministic | 同一 ready set 的 scheduler decision 缺失或不可重放 | P1 |
| panic_incomplete | PlatformPanicDirective 未收到全部平面 ack | P0 |
| policy_bypass_attempt | P4 收到未经 P3/HarnessRuntime 授权的常规执行请求 | P0 |

## 58.9 Error Code Taxonomy

平台错误码按以下格式命名：

```text
PLATFORM.{plane}.{domain}.{category}.{specific}
```

示例：

- `PLATFORM.P3.GRAPH.VALIDATION.NO_ENTRY_NODE`
- `PLATFORM.P3.GRAPH.VALIDATION.UNBOUNDED_LOOP`
- `PLATFORM.P4.NODE.STATE.INVALID_TRANSITION`
- `PLATFORM.P4.SIDEEFFECT.CONFIRMATION.TIMEOUT`
- `PLATFORM.P3.HITL.LOCK.CONFLICT`
- `PLATFORM.P5.REPLAY.NONDETERMINISTIC_INPUT`
- `PLATFORM.P2.LEARNING.CANDIDATE.PII_DETECTED`

每个错误码必须声明 retryable、severity、userMessage、operatorAction、incidentRule 和 replayBehavior。

## 58.10 Runtime Test Matrix

OAPEFLIR-Harness 最小测试矩阵：

| 测试类别 | 覆盖内容 |
| --- | --- |
| 状态机测试 | HarnessRun / NodeRun 合法迁移、非法迁移、终态封闭 |
| Graph 测试 | DAG 校验、deadlock、join、risk propagation、worst-path、GraphPatch |
| Scheduler 测试 | deterministic scheduling、Trace Replay schedule consistency |
| SideEffect 测试 | proposed→approved→committed→confirmed、ambiguous、reconciliation、compensation |
| Guardrail 测试 | critical block 优先级、LLM judge 不能覆盖确定性失败 |
| HITL 测试 | lock、scope approval、timeout escalation、manual takeover |
| Learning 测试 | holdout contamination、PII/secret block、EvaluationGate |
| Fault Injection | worker crash、LLM timeout、tool timeout after commit、event append failure、checkpoint restore |

该矩阵是 Phase 8d 的验收基线，也必须纳入稳定版发布门禁。

---

# Part VII — 组织治理层（§46-§51）

---

# 46. 组织层次模型

> 在 tenant/domain/pack 之上叠加 company/division/department/team 组织架构层，驱动审批、预算、隔离、合规的分层治理。
> 关联：§11 安全 · §18 成本 · §21 HITL · §37 业务域 · §47 审批路由 · §48 SSO/SCIM

## 46.1 组织模型

OrgNode 是组织架构的基本单元，组成树形结构（OrgTree）：

| 字段       | 类型                                         | 说明                                 |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `nodeId`   | string (ULID)                                | 全局唯一标识                         |
| `type`     | enum: company / division / department / team | 组织层级类型                         |
| `parentId` | string \| null                               | 父节点 ID，company 节点为 null       |
| `name`     | string                                       | 组织单元名称                         |
| `metadata` | object                                       | 扩展属性（成本中心、地域、负责人等） |

OrgTree 支持动态重组——节点的增删改自动触发下游权限刷新、审批路由重算（§47）和预算重分配。所有变更记录审计日志。

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

| 组织层级   | 平台映射        | 治理权限                           |
| ---------- | --------------- | ---------------------------------- |
| company    | platform config | 全局策略、平台级 SLO、合规总纲     |
| division   | tenant_group    | 事业部预算、跨部门 workflow 策略   |
| department | tenant          | 部门预算、部门 SLO、域管理、审批链 |
| team       | domain/pack     | 域配置、Pack 开发、日常运营        |

## 46.3 组织变更自动适配

| 组织变更事件 | 平台自动响应                                                      |
| ------------ | ----------------------------------------------------------------- |
| 员工入职     | SCIM 同步 → 创建 principal → 分配到 team → 继承 team 权限         |
| 员工调动     | 更新 reporting_chain → 调整 tenant/domain 权限 → 迁移审批委托     |
| 员工离职     | SCIM deprovisioning → 撤销所有权限 → 转移 domain_owner → 审计记录 |
| 部门合并     | 合并 tenant → 合并预算 → 重新计算 SLO → 迁移 Pack 归属            |
| 组织重组     | 重建 reporting_chain → 刷新审批路由 → 通知受影响的 domain_owner   |

---

# 47. 组织架构审批路由

> 基于 org-chart 的动态审批路由，替代静态 approver list。
> 关联：§21 HITL · §46 组织层次 · §10 风险控制

## 47.1 动态审批路由引擎

审批路由引擎根据请求上下文动态计算审批链，替代静态 approver list：

| 路由因子 | 说明                                      |
| -------- | ----------------------------------------- |
| 风险等级 | risk_level（§10）越高，审批层级越高       |
| 成本阈值 | 按 §18 成本估算匹配审批额度矩阵（§47.2）  |
| 组织层级 | 沿 OrgTree（§46）向上查找对应层级的审批人 |
| 委托规则 | 审批人不在位时自动路由到代理人（§47.3）   |

引擎支持多审批人会签（parallel）与逐级审批（sequential）两种模式。每步设独立超时，超时后按 escalation_policy 自动升级到更高组织层级。职责分离（SoD）检查确保发起人与审批人不为同一人。

## 47.2 审批额度矩阵

| 风险金额  | 自动 | Manager | Director | VP  | CFO/CTO |
| --------- | ---- | ------- | -------- | --- | ------- |
| < ¥1,000  | ✓    |         |          |     |         |
| ¥1K-10K   |      | ✓       |          |     |         |
| ¥10K-100K |      |         | ✓        |     |         |
| ¥100K-1M  |      |         |          | ✓   |         |
| > ¥1M     |      |         |          |     | ✓       |

## 47.3 不在位自动代理

当审批人不在位时，系统按以下优先级寻找代理：

1. 显式委托代理人（DelegationOfAuthority）
2. org-chart 向上一级（skip-level manager）
3. 同级别同部门 peer（如配置允许）
4. 超时后执行 ApprovalTimeoutPolicy(§21)

---

# 48. 企业 SSO/SCIM 集成架构

> 与企业身份提供商集成，实现自动用户生命周期管理。
> 关联：§6.5 认证 · §11 安全 · §46 组织层次

## 48.1 身份集成协议

| 协议         | 用途                     | 优先级 |
| ------------ | ------------------------ | ------ |
| **OIDC**     | SSO 登录（已有 §6.5）    | 已支持 |
| **SAML 2.0** | SSO 登录（传统企业 IdP） | 必须   |
| **SCIM 2.0** | 用户/组自动同步          | 必须   |
| **HR API**   | 组织架构同步（可选）     | 可选   |

## 48.2 SCIM 集成模型

平台实现 SCIM 2.0 Server 端点，接收企业 IdP 推送的用户和组变更：

| 端点      | 支持操作                          | 说明                                     |
| --------- | --------------------------------- | ---------------------------------------- |
| `/Users`  | GET / POST / PUT / PATCH / DELETE | 用户增删改查，映射到平台 principal       |
| `/Groups` | GET / POST / PUT / PATCH / DELETE | 组增删改查，映射到 OrgNode（§46）的 team |

SCIM 同步自动维护 principal ↔ OrgNode 的关联关系。用户停用（deprovisioning）时立即撤销活跃 session 并暂停其名下 Agent，确保零残留访问。所有同步操作记录审计日志，冲突时以 IdP 为权威源。

## 48.3 用户生命周期自动化

```text
IdP 事件                    平台响应
─────────                   ────────
User Created ──────────▶ 创建 principal + 分配 role + 加入 org_node + 欢迎引导
User Updated ──────────▶ 同步属性 + 更新 reporting_chain + 调整权限
User Deactivated ──────▶ 立即撤销所有活跃 session + 暂停所有 owned Agent
User Deleted ──────────▶ 转移 domain_owner + 归档审计记录 + 触发 data_retention
Group Changed ─────────▶ 批量更新 role mapping + 刷新审批路由(§47)
```

---

# 49. 分部门合规策略引擎

> 使不同部门可执行不同合规框架（SOX + HIPAA + PCI-DSS + GDPR 共存）。
> 关联：§23 合规 · §37.3 DomainRiskProfile · §46 组织层次

## 49.1 合规框架注册表

ComplianceFramework 定义可激活的合规框架，支持多框架共存：

| 字段                | 类型                                             | 说明                         |
| ------------------- | ------------------------------------------------ | ---------------------------- |
| `frameworkId`       | string (ULID)                                    | 全局唯一标识                 |
| `type`              | enum: GDPR / SOC2 / PIPL / HIPAA / SOX / PCI_DSS | 合规框架类型                 |
| `rules`             | ComplianceRule[]                                 | 具体控制项列表               |
| `auditRequirements` | AuditSpec[]                                      | 审计频率、证据类型、留存期限 |
| `reportTemplate`    | string                                           | 合规报告模板 ID              |

框架按 tenant 粒度激活——同一平台内不同部门可执行不同合规组合（§49.2 继承机制）。框架变更需 platform_admin 审批，激活后自动注入对应的 ConstraintPack 约束。

## 49.2 合规策略继承

```text
company:  [基础安全策略] + [数据分级策略]
    │
    ├── finance_division:  继承 + [SOX]
    │   ├── accounting_dept: 继承 + [SOX-404 强化]
    │   └── payment_dept:   继承 + [PCI-DSS]
    │
    ├── healthcare_division: 继承 + [HIPAA]
    │
    └── eu_operations:      继承 + [GDPR]
```

规则：子节点**继承**父节点所有合规约束，可**追加**但不可**放松**。

## 49.3 自动合规证据收集

| 合规控制         | 证据来源                   | 收集方式                 |
| ---------------- | -------------------------- | ------------------------ |
| SOX 访问审查     | §11.2 RBAC + §28 audit log | 季度自动导出访问权限快照 |
| SOX 职责分离     | §47 SodRouting             | 自动验证审批链无违规     |
| HIPAA 数据加密   | §23.5 加密架构             | 持续监控加密状态         |
| PCI-DSS 范围限制 | §46 tenant 隔离            | 自动验证 CDE 边界        |
| GDPR 删除权      | §23.2 crypto-shredding     | 自动记录删除执行证据     |

---

# 50. 知识域隔离与受控共享

> 强制隔离不同部门的知识资产，提供审批式跨域共享。
> 关联：§29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 组织层次 · §11 安全

## 50.1 知识隔离模型

KnowledgeBoundary 定义知识资产的隔离边界，默认拒绝跨域访问：

| 字段               | 类型                      | 说明                                         |
| ------------------ | ------------------------- | -------------------------------------------- |
| `boundaryId`       | string (ULID)             | 边界唯一标识                                 |
| `ownerOrgNode`     | string                    | 所属组织节点（§46），决定归属                |
| `accessPolicy`     | enum: strict / controlled | strict=完全隔离，controlled=审批后可共享     |
| `allowedConsumers` | OrgNodeRef[]              | 已授权的消费方列表（仅 controlled 模式生效） |
| `auditOnAccess`    | boolean (默认 true)       | 每次访问是否写入审计日志                     |

所有知识查询在执行时经 KnowledgeFederator（§50.2）强制校验边界。未授权的跨边界请求不仅被拒绝，且不暴露目标知识的存在性。

## 50.2 知识联邦搜索

当 Agent 搜索知识时，KnowledgeFederator 按权限过滤结果：

```text
Agent 搜索请求
    │
    ▼
┌────────────────┐
│ Knowledge      │
│ Federator      │
└───┬────────────┘
    │
    ├──▶ [本边界内知识] → 直接返回
    ├──▶ [controlled 边界知识] → 检查 CrossBoundaryRule → 有授权则返回（可能经 transform）
    └──▶ [strict 边界知识] → 完全不可见（连"存在"都不暴露）
```

## 50.3 信息隔离墙（Chinese Wall）

金融服务场景要求：

- M&A 团队的知识对其他部门**完全不可见**
- 同一人不能同时访问利益冲突方的知识
- 一旦访问了 A 方知识，自动禁止访问 B 方知识（动态隔离墙）

---

# 51. 分级治理委托

> 使部门管理员在平台团队设定的护栏内自助治理，平台团队不再是所有治理变更的瓶颈。
> 关联：§24 配置治理 · §37.9 DomainGovernancePolicy · §46 组织层次

## 51.1 治理权限分层

GovernancePermission 定义各组织层级的治理操作权限：

| 字段           | 类型                                       | 说明                          |
| -------------- | ------------------------------------------ | ----------------------------- |
| `permissionId` | string (ULID)                              | 权限唯一标识                  |
| `scope`        | { orgNode: string, resourceType: string }  | 作用范围：组织节点 + 资源类型 |
| `level`        | enum: view / operate / admin / super_admin | 权限级别，逐级递增            |
| `delegatable`  | boolean                                    | 是否允许向下委托              |
| `expiresAt`    | ISO8601 \| null                            | 过期时间，null 表示永久       |

权限遵循最小权限原则：view 仅查看；operate 可执行日常操作；admin 可修改域级策略；super_admin 可修改全局护栏。委托的权限不可超过委托人自身级别。

## 51.2 治理继承与覆写规则

```text
platform_team 设定全局护栏
    │
    ▼ 继承（不可放松）
division_admin 设定事业部策略
    │
    ▼ 继承（不可放松）+ 可追加
department_admin 设定部门策略
    │
    ▼ 继承（不可放松）+ 可追加
team_lead 日常运营配置
```

| 操作                      | 上级可            | 下级可            |
| ------------------------- | ----------------- | ----------------- |
| 收紧策略（降低 max_risk） | ✓                 | ✓                 |
| 放松策略（提高 max_risk） | ✓                 | ✗                 |
| 追加约束                  | ✓                 | ✓                 |
| 删除上级约束              | ✓（自己设的）     | ✗                 |
| 分配预算                  | ✓（在自己配额内） | ✓（在自己配额内） |

## 51.3 自助治理操作台

| 功能                   | 部门管理员可用      | 平台团队可用 |
| ---------------------- | ------------------- | ------------ |
| 域接入向导(§44.2)      | ✓（低/中风险域）    | ✓（所有域）  |
| 修改审批规则           | ✓（在额度上限内）   | ✓（无限制）  |
| 发布 Pack              | ✓（经自动安全扫描） | ✓            |
| 调整 Agent 自主权(§42) | ✓（不超过域上限）   | ✓            |
| 创建触发器(§41)        | ✓（低/中风险）      | ✓            |
| 修改全局护栏           | ✗                   | ✓            |
| 跨部门策略             | ✗                   | ✓            |

---

# Part VIII — 规模化运行层与生态层（§52-§57）

---

# 52. 多 Region 部署架构

> 支持全球化企业跨 Region 合规运行，数据主权、流量路由、故障隔离。
> 关联：§31 容灾 · §32 部署 · §23 合规 · §46 组织层次

## 52.1 Region 模型

| 字段                | 类型                        | 说明                                               |
| ------------------- | --------------------------- | -------------------------------------------------- |
| regionId            | string                      | 全局唯一，如 `cn-east-1`、`eu-west-1`              |
| provider            | AWS / GCP / Azure / private | 底层基础设施供应商                                 |
| status              | active / standby / draining | active 为主用；standby 预热待切换；draining 迁出中 |
| endpoints           | `{ api, ws, internal }[]`   | 各平面入口地址                                     |
| dataResidencyPolicy | string                      | 允许驻留的数据法域，如 `EU-only`、`CN-only`        |

多 Region 部署要求每个 Region 至少达到 §31 HA-3 等级（多 AZ 部署），但 v4.1 不承诺多主 truth 写入。每个 tenant / partition 同一时刻只能有一个写入 leader，其他 Region 提供 follower read、异步复制和受控 failover。

## 52.2 Region 感知架构

```text
                    ┌──────────────────────┐
                    │  Global Control Plane │ (元数据联邦)
                    │  Region 路由 · 策略同步 │
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
    │ 数据驻留: CN  │ │ 数据驻留: EU  │ │ 数据驻留: US  │
    │ 合规: PIPL    │ │ 合规: GDPR    │ │ 合规: SOX     │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## 52.3 跨 Region Workflow 路由

| 场景                                | 路由策略                        | 数据处理                     |
| ----------------------------------- | ------------------------------- | ---------------------------- |
| 用户在 EU，任务只涉及 EU 数据       | Region 亲和，留在 EU            | 本地处理                     |
| 用户在 CN，需要调用 US 的 LLM       | CN 执行，LLM 请求路由到 US      | 输入/输出不含 PII 时允许跨境 |
| 跨 Region 协作（EU 市场 + US 工程） | 各自 Region 执行，metadata 同步 | 仅交换匿名化/聚合数据        |
| Region 故障 failover                | 手动/半自动切换到备用 Region    | 元数据预复制，业务数据不跨境 |

写入边界：

- CAS、Lease、Fencing、Budget Ledger、SideEffect Commit 和 HarnessRun truth update 只允许在 partition leader 内执行。
- follower Region 只能读 projection、提交待路由请求或承接 failover 后的新 leader epoch。
- failover 必须提升 fencing epoch；旧 leader 恢复后只能作为 follower 加入，未确认复制的写入进入 reconciliation。
- CRDT / multi-master 仅可用于非关键统计、缓存或聚合 telemetry，不得承载 truth、预算或副作用提交。

## 52.4 跨境数据传输合规

| 法域       | 合规框架                                             | 平台机制                                                                                                  |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| EU → 非EU  | GDPR Chapter V — SCCs (Standard Contractual Clauses) | 跨 Region LLM 调用自动附加 SCC 数据处理协议引用；传输前 DPIA（Data Protection Impact Assessment）自动评估 |
| EU → US    | EU-US Data Privacy Framework                         | 验证 provider 是否在 DPF 清单；未列入则回退至 SCC                                                         |
| CN → 海外  | PIPL 第 38 条 — 安全评估 / 标准合同                  | 跨境前自动触发数据量评估；超阈值需安全评估记录                                                            |
| 集团内跨境 | BCRs (Binding Corporate Rules)                       | 企业级 BCR 模板，平台自动在跨境传输中引用 BCR 编号并记录                                                  |

**跨境传输控制链**：

```text
跨 Region 数据请求
    │
    ▼
┌──────────────────┐
│ Jurisdiction      │  识别 source/target 法域
│ Classifier        │
├──────────────────┤
│ Transfer Impact   │  自动 DPIA 评分；high impact → 人工审批
│ Assessor          │
├──────────────────┤
│ Mechanism         │  选择合规机制：SCC / BCR / DPF / 安全评估
│ Selector          │
├──────────────────┤
│ Data Minimizer    │  仅传输必要字段；PII 脱敏/假名化
├──────────────────┤
│ Transfer Logger   │  完整记录传输日志（source, target, 法律依据, 数据量, 时间）
└──────────────────┘
```

---

# 53. 规模化资源竞争管理

> 5000+ 并发 workflow 场景下的公平调度、优先级抢占、容量保障。
> 关联：§8 可扩展性 · §9 稳定性 · §14 Runtime · §46 组织层次 · §54 SLA

## 53.1 调度层次

```text
┌─────────────────────────────────┐
│  Admission Controller           │  全局准入控制
│  (拒绝超出平台容量的请求)         │
├─────────────────────────────────┤
│  Quota Manager                  │  部门级配额管理
│  (保障/限制每个部门的资源份额)     │
├─────────────────────────────────┤
│  Priority Scheduler             │  优先级调度
│  (SLA 感知 + 抢占)              │
├─────────────────────────────────┤
│  Worker Pool                    │  执行层
└─────────────────────────────────┘
```

## 53.2 资源配额模型

| 字段           | 类型                                    | 说明                                       |
| -------------- | --------------------------------------- | ------------------------------------------ |
| quotaId        | string                                  | 配额唯一标识                               |
| tenantId       | string                                  | 所属部门/租户                              |
| resource       | cpu / memory / tokens / concurrent_runs | 受控资源类型                               |
| limit          | number                                  | 配额上限值                                 |
| used           | number                                  | 当前已用量（实时更新）                     |
| period         | hourly / daily / monthly                | 配额周期，周期结束自动重置 used            |
| overflowPolicy | queue / reject / burst                  | 超额策略：排队等待、直接拒绝、允许短时突发 |

## 53.3 优先级抢占

| 优先级          | 场景              | 抢占策略              | 启动 SLA |
| --------------- | ----------------- | --------------------- | -------- |
| critical(1000)  | 线上事故修复      | 可抢占所有非 critical | < 10s    |
| high(800)       | 电商订单处理      | 可抢占 standard 以下  | < 30s    |
| standard(500)   | 日常业务 workflow | 不抢占                | < 5min   |
| background(200) | 批量分析 / 报表   | 不抢占，空闲时运行    | 尽力     |
| best_effort(0)  | 实验性任务        | 不抢占，随时可被抢占  | 无保证   |

## 53.4 公平调度

- **Weighted Fair Queuing**：每个部门按 guaranteed 配额获得权重
- **Borrowing**：部门未用满 guaranteed 配额时，空闲资源可被其他部门 burst 使用
- **Reclaim**：当原部门需要时，borrowed 资源在当前 step 完成后归还（graceful reclaim）
- **Starvation Prevention**：任何部门的 standard 优先级任务排队超过 30min 自动升级为 high

---

# 54. SLA 分级保障

> 为不同业务重要度提供差异化 SLA 保障，含资源预留和违约响应。
> 关联：§27 SLO · §37.9 DomainGovernancePolicy · §53 资源竞争

## 54.1 SLA Tier 模型

| 字段           | 类型                                    | 说明                                    |
| -------------- | --------------------------------------- | --------------------------------------- |
| tierId         | string                                  | Tier 唯一标识                           |
| name           | platinum / gold / silver / bronze       | Tier 名称，与 §54.2 矩阵对应            |
| availability   | number (%)                              | 承诺可用性；手动/半自动 failover 默认最高 99.95% |
| maxLatencyP99  | number (ms)                             | P99 延迟上限                            |
| priorityWeight | number (1-100)                          | 调度优先级权重，Platinum=100, Bronze=10 |
| costMultiplier | number                                  | 相对 Bronze 的资源成本系数              |
| supportLevel   | 24x7_dedicated / 24x7 / 8x5 / community | 对应支持等级                            |

## 54.2 SLA Tier 矩阵

| Tier         | 可用性 | P95 延迟 | 排队上限 | 恢复优先 | 适用场景           |
| ------------ | ------ | -------- | -------- | -------- | ------------------ |
| **Platinum** | 99.95% | < 2s     | < 5s     | 最高     | 线上交易、实时风控 |
| **Gold**     | 99.9%  | < 5s     | < 30s    | 高       | 核心业务 workflow  |
| **Silver**   | 99.5%  | < 15s    | < 5min   | 中       | 日常运营           |
| **Bronze**   | best effort | < 60s | < 30min  | 低       | 内部工具、实验     |

99.99% 只允许在自动 failover、quorum 写入、热备容量和跨 Region 演练均通过的专用部署档中单独承诺，不作为 v4.1 默认 SLA Tier。

## 54.3 SLA 感知调度

Dispatcher(§14.2) 在调度时考虑 SLA Tier：

1. **排队检查**：workflow 排队时间接近 `max_queue_time` 时自动升级优先级
2. **延迟预测**：基于历史数据预测 workflow 是否会违反 SLA，提前扩容或抢占
3. **资源预留**：Platinum/Gold tier 的 `resource_reservation` 始终为其预留，不可被 burst 占用
4. **违约响应**：SLA 违反时按 `ViolationResponse` 自动执行（告警/扩容/抢占/升级）

---

# 55. Agent 市场与生态

> 构建平台内部/外部的 Pack、Plugin、模板、连接器生态市场。
> 关联：§30 Business Pack · §37.7 DomainRecipe · §22 SDK/DX

## 55.1 市场架构

```text
┌───────────────────────────────────────────┐
│  Marketplace Registry                     │
│  ├── Pack Store      (业务域 Pack)        │
│  ├── Plugin Store    (功能插件)            │
│  ├── Connector Store (外部系统连接器)      │
│  ├── Template Store  (Workflow 模板)       │
│  ├── Prompt Store    (领域 Prompt 库)      │
│  └── Eval Store      (评估数据集)          │
├───────────────────────────────────────────┤
│  Quality & Security Gate                  │
│  自动扫描 · 兼容性测试 · 沙箱验证          │
├───────────────────────────────────────────┤
│  Discovery & Recommendation               │
│  搜索 · 分类 · 评分 · 智能推荐             │
└───────────────────────────────────────────┘
```

## 55.2 市场条目模型

| 字段                | 类型                               | 说明                            |
| ------------------- | ---------------------------------- | ------------------------------- |
| entryId             | string                             | 条目唯一标识                    |
| packId              | string                             | 关联的 Pack/Plugin/Connector ID |
| publisher           | string                             | 发布者（组织或个人）            |
| version             | semver                             | 当前发布版本                    |
| pricing             | free / enterprise_included / paid  | 定价模式，详见 §55.4            |
| rating              | number (0-5)                       | 用户综合评分                    |
| installCount        | number                             | 累计安装量                      |
| certificationStatus | uncertified / verified / certified | 平台认证状态                    |
| dependencies        | `{ item_id, version_range }[]`     | 依赖项列表，详见 §55.6          |

## 55.3 安装与治理

| 发布者类型           | 安装审批              | 安全要求                | 更新策略   |
| -------------------- | --------------------- | ----------------------- | ---------- |
| platform_official    | 自动安装              | 平台团队已审查          | 自动更新   |
| enterprise_internal  | 部门管理员审批        | 自动安全扫描            | 通知后自动 |
| verified_third_party | 部门管理员 + 安全团队 | 自动扫描 + 人工审查     | 手动确认   |
| community            | 平台团队审批          | 完整安全审查 + 沙箱测试 | 手动确认   |

## 55.4 收益分成模型

| 定价类型            | 分成规则                                        | 结算周期 |
| ------------------- | ----------------------------------------------- | -------- |
| free                | 无分成                                          | —        |
| enterprise_included | 平台 license 内含，publisher 按安装量获信用积分 | 季度     |
| paid (third_party)  | publisher 70% / platform 30%                    | 月度     |
| paid (community)    | publisher 80% / platform 20%（鼓励社区贡献）    | 月度     |

## 55.5 条目废弃生命周期

| 阶段       | 触发条件                                                 | 平台动作                                                         |
| ---------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| active     | 正常运行                                                 | —                                                                |
| deprecated | publisher 标记废弃 或 90 天无维护更新 + 存在已知安全漏洞 | 安装页面显示废弃警告；新安装需确认；推荐替代品                   |
| sunset     | deprecated 后 180 天                                     | 阻止新安装；已安装的发送迁移通知(30 天倒计时)                    |
| removed    | sunset 倒计时结束                                        | 从 Registry 移除；已安装实例冻结（不执行新任务），数据保留 90 天 |

## 55.6 依赖管理

- 每个 MarketplaceItem 声明 `dependencies: { item_id: string; version_range: string }[]`
- 安装时自动解析依赖树，检测版本冲突（类似 npm/cargo resolution）
- 卸载时检查反向依赖，若有其他 item 依赖则阻止卸载并提示
- 依赖项被 deprecated 时，自动通知所有依赖方 publisher 和安装用户

---

# 56. 反馈驱动持续改进管线

> 将 §13 Learn/Improve 黑盒接口具象化为可运行的自动改进管线。
> 关联：§13 OAPEFLIR L-I-R · §17 模型评估 · §37.5 DomainEvalFramework · §42 渐进式自主权

## 56.1 改进管线总览

```text
生产执行数据
    │
    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Signal       │────▶│ Analysis     │────▶│ Improvement  │
│ Collector    │     │ Engine       │     │ Generator    │
│ (信号采集)    │     │ (模式分析)    │     │ (改进生成)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Quality Gate │
                                           │ (质量门禁)    │──▶ §17 Eval
                                           └──────┬───────┘
                                                  │ 通过
                                           ┌──────▼───────┐
                                           │ Gradual      │
                                           │ Rollout      │──▶ §16 Prompt 灰度
                                           └──────────────┘
```

## 56.2 信号采集

**设计决策：3D FeedbackSignal 结构 vs 扁平枚举**

上面 architecture 文档中的 `FeedbackSignalType` 使用扁平的 9 类型枚举。实际实现（`src/platform/orchestration/oapeflir/types/feedback-signal.ts`）采用 3D 正交结构：

**为什么用 3D 而非扁平 9 类型枚举：**

| 设计考量 | 扁平枚举                   | 3D 正交结构                            |
| -------- | -------------------------- | -------------------------------------- |
| 可组合性 | 9 种固定组合               | 5×5×4=100 种潜在组合                   |
| 扩展性   | 新类型需修改枚举           | 独立扩展任意维度                       |
| 过滤查询 | 需要 N 个 OR 条件          | 可独立按 source/category/severity 过滤 |
| 空缺组合 | 可能存在无意义的"合法"组合 | 业务逻辑决定哪些组合有效               |

这种设计使 FeedbackSignal 可以表达更细粒度的反馈，同时保持维度间的正交性，便于分析和路由。架构文档中的扁平枚举用于概念说明，实际实现遵循 3D 结构。

## 56.3 自动改进类型

| 改进类型          | 触发条件                         | 自动化程度                       | 产出                                   |
| ----------------- | -------------------------------- | -------------------------------- | -------------------------------------- |
| **Few-shot 收割** | 用户 approval 累积 > 10 条       | 全自动                           | 新增 few-shot example 到 PromptLibrary |
| **Prompt 微调**   | 同类 user_correction > 5 条      | 半自动（生成候选→人工审核）      | Prompt 修改建议                        |
| **模型路由优化**  | cost_anomaly 或 latency_anomaly  | 全自动                           | ModelGateway 路由规则更新              |
| **风控规则调整**  | 连续 false positive 审批 > 10 次 | 半自动（建议→domain_owner 确认） | 风险阈值调整建议                       |
| **知识库更新**    | quality_drift + 知识源过期       | 全自动                           | 触发知识源刷新                         |
| **自主权调整**    | 累积绩效数据满足晋升条件         | 按 §42 规则                      | 自主权晋升/降级                        |

## 56.4 安全护栏

- 自动改进**永远不能**放松安全策略或合规控制
- 全自动改进仅限**非风险变更**（few-shot 增加、路由优化、知识刷新）
- 涉及 Prompt 核心逻辑或风控规则的变更必须经人工审核
- 所有自动改进记录到 event_log，可审计可回滚

---

# 57. 外部系统集成框架

> 提供标准化连接器框架和预构建连接器目录，使 Agent 能对接真实业务系统。
> 关联：§14.4 Executor · §11.5 出站控制 · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 连接器抽象

| 接口方法                  | 说明                                           |
| ------------------------- | ---------------------------------------------- |
| `connect(config)`         | 建立连接，传入凭证和端点配置                   |
| `execute(action, params)` | 执行指定操作（CRUD/查询/调用），返回标准化结果 |
| `healthCheck()`           | 探活检测，返回连接状态和延迟                   |
| `disconnect()`            | 优雅关闭连接，释放资源                         |

支持协议：REST / gRPC / MCP / Database (JDBC/ODBC) / File (S3/NFS) / Browser (Headless)。每个连接器附带 `ConnectorManifest`，声明支持的 action 列表、认证方式、速率限制和所需权限，供 Toolbelt(§14.4) 动态发现。

## 57.2 连接器生命周期

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Install  │────▶│ Configure│────▶│ Authorize│────▶│ Active   │
│ (安装)    │     │ (配置)    │     │ (授权)    │     │ (运行中)  │
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

## 57.3 预构建连接器目录（Phase 1）

| 类别   | 连接器           | 优先级 | 能力                         |
| ------ | ---------------- | ------ | ---------------------------- |
| 通信   | 飞书/企微/钉钉   | P0     | 消息发送、审批推送、日历读取 |
| 通信   | 邮件(SMTP/IMAP)  | P0     | 发送、接收、搜索             |
| 存储   | 阿里云 OSS / S3  | P0     | 上传、下载、列表             |
| 开发   | GitHub/GitLab    | P0     | PR、Issue、代码搜索          |
| 数据库 | MySQL/PostgreSQL | P0     | 查询、写入                   |
| 社交   | 微信公众号       | P1     | 消息推送、菜单管理           |
| 电商   | 有赞             | P1     | 订单查询、商品管理           |
| 财务   | 用友             | P1     | 凭证查询、报表导出           |
| 分析   | 神策             | P1     | 事件查询、用户画像           |
| 支付   | 支付宝/微信支付  | P2     | 下单、退款、查询             |

## 57.4 Connector SDK

社区和企业内部团队可通过 Connector SDK 开发自定义连接器，发布到 Marketplace(§55)。

---

# Part IX — 运营成熟度层（§59-§69）

---

# 59. Agent 可解释性与决策透明度架构

> 为每个 Agent 决策构建面向用户的因果解释能力，满足 EU AI Act / GDPR Article 22 合规要求，并为渐进式自主权(§42)提供信任基础。
> 关联：§12.7 Tracing · §13 OAPEFLIR · §17 质量门禁 · §23.6 数据血缘 · §39 NL 入口 · §42 渐进式自主权

## 59.1 设计原则

- 每个 OAPEFLIR 循环的每个阶段**必须**生成 `StageRationale` 记录
- 解释按需生成（lazy），不增加正常执行路径开销
- 解释深度按领域配置：金融需要 forensic-level，客服需要 summary-level
- 解释缓存避免重复 LLM 调用
- 解释不可篡改，纳入 Evidence Plane

## 59.2 解释管线

```text
用户问"为什么？"
    │
    ▼
ExplanationRequest { workflow_id, step_id?, depth }
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← 从 P5 收集 StageRationale + ToolCallLog + KnowledgeCitation
└────────┬────────┘
         ▼
┌─────────────────┐
│ CausalChainBuilder│  ← 构建 Observe→Assess→Plan→Execute 的因果链
└────────┬────────┘
         ▼
┌─────────────────┐
│ ExplanationRenderer│  ← 按 depth 和 locale 渲染为 NL 文本
└────────┬────────┘
         ▼
ExplanationResponse { summary, causal_chain[], evidence_refs[], confidence }
```

## 59.3 StageRationale 数据模型

| 字段                | 类型            | 说明                                                    |
| ------------------- | --------------- | ------------------------------------------------------- |
| rationaleId         | string          | 唯一标识                                                |
| stageId             | string          | 关联的 OAPEFLIR 阶段 ID                                 |
| decision            | string          | 该阶段做出的决策（如选择的工具、生成的方案）            |
| reason              | string          | 决策理由的结构化描述                                    |
| alternatives        | `Alternative[]` | 被放弃的备选方案及放弃原因                              |
| confidence          | number (0-1)    | 决策置信度                                              |
| evidenceRefs        | `string[]`      | 支撑决策的证据引用（ToolCallLog、KnowledgeCitation 等） |
| renderedExplanation | string (lazy)   | 面向用户的自然语言解释，按需渲染并缓存                  |

## 59.4 解释深度分级

| 深度         | 适用场景                 | 内容                                                  |
| ------------ | ------------------------ | ----------------------------------------------------- |
| L1 Summary   | 非技术用户日常查看       | 一句话概述："因为检测到异常流量，自动扩容了 2 个实例" |
| L2 Reasoning | 业务负责人审查           | 因果链 + 关键数据点 + 备选方案                        |
| L3 Forensic  | 合规审计 / Incident 调查 | 完整证据链 + 所有输入输出 + 知识引用 + 模型调用详情   |

## 59.5 与 NL 入口集成

§39 NL 交互管线增加 `why` Intent 类型：

用户可通过自然语言问"上次发布为什么回滚了？"，系统解析为 WhyQuery 并调用解释管线。

## 59.6 解释缓存与安全

- L1/L2 解释缓存 TTL = 24h，L3 不缓存（确保最新证据）
- 解释内容受 §50 知识域隔离约束——只能看到自己有权限的证据
- 解释日志本身纳入审计(§23)，记录谁在什么时候查看了什么解释

---

# 60. 紧急制动与全局熔断架构

> 提供单一原子操作在 < 5 秒内停止全平台所有 Agent 执行，用于安全事件、Prompt injection 攻击、Agent 逃逸等紧急场景。
> 关联：§9 稳定性 · §10 风险控制 · §11 安全 · §12 异常事件 · §52 多 Region

## 60.1 PlatformPanicDirective

| 字段              | 类型                     | 说明                                               |
| ----------------- | ------------------------ | -------------------------------------------------- |
| directiveId       | string                   | 指令唯一标识                                       |
| severity          | full / partial           | full = 全平台停止；partial = 限定范围停止          |
| scope             | global / tenant / domain | 熔断生效范围                                       |
| reason            | string                   | 触发原因（安全事件描述）                           |
| issuedBy          | string                   | 发起人身份                                         |
| requiredApprovers | string[] (min 2)         | 双人审批要求，防止单点误操作                       |
| reconfirmationAfterSeconds | number          | 到期后触发重新确认提醒，不自动解除熔断             |
| rollbackStrategy  | freeze / graceful_drain  | freeze 立即冻结；graceful_drain 等待运行中步骤完成 |

Platform Panic 默认无限期生效。`reconfirmationAfterSeconds` 只触发重新确认、升级提醒和证据快照刷新，不得自动解除熔断；恢复必须通过 §60.3 `PlatformResumeDirective` 且满足双人审批。

## 60.2 熔断传播机制

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: 拒绝所有新请求(503), 关闭 WebSocket
    │
    ├──▶ P2 Control Plane: 撤销所有 active Agent token
    │
    ├──▶ P3 Orchestration Plane: 挂起所有 in-flight HarnessRun 与 OAPEFLIR 投影更新
    │
    ├──▶ P4 Execution Plane: 中止所有 worker, 回滚未提交 side effect
    │
    ├──▶ P5 State Plane: 生成 ForensicSnapshot, 设置 read-only 模式
    │
    └──▶ X1 Fabric: 阻断所有 egress, 触发告警到所有渠道
```

**SLA**：从 Directive 发出到所有平面确认停止 < 5 秒（同 Region），< 15 秒（跨 Region）。

每个平面必须返回 `PanicAcknowledgment`：

| 字段 | 说明 |
| --- | --- |
| directiveId | 对应 PlatformPanicDirective |
| plane | P1 / P2 / P3 / P4 / P5 / X1 |
| status | ack / failed / timeout |
| localStopState | 本平面实际停止范围与未完成项 |
| timestamp | 确认时间 |
| evidenceRef | 本地取证快照或日志引用 |

若任一平面 failed / timeout，必须生成 `panic_incomplete` P0 incident，并触发基础设施级 kill、网络隔离或凭证吊销等外部止血动作。

## 60.3 安全恢复协议

| 步骤 | 操作                         | 要求                                               |
| ---- | ---------------------------- | -------------------------------------------------- |
| 1    | ForensicSnapshot 审查        | 安全团队确认威胁已消除                             |
| 2    | PlatformResumeDirective 发布 | 需要 ≥ 2 名 platform_admin 双人审批                |
| 3    | 渐进恢复                     | 先恢复 read-only 查询 → 低风险 workflow → 全面恢复 |
| 4    | 事后报告                     | 72h 内发布 Post-Incident Report                    |

**Admin 不可用降级方案**：若 platform_admin 不足 2 人在线超过 4 小时，启用以下降级恢复路径：

1. 系统向所有 platform_admin 发送多渠道紧急通知（短信 + 电话 + 企微/飞书/钉钉）
2. 超过 4h 无响应，授权 `break_glass` 机制——任意 1 名 platform_admin + 1 名 security_team 成员组合审批可替代双 admin 审批
3. 超过 8h 仍无响应，自动恢复 read-only 模式（允许查询和监控，禁止写操作和新 workflow），完整恢复仍需双人审批
4. 所有 `break_glass` 恢复操作记录为 P0 级审计事件，72h 内必须补充 platform_admin 复核

## 60.4 定期演练

- 每季度至少一次紧急制动演练（选定 tenant 范围）
- 演练结果纳入 §36 成功标准
- 演练期间产生的 ForensicSnapshot 用于验证取证完整性

---

# 61. Agent 统一生命周期管理架构

> 将 Agent 建模为一等实体——Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config 的复合体，管理从创建到退役的完整生命周期。
> 关联：§16 Prompt · §30 Pack · §42 渐进式自主权 · §41 主动式 Agent · §55 Marketplace

## 61.1 AgentDefinition 复合实体

AgentDefinition 是 Agent 的完整定义，由以下组件复合而成：

| 组件              | 来源               | 说明                                    |
| ----------------- | ------------------ | --------------------------------------- |
| Pack              | §30 Business Pack  | 业务域能力包                            |
| PromptSet         | §16 Prompt Library | Planner/Generator/Evaluator Prompt 集合 |
| ModelBinding      | §15 ModelGateway   | 模型路由配置（主模型 + fallback）       |
| TrustProfile      | §42 渐进式自主权   | 信任等级与自主权配置                    |
| TriggerPolicy     | §41 主动式 Agent   | 触发条件与调度策略                      |
| ConnectorBindings | §57 连接器框架     | 绑定的外部系统连接器                    |

AgentDefinition 按版本不可变——任何组件变更都产生新的 AgentVersion。

## 61.2 AgentVersion 快照

| 字段           | 类型                                           | 说明                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| versionId      | string                                         | 版本唯一标识                          |
| agentId        | string                                         | 所属 Agent ID                         |
| definition     | AgentDefinition (snapshot)                     | 该版本的完整定义快照，不可变          |
| status         | draft / canary / active / deprecated / retired | 版本状态，详见 §61.3 状态机           |
| publishedAt    | timestamp                                      | 发布时间                              |
| publishedBy    | string                                         | 发布者身份                            |
| rollbackTarget | versionId?                                     | 回滚目标版本，用于一键复合回滚(§61.4) |

## 61.3 生命周期状态机

```text
draft ──▶ testing ──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived
```

| 转换                | 触发条件          | 门禁                                 |
| ------------------- | ----------------- | ------------------------------------ |
| draft→testing       | 开发者提交        | 所有组件版本锁定                     |
| testing→staging     | 测试通过          | §17 质量门禁 + 安全扫描              |
| staging→canary      | 预发布审批        | 域管理员审批                         |
| canary→active       | 灰度指标达标      | 自动晋升（错误率 < 阈值 + 性能达标） |
| active→paused       | 手动/自动暂停     | 行为漂移检测(§63)触发或手动操作      |
| active→deprecated   | 版本替代/业务变更 | 责任转移到新版本完成                 |
| deprecated→archived | TTL 过期          | 所有历史引用标记为 archived          |

## 61.4 复合灰度发布

Agent 灰度以 AgentVersion 为单位（非单组件）：

- **流量分割**：canary 版本接收 5%→20%→50%→100% 流量
- **复合回滚**：一键回退到上一个 AgentVersion（所有组件原子回退）
- **比较测试**：对同一输入同时运行两个 AgentVersion，比较输出差异

## 61.5 Agent 退役与责任转移

| 阶段      | 动作                                   | 时间要求      |
| --------- | -------------------------------------- | ------------- |
| deprecate | 标记版本为 deprecated，发布废弃通知    | T+0           |
| notify    | 通知所有下游消费者和依赖方             | T+0 ~ T+7d    |
| migrate   | 将进行中任务迁移到替代 Agent/版本      | T+7d ~ T+25d  |
| transfer  | 转移知识资产、历史上下文到继任者       | T+25d ~ T+28d |
| archive   | 冻结执行能力，保留只读历史数据         | T+30d         |
| delete    | 清除运行时资源，历史数据按保留策略保留 | T+30d+        |

强制 **30 天废弃窗口期**，期间旧版本仍可处理存量任务，确保业务连续性。

---

# 62. 离线与边缘部署架构

> 支持工厂车间、零售门店、移动设备等间歇连接场景下的 Agent 执行，以本地优先+最终同步模式运行。
> 关联：§15 ModelGateway · §32 部署 · §52 多 Region · §10 风险控制

## 62.1 EdgeRuntime 最小化运行时

```text
┌─────────────────────────────────────────┐
│  EdgeRuntime（本地设备/门店服务器）          │
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

## 62.2 离线执行约束

| 约束       | 说明                                                            |
| ---------- | --------------------------------------------------------------- |
| 风险上限   | 离线模式只允许执行 risk_level ≤ medium 的动作                   |
| 模型降级   | 使用本地 sLLM（如 Qwen-7B/Llama-3-8B），不调用云端 ModelGateway |
| 副作用排队 | 所有 side effect 写入本地 SyncQueue，连接恢复后批量提交         |
| 审批挂起   | 需要审批的步骤进入 pending 状态，等待连接恢复                   |
| 缓存计划   | EdgeRuntime 定期从 Central 预拉取 ExecutionPlan 模板            |

## 62.3 同步协议

**冲突解决原则**：Central 状态为权威源；离线期间的 side effect 如与 Central 冲突，默认 Central wins + 生成 Incident 供人工审查。

## 62.4 部署模式

| 模式          | 硬件要求                | 适用场景                 |
| ------------- | ----------------------- | ------------------------ |
| Edge-Micro    | ARM/x86 单板机, 4GB RAM | 零售门店 POS、IoT 网关   |
| Edge-Standard | 8C/32GB 服务器          | 工厂车间、仓库           |
| Edge-Mobile   | iOS/Android App         | 移动外勤、现场服务       |
| Hybrid        | 本地 GPU 服务器         | 需要本地推理的高吞吐场景 |

---

# 63. Agent 行为漂移检测架构

> 超越单维度质量指标，建立多维行为画像和长周期变点检测，在 Agent 行为渐变导致业务风险前发出预警。
> 关联：§17 质量门禁 · §42 渐进式自主权 · §43 看板 · §56 反馈改进

## 63.1 行为指纹模型

| 字段                    | 类型                 | 说明                                        |
| ----------------------- | -------------------- | ------------------------------------------- |
| agentId                 | string               | 目标 Agent                                  |
| window                  | 1h / 7d / 30d / 90d  | 指纹统计窗口                                |
| tool_usage_distribution | `Map<toolId, ratio>` | 工具调用分布，检测工具偏好漂移              |
| avg_step_count          | number               | 平均步骤数，检测复杂度变化                  |
| avg_cost                | number               | 平均成本，检测成本异常                      |
| success_rate            | number (0-1)         | 成功率                                      |
| risk_distribution       | `Map<level, ratio>`  | 风险等级分布                                |
| driftScore              | number (0-1)         | 当前窗口与基线的综合漂移分数，>0.7 触发告警 |

## 63.2 变点检测引擎

| 窗口     | 检测算法                    | 灵敏度 | 用途                            |
| -------- | --------------------------- | ------ | ------------------------------- |
| 1h 滑窗  | Z-Score 异常检测            | 高     | 突变（模型更新、Prompt 变更后） |
| 7d 滑窗  | CUSUM                       | 中     | 短期趋势（知识库变更影响）      |
| 30d 滑窗 | Bayesian Online Changepoint | 中     | 月度漂移（业务环境变化）        |
| 90d 滑窗 | Drift Distance (KL/JS 散度) | 低     | 长期基线偏移                    |

## 63.3 漂移响应策略

```text
BehaviorDriftAlert { agent_id, dimension, severity, drift_score }
    │
    ├── severity=low  → 记录到 §43 看板，标记 "drift_warning"
    │
    ├── severity=medium → 通知域管理员 + 自动降低 autonomy_level 一级(§42)
    │
    └── severity=high → 暂停 Agent(§61 paused) + 触发 Incident(§12) + 要求人工审查
```

## 63.4 跨 Agent 异常检测

同一 DomainDescriptor 下的多个 Agent 形成对照组。当一个 Agent 的行为指纹与对照组显著偏离时，即使该 Agent 自身没有触发单 Agent 阈值，也应发出 `CrossAgentDriftAlert`。

---

# 64. 成本归因与优化引擎

> 在 §18 成本计量的基础上，增加决策级成本归因、自动优化建议、What-if 仿真，使成本数据从"可看"变为"可行动"。
> 关联：§18 成本管理 · §15 ModelGateway · §43 看板 · §54 SLA

## 64.1 决策级成本归因

| 字段         | 类型                           | 说明                                        |
| ------------ | ------------------------------ | ------------------------------------------- |
| decisionId   | string                         | 关联的 HarnessDecision ID                   |
| llmCost      | number                         | 该决策产生的 LLM 调用费用                   |
| toolCost     | number                         | 外部工具/API 调用费用                       |
| computeCost  | number                         | 计算资源（Worker 时间）费用                 |
| totalCost    | number                         | 三项之和                                    |
| attributedTo | agent / tenant / domain / task | 成本归属维度，支持多维下钻                  |
| qualityRisk  | low / medium / high            | 该决策的质量风险标记，用于成本-质量权衡分析 |

## 64.2 自动优化建议

| 建议类型       | 检测条件                             | 建议内容                               | 预期节省 |
| -------------- | ------------------------------------ | -------------------------------------- | -------- |
| ModelDowngrade | 低风险 step 使用高端模型             | 切换到 cost_optimized 路由             | 30-60%   |
| CacheHit       | 相同 query 重复调用                  | 启用 semantic cache                    | 40-80%   |
| TokenTrim      | 平均 input_tokens > 4x output_tokens | 优化 Prompt 或启用 context compression | 20-40%   |
| BatchMerge     | 多个独立 step 可合并                 | 合并为单次 LLM 调用                    | 50-70%   |
| ScheduleShift  | 非紧急任务在高峰时段执行             | 调度到低成本时段                       | 10-30%   |

## 64.3 What-if 成本仿真

支持对以下变更场景进行成本影响模拟：

| 仿真场景    | 输入参数                    | 输出                         |
| ----------- | --------------------------- | ---------------------------- |
| 模型切换    | 目标模型、适用 step 范围    | projectedCost、质量影响预估  |
| Prompt 变更 | 新 Prompt 的 token 长度变化 | token 成本变化、调用次数影响 |
| 工具替换    | 替代工具及其单价            | 工具成本差异、延迟影响       |
| 并发量调整  | 目标并发数                  | 计算资源成本、排队时间变化   |

每次仿真输出 `projectedCost`、`qualityImpact`、`recommendation`（建议 / 不建议 / 需进一步验证）。

## 64.4 成本看板集成

§43 统一运营看板增加 "Cost Intelligence" 面板：

- 本月 Top 10 高成本 Agent / Domain / Workflow
- 可行动的节省机会（按预期节省额排序）
- 成本趋势与预算对比
- What-if 仿真入口

---

# 65. 工作流可视化调试器架构

> 为运行中/已完成的工作流提供可视化调试和检查能力，支持实时执行跟踪、OAPEFLIR 步入调试、时间旅行回放。
> 关联：§12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow 构建器 · §59 可解释性

## 65.1 调试器能力矩阵

| 能力          | 运行中 Workflow | 已完成 Workflow | 说明                                          |
| ------------- | --------------- | --------------- | --------------------------------------------- |
| 执行时间线    | ✓ (实时)        | ✓               | 每个 step 的开始/结束/状态可视化              |
| OAPEFLIR 步入 | ✓               | ✓               | 展开单个 step 查看 O/A/P/E/F/L/I/R 各阶段详情 |
| 数据流视图    | ✓               | ✓               | step 间的输入/输出数据流                      |
| 副作用 Diff   | ✗               | ✓               | 预期副作用 vs 实际副作用对比                  |
| 断点调试      | ✓               | ✗               | 在指定 step 暂停执行，人工检查后继续          |
| 时间旅行      | ✗               | ✓               | 从任意 checkpoint 重放执行                    |
| 运行对比      | ✗               | ✓               | 两次运行的并排对比                            |

## 65.2 实时执行流

```text
WebSocket /ws/v1/debug/{workflow_id}
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Timeline View                                           │
│  ┌────┐  ┌────┐  ┌────┐  ┌─────┐  ┌────┐               │
│  │ S1 │─▶│ S2 │─▶│ S3 │─▶│ S4  │─▶│ S5 │  ← 当前执行位置│
│  │ ✓  │  │ ✓  │  │ ▶  │  │ ... │  │ ...│               │
│  └────┘  └────┘  └────┘  └─────┘  └────┘               │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ OAPEFLIR 展开│                             │
│              │ O: 收集到 3 个信号                          │
│              │ A: 风险评分 0.4 (medium)                    │
│              │ P: 选择方案 B (理由:...)                     │
│              │ E: ▶ 执行中...                              │
│              └─────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 65.3 断点 API

| 断点类型        | 说明                                                   | 操作                    |
| --------------- | ------------------------------------------------------ | ----------------------- |
| step-level      | 在指定 step 编号处暂停                                 | set / remove / list     |
| condition-based | 满足条件时暂停（on error / risk ≥ 阈值 / cost ≥ 阈值） | set(condition) / remove |
| watchpoint      | 监控指定变量变化时暂停                                 | set(variable) / remove  |

断点命中后 Workflow 进入 paused 状态，通过 WebSocket 推送 `breakpoint_hit` 事件。调试者可检查 ContextSnapshot 后执行 `resume` / `step_over` / `abort`。

## 65.4 运行对比

支持两次 HarnessRun 的并排对比分析：

| 对比维度      | 说明                              |
| ------------- | --------------------------------- |
| step diff     | 步骤数量、顺序、新增/缺失步骤     |
| decision diff | 每个 step 的 HarnessDecision 差异 |
| cost diff     | 各阶段及总成本对比                |
| duration diff | 端到端耗时及各 step 耗时对比      |
| outcome diff  | 最终结果差异、质量评分差异        |

支持回归检测：当新版本的关键指标劣于旧版本时自动标记 `regression_detected`。

---

# 66. 合规报告自动生成引擎

> 将平台收集的证据自动组装为审计就绪的合规报告，支持 SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS 等多框架。
> 关联：§23 合规 · §49 分部门合规 · §12 异常事件 · §50 知识隔离

## 66.1 报告模板注册

| 字段                | 类型                             | 说明                                          |
| ------------------- | -------------------------------- | --------------------------------------------- |
| templateId          | string                           | 模板唯一标识                                  |
| framework           | GDPR / SOC2 / SOX / HIPAA / PIPL | 对应合规框架                                  |
| version             | semver                           | 模板版本，框架更新时同步迭代                  |
| sections            | `Section[]`                      | 报告章节定义（控制点映射 + 证据要求）         |
| requiredDataSources | `string[]`                       | 所需数据源（audit_log / metrics / config 等） |
| outputFormat        | PDF / HTML / JSON                | 支持的输出格式                                |
| lockedOnGeneration  | boolean                          | 生成后锁定模板快照，确保审计可追溯            |

## 66.2 报告生成管线

```text
ScheduledTrigger / OnDemandRequest
    │
    ▼
┌─────────────────┐
│ EvidenceCollector│  ← 从 P5、审计日志、配置快照、metrics 收集证据
└────────┬────────┘
         ▼
┌─────────────────┐
│ ControlMapper   │  ← 将证据映射到控制点，标记 pass/fail/partial
└────────┬────────┘
         ▼
┌─────────────────┐
│ GapAnalyzer     │  ← 识别证据不足的控制点，生成补救建议
└────────┬────────┘
         ▼
┌─────────────────┐
│ ReportRenderer  │  ← 按框架模板生成 PDF + CSV + JSON
└────────┬────────┘
         ▼
ComplianceReport { framework, period, controls_passed, controls_failed, gaps[], export_urls }
```

## 66.3 报告类型与频率

| 框架         | 频率 | 范围   | 典型消费者     |
| ------------ | ---- | ------ | -------------- |
| SOC2 Type II | 季度 | 全平台 | 审计师 / 客户  |
| SOX 302/404  | 季度 | 财务域 | CFO / 外部审计 |
| HIPAA        | 月度 | 医疗域 | HIPAA Officer  |
| GDPR         | 月度 | 全平台 | DPO            |
| PCI-DSS      | 季度 | 支付域 | QSA            |
| ISO 27001    | 半年 | 全平台 | CISO           |

## 66.4 审计员只读访问

审计员通过 `AuditorAccess` 获得受限只读视图：

- **可见范围**：runs / decisions / evidence / compliance reports，按 tenant + timeRange + framework 过滤
- **权限控制**：仅 read 操作，无法修改、删除或导出原始数据
- **PII 保护**：返回数据经过 §23 数据分级检查，未通过分级审核的字段自动脱敏
- **审计追踪**：审计员的每次查询操作本身纳入审计日志(§23)，记录查询人、时间、范围

---

# 67. 容量规划与成本预测引擎

> 基于历史趋势的预测性容量建模，支持扩容时机建议、成本趋势预测和 What-if 容量仿真。
> 关联：§18 成本 · §27 SLO · §43 看板 · §54 SLA · §64 成本优化

## 67.1 资源维度追踪

| 维度              | 采集来源           | 预警阈值               |
| ----------------- | ------------------ | ---------------------- |
| Worker 并发数     | P4 Execution Plane | 当前容量 80%           |
| 存储用量          | P5 State Plane     | 当前容量 85%           |
| LLM Token 消耗/日 | §18 CostTracker    | 月度预算 70%           |
| API QPS           | P1 Interface Plane | 当前容量 75%           |
| Event Log 增长率  | P5 Event Store     | 存储容量 80%           |
| 队列深度          | P4 Fair Queue      | 平均等待时间 > SLA 50% |

## 67.2 预测模型

| 预测目标     | 算法                         | 预测周期       |
| ------------ | ---------------------------- | -------------- |
| Token 消耗量 | 线性回归 + 季节性分解        | 7d / 30d / 90d |
| 计算资源用量 | 线性回归 + 季节性分解        | 7d / 30d / 90d |
| 存储增长     | 指数平滑 + 容量上限外推      | 30d / 90d      |
| 并发运行需求 | 峰值回归 + 工作日/节假日校正 | 7d / 30d       |

预测结果自动输入 §67.1 预警阈值判断，当预测值在预测周期内将突破容量阈值时生成 `CapacityAlert`。

## 67.3 What-if 容量仿真

支持对以下场景进行容量影响模拟：

| 仿真场景        | 输入参数                    | 输出                                 |
| --------------- | --------------------------- | ------------------------------------ |
| 新租户上线      | 预估用量、SLA Tier          | 所需额外容量、成本增量               |
| 流量尖峰        | 峰值倍数、持续时间          | 瓶颈资源、扩容建议                   |
| Region 故障切换 | 失效 Region、流量迁移比例   | 目标 Region 剩余容量、是否需要预扩容 |
| 模型迁移        | 新模型 token 效率、延迟变化 | Token 消耗变化、Worker 并发影响      |

每次仿真输出 `requiredCapacity`、`estimatedCost`、`bottleneckWarnings`。

## 67.4 财务预算支持

- 月度成本趋势报告（实际 vs 预算 vs 预测）
- 季度容量规划建议（面向财务团队审批预算）
- 年度 TCO 预测（含硬件 + LLM API + 人力成本）

---

# 68. 多模态能力架构

> 扩展 ModelGateway 支持图像、语音、文档等多模态输入/输出，使平台能承接素材制作、客服图片处理、语音交互等场景。
> 关联：§15 ModelGateway · §26 存储 · §37 业务域 · §39 NL 入口

## 68.1 多模态 ModelGateway 扩展

在 §15 ModelGateway 基础上扩展多模态能力：

- **模态检测**：自动识别请求中包含的输入模态（text / image / audio / video / document）
- **能力路由**：根据所需模态自动选择支持该模态的 Provider（详见 §68.3 ModalityRouter）
- **格式转换**：输入/输出在 Provider 间格式不一致时自动转换（如 base64 ↔ URL ↔ binary）
- **Fallback 链**：多模态 Provider 不可用时按 §68.3 Fallback 配置降级

## 68.2 多模态 ModelRequest 扩展

在标准 ModelRequest 基础上增加多模态字段：

| 字段             | 类型            | 说明                                          |
| ---------------- | --------------- | --------------------------------------------- |
| inputModalities  | `string[]`      | 请求包含的输入模态列表                        |
| outputModalities | `string[]`      | 期望的输出模态列表                            |
| contentParts     | `ContentPart[]` | 混合内容块（text + image + audio 可交错排列） |

每种模态独立执行安全检查（§68.4），任一模态未通过检查则整个请求拒绝。

## 68.3 ModalityRouter

| 模态             | 默认 Provider                 | Fallback                       | 成本模型      |
| ---------------- | ----------------------------- | ------------------------------ | ------------- |
| Text LLM         | GPT-4o / Claude               | Qwen / DeepSeek                | per-token     |
| Image Analysis   | GPT-4o Vision / Claude Vision | Qwen-VL                        | per-image     |
| Image Generation | DALL-E 3 / Midjourney API     | Stable Diffusion (self-hosted) | per-image     |
| Speech-to-Text   | Whisper API                   | Paraformer (self-hosted)       | per-minute    |
| Text-to-Speech   | Azure TTS / ElevenLabs        | CosyVoice (self-hosted)        | per-character |
| Document Parse   | Document Intelligence         | Marker / Docling (self-hosted) | per-page      |

## 68.4 多模态安全

- 图像输入经过 content moderation（色情/暴力/敏感信息检测）
- 生成图像附带 C2PA 元数据水印
- 语音输入 PII 检测（电话号码、身份证号自动脱敏）
- 文档解析结果受 §50 知识域隔离约束

## 68.5 多模态成本追踪

§18 CostTracker 扩展 `modality` 维度：

---

# 69. 平台自运维 Agent 架构

> 平台使用自身 Agent 能力进行自我运维（dog-fooding），覆盖 Incident 自动诊断、常见故障自修复、配置优化建议、开发者问答。
> 关联：§12 异常事件 · §14 Execution · §37 业务域 · §41 主动 Agent · §43 看板

## 69.1 PlatformOps DomainDescriptor

平台自运维作为一个特殊业务域注册到 §37 域框架：

| 字段          | 值                                                                  |
| ------------- | ------------------------------------------------------------------- |
| domain        | `platform_ops`                                                      |
| riskProfile   | high（涉及生产环境写操作）                                          |
| tools         | `metrics_query`、`config_patch`、`restart_service`、`scale_replica` |
| evalFramework | SLO-based（以 §27 SLO 达成率作为 Agent 表现评估标准）               |
| autonomy_cap  | 只读操作最高 auto；写操作最高 supervised（§42）                     |

## 69.2 自运维 Agent 目录

| Agent             | 触发条件            | 能力                             | 自主权上限  |
| ----------------- | ------------------- | -------------------------------- | ----------- |
| IncidentDiagnoser | Incident 创建事件   | 收集日志、分析根因、生成诊断报告 | semi_auto   |
| ConfigOptimizer   | 每周定时 + 性能偏离 | 分析配置、建议优化、估算影响     | supervised  |
| CapacityPredictor | 每日定时            | 分析趋势、预测瓶颈、建议扩容     | supervised  |
| DevAssistant      | 开发者提问          | 查询文档、搜索代码、生成示例     | semi_auto   |
| HealthMonitor     | 连续运行            | 巡检平台健康、生成日报           | auto (只读) |

## 69.3 安全护栏

- 所有生产环境写操作**必须**经过人工审批
- PlatformOps Agent 的 ModelGateway 调用有独立的 cost budget 和 rate limit
- PlatformOps Agent 不能访问业务域数据，只能访问平台运维数据
- PlatformOps Agent 的所有操作纳入独立审计流(§23)，与业务审计隔离

## 69.4 自运维成熟度等级

| 等级 | 描述                                          | 人工参与度 |
| ---- | --------------------------------------------- | ---------- |
| L0   | 纯手动运维，Agent 仅辅助文档查询              | 100%       |
| L1   | Agent 生成诊断报告，人工决策和执行            | 80%        |
| L2   | Agent 生成修复方案并预执行验证，人工一键确认  | 40%        |
| L3   | Agent 自动处理 P3/P4 级别问题，P1/P2 仍需人工 | 15%        |

初始部署从 L0 开始，依据 §42 渐进式自主权逐步晋升。

---

# Part X — 落地路线与汇总（§33-§36）

---

## 三环实施优先级（Three-Ring Implementation Priority）

v4.1 将 v4.0 的大平台蓝图收敛为三个生产交付批次，明确"先做最小生产闭环 → 再做运行加固 → 最后做企业扩张"。三环与 §33 分阶段路线对应，但从**能力维度**而非**时间维度**划分优先级。

### 第一环：平台生存环（Platform Survival Ring）

> **没有第一环，不谈大规模接入。** 第一环不是完整 Phase 1 / Phase 2 / Phase 8a / Phase 8d 的总和，而是从这些 Phase 中切出的 MVP slice。目标是 8-12 周交付可运行、可审计、可停止、可 Trace Replay 的最小生产闭环；各 Phase 的完整能力进入 Hardening Ring 延展。

**MVP slice 边界**：

| 来源 Phase | 第一环必须交付 | 延后到 Hardening Ring |
| --- | --- | --- |
| Phase 1 | harness_run、node_run、event_log、checkpoint、lease、CAS、idempotency、最小 CLI inspect | 完整 schema inventory、全部 Group 1/2 表、复杂 projection rebuild |
| Phase 2 | Harness 主链最小 O→A→P→E→F、risk/approval basic、SideEffect proposed→committed→confirmed 最小链路 | 多 Pack 扩展、完整恢复 worker、复杂降级策略 |
| Phase 8a | HarnessRuntime.run() 入口、ConstraintPack、Planner/Generator/Evaluator 分离、HarnessDecision 六种裁决 | 完整 Memory Namespace、完整 Toolbelt 画像、复杂 feedback pipeline |
| Phase 8d | PlanGraph DAG、NodeRun 状态机、Event Registry facts、Budget atomic reserve、Trace Replay、SideEffect Reconciliation baseline | GraphPatch 完整策略、LearningCandidate、EvaluationGate 全量矩阵、完整 Runtime Test Matrix |

必须最先交付的最小闭环能力集，缺失任一项则平台不可投产：

| 能力                                       | 对应章节         | 交付标准                                  |
| ------------------------------------------ | ---------------- | ----------------------------------------- |
| P1-P5 核心链路                             | §4-§7, §14       | 五平面通信端到端可达                      |
| ConstraintPack                             | §45.3            | 任务级约束信封可加载、可校验              |
| HarnessRun / HarnessStep / HarnessDecision | §45.13, §58.6    | Planner→Generator→Evaluator 闭环可运行    |
| PlanGraph / Event Registry / SideEffect Reconciliation | §13, §14, §28 | 复杂任务图化、状态事件化、副作用可对账 |
| Risk / Approval / Audit                    | §10, §47, §23    | 风险评分→审批路由→审计写入全链路          |
| Lease / CAS / Checkpoint / Recovery        | §14, §25, §45.15 | 状态持久化、故障恢复可演示                |
| Panic / Incident / Replay                  | §9, §12, §60     | 紧急制动可触发、事件可回放                |
| ModelGateway / Prompt / Eval Gate          | §15, §16, §17    | LLM 调用有网关、Prompt 有版本、质量有门禁 |

**第一环验收门**：可在受控环境中端到端运行一个 Agent 任务（从入口到结果产出），复杂任务以 PlanGraph 执行，预算原子预留生效，任务可被中断、恢复、审计、Trace Replay，且真实 side effect 不会在 replay 中重复发生。第一环明确不包含 Multi-Region、Marketplace、24 垂直域、Edge Runtime、PlatformOps Agent、完整 Evaluation Harness、完整组织治理、完整多模态或完整合规报告。

### 第二环：平台可用环（Platform Usability Ring）

> **做到第二环，平台能支撑真实业务试点。** 对应 §33 Phase 3-5 + Phase 8b-8c。Phase 8c 的治理与评测必须在 Phase 8d 的 PlanGraph / Event / SideEffect / Budget 基线完成后才能验收。

在第一环基础上补齐面向用户和企业的闭环：

| 能力                                                  | 对应章节          | 交付标准                                                            |
| ----------------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| NL 入口                                               | §39               | 自然语言任务提交可用                                                |
| Goal Decomposition                                    | §40               | 目标分解引擎可将复合任务拆解                                        |
| HITL Runtime                                          | §45.18            | inspect / patch / override / takeover / resume 五种人工介入模式可用 |
| Async Harness                                         | §45.19            | 长时任务可休眠/唤醒                                                 |
| Dashboard                                             | §43               | L0/L1 看板视图可用                                                  |
| Org / SSO / Approval Routing                          | §46-§48           | 组织层次→审批路由→SSO 集成                                          |
| DomainDescriptor / DomainRecipe / DomainEvalFramework | §37, §37.7, §37.5 | 域建模框架可用，至少 2 个域完成接入                                 |
| Canonical Domain Meta-Model                           | §37.11            | 元模型 12 问模板可填写、可校验                                      |
| Agent Collaboration Protocol                          | §19.5             | 多 Agent 协作消息可收发、不可违反规则可校验                         |

**第二环验收门**：至少 2 个垂直域（推荐选 1 个 Critical + 1 个 Medium 风险域）完成试点上线，非技术用户可通过 NL 入口提交任务，审批和 HITL 流程可走通。

### 第三环：平台扩张环（Platform Expansion Ring）

> **做到第三环，才能谈 24 域规模化。** 对应 §33 Phase 6-9。

在前两环基础上补齐规模化和持续优化能力：

| 能力                     | 对应章节 | 交付标准                                      |
| ------------------------ | -------- | --------------------------------------------- |
| Marketplace              | §55      | Agent 市场可发布/订阅/废弃                    |
| Multi-Region             | §52      | 至少 2 Region 可部署                          |
| Edge Runtime             | §62      | 离线/边缘场景可运行                           |
| Cost Optimizer           | §64      | 成本归因到域/Agent/任务级别                   |
| Behavior Drift Detection | §63      | 漂移检测基线建立、告警可触发                  |
| Compliance Reporter      | §66      | 合规报告可自动生成                            |
| 24 Domain Packs          | §71-§94  | 全部 24 域完成元模型填写并通过 §38 四阶段门禁 |

**第三环验收门**：≥ 12 个域在生产环境运行，跨 Region 故障切换演练通过，平台自运维 Agent（§69）可处理 P3/P4 级别问题。

### 三环与 §33 Phase 映射

```text
第一环（生存）    第二环（可用）         第三环（扩张）
 Phase 1/2/8a/8d   Phase 3-5+8b/8c        Phase 6-9
 MVP slices only
 ┌─────────┐      ┌───────────────┐      ┌────────────────────────┐
 │ 骨架+    │─────▶│ NL入口+HITL+  │─────▶│ Marketplace+Multi-     │
 │ Harness核│      │ Org+域试点+   │      │ Region+Edge+Cost+      │
 │ 心+Trace │      │ 协作协议+评测 │      │ Drift+24域全覆盖       │
 └─────────┘      └───────────────┘      └────────────────────────┘
 约 8-12 周          约 12-24 周             约 24 周以后
```

### 实施决策建议

- **资源有限时**：只做第一环 + 第二环中的 DomainDescriptor/HITL，足以支撑 POC
- **时间压力大时**：第二环的 NL 入口可用简化版（结构化表单）替代，Dashboard 可延后
- **域数量可伸缩**：第三环的 24 域可按 §33 Phase 9 的 6 批节奏分批上线，无需一次全部交付

---

# 33. 分阶段落地路线

> 含**验收门**、**依赖关系**和**具体交付物**。

## Phase 1：稳态骨架（8 周）

### 交付物

- truth tables + event log + UoW（Group 1 表）
- lease / fencing / CAS
- idempotency
- artifact ref
- policy outcome + decision model（Group 2 表）
- 最小运维 CLI（doctor / inspect）
- Unit test ≥ 80% 覆盖

### 验收门

- [ ] workflow_run 可稳定创建和推进（无降级）
- [ ] lease 超时后自动 reclaim
- [ ] CAS 冲突被正确拒绝
- [ ] 事件追加与真相表在同一事务

### 依赖

无外部依赖。SQLite + Node.js 即可启动。

## Phase 2：受控自动化（8 周）

### 交付物

- OAPEFLIR 主链 O→A→P→E→F
- risk assessment engine
- approval gates（basic）
- side effect tracking
- recovery workers（LeaseReclaimer + StuckRunSweeper）
- 2 个 Business Pack：coding.fix_bug + operations.resolve_incident

### 验收门

- [ ] 主链端到端跑通（task 创建 → 执行 → 完成）
- [ ] 高风险 step 触发审批阻断
- [ ] worker 崩溃后 30s 内恢复执行
- [ ] side effect 可查询可审计

### 依赖

Phase 1 全部验收通过。

## Phase 3：企业可靠化（12 周）

### 交付物

- OAPEFLIR 副链 F→L→I→R
- circuit breaker + degradation mode switching
- backpressure（4 模式）
- incident management + DLQ 运营
- projection rebuild
- replay / repair
- 配置治理（版本化 + 灰度）
- 多租户隔离强化
- PostgreSQL 迁移（可选）

### 验收门

- [ ] 外部依赖熔断后自动降级，恢复后自动回升
- [ ] DLQ 可查询可重试可关闭
- [ ] Incident 闭环处置链打通
- [ ] Projection rebuild 后数据一致
- [ ] 配置变更可回滚

### 依赖

Phase 2 全部验收通过。

## Phase 4：规模化扩展（持续）

### 交付物

- Worker 分离部署（Phase D2）
- 更多 Business Pack
- 浏览器执行深化
- 插件生态
- SLO 自动化监控
- 合规导出
- 容灾演练

### 验收门

- [ ] 50 并发 workflow 稳定运行
- [ ] 多 tenant 隔离验证通过
- [ ] Load test 符合 §27 SLO
- [ ] 容灾演练 RTO < 10min

## Phase 5：智能交互 + 组织治理 + 域接入框架（12 周）

> 智能交互层 + 组织治理层 + 统一领域元模型 + 多 Agent 协作协议。

### 交付物

- 自然语言任务入口(§39) + 目标分解引擎(§40)
- 主动式 Agent 框架(§41) + 渐进式自主权模型(§42)
- 统一运营看板(§43) + 非技术用户体验(§44)
- 组织层次模型(§46) + 审批路由(§47) + SSO/SCIM(§48)
- 合规策略引擎(§49) + 知识域隔离(§50) + 治理委托(§51)
- 统一领域元模型 12 问模板与校验工具(§37.11)
- 多 Agent 协作协议消息格式与不可违反规则校验(§19.5)

### 验收门

- [ ] 非技术用户可通过自然语言创建和管理任务
- [ ] 目标分解引擎自动将业务目标拆解为可执行任务图
- [ ] 渐进式自主权 L0→L3 升级路径端到端验证
- [ ] 组织架构三级层次正确驱动审批路由
- [ ] SSO/SCIM 自动同步用户且停用账户 < 5min 生效
- [ ] 知识域隔离零泄漏，受控共享审计完整
- [ ] 12 问元模型模板可填写、可校验，至少 2 个域完成填充
- [ ] 多 Agent 协作消息收发端到端可达，7 条不可违反规则自动校验

### 依赖

Phase 4 全部验收通过。

## Phase 6：规模化与生态（12 周）

> 规模化运行层 + 生态层。

### 交付物

- 多 Region 部署(§52) + 资源竞争管理(§53) + SLA 分级(§54)
- Agent 市场(§55) + 反馈改进管线(§56) + 外部集成框架(§57)

### 验收门

- [ ] 双 Region 单 leader / follower read 部署，受控 failover 演练通过，单 Region 故障 RTO < 5min
- [ ] active-active 只用于非 truth 的缓存、遥测或聚合统计，不承载 HarnessRun / Budget / SideEffect 写入
- [ ] 1000 并发 workflow 下高优先级任务不饥饿
- [ ] SLA Tier P0 任务 99.9% 在承诺时间内完成
- [ ] Marketplace 至少 20 个认证 Pack 上架
- [ ] 用户反馈→改进闭环 < 7 天

### 依赖

Phase 5 全部验收通过。

## Phase 7：运营成熟度（持续）

> 运营成熟度层。

### 交付物

- 可解释性(§59) + 紧急制动(§60) + 生命周期管理(§61)
- 离线/边缘部署(§62) + 行为漂移检测(§63) + 成本优化(§64)
- 可视化调试器(§65) + 合规报告(§66) + 容量规划(§67)
- 多模态能力(§68) + 平台自运维 Agent(§69)

### 验收门

- [ ] 用户可对任意 step 查询解释，L1 延迟 < 2s
- [ ] 紧急制动演练：全平台停止 < 5s，恢复 < 30min
- [ ] EdgeRuntime 断网 24h 恢复后数据同步零丢失
- [ ] 行为漂移 > 2σ 时 100% 触发告警
- [ ] 合规报告 SOC2 Type II 控制点覆盖率 ≥ 95%
- [ ] PlatformOps Agent L1 成熟度验证通过

### 依赖

Phase 6 全部验收通过。

## Phase 8a：Harness 统一运行协议（8 周）

> Harness 工程化层。可与 Phase 3 并行启动。

### 交付物

- HarnessRun/HarnessStep 统一契约(§45.13) + HarnessDecision(§58.6)
- Harness Runtime 主入口 + HarnessLoopController(§45.7)
- ConstraintPack 装配引擎(§45.3) + ToolbeltAssembler(§45.4)
- ContextAssembler + ContextSnapshot(§45.5) + 最小 Working Memory(§45.16)
- Planner/Generator/Evaluator Agent 角色分离(§45.8-45.10)
- FeedbackEnvelope 四段闭环(§45.6)
- 基础 Evaluator（运行时裁决）

### 验收门

- [ ] 所有任务执行通过 HarnessRuntime.run() 入口，无旁路
- [ ] ConstraintPack 正确合并平台→租户→域→任务四级约束
- [ ] Planner/Generator/Evaluator 使用独立 Prompt，不共用
- [ ] 每步执行后 Evaluator 评估通过率 ≥ 95%
- [ ] HarnessRun/HarnessStep 契约完整覆盖所有运行和步骤
- [ ] HarnessDecision 六种裁决均有测试覆盖

## Phase 8b：Harness 长时与人机（6 周）

> 八支柱深化。依赖 Phase 8a 完成。

### 交付物

- Durable Harness 持久执行(§45.15)：pauseReason 注册表 + resumeStrategy
- HITL Runtime(§45.18)：inspect/patch/override/takeover/resume 五类能力
- Async Harness(§45.19)：create_run/poll_status/subscribe_events/intervene_mid_run
- Memory Namespace(§45.16)：Working/Long-term/Shared Knowledge 三层 + 晋升策略
- Harness Prompt 分层治理(§58.2)
- Failure-to-Learning 管线(§58.3)
- 在线反馈闭环

### 验收门

- [ ] ContextSnapshot 支撑崩溃恢复，恢复后状态一致
- [ ] Durable Harness 支持 5 种 pauseReason 和 4 种 resumeStrategy
- [ ] HITL Runtime 的 inspect/patch/override 在 §43 看板可操作
- [ ] Async run 支持 poll_status 和 intervene_mid_run
- [ ] Memory 三层命名空间隔离通过租户/域隔离测试

## Phase 8c：Harness 治理与评测（6 周）

> 八支柱深化。依赖 Phase 8b + Phase 8d 完成。

### 交付物

- Evaluation Harness(§45.14)：预发布评测 + 版本对比评测
- Tool Harness(§45.17)：工具能力画像 + 工具调用治理记录
- Guardrails 分层(§45.20)：input/planning/tool/memory/output 五层
- Harness Replay/Simulation(§58.4)
- Harness 十条不变量(§45.21) 强制检查
- Harness 级 metrics 在 §43 看板可见(§58.1)

### 验收门

- [ ] Evaluation Harness 能在沙箱中运行标准任务集并输出对比报告
- [ ] Tool Harness 的 Capability Profile 覆盖所有已注册工具
- [ ] Guardrails 五层均有拦截测试覆盖
- [ ] Harness Replay 能完整回放已完成的 run
- [ ] 十条不变量有对应的自动化检查（违反即 CI 失败）

### 依赖

Phase 8a → Phase 8d；Phase 8d → Phase 8b；Phase 8b + Phase 8d → Phase 8c。Phase 8a 可与 Phase 3-7 并行推进；Phase 8d 是 Phase 8b/8c 的运行语义基线。Phase 5 之前必须完成 Phase 8c。

## Phase 8d：OAPEFLIR-Harness 收敛运行契约（8 周）

> OAPEFLIR-Harness 收敛契约。依赖 Phase 8a，是 Phase 8b/8c 的运行语义基线；Phase 8b 的长时/HITL 能力可以局部并行开发，但验收必须以 Phase 8d 的 HarnessRun / NodeRun / Event / SideEffect / Budget 契约为准。

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

- [ ] 所有状态迁移有单元测试覆盖，终态不可迁出。
- [ ] PlanGraph 校验可拦截 deadlock / missing terminal / missing compensation。
- [ ] 同一 graph 的 scheduler decision 可 Trace Replay；Re-execution Replay 标记 nondeterministic。
- [ ] SideEffect ambiguous 可进入 reconciliation，不会被误判 success。
- [ ] Budget exhausted 可阻断 retry / replan。
- [ ] HITL approve scope 生效，不会扩大授权。
- [ ] LearningCandidate 污染检查可阻断 holdout / PII / secret。
- [ ] EvaluationGate 可阻断不合格 Prompt / Policy / Tool / Domain 发布。
- [ ] Replay 不产生真实 side effect。

## Phase 9：垂直业务域深化落地（48 周，分 6 批）

> 24 个垂直业务域的 DomainDescriptor 实例化、领域工具集成、领域评估基线建立和灰度上线。依赖 Phase 5 + Phase 8c 完成。前 3 批覆盖原始 12 域（v3.0），后 3 批覆盖新增 12 域（v3.1）。

### Phase 9a：高优先级域（8 周）——代码开发 · 数据处理 · 企业知识库 · 用户运营

选择标准：平台已有 coding/operations 实例、风险可控、可快速验证域框架。

#### 交付物

- 4 个域的 DomainDescriptor 实例（含 RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy）
- 4 个域的 Business Pack（至少各 2 个核心 Workflow）
- 4 个域通过 §38 四阶段门禁（建模→开发→认证→灰度）
- 域级评估基线和回归数据集

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] 每个域 eval 所有质量轴达到 acceptance_threshold
- [ ] 域级 SLO 达标率 ≥ 95%
- [ ] 跨域交互策略验证通过（代码开发↔数据处理）

### Phase 9b：中优先级域（8 周）——量化交易 · 金融服务 · 电商 · 广告推广

选择标准：高业务价值、Critical 风险域需更严格认证。

#### 交付物

- 4 个域的 DomainDescriptor 实例（含领域专属风控规则和合规映射）
- Trading/Compliance 原型模板验证
- 量化交易域超低延迟路径验证
- 金融服务域监管报表 Agent 端到端验证

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] Critical 风险域（量化交易/金融服务）HITL 覆盖率 100%
- [ ] 量化交易域执行路径延迟 < 10ms（不含 LLM）
- [ ] 金融服务域 AML/KYC 合规检查通过

### Phase 9c：完善域（8 周）——行业调研 · 学术调研 · 财务 · 法务

选择标准：高 HITL 要求、监管密集、需律师/审计师参与验证。

#### 交付物

- 4 个域的 DomainDescriptor 实例
- Research/Adversarial 原型模板验证
- 法务域律师审核工作流端到端验证
- 财务域 SOX 合规审计轨迹验证

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] 法务域所有输出 100% 经律师审核
- [ ] 财务域审计轨迹完整性检查通过
- [ ] 学术调研域引用准确率 100%（零捏造）
- [ ] 前 12 个域全部在线运行，跨域交互矩阵验证通过

### Phase 9d：高优先级新域（8 周）——客户服务 · IT 运维 SRE/DevOps · 内容审核与安全 · 在线直播

选择标准：运营刚需、实时性要求高、已有成熟工具生态可集成。

#### 交付物

- 4 个域的 DomainDescriptor 实例（含 RiskProfile/KnowledgeSchema/EvalFramework/PromptLibrary/GovernancePolicy）
- 客户服务域多轮对话闭环端到端验证
- IT 运维域告警→诊断→修复自动化链路验证
- 内容审核域 CSAM 即时报告合规流程验证
- 在线直播域实时流审核延迟 < 2s 验证

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] 客户服务域首次解决率 ≥ 70%，CSAT ≥ 4.0
- [ ] IT 运维域 MTTR 降低 ≥ 30%（对比人工基线）
- [ ] 内容审核域违规内容召回率 ≥ 99.5%，CSAM 100% 即时上报
- [ ] 在线直播域实时流审核端到端延迟 < 2s

### Phase 9e：中优先级新域（8 周）——医疗健康 · 人力资源 · 供应链与物流 · 教育培训

选择标准：高合规要求、强 HITL 域、需领域专家深度参与认证。

#### 交付物

- 4 个域的 DomainDescriptor 实例（含领域专属合规映射和审批工作流）
- 医疗健康域执业医师审核工作流端到端验证
- 人力资源域招聘偏见审计通过
- 供应链域需求预测→调度→异常处理链路验证
- 教育培训域个性化学习路径推荐验证

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] 医疗健康域所有诊疗建议 100% 经执业医师审核
- [ ] 人力资源域招聘流程偏见审计通过（Adverse Impact Ratio ≥ 0.8）
- [ ] 供应链域需求预测准确率 ≥ 85%（MAPE ≤ 15%）
- [ ] 教育培训域学习效果提升 ≥ 15%（对比基线）

### Phase 9f：完善新域（8 周）——广告素材制作 · 游戏开发 · 游戏上架 · 市场营销与品牌

选择标准：创意密集型、发布流程复杂、需多方协作验证。

#### 交付物

- 4 个域的 DomainDescriptor 实例
- 广告素材域多模态生成→合规审核→迭代链路验证
- 游戏开发域代码生成→测试→性能验证链路验证
- 游戏上架域多平台合规检查→提交→监控链路验证
- 市场营销域 Campaign 编排→投放→效果分析闭环验证

#### 验收门

- [ ] 4 个域全部达到 GA 状态
- [ ] 广告素材域创意合规通过率 ≥ 95%（首次提交）
- [ ] 游戏开发域代码生成编译通过率 ≥ 90%
- [ ] 游戏上架域多平台合规一次通过率 ≥ 85%
- [ ] 24 个域全部在线运行，跨域交互矩阵 24×24 验证通过

### 依赖

Phase 9a 依赖 Phase 5 + Phase 8c 完成。Phase 9a→9b→9c→9d→9e→9f 线性推进，总计 48 周。Phase 9d 可在 Phase 9c 完成后立即启动。

## 33.1 Phase 依赖图

```text
Phase 1 (稳态骨架)
    │
    ▼
Phase 2 (受控自动化)
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
Phase 9a (高优先级域：代码·数据·知识库·运营)
    │
    ▼
Phase 9b (中优先级域：量化·金融·电商·广告)
    │
    ▼
Phase 9c (完善域：调研·学术·财务·法务)
    │
    ▼
Phase 9d (高优先级新域：客服·IT运维·内容审核·直播)
    │
    ▼
Phase 9e (中优先级新域：医疗·HR·供应链·教育)
    │
    ▼
Phase 9f (完善新域：素材·游戏开发·游戏上架·营销)
```

Phase 9a 从 Phase 5 + Phase 8c 完成后即可启动（可与 Phase 6-7 并行推进早期准备工作）。Phase 9a→9b→9c→9d→9e→9f 线性推进，总计 48 周。

## 33.2 生产最小闭环（Production Minimum Closure）

为确保平台可分批交付并尽早进入生产验证，将功能划分为三个交付批次：

**Batch A — 可控运行闭环**（Phase 1-2 交付）：
P1-P5 平面骨架 · OAPEFLIR/Harness 主链 · ConstraintPack · Toolbelt · Evaluator 基础裁决 · Checkpoint/Recovery · Approval/Policy/Audit 基础流程。交付后可在受控环境运行端到端任务。

**Batch B — 企业运行闭环**（Phase 3-4 交付）：
Async Harness · HITL Runtime · Memory Namespace · Tool Harness 治理 · Guardrails 五层 · Multi-tenant/Org/Compliance · Drift Detection 基础。交付后可支撑企业多团队、多审批、长时任务场景。

**Batch C — 平台优化闭环**（Phase 5-8c 交付）：
Evaluation Harness（离线评测 + 版本对比）· Replay/Simulation · Cost 优化 · Drift 自动修复 · PlatformOps Agent · Marketplace。交付后平台具备自运维与持续改进能力。

各批次交付标准：全链路冒烟通过 · 关键路径 E2E 测试覆盖 · 安全扫描无 P0/P1 · 运维手册就绪。

---

# 34. ADR 冻结建议

共 123 个 ADR：

**平台基础（19 个）**：
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**平面通信与部署（4 个）**：

- **ADR-Plane-Communication-Contracts** — 五平面间必须通过正式契约对象通信
- **ADR-Repository-Abstraction-Layer** — 所有存储访问通过 Repository interface
- **ADR-Single-Process-First** — 部署从单体开始，验证后再拆分
- **ADR-API-Versioning-Strategy** — API 版本化与向后兼容策略

**AI 运营（9 个）**：

- **ADR-ModelGateway-As-Single-LLM-Entry** — 所有 LLM 调用必须通过 ModelGateway，禁止直接调用 provider SDK
- **ADR-Prompt-As-Versioned-Resource** — Prompt 不内联代码，作为版本化资源独立管理
- **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model 变更必须通过质量门禁
- **ADR-Per-Tenant-Cost-Metering** — 所有 LLM 成本必须按 tenant 计量
- **ADR-Delegation-Depth-Limit** — Agent 间委托最大深度 = 3
- **ADR-Workflow-Hibernation-Model** — 长时等待 workflow 必须释放 worker 并持久化状态
- **ADR-Crypto-Shredding-For-Erasure** — GDPR 删除通过 crypto-shredding 实现
- **ADR-Pack-Semver-Compatibility** — Pack Manifest API 遵循 semver 兼容性契约
- **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM 延迟独立监控，不计入平台自身 SLO

**业务域接入（4 个）**：

- **ADR-Domain-Descriptor-As-Semantic-Layer** — 每个 Business Pack 必须关联 DomainDescriptor，领域语义不内嵌 Pack 代码
- **ADR-Domain-Risk-Override-Over-Platform-Default** — 领域风险画像覆写优先于平台默认风险矩阵，覆写需审计理由
- **ADR-Domain-Recipe-As-Onboarding-Accelerator** — 新业务域必须从十二种原型模板之一开始，禁止空白接入
- **ADR-Four-Phase-Domain-Onboarding** — 业务域接入必须通过四阶段门禁（建模→开发→认证→灰度），不允许跳过

**智能交互（6 个）**：

- **ADR-NL-Intent-Must-Resolve-To-RequestEnvelope** — 自然语言输入必须经过 Intent 解析生成结构化 RequestEnvelope(§5.3)，禁止将原始文本直接传递给 Agent
- **ADR-Goal-Decomposition-Max-Depth** — 目标分解引擎递归深度上限 = 5，超过需人工确认分解方案
- **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — 主动式 Agent 必须绑定 TriggerPolicy，禁止无条件轮询
- **ADR-Autonomy-Level-Guarded-Progression** — 渐进式自主权等级默认单调递增（晋升需满足积分门槛 + 审批）；降级仅在 §42.2 定义的安全触发条件下发生（P0 Incident / 连续失败 / 成本超限），降级执行后须人工审批确认并记录原因，恢复路径遵循晋升规则
- **ADR-Dashboard-Metric-Source-Of-Truth** — 统一运营看板数据必须来自 State & Evidence Plane，禁止直接读取 Runtime 内部状态
- **ADR-No-Code-UX-Maps-To-Standard-API** — 非技术用户界面操作必须映射到标准 Public API，禁止旁路

**组织治理（6 个）**：

- **ADR-Org-Hierarchy-As-First-Class-Model** — 组织层次（企业→事业群→部门→团队）作为一等模型，所有资源归属必须关联 OrgNode
- **ADR-Approval-Route-From-Org-Chart** — 审批路由必须从组织架构动态派生，禁止硬编码审批人列表
- **ADR-SSO-As-Single-Identity-Source** — 企业 SSO 为唯一身份来源，平台不维护独立用户密码
- **ADR-Compliance-Policy-Inherits-Down** — 合规策略沿组织树向下继承，子节点只能收紧不能放松
- **ADR-Knowledge-Boundary-Default-Deny** — 知识域默认隔离，跨部门共享需显式授权并记录审计日志
- **ADR-Governance-Delegation-Requires-Scope** — 治理权委托必须限定 scope（资源类型 + OrgNode 范围），禁止全局委托

**规模化与生态（6 个）**：

- **ADR-Multi-Region-Single-Leader-Per-Partition** — 多 Region 采用每 partition 单 leader 写入，follower read + 异步复制 + 受控 failover，禁止多主 truth 写入
- **ADR-Resource-Contention-Fair-Queue** — 规模化部署必须使用加权公平队列，禁止简单 FIFO 导致高优先级任务饥饿
- **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA 等级决定资源配额、队列优先级和故障恢复顺序
- **ADR-Marketplace-Pack-Must-Pass-Certification** — Agent 市场上架的 Pack 必须通过平台认证（安全扫描 + 沙箱测试 + 性能基线）
- **ADR-Feedback-Loop-Closed-Within-SLA** — 用户反馈必须在 SLA 定义的时间窗内形成闭环（采集→分析→改进→验证）
- **ADR-Integration-Through-Unified-Connector** — 外部系统集成必须通过统一 Connector 框架，禁止业务代码直接调用外部 API

**运营成熟度（11 个）**：

- **ADR-Every-Decision-Must-Have-Rationale** — OAPEFLIR 每个阶段必须生成 StageRationale，决策解释按需渲染
- **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective 必须在 5 秒内原子停止全平台，恢复需双人审批
- **ADR-Agent-As-Composite-Entity** — Agent 作为 Pack+Prompt+Model+Trust+Trigger 的复合实体，以 AgentVersion 为发布和回滚单位
- **ADR-Edge-Runtime-Risk-Ceiling** — 离线 EdgeRuntime 只允许执行 risk_level ≤ medium 的动作，高风险动作等待连接恢复
- **ADR-Behavior-Fingerprint-Mandatory** — 每个 Agent 必须维护 BehaviorFingerprint，漂移检测覆盖 1h/7d/30d/90d 四个窗口
- **ADR-Cost-Attribution-Per-Decision** — 成本归因必须精确到决策级（单个 LLM 调用），优化建议必须附带 quality_risk 评估
- **ADR-Workflow-Debug-Session-Isolated** — 调试 session 在隔离沙箱中运行，断点暂停不影响其他 workflow
- **ADR-Compliance-Report-Template-Versioned** — 合规报告模板必须版本化，报告生成时锁定模板版本
- **ADR-Capacity-Forecast-Drives-Scaling** — 容量预测结果必须关联到扩容建议，扩容建议必须附带成本影响估算
- **ADR-Multimodal-Safety-Check-Before-Output** — 多模态输出（图片/语音）必须经过内容安全检查后才能交付给用户
- **ADR-PlatformOps-Agent-Read-Only-Default** — 平台自运维 Agent 默认只读，生产写操作必须经过人工审批

**Harness 工程化（7 个）**：

- **ADR-Harness-As-First-Class-Runtime** — Harness Runtime 作为一级架构对象，所有任务执行必须通过 HarnessRuntime.run() 入口，禁止绕过 Harness 直调 P4
- **ADR-ConstraintPack-Per-Run** — 每次 HarnessRun 必须携带显式 ConstraintPack，约束来源按平台→租户→域→任务优先级合并
- **ADR-Planner-Generator-Evaluator-Prompt-Isolation** — Planner/Generator/Evaluator 三类 Agent 的 Prompt 必须独立版本化和独立 rollout，禁止共用 Prompt 模板
- **ADR-Step-Level-Evaluation-Mandatory** — 每步执行完成后必须经过 Evaluator 评估，禁止跳过评估直接推进下一步
- **ADR-Toolbelt-Minimum-Privilege** — Toolbelt 按最小权限装配，仅包含当前任务 + 域 + 风险等级允许的工具子集
- **ADR-ContextSnapshot-Per-Loop** — 每轮 Harness loop 必须保存 ContextSnapshot 到 P5 Checkpoint，支撑崩溃恢复和 Replay
- **ADR-Global-Call-Depth-Limit** — 目标分解(depth≤5)、委托链(depth≤3)、全局调用深度硬上限 = 8；decompose / delegate / subgraph 均 +1，局部上限不得相乘

**Harness 八支柱（9 个）**：

- **ADR-Harness-Eight-Pillar-Model** — Harness 从五元组升级为八支柱（Constraints · Tools · State/Memory · Feedback · Durability · Evaluation Harness · HITL Runtime · Observability/Replay），所有支柱必须有独立验收门
- **ADR-HarnessRun-As-First-Class-Entity** — HarnessRun 作为一级实体，具有完整生命周期（pending→running→paused→completed/failed/aborted），所有状态转换必须写入审计日志
- **ADR-HarnessDecision-Six-Way** — HarnessDecision 固定六种裁决（accept/retry_same_plan/replan/escalate_to_human/downgrade_mode/abort），禁止自定义裁决类型
- **ADR-Evaluation-Harness-Outcome-Over-Transcript** — 评测以最终 outcome（环境状态是否到达目标态）为主要指标，transcript 仅为辅助
- **ADR-Durable-Harness-Pause-Resume** — 所有 async run 必须支持显式 pause/resume，pause 时完整序列化到 P5 Checkpoint
- **ADR-Memory-Three-Namespace-Isolation** — Working/Long-term/Shared Knowledge 三层记忆必须命名空间隔离，跨层晋升需策略审核
- **ADR-Tool-Capability-Profile-Mandatory** — 每个注册工具必须附带 Capability Profile，无 profile 的工具禁止被 ToolbeltAssembler 装配
- **ADR-HITL-As-Runtime-Primitive** — HITL 作为 Harness 原生运行时步骤类型（phase=hitl），不仅是 escalation 路径
- **ADR-Guardrails-Five-Layer** — Guardrails 分 input/planning/tool/memory/output 五层，每层独立配置、独立拦截、独立审计

**OAPEFLIR-Harness 收敛运行规范（18 个）**：

- **ADR-OAPEFLIR-Plan-Is-Graph** — 复杂任务 Plan 必须是 PlanGraph，线性 steps 仅作为 legacy 展示或单节点退化形式
- **ADR-OAPEFLIR-Event-Registry-As-Source-Of-Replay** — Event Registry 是 replay、projection rebuild、causal lineage 的事件事实来源
- **ADR-OAPEFLIR-Deterministic-Graph-Scheduler** — Graph Scheduler 决策必须记录并可 Trace Replay，不依赖不可复现外部状态
- **ADR-OAPEFLIR-Terminal-State-Immutability** — HarnessRun / NodeRun 终态不可迁出，修复只能追加 redrive、compensation 或 GraphPatch
- **ADR-OAPEFLIR-Retry-Append-Only-Lineage** — Retry / Redrive 必须追加 AttemptLineage，不得覆盖历史 attempt
- **ADR-OAPEFLIR-SideEffect-Delivery-Semantics** — 所有副作用必须声明交付语义和确认机制
- **ADR-OAPEFLIR-Reconciliation-For-Ambiguous-External-State** — 外部状态不确定必须进入 Reconciliation，不得误判成功
- **ADR-OAPEFLIR-DecisionInputBundle-Frozen-Before-Decision** — Decision Engine 裁决前必须冻结 DecisionInputBundle
- **ADR-OAPEFLIR-Budget-Reservation-Before-LLM-And-Tool** — LLM / Tool / SideEffect / Evaluation 前必须 reserve budget
- **ADR-OAPEFLIR-ContextAssembly-Per-Role** — Planner / Generator / Evaluator 必须使用独立上下文装配契约
- **ADR-OAPEFLIR-Prompt-Role-Isolation** — Planner / Generator / Evaluator Prompt 独立版本化、评测和发布
- **ADR-OAPEFLIR-Memory-Write-Governance** — 长期记忆和共享知识写入必须通过 MemoryWriteGovernance
- **ADR-OAPEFLIR-HITL-Responsibility-Record** — 人工 approve / override / takeover 必须记录 scope 与责任边界
- **ADR-OAPEFLIR-Run-Version-Lock** — 每次 Run admitted 时冻结 Prompt / Policy / Tool / Model / Domain / Eval 版本
- **ADR-OAPEFLIR-Learning-Quarantine-Before-Release** — LearningCandidate 必须隔离、评测、审批后才能进入发布
- **ADR-OAPEFLIR-Evaluation-Gate-Before-Online-Change** — Prompt / Policy / Tool / Domain 改进上线前必须通过 EvaluationGate
- **ADR-OAPEFLIR-LLM-Judge-Cannot-Override-Deterministic-Failure** — LLM-as-Judge 不能覆盖策略拒绝、安全违规、预算耗尽、状态机非法等确定性失败
- **ADR-OAPEFLIR-Replay-Never-Produces-Real-SideEffect** — Replay / Simulation 永远不得产生真实外部副作用

**垂直业务域深化（24 个）**：

- **ADR-Domain-Recipe-Twelve-Archetypes** — DomainRecipe 从八种扩展为十二种原型（CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps），覆盖 24 个垂直域工作流模式
- **ADR-Quant-Trading-Pre-Trade-Risk-Mandatory** — 量化交易域所有订单必须经过盘前风控检查，风控延迟不得 >50μs，硬性仓位/损失限额不可由 Agent 覆盖
- **ADR-Financial-Services-Explainable-Decisions** — 金融服务域所有不利信贷决策必须附带可解释的拒绝理由，符合公平借贷法规
- **ADR-Legal-Output-Attorney-Review-Mandatory** — 法务域所有 Agent 输出在外发或被采取行动前必须经执业律师审核，Agent 只提供"法律信息"而非"法律意见"
- **ADR-Finance-Accounting-Segregation-Of-Duties** — 财务域必须执行职责分离（创建人≠审批人），符合 SOX 内控要求
- **ADR-Ecommerce-Price-Change-Guardrail** — 电商域价格变动超过当前价 X% 必须触发人工审批，防止乌龙定价
- **ADR-Academic-Research-Zero-Citation-Fabrication** — 学术调研域每条引用必须可解析到真实论文（DOI/数据库验证），零捏造容忍
- **ADR-Knowledge-Base-Source-Permission-Mirroring** — 企业知识库域必须镜像源系统文档级权限，查询时执行实时访问检查
- **ADR-Advertising-Budget-Hard-Cap** — 广告推广域必须有平台层硬性每日/每小时预算上限，竞价错误不得突破上限
- **ADR-Data-Engineering-Schema-Migration-Approval** — 数据处理域破坏性 Schema 变更必须经人工审批，自动评估下游影响
- **ADR-User-Operations-Frequency-Cap-Mandatory** — 用户运营域所有消息触达必须执行频次上限，防止通知疲劳
- **ADR-Domain-Latency-Tier-Classification** — 每个域必须声明延迟层级（超低延迟/实时/准实时/批处理），平台据此分配资源和调度策略
- **ADR-Healthcare-Physician-Review-Mandatory** — 医疗健康域所有诊疗建议必须经执业医师审核后才能呈现给患者，Agent 只提供"医疗信息"而非"医疗意见"
- **ADR-Content-Moderation-CSAM-Immediate-Report** — 内容审核域检测到 CSAM 内容必须在 1 分钟内上报至指定机构，零容忍零延迟
- **ADR-HR-Bias-Audit-Mandatory** — 人力资源域招聘/晋升决策必须通过偏见审计（Adverse Impact Ratio ≥ 0.8），禁止未经审计的自动化决策
- **ADR-Supply-Chain-Forecast-Approval-Before-Procurement** — 供应链域大额采购订单必须基于审批通过的需求预测，禁止 Agent 自行触发超阈值采购
- **ADR-Live-Streaming-Realtime-Moderation-SLA** — 在线直播域实时流审核延迟必须 < 2s，违规内容必须在检测后 5s 内执行下架/断流
- **ADR-Game-Publishing-Multi-Platform-Compliance** — 游戏上架域每个目标平台必须独立通过合规检查（年龄分级/内容审核/支付合规），禁止跨平台复用审核结果
- **ADR-Customer-Service-Escalation-Timeout** — 客户服务域 Agent 无法在 3 轮对话内解决问题必须自动转接人工坐席，禁止无限循环
- **ADR-IT-Operations-Blast-Radius-Limit** — IT 运维域自动修复操作爆炸半径限制为单节点/单服务，跨域操作必须人工审批
- **ADR-Education-Minor-Data-Protection** — 教育培训域涉及未成年人数据必须遵循 COPPA/未成年人保护法，数据收集最小化且需监护人同意
- **ADR-Creative-Production-IP-Verification** — 广告素材制作域所有 AI 生成内容必须通过版权/商标侵权检查，禁止使用未授权素材
- **ADR-Game-Dev-IP-Similarity-Check** — 游戏开发域 AI 生成美术资产必须通过已知 IP 相似度检测，防止版权侵权
- **ADR-Marketing-Brand-Consistency-Check** — 市场营销域所有对外发布内容必须通过品牌调性一致性检查和广告法合规检测

---

# 35. 推荐代码目录

```text
src/
  apps/                # 应用级入口与聚合
  benchmarks/          # 基准测试与性能实验
  core/                # 通用运行时抽象/兼容层
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
      oapeflir/          # OAPEFLIR 语义框架与投影适配（canonical path）
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

    oapeflir/           # deprecated re-export barrel（若存在，仅转发到 orchestration/oapeflir）
      index.ts

    harness/            # Harness Runtime（唯一可执行运行时）
      runtime/            # HarnessRuntime 主入口
      protocol/           # Harness 契约（HarnessRun/HarnessStep/HarnessDecision/PlanBundle/WorkProduct/EvaluationReport/FeedbackEnvelope）
      planner/            # Planner Agent 实现
      generator/          # Generator Agent 实现
      evaluator/          # Evaluator Agent 实现
      eval-harness/       # Evaluation Harness（预发布评测/版本对比/TaskOutcomeGrader）
      loop/               # HarnessLoopController
      context/            # ContextAssembler + ContextSnapshot
      memory-namespace/   # Working/Long-term/Shared Knowledge 三层记忆 + MemoryPromotionPolicy
      constraints/        # ConstraintEngine + ConstraintPack 装配
      guardrails/         # 五层 Guardrails（input/planning/tool/memory/output）
      toolbelt/           # ToolbeltAssembler + 工具可靠性画像
      tool-harness/       # Tool Capability Profile + 工具生命周期治理
      hitl-runtime/       # HITL Runtime（inspect/patch/override/takeover/resume）
      durable/            # Durable Harness（pause/resume/checkpoint strategy）
      async/              # Async Harness（create_run/poll/subscribe/intervene）
      recovery/           # Harness Recovery Controller
      graph/              # PlanGraph / GraphPatch / normalize / validate / risk / worst-path
      events/             # Event Registry / replay behavior / event schemas
      budget/             # Budget Ledger / reservation / consumption
      prompt/             # PromptExecutionContract
      llm/                # LLM decision record / recorded output refs
      side-effects/       # SideEffect Manager / delivery semantics
      decision/           # DecisionInputBundle / precedence policy
      memory/             # MemoryWriteGovernance
      evaluation/         # EvaluationGate / outcome grader
      learning/           # LearningCandidate / quarantine
      release/            # Learning release pipeline
      lineage/            # AttemptLineage / causal lineage query
      errors/             # Error Code Taxonomy
      observability/      # Metrics / traces / runtime dashboards
      tests/              # Runtime Test Matrix fixtures

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
      # 注：scheduler 在 interface/scheduler/ 下

    state-evidence/     # P5
      truth/
      events/
      projections/
      artifacts/
      memory/
      knowledge/
      audit/
      incident/        # (计划中)
      checkpoints/     # (计划中)
      dlq/             # (计划中)

    shared/             # X1 横切织网（观测、缓存、事件总线、可靠性）
    cost-management/    # 成本治理与预算护栏
    prompt-registry/    # Prompt 资源注册表兼容层
    stability/          # 稳定性/降级/容错策略

    model-gateway/      # LLM 抽象层
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt 管理
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # 合规与数据治理
      crypto-shredding/
      data-residency/  # (计划中)
      erasure/          # (计划中)
      encryption/       # (计划中)
      lineage/          # (计划中)

    contracts/          # 平面间契约
      request-envelope/
      control-directive/
      execution-plan/
      execution-receipt/
      state-command/
      delegation-request/
      model-request/

  domains/                # 业务域建模
    registry/             # DomainDescriptor 注册与生命周期
    risk-profile/         # DomainRiskProfile 领域风险画像
    knowledge-schema/     # DomainKnowledgeSchema 领域知识结构
    eval-framework/       # DomainEvalFramework 领域评估
    prompt-library/       # DomainPromptLibrary 领域 Prompt 库
    recipes/              # DomainRecipe 原型模板
    interaction-policy/   # DomainInteractionPolicy 跨域策略
    governance/           # DomainGovernancePolicy 领域治理
    coding/               # 代码研发域实例
    operations/           # 通用运营域实例（区别于 it-operations 的 SRE/DevOps 专项域）
    quant-trading/        # 量化交易域实例 (§71)
    ecommerce/            # 电商域实例 (§72)
    advertising/          # 广告推广域实例 (§73)
    financial-services/   # 金融服务域实例 (§74)
    data-engineering/     # 数据处理域实例 (§75)
    user-operations/      # 用户运营域实例 (§77)
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
    content-moderation/   # 内容审核与安全域实例 (§92)
    it-operations/        # IT 运维 SRE/DevOps 域实例 (§93)
    marketing/            # 市场营销与品牌域实例 (§94)
    agriculture/          # 孵化域：农业
    executive-assistant/  # 孵化域：高管助理
    facilities/           # 孵化域：设施/园区
    manufacturing/        # 孵化域：制造
    product-management/   # 孵化域：产品管理
    project-management/   # 孵化域：项目管理
    quality-assurance/    # 孵化域：质量保障
    business-pack/        # 元域：Business Pack 运行模型
    canonical-meta-model/ # 元域：规范化元模型
    roadmap/              # 路线图与落地编排

  interaction/            # 智能交互层
    nl-gateway/           # 自然语言任务入口
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
    ux/                   # 非技术用户体验
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
    compliance-engine/    # 分部门合规策略引擎
      policy-resolver/
      inheritance/
      audit-enforcer/
    knowledge-boundary/   # 知识域隔离与受控共享
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
    resource-manager/     # 资源竞争管理
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
    integration/          # 外部系统集成框架
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
    drift-detection/      # 行为漂移检测
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
    platform-ops-agent/   # 平台自运维 Agent
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

补充说明：

- `src/platform/harness/` 是唯一可执行运行时实现目录，承载 HarnessRun、PlanGraph、NodeRun、Budget、SideEffect、Replay 等生产语义。
- `src/platform/orchestration/oapeflir/` 是 OAPEFLIR 语义框架、StageRationale、TraceProjection 与审计视图的 canonical path。
- `src/platform/oapeflir/` 如存在，只能作为 deprecated re-export barrel 保留，新增实现不得写入该目录。
- `§71-§94` 仍表示 **24 个产品化垂直域** 的权威架构章节。
- `src/domains/` 中额外存在的目录属于孵化域、元域或平台性支撑目录，不要求与 `§71-§94` 一一对应。

---

# 36. 风险、约束与成功标准

## 36.1 主要风险

- 模型输出不稳定
- 工具副作用不可控
- 恢复链路不足导致自动化不可托底
- projection 偏差被误当真相
- 误学习导致行为漂移
- 多租户隔离不彻底
- Pack 模型不收敛导致平台被业务反侵入
- 预算失控
- replay / rebuild 误操作放大问题
- **PlanGraph 校验不足导致 deadlock、不可达 terminal 或缺失补偿路径**
- **Graph Scheduler 非确定性导致 replay 与线上执行不一致**
- **SideEffect ambiguous 被误判为成功导致外部状态漂移**
- **Budget reservation 缺失导致 retry / replan 放大成本**
- **RunVersionLock 缺失导致事故回放无法复现**
- **LearningCandidate 污染 holdout、PII 或 secret 后进入线上**
- **LLM provider 全面不可用导致平台瘫痪**
- **Prompt 变更引入行为回归**
- **LLM 成本失控（token 超支）**
- **Agent 委托链递归失控**
- **NL Intent 解析歧义导致错误任务创建**
- **目标分解递归过深导致任务爆炸**
- **主动式 Agent 无限触发形成风暴**
- **渐进式自主权误升级导致高风险动作失控**
- **组织架构变更同步延迟导致审批路由错误**
- **知识隔离配置错误导致跨部门数据泄漏**
- **治理权委托范围过大导致安全降级**
- **跨 Region 数据复制延迟导致一致性问题**
- **资源竞争管理失效导致高优先级任务饥饿**
- **Marketplace 恶意 Pack 通过认证后造成安全事件**
- **解释管线 LLM 调用成本失控（频繁 forensic-level 解释）**
- **紧急制动误触导致全平台无故停机**
- **Agent 复合版本灰度测试覆盖不足导致组合缺陷逃逸**
- **EdgeRuntime 离线状态积累大量 side effect，连接恢复时冲突爆炸**
- **行为漂移检测误报导致 Agent 频繁降级影响业务**
- **多模态内容安全检查漏判导致违规内容输出**
- **量化交易域 Agent 下错单导致灾难性财务损失（乌龙指）**
- **金融服务域 AML 漏检导致巨额监管罚款**
- **法务域 Agent 输出被当作法律意见使用（非授权执业风险）**
- **电商域定价 Agent 设置极端低价在法律上构成约束力**
- **学术调研域引用捏造构成学术欺诈**
- **财务域错误记账导致财报错报和审计失败**
- **企业知识库域权限泄露导致机密文档被非授权用户检索**
- **广告推广域竞价错误导致预算在低质流量上耗尽**
- **医疗健康域 Agent 输出被当作诊疗意见使用导致误诊/延误治疗（生命安全风险）**
- **内容审核域漏检 CSAM 等违法内容导致刑事责任和平台关停**
- **人力资源域招聘 Agent 算法偏见导致系统性歧视和法律诉讼**
- **在线直播域违规内容未及时下架导致监管处罚和社会舆论事件**
- **供应链域需求预测严重偏差导致大规模库存积压或断货**
- **IT 运维域自动修复操作扩散导致级联故障（爆炸半径失控）**
- **客户服务域 Agent 提供错误信息或承诺导致企业法律和经济风险**
- **教育培训域涉未成年人数据泄露导致 COPPA/未成年人保护法违规**
- **游戏开发域 AI 生成资产侵犯已有 IP 版权导致法律纠纷**
- **游戏上架域年龄分级错误导致未成年人接触不当内容**
- **市场营销域品牌危机公关失当导致企业声誉不可逆损害**

## 36.2 硬约束

- Runtime 只消费发布态定义
- Projection 不反写真相
- Learn 不直接驱动线上变更
- Secret 不进入 Memory / Knowledge / 对外 Artifact
- 所有外呼经过 egress control
- 所有 side effect 都必须对象化记录
- 高风险动作必须审批或显式 deny
- CAS + Lease + Fencing 为写回硬约束
- 平面间通信必须通过正式契约对象
- **所有 LLM 调用必须通过 ModelGateway**
- **Prompt 变更必须通过质量门禁**
- **LLM 成本必须按 tenant 计量**
- **Agent 委托深度 ≤ 3**
- **PII 数据删除通过 crypto-shredding 实现**
- **NL 输入必须经过 Intent 解析生成 RequestEnvelope(§5.3)，禁止原始文本直传**
- **目标分解递归深度 ≤ 5**
- **主动式 Agent 必须绑定 TriggerPolicy**
- **自主权等级默认单调递增；降级仅限 §42.2 安全触发条件，执行后须人工审批确认**
- **所有资源归属必须关联 OrgNode**
- **合规策略沿组织树向下继承，子节点只能收紧**
- **知识域默认隔离，跨部门共享需显式授权**
- **SSO 为唯一身份来源**
- **每个 tenant 必须指定 Home Region**
- **Marketplace Pack 必须通过认证后才能上架**
- **外部系统集成必须通过统一 Connector 框架**
- **OAPEFLIR 每个阶段必须生成 StageRationale**
- **PlatformPanicDirective 同 Region < 5s、跨 Region < 15s 停止全平台**
- **Agent 发布和回滚以 AgentVersion（复合快照）为单位**
- **EdgeRuntime 离线模式 risk_level ≤ medium**
- **每个 Agent 必须维护 BehaviorFingerprint**
- **多模态输出必须经过内容安全检查**
- **PlatformOps Agent 默认只读，生产写操作需人工审批**
- **量化交易域必须有盘前风控检查和硬性仓位/损失限额**
- **金融服务域所有不利信贷决策必须可解释且可人工复查**
- **法务域所有 Agent 输出必须经执业律师审核后才能外发**
- **财务域必须执行职责分离（创建人≠审批人）**
- **电商域价格变动超阈值必须人工审批**
- **学术调研域引用必须可解析到真实论文（零捏造容忍）**
- **企业知识库域必须镜像源系统文档级权限**
- **医疗健康域所有诊疗建议必须经执业医师审核，Agent 不得替代医嘱**
- **内容审核域 CSAM 检测后 1 分钟内必须上报，零容忍零延迟**
- **人力资源域招聘/晋升决策必须通过偏见审计（AIR ≥ 0.8）**
- **在线直播域违规内容检测后 5s 内必须执行下架/断流**
- **供应链域超阈值采购订单必须基于审批通过的需求预测**
- **IT 运维域自动修复爆炸半径限制为单节点/单服务**
- **客户服务域 3 轮未解决必须转接人工坐席**
- **教育培训域涉未成年人数据需监护人同意且最小化收集**
- **游戏上架域每个目标平台必须独立通过合规检查**
- **广告素材域 AI 生成内容必须通过版权/商标侵权检查**
- **市场营销域对外内容必须通过品牌调性一致性检查和广告法合规检测**
- **复杂任务 Plan 必须是 PlanGraph，不允许线性 steps 直接执行**
- **PlanGraph 必须经过 Normalize / Validate / Risk Propagation / Worst-Path Analysis**
- **Graph Scheduler 决策必须可 Trace Replay**
- **所有 HarnessRun / NodeRun 状态迁移必须 Event-driven**
- **终态 HarnessRun / NodeRun 不得迁出**
- **Retry / Redrive 必须追加 AttemptLineage，不得覆盖旧记录**
- **LLM / Tool / SideEffect / Evaluation 前必须 reserve budget**
- **SideEffect ambiguous 不得自动视为成功**
- **不可逆副作用必须支持 confirmation / reconciliation / manual review**
- **Replay 不得产生真实副作用**
- **DecisionInputBundle 必须冻结后才能裁决**
- **Planner / Generator / Evaluator 必须使用独立 ContextAssemblyContract**
- **Prompt / Policy / Tool / Domain 改进不得绕过 EvaluationGate 直接上线**

## 36.3 成功标准

### Phase 1 成功标准

- workflow_run 可稳定创建和推进
- lease 超时自动 reclaim
- CAS 冲突被正确拒绝

### Phase 2 成功标准

- OAPEFLIR 主链端到端跑通
- worker 崩溃后 30s 内恢复
- 高风险动作可被审批阻断

### Phase 3 成功标准

- incident / replay / repair / DLQ 可运营
- 外部依赖熔断→降级→恢复自动化
- projection 可重建且数据一致

### Phase 4 成功标准

- 50 并发 workflow 稳定运行
- Load test 符合 SLO
- 容灾演练 RTO < 10min

### Phase 5 成功标准

- 非技术用户可通过自然语言创建和管理任务
- 目标分解引擎自动将业务目标拆解为可执行任务图
- 主动式 Agent 按 TriggerPolicy 自动触发且无风暴
- 渐进式自主权 Level 0→3 升级路径端到端验证
- 组织架构三级层次（公司→部门→团队）正确驱动审批路由
- SSO/SCIM 自动同步用户且停用账户 < 5min 生效
- 知识域隔离零泄漏，受控共享审计完整

### Phase 6 成功标准

- 双 Region 单 leader / follower read 部署，受控 failover 演练通过，单 Region 故障 RTO < 5min
- active-active 仅用于非 truth 的缓存、遥测或聚合统计
- 1000 并发 workflow 下高优先级任务不饥饿
- SLA Tier P0 任务 99.9% 在承诺时间内完成
- Marketplace 至少 20 个认证 Pack 上架
- 用户反馈→改进闭环 < 7 天
- 预构建 Connector 覆盖 P0 类别全部系统

### Phase 7 成功标准

- 用户可对任意 workflow step 查询解释，L1 延迟 < 2s，L3 延迟 < 10s
- 紧急制动演练：同 Region 全平台停止 < 5s，恢复 < 30min
- AgentVersion 复合灰度发布端到端验证（canary→active 自动晋升）
- EdgeRuntime 在断网 24h 后恢复连接，数据同步零丢失
- 行为漂移检测在 Agent 行为分布偏移 > 2σ 时 100% 触发告警
- 成本优化建议节省率 ≥ 20%（对比未优化基线）
- 合规报告 SOC2 Type II 全自动生成，控制点覆盖率 ≥ 95%
- 容量预测 30 天准确度 ≥ 85%
- 多模态：图片分析 + 语音转文字端到端可用
- PlatformOps Agent L1 成熟度验证：自动诊断报告生成 < 5min

### Phase 8 成功标准

- Harness Runtime 端到端可运行：ConstraintPack 加载 + Planner→Generator→Evaluator 闭环 + HarnessDecision 裁决
- HarnessRun / HarnessStep 全部字段持久化且可查询
- Durable Harness 5 种 pauseReason 全部有测试覆盖
- HITL Runtime 5 种介入模式（inspect/patch/override/takeover/resume）可用
- Async Harness 休眠/唤醒端到端验证
- Evaluation Harness 沙箱评测 + 版本对比报告可生成
- Guardrails 五层均有拦截测试覆盖
- Harness Replay 可完整回放已完成 run
- 十条不变量自动化检查通过（违反即 CI 失败）
- Tool Harness Capability Profile 覆盖所有已注册工具
- Phase 8d 验收：HarnessRun / NodeRun 状态机、PlanGraph、Event Registry、Budget Ledger、SideEffect Reconciliation、EvaluationGate、Runtime Test Matrix 均有自动化覆盖
- Replay 验证不产生真实 side effect，且 Trace Replay 可重建 scheduler decision

### Phase 9 成功标准

- 24 个垂直业务域全部达到 GA 状态（通过 §38 四阶段门禁）
- 12 种 DomainRecipe 原型模板全部有至少一个域实例验证通过
- Critical 风险域（量化交易/金融服务/财务/法务/医疗健康）HITL 覆盖率 100%
- 跨域交互矩阵 24×24 验证通过，无未授权数据流
- 每个域的 eval 所有质量轴达到各自 acceptance_threshold
- 量化交易域超低延迟路径 < 10ms（不含 LLM 调用）
- 法务域所有输出 100% 经执业律师审核后才可外发
- 学术调研域引用准确率 100%（零捏造）
- 医疗健康域所有诊疗建议 100% 经执业医师审核
- 内容审核域 CSAM 上报 100% 在 1 分钟内完成
- 人力资源域招聘流程偏见审计全部通过（AIR ≥ 0.8）
- IT 运维域自动修复 MTTR 降低 ≥ 30%
- 客户服务域首次解决率 ≥ 70%

---

# Part XI — 结论与附录

---

# 70. 结论

这不是"一个会自动做事的 Agent 平台"，而是：

> **一个把 Agent 当作高风险自动化单元进行严格控制、隔离、恢复、审计和治理的企业操作系统——从一人公司到万人企业，以十层架构覆盖基础设施、AI 运营、业务域接入、垂直业务域深化、智能交互、Harness 工程化、Harness 八支柱深化、组织治理、规模化生态、运营成熟度的全栈能力。**

它的核心不是"多智能"，而是：

- 默认保守
- 高风险必须受控
- 异常必须分类处理
- 执行必须可恢复
- 状态必须可回放
- 行为必须可审计
- 平台必须可降级
- 业务必须可插拔但不可绕过底座
- **业务域必须被结构化理解，而非视为不透明黑盒**
- **非技术用户必须能直接使用，无需理解底层架构**
- **组织治理必须适配企业层级，而非假设扁平结构**
- **规模化运行必须有资源公平调度和 SLA 差异化保障**
- **Agent 决策必须可解释，行为漂移必须可检测**
- **平台必须能紧急制动，Agent 必须有统一生命周期**
- **离线/边缘场景必须可运行，断网不等于停摆**
- **多模态输入输出必须纳入统一安全管控，不可绕过内容审查**
- **Agent 能力必须工程化——一次性模型调用必须升级为受约束、可执行、可记忆、可反馈、可恢复、可评测、可介入、可观测的 Harness 八支柱闭环系统**
- **OAPEFLIR 必须可落地为 Harness 语义约束与审计投影——复杂任务的认知阶段、阶段理由、风险传播、对账解释和学习发布治理必须能由 HarnessRun / PlanGraph / Event Registry 派生，而不是形成第二套执行运行时**
- **业务域必须以统一元模型描述(§37.11)——12 问模板确保 24 域结构一致、配置驱动、新域可模板化接入**
- **多 Agent 协作必须遵循强制协议(§19.5)——权限不扩大、风险不提升、约束不绕过、审计不断链**
- **实施必须分环推进——生存环保底、可用环试点、扩张环规模化，避免面面俱到导致无一落地**

### 十层架构总览

| 层次                  | 解决问题                    | 核心章节                | 文档分篇  |
| --------------------- | --------------------------- | ----------------------- | --------- |
| 基础设施层            | 平台怎么搭                  | §4-§14, §24-§32         | Part I    |
| AI 运营层             | AI 怎么运营                 | §15-§23                 | Part II   |
| 业务域接入层          | 业务怎么接                  | §37-§38                 | Part III  |
| **垂直业务域深化层**  | **24 个垂直域怎么落地深化** | **§71-§94**             | Part IV   |
| 智能交互层            | 用户怎么用                  | §39-§44                 | Part V    |
| Harness 工程化层      | 能力怎么收口                | §45.1-45.12, §58.1-58.5 | Part VI   |
| Harness 八支柱深化层  | 能力怎么深化                | §45.13-45.21, §58.6     | Part VI   |
| 组织治理层            | 组织怎么管                  | §46-§51                 | Part VII  |
| 规模化运行层 + 生态层 | 规模怎么扛 + 生态怎么建     | §52-§57                 | Part VIII |
| 运营成熟度层          | 怎么用好 + 怎么安全运行     | §59-§69                 | Part IX   |

### Harness 八支柱能力总结

| 问题                     | 改进前                                                | 当前                                                                |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Harness 定义模型？       | 五元组（Constraints+Tools+Context+Feedback+Recovery） | 八支柱（+Durability+Evaluation Harness+HITL Runtime+Observability） |
| 运行和步骤有一级契约吗？ | 仅 HarnessRunRequest                                  | §45.13 HarnessRun/HarnessStep 完整生命周期                          |
| 裁决有统一协议吗？       | LoopController 五种输出                               | §58.6 HarnessDecision 六种裁决标准化                                |
| 离线评测能力？           | 仅运行时 Evaluator                                    | §45.14 Evaluation Harness（预发布+版本对比+outcome 断言）           |
| 长时任务怎么暂停恢复？   | Recovery Controller 故障恢复                          | §45.15 Durable Harness（5 种 pauseReason + 4 种 resumeStrategy）    |
| 记忆怎么分层治理？       | HarnessContext 四类上下文                             | §45.16 Memory Namespace（Working/Long-term/Shared + 晋升策略）      |
| 工具怎么被治理？         | ToolbeltAssembler 装配                                | §45.17 Tool Harness（Capability Profile + 生命周期 + 信任度）       |
| 人机协作是什么级别？     | escalate 到 §21 HITL                                  | §45.18 HITL Runtime（inspect/patch/override/takeover/resume）       |
| 异步任务怎么管理？       | 无显式异步模式                                        | §45.19 Async Harness（create/poll/subscribe/intervene）             |
| 护栏在哪里执行？         | 隐含在 ConstraintPack                                 | §45.20 Guardrails 五层（input/planning/tool/memory/output）         |
| 有底线规则吗？           | 分散在各 ADR                                          | §45.21 十条不变量                                                   |
| OAPEFLIR 是否可执行？    | 受控认知流程                                          | §13/§14/§25/§28/§45/§58 的 v4.4 可执行 Runtime Contract             |
| 副作用状态不确定怎么办？ | 工具成功即视为完成                                    | SideEffect Manager + Reconciliation + Compensation，不把 ambiguous 当 success |

只有同时具备**基础设施层的稳定性**、**AI 运营层的可控性**、**业务域接入层的结构化**、**垂直业务域深化层的领域专精**、**智能交互层的易用性**、**Harness 工程化层的标准化**、**Harness 八支柱的深化**、**组织治理层的适配性**、**规模化运行层的可扩展性**和**运营成熟度层的可投产性**，企业才能把 Agent 平台从架构设计，升级为真正覆盖一人公司到万人企业、24 个垂直业务线的企业级生产力操作系统。

---

# 附录 G：术语表与缩写索引

| 缩写/术语                | 全称                                                       | 说明                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAPEFLIR                 | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release | Agent 核心循环的八个阶段(§13)                                                                                                                       |
| PlanGraph                | Harness Plan Graph                                         | HarnessRun plannerOutput 的图结构计划模型，也是 OAPEFLIR Plan 阶段投影视图，替代复杂任务中的线性 steps(§13.7)                                      |
| Graph Scheduler          | Deterministic Graph Scheduler                              | 基于 ready node 的确定性图调度器，调度决策写事件并可 Trace Replay(§14.9)                                                                            |
| GraphPatch               | PlanGraph Patch                                            | 对运行中或暂停中 PlanGraph 的受控追加式变更(§13.13)                                                                                                  |
| Event Registry           | Platform + OAPEFLIR Event Registry                         | platform.* 与 oapeflir.* 事件类型、payload、replay 行为和 projection 消费规则注册表(§28)                                                            |
| AttemptLineage           | Attempt Lineage                                            | retry / redrive 的追加式执行谱系(§14.14)                                                                                                             |
| Budget Ledger            | Runtime Budget Ledger                                      | 预算预留、消耗、释放和耗尽的运行账本(§25.9)                                                                                                          |
| SideEffect Delivery Semantics | SideEffect Delivery Semantics                        | 副作用 at-most-once / at-least-once / effectively-once 与确认/对账语义(§14.11)                                                                       |
| Reconciliation           | Reconciliation State Machine                               | 外部副作用状态不确定时的对账机制(§14.12)                                                                                                             |
| ContextAssemblyContract  | Context Assembly Contract                                  | 面向 Planner / Generator / Evaluator 的上下文装配契约(§45.23)                                                                                        |
| PromptExecutionContract  | Prompt Execution Contract                                  | Prompt 角色、版本、上下文 taint、输出 schema 的执行契约(§45.24)                                                                                      |
| DecisionInputBundle      | Decision Input Bundle                                      | DecisionEngine 冻结后的统一裁决输入(§45.25)                                                                                                          |
| HumanResponsibilityRecord | Human Responsibility Record                               | 人工审批、覆盖、接管后的责任边界记录(§45.27)                                                                                                         |
| EvaluationGate           | Evaluation Gate                                            | 发布前质量、成本、安全、回归门禁(§45.14, §58.10)                                                                                                     |
| LearningCandidate        | Learning Candidate                                         | Learn 阶段产生的候选经验对象，需隔离、评测、审批后才能上线(§13.14)                                                                                   |
| HITL                     | Human-In-The-Loop                                          | 人机协作模式，人工参与 Agent 决策链(§21)                                                                                                            |
| DLQ                      | Dead Letter Queue                                          | 死信队列，无法处理的消息/事件的暂存区(§28.8)                                                                                                        |
| CAS                      | Compare-And-Swap                                           | 乐观并发控制原语，用于 StateCommand 幂等写入(§5.4)                                                                                                  |
| SLO / SLA                | Service Level Objective / Agreement                        | 服务水平目标/协议(§27, §54)                                                                                                                         |
| SEV1-4                   | Severity 1-4                                               | 事件严重等级（1 最高）(§12)                                                                                                                         |
| TTFT                     | Time To First Token                                        | LLM 流式响应中首 token 到达延迟(§27.7)                                                                                                              |
| SCC                      | Standard Contractual Clauses                               | GDPR 标准合同条款，跨境数据传输法律机制(§52.4)                                                                                                      |
| BCR                      | Binding Corporate Rules                                    | 约束性企业规则，集团内跨境数据传输机制(§52.4)                                                                                                       |
| DPIA                     | Data Protection Impact Assessment                          | 数据保护影响评估(§52.4)                                                                                                                             |
| PIPL                     | Personal Information Protection Law                        | 中国个人信息保护法(§52)                                                                                                                             |
| WCAG                     | Web Content Accessibility Guidelines                       | 无障碍访问指南(§44.6)                                                                                                                               |
| SCIM                     | System for Cross-domain Identity Management                | 跨域身份管理协议(§48)                                                                                                                               |
| SSO                      | Single Sign-On                                             | 单点登录(§48)                                                                                                                                       |
| RBAC                     | Role-Based Access Control                                  | 基于角色的访问控制(§11)                                                                                                                             |
| DAG                      | Directed Acyclic Graph                                     | 有向无环图，用于目标分解和任务依赖(§40)                                                                                                             |
| Pack                     | Business Pack                                              | 业务域功能包，Agent 的可部署单元(§30)                                                                                                               |
| UoW                      | Unit of Work                                               | 工作单元，事务性操作的原子边界                                                                                                                      |
| WAL                      | Write-Ahead Log                                            | 预写日志，保障崩溃恢复的持久化机制(§31)                                                                                                             |
| P1-P5                    | Plane 1-5                                                  | 五平面架构（Interface·Control·Orchestration·Execution·State & Evidence）(§4)                                                                        |
| X1                       | Cross-cutting Fabric                                       | 横切关注面（Reliability·Governance·Intelligence）(§4)                                                                                               |
| NL                       | Natural Language                                           | 自然语言(§39)                                                                                                                                       |
| sLLM                     | Small LLM                                                  | 小型本地化语言模型，用于边缘/离线场景(§62)                                                                                                          |
| RTO / RPO                | Recovery Time / Point Objective                            | 恢复时间/点目标(§31)                                                                                                                                |
| Harness                  | Agent Harness Runtime                                      | 八支柱运行时（约束·工具·状态/记忆·反馈·持久执行·评测·人机协作·可观测）(§45)                                                                         |
| PlanBundle               | Planner Agent 标准化输出                                   | 包含 goal/taskGraph/budget/riskProfile/successCriteria(§45.8)                                                                                       |
| WorkProduct              | Generator Agent 标准化输出                                 | 包含 stepId/artifacts/observations/telemetry(§45.9)                                                                                                 |
| EvaluationReport         | Evaluator Agent 标准化输出                                 | 包含 passed/score/issues/recommendation/confidence(§45.10)                                                                                          |
| FeedbackEnvelope         | 统一反馈信封                                               | 四段反馈闭环（Step/Task/Workflow/System 级）的标准化输出(§45.6)                                                                                     |
| ConstraintPack           | 任务级约束包                                               | 每次 HarnessRun 携带的显式约束信封(§45.3)                                                                                                           |
| Toolbelt                 | 任务级工具集                                               | 按最小权限原则装配的工具子集(§45.4)                                                                                                                 |
| HarnessRun               | Harness 运行实体                                           | 一次完整 Harness 任务运行的一级实体，含生命周期和审计(§45.13)                                                                                       |
| HarnessStep              | Harness 步骤实体                                           | 单个执行步骤契约，含 phase/role/inputs/outputs/rationale(§45.13)                                                                                    |
| HarnessDecision          | Harness 统一裁决                                           | 六种裁决：accept/retry/replan/escalate/downgrade/abort(§58.6)                                                                                       |
| Evaluation Harness       | 统一评测运行时                                             | 运行时裁决+预发布评测+版本对比的评测系统(§45.14)                                                                                                    |
| Durable Harness          | 持久执行支柱                                               | checkpoint/pause/resume 作为 Harness 基础能力(§45.15)                                                                                               |
| Memory Namespace         | 记忆命名空间                                               | Working/Long-term/Shared Knowledge 三层隔离与晋升(§45.16)                                                                                           |
| Tool Harness             | 工具治理层                                                 | 工具 Capability Profile + 生命周期 + 信任度治理(§45.17)                                                                                             |
| HITL Runtime             | 人机协作运行时                                             | inspect/patch/override/takeover/resume 五类能力(§45.18)                                                                                             |
| Async Harness            | 异步运行模式                                               | 多小时/多轮/多审批的异步 Harness 执行模式(§45.19)                                                                                                   |
| Guardrails               | 分层护栏                                                   | input/planning/tool/memory/output 五层动态检查点(§45.20)                                                                                            |
| DomainRecipe             | 领域模板原型                                               | 十二种原型（CRUD-heavy/Analytics/Creative/Realtime/Trading/Compliance/Research/Adversarial/Moderation/Logistics/Conversational/IncidentOps）(§37.7) |
| Trading Archetype        | 交易原型                                                   | 信号→风控→执行→结算工作流模式(§37.7, §71, §74)                                                                                                      |
| Compliance Archetype     | 合规原型                                                   | 监控→检测→评估→报告工作流模式(§37.7, §74, §81, §82)                                                                                                 |
| Research Archetype       | 研究原型                                                   | 收集→分析→综合→发表工作流模式(§37.7, §78, §79)                                                                                                      |
| Adversarial Archetype    | 对抗原型                                                   | 攻击面→防御→审计→修复工作流模式(§37.7, §76, §82)                                                                                                    |
| FTO                      | Freedom-to-Operate                                         | 自由实施检索，知识产权领域术语(§82)                                                                                                                 |
| SAR/STR                  | Suspicious Activity/Transaction Report                     | 可疑活动/交易报告，反洗钱法规要求(§74)                                                                                                              |
| PSI                      | Population Stability Index                                 | 模型稳定性指数，金融服务模型监控指标(§74)                                                                                                           |
| VaR/CVaR                 | Value at Risk / Conditional VaR                            | 风险价值/条件风险价值，量化交易风控指标(§71)                                                                                                        |
| ROAS                     | Return on Ad Spend                                         | 广告投资回报率(§73)                                                                                                                                 |
| MRR                      | Mean Reciprocal Rank                                       | 平均倒数排名，搜索质量指标(§80)                                                                                                                     |
| NDCG                     | Normalized Discounted Cumulative Gain                      | 归一化折损累积增益，搜索排名指标(§80)                                                                                                               |
| Moderation Archetype     | 审核原型                                                   | 内容摄入→多模态检测→处置→申诉工作流模式(§37.7, §83, §92)                                                                                            |
| Logistics Archetype      | 物流原型                                                   | 预测→优化→调度→追踪→异常处理工作流模式(§37.7, §86, §88)                                                                                             |
| Conversational Archetype | 对话原型                                                   | 意图识别→知识检索→回答→反馈工作流模式(§37.7, §89, §90, §91)                                                                                         |
| IncidentOps Archetype    | 事件运维原型                                               | 告警→诊断→修复→复盘→预防工作流模式(§37.7, §93)                                                                                                      |
| CSAM                     | Child Sexual Abuse Material                                | 儿童性虐待材料，内容审核领域法定强制上报内容(§92)                                                                                                   |
| AIR                      | Adverse Impact Ratio                                       | 不利影响比率，HR 招聘公平性指标，合规要求 ≥ 0.8(§87)                                                                                                |
| MTTR                     | Mean Time To Repair/Resolve                                | 平均修复时间，IT 运维核心效率指标(§93)                                                                                                              |
| MTTD                     | Mean Time To Detect                                        | 平均检测时间，IT 运维告警效率指标(§93)                                                                                                              |
| FCR                      | First Contact Resolution                                   | 首次联系解决率，客服核心质量指标(§91)                                                                                                               |
| AHT                      | Average Handle Time                                        | 平均处理时长，客服效率指标(§91)                                                                                                                     |
| COPPA                    | Children's Online Privacy Protection Act                   | 美国儿童在线隐私保护法(§90)                                                                                                                         |
| SOV                      | Share of Voice                                             | 品牌声量份额，市场营销效果指标(§94)                                                                                                                 |
| CDM                      | Canonical Domain Meta-Model                                | 统一领域元模型，24 域使用同一 12 问模板描述(§37.11)                                                                                                 |
| ACP                      | Agent Collaboration Protocol                               | 多 Agent 协作协议，定义 8 种消息类型 + 7 条不可违反规则(§19.5)                                                                                      |
| 三环实施法               | Three-Ring Implementation Priority                         | 生存环→可用环→扩张环分层实施优先级(Part X 前言)                                                                                                     |

---

# 附录 H：OAPEFLIR v4.4 Executable Spec 与 v4.1 收敛规则

完整规范以 [oapeflir-v4.4-executable-spec.md](docs_zh/architecture/oapeflir-v4.4-executable-spec.md) 为运行契约输入来源，本文档 v4.1 在正文中承载 OAPEFLIR-Harness 收敛后的架构级规范和落地约束。

冲突裁决顺序：

1. Executable Spec
2. Contract Schema
3. ADR
4. Core Architecture（本文档）
5. Domain Spec
6. Example / Appendix

结构性冲突按上述顺序裁决；安全、风险、合规与数据保护类冲突在不改变权威对象归属的前提下，以更严格者为准。

## H.1 正文落点

| v4.4 能力 | 主文档落点 |
| --- | --- |
| 八阶段职责、PlanGraph、GraphPatch、风险传播、最坏路径分析 | §13 |
| Graph Scheduler、NodeRun、SideEffect、Reconciliation、Compensation、AttemptLineage | §14 |
| HarnessRun / NodeRun 状态一致性、Budget Ledger、RunVersionLock | §25 |
| Event Registry、Replay Semantics、Projection、Incident、DLQ | §28 |
| ContextAssemblyContract、PromptExecutionContract、DecisionInputBundle、Memory Governance、HITL Responsibility | §45 |
| Error Code Taxonomy、Runtime Test Matrix | §58 |
| Phase 8d、ADR、代码目录、硬约束、成功标准 | §33-§36 |

## H.2 v4.4 完整规范章节索引

| 规范章节 | 主题 |
| --- | --- |
| 0-3 | 核心结论、设计目标、八阶段、总体运行架构 |
| 4-5 | HarnessRun 收敛后的 RunStatus 投影、NodeRun 状态机 |
| 6-13 | PlanGraph、Graph Normalization、Validation、Risk Propagation、Worst-Path、Scheduler、GraphPatch |
| 14-17 | Event Registry、Budget Ledger、SideEffect Manager、Reconciliation State Machine |
| 18-24 | Context Assembly、Prompt Execution、LLM Decision Record、Tool Output Taint、Memory Governance、Guardrails、Decision Engine |
| 25-30 | Runtime Mode、HITL、Final Output、Causal Lineage、Run Version Lock、Effective Policy Snapshot |
| 31-33 | Learning Candidate、Evaluation Harness、Release 管线 |
| 34-38 | Error Code Taxonomy、Observability Metrics、Incident Rules、Capability Matrix、Runtime Test Matrix |
| 39-42 | 实现目录、最小落地路线、ADR、最终判断 |

## H.3 不可降级条款

以下条款不可降级；其中 Run 权威对象按 v4.1 收敛为 HarnessRun：

1. 复杂任务 Plan 必须是 PlanGraph。
2. Graph Scheduler 决策必须可 Trace Replay。
3. HarnessRun / NodeRun 终态不可迁出。
4. Event append 与 truth update 必须同事务。
5. SideEffect ambiguous 不得视为 success。
6. Trace Replay 不得重新调用 LLM / Tool；任何 Replay 不得产生真实 side effect。
7. LearningCandidate 不得直接上线。
8. LLM-as-Judge 不得覆盖确定性失败。

---

# 附录 A：版本变更历史

| 版本 | 日期       | 变更内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0 | 2026-04    | 初始五平面架构 + 稳定性七层 + OAPEFLIR 概念设计                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v1.1 | 2026-04    | 增加风险矩阵、DLQ 模型、部署建议                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v1.2 | 2026-04    | 增加数据模型 44 表、事件命名空间、ADR 建议、推荐目录                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.0 | 2026-04-18 | **基础设施改善版**：新增平面间通信契约(§5)、API 契约(§6)、服务通信(§7)、可扩展性(§8)、配置治理(§24)、性能 SLO(§27)、容灾高可用(§31)；改善风险评分(§10)、OAPEFLIR 接口(§13)、存储抽象(§26)、部署(§32)、路线图(§33)；解决 v1.2 的 14 项设计缺陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.1 | 2026-04-19 | **AI 运营完备版**：新增 LLM Provider 抽象与故障切换(§15)、Prompt 管理与版本化(§16)、模型评估与质量门禁(§17)、成本管理与 Token 计量(§18)、Agent 间委托与协作(§19)、长时任务与 Workflow 休眠(§20)、人机协作模式(§21)、SDK 与开发者体验(§22)、合规与数据治理(§23)；改善 API 认证与 Webhook(§6)、安全威胁模型(§11)、告警路由与分布式 Tracing(§12)、Error Budget 与 LLM 延迟(§27)、Pack 生命周期与 Plugin 治理(§30)；新增 9 个 ADR；解决 v2.0 的 14 项 AI 运营层缺陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v2.2 | 2026-04-19 | **业务域接入完备版**：新增业务域建模与接入架构(§37)——DomainDescriptor 结构化领域建模、DomainRiskProfile 领域风险画像、DomainKnowledgeSchema 领域知识结构、DomainEvalFramework 领域评估框架、DomainPromptLibrary 领域 Prompt 库、DomainRecipe 领域模板原型、DomainInteractionPolicy 跨域交互策略、DomainGovernancePolicy 领域治理模型；新增业务域接入 Runbook(§38)——四阶段门禁流程（建模→开发→认证→灰度）；改善 Business Pack 模型(§30)关联 DomainDescriptor；新增 4 个 ADR；解决 v2.1 的 10 项业务域接入层缺陷                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.3 | 2026-04-19 | **智能交互完备版**：新增自然语言任务入口架构(§39)、目标分解引擎架构(§40)、主动式 Agent 框架(§41)、渐进式自主权模型(§42)、统一运营看板架构(§43)、非技术用户体验架构(§44)；新增 6 个 ADR；使平台从"Agent 基础设施"升级为面向非技术用户的"Agent 操作系统"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| v2.4 | 2026-04-19 | **组织治理完备版**：新增组织层次模型(§46)、组织架构审批路由(§47)、企业 SSO/SCIM 集成(§48)、分部门合规策略引擎(§49)、知识域隔离与受控共享(§50)、分级治理委托(§51)；新增 6 个 ADR；使平台能适配从一人公司到万人企业的组织复杂度                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2.5 | 2026-04-19 | **规模化生态完备版**：新增多 Region 部署架构(§52)、规模化资源竞争管理(§53)、SLA 分级保障(§54)、Agent 市场与生态(§55)、反馈驱动持续改进管线(§56)、外部系统集成框架(§57)；新增 6 个 ADR；补齐跨 Region 高可用、资源公平调度、SLA 差异化保障、开放生态和持续自我改进能力                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v2.6 | 2026-04-19 | **运营成熟度完备版**：新增 Agent 可解释性与决策透明度(§59)、紧急制动与全局熔断(§60)、Agent 统一生命周期管理(§61)、离线与边缘部署(§62)、Agent 行为漂移检测(§63)、成本归因与优化引擎(§64)、工作流可视化调试器(§65)、合规报告自动生成引擎(§66)、容量规划与成本预测(§67)、多模态能力(§68)、平台自运维 Agent(§69)；新增 11 个 ADR；补齐从"架构设计完整"到"可投产运营"的运营成熟度层                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| v2.7 | 2026-04-19 | **质量修正版**：修复 ADR 自主权等级矛盾（monotonic→guarded progression）；统一 §9.5/§14.8 模式枚举为 8 模式规范集；补全 ExecutionPlan/StateCommand 缺失的 principal/trace_id 字段；扩展 Prompt 注入防御架构(§16.5)；修复 ADR-NL TaskSpec→RequestEnvelope 引用；补全 §26 数据模型（44→71 表）和 §28 事件命名空间（17→25）；补全 §33 路线图 Phase 5-7；补全 §43 L2/L3 看板视图定义；新增 §39.7 i18n、§44.6 WCAG、§52.4 GDPR 跨境传输、§55.4-55.6 市场收益/废弃/依赖管理、§15.6 流式错误处理；新增 §40 循环依赖检测、§5.2 P2→P4 通信路径；修复 §62 typo 和 §70 结论遗漏；新增附录 G 术语表                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v2.8 | 2026-04-21 | **Harness 工程化版**：新增 Harness Runtime 架构(§45)——HarnessRuntime 统一入口、ConstraintPack 任务级约束信封、ToolbeltAssembler 动态工具装配、HarnessContext 统一上下文与 token 预算、FeedbackEnvelope 四段反馈闭环、HarnessLoopController 统一闭环控制、Planner/Generator/Evaluator 三类 Agent 角色标准化、Recovery Controller 故障恢复；新增 Harness 横切关注面(§58)——Harness 级可观测性、Prompt 分层治理、Failure-to-Learning 管线、Replay/Simulation 能力、架构遗留问题收口（§21/§47 审批边界、§23/§49 合规边界、§31/§52 HA 映射、§32/§8/§33 阶段对照、统一错误分类、§42/§61 自主权关联）；新增 §13.5 OAPEFLIR→Harness 外部语义映射；新增 7 个 ADR；补全 §25.6 一致性模型与保证级别、§25.7 Schema 迁移策略；修复 §5.4 P5 通信完整性规则、§7.2 通信拓扑图、§8.4 S4 阶段 TODO、§19.2 全局调用深度上限、§20.4 超长审批续期机制、§42.3 信任分衰减机制、§60.3 Admin 不可用降级方案；更新 §33 路线图新增 Phase 8 + 并行依赖图；更新 §35 代码目录新增 harness/；更新附录 G 术语表新增 9 项 Harness 术语                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2.9 | 2026-04-21 | **Harness 八支柱深化版**：Harness 从五元组升级为八支柱模型（Constraints·Tools·State/Memory·Feedback·Durability·Evaluation Harness·HITL Runtime·Observability/Replay），融合 Anthropic 角色化闭环、LangGraph 持久运行时、OpenAI 治理与 Guardrails 原语三大行业流派；新增 §45.13 HarnessRun/HarnessStep 统一运行契约、§45.14 Evaluation Harness 统一评测运行时（预发布评测+版本对比+outcome 断言）、§45.15 Durable Harness 持久执行支柱（5 种 pauseReason+4 种 resumeStrategy）、§45.16 Memory Namespace 三层记忆命名空间（Working/Long-term/Shared Knowledge+晋升策略）、§45.17 Tool Harness 工具治理（Capability Profile+生命周期+信任度）、§45.18 HITL Runtime 人机协作运行时（inspect/patch/override/takeover/resume）、§45.19 Async Harness 异步运行模式、§45.20 Guardrails 五层架构（input/planning/tool/memory/output）、§45.21 十条不变量；新增 §58.6 HarnessDecision 统一裁决协议（六种裁决标准化）；更新 §45.1 核心公理升级八支柱+行业映射表、§45.2 总体架构图增加新组件；更新 §33 路线图 Phase 8 拆分为 8a/8b/8c 三阶段（20 周）；新增 9 个 ADR（共 81 个）；更新 §35 代码目录新增 7 个 harness 子目录；更新 §70 结论升级九层架构；更新附录 G 术语表新增 11 项 Harness 术语                                                                                                                                                                                                                                                                           |
| v3.0 | 2026-04-22 | **垂直业务域深化版**：新增 12 个垂直业务域架构章节(§71-§82)——量化交易·电商·广告推广·金融服务·数据处理·代码开发·用户运营·行业调研·学术调研·企业知识库·财务·法务；DomainRecipe 从 4 种原型扩展为 8 种（新增 Trading/Compliance/Research/Adversarial）；§37.1 问题陈述表扩展为 12 域×8 维度全景对比；§37.4/§37.5 知识和评估表扩展覆盖 12 域代表场景；§33 路线图新增 Phase 9（垂直业务域深化落地，3 批×8 周=24 周）含 Phase 依赖图更新；§34 新增 12 个域专属 ADR（共 93 个）；§35 代码目录新增 11 个域实例目录；§36 新增 8 项域专属风险和 7 项域专属硬约束；§38 接入 Runbook 三个 Gate 增加垂直域专项检查清单；§70 结论从九层架构升级为十层架构（新增垂直业务域深化层）；附录 G 新增 13 项域专属术语                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v3.1 | 2026-04-22 | **24 域全覆盖版**：新增 12 个垂直业务域架构章节(§83-§94)——在线直播·广告素材制作·游戏开发·游戏上架·人力资源·供应链与物流·医疗健康·教育培训·客户服务·内容审核与安全·IT运维SRE/DevOps·市场营销与品牌；DomainRecipe 从 8 种原型扩展为 12 种（新增 Moderation/Logistics/Conversational/IncidentOps）；§37.1 问题陈述表扩展为 24 域×8 维度全景对比（4 张表）；§33 路线图 Phase 9 从 3 批扩展为 6 批（9a-9f，总计 48 周）含依赖图更新；§34 新增 12 个域专属 ADR（共 105 个）；§35 代码目录新增 12 个域实例目录；§36 新增 11 项域专属风险和 11 项域专属硬约束；§36.3 Phase 9 成功标准扩展至 24 域；§38 接入 Runbook 三个 Gate 扩展 Critical/High 风险域检查清单；§70 结论 12→24 垂直域；附录 G 新增 13 项域专属术语（4 种新原型 + CSAM/AIR/MTTR/MTTD/FCR/AHT/COPPA/SOV/SOV）；**结构重组**：全文按十层架构重排为 Part I-XI 分篇结构——基础设施层(§4-§14,§24-§32)整合为 Part I，§58 Harness横切合并到 §45 之后(Part VI)，§71-§94 垂直域移至 §38 之后(Part IV)，§33-§36 落地汇总移至 Part X，§70 结论移至全文末尾(Part XI)；章节编号保持稳定以兼容历史引用                                                                                                                                                                                                                                                                                                                                                                                                                |
| v3.2 | 2026-04-22 | **架构深化版**：新增统一领域元模型(§37.11)——Canonical Domain Meta-Model 定义 12 问标准模板，24 域填充矩阵（Q1-Q6 + Q7-Q12 两张表），使新域接入模板化、平台内核配置驱动、看板/审批/评测统一生成；新增多 Agent 协作协议(§19.5)——Agent Collaboration Protocol 定义 8 种消息类型（task_request/task_offer/task_accept/task_reject/partial_result/escalation_request/completion_report/takeover_notice）、9 个强制字段、7 条不可违反规则（权限不扩大/风险不提升/约束不绕过/输出可复核/接管必审计/预算不超支/深度不超限），将 §19.1-19.4 委托模型从约定升级为强制协议；新增三环实施优先级（Part X 前言）——第一环平台生存环（P1-P5+ConstraintPack+HarnessRun+Risk/Audit+Lease/Recovery+Panic/Incident+ModelGateway，对应 Phase 1-2+8a，约 16 周）、第二环平台可用环（NL入口+GoalDecomposition+HITL+AsyncHarness+Dashboard+Org/SSO+DomainDescriptor+元模型+协作协议，对应 Phase 3-5+8b/8c，约 24 周）、第三环平台扩张环（Marketplace+MultiRegion+Edge+CostOptimizer+BehaviorDrift+ComplianceReporter+24 DomainPacks，对应 Phase 6-9，约 40+ 周）；更新 §70 结论新增 3 条核心原则（元模型统一·协作协议强制·分环实施）；**Review 修正**：§38 接入 Runbook 新增元模型步骤和门禁项(§37.11)、§45 Harness Runtime 新增协作协议关联(§19.5)、§33 Phase 5 交付物新增元模型+协作协议、§33 依赖 Phase 8b→8c 修正、§36.3 补全 Phase 8 成功标准、§34 域 ADR 标签 12→24+补全游戏开发域 ADR(共 105)、§36.1 补全游戏开发域风险(共 11 项)、§82 法务域 12→24 域修正、三环 Phase 映射修正 |
| v3.3 | 2026-04-22 | **域章节深化版**：24 个垂直业务域章节(§71-§94)从 ~28 行模板扩展至 ~65 行，每域新增 5 个子节：Agent 工作流（详细）——每个 Agent 的完整多步骤流程；关键工具/集成——按类别列出具体产品和 API；数据敏感度分级——按机密等级划分数据类型；性能/延迟预算——逐操作 SLA 指标；常见故障与恢复——5 行故障模式×恢复策略表。内容源自 v3.0-domain-research.md 调研数据，总计新增 ~895 行                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v4.0 | 2026-04-27 | **OAPEFLIR v4.4 可执行运行规范集成版**：将 OAPEFLIR 从"受控认知内核"升级为"可执行 Runtime Spec"。新增 PlanGraph 作为 ExecutionPlan 的内部结构；引入 Graph Normalization、Graph Validation、Graph Risk Propagation、Worst-Path Analysis、Deterministic Graph Scheduler、GraphPatch；新增 Run / Node 状态机终态封闭规则、AttemptLineage、Event Registry、Event Replay Semantics、Budget Ledger、SideEffect Delivery Semantics、Reconciliation State Machine、ContextAssemblyContract、PromptExecutionContract、DecisionInputBundle、HITL Responsibility Record、Memory Write Governance、LearningCandidate、EvaluationGate、Runtime Test Matrix；补齐 Phase 8d 三环映射、PlanBundle/PlanGraphBundle 兼容语义、platform.* 与 oapeflir.* 事件兼容层、v4.0 Runtime 表落点、LLM-as-Judge 不可覆盖失败；更新 §5、§13、§14、§17、§25、§26、§28、§45、§58、§33、§34、§35、§36、§70 与附录 G/H。 |
| v4.1 | 2026-04-27 | **OAPEFLIR-Harness 收敛版 + 最小生产闭环版**：明确 HarnessRuntime 是唯一可执行运行时、HarnessRun 是唯一权威 Run，OAPEFLIR 仅作为 StageRationale / TraceProjection / Audit View；将 Replay 收敛为默认 Trace Replay 与隔离 Re-execution Replay；补强 Budget atomic reservation、SideEffect revoked/expired 与 commit 前重校验、Panic ack / resume 规则、TrustScore 不降低 inherent risk、热路径确定性执行、多 Region 单 leader 写入、SLA 默认 99.95 上限、全局调用深度 8；更新 §5、§10、§14、§18、§19、§28、§31、§37、§42、§45、§52、§54、§58、§60、§33-§36 与附录 H。 |
