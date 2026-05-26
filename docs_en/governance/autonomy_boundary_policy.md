# Autonomy Boundary Policy

> **Governance Level**: Cross OAPEFLIR 8 Stages
> **Effective Date**: 2026-04-17
> **Related ADRs**: [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md), [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)

## 1. Objective

Define the autonomy permission boundaries for AI Agents at each stage of OAPEFLIR, ensuring:
- AI does not execute operations beyond its confidence level
- High-risk operations require human approval (HITL)
- Autonomy permissions dynamically adjust with Rollout level (L0-L5)

## 2. Permission Level Definitions

| Level | Name | AI Autonomy Permission | Human Approval Required |
|------|------|------------|------------|
| **L0** | `off` | No operational authority, read-only | Not required |
| **L1** | `shadow` | Read-only execution recording, no state modification | Not required |
| **L2** | `canary_5` | Parameter adjustment, strategy selection | Required for critical/high |
| **L3** | `partial_25` | Configuration change suggestions | Required for all |
| **L4** | `stable_75` | Execute configuration changes | Required for all |
| **L5** | `stable_100` | Fully autonomous (subject to guardrail constraints) | Escalation for exceptions only |

## 3. Stage Permission Matrix

| Stage | L0-L1 | L2 | L3 | L4-L5 |
|------|-------|-----|-----|-------|
| **Observe** | Read signals | Read + aggregate | Read + aggregate + filter | Fully autonomous |
| **Assess** | Evaluation computation | Evaluate + suggest | Evaluate + suggest + confirm | Fully autonomous |
| **Plan** | Generate drafts | Generate + select strategy | Generate + select + confirm | Fully autonomous |
| **Execute** | Read status | Execute + monitor | Execute + adjust + rollback | Fully autonomous |
| **Feedback** | Collect signals | Collect + preprocess | Collect + preprocess + correlate | Fully autonomous |
| **Learn** | Extract patterns | Extract + validate | Extract + validate + confirm | Fully autonomous |
| **Improve** | Generate candidates | Candidate + guardrail | Candidate + guardrail + approval | Fully autonomous |
| **Rollout** | Scheduling records | Schedule L2 | Schedule L3-L4 | Schedule L5 |

## 4. Permission Boundary Rules

### 4.1 Absolute Prohibitions (Any Level)

```
- Do not execute high-risk operations without Assess evaluation
- Do not make decisions on blacklisted fields (recommendedWorkflow, riskLevel, approvalRequired, etc.)
- Do not bypass Plan DTO direct execution (must follow R3-NOBYPASS)
- Do not introduce unverified content in Learn→Knowledge integration
```

### 4.2 Conditional Prohibitions

| Condition | Prohibited Behavior | Reason |
|------|---------|------|
| Confidence < 0.7 | Execute L4+ permission operations | Insufficient confidence |
| Time budget > 80% | Initiate new Improve candidates | Resource constraint |
| Consecutive failures > 3 | Execute the Execute stage | Failure accumulation |
| User explicitly refuses | Execute any changes | Human will takes precedence |

### 4.3 Approval Escalation Path

```
L2+ operations blocked by guardrail
    → Record approval request
    → Send notification to approval queue
    → Wait for human confirmation
    → Retry or downgrade after confirmation
```

## 5. Autonomy Guardrail

The `ImprovementGuardrail` interface enforces permission boundaries:

```typescript
interface ImprovementGuardrail {
  // Evaluate if operation is within current autonomy scope
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

| Violation Type | Handling Method |
|---------|---------|
| Bypass Plan execution | Task immediately terminated, record `R3-NOBYPASS` violation |
| Execute beyond L2 without approval | Execution rolled back, administrator notified |
| Violate blacklisted fields | Output force-filtered, violation recorded |
| Execute high-risk with confidence < 0.7 | Operation paused, waiting for human confirmation |

## 8. Related Documents

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)
