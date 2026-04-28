# Release Rollout And Rollback Contract

> **OAPEFLIR Relevance**: This contract defines the OAPEFLIR Improve Hub's controlled release and rollback mechanism, corresponding to ADR-075 and ADR-018.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines industrial-grade release, canary, rollback, and schema compatibility strategies for the OAPEFLIR Improve/Rollout pipeline.

Related documents:

- `runtime_repository_and_migration_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_operations_plane_contract.md`
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Goals

- Unify release paths for code, config, prompt, role, skill.
- Make any production release have controllable canary and executable rollback.
- Make schema changes comply with forward/backward compatibility.
- Integrate with OAPEFLIR LearningObject → ImprovementCandidate → RolloutRecord pipeline.

## 3. Release Objects

- `application_binary`
- `config_bundle`
- `prompt_bundle`
- `policy_bundle`
- `role_bundle`
- `skill_bundle`
- `schema_migration`
- `LearningObject` (corresponding to OAPEFLIR secondary chain)

## 4. Release Levels and RolloutStatus

### 4.1 Six-Level Controlled Release (L0-L5)

Corresponding to ADR-075 §1:

| Level | Name | Traffic | AI Autonomy | Human Approval |
|-------|------|---------|-------------|----------------|
| L0 | `off` | 0% | No operational authority, recording only | — |
| L1 | `evaluate_0` | 0% (recording only) | Candidate evaluation / evidence validation | — |
| L2 | `canary_5` | 5% | Parameter adjustment, strategy selection | critical/high require approval |
| L3 | `partial_25` | 25% | Configuration suggestions | all require approval |
| L4 | `stable_75` | 75% | Execute configuration changes | all must be approved |
| L5 | `stable_100` | 100% | Fully autonomous (constrained by guardrail) | Exception escalation only |

### 4.2 Rollout State Machine

Complete state machine (see ADR-018 and ADR-075 §2):

```
candidate_created
      ↓
under_review (human approval)
      ↓
approved / rejected
      ↓
evaluation_enabled (L1)
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

### 4.3 Release Modes (Supplementary)

| Mode | Use Case |
|------|----------|
| `blue_green` | Main chain major version, need quick full-group switch |
| `canary` | Small traffic validation |
| `tenant_gray` | Designated tenant or division phased canary |
| `feature_flag` | Feature enable/disable and quick damage control |

### 4.4 Auto-Rollback Conditions

Corresponding to ADR-075 §3.2:

| Metric | Threshold | Window | Triggered Action |
|--------|-----------|--------|------------------|
| Error Rate | > 1% | 5 minutes | L4→L3 |
| P99 Latency | > 500ms | 5 minutes | L4→L3 |
| Success Rate | < 99% | 5 minutes | L4→L3 |
| Continuous Failure | > 10 times | 10 minutes | Direct rollback to L1 |
| Resource Exhaustion | Memory > 90% | 1 minute | Direct rollback to L1 |

### 4.5 State Constraints

- `evaluate_0` (L1): Candidate evaluation and evidence validation, must not directly override user-visible results.
- `canary_5` (L2) / `partial_25` (L3) / `stable_75` (L4): Must pass metrics gate to upgrade.
- `stable_100` (L5): Full traffic, fully autonomous (constrained by guardrail).
- `auto_rollback`: Automatic or manual rollback.

## 5. OAPEFLIR Secondary Chain Integration

```
LearningObject(validated/promoted)
    → ImprovementCandidate(candidate_created)
    → under_review
    → approved / rejected
    → RolloutRecord(evaluate_0 → canary → partial → stable → released)
```

**Required Conditions** (R4-EVIDENCE constraint):
- LearningObject without evidence chain must not enter rollout.
- Candidate not passing guardrail can only stay in candidate_created state, must not enter `evaluation_enabled`.
- `evaluation_enabled` runtime should record guardrail reason codes for explainability and audit.

## 6. ImprovementCandidate Interface

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

type RolloutLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
```

## 7. RolloutRecord Interface

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

interface RolloutMetrics {
  errorRate: number;
  latencyP99: number;
  successRate: number;
  sampleCount: number;
}
```

## 8. Rollback Rules

- Code rollback must be faster than data repair.
- Prompt / policy / feature flag should support independent rollback.
- Schema rollback if irreversible, must declare in advance and prepare compensating migration.
- Rollback action must produce logs, audit, and incident records.
- If local workspace file modification is involved, allow using shadow snapshot / shadow git repo outside workspace as step-level undo / redo basis; but must not leak git state into user workspace.
- Shadow snapshot should at least support: one stable snapshot per operation, common generation directory exclusion, oversized directory protection, and do not pollute user repository on failure.
- Policy rollback must not be executed purely based on model suggestion; must be decided and recorded by system layer guardrail / policy code.

## 9. Required Capabilities

- Release batch ID
- Release object version
- Canary target scope
- One-click rollback entry
- Rollback prerequisite check
- Post-release health validation
- `config_bundle_ref / registry_credential_ref / deployment_credential_ref` injection plan

## 10. Schema Compatibility Matrix

Industrial-grade schema changes must first comply with:

1. Add before use
2. Be compatible before switching
3. Forward first, then clean up

Not allowed:

- Directly delete columns being depended on by old versions
- Simultaneously launch "new code depends on new column" with no compatibility window
- Bundle irreversible data conversion and application logic switching into one step

## 11. Production Prerequisites

- Has health validation step
- Has tenant gray strategy
- Has rollback owner
- Has schema compatibility checklist
- Has machine-readable secret/config injection plan, and workflow only consumes ref, not plaintext secret

## 12. Autonomy Boundary

Corresponding to governance/autonomy_boundary_policy.md:

| Level | AI Autonomy | Human Approval Required |
|-------|-------------|------------------------|
| L0-L1 | Fully autonomous (recording only) | Not required |
| L2 | Parameter adjustment, strategy selection | Required for critical/high |
| L3 | Configuration change suggestions | Required for all |
| L4 | Execute configuration changes | Must for all |
| L5 | Fully autonomous (constrained by guardrail) | Exception escalation only |

## 13. Closure Conclusion

Industrial-grade release is not "can deploy", but "can canary, can validate, can rollback, can review".
