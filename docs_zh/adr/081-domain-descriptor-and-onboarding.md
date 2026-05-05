# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：领域信号、知识结构与风险画像输入
- **Assess**：领域风险判断与接入审查
- **Plan**：领域模板、领域 workflow 与接入 runbook
- **Execute**：按领域边界暴露 tool / plugin / knowledge
- **Feedback**：领域级反馈、效果指标与上线验证
- **Learn**：领域模式沉淀与领域模板修正
- **Improve**：领域 bundle、prompt、recipe 的改进候选
- **Release**：领域包灰度、认证与上线

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v4.3 `§37-§38` 要求平台不再把业务域视为不透明业务包，而是以 `DomainDescriptor` 作为结构化治理单元，统一风险画像、知识结构、评估框架、Prompt 库、Recipe 和跨域交互策略。

当前仓库已有 `src/domains/*` 目录和 `src/domains/registry/*` 的初始实现，但 authoritative 决策仍缺失，导致：

- 领域定义字段与生命周期不统一
- 接入 runbook 只能靠口头约定
- `src/domains/*` 大量目录仍停留在空壳 barrel

## 决策

### 1. `DomainDescriptor` 作为领域 authoritative 根对象

每个领域必须至少声明：

- `domainId`
- `displayName`
- `domainVersion`
- `riskProfile`
- `knowledgeSchema`
- `evalFramework`
- `promptLibrary`
- `recipes`
- `interactionPolicy`
- `governancePolicy`
- `lifecycleState`

### 2. 领域接入采用四阶段固定 runbook

接入流程固定为：

1. 领域建模
2. 开发验证
3. 安全认证
4. 灰度上线

任何新领域必须留下结构化证据，而不是只提交代码目录。

### 3. 领域是 bundle、知识、评估和治理的统一边界

以下能力都必须挂靠到领域：

- tool bundle
- workflow registry
- prompt library
- knowledge namespace
- eval dataset / gate
- ownership / budget / SLO

### 4. 领域接入优先约束，再允许扩展

新增领域时，先补：

- contract
- schema
- registry / validation
- smoke test

再补业务专有实现，避免“先写代码后补边界”。

## 后果

- `src/domains/*` 的后续实现必须围绕 `DomainDescriptor` 收敛
- `§37-§38` 的设计不再散落在多个平行文档中
- 领域接入从“约定式集成”升级为“契约式接入”

