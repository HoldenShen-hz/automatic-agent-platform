# ADR-059 Agent 可解释性与决策透明度

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

EU AI Act 等法规要求 AI 决策可解释，平台需要提供决策透明度机制。

## 决策

### 决策追溯

```typescript
interface DecisionRecord {
  decision_id: string;
  agent_id: string;
  harness_run_id?: string;   // §5.5 所有决策须链接到 HarnessRun
  node_run_id?: string;      // §5.5 决策上下文节点
  plan_graph_id?: string;    // §5.5 决策关联的计划图
  context: DecisionContext;
  reasoning: string;
  evidence: Evidence[];
  confidence: number;
  timestamp: string;
}
```

注：所有 DecisionRecord 必须通过 `harness_run_id` / `node_run_id` / `plan_graph_id` 链接到 HarnessRun，以满足 §5.5 决策追溯要求。

### 可解释性层次

| 层次 | 说明 | 受众 |
|------|------|------|
| what | 做了什么 | 操作员 |
| why | 为什么做 | 分析师 |
| how | 如何做 | 开发者 |
| full | 完整推理链 | 审计员 |

### 解释生成

| 技术 | 说明 |
|------|------|
| 决策树提取 | 从神经网络提取规则 |
|注意力可视化 | 显示关键输入 |
| 反事实分析 | "如果...会怎样" |
| 案例推理 | 类似决策参考 |

### 审计日志

- 所有高风险决策记录
- 不可篡改存储
- 支持查询和导出

### 合规报告

- 自动生成合规报告
- 支持监管机构审查
- 定期发布透明度报告

## 后果

优点：

- 满足 EU AI Act 等法规要求
- 提高用户信任
- 便于问题定位和修复

代价：

- 解释生成增加延迟
- 存储成本增加

## 交叉引用

- [ADR-029 OAPEFLIR 受控认知内核](./029-oapeflir-controlled-cognition-kernel.md)
- [ADR-066 合规报告自动生成引擎](./066-compliance-report-auto-generation.md)

## 来源章节

- `§59` Agent 可解释性与决策透明度架构
