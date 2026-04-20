# main System Comprehensive Improvement Plan

Date: 2026-04-12
Scope: doc/, src/, configuration, infrastructure, CI/CD, testing
Method: File-by-file review + automated scanning + comparative analysis

---

## Execution Status (2026-04-12)

Topics continued and verified from this document in the current cycle:

- `I-07`: `build / build:test` separated, production build no longer includes `dist/tests` by default
- `I-16 / I-61`: provider/payment/gateway default URLs and shared provider helper centralized
- `I-18`: `stable-runner-factory` adopted by stable CLI main chain
- `I-66`: CLI `process.env` direct reads centralized to `src/core/config/` loaders; currently `src/cli` entry files completed, only `stable-runner-factory.ts` remains as helper with env fallback
- `I-43 / I-46 / I-47 / I-50`: documentation absolute paths, research analysis index, ADR index, README navigation centralized
- `I-60`: `safeLoadDivisionRegistry()` centralized to single implementation
- `I-67`: single-file `core/` directory supplemented with second entry file (barrel)
- `I-69`: `DurableEventBus.dispose()` and corresponding tests implemented
- `I-58 / I-59`: timing safety comparison and HTTP body limit生效 in main implementation
- `I-75`: 6 POST routes centralized to unified Zod runtime schema validation
- `I-76`: `withCliStorage()` / `withCliStorageAsync()` / `withPersistentCliStorage()` implemented, CLI storage startup样板 unified; `api-server` / `doctor` / `enterprise-governance` / `ops-program` / `authoritative-storage-admin` long-lifecycle or management entry points also migrated to unified baseline
- `I-77`: `tools/` value imports to `runtime/` cross-layer dependencies cleared, only `import type` remains
- `I-78`: SQLite / PostgreSQL migration definition supplemented with `downSql/downDdl` rollback metadata placeholder, new migration rollback metadata regression
- `I-74`: event bus Tier 1 / worker / dispatch / decision main events supplemented with explicit payload types, `GenericEventPayload` no longer default entry for main execution chain
- `I-79`: `src/core/stability/`已成为稳定性工具 canonical namespace，源码与测试 import 已统一迁移，旧 `testing` 路径已退出主使用面
- `reference_cache_orchestration_skeleton / reference_agent_team / reference_weaker_llm_agent / reference_agent_evolution / reference_memory_manage`: completed absorption review and landed on cache orchestration, agent team, validation-repair loop, memory plane implementations

Topics requiring continued推进 but no longer属于"must complete in one day"长期项:

- `I-20 / I-21 / I-22 / I-23` giant file and God-class deep splitting

Therefore, this document now serves as both improvement plan and "remaining long-term program"清单; short-term completed items should be understood by combining code and execution documentation, should not treat all items as unstarted per initial draft.

---

## Table of Contents

- [一、Code Quality Issues](#一code-quality-issues)
- [一B、Source Code Architecture Issues](#一bsource-code-architecture-issues)
- [二、Infrastructure and Configuration Issues](#二infrastructure-and-configuration-issues)
- [三、Documentation Issues](#三documentation-issues)
- [三B、Project Standards Deficiencies](#三bproject-standards-deficiencies)
- [四、Testing Gaps](#四testing-gaps)
- [四B、Documentation Architecture Issues](#四bdocumentation-architecture-issues)
- [五、Executable Improvement Roadmap](#五executable-improvement-roadmap)
- [六、Quantitative Summary](#六quantitative-summary)
- [七、Relationship with Previous Improvement Report](#七relationship-with-previous-improvement-report)

---

## 一、Code Quality Issues

### 1.1 CRITICAL: God-class `Phase1aStore` (8,798 lines / 258 methods)

- **File**: `src/core/storage/sqlite/phase1a-store.ts`
- **Problem**: Single class carries all data access logic, contains 258 public methods, covering task, execution, session, workflow, billing, security, marketplace, events, locks, Worker etc. all domains. 104 instances of `as unknown as T` type bypasses集中在此文件。
- **Impact**: Any domain data access modification requires changing this giant file, high conflict probability, difficult to test.
- **Fix**:
  1. Create domain repository classes: `TaskRepository`, `ExecutionRepository`, `SessionRepository`, `BillingRepository`, `SecurityRepository`, `MarketplaceRepository`, `EventRepository`, `WorkerRepository`
  2. `Phase1aStore`降级为 Facade，内部委托给各仓储
  3. Each repository class independently tested
  4. Create type-safe query helper function `queryAll<T>(stmt, ...params): T[]`，集中处理 `as unknown as` 类型转换，最好配合 Zod 运行时校验
- **Work estimate**: 3-5 days
- **Acceptance**: Phase1aStore split into ≥5 repository classes, each ≤500 lines; `as unknown as` centralized to 1 helper function

### 1.2 CRITICAL: Giant File Cluster (89 files exceed 500 lines, 17 exceed 1000 lines)

Top 10 oversized files:

| Lines | File | Suggestion |
|------|------|------|
| 8,798 | `storage/sqlite/phase1a-store.ts` | See 1.1 |
| 2,380 | `runtime/phase1b-orchestration.ts` | Split into orchestrator/dispatcher/planner/supervisor four modules |
| 1,764 | `types/domain.ts` | Split by domain into task-types/workflow-types/session-types/execution-types etc. |
| 1,689 | `tools/edit-replacement-service.ts` | Extract diff/match/apply as independent modules |
| 1,639 | `tools/skill-execution-service.ts` | Extract skill-resolver/skill-runner |
| 1,388 | `storage/sqlite/sqlite-migration-plan.ts` | Can split migration files by version |
| 1,344 | `api/http-api-server.ts` | Split routes by resource (task-routes/session-routes/event-routes) |
| 1,292 | `divisions/division-loader.ts` | Extract YAML parsing/validation/registration logic |
| 1,232 | `runtime/execution-dispatch-service.ts` | Extract ticket-evaluator/capacity-calculator |
| 1,228 | `tools/patch-dsl-service.ts` | Extract parser/validator/applier |

- **Fix**: Each file split into ≤500 line modules, extract common logic
- **Work estimate**: 1-2 days per file
- **Priority**: phase1b-orchestration and domain.ts most urgent

### 1.3 MAJOR: 13 Error Classes Never Used (46% dead code)

- **File**: `src/core/errors.ts` lines 268-609
- **Problem**: The following error classes defined but never instantiated or referenced:

| Dead Code Class | Line |
|----------|------|
| `BudgetExceededError` | — |
| `RuntimeTimeoutError` | — |
| `AuthenticationError` | — |
| `AuthorizationError` | — |
| `ConfigurationError` | — |
| `DatabaseError` | — |
| `WorkflowError` | — |
| `GatewayError` | — |
| `NetworkError` | — |
| `OperationsError` | — |
| `SecurityError` | — |
| `TaskError` | — |
| `StepError` | 604-609 |

`StepError` (lines 604-609) marked as "Legacy step error", has no `new StepError`, `import.*StepError`, `instanceof StepError` references throughout project.

- **Fix**: Delete unused error classes. Keep active classes like `ValidationError`, `PolicyDeniedError`, `ProviderError`, `ToolExecutionError`, `SandboxError`, `StorageError`, `LockingError`, `MonetizationError`.
- **Work estimate**: 0.5 day
- **Acceptance**: All exported classes in errors.ts have at least one usage

### 1.4 MAJOR: 6 Circular Dependencies

Found 6 pairs of direct circular imports + 1 three-node cycle:

| File A | File B |
|--------|--------|
| `tools/tool-argument-coercion.ts` | `tools/question-tool.ts` |
| `tools/tool-argument-coercion.ts` | `tools/todo-write-tool.ts` |
| `tools/tool-argument-coercion.ts` | `tools/edit-replacement-service.ts` |
| `tools/tool-call-result.ts` | `tools/tool-metadata.ts` |
| `workflow/minimal-workflow.ts` | `divisions/division-loader.ts` |
| `security/vault-http-secret-provider.ts` | `security/secret-management-service.ts` |

Three-node cycle: `minimal-workflow.ts` → `division-loader.ts` → `workflow-validator.ts` → `minimal-workflow.ts`

- **Fix**:
  1. `tools/`: Extract shared types to `tool-types.ts`, break tool circular dependencies
  2. `workflow/divisions/`: Extract shared interfaces to `workflow-types.ts`
  3. `security/`: Extract provider interface to `secret-provider-interface.ts`
- **Work estimate**: 1 day
- **Acceptance**: `madge --circular src/` outputs empty

### 1.5 MAJOR: 6 console calls in Core Runtime Code

| File | Line | Call |
|------|------|------|
| `runtime/effect-buffer.ts` | 544 | `console.debug(...)` |
| `runtime/phase1a-happy-path.ts` | 218 | `console.warn(...)` |
| `runtime/phase1b-orchestration.ts` | 1072 | `console.warn(...)` |
| `runtime/model-call-provider.ts` | 217 | `console.error(...)` |
| `runtime/loop-detection.ts` | 347 | `console.warn(...)` |
| `runtime/agent-middleware-chain.ts` | 456 | `console.warn(...)` |

- **Fix**: Replace all with `StructuredLogger` (`src/core/observability/structured-logger.ts`)
- **Work estimate**: 0.5 day
- **Acceptance**: `grep -r "console\." src/core/runtime/ src/core/events/` only appears in CLI entry files

### 1.6 MAJOR: 8 Hardcoded API URLs

| File | URL |
|------|-----|
| `providers/anthropic/anthropic-chat-service.ts` | `https://api.anthropic.com` |
| `providers/openai/openai-chat-service.ts` | `https://api.openai.com` |
| `providers/minimax/minimax-chat-service.ts` | `https://api.minimaxi.chat` / `https://api.minimax.io` |
| `product/billing-payment-gateway.ts` | `https://api.stripe.com/v1` / `https://api.paddle.com` |
| `gateway/channel-gateway-service.ts` | `https://api.telegram.org` / `https://slack.com/api` |

- **Fix**: Extract to `src/core/config/provider-defaults.ts` constants file, support environment variable override
- **Work estimate**: 0.5 day

### 1.7 MAJOR: Memory Subsystem 5+ Modules Suspected Dead Code

The following modules' exported functions/classes have no internal import references:

- `memory-quality.ts` (7 exported symbols)
- `memory-retrieval-service.ts` (6 exported symbols)
- `experience-cache-service.ts` (all exports)
- `memory-pollution-control-service.ts` (all exports)
- `memory-consolidation.ts` (all exports)

- **Fix**: Confirm if exposed via barrel file. If no external consumers, mark as `@internal` or delete.
- **Work estimate**: 0.5 day

### 1.8 MAJOR: 26 stable-* CLI Repeat ~80% Boilerplate Code

Each `src/cli/stable-*.ts` (26 files) repeats same pattern:

```typescript
function resolveOutputDir(): string {
  const fromEnv = process.env.AA_STABLE_{X}_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) { return fromEnv; }
  const outputDir = join(process.cwd(), "data", "stable-{x}");
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}
async function main(): Promise<void> {
  const outputDir = resolveOutputDir();
  const report = await runStable{X}({ outputDir });
  writeReport(join(outputDir, "report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (report.failedScenarios > 0) { process.exitCode = 1; }
}
main();
```

- **Fix**: Create common factory function:

```typescript
// src/cli/stable-runner-factory.ts
export function createStableCli(opts: {
  envVar: string;
  defaultDir: string;
  runner: (opts: { outputDir: string }) => Promise<StableReport>;
  writer: (path: string, report: StableReport) => void;
}): void { /* ... */ }
```

Each stable-* file reduced to 5-10 lines.

- **Work estimate**: 1 day
- **Acceptance**: Each stable-* CLI ≤15 lines

### 1.9 MAJOR: `typescript` as Runtime Dependency but Only in devDependencies

- **File**: `src/core/tools/code-diagnostics-service.ts:22`
- **Code**: `import ts from "typescript"`
- **Problem**: `typescript` only declared as devDependency but imported in production code
- **Fix**: If module used at runtime, move `typescript` to `dependencies`; if dev-only, move module to dev-only path

---

## 一B、Source Code Architecture Issues

Architecture-level review of `src/` directory (334 source files, 30 `core/` subdirectories), found following systemic architecture defects beyond code quality issues.

### 1B.1 CRITICAL: API Key Comparison Has Timing Attack Vulnerability

- **File**: `src/core/api/api-auth-service.ts:173`
- **Code**: `const record = this.apiKeys.find((item) => item.apiKey === apiKey);`
- **Problem**: Using `===` to compare API Key, attacker can guess key character by character by measuring response time difference. Same file line 116 JWT signature verification correctly uses `timingSafeEqual`, indicating team understands issue but didn't apply consistently.
- **Same issue**: `src/core/api/http-api-server.ts:235` billing webhook signature comparison also uses `!==`
- **Fix**: All secret/signature comparisons uniformly use `crypto.timingSafeEqual()`
- **Work estimate**: 30 minutes
- **Acceptance**: `grep -rn "=== apiKey\|!== expected\|=== secret" src/` returns empty; all key comparisons use timingSafeEqual

### 1B.2 CRITICAL: HTTP Request Body No Size Limit (DoS Risk)

- **File**: `src/core/api/http-api-server.ts:884-893`
- **Problem**: `readIncomingBody()` function unconditionally reads all chunks into memory (`Buffer.concat(chunks)`), no Content-Length check, no streaming byte count, no max size constant. Malicious client can send arbitrarily large request to exhaust server memory.
- **Fix**:
  ```typescript
  const MAX_BODY_BYTES = 1_048_576; // 1 MB
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) throw new ApiError(413, "Payload too large");
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  ```
- **Work estimate**: 30 minutes
- **Acceptance**: Requests exceeding MAX_BODY_BYTES return 413

### 1B.3 CRITICAL: 3 LLM Providers ~450 Lines Copy-Paste Code

- **Files**: `src/core/providers/anthropic/anthropic-chat-service.ts`, `openai/openai-chat-service.ts`, `minimax/minimax-chat-service.ts`
- **Problem**: Three providers have no shared base class or interface, the following patterns copied verbatim:

| Copy Pattern | Per Provider Lines | Total Duplication |
|----------|-------------------|--------|
| `parseRetryAfterMs()` | ~27 lines | ~81 lines |
| `parseResetAt()` | ~21 lines | ~63 lines |
| `shouldRetryWithinPool()` | ~3 lines | ~9 lines |
| `XxxAPIError` error class | ~18 lines | ~54 lines |
| `XxxProviderConfig` interface | ~7 lines | ~21 lines |
| `postWithCredentialFailover()` | ~90 lines | ~270 lines |

- **Fix**: Create `src/core/providers/base-chat-provider.ts`, extract shared logic; three providers implement inheriting base class or composing shared modules
- **Work estimate**: 2 days
- **Acceptance**: Shared code extracted to base class, each provider only contains differential logic (<200 lines)

### 1B.4 HIGH: 12 Single-File Directories (40% of core/ subdirectories)

The following `src/core/` subdirectories each contain only 1 .ts file, over-fragmentation increases navigation cost:

`approvals`, `artifacts`, `compliance`, `cost`, `deployment`, `divisions`, `evolution`, `hr`, `locking`, `queue`, `resource`, `results`

- **Fix**: Merge by association:
  - `approvals` + `compliance` → `governance/`
  - `cost` → merge into `product/`
  - `artifacts` + `results` → `output/`
  - `resource` → merge into `runtime/`
  - `deployment` + `evolution` → `lifecycle/`
  - `hr` → merge into `divisions/`
- **Work estimate**: 1 day
- **Acceptance**: No single-file directories; each directory ≥2 files

### 1B.5 HIGH: 12 Module-Level Mutable Singletons No Unified Lifecycle Management

| File | Variable |
|------|------|
| `divisions/division-loader.ts:212` | `let defaultRegistryCache` |
| `runtime/phase1b-orchestration.ts:787` | `let _toolRegistry` |
| `runtime/middleware-init.ts:37` | `let middlewareContext` |
| `runtime/agent-executor.ts:89` | `let executorContext` |
| `security/network-egress-audit.ts:369` | `let globalAuditService` |
| `security/network-egress-policy.ts:367` | `let globalPolicyService` |
| `runtime/output-continuation-service.ts:264` | `let globalContinuationService` |
| `runtime/model-call-provider.ts:28` | `let modelCallProviderInstance` |
| `runtime/graceful-shutdown.ts:263` | `let globalShutdownInstance` |
| `resource/process-tracker.ts:302` | `let trackerInstance` |

- **Problem**: Each singleton independently manages lifecycle, no unified teardown/reset mechanism. High risk of state leakage between tests, sys project manages 40+ subsystems through `bootstrap()`/`teardown()` centralized.
- **Fix**: Create `src/core/lifecycle/service-registry.ts`, centralized register/initialize/destroy all singletons
- **Work estimate**: 2 days
- **Acceptance**: All `let xxxInstance = null` patterns migrated to centralized registry

### 1B.6 HIGH: DurableEventBus No dispose/shutdown Method

- **Files**: `src/core/events/durable-event-bus.ts` (312 lines), `typed-event-bus.ts` (242 lines)
- **Problem**: Event bus class has no `dispose()`/`shutdown()`/`close()` method. Cannot一次性清除所有订阅者并停止待处理的投递链. The only cleanup path is calling `unsubscribe()` one by one.
- **Fix**: Add `dispose()` method: clear `subscribers` Map, cancel pending Promises in `deliveryChains`, set `disposed` flag to reject subsequent operations
- **Work estimate**: 0.5 day
- **Acceptance**: After `bus.dispose()` all subscriptions cleared, new emit rejected

### 1B.7 HIGH: HTTP API Routes No Schema Validation (All Manual typeof Checks)

- **File**: `src/core/api/http-api-server.ts`
- **Problem**: 6 POST routes all use manual `typeof` checks instead of Zod/JSON Schema validation:
  - `POST /v1/auth/token` (:208) — manual check `payload.apiKey`
  - `POST /v1/billing/webhooks/reconcile` (:220) — manual field check
  - `POST /v1/gateway/messages/send` (:323) — `channel`/`query`/`targetId`/`metadata` no content validation
  - `POST /v1/gateway/webhooks/receive` (:359) — minimal validation
  - `POST /v1/approvals/:id/decision` (:521) — enum validation
  - `POST /v1/admin/control-plane/load-balancing/select` (:556) — manual type guard
- **Additional issue**: Query parameters `channel`, `query` no length limit; `status` parameter no enum validation
- **Fix**: Create Zod schema for each route, unified validation after `readJsonBody()`
- **Work estimate**: 1 day
- **Acceptance**: Each POST route has Zod schema validation

### 1B.8 HIGH: 42 CLI Files Repeat DB Initialization Pattern (~210 Lines Duplication)

- **Scope**: 72 CLIs, 42 repeat this pattern:
  ```typescript
  const storage = openCliAuthoritativeStorageContext(dbPath);
  storage.migrate();
  const store = storage.store;
  // ... do work ...
  storage.close();
  ```
- **Problem**: Each file 4-5 lines boilerplate, total ~210 lines pure duplication. Any initialization logic change requires modifying 42 files.
- **Fix**: Create `withCliStorage()` higher-order function:
  ```typescript
  export async function withCliStorage<T>(
    dbPath: string,
    fn: (store: Phase1aStore) => Promise<T>
  ): Promise<T> {
    const storage = openCliAuthoritativeStorageContext(dbPath);
    storage.migrate();
    try { return await fn(storage.store); }
    finally { storage.close(); }
  }
  ```
- **Work estimate**: 1 day
- **Acceptance**: Each CLI DB initialization ≤1 line

### 1B.9 HIGH: `AppError.wrap()` 0% Usage Rate in runtime/ Layer

- **Scope**: `src/core/runtime/` 52 files, 39 catch blocks
- **Problem**: AGENTS.md specifies `AppError.wrap(err, taskId?)` for wrapping unknown errors, but in runtime/ layer's 39 catch blocks:
  - 0 use `AppError.wrap()`
  - 4 re-throw `throw err` (unwrapped)
  - 35 swallow errors (only log or silently ignore)
- **Examples**:
  - `agent-middleware-chain.ts:220/291/319` — re-throw `throw err` without wrap
  - `phase1b-orchestration.ts:1071` — LLM error converted to string return, no wrap
  - `model-call-provider.ts:218` — `console.error` + `throw error`
- **Fix**: Unified catch blocks use `AppError.wrap(err)` or explicitly mark as intentional swallow
- **Work estimate**: 1 day
- **Acceptance**: All catch blocks in runtime/ either `AppError.wrap(err)` or have `// intentional` comment

### 1B.10 HIGH: Gateway Directly Depends on Phase1aStore Implementation Not Interface

- **Files**: `src/gateway/channel-gateway-service.ts:1`, `channel-gateway-delivery-service.ts:15`
- **Problem**: Gateway layer imports concrete implementation classes `Phase1aStore` and `AuthoritativeSqlDatabase` (14 cross-layer imports), not via `StorageAdapter` interface. This binds Gateway to SQLite implementation.
- **Fix**: Gateway through constructor injection interface (`StorageAdapter` or custom `GatewayStoragePort`), don't directly import storage implementation
- **Work estimate**: 1 day
- **Acceptance**: `grep -rn "phase1a-store\|authoritative-sql" src/gateway/` returns empty

### 1B.11 MAJOR: 1080 Line God-function `runPhase1BOrchestration`

- **File**: `src/core/runtime/phase1b-orchestration.ts:1301-2380`
- **Problem**: Single function spans 1080 lines, contains 8 catch blocks. Same file `executeToolCall` (427-783, 357 lines) also too long.
- **Fix**: Split into `planPhase()`, `executePhase()`, `monitorPhase()`, `handleToolCall()` etc. ≤200 line sub-functions
- **Work estimate**: Already included in I-21 (phase1b split)
- **Acceptance**: No function exceeds 300 lines

### 1B.12 MAJOR: `dispatchRequest` 501 Lines No Route Table

- **File**: `src/core/api/http-api-server.ts:170-670`
- **Problem**: Single function uses 30+ if/else branches to handle all HTTP routes, no route table abstraction
- **Fix**: Extract route table `Map<string, RouteHandler>`, each route independent function
- **Work estimate**: Already included in I-23 (http-api-server split)
- **Acceptance**: `dispatchRequest` ≤50 lines (only route dispatch)

### 1B.13 MAJOR: 17 domain.ts Exported Types Never Imported

- **File**: `src/core/types/domain.ts`
- **Dead types**: `TaskSource`(:43), `EventConsumerAckStatus`(:45), `RunKind`(:46), `MessageDirection`(:49), `CompactionStage`(:69), `ExecutionTicketStatus`(:79), `LeaseAuditEventType`(:96), `TakeoverSessionStatus`(:104), `EvolutionPolicyStatus`(:122), `EvolutionLogEventType`(:123), `ActionProposalStatus`(:173), `TransitionActorType`(:175), `BudgetScope`(:288), `CompensationPlanEntry`(:349), `CompensationPlan`(:369), `CheckpointPlanEntry`(:379), `CheckpointPlan`(:391)
- **Problem**: ~200 lines dead type code, among which `Compensation*`/`Checkpoint*` 4 interfaces (~60 lines) are unimplemented recovery subsystem
- **Fix**: Delete unused types or mark as `@planned`
- **Work estimate**: 0.5 day
- **Acceptance**: All exported types in domain.ts have at least 1 import

### 1B.14 MAJOR: 15+ Unbounded Cache/Map Have Memory Leak Risk

Key unbounded cache list:

| File | Variable | Risk |
|------|------|------|
| `workflow/output-schema.ts:37` | `schemaCache` | Module-level Map, no cap |
| `security/data-classification-service.ts:284` | `rules` | Rules continuously grow |
| `security/cve-intelligence-service.ts:244` | `cveDatabase` | CVE entries continuously grow |
| `security/file-freshness.ts:237` | `snapshots` | File snapshots continuously grow |
| `tools/tool-recommend-service.ts:594` | `services` | One instance per session |
| `tools/edit-snapshot-service.ts:241` | `services` | One instance per session |
| `memory/experience-cache-service.ts:493` | `services` | One instance per session |
| `api/oidc-oauth-service.ts:150-153` | 4 Maps | JWKS/apiKeys/providers no cleanup |
| `observability/anomaly-detection-service.ts:171-174` | 4 Maps | history/thresholds/anomalies/signatures no eviction |
| `runtime/effect-buffer.ts:415` | `scopes` | Effect scope no cap |
| `runtime/license-enforcement-service.ts:204-205` | 2 Maps | Feature gates/usage counters no eviction |

- **Positive reference**: `loop-detection.ts` and `tight-loop-detector.ts` correctly implement TTL + capacity eviction
- **Fix**: Add capacity cap + LRU eviction or TTL expiration for each unbounded Map
- **Work estimate**: 2 days
- **Acceptance**: All class-level Maps have documented cap strategy

### 1B.15 MEDIUM: `tools/` Cross-Layer Import `runtime/`

- **File**: `src/core/tools/skill-execution-service.ts:29`
- **Problem**: Imports `ExecutionResourceCeilingGuard` (value import, creates runtime dependency) from `runtime/` layer. In layered architecture, tool layer should not depend on runtime layer. Another instance `tool-argument-coercion.ts:19` is type-only import, acceptable.
- **Fix**: Extract `ExecutionResourceCeilingGuard` interface to `types/` or `config/`, tool layer depends on interface not implementation
- **Work estimate**: 0.5 day
- **Acceptance**: `grep -rn 'from.*runtime/' src/core/tools/` only contains `import type`

### 1B.16 MEDIUM: 23 CLI Files Use Bare `main()` Call (Unhandled Rejection)

- **Scope**: 23 files in `src/cli/` use `main();` (no `void`, no `.catch()`), another 27 use `void main();`
- **Problem**: When async main throws, bare `main()` call generates UnhandledPromiseRejection. Node 20+ default behavior prints warning but doesn't exit (`--unhandled-rejections=warn`), may silently lose errors.
- **Fix**: Unified to `main().catch((err) => { console.error(err); process.exitCode = 1; });` or `void main();`
- **Work estimate**: 30 minutes
- **Acceptance**: All CLI entries have unified error handling pattern

### 1B.17 MEDIUM: Event Bus 27/38 Types Use Opaque `GenericEventPayload`

- **File**: `src/core/events/typed-event-bus.ts`
- **Problem**: 27 of 38 event types use `GenericEventPayload` (no specific field types), type safety is void. Consumers need manual assertion for payload fields.
- **Fix**: Define concrete payload interface for each event type
- **Work estimate**: 2 days
- **Acceptance**: `GenericEventPayload` usage drops to ≤5

### 1B.18 MEDIUM: `process.env` Direct Access Bypasses Centralized Config

- **Scope**: 56 unique environment variables directly read `process.env.XXX` in 38 CLI files
- **Problem**: Project has 19 centralized config loaders (`src/core/config/`), but ~35 environment variables bypass them directly in CLI. For example `evolution.ts` directly reads `process.env.AA_EXECUTION_ID` without going through `loadEvolutionCliEnv()`.
- **Fix**: All `process.env` access must go through loader functions under `src/core/config/`
- **Work estimate**: 1 day
- **Acceptance**: `grep -rn "process\.env\." src/cli/` only appears in top-level `loadXxxEnv(process.env)` calls

### 1B.19 MEDIUM: Migration System No Rollback Capability

- **File**: `src/core/storage/sqlite/sqlite-migration-plan.ts:14-20`
- **Problem**: `SqliteMigrationDefinition` interface only has `version`/`name`/`sql`/`checksum` fields, no `down`/`rollback` SQL. 37 migrations all move forward only. If migration error occurs, need new forward migration to reverse fix.
- **Fix**: Short-term acceptable (SQLite's ALTER TABLE limitations make rollback difficult); long-term add `downSql` field for each new migration
- **Work estimate**: Long-term progressive
- **Acceptance**: New migrations must include down SQL

### 1B.20 MEDIUM: `safeLoadDivisionRegistry()` Copy-Paste Across Files

- **File 1**: `src/core/api/http-api-server.ts:748-755`
- **File 2**: `src/core/api/mission-control-service.ts:403-409`
- **Problem**: Both files各自定义逐字相同 `safeLoadDivisionRegistry()` private function (7 lines)
- **Fix**: Extract to `division-loader.ts` and export
- **Work estimate**: 15 minutes
- **Acceptance**: Only one definition

### 1B.21 LOW: `src/core/testing/` Directory Naming Misleading

- **File**: `src/core/testing/` (29 files, 12,586 lines)
- **Problem**: This directory contains production-grade stability drills/evidence collection/release gate tools (called by `src/cli/stable-*` CLI), not test code. `testing` name suggests it should be in `tests/`.
- **Fix**: Rename to `src/core/stability/` or `src/core/qa-infrastructure/`
- **Work estimate**: 0.5 day
- **Acceptance**: Directory name accurately reflects its production tool nature

### 1B.22 LOW: `.then()` Chain Usage (6 instances)

- **Files**: `agent-middleware-chain.ts:381`, `skill-execution-service.ts:973`, `durable-event-bus.ts:288-289`, `builtin-memory-provider.ts:215`, `queue-adapter.ts:351`
- **Problem**: AGENTS.md specifies "all async/await, no Promise chains", but 6 instances of `.then()` usage
- **Fix**: Rewrite as async/await or mark as necessary exception
- **Work estimate**: 30 minutes
- **Acceptance**: `.then()` only used in necessary scenarios like dynamic import

---

## 二、Infrastructure and Configuration Issues

### 2.1 CRITICAL: `start`/`demo`/Dockerfile CMD Path Error

- **File**: `package.json` lines 11/82, `Dockerfile` line 36
- **Problem**: References `dist/index.js`, but `tsconfig.json` sets `rootDir: "."`, `outDir: "dist"`, and includes `src/**` and `tests/**`, actual compiled output is `dist/src/index.js`. Other CLI scripts correctly use `dist/src/cli/*.js`, confirming this is error.
- **Fix**:
  1. `package.json`: `"start": "node --enable-source-maps dist/src/index.js"`
  2. `package.json`: `"demo": "npm run build && node --enable-source-maps dist/src/index.js"`
  3. `Dockerfile`: `CMD ["node", "--enable-source-maps", "dist/src/index.js"]`
- **Work**: 10 minutes
- **Acceptance**: `npm start` and `docker run` both start normally

### 2.2 HIGH: Build Script Compiles Tests into Production Artifact

- **File**: `package.json` line 8
- **Problem**: `build` script uses `tsconfig.json` (includes `tests/**`), compiles all tests to `dist/tests/`, wastes build time, Dockerfile build stage also compiles tests.
- **Fix**:
  1. New script: `"build:test": "tsc -p tsconfig.json"` (compile with tests)
  2. Modify `build`: `"build": "node scripts/clean-dist.mjs && tsc -p tsconfig.build.json"` (compile source only)
  3. Test scripts change to depend on `build:test`
  4. Dockerfile use `npm run build` (no longer compile tests)
  5. Remove `COPY tests ./tests` from Dockerfile
- **Work**: 30 minutes
- **Acceptance**: `npm run build` does not produce `dist/tests/`

### 2.3 HIGH: docker-compose JWT Secret Commented Out

- **File**: `docker-compose.yml` line 13
- **Problem**: `# AA_API_JWT_SECRET: ${AA_API_JWT_SECRET}` commented out. If not uncommented in production, API server may run without authentication.
- **Fix**: Uncomment, add fail-fast validation at startup (reject startup if not set)
- **Work**: 15 minutes

### 2.4 HIGH: Missing `.env.example`

- **Problem**: Project heavily uses `AA_*` environment variables (`AA_DB_PATH`, `AA_API_JWT_SECRET`, `AA_PRESERVE_DIST`, `AA_VALIDATION_ITERATIONS`, LLM API Keys etc.), but no `.env.example` file.
- **Fix**: Create `.env.example`, list all environment variables with descriptions:

```bash
# Required
AA_DB_PATH=./data/agent.db
AA_API_JWT_SECRET=<your-jwt-secret>

# LLM Provider (configure at least one)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Optional
AA_LOG_LEVEL=info
AA_PRESERVE_DIST=false
AA_VALIDATION_ITERATIONS=10
AA_STABLE_CHAOS_OUTPUT_DIR=
```

- **Work**: 30 minutes
- **Acceptance**: New developers cloning repo can understand all configuration via `.env.example`

### 2.5 HIGH: CI Missing Lint and Security Scan

- **File**: `.github/workflows/ci.yml`
- **Problem**: CI only has typecheck + test + validate:stable, missing:
  - lint step (project has no ESLint)
  - security scan (`npm audit`)
  - test coverage report
- **Fix**:
  1. Add ESLint configuration (see 2.8)
  2. CI add `npm audit --audit-level=high` step
  3. CI add `c8` coverage collection
  4. CI add coverage upload (`actions/upload-artifact`)
- **Work**: 1 day (including ESLint config)

### 2.6 HIGH: Missing LICENSE File

- **Problem**: No LICENSE file. `package.json` has `"private": true`, but missing explicit license declaration.
- **Fix**: Add LICENSE file matching project distribution mode
- **Work**: 10 minutes

### 2.7 HIGH: `.gitignore` Does Not Exclude `.env` Files

- **File**: `.gitignore`
- **Problem**: Does not include `.env`, `.env.local`, `.env.production` etc. If developer accidentally creates `.env` file with secrets, may be committed.
- **Fix**: Add these lines:
  ```
  .env
  .env.*
  !.env.example
  ```
- **Work**: 5 minutes

### 2.8 MEDIUM: No ESLint Configuration

- **Problem**: Entire project has no linter. Workspace AGENTS.md mentions ESLint rules but no actual config file.
- **Fix**:
  1. `npm install -D eslint @eslint/js typescript-eslint`
  2. Create `eslint.config.js` (flat config):
  ```javascript
  import js from "@eslint/js";
  import tseslint from "typescript-eslint";
  export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ["src/**/*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
    { ignores: ["dist/", "tests/", "*.config.*"] },
  ];
  ```
  3. `package.json` add `"lint": "eslint src/"`
- **Work**: 0.5 day
- **Acceptance**: `npm run lint` passes and CI integrated

### 2.9 MEDIUM: config/ No Schema Validation

- **Problem**: 8 subdirectories of JSON config files have no Zod/JSON Schema validation. MEMORY.md already records this issue (CFG-03~06).
- **Fix**: Create Zod schema for each config domain, validate at startup:
  ```
  config/runtime/  → RuntimeConfigSchema
  config/security/ → SecurityConfigSchema
  config/providers/ → ProviderConfigSchema
  config/bootstrap/ → BootstrapConfigSchema
  ```
- **Work**: 1-2 days
- **Acceptance**: Startup fail-fast with human-readable error if config invalid

### 2.10 MEDIUM: `models.json` and `models.bundled.json` Nearly Identical

- **Files**: `config/providers/models.json`, `config/providers/models.bundled.json`
- **Problem**: Two files only differ in `metadataSource` field, everything else identical. Forgetting to update one while updating the other causes drift.
- **Fix**: Keep one as source of truth, other generated by script
- **Work**: 0.5 day

### 2.11 MEDIUM: Environment Config `configPath` Field Misleading

- **Files**: `config/environments/dev.json`, `staging.json`, `prod.json` etc.
- **Problem**: All environments' `configPath` point to `config/runtime/default.json`, not their respective `config/runtime/{env}.json`
- **Fix**: Update to correct path or remove field if unused
- **Work**: 15 minutes

### 2.12 MEDIUM: Dockerfile Missing EXPOSE and HEALTHCHECK

- **File**: `Dockerfile`
- **Fix**:
  ```dockerfile
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
  ```
- **Work**: 10 minutes

### 2.13 MEDIUM: publish-image CI No Gate + No Cache

- **File**: `.github/workflows/publish-image.yml`
- **Problem**:
  1. Can publish image without CI passing
  2. Docker Buildx not configured with build cache
- **Fix**:
  1. Add CI passing check (`gh api` or `needs` dependency)
  2. Add `cache-from: type=gha` and `cache-to: type=gha,mode=max`
- **Work**: 30 minutes

### 2.14 LOW: docker-compose Uses Deprecated Syntax

- **File**: `docker-compose.yml`
- **Problem**: `version: "3.9"` and `mem_limit`/`mem_reservation` deprecated
- **Fix**: Remove `version`, move resource limits to `deploy.resources`
- **Work**: 10 minutes

### 2.15 LOW: Division YAML Missing `apiVersion` Field

- **File**: All 10 YAMLs under `divisions/`
- **Problem**: Workspace AGENTS.md requires `apiVersion: division/v1`, but actually missing this field
- **Fix**: Add `apiVersion: division/v1` to all Division YAMLs
- **Work**: 15 minutes

### 2.16 LOW: Division Trigger Keywords Cross-Division Overlap

- **Problem**: `bug` (engineering_ops + qa), `fix` (engineering_ops + support), `research`/`review`/`analyze` (research + general_ops) overlap
- **Fix**: Establish route priority documentation or deduplication for overlapping keywords
- **Work**: 30 minutes

### 2.17 MEDIUM: Missing tsconfig Strict Options

- **File**: `tsconfig.json`
- **Problem**: Project enabled `strict`, `noImplicitOverride`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, but missing these valuable strict options:
  - `noFallthroughCasesInSwitch` — prevent accidental switch fall-through
  - `verbatimModuleSyntax` — enforce `import type` consistency
  - `noPropertyAccessFromIndexSignature` — prohibit `.` access to index signature properties
- **Fix**: Add these three options in `compilerOptions`, enable one by one and fix compilation errors
- **Work estimate**: 0.5-1 day (`verbatimModuleSyntax` may need many import adjustments)
- **Acceptance**: `tsc --noEmit` passes with all three options enabled

### 2.18 LOW: tsconfig.build.json Redundant sourceMap

- **File**: `tsconfig.build.json` line 4
- **Problem**: `tsconfig.build.json` inherits `tsconfig.json` and sets `"sourceMap": true` again, but base config `tsconfig.json` line 18 already has this setting, purely redundant
- **Fix**: Remove redundant `"sourceMap": true` from `tsconfig.build.json`
- **Work estimate**: 5 minutes
- **Acceptance**: `tsconfig.build.json` only contains overrides different from base config

### 2.19 HIGH: Dockerfile Missing PID 1 Signal Handling (tini/init)

- **File**: `Dockerfile` line 36
- **Problem**: `CMD ["node", "--enable-source-maps", "dist/index.js"]` makes Node.js run directly as PID 1. PID 1 process won't receive default SIGTERM behavior, may cause container unable to gracefully stop, zombie processes cannot be reclaimed. Project's own documentation `doc/operations/system_gap_analysis.md` line 670 marks this as HIGH severity and claims "Fixed", but Dockerfile actually unchanged.
- **Fix**:
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
  ENTRYPOINT ["/usr/bin/tini", "--"]
  CMD ["node", "--enable-source-maps", "dist/src/index.js"]
  ```
  Or add `init: true` in docker-compose
- **Work estimate**: 15 minutes
- **Acceptance**: `docker top <container>` shows tini as PID 1

### 2.20 LOW: docker-compose Missing Log Driver Config

- **File**: `docker-compose.yml`
- **Problem**: `api-server` service has no `logging:` config block. In production using default `json-file` driver, log files may grow unlimited and fill disk.
- **Fix**: Add log driver config:
  ```yaml
  logging:
    driver: json-file
    options:
      max-size: "50m"
      max-file: "5"
  ```
- **Work estimate**: 5 minutes
- **Acceptance**: `docker compose config` output includes logging config

### 2.21 MEDIUM: CI No Node Version Matrix Test

- **File**: `.github/workflows/ci.yml` line 18
- **Problem**: CI hardcodes `node-version: 22`, no `strategy.matrix` cross-version testing. Project target runtime is Node 20+, but never verified on Node 20.
- **Fix**:
  ```yaml
  strategy:
    matrix:
      node-version: [20, 22]
  ```
- **Work estimate**: 15 minutes
- **Acceptance**: CI passes on both Node 20 and 22

### 2.22 MEDIUM: CI No Test Artifact Upload

- **File**: `.github/workflows/ci.yml`
- **Problem**: After test failure, no artifacts available for debugging. CI should upload test logs and coverage reports.
- **Fix**: Add after test step:
  ```yaml
  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: test-results-${{ matrix.node-version }}
      path: |
        test-results/
        coverage/
  ```
- **Work estimate**: 15 minutes
- **Acceptance**: Can download test logs on CI failure

### 2.23 LOW: deploy-environment.yml Is Empty Shell

- **File**: `.github/workflows/deploy-environment.yml` lines 37-42
- **Problem**: Deploy step only contains `echo` statement and `test -n "$DEPLOYMENT_AUTH_TOKEN"` check, no actual deployment logic (no kubectl/helm/docker/curl).
- **Fix**: Implement actual deployment logic or add TODO comment indicating placeholder
- **Work estimate**: Varies by deployment solution
- **Acceptance**: Deployment workflow can execute actual deployment or has clear TODO marker

### 2.24 LOW: maxAgentRounds No Environment Variable Override

- **Files**: `src/core/config/runtime-env.ts` lines 97-104, `config/runtime/default.json` line 5
- **Problem**: `maxToolCalls` can be overridden via `AA_MAX_AGENT_TOOL_CALLS` environment variable, but `maxAgentRounds` (default value 6) has no corresponding environment variable override path. Ops cannot adjust max rounds without modifying config file.
- **Fix**: Add `AA_MAX_AGENT_ROUNDS` environment variable reading in `loadExecutionResourceCeilingEnv()`
- **Work estimate**: 15 minutes
- **Acceptance**: `AA_MAX_AGENT_ROUNDS=10 node ...` can override default

---

## 三、Documentation Issues

### 3.1 MEDIUM: CLAUDE.md vs MEMORY.md Table Count Inconsistent

- **CLAUDE.md line 53**: "SQLite with WAL mode, ~49 tables"
- **MEMORY.md line 63**: "SQLite with WAL mode, ~41 tables"
- **Fix**: Query actual table count `SELECT count(*) FROM sqlite_master WHERE type='table'`, unify
- **Work**: 10 minutes

### 3.2 MEDIUM: Division Count Documentation Inconsistent

- **workspace AGENTS.md**: Lists 11 divisions (engineering, research, content, devops, marketing, data, security, qa, design, analytics, support)
- **Actual divisions/ directory**: 10 (engineering_ops, research, content, devops, security, qa, design, analytics, support, general_ops)
- **Difference**: `marketing`/`data` in docs but not in code; `general_ops` in code but not in docs; `engineering` vs `engineering_ops` naming inconsistency
- **Fix**: Sync docs and code, decide whether to add marketing/data or remove from docs
- **Work**: 30 minutes

### 3.3 MEDIUM: Hardcoded Pricing Data in Version Control

- **Files**: `config/providers/models.json`, `config/product/default.json`
- **Problem**: LLM model pricing (`inputPer1kUsd`/`outputPer1kUsd`) and billing plan pricing (`unitPriceUsd`) hardcoded in JSON. LLM pricing changes frequently, each change requires code commit and deployment.
- **Fix**: Consider dynamic pricing fetch, or establish independent pricing update process
- **Work**: Varies by solution

---

## 三B、Project Standards Deficiencies

### 3.4 CRITICAL: `src/index.ts` Is Demo Script Not Public API Barrel

- **File**: `src/index.ts` (92 lines, 0 export statements)
- **Problem**: AGENTS.md line 7 describes `index.ts` as "public API barrel (107 lines exports)", but actual file is Phase 1A Demo Entry Point demo script, directly calls `main()`, has no `export` statements. This means project has no public API entry point, external consumers cannot `import { ... } from 'automatic-agent-system'`.
- **Fix**:
  1. Rename current `index.ts` to `demo.ts` or move to `cli/demo.ts`
  2. Create real barrel `index.ts`, re-export core public API as needed
  3. Update `package.json` `main`/`exports` fields
- **Work estimate**: 1 day
- **Acceptance**: `import { ... } from './dist/src/index.js'` can import core API

### 3.5 LOW: Missing CONTRIBUTING.md

- **Problem**: Project has no `CONTRIBUTING.md` file. Has `CLAUDE.md` (AI assistant guide) and `AGENTS.md` (workspace development standards), but no standard guide for human contributors.
- **Fix**: Create `CONTRIBUTING.md` covering: development environment setup, branch strategy, commit conventions, PR process, test requirements
- **Work estimate**: 1 hour
- **Acceptance**: New developers can complete first contribution following CONTRIBUTING.md

### 3.6 MEDIUM: Magic Numbers Scattered in Core Code

- **Files**: At least 9 `src/core/` files
- **Problem**: The following magic numbers repeatedly used without named constants:
  - `30000` (lock TTL milliseconds) — repeated in `distributed-lock-service.ts` (6 places), `call-governance.ts`, `ha-coordinator-service.ts`, `graceful-shutdown.ts`
  - `86400` (seconds/day) — repeated in `queue-adapter.ts`, `tenant-execution-isolation-service.ts`, `skill-governance-service.ts`
  - `86400000` / `86400 * 1000` (milliseconds/day) — in `operations-governance-service.ts`, `ha-coordinator-service.ts`
- **Fix**: Create `src/core/constants/time.ts` (or similar), define:
  ```typescript
  export const DEFAULT_LOCK_TTL_MS = 30_000;
  export const SECONDS_PER_DAY = 86_400;
  export const MS_PER_DAY = 86_400_000;
  ```
  Globally replace all bare number references.
- **Work estimate**: 0.5 day
- **Acceptance**: `grep -rn "30000\|86400" src/core/` only appears in constant definition locations

---

## 四、Testing Gaps

### 4.1 CRITICAL: Security-Critical Modules No Tests

The following security/auth/payment related modules completely lack corresponding test files:

| Module | Lines | Risk |
|------|------|------|
| `api/http-api-server.ts` | 1,344 | API attack surface |
| `api/oidc-oauth-service.ts` | 814 | Auth bypass |
| `security/secret-management-service.ts` | 1,042 | Key leak |
| `security/cve-intelligence-service.ts` | 748 | Security intelligence |
| `security/data-classification-service.ts` | 730 | PII leak |
| `security/outbound-url-policy.ts` | — | SSRF protection |
| `product/billing-payment-gateway.ts` | 545 | Payment security |
| `storage/sqlite/phase1a-store.ts` | 8,798 | Core data layer |

- **Fix**: Create tests by risk priority:
  1. P0: `oidc-oauth-service.test.ts` (auth)
  2. P0: `secret-management-service.test.ts` (keys)
  3. P0: `http-api-server.test.ts` (API)
  4. P1: `data-classification-service.test.ts` (PII)
  5. P1: `billing-payment-gateway.test.ts` (payment)
  6. P1: `outbound-url-policy.test.ts` (SSRF)
- **Work**: 0.5-1 day per module
- **Acceptance**: Each security module ≥80% line coverage

### 4.2 MAJOR: 115 Source Modules No Tests at All

- **Stats**: 115 of 331 source files (35%) lack corresponding test files
- **Key missing**:
  - All 72 CLI files have no tests
  - All 20+ `core/testing/stable-*` files (test infrastructure itself) have no tests
  - All 3 LLM provider services (anthropic/openai/minimax) have no tests
  - All `core/runtime/execution-*` series (dispatch/lease/worker/handshake) have no tests
- **Fix**: Establish test coverage gate, new modules must include tests
- **Work**: Continuous investment

### 4.3 MEDIUM: No Coverage Collection

- **Problem**: `node --test` runs tests but doesn't collect coverage
- **Fix**: Use `c8` wrapper: `c8 node --test dist/tests/**/*.test.js`
- **Work**: 30 minutes

---

## 四B、Documentation Architecture Issues

Full review of `doc/` (227 .md files) and `doc_en/` (225 .md files), found following systemic issues.

### 4B.1 HIGH: 104 Absolute Path Broken Links (Local Absolute Paths)

- **Scope**: All 7 files in `doc/operations/phases/` + corresponding 7 files in `doc_en/operations/phases/`
- **Problem**: All "key contract" links once used developer's local absolute paths, cannot resolve in any other environment.

| File | Broken Links |
|------|--------|
| `phase-1a-foundation.md` | 13 |
| `phase-1b-orchestration.md` | 6 |
| `phase-2a-multi-division.md` | 5 |
| `phase-2b-memory-governance-stability.md` | 7 |
| `phase-2c-skills-hr-evolution.md` | 5 |
| `phase-3-pmf-commercialization.md` | 7 |
| `phase-4-enterprise-ecosystem.md` | 9 |

- **Fix**: Replace all with relative paths. Example:
  ```
  # Original:
  [task_and_workflow_contract.md](../../../../.../doc/contracts/task_and_workflow_contract.md)
  # Changed to:
  [task_and_workflow_contract.md](../../contracts/task_and_workflow_contract.md)
  ```
  Synchronously fix both `doc/` and `doc_en/`.
- **Work estimate**: 1 hour (batch sed replacement)
- **Acceptance**: `grep -r "$HOME/" doc/ doc_en/` returns empty

### 4B.2 HIGH: `research/analysis/` 12 Files Detached from Navigation Tree

- **File**: `doc/research/README.md` (23 lines)
- **Problem**: `research/README.md` only lists files in `frameworks/` and `platform/` subdirectories, 12 analysis reports in `analysis/` subdirectory (aider, claude code, claw, codex, goose, hermes, kilo code, manus, open multi agent, opencode, roo code, windsurf) completely unindexed. Readers cannot discover these documents via navigation.
- **Fix**: Add `### analysis/` section in `research/README.md`, list all 12 files with summaries
- **Work estimate**: 30 minutes
- **Acceptance**: `research/README.md` contains links to all analysis/ files

### 4B.3 MEDIUM: `doc/README.md` Structure Defects

- **File**: `doc/README.md`
- **Problem 1**: Lines 254 and 268 both have `### 5.7`, second should be `### 5.8`
- **Problem 2**: Line 262 list numbering jumps from 6 to 24 (`24. [contracts/tenant_isolation...]`), copied from section 5.2 and not renumbered
- **Fix**:
  1. Change line 268 `### 5.7` to `### 5.8`
  2. Change lines 262-266 numbers 24-28 to 7-11
- **Work estimate**: 10 minutes
- **Acceptance**: Section numbers sequential, list numbers sequential

### 4B.4 MEDIUM: Two Filename Spelling Errors

| Current Filename | Correct Filename | Location |
|-----------|-----------|------|
| `claude_code_analysis.md` | `claude_code_analysis.md` | `doc/research/analysis/` + `doc_en/research/analysis/` |
| `process_safety_and_observablility.md` | `process_safety_and_observability.md` | `doc/operations/` + `doc_en/operations/` |

- **Fix**: `git mv` rename 4 files, update all references
- **Work estimate**: 15 minutes
- **Acceptance**: No spelling errors in filenames

### 4B.5 MEDIUM: Governance Documents Too Thin

- **`doc/governance/change_control.md`** (26 lines) — Missing: role and responsibility definitions, approval workflow, escalation path, change impact assessment criteria, SLA requirements, emergency/break-glass change process, audit trail requirements
- **`doc/governance/source_of_truth.md`** (28 lines) — Missing: conflict resolution mechanism (beyond priority ordering), ownership model, staleness/freshness strategy, deprecation process, experimental content upgrade process
- **Contrast**: Same directory `naming_and_directory_conventions.md` (80 lines) and `glossary_and_terminology.md` (365 lines) are content-rich, highlighting these two files' thinness
- **Fix**: Supplement each file with at least: role definitions, specific process steps, exception handling, audit requirements
- **Work estimate**: 0.5 day
- **Acceptance**: Each governance document ≥80 lines, contains actionable process steps

### 4B.6 MEDIUM: `adr/` Missing README.md Index

- **Problem**: 15 ADR files have no independent index. `doc/README.md` only mentions "see adr/" briefly, doesn't list each ADR title. All other subdirectories (contracts, operations, reviews, reference, research, governance, archive) have README.md index.
- **Fix**: Create `doc/adr/README.md`, list all 15 ADRs with number, title, status, decision date, and synchronously create `doc_en/adr/README.md`
- **Work estimate**: 30 minutes
- **Acceptance**: `doc/adr/README.md` contains structured list of all ADRs

### 4B.7 MEDIUM: Contract Documentation Depth Varies Greatly

- **Problem**: Among 86 contract files, smallest is only 33 lines (`artifact_unified_model_contract.md` — no field definitions/schema/API) and 34 lines (`token_budget_allocation_contract.md` — no budget numbers/formulas), essentially architecture placeholders rather than implementable specs. Larger contracts (like `configuration_layers_and_defaults_contract.md` 130 lines, `cost_and_budget_contract.md` 98 lines) have complete field tables and behavior rules.
- **Fix**: Supplement all <50 line contracts with: key object field tables, Zod/TypeScript interface definitions, behavior rules, error handling; or mark as `status: draft`
- **Work estimate**: 2-3 days
- **Acceptance**: All contracts ≥50 lines or marked draft status

### 4B.8 MEDIUM: `18_code_architecture.md` Anomaly

- **File**: `doc/18_code_architecture.md` (1137 lines)
- **Problem**:
  1. Number jumps from 07 to 18 (08-17 missing), suggests supplementary file not renumbered
  2. Line 10 claims using "Node.js built-in test runner", but project actually uses Vitest
  3. Not referenced by any README index
- **Fix**: Renumber to `08_code_architecture.md`, update outdated content, add to `doc/README.md` index
- **Work estimate**: 1 hour
- **Acceptance**: Numbers sequential; test framework description matches reality; indexed by README

### 4B.9 MEDIUM: `process_safety_and_observablility.md` Label and Location Conflict

- **File**: `doc/operations/process_safety_and_observablility.md`
- **Problem**: File starts with `# ADR-072:` but located in `operations/` not `adr/`. ADR numbers jump from 015 to 072, format also differs from standard ADR template.
- **Fix**: Remove `ADR-072:` prefix (since it's not a formal ADR), or move to `adr/` and rewrite with ADR template. Also fix filename spelling (see 4B.4).
- **Work estimate**: 15 minutes
- **Acceptance**: File label matches its directory

### 4B.10 MEDIUM: doc_en/ Missing 2 Translated Files

- **Missing files**:
  1. `doc_en/reviews/comprehensive_improvement_plan_20260412.md` (corresponding doc/ 688 lines)
  2. `doc_en/reviews/improvement_gaps_vs_sys_20260412.md` (corresponding doc/ 480 lines)
- **Fix**: Translate and sync to doc_en/
- **Work estimate**: 2-3 hours
- **Acceptance**: doc/ and doc_en/ file counts match

### 4B.11 LOW: Three Naming Convention Mix

- **snake_case** (~160 files): contracts/, operations/, reviews/ — `task_and_workflow_contract.md`
- **kebab-case** (~43 files): adr/, reference/, phases/ — `001-three-layer-architecture.md`
- **PascalCase** (~10 files): research/frameworks/ — `Aider_Framework_Analysis.md`
- **Impact**: Each subdirectory internally consistent, but global search/automation scripts need to handle three patterns
- **Fix**: Short-term acceptable (each domain internally consistent); long-term recommend unifying to `kebab-case` (consistent with code filename conventions)
- **Work estimate**: Varies by unification scope
- **Acceptance**: New files uniformly use kebab-case

### 4B.12 LOW: `error_code_registry.md` Suffix Inconsistent

- **File**: `doc/contracts/error_code_registry.md`
- **Problem**: Other 85 contract files all end with `_contract.md`, only this file uses `_registry.md`
- **Fix**: Renamed to `error_code_registry_contract.md`, update all references
- **Work estimate**: 10 minutes
- **Acceptance**: All files in contracts/ have consistent suffix

### 4B.13 LOW: ~8 Orphan Documents Not Indexed by README

The following files don't appear in any README.md links:

| File | Should Be Indexed At |
|------|-----------|
| `doc/18_code_architecture.md` | `doc/README.md` |
| `doc/06_testing_release_and_operations.md` | `doc/README.md` |
| `doc/operations/system_gap_analysis.md` | `doc/operations/README.md` |
| `doc/operations/process_safety_and_observablility.md` | `doc/operations/README.md` |
| `doc/reviews/comprehensive_improvement_plan_20260412.md` | `doc/reviews/README.md` |
| `doc/reviews/improvement_gaps_vs_sys_20260412.md` | `doc/reviews/README.md` |
| `doc/reviews/platform_plane_special_review.md` | `doc/README.md` reading path |
| `doc/reviews/stability_contract_special_review.md` | `doc/README.md` reading path |

- **Fix**: Add each file to its belonging README's index
- **Work estimate**: 30 minutes
- **Acceptance**: All .md files referenced by at least one README

### 4B.14 LOW: All ADRs Batch Accepted Same Week

- **Problem**: All 15 ADRs marked `Status: Accepted` between 2026-04-02 and 2026-04-03, no Draft, Proposed, Superseded intermediate states, lacking incremental decision history feel
- **Fix**: Non-blocking, but subsequent new ADRs should preserve complete status transition records
- **Work estimate**: No changes to existing files needed
- **Acceptance**: New ADRs have Draft → Proposed → Accepted transition

### 4B.15 LOW: Ops Documentation Checklists Never Marked Complete

- **Scope**: `doc/operations/operations-checklist.md`, `doc/operations/operations-checklist.md` etc.
- **Problem**: All `- [ ]` items unchecked, no owner, date, completion markers. Checklists only exist as templates, no execution痕迹.
- **Fix**: In governance process, clarify checklist usage (whether to instantiate in PR/Issue rather than directly modify documents), or add "last verified date" field
- **Work estimate**: 15 minutes (add usage guide)
- **Acceptance**: Checklist files have clear usage guide

### 4B.16 LOW: doc_en/ Translation Residue Chinese

- **File**: `doc_en/05_delivery_scope_and_milestones.md` line 107
- **Problem**: Untranslated Chinese remains in body: `拆包`: `"...before entering拆包 (unbundling) and implementation."`
- **Fix**: Replace with pure English `"...before entering unbundling and implementation."`
- **Work estimate**: 5 minutes
- **Acceptance**: `grep -r "[^\x00-\x7F]" doc_en/` no residual Chinese (except comments and proper nouns)

---

## 五、Executable Improvement Roadmap

Arranged by priority and dependencies, each task has clear acceptance criteria and work estimate.

### Wave 0: Urgent Fixes (Within 1 Day)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-01 | Fix `dist/index.js` path error | 2.1 | 10 min | `npm start` starts normally |
| I-02 | Add `.env` to `.gitignore` | 2.7 | 5 min | `.env` not tracked by git |
| I-03 | Create `.env.example` | 2.4 | 30 min | All AA_* variables documented |
| I-04 | Uncomment JWT secret config | 2.3 | 15 min | Fail-fast if no secret |
| I-05 | Add LICENSE | 2.6 | 10 min | File exists |
| I-06 | Fix CLAUDE.md/MEMORY.md table count | 3.1 | 10 min | Numbers match |
| I-36 | Change `index.ts` from demo script to barrel | 3.4 | 1d | External can import core API |
| I-37 | Remove tsconfig.build.json redundant sourceMap | 2.18 | 5 min | Only contains overrides |
| I-43 | Fix 104 local absolute path broken links | 4B.1 | 1h | `grep -r "$HOME/" doc/ doc_en/` returns empty |
| I-44 | Fix README.md duplicate section numbers + list number jumps | 4B.3 | 10 min | Section/list numbers sequential |
| I-45 | Fix 2 filename spelling errors | 4B.4 | 15 min | `caude` → `claude`, `observablility` → `observability` |
| I-58 | Fix API Key timing attack vulnerability | 1B.1 | 30 min | All key comparisons use `timingSafeEqual` |
| I-59 | Add HTTP request body size limit | 1B.2 | 30 min | Oversized returns 413 |
| I-60 | Eliminate `safeLoadDivisionRegistry()` cross-file duplication | 1B.20 | 15 min | Only one definition |

### Wave 1: Build and CI Fixes (2-3 Days)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-07 | Separate build/build:test scripts | 2.2 | 30 min | `npm run build` does not produce `dist/tests/` |
| I-08 | Dockerfile fixes (path + EXPOSE + HEALTHCHECK + tini + remove tests) | 2.1/2.12/2.19 | 30 min | Health check passes + tini is PID 1 |
| I-09 | Add ESLint configuration | 2.8 | 4h | `npm run lint` passes |
| I-10 | CI add lint + audit + coverage + matrix + artifact | 2.5/2.21/2.22 | 4h | CI includes lint/audit/coverage, Node 20+22 matrix |
| I-11 | publish-image add gate + cache | 2.13 | 30 min | No CI passing, no publish |
| I-12 | docker-compose deprecated syntax + logging + init | 2.14/2.20 | 15 min | No deprecation warnings + log rotation |
| I-46 | Complete research/analysis/ 12 file index | 4B.2 | 30 min | `research/README.md` contains all analysis/ links |
| I-47 | Create `adr/README.md` index | 4B.6 | 30 min | 15 ADRs have structured list |
| I-48 | Fix `18_code_architecture.md` numbering/content/index | 4B.8 | 1h | Numbers sequential + content accurate + indexed by README |
| I-49 | Fix `process_safety_and_observablility.md` label | 4B.9 | 15 min | Label matches directory |
| I-50 | Add orphan documents to README index | 4B.13 | 30 min | All .md referenced by at least one README |

### Wave 2: Core Code Quality (1-2 Weeks)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-13 | Delete 13 dead error classes (including StepError) | 1.3 | 0.5d | All exported classes have at least 1 use |
| I-14 | Fix 6 circular dependencies | 1.4 | 1d | `madge --circular src/` outputs empty |
| I-15 | Replace 6 console with StructuredLogger | 1.5 | 0.5d | core/ no console calls |
| I-16 | Extract 8 hardcoded URLs to constants | 1.6 | 0.5d | All API URLs centrally managed |
| I-17 | Clean memory subsystem dead code | 1.7 | 0.5d | No unused exported symbols |
| I-18 | Create stable-runner-factory | 1.8 | 1d | Each stable-* CLI ≤15 lines |
| I-19 | Resolve typescript runtime dependency | 1.9 | 0.5d | `npm ls --production` no missing |
| I-38 | Extract magic numbers as named constants | 3.6 | 0.5d | 30000/86400 only in constant definitions |
| I-61 | Extract LLM Provider shared base class | 1B.3 | 2d | Shared code in base class, each Provider <200 lines differential logic |
| I-62 | Unified runtime/ catch blocks use `AppError.wrap()` | 1B.9 | 1d | All catch blocks use `AppError.wrap()` or mark intentional |
| I-63 | Delete domain.ts 17 dead type exports | 1B.13 | 0.5d | All exported types have ≥1 import |
| I-64 | Unified CLI entry error handling (bare `main()` → `.catch()`) | 1B.16 | 30 min | All CLI entries have unified error handling |
| I-65 | Eliminate 6 `.then()` chains | 1B.22 | 30 min | `.then()` only in necessary scenarios like dynamic import |
| I-66 | Centralize `process.env` access to config/ loaders | 1B.18 | 1d | CLI `process.env.` only in top-level `loadXxxEnv()` calls |

### Wave 3: Giant File Splitting (2-3 Weeks)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-20 | Split Phase1aStore into domain repositories | 1.1 | 5d | ≥5 repository classes, each ≤500 lines; `as unknown as` centralized to helper |
| I-21 | Split phase1b-orchestration.ts | 1.2 | 3d | 4 independent modules ≤600 lines |
| I-22 | Split domain.ts | 1.2 | 2d | Split by domain, each ≤400 lines |
| I-23 | Split http-api-server.ts | 1.2 | 2d | Split route modules by resource |
| I-24 | Split edit-replacement-service.ts | 1.2 | 1d | ≤500 lines |
| I-67 | Merge 12 single-file directories | 1B.4 | 1d | No single-file directories; each directory ≥2 files |
| I-68 | Create singleton lifecycle registry | 1B.5 | 2d | All `let xxxInstance` migrated to centralized registry |
| I-69 | Add `dispose()` to DurableEventBus | 1B.6 | 0.5d | After `bus.dispose()` subscriptions cleared, new emit rejected |
| I-70 | Gateway layer decouple Phase1aStore direct dependency | 1B.10 | 1d | `grep -rn "phase1a-store" src/gateway/` returns empty |
| I-73 | Add capacity cap + LRU/TTL for 15+ unbounded Maps | 1B.14 | 2d | All class-level Maps have documented cap strategy |
| I-74 | Establish explicit types for event bus main chain payload | 1B.17 | completed | Completed: Tier 1 / dispatch / worker / recovery / takeover main events use explicit payload types; `GenericEventPayload` no longer default载荷 for main execution chain |

### Wave 4: Testing Completion (Continuous)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-25 | Security module tests (OIDC/secret/API) | 4.1 | 3d | ≥80% line coverage |
| I-26 | Payment module tests | 4.1 | 1d | Core flows covered |
| I-27 | Provider service tests (mock HTTP) | 4.2 | 2d | 3 providers ≥70% coverage |
| I-28 | Coverage gate (c8 + CI) | 4.3 | 0.5d | CI fails if coverage <60% |
| I-29 | execution-* series tests | 4.2 | 3d | dispatch/lease/worker core logic covered |

### Wave 5: Configuration Governance (1 Week)

| ID | Task | Source | Work | Acceptance |
|------|------|------|--------|---------|
| I-30 | Config Zod schema validation | 2.9 | 2d | Startup validation + human-readable errors |
| I-31 | Merge models.json duplication | 2.10 | 0.5d | Single source of truth |
| I-32 | Fix environment configPath | 2.11 | 15 min | Each environment points to correct path |
| I-33 | Division YAML add apiVersion | 2.15 | 15 min | All YAMLs contain `apiVersion: division/v1` |
| I-34 | Division trigger keyword deduplication | 2.16 | 30 min | No ambiguous routing |
| I-35 | Sync Division count docs | 3.2 | 30 min | AGENTS.md matches code |
| I-39 | Enable missing tsconfig strict options | 2.17 | 0.5-1d | Three options enabled + tsc passes |
| I-40 | Create CONTRIBUTING.md | 3.5 | 1h | New developers can contribute following it |
| I-41 | Implement deploy-environment.yml deployment logic | 2.23 | varies | Workflow can execute actual deployment |
| I-42 | Add maxAgentRounds environment variable override | 2.24 | 15 min | AA_MAX_AGENT_ROUNDS can override |
| I-51 | Enrich change_control.md governance doc | 4B.5 | 0.5d | ≥80 lines, includes roles/process/exception handling |
| I-52 | Enrich source_of_truth.md governance doc | 4B.5 | 0.5d | ≥80 lines, includes conflict resolution/ownership/deprecation strategy |
| I-53 | Supplement thin contracts (<50 lines) or mark draft | 4B.7 | 2-3d | All contracts ≥50 lines or marked draft |
| I-54 | Translate 2 new reviews to doc_en/ | 4B.10 | 2-3h | doc/ and doc_en/ file counts match |
| I-55 | Fix doc_en/ translation residue Chinese | 4B.16 | 5 min | No residual Chinese |
| I-56 | Unify contract error_code_registry.md suffix | 4B.12 | 10 min | Suffix unified to `_contract.md` |
| I-57 | Checklist docs add usage guide | 4B.15 | 15 min | Has clear usage instructions |
| I-75 | Add Zod schema validation for 6 POST routes | 1B.7 | completed | Completed: `/v1/auth/token`, gateway send, approval decision, billing reconcile POST routes unified to Zod runtime schema |
| I-76 | Create `withCliStorage()` to eliminate 42 CLI DB init duplication | 1B.8 | completed | Completed: CLI DB initialization样板 unified to `withCliStorage()` / `withCliStorageAsync()` / `withPersistentCliStorage()` |
| I-77 | Eliminate `tools/` to `runtime/` value import cross-layer dependency | 1B.15 | completed | Completed: `grep -rn 'from.*runtime/' src/core/tools/` now only has `import type` |
| I-78 | Add `downSql` rollback field for new migrations | 1B.19 | progressive | Completed baseline: SQLite / PostgreSQL migration definition supplemented with `downSql/downDdl` metadata placeholder, subsequent new migrations must fill in |
| I-79 | Unify stability tool canonical namespace to `stability/` | 1B.21 | completed | Completed: source and test imports unified to `src/core/stability/`, stability tools no longer use `testing/` as main path |

---

## 六、Quantitative Summary

| Severity | Count | Key Issues |
|----------|------|---------|
| **CRITICAL** | 7 | God-class Phase1aStore; security modules no tests; dist path error; index.ts is demo script not barrel; **API Key timing attack**; **HTTP no size limit (DoS)**; **3 Provider 450 lines copy-paste** |
| **HIGH** | 18 | Tests compiled into production; JWT commented; no .env.example; no LICENSE; CI no lint/security scan; .gitignore leaks .env; Dockerfile missing tini/init; 104 absolute path broken links; research/analysis/ detached from navigation; **12 single-file directories**; **12 mutable singletons no unified lifecycle**; **EventBus no dispose**; **API routes no Schema validation**; **42 CLI DB init duplication**; **AppError.wrap() 0% usage**; **Gateway directly depends on Phase1aStore** |
| **MAJOR** | 15 | 89 giant files; 124 type bypasses; 13 dead error classes; 6 circular dependencies; 6 console; 8 hardcoded URLs; 26 CLI样板 duplication; typescript dependency issue; memory dead code; no coverage; model config duplication; configPath misleading; magic numbers; **1080 line God-function**; **domain.ts 17 dead types**; **15+ unbounded caches** |
| **MEDIUM** | 22 | No ESLint; config no schema; CI no matrix/artifacts; tsconfig strict options/redundancy; Division trigger keyword overlap; hardcoded pricing; README structure defects; filename spelling errors; governance docs thin; adr/ no index; contract depth variance; 18_code_architecture anomaly; ADR-072 label conflict; doc_en/ missing translations; **tools/ cross-layer import runtime/**; **23 CLI bare main() no error handling**; **27/38 event types use opaque GenericEventPayload**; **process.env bypasses centralized config**; **migration no rollback**; **safeLoadDivisionRegistry duplication** |
| **LOW** | 15 | compose deprecated syntax/logging; deploy-environment empty shell; Division no apiVersion; table count inconsistent; missing CONTRIBUTING.md; maxAgentRounds no env override; naming convention mix; contract suffix inconsistent; orphan docs; ADR status lacks history; checklist no execution traces; translation residue Chinese; **testing/ directory naming misleading**; **6 .then() chains** |

**Total 77 actionable improvements** (I-01 to I-79, where I-71/I-72 merged into I-21/I-23), arranged in Wave 0-5, estimated total work 9-12 weeks.

---

## 七、Relationship with Previous Improvement Report

This report (`comprehensive_improvement_plan_20260412.md`) focuses on main system **itself** code quality, infrastructure, testing, documentation issues, is an **internal audit** of main system.

Previous report (`improvement_gaps_vs_sys_20260412.md`) focuses on comparison gaps between main and sys, identifying functional modules missing from main (tools/MCP/orchestration/memory/evolution/Gateway/Dashboard etc.).

The two reports complement each other:
- This report's 77 improvements (Wave 0-5) are necessary conditions for **basic engineering health**, where一B section 22 source code architecture issues cover security vulnerabilities, lifecycle management, code duplication, type safety etc. systemic defects
- Previous report's 28 improvements (Phase A-D) are development directions for **functional completeness**
- Recommend executing this report's Wave 0 first (urgent security fixes, including timing attack and DoS vulnerabilities), then Wave 1-2 (basic fixes), finally previous report's Phase A (functional expansion)
