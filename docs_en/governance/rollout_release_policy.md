# Rollout Release Policy

---

## OAPEFLIR Relevance

This governance document regulates the following aspects of the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection vs governance boundary
- **Assess**: Execution evaluation vs permission governance
- **Plan**: Planning constraints vs R3 hard constraints
- **Execute**: Execution permissions vs security boundary
- **Feedback**: Feedback signal governance vs classification
- **Learn**: Learning content validation vs promotion boundary
- **Improve**: Improvement candidate approval vs Rollout governance
- **Release**: Release permissions vs auto-rollback rules

---

> **Governance Layer**: Improve Hub / Rollout
> **Effective Date**:2026-04-17
> **Related ADRs**: [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md), [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

##1. Objective

Define complete lifecycle governance rules for ImprovementCandidate from creation to production release, ensuring:
- Progressive release has clear stage thresholds
- Auto-rollback has measurable trigger conditions
- Rollout state transitions have complete audit logs
- Human approval intervenes at key points

##2. Six-Level Release Definitions

See [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md) for details.

| Level | Traffic | Autonomy Permissions | Approval Requirements |
|------|------|---------|---------|
| L0 |0% | None | — |
| L1 |0% (logging) | shadow | — |
| L2 |5% | Parameter adjustments | critical/high require approval |
| L3 |25% | Configuration suggestions | All require approval |
| L4 |75% | Configuration changes | All mandatory approval |
| L5 |100% | Fully autonomous | Only anomaly escalation |

##3. Stage Transition Rules

###3.1 Promotion Conditions

| From | To | Required Conditions | Minimum Duration |
|----|-----|---------|------------|
| L1 | L2 | Metrics meet standard |10 minutes |
| L2 | L3 | No rollback triggers |30 minutes |
| L3 | L4 | Success rate >99% |60 minutes |
| L4 | L5 | Stable operation |24 hours |

###3.2 Auto-Rollback Conditions

| Metric | Threshold | Window | Trigger Action |
|------|------|------|---------|
| Error rate | >1% |5 minutes | L4→L3 |
| P99 latency | >500ms |5 minutes | L4→L3 |
| Success rate | <99% |5 minutes | L4→L3 |
| Consecutive failures | >10 |10 minutes | Direct rollback to L1 |
| Resource exhaustion | Memory >90% |1 minute | Direct rollback to L1 |

##4. ImprovementCandidate Lifecycle

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
released (continuously M days without issues)
```

###4.1 Status Description

| Status | Description | Executable Operations |
|------|------|----------|
| `candidate_created` | Newly created candidate | submit_for_review |
| `under_review` | Awaiting human approval | approve / reject |
| `approved` | Approval passed | enable_shadow |
| `rejected` | Approval rejected | — |
| `shadow_enabled` | Shadow mode running | promote |
| `canary_5` |5% traffic validation | promote / rollback |
| `partial_25` |25% traffic validation | promote / rollback |
| `stable_75` |75% traffic validation | promote / rollback |
| `stable_100` | Full release | release |
| `released` | Official release completed | — |
| `auto_rollback` | Auto-rolling back | — |
| `rolled_back` | Rolled back | resubmit |

##5. RolloutScheduler Governance

```typescript
interface RolloutScheduler {
 // Schedule promotion (auto-triggered after time conditions are met)
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

##6. Audit Requirements

###6.1 Rollout Events That Must Be Recorded

| Event | Recorded Content |
|------|---------|
| `improvement:candidate_created` | candidateId, learningObjectId, priority |
| `improvement:under_review` | candidateId, submittedBy |
| `improvement:approved` | candidateId, approvedBy, conditions |
| `improvement:rejected` | candidateId, rejectedBy, reason |
| `improvement:promoted` | candidateId, fromLevel, toLevel, duration |
| `improvement:auto_rollback` | candidateId, trigger, fromLevel, toLevel |
| `improvement:released` | candidateId, totalDuration, finalMetrics |

###6.2 RolloutRecord Required Fields

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

##7. Rollback Governance

###7.1 Auto-Rollback Process

```
Metric threshold exceeded detection
 ↓
RolloutScheduler.scheduleRollback()
 ↓
Send notification event
 ↓
Execute rollback to last stable level
 ↓
Record auto_rollback event
 ↓
Wait for human review (confirm within48 hours)
```

###7.2 Human Intervention Conditions

| Scenario | Human Confirmation Required |
|------|----------------|
| Auto-rollback L2→L1 | Optional (auto-recovery) |
| Auto-rollback L3→L2 | Review recommended |
| Auto-rollback L4→L3 | Review mandatory |
| Auto-rollback L5→L4 | Review mandatory + approval required before re-promotion |
|3 consecutive rollbacks of same candidate | Auto-promotion prohibited, manual approval required |

##8. Capacity and Resource Limits

| Metric | Limit |
|------|------|
| Active rollouts at the same time | ≤10 |
| Maximum rollback count for single candidate |3 |
| Wait time for re-promotion after rollback |24 hours |
| L4 maximum duration |7 days |
| Daily new candidate limit |50 |

##9. Related Documents

- [ADR-075 Six-Level Controlled Release and Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md)
- [rollout-state-machine.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.ts)
- [auto-rollback-service.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/auto-rollback-service.ts)
