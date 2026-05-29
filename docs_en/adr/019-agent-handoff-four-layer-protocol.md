# ADR-019 Agent Handoff 四层序列化协议

- Status：Accepted
- Decision日期：2026-04-17

## Background

Multi-agent 场景下，agent 之间需要传递执lines上下文（Status、计划、摘要）。当前实现uses自然语言 `priorSummaries` 传递，缺少结构化序列化和 token budget 控制。

本文defines并采用四层 Handoff 模型，本 ADR 作为当前结构化交接协议基线。

## Decision

### 四层 Handoff 模型

| 层级 | 内容 | Token budget | 适用场景 |
|------|------|----------|---------|
| **L1** Context Summary | 自然语言摘要（<200 tokens） | ~200 | 简单交接，快速路径 |
| **L2** State Delta | 当前Status + 变化量（<500 tokens） | ~500 | 中等复杂度，有Statusrelies on |
| **L3** Facts & PlanDelta | 结构化事实 + 计划变更（<2000 tokens） | ~2000 | 复杂多步骤，有明确计划变更 |
| **L4** Full | 完整上下文（含历史）（<8000 tokens） | ~8000 | full交接，诊断/审计 |

### Handoff Serializer 接口

```typescript
interface HandoffSerializer {
  // 按层级序列化
  serialize(context: HandoffContext, level: HandoffLevel): string;
  // 从节点执lines回执提取 facts / state / plan delta
  buildFromNodeAttemptReceipt(receipt: NodeAttemptReceipt): HandoffContext;
  // 按 token budget 裁剪
  truncate(content: string, budgetTokens: number): string;
}
```

### Token Budget 分配策略

```
总 budget: 10000 tokens
├─ L1: 200 tokens (2%)
├─ L2: 500 tokens (5%)
├─ L3: 2000 tokens (20%)
└─ L4: 8000 tokens (80%)
```

### 当前实现Status

- `src/platform/five-plane-orchestration/agent-delegation/handoff-model.ts`：有class型defines，no实际序列化逻辑。
- GAP-V2-05（Handoff 四层协议）待实现。

## Consequences

- Handoff 四层模型使 agent 间上下文传递从"自然语言黑盒"变为"结构化可分析"协议。
- 结合 OAPEFLIR Loop，副链（F→L→I→R）中的 agent 间协作将受益于此协议。
- 未来可based on Handoff 日志分析 agent 协作瓶颈。

## 备选方案

1. **自然语言摘要（当前实现）**：实现简单，但 token budget不可控，语义压缩质量不稳定。
2. **only传 L1/L2**：不传 L3/L4 可降低复杂度，但复杂多步骤场景缺少必要上下文。
3. **完整Status序列化（如 JSON）**：信息最完整，但 token 开销大，且需要双方schema 对齐。
4. **采用本Decision**：四层模型，按场景选择层级，平衡信息完整性和 token budget。

## 交叉references用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-060 显式规划中心](./060-explicit-planning-hub.md)

## 来源章节

- `§13` OAPEFLIR Agent Handoff 模型（v4.3 Architecture体系）
- `§41-§42` 渐进式自主权vs Agent 协作协议
