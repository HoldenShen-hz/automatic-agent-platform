# Autonomy Boundary Policy

> **Governance Level**: Cross OAPEFLIR 8 Stages
> **Effective Date**: 2026-04-17
> **Related ADRs**: [ADR-016 OAPEFLIR 8-Stage Model](../adr/016-oapeflir-loop-model.md), [ADR-075 Six-Level Controlled Rollout](../adr/075-controlled-rollout-release.md)

## 1. Objective

Define AI Agent autonomy permission boundaries across OAPEFLIR stages, ensuring:
- AI does not execute operations beyond its confidence level
- High-risk operations require human approval (HITL)
- Autonomy permissions dynamically adjust with Rollout level (L0-L5)

## 2. Permission Level Definitions

| Level | Name | AI Autonomy | Human Approval Required |
|-------|------|-------------|-------------------------|
| **L0** | `off` | No operation permissions, read-only | Not required |
| **L1** | `shadow` | Read-only execution recording, no state changes | Not required |
| **L2** | `canary_5` | Parameter adjustment, strategy selection | Required for critical/high |
| **L3** | `partial_25` | Configuration change suggestions | Required for all |
| **L4** | `stable_75` | Execute configuration changes | Required for all |
| **L5** | `stable_100` | Fully autonomous (constrained by guardrails) | Exceptions only |

## 3. Stage Permission Matrix

| Stage | L0-L1 | L2 | L3 | L4-L5 |
|-------|-------|-----|-----|-------|
| **Observe** | Read signals | Read + aggregate | Read + aggregate + filter | Fully autonomous |
| **Assess** | Assessment calculation | Assess + recommend | Assess + recommend + confirm | Fully autonomous |
| **Plan** | Generate draft | Generate + select strategy | Generate + select + confirm | Fully autonomous |
| **Execute** | Read status | Execute + monitor | Execute + adjust + rollback | Fully autonomous |
| **Feedback** | Collect signals | Collect + preprocess | Collect + preprocess + correlate | Fully autonomous |
| **Learn** | Extract patterns | Extract + validate | Extract + validate + confirm | Fully autonomous |
| **Improve** | Generate candidates | Candidates + guardrail | Candidates + guardrail + approval | Fully autonomous |
| **Rollout** | Schedule records | Schedule L2 | Schedule L3-L4 | Schedule L5 |

## 4. Permission Boundary Rules

### 4.1 Absolute Prohibitions (Any Level)

```
- Do not execute high-risk operations without Assess evaluation
- Do not make decisions on blacklisted fields (recommendedWorkflow, riskLevel, approvalRequired, etc.)
- Do not bypass Plan DTO for direct execution (must follow R3-NOBYPASS)
- Do not introduce unverified content into Learn→Knowledge integration
```

### 4.2 Conditional Prohibitions

| Condition | Prohibited Behavior | Reason |
|-----------|---------------------|--------|
| Confidence < 0.7 | Execute L4+ permission operations | Insufficient confidence |
| Time budget > 80% | Submit new Improve candidates | Resource constraints |
| Consecutive failures > 3 | Execute Assess stage | Failure accumulation |
| User explicitly declines | Execute any changes | Human intent takes priority |

### 4.3 Approval Escalation Path

```
L2+ operation intercepted by guardrail
    → Record approval request
    → Send notification to approval queue
    → Wait for human confirmation
    → Retry or downgrade after confirmation
```

## 5. Autonomy Guardrail

`ImprovementGuardrail` interface enforces permission boundaries:

```typescript
interface ImprovementGuardrail {
  // Evaluate whether operation is within current autonomy permissions
  evaluateAutonomyLevel(
    candidate: ImprovementCandidate,
    currentRolloutLevel: RolloutLevel
  ): AutonomyEvaluation;

  // Check if human approval is required
  requiresHumanApproval(
    candidate: ImprovementCandidate,
    targetLevel: RolloutLevel
  ): boolean;
}

interface AutonomyEvaluation {
  allowed: boolean;
  currentLevel: RolloutLevel;
  requiredLevel: RolloutLevel;
  blockingReasons: string[];
  recommendations: string[];
}
```

## 6. Audit Requirements

All operations crossing permission boundaries must be logged:

```typescript
interface AutonomyAuditLog {
  timestamp: string;
  operation: string;
  requestedLevel: RolloutLevel;
  grantedLevel: RolloutLevel;
  actor: 'ai' | 'human';
  reason: string;
  outcome: 'approved' | 'rejected' | 'escalated';
}
```

## 7. Violation Handling

| Violation Type | Handling |
|---------------|----------|
| Bypass Plan execution | Task immediately terminated, `R3-NOBYPASS` violation recorded |
| Execute beyond L2 without approval | Execute rollback, notify administrator |
| Violate blacklisted fields | Output forcibly filtered, violation recorded |
| Execute high-risk with confidence < 0.7 | Operation paused, waiting for human confirmation |

## 8. Related Documents

- [ADR-016 OAPEFLIR 8-Stage Cognitive Loop Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Rollout & Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)
