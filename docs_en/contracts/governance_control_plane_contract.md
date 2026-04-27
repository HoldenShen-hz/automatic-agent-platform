# Governance Control Plane Contract

## 1. Scope

This contract defines the unified governance plane for the final platform, including policy evaluation, approval, budget, sandbox, kill switch, freeze, and audit entry.

It answers "who decides high-risk actions, at which layer, how to audit, how to block, and how to recover".

## 2. Goals

- Bring scattered governance judgments into unified `control plane`.
- Enable runtime, tool, approval, budget, and auth to have consistent decision entry points.
- Make deny, freeze, kill, takeover formal platform capabilities.
- Make governance decisions traceable, explainable, and replayable.

## 3. Non-Goals

- This contract does not specify specific policy engine products.
- This contract does not replace approval objects, sandbox rules, or budget field definitions themselves.
- This contract does not let governance layer directly tamper with business results.

## 4. Architecture Roles

- `PolicyDecisionService`
- `ApprovalGateway`
- `BudgetGuard`
- `ExecutionFreezeSwitch`
- `GovernanceAuditLedger`
- `DecisionContextBuilder`
- `EmergencyControlInterface`

```mermaid
flowchart LR
    A["Runtime / API / Tool / Admin"] --> B["DecisionContextBuilder"]
    B --> C["PolicyDecisionService"]
    B --> D["ApprovalGateway"]
    B --> E["BudgetGuard"]
    B --> F["Sandbox / Auth"]
    C --> G["DecisionResult"]
    D --> G
    E --> G
    F --> G
    G --> H["Execution / Tool / API Outcome"]
    G --> I["GovernanceAuditLedger"]
    J["EmergencyControlInterface"] --> H
    J --> I
```

## 5. Applicable Action Domain

Unified governance plane covers at least the following actions:

- runtime execution start
- tool call
- network access
- filesystem write
- external side-effect action
- observe / assess action proposal promote
- billing / quota sensitive action
- enterprise admin action

## 6. Key Objects

- `DecisionRequest`
- `DecisionResult`
- `DenyReason`
- `FreezeOrder`
- `KillOrder`
- `AuditEntry`
- `ApprovalRequirement`

## 7. Relationship between DecisionRequest and PolicyDecisionRequest

> `DecisionRequest` in this contract is a conceptual description of the governance plane entry point. The authoritative request object at the implementation layer is `PolicyDecisionRequest` defined in `policy_engine_contract.md`. The field mapping between the two is as follows:

| This Contract Concept Field | PolicyDecisionRequest Implementation Field | Description |
| --- | --- | --- |
| `request_id` | `decision_id` | Unique request identifier |
| `subject_id` | `subject_id` + `subject_type` | Policy Engine additionally distinguishes subject type |
| `task_id` | `task_id` | Associated task |
| `execution_id` | `execution_id` | Associated execution |
| `action_type` | `action` | Policy Engine defined enum values |
| `risk_level` | `risk_category` | Policy Engine uses finer-grained risk classification name |
| `context_json` | `metadata_json` + `resource_ref` + `estimated_cost_usd` + `mode` | Policy Engine splits context into structured fields |
| `submitted_at` | (internally recorded by Policy Engine) | — |

Rules:

- In implementation, use `PolicyDecisionRequest` as authoritative schema; this contract does not separately define a second set of request objects.
- If governance plane needs emergency controls like freeze / kill, can trigger through independent entry points `FreezeOrder` / `KillOrder`, need not force through `PolicyDecisionRequest`.
- `DecisionResult` (below) similarly uses `PolicyDecisionResult` as implementation reference, but governance plane extends `decision_source` dimension to distinguish sources.

## 8. DecisionResult Minimum Fields

- `request_id`
- `allowed`
- `decision_source` (`policy | approval | budget | auth | emergency_override`)
- `deny_reason?`
- `requires_approval`
- `applied_controls?`
- `resolved_at`

Rules:

- When `allowed=false`, must have explicit deny reason.
- `requires_approval=true` does not equal deny, but enters waiting state.
- Decision result must be able to explain source; "denied but no source" is not allowed.

## 9. Decision Priority

Suggested priority from high to low:

1. `emergency_override / freeze / kill`
2. `policy deny`
3. `auth deny`
4. `budget deny`
5. `approval required`
6. `allow`

Explanation:

- Emergency freeze takes priority over normal business allow.
- Explicit deny takes priority over approval required.
- Approval only solves problems requiring human permission, does not cover auth / policy hard prohibitions.

### 9.1 Decision Flowchart

```mermaid
flowchart TD
    A["DecisionRequest"] --> B{"Emergency Freeze / Kill?"}
    B -- "Yes" --> C["Deny Or Kill"]
    B -- "No" --> D{"Policy Allow?"}
    D -- "No" --> E["Policy Deny"]
    D -- "Yes" --> F{"Auth Allow?"}
    F -- "No" --> G["Auth Deny"]
    F -- "Yes" --> H{"Budget Allow?"}
    H -- "No" --> I["Budget Deny / Degrade"]
    H -- "Yes" --> J{"Approval Required?"}
    J -- "Yes" --> K["Wait For Approval"]
    J -- "No" --> L["Allow"]
    C --> M["Audit Ledger"]
    E --> M
    G --> M
    I --> M
    K --> M
    L --> M
```

## 10. Freeze / Kill Semantics

`FreezeOrder`
: Pause new execution or new side effects for a domain, but does not necessarily kill already executing actions.

`KillOrder`
: Forcefully interrupt specified execution, worker, queue, or tenant runs.

Minimum fields:

- `order_id`
- `domain_type`
- `domain_ref`
- `reason`
- `issued_by`
- `issued_at`
- `expires_at?`

Rules:

- Both freeze and kill must write to audit ledger.
- Kill must not occur silently, must be traceable to trigger, scope, and cause.
- Frozen domain defaults to fail-closed before recovery.

## 11. Approval Linkage

- Approval gateway is responsible for generating approval requirements, not responsible for final policy interpretation.
- High-risk actions must first go through governance control plane to determine whether to enter approval.
- After approval passes, still need to re-evaluate through minimum decision re-assessment, cannot directly skip governance layer execution.

## 12. Budget Linkage

- Budget guard participates in unified judgment as one of decision sources.
- Insufficient budget should return explicit deny or degrade semantics.
- Budget release does not equal policy release; both must separately have decision source.

## 13. Sandbox / Auth Linkage

- Sandbox decision is responsible for constraining "what can be done".
- Auth decision is responsible for constraining "who is qualified to do".
- Governance layer is responsible for putting both into same decision pipeline, rather than letting callers separately write judgments.

## 14. Audit Ledger

`AuditEntry` minimum fields:

- `audit_id`
- `request_id`
- `decision_source`
- `decision_summary`
- `actor_ref`
- `created_at`
- `trace_id?`

Rules:

- deny / freeze / kill / approval required must all write audit records.
- Audit ledger is part of governance fact source, should not only exist in logs.

## 15. Failure Mode

Governance plane needs to explicitly handle the following failure modes:

- Policy engine unavailable
- Approval backend unavailable
- Budget service timeout
- Auth provider fluctuation
- Emergency kill conflicts with normal allow

Handling principles:

- High-risk actions default to fail-closed.

## 15A. OAPEFLIR Governance Gates

For OAPEFLIR Phase 1-4, governance plane must cover at least the following gates:

- `plan_gate`
- `feedback_disposition_gate`
- `improvement_acceptance_gate`
- `rollout_transition_gate`

Rules:

- `Observe / Assess / Plan` can submit suggestions, but must not bypass governance gate to directly accept improvements or advance rollout.
- `rollout_transition_gate` within current authoritative scope only allows advancing to `off / suggest / shadow`.
- `canary_promote / full_release / rollback automation` are subsequent extended gates, must not impersonate phase1-4 delivered capabilities.
- Low-risk read-only actions can degrade per configuration.
- Emergency control always takes priority.

## 16. Relationship with Existing Documents

- `approval_and_hitl_contract.md` defines approval objects.
- `sandbox_and_auth_contract.md` defines security and authentication boundaries.
- `cost_and_budget_contract.md` defines budget and cost constraints.
- `execution_plane_contract.md` defines the surface of freeze / kill / takeover on execution plane.
- This contract defines how these capabilities converge into unified governance plane.

## 17. Phased Introduction

- Phase 2: Minimum unified decision entry + deny taxonomy.
- Phase 3: Observe-compatible product slice / monetization actions included in governance.
- Phase 4: Enterprise policy / compliance / audit suite.

## 18. Closure Conclusion

The core of governance plane is not "adding more rules", but converging approval, budget, permissions, policy, and emergency control into one explainable decision entry.

Subsequent any high-risk action, if it cannot integrate with this plane, should not be regarded as platform-level capability.
