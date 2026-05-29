# Glossary And Terminology

##1. Objective

Unify core terminology, avoiding confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This document answers4 questions:

- What does a specific term mean in this system
- Which terms are easily confused and how they should be distinguished
- Which usages are recommended
- Which usages should be avoided in contracts, protocols, configurations, and code

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

##2. Usage Rules

- This glossary is the master terminology version at the governance layer.
- If mainline documents, contracts, ADRs, or guides conflict with this glossary, the authoritative contract for the corresponding topic prevails, and this glossary should be updated subsequently.
- If a term has both a product alias and an engineering name, the engineering canonical name is preferred by default.
- Aliases suited only for product narrative must not be used in protocols, schemas, events, configurations, directories, or table names.

##3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `task` | User-level work unit; the smallest work commitment object the system exposes to users and business | `session`, `execution` |
| `workflow` | Structured execution path of a task, defining steps, dependencies, inputs/outputs, and failure paths | `task`, `execution` |
| `step` | A single execution step within a workflow | `task`, `tool call` |
| `execution` | A specific run attempt of a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count / re-entry sequence number for the same execution or step | `execution` |
| `session` | Channel interaction session, carrying user input, streaming output, and interaction context | `task` |
| `message` | A complete message object, may contain multiple `message parts` | `event` |
| `message part` | Structured fragment within a message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File or binary product, typically managed via artifact store | `output`, `step output` |
| `output` | Result oriented to upstream step or user, may be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result wrapper for success, partial success, failure, warning, artifact, and metrics | Single tool result |

##3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `OAPEFLIR` | Eight-stage closed loop: `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` | Ordinary workflow name |
| `stage` | Stage-level state unit within the OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of one complete or partial closed-loop iteration | Single tool call |
| `TaskSituation` | Factual snapshot output by Observe | Final assessment result |
| `UnifiedAssessment` | Structured judgment output by Assess | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | Workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | Ordinary log |
| `LearningObject` | Reusable learning object produced by Learn Hub | Single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | Released policy |
| `RolloutRecord` | Controlled release record in the Release stage | `ImprovementCandidate` |

##4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `runtime` | Layer where the system actually executes task / workflow / agent / tool | `platform` |
| `execution ticket` | Formal execution document issued by scheduler to execution layer | Ordinary task input |
| `lease` | Temporary ownership of an execution or worker dispatch | Permanent ownership |
| `lease owner` | Execution entity currently holding execution rights | `worker`'s physical machine identifier |
| `fencing token` | Version token preventing stale execution from writing back dirty results | Ordinary sequence |
| `dispatch` | Assigning task or execution rights to an execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit, may be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating within the same task context | `worker` |
| `heartbeat` | Periodic health/load report | Real business progress |
| `stalled` | Process not necessarily dead but no effective progress within specified time | `offline` |
| `dead-letter` | Failure landing record that cannot be automatically recovered or should not be retried | Ordinary error log |
| `checkpoint` | State snapshot at a recoverable boundary | Arbitrary temporary variable |
| `partial result` | Task not yet fully complete but has preservable, auditable stage results | `completed` |
| `compensation` | Action to roll back, reconcile, or manually repair steps with side effects already occurred | Ordinary retry |

##5. Status and Lifecycle Terminology

###5.1 Common Lifecycle Terms

| Term | Definition | Applicable Object |
| --- | --- | --- |
| `pending` | Task pre-execution state, created but not yet scheduled | Task |
| `awaiting_decision` | Task waiting for approval decision | Task |
| `prechecking` | Execution pre-validation phase | Execution |
| `created` | Execution created state | Execution |
| `queued` | Created but not yet started executing | Task, Execution |
| `in_progress` | Pushing main logic forward (Task state) | Task |
| `executing` | Pushing main logic forward (Execution state) | Execution |
| `blocked` | Temporarily cannot continue due to unsatisfied dependencies, approval, policy, or resources | Execution |
| `paused` | Explicitly paused, can be resumed | Workflow |
| `resuming` | Workflow transition state for resuming from pause | Workflow |
| `cancelling` | Workflow transient state before cancelled | Workflow |
| `streaming` | Session streaming output in progress | Session |
| `open` | Session open state | Session |
| `awaiting_user` | Awaiting human or external system input (Session state) | Session |
| `superseded` | Execution replaced by newer execution | Execution |
| `failed` | Execution failed and current attempt terminated | Task, Execution |
| `done` | Task terminal state, Task successfully ended | Task |
| `cancelled` | Explicitly terminated, no longer continues | Task, Workflow |

###5.2 Status Terms That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` only applies to Execution; Task uses `awaiting_decision` to indicate waiting for approval; Workflow uses `paused` to indicate pause
- `paused` is not `awaiting_user`
- `paused` is not `blocked`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `done` is the only terminal success state for Task; it does not equal "all downstream has been processed", and should defer to the authoritative state machine definition

###5.3 Termination Reason Terminology

> **Implementation Note:** `reasonCode` in `ExecutionRecord.lastErrorCode` and `DeadLetterRecord.finalReasonCode` fields is a **freeform string**, not an enum. The system does not enforce a standardized code table; callers may write any string with business meaning.

| Term | Definition | Type |
| --- | --- | --- |
| `reasonCode` | Termination reason code, recorded as string in `ExecutionRecord.lastErrorCode` / `DeadLetterRecord.finalReasonCode` | freeform string (not enum) |
| `termination_initiator` | Subject triggering termination, such as user / system / policy / admin | Semantic label, no formal enum |
| `termination_scope` | Termination impact scope, such as step / workflow / task / session | Semantic label, no formal enum |
| `recoverable` | Whether recovery path is allowed after termination | boolean semantic |

##6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `event` | Structured fact notification within the system | `message` |
| `event type` | Event category, recommended `<domain>.<action>` | DB table name |
| `tier1 event` | Event that must be reliably persisted, recoverable, and cannot be silently lost | Ordinary UI event |
| `ack` | Record that a consumer has confirmed processing of an event; each consumer confirms independently, different consumers may ack the same event separately | Global consumed flag |
| `replay` | Resending events from in-memory buffer; persistent events are pulled via deliverPending() | live stream |
| `stream` | Incremental output stream oriented to channel/UI | authoritative event log |
| `stream_id` | Unique identifier of a display stream, format `${channel}_${taskId}_${randomId}`, contains taskId as a component | stream_id contains taskId component, not simply equivalent to task_id |
| `sequence` | Monotonic sequence number within the same stream or event channel | fencing token |
| `Last-Event-ID` | Resume position declared by SSE client | Global offset |
| `replay buffer` | Limited event window reserved for short disconnection recovery | Persistent event storage |
| `viewer_only` | Read-only observation interaction state | Business failure state |

##7. Organization and Role Terminology

###7.1 Control Layer Canonical Mapping

Control layer roles uniformly use the "canonical id + business alias" format in documents.

**Implementation Status Note**: Only `intake_router` and `workflow_planner` have actual code implementations; `strategic_governor` and `division_lead` are documented but not implemented as independent services.

| Canonical ID | Business Alias | Engineering Responsibility |
| --- | --- | --- |
| `strategic_governor` | CEO | Strategic judgment, escalation governance, organization-level approval (Note: documented but not implemented as independent service in code) |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division decomposition, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | Division-internal workflow autonomous orchestration (Note: documented but not implemented as independent service in code) |

Recommended format:

- `intake_router` (Business alias: VP Operations)
- `workflow_planner` (Business alias: VP Orchestration)

Not recommended format:

- Only writing `VP Orchestration`
- Using `CEO / VP / Lead` directly as primary key in protocols and schemas

###7.2 Other Organization Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition, not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity that takes on role responsibilities | `worker` |
| `organization` | Enterprise/organization-level boundary | `division` |
| `workspace` | Workspace boundary under an organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

##8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `policy engine` | Code-level entry point that makes final decisions on permissions, risks, approvals, budgets, and runtime constraints | prompt instructions |
| `approval` / `HITL` | Decision step requiring explicit human participation | General user reply |
| `break-glass` | High-risk emergency release configuration marker; critical risk triggers break-glass approval type, but has no independent strong audit workflow separate from standard approval | Ordinary approval |
| `sandbox` | Execution isolation boundary | Ordinary permission prompt |
| `exec policy` | Rule set for tool/command execution | High-level product description |
| `permission` | Authorization status of whether a subject can see or use a capability; Note: permission concept is implicitly implemented through PolicyEngine in code, no independent Permission type definition | runtime ownership |
| `secret` | Sensitive secrets such as keys, tokens, credentials | Ordinary config value |
| `secret masking` | Method of masking secrets for display | Real secret storage |
| `data classification` | Data classification rules, such as public/internal/confidential/restricted | Pure label text |
| `audit evidence` | Traceable, verifiable, non-repudiable behavior evidence | Ordinary logs |

##9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `authoritative store` | Storage with final interpretive authority over a type of fact | Arbitrary cache |
| `transaction store` | Storage responsible for transactional data such as tasks, states, approvals, events. Note: there is no independently named transaction store in code; transactional data is stored in AuthoritativeSqlDatabase | artifact store |
| `artifact store` | Storage for file-type, large-volume, or export-type products | transaction store |
| `analytics store` | Storage for projections and materialized views, not an independent analytical reporting store | authoritative state store |
| `data plane` | (Planned) Unified data plane for transaction layer, artifact, analytics, archive, replay; no abstraction layer in current code | Single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundary | OS path |
| `eventual consistency` | Allowed to reach consistency after brief delay | Strong consistency |
| `reconciliation` | Reconciling and repairing states, events, workers, locks | Ordinary retry |
| `migration` | Formal version migration of schema or storage structure | ad-hoc SQL patch |

###9.1 OAPEFLIR Evolution Status Terms

| Term | Definition |
| --- | --- |
| `promotion_status` | LearningObject promotion status, current minimum set is `draft / validated / promoted / retired` |
| `candidate_status` | ImprovementCandidate status, current minimum set is `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | RolloutRecord status, current minimum set is `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| `guardrail_reason_code` | Pass/block reason code from deterministic guardrail |

##10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
| --- | --- |
| `config bundle` | Set of configurations that take effect together |
| `config version` | Version identifier after configuration changes |
| `feature flag` | Switch controlling capability on/off or grayscale |
| `prompt bundle` | Set of prompts released and versioned together |
| `compatibility window` | Formally supported compatibility interval between different runtimes / SDKs / protocols / plugins |
| `promote criteria` | Evidence threshold for promoting a module from available to platform-ready / production-ready |
| `readiness registry` | Formal registry surface recording environment or module readiness status |
| `evidence package` | Set of evidence packages used to support promote / signoff / production-ready judgments |

###10.1 Prompt / Cache Partitioning Terminology

| Term | Definition |
| --- | --- |
| `fixed_prefix` | Fixed prefix of system prompt shared across agents, by default not participating in ordinary compaction |
| `domain_block` | Reusable prompt middle layer for same domain / profile |
| `variable_suffix` | Prompt suffix that dynamically changes by task, role, plan, memory |
| `KV cache fixed prefix` | Prefill cache reuse mechanism based on same prefix hash |

##11. Testing, Validation, and Stabilization Terminology

| Term | Definition |
| --- | --- |
| `Stable Core` | Minimum capability range deliberately contracted to first achieve stable operation |
| `golden task` | Fixed representative task serving as version regression baseline |
| `fixture` | Pre-set fixed input/output samples for stable testing |
| `VCR` | Test mechanism for recording/replaying external calls |
| `unit test` | Fine-grained testing for single function, single module, single object |
| `integration test` | Testing across modules |
| `E2E` | End-to-end testing from entry to result |
| `chaos test` | Testing that actively injects faults to verify recovery and resilience |
| `soak test` | Stability testing with long-duration continuous operation |
| `recovery drill` | Recovery rehearsal for crashes, disconnections, lock conflicts, restarts, etc. |
| `admission control` | Mechanism for system to reject, delay, or degrade before overload |
| `readiness` | Whether a stage, module, or environment has reached readiness for the next action |

##12. Observability and Operations Terminology

| Term | Definition |
| --- | --- |
| `structured log` | Structured, searchable logs with context fields |
| `trace` | Global trace of a task's cross-module execution chain |
| `span` | Single operation segment in a trace |
| `correlation id` | Unified identifier for cross-module correlation of logs/events/requests |
| `healthz` | Minimum health check entry |
| `inspect` | Debug query view oriented to task, execution, session, worker |
| `backpressure` | Mechanism for system to delay, degrade, or reject new requests during overload |
| `runbook` | On-duty and incident handling manual |
| `SLO` | Service objective, such as success rate, latency, recovery time |
| `SLA` | External service level commitment agreement |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-duration continuous stability testing (Note: currently only implemented as integration test, not a production environment monitoring service) |
| `RCA` | Incident root cause analysis (Note: currently manual process, no automatic RCA service in code) |
| `RTO` | Recovery Time Objective (Note: only referenced in DR verification workflow, no independent tracking service) |
| `RPO` | Acceptable data rollback point objective (Note: only referenced in DR verification workflow, no independent tracking service) |

##13. Channel, Extension, and External Integration Terminology

| Term | Definition |
| --- | --- |
| `channel` | User or system access interface, such as CLI, Web, Telegram, API (Note: only telegram/slack/webhook are implemented in code; CLI/Web/API are not ChannelGateway channels) |
| `channel capability` | Capabilities supported by a channel, such as text, button, stream, attachment (Note: no corresponding capability enum type definition in code) |
| `plugin` | Installation unit that extends platform capabilities via public SDK or controlled boundary |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | External capability access protocol / extension type (MCP tools are validated via mcp-tool-guard but not defined as PluginSpiType) |
| `recipe` / `template` | Structured workflow or template definition, usable as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata about a model's capabilities, limitations, pricing, default parameters |

##14. Protocol, Model, and Security Abbreviations

| Term | Definition |
| --- | --- |
| `ADR` | Architecture Decision Record |
| `API` | Application Programming Interface, formal external or inter-module interface surface |
| `SDK` | Software Development Kit, typically derived from authoritative schema or protocol |
| `DSL` | Domain-Specific Language, such as workflow DSL |
| `DDL` | Data Definition Language, typically refers to table creation, index, constraint migration statements |
| `WAL` | Write-Ahead Logging, SQLite/database's pre-write log mode |
| `MCP` | Model Context Protocol or external capability access protocol type in this system |
| `HITL` | Human In The Loop, decision steps requiring human participation |
| `PII` | Personally Identifiable Information |
| `TTL` | Time To Live, validity duration of data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage, used to receive messages or tasks that cannot continue processing |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect, used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | User and organization identity synchronization protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When abbreviations first appear in mainline documents, it is recommended to give at least one full name or Chinese definition.
- Abbreviations must not replace the formal definitions of object boundaries in authoritative contracts.

##15. Easily Confused Term Pairs

###15.1 `task` vs `session`

- `task` is a business work unit
- `session` is an interaction session
- One session can trigger multiple tasks
- One task may also update state across multiple sessions

###15.2 `workflow` vs `execution`

- `workflow` is structure
- `execution` is a run attempt
- The same workflow can correspond to multiple execution attempts

###15.3 `agent` vs `worker`

- `agent` leans toward responsibility and intelligent entity
- `worker` leans toward execution carrier and resource position
- `sub-agent` is not synonymous with remote worker

###15.4 `artifact` vs `output` vs `step output`

- `artifact` leans toward file product
- `output` leans toward result semantics
- `step output` leans toward step-level structured snapshot

###15.5 `permission` vs `policy`

- `permission` is authorization result or static capability boundary
- `policy` is decision logic and rule system
- Verbal restrictions in prompts should not be treated as formal policy

###15.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, they should not substitute for each other

###15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching the preparation for a gate or next action
- `production-ready` indicates reaching the comprehensive threshold for production backing
- `Phase1a ready` must not be misread as `production-ready`

###15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion of the current revision
- `completion gate` is the threshold check that must be performed again before entering coding
- A signoff conclusion should not be treated as a permanent pass

###15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by provider
- `model profile` is model metadata, not equal to provider profile

##16. Naming Principles

- External narrative may retain CEO / VP / Lead.
- Internal implementation prefers neutral engineering terms, such as `router`, `planner`, `orchestrator`, `supervisor`.
- If a document contains both narrative names and engineering names, a one-to-one mapping should be made explicit.
- Schemas, events, configurations, directories, table names default to canonical engineering names.

##17. Recommended Naming Formats

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

##18. Prohibited Usages

- Do not use `CEO / VP / Lead` directly in schema enum
- Do not use `session` as a substitute for `task`
- Do not use `worker` as the only implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as authoritative state machine
- Do not write descriptive restrictions in prompts as "existing code-level policy"
- Do not write `ready` as synonymous with `production-ready`
- Do not write a single `signoff` conclusion as a permanently valid state
- Do not use abbreviations as the sole explanation, causing readers unable to return to formal definitions
- Do not mix `provider`, `model`, `profile` three levels into one object

##19. Conclusion

The goal of terminology unification is not to remove product expression, but to avoid semantic drift during engineering implementation.

From now on:

- When discussing architecture, narrative names are allowed
- When writing contracts, schemas, events, configurations, and code, canonical engineering names must be used preferentially
- When ambiguity arises, defer to this glossary and the corresponding authoritative contract
