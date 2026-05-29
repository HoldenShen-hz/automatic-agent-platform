# ADR-064 成本归因vs优化references擎

- Status：Accepted
- Decision日期：2026-04-20

## Background

LLM 成本is OPEX 的主要组成部分，需要精确的成本归因和优化指导。

## Decision

### 成本归因模型

```typescript
interface CostAttribution {
  dimension: CostDimension;
  amount: number;
  currency: string;
  period: TimePeriod;
}

interface CostDimension {
  tenant_id: string;
  domain_id?: string;
  agent_id?: string;
  harness_run_id?: string;
  node_run_id?: string;
  budget_settlement_ref?: string;
  model_id?: string;
}
```

### 成本class型

| class型 | Description |
|------|------|
| llm_token | LLM Token 消耗 |
| compute | 计算资源 |
| storage | storage资源 |
| network | network带宽 |
| api_call | 外部 API |

### 优化Recommendation

| Recommendationclass型 | Description | 预期节省 |
|----------|------|----------|
| prompt压缩 | 减少 Token 消耗 | 20-40% |
| 模型降级 | uses更便宜模型 | 30-60% |
| cache复用 | cache相似request | 50-80% |
| 批handle | 批量request合并 | 20-30% |

### budget控制

- 4 级budget：platform/tenant/harness_run/node_run
- 实时budget监控
- budgetexceeds支告警
- 自动降级

### 成本报table

- 实时成本看板
- 历史趋势分析
- budget执lines报告
- 优化效果追踪

## Consequences

优点：

- 精确归因指导优化
- budget控制防止exceeds支
- 报table便于manage层Decision

代价：

- 计量增加开销
- 优化Recommendation

## v4.3 ADR Remediation

- A-23: 本 ADR 原先继续用 `workflow_id / step_id` 做成本维度，Root cause: 成本references擎 ADR accesses along用了线性 workflow 粒度，没有随着 v4.3 执lines真相对象切换到 `HarnessRun / NodeRun / BudgetSettlement`。修复：正文现把 `CostDimension` 收敛到 `harness_run_id / node_run_id / budget_settlement_ref`。
