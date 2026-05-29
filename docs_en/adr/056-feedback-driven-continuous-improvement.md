# ADR-056 反馈驱动持续改进管线

- Status：Accepted
- Decision日期：2026-04-20

## Background

平台需要从user反馈中持续学习和改进，形成闭环的改进机制。

## Decision

### 反馈class型

| class型 | 来源 | handle方式 |
|------|------|----------|
| explicit | user评分/评论 | 人工审核 |
| implicit | useslines为分析 | 自动学习 |
| corrective | user纠正 | 模式提取 |
| failure | 执linesfailed | Root Cause分析 |

### 反馈handle流程

```
反馈采集 → 预handle → 分class → 模式识别 → 学习对象生成 → 改进候选评估 → Rollout
```

### FeedbackHub

- `FeedbackHub` 收集 7 class信号
- `FeedbackCollector` 预handle
- `StrategyLearningService` 模式检测

### 学习对象

```typescript
interface LearningObject {
  object_id: string;
  learning_type: LearningType;
  pattern: string;
  evidence: FeedbackEvidence[];
  confidence: number;
}
```

### 改进管线

```
LearnHub → ImproveHub → P2 Release Governance 门禁 → 六级 Release
     ↓           ↓                ↓                  ↓
 LearningObject  Improvement   门禁审核          Rollout
                 Candidate     (必须via)
```

- LearnHub 生成 LearningObject
- ImproveHub 评估 ImprovementCandidate
- P2 Release Governance 门禁审核（必须via才能进入 Release）
- Release 六级发布（alpha/beta/stable/ga/lts/archived）

## Consequences

优点：

- 闭环改进机制
- data驱动的优化
- user参vs提升体验

代价：

- 反馈handle需要资源
- 模式识别准确性relies ondata量

## 交叉references用

- [ADR-079 Feedback Hub vs七class信号预handle](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub vs四模式检测器](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§56` 反馈驱动持续改进管线
