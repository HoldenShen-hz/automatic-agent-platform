# ADR-079 Feedback Hub and Seven Signal Types

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

The `DualChannelStepOutput` from the OAPEFLIR Execute stage needs to be collected, processed, and transformed into LearningSignal by the Feedback Hub. The Feedback Hub is the critical bridge between the main chain (O→A→P→E) and the sub-chain (F→L→I→R).

The design requires supporting 7 types of feedback sources, implementing signal deduplication, correlation, and filtering preprocessing, and decoupling from the Learn Hub through DurableEventBus.

## Decision

### 1. 7 Feedback Source Types

| Feedback Source | Description | Signal Types |
|--------|------|---------|
| `execution_outcome` | Execution result (success/failure/partial success) | `execution_success` / `execution_failure` |
| `tool_call` | Tool call result | `tool_success` / `tool_failure` |
| `resource_usage` | Resource consumption (token/time/memory) | `resource_high` / `resource_normal` |
| `context_drift` | Context drift detection | `drift_detected` / `drift_corrected` |
| `user_feedback` | User explicit feedback | `user_correction` / `user_rejection` |
| `system_signal` | System-level signals (health checks, circuit breakers) | `system_degraded` / `system_recovered` |
| `time_budget` | Time budget consumption | `time_warning` / `time_exceeded` |

### 2. FeedbackSignal Interface

```typescript
interface FeedbackSignal {
  signalId: string;
  harnessRunId: string;             // v4.3 canonical: truth primary key
  nodeRunId?: string;               // v4.3 canonical: node-level association
  receiptId?: string;              // v4.3 canonical: step receipt
  kind: FeedbackSignalKind;        // 20+ enum values
  source: FeedbackSourceType;
  payload: unknown;                // Source-specific data
  confidence: number;               // 0-1
  timestamp: string;               // ISO 8601
  metadata: Record<string, unknown>;
}

type FeedbackSignalKind =
  | 'execution_success'
  | 'execution_failure'
  | 'tool_success'
  | 'tool_failure'
  | 'resource_high'
  | 'resource_normal'
  | 'drift_detected'
  | 'drift_corrected'
  | 'user_correction'
  | 'user_rejection'
  | 'system_degraded'
  | 'system_recovered'
  | 'time_warning'
  | 'time_exceeded'
  | 'replan_triggered'
  | 'context_overflow'
  | 'quality_below_threshold'
  | 'unknown_error';
```

### 3. Feedback Interface

```typescript
interface Feedback {
  feedbackId: string;
  harnessRunId: string;             // v4.3 canonical: truth primary key
  nodeRunId?: string;               // v4.3 canonical: node-level association
  signals: FeedbackSignal[];       // Associated signal list
  aggregated: boolean;
  processedAt?: string;
  learningSignals?: LearningSignal[];
}
```

## v4.3 ADR Remediation

- A-67: This ADR originally used `executionId` as Feedback/Signal primary chain key. Root cause: feedback hub was modeled under old execution semantics, and later did not update signal chain to `NodeAttemptReceipt`. Fix: The main text now switches signal anchor to `harnessRunId / nodeRunId / receiptId`.
- R6-46: Fixed FeedbackSignal interface, removed taskId association key, unified using harnessRunId/nodeRunId as correlation keys to ensure learning objects can join truth.

### 4. Signal Preprocessor

```typescript
interface SignalPreprocessor {
  // Deduplication: keep only the first occurrence of each signalId
  dedup(signals: FeedbackSignal[]): FeedbackSignal[];

  // Correlation: aggregate related signals (e.g., tool_failure + resource_high → context_overflow)
  correlate(signals: FeedbackSignal[]): FeedbackSignal[];

  // Filtering: remove low-confidence or already-processed signals
  filter(signals: FeedbackSignal[]): FeedbackSignal[];

  // Main preprocessing method
  preprocess(signals: FeedbackSignal[]): ProcessedSignals;
}

interface ProcessedSignals {
  highPriority: FeedbackSignal[];    // Forward directly to Learn
  mediumPriority: FeedbackSignal[];  // Accumulate then forward
  lowPriority: FeedbackSignal[];    // Record only
  learningSignals: LearningSignal[];
}
```

### 5. LearningSignal Interface

```typescript
interface LearningSignal {
  signalId: string;
  type: 'pattern' | 'anomaly' | 'correction' | 'recovery';
  sourceSignals: string[];          // Associated FeedbackSignal IDs
  confidence: number;
  extractedKnowledge: {
    pattern?: FailurePattern;
    anomaly?: AnomalyRecord;
    correction?: UserCorrection;
    recovery?: RecoveryPlaybook;
  };
  timestamp: string;
}
```

### 6. FeedbackCollector

```typescript
interface FeedbackCollector {
  // Collect signals from Execute output
  collectFromExecution(
    output: DualChannelStepOutput,
    context: ExecutionContext
  ): FeedbackSignal[];

  // Collect signals from external systems (webhook/polling)
  collectFromExternal(source: FeedbackSourceType): Promise<FeedbackSignal[]>;

  // Aggregate signals from multiple sources
  aggregate(taskId: string): Promise<Feedback>;
}
```

### 7. DurableEventBus Integration

| Event | Tier | Description |
|------|------|------|
| `feedback:collected` | Tier 1 | Feedback collected (requires ack) |
| `feedback:learning_signal` | Tier 1 | LearningSignal generated (requires ack) |
| `feedback:processed` | Tier 2 | Signals processed (ack optional) |

```typescript
// domain-event-feedback-consumer.ts subscription flow
eventBus.subscribe('execution:completed', async (event) => {
  const signals = await feedbackCollector.collectFromExecution(event.output);
  const processed = await signalPreprocessor.preprocess(signals);
  await eventBus.publish('feedback:collected', processed);
});
```

## Alternatives

### Option A: Polling-Based Signal Collection

Pros: Simple implementation.
Cons: High latency, large resource consumption.

### Option B: Event-Driven + Active Collection (Selected)

Pros: Low latency, strong signal correlation capability.
Cons: Requires DurableEventBus support.

## Consequences

- `feedback-collector.ts` (41 lines) handles signal collection.
- `signal-preprocessor.ts` (239 lines) handles dedup/correlate/filter.
- `domain-event-feedback-consumer.ts` (206 lines) subscribes to execution events.
- `feedback-model.ts` (42 lines) defines Feedback interface.
- `types/feedback-signal.ts` (25 lines) defines FeedbackSignal.
- Event subscriptions require DurableEventBus support (Tier 1 reliable delivery).

## Cross-References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/feedback/` module

## Source Section

- `§7` Feedback Hub Design
- `§7.1` 7 Feedback Source Types
- `§7.2-7.4` FeedbackSignal / LearningSignal Interfaces
- `§7.5` Signal Preprocessing
- `§7.7-7.8` Event Definitions and DurableEventBus Integration
