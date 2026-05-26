# Rollout Release Policy

---

## OAPEFLIR Association

This governance document standardizes the following content within the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and governance boundaries
- **Assess**: Execution assessment and permission governance
- **Plan**: Planning constraints and R3 hard constraints
- **Execute**: Execution permissions and security boundaries
- **Feedback**: Feedback signal governance and classification
- **Learn**: Learning content validation and promotion boundaries
- **Improve**: Improvement candidate approval and Rollout governance
- **Release**: Release permissions and automatic rollback rules

---

> **Governance Level**: Improve Hub / Rollout
> **Effective Date**: 2026-04-17
> **Related ADRs**: [ADR-075 Six-Level Controlled Rollout](../adr/075-controlled-rollout-release.md), [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 1. Objective

Define complete lifecycle governance rules for ImprovementCandidate from creation to production release, ensuring:
- Gradual release has clear stage thresholds
- Automatic rollback has measurable trigger conditions
- Rollout state transitions have complete audit logs
- Human approval intervenes at key nodes

## 2. Six-Level Release Definition

See [ADR-075 Six-Level Controlled Rollout](../adr/075-controlled-rollout-release.md) for details.

| Level | Traffic | Autonomy Permissions | Approval Requirement |
|------|---------|---------------------|---------------------|
| L0 | 0% | None | — |
| L1 | 0% (record) | shadow | — |
| L2 | 5% | Parameter adjustment | critical/high requires approval |
| L3 | 25% | Configuration suggestion | All requires approval |
| L4 | 75% | Configuration change | All must have approval |
| L5 | 100% | Fully autonomous | Exception escalation only |

## 3. Stage Transition Rules

### 3.1 Upgrade Conditions

| From | To | Necessary Conditions | Minimum Duration |
|----|----|---------------------|-----------------|
| L1 | L2 | Metrics met | 10 minutes |
| L2 | L3 | No rollback triggered | 30 minutes |
| L3 | L4 | Success rate > 99% | 60 minutes |
| L4 | L5 | Stable operation | 24 hours |

### 3.2 Automatic Rollback Conditions

| Metric | Threshold | Window | Triggered Action |
|--------|-----------|--------|-----------------|
| Error rate | > 1% | 5 minutes | L4→L3 |
| P99 latency | > 500ms | 5 minutes | L4→L3 |
| Success rate | < 99% | 5 minutes | L4→L3 |
| Consecutive failures | > 10 times | 10 minutes | Direct rollback to L1 |
| Resource exhaustion | Memory > 90% | 1 minute | Direct rollback to L1 |

## 4. ImprovementCandidate Lifecycle

```
candidate_created
      ↓
under_review (human approval)
      ↓
approved / rejected
      ↓
shadow_enabled (L1)
      ↓
canary_5 (L2) ←→ auto_rollback
      ↓
partial_25 (L3) ←→ auto_rollback
      ↓
stable_75 (L4) ←→ auto_rollback
      ↓
stable_100 (L5)
      ↓
released (continuous M days without issues)
```

### 4.1 State Description

| State | Description | Executable Operations |
|-------|-------------|---------------------|
| `candidate_created` | New candidate | submit_for_review |
| `under_review` | Waiting for human approval | approve / reject |
| `approved` | Approval passed | enable_shadow |
| `rejected` | Approval rejected | — |
| `shadow_enabled` | Shadow mode running | promote |
| `canary_5` | 5% traffic verification | promote / rollback |
| `partial_25` | 25% traffic verification | promote / rollback |
| `stable_75` | 75% traffic verification | promote / rollback |
| `stable_100` | Full release | release |
| `released` | Official release completed | — |
| `auto_rollback` | Automatic rollback in progress | — |
| `rolled_back` | Has been rolled back | resubmit |

## 5. RolloutScheduler Governance

```typescript
interface RolloutScheduler {
  // Schedule upgrade (automatically triggered after time conditions met)
  schedulePromotion(
    candidateId: string,
    targetLevel: RolloutLevel,
    scheduledAt: string
  ): void;

  // Schedule rollback
  scheduleRollback(
    candidateId: string,
    reason: RollbackReason,
    targetLevel: RolloutLevel
  ): void;

  // Get active rollouts
  getActiveRollouts(): RolloutRecord[];

  // Get rollout history
  getRolloutHistory(candidateId: string): RolloutRecord[];
}
```

## 6. Audit Requirements

### 6.1 Rollout Events That Must Be Recorded

| Event | Recorded Content |
|-------|-----------------|
| `improvement:candidate_created` | candidateId, learningObjectId, priority |
| `improvement:under_review` | candidateId, submittedBy |
| `improvement:approved` | candidateId, approvedBy, conditions |
| `improvement:rejected` | candidateId, rejectedBy, reason |
| `improvement:promoted` | candidateId, fromLevel, toLevel, duration |
| `improvement:auto_rollback` | candidateId, trigger, fromLevel, toLevel |
| `improvement:released` | candidateId, totalDuration, finalMetrics |

### 6.2 RolloutRecord Required Fields

```typescript
interface RolloutRecord {
  recordId: string;
  candidateId: string;
  fromLevel: RolloutLevel;
  toLevel: RolloutLevel;
  triggeredBy: 'scheduler' | 'human' | 'auto_rollback';
  triggerReason?: string;
  metrics: RolloutMetrics;
  auditContext: AuditContext;
  createdAt: string;
}
```

## 7. Rollback Governance

### 7.1 Automatic Rollback Process

```
Metric threshold exceeded detection
    ↓
RolloutScheduler.scheduleRollback()
    ↓
Send notification event
    ↓
Execute rollback to previous stable level
    ↓
Record auto_rollback event
    ↓
Wait for human review (confirm within 48 hours)
```

### 7.2 Human Intervention Conditions

| Scenario | Human Confirmation Required |
|---------|---------------------------|
| Auto rollback L2→L1 | Optional (auto recovery) |
| Auto rollback L3→L2 | Recommended review |
| Auto rollback L4→L3 | Must review |
| Auto rollback L5→L4 | Must review + approval required before re-upgrade |
| Consecutive 3 rollbacks for same candidate | Automatic upgrade prohibited, human approval required |

## 8. Capacity and Resource Limits

| Metric | Limit |
|--------|-------|
| Active rollouts at same time | ≤ 10 |
| Maximum rollback count per candidate | 3 |
| Wait time after rollback before re-upgrade | 24 hours |
| Maximum L4 duration | 7 days |
| Maximum new candidates per day | 50 |

## 9. Related Documents

- [ADR-075 Six-Level Controlled Rollout and Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md)
- [rollout-state-machine.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.ts)
- [auto-rollback-service.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.ts)
