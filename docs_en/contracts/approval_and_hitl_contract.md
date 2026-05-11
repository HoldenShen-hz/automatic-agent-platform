# Approval And HITL Contract

> **v4.3 Compatibility Note**: This file is retained as historical approval and HITL documentation. For v4.3 decisions and human responsibility, refer to [decision-hitl-contract.md](./decision-hitl-contract.md); the old approval status alone cannot serve as a substitute for `HarnessDecision` or `HumanResponsibilityRecord`.

## 1. Scope

This contract defines human decision escalation, approval requests, approval result callbacks, and behavioral differences across execution modes.

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
| `node_run_id` | `string?` | Associated `NodeRun`; required for node-level approval |
| `source_agent_id` | `string` | Initiating Agent |
| `reason` | `string` | Escalation reason |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `stage_view_ref` | `OapeflirStage?` | Interpretation/timeline view reference only; must not be used as truth primary key or state progression basis |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated evidence or release object |
| `options` | `string[]` | Available decision options |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | Governance action automatically executed by system on timeout |
| `escalation_chain` | `ApprovalEscalationHop[]` | Explicit tiered escalation chain with time limits and responsible party per level |
| `created_at` | `timestamp` | Initiation timestamp |

Rules:

- `timeout_policy` is part of the governance request, but the final implementation can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
- `timeout_auto_action` is control plane execution semantics and must not be inferred by UI rendering layers or downstream Agents.
- Agent output must not override frozen timeout policies.
- `critical` risk actions default to `reject` timeout policy and must not use `approve` unless there is an explicit break-glass rule with additional audit.
- The authoritative association key for approval is `harness_run_id` / `node_run_id`; `stage_view_ref` is for interpretation views only and must not serve as truth source.

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

- `option_selected` must provide `selected_option_id` and must not carry `confirmed` simultaneously.
- `confirmed` must provide `confirmed=true` and must not carry `selected_option_id` simultaneously.
- `text_input` must provide `input_text`.
- `rejected` and `expired` must not carry any of the three interaction fields above.
- A decision for the same `approval_id` can only be successfully applied once; duplicate submissions must be treated as idempotent no-op or conflict, not as re-advancing business state.

## 5. Trigger Scenarios

At minimum includes:

- Cost exceeds or approaches threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeds maximum retry attempts.
- Organizational changes.
- High-risk workflow recommendations.
- PlanHub produces high-risk plans or irreversible execution paths.
- FeedbackHub receives sustained negative signals, user corrections, or quality anomalies requiring human confirmation.
- ImproveHub attempts to accept strategy upgrades, prompt/policy changes, or candidate improvements.
- ReleaseHub attempts to advance rollout level, complete release, or trigger rollback.

## 6. Execution Mode Differences

- `supervised`: High-risk actions require approval by default.
- `auto`: Medium and low-risk can be auto-approved; high-risk still requires approval.
- `full-auto`: Stronger automation allowed only outside hard prohibition items, but still records escalations and default policies.

Supplementary rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, or dual-approval requirements.
- Execution mode only affects "whether auto-approval is allowed", not "whether hard prohibition items are rejected".

Supplementary recommendations:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class structured configuration, rather than just a single boolean switch.
- Reviewer routing should be explicitly modeled, for example default `user`, with future possibility of introducing constrained guardian / reviewer subagent, but that reviewer can only provide approval recommendations or delegated handling, not bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait—no ambiguity allowed.
- Decision payload for the same `approval_id` must satisfy discriminant constraints and must not contain mutually conflicting fields.
- After approval result is persisted, final action execution must pass through Policy Engine review again to prevent stale approval from being used after environment changes.
- `critical` risk actions should support dual approval or break-glass process and must not rely on single ordinary confirmation.
- Approvals with `stage_view_ref` must be writable back to the corresponding OAPEFLIR timeline, not exist only in approval tables or message channels.
- Approval results related to Improve / Release can only change the controlled state of candidates or rollouts, and must not directly modify published strategy content.
- User text input approvals that express corrections, preferences, or negative feedback should be converted to `FeedbackSignal` for consumption by FeedbackHub / LearnHub.

## 8. Supplementary Rules

### 8.1 Approval Packet Schema

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

- Button model unified as `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to equivalently semantic numbered options or text input.
- Channel adapter layer must not alter approval semantics, only change presentation.

### 8.3 Organizational Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator are only responsible for providing context requiring approval, and must not directly approve their own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundaries of final approval authority.
- Approval authority for high-risk actions must be decoupled from the initiating execution subject to prevent "self-application, self-approval" pseudo-approval chains.

### 8.4 Cascading Rejection Semantics

When an approval request is rejected or expired, the system must handle all downstream states depending on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval rejected | Associated execution enters `blocked` or `failed` (depending on retryability), task enters `awaiting_decision` or `failed` |
| Single task single approval expired | Execute according to `timeout_policy`: `reject` goes rejection chain, `approve` goes approval chain, `remain_pending` stays pending |
| Multiple pending approvals for same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded`, not left in dangling state |
| Parent task approval rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, with reason code `parent_approval_rejected` |
| Re-submit after rejection | Must create new `approval_id`; must not reuse approval record that has reached terminal state; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascading rejection must be completed in the same transaction or recoverable event chain, and must not rely on async polling to discover dangling approvals.
- Cascading `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes resulting from cascading rejection must be written to the audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be an explicit field, not UI-layer implicit behavior.
- `user` reviewer is still the default baseline.
- If guardian / review-subagent is introduced, it can only work under controlled prompt, controlled tools, and controlled permission boundaries.
- Guardian reviewer conclusions must again pass through Policy Engine review and must not be directly recorded as authoritative allow.

### 8.6 OAPEFLIR Stage Approval Integration

`ApprovalFeedbackLink` is used to bind human decisions with OAPEFLIR closed-loop evidence. Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `harness_run_id` | `string` | Associated `HarnessRun` |
| `node_run_id` | `string?` | Associated `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR view stage reference; must not be used as truth primary key |
| `loop_iteration` | `integer?` | Triggering iteration |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal produced or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, plan can only proceed to execute; still requires runtime precheck and Policy Engine review.
- FeedbackHub approval is not an override of user sentiment, but a human governance signal for whether subsequent learn/improve should adopt.
- ImproveHub `approve_candidate` can only advance candidate state, and must not skip guardrails or directly publish.
- ReleaseHub `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline, and be converted to explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-9: Missing escalation_chain and timeout_auto_action fields required by architecture §31. Root cause: Old approval contract compressed "timeout policy" into single-value UI semantics without modeling control plane automatic actions and tiered escalation chain. Fix: `ApprovalRequest` has been supplemented with `timeout_auto_action` and `escalation_chain`, and `ApprovalEscalationHop` minimum fields defined.
- T-54: Still using OapeflirStage as a first-class stage_ref field; architecture §5.5 invariant "oapeflir.* events must not be used as truth source". Root cause: Historical approval flows used OAPEFLIR stage as both interpretation view and authoritative association key, confusing projection with runtime truth. Fix: Body has been changed to use `harness_run_id` / `node_run_id` as authoritative association key, with `stage_view_ref` retaining only view semantics.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.