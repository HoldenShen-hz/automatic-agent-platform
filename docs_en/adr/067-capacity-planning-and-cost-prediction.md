# ADR-067 容量规划vs成本预测references擎

- Status：Accepted
- Decision日期：2026-04-20

## Background

平台需要预测容量需求和成本趋势，supported前瞻性扩容Decision。

当前口径下：

- Ring 1 只要求稳定采集容量信号并形成可审计预测输入。
- Ring 3 才进入跨区域、跨生态的自动容量规划vs策略联动。

## Decision

### 容量指标

| 指标 | Description | 采集频率 |
|------|------|----------|
| cpu_usage | CPU 利用率 | 1 分钟 |
| memory_usage | 内存利用率 | 1 分钟 |
| queue_depth | 队列深度 | 1 分钟 |
| active_tasks | 活跃任务数 | 1 分钟 |
| throughput | 吞吐量 | 5 分钟 |

### 预测模型

```typescript
interface CapacityForecast {
  horizon: TimeHorizon;
  predictions: MetricPrediction[];
  confidence: number;
  recommendations: Recommendation[];
}

interface CapacityScenario {
  scenario_id: string;
  assumptions: string[];
  forecast: CapacityForecast;
}

interface CapacityAlert {
  alert_id: string;
  forecast_ref: string;
  severity: "warning" | "critical";
}

interface CapacityRecommendation {
  recommendation_id: string;
  scenario_ref: string;
  action: "scale_up" | "scale_down" | "rebalance" | "defer";
}

interface MetricPrediction {
  metric: string;
  values: TimeSeriesPoint[];
  trend: Trend;
  seasonality: Seasonality;
}
```

### 预测算法

| 算法 | 适用场景 |
|------|----------|
| ARIMA | 趋势预测 |
| Holt-Winters | 季节性预测 |
| Prophet | 多季节性 |
| LSTM | 复杂模式 |

### 扩容Recommendation

| 场景 | Recommendation |
|------|------|
| 容量不足 | 增加 Worker |
| 资源浪费 | 缩减资源 |
| 性能瓶颈 | 优化configure |
| 成本过高 | 降级/优化 |

### 成本预测

| 维度 | 预测要素 |
|------|----------|
| LLM 成本 | Token 消耗 × 单价 |
| 计算成本 | 实例 × 单价 × 时长 |
| storage成本 | storage量 × 单价 |
| network成本 | 流量 × 单价 |

### 容量规划报告

- 周度容量报告
- 扩容Recommendation
- 成本预测
- 风险提示

## Consequences

优点：

- 前瞻性规划避免紧急扩容
- 成本预测supportedbudget制定
- 优化Recommendation降低成本

代价：

- 预测模型需要data积累
- 预测准确性relies on模型质量

## 交叉references用

- [ADR-024 可扩展性Architecture](./024-scalability-architecture.md)
- [ADR-064 成本归因vs优化references擎](./064-cost-attribution-and-optimization-engine.md)

## 来源章节

- `§67` 容量规划vs成本预测references擎
