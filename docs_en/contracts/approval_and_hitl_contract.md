# Approval And HITL Contract

> **v4.3 Compatibility Note**: This file is preserved as historical approval and HITL documentation. v4.3 decisions and human responsibility are based on [v4_3_decision_and_hitl_contract.md](./v4_3_decision_and_hitl_contract.md); old approval status cannot alone serve as a substitute for `HarnessDecision` or `HumanResponsibilityRecord`.

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
| `task_id` | `string` | Associated task |
| `source_agent_id` | `string` | Initiating Agent |
| `reason` | `string` | Escalation reason |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `stage_ref` | `OapeflirStage?` | OAPEFLIR phase that triggered approval |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated evidence or release object |
| `options` | `string[]` | Optional decisions |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request, but can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
- Agent output must not override already-frozen timeout policies.
- `critical` risk must not use `approve` as timeout policy by default, unless there is explicit break-glass rule and additional audit.

## 4. ApprovalDecision Minimum Fields

- `approval_id`
- `decision_type` (`option_selected | confirmed | text_input | rejected | expired`)
- `selected_option_id?`
- `confirmed?`
- `input_text?`
- `responded_by`
- `responded_at`

Discrimination constraints:

- When `option_selected`, `selected_option_id` must be provided, and `confirmed` must not be provided simultaneously.
- When `confirmed`, `confirmed=true` must be provided, and `selected_option_id` must not be provided simultaneously.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry the aforementioned three types of interaction fields.
- Decisions for the same `approval_id` can only be successfully applied once; duplicate submissions must be treated as idempotent no-op or conflict, not advancing business state again.

## 5. Trigger Scenarios

At least includes:

- Cost exceeds threshold or approaches threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeds maximum attempt count.
- Organization changes.
- High-risk workflow recommendations.
- PlanHub produces high-risk plans or irreversible execution paths.
- FeedbackHub receives continuous negative signals, user corrections, or quality anomalies, requiring human confirmation for handling.
- ImproveHub attempts to accept policy upgrades, prompt/policy changes, or candidate improvements.
- ReleaseHub attempts to advance rollout level, complete release, or trigger rollback.

## 6. Execution Mode Differences

- `supervised`: High-risk behaviors require approval by default.
- `auto`: Medium and low risks can be auto-released, high risks still require approval.
- `full-auto`: Allows stronger automation only outside hard prohibition items, but still records escalation and default strategies.

Supplementary rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, and dual approval requirements.
- Execution mode only affects "whether auto-release is allowed", not "whether hard prohibition items are rejected".

Supplementary suggestions:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class level structured configuration, rather than only keeping a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, subsequently introducing restricted guardian / reviewer subagent, but that reviewer can only give approval suggestions or handle代办, not bypass final policy review.

## 7. Behavior Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait—cannot be vague.
- Decision payload for the same `approval_id` must satisfy discrimination constraints, not having mutually conflicting fields coexist.
- After approval result is persisted, before final action execution, it must pass through Policy Engine review again to prevent continuing to use old approval after environment changes.
- `critical` risk actions should support dual approval or break-glass flow, not just relying on single ordinary confirmation.
- Approvals with `stage_ref` must be writable back to the corresponding OAPEFLIR timeline, not just existing in approval tables or message channels.
- Approval results related to Improve / Release can only change the controlled state of candidates or rollout, not directly overwrite published policy content.
- If user text input type approval expresses corrections, preferences, or negative feedback, it should be converted to `FeedbackSignal` for FeedbackHub / LearnHub consumption.

## 8. Supplementary Rules

### 8.1 Approval Packet Schema

`ApprovalPacket` must contain at least:

- `approval_id`
- `task_id`
- `execution_id?`
- `title`
- `reason`
- `risk_level`
- `options`
- `recommended_option_id?`
- `deadline_at?`
- `timeout_policy`

### 8.2 Channel Interaction Buttons

- Button model uniformly is `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to equivalently semantic numbered options or text input.
- Channel adaptation layer must not change approval semantics, only change presentation.

### 8.3 Organization Responsibility Boundary

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator only responsible for proposing context that requires approval, not directly approving their own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundary of final approval authority.
- High-risk action approval authority must be decoupled from the initiating execution subject, preventing "self-application, self-approval" pseudo-approval chains.

### 8.4 Cascade Rejection Semantics

When an approval request is rejected or expired, the system must handle all downstream states that depend on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval is `rejected` | Associated execution enters `blocked` or `failed` (depends on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval `expired` | Execute according to `timeout_policy`: `reject` goes to rejection chain, `approve` goes to release chain, `remain_pending` keeps waiting |
| Multiple pending approvals exist for the same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded`, not left hanging |
| Parent task approval is rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, with reason code `parent_approval_rejected` |
| Re-submit after approval rejection | Must create new `approval_id`, must not reuse approval records that have reached terminal state; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascade rejection must be completed in the same transaction or recoverable event chain, not relying on async polling to discover hanging approvals.
- Cascaded `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes generated by cascade rejection must be written to audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be explicit fields, not UI layer implicit behavior.
- `user` reviewer is still the default baseline.
- If introducing guardian / review-subagent, can only work under controlled prompts, controlled tools, and controlled permission boundaries.
- Guardian reviewer conclusions must pass through Policy Engine review again, not directly fall as authoritative allow.

### 8.6 OAPEFLIR Stage Approval Linkage

`ApprovalFeedbackLink` is used to bind human decisions with OAPEFLIR closed-loop evidence, minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `task_id` | `string` | Associated task |
| `stage_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Trigger phase |
| `loop_iteration` | `integer?` | Trigger iteration |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal produced or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, can only allow plan to enter execute; still requires runtime precheck and Policy Engine review.
- FeedbackHub approval is not an override of user sentiment, but a human governance signal for subsequent learn/improve adoption.
- ImproveHub `approve_candidate` can only advance candidate state, cannot skip guardrail or directly publish.
- ReleaseHub `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline, and convert to explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.
