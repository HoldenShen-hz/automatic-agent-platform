# Approval And HITL Contract

> **v4.3 Compatibility Note**: This file is retained for historical approval and HITL documentation. v4.3 decisions and human responsibilities are governed by [decision-hitl-contract.md](./decision-hitl-contract.md); the old approval status cannot alone serve as a substitute for `HarnessDecision` or `HumanResponsibilityRecord`.

## 1. Scope

This contract defines human decision escalation, approval requests, approval result callbacks, and behavioral differences under different operation modes.

## 2. Key Objects

- `ApprovalRequest`
- `ApprovalDecision`
- `HitlEscalation`
- `ApprovalContext`
- `ApprovalTimeoutPolicy`
- `ApprovalFeedbackLink`

## 3. ApprovalRequest Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `harness_run_id` | `string` | Associated `HarnessRun` |
| `node_run_id` | `string?` | Associated `NodeRun`; required for node-level approvals |
| `source_agent_id` | `string` | Initiating Agent |
| `reason` | `string` | Escalation reason |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `stage_view_ref` | `OapeflirStage?` | Interpretation/timeline view reference only; must not be used as truth primary key or state progression basis |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated evidence or release object |
| `options` | `string[]` | Optional decisions |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | Governance action automatically executed by the system after timeout |
| `escalation_chain` | `ApprovalEscalationHop[]` | Explicit multi-level escalation chain with timeout/reviewer for each level |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request, but can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
- `timeout_auto_action` is control plane execution semantics and must not be inferred by the UI rendering layer or downstream Agents.
- Agent output must not override already-frozen timeout policies.
- `critical` risk by default must not use `approve` as the timeout policy unless there are explicit break-glass rules and additional audit.
- The authoritative association key for approvals is `harness_run_id` / `node_run_id`; `stage_view_ref` can only be used for interpretation views and must not serve as truth source.

`ApprovalEscalationHop` minimum fields:

- `level`
- `reviewer_type`
- `reviewer_ref`
- `timeout_ms`
- `on_timeout`

## 4. ApprovalDecision Minimum Fields

- `approval_id`
- `decision_type` (`option_selected | confirmed | text_input | rejected | expired`)
- `selected_option_id?`
- `confirmed?`
- `input_text?`
- `responded_by`
- `responded_at`

Discriminant constraints:

- When `option_selected`, `selected_option_id` must be provided, and `confirmed` must not be provided simultaneously.
- When `confirmed`, `confirmed=true` must be provided, and `selected_option_id` must not be provided simultaneously.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry any of the three preceding interaction fields.
- Decisions for the same `approval_id` can only be successfully applied once; duplicate submissions must be treated as idempotent no-ops or conflicts, not as further business state progression.

## 5. Trigger Scenarios

At minimum includes:

- Cost exceeding or approaching threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeding maximum retry attempts.
- Organization changes.
- High-risk workflow recommendations.
- PlanHub producing high-risk plans or irreversible execution paths.
- FeedbackHub receiving sustained negative signals, user corrections, or quality anomalies requiring human confirmation handling.
- ImproveHub attempting to accept policy upgrades, prompt/policy changes, or candidate improvements.
- ReleaseHub attempting to advance rollout level, complete release, or trigger rollback.

## 6. Operation Mode Differences

- `supervised`: High-risk behaviors require approval by default.
- `auto`: Medium and low risks can pass automatically; high risks still require approval.
- `full-auto`: Only allows stronger automation outside hard prohibitions, but still records escalations and default policies.

Supplementary rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, and dual-approval requirements.
- Operation mode only affects "whether automatic pass-through is allowed," not "whether hard prohibitions are rejected."

Supplementary recommendations:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class-level structured configuration, rather than just keeping a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, later introducing restricted guardian / reviewer subagent, but that reviewer can only give approval suggestions or handle代办, and must not bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait—no ambiguity.
- Decision payloads for the same `approval_id` must satisfy discriminant constraints and must not have conflicting fields coexisting.
- After approval results are persisted, the Policy Engine must re-review before final action execution, preventing continued use of old approvals after environment changes.
- `critical` risk actions should support dual approval or break-glass processes and must not rely solely on single ordinary confirmation.
- Approvals with `stage_view_ref` must be writable back to the corresponding OAPEFLIR timeline and must not exist only in approval tables or message channels.
- Approval results related to Improve / Release can only change the candidate or rollout's controlled state and must not directly modify published policy content.
- User text input-type approvals expressing corrections, preferences, or negative feedback should be converted to `FeedbackSignal` for FeedbackHub / LearnHub consumption.

## 8. Supplementary Rules

### 8.1 Approval Package Schema

`ApprovalPacket` must contain at minimum:

- `approval_id`
- `harness_run_id`
- `node_run_id?`
- `title`
- `reason`
- `risk_level`
- `options`
- `recommended_option_id?`
- `deadline_at?`
- `timeout_policy`

### 8.2 Channel Interaction Buttons

- Button model is unified as `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to numbered options or text input with equivalent semantics.
- Channel adapter layer must not change approval semantics, only change presentation.

### 8.3 Organizational Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator are only responsible for proposing contexts requiring approval and do not directly approve their own high-risk actions.
- CEO/VP and other product narrative names do not affect the final approval authority's engineering boundary.
- High-risk action approval authority must be decoupled from the initiating execution subject to prevent the pseudo-approval chain of "applying for and approving one's own action."

### 8.4 Cascading Rejection Semantics

When an approval request is rejected or expires, the system must handle all downstream states depending on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval is `rejected` | Associated execution enters `blocked` or `failed` (depending on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval `expired` | Execute according to `timeout_policy`: `reject` takes the rejection chain, `approve` takes the pass-through chain, `remain_pending` keeps waiting |
| Multiple pending approvals for the same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded` and must not remain dangling |
| Parent task approval rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, with reason code `parent_approval_rejected` |
| Resubmit after approval rejection | Must create a new `approval_id` and must not reuse approval records that have reached terminal state; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascading rejection must be completed in the same transaction or recoverable event chain and must not rely on async polling to discover dangling approvals.
- Cascading `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes generated by cascading rejection must be written to the audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be an explicit field and not implicit UI-layer behavior.
- `user` reviewer is still the default baseline.
- If introducing guardian / review-subagent, it can only work under controlled prompts, controlled tools, and controlled permission boundaries.
- Guardian reviewer's conclusions must again enter Policy Engine review and must not directly become authoritative allow.

### 8.6 OAPEFLIR Stage Approval Linkage

`ApprovalFeedbackLink` is used to bind human decisions to OAPEFLIR closed-loop evidence, with minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `harness_run_id` | `string` | Associated `HarnessRun` |
| `node_run_id` | `string?` | Associated `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR view stage reference, must not be used as truth primary key |
| `loop_iteration` | `integer?` | Triggering round |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal generated or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, it can only allow the plan to enter execute; runtime precheck and Policy Engine review are still required.
- FeedbackHub approval is not an override of user sentiment but a human governance signal for subsequent learn/improve adoption.
- ImproveHub's `approve_candidate` can only advance candidate state and cannot skip guardrails or directly release.
- ReleaseHub's `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline and be converted to explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-9: Missing escalation_chain and timeout_auto_action fields required by architecture §31. Root cause: Old approval contract compressed "timeout policy" into single-value UI semantics and did not model the control plane's automatic actions and multi-level escalation chain. Fix: `ApprovalRequest` has added `timeout_auto_action` and `escalation_chain`, and defined `ApprovalEscalationHop` minimum fields.
- T-54: Still using OapeflirStage as a first-class stage_ref field; architecture §5.5 invariant "oapeflir.* events must not be used as truth source". Root cause: Historical approval flows used OAPEFLIR stages as both interpretation view and authoritative association key, confusing projection and runtime truth. Fix: The body now uses `harness_run_id` / `node_run_id` as authoritative association keys, with `stage_view_ref` only retaining view semantics.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
