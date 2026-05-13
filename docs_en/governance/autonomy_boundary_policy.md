# Autonomy Boundary Policy

> **Governance Level**: Cross OAPEFLIR 8 stages
> **Effective Date**: 2026-04-17
> **Related ADRs**: [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md), [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)

## 1. Objective

Define AI Agent's autonomy permission boundaries at each OAPEFLIR stage to ensure:
- AI does not execute operations beyond its confidence level
- High-risk operations require human approval (HITL)
- Autonomy permissions dynamically adjust with Rollout level (L0-L5)

## 2. Permission Level Definitions

| Level | Name | AI Autonomy Permission | Human Approval Required |
|------|------|----------------------|----------------------|
| **L0** | `off` | No operation permission, read-only | Not required |
| **L1** | `shadow` | Read and record execution only, do not modify state | Not required |
| **L2** | `canary_5` | Parameter adjustment, policy selection | Required for critical/high |
| **L3** | `partial_25` | Configuration change suggestions | Required for all |
| **L4** | `stable_75` | Execute configuration changes | Required for all |
| **L5** | `stable_100` | Fully autonomous (constrained by guardrail) | Escalation for exceptions only |

## 3. Stage Permission Matrix

| Stage | L0-L1 | L2 | L3 | L4-L5 |
|------|-------|-----|-----|-------|
| **Observe** | Read signals | Read + aggregate | Read + aggregate + filter | Fully autonomous |
| **Assess** | Assessment calculation | Assess + suggest | Assess + suggest + confirm | Fully autonomous |
| **Plan** | Generate draft | Generate + select strategy | Generate + select + confirm | Fully autonomous |
| **Execute** | Read state | Execute + monitor | Execute + adjust + rollback | Fully autonomous |
| **Feedback** | Collect signals | Collect + preprocess | Collect + preprocess + correlate | Fully autonomous |
| **Learn** | Extract patterns | Extract + validate | Extract + validate + confirm | Fully autonomous |
| **Improve** | Generate candidates | Candidates + guardrail | Candidates + guardrail + approval | Fully autonomous |
| **Rollout** | Schedule records | Schedule L2 | Schedule L3-L4 | Schedule L5 |

## 4. Permission Boundary Rules

### 4.1 Absolute Prohibitions (Any Level)

```
- Do not execute high-risk operations without Assess evaluation
- Do not make decisions on blacklist fields (recommendedWorkflow, riskLevel, approvalRequired, etc.)
- Do not bypass Plan DTO for direct execution (R3-NOBYPASS is mandatory)
- Do not introduce unverified content in Learn→Knowledge integration
```

### 4.2 Conditional Prohibitions

| Condition | Prohibited Behavior | Reason |
|------|---------|------|
| Confidence < 0.7 | Execute L4+ permission operations | Insufficient confidence |
| Time budget > 80% | Initiate new Improve candidates | Resource constraint |
| Consecutive failures > 3 | Execute Execute stage | Failure accumulation |
| User explicitly refuses | Execute any changes | Human will takes precedence |

### 4.3 Approval Escalation Path

```
L2+ operation intercepted by guardrail
    → Record approval request
    → Send notification to approval queue
    → Wait for human confirmation
    → Retry or degrade after confirmation
```

## 5. Autonomy Guardrail

`ImprovementGuardrail` interface enforces permission boundaries:

```typescript
interface ImprovementGuardrail {
  // Evaluate if operation is within current autonomy permission
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
|---------|---------|
| Bypass Plan execution | Task immediately terminated, `R3-NOBYPASS` violation recorded |
| Execute beyond L2 without approval | Execution rolled back, administrator notified |
| Violate blacklist fields | Output forcibly filtered, violation recorded |
| Execute high-risk with confidence < 0.7 | Operation paused, waiting for human confirmation |

## 8. Related Documents

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)