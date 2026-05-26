# Glossary And Terminology

## 1. Objective

Unify core terminology, preventing confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This document answers 4 questions:

- What a given term actually means in this system
- Which terms are easily confused and how to distinguish them
- Which usage is recommended
- Which usage should be avoided in contracts, protocols, configuration, and code

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. Usage Rules

- This glossary is the governance layer's authoritative terminology version.
- If trunk documents, contracts, ADRs, or guides conflict with this glossary, the authoritative contract for the corresponding topic takes precedence, and this glossary should be updated accordingly.
- If a term has both a product alias and an engineering name, the engineering canonical name is the default priority.
- Aliases suitable only for product narratives must not be used in protocols, schemas, events, configuration, directories, or table names.

## 3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `task` | User-level work unit, the smallest work commitment object the system presents to users and business | `session`, `execution` |
| `workflow` | Structured execution path for a task, defining steps, dependencies, inputs/outputs, and failure paths | `task`, `execution` |
| `step` | Single execution step within a workflow | `task`, `tool call` |
| `execution` | A specific runtime attempt of a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count/re-entry sequence for the same execution or step | `execution` |
| `session` | Channel interaction session, carrying user input, streaming output, and interaction context | `task` |
| `message` | A complete message object, may contain multiple `message parts` | `event` |
| `message part` | Structured fragment within a message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File or binary product, typically managed through artifact store | `output`, `step output` |
| `output` | Result oriented to upstream steps or users, may be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result encapsulation for success, partial success, failure, warnings, artifacts, and metrics | single tool result |

## 3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` eight-stage closed loop | ordinary workflow name |
| `stage` | Stage-level status unit within the OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of a complete or partial closed-loop iteration | single tool call |
| `TaskSituation` | Fact snapshot output by Observe | final assessment result |
| `UnifiedAssessment` | Structured judgment output by Assess | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | ordinary log |
| `LearningObject` | Reusable learning object produced by Learn Hub | single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | released strategy |
| `RolloutRecord` | Controlled release record from Release stage | `ImprovementCandidate` |

## 4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `runtime` | The layer that actually executes task/workflow/agent/tool | `platform` |
| `execution ticket` | Formal execution document issued from scheduler to execution layer | ordinary task input |
| `lease` | Temporary ownership of an execution or worker dispatch | permanent ownership |
| `lease owner` | The execution entity currently holding execution rights | `worker` physical machine identifier |
| `fencing token` | Version token to prevent old executors from writing dirty results | ordinary sequence |
| `dispatch` | Assigning a task or execution rights to some execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit, may be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating within the same task context | `worker` |
| `heartbeat` | Periodic health/load reporting | real business progress |
| `stalled` | Process may not be dead but has no effective progress within specified time | `offline` |
| `dead-letter` | Failure pocket record that cannot be automatically recovered or should not continue retrying | ordinary error log |
| `checkpoint` | State snapshot at recoverable boundary | any temporary variable |
| `partial result` | Task not yet fully complete, but has retainable and auditable阶段性 results | `completed` |
| `compensation` | Action to rollback, reconcile, or manually repair steps that have already occurred side effects | ordinary retry |

## 5. Status and Lifecycle Terminology

### 5.1 Lifecycle Common Terms

| Term | Definition | Applicable Objects |
| --- | --- | --- |
| `pending` | Task pre-execution state, created but not yet entered scheduling | Task |
| `awaiting_decision` | Task waiting for approval, waiting for approval decision | Task |
| `prechecking` | Execution pre-validation phase, pre-execution validation phase | Execution |
| `created` | Execution created state, Execution has been created | Execution |
| `queued` | Created but not yet started executing | Task, Execution |
| `in_progress` | Main logic actively advancing (Task status) | Task |
| `executing` | Main logic actively advancing (Execution status) | Execution |
| `blocked` | Temporarily unable to continue due to unmet dependencies, approval, policy, or resource reasons | Execution |
| `paused` | Explicitly paused, resumable | Workflow |
| `resuming` | Workflow transition state for resuming from pause | Workflow |
| `cancelling` | Workflow transient state before cancelled | Workflow |
| `streaming` | Session streaming state, in session streaming output | Session |
| `open` | Session open state, session is in open state | Session |
| `awaiting_user` | Waiting for human or external system input (Session status) | Session |
| `superseded` | Execution replaced by newer execution | Execution |
| `failed` | Execution failed and current attempt terminated | Task, Execution |
| `done` | Task terminal state, Task successfully ended | Task |
| `cancelled` | Explicitly terminated, no longer continuing | Task, Workflow |

### 5.2 Terms That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` applies only to Execution; Task uses `awaiting_decision` for waiting for approval; Workflow uses `paused` for paused
- `paused` is not `awaiting_user`
- `paused` is not `blocked`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `done` is the Task's only terminal success state, not equal to "all downstream processing complete", refer to authoritative state machine definition for accuracy

### 5.3 Termination Reason Terminology

> **Implementation Note:** `reasonCode` in `ExecutionRecord.lastErrorCode` and `DeadLetterRecord.finalReasonCode` fields is **freeform string**, not an enum. The system does not enforce a standardized code table; callers may write any business-meaningful string.

| Term | Definition | Type |
| --- | --- | --- |
| `reasonCode` | Termination reason code, recorded as string in `ExecutionRecord.lastErrorCode` / `DeadLetterRecord.finalReasonCode` | freeform string (not enum) |
| `termination_initiator` | Entity that triggered termination, e.g., user / system / policy / admin | semantic label, no formal enum |
| `termination_scope` | Termination impact scope, e.g., step / workflow / task / session | semantic label, no formal enum |
| `recoverable` | Whether recovery path is allowed after termination | boolean semantic |

## 6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `event` | Structured fact notification within the system | `message` |
| `event type` | Event category, recommended `<domain>.<action>` | DB table name |
| `tier 1 event` | Must be reliably persisted, must be recoverable, must not be silently lost | ordinary UI event |
| `ack` | Record that a consumer has confirmed processing an event; each consumer acknowledges independently; different consumers may separately ack the same event | global consumed flag |
| `replay` | Re-send events from memory buffer; persistent events retrieved via deliverPending() | live stream |
| `stream` | Incremental output stream for channels/UI | authoritative event log |
| `stream_id` | Unique identifier for a display stream, format `${channel}_${taskId}_${randomId}`, contains taskId as component | stream_id contains taskId component, should not simply equal task_id |
| `sequence` | Monotonic sequence number for the same stream or event channel | fencing token |
| `Last-Event-ID` | SSE client-declared resumable stream position | global offset |
| `replay buffer` | Limited event window retained for short-term disconnection recovery | persistent event storage |
| `viewer_only` | Read-only observation interaction state | business failure state |

## 7. Organization and Role Terminology

### 7.1 Control Layer Canonical Mapping

Control layer roles use "canonical id + business alias" notation in documentation.

**Implementation Status Note**: Only `intake_router` and `workflow_planner` have actual code implementations; `strategic_governor` and `division_lead` are documented definitions but not implemented as independent services in code.

| Canonical ID | Business Alias | Engineering Responsibility |
| --- | --- | --- |
| `strategic_governor` | CEO | Strategic judgment, escalation governance, organizational-level approval (Note: documented definition, not implemented as independent service in code) |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division splitting, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | In-division workflow autonomous orchestration (Note: documented definition, not implemented as independent service in code) |

Recommended usage:

- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)

Not recommended usage:

- Writing only `VP Orchestration`
- Using CEO / VP / Lead as primary keys directly in protocols and schemas

### 7.2 Other Organization Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition, not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity that assumes role responsibilities | `worker` |
| `organization` | Enterprise/organizational boundary | `division` |
| `workspace` | Workspace boundary under an organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

## 8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `policy engine` | Code-level entry point for final adjudication of permissions, risk, approval, budget, and runtime constraints | prompt instruction |
| `approval` / `HITL` | Decision step requiring explicit human participation | ordinary user reply |
| `break-glass` | High-risk emergency release configuration tag; critical risk triggers break-glass approval type, but has no independent audit workflow separate from standard approval | ordinary approval |
| `sandbox` | Execution isolation boundary | ordinary permission prompt |
| `exec policy` | Rule set for tool/command execution | high-level product description |
| `permission` | Authorization state where a subject can see or use a capability; Note: permission concept in code is implicitly implemented through PolicyEngine, no independent Permission type definition exists | runtime ownership |
| `secret` | Sensitive credentials such as keys, tokens, credentials | ordinary config value |
| `secret masking` | Method of masking secrets for display | real secret storage |
| `data classification` | Data classification rules, such as public/internal/confidential/restricted | plain label text |
| `audit evidence` | Traceable, verifiable, not easily repudiated behavioral evidence | ordinary log |

## 9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `authoritative store` | Storage that has final interpretation authority for a certain type of fact | any cache |
| `transaction store` | Storage responsible for transactional data such as tasks, status, approvals, events. Note: there is no independently named transaction store in code; transactional data is stored in AuthoritativeSqlDatabase | artifact store |
| `artifact store` | Storage for file-based, large-volume, or export-type products | transaction store |
| `analytics store` | Storage oriented toward projections and materialized views, not independent analytical reporting storage | authoritative state store |
| `data plane` | (Planned) Unified data plane for transaction layer, artifact, analytics, archive, replay; this abstraction layer does not exist in current code | single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundary | OS path |
| `eventual consistency` | Allowing brief delay before reaching consistency | strong consistency |
| `reconciliation` | Reconciliation and repair of status, events, workers, locks, etc. | ordinary retry |
| `migration` | Formal version migration of schema or storage structure | ad-hoc SQL patch |

### 9.1 OAPEFLIR Evolution Status Terms

| Term | Definition |
| --- | --- |
| `promotion_status` | LearningObject promotion status; current minimum set is `draft / validated / promoted / retired` |
| `candidate_status` | ImprovementCandidate status; current minimum set is `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | RolloutRecord status; current minimum set is `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| `guardrail_reason_code` | Release/block reason code given by deterministic guardrail |

## 10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
| --- | --- |
| `config bundle` | A set of configurations that take effect together |
| `config version` | Version identifier after configuration change |
| `feature flag` | Switch for controlling capability enable/disable or gradual rollout |
| `prompt bundle` | A set of prompts that are released and versioned together |
| `compatibility window` | Formally supported compatibility interval between different runtimes/SDKs/protocols/plugins |
| `promote criteria` | Evidence threshold for a module to be elevated from available to platform-ready/production-ready |
| `readiness registry` | Formal registration surface for recording environment or module readiness status |
| `evidence package` | A set of evidence packages used to support promote/signoff/production-ready judgments |

### 10.1 Prompt / Cache Partition Terminology

| Term | Definition |
| --- | --- |
| `fixed_prefix` | System prompt fixed prefix shared across agents, not participating in normal compaction by default |
| `domain_block` | Reusable prompt intermediate layer for same domain/profile |
| `variable_suffix` | Prompt suffix that dynamically changes by task, role, plan, memory |
| `KV cache fixed prefix` | Prefill cache reuse mechanism based on same prefix hash |

## 11. Testing, Validation, and Stabilization Terminology

| Term | Definition |
| --- | --- |
| `Stable Core` | Minimum capability scope deliberately shrunk to first achieve stable operation |
| `golden task` | Fixed representative task used as version regression baseline |
| `fixture` | Pre-configured fixed input/output samples for stable testing |
| `VCR` | Testing mechanism for recording/playback of external calls |
| `unit test` | Fine-grained testing oriented to single functions, modules, or objects |
| `integration test` | Testing of cross-module collaboration |
| `E2E` | End-to-end testing from entry to result |
| `chaos test` | Testing that actively injects faults to verify recovery and resilience |
| `soak test` | Long-duration continuous operation stability testing |
| `recovery drill` | Recovery drills for scenarios such as crashes, disconnections, lock conflicts, restarts |
| `admission control` | System admitting, delaying, or degrading before overload |
| `readiness` | Whether a stage, module, or environment has reached readiness for the next action |

## 12. Observability and Operations Terminology

| Term | Definition |
| --- | --- |
| `structured log` | Structured, searchable logs with contextual fields |
| `trace` | Global tracking of a task's execution chain across modules |
| `span` | Single operation segment within a trace |
| `correlation id` | Unified identifier used for cross-module correlation of logs/events/requests |
| `healthz` | Minimal health check entry |
| `inspect` | Debug query view for tasks, executions, sessions, workers |
| `backpressure` | Mechanism for the system to delay, degrade, or reject new requests when overloaded |
| `runbook` | On-call and incident handling manual |
| `SLO` | Service objectives, such as success rate, latency, recovery time |
| `SLA` | Service level agreement externally committed |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-duration continuous stability testing (Note: currently only implemented as integration test, not a production environment monitoring service) |
| `RCA` | Root cause analysis (Note: currently a manual process; no automatic RCA service exists in code) |
| `RTO` | Recovery Time Objective (Note: only referenced in DR validation workflows; no independent tracking service) |
| `RPO` | Acceptable data rollback point objective (Note: only referenced in DR validation workflows; no independent tracking service) |

## 13. Channel, Extension, and External Integration Terminology

| Term | Definition |
| --- | --- |
| `channel` | User or system interface, such as CLI, Web, Telegram, API (Note: only telegram/slack/webhook implemented in code; CLI/Web/API are not ChannelGateway channels) |
| `channel capability` | Capabilities supported by a channel, such as text, button, stream, attachment (Note: no corresponding capability enum type definition exists in code) |
| `plugin` | Installable unit that extends platform capabilities through public SDK or controlled boundaries |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | One of the external capability access protocols/extension types (MCP tools are validated via mcp-tool-guard, but not defined as PluginSpiType) |
| `recipe` / `template` | Structured workflow or template definition, usable as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata for a model's capabilities, limitations, pricing, default parameters, etc. |

## 14. Protocol, Model, and Security Abbreviations

| Term | Definition |
| --- | --- |
| `ADR` | Architecture Decision Record |
| `API` | Application Programming Interface, refers to formal external or inter-module interface surface |
| `SDK` | Software Development Kit, usually derived from authoritative schema or protocol |
| `DSL` | Domain-Specific Language, such as workflow DSL |
| `DDL` | Data Definition Language, commonly refers to table creation, index, constraint migration statements |
| `WAL` | Write-Ahead Logging, pre-write logging mode for SQLite/databases |
| `MCP` | Model Context Protocol or external capability access protocol type in this system |
| `HITL` | Human In The Loop, decision环节 requiring human participation |
| `PII` | Personally Identifiable Information |
| `TTL` | Time To Live, validity duration for data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage, used to receive messages or tasks that cannot continue processing |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect, used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | User and organization identity synchronization protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When abbreviations first appear in trunk documents, it is recommended to provide the full term or Chinese explanation at least once.
- Abbreviations must not replace formal definitions of object boundaries in authoritative contracts.

## 15. Easily Confused Term Pairs

### 15.1 `task` vs `session`

- `task` is a business work unit
- `session` is an interaction session
- One session may trigger multiple tasks
- One task may also update state across multiple sessions

### 15.2 `workflow` vs `execution`

- `workflow` is a structure
- `execution` is a runtime attempt
- The same workflow may have multiple execution attempts

### 15.3 `agent` vs `worker`

- `agent` leans toward responsibility and intelligent entity
- `worker` leans toward execution carrier and resource slot
- `sub-agent` is not a synonym for remote worker

### 15.4 `artifact` vs `output` vs `step output`

- `artifact` leans toward file products
- `output` leans toward result semantics
- `step output` leans toward step-level structured snapshot

### 15.5 `permission` vs `policy`

- `permission` is an authorization result or static capability boundary
- `policy` is the adjudication logic and rule system
- Descriptive limitations in prompts should not be treated as formal policy

### 15.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, they should not replace each other

### 15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching a gate or readiness for the next action
- `production-ready` indicates reaching the comprehensive threshold required for production support
- `Phase 1a ready` must not be misinterpreted as `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion for the current revision
- `completion gate` is the threshold check that must be re-executed before entering coding
- A single signoff conclusion should not be treated as a permanent pass

### 15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by the provider
- `model profile` is model metadata, not equal to provider profile

## 16. Naming Principles

- External narratives may retain CEO / VP / Lead.
- Internal implementations prioritize neutral engineering terms such as `router`, `planner`, `orchestrator`, `supervisor`.
- When narrative and engineering terms appear in the same document, explicit one-to-one mapping must be provided.
- Schemas, events, configuration, directories, and table names default to canonical engineering names.

## 17. Recommended Naming Formats

| Object | Recommended Format | Example |
| --- | --- | --- |
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` or stable `snake_case`, consistent throughout | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | plural `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | namespace + stable key | `runtime.max_concurrency` |
| feature flag | domain prefix + feature name | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type name + `camelCase` field name | `TurnStartParams` |

## 18. Prohibited Usage

- Do not use CEO / VP / Lead directly in schema enums
- Do not use `session` as a substitute for `task`
- Do not use `worker` as the sole implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as authoritative state machine
- Do not write descriptive limitations in prompts as "already-existing code-level policy"
- Do not write `ready` directly as a synonym for `production-ready`
- Do not write a single `signoff` conclusion as a permanently valid state
- Do not use abbreviations as the sole explanation, preventing readers from returning to formal definitions
- Do not conflate `provider`, `model`, and `profile` three layers into one object

## 19. Closure Conclusion

The goal of terminology unification is not to remove product expression, but to prevent semantic drift during engineering implementation.

From now on:

- Narrative names may exist when discussing architecture
- When writing contracts, schemas, events, configuration, and code, canonical engineering names must be prioritized
- When ambiguity arises, priority should be given to returning to this glossary and the corresponding authoritative contract for closure
