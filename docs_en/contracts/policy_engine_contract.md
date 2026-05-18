# Policy Engine Contract

## 1. Scope

This contract defines the unified Policy Engine entry point, used to aggregate role static permissions, execution policies, approval escalation, budget guards, sensitive operation classification, and kill switch.

Related documents:

- `approval_and_hitl_contract.md`
- `sandbox_and_auth_contract.md`
- `cost_and_budget_contract.md`
- `governance_control_plane_contract.md`
- `tool_skill_plugin_contract.md`

## 2. Objectives

The unified Policy Engine must at minimum solve:

- Different modules no longer make permission decisions independently.
- High-risk actions enter the same decision chain.
- Approval, budget, permissions, and kill switch conclusions are composable and auditable.

## 3. Key Objects

### 3.1 `PolicyDecisionRequest`

| Field | Type | Description |
| --- | --- | --- |
| `decision_id` | `string` | Decision request ID |
| `task_id` | `string` | Current task |
| `harness_run_id` | `string?` | Current HarnessRun |
| `node_run_id` | `string?` | Current NodeRun |
| `attempt_id` | `string?` | Current NodeAttempt |
| `session_id` | `string?` | Current session |
| `subject_type` | `user \| agent \| system` | Request subject |
| `subject_id` | `string` | Subject ID |
| `action` | `invoke_model \| invoke_tool \| write_file \| exec_command \| network_access \| install_extension \| org_change \| dispatch_execution \| set_isolation_level \| promote_improvement \| advance_rollout \| modify_knowledge_trust \| promote_memory_layer` | Target action |
| `resource_ref` | `string?` | Resource reference |
| `risk_category` | `destructive \| irreversible \| prod_affecting \| cost_sensitive \| org_changing \| sensitive_data \| strategy_affecting \| governance_sensitive` | Risk category |
| `mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Current runtime mode |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current OAPEFLIR stage view reference; must not be used as truth decision primary key |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `metadata_json` | `json?` | Extra context |

Rules:

- `harness_run_id / node_run_id / attempt_id` are the authoritative correlation keys.
- `mode` must use the 8 canonical modes defined by the architecture; `supervised / auto / full-auto` are only allowed as legacy input and normalized at the entry point.
- Degraded modes must be explicitly understood by policies, not privately inferred by callers using boolean combinations.
- `stage_view_ref` only provides explanatory context; runtime mode decisions still follow `OperationalDirective`, risk category, budget, and policy rules.

## v4.3 Contract Remediation

### 3.2 `PolicyDecisionResult`

- `decision`
- `reason_code`
- `requires_approval`
- `enforced_constraints`
- `kill_switch_applied`
- `audit_payload`
- `evaluated_policy_version`
- `decision_ttl_ms?`
- `matched_rule_refs?`
- `explain_summary?`

`decision` enum:

- `allow`
- `deny`
- `allow_with_constraints`
- `escalate_for_approval`

### 3.3 `PolicyDecisionExplain`

Minimum fields:

- `decision_id`
- `summary`
- `factors`
- `policy_paths`
- `trace_refs?`
- `rule_sources?`
- `remediation_hint?`

### 3.4 `PolicyAuditRecord`

Minimum fields:

- `audit_id`
- `decision_id`
- `policy_bundle_id`
- `policy_version`
- `input_snapshot_ref`
- `decision_snapshot_ref`
- `evaluated_at`
- `latency_ms`

## 4. Decision Chain

```mermaid
flowchart TD
    A["PolicyDecisionRequest"] --> B["Static Role Permission"]
    B --> C["Sandbox / Path / Network Rules"]
    C --> D["Budget And Quota Guard"]
    D --> E["Sensitive Operation Classification"]
    E --> F["Stage / Governance Gate"]
    F --> G["Approval Escalation Rules"]
    G --> H["Kill Switch / Freeze Check"]
    H --> I["PolicyDecisionResult"]
```

Rules:

- Any step that explicitly `deny` should fail-closed.
- `allow_with_constraints` must explicitly return tightened path, tools, budget, or timeout constraints.
- Approval escalation must not override hard denial items; actions hard-denied must not be released through approval.
- After kill switch / freeze hits, approval cannot re-release already frozen actions.
- Constraints of `allow_with_constraints` must be authoritative, and subsequent execution must not arbitrarily relax them.
- `manual_only` and `incident-mode` are not UI labels but enforced runtime modes; after hit, the execution layer must not demote them to ordinary warnings.

## 5. Sensitive Operation Classification Table

| Classification | Examples | Default Action |
| --- | --- | --- |
| `destructive` | Delete files, overwrite critical config | Approval or deny |
| `irreversible` | External commit, release, send irretrievable messages | Approval |
| `prod_affecting` | Commands affecting production environment | Approval or deny |
| `cost_sensitive` | High-cost long-reasoning with large models | Budget check + possible approval |
| `org_changing` | Modify organization, role, tenant config | Approval |
| `sensitive_data` | Access keys, credentials, privacy data | Path/permission constraint + approval |
| `strategy_affecting` | Accept improvement candidate, change strategy version | Guardrail + approval |
| `governance_sensitive` | Rollout advancement, knowledge trust modification, memory promotion | Gate + approval or deny |

## 6. Boundary With Approval

- Policy Engine decides "whether approval is needed".
- Approval system is responsible for "how approval requests are sent and returned".
- After approval passes, it must still re-enter Policy Engine for final release to avoid environment changes after approval.

## 7. Boundary With Tools, Skills, Plugins

- Skill must not cross role tool whitelist.
- Plugin / MCP installation units must first pass Policy Engine and cannot directly bypass ToolRegistry.
- MCP must not disguise as local trusted tool to gain broader permissions.
- Same action under different `resource_ref`, `path_scope`, `tenant scope` must be evaluated independently and must not incorrectly reuse old approval conclusions.
- Same request under different `mode` must be re-evaluated and must not reuse old `full_auto` allow for `read_only`, `no-rollout`, or `incident-mode`.

## 7B. Boundary With OAPEFLIR Hub

- Observe / Assess / Plan stages produce suggestions and context, not authoritative release conclusions.
- FeedbackHub may provide negative signals, user corrections, and quality metrics but must not directly label candidate improvements as accepted.
- LearnHub can only generate draft / validated learning objects and cannot directly modify release or rollout status.
- ImproveHub proposals must be ruled by Policy Engine on `promote_improvement` before entering guardrail / approval chain.
- When ReleaseHub advances `advance_rollout`, Policy Engine must re-evaluate current risk, budget, runtime mode, and freeze state.
- `modify_knowledge_trust` and `promote_memory_layer` belong to M2 extension actions; when related planes are not enabled, must fail-closed instead of silently allow.

## 7A. Boundary With Dispatch And Isolation

Execution dispatch involves the following policy evaluation points and must go through Policy Engine:

| Evaluation Point | action | Description |
| --- | --- | --- |
| dispatch target selection | `dispatch_execution` | Decides where execution is dispatched to which worker or worker group (local / named / capability-match), resource_ref is the target worker or capability description |
| isolation level elevation | `set_isolation_level` | When execution requires `containerized` or higher isolation level, policy checks whether that isolation level and associated resource consumption are allowed |
| remote worker capability authorization | `dispatch_execution` | Whether capabilities declared by remote worker are within `allowedCapabilities` whitelist, needs policy confirmation |

Rules:

- Dispatch decision must go through Policy Engine before ticket creation and must not be independently determined within dispatch service.
- Isolation level elevation may involve additional resource costs (container startup, image pull) and should link with `cost_sensitive` risk classification.
- Remote worker capability filtering results (rejected capability list) should be written to `PolicyAuditRecord`.
- `allow_with_constraints` may be used to tighten dispatch target scope (e.g., limit to specific worker group) or reduce isolation level.

## 8. Caching And Inheritance Denial

- Similar high-risk requests in the same session may inherit recent denial conclusions to avoid approval bombardment.
- Cache key must not be command-name only and should include action, resource, subject, and risk category.
- When inheritance denial hits, audit records must still be retained.
- Cache hits must not be reused across `tenant / workspace / organization / mode`.

## 9. Rule Lint And Unreachable Rule Detection

Before enabling Policy / permission rules, at minimum:

- Duplicate rule detection
- Shadow rule detection
- Unreachable allow rule detection
- Source conflict detection

Must identify at minimum:

- tool-wide `deny` makes more specific `allow` forever unreachable
- tool-wide `ask` makes more specific `allow` forever unable to hit directly
- Shared source rules and local temporary rules mutually mask each other, resulting in final effect inconsistent with author expectation

Rules:

- Policy packages that fail lint must not enter the authoritative allow path.
- If allowed to continue as warning, warning must be written to explain and audit results.
- Runtime determination results should return which rule hit and what it overrides, rather than just giving abstract `deny`.

## 10. Rule Evaluation Order

- Policy / permission rule matching order must be deterministic and explainable.
- If system supports wildcard, partial override, local temporary rules, and global rules coexisting, must clarify:
  - By explicit `priority`
  - Or by source order / last-match
  - Or other equivalent stable strategy
- Same request must not get different conclusions due to traversal order, concurrent loading order, or source aggregation order differences.
- Explain and audit results should indicate "which rule finally won and what it overrides".

## 11. Audit Requirements

Each policy decision must retain at minimum:

- Who requested what
- Which policy nodes were triggered
- Why finally allowed, denied, or escalated
- What the tightened constraints are
- Which policy version / config version was used
- Which input / decision snapshot the audit snapshot references

## 12. Key Decision Boundaries

- Policy Engine is the final decision entry point, not a suggestion collector.
- LLM, workflow planner, and approval packet can only provide context or suggestions and must not directly construct authoritative allow.
- If Policy Engine conflicts with upstream suggestions, Policy Engine always prevails.

## 13. Phase Boundaries

Phase 1a / 1b explicitly do:

- Single-process unified entry
- Role static permissions
- Sandbox / path / network rules
- Budget guard
- Approval escalation
- Kill switch / freeze check

Currently not doing:

- OPA integration
- External policy providers
- Multi-tenant distributed policy execution cluster

Supplementary notes:

- OPA is not currently written as a done deal, but `PolicyDecisionRequest / Result / Explain / AuditRecord` shapes should remain adaptable to external policy engines.
- If OPA or equivalent policy engine is introduced later, priority should be to reuse the input, explanation, and audit boundaries of this contract rather than creating another parallel model.

## 14. Closure Conclusion

The meaning of Policy Engine is not to recreate another layer of abstraction, but to close the judgments previously scattered across permissions, budget, approval, and security into a unified, auditable, reusable decision chain.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-17: This document originally compressed runtime modes into `supervised / auto / full-auto` three values. Root cause: early policy contract only covered "whether to auto-execute" and did not treat the degraded protection modes in the architecture as first-class governance objects. Fix: The body now converges `mode` to 8 canonical modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`, and demotes the old three values to legacy input.
- T-19: The original `PolicyDecisionRequest` field already correctly uses `harness_run_id / node_run_id / attempt_id` as authoritative correlation keys and does not use the deprecated `execution_id`. R2-19 is an audit misjudgment; §3.1 of this document was aligned with v4.3 specification from the beginning and requires no modification.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plan must use `PlanGraphBundle`; execution result must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.