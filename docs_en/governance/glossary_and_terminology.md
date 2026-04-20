# Glossary And Terminology

## 1. Goal

Unify core terminology, avoid confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This document answers 4 questions:

- What does a certain word mean in this system
- Which words are easily confused, how should they be distinguished
- Which writing styles are recommended
- Which writing styles should be avoided in contracts, protocols, configurations, and code

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. Usage Rules

- This glossary is the governance layer's terminology master version.
- If main documents, contracts, ADR, and guides conflict with this glossary, authoritative contract for corresponding topic takes precedence, and should subsequently fill back this glossary.
- If a term simultaneously has product alias and engineering name, engineering canonical name is prioritized by default.
- Protocols, schemas, events, configurations, directories, and table names must not use aliases only suitable for product narratives.

## 3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `task` | User-level work unit, the smallest work commitment object the system faces for users and business | `session`, `execution` |
| `workflow` | Structured execution path of a task, defining steps, dependencies, inputs/outputs, and failure paths | `task`, `execution` |
| `step` | Single execution step in workflow | `task`, `tool call` |
| `execution` | A specific run attempt of a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count/re-entry sequence for the same execution or step | `execution` |
| `session` | Channel interaction session, carrying user input, streaming output, and interactive context | `task` |
| `message` | A complete message object, can contain multiple `message parts` | `event` |
| `message part` | Structured fragment inside message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File or binary product, usually managed through artifact store | `output`, `step output` |
| `output` | Result facing upstream steps or users, can be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result encapsulation for success, partial success, failure, warnings, artifacts, and metrics | Single tool result |

## 3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` eight-phase closed loop | Normal workflow name |
| `stage` | Phase-level status unit in OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of a complete or partial closed loop | Single tool call |
| `TaskSituation` | Factual snapshot from Observe output | Final assessment result |
| `UnifiedAssessment` | Structured judgment from Assess output | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | Workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | Normal log |
| `LearningObject` | Reusable learning object produced by Learn Hub | Single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | Published strategy |
| `RolloutRecord` | Controlled release record from Release phase | `ImprovementCandidate` |

## 4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `runtime` | The layer where the system actually executes task/workflow/agent/tool | `platform` |
| `execution ticket` | Formal execution document issued by dispatch layer to execution layer | Normal task input |
| `lease` | Temporary ownership of an execution or worker dispatch | Permanent ownership |
| `lease owner` | Execution entity currently holding execution rights | `worker`'s physical machine identifier |
| `fencing token` | Version token to prevent old executor from writing dirty results | Normal sequence |
| `dispatch` | Assigning task or execution rights to some execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit, can be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating in the same task context | `worker` |
| `heartbeat` | Periodic health/load reporting | Real business progress |
| `stalled` | Process may not be dead but no effective progress within specified time | `offline` |
| `dead-letter` | Failure record that cannot be automatically recovered or should not continue retrying | Normal error log |
| `checkpoint` | State snapshot at recoverable boundary | Any temporary variable |
| `partial result` | Task not yet entirely completed but has retainable, auditable阶段性 results | `completed` |
| `compensation` | Action to rollback, reconcile, or manually repair already occurred step side effects | Normal retry |

## 5. State and Lifecycle Terminology

### 5.1 Lifecycle General Words

| Term | Definition |
|------|-----------|
| `queued` | Created but not yet started execution |
| `running` / `executing` | Main logic being pushed forward |
| `blocked` | Temporarily unable to continue due to unmet dependencies, approval, policy, or resource reasons |
| `paused` | Explicitly paused, can resume |
| `waiting_input` | Waiting for human or external system input |
| `throttled` | Delayed due to backpressure, rate limiting, or budget reasons |
| `cancelled` | Explicitly terminated, will not continue |
| `failed` | Execution failed and current attempt terminated |
| `completed` | This object's lifecycle successfully ended |

### 5.2 States That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` is not `paused`
- `paused` is not `waiting_input`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `completed` does not equal "all downstream have been processed", authoritative state machine definition takes precedence

### 5.3 Termination Reason Terminology

| Term | Definition |
|------|-----------|
| `termination_reason_code` | Standardized termination reason code |
| `termination_initiator` | Entity that triggered termination, such as user/system/policy/admin |
| `termination_scope` | Termination impact scope, such as step/workflow/task/session |
| `recoverable` | Whether recovery path is allowed after termination |

## 6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `event` | Structured factual notification inside system | `message` |
| `event type` | Event category, recommended `<domain>.<action>` | DB table name |
| `tier 1 event` | Must reliably write to DB, must be recoverable, cannot be silently lost | Normal UI event |
| `ack` | Record that a consumer has confirmed processing an event | Global consumed flag |
| `replay` | Resend events from historical buffer or persistent storage | Live stream |
| `stream` | Incremental output stream facing channel/UI | Authoritative event log |
| `stream_id` | Unique identifier for a display stream | `task_id` |
| `sequence` | Monotonic sequence number for same stream or event channel | Fencing token |
| `Last-Event-ID` | Breakpoint resume position declared by SSE client | Global offset |
| `replay buffer` | Limited event window retained for short-term disconnection recovery | Persistent event storage |
| `viewer_only` | Read-only observation interaction state | Business failure state |

## 7. Organization and Role Terminology

### 7.1 Control Layer Canonical Mapping

Control layer roles use "canonical id + business alias" notation uniformly in documents.

| Canonical ID | Business Alias | Engineering Responsibility |
|-------------|---------------|--------------------------|
| `strategic_governor` | CEO | Strategic judgment, escalation governance, organization-level approval |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division splitting, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | In-division workflow autonomous orchestration |

Recommended writing:

- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)

Not recommended:

- Only writing `VP Orchestration`
- Using `CEO/VP/Lead` directly as primary keys in protocols and schemas

### 7.2 Other Organization Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition, not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity bearing role responsibilities | `worker` |
| `organization` | Enterprise/organization-level boundary | `division` |
| `workspace` | Workspace boundary under organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

## 8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `policy engine` | Code-level entry for final ruling on permissions, risk, approval, budget, and runtime constraints | Prompt instruction |
| `approval` / `HITL` | Decision step requiring explicit human participation | General user reply |
| `break-glass` | High-risk urgent release process, must have strong audit | Normal approval |
| `sandbox` | Execution isolation boundary | Normal permission prompt |
| `exec policy` | Rule set for tool/command execution | High-level product description |
| `permission` | Authorization state where a subject can see or use some capability | Runtime ownership |
| `secret` | Sensitive credentials like keys, tokens, credentials | Normal config value |
| `secret masking` | Method of redacted display of secrets | Real secret storage |
| `data classification` | Data classification rules, such as public/internal/confidential/restricted | Simple label text |
| `audit evidence` | Traceable, verifiable, not easily repudiable behavioral evidence | Normal log |

## 9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
|------|-----------|------------------------------|
| `authoritative store` | Storage that has final interpretation rights for certain types of facts | Any cache |
| `transaction store` | Storage responsible for transactional data like tasks, states, approvals, events | Artifact store |
| `artifact store` | Storage for files, large volume, or export-type products | Transaction store |
| `analytics store` | Storage for statistics, reports, and trend analysis | Authoritative state store |
| `data plane` | Unified data plane for transaction layer, artifact, analytics, archive, replay | Single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundary | OS path |
| `eventual consistency` | Allows brief delay before reaching consistency | Strong consistency |
| `reconciliation` | Reconciliation and repair of states, events, workers, locks, etc. | Normal retry |
| `migration` | Formal version migration of schema or storage structure | Ad-hoc SQL patch |

### 9.1 OAPEFLIR Evolution Status Words

| Term | Definition |
|------|-----------|
| `promotion_status` | LearningObject promotion status, current minimum set is `draft/validated/promoted/retired` |
| `candidate_status` | ImprovementCandidate status, current minimum set is `proposed/evaluating/approved/shadow_running/rejected/rolled_back` |
| `rollout_status` | RolloutRecord status, current minimum set is `pending/active/completed/blocked/rolled_back` |
| `guardrail_reason_code` | Release/block reason code from deterministic guardrail |

## 10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
|------|-----------|
| `config bundle` | A set of configurations that take effect together |
| `config version` | Version identifier after configuration change |
| `feature flag` | Switch controlling capability enable/disable or grayscale |
| `prompt bundle` | A set of prompts that are released and versioned together |
| `compatibility window` | Formally supported compatibility interval between different runtime/SDK/protocol/plugin |
| `promote criteria` | Evidence threshold for a module to promote from available to platform-ready/production-ready |
| `readiness registry` | Formal registry recording environment or module readiness status |
| `evidence package` | A set of evidence packages used to support promote/signoff/production-ready judgments |

### 10.1 Prompt/Cache Partition Terminology

| Term | Definition |
|------|-----------|
| `fixed_prefix` | System prompt fixed prefix shared across agents, not participating in normal compaction by default |
| `domain_block` | Prompt middle layer reusable within same domain/profile |
| `variable_suffix` | Prompt suffix dynamically changing by task, role, plan, memory |
| `KV cache fixed prefix` | Pre-fill cache reuse mechanism based on same prefix hash |

## 11. Testing, Validation, and Stabilization Terminology

| Term | Definition |
|------|-----------|
| `Stable Core` | Minimum capability range deliberately shrunk to first achieve stable operation |
| `golden task` | Fixed representative task used as version regression baseline |
| `fixture` | Pre-set fixed input/output samples for stable testing |
| `VCR` | Testing mechanism for recording/playback of external calls |
| `unit test` | Fine-grained testing for single function, single module, single object |
| `integration test` | Cross-module collaboration testing |
| `E2E` | End-to-end testing from entry to result |
| `chaos test` | Testing that actively injects faults to verify recovery and resilience |
| `soak test` | Long-time continuous operation stability testing |
| `recovery drill` | Recovery drill for scenarios like crash, disconnection, lock conflict, restart |
| `admission control` | Admission control where system rejects, delays, or degrades before overload |
| `readiness` | Whether a stage, module, or environment has reached readiness for next action |

## 12. Observability and Operations Terminology

| Term | Definition |
|------|-----------|
| `structured log` | Structured, searchable, context-rich logs |
| `trace` | Global tracking of cross-module execution chain for a single task |
| `span` | Single operation segment in a trace |
| `correlation id` | Unified identifier for cross-module correlating logs/events/requests |
| `healthz` | Minimum health check entry |
| `inspect` | Debug query view facing tasks, executions, sessions, workers |
| `backpressure` | Mechanism where system delays, degrades, or rejects new requests under overload |
| `runbook` | On-call and fault handling manual |
| `SLO` | Service objective, such as success rate, latency, recovery time |
| `SLA` | Service level agreement externally committed |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-time continuous stability testing |
| `RCA` | Root Cause Analysis |
| `RTO` | Recovery Time Objective |
| `RPO` | Acceptable data rollback point objective |

## 13. Channel, Extension, and External Integration Terminology

| Term | Definition |
|------|-----------|
| `channel` | User or system access interface, such as CLI, Web, Telegram, API |
| `channel capability` | Capabilities supported by a channel, such as text, button, stream, attachment |
| `plugin` | Installation unit that extends platform capabilities through public SDK or controlled boundary |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | One type of external capability access protocol/extension |
| `recipe` / `template` | Structured workflow or template definition, can be used as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata such as capabilities, limitations, prices, default parameters for a model |

## 14. Protocol, Model, and Security Abbreviations

| Term | Definition |
|------|-----------|
| `ADR` | Architecture Decision Record |
| `API` | Application Programming Interface, refers to formal external or inter-module interface surface |
| `SDK` | Software Development Kit, usually derived from authoritative schema or protocol |
| `DSL` | Domain-Specific Language, such as workflow DSL |
| `DDL` | Data Definition Language, often refers to table creation, index, constraint migration statements |
| `WAL` | Write-Ahead Logging, SQLite/database pre-write logging mode |
| `MCP` | Model Context Protocol or external capability access protocol type in this system |
| `HITL` | Human In The Loop, decision环节requiring human participation |
| `PII` | Personally Identifiable Information |
| `TTL` | Time To Live, valid duration for data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage, for carrying messages or tasks that cannot continue processing |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect, used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | User and organization identity synchronization protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When abbreviations first appear in main documents, recommend giving full name or Chinese explanation at least once.
- Abbreviations must not replace authoritative contract's formal definitions of object boundaries.

## 15. Easily Confused Term Pairs

### 13.1 `task` vs `session`

- `task` is business work unit
- `session` is interaction session
- One session can trigger multiple tasks
- One task may also update state across multiple sessions

### 13.2 `workflow` vs `execution`

- `workflow` is structure
- `execution` is a certain run attempt
- Same workflow can correspond to multiple execution attempts

### 13.3 `agent` vs `worker`

- `agent` leans toward responsibility and intelligent entity
- `worker` leans toward execution carrier and resource slot
- `sub-agent` is not synonymous with remote worker

### 13.4 `artifact` vs `output` vs `step output`

- `artifact` leans toward file product
- `output` leans toward result semantics
- `step output` leans toward step-level structured snapshot

### 13.5 `permission` vs `policy`

- `permission` is authorization result or static capability boundary
- `policy` is ruling logic and rule system
- Should not treat verbal restrictions in prompts as formal policy

### 13.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, should not replace each other

### 15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching readiness for some gate or next action
- `production-ready` indicates reaching comprehensive threshold required for production backing
- `Phase 1a ready` must not be misinterpreted as `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion for current revision
- `completion gate` is the threshold check that must be re-executed before coding
- Should not treat one signoff conclusion as a permanent pass

### 15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by provider
- `model profile` is model metadata, not equal to provider profile

## 16. Naming Principles

- External narratives can retain CEO/VP/Lead.
- Internal implementation prioritizes neutral engineering terms, such as `router`, `planner`, `orchestrator`, `supervisor`.
- If narrative and engineering terms both appear in one document, should clearly map one-to-one.
- Schemas, events, configurations, directories, and table names use canonical engineering names by default.

## 17. Recommended Naming Formats

| Object | Recommended Format | Example |
|--------|-------------------|---------|
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` or stable `snake_case`, consistent throughout | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | Plural `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | Namespace + stable key | `runtime.max_concurrency` |
| feature flag | Domain prefix + feature name | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type name + `camelCase` field name | `TurnStartParams` |

## 18. Prohibited Writing

- Do not directly use `CEO/VP/Lead` in schema enums
- Do not treat `session` as alternative name for `task`
- Do not treat `worker` as the only implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as authoritative state machine
- Do not write descriptive restrictions in prompts as "already existing code-level policy"
- Do not directly write `ready` as synonym for `production-ready`
- Do not treat one `signoff` conclusion as permanently valid state
- Do not treat abbreviations as sole explanation, causing readers unable to return to formal definition
- Do not mix `provider`, `model`, `profile` three layers into one object

## 19. Closure Conclusion

The goal of terminology unification is not to remove product expression, but to avoid semantic drift during engineering implementation.

From now on:

- Narratives can have narrative names when talking about architecture
- When writing contracts, schemas, events, configurations, and code, must prioritize canonical engineering names
- When ambiguity arises, should priority return to this glossary and corresponding authoritative contract for closure
