# ADR-075 Six-level Controlled Release and Rollout State Machine

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model, ADR-018 Rollout 11 State Machine

## Background

OAPEFLIR Improve Hub is responsible for generating ImprovementCandidate from LearningObject and promoting improvements to production environment through controlled release process. Design requires supporting 6-level controlled release (L0-L5), implementing canary/staged/stable multi-stage upgrade, and auto-rollback when metrics are not met.

The existing `rollout-state-machine.ts` (119 lines) has already implemented state transitions from canary→partial→stable. This ADR formally establishes the complete Rollout architecture.

## Decision

### 1. 6-level Controlled Release (L0-L5)

| Level | Name | Traffic Ratio | Applicable Scenario |
|-------|------|---------------|---------------------|
| **L0** | `off` | 0% | Improvement disabled |
| **L1** | `evaluate_0` | 0% (record only) | Candidate evaluation and evidence validation, does not affect production |
| **L2** | `canary_5` | 5% | Small-scale validation, most初级 |
| **L3** | `partial_25` | 25% | Expanded validation, intermediate |
| **L4** | `stable_75` | 75% | Near full volume, advanced |
| **L5** | `stable_100` | 100% | Complete release |

### 2. Rollout State Machine

```
candidate_created
      ↓
evaluation_enabled (L1)
      ↓ (metrics meet threshold)
canary_5 (L2)
      ↓ (continuous N minutes without rollback trigger)
partial_25 (L3)
      ↓ (continuous N minutes without rollback trigger)
stable_75 (L4)
      ↓ (continuous N minutes without rollback trigger)
stable_100 (L5) ←→ auto_rollback ←→ (rollback trigger conditions)
      ↓
released (stable operation for M days)
```

### 3. State Transition Rules

```typescript
interface RolloutStateTransition {
  from: RolloutState;
  to: RolloutState;
  condition: RolloutCondition;
  duration: number;      // Minimum duration (minutes)
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
|-----------|-----------|--------|
| Error rate exceeded | > 1% | 5 minutes |
| P99 latency exceeded | > 500ms | 5 minutes |
| Success rate not met | < 99% | 5 minutes |
| Continuous failure count | > 10 | 10 minutes |
| Resource exhausted | Memory > 90% | 1 minute |

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
  | 'quarantined'
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

#### ImprovementCandidate State Machine Transition Diagram

```
                   Manual rejection
candidate_created ──→ rejected
      ↑
      │ Auto evaluation trigger / quarantine release
      │
under_review ──→ approved
      │
      └────────→ quarantined
      ↑                  │
      │                  ↓
      │            evaluation_enabled (L1)
      │                  │
      │                  ↓ (metrics met)
      │              canary_5 (L2)
      │                  │
      │                  ↓ (continuous N minutes without rollback)
      │              partial_25 (L3)
      │                  │
      │                  ↓ (continuous N minutes without rollback)
      │              stable_75 (L4)
      │                  │
      │                  ↓ (continuous N minutes without rollback)
      │              stable_100 (L5)
      │                  │
      │                  ↓ (stable operation for M days)
      │              released
      │
      │ Any stage metrics exceeded
      ↓              ←── auto_rollback
auto_rollback → rolled_back

Constraints:
- `candidate_created` is initial state, `rejected` / `rolled_back` are terminal states
- `quarantined` indicates candidate temporarily frozen due to guardrail, evidence gap or regression risk, cannot enter rollout levels before release
- `auto_rollback` after trigger only allows transition to `rolled_back`, not directly resume
- After `released`, if serious problem found, must go through change committee process to rollback
```

### 6. Autonomy Boundary

| Level | AI Autonomous Permission | Human Approval |
|-------|-------------------------|----------------|
| L0-L1 | Fully autonomous (record only) | Not needed |
| L2-L3 | Parameter adjustment, strategy selection | Needed for critical/high |
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

## Alternative Solutions

### Option A: Only off/suggest/shadow (Ring 1 simplified version)

Advantages: Simple implementation, low risk.
Trade-offs: Cannot implement progressive release, limited benefit.

### Option B: 6-level Controlled Release (selected)

Advantages: Complete progressive release capability, supports auto-rollback.
Trade-offs: Higher implementation complexity (~500 lines of code + monitoring integration).

## Consequences

- `rollout-state-machine.ts` as core state transition.
- `rollout-scheduler.ts` responsible for scheduling Promotion/Rollback events.
- `auto-rollback-service.ts` monitors metrics and triggers rollback.
- `guardrail-evaluator.ts` evaluates whether improvement candidates comply with safety boundaries.
- `autonomy-boundary-policy.ts` decides AI autonomous permissions.
- Events: `improvement:candidate_created`, `improvement:promoted`, `improvement:auto_rollback`

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/improvement/` module

## Source Section

- `§9` Improve Hub Design
- `§9.1` 6-level controlled release
- `§9.2-9.9` ImprovementCandidate interfaces
- `§L.8` R4-RELEASE constraint

## v4.3 ADR Remediation

- A-35: This ADR originally directly named `L1` level as `shadow`, and used `shadow_enabled` as rollout status, root cause being release level and rollout status two dimensions were mixed into one naming system, continuing to inherit historical shadow language from ADR-018. Fix: Body now changes `L1` level to `evaluate_0`, status to `evaluation_enabled`, clearly separating level and status, avoiding level number conflict with old shadow semantics.
- R3-63: This ADR originally defined `ImprovementCandidateStatus` as 12 states, root cause being state machine design not converged to canonical simplified model. Fix: Body now simplifies state machine to 4-state core (candidate_created/under_review/released/rolled_back), remaining intermediate states belong to rollout level dimension.