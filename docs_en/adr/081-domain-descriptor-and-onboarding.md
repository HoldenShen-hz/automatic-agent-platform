# ADR-081 Domain Descriptor And Onboarding

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：领域信号、知识结构vs风险画像输入
- **Assess**：领域风险判断vs接入审查
- **Plan**：领域模板、领域 workflow vs接入 runbook
- **Execute**：按领域边界暴露 tool / plugin / knowledge
- **Feedback**：领域级反馈、效果指标vs上线验证
- **Learn**：领域模式沉淀vs领域模板修正
- **Improve**：领域 bundle、prompt、recipe 的改进候选
- **Release**：领域包灰度、authenticationvs上线

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

v2.7 `§37-§38` 要求平台不再把业务域视为不透明业务包，而is以 `DomainDescriptor` 作为结构化治理单元，统一风险画像、知识结构、评估框架、Prompt 库、Recipe 和跨域交互策略。

当前仓库已有 `src/domains/*` 目录和 `src/domains/registry/*` 的初始实现，但 authoritative Decision仍缺失，导致：

- 领域defines字段vs生命cycle不统一
- 接入 runbook 只能靠口头约定
- `src/domains/*` 大量目录仍停留在空壳 barrel

## Decision

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
3. securityauthentication
4. 灰度上线

任何新领域必须留下结构化证据，而不is只提交code目录。

### 3. 领域is bundle、知识、评估和治理的统一边界

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

再补业务专有实现，避免“先写code后补边界”。

## Consequences

- `src/domains/*` 的后续实现必须围绕 `DomainDescriptor` 收敛
- `§37-§38` 的设计不再散落在多个平lines文档中
- 领域接入从“约定式集成”升级为“契约式接入”

