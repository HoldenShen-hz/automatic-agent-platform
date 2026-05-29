# ADR-079 Feedback Hub and Seven-class Signal Preprocessing

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Background

OAPEFLIR Execute stage output `DualChannelStepOutput` needs to be collected by Feedback Hub, processed and converted to LearningSignal. Feedback Hub is the key bridge between main chain (O→A→P→E) and secondary chain (F→L→I→R).

Design requires supporting 7 feedback source types, implementing signal dedup, correlation and filtering preprocessing, and decoupling through DurableEventBus with Learn Hub.

## Decision

### 1. 7 Feedback Source Types

| Feedback Source | Description | Signal Types |
|----------------|-------------|--------------|
| `execution_outcome` | Execution result (success/failure/partial success) | `execution_success` / `execution_failure` |
| `tool_call` | Tool call results | `tool_success` / `tool_failure` |
| `resource_usage` | Resource consumption (token/time/memory) | `resource_high` / `resource_normal` |
| `context_drift` | Context drift detection | `drift_detected` / `drift_corrected` |
| `user_feedback` | User explicit feedback | `user_correction` / `user_rejection` |
| `system_signal` | System-level signals (health checks, circuit breakers) | `system_degraded` / `system_recovered` |
| `time_budget` | Time budget consumption | `time_warning` / `time_exceeded` |

### 2. FeedbackSignal Interface

```typescript
interface FeedbackSignal {
  signalId: string;
  taskId: string;
  harnessRunId: string;
  nodeRunId?: string;
  receiptId?: string;
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
  taskId: string;
  harnessRunId: string;
  nodeRunId?: string;
  signals: FeedbackSignal[];       // Associated signal list
  aggregated: boolean;
  processedAt?: string;
  learningSignals?: LearningSignal[];
}
```

## v4.3 ADR Remediation

- A-67: This ADR originally used `executionId` as Feedback/Signal main chain key, root cause being feedback hub modeled under old execution semantics, later not updated signal chain to `NodeAttemptReceipt`. Fix: Body now cuts signal anchor to `harnessRunId / nodeRunId / receiptId`.

### 4. Signal Preprocessor (SignalPreprocessor)

```typescript
interface SignalPreprocessor {
  // Dedup: Only first occurrence of same signalId retained
  dedup(signals: FeedbackSignal[]): FeedbackSignal[];

  // Correlate: Aggregate related signals (e.g., tool_failure + resource_high → context_overflow)
  correlate(signals: FeedbackSignal[]): FeedbackSignal[];

  // Filter: Remove low confidence or already processed signals
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
|-------|------|-------------|
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

## Alternative Solutions

### Option A: Polling collect signals

Advantages: Simple implementation.
Trade-offs: High latency, high resource consumption.

### Option B: Event-driven + active collection (selected)

Advantages: Low latency, strong signal correlation capability.
Trade-offs: Requires DurableEventBus support.

## Consequences

- `feedback-collector.ts` (41 lines) responsible for signal collection.
- `signal-preprocessor.ts` (239 lines) responsible for dedup/correlation/filter.
- `domain-event-feedback-consumer.ts` (206 lines) subscribes to execution events.
- `feedback-model.ts` (42 lines) defines Feedback interface.
- `types/feedback-signal.ts` (25 lines) defines FeedbackSignal.
- Event subscription requires DurableEventBus support (Tier 1 reliable delivery).

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/feedback/` module

## Source Section

- `§7` Feedback Hub Design
- `§7.1` 7 feedback source types
- `§7.2-7.4` FeedbackSignal / LearningSignal interfaces
- `§7.5` Signal preprocessing
- `§7.7-7.8` Event definition and DurableEventBus integration