# ADR-082 Natural Language Entry And Goal Decomposition

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：自然语言输入采集、多语言解析、实体抽取
- **Assess**：歧义检测、风险预估、确认需求判断
- **Plan**：目标分解、任务 DAG、跨域relies on图生成
- **Execute**：将分解结果映射为受控requestvs执lines计划
- **Feedback**：user反馈、多轮纠偏、计划修正
- **Learn**：模板命中率vs分解质量优化
- **Improve**：Prompt / 模板 / planner 策略改进
- **Release**：NL 管线vs GoalDecomposer 的灰度发布

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

v2.7 `§39-§40` 要求平台面向最终user提供自然语言入口和目标分解references擎。仓库已存在：

- `src/interaction/nl-gateway`
- `src/interaction/goal-decomposer`

但缺少明确Decision，Description两者如何vs现有 Runtime / OAPEFLIR / API 契约衔接。

## Decision

### 1. 自然语言入口vs执lines入口分离

`NlGateway` 负责：

- locale 解析
- intent / entity 提取
- 风险预览
- clarification Decision
- 生成 `RequestEnvelope`

它不directly执lines workflow。

### 2. `GoalDecomposer` 负责跨域目标分解，不directly持有执linespermission

`GoalDecomposer` 负责：

- 生成 `GoalDecomposition`
- 构建 `TaskDependency`
- 给出成本、时长、风险估计
- 指示 `requiresHumanReview`

真正执lines仍由 orchestration / execution plane 接管。

### 3. 自然语言结果必须映射到结构化 contract

自然语言入口输出必须收敛到：

- `RequestEnvelope`
- `RiskPreview`
- `GoalDecomposition`
- `TaskDependencyGraph`

不能让执lines平面directly消费松散 prompt 文本。

### 4. 歧义优先进入 clarification，而不is猜测执lines

当 confidence 低于threshold、风险较高或缺少关键实体时，系统必须：

- 阻断自动执lines
- 进入 clarification
- record澄清IssuevsStatus

## Consequences

- `src/interaction/nl-gateway` vs `src/interaction/goal-decomposer` 将成为 Interface Plane 到 Orchestration Plane 的受控桥梁
- 自然语言vs执lines平面之间的契约边界清晰化
- 后续实现优先补 schema、Status机vs多轮对话测试

