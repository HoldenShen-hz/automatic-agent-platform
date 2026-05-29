# ADR-063 Agent lines为漂移检测Architecture

- Status：Accepted
- Decision日期：2026-04-20

## Background

Agent lines为可能随time漂移，逐渐exceeds出质量threshold，需要持续监控和检测。

## Decision

### 漂移class型

| class型 | Description | 检测方法 |
|------|------|----------|
| input_drift | 输入分布变化 | 统计检验 |
| output_drift | 输出分布变化 | threshold监控 |
| behavioral_drift | lines为模式变化 | 序列比对 |
| quality_drift | 质量指标下降 | 滑动窗口 |

### 检测算法

```typescript
interface DriftDetectionConfig {
  method: DriftMethod;
  window_size: number;
  threshold: number;
  sensitivity: number;
}

type DriftMethod =
  | 'statistical_test'
  | 'threshold_monitoring'
  | 'sequence_comparison'
  | 'sliding_window';
```

### 漂移检测规则

| 规则 | 窗口 | threshold | 事件 |
|------|------|------|------|
| 输入分布 | 24h | -10% 偏移 | SEV3 |
| 输出分布 | 24h | -10% 偏移 | SEV3 |
| 错误率 | 5 分钟 | > 5% | SEV2 |
| delay | 5 分钟 | > 2x baseline | SEV2 |

### response机制

1. 检测到漂移
2. 触发告警
3. 隔离受Impact Agent
4. 启动Root Cause分析
5. 触发改进流程

## Consequences

优点：

- 早期发现Issue
- 防止质量劣化
- 自动化response

代价：

- 误报可能干扰业务
- 检测算法需要调优

## 交叉references用

- [平台Architecture §17 模型评估vs质量门禁](../architecture/00-platform-architecture.md)
- [ADR-080 Learn Hub vs四模式检测器](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§63` Agent lines为漂移检测Architecture
