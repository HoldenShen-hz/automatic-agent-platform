# ADR-059 Agent 可解释性vsDecision透明度

- Status：Accepted
- Decision日期：2026-04-20

## Background

EU AI Act 等法规要求 AI Decision可解释，平台需要提供Decision透明度机制。

## Decision

### Decision追溯

```typescript
interface DecisionRecord {
  decision_id: string;
  harnessRunId: string;
  nodeRunId: string;
  planGraphId: string;
  context: DecisionContext;
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
  timestamp: string;
}
```

### 可解释性层iterations

| 层iterations | Description | 受众 |
|------|------|------|
| what | 做了什么 | 操作员 |
| why | 为什么做 | 分析师 |
| how | 如何做 | 开发者 |
| full | 完整推理链 | 审计员 |

### 解释生成

| 技术 | Description |
|------|------|
| Decision树提取 | 从神vianetwork提取规则 |
|注意力可视化 | 显示关键输入 |
| 反事实分析 | "如果...会怎样" |
| 案例推理 | class似Decision参考 |

### 审计日志

- 所有高风险Decisionrecord
- 不can be tamperedstorage
- supported查询和export

### 合规报告

- 自动生成合规报告
- supported监管机构审查
- 定期发布透明度报告

## Consequences

优点：

- 满足 EU AI Act 等法规要求
- 提高user信任
- 便于Issue定位和修复

代价：

- 解释生成增加delay
- storage成本增加

## 交叉references用

- [ADR-029 OAPEFLIR 受控认知内核](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 合规报告自动生成references擎](./066-compliance-report-auto-generation.md)

## 来源章节

- `§59` Agent 可解释性vsDecision透明度Architecture
