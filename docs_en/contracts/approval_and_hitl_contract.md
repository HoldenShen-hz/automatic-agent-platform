# Approval And HITL Contract

> **v4.3 Compatibility Note**: This file is preserved as historical approval and HITL documentation. v4.3 decisions and human responsibility are based on [decision-hitl-contract.md](./decision-hitl-contract.md); old approval status cannot be used as a substitute for `HarnessDecision` or `HumanResponsibilityRecord`.

## 1. Scope

This contract defines human decision escalation, approval requests, approval result callbacks, and behavioral differences under runtime modes.

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
| `stage_view_ref` | `OapeflirStage?` | Only for explanation/timeline view reference; must not be used as truth primary key or state progression basis |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated evidence or release object |
| `options` | `string[]` | Optional decisions |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | Governance action automatically executed by system after timeout |
| `escalation_chain` | `ApprovalEscalationHop[]` | Explicit graded escalation chain with timeout/reviewer at each level |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request, but can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
- `timeout_auto_action` is control plane execution semantics and must not be inferred by UI rendering layer or downstream Agents.
- Agent output must not override already-frozen timeout policies.
- `critical` risk defaults must not use `approve` as timeout policy unless there is an explicit break-glass rule with additional audit.
- The authoritative association keys for approval are `harness_run_id` / `node_run_id`; `stage_view_ref` can only be used for explanation view, not as truth source.

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

Discrimination constraints:

- When `option_selected`, `selected_option_id` must be provided, and `confirmed` must not be present.
- When `confirmed`, `confirmed=true` must be provided, and `selected_option_id` must not be present.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry any of the three interaction fields above.
- A decision for the same `approval_id` can only be successfully applied once; repeated submission must be treated as idempotent no-op or conflict, not as further business state progression.

## 5. Trigger Scenarios

At minimum includes:

- Cost exceeds threshold or approaches threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeds maximum retry attempts.
- Organization changes.
- High-risk workflow suggestions.
- PlanHub produces high-risk plan or irreversible execution path.
- FeedbackHub receives continuous negative signals, user corrections, or quality anomalies requiring human confirmation handling.
- ImproveHub attempts to accept policy upgrades, prompt/policy changes, or candidate improvements.
- ReleaseHub attempts to advance rollout level, complete release, or trigger rollback.

## 6. Runtime Mode Differences

- `supervised`: High-risk behavior defaults to requiring approval.
- `auto`: Medium/low risk can be auto-approved, high risk still requires approval.
- `full-auto`: Allows stronger automation only outside hard denial items, but still records escalation and default policy.

Supplementary rules:

- `full-auto` cannot bypass hard denial policies, break-glass policies, or dual-approval requirements.
- Runtime mode only affects "whether auto-approval is allowed", not "whether hard denial items are denied".

Supplementary recommendations:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class level structured configuration, not just a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, later can introduce restricted guardian / reviewer subagent, but that reviewer can only provide approval suggestions or handle on behalf, cannot bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait - no ambiguity.
- Decision payload for the same `approval_id` must satisfy discrimination constraints, cannot have conflicting fields coexisting.
- After approval result is persisted, before final action execution, it must again go through Policy Engine review to prevent following old approval if environment has changed.
- `critical` risk actions should support dual approval or break-glass process, not just single normal confirmation.
- Approval with `stage_view_ref` must be writable to the corresponding OAPEFLIR timeline, cannot only exist in approval table or message channel.
- Approval results related to Improve / Release can only change the controlled state of candidate or rollout, cannot directly overwrite published policy content.
- User text input type approval if expressing correction, preference, or negative feedback should be converted to `FeedbackSignal` for FeedbackHub / LearnHub consumption.

## 8. Supplementary Rules

### 8.1 Approval Packet Schema

`ApprovalPacket` must include at minimum:

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
- Channel adapter layer must not change approval semantics, only change presentation.

### 8.3 Organization Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator are only responsible for proposing contexts that need approval, not directly approving their own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundary of final approval authority.
- Approval authority for high-risk actions must be decoupled from the initiating execution subject to prevent "self-application, self-approval" pseudo-approval chains.

### 8.4 Cascading Rejection Semantics

When an approval request is rejected or expires, the system must handle all downstream states that depend on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval is `rejected` | Associated execution enters `blocked` or `failed` (depends on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval `expired` | Execute according to `timeout_policy`: `reject` goes rejection chain, `approve` goes approval chain, `remain_pending` stays pending |
| Multiple pending approvals exist for the same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded`, must not remain hanging |
| Parent task approval is rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, reason code `parent_approval_rejected` |
| Re-submit after approval rejection | Must create new `approval_id`, must not reuse already-terminal approval record; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascading rejection must be completed in the same transaction or recoverable event chain, must not rely on async polling to discover hanging approvals.
- Cascading `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes caused by cascading rejection must be written to audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be an explicit field, not implicit behavior at the UI layer.
- `user` reviewer is still the default baseline.
- If introducing guardian / review-subagent, can only work under controlled prompt, controlled tools, and controlled permission boundaries.
- Guardian reviewer's conclusion must again enter Policy Engine for review, must not directly become authoritative allow.

### 8.6 OAPEFLIR Stage Approval Linkage

`ApprovalFeedbackLink` is used to bind human decisions to OAPEFLIR closed-loop evidence, minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `harness_run_id` | `string` | Associated `HarnessRun` |
| `node_run_id` | `string?` | Associated `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR view stage reference, must not be used as truth primary key |
| `loop_iteration` | `integer?` | Triggered iteration |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal produced or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, can only allow plan to enter execute; still requires runtime precheck and Policy Engine review.
- FeedbackHub approval is not an override of user sentiment, but a human governance signal for subsequent learn/improve adoption.
- ImproveHub `approve_candidate` can only advance candidate status, cannot skip guardrail or directly publish.
- ReleaseHub `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline and be converted to explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-9: Missing escalation_chain and timeout_auto_action fields required by architecture §31. Root cause: old approval contract compressed "timeout policy" into single-value UI semantics, without modeling the control plane's automatic actions and graded escalation chain. Fix: `ApprovalRequest` has been supplemented with `timeout_auto_action` and `escalation_chain`, and `ApprovalEscalationHop` minimum fields have been defined.
- T-54: Still using OapeflirStage as a first-class stage_ref field, but architecture §5.5 invariant "oapeflir.* events must not be used as truth source". Root cause: historical approval flow treated OAPEFLIR stage as both explanation view and authoritative association key, confusing projection with runtime truth. Fix: The body now uses `harness_run_id` / `node_run_id` as authoritative association keys, with `stage_view_ref` retained only for view semantics.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.