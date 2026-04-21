# ADR-029 OAPEFLIR 受控认知内核

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

OAPEFLIR 是平台的认知循环模型，定义了 Observe→Assess→Plan→Execute→Feedback→Learn→Improve→Release 的八阶段执行流程。每个阶段需要明确定义输入输出、状态转换和质量保证。

## 决策

### 八阶段认知循环

```
Observe → Assess → Plan → Execute → Feedback
              ↓                       ↓
           Feedback → Learn → Improve → Release
```

### 各阶段定义

| 阶段 | 输入 | 输出 | 关键组件 |
|------|------|------|---------|
| Observe | 原始信号 | UnifiedObservation | OapeflirLoopService |
| Assess | Observation | UnifiedAssessment (complexity 5 级) | AssessmentService |
| Plan | Assessment | ExecutionPlan + replan | PlanBuilder |
| Execute | Plan DTO | StepOutput | RuntimeExecuteBridge |
| Feedback | StepOutput | StepFeedback (6 种 type) | FeedbackCollector |
| Learn | Feedback | LearningObject (4 种 pattern_type) | StrategyLearningService |
| Improve | LearningObject | ImprovementCandidate | EvolutionMvpService |
| Release | Candidate | RolloutRecord | RolloutScheduler |

### 全部输入输出 Zod schema 验证

每个阶段输入输出必须通过 Zod schema 验证，确保类型安全。

### 每阶段 StageRationale

```typescript
interface StageRationale {
  stage: OapeflirStage;
  rationale: string;
  timestamp: string;
}
```

### timeline 跟踪

- OTel span 记录各阶段耗时
- StageTimeline 持久化阶段转换

## 后果

优点：

- 标准化阶段定义使系统可解释
- Zod 验证确保类型安全
- StageRationale 便于问题追溯

代价：

- 阶段增加执行延迟
- 状态管理复杂度提高

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-075 六级受控发布与 Rollout 状态机](./075-controlled-rollout-release.md)

## 来源章节

- `§13` OAPEFLIR 受控认知内核
