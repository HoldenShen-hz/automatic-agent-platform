# UI Console And Cockpit Contract

## 1. Scope

This contract defines minimum interface boundaries for Automatic Agent's Web Console, Task Cockpit, Workflow Cockpit, Approval Center, Stability Panel, and Admin Takeover Console.

It answers questions:

- What objects does UI serve first
- What is displayed on the homepage first
- What minimum capabilities must task, approval, stability, and takeover pages have
- How page data truth source is layered to avoid each page assembling its own source of truth

Related documents:

- `admin_console_and_human_takeover_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `api_surface_contract.md`

## 2. UI General Principles

Frontend is not a collection of chat windows but:

- Task Workbench
- Approval and Governance Workbench
- Stability and Operations Workbench
- Administrator Takeover Workbench

Minimum principles:

1. Humans should enter the system primarily through `task / approval / inspect / takeover` and should not freely issue commands to arbitrary agents.
2. Homepage must first answer "is the system healthy, what is it currently doing, where is it stuck".
3. Key pages must be able to drill down to evidence, timeline, and inspect rather than just showing summaries.
4. High-risk actions must display risk level, policy source, approval chain, and takeover entry.
5. UI displayed state must not reverse define task, workflow, or execution authoritative facts.

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

- Current phase does not require laying out all pages at once.
- But navigation grouping should be organized by capability domain from the start rather than flat page walls.

## 4. Homepage Prioritization Rules

Console homepage should be organized by the following priority:

1. Top displays:
   - `system status`
   - `current focus`
   - `active alerts`
2. First screen displays:
   - Currently active task / workflow
   - Whether runtime / queue / approval is healthy
   - Where current backlog is dispatched
3. Second screen displays:
   - blocked reason
   - stale / recovery / retry summary
   - Recent high-risk decision / approval
4. Raw logs, long traces, and raw event tails can only be used as drill-down views and must not occupy the homepage main visual area.

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
- Enter manual takeover

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

- overall health
- queue depth
- active executions
- approval backlog
- alert summary

### 6.2 `shared_query`

Applicable to:

- Dashboard
- Stability
- Approval Center
- Admin Console overview

Rules:

- Cross-domain aggregate pages should preferentially reuse shared query rather than each page pulling separate APIs.

### 6.3 `page_local_api`

Applicable to:

- task inspect
- workflow inspect
- approval inspect
- worker details
- artifact details

Rules:

- Domain-specific drill-down can have independent APIs.
- But pages must not privately assemble authoritative state, should preferentially use inspect / resource APIs.

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit at minimum supports 5 levels of drill-down:

| Level | Content Displayed |
| --- | --- |
| `L1` | task list + status |
| `L2` | task details + workflow state |
| `L3` | step outputs + tool calls |
| `L4` | approval / decision / evidence chain |
| `L5` | trace / replay / recovery timeline |

Rules:

- `completed` must not only display summary but must be able to enter evidence.
- `blocked` must not only show "waiting" but must display blocked reason and source.
- `failed` must not only display error text but must be able to enter error code, last step, and recovery history.

## 8. Relationship Between UI and Gateway / Streaming

- Web UI streaming display should comply with `gateway_streaming_contract.md`.
- If display layer needs to do chunk commit, catch-up, or backlog drain, should adapt based on queue pressure and message age rather than hardcoding special logic based on upstream sources.
- Display layer catch-up must not disrupt message order or destroy readability through single-frame brute force flush.
- Non-streaming console views can read aggregated state but must not replace stream facts.
- UI-side state naming must be consistent with `debug_inspect_health_backpressure_contract.md` and `api_surface_contract.md`.

## 9. Currently Explicitly Not Doing

Currently not directly adopting:

- Heavy Canvas / A2UI package rendering platforms
- Large-scale business domain workbench deployment
- Business page walls
- Directly maintaining capability / policy truth in frontend

Reasons:

- The core goal of the current phase is to get Stable Core running first.
- Introducing heavy UI package runtime prematurely will amplify frontend-backend boundary complexity.
- Automatic Agent currently needs task, workflow, stability, and takeover four types of workbenches more than business domain page expansion.

## 10. Conclusion

Automatic Agent's UI should not first grow into "another chat application".

More reasonable baseline is:

- A Console that can view health status
- A Task / Workflow Cockpit that can drill down into evidence
- An Approval Center that can handle approval and explanation
- An Admin Console that can takeover and stop losses
