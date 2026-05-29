## src/platform/five-plane-interface

| # | Issue | Status |
|---|-------|--------|
| 1 | `iam/audit-event-integrity.ts:43-44`、`distributed-rate-limiter.ts:47`、`request-deduplication.ts:82`、`http-api-server.ts:119-122`、`http-server/health-routes.ts:19-21` 库内directly读 `process.env.NODE_ENV`/constant，breaks DI and testing | `todo` |
| 2 | `stryker.config.mjs:30-33` `mutate:` only 9 个文件集中在 `http-server/`，coverage far narrower than策略文档声明 | `todo` |
| 3 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` user `cursor JSON.parse` no `try/catch`，malicious cursor → 500 | `todo` |
| 4 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:103-104` module-level `InMemoryHarnessRunStore` singleton，跨request共享、重启丢data | `todo` |
| 5 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:159-162` `/events` endpoint always returns empty array，not connected to Truth | `todo` |
| 6 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:209,217-218,228` `body.riskLevel/status` directly `as` 强转no枚举校验 | `todo` |
| 7 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:273-279` `PATCH` 把 `body.status/terminalReason` directly写storage，no whitelist | `todo` |
| 8 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:76-89` `list` 每request `Array.from+sort O(n log n)` full re-sort | `todo` |
| 9 | `src/platform/five-plane-interface/webhook/index.ts:73-74` `acceptedEnvelopes/failureCounts` unbounded growth | `todo` |
| 10 | `src/platform/five-plane-interface/webhook/index.ts:72` `envelopesByIdempotencyKey` 缺 TTL/upper limit | `todo` |
| 11 | `src/platform/five-plane-interface/webhook/index.ts:111-120` 事件class型/允许列table校验先于签名校验，未签名探测can enumerate `allowedEventTypes` | `todo` |
| 12 | `src/platform/five-plane-interface/webhook/index.ts:207-209` failed计数hardcodes 50，auto-disable has no re-enable path | `todo` |
| 13 | `src/platform/five-plane-interface/webhook/index.ts:200-211` `recordDeliveryFailure` directly mutate 注册对象 `enabled`，breaking immutable contract | `todo` |
| 14 | `src/platform/five-plane-interface/webhook/index.ts:182-184` `rollbackAcceptedEnvelope findIndex` linear search | `todo` |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:296-315` `parseWebhookPayload` doesn't limit body size，exceeds大 JSON blocks event loop | `todo` |
| 16 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` 先 `get` 后 `set` non-atomic，concurrent同 `Idempotency-Key` double write | `todo` |
| 17 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:206-217` `in-flight` 分支返回 `allowed:true` 但同时附 409，semantic conflict | `todo` |
| 18 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` 错误消息回显user `idempotencyKey/method`，response注入风险 | `todo` |
| 19 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:222-234` cacheresponse `JSON.parse` has no size limit | `todo` |
| 20 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:73` user `requestJson JSON.parse` has no size limit | `todo` |
| 21 | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts:344` `dashboard requestJson JSON.parse` 同上 | `todo` |
| 22 | `src/platform/five-plane-interface/api/http-server/utils.ts:339,344` 游标 base64url 编解码no `try/catch`、no integrity signature，can be tampered | `todo` |
| 23 | `src/platform/five-plane-interface/api/http-server/gateway-routes.ts:125` `body` 非字符串时 `JSON.stringify` 后转发，丢字节序签名failed | `todo` |
| 24 | `src/platform/five-plane-interface/api/http-server/task-routes.ts:340,357` `JSON.stringify(payload)` persistence doesn't limit field order | `todo` |
| 25 | `src/platform/five-plane-interface/webhook/index.ts:255` `Buffer.from(normalizedSignature,"hex")` accepts non-hex and truncates，长度比对掩盖污染 | `todo` |
| 26 | `src/platform/five-plane-interface/webhook/index.ts:60-61` 重放cache TTL/容量都is module constant，不可由租户/endpoint configure | `todo` |
| 27 | `tests/integration/platform/interface/api/grpc-adapter-service-integration.test.ts:24,47,145,178,207,337` 6 occurrences `host:"0.0.0.0"` listening on all NICs | `todo` |
| 28 | `api-server-env.ts` 读 `AA_API_KEYS_JSON` vs文档 `AA_API_KEYS` inconsistent | `todo` |

## src/platform/five-plane-control-plane

| # | Issue | Status |
|---|-------|--------|
| 29 | Control Plane深入Status-Evidence Plane SQLite private paths（`approval/config/incident-control` 多occurrences） | `todo` |
| 30 | Execution Plane约 40 occurrences import Control Plane IAM/configureimplementation details，未via contract/policy port | `todo` |
| 31 | `iam/field-encryption.ts:10,24` PBKDF2 only 100k iterations + synchronous `pbkdf2Sync`，below OWASP 600k and blocks event loop | `todo` |
| 32 | `iam/session-management.ts:164-167` `hashToken` uses bare `sha256(token)`，file comment admits应用 HMAC | `todo` |
| 33 | `tests/integration/platform/control-plane/config-center/config-rollout-service-integration.test.ts:317,332,355` `Date.now()-90000000` comment `"25h"` actually 25h00m00s，equals TTL causing jitter | `todo` |
| 34 | `tests/integration/platform/control-plane/incident-control/doctor.test.ts:1096` `delete process.env.AA_EXPECTED_PROTECTED_GOVERNANCE_VERSION` has no pre-capture | `todo` |
| 35 | `src/platform/five-plane-control-plane/policy-center/index.ts:282` emergency mode `requiresApproval=subjectType!=="system"`，`system` principal bypasses break-glass approval | `todo` |
| 36 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132` `getFieldValue` accesses along `.` path，doesn't reject `__proto__/constructor/prototype` | `todo` |
| 37 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:450` `JSON.stringify(config, Object.keys(config).sort())` misuses replacer as key whitelist，nested fields get clipped | `todo` |
| 38 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:451-457` 32-bit 非密码学哈希做configure checksum，collision probability is significant | `todo` |
| 39 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:765-768` `startDailyRotationSchedulers` entry clears then adds，re-entry loses in-flight sweep | `todo` |
| 40 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:770-776` `runRotationSweep("initial")` vs `setInterval` synchronous起，可能concurrent同一 sweep | `todo` |
| 41 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:358-364` double base64 decode assumes KMS always returns base64 | `todo` |
| 42 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:256` GCP secret 返回值未校验isno base64 | `todo` |
| 43 | `src/platform/five-plane-control-plane/incident-control/runbook-executor/runbook-executor.ts:192-198,258-266` `runbook executor` only simulate，production path not connected | `todo` |
| 44 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts` configure hash only取 keys 顶层不递归 | `todo` |
| 45 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:46` `Buffer.from(value,"base64")` directly解码，doesn't reject纯 utf-8 输入 | `todo` |
| 46 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:128` arbitrary string parts index into `Function.prototype` 等成员，false positive/negative matching | `todo` |
| 47 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815` `requireRegistryRecord` error path `details` repeats `secretRef` not sanitized | `todo` |
| 48 | `tests/unit/platform/control-plane/iam/sandbox-policy-extended.test.ts:66` `/tmp/test-file-${Date.now()}` goes outside `sandbox-root` test matrix | `todo` |
| 49 | `startup-env-schema.ts:376` JWT key `undefined` goes to default-allow，缺key仍可签发 | `todo` |
| 50 | `api-client.ts` `Retry-After` directly `parseInt`，doesn't recognize HTTP-date | `todo` |
| 51 | `test:secret-providers` path is wrong（少一层 `platform/`） | `todo` |
| 52 | `auto-stop-loss-service.ts:789`、`config-hot-reload-service.ts:268,506`、`cache-invalidation-broadcast.ts:68`、`durable-event-bus.ts:710,916,1007`、`call-governance.ts:609`、`external-secret-provider.ts:226` 多occurrences `void promise fire-and-forget` no `.catch` | `todo` |
| 53 | `aws-kms-http-secret-provider.ts:211`、`gcp-secret-manager-http-secret-provider.ts:103`、`vault-http-secret-provider.ts:132` `setTimeout(...controller.abort)` 未 `.unref()` 且部分success路径漏 `clearTimeout` | `todo` |
| 54 | `secret-management-service.ts:765-768` `startDailyRotationSchedulers` 静默 `clear` existing schedulers，external handles invalidated | `todo` |
| 55 | `client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` via cast 改写 readonly 字段 | `todo` |
| 56 | `client-sdk/api-client.ts:368` `connect()` 在 SSE bootstrap occurrences `fire-and-forget`，初始 fetch rejection 未handle | `todo` |

## src/platform/five-plane-orchestration

| # | Issue | Status |
|---|-------|--------|
| 57 | `src/platform/agent-delegation/index.ts` vs `five-plane-orchestration/agent-delegation/*` form dual entry points | `todo` |
| 58 | `config/quality/test-exclusion-allowlist.json` 列 `tests/integration/platform/orchestration/**`（已重命名为 `five-plane-orchestration`），never matches | `todo` |
| 59 | `oapeflir/runtime-execute-bridge.ts:223-235` `executor` 为 `null` 时合成假 `succeeded + validationPassed:true`，stub silently returns | `todo` |
| 60 | `oapeflir/runtime-execute-bridge.ts:182` `defaultModelId="MiniMax-M2.7"` 把具体厂商模型hardcodes到框架code | `todo` |
| 61 | `oapeflir/runtime-execute-bridge.ts:194,264,316` `createdAt: Date.now()` numeric vs `Plan.createdAt: string` class型漂移，only靠 `as Plan cast` | `todo` |
| 62 | `oapeflir/handoff-model.ts:55-57` `Math.ceil(JSON.stringify(value).length/4)` token estimation distorted for CJK/multi-byte | `todo` |
| 63 | `oapeflir/handoff-model.ts:88-135` compression silently drops `historyRefs/toolCallRecords/planDelta/blockers/artifactRefs`，no drop ledger | `todo` |
| 64 | `oapeflir/oapeflir-loop-core.ts:382`、`oapeflir-loop-support.ts:324`、`stage-transition-fsm.ts:189-223` 多occurrences `Date.now()` self-generated timestamps，clock rollback makes non-monotonic | `todo` |
| 65 | `oapeflir/oapeflir-loop-core.ts:299` 把 `process.{version,platform,cwd()}` writes `environmentContext` for evidence，leaks host fingerprint | `todo` |
| 66 | `docs_zh/contracts/oapeflir_loop_contract.md` exists but `README` doesn't list；`ADR-016` references用 OAPEFLIR also doesn't link | `todo` |
| 67 | `scripts/ci/mutation-critical-tests.sh:13` references `tests/unit/platform/orchestration/oapeflir/...` 而权威路径为 `five-plane-orchestration`，silent zero coverage after rename | `todo` |
| 68 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:275` `super("mock://runtime","local-simulated")` defaults to mock runtime | `todo` |
| 69 | `scripts/ci/audit-oapeflir-terminology.mjs` only扫八字母拼写，misses Chinese terminology drift | `todo` |

## src/platform/five-plane-execution

| # | Issue | Status |
|---|-------|--------|
| 70 | `plugin-executor.service.ts:482` explicitly throws `action_not_implemented`，missing hook 500 | `todo` |
| 71 | `five-plane-execution/state-transition/*` via `core/runtime/index.ts` re-exported goes out of bounds | `todo` |
| 72 | `tests/unit/runtime/`、`platform/execution/`、`platform/five-plane-execution/` 平linesrepeats | `todo` |
| 73 | `plugin-executor.service.ts:106` `enforceSignatures` defaults to `false`，env 未设时不security fail-open | `todo` |
| 74 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:55-90` `SELECT/DELETE/INSERT` not in transaction，TTL expiry cleanup TOCTOU；concurrent夺锁可误删刚获取者 | `todo` |
| 75 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:34-37` `distributed_lock_fencing_tokens` only `INSERT` 自增、never cleaned，unbounded growth | `todo` |
| 76 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:54` `ttlMs` lacks lower bound validation，负值/0 directlywrites | `todo` |
| 77 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:135-148` `forceSteal` no前置authorization/原因白名单，任意call即可夺锁 | `todo` |
| 78 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:140` `forceSteal` hardcodes `ttlMs=30000` 而非accesses along用原锁configure | `todo` |
| 79 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:107-112` `release owner` 不匹配时静默返回 `false` no审计事件 | `todo` |
| 80 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:549-573` `dequeueAsync` 多 `await` 间no原子性，two workers can simultaneously take same `jobId` | `todo` |
| 81 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:569` Status确认前 `hincrby attempts`，Status重置导致计数错位 | `todo` |
| 82 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:566-568` Status非 `waiting` 即 `zrem` 返回 `null` silently drops task | `todo` |
| 83 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:592-596` only ack 路径 `expire` task key，`nack`/failed任务have no TTL key accumulation | `todo` |
| 84 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:605-609` `nack` requeue without backoff，immediately re-pulled by same worker | `todo` |
| 85 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:664-672` `retryJobAsync` forcibly sets `attempts=0` bypassing `maxAttempts` budget | `todo` |
| 86 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:600` `nack` 闭包references用陈旧 `jobData.priority` | `todo` |
| 87 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:675-695` `purgeAsync` 对每条 ID individual `hgetall` N+1 RTT | `todo` |
| 88 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:308-317` 先 `arrayBuffer()` full读再判大小，可被exceeds大response OOM | `todo` |
| 89 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:323-324` `JSON.parse` no `try/catch`，恶意 JSON directly抛 | `todo` |
| 90 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:296-298` `Content-Type` 大小写敏感比较，call方 `Content-type` 时双写 header | `todo` |
| 91 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:672-678` `simulateStepExecution` only `setTimeout 50ms`，doesn't actually execute any action | `todo` |
| 92 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:729-733` `simulateRollback` is no-op，回滚永远success | `todo` |
| 93 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:665-669` `findStepDefinition` iterates all executions `O(N·M)` | `todo` |
| 94 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:642` `step.output` hardcoded `"Step X completed successfully"` overwrites real output | `todo` |
| 95 | `src/platform/five-plane-execution/compensation-manager.ts:312-319` `reverseExternalEffect` directly `return true`，external side effects not reversed | `todo` |
| 96 | `src/platform/five-plane-execution/compensation-manager.ts:326-333` `executeCompensateAction` stub always succeeds | `todo` |
| 97 | `src/platform/five-plane-execution/compensation-manager.ts:339-344` `sendCompensationNotification` empty body，notification never sent | `todo` |
| 98 | `src/platform/five-plane-execution/compensation-manager.ts:350-358` `executeRollback` stub，rollback contract not implemented | `todo` |
| 99 | `src/platform/five-plane-execution/execution-engine/phase1a-happy-path.ts:1-6` only `re-export`，按 `AGENTS` should be completely removed | `todo` |
| 100 | `src/platform/five-plane-execution/execution-engine/phase1b-orchestration.ts:1-31` compatibility file maintains redundant naming | `todo` |
| 101 | `src/platform/five-plane-execution/execution-engine/phase1b-tool-definitions.ts` vs `phase1b-utils.ts` `phase1b` compatibility remnants | `todo` |
| 102 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts` vs `runtime-recovery-service-root.ts` 等四对 `*-service/*-service-root` 双胞胎 | `todo` |
| 103 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts` 581 linessingle file violates `AGENTS small modules` principle | `todo` |
| 104 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts` 814 lines同上 | `todo` |
| 105 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:47` uses CJS backwards in ESM `require` | `todo` |
| 106 | `src/platform/five-plane-execution/distributed-lock/locking-support.ts:12` `require("postgres")` synchronous加载，optionalrelies on耦合 | `todo` |
| 107 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:67-68` at construction time `createRequire+require("ioredis")`，missing dependency crashes startup | `todo` |
| 108 | `src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.ts:167,226` `lock id` 用 `Date.now()` 拼字符串，millisecond-level conflicts can reuse | `todo` |
| 109 | `src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts:25-47` `createRequire` 后dynamically `require` 同胞 `.js`，module graph cannot be statically analyzed | `todo` |
| 110 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-manager.ts` 9 lines dead shim | `todo` |
| 111 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-service.ts` 10 lines dead shim | `todo` |
| 112 | `src/platform/five-plane-execution/distributed-lock/distributed-lock-factory.ts` 21 lineslightweight wrapper overlaps with `manager/service` overlaps | `todo` |
| 113 | `src/platform/five-plane-execution/execution-engine/runtime-context.ts` 1 lines shim | `todo` |
| 114 | `src/platform/five-plane-execution/execution-engine/single-task-execution.ts` 7 lines `re-export shim` | `todo` |
| 115 | `src/platform/five-plane-execution/distributed-lock/index.ts` 1 lines barrel | `todo` |
| 116 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:560-562` 取最高 score（最新）violates FIFO intuition文档未Description | `todo` |
| 117 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:686-693` checkpoint state directlyreferences用原 `entries` 数组，subsequent mutate pollutes historical checkpoint | `todo` |
| 118 | `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts:706-713` `performRollback` 在 `rollbackHistory` when empty marks all `rolled_back`，doesn't distinguish未执lines步骤 | `todo` |
| 119 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:286-288` `AbortController.unref` makes timeout not block exit，但 abort 后未 `await` 清理races with ESM top-level | `todo` |
| 120 | `src/platform/five-plane-execution/recovery/runtime-recovery-service-root.ts` vs `runtime-recovery-service.ts` only import 路径vs少量variable名不同，constitute actual branch | `todo` |
| 121 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:60,87,119-121` `Math.min(ttlMs,MAX_LOCK_TTL_MS)` 三occurrencesrepeats，constant `600_000ms` hardcodes | `todo` |
| 122 | `src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts:115-127` `extend` 用 `MIN(ttl_ms+?, MAX)` cumulative instead of reset from now，TTL 永远滑向upper limit | `todo` |
| 123 | `pg-advisory-lock-adapter.ts` 取锁后no `try/finally`，throw path leaks lock | `todo` |
| 124 | `pg-advisory-lock-adapter.ts:34-43` 自defines FNV-1a truncated to 63 位，collisions silently accepted | `todo` |
| 125 | `pg-advisory-lock-adapter.ts:71-83` `extend()` only改内存 map，doesn't refresh PG side advisory lock TTL | `todo` |
| 126 | `pg-advisory-lock-adapter.ts:107-115` catch-all maskstransient PG 错误as `"lock taken"` | `todo` |
| 127 | `pg-advisory-lock-adapter.ts:101` `Number(result.fencing_token)` exceeds `2^53` precision loss | `todo` |

## src/platform/five-plane-state-evidence

| # | Issue | Status |
|---|-------|--------|
| 128 | `CLAUDE.md:50` references用non-existent `state-evidence/artifacts/` 目录 | `todo` |
| 129 | 多个 contract/review 指向non-existent `state-evidence/artifacts/` 目录 | `todo` |
| 130 | `runtime-truth-repository.ts:741`、`projection-rebuild-service.ts:429`、`memory-gateway/index.ts:248`、`plan-builder.ts:193` use non-normalized `JSON.stringify` for fingerprinting，key order changes cause false diff | `todo` |
| 131 | `tests/integration/platform/state-evidence/memory/memory-layer-model-integration.test.ts:261` 用 `Date.now()-90000` for aging assertion，clock drift causes jitter | `todo` |
| 132 | `tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts` vs `durable-event-bus-integration.test.ts` 命名inconsistent疑似双跑 | `todo` |
| 133 | `package.json:223-234` `test:receipt-store/tool-gateway/memory-gateway/sandbox-provider` have no aggregator，only操作员入口 | `todo` |
| 134 | `five-plane-state-evidence/index.ts:1` `re-export` non-existent `./artifacts/index.js`，import throws immediately | `todo` |
| 135 | `truth/sqlite/repositories/operations-repository.ts:898` `listRuntimeRecoveryRecords` directly concatenates caller `whereClause` directly concatenated into SQL，only过滤 `;\\|--\\|/*` still allows `OR 1=1/子查询` | `todo` |
| 136 | `truth/sqlite/repositories/event-repository.ts:788-828` `insertEvent` vs outbox `INSERT` double prepared without unified transaction，breaks outbox atomicity | `todo` |
| 137 | `truth/sqlite/repositories/task-repository.ts:96-125` `listTasks cursor` only按 `updated_at`，no `id tiebreaker`，分页可丢lines/死循环 | `todo` |
| 138 | `truth/sqlite/repositories/tenant-repository.ts:203-204` `listAll` 用 `[...Map.values()].slice` no稳定排序，cross-page results resort | `todo` |
| 139 | `truth/sqlite/repositories/release-repository.ts:611,632,654` `listEnterprise*` only `limit=20`，no cursor/offset/tenant 过滤 | `todo` |
| 140 | `truth/sqlite/repositories/intelligence-repository.ts:350` `listIntelBriefs(limit=20)` no cursor silently truncated | `todo` |
| 141 | `truth/sqlite/repositories/organization-repository.ts:273` `listOrganizationRecords(limit=50)` no租户过滤，cross-tenant leak | `todo` |
| 142 | `truth/sqlite/repositories/worker-repository.ts:63` vs `worker-snapshot-repository.ts:276` `listCoordinatorInstanceSnapshots` dual implementation schema drift | `todo` |
| 143 | `state-evidence/dlq/index.ts:110-113` `enqueue` uses linear `listByConsumer` for deduplication，`O(n)` per insert，no索references | `todo` |
| 144 | `state-evidence/dlq/index.ts:282-284` `runDueRetries` 空 `catch {}` 吞错no logger/telemetry/退避 | `todo` |
| 145 | `state-evidence/dlq/index.ts:99` `maxRetries=5` hardcodes，vs `dlq-service.ts retry policy` conflicts | `todo` |
| 146 | `state-evidence/dlq/index.ts:6-23` `DeadLetterRecord` vs `contracts/types/domain/session-types.ts EventDeadLetterRecord schema` dual sources | `todo` |
| 147 | `state-evidence/incident/index.ts:127-161` `listIncidents/listIncidentsPaginated` full `Map.values() + sort + findIndex`，concurrent插入下 cursor 失效 | `todo` |
| 148 | `state-evidence/incident/index.ts:35` `linkedEvidenceRefs: input.linkedEvidenceRefs ?? []` directly存 caller references用，external mutation pollutes internal | `todo` |
| 149 | `state-evidence/incident/index.ts:117-121` `resolve()` accepts任意当前Status，bypassing `triaged→mitigating→reviewed→resolved` FSM | `todo` |
| 150 | `state-evidence/incident/index.ts:22` `nextIncidentOrder` 单调 ID 公开预测can enumerate | `todo` |
| 151 | `state-evidence/audit/index.ts:21,29` `AuditTrailService.records` 内存数组no轮换/持久化，long-running process will OOM | `todo` |
| 152 | `projections/projection-rebuild-service.ts:265-266,278-294` `JSON.stringify` comparison non-normalized key order；cutover no乐观concurrent token | `todo` |
| 153 | `checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` doesn't throw，malicious payload silently truncated then into gunzip | `todo` |
| 154 | `checkpoints/checkpoint-envelope.ts:147-149` `JSON.stringify` 大对象先full物化再判 size，OOM before guard | `todo` |
| 155 | `checkpoints/checkpoint-gc-service.ts:548-560` `acquireRunLock` 不record PID/host，崩溃残留锁vs活锁不可区分 | `todo` |
| 156 | `knowledge/keyword-index.ts:22-30` `upsert` 不清除前一iterations keywords 反向索references，stale postings remain | `todo` |
| 157 | `knowledge/keyword-index.ts:32-47` `query` 每iterations重扫 `countOccurrences` nocache | `todo` |
| 158 | `knowledge/keyword-index.ts:1-53` 缺 `delete(chunkId)` API，chunks live forever | `todo` |
| 159 | `memory-gateway/index.ts:248-258` `projectionHash` 用 `JSON.stringify([...input.memoryIds])` preserving caller order，same set different order produces different hash | `todo` |
| 160 | `memory-gateway/index.ts:280-298` 内存层映射 `L1/L2/L4/L6 round-trip` lossy，not asserted | `todo` |
| 161 | `memory-gateway/index.ts:328` `Number.isFinite(Number(metadata.version))` accepts `1e308`，missing integer/range validation | `todo` |
| 162 | `state-evidence/memory/trust-level-service.ts:245-248` `MAX=500/TTL=24h/EVICT=60s` hardcodesno config | `todo` |
| 163 | `state-evidence/memory/trust-level-service.ts:280-289` 每iterations驱逐 `[...entries].sort O(n log n)`，includes non-null assertion swallowing OOB | `todo` |
| 164 | `state-evidence/memory/trust-level-service.ts:384-385` `includes("TODO"/"FIXME")` literal string filtering，normal text falsely flagged | `todo` |
| 165 | `truth/sqlite/repositories/prompt-bundle-repository.ts:164-332` 8 occurrences `JSON.stringify(input.*)` 列writesno zod 校验 | `todo` |
| 166 | `truth/sqlite/repositories/billing-repository.ts:168` `Number(result.changes)` BigInt `> 2^53` silently truncated | `todo` |
| 167 | `truth/sqlite/repositories/worker-snapshot-repository.ts:249` same query switches by filter `ORDER BY`，cursor across filter invalidates | `todo` |
| 168 | `state-evidence/events/event-ops-service.ts:216-221` `setTimeout(...) reject` 计时器未 `unref`；`Promise.race` 胜者不 `clearTimeout` | `todo` |
| 169 | `state-evidence/events/durable-event-bus.ts:9` different instantiation points `retentionLimit:500/100` inconsistent | `todo` |
| 170 | `tests/integration/platform/state-evidence/events/transactional-event-appender` vs `event-repository.ts:788-828` outbox 拆分两 prepared call，SQLite WAL autocommit 下观察方可见部分Status | `todo` |
| 171 | `tests/integration/platform/state-evidence/checkpoints/checkpoint-envelope.ts:178` `createdAt:new Date().toISOString()` uses local clock，不同 TZ 重放产物元data非确定 | `todo` |
| 172 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:138` `PRAGMA journal_mode=WAL` doesn't assert return value，NFS etc silently falls back to delete | `todo` |
| 173 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:134` `busy_timeout` allows 0，transient `SQLITE_BUSY` vsconcurrentconflicts | `todo` |
| 174 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283` `Object.values(row)` relies on `wal_checkpoint` column order，missing key-name destructuring | `todo` |
| 175 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:347-350` `close()` doesn't check `wal_checkpoint busy>0`，unpersisted frame closed | `todo` |
| 176 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:442-449` via正则 `database is locked\\|busy` 识别 `BUSY`，localization/errno change invalidates | `todo` |
| 177 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-340` `healthCheck` 标 `async` 实onlysynchronous事务，误导call方 | `todo` |
| 178 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:455-465` `applyCompatibleColumnMigrationIfKnown` hits skips `migration.sql`，索references/约束变更悄然丢 | `todo` |
| 179 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:108,233` `fetch` no `AbortController/timeout` | `todo` |
| 180 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:121-126,246-251` 错误体directly拼到 `Error message`，potential log injection | `todo` |
| 181 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:137,259+` `response.json()` no `try/catch` | `todo` |
| 182 | `src/platform/five-plane-state-evidence/knowledge/indexing/embedding-provider.ts:142-144` return `index` 范围/repeats，post-order mapping assumes one-to-one | `todo` |
| 183 | `src/platform/five-plane-state-evidence/checkpoints/checkpoint-envelope.ts:226` `Buffer.from(payload,"base64")` doesn't validate length/MIME，corrupted payload decodes to empty buffer without error | `todo` |
| 184 | `src/platform/five-plane-state-evidence/memory/trust-level-service.ts:384-385` 用 `content.includes("TODO/FIXME")` as trust level downgrade basis，obvious false positive | `todo` |
| 185 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:323-330` `healthCheck` inside transaction `CREATE/DROP TEMP TABLE`，rollback leaves TEMP handle | `todo` |
| 186 | `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts:283-290` `checkpointWal` doesn't distinguish `busy>0` vs `frames=0`，运维no法识真实瓶颈 | `todo` |
| 187 | `tests/integration/platform/state-evidence/dlq-persistence.test.ts:464` `/tmp/dlq-persistence-test-${Date.now()}.db` not portable to Windows and not cleaned in finally | `todo` |
| 188 | `tests/unit/platform/state-evidence/knowledge/knowledge-store.test.ts:17` `/tmp/aa-sandbox/ktest_${suffix}_${Date.now()}` concentrated pollution | `todo` |
| 189 | `tests/unit/platform/state-evidence/knowledge/p2-defects-sys-sec-4-2.test.ts:63,113` 两occurrences `/tmp/aa-sandbox/...` not cleaned | `todo` |
| 190 | `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts` threshold 10MB same issue and `RSS/heapUsed` | `todo` |
| 191 | `dashboard-projection-service.ts:110` `system.health.changed` not registered to `TypedEventType` | `todo` |
| 192 | `migrate-sqlite-to-pg.ts` 列名/table名directly concatenated into SQL，no whitelist（注入风险） | `todo` |
| 193 | `idempotency-key-storage.ts` `${this.tableName}` directly concatenated into SQL，at construction time未校验 | `todo` |
| 194 | `semantic-vector-store.ts` `process.env[name]` 中 `name` 来自configure，can read any env | `todo` |
| 195 | `checkpoint-gc-service.ts` `fs.stat→fs.unlink` TOCTOU window | `todo` |
| 196 | `shadow-snapshot-service.ts` `lstat→rename` has symlink swap window between them | `todo` |
| 197 | `sqlite-database-wrapper.ts:94-114` `savepoint` 名直拼 `exec`，未来call方可注入 | `todo` |
| 198 | `sqlite-database.ts:143` `PRAGMA busy_timeout = ${this.busyTimeoutMs}` concatenated into SQL，`busyTimeoutMs` not integer validated | `todo` |
| 199 | `pg-advisory-lock-adapter.ts` 中 `Number(result.fencing_token)`、`sqlite-lock-adapter.ts:36 Number(result.lastInsertRowid)` exceeds `2^53` precision loss | `todo` |
| 200 | `checkpoint-gc-service.ts:171,557`、`learning-object-model.ts:180,184`、`risk-register.ts:87,110`、`invariant-registry.ts:137,165,180`、`responsibility-boundary.ts:158-308`、`admin-config-service.ts:66`、`outbox-repository.ts:117`、`memory-layer-model.ts:214,549`、`graphql-adapter-service.ts:294`、`conversation-template-service.ts:408`、`approval-policy-engine/version-manager.ts:111`、`stable-evidence-bundle-support.ts:612,616,732`、`dlq-service.ts:238`、`knowledge-snapshot-store.ts:25-48`、`semantic-vector-validation.ts:276`、`tool-gateway/index.ts:150,160`、`idempotency-key-storage.ts:310,338,341`、`cors.ts:49-68`、`reliability/timeout.ts:45,54` 多occurrences抛裸 `Error` 而非结构化 `AppError/ValidationError` | `todo` |
| 201 | `.gitignore` globally `*.db-shm/*.db-wal` don't exist，sqlite WAL residuals can be committed | `todo` |

## src/platform/shared

| # | Issue | Status |
|---|-------|--------|
| 202 | `src/platform/stability/` vs `src/platform/shared/stability/` 平lines同名目录实现已分歧 | `todo` |
| 203 | `src/platform/shared/reliability/`、`shared/stability/reliability/`、`stability/reliability/` 三occurrences可靠性实现repeats | `todo` |
| 204 | `src/platform/shared/observability/structured-logger.ts:484-491` each fsync log `openSync+appendFileSync+fsyncSync+closeSync` 串linessynchronous IO | `todo` |
| 205 | `src/platform/shared/observability/structured-logger.ts:153,180` `sinkBaseDir=process.cwd()`，运lines时 `chdir` 后语义漂移 | `todo` |
| 206 | `src/platform/shared/observability/structured-logger.ts:194` `mkdirSync` no错误handle，permission不足时 configure directly抛 | `todo` |
| 207 | `src/platform/shared/observability/structured-logger.ts:262` `retentionLimit=0` buffer length is 0，all logs silently discarded | `todo` |
| 208 | `src/platform/shared/outbox/outbox-poller-service.ts:193-197` `retryCount>=maxRetries` only `failed++;continue`，never sends to DLQ | `todo` |
| 209 | `src/platform/shared/outbox/outbox-poller-service.ts:188-217` `for-await` 串lineshandle，noconcurrent批量发布 | `todo` |
| 210 | `src/platform/shared/observability/otel-tracer.ts` vs `otel-bootstrap.ts` each `loadOtelApi/loadOtelModules`，OTel loading has two paths | `todo` |
| 211 | `src/platform/shared/observability/structured-logger.ts:153` `sinkBaseDir=process.cwd()` after multiple worker forks each holds own cwd，路径inconsistent | `todo` |
| 212 | `tests/unit/platform/shared/stability/stable-prompt-injection-red-team-additional.test.ts:82,97,111,129,145` 5 occurrences `/tmp/...` not portable | `todo` |
| 213 | `tests/unit/platform/shared/stability/stable-runtime-validator-additional.test.ts:30` `/tmp/${caseId}.backup.db` cross-case same name, overwrite each other | `todo` |
| 214 | `graceful-shutdown.ts` `setImmediate(()=>process.exit())` doesn't flush stdio | `todo` |
| 215 | `slo-alerting-channels.ts` 在 `queueMicrotask` 内做synchronous阻塞 I/O | `todo` |
| 216 | `graceful-shutdown.ts:122` `void this.handleSignal(signal)` no `.catch`；shutdown errors become unhandled rejection | `todo` |

## src/platform/stability

| # | Issue | Status |
|---|-------|--------|
| 217 | `src/platform/stability/timeout.ts:82` success路径未 `clearTimeout`，`setTimeout` 句柄泄漏 | `todo` |
| 218 | `src/platform/stability/timeout.ts cancel()` only取消计时器，未via `AbortSignal` 传给被包裹function | `todo` |
| 219 | `src/platform/stability/retry.ts` vs `stability/reliability/retry.ts` two copies coexisting with divergent strategies | `todo` |

## src/platform/prompt-engine

| # | Issue | Status |
|---|-------|--------|
| 220 | `ha-repository-postgres.ts:22`、`coordinator-load-balancing-service.ts:78`、`prompt-engine/registry/index.ts:123`、`tight-loop-detector.ts:82,95`、`loop-detection.ts:97`、`semantic-embedding.ts:108`、`structured-logger.ts:851`、`prompt-injection-guard.ts:543`、`profile-home.ts:31` 多occurrences `sha256` truncated to 32-64 位作为身份/cache键，high collision probability | `todo` |
| 221 | `prompt-engine/registry/index.ts:114` `listVersions` 用 `localeCompare` 排序，`"10"` lexicographically before `"2"` 前 | `todo` |
| 222 | `prompt-engine/registry/index.ts:117-119` `listTemplates()` full `flat-map` no分页 | `todo` |
| 223 | `prompt-engine/registry/index.ts:81-86` `version_conflict` 检查后两阶段writesno回滚，部分failed遗留映射 | `todo` |
| 224 | `prompt-engine/eval/quality-config-loader.ts:24-35` schema missing `qualityScoreWeights` 求和≈1 vs `completeMinScore>approvalRequiredScore` 的 `.refine` | `todo` |
| 225 | `prompt-engine/eval/quality-config-loader.ts:101-105` zod 校验failed被吞为通用 `throw`，非结构化 `AppError` | `todo` |
| 226 | `prompt-engine/eval/llm-eval-service.ts:633` `logger.warn` contains raw `suite.cases payload`，PII/prompt content leaked | `todo` |
| 227 | `prompt-engine/eval/prompt-model-policy-governance-service.ts:584` `JSON.parse(release.metadata)` no zod 校验 | `todo` |
| 228 | `prompt-registry/index.ts:1-30` 30 linespure re-export shim，violates single source of truth | `todo` |
| 229 | `prompt-engine/conversation-template-config-loader.ts:35` `JSON.parse(content)` no大小upper limit，configure文件 OOM | `todo` |
| 230 | `template-registry/index.ts` 两occurrences `@ts-expect-error` | `todo` |

## src/platform/contracts & types

| # | Issue | Status |
|---|-------|--------|
| 231 | `client-sdk/api-client.ts:984-992` `declare module ".../executable-contracts/index.js"` 模块增强会globally污染 `ContractEnvelope.principal` | `todo` |
| 232 | 全仓 `assert.ok(true)` 共 193 occurrences（`tests/e2e/sdk/sdk-e2e.test.ts:388`、`tests/unit/platform/interface/ingress/*` 多occurrences、`vcr-replay-fixture.test.ts:338`、`contracts/types/domain/index.test.ts:32`、`redis-lock-adapter.test.ts:1079,1082` 等），systematic placeholder | `todo` |
| 233 | `contracts/types/responsibility-boundary.ts:316-326` 在 `"types"` 文件内放 `GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE` singleton运lines时态 | `todo` |
| 234 | `contracts/types/responsibility-boundary.ts:302,306` 热路径每call `new Set` | `todo` |
| 235 | `contracts/types/domain/billing-types.ts:68` `summaryJson:string` 不透明 blob no zod | `todo` |
| 236 | `contracts/types/domain/billing-types.ts:63,95,177` `currency:"USD"` 三occurrences字面，class型上禁多币种 | `todo` |
| 237 | `contracts/types/domain/billing-types.ts:122-129` `executionId/stepId` 标 `@deprecated` 仍 required，no移除计划 | `todo` |
| 238 | `contracts/types/domain/index.ts:1-249` 100+ symbols hand-maintained，非 `export *`，新class型必致漂移 | `todo` |
| 239 | `contracts/types/index.ts:191` jumps into `executable-contracts/index.js` `re-export`，bypassing domain 命名空间 | `todo` |
| 240 | `contracts/mission/{playbook,index}.ts:373/357` two `stableStringify` independent implementations，may drift | `todo` |
| 241 | `mission/index.ts` 1637 lines单文件过大 | `todo` |
| 242 | `data-classification-service.ts:680`、`network-egress-audit.ts:335`、`auto-stop-loss-service.ts:65-71`、`panic-propagation-service.ts:119-123`、`war-room-coordinator.ts:93-94`、`policy-engine.ts:83`、`takeover-escalation-manager.ts:46,49`、`approval-flow-engine.ts:571`、`approval-policy-engine/version-manager.ts:443`、`mission/index.ts:685`、`config-audit-service.ts:319,824`、`provider-health-tracker.ts:55`、`task-timeline-service.ts:181` 多occurrences `push` class内存unbounded growth | `todo` |
