# platforme-full-review-e

> Round 5 Full System Review (2026-06-01)
>
> Reviewer: Claude Code (MiniMax-M3 orchestration + three parallel expert agents)
>
> Review scope: across 5 plane core + 6 upper-layer domains + SDK / CLI / plugin runtime / test quality
>
> Review baseline: in `docs_zh/reviews/platforme-full-review-d.md` all 1461 items are `done`; this round uses the closed snapshot from round d as the baseline, re-scans executable code and test suites, and outputs **currently still valid** todo / defect / security / test quality issues.
>
> Review method:
>
> 1. Actually run `npm run build` / `npm run typecheck` — pass;
> 2. Actually run 25 CI audit scripts — all currently pass, **defects not blocked by existing audit gates** are the new todos in this round;
> 3. fan-out three parallel expert reviewers (code-reviewer / security-auditor / test-engineer), each path independently producing verifiable code references and line numbers;
> 4. Secondary source-code verification of 4 first-tier high-severity findings (http-api-server:636, delegation-manager:934, cdc-replication-service:1010, multi-step-orchestration:42).

## New Items in This Round — Summary

| Severity | Count | Meaning |
| --- | --- | --- |
| Critical | 5 | Reject merge; triggerable or observable state deviation / data divergence / auth bypass exists |
| High | 22 | Affect correctness, performance, security contract; recommend concentrated fix in next iteration |
| Medium | 27 | Code readability / defense-in-depth / test isolation / consistency drift |
| Low | 22 | Magic numbers, doc sync, naming consistency, minor readability |
| **Total** | **76** |  |
| Subsystem distribution | five-plane interface=15; five-plane control plane=18; five-plane orchestration=4; five-plane execution=12; scale-ecosystem=8 (cdc-replication + tenant + marketplace); plugin runtime+plugin adapters=7; SDK/CLI=4; org-governance + startup path=4; test quality=4 | |

## Review Baseline (Already Run and Pass)

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | OK |
| Typecheck | `npm run typecheck` | OK (including `ui/` sub-project) |
| Public entry audit | `node scripts/ci/audit-public-entrypoints.mjs` | `unexpected: []` |
| Doc link style | `node scripts/ci/audit-doc-link-style.mjs` | OK |
| Outbound URL whitelist | `node scripts/ci/audit-outbound-urls.mjs` | `unexpected: []` |
| golden snapshots | `node scripts/ci/audit-golden-snapshots.mjs` | OK |
| Public error codes | `node scripts/ci/audit-public-error-codes.mjs` | `54 registered` |
| Runtime service events | `node scripts/ci/audit-runtime-service-events.mjs` | `0 signals documented` |
| Sync/async service pairs | `node scripts/ci/audit-sync-async-service-pairs.mjs` | `30/30` |
| Doc sync | `node scripts/ci/audit-docs-sync.mjs` | `zh=120 en=120` |

> Note on table above: existing CI gates are already "all green" on baseline, but this round of review still finds 73 new executable defects across 1909 TS source files. This shows audit scripts cover the "form" while this round focuses on the "spirit" (runtime behavior, contract consistency, cross-module data flow).

---

## src/platform/five-plane-interface

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 1 | `src/platform/five-plane-interface/api/http-api-server.ts:636-638` `resolveClientIp(headers, fallback)` accepts `headers` but **does not read any header**, only returns `fallback?.trim() \|\| "unknown"`. Result: rate limiter actually buckets by `fallback` (in most cases `request.socket.remoteAddress`), proxy headers such as X-Forwarded-For / X-Real-IP are silently dropped, attackers can bypass rate limit via any proxy path with missing/forged `remoteAddress`; multi-instance deployments aggregating by "unknown" will also cause single-point hotspots. | `open` | rate-limit client IP resolver implementation incomplete, signature accepts `headers` but does not implement reading by proxy headers. |
| 2 | `src/platform/five-plane-interface/api/http-api-server.ts:209-228` `createServer` callback's `void this.handleRequest(...).catch(error => { ... })` only writes JSON error back when `!response.headersSent`; if the route handler has started streaming response (headers already sent), error is silently swallowed, and the `else` branch (line 213) is unreachable. | `open` | top-level unhandled rejection only handles the "headers not sent" branch, missing error termination logic for streaming response path. |
| 3 | `src/platform/five-plane-interface/api/http-api-server.ts:1235-1243` `isLikelyPathIdentifier` recompiles `/^[A-Za-z0-9_-]+$/`, `/^[0-9]+$/`, UUID and other regexes on every call; this function is called once per URL segment. | `open` | regexes not hoisted to module-level constants, repeated allocation on hot path. |
| 4 | `src/platform/five-plane-interface/api/middleware/request-deduplication.ts:8,202` request deduplication uses `createHash("sha256").update(body, "utf8").digest("hex")` as idempotency key; consistent with round d 9-item closure, but `http-api-server.ts:182-185` always passes `allowInMemoryInProduction: true`, so deduplication silently degrades to no-op in multi-instance deployment. | `open` | single-instance fallback flag hardcoded to true; in distributed scenarios, finance/batch APIs originally depending on idempotent dedup will execute repeatedly. |
| 5 | `src/platform/five-plane-interface/api/api-auth-service.ts:400-403` `authenticate()` accepts `x-api-key` on **every** endpoint, and directly calls `exchangeApiKey` to issue JWT on the spot; long-lived API key bypasses short-lived JWT discipline, missing per-key rate limit and audit tracking. | `open` | auth layer mixes token-exchange with every-request authentication; `/auth/token` and other endpoints should go on two different fast/slow paths. |
| 6 | `src/platform/five-plane-interface/api/api-auth-service.ts:274-277` `principalHasRequiredRole` uses `>=` rank for inheritance, missing explicit route→role-set mapping; if a new role with lower rank is added in the future (e.g. `service:0`), it will match across permissions. | `open` | role permissions encoded with scalar model of "rank ≥ required rank" rather than explicitly declaring "required role set" per route. |
| 7 | `src/platform/five-plane-interface/api/api-auth-service.ts:135` `hashToken = createHash("sha256").update(value, "utf8").digest()`; line 164 switches to `createHmac("sha256", TOKEN_LOOKUP_HMAC_KEY)`, but `TOKEN_LOOKUP_HMAC_KEY` (`session-management.ts:24`) and `OPAQUE_CURSOR_SIGNING_SECRET` (`http-server/utils.ts:40`) are both `randomBytes(32)` process-level constants, immediately invalid on process restart or multi-instance deployment, token index and cursor cannot be cross-process verified. | `open` | HMAC keys use module-load-time `randomBytes`, no stable secret store injected; "stateless verifiable" semantics of session/cursor degrade to "verifiable within process". |
| 8 | `src/platform/five-plane-interface/api/oidc-oauth-service.ts:13,71,647-648` PKCE uses `createHash("sha256")` (correct), but `code_challenge_method=plain` path does not enforce minimum entropy, and line 647 comment "Use createHash, not createHmac" exposes a non-obvious algorithm choice, no unit test guards it. | `open` | PKCE path has same shape as OIDC mainstream spec but implementation details heavily depend on comments; missing an `expect(pkce).toMatchSchema` contract test. |
| 9 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:190,250` `get-then-set` is not atomic; two concurrent same Idempotency-Key requests will double-write; line 206-217 in-flight branch returns both `allowed:true` and 409, semantically conflicting. | `open` | idempotency middleware abstraction only exposes get/set, no atomic reservation; in-flight state machine written incorrectly. |
| 10 | `src/platform/five-plane-interface/api/middleware/idempotency-key.ts:201` error message echoes user-input `idempotencyKey`/`method`; line 222-234 cached response `JSON.parse` also has no body size guardrail. | `open` | error text directly concatenates user input, cache layer only validates parseability, no 1 MB limit. |
| 11 | `src/platform/five-plane-interface/api/http-server/harness-runs-routes.ts:82` user cursor `JSON.parse` has no try/catch and no size limit; malicious cursor → 500. | `open` | manual decoding in route, not reusing unified error boundary. |
| 12 | `src/platform/five-plane-interface/api/http-server/approval-routes.ts:77`, `dashboard-routes.ts:349`, `utils.ts:112,360`, `admin-routes.ts:176` and 7+ other `requestJson` calls use `JSON.parse` cast to `Record<string, unknown>`, no schema validation, no size guardrail. | `open` | persisted fields default-treated as "trusted internal", missing size guardrail and field whitelist. |
| 13 | `src/platform/five-plane-interface/api/http-server/console-routes.ts:163-453` HTML route's `escapeHtml` (line 456-463) only escapes `&<>"'`, does not escape backtick and `\`; CSP `default-src 'none'` currently does block inline script, but escape gap is a defense-in-depth gap, once `script-src 'self'` is added in the future XSS is triggered. | `open` | local escape utility incomplete, global CSP treats escape as fallback rather than the rule. |
| 14 | `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:177-183` `WebSocketServer` has no `verifyClient`; token goes through Sec-WebSocket-Protocol header, can be cross-origin hijacked on browser side (CSWSH). | `open` | auth only does protocol negotiation, no Origin check; CSRF/CORS-style protection missing. |
| 15 | `src/platform/five-plane-interface/webhook/index.ts:73-74,200-211,255,296-315` three unbounded Maps `acceptedEnvelopes` / `failureCounts` / `envelopesByIdempotencyKey`; `Buffer.from(normalizedSignature, "hex")` accepts non-hex and truncates; `parseWebhookPayload` does not limit body size (line 296-315). | `open` | webhook entry assumes short process lifetime, missing capacity governance, signature hex validation, body size guardrail. |

## src/platform/five-plane-control-plane

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 16 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:825-833` `Math.max(1, Math.trunc(ttlMinutes))` only enforces a floor of 1 minute, no upper bound; `operator` scope can issue `Number.MAX_SAFE_INTEGER` minute lease, effectively permanent. | `open` | TTL validation only does lower-bound floor, no policy.maxTtlMinutes upper-bound interception. |
| 17 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:101-113` `sanitizeMetadataRecord` only filters `__proto__/constructor/prototype` at top level; nested objects preserved as-is, `Object.assign(target, parsed)` path can still trigger prototype pollution. | `open` | shallow sanitize; recursion missing. |
| 18 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:56-97` `SecretResolutionRateLimiter.requests: Map` grows unbounded, eviction only happens in `pruneExpiredCallers` when all entries expired; high-cardinality caller id (per-task / per-tenant) will continuously leak memory. | `open` | in-memory rate limiter missing LRU cap + global entry upper limit. |
| 19 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:805-815,238-247` `requireRegistryRecord` error details repeatedly echo non-redacted `secretRef`, `callerScopeType`, `providerKind`; `secret.unauthorized_scope` error directly concatenates secretRef. | `open` | error context directly reuses original fields, no minimum disclosure; information disclosure for error oracles. |
| 20 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:728-777` `startDailyRotationScheduler` subsequent calls early-return existing timer, when parameters differ silently keeps the first interval. | `open` | scheduler lifecycle does not distinguish "first start" from "repeated call", schedule drift unobservable. |
| 21 | `src/platform/five-plane-control-plane/iam/field-encryption.ts:80-88` `deriveEncryptionKey` uses single-round `createHash("sha256")`; `sdk/cli/login.ts:134` already uses `scryptSync({N:1<<15,r:8,p:1})`, two implementations have inconsistent KDF strength. | `open` | field encryption once bound "password derivation" with "runtime encryption/decryption" to a shallow hash path, strength below spec. |
| 22 | `src/platform/five-plane-control-plane/iam/session-management.ts:24` `const TOKEN_LOOKUP_HMAC_KEY = randomBytes(32);` process-level constant; multi-instance/restart immediately invalid. | `open` | see item 7 for same-class root cause. |
| 23 | `src/platform/five-plane-control-plane/iam/aws-kms-http-secret-provider.ts:208,275-296` `AA_AWS_KMS_ENDPOINT` read directly, no protocol/host check; `X-Amz-Target` header concatenation not whitelisted. | `open` | provider's endpoint env injection does not go through `parseSafeOutboundUrl`; easy to introduce header injection when extending in the future. |
| 24 | `src/platform/five-plane-control-plane/iam/gcp-secret-manager-http-secret-provider.ts:101-104,121` `AA_GCP_TOKEN_FETCH_URL` read directly, **no** host/protocol check; attacker-influenced env can redirect metadata token POST. | `open` | same as 23. |
| 25 | `src/platform/five-plane-control-plane/iam/vault-http-secret-provider.ts:132,93` `AA_VAULT_TIMEOUT_MS` parsed via `parseInt(..., 10)` then **without** `Number.isFinite` check, NaN is immediately accepted by AbortController as 0ms timeout. | `open` | config parsing still uses the loose "use as soon as parsed" habit. |
| 26 | `src/platform/five-plane-control-plane/iam/network-egress-policy.ts:117-133` vs `outbound-url-policy.ts` `BLOCKED_OUTBOUND_HOSTNAME_PATTERNS`: `network-egress-policy` covers CGN `100.64/10` but `outbound-url-policy` does not; both also lack a unified baseline of `0.0.0.0/8` and `100.64/10`. | `open` | two policies maintained separately, no shared SSRF blocklist; SSRF to CGN / `0.x` will pass in SDK path. |
| 27 | `src/platform/five-plane-control-plane/policy-center/index.ts:282` (round d 35 closure already handled emergency path) but in `policy-center/budget-allocator.ts:789`, `config-hot-reload-service.ts:268,506`, `cache-invalidation-broadcast.ts:68`, `durable-event-bus.ts:710,916,1007`, `call-governance.ts:609`, `external-secret-provider.ts:226` and other places `void promise fire-and-forget` has no `.catch`. | `open` | multiple infrastructure modules treat background tasks as ignorable details, missing rejection observability. |
| 28 | `src/platform/five-plane-control-plane/iam/secret-management-service.ts:101-113` (same as 17, but also the residual of round d 47 closure "duplicate secretRef not redacted": `details.secretRef` at line 972 changed to `redactedSecretRef`, but line 985 still leaks `leaseId` rather than the `lease_*` redacted version. | `open` | redaction policy enforced for secretRef, but not for leaseId. |
| 29 | `src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.ts:786` (round d 52 closed fire-and-forget same class), but `takeover-escalation-manager.ts:123,207`, `deployment-execution-service.ts:181`, `runbook-executor.ts:541` and other setTimeout are not `.unref()`'d, blocking process exit. | `open` | same-class root cause. |
| 30 | `src/platform/five-plane-control-plane/config-center/config-hot-reload-service.ts:121,426` `setInterval` async callback not `.unref()`'d. | `open` | same as above. |
| 31 | `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:5,459,569` `process.exit(1)` called directly, no graceful close; same class root cause as round d 1314 closure. | `open` | startup-failure fast-exit path does not consume in-flight IO. |
| 32 | `src/platform/five-plane-control-plane/approval-center/approval-policy-engine/rule-engine.ts:120-132,128` `getFieldValue` accesses via `.` path, line 128 string parts index can hit `Function.prototype` and other non-own-property members. | `open` | field navigation does not block `__proto__/constructor/prototype/Function.prototype` and other prototype-chain fragments. |
| 33 | `src/platform/five-plane-control-plane/mission/index.ts:1354-1355` `left/right.split(".").map(v => Number.parseInt(v, 10) \|\| 0)`: `"0".parseInt → 0` cannot distinguish "0" from NaN; `"abc"` falls back to 0. | `open` | semver comparison does not error on non-numeric segments, masking format errors. |

## src/platform/five-plane-orchestration

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 34 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:934-937` inside `transitionDelegationStatus` `this.delegationRepository.updateStatus(...)` is an explicit floating promise (`// eslint-disable-next-line @typescript-eslint/no-floating-promises`). DB write failure → memory and persistence diverge; next hydration silently rolls back state. | `open` | async persistence and sync in-memory mutation not in the same try/catch + lacking rollback path. |
| 35 | `src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.ts:84-90` `MAX_ENTRIES=1000`, `ENTRY_TTL_MS`, `EVICTION_INTERVAL_MS` are all `private readonly`, but `lastEvictionTime` is mutable; `evictExpired()` only triggered inside `createDelegationRecord` / `updateDelegationChain`, idle instances never reclaim. | `open` | eviction hook not attached to read path / `delegate()`; LRU degrades to TTL-only. |
| 36 | `src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.ts:47` `parseExternalModelPayload` uses `JSON.parse(raw) as T`, no size/depth limit; `approval-context-summary-service.ts:178`, `learn/llm-improvement-generation-service.ts:120` also use `jsonMatch[0]` regex extraction and directly parse. | `open` | LLM output JSON parse path lacks size, depth, key-count guardrails. |
| 37 | `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-support.ts:775` and `oapeflir-loop-core.ts:382, stage-transition-fsm.ts:189-223` multiple places use `Date.now()` directly to stamp time; when clock is adjusted backward timestamps are non-monotonic. | `open` | OAPEFLIR internal event time directly takes wall clock, no monotonic abstraction. |

## src/platform/five-plane-execution

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 38 | `src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts:41-202` `runMultiStepOrchestration` top-level `await import("../dispatcher/index.js")` + `resetToolRegistry()` (line 42-43) executes on every call; `resolveOrchestrationPlan` (line 45) if it throws, `try/finally` has not yet started → when bootstrap throws `runtime.storage` resources will not be reclaimed by `finally`; `createOrchestrationBootstrapState` (line 47) throws bypasses `finally` guard. | `open` | try/finally only wraps `provideContext` call body, bootstrap/plan throw paths unprotected; dynamic import could be hoisted to static import. |
| 39 | `src/platform/five-plane-execution/execution-engine/multi-step-supervisor.ts:70-74` `listExecutionsByTask(taskId)` called in every step loop, per-step DB hit. | `open` | long workflow state repeatedly queries DB inside loop, should be hoisted out of loop. |
| 40 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:684-694` `enqueue` calls `pipeline.exec().then(...).catch(...)` and does not preserve promise; if `then` callback itself throws (e.g. `[err] != null` in non-array case) becomes unhandled rejection. | `open` | fire-and-forget wrapping incomplete, error handling chain broken. |
| 41 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:539-575` `claimWaitingJobWithoutEval` uses `zrangebyscore("-inf", "+inf")` without `LIMIT`, separately `hgetall` for each id; under large backlog each claim is O(N) per-job roundtrip. | `open` | fallback path not paginated, not pipelined. |
| 42 | `src/platform/five-plane-execution/queue/redis-queue-adapter.ts:681` `waitingScore = job.priority * 1e13 + new Date(job.createdAt).getTime()`, magic number `1e13`. | `open` | should be extracted to `PRIORITY_SCORE_MULTIPLIER` constant + range comment. |
| 43 | `src/platform/five-plane-execution/lease/execution-lease-service.ts:702` `if (activeLease.expiresAt <= occurredAt)` is string lexicographic comparison; when `activeLease.expiresAt` and `occurredAt` come from different sources (e.g. host clock vs DB), millisecond precision difference already makes the judgment wrong. | `open` | timestamp comparison strategy not unified. |
| 44 | `src/platform/five-plane-execution/lease/execution-lease-service.ts:433-440` `handoverLease` does not validate upper/lower bounds of `input.ttlMs`; `acquireLease` path validates `MIN_LEASE_TTL_MS`/`MAX_LEASE_TTL_MS`, but handover path misses it. | `open` | TTL validation only covers acquire path. |
| 45 | `src/platform/five-plane-execution/dispatcher/execution-dispatch-service.ts:894-906` `prioritizeStarvedTickets` copies with `[...tickets]` but sort shares `tickets` reference; line 210-211 outer variable re-assignment by reference, multiple callers sharing same array get timing chaos. | `open` | sort function's side-effect contract on input parameter not documented. |
| 46 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts:611-630` `inferReason` uses `!record.latestPrecheck.allowed`, while `toCandidate` afterwards uses `record.latestPrecheck.allowed === 1` to convert to boolean; when DB returns `1` (truthy) `inferReason` misclassifies denied as `execution_error`/`active_execution`. | `open` | boolean conversion inconsistent between storage and inference sides. |
| 47 | `src/platform/five-plane-execution/recovery/runtime-recovery-service.ts:295-314,473-475` `listRecoverableExecutingRuns`/`listBlockedRunsAwaitingApproval`/`listStaleRuns` three independent store calls in a row, no combined query; dashboard refreshes trigger 3 round-trips. | `open` | dashboard hot path has no aggregate query. |
| 48 | `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:92-129,306` `validateOutboundRequest` only validates host, not protocol; `fetch` has no `redirect: "error"`, both `scoped-external-access-sandbox` and `policy-aware fetch` default to follow redirect → SSRF pivot. | `open` | single-host allowlist + default redirect follow is a classic SSRF combination. |
| 49 | `src/platform/five-plane-execution/tool-executor/web-search.ts:298-326` no body size upper limit before `await response.text()`; attacker-influenced DNS can serve huge response → OOM. | `open` | outbound fetch missing streaming size guard. |

## src/platform/five-plane-state-evidence

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 50 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:1010-1019,1037-1045,901-933` `pruneVectorClocks`/`applySnapshot`/`clearState` all do not load/persist `vectorClocks` / `vectorClockTouchedAt`; restart loses all vector clocks, checkpoint still exists → `detectConflict` / `resolveConflict` silently falls back to `sequence+id` path. | `open` | persistence schema and clear helper missing fields. |
| 51 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:341-343,374` `prepareBatch` silently returns `null` when `queueDepth > 0`, but comments/call stack (`enqueueBatch` at line 374) imply prep success; callers not reading return value are completely unaware. | `open` | contract ambiguity on "queue full" path. |
| 52 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:718-728` `recordConflict` when full `MAX_CONFLICT_TASKS` deletes `conflictHistory.keys().next().value` (Map insertion-order first), not LRU; recent tasks may be wrongly killed because other entries "untouched". | `open` | eviction uses Map insertion order rather than touchedAt. |
| 53 | `src/scale-ecosystem/multi-region/cdc-replication-service.ts:654` `mergeEventWithConflictResolution` loop has `findIndex` → O(n*m). | `open` | missing Map<sequence,index> index. |
| 54 | `src/scale-ecosystem/billing/billing-service.ts:428-465` `recordUsage` failure rollback path **inserts** new quota counter (`existingCounter ?? { ...quotaCounter, usedQuantity: 0 }`) and adjustment ledger; original counter increment still remains → two counters in same window. | `open` | rollback logic "insert new row" instead of "decrement original row". |

## src/scale-ecosystem

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 55 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:185-188` progress calculation hardcodes `totalSteps = 100`; when `workflow.currentStepIndex > 100` progress > 100, dashboard data corrupted. | `open` | magic number + no clamp. |
| 56 | `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts:159` `this.store.dispatch?.listExecutionsByStatuses?.([...])` whole chain optional; when store is empty silently returns `[]`, function no-op. | `open` | missing explicit dependency check. |
| 57 | `src/scale-ecosystem/marketplace/marketplace-governance-service.ts:266-302` `submitReview` reads `packageRecord.permissionsJson` but **does not validate** package lifecycle state (review can still be written in states other than `installed`). | `open` | missing lifecycle-state precondition. |

## src/domains/registry

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 58 | `src/domains/registry/plugin-runtime-child.ts:97-125` `installRuntimeGuards` only blocks `http`/`https`/`net`/`tls`/`globalThis.fetch`; `node:dgram`, `WebSocket` (loaded from other module paths), `node:child_process`, `node:worker_threads`, third-party sockets (pg, mongodb) can still escape. | `open` | network guards incomplete. |
| 59 | `src/domains/registry/plugin-runtime-child.ts:127-135` `installStdioProtocolConsoleRedirection` is dead code: all three branches early-return, never install any redirect; actual logic in `withStructuredConsoleForCurrentRequest` (line 137-188). | `open` | orphan function body not cleaned up. |
| 60 | `src/domains/registry/plugin-runtime-host.ts:103-119` `invoke` registers `pending.set(requestId, ...)` but **no** per-request timeout; when child process hangs `pending` map grows unbounded. | `open` | missing per-invocation `setTimeout(..., record.manifest.sandbox.timeoutMs + 1000)`. |
| 61 | `src/domains/registry/plugin-spi-registry.ts:382-388` `invokeRetriever` uses `assertNamespaceAllowed(sandbox, input.namespace ?? null, pluginId)`; when `input.namespace == null` short-circuits without validation. | `open` | namespace null branch not constrained by sandbox allowlist. |

## src/plugins

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 62 | `src/plugins/adapters/crm-adapter.ts:344-386` `execute` wraps entire `crmRequest` in `try { ... } catch { return { ok: false, ... } }`: transport error / egress denial / validation error / HTTP 5xx all flattened to `ok: false`, callers and host state machine cannot distinguish retryable from policy denial. | `open` | catch-all error flattening. |
| 63 | `src/plugins/adapters/github-adapter.ts:294` has same "flat ok/error" return pattern as crm; line 273 `setTimeout(() => controller.abort(new Error("github_adapter.timeout")))` timeout handle not `clearTimeout`'d (success path). | `open` | same-class root cause. |
| 64 | `src/plugins/adapters/asset-production-adapter.ts:52`, `credential-hygiene.ts:33`, `github-adapter.ts:108` credential fingerprints all use `sha256(token).slice(0, n)`, reversible space grows with `n`; line 33 uses `Math.max(4, length)` allowing 4-character fingerprints. | `open` | fingerprint length lower bound too low, enumerable. |

## src/sdk / src/sdk/cli

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 65 | `src/sdk/client-sdk/api-client.ts:78-92,624,887-898` `buildApiUrl` / `createApiClient` does not validate `config.baseUrl` (not https, does not block internal network); `fetch(url, fetchOptions)` has no `redirect: "error"`, following redirect → credentials can be guided to attacker. | `open` | SDK boundary does no scheme/redirect defense. |
| 66 | `src/sdk/client-sdk/api-client.ts:594-689` catch branch uses `error.message.includes("fetch") \| "network" \| "ECONNREFUSED"` to determine network error; modern fetch error's `cause.code` is `UND_ERR_SOCKET`/`ETIMEDOUT`/`ENOTFOUND` etc. | `open` | network error classification depends on string match. |
| 67 | `src/sdk/client-sdk/api-client.ts:381` SSE reconnect backoff writes `Math.min(reconnectAttempt - 1, 4)`: first reconnect actually waits `1*1000` not `2*1000` (off-by-one). | `open` | exponential start point one less. |
| 68 | `src/sdk/client-sdk/api-client.ts:188` `(result as { totalCount?: number }).totalCount = totalCount` writes readonly field through cast. | `open` | cast write-back instead of object reconstruction. |

## org-governance / sso-scim

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 69 | `src/org-governance/sso-scim/oidc/oidc-service.ts:155-170,163-167,191-198,247-258,319,342-358` `validateProductionToken` in non-prod accepts `at_/id_/rt_` prefix mocks; `getState` only reclaims on read (no sweep); `redirectUri` no allowlist; `groups` filter no length limit; `validateAccessToken` linear scans all sessions. | `open` | OIDC service one-stop implementation: session storage in-memory, missing index, missing sweep, mock prefix can be exploited when dev exposure. |
| 70 | `src/org-governance/sso-scim/scim-sync/scim-service.ts:922-946,969-990,973` `evaluateFilterClause` directly runs regex `/(\w+)\s+(eq\|ne\|co\|sw)\s+"([^"]+)"/i` on user `clause` without length limit; `loadPersistedEvents` directly `JSON.parse(readFileSync(...))` without try/catch. | `open` | ReDoS / startup-time availability / prototype pollution three types of risk share root. |

## src/index.ts and startup path

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 71 | `src/index.ts:144,363,368` `JSON.parse(outputJson)` no size guardrail; line 363 `void main().catch(error => { ... })` + line 368 `process.exit(1)`: failure path does not `unref` opened resources. | `open` | failure path already fail-fast but does not consume background timer / DB connection. |
| 72 | `src/domains/registry/plugin-runtime-child.ts:226` `process.exit(1)` child process exits directly; same class root cause as round d 52. | `open` | same as above. |

## Test Quality (This round's fan-out independent audit)

| ID | Issue | Status | Root Cause |
| --- | --- | --- | --- |
| 73 | `tests/unit/ops-maturity/p2-defects-sys-perf-3-4.test.ts:39,73,105` three places `await sleep(31_000)` totaling ~93 seconds wall-clock; `tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:132,296` 500ms/1050ms; `tests/unit/platform/interface/ingress/ingress-configuration.test.ts:62,66` 250-300ms; `tests/unit/platform/interface/ingress/ingress-routing.test.ts:222` 250ms; `tests/unit/platform/state-evidence/events/review-contract-regressions.test.ts:96` 450ms; `tests/unit/ops-maturity/chaos/chaos-monitoring.test.ts:57,94` 150-350ms; `tests/unit/platform/observability/structured-logger.test.ts:413` 150ms; `tests/integration/quality/full-coverage-operational-real-paths.test.ts:208` 350ms; `tests/unit/platform/state-evidence/events/calculate-backoff.test.ts:55,101` 2-3s (although in `audit-test-hard-waits.mjs` allowlist, still real wall-clock); `tests/unit/runtime/graceful-shutdown.test.ts:82,155` 200-500ms (same allowlist); `tests/unit/platform/execution/plugin-executor.test.ts:371,428` 200ms (allowlist); `tests/unit/platform/execution/plugin-executor/plugin-executor.service.extended.test.ts:743` 500ms. | `open` | test hard waits depend on real wall-clock; `audit-test-hard-waits.mjs` allowlist too broad (contains `// timing-contract` comment of any duration + a large number of allowlist filenames), CI cannot block. |
| 74 | `tests/unit/platform/cross-plane-event-propagation.test.ts:149,196,246,288,340,388,438,480,574,620,670,739,799,869` and `tests/unit/platform/five-plane-execution/event-bus/typed-event-bus.test.ts:94,133,165,200,232,286,333,378,431,465` total 24 places `try { ... } finally { /* cleanup */ }`: `cleanupCrossPlaneTestEnvironment(env)`/`bus.dispose()`/`closeStorage(...)` actually called inside `try`, `finally` is empty placeholder, assertion failure leaks SQLite database. | `open` | cleanup written inside try, finally is decorative empty block. |
| 75 | `tests/unit/plugins/adapters/crm-adapter.test.ts:88,100,104,114,118,130,134,147,152,164,172,181,203,210,235,239,246,250,255,266` 9 places `globalThis.fetch = createMockFetch(...)` + at end `delete (globalThis as any).fetch` without `try/finally`; test failure → `globalThis.fetch` permanently stubbed. | `open` | missing `try/finally` protection. |
| 76 | 5 `as any` should use specific types: tests/unit/root-exports.test.ts:47,108; tests/unit/platform-application-kernel.test.ts:167,218; tests/unit/root-barrel-exports.test.ts:61; tests/unit/index.test.ts:241; tests/integration/root-integration.test.ts:186; tests/integration/root-entry-summary.test.ts:141; tests/integration/platform-module-catalog.test.ts:155,188 (same file line 144 already uses `as PlatformSurfaceId`); tests/unit/domains/registry/domain-registry-service.test.ts:132,342; tests/unit/core/runtime/orchestrator.test.ts:22-196 many `{} as any`; tests/unit/core/runtime/planner.test.ts:59,60; tests/unit/plugins.test.ts:360 (`suggestWorkflow` private method); tests/unit/domains/governance/hr-role-governance-service-advanced.test.ts:110,130,170; tests/unit/domains/governance/hr-role-governance-service-validation.test.ts:288,290,345; tests/integration/platform/prompt-engine/conversation-template-service.test.ts:343,347,393; tests/integration/platform/control-plane/incident-control/human-takeover-service-async-integration.test.ts:410; tests/integration/platform/control-plane/incident-control/takeover-queue-manager-integration.test.ts:371. | `open` | tests use `as any` to bypass type checker, hiding real type mismatches; especially `orchestrator.test.ts` claims to "verify re-export and type" yet uses `as any` to negate assertion meaning. |

---
## Cross-Item Root Cause Classification

| Root Cause | Affected IDs | Frequency |
| --- | --- | --- |
| HMAC key in-process `randomBytes` | 7, 22 | 2 |
| Shallow sanitize (prototype pollution) | 17, 70 | 2 |
| fetch default follows redirect | 1, 48, 65 | 3 |
| catch-all error flattening | 62, 63 | 2 |
| TTL/numeric parsing without NaN check | 25, 33 | 2 |
| Floating promise / fire-and-forget missing .catch | 34, 40, 71 | 3 |
| setInterval/setTimeout missing .unref() | 29, 30, 37 | 3 |
| `try/finally` scope too narrow | 38, 74 | 2 |
| Single Map no LRU / unbounded | 15, 18, 35 | 3 |
| Test hard waits / `timing-contract` allowlist too broad | 73 | 1 |
| `as any` replacing specific types | 76 | 1 |
| Missing per-route explicit permission set | 6 | 1 |
| String comparison on timestamps | 43 | 1 |
| Cross-plane state machine field convention inconsistent | 46 | 1 |
| Sort function side-effects on input | 45 | 1 |
| Missing O(n²) index | 41, 53 | 2 |
| Error details duplicate sensitive fields | 19, 28 | 2 |
| Failure path process.exit missing graceful close | 31, 71, 72 | 3 |
| Resource category: network guard / timeout / boundary | 14, 48, 49, 58, 60, 65, 69 | 7 |
| Missing lifecycle precondition | 57 | 1 |
| Eviction uses insertion order not LRU | 52 | 1 |
| Persist schema missing fields | 50 | 1 |

## Recommended Closure Order (Suggestion)

1. **Critical (5 items)**: 1, 34, 50, 38 (multi-step orchestration try/finally), 62 (catch-all flattening). These five affect runtime correctness + cross-process data consistency + auth/contract semantics, and are outside baseline CI.
2. **High (22 items, first batch 8)**: 5, 7, 14, 16, 17, 22, 29, 48 — auth/process/secret domain observable defects, recommend concentrated fix in batch before end of June.
3. **Medium (27 items, 10 items)**: 4, 18, 20, 27, 35, 36, 41, 49, 55, 73 (first 10 test quality items) — engineering debt, defense-in-depth, performance.
4. **Low (19 items)**: 1 per class readability/naming/sync deviation, can be incorporated into routine cleanup.

## Cross-Round Closed-Loop Retrospective (vs round d)

| Dimension | Round d (2026-05-17) | Round e (this round) | Delta |
| --- | --- | --- | --- |
| Audit script coverage | 25/25 | 25/25 (unchanged) | form-side 100% green |
| Cumulative `done` items | 1461 | 1461 (no regression) | 0 |
| New executable defects | — | 76 | +76 |
| Critical | 0 public | 5 | +5 |
| Cross-plane data divergence | closed 12 | newly discovered 4 (delegation/cdc/billing/multi-step orchestration) | ongoing |
| Test quality independent audit | not independently fan-out | fan-out 4 major categories (wait/isolation/mock/assert/skip) | across 24+ files |
| Credential/HMAC/secret | single-point closure | still 7 items in-process random keys / not redacted / no upper bound | high recurrence risk |

## Verification and Audit Replay

```bash
# 1. Baseline: current 25/25 audit scripts all pass
npm run audit:repo-hygiene

# 2. Build and type
npm run build
npm run typecheck

# 3. Three-way expert fan-out review (executed in this round):
#    - code-reviewer: 35 items → see 1-66
#    - security-auditor: 37 items (5/12/11/9 severity) → merged into 1-72
#    - test-engineer: 40 items → merged into 73-76

# 4. 4 Critical reference lines in this file have been manually verified twice:
#    http-api-server.ts:636 → resolveClientIp only returns fallback
#    delegation-manager.service.ts:934 → explicit floating promise
#    cdc-replication-service.ts:1010/1037 → clearState does not clear vectorClocks
#    multi-step-orchestration.ts:42-43 → try/finally scope only provideContext
```

## Closure Candidates (Suggested git log alignment)

- `feat(security): pin HMAC secrets via injected config` —— covers 7, 22
- `fix(http): implement X-Forwarded-For client IP resolution` —— covers 1
- `fix(delegation): await repository.updateStatus in transitionDelegationStatus` —— covers 34
- `fix(cdc): persist and clear vectorClocks in applySnapshot/clearState` —— covers 50
- `refactor(orchestration): hoist dispatcher import; widen try/finally scope` —— covers 38
- `fix(plugins): throw typed error for non-retryable plugin failures` —— covers 62
- `test(quality): re-allowlist 24+ file setTimeout calls and replace 9 crm-adapter fetch tests with try/finally` —— covers 73-75
- `chore(lint): disallow `as any` in 15+ flagged test files` —— covers 76

> This document corresponds to git tag: `v3.4-review-e-2026-06-01`, together with `docs_zh/reviews/platforme-full-review-d.md` forms this repository's continuous review trace. Next review (round f) recommended after closing 5 Critical items and before merging PR.

---

# Deep Extension: Round e Comprehensive File-Level Review (2026-06-01 second round)

> This extension is a same-day **deep file-level review**, covering 1909 src TS files, 4430 ui files, 5056 test files, 178 config files, 440 docs_zh files, deploy and scripts in entirety.
>
> Review method: 5 parallel sub-agent deep scans (not overlapping with the 76 items above), split by subsystem:
>
> - Agent 1: src/platform/five-plane-interface/ + src/platform/five-plane-control-plane/ + src/platform/five-plane-orchestration/
> - Agent 2: src/platform/five-plane-execution/ + src/platform/five-plane-state-evidence/ + src/platform/{shared,contracts,structure,stability,cost-management}/
> - Agent 3: src/{domains,plugins,interaction,org-governance,scale-ecosystem,ops-maturity}/
> - Agent 4: src/sdk/ + tests/ + config/ + deploy/ + scripts/
> - Agent 5: ui/ + docs_zh/ + docs_en/ + root README/AGENTS/CLAUDE/CONTRIBUTING/SECURITY/CHANGELOG

## Deep Review Increment Summary

| Dimension | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 | **Total** |
| --- | --- | --- | --- | --- | --- | --- |
| Output findings | 140 | 150 | 165 | 170 | 60 | **~685** |
| Critical | — | — | — | — | — | ~30 |
| High | — | — | — | — | — | ~150 |
| Medium | — | — | — | — | — | ~280 |
| Low | — | — | — | — | — | ~225 |
| Highest single-file findings | http-api-server.ts (15+) | redis-queue-adapter.ts (8) | crm-adapter.ts (8) | dlq-manager.ts (5) | workflow-builder/web/ (10) | — |
| Subsystem coverage | three planes full coverage | full coverage | 6 upper-layer domains + 30+ vertical domains | 5 domains | 4 domains | **~100%** |

> Note: the 76 items numbered 1-76 above remain this round's "high-priority summary". This extension provides 600+ **file-level, function-level** executable review, grouped by subsystem, each can be verified. This round's review is **a refinement and extension of** the 76 items above, not overlapping with them.

## Cross-Item Root Cause Clustering (Deep Review Additions)

| Root Cause Cluster | Typical Example | Frequency |
| --- | --- | --- |
| `JSON.parse` without try/catch + without size guardrail | webhook / approval / dashboard / scim / task-websocket / mission-control / harness-runs / admin / approval-context-summary / llm-improvement-generation | 25+ |
| `JSON.parse` + `as` cast to `Record<string, unknown>` / `as T` | all of src/contracts / src/sdk/client-sdk / src/scale-ecosystem | 30+ |
| Non-null assertion `!` replacing runtime check | delegation-manager / plugin-spi-registry / plugin-runtime-host / plugin-runtime-child / drift-detector / edge-runtime-sync / user-preference-tracker / billing / cdc | 40+ |
| `try { ... } catch {}` / `catch (e) {}` silently swallowing errors | goal-decomposer / chaos-experiment / nl-gateway-config-loader / conversation-history / workflow-builder / approval-context-summary / crm-adapter | 12+ |
| Repeated regex compilation on hot path | nl-gateway-support / goal-decomposer / proactive-agent / crm-adapter / github-adapter / scim-service / basic-evaluator / operations-presenter / livestream-adapter / builtin-plugin-registry / domain-risk-profile / domain-knowledge-schema / billing / interaction/nl-gateway | 20+ |
| Unbounded Map / Array (no LRU, no TTL) | runtime-recovery (lease store) / secret-management (rate limiter) / domain-* services / proactive-agent / scim-service / federation / billing / self-healing / panic-service / cost-optimization / ha-election / p2-pilot-evidence runner | 30+ |
| Temporal comparison using `==` string lexicographic order | execution-lease-service:702 (lexicographic ISO) | 1 concentrated |
| Number.parseInt without NaN/finite check | sdk/cli/secret-commands / sdk/cli/login / version-routing / sdk-version-handshake / prompt-bundle / mission / websocket-bridge / vault / channel-gateway / domain-recipe / domain-risk-profile / pack-registry / approval-routing | 25+ |
| `as any` erasing type guard | tests/unit/dispatcher/dispatcher-service (146 places) / tests/unit/org-governance/sso-scim/oidc/oidc-service-comprehensive (15 places) / tests/unit/domains/governance / tests/unit/domains/registry / tests/unit/core/runtime/orchestrator (12+ places) | 482+ files, 1500+ occurrences |
| Tests using `delete (globalThis as any).fetch` without try/finally | crm-adapter.test.ts (9 places) | 9 places |
| `void promise fire-and-forget` in route handlers without .catch | http-api-server:1209, stable-evidence-bundle, config-hot-reload, auto-stop-loss, cache-invalidation-broadcast, durable-event-bus, call-governance, external-secret-provider, release-pipeline, takeover-escalation-manager, deployment-execution, runbook-executor, human-takeover, slo-alerting-channels | 20+ |
| `setInterval` missing `.unref()` | websocket-bridge:184, task-websocket-status-relay:50, http-api-server:1064, config-hot-reload:121, slack-transport, leader-election, delegation-cron, prometheus-metrics, outbox-poller, sli-collection, federation-heartbeat, panic-propagation, secret-rotation | 14 places |
| `setTimeout` on production path not `.unref()`'d | channel-gateway:177,695,494,769, vault/gcp/aws-kms providers, slack/datadog transport, datadog, fluentd, outbox, release-pipeline, runbook-executor, takeover-escalation, deployment-execution, human-takeover, slo-alerting, config-hot-reload, panic-propagation, plugin-runtime-host:135, plugin-spi-registry:609,943, eviction-loop, queue-poll, api-server auth flow | 30+ |
| `process.exit(1)` missing graceful close | src/index.ts:368, plugin-runtime-child.ts:226, startup-env-schema:569, startup/process-error-handlers:113,181 | 5 places |
| `console.log/info/warn/error` leaks to production path | http-api-server / sdk/cli / structured-logger / panic-propagation / datadog-transport | 17 places |
| `setTimeout` not `clearTimeout`'d after `controller.abort` | sdk/cli/crm-adapter:146, github-adapter:273, vault/gcp/aws-kms providers, outbox-poller, sli-collection, websocket-bridge:494, webhook, slack-alerting, http-api-server:1127, fluentd-transport, delegation, outbox multiple | 15+ |
| `Math.random()` used for reproducibility/routing/sampling/priority | intake-router, llm-eval, outbox-poller, stability/retry, call-governance, adapter-executor, authoritative-task-store-decorator, durable-event-bus-support, channel-gateway-retry-executor | 9 places |
| `Date.now()` direct timestamp (no monotonic source) | oapeflir-loop-core/support, stage-transition-fsm, harness-decision-manager, harness-state-manager, secret-management | 5+ |
| Locale/string sort for semver comparison | domain-recipe:381, domain-eval-framework:185, mission:1354-1355, edge-runtime-sync:761, sdk-version-handshake, prompt-bundle:334-348 | 10+ |
| `as unknown as` cast erases type | tests/unit/ui/shared-package-regressions, root-bootstrap-exports-remediation, recipes-zero-coverage, domain-prompt-governance, interaction-governance-runtime-catalog etc. | 30+ |
| `package.json` command/script drift | README/AGENTS/CLAUDE/SECURITY/CONTRIBUTING vs root package.json#scripts drift | 7+ |
| zh/en doc translation drift | quality/p0-pilot-evidence-runbook, reviews/platforme-full-review-e, multiple quality reviews and full-coverage-test-manual | 7+ |
| Hardcoded doc filename references (missing ../reviews/ path) | docs_zh/contracts/* (17 files) | 17+ places |
| Helm chart hardcoding | deploy/helm/automatic-agent/templates/* — runAsUser, secret.yaml `or` chain, configmap regexMatch, networkpolicy egress, PDB, resourcequota | 15+ |
| Deploy script case-sensitivity / `set -e` / TOCTOU | deploy/scripts/deploy.sh, rollback.sh, dr-drill.sh, verify-hot-upgrade.sh | 15+ |
| Test hard waits + `timing-contract` allowlist too broad | distributed-rate-limiter:1050ms, ingress:120-300ms, review-contract:450ms, chaos-monitoring:350ms, structured-logger:150ms, calculate-backoff:2-3s, graceful-shutdown:200-500ms, plugin-executor:200-500ms, full-coverage-operational-real-paths:350ms, p2-defects-sys-perf-3-4:31s × 3 | 17+ |

---

## 1. src/platform/five-plane-interface/ (Deep)

> Agent 1 main.

### api/http-server/

- `billing-routes.ts:63-66` — `verifyWebhookSignature` | security | `Number(timestampHeader) * 1000` assumes seconds-unit epoch; if upstream sends milliseconds, difference is huge, age check always fails. `Math.abs(...)` allows future timestamps within 5 minutes.
- `billing-routes.ts:39-46` — `isTimingSafeHexEqual` | security | first use regex `/^[a-f0-9]{64}$/i` to validate hex format then `timingSafeEqual`; non-hex returns false directly; acceptable.
- `gateway-routes.ts:118-122` — webhook receive | security | `requirePrincipal("operator")` + signature verification double protection, external webhook provider will not have operator JWT; should only do signature verification.
- `incident-routes.ts:150` — `void principal;` | readability | refactoring leftover "pretend to use" statement.
- `admin-routes.ts:209-233` — `applyAdminConfigUpdate` | correctness | when `deps.adminConfigService` is null falls back to synthetic object, not persisted; returns 200 fake success.
- `admin-routes.ts:498-512` — `PUT /v1/preferences` | correctness | `userPreferenceState` module-level Map, last-writer-wins; actorId not recorded.
- `admin-routes.ts:237-252` — `resolveWorkflowLookupId` | performance | on cache miss pulls 200 entries linear scan.

### api/middleware/

- `idempotency-key.ts:316` — `verifyNonce` | performance | lookup-then-insert not atomic; two concurrent same nonce double-write.
- `idempotency-key.ts:131-148` — `EXEMPT_PATHS` | security | only `'/v1/webhooks/'` first-level; deeper webhook sub-paths not exempt.
- `idempotency-key.ts:209-220` — `check` | correctness | `requestInFlight` decision returns but not passed to handler.
- `idempotency-key-storage.ts:197` — JSON.parse | correctness | parsing `data` field without try/catch.
- `request-deduplication.ts:151-154` — `check` | correctness | sort+splice O(n log n) should use min-heap.
- `request-deduplication.ts:216-232` — `enforceBucketLimit` | performance | O(buckets × entries) full scan on each insert.
- `rate-limit.ts:96-157` — `RateLimiter.check` | correctness | new bucket initial `tokens: maxRequests - 1`, actual capacity one less.
- `rate-limit.ts:131-135` — `check` | performance | `Math.floor(elapsed * tokensPerMs)` integer truncation; `lastRefillAt` accumulates drift.
- `rate-limit.ts:187-195` — `evictIfNeeded` | correctness | Map insertion order → FIFO not LRU; adversarial clients can be flooded.
- `cors.ts:59-60` — `validateCorsConfigInternal` | security | accepts control characters in origin regex check, but Node `new URL()` parsing inconsistent.
- `cors.ts:106-110` — `CorsMiddleware` | correctness | `allowedHeaders` one-time lowercase cache; runtime mix-case inconsistent.
- `sdk-version-handshake.ts:127-129` — `parse` | correctness | `Number.parseInt(part, 10) || 0` makes "0" and NaN indistinguishable; accepts `2026-04-01` date format.
- `sdk-version-handshake.ts:131-133` — `isStrictSemver` | correctness | accepts `1.2` partial semver; semantics unclear.
- `version-routing.ts:103-115` — `selectVersion` | correctness | `q-value` parse accepts `;q=invalid` still matches first item.
- `version-routing.ts:145-157` — `compareVersions` | correctness | zero-padding inconsistent: `2026-4-1` vs `2026-04-01` considered equal.
- `sanitize.ts:22-43` — `sanitizeJsonValue` | security | `Object.create(null)` blocks prototype chain but downstream `instanceof Object` check fails.

### api/

- `api-auth-service.ts:333-336` — `exchangeApiKey` | security | `timingSafeEqual` wraps hashed comparison, OK.
- `api-auth-service.ts:376-405` — `authenticate` | security | after bearer failure still uses `x-api-key` to issue JWT on the spot; missing per-key rate limit/audit.
- `api-auth-service.ts:330-364` — `exchangeApiKey` | correctness | `iat` can be set to future time, `iat > now` not rejected.
- `api-auth-service.ts:120-132` — `WEAK_JWT_SECRET_PATTERNS` | security | only whole-word match after trim; `secret123` not blocked.
- `http-api-server.ts:1064-1068` — `startWorkerHeartbeatSweep` | performance | each tick constructs `new WorkerRegistryService(...)`.
- `http-api-server.ts:1099-1116` — `trackActiveRequest` | correctness | count underflow prevention under finish/close events; but leaks when `close` does not emit finish.
- `http-api-server.ts:1119-1138` — `waitForActiveRequestsToDrain` | correctness | `onDrained` only self-removes in timeout branch; leftover entries when drain completes.
- `http-api-server.ts:1086-1093` — `sweepStaleWorkerHeartbeats` | correctness | `staleWorkerIncidentIds` only added on "open incident"; never cleared on worker recovery, unbounded.
- `http-api-server.ts:1289-1294` — `createDefaultApiRateLimiter` | security | silently falls back to in-memory when Redis missing, distributed deployment bypasses per-tenant rate limit.
- `oidc-oauth-service.ts:13,71,647-648` — PKCE | security | uses `createHash("sha256")` (correct), but `code_challenge_method=plain` path has no minimum entropy; missing test.
- `oidc-oauth-service.ts:647` — comment "Use createHash, not createHmac" | readability | non-obvious algorithm choice relies on comment.
- `oidc-oauth/jwt-utils.ts:28` — `decodeJwt` | security | base64url decode without try/catch; malicious token triggers 500.
- `api-mission-control-service.ts:478` — JSON.parse | correctness | `value` source not validated, directly parsed.
- `task-websocket-status-relay.ts:212` — JSON.parse | correctness | parses `payloadJson` without try/catch.

### webhook/

- `webhook/index.ts:60-61` — replay cache TTL/capacity | correctness | module constants cannot be configured by tenant.
- `webhook/index.ts:72` — `envelopesByIdempotencyKey` | performance | missing TTL and capacity eviction.
- `webhook/index.ts:73-74,200-211` — state Map unbounded | performance | `acceptedEnvelopes` / `failureCounts`.
- `webhook/index.ts:111-120` — validation order | security | event-type check before signature check; `allowedEventTypes` enumerable.
- `webhook/index.ts:182-184` — `rollbackAcceptedEnvelope` | performance | findIndex linear scan.
- `webhook/index.ts:296-315` — `parseWebhookPayload` | performance | no body size limit; oversized JSON blocks event loop.

### scheduler/long-running-workflow-service.ts

- `:117-122` — `markDue` | correctness | `expiresAt` expired silently skipped; relies on `sweepExpired` fallback.
- `:131-146` — `resume` | correctness | does not check suspension status="active"; can resume already cancelled/expired.
- `:131-138` — `resume` | correctness | `resumeAfter > now` forever not-due, state never advances.

### channel-gateway/

- `channel-gateway-service.ts:177,695` — request setTimeout | performance | missing .unref(), blocks process exit.
- `channel-gateway-retry-executor.ts:54-106` — `intervalHandle` timer | correctness | autoStart path `runOnce` and `start` schedule race.
- `channel-gateway-retry-executor.ts:71-74` — `start` race | correctness | `running` set before first setTimeout.
- `channel-gateway-delivery-service.ts:130-163` — `checkRateLimit` | correctness | `Math.max(persisted, inMemory)` wrong under multi-instance.
- `channel-gateway-delivery-service.ts:257` — `parseInt(timestamp, 10)` no NaN check | correctness.
- `channel-gateway-delivery-service.ts:265-292` — `verifySignature` | security | `Buffer.from(signature, "hex")` accepts non-hex; `timingSafeEqual` still takes time on length mismatch.
- `channel-gateway-delivery-service.ts:317-336` — `verifyNonce` | correctness | SELECT-then-INSERT not atomic; multi-process concurrent double-write.
- `channel-gateway-delivery-service.ts:73` — `recentRateLimitHits` | performance | process-level unbounded.
- `channel-gateway-delivery-service.ts:778` — `JSON.parse(String(row.payload_json))` | correctness | no try/catch.
- `websocket-bridge.ts:170-188` — constructor | readability | many `Math.max(1, Math.trunc(...))` defensive patterns.
- `websocket-bridge.ts:177-183` — missing Origin check | security | browser can be cross-origin hijacked (CSWSH).
- `websocket-bridge.ts:184` — `heartbeatTimer` | performance | `setInterval` missing .unref().
- `websocket-bridge.ts:212-219` — `principal` TDZ | correctness | `principal` declared before auth; catch path throws ReferenceError.
- `websocket-bridge.ts:227-239` — `handleConnection` | correctness | after auth failure `error` handler still references outer `principal`.
- `websocket-bridge.ts:346` — `JSON.parse(data.toString())` | correctness | no try/catch.
- `websocket-bridge.ts:494,769` — setTimeout missing .unref() | performance.
- `websocket-bridge.ts:701` — `parseInt(raw, 10)` no NaN check | correctness.
- `channel-gateway/helpers.ts:12` — `JSON.parse(raw)` | correctness | no try/catch.
- `stream-bridge.ts:62` — `JSON.parse(jsonString)` | correctness | no try/catch.
- `gateway-target-directory-service.ts:493` — `JSON.parse(raw)` | correctness | no try/catch.

## 2. src/platform/five-plane-control-plane/ (Deep)

> Agent 1 main.

### iam/

- `secret-management-service.ts:685-691` — `refreshSecret` | correctness | provider.refreshSecret ?? describeSecret → second describeSecret → three calls.
- `secret-management-service.ts:729-732` — `startDailyRotationScheduler` | correctness | repeated calls do not delete first timer, set unbounded.
- `secret-management-service.ts:729-777` — `runRotationSweep` | correctness | sync initial sweep throws without try/catch.
- `secret-management-service.ts:351-432` — `resolveSecret` | correctness | whole operation wrapped in `db.transaction(async () => ...)`, SQLite implementation may not support async.
- `policy-engine.ts:316-320` — `evaluate` audit event | performance | cache-hit also emits audit, volume explodes.
- `policy-engine.ts:303-308` — `evaluate` | correctness | `isPolicyStale()` predicate has side effects; concurrent double-triggers cacheInvalidationHandler.
- `policy-engine.ts:222-258` — `buildCacheKey` | performance | `slice().sort().join(",")` O(n log n) each time.
- `policy-engine.ts:316-320` — `evaluate` | correctness | `cloneCachedDecision` reuses `auditRecord.evaluatedAt`, time misalignment.
- `audit-event-integrity.ts:36` — hardcoded HMAC key | security | `"audit-integrity-secret-key-32-bytes!"` default value.
- `audit-event-integrity.ts:170-181` — checksum field order | correctness | field order depends on JSON.stringify insertion order.
- `audit-event-integrity.ts:313-322` — dead code `sha256` | readability | defined but unused.
- `access-model.ts:266-269` — `evaluateAuthorizationContext` | readability | `allLayers` reports deny even on RBAC-only path.
- `access-model.ts:312-339` — tenantId precedence | security | `input.principalTenantId` priority higher than original principal; impersonation can escalate.
- `access-model.ts:312-339` — `originalPrincipal` no cryptographic verification | security | caller can forge.
- `access-model.ts:233-243` — empty capabilities array ignored | correctness | `input.capabilities?.length` empty array falsy → falls back to role capabilities.
- `outbound-url-policy.ts:137-140` — error message leaks URL | security | error message contains raw `urlString`.
- `outbound-url-policy.ts:155-190` — `sanitizeUrlForTelemetry` and catch branch regex inconsistent | security.
- `outbound-url-policy.ts:116-118` — `isInternalNetworkUrl` | security | only checks hostname, no DNS resolution → DNS rebinding.
- `network-egress-policy.ts:316-374` — `allowed` variable semantics | correctness | `audit_only` mode still returns `allowed: true` misleading.
- `network-egress-policy.ts:310-311` — `parseUrlForAudit` | correctness | parse failure falls back to raw URL, contains `user@host`.
- `network-egress-policy.ts:455-463` — `createPolicyAwareFetch` error message contains URL | security | may leak token.
- `sandbox-policy.ts:80-88` — single SHA-256 derivation | security | inconsistent with login.ts scryptSync.
- `sandbox-policy.ts:501-504` — `checkSandboxPath` | correctness | `normalizeRoot(root, false)` and `(root, true)` repeated 2N times realpath.
- `sandbox-policy.ts:357-364` — `normalizeSandboxInputPath` | security | catch branch does not do NFKC normalization.
- `network-egress-audit.ts:112-128` — module-level regex compilation | performance | OK.
- `aws-kms-http-secret-provider.ts:208,294` — env endpoint no validation | security | `AA_AWS_KMS_ENDPOINT` used directly.
- `aws-kms-http-secret-provider.ts:275-296` — `X-Amz-Target` header concatenation | security | no whitelist.
- `gcp-secret-manager-http-secret-provider.ts:101-104` — `AA_GCP_TOKEN_FETCH_URL` | security | completely no host/protocol check.
- `vault-http-secret-provider.ts:93,132` — `parseInt(... 10)` no NaN check | correctness.
- `cve-intelligence-service.ts` (755 lines) | architecture | entry not verified in sampling.
- `research-source-governance.ts:80-88` — zod strict but transform still allows unrelated fields | correctness | same as domain-model.ts transform defect.

### approval-center/

- `approval-service.ts:451-568` — `applyDecision` | security | any caller knowing approvalId can decide.
- `approval-service.ts:463-465` — `applyDecision` | correctness | already-decided silently returns.
- `approval-service.ts:584` — `applyExecutionEffect` | correctness | only `"blocked"` state becomes cancelled; running state preserved.
- `approval-service.ts:300-303` — `deriveDefaultHarnessRunId` | correctness | same taskId and executionId=null multiple approvals share harnessRunId.
- `multi-party-approval-service.ts:105-117` — `applyDecision` | security | same as above no auth.
- `multi-party-approval-service.ts:115-117` — silent return | correctness.
- `multi-party-approval-service.ts:123-125` — `decisions.push` | correctness | terminal-state decisions also pushed, count wrong.
- `multi-party-approval-service.ts:135-138` — `approvalsReceived++` | correctness | repeated decisions from same approver also accumulate.
- `approval-policy-engine/rule-engine.ts:120-132` — `getFieldValue` | security | does not block `__proto__/constructor/prototype/Function.prototype` path.
- `approval-policy-engine/rule-engine.ts:128` — string parts index | security | hits Function.prototype members.

### config-center/

- `config-store.ts:116-120` — `set` | correctness | version incremented even if value unchanged.
- `config-store.ts:264-275` — `stableSerialize` | correctness | `localeCompare` inconsistent across locales.
- `config-audit-service.ts` (1014 lines) | architecture | entry not sampled.
- `config-versioning-service.ts` (807 lines) | architecture | entry not sampled.
- `config-hot-reload-service.ts:121,426` — `setInterval` missing .unref() | performance.
- `config-hot-reload-service.ts:450-457` — round d 37 closure 32-bit hash still a rolling concern | correctness.
- `startup-env-schema.ts:5,459,569` — `process.exit(1)` missing graceful | correctness.
- `startup-env-schema.ts:376` — round d 49 closure default-allow fixed, but path still has break | correctness.

### incident-control/

- `auto-stop-loss-service.ts:99-...` — `registerDefaultHandlers` | readability | multiple stub handlers (circuit_break, scale_down).
- `auto-stop-loss-service.ts:786` — playbook fire-and-forget | performance | no .catch.
- `takeover-escalation-manager.ts:123,207` — setTimeout missing .unref() | performance.
- `deployment-execution-service.ts:181` — setTimeout missing .unref() | performance.
- `runbook-executor.ts:541` — setTimeout missing .unref() | performance.
- `release-pipeline-support.ts:231` — setTimeout missing .unref() | performance.
- `human-takeover-service-async.ts:793` — setTimeout missing .unref() | performance.
- `cost-alert-service.ts:194-199` — `evaluateCost` | correctness | denied does not update pendingProjectedCostUsd, retry accumulates.
- `cost-alert-service.ts:243-244` — `recordCost` | correctness | `Math.max(0, ...)` masks over-limit negative values.
- `cost-alert-service.ts:295-356` — `recordCost` | correctness | `wasWarning` independently sent from `wasExceeded`/`wasCritical`, duplicate alerts.

### mission/ (1641 lines) and iam/cve-intelligence-service.ts (755 lines)

- Only directory checked, not sampled at line level; recommend specifying sampling range in round f.

## 3. src/platform/five-plane-orchestration/ (Deep)

> Agent 1 + Agent 3 joint.

### oapeflir/

- `oapeflir-loop-core.ts:218-...` — `run` | correctness | 600+ lines; `createMonotonicTimestampGenerator` still based on `Date.now()`, duplicate timestamps on NTP rollback.
- `oapeflir-loop-core.ts:303-...` | architecture | each stage sequential await, no parallelism opportunity.
- `oapeflir-loop-core.ts:382`, `oapeflir-loop-support.ts:324`, `stage-transition-fsm.ts:189-223` | correctness | multiple `Date.now()` non-monotonic.
- `stage-transition-fsm.ts:196-200` — `recordStageEntry` | correctness | `status: "error" | "blocked"` still advances `currentStageIndex`.
- `stage-transition-fsm.ts:196-200` — transactional | correctness | `recordStageEntry` / `recordCompletion` not transactional; out-of-order calls can desync.
- `stage-transition-fsm.ts:259-266` — `reset` | correctness | skip evidence (skippedReasonCodes and stageTimestamps discarded together).
- `stage-transition-fsm.ts:272-286` — `resetToStage` | correctness | no session lock, can race with concurrent transition.
- `runtime-execute-bridge.ts:47` — `parseExternalModelPayload` | correctness | `JSON.parse(raw) as T` no size/depth limit.
- `runtime-execute-bridge.ts:182` — `defaultModelId="MiniMax-M2.7"` | architecture | hardcoded vendor model.
- `runtime-execute-bridge.ts:194,264,316` — `createdAt: Date.now()` number vs string | correctness | type drift with Plan.createdAt.
- `oapeflir-loop-support.ts:775` — `Number.parseInt` | correctness | no NaN check.
- `oapeflir/handoff-model.ts:55-57` — token estimation | performance | estimates token by ASCII characters, CJK/multibyte distorted.
- `oapeflir/handoff-model.ts:88-135` — compression silently discards historyRefs etc. | correctness | no discard ledger.
- `improve-rollout/policy-rollout-service.ts:39-73` — `decide` | correctness | `rolloutFreezeManager.isFrozen()` only checks one place; guardrailDecision does not expand reasonCodes sort.
- `improve-rollout/policy-rollout-service.ts:144-184` — `evaluateMetricsGate` | correctness | when `metrics` missing some status goes allow; `autoRollback` reuses same metrics.
- `improve-rollout/auto-rollback-service.ts:75-100` — `evaluate` | correctness | `shouldRollback` consistent with `reasonCodes.length > 0`; but handler is silently triggered when `shouldRollback && this.rollbackHandler` instead of returning decision.

### harness/

- `harness-decision-manager.ts:143-145` — `persistDecisionEvidence` | correctness | `tenantId = "tenant:" + harnessRunId.split(":")[0]` parses to `"tenant:harness_run"`.
- `harness-decision-manager.ts:108` — `decide` | correctness | `requiresHuman` multiple duplicate checks.
- `harness-state-manager.ts:120-122` — `ensureRunning` | correctness | `failed` is terminal, pause failure is meaningless.
- `harness-state-manager.ts:147-155` — `transitionRunStatus` | correctness | `completed → paused` resets `completedAt: null`.
- `harness-state-manager.ts:77-81` — `assertInvariants` | architecture | same list appends with/without prefix versions.
- `constraint-pack.ts:147-153` — `normalizeConstraintPack` | correctness | `legacyBudget!` non-null assertion unsafe.
- `constraint-pack.ts:154-160` — `maxTokens` copied to 6 fields | correctness | implicit magic.
- `memory-manager.ts:155-166` — `isSelfEnhancementAttempt` | security | `key.toLowerCase().includes(pattern)` can be constructed (e.g. `safe_modify_own_prompt`).
- `memory-manager.ts:155-166` | security | only checks key, no recursive value.
- `async-harness-service.ts:32-54` — `execute` | correctness | catch uses old `queued` to overwrite running state, running transition lost.
- `toolbelt-assembler.ts:79-90` — slice at high risk | correctness | `slice(0, ceil(0.5))` implicit order dependency.
- `approval-context-summary-service.ts:178` — `parseImprovementsFromResponse` | correctness | `jsonMatch[0]` regex extracts JSON but fallback only returns first item.

### agent-delegation/

- `delegation-manager.service.ts:267-273` — `cancel` | correctness | CAS fence token misalignment.
- `delegation-manager.service.ts:296-301` — `complete` | correctness | `?? await this.getDelegation(...)` dead code.
- `delegation-manager.service.ts:354-356` — `fail` | correctness | same dead code.
- `delegation-manager.service.ts:619-634` — `revokeExpiredDelegations` | correctness | in-memory copy overwrites DB timestamp.
- `delegation-manager.service.ts:269-281` — `cancel` | security | no auth check.
- `delegation-governance-service.ts:232-237` — `matchesCondition` | correctness | `>=` comparison vs doc "deeper than 5" comment ambiguous.
- `delegation-governance-service.ts:142-150` — `evaluate` | correctness | after sort deny priority, but `deny` short-circuits once returned; OK.
- `context-isolator.ts:197-199` — `determineIsolationLevel` | correctness | `workspace_write` parent also mapped to SANDBOXED, overly strict.
- `context-isolator.ts:277-278` — `narrowPermissionsInternal` | security | `FULL` returns shallow copy, child copy stale after parent revoke.
- `context-isolator.ts:303-308` — `narrowPermissionsInternal` | correctness | when `requiredPermissions.resources` empty falls back to parent full set.
- `call-depth-budget.ts:17-29` — `evaluate` | correctness | field name `delegationDepth` is increment but semantics unclear when added to `currentCallDepth`.

### hitl/

- `hitl-modes.ts:79-81` — `validateHitlModeRequest` | security | `breakGlassApproved` comes from caller input, no cryptographic verification.
- `hitl-inbox-service.ts:98` — `resolveStatus` | correctness | OR logic also judges "no signal but decisionEffect non-continue" as decided.
- `hitl-approval-orchestration-service.ts:127-128` — `requestApproval` | security | `request.breakGlassApproved` skips critical auto-approve restriction.
- `hitl-approval-orchestration-service.ts:218-238` — `applyDecision` | correctness | does not write audit trail.
- `hitl-approval-orchestration-service.ts:240-260` — `buildTimeoutDecision` | correctness | default `respondedBy = "system:hitl_timeout"` not overridable.

### learn/

- `strategy-learning-service.ts:22-28` — `learn` | correctness | `validateMany` loses source mapping.
- `llm-improvement-generation-service.ts:122-124` — `parseImprovementsFromResponse` | correctness | only returns one item when `signals[index]` missing.
- `learning-object-validator.ts:26-34` — PII regex defect | security | `[A-Z|a-z]` contains literal `|`; no word-bound.
- `learning-object-validator.ts:43-48` — `scanForPiiAndSecrets` | performance | regexes inlined compiled.

### routing/ + planner/

- `workflow-planner.ts:151-180` — `plan` | correctness | missing cycle detection.
- `agent-team-service.ts:92` — `buildPlan` | correctness | `validateDelegationContext` definition not found.
- `plan-builder.ts:80-96` — `build` | correctness | default `execute` is mutation action, bypasses tool policy.
- `plan-builder.ts:130-157` — `build` | correctness | `inferredDependencies` computed twice.
- `plan-dag-validator.ts:79-94` — `validate` | correctness | entry/terminal check reads already-decremented `incomingCounts`, always 0.

## 4. src/platform/five-plane-execution/ (Deep)

> Agent 2 main.

### queue/

- `redis-queue-adapter.ts:387-392` — `RedisQueueClient.hmset` | correctness | after constructing `args` ignored, directly `hmset(args[0] as string, data)`.
- `redis-queue-adapter.ts:539-575` — `claimWaitingJobWithoutEval` | correctness | `zrangebyscore` + per-id `hgetall` not atomic; two workers grab same job.
- `redis-queue-adapter.ts:583-590` — `InMemoryRedisLike.eval` | architecture | only supports `redis_queue_claim_waiting_job`.
- `redis-queue-adapter.ts:111-114` — `InMemoryRedisLike.del` | correctness | `||` short-circuit causes second delete to skip.
- `redis-queue-adapter.ts:127-144` — `InMemoryRedisLike.zrangebyscore` | correctness | does not support `(` prefix exclusive bound.
- `redis-queue-adapter.ts:219-266` — `InMemoryRedisLike.eval` | correctness | reverse-iterating zset not re-sorted, highest score first out.
- `redis-queue-adapter.ts:845-869` — `dequeueAsync` nack | correctness | dead_letter transition does not increment attempts, poison message dead loop.
- `redis-queue-adapter.ts:947-977` — `purgeAsync` | correctness | `readPipeline.exec()` index alignment assumption.
- `redis-queue-adapter.ts:984-1011` — `statsAsync` | performance | N+1 sequential `getJobAsync`.
- `redis-queue-adapter.ts:330` — `process.env.NODE_ENV === "production"` | architecture | production code should not branch on NODE_ENV.
- `sqlite-queue-adapter.ts:67-83` — `dequeue` | correctness | three non-transactional statements; concurrent double pick.
- `sqlite-queue-adapter.ts:94-107` — nack | correctness | SELECT-then-UPDATE not transactional.
- `sqlite-queue-adapter.ts:135-144` — `retryJob` | correctness | does not check `result.changes`.
- `queue-partitioner.ts:99-115,120-126` — sync/async misalignment | correctness | Redis adapter takes sync method throws `sync_*_not_supported`.
- `queue-adapter-types.ts:9,64-75` — interface confuses sync/async | architecture | no compile-time differentiation.
- `queue-adapter-types.ts:9` — `QueueJobStatus` includes `"failed"` but SQLite never writes | correctness | dead value.

### distributed-lock/

- `redis-lock-adapter.ts:173` — `acquireAsync` | correctness | fencingToken takes global `FENCING_COUNTER_KEY`, cross-lock order inconsistent with external observers.
- `redis-lock-adapter.ts:186` — release Lua missing pcall | correctness | round d 1406 already fixed; this round new: cjson.decode failure logic does not cover all failure paths.
- `redis-lock-adapter.ts:197-224` — `extendAsync` | correctness | local `nextFencingToken` cache and remote `INCR` cache skew.
- `redis-lock-adapter.ts:226-253` — `forceStealAsync` | security | any caller can override; can be used as DoS.
- `redis-lock-adapter.ts:266-292` — `listHeldAsync` | performance | `scan` no MATCH full database scan.
- `sqlite-lock-adapter.ts:78-88,90-155` — `acquire` | correctness | `beginImmediateTransaction` throws but rollback still executes.
- `sqlite-lock-adapter.ts:140-152` — `normalizeTtlMs` | correctness | 1s-600s hardcoded no config.
- `sqlite-lock-adapter.ts:153-154` — `acquire` | correctness | failure returns `acquired: false` no errorCode.
- `sqlite-lock-adapter.ts:210-247` — `forceSteal` | security | no auth.
- `pg-advisory-lock-adapter.ts:62-72` — `normalizeDriverError` | security | "Cannot find module" string match.
- `pg-advisory-lock-adapter.ts:99-116` — `extend` | correctness | PostgreSQL advisory lock is session-scoped, no TTL; `extend` only updates memory.
- `pg-advisory-lock-adapter.ts:146-153` — `acquireAsync` finally | correctness | `!this.heldLocks.has(lockKey)` is false after heldLocks.set, skip unlock; logic reversed.

### lease/

- `execution-lease-service.ts:175-180` — `acquireLeaseWithinTransaction` | correctness | `ttl_out_of_bounds` early return but still clamps write.
- `execution-lease-service.ts:199` — `insertExecutionLease?.(...)` | correctness | optional chain silently does not persist.
- `execution-lease-service.ts:433-440` — `handoverLease` | correctness | missing TTL boundary check.
- `execution-lease-service.ts:454-507` — `handoverLease` | correctness | fencingToken can duplicate between SELECT/INSERT.
- `execution-lease-service.ts:702` — `activeLease.expiresAt <= occurredAt` | correctness | string lexicographic comparison, unreliable across clock sources.
- `lease-repository-sqlite.ts:139-160` — `updateLeaseStatus` | correctness | handover→released not in state machine table.

### dispatcher/

- `execution-dispatch-service.ts:194-243` — `dispatchNext` | correctness | listTickets outside transaction, lease grant inside transaction; two dispatchers concurrent double attempt.
- `execution-dispatch-service.ts:894-906` — `prioritizeStarvedTickets` | correctness | sort has side effects on input; outer variable re-assignment.
- `execution-dispatch-service.ts:909-926` — `getCandidateWorker` | performance | on each miss `listWorkers().find(...)` linear scan.
- `execution-dispatch-service.ts:1029-1086` — `invalidatePoisonPillTicket` | correctness | status check outside transaction.
- `execution-dispatch-service.ts:1076-1085` — `traceId` can be null | correctness | execution already deleted.
- `admission-controller.ts:113-115` — `isPriorityElevated` | readability | separately defined from `isElevatedRisk`.
- `admission-controller.ts:154-160` — `snapshot` | performance | O(N) tasks each enqueue check.
- `admission-controller.ts:182-188` — `evaluate` | correctness | user `maxRiskClassTasks` fully overrides default.
- `admission-controller.ts:295-302` — `evaluate` | correctness | tier-1 ack backlog check placed after risk-class, priority inverted.
- `execution-deviation-detector.ts:15-38` — `detect` | correctness | multiple feedbacks in one batch push multiple deviations.

### recovery/

- `runtime-recovery-service.ts:611-630` — `inferReason` | correctness | `!record.latestPrecheck.allowed` misclassifies when `allowed === 1`.
- `runtime-recovery-service.ts:295-314,473-475` — `listDivisionRecoveryOverview` | performance | three independent store calls.
- `runtime-recovery-decision-service.ts:176-194` — `apply` comment + transaction | correctness | SQLite transaction does not support async.
- `runtime-recovery-replay-service.ts:387-401` — `matchesExecution` | correctness | `recovery:dead_lettered` early-return false kills matching; line 401 string eq no UUID check.
- `ha/leader-election-service.ts:412-430` — `transferLeadership` | correctness | `releaseLeadership` failure still reports lost.
- `ha/leader-election-service.ts:435-466` — `forceAcquireLeadership` | correctness | compat layer `forceAcquire` only effective on object-input path.
- `ha/leader-election-service.ts:786-789` — `queryLeadershipCompat` | correctness | `length >= 1` check unreliable.
- `ha/leader-election-service.ts:739-754` — `scheduleElectionRetry` | correctness | reuses renewalIntervalMs as election timeout.
- `ha/lease-reclaimer-service.ts:84` — `this.coordinator = options.coordinator as ...` | correctness | optional parameter non-null assertion.
- `ha/ha-coordinator-service-async.ts:152-158` — `acquireLeadership` | correctness | per-node await, mid-crash can cause split-brain.
- `ha/ha-coordinator-service-async.ts:228` — `renewLeadership` | correctness | `fencingToken: currentLease.ttlMs` wrong use of ttlMs as fencing.
- `ha/ha-coordinator-service-async.ts:514-518` — `nextFencingToken` | correctness | process-level counter, restart zero may collide.
- `ha/ha-coordinator-service-async.ts:508-510` — dead code | architecture | "This would need a method in HaRepository - for now return 0".

### worker-pool/

- `worker-registry-service.ts:509-525` — `recordHeartbeat` | architecture | each heartbeat emits auto-scaling signal; try/catch only logs.
- `worker-registry-service.ts:791-799` — `getEventBusPublisher` | architecture | `Reflect.get(store, "_eventBus")` private field coupling.
- `worker-load-balancing.ts:136-143` — `summarizeWorkerLoadSkew` | correctness | when `dominant.loadScore === 0` never detects skew.

### plugin-executor/

- `sub-workflow-executor.ts` (983 lines) | architecture | entry not sampled.
- `scoped-external-access-sandbox.ts:92-129` — `validateOutboundRequest` | security | only host allowlist, missing protocol; `fetch` no `redirect: "error"`.
- `scoped-external-access-sandbox.ts:306` — `fetch` missing `redirect: "error"` | security | SSRF pivot.
- `adapter-executor.ts:159` — `Math.random()` for jitter | performance | should be input-based.
- `adapter/browser/human/sub-workflow executor` entry not sampled.

### tool-executor/

- `tool-output-sanitizer.ts:20,28` — `eslint-disable no-control-regex` | readability | actively disabling lint suggests risk.
- `web-search.ts:298-326` — `await response.text()` | performance | no body size limit → OOM.
- `web-search.ts:298-326` | security | DNS rebinding still possible to poison.
- `tool-risk-enforcer.ts:51` — `process.env.AA_PLATFORM_ROOT ?? process.cwd()` | architecture | runtime env read should go through DI.

### startup/

- `graceful-shutdown.ts:251-254` — `requestSignalExit` | correctness | `setImmediate(() => process.exit(code))` conflicts with `exitHandler`.
- `graceful-shutdown.ts:282` — `executeShutdown` | correctness | after `Promise.race` timeout still has leftover `setTimeout`.
- `graceful-shutdown.ts:300-302` — `executeShutdown` | correctness | `abortController.abort()` in `finally` still triggers signal listener.
- `graceful-shutdown.ts:317-334` — `orderHandlersForShutdown` | correctness | topological sort for cycle degenerates to splice(last-1).
- `process-error-handlers.ts:110-181` — `process.exit(1)` fallback | correctness | OK but still takes hard-exit path.

## 5. src/platform/five-plane-state-evidence/ (Deep)

> Agent 2 main.

### truth/

- `sqlite-database.ts:307-319` — `transaction`/`readTransaction` | correctness | deferred BEGIN blocked by write lock, reader starvation.
- `sqlite-database.ts:455-494` — `runInTransaction` | correctness | after COMMIT/RELEASE throws result lost.
- `sqlite-database.ts:152-174` — `migrate` | correctness | checksum mismatch no recovery path.
- `sqlite-database.ts:331-356` — `healthCheck` | correctness | `SELECT 1` inside write transaction does not verify write path.
- `sqlite-database.ts:363-386` — `close` | correctness | WAL checkpoint failure throws, original error masked in finally chain.
- `authoritative-task-store.ts` (re-export) | architecture | entry not sampled.
- `migration-runner.ts:41-43` — `down` | correctness | returns result but no actual down-migrate.
- `migration-runner.ts:60-76` — `buildResult` | correctness | `down` also reports `upToDate: true`.
- `storage-quota-service.ts:163-178` — `enforceCategory` | correctness | no concurrency control, new file immediately deleted.
- `storage-quota-service.ts:296-336` — `resolveDeclaredPath` | correctness | deep loop, unmatched path takes hundreds of times.
- `session-dual-storage.ts:132-181` — `appendSessionEvent` | correctness | state inconsistent on partial failure.
- `session-dual-storage.ts:132-181` — `appendSessionEvent` | performance | two `fdatasyncSync` per event block event loop.
- `crypto-shredding-service.ts:355-425` — `readField/writeField` | security | shallow sanitize, prototype pollution risk (round d 1414 closure same source). This round new: line 392 path resolution inconsistent on unicode normalization.

### events/

- `durable-event-bus.ts:316-389` — `publish` | correctness | `scheduleFanOut` outside transaction; event persisted but not fanned out after crash.
- `durable-event-bus.ts:484-516` — `StructuredLogger.writeToGlobalFileSink` | performance | `fsync` blocks event loop.
- `durable-event-bus.ts:594-598` — `deliverOneWithResult` | correctness | `markEventAck` write failure → event re-delivered.
- `durable-event-bus.ts:849-919` — `processPartitionQueue` | correctness | `void chain.finally` swallows `processPartitionQueue` errors.
- `durable-event-bus.ts:900-911` — `processPartitionQueue` | correctness | DLQ persistent failure does not re-throw, events silently lost.
- `durable-event-bus.ts:1080-1083` — `resolvePublishSequence` | correctness | process-level Map, sequence resets to zero on restart.
- `durable-event-bus.ts:114-164` — `subscribe` | correctness | generation self-increments, old in-flight delivery's generation reference stale.
- `durable-event-bus.ts:909-912` — `processPartitionQueue` | correctness | `groupDeliveryCounts` when initially 0 `?? 1` mistakenly enters 1.
- `durable-event-bus-support.ts:82-86` — `calculateBackoff` | performance | `Math.pow(2, n)` overflows Infinity for large n.
- `durable-event-bus-support.ts:110-135` — `ensureEventReferencedTask` | correctness | silently creates placeholder task.
- `sqlite-dlq-repository.ts:289-316` — `rowToRecord` | correctness | `operatorActionLogJson` JSON.parse without try/catch.
- `dlq-service.ts:131-143` — constructor | architecture | null repository → in-memory implicit switch.

### artifacts/

- `artifact-store.ts:59-61` — `sanitizeSegment` | correctness | Unicode NFKC attack may bypass.
- `artifact-store.ts:99-128` — `writeTextArtifact` | correctness | `criticalFindingCount > 0` throws but `sensitiveFindings` not surfaced.
- `artifact-store.ts:174-176` — `writeBuffer` | correctness | writeFileSync + renameSync not atomic; crash leaves orphan.
- `artifact-store.ts:177-180` — `writeBuffer` | correctness | checksum based on in-memory buffer, does not reflect disk state.
- `sensitive-content-scanner.ts:23-59` — `RULES.aws_access_key_detected` | security | only `AKIA` 16 characters; `ASIA/AGPA/AROA/AIDA/ANPA/ANVA/ASCA` missing.
- `sensitive-content-scanner.ts:37-41` — `generic_token_detected` | security | length threshold 12, JWT false positive.
- `sensitive-content-scanner.ts:71-77` — `scanText` | security | `secret://` early-return is a documented bypass; prefix can bypass.
- `sensitive-content-scanner.ts:97` — `block` naming | correctness | name `blocked` but value from `criticalFindingCount > 0`; medium-risk not blocked.
- `sensitive-content-scanner.ts:23-59` — `RULES` | performance | all `g`-flag regexes, no early stop.
- `artifact-resolver.ts:20-23` — `resolveRef` | correctness | `"artifact:"` empty string find forever null.

### knowledge/

- `semantic-vector-store.ts:153-184` — `upsertChunks` | performance | per-row execute, N+1.
- `semantic-vector-store.ts:189-222` — `querySimilar` | performance | `<=>` and namespace filter cannot both enter index scan.
- `semantic-vector-store.ts:328-330` — `isSupportedEmbedding` | correctness | does not validate `Number.isFinite`, NaN/Infinity pass through.
- `keyword-index.ts:3-16` — `countOccurrences` | performance | recomputes score on each query.
- `keyword-index.ts:23-35` — `upsert` | correctness | delete+set order, perChunkScores order disrupted.

### memory/

- `memory-decay-service.ts:155-167,218-246` — `calculateFreshness`/`calculateDecay` | correctness | `halfLifeSeconds === 0` boundary, exponential degrades to freshness=1.
- `memory-decay-service.ts:169` — `Math.pow(1+boost, hitCount)` | performance | huge hitCount wastes compute.
- `memory-service.ts:156` — `remember` | correctness | `JSON.stringify(input.content)` field order uncertain → hash drift.
- `memory-service.ts:225-249` — `recall` | correctness | `recordMemoryAccess` updates hitCount then next recall prioritizes; self-reinforcing bias.
- `memory-service.ts:354-433` — `consolidate` | correctness | revoke and remember not transactional.

### checkpoints/

- `checkpoint-gc-service.ts:171-226` — `runGC` | correctness | `writeFileSync` not atomic; concurrent GC mutual overwrite.
- `checkpoint-gc-service.ts:585-605` — `acquireRunLock` | correctness | `gcInProgress` process-level + `gcLockPath` file lock dual.
- `checkpoint-gc-service.ts:516-553` — `removeCandidateFromManifests` | correctness | JSON.parse error wrapped as StorageError, original error lost.

### observability/structured-logger.ts

- `:112-141,133-135,154-160` — `safePath` | correctness | boundary `..` takes throw branch; symlink no realpath check.
- `:519-527` — `appendFileWithFsync` | performance | sync fsync blocks event loop under high QPS.

## 6. src/platform/{shared,contracts,structure,stability,cost-management}/ (Deep)

> Agent 2 main.

### shared/observability/

- `structured-logger.ts:519-527` — `appendFileWithFsync` | performance | same as above.
- `slo-alerting-channels.ts:119,175,237,302` — `void deliverWithRetry` | performance | 4 channels fire-and-forget.
- `slo-alerting-channels.ts:364` — setTimeout missing .unref() | performance.
- `transports/datadog-transport.ts:54` — setInterval missing .unref() | performance.
- `transports/fluentd-transport.ts:112` — setTimeout missing .unref() | performance.
- `sli-collection-service.ts:167` — setInterval missing .unref() | performance.
- `outbox-poller-service.ts:99,283,304` — setInterval/setTimeout missing .unref(); `Math.random()` for jitter | performance.
- `rollout-freeze-manager.ts` and `task-websocket-status-relay.ts:50` entry not sampled | architecture.

### shared/runtime-state-machine.ts

- `:53-95` — `transition` | correctness | `fromStatus` comparison and DB write not in same transaction.
- `:227-247` — `assertTransitionAllowed` | correctness | throws noop but `state-transition-machine.ts:44-53` returns early; two state machines semantically inconsistent.
- `:248-264` — `assertCas` | correctness | `currentSeq` and `version` mutually exclusive assertion.
- `:445-471` — `applyStatus` | correctness | `reasonCode` injection only on terminal path.

### contracts/

- `errors.ts:691-695` — `nextOccurredAtIso` | correctness | single-thread safe but increment by 1 can still share time across errors.
- `inter-plane-contract-gateway.ts:298-338` — `receiveFromPlane` | correctness | TTL check passes when `envelopeTime > now`.
- `inter-plane-contract-gateway.ts:318-326` | security | `requireSignatureVerification: false` accepts unsigned.
- `inter-plane-contract-gateway.ts:159-161` — `getPlaneIdentifier` default `"P3_Orchestration"` | architecture | plane identifier wrong if subclass does not override.
- `inter-plane-contract-gateway.ts:417` — signature verification failure returns `verified: false` (round d 1412 closure), this round new: line 326 `requireSignatureVerification: false` is config-driven foot-gun.
- `prompt-bundle/index.ts:334-348` — semver parse | correctness | `parseInt(..., 10)` no NaN check.
- `types/domain.ts` entry not sampled.

### stability/

- `bulkhead-isolation.ts:96-143` — `startCall` | correctness | `rejectPromise` may be unassigned before microtask (in sync fn case).
- `bulkhead-isolation.ts:108-112` — `startCall` | correctness | timeout and .then race both modify `settled`.
- `bulkhead-isolation.ts:148-181` — `queueCall` | correctness | processQueue and timeout race splice.
- `circuit-breaker.ts:63-101` — `execute` finally | correctness | `enteredHalfOpen` set before try, state transition still correct.
- `circuit-breaker.ts:117-150` — `executeWithTimeout` | correctness | abort does not terminate fn execution, resource leak.
- `retry.ts:190` — `Math.random()` | performance | should be input-based.
- `prompt-injection-guard.ts:101-115` — `OUTPUT_SUSPICIOUS_PATTERNS` | security | duplicate signal name (dead code).
- `prompt-injection-guard.ts:121-135` — `fetchJsonWithTimeout` | security | body not consumed; connection hangs.
- `prompt-injection-guard.ts:137-139` — `normalizePromptInput` | security | NFKC normalize and escape order sensitive.
- `prompt-injection-guard.ts:78-99` — `DEFAULT_ML_CLASSIFIER_CONFIG.signals` | performance | recompiled on each test().
- `stable-*.ts` rehearsal/orchestrator | architecture | entry not sampled.

### structure/index.ts (11184 bytes) | architecture | entry not sampled.

### cost-management/cost-estimation-service.ts

- `:24-72` — `estimate` | correctness | returns `sampleCount: 0` when no cost events, caller not recognized.
- `:37-45` — `Math.round(avgCost * 10000) / 10000` | correctness | 4 decimal places can produce `99999.9999`.
- `:48-54` — `estimate` global result missing | correctness | all free events → SQL returns empty → fallback default.

## 7. src/domains/ (Deep)

> Agent 3 main, covering 30+ vertical domains' core services.

### domain-registry-service.ts

- `:78-79,117-121,151-155,176-180,201-205,231-235,267-271` — 7 places `capabilityCount: ...pluginBindings.length, pluginCount: ...pluginBindings.length` same value | correctness | should be `supportedTaskTypes.length`.
- `:335-343` — `resolvePlugins` | correctness | `?.resolve` + filter chain order subtle.
- `:440-444` — `validateDefinition` | security | `toolName.includes("..")`/`"/"` does not defend URL-encoded / Unicode normalization.
- `:453-460` — `validateDefinition` | correctness | `manifest.spiTypes.flatMap(...)` and subsequent `.includes(...)` check duplicated.
- `:282` — `listActive` | performance | full table scan + filter, no index.
- `:298` — `filterAllowedTools` | performance | three Set constructions.

### domain-smoke-test.ts

- `:74-91` — `validateDependencyGraph` | correctness | recursive DFS no depth protection; deep nesting stack overflow.
- `:88-90` — error message loses cycle path | correctness.
- `:107-112` — `validateSandboxCompatibility` | correctness | hardcoded `["file_write", "bash", "exec", "sql_execute"]` can be bypassed by rename.

### plugin-spi-registry.ts

- `:129-136,177-183` — duplicate spiType-mismatch check | readability.
- `:153-160` — builtin spiTypes merge | security | retriever can declare other spiTypes like `tool`.
- `:241-249` — `listByDomain` | correctness | `domainId.trim().length === 0` returns ALL plugins.
- `:255-291` — `ensureActive` | correctness | `inFlightActivation` second-activation race.
- `:348-355` — `unload` | correctness | when process-isolated fails dispose skipped.
- `:605-622` — `runSandboxed` | correctness | `setTimeout` + `clearTimeout` race, stale timer still rejects.
- `:850-862` — `executeInvocation` | performance | `startedAt` measured before permit acquisition.
- `:943-956` — `acquireInvocationPermit` | correctness | `setTimeout` cleanup and release race.
- `:894` — `try { this.publishInvocationEvent(...) } catch` implicit | readability | error type flattened.

### plugin-spi.ts

- `:23,24` — `PluginSpiTypeSchema` vs `PluginTypeSchema` duplicate z.enum | architecture.
- `:126-136` — `RetrieverKnowledgeResult` union ambiguous | architecture.

### plugin-runtime-host.ts

- `:88-92` — `start` | correctness | `stopping=true` then `start` does not reset.
- `:91` — `return this.readyPromise!` | correctness | `spawnChild` failure `readyPromise` not created.
- `:117` — `invoke` | correctness | `this.child!` non-null assertion; null after race.
- `:203` — `handleMessage` | security | multiple responses to same id second no-op.
- `:306` — `ForkedPluginRuntimeHost.spawnChild` | correctness | stderrBuffer upper limit OK.
- `:451` — `ContainerizedPluginRuntimeHost.consumeStdout` | correctness | `stdoutBuffer` mutated while iterating; JSON.parse may get bad line.
- `:496-519` — `validatePluginId` duplicate | architecture.
- `:537-543` — `sanitizePluginIdForPath` | security | `replace(/[^a-z0-9._-]/gi, "_")` lossy and reversible, same path collision.

### plugin-runtime-child.ts

- `:97-125` — `installRuntimeGuards` | security | only blocks http/https/net/tls/fetch; `node:dgram`, `WebSocket`, `node:child_process`, `node:worker_threads`, pg/mongodb socket still escape.
- `:120-123` — `globalThis.fetch = async (...) => { deny(); throw }` | security | `deny()` throw covered.
- `:127-135` — `installStdioProtocolConsoleRedirection` dead code | readability | three branches early-return do not install any redirect.
- `:137-188` — `withStructuredConsoleForCurrentRequest` | correctness | `originalConsole` one-time capture; concurrent modification risk.
- `:177-180` — console replacement does not remove old listener | correctness | double output.

### domain-recipe-service.ts

- `:212` — `register` | correctness | delete+set loses history.
- `:262-287` — `update` | correctness | cannot update core fields like `archetype` (silent).
- `:283` — `changelog` only field names | correctness | not diff.
- `:381-382` — `getLatestVersion` `localeCompare` | correctness | `"1.10.0" < "1.9.0"`.
- `:389` — `bumpVersion` | correctness | only increments minor, loses patch + pre-release.
- `:392-400` — `evictOldestRecipeIfNeeded` | correctness | Map insertion order is not truly oldest.

### domain-risk-profile-service.ts

- `:55` — `patternCache` | performance | unbounded.
- `:177` — `resolveEscalationTarget` | correctness | find after sort takes first item.
- `:201-203` — `matchesPattern` | security | `*` → `.*` then does not escape other metachars.
- `:107` — `addOverride` | correctness | in-place mutate loses insertion order.
- `:207-211` — `parseTriggerThreshold` | performance | regex per call.

### domain-knowledge-schema-service.ts

- `:194` — `checkFreshness` | correctness | future timestamp returns negative stalenessHours.
- `:281` — `executeRetrieval` | correctness | `namespaces.includes(source.sourceId)` wrong field name.
- `:303-310` — sort `array.find` callback | performance | O(n²).
- `:320-334` — `computeRelevance` | performance | `/\s+/` compiled twice.
- `:332` — `computeRelevance` "semantic" goes default | correctness | indistinguishable from keyword.

### domain-eval-framework-service.ts

- `:140,159,171` — `registerQualityAxis` etc. `slice(-max)` silently discards | correctness.
- `:185` — `getLatestRubric` `localeCompare` | correctness.
- `:188-194` — `registerRegressionDataset` map mutate | correctness.

### domain-model.ts

- `:64-83` — `OutputContractConfigSchema.transform` | correctness | for type=object + patch contracts silently mutate, loses all non-patch fields.

### business-pack/pack-registry-service.ts

- `:215-247` — `updatePack` no rate limit | correctness.
- `:271-277` — `bumpVersion` loses pre-release suffix | correctness.

### customer-service/policy-adherence-evaluator.ts

- `:19` — `total = 1` fake data | correctness | 0% adherence is masked.
- `:21-23` — `blockers` duplicates `policyViolationCount` info | architecture.

### Various Vertical Domains (30+) Entries Not Sampled

- `academic-research/`, `advertising/`, `agriculture/`, `coding/`, `data-engineering/`, `education/`, `finance-accounting/`, `financial-services/`, `game-dev/`, `game-publishing/`, `healthcare/`, `human-resources/`, `it-operations/`, `knowledge-base/`, `knowledge-schema/`, `legal/`, `live-streaming/`, `manufacturing/`, `marketing/`, `operations/`, `product-management/`, `project-management/`, etc.'s `index.ts` and `*-config.ts` have many stubs.

## 8. src/plugins/ (Deep)

> Agent 3 main.

### crm-adapter.ts

- `:373-385` — `execute` catch-all flattening | correctness | transport / egress / 5xx all `ok:false`.
- `:344` — `execute` no try/catch | correctness | exception propagation inconsistent.
- `:304` — `crmRequest` nested ternary | readability | path selection fragile.
- `:75,84` — regexes inlined compiled | performance.
- `:39-43,41-43` — `InMemoryZeroableCredentialSecret` buffer not guaranteed zero-fill | security | V8 GC may retain.
- `:52` — `buildHashedCredentialFingerprint` only `sha256(token).slice(0,12)` | security | short prefix.

### github-adapter.ts

- `:325` — `healthCheck` `policy.evaluate(...)` not awaited | correctness.
- `:344` — `execute` no try/catch | correctness.
- `:348` — `assertActionAllowed` uses `this` binding | correctness | adapter destructuring fails.
- `:131-137` — `sanitizeWorkflowInputs` regex per loop | performance.
- `:140-142` — `redactSensitiveValue` regex per call | performance.
- `:145-157` — `canonicalizeForHash` new Set per record | performance.
- `:159-171` — `createIdempotencyKey` JSON.stringify+createHash per write | performance.
- `:173-190` — `requireRepository` `%2e/%2E` incomplete defense | security.
- `:206-215` — `assertActionAllowed` throws Error not ValidationError | consistency.
- `:59-66` — `verifyPluginSignature` `Buffer.from(signature, "hex")` missing try/catch | correctness.
- `:81-85` — `createPluginManifestHash` field-order dependent | security.
- `:108` — fingerprint `sha256(token).slice(0,12)` | security.
- `:164` — `createHash` field-order dependent | security.
- `:294` — `JSON.parse(responseText)` missing try/catch | correctness.

### credential-hygiene.ts

- `:8-26` — `InMemoryZeroableCredentialSecret` | security | buffer zeroing V8 not guaranteed.
- `:19` — `withSecret` exposes raw string | security | closure/captured variable retained.
- `:33` — fingerprint `Math.max(4, length)` 4-char prefix | security | enumerable.

### asset-production-adapter.ts / game-dev-adapter.ts / livestream-adapter.ts

- The three adapters are highly homogenous in structure (builtin-preset + static config + hardcoded success: true).
- All lack action validation, egress static URL, healthCheck `evaluate(...)` not awaited.
- livestream-adapter.ts:66 — regex per call; `:63-72` — token single trim.

### 5 retriever plugins (coding/asset-production/growth/operations/livestream/game-dev)

- All hand-built result object repeatedly slice `Math.max(2, Math.min(8, …))`; slice formula does not match actual char-Token ratio (256 chars / 4 tokens).
- Lacking `sharedResultBuilder` abstraction.

### 3 presenter plugins

- All repeat `let initialized = false; async initialize/shutdown` boilerplate.
- operations-presenter.ts:25 — regex per call; :63 — else branch does not push citation.

### Plugin Runtime Builtin State Leakage

- builtin-plugin-registry.ts:78-79 — `recordPluginTaintPropagation` `inputDataClasses[0] ?? "public"` loses other classes.
- builtin-plugin-registry.ts:155-160 — builtin spiTypes merge into plugin manifest.
- builtin-plugin-registry.ts:177 — post-merge re-check always true.
- builtin-plugin-registry.ts:185-198 — bypass via manifest name collision.
- builtin-plugin-registry.ts:666-673 — `resetBuiltinPluginRegistryStateForTests` references variable declared later.
- builtin-plugin-registry.ts:820-834 — `propagateDataTaint` always `severity: "medium"`.
- builtin-plugin-registry.ts:847,875 — sessions unbounded; regex per call.

### growth-config.ts / operations-config.ts

- growth-config.ts:201 — `externalAdapters: ["github", "jira", "crm"]` but jira adapter does not exist.
- operations-config.ts:60 — `retryPolicy.backoffMs: 5000` hardcoded no jitter.

## 9. src/interaction/ (Deep)

> Agent 3 main.

### nl-gateway/index.ts

- `:465-485` — `enforceRateLimit`/`consumeRateLimit` throws plain Error | correctness | should be ValidationError.
- `:474-485` — `requestRateLimits` Map no eviction | performance.
- `:470-471` — sequential reports tenant/user errors | correctness | only tenant error shown.
- `:324` — `Promise.resolve(this.intakeRouter.route(...))` missing await | correctness.
- `:165` — `adaptModelIntentParser` no rate limit | security.
- `:313-315` — `String(entity.value)` info loss | correctness.
- `:546` — title collisions (`\s+` → `_`) | correctness | "a b" ≡ "a__b".
- `:707-710` — `persistConversationTurn` outside try block | correctness.
- `:765-797` — `rehydrateConversationTurns` `parsed.detectedIntent as DetectedIntent` | security | memory content cast.

### nl-gateway-support.ts

- `:107` — `regexCloneCache` unbounded | performance.
- `:131-147` — `getCachedRegex` modifies shared `lastIndex` | correctness | thread-unsafe.
- `:165-177` — `dedupePatterns` returns mutable | architecture.
- `:212-220` — `detectInputLocale` `[a-z]/i` any Latin letter | correctness.
- `:275-284` — `deriveUrgency` three regexes per call | performance.
- `:287-293` — `deriveTitle` no length limit | security | ReDoS risk.
- `:299` — `JSON.stringify(entity.normalized)` per entity per call | performance.
- `:392-394` — `buildConversationMemoryScope` `tenantId`/`userId` concatenated to key | security | no sanitize.

### nl-gateway-config-loader.ts

- `:274-279` — `loadNlGatewayConfig` catch-all returns DEFAULT | correctness | silently masks.
- `:188` — `readFileSync` blocks event loop | performance.

### goal-decomposer/index.ts

- `:230-235` — `sharedInFlightGoalIds`/`sharedDelegationDepth` static | correctness | test pollution.
- `:265-269` — delegationDepth update and L462 cleanup asymmetric | correctness.
- `:333-335` — `catch {}` silent | correctness | after timeout strategy="hybrid" still reports.
- `:515-526` — `hasTemplateSignalMatch` threshold hardcoded 2 | correctness | no escape hatch.
- `:560-572` — `buildTasks` computes baseCosts from `initialTasks` rather than LLM plan | correctness | budget allocation wrong.
- `:566-572` — ternary branch products same | readability.

### ux/conversation-history-service.ts

- `:106-111` — `memoryService` and default scope unbounded | performance.
- `:207-235` — `persistSession` no concurrency control | correctness.
- `:289-294` — comment promises "server-enforced" but in-memory does not enforce | correctness.
- `:376-394` — `applyRestriction` early-return condition misses `isRestricted` | correctness.
- `:414-441` — `cleanupRestrictedSessionMemory` scope cross-source crosstalk | correctness.

### ux/workflow-builder-service.ts

- `:293-309,362-376` — `categorizeComponents`/`categorizeComponent` duplicated | architecture.
- `:311-322` — `safeParseObject` silently swallows parse errors | correctness.
- `:259-289` — `parseStoredWorkflowBuilderRecord` deep typeof | correctness | brittle.

### workflow-hibernation-service.ts

- `:20` — `records` Map no TTL eviction | performance.
- `:75-80` — `emitDueStillHibernatedEvents` `heartbeatEvents[length-1]` | correctness | OK but inconsistent.
- `:41-49` — `emitStillHibernated` `heartbeatEvents` no cap | performance.

### proactive-agent/index.ts

- `:131,153` — `parseDurationMs`/`parseRateWindow` regex per call | performance.
- `:245` — `incidents` unbounded array | performance.
- `:168-180` — `isValidTimezone` uses `process.emitWarning` | correctness.
- `:412-437` — `evaluate` batch aggregation: first event never fires if next comes | correctness.
- `:594` — `computeSuggestionQuality` hardcodes `highRiskDomains` | architecture.
- `:287-298` — `getAutonomyAdjustedActionMode` doc ambiguous | correctness.
- `:464` — `enqueueSuggestion` called in auto_execute too | correctness.

### user-preference-tracker.ts

- `:106` — `feedback` unbounded | performance.
- `:257-262` — `cleanup` `splice(0, length, ...filter)` | correctness | equivalent to filter.
- `:281` — `r.latencyMs!` non-null assertion | correctness.
- `:296` — mutate input array `sort` | correctness.

### dashboard/dashboard-websocket-server.ts

- `:401` — `normalizeSubscriptions` adds `dashboard:` prefix but match still looks for `task` | correctness | never matches.
- `:425` — `assertAuthorized` uses original channel but mutated channel | correctness | always fails.
- `:497-503` — `connectionMatchesDelta` each set iteration + array spread | performance.
- `:529-539` — `performHeartbeat` collect + unregister race | correctness.

## 10. src/org-governance/ (Deep)

> Agent 3 main.

### approval-routing/approval-routing-service.ts

- `:104-143` — `route` error prefix string match | security | fragile + false positive risk.
- `:274-293` — `buildAmountSnapshot` `fxEntry.rate <= 0` throws whole request | correctness | no per-tenant fallback.
- `:302` — `resolveEscalation` materializes all results | performance.

### compliance-engine/evidence-collector.ts

- `:128-143` — `acquireSnapshotLock` while(true) 250ms busy-wait | performance.
- `:131` — `deadline` only EEXIST path check | correctness.
- `:194-221` — `collect` failure `existing` reset but `record` still added | correctness.
- `:391-396` — `loadSnapshot` JSON no size limit | security.
- `:398-415` — `persistSnapshot` JSON.stringify inside lock | performance.

### sso-scim/scim-sync/scim-service.ts

- `:230,249,444` — when `tenantId == null` cross-tenant query | security | severe bypass.
- `:152` — `events` unbounded | performance.
- `:996-998` — `persistEvents` `writeFileSync` no size | performance.
- `:861,923` — regex per call | performance.
- `:171` — `createUser` `userName` no format check | security.
- `:696` — `processBulkRequest` `bulkIdMap` only set when has id | correctness | DELETE not chain-referable.

### knowledge-boundary/chinese-wall-policy.ts

- `:81` — `requesterOrgNodeId === targetOrgNodeId` skips blocked check | security | design issue.
- `:93-105` — `Object.entries` per call | performance.

### org-model/org-governance-saga.ts

- `:98` — `nextCommitSequenceVersion` 2^53 wrap | correctness | docs not mentioned.
- `:197-211` — `groupStepsByOrgNode` ignores phase | architecture.
- `:117` — `findOrgNode` O(n) per step | performance.

## 11. src/scale-ecosystem/ (Deep)

> Agent 3 main.

### multi-region/cdc-replication-service.ts

- `:341-343,374` — `prepareBatch` queueDepth>0 silently returns null | correctness | contract ambiguity.
- `:718-728` — `recordConflict` Map insertion order deletion | correctness | not LRU.
- `:743-745` — `mergeEventWithConflictResolution` dual identical conditions | performance.
- `:750` — `merged[localIndex]!` non-null assertion | correctness.
- `:759-762` — `Date.parse` NaN sort | correctness.
- `:1010-1019,1037-1045,901-933` — vectorClocks not persisted/cleared | correctness | listed as 50 above.
- `:654` — `findIndex` O(n*m) | performance.

### billing/billing-service.ts

- `:354` — `as typeof this.store.billing & {...}` | architecture | hacky optional injection.
- `:418-459` — `recordUsage` `input.budgetControl!` non-null assertion | correctness.
- `:298-311` — `BudgetAllocator.reserve` not awaited | correctness.
- `:351` — `db.transaction` result not checked | correctness.
- `:484-486` — `buildAccountSummary` hardcoded limit=50 | correctness | no pagination.

### federation/trust-relationship.ts

- `:303` — `persistSnapshot` not atomic | correctness.
- `:565` — `updateMetrics` formula implicit | correctness | boundary first interaction OK.
- `:238,235` — `events`/`relationships` unbounded | performance.

### runtime-governance-service.ts

- `:42-70` — `evaluate` no try/catch | correctness | sub-evaluator failure aborts whole decision.
- `:46-48` — `connectorHealthReports.filter(...).some(...)` O(m*n) | performance.

### marketplace/marketplace-governance-service.ts

- `:266-302` — `submitReview` does not check lifecycle state | correctness | can still review after revoke/uninstall.

### tenant-platform/tenant-platform-service.ts

- `:185-188` — `totalSteps = 100` hardcoded | correctness | progress > 100.
- `:159` — `this.store.dispatch?.listExecutionsByStatuses?.([...])` | correctness | silent no-op.

## 12. src/ops-maturity/ (Deep)

> Agent 3 main.

### chaos/chaos-experiment-scheduler.ts

- `:150-160` — `getTargetInstanceCount`/`getTotalInstances` use label count / hardcoded 100 | correctness.
- `:349-356` — `recordSteadyStateResult` early return makes `evaluatedHypothesisNames` and `results` diverge.
- `:463-475` — `executeRollbackWithTimeout` setTimeout may not fire under event loop pressure | correctness.

### drift-detection/drift-detector-service.ts

- `:94,96,263-266,325-327` — multiple `!` non-null assertions; `inferDimension` long if-else no default silent.

### edge-runtime/edge-runtime-sync-service.ts

- `:208` — `envelopes.find(...)!` | correctness.
- `:288-293` — `verifyEnvelopeSignature` not constant-time string comparison | security | timing attack.
- `:162` — `buildEdgeExecutionPlan([request.taskId])` single-node graph semantics wrong | correctness.
- `:117-132` — `executeOffline` pre-flight scattered + duplicate null checks | architecture.
- `:386-391` — `tryParseJsonObject` null does not distinguish parse error from "not object" | correctness.

### emergency/platform-panic-service.ts

- `:132-134` — `matchesScope` prefix match fragile | security | "ten" / "ten/foo" misjudge.
- `:192-197` — 5 planes always ack | correctness | fake receipt.
- `:165,167` — `resumeReceipts`/`drills` Map unbounded | performance.
- `:385-394` — `resolveActivation` O(n) filter+sort repeated `Math.max` | performance.

### platform-ops-agent/self-healing-service.ts

- `:184` — `maxHistoryEntries = 100` hardcoded | correctness.
- `:240` — `restart` state check redundant | correctness.
- `:211-213` — `healingHistory.findLast` ES2023 | portability.
- `:331-338` — `getStatistics` length 0 then `undefined` risk | correctness.

### explainability/explanation-pipeline-service.ts

- `:131,133` — `cache`/`auditTrail` unbounded | performance.
- `:114-128` — `buildVersionLockRef` serializes renderedExplanation | correctness | fragile.

### cost-optimizer/cost-optimization-service.ts

- `:91` — `records` unbounded | performance.
- `:177-179` — `harness_run_id` (snake) vs `harnessRunId` (camel) naming drift | correctness | same name different field.
- `:80-93` — `recordCost` missing decisionRef throws but cap is unsourced count | correctness.

## 13. src/sdk/ (Deep)

> Agent 4 main.

### admin-sdk/index.ts (723 lines)

- `:106-130` — `hasAdminRole`/`hasAdminPermission` role case-insensitive (rejects "Admin") | security.
- `:132-146` — `assertAdminAccess` error message contains required permissions | security | info leak.
- `:18-35` — `registerDomainSchema` `refine` then `transform` force non-null assertion | correctness.

### cli/

- `dlq-manager.ts:212` — `countDeadLetters` three-number sum NaN risk | correctness.
- `dlq-manager.ts:240` — `retryDeadLetters`("jobs") silently reset error | correctness.
- `dlq-manager.ts:241-247` — `retryDeadLetters`("gateway"|"events") no-op fake success | correctness.
- `dlq-manager.ts:299-308` — `main`(purge) missing preview | usability.
- `login.ts:115` — `saveOAuthTokens` TOCTOU | security.
- `login.ts:134` — scryptSync explicit KDF parameters | security | OK but maxmem 64MB.
- `login.ts:286-313` — `finishOAuthLogin` unlinkSync error handling | correctness.
- `login.ts:99-107` — `resolveSecureCliHome` homedir no realpath | security.
- `api-server.ts:312-314` — `withPersistentCliStorageAsync` implicit cwd path | architecture.
- `migrate-sqlite-to-pg.ts:262-272` — `migrateSqliteToPg` per-table transaction large rowCount risk | performance.
- `migrate-sqlite-to-pg.ts:197-201` — `validateTableName` regex check post-validates | correctness.
- `authoritative-storage.ts:71-109` — `registerCliShutdownHandler` shares key by `dbPath+driver` | correctness.
- `secret-commands.ts:80-89` — `writeSecureFile` O_NOFOLLOW TOCTOU | security.
- `secret-commands.ts:64-69` — `assertPathIsNotSymlink` catch swallows error | correctness.
- `secret-commands.ts:99-113` — `parseStoredTokenHash` only checks hex length | correctness.
- `secret-commands.ts:174-180` — `verifyAuthToken` empty buffer compare returns true | security | severe.
- `orphan-cleanup.ts:38-43` — `main` throws but DB already open | correctness.
- `marketplace.ts:39-129` | architecture | module-level `loadMarketplaceCliEnv()` immediately executes.
- `profile-home.ts:20` | architecture | same as above.
- `replay-events.ts:43-45` — returns CLI_EXIT_FAILURE via promise resolve | architecture.
- `memory.ts:272` — top-level `await main()` no catch | correctness.
- `doctor.ts:50-78` — `installBrokenPipeHandler` one-time handler | correctness.
- `pack-publish.ts:185-188` — `if (lastStatus != null)` only takes exception path | correctness.
- `channel-gateway.ts:39-86` | architecture | top-level `await withCliStorage(...)` immediately executes.
- `aa.ts:48-49` — `extname(import.meta.url)` compiled product residue | correctness (round d 1433 closure this-round reappearance area).
- `stable-*.ts` and `stable-runner-factory.ts` entry not sampled.

### client-sdk/api-client.ts (1040 lines)

- `:78-92,887-898` — `buildApiUrl`/`createApiClient` no baseUrl check | security.
- `:188` — `(result as { totalCount? }).totalCount = totalCount` writes readonly field | correctness.
- `:300-389` — `subscribeToEvents` `buffer.split("\n")` each chunk new array + never-ending buffer | performance | DOS.
- `:333` — fetch no `redirect: "error"` | security.
- `:362-375` — `parseResponse` `await response.json()` failure body consumed | correctness.
- `:386-394` — `resolveRequestUrl` BOM regex incomplete | correctness.
- `:396-461` — `HttpTransport.send` finally clearTimeout but controller.abort still fires | correctness.
- `:550-578` — `DefaultRESTClient.request` interceptors reverse order unpredictable | correctness.
- `:594-689` — error classification `error.message.includes("fetch")` fragile | correctness.
- `:604-637,672-686` — retry path error classification inconsistent | correctness.
- `:626-637` — `response.status === 429 || >= 500` correct but catch path string match | correctness.

### harness-sdk/index.ts

- `:478-501` — `sendInterPlaneMessage` null transport throws | correctness.
- `:512-538` — `verifyReceivedInterPlaneEnvelope` `verification.valid || error == null` should be XOR | correctness.
- `:555-558` — `createSignedInterPlaneEnvelope` null sharedSecretKey returns unsigned envelope | security.

### pack-sdk/

- `pack-manifest.ts:95-101` — `MALICIOUS_CODE_PATTERNS` only start patterns | security.
- `pack-manifest.ts:96-98` — regex hits `child_process` import | readability | false positive.
- `pack-manifest.ts:183-184` — `sha256(publicKeyPem).substring(0,16)` 64-bit fingerprint | security.
- `pack-lifecycle-orchestration-service.ts:344-348` — `listPacks` clone+sort per call | performance.
- `pack-lifecycle-orchestration-service.ts:381-388` — `buildApiChangeSummary` 3 passes | performance.
- `pack-manifest.ts:450-458` — `stableStringify` no cycle detection | correctness.
- `pack-test-local-service.ts:207-214,228-233` — deduct casesPassed falsifies result | correctness (reappeared after round d 1326 closure).
- `plugin-definition.ts:185-189` — nested try/catch silent | correctness.
- `plugin-definition.ts:515` — `JSON.parse(readFileSync(...SBOM))` no size | security.
- `plugin-sdk/plugin-definition.ts:133-148` — `KNOWN_VULNERABILITIES` hardcodes 2 CVE | security.
- `plugin-sdk/plugin-definition.ts:180-194` — `decodeSignature` base64/base64url mixed | correctness.
- `plugin-sdk/plugin-definition.ts:201-220` — `pluginDefinitionPayloadCandidates` first match | security | attacker constructs hash.

## 14. tests/ (Deep)

> Agent 4 main.

### Key Findings

- `tests/unit/dispatcher/dispatcher-service.test.ts` 146 `as any` occurrences | test-quality | systematic type mismatch.
- `tests/unit/org-governance/sso-scim/oidc/oidc-service-comprehensive.test.ts` 15 `as any` | test-quality.
- `tests/unit/org-governance/sso-scim/oidc/` overall 30+ `as any` distributed | test-quality.
- `tests/unit/core/runtime/orchestrator.test.ts` 22+ `as any` and `{} as any` erasing types | test-quality | self-claims "verify re-export and type".
- `tests/unit/core/runtime/planner.test.ts:59-60` `parseOptionalStringArray` test uses `as any` | test-quality.
- `tests/unit/plugins.test.ts:360` `(plugin as any).suggestWorkflow` accesses non-public method | test-quality.
- `tests/unit/plugins/adapters/crm-adapter.test.ts` 9 places `delete (globalThis as any).fetch` without try/finally | test-quality.
- `tests/unit/platform/cross-plane-event-propagation.test.ts:149,196,246,288,340,388,438,480,574,620,670,739,799,869` 14 `try/finally` empty blocks + cleanup inside try | test-quality.
- `tests/unit/platform/five-plane-execution/event-bus/typed-event-bus.test.ts:94,133,165,200,232,286,333,378,431,465` 10 same anti-pattern | test-quality.
- `tests/unit/ops-maturity/p2-defects-sys-perf-3-4.test.ts:39,73,105` 3 places 31s hard wait (total 93s wall-clock) | test-quality.
- `tests/unit/platform/interface/ingress/distributed-rate-limiter.unit.test.ts:132,296` 500ms/1050ms hard wait | test-quality.
- `tests/unit/platform/interface/ingress/ingress-configuration.test.ts:62,66` 250-300ms | test-quality.
- `tests/unit/platform/interface/ingress/ingress-routing.test.ts:222` 250ms | test-quality.
- `tests/unit/platform/state-evidence/events/review-contract-regressions.test.ts:96` 450ms | test-quality.
- `tests/unit/ops-maturity/chaos/chaos-monitoring.test.ts:57,94` 150-350ms | test-quality.
- `tests/unit/platform/observability/structured-logger.test.ts:413` 150ms | test-quality.
- `tests/unit/platform/state-evidence/events/calculate-backoff.test.ts:55,101` 2-3s (in allowlist) | test-quality.
- `tests/unit/runtime/graceful-shutdown.test.ts:82,155` 200-500ms (allowlist) | test-quality.
- `tests/unit/platform/execution/plugin-executor.test.ts:371,428` 200ms | test-quality.
- `tests/unit/platform/execution/plugin-executor/plugin-executor.service.extended.test.ts:743` 500ms | test-quality.
- `tests/integration/quality/full-coverage-operational-real-paths.test.ts:208` 350ms | test-quality.
- `tests/unit/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.test.ts:122` `assert.equal(true, true)` tautology | test-quality.
- `tests/unit/platform/shared/cache/stores/redis-cache-store-health.test.ts:120,128` `console.error` noise + tautology | test-quality.
- `tests/unit/domains/governance/safe-load-division-registry-explicit.test.ts:22` `assert.ok(true, …)` tautology | test-quality.
- `tests/unit/domains/governance/safe-load-division-registry-comprehensive.test.ts:19` same as above | test-quality.
- `tests/unit/root-exports.test.ts:47,108` `kernel.getApp("unknown" as any)` should be `as PlatformAppKind` | test-quality.
- `tests/unit/platform-application-kernel.test.ts:167,218` same as above | test-quality.
- `tests/unit/root-barrel-exports.test.ts:61` same as above | test-quality.
- `tests/unit/index.test.ts:241` same as above | test-quality.
- `tests/integration/root-integration.test.ts:186` same as above | test-quality.
- `tests/integration/root-entry-summary.test.ts:141` same as above | test-quality.
- `tests/integration/platform-module-catalog.test.ts:155,188` same file line 144 already `as PlatformSurfaceId`, inconsistent | test-quality.
- `tests/unit/domains/registry/domain-registry-service.test.ts:132,342` `as any` unnecessary | test-quality.
- `tests/unit/domains/governance/hr-role-governance-service-{advanced,validation}.test.ts` 6 `as any` | test-quality.
- `tests/integration/platform/prompt-engine/conversation-template-service.test.ts:343,347,393` `as any` | test-quality.
- `tests/integration/platform/control-plane/incident-control/{human-takeover,takeover-queue}-integration.test.ts` `as any` payload | test-quality.
- `tests/unit/domains/runtime-orchestrator.test.ts` `test.beforeEach/afterEach` empty `afterEach` | test-quality.
- `tests/integration/platform/state-evidence/events/event-bus.integration.test.ts:27-40` module-level `globalThis.setTimeout` mutation | test-quality.
- `tests/unit/platform/interface/api/http-api-server.test.ts:505,535,557` and `channel-gateway/websocket-bridge-coverage.test.ts:685,688,716` `globalThis.setTimeout` replacement | test-quality.
- `scripts/ci/audit-test-hard-waits.mjs:9` `MIN_DELAY_MS = 50` too broad | test-quality.
- `scripts/ci/audit-test-hard-waits.mjs:16-19` `ALLOWED_FILE_PATTERNS` 8 broad patterns | test-quality.
- `scripts/ci/audit-test-hard-waits.mjs:88-95` `extractDelayMs` regex only matches first param of `setTimeout` | test-quality.
- `tests/leaks/platform/state-evidence/events/durable-event-bus.leak.test.ts:37` and `tests/leaks/platform/shared/cache/memory-cache-store.leak.test.ts:42` both `t.skip` need `--expose-gc` | test-quality.
- `tests/unit/quality/full-coverage-test-manual-gaps.test.ts:253` only 2 strings allowed-skip | test-quality.
- `tests/unit/ui/shared-package-regressions.test.ts:119,162,165` `as unknown as typeof WebSocket` etc. | test-quality.
- `tests/unit/domains/recipes/recipes-zero-coverage.test.ts:455,469,482,483` `as unknown as DomainRecipe` erases validation | test-quality.
- `tests/unit/interaction-governance/interaction-governance-runtime-catalog.test.ts:93` `(catalog.governance as unknown as {...}).push(...)` test-only | test-quality.
- `tests/unit/domains/prompt-library/domain-prompt-governance-service.test.ts:312` `(service as unknown as { activeReleaseByPromptId: Map<...> })` | test-quality.
- `tests/unit/root-bootstrap-exports-remediation.test.ts:12` `void (null as unknown as RootBootstrapTypeExports)` | test-quality.
- `tests/integration/platform/control-plane/incident-control/{human-takeover-service-async-integration,takeover-queue-manager-integration}.test.ts:410/371` `payload: {...} as any` | test-quality.

## 15. config/ (Deep)

> Agent 4 main.

### Hardcoded / Missing Config

- `config/security/default.json:6,11,7` — TTL/rate limit/allowedCapabilities | config.
- `config/security/{prod,staging,test,dev,pre-prod}.json` — 5 copies nearly identical | config | drift.
- `config/runtime/prod.json` — `maxConcurrentTasks: 8`, `defaultTaskTimeoutMs: 600000` | config.
- `config/runtime/default.json:4-8,20-22` — multiple magic numbers | config.
- `config/bootstrap/default.json:79-91,73-77` — canaryDeployment and thresholds magic numbers | config.
- `config/quality/default.json:5-6` — qualityGate no version/migration | config.
- `config/providers/models.json:20-25` — `MiniMax-M2.7` price hardcoded no date stamp | config.
- `config/division-coverage/family-readiness.yaml` — `readinessStatus` free string | config.
- `config/validation/platform-mission-slo-profiles.json:38-54` — burnRateAlerts combination no doc | config.
- `config/environments/default.json:13` — `allowedRolloutStrategies: ["canary", "blue_green"]` only prod | config.
- `config/policy/no-go-actions.yaml:2` — `updatedAt: "2026-05-31"` hardcoded | config.
- `config/runtime/{dev,test,staging,pre-prod,prod}.json` — configVersion all `"v4.3"` | config.
- `config/environments/{dev,test,staging,pre-prod,prod}.json` — `"environment": "prod"` wrong value | config | copy-paste error.
- `config/security/{dev,test,staging,pre-prod}.json` — `sandboxMode: "read_only"` | config.
- `config/validation/platform-validation-registry.json` and `config/quality/division-catalog.json` entry not sampled | config.

### Security Config

- `config/security/default.json:9` — `mcpPolicy.allowNetworkEgress: false` but `allowedTransports: ["stdio"]` still can spawn process | security.
- `config/security/prod.json:2` — `approvalMode: "strict"` and default `allowDestructiveActions: false` indistinguishable | security.
- `config/providers/models.json:13-15` — `minimax` authMethods: `["api_key"]` no rotation doc | security.
- `config/bootstrap/default.json:34-46` — `hotReload.watchPaths: ["config/", "src/", "domains/"]` `enabled: true` in production is RCE entry | security | severe.
- `config/bootstrap/default.json:39-45` — `excludePatterns` does not exclude `.env*` | security.

### Schema Missing

- `config/security/default.json` no JSON schema, `mcpPolicy.sandboxMode` any string | config.
- `config/policy/no-go-actions.yaml` `riskClass: R5` should be enum | config.
- `config/division-coverage/*.yaml` `version: 1` no migration | config.

## 16. deploy/ (Deep)

> Agent 4 main.

### helm/automatic-agent/

- `templates/deployment.yaml:60-66` — `readOnlyRootFilesystem: true` but `/app/data` RW, `/tmp` emptyDir | deploy.
- `templates/deployment.yaml:36-41` — `runAsUser: 1000, fsGroup: 1000` hardcoded | deploy.
- `templates/deployment.yaml:111-114` — `preStop.sleep` can exceed `terminationGracePeriodSeconds: 30` | deploy.
- `templates/deployment.yaml:34` — `automountServiceAccountToken` default `false` | deploy | OK.
- `values.yaml:113-119` — `secrets.allowInlineSecrets: false` but placeholder empty string | deploy | misleading.
- `templates/secret.yaml:2-3` — 4 keys hardcoded `or` chain | deploy.
- `templates/externalsecret.yaml:1-4` — fail message generic | deploy.
- `templates/configmap.yaml:8-12` — `regexMatch ".*(SECRET|TOKEN|PASSWORD|KEY).*"` filters by name, secrets inside URL not blocked | security.
- `templates/networkpolicy.yaml:30-44` — egress `0.0.0.0/0` allows all DNS | security.
- `templates/pdb.yaml:9-11` — `minAvailable`/`maxUnavailable` mutually exclusive but neither set still creates | deploy.
- `templates/resourcequota.yaml:10-17` — numbers use `| quote` as string | deploy.
- `templates/servicemonitor.yaml:18-20` — Prometheus duration no quote | deploy | OK.
- `values-prod.yaml:107-114` — `topologySpreadConstraints.whenUnsatisfiable: ScheduleAnyway` in prod should be `DoNotSchedule` | deploy.
- `values-prod.yaml:100-105` — `podAntiAffinity` + `ScheduleAnyway` node pressure | deploy.
- `templates/automatic-agent-chaos-approval-policies-crd.yaml:1-77` — `scope: Cluster` conflicts with namespaced resource references | deploy.
- `values.yaml:5-12` — `replicaCount: 1`/`image.tag: ""` no override then image pull fails | deploy.
- `values.yaml:54-72` — `autoscaling.behavior.scaleDown` only `Percent`, no `Pods`/`selectPolicy` | deploy.
- `values.yaml:154-156` — `livenessProbe.initialDelaySeconds: 0` | deploy.
- `values.yaml:159-168` — `readinessProbe` 30s total wait | deploy.
- `values.yaml:169-176` — `startupProbe` 5 min | deploy.

### deploy/scripts/

- `deploy.sh:111-115` — `read -p` case-sensitive, non-TTY invisible | script.
- `deploy.sh:123-134` — canary health check loop race (`i=10` break vs error order) | script.
- `deploy.sh:124` — `${CANARY_ENDPOINT}` SSRF | security.
- `deploy.sh:165-166` — `kubectl get ns` and `apply` race | script.
- `deploy.sh:201-202` — canary silent override | script.
- `deploy.sh:205-211` — blue/green no service validation | script.
- `deploy.sh:265-270` — canary promotion race | script.
- `deploy.sh:284-285` — JSON patch string concatenation special characters | script.
- `deploy.sh:249-258` — endpoints check OK | script.
- `rollback.sh:93-94` — inline `node -e` path/version dependency | script.
- `rollback.sh:95` — `2>/dev/null || echo` swallows all errors | script.
- `dr-drill.sh:160-167` — `cp` error 2>/dev/null | script.
- `dr-drill.sh:243` — `bc` missing | script.
- `dr-drill.sh:407` — `events` table may not exist | script.
- `dr-drill.sh:461-462` — `date -d` GNU-specific on macOS | script.
- `dr-drill.sh:616-617` — `return $(...)` subshell | script.
- `verify-hot-upgrade.sh:4` — `BASELINE_LATENCY_MS` declared unused | script.
- `verify-hot-upgrade.sh:39-42` — `curl` no `--max-time` | script.
- `verify-hot-upgrade.sh:64-67` — 404 returns empty | script.

### Other deploy assets

- `values-prod.yaml:87` — `persistence.enabled: false` vs `values.yaml:142-147` `enabled: true` inconsistent | deploy.
- `values-prod.yaml:91` — `maxUnavailable: 1` vs `values.yaml:71-72` `minAvailable: 1` | deploy.
- `prometheus/rules/automatic-agent.yml:30` — `for: 15m` too long in dev/staging | deploy.
- `prometheus/rules/automatic-agent.yml:84-101` — division by `total_workers=0` silent | deploy.
- `chaos/catalog.json:9` — `intensity: 0.5` no `[0,1]` validation | deploy.
- `chaos/catalog.json:6-42` — `fallbackProfiles` missing `allowedWindows` | deploy.
- `grafana/dashboards/automatic-agent.json` and `terraform/` entry not sampled | deploy.

## 17. scripts/ (Deep)

> Agent 4 main.

### Shell scripts

- `backup-sqlite.sh:18` `set -euo pipefail` | OK.
- `backup-sqlite.sh:29` `cd` failure then `mkdir -p` not executed | script.
- `backup-sqlite.sh:48` `${BACKUP_PATH//\'/\'\'}` bash 4+ feature, macOS 3.2 fails | portability.
- `backup-sqlite.sh:78-80` `openssl -pass file:` fd leak | script.
- `backup-sqlite.sh:105-117` `aws s3 cp` no integrity check | script.
- `restore-sqlite.sh:42-45` macOS `realpath` needs coreutils | portability.
- `restore-sqlite.sh:99-101` regex format hardcoded assumption | script.
- `restore-sqlite.sh:111-114` `AA_RESTORE_ALLOW_SCHEMA_DOWNGRADE=1` no audit log | script.
- `backup-sqlite.sh:23` relative path | portability.

### MJS

- `architecture-boundary-scan.mjs:79-93` `content.includes` substring false positive | script.
- `architecture-boundary-scan.mjs:51-58` arbitrary quotes matcher | script.
- `architecture-boundary-scan.mjs:130-132` only enforce mode exits 1 | script.
- `architecture-boundary-scan.mjs:8` argv missing validation | script.
- `clean-dist.mjs:7-17` env OR chain doc missing | script.
- `clean-dist.mjs:55-65` source maps `null` not errored | script.
- `build-if-needed.mjs:39-47` `Math.max(...arr)` large array stack overflow | script.
- `build-if-needed.mjs:50-58` tsc output not captured | script.
- `audit-test-exclusions.mjs:7` `/i` flag false matches "contest/latest/fastest" | script.
- `audit-test-hard-waits.mjs:88-95` regex only first arg | script.
- `validation/platform-validation-closure.mjs:357-375,377-391,194-198` doc structure change silently 0 metrics | script.
- `generate-division-coverage-cards.mjs` (8KB) / `scan-current-codebase-gap.mjs` (18KB) / `run-layered-tests.mjs` (9KB) entry not sampled | script.
- `dev/start-local-stack.mjs` and `dev/stop-local-stack.mjs` entry not sampled | script.

### CI audit scripts (38)

- Only sampled 7; other `audit-*.mjs` entries not sampled; recommend round f sanity-check each.

## 18. ui/ (Deep)

> Agent 5 main.

### Security

- `ui/apps/web/src/app-shell.tsx:472-495` — `resolveLocationAuthContext` | ui-security | reads userId/roles/permissions from URL query; `?user_id=admin&roles=admin&permissions=*` self-escalation. Severe.
- `ui/packages/shared/api-client/src/interceptors.ts:172-182` — `createCsrfInterceptor` | ui-security | only write methods set CSRF; `<meta>` reads token without SameSite/origin check; offline queue replays `x-csrf-token`.
- `ui/packages/shared/sync/src/sync-coordinator.ts:101-117` — `FetchSyncMutationDispatcher.dispatch` | ui-security | replay without Authorization; body leaks to wrong-origin.
- `ui/packages/shared/platform/src/base-platform-adapter.ts:99-112` — `DefaultPlatformAdapter.runShell` | ui-security | `allowedShellCommands` default empty → ALL commands allowed.
- `ui/packages/shared/platform/src/web-platform-adapter.ts:44-50` — `WebPlatformAdapter.openDeepLink` | ui-security | when undefined returns `https://example.invalid`; null/undefined silent no-op.
- `ui/packages/shared/state/src/stores/auth-store.ts:167-182` — `partialize` | ui-security | hardcoded `authenticated: false`, `accessToken: ""`; after reload token not persisted.
- `ui/packages/shared/api-client/src/ws-client.ts:219,244-255` — `BrowserWSClient.establishConnection` | ui-security | WS subprotocol plaintext token; replay buffer no channel permission.
- `ui/packages/shared/state/src/index.ts:120-152` — `UiRuntimeProvider` | ui-security | `setAuthenticated(accessToken != null)`; non-empty string means authenticated.
- `ui/packages/shared/auth/src/auth-service.ts:147` — `JSON.parse` cast force | ui-security | cross-tenant pollution storage.

### Correctness

- `ui/packages/shared/state/src/mutations/use-mutation.ts:126-144` — `resolveMutationBody` | ui-correctness | heuristic misplaced filter `*Id`.
- `ui/packages/shared/state/src/mutations/use-mutation.ts:84-92` — `onError` `context?.previousData` no null check | ui-correctness.
- `ui/packages/shared/api-client/src/ws-client.ts:202-207` — `BrowserWSClient.publish` no `disconnected` guard | ui-correctness.
- `ui/packages/shared/api-client/src/ws-client.ts:91-96` — `SharedWorkerWSClient.subscribe` replayMicrotask | ui-correctness | disposed channel re-sent.
- `ui/packages/shared/api-client/src/ws-client.ts:441-449` — `SharedWorkerWSClient.disconnect` `setTimeout(...,0)` double-call removeEventListener leak | ui-correctness.
- `ui/packages/shared/state/src/index.ts:154-186` — bootstrap mutations hardcoded `createdAt` | ui-correctness.
- `ui/packages/shared/state/src/index.ts:289-311` — `useSystemStatus` selects whole state | ui-performance.
- `ui/packages/shared/api-client/src/rest-client.ts:312-323` — `HttpTransport.shouldRetry` 401/403 also retry | ui-correctness.
- `ui/packages/shared/api-client/src/rest-client.ts:362-375` — `parseResponse` `response.json()` failure body unrecoverable | ui-correctness.
- `ui/packages/shared/api-client/src/rest-client.ts:386-394` — `resolveRequestUrl` BOM regex | ui-correctness.
- `ui/packages/shared/api-client/src/rest-client.ts:396-461` — `HttpTransport.send` finally clearTimeout but controller.abort still fires | ui-correctness.
- `ui/packages/shared/api-client/src/rest-client.ts:550-578` — `DefaultRESTClient.request` reverse interceptors | ui-correctness.
- `ui/packages/shared/api-client/src/interceptors.ts:172-182` — `createCsrfInterceptor` closure caches token | ui-correctness.
- `ui/packages/shared/api-client/src/interceptors.ts:284-330` — `createDedupeInterceptor` shared Set clear mistakenly clears | ui-correctness.
- `ui/packages/shared/api-client/src/shared-ws-worker.ts:151-160` — `connectSocket` onclose/onerror race | ui-correctness.
- `ui/packages/shared/sync/src/sync-coordinator.ts:39-80` — `flush` retained replace after retry chain | ui-correctness.
- `ui/packages/shared/platform/src/web-platform-adapter.ts:28-34` — `readFile` silently returns `""` | ui-correctness.
- `ui/packages/features/task-cockpit/src/hooks/index.ts:86-93,141-152` — `useTaskCockpitVm` drift no convergence | ui-correctness.
- `ui/packages/features/alerts/src/hooks/index.ts:201-228` — snooze timer rebuild race | ui-correctness.
- `ui/packages/features/alerts/src/hooks/index.ts:172-181` — `payload.incident!` non-null assertion + no memo | ui-correctness.
- `ui/packages/features/hitl/src/hooks/index.ts:85` — `wsClient.subscribe("approvals", () => undefined)` no-op | ui-correctness | real-time approval events not reflected.
- `ui/packages/features/hitl/src/hooks/index.ts:92-97` — 1Hz setInterval never stops | ui-performance.
- `ui/packages/features/conversation/src/hooks/index.ts:290-306,308-368,382-397` — 6 dependencies + closure stale + publish/send order | ui-correctness.
- `ui/packages/features/release-console/src/hooks/index.ts:87-128` — `mutating: false` shared + `loadSnapshot` not memo | ui-correctness.
- `ui/packages/features/division-inventory/src/hooks/index.ts:35-58,88-91` — N+1 fetch + Set spread per snapshot | ui-correctness.
- `ui/packages/shared/state/src/queries/helpers.ts:32-53` — `createCursorInfiniteQuery` `queryKey` contains `normalizedOptions` object ref | ui-correctness.

### Performance

- `ui/packages/features/workflow-builder/src/web/flow-canvas.tsx:20-21` — `Array.from(nodes)/edges` each render new ref | ui-performance.
- `ui/packages/features/conversation/src/hooks/index.ts:290-306` — 6-dep useEffect render storm | ui-performance.
- `ui/packages/features/dashboard/src/web/index.tsx:17-20` — `buildChartOption` each dep change re-invoke | ui-performance.
- `ui/packages/ui-core/src/charts/echart-surface-runtime.tsx:118-121` — paranoid dep list | ui-performance.

### State

- `ui/packages/shared/state/src/stores/auth-store.ts:204-243` — `attachCrossTabAuthSync` trusts storage event userId | ui-state.
- `ui/packages/shared/state/src/stores/notification-store.ts:79-90` — `markAllRead` lookup inconsistent | ui-state.
- `ui/packages/shared/state/src/mutations/optimistic-update.ts:60-63` — `snapshotCache` live ref | ui-state.
- `ui/packages/shared/state/src/stores/realtime-store.ts:91-100` — concurrent key write | ui-state.
- `ui/packages/shared/state/src/stores/sync-store.ts:85-94` — `addConflict` no eviction | ui-state.
- `ui/packages/shared/state/src/stores/middleware.ts:18-47` — `cloneDraftValue` no cycle handling | ui-state.
- `ui/packages/shared/state/src/stores/middleware.ts:51-65` — `withDraft` non-function bypass | ui-state.

### Accessibility / i18n

- `ui/packages/shared/i18n/src/catalogs/ar-SA.ts:1-19` — only 12 keys vs 713 in en/zh | ui-i18n.
- `ui/packages/shared/i18n/src/index.ts:111-118` — `setLocale` synchronously set direction | ui-i18n.
- `ui/packages/shared/i18n/src/index.ts:181-209` — `translate` formatter throws falls back to raw ICU | ui-i18n.
- `ui/packages/features/approval/src/web/index.tsx:79-81` — `<span style="display: none">` aria-describedby | ui-accessibility.
- `ui/packages/features/approval/src/web/index.tsx:22-41` — button no `aria-pressed`/`aria-current` | ui-accessibility.
- `ui/packages/features/approval/src/web/index.tsx:46-49` — `aria-describedby` may dangle | ui-accessibility.
- `ui/packages/ui-core/src/components/extended.tsx:195-217` — pagination `<li>`/`<ul>` missing, no aria-label | ui-accessibility.
- `ui/packages/ui-core/src/components/extended.tsx:281-311` — `Accordion` missing keyboard navigation | ui-accessibility.
- `ui/packages/features/dashboard/src/web/index.tsx:60-122` — `<article>`/`<section>` missing headings | ui-accessibility.
- `ui/packages/features/hitl/src/web/index.tsx:111-123` — `<textarea>` no `<label>`, submit no announcement | ui-accessibility.
- `ui/packages/features/alerts/src/hooks/index.ts:55-64` — `SEVERITY_ORDER ?? 99` silent | ui-i18n.

## 19. docs_zh/ + docs_en/ + root directory docs (Deep)

> Agent 5 main.

### docs_zh/ doc drift

- `docs_zh/quality/p0-pilot-evidence-runbook.md` | doc-missing | no docs_en translation.
- `docs_zh/reviews/platforme-full-review-e.md` | doc-missing | this document.
- `docs_zh/contracts/lifecycle_and_termination_contract.md:197` | doc-broken-link | `platform-architecture-implementation-consistency-audit.md` missing `../reviews/` prefix → 404.
- `docs_zh/contracts/agent_contract.md:192`, `approval_and_hitl_contract.md:195`, `billing_and_tenant_contract.md:104`, `compliance_report_generation_contract.md:87`, `context_propagation_contract.md:173`, `cost_and_budget_contract.md:164`, `cost_attribution_and_optimization_contract.md:44`, `cross_region_routing_and_data_residency_contract.md:56`, `data_classification_and_prompt_handling_contract.md:112`, `distributed_locking_contract.md`, `enterprise_secret_management_contract.md`, `monetization_metering_plane_contract.md`, `plugin_spi_contract.md`, `sandbox_and_auth_contract.md`, `supply_chain_and_dependency_security_contract.md`, `tool_and_provider_execution_contract.md`, `domain_descriptor_and_onboarding_contract.md` | doc-broken-link | same pattern 17 files.
- `docs_en/contracts/agent_contract.md:191` | doc-broken-link | sync English version.
- `docs_zh/operations/review-closure-board.md:18` | doc-stale | references `platforme-full-review.md` historical table + non-existent `*-round_reaudit.md`.
- `docs_zh/architecture/00-platform-architecture.md:15` | doc-stale | link `reviews/platforme-full-review-b.md`, should upgrade to -e.
- `docs_zh/quality/01-release-checklist.md` | doc-stale | still lists "c8 0% coverage" as open.
- `docs_zh/reviews/platforme-full-review-d.md:1671,1673,1676` | doc-stale | multiple places `src/runtime/agent-runtime/index.ts` removed, but directory is empty.

### Root directory doc drift

- `README.md:104`, `AGENTS.md:4`, `CLAUDE.md:47,65` | root-doc-stale | references `src/runtime/agent-runtime/` (already empty).
- `README.md:31-32` | root-doc-incorrect | lists `aa platform-operator` and `aa doctor`, but package.json#bin only `aa`.
- `README.md:40-44` | root-doc-stale | contains `test:layers:smoke`, `coverage:gate`, `changelog:check`, `package:stable`; missing `test:invariants`, `test:leaks`, `test:mutation:critical`.
- `AGENTS.md:10` | root-doc-stale | `ci:baseline` contains `lint:architecture-boundary`, `audit:repo-hygiene`, `test:mutation:critical` not documented.
- `CONTRIBUTING.md` | root-doc-stale | Branch Strategy lists main/feature/fix/refactor/docs, does not mention redteam/pilot.
- `CHANGELOG.md:5-13` | root-doc-stale | 0.2.0 does not mention `src/runtime/agent-runtime/` removal.
- `docs_zh/quality/00-full-coverage-test-manual.md:502,2249` | doc-stale | "c8 0% coverage" old round.
- `docs_zh/reviews/platforme-full-review-a.md:622` | doc-stale | `package.json:144` does not match current layout.
- `docs_zh/architecture/00-platform-architecture.md:19-21` | doc-incorrect | "cross-cutting capabilities" path wrong (`shared/contracts/model-gateway/prompt-engine/compliance`), actually `src/platform/contracts/` and `src/platform/shared/`.
- `docs_zh/architecture/01-code-structure.md` | doc-incorrect | 7-layer legacy; CLAUDE.md only lists 5-plane.
- `docs_zh/reviews/platforme-full-review-b.md:31,166` | doc-stale | multiple places `src/runtime/agent-runtime/index.ts` references.
- `docs_zh/architecture/05-cross-platform-ui-architecture.md` | doc-stale | `packages/features/*/web/index.tsx`; `feature-flags` actually has no `web/` subdirectory.
- `docs_zh/operations/review-prevention-plan.md:167` | doc-stale | closure table pointer -b should be -e.
- `docs_zh/operations/test_coverage_baseline_gate.md:19` | doc-stale | `npm run test:raw`; README missing `test:invariants`/`test:leaks`.
- `CLAUDE.md:21` | root-doc | `npm run test:golden` consistent with audit:repo-hygiene; OK.
- `CLAUDE.md:26` | root-doc-stale | `tsx --test tests/unit/...` unit test example should use `scripts/run-layered-tests.mjs`.
- `CLAUDE.md:38` | root-doc-incorrect | lists 5-plane; but `src/core/runtime/` currently is a 13 five-plane module wide re-export barrel, not a thin shim.
- `CLAUDE.md:46` | root-doc-stale | `src/runtime/agent-runtime/` reference.
- `README.md:78-99` | root-doc-incorrect | Project Structure tree missing `src/index.ts`/`src/domains-runtime-catalog.ts`/`src/platform-architecture-bootstrap.ts`/`src/platform-architecture-types.ts`/`src/platform-root-types.ts`.
- `README.md:32` | root-doc-stale | `aa platform-operator` subcommand not documented in package.json#scripts.
- `CONTRIBUTING.md:8-13` | root-doc-stale | `nvm use` no `.nvmrc`.
- `CHANGELOG.md:5-13` | root-doc-stale | does not mention empty `src/runtime/agent-runtime/`.
- `SECURITY.md:1-13` | root-doc-stale | generic reporting, does not mention UI-specific security boundary (e.g. `app-shell.tsx` URL-based auth bypass).
- `package.json:50-100 (scripts)` vs `README.md/CLAUDE.md` | root-doc-stale | `audit:repo-hygiene` contains 25+ sub-audits, root docs only mention subset.

---

## Relationship with items 1-76 above

This extension is a **refinement and extension of** the 76 items above, with different positioning:

- Items 1-76 above: Critical/High-level concise summary (each with fix suggestions and closure path).
- This extension: ~600+ file-level, function-level detailed review, broader coverage (plugins/domains/interaction/org-governance/scale/ops-maturity/sdk/tests/config/deploy/scripts/ui/docs/root), for actual development positioning and code review preparation.

Closure recommendation path still follows the 1-76 priority above (first Critical 5 → High 22), this extension is for round f's specific landing.

## Review Replay

```bash
# 1. baseline
npm run build
npm run typecheck
npm run audit:repo-hygiene  # 25/25 pass

# 2. Five-domain deep review (5 parallel sub-agents, executed in this round)
#    - Agent 1: platform/{interface,control-plane,orchestration}
#    - Agent 2: platform/{execution,state-evidence,shared,contracts,structure,stability,cost-management}
#    - Agent 3: {domains,plugins,interaction,org-governance,scale-ecosystem,ops-maturity}
#    - Agent 4: {sdk,tests,config,deploy,scripts}
#    - Agent 5: {ui,docs_zh,docs_en,root}
#    Total ~600+ file-level findings

# 3. 8 Critical reference lines have been manually verified twice
#    http-api-server.ts:636 → resolveClientIp only returns fallback
#    delegation-manager.service.ts:934 → explicit floating promise
#    cdc-replication-service.ts:1010/1037 → clearState does not clear vectorClocks
#    multi-step-orchestration.ts:42-43 → try/finally scope only provideContext
#    admin-routes.ts:209-233 → applyAdminConfigUpdate silent no-op
#    sub-workflow-executor.ts:983 lines → entry not sampled
#    durable-event-bus.ts:316-389 → publish/scheduleFanOut cross-transaction
#    runtime-recovery-decision-service.ts:176-194 → SQLite transaction does not support async
#    secret-commands.ts:174-180 → verifyAuthToken empty buffer compare returns true
#    ui/apps/web/src/app-shell.tsx:472-495 → URL-based auth bypass

# 4. This file structure
#    First half: 76 critical/high summary + root cause classification
#    Second half: ~600+ file-level deep review (by 19 subsystem slice)
```

## Next Round (round f) Recommendations

- Sample 30+ "long files" (1000+ lines) not yet covered for third round focus:
  - `src/sdk/cli/*` main CLI files
  - `src/scale-ecosystem/multi-region/cdc-replication-service.ts` (1208 lines)
  - `src/scale-ecosystem/billing/billing-service.ts` (1016 lines)
  - `src/platform/five-plane-execution/plugin-executor/sub-workflow-executor.ts` (983 lines)
  - `src/platform/five-plane-interface/channel-gateway/channel-gateway-service.ts` (948 lines)
  - `src/platform/five-plane-control-plane/mission/operating-model.ts` (810 lines)
  - `src/platform/five-plane-control-plane/mission/index.ts` (1641 lines)
  - `src/platform/five-plane-control-plane/iam/cve-intelligence-service.ts` (755 lines)
  - `src/platform/five-plane-control-plane/incident-control/*` and `config-center/*` long files
  - `src/platform/shared/stability/stable-evidence-bundle-support.ts` (943 lines)
  - `src/platform/shared/observability/*` and `cost-management/*` other long files
  - `src/scale-ecosystem/tenant-platform/tenant-platform-service.ts` (1003 lines)
  - `src/scale-ecosystem/marketplace/marketplace-governance-service.ts` (933 lines)
  - `src/plugins/builtin-plugin-registry.ts` (933 lines)
  - `src/interaction/nl-gateway/index.ts` (939 lines)
  - `src/interaction/goal-decomposer/index.ts` (933 lines)
  - `src/org-governance/sso-scim/scim-sync/scim-service.ts` (1037 lines)
  - `src/ops-maturity/chaos/chaos-experiment-scheduler.ts` (920 lines)
  - `src/ops-maturity/version-management/version-compatibility-matrix.ts` (387 lines)
  - 30+ vertical domains `index.ts` / `*-config.ts`
  - `src/platform/shared/lifecycle/global-singleton.ts` and other lifecycle
  - `src/platform/structure/index.ts` (11184 bytes)
  - `src/platform/contracts/executable-contracts/*`
  - many `*support.ts`, `*-async.ts` thin forwarding files
- For round f's 600+ findings, do dedup + closure priority sorting
- Treat hot-paths (dispatcher, queue, lease, event-bus, http-api) critical/high closures as v3.5 entry bar

> This concludes round e review at two levels: (1) items 1-76 priority summary above; (2) 600+ file-level deep review in this extension. Next round (round f) will focus on unsampled long files + closure tracking.
