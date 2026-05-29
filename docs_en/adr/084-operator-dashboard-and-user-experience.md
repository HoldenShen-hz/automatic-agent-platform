# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：统一聚合 task、incident、cost、approval、autonomy 信号
- **Assess**：生成 operator / admin / fleet 视图vs摘要
- **Plan**：based on attention queue 推荐操作
- **Execute**：via控制台触发审批、接管、回滚、修复
- **Feedback**：user点击、acceptsRecommendation、failed复盘
- **Learn**：视图权重vs摘要提示优化
- **Improve**：看板布局、摘要质量vs UX 流程改进
- **Release**：控制台vs UX 组件灰度上线

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

v2.7 `§43-§44` 要求平台不只提供基础设施指标，而要提供：

- L1 操作者视图
- L2 域manage视图
- L3 平台运维视图
- L4 舰队视图
- 面向非技术user的references导式 UX

当前仓库已有 `src/interaction/dashboard` 和 `src/interaction/ux`，但后者大部分仍为空壳。

## Decision

### 1. 看板以角色分层，而不is按页面分层

看板 canonical 层iterations固定为：

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue is所有控制台动作的统一入口

所有需要人介入的对象统一映射为 `AttentionItem`，而不is每个模块单独做一套 UI 事件模型。

### 3. 非技术 UX uses向导 / 模板 / 摘要三件套

对于非技术user，优先暴露：

- onboarding wizard
- template engine
- NL summary

不directly暴露复杂 runtime 术语。

### 4. 控制台is执lines治理动作的table面层，不承载治理逻辑

真正的治理逻辑仍belongs to control-plane / org-governance / ops-maturity。

## Consequences

- `src/interaction/dashboard` 需要成为 UI 聚合层而不is业务逻辑堆积点
- `src/interaction/ux` 后续补实现时必须围绕 canonical 角色层iterations展开

