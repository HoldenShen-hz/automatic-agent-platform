# Architecture Decision Records (ADR)

> 本目录包含项目的架构决策记录（ADR）。每个 ADR 记录了一个重要技术决策的背景、考量与结论。

## ADR 索引

| 编号 | 标题 | 状态 | 决策日期 |
|------|------|------|----------|
| [001](./001-three-layer-architecture.md) | 三层分权架构 | Accepted | 2026-04-02 |
| [002](./002-division-system.md) | 事业部系统 | Accepted | 2026-04-02 |
| [003](./003-memory-seven-layers.md) | 六层记忆与 KV Cache 固定前缀 | Accepted | 2026-04-02 |
| [004](./004-workflow-routing.md) | 工作流与路由 | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | 安全模型 | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider 策略 | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | 进化引擎 | Accepted | 2026-04-02 |
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
| [018](./018-rollout-eleven-state-machine.md) | Rollout 十一态状态机与六阶段发布 | Accepted | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff 四层序列化协议 | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory 六层平面与自动晋升规则 | Accepted | 2026-04-17 |
| [060](./060-explicit-planning-hub.md) | 显式规划层与 Plan Hub | Accepted | 2026-04-17 |
| [066](./066-plugin-spi-framework.md) | Plugin SPI 框架 | Accepted | 2026-04-17 |
| [072](./072-oapeflir-testing-strategy.md) | OAPEFLIR 测试策略 | Accepted | 2026-04-17 |
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

## 状态说明

- **Draft**: 正在讨论中，尚未做出决定
- **Proposed**: 已提出，等待审批
- **Accepted**: 已接受并实施
- **Superseded**: 已被新的 ADR 取代
- **Deprecated**: 已废弃

## 创建新 ADR

新 ADR 应遵循标准模板，编号顺序递增。详情参考 [../governance/source_of_truth.md](../governance/source_of_truth.md)。
