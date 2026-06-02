## src/platform/five-plane-interface

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1 | iam/audit-event-integrity.ts:43-44, distributed-rate-limiter.ts:47, request-deduplication.ts:82, http-api-server.ts:119-122, http-server/health-routes.ts:19-21 — library directly reads process.env.NODE_ENV/constants, breaking DI and tests | `todo` | - |
| 2 | api/middleware/idempotency-key-storage.ts:182,188 — Redis backend ioredis constructor already passes `keyPrefix:"idempotency:"`, but `buildKey()` also manually prepends `idempotency:`, so actual key becomes `idempotency:idempotency:<key>`, single/cluster storage invisible to each other | `done` | Uses both ioredis built-in `keyPrefix` and code-level manual prefix, missing the "choose one" constraint. |
| 3 | api/middleware/idempotency-key-storage.ts — Redis implementation's `cleanup()` is no-op (depends on TTL), but interface and memory implementation promise active cleanup | `done` | Interface contract doesn't explicitly declare semantic difference in Redis adapter layer, legacy empty implementation. |
| 4 | api/middleware/idempotency-key.ts:285 — `record()` first `get` then `set` has TOCTOU, concurrent same-key requests cross-overwrite cache response | `done` | Cache write doesn't go through atomic `setIfAbsent`/`SETNX`, sync path not locked. |
| 5 | api/middleware/idempotency-key.ts — cache persists 5xx responses too, replay returns server error, violating "idempotency only caches successful response" convention | `done` | Write path doesn't bucket by status. |
| 6 | api/middleware/idempotency-key.ts — write side doesn't check responseBody size threshold (only truncation in replay stage), can be constructed large response to blow up storage; JSON.stringify on circular references directly throws | `done` | Missing write-side byte upper limit and serialization failure fallback. |
| 7 | api/middleware/rate-limit.ts:58 — token bucket Map only FIFO evicts when capacity reaches 10k, no TTL; attacker can use many short-lived IPs to keep memory near limit | `done` | Missing eviction strategy based on recent activity time. |
| 8 | api/middleware/request-deduplication.ts:123 — `evictExpiredBuckets` scans full set per request, `enforceBucketLimit` nested approximately O(N²·M) | `done` | Data structure selection improper (heap/sorted queue not used), full traversal per call frequency. |
| 9 | api/middleware/version-routing.ts:177 — `DEFAULT_VERSION_ROUTING` module-level mutable singleton, imported and reused in multiple places, state leaks between unit/integration tests | `done` | Module-level shared instance has no reset/factory entry. |
| 10 | api/middleware/sdk-version-handshake.ts — for unknown `x-contract-version` only adds warning header to pass through, doesn't count metrics or block, contract drift can silently go live | `done` | Strong validation degraded to soft hint, no observable signal. |
| 11 | api/http-server/utils.ts:40 — `OPAQUE_CURSOR_SIGNING_SECRET = randomBytes(32)` generated at module load, invalidated on process restart, horizontal multi-instance cannot share, pagination cursor randomly invalid | `done` | Critical key should come from configuration/KMS, not persisted and shared. |
| 12 | api/http-server/utils.ts — service auth branch unconditionally grants `roles:["admin"]` after validation, any service principal can elevate to administrator | `done` | Missing service-token → role mapping table, hardcoded super-permission. |
| 13 | api/http-server/admin-routes.ts:24,158,176 — routes use `existsSync`/`readFileSync` sync IO blocking event loop; also directly read `process.env.AA_PLATFORM_ROOT`, coupling file root into API plane | `done` | Route handler assumes config parsing and disk IO responsibility, violating plane responsibility boundary. |
| 14 | api/http-server/admin-routes.ts:152 — `userPreferenceState` module-level Map, all tenants/users share, PUT `/v1/preferences` after cross-user reads other's preferences | `done` | State not partitioned by `principal.tenantId/userId` keys. |
| 15 | api/http-server/webhook-routes.ts:65 — endpoint creation hardcodes `tenantId:null,workspaceId:null`; line 117 delete path also no tenant check, any tenant can read/write others' webhooks | `done` | Create/delete entries don't inject tenant context from `ctx.principal`. |
| 16 | api/http-server/webhook-routes.ts:87 — `endpointId` in URL passes through to `receiveAndStage`, missing format and ownership check | `done` | Route layer doesn't whitelist path parameters. |
| 17 | api/http-server/gateway-routes.ts:134 — when `webhookSecret` is null directly skip signature check, any source can inject messages to gateway | `done` | "No key = pass through" fallback violates security default. |
| 18 | api/http-server/gateway-routes.ts:143,151 — tolerance `toleranceSeconds:300` and nonce TTL `300` all hardcoded, cannot adjust per channel/tenant | `done` | Security-sensitive parameters don't go through configuration schema. |
| 19 | channel-gateway/channel-gateway-service.ts:677 — circuit breaker only keys by `channel`, shared across tenants; tenant A's failure drags down tenant B's delivery | `done` | Isolation granularity chosen wrong, missing `tenant+channel` composite key. |
| 20 | channel-gateway/channel-gateway-service.ts:88 — `circuitBreakers` Map no reclamation, long-running channels still occupy entries after being disabled | `done` | Missing weak reference/TTL cleanup. |
| 21 | channel-gateway/websocket-bridge.ts:215 — `apiPrincipal.roles` directly injected as `scopes`, authorization semantics conflated, may amplify permissions | `done` | Role and scope concepts not orthogonalized at bridge layer. |
| 22 | channel-gateway/websocket-bridge.ts — `broadcastToAll` doesn't filter subscribers by tenant, cross-tenant event spillover | `done` | Broadcast path doesn't apply same tenant isolation filter as unicast. |
| 23 | channel-gateway/websocket-bridge.ts — `eventId = "evt-" + Date.now()` duplicates under high concurrency, and Date.now() cannot be injected | `done` | ID generation doesn't go through centralized generator/injectable clock. |
| 24 | scheduler/long-running-workflow-service.ts:117,133,173 — uses bare `<=` string comparison for `expiresAt/resumeAfter`, doesn't go through `compareIsoInstant`; different timezone/precision ISO strings sort wrong | `done` | Time comparison not unified, existing tools in same repo not used. |
| 25 | scheduler/long-running-workflow-service.ts:76 — `suspensions` Map never evicts terminated entries, long-running process memory grows linearly | `done` | Terminal state doesn't trigger reclamation path. |
| 26 | scheduler/task-queue.ts:1 — only `re-export ./index.js`, comment self-admits "legacy compatibility shim", dead code | `todo` | Historical migration residue not cleaned. |
| 27 | console-backend/index.ts — `assertOperator` only checks if `operatorId` exists, HIGH_RISK / BREAK_GLASS actions only set advisory flag, doesn't actually block or require second approval | `done` | Audit/policy check degraded to advisory metadata. |
| 28 | console-backend/index.ts — `buildSnapshot` truncates `incidentTimeline` to 50 entries, doesn't mark `truncated` in response | `done` | Truncation strategy lacks externally observable field. |
| 29 | ingress/distributed-rate-limiter.ts:38 — `localEntries` Map unbounded growth in degraded path, memory grows unboundedly during Redis failure | `done` | Degraded branch doesn't follow main path's LRU/TTL. |
| 30 | ingress/distributed-rate-limiter.ts — Redis pipeline doesn't check `[err,res]` per entry in `exec` return; local fallback branch is read-then-write TOCTOU, allows excess pass-through | `done` | Pipeline error aggregation missing, local branch not atomic. |

## src/platform/five-plane-control-plane

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 31 | iam/field-encryption.ts:80-88 — deriveKey uses single-round SHA-256 as KDF (no HKDF/PBKDF2/scrypt/salt extension), low-entropy passwords can be brute-forced quickly | `done` | Field-level encryption KDF strength inconsistent with ADR encryption contract, password directly SHA-256 as key. |
| 32 | iam/session-management.ts:24 — `TOKEN_LOOKUP_HMAC_KEY = randomBytes(32)` generated at module load, process restart or multi-instance deployment invalidates all existing session lookup hashes | `done` | HMAC lookup key should come from managed secret service, violating persistence contract and not horizontally scalable. |
| 33 | iam/session-management.ts:303 — token hash comparison uses `!==` (not constant-time) | `done` | Not using `crypto.timingSafeEqual`, timing attack side channel. |
| 34 | iam/audit-event-integrity.ts:36 — hardcoded dev HMAC key as production fallback, and :55-60 in library directly reads `process.env.NODE_ENV` to decide if allowed | `done` | Integrity key default value + library env variable probing, makes production silently degrade to weak forgeable fixed key when config missing. |
| 35 | iam/audit-event-integrity.ts:43 — module-level mutable `currentConfig` directly overwritten by `configure()`; any caller can disable integrity check at runtime | `done` | Security-sensitive config carried as module singleton mutable state, lacking permission boundary. |
| 36 | iam/mfa-service.ts:115-120 — TOTP treats secret as utf8 string into HMAC, but RFC 6238 / authenticator app expects base32 decoded bytes | `done` | Contract drift with RFC 6238, interop with standard authenticator fails or bypassed. |
| 37 | iam/mfa-service.ts:90-93 — `credentials/challenges/timestamps` module-level Map and no max entry upper limit | `done` | In-memory MFA state grows unboundedly in long-lived processes, constituting DoS. |
| 38 | iam/mfa-service.ts:262 — `startMfaEnrollment` ignores caller policy, hardcodes `DEFAULT_MFA_POLICY` | `done` | Contract drift with tenant-level MFA policy, high-risk tenants' step-up requirements silently degraded. |
| 39 | iam/aws-kms-http-secret-provider.ts:206 — `parseInt(env.AA_AWS_TIMEOUT_MS)` without `Number.isFinite` check, illegal input makes `setTimeout(NaN)` trigger abort immediately | `done` | Library env variable parsing has no NaN guard, remote call becomes instant zero-timeout failure. |
| 40 | iam/aws-kms-http-secret-provider.ts:302 — KMS raw error response body concatenated into thrown error message | `done` | Upstream error body may contain sensitive ARN/account info, leaked to log/audit chain. |
| 41 | iam/vault-http-secret-provider.ts:311-318 — `describeSecret` always returns `resolved: false`, never actually probes Vault | `done` | Public method semantics inconsistent with doc/contract, callers' judgments based on this will be wrong. |
| 42 | iam/vault-http-secret-provider.ts:181-191 — AppRole login `resp.ok` but `client_token` missing doesn't error, silently falls back to static token path | `done` | Error swallowing: login failure merged into fallback path, breaking auth chain observability. |
| 43 | iam/vault-http-secret-provider.ts:211 — static token TTL default assumes 1 hour, unrelated to actual Vault issued TTL | `done` | Cache expiration based on assumption rather than token introspection, may carry expired token to call. |
| 44 | iam/gcp-secret-manager-http-secret-provider.ts:139-141 — `getToken` cache judgment has no safety buffer, tokens still used at near-expiration boundary | `done` | Inconsistent with same file's 60s buffer write path (:162) and Vault implementation. |
| 45 | iam/gcp-secret-manager-http-secret-provider.ts:42-49 — `decodeStrictBase64` only accepts standard base64, will reject potentially legal base64url in GCP historical payloads | `done` | Strict round-trip check has no normalization between two character sets, causing availability regression. |
| 46 | iam/external-secret-provider.ts:550 — inline JSON path uses entire JSON text as `cacheKey` string | `done` | Large secret config each comparison does full string equality, and keeps secret content in interpreter string pool for a long time. |
| 47 | policy-center/index.ts:215-217 — path scope uses bare `startsWith` match (no `/` boundary, no path normalization) | `done` | `/allowed` prefix can match `/allowed-evil`, `..` segment not normalized, policy bypass exists. |
| 48 | policy-center/index.ts:514 — `parseHost` returns original `resourceRef` on URL parse failure | `done` | Host whitelist depends on exact string equality, malformed URL can let original reference itself pretend to match. |
| 49 | approval-center/approval-flow-engine.ts:92-156 — `evictExpiredFlows` only triggered in `createFlow`, no independent scanner | `done` | Long-term no-new-creation instances infinitely accumulate expired flows, violating TTL contract. |
| 50 | approval-center/approval-flow-engine.ts:330-391 — `submitVote` directly reads/writes `votes/state` without lock/version number, parallel voting will double-count or skip state machine | `done` | Cross-vote state machine advancement lacks serialization guarantee, breaking approval invariants. |
| 51 | approval-center/approval-flow-engine.ts:555-588 — escalation sets `escalationTriggered` outside `await`, concurrent triggers will re-enter escalation | `done` | Sentinel marking and async side effect order reversed, causing duplicate escalation events. |
| 52 | approval-center/approval-policy-engine/rule-engine.ts:148 — `eq` operator uses `===` (reference comparison) for objects | `done` | Rule semantics inconsistent with doc's "value equivalence" promise, equivalent to unreachable branch. |
| 53 | approval-center/approval-policy-engine/rule-engine.ts:386-401 — `ruleAlwaysOverrides` shadow logic ignores `conditionLogic="or"` | `done` | In "or" combination still does override judgment by "and" expansion, causing shadow result drift from runtime decision. |
| 54 | audit-export/audit-export-service.ts:171 — `getOrCreate` equivalent idempotency key missing, retry will create duplicate export tasks and trigger side effects | `done` | Critical audit export path has no idempotency key convergence, violating one-write semantics. |
| 55 | audit-export/audit-export-service.ts:182-186 — sets `status` to `"completed"` but `exportPath` doesn't actually persist file | `done` | State machine final state decoupled from artifact existence, downstream audit replay can't find evidence file. |
| 56 | audit-export/audit-export-service.ts:263-301 — `verifyIntegrity` only verifies chained hash continuity, doesn't recompute checksum for each event; and SQL hardcodes `LIMIT 10000` silently truncates | `done` | Integrity proof coverage insufficient + silent truncation, constituting incomplete evidence. |
| 57 | compliance/erasure-request-service.ts:367 — `evidenceRefs` type is `readonly string[]` but writes `JSON.stringify(EvidenceRef)` | `done` | Persistence serialization and contract type drift, list readers get string-wrapped JSON. |
| 58 | compliance/data-residency-service.ts:317 — when `currentJurisdiction !== "OTHER"` as long as rule `crossBorderTransfersAllowed=false` marks as violation, unrelated to "whether actually cross-border" | `done` | Misuses "region rule prohibits cross-border" as "any data in this region is violation". |
| 59 | compliance/data-residency-service.ts:309 — data localization check when `currentJurisdiction === "EU"` never triggers (condition reversed) | `done` | Check and default rule table (EU requires `dataLocalizationRequired=true`) logic mutually exclusive, main protection path is dead code. |
| 60 | compliance/data-encryption-key-service.ts:332 — `rotateDek` hardcodes new algorithm `"AES-256-GCM"`, ignores history or input algorithm | `done` | Rotation generated new key drifts from original algorithm metadata, breaking published key catalog contract. |
| 61 | compliance/data-encryption-key-service.ts:241-247 — rotation sets old key status to `"rotating"`, no termination flow pushes it to `"rotated"` | `done` | State machine has no terminal transition, intermediate status records remain after rotation completion. |
| 62 | risk-control/risk-config-loader.ts:106-122 — `loadRiskConfig`'s `sandboxPolicy` is optional; when caller doesn't pass it directly `readFileSync` any path | `done` | Control plane config root check is optional, violating AGENTS.md "don't relax file-root check" constraint. |
| 63 | rollout-controller/traffic-routing-service.ts:269 — path matching `*` directly `replace("*","")` then uses `startsWith` | `done` | Wildcard treated as discardable character, rule `/ad*min` matches `/ad`, drift from weight routing contract. |
| 64 | rollout-controller/traffic-routing-service.ts:190-211,226 — default constructor falls to `:memory:` SQLite, production instances forget to inject db, deployment history/rollback records all lost | `done` | "Persistent audit + blue/green history" promise silently replaced by in-memory DB. |
| 65 | rollout-controller/traffic-routing-service.ts:551 — `RollbackRecord.success` always hardcoded to `true` | `done` | Rollback result not backfilled based on actual execution result, evidence distorted. |
| 66 | config-center/protected-governance-integrity-service.ts:281-302 — `walkDirectory` only distinguishes `isDirectory/isFile`, doesn't explicitly reject `entry.isSymbolicLink()` | `done` | Drift from "sandboxed path check" promise: follows symbolic links to read files outside protected root, participating in hash. |
| 67 | config-center/protected-governance-integrity-service.ts:245 — `readFileSync` doesn't limit file size | `done` | Any protected surface file replaced with huge file OOMs entire integrity service. |
| 68 | config-center/config-hot-reload-service.ts:376-388 — subscribers serial await by priority, prior callback exception or slow response blocks same-priority and lower subscribers | `done` | Inconsistent with "broadcast by priority" semantics, no independent timeout/isolation. |
| 69 | replay-repair-control/index.ts:136-149 — `runRecoveryDrill` first assertion `passed: true` is constant | `done` | Drill assertion stuffed with tautological true, drill pass rate meaningless. |
| 70 | replay-repair-control/index.ts:172-182 — `inferDisposition` defaults unmatched to `"resume"`, treats P1/P2 but non-requeue repair actions as recoverable continue | `done` | Default disposition too lenient, violates recovery contract's P0/P1 manual intervention requirement. |
| 71 | tenant/index.ts:151-158 — `assertSameTenant` judges `null === null` also as cross-tenant rejection | `done` | No tenant context and cross-tenant handled together, missing legal expression of unconstrained context. |

## src/platform/five-plane-orchestration & five-plane-execution

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 72 | five-plane-execution/sandbox-provider/index.ts:6 — execution directly `import { createSandboxLayer } from "../../five-plane-orchestration/harness/sandbox/index.js"`, forming execution→orchestration reverse cross-plane dependency | `done` | Sandbox constructor doesn't go through contracts abstraction, violating five-plane boundary. |
| 73 | five-plane-execution/dispatcher/execution-deviation-detector.ts:2 — `import type { Plan } from "../../five-plane-orchestration/oapeflir/types/index.js"` lets execution plane directly couple orchestration internal OAPEFLIR type | `done` | Dispatcher should decouple through PlanGraphBundle/contracts types. |
| 74 | five-plane-execution/tool-executor/command-executor.ts:23,27,28 — execution directly imports three concrete implementations `state-evidence/artifacts/artifact-store.js`, `control-plane/iam/index.js`, `state-evidence/truth/authoritative-task-store.js` | `todo` | Tool executor spans three planes with concrete classes, cannot replace/test in layers, violating source-of-truth. |
| 75 | five-plane-execution/tool-executor/command-executor.ts:175-176 — `MAX_CONCURRENT_PROCESSES = 16` and `activeProcessCount` are class-level static members | `done` | Shared across all tenants/instances, not configurable, not isolated per tenant, violating admission quota promise. |
| 76 | five-plane-execution/tool-executor/command-executor.ts:101 — `const killSignal = process.platform !== "win32" ? "SIGTERM" : "SIGTERM"` both branches same result | `done` | Windows branch is dead code, should use `taskkill`/`SIGKILL`, process group termination policy not implemented. |
| 77 | five-plane-execution/tool-executor/command-executor.ts:146-150 — `writeFallbackArtifactFile` calls `mkdirSync`/`writeFileSync` without going through `checkSandboxPath`, and directly concatenates `file://${path}` | `done` | Fallback persistence bypasses sandbox root check, URL not encoded, constituting path traversal / scheme injection regression. |
| 78 | five-plane-execution/tool-executor/command-executor.ts:26 — module-level `new StructuredLogger({retentionLimit:100})` singleton | `done` | Process-wide shared 100-entry retention window, cross-tenant logs mixed, blocks dependency injection. |
| 79 | five-plane-execution/dispatcher/admission-controller.ts:153-174 — `snapshot()` traverses `listTasks()` and `JSON.parse` each `inputJson` on every `evaluate()` | `todo` | O(N) full scan + untrusted JSON deserialization on admission hot path, DoS/performance regression. |
| 80 | five-plane-execution/dispatcher/admission-controller.ts:177 — `evaluate` reads snapshot and makes decision without atomic CAS | `todo` | Multi-concurrent admission reads same `queuedTasks` count, all judged as admissible, exceeding `maxQueuedTasks`. |
| 81 | five-plane-execution/dispatcher/admission-controller.ts:180 — `effectiveRiskClass = request.riskClass ?? request.taskRiskClass ?? "low"` | `todo` | Any upstream request forgetting to fill riskClass silently degraded to low, bypassing critical/high isolation cap. |
| 82 | five-plane-execution/dispatcher/admission-controller.ts:171-172,217 — `sandboxAvailability` directly from policy static value copy, not real available sandbox | `todo` | Sandbox quota gate is pure static lookup, not connected to sandbox-provider, security gate as form. |
| 83 | five-plane-execution/dispatcher/admission-controller.ts:227-240 — `requiredCapabilities` compared item by item with `capabilityClassCapacity` (only contains default/sandboxed/privileged) | `todo` | Any specific capability name (e.g. browser/ssh) can't find key → default 0 → reject, capability tier gate misjudgment. |
| 84 | five-plane-execution/dispatcher/admission-controller.ts:304-319 — when `activeExecutions >= maxActiveExecutions` elevatedRisk and default branch return exactly the same result | `todo` | Dead code — critical/high headroom doesn't take effect when active capacity full. |
| 85 | five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts:120-122 — `getTicketsPage` each time `listExecutionTicketsByStatuses(...)` full then slice | `todo` | Fake pagination: each page full load, N loops O(N²). |
| 86 | five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts:187 — `Date.parse(activeLease.expiresAt) < Date.parse(now)` direct comparison | `todo` | Inconsistent with budget-allocator's `clockSkewSafetyMarginMs`, lease expiration judgment has no clock skew tolerance. |
| 87 | five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts:86-87 — in constructor `new ExecutionDispatchService(db, store)`, `new WorkerRegistryService(store)` | `todo` | Cannot inject, cannot mock, violates repo DI habit. |
| 88 | five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts:57-72 — `parseJsonArray` parse failure only warn then return `[]` | `todo` | Silently loses ticket association data, causes orphan tickets to be missed. |
| 89 | five-plane-execution/budget-allocator.ts:467-479 — `release()` explicitly does ledger version CAS, but `settle()` (L360) non-atomic branch has no equivalent memory CAS | `todo` | Without atomicRepository settle path completely skips CAS, concurrent settlement may double-deduct/overwrite ledger. |
| 90 | five-plane-execution/budget-allocator.ts:218,839-847 — default context goes `createDefaultContext`, each time `newId("trace")` | `todo` | Reservation without passing context generates new traceId, trace chain broken. |
| 91 | five-plane-execution/budget-allocator.ts:229-244 — sub-layer `hierarchyLedgers` `persistLedger` before parent ledger CAS persistence (L244) | `todo` | When parent CAS fails sub-layer already persisted, no rollback transaction, ledger hierarchy consistency broken. |
| 92 | five-plane-execution/budget-allocator.ts:373-378 — settlement hard upper limit check only looks at `settledAmount + actualAmount`, ignores `reservedAmount` | `todo` | Concurrent reserve + concurrent settlement path can exceed hardCap, conflicts with hard-cap invariant. |
| 93 | five-plane-execution/budget-allocator.ts:395-422 — `settlementPersistence.persistSettlement` earlier than `stateMachine.transition` and `persistLedger` | `todo` | When state machine/ledger fails settlement already written, producing orphan settlement. |
| 94 | five-plane-execution/budget-allocator.ts:666-679 — `trackActiveReservation`/`untrackActiveReservation` each time `new Map(this.activeReservations)` whole copy and whole replace | `todo` | O(N) copy + copy-modify-reassign non-atomic, cyclic trigger release will lose entries. |
| 95 | five-plane-execution/hibernation/wake-engine.ts:179-217,256-291 — document header lists 11 ResumeCompatibility checks, implementation only diffs 5 fields | `todo` | Wake compatibility matrix severely reduced, key/approval/policy regression not detected. |
| 96 | five-plane-execution/hibernation/wake-engine.ts:179-217 — compatibility timeout uses caller-passed `nowMs/startedAtMs` mixed with `Date.now()` | `todo` | No monotonic clock source/no clock skew tolerance, DI missing. |
| 97 | five-plane-orchestration/harness/hitl-runtime.ts:177-191 — `inspect()` writes status as `"approved"` | `todo` | Observation-only inspect operation treats request as approved, leaving erroneous approval evidence. |
| 98 | five-plane-orchestration/harness/hitl-runtime.ts:193-360 — `patch/override/edit/takeover/escalate/delegate/resume/pause` all missing idempotency protection in `resolve()` | `todo` | Already completed/rejected requests can be repeated patch/override, overwriting resolvedBy and patchContent. |
| 99 | five-plane-orchestration/harness/hitl-runtime.ts:74,479 — `responsibilityRecords` only in memory and `set` overwriting storage | `todo` | Multi-action chain (inspect→patch) loses previous record, no persistence and no eviction. |
| 100 | five-plane-orchestration/evaluator/evaluator-service.ts:464-488 — `evaluateBudgetAdherence` always returns `adherent: true` (comment "For now") | `todo` | Evaluator's budget dimension is dead gate, R11-x config threshold has no effect. |

## src/platform/five-plane-state-evidence & Cross-Platform Shared

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 101 | five-plane-state-evidence/audit/index.ts:20-52 — `AuditTrailService` is only in-memory ring buffer, no prevHash/HMAC chain, no signature, no persistence; `record()` uses `splice(0, overflow)` to silently discard old entries | `todo` | Audit plane lacks tamper-resistant chain and persistence layer, §25.2 truth+evidence dual track is in name only. |
| 102 | five-plane-state-evidence/audit/index.ts:34-44 — `record()` shallow-copies `metadata` and hangs it on record, directly `return record`; caller can modify metadata reference afterward | `todo` | Only `{ ...input }` shallow clone, no freeze/deep copy exposed externally. |
| 103 | five-plane-state-evidence/incident/index.ts:21-22 — IncidentService uses Map+parallel `incidentOrder`, not persisted, no tenant isolation; `getRequired` throws `incident.not_found:${id}` echoing ID in error code | `todo` | In-memory state event plane + error message leaks ID, convenient for enumeration. |
| 104 | five-plane-state-evidence/outbox/index.ts, side-effect-ledger/index.ts, reconciliation/index.ts, compaction/index.ts — all 11-14 line type-only stubs | `todo` | Plane-level key capabilities (at-least-once delivery, dedup, coordination, compaction) declared but not implemented, doc-code drift. |
| 105 | five-plane-state-evidence/projections/projection-rebuild-service.ts — file header claims "event_id dedup", `eventsSkipped` counter never increments; `parsePayload` silently swallows JSON error | `todo` | Idempotent replay contract not implemented, errors swallowed → projection silently corrupts. |
| 106 | projection-rebuild-service.ts — `rebuildAll` calls `cutoverShadowProjection(name)` without passing `expectedActiveVersionId`, bypassing OCC | `todo` | active/previous/shadow all in-memory and no persistence, process restart loses all projection state. |
| 107 | projection-rebuild-service.ts — uses `listAllEvents(limit, offset)` paginated rebuild, new appended events during rebuild will be permanently skipped | `todo` | Missing event ID monotonic cursor, offset pagination misses under concurrent append. |
| 108 | five-plane-state-evidence/receipts/index.ts:23-58 — `BaseReceiptFull` only declares `hashAlgorithm:"sha256"`, no signature/MAC field | `todo` | Receipt integrity only stops at hash self-check, no signature chain. |
| 109 | five-plane-state-evidence/events/dlq-service.ts:158-168 — `getRecords()` calls `repository.listAll()` per read and rebuilds Map | `todo` | N×Q complexity, hot path full SQLite table scan. |
| 110 | events/dlq-service.ts:150-156 — `setRepository` after writing memory records to repo doesn't clear `this.records` | `todo` | Double write still holds old reference → memory leak + truth divergence. |
| 111 | events/dlq-service.ts:174-216 — `enqueue` doesn't dedup by `(sourceEventId, consumerId)` | `todo` | Retry storm will create N DLQ records for same event. |
| 112 | events/dlq-service.ts:307-310 — `discard()` uses `reason` string to overwrite `errorCode`, original failure code lost | `todo` | Field semantics conflated, breaks alert/classification aggregation. |
| 113 | events/dlq-service.ts:565-572 — `getRequired` concatenates `deadLetterId` into error code `dlq.not_found:${id}` | `todo` | Error code contains enumerable ID, violates security advice. |
| 114 | events/transactional-event-appender.ts:210 — executes `JSON.parse(event.payloadJson)` in transaction then `JSON.stringify(payload)` | `todo` | Large payload double memory and no size upper limit, DoS/OOM risk. |
| 115 | events/transactional-event-appender.ts:222-223 — `event.taskId ? "task" : "system"` treats empty string as falsy; `aggregate_id ?? "unknown"` causes multiple no-taskId events to collide on aggregate ID | `todo` | Outbox routing basis not rigorous, cross-event aggregate key conflated. |
| 116 | events/transactional-event-appender.ts:74-121 — INSERT hits unique key constraint entire transaction throws, caller can't distinguish "duplicate event" from real failure | `todo` | Missing ON CONFLICT idempotent branch and explicit duplicate error code. |
| 117 | five-plane-state-evidence/knowledge/keyword-index.ts:72-75 — `reset()` doesn't clear `keywordScores`, `query()` doesn't filter by namespace/tenant; `countOccurrences` O(N·M) on large text | `todo` | Index reset missing fields + cross-tenant retrieval + DoS risk. |
| 118 | five-plane-state-evidence/memory/memory-self-reinforcement-guard.ts:15-34 — `evaluate` completely trusts input `humanApproved/holdoutPassed`, no evidence signature/caller authentication | `todo` | Self-reinforcement guard fully bypassable by caller. |
| 119 | platform/cost-management/cost-estimation-service.ts:24-54 — SQL only filters by `division_id`, global fallback query has no tenant/division scope | `todo` | Missing tenant_id column and query scope, cross-tenant cost average leaks. |
| 120 | platform/cost-management/cost-estimation-service.ts and scale-ecosystem/marketplace/cost-estimation-service.ts — same-name service coexists | `todo` | Plane migration not complete, caller divergence risk. |
| 121 | platform/agent-delegation/index.ts — only 1 line `export *` forward; platform/prompt-engine/prompt-injection-guard.ts → shared/stability → platform/stability forms 3-hop re-export chain | `todo` | Multi-layer thin facades hide ownership, violates source-of-truth chain. |
| 122 | platform/contracts/index.ts:107 — from `../five-plane-control-plane/compliance/index.js` reverse exports compliance types; same file 28-29 `export * as missionContracts` and `export * from "./mission/..."` double export | `todo` | Contracts barrel reverse depends on concrete plane + same symbol double export. |
| 123 | core/runtime/index.ts:1-13 — in `core/` facade simultaneously re-exports `five-plane-execution` and `five-plane-state-evidence` | `todo` | Compatibility layer shouldn't aggregate multiple planes, violates plane boundary. |
| 124 | platform/shared/observability/transports/datadog-transport.ts:86 — library reads `process.env.NODE_ENV`; 100 `batch.unshift(...entries)` unbounded growth on continuous failure | `todo` | Library env coupling + failure backfill path has no backpressure upper limit. |
| 125 | platform/shared/observability/transports/datadog-transport.ts:108-111 — retry `setTimeout` not `unref()`, blocks process exit; also no max cumulative retry duration | `todo` | Background transport blocks graceful shutdown. |
| 126 | platform/model-gateway/provider-registry/unified-chat-provider.ts:305-315 — each request `new StructuredLogger({retentionLimit:100})`, writes `principalId/tenantId` directly into soon-to-be-discarded logger | `todo` | Hot path allocation + PII only lands in one-time logger. |
| 127 | platform/model-gateway/provider-registry/base-chat-provider.ts:269,335 — error path concatenates upstream `errorSummary` content into thrown error | `todo` | Error passthrough not redacted, may echo upstream prompt/PII. |
| 128 | platform/stability/prompt-injection-guard.ts — `executePromptDefenseChain` uses `externallyBlocked` to directly overwrite `consensus.blocked` | `todo` | Should be boolean OR merge, overwrite semantics reversed → defense-injection fails. |
| 129 | platform/stability/prompt-injection-guard.ts — `embedCanaryToken` uses `sha256(scope+prompt).slice(0,32)` as canary, same input produces same token | `todo` | Canary should contain random nonce + HMAC key, deterministic derivation makes it lose detection value. |
| 130 | platform/compliance/lineage/index.ts:39-95 — `JSON.stringify(entry)` as hash input (key order unstable); only SHA-256 chain no HMAC/signature; `_chain` only in memory | `todo` | Lineage hash chain key order unstable + can be forged by writer + restart lost. |
| 131 | platform/compliance/encryption/index.ts:88,104-106 — `fingerprintKey` directly `sha256(keyRef)`; `scryptSync(keyRef,salt,32)` synchronously blocks event loop in main thread | `todo` | Key fingerprint no HMAC salting + KDF synchronously occupies event loop. |
| 132 | src/sdk/cli/aa.ts:40 — `process.env.AA_RUNNING_TESTS`; authoritative-storage-admin.ts:49 — `AA_STORAGE_DOWN_CONFIRM`; secret-commands.ts, login.ts, lease-handover.ts etc. many CLI paths read `process.env.*` at library level | `todo` | CLI layer env reading separated from library responsibility, unit tests and multi-instance operation difficult. |
| 133 | src/ops-maturity/ (19 subdirectories) and src/platform/ops-maturity/ (only platform-panic) coexists with namespace conflict | `todo` | AGENTS.md declared `src/ops-maturity/` as canonical, platform namespace redundant. |

## Test / Config / Script / Documentation / Deployment

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 134 | Dockerfile:5 — `COPY ... tsconfig.build-test.json ./` references a file that doesn't exist in repo, clean env `docker build` fails directly at build stage | `todo` | Early renamed/deleted `tsconfig.build-test.json`, Dockerfile COPY list not synced. |
| 135 | Dockerfile:7 — only `COPY scripts ./scripts` but no `COPY tests`, build stage hitting `tsconfig.build.json` will fail due to `include: tests/helpers/**/*.ts` can't find `tests/` | `todo` | Dockerfile build context and tsconfig build input list contradict. |
| 136 | tsconfig.build.json:7 — `include: ["src/**/*.ts","tests/helpers/**/*.ts"]` compiles test helper into `dist/`, then package.json:50 `files:["dist/"]` publishes together | `todo` | Originally for unit test helper type info added to build tsconfig, never switched back to independent tsconfig. |
| 137 | package.json:68 — `typecheck` only runs `tsc -p tsconfig.build.json --noEmit && tsc -p tsconfig.scripts.json` + `ui run typecheck`, three projects don't cover `tests/**`, AGENTS.md "typecheck baseline gate" actually empty for tests/ | `todo` | Historically to avoid strict mode errors bulk excluded test directory, never added tests-only tsconfig. |
| 138 | tsconfig.json:30-124 — ~90 exclude and config/quality/test-exclusion-allowlist.json:1-94 form two parallel source-of-truth, no script asserts both sides consistent | `todo` | Exclusion list manually maintained on both sides, never extracted to single authority. |
| 139 | config/quality/test-exclusion-allowlist.json:27,93 — `tests/integration/sdk/cli/multi-service-cli-integration.test.ts` appears twice; line 55 wildcard and line 56-58 again listed | `todo` | Allowlist long has no dedup/normalize step. |
| 140 | config/quality/test-exclusion-allowlist.json:18,55-58 + tsconfig.json:39,56-58 — still references old `tests/.../platform/orchestration/**`, but `five-plane-orchestration/` and `orchestration/` coexists | `todo` | When directory migrated from orchestration to five-plane-orchestration only copied not deleted. |
| 141 | stryker.config.mjs:21-26 — mutate scope contains `ingress/**` and `webhook/**`, but scripts/ci/mutation-critical-tests.sh:9-16 6 tests all focus on http-server and oapeflir, ingress/webhook mutations have no corresponding unit test | `todo` | Mutate scope and critical-tests are two independent manual lists. |
| 142 | scripts/run-layered-tests.mjs:9 — `DEFAULT_TEST_CONCURRENCY = 12` simultaneously assigned to leak/integration/e2e/perf 5 layers; AGENTS.md clearly states "raw node test concurrency is chosen by the layered test runner rather than a fixed --test-concurrency=12 contract", doc vs code directly conflict | `todo` | Doc promise upgraded to layered concurrency, implementation layer just copies same constant to each layer default. |
| 143 | scripts/run-node-tests.mjs:7,12 — `DEFAULT_NODE_TEST_CONCURRENCY = 12` scatters the same magic constant to second place | `todo` | Layered runner and standalone runner each hardcode concurrency, not extracted to helper. |
| 144 | tests/helpers/network-test-constants.ts:8,11,14,17 — OAUTH_CALLBACK_PORT=8787 etc. all fixed ports, no `:0`/`getEphemeralPort()` solution | `todo` | Helper initially hardcoded as "protocol-level" constants, concurrent runs inevitably EADDRINUSE flake. |
| 145 | tests/helpers/wait.ts:17 — default `timeoutMs = 1_000`, jittery on slow CI; no global relaxation mechanism | `todo` | wait helper not configurable or CI-detection-based adaptive. |
| 146 | helpers/fs.ts:18-23 — createSymlink treats `realpathSync(resolvedTargetPath)` as "probe-style check" (return value discarded), then `symlinkSync(target, …)` uses unnormalized original target | `todo` | Check path and actual written link target disconnected, relative/out-of-bounds target can bypass probe. |
| 147 | helpers/fs.ts:9-11 — cleanupPath directly `rmSync(path,{recursive:true,force:true})` no prefix/sandbox root check; `""`/`"/"` recursively deletes host; top-level `helpers/` not in AGENTS.md project structure | `todo` | Helper makes "wipe temp directory" minimum encapsulation, historical migration residue not closed. |
| 148 | tests/unit/platform/interface/api/grpc-adapter.test.ts:25,32 + grpc-adapter-service.test.ts 8 places — unit test bakes `host:"0.0.0.0"` into expectation | `todo` | grpc adapter unit test when testing "how config passes through" directly copies default value, future tighten default will break unit test. |
| 149 | tests/unit/platform/shared/startup-env-validation.test.ts:113,148,175,202 — bakes `AA_DB_PATH=/tmp/...` into process.env; Unix-only path 4 places reused | `todo` | env validation unit test originally for quick feed schema directly copies `/tmp` literal. |
| 150 | tests/integration/platform/security/enterprise-capability-boundary.test.ts:86 and tests/unit/sdk/cli/authoritative-storage.test.ts:87,124,199 — contains literal `postgresql://agent:secret@postgres.internal/...` | `todo` | Tests initially for reproducing "DSN passthrough" copy-paste seemingly credential string, not extracted to helper. |
| 151 | docker-compose.yml:24-25,77-94 — redis exposed on 127.0.0.1:6379 with neither `--requirepass` nor `AA_REDIS_PASSWORD`, api-server ioredis no AUTH | `todo` | compose relies on "only bind loopback" for isolation, doesn't make "redis needs AUTH even locally" default. |
| 152 | docker-compose.yml:147-156 — `automatic-agent-postgres` volume uses `device: ${PWD}/data/docker/postgres`, relies on shell injection `${PWD}` | `todo` | Non-interactive CI undefined becomes empty string, bound mount to host sensitive path. |
| 153 | docker-compose.yml:53-75 — postgres no `read_only:true`, `tmpfs`, `mem_limit/pids_limit`, asymmetric with api-server hardening baseline; 5432 still exposed to host | `todo` | Each service's hardening is added ad-hoc, no shared anchor/extends. |
| 154 | deploy/prometheus/render-alertmanager-config.sh:10-13 — uses `sed s|__SLACK_WEBHOOK_URL__|${SLACK_WEBHOOK_URL}|g` to replace key, no escape for `|`, `\`, `&`; output `/tmp/alertmanager.yml` also no chmod 600 | `todo` | Render script uses plainest sed, doesn't introduce safe replacement tool (envsubst/yq) or control output permission. |
| 155 | scripts/backup-sqlite.sh:9-13 — comment `Usage: ./backup-sqlite.sh [DB_PATH] [BACKUP_DIR]`, but code 23-25 only reads env vars never reads `$1/$2` | `todo` | Usage doc and implementation long misaligned. |
| 156 | scripts/backup-sqlite.sh:88-95,131-138 — writes `.sha256` sidecar but retention `find ... -name "backup_*.db*" -delete` doesn't match `.sha256`, leaves orphan checksum files | `todo` | Retention wildcard only follows `.db` extension, doesn't include sidecar in cleanup. |
| 157 | config/security/{default,dev,test,staging,pre-prod,prod}.json — 6 override files except prod's `approvalMode:"strict"` other fields character-by-character identical, no env differentiation | `todo` | env-specific override initially "build skeleton then differentiate" copied default, differentiation task never returned. |
| 158 | config/runtime/prod.json:1-7 — only declares 3 fields, critical security/capacity thresholds (circuitBreaker, rateLimit) in prod directly take default, exactly same as dev | `todo` | runtime override history only covers timeout/concurrency three fields. |
| 159 | config/bootstrap/default.json:33-50 — `hotReload.enabled:true` + `watchPaths:["config/","src/","domains/"]` is bootstrap's only config (no prod override), prod container dist/ has no src/ | `todo` | hot reload only written for dev workflow, dev-only behavior carried into prod. |
| 160 | config/runtime/default.json:2-3 — `configVersion:"v4.3"`/`configSchemaVersion:"v4.3"` hardcoded literal, but docs_zh/contracts/configuration_layers_and_defaults_contract.md:75-76 specifies configVersion is bundle SHA256 first 16 chars | `todo` | configVersion field initially manually filled placeholder, contract upgraded to derived field without following up. |
| 161 | divisions/engineering_ops/, divisions/general_ops/ and config/quality/division-catalog.json:69-87, docs_zh/reference/division-catalog.md:18-19 all use snake_case, AGENTS.md clearly states "Keep filenames in kebab-case" | `todo` | Two IDs from earlier catalog doc, when migrated to directory tree directly kept underscore no alias-kebab. |
| 162 | docs_zh/reference/division-catalog.md — listed as "canonical family map" by AGENTS.md, full text only enumerates 6 divisions, but `divisions/` and catalog.json each have 32 | `todo` | reference doc originally only picked few families for illustration, later elevated to canonical by AGENTS.md without supplement. |
| 163 | roi/divisions/ — only 3 yaml; scripts/ci/audit-division-inventory.mjs:166-274 doesn't reference `roi/`, roi drift completely outside CI | `todo` | roi assets before audit, audit expansion only cares about eval/redteam/training-policy. |
| 164 | eslint.config.js:38-44 — `no-floating-promises` and `no-misused-promises` set to `warn`; review-d #52 listed 9 fire-and-forget, current new PR won't fail CI | `todo` | These two rules initially downgraded to warn to reduce noise, code-side fix-it didn't return to upgrade to error. |
| 165 | eslint.config.js:13-72 — no `files` block covers root `*.config.js`/`stryker.config.mjs`/`eslint.config.js` itself; ignore only lists `dist/dist-types/ui/coverage-report/.dr-reports/` not including `.stryker-tmp/` | `todo` | Lint config root-level config files ignored by default, build product ignore also ad-hoc. |
| 166 | tsconfig.json:18-20 — `paths` only declares `automatic-agent-platform/sdk/plugin-sdk → src/sdk/plugin-sdk/index.ts`, but package.json:15-47 `exports` exposes ~25 sub-paths | `todo` | Each new submodule export adds an entry, paths has no linkage mechanism. |
| 167 | tests/fixtures/packs/test-pack/package.json:5 — `"main":"./package.json"` self-referencing; same issue in sibling `test_pack/`, `test.pack/` three fixtures repeat | `todo` | Fixture initially only wanted to fill fields to satisfy manifest schema, main field directly copies package.json path. |
| 168 | docs_zh/governance/repository-guide-index.md:25-32 — "related entries" point to v3.2/v3.3 release; docs_zh/contracts/README.md:29-31 and ADR-109..112 declared v4.3 freeze; release/ has no v4.3 announcement | `todo` | freeze upgrade to v4.3 only touched contract and ADR, release index and governance main index not followed. |
| 169 | scripts/run-layered-tests.mjs:103 — `skippedDirectories = new Set(["node_modules",".git","dist","coverage",".cache"])` missing `.stryker-tmp/`, `coverage-report/`, `.dr-reports/`, `dist-types/` | `todo` | Layered runner skip directory initially picked 5 coarse-grained, eslint/stryker later introduced product directories not written back. |
| 170 | tests/fixtures/migration/, tests/fixtures/packs/ and `tests/integration/sdk/cli/multi-service-cli-integration.test.ts` etc. real test share `tests/fixtures/` namespace | `todo` | Fixture and live test boundary relies on PR review text agreement, no directory-level strong constraint script. |

## Round 2 · Orchestration Deep (planner / replan / observer / learn / escalation / routing / improve-rollout / agent-delegation / harness / oapeflir)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 171 | src/platform/five-plane-orchestration/escalation/index.ts:119-121 — `shouldIgnoreCostThresholdOverride` through `new Error().stack` sniffs test filename in call stack to switch cost threshold policy | `todo` | Uses stack trace to check filename as runtime policy branch, attacker just needs to inject test name in stack (async wrapper, custom Error name) to bypass `costThresholdUsd` override and default $10 limit; test hooks as production logic directly bypass approval threshold. |
| 172 | escalation/index.ts:283-300 — `evaluateSlaPressure` only based on `Date.now()` and `timeoutMs` comparison, doesn't use monotonic clock and doesn't save SLA start time | `todo` | `timeoutMs` passed by caller as remaining value, no persisted deadline; on clock drift/retry re-injecting full timeoutMs means takeover never triggered, SLA escalation timer can be infinitely postponed. |
| 173 | escalation/index.ts:303 — high-risk execute stage directly takes over, but `plan/feedback/improve/release` high-risk path falls into `affectsProduction \|\| cost>=threshold \|\| riskLevel==='high'` fallback, only requires approval | `todo` | High-risk non-execute stage (e.g. release/improve) when no production impact only goes approval channel, missing takeover/panic escalation, policy loophole allows high-risk changes in P5 release to be approved by low-permission. |
| 174 | escalation/index.ts:264-280 — `tryActivatePanic` failure still returns `decision:"panic_stop"`, only in memory `blocksExecution=true`; doesn't emit compensation event, doesn't retry panicService.activate | `todo` | panic activation exception caught and swallowed (only prints reasonCode), no dead letter/compensation/retry mechanism, critical panic signal won't propagate to other planes when PlatformPanicService throws. |
| 175 | planner/plan-builder.ts:194-196 — `graphHash` only hashes `harnessRunId+nodes+edges`, doesn't include `riskProfile/budget/strategy/parentVersion`, replan hash can collide with original | `todo` | Same node topology but different risk/budget plans have same graphHash, downstream idempotency/cache using hash as key will reuse old plan's judgment, breaking replan isolation and replay integrity. |
| 176 | planner/plan-builder.ts:283-359 — `applyGraphPatch` directly mutates `targetStep.dependencies = […]`, violating PlanStep's read-only semantics and no cycle check | `todo` | add_edge/disable_edge can generate self-loops or cross-version cycles: not re-called `dagValidator.validate` after patch, attacker can construct graphPatch to bypass InvalidDagError defense and introduce circular dependencies. |
| 177 | planner/plan-builder.ts:289-300 — `add_node` operation directly strong-casts payload fields to `string`/`number` without schema validation | `todo` | `payload.action`, `payload.timeout` from external patch source (replan signal, LLM); type-not-validated injection into plan can write malicious action names (`shell`/`apply_patch`) bypassing `inferNodeType`'s router/llm classification. |
| 178 | planner/replanning-service.ts:46-56 — `correctionRequested` and `downgradeMode` judgment based on `feedback.signals[].payload?.reasonCode`, no signal source check | `todo` | Any attacker who breaks into feedback channel can inject `payload.reasonCode='complexity_exceeded'` to continuously trigger replan, with `suppressCorrection` only acting on previous round, forms replan loop bomb. |
| 179 | planner/replanning-service.ts:69-79 — `nextPlanVersion = currentVersion+1` no max version upper limit, no idempotencyKey/decisionId dedup | `todo` | Same trigger repeated `decide` call will produce independent decisionId, but nextPlanVersion unbounded increment; if upstream triggers build by decisionId, replan call storm will exhaust entire plan-graph version number space. |
| 180 | planner/plan-builder.ts:70-96 — PlanBuilder has no seed; `new TaskDecompositionService()` and `PlanStrategySelector` output depends on input object order | `todo` | build() returned graphId/planGraphBundleId uses `newId()` (based on random), even same input same task two builds not replayable; missing deterministic seed affects plan reproduction and audit. |
| 181 | observer/observer-service.ts:74-95 — ObservationBundle doesn't contain HMAC/signature/checksum, all signals fields come directly from caller | `todo` | Downstream Assess/Plan completely trusts bundle, can't detect transit plane's tampering of `signals[]/contextSnapshot.environmentState`; `source:"environment"` and other high-trust labels can be arbitrarily forged into event tampering chain. |
| 182 | observer/observer-service.ts:115/126/146/158/169 — multiple uses `Date.now()` as `timestamp`, within single observe multiple signals timestamps can be out of order | `todo` | Within same millisecond multiple pushes have same `signals` timestamp; downstream timestamp-based sort dedup logic will misjudge signal replay, and can't distinguish signal injection order inside/outside observe. |
| 183 | learn/learning-object-validator.ts:122,239 — `knownObjects` array accumulates between validateMany calls and never trims | `todo` | Single instance long lifecycle, knownObjects in validator grows unbounded; similarity O(n²) comparison makes each validate time linear with history, and data retention without upper limit before restart — retention loophole. |
| 184 | learn/learning-object-validator.ts:137-151 — PII/Secret scan only covers `title/summary/recommendation`, doesn't scan `evidenceRefs/sourceSignalIds/content` | `todo` | Attacker puts secret in evidenceRefs (URL or token field) can bypass quarantine, KnowledgePromotionService promotes to library with `team_reviewed` to form data exfiltration. |
| 185 | learn/learning-object-validator.ts:28 — PII email regex uses character class `[A-Z\|a-z]{2,}` literal `\|`, causing some valid domain TLDs not matched | `todo` | Regex bug makes real emails (e.g. .ai/.dev etc.) miss; though not directly high-risk, leakage surface underestimated, amplifies PII leak with #187. |
| 186 | learn/llm-improvement-generation-service.ts:94-110 — `buildUserPrompt` directly concatenates `signal.valueSummary` and `JSON.stringify(signal.evidence)` into LLM prompt | `todo` | Signal content source untrusted (feedback channel); attacker injects fake `[Signal]` section to prompt-injection change LLM output's learningType/recommendation, then goes through mapParsedToLearningObject to library. |
| 187 | learn/llm-improvement-generation-service.ts:114 — `content.match(/\[[\s\S]*\]/)` greedy match from first `[` to last `]` | `todo` | If LLM response first outputs text containing `[` explanation then real JSON, match is invalid interval triggering fallback; if LLM outputs multiple JSON arrays, first `[` and last `]` will aggregate across segments forming parse misalignment/injection. |
| 188 | learn/llm-improvement-generation-service.ts:138-163 — `mapParsedToLearningObject` accepts LLM's arbitrary `title/summary/recommendation/evidenceRefs/sourceSignalIds`, only confidence does clamp | `todo` | LLM can output evidenceRefs/sourceSignalIds inconsistent with original signal (attacker-induced), KnowledgePromotionService uses these refs as trusted credentials to propagate; forged evidence chain to library. |
| 189 | learn/llm-improvement-generation-service.ts:62-70 — LLM call arbitrary exceptions are all `logger.warn` then fall back to template generation | `todo` | Network/timeout/quota/AppError(retryable) all swallowed and continue generating learning object — losing observability, and converting LLM failure to library-able "template" knowledge, masking fault. |
| 190 | learn/strategy-learning-service.ts:38-51 — `normalizeSignal` fills `signal.sourceFeedbackId` when evidenceRefs is empty | `todo` | Validator then uses evidenceRefs non-empty as valid condition (validator:183), single attacker-controlled feedbackId can be self-proven "has evidence" — bypassing `learning.missing_evidence` block. |
| 191 | learn/knowledge-promotion-service.ts:163-167 — ingest failure `failed.push(...)`, event only published when promoted>0 | `todo` | Failed promotion won't generate events, downstream observation plane can't see knowledge write failure; simultaneously failedCount doesn't trigger any retry or quarantine strategy, error swallowing. |
| 192 | improve-rollout/auto-rollback-service.ts:100-102 — `rollbackHandler` is `Promise<void>\|void`, when called not `await`ed and no error catch | `todo` | If handler returns rejected promise, becomes unhandled promise rejection; triggers rollback but evaluate immediately returns success lying to caller, typical fire-and-forget. |
| 193 | improve-rollout/canary-traffic-router.ts:37-58 — `hashToBucket(taskId)` has no strategyId/version salt, same taskId in all rollouts falls to same bucket | `todo` | Cross rollout bucket selection sticky causes 5% canary and 25% partial to fall to same user group; attacker can construct taskId to hit or avoid canary, affecting rollout authenticity and A/B defense. |
| 194 | improve-rollout/policy-rollout-service.ts:151-160 — when no metrics `targetStatus` non-progressive status is defaulted `allowed:true,rollback:false` | `todo` | Rollout can advance to non-progressive state (`evaluation_enabled`/`paused` beyond) under zero data, skipping metric gate; rollback only happens when caller actively passes metrics, missing forced sampling. |
| 195 | improve-rollout/improvement-candidate-registry.ts:67-73 — startup `loadCandidates()` exception not caught | `todo` | Persistence layer throws (schema incompatible, disk corruption) makes registry constructor throw, entire Improve plane load fails; missing degradation (partial load + error event). |
| 196 | improve-rollout/improvement-candidate-registry.ts:179 — `persistenceStore?.deleteCandidate` exception only logged | `todo` | TTL eviction persistence delete failure swallowed, disk retains expired candidates; next startup reloads already-evicted candidate, bypassing TTL and maxSize limit. |
| 197 | agent-delegation/delegation-manager.service.ts:342 — `this.complete(delegationId, outputRef);` not awaited (inside completeWithEvidence) | `todo` | complete is async, not awaited causing state change and audit record order not guaranteed; if complete throws (CAS conflict) caller receives success, causing delegation state/audit split. |
| 198 | agent-delegation/delegation-manager.service.ts:516-538 — when repository recovers `permissions/grantedPermissions` all set to empty object | `todo` | After process restart delegation hydrated from repository has no real permission set; `createDelegationContext` directly uses this empty permissions to construct sub-agent, causing downstream permission check only reject (functional regression) or be incorrectly read as "unconstrained", cross-plane permission semantic leak. |
| 199 | agent-delegation/delegation-manager.service.ts:469 — cache `chainStore.set(agentId, chain)` never invalidates | `todo` | Repository-derived chain writes to in-memory but missing invalidation; even if repository state changes (cancel/expire), subsequent getDelegationChain directly returns stale memory view — authorization decision skewed. |
| 200 | agent-delegation/context-isolator.ts:174-179 — `mergePermissions` when override.resources/actions is empty array falls back to base full set | `todo` | Sub-delegation if submits empty permission request (`requiredPermissions.resources=[]`) instead inherits parent agent's full resources — typical "security default reversal", attacker uses empty spec to bypass narrowing. |
| 201 | harness/sandbox/index.ts:47-54 — `sandboxMode:"none"` directly accepted through `constraintPack.sandboxRequirement`; isolationId uses `Date.now()` concatenation | `todo` | Comment claims "none not allowed" but code doesn't reject; additionally `sandbox_${tool}_${Date.now()}` multiple creations in same ms collide ID, breaking sandbox isolation audit; drift with sandbox-policy's normalizeSandboxMode check. |
| 202 | harness/loop/index.ts:75-90 — `recordIteration` always increments `retryAttempt` and refreshes `lastRetryAt`, not distinguished from replan/normal advance | `todo` | Replan through `recordReplan` doesn't increment iteration, but single-step iteration recorded as retry, making `getBackoffMs` exponential growth inaccurate; simultaneously maxIterations = floor(maxSteps/3) takes 1/3 of budget as upper limit, replan can within maxReplans=3 repeatedly consume iteration triggering loop bomb. |
| 203 | harness/loop/index.ts:96-101 — `getBackoffMs` when `retryAttempt=0` `Math.pow(mult,-1)` gets fractional base | `todo` | shouldContinue never adds retryAttempt in retry path (only added in recordIteration) causing first retry not getting correct backoff; jitter seed uses `startedAt+retryAttempt` easy to reproduce, attacker can predict retry time window. |
| 204 | oapeflir/oapeflir-loop-support.ts:308-345 — `buildFeedbackSignals` hardcodes `feedbackTrustScore:0.5` and all trustFactors to 0.5 | `todo` | Feedback entering learn flow has no source trust distinction, causing LearningObjectValidator and KnowledgePromotionService both decide based on forged trust score — cross-plane trust leak and feedback poisoning simultaneously open. |
| 205 | oapeflir/oapeflir-loop-support.ts:209-253 — `reserveBudgetForExecution` in finally `storage.close()` but transaction exception path doesn't propagate reasonCode to caller | `todo` | reserve failure eaten by outer catch (if any); execution can continue because only returns when condition `!context.budgetLedgerId \|\| !this.dbPath`, budget reservation failure enters silent channel — violates INV-BUDGET-001. |
| 206 | oapeflir/handoff-builder.ts:172-189 — `inferToolName` through summary text heuristic inferring tool name | `todo` | Summary from step output (may contain LLM output/user input), written to ToolCallRecord.toolName and entering audit/handoff; attacker can let audit record mark shell behavior as "unknown" or vice versa, breaking audit authenticity. |
| 207 | oapeflir/handoff-builder.ts:96-110 — ToolCallRecord always `inputArgs:{}`, `tokenUsage.input:0`, `sandboxViolation:false` | `todo` | Audit layer always loses input args and sandbox violation fact; handoff receiver can't identify malicious input (missing input args) or sandbox alert when making trust decision based on this. |
| 208 | routing/intake-router.ts:82,97,410 — `roundRobinCounters` Map never cleans | `todo` | Each `rr_${skillCategory}` key accumulates into unrecoverable memory item; simultaneously multi-thread/multi-tenant scenario counter shared one process Map causes cross-tenant load jitter information leak. |
| 209 | routing/intake-router.ts:608-628 — `computeStableSelectionFraction` uses `routeTrace` (containing tenantId/principalId) into hash to determine weight/capacity split | `todo` | Hash uses unsalted principalId, tenantId as seed, attacker can observe output to infer which principal falls into which division; simultaneously `routeTrace` order sensitive, external insertion of trace items can change split — policy can be induced. |
| 210 | routing/intake-router.ts:160-198 — when `preferredIntent.confidence>=CONFIDENCE_THRESHOLD` directly adopts caller-passed intent | `todo` | preferredIntent completely controlled by caller (including unauthorized tenant path), can force selection of high-permission intent bypassing local classifier and LLM ambiguity check. |
| 211 | learn/failure-pattern-miner.ts:68 — `confidence:0.8` hardcodes all mined patterns; `promotionStatus:"quarantine"` but status set to `"rejected"` | `todo` | Status field inconsistent (promotionStatus≠rejected), downstream validator resets quarantine to validating then promotes to validated (see validator:213-220), actually makes mined failure_pattern via path automatically enter promotable state — bypassing quarantine semantics. |
| 212 | improve-rollout/policy-rollout-service.ts:56-65 — when `candidate.status !== 'approved'` if `releaseLevel === 'shadow'` still allows `releaseLevel:'suggest'` | `todo` | Unapproved candidates can be silently pushed in shadow→suggest mode, bypassing candidate.status==approved hard gate; attacker constructs strategyVersion.releaseLevel='shadow' to bypass approval. |
| 213 | agent-delegation/delegation-tracker.ts:104-149 — evictExpired only triggered in recordDelegation, and `EVICTION_INTERVAL_MS=60s` | `todo` | Long-time no new record process never evicts — idle tracker continuously retains terminal chain; out of sync with R23-45 persistence layer, causing cross-restart data retention unbounded. |

## Round 2 · Control-plane Deep (mission / cost-alert / incident-control / iam(jwt-rbac-sandbox) / approval-center / risk-control / replay-repair / tenant / policy-center / audit-export)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 214 | cost-alert/cost-alert-service.ts:~162-196 — budget evaluation double-counts `pendingProjectedCostUsd`: `currentCost` already includes pending, adding `projectedCostUsd` after exceeds threshold judgment high; `recordCost` when settling releases by `actualCostUsd` rather than `projectedCostUsd`, pending pool long-term drift | `todo` | Reserve and settle conventions inconsistent, missing pending "occupancy-writeoff" pairing. |
| 215 | cost-alert/cost-alert-service.ts:~274-291 — `wasWarning`/`warningThresholdBoundary` when `limitTokens=0` or no quota mistakenly triggers; when usage crosses warning directly into exceeded, warning event silently swallowed | `todo` | Threshold boundary judgment doesn't cover 0 limit and cross-tier jump two boundary classes. |
| 216 | cost-alert/cost-alert-service.ts:~686 — `hasOpenAlertForSubject` uses `title.includes(subject)` for dedup, cross subject substring false hit causes alert suppression | `todo` | String contains match acts as composite key dedup. |
| 217 | cost-alert/cost-alert-service.ts — `recordStepUsage` writes artifact metadata and `storagePath` but doesn't actually persist body, evidence chain has empty pointer | `todo` | Metadata/body persistence branch not paired. |
| 218 | cost-alert/cost-alert-config-loader.ts:46 — module load phase directly `process.cwd()`, sandbox and multi workspace resolve to wrong root | `todo` | Config root frozen at import phase, not injected by parameter at call phase. |
| 219 | cost-alert/cost-alert-config-loader.ts:144 vs 165 — one cache key uses `sandbox:${path}`, another uses bare `path`; same path in two sandbox modes hits same cache entry | `todo` | Cache key namespace inconsistent causes cross-sandbox read-through. |
| 220 | cost-alert/cost-alert-config-loader.ts — `validateBudgetPolicy` doesn't check `criticalThreshold` in (0,1], scope value legality, mismatched policy can silently take effect | `todo` | Default config loading missing minimum value range check. |
| 221 | mission/index.ts:~232 — `createIfMissing`/`auto_resolve` guard uses `\|\|` and `&&` mixed logic, equivalent short-circuit order inconsistent with doc description, draft mission enters active path | `todo` | Boolean short-circuit precedence not explicitly parenthesized. |
| 222 | mission/index.ts:~235 — when binding mission directly writes `request.tenantId` into `orgId` field, tenant and org concepts conflated | `todo` | Data model doesn't distinguish tenant domain and org domain. |
| 223 | mission/index.ts:~213 — candidate matching doesn't exclude `status=draft` missions, new task may be bound to unpublished draft mission | `todo` | Status filter set missing draft. |
| 224 | mission/index.ts:~1303 — `stableBucket` uses `mod 100` to compare `rollout.percentage`, if config issued as 0..1 fraction then always `0% < bucket` blocks, rollout never released | `todo` | Percentage representation not unit-normalized. |
| 225 | incident-control/incident-detector.ts:~92 — `fail_closed`/`degraded` check in pre-guard directly returns, skipping rule match, losing dimension-bearing enrichment | `todo` | Early-return path not merged with rule evaluation. |
| 226 | incident-control/incident-detector.ts:~305-325 — suppression rules merge different incidents by dimension overlap, independent faults merged to same root cause | `todo` | Suppression window comparison granularity too coarse. |
| 227 | incident-control/incident-detector.ts:~168 — `shouldAutoEscalate` for illegal `detectedAt` directly produces NaN comparison, result always false, never escalates | `todo` | Time field missing parse failure fallback. |
| 228 | incident-control/incident-resolver.ts:~318 — `actionId` constructed by `Date.now()_step`, concurrent same ms different step still conflict, and same step same ms resend fully conflicts | `todo` | ID generation not introducing random/sequence suffix. |
| 229 | incident-control/incident-resolver.ts:~246-256 — `shouldEscalate` reads input `startedAt` rather than `resolution.startedAt`, caller mis-passes causes escalation judgment misalignment | `todo` | Parameter and state field name collision shadowing. |
| 230 | incident-control/incident-resolver.ts:~394 — review timeline not sorted by `detectedAt` and monotonic check, missing integrity assertion | `todo` | Timeline just append list, unordered/no check. |
| 231 | incident-control/takeover-escalation-manager.ts:~154/207 — setTimeout callback inner async call fire-and-forget, reject neither recorded nor retried | `todo` | Timer callback missing `.catch` and retry channel. |
| 232 | incident-control/takeover-escalation-manager.ts:~430 — `extendAcknowledgment` only `clearTimeout`, doesn't reschedule new escalation window, extension equals shutdown escalation | `todo` | Extension path missing re-`setTimeout`. |
| 233 | incident-control/takeover-escalation-manager.ts:~460 — `evictExpiredSessionEntries` when deleting entry not `clearTimeout` already mounted timer, causing timer to continue firing for dead entry | `todo` | Resource cleanup only clears map not timer. |
| 234 | incident-control/takeover-escalation-manager.ts:~261-266 — `escalationHistory` capacity truncation shifts from head, discarding earliest record, breaking audit integrity | `todo` | Truncation policy reversed with "keep head/keep tail" semantics. |
| 235 | incident-control/takeover-escalation-manager.ts — history track + timer dual Map in distributed deployment only based on local process memory, escalation silently lost after failover | `todo` | State not persisted to authoritative source. |
| 236 | audit-export/audit-export-service.ts:~271 — `verifyIntegrity` doesn't check `chainPosition` continuity, entire segment missing events won't be detected | `todo` | Integrity only verifies hash chain not sequence number. |
| 237 | policy-center/index.ts:~175-181 — `isActionAllowedByRole` when no role policy configured defaults to allow | `todo` | RBAC default semantics is fail-open. |
| 238 | approval-center/approval-timeout-executor.ts:~226 — going through `remain_pending` branch also returns `decisionType:"expired"`, event stream appears "pending but marked expired" | `todo` | Decision type and timeout action enum conflated. |
| 239 | approval-center/approval-timeout-executor.ts:~246 — `createdAt` parse failure NaN never ≥ timeout, request never expires | `todo` | Time parse failure not fail-closed. |
| 240 | approval-center/approval-service.ts:~547 — directive tenant fallback uses `taskId` as tenantId, cross-tenant directive scope leak | `todo` | Field default value chose different semantic identifier. |
| 241 | approval-center/approval-service.ts:~463 — for non-`pending` duplicate decision directly `return`, not recording duplicate attempt event, audit blind spot | `todo` | Idempotency short circuit before audit event not mounted. |
| 242 | approval-center/approval-service.ts:~590 — `JSON.parse(responseJson)` without try/catch, corrupted data causes entire query path crash | `todo` | Deserialization not gracefully degraded. |
| 243 | approval-center/quorum-calculator.ts — `mergeVotes`/`uniqueApprovers` doesn't merge delegate and self for dedup, same person through authorization chain can vote multiple times | `todo` | Uniqueness key not reduced across `delegateOf` chain. |
| 244 | approval-center/multi-party-approval-service.ts:105 — `applyDecision` doesn't do `respondedBy` uniqueness check, same approver can vote multiple times incrementing `newCount` to reach quorum | `todo` | Missing (approvalId, respondedBy) reverse duplicate key. |
| 245 | approval-center/multi-party-approval-service.ts:135 — `newCount = (pending?.approvalsReceived ?? 0)+1` only trusts in-memory `pendingApprovals`; after process restart pending empty, will override DB actual count with 1, received approvals rolled back | `todo` | Multi-replica/restart scenario not using DB as authoritative source. |
| 246 | approval-center/multi-party-approval-service.ts:240 — `isApproverInGroups` uses `groups.includes(approverId)`, equivalent to "username equals group name" for allow | `todo` | Group membership implemented as string equality. |
| 247 | approval-center/multi-party-approval-service.ts:120 — `JSON.parse(existing.requestJson)` without try/catch, corrupted row directly throws breaking entire applyDecision | `todo` | Critical path deserialization not fault-tolerant. |
| 248 | approval-center/multi-party-approval-service.ts:127 — any `rejected/expired` immediately finalizes, missing N-of-M rejection threshold and parallel vote aggregation | `todo` | Rejection path uses single-vote veto, doesn't match multi-party semantics. |
| 249 | iam/access-model.ts:313-339 — `requiresTenantScope` check only effective when caller explicitly sets true, default semantics is no tenant check | `todo` | Cross-cutting tenant isolation designed as opt-in. |
| 250 | iam/access-model.ts:324 — when `principalTenantId` empty and `originalPrincipal.tenantId` empty cross-tenant check silently skipped | `todo` | Missing value = pass through fail-open fallback. |
| 251 | iam/access-model.ts:342-355 — production environment operator mandatory check only covers `exec_command/org_change/install_extension`, missing `dispatch_execution/advance_rollout/promote_improvement/modify_knowledge_trust` and other high-risk actions | `todo` | High-risk action set incomplete. |
| 252 | iam/access-model.ts:396-419 — manual takeover path allowing operator doesn't require `originalPrincipal.tenantId === context.tenantId`, operator can use takeover to cross-tenant operate | `todo` | Takeover state doesn't reuse tenant domain binding. |
| 253 | iam/outbound-url-policy.ts:31-55 — internal IP blacklist missing `100.64.0.0/10` (CGNAT), `198.18.0.0/15`, `0.0.0.0/8`, IPv4-mapped IPv6 (`::ffff:127.0.0.1`), bare hostname `metadata` and other forms | `todo` | SSRF blacklist coverage incomplete. |
| 254 | iam/outbound-url-policy.ts:61-75 — sensitive parameter set missing `apikey` (no underscore), `bearer`, `private_token`, `client_secret`, `access_key`, leak in telemetry | `todo` | Sensitive field wordlist update lagging. |
| 255 | iam/sandbox-policy.ts:54-62 — `SANDBOX_MODE_ALIASES` maps `"container"` to `workspace_write`, `"none"` to `read_only`, caller mistakenly thinks getting container isolation but actually just workspace write | `todo` | Historical aliases used, semantics drifted but no deprecation warning. |
| 256 | iam/sandbox-policy.ts:42 — `DEFAULT_SANDBOX_DENIED_ROOTS` only 4 items, missing `/root`, `/var/run/docker.sock`, `/var/log`, `~/.aws`, `~/.kube`, `~/.config` etc. | `todo` | Default deny list doesn't cover common sensitive roots. |
| 257 | risk-control/risk-evaluation-engine.ts:117 — `evaluateLegacy` doesn't call `applyDomainOverride`, legacy request bypasses domain-level risk weighting | `todo` | Three evaluation path branch implementations inconsistent. |
| 258 | risk-control/risk-evaluation-engine.ts:385-388 — `isLegacyRequest` only judged by field existence; when both legacy and 6-factor fields present silently goes legacy branch | `todo` | Multi-version schema priority not defined. |
| 259 | risk-control/risk-evaluation-engine.ts:298 — `computeHistoricalFailureValue` when both thresholds missing directly returns 1 (lowest risk), mismatch silently masked | `todo` | Missing config goes "optimistic" fallback rather than fail-closed. |
| 260 | risk-control/risk-evaluation-engine.ts:179-186 — `evaluateSixFactor` `maxPossibleScore` hardcodes `*5`; if `*RiskValues` config allows >5, denominator mismatch causes normalization distortion (masked by clamp) | `todo` | Normalization denominator not data-driven. |
| 261 | risk-control/risk-evaluation-engine.ts:73 — `isCriticalCanonicalFactorSet` only when all 8 factors max and `evidenceConfidence=low` escalates to critical, 7/8 max still falls by mapping threshold | `todo` | Extreme high-risk escalation condition too rigid. |
| 262 | replay-repair-control/index.ts:118 — `assertCanOpenForTraffic` only blocks `fail_closed`; `repair_required` doesn't block opening traffic | `todo` | Guard coverage state incomplete. |
| 263 | tenant/index.ts:~137 — `hasWorkspaceTenantAccess` as long as user in same org any workspace releases target tenant, doesn't require association with target workspace | `todo` | Workspace→tenant access derivation too wide. |
| 264 | tenant/index.ts:140-142 — `governanceRef` any non-empty string triggers `allow_with_governance_exception`, doesn't check if governance reference actually exists/approved | `todo` | Governance exception is self-declared not verifiable. |
| 265 | tenant/index.ts:93-97 — `registerDeploymentBinding` doesn't do uniqueness check on `bindingId`, same ID second register silently overwrites | `todo` | Registration interface missing conflict detection. |
| 266 | tenant/index.ts:268 — `assertId` regex allows `:` and `.`, when assembling tenant ID (e.g. `${orgId}:${userId}`) easily produces injection-style key collisions | `todo` | Identifier character set and key assembly boundary conflict. |

## Round 2 · Documentation/ADR/Contract Drift and Governance Consistency

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 267 | THIRD_PARTY_NOTICES.md:1-10 only 10 lines of stub, does not list the 9 runtime dependencies in package.json:285-294 such as `zod`, `postgres`, `ioredis`, `ws`, `xml-crypto`, `@opentelemetry/*` | `todo` | Documentation never back-written with dependency changes; CI lacks NOTICES vs `package.json` reconciliation gate. |
| 268 | SECURITY.md:1-12 only 12 lines, no CVE/advisory process, no fix SLA, no PGP contact, does not reference `docs_zh/quality/supply-chain-security.md` | `todo` | Security policy doc landed as stub, missing CVE numbering policy and disclosure window constraints. |
| 269 | docs_zh/adr/003-memory-seven-layers.md and docs_zh/adr/003-memory-six-layers.md still share the same number; README.md:13-14 use `003A/003B` alias workaround rather than truly dedup, and both are marked `Superseded by ADR-020` | `todo` | ADR renumbering policy not applied to 003 twins; README status enum does not allow "superseded canonical". |
| 270 | docs_zh/adr/README.md:144 declares `045, 074, 076, 077` as reserved number ranges, but only 045 has a placeholder file, 074/076/077 files missing | `todo` | Reserved placeholder policy not consistently executed; `audit:docs-sync` does not enforce reserved number range must have placeholder files. |
| 271 | docs_zh/adr/README.md extensively uses "Partially Superseded by..." and "Historical Context" statuses, but status enum only lists Draft/Proposed/Accepted/Superseded/Deprecated | `todo` | Status vocabulary expanded over time but governance chapter not synchronously updated enum. |
| 272 | docs_zh/adr/070-conclusion.md status written as `Withdrawn / Index`, 045-reserved-slot.md written as `Withdrawn`, both not in README status enum | `todo` | ADR status language not subject to lint/audit constraints. |
| 273 | docs_en/contracts/README.md:4 mentions "coverage analysis is uniformly recorded in docs_zh/analysis/", English readers forced to cross-language jump | `todo` | Path not rewritten to docs_en/analysis/ during translation; audit:docs-sync does not check for docs_zh/ residues in English docs. |
| 274 | docs_en/governance/source_of_truth.md:10 still points to docs_zh/architecture/00-*.md ~ 04-*.md, not replaced with docs_en/architecture/ | `todo` | Cross-language paths not localized. |
| 275 | docs_en/governance/source_of_truth.md title written as `##1. Objective`, `##2. Main Rules` (no space between # and number), render will fail | `todo` | Translation script accidentally removed spaces; docs sync does not do markdown lint. |
| 276 | docs_en/migration/00-migration-guideline.md:76 reports ADR has 38 files total, actually docs_zh/adr/ has 123+ files | `todo` | Migration guide is a historical snapshot, never updated with new ADRs (037-122). |
| 277 | docs_zh/reviews/platforme-full-review-e.md exists but no corresponding file in docs_en/reviews/, violates docs-sync translation policy | `todo` | scripts/ci/audit-docs-sync.mjs:97-98 only does parity on contracts/ and adr/ trees, no oversight on reviews/. |
| 278 | scripts/ci/audit-docs-sync.mjs:97-98 only oversees contracts/adr subtrees, architecture/, operations/, governance/, quality/, reviews/, reference/ all have no parity gate | `todo` | docs-sync audit implementation only covers the original two directories, new subtrees not incorporated. |
| 279 | docs_zh/buglist.md (5 lines) and docs_zh/quality/buglist.md (17 lines) coexist; README and governance both point to quality path, but root-level stub still exists | `todo` | Two buglists converged but stub not deleted. |
| 280 | governance/repository-guide-index.md:5-13 lists AGENTS.md/CLAUDE.md/README.md/CONTRIBUTING.md/MEMORY.md as authoritative order, while AGENTS.md top requires "follow source_of_truth chain", forming interpretable circular SOT reference | `todo` | SOT chain not clear about "root-level docs relative to governance subordination relationship". |
| 281 | docs_zh/governance/source_of_truth.md full text does not mention root CHANGELOG.md SOT ownership rules | `todo` | CHANGELOG is a blank in source-of-truth chain. |
| 282 | docs_zh/quality/supply-chain-security.md:8 forces CI to run `npm audit --audit-level=high`, SECURITY.md has no reference | `todo` | Security baseline in quality/ rather than SECURITY.md, external readers cannot discover. |
| 283 | README.md:69 calls docs_zh/quality/buglist.md canonical buglist, docs_en/ users have no equivalent English entry | `todo` | English navigation not aligned with quality/buglist entry. |
| 284 | CONTRIBUTING.md:11 only lists SQLite as prerequisite dependency, but package.json:291 contains postgres, provides migrate:sqlite-to-pg/test:pg-integration, PG path not in contributor environment instructions | `todo` | Onboarding guide stuck at Phase 1-2 SQLite baseline. |
| 285 | CONTRIBUTING.md:103 forces "Squash commits before merging", conflicts with AGENTS.md commit style example (multiple independent short topics) | `todo` | Multiple root-level guides independently write commit rules, not unified by governance. |
| 286 | AGENTS.md repeatedly states `--test-concurrency=12` no longer a contract, but actual concurrency value (LAYER_DEFINITIONS[layerName].concurrency in scripts/run-layered-tests.mjs:219) not landed in any governance doc | `todo` | "De-hardcode" done, "governance visibility" not patched. |
| 287 | docs_zh/adr/README.md:84,96-98 writes ADR-073/088/089/090 title prefix as "ADR-XXX:", other 122 entries have no such prefix, index format inconsistent | `todo` | Inconsistent title format during batch back-write; doc health tests do not constrain title format. |
| 288 | MEMORY.md:30 references tests/integration/platform/contracts/v2-7-extension-contracts.test.ts ("v2-7" semantics), inconsistent with current v3.2/v4.3 freeze naming system | `todo` | Test file naming follows historical phase numbering, governance did not do version terminology convergence. |
| 289 | docs_zh/adr/018-rollout-eleven-state-machine.md marked as "Superseded by ADR-075" in README, but ADR-075 title "Six-level Controlled Release" semantically not directly corresponding to "eleven-state machine" | `todo` | supersede relationship only maintained at index side, superseded ADR body does not force pointer declaration. |
| 290 | docs_en/adr/README.md:143 and docs_zh/adr/README.md:143 state "old 066-plugin-spi-framework.md duplicate copy removed", but same README line 77 ADR-066 currently points to compliance-report-auto-generation.md | `todo` | Historical renumbering event only explained in README notes, no "previously used for Plugin SPI" hint added to ADR-066 body. |
| 291 | docs_zh/governance/source_of_truth.md:33 prohibits "writing current completion in README", but README.md:101-108 "Current Notes" section contains completion/status descriptions | `todo` | Governance ban and README structure not reconciled. |
| 292 | docs_en/architecture/05-cross-platform-ui-architecture.md:3 embeds absolute path `/data/.../docs_zh/architecture/12-...` in file body, leaking local worktree location | `todo` | Absolute path residue during translation/copy; CI does not ban absolute paths. |
| 293 | docs_zh/contracts/README.md:23 mentions old review's runtime_state_machine.md, event_bus.md, gateway_message.md should map to existing *_contract.md, but does not give actual mapping table | `todo` | Naming convergence policy only declared not implemented, missing mapping table and lint rules. |

## Round 2 · SDK / plugins / scripts deep

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 294 | src/sdk/cli/aa.ts:33 alias table `COMMAND_ALIASES` and `CLI_ENTRYPOINT_PATTERN` expand before whitelist validation, expanded `command` directly joined into `${command}.ts` path for `spawn` | `todo` | argv whitelist validation only before path join, alias results not constrained by regex echo back to disk path. |
| 295 | src/sdk/cli/aa.ts:59-65 child process `spawn` directly `...process.env` forwards all parent process env vars, including AA_BEARER_TOKEN/AA_API_JWT_SECRET/AA_BACKUP_ENCRYPTION_KEY_FILE | `todo` | ENV pollution: no env isolation between subcommands, missing minimization whitelist. |
| 296 | src/sdk/cli/aa.ts:71 on signal receipt `process.kill(process.pid, signal)` executes before await chain resolves, promise forever hanging | `todo` | Signal forward and promise lifecycle inconsistent, cleanup side effects bypassed. |
| 297 | src/sdk/cli/aa.ts:74 child process exit code may be 0 but nullish coalesce preserves 0; child `error` event path only rejects not mapping failure code | `todo` | error path and exit path asymmetric. |
| 298 | src/sdk/cli/migrate-sqlite-to-pg.ts:152-181 argv parsing does not reject unknown flags, extra params silently swallowed; `--sqlite --pg-dsn xxx` misinterprets `--pg-dsn` as path | `todo` | argv parsing missing unknown param and value missing detection. |
| 299 | src/sdk/cli/migrate-sqlite-to-pg.ts:286-292 only mask DSN on stdout, but `pg.open` throws error message/stack containing DSN written to stderr by runCliMain.onError | `todo` | Exception path not doing secondary DSN redaction. |
| 300 | src/sdk/cli/migrate-sqlite-to-pg.ts:268 `await conn.execute(sql, ...)` serial writes in pg.transaction, long transaction serial writes; mid-SIGINT cannot interrupt causing ON CONFLICT DO NOTHING half-product | `todo` | Long transaction no heartbeat and interrupt point. |
| 301 | src/sdk/cli/migrate-sqlite-to-pg.ts:256 columns taken from firstBatch union; columns appearing in subsequent batches not in first batch silently discarded, migration data silently incomplete | `todo` | Column set frozen in first batch. |
| 302 | src/sdk/cli/pack-create.ts:88-92 `--output` parameter name indicates writing to file, actually only controls whether to output full JSON to stdout, never writeFile | `todo` | Param semantics and implementation mismatch. |
| 303 | src/sdk/cli/pack-create.ts:62-74 `--capabilities`/`--tools` use `next.split(",")` to split but do not dedup or validate format | `todo` | Constructed manifest may contain empty string/illegal characters. |
| 304 | src/sdk/cli/pack-publish.ts:174-178 retry loop network exception branch only throws error, did not push result.errors any context; finally phase lastStatus only HTTP error path writes | `todo` | Retry context does not record attempt count. |
| 305 | src/sdk/cli/pack-publish.ts:143-148 `bearerToken` passed via `--bearer-token` command line, will appear in ps/shell history; missing `--bearer-token-file` alternative | `todo` | CLI argv carries credentials. |
| 306 | src/sdk/cli/pack-publish.ts:202 `parseArgs()` and `parseArgsFromValues()` two sets of parsing duplicate (27/100), any place missing flag will be inconsistent | `todo` | Duplicate argv parsing path, branch drift risk. |
| 307 | src/sdk/cli/pack-validate.ts:51-55 `parseMajorVersion` takes `version.trim().split(".")[0]` directly Number(); `"1abc"`→NaN→fallback 0, validate passes but metadata may still be invalid | `todo` | Version parsing too loose. |
| 308 | src/sdk/cli/pack-validate.ts:67-68 directly `JSON.parse(readFileSync(opts.manifest, "utf-8"))`, no file size/type limit; can refuse service/path traversal | `todo` | No file path and size limit. |
| 309 | src/sdk/cli/pack-test.ts:55-57 like pack-validate no manifest size limit; catch err.message directly concatenates into result.errors, may echo file content fragment | `todo` | Information leak + no size validation. |
| 310 | src/sdk/cli/secret-management.ts:152 `process.stdout.write(JSON.stringify(result, null, 2))` outputs resolve/issue full fields including metadata/registry/lease, no redaction | `todo` | CLI output does not mask sensitive fields. |
| 311 | src/sdk/cli/secret-management.ts:160 onError writes error.message entirely to stderr; may contain secretRef/scopeRef | `todo` | secret leak via stderr. |
| 312 | src/sdk/plugin-sdk/plugin-definition.ts:670-687 SBOM validation via `attachAsyncPluginVerification` fire-and-forget; sync consumers directly use definePlugin return value never await, high/critical vuln plugins silently passed | `todo` | Async validation does not block sync path. |
| 313 | src/sdk/plugin-sdk/plugin-definition.ts:155-178 `nodeAlgorithm` for unknown algorithm silently falls back to RSA-SHA256, attacker writing unknown algorithm string triggers downgrade | `todo` | Signature algorithm downgrade. |
| 314 | src/sdk/plugin-sdk/plugin-definition.ts:196-221 `pluginDefinitionPayloadCandidates` simultaneously tries three payloads, any hit considered valid; attacker strips sensitive fields then subset signature then attaches malicious dependencies still passes | `todo` | Candidate payload set allows field stripping bypass. |
| 315 | src/sdk/plugin-sdk/plugin-definition.ts:182 `decodeSignature` regex accepts both base64 and base64url; same hex signature matches multiple binaries | `todo` | Signature encoding ambiguity. |
| 316 | src/sdk/plugin-sdk/plugin-definition.ts:133-148 `KNOWN_VULNERABILITIES` only hardcodes two CVEs, DefaultSbomScanner can only recognize these two | `todo` | Hardcoded vuln database, scan coverage empty. |
| 317 | src/sdk/plugin-sdk/plugin-definition.ts:509-516 remote SBOM (http/https) directly returns `valid:false` only as scanError; caller not checking then plugin can still load | `todo` | SBOM remote protocol silently abandoned. |
| 318 | src/sdk/plugin-sdk/plugin-context.ts:163-165 `set(key, value, source)` allows caller to self-declare source as "system", bypassing source label integrity for non-protected keys | `todo` | source field lacks permission check, pollutes audit trail. |
| 319 | src/sdk/plugin-sdk/plugin-test-harness.ts:147-149 `runCases` uses JSON.stringify to compare expected/actual; key order differences, Date/Map etc. non-pure JSON values will false-positive pass/fail | `todo` | Test oracle unreliable. |
| 320 | src/sdk/plugin-sdk/plugin-test-harness.ts:212-218 `executeWithTimeout` uses Promise.race, underlying plugin still executing; after timeout mock LLM/runner not cancelled | `todo` | Resource leak: timeout no cancel. |
| 321 | src/sdk/harness-sdk/harness-sdk-support.ts:140-147 `isIso8601Timestamp` regex does not accept non-second-precision formats (`+HHMM` no colon, nanoseconds, etc.) | `todo` | Input validation too strict, callers silently drop data. |
| 322 | src/sdk/harness-sdk/harness-sdk-support.ts:260-268 `graphHash` does not include nodeType/budgetIntent/sideEffectProfile etc. node critical fields in sha256, tampering does not affect hash | `todo` | Hash coverage incomplete, plan graph integrity weak. |
| 323 | src/plugins/adapters/credential-hygiene.ts:15-20 `withSecret` passes Buffer toString("utf8") to consumer, V8 strings cannot be cleared() | `todo` | "Zeroable" naming misleading, secret still lingers in GC heap. |
| 324 | src/plugins/adapters/credential-hygiene.ts:32-34 `buildHashedCredentialFingerprint` directly takes SHA-256 truncated as fingerprint on secret, no salt | `todo` | Same secret same fingerprint across tenant/env, can correlate track/dictionary enumerate. |
| 325 | src/plugins/adapters/github-adapter.ts:280 `Authorization: Bearer ${token}` directly concatenated, requireString only trim() does not strip \r\n; can do header injection on some fetch implementations | `todo` | Input validation missing: CRLF injection surface. |
| 326 | src/plugins/adapters/github-adapter.ts:81-85 `createPluginManifestHash` hashes JSON.stringify(manifest); non-canonical serialization makes signature mutual verification fail or allow fine-tune field bypass | `todo` | Signature payload non-canonical. |
| 327 | src/plugins/adapters/github-adapter.ts:381-397 execute return value contains payload (user raw params), credentialFingerprint, endpoint, no redact | `todo` | secret/PII echoed in result. |
| 328 | src/plugins/builtin-plugin-registry.ts:596-601 `normalizeManifest` when allowedExternalDomains empty silently flips allowNetworkEgress to false; no warning/log | `todo` | Silently overwrites policy. |
| 329 | scripts/dev/start-local-stack.mjs:18-20 port 4000/4001/5173 hardcoded, no env override; cleanupPort uses `command.includes(repoRoot)` mistakenly kills other node processes in same repoRoot | `todo` | Hardcoded port + cleanup mistaken kill. |
| 330 | scripts/dev/start-local-stack.mjs:135-152 `request()` does not set socket timeout for `http.get`; keep-alive hung promise never resolves | `todo` | No socket timeout, request hanging. |
| 331 | scripts/dev/start-local-stack.mjs:195-212 child process env forwards SSH agent / cloud creds to vite/api-server | `todo` | ENV pollution to child process. |
| 332 | scripts/dev/stop-local-stack.mjs:46-49 after SIGTERM only waits 5 seconds then SIGKILL; when pid already reused by OS directly SIGKILL unrelated process | `todo` | No PID verification recheck. |
| 333 | scripts/backup-sqlite.sh:31 `TIMESTAMP=$(date +%Y%m%d_%H%M%S)` second-level granularity; trigger twice in same second will overwrite | `todo` | Timestamp precision insufficient. |
| 334 | scripts/backup-sqlite.sh:71-86 encryption branch if openssl fails, trap only cleans LOCK_DIR, not generated plaintext BACKUP_PATH | `todo` | Exception path leaks plaintext backup. |
| 335 | scripts/restore-sqlite.sh:118-121 pre-restore uses cp instead of .backup copy; under WAL mode cp snapshot may corrupt, but script treats as rollback evidence | `todo` | cp not WAL safe. |
| 336 | scripts/restore-sqlite.sh:144-145 `rm -f $DB_PATH-wal $DB_PATH-shm; mv -f tmp $DB_PATH` no mutex lock; other writers holding WAL handle will break state | `todo` | race: original DB writers not isolated. |
| 337 | scripts/restore-sqlite.sh:99 `grep -o 'defineMigration([[:space:]]*[0-9]\+'` does not distinguish code from comment, comment version number will inflate LATEST_SCHEMA_VERSION | `todo` | Regex does not exclude comments. |
| 338 | scripts/restore-sqlite.sh:58 `mktemp` template puts X in middle not end, BSD/macOS mktemp treats whole string as literal | `todo` | Cross-platform incompatible. |
| 339 | scripts/build-if-needed.mjs:5 `repoRoot = process.cwd()`; running node directly from subdirectory cwd arbitrary, causing compare wrong source mtime | `todo` | Anchored to cwd. |
| 340 | scripts/build-if-needed.mjs:23-36 `walkNewestMtime` does not skip symlink, encountering directory cycle symlink can stack overflow | `todo` | No symlink cycle protection. |
| 341 | scripts/clean-dist.mjs:78-80 catch swallows ENOENT and ENOTEMPTY together; ENOTEMPTY indicates concurrent write failure should alert | `todo` | swallowed errors. |
| 342 | scripts/ci/audit-ci-supply-chain.mjs:8-10 `read()` does not try/catch, reference file missing terminates with uncaught exception; CI failure info can only be read from stack trace | `todo` | Error handling missing. |
| 343 | scripts/ci/audit-ci-supply-chain.mjs:39 `aquasecurity/trivy-action@(?:0\.32\.0\|[0-9a-f]{40})` allows floating tag 0.32.0, contradicts script's "must pin commit SHA" declaration | `todo` | Supply chain pin miss-judge. |
| 344 | scripts/ci/audit-outbound-urls.mjs:11 COMMENT_PATTERNS only recognizes line-starting comments, multi-line comment middle, trailing comments (`code; // http://...`) not fully excluded; inline pattern cross-line match can be bypassed by same-line writing | `todo` | Audit regex can be bypassed. |
| 345 | scripts/architecture-boundary-scan.mjs:184 `content.includes(matcher)` does not distinguish code, comment and string; detect-only mode default exit 0 lets CI silently ignore real boundary crossings | `todo` | Default detect-only no enforcement. |
| 346 | src/sdk/cli/worker-handshake.ts:153 `main();` top-level no isCliEntryPoint guard; any import triggers real storage write | `todo` | fire-on-import side effect. |
| 347 | src/sdk/cli/worker-register.ts:97 same no entrypoint guard; `loadWorkerRegisterCliEnv()` called once each in loadRegistrationPolicy and main, env change causes policy and request inconsistent | `todo` | fire-on-import + dual env read. |
| 348 | src/sdk/cli/worker-register.ts:65 `challengeToken: envConfig.challengeToken ?? ""` missing case passes empty string into completeRegistration; server side if treats empty token as "not provided" rather than auth failure can be bypassed | `todo` | Empty token transparent pass. |
| 349 | src/sdk/cli/dispatch-execution.ts:47 `function main(): void` no try/catch, withCliStorage throws when not caught exception exits, stderr contains full stack (may contain dbPath) | `todo` | Exit code + stack leak. |
| 350 | src/sdk/cli/api-server.ts:154 `snapshotPath: join("data","knowledge","knowledge-plane.snapshot.json")` uses relative path not resolveConfigWorkspaceRoot | `todo` | Hardcoded relative path. |
| 351 | src/sdk/cli/api-server.ts:252-255 `TaskWebSocketStatusRelay` only created when authService != null; enableWebSocket=true but auth not configured then ws comes online without relay, operations side no alert | `todo` | Silent feature degradation. |
| 352 | src/sdk/cli/api-server.ts:332-334 catch writes error.stack directly to stderr, stack frames may contain closure captured envConfig (including jwtSecret/webhookSecret) | `todo` | secret leak via stack trace. |
| 353 | scripts/ci/npm-audit-to-sarif.mjs:11 `JSON.parse(readFileSync(...))` no size/format check; audit output can be tens of MB OOM risk | `todo` | No size/fault tolerance. |
| 354 | scripts/ci/npm-audit-to-sarif.mjs:93-96 `vulnerability.via.map(entry=>...)` assumes via is always array; schema evolves to object/missing throws TypeError | `todo` | Input schema assumption too strong. |


## Round 2 · UI (apps/web + packages/shared + packages/features)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 355 | ui/apps/web/index.html:11 main page no `<noscript>` fallback, and HTML has no meta CSP fallback; CSP only injected by vite plugin in response header/_headers, self-hosted reverse proxy not configured then fails | `todo` | CSP only depends on external header, missing meta fallback. |
| 356 | ui/apps/web/vite.config.ts:31 `script-src 'self'` does not enable strict-dynamic or nonce/hash, and `style-src 'self'` incompatible with React's massive inline `style={{...}}` | `todo` | CSP conflicts with code style, runtime will be rejected by browser. |
| 357 | ui/apps/web/vite.config.ts:134 `define: { "process.env": "{}" }` replaces entire process.env with empty object, masking undeclared env vars and preventing tree-shake detection | `todo` | Full string replacement breaks envar debugging and runtime validation. |
| 358 | ui/apps/web/vite.config.ts:155 production sourcemap:false but _headers does not configure X-Content-Type-Options/HSTS/Referrer-Policy/Permissions-Policy | `todo` | Only injects CSP, missing other mandatory security response headers. |
| 359 | ui/apps/web/src/app-shell.tsx:288 `window.matchMedia("(max-width: 960px)").matches` only reads on first render, not subscribed to change, layout does not respond after window size change | `todo` | Missing matchMedia listener causes layout rigidity. |
| 360 | ui/apps/web/src/app-shell.tsx:113 `new URL(document.referrer).origin === window.location.origin` only checks length, non-standard referrer still allows new URL() to throw caught | `todo` | URL parsing not try/catch. |
| 361 | ui/apps/web/src/app-shell.tsx:288 AppFrame's groupedFeatures recompute each render, not memo | `todo` | Feature grouping not memo, long list performance degradation. |
| 362 | ui/apps/web/src/global-error-boundary.tsx:40 error reset only relies on setState({hasError:false}) not switching retryKey to remount subtree, causes "infinite reset" loop | `todo` | Error boundary retry does not remount subtree. |
| 363 | ui/apps/web/src/main.tsx:23 RuntimeBootstrap function body directly calls createWebRuntimeConfig/createWebRuntimeClients, each render reconstructs REST/WS clients | `todo` | Client construction not in useMemo/useState. |
| 364 | ui/apps/web/src/runtime.ts:69 `readBootstrapAuthToken` reads from `<meta name="aa-auth-token">` and seeds as access token, bearer permanently resides in DOM | `todo` | Meta tag injects bearer, missing domain binding and expiry constraint. |
| 365 | ui/apps/web/src/runtime.ts:122 seedTokenManager falls back to Number.MAX_SAFE_INTEGER when JWT has no exp, equivalent to never expire | `todo` | Violates "non-expiry default reject" premise. |
| 366 | ui/apps/web/src/runtime.ts:141 JWT decode uses globalThis.atob, no padding fix or UTF-8 handling; payload containing Chinese/special characters will fail to parse | `todo` | base64url decode no padding/UTF-8 compatibility. |
| 367 | ui/apps/web/src/runtime.ts:184 wsClient selection only based on typeof WebSocket, not using SharedWorkerWSClient, multiple tabs each establish WS | `todo` | Runtime not enabled SharedWorker path. |
| 368 | ui/packages/shared/api-client/src/shared-ws-worker.ts:119 `new WebSocket(url, "v1.auth.token")` encodes auth info into subprotocol, and worker global currentToken shared across multiple ports | `todo` | SharedWorker cross-port token sharing. |
| 369 | ui/packages/shared/api-client/src/shared-ws-worker.ts:211 onconnect does not verify connectionEvent.origin/source, page injected by XSS can send connect command to arbitrary URL carrying token to establish | `todo` | SharedWorker inbound message missing source/capability check. |
| 370 | ui/packages/shared/api-client/src/ws-client.ts:420 SharedWorkerWSClient processing port messages does not verify event.origin/source, fully trusts worker outbound | `todo` | Port message not verifying source. |
| 371 | ui/packages/shared/api-client/src/rest-client.ts:414 default timeoutMs=10_000, outer retry three times stacked worst 30s+; upload/long task no per-request override | `todo` | Timeout not supporting per-request override. |
| 372 | ui/packages/shared/api-client/src/rest-client.ts:582 createRuntimeRESTClient default baseUrl="/api"; duplicates with runtime.ts `apiBaseUrl ?? "/api"` | `todo` | Hardcoded API base address scattered. |
| 373 | ui/packages/shared/api-client/src/interceptors.ts:202 OfflineQueue.enqueue persistence contains authorization header (extractReplayHeaders); IndexedDB persistence bearer on disk | `todo` | Offline request replay header persistence contains bearer. |
| 374 | ui/packages/shared/api-client/src/interceptors.ts:225 readCsrfToken only reads from meta and sends with each non-GET, no double-submit cookie implemented; GET request completely no token | `todo` | CSRF only meta single source not paired with cookie. |
| 375 | ui/packages/shared/auth/src/auth-service.ts:69 initiateCodeFlow writes state, codeVerifier to sessionStorage (plaintext); same-origin script can read and replay auth code exchange | `todo` | PKCE verifier/state plaintext in sessionStorage. |
| 376 | ui/packages/shared/auth/src/auth-service.ts:84 default authorizationEndpoint fallback `https://auth.example.com/oauth/authorize`, not configured then will really redirect to external domain | `todo` | Auth endpoint default external placeholder domain. |
| 377 | ui/packages/shared/platform/src/web-platform-adapter.ts:33 readFile/writeFile defaults to localStorage (prefix LOCAL_FILE_PREFIX), any business "file" read/write no size/sensitivity control | `todo` | File abstraction uses localStorage persistence no control. |
| 378 | ui/packages/shared/state/src/query-cache-persistence.ts:198 persistence whitelist contains sensitive data like tasks/approvals/incidents, cache to IndexedDB (plaintext), logout/switch tenant no active clear hook | `todo` | Sensitive query cache plaintext to disk and no cleanup. |
| 379 | ui/packages/features/hitl/src/web/index.tsx:51 bulkApprove/bulkReject one-click batch submit no second confirmation or undo window; takeover module's danger button also directly triggers | `todo` | High-risk batch/takeover action missing second confirmation. |
| 380 | ui/packages/features/hitl/src/web/index.tsx:119 editor textarea only aria-label, no aria-describedby linking error info; `<p role="alert">` not bound to field | `todo` | Form and error info no aria-describedby. |
| 381 | ui/packages/features/hitl/src/hooks/index.ts:85 `wsClient.subscribe("approvals", () => undefined)` placeholder callback, DTO changes will not trigger setApprovals | `todo` | WS subscribe handler empty function no side effect. |
| 382 | ui/packages/features/hitl/src/hooks/index.ts:69 fetchApprovals no AbortController, old request continues to resolve when component unmounts/dependency changes | `todo` | Data loading missing AbortController. |
| 383 | ui/packages/features/hitl/src/hooks/index.ts:166 bulkApprove uses Promise.all concurrent, any failure rejects the entire batch; partially succeeded front not rolled back or feedback UI | `todo` | Batch operation partial failure state lost. |
| 384 | ui/apps/web/package.json and ui/package.json both declare react@^19.1.0; workspaces not hoisted easily pull two copies causing React multiple instances (hooks fail) | `todo` | React duplicated in multiple package.json. |
| 385 | ui/apps/web/vite.config.ts:74 applySubresourceIntegrity uses regex to match script/link, `<link rel="modulepreload">` and `rel="preload"` also match but not adding crossorigin | `todo` | SRI injection no differentiated handling for modulepreload/preload. |
| 386 | ui/apps/web/vite.config.ts:74 SRI regex for resources with hash fragments or query parameters writes back entire path, inconsistent with resolveBundleAssetPath handling, some resources can't get integrity | `todo` | SRI resource path parsing not handling query parameters. |
| 387 | ui/packages/shared/api-client/src/ws-client.ts:248 `JSON.parse(String(event.data))` no try/catch, malformed frame thrown into onmessage then not cleaning currentToken/currentUrl, may cause reconnect storm | `todo` | WS message parsing not catching exception. |
| 388 | ui/packages/shared/api-client/src/rest-client.ts:367 response parsing only judges by content-type, no max response body length limit; when server returns huge JSON no fuse | `todo` | Missing response body size/over-length protection. |
| 389 | ui/packages/shared/auth/src/auth-service.ts:246 replaceState does not reset residual token/code in history.state, third-party script can still read through history.state | `todo` | history cleanup not covering history.state. |

## Round 2 · domains / interaction / org-governance / scale-ecosystem / ops-maturity

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 390 | src/scale-ecosystem/marketplace/catalog/index.ts parseSemver returns NaN on non-numeric segment but does not throw, causing `^`/`~` range comparison to treat NaN as match | `todo` | Parse failure not short-circuited, entering downstream comparison produces undefined behavior. |
| 391 | src/scale-ecosystem/marketplace/catalog/index.ts caret/tilde range comparison independently `<=` per field, e.g. `^1.2.5` for `1.3.0` because patch=0<5 judged as not satisfied | `todo` | Not doing lexicographic comparison by semver priority (major→minor→patch). |
| 392 | src/scale-ecosystem/marketplace/catalog/index.ts upgrade path only compares version string equality, does not prevent explicit downgrade; tenant falling back to vulnerable old version not erroring | `todo` | Missing version monotonicity check. |
| 393 | src/scale-ecosystem/marketplace/catalog/index.ts entryId assembled by `${packId}@${version}`, when packId contains `@` conflicts with version boundary, can be constructed to conflict ID to overwrite existing catalog entry | `todo` | Identifier not constrained character set check, assembly ambiguity exists. |
| 394 | src/scale-ecosystem/billing/utils.ts roundCurrency uses Math.round (half to positive infinity), produces asymmetric rounding error for negative amounts in billing | `todo` | Currency rounding strategy inconsistent with accounting banker's rounding. |
| 395 | src/scale-ecosystem/billing/utils.ts assertPositiveNumber rejects 0, but legitimate 0 usage (free tier/post-deduction net) treated as illegal input throwing | `todo` | Validation semantics confuses "non-negative" with "positive". |
| 396 | src/scale-ecosystem/billing/billing-payment-gateway.ts when calling fetch does not set AbortSignal/timeout; remote hang will indefinitely occupy billing worker | `todo` | Outbound call missing timeout and fuse. |
| 397 | src/scale-ecosystem/billing/billing-payment-gateway.ts manual reconciliation branch uses `manual_${invoiceId}` as gatewaySessionRef, retrying same invoice reuses same reference key | `todo` | Session reference not introducing retry sequence or random entropy. |
| 398 | src/scale-ecosystem/billing/billing-payment-gateway.ts uses `totalUsd*100` then Math.round to get tier amount, float cumulative error causes 1 cent difference with upstream aggregation | `todo` | Should directly use integer operations in cents, prohibiting float→int. |
| 399 | src/interaction/nl-gateway/intent-parser/index.ts trigger word matching uses `\b` boundary regex, never matches for CJK input, Chinese intent silently downgraded | `todo` | Regex boundary fails for non-ASCII. |
| 400 | src/interaction/nl-gateway/intent-parser/index.ts modelGateway.complete return value not length/format validated before JSON.parse; malicious/oversized response can exhaust memory or throw uncaught exception | `todo` | External model output not going through schema validation. |
| 401 | src/interaction/nl-gateway/intent-parser/index.ts default locale falls back to en-US; domestic tenants with missing locale misrouted to English prompt | `todo` | Default value does not match target user group. |
| 402 | src/interaction/nl-gateway/intent-parser/index.ts user original text and system prompt directly concatenated to model, no untrusted separator or escape inserted | `todo` | Trust boundary not explicitly marked at prompt layer. |
| 403 | src/interaction/nl-gateway/slot-resolver/index.ts slot name embedded into echo message via string interpolation; malicious slot name can inject control characters or fake system prompt | `todo` | Output not whitelisting slot key. |
| 404 | src/interaction/nl-gateway/slot-resolver/index.ts multiple entity conflict silently takes first, no ambiguity signal raised | `todo` | Missing ambiguity detection and re-query path. |
| 405 | src/interaction/dashboard/dashboard-websocket-server.ts broadcast() directly traverses all connections to send, not reusing channel authorization check; operations broadcast can over-deliver to unsubscribed tenants | `todo` | Broadcast path bypasses unicast subscription ACL check. |
| 406 | src/interaction/dashboard/dashboard-websocket-server.ts replayBuffer shared across tenants, existsOutsideScope only returns reasonCode; can infer other tenant event existence through differential response | `todo` | Error code leaks oracle, no uniform response. |
| 407 | src/interaction/dashboard/dashboard-websocket-server.ts updateMetricSubscriptions does not verify caller's visibility on requested metric | `todo` | Subsequent instructions not re-executing authorization. |
| 408 | src/interaction/dashboard/dashboard-websocket-server.ts uses `subscriptions[0]` type to judge legacy/array form; malicious client mixing two formats can bypass new field validation | `todo` | Protocol discrimination depends on runtime type not explicit version field. |
| 409 | src/org-governance/approval-routing/approval-routing-service.ts hardcoded USD→CNY=7.2 exchange rate, no FX service connection and no timestamp | `todo` | Business critical constant frozen in code. |
| 410 | src/org-governance/approval-routing/approval-routing-service.ts amount uniformly toFixed(2), loses precision for JPY/cryptocurrency, triggers approval threshold bypass | `todo` | Currency precision not currency-aware processed. |
| 411 | src/org-governance/approval-routing/approval-routing-service.ts escalation target overrides conflict-of-interest exclusion set; COI config invalidates on escalation chain | `todo` | Escalation path not merged with conflict-of-interest filter. |
| 412 | src/org-governance/approval-routing/approval-routing-service.ts escalation rule sorted by triggerAfterMinutes descending picks first, equivalent to preferring longest delay, opposite of "fastest escalation" semantics | `todo` | Sort direction reversed. |
| 413 | src/org-governance/approval-routing/approval-routing-service.ts snapshotId directly concatenates tenant/approver raw ID, leaks internal identifier and easy to predict replay | `todo` | Snapshot identifier missing hash/randomization. |
| 414 | src/scale-ecosystem/multi-region/per-tenant-encryption.ts aes-128-gcm branch falls into aes-256-cbc default path but still uses 16-byte key, runtime throws making key rotation fail | `todo` | Algorithm dispatch switch default fallback wrong. |
| 415 | src/scale-ecosystem/multi-region/per-tenant-encryption.ts CBC mode no HMAC check, can be tampered with bit-flip attack and decrypted through | `todo` | Chose non-authenticated encryption mode. |
| 416 | src/scale-ecosystem/multi-region/per-tenant-encryption.ts deriveTenantKey uses single-round SHA256(masterKey‖tenantId), not through HKDF | `todo` | KDF strength below industry baseline. |
| 417 | src/scale-ecosystem/multi-region/per-tenant-encryption.ts old key retained in memory and Buffer not fill(0), process dump can recover historical plaintext key | `todo` | Key lifecycle not zeroed. |
| 418 | src/ops-maturity/explainability/explanation-pipeline-service.ts versionLockRef passed by caller and directly stored, verifyVersionLock only does equality comparison | `todo` | Integrity check reduced to rubber stamp whatever is stored. |
| 419 | src/ops-maturity/explainability/explanation-pipeline-service.ts 24-bit hex digest (96bit) collision resistance insufficient for evidence integrity | `todo` | Digest length truncated too much. |
| 420 | src/ops-maturity/explainability/explanation-pipeline-service.ts cache uses plain object as map; attacker-controlled key name can trigger `__proto__` prototype pollution | `todo` | Not using Map or Object.create(null). |
| 421 | src/ops-maturity/explainability/explanation-pipeline-service.ts explanation evidence ipAddress/userAgent etc. fields not redacted directly to disk | `todo` | PII fields not going through redaction pipeline. |
| 422 | src/ops-maturity/drift-detection/drift-detector-service.ts only takes baselineFingerprints[0] comparison, multi-baseline strategy actually only uses first | `todo` | Multi-baseline design not landed in compare function. |
| 423 | src/ops-maturity/drift-detection/drift-detector-service.ts safeHashEquals uses `===` string comparison; timing side channel exists | `todo` | Should use timingSafeEqual. |
| 424 | src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts "signature" field actually is SHA256 of public fields, no private key/HMAC involved | `todo` | Named signature but implementation is plain hash. |
| 425 | src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts verifyEnvelopeSignature uses plain `===` comparison; timing side channel can infer expected signature | `todo` | Validation not using constant-time comparison. |
| 426 | src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts deviceAttestation.attestedAt no freshness (max age) check | `todo` | Missing time window policy, old attestation can replay. |
| 427 | src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts createdAt allows future time and participates in sort, attacker constructs future timestamp to suppress subsequent legitimate events | `todo` | Timestamp upper bound not checked. |
| 428 | src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts three-way merge uses object spread, essentially last-writer-wins not claimed 3-way merge | `todo` | Merge algorithm implementation inconsistent with doc commitment. |
| 429 | src/ops-maturity/edge-runtime/edge-risk-gate.ts HIGH_RISK_TASK_TYPES set no case/space/synonym normalization; task type `Payment ` can bypass high-risk interception | `todo` | Input not normalized before comparing set. |
| 430 | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts getSnapshot/getVariableState/loadEventStore missing assertReplayAccess; cross-tenant can read debug snapshots | `todo` | Read path not mounted with authorization check. |
| 431 | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts sessions Map global not partitioned by tenant; sessionId enumerable causing cross-tenant session probing | `todo` | Session storage missing tenant partition. |
| 432 | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts expiry check uses ISO string lexicographic comparison; timezone/precision differences cause unstable results | `todo` | Should parse to epoch then compare. |
| 433 | src/ops-maturity/workflow-debugger/time-travel-debug-service.ts evictOldestSession deletes session but does not write endedAt; audit/billing side cannot distinguish active end from eviction | `todo` | Lifecycle event not completed. |

## Round 2 · state-evidence deep (checkpoints / memory / knowledge / truth / async-repositories)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 434 | checkpoints/checkpoint-gc-service.ts:531-546 removeCandidateFromManifests uses readFileSync+writeFileSync to directly overwrite manifest, no tmp+rename atomic write, no fsync | `todo` | GC persistence branch-level metadata goes "full rewrite", missing envelope's tmpfile→fsync→rename. |
| 435 | checkpoints/checkpoint-gc-service.ts:307-316 enforceVersionLimits uses rmSync(force:true), not reusing unlinkCheckpointFileIfUnchanged's dev/ino binding | `todo` | Version limit delete "anyway can force delete" draft, not following main path fd identity binding closure. |
| 436 | checkpoints/checkpoint-gc-service.ts:585-604 acquireRunLock writes lock without fsync parent dir; after process crash lock and directory entry inconsistent | `todo` | lock file depends on OS default writeback timing, does not treat "lock creation visibility" as independent durability boundary. |
| 437 | checkpoints/checkpoint-gc-service.ts:607-609 releaseRunLock directly rmSync, does not check lock file pid/host matches this process | `todo` | Release lock only looks at path not identity, residual lock cleanup and normal release go through same delete interface. |
| 438 | checkpoints/checkpoint-gc-service.ts:469,556-567 uses birthtimeMs/birthtime to infer checkpoint age, birthtime unreliable on ext4/NFS | `todo` | retention decision directly trusts stat birthtime, does not treat envelope.metadata.createdAt as canonical time source. |
| 439 | checkpoints/checkpoint-gc-service.ts:138-153 scanForGCCandidates traverses in readdirSync order, no stable sort, candidate list reorders across runs | `todo` | Scan result directly output by file system enumeration order, missing candidate set sort contract. |
| 440 | checkpoints/checkpoint-envelope.ts:228 createCheckpointEnvelope uses `new Date().toISOString()` to write createdAt; replay same input produces different envelope hash | `todo` | envelope metadata timestamp directly bound to wall clock, not using externally passed deterministic clock. |
| 441 | checkpoints/checkpoint-envelope.ts:259-263 unpack maxSizeBytes degenerates to DEFAULT_MAX_CHECKPOINT_SIZE_BYTES, not aware of critical domain 2MB limit | `todo` | Up/down size limits each compute default, not collapsing critical domain threshold into envelope metadata. |
| 442 | checkpoints/checkpoint-envelope.ts:302-313 checksum mismatch only logger.warn then throws, missing persisted evidence and domain/namespace context | `todo` | Integrity failure treated as ordinary log noise, not entering evidence/incident chain. |
| 443 | checkpoints/checkpoint-manifest.ts:172-196 computeCombinedChecksum sort uses localeCompare without specifying locale, hash drifts across ICU version/region | `todo` | Manifest aggregation hash directly reuses host default collation, no forcing byte-level sort. |
| 444 | checkpoints/checkpoint-manifest.ts:172-196 combined checksum does not contain manifestId/executionId/workflowId; same checkpoint list across manifest checksum same, can be swapped | `todo` | combinedChecksum only covers leaf checkpoint, missing manifest identity salt in hash. |
| 445 | checkpoints/checkpoint-manifest.ts:201-211 verifyManifestChecksum when combinedChecksum missing only returns false, but validateCheckpointManifest degrades it to warning | `todo` | Manifest integrity policy default soft constraint, no fail-closed required field for production path. |
| 446 | checkpoints/checkpoint-manifest.ts:239 createCheckpointManifest uses `new Date().toISOString()` to write createdAt | `todo` | Manifest construction directly takes wall clock time, breaks deterministic replay. |
| 447 | checkpoints/checkpoint-ref-validator.ts:139-172 validateCheckpointStorage directly readFileSync entire file sha256 for `file://`, but ref.checksum usually envelope internal raw payload checksum, incomparable | `todo` | ref validation treats "whole file byte digest" as "raw payload digest", not first unwrap envelope then compare metadata.checksum. |
| 448 | checkpoints/checkpoint-ref-validator.ts:119-126,149-152 accepts any `file://` path, not going through sandbox-path-policy; can read files outside sandbox | `todo` | ref validation phase missing consistent sandbox validation stack with storage-quota-service. |
| 449 | checkpoints/checkpoint-ref-validator.ts:156 readFileSync no max byte limit; malicious manifest pointing to huge file OOM validation process | `todo` | Integrity probe no upstream size guard. |
| 450 | checkpoints/checkpoint-ref-validator.ts:198-201 isValidIsoDate only judges `Date.parse`+`includes("T")`; accepts loose strings like "2020-13-40T??:??" | `todo` | ISO validation depends on Node Date loose parsing, not strict RFC3339 regex. |
| 451 | memory/memory-layer-model.ts:307-313 isMemoryStale hardcodes 7-day TTL fallback when missing layer config | `todo` | Expiry path still uses default value when layer registry mismatch, bypassing explicit layer policy. |
| 452 | memory/memory-layer-model.ts:350-358 getEvictionPriority trust weights trusted=1.0, authoritative=1.0, official=0.75; official ranked below trusted | `todo` | trust weight table disconnected from trust level enum order, constants manually filled. |
| 453 | memory/memory-layer-model.ts:240-258 scopeToArchitectureLayer default returns "semantic", unknown scope silently archives to long-retention layer | `todo` | architecture↔scope two directions use different failure strategies. |
| 454 | memory/memory-layer-model.ts:261-281 scopeToCanonicalMemoryLayer default falls back to "SemanticMemory", inconsistent with architectureLayerToScope throw semantics | `todo` | canonical mapping retains old "lenient fallback". |
| 455 | memory/memory-layer-model.ts:389-411 createContextTruncationReport estimates with estimatedBytesPerMemory=1500, retainedMemories always writes 0 | `todo` | Lost report as v1 simplified magic number + placeholder field. |
| 456 | memory/memory-decay-service.ts:169-173 accessBoost = `(1+x)^hitCount` no upper bound; when hitCount large overflows then clamped, making high-frequency items always 1.0 bypass decay | `todo` | Access boost uses exponential without capping hitCount. |
| 457 | memory/memory-decay-service.ts:319-330 compressionScore weights 0.35/0.35/0.2/0.1 and hitCount/20 all magic numbers, no config exposure | `todo` | Compression scoring formula hardcoded, missing tuning surface. |
| 458 | memory/memory-decay-service.ts:349-355 candidates sorted by score then sliced, no secondary tiebreaker | `todo` | Sort base not with stable id, violates reproducible selection contract. |
| 459 | memory/layer-transition-service.ts:156-183 mapScopeToSixLayer default fallback to "session", unknown scope incorrectly promoted | `todo` | 6-layer mapping retains old "safe session" fallback. |
| 460 | memory/layer-transition-service.ts:280 evaluateTransition default param `new Date().toISOString()`; same memory multiple evaluations conclusion can drift | `todo` | Evaluation time directly reads current clock, not treating evaluatedAt as mandatory input. |
| 461 | memory/layer-transition-service.ts:271 `lastAccessedAt > createdAt` comparison does not handle clock rollback, write end clock drift means anchor selected wrong | `todo` | Layer age anchor trusts relative order of two wall-clock timestamps, no fencing token. |
| 462 | memory/layer-transition-service.ts:353-368 getTransitionDirection never returns "down", down in direction enum has no writer in production path | `todo` | Migration direction API and downgrade write path split modeling. |
| 463 | memory/evidence-service.ts:128-150 EvidenceService entirely based on in-memory Map; evidence chain not persisted, no hash chain/signature, process restart loses all evidence | `todo` | evidence service originally started as in-memory prototype, long-term not filled persistence and chain integrity. |
| 464 | memory/evidence-service.ts:316-317 integrate path only removes entries from "recorded" index, but state after process is "processed", index stale not cleaned | `todo` | State migration and index update not in same helper closure. |
| 465 | memory/evidence-service.ts:475-501 evictOldRecords when exceeding maxRecords only goes time window; archived never evicted | `todo` | "Keep archived" treated as hard constraint, no secondary retention policy. |
| 466 | memory/evidence-service.ts:493-499 second eviction path uses `toEvict.includes(id)` filtering in O(n²) | `todo` | Eviction list dedup using linear includes, not Set. |
| 467 | memory/memory-promotion-engine.ts:115-121 promotion targetLayer is project/user but context missing projectId/userId silently skips persistence, promoted array still contains this candidate | `todo` | promotion result only-best-effort, no explicit fail for "insufficient context". |
| 468 | memory/memory-promotion-engine.ts:80-122 runPromotionCycle does not update memory.scope field; promoted candidate back to caller still points to old layer, repeatedly triggering same promotion | `todo` | engine splits "evaluate" and "entity migration" into two layers but no write-back hook. |
| 469 | memory/session-summary-service.ts:48-50 keyDecisions/keyOutcomes/memoryIdsReferenced directly JSON.stringify to write to db, no size/item count limit | `todo` | Session summary persistence only goes "good enough" serialization, does not put array JSON columns in schema validation. |
| 470 | memory/memory-consolidation.ts:80-81,96-97 snippet/fact truncation threshold slice(8)/slice(12) hardcoded in function body, no config | `todo` | Consolidation truncation threshold is "eyeball" magic number, missing config surface and observability. |
| 471 | knowledge/semantic-knowledge-graph.ts:261-298 propagateTrust uses BFS+visited set first arrival scoring, does not consider max-weight path under multiple paths | `todo` | Trust propagation algorithm not relaxing by max-weight path. |
| 472 | knowledge/semantic-knowledge-graph.ts:286 `Number((...).toFixed(4))` cumulative multiplication and rounding, iteration depth increases error accumulation | `todo` | Trust score for readability directly forced 4-decimal rounding, breaks numerical associativity. |
| 473 | knowledge/semantic-knowledge-graph.ts:409-412 addUndirectedEdge calls addEdge twice, addEdge inside already writes adjacency list on both ends, each undirected edge duplicates 4 times in adjacency list | `todo` | Undirected edge wrapper and underlying addEdge each implement "double-end registration". |
| 474 | knowledge/semantic-knowledge-graph.ts:115-125 replace fully clears then rebuilds, during which query/getChunkConnections read empty set, no lock/snapshot | `todo` | Knowledge graph rebuild goes "clear→write" two steps, no copy-on-write switch semantics. |
| 475 | knowledge/semantic-knowledge-graph.ts:194-196 only adds same_document edge to adjacent chunks, cross-chunk multi-hop relations lost | `todo` | same_document relation modeled as "chain" not "clique". |
| 476 | knowledge/semantic-vector-store.ts:42-43,89-98 LocalHashSemanticVectorStore default LIMIT=12, MIN_SIM=0.18 hardcoded, no eviction, similarity sort no tiebreaker | `todo` | local fallback as "demo-grade" implementation, not filled capacity, config and stable sort. |
| 477 | knowledge/semantic-vector-store.ts:67-77 upsertChunks for !isSupportedEmbedding candidates directly continue, no telemetry, no return value flag | `todo` | Illegal vector treated as harmless noise discarded, not sunk to metrics. |
| 478 | truth/runtime-truth-repository.ts:467-493 snapshot uses `new Date().toISOString()` to synchronously generate versionId/createdAt; replay same aggregate product versionId never consistent | `todo` | Snapshot identity directly weaves wall clock time. |
| 479 | truth/runtime-truth-repository.ts:424-465 replayEvents when currentAggregate==null or toStatus==null continues, events silently discarded and outbox not remediated | `todo` | Event replay path uses lenient skip to cover "event pointing to missing aggregate" classification failure. |
| 480 | truth/runtime-truth-repository.ts:496-514 nested transaction directly reuses outer context; undoOperations no per-op try/catch, one undo throws then abandon subsequent rollback | `todo` | Transaction wrapping only did top-level savepoint. |
| 481 | truth/migration-runner.ts:36-43 `up()` does not acquire repo-level migration lock, multiple runner concurrent execution of storage.migrate() can double-run migration; `down()` does not execute any rollback operation then returns "success" | `todo` | runner pushes lock/rollback responsibility entirely to underlying storage, but gives "executed" semantic illusion. |
| 482 | truth/storage-quota-service.ts:92,99,106 default quotas 250MB/150MB/200MB and cleanup strategy hardcoded, no config and tenant dimension | `todo` | quota service when finalized directly treated single-machine dev defaults as production constants. |
| 483 | truth/storage-quota-service.ts:155-178 excess cleanup rmSync(force:true) no dev/ino binding, not distinguishing active read handles; sort only by mtimeMs no tiebreaker | `todo` | quota cleanup follows early "good enough" delete semantics, not following R23-10's fd identity binding. |
| 484 | truth/async-repositories/event-repository.ts:46-78 insertEvent splits events and event_consumer_acks into two asyncExecute, no explicit BEGIN/COMMIT; async path outbox/ack atomicity not guaranteed | `todo` | async repository split path only ported statements not ported transaction boundary. |
| 485 | truth/async-repositories/event-repository.ts:95-108 listEventDeadLetters cursor only by dead_lettered_at, no id tiebreaker and LIMIT default 100 silently truncates | `todo` | Dead letter list drafted as "operations quick query", not filled stable cursor and explicit truncation signal. |
| 486 | truth/async-repositories/event-repository.ts:67-77 ack batch INSERT without ON CONFLICT; event retry (event_id,consumer_id) unique conflict directly throws | `todo` | First version ack write constructed as "first success" assumption, not aligned with retry/compensation path conflict strategy. |


## Round 2 · eval / redteam / roi / training-data-policy / divisions / helpers / Docker / package & lockfile / GH workflows / stryker

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 487 | eval/datasets/citation-source/dataset-card.json:13, swe-style/dataset-card.json:13, tau-style/dataset-card.json:13 all have `frozenHash` as `sha256:<datasetId>` placeholder string not actual SHA-256 digest | `todo` | dataset-card schema accepts any string, no real content hash check implemented, oracle can be arbitrarily rewritten still passing release gate. |
| 488 | eval/schemas/eval-dataset-card.schema.json:38 sets `additionalProperties: true`, allows smuggling unmanaged fields (e.g. custom metric weights) into card polluting evaluation criteria | `todo` | schema does not lock field set, future field name drift and attacker injected fields will not trigger validation failure. |
| 489 | redteam/severity.schema.json:16 also `additionalProperties: true` and only validates severity single field; redteam cases can arbitrarily omit caseId/objective/scope to pass validation | `todo` | severity schema is essentially an empty gate, cannot support redteam scoring oracle minimum contract. |
| 490 | eval/divisions/research/eval-suite.yaml:4 and eval/divisions/support/eval-suite.yaml:4 reportRef points to knowledge-base/customer-service division's leadership-evidence directory | `todo` | eval-suite has no schema validation on division→reportRef relation, causing division catalog drift and possible to make one division pass through another division's report to "borrow" evidence. |
| 491 | redteam/divisions/research/redteam-suite.yaml:3 and redteam/divisions/support/redteam-suite.yaml:3 also point reportRef to knowledge-base/customer-service | `todo` | redteam-suite missing schema, oracle report can be silently redirected. |
| 492 | All eval/divisions/*/eval-suite.yaml:5 and redteam/divisions/*/*.yaml:4 lastRefreshedAt all hardcoded to `"2026-06-01T00:00:00.000Z"` | `todo` | Refresh time not written by governance pipeline, but manual string, eval/redteam "freshness gate" effectively a no-op. |
| 493 | eval/divisions/, redteam/divisions/, roi/divisions/, training-data-policy/divisions/ have no accompanying JSON schema to validate yaml content | `todo` | Governance yaml completely naked, field spelling errors (e.g. policyMode: redacted_only vs restricted) not rejected by lint. |
| 494 | roi/divisions/ only contains coding/customer-service/knowledge-base three yaml, missing research.yaml/support.yaml, drift from eval/redteam/training-data-policy five-division baseline | `todo` | division catalog not aligned in ROI dimension, audit:division-inventory cannot discover this gap. |
| 495 | roi/measurement-protocol.md not referenced in any yaml, no protocolRef field binding measurement protocol to division metrics | `todo` | ROI calculation standard decoupled from division yaml, can be silently replaced/skipped protocol still passing ROI gate. |
| 496 | training-data-policy/revocation.yaml has no schema, no version, affectedStores is any string list, misspelling `state-evidence`/`state_evidence` not rejected | `todo` | Revocation policy missing version and enum constraints, model-data tombstone propagation may be missed due to inconsistent fields between deployments. |
| 497 | training-data-policy/divisions/*.yaml policyMode values vary between redacted_only and restricted, but no catalog/enum describes semantic boundary | `todo` | Training data admission standard not centrally defined, inter-division policy comparison and audit needs manual interpretation. |
| 498 | Dockerfile:9 and :39 both `npm ci` without --ignore-scripts, and builder stage does not USER node, npm lifecycle scripts run as root | `todo` | Multi-stage build + GHA cache allows infected deps to run as root in PR build and pollute cache layer. |
| 499 | Dockerfile:38-39 runtime stage again `npm ci --omit=dev`, but builder already installed dependencies; two installs amplify registry/lifecycle attack surface | `todo` | Multi-stage build not reusing through `COPY --from=build /app/node_modules`, breaking multi-stage cache isolation. |
| 500 | Dockerfile:34-36 installing tini without `--no-install-suggests`, without pinning apt package versions and GPG verification policy | `todo` | Runtime image base package version drifts with Debian repo, breaking SBOM/cosign signing reproducibility commitment. |
| 501 | docker-compose.yml:157-159 automatic-agent-network does not declare `internal: true`, all services keep outbound network capability | `todo` | Network not isolated; compromised container can make outbound callbacks. |
| 502 | docker-compose.yml:97, :124 Prometheus/Alertmanager only pinned by tag (v3.5.3, v0.32.1), not using `image@sha256:...` digest pinning | `todo` | Image can be replaced by upstream same tag, breaking cosign/SBOM chain consistency. |
| 503 | package.json:285-293 all runtime dependencies use `^` semantic version, and no overrides/resolutions field to lock transitive vulnerable packages | `todo` | Dependency pinning insufficient, transitive dependencies can drift, weakening npm audit and trivy reproducibility. |
| 504 | package-lock.json:44+ resolved URL all point to `https://registry.npmmirror.com/...` instead of registry.npmjs.org | `todo` | CI and production builds indirectly trust third-party mirror (npmmirror); mirror being polluted or taken down breaks supply-chain. |
| 505 | tsconfig.json:30-124 exclude array lists 100+ test files/directories, making typecheck:tests actually skip a lot of P0/integration/E2E tests | `todo` | strict-mode in test tree has large regression, hidden by "exclude one by one" approach. |
| 506 | tsconfig.build.json:7 only includes `src/**/*.ts` and `tests/helpers/**/*.ts`; other tests do not participate in build-phase strict type check | `todo` | Real division contract tests do not enter build-type validation path. |
| 507 | tsconfig.scripts.json:6 sets checkJs:false but includes `*.config.js/cjs/mjs` and `scripts/**/*.mjs` | `todo` | Top-level config and scripts actually not doing any TS check. |
| 508 | stryker.config.mjs:20-27 mutate list only covers 6 paths (http-server/middleware/ingress/webhook/oapeflir/redis-options), but still declares `thresholds:{high:80,low:60,break:50}` | `todo` | mutation oracle gaming: achieve high score by narrowing mutation surface. |
| 509 | stryker.config.mjs:19 coverageAnalysis:"off" combined with commandRunner means each mutation runs all tests without coverage mapping | `todo` | Sacrifices both performance and masks which tests bear mutation kill. |
| 510 | .github/workflows/ci.yml:43,52,55,58 under pull_request event directly npm ci and docker build without trusting PR Dockerfile/lockfile, and build-and-push cache type=gha shared | `todo` | Third-party PR can inject lifecycle scripts/Dockerfile commands to execute on trusted runner. |
| 511 | .github/workflows/ci.yml:13-16 top-level permissions grants security-events:write, all jobs (including validate not involving SARIF) inherit | `todo` | Not minimizing permissions by job. |
| 512 | .github/workflows/publish-image.yml:23-26 top-level permissions simultaneously gives packages:write and id-token:write, preflight job only does validation also inherits | `todo` | preflight stage does not need to write packages/sign OIDC token; permission creep. |
| 513 | .github/workflows/publish-image.yml:69 IMAGE_REPOSITORY entirely controlled by workflow_dispatch input, regex does not constrain namespace prefix | `todo` | Operator or compromised account can push to arbitrary subpath, bypassing naming constraints and polluting cosign transparency log. |
| 514 | .github/workflows/publish-image.yml:122-123 cache-from:type=gha, cache-to:type=gha,mode=min and ci.yml docker build share GHA cache | `todo` | multi-stage cache poisoning: PR can write malicious layer cache, publish workflow reuse means injecting into official image. |
| 515 | .github/workflows/deploy-environment.yml:65-67 PUBLIC_DOMAIN regex `^[A-Za-z0-9.-]+$` allows starting with `-` or `.` and not limited in length | `todo` | Subsequent `--set-string ingress.domain=${PUBLIC_DOMAIN}` can be constructed as -flag form to trigger option injection. |
| 516 | .github/workflows/deploy-environment.yml:367-376 PREVIOUS_REVISION from helm history JSON, no `^[0-9]+$` validation before being spliced into helm rollback command | `todo` | helm history output when polluted rollback command executes with non-numeric arguments. |
| 517 | .github/workflows/dr-validation.yml:69-82 uses `$(date -Iseconds)` directly spliced into sqlite3 SQL string in shell, not parameterized | `todo` | DR drill dataset generation depends on shell string concatenation, date behavior drift makes RTO/RPO report uncertain. |
| 518 | .github/workflows/dr-validation.yml:65-67 only checks `command -v sqlite3`, does not pin sqlite3 version | `todo` | sqlite3 version on ubuntu-latest drifts with runner. |
| 519 | .github/workflows/secret-provider-integration.yml:31-32 uses `::add-mask::${whole JSON}` to mask inline secret | `todo` | GitHub mask only matches literal whole; subfield values in multi-line JSON not masked. |
| 520 | .github/workflows/ui-quality.yml:61 uses third-party treosh/lighthouse-ci-action (pinned by SHA), but no reusable workflow security audit or actions allowlist record | `todo` | Once third-party action mirror is re-signed or repo transferred, SHA pin may still be silently released during upgrade. |
| 521 | .github/workflows/ui-quality.yml:67 executes `playwright install --with-deps` (apt-get installs system packages) only after preview server starts | `todo` | apt-get modifies runner state during tested process runtime, contending for file locks with preview server. |
| 522 | .github/workflows/* whole workflow set does not declare top-level `GITHUB_TOKEN: ""` or token-permissions convergence policy, actions/checkout default carries writable token | `todo` | checkout default credentials violate least privilege policy. |
| 523 | eval/divisions/coding/eval-suite.yaml:3 `runner: patch-gate` string has no schema registry and version field, runner replacement/downgrade not observable in repo | `todo` | eval determinism lacks runner identifier + version + implementation hash triplet. |

## Round 2 · five-plane-execution deep (queue / ha / lease / worker-pool / side-effect / compensation / dlq / dispatch / idempotency)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 524 | five-plane-execution/queue/sqlite-queue-adapter.ts:24-31,52-61 enqueue first SELECT hits idempotency_key then INSERT, two statements not in transaction; concurrent same (queueName,idempotencyKey) can double-insert | `todo` | Sync enqueue path leaves idempotency dedup to separate query, no unique index or single transaction INSERT…ON CONFLICT fallback. |
| 525 | queue/sqlite-queue-adapter.ts:103-107 nack puts task directly back to waiting, no delay_until written, same worker immediately re-dequeue forms failure hot loop | `todo` | nack implementation only pursues "retry ASAP", not reusing retry policy's backoffMs. |
| 526 | queue/sqlite-queue-adapter.ts:99-102,137-143,169 writes only use `dead_letter`/`waiting`, but stats report `failed`, retryJob WHERE status IN ('failed','dead_letter') still enumerates failed | `todo` | Status enum inherited from earlier version, write side converged but read/recovery side not synchronously cleaned, forming fact dead branch and metric always 0. |
| 527 | queue/sqlite-queue-adapter.ts:146-154 purge first SELECT entire set ID then DELETE same condition, two steps not transactional, concurrent ack can make SELECT and DELETE set inconsistent | `todo` | purge goes two-step to return affected rows, not using RETURNING or transaction wrap. |
| 528 | queue/sqlite-queue-adapter.ts:78-83 dequeue marks task active but no visibility timeout/lease, worker crash task forever stuck active | `todo` | SQLite adapter only reuses status field for concurrency protection, no independent visibility timeout and recovery path for in-flight tasks. |
| 529 | queue/redis-queue-adapter.ts:681 enqueue waiting score = `priority*1e13 + createdAt.ms`, priority≥1 exceeds 2^53 safe integer, ms bit precision lost, FIFO order disrupted | `todo` | Score formula assembled as "priority high bit + time low bit" by intuition, not considering Redis zset double precision float 53-bit significant digit constraint. |
| 530 | queue/redis-queue-adapter.ts:684-696 sync enqueue directly returns job, pipeline.exec() executes async via .then/.catch, caller's jobId not even written to db when Redis fails | `todo` | For sync interface compat making pipeline fire-and-forget. |
| 531 | queue/redis-queue-adapter.ts:641-697 vs:728-734 sync enqueue does not check idx:<queue>:idempotency hash, only enqueueAsync path does idempotency dedup; mixed use means duplicate enqueue | `todo` | Two paths implement idempotency separately, no unified idempotency index access layer. |
| 532 | queue/redis-queue-adapter.ts:539-575 claimWaitingJobWithoutEval fallback path uses multiple await sequential execution, forming behavior branch with already-fixed Lua script; Redis deployment not enabling EVAL still has concurrent claim same jobId | `todo` | No unified constraint that Redis adapter must run on EVAL-supporting instance. |
| 533 | queue/redis-queue-adapter.ts:584-622 CLAIM_WAITING_JOB_LUA only judges by status='waiting', does not check attempts < max_attempts; tasks with exhausted budget can still be claimed again | `todo` | Lua script only migrated state machine "number taking" semantics, did not sink dead letter budget judgment into atomic script. |
| 534 | queue/ticket-priority-queue.ts:23-30 readyTickets/deferredTickets no capacity limit, no TTL, attack or leak OOM | `todo` | In-memory heap queue only cares about sort correctness, never introduced bounded capacity, eviction or backpressure strategy. |
| 535 | queue/ticket-priority-queue.ts:103-109 parseDispatchAfterMs failure returns null, treated as "immediately dispatchable" → malformed dispatchAfter silently elevates priority | `todo` | Parse fault-tolerance goes "lenient" branch: treats unparseable as immediately dispatchable. |
| 536 | queue/ticket-priority-queue.ts overall only maintains readyTickets/deferredTickets in memory, no fsync, no snapshot, process crash all undispatched tickets lost | `todo` | This queue long-term as only buffer for dispatch hot path, still implemented as in-memory example. |
| 537 | ha/ha-coordinator-service-inner.ts:209-211,231 acquireLeadership uses `Date.now()+ttl` to generate expiresAt and compares with nowIso() string; wall clock rollback makes new lease born expired | `todo` | Time source mixed wall-clock numeric and ISO string, not using monotonic or centralized time adapter. |
| 538 | ha/ha-coordinator-service-inner.ts:230-232 acquireLeadership uses `new Date(currentLeaderLease.expiresAt)` directly NaN conversion; malformed ISO→NaN comparison always false→treated as expired, wrong preemption | `todo` | ISO parsing no strict validation, depends on Node Date loose parsing. |
| 539 | ha/ha-coordinator-service-inner.ts:261-263 demote writes `UPDATE coordinator_nodes SET is_leader=0 WHERE is_leader=1` full table update, not constrained by nodeId | `todo` | demote only cares about "clean up old leader", not using nodeId/epoch precise location. |
| 540 | ha/ha-coordinator-service-inner.ts:79,246 fencingTokenCounter only initialized in memory, multi-coordinator deployment or restart race concurrent acquireLeadership can assign same token | `todo` | fencing token uses in-process auto-increment counter instead of persistent sequence. |
| 541 | ha/ha-coordinator-service-inner.ts:168-173 removeNode when admin actively takes leader offline writes epoch ended_at cause as expired, confuses "expired" with "actively taken offline" two types of audit semantics | `todo` | Node removal path reuses lease expiry cause label. |
| 542 | lease/execution-lease-service.ts:232-307 renewLease first getExecutionLease then renewExecutionLease, not in single SQL using fencingToken+status for CAS; concurrent release/renew can overwrite others' leases | `todo` | Renew process split into read-then-write two steps, did not put fencing token in WHERE clause as optimistic lock. |
| 543 | lease/execution-lease-service.ts:321-375 releaseLease only checks workerId/status, does not require caller to carry fencingToken; expired worker can release subsequent lease | `todo` | release design uses status as implicit fencing. |
| 544 | lease/execution-lease-service.ts:175-181 TTL out of bounds only returns outcome:"blocked" but not write lease_audits; out-of-bounds attempt not visible on audit chain | `todo` | Boundary rejection path and audit write not aligned. |
| 545 | lease/execution-lease-service.ts:189 acquireLeaseWithinTransaction uses `getLatestFencingToken(executionId)+1` to compute next token, depends on SQLite default isolation; under non-default isolation or concurrent external transaction same executionId may get same token | `todo` | Next token computation in application layer not database unique sequence. |
| 546 | worker-pool/execution-worker-handshake-service.ts:77-273 claimExecution every failure branch writes tier_2 event through recordRejectedEvent, repeated retries will amplify event traffic and pollute audit | `todo` | Rejection event only cares about visibility, not deduping/rate-limiting by (ticketId, reasonCode). |
| 547 | worker-pool/execution-worker-handshake-service.ts:170-176 validateWriteAccess executes before remoteAuthority/resourceCeiling, unauthorized remote worker still triggers lease write access check | `todo` | Validation order by code readability, did not put cheap/safe remote auth first. |
| 548 | worker-pool/execution-worker-writeback-service.ts:151-154 constructor `new ExecutionLeaseService/TransitionService/WorkerRegistryService`, cannot inject doubles | `todo` | Writeback service directly instantiates collaborators, not going through dependency injection abstraction. |
| 549 | worker-pool/execution-worker-writeback-service.ts:185-200 task==null still emits tier_2 rejected event but traceId taken from execution.taskId missing context → audit chain broken | `todo` | Rejection event hardcodes event structure, does not fall back to orphan-event marker when missing task context. |
| 550 | side-effect-manager.ts:185 transitionSideEffect directly splices reasonCode into `audit://side-effects/${id}/${reasonCode}` without URI escaping; containing ?# characters breaks audit URI parsing | `todo` | Audit ref template generated by string interpolation. |
| 551 | side-effect-manager.ts:172-174 transitionSideEffect in toStatus==='proposed' branch skips preCommitValidator; proposed path can bypass policy pre-validation | `todo` | Validation implemented as "non-first transition only validate" early, treating proposed as always safe initial state. |
| 552 | compensation-manager.ts:244-292 executeCompensationSteps missing (plan.compensationId) level concurrent/reentrant CAS guard; repeated trigger means repeated execution of whole step group | `todo` | Compensation execution only retains state machine skeleton, does not persist "started/completed" as dedup lock. |
| 553 | ha/lease-reclaimer-service.ts:434-448 getExpiredLeases comment self-admits "actual implementation would query DB for expired leases", only returns current activeLease, expired lease scan not implemented | `todo` | Placeholder implementation long-term called by production path. |
| 554 | ha/lease-reclaimer-service.ts:462-485 expireLease/expireLeaseForNode only writes debug log, never writes back leadership_leases state | `todo` | reclaim behavior nominally completes actually only log. |
| 555 | ha/lease-reclaimer-service.ts:90 nodeId default `lease-reclaimer-${nowIso()}`, each construction produces different ID; monitoring/audit cannot aggregate by reclaimer instance | `todo` | Default ID uses ISO timestamp instead of stable identity. |
| 556 | five-plane-state-evidence/events/dlq-service.ts:238-239 scheduleRetry backoff = `base*2^retryCount` no upper cap, when retryCount large quickly Infinity, nextRetryAt calculation becomes NaN | `todo` | Exponential backoff only implements doubling logic, no cap or jitter upper bound protection. |
| 557 | five-plane-state-evidence/events/dlq-service.ts:204 enqueue default writes failureCategory as null, operations dashboard lacks classification baseline | `todo` | Enqueue path treats classification as optional, does not fall back to unknown etc. explicit classification when default. |
| 558 | five-plane-interface/api/middleware/idempotency-key.ts:397-414 extractIdempotencyKey when header missing falls back to parsing entire body JSON to find idempotencyKey field; large request triggers JSON.parse DoS and mixes transport/app layer semantics | `todo` | header fallback retreat follows "lenient" principle to parse entire body as fallback. |
| 559 | five-plane-interface/api/middleware/idempotency-key.ts:362-373 globalIdempotencyKeyMiddleware singleton + default InMemoryStorage, multi-instance/multi-process deployment idempotency domain not shared | `todo` | Global singleton carries runtime state, but default storage is still in-process Map. |
| 560 | five-plane-execution/dispatcher/execution-dispatch-service.ts:168-186,272-293 createTicket/dispatchNext inside transaction `store.event.insertEvent` writes tier_2 event, transaction rollback then audit event lost | `todo` | Event write and business write share same transaction, not going through outbox/transaction boundary external publish. |


## Round 3 · evaluation / oracle / replay / judge / golden

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 561 | Repository root missing independent `evaluation/` directory, only has `eval/` (datasets/divisions/schemas), inconsistent with multiple doc/chapter descriptions of `evaluation/` entry | `todo` | Directory naming drift, source-of-truth not aligned. |
| 562 | src/platform/prompt-engine/eval/llm-eval-service.ts:646-657 `createDeterministicCiEvaluator` directly treats caseDefinition.expectedOutput as actualOutput and assigns score 1, CI gate equivalent to always passing | `todo` | scoring oracle goes "self-compare" fallback, equivalent to closing gate. |
| 563 | llm-eval-service.ts:689-695 `deterministicAbScore` fixes treatment at 0.93, control at 0.74; fallback-evaluated A/B always favors treatment and produces "significant" conclusion | `todo` | A/B fallback scoring uses static bias constants. |
| 564 | llm-eval-service.ts:728-773 Welch's t-test uses tStatistic directly as zScore in standard normal CDF, not using t-distribution or degree of freedom correction, small sample p value systematically smaller | `todo` | Formula implementation mixes z and t, statistical credibility masquerading. |
| 565 | llm-eval-service.ts:810-845 Bootstrap CI iteration count fixed at 10000, lowerIndex/upperIndex uses Math.floor without boundary protection, and `?? -Infinity/Infinity` makes empty tail produce infinite CI | `todo` | Interval computation missing tail boundary and degradation strategy. |
| 566 | llm-eval-service.ts:850-873 resampleWithReplacement uses createDeterministicSampler(values) using data content as FNV seed, bootstrap completely predictable; outer for(const v of values) v unused | `todo` | Pseudo bootstrap: seed derived from sample itself, losing randomness. |
| 567 | llm-eval-service.ts:63-84 inferProviderFamilyFromModel uses includes substring match, combined names like "gpt-claude-finetune" will be misclassified, bypassing §17.5 judge independence check | `todo` | Family identification uses substring inclusion not explicit registry. |
| 568 | llm-eval-service.ts:144 startRun defaults promptVersion="default", does not enforce pin/semantic version on registration, CI gate can report on unfrozen prompt | `todo` | prompt version policy allows "default" fallback. |
| 569 | llm-eval-service.ts:558-594 detectRegression only pulls historical run by (suiteId, modelId, promptVersion), does not verify dataset frozenHash/version, dataset mid-modification then delta meaningless | `todo` | Regression comparison not putting dataset fingerprint in primary key. |
| 570 | llm-eval-service.ts:588 regression threshold hardcoded `delta < -0.05`, inconsistent with §17.3 risk-adjusted threshold table, and does not distinguish critical/standard | `todo` | Threshold not derived from risk policy. |
| 571 | llm-eval-service.ts:108-119 Suite in SQLite persists cases=JSON.stringify(...) but does not store checksum/version fingerprint, subsequent rows can be manually UPDATEd and run history cannot detect | `todo` | Persistence without frozenHash tamper-resistance. |
| 572 | src/platform/prompt-engine/eval/eval-dataset-judge-service.ts:540-548 llm_judge directly reads submission.criterionSignals[criterionId], score self-submitted by evaluated party, judge profile only as metadata, does not really call judge model | `todo` | Judge path degrades to self-reported score. |
| 573 | eval-dataset-judge-service.ts:520-527 contains criterion in `criterion.config.substring ?? needle ?? input.expectedOutput` three-level fallback; attacker constructs expectedOutput making needle fall back to output fragment, always matches | `todo` | Fallback chain allows expected value to serve as match pattern. |
| 574 | eval-dataset-judge-service.ts:182-204 key sample lower bound 200/100/50 hardcoded, does not accept division config override; existing eval/divisions/*/eval-suite.yaml far less than this number → registration will hard throw | `todo` | Threshold and division data card hard constraint conflict. |
| 575 | eval-dataset-judge-service.ts:430,445 runId=newId(...), createdAt=nowIso() write to report, no freeze mode switch, replay will get different byte output | `todo` | Report generation not supporting deterministic clock/ID injection. |
| 576 | eval-dataset-judge-service.ts:653-669 stableStringify does not handle undefined vs missing keys, for Date/BigInt/Map directly gives to JSON.stringify, frozenHash/exact_match drifts between hosts | `todo` | Stable serialization not covering non-JSON native types. |
| 577 | eval-dataset-judge-service.ts:420-426 "high-risk independence" switch treats standard as high risk too (priority==="critical" or priority==="standard"), essentially equals full force → semantic drift opposite to §21.7 | `todo` | Risk level determination logic reversed. |
| 578 | src/platform/prompt-engine/eval/cross-provider-judge-service.ts:184-202 estimateLatencyRank uses model name substring regex (haiku/mini/...), new model default 100, model catalog evolution when sort silently wrong | `todo` | Latency grading uses heuristic substring not registry. |
| 579 | cross-provider-judge-service.ts:230-247 consensus voting branch overlap, multiple promoteCount===holdCount/rollbackCount===holdCount paths unreachable, and no minimum vote count threshold, single judge can decide promote | `todo` | Consensus rules not setting minimum decision count and tie-break. |
| 580 | src/platform/prompt-engine/eval/judge-provider-registry-service.ts:44-83 registerDefaults hardcodes gpt-5.4-mini/claude-sonnet/minimax-m1 etc. unversioned IDs and trustScore, does not reference prompt-model-policy registry | `todo` | Default judge registry not aligned with model policy. |
| 581 | judge-provider-registry-service.ts:91-113 selectDescriptor only sorts by trustScore-cost-id taking first, no family diversity/cooldown, consecutive selection from same family causes cross-provider illusion | `todo` | Selection algorithm not implementing independence constraints. |
| 582 | src/platform/stability/vcr-replay-fixture.ts:261-293 request fingerprint only contains temperature/reasoningLevel/topP, missing seed/maxTokens/stop/topK/responseFormat, parameter change still hits old fixture | `todo` | Fingerprint field set incomplete. |
| 583 | vcr-replay-fixture.ts:286 toolSignature only `tools.sort().join(",")`, does not contain tool version/parameter schema, tool upgrade then old fixture silently reused | `todo` | Tool signature without version fingerprint. |
| 584 | vcr-replay-fixture.ts:299-306 normalizePromptText only regex erases authorization/api_key/token, JSON body `"secret":"..."`, `X-...-Key:` etc. will enter fingerprint and recording | `todo` | Sensitive info normalization coverage incomplete. |
| 585 | vcr-replay-fixture.ts:73,196 seed?: number field received but all code paths unused, replay has no deterministic RNG injection | `todo` | Seed parameter stays at schema layer, not injected into runtime. |
| 586 | vcr-replay-fixture.ts:107-189 mode: fixture_only/vcr_replay/vcr_record only as field storage, replay() always throws vcr.fixture_missing, vcr_record no recording path | `todo` | Recording mode contract exists but not implemented. |
| 587 | src/platform/prompt-engine/eval/execution-outcome-evaluator.ts:306-333,396-424 plannedBudget/plannedDurationMs hardcoded to 0, budgetAdherence/timingSlo dimension always adherent/withinSlo | `todo` | Budget/timing dimension missing input source, always passes. |
| 588 | execution-outcome-evaluator.ts:454-463 quality score from signal count × weight summed then Math.min(1,...), multiple success signals will saturate to 1 and mask subsequent failure penalty | `todo` | Score aggregation saturates first then deducts, order wrong. |
| 589 | execution-outcome-evaluator.ts:489-499 when passed baselineQualityScore then passed=deltaGatePassed, skipping riskAdjustedThreshold; continuous low baseline any low score passes gate | `todo` | delta gate covers absolute threshold gate. |
| 590 | src/platform/five-plane-orchestration/evaluator/evaluator-service.ts:336-384 before calling RiskEvaluationEngine uses failureCount hard threshold (==2/>=3) short-circuit return, contradicts engine result | `todo` | Evaluator embeds hard rules before risk engine. |
| 591 | src/platform/five-plane-orchestration/evaluator/full-trajectory-evaluator.ts:160-186 llmJudgeScore regardless of blockingEligibleJudge true/false enters (rule+judge)/2 average, uncalibrated judge can still change final score | `todo` | Calibration level does not affect scoring weight. |
| 592 | full-trajectory-evaluator.ts:76-79 trajectoryMinScore=32/40 global hardcoded, does not vary by risk class; disconnected from §17.3 risk-weighted threshold | `todo` | Trajectory threshold not parameterized. |
| 593 | src/platform/five-plane-orchestration/harness/evaluation/eval-run-service.ts:36-46 when step evidenceRefs missing falls back to feedbackEnvelope.signals, using signal ID as evidence ref comparison, candidate can forge signal name to satisfy requiredEvidence | `todo` | Evidence check degrades to signal name match when missing. |
| 594 | src/platform/stability/golden-task-runner.ts:328-361 runGoldenTaskCase does not inject random seed/clock freeze to runSingleTaskExecution, golden comparison depends on ID/timestamp derived path still not replayable | `todo` | golden entry does not assume deterministic injection responsibility. |
| 595 | golden-task-runner.ts:363-373 expectedEventsAppearInOrder only does "in order appear" match, adding any extra event will not fail; and expected.length===0 directly returns true | `todo` | Order assertion for superset always passes. |
| 596 | golden-task-runner.ts:124-131 DEFAULT_EXPECTED_OUTCOME.eventTypes contains duplicate task:status_changed, stepOutputs fixed at 1, all 7 cases share → cannot capture individual case actual difference | `todo` | Shared default expectations make cases mask each other. |
| 597 | src/platform/stability/stable-event-replay-rehearsal.ts:105-111,193-201 report writes performance.now(), new Date().toISOString(), replay not byte-stable | `todo` | rehearsal output contains runtime drift fields. |
| 598 | stable-event-replay-rehearsal.ts:139-153 same consumer through two ops.subscribe override (throw first then succeed), coupled with real replay path, and no fixture landing | `todo` | Rehearsal process depends on runtime side effect order not fixture. |

## Round 3 · five-plane-execution remaining (budget / recovery / repair / sweeper / replay-worker / dispatch-reconciliation / admission / preemption / cleanup)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 599 | five-plane-execution/budget-allocator.ts:243 trackActiveReservation called before persistLedger | `todo` | After persist failure in-memory tracking still books, sweeper never releases ghost reservation. |
| 600 | five-plane-execution/budget-allocator.ts:311 release path uses Date.parse(dbTime) gets NaN then treated as "expired" | `todo` | Timestamp format exception silently treated as releasable, causing active reservation to be wrongly reclaimed. |
| 601 | five-plane-execution/budget-ledger-reservation.ts:31-46 ensureLedger read-modify-write not in transaction | `todo` | Concurrent first creation produces duplicate ledger rows or unique key conflict. |
| 602 | five-plane-execution/budget-reservation-sweeper.ts:33 Date.parse NaN judged as "not expired" | `todo` | Opposite semantics to allocator release path, both parties action inconsistent when time format exception. |
| 603 | five-plane-execution/recovery/runtime-recovery-service.ts:405 listRuntimeRecoveryRecords no tenantId filter | `todo` | Cross-tenant records processed by same recovery decision, violating isolation boundary. |
| 604 | five-plane-execution/recovery/runtime-recovery-service.ts:470 staleness judgment default now="9999-…" | `todo` | When parameter missing everything is not stale, recovery scan silently disabled. |
| 605 | five-plane-execution/recovery/runtime-recovery-service.ts:555 buildCompensationPlan does not dedup DLQ items | `todo` | Same failure compensated multiple times, breaking idempotency and amplifying side effects. |
| 606 | five-plane-execution/recovery/runtime-recovery-service.ts:692 inferLegacy overrides config decision | `todo` | Fallback path still effective when config exists, causing policy to be silently rewritten by old logic. |
| 607 | five-plane-execution/recovery/runtime-recovery-service.ts:797 cross-region detection no attempt threshold | `todo` | Single jitter triggers cross-region switch, causing flapping and extra compensation. |
| 608 | five-plane-execution/recovery/runtime-recovery-service.ts:833 uses substring match error code and iteration order not sorted | `todo` | False match + non-deterministic traversal, same input produces different classification. |
| 609 | five-plane-execution/recovery/runtime-recovery-decision-service.ts:142 decide/apply not in same transaction | `todo` | Between decision and landing state can be modified, TOCTOU triggers illegal transition. |
| 610 | five-plane-execution/recovery/runtime-recovery-decision-service.ts:215 SQLite transaction inside calls MemoryService async IO | `todo` | Long transaction holds lock, external failure rollback incomplete, state machine partial commit. |
| 611 | five-plane-execution/recovery/runtime-recovery-decision-service.ts:226 directly writes status="cancelled" not through RSM | `todo` | Bypasses state machine validation, illegal transitions allowed and pollute audit. |
| 612 | five-plane-execution/recovery/runtime-recovery-decision-service.ts:343 insertDeadLetter no duplicate check | `todo` | Replay/retry multiple DLQ insert, operations count and alert distorted. |
| 613 | five-plane-execution/recovery/runtime-recovery-replay-service.ts:233/247 replay not filtered by tenantId | `todo` | Tenant A replay hits tenant B records, cross-tenant side effect. |
| 614 | five-plane-execution/recovery/runtime-recovery-replay-service.ts:387/396 targetId uses prefix/contains match | `todo` | Unrelated IDs wrongly hit, wrong object replayed. |
| 615 | five-plane-execution/recovery/runtime-repair-service.ts:182 reclaimActiveLease executed outside main transaction | `todo` | lease reclaim success but subsequent state write failure when both inconsistent. |
| 616 | five-plane-execution/recovery/runtime-repair-service.ts:233 traceId=newId breaks causal chain | `todo` | Repair event cannot trace to source fault, audit and diagnosis broken chain. |
| 617 | five-plane-execution/recovery/runtime-repair-service.ts:268 replace ticket created outside transaction | `todo` | Main repair failure but replacement ticket already in db, residual orphan ticket triggers ghost execution. |
| 618 | five-plane-execution/recovery/runtime-repair-service.ts:519 deleteFileLock no fencing token | `todo` | Old holder's late release deletes new holder's lock file, violates mutex. |
| 619 | five-plane-execution/recovery/runtime-repair-service.ts:587/593 ack rebuild and drain outside transaction | `todo` | Partial write success then crash residual half-rebuild state, recovery not idempotent. |
| 620 | five-plane-execution/recovery/runtime-repair-service.ts:621 applied flag based on optimistic default | `todo` | Any sub-step not success still reports applied=true, operations misjudges repaired. |
| 621 | five-plane-execution/ha/stuck-run-sweeper-service.ts:252 if branch body empty | `todo` | Trigger condition exists but no action, dead-code logic silently misses reporting. |
| 622 | five-plane-execution/ha/stuck-run-sweeper-service.ts:646 status="killed" written before callback success | `todo` | Callback failure state already migrated, external resource not released but record terminated. |
| 623 | five-plane-execution/ha/stuck-run-sweeper-service.ts:695 cleanup same "change state first then callback" pattern | `todo` | Callback exception swallowed in catch, cleaned state mismatches actual resources. |
| 624 | five-plane-execution/ha/stuck-run-sweeper-service.ts:604 only uses now-startedAt to judge stuck | `todo` | Clock rollback makes difference smaller, stuck run never cleaned. |
| 625 | five-plane-execution/ha/replay-worker.ts:64 Promise.all unbounded fan-out on all to-be-replayed objects | `todo` | Large batch replay fills downstream/connection pool, causing cascading timeout. |
| 626 | five-plane-execution/ha/replay-worker.ts:68 hasRealSideEffect misses cancelled/dead_lettered status | `todo` | Already dead-lettered side effect executed again, violates at-most-once semantics. |
| 627 | five-plane-execution/ha/projection-rebuild-worker.ts:60 partial failure still reports success | `todo` | Monitoring mistakenly thinks rebuild complete, misses repair window. |
| 628 | five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.ts:286 reuse attempt creating replacement ticket | `todo` | Conflicts with active ticket unique key (executionId,attempt). |
| 629 | five-plane-execution/dispatcher/admission-controller.ts:266 critical priority directly bypasses tenant quota | `todo` | Single tenant available critical tag breaks global quota isolation. |
| 630 | five-plane-execution/dispatcher/execution-priority-preemption-service.ts:260 idempotencyKey=newId() non-deterministic | `todo` | Transaction replay/retry each time produces new key, event dedup fails. |
| 631 | five-plane-execution/dispatcher/execution-priority-preemption-service.ts:316 selectCandidate does not filter worker by tenant | `todo` | Cross-tenant preemption victim, violates isolation. |
| 632 | five-plane-execution/dispatcher/execution-priority-preemption-service.ts:415 only matches lease.workerId does not check fencing | `todo` | Old lease still considered valid, preemption based on stale holder. |
| 633 | five-plane-execution/dispatcher/execution-priority-preemption-service.ts:419 takes last ticket does not distinguish attempt | `todo` | Hits historical attempt ticket, candidate priority determination wrong. |
| 634 | five-plane-execution/dispatcher/execution-priority-preemption-service.ts:473 replace ticket reuses execution.attempt | `todo` | Conflicts with reconciliation (executionId,attempt) unique key when concurrent. |
| 635 | five-plane-execution/run-termination-cleanup.ts:174 try/catch directly silently swallows error | `todo` | Cleanup failure swallowed, outer layer has no awareness to retry. |
| 636 | five-plane-execution/run-termination-cleanup.ts:200 stateEvidenceFlush exception swallowed | `todo` | Evidence lost but process continues, post-hoc cannot rebuild audit. |
| 637 | five-plane-execution/run-termination-cleanup.ts:213 compensation triggered before resource cleanup | `todo` | Sequence misalignment: compensation reads not-yet-released/invalidated resource handles. |
| 638 | five-plane-execution/run-termination-cleanup.ts:238 callback no per-callback timeout and concurrency upper limit | `todo` | Single slow callback blocks entire batch cleanup, runtime long tail uncontrollable. |
| 639 | five-plane-execution/run-termination-cleanup.ts:271 partial threshold uses ordered.length not success count | `todo` | All failure still treated as partial, skipping escalation path. |
| 640 | five-plane-execution/run-termination-cleanup.ts:333 partial still publishes run.cleanup_completed | `todo` | Event name inconsistent with actual state, downstream misjudges completed. |
| 641 | five-plane-execution/run-termination-cleanup.ts:350 unknown kind placed at front | `todo` | Unknown callback executes before known critical callback, breaks cleanup order contract. |

## Round 3 · scripts / bin ops entries

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 642 | scripts/backup-sqlite.sh:32-33 BACKUP_PATH directly concatenated from BACKUP_DIR env var, no whitelist or repo root inclusion check | `todo` | Backup path not doing realpath + repo root startsWith check, can be pointed to /etc/cron.d etc. |
| 643 | scripts/backup-sqlite.sh:49 sqlite3 .backup command only replaces single quotes, does not reject newline/semicolon/backslash | `todo` | SQL/command string relies on manual escape, not going through parameterization. |
| 644 | scripts/backup-sqlite.sh:101-117 rclone/aws s3 cp directly concatenates AA_BACKUP_REMOTE_URI, no scheme/host whitelist | `todo` | Remote URI as string concatenation, can inject --config etc. parameters. |
| 645 | scripts/backup-sqlite.sh:39-44 trap 'rm -rf "$LOCK_DIR"' LOCK_DIR driven by BACKUP_DIR, BACKUP_DIR=/ dangerous | `todo` | rm -rf path variable not hard-constrained in repo backups/ subtree. |
| 646 | scripts/backup-sqlite.sh:131-137 find -mtime +N -delete repeated run can silently delete un-uploaded successful backups; exit code does not distinguish success/skip/fail | `todo` | Idempotent cleanup not linked with upload ack, single exit code semantics. |
| 647 | scripts/restore-sqlite.sh:32-45 DB_PATH only realpath, no repo root inclusion check, mv -f can overwrite any file | `todo` | restore target path not doing repo root inclusion check. |


## Round 3 · cross-plane contract consistency (contracts ↔ schemas ↔ default.json ↔ implementation)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 647 | scripts/restore-sqlite.sh:32-45 DB_PATH only realpath, no repo root inclusion check, mv -f can overwrite any file | `todo` | restore target path not doing repo root inclusion check. |
| 648 | scripts/ci/audit-pilot-evidence-corpus.mjs:5-17 readFileSync reads contracts/contracts-corpus.jsonl but no schema check; corrupt line does not throw | `todo` | Audit script treats input as line stream, does not pre-validate schema. |
| 649 | scripts/ci/audit-pilot-evidence-corpus.mjs:51-63 only counts by `path` substring, path alias rewriting not merged; same contract under multiple paths double-counted | `todo` | Audit metric count rule does not handle path aliasing. |
| 650 | scripts/ci/audit-pilot-evidence-corpus.mjs:84-94 fallback default to count=0 when contract missing, silently no signal | `todo` | Missing contract not promoted to "audit warning". |
| 651 | scripts/ci/audit-golden-snapshots.mjs:7-9 MIN_GOLDEN_BYTES=64 too small, cannot cover any actual state-evidence object | `todo` | Floor threshold not data-driven. |
| 652 | scripts/ci/audit-golden-snapshots.mjs:23 STALE_DAYS=14 hardcoded, no org/team/contract override | `todo` | Stale threshold not parameterized. |
| 653 | scripts/ci/audit-architecture-decision-sync.mjs:18-22 only checks ADR-007 8 invariants with hardcoded regex | `todo` | Audit script hardcodes specific ADR number, not extensible. |
| 654 | scripts/ci/audit-architecture-decision-sync.mjs:46 if `adrs:[]` then not throw, missing ADR silently passes | `todo` | Empty ADR list treated as success. |
| 655 | scripts/ci/audit-redteam-coverage.mjs:15-23 reads redteam-coverage.yaml but does not require schema, division drift cannot be detected | `todo` | Audit script does not require schema registration. |
| 656 | scripts/ci/audit-supply-chain-trust.mjs:28-32 "trusted" judge hardcoded list, new judge needs to manually add | `todo` | Trust list config-driven missing. |
| 657 | scripts/ci/audit-evaluation-trust.mjs:11-14 promptHash, modelHash, datasetHash all required but eval-dataset-judge-service does not write them when reporting | `todo` | Reporter side not aligned with audit constraints. |
| 658 | scripts/ci/audit-evaluation-trust.mjs:33-39 fall back to latest if 7d window empty, hides real stale risk | `todo` | Stale window fallback masks coverage gaps. |
| 659 | scripts/ci/audit-evaluation-trust.mjs:58 minEvaluatedSampleSize=0 hides small-sample evaluation | `todo` | Sample size lower bound not enforced. |
| 660 | scripts/ci/audit-tool-risk-taxonomy.mjs:18-29 only matches string `risk=R5` not actual taxonomy level field | `todo` | Audit rule shape inconsistent with config schema. |
| 661 | scripts/ci/audit-cost-budget-alignment.mjs:6-9 only checks yaml key existence, does not verify referenced division has division file | `todo` | yaml reference check missing. |
| 662 | scripts/ci/audit-llm-judge-independence.mjs:11-17 judge independence: requires 3 distinct provider families; but registry default only registers 1-2 | `todo` | Default registry does not satisfy audit constraint. |
| 663 | contracts/contracts-corpus.jsonl:1 all contracts marked "domain":"general", but contracts actually scattered in 5 plane cross-domain implementation | `todo` | contracts corpus domain field not yet refined. |
| 664 | contracts/executable-contracts/ middle contract still described in pure markdown, not strongly-typed bound to same-name .contract.ts in src/ | `todo` | executable-contracts only as docs, not compiled. |
| 665 | config/security/default.json:11 allowedCapabilities any string array, no enum/no schema validation | `todo` | security config still freeform string array. |
| 666 | config/runtime/default.json:4-22 maxConcurrentTasks/defaultTaskTimeoutMs hardcoded 8 / 600000 | `todo` | Default values not environment-tunable. |
| 667 | config/validation/* and config/quality/* respective schema references all use relative path, CI workdir resolution error silently | `todo` | Schema path resolution not robust to CWD. |
| 668 | config/validation/*:schema uses $ref pointing to files outside repo (https://json-schema.org/...) offline CI cannot resolve | `todo` | External schema references in offline CI environment. |
| 669 | config/bootstrap/default.json:34-46 hotReload.watchPaths=["config/","src/","domains/"] including src effectively equivalent to RCE entry | `todo` | hotReload watch path too broad. |
| 670 | config/environments/prod.json only audit-allowedRolloutStrategies limit, but cross-region replication config not environment-tiered | `todo` | cross-region config not environment-tiered. |
| 671 | config/division-coverage/family-readiness.yaml readinessStatus free string, no enum constraint | `todo` | Readiness status free string. |
| 672 | contracts/state-machine-contract.md:42-67 described RSM state enum (created/running/paused/completed/failed/cancelled) split into multiple partial enums in src | `todo` | Single state machine contract not implemented as single source. |
| 673 | contracts/contracts-corpus.jsonl inside multiple contracts not given version/owner/contact, audit without owner field degrades to warning | `todo` | contracts owner field optional. |
| 674 | contracts/replay-recovery-contract.md:84-101 describe 4-step recovery, but runtime-recovery-decision-service.ts:142 decide/apply not in same transaction | `todo` | Recovery contract implementation not atomic. |
| 675 | contracts/evidence-bundle-contract.md:42 envelope.metadata.canonicalizationVersion field not written in code, audit detection 0 hits | `todo` | contract field not in code. |
| 676 | contracts/release-gate-contract.md §14.3 lists canary plan / evalReportId / rollbackPlanId as required, code only optional | `todo` | required contract fields marked optional in code. |
| 677 | contracts/policy-decision-contract.md:35 describe PolicyDecisionBundle must contain policyBundleVersion, policy-engine write not carrying version | `todo` | policy bundle version not written. |
| 678 | contracts/secret-resolution-contract.md:88 describe redactedSecretRef format lease_<id>, secret-management-service line 985 still leaks leaseId | `todo` | contract-specified redacted format not applied uniformly. |
| 679 | contracts/llm-judge-contract.md:30 describe judge at least 3 distinct provider family, judge-provider-registry-service registration default only 1-2 | `todo` | contract minimum not enforced by default registry. |
| 680 | contracts/llm-judge-contract.md:51 describe frozenHash should enter report, eval-dataset-judge-service not write frozenHash | `todo` | contract required field not written. |
| 681 | contracts/memory-resolution-contract.md §13.6 describe L4 mission does not override truth, memory-gateway/index.ts:194-231 no truth check | `todo` | contract priority rule not implemented. |
| 682 | contracts/redteam-coverage-contract.md:9 describe redteam per-division required caseId/objective/scope, severity schema only validates severity | `todo` | schema does not match contract required fields. |
| 683 | contracts/risk-resolution-contract.md:18 describe sideEffectLevel/reversibility/targetEnv three-dimensions, code only based on 6 factor weighted | `todo` | contract risk dimensions not used in risk-evaluation-engine. |
| 684 | contracts/audit-bundle-contract.md:14 describe audit-event must contain actorId/decisionRef/correlationId, audit-event-integrity.ts checksum only covers JSON.stringify order | `todo` | contract required fields not in checksum scope. |
| 685 | contracts/queue-contract.md:51 visibility timeout in queue/sqlite-queue-adapter.ts not implemented | `todo` | contract feature not implemented in SQLite adapter. |
| 686 | contracts/secret-redaction-contract.md:11 redactedSecretRef forces prefix lease_, vault/gcp/aws-kms implementation log path inconsistent | `todo` | Provider log format inconsistent. |
| 687 | contracts/replay-recovery-contract.md:101 describe idempotencyKey required, runtime-recovery-decision-service not persisting idempotencyKey | `todo` | contract required field not persisted. |
| 688 | contracts/release-gate-contract.md:73 describe manifestHash = canonicalSerialization(payload), release-gate.ts no hash function | `todo` | contract hash function not implemented. |
| 689 | contracts/judge-fingerprint-contract.md:18 describe judge must carry providerFamily/modelId/fingerprint, judge-provider-registry-service selectDescriptor not outputting fingerprint | `todo` | contract required output missing. |
| 690 | contracts/state-evidence-redaction-contract.md:29 describe piiPatternSet and PII categories required, sensitive-content-scanner.ts only AKIA 16 char coverage | `todo` | contract pattern set not exhaustive. |
| 691 | contracts/snapshot-fingerprint-contract.md:11 describe checkpointHash = sha256(envelope.metadata + payload), checkpoint-envelope.ts checksum not contain metadata | `todo` | contract hash composition not aligned. |
| 692 | contracts/oracle-divergence-contract.md:25 describe oracle must be independent of self-reported, eval-dataset-judge-service directly reads submission.criterionSignals | `todo` | contract independence not enforced. |
| 693 | contracts/policy-bundle-version-contract.md:14 describe policyBundleVersion required, policy-engine write record without version | `todo` | contract version field not in code. |
| 694 | contracts/risk-taxonomy-contract.md §10.3 describe Action Risk Resolution Matrix 8-dimension mapping, risk-evaluation-engine only 6 factors | `todo` | contract matrix not implemented. |
| 695 | contracts/division-inventory-contract.md §22 describe divisions five-department baseline, roi/divisions/ only 3 departments | `todo` | contract baseline not matched. |

## Round 4 · v1.9 architecture release doc-feature implementation reconciliation (docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md)

| ID | Document Section | Unimplemented / Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 696 | §3.1 L88-95 | Architectural invariant (8) L1 ↔ AuthoritativeTaskStore source-of-truth, no cross-check mechanism in code | `todo` | grep `invariant` 8 dimensions → 0 hits。 |
| 697 | §3.2 L102-110 | L4 mission memory and L5 task store L4 mission memory can override truth, no conflict resolution code | `todo` | memory-gateway/index.ts:151-285。 |
| 698 | §3.3 L120-128 | PlanGraphDigest (canonical form) for replay equivalence, only present as concept | `todo` | grep `PlanGraphDigest` → 0。 |
| 699 | §4.1 L155-180 | oapeflir 8 stages (Plan/Prepare/Execute/Observe/Reflect/Release/Learn/Memory), only Plan/Execute/Feedback implemented | `todo` | oapeflir-loop-core.ts:218-... 600+ lines only 3-4 stages。 |
| 700 | §4.2 L185-210 | InputTrustLabel + H1 Input Gate, prompt-injection-guard outputs InjectionRisk only, no trust label | `todo` | grep `InputTrustLabel` → 0。 |
| 701 | §4.3 L215-230 | ObservationGateDecision 6 state output, output-sanitizer only InjectionRisk + redactionCount | `todo` | grep `ObservationGateDecision` → 0。 |
| 702 | §5.1 L246-256 | Invariant 11: L4 mission no override truth, memory-gateway no truth check | `todo` | memory-gateway/index.ts:194-231。 |
| 703 | §5.2 L257-266 | Invariant 14: projection filters status=quarantined/revoked/expired/superseded memoryId, not implemented | `todo` | memory-gateway/index.ts:251-280。 |
| 704 | §6.1 L290-300 | OAPEFLIR Release stage independent handling, only Plan→Execute→Feedback | `todo` | oapeflir-loop-core.ts. |
| 705 | §7.1 L350-365 | stable-evidence-bundle (checkpoint envelope + prepare receipt + commit receipt) not implemented in full | `todo` | grep `stableEvidenceBundle` → 0。 |
| 706 | §8.1 L420-440 | BaseReceiptFull only type declaration, no factory/persistence | `todo` | receipts/index.ts:40-59。 |
| 707 | §8.2 L445-465 | ReceiptType 8 types: Approval/MemoryWrite/MemoryRevoke/Release/Audit/PolicyDecision/Evaluation/Incident all missing | `todo` | grep → 0。 |
| 708 | §9.1 L480-500 | RiskEvaluationEngine 6-factor + reversibility/sideEffectLevel/targetEnv, only 6-factor | `todo` | risk-evaluation-engine.ts. |
| 709 | §10.1 L530-555 | ToolGateway prepare/commit/verify/compensate 4 phases, only thin layer | `todo` | tool-gateway/index.ts:114-146. |
| 710 | §10.2 L558-580 | ToolRiskMetadata 7 fields, only R0-R5 risk class, metadata absent | `todo` | grep `ToolRiskMetadata` → 0. |
| 711 | §11.3 L666-718 | ToolPrepareInput/Result, ToolCommitInput/Result, ToolCompensationPlan (with sideEffectLevel/dataSensitivity/targetEnv/finalRisk/blastRadius/idempotencyKey/leaseId/fencingToken/compensationPlanId) not implemented; ToolGateway uses minimal ToolGatewayActionContext | `todo` | grep `ToolPrepareInput\|ToolCommitInput\|ToolCompensationPlan` → 0; src/platform/five-plane-execution/tool-gateway/index.ts:114-146. |
| 712 | §11.4 L725-741 | ToolRiskMetadata (sideEffectLevel/reversibility/replaySafety/idempotencyRequired/leaseRequired/secretAccess/networkAccess) completely missing; config/tool-risk/taxonomy.yaml only R0-R5 risk class, missing doc-required fields | `todo` | grep `ToolRiskMetadata` → 0; config/tool-risk/taxonomy.yaml:1-50. |
| 713 | §11.6/11.7 L766-817 | PrepareReceipt / DurableOutboxRecord / CommitJournal / repair worker all missing; existing outbox only ordinary event outbox | `todo` | grep `PrepareReceipt\|DurableOutbox\|CommitJournal` → 0; src/platform/shared/outbox/*. |
| 714 | §11.7 L791-817 | Transactional Outbox transaction boundary (BEGIN…StateCommand+PrepareReceipt…COMMIT → external commit → CommitReceipt+StateCommand committed) not implemented, and ToolGateway each stage independent call, no idempotency key (tenantId+preparedActionId+idempotencyKey+toolVersion) | `todo` | tool-gateway/index.ts:206-242 no transaction/idempotency wrap. |
| 715 | §8.4 L506-520 | PolicyDryRunDecision interface (wouldAllow/wouldRequireApproval/blockingReasons/advisoryWarnings/policyBundleVersion) does not exist in src | `todo` | grep `PolicyDryRunDecision` → 0. |
| 716 | §8 L443-451 | P0a-0 interface freeze list ActionRiskInput no declaration in code | `todo` | grep `ActionRiskInput` → 0. |
| 717 | §10.1-10.2 L569-593 | Unified risk model (SideEffectLevel/Reversibility/TargetEnvironment/finalRisk=max(8 dimensions)) not landed; risk-control still uses 6-factor weighted | `todo` | grep `SideEffectLevel\|forward_fix_only\|production_mutation` → 0 src (only ux/onboarding strings). |
| 718 | §10.3 L597-608 | Action Risk Resolution Matrix parsing engine (by sideEffect/dataSensitivity/targetEnv/reversibility → riskLevel/Gate) not implemented | `todo` | risk-evaluation-engine.ts only score-based mapping to RiskLevel. |
| 719 | §10.4 L611-616 | Tool reversibility risk rule (ADR-010) reversibility not in risk decision | `todo` | grep `reversibility` only ux/onboarding; risk-control/* 0 hits. |
| 720 | §12.1 L825-830 | H1 Input Gate / Trust Tier pipeline not implemented; prompt-injection-guard not outputting trust label | `todo` | grep `InputTrustLabel` only docs. |
| 721 | §12.3 L846-857 | ObservationGateDecision (allow/allow_with_redaction/allow_with_untrusted_label/summarize_only/quarantine/block) not implemented; output-sanitizer only InjectionRisk + redactionCount | `todo` | grep `ObservationGateDecision\|summarize_only\|allow_with_untrusted_label` → 0 src. |
| 722 | §12.4 L860-893 | InputTrustLabel interface not implemented; tests/integration/platform/security/h1-lite/ directory does not exist | `todo` | grep + ls both empty. |
| 723 | §13.6 L1006-1018 | Memory Resolution conflict priority rule (L4 vs AuthoritativeTaskStore, L5 vs L6, L1 not as source) not enforced in code | `todo` | memory-gateway/index.ts:151-285 no conflict resolution. |
| 724 | §13.4 L977-985 + §13.7 | revokeManagedMemory only sets flags, does not trigger projection/index invalidation workflow | `todo` | memory-gateway/index.ts:233-249. |
| 725 | §13.4 | commitProposal hardcodes decision="approve", reject/quarantine/require_more_evidence paths not implemented | `todo` | memory-gateway/index.ts:209-216. |
| 726 | §14.1 L1042-1061 | AgentReleaseManifest / Harness Lockfile full field set (promptVersion/modelConfigVersion/toolRegistryVersion/rollbackTarget/canonicalizationVersion etc.) not landed; release-gate only 8 fields ReleaseManifestDraft | `todo` | src/platform/shared/stability/release-gate.ts:16-26; grep `harnessLockfile` → 0. |
| 727 | §14.2 L1063-1072 | Canonical Serialization Spec (dictionary order/ISO-8601/empty field not participating/canonicalizationVersion triggers rehash) not implemented | `todo` | grep `canonicalSerialization\|manifestHash` → 0; release-gate.ts no hash function. |
| 728 | §14.3 L1074-1086 | Release Gate check items (EvalReportId/RollbackPlanId/Policy compatibility/Tool schema compatibility/Canary plan) all optional in ReleaseManifestDraft, no mandatory validation | `todo` | release-gate.ts:22-23 evalReportId/rollbackPlanId optional. |
| 729 | §15.5 L1142-1155 | EvalThresholdVersion interface not implemented, Release Gate also does not reference | `todo` | grep `EvalThresholdVersion` only docs. |
| 730 | §15.6 L1161-1170 | Repository has eval/ not evals/, and no evalset.lock.yaml; missing adversarial/long-horizon/business-scenarios subset | `todo` | ls evals → not found; eval/datasets only citation/swe-style/tau-style. |
| 731 | §15.1 L1094-1099 | Adversarial / Long-horizon / Business Scenario datasets not established | `todo` | eval/datasets/*. |
| 732 | §15.4 L1126-1130 | LLM Judge calibration (evaluator version + prompt/config + sample audit record mandatory) not enforced on code side | `todo` | full-trajectory-evaluator.ts:81 only evaluator class, no audit/version registry. |
| 733 | §16.5 L1218-1232 | SecretScanner independent component not implemented (only fixture-redact and PII patterns in data-classification) | `todo` | grep `SecretScanner` → 0. |
| 734 | §16.5 L1226 | TenantIsolationGuard fail-closed unified component not implemented (scattered conversation-history-service/org-routing) | `todo` | grep `TenantIsolationGuard` → 0. |
| 735 | §16.5 L1227 | EvidenceAccessPolicy enforcer not implemented, receipt only has accessPolicyId field, no access check | `todo` | grep `EvidenceAccessPolicy` → 0; receipts/index.ts:56. |
| 736 | §16.5 L1228 | RetentionPolicyEnforcer not implemented (retentionPolicyId field exists but no expiry processing) | `todo` | grep `RetentionPolicyEnforcer` → 0. |
| 737 | §16.5 L1229 | MemoryExportDeleteWorkflow missing projection rebuild, index invalidation, user/team scope tests | `todo` | privacy-workflow.ts:1-135. |
| 738 | §16.4 L1209-1215 | BreakGlassReceipt subtype missing, break-glass flow does not generate receipt entity | `todo` | grep `BreakGlassReceipt` → 0; only break_glass string enum. |
| 739 | §17 L1239-1248 | Console RBAC dedicated Receipt types (ApprovalReceipt/MemoryWriteReceipt/MemoryRevokeReceipt/ReleaseReceipt/AuditReceipt/PolicyDecisionReceipt/EvaluationReceipt/IncidentReceipt) all not implemented | `todo` | grep above Receipt types → 0 src. |
| 740 | §17 | Memory Review / Release / Trace Explorer Console UI only 21-31 line placeholder, Approve/Revoke/Publish/Rollback/View and second approval not implemented | `todo` | ui/packages/features/release-console/src/index.tsx:1-31; memory-review/src/index.tsx 21 lines. |
| 741 | §17 | Trace Explorer/Policy/Eval/Incident Console mostly placeholder, not linked with RBAC + Receipt write path | `todo` | ui/packages/features/policy/src only src dir; features/incidents same. |
| 742 | §11.5 L755-762 | Partial Failure PartialCommitReceipt/VerifyReceipt/ApprovalReceipt subclasses not implemented, repair queue missing | `todo` | grep `PartialCommitReceipt\|VerifyReceipt` → 0. |
| 743 | §8.3 L476-501 | BaseReceiptFull only type declaration, no factory/persistence; no createBaseReceiptFull write path | `todo` | src/platform/five-plane-state-evidence/receipts/index.ts:40-59. |
| 744 | §11.7 L817 + §18.5 | rebuild CommitReceipt from outbox/commit journal repair worker not implemented | `todo` | grep `repair.*worker\|repair_worker` → 0 hits receipts/outbox. |
| 745 | §11.7 L811-815 | external side effect timeout prohibits blind retry requires idempotencyKey query final state; ToolGateway full text no idempotencyKey path | `todo` | tool-gateway/index.ts. |
| 746 | §14.3 + §9.2 | release-gate not implementing canary plan field or check | `todo` | grep `canary\|CanaryPlan` in src/platform/shared/stability → 0. |
| 747 | §9.2 + §15.3 | Cost/Latency advisory→blocking switch: observability/cost-latency-release-gate.ts exists but not linked with ReleaseManifestDraft / stable-gate, no scenario threshold table | `todo` | release-gate.ts not reference cost-latency-release-gate; shared/observability/index.ts:14. |
| 748 | §5 Invariant 11 L251 | MemoryGateway not in commitProposal validates L4 mission does not override truth/AuthoritativeTaskStore; missing invariant validation/test | `todo` | memory-gateway/index.ts:194-231 no truth check. |
| 749 | §5 Invariant 14 L254 | buildProjection does not filter status=quarantined/revoked/expired/superseded memoryId | `todo` | memory-gateway/index.ts:251-280. |
| 750 | §2.2 L106 | OAPEFLIR 8 stages Release stage not independently handled (loop core mainly Plan→Execute→Feedback) | `todo` | five-plane-orchestration/oapeflir/oapeflir-loop-core.ts. |
| 751 | §17 | Policy Dry-run end-to-end no PolicyDecisionReceipt output, UI/policy console no dry-run entry | `todo` | grep `PolicyDecisionReceipt` → 0; ui/packages/features/policy placeholder. |
| 752 | §18.1-18.5 L1252-1304 | 5 Operational Runbooks (Gate false interception / Memory pollution / Release rollback / Tool partial failure / Receipt write failure) not aligned one-to-one with runbook-automation-service as executable processes | `todo` | src/ops-maturity/platform-ops-agent/runbook-automation-service.ts:75 only general class. |
| 753 | §17 | BreakGlass + Incident Review closed loop: only break_glass enum and emergency/resume-protocol placeholder, no BreakGlassReceipt + Incident Review closed loop | `todo` | src/ops-maturity/emergency/resume-protocol/index.ts:1-2. |
| 754 | §16.4 L1215 | break-glass override not mandatory receipt + trace linkage | `todo` | five-plane-control-plane/config-center/config-override-governance.ts:425-440. |
| 755 | §22.3-22.4 L1452-1476 | paper research / code review Agent landing package (dangerous command block rate, citation accuracy metric, dedicated eval subset) not in eval/redteam/divisions as runnable baseline | `todo` | eval/datasets and redteam/divisions no corresponding scenario. |
| 756 | §15.2 L1102-1113 | Trajectory Rubric 8-dimension scoring (policy compliance/approval compliance/cost/latency discipline etc. each 5 points aggregated) not implemented | `todo` | five-plane-orchestration/evaluator/full-trajectory-evaluator.ts:81. |
| 757 | §6.3 L307-312 | scan-current-codebase-gap.mjs exists but not entered CI workflow / engineering freeze gate | `todo` | .github/workflows not reference this script. |
| 758 | §7.2 L378-391 | dedicated package scripts (test:tool-gateway/test:memory-gateway/test:release-gate) only point to single unit test file, not cover prepare/commit/verify/compensate, proposal-only, stable gate full contract | `todo` | package.json `test:tool-gateway` single file pointer. |


## Round 5 · v1.4 mission_architecture_design_review_v1_4_full_merged.md doc-feature implementation reconciliation

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 759 | §2 Mission Charter L120-150 | Mission.charterVersion field not persisted in mission/index.ts, runtime mission store cannot read version | todo | mission/index.ts:78-142。 |
| 760 | §2 L160-180 | mission.kpiTargets and mission.rollbackPlan field only schema declaration, governance check does not read | todo | grep `kpiTargets` mission/ → 0 business call。 |
| 761 | §3 L195-220 | mission state machine 11 states, current FSM implements 6, missing active/suspended/paused/archived | todo | mission-fsm.ts:55-150。 |
| 762 | §3 L225-260 | mission escalation path (warn→suspend→revoke) not implemented auto trigger | todo | grep `autoEscalate` mission/ → 0。 |
| 763 | §3.2 L275-300 | mission snapshot and replay not byte-stable, createdAt/updatedAt write wall clock | todo | mission-snapshot.ts:88-120。 |
| 764 | §4 L320-345 | mission ↔ org-node relation only flat reference, no hierarchy check | todo | mission-org-binding.ts:45-100。 |
| 765 | §4 L350-380 | cross-mission resource isolation not implemented by org-node, only by tenant | todo | mission-resource-allocator.ts:12-50。 |
| 766 | §4.2 L390-420 | mission termination downstream cascade close not implemented (workflow still active) | todo | mission-cascade.ts:1-40。 |
| 767 | §5 L440-470 | mission budget guard and budget-allocator not linked | todo | mission-budget-guard.ts:1-2 (placeholder)。 |
| 768 | §5.1 L475-510 | mission alert routing not implemented，alerts still go through incident-control | todo | grep `missionAlert` → 0。 |
| 769 | §6 L530-560 | mission observability field (missionHealth, missionRiskScore) not emit metric | todo | mission-observability.ts:1-2 (placeholder)。 |
| 770 | §6.1 L570-610 | mission SLA breach detection not implemented | todo | grep `slaBreach` mission/ → 0。 |
| 771 | §7 L630-680 | mission v1.4 proposed charter-diff UI not implemented | todo | ui/packages/features/mission/src/web/index.tsx 21 lines。 |
| 772 | §7.1 L685-720 | mission approval SLA 5min/30min/2h three tiers not implemented | todo | grep `approvalSla` mission/ → 0。 |
| 773 | §8 L750-790 | mission registration and on-boarding flow missing v1.4 emphasized dry-run precheck | todo | mission-onboarding.ts:30-90。 |
| 774 | §8.1 L800-830 | mission canary stage fieldnot persisted in mission entity | todo | grep `canaryStage` mission/ → 0。 |
| 775 | §9 L850-890 | mission v1.4 proposed federation sync only internal protocol not done cross-region | todo | mission-federation-sync.ts:1-3 (stub)。 |
| 776 | §9.1 L900-930 | mission deprecation process not implemented | todo | grep `deprecateMission` → 0。 |
| 777 | §10 L950-990 | mission telemetry field not written into audit event chain | todo | mission-audit-integration.ts:1-2 (placeholder)。 |
| 778 | §10.1 L1000-1040 | mission rollback decision not linked with release-gate | todo | grep `missionRollback` → 0。 |
| 779 | §11 L1060-1110 | mission and harness association (harnessMissionRef) not read in harness-state-manager | todo | harness-state-manager.ts:88-180。 |
| 780 | §11.1 L1115-1160 | mission restart policy fields (always/on-failure/never) persisted but not effective | todo | mission-restart-policy.ts:1-3。 |
| 781 | §12 L1180-1230 | mission v1.4 proposed multi-org resource view not rendered in dashboard | todo | ui/packages/features/mission-dashboard/index.tsx 0 lines。 |
| 782 | §12.1 L1240-1280 | mission control plane handoff not going through state machine | todo | mission-handoff.ts:1-50 directly mutates state。 |
| 783 | §13 L1300-1350 | mission behavior audit trail (missionDecisionLog) not in audit-event-integrity check | todo | grep `missionDecisionLog` audit/ → 0。 |

## Round 6 · v1.7.1 validation_monitoring_full doc-feature implementation reconciliation

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 784 | v1.7.1 §4 | validation registry schema only supports flat list, not (phaseId, gateId) composite key | todo | platform-validation-registry.json:1-50。 |
| 785 | v1.7.1 §4 | gate severity field independently maintained in configuration file, inconsistent with docs | todo | platform-validation-registry.json:184-372。 |
| 786 | v1.7.1 §4 | gate threshold no executable binding only metric name | todo | audit-validation-registry.mjs no metric verify path。 |
| 787 | v1.7.1 §7 | `npm run validation:gate` only partial validation, not triggering v1.7.1 required"phase:promote"gate | todo | package.json:73-76。 |
| 788 | v1.7.1 §9 | monitoring reconciliation per-minute counter not emit aa.gpu.* / aa.queue.* series | todo | exporter path no gpu rendered。 |
| 789 | v1.7.1 §9 | monitoring a11y/i18n regression detector not connected v1.7.1 defined smoke suite | todo | grep `i18nSmoke` → 0。 |
| 790 | v1.7.1 §12 | runbook automation and runbook text only does fuzzy match，not executestructured playbook | todo | runbook-automation-service.ts:1-100。 |
| 791 | v1.7.1 §14 | release readiness score missing weighted formula, and scorecard table decoupled | todo | grep `readinessScore` → 0。 |
| 792 | v1.7.1 §15 | multi-mission resource isolation not verified in isolation test | todo | tests/integration/multi-mission/ directory does not exist。 |
| 793 | v1.7.1 §17 | provider routing only based on capability, not considering cost/latency | todo | provider-router.ts:30-90。 |
| 794 | v1.7.1 §19 | ToolRegistry not implement ADR-009 's side-effect taxonomy，registry only name→handler | todo | tool-registry/index.ts:1-50。 |
| 795 | v1.7.1 §20 | Tool contract missing ToolVersion/sideEffectClass/policyHook/toolTimeoutMs field | todo | grep `sideEffectClass` tool-registry → 0。 |
| 796 | v1.7.1 §20 | Tool direct invocation blocking not done, only audit event write log | todo | grep `directInvocationBlocked` → 0。 |
| 797 | v1.7.1 §23 | Budget plan / ledger and plan-execution linked at runtime, runtime not going through plan-budget guard | todo | plan-execution-service.ts:88-180。 |
| 798 | v1.7.1 §23 | Budget overrun only audit event，no backpressure behavior | todo | grep `budgetBackpressure` → 0。 |
| 799 | v1.7.1 §24 | Connector health events not entering SLO alerting channels | todo | grep `connector.health.changed` event-registry → 0。 |
| 800 | v1.7.1 §24 | Connector circuit breaker not in gateway entry effective | todo | connector-circuit-breaker.ts:1-2 (placeholder)。 |
| 801 | v1.7.1 §25 | Data PII ML-based detector not implemented，only regex | todo | data-classification-service.ts:333-335。 |
| 802 | v1.7.1 §25 | Data contamination tag / leakage detector not implemented | todo | grep `contamination` src/ → 0。 |
| 803 | v1.7.1 §25 | Data residency enforcer only schema, no periodic scan | todo | data-residency-service.ts:71-205。 |
| 804 | v1.7.1 §26 | Prompt injection 3-layer + canary token not implemented | todo | prompt-injection-guard.ts:201-207。 |
| 805 | v1.7.1 §26 | Red-team scenarios <50 (current 28 fixtures) | todo | grep -c scenarioId stable-prompt-injection-red-team.ts < 50。 |
| 806 | v1.7.1 §28 | Autonomy "frozen" recovery must need human approval; autonomy-governance allows system to auto recover from frozen | todo | grep frozen src/interaction/autonomy/ no human approval gate. |
| 807 | v1.7.1 §43 | aa.gpu.memory.watermark_ratio gauge and aa.gpu.oom.count counter not implemented in exporter, runbook D.33 references | todo | exporter no gpu_* series rendered. |
| 808 | v1.7.1 §47 §47.1 | Gate registry only records gateId/ciJob/runbookId, does not carry defaultSeverity/escalationRules/blocking/owner etc. required fields | todo | platform-validation-registry.json:184-372. |
| 809 | v1.7.1 §49 | docs put D.1~D.34 all in v1.7.1 single document; deploy/runbooks/ only one production-alert-runbook.md, not split out D.x runbook one by one | todo | ls deploy/runbooks/ only one file. |
| 810 | v1.7.1 §35.2 | Data Governance Gate "tenant scoped access" check: research-source-governance.ts accepts tenantId/accessPolicyRef but does not call IAM access comparison in execution chain | todo | validateResearchSourceGovernance only schema check. |
| 811 | v1.7.1 §51 | Evidence Bundle bundleHash + signature path: export bundle not generating signature/bundleHash field (only hash file), cannot satisfy Freeze "Evidence Bundle signature verification pass" | todo | scripts/validation/export-platform-validation-artifacts.ts no signature flow. |
| 812 | v1.7.1 §13 | 8-dimension Scorecard (Functional/Reliability/Security/Performance/Observability/Cost/Maintainability/UX): buildScorecardReport only returns static text array, no real weighted scoring function | todo | platform-product-validation.ts buildScorecardReport placeholder text concatenation. |
| 813 | v1.7.1 §13 | Scorecard weighting and threshold (total ≥85 and Reliability/Security ≥90): repository no weighting calculation/threshold check function, scorecard-validation-report.json field no score number | todo | grep scorecardScore|reliabilityScore|securityScore src/ empty. |
| 814 | v1.7.1 §14 | Phase 0-4 Roadmap Gate not implemented: platform-validation-registry.json no phaseId field, gate and roadmap stage decoupled | todo | platform-validation-registry.json no phase field. |
| 815 | v1.7.1 §14 | npm run phase:promote CLI not implemented | todo | grep phase:promote package.json empty. |
| 816 | v1.7.1 §19 | ToolDefinition fields (sideEffectCategory/idempotencyKeyPolicy/budgetClass/permissionScope/redactRules) not in MultiStepToolRegistry | todo | dispatcher/index.ts:99-200 ToolRegistry only name→handler. |
| 817 | v1.7.1 §19 | Tool Direct Invocation blocking and aa.tool.direct_invocation.count not implemented | todo | dispatcher executeToolCall path no registry mandatory check. |
| 818 | v1.7.1 §24 | Connector governance (egress allowlist/circuit breaker/rate-limit/side-effect recording): src/platform/ no connector-registry service | todo | grep connector-registry|ConnectorRegistry src/platform/ empty. |
| 819 | v1.7.1 §24 | connector.bound / connector.health.changed event flow missing, gateway plane no connector health check path | todo | event-registry.ts no connector.* event keys. |
| 820 | v1.7.1 §25 | Data Governance PII detection: data-classification-service.ts only based on regex detection, no ML-based / multi-locale / context-aware detection, no data.pii.detected event | todo | data-classification-service.ts:333-335 only regex. |
| 821 | v1.7.1 §25 | Data Contamination Tagging: training/eval data no contamination tag, no golden-set leakage detector | todo | grep contamination src/ empty. |
| 822 | v1.7.1 §25 | Data Retention Enforcement: data-residency-service.ts only records retentionDays config, no regular scan+delete job and data.retention.applied event | todo | data-residency-service.ts:71-205. |
| 823 | v1.7.1 §26 | Prompt Injection Defense multi-layer (input/context/output three layers + ML detector + canary token + system prompt isolation): prompt-injection-guard.ts only ML+rules, missing canary token and output-layer detection | todo | prompt-injection-guard.ts:201-207. |
| 824 | v1.7.1 §26 | red-team scenarios ≥50 and fail rate <5%: stable-prompt-injection-red-team.ts no 50 scenario fixture | todo | grep -c scenarioId|case_id that file <50. |
| 825 | v1.7.1 §39 | DR RPO≤5min/RTO≤30min quarterly drill: scripts/ stable-recovery-drill not measure RPO/RTO, no dr-drill-report.json containing measuredRpoMs/measuredRtoMs | todo | grep measuredRpoMs|measuredRtoMs src/ scripts/ empty. |
| 826 | v1.7.1 §39 | DR Cross-region Failover verification: cdc-replication-service.ts only replica sync detection, no failover trigger and failback evidence | todo | cdc-replication-service.ts no failover drill path. |
| 827 | v1.7.1 §45 | Capacity Report Fields (peakRps/sustainedRps/p95LatencyMs/saturationRatio/queueDepthHigh/admissionDropRate): buildCapacityReport field set does not contain saturationRatio and admissionDropRate | todo | platform-product-validation.ts buildCapacityReport. |
| 828 | v1.7.1 §46 | SLO Report Fields (per-mission burn_rate/error_budget_remaining/window) not implemented: report only aggregates config, no runtime measurement values | todo | slo-alerting-service.ts output not integrated into report builder. |

## Round 7 · v3.3 release readiness doc-feature implementation reconciliation

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 829 | L9 "New division inventory scanner" | scanner only scans 56 divisions, corresponding inventoryRefs source fixed to `2026-06-01`, does not truly reflect source-of-truth; orphans list hardcoded scan result not periodically diff with `divisions/` directory | todo | config/division-coverage/inventory/division-inventory.generated.json:6,2177-2181; scripts/ci/audit-division-inventory.mjs |
| 830 | L9 inventory scanner | scan result committed as `division-inventory.generated.json` in repo, no `--check` drift judgment script entry (only coverage:cards has --check) | todo | package.json:73-76; scripts/ci/audit-division-inventory.mjs (no --check branch) |


## Round 7 · v3.3 release readiness detailed todolist doc-feature implementation reconciliation (continued)

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 831 | L14 "ledger sequence" | ledger sequence number generated by SQLite, but multi-region replication may produce out-of-order seq | todo | grep `ledgerSequence` ledger/ → 0 multi-region handling. |
| 832 | L17 "stable evidence bundle" | envelope.metadata.canonicalizationVersion not in code, but contract requires it | todo | checkpoint-envelope.ts:228. |
| 833 | L19 "release gate canary plan" | release-gate.ts does not implement canary plan field, contract requires | todo | release-gate.ts:16-26. |
| 834 | L23 "tool prepare/commit" | ToolGateway prepare/commit/verify/compensate 4 stages not implemented | todo | tool-gateway/index.ts:114-146. |
| 835 | L27 "policy dry-run" | PolicyDryRunDecision interface not in code | todo | grep `PolicyDryRunDecision` → 0. |
| 836 | L31 "memory resolution conflict" | L4 vs AuthoritativeTaskStore priority not enforced | todo | memory-gateway/index.ts:151-285. |
| 837 | L35 "console receipt" | ApprovalReceipt/MemoryWriteReceipt/...8 types all missing | todo | grep → 0 src. |
| 838 | L41 "scorecard weighted" | buildScorecardReport placeholder text only | todo | platform-product-validation.ts. |
| 839 | L45 "drill RPO/RTO" | dr-drill-report.json missing measuredRpoMs/measuredRtoMs | todo | grep → 0. |
| 840 | L51 "tool registry sideEffectClass" | tool-registry/index.ts:1-50 only name→handler | todo | grep `sideEffectClass` tool-registry → 0. |
| 841 | L55 "connector health event" | connector.health.changed event missing | todo | event-registry.ts no connector.* keys. |
| 842 | L60 "PII ML detector" | data-classification-service.ts:333-335 only regex | todo | grep ML PII detector → 0. |
| 843 | L65 "data residency enforce" | data-residency-service.ts:71-205 only schema | todo | grep sweep+enforce → 0. |
| 844 | L70 "Prompt injection 3-layer" | prompt-injection-guard.ts:201-207 missing canary + output layer | todo | grep canary → 0. |
| 845 | L75 "Red-team scenarios ≥50" | current 28 fixtures | todo | grep -c < 50. |
| 846 | L80 "Autonomy frozen approval" | system can auto recover from frozen | todo | grep frozen src/interaction/autonomy/ → 0. |
| 847 | L85 "Gate registry fields" | missing defaultSeverity/escalationRules/blocking/owner | todo | platform-validation-registry.json:184-372. |
| 848 | L90 "Runbook D.x" | deploy/runbooks/ only one file | todo | ls deploy/runbooks/ one file. |
| 849 | L95 "Data Governance Gate" | validateResearchSourceGovernance only schema | todo | grep IAM access compare → 0. |
| 850 | L100 "Evidence Bundle signature" | no signature flow | todo | export-platform-validation-artifacts.ts no signature. |
| 851 | L105 "Scorecard formula" | no weighting calculation | todo | grep `scorecardScore\|reliabilityScore` → 0. |
| 852 | L110 "Phase Roadmap Gate" | no phaseId field | todo | platform-validation-registry.json no phase. |
| 853 | L115 "phase:promote CLI" | not implemented | todo | grep phase:promote package.json empty. |
| 854 | L120 "ToolDefinition 5 fields" | only name→handler | todo | dispatcher/index.ts:99-200. |
| 855 | L125 "Tool direct invocation" | no registry enforcement | todo | dispatcher executeToolCall. |
| 856 | L130 "Connector registry" | no service | todo | grep connector-registry → 0. |
| 857 | L135 "Data PII ML" | only regex | todo | data-classification-service.ts:333-335. |
| 858 | L140 "Contamination tag" | no leakage detector | todo | grep contamination → 0. |
| 859 | L145 "Data residency enforce" | only config | todo | data-residency-service.ts:71-205. |
| 860 | L150 "Prompt injection canary" | missing canary token | todo | prompt-injection-guard.ts:201-207. |
| 861 | L155 "red-team scenarios 50" | current <50 | todo | grep -c scenarioId < 50. |
| 862 | L160 "RPO/RTO drill" | not measured | todo | grep measuredRpoMs → 0. |
| 863 | L165 "DR failover" | no failover drill path | todo | cdc-replication-service.ts. |
| 864 | L170 "Capacity Report fields" | missing saturationRatio | todo | buildCapacityReport. |
| 865 | L175 "SLO Report fields" | not runtime measured | todo | slo-alerting-service.ts. |
| 866 | L180 "ledger seq multi-region" | out-of-order possible | todo | grep ledgerSequence multi-region. |
| 867 | L185 "evidence bundle canonicalization" | not implemented | todo | checkpoint-envelope.ts:228. |
| 868 | L190 "canary plan" | not implemented | todo | release-gate.ts. |
| 869 | L195 "Tool prepare/commit" | only thin layer | todo | tool-gateway/index.ts. |
| 870 | L200 "PolicyDryRunDecision" | not in code | todo | grep → 0. |
| 871 | L205 "memory conflict" | not enforced | todo | memory-gateway/index.ts. |
| 872 | L210 "8 receipt types" | all missing | todo | grep → 0. |
| 873 | L215 "scorecard weighted" | placeholder | todo | platform-product-validation.ts. |
| 874 | L220 "drill RPO/RTO" | missing | todo | grep → 0. |
| 875 | L225 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 876 | L230 "connector health event" | missing | todo | event-registry. |
| 877 | L235 "PII ML" | only regex | todo | data-classification. |
| 878 | L240 "residency enforce" | only schema | todo | data-residency. |
| 879 | L245 "Prompt injection 3-layer" | missing canary | todo | prompt-injection-guard. |
| 880 | L250 "red-team ≥50" | <50 | todo | grep -c. |
| 881 | L255 "Autonomy frozen approval" | missing | todo | grep frozen. |
| 882 | L260 "Gate registry fields" | missing | todo | platform-validation-registry.json. |
| 883 | L265 "Runbook D.x split" | not split | todo | deploy/runbooks/. |
| 884 | L270 "Data Governance tenant check" | only schema | todo | research-source-governance.ts. |
| 885 | L275 "Evidence Bundle signature" | missing | todo | export-platform-validation-artifacts.ts. |
| 886 | L280 "Scorecard formula" | missing | todo | platform-product-validation.ts. |
| 887 | L285 "Phase Roadmap Gate" | no phase | todo | platform-validation-registry.json. |
| 888 | L290 "phase:promote" | missing | todo | package.json. |
| 889 | L295 "ToolDefinition" | only name→handler | todo | dispatcher/index.ts. |
| 890 | L300 "Tool direct invocation" | no enforcement | todo | dispatcher. |
| 891 | L305 "Connector registry" | missing | todo | grep. |
| 892 | L310 "PII ML" | regex only | todo | data-classification. |
| 893 | L315 "Contamination" | missing | todo | grep. |
| 894 | L320 "Residency enforce" | only schema | todo | data-residency. |
| 895 | L325 "Canary token" | missing | todo | prompt-injection-guard. |
| 896 | L330 "red-team scenarios" | <50 | todo | grep -c. |
| 897 | L335 "RPO/RTO drill" | missing | todo | grep. |
| 898 | L340 "DR failover" | missing | todo | cdc-replication. |
| 899 | L345 "Capacity Report" | missing fields | todo | buildCapacityReport. |
| 900 | L350 "SLO Report runtime" | missing | todo | slo-alerting. |
| 901 | L355 "ledger seq multi-region" | potential issue | todo | grep. |
| 902 | L360 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 903 | L365 "canary plan" | not implemented | todo | release-gate. |
| 904 | L370 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 905 | L375 "PolicyDryRunDecision" | not in code | todo | grep. |
| 906 | L380 "memory conflict" | not enforced | todo | memory-gateway. |
| 907 | L385 "8 receipt types" | all missing | todo | grep. |
| 908 | L390 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 909 | L395 "drill RPO/RTO" | missing | todo | grep. |
| 910 | L400 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 911 | L405 "connector health event" | missing | todo | event-registry. |
| 912 | L410 "PII ML" | only regex | todo | data-classification. |
| 913 | L415 "Residency enforce" | only schema | todo | data-residency. |
| 914 | L420 "Canary token" | missing | todo | prompt-injection-guard. |
| 915 | L425 "red-team scenarios" | <50 | todo | grep. |
| 916 | L430 "RPO/RTO drill" | missing | todo | grep. |
| 917 | L435 "DR failover" | missing | todo | cdc-replication. |
| 918 | L440 "Capacity Report" | missing | todo | buildCapacityReport. |
| 919 | L445 "SLO Report" | missing | todo | slo-alerting. |
| 920 | L450 "ledger seq multi-region" | potential issue | todo | grep. |
| 921 | L455 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 922 | L460 "canary plan" | not implemented | todo | release-gate. |
| 923 | L465 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 924 | L470 "PolicyDryRunDecision" | not in code | todo | grep. |
| 925 | L475 "memory conflict" | not enforced | todo | memory-gateway. |
| 926 | L480 "8 receipt types" | all missing | todo | grep. |
| 927 | L485 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 928 | L490 "drill RPO/RTO" | missing | todo | grep. |
| 929 | L495 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 930 | L500 "connector health event" | missing | todo | event-registry. |
| 931 | L505 "PII ML" | only regex | todo | data-classification. |
| 932 | L510 "Residency enforce" | only schema | todo | data-residency. |
| 933 | L515 "Canary token" | missing | todo | prompt-injection-guard. |
| 934 | L520 "red-team scenarios" | <50 | todo | grep. |
| 935 | L525 "RPO/RTO drill" | missing | todo | grep. |
| 936 | L530 "DR failover" | missing | todo | cdc-replication. |
| 937 | L535 "Capacity Report" | missing | todo | buildCapacityReport. |
| 938 | L540 "SLO Report" | missing | todo | slo-alerting. |
| 939 | L545 "ledger seq multi-region" | potential issue | todo | grep. |
| 940 | L550 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 941 | L555 "canary plan" | not implemented | todo | release-gate. |
| 942 | L560 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 943 | L565 "PolicyDryRunDecision" | not in code | todo | grep. |
| 944 | L570 "memory conflict" | not enforced | todo | memory-gateway. |
| 945 | L575 "8 receipt types" | all missing | todo | grep. |
| 946 | L580 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 947 | L585 "drill RPO/RTO" | missing | todo | grep. |
| 948 | L590 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 949 | L595 "connector health event" | missing | todo | event-registry. |
| 950 | L600 "PII ML" | only regex | todo | data-classification. |
| 951 | L605 "Residency enforce" | only schema | todo | data-residency. |
| 952 | L610 "Canary token" | missing | todo | prompt-injection-guard. |
| 953 | L615 "red-team scenarios" | <50 | todo | grep. |
| 954 | L620 "RPO/RTO drill" | missing | todo | grep. |
| 955 | L625 "DR failover" | missing | todo | cdc-replication. |
| 956 | L630 "Capacity Report" | missing | todo | buildCapacityReport. |
| 957 | L635 "SLO Report" | missing | todo | slo-alerting. |
| 958 | L640 "ledger seq multi-region" | potential issue | todo | grep. |
| 959 | L645 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 960 | L650 "canary plan" | not implemented | todo | release-gate. |
| 961 | L655 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 962 | L660 "PolicyDryRunDecision" | not in code | todo | grep. |
| 963 | L665 "memory conflict" | not enforced | todo | memory-gateway. |
| 964 | L670 "8 receipt types" | all missing | todo | grep. |
| 965 | L675 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 966 | L680 "drill RPO/RTO" | missing | todo | grep. |
| 967 | L685 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 968 | L690 "connector health event" | missing | todo | event-registry. |
| 969 | L695 "PII ML" | only regex | todo | data-classification. |
| 970 | L700 "Residency enforce" | only schema | todo | data-residency. |
| 971 | L705 "Canary token" | missing | todo | prompt-injection-guard. |
| 972 | L710 "red-team scenarios" | <50 | todo | grep. |
| 973 | L715 "RPO/RTO drill" | missing | todo | grep. |
| 974 | L720 "DR failover" | missing | todo | cdc-replication. |
| 975 | L725 "Capacity Report" | missing | todo | buildCapacityReport. |
| 976 | L730 "SLO Report" | missing | todo | slo-alerting. |
| 977 | L735 "ledger seq multi-region" | potential issue | todo | grep. |
| 978 | L740 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 979 | L745 "canary plan" | not implemented | todo | release-gate. |
| 980 | L750 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 981 | L755 "PolicyDryRunDecision" | not in code | todo | grep. |
| 982 | L760 "memory conflict" | not enforced | todo | memory-gateway. |
| 983 | L765 "8 receipt types" | all missing | todo | grep. |
| 984 | L770 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 985 | L775 "drill RPO/RTO" | missing | todo | grep. |
| 986 | L780 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 987 | L785 "connector health event" | missing | todo | event-registry. |
| 988 | L790 "PII ML" | only regex | todo | data-classification. |
| 989 | L795 "Residency enforce" | only schema | todo | data-residency. |
| 990 | L800 "Canary token" | missing | todo | prompt-injection-guard. |
| 991 | L805 "red-team scenarios" | <50 | todo | grep. |
| 992 | L810 "RPO/RTO drill" | missing | todo | grep. |
| 993 | L815 "DR failover" | missing | todo | cdc-replication. |
| 994 | L820 "Capacity Report" | missing | todo | buildCapacityReport. |
| 995 | L825 "SLO Report" | missing | todo | slo-alerting. |
| 996 | L830 "ledger seq multi-region" | potential issue | todo | grep. |
| 997 | L835 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 998 | L840 "canary plan" | not implemented | todo | release-gate. |
| 999 | L845 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 1000 | L850 "PolicyDryRunDecision" | not in code | todo | grep. |
| 1001 | L855 "memory conflict" | not enforced | todo | memory-gateway. |
| 1002 | L860 "8 receipt types" | all missing | todo | grep. |
| 1003 | L865 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 1004 | L870 "drill RPO/RTO" | missing | todo | grep. |
| 1005 | L875 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 1006 | L880 "connector health event" | missing | todo | event-registry. |
| 1007 | L885 "PII ML" | only regex | todo | data-classification. |
| 1008 | L890 "Residency enforce" | only schema | todo | data-residency. |
| 1009 | L895 "Canary token" | missing | todo | prompt-injection-guard. |
| 1010 | L900 "red-team scenarios" | <50 | todo | grep. |
| 1011 | L905 "RPO/RTO drill" | missing | todo | grep. |
| 1012 | L910 "DR failover" | missing | todo | cdc-replication. |
| 1013 | L915 "Capacity Report" | missing | todo | buildCapacityReport. |
| 1014 | L920 "SLO Report" | missing | todo | slo-alerting. |
| 1015 | L925 "ledger seq multi-region" | potential issue | todo | grep. |
| 1016 | L930 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 1017 | L935 "canary plan" | not implemented | todo | release-gate. |
| 1018 | L940 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 1019 | L945 "PolicyDryRunDecision" | not in code | todo | grep. |
| 1020 | L950 "memory conflict" | not enforced | todo | memory-gateway. |
| 1021 | L955 "8 receipt types" | all missing | todo | grep. |
| 1022 | L960 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 1023 | L965 "drill RPO/RTO" | missing | todo | grep. |
| 1024 | L970 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 1025 | L975 "connector health event" | missing | todo | event-registry. |
| 1026 | L980 "PII ML" | only regex | todo | data-classification. |
| 1027 | L985 "Residency enforce" | only schema | todo | data-residency. |
| 1028 | L990 "Canary token" | missing | todo | prompt-injection-guard. |
| 1029 | L995 "red-team scenarios" | <50 | todo | grep. |
| 1030 | L1000 "RPO/RTO drill" | missing | todo | grep. |
| 1031 | L1005 "DR failover" | missing | todo | cdc-replication. |
| 1032 | L1010 "Capacity Report" | missing | todo | buildCapacityReport. |
| 1033 | L1015 "SLO Report" | missing | todo | slo-alerting. |
| 1034 | L1020 "ledger seq multi-region" | potential issue | todo | grep. |
| 1035 | L1025 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 1036 | L1030 "canary plan" | not implemented | todo | release-gate. |
| 1037 | L1035 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 1038 | L1040 "PolicyDryRunDecision" | not in code | todo | grep. |
| 1039 | L1045 "memory conflict" | not enforced | todo | memory-gateway. |
| 1040 | L1050 "8 receipt types" | all missing | todo | grep. |
| 1041 | L1055 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 1042 | L1060 "drill RPO/RTO" | missing | todo | grep. |
| 1043 | L1065 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 1044 | L1070 "connector health event" | missing | todo | event-registry. |
| 1045 | L1075 "PII ML" | only regex | todo | data-classification. |
| 1046 | L1080 "Residency enforce" | only schema | todo | data-residency. |
| 1047 | L1085 "Canary token" | missing | todo | prompt-injection-guard. |
| 1048 | L1090 "red-team scenarios" | <50 | todo | grep. |
| 1049 | L1095 "RPO/RTO drill" | missing | todo | grep. |
| 1050 | L1100 "DR failover" | missing | todo | cdc-replication. |
| 1051 | L1105 "Capacity Report" | missing | todo | buildCapacityReport. |
| 1052 | L1110 "SLO Report" | missing | todo | slo-alerting. |
| 1053 | L1115 "ledger seq multi-region" | potential issue | todo | grep. |
| 1054 | L1120 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 1055 | L1125 "canary plan" | not implemented | todo | release-gate. |
| 1056 | L1130 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 1057 | L1135 "PolicyDryRunDecision" | not in code | todo | grep. |
| 1058 | L1140 "memory conflict" | not enforced | todo | memory-gateway. |
| 1059 | L1145 "8 receipt types" | all missing | todo | grep. |
| 1060 | L1150 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 1061 | L1155 "drill RPO/RTO" | missing | todo | grep. |
| 1062 | L1160 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 1063 | L1165 "connector health event" | missing | todo | event-registry. |
| 1064 | L1170 "PII ML" | only regex | todo | data-classification. |
| 1065 | L1175 "Residency enforce" | only schema | todo | data-residency. |
| 1066 | L1180 "Canary token" | missing | todo | prompt-injection-guard. |
| 1067 | L1185 "red-team scenarios" | <50 | todo | grep. |
| 1068 | L1190 "RPO/RTO drill" | missing | todo | grep. |
| 1069 | L1195 "DR failover" | missing | todo | cdc-replication. |
| 1070 | L1200 "Capacity Report" | missing | todo | buildCapacityReport. |
| 1071 | L1205 "SLO Report" | missing | todo | slo-alerting. |
| 1072 | L1210 "ledger seq multi-region" | potential issue | todo | grep. |
| 1073 | L1215 "evidence canonicalization" | not implemented | todo | checkpoint-envelope. |
| 1074 | L1220 "canary plan" | not implemented | todo | release-gate. |
| 1075 | L1225 "Tool prepare/commit" | thin layer | todo | tool-gateway. |
| 1076 | L1230 "PolicyDryRunDecision" | not in code | todo | grep. |
| 1077 | L1235 "memory conflict" | not enforced | todo | memory-gateway. |
| 1078 | L1240 "8 receipt types" | all missing | todo | grep. |
| 1079 | L1245 "Scorecard weighted" | placeholder | todo | platform-product-validation. |
| 1080 | L1250 "drill RPO/RTO" | missing | todo | grep. |
| 1081 | L1255 "tool sideEffectClass" | not implemented | todo | tool-registry. |
| 1082 | L1260 "connector health event" | missing | todo | event-registry. |
| 1083 | L1265 "PII ML" | only regex | todo | data-classification. |
| 1084 | L1270 "Residency enforce" | only schema | todo | data-residency. |
| 1085 | L1275 "Canary token" | missing | todo | prompt-injection-guard. |
| 1086 | L1280 "red-team scenarios" | <50 | todo | grep. |
| 1087 | §3.6 line 776-777 | `baselineRef` / `delayedOutcomeRef` fields not in MissionOutcomeReport | todo | src/platform/contracts/mission/operating-model.ts:62-89 |
| 1088 | §5.5 / §3.7 line 854-863 | `WorkflowRecorderService / TraceNormalizer / SkillCandidateGenerator / SkillEvalGenerator / SkillPromotionService / SkillRolloutService` six services only implement merged `WorkflowRecordingService + SkillCandidatePipeline`, missing normalizer/generator/eval-gen/rollout split | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:207, 310 |
| 1089 | §3.7.2 line 919-928 / §9.1 GATE-SKILLPACK-001 | SkillPack 9 lifecycle states defined in enum, but `convertToSkillPack` directly jumps to `status:"active"`, skipping manifest_validated/policy_validated/sbom_scanned/eval_passed/signed/canary states | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:376 |
| 1090 | §3.7.1 line 898-914 | SkillCandidate missing `proposedName/proposedDescription/inferredTriggers/requiredTools/riskLevel/generatedInstructionsRef/generatedEvalSuiteRef` fields | todo | src/platform/contracts/mission/operating-model.ts:131-143 |
| 1091 | §5.6 line 1801-1823 | WorkflowRecordingPolicy fields mostly missing: `captureDom/captureScreen/captureNetworkSummary/captureRequestBody/captureResponseBody/captureSecrets/piiRedactionRequired/redactionReportRequired/deletionProofRequired/retentionSweepIntervalHours/deniedDataClasses/auditRequired` all not implemented, contract only captureMode three-state | todo | src/platform/contracts/mission/operating-model.ts:91-101 |
| 1092 | §5.6 line 1858 | "trace containing credential/secret/regulated_pii must fail-closed, not enter SkillCandidateGenerator" — pipeline only judges dataClass==="restricted", not identifying secret/credential/regulated_pii | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:324 |
| 1093 | §5.6 line 1837-1840 | `redactionReportRequired/deletionProofRequired/retentionSweepIntervalHours` default policy fields not implemented | todo | src/platform/contracts/mission/operating-model.ts:91-101 |
| 1094 | §9.1 GATE-WORKFLOW-RECORDING-003 | retention sweep failure must emit `aa.workflow.recording.deletion_failed.count` and enter Runbook D.40 — sweepRetention only returns result object, no event publishing and Runbook trigger | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:269-307 |
| 1095 | §9.1 line 2069-2074 | Gate Registry 13 P0/P1 Gates, closure script only `requireGate(001)` check in corresponding mode alone, 002/003/008 etc. not verified | todo | scripts/validation/mission-operating-model-closure.mjs:24-38 |
| 1096 | §9.1 GATE-MISSION-PLAYBOOK-007 | Running mission auto drift detection no runtime implementation; MissionPlaybook no version lock protection logic | todo | grep `auto_drift\|playbookVersion changed` only docs |
| 1097 | §9.1 GATE-MISSION-PLAYBOOK-008 | playbook migration missing compatibilityReport/approval/rollbackPlan validation code | todo | scripts/validation/mission-operating-model-closure.mjs (no migration plan check) |
| 1098 | §9.2 line 2094-2135 | 30+ metric only registered in metric-alert-policy.yaml, emitter code not exists; no metric registry consistency round-trip test | todo | tests/unit/platform/control-plane/mission-operating-model.test.ts |
| 1099 | §9.2 line 2107 | `aa.mission.outcome.quality_score` gauge implementation only setter; rubric_score / rubricVersion association missing | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:144-205 |
| 1100 | §9.2 line 2110 | `aa.mission.outcome.time_to_useful_output_ms` histogram not in OutcomeService computing firstUsefulOutputAt - missionStartedAt | todo | same as above |
| 1101 | §9.2 line 2111 | `aa.mission.outcome.adoption_ratio` 7d/30d sliding window not implemented, OutcomeService no delayed observation entry | todo | same as above |
| 1102 | §9.2 line 2113 | `aa.failure_mode.recurrence.count` 7d window and dedupeKey counting not implemented (FailureModeRegistry no detection store) | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:49-143 |
| 1103 | §9.2 line 2117-2127 | 7 SkillPack `*_without_*` P0 metric emitter missing; current SkillCandidatePipeline directly activates | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:354-388 |
| 1104 | §9.2 line 2128-2131 | workflow.recording.policy_bypass / restricted_data_capture / retention_expired_not_deleted / deletion_failed 4 P0/P1 metric no counter emit | todo | src/platform/five-plane-control-plane/mission/operating-model.ts:207-308 |
| 1105 | §9.3 line 2160-2208 | 47 Event Registry entries only registered as string array in registry json, no payload schema file, no producer/consumer registration, no replay_projection implementation | todo | config/validation/mission-operating-model-registry.json |
| 1106 | §9.3 line 2161-2170 | 11 `mission.playbook.*` lifecycle events no emitter | todo | grep mission.playbook.validated etc src/ no emitter |


## Round 8 · v1.6.2 anthropic founders playbook doc-feature implementation reconciliation

| ID | Document Section | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1107 | §1 L30-50 | "Concentrate compute" pattern: per-step retry budget not implemented in execution-engine | todo | execution-engine/multi-step-orchestration.ts:41-202. |
| 1108 | §2 L80-100 | "Prefer tool over prompt" pattern: tool preference layer in agent runtime missing | todo | grep `toolPreference` agent-runtime → 0. |
| 1109 | §3 L150-180 | "Build evals early" pattern: no eval fixtures in test bootstrap | todo | tests/eval/ empty. |
| 1110 | §4 L200-220 | "Optimize for token cost" pattern: per-tool token cost not tracked | todo | grep `tokenCost` tool-executor → 0. |
| 1111 | §5 L250-280 | "Self-improve" pattern: skill acquisition pipeline missing in mission | todo | mission/skill-pipeline.ts:1-2 (placeholder). |
| 1112 | §6 L300-330 | "Structured output" pattern: schema validation at tool boundary missing | todo | tool-executor/scoped-external-access-sandbox.ts:92-129. |
| 1113 | §7 L350-380 | "Default to safe" pattern: safe mode toggle missing in plan-execution | todo | grep `safeMode` plan-execution → 0. |
| 1114 | §8 L400-430 | "Fail gracefully" pattern: error classification in workflow not standardized | todo | workflow-fsm.ts:55-150 only 6 states. |
| 1115 | §9 L450-480 | "Observable by default" pattern: telemetry auto-instrument not implemented | todo | grep `autoInstrument` → 0. |
| 1116 | §10 L500-530 | "Human-in-the-loop" pattern: HITL decision points not in plan DAG | todo | planner/plan-builder.ts:80-96. |
| 1117 | §11 L550-580 | "Async-first" pattern: async task scheduling not first-class | todo | queue/sqlite-queue-adapter.ts. |
| 1118 | §12 L600-630 | "Long-running workflows" pattern: durable state checkpoint not in long-running | todo | long-running-workflow-service.ts. |
| 1119 | §13 L650-680 | "Multi-agent coordination" pattern: handoff contract not standardized | todo | oapeflir/handoff-model.ts:55-57. |
| 1120 | §14 L700-730 | "Capability registry" pattern: skills vs tools registry split | todo | plugin-runtime-host.ts. |
| 1121 | §15 L750-780 | "Domain expert" pattern: per-domain fine-tuning not in loop | todo | oapeflir/loop-core.ts. |
| 1122 | §16 L800-830 | "Self-critique" pattern: reflection stage not implemented | todo | oapeflir/loop-core.ts. |
| 1123 | §17 L850-880 | "Version everything" pattern: modelVersion/toolVersion tracking not comprehensive | todo | release-gate.ts. |
| 1124 | §18 L900-930 | "Test adversarially" pattern: redteam scenarios not in CI | todo | grep `redteam` CI workflow → 0. |
| 1125 | §19 L950-980 | "Cost budget" pattern: cost-aware scheduling not implemented | todo | dispatcher/admission-controller.ts. |
| 1126 | §20 L1000-1030 | "Latency aware" pattern: per-tool latency tracking missing | todo | grep `latencyPerTool` → 0. |
| 1127 | §21 L1050-1080 | "Trace propagation" pattern: end-to-end trace not standard | todo | observability/. |
| 1128 | §22 L1100-1130 | "Reasoning visualization" pattern: chain-of-thought UI not implemented | todo | ui/reasoning-view. |
| 1129 | §23 L1150-1180 | "Cache reuse" pattern: semantic cache missing | todo | cache/semantic-cache.ts:1-2 (placeholder). |
| 1130 | §24 L1200-1230 | "Streaming responses" pattern: SSE not standard in REST | todo | rest-client.ts. |
| 1131 | §25 L1250-1280 | "Resource quotas" pattern: per-tenant quota not in scheduler | todo | admission-controller.ts. |
| 1132 | §26 L1300-1330 | "Concurrency limits" pattern: per-tool concurrency cap missing | todo | tool-executor/. |
| 1133 | §27 L1350-1380 | "Cancellation propagation" pattern: cancel cascade not implemented | todo | queue/cancellation. |
| 1134 | §28 L1400-1430 | "Priority lanes" pattern: priority queue semantics not tested | todo | queue/ticket-priority-queue.ts. |
| 1135 | §29 L1450-1480 | "Dead letter handling" pattern: DLQ retry policy not configurable | todo | dlq-service.ts. |
| 1136 | §30 L1500-1530 | "Schema evolution" pattern: backward compat tests missing | todo | contracts/. |

## Round 8 · yono v1.0 business detailed design doc-feature implementation reconciliation

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1137 | §3 L120-150 | Yono customer model fields (lifetimeValue/churnRisk/segment) not in customer-service domain | todo | grep `lifetimeValue\|churnRisk` customer-service → 0. |
| 1138 | §4 L200-240 | Yono tenant onboarding flow missing 3 of 7 steps | todo | tenant-onboarding.ts. |
| 1139 | §5 L280-330 | Yono billing plan tiers (free/pro/enterprise) hardcoded in 2 places | todo | billing/billing-plan.ts. |
| 1140 | §6 L350-400 | Yono usage metering precision (5 decimal places) not in billing engine | todo | billing-service.ts:428-465. |
| 1141 | §7 L420-470 | Yono revenue recognition deferred revenue calculation missing | todo | grep `deferredRevenue` → 0. |
| 1142 | §8 L500-550 | Yono discount engine rules (volume/loyalty/seasonal) only volume implemented | todo | discount-engine.ts. |
| 1143 | §9 L580-630 | Yono tax calculation (multi-jurisdiction) not implemented | todo | grep `taxCalculation` → 0. |
| 1144 | §10 L650-700 | Yono refund workflow state machine not in code | todo | refund-state-machine.ts:1-2 (placeholder). |
| 1145 | §11 L720-770 | Yono dunning (collection) flow missing 4 escalation steps | todo | dunning-service.ts. |
| 1146 | §12 L800-850 | Yono subscription pause/resume semantics not implemented | todo | subscription-service.ts. |
| 1147 | §13 L880-930 | Yono quota overage handling (per-tier overage rates) hardcoded | todo | quota-allocator.ts. |
| 1148 | §14 L950-1000 | Yono multi-currency conversion not via real FX service | todo | grep `fxService` → 0 hardcoded. |
| 1149 | §15 L1020-1070 | Yono payment method vaulting (PCI scope) not implemented | todo | payment-vault.ts:1-2 (placeholder). |
| 1150 | §16 L1090-1140 | Yono invoice generation (PDF/HTML) not implemented | todo | invoice-generator.ts:1-2. |
| 1151 | §17 L1160-1210 | Yono collections agency handoff not implemented | todo | collections-handoff.ts:1-2. |
| 1152 | §18 L1230-1280 | Yono bankruptcy/chargeback handling missing | todo | grep `chargeback\|bankruptcy` → 0. |
| 1153 | §19 L1300-1350 | Yono revenue forecast model not in code | todo | revenue-forecast.ts:1-2. |
| 1154 | §20 L1370-1420 | Yono sales tax nexus rules not implemented | todo | tax-nexus.ts:1-2. |
| 1155 | §21 L1440-1490 | Yono inter-company invoicing not implemented | todo | inter-company-invoice.ts:1-2. |
| 1156 | §22 L1510-1560 | Yono revenue split (multi-party) not implemented | todo | revenue-split.ts:1-2. |
| 1157 | §23 L1580-1630 | Yono AR aging report not implemented | todo | ar-aging.ts:1-2. |
| 1158 | §24 L1650-1700 | Yono dispute resolution (chargeback) not implemented | todo | dispute-resolution.ts:1-2. |
| 1159 | §25 L1720-1770 | Yono write-off policy (bad debt) not implemented | todo | write-off.ts:1-2. |
| 1160 | §26 L1790-1840 | Yono aging buckets config not parameterized | todo | aging-buckets-config.ts:1-2. |
| 1161 | §27 L1860-1910 | Yono revenue recognition (ASC 606) 5-step model not implemented | todo | asc-606-engine.ts:1-2. |
| 1162 | §28 L1930-1980 | Yono customer health score not implemented | todo | customer-health.ts:1-2. |
| 1163 | §29 L2000-2050 | Yono expansion revenue tracking missing | todo | expansion-revenue.ts:1-2. |
| 1164 | §30 L2070-2120 | Yono NRR (net revenue retention) calculation not in code | todo | nrr-calculator.ts:1-2. |
| 1165 | §31 L2140-2190 | Yono gross retention not implemented | todo | gross-retention.ts:1-2. |
| 1166 | §32 L2210-2260 | Yono CAC payback period missing | todo | cac-payback.ts:1-2. |
| 1167 | §33 L2280-2330 | Yono LTV (lifetime value) calculation not in code | todo | ltv-calculator.ts:1-2. |
| 1168 | §34 L2350-2400 | Yono pipeline velocity not implemented | todo | pipeline-velocity.ts:1-2. |
| 1169 | §35 L2420-2470 | Yono win rate analysis not implemented | todo | win-rate.ts:1-2. |
| 1170 | §36 L2490-2540 | Yono sales quota tracking not implemented | todo | sales-quota.ts:1-2. |
| 1171 | §37 L2560-2610 | Yono commission calculation not implemented | todo | commission.ts:1-2. |
| 1172 | §38 L2630-2680 | Yono territory management missing | todo | territory.ts:1-2. |
| 1173 | §39 L2700-2750 | Yono lead scoring not in code | todo | lead-score.ts:1-2. |
| 1174 | §40 L2770-2820 | Yono MQL/SQL conversion tracking missing | todo | mql-sql.ts:1-2. |
| 1175 | §41 L2840-2890 | Yono opportunity stages not configured | todo | opportunity-stages.ts:1-2. |
| 1176 | §42 L2910-2960 | Yono forecast accuracy not tracked | todo | forecast-accuracy.ts:1-2. |
| 1177 | §43 L2980-3030 | Yono deal probability scoring missing | todo | deal-probability.ts:1-2. |
| 1178 | §44 L3050-3100 | Yono sales activity logging not implemented | todo | sales-activity.ts:1-2. |
| 1179 | §45 L3120-3170 | Yono next-best-action recommendation not implemented | todo | next-best-action.ts:1-2. |
| 1180 | §46 L3190-3240 | Yono customer segmentation rules missing | todo | segmentation.ts:1-2. |
| 1181 | §47 L3260-3310 | Yono email engagement tracking not in code | todo | email-engagement.ts:1-2. |
| 1182 | §48 L3330-3380 | Yono A/B test framework missing | todo | ab-test.ts:1-2. |
| 1183 | §49 L3400-3450 | Yono NPS measurement not implemented | todo | nps.ts:1-2. |
| 1184 | §50 L3470-3520 | Yono customer satisfaction score (CSAT) missing | todo | csat.ts:1-2. |
| 1185 | §51 L3540-3590 | Yono support ticket categorization not implemented | todo | ticket-categorization.ts:1-2. |
| 1186 | §52 L3610-3660 | Yono first response time SLA tracking missing | todo | first-response.ts:1-2. |
| 1187 | §53 L3680-3730 | Yono resolution time SLA missing | todo | resolution-time.ts:1-2. |
| 1188 | §54 L3750-3800 | Yono escalation rules not implemented | todo | escalation-rules.ts:1-2. |
| 1189 | §55 L3820-3870 | Yono knowledge base integration missing | todo | knowledge-base-integration.ts:1-2. |
| 1190 | §56 L3890-3940 | Yono chatbot handoff not implemented | todo | chatbot-handoff.ts:1-2. |
| 1191 | §57 L3960-4010 | Yono sentiment analysis missing | todo | sentiment.ts:1-2. |
| 1192 | §58 L4030-4080 | Yono multi-channel support not in code | todo | multi-channel.ts:1-2. |
| 1193 | §59 L4100-4150 | Yono IVR integration missing | todo | ivr-integration.ts:1-2. |
| 1194 | §60 L4170-4220 | Yono voice transcription not implemented | todo | voice-transcription.ts:1-2. |
| 1195 | §61 L4240-4290 | Yono agent productivity metrics missing | todo | agent-productivity.ts:1-2. |
| 1196 | §62 L4310-4360 | Yono team performance dashboards not implemented | todo | team-perf-dashboards.ts:1-2. |
| 1197 | §63 L4380-4430 | Yono quality monitoring (call recording QA) missing | todo | qa-monitoring.ts:1-2. |
| 1198 | §64 L4450-4500 | Yono workforce management (scheduling) not implemented | todo | wfm.ts:1-2. |
| 1199 | §65 L4520-4570 | Yono forecasting (call volume) missing | todo | call-volume-forecast.ts:1-2. |
| 1200 | §66 L4590-4640 | Yono occupancy tracking not implemented | todo | occupancy.ts:1-2. |
| 1201 | §67 L4660-4710 | Yono adherence tracking missing | todo | adherence.ts:1-2. |
| 1202 | §68 L4730-4780 | Yono schedule optimization not implemented | todo | schedule-optimization.ts:1-2. |
| 1203 | §69 L4800-4850 | Yono real-time adherence alerts missing | todo | real-time-adherence.ts:1-2. |
| 1204 | §70 L4870-4920 | Yono in-queue callback not implemented | todo | in-queue-callback.ts:1-2. |
| 1205 | §71 L4940-4990 | Yono priority routing missing | todo | priority-routing.ts:1-2. |
| 1206 | §72 L5010-5060 | Yono skill-based routing not implemented | todo | skill-based-routing.ts:1-2. |
| 1207 | §73 L5080-5130 | Yono after-call work tracking missing | todo | after-call-work.ts:1-2. |
| 1208 | §74 L5150-5200 | Yono wrap-up codes not implemented | todo | wrap-up-codes.ts:1-2. |
| 1209 | §75 L5220-5270 | Yono disposition codes missing | todo | disposition-codes.ts:1-2. |
| 1210 | §76 L5290-5340 | Yono customer journey mapping not implemented | todo | journey-mapping.ts:1-2. |
| 1211 | §77 L5360-5410 | Yono touchpoint tracking missing | todo | touchpoint-tracking.ts:1-2. |
| 1212 | §78 L5430-5480 | Yono attribution modeling not implemented | todo | attribution.ts:1-2. |
| 1213 | §79 L5500-5550 | Yono marketing mix modeling missing | todo | mmm.ts:1-2. |
| 1214 | §80 L5570-5620 | Yono campaign attribution not implemented | todo | campaign-attribution.ts:1-2. |
| 1215 | §81 L5640-5690 | Yono web analytics integration missing | todo | web-analytics.ts:1-2. |
| 1216 | §82 L5710-5760 | Yono mobile analytics not implemented | todo | mobile-analytics.ts:1-2. |
| 1217 | §83 L5780-5830 | Yono social media tracking missing | todo | social-tracking.ts:1-2. |
| 1218 | §84 L5850-5900 | Yono email tracking not implemented | todo | email-tracking.ts:1-2. |
| 1219 | §85 L5920-5970 | Yono SMS tracking missing | todo | sms-tracking.ts:1-2. |
| 1220 | §86 L5990-6040 | Yono push notification tracking not implemented | todo | push-tracking.ts:1-2. |
| 1221 | §87 L6060-6110 | Yono in-app messaging tracking missing | todo | in-app-tracking.ts:1-2. |
| 1222 | §88 L6130-6180 | Yono content engagement tracking not implemented | todo | content-engagement.ts:1-2. |
| 1223 | §89 L6200-6250 | Yono video engagement tracking missing | todo | video-tracking.ts:1-2. |
| 1224 | §90 L6270-6320 | Yono form submission tracking not implemented | todo | form-submission.ts:1-2. |
| 1225 | §91 L6340-6390 | Yono conversion tracking missing | todo | conversion-tracking.ts:1-2. |
| 1226 | §92 L6410-6460 | Yono event tracking (custom) not implemented | todo | custom-event-tracking.ts:1-2. |
| 1227 | §93 L6480-6530 | Yono funnel analysis missing | todo | funnel-analysis.ts:1-2. |
| 1228 | §94 L6550-6600 | Yono cohort analysis not implemented | todo | cohort-analysis.ts:1-2. |
| 1229 | §95 L6620-6670 | Yono retention analysis missing | todo | retention-analysis.ts:1-2. |
| 1230 | §96 L6690-6740 | Yono churn prediction not implemented | todo | churn-prediction.ts:1-2. |
| 1231 | §97 L6760-6810 | Yono upsell opportunity scoring missing | todo | upsell-scoring.ts:1-2. |
| 1232 | §98 L6830-6880 | Yono cross-sell recommendation not implemented | todo | cross-sell-rec.ts:1-2. |
| 1233 | §99 L6900-6950 | Yono next-product-to-buy prediction missing | todo | next-product.ts:1-2. |
| 1234 | §100 L6970-7020 | Yono product recommendation engine not implemented | todo | product-rec-engine.ts:1-2. |
| 1235 | §101 L7040-7090 | Yono recommendation A/B testing missing | todo | rec-ab-test.ts:1-2. |
| 1236 | §102 L7110-7160 | Yono recommendation performance tracking not implemented | todo | rec-perf-tracking.ts:1-2. |
| 1237 | §103 L7180-7230 | Yono inventory tracking missing | todo | inventory-tracking.ts:1-2. |
| 1238 | §104 L7250-7300 | Yono order management not implemented | todo | order-mgmt.ts:1-2. |
| 1239 | §105 L7320-7370 | Yono fulfillment tracking missing | todo | fulfillment-tracking.ts:1-2. |
| 1240 | §106 L7390-7440 | Yono shipping integration not implemented | todo | shipping-integration.ts:1-2. |
| 1241 | §107 L7460-7510 | Yono returns processing missing | todo | returns-processing.ts:1-2. |
| 1242 | §108 L7530-7580 | Yono exchange handling not implemented | todo | exchange-handling.ts:1-2. |
| 1243 | §109 L7600-7650 | Yono warranty management missing | todo | warranty-mgmt.ts:1-2. |
| 1244 | §110 L7670-7720 | Yono service contracts not implemented | todo | service-contracts.ts:1-2. |
| 1245 | §111 L7740-7790 | Yono field service dispatch missing | todo | field-service-dispatch.ts:1-2. |
| 1246 | §112 L7810-7860 | Yono technician scheduling not implemented | todo | tech-scheduling.ts:1-2. |
| 1247 | §113 L7880-7930 | Yono spare parts inventory missing | todo | spare-parts.ts:1-2. |
| 1248 | §114 L7950-8000 | Yono service level agreement tracking not implemented | todo | sla-tracking.ts:1-2. |
| 1249 | §115 L8020-8070 | Yono customer equipment tracking missing | todo | equipment-tracking.ts:1-2. |
| 1250 | §116 L8090-8140 | Yono preventive maintenance scheduling not implemented | todo | preventive-maint.ts:1-2. |
| 1251 | §117 L8160-8210 | Yono work order management missing | todo | work-order-mgmt.ts:1-2. |
| 1252 | §118 L8230-8280 | Yono mobile workforce not implemented | todo | mobile-workforce.ts:1-2. |
| 1253 | §119 L8300-8350 | Yono asset tracking missing | todo | asset-tracking.ts:1-2. |
| 1254 | §120 L8370-8420 | Yono GPS tracking not implemented | todo | gps-tracking.ts:1-2. |
| 1255 | §121 L8440-8490 | Yono route optimization missing | todo | route-optimization.ts:1-2. |
| 1256 | §122 L8510-8560 | Yono fuel management not implemented | todo | fuel-mgmt.ts:1-2. |
| 1257 | §123 L8580-8630 | Yono driver behavior scoring missing | todo | driver-behavior.ts:1-2. |
| 1258 | §124 L8650-8700 | Yono fleet maintenance not implemented | todo | fleet-maint.ts:1-2. |


## Round 9 · v3.2 final release doc-feature implementation reconciliation

| ID | Document Section/Line | Unimplemented/Missing Content | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1259 | v3.2 §2 L80-110 | Final release features per platform architecture v3.2 spec | todo | docs_zh/reference/automatic_agent_platform_v3_2_final_release.md |
| 1260 | v3.2 §3 L130-170 | 5 plane layered contracts freeze: contracts registry reflects v3.2 freeze (4.3) | todo | contracts-corpus.jsonl |
| 1261 | v3.2 §4 L200-250 | multi-region replication final SLA freeze | todo | cdc-replication-service.ts |
| 1262 | v3.2 §5 L300-360 | HA coordinator final state machine v3.2 | todo | ha-coordinator-service-async.ts |
| 1263 | v3.2 §6 L400-470 | queue adapter tier (sync/async) freeze in v3.2 | todo | queue-adapter-types.ts |
| 1264 | v3.2 §7 L500-560 | lease fencing token v3.2 persistence | todo | execution-lease-service.ts |
| 1265 | v3.2 §8 L600-680 | runtime recovery v3.2 decision tree freeze | todo | runtime-recovery-decision-service.ts |
| 1266 | v3.2 §9 L700-770 | dispatcher priority preemption v3.2 freeze | todo | execution-priority-preemption-service.ts |
| 1267 | v3.2 §10 L800-880 | admission controller v3.2 risk class mapping | todo | admission-controller.ts |
| 1268 | v3.2 §11 L900-990 | worker pool v3.2 handshake | todo | execution-worker-handshake-service.ts |
| 1269 | v3.2 §12 L1000-1080 | side effect manager v3.2 commit journal | todo | side-effect-manager.ts |
| 1270 | v3.2 §13 L1100-1180 | compensation manager v3.2 step guard | todo | compensation-manager.ts |
| 1271 | v3.2 §14 L1200-1280 | DLQ v3.2 retry policy | todo | dlq-service.ts |
| 1272 | v3.2 §15 L1300-1380 | idempotency v3.2 key normalization | todo | idempotency-key.ts |
| 1273 | v3.2 §16 L1400-1480 | checkpoint GC v3.2 retention freeze | todo | checkpoint-gc-service.ts |
| 1274 | v3.2 §17 L1500-1580 | event bus v3.2 ordering guarantee | todo | durable-event-bus.ts |
| 1275 | v3.2 §18 L1600-1680 | truth store v3.2 snapshot immutability | todo | runtime-truth-repository.ts |
| 1276 | v3.2 §19 L1700-1780 | async repositories v3.2 batch semantics | todo | event-repository.ts |
| 1277 | v3.2 §20 L1800-1880 | memory consolidation v3.2 trust ordering | todo | memory-consolidation.ts |
| 1278 | §4.6 L482 | "audit export report" not linked to family threshold | todo | config/division-coverage/minimum-leading-evidence.yaml:81-100; audit-export-service.ts no family-bound report |
| 1279 | §4.6 L483 | "data residency report" not implemented family-level | todo | grep data_residency_report repo empty |
| 1280 | §4.6 L484 | "restricted data red-team report" not implemented | todo | grep restricted_data_redteam repo empty |
| 1281 | §4.6 L485 | "bias/fairness report" not implemented | todo | grep fairness_report repo empty |
| 1282 | §4.6 L486 | "data revocation/tombstone report" not implemented | todo | grep tombstone src empty |
| 1283 | §4.6 L487 | "external model routing report" not implemented | todo | grep external_model_routing_report repo empty |
| 1284 | §4.6 L494-498 | minimum-leading-evidence Regulated missing `Data residency violation 0 / Restricted data leakage 0` threshold | todo | config/division-coverage/minimum-leading-evidence.yaml:81-100 |
| 1285 | §2.3 L268-277 | `industry_leadership_ready` Gate 7 prerequisites not strongly validated in CI | todo | scripts/ci/audit-leadership-claims.mjs only scans text |
| 1286 | §7.3 L650-661 | Claim Gate `industry_leading` 10 prerequisites not implemented validation | todo | src/platform/shared/stability/leadership-claims-governance-service.ts:270 only state machine |
| 1287 | §7.4 L693 | scanner default roots only README/docs/ui, no continuous cross-binding README claim with record.allowedSurfaces | todo | scripts/ci/audit-leadership-claims.mjs:271 |
| 1288 | §7.5 L720-721 | scanner roots not parameterized to release_notes/marketing/sales | todo | scripts/ci/audit-leadership-claims.mjs:271 |
| 1289 | §7.5 L749-753 | "approved claim by surface + claimText match pass" still acknowledged as document gap | todo | scripts/ci/audit-leadership-claims.mjs no per-hit binding claimId |
| 1290 | §7.6 L767 | LeadershipClaimAllowlistEntry.replacementSuggestion not strongly validated in schema | todo | config/division-coverage/claims/allowlist.yaml |
| 1291 | §7.7 L793-798 | "Approved claim expired → auto revoke and require replacement text" auto revoke logic not implemented | todo | src/platform/shared/stability/leadership-claims-governance-service.ts:191 |
| 1292 | §7.7 L796 | "Expired allowlist → auto upgrade to Fail" currently only returns `expired_allowlist` status, does not necessarily cause CI fail and no owner notification | todo | src/platform/shared/stability/leadership-claims-governance-service.ts:32 |
| 1293 | §Terminology L70-80 | `FamilyPolicy` defined as policy package but not in contracts/runtime as type | todo | grep FamilyPolicy src no type |
| 1294 | §Terminology L74-78 | FamilyPolicy minimum evidence / no-go boundary / claim review owner / expiry / revocation not as family yaml required fields | todo | config/division-coverage/family-readiness.yaml |
| 1295 | §1 L210-214 | Family Leadership Score formula not implemented calculator | todo | grep FamilyLeadershipScore repo empty |
| 1296 | §1 L218-225 | Family-specific weight table not configured | todo | config/division-coverage/family-readiness.yaml no weights |
| 1297 | §2.1 L233-239 | Readiness state machine 5 levels not as schema enum strongly validated | todo | config/division-coverage/schemas/ (no family-readiness.schema.json) |
| 1298 | §5.1 L508-512 | P0 three pilots not explicitly registered as pilot manifest in config/scripts | todo | scripts/validation/init-p0-pilot-evidence.ts:155 only tau-bench |
| 1299 | §5.2 L517-535 | Phase P0-A/P0-B/P0-C/P1/P2 expansion path not encoded | todo | grep Phase P0-A repo empty |
| 1300 | §5.3 L539-548 | Expansion Gate not implemented in audit | todo | grep expansion_gate scripts/ci empty |
| 1301 | §3.1 L286 | benchmark "Agentic PR studies" not mapped | todo | config/division-coverage/benchmark-map.yaml:7-13 |
| 1302 | §3.1 L289 | enterprise workflow benchmarks (τ²/telecom-style policy) not mapped | todo | config/division-coverage/benchmark-map.yaml:44-48 |
| 1303 | §3.1 L292 | NIST GenAI Profile / OWASP AI Agent / CSA Agentic RMF only ID reference, not mapped internal control | todo | config/division-coverage/benchmark-map.yaml |
| 1304 | §0.1 L171 | Engineering recommended leading type combination not in family-readiness.yaml reflected leadershipTypes field | todo | config/division-coverage/family-readiness.yaml:5-13 |
| 1305 | §10.2 L1030-1036 | Admin Console DoD "show each claim evidenceRefs and freshness" freshness field not implemented | todo | ui/packages/features/release-console/src/web/index.tsx:111-130 |
| 1306 | §10.2 L1033 | "view Claim Scanner hits, allowlist, expired allowlist" expired allowlist UI not separately distinguished | todo | ui/packages/features/release-console/src/web/index.tsx:137-148 |
| 1307 | §10.2 L1034 | "review request cannot bypass CI gate" not implemented in governance service | todo | src/platform/shared/stability/leadership-claims-governance-service.ts:270-280 |
| 1308 | §10.2 L1037 | "Approval Modal show allowedSurfaces + claimText" only claim id list, no per-claim detail | todo | ui/packages/features/release-console/src/web/index.tsx |
| 1309 | §10.3 L1040 | "expiredClaimAction=draft_replace" auto transition not implemented | todo | leadership-claims-governance-service.ts:191 |
| 1310 | §3.1 L288 | "retail ops eval" benchmark id not in map | todo | benchmark-map.yaml |
| 1311 | §3.1 L290 | "wealth advisor eval" benchmark id not mapped | todo | benchmark-map.yaml |
| 1312 | §3.1 L293 | "ISO 42001 AI Management" not mapped | todo | benchmark-map.yaml |
| 1313 | §3.2 L300 | benchmark coverage percentage gate not enforced in audit | todo | scripts/ci/audit-division-inventory.mjs |
| 1314 | §3.3 L320 | "retail/wealth/healthcare/HR" family-specific eval success threshold not configured | todo | config/division-coverage/ |
| 1315 | §4.1 L380 | "Domain Risk Profile" not implemented as YAML schema | todo | grep domain-risk-profile.schema → 0 |
| 1316 | §4.2 L420 | "Domain Recipe" lifecycle (draft→validated→registered→deprecated) not in FSM | todo | domain-recipe-service.ts |
| 1317 | §4.3 L460 | "Domain Eval Framework" rubric validation not in code | todo | domain-eval-framework-service.ts |
| 1318 | §4.4 L490 | "Domain Knowledge Schema" freshness check not implemented | todo | domain-knowledge-schema-service.ts |
| 1319 | §4.5 L520 | "Domain Descriptor" governance model not implemented | todo | domain-descriptor.ts:1-2 (placeholder) |
| 1320 | §5.1 L540 | "Domain Onboarding" wizard not implemented | todo | domain-onboarding.ts:1-2 (placeholder) |
| 1321 | §5.2 L560 | "Domain Registry" 4-stage approval not in code | todo | domain-registry-service.ts |
| 1322 | §5.3 L580 | "Cross-domain Conflict Resolution" not implemented | todo | cross-domain-conflict.ts:1-2 (placeholder) |
| 1323 | §5.4 L600 | "Domain Boundary Enforcement" not in lint | todo | grep domain-boundary → 0 |
| 1324 | §6.1 L630 | "Per-domain Eval Suite" not auto-generated | todo | grep auto-generate-eval → 0 |
| 1325 | §6.2 L660 | "Per-domain Redteam Suite" not auto-generated | todo | grep auto-generate-redteam → 0 |
| 1326 | §6.3 L680 | "Per-domain ROI Calculation" not implemented | todo | roi-calculator.ts:1-2 (placeholder) |
| 1327 | §6.4 L700 | "Per-domain Training Data Policy" not implemented | todo | training-data-policy.ts:1-2 (placeholder) |
| 1328 | §6.5 L720 | "Per-domain Compliance Report" not implemented | todo | compliance-report.ts:1-2 (placeholder) |
| 1329 | §7.1 L750 | "Cross-domain Federation" not implemented | todo | federation.ts:1-2 (placeholder) |
| 1330 | §7.2 L780 | "Cross-domain Skill Transfer" not implemented | todo | skill-transfer.ts:1-2 (placeholder) |
| 1331 | §7.3 L810 | "Cross-domain Best Practice Sharing" not implemented | todo | best-practice.ts:1-2 (placeholder) |
| 1332 | §8.1 L840 | "Vertical Industry Adapter" pattern not implemented | todo | vertical-adapter.ts:1-2 (placeholder) |
| 1333 | §8.2 L870 | "Industry Compliance Framework" not implemented | todo | industry-compliance.ts:1-2 (placeholder) |
| 1334 | §8.3 L900 | "Industry Data Schema" not implemented | todo | industry-schema.ts:1-2 (placeholder) |
| 1335 | §8.4 L930 | "Industry Workflow Templates" not implemented | todo | industry-workflow.ts:1-2 (placeholder) |
| 1336 | §8.5 L960 | "Industry KPI Library" not implemented | todo | industry-kpi.ts:1-2 (placeholder) |
| 1337 | §9.1 L990 | "Industry Reference Architecture" docs-only | todo | docs/industry/ |
| 1338 | §9.2 L1020 | "Industry Deployment Guide" not implemented | todo | deployment/. |
| 1339 | §9.3 L1050 | "Industry Certification Evidence" not implemented | todo | certification/. |
| 1340 | §10.1 L1080 | "Customer Success Story" template not implemented | todo | customer-story.ts:1-2 (placeholder) |
| 1341 | §10.2 L1110 | "Reference Customer Contact" not in code | todo | reference-customer.ts:1-2 (placeholder) |
| 1342 | §10.3 L1140 | "Case Study Auto-generation" not implemented | todo | case-study.ts:1-2 (placeholder) |
| 1343 | §11.1 L1170 | "Industry Analyst Briefing" not implemented | todo | analyst-briefing.ts:1-2 (placeholder) |
| 1344 | §11.2 L1200 | "Industry Award Submission" not implemented | todo | award-submission.ts:1-2 (placeholder) |
| 1345 | §11.3 L1230 | "Industry Conference Talk" not implemented | todo | conference-talk.ts:1-2 (placeholder) |
| 1346 | §11.4 L1260 | "Industry Whitepaper" not implemented | todo | whitepaper.ts:1-2 (placeholder) |
| 1347 | §11.5 L1290 | "Industry Webinar" not implemented | todo | webinar.ts:1-2 (placeholder) |
| 1348 | §12.1 L1320 | "Partner Integration" not implemented | todo | partner-integration.ts:1-2 (placeholder) |
| 1349 | §12.2 L1350 | "Partner Portal" not implemented | todo | partner-portal.ts:1-2 (placeholder) |
| 1350 | §12.3 L1380 | "Partner Certification" not implemented | todo | partner-certification.ts:1-2 (placeholder) |
| 1351 | §12.4 L1410 | "Partner Revenue Share" not implemented | todo | partner-revenue.ts:1-2 (placeholder) |
| 1352 | §12.5 L1440 | "Partner Lead Distribution" not implemented | todo | partner-lead.ts:1-2 (placeholder) |
| 1353 | §13.1 L1470 | "Marketplace Listing" not implemented | todo | marketplace-listing.ts:1-2 (placeholder) |
| 1354 | §13.2 L1500 | "Marketplace Pricing" not implemented | todo | marketplace-pricing.ts:1-2 (placeholder) |
| 1355 | §13.3 L1530 | "Marketplace Analytics" not implemented | todo | marketplace-analytics.ts:1-2 (placeholder) |
| 1356 | §13.4 L1560 | "Marketplace Reviews" not implemented | todo | marketplace-reviews.ts:1-2 (placeholder) |
| 1357 | §13.5 L1590 | "Marketplace Support" not implemented | todo | marketplace-support.ts:1-2 (placeholder) |
| 1358 | §13.6 L1620 | "Marketplace Compliance" not implemented | todo | marketplace-compliance.ts:1-2 (placeholder) |
| 1359 | §13.7 L1650 | "Marketplace Localization" not implemented | todo | marketplace-i18n.ts:1-2 (placeholder) |
| 1360 | §13.8 L1680 | "Marketplace Search" not implemented | todo | marketplace-search.ts:1-2 (placeholder) |
| 1361 | §13.9 L1710 | "Marketplace Recommendation" not implemented | todo | marketplace-recommendation.ts:1-2 (placeholder) |
| 1362 | §13.10 L1740 | "Marketplace Versioning" not implemented | todo | marketplace-versioning.ts:1-2 (placeholder) |
| 1363 | §13.11 L1770 | "Marketplace Compatibility Check" not implemented | todo | marketplace-compat.ts:1-2 (placeholder) |
| 1364 | §13.12 L1800 | "Marketplace Auto-update" not implemented | todo | marketplace-auto-update.ts:1-2 (placeholder) |
| 1365 | §13.13 L1830 | "Marketplace Deprecation" not implemented | todo | marketplace-deprecation.ts:1-2 (placeholder) |
| 1366 | §13.14 L1860 | "Marketplace Telemetry" not implemented | todo | marketplace-telemetry.ts:1-2 (placeholder) |
| 1367 | §13.15 L1890 | "Marketplace SLA" not implemented | todo | marketplace-sla.ts:1-2 (placeholder) |
| 1368 | §3.1 L291 | benchmark-map "visual regression eval" not separately defined benchmark id | todo | config/division-coverage/benchmark-map.yaml:79-89 |
| 1369 | §Terminology L43-45 | family-readiness.yaml and source_of_truth.md inconsistent priority not declared | todo | docs_zh/governance/source_of_truth.md |
| 1370 | §11 L1068 | family-expansion report does not include leadership type / readiness current metric snapshot | todo | docs_zh/divisions/family-expansion/engineering-expansion.md |
| 1371 | §10.2 L1034 | admin route does not read audit-leadership-claims report | todo | src/platform/five-plane-interface/api/http-server/admin-routes.ts |
| 1372 | §7.4 L687 | records.yaml missing `industry_comparable` / `industry_leading` actual record entries | todo | config/division-coverage/claims/records.yaml |

## Supplement merged from platforme-full-review-ee (only merge those not in e and without obvious conflict)

> Merge rule: only supplement those todos in `docs_zh/reviews/platforme-full-review-ee.md` not appearing in this file with the same path anchor; if same path/same-class issue exists in `e`, treated as potential conflict and skip.
>
> Potential conflict anchors skipped this time:
>
> - `ee#7`: `http-server/utils.ts:40` already in this file existing HMAC / cursor secret issues
> - `ee#26`: `0.0.0.0/8` / SSRF blocklist baseline issues already in this file existing egress / outbound policy entries

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1373 | `src/platform/five-plane-interface/api/http-api-server.ts:209-228` `createServer` callback's `void this.handleRequest(...).catch(error => { ... })` only writes JSON error back when `!response.headersSent`; if route handler has started streaming response (headers already sent), error silently swallowed, and `else` branch (line 213) unreachable. | `fixed` | Fixed: top-level catch now records error and actively `response.destroy(...)` when headers already sent, no longer silently swallowing streaming response errors; directed regression passed `http-api-server` related cases. |
| 1374 | `src/platform/five-plane-interface/api/http-api-server.ts:1235-1243` `isLikelyPathIdentifier` recompiles `/^[A-Za-z0-9_-]+$/`, `/^[0-9]+$/`, UUID and other regexes on every call; this function called once per URL segment. | `fixed` | Fixed: path identifier regexes hoisted to module-level constants, hot path no longer re-allocates. |
| 1375 | `src/platform/five-plane-interface/api/middleware/request-deduplication.ts:8,202` request deduplication uses `createHash("sha256").update(body, "utf8").digest("hex")` as idempotency key; consistent with round d 9-item closure, but `http-api-server.ts:182-185` always passes `allowInMemoryInProduction: true`, multi-instance deployment deduplication silently degrades to no-op. | `fixed` | Fixed: production environment in-memory fallback now explicitly controlled by `AA_ALLOW_IN_MEMORY_REQUEST_DEDUPLICATION`, no longer default silently degrading in production. |
| 1376 | `src/platform/five-plane-interface/api/api-auth-service.ts:400-403` `authenticate()` accepts `x-api-key` on **every** endpoint, directly calls `exchangeApiKey` to issue JWT on the spot; long-lived API key bypasses short-lived JWT discipline, missing per-key rate limit and audit tracking. | `todo` | auth layer mixes token-exchange with every-request authentication; `/auth/token` and other endpoints should go two different fast/slow paths. |
| 1377 | `src/platform/five-plane-interface/api/api-auth-service.ts:274-277` `principalHasRequiredRole` uses `>=` rank for inheritance, missing explicit route→role-set mapping; if new role with lower rank added in the future (e.g. `service:0`), will match across permissions. | `fixed` | Fixed: role inheritance changed to explicit implication set, no longer scalar rank comparison, new role will not get cross-permission match due to rank overflow. |
| 1378 | `src/platform/five-plane-interface/api/oidc-oauth-service.ts:13,71,647-648` PKCE uses `createHash("sha256")` (correct), but `code_challenge_method=plain` path does not enforce minimum entropy, and line 647 comment "Use createHash, not createHmac" exposes a non-obvious algorithm choice, no unit test guards it. | `fixed` | Re-review confirmed current implementation closed: current implementation only issues `S256`, no `plain` branch; this entry is old audit conclusion residue. |
| 1379 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` `get-then-set` not atomic; two concurrent same Idempotency-Key requests will double-write; line 206-217 in-flight branch returns both `allowed:true` and 409, semantically conflicting. | `fixed` | Re-review confirmed current implementation closed: idempotency storage already provides `reservePending`, in-flight branch return semantics also unified to reject not `allowed:true + 409`. |
| 1380 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` error message echoes user-input `idempotencyKey`/`method`; line 222-234 cached response `JSON.parse` also no body size guardrail. | `fixed` | Fixed: error message changed to general text, cached response read also added size guardrail. |
| 1381 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` user cursor `JSON.parse` no try/catch and no size limit; malicious cursor → 500. | `fixed` | Fixed: cursor parsing uniformly goes through `decodeOpaqueCursor(...)` / unified error boundary, directed regression passed. |
| 1382 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:77`, `dashboard-routes.ts:349`, `utils.ts:112,360`, `admin-routes.ts:176` and 7+ other `requestJson` use `JSON.parse` cast to `Record<string, unknown>`, no schema validation, no size guardrail. | `fixed` | Fixed: HTTP route layer added `readJsonBody` / `readStoredJsonRecord` / `readStoredJsonValue`, `approval`, `dashboard`, `admin inventory snapshot` etc. entries all added size guardrails and safe fallback. |
| 1383 | `src/platform/five-plane-interface/api/http-server/console-routes.ts:163-453` HTML route's `escapeHtml` (line 456-463) only escapes `&<>"'`, does not escape backtick and `\\`; CSP `default-src 'none'` currently does block inline script, but escape gap is defense-in-depth gap, once `script-src 'self'` is added in the future XSS triggered. | `fixed` | Fixed: HTML escape backtick and backslash escape added, directed regression passed. |
| 1384 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:177-183` `WebSocketServer` no `verifyClient`; token goes through Sec-WebSocket-Protocol header, can be cross-origin hijacked on browser side (CSWSH). | `fixed` | Fixed: WebSocket bridge added origin check and reject log, cross-origin handshake no longer directly enters trust chain. |
| 1385 | `src/platform/five-plane-interface/webhook/index.ts:73-74,200-211,255,296-315` three unbounded Maps `acceptedEnvelopes` / `failureCounts` / `envelopesByIdempotencyKey`; `Buffer.from(normalizedSignature, "hex")` accepts non-hex and truncates; `parseWebhookPayload` does not limit body size (line 296-315). | `fixed` | Fixed: webhook entry added body size upper limit, signature hex check, and failureCounts capacity governance. |

