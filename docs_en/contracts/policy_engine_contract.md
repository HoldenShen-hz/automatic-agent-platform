# Policy Engine Contract

## 1. Scope

This contract defines the unified Policy Engine entry point, used to aggregate role static permissions, execution policies, approval escalation, budget guards, sensitive operation classification, and kill switch.

Related documents:

- `approval_and_hitl_contract.md`
- `sandbox_and_auth_contract.md`
- `cost_and_budget_contract.md`
- `governance_control_plane_contract.md`
- `tool_skill_plugin_contract.md`

## 2. Goals

The unified Policy Engine must solve at minimum:

- Different modules no longer make permission judgments independently.
- High-risk actions enter the same decision chain.
- Conclusions from approval, budget, permissions, and kill switch are composable and auditable.

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
| `mode` | `full_auto \| supervised_auto \| read_only \| no-write \| no-external-call \| no-rollout \| manual_only \| incident-mode` | Current runtime mode |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Current OAPEFLIR stage view reference; must not be used as truth decision primary key |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `metadata_json` | `json?` | Additional context |

Rules:

- `harness_run_id / node_run_id / attempt_id` are authoritative association keys.
- `mode` must use the 8 canonical modes defined in architecture; `supervised / auto / full-auto` are only allowed as legacy input and normalized at entry.
- Degraded mode must be explicitly understood by policy, not privately inferred by caller using boolean combinations.
- `stage_view_ref` only provides explanatory context; runtime mode decision still uses `OperationalDirective`, risk classification, budget, and policy rules as authority.

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
- Approval escalation must not override hard denial items; actions hard-denied must not be allowed through approval.
- After kill switch / freeze is hit, approval must also not re-allow already-frozen actions.
- Constraints of `allow_with_constraints` must be authoritative, and subsequent execution must not unilaterally relax them.
- `manual_only` and `incident-mode` are not UI labels but strong constraint runtime modes; when hit, execution layer must not demote them to ordinary warning.

## 5. Sensitive Operation Classification Table

| Classification | Examples | Default Action |
| --- | --- | --- |
| `destructive` | Delete files, overwrite critical config | Approval or denial |
| `irreversible` | External commit, release, send non-revocable message | Approval |
| `prod_affecting` | Commands affecting production environment | Approval or denial |
| `cost_sensitive` | High-cost long-reasoning with large models | Budget check + possible approval |
| `org_changing` | Modify organization, role, tenant config | Approval |
| `sensitive_data` | Access keys, credentials, privacy data | Path/permission constraints + approval |
| `strategy_affecting` | Accept improvement candidate, change strategy version | Guardrail + approval |
| `governance_sensitive` | Rollout advancement, knowledge trust modification, memory promotion | Gate + approval or denial |

## 6. Boundary with Approval

- Policy Engine decides "whether approval is needed".
- Approval system is responsible for "how approval request is sent and how result is passed back".
- After approval passes, must still enter Policy Engine again for final release, to prevent environment changes after approval.

## 7. Boundary with Tools, Skills, Plugins

- Skills must not bypass role tool allowlist.
- Plugin / MCP installation units must first pass Policy Engine and cannot directly bypass ToolRegistry.
- MCP must not disguise as locally trusted tool to get wider permissions.
- Same action under different `resource_ref`, `path_scope`, `tenant scope` must be evaluated independently and must not incorrectly reuse old approval conclusion.
- Same request under different `mode` must be re-evaluated and must not reuse `full_auto` old allow for `read_only`, `no-rollout`, or `incident-mode`.

## 7B. Boundary with OAPEFLIR Hub

- Observe / Assess / Plan stages produce suggestions and context, not authoritative release conclusions.
- FeedbackHub can provide negative signals, user corrections, and quality metrics, but must not directly mark candidate improvement as accepted.
- LearnHub can only generate draft / validated learning objects and must not directly modify release or rollout state.
- ImproveHub proposals must go through Policy Engine ruling `promote_improvement` before entering guardrail / approval chain.
- When ReleaseHub advances `advance_rollout`, Policy Engine must re-evaluate current risk, budget, runtime mode, and freeze status.
- `modify_knowledge_trust` and `promote_memory_layer` belong to M2 extension actions; when related planes are not enabled, must fail-closed, not silently allow.

## 7A. Boundary with Dispatch and Isolation

Execution dispatch involves the following policy evaluation points and must go through Policy Engine:

| Evaluation Point | action | Description |
| --- | --- | --- |
| Dispatch target selection | `dispatch_execution` | Determines which worker or worker group (local / named / capability-match) the execution is dispatched to, with resource_ref as target worker or capability description |
| Isolation level elevation | `set_isolation_level` | When execution requires `containerized` or higher isolation level, policy checks whether that isolation level and associated resource consumption are allowed |
| Remote worker capability authorization | `dispatch_execution` | Whether capabilities declared by remote worker are within `allowedCapabilities` allowlist, needs policy confirmation |

Rules:

- Dispatch decision must go through Policy Engine before ticket creation, must not be independently determined by dispatch service internally.
- Isolation level elevation may involve additional resource cost (container startup, image pull) and should be linked with `cost_sensitive` risk classification.
- Remote worker's capability filtering results (rejected capability list) should be written to `PolicyAuditRecord`.
- `allow_with_constraints` can be used to tighten dispatch target scope (e.g., limit to specific worker group) or lower isolation level.

## 8. Caching and Inheritance Rejection

- Consecutive similar high-risk requests in the same session can inherit recent rejection conclusions to avoid approval bombing.
- Cache key must not only use command name, should include action, resource, subject, and risk classification.
- When inheritance rejection is hit, audit record must still be preserved.
- Cache hit must not be reused across `tenant / workspace / organization / mode`.

## 9. Rule Lint and Unreachable Rule Detection

Policy / permission rules before enablement should do at minimum:

- Duplicate rule detection
- Shadow rule detection
- Unreachable allow rule detection
- Source conflict detection

Must identify at minimum the following issues:

- Tool-wide `deny` makes more specific `allow` forever unreachable
- Tool-wide `ask` makes more specific `allow` never directly hit
- Shared source rules and local temporary rules obscure each other, resulting in final effect inconsistent with author expectation

Rules:

- Strategy package failing lint must not enter authoritative allow path.
- If allowed to continue with warning, warning must be written to explain and audit result.
- Runtime judgment result should as much as possible return which rule source was hit and fix hint, not just give abstract `deny`.

## 10. Rule Evaluation Order

- Policy / permission rule matching order must be deterministic and explainable.
- If system supports wildcard, partial override, local temporary rules, and global rules coexisting, must clarify:
  - By explicit `priority`
  - Or by source order / last-match
  - Or other equivalent stable strategy
- Same request must not get different conclusions due to traversal order, concurrent loading order, or source aggregation order.
- Explain and audit results should be able to point out "which rule finally won and who it overrode".

## 11. Audit Requirements

Each policy decision must retain at minimum:

- Who requested what
- Which policy nodes were triggered
- Why final release, denial, or escalation
- What the tightened constraints are
- Which policy version / config version was used
- Which input / decision snapshot the audit snapshot references

## 12. Key Decision Boundaries

- Policy Engine is the final decision entry, not a suggestion collector.
- LLM, workflow planner, approval packet can only provide context or suggestions and must not construct authoritative allow.
- If Policy Engine conflicts with upstream suggestions, Policy Engine always prevails.

## 13. Phase Boundaries

Phase 1a / 1b explicitly does:

- Single-process unified entry
- Role static permissions
- Sandbox / path / network rules
- Budget guard
- Approval escalation
- Kill switch / freeze check

Currently does not do:

- OPA integration
- External policy provider
- Multi-tenant distributed policy execution cluster

Supplementary notes:

- OPA is not currently written as fait accompli, but the shape of `PolicyDecisionRequest / Result / Explain / AuditRecord` should be kept compatible with external policy engine.
- If OPA or equivalent policy engine is introduced later, should priority reuse input, explanation, and audit boundaries of this contract, rather than creating another parallel model.

## 14. Closure Conclusion

The meaning of Policy Engine is not to create another layer of abstraction, but to consolidate the scattered judgments in permissions, budget, approval, and security into a unified, auditable, reusable decision chain.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-17: This document originally compressed runtime mode to `supervised / auto / full-auto` three values. Root cause: early policy contract only covered "whether to execute automatically", and did not treat architecture's degraded protection mode as a first-class governance object. Fix: The body now converges `mode` to 8 canonical modes: `full_auto / supervised_auto / read_only / no-write / no-external-call / no-rollout / manual_only / incident-mode`, and demotes old three values to legacy input.
- T-19: Original `PolicyDecisionRequest` field correctly uses `harness_run_id / node_run_id / attempt_id` as authoritative association keys and does not use deprecated `execution_id`. R2-19 is audit misjudgment; this document §3.1 was aligned with v4.3 specification from the beginning and does not need modification.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.