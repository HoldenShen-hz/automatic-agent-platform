# ADR-063 Agent 行为漂移检测架构

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

Agent 行为可能随时间漂移，逐渐超出质量阈值，需要持续监控和检测。

## 决策

### 漂移类型

| 类型 | 说明 | 检测方法 |
|------|------|----------|
| input_drift | 输入分布变化 | 统计检验 |
| output_drift | 输出分布变化 | 阈值监控 |
| behavioral_drift | 行为模式变化 | 序列比对 |
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

| 规则 | 窗口 | 阈值 | 事件 |
|------|------|------|------|
| 输入分布 | 24h | -10% 偏移 | SEV3 |
| 输出分布 | 24h | -10% 偏移 | SEV3 |
| 错误率 | 5 分钟 | > 5% | SEV2 |
| 延迟 | 5 分钟 | > 2x baseline | SEV2 |

### 响应机制

1. 检测到漂移
2. 触发告警
3. 隔离受影响 Agent
4. 启动根因分析
5. 触发改进流程

## 后果

优点：

- 早期发现问题
- 防止质量劣化
- 自动化响应

代价：

- 误报可能干扰业务
- 检测算法需要调优

## 交叉引用

- [平台架构 §17 模型评估与质量门禁](../architecture/00-platform-architecture.md)
- [ADR-080 Learn Hub 与四模式检测器](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§63` Agent 行为漂移检测架构
