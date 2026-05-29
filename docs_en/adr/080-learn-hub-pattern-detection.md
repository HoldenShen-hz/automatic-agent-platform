# ADR-080 Learn Hub vs四模式检测器

- Status：Accepted
- Decision日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-078 Knowledge Plane Architecture

## Background

OAPEFLIR Feedback Hub 产出的 LearningSignal 需要被 Learn Hub handle，提取为结构化的 LearningObject。Learn Hub is副链（F→L→I→R）的第一环，负责从信号中识别模式、异常、纠正和恢复 playbook。

设计要求supported 3 class学习class型（R4-TYPES 约束）：failure_pattern / user_correction / recovery_playbook，via 4 个初始模式检测器实现。

## Decision

### 1. 3 class学习内容（R4-TYPES 约束）

| 学习class型 | Description | 检测器 |
|---------|------|-------|
| `failure_pattern` | failed模式识别 | `FailurePatternMiner` |
| `user_correction` | user纠正record | `UserCorrectionDetector` |
| `recovery_playbook` | 恢复操作手册 | `RecoveryPlaybookMiner` |

**约束**：Ring 1 onlysupported这 3 class，不得扩展直到 R4-TYPES 约束解除。

### 2. 4 个初始模式检测器

| 检测器 | 检测模式 | 实现文件 |
|--------|---------|---------|
| `TruncationPatternDetector` | 输出被截断的模式 | `pattern-detectors/truncation-detector.ts` |
| `PermissionPatternDetector` | permission拒绝模式 | `pattern-detectors/permission-detector.ts` |
| `HallucinationPatternDetector` | 幻觉/虚假内容模式 | `pattern-detectors/hallucination-detector.ts` |
| `SchemaLoopPatternDetector` | Schema 循环relies on模式 | `pattern-detectors/schema-loop-detector.ts` |

### 3. FailurePattern 接口

```typescript
interface FailurePattern {
  patternId: string;
  taskType: string;
  failureMode: FailureMode;
  rootCause: string;
  symptoms: string[];           // 观测到的症状
  frequency: number;           // 出现iterations数
  firstSeenAt: string;
  lastSeenAt: string;
  evidence: EvidenceRef[];     // 证据链接（R4-EVIDENCE 约束）
  recommendations: string[];
}

interface FailureMode {
  code: string;                 // e.g., "TOOL_CALL_FAILED"
  category: 'timeout' | 'permission' | 'validation' | 'resource' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface EvidenceRef {
  signalId: string;
  harnessRunId: string;
  nodeRunId?: string;
  timestamp: string;
  excerpt?: string;
}
```

### 4. LearningObject 接口

```typescript
interface LearningObject {
  objectId: string;
  kind: LearningKind;           // 'failure_pattern' | 'user_correction' | 'recovery_playbook'
  content: FailurePattern | UserCorrection | RecoveryPlaybook;
  confidence: number;           // 0-1
  status: LearningObjectStatus;
  validatedAt?: string;
  promotedAt?: string;          // 注入 Knowledge Plane 的time
  createdAt: string;
}

type LearningKind = 'failure_pattern' | 'user_correction' | 'recovery_playbook';

type LearningObjectStatus =
  | 'created'
  | 'validating'
  | 'validated'
  | 'rejected'
  | 'promoted';
```

### 5. LearningObjectValidator

```typescript
interface LearningObjectValidator {
  // 必须contains EvidenceRef（R4-EVIDENCE 约束）
  validate(learningObject: LearningObject): ValidationResult;

  // Evidence 校验：必须存在有效的 FeedbackSignal 链接
  validateEvidence(evidence: EvidenceRef[]): boolean;

  // 置信度threshold校验
  validateConfidence(confidence: number): boolean;
}
```

### 6. ExperienceDistillation

```typescript
interface ExperienceDistillation {
  // 从多个相似 FailurePattern 提取通用模式
  distill(patterns: FailurePattern[]): DistilledPattern;

  // 从success执lines中提取最佳实践
  extractBestPractice(execution: DualChannelStepOutput): BestPractice;
}

interface DistilledPattern {
  pattern: FailurePattern;
  similarCount: number;         // 聚合的模式count
  confidenceBoost: number;      // 置信度提升
}
```

### 7. StrategyLearning

```typescript
interface StrategyLearning {
  // 从历史执lines中学习策略选择
  learnStrategyEffectiveness(
    taskType: string,
    strategy: PlanStrategy,
    outcome: ExecutionOutcome
  ): StrategyEffectiveness;

  // 推荐最佳策略
  recommendStrategy(taskType: string, context: AssessmentContext): PlanStrategy;
}

interface StrategyEffectiveness {
  strategy: PlanStrategy;
  successRate: number;
  avgLatency: number;
  sampleCount: number;
}
```

### 8. Learn→Improve 集成

```
Feedback.signal_preprocessed
    → Learn Hub
        → 4 Pattern Detector 各司其职
        → LearningObject 创建
        → LearningObjectValidator.validate()
        → validated = true → ImprovementCandidate 创建
        → ImprovementGuardrail.evaluates()
        → AutonomyBoundaryPolicy 决定自主permission
        → RolloutScheduler 调度发布
```

## 备选方案

### 方案 A：no Learn Hub，反馈directly送 Improve

优点：Architecture简单。
代价：no法提取模式，知识no法积累。

### 方案 B：完整 Learn Hub + 4 检测器（已选）

优点：模式识别 + 知识积累 + 证据链完整。
代价：实现复杂度较高（约 1500 linescode）。

## Consequences

- `failure-pattern-miner.ts` 作为核心检测器聚合。
- 4 个 `*-detector.ts` 文件each实现检测逻辑。
- `learning-object-validator.ts`（65 lines）mandatory R4-EVIDENCE 约束。
- `experience-distillation.ts`（24 lines）提取最佳实践。
- `strategy-learning.ts`（19 lines）学习策略有效性。
- `learning-object-model.ts`（21 lines）defines LearningObject。
- 事件：`learning:artifact_created`、`learning:object_promoted`

## 交叉references用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-075 Controlled Rollout](./075-controlled-rollout-release.md)
- [ADR-078 Knowledge Plane](./078-knowledge-plane-architecture.md)
- `src/core/learning/` 模块

## 来源章节

- `§8` Learn Hub 设计
- `§8.1` 6 class学习内容（Ring 1 简化为 3 class）

## v4.3 ADR Remediation

- A-65: 本 ADR 原先把 `Phase 1` vs `EvidenceRef.executionId` 写成 canonical 约束，Root cause:  learn hub ADR 在 runtime truth 重命名之后没有synchronous更新证据链主键。修复：正文现改为 ring 口径，并把证据链锚点切到 `harnessRunId / nodeRunId`。
- `§8.2-8.4` LearningArtifact / LearningObject / FailurePattern 接口
- `§8.5` 4 初始failed模式
- `§8.6-8.7` ExperienceDistillation / StrategyLearning
- `§L.7` R4-TYPES 约束
- `§L.9` R4-EVIDENCE 约束
