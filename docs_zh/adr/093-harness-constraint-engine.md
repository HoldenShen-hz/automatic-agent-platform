# ADR-093 Harness Constraint Engine

---

## OAPEFLIR 关联

- **Observe**: 读取平台、租户、领域、任务四层约束
- **Assess**: 评估预算、风险与输出边界
- **Plan**: 合并 ConstraintPack 并形成执行上限
- **Execute**: 在每轮运行前强制应用
- **Feedback**: 记录命中约束与升级原因
- **Learn**: 沉淀高频约束冲突模式
- **Improve**: 迭代 risk/output policy
- **Release**: 将约束引擎纳入上线门禁

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

Harness 如果没有统一的约束引擎，就会让风险、预算、输出治理散落在调用方。

## 决策

- 每个 HarnessRun 必须携带显式 `ConstraintPack`
- `ConstraintPack` 至少包含 `risk_policy` 与 `output_policy`
- 约束来源按 平台 -> 租户 -> 领域 -> 任务 合并
- 不满足约束时必须 fail-close，并写入审计和 timeline

## 后果

- 高风险动作不会绕过 Harness 约束
- 运行时与文档中的 success criteria 保持一致
