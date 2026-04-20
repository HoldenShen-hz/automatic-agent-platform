# Approval And HITL Contract

## 1. Scope

This contract defines manual decision escalation, approval requests, approval result callback, and behavioral differences under execution modes.

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
| `stage_ref` | `OapeflirStage?` | OAPEFLIR stage that triggered approval |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated evidence or release object |
| `options` | `string[]` | Optional decisions |
| `context` | `json` | Related context |
| `timeout_policy` | `reject \| approve \| remain_pending` | Timeout policy |
| `created_at` | `timestamp` | Initiation time |

Rules:

- `timeout_policy` is part of the governance request but can only be tightened by system code, not arbitrarily relaxed by downstream Agents.
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

Discriminant Constraints:

- When `option_selected`, `selected_option_id` must be provided, and `confirmed` must not be provided simultaneously.
- When `confirmed`, `confirmed=true` must be provided, and `selected_option_id` must not be provided simultaneously.
- When `text_input`, `input_text` must be provided.
- `rejected` and `expired` must not carry the three interaction fields mentioned above.
- A decision for the same `approval_id` can only be successfully applied once; duplicate submissions must be treated as idempotent no-op or conflict, not as advancing business state again.

## 5. Trigger Scenarios

At least includes:

- Cost exceeds threshold or approaches threshold.
- Security-sensitive commands.
- Task ambiguity.
- Self-healing exceeds maximum retry attempts.
- Organization changes.
- High-risk workflow suggestions.
- PlanHub produces high-risk plan or irreversible execution path.
- FeedbackHub receives continuous negative signals, user corrections, or quality anomalies, requiring manual confirmation handling.
- ImproveHub attempts to accept strategy upgrade, prompt/policy change, or candidate improvement.
- ReleaseHub attempts to advance rollout level, complete release, or trigger rollback.

## 6. Execution Mode Differences

- `supervised`: High-risk behaviors require approval by default.
- `auto`: Medium and low risks can pass automatically; high risks still require approval.
- `full-auto`: Only allows stronger automation outside hard prohibitions, but still records escalation and default policies.

Supplementary Rules:

- `full-auto` cannot bypass hard rejection policies, break-glass policies, and dual-approval requirements.
- Execution mode only affects "whether automatic pass-through is allowed", not "whether hard prohibitions are rejected".

Supplementary Suggestions:

- Approval policy should support gradual evolution from coarse-grained mode to fine-grained capability / risk class structured configuration, rather than only keeping a single boolean switch.
- Reviewer routing should be explicitly modeled, e.g., default `user`, later introducing restricted guardian / reviewer subagent, but that reviewer can only give approval suggestions or handle代办, and cannot bypass final policy review.

## 7. Behavioral Constraints

- Each approval request must be traceable.
- The same approval result must not be applied repeatedly.
- Timeout handling must be explicit: default reject, default pass, or pause and wait; no ambiguity.
- Decision payload for the same `approval_id` must satisfy discriminant constraints; conflicting fields must not coexist.
- After approval result is persisted, final action execution must pass through Policy Engine review again to prevent using old approval after environment changes.
- `critical` risk actions should support dual approval or break-glass process, not just single ordinary confirmation.
- Approvals with `stage_ref` must be writable back to the corresponding OAPEFLIR timeline; they cannot only exist in approval table or message channel.
- Approval results related to Improve / Release can only change the controlled state of candidate or rollout, and must not directly rewrite already-released strategy content.
- If user text-input approvals express corrections, preferences, or negative feedback, they should be converted to `FeedbackSignal` for FeedbackHub / LearnHub consumption.

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

- Button model is uniformly `option_id + label + style + requires_confirm?`.
- Non-button channels must degrade to numbered options or text input with equivalent semantics.
- Channel adaptation layer must not change approval semantics, only presentation.

### 8.3 Organization Responsibility Boundaries

- HQ is responsible for defining approval escalation principles and default timeout policy.
- division / planner / orchestrator only responsible for proposing context requiring approval, not directly approving their own high-risk actions.
- CEO/VP and other product narrative names do not affect the engineering boundary of final approval authority.
- Approval authority for high-risk actions must be decoupled from the initiating execution subject, preventing "self-application, self-approval" pseudo-approval chains.

### 8.4 Cascading Rejection Semantics

When an approval request is rejected or expired, the system must handle all downstream states depending on that approval result:

| Scenario | Behavior |
| --- | --- |
| Single task single approval `rejected` | Associated execution enters `blocked` or `failed` (depending on whether retryable), task enters `awaiting_decision` or `failed` |
| Single task single approval `expired` | Execute according to `timeout_policy`: `reject` goes rejection chain, `approve` goes pass-through chain, `remain_pending` keeps waiting |
| Multiple pending approvals for same execution | When any approval is rejected, other `requested` approvals for the same execution must enter `superseded`, not left hanging |
| Parent task approval rejected | If child task execution depends on parent approval result, child task should enter `cancelled`, associated execution enters `cancelled`, reason code `parent_approval_rejected` |
| Resubmit after approval rejection | Must create new `approval_id`; must not reuse approval record that has reached terminal state; new request should reference original `approval_id` as `supersedes_ref` |

Rules:

- Cascading rejection must be completed in the same transaction or recoverable event chain, and must not rely on async polling to discover hanging approvals.
- Cascading `superseded` approvals must record `superseded_by` reference pointing to the source approval that triggered the cascade.
- All state changes from cascading rejection must be written to audit chain.

### 8.5 Approval Reviewer Routing

- Reviewer routing must be explicit fields, not UI-layer implicit behavior.
- `user` reviewer is still the default baseline.
- If guardian / review-subagent is introduced, it can only work under controlled prompts, controlled tools, and controlled permission boundaries.
- Guardian reviewer conclusion must pass through Policy Engine review again, and must not directly become authoritative allow.

### 8.6 OAPEFLIR Stage Approval Linkage

`ApprovalFeedbackLink` binds human decisions to OAPEFLIR closed-loop evidence, minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `approval_id` | `string` | Approval ID |
| `task_id` | `string` | Associated task |
| `stage_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Trigger stage |
| `loop_iteration` | `integer?` | Trigger round |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | Associated object |
| `feedback_signal_id` | `string?` | Feedback signal produced or consumed by approval |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | Impact on closed loop |

Rules:

- After PlanHub approval passes, plan can only enter execute; runtime precheck and Policy Engine review are still required.
- FeedbackHub approval is not an override of user emotions, but a manual governance signal for whether subsequent learn/improve adopts.
- ImproveHub's `approve_candidate` can only advance candidate state, and cannot skip guardrail or directly release.
- ReleaseHub's `advance_rollout` / `rollback_rollout` must reference rollout record and write to release audit.
- OAPEFLIR approval timeout must enter stage timeline, and convert to explicit stage blocked / failed / remain_pending semantics according to `timeout_policy`.
