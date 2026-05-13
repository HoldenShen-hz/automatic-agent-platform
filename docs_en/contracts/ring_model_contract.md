# Ring Model Contract

> **OAPEFLIR Related**: This contract defines the ring-based progressive deployment mechanism and ring promotion criteria for OAPEFLIR Improve Hub, corresponding to ADR-075 §33 and design document §9.
> **Update Date**: 2026-04-29

## 1. Scope

This contract defines the six-level controlled release (L0-L5) ring model, ring promotion criteria, and progressive deployment strategy.

Related documents:

- `release_rollout_and_rollback_contract.md`
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Ring Model Overview

Ring Model provides progressive deployment mechanism, reducing production risk through graded traffic allocation and promotion criteria control.

### 2.1 Ring Levels

| Ring | Name | Traffic | AI Autonomy | Human Approval | Typical Scenario |
|------|------|---------|------------|---------|---------|
| Ring 0 | `off` | 0% | No operation permissions, recording only | — | Disabled release |
| Ring 1 | `evaluate_0` | 0% (recording only) | Candidate evaluation / evidence validation | — | Candidate evaluation |
| Ring 2 | `canary_5` | 5% | Parameter adjustment, strategy selection | critical/high requires approval | Small-scale verification |
| Ring 3 | `partial_25` | 25% | Configuration suggestions | All requires approval | Expanded verification |
| Ring 4 | `stable_75` | 75% | Execute configuration changes | All must have approval | Near full |
| Ring 5 | `stable_100` | 100% | Full autonomy (constrained by guardrail) | Anomaly escalation only | Full release |

## 3. Ring Promotion Criteria

### 3.1 Automatic Promotion Requirements

The following criteria must be met to promote from current ring to next ring:

| Metric | Threshold | Window | Description |
|------|------|------|------|
| Error rate | < 1% | Continuous 5 minutes | Production error rate must be below threshold |
| P99 latency | < 500ms | Continuous 5 minutes | End-to-end latency must be below threshold |
| Success rate | > 99% | Continuous 5 minutes | Success rate must be above threshold |
| Sample count | > 100 | Cumulative | Minimum samples to ensure statistical significance |

### 3.2 Manual Promotion Approval

For critical/high priority improvement candidates, human approval is required to promote from Ring 2 to Ring 3.

### 3.3 Auto-Rollback Criteria

If the following conditions are triggered, the system automatically rolls back to the previous ring or Ring 1:

| Condition | Threshold | Window | Action |
|------|------|------|------|
| Error rate exceeded | > 1% | 5 minutes | L4→L3 |
| P99 latency exceeded | > 500ms | 5 minutes | L4→L3 |
| Success rate not met | < 99% | 5 minutes | L4→L3 |
| Consecutive failure count | > 10 | 10 minutes | Direct rollback L1 |
| Resource exhaustion | Memory > 90% | 1 minute | Direct rollback L1 |

## 4. Ring Interface

### 4.1 RingStatus

```typescript
type RingStatus =
  | "off"           // Ring 0 - Disabled
  | "evaluate_0"   // Ring 1 - Evaluation only
  | "canary_5"      // Ring 2 - 5% traffic
  | "partial_25"    // Ring 3 - 25% traffic
  | "stable_75"     // Ring 4 - 75% traffic
  | "stable_100";   // Ring 5 - Full
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
  ↓ (manual enable)
evaluate_0 (R1)
  ↓ (automatic: criteria met)
canary_5 (R2)
  ↓ (automatic: criteria met + human approval for critical/high)
partial_25 (R3)
  ↓ (automatic: criteria met)
stable_75 (R4)
  ↓ (automatic: criteria met)
stable_100 (R5)
  ↓ (continuous M days without issues)
released
```

### 5.2 Rollback Transitions

Any ring can roll back to any lower ring; rollback sources:
- Automatic rollback (metric triggered)
- Manual rollback (operator decision)

## 6. Autonomy Boundary per Ring

| Ring | AI Autonomy | Human Approval Required |
|------|------------|------------|
| R0-R1 | Full autonomy (recording only) | Not required |
| R2 | Parameter adjustment, strategy selection | Required for critical/high |
| R3 | Configuration change suggestions | Required for all |
| R4 | Execute configuration changes | Required for all |
| R5 | Full autonomy (constrained by guardrail) | Anomaly escalation only |

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
  // Collect metrics for specified ring
  collectMetrics(candidateId: string, ring: RingStatus): Promise<RingMetrics>;

  // Evaluate whether promotion criteria is met
  evaluatePromotionCriteria(metrics: RingMetrics): PromotionCriteriaResult;

  // Evaluate whether rollback criteria is met
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
- Human approval workflow for critical/high priority

### 8.3 Contract Tests

- Ring metrics must meet thresholds defined in §33
- Criteria must not be bypassed for promotion
- Auto-rollback must trigger when metrics exceed threshold

## 9. Closure Conclusion

Ring Model is not simple percentage segmentation, but a progressive deployment mechanism with strict criteria, automated gates, and human approval points. Promotion from any ring must go through explicit criteria verification; rollback mechanism ensures problems can be controlled in a timely manner.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
