# UI Console And Cockpit Contract

---

## OAPEFLIR Mapping

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

- **Observe**: signal collection and aggregation
- **Assess**: pre-execution evaluation and risk judgement
- **Plan**: task decomposition and DAG construction
- **Execute**: step execution and fault tolerance
- **Feedback**: signal collection and preprocessing
- **Learn**: pattern detection and knowledge extraction
- **Improve**: improvement candidate evaluation and rollout
- **Release**: controlled release and rollback

---

## 1. Scope

This contract defines the minimum UI boundaries of the Automatic Agent's Web Console, Task Cockpit, Workflow Cockpit, Approval Center, Stability Panel, and Admin Takeover Console.

The questions it answers are:

- What objects the UI primarily serves
- What the home page should display first
- What capabilities the task, approval, stability, and takeover pages must at least have
- How the page data truth source is layered, to avoid each page stitching its own source of truth

Related documents:

- `admin_console_and_human_takeover_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `hitl_experience_and_explainability_contract.md`
- `api_surface_contract.md`

## 2. UI Overall Principles

The front-end is not a collection of chat windows, but:

- A task workbench
- An approval and governance workbench
- A stability and operations workbench
- An admin takeover workbench

Minimum principles:

1. Humans should preferably enter the system through `task / approval / inspect / takeover`, and should not directly issue arbitrary instructions to any agent.
2. The home page must first answer "is the system healthy, what is currently being done, where is it stuck".
3. Key pages must be able to drill down to evidence, timeline, inspect, and not just show a summary.
4. High-risk actions must display the risk level, policy source, approval chain, and takeover entry.
5. The UI display status must not reversely define the authoritative fact of `HarnessRun`, `PlanGraph`, or `NodeRun`.

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

- The current phase does not require rolling out all pages at once.
- But navigation grouping should be organized by capability domain from the start, rather than as a flat wall of pages.

## 4. Home Page Ordering Rules

The Console home page should be organized with the following priority:

1. Top of page first displays:
   - `system status`
   - `current focus`
   - `active alerts`
2. First screen displays:
   - Currently active task / workflow
   - Whether runtime / queue / approval is healthy
   - Where the current backlog is dispatched
3. Second screen displays:
   - blocked reason
   - stale / recovery / retry summary
   - recent high-risk decision / approval
4. Raw logs, long traces, and raw event tails can only be used as drill-down views, and must not occupy the main view of the home page.

## 5. Core Pages

### 5.1 `TaskCockpit`

Minimum fields:

- `task_projection_ref`
- `harness_run_id`
- `harness_run_status`
- `active_node_run_id`
- `blocked_reason?`
- `latest_attempt_receipt_ref?`
- `latest_decision?`
- `artifact_refs`

Minimum actions:

- Open inspect
- View timeline
- View artifacts
- Cancel task
- Enter manual takeover

### 5.2 `RunCockpit`

Minimum fields:

- `plan_graph_id`
- `harness_run_id`
- `harness_run_status`
- `node_runs`
- `active_node_run_id?`
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
- `harness_run_id`
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

- drill into stuck task
- inspect backlog
- open recovery evidence
- trigger incident workflow

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
- Dashboard home page summary
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

- Cross-domain aggregated pages should prefer reusing shared queries, rather than each page pulling scattered APIs.

### 6.3 `page_local_api`

Applicable to:

- task inspect
- workflow inspect
- approval inspect
- worker details
- artifact details

Rules:

- Domain-specific drill-down can have independent APIs.
- But the page must not privately stitch the authoritative status, and should prefer using inspect / resource APIs.

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit must at least support 5 levels of drill-down:

| Level | Displayed Content |
| --- | --- |
| `L1` | task list + status |
| `L2` | task details + workflow state |
| `L3` | step outputs + tool calls |
| `L4` | approval / decision / evidence chain |
| `L5` | trace / replay / recovery timeline |

Rules:

- `completed` must not only show the summary, and must allow entering evidence.
- `blocked` must not only show "waiting", and must display the blocked reason and source.
- `failed` must not only show the error text, and must allow entering the error code, last step, and recovery history.

## 8. Relationship between UI and Gateway / Streaming

- Web UI streaming display should follow `gateway_streaming_contract.md`.
- If the display layer needs to do chunk commit, catch-up, or backlog drain, it should adapt to queue pressure and message age, rather than hard-coding special logic based on the upstream source.
- Display layer catch-up must not disrupt message order, nor should it destroy readability by force-flushing a single frame.
- Non-streaming console views can read aggregated status, but must not replace stream fact.
- UI-side status names must be consistent with `debug_inspect_health_backpressure_contract.md` and `api_surface_contract.md`.

## 9. What Is Explicitly Not Done

Currently not directly adopted:

- Heavy Canvas / A2UI package rendering platform
- Large-scale business domain workbench rollout
- Business page wall
- Maintaining capability / policy truth directly at the front-end

Reasons:

- The core goal of the current phase is to first run the Stable Core stably.
- Introducing a heavy UI package runtime too early will amplify the front-end / back-end boundary complexity.
- The Automatic Agent currently needs task, workflow, stability, and takeover workbenches, not business domain page expansion.

## 10. Closure Conclusion

The Automatic Agent's UI should not first grow into "another chat application".

A more reasonable baseline is:

- A Console that can view health status
- A Task / Workflow Cockpit that can drill down into evidence
- An Approval Center that can handle approvals and explanations
- An Admin Console that can take over and stop the bleeding
