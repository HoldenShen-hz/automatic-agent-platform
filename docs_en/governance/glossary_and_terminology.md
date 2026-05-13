# Glossary And Terminology

## 1. Objective

Unify core terminology to avoid confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This file answers 4 questions:

- What does a particular term mean in this system?
- Which terms are easily confused, and how should they be distinguished?
- Which writing styles are recommended?
- Which writing styles should be avoided in contracts, protocols, configurations, and code?

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. Usage Rules

- This glossary is the master version at the governance layer.
- If main documents, contracts, ADRs, or guides conflict with this glossary, the authoritative contract for the corresponding topic takes precedence, and this glossary should subsequently be updated.
- If a term has both a product alias and an engineering name, the engineering canonical name takes priority by default.
- Aliases that are only suitable for product narratives must not be used in protocols, schemas, events, configurations, directories, or table names.

## 3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `task` | User-level work unit, the smallest work commitment object the system presents to users and business | `session`, `execution` |
| `workflow` | Structured execution path of a task, defining steps, dependencies, inputs/outputs, and failure paths | `task`, `execution` |
| `step` | Single execution step in a workflow | `task`, `tool call` |
| `execution` | A specific runtime attempt of a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count/re-entry sequence for the same execution or step | `execution` |
| `session` | Channel interaction session, carrying user input, streaming output, and interaction context | `task` |
| `message` | A complete message object, may contain multiple `message parts` | `event` |
| `message part` | Structured fragment within a message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File-type or binary product, usually managed through artifact store | `output`, `step output` |
| `output` | Result oriented toward upstream steps or users, can be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result encapsulation of success, partial success, failure, warning, artifact, and metrics | single tool result |

## 3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` eight-stage closed loop | ordinary workflow name |
| `stage` | Stage-level state unit in the OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of a complete or partial closed-loop iteration | single tool call |
| `TaskSituation` | Fact snapshot output from Observe | final assessment result |
| `UnifiedAssessment` | Structured judgment output from Assess | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | ordinary log |
| `LearningObject` | Reusable learning object produced by Learn Hub | single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | published policy |
| `RolloutRecord` | Controlled release record in Release stage | `ImprovementCandidate` |

## 4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `runtime` | The layer where the system actually executes task/workflow/agent/tool | `platform` |
| `execution ticket` | Formal execution document issued by the scheduling layer to the execution layer | ordinary task input |
| `lease` | Temporary ownership of an execution or worker dispatch | permanent ownership |
| `lease owner` | Execution entity currently holding execution rights | physical machine identifier of `worker` |
| `fencing token` | Version token to prevent old executors from writing dirty results | ordinary sequence |
| `dispatch` | Assigning a task or execution rights to an execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit, can be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating in the same task context | `worker` |
| `heartbeat` | Periodic health/load reporting | real business progress |
| `stalled` | Process may not be dead, but no effective progress within specified time | `offline` |
| `dead-letter` | Dead-letter record for failures that cannot be auto-recovered or should not continue retrying | ordinary error log |
| `checkpoint` | State snapshot at recoverable boundary | arbitrary temporary variable |
| `partial result` | Task not yet entirely completed, but has retainable and auditable phased results | `completed` |
| `compensation` | Action to roll back, reconcile, or manually repair steps that have already occurred side effects | ordinary retry |

## 5. State and Lifecycle Terminology

### 5.1 General Lifecycle Terms

| Term | Definition | Applicable Object |
| --- | --- | --- |
| `pending` | Task pre-execution state, created but not yet entered scheduling | Task |
| `awaiting_decision` | Task waiting for approval, waiting for approval decision | Task |
| `prechecking` | Execution pre-validation phase, pre-execution validation phase | Execution |
| `created` | Execution created state, Execution has been created | Execution |
| `queued` | Created but not yet started execution | Task, Execution |
| `in_progress` | Main logic being advanced (Task state) | Task |
| `executing` | Main logic being advanced (Execution state) | Execution |
| `blocked` | Temporarily unable to continue due to unmet dependencies, approvals, policies, or resources | Execution |
| `paused` | Explicitly paused, resumable | Workflow |
| `resuming` | Workflow transition state for resuming from pause, transition state from pause to resume | Workflow |
| `cancelling` | Workflow transient state before cancelled, transient state before termination | Workflow |
| `streaming` | Session streaming state, session in streaming output | Session |
| `open` | Session open state, session in open state | Session |
| `awaiting_user` | Waiting for human or external system input (Session state) | Session |
| `superseded` | Execution replaced by newer Execution | Execution |
| `failed` | Execution failed and current attempt terminated | Task, Execution |
| `done` | Task terminal state, Task ended successfully | Task |
| `cancelled` | Explicitly terminated, will not continue | Task, Workflow |

### 5.2 States That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` applies only to Execution; Task uses `awaiting_decision` for waiting for approval; Workflow uses `paused` for pause
- `paused` is not `awaiting_user`
- `paused` is not `blocked`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `done` is Task's only terminal success state, not equal to "all downstream processing complete", refer to authoritative state machine definition

### 5.3 Termination Reason Terminology

> **Implementation Note:** `reasonCode` in `ExecutionRecord.lastErrorCode` and `DeadLetterRecord.finalReasonCode` fields are **freeform strings**, not enums. The system does not enforce standardized code tables; callers can write any business-meaningful string.

| Term | Definition | Type |
| --- | --- | --- |
| `reasonCode` | Termination reason code, recorded as string in `ExecutionRecord.lastErrorCode` / `DeadLetterRecord.finalReasonCode` | freeform string (not enum) |
| `termination_initiator` | Entity that triggered termination, such as user/system/policy/admin | semantic label, no formal enum |
| `termination_scope` | Termination impact scope, such as step/workflow/task/session | semantic label, no formal enum |
| `recoverable` | Whether recovery path is allowed after termination | boolean semantics |

## 6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `event` | Structured factual notification within the system | `message` |
| `event type` | Event category, recommended `<domain>.<action>` | DB table name |
| `tier 1 event` | Must be reliably persisted, must be recoverable, must not be silently lost | ordinary UI event |
| `ack` | Record that a consumer has acknowledged handling an event; each consumer acknowledges independently, different consumers can ack the same event separately | global consumed flag |
| `replay` | Re-sending events from memory buffer; persistent events fetched via deliverPending() | live stream |
| `stream` | Incremental output stream for channels/UI | authoritative event log |
| `stream_id` | Unique identifier for a display stream, format `${channel}_${taskId}_${randomId}`, contains taskId as component | stream_id contains taskId component, should not be simply equated to task_id |
| `sequence` | Monotonic sequence number for the same stream or same event channel | fencing token |
| `Last-Event-ID` | Breakpoint resumption position declared by SSE client | global offset |
| `replay buffer` | Limited event window reserved for short disconnection recovery | persistent event storage |
| `viewer_only` | Read-only observation of interaction state | business failure state |

## 7. Organization and Role Terminology

### 7.1 Control Layer Canonical Mapping

Control layer roles use "canonical id + business alias" format uniformly in documents.

**Implementation status note**: Only `intake_router` and `workflow_planner` have actual code implementations; `strategic_governor` and `division_lead` are document definitions but not implemented as independent services in code.

| Canonical ID | Business Alias | Engineering Responsibility |
| --- | --- | --- |
| `strategic_governor` | CEO | Strategic judgment, escalation governance, organization-level approval (note: document definition, not implemented as independent service in code) |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division splitting, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | In-division workflow autonomous orchestration (note: document definition, not implemented as independent service in code) |

Recommended writing:

- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)

Not recommended:

- Writing only `VP Orchestration`
- Using CEO/VP/Lead directly as primary keys in protocols and schemas

### 7.2 Other Organization Terms

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition, not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity that assumes role responsibilities | `worker` |
| `organization` | Enterprise/organization-level boundary | `division` |
| `workspace` | Workspace boundary under an organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

## 8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `policy engine` | Code-level entry point for final ruling on permissions, risk, approval, budget, and runtime constraints | prompt directive |
| `approval` / `HITL` | Decision step requiring explicit human participation | ordinary user reply |
| `break-glass` | High-risk emergency release config marker; critical risk triggers break-glass approval type, but no independent strong audit workflow from standard approval | ordinary approval |
| `sandbox` | Execution isolation boundary | ordinary permission prompt |
| `exec policy` | Rule set for tool/command execution | high-level product description |
| `permission` | Authorization state where a subject can see or use a capability; note: permission concept in code is implicitly implemented through PolicyEngine, no independent Permission type definition | runtime ownership |
| `secret` | Sensitive credentials such as keys, tokens, credentials | ordinary config value |
| `secret masking` | Method for masked display of secrets | real secret storage |
| `data classification` | Data classification rules, such as public/internal/confidential/restricted | simple label text |
| `audit evidence` | Traceable, verifiable, not easily disavowable behavioral evidence | ordinary log |

## 9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `authoritative store` | Storage that has final interpretation rights for a certain type of fact | arbitrary cache |
| `transaction store` | Storage responsible for transactional data such as tasks, states, approvals, events. Note: there is no independently named transaction store in code; transactional data is stored in AuthoritativeSqlDatabase | artifact store |
| `artifact store` | Storage for file-type, large-volume, or export-type products | transaction store |
| `analytics store` | Storage oriented toward projections and materialized views, not independent analytical reporting storage | authoritative state store |
| `data plane` | (Planned) Unified data plane for transaction layer, artifact, analytics, archive, replay; this abstraction layer does not exist in current code | single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundaries | OS path |
| `eventual consistency` | Allows reaching consistency after a short delay | strong consistency |
| `reconciliation` | Reconciliation and repair of states, events, workers, locks, etc. | ordinary retry |
| `migration` | Formal version migration of schema or storage structure | ad-hoc SQL patch |

### 9.1 OAPEFLIR Evolution State Terms

| Term | Definition |
| --- | --- |
| `promotion_status` | Promotion status of LearningObject; current minimum set is `draft / validated / promoted / retired` |
| `candidate_status` | Status of ImprovementCandidate; current minimum set is `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | Status of RolloutRecord; current minimum set is `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| `guardrail_reason_code` | Pass/block reason code given by deterministic guardrail |

## 10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
| --- | --- |
| `config bundle` | A set of configurations that take effect together |
| `config version` | Version identifier after configuration change |
| `feature flag` | Switch controlling capability enable/disable or gradual rollout |
| `prompt bundle` | A set of prompts that are released and versioned together |
| `compatibility window` | Formally supported compatibility interval between different runtimes/SDKs/protocols/plugins |
| `promote criteria` | Evidence threshold for a module to move from available to platform-ready/production-ready |
| `readiness registry` | Formal registration surface for recording environment or module readiness state |
| `evidence package` | A set of evidence used to support promote/signoff/production-ready judgments |

### 10.1 Prompt/Cache Partition Terminology

| Term | Definition |
| --- | --- |
| `fixed_prefix` | System prompt fixed prefix shared across agents, not participating in ordinary compaction by default |
| `domain_block` | Reusable prompt intermediate layer for same domain/profile |
| `variable_suffix` | Prompt suffix that varies dynamically by task, role, plan, memory |
| `KV cache fixed prefix` | Pre-fill cache reuse mechanism based on same prefix hash |

## 11. Testing, Validation, and Stabilization Terminology

| Term | Definition |
| --- | --- |
| `Stable Core` | Deliberately contracted minimum capability range to first achieve stable operation |
| `golden task` | Fixed representative task used as version regression baseline |
| `fixture` | Pre-set fixed input/output samples for stable testing |
| `VCR` | Testing mechanism for recording/replaying external calls |
| `unit test` | Fine-grained testing oriented toward single functions, single modules, single objects |
| `integration test` | Testing of cross-module collaboration |
| `E2E` | End-to-end testing from entry to result |
| `chaos test` | Testing that actively injects faults to verify recovery and resilience |
| `soak test` | Long-duration continuous stability testing |
| `recovery drill` | Recovery drills for scenarios such as crash, disconnection, lock conflict, restart |
| `admission control` | Admission control where system rejects, delays, or degrades before overload |
| `readiness` | Whether a stage, module, or environment has reached readiness to enter the next action |

## 12. Observability and Operations Terminology

| Term | Definition |
| --- | --- |
| `structured log` | Structured, searchable logs with contextual fields |
| `trace` | Global tracking of a task's cross-module execution chain |
| `span` | Single operation segment in a trace |
| `correlation id` | Unified identifier used for cross-module correlation of logs/events/requests |
| `healthz` | Minimum health check entry |
| `inspect` | Debugging query view oriented toward tasks, executions, sessions, workers |
| `backpressure` | Mechanism where system delays, degrades, or rejects new requests under overload |
| `runbook` | On-duty and troubleshooting manual |
| `SLO` | Service target, such as success rate, latency, recovery time |
| `SLA` | Service level agreement committed externally |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-duration continuous stability testing (note: currently only implemented as integration test, not a production environment monitoring service) |
| `RCA` | Root cause analysis (note: currently a manual process; no automatic RCA service in code) |
| `RTO` | Recovery Time Objective (note: only referenced in DR validation workflow, no independent tracking service) |
| `RPO` | Recovery Point Objective (note: only referenced in DR validation workflow, no independent tracking service) |

## 13. Channel, Extension, and External Integration Terminology

| Term | Definition |
| --- | --- |
| `channel` | User or system access interface, such as CLI, Web, Telegram, API (note: only telegram/slack/webhook implemented in code; CLI/Web/API are not ChannelGateway channels) |
| `channel capability` | Capabilities supported by a channel, such as text, button, stream, attachment (note: no corresponding capability enum type definition in code) |
| `plugin` | Installation unit that extends platform capabilities through public SDK or controlled boundaries |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | One of the external capability access protocols/extension types (MCP tools are validated via mcp-tool-guard, but not defined as PluginSpiType) |
| `recipe` / `template` | Structured workflow or template definition, can be used as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata such as capabilities, limitations, pricing, default parameters of a model |

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
| `TTL` | Time To Live, valid duration of data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage, used to receive messages or tasks that cannot continue processing |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect, used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | User and organization identity synchronization protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When abbreviations first appear in main documents, it is recommended to provide the full name or Chinese explanation at least once.
- Abbreviations must not replace the formal definition of object boundaries in authoritative contracts.

## 15. Easily Confused Term Pairs

### 15.1 `task` vs `session`

- `task` is a business work unit
- `session` is an interaction session
- One session can trigger multiple tasks
- One task may also update state across multiple sessions

### 15.2 `workflow` vs `execution`

- `workflow` is the structure
- `execution` is a runtime attempt
- The same workflow can correspond to multiple execution attempts

### 15.3 `agent` vs `worker`

- `agent` leans toward responsibility and intelligent entity
- `worker` leans toward execution carrier and resource slot
- `sub-agent` is not a synonym for remote worker

### 15.4 `artifact` vs `output` vs `step output`

- `artifact` leans toward file products
- `output` leans toward result semantics
- `step output` leans toward step-level structured snapshot

### 15.5 `permission` vs `policy`

- `permission` is the authorization result or static capability boundary
- `policy` is the ruling logic and rule system
- Verbal limitations in prompts should not be treated as formal policy

### 15.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, they should not replace each other

### 15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching readiness for a certain gate or next action
- `production-ready` indicates reaching the comprehensive threshold required for production backing
- `Phase 1a ready` must not be misinterpreted as `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion for the current revision
- `completion gate` is a threshold check that must be re-executed before entering coding
- One signoff conclusion should not be treated as a permanent pass

### 15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by a provider
- `model profile` is model metadata, not equal to provider profile

## 16. Naming Principles

- External narratives can retain CEO/VP/Lead.
- Internal implementations prefer neutral engineering terms such as `router`, `planner`, `orchestrator`, `supervisor`.
- If narrative names and engineering names both appear in one document, explicit one-to-one mappings must be provided.
- Schemas, events, configurations, directories, and table names use canonical engineering names by default.

## 17. Recommended Naming Formats

| Object | Recommended Format | Example |
| --- | --- | --- |
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` or stable `snake_case`, keep consistent throughout | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | plural `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | namespace + stable key | `runtime.max_concurrency` |
| feature flag | domain prefix + feature name | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type name + `camelCase` field name | `TurnStartParams` |

## 18. Prohibited Writing

- Do not directly use `CEO/VP/Lead` in schema enums
- Do not use `session` as a substitute name for `task`
- Do not use `worker` as the only implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as the authoritative state machine
- Do not write descriptive limitations in prompts as "already existing code-level policy"
- Do not write `ready` directly as a synonym for `production-ready`
- Do not write one `signoff` conclusion as a permanently valid state
- Do not use abbreviations as the sole explanation, causing readers to be unable to return to formal definitions
- Do not mix the three levels of `provider`, `model`, and `profile` into one object

## 19. Conclusion

The goal of terminology unification is not to remove product expression, but to avoid semantic drift during engineering implementation.

From now on:

- Narrative names can exist when discussing architecture
- When writing contracts, schemas, events, configurations, and code, canonical engineering names must be used preferentially
- When ambiguity arises, return to this glossary and the corresponding authoritative contract for resolution