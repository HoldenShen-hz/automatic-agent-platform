# ADR-038 业务域接入 Runbook

- Status：Accepted
- Decision日期：2026-04-20

## Background

新业务域接入平台需要标准化的流程和检查清单，确保接入质量。

## Decision

### 4 阶段接入流程

| 阶段 | Description | Gate |
|------|------|------|
| Gate 0 | 准备阶段 | - |
| Gate 1 | 开发完成 | ≥5 few-shot + eval ≥20 条 |
| Gate 2 | 测试via | 覆盖率 ≥80% |
| Gate 3 | authenticationvia | Prompt Injection 100% |
| Gate 4 | 金丝雀发布 | canary_5 → partial_25 → stable_75 → stable_100 |

### Gate 1 详细要求

- `minFewShotCount: 5` - 至少 5 条 few-shot 示例
- `minRegressionCaseCount: 20` - 至少 20 条回归测试用例
- `DomainEvaluationGateService` 实现门禁检查

### Gate 2 详细要求

- `coveragePercent >= 80` - 测试覆盖率 ≥80%
- pack-lifecycle 和 pack-test-local 双重检查

### Gate 3 详细要求

- `requirePromptInjectionCoverage: true` - Prompt Injection 覆盖率 100%
- 回归集未fullvia时directly阻断发布

### Canary 发布configure

```typescript
const CANARY_STAGES = [5, 25, 75, 100];  // 百分比
const DEFAULT_CANARY_PERCENT = 5;          // defaults to 5%
```

### Drift Detection Rollout

| 阶段 | 流量 |
|------|------|
| shadow | 0% |
| canary | 5% |
| partial | 25% |
| stable | 100% |

## Consequences

优点：

- 标准化接入流程确保质量
- 门禁机制防止劣质域接入
- 渐进式发布降低风险

代价：

- 接入流程较重
- Gate 检查需要工具supported

## 交叉references用

- [ADR-037 业务域建模vs接入Architecture](./037-domain-modeling-and-onboarding.md)
- [ADR-075 六级受控发布vs Rollout Status机](./075-controlled-rollout-release.md)

## 来源章节

- `§38` 业务域接入 Runbook
