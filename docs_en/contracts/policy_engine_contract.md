# Policy Engine Contract

## 1. Scope

This contract defines the unified Policy Engine entry point, used to aggregate role-based static permissions, execution policies, approval escalation, budget guards, sensitive operation classification, and kill switches.

Related documents:

- `approval_and_hitl_contract.md`
- `sandbox_and_auth_contract.md`
- `cost_and_budget_contract.md`
- `governance_control_plane_contract.md`
- `tool_skill_plugin_contract.md`

## 2. Objectives

The unified Policy Engine must at minimum address:

- Different modules no longer make permission judgments independently.
- High-risk actions enter a single decision chain.
- Conclusions from approval, budget, permissions, and kill switches are composable and auditable.

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
| `risk_category` | `destructive \| irreversible \| prod_affecting \| cost_sensitive \| org_changing \| sensitive_data \| strategy_affecting \| governance_sensitive` | Risk classification |
| `mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Current execution mode |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current OAPEFLIR stage view reference; must not be used as the primary key for truth decisions |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `metadata_json` | `json?` | Additional context |

Rules:

- `harness_run_id / node_run_id / attempt_id` are the authoritative association keys.
- `mode` must use the 8 canonical modes defined in the architecture; `supervised / auto / full-auto` are only allowed as legacy inputs and must be normalized at the entry point.
- Degraded modes must be explicitly understood by policies, not privately inferred by callers using boolean combinations.
- `stage_view_ref` only provides explanatory context; execution mode decisions still rely on `OperationalDirective`, risk classification, budget, and policy rules.

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

- Any step that explicitly returns `deny` should fail-closed.
- `allow_with_constraints` must explicitly return the tightened path, tools, budget, or timeout constraints.
- Approval escalation must not override hard denials; actions that are hard-denied cannot be allowed through approval.
- After a kill switch / freeze is hit, approval cannot re-allow an already frozen action.
- Constraints in `allow_with_constraints` are authoritative; subsequent execution must not unilaterally relax them.
- `manual_only` and `incident-mode` are not UI labels, but hard constraint execution modes; when hit, the execution layer must not demote them to ordinary warnings.

## 5. Sensitive Operation Classification Table

| Classification | Examples | Default Action |
| --- | --- | --- |
| `destructive` | Delete files, overwrite critical configurations | Approval or denial |
| `irreversible` | External commits, releases, sending non-retractable messages | Approval |
| `prod_affecting` | Production-affecting commands | Approval or denial |
| `cost_sensitive` | High-cost LLM long-reasoning | Budget check + possible approval |
| `org_changing` | Modify organization, role, tenant configuration | Approval |
| `sensitive_data` | Access keys, credentials, privacy data | Path/permission constraints + approval |
| `strategy_affecting` | Accept improvement candidate, change strategy version | Guardrail + approval |
| `governance_sensitive` | Rollout advancement, knowledge trust modification, memory promotion | Gate + approval or denial |

## 6. Boundary with Approval

- Policy Engine decides "whether approval is needed".
- Approval system is responsible for "how approval requests are sent and how responses are returned".
- After approval is granted, the action must re-enter Policy Engine for final release to avoid acting on a changed environment.

## 7. Boundary with Tools, Skills, and Plugins

- Skills must not bypass role-based tool whitelists.
- Plugin / MCP installation units must first pass Policy Engine and cannot directly bypass ToolRegistry.
- MCP must not impersonate locally trusted tools to gain broader permissions.
- The same action under different `resource_ref`, `path_scope`, or `tenant scope` must be evaluated independently; must not incorrectly reuse old allow conclusions.
- The same request under different `mode` must be re-evaluated; must not reuse an old `full_auto` allow for `read_only`, `no-rollout`, or `incident-mode`.

## 7B. Boundary with OAPEFLIR Hub

- Observe / Assess / Plan stages produce recommendations and context, not authoritative allow conclusions.
- FeedbackHub can provide negative signals, user corrections, and quality metrics, but must not directly mark candidate improvements as accepted.
- LearnHub can only generate draft / validated learning objects and cannot directly modify release or rollout state.
- ImproveHub proposals must be ruled on by Policy Engine via `promote_improvement` before entering the guardrail / approval chain.
- When ReleaseHub advances `advance_rollout`, Policy Engine must re-evaluate current risk, budget, execution mode, and freeze status.
- `modify_knowledge_trust` and `promote_memory_layer` are M2 extended actions; when related planes are not enabled, must fail-closed rather than silently allow.

## 7A. Boundary with Dispatch and Isolation

Execution dispatch involves the following policy evaluation points and must go through Policy Engine:

| Evaluation Point | action | Description |
| --- | --- | --- |
| Dispatch target selection | `dispatch_execution` | Determines which worker or worker group (local / named / capability-match) the execution is dispatched to; resource_ref is the target worker or capability description |
| Isolation level elevation | `set_isolation_level` | When execution requires `containerized` or higher isolation level, policy checks whether that isolation level and associated resource consumption are allowed |
| Remote worker capability authorization | `dispatch_execution` | Whether remote worker-declared capabilities are in the `allowedCapabilities` whitelist; requires policy confirmation |

Rules:

- Dispatch decisions must go through Policy Engine before ticket creation; must not independently determine targets within the dispatch service.
- Isolation level elevation may involve additional resource costs (container startup, image pull); should be linked with `cost_sensitive` risk classification.
- Remote worker capability filtering results (rejected capability list) should be written to `PolicyAuditRecord`.
- `allow_with_constraints` can be used to tighten dispatch target scope (e.g., restrict to specific worker group) or lower isolation level.

## 8. Caching and Inherited Denial

- Consecutive similar high-risk requests within the same session can inherit recent denial conclusions to avoid approval bombardment.
- Cache keys must not be based solely on command names; must include action, resource, subject, and risk classification.
- When inherited denial is hit, audit records must still be retained.
- Cache hits must not be reused across `tenant / workspace / organization / mode`.

## 9. Rule Lint and Unreachable Rule Detection

Policy / permission rules must at minimum do the following before being enabled:

- Duplicate rule detection
- Shadow rule detection
- Unreachable allow rule detection
- Source conflict detection

Must identify at minimum the following issues:

- Tool-wide `deny` makes more specific `allow` permanently unreachable
- Tool-wide `ask` makes more specific `allow` unable to directly hit
- After shared source rules and local temporary rules mask each other, the final effect is inconsistent with the author's expectation

Rules:

- Policy bundles that fail lint must not enter the authoritative allow path.
- If allowed to continue as warnings, warnings must be written to explain and audit results.
- Runtime decision results should return the hit rule sources and remediation hints as much as possible, not just abstract `deny`.

## 10. Rule Evaluation Order

- Policy / permission rule matching order must be deterministic and explainable.
- If the system supports wildcards, partial overrides, local temporary rules, and global rules coexisting, must clarify:
  - Is it by explicit `priority`
  - Or by source order / last-match
  - Or other equivalent stable strategy
- The same request must not get different conclusions due to different traversal order, concurrent loading order, or source aggregation order.
- Explain and audit results should be able to point out "which rule finally won and what it overrode".

## 11. Audit Requirements

At minimum, each policy decision must retain:

- Who requested what
- Which policy nodes were triggered
- Why it was ultimately allowed, denied, or escalated
- What the tightened constraints are
- Which policy version / config version was used
- Which input / decision snapshot the audit snapshot references

## 12. Key Decision Boundaries

- Policy Engine is the final decision entry point, not a recommendation collector.
- LLM, workflow planner, and approval packet can only provide context or recommendations and must not directly construct authoritative allow.
- If Policy Engine conflicts with upstream recommendations, Policy Engine always prevails.

## 13. Phase Boundaries

Phase 1a / 1b explicitly does:

- Single-process unified entry point
- Role-based static permissions
- Sandbox / path / network rules
- Budget guards
- Approval escalation
- Kill switch / freeze checks

Currently does NOT do:

- OPA integration
- External policy providers
- Multi-tenant distributed policy execution clusters

Supplementary notes:

- Currently not committing to OPA as a done deal, but the shapes of `PolicyDecisionRequest / Result / Explain / AuditRecord` should remain as compatible as possible with external policy engines.
- If OPA or equivalent policy engine is introduced later, should prioritize reuse this contract's input, explanation, and audit boundaries rather than creating another parallel model.

## 14. Closure Conclusion

The significance of Policy Engine is not to create another layer of abstraction, but to consolidate judgments that were previously scattered across permissions, budget, approval, and security into a unified, auditable, reusable decision chain.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-17: This document originally compressed execution modes into three values: `supervised / auto / full-auto`. The root cause was that early policy contracts only covered "whether to execute automatically" and did not treat degraded protection modes as first-class governance objects. Fix: The main text now converges `mode` to eight canonical modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`, with the old three values demoted to legacy inputs.
- T-19: The original `PolicyDecisionRequest` fields correctly use `harness_run_id / node_run_id / attempt_id` as authoritative association keys and do not use the deprecated `execution_id`. R2-19 is an audit misjudgment; Section 3.1 of this document has been aligned with v4.3 specifications from the beginning and does not require modification.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.