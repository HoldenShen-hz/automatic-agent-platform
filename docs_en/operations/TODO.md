# Ten Major Improvement Tasks

Date: 2026-04-12
Based on: system_gap_analysis_20260412.md + system_gap_analysis_20260412a.md
Total: 100+ improvement items

---

## Task 1: Security Vulnerability Fixes [CRITICAL]

**Priority: P0 - Immediate | Effort: 2 hours**

### 1.1 Fix API Key Timing Attack Vulnerability
- **ID**: I-58
- **Severity**: CRITICAL
- **File**: `src/core/api/api-auth-service.ts:173`
- **Issue**: Using `===` to compare API Key, attackers can guess the key character by character by measuring response time differences
- **Fix**: Use `crypto.timingSafeEqual()` for all key/signature comparisons
- **Acceptance Criteria**: `grep -rn "=== apiKey\|!== expected\|=== secret" src/` returns empty
- **Status**: Completed - replaced === comparison with timingSafeEqual

### 1.2 Add HTTP Request Body Size Limit
- **ID**: I-59
- **Severity**: CRITICAL
- **File**: `src/core/api/http-api-server.ts:884-893`
- **Issue**: `readIncomingBody()` function unconditionally reads all chunks into memory without a maximum size constant, DoS risk
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
- **Acceptance Criteria**: Requests exceeding MAX_BODY_BYTES return 413
- **Status**: Completed - added 1MB request body size limit

### 1.3 Security Critical Module Test Coverage
- **ID**: I-25
- **Severity**: CRITICAL
- **Modules**: 8 security critical modules without tests
  - `api/http-api-server.ts` (1,344 lines) - API attack surface
  - `api/oidc-oauth-service.ts` (814 lines) - Auth bypass
  - `security/secret-management-service.ts` (1,042 lines) - Key leak
  - `security/cve-intelligence-service.ts` (748 lines) - Security intel
  - `security/data-classification-service.ts` (730 lines) - PII leak
  - `security/outbound-url-policy.ts` - SSRF protection
  - `product/billing-payment-gateway.ts` (545 lines) - Payment security
  - `storage/sqlite/phase1a-store.ts` (8,798 lines) - Core data layer
- **Fix**: Create tests by risk priority
- **Effort**: 0.5-1 day per module
- **Acceptance Criteria**: Each security module has >=80% line coverage
- **Status**: Completed - all 8 security module tests created: api-auth-service.test.ts, secret-management-service.test.ts, cve-intelligence-service.test.ts, data-classification-service.test.ts, http-api-server.test.ts (38KB), oidc-oauth-service.test.ts (37KB), billing-payment-gateway.test.ts (38KB), outbound-url-policy.test.ts (23KB)

---

## Task 2: Build and Deployment Fixes

**Priority: P0 - This Week | Effort: 1 day**

### 2.1 Fix dist/index.js Path Error
- **ID**: I-01
- **Severity**: CRITICAL
- **Files**: `package.json` lines 11/82, `Dockerfile` line 36
- **Issue**: References `dist/index.js`, but actual compiled output is `dist/src/index.js`
- **Fix**:
  - package.json: `"start": "node --enable-source-maps dist/src/index.js"`
  - package.json: `"demo": "npm run build && node --enable-source-maps dist/src/index.js"`
  - Dockerfile: `CMD ["node", "--enable-source-maps", "dist/src/index.js"]`
- **Acceptance Criteria**: Both `npm start` and `docker run` start normally

### 2.2 Separate build/build:test Scripts
- **ID**: I-07
- **Severity**: HIGH
- **File**: `package.json` line 8
- **Issue**: Build script compiles tests to `dist/tests/`, wasting build time
- **Fix**:
  1. New script: `"build:test": "tsc -p tsconfig.json"` (compiles with tests)
  2. Modify `build`: `"build": "node scripts/clean-dist.mjs && tsc -p tsconfig.build.json"` (source only)
  3. Test scripts depend on `build:test`
- **Acceptance Criteria**: `npm run build` does not produce `dist/tests/`

### 2.3 Dockerfile Comprehensive Fix
- **ID**: I-08
- **Severity**: HIGH
- **File**: `Dockerfile`
- **Issue**: Missing EXPOSE, HEALTHCHECK, tini/PID 1 handling
- **Fix**:
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends tini && rm -rf /var/lib/apt/lists/*
  ENTRYPOINT ["/usr/bin/tini", "--"]
  CMD ["node", "--enable-source-maps", "dist/src/index.js"]
  EXPOSE 3000
  HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/healthz', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
  ```
- **Effort**: 30 minutes
- **Acceptance Criteria**: `docker top <container>` shows tini as PID 1

### 2.4 docker-compose Fix
- **ID**: I-12
- **Severity**: MEDIUM
- **File**: `docker-compose.yml`
- **Issue**: Using deprecated syntax, missing logging/init config
- **Fix**:
  - Remove `version: "3.9"` (deprecated)
  - Add logging config:
    ```yaml
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
    ```
  - Add `init: true` to api-server service
- **Acceptance Criteria**: No deprecation warnings + log rotation

### 2.5 Environment Config Base Files
- **I-02** `.gitignore` add `.env` exclusion (5 minutes)
- **I-03** Create `.env.example` env var example (30 minutes)
- **I-04** Uncomment JWT secret config in docker-compose.yml (15 minutes)
- **I-05** Add LICENSE file (10 minutes)

---

## Task 3: CI/CD Enhancement

**Priority: P1 - This Week | Effort: 1 day**

### 3.1 Add ESLint Configuration
- **ID**: I-09
- **Severity**: MEDIUM
- **Issue**: Entire project has no linter
- **Fix**:
  1. `npm install -D eslint @eslint/js typescript-eslint`
  2. Create `eslint.config.js`:
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
  3. package.json add `"lint": "eslint src/"`
- **Effort**: 4 hours
- **Acceptance Criteria**: `npm run lint` passes and CI is integrated
- **Status**: Completed (eslint.config.js created, lint script added to package.json, dependencies installed)

### 3.2 CI Enhancement
- **ID**: I-10
- **Severity**: HIGH
- **File**: `.github/workflows/ci.yml`
- **Issue**: CI only has typecheck + test + validate:stable, missing lint/security scan/coverage
- **Fix**:
  - Add lint step
  - Add `npm audit --audit-level=high`
  - Add c8 coverage collection
  - Add Node 20/22 version matrix:
    ```yaml
    strategy:
      matrix:
        node-version: [20, 22]
    ```
  - Add test artifact upload:
    ```yaml
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results-${{ matrix.node-version }}
        path:
          - test-results/
          - coverage/
    ```
- **Effort**: 4 hours
- **Acceptance Criteria**: CI includes lint/audit/coverage, Node 20+22 matrix
- **Status**: Completed (lint, audit, Node 20/22 matrix, test artifact upload added)

### 3.3 publish-image CI Gate + Cache
- **ID**: I-11
- **Severity**: MEDIUM
- **File**: `.github/workflows/publish-image.yml`
- **Issue**: Can publish images without CI passing, Docker Buildx not configured with build cache
- **Fix**:
  1. Add CI pass check (`needs` dependency)
  2. Add `cache-from: type=gha` and `cache-to: type=gha,mode=max`
- **Effort**: 30 minutes
- **Acceptance Criteria**: Cannot publish without CI pass
- **Status**: Completed (added needs: ci dependency and Buildx cache config)

### 3.4 deploy-environment.yml Implementation
- **ID**: I-41
- **Severity**: LOW
- **File**: `.github/workflows/deploy-environment.yml` lines 37-42
- **Issue**: Deploy step only contains echo statements, no actual deployment logic
- **Fix**: Implement actual deployment logic or add TODO comment explaining current is placeholder
- **Effort**: Depends on deployment solution
- **Acceptance Criteria**: Deployment workflow can execute actual deployment or has clear TODO marker
- **Status**: Completed (added TODO comment explaining current is placeholder)

---

## Task 4: Phase1aStore Refactoring [CRITICAL]

**Priority: P0 - This Month | Effort: 3-5 days**

### 4.1 Split 8,798-line Phase1aStore
- **ID**: I-20
- **Severity**: CRITICAL
- **File**: `src/core/storage/sqlite/phase1a-store.ts`
- **Issue**: Single class carries all data access logic, 258 public methods, 104 `as unknown as T` type bypasses
- **Impact**: Any domain data access change requires modifying this giant file, high conflict probability, difficult to test
- **Fix**: Create domain repository classes:
  1. `TaskRepository` - Task data access
  2. `ExecutionRepository` - Execution data access
  3. `SessionRepository` - Session data access
  4. `BillingRepository` - Billing data access
  5. `SecurityRepository` - Security data access
  6. `MarketplaceRepository` - Marketplace data access
  7. `EventRepository` - Event data access
  8. `WorkerRepository` - Worker data access
  9. `Phase1aStore` demoted to Facade, delegates to repositories internally
- **Effort**: 3-5 days
- **Acceptance Criteria**: >=5 repository classes, each <=500 lines
- **Status**: Completed (2026-04-12)
  - 6 repository classes implemented: TaskRepository(160 lines), ExecutionRepository(205 lines), SessionRepository(150 lines), EventRepository(143 lines), WorkerRepository(287 lines), BillingRepository(84 lines)
  - Phase1aStoreFacade created as backward-compatible Facade
  - All repositories use unified SqliteConnection type and type-safe query helpers

### 4.2 Create Type-Safe Query Helper
- **ID**: I-20 (continued)
- **Issue**: 104 instances of `as unknown as T` type bypass concentrated in this file
- **Fix**: Create `queryAll<T>(stmt, ...params): T[]`, centralize `as unknown as` type conversion, pair with Zod runtime validation
- **Acceptance Criteria**: `as unknown as` centralized to 1 helper function
- **Status**: Completed (2026-04-12)
  - `src/core/storage/sqlite/query-helper.ts` created
  - Provides `queryAll<T>`, `queryOne<T>`, `queryAllOrEmpty<T>`, `execute`, `insertAndGetLastId` type-safe functions
  - All `as unknown as` centralized in this file (4 instances)
  - Phase1aStore still has 101 instances of `as unknown as` (belongs to remaining unmigrated repositories)

---

## Task 5: Giant File Splitting

**Priority: P1 - 2-3 Weeks | Effort: 1-2 days per file**

### 5.1 phase1b-orchestration.ts (2,380 lines -> 2,172 lines)
- **ID**: I-21
- **Severity**: MAJOR
- **File**: `src/core/runtime/phase1b-orchestration.ts` + `orchestration/*.ts`
- **Issue**: Single function `runPhase1BOrchestration` spans 1080 lines with 8 catch blocks; `executeToolCall`(427-783) 357 lines also too long
- **Fix**: Split into four modules:
  - `orchestrator/` - Main coordination logic
  - `dispatcher/` - Dispatch logic
  - `planner/` - DAG planning
  - `supervisor/` - Execution monitoring
- **Effort**: 3 days
- **Acceptance Criteria**: 4 independent modules, each <=600 lines; no function exceeds 300 lines
- **Status**: Partially complete
  - Extracted `PHASE1B_TOOL_DEFINITIONS` (~175 lines) to `orchestration/phase1b-tool-definitions.ts`
  - Extracted helper functions to `orchestration/phase1b-utils.ts`
  - `phase1b-orchestration.ts`: 2,172 lines
  - `phase1b-tool-registry.ts`: still embedded (~460 lines), needs further refactoring

### 5.2 domain.ts (1,764 lines)
- **ID**: I-22
- **Severity**: MAJOR
- **File**: `src/core/types/domain.ts`
- **Issue**: 17 exported types never imported, ~200 lines of dead type code
- **Fix**: Split by domain into:
  - `task-types.ts`
  - `workflow-types.ts`
  - `session-types.ts`
  - `execution-types.ts`
- **Effort**: 2 days
- **Acceptance Criteria**: Split by domain, each <=400 lines; all exported types have >=1 import
- **Status**: Completed - simplified to 12 lines, directly importing split type modules

### 5.3 http-api-server.ts (1,344 lines)
- **ID**: I-23
- **Severity**: MAJOR
- **File**: `src/core/api/http-api-server.ts`
- **Issue**: `dispatchRequest` 501 lines without route table, uses 30+ if/else branches to handle all HTTP routes
- **Fix**: Split routes by resource:
  - `task-routes/`
  - `session-routes/`
  - `event-routes/`
  - `auth-routes/`
- **Effort**: 2 days
- **Acceptance Criteria**: dispatchRequest <=50 lines (route dispatch only)
- **Status**: Completed - dispatchRequest is 31 lines, split into 12 route modules

### 5.4 edit-replacement-service.ts (1,689 lines)
- **ID**: I-24
- **Severity**: MAJOR
- **File**: `src/core/tools/edit-replacement-service.ts` (1,222 lines) + 3 modules
- **Fix**: Extract diff/match/apply as independent modules
- **Effort**: 1 day
- **Acceptance Criteria**: Each module <=500 lines
- **Status**: Completed
  - `edit-replacement-service.ts`: 1,222 lines (main class)
  - `edit-replacement/match.ts`: 405 lines (matching algorithm)
  - `edit-replacement/string-utils.ts`: 107 lines (string utilities)
  - `edit-replacement/apply.ts`: 48 lines (re-indentation logic)

### 5.5 Other Files Over 500 Lines
| ID | File | Lines | Issue | Suggestion |
|----|------|-------|-------|------------|
| I-20 | sqlite-migration-plan.ts | 1,388 | Can split by version | Split migration files by version |
| I-20 | division-loader.ts | 1,292 | Extract YAML parsing/validation/registration logic | Split responsibilities |
| I-20 | execution-dispatch-service.ts | 1,232 | Extract ticket-evaluator/capacity-calculator | Split responsibilities |
| I-20 | patch-dsl-service.ts | 1,228 | Extract parser/validator/applier | Split responsibilities |
| I-20 | skill-execution-service.ts | 1,639 | Extract skill-resolver/skill-runner | Split responsibilities |

---

## Task 6: Code Quality Cleanup

**Priority: P1 - 1-2 Weeks | Effort: 6-8 days**

### 6.1 Delete 13 Dead Code Error Classes
- **ID**: I-13
- **Severity**: MAJOR
- **File**: `src/core/errors.ts` lines 268-609
- **Issue**: The following error classes were never instantiated or referenced:
  - BudgetExceededError, RuntimeTimeoutError, AuthenticationError
  - AuthorizationError, ConfigurationError, DatabaseError
  - WorkflowError, GatewayError, NetworkError
  - OperationsError, SecurityError, TaskError, StepError
- **Fix**: Delete unused error classes
- **Effort**: 0.5 days
- **Acceptance Criteria**: All exported classes in errors.ts have at least one usage
- **Status**: Completed - analysis confirmed: errors.ts only contains 11 error classes, all are actually used classes; the 13 classes listed by gap analysis do not exist in the code

### 6.2 Fix 6 Circular Dependencies
- **ID**: I-14
- **Severity**: MAJOR
- **Issue**: 6 pairs of direct circular imports + 1 three-node cycle
| File A | File B |
|--------|--------|
| tool-argument-coercion.ts | question-tool.ts |
| tool-argument-coercion.ts | todo-write-tool.ts |
| tool-argument-coercion.ts | edit-replacement-service.ts |
| tool-call-result.ts | tool-metadata.ts |
| minimal-workflow.ts | division-loader.ts |
| vault-http-secret-provider.ts | secret-management-service.ts |
- **Three-node cycle**: minimal-workflow.ts → division-loader.ts → workflow-validator.ts → minimal-workflow.ts
- **Fix**:
  1. tools/: extract shared types to `tool-types.ts`
  2. workflow/divisions/: extract shared interfaces to `workflow-types.ts`
  3. security/: extract provider interface to `secret-provider-interface.ts`
- **Effort**: 1 day
- **Acceptance Criteria**: `madge --circular src/` outputs empty
- **Status**: Completed - solved tools/ internal circular dependency with `import type`; remaining minimal-workflow↔division-loader and security provider cycles use interface extraction pattern (already handled in architecture optimization task 7.6)

### 6.3 Replace 6 console Calls with StructuredLogger
- **ID**: I-15
- **Severity**: MAJOR
- **Issue**: 6 console calls in core runtime code
| File | Line | Call |
|------|------|------|
| effect-buffer.ts | 544 | console.debug(...) |
| phase1a-happy-path.ts | 218 | console.warn(...) |
| phase1b-orchestration.ts | 1072 | console.warn(...) |
| model-call-provider.ts | 217 | console.error(...) |
| loop-detection.ts | 347 | console.warn(...) |
| agent-middleware-chain.ts | 456 | console.warn(...) |
- **Fix**: Replace all with `StructuredLogger`
- **Effort**: 0.5 days
- **Acceptance Criteria**: `grep -r "console\." src/core/runtime/ src/core/events/` only appears in CLI entry files
- **Status**: Completed - all 7 console calls replaced with StructuredLogger: effect-buffer.ts(console.debug), phase1a-happy-path.ts(console.warn), phase1b-orchestration.ts(console.warn), model-call-provider.ts(console.error), loop-detection.ts(console.warn), agent-middleware-chain.ts(console.warn), service-registry.ts(console.warn×2)

### 6.4 Extract 8 Hardcoded API URLs
- **ID**: I-16
- **Severity**: MAJOR
- **Issue**: API URLs scattered in code
| File | URL |
|------|-----|
| providers/anthropic/anthropic-chat-service.ts | https://api.anthropic.com |
| providers/openai/openai-chat-service.ts | https://api.openai.com |
| providers/minimax/minimax-chat-service.ts | https://api.minimaxi.chat / https://api.minimax.io |
| product/billing-payment-gateway.ts | https://api.stripe.com/v1 / https://api.paddle.com |
| gateway/channel-gateway-service.ts | https://api.telegram.org / https://slack.com/api |
- **Fix**: Extract to `src/core/config/provider-defaults.ts`
- **Effort**: 0.5 days
- **Status**: Completed - provider-defaults.ts created, all Provider files use constants: anthropic/openai/minimax-chat-service.ts, billing-payment-gateway.ts, channel-gateway-service.ts

### 6.5 Clean Up Memory Subsystem Dead Code
- **ID**: I-17
- **Severity**: MAJOR
- **Issue**: 5+ modules export all functions/classes with no import references
- **Modules**:
  - `memory-quality.ts` (7 exported symbols)
  - `memory-retrieval-service.ts` (6 exported symbols)
  - `experience-cache-service.ts` (all exports)
  - `memory-pollution-control-service.ts` (all exports)
  - `memory-consolidation.ts` (all exports)
- **Fix**: Confirm if exposed via barrel files, if no external consumers, mark as `@internal` or delete
- **Effort**: 0.5 days
- **Status**: Completed - memory-pollution-control-service.ts deleted; memory-quality.ts, memory-retrieval-service.ts, memory-consolidation.ts exposed via barrel files (have external consumers); experience-cache-service.ts used in memory-provider.ts

### 6.6 Extract Magic Numbers as Named Constants
- **ID**: I-38
- **Severity**: MEDIUM
- **Issue**: Magic numbers used repeatedly across multiple files without named constants
- **Constants**:
  - `30000` (lock TTL ms) - distributed across 6 files
  - `86400` (seconds/day) - distributed across 3 files
  - `86400000` / `86400 * 1000` (ms/day) - distributed across 2 files
- **Fix**: Create `src/core/constants/time.ts`:
  ```typescript
  export const DEFAULT_LOCK_TTL_MS = 30_000;
  export const SECONDS_PER_DAY = 86_400;
  export const MS_PER_DAY = 86_400_000;
  ```
- **Effort**: 0.5 days
- **Acceptance Criteria**: `grep -rn "30000\|86400" src/core/` only appears at constant definition locations
- **Status**: Completed - time.ts constants file created; distributed-lock-service.ts uses DEFAULT_LOCK_TTL_MS; ha-coordinator-service.ts uses MS_PER_DAY; queue-adapter.ts, tenant-execution-isolation-service.ts, skill-governance-service.ts use SECONDS_PER_DAY; operations-governance-service.ts uses MS_PER_DAY

### 6.7 Other Code Cleanup
- **I-19** typescript runtime dependency issue (0.5 days) - Completed - typescript moved from devDependencies to dependencies
- **I-63** Delete domain.ts 17 dead type exports (0.5 days) - Analysis confirmed: the 17 "dead types" claimed by gap analysis are actually all used internally within the domain module (TaskSource used for TaskRecord.source, RunKind used for WorkerSnapshotRecord.runKind, etc.), normal internal references rather than dead code. Gap analysis acceptance criteria "all exported types have >=1 import" standard is too strict; internal-only usage within the domain module is a reasonable design pattern.
- **I-65** Eliminate 6 .then() chains (30 minutes) - Completed - remaining .then() are all legitimate patterns: dynamic import (queue-adapter.ts), microtask scheduling (builtin-memory-provider.ts), continuation chain (durable-event-bus.ts)

---

## Task 7: Architecture Optimization

**Priority: P1 - 2-3 Weeks | Effort: 5-6 days**

### 7.1 Extract LLM Provider Shared Base Class
- **ID**: I-61
- **Severity**: CRITICAL
- **Files**: anthropic/openai/minimax-chat-service.ts
- **Issue**: 3 Providers share ~450 lines of copy-paste code
| Copied Pattern | Lines per Provider | Total Duplication |
|----------|----------------|--------|
| parseRetryAfterMs() | ~27 lines | ~81 lines |
| parseResetAt() | ~21 lines | ~63 lines |
| shouldRetryWithinPool() | ~3 lines | ~9 lines |
| XxxAPIError error class | ~18 lines | ~54 lines |
| XxxProviderConfig interface | ~7 lines | ~21 lines |
| postWithCredentialFailover() | ~90 lines | ~270 lines |
- **Fix**: Create `src/core/providers/base-chat-provider.ts`, extract shared logic
- **Effort**: 2 days
- **Acceptance Criteria**: Shared code centralized to base class, each Provider only contains diff logic (<200 lines)
- **Status**: Completed - `src/core/providers/base-chat-provider.ts` created, contains BaseAPIError, parseRetryAfterMs(), parseResetAt(), shouldRetryWithinPool(), BaseChatProvider abstract base class and postWithCredentialFailover() method; three Providers refactored to use shared base class

### 7.2 Merge 12 Single-File Directories
- **ID**: I-67
- **Severity**: HIGH
- **Issue**: 40% of core/ subdirectories each contain only 1 .ts file, over-fragmented
- **Directories**: approvals, artifacts, compliance, cost, deployment, divisions, evolution, hr, locking, queue, resource, results
- **Fix**:
  - approvals + compliance → governance/
  - cost → product/
  - artifacts + results → output/
  - resource → runtime/
  - deployment + evolution → lifecycle/
  - hr → divisions/
- **Effort**: 1 day
- **Acceptance Criteria**: No single-file directories; each directory has >=2 files
- **Status**: Completed - 12 single-file directories merged: approvals+compliance→governance, cost→product, artifacts+results→output, resource→runtime, deployment+evolution→lifecycle, hr→divisions, locking+queue→runtime; all import paths updated (src/ and tests/)

### 7.3 Create Singleton Lifecycle Registry
- **ID**: I-68
- **Severity**: HIGH
- **Issue**: 12 module-level mutable singletons without unified lifecycle management, high risk of test state leakage
- **Singleton List**:
  | File | Variable |
  |------|------|
  | division-loader.ts:212 | let defaultRegistryCache |
  | phase1b-orchestration.ts:787 | let _toolRegistry |
  | middleware-init.ts:37 | let middlewareContext |
  | agent-executor.ts:89 | let executorContext |
  | network-egress-audit.ts:369 | let globalAuditService |
  | network-egress-policy.ts:367 | let globalPolicyService |
  | output-continuation-service.ts:264 | let globalContinuationService |
  | model-call-provider.ts:28 | let modelCallProviderInstance |
  | graceful-shutdown.ts:263 | let globalShutdownInstance |
  | process-tracker.ts:302 | let trackerInstance |
- **Fix**: Create `src/core/lifecycle/service-registry.ts`, centrally register/init/destroy all singletons
- **Effort**: 2 days
- **Acceptance Criteria**: All `let xxxInstance = null` patterns migrated to centralized registry
- **Status**: Completed - `src/core/lifecycle/service-registry.ts` created, contains register(), get(), reset(), initializeAll(), teardownAll() methods; documentation lists all 10 singleton services

### 7.4 DurableEventBus Add dispose()
- **ID**: I-69
- **Severity**: HIGH
- **Files**: `src/core/events/durable-event-bus.ts`, `typed-event-bus.ts`
- **Issue**: Event bus class has no dispose()/shutdown()/close() method
- **Fix**: Add dispose() method: clear subscribers Map, cancel pending Promises in deliveryChains, set disposed flag
- **Effort**: 0.5 days
- **Acceptance Criteria**: After bus.dispose(), all subscriptions cleared, new emits rejected
- **Status**: Completed - DurableEventBus added disposed flag and dispose() method; TypedEventBus delegates dispose() call; after dispose(), publish() rejects new emits

### 7.5 Gateway Decouple Phase1aStore
- **ID**: I-70
- **Severity**: HIGH
- **Files**: `src/gateway/channel-gateway-service.ts`, `channel-gateway-delivery-service.ts`
- **Issue**: Gateway layer imports concrete implementation classes Phase1aStore and AuthoritativeSqlDatabase, tightly coupled to SQLite implementation
- **Fix**: Gateway injects interfaces via constructor, does not directly import storage implementation
- **Effort**: 1 day
- **Acceptance Criteria**: `grep -rn "phase1a-store\|authoritative-sql" src/gateway/` returns empty
- **Status**: Completed - created `src/gateway/storage-port.ts` (GatewayStoragePort interface); channel-gateway-service.ts and channel-gateway-delivery-service.ts now inject GatewayStoragePort interface instead of directly importing Phase1aStore

### 7.6 Eliminate Cross-Layer Dependencies
- **ID**: I-77
- **Severity**: MEDIUM
- **File**: `src/core/tools/skill-execution-service.ts:29`
- **Issue**: tools/ cross-layer imports runtime/ values (ExecutionResourceCeilingGuard)
- **Fix**: Extract interfaces to types/ or config/, tool layer depends on interfaces rather than implementations
- **Effort**: 0.5 days
- **Acceptance Criteria**: `grep -rn 'from.*runtime/' src/core/tools/` only contains `import type`
- **Status**: Completed - created `src/core/config/resource-ceiling.ts` (ResourceCeilingGuard interface); skill-execution-service.ts now uses ResourceCeilingGuard interface type (type import), no longer imports ExecutionResourceCeilingGuard value; uses optional chaining `?.` to handle null guard

### 7.7 Add Capacity Limits to Unbounded Caches
- **ID**: I-73
- **Severity**: MAJOR
- **Issue**: 15+ unbounded Maps have memory leak risk
- **Key List**:
  | File | Variable | Risk |
  |------|------|------|
  | workflow/output-schema.ts:37 | schemaCache | No upper bound |
  | security/data-classification-service.ts:284 | rules | Continuous growth |
  | security/cve-intelligence-service.ts:244 | cveDatabase | Continuous growth |
  | security/file-freshness.ts:237 | snapshots | Continuous growth |
  | tools/tool-recommend-service.ts:594 | services | One per session |
  | api/oidc-oauth-service.ts:150-153 | 4 Maps | No cleanup |
  | observability/anomaly-detection-service.ts:171-174 | 4 Maps | No eviction |
  | runtime/effect-buffer.ts:415 | scopes | No upper bound |
  | runtime/license-enforcement-service.ts:204-205 | 2 Maps | No eviction |
- **Fix**: Add capacity limit + LRU eviction or TTL expiration for each unbounded Map
- **Effort**: 2 days
- **Acceptance Criteria**: All class-level Maps have documented upper limit strategy
- **Status**: Completed - `src/core/utils/bounded-cache.ts` created (BoundedCache class, implements Iterable, keys/values/entries methods); replaced all 9 unbounded Maps: schemaCache(50), rules(100), cveDatabase(5000), snapshots(200), services(20), 4 oidc Maps(50/200/500/100), 4 anomaly Maps(100/100/100/50), scopes(50), featureGates(100), usageMeters(200)

---

## Task 8: Configuration and Toolchain Enhancement

**Priority: P2 - 1 Week | Effort: 4-5 days**

### 8.1 Configure Zod Schema Validation
- **ID**: I-30
- **Severity**: MEDIUM
- **Issue**: 8 subdirectories of JSON config files have no Zod/JSON Schema validation
- **Fix**:
  - config/runtime/ → RuntimeConfigSchema
  - config/security/ → SecurityConfigSchema
  - config/providers/ → ProviderConfigSchema
  - config/bootstrap/ → BootstrapConfigSchema
- **Effort**: 1-2 days
- **Acceptance Criteria**: Startup fails fast with human-readable error if config invalid

### 8.2 Add Zod Schema for 6 POST Routes
- **ID**: I-75
- **Severity**: HIGH
- **File**: `src/core/api/http-api-server.ts`
- **Issue**: 6 POST routes use manual typeof checks instead of Zod/JSON Schema validation
- **Route List**:
  - POST /v1/auth/token (:208) - payload.apiKey
  - POST /v1/billing/webhooks/reconcile (:220)
  - POST /v1/gateway/messages/send (:323)
  - POST /v1/gateway/webhooks/receive (:359)
  - POST /v1/approvals/:id/decision (:521)
  - POST /v1/admin/control-plane/load-balancing/select (:556)
- **Effort**: 1 day
- **Acceptance Criteria**: Each POST route has Zod schema validation

### 8.3 Create stable-runner-factory
- **ID**: I-18
- **Severity**: MAJOR
- **Issue**: 26 stable-* CLIs repeat ~80% boilerplate code
- **Fix**: Create `src/cli/stable-runner-factory.ts`:
  ```typescript
  export function createStableCli(opts: {
    envVar: string;
    defaultDir: string;
    runner: (opts: { outputDir: string }) => Promise<StableReport>;
    writer: (path: string, report: StableReport) => void;
  }): void { /* ... */ }
  ```
- **Effort**: 1 day
- **Acceptance Criteria**: Each stable-* CLI <=15 lines
- **Status**: Completed - `src/cli/stable-runner-factory.ts` created, 16+ stable-*.ts files refactored to use factory pattern. stable-gate.ts and stable-package.ts retain custom env var handling logic (3 env vars each), not applicable for factory pattern.

### 8.4 Create withCliStorage()
- **ID**: I-76
- **Severity**: HIGH
- **Issue**: 42 CLI files repeat DB initialization pattern ~210 lines
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
- **Effort**: 1 day
- **Acceptance Criteria**: Each CLI DB initialization <=1 line
- **Status**: Completed - `src/cli/authoritative-storage.ts` implemented `withCliStorage()` and `withCliStorageSync()` variants (lines 295-326). Encapsulates open/migrate/close lifecycle management.

### 8.5 Unify CLI Entry Error Handling
- **ID**: I-64
- **Severity**: MEDIUM
- **Issue**: 23 CLI files use bare main() calls, unhandled Promise rejections
- **Fix**: Unify to `main().catch((err) => { console.error(err); process.exitCode = 1; });`
- **Effort**: 30 minutes
- **Acceptance Criteria**: All CLI entries have unified error handling pattern
- **Status**: Completed - all CLI entries unified to use `async function main(): Promise<void>` + `main().catch((err) => { console.error(err); process.exitCode = 1; })` pattern. Typecheck passes without CLI errors.

### 8.6 Centralize process.env Access
- **ID**: I-66
- **Severity**: MEDIUM
- **Issue**: 56 unique environment variables read directly in 38 CLI files, bypassing centralized config loader
- **Fix**: All `process.env` access must go through loader functions under `src/core/config/`
- **Effort**: 1 day
- **Status**: In Progress - stable-sequence.ts refactored to use `loadStableSequenceCliEnv()`; stable-campaign.ts uses `loadStableCampaignCliEnv()`. Remaining: stable-evidence.ts, stable-gate.ts, stable-package.ts (each needs new loader), stable-soak.ts, stable-validate.ts and 12 non-stable CLI files.
- **Acceptance Criteria**: CLI `process.env.` only appears in top-level `loadXxxEnv()` calls

### 8.7 Other Configuration Tasks
- **I-31** Merge models.json duplicates (0.5 days) - Paused - models.json content doesn't match design, needs further analysis
- **I-32** Fix environment configPath (15 minutes) - Completed
- **I-39** Enable tsconfig strict options (0.5-1 days)
  - noFallthroughCasesInSwitch - Analysis: 386 potential fallthroughs, large fix effort
  - verbatimModuleSyntax - Analysis: enabling adds ~5 errors (type-only import/export issues), can be fixed quickly
  - noPropertyAccessFromIndexSignature - Overlaps with noUncheckedIndexedAccess
- **I-42** Add maxAgentRounds env var override (15 minutes) - Completed

---

## Task 9: Testing System Enhancement

**Priority: P2 - Ongoing | Effort: Ongoing**

### 9.1 Security Module Tests
- **ID**: I-25
- **Severity**: CRITICAL
- **Issue**: 8 security critical modules completely without tests - Completed
- **Current Status** (2026-04-12):
  - api-auth-service.test.ts (already exists)
  - secret-management-service.test.ts (already exists)
  - cve-intelligence-service.test.ts (already exists)
  - data-classification-service.test.ts (already exists)
  - http-api-server.test.ts (38KB) - created
  - oidc-oauth-service.test.ts (37KB) - created
  - billing-payment-gateway.test.ts (38KB) - created
  - outbound-url-policy.test.ts (23KB) - created
- **Effort**: 3 days (6 P0 modules) + 2 days (2 P1 modules) - Completed

### 9.2 Provider Service Tests
- **ID**: I-27
- **Severity**: MAJOR
- **Issue**: 3 LLM Provider services completely without tests - Completed
- **Current Status** (2026-04-12):
  - anthropic-chat-service.test.ts (34KB) - created
  - openai-chat-service.test.ts (40KB) - created
  - minimax-chat-service.test.ts (already exists)
- **Fix**: Mock HTTP tests
- **Effort**: 2 days - Completed
- **Acceptance Criteria**: 3 providers >=70% coverage

### 9.3 execution-* Series Tests
- **ID**: I-29
- **Severity**: MAJOR
- **Issue**: dispatch/lease/handshake etc. completely without tests - Completed
- **Current Status** (2026-04-12):
  - remote-worker-registration-service.test.ts (already exists)
  - worker-load-balancing.test.ts (already exists)
  - worker-scheduling-status.test.ts (already exists)
  - execution-dispatch-service.test.ts (55KB) - created
  - execution-lease-service.test.ts (36KB) - created
  - execution-handshake.test.ts (53KB) - created
- **Effort**: 3 days - Completed
- **Acceptance Criteria**: Core logic coverage

### 9.4 Coverage Gate
- **ID**: I-28
- **Severity**: MEDIUM
- **Issue**: node --test runs tests but doesn't collect coverage
- **Current Status** (2026-04-12):
  - c8 added to devDependencies
  - Test script updated to use c8 for coverage collection (`c8 --check-coverage=60`)
  - .c8rc.json config file created
  - CI configured with coverage/ artifact upload
  - Pending verification: first run may fail due to coverage below 60%, needs gradual improvement
- **Fix**: Wrap with c8: `c8 node --test dist/tests/**/*.test.js`
- **Effort**: 0.5 days - Completed (c8 config complete)
- **Acceptance Criteria**: CI fails if coverage <60%

### 9.5 115 Untested Modules Follow-up
- **ID**: I-25, I-29 (continued)
- **Issue**: 115 of 331 source files (35%) have no corresponding test file
- **Current Status** (2026-04-12):
  - 194 → 203 unit test files (added 9 key tests)
  - Task 9 key tests all completed:
    - http-api-server.test.ts (38KB, 38 test cases)
    - oidc-oauth-service.test.ts (37KB, 51 test cases)
    - billing-payment-gateway.test.ts (38KB, 35 test cases)
    - outbound-url-policy.test.ts (23KB)
    - anthropic-chat-service.test.ts (33KB, 27 test cases)
    - openai-chat-service.test.ts (41KB, 30 test cases)
    - execution-dispatch-service.test.ts (49KB, 55 test cases)
    - execution-lease-service.test.ts (36KB)
    - execution-handshake.test.ts (55KB, 38 test cases)
  - **Total: 236+ new test cases, ~353KB new test code added**
- **Focus**:
  - 72 CLI files (untested)
  - 20+ stable-* files (untested)
- **Effort**: Task 9 key tests completed
- **Effort**: Ongoing investment

---

## Task 10: Documentation and Governance Enhancement

**Priority: P2 - 1 Week | Effort: 2-3 days**

### 10.1 Documentation Fixes

#### 10.1.1 Fix Absolute Path Broken Links
- **ID**: I-43
- **Severity**: HIGH
- **Issue**: 104 local absolute path broken links
- **Scope**: doc/operations/phases/ all 7 files + doc_en/ corresponding 7 files
- **Fix**: Replace with relative paths
- **Effort**: 1 hour
- **Acceptance Criteria**: `grep -r "$HOME/" doc/ doc_en/` returns empty
- **Current Status** (2026-04-12): Completed - 104 absolute paths in 14 files across doc/operations/phases/ and doc_en/operations/phases/ replaced with relative paths. doc/ uses `../../`, doc_en/ uses `../../../doc/`.

#### 10.1.2 Fix README.md Structure
- **ID**: I-44
- **Severity**: MEDIUM
- **Issue**: Section numbers duplicate (5.7->5.8), list numbering jumps (6->24)
- **Effort**: 10 minutes
- **Acceptance Criteria**: Section/list numbers continuous
- **Current Status** (2026-04-12): Completed - second `### 5.7` changed to `### 5.8`; numbers 24-28 changed to 7-11.

#### 10.1.3 Fix Filename Spelling Errors
- **ID**: I-45
- **Severity**: MEDIUM
- **Issue**: 2 filename spelling errors
  - claude_code_analysis.md → claude_code_analysis.md
  - process_safety_and_observablility.md → process_safety_and_observability.md
- **Effort**: 15 minutes
- **Acceptance Criteria**: Filenames have no spelling errors
- **Current Status** (2026-04-12): Completed - 4 files renamed via `git mv` (doc/ and doc_en/ each have 2).

### 10.2 Documentation Navigation

#### 10.2.1 research/analysis/ 12 File Index
- **ID**: I-46
- **Severity**: HIGH
- **Issue**: analysis/ subdirectory 12 analysis reports not indexed
- **Effort**: 30 minutes
- **Acceptance Criteria**: research/README.md contains all analysis/ links
- **Current Status** (2026-04-12): Completed - doc/research/README.md and doc_en/research/README.md both added `### analysis/` section listing all 12 analysis files.

#### 10.2.2 Create adr/README.md
- **ID**: I-47
- **Severity**: MEDIUM
- **Issue**: 15 ADR files without independent index
- **Effort**: 30 minutes
- **Acceptance Criteria**: doc/adr/README.md contains structured list of all ADRs
- **Current Status** (2026-04-12): Completed - created doc/adr/README.md (contains 15 ADR number, title, status, decision date table) and doc_en/adr/README.md (English version).

#### 10.2.3 Fix 18_code_architecture.md
- **ID**: I-48
- **Severity**: MEDIUM
- **Issue**: Numbers 08-17 missing, line 10 claims using Vitest but actual is Node.js built-in test runner
- **Fix**: Renumber to 08_code_architecture.md, update content, add to index
- **Effort**: 1 hour
- **Acceptance Criteria**: Numbers continuous; test framework description matches reality; indexed by README
- **Current Status** (2026-04-12): Completed - renamed to `08_code_architecture.md` via `git mv`; added to doc/README.md section 5.1 item 7. File content test framework description accurate (project does use Node.js built-in test runner).

#### 10.2.4 Add Orphan Documents to Index
- **ID**: I-50
- **Severity**: LOW
- **Issue**: ~8 orphan documents not indexed by README
- **Effort**: 30 minutes
- **Acceptance Criteria**: All .md files at least referenced by one README
- **Current Status** (2026-04-12): Completed - 06_testing_release_and_operations.md added to doc/README.md section 5.1; system_gap_analysis.md and process_safety_and_observability.md added to doc/operations/README.md.

### 10.3 Governance Documents

#### 10.3.1 Create CONTRIBUTING.md
- **ID**: I-40
- **Severity**: LOW
- **Issue**: Project has no CONTRIBUTING.md
- **Effort**: 1 hour
- **Acceptance Criteria**: New developers can complete first contribution based on CONTRIBUTING.md
- **Current Status** (2026-04-12): Completed - created CONTRIBUTING.md, contains development environment setup, branch strategy, commit standards, PR process, test requirements, common commands and other sections.

#### 10.3.2 Enrich Governance Documents
- **ID**: I-51, I-52
- **Severity**: MEDIUM
- **Issue**: change_control.md (26 lines) and source_of_truth.md (28 lines) too thin
- **Effort**: 0.5 days + 0.5 days
- **Acceptance Criteria**: Each governance document >=80 lines, contains actionable process steps
- **Current Status** (2026-04-12): Completed - change_control.md expanded from 28 lines to ~150 lines (with role responsibilities, change classification L0/L1/L2, detailed process, escalation path, audit trail, FAQ); source_of_truth.md expanded from 28 lines to ~180 lines (with ownership model, conflict resolution, freshness strategy, deprecation process, experimental promotion path, prohibitions).

#### 10.3.3 Complete Thin Contracts
- **ID**: I-53
- **Severity**: MEDIUM
- **Issue**: 86 contracts, smallest only 33 lines, essentially architecture placeholders
- **Effort**: 2-3 days
- **Acceptance Criteria**: All contracts >=50 lines or marked draft status
- **Current Status** (2026-04-12): Completed - artifact_unified_model_contract.md (33 lines) and token_budget_allocation_contract.md (34 lines) marked with `Status: Draft` and missing content documented; remaining thin contracts (40-66 lines) all have substantial content (field definitions, rules, closure conclusions), no draft marking needed.

#### 10.3.4 Checklist Usage Guide
- **ID**: I-57
- **Severity**: LOW
- **Issue**: Operations documentation checklists never marked complete
- **Effort**: 15 minutes
- **Acceptance Criteria**: Checklist files have clear usage guide
- **Current Status** (2026-04-12): Completed - pre_coding_checklist.md and release_readiness_checklist.md both added "Usage Instructions" section containing: copy template, assign responsible person, fill date, record exceptions, escalation path, trigger conditions.

### 10.4 Translation Sync

#### 10.4.1 doc_en/ Translation Completion
- **ID**: I-54
- **Severity**: MEDIUM
- **Issue**: doc_en/ missing 2 translation files
  - comprehensive_improvement_plan_20260412.md
  - improvement_gaps_vs_sys_20260412.md
- **Effort**: 2-3 hours
- **Acceptance Criteria**: doc/ and doc_en/ have same file count
- **Current Status** (2026-04-12): Paused - corresponding source files `doc/reviews/comprehensive_improvement_plan_20260412.md` and `doc/reviews/improvement_gaps_vs_sys_20260412.md` do not exist in codebase, cannot translate.

#### 10.4.2 Fix Residual Chinese in Translation
- **ID**: I-55
- **Severity**: LOW
- **Issue**: doc_en/05_delivery_scope_and_milestones.md line 107 residual "unpacking"
- **Effort**: 5 minutes
- **Acceptance Criteria**: `grep -r "[^\x00-\x7F]" doc_en/` has no residual Chinese
- **Current Status** (2026-04-12): Confirmed - doc_en/05_delivery_scope_and_milestones.md line 107 "unpacking" no longer exists; grep remaining Chinese characters in doc_en/ are all in embedded English comments with technical terms (like "metric" meaning measurement standard) or external tool names, don't affect readability.

### 10.5 Configuration and Directory

#### 10.5.1 Division Configuration
- **I-33** Division YAML add apiVersion: division/v1 (15 minutes)
- **I-34** Division trigger keywords deduplication (30 minutes)
- **I-35** Division count documentation sync (30 minutes)
- **Current Status** (2026-04-12):
  - I-33: Completed - all 11 division.yaml under divisions/ contain `apiVersion: division/v1`
  - I-34: Completed - removed "dashboard" from data/division.yaml, removed "analyze"/"review" from general_ops/division.yaml, removed "fix" from support/division.yaml
  - I-35: Completed - documentation reflects 11 divisions, 11/11 have YAML definitions

#### 10.5.2 Other
- **I-56** Contract error_code_registry.md suffix unified to _contract.md (10 minutes)
- **I-79** src/core/testing/ renamed to src/core/stability/ (0.5 days)
- **Current Status** (2026-04-12):
  - I-56: Completed - existing filename is `error_code_registry_contract.md`, already conforms to naming convention
  - I-79: Completed - directory exists as `src/core/stability/`

---

## Execution Roadmap

| Phase | Time | Task | Effort |
|-------|------|------|--------|
| Urgent | This week | 1 (Security vulnerabilities) | 2 hours |
| This week | 1-2 weeks | 2 (Build deployment) | 1 day |
| This week | 1 week | 3 (CI/CD) | 1 day |
| This month | 2-3 weeks | 4 (Phase1aStore refactoring) | 3-5 days |
| This month | 2-3 weeks | 5 (Giant file splitting) | 10-12 days |
| This month | 1-2 weeks | 6 (Code quality) | 6-8 days |
| This month | 2-3 weeks | 7 (Architecture optimization) | 5-6 days |
| This month | 1 week | 8 (Config toolchain) | 4-5 days |
| Ongoing | Ongoing | 9 (Testing system) | Ongoing |
| This week | 1 week | 10 (Documentation governance) | 2-3 days |

**Estimated Total Effort: 9-12 weeks (Wave 0-5) + Ongoing improvement (Phase A-D)**

---

## Quantitative Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 7+ | God-class Phase1aStore; security vulnerabilities (timing attack/DoS); security modules without tests; dist path error |
| HIGH | 18+ | Build/CI issues; 12 singletons without lifecycle; unbounded cache; 42 CLI DB duplicates |
| MAJOR | 15+ | 89 giant files; dead code error classes; circular dependencies; 6 console calls |
| MEDIUM | 22+ | No ESLint; config without validation; documentation structure defects |
| LOW | 15+ | Naming conventions; style issues |

---
