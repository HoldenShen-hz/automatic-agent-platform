# ADR-026 风险控制架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

Agent 作为高风险自动化执行单元，必须在执行前和执行后进行风险评估，防止危险操作导致业务损失。

## 决策

### 8 因子加权评分算法（§10.2 canonical）

| 因子 | 权重 | 说明 |
|------|------|------|
| operationRisk | 4 | 操作对业务/系统的影响程度 |
| irreversibility | 4 | 结果不可逆的程度 |
| dataSensitivity | 3 | 输入/输出涉及的数据敏感级别 |
| targetResourceCriticality | 3 | 目标资源关键性 |
| autonomyModeRisk | 2 | 当前 runtime mode 带来的自动化放大风险 |
| tenantImpact | 2 | 影响租户/组织范围 |
| blastRadius | 2 | 失败扩散半径 |
| historicalFailureRate | 2 | 同类动作历史失败率 |
| evidenceConfidence | 1 | 证据充分性与判断置信度 |

### 风险评分公式（§10.2 canonical）

```
risk_score = (
  operationRisk*4 +
  irreversibility*4 +
  dataSensitivity*3 +
  targetResourceCriticality*3 +
  autonomyModeRisk*2 +
  tenantImpact*2 +
  blastRadius*2 +
  historicalFailureRate*2 +
  evidenceConfidence*1
) / 20
```

### 4 级风险映射（§10.2 canonical）

| 级别 | 阈值 | 处理策略 |
|------|------|----------|
| low | 0-0.25 | 直接执行 |
| medium | 0.25-0.5 | 记录日志 |
| high | 0.5-0.75 | 需人工审批 |
| critical | 0.75-1.0 | break_glass 审批 |

### 配置

- `config/risk/default.json` 完整定义 8 因子和阈值
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

## v4.3 ADR Remediation

- A-18: 本 ADR 原先保留 `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence` 六因子模型，根因是风险 ADR 沿用了早期 step-centric 评分草案，没有随着主架构把自治模式、租户影响面和证据充分性纳入统一风险评估一起升级。修复：正文现收敛到 8 因子 canonical 模型，并同步修正权重与公式。
