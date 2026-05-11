# UI Console And Cockpit Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the minimum UI boundaries for Automatic Agent's Web Console, Task Cockpit, Workflow Cockpit, Approval Center, Stability Panel, and Admin Takeover Console.

It answers the questions:

- What object does the UI primarily serve
- What does the homepage display first
- What capabilities must task, approval, stability, and takeover pages at least have
- How is page data truth source layered to avoid each page independently patching together fact sources

Related documents:

- `admin_console_and_human_takeover_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `api_surface_contract.md`

## 2. UI General Principles

The frontend is not a collection of chat windows, but:

- Task workbench
- Approval and governance workbench
- Stability and operations workbench
- Administrator takeover workbench

Minimum principles:

1. Humans should primarily enter the system through `task / approval / inspect / takeover`, and should not directly give arbitrary instructions to agents.
2. The homepage must first answer "is the system healthy, what is it currently doing, where is it stuck".
3. Key pages must be able to drill down to evidence, timeline, and inspect, not just show summary.
4. High-risk actions must display risk level, policy source, approval chain, and takeover entry.
5. UI display state must not reverse-define authoritative facts for tasks, workflows, or executions.

## 3. Console Information Architecture

Recommended minimum information architecture:

- `Mission Control`
  - `Dashboard`
  - `Task Cockpit`
  - `Workflow Cockpit`
  - `Approval Center`
  - `Stability`
  - `Alerts`
- `Operations`
  - `Dispatch`
  - `Inspect`
  - `Health`
  - `Incidents`
- `Governance`
  - `Policy`
  - `Audit`
  - `Security`
  - `Runtime Decisions`
- `Admin`
  - `Takeover`
  - `Workers`
  - `Queues`
  - `Feature Flags`
  - `Capability / Entitlement`

Rules:

- Current stage does not require immediately fully populating all pages.
- But navigation grouping should from the beginning be organized by capability domain, not page-wall flat layout.

## 4. Homepage Prioritization Rules

Console homepage should be organized by the following priorities:

1. Top displays:
   - `system status`
   - `current focus`
   - `active alerts`
2. First screen displays:
   - Currently active tasks / workflows
   - Whether runtime / queue / approval is healthy
   - Where current backlog is dispatched
3. Second screen displays:
   - Blocked reason
   - Stale / recovery / retry summary
   - Recent high-risk decisions / approvals
4. Raw logs, long traces, and raw event tails can only be drill-down views, and must not occupy homepage main visual.

## 5. Core Pages

### 5.1 `TaskCockpit`

Minimum fields:

- `task_id`
- `task_status`
- `current_step`
- `current_execution`
- `blocked_reason?`
- `latest_tool_call?`
- `latest_decision?`
- `artifact_refs`

Minimum actions:

- Open inspect
- View timeline
- View artifacts
- Cancel task
- Enter human takeover

### 5.2 `WorkflowCockpit`

Minimum fields:

- `workflow_id`
- `workflow_status`
- `steps`
- `current_step_index`
- `dependency_state`
- `approval_nodes`
- `evidence_refs`

Minimum actions:

- View step output
- View dependency / blocked state
- Open recovery history
- View compensation / replay evidence

### 5.3 `ApprovalCenter`

Minimum fields:

- `approval_id`
- `task_id`
- `risk_level`
- `reason_summary`
- `options`
- `recommended_option?`
- `deadline?`
- `policy_source`

Minimum actions:

- approve
- reject
- request_more_context
- open_explanation

### 5.4 `StabilityPanel`

Minimum fields:

- `active_tasks`
- `queued_tasks`
- `stale_executions`
- `recovered_executions`
- `failed_recoveries`
- `approval_backlog`
- `event_backlog`
- `worker_health`

Minimum actions:

- Drill into stuck task
- Inspect backlog
- Open recovery evidence
- Trigger incident workflow

### 5.5 `AdminTakeoverConsole`

Minimum fields:

- `task scope`
- `tenant / workspace scope`
- `execution owner`
- `lease / worker state`
- `recent events`
- `current model / prompt / policy version`
- `current capability / entitlement limit`

Minimum actions:

- `retry_step`
- `skip_step`
- `override_step_output`
- `switch_worker`
- `manual_cancel`
- `mark_unrecoverable`

## 6. Page Data Truth Source Layering

### 6.1 `shared_snapshot`

Applicable to:

- Top system status bar
- Dashboard homepage summary
- Stability overview header

Minimum content:

- Overall health
- Queue depth
- Active executions
- Approval backlog
- Alert summary

### 6.2 `shared_query`

Applicable to:

- Dashboard
- Stability
- Approval Center
- Admin Console overview

Rules:

- Cross-domain aggregation pages should prioritize reusing shared queries, rather than each page independently pulling a dispersed API.

### 6.3 `page_local_api`

Applicable to:

- Task inspect
- Workflow inspect
- Approval inspect
- Worker details
- Artifact details

Rules:

- Domain-specific drill-down can have independent APIs.
- But pages must not privately patch together authoritative state, should prioritize using inspect / resource APIs.

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit must support at least 5 levels of drill-down:

| Level | Display Content |
| --- | --- |
| `L1` | Task list + status |
| `L2` | Task details + workflow state |
| `L3` | Step outputs + tool calls |
| `L4` | Approval / decision / evidence chain |
| `L5` | Trace / replay / recovery timeline |

Rules:

- `completed` must not only display summary, must be able to enter evidence.
- `blocked` must not only display "waiting", must display blocked reason and source.
- `failed` must not only display error text, must be able to enter error code, last step, and recovery history.

## 8. UI and Gateway / Streaming Relationship

- Web UI streaming display should comply with `gateway_streaming_contract.md`.
- If display layer needs to do chunk commit, catch-up, or backlog drain, should adapt by queue pressure and message age, rather than hardcoding special logic by upstream source.
- Display layer catch-up must not disrupt message order, nor destroy readability through single-frame brute-force flush.
- Non-streaming console views can read aggregated state, but must not replace stream facts.
- UI-side state naming must remain consistent with `debug_inspect_health_backpressure_contract.md` and `api_surface_contract.md`.

## 9. Currently Explicitly Not Done

Currently not directly adopting:

- Heavy Canvas / A2UI package rendering platform
- Large-scale business domain workbench deployment
- Business page walls
- Directly maintaining capability / policy truth in frontend

Reasons:

- The core goal of the current stage is to first stabilize the Stable Core.
- Prematurely introducing heavy UI package runtime amplifies frontend-backend boundary complexity.
- Automatic Agent currently needs task, workflow, stability, and takeover workbenches more than business domain page expansion.

## 10. Closure Conclusion

Automatic Agent's UI should not first grow into "another chat application".

A more reasonable baseline is:

- A Console that can view health status
- A Task / Workflow Cockpit that can drill down into evidence
- An Approval Center that can handle approvals and explanations
- An Admin Console that can takeover and limit damage
