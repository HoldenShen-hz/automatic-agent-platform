# ADR-104 Domain Recipe Twelve Archetypes

---

## OAPEFLIR 关联

- **Observe**: 汇总 24 域 workflow 模式
- **Assess**: 归并成 archetype
- **Plan**: 为 archetype 生成 baseline recipe
- **Execute**: 驱动领域 baseline 创建
- **Feedback**: 校验 archetype 适配率
- **Learn**: 更新 archetype 分class
- **Improve**: 减少特化成本
- **Release**: archetype 成为域接入基线资产

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

原先 recipe 原型过少，no法覆盖 24 个垂直业务域。

## Decision

`DomainRecipe` 扩展为十二种 archetype，覆盖 CRUD、Analytics、Creative、Realtime、Trading、Compliance、Research、Adversarial、Moderation、Logistics、Conversational、IncidentOps。

每个 archetype 最终都要回写到 `DomainDescriptor.recipe`，不能vs `DomainDescriptor` 脱节为第二套领域接入元data。

## Consequences

- 24 域 baseline 有统一而可扩展的 recipe 模型
