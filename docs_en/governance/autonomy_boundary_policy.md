# Autonomy Boundary Policy

> **Governance Layer**: Cross OAPEFLIR8 stages
> **Effective Date**:2026-04-17
> **Related ADRs**: [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md), [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)

##1. Objective

Define the autonomy permission boundaries for AI Agents at each OAPEFLIR stage, ensuring:
- AI does not perform operations beyond its confidence level
- High-risk operations require human approval (HITL)
- Autonomy permissions dynamically adjust with Rollout level (L0-L5)

##2. Permission Level Definitions

| Level | Name | AI Autonomy Permissions | Human Approval Required |
|------|------|------------|------------|
| **L0** | `off` | No operation permissions, only logging | Not required |
| **L1** | `shadow` | Log execution only, do not modify state | Not required |
| **L2** | `canary_5` | Parameter adjustments, strategy selection | Required for critical/high |
| **L3** | `partial_25` | Configuration change suggestions | Required for all |
| **L4** | `stable_75` | Execute configuration changes | Mandatory for all |
| **L5** | `stable_100` | Fully autonomous (constrained by guardrails) | Only for anomaly escalation |

##3. Stage Permission Matrix

| Stage | L0-L1 | L2 | L3 | L4-L5 |
|------|-------|-----|-----|-------|
| **Observe** | Read signals | Read + aggregate | Read + aggregate + filter | Fully autonomous |
| **Assess** | Evaluation computation | Evaluation + suggestion | Evaluation + suggestion + confirmation | Fully autonomous |
| **Plan** | Generate draft | Generate + select strategy | Generate + select + confirm | Fully autonomous |
| **Execute** | Read state | Execute + monitor | Execute + adjust + rollback | Fully autonomous |
| **Feedback** | Collect signals | Collect + preprocess | Collect + preprocess + correlate | Fully autonomous |
| **Learn** | Extract patterns | Extract + validate | Extract + validate + confirm | Fully autonomous |
| **Improve** | Generate candidates | Candidate + guardrail | Candidate + guardrail + approval | Fully autonomous |
| **Rollout** | Schedule logging | Schedule L2 | Schedule L3-L4 | Schedule L5 |

##4. Permission Boundary Rules

###4.1 Absolute Prohibitions (Any Level)

```
- Do not execute high-risk operations not evaluated by Assess
- Do not make decisions on blacklisted fields (recommendedWorkflow, riskLevel, approvalRequired, etc.)
- Do not bypass Plan DTO for direct execution (R3-NOBYPASS is mandatory)
- Do not introduce unverified content in Learn→Knowledge integration
```

###4.2 Conditional Prohibitions

| Condition | Prohibited Behavior | Reason |
|------|---------|------|
| Confidence <0.7 | Execute L4+ permission operations | Insufficient confidence |
| Time budget >80% | Initiate new Improve candidates | Resource strain |
| Consecutive failures >3 | Execute Execute stage | Failure accumulation |
| User explicitly refuses | Execute any changes | Human will takes priority |

###4.3 Approval Escalation Path

```
L2+ operation blocked by guardrail
 → Record approval request
 → Send notification to approval queue
 → Wait for human confirmation
 → Retry or downgrade after confirmation
```

##5. Autonomy Guardrail

The `ImprovementGuardrail` interface enforces permission boundaries:

```typescript
interface ImprovementGuardrail {
 // Evaluate whether the operation is within current autonomy permissions
 evaluateAutonomyLevel(
 candidate: ImprovementCandidate,
 currentRolloutLevel: RolloutLevel
 ): AutonomyEvaluation;

 // Check whether human approval is required
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

##6. Audit Requirements

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

##7. Violation Handling

| Violation Type | Handling Method |
|---------|---------|
| Bypass Plan execution | Task immediately terminated, log `R3-NOBYPASS` violation |
| Execute above L2 without approval | Execute rollback, notify administrator |
| Violate blacklisted fields | Output forcibly filtered, violation logged |
| Confidence <0.7 executes high-risk | Operation paused, awaiting human confirmation |

##8. Related Documents

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)
- [autonomy-boundary-policy.ts](../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.ts)
