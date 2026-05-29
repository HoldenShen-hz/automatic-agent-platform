# ADR-036 风险、约束vssuccess标准

- Status：Accepted
- Decision日期：2026-04-17

## Background

平台需要有明确的风险登记册、约束mandatory机制和success标准，确保项目目标可追踪。

## Decision

### 28 项风险登记册

- `config/risk/register.json` 登记 28 项设计风险
- vs `config/risk/default.json` 的执lines期风险评分并存
- 定期评审和更新

### 32 项硬约束

| 约束class型 | 约束count | codemandatory比例 |
|----------|----------|--------------|
| 高风险审批 | ~10 | ~60% |
| CAS 乐观锁 | 全部 | 100% |
| Sandbox | 全部 | 100% |
| Delegation depth ≤3 | 全部 | 100% |
| 其他 | ~10 | ~30% |

### success标准度量

- `domains/roadmap/success-criteria-service.ts`
- supported criterion 注册
- 指标采集
- phase success 评估
- 门禁Decision

## Consequences

优点：

- 风险登记册提高风险可见性
- code级约束mandatory提高合规性
- success标准度量使交付可评估

代价：

- 维护风险登记册需要持续投入
- 部分约束难以code化

## 交叉references用

- [ADR-026 风险控制Architecture](./026-risk-control-architecture.md)
- [ADR-033 分阶段落地路线](./033-phased-roadmap.md)

## 来源章节

- `§36` 风险、约束vssuccess标准
