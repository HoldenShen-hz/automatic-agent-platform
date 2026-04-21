# ADR-064 成本归因与优化引擎

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

LLM 成本是 OPEX 的主要组成部分，需要精确的成本归因和优化指导。

## 决策

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
  workflow_id?: string;
  step_id?: string;
  model_id?: string;
}
```

### 成本类型

| 类型 | 说明 |
|------|------|
| llm_token | LLM Token 消耗 |
| compute | 计算资源 |
| storage | 存储资源 |
| network | 网络带宽 |
| api_call | 外部 API |

### 优化建议

| 建议类型 | 说明 | 预期节省 |
|----------|------|----------|
| prompt压缩 | 减少 Token 消耗 | 20-40% |
| 模型降级 | 使用更便宜模型 | 30-60% |
| 缓存复用 | 缓存相似请求 | 50-80% |
| 批处理 | 批量请求合并 | 20-30% |

### 预算控制

- 4 级预算：platform/tenant/pack/step
- 实时预算监控
- 预算超支告警
- 自动降级

### 成本报表

- 实时成本看板
- 历史趋势分析
- 预算执行报告
- 优化效果追踪

## 后果

优点：

- 精确归因指导优化
- 预算控制防止超支
- 报表便于管理层决策

代价：

- 计量增加开销
- 优化建议