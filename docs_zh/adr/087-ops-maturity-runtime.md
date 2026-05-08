# ADR-087 Ops Maturity Runtime

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：解释、熔断、生命周期、漂移、成本、调试、多模态、容量等信号
- **Assess**：异常漂移、成本优化、容量预测、解释深度和 panic 恢复评估
- **Plan**：调试、报告、边缘同步和自运维策略生成
- **Execute**：解释生成、全局熔断、边缘执行、调试、报告生成、自运维动作
- **Feedback**：解释使用、熔断演练、调试回放、容量预测偏差回流
- **Learn**：行为指纹、成本优化、容量趋势和运维经验沉淀
- **Improve**：Agent 生命周期、边缘能力、平台运维 agent 持续演进
- **Release**：成熟度能力分阶段推广

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v2.7 `§59-§69` 引入运营成熟度层。当前仓库已有：

- `src/ops-maturity/explainability`
- `src/ops-maturity/emergency`
- `src/ops-maturity/agent-lifecycle`
- `src/ops-maturity/edge-runtime`
- `src/ops-maturity/drift-detection`
- `src/ops-maturity/cost-optimizer`
- `src/ops-maturity/workflow-debugger`
- `src/ops-maturity/compliance-reporter`
- `src/ops-maturity/capacity-planner`
- `src/ops-maturity/multimodal`
- `src/ops-maturity/platform-ops-agent`

其中除 `drift-detection` 外，大部分仍偏骨架。

## 决策

### 1. 运营成熟度能力统一视为 Runtime 扩展层，而不是散乱工具箱

这些能力都围绕“平台如何安全、可解释、可恢复地运行”展开，必须共用：

- evidence model
- lifecycle
- rollout / rollback
- audit trail

### 2. Panic、Explainability、Debug、Report 必须接入同一证据平面

这些能力都必须复用 `state-evidence`，不能各自维护私有审计模型。

### 3. Edge、多模态、自运维 Agent 必须继承既有安全与治理边界

新执行形态不能绕过：

- sandbox
- policy engine
- budget
- rollout

### 4. 运营成熟度能力必须先有 contract，再推进大规模实现

因为这些能力横跨多个平面，若没有 authoritative contract，很容易形成碎片化实现。

## 后果

- `ops-maturity` 将按统一 runtime 扩展层推进，而不是逐目录各自演化
- 后续优先实现 explainability、panic、agent lifecycle、edge runtime、cost optimizer 的 contract 对齐

