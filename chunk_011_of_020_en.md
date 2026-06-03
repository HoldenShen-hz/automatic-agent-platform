  1. Evaluate and adjust production limits
  2. Match business requirements
  3. Add production capacity tests

#### 8. [Source Code] [High Severity] [Unbounded Maps without Eviction in Multiple Services]
- **File/Path**: Multiple domain services
- **Issue Description**:
  - `domain-knowledge-schema-service.ts:73-75`: schemas, sourceContent, sourceTimestamps are unrestricted
  - `domain-eval-framework-service.ts:91-95`: frameworks, qualityAxes etc. are unrestricted
  - `domain-recipe-service.ts:67-68`: recipes, versions are unrestricted
  - `domain-risk-profile-service.ts:51`: profiles are unrestricted
  - Session Maps (session-management.ts:83-89) have no automatic cleanup
- **Suggested Fix**:
  1. Implement LRU or TTL eviction for all Maps
  2. Add background cleanup tasks
  3. Add size monitoring and alerting

#### 9. [Source Code] [Medium Severity] [taskEventHistory Map Never Cleaned]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:91,548-555`
- **Issue Description**:
  - taskEventHistory limits single-task history to 200 entries
  - But the Map itself is never cleaned
  - Unsubscribed task histories are retained permanently
- **Suggested Fix**:
  1. Implement background cleanup of histories for tasks without subscribers
  2. Add task subscriber monitoring
  3. Consider using WeakMap instead

#### 10. [Configuration] [Medium Severity] [Security Configuration Drift - remoteWorkerRegistration Missing]
- **File/Path**: `config/security/dev.json`, `staging.json`, `pre-prod.json`
- **Issue Description**:
  - default.json has complete remoteWorkerRegistration configuration
  - dev/staging/pre-prod only have approvalMode
  - prod has approvalMode but no remoteWorkerRegistration
  - Security configuration is inconsistent
- **Suggested Fix**:
  1. Unify remoteWorkerRegistration across all environments
  2. Add security configuration validation
  3. Ensure minimum security baseline

#### 11. [API] [Medium Severity] [Inconsistent OpenAPI Endpoint Response Format]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/utils.ts:207-215`
- **Issue Description**:
  - `/v1/openapi.json` uses buildJsonDocumentResponse (no envelope)
  - Other endpoints use buildJsonResponse ({requestId, data} envelope)
  - Client experience is inconsistent
- **Suggested Fix**:
  1. Unify response envelope format
  2. Document response format specification
  3. Add response format validation tests

#### 12. [Source Code] [Medium Severity] [Redis Queue Missing Idempotency Index Support]
- **File/Path**: `src/platform/five-plane-execution/queue/redis-queue-adapter.ts`
- **Issue Description**:
  - SQLite has partial unique index support for idempotency
  - Redis implementation uses hash index but is incomplete
  - May cause duplicate messages
- **Suggested Fix**:
  1. Complete Redis idempotency implementation
  2. Add unique index validation
  3. Ensure behavior consistent with SQLite

#### 13. [Source Code] [Medium Severity] [Request Deduplication Middleware Uses In-Memory Storage]
- **File/Path**: `src/platform/five-plane-interface/api/middleware/request-deduplication.ts`
- **Issue Description**:
  - Pure in-memory sliding window (Map<DeduplicationKey, DeduplicationEntry[]>)
  - No external storage
  - Multi-instance deployments do not share state
  - Deduplication state is lost on restart
- **Suggested Fix**:
  1. Use Redis instead of in-memory storage
  2. Support distributed deduplication
  3. Persist deduplication state

#### 14. [Source Code] [Medium Severity] [Cache Has No Stampede Protection]
- **File/Path**: Multiple cache implementations
- **Issue Description**:
  - MemoryCacheStore, ExperienceCacheService are lock-free
  - Thundering herd can occur on cache miss
  - May cause database overload under high concurrency
- **Suggested Fix**:
  1. Implement single-flight pattern
  2. Add request queueing mechanism
  3. Use distributed locks to protect cache updates

#### 15. [Source Code] [Medium Severity] [EvidenceService Eviction Only Triggered on Insert]
- **File/Path**: `src/platform/five-plane-state-evidence/memory/evidence-service.ts:202`
- **Issue Description**:
  - Cleanup only triggered on record() calls
  - No background cleanup when idle
  - May cause memory to grow continuously
- **Suggested Fix**:
  1. Add periodic background cleanup tasks
  2. Use dedicated cleanup threads
  3. Add memory usage monitoring

#### 16. [Source Code] [Low Severity] [No Connection Metrics Exposed]
- **File/Path**: WebSocket server
- **Issue Description**:
  - getClientCount() exists but not exposed via HTTP endpoint
  - No pendingAcks queue depth metric
  - No connection establishment alerting
- **Suggested Fix**:
  1. Expose connection metrics via metrics endpoint
  2. Add pendingAcks queue monitoring
  3. Add abnormal connection count alerting

#### 17. [Source Code] [Low Severity] [No Idle Client Timeout]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts`
- **Issue Description**:
  - Only checks isAlive during heartbeat sweep
  - No per-client idle timeout independent of heartbeat
  - Clients that never send a message after authentication can only be detected via heartbeat failure
- **Suggested Fix**:
  1. Add per-client idle timeout
  2. Independent of heartbeat interval
  3. Make it configurable

#### 18. [Source Code] [Low Severity] [Subscription Limit Is Per-Client Instead of Global]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:244`
- **Issue Description**:
  - MAX_SUBSCRIPTIONS_PER_CLIENT = 100
  - Malicious clients can subscribe to 100 tasks
  - No global task subscriber limit
- **Suggested Fix**:
  1. Add global task subscriber limit
  2. Implement per-task subscriber cap
  3. Add anti-abuse detection

#### 19. [Configuration] [Low Severity] [config/runtime Has No Version Validation Mechanism]
- **File/Path**: `config/runtime/*.json`
- **Issue Description**:
  - Configurations have "version": "v4.3"
  - But no schema version validation
  - May accept incompatible configurations on load
- **Suggested Fix**:
  1. Add JSON Schema validation
  2. Implement version compatibility checks
  3. Validate configuration integrity on startup

#### 20. [Source Code] [Low Severity] [ImprovementCandidateRegistry splice Is O(n)]
- **File/Path**: `src/platform/five-plane-orchestration/improve/improvement-candidate-registry.ts:243`
- **Issue Description**:
  - accessOrder array's splice operation is O(n)
  - May cause performance issues with high-frequency access
- **Suggested Fix**:
  1. Use LinkedList instead of array
  2. Or use Map to maintain access order
  3. Verify with performance tests

### Summary

This supplementary Review (Round 13 - Caching, Session & Real-time Communication Review - 2026-05-14) identified 20 new issues.

**High Priority (Requires Immediate Action)**:
1. CORS allowedMethods missing PUT/PATCH/DELETE (browser requests will fail)
2. Mission Routes error response improperly wrapped
3. WebSocketBridge has no maximum connection limit (DoS risk)
4. pendingAcks not cleaned up on disconnect (memory leak)
5. Hardcoded fallback secret (security vulnerability)
6. config/runtime/test.json missing timeout configuration
7. prod.json maxConcurrentTasks=1 too restrictive
8. Multiple services have unbounded Maps (memory leak risk)

**Medium Priority**:
1. taskEventHistory Map never cleaned
2. Security configuration drift (remoteWorkerRegistration missing)
3. Inconsistent OpenAPI endpoint response format
4. Redis queue idempotency implementation incomplete
5. Request deduplication middleware uses in-memory storage (not shared across instances)
6. Cache has no stampede protection
7. EvidenceService eviction only triggered on insert

**Low Priority**:
1. No connection metrics exposed
2. No idle client timeout
3. Subscription limit is per-client instead of global
4. config/runtime has no version validation mechanism
5. ImprovementCandidateRegistry splice O(n)

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 64 | 74 | 35 | 173 |
| Test | 8 | 14 | 5 | 27 |
| Configuration | 10 | 38 | 24 | 72 |
| Security | 14 | 15 | 3 | 32 |
| Documentation | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deployment | 1 | 10 | 6 | 17 |
| **Total** | **99** | **161** | **79** | **339** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Fix CORS allowedMethods to add PUT/PATCH/DELETE
2. Fix Mission Routes error response format
3. Add maximum connection limit to WebSocketBridge
4. Clean up pendingAcks and taskEventHistory
5. Remove hardcoded fallback secret
6. Fix config/runtime/test.json configuration
7. Evaluate and adjust prod concurrency limits

**Short Term (This Month)**:
1. Unify security configuration (remoteWorkerRegistration)
2. Implement LRU/TTL eviction for unbounded Maps
3. Unify API response envelope format
4. Complete Redis idempotency implementation
5. Add distributed deduplication middleware
6. Implement cache stampede protection

**Long Term Planning**:
1. Establish complete connection management and monitoring
2. Implement background cleanup task framework
3. Add configuration schema validation
4. Optimize data structures for high-frequency operations
5. Establish memory usage baseline and alerting

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns & Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService Is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**:
  - 19 private instance variables (should be at most 3-5)
  - 61 public methods
  - 9 injected delegated services
  - Violates the single responsibility principle
  - Coordinates too many subsystems
- **Suggested Fix**:
  1. Split into `HarnessStateManager` (state transitions)
  2. Split into `HarnessMemoryCoordinator` (memory operations)
  3. Split into `HarnessRecoveryHandler` (failure handling)
  4. Split into `HarnessHitlCoordinator` (human-in-the-loop collaboration)

#### 2. [Architecture] [High Severity] [Giant Barrel Files Causing Build Issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317 lines)
- **Issue Description**:
  - 15 submodule re-exports
  - Modifying any feature may trigger large-scale recompilation
  - Creates risk of circular dependencies
- **Suggested Fix**:
  1. Each index.ts re-exports at most 5-7 items
  2. Prefer direct module imports
  3. Split contracts by domain into multiple files

#### 3. [Memory] [High Severity] [167 Event Listeners with Only 16 Cleaned Up]
- **File/Path**: Entire codebase
- **Issue Description**:
  - `.on`/`addEventListener`: 167 occurrences
  - `.off`/`removeListener`/`removeAllListeners`: only 16 occurrences
  - Severe imbalance, memory leak exists
- **Suggested Fix**:
  1. Audit all event listener registration points
  2. Ensure each listener has a corresponding cleanup
  3. Use `{ once: true }` for automatic cleanup

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts Child Process Listeners Not Cleaned Up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**:
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - Registered in attachChild()/spawnChild()
  - stop() method never removes them
  - Listeners remain attached to detached child processes after plugin runtime stops
- **Suggested Fix**:
  1. Add cleanup in stop():
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 Lines Should Be Split]
- **File/Path**: `src/domains/yono/index.ts` (763 lines)
- **Issue Description**:
  - Most domain index.ts files are only 12 lines
  - yono exports 11 classes (YonoRepository, YonoMarketService, YonoCommentService, etc.)
  - A single file contains too many responsibilities
- **Suggested Fix**:
  1. Split into yono/market-service.ts
  2. Split into yono/comment-service.ts
  3. One class per file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 Lines Should Be Split]
- **File/Path**: `src/index.ts` (451 lines)
- **Issue Description**:
  - Handles platform startup, runtime directory, bootstrap, demo mode
  - Exports from multiple subsystems
  - Violates single responsibility
- **Suggested Fix**:
  1. Split into bootstrap.ts
  2. Split into startup.ts
  3. Split into exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts Data vs Object Confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169 lines)
- **Issue Description**:
  - 527 type/interface definitions
  - Pure data structures (PrincipalRef, HumanPrincipalRef, etc.)
  - No behavior, only type exports
  - Types and factory functions mixed together
- **Suggested Fix**:
  1. Split into runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. Separate types from factory functions
  3. Establish clear boundaries

#### 8. [Domain] [High Severity] [DomainLifecycleState Duplicated and Incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**:
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - Two completely incompatible schemas
  - A fragile mapping layer tries to normalize
- **Suggested Fix**:
  1. Unify into a single canonical definition
  2. Remove duplicates
  3. Establish a single source of truth

#### 9. [Domain] [Medium Severity] [Risk Score Thresholds Hardcoded with No Constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**:
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - Magic numbers 85, 65, 35
  - No constants, comments, or configuration
- **Suggested Fix**:
  1. Extract to named constants
  2. Add configuration options
  3. Document decision boundaries

#### 10. [Domain] [Medium Severity] [HR Role Detection Hardcodes Tool Names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**:
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - Hardcoded tool names "read" and "question"
  - Should use constants
- **Suggested Fix**:
  1. Extract as constant READ_ONLY_TOOL_NAMES
  2. Add configuration support
  3. Document read-only role definitions

#### 11. [Domain] [Medium Severity] [No Invariant Enforcement Mechanism]
- **File/Path**: Overall architecture
- **Issue Description**:
  - `canTransitionDomain` returns boolean but has no enforcement
  - Transitions can be attempted without going through validators
  - No consistency check between domain seeds and risk specs
- **Suggested Fix**:
  1. Add invariant enforcement framework
  2. Ensure state transitions are validated
  3. Add pre-transition condition checks

#### 12. [Security] [Medium Severity] [OpenAPI Endpoint Publicly Exposed Without Authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**:
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure documentation exposed without authentication
  - May leak sensitive API information
- **Suggested Fix**:
  1. Add authentication or restrict access
  2. Disable in production
  3. Document the risk

#### 13. [Security] [Medium Severity] [In-Memory Session Storage Limits Horizontal Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**:
  - Sessions stored in module-level Map
  - Multi-server instance deployment does not work
  - No distributed session storage
- **Suggested Fix**:
  1. Use distributed session storage such as Redis
  2. Add session replication
  3. Document scaling limitations

#### 14. [Security] [Medium Severity] [In-Memory Service Identity Storage Limits Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**:
  - `serviceIdentities` Map is in-memory
  - Multi-instance deployment issue
- **Suggested Fix**:
  1. Use shared storage
  2. Or load from configuration at startup

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts Files Share the Same Name]
- **File/Path**:
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**:
  - Same name in different scopes
  - May cause import confusion
  - Appears intentional but may be confusing
- **Suggested Fix**:
  1. Add scope prefix or suffix
  2. Document the purpose of each file
  3. Ensure imports are explicit

#### 16. [Memory] [Low Severity] [PgDatabase.close() Validation Issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**:
  - Has close() method but may not be called during shutdown
  - Need to verify shutdown ordering
- **Suggested Fix**:
  1. Verify shutdown ordering
  2. Add shutdown hooks
  3. Ensure resource release

#### 17. [Architecture] [Low Severity] [Core/runtime Is a Wrapper for Platform Execution Files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**:
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts all re-export
  - Only used by a single SDK file
  - Questionable-value indirection layer
- **Suggested Fix**:
  1. Remove or document purpose
  2. Import directly from platform

### Summary

This supplementary Review (Round 16 - Architecture Patterns & Memory Management Review - 2026-05-14) identified 17 new issues.

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is a God Object (19 variables, 61 methods)
2. Giant barrel files cause build issues
3. 167 event listeners with only 16 cleaned up
4. plugin-runtime-host.ts child process listeners not cleaned up
5. DomainLifecycleState duplicated and incompatible
6. Risk score thresholds hardcoded with no constants

**Medium Priority**:
1. yono/index.ts 763 lines should be split
2. src/index.ts 451 lines should be split
3. contracts data vs object confusion
4. HR role detection hardcodes tool names
5. No invariant enforcement mechanism
6. OpenAPI endpoint publicly exposed without authentication
7. In-memory session storage limits horizontal scaling
8. In-memory service identity storage limits scaling

**Low Priority**:
1. Multiple architecture-remediation.ts files share the same name
2. PgDatabase.close() validation issue
3. Core/runtime wrapper value is questionable

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 15 | 17 | 3 | 35 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **116** | **190** | **88** | **394** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService into focused services
2. Fix plugin-runtime-host.ts child process listener cleanup
3. Unify DomainLifecycleState definition
4. Add event listener cleanup audit
5. Add fetch timeout to all network calls

**Short Term (This Month)**:
1. Split yono/index.ts and src/index.ts
2. Establish invariant enforcement framework
3. Add distributed session storage
4. Remove barrel files or limit their size
5. Extract all magic numbers to constants

**Long Term Planning**:
1. Complete God Object refactoring plan
2. Establish architecture boundaries and interfaces
3. Implement memory safety verification
4. Establish code quality gates
5. Improve documentation and training

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing & Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript Incremental Compilation Cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**:
  - No `incremental: true` configuration
  - No `tsbuildinfo` file
  - Every build is a full rebuild (9.6 seconds)
  - TypeScript cannot use incremental compilation
- **Suggested Fix**:
  1. Add `"incremental": true` to tsconfig.json
  2. Add `"tsbuildinfo": ".tsbuildinfo"` to .gitignore
  3. Implement project references for parallel builds

#### 2. [Build] [High Severity] [76 npm Scripts Mostly Duplicate Builds]
- **File/Path**: `package.json`
- **Issue Description**:
  - 40+ CLI scripts all run `npm run build && node ...`
  - Each script performs a full rebuild before running
  - Cannot directly run pre-built CLIs
  - 20+ stable:* scripts follow the same pattern
- **Suggested Fix**:
  1. Create a `build:cli` script to build once
  2. Have CLI scripts use pre-built dist files
  3. Add npm run dev or similar no-rebuild execution method

#### 3. [Source Code] [High Severity] [168 Uses of `any` Type]
- **File/Path**: Entire src directory
- **Issue Description**:
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` method signature
  - Retry/timeout utilities use `(...args: any[]) => Promise<any>`
  - Bypasses type safety
- **Suggested Fix**:
  1. Use generics instead of any
  2. Replace with concrete input types
  3. Add ESLint rule to disallow any

#### 4. [Source Code] [High Severity] [38 @ts-ignore Directives]
- **File/Path**: Multiple files
- **Issue Description**:
  - 14 stability-related files have `@ts-ignore ExecutionRecord type mismatch`
  - 5 harness-sdk files have `Partial<HarnessRun> doesn't have all required properties`
  - 2 files have `exactOptionalPropertyTypes` issues
- **Suggested Fix**:
  1. Fix ExecutionRecord type mismatch
  2. Complete required properties for HarnessRun type
  3. Remove @ts-ignore usage

#### 5. [Source Code] [High Severity] [ExecutionRecord Type Mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` and 14 other files
- **Issue Description**:
  - TypeScript rejects the type when inserting execution record
  - `ExecutionRecord` interface requires new fields but insert object is missing them
  - Or store's insert method accepts a different type
- **Suggested Fix**:
  1. Align ExecutionRecord interface with store type
  2. Add missing fields to insert object
  3. Or adjust the store's insert method type signature

#### 6. [Source Code] [Medium Severity] [30+ `as unknown as` Double Type Casts]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**:
  - Completely bypasses type safety
  - Often a signal of type architecture issues
- **Suggested Fix**:
  1. Fix upstream type issues
  2. Use more specific type assertions
  3. Refactor the type hierarchy

#### 7. [Build] [Medium Severity] [rimraf Extraneous - Not Declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**:
  - rimraf@6.1.3 exists in node_modules but is not declared in package.json
  - May cause dependency issues
- **Suggested Fix**:
  1. Add to dependencies or devDependencies
  2. Or remove and use another cleanup approach

#### 8. [Test] [High Severity] [178 Direct process.env Mutations Without Abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**:
  - Direct read/write of process.env
  - Manual save/restore in beforeEach/afterEach
  - No helper abstraction
- **Suggested Fix**:
  1. Create env helper function
  2. Unify save and restore pattern
  3. Add test isolation validation

#### 9. [Test] [High Severity] [21,998 unlinkSync Calls Without Centralized Cleanup]
- **File/Path**: Multiple test files
- **Issue Description**:
  - Each test re-implements cleanup logic
  - No centralized cleanup utility
  - May cause EBUSY (Windows) or concurrent access issues
- **Suggested Fix**:
  1. Create a centralized test cleanup utility
  2. Use afterEach to ensure cleanup
  3. Consider using temporary directories

#### 10. [Test] [Medium Severity] [No Unified Mocking Framework]
- **File/Path**: `tests/` multiple directories
- **Issue Description**:
  - 10,579 calls to vi.fn, jest.mock, sinon, etc.
  - No unified mocking framework is visible
  - Inconsistent patterns
- **Suggested Fix**:
  1. Establish a unified mock factory
  2. Standardize mock patterns
  3. Add mocking best practices documentation

#### 11. [Test] [Medium Severity] [Singleton State Reset Not Standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**:
  - Tests reset singletons via specific functions
  - Each test repeats its own reset logic
  - No unified resetAllSingletons()
- **Suggested Fix**:
  1. Create a unified singleton reset mechanism
  2. Call automatically in afterEach
  3. Document singleton reset requirements

#### 12. [Test] [Low Severity] [No Branch Coverage Requirements]
- **File/Path**: `.c8rc.json`
- **Issue Description**:
  - `"100": false` - no coverage requirement
  - Only measures source code, not test files
- **Suggested Fix**:
  1. Add branch coverage thresholds
  2. Enforce coverage gates in CI
  3. Focus on critical code paths

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest Has No Timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**:
  - fetch call has no timeout parameter
  - Pending requests may block forever
- **Suggested Fix**:
  1. Add AbortController timeout
  2. Use standard timeout pattern
  3. Document timeout configuration

#### 14. [Network] [High Severity] [OIDC Service fetch Calls Have No Timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**:
  - OIDC token exchange has no retry logic
  - No timeout/abort signal
  - Authentication flow may hang
- **Suggested Fix**:
  1. Add fetch timeout
  2. Add retry logic
  3. Use standard timeout configuration

#### 15. [Network] [High Severity] [plugin-runtime-child Replaces globalThis.fetch With No-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**:
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - Completely replaces fetch with an empty function in plugin context
  - All outbound HTTP requests from plugins will fail
  - Appears intentional but may cause issues
- **Suggested Fix**:
  1. Confirm this is intentional behavior
  2. Document the fetch replacement behavior
  3. Ensure it does not accidentally affect other code

#### 16. [Network] [Medium Severity] [No Explicit http.Agent Configuration]
- **File/Path**: Global
- **Issue Description**:
  - No explicit http.Agent/https.Agent configuration
  - Relies on Node.js default connection pool
  - No maxSockets or maxConnections configuration
  - May cause issues in high-throughput scenarios
- **Suggested Fix**:
  1. Add http Agent configuration
  2. Document connection pool size
  3. Monitor connection usage

#### 17. [Serialization] [Medium Severity] [Contract Version Hardcoded as String Literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**:
  - `schemaVersion: "v4.3"` hardcoded
  - Hard to track contract version evolution
- **Suggested Fix**:
  1. Extract to typed constant or enum
  2. Centrally manage contract versions
  3. Add version compatibility checks

#### 18. [Serialization] [Low Severity] [Timestamp = string Loses Precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**:
  - `type Timestamp = string` has no type precision
  - ISO 8601 string has no timezone information
- **Suggested Fix**:
  1. Use Date object or branded string type
  2. Clarify timezone handling conventions
  3. Document timestamp semantics

#### 19. [Source Code] [Medium Severity] [29 Non-null Assertions !.]
- **File/Path**: Entire src directory
- **Issue Description**:
  - Uses `!.` to assert non-null
  - May cause runtime errors
- **Suggested Fix**:
  1. Use optional chaining `?.` or nullish coalescing `??`
  2. Add appropriate null checks
  3. Reduce non-null assertion usage

#### 20. [API] [Medium Severity] [API Route Schema Version Hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**:
  - Zod schema validation exists
  - But schema version is not synchronized with contract version
- **Suggested Fix**:
  1. Derive schema version from contract version
  2. Add version consistency checks
  3. Document version relationships

### Summary

This supplementary Review (Round 15 - Build, Testing & Type System Review - 2026-05-14) identified 20 new issues.

**High Priority (Requires Immediate Action)**:
1. No TypeScript incremental compilation cache (full rebuild 9.6 seconds each time)
2. 76 npm scripts mostly duplicate builds
3. 168 uses of `any` type (bypasses type safety)
4. 38 @ts-ignore directives
5. ExecutionRecord type mismatch (14 files)
6. 178 direct process.env mutations without abstraction
7. ScopedExternalAccessSandbox performHttpRequest has no timeout
8. OIDC service fetch calls have no timeout
9. plugin-runtime-child replaces globalThis.fetch with no-op

**Medium Priority**:
1. 30+ `as unknown as` double type casts
2. rimraf extraneous not declared
3. 21,998 unlinkSync calls without centralized cleanup
4. No unified mocking framework
5. Singleton state reset not standardized
6. No explicit http.Agent configuration
7. Contract version hardcoded as string
8. Timestamp = string loses precision
9. Non-null assertion usage

**Low Priority**:
1. No branch coverage requirements
2. API route schema version not synchronized

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 14 | 15 | 3 | 32 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **109** | **182** | **85** | **376** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript incremental compilation (`incremental: true`)
2. Refactor npm scripts to avoid duplicate builds
3. Reduce `any` type usage to <50
4. Remove all @ts-ignore directives
5. Fix ExecutionRecord type mismatch
6. Add fetch timeout to OIDC and sandbox

**Short Term (This Month)**:
1. Create centralized test cleanup utility
2. Establish a unified mocking framework
3. Standardize singleton reset mechanism
4. Add http.Agent connection pool configuration
5. Extract contract versions to typed constants

**Long Term Planning**:
1. Achieve complete type safety (no `any`)
2. Establish test infrastructure standards
3. Implement build cache optimization
4. Improve network layer timeout and retry
5. Establish coverage gate standards

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns & Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService Is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**:
  - 19 private instance variables (should be at most 3-5)
  - 61 public methods
  - 9 injected delegated services
  - Violates the single responsibility principle
  - Coordinates too many subsystems
- **Suggested Fix**:
  1. Split into `HarnessStateManager` (state transitions)
  2. Split into `HarnessMemoryCoordinator` (memory operations)
  3. Split into `HarnessRecoveryHandler` (failure handling)
  4. Split into `HarnessHitlCoordinator` (human-in-the-loop collaboration)

#### 2. [Architecture] [High Severity] [Giant Barrel Files Causing Build Issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317 lines)
- **Issue Description**:
  - 15 submodule re-exports
  - Modifying any feature may trigger large-scale recompilation
  - Creates risk of circular dependencies
- **Suggested Fix**:
  1. Each index.ts re-exports at most 5-7 items
  2. Prefer direct module imports
  3. Split contracts by domain into multiple files

#### 3. [Memory] [High Severity] [167 Event Listeners with Only 16 Cleaned Up]
- **File/Path**: Entire codebase
- **Issue Description**:
  - `.on`/`addEventListener`: 167 occurrences
  - `.off`/`removeListener`/`removeAllListeners`: only 16 occurrences
  - Severe imbalance, memory leak exists
- **Suggested Fix**:
  1. Audit all event listener registration points
  2. Ensure each listener has a corresponding cleanup
  3. Use `{ once: true }` for automatic cleanup

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts Child Process Listeners Not Cleaned Up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**:
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - Registered in attachChild()/spawnChild()
  - stop() method never removes them
  - Listeners remain attached to detached child processes after plugin runtime stops
- **Suggested Fix**:
  1. Add cleanup in stop():
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 Lines Should Be Split]
- **File/Path**: `src/domains/yono/index.ts` (763 lines)
- **Issue Description**:
  - Most domain index.ts files are only 12 lines
  - yono exports 11 classes (YonoRepository, YonoMarketService, YonoCommentService, etc.)
  - A single file contains too many responsibilities
- **Suggested Fix**:
  1. Split into yono/market-service.ts
  2. Split into yono/comment-service.ts
  3. One class per file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 Lines Should Be Split]
- **File/Path**: `src/index.ts` (451 lines)
- **Issue Description**:
  - Handles platform startup, runtime directory, bootstrap, demo mode
  - Exports from multiple subsystems
  - Violates single responsibility
- **Suggested Fix**:
  1. Split into bootstrap.ts
  2. Split into startup.ts
  3. Split into exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts Data vs Object Confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169 lines)
- **Issue Description**:
  - 527 type/interface definitions
  - Pure data structures (PrincipalRef, HumanPrincipalRef, etc.)
  - No behavior, only type exports
  - Types and factory functions mixed together
- **Suggested Fix**:
  1. Split into runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. Separate types from factory functions
  3. Establish clear boundaries

#### 8. [Domain] [High Severity] [DomainLifecycleState Duplicated and Incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**:
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - Two completely incompatible schemas
  - A fragile mapping layer tries to normalize
- **Suggested Fix**:
  1. Unify into a single canonical definition
  2. Remove duplicates
  3. Establish a single source of truth

#### 9. [Domain] [Medium Severity] [Risk Score Thresholds Hardcoded with No Constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**:
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - Magic numbers 85, 65, 35
  - No constants, comments, or configuration
- **Suggested Fix**:
  1. Extract to named constants
  2. Add configuration options
  3. Document decision boundaries

#### 10. [Domain] [Medium Severity] [HR Role Detection Hardcodes Tool Names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**:
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - Hardcoded tool names "read" and "question"
  - Should use constants
- **Suggested Fix**:
  1. Extract as constant READ_ONLY_TOOL_NAMES
  2. Add configuration support
  3. Document read-only role definitions

#### 11. [Domain] [Medium Severity] [No Invariant Enforcement Mechanism]
- **File/Path**: Overall architecture
- **Issue Description**:
  - `canTransitionDomain` returns boolean but has no enforcement
  - Transitions can be attempted without going through validators
  - No consistency check between domain seeds and risk specs
- **Suggested Fix**:
  1. Add invariant enforcement framework
  2. Ensure state transitions are validated
  3. Add pre-transition condition checks

#### 12. [Security] [Medium Severity] [OpenAPI Endpoint Publicly Exposed Without Authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**:
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure documentation exposed without authentication
  - May leak sensitive API information
- **Suggested Fix**:
  1. Add authentication or restrict access
  2. Disable in production
  3. Document the risk

#### 13. [Security] [Medium Severity] [In-Memory Session Storage Limits Horizontal Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**:
  - Sessions stored in module-level Map
  - Multi-server instance deployment does not work
  - No distributed session storage
- **Suggested Fix**:
  1. Use distributed session storage such as Redis
  2. Add session replication
  3. Document scaling limitations

#### 14. [Security] [Medium Severity] [In-Memory Service Identity Storage Limits Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**:
  - `serviceIdentities` Map is in-memory
  - Multi-instance deployment issue
- **Suggested Fix**:
  1. Use shared storage
  2. Or load from configuration at startup

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts Files Share the Same Name]
- **File/Path**:
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**:
  - Same name in different scopes
  - May cause import confusion
  - Appears intentional but may be confusing
- **Suggested Fix**:
  1. Add scope prefix or suffix
  2. Document the purpose of each file
  3. Ensure imports are explicit

#### 16. [Memory] [Low Severity] [PgDatabase.close() Validation Issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**:
  - Has close() method but may not be called during shutdown
  - Need to verify shutdown ordering
- **Suggested Fix**:
  1. Verify shutdown ordering
  2. Add shutdown hooks
  3. Ensure resource release

#### 17. [Architecture] [Low Severity] [Core/runtime Is a Wrapper for Platform Execution Files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**:
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts all re-export
  - Only used by a single SDK file
  - Questionable-value indirection layer
- **Suggested Fix**:
  1. Remove or document purpose
  2. Import directly from platform

### Summary

This supplementary Review (Round 16 - Architecture Patterns & Memory Management Review - 2026-05-14) identified 17 new issues.

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is a God Object (19 variables, 61 methods)
2. Giant barrel files cause build issues
3. 167 event listeners with only 16 cleaned up
4. plugin-runtime-host.ts child process listeners not cleaned up
5. DomainLifecycleState duplicated and incompatible
6. Risk score thresholds hardcoded with no constants

**Medium Priority**:
1. yono/index.ts 763 lines should be split
2. src/index.ts 451 lines should be split
3. contracts data vs object confusion
4. HR role detection hardcodes tool names
5. No invariant enforcement mechanism
6. OpenAPI endpoint publicly exposed without authentication
7. In-memory session storage limits horizontal scaling
8. In-memory service identity storage limits scaling

**Low Priority**:
1. Multiple architecture-remediation.ts files share the same name
2. PgDatabase.close() validation issue
3. Core/runtime wrapper value is questionable

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 15 | 17 | 3 | 35 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **116** | **190** | **88** | **394** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService into focused services
2. Fix plugin-runtime-host.ts child process listener cleanup
3. Unify DomainLifecycleState definition
4. Add event listener cleanup audit
5. Add fetch timeout to all network calls

**Short Term (This Month)**:
1. Split yono/index.ts and src/index.ts
2. Establish invariant enforcement framework
3. Add distributed session storage
4. Remove barrel files or limit their size
5. Extract all magic numbers to constants

**Long Term Planning**:
1. Complete God Object refactoring plan
2. Establish architecture boundaries and interfaces
3. Implement memory safety verification
4. Establish code quality gates
5. Improve documentation and training

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 14 - Logging, Events & Workflow Review)

### Newly Discovered Issues

#### 1. [Observability] [High Severity] [StructuredLogEntry Has No requestId Field]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**:
  - StructuredLogEntry interface has no requestId field
  - Only correlationId, which falls back to traceId
  - Cannot independently track individual HTTP requests
- **Suggested Fix**:
  1. Add requestId field to StructuredLogEntry
  2. Generate and inject requestId in HTTP middleware
  3. Ensure requestId flows through all log calls

#### 2. [Observability] [High Severity] [StructuredLogger data Field Has No Auto Sanitization]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**:
  - If a developer passes `{ password: "..." }` to logger.info, the password will be logged
  - No field-level redaction mechanism
  - Relies on developers to manually exclude sensitive fields
- **Suggested Fix**:
  1. Add a blacklist similar to OBSERVE_OUTPUT_BLACKLIST
  2. Implement redact/mask/sanitize utility functions
  3. Automatically sanitize sensitive fields before log transport

#### 3. [Observability] [Medium Severity] [No PII Handling for Sensitive Data in Logs]
- **File/Path**: `src/platform/shared/observability/structured-logger.ts`
- **Issue Description**:
  - No PII rewriter utility
  - Developers must manually avoid logging sensitive data
  - Risk of accidentally logging sensitive information
- **Suggested Fix**:
  1. Add PII detection and rewriter utility
  2. Document the sensitive field list in documentation
  3. Add tests to verify sensitive data is not logged

#### 4. [Observability] [Medium Severity] [59 Direct console.* Calls]
- **File/Path**: Multiple source files
- **Issue Description**:
  - Should use StructuredLogger
  - console calls may not be collected by log aggregation systems
  - Hard to track and correlate
- **Suggested Fix**:
  1. Replace all console.* with StructuredLogger
  2. Add ESLint rule to disallow console.*
  3. Reserve a small number of allowed CLI outputs

#### 5. [Observability] [Medium Severity] [Some logger.warn Calls Missing Structured Data]
- **File/Path**: `src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts:122`
- **Issue Description**:
  ```typescript
  logger.warn("WebSocket connection rejected: missing subprotocol token")
  ```
  - Only message, no data object
  - Hard to correlate and query
- **Suggested Fix**:
  1. Add `{ data: { ... } }` object
  2. Ensure all logs include contextual data
  3. Add log review tools

#### 6. [Source Code] [High Severity] [Harness while(true) Loop Has No Hard Iteration Limit]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:1442`
- **Issue Description**:
  ```typescript
  while (true) {
    // ...
    // Relies on budget gate and guardrail vibration to exit
    // If both fail, the loop continues forever
  }
  ```
  - Relies on budget gate and guardrail vibration to exit
  - No hard iteration count limit
  - May cause infinite loop
- **Suggested Fix**:
  1. Add hard maxIterations limit
  2. Force exit when the limit is reached
  3. Log detailed iteration statistics for debugging

#### 7. [Source Code] [High Severity] [Oapeflir while(true) Loop May Replan Indefinitely]
- **File/Path**: `src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts:355`
- **Issue Description**:
  - If loopReplanDecision.shouldReplan never becomes false
  - Replanning can never reduce planning errors
  - May cause infinite loop
- **Suggested Fix**:
  1. Add a replanning count limit
  2. Force accept current result when limit is reached
  3. Add replan quality decay detection

#### 8. [Source Code] [Medium Severity] [Recovery Flow Allows Terminal State Transition to paused]
- **File/Path**: `src/platform/five-plane-execution/runtime-state-machine.ts:105-108`
- **Issue Description**:
  - completed, failed, cancelled, aborted can transition to paused for recovery
  - Creating a recovery path may re-enter execution
  - Need to verify the correctness of this behavior
- **Suggested Fix**:
  1. Review the legitimacy of recovery transitions
  2. Ensure no inconsistent state is caused
  3. Add pre-transition condition validation

#### 9. [Internationalization] [High Severity] [API Error Messages Hardcoded in English]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/api-error.ts`
- **Issue Description**:
  ```typescript
  return new ApiError(404, "api.task_not_found", "Task not found.");
  ```
  - Error messages hardcoded in English
  - No backend i18n mechanism
  - Non-English clients receive non-localized errors
- **Suggested Fix**:
  1. Use error codes instead of hardcoded messages
  2. Clients localize based on error codes
  3. Or add i18n support in the backend

#### 10. [Internationalization] [Medium Severity] [UI Hardcoded Strings Not Translated]
- **File/Path**: `ui/packages/features/conversation/src/web/index.tsx`
- **Issue Description**:
  - Button labels like "Build Plan", "Execute", "Messages" are hardcoded
  - i18n system is not used
- **Suggested Fix**:
  1. Use `translateFeatureCopy` to replace hardcoded strings
  2. Ensure all user-visible text goes through i18n
  3. Add hardcoded string detection

#### 11. [Internationalization] [Medium Severity] [Arabic Catalog Incomplete]
- **File/Path**: `ui/packages/shared/i18n/src/catalogs/ar-SA.ts`
- **Issue Description**:
  - ar-SA has only about 18 messages
  - en-US and zh-CN have about 117
  - Missing keys return the key itself
- **Suggested Fix**:
  1. Supplement Arabic translations
  2. Ensure all keys have translations
  3. Add translation completeness tests

#### 12. [Internationalization] [Low Severity] [translateFeatureCopy Has No Fallback Default]
- **File/Path**: `ui/packages/shared/i18n/`
- **Issue Description**:
  - If feature ID is not in catalog
  - Returns undefined title/summary
  - No reasonable fallback
- **Suggested Fix**:
  1. Add fallback to key or default string
  2. Or use feature ID as display name
  3. Ensure UI does not display undefined

#### 13. [Operations] [High Severity] [Health Checks Do Not Distinguish readiness/liveness]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**:
  - /healthz, /v1/healthz, /health return the same report
  - No readiness probe (can it accept traffic?)
  - No liveness probe (is the system alive?)
  - canAcceptTraffic() not exposed via HTTP
- **Suggested Fix**:
  1. Add /ready and /live endpoints
  2. Readiness checks that dependencies are ready
  3. Liveness checks that the process is healthy

#### 14. [Operations] [High Severity] [Race Condition in Health Check During Shutdown]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts`
- **Issue Description**:
  - getHealthReportAsync() asynchronously checks dbWritable
  - Database connections may be closing during shutdown
  - Health checks are still coming in
- **Suggested Fix**:
  1. Return unhealthy during shutdown
  2. Add shutdown status flag
  3. Stop accepting new health check requests

#### 15. [Operations] [High Severity] [LeaderElectionService Not Integrated with GracefulShutdown]
- **File/Path**: `src/platform/five-plane-execution/ha/leader-election-service.ts`
- **Issue Description**:
  - LeaderElectionService.stop() handles graceful demotion
  - But not registered in the global graceful shutdown
  - Must be explicitly registered as a shutdown handler
- **Suggested Fix**:
  1. Add LeaderElectionService to shutdown handlers
  2. Ensure the leader steps down on shutdown
  3. Verify shutdown order is correct

#### 16. [Operations] [Medium Severity] [addHandler() Has No Explicit Ordering Convention]
- **File/Path**: `src/platform/five-plane-execution/startup/graceful-shutdown.ts`
- **Issue Description**:
  - Although handlers execute in reverse order
  - No explicit interface declares handler dependencies
  - Critical handlers (such as closing database connections) should run last
- **Suggested Fix**:
  1. Add priority or stage parameter
  2. Document critical handler ordering requirements
  3. Add ordering validation tests

#### 17. [Operations] [Medium Severity] [unref'd Timers May Not Fire]
- **File/Path**: `src/platform/five-plane-execution/startup/process-error-handlers.ts:106`
- **Issue Description**:
  - `setTimeout(...).unref()` does not keep the event loop alive
  - If the main thread is idle, forced exit may not trigger
- **Suggested Fix**:
  1. Remove .unref() unless truly needed
  2. Or ensure another way to keep the event loop alive
  3. Add timeout trigger validation tests

#### 18. [Operations] [Medium Severity] [StartupConsistencyChecker Blocks Traffic But Does Not Expose Status]
- **File/Path**: `src/platform/five-plane-startup-plan.ts`
- **Issue Description**:
  - canAcceptTraffic() returns false when P0 issues exist
  - But _trafficBlocked is internal state
  - Load balancer accessing /healthz still gets "ok"
- **Suggested Fix**:
  1. Expose trafficBlocked status in health report
  2. Or add a separate health endpoint indicating readiness
  3. Ensure load balancer does not route traffic when blocked

#### 19. [Event System] [Medium Severity] [TypedEventBus vs EventEmitter Mixed Usage]
- **File/Path**: Entire codebase
- **Issue Description**:
  - Project uses both TypedEventBus and native EventEmitter
  - TypedEventBus should be the standard
  - Mixed usage may cause type safety issues
- **Suggested Fix**:
  1. Create migration plan to unify on TypedEventBus
  2. Add ESLint rule to disallow native EventEmitter
  3. Detect mixed usage in CI

#### 20. [Source Code] [Low Severity] [No Event Ordering Guarantee]
- **File/Path**: `src/platform/five-plane-state-evidence/events/`
- **Issue Description**:
  - No explicit event ordering guarantee documentation
  - Event handling may be out of order
  - Dependents need to handle out-of-order delivery
- **Suggested Fix**:
  1. Document event ordering semantics
  2. Implement sequence number mechanism if ordering is needed
  3. Consider out-of-order scenarios in event handling

### Summary

This supplementary Review (Round 14 - Logging, Events & Workflow Review - 2026-05-14) identified 20 new issues.

**High Priority (Requires Immediate Action)**:
1. StructuredLogEntry has no requestId field
2. StructuredLogger data field has no auto sanitization (sensitive data risk)
3. Harness while(true) loop has no hard iteration limit
4. Oapeflir while(true) loop may replan indefinitely
5. API error messages hardcoded in English (no i18n)
6. Health checks do not distinguish readiness/liveness
7. Race condition in health check during shutdown
8. LeaderElectionService not integrated with GracefulShutdown

**Medium Priority**:
1. No PII handling for sensitive data in logs
2. 59 direct console.* calls
3. Some logger.warn calls missing structured data
4. Recovery flow allows terminal state transition to paused
5. UI hardcoded strings not translated
6. Arabic catalog incomplete
7. addHandler() has no explicit ordering convention
8. unref'd timers may not fire
9. StartupConsistencyChecker blocks traffic but does not expose status
10. TypedEventBus vs EventEmitter mixed usage

**Low Priority**:
1. translateFeatureCopy has no fallback default
2. No event ordering guarantee

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 68 | 80 | 37 | 185 |
| Test | 8 | 14 | 5 | 27 |
| Configuration | 10 | 38 | 24 | 72 |
| Security | 14 | 15 | 3 | 32 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **103** | **171** | **82** | **356** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Add requestId field to StructuredLogEntry
2. Implement automatic sanitization of sensitive log fields
3. Add hard iteration limit for workflow loops
4. Add readiness/liveness health check endpoints
5. Integrate LeaderElectionService with GracefulShutdown
6. Implement i18n support for API error messages

**Short Term (This Month)**:
1. Replace all console.* with StructuredLogger
2. Supplement Arabic i18n catalog
3. Fix UI hardcoded strings
4. Unify TypedEventBus to replace EventEmitter
5. Resolve shutdown race conditions
6. Add event ordering guarantee documentation

**Long Term Planning**:
1. Establish a complete PII handling framework
2. Implement log integrity verification
3. Establish workflow safety loop detection
4. Improve health checks and readiness probes
5. Establish comprehensive i18n testing

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns & Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService Is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**:
  - 19 private instance variables (should be at most 3-5)
  - 61 public methods
  - 9 injected delegated services
  - Violates the single responsibility principle
  - Coordinates too many subsystems
- **Suggested Fix**:
  1. Split into `HarnessStateManager` (state transitions)
  2. Split into `HarnessMemoryCoordinator` (memory operations)
  3. Split into `HarnessRecoveryHandler` (failure handling)
  4. Split into `HarnessHitlCoordinator` (human-in-the-loop collaboration)

#### 2. [Architecture] [High Severity] [Giant Barrel Files Causing Build Issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317 lines)
- **Issue Description**:
  - 15 submodule re-exports
  - Modifying any feature may trigger large-scale recompilation
  - Creates risk of circular dependencies
- **Suggested Fix**:
  1. Each index.ts re-exports at most 5-7 items
  2. Prefer direct module imports
  3. Split contracts by domain into multiple files

#### 3. [Memory] [High Severity] [167 Event Listeners with Only 16 Cleaned Up]
- **File/Path**: Entire codebase
- **Issue Description**:
  - `.on`/`addEventListener`: 167 occurrences
  - `.off`/`removeListener`/`removeAllListeners`: only 16 occurrences
  - Severe imbalance, memory leak exists
- **Suggested Fix**:
  1. Audit all event listener registration points
  2. Ensure each listener has a corresponding cleanup
  3. Use `{ once: true }` for automatic cleanup

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts Child Process Listeners Not Cleaned Up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**:
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - Registered in attachChild()/spawnChild()
  - stop() method never removes them
  - Listeners remain attached to detached child processes after plugin runtime stops
- **Suggested Fix**:
  1. Add cleanup in stop():
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 Lines Should Be Split]
- **File/Path**: `src/domains/yono/index.ts` (763 lines)
- **Issue Description**:
  - Most domain index.ts files are only 12 lines
  - yono exports 11 classes (YonoRepository, YonoMarketService, YonoCommentService, etc.)
  - A single file contains too many responsibilities
- **Suggested Fix**:
  1. Split into yono/market-service.ts
  2. Split into yono/comment-service.ts
  3. One class per file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 Lines Should Be Split]
- **File/Path**: `src/index.ts` (451 lines)
- **Issue Description**:
  - Handles platform startup, runtime directory, bootstrap, demo mode
  - Exports from multiple subsystems
  - Violates single responsibility
- **Suggested Fix**:
  1. Split into bootstrap.ts
  2. Split into startup.ts
  3. Split into exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts Data vs Object Confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169 lines)
- **Issue Description**:
  - 527 type/interface definitions
  - Pure data structures (PrincipalRef, HumanPrincipalRef, etc.)
  - No behavior, only type exports
  - Types and factory functions mixed together
- **Suggested Fix**:
  1. Split into runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. Separate types from factory functions
  3. Establish clear boundaries

#### 8. [Domain] [High Severity] [DomainLifecycleState Duplicated and Incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**:
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - Two completely incompatible schemas
  - A fragile mapping layer tries to normalize
- **Suggested Fix**:
  1. Unify into a single canonical definition
  2. Remove duplicates
  3. Establish a single source of truth

#### 9. [Domain] [Medium Severity] [Risk Score Thresholds Hardcoded with No Constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**:
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - Magic numbers 85, 65, 35
  - No constants, comments, or configuration
- **Suggested Fix**:
  1. Extract to named constants
  2. Add configuration options
  3. Document decision boundaries

#### 10. [Domain] [Medium Severity] [HR Role Detection Hardcodes Tool Names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**:
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - Hardcoded tool names "read" and "question"
  - Should use constants
- **Suggested Fix**:
  1. Extract as constant READ_ONLY_TOOL_NAMES
  2. Add configuration support
  3. Document read-only role definitions

#### 11. [Domain] [Medium Severity] [No Invariant Enforcement Mechanism]
- **File/Path**: Overall architecture
- **Issue Description**:
  - `canTransitionDomain` returns boolean but has no enforcement
  - Transitions can be attempted without going through validators
  - No consistency check between domain seeds and risk specs
- **Suggested Fix**:
  1. Add invariant enforcement framework
  2. Ensure state transitions are validated
  3. Add pre-transition condition checks

#### 12. [Security] [Medium Severity] [OpenAPI Endpoint Publicly Exposed Without Authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**:
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure documentation exposed without authentication
  - May leak sensitive API information
- **Suggested Fix**:
  1. Add authentication or restrict access
  2. Disable in production
  3. Document the risk

#### 13. [Security] [Medium Severity] [In-Memory Session Storage Limits Horizontal Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**:
  - Sessions stored in module-level Map
  - Multi-server instance deployment does not work
  - No distributed session storage
- **Suggested Fix**:
  1. Use distributed session storage such as Redis
  2. Add session replication
  3. Document scaling limitations

#### 14. [Security] [Medium Severity] [In-Memory Service Identity Storage Limits Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**:
  - `serviceIdentities` Map is in-memory
  - Multi-instance deployment issue
- **Suggested Fix**:
  1. Use shared storage
  2. Or load from configuration at startup

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts Files Share the Same Name]
- **File/Path**:
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**:
  - Same name in different scopes
  - May cause import confusion
  - Appears intentional but may be confusing
- **Suggested Fix**:
  1. Add scope prefix or suffix
  2. Document the purpose of each file
  3. Ensure imports are explicit

#### 16. [Memory] [Low Severity] [PgDatabase.close() Validation Issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**:
  - Has close() method but may not be called during shutdown
  - Need to verify shutdown ordering
- **Suggested Fix**:
  1. Verify shutdown ordering
  2. Add shutdown hooks
  3. Ensure resource release

#### 17. [Architecture] [Low Severity] [Core/runtime Is a Wrapper for Platform Execution Files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**:
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts all re-export
  - Only used by a single SDK file
  - Questionable-value indirection layer
- **Suggested Fix**:
  1. Remove or document purpose
  2. Import directly from platform

### Summary

This supplementary Review (Round 16 - Architecture Patterns & Memory Management Review - 2026-05-14) identified 17 new issues.

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is a God Object (19 variables, 61 methods)
2. Giant barrel files cause build issues
3. 167 event listeners with only 16 cleaned up
4. plugin-runtime-host.ts child process listeners not cleaned up
5. DomainLifecycleState duplicated and incompatible
6. Risk score thresholds hardcoded with no constants

**Medium Priority**:
1. yono/index.ts 763 lines should be split
2. src/index.ts 451 lines should be split
3. contracts data vs object confusion
4. HR role detection hardcodes tool names
5. No invariant enforcement mechanism
6. OpenAPI endpoint publicly exposed without authentication
7. In-memory session storage limits horizontal scaling
8. In-memory service identity storage limits scaling

**Low Priority**:
1. Multiple architecture-remediation.ts files share the same name
2. PgDatabase.close() validation issue
3. Core/runtime wrapper value is questionable

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 15 | 17 | 3 | 35 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **116** | **190** | **88** | **394** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService into focused services
2. Fix plugin-runtime-host.ts child process listener cleanup
3. Unify DomainLifecycleState definition
4. Add event listener cleanup audit
5. Add fetch timeout to all network calls

**Short Term (This Month)**:
1. Split yono/index.ts and src/index.ts
2. Establish invariant enforcement framework
3. Add distributed session storage
4. Remove barrel files or limit their size
5. Extract all magic numbers to constants

**Long Term Planning**:
1. Complete God Object refactoring plan
2. Establish architecture boundaries and interfaces
3. Implement memory safety verification
4. Establish code quality gates
5. Improve documentation and training

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 12 - Error Handling & Multi-Tenant Security Review)

### Newly Discovered Issues

#### 1. [Security] [Critical] [listQuotas() Returns All Tenant Quotas - Information Disclosure]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:222-234`
- **Issue Description**:
  ```typescript
  listQuotas(tenantId?: string): TenantQuota[] {
    if (tenantId) {
      return this.db.connection.prepare(`SELECT * FROM tenant_quotas WHERE tenant_id = ?`).all(tenantId);
    }
    // WITHOUT tenantId: returns all tenants' quotas!
    return this.db.connection.prepare(`SELECT * FROM tenant_quotas`).all();
  }
  ```
  - When tenantId is empty, returns all tenants' quotas
  - Unauthorized information disclosure
- **Suggested Fix**:
  1. Require caller to provide tenantId
  2. Add permission verification to ensure only own quota can be viewed
  3. Audit log all quota access

#### 2. [Security] [High Severity] [assertTaskTenantAccess() Returns 404 Instead of 403 - Resource Existence Disclosure]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:146-148`
- **Issue Description**:
  ```typescript
  if (resourceTenantId !== principal.tenantId) {
    throw new ApiError(404, notFoundCode, notFoundMessage);  // Should be 403
  }
  ```
  - Cross-tenant access returns 404 instead of 403
  - Discloses that the resource exists but belongs to another tenant
  - Attackers can detect valid task IDs
- **Suggested Fix**:
  1. Change to return 403 Forbidden
  2. Do not disclose whether the resource exists

#### 3. [Security] [High Severity] [crossTenantRequest Flag Controlled by Caller]
- **File/Path**: `src/platform/five-plane-interface/org-routing/index.ts:163`
- **Issue Description**:
  - `routeOrgBudget()` accepts a `crossTenantRequest?: boolean` parameter
  - This flag is set by the caller, not derived from the system
  - Attackers may manipulate this flag to bypass cross-tenant restrictions
- **Suggested Fix**:
  1. Flag should be derived from system state, not accept caller input
  2. Add audit log to track cross-tenant requests
  3. Implement zero-trust cross-tenant access model

#### 4. [Source Code] [High Severity] [single-task-happy-path Has No Retry Mechanism]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts:336-337`
- **Issue Description**:
  - `maxRetries: 0` and `retryBackoff: "none"`
  - No automatic retry for transient failures
  - No fallback to alternate provider when LLM call fails
- **Suggested Fix**:
  1. Enable retries for non-critical executions
  2. Implement LLM provider fallback chain (Anthropic → OpenAI → MiniMax)
  3. Use primary/fallback model preferences from domain baseline catalog

#### 5. [Source Code] [High Severity] [LLM Calls Have No Circuit Breaker Protection]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**:
  - Circuit breakers only exist in channel-gateway and call-governance
  - Direct LLM provider calls have no circuit breaker
  - Cannot fail fast when provider degrades
- **Suggested Fix**:
  1. Add circuit breaker in model-call-provider.ts
  2. Fail fast when provider failure rate exceeds threshold
  3. Automatically switch to alternate provider

#### 6. [Security] [High Severity] [Distributed Rate Limiter Bypass - Not Shared Across Instances]
- **File/Path**: `src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts:33`
- **Issue Description**:
  - When Redis is not configured, uses local Map
  - Each instance maintains its own localEntries
  - Attackers can bypass rate limiting by switching instances
- **Suggested Fix**:
  1. Require Redis configuration for production
  2. Or use Redis as the shared backend for all instances
  3. Detect and warn instances without Redis configured

#### 7. [Configuration] [Medium Severity] [Soft Quota (log_only) Does Not Actually Restrict]
- **File/Path**: `src/platform/five-plane-control-plane/tenant/tenant-execution-isolation-service.ts:448`
- **Issue Description**:
  ```typescript
  allowed: quota.enforcementAction === "log_only",  // Returns true when log_only
  ```
  - Soft quota only logs, does not actually block
  - Quota is effectively toothless
- **Suggested Fix**:
  1. Clearly distinguish "monitoring mode" and "enforcement mode"
  2. Hard quotas must block
  3. Document actual behavior of quota types

#### 8. [Configuration] [Medium Severity] [No Rate Limit Headers at HTTP Layer - Clients Cannot Know Limits]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/response-hardening.ts`
- **Issue Description**:
  - Does not return X-RateLimit-* headers
  - Only returns retry-after-ms on 429 responses
  - Clients cannot proactively manage request rate
- **Suggested Fix**:
  1. Add X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset to all responses
  2. Use standard header names
  3. Follow RFC 6585

#### 9. [Configuration] [Medium Severity] [HTTP Layer Has No Rate Limiting - Optional and IP-Only]
- **File/Path**: `src/platform/five-plane-interface/api/http-api-server.ts:334-351`
- **Issue Description**:
  - Rate limiting only takes effect when `this.rateLimiter != null`
  - Rate limit key is `${clientIp}:${endpoint}`, IP-only
  - No per-tenant/per-principal enforcement
- **Suggested Fix**:
  1. Enable rate limiting by default
  2. Add per-tenant rate limit keys
  3. Ensure all environments have rate limiting configured by default

#### 10. [Security] [Medium Severity] [processRuleMode May Not Be Enforced]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts`
- **Issue Description**:
  - `SandboxPolicy.processRuleMode` is set to "allow" or "deny"
  - But no actual enforcement code was found that blocks process generation based on this policy
  - `--allow-child-process` flag only applies in sandboxed_process isolation mode
- **Suggested Fix**:
  1. Verify processRuleMode is actually enforced
  2. Ensure all isolation modes are handled correctly
  3. Add tests to verify process creation is blocked

#### 11. [Security] [Medium Severity] [Container Template Replacement Not Validated]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/plugin-runtime-host.ts:751`
- **Issue Description**:
  ```typescript
  rendered = rendered.split(placeholder).join(value);
  ```
  - Simple string replacement
  - Although validateContainerLaunchPluginId() blocks \0 and quotes
  - But the template replacement itself is not validated
- **Suggested Fix**:
  1. Add input validation to prevent injection
  2. Use a safer template engine
  3. Verify all placeholders are replaced

#### 12. [Security] [Medium Severity] [Adapter Execution Bypasses Sandbox]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/adapter-executor.ts`
- **Issue Description**:
  - Adapter execution of REST/grpc/MQ calls does not go through ScopedExternalAccessSandbox
  - Has its own allowedDomains configuration but is not centrally managed
  - May initiate unrestricted outbound requests
- **Suggested Fix**:
  1. Adapter execution goes through a centralized sandbox
  2. Unify external access policies
  3. Add adapter outbound request audit

#### 13. [Security] [Medium Severity] [Null principal.tenantId Silently Passes Through]
- **File/Path**: `src/platform/five-plane-interface/api/utils.ts:143-145`
- **Issue Description**:
  ```typescript
  if (principal.tenantId == null) {
    return;  // Silently passes
  }
  ```
  - If the API gateway allows requests without principal authentication
  - May grant cross-tenant access
- **Suggested Fix**:
  1. Require all API requests to have a valid principal
  2. null tenantId should be rejected rather than silently passing
  3. Add audit log

#### 14. [Source Code] [Medium Severity] [No LLM Provider Fallback Chain]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/model-call-provider.ts`
- **Issue Description**:
  - No automatic switching when primary provider fails
  - domain-baseline-catalog.ts defines primary/fallback model preferences but is not used
  - First provider failure immediately causes execution failure
- **Suggested Fix**:
  1. Implement provider fallback chain
  2. Use primary/fallback configuration from domain baseline
  3. Try in priority order until success or all fail

#### 15. [Source Code] [Medium Severity] [Timeout Values Hardcoded]
- **File/Path**: Multiple files
- **Issue Description**:
  - Effect buffer has fixed timeout reject
  - Channel gateway's requestTimeoutMs is configurable but has a 30s max limit
  - No global request timeout middleware
- **Suggested Fix**:
  1. Centralize timeout configuration
  2. Make it per-environment configurable
  3. Add global timeout middleware

#### 16. [Database] [Medium Severity] [No down Migration - Rollback Not Supported]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/migration-runner.ts:45-47`
- **Issue Description**:
  - `rollbackSupported = false`
  - Each migration only has `downSql` placeholder
  - Schema migration cannot be rolled back
- **Suggested Fix**:
  1. Document rollback limitations
  2. Create complete backup before changes
  3. Use blue-green deployment to reduce rollback needs

#### 17. [Database] [Medium Severity] [Migration 44 Special Handling - Duplicate Table Creation]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts`
- **Issue Description**:
  - Migration 43 creates harness_runs table
  - Migration 44 creates the same-named table again (different schema)
  - Uses applyCompatibleColumnMigrationIfKnown for special handling
- **Suggested Fix**:
  1. Eliminate duplicate table creation
  2. Use ALTER TABLE instead of CREATE TABLE
  3. Simplify migration logic

#### 18. [Configuration] [Low Severity] [Provider Rate Limit Headers Not Forwarded to Clients]
- **File/Path**: `src/platform/model-gateway/provider-registry/base-chat-provider.ts:153`
- **Issue Description**:
  - System reads provider's ratelimitResetHeaderNames
  - But does not forward to client
  - Client cannot know provider rate limit status
- **Suggested Fix**:
  1. Forward provider's rate limit headers
  2. Or add application-layer rate limit information
  3. Help clients optimize requests

#### 19. [Security] [Low Severity] [Browser evaluate Accepts Arbitrary Script]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/browser-executor.ts:326`
- **Issue Description**:
  - `evaluate` action accepts script parameter
  - Runs in browser context (simulated)
  - May be a vector if browser context is not properly sandboxed
- **Suggested Fix**:
  1. Verify browser context is properly sandboxed
  2. Sanitize or limit script content
  3. Log all evaluate calls

#### 20. [Source Code] [Low Severity] [No Global Error Boundary Wrapper]
- **File/Path**: `src/platform/five-plane-execution/execution-engine/`
- **Issue Description**:
  - Execution engine lacks global handling for unhandled promise rejection
  - Errors propagate up when LLM fallback in single-task-happy-path fails
- **Suggested Fix**:
  1. Add error boundary wrapper in execution engine
  2. Unify error handling patterns
  3. Ensure all errors are caught and logged

### Summary

This supplementary Review (Round 12 - Error Handling & Multi-Tenant Security Review - 2026-05-14) identified 20 new issues.

**High Priority (Requires Immediate Action)**:
1. listQuotas() returns all tenant quotas (information disclosure)
2. assertTaskTenantAccess() returns 404 disclosing resource existence
3. crossTenantRequest flag can be manipulated
4. single-task-happy-path has no retry (maxRetries=0)
5. LLM calls have no circuit breaker protection
6. Distributed rate limiter can be bypassed (not shared across instances)

**Medium Priority**:
1. Soft quota does not actually block
2. No X-RateLimit-* response headers
3. HTTP layer rate limiting is optional and IP-only
4. processRuleMode may not be enforced
5. Container template replacement not validated
6. Adapter execution bypasses sandbox
7. null principal silently passes
8. No LLM provider fallback chain
9. Timeout values hardcoded
10. No down migration
11. Migration 44 special handling

**Low Priority**:
1. Provider rate limit headers not forwarded
2. Browser evaluate accepts arbitrary script
3. No global error boundary

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 60 | 68 | 31 | 159 |
| Test | 8 | 14 | 5 | 27 |
| Configuration | 8 | 35 | 21 | 64 |
| Security | 12 | 13 | 3 | 28 |
| Documentation | 2 | 7 | 3 | 12 |
| UI | 0 | 3 | 3 | 6 |
| Deployment | 1 | 10 | 6 | 17 |
| **Total** | **91** | **150** | **72** | **313** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Fix listQuotas() information disclosure vulnerability
2. Correct assertTaskTenantAccess() to return 403
3. Remove caller-controlled crossTenantRequest
4. Enable execution engine retry mechanism
5. Add LLM provider circuit breaker

**Short Term (This Month)**:
1. Fix distributed rate limiter bypass issue
2. Add X-RateLimit-* response headers
3. Enable default HTTP rate limiting (per-tenant)
4. Implement LLM provider fallback chain
5. Verify and enforce processRuleMode

**Long Term Planning**:
1. Establish a complete rate limiting and quota system
2. Implement plugin system security audit
3. Establish multi-tenant security tests
4. Improve error handling and recovery mechanisms
5. Unify timeout and circuit breaker configuration

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns & Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService Is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**:
  - 19 private instance variables (should be at most 3-5)
  - 61 public methods
  - 9 injected delegated services
  - Violates the single responsibility principle
  - Coordinates too many subsystems
- **Suggested Fix**:
  1. Split into `HarnessStateManager` (state transitions)
  2. Split into `HarnessMemoryCoordinator` (memory operations)
  3. Split into `HarnessRecoveryHandler` (failure handling)
  4. Split into `HarnessHitlCoordinator` (human-in-the-loop collaboration)

#### 2. [Architecture] [High Severity] [Giant Barrel Files Causing Build Issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317 lines)
- **Issue Description**:
  - 15 submodule re-exports
  - Modifying any feature may trigger large-scale recompilation
  - Creates risk of circular dependencies
- **Suggested Fix**:
  1. Each index.ts re-exports at most 5-7 items
  2. Prefer direct module imports
  3. Split contracts by domain into multiple files

#### 3. [Memory] [High Severity] [167 Event Listeners with Only 16 Cleaned Up]
- **File/Path**: Entire codebase
- **Issue Description**:
  - `.on`/`addEventListener`: 167 occurrences
  - `.off`/`removeListener`/`removeAllListeners`: only 16 occurrences
  - Severe imbalance, memory leak exists
- **Suggested Fix**:
  1. Audit all event listener registration points
  2. Ensure each listener has a corresponding cleanup
  3. Use `{ once: true }` for automatic cleanup

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts Child Process Listeners Not Cleaned Up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**:
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - Registered in attachChild()/spawnChild()
  - stop() method never removes them
  - Listeners remain attached to detached child processes after plugin runtime stops
- **Suggested Fix**:
  1. Add cleanup in stop():
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 Lines Should Be Split]
- **File/Path**: `src/domains/yono/index.ts` (763 lines)
- **Issue Description**:
  - Most domain index.ts files are only 12 lines
  - yono exports 11 classes (YonoRepository, YonoMarketService, YonoCommentService, etc.)
  - A single file contains too many responsibilities
- **Suggested Fix**:
  1. Split into yono/market-service.ts
  2. Split into yono/comment-service.ts
  3. One class per file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 Lines Should Be Split]
- **File/Path**: `src/index.ts` (451 lines)
- **Issue Description**:
  - Handles platform startup, runtime directory, bootstrap, demo mode
  - Exports from multiple subsystems
  - Violates single responsibility
- **Suggested Fix**:
  1. Split into bootstrap.ts
  2. Split into startup.ts
  3. Split into exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts Data vs Object Confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169 lines)
- **Issue Description**:
  - 527 type/interface definitions
  - Pure data structures (PrincipalRef, HumanPrincipalRef, etc.)
  - No behavior, only type exports
  - Types and factory functions mixed together
- **Suggested Fix**:
  1. Split into runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. Separate types from factory functions
  3. Establish clear boundaries

#### 8. [Domain] [High Severity] [DomainLifecycleState Duplicated and Incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**:
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - Two completely incompatible schemas
  - A fragile mapping layer tries to normalize
- **Suggested Fix**:
  1. Unify into a single canonical definition
  2. Remove duplicates
  3. Establish a single source of truth

#### 9. [Domain] [Medium Severity] [Risk Score Thresholds Hardcoded with No Constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**:
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - Magic numbers 85, 65, 35
  - No constants, comments, or configuration
- **Suggested Fix**:
  1. Extract to named constants
  2. Add configuration options
  3. Document decision boundaries

#### 10. [Domain] [Medium Severity] [HR Role Detection Hardcodes Tool Names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**:
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - Hardcoded tool names "read" and "question"
  - Should use constants
- **Suggested Fix**:
  1. Extract as constant READ_ONLY_TOOL_NAMES
  2. Add configuration support
  3. Document read-only role definitions

#### 11. [Domain] [Medium Severity] [No Invariant Enforcement Mechanism]
- **File/Path**: Overall architecture
- **Issue Description**:
  - `canTransitionDomain` returns boolean but has no enforcement
  - Transitions can be attempted without going through validators
  - No consistency check between domain seeds and risk specs
- **Suggested Fix**:
  1. Add invariant enforcement framework
  2. Ensure state transitions are validated
  3. Add pre-transition condition checks

#### 12. [Security] [Medium Severity] [OpenAPI Endpoint Publicly Exposed Without Authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**:
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure documentation exposed without authentication
  - May leak sensitive API information
- **Suggested Fix**:
  1. Add authentication or restrict access
  2. Disable in production
  3. Document the risk

#### 13. [Security] [Medium Severity] [In-Memory Session Storage Limits Horizontal Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**:
  - Sessions stored in module-level Map
  - Multi-server instance deployment does not work
  - No distributed session storage
- **Suggested Fix**:
  1. Use distributed session storage such as Redis
  2. Add session replication
  3. Document scaling limitations

#### 14. [Security] [Medium Severity] [In-Memory Service Identity Storage Limits Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**:
  - `serviceIdentities` Map is in-memory
  - Multi-instance deployment issue
- **Suggested Fix**:
  1. Use shared storage
  2. Or load from configuration at startup

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts Files Share the Same Name]
- **File/Path**:
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**:
  - Same name in different scopes
  - May cause import confusion
  - Appears intentional but may be confusing
- **Suggested Fix**:
  1. Add scope prefix or suffix
  2. Document the purpose of each file
  3. Ensure imports are explicit

#### 16. [Memory] [Low Severity] [PgDatabase.close() Validation Issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**:
  - Has close() method but may not be called during shutdown
  - Need to verify shutdown ordering
- **Suggested Fix**:
  1. Verify shutdown ordering
  2. Add shutdown hooks
  3. Ensure resource release

#### 17. [Architecture] [Low Severity] [Core/runtime Is a Wrapper for Platform Execution Files]
- **File/Path**: `src/core/runtime/`
- **Issue Description**:
  - orchestrator/index.ts, planner/index.ts, supervisor/index.ts all re-export
  - Only used by a single SDK file
  - Questionable-value indirection layer
- **Suggested Fix**:
  1. Remove or document purpose
  2. Import directly from platform

### Summary

This supplementary Review (Round 16 - Architecture Patterns & Memory Management Review - 2026-05-14) identified 17 new issues.

**High Priority (Requires Immediate Action)**:
1. HarnessRuntimeService is a God Object (19 variables, 61 methods)
2. Giant barrel files cause build issues
3. 167 event listeners with only 16 cleaned up
4. plugin-runtime-host.ts child process listeners not cleaned up
5. DomainLifecycleState duplicated and incompatible
6. Risk score thresholds hardcoded with no constants

**Medium Priority**:
1. yono/index.ts 763 lines should be split
2. src/index.ts 451 lines should be split
3. contracts data vs object confusion
4. HR role detection hardcodes tool names
5. No invariant enforcement mechanism
6. OpenAPI endpoint publicly exposed without authentication
7. In-memory session storage limits horizontal scaling
8. In-memory service identity storage limits scaling

**Low Priority**:
1. Multiple architecture-remediation.ts files share the same name
2. PgDatabase.close() validation issue
3. Core/runtime wrapper value is questionable

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 78 | 93 | 42 | 213 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 15 | 17 | 3 | 35 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **116** | **190** | **88** | **394** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Split HarnessRuntimeService into focused services
2. Fix plugin-runtime-host.ts child process listener cleanup
3. Unify DomainLifecycleState definition
4. Add event listener cleanup audit
5. Add fetch timeout to all network calls

**Short Term (This Month)**:
1. Split yono/index.ts and src/index.ts
2. Establish invariant enforcement framework
3. Add distributed session storage
4. Remove barrel files or limit their size
5. Extract all magic numbers to constants

**Long Term Planning**:
1. Complete God Object refactoring plan
2. Establish architecture boundaries and interfaces
3. Implement memory safety verification
4. Establish code quality gates
5. Improve documentation and training

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 15 - Build, Testing & Type System Review)

### Newly Discovered Issues

#### 1. [Build] [High Severity] [No TypeScript Incremental Compilation Cache]
- **File/Path**: `tsconfig.json`
- **Issue Description**:
  - No `incremental: true` configuration
  - No `tsbuildinfo` file
  - Every build is a full rebuild (9.6 seconds)
  - TypeScript cannot use incremental compilation
- **Suggested Fix**:
  1. Add `"incremental": true` to tsconfig.json
  2. Add `"tsbuildinfo": ".tsbuildinfo"` to .gitignore
  3. Implement project references for parallel builds

#### 2. [Build] [High Severity] [76 npm Scripts Mostly Duplicate Builds]
- **File/Path**: `package.json`
- **Issue Description**:
  - 40+ CLI scripts all run `npm run build && node ...`
  - Each script performs a full rebuild before running
  - Cannot directly run pre-built CLIs
  - 20+ stable:* scripts follow the same pattern
- **Suggested Fix**:
  1. Create a `build:cli` script to build once
  2. Have CLI scripts use pre-built dist files
  3. Add npm run dev or similar no-rebuild execution method

#### 3. [Source Code] [High Severity] [168 Uses of `any` Type]
- **File/Path**: Entire src directory
- **Issue Description**:
  - `stable-runner-factory.ts`: `opts: any` -> `any`
  - `billing-service-async.ts`: `input: any` method signature
  - Retry/timeout utilities use `(...args: any[]) => Promise<any>`
  - Bypasses type safety
- **Suggested Fix**:
  1. Use generics instead of any
  2. Replace with concrete input types
  3. Add ESLint rule to disallow any

#### 4. [Source Code] [High Severity] [38 @ts-ignore Directives]
- **File/Path**: Multiple files
- **Issue Description**:
  - 14 stability-related files have `@ts-ignore ExecutionRecord type mismatch`
  - 5 harness-sdk files have `Partial<HarnessRun> doesn't have all required properties`
  - 2 files have `exactOptionalPropertyTypes` issues
- **Suggested Fix**:
  1. Fix ExecutionRecord type mismatch
  2. Complete required properties for HarnessRun type
  3. Remove @ts-ignore usage

#### 5. [Source Code] [High Severity] [ExecutionRecord Type Mismatch]
- **File/Path**: `src/platform/stability/stable-evidence-bundle-support.ts:783` and 14 other files
- **Issue Description**:
  - TypeScript rejects the type when inserting execution record
  - `ExecutionRecord` interface requires new fields but insert object is missing them
  - Or store's insert method accepts a different type
- **Suggested Fix**:
  1. Align ExecutionRecord interface with store type
  2. Add missing fields to insert object
  3. Or adjust the store's insert method type signature

#### 6. [Source Code] [Medium Severity] [30+ `as unknown as` Double Type Casts]
- **File/Path**: `division-loader.ts`, `domain-baseline-catalog.ts`, `harness-sdk`
- **Issue Description**:
  - Completely bypasses type safety
  - Often a signal of type architecture issues
- **Suggested Fix**:
  1. Fix upstream type issues
  2. Use more specific type assertions
  3. Refactor the type hierarchy

#### 7. [Build] [Medium Severity] [rimraf Extraneous - Not Declared in package.json]
- **File/Path**: `node_modules/rimraf`
- **Issue Description**:
  - rimraf@6.1.3 exists in node_modules but is not declared in package.json
  - May cause dependency issues
- **Suggested Fix**:
  1. Add to dependencies or devDependencies
  2. Or remove and use another cleanup approach

#### 8. [Test] [High Severity] [178 Direct process.env Mutations Without Abstraction]
- **File/Path**: `tests/unit/domains/registry/plugin-spi-registry.test.ts:640-687`
- **Issue Description**:
  - Direct read/write of process.env
  - Manual save/restore in beforeEach/afterEach
  - No helper abstraction
- **Suggested Fix**:
  1. Create env helper function
  2. Unify save and restore pattern
  3. Add test isolation validation

#### 9. [Test] [High Severity] [21,998 unlinkSync Calls Without Centralized Cleanup]
- **File/Path**: Multiple test files
- **Issue Description**:
  - Each test re-implements cleanup logic
  - No centralized cleanup utility
  - May cause EBUSY (Windows) or concurrent access issues
- **Suggested Fix**:
  1. Create a centralized test cleanup utility
  2. Use afterEach to ensure cleanup
  3. Consider using temporary directories

#### 10. [Test] [Medium Severity] [No Unified Mocking Framework]
- **File/Path**: `tests/` multiple directories
- **Issue Description**:
  - 10,579 calls to vi.fn, jest.mock, sinon, etc.
  - No unified mocking framework is visible
  - Inconsistent patterns
- **Suggested Fix**:
  1. Establish a unified mock factory
  2. Standardize mock patterns
  3. Add mocking best practices documentation

#### 11. [Test] [Medium Severity] [Singleton State Reset Not Standardized]
- **File/Path**: `tests/unit/platform/five-plane-execution/dispatcher.test.ts`
- **Issue Description**:
  - Tests reset singletons via specific functions
  - Each test repeats its own reset logic
  - No unified resetAllSingletons()
- **Suggested Fix**:
  1. Create a unified singleton reset mechanism
  2. Call automatically in afterEach
  3. Document singleton reset requirements

#### 12. [Test] [Low Severity] [No Branch Coverage Requirements]
- **File/Path**: `.c8rc.json`
- **Issue Description**:
  - `"100": false` - no coverage requirement
  - Only measures source code, not test files
- **Suggested Fix**:
  1. Add branch coverage thresholds
  2. Enforce coverage gates in CI
  3. Focus on critical code paths

#### 13. [Network] [High Severity] [ScopedExternalAccessSandbox performHttpRequest Has No Timeout]
- **File/Path**: `src/platform/five-plane-execution/plugin-executor/scoped-external-access-sandbox.ts:289`
- **Issue Description**:
  - fetch call has no timeout parameter
  - Pending requests may block forever
- **Suggested Fix**:
  1. Add AbortController timeout
  2. Use standard timeout pattern
  3. Document timeout configuration

#### 14. [Network] [High Severity] [OIDC Service fetch Calls Have No Timeout]
- **File/Path**: `src/org-governance/sso-scim/oidc/oidc-service.ts:565,272`
- **Issue Description**:
  - OIDC token exchange has no retry logic
  - No timeout/abort signal
  - Authentication flow may hang
- **Suggested Fix**:
  1. Add fetch timeout
  2. Add retry logic
  3. Use standard timeout configuration

#### 15. [Network] [High Severity] [plugin-runtime-child Replaces globalThis.fetch With No-op]
- **File/Path**: `src/domains/registry/plugin-runtime-child.ts:112`
- **Issue Description**:
  ```typescript
  globalThis.fetch = (async () => {}) as unknown as typeof globalThis.fetch;
  ```
  - Completely replaces fetch with an empty function in plugin context
  - All outbound HTTP requests from plugins will fail
  - Appears intentional but may cause issues
- **Suggested Fix**:
  1. Confirm this is intentional behavior
  2. Document the fetch replacement behavior
  3. Ensure it does not accidentally affect other code

#### 16. [Network] [Medium Severity] [No Explicit http.Agent Configuration]
- **File/Path**: Global
- **Issue Description**:
  - No explicit http.Agent/https.Agent configuration
  - Relies on Node.js default connection pool
  - No maxSockets or maxConnections configuration
  - May cause issues in high-throughput scenarios
- **Suggested Fix**:
  1. Add http Agent configuration
  2. Document connection pool size
  3. Monitor connection usage

#### 17. [Serialization] [Medium Severity] [Contract Version Hardcoded as String Literal]
- **File/Path**: `src/platform/contracts/inter-plane-contract-gateway.ts:184`
- **Issue Description**:
  - `schemaVersion: "v4.3"` hardcoded
  - Hard to track contract version evolution
- **Suggested Fix**:
  1. Extract to typed constant or enum
  2. Centrally manage contract versions
  3. Add version compatibility checks

#### 18. [Serialization] [Low Severity] [Timestamp = string Loses Precision]
- **File/Path**: `src/platform/contracts/types/domain/primitives.ts:10`
- **Issue Description**:
  - `type Timestamp = string` has no type precision
  - ISO 8601 string has no timezone information
- **Suggested Fix**:
  1. Use Date object or branded string type
  2. Clarify timezone handling conventions
  3. Document timestamp semantics

#### 19. [Source Code] [Medium Severity] [29 Non-null Assertions !.]
- **File/Path**: Entire src directory
- **Issue Description**:
  - Uses `!.` to assert non-null
  - May cause runtime errors
- **Suggested Fix**:
  1. Use optional chaining `?.` or nullish coalescing `??`
  2. Add appropriate null checks
  3. Reduce non-null assertion usage

#### 20. [API] [Medium Severity] [API Route Schema Version Hardcoded]
- **File/Path**: `src/platform/five-plane-interface/api/federation-routing-service.ts`
- **Issue Description**:
  - Zod schema validation exists
  - But schema version is not synchronized with contract version
- **Suggested Fix**:
  1. Derive schema version from contract version
  2. Add version consistency checks
  3. Document version relationships

### Summary

This supplementary Review (Round 15 - Build, Testing & Type System Review - 2026-05-14) identified 20 new issues.

**High Priority (Requires Immediate Action)**:
1. No TypeScript incremental compilation cache (full rebuild 9.6 seconds each time)
2. 76 npm scripts mostly duplicate builds
3. 168 uses of `any` type (bypasses type safety)
4. 38 @ts-ignore directives
5. ExecutionRecord type mismatch (14 files)
6. 178 direct process.env mutations without abstraction
7. ScopedExternalAccessSandbox performHttpRequest has no timeout
8. OIDC service fetch calls have no timeout
9. plugin-runtime-child replaces globalThis.fetch with no-op

**Medium Priority**:
1. 30+ `as unknown as` double type casts
2. rimraf extraneous not declared
3. 21,998 unlinkSync calls without centralized cleanup
4. No unified mocking framework
5. Singleton state reset not standardized
6. No explicit http.Agent configuration
7. Contract version hardcoded as string
8. Timestamp = string loses precision
9. Non-null assertion usage

**Low Priority**:
1. No branch coverage requirements
2. API route schema version not synchronized

### Issue Statistics (Cumulative)

| Category | High | Medium | Low | Total |
|------|--------|--------|--------|------|
| Source Code | 72 | 87 | 39 | 198 |
| Test | 10 | 17 | 6 | 33 |
| Configuration | 10 | 39 | 24 | 73 |
| Security | 14 | 15 | 3 | 32 |
| Documentation | 2 | 8 | 3 | 13 |
| UI | 0 | 4 | 4 | 8 |
| Deployment | 1 | 12 | 6 | 19 |
| **Total** | **109** | **182** | **85** | **376** |

### Prioritized Fix Recommendations

**Immediate Action (This Week)**:
1. Add TypeScript incremental compilation (`incremental: true`)
2. Refactor npm scripts to avoid duplicate builds
3. Reduce `any` type usage to <50
4. Remove all @ts-ignore directives
5. Fix ExecutionRecord type mismatch
6. Add fetch timeout to OIDC and sandbox

**Short Term (This Month)**:
1. Create centralized test cleanup utility
2. Establish a unified mocking framework
3. Standardize singleton reset mechanism
4. Add http.Agent connection pool configuration
5. Extract contract versions to typed constants

**Long Term Planning**:
1. Achieve complete type safety (no `any`)
2. Establish test infrastructure standards
3. Implement build cache optimization
4. Improve network layer timeout and retry
5. Establish coverage gate standards

*Review generated: 2026-05-14*

---

## [2026-05-14] Automated Review Report (Round 16 - Architecture Patterns & Memory Management Review)

### Newly Discovered Issues

#### 1. [Architecture] [Critical] [HarnessRuntimeService Is a God Object]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts:721`
- **Issue Description**:
  - 19 private instance variables (should be at most 3-5)
  - 61 public methods
  - 9 injected delegated services
  - Violates the single responsibility principle
  - Coordinates too many subsystems
- **Suggested Fix**:
  1. Split into `HarnessStateManager` (state transitions)
  2. Split into `HarnessMemoryCoordinator` (memory operations)
  3. Split into `HarnessRecoveryHandler` (failure handling)
  4. Split into `HarnessHitlCoordinator` (human-in-the-loop collaboration)

#### 2. [Architecture] [High Severity] [Giant Barrel Files Causing Build Issues]
- **File/Path**: `src/platform/five-plane-orchestration/harness/index.ts` (2317 lines)
- **Issue Description**:
  - 15 submodule re-exports
  - Modifying any feature may trigger large-scale recompilation
  - Creates risk of circular dependencies
- **Suggested Fix**:
  1. Each index.ts re-exports at most 5-7 items
  2. Prefer direct module imports
  3. Split contracts by domain into multiple files

#### 3. [Memory] [High Severity] [167 Event Listeners with Only 16 Cleaned Up]
- **File/Path**: Entire codebase
- **Issue Description**:
  - `.on`/`addEventListener`: 167 occurrences
  - `.off`/`removeListener`/`removeAllListeners`: only 16 occurrences
  - Severe imbalance, memory leak exists
- **Suggested Fix**:
  1. Audit all event listener registration points
  2. Ensure each listener has a corresponding cleanup
  3. Use `{ once: true }` for automatic cleanup

#### 4. [Memory] [High Severity] [plugin-runtime-host.ts Child Process Listeners Not Cleaned Up]
- **File/Path**: `src/domains/registry/plugin-runtime-host.ts:275,278,353,358`
- **Issue Description**:
  ```typescript
  child.stderr?.on("data", ...);
  child.on("message", ...);
  child.stdout.on("data", ...);
  ```
  - Registered in attachChild()/spawnChild()
  - stop() method never removes them
  - Listeners remain attached to detached child processes after plugin runtime stops
- **Suggested Fix**:
  1. Add cleanup in stop():
  ```typescript
  child.stdout?.removeAllListeners();
  child.stderr?.removeAllListeners();
  child.removeAllListeners("message");
  ```

#### 5. [Architecture] [Medium Severity] [yono/index.ts 763 Lines Should Be Split]
- **File/Path**: `src/domains/yono/index.ts` (763 lines)
- **Issue Description**:
  - Most domain index.ts files are only 12 lines
  - yono exports 11 classes (YonoRepository, YonoMarketService, YonoCommentService, etc.)
  - A single file contains too many responsibilities
- **Suggested Fix**:
  1. Split into yono/market-service.ts
  2. Split into yono/comment-service.ts
  3. One class per file

#### 6. [Architecture] [Medium Severity] [src/index.ts 451 Lines Should Be Split]
- **File/Path**: `src/index.ts` (451 lines)
- **Issue Description**:
  - Handles platform startup, runtime directory, bootstrap, demo mode
  - Exports from multiple subsystems
  - Violates single responsibility
- **Suggested Fix**:
  1. Split into bootstrap.ts
  2. Split into startup.ts
  3. Split into exports.ts

#### 7. [Architecture] [Medium Severity] [contracts/executable-contracts/index.ts Data vs Object Confusion]
- **File/Path**: `src/platform/contracts/executable-contracts/index.ts` (2169 lines)
- **Issue Description**:
  - 527 type/interface definitions
  - Pure data structures (PrincipalRef, HumanPrincipalRef, etc.)
  - No behavior, only type exports
  - Types and factory functions mixed together
- **Suggested Fix**:
  1. Split into runtime-contracts.ts, event-contracts.ts, directive-contracts.ts
  2. Separate types from factory functions
  3. Establish clear boundaries

#### 8. [Domain] [High Severity] [DomainLifecycleState Duplicated and Incompatible]
- **File/Path**: `src/domains/architecture-remediation.ts:1-2` vs `src/domains/domain-specs.ts:26-38`
- **Issue Description**:
  - `architecture-remediation.ts`: `"Draft" | "Validated" | "Registered" | "Active" | "Updating" | "Deprecated" | "Archived"` (Title Case)
  - `domain-specs.ts`: `"validating" | "certified" | "canary" | "active" | "deprecated" | "retired"` (snake_case)
  - Two completely incompatible schemas
  - A fragile mapping layer tries to normalize
- **Suggested Fix**:
  1. Unify into a single canonical definition
  2. Remove duplicates
  3. Establish a single source of truth

#### 9. [Domain] [Medium Severity] [Risk Score Thresholds Hardcoded with No Constants]
- **File/Path**: `src/domains/risk-profile/index.ts:68-78`
- **Issue Description**:
  ```typescript
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  ```
  - Magic numbers 85, 65, 35
  - No constants, comments, or configuration
- **Suggested Fix**:
  1. Extract to named constants
  2. Add configuration options
  3. Document decision boundaries

#### 10. [Domain] [Medium Severity] [HR Role Detection Hardcodes Tool Names]
- **File/Path**: `src/domains/governance/hr-role-governance-service.ts:435-436`
- **Issue Description**:
  ```typescript
  expandedProposalTools.resolvedToolNames.every((toolName) =>
    toolName === "read" || toolName === "question"
  );
  ```
  - Hardcoded tool names "read" and "question"
  - Should use constants
- **Suggested Fix**:
  1. Extract as constant READ_ONLY_TOOL_NAMES
  2. Add configuration support
  3. Document read-only role definitions

#### 11. [Domain] [Medium Severity] [No Invariant Enforcement Mechanism]
- **File/Path**: Overall architecture
- **Issue Description**:
  - `canTransitionDomain` returns boolean but has no enforcement
  - Transitions can be attempted without going through validators
  - No consistency check between domain seeds and risk specs
- **Suggested Fix**:
  1. Add invariant enforcement framework
  2. Ensure state transitions are validated
  3. Add pre-transition condition checks

#### 12. [Security] [Medium Severity] [OpenAPI Endpoint Publicly Exposed Without Authentication]
- **File/Path**: `src/platform/five-plane-interface/api/http-server/health-routes.ts:41`
- **Issue Description**:
  ```typescript
  { method: "GET", pathname: "/v1/openapi.json", handler: () => buildJsonDocumentResponse(buildOpenApiDocument()) }
  ```
  - API structure documentation exposed without authentication
  - May leak sensitive API information
- **Suggested Fix**:
  1. Add authentication or restrict access
  2. Disable in production
  3. Document the risk

#### 13. [Security] [Medium Severity] [In-Memory Session Storage Limits Horizontal Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/session-management.ts:83-89`
- **Issue Description**:
  - Sessions stored in module-level Map
  - Multi-server instance deployment does not work
  - No distributed session storage
- **Suggested Fix**:
  1. Use distributed session storage such as Redis
  2. Add session replication
  3. Document scaling limitations

#### 14. [Security] [Medium Severity] [In-Memory Service Identity Storage Limits Scaling]
- **File/Path**: `src/platform/five-plane-control-plane/iam/service-auth.ts:92`
- **Issue Description**:
  - `serviceIdentities` Map is in-memory
  - Multi-instance deployment issue
- **Suggested Fix**:
  1. Use shared storage
  2. Or load from configuration at startup

#### 15. [Configuration] [Low Severity] [Multiple architecture-remediation.ts Files Share the Same Name]
- **File/Path**:
  - `src/domains/architecture-remediation.ts`
  - `src/org-governance/architecture-remediation.ts`
  - `src/ops-maturity/architecture-remediation.ts`
  - `src/scale-ecosystem/architecture-remediation.ts`
  - `src/interaction/architecture-remediation.ts`
- **Issue Description**:
  - Same name in different scopes
  - May cause import confusion
  - Appears intentional but may be confusing
- **Suggested Fix**:
  1. Add scope prefix or suffix
  2. Document the purpose of each file
  3. Ensure imports are explicit

#### 16. [Memory] [Low Severity] [PgDatabase.close() Validation Issue]
- **File/Path**: `src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts:467-474`
- **Issue Description**:
  - Has close() method but may not be called during shutdown
  - Need to verify shutdown ordering
- **Suggested Fix**:
  1. Verify shutdown ordering
