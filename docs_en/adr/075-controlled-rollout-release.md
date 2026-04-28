# ADR-075 Six-Level Controlled Release and Rollout State Machine

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-018 Rollout 11 State Machine

## Context

The OAPEFLIR Improve Hub is responsible for generating ImprovementCandidate from LearningObject and promoting improvements to production through a controlled release process. The design requires supporting 6-level controlled release (L0-L5), implementing canary/staged/stable multi-stage upgrades, and automatically rolling back when metrics are not met.

The existing `rollout-state-machine.ts` (119 lines) has implemented canary→partial→stable state transitions. This ADR formally establishes the complete Rollout architecture.

## Decision

### 1. 6-Level Controlled Release (L0-L5)

| Level | Name | Traffic Ratio | Use Case |
|------|------|---------|---------|
| **L0** | `off` | 0% | Improvement disabled |
| **L1** | `evaluate_0` | 0% (recording only) | Candidate evaluation and evidence validation, no production impact |
| **L2** | `canary_5` | 5% | Small-scale validation, most conservative |
| **L3** | `partial_25` | 25% | Expanded validation, medium |
| **L4** | `stable_75` | 75% | Near full rollout, advanced |
| **L5** | `stable_100` | 100% | Full release |

### 2. Rollout State Machine

```
candidate_created
      ↓
evaluation_enabled (L1)
      ↓ (metrics meet threshold)
canary_5 (L2)
      ↓ (N minutes without rollback trigger)
partial_25 (L3)
      ↓ (N minutes without rollback trigger)
stable_75 (L4)
      ↓ (N minutes without rollback trigger)
stable_100 (L5) ←→ auto_rollback ←→ (rollback condition triggered)
      ↓
released (stable operation for M days)
```

### 3. State Transition Rules

```typescript
interface RolloutStateTransition {
  from: RolloutState;
  to: RolloutState;
  condition: RolloutCondition;
  duration: number;      // minimum duration (minutes)
  autorollback?: AutoRollbackCondition;
}

interface RolloutCondition {
  errorRateThreshold: number;      // e.g., 0.01 (1%)
  latencyP99Threshold: number;     // e.g., 500 (ms)
  successRateThreshold: number;    // e.g., 0.99 (99%)
}
```

### 4. AutoRollback Trigger Conditions

| Condition | Threshold | Window |
|------|------|------|
| Error rate exceeded | > 1% | 5 minutes |
| P99 latency exceeded | > 500ms | 5 minutes |
| Success rate not met | < 99% | 5 minutes |
| Consecutive failures | > 10 | 10 minutes |
| Resource exhaustion | Memory > 90% | 1 minute |

### 5. ImprovementCandidate Lifecycle

```typescript
interface ImprovementCandidate {
  candidateId: string;
  learningObjectId: string;      // Associated LearningObject
  source: 'failure_pattern' | 'user_correction' | 'recovery_playbook';
  targetScope: 'task' | 'workflow' | 'domain' | 'platform';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: ImprovementCandidateStatus;
  rolloutLevel: RolloutLevel;
  metrics: RolloutMetrics;
  guardrails: ImprovementGuardrail[];
  createdAt: string;
  updatedAt: string;
}

type ImprovementCandidateStatus =
  | 'candidate_created'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'evaluation_enabled'
  | 'canary_5'
  | 'partial_25'
  | 'stable_75'
  | 'stable_100'
  | 'released'
  | 'auto_rollback'
  | 'rolled_back';
```

### 6. Autonomy Boundary

| Level | AI Autonomy | Human Approval |
|------|------------|---------|
| L0-L1 | Full autonomy (record only) | Not required |
| L2-L3 | Parameter adjustment, strategy selection | Required for critical/high |
| L4-L5 | Configuration changes | Required for all |

### 7. RolloutScheduler

```typescript
interface RolloutScheduler {
  schedulePromotion(candidateId: string, targetLevel: RolloutLevel): void;
  scheduleRollback(candidateId: string, reason: string): void;
  getActiveRollouts(): RolloutRecord[];
  getRolloutHistory(candidateId: string): RolloutRecord[];
}
```

## Alternatives

### Option A: Only off/suggest/shadow (Phase 1 Simplified)

Pros: Simple implementation, low risk.
Cons: Cannot implement progressive release, limited benefit.

### Option B: 6-Level Controlled Release (Chosen)

Pros: Complete progressive release capability, supports automatic rollback.
Cons: Higher implementation complexity (~500 lines of code + monitoring integration).

## Consequences

- `rollout-state-machine.ts` as the core state transition engine.
- `rollout-scheduler.ts` is responsible for scheduling Promotion/Rollback events.
- `auto-rollback-service.ts` monitors metrics and triggers rollback.
- `guardrail-evaluator.ts` evaluates whether improvement candidates meet safety boundaries.
- `autonomy-boundary-policy.ts` decides AI autonomy permissions.
- Events: `improvement:candidate_created`, `improvement:promoted`, `improvement:auto_rollback`

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/improvement/` module

## Source Sections

- `§9` Improve Hub Design
- `§9.1` 6-Level Controlled Release
- `§9.2-9.9` ImprovementCandidate Interfaces
- `§L.8` R4-RELEASE Constraint

## v4.3 ADR Remediation

- A-35: This ADR originally named L1 level directly as `shadow` and used `shadow_enabled` as rollout status simultaneously. Root cause: The release level and rollout status dimensions were mixed into one naming system, continuing the historical shadow terminology from ADR-018. Fix: L1 level is now changed to `evaluate_0` and status to `evaluation_enabled`, clearly separating level and status to avoid level numbers conflicting with old shadow semantics.
