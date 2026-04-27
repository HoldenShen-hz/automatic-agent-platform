# API Surface Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

If the platform subsequently exposes a standalone execution control plane, the following may additionally be provided:

- `POST /command/exec`
- `POST /command/exec/:processId/write`
- `POST /command/exec/:processId/resize`
- `POST /command/exec/:processId/terminate`

## 4. Behavior Constraints

- API return structure must align with contract naming.
- Write interfaces must return stable IDs and timestamps.
- High-risk actions should require approval or explicit permissions.
- OpenAPI should be generated from schema, not maintaining manually written drifted versions.
- The status semantics and field naming for health / inspect are based on `debug_inspect_health_backpressure_contract.md`.
- CLI, Web Console, TUI, and admin tools consuming the same service surface should preferentially share the same versioned API / SDK surface, rather than each maintaining implicit private protocols.
- Rollout / feedback / timeline interfaces, if the current deployment does not have the corresponding capability enabled, should return explicit `not_enabled` or controlled `404` semantics, not disguised as successful empty objects.
- Knowledge / domain / plugin / artifact plane interfaces, if the current deployment does not have the corresponding capability enabled, should return explicit `not_enabled`, not silently empty list.

## 5. Supplementary Rules

### 5.1 Authentication

- `POST /tasks`, `POST /approvals/:approvalId/decision`, and cancellation interfaces require authenticated principal by default.
- `GET /healthz` may allow restricted anonymous access; `GET /health` is only a compat alias.
- `inspect` interfaces require administrator, task owner, or principal with explicit debugging permissions by default.

### 5.2 Pagination and Filtering

- List interfaces uniformly use `limit`, `cursor`, `sort`.
- Filter fields use explicit whitelist, not accepting arbitrary field pass-through.
- Default sorting should be stable to avoid pagination drift.
- Knowledge query should at least support `q`, `namespace?`, `domainId?`, `limit?`; when semantic backend is enabled, callers do not need to understand whether the underlying is `local_hash` or `pgvector`.
- `GET /knowledge/semantic/inspect` should return current semantic backend, readiness, and backend details; if `pgvector` is explicitly enabled but the backend is unavailable, runtime startup should fail-close.

### 5.3 Version Evolution

- External API uses `/v1` prefix or equivalent version strategy by default.
- Breaking field changes must go through new version or add field compatibility period.
- OpenAPI artifacts are derived products; the source of truth remains in contract and schema.

### 5.4 SDK and Embedded Consumer Surfaces

- Typed clients, server bootstrap helpers, and admin SDKs should all be derived from the same schema / OpenAPI.
- The platform allows different clients such as CLI / TUI / Web, but they should not fork the source of truth by copying interface definitions.
- If a client needs adaptation logic such as transport or header rewriting, it should be treated as a client compatibility layer, not the API contract itself.
- If SDK depends on a specific runtime / CLI binary, it should explicitly declare version relationship or pinning rules, not implicitly assume "user's local is just compatible".

### 5.5 Standalone Execution Control Plane

- Standalone `command/exec`, if it exists, should be treated as a controlled control plane capability, not a shortcut for regular task execution.
- It must explicitly declare execution control items such as `sandboxPolicy`, `timeout`, `output cap`, `pty/streaming`.
- Process control state generated by command/exec must not retroactively tamper with task / workflow primary state.

### 5.6 Plugin Registry Inventory

- `GET /plugins` and `GET /domains/:domainId/plugins` should at least return `manifest`, `lifecycle_state`, `failure_count`, `cooldown_until?`, `runtime_process_id?`.
- If the plugin runs in a standalone sandbox runtime, it should also expose `runtime_sandbox_root?` for diagnostics / operator audit.
