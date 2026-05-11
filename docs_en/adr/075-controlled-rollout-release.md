# ADR-075 Six-Level Controlled Rollout and Rollout State Machine

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model, ADR-018 Rollout 11 State Machine

## Context

The OAPEFLIR Improve Hub is responsible for generating ImprovementCandidates from LearningObjects and promoting improvements to production through a controlled rollout process. The design requirement is to support 6 levels of controlled rollout (L0-L5), implement canary/staged/stable multi-phase upgrades, and enable automatic rollback when metrics do not meet thresholds.

The existing `rollout-state-machine.ts` (119 lines) has already implemented canary→partial→stable state transitions. This ADR formally establishes the complete Rollout architecture.

## Decision

### 1. Six-Level Controlled Rollout (L0-L5)

| Level | Name | Traffic Percentage | Use Case |
|-------|------|-------------------|----------|
| **L0** | `off` | 0% | Improvement is disabled |
| **L1** | `evaluate_0` | 0% (record only) | Candidate evaluation and evidence verification, does not affect production |
| **L2** | `canary_5` | 5% | Small-scale validation, most basic |
| **L3** | `partial_25` | 25% | Expanded validation, intermediate |
| **L4** | `stable_75` | 75% | Near full rollout, advanced |
| **L5** | `stable_100` | 100% | Full release |

### 2. Rollout State Machine

```
candidate_created
      ↓
evaluation_enabled (L1)
      ↓ (metrics meet threshold)
canary_5 (L2)
      ↓ (sustained N minutes without rollback trigger)
partial_25 (L3)
      ↓ (sustained N minutes without rollback trigger)
stable_75 (L4)
      ↓ (sustained N minutes without rollback trigger)
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
  duration: number;      // minimum sustained duration (minutes)
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
| Success rate below target | < 99% | 5 minutes |
| Consecutive failure count | > 10 | 10 minutes |
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

#### ImprovementCandidate State Machine Transition Diagram

```
                   Manual Rejection
candidate_created ──→ rejected
      ↑
      │ Auto-evaluation triggered
      │
under_review ──→ approved
      ↑                  │
      │                  ↓
      │            evaluation_enabled (L1)
      │                  │
      │                  ↓ (metrics meet threshold)
      │              canary_5 (L2)
      │                  │
      │                  ↓ (sustained N minutes without rollback)
      │              partial_25 (L3)
      │                  │
      │                  ↓ (sustained N minutes without rollback)
      │              stable_75 (L4)
      │                  │
      │                  ↓ (sustained N minutes without rollback)
      │              stable_100 (L5)
      │                  │
      │                  ↓ (stable operation for M days)
      │              released
      │
      │ Metrics exceeded at any stage
      ↓              ←── auto_rollback
auto_rollback → rolled_back

Constraints:
- `candidate_created` is the initial state; `rejected` / `rolled_back` are terminal states
- After `auto_rollback` is triggered, transition is only allowed to `rolled_back`, direct recovery is not permitted
- After `released`, if serious issues are discovered, the change board process must be followed to rollback
```

### 6. Autonomy Boundary

| Level | AI Autonomy Permissions | Human Approval |
|-------|------------------------|----------------|
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

### Option A: Off/Suggest/Shadow Only (Ring 1 Simplified)

Pros: Simple implementation, low risk.
Cons: Cannot implement progressive rollout, limited benefits.

### Option B: Six-Level Controlled Rollout (Selected)

Pros: Complete progressive rollout capability, supports automatic rollback.
Cons: Higher implementation complexity (~500 lines of code + monitoring integration).

## Consequences

- `rollout-state-machine.ts` serves as the core state transition engine.
- `rollout-scheduler.ts` is responsible for scheduling Promotion/Rollback events.
- `auto-rollback-service.ts` monitors metrics and triggers rollbacks.
- `guardrail-evaluator.ts` evaluates whether improvement candidates meet safety boundaries.
- `autonomy-boundary-policy.ts` determines AI autonomy permissions.
- Events: `improvement:candidate_created`, `improvement:promoted`, `improvement:auto_rollback`

## Cross References

- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)
- `src/core/improvement/` module

## Source Sections

- `§9` Improve Hub Design
- `§9.1` Six-Level Controlled Release
- `§9.2-9.9` ImprovementCandidate Interfaces
- `§L.8` R4-RELEASE Constraints

## v4.3 ADR Remediation

- A-35: This ADR originally named the `L1` level directly as `shadow` and used `shadow_enabled` as the rollout status simultaneously. The root cause was that release level and rollout status, two separate dimensions, were mixed into one naming system, continuing the historical shadow terminology from ADR-018. Fix: The main text now changes `L1` to `evaluate_0` and status to `evaluation_enabled`, thereby cleanly separating level and status, avoiding level numbering conflicts with old shadow semantics.
- R3-63: This ADR originally defined `ImprovementCandidateStatus` as 12 states. The root cause was that the state machine design did not converge to a canonical simplified model. Fix: The main text now simplifies the state machine to a 4-state core (candidate_created/under_review/released/rolled_back), with other intermediate states classified under the rollout level dimension.
