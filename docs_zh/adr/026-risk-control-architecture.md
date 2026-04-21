# ADR-026 风险控制架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

Agent 作为高风险自动化执行单元，必须在执行前和执行后进行风险评估，防止危险操作导致业务损失。

## 决策

### 6 因子加权评分算法

| 因子 | 权重 | 说明 |
|------|------|------|
| stepTypeRisk | 3 | 步骤类型风险系数 |
| targetSystemRisk | 4 | 目标系统风险系数 |
| dataClassRisk | 3 | 数据类别风险系数 |
| blastRadius | 2 | 影响范围系数 |
| priorFailureRate | 2 | 历史失败率 |
| confidence | 1 | 模型置信度 |

### 风险评分公式

```
risk_score = (stepTypeRisk*3 + targetSystemRisk*4 + dataClassRisk*3 + blastRadius*2 + priorFailureRate*2 + confidence*1) / 13
```

### 4 级风险映射

| 级别 | 阈值 | 处理策略 |
|------|------|----------|
| low | 0-0.25 | 直接执行 |
| medium | 0.25-0.5 | 记录日志 |
| high | 0.5-0.75 | 需人工审批 |
| critical | 0.75-1.0 | break_glass 审批 |

### 配置

- `config/risk/default.json` 完整定义 6 因子和阈值
- RiskEvaluationEngine 实现评分计算

## 后果

优点：

- 量化风险使决策可追溯
- 分级处理策略平衡安全与效率
- 可配置的权重适应不同业务场景

代价：

- 风险评估增加执行延迟
- 历史数据积累需要时间

## 交叉引用

- [ADR-005 安全模型](./005-security-model.md)
- [ADR-021 平面间通信契约](./021-inter-plane-communication-contract.md)

## 来源章节

- `§10` 风险控制架构
