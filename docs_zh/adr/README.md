# Architecture Decision Records (ADR)

> 本目录包含项目的架构决策记录（ADR）。每个 ADR 记录重要技术决策的背景、考量与结论。
> `docs_zh/adr/README.md` 与 `docs_en/adr/README.md` 的编号、状态和日期必须保持同步；若正文翻译延后，按 `docs_zh/reference/docs-sync.md` 记录。
> ADR 索引按编号排序，不按决策日期排序，因此日期列不要求单调递增。

## ADR 索引

| 编号 | 标题 | 状态 | 决策日期 |
|------|------|------|----------|
| [001](./001-three-layer-architecture.md) | 三层分权架构 | Partially Superseded by v4.3 Five-Plane Baseline | 2026-04-02 |
| [002](./002-division-system.md) | 事业部系统 | Accepted | 2026-04-02 |
| [003A](./003-memory-six-layers.md) | 六层记忆模型与 KV Cache 固定前缀 | Superseded by ADR-020 | 2026-04-02 |
| [003B](./003-memory-seven-layers.md) | 七层记忆模型（历史别名 / 跳转页） | Superseded by ADR-020 | 2026-04-02 |
| [004](./004-workflow-routing.md) | 工作流与路由 | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | 安全模型 | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider 策略 | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | 进化引擎 | Partially Superseded by ADR-075 | 2026-04-02 |
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
| [018](./018-rollout-eleven-state-machine.md) | Rollout 十一态状态机与六阶段发布 | Superseded by ADR-075 | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff 四层序列化协议 | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory 六层平面与自动晋升规则 | Accepted | 2026-04-17 |
| [021](./021-inter-plane-communication-contract.md) | 平面间通信契约 | Accepted | 2026-04-03 |
| [022](./022-api-contract-and-versioning.md) | API 契约与版本化架构 | Accepted | 2026-04-03 |
| [023](./023-service-communication-architecture.md) | 服务通信架构 | Accepted | 2026-04-03 |
| [024](./024-scalability-architecture.md) | 可扩展性架构 | Accepted | 2026-04-03 |
| [025](./025-stability-architecture-seven-layers.md) | 稳定性架构 | Accepted | 2026-04-03 |
| [026](./026-risk-control-architecture.md) | 风险控制架构 | Accepted | 2026-04-03 |
| [027](./027-security-architecture.md) | 安全可靠架构 | Accepted | 2026-04-03 |
| [028](./028-incident-and-event-handling-architecture.md) | 异常事件处理架构 | Accepted | 2026-04-03 |
| [029](./029-oapeflir-controlled-cognition-kernel.md) | OAPEFLIR 受控认知内核 | Accepted | 2026-04-17 |
| [030](./030-runtime-execution-plane.md) | Runtime 执行面 | Accepted | 2026-04-03 |
| [031](./031-disaster-recovery-and-high-availability.md) | 容灾与高可用架构 | Accepted | 2026-04-03 |
| [032](./032-deployment-architecture.md) | 部署架构 | Accepted | 2026-04-03 |
| [033](./033-phased-roadmap.md) | 分阶段落地路线 | Superseded by ADR-112 | 2026-04-17 |
| [034](./034-adr-freeze-recommendation.md) | ADR 冻结建议 | Historical Context | 2026-04-17 |
| [035](./035-recommended-code-directory-structure.md) | 推荐代码目录 | Accepted | 2026-04-17 |
| [036](./036-risk-constraints-and-success-criteria.md) | 风险、约束与成功标准 | Accepted | 2026-04-17 |
| [037](./037-domain-modeling-and-onboarding.md) | 业务域建模与接入架构 | Accepted | 2026-04-20 |
| [038](./038-business-domain-onboarding-runbook.md) | 业务域接入 Runbook | Accepted | 2026-04-20 |
| [039](./039-natural-language-task-entry.md) | 自然语言任务入口架构 | Accepted | 2026-04-20 |
| [040](./040-goal-decomposition-engine.md) | 目标分解引擎架构 | Accepted | 2026-04-20 |
| [041](./041-proactive-agent-framework.md) | 主动式 Agent 框架 | Accepted | 2026-04-20 |
| [042](./042-progressive-autonomy-model.md) | 渐进式自主权模型 | Accepted | 2026-04-20 |
| [043](./043-unified-operations-dashboard.md) | Unified Operations Dashboard | Accepted | 2026-04-20 |
| [044](./044-non-technical-user-experience.md) | 非技术用户体验架构 | Accepted | 2026-04-20 |
| [045](./045-reserved-slot.md) | 预留号段 | Withdrawn | 2026-04-20 |
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
| [066](./066-compliance-report-auto-generation.md) | 合规报告自动生成引擎 | Accepted | 2026-04-20 |
| [067](./067-capacity-planning-and-cost-prediction.md) | 容量规划与成本预测引擎 | Accepted | 2026-04-20 |
| [068](./068-multimodal-capability-architecture.md) | 多模态能力架构 | Accepted | 2026-04-20 |
| [069](./069-platform-self-operating-agent.md) | 平台自运维 Agent 架构 | Partially Superseded by v4.3 control-plane and runtime authority ADRs | 2026-04-20 |
| [070](./070-conclusion.md) | 结论 | Withdrawn | 2026-04-20 |
| [071](./071-plugin-spi-framework.md) | Plugin SPI 接口体系与生命周期 | Accepted | 2026-04-17 |
| [072](./072-oapeflir-testing-strategy.md) | OAPEFLIR 测试策略与新模块测试矩阵 | Partially Superseded by current layered test matrix and runtime contract tests | 2026-04-17 |
| [073](./073-unified-resource-model.md) | Unified Agent Resource Model | Accepted | 2026-04-13 |
| [074](./074-reserved-slot.md) | 预留号段 | Withdrawn | 2026-04-20 |
| [075](./075-controlled-rollout-release.md) | 六级受控发布与 Rollout 状态机 | Accepted | 2026-04-17 |
| [076](./076-reserved-slot.md) | 预留号段 | Withdrawn | 2026-04-20 |
| [077](./077-reserved-slot.md) | 预留号段 | Withdrawn | 2026-04-20 |
| [078](./078-knowledge-plane-architecture.md) | Knowledge Plane 架构与信任模型 | Partially Superseded by current knowledge-plane contract baseline | 2026-04-17 |
| [079](./079-feedback-hub-signals.md) | Feedback Hub 与七类信号预处理 | Accepted | 2026-04-17 |
| [080](./080-learn-hub-pattern-detection.md) | Learn Hub 与四模式检测器 | Accepted | 2026-04-17 |
| [081](./081-domain-descriptor-and-onboarding.md) | Domain Descriptor And Onboarding | Accepted | 2026-04-20 |
| [082](./082-natural-language-entry-and-goal-decomposition.md) | Natural Language Entry And Goal Decomposition | Accepted | 2026-04-20 |
| [083](./083-proactive-agent-and-progressive-autonomy.md) | Proactive Agent And Progressive Autonomy | Accepted | 2026-04-20 |
| [084](./084-operator-dashboard-and-user-experience.md) | Operator Dashboard And User Experience | Accepted | 2026-04-20 |
| [085](./085-organization-governance-and-knowledge-boundary.md) | Organization Governance And Knowledge Boundary | Accepted | 2026-04-20 |
| [086](./086-scale-ecosystem-and-cross-region-runtime.md) | Scale Ecosystem And Cross Region Runtime | Accepted | 2026-04-20 |
| [087](./087-ops-maturity-runtime.md) | Ops Maturity Runtime | Accepted | 2026-04-20 |
| [088](./088-platform-surface-communication-and-extensibility.md) | Platform Surface、Communication、Extensibility | Accepted | 2026-04-20 |
| [089](./089-ai-operations-governance-and-quality.md) | AI Operations Governance And Quality | Accepted | 2026-04-20 |
| [090](./090-runtime-data-reliability-and-operations.md) | Runtime、Data Reliability、Operations | Accepted | 2026-04-20 |
| [091](./091-harness-eight-pillar-model.md) | Harness Eight Pillar Model | Accepted | 2026-04-23 |
| [092](./092-harness-loop-controller.md) | Harness Loop Controller | Accepted | 2026-04-23 |
| [093](./093-harness-constraint-engine.md) | Harness Constraint Engine | Accepted | 2026-04-23 |
| [094](./094-harness-durable-execution.md) | Harness Durable Execution | Accepted | 2026-04-23 |
| [095](./095-harness-context-assembly.md) | Harness Context Assembly | Accepted | 2026-04-23 |
| [096](./096-harness-recovery-controller.md) | Harness Recovery Controller | Accepted | 2026-04-23 |
| [097](./097-harness-guardrails.md) | Harness Guardrails | Accepted | 2026-04-23 |
| [098](./098-harness-hitl-runtime.md) | Harness HITL Runtime | Accepted | 2026-04-23 |
| [099](./099-harness-async-mode.md) | Harness Async Mode | Accepted | 2026-04-23 |
| [100](./100-domain-descriptor-semantic-layer.md) | Domain Descriptor As Semantic Layer | Accepted | 2026-04-23 |
| [101](./101-domain-risk-override-platform-default.md) | Domain Risk Override Over Platform Default | Accepted | 2026-04-23 |
| [102](./102-domain-recipe-onboarding-accelerator.md) | Domain Recipe As Onboarding Accelerator | Accepted | 2026-04-23 |
| [103](./103-four-phase-domain-onboarding.md) | Four Phase Domain Onboarding | Accepted | 2026-04-23 |
| [104](./104-domain-recipe-twelve-archetypes.md) | Domain Recipe Twelve Archetypes | Accepted | 2026-04-23 |
| [105](./105-domain-latency-tier-classification.md) | Domain Latency Tier Classification | Accepted | 2026-04-23 |
| [106](./106-quant-trading-pre-trade-risk-mandatory.md) | Quant Trading Pre Trade Risk Mandatory | Accepted | 2026-04-23 |
| [107](./107-financial-services-explainable-decisions.md) | Financial Services Explainable Decisions | Accepted | 2026-04-23 |
| [108](./108-legal-output-attorney-review-mandatory.md) | Legal Output Attorney Review Mandatory | Accepted | 2026-04-23 |
| [109](./109-contract-freeze.md) | v4.3 Contract Freeze | Accepted | 2026-04-27 |
| [110](./110-runtime-state-machine-authority.md) | Runtime State Machine Authority | Accepted | 2026-04-27 |
| [111](./111-platform-fact-vs-oapeflir-view-events.md) | Platform Fact vs OAPEFLIR View Events | Accepted | 2026-04-27 |
| [112](./112-mvp-ring-implementation-boundary.md) | MVP Ring Implementation Boundary | Accepted | 2026-04-27 |
| [113](./113-session-tenant-resolution-and-principal-scope.md) | Session Tenant Resolution And Principal Scope | Accepted | 2026-05-25 |
| [114](./114-http-auth-precedence-and-service-delegation.md) | HTTP Auth Precedence And Service Delegation | Accepted | 2026-05-25 |
| [115](./115-self-healing-simulation-boundary.md) | Self Healing Simulation Boundary | Accepted | 2026-05-25 |
| [116](./116-interface-rate-limit-key-design.md) | Interface Rate Limit Key Design | Accepted | 2026-05-25 |
| [117](./117-cost-event-wal-recovery.md) | Cost Event WAL Recovery | Accepted | 2026-05-25 |
| [118](./118-panic-allowlist-governance.md) | Panic Allowlist Governance | Accepted | 2026-05-25 |
| [119](./119-pack-domain-lifecycle-coordination.md) | Pack Domain Lifecycle Coordination | Accepted | 2026-05-25 |
| [120](./120-ui-sdk-client-transport-boundary.md) | UI 与 SDK Client Transport Boundary | Accepted | 2026-05-25 |
| [121](./121-timeout-and-worker-liveness-hierarchy.md) | Timeout 与 Worker Liveness Hierarchy | Accepted | 2026-05-25 |
| [122](./122-domain-evidence-and-session-boundary.md) | Domain Evidence 与 Session Replay Boundary | Accepted | 2026-05-25 |

## 状态说明

- **Draft**: 正在讨论中，尚未做出决定
- **Proposed**: 已提出，等待审批
- **Accepted**: 已接受并实施
- **Superseded**: 已被新的 ADR 取代
- **Deprecated**: 已废弃
- **Withdrawn**: 号段保留或索引占位，不再作为实现依据
- **Historical Context**: 仅保留历史背景，不作为当前实现依据
- **Partially Superseded by ...**: 仍保留背景价值，但当前执行依据已被后续 ADR 或 contract 部分接管

## 备注

- 历史目录同时保留 `003-memory-six-layers.md` 与 `003-memory-seven-layers.md`；其中 `seven-layers` 仅保留为历史别名 / 跳转页，规范内容以 `003-memory-six-layers.md` 为准。
- Plugin SPI ADR 已统一收敛到 `071-plugin-spi-framework.md`；旧的 `066-plugin-spi-framework.md` 重复副本已移除，所有引用统一改到 ADR-071。
- `045`、`074`、`076`、`077` 目前保留为 reserved / withdrawn 号段，不再回填历史内容，并要求保留显式占位文件。
- 新增的 `091-108` 用于承接 Harness 八支柱与领域治理补齐项。
- 新增的 `109-122` 是 v4.3 Contract Freeze 与后续实现澄清入口：冻结 12 个 canonical contract、状态机唯一权威、`platform.*` 与 `oapeflir.view.*` 事件分层、MVP / Hardening / Enterprise 三环边界，以及 tenant scope / auth precedence / self-healing boundary / interface rate-limit / WAL recovery / panic allowlist / pack-domain lifecycle / client transport / timeout hierarchy / evidence boundary 的权威说明。
- `109-122` 通过 freeze / authority / event namespace / ring boundary / tenant scope / auth precedence / recovery boundary 等规则约束旧 `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / OAPEFLIR runtime authority / Phase 命名、tenant 解析与跨层边界语义；历史 ADR 正文保留，不直接改写。
- `069` 的后继重点是 `ADR-109`、`ADR-110`、`ADR-112`。
- `072` 的后继重点是 `ADR-109`、`ADR-110`、当前 layered test matrix 与 runtime contract tests。
- `078` 的后继重点是 `ADR-109`、`ADR-111` 以及知识面相关 canonical contracts。

## 创建新 ADR

新 ADR 应遵循标准模板；编号按批次和演进阶段保留号段，不强制补齐历史间隙。详情参考 [../governance/source_of_truth.md](../governance/source_of_truth.md)。
