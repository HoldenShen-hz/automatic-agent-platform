# Approval And HITL Contract

## 1. Scope

This contract defines human decision escalation, approval requests, approval result callback, and behavioral differences under different execution modes.

## 2. Key Objects

- `ApprovalRequest`
- `ApprovalDecision`
- `HitlEscalation`
- `ApprovalContext`
- `ApprovalTimeoutPolicy`

## 3. ApprovalRequest Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `task_id` | `string` | Associated task |
| `source_agent_id` | `string` | Initiating Agent |
| `reason` | `string` | Escalation reason |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `options` | `string[]` | Optional decisions |
| `context` | `json` | Relevant context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request, but ultimately can only be tightened by system code and cannot be arbitrarily relaxed by downstream Agents.
- Agent output must not override already-frozen timeout policies.
- `critical` risk defaults to not using `approve` as timeout policy unless there is explicit break-glass rule and additional audit.

## 4. ApprovalDecision Minimum Fields

- `approval_id`
- `decision_type` (`option_selected | confirmed | text_input | rejected | expired`)
- `selected_option_id?`
- `confirmed?`
- `input_text?`
- `responded_by`
- `responded_at`

Discrimination constraints:

- When `option_selected`, `selected_option_id` must be provided and `confirmed` must not be carried simultaneously.
- When `confirmed`, `confirmed=true` must be provided and `selected_option_id` must not be carried simultaneously.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry any of the three interaction fields above.
- The same `approval_id` decision can only be successfully applied once; duplicate submissions must be treated as idempotent no-op or conflict, not as advancing business state again.

## 5. Trigger Scenarios

At minimum includes:

- Cost exceeding threshold or approaching threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeding maximum retry attempts.
- Organization changes.
- High-risk workflow suggestions.

## 6. Execution Mode Differences

- `supervised`: High-risk behaviors require approval by default.
- `auto`: Medium and low risk can pass automatically, high risk still requires approval.
- `full-auto`: Only allows stronger automation outside hard prohibition items, but still records escalations and default policies.

Supplementary rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, and dual-approval requirements.
- Execution mode only affects "whether automatic passage is allowed," not "whether hard prohibition items are rejected."

Supplementary suggestions:

- Approval policy should support evolving from coarse-grained mode to fine-grained capability / risk class-level structured configuration, not just keeping a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, later introducing restricted guardian / reviewer subagent, but that reviewer can only give approval suggestions or handle代办, cannot bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default approve, or pause and wait - cannot be vague.
- The same `approval_id` decision payload must satisfy discrimination constraints and must not have mutually conflicting fields coexist.
- After approval result is persisted, before final action execution, it must again go through Policy Engine review to prevent old approvals from being followed after environment changes.
- `critical` risk actions should support dual approval or break-glass process and cannot rely on single ordinary confirmation.

## 8. Supplementary Rules

### 8.1 Approval Packet Schema

`ApprovalPacket` at minimum contains:

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

- Button model unified as `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to equivalent semantic numbered options or text input.
- Channel adapter layer must not change approval semantics, only change presentation method.

### 8.3 Organization Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- Division / planner / orchestrator only responsible for providing context that needs approval, does not directly approve its own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundary of final approval authority.
- Approval authority for high-risk actions must be decoupled from the initiating execution subject to prevent "self-application, self-approval" fake approval chain.

### 8.4 Cascade Rejection Semantics

When an approval request is rejected or expired, the system must handle all downstream states that depend on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval `rejected` | Associated execution enters `blocked` or `failed` (depends on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval `expired` | Execute according to `timeout_policy`: `reject` goes reject chain, `approve` goes pass chain, `remain_pending` stays pending |
| Multiple pending approvals for same execution | When any approval is rejected, other `requested` approvals for same execution must enter `superseded`, must not remain dangling |
| Parent task approval rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, reason code `parent_approval_rejected` |
| Resubmit after approval rejection | Must create new `approval_id`, must not reuse approval record that has reached terminal state; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascade rejection must be completed in the same transaction or recoverable event chain, must not rely on async polling to discover dangling approvals.
- Cascade `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes caused by cascade rejection must be written to audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be explicit fields, not implicit behavior of UI layer.
- `user` reviewer is still default baseline.
- If guardian / review-subagent is introduced, it can only work under controlled prompt, controlled tools, and controlled permission boundaries.
- Guardian reviewer conclusions must again enter Policy Engine review and cannot directly become authoritative allow.
