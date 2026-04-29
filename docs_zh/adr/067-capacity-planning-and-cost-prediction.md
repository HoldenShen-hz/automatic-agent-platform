# ADR-067 容量规划与成本预测引擎

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

平台需要预测容量需求和成本趋势，支持前瞻性扩容决策。

## 环级标注

**Ring 3 — Enterprise**（§33）。容量规划与成本预测是规模化运营的核心能力，对应 Ring 3（Enterprise）完成阶段。Ring 1 MVP 阶段不需要完整的容量预测引擎，但必须预留 capacity 数据采集接口，避免后续扩展时埋点缺失。

## 决策

### 容量指标

| 指标 | 说明 | 采集频率 |
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

### 扩容建议

| 场景 | 建议 |
|------|------|
| 容量不足 | 增加 Worker |
| 资源浪费 | 缩减资源 |
| 性能瓶颈 | 优化配置 |
| 成本过高 | 降级/优化 |

### 成本预测

| 维度 | 预测要素 |
|------|----------|
| LLM 成本 | Token 消耗 × 单价 |
| 计算成本 | 实例 × 单价 × 时长 |
| 存储成本 | 存储量 × 单价 |
| 网络成本 | 流量 × 单价 |

### 容量规划报告

- 周度容量报告
- 扩容建议
- 成本预测
- 风险提示

## 后果

优点：

- 前瞻性规划避免紧急扩容
- 成本预测支持预算制定
- 优化建议降低成本

代价：

- 预测模型需要数据积累
- 预测准确性依赖模型质量

## 交叉引用

- [ADR-024 可扩展性架构](./024-scalability-architecture.md)
- [ADR-064 成本归因与优化引擎](./064-cost-attribution-and-optimization-engine.md)

## 来源章节

- `§67` 容量规划与成本预测引擎
