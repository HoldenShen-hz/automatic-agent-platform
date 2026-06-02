# Ring Model Contract

> **OAPEFLIR Related**: This contract defines the ring-based progressive deployment mechanism and ring promotion criteria of the OAPEFLIR Improve Hub, corresponding to ADR-075 §33 and design document §9.
> **Update Date**: 2026-04-29

## 1. Scope

This contract defines the ring model, ring promotion criteria, and progressive deployment strategy for the six-level controlled release (L0-L5).

Related documents:

- `release_rollout_and_rollback_contract.md`
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Ring Model Overview

The Ring Model provides a progressive deployment mechanism that reduces production risk through tiered traffic allocation and promotion criteria control.

### 2.1 Ring Levels

| Ring | Name | Traffic | AI Autonomy | Human Approval | Typical Scenario |
| --- | --- | --- | --- | --- | --- |
| Ring 0 | `off` | 0% | No operation permission, record only | — | Disabled release |
| Ring 1 | `evaluate_0` | 0% (record only) | Candidate evaluation / evidence validation | — | Candidate evaluation |
| Ring 2 | `canary_5` | 5% | Parameter tuning, strategy selection | Required for critical / high | Small-scale validation |
| Ring 3 | `partial_25` | 25% | Configuration suggestion | Required for all | Expanded validation |
| Ring 4 | `stable_75` | 75% | Execute configuration change | Required for all | Approaching full |
| Ring 5 | `stable_100` | 100% | Fully autonomous (subject to guardrail constraints) | Only on exception escalation | Full release |

## 3. Ring Promotion Criteria

### 3.1 Automatic Promotion Requirements

Promoting from the current ring to the next ring must satisfy the following criteria:

| Metric | Threshold | Window | Description |
| --- | --- | --- | --- |
| Error rate | < 1% | Consecutive 5 minutes | Production error rate must be below threshold |
| P99 latency | < 500ms | Consecutive 5 minutes | End-to-end latency must be below threshold |
| Success rate | > 99% | Consecutive 5 minutes | Success rate must be above threshold |
| Sample count | > 100 | Cumulative | Minimum sample count to ensure statistical significance |

### 3.2 Manual Promotion Approval

For critical / high priority improvement candidates, human approval must be obtained before promoting from Ring 2 to Ring 3.

### 3.3 Auto-Rollback Criteria

If the following conditions are triggered, the system automatically rolls back to the previous ring or Ring 1:

| Condition | Threshold | Window | Action |
| --- | --- | --- | --- |
| Error rate exceeds threshold | > 1% | 5 minutes | L4 -> L3 |
| P99 latency exceeds threshold | > 500ms | 5 minutes | L4 -> L3 |
| Success rate not meeting target | < 99% | 5 minutes | L4 -> L3 |
| Consecutive failure count | > 10 | 10 minutes | Rollback directly to L1 |
| Resource exhaustion | Memory > 90% | 1 minute | Rollback directly to L1 |

## 4. Ring Interface

### 4.1 RingStatus

```typescript
type RingStatus =
  | "off"           // Ring 0 - disabled
  | "evaluate_0"    // Ring 1 - evaluation only
  | "canary_5"      // Ring 2 - 5% traffic
  | "partial_25"    // Ring 3 - 25% traffic
  | "stable_75"     // Ring 4 - 75% traffic
  | "stable_100";   // Ring 5 - full traffic
```

### 4.2 RingMetrics

```typescript
interface RingMetrics {
  errorRate: number;
  latencyP99: number;
  successRate: number;
  sampleCount: number;
  measuredAt: string;
}
```

### 4.3 RingPromotionRequest

```typescript
interface RingPromotionRequest {
  candidateId: string;
  currentRing: RingStatus;
  targetRing: RingStatus;
  metrics: RingMetrics;
  requestedBy: "scheduler" | "human";
  requestedAt: string;
}
```

### 4.4 RingPromotionDecision

```typescript
interface RingPromotionDecision {
  requestId: string;
  candidateId: string;
  approved: boolean;
  currentRing: RingStatus;
  targetRing: RingStatus;
  reason?: string;
  decidedBy: "scheduler" | "human" | "auto_rollback";
  decidedAt: string;
}
```

## 5. Ring Transition Rules

### 5.1 Valid Transitions

```
off (R0)
  ↓ (manually enable)
evaluate_0 (R1)
  ↓ (automatic: criteria met)
canary_5 (R2)
  ↓ (automatic: criteria met + human approval for critical / high)
partial_25 (R3)
  ↓ (automatic: criteria met)
stable_75 (R4)
  ↓ (automatic: criteria met)
stable_100 (R5)
  ↓ (no issues for M consecutive days)
released
```

### 5.2 Rollback Transitions

Any ring can roll back to any lower ring. Rollback sources include:
- Automatic rollback (metric-triggered)
- Manual rollback (operator decision)

## 6. Autonomy Boundary per Ring

| Ring | AI Autonomy | Human Approval Requirement |
| --- | --- | --- |
| R0-R1 | Fully autonomous (record only) | Not required |
| R2 | Parameter tuning, strategy selection | Required for critical / high |
| R3 | Configuration change suggestion | Required for all |
| R4 | Execute configuration change | Required for all |
| R5 | Fully autonomous (subject to guardrail constraints) | Only on exception escalation |

## 7. Implementation Requirements

### 7.1 Ring Lifecycle Manager

```typescript
interface RingLifecycleManager {
  // Initialize ring state
  initializeRing(candidateId: string, initialRing: RingStatus): Promise<void>;

  // Request promotion
  requestPromotion(request: RingPromotionRequest): Promise<RingPromotionDecision>;

  // Execute rollback
  executeRollback(candidateId: string, targetRing: RingStatus, reason: string): Promise<void>;

  // Get current ring state
  getCurrentRing(candidateId: string): Promise<RingStatus>;

  // Get ring history
  getRingHistory(candidateId: string): Promise<RingPromotionDecision[]>;
}
```

### 7.2 Metrics Collector

```typescript
interface RingMetricsCollector {
  // Collect metrics for the specified ring
  collectMetrics(candidateId: string, ring: RingStatus): Promise<RingMetrics>;

  // Evaluate whether promotion criteria are met
  evaluatePromotionCriteria(metrics: RingMetrics): PromotionCriteriaResult;

  // Evaluate whether rollback criteria are met
  evaluateRollbackCriteria(metrics: RingMetrics): RollbackCriteriaResult;
}
```

## 8. Testing Requirements

### 8.1 Unit Tests

- Ring transition state machine
- Promotion criteria evaluation
- Rollback criteria evaluation
- Autonomy boundary enforcement

### 8.2 Integration Tests

- Ring promotion flow end-to-end
- Auto-rollback trigger and execution
- Human approval workflow for critical / high priority

### 8.3 Contract Tests

- Ring metrics must meet the thresholds defined in §33
- Promotion must not occur when criteria are not met
- Auto-rollback must trigger when metrics exceed thresholds

## 9. Closure Conclusion

The Ring Model is not a simple percentage split, but a progressive deployment mechanism that contains strict criteria, automated gates, and human approval points. The promotion of any ring must pass explicit criteria validation, and the rollback mechanism ensures issues can be controlled in time.
