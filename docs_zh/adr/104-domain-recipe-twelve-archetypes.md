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

### 与 DomainDescriptor.recipes 的绑定

十二种 archetype 必须绑定到 `DomainDescriptor.recipes` 字段（见 ADR-081 §1 和 ADR-100 §1），作为领域接入的必选扩展点。每个 archetype 在领域注册时必须声明：

- `archetype`: 对应十二种之一
- `baselineRecipe`: 该 archetype 的基线 recipe bundle
- `适配域`: 该 archetype 覆盖的具体业务域列表

### 与四阶段 onboarding 的集成

领域接入（ADR-103 四阶段 runbook）的第一阶段（建模）和第二阶段（开发）必须完成 archetype 选型与 baseline recipe 绑定，方可进入认证阶段。详见 ADR-081 §2 领域接入 runbook。

## 后果

- 24 域 baseline 有统一而可扩展的 recipe 模型
- archetype 选型是领域接入的必选步骤，不再是可选扩展
