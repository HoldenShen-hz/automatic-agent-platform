# UI Console And Cockpit Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the minimum interface boundaries for Automatic Agent's Web Console, Task Cockpit, Workflow Cockpit, Approval Center, Stability Panel, and Admin Takeover Console.

It answers the questions:

- What object does the UI primarily serve
- What is displayed first on the homepage
- What capabilities must task, approval, stability, and takeover pages at minimum have
- How page data truth source is layered to avoid each page independently assembling facts

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

1. Humans should enter the system primarily through `task / approval / inspect / takeover`, not directly issuing free-form commands to any agent.
2. The homepage must first answer "is the system healthy, what is it currently doing, where is it stuck".
3. Key pages must be able to drill down to evidence, timeline, and inspect, not just show summaries.
4. High-risk actions must display risk level, policy source, approval chain, and takeover entry.
5. UI-displayed state must not inversely define the authoritative facts of HarnessRun, PlanGraph, or NodeRun.

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

- The current phase does not require laying out all pages at once.
- But navigation grouping should be organized by capability domain from the start, not as a flat page wall.

## 4. Homepage Prioritization Rules

The Console homepage should be organized by the following priority:

1. Top bar displays:
   - `system status`
   - `current focus`
   - `active alerts`
2. First screen displays:
   - Currently active task / workflow
   - Whether runtime / queue / approval is healthy
   - Where current backlog is dispatched
3. Second screen displays:
   - Blocked reason
   - Stale / recovery / retry summary
   - Recent high-risk decisions / approvals
4. Raw logs, long traces, and raw event tails can only be used as drill-down views, not occupying the homepage main visual area.

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

- Cross-domain aggregated pages should prioritize reusing shared queries rather than each page independently calling scattered APIs.

### 6.3 `page_local_api`

Applicable to:

- Task inspect
- Workflow inspect
- Approval inspect
- Worker details
- Artifact details

Rules:

- Domain-specific drill-down can have independent APIs.
- But pages must not privately assemble authoritative state; they should prioritize using inspect / resource APIs.

## 7. Task-Flow Cockpit Drill-Down

Task / Workflow cockpit must support at least 5 levels of drill-down:

| Level | Displayed Content |
| --- | --- |
| `L1` | task list + status |
| `L2` | task details + workflow state |
| `L3` | step outputs + tool calls |
| `L4` | approval / decision / evidence chain |
| `L5` | trace / replay / recovery timeline |

Rules:

- `completed` must not only show summary; must be able to enter evidence.
- `blocked` must not only show "waiting"; must show blocked reason and source.
- `failed` must not only show error text; must be able to enter error code, last step, and recovery history.

## 8. Relationship Between UI and Gateway / Streaming

- Web UI streaming display should comply with `gateway_streaming_contract.md`.
- If the display layer needs to do chunk commit, catch-up, or backlog drain, it should be adaptive based on queue pressure and message age, not hardcoded special logic based on upstream source.
- Display layer catch-up must not disrupt message order, nor destroy readability through single-frame brute-force flush.
- Non-streaming console views can read aggregated state but must not replace stream facts.
- UI-side state naming must remain consistent with `debug_inspect_health_backpressure_contract.md` and `api_surface_contract.md`.

## 9. Explicitly Not Done Currently

Currently not directly adopted:

- Heavy Canvas / A2UI package rendering platforms
- Large-scale business domain workbench deployment
- Business page walls
- Directly maintaining capability / policy truth in the frontend

Reasons:

- The core goal of the current phase is to first get the Stable Core running reliably.
- Introducing heavy UI package runtime prematurely amplifies frontend-backend boundary complexity.
- Automatic Agent currently needs four types of workbenches: task, workflow, stability, and takeover, not business domain page expansion.

## 10. Closure Conclusion

Automatic Agent's UI should not first grow into "another chat application".

A more reasonable baseline is:

- A Console that can view health status
- A Task / Workflow Cockpit that can drill down into evidence
- An Approval Center that can handle approvals and explanations
- An Admin Console that can take over and mitigate damage