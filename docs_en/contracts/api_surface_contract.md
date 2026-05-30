# API Surface Contract

---

## OAPEFLIR Relationship

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate assessment and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the minimum resource model and interface boundaries for the platform's external HTTP API.

Related companions:

- `sdk_surface_contract.md` - responsible for CLI / Client SDK / Pack SDK / Plugin SDK external surface
- `docs_zh/reference/api-versioning.md` - responsible for human-readable description and version negotiation guidelines

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
- `GET /harness-runs/:harnessRunId/inspect`
- `GET /node-runs/:nodeRunId/inspect`
- `GET /executions/:executionId/inspect` (legacy compat alias)
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
- Write interfaces must return stable IDs and timestamps.

## v4.3 Contract Remediation

- T-61: This document originally wrote `/executions/:executionId/inspect` as the sole canonical inspect entry. Root cause: The API contract inherited the old execution-centric observation model and did not upgrade along with `HarnessRun / NodeRun` as the truth main chain. Fix: The main text now elevates `harness-runs` / `node-runs` inspect to authoritative endpoints; `/executions/:executionId/inspect` only retains legacy compat query semantics.
- High-risk actions should require approval or explicit permissions.
- OpenAPI should be generated from schema; hand-written drift versions should not be maintained.
- The status semantics and field naming for health / inspect follow `debug_inspect_health_backpressure_contract.md`.
- CLI, Web Console, TUI, and admin tools consuming the same service surface should prioritize sharing the same versioned API / SDK surface rather than each maintaining implicit private protocols.
- rollout / feedback / timeline interfaces should return explicit `not_enabled` or controlled `404` semantics when the corresponding capability is not enabled in current deployment, rather than masquerading as successful empty objects.
- knowledge / domain / plugin / artifact plane interfaces should return explicit `not_enabled` when the corresponding capability is not enabled in current deployment, rather than silently returning empty lists.

Controlled status code mapping:

| Scenario | Status Code | Stable Error Code |
| --- | --- | --- |
| Resource not found / capability not enabled with allowed controlled void | `404` | `api.task_not_found` etc. resource-specific code |
| Idempotency key conflict / duplicate request | `409` | `api.idempotency_key_conflict` / `api.duplicate_request` |
| Request body exceeds limit | `413` | `api.payload_too_large` |
| Media type not supported | `415` | `api.unsupported_media_type` |
| Rate limited | `429` | `api.rate_limit_exceeded` |

## 5. Supplementary Rules

### 5.1 Authentication

- `POST /tasks`, `POST /approvals/:approvalId/decision`, and cancel interfaces require authenticated principal by default.
- `GET /healthz` may allow limited anonymous access; `GET /health` is only a compat alias.
- `inspect` interfaces require admin, task owner, or principal with explicit debug permission by default.

### 5.2 Pagination and Filtering

- List interfaces uniformly use `limit`, `cursor`, `sort`.
- Filter fields use explicit allowlist; arbitrary field passthrough is not accepted.
- Default sorting should be stable to avoid pagination drift.
- Knowledge query should support at least `q`, `namespace?`, `domainId?`, `limit?`; when semantic backend is enabled, callers do not need to understand whether the underlying is `local_hash` or `pgvector`.
- `GET /knowledge/semantic/inspect` should return current semantic backend, readiness, and backend details; when `pgvector` is explicitly enabled but the backend is unavailable, runtime startup should fail-close.

### 5.3 Version Evolution

- External API uses `/v1` prefix or equivalent version strategy by default.
- Breaking field changes must go through new version or new field compatibility period.
- OpenAPI artifacts are derived products; the source of truth remains in contracts and schema.

### 5.4 SDK and Embedded Consumer Surfaces

- Typed client, server bootstrap helper, and admin SDK should all be derived from the same schema / OpenAPI.
- The platform may have CLI / TUI / Web as different clients, but they should not fork the source of truth by copying interface definitions.
- If a client needs adaptation logic such as transport or header rewriting, it should be treated as a client compatibility layer, not the API contract itself.
- If SDK depends on specific runtime / CLI binary, it should explicitly declare version relationship or pinning rules rather than implicitly assuming "user's local happens to be compatible".

### 5.5 Independent Execution Control Plane

- Standalone `command/exec`, if it exists, should be treated as a controlled control plane capability, not a shortcut for ordinary task execution.
- It must explicitly declare execution control items such as `sandboxPolicy`, `timeout`, `output cap`, `pty/streaming`.
- Process control state generated by command/exec must not reverse-corrupt task / workflow main state.

### 5.6 Plugin Registry Inventory

- `GET /plugins` and `GET /domains/:domainId/plugins` should return at least `manifest`, `lifecycle_state`, `failure_count`, `cooldown_until?`, `runtime_process_id?`.
- If plugin runs in an independent sandbox runtime, `runtime_sandbox_root?` should also be exposed for diagnostics / operator audit.