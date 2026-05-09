# ADR-056 反馈驱动持续改进管线

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

平台需要从用户反馈中持续学习和改进，形成闭环的改进机制。

## 决策

### 反馈类型

| 类型 | 来源 | 处理方式 |
|------|------|----------|
| explicit | 用户评分/评论 | 人工审核 |
| implicit | 使用行为分析 | 自动学习 |
| corrective | 用户纠正 | 模式提取 |
| failure | 执行失败 | 根因分析 |

### 反馈处理流程

```
反馈采集 → 预处理 → 分类 → 模式识别 → 学习对象生成 → 改进候选评估 → Rollout
```

### FeedbackHub

- `FeedbackHub` 收集 7 类信号
- `FeedbackCollector` 预处理
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
                 Candidate     (必须通过)
```

- LearnHub 生成 LearningObject
- ImproveHub 评估 ImprovementCandidate
- P2 Release Governance 门禁审核（必须通过才能进入 Release）
- Release 六级发布（alpha/beta/stable/ga/lts/archived）

## 后果

优点：

- 闭环改进机制
- 数据驱动的优化
- 用户参与提升体验

代价：

- 反馈处理需要资源
- 模式识别准确性依赖数据量

## 交叉引用

- [ADR-079 Feedback Hub 与七类信号预处理](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub 与四模式检测器](./080-learn-hub-pattern-detection.md)

## 来源章节

- `§56` 反馈驱动持续改进管线
