# ADR-080 Learn Hub and Four Pattern Detectors

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-078 Knowledge Plane Architecture

## Context

LearningSignal output by the OAPEFLIR Feedback Hub needs to be processed by the Learn Hub and extracted into structured LearningObject. The Learn Hub is the first link in the sub-chain (F→L→I→R), responsible for identifying patterns, anomalies, corrections, and recovery playbooks from signals.

The design requires supporting 3 learning types (R4-TYPES constraint): failure_pattern / user_correction / recovery_playbook, implemented through 4 initial pattern detectors.

## Decision

### 1. 3 Learning Content Types (R4-TYPES Constraint)

| Learning Type | Description | Detector |
|---------|------|-------|
| `failure_pattern` | Failure pattern recognition | `FailurePatternMiner` |
| `user_correction` | User correction records | `UserCorrectionDetector` |
| `recovery_playbook` | Recovery operation playbook | `RecoveryPlaybookMiner` |

**Constraint**: Ring 1 only supports these 3 types; no expansion until R4-TYPES constraint is lifted.

### 2. 4 Initial Pattern Detectors

| Detector | Detected Pattern | Implementation File |
|--------|---------|---------|
| `TruncationPatternDetector` | Output truncation patterns | `pattern-detectors/truncation-detector.ts` |
| `PermissionPatternDetector` | Permission denial patterns | `pattern-detectors/permission-detector.ts` |
| `HallucinationPatternDetector` | Hallucination/fabrication content patterns | `pattern-detectors/hallucination-detector.ts` |
| `SchemaLoopPatternDetector` | Schema circular dependency patterns | `pattern-detectors/schema-loop-detector.ts` |

### 3. FailurePattern Interface

```typescript
interface FailurePattern {
  patternId: string;
  taskType: string;
  failureMode: FailureMode;
  rootCause: string;
  symptoms: string[];           // Observed symptoms
  frequency: number;           // Occurrence count
  firstSeenAt: string;
  lastSeenAt: string;
  evidence: EvidenceRef[];     // Evidence links (R4-EVIDENCE constraint)
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

### 4. LearningObject Interface

```typescript
interface LearningObject {
  objectId: string;
  kind: LearningKind;           // 'failure_pattern' | 'user_correction' | 'recovery_playbook'
  content: FailurePattern | UserCorrection | RecoveryPlaybook;
  confidence: number;           // 0-1
  status: LearningObjectStatus;
  validatedAt?: string;
  promotedAt?: string;          // Time injected into Knowledge Plane
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
  // Must include EvidenceRef (R4-EVIDENCE constraint)
  validate(learningObject: LearningObject): ValidationResult;

  // Evidence validation: must have valid FeedbackSignal links
  validateEvidence(evidence: EvidenceRef[]): boolean;

  // Confidence threshold validation
  validateConfidence(confidence: number): boolean;
}
```

### 6. ExperienceDistillation

```typescript
interface ExperienceDistillation {
  // Extract common patterns from multiple similar FailurePatterns
  distill(patterns: FailurePattern[]): DistilledPattern;

  // Extract best practices from successful executions
  extractBestPractice(execution: DualChannelStepOutput): BestPractice;
}

interface DistilledPattern {
  pattern: FailurePattern;
  similarCount: number;         // Number of aggregated patterns
  confidenceBoost: number;      // Confidence increase
}
```

### 7. StrategyLearning

```typescript
interface StrategyLearning {
  // Learn strategy selection effectiveness from historical executions
  learnStrategyEffectiveness(
    taskType: string,
    strategy: PlanStrategy,
    outcome: ExecutionOutcome
  ): StrategyEffectiveness;

  // Recommend best strategy
  recommendStrategy(taskType: string, context: AssessmentContext): PlanStrategy;
}

interface StrategyEffectiveness {
  strategy: PlanStrategy;
  successRate: number;
  avgLatency: number;
  sampleCount: number;
}
```

### 8. Learn→Improve Integration

```
Feedback.signal_preprocessed
    → Learn Hub
        → 4 Pattern Detectors each fulfill their role
        → LearningObject created
        → LearningObjectValidator.validate()
        → validated = true → ImprovementCandidate created
        → ImprovementGuardrail.evaluates()
        → AutonomyBoundaryPolicy decides autonomy permissions
        → RolloutScheduler schedules release
```

## Alternatives

### Option A: No Learn Hub, Feedback Directly to Improve

Pros: Simple architecture.
Cons: Cannot extract patterns, knowledge cannot accumulate.

### Option B: Complete Learn Hub + 4 Detectors (Selected)

Pros: Pattern recognition + knowledge accumulation + complete evidence chain.
Cons: Higher implementation complexity (~1500 lines of code).

## Consequences

- `failure-pattern-miner.ts` as the core detector aggregator.
- 4 `*-detector.ts` files each implement detection logic.
- `learning-object-validator.ts` (65 lines) enforces R4-EVIDENCE constraint.
- `experience-distillation.ts` (24 lines) extracts best practices.
- `strategy-learning.ts` (19 lines) learns strategy effectiveness.
- `learning-object-model.ts` (21 lines) defines LearningObject.
- Events: `learning:artifact_created`, `learning:object_promoted`

## Cross-References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Controlled Rollout](./075-controlled-rollout-release.md)
- [ADR-078 Knowledge Plane](./078-knowledge-plane-architecture.md)
- `src/core/learning/` module

## Source Section

- `§8` Learn Hub Design
- `§8.1` 6 Learning Content Types (Ring 1 simplified to 3)
- `§8.2-8.4` LearningArtifact / LearningObject / FailurePattern Interfaces
- `§8.5` 4 Initial Failure Patterns
- `§8.6-8.7` ExperienceDistillation / StrategyLearning
- `§L.7` R4-TYPES constraint
- `§L.9` R4-EVIDENCE constraint

## v4.3 ADR Remediation

- A-65: This ADR originally wrote `Phase 1` and `EvidenceRef.executionId` as canonical constraints. Root cause: learn hub ADR did not sync update evidence chain primary key after runtime truth rename. Fix: The main text now uses ring terminology and switches evidence chain anchor to `harnessRunId / nodeRunId`.
- R6-47: Fixed FailurePattern/EvidenceRef interface, removed executionId association, unified using harnessRunId/nodeRunId to ensure learning objects can join truth.
- `§8.2-8.4` LearningArtifact / LearningObject / FailurePattern Interfaces
- `§8.5` 4 Initial Failure Patterns
- `§8.6-8.7` ExperienceDistillation / StrategyLearning
- `§L.7` R4-TYPES constraint
- `§L.9` R4-EVIDENCE constraint
