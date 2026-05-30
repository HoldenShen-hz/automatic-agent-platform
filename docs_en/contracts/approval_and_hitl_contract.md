# Approval And HITL Contract

> **v4.3 Compatibility Note**: This file is preserved as historical approval and HITL documentation. v4.3 decisions and human responsibility are governed by [decision-hitl-contract.md](./decision-hitl-contract.md); old approval status alone cannot serve as a substitute for `HarnessDecision` or `HumanResponsibilityRecord`.

## 1. Scope

This contract defines human decision escalation, approval requests, approval result callbacks, and behavioral differences under execution modes.

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
| `options` | `string[]` | Available decisions |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | Governance action automatically executed by system after timeout |
| `escalation_chain` | `ApprovalEscalationHop[]` | Explicit step-by-step escalation chain with per-level time limit/responsible person |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request, but can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
- `timeout_auto_action` is control plane execution semantics; it must not be inferred by UI rendering layer or downstream Agents.
- Agent output must not override already-frozen timeout policy without authorization.
- `critical` risk defaults must not use `approve` as timeout policy unless there is explicit break-glass rule and additional audit.
- The authoritative association key for approval is `harness_run_id` / `node_run_id`; `stage_view_ref` can only be used for explanation view, not as truth source.

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

- When `option_selected`, `selected_option_id` must be provided; `confirmed` must not be present simultaneously.
- When `confirmed`, `confirmed=true` must be provided; `selected_option_id` must not be present simultaneously.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry any of the three interaction fields above.
- The same `approval_id`'s decision can only be successfully applied once; repeated submission must be treated as idempotent no-op or conflict, rather than advancing business state again.

## 5. Trigger Scenarios

At least includes:

- Cost exceeds threshold or approaches threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeds maximum retry attempts.
- Organization changes.
- High-risk workflow suggestions.
- PlanHub produces high-risk plan or irreversible execution path.
- FeedbackHub receives sustained negative signals, user corrections, or quality anomalies requiring human confirmation.
- ImproveHub attempts to accept strategy upgrade, prompt/policy change, or candidate improvement.
- ReleaseHub attempts to advance rollout level, complete release, or trigger rollback.

## 6. Execution Mode Differences

- `supervised`: High-risk behaviors require approval by default.
- `auto`: Medium and low risk can be automatically released; high risk still requires approval.
- `full-auto`: Only allows stronger automation outside hard prohibitions, but still records escalations and default policies.

Supplementary rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, and dual-approval requirements.
- Execution mode only affects "whether automatic release is allowed", not "whether hard prohibitions are rejected".

Supplementary suggestions:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class structured configuration, rather than only keeping a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, later introducing limited guardian / reviewer subagent, but that reviewer can only give approval suggestions or handle代办, and must not bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait; ambiguity is not allowed.
- The same `approval_id`'s decision payload must satisfy discrimination constraints; conflicting fields must not coexist.
- After approval result is persisted, Policy Engine must review again before final action execution to prevent environment changes from still using old approval.
- `critical` risk actions should support dual approval or break-glass process; single ordinary confirmation is not sufficient.
- Approval with `stage_view_ref` must be able to write back to corresponding OAPEFLIR timeline; it must not only exist in approval table or message channel.
- Approval results related to Improve / Release can only change the controlled state of candidate or rollout, and must not directly overwrite already-released strategy content.
- If user text input approval expresses correction, preference, or negative feedback, it should be converted to `FeedbackSignal` for FeedbackHub / LearnHub consumption.

## 8. Supplementary Rules

### 8.1 Approval Packet Schema

`ApprovalPacket` contains at least:

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

- Button model uniformly is `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to equivalent semantic numbered options or text input.
- Channel adaptation layer must not change approval semantics, only presentation.

### 8.3 Organizational Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator are only responsible for proposing contexts that need approval, and must not directly approve their own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundary of final approval authority.
- The approving authority for high-risk actions must be decoupled from the initiating execution subject to prevent "self-application, self-approval" pseudo-approval chains.

### 8.4 Cascading Rejection Semantics

When an approval request is rejected or expired, the system must handle all downstream states dependent on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval rejected | Associated execution enters `blocked` or `failed` (depends on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval expired | Execute according to `timeout_policy`: `reject` goes rejection chain, `approve` goes release chain, `remain_pending` keeps waiting |
| Multiple pending approvals exist for same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded`; they must not remain hanging |
| Parent task approval rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, reason code `parent_approval_rejected` |
| Re-submit after approval rejection | New `approval_id` must be created; previously terminal approval record must not be reused; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascading rejection must be completed in the same transaction or recoverable event chain, and must not rely on async polling to discover hanging approvals.
- Cascading `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes generated by cascading rejection must be written to audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be explicit fields, not UI-layer implicit behavior.
- `user` reviewer is still the default baseline.
- If guardian / review-subagent is introduced, it can only work under controlled prompt, controlled tools, and controlled permission boundaries.
- Guardian reviewer's conclusion must again enter Policy Engine for review, and must not directly become authoritative allow.

### 8.6 OAPEFLIR Stage Approval Linkage

`ApprovalFeedbackLink` is used to bind human decisions to OAPEFLIR closed-loop evidence:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `harness_run_id` | `string` | Associated `HarnessRun` |
| `node_run_id` | `string?` | Associated `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR view stage reference; must not be used as truth primary key |
| `loop_iteration` | `integer?` | Triggered iteration |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal produced or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, plan can only be allowed to enter execute; runtime precheck and Policy Engine review are still required.
- FeedbackHub approval is not an override of user sentiment, but a human governance signal for subsequent learn/improve adoption.
- ImproveHub's `approve_candidate` can only advance candidate state, and must not skip guardrail or directly publish.
- ReleaseHub's `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline, and be converted into explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-9: Missing escalation_chain and timeout_auto_action fields required by architecture §31. Root cause: Old approval contract compressed "timeout policy" into single-value UI semantics, and did not model the control plane's automatic actions and step-by-step escalation chain. Fix: `ApprovalRequest` has added `timeout_auto_action` and `escalation_chain`, and `ApprovalEscalationHop` minimum fields are defined.
- T-54: Still using OapeflirStage as a first-class stage_ref field, architecture §5.5 invariant "oapeflir.* events must not be used as truth source". Root cause: Historical approval flow used OAPEFLIR stage as both explanation view and authoritative association key, confusing projection with runtime truth. Fix: The main text has changed to using `harness_run_id` / `node_run_id` as authoritative association keys, with `stage_view_ref` only retaining view semantics.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.