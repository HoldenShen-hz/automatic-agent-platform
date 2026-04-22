# ADR-104 Domain Recipe Twelve Archetypes

---

## OAPEFLIR 关联

- **Observe**: 汇总 24 域 workflow 模式
- **Assess**: 归并成 archetype
- **Plan**: 为 archetype 生成 baseline recipe
- **Execute**: 驱动领域 baseline 创建
- **Feedback**: 校验 archetype 适配率
- **Learn**: 更新 archetype 分类
- **Improve**: 减少特化成本
- **Release**: archetype 成为域接入基线资产

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

原先 recipe 原型过少，无法覆盖 24 个垂直业务域。

## 决策

`DomainRecipe` 扩展为十二种 archetype，覆盖 CRUD、Analytics、Creative、Realtime、Trading、Compliance、Research、Adversarial、Moderation、Logistics、Conversational、IncidentOps。

## 后果

- 24 域 baseline 有统一而可扩展的 recipe 模型
