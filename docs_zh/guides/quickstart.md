# Quickstart

## 目标

这份文档帮助你在拆分后的文档体系里快速找到阅读路径，并把注意力聚焦到当前最应该实现的基建范围，而不是重新掉回超长文档里迷路。

## 推荐阅读顺序

1. 先读 [平台骨架](../architecture/00-platform-architecture.md)，建立全局心智模型。
2. 再读 [ADR-001](../adr/001-three-layer-architecture.md)、[ADR-004](../adr/004-workflow-routing.md)、[ADR-009](../adr/009-deployment-ops.md)，理解核心主链路。
3. 如果当前要实现记忆、成本或安全，再分别补读 [ADR-003](../adr/003-memory-seven-layers.md)、[ADR-008](../adr/008-cost-model.md)、[ADR-005](../adr/005-security-model.md)。
4. 如果当前要新增业务能力，最后读 [Division Authoring](./division-authoring.md)。

## 当前建议实现范围

优先只做 Phase 1a 和 Phase 1b 的必需能力：

- 单 Agent 基建核心。
- VP 运营接入与路由。
- 基础工作流状态管理。
- 消息与事件持久化。
- 成本守卫和基础审批。
- 崩溃恢复。
- 多 Agent 编排的最小 happy path。

暂时不要提前做的内容：

- 多租户。
- Marketplace。
- 完整 8 维进化。
- 全量长期记忆/知识治理能力一次性铺开。
- 过多事业部铺设。
- 复杂 Web 体验和企业级合规能力。

## Phase 1a 落地顺序建议

1. 建立项目目录和配置骨架。
2. 实现任务、会话、事件和工作流状态的最小存储模型。
3. 打通单任务从接收、执行到返回的 happy path。
4. 加入成本守卫、基础审批和错误体系。

## Phase 1b 补强建议

1. 引入 VP 运营、VP 编排和基础任务看板。
2. 打通跨事业部拆分和结果聚合。
3. 增加恢复、自愈和流式输出。
4. 为后续记忆与监管预留埋点。

## 文档约定

- 总纲负责说明“平台是什么”。
- ADR 负责说明“为什么这么设计”。
- Guides 负责说明“具体怎么做”。
- 去重归档版只作为历史参考，不再作为首选入口。
