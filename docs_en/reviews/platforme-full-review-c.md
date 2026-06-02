## src/platform/five-plane-interface

| No. | Issue | Status |
| --- | --- | --- |
| 1 | `iam/audit-event-integrity.ts:43-44`, `distributed-rate-limiter.ts:47`, `request-deduplication.ts:82`, `http-api-server.ts:119-122`, `http-server/health-routes.ts:19-21` read `process.env.NODE_ENV` / constants directly in module, breaking DI and testability | `todo` |
| 2 | `stryker.config.mjs:30-33` `mutate:` covers only 9 files concentrated in `http-server/`, scope is far narrower than the policy document claims | `todo` |
| 3 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` user `cursor JSON.parse` lacks `try/catch`; a malicious cursor causes 500 | `todo` |
| 4 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104` module-level `InMemoryHarnessRunStore` singleton, shared across requests, data lost on restart | `todo` |
| 5 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162` `/events` endpoint always returns an empty array, not wired to Truth | `todo` |
| 6 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228` `body.riskLevel/status` is directly `as`-cast without enum validation | `todo` |
| 7 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279` `PATCH` writes `body.status/terminalReason` directly to storage without a whitelist | `todo` |
| 8 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89` `list` runs an `Array.from+sort O(n log n)` per request, re-sorting everything | `todo` |
| 9 | `src/platform/five-plane-interface/webhook/index.ts:73-74` `acceptedEnvelopes/failureCounts` grow without bound | `todo` |
| 10 | `src/platform/five-plane-interface/webhook/index.ts:72` `envelopesByIdempotencyKey` lacks TTL / cap | `todo` |
| 11 | `src/platform/five-plane-interface/webhook/index.ts:111-120` event-type / allow-list validation runs before signature validation, so unsigned probes can enumerate `allowedEventTypes` | `todo` |
| 12 | `src/platform/five-plane-interface/webhook/index.ts:207-209` hard-coded failure count of 50, no reactivation path after auto-disable | `todo` |
| 13 | `src/platform/five-plane-interface/webhook/index.ts:200-211` `recordDeliveryFailure` directly mutates the registered object's `enabled`, breaking the immutability contract | `todo` |
| 14 | `src/platform/five-plane-interface/webhook/index.ts:182-184` `rollbackAcceptedEnvelope` uses linear `findIndex` | `todo` |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:296-315` `parseWebhookPayload` does not cap body size, huge JSON can block the event loop | `todo` |
| 16 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` `get` before `set` is not atomic; concurrent requests with the same `Idempotency-Key` produce double writes | `todo` |
| 17 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217` `in-flight` branch returns `allowed:true` while also emitting 409; semantics conflict | `todo` |
| 18 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` error message echoes the user-provided `idempotencyKey/method`, response-injection risk | `todo` |
| 19 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234` cached-response `JSON.parse` has no size limit | `todo` |
| 20 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:73` user `requestJson JSON.parse` has no size limit | `todo` |
| 21 | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344` `dashboard requestJson JSON.parse` has the same problem | `todo` |
| 22 | `src/platform/five-plane-interface/api/http-server/utils.ts:339,344` cursor base64url encode/decode has no `try/catch` and no integrity signature, so cursors are tamperable | `todo` |
| 23 | `src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125` when `body` is not a string it is `JSON.stringify`-ed then forwarded, dropping the original byte order and breaking signatures | `todo` |
| 24 | `src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357` `JSON.stringify(payload)` is persisted without a deterministic key order | `todo` |
| 25 | `src/platform/five-plane-interface/webhook/index.ts:255` `Buffer.from(normalizedSignature,"hex")` accepts non-hex input and truncates, length comparison masks contamination | `todo` |
| 26 | `src/platform/five-plane-interface/webhook/index.ts:60-61` replay-cache TTL and capacity are module-level constants, not configurable per tenant / endpoint | `todo` |
| 27 | `tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337` 6 occurrences of `host:"0.0.0.0"` listen on all interfaces | `todo` |
| 28 | `api-server-env.ts` reads `AA_API_KEYS_JSON` while the docs reference `AA_API_KEYS` — inconsistent | `todo` |

## src/platform/five-plane-control-plane

| No. | Issue | Status |
| --- | --- | --- |
| 29 | The control plane reaches into private SQLite paths of the state-evidence plane (`approval/config/incident-control` in several places) | `todo` |
| 30 | About 40 places in the execution plane import control-plane IAM / config implementation details, bypassing the contract / policy port | `todo` |
| 31 | `iam/field-encryption.ts:10,24` PBKDF2 only 100k iterations plus a synchronous `pbkdf2Sync`, below OWASP's 600k recommendation and blocks the event loop | `todo` |
| 32 | `iam/session-management.ts:164-167` `hashToken` uses bare `sha256(token)`; a file comment acknowledges HMAC should be used | `todo` |
| 33 | `tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355` `Date.now()-90000000` is commented `"25h"` but is actually 25h00m00s, equal to the TTL — flakiness window | `todo` |
| 34 | `tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096` `delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION` runs without a prior capture | `todo` |
| 35 | `src/platform/five-plane-control-plane/policy-center/index.ts:282` emergency mode `requiresApproval=subjectType!=="system"` lets `system` principals bypass break-glass approval | `todo` |
| 36 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132` `getFieldValue` traverses `.` paths and does not reject `__proto__/constructor/prototype` | `todo` |
| 37 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450` `JSON.stringify(config, Object.keys(config).sort())` misuses `replacer` as a key whitelist, so nested fields get truncated | `todo` |
| 38 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457` 32-bit non-cryptographic hash used as a config checksum, collision probability is non-trivial | `todo` |
| 39 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768` `startDailyRotationSchedulers` clears existing schedulers before adding new ones, losing in-flight sweeps on reentry | `todo` |
| 40 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776` `runRotationSweep("initial")` starts at the same time as `setInterval`, allowing two sweeps to run concurrently | `todo` |
| 41 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364` double base64 decode assumes KMS always returns base64 | `todo` |
| 42 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256` GCP secret return value is not validated as base64 | `todo` |
| 43 | `src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266` `runbook executor` only simulates, the production path is not wired | `todo` |
| 44 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts` config hash only takes the top-level keys, not recursive | `todo` |
| 45 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:46` `Buffer.from(value,"base64")` decodes directly without rejecting pure utf-8 input | `todo` |
| 46 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128` arbitrary string parts can be indexed into `Function.prototype` and similar, producing false-positive / false-negative matches | `todo` |
| 47 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815` `requireRegistryRecord` error path repeats `secretRef` in `details` without redaction | `todo` |
| 48 | `tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66` `/tmp/test-file-${Date.now()}` falls outside the `sandbox-root` test matrix | `todo` |
| 49 | `startup-env-schema.ts:376` JWT key being `undefined` falls into a default-allow path, tokens can still be issued without a key | `todo` |
| 50 | `api-client.ts` parses `Retry-After` with raw `parseInt`, not recognizing HTTP-date | `todo` |
| 51 | `test:secret-providers` script path is wrong (missing one `platform/` level) | `todo` |
| 52 | `auto-stop-loss-service.ts:789`, `config-hot-reload-service.ts:268,506`, `cache-invalidation-broadcast.ts:68`, `durable-event-bus.ts:710,916,1007`, `call-governance.ts:609`, `external-secret-provider.ts:226` — many `void promise fire-and-forget` calls without `.catch` | `todo` |
| 53 | `aws-kms-http-secret-provider.ts:211`, `gcp-secret-manager-http-secret-provider.ts:103`, `vault-http-secret-provider.ts:132` `setTimeout(...controller.abort)` is not `.unref()`-ed and some success paths miss `clearTimeout` | `todo` |
| 54 | `secret-management-service.ts:765-768` `startDailyRotationSchedulers` silently `clear`s existing schedulers, invalidating external handles | `todo` |
| 55 | `client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` overwrites a readonly field via cast | `todo` |
| 56 | `client-sdk/api-client.ts:368` `connect()` is `fire-and-forget` at the SSE bootstrap point, the initial fetch rejection is unhandled | `todo` |

## src/platform/five-plane-orchestration

| No. | Issue | Status |
| --- | --- | --- |
| 57 | `src/platform/agent-delegation/index.ts` and `five-plane-orchestration/agent-delegation/*` form a dual entry point | `todo` |
| 58 | `config/quality/test-exclusion-allowlist.json` lists `tests/integration/platform/orchestration/**` (already renamed to `five-plane-orchestration`), so it never matches | `todo` |
| 59 | `oapeflir/runtime-execute-bridge.ts:223-235` when `executor` is `null` it synthesizes a fake `succeeded + validationPassed:true`, the stub returns silently | `todo` |
| 60 | `oapeflir/runtime-execute-bridge.ts:182` `defaultModelId="MiniMax-M2.7"` hard-codes a specific vendor model into framework code | `todo` |
| 61 | `oapeflir/runtime-execute-bridge.ts:194,264,316` `createdAt: Date.now()` numeric value drifts from `Plan.createdAt: string` type, relying only on `as Plan` cast | `todo` |
| 62 | `oapeflir/handoff-model.ts:55-57` `Math.ceil(JSON.stringify(value).length/4)` token estimate is distorted for CJK / multi-byte content | `todo` |
| 63 | `oapeflir/handoff-model.ts:88-135` compression silently drops `historyRefs/toolCallRecords/planDelta/blockers/artifactRefs`, with no drop ledger | `todo` |
| 64 | `oapeflir/oapeflir-loop-core.ts:382`, `oapeflir-loop-support.ts:324`, `stage-transition-fsm.ts:189-223` multiple places self-stamp with `Date.now()`, which is non-monotonic under clock skew | `todo` |
| 65 | `oapeflir/oapeflir-loop-core.ts:299` writes `process.{version,platform,cwd()}` into `environmentContext` retained as evidence, leaking host fingerprint | `todo` |
| 66 | `docs_zh/contracts/oapeflir_loop_contract.md` exists but the `README` does not list it; `ADR-016` references OAPEFLIR and does not link to it either | `todo` |
| 67 | `scripts/ci/mutation-critical-tests.sh:13` references `tests/unit/platform/orchestration/oapeflir/...` but the authoritative path is `five-plane-orchestration`; after the rename it silently runs zero tests | `todo` |
| 68 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275` `super("mock://runtime","local-simulated")` defaults to the mock runtime | `todo` |
| 69 | `scripts/ci/audit-oapeflir-terminology.mjs` only scans the eight-letter spelling, missing Chinese term drift | `todo` |

## src/platform/five-plane-execution

| No. | Issue | Status |
| --- | --- | --- |
| 70 | `plugin-executor.service.ts:482` explicitly throws `action_not_implemented`; a missing hook returns 500 | `todo` |
| 71 | `five-plane-execution/state-transition/*` is re-exported via `core/runtime/index.ts`, crossing module boundaries | `todo` |
| 72 | `tests/unit/runtime/`, `platform/execution/`, `platform/five-plane-execution/` are parallel and duplicate | `todo` |
| 73 | `plugin-executor.service.ts:106` `enforceSignatures` defaults to `false`, so without env the system fails open unsafely | `todo` |
| 74 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90` `SELECT/DELETE/INSERT` are not in a transaction; TTL expiry eviction is a TOCTOU window — concurrent acquirers can delete a fresh holder's lock | `todo` |
| 75 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37` `distributed_lock_fencing_tokens` only ever `INSERT`-auto-increments, is never cleaned up, and grows without bound | `todo` |
| 76 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54` `ttlMs` has no lower-bound check; negative / 0 values are written directly | `todo` |
| 77 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148` `forceSteal` has no prior authorization / reason whitelist, any caller can seize a lock | `todo` |
| 78 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140` `forceSteal` hard-codes `ttlMs=30000` instead of inheriting the original lock's TTL | `todo` |
| 79 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112` when `release owner` does not match it silently returns `false` with no audit event | `todo` |
| 80 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573` `dequeueAsync` has multiple `await`s with no atomicity, two workers can claim the same `jobId` | `todo` |
| 81 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569` `hincrby attempts` runs before state confirmation; a state reset causes counter drift | `todo` |
| 82 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568` when state is not `waiting` the `zrem` returns `null` and the task is silently dropped | `todo` |
| 83 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596` only the ack path `expire`-s the job key; `nack`/failed jobs accumulate keys without TTL | `todo` |
| 84 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609` `nack` re-queue has no backoff, the same worker immediately re-picks the job | `todo` |
| 85 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672` `retryJobAsync` forces `attempts=0`, bypassing the `maxAttempts` budget | `todo` |
| 86 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600` `nack` closure references stale `jobData.priority` | `todo` |
| 87 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695` `purgeAsync` issues one `hgetall` per ID, an N+1 RTT storm | `todo` |
| 88 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317` reads the whole `arrayBuffer()` first, then checks size, allowing an oversized response to OOM | `todo` |
| 89 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324` `JSON.parse` has no `try/catch`; a malicious JSON throws immediately | `todo` |
| 90 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298` `Content-Type` is case-sensitive; callers using `Content-type` will write headers twice | `todo` |
| 91 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678` `simulateStepExecution` is just `setTimeout 50ms`, no real action is performed | `todo` |
| 92 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733` `simulateRollback` is a no-op, rollback always succeeds | `todo` |
| 93 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669` `findStepDefinition` walks every execution, `O(N·M)` | `todo` |
| 94 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642` `step.output` hard-codes `"Step X completed successfully"`, overwriting the real output | `todo` |
| 95 | `src/platform/five-plane-execution/compensation-manager.ts:312-319` `reverseExternalEffect` directly `return true`; external side effects are not reversed | `todo` |
| 96 | `src/platform/five-plane-execution/compensation-manager.ts:326-333` `executeCompensateAction` is a stub that always returns true | `todo` |
| 97 | `src/platform/five-plane-execution/compensation-manager.ts:339-344` `sendCompensationNotification` is an empty body; notifications are never sent | `todo` |
| 98 | `src/platform/five-plane-execution/compensation-manager.ts:350-358` `executeRollback` is a stub; the rollback contract is not implemented | `todo` |
| 99 | `src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6` is just a `re-export`; per `AGENTS` it should be removed entirely | `todo` |
| 100 | `src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31` is a compatibility file that keeps redundant naming | `todo` |
| 101 | `src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts` and `phase1b-utils.ts` are `phase1b` compatibility remnants | `todo` |
| 102 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` and `runtime-recovery-service-root.ts` form one of four `*-service/*-service-root` twin pairs | `todo` |
| 103 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` is a 581-line single file, violating the `AGENTS small modules` principle | `todo` |
| 104 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` is 814 lines, same problem | `todo` |
| 105 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47` uses CJS `require` in reverse inside ESM | `todo` |
| 106 | `src/platform/five-plane-execution/distributed-lock/locking-support.ts:12` `require("postgres")` is loaded synchronously, optional-dependency coupling | `todo` |
| 107 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68` at construction time `createRequire+require("ioredis")`; a missing dependency crashes startup | `todo` |
| 108 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226` `lock id` is built from `Date.now()` strings, millisecond collisions can be reused | `todo` |
| 109 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47` uses `createRequire` then dynamically `require`s sibling `.js` files; module graph is not statically analyzable | `todo` |
| 110 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts` is a 9-line dead shim | `todo` |
| 111 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts` is a 10-line dead shim | `todo` |
| 112 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts` is a 21-line thin wrapper that overlaps with `manager/service` | `todo` |
| 113 | `src/platform/five-plane-execution/execution-engine/runtime-context.ts` is a 1-line shim | `todo` |
| 114 | `src/platform/five-plane-execution/execution-engine/single-task-execution.ts` is a 7-line `re-export shim` | `todo` |
| 115 | `src/platform/five-plane-execution/distributed-lock/index.ts` is a 1-line barrel | `todo` |
| 116 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562` picks the highest score (newest), violating FIFO — the docs do not note this | `todo` |
| 117 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693` checkpoint state directly references the original `entries` array, so later mutations pollute historical checkpoints | `todo` |
| 118 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713` when `rollbackHistory` is empty `performRollback` marks everything `rolled_back`, with no distinction for steps that never ran | `todo` |
| 119 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288` `AbortController.unref` means the timeout does not block exit, but abort does not `await` cleanup and races with ESM top-level evaluation | `todo` |
| 120 | `src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts` and `runtime-recovery-service.ts` differ only in import paths and a few variable names — they constitute de-facto branches | `todo` |
| 121 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121` `Math.min(ttlMs,MAX_LOCK_TTL_MS)` is duplicated three times; the constant `600_000ms` is hard-coded | `todo` |
| 122 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127` `extend` uses `MIN(ttl_ms+?, MAX)` to accumulate instead of resetting from now, so TTL slides toward the cap | `todo` |
| 123 | `pg-advisory-lock-adapter.ts` acquires a lock without `try/finally`; a throw path leaks the lock | `todo` |
| 124 | `pg-advisory-lock-adapter.ts:34-43` custom FNV-1a truncated to 63 bits; collisions are silently accepted | `todo` |
| 125 | `pg-advisory-lock-adapter.ts:71-83` `extend()` only changes the in-memory map, does not refresh the PG-side advisory lock TTL | `todo` |
| 126 | `pg-advisory-lock-adapter.ts:107-115` catch-all disguises transient PG errors as `"lock taken"` | `todo` |
| 127 | `pg-advisory-lock-adapter.ts:101` `Number(result.fencing_token)` loses precision past `2^53` | `todo` |

## src/platform/five-plane-state-evidence

| No. | Issue | Status |
| --- | --- | --- |
| 128 | `CLAUDE.md:50` references a non-existent `state-evidence/artifacts/` directory | `todo` |
| 129 | Multiple contract / review docs point to a non-existent `state-evidence/artifacts/` directory | `todo` |
| 130 | `runtime-truth-repository.ts:741`, `projection-rebuild-service.ts:429`, `memory-gateway/index.ts:248`, `plan-builder.ts:193` use non-canonicalized `JSON.stringify` as a fingerprint; key order changes cause false-positive diffs | `todo` |
| 131 | `tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261` uses `Date.now()-90000` for aging assertions, clock drift causes flakiness | `todo` |
| 132 | `tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts` and `durable-event-bus-integration.test.ts` have inconsistent naming, likely a duplicate run | `todo` |
| 133 | `package.json:223-234` `test:receipt-store/tool-gateway/memory-gateway/sandbox-provider` lack an aggregator and are operator-only entry points | `todo` |
| 134 | `five-plane-state-evidence/index.ts:1` `re-export`s a non-existent `./artifacts/index.js`, the import throws | `todo` |
| 135 | `truth/sqlite/repositories/operations-repository.ts:898` `listRuntimeRecoveryRecords` concatenates the caller's `whereClause` directly into SQL; it only filters `;\\|--\\|/*` and still allows `OR 1=1/subqueries` | `todo` |
| 136 | `truth/sqlite/repositories/event-repository.ts:788-828` `insertEvent` and the outbox `INSERT` are two prepared statements without a single transaction, breaking outbox atomicity | `todo` |
| 137 | `truth/sqlite/repositories/task-repository.ts:96-125` `listTasks cursor` orders only by `updated_at`, no `id` tiebreaker — pagination can drop rows or loop forever | `todo` |
| 138 | `truth/sqlite/repositories/tenant-repository.ts:203-204` `listAll` uses `[...Map.values()].slice` with no stable ordering, so cross-page results can reorder | `todo` |
| 139 | `truth/sqlite/repositories/release-repository.ts:611,632,654` `listEnterprise*` only sets `limit=20`, with no cursor / offset / tenant filter | `todo` |
| 140 | `truth/sqlite/repositories/intelligence-repository.ts:350` `listIntelBriefs(limit=20)` silently truncates with no cursor | `todo` |
| 141 | `truth/sqlite/repositories/organization-repository.ts:273` `listOrganizationRecords(limit=50)` has no tenant filter, cross-tenant leakage | `todo` |
| 142 | `truth/sqlite/repositories/worker-repository.ts:63` and `worker-snapshot-repository.ts:276` `listCoordinatorInstanceSnapshots` have two implementations with schema drift | `todo` |
| 143 | `state-evidence/dlq/index.ts:110-113` `enqueue` uses a linear `listByConsumer` to deduplicate, `O(n)` per insert, no index | `todo` |
| 144 | `state-evidence/dlq/index.ts:282-284` `runDueRetries` has an empty `catch {}` swallowing errors with no logger, telemetry, or backoff | `todo` |
| 145 | `state-evidence/dlq/index.ts:99` `maxRetries=5` is hard-coded, conflicting with `dlq-service.ts retry policy` | `todo` |
| 146 | `state-evidence/dlq/index.ts:6-23` `DeadLetterRecord` and `contracts/types/domain/session-types.ts EventDeadLetterRecord` schema are two sources | `todo` |
| 147 | `state-evidence/incident/index.ts:127-161` `listIncidents/listIncidentsPaginated` do a full `Map.values() + sort + findIndex`; under concurrent inserts the cursor becomes invalid | `todo` |
| 148 | `state-evidence/incident/index.ts:35` `linkedEvidenceRefs: input.linkedEvidenceRefs ?? []` stores the caller's reference directly, external mutation pollutes internal state | `todo` |
| 149 | `state-evidence/incident/index.ts:117-121` `resolve()` accepts any current state, bypassing the `triaged→mitigating→reviewed→resolved` FSM | `todo` |
| 150 | `state-evidence/incident/index.ts:22` `nextIncidentOrder` produces a monotonic ID that is publicly predictable and enumerable | `todo` |
| 151 | `state-evidence/audit/index.ts:21,29` `AuditTrailService.records` is an in-memory array with no rotation / persistence; a long process will OOM | `todo` |
| 152 | `projections/projection-rebuild-service.ts:265-266,278-294` `JSON.stringify` comparison ignores key ordering; cutover has no optimistic-concurrency token | `todo` |
| 153 | `checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` does not throw; malicious payload is silently truncated before going into gunzip | `todo` |
| 154 | `checkpoints/checkpoint-envelope.ts:147-149` `JSON.stringify` materializes a large object fully before checking size, OOM happens before the guard fires | `todo` |
| 155 | `checkpoints/checkpoint-gc-service.ts:548-560` `acquireRunLock` does not record PID / host, so a crash residual lock is indistinguishable from a live lock | `todo` |
| 156 | `knowledge/keyword-index.ts:22-30` `upsert` does not clear the previous keywords' reverse index, leaving stale postings | `todo` |
| 157 | `knowledge/keyword-index.ts:32-47` `query` re-runs `countOccurrences` every time, no cache | `todo` |
| 158 | `knowledge/keyword-index.ts:1-53` lacks a `delete(chunkId)` API, chunks are immortal | `todo` |
| 159 | `memory-gateway/index.ts:248-258` `projectionHash` uses `JSON.stringify([...input.memoryIds])` preserving caller order; the same set with different order hashes differently | `todo` |
| 160 | `memory-gateway/index.ts:280-298` memory-layer mapping `L1/L2/L4/L6 round-trip` is lossy, not asserted | `todo` |
| 161 | `memory-gateway/index.ts:328` `Number.isFinite(Number(metadata.version))` accepts `1e308`; lacks integer / range validation | `todo` |
| 162 | `state-evidence/memory/trust-level-service.ts:245-248` `MAX=500/TTL=24h/EVICT=60s` are hard-coded with no config | `todo` |
| 163 | `state-evidence/memory/trust-level-service.ts:280-289` every eviction does `[...entries].sort O(n log n)`, with non-null assertions that swallow OOB | `todo` |
| 164 | `state-evidence/memory/trust-level-service.ts:384-385` `includes("TODO"/"FIXME")` literal-string filter collides with normal text | `todo` |
| 165 | `truth/sqlite/repositories/prompt-bundle-repository.ts:164-332` 8 places `JSON.stringify(input.*)` are written as columns without zod validation | `todo` |
| 166 | `truth/sqlite/repositories/billing-repository.ts:168` `Number(result.changes)` BigInt `> 2^53` is silently truncated | `todo` |
| 167 | `truth/sqlite/repositories/worker-snapshot-repository.ts:249` same query switches `ORDER BY` based on filter, so the cursor breaks across filters | `todo` |
| 168 | `state-evidence/events/event-ops-service.ts:216-221` `setTimeout(...) reject` timer is not `unref`-ed; the `Promise.race` winner does not `clearTimeout` | `todo` |
| 169 | `state-evidence/events/durable-event-bus.ts:9` different instantiation points have inconsistent `retentionLimit:500/100` | `todo` |
| 170 | `tests/integration/platform/state-evidence/events/transactional-event-appender` and `event-repository.ts:788-828` outbox is split into two prepared calls; under SQLite WAL autocommit, observers can see partial state | `todo` |
| 171 | `tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178` `createdAt:new Date().toISOString()` uses local clock; under different timezones replay metadata is non-deterministic | `todo` |
| 172 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138` `PRAGMA journal_mode=WAL` is not asserted on the return value, so NFS-like environments silently fall back to delete | `todo` |
| 173 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134` `busy_timeout` allows 0, allowing transient `SQLITE_BUSY` and concurrency conflicts | `todo` |
| 174 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283` `Object.values(row)` depends on `wal_checkpoint` column order, no key-name destructuring | `todo` |
| 175 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350` `close()` does not check `wal_checkpoint busy>0`, may close before frames are flushed | `todo` |
| 176 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449` detects `BUSY` with regex `database is locked\\|busy`; localization or errno changes break detection | `todo` |
| 177 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340` `healthCheck` is declared `async` but only runs a synchronous transaction, misleading callers | `todo` |
| 178 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465` `applyCompatibleColumnMigrationIfKnown` short-circuits `migration.sql` after a match, so index / constraint changes are silently lost | `todo` |
| 179 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233` `fetch` has no `AbortController / timeout` | `todo` |
| 180 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251` error body is concatenated into `Error message` directly, potential log injection | `todo` |
| 181 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+` `response.json()` has no `try/catch` | `todo` |
| 182 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144` does not validate the returned `index` range / duplicates; ordered mapping assumes one-to-one | `todo` |
| 183 | `src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` does not check length / MIME, a corrupt payload decodes to an empty buffer without error | `todo` |
| 184 | `src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385` uses `content.includes("TODO/FIXME")` as the basis for trust-level downgrade, obviously misfires | `todo` |
| 185 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330` `healthCheck` runs `CREATE/DROP TEMP TABLE` inside a transaction, leaving TEMP handles on rollback | `todo` |
| 186 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290` `checkpointWal` does not distinguish `busy>0` from `frames=0`, operations cannot identify the real bottleneck | `todo` |
| 187 | `tests/integration/platform/state-evidence/dlq-persistence.test.ts:464` `/tmp/dlq-persistence-test-${Date.now()}.db` is not portable to Windows and is not cleaned up in finally | `todo` |
| 188 | `tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17` `/tmp/aa-sandbox/ktest_${suffix}_${Date.now()}` central pollution | `todo` |
| 189 | `tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113` two `/tmp/aa-sandbox/...` paths not cleaned up | `todo` |
| 190 | `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts` 10MB threshold same problem, and does not differentiate `RSS/heapUsed` | `todo` |
| 191 | `dashboard-projection-service.ts:110` `system.health.changed` is not registered in `TypedEventType` | `todo` |
| 192 | `migrate-sqlite-to-pg.ts` column / table names are concatenated directly into SQL, no whitelist (injection risk) | `todo` |
| 193 | `idempotency-key-storage.ts` `${this.tableName}` is concatenated directly into SQL, not validated at construction | `todo` |
| 194 | `semantic-vector-store.ts` `process.env[name]` where `name` comes from config can read any env var | `todo` |
| 195 | `checkpoint-gc-service.ts` `fs.stat→fs.unlink` has a TOCTOU window | `todo` |
| 196 | `shadow-snapshot-service.ts` `lstat→rename` has a symlink swap window | `todo` |
| 197 | `sqlite-database-wrapper.ts:94-114` `savepoint` name is concatenated directly into `exec`, future callers can inject | `todo` |
| 198 | `sqlite-database.ts:143` `PRAGMA busy_timeout = ${this.busyTimeoutMs}` builds SQL, with no integer check on `busyTimeoutMs` | `todo` |
| 199 | `pg-advisory-lock-adapter.ts` `Number(result.fencing_token)`, `sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid)` lose precision past `2^53` | `todo` |
| 200 | `checkpoint-gc-service.ts:171,557`, `learning-object-model.ts:180,184`, `risk-register.ts:87,110`, `invariant-registry.ts:137,165,180`, `responsibility-boundary.ts:158-308`, `admin-config-service.ts:66`, `outbox-repository.ts:117`, `memory-layer-model.ts:214,549`, `graphql-adapter-service.ts:294`, `conversation-template-service.ts:408`, `approval-policy-engine/version-manager.ts:111`, `stable-evidence-bundle-support.ts:612,616,732`, `dlq-service.ts:238`, `knowledge-snapshot-store.ts:25-48`, `semantic-vector-validation.ts:276`, `tool-gateway/index.ts:150,160`, `idempotency-key-storage.ts:310,338,341`, `cors.ts:49-68`, `reliability/timeout.ts:45,54` — many places throw bare `Error` instead of a structured `AppError/ValidationError` | `todo` |
| 201 | `.gitignore` does not have global `*.db-shm/*.db-wal` patterns, so sqlite WAL residue can be committed | `todo` |

## src/platform/shared

| No. | Issue | Status |
| --- | --- | --- |
| 202 | `src/platform/stability/` and `src/platform/shared/stability/` are parallel same-named directories whose implementations have diverged | `todo` |
| 203 | `src/platform/shared/reliability/`, `shared/stability/reliability/`, `stability/reliability/` are three duplicated reliability implementations | `todo` |
| 204 | `src/platform/shared/observability/structured-logger.ts:484-491` per-fsync log uses `openSync+appendFileSync+fsyncSync+closeSync` as serial synchronous IO | `todo` |
| 205 | `src/platform/shared/observability/structured-logger.ts:153,180` `sinkBaseDir=process.cwd()`, so semantics drift when the runtime `chdir`s | `todo` |
| 206 | `src/platform/shared/observability/structured-logger.ts:194` `mkdirSync` has no error handling; permission errors throw out of `configure` | `todo` |
| 207 | `src/platform/shared/observability/structured-logger.ts:262` when `retentionLimit=0` the buffer length is 0, so every log is silently dropped | `todo` |
| 208 | `src/platform/shared/outbox/outbox-poller-service.ts:193-197` `retryCount>=maxRetries` only does `failed++;continue`, it never moves to DLQ | `todo` |
| 209 | `src/platform/shared/outbox/outbox-poller-service.ts:188-217` `for-await` processes serially, no concurrent batched publish | `todo` |
| 210 | `src/platform/shared/observability/otel-tracer.ts` and `otel-bootstrap.ts` each have their own `loadOtelApi/loadOtelModules` — two OTel load paths | `todo` |
| 211 | `src/platform/shared/observability/structured-logger.ts:153` `sinkBaseDir=process.cwd()`; after forking multiple workers, each keeps its own cwd, paths disagree | `todo` |
| 212 | `tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145` 5 `/tmp/...` paths not portable | `todo` |
| 213 | `tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30` `/tmp/${caseId}.backup.db` collides across cases and overwrites itself | `todo` |
| 214 | `graceful-shutdown.ts` `setImmediate(()=>process.exit())` does not flush stdio | `todo` |
| 215 | `slo-alerting-channels.ts` performs synchronous blocking IO inside `queueMicrotask` | `todo` |
| 216 | `graceful-shutdown.ts:122` `void this.handleSignal(signal)` has no `.catch`; shutdown errors become unhandled rejections | `todo` |

## src/platform/stability

| No. | Issue | Status |
| --- | --- | --- |
| 217 | `src/platform/stability/timeout.ts:82` success path does not `clearTimeout`; `setTimeout` handle leaks | `todo` |
| 218 | `src/platform/stability/timeout.ts cancel()` only cancels the timer, does not pass `AbortSignal` to the wrapped function | `todo` |
| 219 | `src/platform/stability/retry.ts` and `stability/reliability/retry.ts` coexist as two copies with diverging policies | `todo` |

## src/platform/prompt-engine

| No. | Issue | Status |
| --- | --- | --- |
| 220 | `ha-repository-postgres.ts:22`, `coordinator-load-balancing-service.ts:78`, `prompt-engine/registry/index.ts:123`, `tight-loop-detector.ts:82,95`, `loop-detection.ts:97`, `semantic-embedding.ts:108`, `structured-logger.ts:851`, `prompt-injection-guard.ts:543`, `profile-home.ts:31` — many places truncate `sha256` to 32-64 bits as identity / cache key, collision probability is high | `todo` |
| 221 | `prompt-engine/registry/index.ts:114` `listVersions` uses `localeCompare` to sort; `"10"` sorts before `"2"` lexicographically | `todo` |
| 222 | `prompt-engine/registry/index.ts:117-119` `listTemplates()` does a full `flat-map` with no pagination | `todo` |
| 223 | `prompt-engine/registry/index.ts:81-86` after the `version_conflict` check the two-phase write has no rollback, partial failures leave orphan mappings | `todo` |
| 224 | `prompt-engine/eval/quality-config-loader.ts:24-35` schema lacks `.refine` rules for `qualityScoreWeights` summing to ~1 and `completeMinScore>approvalRequiredScore` | `todo` |
| 225 | `prompt-engine/eval/quality-config-loader.ts:101-105` zod validation failures are swallowed into a generic `throw`, not a structured `AppError` | `todo` |
| 226 | `prompt-engine/eval/llm-eval-service.ts:633` `logger.warn` includes raw `suite.cases payload`, leaking PII / prompt content | `todo` |
| 227 | `prompt-engine/eval/prompt-model-policy-governance-service.ts:584` `JSON.parse(release.metadata)` has no zod validation | `todo` |
| 228 | `prompt-registry/index.ts:1-30` is a 30-line pure re-export shim, violating single source of truth | `todo` |
| 229 | `prompt-engine/conversation-template-config-loader.ts:35` `JSON.parse(content)` has no size cap, the config file can OOM | `todo` |
| 230 | `template-registry/index.ts` has two `@ts-expect-error` usages | `todo` |

## src/platform/contracts & types

| No. | Issue | Status |
| --- | --- | --- |
| 231 | `client-sdk/api-client.ts:984-992` `declare module ".../executable-contracts/index.js"` module augmentation globally pollutes `ContractEnvelope.principal` | `todo` |
| 232 | The whole repo has 193 occurrences of `assert.ok(true)` (e.g. `tests/e2e/sdk/sdk-e2e.test.ts:388`, many places in `tests/unit/platform/interface/ingress/*`, `vcr-replay-fixture.test.ts:338`, `contracts/types/domain/index.test.ts:32`, `redis-lock-adapter.test.ts:1079,1082`, etc.) — a systematic placeholder | `todo` |
| 233 | `contracts/types/responsibility-boundary.ts:316-326` puts the `GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE` singleton runtime state inside a `"types"` file | `todo` |
| 234 | `contracts/types/responsibility-boundary.ts:302,306` creates a new `Set` on every hot-path call | `todo` |
| 235 | `contracts/types/domain/billing-types.ts:68` `summaryJson:string` is an opaque blob without zod | `todo` |
| 236 | `contracts/types/domain/billing-types.ts:63,95,177` `currency:"USD"` is hard-coded in three places, the type forbids multi-currency | `todo` |
| 237 | `contracts/types/domain/billing-types.ts:122-129` `executionId/stepId` marked `@deprecated` but still required, with no removal plan | `todo` |
| 238 | `contracts/types/domain/index.ts:1-249` has 100+ hand-maintained symbols, no `export *` — new types are guaranteed to drift | `todo` |
| 239 | `contracts/types/index.ts:191` re-exports into `executable-contracts/index.js`, bypassing the domain namespace | `todo` |
| 240 | `contracts/mission/{playbook,index}.ts:373/357` two independent implementations of `stableStringify`, may drift | `todo` |
| 241 | `mission/index.ts` is a 1637-line single file, too large | `todo` |
| 242 | `data-classification-service.ts:680`, `network-egress-audit.ts:335`, `auto-stop-loss-service.ts:65-71`, `panic-propagation-service.ts:119-123`, `war-room-coordinator.ts:93-94`, `policy-engine.ts:83`, `takeover-escalation-manager.ts:46,49`, `approval-flow-engine.ts:571`, `approval-policy-engine/version-manager.ts:443`, `mission/index.ts:685`, `config-audit-service.ts:319,824`, `provider-health-tracker.ts:55`, `task-timeline-service.ts:181` — many `push`-style in-memory lists that grow without bound | `todo` |
