# ADR-093 Harness Constraint Engine

---

## OAPEFLIR 关联

- **Observe**: 读取平台、租户、领域、任务四层约束
- **Assess**: 评估budget、风险vs输出边界
- **Plan**: 合并 ConstraintPack 并形成执linesupper limit
- **Execute**: 在每轮运lines前mandatory应用
- **Feedback**: record命中约束vs升级原因
- **Learn**: 沉淀高频约束conflicts模式
- **Improve**: 迭代 risk/output policy
- **Release**: 将约束references擎纳入上线门禁

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

Harness 如果没有统一的约束references擎，就会让风险、budget、输出治理散落在call方。

## Decision

- 每个 HarnessRun 必须携带显式 `ConstraintPack`
- `ConstraintPack` 至少contains `risk_policy`、`output_policy`、`budget_envelope`、`sandbox_requirement` vs `approval_requirement`
- 约束来源按 平台 -> 租户 -> 领域 -> 任务 合并
- 不满足约束时必须 fail-close，并writes审计和 timeline

## Consequences

- 高风险动作不会bypassing Harness 约束
- 运lines时vs文档中的 success criteria 保持一致

## v4.3 ADR Remediation

- A-37: 本 ADR 原先把 `ConstraintPack` 缩减为 `risk_policy + output_policy`，Root cause: 约束references擎 ADR 起草时只覆盖风险vs输出治理，没有把budget、沙箱和审批要求一并纳入统一约束包。修复：正文现将 `budget_envelope / sandbox_requirement / approval_requirement` 补入最小集合。
