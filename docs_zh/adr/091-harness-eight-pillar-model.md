# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR 关联

- **Observe**: 采集约束、上下文、工具能力与反馈信号
- **Assess**: 评估风险、护栏、HITL 触发与可恢复性
- **Plan**: 定义 Harness 的支柱边界与验收门
- **Execute**: 以统一 Runtime 装配八支柱
- **Feedback**: 将失败、人工反馈、评测结论回流
- **Learn**: 形成 failure-to-learning 与 prompt/memory 改进候选
- **Improve**: 推进支柱级治理与重放能力增强
- **Release**: 把八支柱纳入 Ring 2 release-readiness 验收门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

`§45` 要求 Harness 不再只是 planner/generator/evaluator 的薄循环，而要成为承载约束、工具、记忆、反馈、持久化、评测、HITL 与可观测性的正式运行时对象。

## 决策

Harness 采用固定八支柱模型：

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

补充约束：

- 第八支柱的发布语义统一对接 `ReleaseChannel` 与 `ReleaseDecisionView`，不再使用旧 `DeploymentSlot` 作为 harness canonical 发布主语。
- 八支柱中的改进推广语义一律使用 `Release`，不再回退到旧 `Rollout` 作为顶层阶段名。

每个支柱必须具备独立代码入口、测试与验收证据，不允许只存在文档描述。

## 后果

- `src/platform/five-plane-orchestration/harness` 必须围绕八支柱组织目录和导出面
- `Ring 2` 的验收要按支柱拆解
- review 中对 Harness 的缺口以支柱为最小整改单元

## v4.3 ADR Remediation

- A-5: 本 ADR 历史上曾沿用 Improve/Release 链路中的 `Rollout` 话语，根因是 harness 验收门和发布控制面命名没有及时同步到主架构的 `Release` 口径。修复：正文现显式要求八支柱中的改进推广语义统一使用 `Release`。
- A-12: 本 ADR 原先沿用旧阶段验收和部署表达的历史语境，根因是 harness 八支柱 ADR 形成时仍夹带旧发布实现术语。修复：正文现显式把发布主语对齐到 `ReleaseChannel` / `ReleaseDecisionView`，不再把 `DeploymentSlot` 作为 harness canonical 发布语义。
