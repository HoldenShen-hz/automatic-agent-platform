# ADR-038 业务域接入 Runbook

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

新业务域接入平台需要标准化的流程和检查清单，确保接入质量。

## 决策

### 4 阶段接入流程

| 阶段 | 说明 | Gate |
|------|------|------|
| Gate 0 | 准备阶段 | - |
| Gate 1 | 开发完成 | ≥5 few-shot + eval ≥20 条 |
| Gate 2 | 测试通过 | 覆盖率 ≥80% |
| Gate 3 | 认证通过 | Prompt Injection 100% |
| Gate 4 | 金丝雀发布 | CANARY_5 → CANARY_20 → CANARY_50 → CANARY_100 |

### Gate 1 详细要求

- `minFewShotCount: 5` - 至少 5 条 few-shot 示例
- `minRegressionCaseCount: 20` - 至少 20 条回归测试用例
- `DomainEvaluationGateService` 实现门禁检查

### Gate 2 详细要求

- `coveragePercent >= 80` - 测试覆盖率 ≥80%
- pack-lifecycle 和 pack-test-local 双重检查

### Gate 3 详细要求

- `requirePromptInjectionCoverage: true` - Prompt Injection 覆盖率 100%
- 回归集未全量通过时直接阻断发布

### Canary 发布配置

```typescript
const CANARY_STAGES = [5, 20, 50, 100];  // 百分比
const DEFAULT_CANARY_PERCENT = 10;         // 默认 10%
```

### Drift Detection Rollout

| 阶段 | 流量 |
|------|------|
| shadow | 0% |
| canary | 5% |
| partial | 25% |
| stable | 100% |

## 后果

优点：

- 标准化接入流程确保质量
- 门禁机制防止劣质域接入
- 渐进式发布降低风险

代价：

- 接入流程较重
- Gate 检查需要工具支持

## 交叉引用

- [ADR-037 业务域建模与接入架构](./037-domain-modeling-and-onboarding.md)
- [ADR-075 六级受控发布与 Rollout 状态机](./075-controlled-rollout-release.md)

## 来源章节

- `§38` 业务域接入 Runbook
