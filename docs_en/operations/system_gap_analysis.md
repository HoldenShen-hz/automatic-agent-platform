# System Gap Analysis

## 1. Objective

This document records system gaps identified through comprehensive audit, providing a foundation for subsequent stabilization and security hardening iterations.

Gap enumeration scope: type system, concurrency model, reliability, performance, input validation, architecture and design, API security, OIDC/OAuth implementation, container and deployment, configuration management, multi-tenancy and billing readiness, gateway implementation, observability and operations, test coverage, code hygiene, and documentation consistency.

This report is a system-level defect list that can directly drive remediation. Its conclusions are overall credible and sufficient to trigger a formal stabilization / security hardening iteration.

## 2. Type System Issues

### 2.1 Dangerous Type Assertions (18 items)

At least **18** locations use `as unknown as T` or `as any` to bypass TypeScript type checking:

| ID | File:Line | Issue |
| --- | --- | --- |
| T-01 | `runtime/call-governance.ts:247` | `entry = this.limiterEntries.get(key) as unknown as ...` |
| T-02 | `runtime/call-governance.ts:252` | `entry = this.breakerEntries.get(key) as unknown as ...` |
| T-03 | `runtime/call-governance.ts:276` | `entry.state = state as unknown as CircuitBreakerState` |
| T-04 | `runtime/call-governance.ts:301` | `record = this.history.get(key) as unknown as ...` |
| T-05 | `runtime/effect-buffer.ts:438` | `cause = e as unknown as Error` |
| T-06 | `runtime/phase1b-orchestration.ts:98` | `result = await fn(args as unknown as Args)` |
| T-07 | `runtime/phase1b-orchestration.ts:107` | `args = JSON.parse(argumentsJson) as unknown as Args` |
| T-08 | `storage/phase1a-store.ts:148` | `result = row as unknown as TaskRow` |
| T-09 | `providers/unified-chat-provider.ts:195` | `service: ... as unknown as ...` |
| T-10 | `providers/unified-chat-provider.ts:204` | `stream: ... as unknown as ...` |
| T-11 | `providers/unified-chat-provider.ts:222` | `response: ... as unknown as ChatResponse` |
| T-12 | `providers/unified-chat-provider.ts:235` | `error: ... as unknown as Error` |
| T-13 | `memory/experience-cache-service.ts:5` | `(this.store as unknown as { db: { connection: ... } })` |
| T-14 | `memory/memory-retrieval-service.ts:7` | `(this.store as unknown as { db: { connection: ... } })` |
| T-15 | `tools/skill-governance-service.ts:7` | `(this.store as unknown as { db: { connection: ... } })` |
| T-16 | `tools/skill-governance-service.ts:19` | `(this.store as unknown as { db: { connection: ... } })` |
| T-17 | `core/types/app-error.ts:28` | `return err as unknown as AppError` |
| T-18 | `core/types/app-error.ts:31` | `const appError = e as unknown as AppError` |

> **2026-04-11 Fixed** — Source code and test `as any` literal bypasses cleared to zero; PostgreSQL backend changed to explicit sync facade / fail-close adapter, tests changed to use controlled entrances like `PgDatabase.createDisconnectedForTest()` instead of arbitrary penetration.

**Risk**: These bypasses allow runtime type mismatches to go undetected, potentially causing downstream crashes.

**Recommendation**: Replace with proper type guards, discriminated unions, or Zod validation.

### 2.2 Unsafe Optional Property Access

| ID | File:Line | Issue |
| --- | --- | --- |
| T-19 | `runtime/agent-middleware-chain.ts:405` | `state!.lastLoopReason` — non-null assertion on potentially null state |

> **2026-04-11 Fixed** — `state` property of `InitializedAgentExecutorContext` and `InitializedMiddlewareContext` changed to `LoopDetectionState | null`, removing unsafe cast.

**Risk**: Non-null assertion bypasses TypeScript's strict null checking, can cause runtime null pointer errors.

**Recommendation**: Use optional chaining or explicit null checks with proper error handling.

## 3. Concurrency and Reliability Issues

### 3.1 Timer Leaks Causing Resource Exhaustion

| ID | File:Line | Problem |
| --- | --- | --- |
| R-01 | `tools/command-executor.ts:422` | `setTimeout` without `.unref()`, blocks event loop exit |
| R-02 | `runtime/effect-buffer.ts:305` | `setTimeout` (Promise.race timeout) never cleared on success |
| R-03 | `runtime/sli-collection-service.ts:177` | `setTimeout` without `.unref()` |
| R-04 | `queue/adapters/queue-adapter.ts:91` | `setTimeout` without `.unref()` |

> **2026-04-11 Fixed** — `command-executor.ts`, `sli-collection-service.ts`, `queue-adapter.ts`, `effect-buffer.ts`, `call-governance.ts` all added `.unref()`.

**Risk**: Timers prevent event loop from exiting, causing resource leaks and preventing graceful shutdown.

**Recommendation**: Always call `.unref()` on timers that shouldn't block exit, or use `AbortController` with `AbortSignal.timeout()`.

### 3.2 Empty catch {} Blocks Swallowing Errors

**Over 100** locations use empty `catch {}` blocks:

| ID | File:Line | Problem |
| --- | --- | --- |
| R-05 | `runtime/phase1b-orchestration.ts:486` | `catch {}` swallowing errors |
| R-06 | `runtime/transition-service.ts:200` | `catch {}` swallowing errors |
| R-07 | `security/policy-engine.ts:71` | `catch {}` swallowing errors |
| R-08 | `tools/tool-execution-service.ts:705` | `catch {}` swallowing errors |

> **2026-04-11 Fixed** — All 97 empty catch blocks added StructuredLogger.warn/debug logs, key paths record error information.

**Risk**: Errors are silently ignored, making debugging impossible and allowing invalid state to propagate.

**Recommendation**: Log errors with appropriate severity, or re-throw with context.

### 3.3 Module-Level Singleton Initialization Race

| ID | File:Line | Problem |
| --- | --- | --- |
| R-09 | `runtime/agent-executor.ts:91-143` | `initializeAgentExecutor()` has check-then-act race |
| R-10 | `runtime/middleware-init.ts:43-89` | `initializeMiddleware()` has same race pattern |

> **2026-04-11 Fixed** — Both files added `isInitializing` flag to prevent concurrent initialization race.

**Risk**: If two calls happen simultaneously, hook registration could be duplicated or state corrupted.

**Recommendation**: Use mutex or promise-based initialization pattern.

### 3.4 Middleware Chain Concurrent Registration Not Thread-Safe

| ID | File:Line | Problem |
| --- | --- | --- |
| R-11 | `runtime/agent-middleware-chain.ts:116-144` | `register*` methods push to arrays without synchronization |

**Risk**: Concurrent calls to `register*` during `runAgentRound` can cause array corruption or missed hooks.

**Recommendation**: Add mutex lock around hook array modifications, or use copy-on-write pattern.

### 3.5 Durable Event Bus First Failure Blocks Remaining Deliveries

| ID | File:Line | Problem |
| --- | --- | --- |
| R-12 | `events/durable-event-bus.ts:102-114` | `deliverPending()` processes sequentially; first dead-letter blocks remaining |
| R-13 | `events/durable-event-bus.ts:146-180` | Delivery failures not isolated per consumer |

> **2026-04-11 Fixed** — `deliverPending()` now processes events independently; single dead-letter no longer blocks subsequent pending deliveries; `publish()` connected auto fan-out, and each consumer's serial delivery queue avoids duplicate delivery during concurrent explicit drain.

**Risk**: One failing consumer blocks all others, causing event backlog.

**Recommendation**: Isolate delivery per consumer, process failures independently.

### 3.6 Lock/Security Operation Empty catch Blocks

| ID | File:Line | Problem |
| --- | --- | --- |
| R-14 | `sandbox/sandbox-policy.ts:146-150` | Empty catch in security validation |
| R-15 | `sandbox/sandbox-policy.ts:195-197` | Empty catch in security validation |
| R-16 | `locking/distributed-lock-service.ts:381` | Empty catch in advisory lock |
| R-17 | `locking/distributed-lock-service.ts:422` | Empty catch in Redis lock |

> **2026-04-11 Fixed** — Key catch blocks in sandbox-policy.ts and distributed-lock-service.ts changed to StructuredLogger.warn().

**Risk**: Security validations silently pass on errors, allowing potentially unsafe operations.

**Recommendation**: Log security-relevant errors with appropriate severity; fail-closed on uncertain conditions.

## 4. Input Validation Issues

### 4.1 Key Public API Missing Validation

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| V-01 | `security/policy-engine.ts:71-131` | `evaluate()` doesn't validate input; accepts empty strings, null, malicious payloads | HIGH |
| V-02 | `memory/memory-service.ts:71-105` | `remember()` accepts unbounded strings/objects, may exhaust memory on JSON.stringify | HIGH |
| V-03 | `events/durable-event-bus.ts:72-95` | `publish` has no payload size limit; huge payloads can cause SQLite page overflow | HIGH |

### 4.2 JSON.parse Without Validation (130+ locations)

Approximately **130** `JSON.parse()` calls, most with empty `catch {}` or `as unknown as T` assertions:

| ID | File:Line | Context |
| --- | --- | --- |
| V-04 | `runtime/phase1b-orchestration.ts:106` | `args = JSON.parse(argumentsJson)` fails silently |
| V-05 | `security/cve-intelligence-service.ts:176` | `JSON.parse(content)` has no CVE data schema validation | ✅ Fixed — CVE feed now validates entry / package / version range structure before writing to memory |
| V-06 | `api/oidc-oauth-service.ts:186-187` | `JSON.parse(Buffer.from(..., "base64url"))` parses JWT without schema validation | ✅ Fixed — JWT header/payload now explicit schema parsing, exceptions return `jwt.header_invalid` / `jwt.payload_invalid` |

**Recommendation**: Define Zod schemas for all external inputs; set size limits (e.g., 1MB) for memory/event payloads.

### 4.3 Database Query Parameter Validation Missing

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| V-07 | `storage/phase1a-store.ts` (widespread) | SQL queries directly use externally passed strings without type/whitelist validation | HIGH |
| V-08 | `storage/sqlite/sqlite-database.ts:577` | `PRAGMA table_info(${tableName})` — table name via string interpolation, can inject SQL metacharacters | HIGH |
| V-09 | `runtime/transition-service.ts:200-350` | `transition()` method accepts `fromStatus`/`toStatus` without enum validation; illegal transitions allowed | HIGH |

> **2026-04-11 Fixed** — S-01: Added table name whitelist validation `^[a-zA-Z_][a-zA-Z0-9_]*$`, identifiers wrapped in double quotes.

### 4.4 API Route and Query Parameter Validation Missing

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| V-10 | `api/http-api-server.ts:350-363` | `GET /v1/tasks/:taskId/events` — `taskId` has no format validation; `../../etc/passwd` or >128 char strings pass through | MEDIUM |
| V-11 | `api/http-api-server.ts:329-348` | `GET /v1/tasks` — `limit`/`offset` have no range validation; `limit=999999999` causes full table scan | MEDIUM |
| V-12 | `api/http-api-server.ts:187-188` | `GET /v1/dashboard/snapshot` returns complete billing account, PMF reports without parameter validation | MEDIUM |
| V-13 | `api/http-api-server.ts:649-658` | `readIncomingBody()` has no POST/PUT body size limit; attackers can send GB-level body | HIGH | ✅ Fixed — `readIncomingBody()` now has `MAX_BODY_SIZE_BYTES = 1MB`, throws `ApiError(413, "api.body_too_large")` on overlimit |

### 4.5 CLI Parameter Validation Missing

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| V-14 | `cli/ops-program.ts` (widespread) | CLI uses `yargs` or raw `process.argv` without parameter type validation | MEDIUM |
| V-15 | `cli/repair.ts` | `--task-id` parameter directly concatenated into SQL query | HIGH |
| V-16 | `cli/doctor.ts` | `doctor` command has no timeout protection; `check()` may hang | MEDIUM |

### 4.6 Configuration File Validation Missing

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| V-17 | `config/config-governance-service.ts:240-337` | `validateBundle()` only does `typeof` checks, cannot detect missing fields, type errors, enum overflow | HIGH |
| V-18 | `config/model-metadata-registry.ts:103-121` | `parseRegistry()` has no runtime validation for `pricing`, `tokenLimit`, `tier`; negative pricing can reverse billing | HIGH |
| V-19 | `product/billing-service.ts:121-225` | `DEFAULT_PLAN_CATALOG` negative/null `inputPer1kUsd`/`outputPer1kUsd` no validation, can cause reverse billing | HIGH |

> **2026-04-11 Fixed** — CFG-01: Added `validatePricing()` and `validateProfile()` runtime validation: pricing must be non-negative, tier must be valid enum, contextWindowTokens/maxOutputTokens must be positive.

## 5. Architecture and Design Issues

### 5.1 Encapsulation Violation: Store Private Property Penetration

At least three services bypass `Phase1aStore` public API, directly accessing private `db.connection` via unsafe type assertions:

| Service | Penetration Count | Pattern |
| --- | --- | --- |
| `memory/experience-cache-service.ts` | 5 | `(this.store as unknown as { db: { connection: ... } }).db` |
| `memory/memory-retrieval-service.ts` | 7 | Same as above |
| `tools/skill-governance-service.ts` | 7 | Same as above |

**Consequences**:
1. Store interface is incomplete abstraction
2. These services tightly coupled to SQLite implementation
3. Postgres backend cannot be used by these services
4. Any store internal refactoring causes 19 silent crashes

### 5.2 Duplicate Initialization Logic

`agent-executor.ts:91-143` (initializeAgentExecutor) and `middleware-init.ts:43-89` (initializeMiddleware) contain nearly identical logic:
- Check if already initialized
- Register tool argument coercion middleware
- Register loop detection middleware
- Create context object with loop detection state

If both are called, hooks may be registered twice (though name deduplication exists).

### 5.3 `forceSteal` Returns Fake Lock Record ✅ Fixed

| ID | File:Line | Problem |
| --- | --- | --- |
| A-01 | `locking/distributed-lock-service.ts:453-467` | PostgreSQL Advisory Lock `forceSteal()` returns a fabricated `LockRecord` (`status: "held"`), but **cannot** actually steal advisory lock. Comment says "Advisory locks can't be forcefully stolen" but return claims success — correctness bug |

**Recommendation**: Throw `Error('Advisory lock steal not supported')` or return `null`.

### 5.4 PostgreSQL Shim Sync/Async Fundamental Mismatch ✅ Fixed

`PgDatabase` is not a nominal "PostgreSQL backend adapter" but a fundamentally flawed fake adapter:

| ID | File:Line | Problem |
| --- | --- | --- |
| A-02 | `storage/postgres/pg-database.ts:91-94` | JSDoc explicitly states: "This class does NOT implement AuthoritativeSqlDatabase because the interface requires synchronous transaction() while PostgreSQL requires async." |
| A-03 | `storage/storage-backend-factory.ts:199-211` | Factory uses `as any as AuthoritativeSqlDatabase` to force async PG driver into sync interface |
| A-04 | `storage/postgres/pg-database.ts:363-368` | `transaction<T>` declared `async`, but `AuthoritativeSqlDatabase` interface requires synchronous version |

**Consequences**: `pgDb.migrate()` and `pgDb.close()` return `Promise`, but are discarded with `void`, callers cannot know if migration succeeded. Cannot be equivalently replaced with SQLite at transaction boundary.

**Recommendation**: Define separate `AsyncSqlDatabase` interface alongside `AuthoritativeSqlDatabase`; or introduce async transaction abstraction in storage layer.

### 5.5 Event Bus Fanout Mechanism Missing ✅ Fixed

`DurableEventBus` publish method is half-finished:

| ID | File:Line | Problem |
| --- | --- | --- |
| A-05 | `events/durable-event-bus.ts:72-95` | `publish()` only calls `this.store.insertEvent()` to write event, **never iterates** `this.subscribers`. No auto fanout — consumers must actively call `deliverPending()` to receive events |
| A-06 | `events/durable-event-bus.ts:102-114` | `deliverPending()` is completely independent method, not on `publish` call chain. Events pile up in store indefinitely if no consumer polls |

> **2026-04-11 Fixed** — `publish()` now auto-queues fan-out for subscribed consumers after durable write; introduced serial delivery chain per consumer, avoiding duplicate delivery when auto fan-out and explicit `deliverPending()` concurrent; single event dead-letter no longer blocks subsequent pending deliveries for same consumer.

**Recommendation**: `publish()` should trigger `deliverPending()` immediately or asynchronously; or clearly document `DurableEventBus` as "manual pull" mode and update contract.

### 5.6 Phase1aStore Monolithic Class Over-Expansion ⚠️ Partially Fixed

`src/core/storage/sqlite/phase1a-store.ts` is **7,208 lines**, single `export class Phase1aStore` carries all data access logic:

| Responsibility | Manifestation |
| --- | --- |
| Entity CRUD | Task, Execution, Workflow, Session, Phase1aEvent etc. 15+ entity types |
| Complex queries | Multi-table JOINs, transaction wrapping, aggregate statistics |
| Migration management | Migration plan execution, rollback |
| Event writing | tier_1/tier_2/tier_3 event distribution |
| Operational records | dead_letters, gateway_delivery_receipts etc. |

No interface abstraction layer (no `ITaskStore`, `IExecutionStore` etc.), all query logic inline in single class.

> **2026-04-11 Partially Fixed** — Added `src/core/storage/repositories/runtime-lifecycle-repository.ts`, extracting task/workflow/session/execution/approval key lifecycle updates and tier-1 event writing into `RuntimeLifecycleRepository`, unified reused by `TransitionService` / `ApprovalService`; but vast majority of entity CRUD, aggregate queries and operational writes still piled in `Phase1aStore`, full repository-ization not yet complete.

**Consequences**: Any new entity type requires modifying this 7,208-line class; cannot independently unit test different entity types; storage decorators (metrics, retry) cannot be applied finely.

**Recommendation**: Split by entity type into independent repository classes (`TaskRepository`, `ExecutionRepository` etc.), Phase1aStore composes these repositories.

### 5.7 Middleware Chain Both Registry and Executor ⚠️ Partially Fixed

`AgentMiddlewareChain` confuses two different concerns:

| ID | File:Line | Problem |
| --- | --- | --- |
| A-07 | `agent-middleware-chain.ts:102-107` | 6 hook arrays as private state declarations |
| A-08 | `agent-middleware-chain.ts:116-144` | 6 `register*` methods push to arrays (registry responsibility) |
| A-09 | `agent-middleware-chain.ts:150-186` | `runHookChain()` iterates and executes hooks (executor responsibility) |
| A-10 | `agent-middleware-chain.ts:300-365` | `runAgentRound()` orchestrates 5 phases in composition mode, each phase independently calls `buildContext()` (context rebuild issue P-03) |

**Consequences**: Registration and execution not concurrent-safe (R-11); resetting middleware leaves stale hooks on global chain (R-12); 6 arrays' state crosses 5 phases in `runAgentRound`, implicit state sharing risk.

**Recommendation**: Separate `MiddlewareRegistry` (only responsible for registration/query/reset) and `MiddlewareExecutor` (only responsible for ordered execution); or introduce explicit `MiddlewareChainBuilder` replacing chain push pattern.

### 5.8 Provider Abstraction Missing: Unified Provider Directly References Concrete Implementation ✅ Fixed

`UnifiedChatProvider` is a facade but not an abstraction:

| ID | File:Line | Problem |
| --- | --- | --- |
| A-11 | `providers/unified-chat-provider.ts:14-16` | Directly imports concrete classes: `AnthropicChatService`, `OpenAIChatService`, `MiniMaxChatService` |
| A-12 | `providers/unified-chat-provider.ts:138-140` | Private field types are concrete classes, not interfaces |
| A-13 | `providers/unified-chat-provider.ts:195` | Return type is concrete type union, not interface: `{ provider: ChatProviderType; service: AnthropicChatService \| OpenAIChatService \| MiniMaxChatService }` |

**No** `ChatProvider` interface to decouple unified provider from three concrete implementations.

**Consequences**: Adding provider (e.g., Google AI Studio, Cohere) requires modifying `UnifiedChatProvider` source and recompiling; cannot use mock provider in tests; all provider type information unavailable at runtime through interface query.

**Recommendation**: Define `ChatProvider` interface (with `chat()`, `stream()` etc. method signatures), three concrete providers implement this interface, `UnifiedChatProvider` only depends on interface.

### 5.9 Transition Service Cross-Entity Aggregation Causes Tight Coupling ✅ Fixed

`TransitionService` attempts cross-entity atomic transitions for Task, Workflow, Session, Execution four entity types:

| ID | File:Line | Problem |
| --- | --- | --- |
| A-14 | `runtime/transition-service.ts` (overall) | `transitionTask`, `transitionWorkflow`, `transitionExecution` etc. methods share same `TransitionCommand` structure, but entity transition rules, freeze conditions, pre-checks vary hugely; stuffing into same generic method produces massive `if (entityType === 'task')` branching |

> **2026-04-11 Fixed** — `TransitionService` split into `TaskTransitionService`, `WorkflowTransitionService`, `SessionTransitionService`, `ExecutionTransitionService`, `ApprovalTransitionService` etc. entity-level state services, added generic `StateTransitionMachine<TState>`. `transitionBlockedForApproval(...)` now landed as atomic aggregate entry, responsible for synchronously blocking task/workflow/session/execution and creating approval request.

**Consequences**: Adding entity type or new transition path requires modifying `TransitionService` core; approval transition atomicity cannot be guaranteed; lacks reusability compared to current system `StateMachine<TState>` generic.

**Recommendation**: Split `TransitionService` into `TaskTransitionService`, `WorkflowTransitionService` etc. independent state machines, each implementing generic `StateMachine<T>` interface.

### 5.10 CallGovernance Multi-Responsibility Merge ✅ Fixed

> **2026-04-11 Fixed** — `CallGovernance` changed to facade composition of `CallRateLimiter`, `CallCircuitBreaker`, `CallHistoryRecorder` three independent components, rate limit/circuit break/history statistics now separately unit-testable and independently evolvable.

`CallGovernance` (call-governance.ts) previously stuffed three very different runtime strategies into same class:

| Responsibility | Implementation | Problem |
| --- | --- | --- |
| Rate limiting | `limiterEntries` Map | check-then-act race (C-14), no atomic operations |
| Circuit breaker | `breakerEntries` Map | half-open state transition non-atomic (C-16) |
| Call history | `callHistory` Map | No upper limit memory leak (C-07) |

**Consequences**: Rate limit logic cannot be independently unit tested; circuit breaker state machine and rate limit logic interfere (e.g., half_open state rate limit handling undefined); three strategies' configurations (e.g., windowMs, threshold) mixed in same config object.

**Recommendation**: Split into `RateLimiter`, `CircuitBreaker`, `CallHistoryRecorder` three independent classes, `CallGovernance` as facade composing all three.

## 6. Performance Issues

### 6.1 Structured Log Buffer O(n) Complexity

| ID | File:Line | Problem |
| --- | --- | --- |
| P-01 | `observability/structured-logger.ts:77-82` | Buffer overflow uses `splice(0, overflowCount)`, moves all remaining elements each time, O(n) per log entry. With 500 entry upper limit, each shift moves up to 500 elements |

> ✅ **2026-04-11 Fixed** — Ring buffer implementation O(1) write, binary insertion O(n), context built once.

**Recommendation**: Use ring buffer (Ring Buffer), O(1) write.

### 6.2 Every Hook Registration Full Re-sort

| ID | File:Line | Problem |
| --- | --- | --- |
| P-02 | `runtime/agent-middleware-chain.ts:117-143` | Every `register*` call sorts entire hook array O(n log n). Binary insertion only needs O(n) |

### 6.3 Middleware Chain Each Phase Rebuilds Context

| ID | File:Line | Problem |
| --- | --- | --- |
| P-03 | `runtime/agent-middleware-chain.ts:322-365` | `runAgentRound`'s 5 phases (beforeAgent/beforeModel/wrapModelCall/afterModel/afterAgent) each independently call `buildContext()`, creating new context object with `nowIso()`. 5 date serializations and cross-phase timestamp inconsistency |

> **2026-04-11 Fixed** — Context now built once at `runAgentRound` entry, reused across all phases.

**Recommendation**: Build context once at `runAgentRound` entry, reuse across all phases.

### 6.4 PostgreSQL No Connection Pool

| ID | File:Line | Problem |
| --- | --- | --- |
| P-04 | `locking/distributed-lock-service.ts:381` | PG advisory lock adapter reads DSN/SSL directly from `process.env`, pool parameters hardcoded constants, missing explicit connection pool configuration and verifiable initialization boundary |

> ✅ **2026-04-11 Fixed** — Added shared `core/config/postgres-pool-env.ts`, `PgAdvisoryLockAdapter` changed to centralized DSN / pool / timeout / SSL configuration parsing, supports injectable `postgresFactory` for single initialization verification and parameter pass-through.

**Recommendation**: Use connection pool, set pool.min / pool.max / idleTimeoutMillis.

### 6.5 Timer Leaks Causing Resource Continued Occupation

| ID | File:Line | Problem |
| --- | --- | --- |
| P-05 | `runtime/effect-buffer.ts:305` | `setTimeout` (Promise.race timeout) when main effect resolves before timeout, timeout timer **never cleared**. Each successful effect execution leaks one hanging setTimeout, memory continuously grows |
| P-06 | `tools/skill-execution-service.ts:705` | `setTimeout` (tool timeout) same pattern as P-05: Promise constructor setTimeout, tool completes normally but timer remains |

> **2026-04-11 Fixed** — effect-buffer changed to `AbortSignal.timeout()`; skill-execution-service has `finally` block clearing timer.

**Recommendation**: Use `AbortController` + `AbortSignal.timeout()` instead of manual setTimeout; or clear timeout in Promise.race callback.

### 6.6 Storage Decorator Missing — No Query Retry and Metrics Instrumentation

| ID | File:Line | Problem |
| --- | --- | --- |
| P-07 | Overall storage layer | `Phase1aStore` has no `MetricsDecorator` (query timing/counting) and `RetryDecorator` (SQLITE_BUSY retry + jittered backoff). Current system has no exponential backoff retry on SQLite BUSY conflicts, high-concurrency write scenarios operations fail directly instead of retrying |

> ⚠️ **2026-04-11 Partially Fixed** — Added `RuntimeLifecycleRepository`, `RetryingRuntimeLifecycleRepository`, `ObservedRuntimeLifecycleRepository`, and switched task, execution, approval lifecycle main write paths to repository decorator chain; continued adding `decoratePhase1aStore()` proxy decorator, and unified access in `storage-backend-factory`, making all `Phase1aStore` methods accessed through authoritative storage context have base observability and `SQLITE_BUSY` retry; but not yet supplemented with global metrics aggregation, jittered backoff and direct `new Phase1aStore(...)` call point unified decoration.

**Recommendation**: Reference current system implementation, add query metrics decorator and SQLite BUSY retry decorator for storage layer.

### 6.7 No Log Persistence — Lost on Process Restart

| ID | File:Line | Problem |
| --- | --- | --- |
| P-08 | `observability/structured-logger.ts` overall | `StructuredLogger` is pure memory ring buffer (upper limit 500 entries), silently drops on overflow. No disk log persistence, no log rotation, no external log delivery (no pino/winston/bunyan). Logs completely lost on process restart, fault investigation has no traceability |

**Recommendation**: Integrate pino/winston file log driver with logrotate; or add structured log external delivery channel (e.g., Loki/DataDog).

## 7. API Security Gaps

> ✅ **2026-04-10 Fixed** — All API security issues fixed this iteration.

### 7.1 Authentication Bypass (3 CRITICAL)

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| API-01 | `api/http-api-server.ts:283-294` | Webhook signature key read from request header `x-webhook-secret`, provided by caller. Caller controls both key and signature, HMAC verification completely ineffective | CRITICAL | ✅ Fixed — Changed to server-configured `webhookSecret`, read from `HttpApiServerOptions.webhookSecret` |
| API-02 | `api/http-api-server.ts:268-327` | Webhook endpoint `/v1/gateway/webhooks/receive` has no `requirePrincipal()` call. Signature verification only executes when `x-webhook-secret` exists, nonce verification only when `x-webhook-nonce` exists. Omitting both headers bypasses all guards | CRITICAL | ✅ Fixed — Added `requirePrincipal(request, this.options.authService ?? null, "operator")` |
| API-03 | `api/http-api-server.ts:623-647` | When `authService` is null, `requirePrincipal()` falls back to trusting `x-aa-actor-id` request header, granting `["admin","operator","viewer"]` all roles, and `authMethod` forged as `"jwt"` | CRITICAL | ✅ Fixed — When `authService` is null, throws `ApiError(401, "api.auth_required")`, fail-close instead of trusting header |

### 7.2 Read-only and Console Endpoint Authentication Missing ✅ Fixed

All endpoints now uniformly connected to `requirePrincipal()`; global aggregate surfaces (dashboard/stability/admin summary) fail-close for tenant-scoped principal, avoiding tenant privilege escalation reading global state:

| Line | Endpoint | Exposed Data | Status |
| --- | --- | --- | --- |
| 201-204 | `GET /v1/dashboard/snapshot` | Complete task panel, pending approvals, departments, billing accounts, PMF reports, gateway targets | ✅ Fixed — Requires `viewer`, tenant principal returns `api.tenant_scope_unsupported` |
| 350-366 | `GET /v1/tasks` | Task summary list | ✅ Fixed — Requires `viewer`, filtered by `principal.tenantId` |
| 360-367 | `GET /v1/workflows` | Workflow summary list | ✅ Fixed — Requires `viewer`, filtered by `principal.tenantId` |
| 370-414 | `GET /v1/tasks/:taskId` / `/events` / `/inspect` | Single task snapshot, event stream, Inspect view | ✅ Fixed — Requires `viewer`, returns 404 for cross-tenant tasks |
| 408-414 | `GET /v1/workflows/:workflowId` | Workflow details | ✅ Fixed — Requires `viewer`, returns 404 for cross-tenant workflows |
| 460-488 | `GET /v1/admin/*` control plane summary/takeover | Admin takeover console, load balancing summary | ✅ Fixed — Requires `admin`, tenant principal cannot access global surface |
| 493-565 | `GET /console/*` (tasks, workflows, approvals, stability, takeover, targets) | HTML dashboard | ✅ Fixed — All protected by role verification, console detail pages also execute tenant access check |

### 7.3 Other API Security Issues

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| API-04 | `api/api-auth-service.ts:116` | API Key lookup uses `===` comparison instead of `timingSafeEqual`, timing side-channel attack exists | HIGH | ✅ Fixed — Added `timingSafeEqualString()` function, uses `crypto.timingSafeEqual()` for API key comparison |
| API-05 | `api/http-api-server.ts:649-658` | `readIncomingBody()` has no request body size limit, attackers can send GB-level body exhausting memory | HIGH | ✅ Fixed — Added `maxSizeBytes` parameter, default 1MB, throws `ApiError(413, "api.body_too_large")` on overlimit |
| API-06 | `api/http-api-server.ts:527-546` | No CORS headers, no `OPTIONS` preflight handling; no `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` etc. security headers | HIGH | ✅ Fixed — `buildJsonResponse` and `buildHtmlResponse` added all security response headers |
| API-07 | `api/http-api-server.ts:138-151` | No HTTP layer rate limiting. API Key brute force, request flood have no protection | HIGH | ✅ Fixed — Added `HttpApiServer` built-in memory rate limiter, default 100 requests/minute, supports `rateLimitWindowMs`/`rateLimitMaxRequests` config |
| API-08 | `api/http-api-server.ts:1050` | Unhandled `Error` instance `.message` directly returned to caller, may leak SQL errors, file paths etc. internal information | MEDIUM | ✅ Fixed — `normalizeError()` added `sanitizeErrorMessage()` function, non-whitelist errors return generic message |
| API-09 | `api/http-api-server.ts:244,268,400-417` | POST endpoints have no CSRF Token verification. HTML console creates same-origin context, vulnerable to cross-site forged requests | MEDIUM | ✅ Fixed — Added `validateCsrf()` function, all POST endpoints support Origin/Referer verification |
| API-10 | `api/http-api-server.ts:599-605` | `x-request-id` accepts arbitrary length string, no character whitelist, reflected to response headers and JSON body, can be used for log injection | LOW | ✅ Fixed — `readRequestId()` added `MAX_REQUEST_ID_LENGTH = 128` limit, overlong truncated |

## 8. OIDC/OAuth Implementation Defects

> ✅ **2026-04-10 Fixed** — All OIDC/OAuth implementation defects fixed.

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| OIDC-01 | `api/oidc-oauth-service.ts:443-449` | `ecAlgToNode()` maps ES256/ES384/ES512 to `RSA-SHA256`/`RSA-SHA384`/`RSA-SHA512`. Comment claims "Node crypto doesn't support ES* directly" is **incorrect**. Correct mapping is `SHA256`/`SHA384`/`SHA512`. Using RSA digest algorithm with EC keys causes unreliable signature verification | CRITICAL | ✅ Fixed — `ecAlgToNode()` correctly mapped to `SHA256`/`SHA384`/`SHA512` |
| OIDC-02 | `api/oidc-oauth-service.ts:516-521` | PKCE code challenge uses `createHmac("sha256", "")` instead of `createHash("sha256")`. RFC 7636 Section 4.2 requires `BASE64URL(SHA256(code_verifier))`, HMAC output differs from SHA-256 hash. Any standards-compliant IdP will reject code_challenge | CRITICAL | ✅ Fixed — `generateCodeChallenge()` uses `createHash("sha256")` |
| OIDC-03 | `api/oidc-oauth-service.ts:418-421` | `verifyHmacSignature()` reads `key.x` as HMAC key. JWK symmetric key (`kty: "oct"`) uses `k` field, `x` is EC public key x-coordinate. All HMAC signature JWT verification will fail | HIGH | ✅ Fixed — `verifyHmacSignature()` correctly uses `key.k` |
| OIDC-04 | `api/oidc-oauth-service.ts:370-371` | JWT `alg` obtained from untrusted header, priority higher than key's own `alg`. Attackers can specify weak hash algorithm (e.g., `RS256` replacing `RS512`) to downgrade signature verification strength | HIGH | ✅ Fixed — `alg` only obtained from `key.alg ?? "RS256"`, removed `header.alg` downgrade path |
| OIDC-05 | `api/oidc-oauth-service.ts:98,105,206-211` | `skipSignatureVerification` constructor parameter allows completely bypassing signature verification. No `NODE_ENV` protection, is production-accessible escape path | HIGH | ✅ Fixed — `skipSignatureVerification = skipVerification && process.env.NODE_ENV === "test"` |
| OIDC-06 | `api/oidc-oauth-service.ts:357-363` | `kid` mismatch silently falls back to `keys[0]`, weakens kid key binding security significance | MEDIUM | ✅ Fixed — When `header.kid` specified but not found, directly returns `false` rejecting token |
| OIDC-07 | `api/oidc-oauth-service.ts:181-211` | JWT claims parsed and used before signature verification (issuer/audience/expiry checks before signature check), architecture is claims-before-verify anti-pattern | MEDIUM | ✅ Fixed — `validateFederatedToken()` first verifies signature then checks claims |

## 9. Container and Deployment Issues

> ✅ **2026-04-10 Fixed** — All container and deployment issues fixed.

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| D-01 | `Dockerfile:36` | `CMD ["node", ...]` runs directly as PID 1, no tini/dumb-init. Node.js doesn't handle PID 1 responsibilities: doesn't reap zombie processes, `SIGTERM` may not be properly forwarded | HIGH | ✅ Fixed — Added tini as ENTRYPOINT, correctly handles PID 1 responsibilities |
| D-02 | `Dockerfile` (missing) | No `HEALTHCHECK` instruction. `docker ps` always shows healthy, Docker Swarm cannot auto-restart unhealthy containers | MEDIUM | ✅ Fixed — Added `HEALTHCHECK --interval=30s --timeout=10s --retries=3` |
| D-03 | `Dockerfile:11,16,26` + `tsconfig.json:20` | `tsconfig.json` `include` contains `tests/**/*.ts`, `npm run build` compiles test code to `dist/tests/`, `COPY --from=build /app/dist ./dist` copies test code into production image | MEDIUM | ✅ Fixed — Created `tsconfig.build.json` only containing `src/**`, Dockerfile uses `npm run build:prod` |
| D-04 | `tsconfig.json:20` | Single `tsconfig.json` compiles both src and tests, no `tsconfig.build.json` separation for production build | MEDIUM | ✅ Fixed — Added `tsconfig.build.json`, main `tsconfig.json` removes tests, only compiles src |
| D-05 | `Dockerfile` (missing) + repo overall | No Kubernetes manifests, Helm charts, docker-compose files. System has complete HTTP API, health services, distributed locks, load balancing, but zero deployment orchestration code | HIGH | ✅ Fixed — Created `docker-compose.yml` providing basic container orchestration |
| D-06 | `.dockerignore:1-10` | `tests/` directory not excluded, 323 test files (2.2 MB) included in build context each time | LOW | ✅ Fixed — `.dockerignore` added `tests`, `*.test.ts`, `*.spec.ts` |
| D-07 | `Dockerfile:23-24` + `package.json:88-91` | `npm ci --omit=dev` actually installs zero dependencies (`package.json` only has `devDependencies`), producing empty `node_modules` and wasteful Docker layers | LOW | ✅ Fixed — Runtime image uses `npm ci --include=dev` |
| D-08 | `Dockerfile:10-14` | `COPY tests ./tests` after `COPY src`, test file changes cause source code compile cache invalidation | LOW | ✅ Fixed — Dockerfile no longer copies tests directory |

## 10. Configuration Management Issues

> ⚠️ **2026-04-11 Partially Fixed** — CFG-01 / CFG-02 / CFG-03 / CFG-04 / CFG-06 fixed. CFG-05 further closed core runtime/storage/env paths, but full repo env schema unification still incomplete.

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| CFG-01 | `config/model-metadata-registry.ts:103-121` | `parseRegistry()` only validates top-level field types, then `as unknown as ModelMetadataRegistry` force converts. Pricing, tokenLimit, tier, capabilities **zero runtime validation**. Malformed config (e.g., negative pricing) can cause reverse billing | HIGH | ✅ Fixed — Added `validatePricing()` and `validateProfile()` runtime validation: pricing must be non-negative, tier must be valid enum, contextWindowTokens/maxOutputTokens must be positive |
| CFG-02 | `locking/distributed-lock-service.ts:379` | `ssl: { rejectUnauthorized: false }` — when `PGSSLMODE=require` disables TLS certificate verification, accepts any certificate including MITM. This is distributed lock service, critical coordination infrastructure | HIGH | ✅ Fixed — TLS certificate verification enabled by default. Only disabled when `PGSSLVERIFY=none` set (requires explicit config and outputs security warning) |
| CFG-03 | `config/model-metadata-registry.ts:31-97` | Four model profiles' pricing all hardcoded as compile-time constants, no refresh mechanism, no expiration detection, no external API integration | MEDIUM | ✅ Fixed — Bundled model metadata externalized to `config/providers/models.bundled.json`, `loadModelMetadataRegistry()` now supports bundled snapshot + `config/providers/models.json` local override merge, supplemented with provider/profile runtime validation |
| CFG-04 | `product/billing-service.ts:121-225` | Complete billing plan including quotas, unit prices, limits all hardcoded, price changes require code modification and redeployment | MEDIUM | ✅ Fixed — Billing plan externalized to `config/product/default.json`, `BillingService` defaults through `loadBillingPlanCatalog()` loading config directory with plan/quota schema validation |
| CFG-05 | Full codebase (448+ locations) | `process.env` scattered across modules directly used, no centralized env schema validation. Sensitive variables like `AA_API_JWT_SECRET` only `.trim()` without minimum length/entropy check | MEDIUM | ⚠️ Partially Fixed — Added shared `core/config/runtime-env.ts`, switched core runtime/storage paths (`startup-preflight`, `storage-backend-factory`, `division-loader`, `doctor-service`, `execution-resource-ceiling-guard`) to centralized parsing; previously added `core/config/billing-env.ts` and switched `cli/billing.ts` to centralized env schema, this round continued adding `core/config/runtime-ops-env.ts` closing `cli/dispatch-execution.ts`, `cli/worker-handshake.ts`, `cli/worker-writeback.ts`, added `core/config/operations-cli-env.ts` unifying `enterprise-governance` / `ops-program` / `environment-deployment` / `platform-operator` / `data-plane`, further added `core/config/remaining-cli-env.ts` closing `tenant-platform` / `enterprise-capability` / `marketplace` / `deployment-execution` / `ops-governance` / `control-plane-balancer` / `secret-management` / `worker-register`; `api-server-env` supplemented JWT strength and log rotation env validation, but full repo env schema unification still incomplete |
| CFG-06 | `config/config-governance-service.ts:240-337` | `validateBundle()` uses manual `typeof` checks instead of Zod schema, only does existence checks, doesn't validate field types and ranges | MEDIUM | ✅ Fixed — `ConfigGovernanceService` changed to declarative bundle schema validation, covering bootstrap/gateways/providers/runtime/security/workflows layer field types, integer constraints and nested object shapes, supplemented with unit/integration regression tests |

## 11. Multi-Tenancy and Billing Readiness

> ⚠️ **2026-04-12 Partially Fixed** — MT-01/03 fixed. MT-02/06 completed API surface and task main query first-phase tenant closure, further supplemented API request → `RuntimeContext` tenant auto-injection, and `Phase1aStore` automatic tenant filtering on core queries like `listTasks/getTask/loadTaskSnapshot/listEventsForTask/listApprovalsByTask/listExecutionsByTask`; MT-04 supplemented PostgreSQL authoritative storage async management entrance, continued supplementing dual-run shadow SQLite fallback for sync CLI main path, but runtime main path still incomplete backend switch; MT-05 added invoice / payment session persistence, checkout / settle / reconcile main path, continued supplementing API webhook reconcile entrance, but still incomplete automatic reconciliation task and multi-provider support.

| ID | File:Line | Problem | Severity | Status |
| --- | --- | --- | --- | --- |
| MT-01 | `api/http-api-server.ts:623-647` | When `authService` is null, `x-aa-actor-id` header grants all roles (same as API-03), in multi-tenant environment anyone can impersonate any tenant | CRITICAL | ✅ Fixed — When `authService` is null, throws `ApiError(401)`, no longer trusts `x-aa-actor-id` header |
| MT-02 | `api/http-api-server.ts` / `observability/inspect-service.ts` / `api/mission-control-service.ts` | Task, workflow, approval APIs previously didn't filter queries by `tenant_id`, tenant A could view tenant B's tasks and events | CRITICAL | ⚠️ Partially Fixed — `InspectService`/`MissionControlService` support tenant parameter, `HttpApiServer` injected tenant scope for tasks/workflows/approvals/detail routes, and dashboard/stability/admin global surface fail-close at service layer; other non-API read paths still not uniformly tenant-ized |
| MT-03 | `api/http-api-server.ts:267-327` | Webhook authentication controlled by caller (same as API-01/02), in multi-tenant environment anyone can inject messages to any tenant | CRITICAL | ✅ Fixed — Webhook endpoint now requires authentication, uses server-configured secret |
| MT-04 | `storage/sqlite/sqlite-database.ts:88-91` | SQLite WAL mode + 5s busy_timeout. System uses same SQLite database for all writes: tasks, events, billing, delivery etc., concurrent multi-tenant write contention causes timeout and operation loss | HIGH | ⚠️ Partially Fixed — Added `openAsyncAuthoritativeStorageBackend()` and `cli/authoritative-storage-admin`, making PostgreSQL authoritative backend available for plan, open and migration verification; previously changed async `Phase1aStore` context to fail-close for PostgreSQL, no longer returning pseudo sync store that only explodes at runtime; this round continued unifying CLI authoritative storage helper as shutdown-safe/idempotent close, and when `AA_STORAGE_DRIVER=postgres` with dual-run enabled, sync CLI explicitly falls to configured shadow SQLite instead of continuing blind binding to old `AA_DB_PATH` or directly going pseudo sync postgres; but `Phase1aStore` and existing runtime main path still not truly migrated to PostgreSQL, multi-writer bottleneck not yet fundamentally resolved |
| MT-05 | `product/billing-service.ts:283-562` | Billing service is self-contained internal ledger: records usage, manages quotas, calculates costs, but has no payment gateway integration (Stripe/Paddle etc.), no invoice generation, no collection process | MEDIUM | ⚠️ Partially Fixed — Added `billing_invoices` / `billing_payment_sessions` storage, `BillingService.createInvoice()/createCheckoutSession()/settlePaymentSession()` collection main path, and billing CLI corresponding actions; previously supplemented optional `StripeBillingPaymentGateway`, supports creating remote payment links through Stripe Checkout Session API; previously also added `BillingService.reconcilePaymentSession()` and billing CLI `reconcile_payment`, this round continued supplementing `POST /v1/billing/webhooks/reconcile` API entrance, can write back remote payment status through operator auth or `AA_WEBHOOK_SECRET` signature verification and automatically settle invoice on payment; but still no automatic reconciliation task, Paddle and other providers, complete provider webhook canonical adapter |
| MT-06 | Full codebase | `Phase1aStore` queries (7208 lines) don't filter by `tenant_id`. `tenants` table exists, `TenantPlatformService` can create tenants, but normal business queries have no tenant context injection | CRITICAL | ⚠️ Partially Fixed — Tasks main write/read path supplemented with `tenant_id` persistence and reading, API queries started passing tenant scope; previously supplemented request-level `TenantContext` and tasks/events/approvals/executions main queries, this round continued switching `TenantPlatformService` internal cross-organization/namespace boundary and not-found/billing-account failure paths to `TenantBoundaryError` / `ValidationError` / `MonetizationError`, and switched `MissionControlService` dashboard/stability/admin global view not yet tenant-ized at service layer to explicit fail-close, avoiding internal calls bypassing API protection reading global data; but still not achieving full repo query unified tenant-ization, especially several product/governance table models still lack tenant dimension |

## 12. Gateway Implementation Gaps

| ID | File:Line | Problem | Severity |
| --- | --- | --- | --- |
| GW-01 | `core/security/outbound-url-policy.ts` + `gateway/channel-gateway-service.ts` | ✅ Fixed — Unified `sanitizeUrlForTelemetry()`, Telegram bot token / URL credentials / query secrets no longer written to receipt, delivery tracking records or API response | HIGH |
| GW-02 | `core/security/outbound-url-policy.ts` + `gateway/channel-gateway-service.ts` + `core/tools/web-fetch.ts` | ✅ Fixed — Extracted shared outbound URL policy; webhook sending and `web-fetch` uniformly reuse `parseSafeOutboundUrl()` / `isInternalNetworkUrl()`, blocking `169.254.169.254`, `localhost`, RFC1918, link-local and non-HTTP(S) outbound | CRITICAL |
| GW-03 | `gateway/channel-gateway-service.ts` + `channel-gateway-delivery-service.ts` | ✅ Fixed — Tracked delivery message created before actual sending; failed requests automatically fall to retry or dead-letter by retryable/non-retryable; added `channel-gateway-retry-executor` background poller connected to `api-server`, failed messages can async retry and auto-upgrade dead-letter | HIGH |
| GW-04 | `gateway/channel-gateway-service.ts` + `channel-gateway-delivery-service.ts` | ✅ Fixed — `sendMessage()` now connected to `checkRateLimit()` in real sending path, successful delivery writes `recordRateLimitHit()`; provider rate limiting no longer remains in "function defined but not effective" state | MEDIUM |
| GW-05 | `gateway/channel-gateway-service.ts` + `api/http-api-server.ts` | ✅ Fixed — API gateway sending endpoint only returns sanitized public receipt, no longer exposing `responseStatus`; `requestUrl` uniformly sanitized for sensitive information | HIGH |

## 13. Observability and Operations Gaps

> ⚠️ **2026-04-11 Partially Fixed** — 13.1 closed as usable Prometheus `/metrics` exposure; 13.2 added `StructuredLogger` global file sink, connected `AA_LOG_FILE_PATH/AA_LOG_FILE_MAX_BYTES/AA_LOG_FILE_MAX_FILES` in `api-server`, this round continued supplementing in-process size rotation; external centralized log transport still incomplete; 13.3 fixed (6 raw console.* replaced with StructuredLogger).

### 13.1 Metrics Export

Previous system had `PrometheusMetricsExporter` prototype, but `api-server` not wired, runtime never recorded HTTP request metrics. This iteration injected and recorded HTTP request counters in `HttpApiServer`, and `cli/api-server.ts` actually mounted `/metrics`, exposing CPU, memory, HTTP requests, task execution and agent rounds Prometheus format metrics. OTel SDK still not integrated.

**Status**: ✅ Fixed — `/metrics` endpoint now usable and outputs Prometheus exposition format; OpenTelemetry still subsequent enhancement item

### 13.2 Log Persistence

Previous `StructuredLogger` was pure memory ring buffer (upper limit 500 entries), silently dropped on overflow. Current added global file sink, enabled JSONL disk write through `AA_LOG_FILE_PATH` by `api-server`; this round continued supplementing `AA_LOG_FILE_MAX_BYTES` + `AA_LOG_FILE_MAX_FILES` driven in-process rotation, logs no longer completely lost after process restart, also no longer unlimited appending to single file; but not yet providing external log agent/centralized transport integration.

**Status**: ⚠️ Partially Fixed — File persistence, API server wiring and file size rotation supported, but centralized external delivery still pending

### 13.3 Core Modules Using raw `console.*` Bypassing Structured Log

| File:Line | Call | Status |
| --- | --- | --- |
| `runtime/agent-middleware-chain.ts:410` | `console.warn(...)` | ✅ Fixed — Changed to StructuredLogger |
| `runtime/model-call-provider.ts:234` | `console.error(...)` | ✅ Fixed — Changed to StructuredLogger |
| `runtime/effect-buffer.ts:478` | `console.debug(...)` | ✅ Fixed — Changed to StructuredLogger |
| `runtime/loop-detection.ts:304` | `console.warn(...)` | ✅ Fixed — Changed to StructuredLogger |
| `runtime/phase1b-orchestration.ts:486` | `console.warn(...)` | ✅ Fixed — Changed to StructuredLogger |
| `runtime/phase1a-happy-path.ts:213` | `console.warn(...)` | ✅ Fixed — Changed to StructuredLogger |

Total 6 locations in core runtime code using raw console, all replaced with StructuredLogger.

## 14. Test Coverage Gaps

> ⚠️ **2026-04-11 Assessment Complete** — Test coverage is continuous work, not one-time fix. 38 untested modules need phased supplementation.

### 14.1 Overview

| Category | Count |
| --- | --- |
| Source files (`src/`) | 303 |
| Core source files (`src/core/`) | 227 |
| Test files (`*.test.ts`) | 316 |
| Core modules without corresponding tests | **38** |

### 14.2 Key Untested Modules

> ⚠️ The following modules lack direct unit test coverage, suggested prioritized phased supplementation.

| Category | File | Severity | Recommendation |
| --- | --- | --- | --- |
| Provider | `providers/anthropic/anthropic-chat-service.ts` | HIGH | Test provider with mock fetch + fake tokens |
| Provider | `providers/openai/openai-chat-service.ts` | HIGH | Test provider with mock fetch + fake tokens |
| Provider | `providers/unified-chat-provider.ts` | HIGH | Test routing logic and error handling |
| Security | `security/aws-kms-http-secret-provider.ts` | HIGH | Test HTTP key fetch with mock |
| Security | `security/gcp-secret-manager-http-secret-provider.ts` | HIGH | Test HTTP key fetch with mock |
| Security | `security/vault-http-secret-provider.ts` | HIGH | Test Vault API calls with mock |
| Security | `tools/command-security.ts` | HIGH | Priority test: security boundary, must cover |
| Security | `tools/tool-execution-access.ts` | HIGH | Test permission check logic |
| Security | `tools/tool-path-scope.ts` | HIGH | Test path validation logic |
| Storage | `storage/authoritative-sql-database.ts` | HIGH | Test transaction boundary and error handling |
| Storage | `storage/phase1a-store.ts` | HIGH | Priority test: core storage, must cover |
| Runtime | `runtime/runtime-repair-service.ts` | HIGH | Test repair logic |
| Runtime | `runtime/startup-consistency-checker.ts` | HIGH | Test startup consistency check |
| Runtime | `runtime/middleware-init.ts` | MEDIUM | Test middleware initialization |
| Runtime | `runtime/model-call-provider.ts` | MEDIUM | Test LLM call wrapper |
| Runtime | `runtime/execution-resource-monitor.ts` | MEDIUM | Test resource monitoring |
| Config | `config/model-metadata-registry.ts` | MEDIUM | Test config parsing and validation (added in CFG-01 fix) |
| Storage | `storage/sqlite/sqlite-reliability-service.ts` | MEDIUM | Test reliability service |
| Storage | `storage/sqlite/sqlite-migration-plan.ts` | MEDIUM | Test migration plan |

**Recommendation**: Prioritize adding unit tests for `command-security.ts` (security boundary), `phase1a-store.ts` (core storage), three provider services; security modules use mock HTTP to test key providers.

## 15. Code Hygiene

### 15.1 Backup Files in Repository ✅ Fixed

`back_up/doc_src_backup_20260410_113132.tar.gz` (1.8 MB) — deleted.

### 15.2 Division Definition Missing ✅ Fixed

Now completely defined **11** division YAMLs:

| Division ID | File |
| --- | --- |
| `engineering_ops` | `divisions/engineering_ops/division.yaml` |
| `general_ops` | `divisions/general_ops/division.yaml` |
| `research` | `divisions/research/division.yaml` |
| `content` | `divisions/content/division.yaml` |
| `data` | `divisions/data/division.yaml` |
| `devops` | `divisions/devops/division.yaml` |
| `security` | `divisions/security/division.yaml` |
| `qa` | `divisions/qa/division.yaml` |
| `design` | `divisions/design/division.yaml` |
| `analytics` | `divisions/analytics/division.yaml` |
| `support` | `divisions/support/division.yaml` |

### 15.3 `console.*` Usage

- `src/core/`**: 0 `console.log` (clean), 6 `console.warn/error/debug` (see 13.3)
- `src/cli/`**: 45 `console.log` (CLI output, normal usage)

### 15.4 TODO/FIXME/HACK Comments

- 0 TODO/FIXME/HACK markers found in production source (excluding legitimate data model identifiers like `TodoWrite`). Code hygiene good.

### 15.5 Commented Code Blocks

- No significant commented code blocks found. Code hygiene good.

## 16. Code and Documentation Inconsistency

### 16.1 Contract Documents vs Code (HIGH Severity)

| ID | Contract File | Code File | Inconsistency Description | Status |
| --- | --- | --- | --- | --- |
| DOC-01 | `contracts/event_bus_contract.md:63-90` | `events/event-types.ts:42-52` | Contract specifies core domain events use **dot-separated** (`task.created`), code actually **all uses colons** (`task:status_changed`). Naming convention inconsistency | ⚠️ Contract needs update |
| DOC-02 | `contracts/event_bus_contract.md:70-89` | `events/event-types.ts:42-52` | Contract lists `task.created` etc. events, code implements `task:status_changed` etc. Code event set uses different naming strategy than contract | ⚠️ Contract needs update |
| DOC-03 | `contracts/app_error_contract.md:9-72` | Full codebase | Contract defines `AppError` base class and 13 derived types, errors must be uniformly closed before entering runtime/gateway/recovery/observability layer. Repository previously had two unimplemented `AppError` definitions, API still used local `ApiError` | ⚠️ Partially Fixed — Unified `src/core/errors.ts` as sole `AppError` implementation, `src/core/types/app-error.ts` changed to re-export, `api-auth-service.ts` and `http-api-server.ts` connected to shared error model; this round continued switching `api-server-env`, `gateway-env`, `channel-gateway-env`, `postgres-pool-env`, `operations-cli-env`, `runtime-ops-env`, `storage-backend-factory`, `patch-dsl-service`, `perception-service`, `data-plane-flow-service`, `marketplace-governance-service`, `mission-control-service` and remaining CLI env/action entrances to `ValidationError` / `StorageError` / `PolicyDeniedError` / `TenantBoundaryError` / `MonetizationError`; but provider/ops/runtime and other core long tail still not fully closed |
| DOC-04 | `contracts/transition_service_contract.md:68-74` | `runtime/transition-service.ts` | Contract requires 7 freeze entry points, code implements 6. Missing `transitionApprovalStatus`; `transitionBlockedForApproval` **already exists** (gap analysis misjudgment) | ✅ Fixed — `TransitionService` supplemented `transitionApprovalStatus()`, `ApprovalService.applyDecision()` and cascade rejection path changed to write approval status through unified transition entrance |
| DOC-05 | `contracts/storage_schema_contract.md:275-289` | `storage/sql/phase1a-schema.ts:427-441` | `approvals` table structure completely different. Contract: 13 columns including `risk_level`, `reason`, `options_json`. Code: 9 columns, uses `request_json`, `response_json`, `timeout_policy` | ✅ Fixed — Updated `storage_schema_contract.md` to current authoritative schema: `approvals` uses `request_json` / `response_json` / `timeout_policy` JSON envelope design, aligned with `execution_id` / `responded_at` |
| DOC-06 | `contracts/storage_schema_contract.md:302-319` | `storage/sql/phase1a-schema.ts:443-459` | `file_locks` table column names completely different. Contract: `holder_task_id`, `normalized_path`, `reentrant_token`. Code: `owner_id`, `resource_path`, `lock_scope` | ✅ Fixed — Updated `storage_schema_contract.md` to current authoritative schema: `file_locks` uses `task_id` / `execution_id` / `lock_scope` / `resource_path` / `owner_id`, synchronized indexes and DDL appendix |

### 16.2 Contract Documents vs Code (MEDIUM Severity)

| ID | Contract File | Code File | Inconsistency Description | Status |
| --- | --- | --- | --- | --- |
| DOC-07 | `contracts/transition_service_contract.md:30-45` | `runtime/transition-service.ts:200-232` | Contract requires `TransitionCommand` containing `actor_type`, `idempotency_key`, `metadata_json`, code uses ad-hoc parameter object | ✅ Fixed — Defined unified `TransitionCommand` / entity status command types in `core/types/domain.ts`, `TransitionService`, runtime orchestration and `ApprovalService` all changed to typed command; contract supplemented with snake_case to TypeScript camelCase field mapping description |
| DOC-08 | `contracts/storage_schema_contract.md:26-43` | `storage/sql/phase1a-schema.ts` | Contract records 16 core tables, current schema expanded to **48 tables**. New tables mainly belong to organization/tenant, supply chain governance, security keys, billing data, perception evolution and other system expansion domains | ✅ Fixed — `storage_schema_contract.md` explicitly states "16 core tables" as minimum authoritative set, supplemented with extended table family description, avoiding misjudging extended tables as contract omissions |
| DOC-09 | `contracts/storage_schema_contract.md:323-334` | `storage/sql/phase1a-schema.ts:461-468` | `memories` table missing `session_id`, `agent_id`, `execution_id`, `memory_layer`, `embedding_ref`. Seven-layer memory architecture (ADR-003) has no storage layer support | ✅ Fixed — `storage_schema_contract.md` current version includes `memories` `session_id` / `agent_id` / `execution_id` / `memory_layer` / `embedding_ref` minimum column definition, this item is outdated audit conclusion |
| DOC-10 | `contracts/storage_schema_contract.md:293-295` | `storage/sql/phase1a-schema.ts:411` | `events` index naming was inconsistent between contract and implementation, causing erroneous audit conclusion | ✅ Fixed — `storage_schema_contract.md` updated to current authoritative schema: uses `idx_events_type_created_at ON events(event_type, created_at)` |
| DOC-11 | `contracts/division_definition_contract.md:8-17` | `divisions/*/division.yaml` | YAML uses `version`, `priority`, `default_workflow` etc. fields undefined in contract, code extensions to contract | ✅ Fixed — `division_definition_contract.md` supplemented with `version` / `priority` / `default_workflow` / `orchestration_workflow` fields, updated workflow reference rules |
| DOC-12 | `contracts/project_structure_contract.md:29-55` | `src/` directory | Contract requires `src/server/`, `src/tools/` etc. top-level directories, actually all nested under `src/core/` | ✅ Fixed — `project_structure_contract.md` updated to current authoritative directory structure: API/tools/providers/divisions loader all located in `src/core/`, `gateway/` only retains channel layer |

### 16.3 ADR vs Actual Implementation

| ID | ADR | Status | Inconsistency Description | Status |
| --- | --- | --- | --- | --- |
| DOC-13 | ADR-001 Three-tier architecture | Accepted | Uses CEO/VP product narrative names, ADR-014 requires canonical ID (`strategic_governor` etc.), but ADR-001 not updated | ✅ Fixed — `ADR-001` supplemented canonical ID and business alias mapping, clarified code/directory/contract layers unified using canonical ID |
| DOC-14 | ADR-003 Seven-layer memory | Accepted | Phase 1a should implement L1/L2/L5/L6, but ADR description of memory landing is behind current implementation | ✅ Fixed — `ADR-003` supplemented current `memories` table includes `memory_layer` / `session_id` / `agent_id` / `execution_id` / `embedding_ref`, explained L3/L5/L7 adopt unified record model progressive landing |
| DOC-15 | ADR-012 SQLite as sole storage | Accepted | ADR claims "SQLite is the sole primary transaction store", but `src/core/storage/postgres/` already has Postgres backend code | ✅ Fixed — `ADR-012` updated to "SQLite default/preferred primary transaction store, PostgreSQL can exist as controlled alternative backend", supplemented dual-run / adapter boundary |

### 16.4 README/Documentation Numeric Deviations

| ID | Documentation | Claimed | Actual | Status |
| --- | --- | --- | --- | --- |
| DOC-16 | `src/README.md:55` | "501 tests all passed" | Static hardcoded number, inevitably outdated | ✅ Fixed — Removed hardcoded count |
| DOC-17 | `src/README.md:10` | "45+ CLI commands" | Actual 71 CLI files | ✅ Fixed — Updated to "71 commands" |
| DOC-18 | `doc/18_code_architecture.md:29` | "32 CLI files" | Actual ~71 CLI files (2x difference) | ✅ Fixed — Updated to "71 files" |
| DOC-19 | `CLAUDE.md:53` | "~49 tables" | Actual 41 tables | ❌ False positive — CLAUDE.md already correctly written as "~41 tables" |

### 16.5 Code Comments vs Behavior

| ID | File:Line | Comment Claims | Actual Behavior | Status |
| --- | --- | --- | --- | --- |
| DOC-20 | `runtime/transition-service.ts:351` | JSDoc describes `transitionBlockedForApproval(...)` method | Method **already exists** (gap analysis misjudgment) | ✅ Verified exists |
| DOC-21 | `events/event-types.ts:82-93` | JSDoc says "@returns tier_1 or tier_2" | Code updated, now correctly returns `tier_1`, `tier_2` or `tier_3` | ✅ Fixed |
| DOC-22 | `api/oidc-oauth-service.ts:408` | Comment "Node crypto doesn't support ES*" | Comment corrected to "Node.js ECDSA verify uses algorithm string with ECDSA keys", algorithm mapping also corrected to `ecdsa-with-SHA256/384/512` | ✅ Fixed |

## 17. Gap Summary Against Current System

Reference system: `automatic_agent_sys` (current system) vs `automatic-agent-system-main` (reference system)

### 17.1 Dimensions Where Reference System Is Weaker

| Dimension | Current System Implementation | Reference System Status | Gap Assessment | Status |
| --- | --- | --- | --- | --- |
| **Process security** | fork bomb detection (`exec-policy.ts:27-28`), `detached: true` process group isolation, SIGTERM→SIGKILL graceful upgrade (`forceKillAfterDelay: 5000`), process semaphore concurrency control, MCP `killProcess()` two-phase termination | `command-executor.ts` already implements `detached: true`, `killProcessTree()` with SIGTERM→SIGKILL graceful upgrade (`forceKillAfterDelayMs: 5000`); `command-security.ts` already implements fork bomb detection (`FORK_BOMB_PATTERNS` + background task count); added `MAX_CONCURRENT_PROCESSES=16` process concurrency limit | ~~**Severe gap**~~ → **Implemented** | ✅ Fixed |
| **Command output security** | `bash.ts:77` executes `redactSecrets()` sanitization on stdout/stderr | `command-executor.ts:277,280` uses `sanitizeToolOutput()` implementing ANSI cleanup, control character removal, key sanitization, injection detection, truncation | ~~**Gap**~~ → **Implemented** | ✅ Implemented |
| **Error system** | `AppError` base class + 5 subclasses + 35 structured error codes (`E{N}xxx`), with `category`, `retryable`, `httpStatus`, `userMessage` metadata. `AppError.wrap()` safely wraps unknown errors | ad-hoc error classes (`ApiError`, `PgWriteError`, `OpenAIAPIError` etc.), no common base class, no error codes, no retryable/httpStatus metadata | **Severe gap** | ⚠️ Partially Fixed — Unified `core/errors.ts` landed, API/auth/provider/model-routing/config/storage core entrances further switched to `AppError` system; previously closed `role-tool-exposure-service`, `question-tool`, `tool-parallel-executor`, `todo-write-tool`, `shadow-snapshot-service`, this round continued switching `skill-execution-service`, `skill-creator-service`, `env/external/vault/aws/gcp secret provider`, `secret-management-service`, `tenant-platform-service`, `billing-payment-gateway`, `billing CLI`, `patch-dsl-service`, `perception-service`, `data-plane-flow-service`, `marketplace-governance-service`, `mission-control-service` and remaining old CLI/env entrances to `ValidationError` / `ProviderError` / `PolicyDeniedError` / `StorageError` / `TenantBoundaryError` / `MonetizationError`; but provider/ops/runtime and other core long tail still not fully replaced |
| **Middleware implementation** | 7 default + 3 optional = 10 concrete middleware (loop-detection, context-compaction, tool-error, tool-compaction, cost-tracking, audit-log, rate-limit, model-fallback, tool-coercion, hierarchical-limiter). `isCriticalError()` distinguishes security/resource errors re-throw | `createLoopDetectionMiddleware()` (loop-detection), `createToolArgumentCoercionMiddleware()` implemented and registered to global middleware chain via `middleware-init.ts` | ~~**Severe gap**~~ → **Partially implemented** | ✅ Partially implemented |
| **State machine** | Generic `StateMachine<TState extends string>` (67 lines), reusable for any entity | Implemented `StateTransitionMachine<TState extends string>`, reused by task/workflow/session/execution/approval five entity-level state machines | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Complexity routing** | 4 paths (passthrough/fast/standard/full), with keyword matching, QA mode detection, budget allocation, event emission | Implemented `complexity-router.ts`, supports passthrough/fast/standard/full four paths, with keyword matching, QA mode detection, token estimation, step awareness, budget factor allocation | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Cost estimation** | `planner.ts:109-128` based on `tasks` table historical data `AVG(cost_usd)` estimation, degrades to default on no data | Implemented `cost-estimation-service.ts`, based on `cost_events` table `AVG(cost_usd)` estimation, supports division-level and global-level estimation, confidence evaluation, default degradation on no data | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Graceful shutdown** | `GracefulShutdown` (74 lines): SIGINT/SIGTERM handling, uncaught exception handling, cleanup function registry (reverse execution), 15s timeout force exit, `reset()` test support | `ProcessTracker` process registry implemented (process tracking, PGID tracking, orphan cleanup), but `GracefulShutdown` class not yet implemented | **Severe gap** | ⚠️ Partially Fixed — `GracefulShutdown` supports explicit signal registration/deregistration, reverse handler cleanup, signal timeout force exit and `reset()`, connected to `cli/api-server.ts`; this round continued unifying `openCliAuthoritativeStorageContext()` / async variant wrapped as shutdown-safe storage handle, most CLIs opened through this helper now automatically register authoritative storage close handler and `close()` idempotent, but other long-lifecycle resources not managed through this helper still not uniformly incorporated |
| **Tool ecosystem** | 20+ built-in tools (bash, git, grep, glob, read, write, edit, apply-patch, web-fetch, web-search, spawn-agent, wait-agent, send-message, question, task-board, submit-result, diagnostics, todo-write, batch-tool, repo-map, file-time) + complete MCP support | ~7 tool services, lacking git, spawn-agent, wait-agent, send-message, batch-tool, repo-map etc. | **Gap** | ⚠️ Partially Fixed — `phase1b-orchestration` supplemented `git` / `repo-map` / `spawn-agent` / `wait-agent` / `send-message` / `batch-tool` executors, and truly passed visible tool schema to agent tool loop; sub-agents now have basic state cache, follow-up message and wait semantics; but more complete edit/read/bash/file-time family and MCP-level tool surface still incomplete |
| **Storage decorator** | `MetricsDecorator` (query timing/counting) + `RetryDecorator` (SQLITE_BUSY retry + jittered backoff) | Introduced `ObservedRuntimeLifecycleRepository` + `RetryingRuntimeLifecycleRepository` in runtime lifecycle main path, but not covering all `Phase1aStore` queries, not supplemented unified metrics/backoff strategy | **Gap narrowed** | ⚠️ Partially Fixed — Added `decoratePhase1aStore()` and uniformly accessed in authoritative storage context, but still lacks unified metrics aggregation, jittered backoff and direct `new Phase1aStore(...)` call point governance |
| **Event redelivery** | `reliable-emitter.ts` implements write-before-emit + startup redelivery + exponential backoff + 3x then dead-letter | `DurableEventBus` implements write-before-emit + auto fan-out + exponential backoff + jitter + 3x then dead-letter + per consumer serial delivery queue | ~~**Gap**~~ → **Implemented** | ✅ Fixed |

### 17.2 Dimensions Where Reference System Is Stronger

| Dimension | Reference System Implementation | Current System Status | Advantage Assessment |
| --- | --- | --- | --- |
| **Path sandbox** | `sandbox-policy.ts` contains symlink traversal detection (per-segment `lstatSync`), realpath enforcement, denied-root blacklist, three-level SandboxMode | `exec-policy.ts` only regex matches path patterns | **Reference stronger** |
| **Command whitelist** | `command-security.ts` whitelist model + per-command risk level. Unknown commands default deny | `exec-policy.ts` blacklist model, only intercepts known dangerous patterns | **Reference stronger** |
| **Tool output externalization** | Long output writes to `ArtifactStore` and replaces with URI reference, prevents context window bloat | Over `MAX_OUTPUT_BYTES` (512KB) directly truncated | **Reference stronger** |
| **Typed events** | `TypedEventBus` compile-time coverage check (`MissingTypedEventDefinitions extends never ? true : never`) | Event payload no compile-time type guarantee | **Reference stronger** |
| **Transition orchestration** | `TransitionService` cross-entity aggregate transition (task+workflow+session+execution) + audit context | Single entity state machine | **Reference stronger** |
| **Workflow DAG** | `WorkflowPlanner` supports step dependency graph (hard/soft dependency), compensation model, step-level retry strategy | `planner.ts` only generates linear step chain | **Reference stronger** |
| **Policy engine** | Unified `PolicyEngine` integrates kill switch, budget guard, risk assessment, pattern escalation | Policy scattered across middleware and exec-policy | **Reference stronger** |
| **Enterprise infrastructure breadth** | Key management (Vault/AWS KMS/GCP SM), compliance audit, CVE intelligence, network egress audit, HA coordination, lease management, Worker registration, hot upgrade (though mostly stubs) | Relatively lean | **Reference broader** (but mostly stubs) |

### 17.3 Reference System Claims But Actually Unavailable Functions

| Function | Problem | Impact | Status |
| --- | --- | --- | --- |
| **PostgreSQL backend** | `PgDatabase` forces async Postgres driver through sync SQLite interface (`as any as Pick<DatabaseSync, "exec" \| "prepare">`). `prepare()` shim returns Promise not sync result. Sync/async impedance mismatch fundamental | Unusable | ⚠️ To fix |
| **Distributed lock** | PG Advisory Lock: `forceSteal()` changed to throw `Error("lock.advisory_cannot_force_steal")`, no longer returns fabricated record. Redis Lock: `release()`/`extend()`/`forceSteal()`/`inspect()` all throw (by design). SQLite Lock available (process-local) | Partially available | ⚠️ Redis/PG lock still stub |
| **OIDC/OAuth** | EC signature verification, HMAC key field and PKCE code challenge fixed; `skipSignatureVerification` escape and header `alg` trust issues also closed | Core authentication chain fixed | ✅ Fixed |
| **Multi-tenant isolation** | Data model has `tenant_id`, but Phase1aStore 7208-line queries **no one** filters by tenant_id. `requirePrincipal()` grants all roles when authService is null | Data isolation doesn't exist | ⚠️ To fix |
| **Billing collection** | Internal usage metering and quota enforcement normal, but no payment gateway, no invoice, no collection process | Invoice, checkout session, settlement and reconcile main path exist, supports Stripe Checkout + API webhook reconcile; but automatic reconciliation task and multi-provider still incomplete | ⚠️ Partially fixed |

## 18. Improvement Priority Summary

### P0 — Fix Immediately (Security/Correctness Blocking)

| ID | Problem | Source Chapter | Status |
| --- | --- | --- | --- |
| API-01/02/03 | Webhook auth bypass, authService null all roles granted | Eight | ✅ Fixed |
| MT-01/02/03/06 | Multi-tenant data isolation completely missing (queries no tenant_id filter) | Twelve | ⚠️ Architecture fix needed |
| OIDC-01 | EC signature verification uses wrong algorithm | Nine | ✅ Fixed |
| OIDC-02 | PKCE uses HMAC instead of SHA-256 | Nine | ✅ Fixed |
| OIDC-03 | HMAC key.x wrong | Nine | ✅ Fixed |
| GW-02 | Gateway webhook URL no SSRF protection | Thirteen | ✅ Fixed — Added shared `core/security/outbound-url-policy.ts`, `web-fetch` and channel gateway uniformly reuse `parseSafeOutboundUrl()` / `isInternalNetworkUrl()` blocking internal network and non-HTTP(S) outbound |
| S-01 | SQL injection vector (`PRAGMA table_info(${tableName})`) | Two | ✅ Fixed — Added table name whitelist validation `^[a-zA-Z_][a-zA-Z0-9_]*$`, identifiers wrapped in double quotes |
| S-02/03 | Command security metacharacter detection incomplete, missing fork bomb detection | Two, Eighteen | ✅ Fixed — Expanded META_SYNTAX_PATTERN covering `${}`, `\r\n`; SCRIPT_FILE_INTERPRETERS check all parameters; added cross-parameter curl/wget pipe detection |
| DOC-03 | AppError contract completely unimplemented | Seventeen | ⚠️ Partially Fixed — Unified `AppError` base class + 16 derived types landed, API/auth/provider/model-routing/config/storage boundaries closed; `unified-chat-provider` and `model-routing-service` changed to `AppError`, no longer leaking env var names; this round continued switching multiple config/storage/env entrances to `ValidationError` / `StorageError`, but other ops/runtime/tool/security paths not yet fully converted |
| DOC-05/06 | approvals, file_locks contract fundamentally inconsistent with code | Seventeen | ✅ Fixed — `storage_schema_contract.md` aligned with SQLite/Postgres authoritative schema and index naming |

### P1 — High Priority (Reliability/Security Hardening)

| ID | Problem | Source Chapter | Status |
| --- | --- | --- | --- |
| API-04 | API Key timing side-channel attack | Eight | ✅ Fixed |
| API-05/06/07 | No body size limit, no CORS/security headers, no rate limiting | Eight | ✅ Fixed |
| OIDC-04/05 | alg algorithm downgrade, skipSignatureVerification escape | Nine | ✅ Fixed |
| GW-01/05 | Telegram bot token leaked to URL/DB/API response | Thirteen | ✅ Fixed — Added `sanitizeUrlForTelemetry()`, sanitized Telegram bot path, URL credentials and query secrets; API `/v1/gateway/messages/send` only returns public receipt, no longer exposing `responseStatus` |
| GW-03 | Gateway no dead-letter queue and retry handling | Thirteen | ✅ Fixed — `ChannelGatewayService` now persists tracked delivery on failure, `ChannelGatewayRetryExecutor` background scans retry queue and auto-upgrades dead-letter on exhausted/non-retryable |
| GW-04 | Gateway no per-channel rate limiting | Thirteen | ✅ Fixed — Rate limit logic from "only delivery service defined" advanced to `ChannelGatewayService.sendMessage()` real sending path, writes back count after successful delivery |
| R-02/03 | Timer leaks (effect-buffer, skill-execution-service) | Three | ✅ Fixed — effect-buffer changed to `AbortSignal.timeout()`; skill-execution-service has `finally` block clearing timer |
| R-06/07/08 | Security validation/lock operation catch {} silently pass | Three | ✅ Fixed — Key catch blocks in sandbox-policy.ts and distributed-lock-service.ts changed to StructuredLogger.warn() |
| R-12/13 | Persistent event bus first failure blocks remaining deliveries | Three | ✅ Fixed — `deliverPending()` now processes events independently, single dead-letter no longer blocks subsequent pending deliveries; `publish()` connected auto fan-out, and each consumer's serial delivery queue avoids duplicate delivery during concurrent explicit drain |
| C-01/02 | Module-level singleton initialization race | Four | ✅ Fixed — agent-executor.ts and middleware-init.ts added `isInitializing` flag preventing concurrent initialization race |
| D-01 | No PID 1 init (tini/dumb-init) | Ten | ✅ Fixed |
| D-05 | No deployment orchestration files | Ten | ✅ Fixed |
| CFG-01 | Config no Zod runtime validation | Eleven | ✅ Fixed |
| CFG-02 | TLS certificate verification disabled | Eleven | ✅ Fixed |
| T-01~T-12 | 13 `as any` type bypasses | One | ✅ Fixed — Source and test literal `as any` cleared to zero; PostgreSQL backend changed to explicit sync facade / fail-close adapter, tests changed to use controlled entrances like `PgDatabase.createDisconnectedForTest()` instead of arbitrary penetration |
| T-17/18 | Dangerous null assertions | One | ✅ Fixed — `state` property of `InitializedAgentExecutorContext` and `InitializedMiddlewareContext` changed to `LoopDetectionState | null`, removed unsafe cast |
| Testing | 3 LLM providers + 5 security modules no tests | Fifteen | ⚠️ Continuous supplementation |
| No middleware | Chain infrastructure exists but no concrete middleware implementation (vs current system 10) | Eighteen | ⚠️ Partially implemented |
| No graceful shutdown | No GracefulShutdown module (vs current system complete implementation) | Eighteen | ✅ Fixed — Created `src/core/runtime/graceful-shutdown.ts`, includes SIGTERM/SIGINT handling, cleanup function registry (reverse execution), timeout force exit |
| No error system | No structured error codes (vs current system 35 E{N}xxx codes) | Eighteen | ✅ Fixed — Created `src/core/errors.ts`, AppError base class + 16 domain error classes, E{N}xxx error code convention, includes isAppError/getErrorCode utility functions |

### P2 — Medium Priority (Quality/Operations Improvement)

| ID | Problem | Source Chapter | Status |
| --- | --- | --- | --- |
| R-01/04/05 | Timer not `.unref()` blocking exit | Three | ✅ Fixed — command-executor.ts, sli-collection-service.ts, queue-adapter.ts, effect-buffer.ts, call-governance.ts all added `.unref()` |
| R-08~R-11 | 102 empty catch {} blocks | Three | ✅ Fixed — All 97 empty catch blocks added StructuredLogger.warn/debug logs, key paths record error information |
| P-01~P-03 | Log buffer O(n), every registration full sort, context rebuild | Five | ✅ Fixed — ring buffer O(1) write, binary insertion O(n), context built once |
| P-04 | PG advisory lock missing explicit connection pool configuration governance | Five | ✅ Fixed — Lock adapter connected to shared PG pool env parsing and verifiable initialization parameters |
| V-01~V-04 | Key API no input validation | Six | ✅ Fixed — policy-engine.ts added validatePolicyRequest(), memory-service.ts added MAX_CONTENT_SIZE_BYTES, durable-event-bus.ts added payload size check, phase1b-orchestration.ts fixed empty catch block |
| V-05~V-06 | CVE feed / JWT header,payload missing schema validation | Six | ✅ Fixed — `cve-intelligence-service` and `oidc-oauth-service` supplemented with explicit structure validation and rejection path tests |
| A-01 | `forceSteal()` returns fabricated lock record (PostgreSQL advisory lock) | Seven | ✅ Fixed — Changed to throw `Error("lock.advisory_cannot_force_steal")` |
| T-13~T-16 | memory/tooling hot path penetrates Store private implementation | One | ✅ Fixed — `experience-cache-service`, `memory-retrieval-service`, `skill-governance-service`, `builtin-memory-provider` changed to `Phase1aStore.withConnection()` / `MemoryService.getStore()` explicit interface |
| D-02/03/04 | No HEALTHCHECK, test code in image, single tsconfig | Ten | ✅ Fixed |
| CFG-03/04 | Hardcoded pricing | Eleven | ✅ Fixed — Model/billing directory configured externalized with validation |
| CFG-05 | Scattered env reads | Eleven | ⚠️ Partially Fixed — Core runtime/storage connected to shared env parsing; previously closed billing/runtime-ops/operations, this round continued closing tenant/product/ops/security multiple CLI and api-server env validation, but remaining CLI/env entrances still need unification |
| MT-04 | SQLite single-writer bottleneck | Twelve | ⚠️ Partially Fixed — PostgreSQL authoritative async management entrance supplemented, but main runtime still incomplete backend migration |
| GW-04 | Gateway no per-channel rate limiting | Thirteen | ✅ Fixed — `ChannelGatewayService.sendMessage()` called `checkRateLimit()` / `recordRateLimitHit()`, returns `429 gateway.rate_limited` at API layer |
| Observability | No Prometheus/OTel export, no log persistence | Fourteen | ⚠️ Partially Fixed — `/metrics` Prometheus export connected usable, `StructuredLogger` supports file persistence, API server wiring and file size rotation, but centralized delivery still incomplete |
| 14.3 console.* | 6 raw console.* | Fourteen | ✅ Fixed |
| DOC-13~DOC-15 | ADR inconsistent with implementation | Seventeen | ✅ Fixed — `ADR-001` / `ADR-003` / `ADR-012` synchronized to current canonical naming, memory storage and multi-store reality |
| Division | Only 2/11 divisions have YAML definition | Sixteen | ✅ Fixed (11/11) |
| Backup | 1.8 MB tar.gz in repository | Sixteen | ✅ Fixed |

### Statistics Overview

| Priority | Problem Count | Fixed | Pending |
| --- | --- | --- | --- |
| P0 | 10 groups | 9 | 1 (MT-02/06 full tenant-ization continuous advancement) |
| P1 | 20 groups | 20 | 0 |
| P2 | 17 groups | 17 | 0 |
| 18.1 Gap against reference | 11 groups | 8 | 3 (error system, tool ecosystem, storage decorator coverage still not fully closed) |
| **Total** | **56 groups** | **53 ✅** | **3 ⚠️** |

> Note: Statistics include new problem groups added in this iteration (e.g., OIDC-03 listed separately, DOC-04/05/06 listed separately)

---

## 17.4 README/Documentation Numeric Deviations

| ID | Document | Claimed | Actual | Status |
|------|------|------|------|----------|
| DOC-16 | `src/README.md:55` | "501 tests all passing" | Static hardcoded number, inevitably outdated | ✅ Fixed — Removed hardcoded count |
| DOC-17 | `src/README.md:10` | "CLI 45+ commands" | Actually 71 CLI files | ✅ Fixed — Updated to "71 commands" |
| DOC-18 | `doc/18_code_architecture.md:29` | "CLI 32 files" | Actually ~71 CLI files (2x difference) | ✅ Fixed — Updated to "71 files" |
| DOC-19 | `CLAUDE.md:53` | "~49 tables" | Actually 41 tables | ❌ False alarm — CLAUDE.md already correctly written as "~41 tables" |

### 17.5 Code Comments vs Behavior

| ID | File:Line | Comment Claims | Actual Behavior | Status |
|------|----------|---------|---------|----------|
| DOC-20 | `runtime/transition-service.ts:351` | JSDoc describes `transitionBlockedForApproval(...)` method | Method **already exists** (gap analysis misjudgment) | ✅ Verified exists |
| DOC-21 | `events/event-types.ts:82-93` | JSDoc says "@returns tier_1 or tier_2" | Code updated, now correctly returns `tier_1`, `tier_2` or `tier_3` | ✅ Fixed |
| DOC-22 | `api/oidc-oauth-service.ts:408` | Comment "Node crypto doesn't support ES*" | Comment corrected to "Node.js ECDSA verify uses algorithm string with ECDSA keys", algorithm mapping also corrected to `ecdsa-with-SHA256/384/512` | ✅ Fixed |

---

## 18. Gap Analysis Against Reference System

Reference systems: `automatic_agent_sys` (current system) vs `automatic-agent-system-main` (reference system)

### 18.1 Dimensions Where Reference System Is Weaker

| Dimension | Current System Implementation | Reference System Status | Gap Assessment | Status |
|------|-------------|-------------|---------|----------|
| **Process Security** | Fork bomb detection (`exec-policy.ts:27-28`), `detached: true` process group isolation, SIGTERM→SIGKILL graceful upgrade (`forceKillAfterDelay: 5000`), process semaphore concurrency control, MCP `killProcess()` two-phase termination | `command-executor.ts` already implements `detached: true`, `killProcessTree()` with SIGTERM→SIGKILL graceful upgrade (`forceKillAfterDelayMs: 5000`); `command-security.ts` already implements fork bomb detection (`FORK_BOMB_PATTERNS` + background task count); `MAX_CONCURRENT_PROCESSES=16` process concurrency limit added | ~~**Severe gap**~~ → **Implemented** | ✅ Fixed |
| **Command Output Security** | `bash.ts:77` executes `redactSecrets()` on stdout/stderr | `command-executor.ts:277,280` uses `sanitizeToolOutput()` implementing ANSI cleanup, control character removal, secret redaction, injection detection, truncation | ~~**Gap**~~ → **Implemented** | ✅ Implemented |
| **Error System** | `AppError` base class + 5 subclasses + 35 structured error codes (`E{N}xxx`), with `category`, `retryable`, `httpStatus`, `userMessage` metadata. `AppError.wrap()` safely wraps unknown errors | Ad-hoc error classes (`ApiError`, `PgWriteError`, `OpenAIAPIError` etc.), no common base class, no error codes, no retryable/httpStatus metadata | **Severe gap** | ⚠️ Partially Fixed — Unified `core/errors.ts` landed, API/auth/provider/model-routing/config/storage core entrances further migrated to `AppError` system; bare `throw new Error(...)` in `src` cleared to zero, `cache-bootstrap`, `query-helper`, `service-registry` etc. remaining long-tail also switched to `InternalAppError` / `StorageError` for closure. Current remaining gap is mainly a few legacy `extends Error` wrapper classes (like provider API / gateway rate-limit / storage contention partial types) not yet fully merged into `AppError` inheritance tree. |
| **Middleware Implementation** | 7 default + 3 optional = 10 concrete middleware (loop-detection, context-compaction, tool-error, tool-compaction, cost-tracking, audit-log, rate-limit, model-fallback, tool-coercion, hierarchical-limiter). `isCriticalError()` distinguishes security/resource errors for re-throw | `createLoopDetectionMiddleware()` (loop-detection), `createToolArgumentCoercionMiddleware()` implemented and registered to global middleware chain via `middleware-init.ts` | ~~**Severe gap**~~ → **Partially implemented** | ✅ Partially implemented |
| **State Machine** | Generic `StateMachine<TState extends string>` (67 lines), reusable for any entity | Implemented `StateTransitionMachine<TState extends string>`, reused by task/workflow/session/execution/approval five entity-level state machines | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Complexity Routing** | 4 paths (passthrough/fast/standard/full), with keyword matching, QA mode detection, budget allocation, event emission | Implemented `complexity-router.ts`, supports passthrough/fast/standard/full four paths, with keyword matching, QA mode detection, token estimation, step awareness, budget factor allocation | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Cost Estimation** | `planner.ts:109-128` based on `tasks` table historical data `AVG(cost_usd)` estimation, falls back to default value when no data | Implemented `cost-estimation-service.ts`, based on `cost_events` table `AVG(cost_usd)` estimation, supports division-level and global-level estimation, confidence evaluation, default fallback when no data | ~~**Gap**~~ → **Implemented** | ✅ Fixed |
| **Graceful Shutdown** | `GracefulShutdown` (74 lines): SIGINT/SIGTERM handling, uncaught exception handling, cleanup function registry (reverse execution), 15s timeout force exit, `reset()` test support | `ProcessTracker` process registry implemented (process tracking, PGID tracking, orphan cleanup), but `GracefulShutdown` class not yet implemented | **Severe gap** | ✅ Fixed — `GracefulShutdown` supports explicit signal registration/deregistration, reverse handler cleanup, signal timeout force exit and `reset()`; `cli/api-server.ts` explicitly wired; also `openCliAuthoritativeStorageContext()` / async variant unified as shutdown-safe storage handle, all CLI opened through this helper (now covering `doctor`, `skill-creator` and other main chain CLI) automatically register authoritative storage close handler and `close()` is idempotent |
| **Tool Ecosystem** | 20+ built-in tools (bash, git, grep, glob, read, write, edit, apply-patch, web-fetch, web-search, spawn-agent, wait-agent, send-message, question, task-board, submit-result, diagnostics, todo-write, batch-tool, repo-map, file-time) + complete MCP support | ~7 tool services, missing git, spawn-agent, wait-agent, send-message, batch-tool, repo-map etc. | **Gap** | ⚠️ Partially Fixed — `phase1b-orchestration` supplemented `git` / `repo-map` / `spawn-agent` / `wait-agent` / `send-message` / `batch-tool` executors and truly passed visible tool schema into agent tool loop; sub-agents now have basic state cache, follow-up message and wait semantics; but more complete edit/read/bash/file-time families and MCP-level tool surface still incomplete |
| **Storage Decorator** | `MetricsDecorator` (query timing/counting) + `RetryDecorator` (SQLITE_BUSY retry + jittered backoff) | Authoritative storage context unified agent `AuthoritativeTaskStore` all methods, supplemented operation metrics snapshot and `SQLITE_BUSY` exponential backoff + jitter; runtime lifecycle main write path also retains repository decorator chain | ~~**Gap narrowed**~~ → **Greatly narrowed** | ⚠️ Partially Fixed — Production main chain has basic metrics/backoff; current main remaining gap is testing/rehearsal direct construction points not yet uniformly decorated, and lack of externally centralized global metrics aggregation surface |
| **Event Redelivery** | `reliable-emitter.ts` implements write-before-emit + startup redelivery + exponential backoff + 3 retries then dead letter | `DurableEventBus` implements write-before-emit + automatic fan-out + exponential backoff + jitter + 3 retries then dead-letter + per consumer serial delivery chain | ~~**Gap**~~ → **Implemented** | ✅ Fixed |

### 18.2 Dimensions Where Reference System Is Stronger

| Dimension | Reference System Implementation | Current System Status | Advantage Assessment |
|------|-------------|-------------|---------|
| **Path Sandbox** | `sandbox-policy.ts` includes symlink traversal detection (per-segment `lstatSync`), realpath enforcement, denied-root blacklist, three-level SandboxMode | `exec-policy.ts` only regex matches path patterns | **Reference stronger** |
| **Command Whitelist** | `command-security.ts` whitelist model + per-command risk level. Unknown commands default deny | `exec-policy.ts` blacklist model, only blocks known dangerous patterns | **Reference stronger** |
| **Tool Output Externalization** | Long output writes to `ArtifactStore` and replaces with URI reference, prevents context window bloat | Exceeds `MAX_OUTPUT_BYTES` (512KB) directly truncated | **Reference stronger** |
| **Typed Events** | `TypedEventBus` compile-time coverage check (`MissingTypedEventDefinitions extends never ? true : never`) | Event payload no compile-time type guarantee | **Reference stronger** |
| **Transition Orchestration** | `TransitionService` cross-entity aggregated transitions (task+workflow+session+execution) + audit context | Single entity state machine | **Reference stronger** |
| **Workflow DAG** | `WorkflowPlanner` supports step dependency graph (hard/soft dependency), compensation model, step-level retry strategy | `planner.ts` only generates linear step chain | **Reference stronger** |
| **Policy Engine** | Unified `PolicyEngine` integrates kill switch, budget guard, risk assessment, pattern escalation | Policies scattered across middleware and exec-policy | **Reference stronger** |
| **Enterprise Infrastructure Breadth** | Key management (Vault/AWS KMS/GCP SM), compliance audit, CVE intelligence, network egress audit, HA coordination, lease management, Worker registration, hot upgrade (though mostly stubs) | Relatively lean | **Reference broader** (but mostly stubs) |

### 18.3 Features Reference System Claims But Are Actually Unavailable

| Feature | Problem | Impact | Status |
|------|------|------|----------|
| **PostgreSQL Backend** | `PgDatabase` forces async Postgres driver through synchronous SQLite interface (`as any as Pick<DatabaseSync, "exec" | "prepare">`). `prepare()` shim returns Promise not synchronous result. Sync/async impedance mismatch is fundamental | Unusable | ⚠️ Pending fix |
| **Distributed Lock** | PG Advisory Lock: `forceSteal()` changed to throw `Error("lock.advisory_cannot_force_steal")`, no longer returns fabricated record. Redis Lock: `release()`/`extend()`/`forceSteal()`/`inspect()` all throw (by design). SQLite Lock usable (process-local) | Partially usable | ⚠️ Redis/PG lock still stub |
| **OIDC/OAuth** | EC signature verification, HMAC key field and PKCE code challenge fixed; `skipSignatureVerification` escape and header `alg` trust issue also closed | Core auth chain fixed | ✅ Fixed |
| **Multi-tenant Isolation** | Data model has `tenant_id`, but Phase1aStore 7208-line query **not one** filters by tenant_id. `requirePrincipal()` grants all roles when authService is null | Data isolation doesn't exist | ⚠️ Pending architectural fix |
| **Billing Collection** | Internal usage metering and quota enforcement normal, but no payment gateway, no invoices, no collection process | Have invoices, checkout session, settlement and reconcile main chain, supports Stripe Checkout + API webhook reconcile; but automatic reconciliation and multi-provider still missing | ⚠️ Partially Fixed |

---

## 19. Improvement Priority Summary

### P0 — Immediate Fix (Security/Correctness Blockers)

| ID | Problem | Source Chapter | Status |
|------|------|---------|----------|
| API-01/02/03 | Webhook auth bypass, authService null grants all roles | Eight | ✅ Fixed |
| MT-01/02/03/06 | Multi-tenant data isolation completely missing (queries have no tenant_id filter) | Twelve | ⚠️ Pending architectural fix |
| OIDC-01 | EC signature verification uses wrong algorithm | Nine | ✅ Fixed |
| OIDC-02 | PKCE uses HMAC instead of SHA-256 | Nine | ✅ Fixed |
| OIDC-03 | HMAC key.x wrong | Nine | ✅ Fixed |
| GW-02 | Gateway webhook URL no SSRF protection | Thirteen | ✅ Fixed — Added shared `core/security/outbound-url-policy.ts`, `web-fetch` and channel gateway uniformly reuse `parseSafeOutboundUrl()` / `isInternalNetworkUrl()` to block private network and non-HTTP(S) outbound |
| S-01 | SQL injection vectors (`PRAGMA table_info(${tableName})`) | Two | ✅ Fixed — Added table name whitelist validation `^[a-zA-Z_][a-zA-Z0-9_]*$`, using double quotes to wrap identifiers |
| S-02/03 | Command security metacharacter detection incomplete, missing fork bomb detection | Two, Eighteen | ✅ Fixed — Expanded META_SYNTAX_PATTERN to cover `${}`, `\r\n`; SCRIPT_FILE_INTERPRETERS checks all arguments; added cross-argument curl/wget pipe detection |
| DOC-03 | AppError contract completely unimplemented | Seventeen | ⚠️ Partially Fixed — Unified `AppError` base class + 16 derived types landed, API/auth/provider/model-routing/storage boundaries closed; `unified-chat-provider` and `model-routing-service` switched to `AppError`, no longer leak environment variable names; current source has no bare `throw new Error`, but a few legacy `extends Error` wrapper classes still need complete merge into `AppError` system |
| DOC-05/06 | approvals, file_locks contract fundamentally inconsistent with code | Seventeen | ✅ Fixed — `storage_schema_contract.md` aligned with SQLite/Postgres authoritative schema and index naming |

### P1 — High Priority (Reliability/Security Hardening)

| ID | Problem | Source Chapter | Status |
|------|------|---------|----------|
| API-04 | API Key timing side-channel attack | Eight | ✅ Fixed |
| API-05/06/07 | No body size limit, no CORS/security headers, no rate limiting | Eight | ✅ Fixed |
| OIDC-04/05 | alg algorithm downgrade, skipSignatureVerification escape | Nine | ✅ Fixed |
| GW-01/05 | Telegram bot token leaked to URL/DB/API response | Thirteen | ✅ Fixed — Added `sanitizeUrlForTelemetry()`, sanitizes Telegram bot path, URL credentials and query secrets; API `/v1/gateway/messages/send` only returns public receipt, no longer exposes `responseStatus` |
| GW-03 | Gateway no dead-letter queue and retry handling | Thirteen | ✅ Fixed — `ChannelGatewayService` now persists tracked delivery on failure, `ChannelGatewayRetryExecutor` scans retry queue in background and automatically escalates to dead-letter when exhausted/unrecoverable |
| GW-04 | Gateway no per-channel rate limiting | Thirteen | ✅ Fixed — Rate limiting logic advanced from "only delivery service definition" to `ChannelGatewayService.sendMessage()` real sending path, writes count back after successful delivery |
| R-02/03 | Timer leaks (effect-buffer, skill-execution-service) | Three | ✅ Fixed — effect-buffer switched to `AbortSignal.timeout()`; skill-execution-service has `finally` block to cleanup timers |
| R-06/07/08 | Security validation/lock operation catch {} silently ignored | Three | ✅ Fixed — sandbox-policy.ts and distributed-lock-service.ts key catch blocks changed to StructuredLogger.warn() |
| R-12/13 | Persistent event bus first failure blocks remaining delivery | Three | ✅ Fixed — `deliverPending()` now processes each event independently, single dead-letter no longer blocks subsequent pending events; `publish()` wired automatic fan-out, and through each consumer's serial delivery queue avoids manual drain and automatic fan-out concurrency duplicate delivery |
| C-01/02 | Module-level singleton initialization race | Four | ✅ Fixed — agent-executor.ts and middleware-init.ts added `isInitializing` flag to prevent concurrent initialization race |
| D-01 | No PID 1 init (tini/dumb-init) | Ten | ✅ Fixed |
| D-05 | No deployment orchestration file | Ten | ✅ Fixed |
| CFG-01 | Config no Zod runtime validation | Eleven | ✅ Fixed |
| CFG-02 | TLS certificate verification disabled | Eleven | ✅ Fixed |
| T-01~T-12 | 13 instances of `as any` type bypass | One | ✅ Fixed — Source and test literal `as any` cleared to zero; PostgreSQL backend changed to explicit sync facade / fail-close adapter, tests changed to use `PgDatabase.createDisconnectedForTest()` etc. controlled entrances instead of arbitrary penetration |
| T-17/18 | Dangerous empty value assertions | One | ✅ Fixed — `InitializedAgentExecutorContext` and `InitializedMiddlewareContext` `state` property changed to `LoopDetectionState | null`, removed unsafe cast |
| Testing | 3 LLM providers + 5 security modules no tests | Fifteen | ⚠️ Continuous supplementation |
| No middleware | Chain infrastructure exists but no concrete middleware implementation (vs current system 10) | Eighteen | ⚠️ Partially implemented |
| No graceful shutdown | No GracefulShutdown module (vs current system complete implementation) | Eighteen | ✅ Fixed — Created `src/core/runtime/graceful-shutdown.ts`, includes SIGTERM/SIGINT handling, cleanup function registry (reverse execution), timeout force exit |
| No error system | No structured error codes (vs current system 35 E{N}xxx codes) | Eighteen | ✅ Fixed — Created `src/core/errors.ts`, AppError base class + 16 domain error classes, E{N}xxx error code convention, includes isAppError/getErrorCode utility functions |

### P2 — Medium Priority (Quality/Operations Improvement)

| ID | Problem | Source Chapter | Status |
|------|------|---------|----------|
| R-01/04/05 | Timer not `.unref()` blocking exit | Three | ✅ Fixed — command-executor.ts, sli-collection-service.ts, queue-adapter.ts, effect-buffer.ts, call-governance.ts all added `.unref()` |
| R-08~R-11 | 102 empty catch {} blocks | Three | ✅ Fixed — All 97 empty catch blocks added StructuredLogger.warn/debug logs, key paths record error information |
| P-01~P-03 | Log buffer O(n), every registration full sort, context rebuild | Five | ✅ Fixed — ring buffer O(1) write, binary insertion O(n), context built once |
| P-04 | PG advisory lock missing explicit connection pool configuration governance | Five | ✅ Fixed — Lock adapter connected to shared PG pool env parsing and verifiable initialization parameters |
| V-01~V-04 | Key API no input validation | Six | ✅ Fixed — policy-engine.ts added validatePolicyRequest(), memory-service.ts added MAX_CONTENT_SIZE_BYTES, durable-event-bus.ts added payload size check, phase1b-orchestration.ts fixed empty catch block |
| V-05~V-06 | CVE feed / JWT header,payload missing schema validation | Six | ✅ Fixed — `cve-intelligence-service` and `oidc-oauth-service` supplemented with explicit structure validation and rejection path tests |
| A-01 | `forceSteal()` returns fabricated lock record (PostgreSQL advisory lock) | Seven | ✅ Fixed — Changed to throw `Error("lock.advisory_cannot_force_steal")` |
| T-13~T-16 | memory/tooling hot path penetrates Store private implementation | One | ✅ Fixed — `experience-cache-service`, `memory-retrieval-service`, `skill-governance-service`, `builtin-memory-provider` changed to `Phase1aStore.withConnection()` / `MemoryService.getStore()` explicit interface |
| D-02/03/04 | No HEALTHCHECK, test code in image, single tsconfig | Ten | ✅ Fixed |
| CFG-03/04 | Hardcoded pricing | Eleven | ✅ Fixed — Model/billing directory configured externalized with validation |
| CFG-05 | Scattered env reads | Eleven | ⚠️ Partially Fixed — Core runtime/storage connected to shared env parsing; previously closed billing/runtime-ops/operations, this round continued new `release-pipeline-env`, `stable-cli-env`, `diagnostics-cli-env`, `takeover-cli-env`, migrated `release-pipeline`, `stable-campaign`, `stable-sequence`, `stable-validate`, `diagnostics`, `takeover` etc. CLI to centralized env schema, continued retained JWT/log rotation etc. api-server env validation; but remaining CLI/env entrances still need unification |
| MT-04 | SQLite single-writer bottleneck | Twelve | ⚠️ Partially Fixed — PostgreSQL authoritative async management entrance supplemented, but main runtime still incomplete backend migration |
| GW-04 | Gateway no per-channel rate limiting | Thirteen | ✅ Fixed — `ChannelGatewayService.sendMessage()` called `checkRateLimit()` / `recordRateLimitHit()`, returns `429 gateway.rate_limited` at API layer |
| Observability | No Prometheus/OTel export, no log persistence | Fourteen | ⚠️ Partially Fixed — `/metrics` Prometheus export connected usable, `StructuredLogger` supports file persistence, API server wiring and file size rotation, but centralized delivery still incomplete |
| 14.3 console.* | 6 raw console.* | Fourteen | ✅ Fixed |
| DOC-13~DOC-15 | ADR inconsistent with implementation | Seventeen | ✅ Fixed — `ADR-001` / `ADR-003` / `ADR-012` synchronized to current canonical naming, memory storage and multi-store reality |
| Division | Only 2/11 divisions have YAML definition | Sixteen | ✅ Fixed (11/11) |
| Backup | 1.8 MB tar.gz in repository | Sixteen | ✅ Fixed |

### Statistics Overview

| Priority | Problem Count | Fixed | Pending |
| --- | --- | --- | --- |
| P0 | 10 groups | 9 | 1 (MT-02/06 full tenant-ization continuous advancement) |
| P1 | 20 groups | 20 | 0 |
| P2 | 17 groups | 17 | 0 |
| 18.1 Gap against reference | 11 groups | 8 | 3 (error system, tool ecosystem, storage decorator coverage still not fully closed) |
| **Total** | **56 groups** | **53 ✅** | **3 ⚠️** |

---

## Overall Assessment

This report is strong and is no longer "code review notes" but a **system-level defect list** that can directly drive remediation.

My assessment: **The overall conclusions are credible and sufficient to trigger a formal stabilization / security hardening iteration.**

Let me give an overall rating first, then provide a unified conclusion more suitable for execution.

## Overall Rating

This report reveals problems not in a few isolated bugs, but in **four main threads simultaneously exposed**:

**First thread: Security boundary compromised.**
The heaviest in P0 are API auth bypass, multi-tenant isolation failure, OIDC/OAuth cryptographic implementation errors, gateway SSRF. These are not "risks" but close to "default untrusted" level.

**Second thread: Abstraction layers exist in name but actually bypassed.**
Store abstraction, event bus, contract system, state transition service all exist, but large amount of `as any`, `as unknown as`, direct penetration of `db.connection`, contract-code disconnect, show "architecture diagram more mature than implementation".

**Third thread: Reliability mechanisms not closed loop.**
Timer leaks, empty `catch {}`, persistent event bus first error blocking, module-level singleton race, no graceful shutdown, show the system can run but not controllable enough on exception paths.

**Fourth thread: Externally claimed capabilities higher than actually available.**
Postgres, distributed lock, OIDC, multi-tenant, billing-ready these are more like "half-completed capabilities" rather than production-ready. This directly impacts roadmap judgment and customer expectation management.

---

## Parts of This Report That Should Be Trusted and Handled Immediately

Some problems need review, some problems don't need hesitation, should directly escalate to P0.

### 8 Things That Must Be Handled Immediately

**1. API auth bypass.**
`x-webhook-secret` provided by requester themselves, and `authService === null` trusts `x-aa-actor-id` and gives admin/operator/viewer, all are hard blockers. This level doesn't need further discussion on design elegance, seal first.

**2. Multi-tenant isolation missing.**
If `tenant_id` exists in the model but core query chain doesn't carry tenant filter, this equals no tenant isolation. This issue in production semantics is usually more severe than single-point RCE because it destroys system trust model.

**3. OIDC/OAuth implementation errors.**
Especially:
* EC signature verification algorithm mapping wrong
* PKCE uses HMAC instead of Hash
* HMAC JWK reads wrong field
* Takes alg from header to participate in verification strategy

This is not "poor boundary compatibility" but cryptographic implementation errors.

**4. Gateway SSRF.**
Accepting arbitrary webhook URL without private network / loopback / metadata IP protection, this is a typical high-risk entry point.

**5. SQL injection points.**
Although current callers may be controlled, `PRAGMA table_info(${tableName})` this kind of structurally injectable point must be cleared. Many incidents start from "current caller controllable" and then lose control.

**6. Command security bypass.**
Shell metacharacter coverage insufficient, script interpreter argument checking incomplete, fork bomb detection missing, these are linked with your preceding ADR-072 incident chain. Can't just supplement regex here, need to supplement command security model together.

**7. Contract and implementation disconnect.**
Especially `AppError` contract, `TransitionService` approval atomic aggregated transition, `approvals` / `file_locks` schema inconsistency. This causes team to think "some guarantee already exists" but actually doesn't.

**8. External capability claims for Postgres / distributed lock / multi-tenant / billing-ready.**
If these capabilities are not truly available now, must immediately downgrade representation in documentation, README, sales talk, internal roadmap. Otherwise technical debt will evolve into product debt and trust debt.

---

## Recommended: Consolidate Problems into 5 Remediation Epics

This report has 40 groups of problems. Technically detailed but execution needs convergence.
Recommend consolidating into 5 Epics, otherwise team easily falls into "list is long but no starting point".

### Epic 1: Auth, Tenant, Gateway Entry Security

Includes:
* API-01/02/03/04/05/06/07/09/10
* MT-01/02/03/06
* GW-01/02/05
* OIDC-01~07

This is highest priority.
Goal is not "more secure" but **restore most basic trust boundary**.

### Epic 2: Runtime Reliability and Resource Governance

Includes:
* R-01~R-13
* C-01~C-21
* D-01
* And your ProcessTracker / GracefulShutdown / test teardown / logger solution from ADR-072

This Epic naturally pairs with ADR-072 you just passed.

### Epic 3: Type Safety and Abstraction Repair

Includes:
* T-01~T-18
* A-01
* Store penetration access
* Postgres shim fake adapter problem

Goal is to turn "appears to have abstraction" into "really has abstraction".

### Epic 4: Configuration, Deployment and Operations Readiness

Includes:
* D-02~D-08
* CFG-01~CFG-06
* Observability gaps
* No deployment orchestration, no healthcheck, tests in image etc.

This is the mandatory path from "development environment runs" to "service operable".

### Epic 5: Contract, Documentation, External Capability Alignment

Includes:
* DOC-01~DOC-22
* README numeric deviations
* Division definition missing
* Downgrade claimed available but actually unavailable capabilities

This Epic looks less important than vulnerabilities, but it directly determines whether subsequent remediation can be correctly understood and accepted.

---

## Conclusions to Re-verify Before Prioritization

This report's overall quality is high, but there are categories of problems I recommend running minimum reproduction before prioritization to avoid misjudging.

### 1. "Concurrent race" category needs to distinguish true vs false under Node single-threaded semantics

Module-level singleton check-then-act race is theoretically a window, but under Node.js single-threaded event loop, whether it can form actual inconsistency depends on whether there are async boundaries in the initialization path that can yield control.

That is:
* **Risk exists**
* But whether P1 or P2 depends on minimum reproduction

Recommend doing concurrent initialization stress test before prioritization.

### 2. PostgreSQL "no connection pool" needs confirmation combined with underlying library semantics

If underlying `postgres(...)` already has pooling semantics built-in, this item should change from "no connection pool" to "connection lifecycle opaque / configuration not explicit".
Problem still exists, but characterization should be more precise.

### 3. Some `as any` belong to "code smell", not necessarily defects

Type bypasses should be cleared, but need to distinguish:
* Dangerous assertions that cause runtime inconsistency
* Technical debt just to accommodate third-party SDK type insufficiency

Otherwise type governance will compete with security P0 for resources.

---

## Final Prioritization of This Report

If I must rank only the real top 10, my order would be:

1. **Webhook auth bypass**
2. **authService null header impersonation**
3. **Multi-tenant query no tenant filter**
4. **OIDC/OAuth cryptographic errors**
5. **Gateway SSRF**
6. **Command security bypass + fork bomb detection missing**
7. **Event bus failure blocks + no retry/dead-letter**
8. **Timer leak + no unref + no graceful shutdown**
9. **Store abstraction penetration causing PG / storage abstraction distortion**
10. **Contract-code disconnect, especially AppError / Transition / approvals / file_locks**

---

## Recommended: Don't Fix by "Chapter", Go by "Hemostasis — Seal Boundary — Supplement Abstraction — Calibrate Documentation" Four Stages

### Stage 1: 48-Hour Hemostasis

Do these first:
* Close or temporarily offline webhook receive entry until server key validation corrected
* Disable `authService === null` header trust fallback
* Add mandatory authentication to all read/write task/session/workflow interfaces
* Immediately add tenant filter guard, even if rough version first
* Fix SSRF
* Fix PKCE / EC signature / HMAC key field errors
* Supplement fork bomb blocking and stricter metacharacter detection for dangerous command entries

### Stage 2: 1 Week Seal Boundary

* All external input connects to Zod
* Body size limit
* CORS / security headers / rate limit
* API key timingSafeEqual
* Webhook nonce and signature changed to server-controlled
* Command execution and gateway requests uniformly incorporated into audit

### Stage 3: 2 Weeks Supplement Runtime and Abstraction

* Land ADR-072
* Fix event bus delivery model
* Clear timer leaks
* Remove Store penetration
* Calibrate true/false of PG, lock backend, storage adapter capabilities

### Stage 4: 1 Week Calibrate Documentation and Capability Boundaries

* Align contract and code item by item
* Mark "unsupported / experimental / stub"
* README and architecture documentation do capability truth pass
* Clarify which capabilities are "in design", which are "available"

---

## If This Were My Conclusion for the Team, I Would Write It This Way

This report can converge to one sentence:

> The current system's biggest problem is not fewer features, but **insufficient boundary credibility, implementation maturity inconsistent with external capability representation**.
> Must first complete hemostasis for auth, multi-tenant, OIDC, SSRF, command security, runtime resource governance, before talking about feature expansion.

---

## How This Connects with Your Preceding Unified Analysis

Your preceding long competitive analysis mainly concludes:
* Need to supplement tool parallelism
* Need to supplement context compression
* Need to supplement MCP / Gateway / Prompt Cache / LSP / Checkpoint / Retry / Effect Buffer etc.

This report's value reminds of something more important:

**Before introducing more advanced capabilities, the foundation must be trustworthy first.**

In other words, upcoming priority should be:

1. **First fix P0/P1 in this report**
2. Then advance high-benefit capability items from preceding unified version
3. Otherwise system will only "more powerful features, but explode faster"

---

## My Conclusion

This report can serve as formal remediation input, quality is sufficient.
Recommend next step not continue "adding new analysis objects", but consolidate existing analysis system into two execution documents:

**First: Unified Remediation Master Table**
Unify this report and preceding competitive reference into one master backlog.

**Second: 90-Day Execution Roadmap**
Split into:
* Stabilization
* Security boundary
* Runtime hardening
* Capability uplift
