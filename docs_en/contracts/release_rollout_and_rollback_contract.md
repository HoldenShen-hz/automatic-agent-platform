# Release Rollout And Rollback Contract

> **OAPEFLIR Related**: This contract defines the controlled release and rollback mechanism of the OAPEFLIR Improve Hub. The current execution basis is ADR-075; ADR-018 is retained only as historical context.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines industrial-grade release, canary, rollback, and schema compatibility strategies for the OAPEFLIR Improve / Rollout pipeline.

Related documents:

- `runtime_repository_and_migration_contract.md`
- `prompt_model_policy_governance_contract.md`
- `enterprise_operations_plane_contract.md`
- [operations/release-versioning.md](../operations/release-versioning.md)
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Goals

- Unify release paths for code, config, prompt, role, and skill.
- Make any production release have controllable canary and executable rollback.
- Make schema changes comply with forward / backward compatibility.
- Integrate with the OAPEFLIR `LearningObject` -> `ImprovementCandidate` -> `RolloutRecord` pipeline.

## 3. Release Objects

- `application_binary`
- `config_bundle`
- `prompt_bundle`
- `policy_bundle`
- `role_bundle`
- `skill_bundle`
- `schema_migration`
- `LearningObject` (corresponding to the OAPEFLIR side chain)

## 4. Release Levels and RolloutStatus

### 4.1 Six-Level Controlled Release (L0-L5)

Corresponds to ADR-075 §1:

| Level | Name | Traffic | AI Autonomy | Human Approval |
| --- | --- | --- | --- | --- |
| L0 | `off` | 0% | No operation permission, record only | — |
| L1 | `evaluate_0` | 0% (record only) | Candidate evaluation / evidence validation | — |
| L2 | `canary_5` | 5% | Parameter tuning, strategy selection | Required for critical / high |
| L3 | `partial_25` | 25% | Configuration suggestion | Required for all |
| L4 | `stable_75` | 75% | Execute configuration change | Required for all |
| L5 | `stable_100` | 100% | Fully autonomous (subject to guardrail constraints) | Only on exception escalation |

### 4.2 Rollout State Machine

The complete state machine uses ADR-075 §2 as the execution basis; ADR-018 is only used to explain the origin of historical naming:

```
candidate_created
      ↓
under_review (human approval)
      ↓
approved / rejected
      ↓
evaluation_enabled (L1)
      ↓
canary_5 (L2) <-→ auto_rollback
      ↓
partial_25 (L3) <-→ auto_rollback
      ↓
stable_75 (L4) <-→ auto_rollback
      ↓
stable_100 (L5)
      ↓
released (no issues for M consecutive days)
```

### 4.3 Release Modes (Supplementary)

| Mode | Use Case |
| --- | --- |
| `blue_green` | Main chain major version, requires fast full-group switch |
| `canary` | Small traffic validation |
| `tenant_gray` | Designated tenant or division phased canary |
| `feature_flag` | Feature enable / disable and quick damage control |

### 4.4 Automatic Rollback Conditions

Corresponds to ADR-075 §3.2:

| Metric | Threshold | Window | Trigger Action |
| --- | --- | --- | --- |
| Error rate | > 1% | 5 minutes | L4 -> L3 |
| P99 latency | > 500ms | 5 minutes | L4 -> L3 |
| Success rate | < 99% | 5 minutes | L4 -> L3 |
| Consecutive failures | > 10 | 10 minutes | Rollback directly to L1 |
| Resource exhaustion | Memory > 90% | 1 minute | Rollback directly to L1 |

### 4.5 State Constraints

- `evaluate_0` (L1): Candidate evaluation and evidence validation, must not directly overwrite user-visible results.
- `canary_5` (L2) / `partial_25` (L3) / `stable_75` (L4): Must pass the metrics gate before promotion.
- `stable_100` (L5): Full traffic, fully autonomous (subject to guardrail constraints).
- `auto_rollback`: Automatic or manual rollback.

## 5. OAPEFLIR Side Chain Integration

```
LearningObject (validated / promoted)
    -> ImprovementCandidate (candidate_created)
    -> under_review
    -> approved / rejected
    -> RolloutRecord (evaluate_0 -> canary -> partial -> stable -> released)
```

**Mandatory Conditions** (R4-EVIDENCE constraints):
- A `LearningObject` without an evidence chain must not enter rollout.
- A candidate that has not passed the guardrail can only stay in `candidate_created` and must not enter `evaluation_enabled`.
- The `evaluation_enabled` runtime should record guardrail reason codes for explainability and audit.

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
- prompt / policy / feature flag should support independent rollback.
- Schema rollback, if irreversible, must be declared in advance and a compensating migration prepared.
- Rollback action must produce logs, audit records, and incident records.
- If local workspace file modification is involved, allow using a shadow snapshot / shadow git repo outside the workspace as the basis for step-level undo / redo; but must not leak git state into the user workspace.
- Shadow snapshot should at least support: one stable snapshot per operation, common generation directory exclusion, oversized directory protection, and must not pollute the user repository on failure.
- Policy rollback must not be executed purely based on model suggestion; it must be decided and recorded by system-layer guardrail / policy code.

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
- Has machine-readable secret / config injection plan, and workflow only consumes ref, not plaintext secret

## 12. Autonomy Boundary

Corresponds to `governance/autonomy_boundary_policy.md`:

| Level | AI Autonomy | Human Approval Requirement |
| --- | --- | --- |
| L0-L1 | Fully autonomous (record only) | Not required |
| L2 | Parameter tuning, strategy selection | Required for critical / high |
| L3 | Configuration change suggestion | Required for all |
| L4 | Execute configuration change | Required for all |
| L5 | Fully autonomous (subject to guardrail constraints) | Only on exception escalation |

## 13. Closure Conclusion

Industrial-grade release is not "can deploy", but "can canary, can validate, can rollback, can review".
