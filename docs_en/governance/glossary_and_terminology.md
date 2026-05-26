# Glossary And Terminology

## 1. Objective

Unify core terminology to avoid confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This document answers 4 questions:

- What a term actually means in this system
- Which terms are easily confused and how to distinguish them
- Which writing styles are recommended
- Which writing styles should be avoided in contracts, protocols, configuration, and code

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. Usage Rules

- This glossary is the authoritative terminology master at the governance layer.
- If main documents, contracts, ADRs, or guides conflict with this glossary, the authoritative contract for the corresponding topic takes precedence, and this glossary should be updated accordingly.
- If a term has both product alias and engineering name, the engineering canonical name takes precedence by default.
- Aliases that are only suitable for product narratives must not be used in protocols, schemas, events, configuration, directories, or table names.

## 3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `task` | User-level work unit, the smallest work commitment object the system presents to users and business | `session`, `execution` |
| `workflow` | Structured execution path of a task, defining steps, dependencies, inputs/outputs, and failure paths | `task`, `execution` |
| `step` | Single execution step within a workflow | `task`, `tool call` |
| `execution` | A specific runtime attempt of a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count/re-entry sequence for the same execution or step | `execution` |
| `session` | Channel interaction session, carrying user input, streaming output, and interaction context | `task` |
| `message` | A complete message object that may contain multiple message parts | `event` |
| `message part` | Structured fragment within a message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File or binary product, usually managed via artifact store | `output`, `step output` |
| `output` | Result oriented toward upstream steps or users, can be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result wrapper for success, partial success, failure, warning, artifact, and metrics | Single tool result |

## 3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` eight-stage closed loop | Regular workflow name |
| `stage` | Stage-level status unit within the OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of a complete or partial closed-loop iteration | Single tool call |
| `TaskSituation` | Fact snapshot output from Observe | Final assessment result |
| `UnifiedAssessment` | Structured judgment output from Assess | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | Workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | Regular log |
| `LearningObject` | Reusable learning object produced by Learn Hub | Single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | Released strategy |
| `RolloutRecord` | Controlled release record in the Release stage | `ImprovementCandidate` |

## 4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `runtime` | The layer where the system actually executes task/workflow/agent/tool | `platform` |
| `execution ticket` | Formal execution document issued by scheduler to execution layer | Regular task input |
| `lease` | Temporary ownership of an execution or worker dispatch | Permanent ownership |
| `lease owner` | Entity currently holding execution rights | `worker` physical machine identifier |
| `fencing token` | Version token to prevent old executors from writing dirty results | Regular sequence |
| `dispatch` | Assigning a task or execution rights to an execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit, can be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating within the same task context | `worker` |
| `heartbeat` | Periodic health/load reporting | Real business progress |
| `stalled` | Process may not be dead but has no effective progress within specified time | `offline` |
| `dead-letter` | Failure pocket record that cannot be automatically recovered or should not continue retrying | Regular error log |
| `checkpoint` | State snapshot at recoverable boundary | Any temporary variable |
| `partial result` | Task not yet entirely complete but has retainable, auditable phased results | `completed` |
| `compensation` | Action to rollback, reconcile, or manually repair steps that have already occurred side effects | Regular retry |

## 5. State and Lifecycle Terminology

### 5.1 General Lifecycle Terms

| Term | Definition | Applied To |
| --- | --- | --- |
| `pending` | Task pre-execution state, created but not yet entered scheduling | Task |
| `awaiting_decision` | Task waiting for approval | Task |
| `prechecking` | Execution pre-validation phase | Execution |
| `created` | Execution created state | Execution |
| `queued` | Created but not yet started executing | Task, Execution |
| `in_progress` | Main logic being advanced (Task state) | Task |
| `executing` | Main logic being advanced (Execution state) | Execution |
| `blocked` | Temporarily unable to proceed due to unmet dependencies, approval, strategy, or resource reasons | Execution |
| `paused` | Explicitly paused, resumable | Workflow |
| `resuming` | Workflow transition state for resuming from pause | Workflow |
| `cancelling` | Workflow transient state before cancelled | Workflow |
| `streaming` | Session streaming state | Session |
| `open` | Session open state | Session |
| `awaiting_user` | Waiting for human or external system input (Session state) | Session |
| `superseded` | Execution replaced by newer execution | Execution |
| `failed` | Execution failed and current attempt terminated | Task, Execution |
| `done` | Task terminal state, Task successfully ended | Task |
| `cancelled` | Explicitly terminated, will not continue | Task, Workflow |

### 5.2 State Terms That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` applies only to Execution; Task uses `awaiting_decision` for waiting for approval; Workflow uses `paused` for paused
- `paused` is not `awaiting_user`
- `paused` is not `blocked`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `done` is the only terminal success state for Task, not equal to "all downstream processing complete", should be based on authoritative state machine definition

### 5.3 Termination Reason Terminology

> **Implementation Note:** `reasonCode` in `ExecutionRecord.lastErrorCode` and `DeadLetterRecord.finalReasonCode` fields is **freeform string**, not an enum. The system does not enforce a standardized code table; callers can write any business-meaningful string.

| Term | Definition | Type |
| --- | --- | --- |
| `reasonCode` | Termination reason code, recorded as string in `ExecutionRecord.lastErrorCode` / `DeadLetterRecord.finalReasonCode` | freeform string (not enum) |
| `termination_initiator` | Entity that triggered termination, such as user/system/policy/admin | Semantic label, no formal enum |
| `termination_scope` | Scope of termination impact, such as step/workflow/task/session | Semantic label, no formal enum |
| `recoverable` | Whether recovery path is allowed after termination | boolean semantics |

## 6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `event` | Structured factual notification within the system | `message` |
| `event type` | Event category, recommended `<domain>.<action>` | DB table name |
| `tier 1 event` | Must be reliably persisted, must be recoverable, cannot be silently lost | Regular UI event |
| `ack` | Record that a consumer has confirmed processing an event; each consumer acknowledges independently; different consumers can ack the same event separately | Global consumed flag |
| `replay` | Re-sending events from memory buffer; persistent events pulled via deliverPending() | Live stream |
| `stream` | Incremental output stream oriented to channels/UI | Authoritative event log |
| `stream_id` | Unique identifier of a display stream, format `${channel}_${taskId}_${randomId}`, contains taskId as component | stream_id contains taskId component, should not be simply equated to task_id |
| `sequence` | Monotonic sequence number within the same stream or event channel | Fencing token |
| `Last-Event-ID` | SSE client-declared resume-from-disconnect position | Global offset |
| `replay buffer` | Finite event window reserved for short-term disconnect recovery | Persistent event storage |
| `viewer_only` | Read-only observation interaction state | Business failure state |

## 7. Organization and Role Terminology

### 7.1 Control Layer Canonical Mapping

Control layer roles use "canonical id + business alias" format consistently in documentation.

**Implementation Status Note**: Only `intake_router` and `workflow_planner` have actual code implementation; `strategic_governor` and `division_lead` are document definitions but not implemented as independent services in code.

| Canonical ID | Business Alias | Engineering Responsibility |
| --- | --- | --- |
| `strategic_governor` | CEO | Strategic judgment, escalation governance, org-level approval (note: document definition, not implemented as independent service in code) |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division splitting, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | In-division workflow autonomous orchestration (note: document definition, not implemented as independent service in code) |

Recommended writing:

- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)

Not recommended:

- Writing only `VP Orchestration`
- Using `CEO / VP / Lead` directly as primary keys in protocols and schemas

### 7.2 Other Organization Terms

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition, not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity that assumes role responsibilities | `worker` |
| `organization` | Enterprise/organization-level boundary | `division` |
| `workspace` | Workspace boundary under organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

## 8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `policy engine` | Code-level entry point that makes final rulings on permissions, risk, approval, budget, and runtime constraints | Prompt instructions |
| `approval` / `HITL` | Decision step requiring explicit human participation | Regular user reply |
| `break-glass` | High-risk emergency release configuration marker; critical risk triggers break-glass approval type, but has no independent audit workflow separate from standard approval | Regular approval |
| `sandbox` | Execution isolation boundary | Regular permission prompt |
| `exec policy` | Rule set for tool/command execution | High-level product description |
| `permission` | Authorization state where a subject can see or use a capability; note: permission concept in code is implicitly implemented via PolicyEngine, no independent Permission type definition | Runtime ownership |
| `secret` | Sensitive secrets such as keys, tokens, credentials | Regular config value |
| `secret masking` | Method for masked display of secrets in logs and displays | Real secret storage |
| `data classification` | Data classification rules such as public/internal/confidential/restricted | Simple label text |
| `audit evidence` | Traceable, verifiable, not easily rebuttable behavioral evidence | Regular log |

## 9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `authoritative store` | Storage that has final interpretation rights for certain types of facts | Any cache |
| `transaction store` | Storage responsible for transactional data such as tasks, state, approval, events. Note: code has no independently named transaction store; transactional data is stored in AuthoritativeSqlDatabase | artifact store |
| `artifact store` | Storage for file-type, large-volume, or export-type products | transaction store |
| `analytics store` | Storage oriented toward projections and materialized views, not independent analytical report storage | authoritative state store |
| `data plane` | (Planned) Unified data plane for transaction layer, artifact, analytics, archive, replay; currently not an abstract layer in code | Single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundary | OS path |
| `eventual consistency` | Allows reaching consistency after a short delay | Strong consistency |
| `reconciliation` | Account verification and repair for state, events, workers, locks, etc. | Regular retry |
| `migration` | Formal version migration of schema or storage structure | Ad-hoc SQL patch |

### 9.1 OAPEFLIR Evolution State Terms

| Term | Definition |
| --- | --- |
| `promotion_status` | LearningObject promotion status; current minimum set is `draft / validated / promoted / retired` |
| `candidate_status` | ImprovementCandidate status; current minimum set is `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | RolloutRecord status; current minimum set is `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| `guardrail_reason_code` | Pass/block reason code given by deterministic guardrail |

## 10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
| --- | --- |
| `config bundle` | A set of configurations that take effect together |
| `config version` | Version identifier after configuration change |
| `feature flag` | Switch controlling capability enable/disable or gradual rollout |
| `prompt bundle` | A group of prompts that are released and versioned together |
| `compatibility window` | Formally supported compatibility range between different runtimes/SDKs/protocols/plugins |
| `promote criteria` | Evidence threshold for a module to be promoted from available to platform-ready/production-ready |
| `readiness registry` | Formal registration surface for recording environment or module readiness status |
| `evidence package` | A set of evidence packages used to support promote/signoff/production-ready judgments |

### 10.1 Prompt/Cache Partition Terminology

| Term | Definition |
| --- | --- |
| `fixed_prefix` | Cross-agent shared system prompt fixed prefix that does not participate in normal compaction by default |
| `domain_block` | Reusable prompt intermediate layer for same domain/profile |
| `variable_suffix` | Prompt suffix that dynamically changes per task, role, plan, memory |
| `KV cache fixed prefix` | Pre-fill cache reuse mechanism based on same prefix hash |

## 11. Testing, Verification, and Stabilization Terminology

| Term | Definition |
| --- | --- |
| `Stable Core` | Minimum capability range deliberately shrunk to achieve stable runnable state first |
| `golden task` | Fixed representative task as version regression baseline |
| `fixture` | Pre-set fixed input/output samples for stable testing |
| `VCR` | Testing mechanism for recording/playback of external LLM calls |
| `unit test` | Fine-grained testing targeting single function, module, or object |
| `integration test` | Cross-module collaboration testing |
| `E2E` | End-to-end testing from entry to result |
| `chaos test` | Testing that actively injects faults to verify recovery and resilience |
| `soak test` | Long-duration continuous stability testing |
| `recovery drill` | Recovery drills for scenarios like crash, disconnect, lock conflict, restart |
| `admission control` | Admission control where the system rejects, delays, or degrades before overload |
| `readiness` | Whether a stage, module, or environment has reached readiness for the next action |

## 12. Observability and Operations Terminology

| Term | Definition |
| --- | --- |
| `structured log` | Structured, searchable log with contextual fields |
| `trace` | Global tracking of a task's execution chain across modules |
| `span` | Single operation segment within a trace |
| `correlation id` | Unified identifier for cross-module correlation of logs/events/requests |
| `healthz` | Minimal health check entry |
| `inspect` | Debug query view for tasks, executions, sessions, workers |
| `backpressure` | Mechanism where the system delays, degrades, or rejects new requests under overload |
| `runbook` | On-duty and fault handling manual |
| `SLO` | Service objective such as success rate, latency, recovery time |
| `SLA` | Service level agreement committed externally |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-duration continuous stability testing (note: currently only implemented as integration test, not a production environment monitoring service) |
| `RCA` | Root cause analysis (note: currently a manual process; no automatic RCA service in code) |
| `RTO` | Recovery Time Objective (note: only referenced in DR verification workflow; no independent tracking service) |
| `RPO` | Acceptable data rollback point objective (note: only referenced in DR verification workflow; no independent tracking service) |

## 13. Channel, Extension, and External Integration Terminology

| Term | Definition |
| --- | --- |
| `channel` | User or system access interface such as CLI, Web, Telegram, API (note: code only implements telegram/slack/webhook; CLI/Web/API are not ChannelGateway channels) |
| `channel capability` | Capabilities supported by a channel such as text, button, stream, attachment (note: code has no corresponding capability enum type definition) |
| `plugin` | Installation unit that extends platform capabilities through public SDK or controlled boundaries |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | External capability access protocol/extension type (MCP tools are verified via mcp-tool-guard, but not defined as PluginSpiType) |
| `recipe` / `template` | Structured workflow or template definition that can be used as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata for a model's capabilities, limitations, pricing, default parameters, etc. |

## 14. Protocol, Model, and Security Abbreviations

| Term | Definition |
| --- | --- |
| `ADR` | Architecture Decision Record |
| `API` | Application Programming Interface, referring to formal external or inter-module interface surface |
| `SDK` | Software Development Kit, usually derived from authoritative schema or protocol |
| `DSL` | Domain-Specific Language, such as workflow DSL |
| `DDL` | Data Definition Language, commonly referring to table creation, index, constraint migration statements |
| `WAL` | Write-Ahead Logging, SQLite/database pre-write logging mode |
| `MCP` | Model Context Protocol or external capability access protocol type in this system |
| `HITL` | Human In The Loop, decision环节 requiring human participation |
| `PII` | Personally Identifiable Information |
| `TTL` | Time To Live, validity duration of data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage, used to承接 unable-to-continue messages or tasks |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect, used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | System for Cross-domain Identity Management, user and organization identity sync protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When an abbreviation first appears in main documents, it is recommended to provide at least the full name or Chinese explanation once.
- Abbreviations must not replace formal definitions of object boundaries in authoritative contracts.

## 15. Easily Confused Term Pairs

### 15.1 `task` vs `session`

- `task` is a business work unit
- `session` is an interaction session
- One session can trigger multiple tasks
- One task may also update state across multiple sessions

### 15.2 `workflow` vs `execution`

- `workflow` is the structure
- `execution` is a specific runtime attempt
- Same workflow can correspond to multiple execution attempts

### 15.3 `agent` vs `worker`

- `agent` emphasizes responsibility and intelligent entity
- `worker` emphasizes execution carrying and resource position
- `sub-agent` is not a synonym for remote worker

### 15.4 `artifact` vs `output` vs `step output`

- `artifact` emphasizes file products
- `output` emphasizes result semantics
- `step output` emphasizes step-level structured snapshot

### 15.5 `permission` vs `policy`

- `permission` is the authorization result or static capability boundary
- `policy` is the ruling logic and rule system
- Descriptive limitations in prompts should not be written as formal policy

### 15.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, they should not replace each other

### 15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching a certain gate or readiness for next action
- `production-ready` indicates reaching comprehensive threshold for production backing
- `Phase 1a ready` must not be misinterpreted as `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion for current revision
- `completion gate` is a threshold check that must be re-executed before entering coding
- One signoff conclusion should not be written as a permanent pass

### 15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by provider
- `model profile` is model metadata, not equal to provider profile

## 16. Naming Principles

- External narrative can keep CEO / VP / Lead.
- Internal implementation prioritizes neutral engineering terms such as `router`, `planner`, `orchestrator`, `supervisor`.
- If both narrative and engineering terms appear in one document, explicitly map them one-to-one.
- Schemas, events, configuration, directories, and table names use canonical engineering names by default.

## 17. Recommended Naming Formats

| Object | Recommended Format | Example |
| --- | --- | --- |
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` or stable `snake_case`, consistent throughout | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | Plural `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | Namespace + stable key | `runtime.max_concurrency` |
| feature flag | Domain prefix + feature name | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type name + `camelCase` field name | `TurnStartParams` |

## 18. Prohibited Writing

- Do not use `CEO / VP / Lead` directly in schema enums
- Do not use `session` as a substitute name for `task`
- Do not use `worker` as the only implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as authoritative state machine
- Do not write descriptive limitations in prompts as "already existing code-level policy"
- Do not write `ready` directly as a synonym for `production-ready`
- Do not write one `signoff` conclusion as a permanently valid state
- Do not use abbreviations as the sole explanation, causing readers to be unable to return to formal definitions
- Do not merge `provider`, `model`, and `profile` three levels into one object

## 19. Closure Conclusion

The goal of terminology unification is not to remove product expression, but to avoid semantic drift during engineering implementation.

From now on:

- Narrative names are acceptable when discussing architecture
- When writing contracts, schemas, events, configuration, and code, canonical engineering names must be prioritized
- When ambiguity arises, should prioritize returning to this glossary and corresponding authoritative contract for closure
