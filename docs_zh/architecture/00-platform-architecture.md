# 《企业级 Agent 平台总体技术架构设计文档》

> **文档版本**：v2.7
> **文档状态**：Release
> **前序版本**：v2.6 Release Candidate
> **文档定位**：企业级 / 平台级 Agent System 总体技术架构设计文档（稳定性优先 · AI 运营完备 · 业务域接入完备 · 智能交互完备 · 组织治理完备 · 规模化生态完备 · 运营成熟度完备 · 落地导向版）
> **适用对象**：架构委员会、平台研发团队、Runtime 团队、SRE、安全团队、治理团队、业务域接入团队、AI/ML 工程团队、业务线负责人、非技术业务操作者、组织管理层、合规/审计团队、生态合作伙伴、边缘/现场运维团队
> **设计目标**：构建一套以稳定性、风险控制、安全可靠、异常处理为第一原则的企业级 Agent 平台，使 Agent 作为高风险自动化单元在企业环境中可控、可恢复、可审计地长期运行；同时具备完整的 AI 运营能力（LLM 抽象、Prompt 治理、模型质量、成本管控），确保平台在 AI 层面同样可控、可演进；提供结构化的业务域建模与接入框架；构建面向非技术用户的智能交互层；建立完整的组织治理体系和规模化运行生态层；**并补齐运营成熟度层——Agent 可解释性、紧急制动、统一生命周期管理、离线/边缘部署、行为漂移检测、成本归因优化、可视化调试、合规报告自动生成、容量规划、多模态能力、平台自运维 Agent——使平台从架构设计走向真正可投产的企业级操作系统**

## v2.1 升级说明

### v2.0 回顾

v2.0 在 v1.2 基础上解决了 14 项设计缺陷：新增平面间通信契约(§5)、API 契约(§6)、服务通信(§7)、可扩展性(§8)、配置治理(§24)、性能 SLO(§27)、容灾(§31)；改善风险评分(§10)、OAPEFLIR 接口(§13)、存储抽象(§26)、部署(§32)、路线图(§33)。

### v2.1 改善重点

v2.0 在基础设施层（稳定性、风险、状态、恢复）已远超行业平均。但作为**企业级 AI Agent 平台**，在 AI 运营层和开发者体验上存在关键缺口：

| 缺陷 | 影响 | v2.1 改善 |
|------|------|----------|
| 无 LLM Provider 抽象 | 单 provider 故障 = 全平台不可用，无 failover | 新增 §15 LLM Provider 抽象与故障切换 |
| 无 Prompt 管理与版本化 | Agent 核心"源代码"不可控、不可回滚、不可 A/B | 新增 §16 Prompt 管理与版本化 |
| 无模型评估与质量门禁 | 坏 prompt/model 推上线无防护 | 新增 §17 模型评估与质量门禁 |
| 无成本管理与 Token 计量 | LLM 成本主导 OPEX 但无按 tenant 计量和预算强制 | 新增 §18 成本管理与 Token 计量 |
| 无 Agent 间委托协议 | 复杂任务需多 Agent 协作但无委托语义 | 新增 §19 Agent 间委托与协作 |
| 无长时任务架构 | 小时/天级 workflow 无休眠/唤醒/持久定时器 | 新增 §20 长时任务与 Workflow 休眠 |
| HITL 仅有基础审批门 | 缺多方审批、委托、迭代反馈、超时策略 | 新增 §21 人机协作模式 |
| 无 SDK / 开发者体验 | 业务团队无 Pack 开发工具链，无法接入 | 新增 §22 SDK 与开发者体验 |
| 无合规架构 | GDPR right-to-erasure 与 append-only 冲突，无数据驻留 | 新增 §23 合规与数据治理 |
| §6 API 设计不完整 | 缺 OAuth 流程、分页、Pack 管理端点、Webhook 投递保证 | 改善 §6 补充完整 |
| §11 安全缺威胁模型 | 无 STRIDE 分析、静态加密、Sandbox 技术规格 | 改善 §11 补充威胁模型 |
| §12 缺告警路由 | Incident 产生但无路由到人的架构 | 改善 §12 补充告警路由与分布式 Tracing |
| §27 SLO 缺 Error Budget | 无 burn-rate 告警、无 LLM 延迟拆解 | 改善 §27 补充 Error Budget |
| §30 Pack 缺生命周期 | 仅有 Manifest，缺开发→认证→发布→废弃全链路 | 改善 §30 补充生命周期与 Plugin 治理 |

## v2.2 升级说明

### v2.1 回顾

v2.1 在基础设施层和 AI 运营层已形成完整闭环：LLM Provider 抽象(§15)、Prompt 管理(§16)、模型评估(§17)、成本管理(§18)、Agent 委托(§19)、长时任务(§20)、人机协作(§21)、SDK/DX(§22)、合规(§23)。

### v2.2 改善重点

v2.1 解决了"平台怎么搭"和"AI 怎么运营"，但**没有回答核心问题：平台搭好了怎么承接企业内部的多元业务？**

企业内部 12+ 垂直业务线（代码研发、素材制作、广告投放、用户运营、游戏开发、直播带货、企业知识库、财务、HR、客服、安全运维、数据分析）在风险等级、知识结构、工具生态、评估标准、Prompt 策略上差异巨大。当前的 Business Pack(§30) 仅定义了平坦的 Manifest，将业务域视为不透明"包"——**缺乏结构化的领域建模框架，无法让平台真正理解、约束、优化不同业务域的 Agent 行为**。

| 缺陷 | 影响 | v2.2 改善 |
|------|------|----------|
| 无业务域抽象模型 | 平台无法区分"财务审批"与"素材生成"的领域特征 | 新增 §37 DomainDescriptor 结构化领域建模 |
| 无领域风险画像 | 所有业务共用同一 risk_matrix，无法差异化风控 | §37.3 DomainRiskProfile 领域级风险覆写 |
| 无领域知识 Schema | 不同业务的知识检索策略、时效性、冲突解决无法表达 | §37.4 DomainKnowledgeSchema |
| 无领域评估框架 | 代码正确性 vs 广告 ROI vs 内容合规——无法统一又差异化 | §37.5 DomainEvalFramework |
| 无领域 Prompt 库 | 业务 Prompt 散落各处，无复用无治理 | §37.6 DomainPromptLibrary |
| 无领域模板/Recipe | 类似业务(HR/客服)重复造轮子 | §37.7 DomainRecipe 四种原型模板 |
| 无跨域交互策略 | 多业务域 Agent 协作无边界、无补偿 | §37.8 DomainInteractionPolicy |
| 无领域治理模型 | 业务域 ownership、SLO、预算无归属 | §37.9 DomainGovernancePolicy |
| 无标准化接入流程 | 新业务接入靠口头沟通，无 checklist | 新增 §38 四阶段接入 Runbook |
| §30 仅 Manifest 无领域语义 | Pack 不理解自己属于什么业务域 | 改善 §30 关联 DomainDescriptor |

## v2.3 升级说明

### v2.2 回顾

v2.2 补齐了业务域接入层：DomainDescriptor 结构化领域建模(§37)、四阶段接入 Runbook(§38)、领域风险画像 / 知识结构 / 评估框架 / Prompt 库 / 模板原型 / 跨域策略 / 治理模型。

### v2.3 改善重点

v2.0-v2.2 解决了**"平台怎么搭"（基础设施）→"AI 怎么运营"（AI 运营）→"业务怎么接"（业务域建模）**三层问题。但这三层全部面向**平台工程师和技术团队**设计——真正的业务使用者（非技术操作者、业务线负责人、甚至一人公司的独立运营者）**无法直接使用平台**。

v2.2 差距分析识别出 42 项缺口，其中最致命的 6 项集中在**智能交互层**：

| 缺陷 | 影响 | v2.3 改善 |
|------|------|----------|
| 无自然语言任务入口 | 用户必须手写 JSON/API 创建任务 | 新增 §39 自然语言任务入口架构 |
| 无目标分解引擎 | 用户必须手动将业务目标拆解为单域任务 | 新增 §40 目标分解引擎架构 |
| 无主动式 Agent | Agent 只能被动等待 API 调用，不能自主运行 | 新增 §41 主动式 Agent 框架 |
| 无渐进式自主权 | automation_level 静态配置，Agent 永远不能"赢得信任" | 新增 §42 渐进式自主权模型 |
| 无统一运营看板 | 只有基础设施级 metrics，无"一切是否正常"业务视图 | 新增 §43 统一运营看板架构 |
| 无非技术用户 UX | 仅 SDK+CLI，非开发者无法使用 | 新增 §44 非技术用户体验架构 |

**v2.3 的核心定位**：在 v2.0-v2.2 构建的三层基座之上，叠加**面向最终用户的智能交互层**，使平台从"Agent 基础设施"升级为"Agent 操作系统"。

```text
v2.3  ┌─────────────────────────────────────────────┐
      │  智能交互层（用户侧操作系统）                    │  ← v2.3 新增
      │  NL 入口 · 目标分解 · 主动 Agent · 自主权 · 看板  │
      ├─────────────────────────────────────────────┤
v2.2  │  业务域接入层                                  │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI 运营层                                     │
      │  LLM 抽象 · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  基础设施层                                    │
      │  五平面 · 稳定性 · 风险 · 安全 · 恢复 · 审计      │
      └─────────────────────────────────────────────┘
```

## v2.4 升级说明

### v2.3 回顾

v2.3 补齐了智能交互层：自然语言任务入口(§39)、目标分解引擎(§40)、主动式 Agent 框架(§41)、渐进式自主权模型(§42)、统一运营看板(§43)、非技术用户体验(§44)。

### v2.4 改善重点

v2.0-v2.3 从基础设施到智能交互层逐层搭建完毕，但**全部假设"组织是扁平的、治理是统一的"**——这在一人公司适用，在万人企业完全不成立。万人企业存在事业群→部门→团队的深层组织层次，不同层级有不同的审批链路、合规要求、知识可见性和治理自主权。

| 缺陷 | 影响 | v2.4 改善 |
|------|------|----------|
| 无组织层次模型 | 平台只有 tenant 概念，无法表达部门/团队层级 | 新增 §46 组织层次模型 |
| 无组织架构审批路由 | 审批链路硬编码，无法根据组织架构动态路由 | 新增 §47 组织架构审批路由 |
| 无 SSO/SCIM 集成 | 每个用户手动创建，无法与企业目录同步 | 新增 §48 企业 SSO/SCIM 集成 |
| 无分部门合规策略 | 所有部门共用同一合规规则，金融部门和创意部门无差异 | 新增 §49 分部门合规策略引擎 |
| 无知识域隔离 | 不同部门知识无边界，存在数据泄漏风险 | 新增 §50 知识域隔离与受控共享 |
| 无分级治理委托 | 平台管理员集中管控，无法将治理权委托给部门 | 新增 §51 分级治理委托 |

**v2.4 的核心定位**：在 v2.3 的智能交互层之上，叠加**组织治理层**，使平台能适配从一人公司到万人企业的组织复杂度。

```text
v2.4  ┌─────────────────────────────────────────────┐
      │  组织治理层                                    │  ← v2.4 新增
      │  组织层次 · 审批路由 · SSO · 合规 · 知识隔离 · 委托│
      ├─────────────────────────────────────────────┤
v2.3  │  智能交互层（用户侧操作系统）                    │
      │  NL 入口 · 目标分解 · 主动 Agent · 自主权 · 看板  │
      ├─────────────────────────────────────────────┤
v2.2  │  业务域接入层                                  │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI 运营层                                     │
      │  LLM 抽象 · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  基础设施层                                    │
      │  五平面 · 稳定性 · 风险 · 安全 · 恢复 · 审计      │
      └─────────────────────────────────────────────┘
```

## v2.5 升级说明

### v2.4 回顾

v2.4 补齐了组织治理层：组织层次模型(§46)、组织架构审批路由(§47)、企业 SSO/SCIM 集成(§48)、分部门合规策略引擎(§49)、知识域隔离与受控共享(§50)、分级治理委托(§51)。

### v2.5 改善重点

v2.0-v2.4 构建了**基础设施→AI 运营→业务域接入→智能交互→组织治理**五层完整架构，但这五层都假设"在单一数据中心、有限并发下运行"。当企业跨 Region 部署、千级并发 workflow、多业务线争抢资源时，需要**规模化运行保障**。同时平台从封闭系统走向开放生态，需要 Agent 市场、反馈驱动改进和外部系统集成框架。

| 缺陷 | 影响 | v2.5 改善 |
|------|------|----------|
| 无多 Region 部署 | 单数据中心故障 = 全平台不可用 | 新增 §52 多 Region 部署架构 |
| 无资源竞争管理 | 高优先级任务被低优先级任务阻塞 | 新增 §53 规模化资源竞争管理 |
| 无 SLA 分级保障 | 所有任务同等对待，无法差异化服务承诺 | 新增 §54 SLA 分级保障 |
| 无 Agent 市场 | 所有 Agent/Pack 内部开发，无法复用生态 | 新增 §55 Agent 市场与生态 |
| 无反馈驱动改进 | 用户反馈无闭环，平台无法自我优化 | 新增 §56 反馈驱动持续改进管线 |
| 无外部系统集成框架 | 每个外部系统集成各自为政，无统一模式 | 新增 §57 外部系统集成框架 |

**v2.5 的核心定位**：补齐**规模化运行层与生态层**，使平台具备跨 Region 高可用、资源公平调度、SLA 差异化保障、开放生态和持续自我改进能力。

```text
v2.5  ┌─────────────────────────────────────────────┐
      │  规模化运行层 + 生态层                          │  ← v2.5 新增
      │  多Region · 资源竞争 · SLA · 市场 · 反馈 · 集成  │
      ├─────────────────────────────────────────────┤
v2.4  │  组织治理层                                    │
      │  组织层次 · 审批路由 · SSO · 合规 · 知识隔离 · 委托│
      ├─────────────────────────────────────────────┤
v2.3  │  智能交互层（用户侧操作系统）                    │
      │  NL 入口 · 目标分解 · 主动 Agent · 自主权 · 看板  │
      ├─────────────────────────────────────────────┤
v2.2  │  业务域接入层                                  │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI 运营层                                     │
      │  LLM 抽象 · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  基础设施层                                    │
      │  五平面 · 稳定性 · 风险 · 安全 · 恢复 · 审计      │
      └─────────────────────────────────────────────┘
```

## v2.6 升级说明

### v2.5 回顾

v2.5 补齐了规模化运行与生态层：多 Region 部署(§52)、资源竞争管理(§53)、SLA 分级保障(§54)、Agent 市场(§55)、反馈驱动改进(§56)、外部系统集成(§57)。

### v2.6 改善重点

v2.0-v2.5 构建了从基础设施到生态的**六层完整架构**，但全部聚焦"建设层"——解决"怎么搭"的问题。对标真正可投产的企业级平台，缺少"运营成熟度层"——解决"怎么用好"和"怎么安全运行"的问题。

v2.5 差距分析识别出 20 项缺口，其中最致命的 11 项集中在**运营成熟度层**：

| 缺陷 | 影响 | v2.6 改善 |
|------|------|----------|
| 无决策可解释性 | 用户无法理解 Agent 决策原因，EU AI Act 合规缺口 | 新增 §59 Agent 可解释性与决策透明度 |
| 无紧急制动 | 安全事件时无法瞬时停止全平台 Agent | 新增 §60 紧急制动与全局熔断 |
| 无 Agent 统一实体 | Agent 是松散组件组合，无复合版本和生命周期管理 | 新增 §61 Agent 统一生命周期管理 |
| 无离线/边缘部署 | 工厂/门店/移动场景无法使用，排除整个行业垂直 | 新增 §62 离线与边缘部署架构 |
| 无行为漂移检测 | Agent 渐变行为逃逸质量阈值但本质已改变 | 新增 §63 Agent 行为漂移检测 |
| 无成本归因与优化 | 成本数据可看不可行动，无法指导优化 | 新增 §64 成本归因与优化引擎 |
| 无可视化调试 | Workflow 失败只能查原始日志，无调试体验 | 新增 §65 工作流可视化调试器 |
| 无合规报告自动生成 | 证据存在但无法自动组装为审计报告 | 新增 §66 合规报告自动生成引擎 |
| 无容量规划预测 | 无预测性扩容建议，扩容时机靠猜 | 新增 §67 容量规划与成本预测 |
| 无多模态能力 | ModelGateway 纯文本，无法处理图片/语音/文档 | 新增 §68 多模态能力架构 |
| 无平台自运维 | 所有运维依赖人工 SRE，一人公司无 SRE 团队 | 新增 §69 平台自运维 Agent |

**v2.6 的核心定位**：补齐**运营成熟度层**，使平台从"架构设计完整"升级为"可投产运营"。

```text
v2.6  ┌─────────────────────────────────────────────┐
      │  运营成熟度层                                  │  ← v2.6 新增
      │  可解释 · 紧急制动 · 生命周期 · 边缘 · 漂移检测  │
      │  成本优化 · 调试器 · 合规报告 · 容量 · 多模态    │
      ├─────────────────────────────────────────────┤
v2.5  │  规模化运行层 + 生态层                          │
      │  多Region · 资源竞争 · SLA · 市场 · 反馈 · 集成  │
      ├─────────────────────────────────────────────┤
v2.4  │  组织治理层                                    │
      │  组织层次 · 审批路由 · SSO · 合规 · 知识隔离 · 委托│
      ├─────────────────────────────────────────────┤
v2.3  │  智能交互层（用户侧操作系统）                    │
      │  NL 入口 · 目标分解 · 主动 Agent · 自主权 · 看板  │
      ├─────────────────────────────────────────────┤
v2.2  │  业务域接入层                                  │
      │  DomainDescriptor · Recipe · Runbook           │
      ├─────────────────────────────────────────────┤
v2.1  │  AI 运营层                                     │
      │  LLM 抽象 · Prompt · Eval · Cost · HITL · SDK  │
      ├─────────────────────────────────────────────┤
v2.0  │  基础设施层                                    │
      │  五平面 · 稳定性 · 风险 · 安全 · 恢复 · 审计      │
      └─────────────────────────────────────────────┘
```

---

# 目录

1. [文档概述](#1-文档概述)
2. [平台根假设与设计目标](#2-平台根假设与设计目标)
3. [平台定义与非目标](#3-平台定义与非目标)
4. [总体架构：五平面 + 一横切控制织网](#4-总体架构五平面--一横切控制织网)
5. [平面间通信契约](#5-平面间通信契约)
6. [API 契约与版本化架构](#6-api-契约与版本化架构)
7. [服务通信架构](#7-服务通信架构)
8. [可扩展性架构](#8-可扩展性架构)
9. [稳定性架构](#9-稳定性架构)
10. [风险控制架构](#10-风险控制架构)
11. [安全可靠架构](#11-安全可靠架构)
12. [异常事件处理架构](#12-异常事件处理架构)
13. [OAPEFLIR 受控认知内核](#13-oapeflir-受控认知内核)
14. [Runtime Execution Plane](#14-runtime-execution-plane)
15. [LLM Provider 抽象与故障切换架构](#15-llm-provider-抽象与故障切换架构)
16. [Prompt 管理与版本化架构](#16-prompt-管理与版本化架构)
17. [模型评估与质量门禁架构](#17-模型评估与质量门禁架构)
18. [成本管理与 Token 计量架构](#18-成本管理与-token-计量架构)
19. [Agent 间委托与协作架构](#19-agent-间委托与协作架构)
20. [长时任务与 Workflow 休眠架构](#20-长时任务与-workflow-休眠架构)
21. [人机协作模式架构](#21-人机协作模式架构)
22. [SDK 与开发者体验架构](#22-sdk-与开发者体验架构)
23. [合规与数据治理架构](#23-合规与数据治理架构)
24. [配置治理架构](#24-配置治理架构)
25. [数据与状态一致性架构](#25-数据与状态一致性架构)
26. [存储架构](#26-存储架构)
27. [性能架构与 SLO](#27-性能架构与-slo)
28. [Event / Projection / Incident / DLQ 模型](#28-event--projection--incident--dlq-模型)
29. [Knowledge / Memory / Artifact / Learning 边界](#29-knowledge--memory--artifact--learning-边界)
30. [业务接入约束与 Business Pack 模型](#30-业务接入约束与-business-pack-模型)
31. [容灾与高可用架构](#31-容灾与高可用架构)
32. [部署架构](#32-部署架构)
33. [分阶段落地路线](#33-分阶段落地路线)
34. [ADR 冻结建议](#34-adr-冻结建议)
35. [推荐代码目录](#35-推荐代码目录)
36. [风险、约束与成功标准](#36-风险约束与成功标准)
37. [业务域建模与接入架构](#37-业务域建模与接入架构)
38. [业务域接入 Runbook](#38-业务域接入-runbook)
39. [自然语言任务入口架构](#39-自然语言任务入口架构)
40. [目标分解引擎架构](#40-目标分解引擎架构)
41. [主动式 Agent 框架](#41-主动式-agent-框架)
42. [渐进式自主权模型](#42-渐进式自主权模型)
43. [统一运营看板架构](#43-统一运营看板架构)
44. [非技术用户体验架构](#44-非技术用户体验架构)
46. [组织层次模型](#46-组织层次模型)
47. [组织架构审批路由](#47-组织架构审批路由)
48. [企业 SSO/SCIM 集成架构](#48-企业-ssoscim-集成架构)
49. [分部门合规策略引擎](#49-分部门合规策略引擎)
50. [知识域隔离与受控共享](#50-知识域隔离与受控共享)
51. [分级治理委托](#51-分级治理委托)
52. [多 Region 部署架构](#52-多-region-部署架构)
53. [规模化资源竞争管理](#53-规模化资源竞争管理)
54. [SLA 分级保障](#54-sla-分级保障)
55. [Agent 市场与生态](#55-agent-市场与生态)
56. [反馈驱动持续改进管线](#56-反馈驱动持续改进管线)
57. [外部系统集成框架](#57-外部系统集成框架)
59. [Agent 可解释性与决策透明度架构](#59-agent-可解释性与决策透明度架构)
60. [紧急制动与全局熔断架构](#60-紧急制动与全局熔断架构)
61. [Agent 统一生命周期管理架构](#61-agent-统一生命周期管理架构)
62. [离线与边缘部署架构](#62-离线与边缘部署架构)
63. [Agent 行为漂移检测架构](#63-agent-行为漂移检测架构)
64. [成本归因与优化引擎](#64-成本归因与优化引擎)
65. [工作流可视化调试器架构](#65-工作流可视化调试器架构)
66. [合规报告自动生成引擎](#66-合规报告自动生成引擎)
67. [容量规划与成本预测引擎](#67-容量规划与成本预测引擎)
68. [多模态能力架构](#68-多模态能力架构)
69. [平台自运维 Agent 架构](#69-平台自运维-agent-架构)
70. [结论](#70-结论)
[附录 A：版本变更历史](#附录-a版本变更历史)

---

# 1. 文档概述

## 1.1 背景

企业对 Agent 的期望，已经从"问答系统"演进为"能接系统、能跑流程、能做执行、能被治理、能被审计、能持续演进"的智能自动化平台。

但大多数 Agent 系统在工程上仍存在明显短板：

* 默认相信模型输出
* 默认工具调用会成功
* 默认外部系统可用
* 默认 workflow 只要编排好就能跑
* 默认异常只需日志记录
* 默认上线后行为可接受

这些假设在企业生产环境中都不成立。

企业级 Agent 平台首先面对的不是"能力不够强"，而是"失控风险太高"。
因此，本版架构把以下问题前置为主设计对象：

* 系统如何在失败时不失控
* 高风险动作如何被识别并收敛
* 外部依赖异常时如何降级
* worker 崩溃后如何恢复
* side effect 如何被控制与追责
* 发布失败如何回滚
* projection 偏差如何重建
* 审批延迟时系统如何安全停住

## 1.2 文档目标

* 定义稳定性优先的企业级 Agent 平台总体架构
* 建立以"默认不可信、默认会失败"为前提的设计原则
* 将稳定性、风险、安全、异常处理提升为平台一级主架构
* 明确五平面 + 横切织网的系统结构，**并定义平面间的正式接口协议**
* 重构 Runtime 为可恢复、可降级、可审计的受控执行系统
* **给出可落地的渐进式演进路径**，而不是一步到位的理想态
* 为后续详细设计、Schema、ADR、实现分阶段落地提供基线

## 1.3 非目标

* 单个业务 Agent 的 prompt 细节
* 单个插件或 adapter 的接口实现说明
* UI 交互视觉稿
* 某个模型供应商专项接入实现
* 某个业务域完整领域模型
* 基础设施物理拓扑和采购方案

---

# 2. 平台根假设与设计目标

## 2.1 平台根假设

本平台默认假设以下情况都会发生：

* agent 会犯错
* 工具会失败
* 外部系统会超时
* worker 会崩溃
* 模型会产生错误输出
* 配置会配错
* 审批会延迟
* 事件会重复
* 投影会落后
* 发布会回滚

因此平台必须围绕一句话设计：

> **默认不可信，默认会失败，默认要可控、可恢复、可审计。**

## 2.2 平台设计宪法

### 默认不可信

* 模型输出不可信
* 插件不可信
* 外部依赖不可信
* 输入不可信
* 知识可能过期
* 学习结果可能带噪声

### 默认会失败

* 远程调用会超时
* worker 会丢心跳
* event fanout 会失败
* projection 会延迟
* rollout 会失败
* repair / replay 也可能失败

### 默认收敛

未被明确允许的动作默认进入保守路径：deny / degrade / require approval / supervised / no-write / no-external / manual-only。

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

---

# 3. 平台定义与非目标

## 3.1 平台定义

> 一套面向企业环境的、以稳定性优先为核心原则的受控自动化平台。
> 它把 Agent 视为高风险自动化单元，通过五个架构平面和一层横切控制织网，对其进行严格控制、隔离、恢复、审计和治理。

## 3.2 它不是什么

* **不是单个聊天机器人** — 聊天只是入口之一
* **不是纯 Workflow Engine** — Workflow 不解决治理、恢复、审批、审计
* **不是纯 Tool Calling 壳层** — 工具只是执行手段
* **不是 "Prompt + 模型 + 少量工具" 的薄应用** — 缺乏隔离、治理、恢复
* **不是 "自动化越多越好" 的系统** — 平台追求**受控自动化**

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

**v2.0 改善**：P1 必须暴露标准化的 API 契约（见 §6），所有进入平台的请求必须通过统一的 RequestEnvelope 封装，包含 trace_id、idempotency_key、principal、tenant_id。

## 4.3 P2 Control Plane

控制与治理层，是平台的治理外壳。

**包含**：policy engine / approval engine / rollout control / replay & repair control / incident control / tenant admin / audit export / config center / exception management

**职责**：定义与版本治理 · 审批与自治边界控制 · 风险与预算守卫 · 发布、灰度、回滚 · incident 升级与处置 · repair / replay / rebuild 的运维控制

**v2.0 改善**：P2 通过 ControlDirective 向 P3/P4 发送指令，而非直接操作底层状态。Directive 类型包括：ModeSwitchDirective / PauseDirective / RollbackDirective / QuotaAdjustDirective。

## 4.4 P3 Orchestration Plane

编排与决策层。

**包含**：OAPEFLIR loop / workflow orchestration / planning & replanning / step scheduler / routing & escalation

**职责**：决定做什么 · 决定下一步谁执行 · 决定何时暂停 · 决定何时转人工 · 决定何时重规划、降级、终止

**v2.0 改善**：P3 输出标准化的 ExecutionPlan（见 §13 接口契约），所有决策都必须可序列化、可审计、可重放。

## 4.5 P4 Execution Plane

统一执行层。

**包含**：scheduler / dispatcher / execution engine / worker pool / tool executor / plugin executor / adapter executor / browser executor / human wait executor / recovery workers

**职责**：真正执行动作 · 获取并维护 lease · 执行结果回写 · 提议与提交 side effect · 在故障时触发恢复动作

**v2.0 改善**：P4 必须通过 ExecutionReceipt 向 P3/P5 回报执行结果，Receipt 包含 status / duration / side_effects / evidence_refs / error_detail。

## 4.6 P5 State & Evidence Plane

状态与证据平面。

**包含**：truth tables / event log / artifact store / memory / knowledge / audit / projections / checkpoints / evidence bundles / incident records / DLQ records

**职责**：保存当前控制真相 · 保留历史变化轨迹 · 支撑恢复和回放 · 保留审计证据 · 支撑控制台查询

**v2.0 改善**：P5 通过统一的 Repository 接口对外暴露，上层不直接操作存储实现。Repository 接口支持多后端切换（见 §26）。

## 4.7 X1 Reliability & Security Fabric

横跨所有平面的生命支持系统。

**包含**：authn/authz / sandbox / secrets / egress control / quotas / circuit breakers / timeouts / retries / rate limits / health checks / anomaly detection / backpressure / DLQ / incident hooks

**定位**：这不是辅助能力，而是平台的基础生命支持系统。X1 的每个能力都以 middleware / interceptor / decorator 形式注入各平面，不作为独立服务部署。

---

# 5. 平面间通信契约

> v1.2 定义了五个平面，但未定义平面间的接口协议。v2.0 将平面间通信正式化。

## 5.1 设计原则

* 平面间只能通过**正式契约对象**通信，不能直接调用对方内部实现
* 每个契约对象都是**可序列化、可审计、可重放**的
* 同步调用使用 typed interface，异步通知使用 domain event

## 5.2 平面间契约矩阵

| 调用方 → 被调方 | 契约对象 | 通信方式 | 说明 |
|----------------|---------|---------|------|
| P1 → P2 | `RequestEnvelope` | 同步 | 所有请求先经 P2 做策略/准入检查 |
| P2 → P3 | `ControlDirective` | 同步/事件 | 模式切换、暂停、配额调整 |
| P3 → P4 | `ExecutionPlan` | 同步 | 编排层输出给执行层的标准执行计划 |
| P4 → P3 | `ExecutionReceipt` | 同步 | 执行结果回报给编排层 |
| P4 → P5 | `StateCommand` | 同步 | 写真相表、追加事件 |
| P3 → P5 | `EvidenceRecord` | 异步 | 决策证据写入 |
| P2 → P4 | `ControlDirective` | 同步 | 紧急制动/模式切换直达执行层（§4.3 提及，§60 紧急制动场景） |
| P5 → P2 | `ProjectionUpdate` | 事件 | Projection 变化通知控制面 |
| 任意 → X1 | middleware 注入 | 切面 | 不通过显式调用，通过装饰器/拦截器 |

## 5.3 核心契约对象定义

### RequestEnvelope

```typescript
interface RequestEnvelope {
  request_id: string;
  idempotency_key: string;
  trace_id: string;
  principal: Principal;
  tenant_id: string;
  timestamp: string;
  payload: unknown;
  metadata: Record<string, string>;
}
```

### ControlDirective

```typescript
interface ControlDirective {
  directive_id: string;
  type: "mode_switch" | "pause" | "resume" | "rollback" | "quota_adjust" | "kill";
  target_scope: { tenant_id?: string; workflow_id?: string; worker_id?: string };
  issued_by: Principal;
  reason: string;
  params: Record<string, unknown>;
  expires_at?: string;
}
```

### ExecutionPlan

```typescript
interface ExecutionPlan {
  plan_id: string;
  trace_id: string;
  principal: Principal;
  workflow_run_id: string;
  steps: PlannedStep[];
  fallback_strategy: "retry" | "replan" | "escalate" | "abort";
  approval_gates: string[];
  side_effect_expectations: SideEffectExpectation[];
  budget: { max_steps: number; max_duration_ms: number; max_cost: number };
  created_at: string;
}
```

### ExecutionReceipt

```typescript
interface ExecutionReceipt {
  receipt_id: string;
  plan_id: string;
  step_id: string;
  status: "succeeded" | "failed" | "timeout" | "cancelled" | "awaiting_approval";
  duration_ms: number;
  side_effects: SideEffectRecord[];
  evidence_refs: string[];
  error?: { code: string; message: string; retryable: boolean };
}
```

### StateCommand

```typescript
interface StateCommand {
  command_id: string;
  trace_id: string;
  principal: Principal;
  type: "update_truth" | "append_event" | "write_checkpoint" | "store_artifact";
  aggregate_id: string;
  expected_version: number;    // CAS
  fencing_token: string;
  payload: unknown;
}
```

## 5.4 契约遵守规则

1. **不可绕过**：P1 不可跳过 P2 直接调 P4
2. **不可反向**：P5 不可向 P4 发指令（只能被读/被写）
3. **必须签名**：每个契约对象必须包含 principal 和 trace_id
4. **必须幂等**：所有 StateCommand 必须基于 expected_version 做 CAS
5. **必须可重放**：所有契约对象必须可序列化为 JSON

---

# 6. API 契约与版本化架构

> v1.2 未定义平台对外 API。v2.0 将 API 作为一级架构关注点。

## 6.1 API 分层

| API 层 | 面向 | 协议 | 认证方式 |
|--------|------|------|---------|
| Public API | 业务系统、CI/CD | REST + WebSocket | API Key + JWT |
| Admin API | 运维人员、控制台 | REST | JWT + RBAC |
| Internal API | 平面间调用 | typed interface（进程内）或 gRPC（跨进程） | mTLS / service token |
| Plugin API | 插件 / adapter | IPC / sandbox boundary | capability token |

## 6.2 Public API 设计规范

* 资源命名使用 kebab-case 复数形式：`/api/v1/workflow-runs`
* 所有写操作必须携带 `Idempotency-Key` header
* 所有响应包含 `X-Request-Id` 和 `X-Trace-Id`
* 错误响应使用统一结构：

```typescript
interface ApiError {
  code: string;          // "APPROVAL_REQUIRED" | "LEASE_EXPIRED" | ...
  message: string;
  details?: unknown;
  retry_after_ms?: number;
  trace_id: string;
}
```

## 6.3 API 资源总览

| 资源 | 方法 | 说明 |
|------|------|------|
| `/api/v1/tasks` | POST / GET | 创建任务、查询任务列表 |
| `/api/v1/tasks/{id}` | GET / DELETE | 查询/取消单个任务 |
| `/api/v1/workflow-runs` | GET | 查询 workflow 运行列表 |
| `/api/v1/workflow-runs/{id}` | GET | 查询单次运行详情 |
| `/api/v1/workflow-runs/{id}/steps` | GET | 查询步骤列表 |
| `/api/v1/approvals` | GET | 待审批列表 |
| `/api/v1/approvals/{id}` | POST | 提交审批决策 |
| `/api/v1/incidents` | GET | Incident 列表 |
| `/api/v1/knowledge` | GET / POST | Knowledge 查询/写入 |
| `/api/v1/packs` | GET / POST | Pack 注册与查询 |
| `/api/v1/packs/{id}/versions` | GET / POST | Pack 版本管理 |
| `/api/v1/plugins` | GET / POST | Plugin 注册与查询 |
| `/api/v1/prompts` | GET | Prompt 版本查询 |
| `/api/v1/cost-reports` | GET | 成本报表查询 |
| `/api/v1/webhooks` | GET / POST / DELETE | Webhook 订阅管理 |
| `/api/v1/admin/workers` | GET | Worker 状态 |
| `/api/v1/admin/config` | GET / PUT | 配置管理 |
| `/api/v1/admin/rollouts` | GET / POST | Rollout 管理 |
| `/api/v1/admin/tenants` | GET / POST / PUT | Tenant 管理 |
| `/api/v1/admin/budgets` | GET / PUT | 预算配置 |
| `/ws/v1/stream` | WebSocket | 实时事件流 |

## 6.4 版本兼容策略

* API 版本通过 URL path 区分（`/api/v1/`, `/api/v2/`）
* 同一大版本内只做**向后兼容**变更（新增字段、新增端点）
* 破坏性变更必须升大版本，旧版本至少维护 6 个月
* Event schema 使用 `schema_version` 字段，consumer 按版本分派
* 内部 TypeScript interface 变更通过 Zod schema 做运行时校验

## 6.5 认证流程

**API Key + JWT 双模式**：

| 场景 | 认证方式 | 说明 |
|------|---------|------|
| 服务间调用 | API Key（Header: `X-API-Key`） | 长期有效，按 tenant 颁发 |
| 用户操作 | JWT（Header: `Authorization: Bearer`） | OAuth2 / OIDC 颁发，短期有效 |
| 控制台 | JWT + CSRF token | 浏览器安全防护 |
| Webhook 回调 | HMAC 签名验证 | `X-Signature-256` header |

**Token 生命周期**：access_token TTL = 15min, refresh_token TTL = 24h, API key 支持手动轮换。

## 6.6 分页与过滤

* 列表接口统一使用 cursor-based 分页：`?cursor=xxx&limit=20`
* 响应包含 `next_cursor`，为 null 时表示最后一页
* 过滤使用查询参数：`?status=running&tenant_id=xxx&created_after=2026-01-01`
* 排序：`?sort=created_at:desc`
* 单页最大 100 条

## 6.7 Webhook 投递保证

```typescript
interface WebhookSubscription {
  subscription_id: string;
  tenant_id: string;
  target_url: string;
  events: string[];
  secret: string;
  active: boolean;
  retry_policy: { max_retries: number; backoff_ms: number };
}
```

* 投递使用 at-least-once 语义（outbox pattern）
* 每次投递包含 `X-Webhook-Id`（幂等键）和 `X-Signature-256`（HMAC 签名）
* 目标返回 2xx 视为成功，否则按 retry_policy 重试
* 连续失败 > 50 次后自动禁用 subscription，通知 tenant 管理员

---

# 7. 服务通信架构

> v1.2 未定义服务间通信方式。v2.0 明确三种通信模式及适用场景。

## 7.1 三种通信模式

### 同步请求/响应

适用：P1→P2 准入检查、P3→P4 dispatch、P4→P5 truth write

要求：
* 必须设置 timeout（默认 5s，最大 30s）
* 必须有 fallback（降级 / reject / queue）
* 必须有 circuit breaker 保护

### 异步事件通知

适用：P4→P5 event append、P5→P2 projection update、P4→X1 incident hook

要求：
* 使用 outbox pattern 保证 at-least-once
* consumer 必须幂等（基于 event_id 去重）
* 失败事件进入 DLQ

### 流式推送

适用：P5→P1 实时事件流（WebSocket）、worker heartbeat

要求：
* 连接断开自动重连 + 从 last_event_id 恢复
* 服务端背压（buffer 满则丢弃低优先级事件）

## 7.2 通信拓扑

```text
P1 ──sync──> P2 ──sync/event──> P3 ──sync──> P4
                                              │
P5 <──sync── P4 ──event──> P5                 │
│                                              │
P5 ──event──> P2 (projection updates)          │
P5 ──stream──> P1 (WebSocket)                  │
                                              │
X1 ──middleware──> ALL PLANES                  │
```

## 7.3 Outbox Pattern 设计

所有需要保证送达的事件，采用 outbox pattern：

1. 业务操作和事件写入在**同一个数据库事务**中完成
2. 独立的 outbox poller 异步读取未发送事件
3. 发送成功后标记 sent
4. 发送失败超过阈值后转入 DLQ
5. Poller 本身通过 lease 保证单实例运行

## 7.4 进程内 vs 跨进程

| 阶段 | 通信方式 | 说明 |
|------|---------|------|
| Phase 1（单体） | 进程内 typed interface 调用 | 所有平面在同一进程 |
| Phase 2（初步拆分） | 进程内 + Redis pub/sub | event 通道异步化 |
| Phase 3（微服务化） | gRPC + event bus | 平面间独立部署 |

这保证了从单体到微服务的平滑演进，而不是一开始就要求 18 个服务。

---

# 8. 可扩展性架构

> v1.2 未涉及水平扩展。v2.0 定义从单节点到集群的扩展策略。

## 8.1 扩展维度

| 维度 | 扩展策略 | 触发条件 |
|------|---------|---------|
| Worker 并发 | 增加 worker 进程/容器 | 队列积压 > 阈值 |
| 存储容量 | SQLite → PostgreSQL → 分表/归档 | 数据量 > 阈值 |
| Event 吞吐 | Partition by tenant_id | Event rate > 单 poller 处理能力 |
| API 吞吐 | API Gateway 水平扩展 | QPS > 单实例上限 |
| Projection 延迟 | 增加 projector 实例 | Projection lag > SLO |

## 8.2 无状态化原则

* P1 / P3 / P4 设计为无状态，所有持久状态存 P5
* Worker 通过 lease 机制避免状态绑定
* Session 状态通过 checkpoint 持久化，而非内存保持
* 任何进程可以被杀死并在另一个节点恢复

## 8.3 分片策略

当单节点不够时，按以下维度分片：

* **dispatch queue**：按 tenant_id hash 分片
* **event outbox**：按 aggregate_type 分区
* **projection rebuild**：按 projection_name 并行
* **worker pool**：按 capability_class 分池（coding / operations / browser）

## 8.4 扩展阶段

| 阶段 | 架构 | 支撑规模 |
|------|------|---------|
| S1 单体 | 单进程 + SQLite | 10 并发 workflow, 5 worker |
| S2 多进程 | 主进程 + worker 进程 + Redis | 50 并发, 20 worker |
| S3 分布式 | 微服务 + PostgreSQL + event bus | 500 并发, 100 worker |
| S4 集群 | Kubernetes + PG 分片 + 多 AZ | 5000+ 并发 |

---

# 9. 稳定性架构

> 保留 v1.2 的七层模型。v2.0 增加每层的**自动化机制**和**触发规则**。

## 9.1 稳定性层 1：隔离

**隔离维度**：tenant · project · domain · worker pool · executor · adapter · browser session · plugin process

**设计要求**：coding 与 operations 分池 · 高风险 adapter 独立池 · browser executor 不和普通 tool executor 混跑 · 高风险 tenant 可专属资源池

**v2.0 自动化**：当某 tenant 的 failure rate > 30% 时，自动将该 tenant 隔离到独立 worker pool，不影响其他 tenant。

## 9.2 稳定性层 2：限流与背压

**限流点**：API ingress rate limit · per-tenant concurrency · per-workflow active · per-worker max concurrency · per-adapter QPS · per-tool burst · approval queue inflow

**背压策略**：queue delay → reject low priority → degrade to supervised → stop non-critical workflows → freeze rollout → restrict external calls

**v2.0 自动化**：背压策略按**梯度自动升级**：

```text
Level 0 (正常)     → queue_lag < 10s
Level 1 (预警)     → queue_lag 10-30s → 延迟低优先级
Level 2 (限流)     → queue_lag 30-60s → 拒绝低优先级 + supervised mode
Level 3 (保护)     → queue_lag > 60s  → 仅允许 critical workflow + manual_only
```

## 9.3 稳定性层 3：超时与重试

**三层超时**：step timeout · attempt timeout · tool/adapter timeout

**重试规则**：
* 仅 retryable failure 自动重试
* 仅幂等操作允许自动重试
* 退避策略：exponential backoff with jitter，base=1s, max=60s
* 重试用尽后进入显式 `retry_exhausted` 状态，触发 escalation

## 9.4 稳定性层 4：断路器

**断路器对象**：第三方 API · 外部 adapter · 模型 provider · 高失败率工具 · plugin runtime

**状态机**：closed → open（failure_rate > 50% in 60s window）→ half-open（30s 后小流量探测）→ closed

**v2.0 改善**：断路器状态变化必须发射 `circuit_breaker.state_changed` 事件，触发告警和 mode switching 评估。

## 9.5 稳定性层 5：降级模式

**正式模式**：full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

**v2.0 自动化**：模式切换通过 `ControlDirective` 发出，支持自动触发规则：

| 触发条件 | 自动切换到 |
|---------|-----------|
| worker pool unhealthy > 50% | supervised_auto |
| external adapter circuit open | no-external-call |
| security incident detected | incident-mode |
| rollout guardrail breach | no-rollout |
| approval backlog > 100 | manual_only（暂停新 workflow） |

## 9.6 稳定性层 6：恢复能力

**恢复组件**：lease reclaim · execution recovery · workflow recovery · replay · repair · projection rebuild · stuck-run sweeper

**v2.0 改善**：每个恢复组件必须有独立的 health check，并通过 `RecoveryReport` 向 Control Plane 汇报恢复成功率。

## 9.7 稳定性层 7：可观测性

**最少能力**：metrics · structured logs · traces · audit · event timeline · health snapshot

**v2.0 改善**：定义核心可观测性指标（见 §27 性能与 SLO）。

---

# 10. 风险控制架构

> 保留 v1.2 的四分法模型。v2.0 增加**风险评分算法**和**自动化风险控制引擎**。

## 10.1 风险模型四分法

* **R1 执行风险**：错误执行 · 重复执行 · 并发冲突 · stale write
* **R2 业务风险**：错误改代码 · 错误切流量 · 错误发通知 · 错误发布
* **R3 安全风险**：越权访问 · 数据泄露 · secret 暴露 · 非授权外联
* **R4 平台风险**：rollout 失控 · projection 失真 · replay 误操作 · worker pool 雪崩

## 10.2 风险评分算法

> v1.2 只给了 "low/medium/high/critical" 四级，但没有说如何计算。v2.0 定义评分公式。

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

```text
RiskAssessmentRequest
  → 计算 risk_score
  → 查询 tenant 风险策略覆盖
  → 确定 risk_level
  → 匹配 risk_action_rule
  → 输出 RiskDecision { level, actions[], requires_approval, evidence_level }
```

**风险控制动作矩阵**：

| risk_level | 自动执行 | 日志级别 | 审批 | side effect | evidence |
|-----------|---------|---------|------|------------|---------|
| low | ✅ | info | 否 | 正常 | 基础 |
| medium | ✅ | warn | 否 | 正常 + 校验 | 增强 |
| high | ❌ | error | 必须 | 受限 | 完整 |
| critical | ❌ | critical | break-glass | 禁止 | 法务级 |

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

* **RBAC**：角色级权限
* **Capability**：能力级权限（can_run_browser / can_use_prod_adapter / can_approve_release / can_replay_events）
* **Context-aware policy**：结合 tenant / project / workflow / environment / risk level / data class 动态决策

**v2.0 改善**：授权决策记录为 `PolicyOutcome`，包含 decision / matched_rules / evaluation_duration，支持审计和策略调优。

## 11.3 Secret 安全

* secret 仅允许引用，不明文传递
* secret 注入短时有效（TTL ≤ 300s）
* secret 不进入 memory / knowledge
* artifact 输出前做 secret scan
* logs / traces / audit 统一做 secret redaction

## 11.4 Sandbox 安全

四档：read_only · workspace_write · scoped_external_access · restricted_exec

任何高风险动作都不应直接 full access。

**技术实现规格**：

| Sandbox Tier | 隔离技术 | 文件系统 | 网络 | 进程 | 资源限制 |
|-------------|---------|---------|------|------|---------|
| read_only | 子进程 + seccomp | 只读挂载 | 禁止 | 单进程 | 256MB / 10s |
| workspace_write | 子进程 + seccomp | tmpfs 写 + workspace 写 | 禁止 | 单进程 | 512MB / 30s |
| scoped_external_access | 容器（可选）| tmpfs 写 | egress allowlist only | 多进程 | 1GB / 60s |
| restricted_exec | 容器 | overlay fs | egress allowlist | 多进程 | 2GB / 300s |

## 11.5 网络出站安全

所有外部调用经过 egress control。控制维度：destination allowlist · adapter binding · credential binding · data class · environment · operation type。egress deny 必须作为正式安全事件记录。

## 11.6 数据分级

基础分级：public · internal · confidential · restricted

扩展标签：pii · regulated · secret-bearing

分级影响：可否入模型 · 可否外发 · 可否进入知识 · 是否必须审批

## 11.7 插件安全

插件视为不可信扩展。要求：独立进程 · 资源限制 · IPC 边界 · capability 白名单 · 输出校验 · 崩溃隔离 · 可 quarantine · 可热禁用。

## 11.8 威胁模型（STRIDE）

| 威胁 | 攻击面 | 缓释措施 |
|------|--------|---------|
| **S**poofing（伪装） | API 调用、Agent 身份 | JWT/API Key 认证 + Principal 链追溯 |
| **T**ampering（篡改） | event log、artifact、prompt | append-only event + CAS + content hash 校验 |
| **R**epudiation（抵赖） | 操作不可追溯 | 全链路审计 + evidence bundle + 不可变 audit log |
| **I**nformation Disclosure | Prompt 泄露、Secret 泄露、PII | Secret redaction + 数据分级 + Prompt 不对终端暴露 |
| **D**enial of Service | API 过载、Worker 耗尽 | 限流 + 背压 + 按 tenant 配额 + circuit breaker |
| **E**levation of Privilege | Plugin 越权、Agent 提权 | Sandbox tier + capability 白名单 + context-aware policy |

**v2.1 新增威胁**：

| 威胁 | 攻击面 | 缓释措施 |
|------|--------|---------|
| Prompt Injection | 用户输入注入恶意指令 | 输入 sanitization + output 校验 + Sandbox 限制 |
| Model Manipulation | 恶意 fine-tune / jailbreak | 质量门禁（§17）+ 输出安全检查 |
| Data Exfiltration via LLM | 模型记忆敏感数据 | data_classification 路由（§15.3）+ PII 不入模型 |

## 11.9 加密策略

传输加密、存储加密和 Key 管理详见 §23.5 加密架构。本节强调安全层的约束：

* 所有平面间通信必须 TLS 1.3（进程内除外）
* P5 存储的 PII 字段必须应用级加密（不依赖数据库 TDE）
* Secret 存储集成 Vault（或等效 KMS），应用层仅持有引用
* 审计日志必须包含完整性签名（HMAC），防止事后篡改

---

# 12. 异常事件处理架构

> 保留 v1.2 的 E1-E6 分类和 SEV1-4 分级。v2.0 增加**可观测性数据模型**和**自动检测规则**。

## 12.1 异常事件分类

* **E1 业务异常**：validation fail · wrong output · no result · low confidence
* **E2 执行异常**：timeout · worker crash · lease expired · retry exhausted
* **E3 外部依赖异常**：adapter failure · provider timeout · rate limit · circuit open
* **E4 安全异常**：unauthorized access · secret leak risk · egress deny · policy violation
* **E5 数据异常**：stale projection · event append failure · invariant break · replay inconsistency
* **E6 治理异常**：rollout guardrail violated · approval overdue · exception expired · knowledge conflict

## 12.2 异常等级

* SEV4：局部轻微，可自动恢复
* SEV3：单 workflow / 单 worker 影响
* SEV2：单业务域 / 单租户明显受影响
* SEV1：平台级影响 / 安全事件 / 生产严重风险

## 12.3 异常检测规则引擎

> v2.0 新增：将异常检测从"硬编码"升级为"规则引擎"。

```typescript
interface DetectionRule {
  rule_id: string;
  name: string;
  condition: {
    metric: string;           // "execution.failure_rate" | "projection.lag_seconds" | ...
    operator: ">" | "<" | "==" | "rate_of_change>";
    threshold: number;
    window_seconds: number;
  };
  severity: "SEV4" | "SEV3" | "SEV2" | "SEV1";
  actions: ("create_incident" | "notify" | "mode_switch" | "circuit_open")[];
  cooldown_seconds: number;
}
```

**内置规则示例**：

| 规则 | 条件 | 等级 | 动作 |
|------|------|------|------|
| worker_heartbeat_missing | heartbeat_gap > 30s | SEV3 | create_incident + lease_reclaim |
| execution_timeout_spike | timeout_rate > 20% in 5min | SEV3 | notify + mode_switch(supervised) |
| projection_lag_high | lag > 30s | SEV3 | notify + rebuild_trigger |
| security_policy_violation | any violation | SEV2 | create_incident + quarantine |
| platform_wide_failure | error_rate > 50% in 1min | SEV1 | create_incident + mode_switch(incident-mode) |

## 12.4 可观测性数据模型

> v1.2 只说"要有 metrics"。v2.0 定义具体指标。

### 核心 Metrics

| 指标名 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `agent.task.total` | counter | tenant, status | 任务总数 |
| `agent.execution.duration_ms` | histogram | tenant, step_type | 执行耗时 |
| `agent.execution.failure_rate` | gauge | tenant, error_type | 失败率 |
| `agent.dispatch.queue_depth` | gauge | queue_class | 队列深度 |
| `agent.dispatch.latency_ms` | histogram | queue_class | 调度延迟 |
| `agent.worker.active` | gauge | pool, capability | 活跃 worker 数 |
| `agent.projection.lag_seconds` | gauge | projection_name | Projection 延迟 |
| `agent.approval.pending_count` | gauge | severity | 待审批数 |
| `agent.circuit_breaker.state` | gauge | target | 断路器状态 |
| `agent.dlq.depth` | gauge | category | DLQ 深度 |

### Structured Log 规范

```typescript
interface StructuredLog {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "critical";
  trace_id: string;
  span_id: string;
  principal: string;
  tenant_id: string;
  component: string;      // "dispatcher" | "executor" | "projector" | ...
  event_type: string;     // "execution.started" | "tool_call.failed" | ...
  message: string;
  data?: Record<string, unknown>;
}
```

## 12.5 DLQ 与 Incident

**DLQ 必须有**：category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status。DLQ 不是垃圾桶，必须可运营。

**Incident 必须关联**：affected workflows · affected aggregates · related rollout · related workers · repair/replay jobs · evidence bundle · final resolution。

## 12.6 告警路由架构

> v2.1 新增。Incident 产生后必须路由到正确的人。

| SEV 级别 | 通知渠道 | 响应 SLA | 升级规则 |
|---------|---------|---------|---------|
| SEV4 | 平台控制台 + 日志 | 下个工作日 | 无 |
| SEV3 | IM 通知（Slack/飞书） | 4h | 4h 无响应 → SEV2 |
| SEV2 | IM + Email + on-call | 1h | 1h 无响应 → SEV1 |
| SEV1 | IM + 电话 + 全员广播 | 15min | 15min 无响应 → 管理层 |

```typescript
interface AlertRoute {
  severity: "SEV4" | "SEV3" | "SEV2" | "SEV1";
  channels: AlertChannel[];
  on_call_schedule_ref?: string;
  escalation_timeout_ms: number;
  escalation_target: AlertRoute;
}

interface AlertChannel {
  type: "console" | "webhook" | "email" | "im" | "phone";
  target: string;
  template_ref: string;
}
```

**外部集成**：通过 Webhook 对接 PagerDuty / OpsGenie / 企业 IM。平台不内置告警通道实现，仅定义路由规则和投递接口。

## 12.7 分布式 Tracing 架构

> v2.1 新增。定义 trace → span → log → metric 的关联模型。

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

* 所有 StructuredLog 必须包含 trace_id + span_id（已有）
* Metrics 通过 exemplar 关联 trace_id（高基数指标采样）
* Incident 关联 trigger trace_id，支持从 incident 追溯到完整调用链
* 采样策略：error trace 100% 采集，normal trace 按 tenant 配置（默认 10%）

---

# 13. OAPEFLIR 受控认知内核

> 保留 v1.2 的双链模型。v2.0 增加**每阶段的 TypeScript 接口契约**和**阶段间数据流定义**。

## 13.1 双链拓扑

**主链（同步）**：Observe → Assess → Plan → Execute → Feedback

**副链（异步）**：Feedback → Learn → Improve → Release

## 13.2 阶段接口契约

### Observe

```typescript
interface ObserveHub {
  collect(context: ObserveContext): Promise<UnifiedObservation>;
}

interface UnifiedObservation {
  task_situation: TaskSituation;
  system_situation: SystemSituation;
  knowledge_refs: KnowledgeRef[];
  memory_refs: MemoryRef[];
  risk_signals: RiskSignal[];
  collected_at: string;
}
```

### Assess

```typescript
interface AssessHub {
  evaluate(observation: UnifiedObservation): Promise<UnifiedAssessment>;
}

interface UnifiedAssessment {
  complexity: "trivial" | "simple" | "moderate" | "complex" | "expert";
  confidence: number;              // 0.0 - 1.0
  risk_level: RiskLevel;
  budget_pressure: "normal" | "warning" | "critical";
  requires_approval: boolean;
  route_decision: "execute" | "escalate" | "reject" | "defer";
  sub_assessments: SubAssessment[];
}
```

### Plan

```typescript
interface PlanHub {
  plan(assessment: UnifiedAssessment, observation: UnifiedObservation): Promise<ExecutionPlan>;
  replan(feedback: StepFeedback, original_plan: ExecutionPlan): Promise<ExecutionPlan>;
}

interface PlannedStep {
  step_id: string;
  type: "tool_call" | "llm_call" | "human_wait" | "sub_workflow" | "checkpoint";
  tool_name?: string;
  inputs: Record<string, unknown>;
  timeout_ms: number;
  retry_policy: RetryPolicy;
  requires_approval: boolean;
  expected_side_effects: SideEffectExpectation[];
}
```

### Execute

Execute 阶段不在 OAPEFLIR 内实现，而是委托给 P4 Execution Plane（见 §14）。OAPEFLIR 只提交 `ExecutionPlan`，接收 `ExecutionReceipt`。

### Feedback

```typescript
interface FeedbackHub {
  process(receipt: ExecutionReceipt): Promise<StepFeedback>;
}

interface StepFeedback {
  feedback_id: string;
  type: "success" | "failure" | "correction" | "timeout" | "policy_block" | "approval_block";
  step_id: string;
  signals: FeedbackSignal[];
  should_replan: boolean;
  should_escalate: boolean;
}
```

### Learn（异步）

```typescript
interface LearnHub {
  extract(feedbacks: StepFeedback[]): Promise<LearningObject[]>;
}

interface LearningObject {
  pattern_type: "failure_pattern" | "correction_pattern" | "recovery_playbook" | "routing_pattern";
  source_feedback_ids: string[];
  confidence: number;
  suggested_action: string;
  evidence: string;
}
```

### Improve（异步）

```typescript
interface ImproveHub {
  propose(learnings: LearningObject[]): Promise<ImprovementCandidate[]>;
}

interface ImprovementCandidate {
  candidate_id: string;
  type: "prompt_update" | "tool_config" | "routing_rule" | "risk_threshold";
  current_value: unknown;
  proposed_value: unknown;
  expected_impact: string;
  rollout_strategy: "shadow" | "canary" | "staged" | "direct";
}
```

### Release（受控）

Release 不是自动环节，而是受 P2 Control Plane 治理的发布流程。ImprovementCandidate 必须经过 validation → approval → canary → staged → stable 的完整 rollout 流程。

## 13.3 阶段间数据流

```text
ObserveContext ──→ [Observe] ──→ UnifiedObservation
                                      │
                                      ▼
                               [Assess] ──→ UnifiedAssessment
                                      │            │
                                      ▼            ▼
                    UnifiedObservation + UnifiedAssessment
                                      │
                                      ▼
                                [Plan] ──→ ExecutionPlan
                                      │
                                      ▼
                           [P4 Execution Plane]
                                      │
                                      ▼
                          ExecutionReceipt ──→ [Feedback] ──→ StepFeedback
                                                                  │
                                              ┌──── replan ◄─────┤
                                              │                   │
                                              ▼                   ▼ (异步)
                                         [Plan]             [Learn] ──→ LearningObject
                                                                            │
                                                                            ▼
                                                                   [Improve] ──→ ImprovementCandidate
                                                                            │
                                                                            ▼
                                                                  [P2 Release Control]
```

## 13.4 约束

* OAPEFLIR 不等于 Runtime — 它只做决策，不做执行
* Learn / Improve 不得直接上线 — 必须经过 P2 的 rollout 治理
* 高风险动作前必须插入 risk / policy / approval 检查
* 每个阶段的输入输出都必须经过 Zod schema 运行时校验

---

# 14. Runtime Execution Plane

> 保留 v1.2 的核心职责定义。v2.0 增加**执行策略模式**和**Executor 注册机制**。

## 14.1 核心职责

session / task / workflow_run / execution 生命周期 · dispatch / queue / worker 调度 · lease / fencing · executor 调用 · side effect 受控提交 · retry / timeout / recovery · mode-aware execution · 事件发射

## 14.2 Dispatcher 智能调度

Dispatcher 同时是风险隔离点，调度决策矩阵：

| 因子 | 影响 |
|------|------|
| worker capability | 匹配 step 所需能力 |
| worker health | 排除不健康 worker |
| queue class | priority / standard / background |
| risk class | 高风险步骤分配到隔离 pool |
| tenant quota | 单 tenant 不超过配额 |
| sandbox requirement | 匹配 sandbox tier |

## 14.3 执行策略模式

> v2.0 新增。将执行策略从硬编码升级为可配置模式。

```typescript
interface ExecutionStrategy {
  retry_policy: {
    max_retries: number;
    backoff: "fixed" | "exponential" | "exponential_with_jitter";
    base_delay_ms: number;
    max_delay_ms: number;
  };
  timeout_policy: {
    step_timeout_ms: number;
    attempt_timeout_ms: number;
    tool_timeout_ms: number;
  };
  failure_policy: "retry" | "skip" | "abort" | "escalate" | "replan";
  checkpoint_policy: "every_step" | "on_side_effect" | "on_approval_gate" | "never";
}
```

每个 Business Pack 可以声明自己的 ExecutionStrategy 覆盖默认值。

## 14.4 Executor 注册机制

> v2.0 新增。将 executor 从硬编码升级为可插拔注册。

```typescript
interface ExecutorRegistry {
  register(type: string, executor: Executor): void;
  resolve(step: PlannedStep): Executor;
}

interface Executor {
  readonly type: string;
  readonly capabilities: string[];
  execute(step: PlannedStep, context: ExecutionContext): Promise<ExecutionReceipt>;
  canHandle(step: PlannedStep): boolean;
}
```

**内置 Executor 类型**：ToolExecutor · PluginExecutor · AdapterExecutor · BrowserExecutor · HumanWaitExecutor · SubWorkflowExecutor

## 14.5 Side Effect 两阶段

1. Executor 返回 proposed side effect
2. Policy / approval 决定是否允许提交
3. Side effect repository 记录
4. 必要时进行 compensation

> 工具执行成功，不等于副作用已正式生效。

## 14.6 HumanWait 是正式执行器

审批等待不是旁路。HumanWait 负责：creates decision → blocks execution → waits resolution → resumes flow。

## 14.7 Recovery Worker 族

LeaseReclaimer · ExecutionRecoveryWorker · WorkflowRepairWorker · ProjectionRebuildWorker · ReplayWorker · StuckRunSweeper

**v2.0 改善**：每个 Recovery Worker 必须声明自己的 `RecoveryCadence`（检查间隔、最大并发恢复数、超时），并通过 `RecoveryReport` 汇报结果。

## 14.8 Runtime 模式切换

**规范模式集**（与 §9.5 一致）：full_auto · supervised_auto · read_only · no-write · no-external-call · no-rollout · manual_only · incident-mode

其中 `full_auto` 对应旧称 `normal`，`supervised_auto` 对应旧称 `degraded`/`supervised`。所有运行时模式必须使用此规范枚举。

模式切换权归 P2 Control Plane，通过 `ControlDirective(type: "mode_switch")` 下发。

---

# 15. LLM Provider 抽象与故障切换架构

> v2.0 未涉及 LLM 层架构。v2.1 将 LLM 视为平台最关键的外部依赖，定义 provider 抽象、路由策略和不可用时的降级模式。

## 15.1 设计原则

* 平台不绑定任何单一 LLM provider
* 所有 LLM 调用通过统一的 ModelGateway 发出，上层不直接调用 provider SDK
* ModelGateway 是 X1 Fabric 的一部分，横切 P3 Orchestration 和 P4 Execution
* LLM 调用视为**高风险外部依赖**，必须有 timeout、circuit breaker、fallback、cost tracking

## 15.2 ModelGateway 接口

```typescript
interface ModelGateway {
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelChunk>;
  embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

interface ModelRequest {
  request_id: string;
  trace_id: string;
  tenant_id: string;
  model_ref: string;
  prompt_ref: string;
  messages: Message[];
  parameters: ModelParameters;
  constraints: ModelConstraints;
}

interface ModelConstraints {
  max_tokens: number;
  max_cost: number;
  max_latency_ms: number;
  required_capabilities: string[];
  data_classification: "public" | "internal" | "confidential" | "restricted";
}

interface ModelResponse {
  response_id: string;
  provider: string;
  model: string;
  content: string;
  usage: TokenUsage;
  latency_ms: number;
  cached: boolean;
  quality_signals: QualitySignal[];
}

interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}
```

## 15.3 Provider 注册与路由

```typescript
interface ProviderRegistry {
  register(provider: ProviderConfig): void;
  resolve(request: ModelRequest): ProviderConfig[];
}

interface ProviderConfig {
  provider_id: string;
  display_name: string;
  endpoint: string;
  models: ModelCapability[];
  auth: ProviderAuth;
  rate_limits: { rpm: number; tpm: number };
  cost_per_1k_tokens: { input: number; output: number };
  data_residency: string[];
  health: ProviderHealth;
  priority: number;
}
```

**路由策略**：

| 策略 | 适用场景 | 说明 |
|------|---------|------|
| priority | 默认 | 按 priority 排序，首选最高优先级 |
| cost_optimized | 批量/低优先级任务 | 选择单价最低的可用 provider |
| latency_optimized | 实时交互 | 选择 P99 延迟最低的 provider |
| data_residency | 合规要求 | 仅选择满足数据驻留的 provider |
| capability_match | 特殊能力 | 匹配 required_capabilities |

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

* 单次请求 timeout（默认 30s）→ 自动切换到下一 provider 重试
* 连续失败 > 5 次（60s 窗口）→ 触发 circuit breaker，provider 标记为 unhealthy
* 所有 provider unhealthy → 进入 LLM Degradation Mode
* provider 恢复后通过 half-open 探测自动回升

## 15.5 LLM 不可用降级模式

当所有 LLM provider 不可用时，平台必须有明确的降级策略，而非简单报错：

| 降级级别 | 触发条件 | 平台行为 |
|---------|---------|---------|
| D0 正常 | 至少一个 provider healthy | 正常路由 |
| D1 受限 | primary down, secondary available | 自动切换 + 告警 + 限制新 workflow 启动速率 |
| D2 缓存 | 所有 provider unhealthy, 缓存可用 | 对相似请求返回缓存结果（仅 read-only 场景） |
| D3 静态 | 缓存不可用 | 使用预置的 static fallback plan（仅低风险任务） |
| D4 暂停 | 所有降级不可用 | 暂停所有新 workflow，保护在途 workflow checkpoint，转人工 |

**缓存设计**：

* 基于 prompt_ref + 参数 hash 的语义缓存
* TTL 按 data_classification 分级：public=1h, internal=15min, confidential=不缓存
* 缓存命中必须标记 `cached: true`，不计入模型质量评估

## 15.6 流式响应与错误处理

`ModelGateway.stream()` 的额外约束：

| 关注点 | 处理策略 |
|--------|---------|
| 流中断 | 已接收 token 缓存为 partial response；若 partial 可用（≥ 80% 预期长度）则标记 `partial: true` 使用；否则切换 provider 重试 |
| Token 超限预检 | 发送前根据 `ModelRequest.messages` 估算 input token 数，若 > provider 的 `context_window - max_tokens` 则拒绝并返回 `TOKEN_LIMIT_EXCEEDED` |
| 响应格式校验 | stream 完成后对完整输出进行 Zod schema 校验；校验失败触发一次 retry（附加 format reminder）；二次失败记录为 `llm.response.validation_failed` |
| 超时 | 流式首 token 超时（TTFT > 10s）触发 provider 切换；总时长超时按 `ModelConstraints.max_latency_ms` 执行 |
| 背压 | 消费者处理速度 < 生产速度时，暂停流读取（backpressure），不丢弃 token |

## 15.7 可观测性

| 指标 | 类型 | 说明 |
|------|------|------|
| `llm.request.total` | counter | 按 provider/model/tenant |
| `llm.request.latency_ms` | histogram | 按 provider/model |
| `llm.request.error_rate` | gauge | 按 provider/error_type |
| `llm.token.usage` | counter | 按 provider/model/tenant |
| `llm.cost.total` | counter | 按 provider/tenant |
| `llm.cache.hit_rate` | gauge | 缓存命中率 |
| `llm.fallback.triggered` | counter | 降级触发次数 |

---

# 16. Prompt 管理与版本化架构

> Prompt 是 Agent 的"源代码"。v2.1 将 Prompt 视为一级架构关注点，定义存储、版本化、灰度发布和回滚机制。

## 16.1 设计原则

* Prompt 不内联在代码中，而是作为**版本化资源**独立管理
* 每个 Prompt 有完整的生命周期：draft → review → staging → canary → stable → deprecated
* Prompt 变更等同于代码变更，必须经过质量门禁（见 §17）
* Prompt 与 model 的组合构成 Agent 行为的核心，两者变更需协同管理

## 16.2 Prompt 数据模型

```typescript
interface PromptDefinition {
  prompt_id: string;
  name: string;
  version: string;
  stage: "observe" | "assess" | "plan" | "feedback" | "learn" | "improve";
  template: string;
  variables: PromptVariable[];
  model_constraints: {
    compatible_models: string[];
    min_context_window: number;
    required_capabilities: string[];
  };
  metadata: {
    author: string;
    created_at: string;
    description: string;
    tags: string[];
  };
}

interface PromptVariable {
  name: string;
  type: "string" | "number" | "json" | "context_ref";
  required: boolean;
  default?: unknown;
  max_tokens?: number;
}

interface PromptVersion {
  version_id: string;
  prompt_id: string;
  version: string;
  status: "draft" | "review" | "staging" | "canary" | "stable" | "deprecated" | "rolled_back";
  content_hash: string;
  parent_version?: string;
  eval_results?: EvalResult[];
  rollout_config?: PromptRolloutConfig;
}
```

## 16.3 发布与灰度

```typescript
interface PromptRolloutConfig {
  strategy: "direct" | "canary" | "staged" | "shadow";
  canary_percentage: number;
  promotion_criteria: {
    min_requests: number;
    max_error_rate: number;
    min_quality_score: number;
    observation_window_minutes: number;
  };
  auto_rollback_on: string[];
}
```

**发布流程**：

```text
draft → [review] → staging → [eval gate §17] → canary(5%) → canary(20%) → stable
                                                    │
                                                    ▼ (质量不达标)
                                               rolled_back
```

* staging 阶段必须通过 eval gate（见 §17）
* canary 阶段与 stable 版本并行运行，按比例分流
* canary 期间持续对比新旧版本的质量指标
* 任何时刻可手动或自动 rollback 到上一个 stable 版本

## 16.4 Prompt 组合管理

一个 OAPEFLIR 循环涉及多个阶段的 Prompt，它们必须作为**原子组合**管理：

```typescript
interface PromptBundle {
  bundle_id: string;
  version: string;
  prompts: Record<string, string>;
  compatibility_matrix: {
    model_refs: string[];
    pack_ids: string[];
  };
}
```

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

| 层次 | 策略 | 说明 |
|------|------|------|
| 输入层 | Variable Escaping | 所有用户输入变量注入前做 XML/Markdown 转义，消除控制字符 |
| 输入层 | Boundary Markers | system 和 user 段使用 LLM provider 原生 role 分隔，不依赖文本标记 |
| 检测层 | Injection Classifier | 轻量级分类模型对每次用户输入进行 injection 概率评分，> 0.7 拒绝 |
| 检测层 | Canary Token | 在 system prompt 中嵌入 canary token，若 LLM 输出包含该 token 则判定 injection |
| 输出层 | Output Sanitizer | LLM 输出经过 URL/link 过滤、PII 检测、指令模式检测 |
| 审计层 | Full Prompt Logging | 每次渲染的完整 prompt 保存为 artifact（confidential 级别以上可选关闭） |

### 16.5.3 基本原则

* Prompt 内容不暴露给终端用户（防信息泄露）
* Prompt 变量注入前必须做 sanitization
* 包含 secret / PII 的变量在 artifact 中做 redaction
* 多轮对话中历史 assistant 消息不可被用户篡改
* 外部工具返回值视为不可信输入，注入前同样经过 sanitization

---

# 17. 模型评估与质量门禁架构

> 无评估能力的 Agent 平台等于"裸奔上线"。v2.1 定义模型/Prompt 变更的质量门禁框架。

## 17.1 评估层次

| 层次 | 触发时机 | 评估内容 | 阻断能力 |
|------|---------|---------|---------|
| 离线评估 | Prompt/Model 变更提交时 | 标准 eval dataset 回归测试 | 阻断发布 |
| 灰度评估 | canary 期间 | 新旧版本实时质量对比 | 自动 rollback |
| 在线监控 | 持续运行 | 质量指标漂移检测 | 触发告警/降级 |

## 17.2 Eval Dataset 管理

```typescript
interface EvalDataset {
  dataset_id: string;
  name: string;
  version: string;
  stage: "observe" | "assess" | "plan" | "feedback";
  cases: EvalCase[];
  created_by: string;
  pack_id?: string;
}

interface EvalCase {
  case_id: string;
  input: Record<string, unknown>;
  expected_output?: unknown;
  quality_criteria: QualityCriterion[];
  tags: string[];
  priority: "critical" | "standard";
}

interface QualityCriterion {
  type: "exact_match" | "contains" | "json_schema" | "semantic_similarity" | "llm_judge" | "custom_function";
  config: Record<string, unknown>;
  weight: number;
  threshold: number;
}
```

## 17.3 质量门禁规则

```typescript
interface QualityGate {
  gate_id: string;
  name: string;
  applies_to: "prompt_change" | "model_change" | "pack_change";
  rules: QualityGateRule[];
  enforcement: "blocking" | "warning";
}

interface QualityGateRule {
  metric: string;
  operator: ">=" | "<=" | "within";
  threshold: number;
  comparison: "absolute" | "relative_to_baseline";
}
```

**内置门禁规则**：

| 规则 | 条件 | 说明 |
|------|------|------|
| regression_pass_rate | >= 95% | eval dataset 通过率不低于基线 |
| critical_case_pass | == 100% | critical 标记的 case 必须全部通过 |
| latency_regression | <= 120% of baseline | 延迟不超过基线的 120% |
| cost_regression | <= 150% of baseline | 成本不超过基线的 150% |
| quality_score_delta | >= -0.05 | 质量分不低于基线 5 个百分点 |

## 17.4 在线质量监控

```typescript
interface QualitySignal {
  signal_type: "output_parseable" | "output_relevant" | "output_safe" | "user_feedback" | "downstream_success";
  value: number;
  timestamp: string;
}
```

**漂移检测**：

* 滑动窗口（1h/24h）统计质量分布
* 当 24h 窗口质量均值下降 > 10%，触发 SEV3 告警
* 当 1h 窗口质量均值下降 > 20%，触发自动降级为 supervised mode
* 所有质量信号写入 P5 Evidence Plane，支撑 Learn 阶段的模式提取

## 17.5 LLM-as-Judge

对于无法用规则判断的质量场景（如"回答是否合理"），使用 LLM-as-Judge：

* Judge LLM 与被评估 LLM 必须来自不同 provider（避免 bias）
* Judge 结果缓存（同一 input+output 不重复评估）
* Judge 调用本身有成本预算限制（见 §18）
* Judge 评估结果纳入质量门禁，但权重低于确定性规则

---

# 18. 成本管理与 Token 计量架构

> LLM 调用成本主导平台 OPEX。v2.1 定义按 tenant 计量、预算强制和 chargeback 机制。

## 18.1 计量模型

```typescript
interface UsageRecord {
  record_id: string;
  timestamp: string;
  tenant_id: string;
  workflow_run_id: string;
  step_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  currency: string;
  cached: boolean;
}
```

**计量点**：ModelGateway 在每次 LLM 调用完成后同步写入 UsageRecord，作为计费的唯一数据源。

## 18.2 预算层级

| 层级 | 预算主体 | 控制粒度 | 超预算行为 |
|------|---------|---------|-----------|
| 平台级 | 整个平台 | 月度总额 | SEV1 告警 + 新 workflow 暂停 |
| 租户级 | 单个 tenant | 月度配额 | 告警 + 该 tenant workflow 排队降速 |
| Pack 级 | 单个 Business Pack | 单次 workflow 上限 | 该 workflow 降级为 supervised |
| Step 级 | 单个 step | 单步 token/cost 上限 | step 中止 + replan |

```typescript
interface BudgetPolicy {
  scope: "platform" | "tenant" | "pack" | "step";
  scope_id: string;
  period: "monthly" | "weekly" | "per_run";
  limit_tokens?: number;
  limit_cost?: number;
  warning_threshold: number;
  actions_on_warning: string[];
  actions_on_breach: string[];
}
```

## 18.3 预算强制

```text
ModelRequest
  → ModelGateway.预算检查
    → 查询当前周期已用量
    → 估算本次调用成本（基于 prompt_tokens + 预估 completion）
    → 若 已用 + 预估 > limit × warning_threshold → 发告警
    → 若 已用 + 预估 > limit → 拒绝请求 / 降级策略
  → 执行 LLM 调用
  → 更新已用量
```

## 18.4 Chargeback 报表

* 按 tenant / pack / model / provider 维度汇总
* 日报 + 月报自动生成
* 支持导出为 CSV / JSON
* 与 Admin API 集成：`/api/v1/admin/cost-reports`

## 18.5 成本优化策略

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| Prompt 缓存 | 语义相似请求复用（见 §15.5） | read-only / 低变化场景 |
| Token 预算裁剪 | context 超长时自动压缩 memory/knowledge 输入 | 大上下文任务 |
| Model 降级 | 低风险任务自动选择低成本 model | background queue |
| 批量合并 | 多个相似 step 合并为一次 LLM 调用 | 批量分析场景 |

---

# 19. Agent 间委托与协作架构

> 复杂企业任务需要多个 Agent 协作。v2.1 定义 Agent 间委托协议、上下文传递和授权模型。

## 19.1 委托模型

```typescript
interface DelegationRequest {
  delegation_id: string;
  parent_workflow_run_id: string;
  parent_step_id: string;
  target_pack_id: string;
  task_description: string;
  context: DelegationContext;
  constraints: DelegationConstraints;
  callback: DelegationCallback;
}

interface DelegationContext {
  shared_knowledge_refs: string[];
  shared_artifact_refs: string[];
  parent_observation_summary: string;
  data_classification: string;
  max_context_tokens: number;
}

interface DelegationConstraints {
  max_steps: number;
  max_duration_ms: number;
  max_cost: number;
  allowed_tools: string[];
  risk_ceiling: "low" | "medium" | "high";
  requires_parent_approval_for_high_risk: boolean;
}

interface DelegationCallback {
  on_complete: "resume_parent" | "notify_parent";
  on_failure: "escalate_to_parent" | "abort_parent" | "retry";
  timeout_action: "abort" | "escalate";
}
```

## 19.2 委托拓扑约束

* **深度限制**：委托链最大深度 = 3（防止无限递归）
* **环检测**：同一 pack_id 不可在同一委托链中出现两次
* **隔离**：子 workflow 独立 lease、独立 checkpoint，不与父 workflow 共享状态
* **预算继承**：子 workflow 预算从父 workflow 剩余预算中扣除
* **权限收缩**：子 workflow 权限 ≤ 父 workflow 权限（最小权限原则）

## 19.3 上下文传递安全

* 父 → 子：仅传递 DelegationContext 中声明的引用，不传递原始数据
* 子 → 父：仅通过 DelegationResult 返回，包含 summary + artifact_refs
* 跨 tenant 委托：默认禁止，需 P2 显式授权
* 数据分级向上兼容：子 workflow 产出数据的分级 ≥ 输入数据分级

```typescript
interface DelegationResult {
  delegation_id: string;
  status: "completed" | "failed" | "timeout" | "cancelled";
  summary: string;
  artifact_refs: string[];
  usage: TokenUsage;
  duration_ms: number;
}
```

## 19.4 协作模式

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| 串行委托 | A 委托 B，等 B 完成后继续 | 简单子任务 |
| 并行扇出 | A 同时委托 B1/B2/B3，聚合结果 | 并行分析 |
| 管道 | A → B → C，链式传递 | 多阶段处理 |
| 协商 | A 和 B 交替执行，共享上下文 | 代码 review + fix |

---

# 20. 长时任务与 Workflow 休眠架构

> 企业场景中 workflow 可能持续数小时甚至数天（等审批、等外部系统回调）。v2.1 定义休眠/唤醒机制。

## 20.1 长时任务分类

| 类型 | 持续时间 | 原因 | 示例 |
|------|---------|------|------|
| 审批等待 | 分钟→天 | HumanWait executor 阻塞 | 高风险操作审批 |
| 外部回调 | 分钟→小时 | 等第三方系统完成 | CI/CD 构建完成回调 |
| 定时调度 | 确定时间 | 等待特定时间窗口 | 非工作时间执行 |
| 多阶段 | 天→周 | 业务流程多阶段审批 | 发布审批链 |

## 20.2 Workflow 休眠机制

```typescript
interface WorkflowHibernation {
  workflow_run_id: string;
  hibernated_at: string;
  reason: "awaiting_approval" | "awaiting_callback" | "scheduled_wake" | "budget_exhausted" | "manual_pause";
  wake_conditions: WakeCondition[];
  checkpoint_ref: string;
  ttl: string;
  timeout_action: "abort" | "escalate" | "retry";
}

interface WakeCondition {
  type: "approval_received" | "callback_received" | "timer_expired" | "event_matched" | "manual_resume";
  config: Record<string, unknown>;
}
```

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

```typescript
interface DurableTimer {
  timer_id: string;
  workflow_run_id: string;
  step_id: string;
  fire_at: string;
  fired: boolean;
  created_at: string;
}
```

* 定时器持久化到数据库，不依赖进程内存
* TimerPoller（类似 outbox poller）定期扫描到期 timer
* 进程重启后 timer 不丢失
* timer 精度：± 30s（非实时系统，不追求毫秒级）

## 20.4 TTL 与超时保护

* 每个 hibernation 必须有 TTL（默认 7 天，最大 30 天）
* TTL 到期后执行 timeout_action
* 超长 workflow 每 24h 发一次 `workflow.still_hibernated` 健康事件
* 超过 TTL 50% 的 hibernation 触发提醒通知

## 20.5 跨部署安全

* checkpoint 格式向后兼容（版本化 schema）
* 平台升级部署时，hibernated workflow 不受影响
* 若 checkpoint schema 不兼容，workflow 进入 `recovery_needed` 状态，由 Recovery Worker 处理

---

# 21. 人机协作模式架构

> v2.0 仅有 HumanWait executor 和基础审批门。v2.1 定义完整的 HITL 模式目录。

## 21.1 HITL 模式目录

| 模式 | 说明 | 触发条件 | 超时行为 |
|------|------|---------|---------|
| 单人审批 | 一个审批人决策 | risk_level ≥ high | 超时 → 升级 |
| 多方审批 | 多人独立审批，投票决策 | critical 操作 / 跨域影响 | 超时 → 自动拒绝 |
| 委托审批 | 审批人可转给他人 | 原审批人不在线 | 委托后 TTL 重置 |
| 迭代反馈 | 人给出修改意见，Agent 重做 | 输出不满意 | 最大迭代次数后终止 |
| 协同编辑 | 人和 Agent 交替修改同一 artifact | 代码/文档协作 | 无超时，手动结束 |
| 知情确认 | 仅通知，无需审批 | 低风险 side effect | 自动通过 |
| 断路人工 | LLM 不可用时转人工决策 | D4 降级模式（见 §15.5） | 人工超时 → abort |

## 21.2 审批流引擎

```typescript
interface ApprovalFlow {
  flow_id: string;
  type: "single" | "multi_party" | "delegated" | "sequential_chain";
  approvers: ApproverRule[];
  quorum?: { min_approvals: number; min_rejections_to_deny: number };
  timeout: ApprovalTimeout;
  escalation: EscalationRule;
}

interface ApproverRule {
  type: "user" | "role" | "team" | "on_call";
  identifier: string;
  can_delegate: boolean;
}

interface ApprovalTimeout {
  warn_after_ms: number;
  escalate_after_ms: number;
  auto_action_after_ms: number;
  auto_action: "approve" | "deny" | "escalate";
}

interface EscalationRule {
  escalate_to: ApproverRule;
  max_escalation_depth: number;
  notification_channels: string[];
}
```

## 21.3 迭代反馈循环

```typescript
interface FeedbackLoop {
  loop_id: string;
  workflow_run_id: string;
  step_id: string;
  max_iterations: number;
  current_iteration: number;
  human_feedback: HumanFeedback[];
}

interface HumanFeedback {
  iteration: number;
  feedback_type: "approve" | "reject_with_guidance" | "modify_directly";
  guidance?: string;
  modified_artifact_ref?: string;
  timestamp: string;
  principal: string;
}
```

**流程**：Agent 产出 → 人审查 → 给出 guidance → Agent replan + 重做 → 循环，直到 approve 或达到 max_iterations。

## 21.4 通知与渠道

| 渠道 | 用途 | 集成方式 |
|------|------|---------|
| 平台控制台 | 默认审批界面 | 内置 |
| Webhook | 外部系统集成 | 出站 HTTP |
| Email | 异步通知 | SMTP adapter |
| IM（Slack/飞书/企微） | 即时通知 + 快捷审批 | Webhook + 回调 API |

---

# 22. SDK 与开发者体验架构

> 无 SDK 的平台无法被业务团队采纳。v2.1 定义 Pack 开发工具链和本地开发体验。

## 22.1 SDK 分层

| SDK 层 | 面向角色 | 功能 |
|--------|---------|------|
| Pack SDK | 业务开发者 | 创建/测试/发布 Business Pack |
| Plugin SDK | 插件开发者 | 开发 tool / adapter / retriever / evaluator |
| Client SDK | 外部集成方 | 调用平台 Public API |
| Admin SDK | 运维团队 | 调用 Admin API，脚本化运维 |

## 22.2 Pack SDK 核心能力

```typescript
interface PackSDK {
  scaffold(config: ScaffoldConfig): Promise<void>;
  validate(manifest: BusinessPackManifest): ValidationResult;
  test(options: TestOptions): Promise<TestReport>;
  publish(options: PublishOptions): Promise<PublishResult>;
}

interface ScaffoldConfig {
  pack_id: string;
  name: string;
  template: "minimal" | "standard" | "full";
  tools: string[];
  risk_level: "low" | "medium" | "high";
}

interface TestOptions {
  mode: "unit" | "integration" | "simulation";
  mock_llm: boolean;
  eval_dataset?: string;
  record_artifacts: boolean;
}
```

## 22.3 本地开发环境

* `agent-platform dev` — 启动本地平台（SQLite + in-process workers）
* `agent-platform pack create` — 创建 Pack 脚手架
* `agent-platform pack test` — 运行 Pack 测试（mock LLM + mock tools）
* `agent-platform pack validate` — 校验 Manifest 合规性
* `agent-platform pack publish --target staging` — 发布到 staging 环境

**本地模拟器**：

* 内置 MockModelGateway：返回预配置的 LLM 响应，用于确定性测试
* 内置 MockToolExecutor：模拟 tool 执行结果
* 测试录制/回放：将真实 LLM 调用录制为 fixture，后续测试回放（不消耗 token）

## 22.4 Plugin 生命周期

| 阶段 | 说明 | 要求 |
|------|------|------|
| 开发 | 本地开发 + Plugin SDK | 必须声明 PluginManifest |
| 测试 | 单元测试 + sandbox 集成测试 | 覆盖率 ≥ 80% |
| 认证 | 安全扫描 + 能力审查 | 通过 Plugin 安全检查清单 |
| 发布 | 注册到 Plugin Registry | 版本语义化（semver） |
| 运行 | 受 sandbox 约束执行 | 资源限制 + 能力白名单 |
| 废弃 | 标记 deprecated + 迁移指引 | 至少维护 3 个月 |

```typescript
interface PluginManifest {
  plugin_id: string;
  name: string;
  version: string;
  type: "tool" | "adapter" | "retriever" | "evaluator" | "presenter";
  capabilities_required: string[];
  resource_limits: { max_memory_mb: number; max_cpu_ms: number; max_duration_ms: number };
  dependencies: string[];
  security: { sandbox_tier: string; egress_domains: string[] };
}
```

## 22.5 文档与示例

* 每个 SDK 必须有 API reference（从 TypeScript 类型自动生成）
* 提供 3 个标准示例 Pack：simple-qa / coding-fix / operations-resolve
* 提供 Playground 环境：在线试用 Pack 开发（可选，Phase 4）

---

# 23. 合规与数据治理架构

> 企业级平台必须满足合规要求。v2.1 定义 GDPR/SOC2 相关的数据治理架构。

## 23.1 数据生命周期管理

| 数据类型 | 保留策略 | 删除方式 | 说明 |
|---------|---------|---------|------|
| Truth table | 按业务需要 | 逻辑删除 + 定期物理清理 | 控制真相 |
| Event log | 默认 365 天 | 归档后删除 | append-only，归档到冷存储 |
| Audit record | 默认 3 年 | 不可删除（合规要求） | 法律保留期 |
| Artifact | 默认 90 天 | 物理删除 | 大对象 |
| Memory | 按 TTL 自动清理 | 物理删除 | 运行态短期数据 |
| Knowledge | 按 trust level 差异化 | 逻辑删除 | 长期共享数据 |
| LLM 调用记录 | 默认 90 天 | 物理删除 | 含 prompt/completion |
| Cost record | 默认 3 年 | 归档 | 财务审计 |

## 23.2 Right-to-Erasure（GDPR Art.17）

append-only event log 与 right-to-erasure 存在架构冲突。解决方案：

**Crypto-shredding**：

1. 每个 tenant 的 PII 数据使用独立的 data encryption key (DEK) 加密后存储
2. DEK 由 key management service 管理，与 tenant_id 关联
3. 删除请求到达时，销毁该 tenant 的 DEK
4. event log 中的加密数据变为不可解密（逻辑等效于删除）
5. 审计记录保留删除操作本身的记录

```typescript
interface ErasureRequest {
  request_id: string;
  tenant_id: string;
  subject_id: string;
  reason: "gdpr_request" | "account_deletion" | "legal_requirement";
  scope: "all_data" | "pii_only";
  requested_by: Principal;
  deadline: string;
}

interface ErasureReport {
  request_id: string;
  status: "completed" | "partial" | "failed";
  affected_records: number;
  dek_destroyed: boolean;
  retained_audit_records: number;
  completed_at: string;
}
```

## 23.3 数据驻留

* 每个 tenant 可配置 data_residency 约束（如 "CN" / "EU" / "US"）
* LLM 调用必须路由到满足数据驻留的 provider（见 §15.3 data_residency 路由）
* 存储引擎按 region 分片（Phase S3+ 支持）
* 跨 region 数据传输默认禁止，需显式授权

## 23.4 SOC2 控制映射

| SOC2 控制域 | 平台对应能力 | 证据来源 |
|------------|-------------|---------|
| CC6.1 逻辑访问 | §11 统一身份与授权 | PolicyOutcome + audit record |
| CC6.3 加密 | §23.5 加密架构 | key rotation log |
| CC7.2 监控 | §12 异常事件检测 | incident + metrics |
| CC8.1 变更管理 | §24 配置治理 + §16 Prompt 版本化 | config_version + prompt_version |
| CC9.1 风险缓释 | §10 风险评分引擎 | RiskDecision + evidence bundle |
| A1.2 容灾 | §31 容灾架构 | DR 演练报告 |

## 23.5 加密架构

| 层面 | 策略 | 实现 |
|------|------|------|
| 传输加密 | TLS 1.3 强制 | 所有 HTTP/gRPC/WebSocket 连接 |
| 存储加密 | AES-256 | 数据库级 TDE 或应用级字段加密 |
| PII 字段加密 | Per-tenant DEK | 支撑 crypto-shredding |
| Secret 存储 | Vault 集成 | 引用式访问，TTL ≤ 300s |
| Key 轮换 | 自动 90 天 | DEK 轮换不影响历史数据解密（envelope encryption） |

## 23.6 数据血缘

每个决策和输出都可追溯到其数据来源：

```text
Knowledge chunk → Observe (UnifiedObservation)
  → Assess (UnifiedAssessment) → Plan (ExecutionPlan)
    → Execute (ExecutionReceipt) → Side Effect
```

* 通过 trace_id + evidence_refs 构建血缘链
* 支持正向查询（某个 knowledge 影响了哪些决策）和反向查询（某个 side effect 依赖了哪些输入）
* 血缘数据写入 P5 Evidence Plane，不单独建存储

---

# 24. 配置治理架构

> v1.2 只提了 "config center" 的名字。v2.0 定义完整的配置治理模型。

## 24.1 配置分层

| 层 | 示例 | 变更频率 | 审批要求 |
|----|------|---------|---------|
| 平台默认 | retry_max=3, timeout=5000ms | 极低 | ADR 级 |
| 环境覆盖 | prod.timeout=10000ms | 低 | P2 审批 |
| 租户覆盖 | tenant_A.max_concurrent=50 | 中 | 租户管理员 |
| 业务包覆盖 | coding.retry_max=5 | 中 | Pack 负责人 |
| 运行时动态 | circuit_breaker.threshold=0.3 | 高 | 自动规则 |

## 24.2 配置版本化

* 每次配置变更生成新版本，保留完整历史
* 支持 diff：展示两个版本间的差异
* 支持 rollback：一键回退到任意历史版本
* 配置变更发射 `config.changed` 事件，触发相关组件热加载

## 24.3 配置灰度

高风险配置变更（如 timeout、限流阈值）支持灰度：

1. 先应用到 canary 环境
2. 观察 30 分钟无异常
3. 扩展到 10% 流量
4. 全量发布

## 24.4 配置安全

* 敏感配置（secret、credential）只存引用，不存明文
* 配置变更审计，记录 who / when / what / why
* 关键配置（sandbox tier、egress allowlist）变更必须 P2 审批

---

# 25. 数据与状态一致性架构

## 25.1 一致性原则

不追求全局强一致，追求：truth state 事务一致 · event append 同事务 · projection 最终一致 · replay 可重建 · side effect 可审计。

## 25.2 真相表 + Event Log 双模型

* 真相表保存当前状态（读优化）
* Event log 保存历史变化（审计/回放优化）
* 两者在同一事务中更新，保证一致

## 25.3 CAS + Lease + Fencing

所有关键更新必须基于：expected status CAS · active lease · fencing token。这是执行层一致性的硬约束。

## 25.4 Projection 必须可重建

所有 projection 都必须：idempotent · replay-safe · event_id 去重 · 支持 rebuild · 不反写真相。

## 25.5 State & Evidence 分层

| 层 | 内容 | 用途 |
|----|------|------|
| Truth | 当前控制真相 | 状态判断、并发控制、调度推进 |
| Event | 历史变化轨迹 | 时间线重建、回放、故障解释 |
| Projection | 查询模型 | Console、报表、审批队列 |
| Audit | 审计记录 | 谁对什么做了什么 |
| Artifact | 大对象内容 | observation/plan/log/evidence/screenshot |
| Checkpoint | 执行恢复点 | 断点恢复、repair、replay 起点 |

---

# 26. 存储架构

> v1.2 直接给出 44 张 PostgreSQL 表。v2.0 先定义**存储抽象层**，再给出**渐进式演进路径**。

## 26.1 Repository 抽象层

所有上层代码通过 Repository interface 访问存储，不直接操作数据库。

```typescript
interface Repository<T, ID> {
  findById(id: ID): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: ID): Promise<void>;
}

interface EventStore {
  append(aggregate_id: string, events: DomainEvent[], expected_version: number): Promise<void>;
  load(aggregate_id: string, from_version?: number): Promise<DomainEvent[]>;
}

interface ProjectionStore {
  update(projection_name: string, event: DomainEvent): Promise<void>;
  rebuild(projection_name: string): Promise<void>;
  query(projection_name: string, filter: Record<string, unknown>): Promise<unknown[]>;
}
```

这一层的意义：
* 上层不关心底层是 SQLite / PostgreSQL / 其他
* 可以单元测试时使用 in-memory 实现
* 可以渐进式从 SQLite 迁移到 PostgreSQL

## 26.2 存储演进路径

| 阶段 | 存储引擎 | 适用场景 | 切换方式 |
|------|---------|---------|---------|
| E1 开发/原型 | SQLite (WAL mode) | 单节点，10 并发 | 默认 |
| E2 小规模生产 | SQLite + Redis cache | 单节点，50 并发 | 配置切换 |
| E3 中规模生产 | PostgreSQL | 多节点，500 并发 | Repository 实现替换 |
| E4 大规模生产 | PostgreSQL + 分表归档 | 集群，5000+ 并发 | Schema 演进 |

**切换原则**：Repository interface 不变，只替换实现。先迁移读多写少的表（projection, audit），后迁移核心写路径（truth, event）。

## 26.3 核心表设计（逻辑模型）

> 这里只给出逻辑分组，不绑定具体数据库。物理 schema 在详细设计阶段定义。

### Group 1: Workflow & Execution（12 表）

workflow_definition · workflow_run · loop_cycle · step_run · step_attempt · execution · execution_lease · dispatch_ticket · task · worker · checkpoint · recovery_job

### Group 2: Decision & Policy（9 表）

tool_definition · tool_call · side_effect · side_effect_reconciliation · decision_record · decision_comment · approval_sla · exception_record · policy_outcome

### Group 3: Knowledge & Artifact（8 表）

artifact_record · artifact_bundle · memory_entry · knowledge_namespace · knowledge_document · knowledge_chunk · knowledge_promotion · knowledge_conflict

### Group 4: Ops & Governance（15 表）

improvement_candidate · rollout_record · rollout_guardrail_result · event_log · event_outbox · audit_record · incident · incident_link · dlq_record · replay_job · repair_job · projection_rebuild_job · idempotency_record · health_snapshot · config_version

### Group 5: AI Operations（v2.1 新增，8 表）

prompt_version · prompt_bundle · eval_dataset · eval_run · usage_record · model_provider · delegation_request · hibernation_snapshot

### Group 6: Domain & Organization（v2.2-v2.4 新增，10 表）

domain_descriptor · domain_risk_profile · domain_recipe · org_node · approval_route · compliance_policy · knowledge_boundary · governance_delegation · sso_identity · scim_sync_log

### Group 7: Maturity & Lifecycle（v2.5-v2.6 新增，9 表）

agent_version · behavior_fingerprint · cost_attribution · stage_rationale · marketplace_item · connector_instance · edge_sync_state · capacity_forecast · compliance_report

**总计**：71 表（v1.2 基线 44 表 + v2.1-v2.6 新增 27 表），实现时**按 Group 分阶段建表**，不要求一次性全部到位。

---

# 27. 性能架构与 SLO

## 27.1 OAPEFLIR 阶段性能目标

| 阶段 | P99 目标 | 说明 |
|------|---------|------|
| Observe | < 50ms | 信号采集与聚合（不含外部调用） |
| Assess | < 30ms | 评估决策（不含 LLM 调用） |
| Plan | < 100ms | DAG 构建与策略选择（不含 LLM 调用） |
| Execute | 视 tool 而定 | 受外部依赖约束，不设统一目标 |
| Feedback | < 10ms | 信号预处理与去重 |
| Learn | < 500ms | 模式检测（异步，不阻塞主链） |
| Improve | < 1s | Candidate 生成（异步） |

## 27.2 Runtime SLO

| 指标 | P99 目标 | 降级阈值 |
|------|---------|---------|
| Dispatch latency | < 200ms | > 1s 触发告警 |
| Lease acquisition | < 50ms | > 200ms 触发告警 |
| Heartbeat round-trip | < 100ms | > 500ms 标记 unhealthy |
| Recovery detection | < 30s | > 60s 触发 SEV3 incident |
| Projection lag | < 5s | > 30s 触发 rebuild |
| Checkpoint write | < 20ms | > 100ms 触发告警 |
| Event append | < 10ms | > 50ms 触发告警 |

## 27.3 可用性目标

| 组件 | 可用性 | 降级策略 |
|------|--------|---------|
| API Gateway | 99.95% | 静态错误页 |
| Control Plane | 99.9% | Read-only degradation |
| Execution Plane | 99.9% | Worker pool failover |
| State Plane | 99.99% | WAL + checkpoint recovery |
| Observability | 99.5% | 可丢指标，不可丢审计 |

## 27.4 容量规划

| 维度 | S1 单体 | S2 多进程 | S3 分布式 |
|------|---------|----------|----------|
| 并发 workflow | 10 | 50 | 500 |
| 活跃 worker | 5 | 20 | 100 |
| Event/s | 100 | 500 | 5,000 |
| 存储 | 1GB SQLite | 10GB SQLite | 100GB+ PG |

## 27.5 性能测试要求

* 每次重大变更前必须运行 load test
* Load test 场景：normal load / peak load / degradation / recovery
* 结果记录为 evidence，与 rollout 关联

## 27.6 Error Budget 策略

> v2.1 新增。定义 SLO 违反时的组织响应。

**Error Budget 定义**：可用性 SLO 99.9% → 月度 Error Budget = 43.2 分钟不可用时间。

| Budget 消耗 | 状态 | 响应 |
|------------|------|------|
| 0-50% | 正常 | 正常发布节奏 |
| 50-80% | 预警 | 减缓非紧急变更发布 |
| 80-100% | 冻结 | 仅允许修复性发布，暂停 feature rollout |
| > 100% | 超额 | 全面冻结 + 专项可靠性修复 + 管理层 review |

**Burn Rate 告警**：

* 1h burn rate > 14.4x（1h 内消耗 2% budget）→ SEV2 告警
* 6h burn rate > 6x（6h 内消耗 5% budget）→ SEV3 告警
* 采用 multi-window 策略减少误报

## 27.7 LLM 延迟拆解

LLM 调用通常主导端到端延迟。必须单独建模：

| 延迟组成 | P99 目标 | 说明 |
|---------|---------|------|
| Prompt 渲染 | < 5ms | 模板填充 + 变量注入 |
| ModelGateway 路由 | < 10ms | Provider 选择 + 预算检查 |
| LLM TTFT（Time to First Token） | < 2s | Provider SLA，不可控 |
| LLM 完整生成 | < 30s | 依赖 output length，设 max_tokens 限制 |
| Response 解析 + 校验 | < 20ms | JSON parse + Zod 校验 |
| 总 LLM 调用 | < 35s | 超过则 timeout |

**LLM 延迟不计入平台自身 SLO**，但需要独立监控和告警。当 LLM P99 延迟 > 基线 200% 时，触发 ModelGateway 降级策略（见 §15.4）。

---

# 28. Event / Projection / Incident / DLQ 模型

## 28.1 事件命名空间（25 个）

workflow_run.* · loop_cycle.* · step_run.* · step_attempt.* · task.* · execution.* · execution_lease.* · worker.* · tool_call.* · side_effect.* · decision.* · artifact.* · memory.* · knowledge.* · rollout.* · incident.* · dlq.* · delegation.* · hibernation.* · prompt.* · eval.* · cost.* · approval_flow.* · agent_lifecycle.* · circuit_breaker.*

## 28.2 核心事件

workflow_run.created · workflow_run.failed · step_run.awaiting_decision · execution.leased · execution.failed · execution_lease.expired · tool_call.succeeded · side_effect.proposed · side_effect.committed · decision.requested · decision.approved · rollout.paused · rollout.rolled_back · incident.created · dlq.recorded · circuit_breaker.state_changed · config.changed

## 28.3 Projection（9 个）

workflow_run_projection · workflow_timeline_projection · approval_queue_projection · tool_usage_projection · worker_status_projection · incident_projection · artifact_catalog_projection · risk_action_projection · governance_projection

## 28.4 Projection 约束

idempotent · replay-safe · event_id dedupe · 可 rebuild · 不反写真相

## 28.5 Incident 约束

incident 必须链接到：affected workflows / executions / workers / rollout / repair jobs / replay jobs / evidence bundles / resolution record

## 28.6 DLQ 约束

DLQ 必须有：category · reason · retry_count · first_failed_at · last_failed_at · operator_action_log · reopen_status

---

# 29. Knowledge / Memory / Artifact / Learning 边界

## 29.1 Knowledge

共享事实、规则、流程、稳定模式。

**层级**：Personal → Team → Company

**Trust Level**：private_unverified → team_reviewed → official → authoritative

**Promotion**：personal → team → company。保留 lineage / reviewer decision / trust change / audit event。

## 29.2 Memory

运行态短中期上下文。会衰减 · 会压缩 · 会被覆盖 · 用于上下文装配。

**v2.0 改善**：Memory 分层明确为 6 层：working → session → episodic → semantic → procedural → meta。每层有独立的 TTL 和淘汰策略。

## 29.3 Artifact

执行产物与大对象，不承担控制真相职责。通过引用（artifact_ref）关联到 workflow_run / step，不内联到 event。

## 29.4 Learning

从反馈中提炼候选模式。Learn 不直接改变线上行为。LearningObject 必须经过 Improve → Validation → Approval → Rollout 才能生效。

---

# 30. 业务接入约束与 Business Pack 模型

> v2.2 改善：Business Pack 现在必须关联 DomainDescriptor(§37)，Pack 的风控、知识检索、评估策略由领域描述符驱动。

## 30.1 业务包不能绕过的平台能力

policy engine · approval engine · lease / fencing · artifact ref · audit · event log · projection contract · **domain descriptor(§37)**

## 30.2 每个 Business Pack 必须声明

```typescript
interface BusinessPackManifest {
  pack_id: string;
  name: string;
  version: string;
  domain_id: string;                        // v2.2: 关联 DomainDescriptor(§37)
  risk_matrix: RiskMatrixEntry[];
  tool_bundles: string[];
  approval_points: ApprovalPointDef[];
  artifact_types: string[];
  knowledge_namespaces: string[];
  failure_strategy: ExecutionStrategy;
  rollback_capability: boolean;
  domain_metrics: MetricDef[];
}
```

> **v2.2 约束**：`domain_id` 为必填字段，必须指向已注册且状态为 Active 的 DomainDescriptor。Pack 注册时平台自动校验 `domain_id` 有效性，并将 DomainRiskProfile 的风险覆写应用到 Pack 的 risk_matrix 之上。

## 30.3 高风险业务默认 supervised

operations · growth write actions · production release · finance-like actions → 第一阶段默认 supervised，不允许 full_auto。

## 30.4 Pack 生命周期

> v2.1 新增。定义 Pack 从开发到废弃的完整流程。

| 阶段 | 说明 | 要求 | 产出 |
|------|------|------|------|
| 开发 | 使用 Pack SDK 本地开发 | 遵循 Manifest schema | 代码 + Manifest + eval dataset |
| 测试 | 本地 mock 测试 + staging 集成测试 | 覆盖率 ≥ 80% + eval 通过 | TestReport |
| 认证 | 安全审查 + 风险评估 + 平台兼容性检查 | 通过 Pack 检查清单 | CertificationRecord |
| 发布 | 注册到 Pack Registry + rollout | semver 版本化 | RolloutRecord |
| 运行 | 受平台治理约束执行 | 持续质量监控 | metrics + incidents |
| 废弃 | 标记 deprecated + 迁移指引 | 至少维护 6 个月 | DeprecationNotice |

## 30.5 Pack API 兼容性契约

* Pack Manifest schema 遵循 semver：minor 版本只新增字段，major 版本允许破坏性变更
* 平台升级时必须运行 Pack 兼容性测试套件
* 破坏性变更提前 2 个 minor 版本发出 deprecation warning
* 提供 `agent-platform pack migrate` 命令辅助 Pack 升级

## 30.6 Plugin 治理

| 治理维度 | 策略 |
|---------|------|
| 版本管理 | semver + Plugin Registry |
| 依赖管理 | 声明式依赖 + 冲突检测 |
| 安全认证 | 自动安全扫描 + 人工审查（高权限 plugin） |
| 废弃策略 | deprecated 标记 → 3 个月迁移期 → archived |
| 兼容性 | 每个 plugin 声明 min_platform_version |

---

# 31. 容灾与高可用架构

> v1.2 未涉及容灾。v2.0 定义从单节点到多 AZ 的高可用策略。

## 31.1 单点故障消除

| 组件 | 单点风险 | 消除策略 |
|------|---------|---------|
| API Gateway | 进程崩溃 | 多实例 + 负载均衡 |
| Dispatcher | 调度中断 | Leader election（lease-based） |
| Worker | 执行中断 | Lease 超时 → 自动 reclaim |
| Event Poller | 事件堆积 | Lease-based 单实例 + 健康检查 |
| Database | 数据丢失 | WAL + 定时备份 / PG streaming replication |

## 31.2 高可用分级

| 级别 | 架构 | RTO | RPO |
|------|------|-----|-----|
| HA-1 基础 | 单节点 + 定时备份 | < 1h | < 15min |
| HA-2 标准 | 双节点 active-passive + WAL shipping | < 10min | < 1min |
| HA-3 企业 | 多 AZ active-active + PG streaming | < 1min | 0（同步复制） |

## 31.3 备份与恢复

* **数据备份**：SQLite 阶段使用 `.backup()` API，PG 阶段使用 pg_basebackup
* **事件回放**：从 event_log 重建所有 projection 和 artifact catalog
* **配置备份**：config_version 表自带历史，可任意回退
* **灾难恢复演练**：每季度至少一次，记录 RTO/RPO 实测值

## 31.4 数据完整性保护

* 所有写操作通过 CAS + Lease + Fencing 保护
* Event log 使用 append-only 模式，不允许修改历史事件
* Checkpoint 使用 WAL 保护，进程崩溃后可恢复
* Truth table 与 event log 在同一事务中更新

---

# 32. 部署架构

> v1.2 直接给出 18 个微服务。v2.0 采用**单体优先、渐进拆分**策略。

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

dev · test · staging · prod

## 32.3 资源池

read-only worker pool · write-enabled worker pool · high-risk isolated pool · browser worker pool · plugin isolated pool

---

# 33. 分阶段落地路线

> v1.2 只有"先做/再做"。v2.0 增加**验收门**、**依赖关系**和**具体交付物**。

## Phase 1：稳态骨架（8 周）

### 交付物

* truth tables + event log + UoW（Group 1 表）
* lease / fencing / CAS
* idempotency
* artifact ref
* policy outcome + decision model（Group 2 表）
* 最小运维 CLI（doctor / inspect）
* Unit test ≥ 80% 覆盖

### 验收门

* [ ] workflow_run 可稳定创建和推进（无降级）
* [ ] lease 超时后自动 reclaim
* [ ] CAS 冲突被正确拒绝
* [ ] 事件追加与真相表在同一事务

### 依赖

无外部依赖。SQLite + Node.js 即可启动。

## Phase 2：受控自动化（8 周）

### 交付物

* OAPEFLIR 主链 O→A→P→E→F
* risk assessment engine
* approval gates（basic）
* side effect tracking
* recovery workers（LeaseReclaimer + StuckRunSweeper）
* 2 个 Business Pack：coding.fix_bug + operations.resolve_incident

### 验收门

* [ ] 主链端到端跑通（task 创建 → 执行 → 完成）
* [ ] 高风险 step 触发审批阻断
* [ ] worker 崩溃后 30s 内恢复执行
* [ ] side effect 可查询可审计

### 依赖

Phase 1 全部验收通过。

## Phase 3：企业可靠化（12 周）

### 交付物

* OAPEFLIR 副链 F→L→I→R
* circuit breaker + degradation mode switching
* backpressure（4 模式）
* incident management + DLQ 运营
* projection rebuild
* replay / repair
* 配置治理（版本化 + 灰度）
* 多租户隔离强化
* PostgreSQL 迁移（可选）

### 验收门

* [ ] 外部依赖熔断后自动降级，恢复后自动回升
* [ ] DLQ 可查询可重试可关闭
* [ ] Incident 闭环处置链打通
* [ ] Projection rebuild 后数据一致
* [ ] 配置变更可回滚

### 依赖

Phase 2 全部验收通过。

## Phase 4：规模化扩展（持续）

### 交付物

* Worker 分离部署（Phase D2）
* 更多 Business Pack
* 浏览器执行深化
* 插件生态
* SLO 自动化监控
* 合规导出
* 容灾演练

### 验收门

* [ ] 50 并发 workflow 稳定运行
* [ ] 多 tenant 隔离验证通过
* [ ] Load test 符合 §27 SLO
* [ ] 容灾演练 RTO < 10min

## Phase 5：智能交互与组织治理（12 周）

> 对应 v2.3-v2.4 架构层。

### 交付物

* 自然语言任务入口(§39) + 目标分解引擎(§40)
* 主动式 Agent 框架(§41) + 渐进式自主权模型(§42)
* 统一运营看板(§43) + 非技术用户体验(§44)
* 组织层次模型(§46) + 审批路由(§47) + SSO/SCIM(§48)
* 合规策略引擎(§49) + 知识域隔离(§50) + 治理委托(§51)

### 验收门

* [ ] 非技术用户可通过自然语言创建和管理任务
* [ ] 目标分解引擎自动将业务目标拆解为可执行任务图
* [ ] 渐进式自主权 L0→L3 升级路径端到端验证
* [ ] 组织架构三级层次正确驱动审批路由
* [ ] SSO/SCIM 自动同步用户且停用账户 < 5min 生效
* [ ] 知识域隔离零泄漏，受控共享审计完整

### 依赖

Phase 4 全部验收通过。

## Phase 6：规模化与生态（12 周）

> 对应 v2.5 架构层。

### 交付物

* 多 Region 部署(§52) + 资源竞争管理(§53) + SLA 分级(§54)
* Agent 市场(§55) + 反馈改进管线(§56) + 外部集成框架(§57)

### 验收门

* [ ] 双 Region Active-Active 部署，单 Region 故障 RTO < 5min
* [ ] 1000 并发 workflow 下高优先级任务不饥饿
* [ ] SLA Tier P0 任务 99.9% 在承诺时间内完成
* [ ] Marketplace 至少 20 个认证 Pack 上架
* [ ] 用户反馈→改进闭环 < 7 天

### 依赖

Phase 5 全部验收通过。

## Phase 7：运营成熟度（持续）

> 对应 v2.6 架构层。

### 交付物

* 可解释性(§59) + 紧急制动(§60) + 生命周期管理(§61)
* 离线/边缘部署(§62) + 行为漂移检测(§63) + 成本优化(§64)
* 可视化调试器(§65) + 合规报告(§66) + 容量规划(§67)
* 多模态能力(§68) + 平台自运维 Agent(§69)

### 验收门

* [ ] 用户可对任意 step 查询解释，L1 延迟 < 2s
* [ ] 紧急制动演练：全平台停止 < 5s，恢复 < 30min
* [ ] EdgeRuntime 断网 24h 恢复后数据同步零丢失
* [ ] 行为漂移 > 2σ 时 100% 触发告警
* [ ] 合规报告 SOC2 Type II 控制点覆盖率 ≥ 95%
* [ ] PlatformOps Agent L1 成熟度验证通过

### 依赖

Phase 6 全部验收通过。

## 33.1 Phase 依赖图

```text
Phase 1 (稳态骨架)
    │
    ▼
Phase 2 (受控自动化)
    │
    ▼
Phase 3 (企业可靠化)
    │
    ▼
Phase 4 (规模化扩展)
    │
    ▼
Phase 5 (智能交互与组织治理)
    │
    ▼
Phase 6 (规模化与生态)
    │
    ▼
Phase 7 (运营成熟度)
```

每个 Phase 不可跳过，必须按顺序验收。

---

# 34. ADR 冻结建议

v1.2 的 19 个 ADR 建议保留。v2.0 新增 4 个，v2.1 新增 9 个，v2.2 新增 4 个，v2.3 新增 6 个，v2.4 新增 6 个，v2.5 新增 6 个，v2.6 新增 11 个：

**v1.2 原有（19 个）**：
ADR-Platform-Layering · ADR-Control-Runtime-Intelligence-Separation · ADR-Domain-Onboarding-Model · ADR-Memory-vs-Knowledge-Boundary · ADR-Contracts-as-Single-Source · ADR-State-Machine-Canonical-Map · ADR-Governance-as-First-Class-Plane · ADR-Integration-Through-Adapters-Only · ADR-Reliability-Fabric-as-Crosscutting-System · ADR-Risk-Assessment-Mandatory-Before-High-Risk-Actions · ADR-SideEffect-Two-Phase-Commit-Style · ADR-HumanWait-as-Formal-Executor · ADR-Incident-as-First-Class-Object · ADR-Projection-Rebuild-Mandatory · ADR-Platform-Mode-Switching · ADR-DLQ-Handling-Model · ADR-Egress-Control-Mandatory · ADR-Security-Classification-Policy · ADR-Runtime-Checkpoint-Boundaries

**v2.0 新增（4 个）**：
* **ADR-Plane-Communication-Contracts** — 五平面间必须通过正式契约对象通信
* **ADR-Repository-Abstraction-Layer** — 所有存储访问通过 Repository interface
* **ADR-Single-Process-First** — 部署从单体开始，验证后再拆分
* **ADR-API-Versioning-Strategy** — API 版本化与向后兼容策略

**v2.1 新增（9 个）**：
* **ADR-ModelGateway-As-Single-LLM-Entry** — 所有 LLM 调用必须通过 ModelGateway，禁止直接调用 provider SDK
* **ADR-Prompt-As-Versioned-Resource** — Prompt 不内联代码，作为版本化资源独立管理
* **ADR-Quality-Gate-Before-Prompt-Release** — Prompt/Model 变更必须通过质量门禁
* **ADR-Per-Tenant-Cost-Metering** — 所有 LLM 成本必须按 tenant 计量
* **ADR-Delegation-Depth-Limit** — Agent 间委托最大深度 = 3
* **ADR-Workflow-Hibernation-Model** — 长时等待 workflow 必须释放 worker 并持久化状态
* **ADR-Crypto-Shredding-For-Erasure** — GDPR 删除通过 crypto-shredding 实现
* **ADR-Pack-Semver-Compatibility** — Pack Manifest API 遵循 semver 兼容性契约
* **ADR-LLM-Latency-Excluded-From-Platform-SLO** — LLM 延迟独立监控，不计入平台自身 SLO

**v2.2 新增（4 个）**：
* **ADR-Domain-Descriptor-As-Semantic-Layer** — 每个 Business Pack 必须关联 DomainDescriptor，领域语义不内嵌 Pack 代码
* **ADR-Domain-Risk-Override-Over-Platform-Default** — 领域风险画像覆写优先于平台默认风险矩阵，覆写需审计理由
* **ADR-Domain-Recipe-As-Onboarding-Accelerator** — 新业务域必须从四种原型模板之一开始，禁止空白接入
* **ADR-Four-Phase-Domain-Onboarding** — 业务域接入必须通过四阶段门禁（建模→开发→认证→灰度），不允许跳过

**v2.3 新增（6 个）**：
* **ADR-NL-Intent-Must-Resolve-To-RequestEnvelope** — 自然语言输入必须经过 Intent 解析生成结构化 RequestEnvelope(§5.3)，禁止将原始文本直接传递给 Agent
* **ADR-Goal-Decomposition-Max-Depth** — 目标分解引擎递归深度上限 = 5，超过需人工确认分解方案
* **ADR-Proactive-Agent-Must-Have-Trigger-Policy** — 主动式 Agent 必须绑定 TriggerPolicy，禁止无条件轮询
* **ADR-Autonomy-Level-Guarded-Progression** — 渐进式自主权等级默认单调递增（晋升需满足积分门槛 + 审批）；降级仅在 §42.2 定义的安全触发条件下发生（P0 Incident / 连续失败 / 成本超限），降级执行后须人工审批确认并记录原因，恢复路径遵循晋升规则
* **ADR-Dashboard-Metric-Source-Of-Truth** — 统一运营看板数据必须来自 State & Evidence Plane，禁止直接读取 Runtime 内部状态
* **ADR-No-Code-UX-Maps-To-Standard-API** — 非技术用户界面操作必须映射到标准 Public API，禁止旁路

**v2.4 新增（6 个）**：
* **ADR-Org-Hierarchy-As-First-Class-Model** — 组织层次（企业→事业群→部门→团队）作为一等模型，所有资源归属必须关联 OrgNode
* **ADR-Approval-Route-From-Org-Chart** — 审批路由必须从组织架构动态派生，禁止硬编码审批人列表
* **ADR-SSO-As-Single-Identity-Source** — 企业 SSO 为唯一身份来源，平台不维护独立用户密码
* **ADR-Compliance-Policy-Inherits-Down** — 合规策略沿组织树向下继承，子节点只能收紧不能放松
* **ADR-Knowledge-Boundary-Default-Deny** — 知识域默认隔离，跨部门共享需显式授权并记录审计日志
* **ADR-Governance-Delegation-Requires-Scope** — 治理权委托必须限定 scope（资源类型 + OrgNode 范围），禁止全局委托

**v2.5 新增（6 个）**：
* **ADR-Multi-Region-Active-Active-With-Home-Region** — 多 Region 采用 Active-Active 架构，每个 tenant 有 Home Region，跨 Region 数据异步复制
* **ADR-Resource-Contention-Fair-Queue** — 规模化部署必须使用加权公平队列，禁止简单 FIFO 导致高优先级任务饥饿
* **ADR-SLA-Tier-Determines-Resource-Allocation** — SLA 等级决定资源配额、队列优先级和故障恢复顺序
* **ADR-Marketplace-Pack-Must-Pass-Certification** — Agent 市场上架的 Pack 必须通过平台认证（安全扫描 + 沙箱测试 + 性能基线）
* **ADR-Feedback-Loop-Closed-Within-SLA** — 用户反馈必须在 SLA 定义的时间窗内形成闭环（采集→分析→改进→验证）
* **ADR-Integration-Through-Unified-Connector** — 外部系统集成必须通过统一 Connector 框架，禁止业务代码直接调用外部 API

**v2.6 新增（11 个）**：
* **ADR-Every-Decision-Must-Have-Rationale** — OAPEFLIR 每个阶段必须生成 StageRationale，决策解释按需渲染
* **ADR-Platform-Panic-Atomic-Halt** — PlatformPanicDirective 必须在 5 秒内原子停止全平台，恢复需双人审批
* **ADR-Agent-As-Composite-Entity** — Agent 作为 Pack+Prompt+Model+Trust+Trigger 的复合实体，以 AgentVersion 为发布和回滚单位
* **ADR-Edge-Runtime-Risk-Ceiling** — 离线 EdgeRuntime 只允许执行 risk_level ≤ medium 的动作，高风险动作等待连接恢复
* **ADR-Behavior-Fingerprint-Mandatory** — 每个 Agent 必须维护 BehaviorFingerprint，漂移检测覆盖 1h/7d/30d/90d 四个窗口
* **ADR-Cost-Attribution-Per-Decision** — 成本归因必须精确到决策级（单个 LLM 调用），优化建议必须附带 quality_risk 评估
* **ADR-Workflow-Debug-Session-Isolated** — 调试 session 在隔离沙箱中运行，断点暂停不影响其他 workflow
* **ADR-Compliance-Report-Template-Versioned** — 合规报告模板必须版本化，报告生成时锁定模板版本
* **ADR-Capacity-Forecast-Drives-Scaling** — 容量预测结果必须关联到扩容建议，扩容建议必须附带成本影响估算
* **ADR-Multimodal-Safety-Check-Before-Output** — 多模态输出（图片/语音）必须经过内容安全检查后才能交付给用户
* **ADR-PlatformOps-Agent-Read-Only-Default** — 平台自运维 Agent 默认只读，生产写操作必须经过人工审批

---

# 35. 推荐代码目录

```text
src/
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

    orchestration/      # P3
      oapeflir/
      planner/
      replan/
      routing/
      escalation/
      hitl/

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

    model-gateway/      # LLM 抽象层（v2.1）
      provider-registry/
      router/
      cache/
      cost-tracker/
      fallback/

    prompt-engine/      # Prompt 管理（v2.1）
      registry/
      renderer/
      rollout/
      eval/

    compliance/         # 合规与数据治理（v2.1）
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

  domains/                # 业务域建模（v2.2）
    registry/             # DomainDescriptor 注册与生命周期
    risk-profile/         # DomainRiskProfile 领域风险画像
    knowledge-schema/     # DomainKnowledgeSchema 领域知识结构
    eval-framework/       # DomainEvalFramework 领域评估
    prompt-library/       # DomainPromptLibrary 领域 Prompt 库
    recipes/              # DomainRecipe 原型模板
    interaction-policy/   # DomainInteractionPolicy 跨域策略
    governance/           # DomainGovernancePolicy 领域治理
    coding/               # 代码研发域实例
    operations/           # 运维域实例

  interaction/            # 智能交互层（v2.3）
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

  org-governance/         # 组织治理层（v2.4）
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

  scale-ecosystem/        # 规模化运行层 + 生态层（v2.5）
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

  ops-maturity/           # 运营成熟度层（v2.6）
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

  sdk/                  # SDK（v2.1）
    pack-sdk/
    plugin-sdk/
    client-sdk/
    cli/

  apps/
    api/
    console/
    workers/
```

---

# 36. 风险、约束与成功标准

## 36.1 主要风险

* 模型输出不稳定
* 工具副作用不可控
* 恢复链路不足导致自动化不可托底
* projection 偏差被误当真相
* 误学习导致行为漂移
* 多租户隔离不彻底
* Pack 模型不收敛导致平台被业务反侵入
* 预算失控
* replay / rebuild 误操作放大问题
* **（v2.1）LLM provider 全面不可用导致平台瘫痪**
* **（v2.1）Prompt 变更引入行为回归**
* **（v2.1）LLM 成本失控（token 超支）**
* **（v2.1）Agent 委托链递归失控**
* **（v2.3）NL Intent 解析歧义导致错误任务创建**
* **（v2.3）目标分解递归过深导致任务爆炸**
* **（v2.3）主动式 Agent 无限触发形成风暴**
* **（v2.3）渐进式自主权误升级导致高风险动作失控**
* **（v2.4）组织架构变更同步延迟导致审批路由错误**
* **（v2.4）知识隔离配置错误导致跨部门数据泄漏**
* **（v2.4）治理权委托范围过大导致安全降级**
* **（v2.5）跨 Region 数据复制延迟导致一致性问题**
* **（v2.5）资源竞争管理失效导致高优先级任务饥饿**
* **（v2.5）Marketplace 恶意 Pack 通过认证后造成安全事件**
* **（v2.6）解释管线 LLM 调用成本失控（频繁 forensic-level 解释）**
* **（v2.6）紧急制动误触导致全平台无故停机**
* **（v2.6）Agent 复合版本灰度测试覆盖不足导致组合缺陷逃逸**
* **（v2.6）EdgeRuntime 离线状态积累大量 side effect，连接恢复时冲突爆炸**
* **（v2.6）行为漂移检测误报导致 Agent 频繁降级影响业务**
* **（v2.6）多模态内容安全检查漏判导致违规内容输出**

## 36.2 硬约束

* Runtime 只消费发布态定义
* Projection 不反写真相
* Learn 不直接驱动线上变更
* Secret 不进入 Memory / Knowledge / 对外 Artifact
* 所有外呼经过 egress control
* 所有 side effect 都必须对象化记录
* 高风险动作必须审批或显式 deny
* CAS + Lease + Fencing 为写回硬约束
* 平面间通信必须通过正式契约对象
* **（v2.1）所有 LLM 调用必须通过 ModelGateway**
* **（v2.1）Prompt 变更必须通过质量门禁**
* **（v2.1）LLM 成本必须按 tenant 计量**
* **（v2.1）Agent 委托深度 ≤ 3**
* **（v2.1）PII 数据删除通过 crypto-shredding 实现**
* **（v2.3）NL 输入必须经过 Intent 解析生成 RequestEnvelope(§5.3)，禁止原始文本直传**
* **（v2.3）目标分解递归深度 ≤ 5**
* **（v2.3）主动式 Agent 必须绑定 TriggerPolicy**
* **（v2.3）自主权等级默认单调递增；降级仅限 §42.2 安全触发条件，执行后须人工审批确认**
* **（v2.4）所有资源归属必须关联 OrgNode**
* **（v2.4）合规策略沿组织树向下继承，子节点只能收紧**
* **（v2.4）知识域默认隔离，跨部门共享需显式授权**
* **（v2.4）SSO 为唯一身份来源**
* **（v2.5）每个 tenant 必须指定 Home Region**
* **（v2.5）Marketplace Pack 必须通过认证后才能上架**
* **（v2.5）外部系统集成必须通过统一 Connector 框架**
* **（v2.6）OAPEFLIR 每个阶段必须生成 StageRationale**
* **（v2.6）PlatformPanicDirective 同 Region < 5s、跨 Region < 15s 停止全平台**
* **（v2.6）Agent 发布和回滚以 AgentVersion（复合快照）为单位**
* **（v2.6）EdgeRuntime 离线模式 risk_level ≤ medium**
* **（v2.6）每个 Agent 必须维护 BehaviorFingerprint**
* **（v2.6）多模态输出必须经过内容安全检查**
* **（v2.6）PlatformOps Agent 默认只读，生产写操作需人工审批**

## 36.3 成功标准

### Phase 1 成功标准

* workflow_run 可稳定创建和推进
* lease 超时自动 reclaim
* CAS 冲突被正确拒绝

### Phase 2 成功标准

* OAPEFLIR 主链端到端跑通
* worker 崩溃后 30s 内恢复
* 高风险动作可被审批阻断

### Phase 3 成功标准

* incident / replay / repair / DLQ 可运营
* 外部依赖熔断→降级→恢复自动化
* projection 可重建且数据一致

### Phase 4 成功标准

* 50 并发 workflow 稳定运行
* Load test 符合 SLO
* 容灾演练 RTO < 10min

### Phase 5 成功标准（v2.3-v2.4）

* 非技术用户可通过自然语言创建和管理任务
* 目标分解引擎自动将业务目标拆解为可执行任务图
* 主动式 Agent 按 TriggerPolicy 自动触发且无风暴
* 渐进式自主权 Level 0→3 升级路径端到端验证
* 组织架构三级层次（公司→部门→团队）正确驱动审批路由
* SSO/SCIM 自动同步用户且停用账户 < 5min 生效
* 知识域隔离零泄漏，受控共享审计完整

### Phase 6 成功标准（v2.5）

* 双 Region Active-Active 部署，单 Region 故障 RTO < 5min
* 1000 并发 workflow 下高优先级任务不饥饿
* SLA Tier P0 任务 99.9% 在承诺时间内完成
* Marketplace 至少 20 个认证 Pack 上架
* 用户反馈→改进闭环 < 7 天
* 预构建 Connector 覆盖 P0 类别全部系统

### Phase 7 成功标准（v2.6）

* 用户可对任意 workflow step 查询解释，L1 延迟 < 2s，L3 延迟 < 10s
* 紧急制动演练：同 Region 全平台停止 < 5s，恢复 < 30min
* AgentVersion 复合灰度发布端到端验证（canary→active 自动晋升）
* EdgeRuntime 在断网 24h 后恢复连接，数据同步零丢失
* 行为漂移检测在 Agent 行为分布偏移 > 2σ 时 100% 触发告警
* 成本优化建议节省率 ≥ 20%（对比未优化基线）
* 合规报告 SOC2 Type II 全自动生成，控制点覆盖率 ≥ 95%
* 容量预测 30 天准确度 ≥ 85%
* 多模态：图片分析 + 语音转文字端到端可用
* PlatformOps Agent L1 成熟度验证：自动诊断报告生成 < 5min

---

# 37. 业务域建模与接入架构

> v2.2 新增。解决"平台搭好了怎么承接企业内部多元业务"的核心问题。
> 关联：§30 Business Pack 模型 · §22 SDK/DX · §10 风险控制 · §16 Prompt 管理 · §17 模型评估 · §29 Knowledge/Memory

## 37.1 问题陈述

企业内部 12+ 垂直业务线在以下维度存在根本差异：

| 维度 | 代码研发 | 素材制作 | 财务 | 直播带货 | 客服 |
|------|---------|---------|------|---------|------|
| 风险等级 | High（生产变更） | Medium（品牌合规） | Critical（资金） | High（实时决策） | Low（信息查询） |
| 时间敏感性 | 分钟级 | 小时级 | 天级（审批链） | 秒级 | 秒级 |
| 知识时效 | 代码库实时 | 品牌指南月级 | 法规季度级 | 库存秒级 | FAQ 周级 |
| 评估维度 | 编译通过+测试覆盖 | 美学+品牌一致性 | 准确性+合规性 | GMV 转化率 | 解决率+满意度 |
| 审批要求 | Code Review | 设计审核 | 四眼原则+分级审批 | 自动（规则内） | 无 |
| 可逆性 | Git revert | 版本回退 | 冲正/对账 | 不可逆（已播出） | 可重发 |

**当前 §30 Business Pack 将上述差异压缩为一个平坦的 `BusinessPackManifest`**，无法表达领域语义、无法驱动差异化风控、无法指导领域 Prompt 策略。

## 37.2 DomainDescriptor — 领域描述符

每个业务域在接入平台时必须提供结构化的领域描述符，作为平台理解、约束、优化该域 Agent 行为的基础：

```typescript
interface DomainDescriptor {
  domain_id: string;                          // e.g. "finance", "content-production"
  domain_name: string;                        // 人类可读名称
  domain_class: DomainClass;                  // 领域分类
  version: string;                            // descriptor 版本

  entities: DomainEntity[];                   // 领域核心实体
  capabilities: DomainCapability[];           // 领域能力声明
  workflows: DomainWorkflowTemplate[];        // 典型工作流模板
  vocabulary: DomainVocabulary;               // 领域术语表
  constraints: DomainConstraint[];            // 领域硬约束

  risk_profile: DomainRiskProfile;            // → §37.3
  knowledge_schema: DomainKnowledgeSchema;    // → §37.4
  eval_framework: DomainEvalFramework;        // → §37.5
  prompt_library: DomainPromptLibrary;        // → §37.6
  governance: DomainGovernancePolicy;         // → §37.9
}

type DomainClass =
  | "crud_heavy"       // HR、客服、企业知识库
  | "analytics"        // 数据分析、广告报表
  | "creative"         // 素材制作、游戏资产
  | "realtime"         // 直播带货、安全运维
  | "transactional"    // 财务、订单
  | "engineering"      // 代码研发、CI/CD
  | "hybrid";          // 多原型混合

interface DomainEntity {
  entity_name: string;                        // e.g. "Invoice", "Creative Asset"
  operations: ("create" | "read" | "update" | "delete" | "approve" | "archive")[];
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  audit_level: "none" | "basic" | "full" | "forensic";
}

interface DomainCapability {
  capability_id: string;                      // e.g. "generate-ad-copy"
  risk_level: "low" | "medium" | "high" | "critical";
  requires_approval: boolean;
  max_automation_level: "suggestion" | "supervised" | "semi_auto" | "full_auto";
  tool_bindings: string[];                    // 关联的 tool bundle IDs
}

interface DomainConstraint {
  constraint_id: string;
  type: "regulatory" | "business_rule" | "sla" | "data_boundary";
  description: string;
  enforcement: "hard_block" | "soft_warn" | "audit_only";
}
```

**设计决策**：DomainDescriptor 不替代 BusinessPackManifest(§30)，而是作为 Pack 的**领域语义层**。一个 Pack 关联一个 DomainDescriptor，多个 Pack 可共享同一 DomainDescriptor（例如"HR 入职 Pack"和"HR 薪酬 Pack"共享 `domain_id: "hr"`）。

## 37.3 DomainRiskProfile — 领域风险画像

通用风险矩阵(§10)提供平台级默认值，DomainRiskProfile 提供**领域级覆写**，使同一动作在不同业务域下触发不同风控策略：

```typescript
interface DomainRiskProfile {
  domain_id: string;
  regulatory_class: "unregulated" | "lightly_regulated" | "regulated" | "heavily_regulated";
  time_sensitivity: "batch" | "near_realtime" | "realtime" | "ultra_realtime";
  reversibility: "fully_reversible" | "partially_reversible" | "irreversible";
  blast_radius: "single_user" | "team" | "department" | "company" | "external";

  risk_overrides: RiskOverride[];
  escalation_chain: EscalationLevel[];
  mandatory_approvals: ApprovalRule[];
}

interface RiskOverride {
  action_pattern: string;           // glob pattern, e.g. "finance.payment.*"
  base_risk: number;                // 平台默认 risk score
  domain_risk: number;              // 领域覆写 risk score
  reason: string;                   // 覆写理由（审计用）
  requires_justification: boolean;  // 是否要求 Agent 提供执行理由
}

interface EscalationLevel {
  level: number;
  trigger: string;                  // e.g. "risk_score > 80"
  target: "domain_owner" | "platform_sre" | "security_team" | "executive";
  response_sla: string;             // e.g. "5m", "1h", "24h"
}
```

**领域风险画像应用示例**：

| 场景 | 平台默认 risk | 领域覆写 risk | 结果 |
|------|-------------|-------------|------|
| `tool.http.post` | 60 | 财务域 → 90 | 强制四眼审批 |
| `tool.http.post` | 60 | 客服域 → 40 | 自动执行 |
| `tool.file.write` | 50 | 代码研发域 → 70（生产分支） | Code Review 门禁 |
| `tool.file.write` | 50 | 素材制作域 → 30 | 自动保存草稿 |

## 37.4 DomainKnowledgeSchema — 领域知识结构

定义每个业务域的知识检索策略、时效性要求和冲突解决规则，对接 §29 Knowledge/Memory 层：

```typescript
interface DomainKnowledgeSchema {
  domain_id: string;
  knowledge_sources: KnowledgeSource[];
  retrieval_strategy: RetrievalStrategy;
  freshness_policy: FreshnessPolicy;
  conflict_resolution: ConflictResolution;
}

interface KnowledgeSource {
  source_id: string;
  type: "document_store" | "api_realtime" | "database" | "embedding_index" | "structured_kb";
  priority: number;                         // 检索优先级
  refresh_interval: string;                 // e.g. "5m", "1d", "on_demand"
  auth_scope: string;                       // 访问权限范围
}

interface RetrievalStrategy {
  mode: "semantic_search" | "keyword" | "hybrid" | "structured_query" | "graph_traverse";
  top_k: number;
  rerank: boolean;
  domain_specific_filters: Record<string, string>;  // 领域级过滤条件
}

interface FreshnessPolicy {
  max_staleness: string;                    // 最大可接受陈旧度
  on_stale: "warn_and_use" | "block_and_refresh" | "fallback_to_cached";
  critical_sources: string[];               // 必须实时的数据源 ID
}

interface ConflictResolution {
  strategy: "source_priority" | "timestamp_latest" | "human_review" | "domain_rule";
  domain_rules?: Record<string, string>;    // 领域级冲突消解规则
}
```

**领域知识差异示例**：

| 业务域 | 检索模式 | 时效要求 | 冲突策略 |
|--------|---------|---------|---------|
| 代码研发 | structured_query (AST/Git) | 实时（HEAD commit） | timestamp_latest |
| 财务 | structured_query (ERP API) | 天级（T+1 对账） | human_review |
| 直播带货 | api_realtime (库存/价格) | 秒级 | source_priority（库存系统优先） |
| 企业知识库 | hybrid (语义+关键词) | 周级 | domain_rule（版本号最高优先） |

## 37.5 DomainEvalFramework — 领域评估框架

通用模型评估(§17)提供平台级质量门禁，DomainEvalFramework 定义**领域专属的质量轴和评估标准**：

```typescript
interface DomainEvalFramework {
  domain_id: string;
  quality_axes: QualityAxis[];
  automated_checks: AutomatedCheck[];
  human_eval_rubric: EvalRubric[];
  regression_dataset: RegressionDataset;
  acceptance_threshold: Record<string, number>;  // axis_id → 最低分
}

interface QualityAxis {
  axis_id: string;                          // e.g. "code_correctness", "brand_consistency"
  weight: number;                           // 归一化权重
  evaluator: "llm_judge" | "rule_engine" | "human" | "automated_test" | "metric_api";
  description: string;
}

interface AutomatedCheck {
  check_id: string;
  type: "regex" | "ast_lint" | "policy_rule" | "external_api" | "llm_classifier";
  config: Record<string, unknown>;
  blocking: boolean;                        // 是否为发布阻断项
}

interface RegressionDataset {
  dataset_id: string;
  size: number;
  refresh_cadence: string;
  golden_answer_source: "human_labeled" | "production_approved" | "expert_curated";
}
```

**领域评估维度差异**：

| 业务域 | 核心质量轴 | 自动检查 | 回归数据来源 |
|--------|-----------|---------|------------|
| 代码研发 | 编译通过、测试覆盖、安全扫描 | AST lint + 单测运行 | PR review 通过的代码 |
| 素材制作 | 品牌一致性、美学评分、尺寸合规 | 尺寸/格式校验 + LLM 美学评分 | 设计团队标注 |
| 财务 | 数值准确性、合规性、审计可追溯 | 金额校验 + 法规规则引擎 | 专家审计样本 |
| 广告投放 | CTR 预估准确性、预算合规、创意合规 | 预算上限检查 + 广告法规检查 | A/B 测试历史数据 |

## 37.6 DomainPromptLibrary — 领域 Prompt 库

对接 §16 Prompt 管理系统，为每个业务域提供**领域级 Prompt 资产**，避免散落各处的 Prompt 碎片：

```typescript
interface DomainPromptLibrary {
  domain_id: string;
  system_prompts: DomainSystemPrompt[];
  few_shot_examples: FewShotExample[];
  domain_instructions: DomainInstruction[];
  forbidden_patterns: ForbiddenPattern[];
}

interface DomainSystemPrompt {
  prompt_id: string;
  scenario: string;                         // e.g. "code_review", "invoice_processing"
  template: string;                         // 带变量占位符的 prompt 模板
  variables: PromptVariable[];
  version: string;
  eval_dataset_id: string;                  // 关联的评估数据集
}

interface FewShotExample {
  example_id: string;
  scenario: string;
  input: string;
  expected_output: string;
  quality_score: number;                    // 标注质量分
  source: "production_approved" | "expert_crafted" | "synthetic";
}

interface DomainInstruction {
  instruction_id: string;
  type: "always" | "conditional" | "fallback";
  condition?: string;                       // 触发条件表达式
  content: string;                          // 注入到 system prompt 的指令
}

interface ForbiddenPattern {
  pattern_id: string;
  regex: string;
  description: string;                      // 为什么禁止
  action: "block_response" | "redact" | "escalate";
}
```

**Prompt 库与 Prompt 管理系统(§16)的关系**：DomainPromptLibrary 是领域级 Prompt 资产，注册到 §16 的 PromptRegistry 中。Prompt 的版本化、灰度、回滚能力由 §16 提供，领域 Prompt 库只负责**内容定义和领域适配**。

## 37.7 DomainRecipe — 领域模板与原型

将常见业务域归纳为四种**原型模板**，新业务接入时选择最接近的原型，基于模板快速生成 DomainDescriptor 骨架：

| 原型 | 核心模式 | 适用业务域 | 典型 Workflow |
|------|---------|-----------|-------------|
| **CRUD-heavy** | 读→查→改→确认 | HR、客服、企业知识库 | 问题受理→查询→处理→反馈 |
| **Analytics** | 采集→分析→可视化→决策 | 数据分析、广告报表 | 数据查询→分析→生成报表→推荐行动 |
| **Creative** | 生成→审核→迭代→发布 | 素材制作、游戏资产 | 需求理解→生成→人工审核→迭代→发布 |
| **Realtime** | 监控→检测→响应→记录 | 直播带货、安全运维 | 事件流监听→异常检测→自动响应→事后复盘 |

```typescript
interface DomainRecipe {
  recipe_id: string;
  archetype: "crud_heavy" | "analytics" | "creative" | "realtime";
  name: string;
  description: string;

  scaffold: {
    entities: DomainEntity[];               // 预置实体模板
    capabilities: DomainCapability[];       // 预置能力声明
    workflows: DomainWorkflowTemplate[];    // 预置工作流
    risk_profile_template: Partial<DomainRiskProfile>;
    knowledge_schema_template: Partial<DomainKnowledgeSchema>;
    eval_axes_template: QualityAxis[];
    prompt_templates: DomainSystemPrompt[];
  };

  customization_points: CustomizationPoint[];  // 必须由业务方填充的定制点
  validation_rules: ValidationRule[];          // 定制后的校验规则
}

interface CustomizationPoint {
  path: string;                             // JSON path, e.g. "entities[0].operations"
  required: boolean;
  description: string;
  default_value?: unknown;
}
```

**使用流程**：

1. 业务方通过 CLI 选择原型：`agent-platform domain init --archetype=crud_heavy --name=hr`
2. 系统生成 DomainDescriptor 骨架，标记所有 `customization_points`
3. 业务方填充必填项（实体、工具绑定、审批规则等）
4. CLI 运行 `agent-platform domain validate` 校验完整性
5. 通过后进入 §38 接入 Runbook 流程

## 37.8 DomainInteractionPolicy — 跨域交互策略

当多个业务域的 Agent 需要协作时（例如广告域 Agent 调用数据分析域 Agent 生成报表），需要明确的**边界策略和补偿机制**：

```typescript
interface DomainInteractionPolicy {
  source_domain: string;
  target_domain: string;

  data_flow: DataFlowRule[];
  delegation_rules: CrossDomainDelegation;
  compensation: CompensationStrategy;
}

interface DataFlowRule {
  data_class: string;                       // e.g. "user_pii", "financial_data"
  direction: "source_to_target" | "target_to_source" | "bidirectional";
  allowed: boolean;
  transform?: "anonymize" | "aggregate" | "redact_fields";
  requires_consent: boolean;
}

interface CrossDomainDelegation {
  allowed: boolean;
  max_depth: number;                        // 跨域委托最大深度
  permission_model: "inherit" | "intersect" | "explicit_grant";
  timeout: string;
  audit_level: "basic" | "full";
}

interface CompensationStrategy {
  on_target_failure: "retry" | "rollback_source" | "human_review" | "log_and_continue";
  on_timeout: "cancel_both" | "cancel_target_only" | "escalate";
  max_retries: number;
}
```

**跨域交互矩阵示例**：

| 源域 → 目标域 | 数据流向 | 委托 | 失败策略 |
|-------------|---------|------|---------|
| 广告 → 数据分析 | 聚合数据，禁 PII | 允许(depth=1) | retry(3) → human_review |
| HR → 财务 | 薪酬数据，加密传输 | 允许(depth=1, intersect) | rollback_source |
| 直播 → 库存 | 实时库存查询 | 禁止(只读 API) | fallback 缓存 |
| 代码研发 → 安全运维 | 代码扫描结果 | 允许(depth=1) | log_and_continue |

## 37.9 DomainGovernancePolicy — 领域治理模型

每个业务域必须有明确的**治理归属**，包括 ownership、SLO、预算和变更管理：

```typescript
interface DomainGovernancePolicy {
  domain_id: string;

  ownership: {
    domain_owner: string;                   // 业务域负责人（人/团队）
    platform_liaison: string;               // 平台侧对接人
    escalation_contact: string;             // 紧急联系人
  };

  slo: {
    availability: string;                   // e.g. "99.9%"
    p95_latency: string;                    // e.g. "5s"（含 LLM）
    error_rate: string;                     // e.g. "< 1%"
    eval_quality_floor: number;             // 领域评估最低分
  };

  budget: {
    monthly_token_quota: number;            // 月度 token 预算
    monthly_cost_cap: string;               // 月度成本上限
    burst_allowance: number;                // 突发流量允许倍率
    chargeback_cost_center: string;         // 成本归属中心
  };

  change_management: {
    prompt_change_approval: "domain_owner" | "platform_team" | "both";
    tool_addition_approval: "domain_owner" | "security_team" | "both";
    risk_profile_change_approval: "platform_team";
    rollout_strategy: "canary_10_50_100" | "blue_green" | "immediate";
  };
}
```

**治理模型与平台能力的映射**：

| 治理维度 | 平台能力对接 | 自动化程度 |
|---------|------------|----------|
| Ownership | §6 API 权限 + §11 IAM | 全自动（RBAC） |
| SLO | §27 SLO 监控 + Error Budget | 全自动（告警+降级） |
| Budget | §18 Token 计量 + 预算强制 | 全自动（配额+熔断） |
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

| 当前状态 | 可转移至 | 条件 |
|---------|---------|------|
| Draft | Validated | `agent-platform domain validate` 全部通过 |
| Validated | Registered | 安全审查 + 平台兼容性检查通过 |
| Registered | Active | 至少一个关联 Pack 发布成功 |
| Active | Updating | 业务方提交新版本 descriptor |
| Updating | Active | 新版本校验+注册通过 |
| Active | Deprecated | domain_owner 发起废弃，审批通过 |
| Deprecated | Archived | 所有关联 Pack 迁移或下线完成 |

---

# 38. 业务域接入 Runbook

> v2.2 新增。定义新业务域从零到生产的标准化接入流程。
> 关联：§37 业务域建模 · §30 Business Pack · §22 SDK/DX · §34 ADR

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

| 阶段 | 负责方 | 产出物 | 门禁条件 |
|------|--------|-------|---------|
| Phase 1 | 业务方 + 平台 Liaison | DomainDescriptor + RiskProfile + GovernancePolicy | 平台架构评审通过 |
| Phase 2 | 业务方 | Pack 代码 + 单元测试 + 集成测试 + eval dataset | 测试覆盖 ≥ 80% + eval 通过 |
| Phase 3 | 安全团队 + 平台团队 | CertificationRecord + 风险评审记录 | 安全扫描无 Critical/High + 风险评审通过 |
| Phase 4 | 平台 SRE + 业务方 | RolloutRecord + 监控 Dashboard | canary 7 天无 P0/P1 + eval 质量不退化 |

## 38.2 Phase 1：领域建模

**目标**：业务方与平台团队协作，产出结构化的 DomainDescriptor。

**步骤**：

| # | 活动 | 执行者 | 产出 | 工具 |
|---|------|-------|------|------|
| 1 | 选择领域原型(§37.7) | 业务方 | Recipe 选择 | `agent-platform domain init` |
| 2 | 填充领域实体和能力 | 业务方 | entities + capabilities | YAML/JSON 编辑 |
| 3 | 定义领域风险画像 | 业务方 + 安全 | DomainRiskProfile | 风险评估模板 |
| 4 | 定义知识来源和检索策略 | 业务方 + 数据 | DomainKnowledgeSchema | 知识源清单模板 |
| 5 | 定义评估维度和标准 | 业务方 + AI | DomainEvalFramework | eval 模板 |
| 6 | 构建领域 Prompt 库 | 业务方 + AI | DomainPromptLibrary | Prompt 工程模板 |
| 7 | 确定治理归属 | 业务负责人 | DomainGovernancePolicy | 治理契约模板 |
| 8 | 校验完整性 | 业务方 | 校验报告 | `agent-platform domain validate` |

**Gate 1 检查清单**：

- [ ] DomainDescriptor 所有必填字段已填充
- [ ] 至少 5 个 few-shot examples 已标注
- [ ] 风险画像已经过安全团队初审
- [ ] 知识源已确认可达且有授权
- [ ] eval dataset ≥ 20 条（含 golden answer）
- [ ] 治理契约已由 domain_owner 签署
- [ ] 跨域交互策略已与相关域确认（如有）
- [ ] 平台架构评审会议通过

## 38.3 Phase 2：开发验证

**目标**：基于 DomainDescriptor 开发 Business Pack，通过本地和 staging 环境验证。

**步骤**：

| # | 活动 | 执行者 | 产出 | 工具 |
|---|------|-------|------|------|
| 1 | 初始化 Pack 工程 | 业务方 | Pack 代码骨架 | `agent-platform pack create --domain=<id>` |
| 2 | 实现 Tool 适配器 | 业务方 | Tool bundle 代码 | Pack SDK(§22) |
| 3 | 编写单元测试 | 业务方 | 测试用例 | 标准测试框架 |
| 4 | 本地 Mock 测试 | 业务方 | 本地测试报告 | `agent-platform pack test --local` |
| 5 | 构建 eval dataset | 业务方 + AI | 评估数据集 | eval 工具链 |
| 6 | Staging 集成测试 | 业务方 + SRE | 集成测试报告 | staging 环境 |
| 7 | 运行领域评估 | 业务方 | eval 质量报告 | `agent-platform eval run --domain=<id>` |

**Gate 2 检查清单**：

- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 领域 eval 所有质量轴达到 acceptance_threshold
- [ ] 无已知 P0/P1 Bug
- [ ] Pack Manifest 与 DomainDescriptor 一致性校验通过
- [ ] Tool 权限声明与风险画像匹配

## 38.4 Phase 3：安全认证

**目标**：安全团队和平台团队对 Pack 进行安全审查和风险评估。

| # | 检查项 | 执行者 | 标准 |
|---|--------|-------|------|
| 1 | 静态代码扫描 | 自动化 | 无 Critical/High 漏洞 |
| 2 | 依赖漏洞扫描 | 自动化 | 无已知 CVE（Critical） |
| 3 | Sandbox 逃逸测试 | 安全团队 | 无逃逸路径 |
| 4 | Prompt Injection 测试 | 安全团队 | 注入防护有效 |
| 5 | 数据泄露测试 | 安全团队 | 无 PII/凭证泄露 |
| 6 | 风险画像一致性 | 平台团队 | RiskProfile 与实际行为匹配 |
| 7 | 跨域策略合规 | 安全团队 | DataFlowRule 执行正确 |
| 8 | 合规性审查(§23) | 合规团队 | 满足行业监管要求 |

**Gate 3 检查清单**：

- [ ] 所有安全扫描通过
- [ ] Prompt Injection 防护覆盖率 100%
- [ ] 风险画像评审记录已归档
- [ ] CertificationRecord 已签发
- [ ] 合规团队无阻断意见

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

| 指标 | 阈值 | 不达标动作 |
|------|------|----------|
| Error rate | < 1% | 自动回滚 |
| P95 latency | < domain SLO | 告警 + 人工决策 |
| Eval quality | ≥ acceptance_threshold | 自动回滚 |
| Token cost | < budget × (canary%) | 告警 + 人工决策 |
| 用户反馈 negative | < 5% | 暂停灰度 + 人工评审 |

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

| 活动 | 频率 | 负责方 | 触发条件 |
|------|------|--------|---------|
| Eval 回归测试 | 每日 | 自动 | 定时 + Prompt 变更后 |
| 成本报表 | 每周 | 自动 → domain_owner | 定时 |
| SLO 报告 | 每月 | 自动 → domain_owner + SRE | 定时 |
| 安全扫描 | 每月 | 自动 | 定时 + 依赖更新时 |
| DomainDescriptor 审查 | 每季度 | 业务方 + 平台 | 定时 |
| 知识源时效性检查 | 按 freshness_policy | 自动 | 持续 |
| 跨域策略审查 | 每季度 | 安全团队 | 定时 + 新域接入时 |

---

# 39. 自然语言任务入口架构

> v2.3 新增。使非技术用户通过自然语言直接与平台交互，替代手写 JSON/API 调用。
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

```typescript
interface IntentParseResult {
  raw_input: string;
  detected_intents: DetectedIntent[];
  confidence: number;
  requires_clarification: boolean;
  clarification_questions?: string[];
}

interface DetectedIntent {
  intent_type: "task_create" | "task_query" | "task_modify" | "system_config" | "status_inquiry" | "approval_action";
  domain_hint: string | null;
  entities: ExtractedEntity[];
  urgency: "low" | "normal" | "high" | "critical";
  confidence: number;
}

interface ExtractedEntity {
  entity_type: string;        // e.g. "date_range", "department", "metric_name"
  value: string;
  normalized: unknown;        // 标准化后的值
  source_span: [number, number];  // 原文位置
}

interface TaskBuildResult {
  request_envelope: RequestEnvelope;   // §5.3 标准契约
  risk_preview: RiskPreview;           // 执行前风险预览
  cost_estimate: CostEstimate;         // 预估成本
  confirmation_required: boolean;      // 是否需要用户确认
  human_summary: string;               // "我将为你做 X，预计花费 ¥Y，风险等级 Z"
}

interface RiskPreview {
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_factors: string[];              // 人类可读的风险因素
  reversible: boolean;
  side_effects: string[];              // 预期副作用描述
  approval_needed: boolean;
}
```

## 39.4 歧义消解策略

| 歧义类型 | 示例 | 消解方式 |
|---------|------|---------|
| 域歧义 | "做一份报表" | 追问"是财务报表还是广告报表？" |
| 范围歧义 | "清理过期数据" | 追问"清理哪个域的数据？时间范围？" |
| 风险歧义 | "更新产品价格" | 展示风险预览 + 确认"这会影响线上 X 个商品" |
| 时间歧义 | "尽快完成" | 映射为 urgency=high，告知预计完成时间 |
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

| 层次 | 国际化策略 |
|------|-----------|
| Intent Parser | 多语言意图识别：通过 ModelGateway(§15) 调用支持多语言的 LLM；语言检测后路由到对应 locale 的 Prompt 模板 |
| Clarification Dialog | 响应语言跟随用户输入语言（auto-detect），或遵循用户 profile 中的 `preferred_locale` 设置 |
| Risk Preview | 风险描述、成本预估使用用户 locale 的货币/日期格式 |
| NL 状态摘要(§43) | 看板摘要按用户 locale 生成；金额/日期/数字遵循 ICU 格式 |
| 错误消息 | 平台标准错误码映射到多语言 message catalog；fallback 语言为 en-US |

```typescript
interface LocaleConfig {
  supported_locales: string[];         // e.g. ["zh-CN", "en-US", "ja-JP", "de-DE"]
  default_locale: string;              // fallback
  locale_resolution_order: ("user_profile" | "accept_language" | "input_detect" | "default")[];
}
```

---

# 40. 目标分解引擎架构

> v2.3 新增。在 OAPEFLIR(§13) 之上增加 Goal → Task 分解层，使用户可以描述业务目标而非单个任务。
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

```typescript
interface Goal {
  goal_id: string;
  description: string;                     // NL 描述或结构化描述
  owner: string;                           // 目标发起人
  deadline?: string;                       // 期望完成时间
  success_criteria: SuccessCriterion[];    // 成功标准
  constraints: string[];                   // 约束条件
  priority: "low" | "normal" | "high" | "critical";
}

interface SuccessCriterion {
  metric: string;                          // e.g. "ad_roi", "completion_rate"
  target: string;                          // e.g. "> 2.0", "100%"
  evaluation_method: "metric_api" | "human_review" | "automated_test";
}

interface GoalDecomposition {
  goal_id: string;
  tasks: PlannedTask[];
  dependency_graph: TaskDependency[];
  estimated_duration: string;
  estimated_cost: CostEstimate;
  risk_summary: RiskPreview;
  decomposition_confidence: number;        // 分解置信度
  requires_human_review: boolean;          // 低置信度时请求人工审核
}

interface PlannedTask {
  task_id: string;
  domain_id: string;                       // 目标域
  description: string;
  inputs: Record<string, unknown>;
  expected_outputs: string[];
  delegation_mode: "auto" | "supervised" | "manual";
  estimated_duration: string;
  estimated_cost: CostEstimate;
}

interface TaskDependency {
  from_task: string;
  to_task: string;
  type: "blocks" | "provides_input" | "soft_dependency";
  data_contract?: string;                  // 跨任务数据契约
}
```

## 40.3 分解策略

| 策略 | 适用场景 | 机制 |
|------|---------|------|
| **模板匹配** | 目标匹配已有 DomainRecipe(§37.7) 或跨域模板 | 直接实例化模板，填充参数 |
| **LLM 规划** | 无匹配模板的新场景 | 调用 ModelGateway(§15) 进行分解，受 DomainDescriptor 约束 |
| **混合式** | 部分匹配 | 模板骨架 + LLM 填充缺失环节 |
| **人工辅助** | 置信度 < 0.7 或涉及 critical 风险 | 生成初步分解方案，请求人工审核和调整 |

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

| 状态 | 说明 | 可转移至 |
|------|------|---------|
| draft | 目标创建，尚未分解 | decomposing, cancelled |
| decomposing | 正在分解为 Task | decomposed, failed |
| decomposed | 分解完成，等待确认 | executing, cancelled |
| executing | Task 正在执行中 | completed, partially_completed, failed |
| completed | 所有 Task + 成功标准达成 | archived |
| partially_completed | 部分 Task 完成，部分失败 | executing(retry), completed, cancelled |
| failed | 分解或执行失败 | decomposing(retry), cancelled |
| cancelled | 用户取消 | archived |

---

# 41. 主动式 Agent 框架

> v2.3 新增。使 Agent 能基于事件触发和定时调度主动发起任务，而非仅响应 API 调用。
> 关联：§4.2 P1 Interface Plane · §20 长时任务 · §37 业务域建模 · §40 目标分解

## 41.1 设计原则

- 主动式 Agent 是**受控的自动化**，不是不受约束的自主行为
- 所有触发器必须在 DomainDescriptor(§37) 中声明，未声明的触发器不允许注册
- 触发产生的任务与 API 创建的任务走**完全相同的风控管线**(§10)
- 主动行为产生的成本计入对应 domain 的预算(§18)

## 41.2 触发器模型

```typescript
interface TriggerDefinition {
  trigger_id: string;
  domain_id: string;
  name: string;
  type: TriggerType;
  config: ScheduleTriggerConfig | EventTriggerConfig | ThresholdTriggerConfig;
  action: TriggerAction;
  enabled: boolean;
  risk_level: "low" | "medium" | "high" | "critical";
  max_fire_rate: string;           // e.g. "10/hour" — 防止触发风暴
  cooldown: string;                // 两次触发间最小间隔
}

type TriggerType = "schedule" | "event" | "threshold" | "webhook_inbound";

interface ScheduleTriggerConfig {
  cron: string;                    // cron 表达式
  timezone: string;
  skip_if_previous_running: boolean;
}

interface EventTriggerConfig {
  event_source: string;            // 事件源标识
  event_pattern: string;           // 事件匹配模式
  filter: Record<string, string>;  // 事件字段过滤
  batch_window?: string;           // 批量窗口，合并短时间内多个事件
}

interface ThresholdTriggerConfig {
  metric_source: string;           // 指标源
  metric_name: string;
  condition: "gt" | "lt" | "eq" | "change_rate_gt";
  threshold: number;
  evaluation_window: string;       // 评估窗口
  consecutive_breaches: number;    // 连续违规次数才触发
}

interface TriggerAction {
  action_type: "create_task" | "create_goal" | "suggest_to_user" | "update_dashboard";
  template: Partial<RequestEnvelope> | Partial<Goal>;
  require_confirmation: boolean;   // true = 建议模式，false = 自动执行
}
```

## 41.3 触发模式

| 模式 | 行为 | 适用场景 | 风险控制 |
|------|------|---------|---------|
| **自动执行** | 触发后直接创建任务 | 低风险定时任务（日报生成、数据同步） | require_confirmation=false + risk_level=low |
| **建议模式** | 触发后向用户推送建议，用户确认后执行 | 中高风险事件响应（CTR 下降→建议调整出价） | require_confirmation=true |
| **静默记录** | 触发后仅记录事件和分析结果，不主动通知 | 数据积累（用户行为模式识别） | action_type=update_dashboard |

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

> v2.3 新增。基于历史绩效数据驱动 Agent 自主权的动态晋升/降级，减少人工监督负担。
> 关联：§10 风险控制 · §17 模型评估 · §21 人机协作 · §37.2 DomainCapability · §41 主动 Agent

## 42.1 信任积分模型

```typescript
interface AgentTrustProfile {
  agent_id: string;
  domain_id: string;
  capability_scores: CapabilityTrustScore[];
  overall_trust_level: TrustLevel;
  history: TrustEvent[];
  last_evaluation: string;        // ISO timestamp
}

type TrustLevel = "untrusted" | "probation" | "supervised" | "semi_trusted" | "trusted" | "fully_trusted";

interface CapabilityTrustScore {
  capability_id: string;
  current_autonomy: AutonomyLevel;
  trust_score: number;            // 0-100
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  human_overrides: number;        // 人工覆写次数
  incidents: number;              // 引发 incident 次数
  last_incident_age: string;      // 距上次 incident 的时间
  promotion_eligible: boolean;
  demotion_risk: boolean;
}

type AutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto";
```

## 42.2 自主权晋升/降级规则

```typescript
interface AutonomyRule {
  from_level: AutonomyLevel;
  to_level: AutonomyLevel;
  direction: "promotion" | "demotion";
  conditions: AutonomyCondition[];
  approval_required: "none" | "domain_owner" | "platform_team";
  cooldown_after_change: string;   // 变更后冷却期，防止频繁波动
}

interface AutonomyCondition {
  metric: "success_rate" | "incident_count" | "human_override_rate" | "consecutive_successes" | "time_since_last_incident";
  operator: "gte" | "lte" | "eq";
  value: number;
  window: string;                  // 评估窗口, e.g. "30d"
}
```

**默认晋升阶梯**：

| 当前级别 | 晋升至 | 条件 | 审批 |
|---------|-------|------|------|
| suggestion | supervised | ≥ 50 次执行 + 成功率 ≥ 95% + 0 incident(30d) | domain_owner |
| supervised | semi_auto | ≥ 200 次执行 + 成功率 ≥ 98% + 人工覆写率 < 5% + 0 incident(60d) | domain_owner |
| semi_auto | full_auto | ≥ 500 次执行 + 成功率 ≥ 99% + 人工覆写率 < 1% + 0 incident(90d) | platform_team |

**即时降级触发器**：

| 事件 | 降级动作 | 恢复条件 |
|------|---------|---------|
| 引发 P0 Incident | 直接降至 suggestion | 人工调查 + platform_team 审批 |
| 引发 P1 Incident | 降一级 | 30d 无 incident |
| 连续 3 次失败 | 降一级 | 10 次连续成功 |
| 成本超预算 200% | 降至 supervised | 预算调整 + domain_owner 确认 |

## 42.3 自主权变更审计

所有自主权变更记录到 event_log(§28)：

```typescript
interface AutonomyChangeEvent {
  event_type: "agent.autonomy.promoted" | "agent.autonomy.demoted" | "agent.autonomy.frozen";
  agent_id: string;
  capability_id: string;
  from_level: AutonomyLevel;
  to_level: AutonomyLevel;
  trigger: "rule_engine" | "manual" | "incident_response";
  evidence: {
    success_rate: number;
    total_executions: number;
    incident_count: number;
    evaluation_window: string;
  };
  approved_by: string | "auto";
}
```

## 42.4 与现有架构的集成

| 现有组件 | 集成方式 |
|---------|---------|
| §10 风险控制 | trust_score 作为 risk_score 的调节因子——高信任 Agent 的相同动作 risk 更低 |
| §17 模型评估 | eval 质量退化自动触发信任降级 |
| §21 HITL | 自主权决定 HITL 模式——suggestion 级必须人工确认，full_auto 级静默执行 |
| §37.2 DomainCapability | `max_automation_level` 作为天花板——信任再高也不能超过域设定的上限 |
| §41 主动 Agent | 只有 semi_auto 以上才允许自动执行触发器，否则走建议模式 |

---

# 43. 统一运营看板架构

> v2.3 新增。为一人公司到万人企业提供分层运营视图，替代面向 SRE 的基础设施级 metrics。
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

```typescript
interface OperatorDashboard {
  attention_queue: AttentionItem[];        // "需要你关注"队列
  daily_summary: DailySummary;             // 今日摘要
  agent_health_cards: AgentHealthCard[];   // Agent 健康卡片
  cost_burn: CostBurnRate;                 // 成本燃烧率
  active_goals: GoalProgress[];            // 活跃目标进度
  recent_completions: CompletionRecord[];  // 最近完成的任务
  proactive_suggestions: Suggestion[];     // 主动建议(§41)
}

interface AttentionItem {
  item_type: "approval_needed" | "incident" | "budget_warning" | "quality_alert" | "suggestion";
  priority: "low" | "normal" | "high" | "critical";
  title: string;                           // 人类可读标题
  description: string;                     // 一句话描述
  action_options: ActionOption[];          // 可执行的操作（一键操作）
  created_at: string;
  domain_id: string;
}

interface DailySummary {
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_failed: number;
  total_cost_today: string;
  agent_uptime_percent: number;
  highlights: string[];                    // NL 生成的今日亮点
  concerns: string[];                      // NL 生成的关注点
}

interface AgentHealthCard {
  agent_id: string;
  domain_id: string;
  name: string;
  status: "healthy" | "degraded" | "failing" | "paused";
  trust_level: TrustLevel;                // §42
  tasks_today: number;
  success_rate_7d: number;
  cost_7d: string;
  trend: "improving" | "stable" | "declining";
}
```

## 43.3 L2 域管理视图

面向部门 Agent 管理员的域运营视图：

```typescript
interface DomainAdminDashboard {
  domain_id: string;
  agent_inventory: AgentInventoryItem[];
  performance_matrix: {
    agent_id: string;
    success_rate_7d: number;
    avg_latency_ms: number;
    cost_7d: string;
    autonomy_level: AutonomyLevel;
    trend: "improving" | "stable" | "declining";
  }[];
  active_workflows: WorkflowSummary[];
  pending_approvals: ApprovalItem[];
  domain_budget: { allocated: string; consumed: string; forecast: string };
  knowledge_health: { total_docs: number; stale_docs: number; last_refresh: string };
  eval_quality_trend: { date: string; pass_rate: number }[];
}

interface AgentInventoryItem {
  agent_id: string;
  name: string;
  version: string;
  status: "active" | "paused" | "deprecated" | "draft";
  autonomy_level: AutonomyLevel;
  capabilities: string[];
  last_execution: string;
}
```

## 43.4 L3 平台运维视图

面向 SRE 团队的基础设施运维视图：

```typescript
interface PlatformOpsDashboard {
  infrastructure_health: {
    component: string;
    status: "healthy" | "degraded" | "down";
    uptime_30d: number;
    error_budget_remaining: number;
  }[];
  worker_pool_status: {
    total: number; idle: number; busy: number; unhealthy: number;
  };
  queue_metrics: {
    queue_name: string; depth: number; avg_wait_ms: number; dlq_count: number;
  }[];
  circuit_breaker_states: {
    target: string; state: "closed" | "open" | "half_open"; since: string;
  }[];
  storage_metrics: {
    event_log_size: string; growth_rate: string; retention_compliance: boolean;
  };
  active_incidents: IncidentSummary[];
  recovery_jobs: { type: string; status: string; last_run: string }[];
  model_gateway_health: {
    provider: string; status: string; p99_latency_ms: number; error_rate: number;
  }[];
}
```

## 43.5 L4 舰队管理视图

面向万人企业平台团队的全局运维视图：

```typescript
interface FleetDashboard {
  platform_health: PlatformHealthScore;
  department_overview: DepartmentStatus[];
  resource_utilization: ResourceUtilization;
  global_incident_map: IncidentHeatmap;
  version_drift: VersionDriftReport;
  capacity_forecast: CapacityForecast;
  top_cost_consumers: CostRanking[];
  cross_department_workflows: CrossDeptWorkflowStatus[];
}

interface DepartmentStatus {
  department_id: string;
  agent_count: number;
  active_workflows: number;
  health_score: number;                    // 0-100 复合分
  sla_compliance: number;                  // SLA 达标率
  cost_budget_usage: number;               // 预算使用比例
  incidents_open: number;
  attention_items: number;
}

interface PlatformHealthScore {
  overall: number;                         // 0-100
  components: {
    api_gateway: number;
    dispatcher: number;
    worker_pool: number;
    model_gateway: number;
    event_bus: number;
    storage: number;
  };
  degraded_components: string[];
}
```

## 43.6 NL 状态摘要生成

看板支持自然语言摘要，由 ModelGateway(§15) 生成：

- **每日简报**："今天 5 个 Agent 完成 23 个任务（成功率 96%），花费 ¥45。广告域 Agent 表现优秀（ROI 2.8x）。有 2 个审批等待你处理，1 个预算告警需要关注。"
- **异常简报**："过去 1 小时，客服域 Agent 成功率从 95% 降至 78%，主要原因是知识库 API 响应变慢。已自动降级到缓存模式。建议你检查知识库服务状态。"
- **离开回来简报**："你离开的 8 小时内：完成 12 个任务，花费 ¥80。财务域有 1 个 P1 Incident（已自动恢复）。3 个审批已超时自动处理。无需立即行动。"

---

# 44. 非技术用户体验架构

> v2.3 新增。使非开发者（业务负责人、独立运营者）能通过可视化界面使用平台全部能力。
> 关联：§22 SDK/DX · §38 接入 Runbook · §39 NL 入口 · §43 看板

## 44.1 用户角色分层

| 角色 | 技术水平 | 主要交互方式 | 看板层级 |
|------|---------|------------|---------|
| 独立运营者 | 非技术 | NL 对话(§39) + L1 看板(§43) | L1 |
| 业务线负责人 | 非技术 | L1 看板 + 可视化配置 | L1 |
| 域管理员 | 低代码 | 可视化配置 + 偶尔 CLI | L2 |
| Pack 开发者 | 技术 | SDK + CLI(§22) | L2/L3 |
| 平台 SRE | 技术 | CLI + Admin API + L3/L4 看板 | L3/L4 |

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

| 传统方式(§38) | 可视化方式(§44) |
|--------------|---------------|
| `agent-platform domain init --archetype=crud_heavy` | 卡片选择"客户服务类" |
| 手动编辑 DomainDescriptor YAML | 表单填写 + 智能推荐 |
| `agent-platform domain validate` | 实时校验 + 红绿灯提示 |
| 多团队协作 5-9 周 | 向导引导 1-3 天（低风险域） |

## 44.3 可视化 Workflow 构建器

面向非技术用户的 workflow 编排界面：

```typescript
interface VisualWorkflowBuilder {
  canvas: WorkflowCanvas;
  component_palette: ComponentCategory[];
  live_preview: WorkflowPreview;
  validation: RealTimeValidation;
}

interface ComponentCategory {
  category: "trigger" | "action" | "condition" | "approval" | "output";
  components: DraggableComponent[];
}

interface DraggableComponent {
  component_id: string;
  name: string;                            // e.g. "发送邮件", "查询数据", "生成报告"
  icon: string;
  domain_id: string;
  risk_level: "low" | "medium" | "high";
  config_schema: Record<string, unknown>;  // 可视化配置 schema
  preview_description: string;             // "这个组件会..."
}

interface WorkflowPreview {
  estimated_duration: string;
  estimated_cost: string;
  risk_assessment: string;
  step_by_step_description: string[];      // NL 描述每一步做什么
}
```

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

| 维度 | 单人模式 | 企业模式 |
|------|---------|---------|
| 租户 | 自动创建单租户，隐藏 tenant 概念 | 完整多租户管理 |
| 审批 | 自审批（低/中风险自动通过，高风险弹窗确认） | 完整审批流引擎(§21) |
| 安全审查 | 内置安全检查自动运行，无需人工安全团队 | 独立安全团队审查 |
| 接入流程 | 向导引导 3 分钟 | 四阶段 Runbook(§38) |
| 看板 | L1 操作者视图 only | L1-L4 全层级 |
| 成本 | 个人预算视图 + 省钱建议 | 部门级 chargeback |
| 治理 | 简化（自己是 domain_owner） | 完整组织治理 |

```typescript
interface PlatformMode {
  mode: "solo" | "team" | "department" | "enterprise";
  auto_detected: boolean;
  features: {
    multi_tenancy: boolean;
    approval_engine: "self_approve" | "simple" | "full";
    security_review: "auto_only" | "auto_plus_manual" | "full_team";
    onboarding: "wizard_3min" | "guided_1week" | "runbook_full";
    dashboard_levels: ("L1" | "L2" | "L3" | "L4")[];
    governance: "self" | "delegated" | "hierarchical";
  };
  upgrade_path: string;           // 升级到下一模式的指引
}
```

## 44.6 无障碍访问（WCAG 2.1 AA）

| WCAG 原则 | 平台实施 |
|-----------|---------|
| 可感知 | 所有图表提供 alt text / 数据表替代视图；颜色不作为唯一信息载体（搭配形状/标签） |
| 可操作 | 全部功能可通过键盘操作（Tab 顺序、Enter 确认、Esc 取消）；NL 入口支持语音输入(§68) |
| 可理解 | 错误消息明确指出问题和修复建议；表单标签与输入显式关联 |
| 健壮性 | 语义化 HTML；ARIA 标注关键交互控件（看板卡片、审批按钮、workflow 画布节点） |

**审计与测试**：每次前端发布前自动运行 axe-core 扫描；WCAG AA 违规视为 release blocker。

---

# 46. 组织层次模型

> v2.4 新增。在 tenant/domain/pack 之上叠加 company/division/department/team 组织架构层，驱动审批、预算、隔离、合规的分层治理。
> 关联：§11 安全 · §18 成本 · §21 HITL · §37 业务域 · §47 审批路由 · §48 SSO/SCIM

## 46.1 组织模型

```typescript
interface OrganizationNode {
  node_id: string;
  node_type: "company" | "division" | "department" | "team";
  name: string;
  parent_id: string | null;
  manager: string;                         // principal ID
  cost_center: string;
  metadata: Record<string, string>;
}

interface OrgChart {
  root: OrganizationNode;                  // company
  nodes: OrganizationNode[];
  reporting_chains: ReportingChain[];      // 汇报链
  sync_source: "scim" | "manual" | "hr_api";
  last_synced: string;
}

interface ReportingChain {
  employee_id: string;
  chain: string[];                         // [direct_manager, skip_level, ..., CEO]
}
```

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

| 组织层级 | 平台映射 | 治理权限 |
|---------|---------|---------|
| company | platform config | 全局策略、平台级 SLO、合规总纲 |
| division | tenant_group | 事业部预算、跨部门 workflow 策略 |
| department | tenant | 部门预算、部门 SLO、域管理、审批链 |
| team | domain/pack | 域配置、Pack 开发、日常运营 |

## 46.3 组织变更自动适配

| 组织变更事件 | 平台自动响应 |
|------------|------------|
| 员工入职 | SCIM 同步 → 创建 principal → 分配到 team → 继承 team 权限 |
| 员工调动 | 更新 reporting_chain → 调整 tenant/domain 权限 → 迁移审批委托 |
| 员工离职 | SCIM deprovisioning → 撤销所有权限 → 转移 domain_owner → 审计记录 |
| 部门合并 | 合并 tenant → 合并预算 → 重新计算 SLO → 迁移 Pack 归属 |
| 组织重组 | 重建 reporting_chain → 刷新审批路由 → 通知受影响的 domain_owner |

---

# 47. 组织架构审批路由

> v2.4 新增。基于 org-chart 的动态审批路由，替代静态 approver list。
> 关联：§21 HITL · §46 组织层次 · §10 风险控制

## 47.1 动态审批路由引擎

```typescript
interface ApprovalRoutingRule {
  rule_id: string;
  domain_id: string;
  trigger_condition: string;               // 触发条件表达式
  routing_strategy: RoutingStrategy;
}

type RoutingStrategy =
  | OrgChartRouting
  | AmountBasedRouting
  | SodRouting;                            // Segregation of Duties

interface OrgChartRouting {
  type: "org_chart";
  start_from: "initiator_manager" | "domain_owner" | "cost_center_owner";
  escalation_levels: number;               // 向上升级几层
  skip_conditions?: string[];              // 跳过条件（如"manager = initiator"时跳到 skip-level）
}

interface AmountBasedRouting {
  type: "amount_based";
  thresholds: AmountThreshold[];
}

interface AmountThreshold {
  max_amount: number;
  currency: string;
  approver_level: "auto" | "manager" | "director" | "vp" | "cxo";
  requires_sod: boolean;                   // 是否要求职责分离
}

interface SodRouting {
  type: "segregation_of_duties";
  initiator_cannot_approve: boolean;
  same_team_cannot_approve: boolean;
  minimum_approvers: number;
  from_different_departments: boolean;
}
```

## 47.2 审批额度矩阵

| 风险金额 | 自动 | Manager | Director | VP | CFO/CTO |
|---------|------|---------|----------|----|---------| 
| < ¥1,000 | ✓ | | | | |
| ¥1K-10K | | ✓ | | | |
| ¥10K-100K | | | ✓ | | |
| ¥100K-1M | | | | ✓ | |
| > ¥1M | | | | | ✓ |

## 47.3 不在位自动代理

```typescript
interface DelegationOfAuthority {
  delegator: string;                       // 授权人
  delegate: string;                        // 代理人
  scope: "all" | "domain_specific" | "amount_limited";
  max_amount?: number;
  valid_from: string;
  valid_until: string;
  auto_activated_by: "calendar_ooo" | "manual" | "scim_status";
  audit_trail: boolean;
}
```

当审批人不在位时，系统按以下优先级寻找代理：
1. 显式委托代理人（DelegationOfAuthority）
2. org-chart 向上一级（skip-level manager）
3. 同级别同部门 peer（如配置允许）
4. 超时后执行 ApprovalTimeoutPolicy(§21)

---

# 48. 企业 SSO/SCIM 集成架构

> v2.4 新增。与企业身份提供商集成，实现自动用户生命周期管理。
> 关联：§6.5 认证 · §11 安全 · §46 组织层次

## 48.1 身份集成协议

| 协议 | 用途 | 优先级 |
|------|------|--------|
| **OIDC** | SSO 登录（已有 §6.5） | 已支持 |
| **SAML 2.0** | SSO 登录（传统企业 IdP） | v2.4 新增 |
| **SCIM 2.0** | 用户/组自动同步 | v2.4 新增 |
| **HR API** | 组织架构同步（可选） | v2.4 新增 |

## 48.2 SCIM 集成模型

```typescript
interface ScimIntegration {
  idp_type: "azure_ad" | "okta" | "ping" | "onelogin" | "custom";
  scim_endpoint: string;
  sync_mode: "push" | "pull" | "bidirectional";
  sync_interval: string;

  mapping: {
    user_to_principal: FieldMapping[];     // IdP user → 平台 principal
    group_to_role: GroupRoleMapping[];     // IdP group → 平台 role
    group_to_org_node: GroupOrgMapping[];  // IdP group → 组织架构节点(§46)
  };

  lifecycle: {
    on_create: "auto_provision" | "pending_approval";
    on_update: "auto_sync" | "manual_review";
    on_deactivate: "immediate_revoke" | "grace_period_7d";
    on_delete: "soft_delete" | "hard_delete_after_90d";
  };
}

interface GroupRoleMapping {
  idp_group_pattern: string;               // glob pattern
  platform_roles: string[];
  tenant_scope: string;                    // 映射到哪个 tenant
  auto_create_tenant: boolean;
}
```

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

> v2.4 新增。使不同部门可执行不同合规框架（SOX + HIPAA + PCI-DSS + GDPR 共存）。
> 关联：§23 合规 · §37.3 DomainRiskProfile · §46 组织层次

## 49.1 合规框架注册表

```typescript
interface ComplianceFramework {
  framework_id: string;                    // e.g. "sox", "hipaa", "pci_dss", "gdpr"
  name: string;
  version: string;
  controls: ComplianceControl[];
  evidence_requirements: EvidenceRequirement[];
  audit_cadence: string;                   // e.g. "quarterly", "annual"
}

interface ComplianceControl {
  control_id: string;                      // e.g. "SOX-404", "HIPAA-164.312"
  description: string;
  category: "access_control" | "data_protection" | "audit" | "change_management" | "segregation";
  enforcement: "automated" | "manual_review" | "hybrid";
  platform_mapping: string[];              // 映射到平台能力, e.g. ["§11.2 RBAC", "§21 Approval"]
}

interface DepartmentComplianceBinding {
  department_id: string;                   // §46 org_node
  frameworks: string[];                    // 绑定的合规框架 ID
  additional_controls: ComplianceControl[];// 部门级额外控制
  compliance_officer: string;              // 合规负责人
  evidence_retention: string;              // 证据保留期限
}
```

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

| 合规控制 | 证据来源 | 收集方式 |
|---------|---------|---------|
| SOX 访问审查 | §11.2 RBAC + §28 audit log | 季度自动导出访问权限快照 |
| SOX 职责分离 | §47 SodRouting | 自动验证审批链无违规 |
| HIPAA 数据加密 | §23.5 加密架构 | 持续监控加密状态 |
| PCI-DSS 范围限制 | §46 tenant 隔离 | 自动验证 CDE 边界 |
| GDPR 删除权 | §23.2 crypto-shredding | 自动记录删除执行证据 |

---

# 50. 知识域隔离与受控共享

> v2.4 新增。强制隔离不同部门的知识资产，提供审批式跨域共享。
> 关联：§29 Knowledge/Memory · §37.4 DomainKnowledgeSchema · §46 组织层次 · §11 安全

## 50.1 知识隔离模型

```typescript
interface KnowledgeBoundary {
  boundary_id: string;
  org_scope: string;                       // 对应 §46 org_node_id
  isolation_level: "strict" | "controlled" | "open";
  knowledge_namespaces: string[];          // 该边界内的知识命名空间
  access_policy: KnowledgeAccessPolicy;
}

type IsolationLevel =
  | "strict"       // 信息隔离墙——禁止任何跨边界访问（M&A、内幕信息）
  | "controlled"   // 需审批的受控共享（默认）
  | "open";        // 边界内自由访问（同一 team）

interface KnowledgeAccessPolicy {
  default_action: "deny" | "allow";
  cross_boundary_rules: CrossBoundaryRule[];
}

interface CrossBoundaryRule {
  source_boundary: string;
  target_boundary: string;
  allowed_operations: ("read" | "search" | "reference")[];
  requires_approval: boolean;
  approver: "source_owner" | "target_owner" | "both" | "compliance_officer";
  data_transform?: "anonymize" | "aggregate" | "redact_pii";
  audit_level: "basic" | "full" | "forensic";
  ttl?: string;                            // 共享授权有效期
}
```

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

```typescript
interface ChineseWallPolicy {
  conflict_groups: ConflictGroup[];
}

interface ConflictGroup {
  group_id: string;
  boundaries: string[];                    // 互斥的知识边界
  rule: "access_one_blocks_others";        // 访问其中一个后自动禁止其他
}
```

---

# 51. 分级治理委托

> v2.4 新增。使部门管理员在平台团队设定的护栏内自助治理，平台团队不再是所有治理变更的瓶颈。
> 关联：§24 配置治理 · §37.9 DomainGovernancePolicy · §46 组织层次

## 51.1 治理权限分层

```typescript
interface GovernanceDelegation {
  org_node_id: string;                     // §46
  delegated_to: string;                    // principal or role
  permissions: GovernancePermission[];
  guardrails: Guardrail[];                 // 平台团队设定的护栏
}

type GovernancePermission =
  | "manage_domains"           // 创建/修改本部门的 DomainDescriptor
  | "manage_packs"             // 发布/回滚本部门的 Pack
  | "manage_prompts"           // 修改本部门的 PromptLibrary
  | "manage_triggers"          // 配置本部门的触发器(§41)
  | "manage_approvals"         // 配置本部门的审批规则（在额度上限内）
  | "manage_budgets"           // 分配本部门的预算（在上级分配范围内）
  | "manage_knowledge"         // 管理本部门的知识边界
  | "view_audit"               // 查看本部门的审计记录
  | "manage_agents"            // 启停本部门的 Agent
  | "manage_eval";             // 管理本部门的评估数据集

interface Guardrail {
  guardrail_id: string;
  type: "max_risk_level" | "max_budget" | "forbidden_tools" | "mandatory_approval" | "min_eval_threshold";
  value: unknown;
  set_by: "platform_team";
  overridable: false;
}
```

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

| 操作 | 上级可 | 下级可 |
|------|-------|-------|
| 收紧策略（降低 max_risk） | ✓ | ✓ |
| 放松策略（提高 max_risk） | ✓ | ✗ |
| 追加约束 | ✓ | ✓ |
| 删除上级约束 | ✓（自己设的） | ✗ |
| 分配预算 | ✓（在自己配额内） | ✓（在自己配额内） |

## 51.3 自助治理操作台

| 功能 | 部门管理员可用 | 平台团队可用 |
|------|-------------|------------|
| 域接入向导(§44.2) | ✓（低/中风险域） | ✓（所有域） |
| 修改审批规则 | ✓（在额度上限内） | ✓（无限制） |
| 发布 Pack | ✓（经自动安全扫描） | ✓ |
| 调整 Agent 自主权(§42) | ✓（不超过域上限） | ✓ |
| 创建触发器(§41) | ✓（低/中风险） | ✓ |
| 修改全局护栏 | ✗ | ✓ |
| 跨部门策略 | ✗ | ✓ |

---

# 52. 多 Region 部署架构

> v2.5 新增。支持全球化企业跨 Region 合规运行，数据主权、流量路由、故障隔离。
> 关联：§31 容灾 · §32 部署 · §23 合规 · §46 组织层次

## 52.1 Region 模型

```typescript
interface RegionDefinition {
  region_id: string;                       // e.g. "cn-east", "eu-west", "us-east"
  jurisdiction: string;                    // 法域, e.g. "CN", "EU", "US"
  data_residency_class: string;            // 数据驻留分类
  available_providers: string[];           // 该 Region 可用的 LLM provider
  compliance_frameworks: string[];         // 该 Region 强制合规框架
}

interface RegionTopology {
  regions: RegionDefinition[];
  primary_region: string;                  // 控制面主 Region
  federation_mode: "hub_spoke" | "mesh";
  cross_region_policy: CrossRegionPolicy;
}

interface CrossRegionPolicy {
  data_replication: "none" | "metadata_only" | "anonymized" | "full_encrypted";
  workflow_routing: "region_affinity" | "nearest" | "cost_optimized";
  failover: "manual" | "semi_auto" | "auto";
  max_cross_region_latency: string;
}
```

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

| 场景 | 路由策略 | 数据处理 |
|------|---------|---------|
| 用户在 EU，任务只涉及 EU 数据 | Region 亲和，留在 EU | 本地处理 |
| 用户在 CN，需要调用 US 的 LLM | CN 执行，LLM 请求路由到 US | 输入/输出不含 PII 时允许跨境 |
| 跨 Region 协作（EU 市场 + US 工程） | 各自 Region 执行，metadata 同步 | 仅交换匿名化/聚合数据 |
| Region 故障 failover | 手动/半自动切换到备用 Region | 元数据预复制，业务数据不跨境 |

## 52.4 跨境数据传输合规

| 法域 | 合规框架 | 平台机制 |
|------|---------|---------|
| EU → 非EU | GDPR Chapter V — SCCs (Standard Contractual Clauses) | 跨 Region LLM 调用自动附加 SCC 数据处理协议引用；传输前 DPIA（Data Protection Impact Assessment）自动评估 |
| EU → US | EU-US Data Privacy Framework | 验证 provider 是否在 DPF 清单；未列入则回退至 SCC |
| CN → 海外 | PIPL 第 38 条 — 安全评估 / 标准合同 | 跨境前自动触发数据量评估；超阈值需安全评估记录 |
| 集团内跨境 | BCRs (Binding Corporate Rules) | 企业级 BCR 模板，平台自动在跨境传输中引用 BCR 编号并记录 |

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

> v2.5 新增。5000+ 并发 workflow 场景下的公平调度、优先级抢占、容量保障。
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

```typescript
interface ResourceQuota {
  org_node_id: string;                     // §46 部门
  guaranteed: ResourceAllocation;          // 保障资源（永远可用）
  burstable: ResourceAllocation;           // 突发资源（有空闲时可用）
  max_limit: ResourceAllocation;           // 硬上限
}

interface ResourceAllocation {
  max_concurrent_workflows: number;
  max_concurrent_workers: number;
  llm_tokens_per_minute: number;
  llm_requests_per_minute: number;
}
```

## 53.3 优先级抢占

```typescript
interface PriorityClass {
  class_name: "critical" | "high" | "standard" | "background" | "best_effort";
  priority_value: number;                  // 0-1000
  preemption_policy: "never" | "lower_priority" | "any_non_critical";
  queue_timeout: string;                   // 排队超时
  guaranteed_start_sla?: string;           // 保证启动 SLA
}
```

| 优先级 | 场景 | 抢占策略 | 启动 SLA |
|--------|------|---------|---------|
| critical(1000) | 线上事故修复 | 可抢占所有非 critical | < 10s |
| high(800) | 电商订单处理 | 可抢占 standard 以下 | < 30s |
| standard(500) | 日常业务 workflow | 不抢占 | < 5min |
| background(200) | 批量分析 / 报表 | 不抢占，空闲时运行 | 尽力 |
| best_effort(0) | 实验性任务 | 不抢占，随时可被抢占 | 无保证 |

## 53.4 公平调度

- **Weighted Fair Queuing**：每个部门按 guaranteed 配额获得权重
- **Borrowing**：部门未用满 guaranteed 配额时，空闲资源可被其他部门 burst 使用
- **Reclaim**：当原部门需要时，borrowed 资源在当前 step 完成后归还（graceful reclaim）
- **Starvation Prevention**：任何部门的 standard 优先级任务排队超过 30min 自动升级为 high

---

# 54. SLA 分级保障

> v2.5 新增。为不同业务重要度提供差异化 SLA 保障，含资源预留和违约响应。
> 关联：§27 SLO · §37.9 DomainGovernancePolicy · §53 资源竞争

## 54.1 SLA Tier 模型

```typescript
interface SlaTier {
  tier_id: string;
  tier_name: "platinum" | "gold" | "silver" | "bronze";
  guarantees: SlaGuarantees;
  resource_reservation: ResourceAllocation;
  violation_response: ViolationResponse;
  cost_multiplier: number;                 // 相对于 bronze 的成本倍率
}

interface SlaGuarantees {
  availability: string;                    // e.g. "99.99%"
  p50_latency: string;
  p95_latency: string;
  p99_latency: string;
  max_queue_time: string;
  recovery_priority: number;               // 恢复优先级
  data_durability: string;                 // e.g. "99.999999%"
}

interface ViolationResponse {
  on_latency_breach: "alert" | "auto_scale" | "preempt_lower_tier";
  on_availability_breach: "alert" | "failover" | "escalate_to_platform_team";
  error_budget_policy: "standard" | "strict";  // strict = SLO 违反立即冻结变更
  internal_penalty?: string;               // 内部惩罚机制描述
}
```

## 54.2 SLA Tier 矩阵

| Tier | 可用性 | P95 延迟 | 排队上限 | 恢复优先 | 适用场景 |
|------|--------|---------|---------|---------|---------|
| **Platinum** | 99.99% | < 2s | < 5s | 最高 | 线上交易、实时风控 |
| **Gold** | 99.95% | < 5s | < 30s | 高 | 核心业务 workflow |
| **Silver** | 99.9% | < 15s | < 5min | 中 | 日常运营 |
| **Bronze** | 99.5% | < 60s | < 30min | 低 | 内部工具、实验 |

## 54.3 SLA 感知调度

Dispatcher(§14.2) 在调度时考虑 SLA Tier：

1. **排队检查**：workflow 排队时间接近 `max_queue_time` 时自动升级优先级
2. **延迟预测**：基于历史数据预测 workflow 是否会违反 SLA，提前扩容或抢占
3. **资源预留**：Platinum/Gold tier 的 `resource_reservation` 始终为其预留，不可被 burst 占用
4. **违约响应**：SLA 违反时按 `ViolationResponse` 自动执行（告警/扩容/抢占/升级）

---

# 55. Agent 市场与生态

> v2.5 新增。构建平台内部/外部的 Pack、Plugin、模板、连接器生态市场。
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

```typescript
interface MarketplaceItem {
  item_id: string;
  item_type: "pack" | "plugin" | "connector" | "template" | "prompt_library" | "eval_dataset";
  name: string;
  description: string;
  publisher: Publisher;
  version: string;
  compatibility: CompatibilitySpec;
  pricing: "free" | "enterprise_included" | PricingPlan;
  quality: QualityMetrics;
  security: SecurityScanResult;
  install_count: number;
  rating: number;
  domain_tags: string[];
}

interface Publisher {
  publisher_id: string;
  type: "platform_official" | "enterprise_internal" | "third_party" | "community";
  verified: boolean;
  trust_level: "official" | "verified" | "community";
}

interface QualityMetrics {
  test_coverage: number;
  eval_pass_rate: number;
  incident_rate_30d: number;
  avg_rating: number;
  active_installs: number;
}
```

## 55.3 安装与治理

| 发布者类型 | 安装审批 | 安全要求 | 更新策略 |
|-----------|---------|---------|---------|
| platform_official | 自动安装 | 平台团队已审查 | 自动更新 |
| enterprise_internal | 部门管理员审批 | 自动安全扫描 | 通知后自动 |
| verified_third_party | 部门管理员 + 安全团队 | 自动扫描 + 人工审查 | 手动确认 |
| community | 平台团队审批 | 完整安全审查 + 沙箱测试 | 手动确认 |

## 55.4 收益分成模型

| 定价类型 | 分成规则 | 结算周期 |
|---------|---------|---------|
| free | 无分成 | — |
| enterprise_included | 平台 license 内含，publisher 按安装量获信用积分 | 季度 |
| paid (third_party) | publisher 70% / platform 30% | 月度 |
| paid (community) | publisher 80% / platform 20%（鼓励社区贡献） | 月度 |

## 55.5 条目废弃生命周期

| 阶段 | 触发条件 | 平台动作 |
|------|---------|---------|
| active | 正常运行 | — |
| deprecated | publisher 标记废弃 或 90 天无维护更新 + 存在已知安全漏洞 | 安装页面显示废弃警告；新安装需确认；推荐替代品 |
| sunset | deprecated 后 180 天 | 阻止新安装；已安装的发送迁移通知(30 天倒计时) |
| removed | sunset 倒计时结束 | 从 Registry 移除；已安装实例冻结（不执行新任务），数据保留 90 天 |

## 55.6 依赖管理

- 每个 MarketplaceItem 声明 `dependencies: { item_id: string; version_range: string }[]`
- 安装时自动解析依赖树，检测版本冲突（类似 npm/cargo resolution）
- 卸载时检查反向依赖，若有其他 item 依赖则阻止卸载并提示
- 依赖项被 deprecated 时，自动通知所有依赖方 publisher 和安装用户

---

# 56. 反馈驱动持续改进管线

> v2.5 新增。将 §13 Learn/Improve 黑盒接口具象化为可运行的自动改进管线。
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

```typescript
interface FeedbackSignal {
  signal_type: FeedbackSignalType;
  source: "user_explicit" | "user_implicit" | "system_metric" | "eval_regression";
  domain_id: string;
  capability_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

type FeedbackSignalType =
  | "user_correction"          // 用户修改了 Agent 输出
  | "user_approval"            // 用户接受了 Agent 输出（正样本）
  | "user_rejection"           // 用户拒绝了 Agent 输出
  | "human_override"           // 人工覆写 Agent 决策
  | "task_success"             // 任务成功完成
  | "task_failure"             // 任务失败
  | "quality_drift"            // eval 质量下降
  | "cost_anomaly"             // 成本异常
  | "latency_anomaly";         // 延迟异常
```

## 56.3 自动改进类型

| 改进类型 | 触发条件 | 自动化程度 | 产出 |
|---------|---------|----------|------|
| **Few-shot 收割** | 用户 approval 累积 > 10 条 | 全自动 | 新增 few-shot example 到 PromptLibrary |
| **Prompt 微调** | 同类 user_correction > 5 条 | 半自动（生成候选→人工审核） | Prompt 修改建议 |
| **模型路由优化** | cost_anomaly 或 latency_anomaly | 全自动 | ModelGateway 路由规则更新 |
| **风控规则调整** | 连续 false positive 审批 > 10 次 | 半自动（建议→domain_owner 确认） | 风险阈值调整建议 |
| **知识库更新** | quality_drift + 知识源过期 | 全自动 | 触发知识源刷新 |
| **自主权调整** | 累积绩效数据满足晋升条件 | 按 §42 规则 | 自主权晋升/降级 |

## 56.4 安全护栏

- 自动改进**永远不能**放松安全策略或合规控制
- 全自动改进仅限**非风险变更**（few-shot 增加、路由优化、知识刷新）
- 涉及 Prompt 核心逻辑或风控规则的变更必须经人工审核
- 所有自动改进记录到 event_log，可审计可回滚

---

# 57. 外部系统集成框架

> v2.5 新增。提供标准化连接器框架和预构建连接器目录，使 Agent 能对接真实业务系统。
> 关联：§14.4 Executor · §11.5 出站控制 · §37.4 KnowledgeSource · §55 Marketplace

## 57.1 连接器抽象

```typescript
interface Connector {
  connector_id: string;
  name: string;
  category: ConnectorCategory;
  auth_method: "oauth2" | "api_key" | "basic" | "certificate" | "custom";
  capabilities: ConnectorCapability[];
  rate_limits: RateLimitSpec;
  data_classification: string;             // 该连接器涉及的数据分级
  health_check: HealthCheckConfig;
}

type ConnectorCategory =
  | "payment"          // 支付: Stripe, 支付宝, 微信支付
  | "ecommerce"        // 电商: Shopify, 有赞, 拼多多
  | "crm"              // CRM: Salesforce, 飞书 CRM
  | "communication"    // 通信: 邮件, 短信, 企微, 飞书, 钉钉
  | "social_media"     // 社交: 微信, 抖音, 微博, 小红书
  | "finance"          // 财务: 用友, 金蝶, SAP
  | "storage"          // 存储: OSS, S3, Google Drive
  | "devtools"         // 开发: GitHub, GitLab, Jira
  | "analytics"        // 分析: Google Analytics, 神策
  | "ai_service"       // AI: OpenAI, Anthropic, 百度文心
  | "database"         // 数据库: MySQL, PostgreSQL, MongoDB
  | "custom";          // 自定义 API

interface ConnectorCapability {
  capability_id: string;
  operations: ("read" | "write" | "subscribe" | "webhook")[];
  schema: Record<string, unknown>;         // 输入输出 schema
}
```

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

| 类别 | 连接器 | 优先级 | 能力 |
|------|-------|--------|------|
| 通信 | 飞书/企微/钉钉 | P0 | 消息发送、审批推送、日历读取 |
| 通信 | 邮件(SMTP/IMAP) | P0 | 发送、接收、搜索 |
| 存储 | 阿里云 OSS / S3 | P0 | 上传、下载、列表 |
| 开发 | GitHub/GitLab | P0 | PR、Issue、代码搜索 |
| 数据库 | MySQL/PostgreSQL | P0 | 查询、写入 |
| 社交 | 微信公众号 | P1 | 消息推送、菜单管理 |
| 电商 | 有赞 | P1 | 订单查询、商品管理 |
| 财务 | 用友 | P1 | 凭证查询、报表导出 |
| 分析 | 神策 | P1 | 事件查询、用户画像 |
| 支付 | 支付宝/微信支付 | P2 | 下单、退款、查询 |

## 57.4 Connector SDK

```typescript
interface ConnectorSDK {
  create(config: ConnectorConfig): Connector;
  registerCapability(cap: ConnectorCapability): void;
  handleAuth(flow: AuthFlow): Promise<AuthResult>;
  healthCheck(): Promise<HealthStatus>;
  execute(operation: string, params: Record<string, unknown>): Promise<ConnectorResponse>;
}
```

社区和企业内部团队可通过 Connector SDK 开发自定义连接器，发布到 Marketplace(§55)。

---

# 59. Agent 可解释性与决策透明度架构

> v2.6 新增。为每个 Agent 决策构建面向用户的因果解释能力，满足 EU AI Act / GDPR Article 22 合规要求，并为渐进式自主权(§42)提供信任基础。
> 关联：§12.7 Tracing · §13 OAPEFLIR · §17 质量门禁 · §23.6 数据血缘 · §39 NL 入口 · §42 渐进式自主权

## 59.1 设计原则

* 每个 OAPEFLIR 循环的每个阶段**必须**生成 `StageRationale` 记录
* 解释按需生成（lazy），不增加正常执行路径开销
* 解释深度按领域配置：金融需要 forensic-level，客服需要 summary-level
* 解释缓存避免重复 LLM 调用
* 解释不可篡改，纳入 Evidence Plane

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

```typescript
interface StageRationale {
  stage: "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
  inputs_summary: string;
  reasoning: string;
  alternatives_considered: { option: string; rejected_reason: string }[];
  knowledge_citations: KnowledgeRef[];
  confidence: number;
  timestamp: string;
}
```

## 59.4 解释深度分级

| 深度 | 适用场景 | 内容 |
|------|---------|------|
| L1 Summary | 非技术用户日常查看 | 一句话概述："因为检测到异常流量，自动扩容了 2 个实例" |
| L2 Reasoning | 业务负责人审查 | 因果链 + 关键数据点 + 备选方案 |
| L3 Forensic | 合规审计 / Incident 调查 | 完整证据链 + 所有输入输出 + 知识引用 + 模型调用详情 |

## 59.5 与 NL 入口集成

§39 NL 交互管线增加 `why` Intent 类型：

```typescript
interface WhyQuery {
  target: { workflow_id: string; step_id?: string };
  depth: "summary" | "reasoning" | "forensic";
  locale: string;
}
```

用户可通过自然语言问"上次发布为什么回滚了？"，系统解析为 WhyQuery 并调用解释管线。

## 59.6 解释缓存与安全

* L1/L2 解释缓存 TTL = 24h，L3 不缓存（确保最新证据）
* 解释内容受 §50 知识域隔离约束——只能看到自己有权限的证据
* 解释日志本身纳入审计(§23)，记录谁在什么时候查看了什么解释

---

# 60. 紧急制动与全局熔断架构

> v2.6 新增。提供单一原子操作在 < 5 秒内停止全平台所有 Agent 执行，用于安全事件、Prompt injection 攻击、Agent 逃逸等紧急场景。
> 关联：§9 稳定性 · §10 风险控制 · §11 安全 · §12 异常事件 · §52 多 Region

## 60.1 PlatformPanicDirective

```typescript
interface PlatformPanicDirective {
  directive_id: string;
  triggered_by: { user_id: string; role: "platform_admin" | "security_team" };
  reason: string;
  scope: "global" | "region" | "tenant";
  target?: { region_id?: string; tenant_id?: string };
  actions: PanicAction[];
  timestamp: string;
}

type PanicAction =
  | "halt_all_workflows"
  | "block_new_creation"
  | "revoke_agent_permissions"
  | "block_all_egress"
  | "notify_all_stakeholders"
  | "generate_forensic_snapshot";
```

## 60.2 熔断传播机制

```text
PlatformPanicDirective
    │
    ├──▶ P1 Interface Plane: 拒绝所有新请求(503), 关闭 WebSocket
    │
    ├──▶ P2 Control Plane: 撤销所有 active Agent token
    │
    ├──▶ P3 Orchestration Plane: 挂起所有 in-flight OAPEFLIR 循环
    │
    ├──▶ P4 Execution Plane: 中止所有 worker, 回滚未提交 side effect
    │
    ├──▶ P5 State Plane: 生成 ForensicSnapshot, 设置 read-only 模式
    │
    └──▶ X1 Fabric: 阻断所有 egress, 触发告警到所有渠道
```

**SLA**：从 Directive 发出到所有平面确认停止 < 5 秒（同 Region），< 15 秒（跨 Region）。

## 60.3 安全恢复协议

| 步骤 | 操作 | 要求 |
|------|------|------|
| 1 | ForensicSnapshot 审查 | 安全团队确认威胁已消除 |
| 2 | PlatformResumeDirective 发布 | 需要 ≥ 2 名 platform_admin 双人审批 |
| 3 | 渐进恢复 | 先恢复 read-only 查询 → 低风险 workflow → 全面恢复 |
| 4 | 事后报告 | 72h 内发布 Post-Incident Report |

## 60.4 定期演练

* 每季度至少一次紧急制动演练（选定 tenant 范围）
* 演练结果纳入 §36 成功标准
* 演练期间产生的 ForensicSnapshot 用于验证取证完整性

---

# 61. Agent 统一生命周期管理架构

> v2.6 新增。将 Agent 建模为一等实体——Pack + Prompt Bundle + Model Binding + Trust Profile + Trigger Set + Autonomy Config 的复合体，管理从创建到退役的完整生命周期。
> 关联：§16 Prompt · §30 Pack · §42 渐进式自主权 · §41 主动式 Agent · §55 Marketplace

## 61.1 AgentDefinition 复合实体

```typescript
interface AgentDefinition {
  agent_id: string;
  name: string;
  domain_id: string;
  owner: OrgNodeRef;

  components: {
    pack: { pack_id: string; version: string };
    prompt_bundle: { bundle_id: string; version: string };
    model_binding: { provider: string; model: string; fallback_chain: string[] };
    trust_profile: { initial_level: AutonomyLevel; scoring_config: TrustScoringConfig };
    trigger_set: TriggerPolicy[];
    autonomy_config: AutonomyConfig;
  };

  lifecycle_state: AgentLifecycleState;
  created_at: string;
  updated_at: string;
}

type AgentLifecycleState =
  | "draft"
  | "testing"
  | "staging"
  | "canary"
  | "active"
  | "paused"
  | "deprecated"
  | "archived";
```

## 61.2 AgentVersion 快照

```typescript
interface AgentVersion {
  version_id: string;
  agent_id: string;
  semver: string;
  component_snapshot: {
    pack_version: string;
    prompt_bundle_version: string;
    model_binding_hash: string;
    trust_profile_hash: string;
    trigger_set_hash: string;
    autonomy_config_hash: string;
  };
  created_at: string;
  created_by: string;
  release_note: string;
}
```

## 61.3 生命周期状态机

```text
draft ──▶ testing ──▶ staging ──▶ canary ──▶ active
                                              │
                          paused ◀────────────┘
                            │
                        deprecated ──▶ archived
```

| 转换 | 触发条件 | 门禁 |
|------|---------|------|
| draft→testing | 开发者提交 | 所有组件版本锁定 |
| testing→staging | 测试通过 | §17 质量门禁 + 安全扫描 |
| staging→canary | 预发布审批 | 域管理员审批 |
| canary→active | 灰度指标达标 | 自动晋升（错误率 < 阈值 + 性能达标） |
| active→paused | 手动/自动暂停 | 行为漂移检测(§63)触发或手动操作 |
| active→deprecated | 版本替代/业务变更 | 责任转移到新版本完成 |
| deprecated→archived | TTL 过期 | 所有历史引用标记为 archived |

## 61.4 复合灰度发布

Agent 灰度以 AgentVersion 为单位（非单组件）：

* **流量分割**：canary 版本接收 5%→20%→50%→100% 流量
* **复合回滚**：一键回退到上一个 AgentVersion（所有组件原子回退）
* **比较测试**：对同一输入同时运行两个 AgentVersion，比较输出差异

## 61.5 Agent 退役与责任转移

```typescript
interface AgentRetirement {
  retiring_agent_id: string;
  successor_agent_id?: string;
  transfer_items: ("triggers" | "subscriptions" | "scheduled_tasks" | "ownership")[];
  grace_period_days: number;
  notification_targets: string[];
}
```

---

# 62. 离线与边缘部署架构

> v2.6 新增。支持工厂车间、零售门店、移动设备等间歇连接场景下的 Agent 执行，以本地优先+最终同步模式运行。
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

| 约束 | 说明 |
|------|------|
| 风险上限 | 离线模式只允许执行 risk_level ≤ medium 的动作 |
| 模型降级 | 使用本地 sLLM（如 Qwen-7B/Llama-3-8B），不调用云端 ModelGateway |
| 副作用排队 | 所有 side effect 写入本地 SyncQueue，连接恢复后批量提交 |
| 审批挂起 | 需要审批的步骤进入 pending 状态，等待连接恢复 |
| 缓存计划 | EdgeRuntime 定期从 Central 预拉取 ExecutionPlan 模板 |

## 62.3 同步协议

```typescript
interface SyncProtocol {
  pullFromCentral(): Promise<SyncPacket>;
  pushToCentral(localChanges: LocalChangeSet): Promise<ConflictReport>;
  resolveConflicts(report: ConflictReport): Promise<Resolution[]>;
}

interface ConflictReport {
  conflicts: {
    entity_type: string;
    entity_id: string;
    local_version: number;
    central_version: number;
    resolution_strategy: "local_wins" | "central_wins" | "manual";
  }[];
}
```

**冲突解决原则**：Central 状态为权威源；离线期间的 side effect 如与 Central 冲突，默认 Central wins + 生成 Incident 供人工审查。

## 62.4 部署模式

| 模式 | 硬件要求 | 适用场景 |
|------|---------|---------|
| Edge-Micro | ARM/x86 单板机, 4GB RAM | 零售门店 POS、IoT 网关 |
| Edge-Standard | 8C/32GB 服务器 | 工厂车间、仓库 |
| Edge-Mobile | iOS/Android App | 移动外勤、现场服务 |
| Hybrid | 本地 GPU 服务器 | 需要本地推理的高吞吐场景 |

---

# 63. Agent 行为漂移检测架构

> v2.6 新增。超越单维度质量指标，建立多维行为画像和长周期变点检测，在 Agent 行为渐变导致业务风险前发出预警。
> 关联：§17 质量门禁 · §42 渐进式自主权 · §43 看板 · §56 反馈改进

## 63.1 行为指纹模型

```typescript
interface BehaviorFingerprint {
  agent_id: string;
  window: { start: string; end: string };
  dimensions: {
    tool_call_distribution: Record<string, number>;
    action_sequence_patterns: { pattern: string; frequency: number }[];
    risk_score_distribution: { mean: number; stddev: number; p95: number };
    response_time_distribution: { mean: number; stddev: number; p95: number };
    approval_rate: number;
    error_rate: number;
    token_usage_per_task: { mean: number; stddev: number };
    knowledge_source_distribution: Record<string, number>;
  };
}
```

## 63.2 变点检测引擎

| 窗口 | 检测算法 | 灵敏度 | 用途 |
|------|---------|--------|------|
| 1h 滑窗 | Z-Score 异常检测 | 高 | 突变（模型更新、Prompt 变更后） |
| 7d 滑窗 | CUSUM | 中 | 短期趋势（知识库变更影响） |
| 30d 滑窗 | Bayesian Online Changepoint | 中 | 月度漂移（业务环境变化） |
| 90d 滑窗 | Drift Distance (KL/JS 散度) | 低 | 长期基线偏移 |

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

> v2.6 新增。在 §18 成本计量的基础上，增加决策级成本归因、自动优化建议、What-if 仿真，使成本数据从"可看"变为"可行动"。
> 关联：§18 成本管理 · §15 ModelGateway · §43 看板 · §54 SLA

## 64.1 决策级成本归因

```typescript
interface CostAttribution {
  workflow_id: string;
  total_cost: Money;
  breakdown: {
    step_id: string;
    step_name: string;
    model_used: string;
    tokens: { input: number; output: number };
    cost: Money;
    was_optimal: boolean;
    optimal_alternative?: { model: string; estimated_cost: Money; quality_impact: string };
  }[];
  optimization_potential: Money;
}
```

## 64.2 自动优化建议

| 建议类型 | 检测条件 | 建议内容 | 预期节省 |
|---------|---------|---------|---------|
| ModelDowngrade | 低风险 step 使用高端模型 | 切换到 cost_optimized 路由 | 30-60% |
| CacheHit | 相同 query 重复调用 | 启用 semantic cache | 40-80% |
| TokenTrim | 平均 input_tokens > 4x output_tokens | 优化 Prompt 或启用 context compression | 20-40% |
| BatchMerge | 多个独立 step 可合并 | 合并为单次 LLM 调用 | 50-70% |
| ScheduleShift | 非紧急任务在高峰时段执行 | 调度到低成本时段 | 10-30% |

```typescript
interface CostRecommendation {
  recommendation_id: string;
  type: "model_downgrade" | "cache_hit" | "token_trim" | "batch_merge" | "schedule_shift";
  target: { agent_id?: string; domain_id?: string; pack_id?: string };
  current_monthly_cost: Money;
  projected_monthly_cost: Money;
  savings: Money;
  quality_risk: "none" | "low" | "medium";
  auto_applicable: boolean;
}
```

## 64.3 What-if 成本仿真

```typescript
interface CostSimulation {
  simulate(scenario: CostScenario): Promise<CostProjection>;
}

interface CostScenario {
  changes: (
    | { type: "model_change"; from: string; to: string }
    | { type: "volume_change"; multiplier: number }
    | { type: "autonomy_change"; new_level: AutonomyLevel }
    | { type: "new_domain_onboard"; estimated_daily_tasks: number }
  )[];
  projection_period_days: number;
}
```

## 64.4 成本看板集成

§43 统一运营看板增加 "Cost Intelligence" 面板：

* 本月 Top 10 高成本 Agent / Domain / Workflow
* 可行动的节省机会（按预期节省额排序）
* 成本趋势与预算对比
* What-if 仿真入口

---

# 65. 工作流可视化调试器架构

> v2.6 新增。为运行中/已完成的工作流提供可视化调试和检查能力，支持实时执行跟踪、OAPEFLIR 步入调试、时间旅行回放。
> 关联：§12.7 Tracing · §13 OAPEFLIR · §44.3 Workflow 构建器 · §59 可解释性

## 65.1 调试器能力矩阵

| 能力 | 运行中 Workflow | 已完成 Workflow | 说明 |
|------|---------------|----------------|------|
| 执行时间线 | ✓ (实时) | ✓ | 每个 step 的开始/结束/状态可视化 |
| OAPEFLIR 步入 | ✓ | ✓ | 展开单个 step 查看 O/A/P/E/F/L/I/R 各阶段详情 |
| 数据流视图 | ✓ | ✓ | step 间的输入/输出数据流 |
| 副作用 Diff | ✗ | ✓ | 预期副作用 vs 实际副作用对比 |
| 断点调试 | ✓ | ✗ | 在指定 step 暂停执行，人工检查后继续 |
| 时间旅行 | ✗ | ✓ | 从任意 checkpoint 重放执行 |
| 运行对比 | ✗ | ✓ | 两次运行的并排对比 |

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

```typescript
interface DebugBreakpoint {
  workflow_id: string;
  breakpoint_type: "before_step" | "after_step" | "before_stage" | "on_risk_threshold";
  target: { step_id?: string; stage?: string; risk_threshold?: number };
  action: "pause" | "log_snapshot";
}

interface DebugSession {
  setBreakpoint(bp: DebugBreakpoint): Promise<void>;
  resume(workflow_id: string): Promise<void>;
  inspect(workflow_id: string, step_id: string): Promise<StepSnapshot>;
}
```

## 65.4 运行对比

```typescript
interface RunComparison {
  compare(run_a: string, run_b: string): Promise<ComparisonResult>;
}

interface ComparisonResult {
  steps_added: string[];
  steps_removed: string[];
  steps_changed: {
    step_id: string;
    diff: { field: string; value_a: unknown; value_b: unknown }[];
  }[];
  cost_diff: Money;
  duration_diff_ms: number;
}
```

---

# 66. 合规报告自动生成引擎

> v2.6 新增。将平台收集的证据自动组装为审计就绪的合规报告，支持 SOC2 Type II / SOX / HIPAA / GDPR / PCI-DSS 等多框架。
> 关联：§23 合规 · §49 分部门合规 · §12 异常事件 · §50 知识隔离

## 66.1 报告模板注册

```typescript
interface ComplianceReportTemplate {
  framework: "SOC2_TYPE_II" | "SOX_302" | "SOX_404" | "HIPAA" | "GDPR" | "PCI_DSS" | "ISO27001";
  version: string;
  controls: {
    control_id: string;
    control_name: string;
    evidence_sources: EvidenceSource[];
    pass_criteria: string;
  }[];
}

type EvidenceSource =
  | { type: "audit_log"; query: string }
  | { type: "config_snapshot"; path: string }
  | { type: "metric"; metric_name: string; threshold: number }
  | { type: "policy_check"; policy_id: string };
```

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

| 框架 | 频率 | 范围 | 典型消费者 |
|------|------|------|-----------|
| SOC2 Type II | 季度 | 全平台 | 审计师 / 客户 |
| SOX 302/404 | 季度 | 财务域 | CFO / 外部审计 |
| HIPAA | 月度 | 医疗域 | HIPAA Officer |
| GDPR | 月度 | 全平台 | DPO |
| PCI-DSS | 季度 | 支付域 | QSA |
| ISO 27001 | 半年 | 全平台 | CISO |

## 66.4 审计员只读访问

```typescript
interface AuditorRole {
  permissions: [
    "read:compliance_reports",
    "read:audit_logs",
    "read:config_snapshots",
    "read:evidence_bundles"
  ];
  restrictions: [
    "deny:write:*",
    "deny:read:knowledge_content",
    "deny:read:pii_data"
  ];
  session_ttl: "7d";
  mfa_required: true;
}
```

---

# 67. 容量规划与成本预测引擎

> v2.6 新增。基于历史趋势的预测性容量建模，支持扩容时机建议、成本趋势预测和 What-if 容量仿真。
> 关联：§18 成本 · §27 SLO · §43 看板 · §54 SLA · §64 成本优化

## 67.1 资源维度追踪

| 维度 | 采集来源 | 预警阈值 |
|------|---------|---------|
| Worker 并发数 | P4 Execution Plane | 当前容量 80% |
| 存储用量 | P5 State Plane | 当前容量 85% |
| LLM Token 消耗/日 | §18 CostTracker | 月度预算 70% |
| API QPS | P1 Interface Plane | 当前容量 75% |
| Event Log 增长率 | P5 Event Store | 存储容量 80% |
| 队列深度 | P4 Fair Queue | 平均等待时间 > SLA 50% |

## 67.2 预测模型

```typescript
interface CapacityForecast {
  dimension: string;
  current_usage: number;
  current_capacity: number;
  utilization_pct: number;
  trend: "growing" | "stable" | "declining";
  forecast: {
    days_30: { predicted_usage: number; confidence_interval: [number, number] };
    days_90: { predicted_usage: number; confidence_interval: [number, number] };
    days_180: { predicted_usage: number; confidence_interval: [number, number] };
  };
  breach_date?: string;
  scaling_recommendation?: {
    action: "scale_up" | "optimize" | "no_action";
    from_tier: string;
    to_tier: string;
    estimated_cost_delta: Money;
    recommended_date: string;
  };
}
```

## 67.3 What-if 容量仿真

```typescript
interface CapacitySimulation {
  simulate(scenario: CapacityScenario): Promise<CapacityImpact>;
}

interface CapacityScenario {
  changes: (
    | { type: "new_domain"; estimated_agents: number; estimated_daily_tasks: number }
    | { type: "traffic_spike"; multiplier: number; duration_hours: number }
    | { type: "new_region"; initial_capacity_pct: number }
    | { type: "model_migration"; from: string; to: string }
  )[];
}

interface CapacityImpact {
  dimensions_impacted: {
    dimension: string;
    current_headroom_pct: number;
    post_change_headroom_pct: number;
    action_required: boolean;
  }[];
  estimated_cost_delta: Money;
  risk_assessment: "safe" | "needs_scaling" | "critical";
}
```

## 67.4 财务预算支持

* 月度成本趋势报告（实际 vs 预算 vs 预测）
* 季度容量规划建议（面向财务团队审批预算）
* 年度 TCO 预测（含硬件 + LLM API + 人力成本）

---

# 68. 多模态能力架构

> v2.6 新增。扩展 ModelGateway 支持图像、语音、文档等多模态输入/输出，使平台能承接素材制作、客服图片处理、语音交互等场景。
> 关联：§15 ModelGateway · §26 存储 · §37 业务域 · §39 NL 入口

## 68.1 多模态 ModelGateway 扩展

```typescript
interface MultimodalModelGateway extends ModelGateway {
  analyzeImage(req: ImageAnalysisRequest): Promise<ImageAnalysisResponse>;
  generateImage(req: ImageGenerationRequest): Promise<ImageArtifact>;
  speechToText(req: SpeechToTextRequest): Promise<TranscriptionResponse>;
  textToSpeech(req: TextToSpeechRequest): Promise<AudioArtifact>;
  parseDocument(req: DocumentParseRequest): Promise<StructuredDocument>;
}
```

## 68.2 多模态 ModelRequest 扩展

```typescript
interface MultimodalModelRequest extends ModelRequest {
  content: MultimodalContent[];
}

type MultimodalContent =
  | { type: "text"; text: string }
  | { type: "image"; image_url: string; detail: "low" | "high" }
  | { type: "audio"; audio_url: string; format: "wav" | "mp3" | "opus" }
  | { type: "document"; document_url: string; format: "pdf" | "xlsx" | "docx" }
  | { type: "video"; video_url: string; sample_rate_fps: number };
```

## 68.3 ModalityRouter

| 模态 | 默认 Provider | Fallback | 成本模型 |
|------|-------------|----------|---------|
| Text LLM | GPT-4o / Claude | Qwen / DeepSeek | per-token |
| Image Analysis | GPT-4o Vision / Claude Vision | Qwen-VL | per-image |
| Image Generation | DALL-E 3 / Midjourney API | Stable Diffusion (self-hosted) | per-image |
| Speech-to-Text | Whisper API | Paraformer (self-hosted) | per-minute |
| Text-to-Speech | Azure TTS / ElevenLabs | CosyVoice (self-hosted) | per-character |
| Document Parse | Document Intelligence | Marker / Docling (self-hosted) | per-page |

## 68.4 多模态安全

* 图像输入经过 content moderation（色情/暴力/敏感信息检测）
* 生成图像附带 C2PA 元数据水印
* 语音输入 PII 检测（电话号码、身份证号自动脱敏）
* 文档解析结果受 §50 知识域隔离约束

## 68.5 多模态成本追踪

§18 CostTracker 扩展 `modality` 维度：

```typescript
interface MultimodalCostRecord extends CostRecord {
  modality: "text" | "image_analysis" | "image_generation" | "stt" | "tts" | "document_parse";
  modality_units: number;
  modality_unit_type: "token" | "image" | "minute" | "character" | "page";
}
```

---

# 69. 平台自运维 Agent 架构

> v2.6 新增。平台使用自身 Agent 能力进行自我运维（dog-fooding），覆盖 Incident 自动诊断、常见故障自修复、配置优化建议、开发者问答。
> 关联：§12 异常事件 · §14 Execution · §37 业务域 · §41 主动 Agent · §43 看板

## 69.1 PlatformOps DomainDescriptor

```typescript
const platformOpsDomain: DomainDescriptor = {
  domain_id: "platform-ops",
  domain_class: "operations",
  risk_profile: {
    base_risk: "medium",
    override: { "write:production_config": "critical", "restart:service": "high" },
  },
  capabilities: [
    "diagnose_incident",
    "analyze_root_cause",
    "recommend_config_optimization",
    "predict_capacity_issue",
    "answer_developer_question",
    "generate_runbook_suggestion",
  ],
  constraints: {
    default_autonomy: "supervised",
    max_autonomy: "semi_auto",
    production_write: "requires_approval",
    read_only_by_default: true,
  },
};
```

## 69.2 自运维 Agent 目录

| Agent | 触发条件 | 能力 | 自主权上限 |
|-------|---------|------|-----------|
| IncidentDiagnoser | Incident 创建事件 | 收集日志、分析根因、生成诊断报告 | semi_auto |
| ConfigOptimizer | 每周定时 + 性能偏离 | 分析配置、建议优化、估算影响 | supervised |
| CapacityPredictor | 每日定时 | 分析趋势、预测瓶颈、建议扩容 | supervised |
| DevAssistant | 开发者提问 | 查询文档、搜索代码、生成示例 | semi_auto |
| HealthMonitor | 连续运行 | 巡检平台健康、生成日报 | auto (只读) |

## 69.3 安全护栏

* 所有生产环境写操作**必须**经过人工审批
* PlatformOps Agent 的 ModelGateway 调用有独立的 cost budget 和 rate limit
* PlatformOps Agent 不能访问业务域数据，只能访问平台运维数据
* PlatformOps Agent 的所有操作纳入独立审计流(§23)，与业务审计隔离

## 69.4 自运维成熟度等级

| 等级 | 描述 | 人工参与度 |
|------|------|-----------|
| L0 | 纯手动运维，Agent 仅辅助文档查询 | 100% |
| L1 | Agent 生成诊断报告，人工决策和执行 | 80% |
| L2 | Agent 生成修复方案并预执行验证，人工一键确认 | 40% |
| L3 | Agent 自动处理 P3/P4 级别问题，P1/P2 仍需人工 | 15% |

初始部署从 L0 开始，依据 §42 渐进式自主权逐步晋升。

---

# 70. 结论

这不是"一个会自动做事的 Agent 平台"，而是：

> **一个把 Agent 当作高风险自动化单元进行严格控制、隔离、恢复、审计和治理的企业操作系统——从一人公司到万人企业，以七层架构覆盖基础设施、AI 运营、业务域接入、智能交互、组织治理、规模化生态、运营成熟度的全栈能力。**

它的核心不是"多智能"，而是：

* 默认保守
* 高风险必须受控
* 异常必须分类处理
* 执行必须可恢复
* 状态必须可回放
* 行为必须可审计
* 平台必须可降级
* 业务必须可插拔但不可绕过底座
* **业务域必须被结构化理解，而非视为不透明黑盒**
* **非技术用户必须能直接使用，无需理解底层架构**
* **组织治理必须适配企业层级，而非假设扁平结构**
* **规模化运行必须有资源公平调度和 SLA 差异化保障**
* **Agent 决策必须可解释，行为漂移必须可检测**
* **平台必须能紧急制动，Agent 必须有统一生命周期**
* **离线/边缘场景必须可运行，断网不等于停摆**
* **多模态输入输出必须纳入统一安全管控，不可绕过内容审查**

### 七层架构演进总览

| 层次 | 版本 | 解决问题 | 核心章节 |
|------|------|---------|---------|
| 基础设施层 | v2.0 | 平台怎么搭 | §4-§14, §24-§32 |
| AI 运营层 | v2.1 | AI 怎么运营 | §15-§23 |
| 业务域接入层 | v2.2 | 业务怎么接 | §37-§38 |
| 智能交互层 | v2.3 | 用户怎么用 | §39-§44 |
| 组织治理层 | v2.4 | 组织怎么管 | §46-§51 |
| 规模化运行层 + 生态层 | v2.5 | 规模怎么扛 + 生态怎么建 | §52-§57 |
| 运营成熟度层 | v2.6 | 怎么用好 + 怎么安全运行 | §59-§69 |

### v2.6 运营成熟度层能力总结

| 问题 | v2.5 | v2.6 |
|------|------|------|
| 用户怎么理解 Agent 决策？ | 仅审计日志 | §59 可解释性与决策透明度 |
| 安全事件怎么紧急停止？ | 逐个 kill | §60 紧急制动与全局熔断 |
| Agent 怎么作为整体管理？ | 组件各自管理 | §61 统一生命周期管理 |
| 离线/边缘场景怎么运行？ | 不支持 | §62 离线与边缘部署 |
| Agent 行为渐变怎么发现？ | 仅质量阈值 | §63 行为漂移检测 |
| 成本怎么优化？ | 仅计量 | §64 成本归因与优化引擎 |
| Workflow 失败怎么调试？ | 看原始日志 | §65 可视化调试器 |
| 合规报告怎么出？ | 手动整理 | §66 合规报告自动生成 |
| 什么时候该扩容？ | 靠猜 | §67 容量规划与成本预测 |
| 图片/语音/文档怎么处理？ | 不支持 | §68 多模态能力 |
| 没有 SRE 团队怎么运维？ | 纯人工 | §69 平台自运维 Agent |

只有同时具备**基础设施层的稳定性**、**AI 运营层的可控性**、**业务域接入层的结构化**、**智能交互层的易用性**、**组织治理层的适配性**、**规模化运行层的可扩展性**和**运营成熟度层的可投产性**，企业才能把 Agent 平台从架构设计，升级为真正覆盖一人公司到万人企业、12+ 垂直业务线的企业级生产力操作系统。

---

# 附录 G：术语表与缩写索引

| 缩写/术语 | 全称 | 说明 |
|-----------|------|------|
| OAPEFLIR | Observe-Assess-Plan-Execute-Feedback-Learn-Improve-Release | Agent 核心循环的八个阶段(§13) |
| HITL | Human-In-The-Loop | 人机协作模式，人工参与 Agent 决策链(§21) |
| DLQ | Dead Letter Queue | 死信队列，无法处理的消息/事件的暂存区(§28.6) |
| CAS | Compare-And-Swap | 乐观并发控制原语，用于 StateCommand 幂等写入(§5.4) |
| SLO / SLA | Service Level Objective / Agreement | 服务水平目标/协议(§27, §54) |
| SEV1-4 | Severity 1-4 | 事件严重等级（1 最高）(§12) |
| TTFT | Time To First Token | LLM 流式响应中首 token 到达延迟(§27.7) |
| SCC | Standard Contractual Clauses | GDPR 标准合同条款，跨境数据传输法律机制(§52.4) |
| BCR | Binding Corporate Rules | 约束性企业规则，集团内跨境数据传输机制(§52.4) |
| DPIA | Data Protection Impact Assessment | 数据保护影响评估(§52.4) |
| PIPL | Personal Information Protection Law | 中国个人信息保护法(§52) |
| WCAG | Web Content Accessibility Guidelines | 无障碍访问指南(§44.6) |
| SCIM | System for Cross-domain Identity Management | 跨域身份管理协议(§48) |
| SSO | Single Sign-On | 单点登录(§48) |
| RBAC | Role-Based Access Control | 基于角色的访问控制(§11) |
| DAG | Directed Acyclic Graph | 有向无环图，用于目标分解和任务依赖(§40) |
| Pack | Business Pack | 业务域功能包，Agent 的可部署单元(§30) |
| UoW | Unit of Work | 工作单元，事务性操作的原子边界 |
| WAL | Write-Ahead Log | 预写日志，保障崩溃恢复的持久化机制(§31) |
| P1-P5 | Plane 1-5 | 五平面架构（Interface·Control·Orchestration·Execution·State & Evidence）(§4) |
| X1 | Cross-cutting Fabric | 横切关注面（Reliability·Governance·Intelligence）(§4) |
| NL | Natural Language | 自然语言(§39) |
| sLLM | Small LLM | 小型本地化语言模型，用于边缘/离线场景(§62) |
| RTO / RPO | Recovery Time / Point Objective | 恢复时间/点目标(§31) |

---

# 附录 A：版本变更历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| v1.0 | 2026-04 | 初始五平面架构 + 稳定性七层 + OAPEFLIR 概念设计 |
| v1.1 | 2026-04 | 增加风险矩阵、DLQ 模型、部署建议 |
| v1.2 | 2026-04 | 增加数据模型 44 表、事件命名空间、ADR 建议、推荐目录 |
| v2.0 | 2026-04-18 | **基础设施改善版**：新增平面间通信契约(§5)、API 契约(§6)、服务通信(§7)、可扩展性(§8)、配置治理(§24)、性能 SLO(§27)、容灾高可用(§31)；改善风险评分(§10)、OAPEFLIR 接口(§13)、存储抽象(§26)、部署(§32)、路线图(§33)；解决 v1.2 的 14 项设计缺陷 |
| v2.1 | 2026-04-19 | **AI 运营完备版**：新增 LLM Provider 抽象与故障切换(§15)、Prompt 管理与版本化(§16)、模型评估与质量门禁(§17)、成本管理与 Token 计量(§18)、Agent 间委托与协作(§19)、长时任务与 Workflow 休眠(§20)、人机协作模式(§21)、SDK 与开发者体验(§22)、合规与数据治理(§23)；改善 API 认证与 Webhook(§6)、安全威胁模型(§11)、告警路由与分布式 Tracing(§12)、Error Budget 与 LLM 延迟(§27)、Pack 生命周期与 Plugin 治理(§30)；新增 9 个 ADR；解决 v2.0 的 14 项 AI 运营层缺陷 |
| v2.2 | 2026-04-19 | **业务域接入完备版**：新增业务域建模与接入架构(§37)——DomainDescriptor 结构化领域建模、DomainRiskProfile 领域风险画像、DomainKnowledgeSchema 领域知识结构、DomainEvalFramework 领域评估框架、DomainPromptLibrary 领域 Prompt 库、DomainRecipe 领域模板原型、DomainInteractionPolicy 跨域交互策略、DomainGovernancePolicy 领域治理模型；新增业务域接入 Runbook(§38)——四阶段门禁流程（建模→开发→认证→灰度）；改善 Business Pack 模型(§30)关联 DomainDescriptor；新增 4 个 ADR；解决 v2.1 的 10 项业务域接入层缺陷 |
| v2.3 | 2026-04-19 | **智能交互完备版**：新增自然语言任务入口架构(§39)、目标分解引擎架构(§40)、主动式 Agent 框架(§41)、渐进式自主权模型(§42)、统一运营看板架构(§43)、非技术用户体验架构(§44)；新增 6 个 ADR；使平台从"Agent 基础设施"升级为面向非技术用户的"Agent 操作系统" |
| v2.4 | 2026-04-19 | **组织治理完备版**：新增组织层次模型(§46)、组织架构审批路由(§47)、企业 SSO/SCIM 集成(§48)、分部门合规策略引擎(§49)、知识域隔离与受控共享(§50)、分级治理委托(§51)；新增 6 个 ADR；使平台能适配从一人公司到万人企业的组织复杂度 |
| v2.5 | 2026-04-19 | **规模化生态完备版**：新增多 Region 部署架构(§52)、规模化资源竞争管理(§53)、SLA 分级保障(§54)、Agent 市场与生态(§55)、反馈驱动持续改进管线(§56)、外部系统集成框架(§57)；新增 6 个 ADR；补齐跨 Region 高可用、资源公平调度、SLA 差异化保障、开放生态和持续自我改进能力 |
| v2.6 | 2026-04-19 | **运营成熟度完备版**：新增 Agent 可解释性与决策透明度(§59)、紧急制动与全局熔断(§60)、Agent 统一生命周期管理(§61)、离线与边缘部署(§62)、Agent 行为漂移检测(§63)、成本归因与优化引擎(§64)、工作流可视化调试器(§65)、合规报告自动生成引擎(§66)、容量规划与成本预测(§67)、多模态能力(§68)、平台自运维 Agent(§69)；新增 11 个 ADR；补齐从"架构设计完整"到"可投产运营"的运营成熟度层 |
| v2.7 | 2026-04-19 | **质量修正版**：修复 ADR 自主权等级矛盾（monotonic→guarded progression）；统一 §9.5/§14.8 模式枚举为 8 模式规范集；补全 ExecutionPlan/StateCommand 缺失的 principal/trace_id 字段；扩展 Prompt 注入防御架构(§16.5)；修复 ADR-NL TaskSpec→RequestEnvelope 引用；补全 §26 数据模型（44→71 表）和 §28 事件命名空间（17→25）；补全 §33 路线图 Phase 5-7；补全 §43 L2/L3 看板视图定义；新增 §39.7 i18n、§44.6 WCAG、§52.4 GDPR 跨境传输、§55.4-55.6 市场收益/废弃/依赖管理、§15.6 流式错误处理；新增 §40 循环依赖检测、§5.2 P2→P4 通信路径；修复 §62 typo 和 §70 结论遗漏；新增附录 G 术语表 |
