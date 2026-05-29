## src/platform/five-plane-interface

| # | Issue | Status |
|---|-------|--------|
| 1 | `iam/audit-event-integrity.ts:43-44`, `distributed-rate-limiter.ts:47`, `request-deduplication.ts:82`, `http-api-server.ts:119-122`, `http-server/health-routes.ts:19-21` directly read `process.env.NODE_ENV`/constants inside library code, breaking DI and testing | `todo` |
| 2 | `stryker.config.mjs:30-33` `mutate:` only 9 files concentrated in `http-server/`, coverage far narrower than strategy document claims | `todo` |
| 3 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` user `cursor JSON.parse` has no `try/catch`, malicious cursor → 500 | `todo` |
| 4 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104` module-level `InMemoryHarnessRunStore` singleton, shared across requests, data lost on restart | `todo` |
| 5 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162` `/events` endpoint always returns empty array, not connected to Truth | `todo` |
| 6 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228` `body.riskLevel/status` directly cast with `as` without enum validation | `todo` |
| 7 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279` `PATCH` writes `body.status/terminalReason` directly to storage, no whitelist | `todo` |
| 8 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89` `list` does `Array.from+sort O(n log n)` full re-sort per request | `todo` |
| 9 | `src/platform/five-plane-interface/webhook/index.ts:73-74` `acceptedEnvelopes/failureCounts` unbounded growth | `todo` |
| 10 | `src/platform/five-plane-interface/webhook/index.ts:72` `envelopesByIdempotencyKey` lacks TTL/capacity limit | `todo` |
| 11 | `src/platform/five-plane-interface/webhook/index.ts:111-120` event type/allowlist validation before signature validation, unsigned requests can enumerate `allowedEventTypes` | `todo` |
| 12 | `src/platform/five-plane-interface/webhook/index.ts:207-209` failure count hardcoded to 50, auto-disable has no re-enable path | `todo` |
| 13 | `src/platform/five-plane-interface/webhook/index.ts:200-211` `recordDeliveryFailure` directly mutates registered object's `enabled`, breaking immutable contract | `todo` |
| 14 | `src/platform/five-plane-interface/webhook/index.ts:182-184` `rollbackAcceptedEnvelope findIndex` linear search | `todo` |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:296-315` `parseWebhookPayload` doesn't limit body size, oversized JSON blocks event loop | `todo` |
| 16 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` non-atomic get-then-set, concurrent same `Idempotency-Key` causes double write | `todo` |
| 17 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217` `in-flight` branch returns `allowed:true` but also attaches 409, semantic conflict | `todo` |
| 18 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` error message echoes user `idempotencyKey/method`, response injection risk | `todo` |
| 19 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234` cached response `JSON.parse` has no size limit | `todo` |
| 20 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:73` user `requestJson JSON.parse` has no size limit | `todo` |
| 21 | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344` `dashboard requestJson JSON.parse` same issue | `todo` |
| 22 | `src/platform/five-plane-interface/api/http-server/utils.ts:339,344` cursor base64url encode/decode has no `try/catch`, no integrity signature, can be tampered | `todo` |
| 23 | `src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125` when `body` is not string, `JSON.stringify` then forward, losing byte order signature validation fails | `todo` |
| 24 | `src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357` `JSON.stringify(payload)` persistence doesn't limit field order | `todo` |
| 25 | `src/platform/five-plane-interface/webhook/index.ts:255` `Buffer.from(normalizedSignature,"hex")` accepts non-hex and truncates, length comparison masks pollution | `todo` |
| 26 | `src/platform/five-plane-interface/webhook/index.ts:60-61` replay cache TTL/capacity are module constants, cannot be configured per tenant/endpoint | `todo` |
| 27 | `tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337` 6 occurrences of `host:"0.0.0.0"` listening on all NICs | `todo` |
| 28 | `api-server-env.ts` reads `AA_API_KEYS_JSON` inconsistent with documented `AA_API_KEYS` | `todo` |

## src/platform/five-plane-control-plane

| # | Issue | Status |
|---|-------|--------|
| 29 | Control plane deeply accesses state-evidence plane SQLite private paths (`approval/config/incident-control` in multiple places) | `todo` |
| 30 | Execution plane ~40 imports of control plane IAM/config implementation details, not through contract/policy ports | `todo` |
| 31 | `iam/field-encryption.ts:10,24` PBKDF2 only 100k iterations + synchronous `pbkdf2Sync`, below OWASP 600k and blocks event loop | `todo` |
| 32 | `iam/session-management.ts:164-167` `hashToken` uses bare `sha256(token)`, file comment admits should use HMAC | `todo` |
| 33 | `tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355` `Date.now()-90000000` comment says "25h" actually 25h00m00s, equals TTL causing jitter | `todo` |
| 34 | `tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096` `delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION` has no pre-capture | `todo` |
| 35 | `src/platform/five-plane-control-plane/policy-center/index.ts:282` emergency mode `requiresApproval=subjectType!=="system"`, `system` principal bypasses break-glass approval | `todo` |
| 36 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132` `getFieldValue` accesses along `.` path, doesn't reject `__proto__/constructor/prototype` | `todo` |
| 37 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450` `JSON.stringify(config, Object.keys(config).sort())` misuses replacer as key whitelist, nested fields get clipped | `todo` |
| 38 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457` 32-bit non-cryptographic hash for config checksum, collision probability is significant | `todo` |
| 39 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768` `startDailyRotationSchedulers` entry clears then adds, re-entry loses in-flight sweep | `todo` |
| 40 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776` `runRotationSweep("initial")` and `setInterval` start synchronously, may concurrently run same sweep | `todo` |
| 41 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364` double base64 decode assumes KMS always returns base64 | `todo` |
| 42 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256` GCP secret return value not validated for base64 | `todo` |
| 43 | `src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266` `runbook executor` only simulates, production path not connected | `todo` |
| 44 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts` config hash only takes top-level keys, not recursive | `todo` |
| 45 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:46` `Buffer.from(value,"base64")` decodes directly, doesn't reject pure utf-8 input | `todo` |
| 46 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128` arbitrary string parts index into `Function.prototype` etc, false positive/negative matching | `todo` |
| 47 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815` `requireRegistryRecord` error path `details` repeats `secretRef` not sanitized | `todo` |
| 48 | `tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66` `/tmp/test-file-${Date.now()}` goes outside `sandbox-root` test matrix | `todo` |
| 49 | `startup-env-schema.ts:376` JWT secret `undefined` goes to default-allow, can issue tokens without secret | `todo` |
| 50 | `api-client.ts` `Retry-After` directly `parseInt`, doesn't recognize HTTP-date | `todo` |
| 51 | `test:secret-providers` path is wrong (missing one `platform/` level) | `todo` |
| 52 | `auto-stop-loss-service.ts:789`, `config-hot-reload-service.ts:268,506`, `cache-invalidation-broadcast.ts:68`, `durable-event-bus.ts:710,916,1007`, `call-governance.ts:609`, `external-secret-provider.ts:226` multiple places `void promise fire-and-forget` without `.catch` | `todo` |
| 53 | `aws-kms-http-secret-provider.ts:211`, `gcp-secret-manager-http-secret-provider.ts:103`, `vault-http-secret-provider.ts:132` `setTimeout(...controller.abort)` not `.unref()` and some success paths miss `clearTimeout` | `todo` |
| 54 | `secret-management-service.ts:765-768` `startDailyRotationSchedulers` silently `clear` existing schedulers, external handles invalidated | `todo` |
| 55 | `client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` rewrites readonly field via cast | `todo` |
| 56 | `client-sdk/api-client.ts:368` `connect()` at SSE bootstrap is `fire-and-forget`, initial fetch rejection not handled | `todo` |

## src/platform/five-plane-orchestration

| # | Issue | Status |
|---|-------|--------|
| 57 | `src/platform/agent-delegation/index.ts` and `five-plane-orchestration/agent-delegation/*` form dual entry points | `todo` |
| 58 | `config/quality/test-exclusion-allowlist.json` lists `tests/integration/platform/orchestration/**` (renamed to `five-plane-orchestration`), never matches | `todo` |
| 59 | `oapeflir/runtime-execute-bridge.ts:223-235` when `executor` is `null` synthesizes fake `succeeded + validationPassed:true`, stub silently returns | `todo` |
| 60 | `oapeflir/runtime-execute-bridge.ts:182` `defaultModelId="MiniMax-M2.7"` hardcodes specific vendor model into framework code | `todo` |
| 61 | `oapeflir/runtime-execute-bridge.ts:194,264,316` `createdAt: Date.now()` numeric vs `Plan.createdAt: string` type drift, relies on `as Plan cast` only | `todo` |
| 62 | `oapeflir/handoff-model.ts:55-57` `Math.ceil(JSON.stringify(value).length/4)` token estimation distorted for CJK/multi-byte | `todo` |
| 63 | `oapeflir/handoff-model.ts:88-135` compression silently drops `historyRefs/toolCallRecords/planDelta/blockers/artifactRefs`, no drop ledger | `todo` |
| 64 | `oapeflir/oapeflir-loop-core.ts:382`, `oapeflir-loop-support.ts:324`, `stage-transition-fsm.ts:189-223` multiple places `Date.now()` self-generated timestamps, clock rollback makes non-monotonic | `todo` |
| 65 | `oapeflir/oapeflir-loop-core.ts:299` writes `process.{version,platform,cwd()}` to `environmentContext` for evidence, leaks host fingerprint | `todo` |
| 66 | `docs_zh/contracts/oapeflir_loop_contract.md` exists but README doesn't list it; ADR-016 references OAPEFLIR also doesn't link | `todo` |
| 67 | `scripts/ci/mutation-critical-tests.sh:13` references `tests/unit/platform/orchestration/oapeflir/...` but authoritative path is `five-plane-orchestration`, silent zero coverage after rename | `todo` |
| 68 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275` `super("mock://runtime","local-simulated")` defaults to mock runtime | `todo` |
| 69 | `scripts/ci/audit-oapeflir-terminology.mjs` only scans 8-letter spelling, misses Chinese terminology drift | `todo` |

## src/platform/five-plane-execution

| # | Issue | Status |
|---|-------|--------|
| 70 | `plugin-executor.service.ts:482` explicitly throws `action_not_implemented`, missing hook → 500 | `todo` |
| 71 | `five-plane-execution/state-transition/*` re-exported via `core/runtime/index.ts` goes out of bounds | `todo` |
| 72 | `tests/unit/runtime/`, `platform/execution/`, `platform/five-plane-execution/` parallel duplicates | `todo` |
| 73 | `plugin-executor.service.ts:106` `enforceSignatures` defaults to `false`, unsafe fail-open when env not set | `todo` |
| 74 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90` `SELECT/DELETE/INSERT` not in transaction, TTL expiry cleanup TOCTOU; concurrent steal may delete just-acquired lock | `todo` |
| 75 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37` `distributed_lock_fencing_tokens` only `INSERT` auto-increment, never cleaned, unbounded growth | `todo` |
| 76 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54` `ttlMs` lacks lower bound validation, negative/0 directly written | `todo` |
| 77 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148` `forceSteal` has no pre-authorization/reason whitelist, any caller can steal lock | `todo` |
| 78 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140` `forceSteal` hardcodes `ttlMs=30000` instead of following original lock config | `todo` |
| 79 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112` `release owner` mismatch silently returns `false` no audit event | `todo` |
| 80 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573` `dequeueAsync` has multiple `await` without atomicity, two workers can simultaneously take same `jobId` | `todo` |
| 81 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569` `hincrby attempts` before state confirmation, state reset causes count misalignment | `todo` |
| 82 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568` state not `waiting` causes `zrem` returning `null`, silently drops task | `todo` |
| 83 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596` only ack path `expire`s task key, nack/failed tasks have no TTL key accumulation | `todo` |
| 84 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609` `nack` requeue without backoff, immediately re-pulled by same worker | `todo` |
| 85 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672` `retryJobAsync` forcibly sets `attempts=0` bypassing `maxAttempts` budget | `todo` |
| 86 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600` `nack` closure references stale `jobData.priority` | `todo` |
| 87 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695` `purgeAsync` does individual `hgetall` per ID, N+1 RTT | `todo` |
| 88 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317` first `arrayBuffer()` full read then size check, oversized response can OOM | `todo` |
| 89 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324` `JSON.parse` has no `try/catch`, malicious JSON throws directly | `todo` |
| 90 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298` `Content-Type` case-sensitive comparison, double writes header when caller uses `Content-type` | `todo` |
| 91 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678` `simulateStepExecution` only `setTimeout 50ms`, doesn't actually execute any action | `todo` |
| 92 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733` `simulateRollback` is no-op, rollback always succeeds | `todo` |
| 93 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669` `findStepDefinition` iterates all executions `O(N·M)` | `todo` |
| 94 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642` `step.output` hardcoded `"Step X completed successfully"` overwrites real output | `todo` |
| 95 | `src/platform/five-plane-execution/compensation-manager.ts:312-319` `reverseExternalEffect` directly `return true`, external side effects not reversed | `todo` |
| 96 | `src/platform/five-plane-execution/compensation-manager.ts:326-333` `executeCompensateAction` stub always succeeds | `todo` |
| 97 | `src/platform/five-plane-execution/compensation-manager.ts:339-344` `sendCompensationNotification` empty body, notification never sent | `todo` |
| 98 | `src/platform/five-plane-execution/compensation-manager.ts:350-358` `executeRollback` stub, rollback contract not implemented | `todo` |
| 99 | `src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6` only `re-export`, should be completely removed per `AGENTS` | `todo` |
| 100 | `src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31` compatibility file maintains redundant naming | `todo` |
| 101 | `src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts` and `phase1b-utils.ts` are `phase1b` compatibility remnants | `todo` |
| 102 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` and `runtime-recovery-service-root.ts` are four pairs of `*-service/*-service-root` twins | `todo` |
| 103 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` 581 lines single file violates `AGENTS small modules` principle | `todo` |
| 104 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` 814 lines same issue | `todo` |
| 105 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47` uses CJS `require` backwards in ESM | `todo` |
| 106 | `src/platform/five-plane-execution/distributed-lock/locking-support.ts:12` `require("postgres")` synchronous load, optional dependency coupling | `todo` |
| 107 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68` `createRequire+require("ioredis")` at construction time, missing dependency crashes startup | `todo` |
| 108 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226` `lock id` uses `Date.now()` concatenated string, millisecond-level conflicts can reuse | `todo` |
| 109 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47` after `createRequire` dynamically `require`s sibling `.js`, module graph cannot be statically analyzed | `todo` |
| 110 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts` 9-line dead shim | `todo` |
| 111 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts` 10-line dead shim | `todo` |
| 112 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts` 21-line lightweight wrapper overlaps with `manager/service` | `todo` |
| 113 | `src/platform/five-plane-execution/execution-engine/runtime-context.ts` 1-line shim | `todo` |
| 114 | `src/platform/five-plane-execution/execution-engine/single-task-execution.ts` 7-line `re-export shim` | `todo` |
| 115 | `src/platform/five-plane-execution/distributed-lock/index.ts` 1-line barrel | `todo` |
| 116 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562` takes highest score (newest) violates FIFO intuition, documentation doesn't explain | `todo` |
| 117 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693` checkpoint state directly references original `entries` array, subsequent mutate pollutes historical checkpoint | `todo` |
| 118 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713` `performRollback` when `rollbackHistory` empty marks all `rolled_back`, doesn't distinguish unexecuted steps | `todo` |
| 119 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288` `AbortController.unref` makes timeout not block exit, but after abort `await` cleanup not called, races with ESM top-level | `todo` |
| 120 | `src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts` and `runtime-recovery-service.ts` only differ in import path and few variable names, constitute actual branch | `todo` |
| 121 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121` `Math.min(ttlMs,MAX_LOCK_TTL_MS)` three places duplicate, constant `600_000ms` hardcoded | `todo` |
| 122 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127` `extend` uses `MIN(ttl_ms+?, MAX)` cumulative instead of reset from now, TTL always slides toward upper limit | `todo` |
| 123 | `pg-advisory-lock-adapter.ts` has no `try/finally` after acquiring lock, throw path leaks lock | `todo` |
| 124 | `pg-advisory-lock-adapter.ts:34-43` custom FNV-1a truncated to 63 bits, collisions silently accepted | `todo` |
| 125 | `pg-advisory-lock-adapter.ts:71-83` `extend()` only changes in-memory map, doesn't refresh PG side advisory lock TTL | `todo` |
| 126 | `pg-advisory-lock-adapter.ts:107-115` catch-all masks transient PG errors as `"lock taken"` | `todo` |
| 127 | `pg-advisory-lock-adapter.ts:101` `Number(result.fencing_token)` exceeds `2^53` precision loss | `todo` |

## src/platform/five-plane-state-evidence

| # | Issue | Status |
|---|-------|--------|
| 128 | `CLAUDE.md:50` references non-existent `state-evidence/artifacts/` directory | `todo` |
| 129 | Multiple contracts/reviews point to non-existent `state-evidence/artifacts/` directory | `todo` |
| 130 | `runtime-truth-repository.ts:741`, `projection-rebuild-service.ts:429`, `memory-gateway/index.ts:248`, `plan-builder.ts:193` use non-normalized `JSON.stringify` for fingerprinting, key order changes cause false diff | `todo` |
| 131 | `tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261` uses `Date.now()-90000` for aging assertion, clock drift causes jitter | `todo` |
| 132 | `tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts` vs `durable-event-bus-integration.test.ts` naming inconsistency, suspected double run | `todo` |
| 133 | `package.json:223-234` `test:receipt-store/tool-gateway/memory-gateway/sandbox-provider` have no aggregator, only operator entry points | `todo` |
| 134 | `five-plane-state-evidence/index.ts:1` `re-export` non-existent `./artifacts/index.js`, import throws immediately | `todo` |
| 135 | `truth/sqlite/repositories/operations-repository.ts:898` `listRuntimeRecoveryRecords` directly concatenates caller `whereClause` into SQL, only filters `;\\|--\\|/*` still allows `OR 1=1/subqueries` | `todo` |
| 136 | `truth/sqlite/repositories/event-repository.ts:788-828` `insertEvent` and outbox `INSERT` double prepared without unified transaction, breaks outbox atomicity | `todo` |
| 137 | `truth/sqlite/repositories/task-repository.ts:96-125` `listTasks cursor` only by `updated_at`, no `id tiebreaker`, pagination may lose rows/dead loop | `todo` |
| 138 | `truth/sqlite/repositories/tenant-repository.ts:203-204` `listAll` uses `[...Map.values()].slice` without stable sort, cross-page results resort | `todo` |
| 139 | `truth/sqlite/repositories/release-repository.ts:611,632,654` `listEnterprise*` only `limit=20`, no cursor/offset/tenant filtering | `todo` |
| 140 | `truth/sqlite/repositories/intelligence-repository.ts:350` `listIntelBriefs(limit=20)` no cursor, silently truncated | `todo` |
| 141 | `truth/sqlite/repositories/organization-repository.ts:273` `listOrganizationRecords(limit=50)` no tenant filtering, cross-tenant leak | `todo` |
| 142 | `truth/sqlite/repositories/worker-repository.ts:63` vs `worker-snapshot-repository.ts:276` `listCoordinatorInstanceSnapshots` dual implementation schema drift | `todo` |
| 143 | `state-evidence/dlq/index.ts:110-113` `enqueue` uses linear `listByConsumer` for deduplication, `O(n)` per insert, no index | `todo` |
| 144 | `state-evidence/dlq/index.ts:282-284` `runDueRetries` empty `catch {}` swallows errors without logger/telemetry/backoff | `todo` |
| 145 | `state-evidence/dlq/index.ts:99` `maxRetries=5` hardcoded, conflicts with `dlq-service.ts retry policy` | `todo` |
| 146 | `state-evidence/dlq/index.ts:6-23` `DeadLetterRecord` and `contracts/types/domain/session-types.ts EventDeadLetterRecord schema` dual sources | `todo` |
| 147 | `state-evidence/incident/index.ts:127-161` `listIncidents/listIncidentsPaginated` full `Map.values() + sort + findIndex`, cursor invalidates under concurrent inserts | `todo` |
| 148 | `state-evidence/incident/index.ts:35` `linkedEvidenceRefs: input.linkedEvidenceRefs ?? []` directly stores caller reference, external mutation pollutes internal | `todo` |
| 149 | `state-evidence/incident/index.ts:117-121` `resolve()` accepts any current state, bypasses `triaged→mitigating→reviewed→resolved` FSM | `todo` |
| 150 | `state-evidence/incident/index.ts:22` `nextIncidentOrder` monotonic ID publicly predictable and enumerable | `todo` |
| 151 | `state-evidence/audit/index.ts:21,29` `AuditTrailService.records` in-memory array with no rotation/persistence, long-running process will OOM | `todo` |
| 152 | `projections/projection-rebuild-service.ts:265-266,278-294` `JSON.stringify` comparison non-normalized key order; cutover has no optimistic concurrency token | `todo` |
| 153 | `checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` doesn't throw, malicious payload silently truncated then into gunzip | `todo` |
| 154 | `checkpoints/checkpoint-envelope.ts:147-149` `JSON.stringify` large object first fully materialized then size check, OOM before guard | `todo` |
| 155 | `checkpoints/checkpoint-gc-service.ts:548-560` `acquireRunLock` doesn't record PID/host, crashed residual lock and live lock indistinguishable | `todo` |
| 156 | `knowledge/keyword-index.ts:22-30` `upsert` doesn't clear previous keywords reverse index, stale postings remain | `todo` |
| 157 | `knowledge/keyword-index.ts:32-47` `query` rescans `countOccurrences` every time, no caching | `todo` |
| 158 | `knowledge/keyword-index.ts:1-53` missing `delete(chunkId)` API, chunks live forever | `todo` |
| 159 | `memory-gateway/index.ts:248-258` `projectionHash` uses `JSON.stringify([...input.memoryIds])` preserving caller order, same set different order produces different hash | `todo` |
| 160 | `memory-gateway/index.ts:280-298` memory layer mapping `L1/L2/L4/L6 round-trip` lossy, not asserted | `todo` |
| 161 | `memory-gateway/index.ts:328` `Number.isFinite(Number(metadata.version))` accepts `1e308`, missing integer/range validation | `todo` |
| 162 | `state-evidence/memory/trust-level-service.ts:245-248` `MAX=500/TTL=24h/EVICT=60s` hardcoded without config | `todo` |
| 163 | `state-evidence/memory/trust-level-service.ts:280-289` each eviction `[...entries].sort O(n log n)`, includes non-null assertion swallowing OOB | `todo` |
| 164 | `state-evidence/memory/trust-level-service.ts:384-385` `includes("TODO"/"FIXME")` literal string filtering, normal text falsely flagged | `todo` |
| 165 | `truth/sqlite/repositories/prompt-bundle-repository.ts:164-332` 8 places `JSON.stringify(input.*)` column writes without zod validation | `todo` |
| 166 | `truth/sqlite/repositories/billing-repository.ts:168` `Number(result.changes)` BigInt `> 2^53` silently truncated | `todo` |
| 167 | `truth/sqlite/repositories/worker-snapshot-repository.ts:249` same query switches `ORDER BY` by filter, cursor across filter invalidates | `todo` |
| 168 | `state-evidence/events/event-ops-service.ts:216-221` `setTimeout(...) reject` timer not `unref`; `Promise.race` winner doesn't `clearTimeout` | `todo` |
| 169 | `state-evidence/events/durable-event-bus.ts:9` different instantiation points have `retentionLimit:500/100` inconsistent | `todo` |
| 170 | `tests/integration/platform/state-evidence/events/transactional-event-appender` vs `event-repository.ts:788-828` outbox split two prepared calls, under SQLite WAL autocommit observer sees partial state | `todo` |
| 171 | `tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178` `createdAt:new Date().toISOString()` uses local clock, different TZ replay metadata non-deterministic | `todo` |
| 172 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138` `PRAGMA journal_mode=WAL` doesn't assert return value, NFS etc silently falls back to delete | `todo` |
| 173 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134` `busy_timeout` allows 0, transient `SQLITE_BUSY` conflicts with concurrency | `todo` |
| 174 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283` `Object.values(row)` relies on `wal_checkpoint` column order, missing key-name destructuring | `todo` |
| 175 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350` `close()` doesn't check `wal_checkpoint busy>0`, unpersisted frame closed | `todo` |
| 176 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449` recognizes `BUSY` via regex `database is locked\\|busy`, localization/errno change invalidates | `todo` |
| 177 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340` `healthCheck` marked `async` actually only synchronous transaction, misleads caller | `todo` |
| 178 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465` after `applyCompatibleColumnMigrationIfKnown` hits, skips `migration.sql`, index/constraint changes silently lost | `todo` |
| 179 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233` `fetch` has no `AbortController/timeout` | `todo` |
| 180 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251` error body directly concatenated into `Error message`, potential log injection | `todo` |
| 181 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+` `response.json()` has no `try/catch` | `todo` |
| 182 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144` return `index` range/duplicates not validated, post-order mapping assumes one-to-one | `todo` |
| 183 | `src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` doesn't validate length/MIME, corrupted payload decodes to empty buffer without error | `todo` |
| 184 | `src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385` uses `content.includes("TODO/FIXME")` as trust level downgrade basis, obvious false positive | `todo` |
| 185 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330` `healthCheck` does `CREATE/DROP TEMP TABLE` inside transaction, rollback leaves TEMP handle | `todo` |
| 186 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290` `checkpointWal` doesn't distinguish `busy>0` vs `frames=0`, ops cannot identify real bottleneck | `todo` |
| 187 | `tests/integration/platform/state-evidence/dlq-persistence.test.ts:464` `/tmp/dlq-persistence-test-${Date.now()}.db` not portable to Windows and not cleaned in finally | `todo` |
| 188 | `tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17` `/tmp/aa-sandbox/ktest_${suffix}_${Date.now()}` concentrated pollution | `todo` |
| 189 | `tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113` two places `/tmp/aa-sandbox/...` not cleaned | `todo` |
| 190 | `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts` 10MB threshold same issue and doesn't distinguish `RSS/heapUsed` | `todo` |
| 191 | `dashboard-projection-service.ts:110` `system.health.changed` not registered to `TypedEventType` | `todo` |
| 192 | `migrate-sqlite-to-pg.ts` column/table names directly concatenated into SQL, no whitelist (injection risk) | `todo` |
| 193 | `idempotency-key-storage.ts` `${this.tableName}` directly concatenated into SQL, not validated at construction | `todo` |
| 194 | `semantic-vector-store.ts` `process.env[name]` where `name` comes from config, can read any env | `todo` |
| 195 | `checkpoint-gc-service.ts` `fs.stat→fs.unlink` TOCTOU window | `todo` |
| 196 | `shadow-snapshot-service.ts` `lstat→rename` has symlink swap window between them | `todo` |
| 197 | `sqlite-database-wrapper.ts:94-114` savepoint name directly concatenated into `exec`, future caller can inject | `todo` |
| 198 | `sqlite-database.ts:143` `PRAGMA busy_timeout = ${this.busyTimeoutMs}` concatenated into SQL, `busyTimeoutMs` not integer validated | `todo` |
| 199 | In `pg-advisory-lock-adapter.ts` `Number(result.fencing_token)`, `sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid)` exceeds `2^53` precision loss | `todo` |
| 200 | `checkpoint-gc-service.ts:171,557`, `learning-object-model.ts:180,184`, `risk-register.ts:87,110`, `invariant-registry.ts:137,165,180`, `responsibility-boundary.ts:158-308`, `admin-config-service.ts:66`, `outbox-repository.ts:117`, `memory-layer-model.ts:214,549`, `graphql-adapter-service.ts:294`, `conversation-template-service.ts:408`, `approval-policy-engine/version-manager.ts:111`, `stable-evidence-bundle-support.ts:612,616,732`, `dlq-service.ts:238`, `knowledge-snapshot-store.ts:25-48`, `semantic-vector-validation.ts:276`, `tool-gateway/index.ts:150,160`, `idempotency-key-storage.ts:310,338,341`, `cors.ts:49-68`, `reliability/timeout.ts:45,54` many places throw bare `Error` instead of structured `AppError/ValidationError` | `todo` |
| 201 | `.gitignore` globally `*.db-shm/*.db-wal` don't exist, sqlite WAL residuals can be committed | `todo` |

## src/platform/shared

| # | Issue | Status |
|---|-------|--------|
| 202 | `src/platform/stability/` and `src/platform/shared/stability/` parallel same-name directories have diverged implementations | `todo` |
| 203 | `src/platform/shared/reliability/`, `shared/stability/reliability/`, `stability/reliability/` three places reliability implementation duplicated | `todo` |
| 204 | `src/platform/shared/observability/structured-logger.ts:484-491` each fsync log `openSync+appendFileSync+fsyncSync+closeSync` serial sync IO | `todo` |
| 205 | `src/platform/shared/observability/structured-logger.ts:153,180` `sinkBaseDir=process.cwd()`, semantics drift after runtime `chdir` | `todo` |
| 206 | `src/platform/shared/observability/structured-logger.ts:194` `mkdirSync` no error handling, insufficient permissions causes configure to throw | `todo` |
| 207 | `src/platform/shared/observability/structured-logger.ts:262` when `retentionLimit=0` buffer length is 0, all logs silently discarded | `todo` |
| 208 | `src/platform/shared/outbox/outbox-poller-service.ts:193-197` `retryCount>=maxRetries` only `failed++;continue`, never sends to DLQ | `todo` |
| 209 | `src/platform/shared/outbox/outbox-poller-service.ts:188-217` `for-await` serial processing, no concurrent batch publish | `todo` |
| 210 | `src/platform/shared/observability/otel-tracer.ts` and `otel-bootstrap.ts` each `loadOtelApi/loadOtelModules`, OTel loading has two paths | `todo` |
| 211 | `src/platform/shared/observability/structured-logger.ts:153` `sinkBaseDir=process.cwd()` after multiple worker forks each holds own cwd, paths inconsistent | `todo` |
| 212 | `tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145` 5 places `/tmp/...` not portable | `todo` |
| 213 | `tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30` `/tmp/${caseId}.backup.db` cross-case same name, overwrite each other | `todo` |
| 214 | `graceful-shutdown.ts` `setImmediate(()=>process.exit())` doesn't flush stdio | `todo` |
| 215 | `slo-alerting-channels.ts` does synchronous blocking I/O inside `queueMicrotask` | `todo` |
| 216 | `graceful-shutdown.ts:122` `void this.handleSignal(signal)` without `.catch`; shutdown errors become unhandled rejection | `todo` |

## src/platform/stability

| # | Issue | Status |
|---|-------|--------|
| 217 | `src/platform/stability/timeout.ts:82` success path doesn't `clearTimeout`, `setTimeout` handle leaks | `todo` |
| 218 | `src/platform/stability/timeout.ts cancel()` only cancels timer, doesn't pass `AbortSignal` to wrapped function | `todo` |
| 219 | `src/platform/stability/retry.ts` and `stability/reliability/retry.ts` two copies coexisting with divergent strategies | `todo` |

## src/platform/prompt-engine

| # | Issue | Status |
|---|-------|--------|
| 220 | `ha-repository-postgres.ts:22`, `coordinator-load-balancing-service.ts:78`, `prompt-engine/registry/index.ts:123`, `tight-loop-detector.ts:82,95`, `loop-detection.ts:97`, `semantic-embedding.ts:108`, `structured-logger.ts:851`, `prompt-injection-guard.ts:543`, `profile-home.ts:31` many places `sha256` truncated to 32-64 bits as identity/cache key, high collision probability | `todo` |
| 221 | `prompt-engine/registry/index.ts:114` `listVersions` uses `localeCompare` sorting, `"10"` lexicographically before `"2"` | `todo` |
| 222 | `prompt-engine/registry/index.ts:117-119` `listTemplates()` full `flat-map` without pagination | `todo` |
| 223 | `prompt-engine/registry/index.ts:81-86` `version_conflict` check then two-phase write has no rollback, partial failure leaves orphaned mapping | `todo` |
| 224 | `prompt-engine/eval/quality-config-loader.ts:24-35` schema missing `.refine` for `qualityScoreWeights` sum≈1 and `completeMinScore>approvalRequiredScore` | `todo` |
| 225 | `prompt-engine/eval/quality-config-loader.ts:101-105` zod validation failure swallowed as generic `throw`, unstructured `AppError` | `todo` |
| 226 | `prompt-engine/eval/llm-eval-service.ts:633` `logger.warn` contains raw `suite.cases payload`, PII/prompt content leaked | `todo` |
| 227 | `prompt-engine/eval/prompt-model-policy-governance-service.ts:584` `JSON.parse(release.metadata)` without zod validation | `todo` |
| 228 | `prompt-registry/index.ts:1-30` 30 lines pure re-export shim, violates single source of truth | `todo` |
| 229 | `prompt-engine/conversation-template-config-loader.ts:35` `JSON.parse(content)` no size limit, config file can OOM | `todo` |
| 230 | `template-registry/index.ts` two places `@ts-expect-error` | `todo` |

## src/platform/contracts & types

| # | Issue | Status |
|---|-------|--------|
| 231 | `client-sdk/api-client.ts:984-992` `declare module ".../executable-contracts/index.js"` module augmentation globally pollutes `ContractEnvelope.principal` | `todo` |
| 232 | Entire repo `assert.ok(true)` 193 occurrences (`tests/e2e/sdk/sdk-e2e.test.ts:388`, `tests/unit/platform/interface/ingress/*` many places, `vcr-replay-fixture.test.ts:338`, `contracts/types/domain/index.test.ts:32`, `redis-lock-adapter.test.ts:1079,1082` etc), systematic placeholder | `todo` |
| 233 | `contracts/types/responsibility-boundary.ts:316-326` puts `GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE` singleton runtime state inside a "types" file | `todo` |
| 234 | `contracts/types/responsibility-boundary.ts:302,306` hot path calls `new Set` every invocation | `todo` |
| 235 | `contracts/types/domain/billing-types.ts:68` `summaryJson:string` opaque blob without zod | `todo` |
| 236 | `contracts/types/domain/billing-types.ts:63,95,177` `currency:"USD"` three places literal, type prohibits multi-currency | `todo` |
| 237 | `contracts/types/domain/billing-types.ts:122-129` `executionId/stepId` marked `@deprecated` still required, no removal plan | `todo` |
| 238 | `contracts/types/domain/index.ts:1-249` 100+ symbols hand-maintained, not `export *`, new types inevitably cause drift | `todo` |
| 239 | `contracts/types/index.ts:191` jumps into `executable-contracts/index.js` `re-export`, bypasses domain namespace | `todo` |
| 240 | `contracts/mission/{playbook,index}.ts:373/357` two `stableStringify` independent implementations, may drift | `todo` |
| 241 | `mission/index.ts` 1637 lines single file too large | `todo` |
| 242 | `data-classification-service.ts:680`, `network-egress-audit.ts:335`, `auto-stop-loss-service.ts:65-71`, `panic-propagation-service.ts:119-123`, `war-room-coordinator.ts:93-94`, `policy-engine.ts:83`, `takeover-escalation-manager.ts:46,49`, `approval-flow-engine.ts:571`, `approval-policy-engine/version-manager.ts:443`, `mission/index.ts:685`, `config-audit-service.ts:319,824`, `provider-health-tracker.ts:55`, `task-timeline-service.ts:181` many places `push`-style memory unbounded growth | `todo` |
