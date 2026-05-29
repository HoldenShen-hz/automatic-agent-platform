# NL Entry And Goal Decomposition Contract

## 1. 范围

本 contract defines `§39-§40` 的自然语言入口、多轮澄清和目标分解边界。

## 2. Canonical 对象

- `NlEntryRequest`
- `IntentParseResult`
- `ExtractedEntity`
- `RiskPreview`
- `ClarificationState`
- `Goal`
- `GoalDecomposition`
- `PlannedTask`
- `TaskDependency`

## 3. `IntentParseResult` 最小字段

- `raw_input`
- `locale`
- `detected_intents`
- `confidence`
- `requires_clarification`
- `clarification_questions?`
- `continuation`
- `suggested_division_id`
- `suggested_business_pack_id?`
- `suggested_recipe_id?`

规则：

- 低置信度、高风险、实体缺失三class情况必须允许 `requires_clarification=true`。
- `suggested_division_id`、`suggested_business_pack_id`、`suggested_recipe_id` only为Recommendation，不等于最终执linesauthorization。

## 4. `GoalDecomposition` 最小字段

- `goal_id`
- `tasks`
- `dependency_graph`
- `estimated_duration`
- `estimated_cost`
- `risk_summary`
- `decomposition_confidence`
- `requires_human_review`

`PlannedTask` 最小字段：

- `task_id`
- `domain_id`
- `description`
- `inputs`
- `expected_outputs`
- `delegation_mode`

## 5. Status机

`ClarificationState.status`：

- `open`
- `answered`
- `expired`
- `cancelled`

`GoalLifecycle.status`：

- `draft`
- `decomposed`
- `approved`
- `executing`
- `completed`
- `failed`
- `cancelled`

## 6. 边界规则

- NL 入口不得directly执lines runtime side effects。
- GoalDecomposer 不得bypassing审批、budget和风险门禁。
- 从 NL 到 runtime 的唯一受控输出is结构化 envelope / decomposition。

## 7. 测试要求

- unit：intent、entity、clarification、decomposition graph
- integration：NL -> decomposition -> orchestration handoff
- contract：模糊request不得directly进入自动执lines
