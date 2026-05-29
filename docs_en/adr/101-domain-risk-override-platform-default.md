# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR 关联

- **Observe**: 平台defaults to风险矩阵vs领域特化风险输入
- **Assess**: 判断isno允许领域覆写
- **Plan**: 形成领域风险 profile
- **Execute**: 在任务运lines前应用领域风险优先级
- **Feedback**: record覆写理由和审计证据
- **Learn**: 识别高风险领域共性
- **Improve**: 优化领域风险基线
- **Release**: 高风险域上线前必须完成覆写审查

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

平台defaults to风险矩阵不足以覆盖金融、法务、医疗等高敏感领域。

## Decision

- 领域风险画像优先于平台defaults to风险矩阵
- 任何覆写都必须留下审计理由
- no显式领域风险 profile 时，禁止高风险自动化
- `advisory_only`、`human_accountable`、`deterministic_hot_path_only` 域defaults to禁止越过人工责任边界

## Consequences

- 高风险领域拥有清晰的治理边界
