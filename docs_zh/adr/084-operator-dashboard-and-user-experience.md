# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：统一聚合 task、incident、cost、approval、autonomy 信号
- **Assess**：生成 operator / admin / fleet 视图与摘要
- **Plan**：基于 attention queue 推荐操作
- **Execute**：通过控制台触发审批、接管、回滚、修复
- **Feedback**：用户点击、接受建议、失败复盘
- **Learn**：视图权重与摘要提示优化
- **Improve**：看板布局、摘要质量与 UX 流程改进
- **Release**：控制台与 UX 组件灰度上线

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v2.7 `§43-§44` 要求平台不只提供基础设施指标，而要提供：

- L1 操作者视图
- L2 域管理视图
- L3 平台运维视图
- L4 舰队视图
- 面向非技术用户的引导式 UX

当前仓库已有 `src/interaction/dashboard` 和 `src/interaction/ux`，但后者大部分仍为空壳。

## 决策

### 1. 看板以角色分层，而不是按页面分层

看板 canonical 层次固定为：

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue 是所有控制台动作的统一入口

所有需要人介入的对象统一映射为 `AttentionItem`，而不是每个模块单独做一套 UI 事件模型。

### 3. 非技术 UX 使用向导 / 模板 / 摘要三件套

对于非技术用户，优先暴露：

- onboarding wizard
- template engine
- NL summary

不直接暴露复杂 runtime 术语。

### 4. 控制台是执行治理动作的表面层，不承载治理逻辑

真正的治理逻辑仍属于 control-plane / org-governance / ops-maturity。

## 后果

- `src/interaction/dashboard` 需要成为 UI 聚合层而不是业务逻辑堆积点
- `src/interaction/ux` 后续补实现时必须围绕 canonical 角色层次展开

