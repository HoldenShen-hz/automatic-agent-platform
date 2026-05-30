# Policy Engine Contract

## 1. Scope

This contract defines the unified Policy Engine entry point, which aggregates role-based static permissions, execution policies, approval escalation, budget guards, sensitive operation classification, and kill switches.

Related documents:

- `approval_and_hitl_contract.md`
- `sandbox_and_auth_contract.md`
- `cost_and_budget_contract.md`
- `governance_control_plane_contract.md`
- `tool_skill_plugin_contract.md`

## 2. Objectives

The unified Policy Engine must at minimum address:

- No longer having separate permission checks scattered across different modules.
- High-risk actions entering a single decision chain.
- Conclusions from approval, budget, permissions, and kill switches being composable and auditable.

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
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current OAPEFLIR stage view reference; must not be used as the truth decision primary key |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `metadata_json` | `json?` | Additional context |

Rules:

- `harness_run_id / node_run_id / attempt_id` are the authoritative association keys.
- `mode` must use the 8 canonical modes defined in the architecture; `supervised / auto / full-auto` are only permitted as legacy inputs and must be normalized at the entry point.
- Degraded modes must be explicitly understood by policy, not privately inferred by the caller using boolean combinations.
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

- Any explicit `deny` at any step must fail-closed.
- `allow_with_constraints` must explicitly return tightened path, tool, budget, or timeout constraints.
- Approval escalation must not override hard denials; hard-denied actions cannot be re-allowed through approval.
- After kill switch / freeze is triggered, approval cannot re-enable a frozen action.
- Constraints from `allow_with_constraints` must be authoritative; subsequent execution must not unilaterally relax them.
- `manual_only` and `incident-mode` are not UI labels, but strong enforcement execution modes; once triggered, the execution layer must not demote them to ordinary warnings.

## 5. Sensitive Operation Classification Table

| Classification | Examples | Default Action |
| --- | --- | --- |
| `destructive` | Delete files, overwrite critical configs | Approve or deny |
| `irreversible` | External commits, releases, sending irrevocable messages | Approve |
| `prod_affecting` | Production-affecting commands | Approve or deny |
| `cost_sensitive` | High-cost long-reasoning LLM calls | Budget check + possible approval |
| `org_changing` | Modify organization, role, or tenant config | Approve |
| `sensitive_data` | Access keys, credentials, privacy data | Path/permission constraints + approval |
| `strategy_affecting` | Accept improvement candidate, change strategy version | Guardrail + approval |
| `governance_sensitive` | Rollout advancement, knowledge trust modification, memory promotion | Gate + approval or deny |

## 6. Boundary with Approval

- Policy Engine decides "whether approval is needed".
- Approval system handles "how approval requests are sent and how responses are returned".
- After approval passes, the request must re-enter Policy Engine for final release, to avoid environment changes after approval.

## 7. Boundary with Tools, Skills, and Plugins

- Skills must not bypass role tool whitelists.
- Plugin / MCP installation units must first pass Policy Engine and cannot directly bypass ToolRegistry.
- MCP must not disguise as locally trusted tools to gain broader permissions.
- The same action under different `resource_ref`, `path_scope`, or `tenant scope` must be evaluated independently; old allow conclusions must not be incorrectly reused.
- The same request under different `mode` must be re-evaluated; old `full_auto` allow must not be reused for `read_only`, `no-rollout`, or `incident-mode`.

## 7B. Boundary with OAPEFLIR Hub

- Observe / Assess / Plan stages produce recommendations and context, not authoritative allow conclusions.
- FeedbackHub can provide negative signals, user corrections, and quality metrics, but must not directly mark candidate improvements as accepted.
- LearnHub can only generate draft / validated learning objects and cannot directly modify release or rollout state.
- ImproveHub proposals must be裁决 `promote_improvement` by Policy Engine before entering guardrail / approval chain.
- When ReleaseHub advances `advance_rollout`, Policy Engine must re-evaluate current risk, budget, execution mode, and freeze state.
- `modify_knowledge_trust` and `promote_memory_layer` are M2 extended actions; when related planes are not enabled, must fail-closed, not silently allow.

## 7A. Boundary with Dispatch and Isolation

Execution dispatch involves the following policy evaluation points and must pass through Policy Engine:

| Evaluation Point | action | Description |
| --- | --- | --- |
| Dispatch target selection | `dispatch_execution` | Determines which worker or worker group (local / named / capability-match) the execution is dispatched to; resource_ref is the target worker or capability description |
| Isolation level elevation | `set_isolation_level` | When execution requires `containerized` or higher isolation level, policy checks whether that isolation level and associated resource consumption are allowed |
| Remote worker capability authorization | `dispatch_execution` | Whether capabilities declared by remote workers are within the `allowedCapabilities` whitelist, requiring policy confirmation |

Rules:

- Dispatch decisions must pass through Policy Engine before ticket creation; must not be independently determined within the dispatch service.
- Isolation level elevation may involve additional resource costs (container startup, image pull) and should be linked with `cost_sensitive` risk classification.
- Remote worker capability filtering results (rejected capability list) should be written to `PolicyAuditRecord`.
- `allow_with_constraints` can be used to tighten dispatch target scope (e.g., restrict to specific worker groups) or lower isolation level.

## 8. Caching and Inheritance Rejection

- Consecutive similar high-risk requests within the same session can inherit recent rejection conclusions to avoid approval bombardment.
- Cache keys must not be based only on command names; they must include action, resource, subject, and risk classification.
- When inheritance rejection is triggered, audit records must still be preserved.
- Cache hits must not be reused across `tenant / workspace / organization / mode`.

## 9. Rule Lint and Unreachable Rule Detection

Before policy / permission rules are enabled, at minimum:

- Duplicate rule detection
- Shadow rule detection
- Unreachable allow rule detection
- Source conflict detection

Must identify at minimum:

- Tool-wide `deny` making more specific `allow`永远 unreachable
- Tool-wide `ask` making more specific `allow` unable to directly hit
- After shared source rules and local temporary rules obscure each other, the final effect differs from author expectations

Rules:

- Policy bundles failing lint must not enter the authoritative allow path.
- If warnings are allowed to continue, warnings must be written to explain and audit results.
- Runtime decision results should return the hit rule sources and repair hints where possible, not just abstract `deny`.

## 10. Rule Evaluation Order

- Policy / permission rule matching order must be deterministic and explainable.
- If the system supports wildcard, partial override, local temporary rules, and global rules coexisting, must clarify:
  - By explicit `priority`
  - Or by source order / last-match
  - Or other equivalent stable strategy
- The same request must not get different conclusions due to different traversal order, concurrent loading order, or source aggregation order.
- Explain and audit results should be able to point out "which rule ultimately won, and what it overrode".

## 11. Audit Requirements

Each policy decision must preserve at minimum:

- Who requested what
- Which policy nodes were triggered
- Why ultimately allowed, denied, or escalated
- What the tightened constraints are
- Which policy version / config version was used
- Which input / decision snapshot the audit snapshot references

## 12. Key Decision Boundaries

- Policy Engine is the final decision entry point, not a recommendation collector.
- LLM, workflow planner, and approval packet can only provide context or recommendations and must not construct authoritative allow directly.
- If Policy Engine conflicts with upstream recommendations, Policy Engine always prevails.

## 13. Phase Boundaries

Phase 1a / 1b explicitly does:

- Single-process unified entry point
- Role-based static permissions
- Sandbox / path / network rules
- Budget guards
- Approval escalation
- Kill switch / freeze checks

Currently does not do:

- OPA integration
- External policy providers
- Multi-tenant distributed policy execution clusters

Supplementary notes:

- OPA is not currently baked in, but the shapes of `PolicyDecisionRequest / Result / Explain / AuditRecord` should remain compatible with external policy engines.
- If OPA or equivalent policy engine is introduced later, should priority reuse the input, explanation, and audit boundaries of this contract, rather than creating another parallel model.

## 14. Consolidation Conclusion

The meaning of Policy Engine is not to create another layer of abstraction, but to consolidate the scattered judgments in permissions, budget, approval, and security into a single unified, auditable, reusable decision chain.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-17: This document originally compressed execution modes into `supervised / auto / full-auto` three values; root cause was that early policy contracts only covered "whether to execute automatically", without treating degraded protection modes as first-class governance objects. Fix: The main text now converges `mode` to eight canonical modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`, and demotes the old three values to legacy input.
- T-19: Original `PolicyDecisionRequest` fields correctly use `harness_run_id / node_run_id / attempt_id` as authoritative association keys, not the deprecated `execution_id`. R2-19 is an audit misjudgment; this document's §3.1 has been aligned with v4.3 specification from the beginning and does not require modification.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.