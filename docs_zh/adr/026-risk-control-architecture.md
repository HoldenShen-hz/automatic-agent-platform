# ADR-026 风险控制架构

- 状态：Accepted
- 决策日期：2026-04-03

## 背景

Agent 作为高风险自动化执行单元，必须在执行前和执行后进行风险评估，防止危险操作导致业务损失。

## 决策

### Canonical 风险模型

v4.3 §10.2 规定的 canonical 风险模型采用二维评分体系：

```
risk_score = impact × 4 + irreversibility × 4
```

| 维度 | 说明 |
|------|------|
| impact | 业务影响程度（0-4 量级） |
| irreversibility | 不可逆性/回滚难度（0-4 量级） |

### 4 级风险映射

| 级别 | 阈值 | 处理策略 |
|------|------|----------|
| low | 0-8 | 直接执行 |
| medium | 9-16 | 记录日志 |
| high | 17-24 | 需人工审批 |
| critical | 25-32 | break_glass 审批 |

### 风险评估约束

- §10.3 规定：high/critical 风险级别默认 deny（default deny），自动执行须经显式审批
- RiskEvaluationEngine 实现须遵循 §10.2-§10.3 的 canonical 模型

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

- A-18: 本 ADR 原先保留 `stepTypeRisk / targetSystemRisk / dataClassRisk / blastRadius / priorFailureRate / confidence` 六因子模型，根因是风险 ADR 沿用了早期 step-centric 评分草案，没有随着主架构从 step 迁移到 node-run 一起升级。修复：正文现收敛到 v4.3 §10.2 规定的 `impact × 4 + irreversibility × 4` 二维 canonical 模型。
