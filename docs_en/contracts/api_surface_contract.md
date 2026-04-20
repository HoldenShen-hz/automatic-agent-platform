# API Surface Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

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

This contract defines the minimum resource model and interface boundaries for the platform's external HTTP API.

## 2. Resource Objects

- `TaskResource`
- `SessionResource`
- `ApprovalResource`
- `DivisionResource`
- `HealthResource`
- `FeedbackResource`
- `StrategyVersionResource`
- `RolloutResource`
- `KnowledgeNamespaceResource`
- `PluginRegistryResource`
- `ArtifactPublishResource`

## 3. Minimum Endpoint Set

- `POST /tasks`
- `GET /tasks/:taskId`
- `GET /tasks/:taskId/events`
- `GET /tasks/:taskId/inspect`
- `GET /tasks/:taskId/oapeflir-timeline`
- `POST /tasks/:taskId/cancel`
- `GET /sessions/:sessionId/messages`
- `GET /executions/:executionId/inspect`
- `GET /approvals/:approvalId/inspect`
- `POST /approvals/:approvalId/decision`
- `GET /rollouts/:rolloutId/inspect`
- `POST /rollouts/:rolloutId/advance`
- `POST /rollouts/:rolloutId/rollback`
- `GET /feedback/:taskId`
- `GET /divisions`
- `GET /knowledge/namespaces`
- `GET /knowledge/query`
- `GET /knowledge/graph`
- `GET /knowledge/semantic/inspect`
- `GET /knowledge/:namespace/inspect`
- `GET /domains`
- `GET /domains/:domainId`
- `GET /domains/:domainId/plugins`
- `GET /plugins`
- `GET /artifacts/publishes`
- `POST /artifacts/bundles/preview`
- `POST /artifacts/bundles/publish`
- `GET /healthz`
- `GET /health` (compat alias)

If the platform subsequently exposes an independent execution control plane, the following may additionally be provided:

- `POST /command/exec`
- `POST /command/exec/:processId/write`
- `POST /command/exec/:processId/resize`
- `POST /command/exec/:processId/terminate`

## 4. Behavioral Constraints

- API return structure must align with contract naming.
- Write interfaces must return stable ID and timestamp.
- High-risk actions should require approval or explicit permissions.
- OpenAPI should be generated from schema; do not maintain manually written drifting versions.
- The status semantics and field naming of health / inspect must follow `debug_inspect_health_backpressure_contract.md`.
- If CLI, Web Console, TUI, or admin tools consume the same service surface, they should preferentially share the same versioned API / SDK surface, rather than each maintaining implicit private protocols.
- If rollout / feedback / timeline interfaces have corresponding capabilities not enabled in current deployment, they must return explicit `not_enabled` or controlled `404` semantics, and must not masquerade as successful empty objects.
- If knowledge / domain / plugin / artifact plane interfaces have corresponding capabilities not enabled in current deployment, they must return explicit `not_enabled`, not silent empty lists.

## 5. Supplementary Rules

### 5.1 Authentication

- `POST /tasks`, `POST /approvals/:approvalId/decision`, and cancel-related interfaces require authenticated principal by default.
- `GET /healthz` may allow restricted anonymous access; `GET /health` is only a compat alias.
- `inspect` interfaces require administrator, task owner, or principal with explicit debug permissions by default.

### 5.2 Pagination and Filtering

- List interfaces uniformly use `limit`, `cursor`, `sort`.
- Filter fields use explicit allowlists; arbitrary field passthrough is not accepted.
- Default sorting should be stable to avoid pagination drift.
- Knowledge query should at least support `q`, `namespace?`, `domainId?`, `limit?`; when semantic backend is enabled, callers do not need to understand whether the underlying is `local_hash` or `pgvector`.
- `GET /knowledge/semantic/inspect` should return current semantic backend, readiness, and backend details; if `pgvector` is explicitly enabled but the backend is unavailable, runtime startup should fail-close.

### 5.3 Version Evolution

- External API uses `/v1` prefix or equivalent versioning strategy by default.
- Breaking field changes must go through new version or new field compatibility period.
- OpenAPI artifacts are derived products; the source of truth remains in contract and schema.

### 5.4 SDK and Embedded Consumption Surfaces

- Typed clients, server bootstrap helpers, and admin SDK should all derive from the same schema / OpenAPI.
- The platform may have different clients like CLI / TUI / Web, but they should not fork the source of truth by copying interface definitions.
- If a client needs adaptation logic such as transport or header rewriting, it should be treated as a client compatibility layer, not the API contract itself.
- If SDK depends on specific runtime / CLI binary, it must explicitly declare version relationships or pinning rules, rather than implicitly assuming "user's local is compatible".

### 5.5 Independent Execution Control Surface

- If standalone `command/exec` exists, it should be treated as a controlled control plane capability, not a shortcut for regular task execution.
- It must explicitly declare execution control items such as `sandboxPolicy`, `timeout`, `output cap`, `pty/streaming`.
- Process control state generated by command/exec must not retroactively tamper with task / workflow primary state.

### 5.6 Plugin Registry Inventory

- `GET /plugins` and `GET /domains/:domainId/plugins` should at least return `manifest`, `lifecycle_state`, `failure_count`, `cooldown_until?`, `runtime_process_id?`.
- If plugin runs in an independent sandbox runtime, it should also expose `runtime_sandbox_root?` for diagnostics / operator audit.
