# Architecture Decision Records (ADR)

> 本目录包含项目的架构决策记录（ADR）。每个 ADR 记录了一个重要技术决策的背景、考量与结论。

## ADR 索引

| 编号 | 标题 | 状态 | 决策日期 |
|------|------|------|----------|
| [001](./001-three-layer-architecture.md) | 三层分权架构 | Accepted | 2026-04-02 |
| [002](./002-division-system.md) | 事业部系统 | Accepted | 2026-04-02 |
| [003](./003-memory-seven-layers.md) | 六层记忆与 KV Cache 固定前缀 | **Superseded by ADR-020** | 2026-04-02 |
| [004](./004-workflow-routing.md) | 工作流与路由 | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | 安全模型 | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider 策略 | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | 进化引擎 | **Partially Superseded by ADR-075** | 2026-04-02 |
| [008](./008-cost-model.md) | 成本模型 | Accepted | 2026-04-02 |
| [009](./009-deployment-ops.md) | 部署与运维 | Accepted | 2026-04-02 |
| [010](./010-commercial-model.md) | 商业模型 | Accepted | 2026-04-02 |
| [011](./011-effect-ts-adoption.md) | Effect-TS 是否作为核心运行时基础 | Accepted | 2026-04-03 |
| [012](./012-sqlite-phase-1-2-primary-store.md) | SQLite 是否作为 Phase 1-2 唯一主存储 | Accepted | 2026-04-03 |
| [013](./013-eventemitter-phase-2-boundary.md) | EventEmitter 是否继续使用到 Phase 2 | Accepted | 2026-04-03 |
| [014](./014-org-model-code-boundary.md) | 组织模型是否直接映射到代码对象 | Accepted | 2026-04-03 |
| [015](./015-unified-extension-marketplace.md) | Skill 与 Plugin 是否收敛为单市场 | Accepted | 2026-04-03 |
| [016](./016-oapeflir-loop-model.md) | OAPEFLIR 八阶段认知循环模型 | Accepted | 2026-04-17 |
| [017](./017-knowledge-architecture-refactor.md) | Knowledge 三索引架构重构 | Accepted | 2026-04-17 |
| [018](./018-rollout-eleven-state-machine.md) | Rollout 十一态状态机与六阶段发布 | **Superseded by ADR-075** | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff 四层序列化协议 | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory 六层平面与自动晋升规则 | Accepted | 2026-04-17 |
| [021](./021-inter-plane-communication-contract.md) | 平面间通信契约 | Accepted | 2026-04-03 |
| [022](./022-api-contract-and-versioning.md) | API 契约与版本化架构 | Accepted | 2026-04-03 |
| [023](./023-service-communication-architecture.md) | 服务通信架构 | Accepted | 2026-04-03 |
| [024](./024-scalability-architecture.md) | 可扩展性架构 | Accepted | 2026-04-03 |
| [025](./025-stability-architecture-seven-layers.md) | 稳定性架构（7 层） | Accepted | 2026-04-03 |
| [026](./026-risk-control-architecture.md) | 风险控制架构 | Accepted | 2026-04-03 |
| [027](./027-security-architecture.md) | 安全可靠架构 | Accepted | 2026-04-03 |
| [028](./028-incident-and-event-handling-architecture.md) | 异常事件处理架构 | Accepted | 2026-04-03 |
| [029](./029-oapeflir-controlled-cognition-kernel.md) | OAPEFLIR 受控认知内核 | Accepted | 2026-04-17 |
| [030](./030-runtime-execution-plane.md) | Runtime 执行面 | Accepted | 2026-04-03 |
| [031](./031-disaster-recovery-and-high-availability.md) | 容灾与高可用架构 | Accepted | 2026-04-03 |
| [032](./032-deployment-architecture.md) | 部署架构 | Accepted | 2026-04-03 |
| [033](./033-phased-roadmap.md) | 分阶段落地路线 | Accepted | 2026-04-17 |
| [034](./034-adr-freeze-recommendation.md) | ADR 冻结建议 | Accepted | 2026-04-17 |
| [035](./035-recommended-code-directory-structure.md) | 推荐代码目录结构 | Accepted | 2026-04-17 |
| [036](./036-risk-constraints-and-success-criteria.md) | 风险、约束与成功标准 | Accepted | 2026-04-17 |
| [037](./037-domain-modeling-and-onboarding.md) | 业务域建模与接入架构 | Accepted | 2026-04-20 |
| [038](./038-business-domain-onboarding-runbook.md) | 业务域接入 Runbook | Accepted | 2026-04-20 |
| [039](./039-natural-language-task-entry.md) | 自然语言任务入口架构 | Accepted | 2026-04-20 |
| [040](./040-goal-decomposition-engine.md) | 目标分解引擎架构 | Accepted | 2026-04-20 |
| [041](./041-proactive-agent-framework.md) | 主动式 Agent 框架 | Accepted | 2026-04-20 |
| [042](./042-progressive-autonomy-model.md) | 渐进式自主权模型 | Accepted | 2026-04-20 |
| [043](./043-unified-operations-dashboard.md) | 统一运营看板架构 | Accepted | 2026-04-20 |
| [044](./044-non-technical-user-experience.md) | 非技术用户体验架构 | Accepted | 2026-04-20 |
| [046](./046-organization-hierarchy-model.md) | 组织层次模型 | Accepted | 2026-04-20 |
| [047](./047-organization-approval-routing.md) | 组织架构审批路由 | Accepted | 2026-04-20 |
| [048](./048-enterprise-sso-scim-integration.md) | 企业 SSO/SCIM 集成架构 | Accepted | 2026-04-20 |
| [049](./049-department-compliance-policy-engine.md) | 分部门合规策略引擎 | Accepted | 2026-04-20 |
| [050](./050-knowledge-domain-isolation.md) | 知识域隔离与受控共享 | Accepted | 2026-04-20 |
| [051](./051-tiered-governance-delegation.md) | 分级治理委托 | Accepted | 2026-04-20 |
| [052](./052-multi-region-deployment-architecture.md) | 多 Region 部署架构 | Accepted | 2026-04-20 |
| [053](./053-scaling-resource-competition-management.md) | 规模化资源竞争管理 | Accepted | 2026-04-20 |
| [054](./054-sla-tiered-guarantees.md) | SLA 分级保障 | Accepted | 2026-04-20 |
| [055](./055-agent-marketplace-and-ecosystem.md) | Agent 市场与生态 | Accepted | 2026-04-20 |
| [056](./056-feedback-driven-continuous-improvement.md) | 反馈驱动持续改进管线 | Accepted | 2026-04-20 |
| [057](./057-external-system-integration-framework.md) | 外部系统集成框架 | Accepted | 2026-04-20 |
| [058](./058-emergency-stop-and-global-circuit-breaker.md) | 紧急制动与全局熔断架构 | Accepted | 2026-04-20 |
| [059](./059-agent-explainability-and-decision-transparency.md) | Agent 可解释性与决策透明度 | Accepted | 2026-04-20 |
| [060](./060-explicit-planning-hub.md) | 显式规划层与 Plan Hub | Accepted | 2026-04-17 |
| [061](./061-agent-unified-lifecycle-management.md) | Agent 统一生命周期管理架构 | Accepted | 2026-04-20 |
| [062](./062-offline-and-edge-deployment-architecture.md) | 离线与边缘部署架构 | Accepted | 2026-04-20 |
| [063](./063-agent-behavior-drift-detection.md) | Agent 行为漂移检测架构 | Accepted | 2026-04-20 |
| [064](./064-cost-attribution-and-optimization-engine.md) | 成本归因与优化引擎 | Accepted | 2026-04-20 |
| [065](./065-workflow-visual-debugger.md) | 工作流可视化调试器架构 | Accepted | 2026-04-20 |
| [066](./066-compliance-report-auto-generation.md) | 合规报告自动生成架构 | Accepted | 2026-04-20 |
| [066](./066-plugin-spi-framework.md) | Plugin SPI 框架 | Accepted | 2026-04-17 |
| [067](./067-capacity-planning-and-cost-prediction.md) | 容量规划与成本预测引擎 | Accepted | 2026-04-20 |
| [068](./068-multimodal-capability-architecture.md) | 多模态能力架构 | Accepted | 2026-04-20 |
| [069](./069-platform-self-operating-agent.md) | 平台自运维 Agent 架构 | Accepted | 2026-04-20 |
| [070](./070-conclusion.md) | 结论 | Accepted | 2026-04-20 |
| [072](./072-oapeflir-testing-strategy.md) | OAPEFLIR 测试策略 | Accepted | 2026-04-17 |
| [073](./073-unified-resource-model.md) | Unified Agent Resource Model | Accepted | 2026-04-17 |
| [075](./075-controlled-rollout-release.md) | 六级受控发布与 Rollout 状态机 | Accepted | 2026-04-17 |
| [078](./078-knowledge-plane-architecture.md) | Knowledge Plane 架构 | Accepted | 2026-04-17 |
| [079](./079-feedback-hub-signals.md) | Feedback Hub 与信号系统 | Accepted | 2026-04-17 |
| [080](./080-learn-hub-pattern-detection.md) | Learn Hub 与模式检测 | Accepted | 2026-04-17 |
| [081](./081-domain-descriptor-and-onboarding.md) | DomainDescriptor 与领域接入 Runbook | Accepted | 2026-04-20 |
| [082](./082-natural-language-entry-and-goal-decomposition.md) | 自然语言入口与目标分解引擎 | Accepted | 2026-04-20 |
| [083](./083-proactive-agent-and-progressive-autonomy.md) | 主动式 Agent 与渐进式自主权 | Accepted | 2026-04-20 |
| [084](./084-operator-dashboard-and-user-experience.md) | 运营看板与非技术用户体验 | Accepted | 2026-04-20 |
| [085](./085-organization-governance-and-knowledge-boundary.md) | 组织治理、审批与知识边界 | Accepted | 2026-04-20 |
| [086](./086-scale-ecosystem-and-cross-region-runtime.md) | 规模化生态与跨 Region 运行时 | Accepted | 2026-04-20 |
| [087](./087-ops-maturity-runtime.md) | 运营成熟度运行时扩展层 | Accepted | 2026-04-20 |
| [088](./088-platform-surface-communication-and-extensibility.md) | 平台表面、通信与扩展治理 | Accepted | 2026-04-20 |
| [089](./089-ai-operations-governance-and-quality.md) | AI 运营治理与质量门禁 | Accepted | 2026-04-20 |
| [090](./090-runtime-data-reliability-and-operations.md) | Runtime、数据可靠性与运维治理 | Accepted | 2026-04-20 |

## 状态说明

- **Draft**: 正在讨论中，尚未做出决定
- **Proposed**: 已提出，等待审批
- **Accepted**: 已接受并实施
- **Superseded**: 已被新的 ADR 取代
- **Deprecated**: 已废弃

## 创建新 ADR

新 ADR 应遵循标准模板；编号按批次和演进阶段保留号段，不强制补齐历史间隙。详情参考 [../governance/source_of_truth.md](../governance/source_of_truth.md)。
