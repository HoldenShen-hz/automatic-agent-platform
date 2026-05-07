# ADR-UI-008 性能预算与 Bundle Gate

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI build 必须受 perf budget gate 约束，不允许只把大 bundle 记录为信息项。

- main bundle、lazy chunk、total transferred size 都必须有阈值。
- budget 超限应让 CI fail，而不是仅告警。
- shared package 的体积回归必须单独归因。

## 后果

- UI 产品化性能缺口可以被持续阻断。
- “越改越大”不再只靠人工发现。
