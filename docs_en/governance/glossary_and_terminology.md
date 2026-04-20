# Glossary And Terminology

## 1. Objective

Unify core terminology, preventing confusion between product narrative terms, engineering implementation terms, runtime object terms, and operations terms.

This file answers 4 questions:

- What does a particular term mean in this system
- Which terms are easily confused, and how should they be distinguished
- Which naming conventions are recommended
- Which naming conventions should be avoided in contracts, protocols, configurations, and code

Related documents:

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. Usage Rules

- This glossary is the authoritative terminology master at the governance layer.
- If the main document, contract, ADR, or guide conflicts with this glossary, the authoritative contract for the corresponding topic takes precedence, and this glossary should be updated accordingly.
- If a term has both a product alias and an engineering name, the engineering canonical name takes precedence by default.
- Product-only narrative aliases must not be used in protocols, schemas, events, configurations, directories, or table names.

## 3. Core Object Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `task` | User-level work unit; the smallest work commitment object the system presents to users and business | `session`, `execution` |
| `workflow` | Structured execution path for a task; defines step, dependencies, input/output, and failure paths | `task`, `execution` |
| `step` | Single execution step within a workflow | `task`, `tool call` |
| `execution` | A specific runtime attempt for a task/workflow | `workflow`, `worker` |
| `attempt` | Retry count/re-entry sequence for the same execution or step | `execution` |
| `session` | Channel interaction session; carries user input, streaming output, and interactive context | `task` |
| `message` | A complete message object, may contain multiple `message part`s | `event` |
| `message part` | Structured fragment within a message, such as text, tool_use, tool_result, summary | `message` |
| `artifact` | File-type or binary product; typically managed via artifact store | `output`, `step output` |
| `output` | Result facing upstream steps or users; can be structured data or text, not necessarily a file | `artifact` |
| `step output` | Structured result snapshot after a step completes | `artifact`, `final result` |
| `result envelope` | Unified result envelope for success, partial success, failure, warnings, artifacts, and metrics | Single tool result |

## 3A. OAPEFLIR Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` 8-stage closed loop | Regular workflow name |
| `stage` | Stage-level status unit within the OAPEFLIR closed loop | `step` |
| `loop iteration` | Execution round of a complete or partial closed-loop iteration | Single tool call |
| `TaskSituation` | Fact snapshot output from Observe | Final assessment result |
| `UnifiedAssessment` | Structured judgment output from Assess | `TaskSituation` |
| `Plan` | Explicit execution plan from Plan Hub | Workflow definition itself |
| `FeedbackSignal` | Structured feedback signal collected after Execute | Regular log |
| `LearningObject` | Reusable learning object produced by Learn Hub | Single feedback raw record |
| `ImprovementCandidate` | Improvement candidate produced by Improve Hub | Published strategy |
| `RolloutRecord` | Controlled release record from Release stage | `ImprovementCandidate` |

## 4. Execution and Recovery Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `runtime` | Actual system execution layer for task/workflow/agent/tool | `platform` |
| `execution ticket` | Formal execution document issued by scheduler to execution layer | Regular task input |
| `lease` | Temporary ownership of an execution or worker dispatch | Permanent ownership |
| `lease owner` | Execution entity currently holding execution rights | `worker` physical machine identifier |
| `fencing token` | Version token preventing old executor from writing dirty results | Regular sequence |
| `dispatch` | Assigning a task or execution rights to an execution carrier | `spawn_agent` |
| `worker` | Execution carrier unit; can be local or remote | `agent` |
| `sub-agent` | Secondary intelligent execution unit collaborating within the same task context | `worker` |
| `heartbeat` | Periodic health/load reporting | Real business progress |
| `stalled` | Process may not be dead, but no valid progress within specified time | `offline` |
| `dead-letter` | Failure sink record that cannot be automatically recovered or should not continue retrying | Regular error log |
| `checkpoint` | State snapshot at recoverable boundary | Any temporary variable |
| `partial result` | Task not yet complete overall, but has preservable/auditable staged results | `completed` |
| `compensation` | Action to rollback, reconcile, or manually repair steps with side effects already occurred | Regular retry |

## 5. Status and Lifecycle Terminology

### 5.1 Lifecycle Generic Terms

| Term | Definition |
| --- | --- |
| `queued` | Created but not yet started executing |
| `running` / `executing` | Actively advancing main logic |
| `blocked` | Temporarily unable to continue due to unmet dependencies, approvals, policies, or resources |
| `paused` | Explicitly paused; can be resumed |
| `waiting_input` | Waiting for human or external system input |
| `throttled` | Delayed due to backpressure, rate limiting, or budget |
| `cancelled` | Explicitly terminated; will not continue |
| `failed` | Execution failed and current attempt terminated |
| `completed` | This instance's lifecycle has successfully ended |

### 5.2 Status Words That Must Be Distinguished

- `queued` is not `blocked`
- `blocked` is not `paused`
- `paused` is not `waiting_input`
- `stalled` is not `offline`
- `failed` is not `cancelled`
- `completed` does not mean "all downstream processing is finished"; refer to authoritative state machine definition

### 5.3 Termination Reason Terminology

| Term | Definition |
| --- | --- |
| `termination_reason_code` | Standardized termination reason code |
| `termination_initiator` | Entity that triggered termination: user / system / policy / admin |
| `termination_scope` | Termination impact scope: step / workflow / task / session |
| `recoverable` | Whether recovery path is allowed after termination |

## 6. Event and Streaming Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `event` | Structured factual notification within the system | `message` |
| `event type` | Event category; recommended `<domain>.<action>` | DB table name |
| `tier 1 event` | Must be reliably persisted; must be recoverable; must not be silently lost | Regular UI event |
| `ack` | Record that a consumer has confirmed processing an event | Global consumed flag |
| `replay` | Resend events from history buffer or persistent storage | Live stream |
| `stream` | Incremental output stream facing channels/UI | Authoritative event log |
| `stream_id` | Unique identifier for a display stream | `task_id` |
| `sequence` | Monotonic sequence number within the same stream or event channel | Fencing token |
| `Last-Event-ID` | SSE client-declared checkpoint resume position | Global offset |
| `replay buffer` | Limited event window retained for short disconnection recovery | Persistent event storage |
| `viewer_only` | Read-only observation of interactive state | Business failure state |

## 7. Organization and Role Terminology

### 7.1 Control Layer Canonical Mapping

Control layer roles use "canonical id + business alias" format uniformly in documentation.

| Canonical ID | Business Alias | Engineering Responsibility |
| --- | --- | --- |
| `strategic_governor` | CEO | Strategic judgment, escalation governance, organization-level approval |
| `intake_router` | VP Operations | Input triage, classification, routing, budget entry |
| `workflow_planner` | VP Orchestration | Cross-division breakdown, dependency graph, aggregation, failure escalation |
| `division_lead` | Lead Agent | In-division workflow autonomous orchestration |

Recommended naming conventions:

- `intake_router`（business alias: VP Operations）
- `workflow_planner`（business alias: VP Orchestration）

Not recommended:

- Only writing `VP Orchestration`
- Using CEO / VP / Lead as primary keys directly in protocols and schemas

### 7.2 Other Organization Terms

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `division` | Business capability domain or division boundary | `tenant` |
| `role` | Responsibility definition; not a runtime instance | `agent runtime instance` |
| `agent` | Intelligent execution entity bearing role responsibilities | `worker` |
| `organization` | Enterprise/organization-level boundary | `division` |
| `workspace` | Workspace boundary under an organization | `session` |
| `tenant` | Primary boundary for isolation, security, quota, and billing | `organization` |

## 8. Security and Governance Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `policy engine` | Code-level entry point for final arbitration of permissions, risks, approvals, budgets, and runtime constraints | Prompt directives |
| `approval` / `HITL` | Decision step requiring explicit human participation | Regular user reply |
| `break-glass` | High-risk emergency release process; requires strong audit | Regular approval |
| `sandbox` | Execution isolation boundary | Regular permission prompt |
| `exec policy` | Rule set for tool/command execution | High-level product description |
| `permission` | Authorization status for a subject to see or use a capability | Runtime ownership |
| `secret` | Sensitive credentials such as keys, tokens, certificates | Regular config value |
| `secret masking` | Method for redacted display of secrets | Actual secret storage |
| `data classification` | Data classification rules: public/internal/confidential/restricted | Simple label text |
| `audit evidence` | Traceable, verifiable, not easily repudiable behavioral evidence | Regular log |

## 9. Data, Storage, and Consistency Terminology

| Term | Definition | Should Not Be Confused With |
| --- | --- | --- |
| `authoritative store` | Storage that has final interpretation authority for certain facts | Any cache |
| `transaction store` | Storage responsible for transactional data such as tasks, status, approvals, events | Artifact store |
| `artifact store` | Storage for file-type, large-volume, or export-type products | Transaction store |
| `analytics store` | Storage for statistics, reports, and trend analysis | Authoritative state store |
| `data plane` | Unified data plane for transactions, artifacts, analytics, archive, and replay | Single DB |
| `namespace` | Logical namespace under data, artifact, or tenant boundaries | OS path |
| `eventual consistency` | Allows brief delay before reaching consistency | Strong consistency |
| `reconciliation` | Reconciliation and repair of status, events, workers, locks, etc. | Regular retry |
| `migration` | Formal version migration of schema or storage structure | Ad-hoc SQL patch |

### 9.1 OAPEFLIR Evolution Status Terms

| Term | Definition |
| --- | --- |
| `promotion_status` | Promotion status of LearningObject; current minimum set: `draft / validated / promoted / retired` |
| `candidate_status` | Status of ImprovementCandidate; current minimum set: `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | Status of RolloutRecord; current minimum set: `pending / active / completed / blocked / rolled_back` |
| `guardrail_reason_code` | Allow/block reason code from deterministic guardrail |

## 10. Configuration, Version, and Compatibility Terminology

| Term | Definition |
| --- | --- |
| `config bundle` | Set of configurations that take effect together |
| `config version` | Version identifier after configuration change |
| `feature flag` | Switch controlling capability enable/disable or gradual rollout |
| `prompt bundle` | Set of prompts released and versioned together |
| `compatibility window` | Officially supported compatibility range between different runtime / SDK / protocol / plugin |
| `promote criteria` | Evidence threshold for a module to advance from available to platform-ready / production-ready |
| `readiness registry` | Formal registration surface recording readiness status of environments or modules |
| `evidence package` | Set of evidence packages used to support promote / signoff / production-ready judgments |

### 10.1 Prompt / Cache Partition Terminology

| Term | Definition |
| --- | --- |
| `fixed_prefix` | System prompt fixed prefix shared across agents; does not participate in normal compaction by default |
| `domain_block` | Reusable prompt intermediate layer for same domain / profile |
| `variable_suffix` | Prompt suffix that dynamically changes by task, role, plan, memory |
| `KV cache fixed prefix` | Prefill cache reuse mechanism based on same prefix hash |

## 11. Testing, Validation, and Stabilization Terminology

| Term | Definition |
| --- | --- |
| `Stable Core` | Minimum capability scope deliberately shrunk to achieve stable operation first |
| `golden task` | Fixed representative task used as version regression baseline |
| `fixture` | Preset fixed input/output samples for stable testing |
| `VCR` | Test mechanism for recording/playback of external calls |
| `unit test` | Fine-grained test for single function, single module, single object |
| `integration test` | Test across module collaboration |
| `E2E` | End-to-end test from entry to result |
| `chaos test` | Test that actively injects faults to verify recovery and resilience |
| `soak test` | Long-duration continuous operation stability test |
| `recovery drill` | Recovery drill for crashes, disconnections, lock conflicts, restarts, etc. |
| `admission control` | System performing rejection, delay, or degradation when overloaded |
| `readiness` | Whether a stage, module, or environment has reached readiness for next action |

## 12. Observability and Operations Terminology

| Term | Definition |
| --- | --- |
| `structured log` | Structured, searchable, contextual fields |
| `trace` | Global tracking of a task's cross-module execution chain |
| `span` | Single operation segment within a trace |
| `correlation id` | Unified identifier used for cross-module correlation of logs/events/requests |
| `healthz` | Minimal health check entry point |
| `inspect` | Debug query view for tasks, executions, sessions, workers |
| `backpressure` | Mechanism where system delays, degrades, or rejects new requests when overloaded |
| `runbook` | On-call and incident handling manual |
| `SLO` | Service objectives: success rate, latency, recovery time |
| `SLA` | Service Level Agreement; externally committed service level |
| `error budget` | Acceptable failure budget for SLO |
| `soak test` | Long-duration continuous stability test |
| `RCA` | Root Cause Analysis |
| `RTO` | Recovery Time Objective |
| `RPO` | Recovery Point Objective; acceptable data rollback point |

## 13. Channel, Extension, and External Integration Terminology

| Term | Definition |
| --- | --- |
| `channel` | User or system access interface: CLI, Web, Telegram, API |
| `channel capability` | Capabilities supported by a channel: text, button, stream, attachment |
| `plugin` | Installation unit that extends platform capabilities through public SDK or controlled boundary |
| `skill` | Reusable orchestration capability for tools or steps |
| `MCP` | External capability access protocol/extension type |
| `recipe` / `template` | Structured workflow or template definition; can serve as workflow author input layer |
| `provider` | LLM or model capability provider |
| `model profile` | Metadata for a model's capabilities, limitations, pricing, default parameters, etc. |

## 14. Protocol, Model, and Security Abbreviations

| Term | Definition |
| --- | --- |
| `ADR` | Architecture Decision Record |
| `API` | Application Programming Interface; formal external or inter-module interface surface |
| `SDK` | Software Development Kit; usually derived from authoritative schema or protocol |
| `DSL` | Domain-Specific Language, such as workflow DSL |
| `DDL` | Data Definition Language; commonly refers to table creation, index, constraint migration statements |
| `WAL` | Write-Ahead Logging; pre-write logging mode for SQLite/databases |
| `MCP` | Model Context Protocol or external capability access protocol type in this system |
| `HITL` | Human In The Loop; decision step requiring human participation |
| `PII` | Personally Identifiable Information |
| `TTL` | Time To Live; valid duration for data or cache |
| `DLQ` | Dead Letter Queue / dead-letter storage; used to receive and process messages or tasks that cannot continue processing |
| `HA` | High Availability |
| `DR` | Disaster Recovery |
| `OIDC` | OpenID Connect; used for identity authentication federation |
| `SSO` | Single Sign-On |
| `SCIM` | User and organization identity synchronization protocol |
| `RLS` | Row-Level Security |
| `SBOM` | Software Bill of Materials |

Supplementary rules:

- When abbreviations first appear in main documents, it is recommended to provide the full term or Chinese explanation at least once.
- Abbreviations must not replace authoritative contract definitions of object boundaries.

## 15. Easily Confused Term Pairs

### 13.1 `task` vs `session`

- `task` is a business work unit
- `session` is an interaction session
- One session can trigger multiple tasks
- One task may also update status across multiple sessions

### 13.2 `workflow` vs `execution`

- `workflow` is the structure
- `execution` is a specific runtime attempt
- The same workflow can correspond to multiple execution attempts

### 13.3 `agent` vs `worker`

- `agent` emphasizes responsibilities and intelligence
- `worker` emphasizes execution carrier and resource slot
- `sub-agent` is not a synonym for remote worker

### 13.4 `artifact` vs `output` vs `step output`

- `artifact` emphasizes file products
- `output` emphasizes result semantics
- `step output` emphasizes step-level structured snapshot

### 13.5 `permission` vs `policy`

- `permission` is the authorization result or static capability boundary
- `policy` is the arbitration logic and rule system
- Descriptive limitations in prompts should not be written as formal policies

### 13.6 `queue` vs `lease`

- `queue` determines waiting order
- `lease` determines current execution rights
- When both exist, they should not replace each other

### 15.7 `readiness` vs `production-ready`

- `readiness` indicates reaching a certain gate or readiness for next action
- `production-ready` indicates reaching comprehensive threshold for production support
- `Phase 1a ready` must not be misinterpreted as `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is the review conclusion for the current revision
- `completion gate` is the threshold check that must be executed again before entering coding
- One signoff conclusion should not be treated as a permanent pass

### 15.9 `provider` vs `model`

- `provider` is the service provider
- `model` is the specific model provided by a provider
- `model profile` is model metadata; not equal to provider profile

## 16. Naming Principles

- External narrative may retain CEO / VP / Lead.
- Internal implementation prioritizes neutral engineering terms: `router`, `planner`, `orchestrator`, `supervisor`.
- When both narrative and engineering terms appear in the same document, explicit one-to-one mapping is required.
- Schemas, events, configurations, directories, and table names use canonical engineering names by default.

## 17. Recommended Naming Formats

| Object | Recommended Format | Example |
| --- | --- | --- |
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` or stable `snake_case`; consistent throughout | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | Plural `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | Namespace + stable key | `runtime.max_concurrency` |
| feature flag | Domain prefix + feature name | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type name + `camelCase` field name | `TurnStartParams` |

## 18. Prohibited Writings

- Do not directly use CEO / VP / Lead in schema enums
- Do not use `session` as a substitute for `task`
- Do not use `worker` as the only implementation name for `agent`
- Do not generalize `artifact` to all outputs
- Do not treat UI display state as the authoritative state machine
- Do not write prompt descriptive limitations as "already-existing code-level policies"
- Do not use `ready` directly as a synonym for `production-ready`
- Do not treat one `signoff` conclusion as a permanently valid state
- Do not use abbreviations as the sole explanation, preventing readers from returning to formal definitions
- Do not conflate `provider`, `model`, and `profile` three levels into one object

## 19. Closure Conclusion

The goal of terminology unification is not to remove product expression, but to prevent semantic drift during engineering implementation.

From now on:

- Narrative names are acceptable when discussing architecture
- When writing contracts, schemas, events, configurations, and code, canonical engineering names must be used
- When ambiguity arises, return to this glossary and corresponding authoritative contracts for closure
