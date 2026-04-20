# ADR-080 Learn Hub 与四模式检测器

- 状态：Accepted
- 决策日期：2026-04-17
- 相关：ADR-016 OAPEFLIR 八阶段认知循环模型，ADR-078 Knowledge Plane 架构

## 背景

OAPEFLIR Feedback Hub 产出的 LearningSignal 需要被 Learn Hub 处理，提取为结构化的 LearningObject。Learn Hub 是副链（F→L→I→R）的第一环，负责从信号中识别模式、异常、纠正和恢复 playbook。

设计要求支持 3 类学习类型（R4-TYPES 约束）：failure_pattern / user_correction / recovery_playbook，通过 4 个初始模式检测器实现。

## 决策

### 1. 3 类学习内容（R4-TYPES 约束）

| 学习类型 | 说明 | 检测器 |
|---------|------|-------|
| `failure_pattern` | 失败模式识别 | `FailurePatternMiner` |
| `user_correction` | 用户纠正记录 | `UserCorrectionDetector` |
| `recovery_playbook` | 恢复操作手册 | `RecoveryPlaybookMiner` |

**约束**：Phase 1 仅支持这 3 类，不得扩展直到 R4-TYPES 约束解除。

### 2. 4 个初始模式检测器

| 检测器 | 检测模式 | 实现文件 |
|--------|---------|---------|
| `TruncationPatternDetector` | 输出被截断的模式 | `pattern-detectors/truncation-detector.ts` |
| `PermissionPatternDetector` | 权限拒绝模式 | `pattern-detectors/permission-detector.ts` |
| `HallucinationPatternDetector` | 幻觉/虚假内容模式 | `pattern-detectors/hallucination-detector.ts` |
| `SchemaLoopPatternDetector` | Schema 循环依赖模式 | `pattern-detectors/schema-loop-detector.ts` |

### 3. FailurePattern 接口

```typescript
interface FailurePattern {
  patternId: string;
  taskType: string;
  failureMode: FailureMode;
  rootCause: string;
  symptoms: string[];           // 观测到的症状
  frequency: number;           // 出现次数
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
  executionId: string;
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
  promotedAt?: string;          // 注入 Knowledge Plane 的时间
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
  // 必须包含 EvidenceRef（R4-EVIDENCE 约束）
  validate(learningObject: LearningObject): ValidationResult;

  // Evidence 校验：必须存在有效的 FeedbackSignal 链接
  validateEvidence(evidence: EvidenceRef[]): boolean;

  // 置信度阈值校验
  validateConfidence(confidence: number): boolean;
}
```

### 6. ExperienceDistillation

```typescript
interface ExperienceDistillation {
  // 从多个相似 FailurePattern 提取通用模式
  distill(patterns: FailurePattern[]): DistilledPattern;

  // 从成功执行中提取最佳实践
  extractBestPractice(execution: DualChannelStepOutput): BestPractice;
}

interface DistilledPattern {
  pattern: FailurePattern;
  similarCount: number;         // 聚合的模式数量
  confidenceBoost: number;      // 置信度提升
}
```

### 7. StrategyLearning

```typescript
interface StrategyLearning {
  // 从历史执行中学习策略选择
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
        → AutonomyBoundaryPolicy 决定自主权限
        → RolloutScheduler 调度发布
```

## 备选方案

### 方案 A：无 Learn Hub，反馈直接送 Improve

优点：架构简单。
代价：无法提取模式，知识无法积累。

### 方案 B：完整 Learn Hub + 4 检测器（已选）

优点：模式识别 + 知识积累 + 证据链完整。
代价：实现复杂度较高（约 1500 行代码）。

## 后果

- `failure-pattern-miner.ts` 作为核心检测器聚合。
- 4 个 `*-detector.ts` 文件各自实现检测逻辑。
- `learning-object-validator.ts`（65 行）强制 R4-EVIDENCE 约束。
- `experience-distillation.ts`（24 行）提取最佳实践。
- `strategy-learning.ts`（19 行）学习策略有效性。
- `learning-object-model.ts`（21 行）定义 LearningObject。
- 事件：`learning:artifact_created`、`learning:object_promoted`

## 交叉引用

- [ADR-016 OAPEFLIR 八阶段认知循环模型](./016-oapeflir-loop-model.md)
- [ADR-075 Controlled Rollout](./075-controlled-rollout-release.md)
- [ADR-078 Knowledge Plane](./078-knowledge-plane-architecture.md)
- `src/core/learning/` 模块

## 来源章节

- `§8` Learn Hub 设计
- `§8.1` 6 类学习内容（Phase 1 简化为 3 类）
- `§8.2-8.4` LearningArtifact / LearningObject / FailurePattern 接口
- `§8.5` 4 初始失败模式
- `§8.6-8.7` ExperienceDistillation / StrategyLearning
- `§L.7` R4-TYPES 约束
- `§L.9` R4-EVIDENCE 约束
