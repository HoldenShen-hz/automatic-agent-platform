# ADR-029 OAPEFLIR 受控认知内核

- 状态：Accepted
- 决策日期：2026-04-17

## 背景

OAPEFLIR 是平台的认知循环模型，定义了 Observe→Assess→Plan→Execute→Feedback→Learn→Improve→Release 的八阶段认知流程。每个阶段需要明确定义输入输出、质量保证和与 HarnessRuntime 的边界，但不再拥有独立执行运行时。

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
| Observe | 原始信号 | CognitiveFrameInput / UnifiedObservation | ObserveAdapter |
| Assess | Observation | UnifiedAssessment (complexity 5 级) | AssessmentService |
| Plan | Assessment | PlanRationale + `PlanGraphBundle` 引用 | PlanBuilder |
| Execute | `NodeAttemptReceipt` / evidence refs | ExecutionSummaryView | RuntimeExecuteBridge |
| Feedback | ExecutionSummaryView | StepFeedback (6 种 type) | FeedbackCollector |
| Learn | Feedback | LearningObject (4 种 pattern_type) | StrategyLearningService |
| Improve | LearningObject | ImprovementCandidate | EvolutionMvpService |
| Release | Candidate | ReleaseDecisionView / RolloutRecord | RolloutScheduler |

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

约束：

- `StageRationale`、`ExecutionSummaryView` 和 `ReleaseDecisionView` 只允许作为 `oapeflir.view.*` / `oapeflir.rationale.*` 投影。
- 任何真实状态推进、预算变更或副作用提交都必须回到 `HarnessRuntime` 和 `RuntimeStateMachine.transition(command)`。

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

## v4.3 ADR Remediation

- A-2: 本 ADR 原先把 OAPEFLIR 受控认知内核写成高于 HarnessRuntime 的执行主干，根因是认知框架和执行运行时在早期设计里没有明确分层。修复：正文现把 OAPEFLIR 收敛为运行时之上的认知/解释层，真实执行仍由 `HarnessRuntime` 管辖。
- A-10: 本 ADR 原先延续 `Oapeflir*` 风格命名，根因是阶段 DTO 直接按框架名命名。修复：正文现改为 `CognitiveFrameInput` / `ExecutionSummaryView` / `ReleaseDecisionView` 这类认知视图对象，并避免把框架名直接当 canonical DTO 前缀。
