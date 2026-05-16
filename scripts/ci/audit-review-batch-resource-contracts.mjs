import { readdirSync, readFileSync, statSync } from "node:fs";

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function readTreeFiles(root, predicate) {
  const output = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (predicate(path)) {
        output.push(path);
      }
    }
  };
  visit(root);
  return output;
}

function countTreeFiles(root) {
  try {
    return readTreeFiles(root, () => true).length;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

const riskProfile = read("src/domains/risk-profile/index.ts");
check(
  "risk score thresholds are named constants",
  riskProfile.includes("DOMAIN_RISK_SCORE_THRESHOLDS") && !/score >= (85|65|35)/.test(riskProfile),
  "DOMAIN_RISK_SCORE_THRESHOLDS drives computeDomainRiskLevel",
);

const hrGovernance = read("src/domains/governance/hr-role-governance-service.ts");
check(
  "HR read-only tool detection uses named set",
  hrGovernance.includes("HR_READ_ONLY_TOOL_NAMES") && !hrGovernance.includes('toolName === "read" || toolName === "question"'),
  "HR_READ_ONLY_TOOL_NAMES replaces inline read/question checks",
);

const apiUtils = read("src/platform/five-plane-interface/api/http-server/utils.ts");
check(
  "tenant access mismatch returns 403",
  apiUtils.includes('new ApiError(403, "api.tenant_scope_mismatch"') && apiUtils.includes('new ApiError(403, "api.tenant_scope_required"'),
  "assertTaskTenantAccess denies missing or mismatched tenant with 403",
);

const healthRoutes = read("src/platform/five-plane-interface/api/http-server/health-routes.ts");
check(
  "health routes split liveness and readiness",
  healthRoutes.includes('pathname: "/livez"') && healthRoutes.includes('pathname: "/readyz"') && healthRoutes.includes("isShuttingDown"),
  "livez/readyz are separate and readiness observes shutdown",
);

const httpApiServer = read("src/platform/five-plane-interface/api/http-api-server.ts");
check(
  "HTTP rate limit responses expose client headers",
  httpApiServer.includes("attachRateLimitHeaders") && httpApiServer.includes("x-ratelimit-remaining") && httpApiServer.includes("retry-after"),
  "rate-limit allowed and denied responses include remaining/retry headers",
);
check(
  "HTTP API server enables a default rate limiter",
  httpApiServer.includes("createDefaultApiRateLimiter(process.env)") &&
    httpApiServer.includes("AA_API_RATE_LIMIT_DISABLED") &&
    httpApiServer.includes("AA_API_RATE_LIMIT_REDIS"),
  "rate limiting is on by default and can use Redis or an explicit disable flag",
);

const missionRoutes = read("src/platform/five-plane-interface/api/http-server/mission-routes.ts");
check(
  "mission routes use error response envelope",
  missionRoutes.includes("buildJsonErrorResponse") && !missionRoutes.includes('buildJsonResponse(ctx.requestId, 404, { error: { code: "MISSION_NOT_FOUND" } })'),
  "mission 404/409/428 paths use top-level error envelope",
);

const fivePlaneHttpUtils = read("src/platform/five-plane-interface/api/http-server/utils.ts");
const fivePlaneHealthRoutes = read("src/platform/five-plane-interface/api/http-server/health-routes.ts");
check(
  "OpenAPI document response carries request id header",
  fivePlaneHttpUtils.includes("buildJsonDocumentResponse(payload: unknown, requestId?: string)") &&
    fivePlaneHttpUtils.includes('"x-request-id": requestId') &&
    fivePlaneHealthRoutes.includes("buildJsonDocumentResponse(buildOpenApiDocument(), ctx.requestId)"),
  "OpenAPI JSON response uses the same request correlation header",
);
check(
  "OpenAPI document route requires auth by default",
  fivePlaneHealthRoutes.includes("api.openapi_auth_required") &&
    fivePlaneHealthRoutes.includes("AA_OPENAPI_PUBLIC") &&
    fivePlaneHealthRoutes.includes("ctx.principal == null"),
  "OpenAPI JSON is no longer public unless AA_OPENAPI_PUBLIC=1 is explicitly set",
);

const retryExecutor = read("src/platform/five-plane-interface/channel-gateway/channel-gateway-retry-executor.ts");
check(
  "channel retry polling uses jittered timeout",
  retryExecutor.includes("pollJitterMs") && retryExecutor.includes("Math.random()") && retryExecutor.includes("setTimeout"),
  "fixed setInterval polling replaced with jittered scheduling",
);

const improvementRegistry = read("src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.ts");
check(
  "improvement candidate LRU touch avoids splice",
  improvementRegistry.includes("private readonly accessOrder = new Set<string>()") && !improvementRegistry.includes("accessOrder.splice"),
  "candidate touch uses Set delete/add instead of array splice",
);

const domainBaseline = read("src/domains/domain-baseline-catalog.ts");
check(
  "domain baseline not-found path has single throw",
  (domainBaseline.match(/vertical_domain\.not_found/g) ?? []).length === 1,
  "duplicate not-found throw collapsed",
);

const browserExecutor = read("src/platform/five-plane-execution/plugin-executor/browser-executor.ts");
check(
  "browser innerHTML output is sanitized",
  browserExecutor.includes("sanitizeBrowserHtml") && browserExecutor.includes("<script") && browserExecutor.includes("replace(/<script"),
  "simulated innerHTML path strips script/event/javascript payloads",
);

const auditIntegrity = read("src/platform/five-plane-control-plane/iam/audit-event-integrity.ts");
check(
  "audit integrity HMAC key is production-guarded",
  auditIntegrity.includes("audit_integrity.hmac_key_required") && auditIntegrity.includes('process.env["NODE_ENV"] === "production"'),
  "production requires AA_AUDIT_INTEGRITY_HMAC_KEY",
);

const sessionManagement = read("src/platform/five-plane-control-plane/iam/session-management.ts");
check(
  "in-memory IAM session store is production-guarded",
  sessionManagement.includes("iam.session_store_distributed_required") &&
    sessionManagement.includes("AA_ALLOW_IN_MEMORY_SESSION_STORE") &&
    sessionManagement.includes('process.env.NODE_ENV === "production"'),
  "production session creation requires distributed store or explicit in-memory opt-in",
);

const serviceAuth = read("src/platform/five-plane-control-plane/iam/service-auth.ts");
check(
  "in-memory service identity store is production-guarded",
  serviceAuth.includes("iam.service_identity_store_distributed_required") &&
    serviceAuth.includes("AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE") &&
    serviceAuth.includes('process.env.NODE_ENV === "production"'),
  "production service identity registration requires distributed store or explicit in-memory opt-in",
);

const contractGateway = read("src/platform/contracts/inter-plane-contract-gateway.ts");
check(
  "inter-plane contract version is centralized",
  contractGateway.includes("INTER_PLANE_CONTRACT_SCHEMA_VERSION") && contractGateway.includes("schemaVersion: INTER_PLANE_CONTRACT_SCHEMA_VERSION"),
  "schema version literal moved to exported constant",
);

const baseChatProvider = read("src/platform/model-gateway/provider-registry/base-chat-provider.ts");
check(
  "provider rate-limit headers are preserved on errors",
  baseChatProvider.includes("parseRetryAfterMs(response.headers)") && baseChatProvider.includes("parseResetAt(response.headers") && baseChatProvider.includes("retryAfterMs"),
  "provider errors carry retryAfterMs/resetAt parsed from response headers",
);

const oidcOAuth = read("src/platform/five-plane-interface/api/oidc-oauth-service.ts");
check(
  "OIDC skip signature verification is forbidden in production",
  oidcOAuth.includes("oidc.skip_signature_verification_forbidden") && oidcOAuth.includes('process.env["NODE_ENV"] === "production"'),
  "skipSignatureVerification constructor flag has production guard",
);

const redisQueue = read("src/platform/five-plane-execution/queue/redis-queue-adapter.ts");
check(
  "Redis queue idempotency index exists",
  redisQueue.includes("idx:${input.queueName}:idempotency") && redisQueue.includes("input.idempotencyKey"),
  "enqueue checks and writes idempotency index",
);

const pluginRuntimeChild = read("src/domains/registry/plugin-runtime-child.ts");
check(
  "plugin runtime JSON parse is guarded",
  pluginRuntimeChild.includes("try {") && pluginRuntimeChild.includes("JSON.parse(line)") && pluginRuntimeChild.includes("invalid stdio payload"),
  "stdio JSON.parse errors are caught and reported",
);

const coreRuntimeReadme = read("src/core/runtime/README.md");
check(
  "core runtime compatibility boundary is documented",
  coreRuntimeReadme.includes("Legacy Runtime Compatibility Directory") && coreRuntimeReadme.includes("canonical home"),
  "legacy wrapper directory has explicit five-plane boundary",
);

const gitignore = read(".gitignore");
const dockerignore = read(".dockerignore");
check(
  "scheduled tasks and local test database are ignored",
  gitignore.includes(".claude/scheduled_tasks.json") && gitignore.includes(".test-db/") && dockerignore.includes(".claude") && dockerignore.includes(".test-db"),
  ".claude scheduled task state and .test-db are excluded",
);
check(
  "legacy platform compatibility symlinks are ignored",
  [
    "src/platform/control-plane",
    "src/platform/execution",
    "src/platform/interface",
    "src/platform/orchestration",
    "src/platform/state-evidence",
  ].every((entry) => gitignore.includes(entry)),
  "five legacy src/platform symlink paths are explicit ignore entries",
);
check(
  "root generated replay and artifact directories are clean",
  countTreeFiles("session-replay") === 0 && countTreeFiles("artifacts") === 0,
  `session-replay files=${countTreeFiles("session-replay")}, artifacts files=${countTreeFiles("artifacts")}`,
);

const sourceFiles = readTreeFiles("src", (path) => path.endsWith(".ts"));
const directEventEmitterUsages = sourceFiles.flatMap((path) => {
  const source = read(path);
  const matches = source.match(/from "node:events"|from "events"|extends EventEmitter|new EventEmitter/g) ?? [];
  return matches.map((match) => `${path}:${match}`);
});
const localTypedEventEmitter = read("src/platform/shared/events/local-typed-event-emitter.ts");
check(
  "runtime services no longer directly depend on Node EventEmitter",
  directEventEmitterUsages.length === 0 &&
    localTypedEventEmitter.includes("class LocalTypedEventEmitter") &&
    localTypedEventEmitter.includes("public once") &&
    localTypedEventEmitter.includes("public off"),
  `direct EventEmitter usages: ${directEventEmitterUsages.join(", ") || "none"}`,
);

const emptyCatchBlocks = sourceFiles.flatMap((path) => {
  const source = read(path);
  const matches = source.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) ?? [];
  return matches.map((match) => `${path}:${match.replace(/\s+/g, " ")}`);
});
check(
  "source files have no empty catch blocks",
  emptyCatchBlocks.length === 0,
  `empty catch blocks: ${emptyCatchBlocks.join(", ") || "none"}`,
);

const structuredLogger = read("src/platform/shared/observability/structured-logger.ts");
check(
  "StructuredLogger path and buffer safeguards exist",
  structuredLogger.includes("function safePath") && structuredLogger.includes("path_traversal.blocked_escape_from_base") && structuredLogger.includes("ring buffer"),
  "safePath rejects traversal and logger uses bounded ring buffer",
);
check(
  "StructuredLogger rotation check is single-flight per file",
  structuredLogger.includes("state.scheduled = true;\n    this.checkRotationAsync(sink)") &&
    !structuredLogger.includes("if (!state || state.scheduled || sink.maxBytes == null)") &&
    structuredLogger.includes("state.scheduled = false;\n      return;"),
  "rotation scheduling marks a file path before async stat/rotate work starts",
);

const agentProfiler = read("src/ops-maturity/agent-lifecycle/agent-performance-profiler.ts");
check(
  "benchmark p95 uses nearest-rank percentile",
  agentProfiler.includes("calculateNearestRankPercentile") && agentProfiler.includes("Math.ceil(sortedValues.length * normalized) - 1"),
  "p95 index no longer uses floor(length * percentile)",
);

const architectureInventory = read("scripts/ci/audit-codebase-inventory.mjs");
check(
  "architecture-remediation duplicate-name inventory is explicit",
  architectureInventory.includes("architectureRemediationFiles") && architectureInventory.includes("architectureRemediationFiles.length === 5"),
  "inventory script lists the five scoped architecture-remediation files",
);

const apiError = read("src/platform/five-plane-interface/api/http-server/api-error.ts");
check(
  "API error messages are centralized",
  apiError.includes("API_ERROR_MESSAGES") && apiError.includes("API_ERROR_MESSAGES.taskNotFound") && !apiError.includes('new ApiError(500, "api.internal_error", "Internal server error.")'),
  "normalizeError uses API_ERROR_MESSAGES instead of inline English literals",
);
const appErrors = read("src/platform/contracts/errors.ts");
check(
  "application error model is unified and classified",
  appErrors.includes("export class AppError extends Error") &&
    appErrors.includes("public static wrap(") &&
    appErrors.includes("export class ValidationError extends AppError") &&
    appErrors.includes("export class PolicyDeniedError extends AppError") &&
    appErrors.includes('category: options.category ?? "validation"') &&
    appErrors.includes('category: options.category ?? "policy"'),
  "AppError wraps unknown errors and subclasses encode category/status semantics",
);

const federationRouting = read("src/platform/five-plane-interface/api/federation-routing-service.ts");
check(
  "federation API schema version constants exist",
  federationRouting.includes("FEDERATION_API_DEFAULT_VERSION") && federationRouting.includes("FEDERATION_API_MINIMUM_VERSION"),
  "federation route schema versions are named constants",
);

check(
  "Redis test-memory queue backend is forbidden in production",
  redisQueue.includes("queue.redis_test_memory_forbidden_in_production") && redisQueue.includes('process.env.NODE_ENV === "production"'),
  "AA_RUNNING_TESTS memory Redis path throws in production",
);

const ciWorkflow = read(".github/workflows/ci.yml");
check(
  "coverage gate runs for every Node matrix entry",
  ciWorkflow.includes("node-version: [20, 22]") &&
    ciWorkflow.includes("name: Coverage Gate") &&
    !ciWorkflow.includes("if: matrix.node-version == 22"),
  "Coverage Gate no longer has a Node 22-only condition",
);

const compose = read("docker-compose.yml");
check(
  "docker compose does not carry commented JWT secret examples",
  compose.includes("AA_API_JWT_SECRET") && !compose.includes("# AA_API_JWT_SECRET:"),
  "compose keeps the warning text but removes the commented secret environment entry",
);
check(
  "docker compose requires PostgreSQL password from environment",
  compose.includes("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}"),
  "POSTGRES_PASSWORD uses required environment interpolation",
);
check(
  "docker compose security limits are explicit",
  compose.includes("read_only: true") && compose.includes("no-new-privileges:true") && compose.includes("cap_drop:") && compose.includes("pids_limit:"),
  "compose service has read-only root, no-new-privileges, cap drop, and pid limits",
);

const envExample = read(".env.example");
const environmentConfiguration = read("docs_zh/reference/environment-configuration.md");
check(
  "JWT secret generation and rotation guidance exists",
  envExample.includes("randomBytes(32)") && envExample.includes("Rotate by publishing a new secret-manager version"),
  ".env.example documents generation and rotation without a concrete secret value",
);
check(
  "PostgreSQL password generation guidance exists",
  envExample.includes("POSTGRES_PASSWORD=") && envExample.includes("randomBytes(24)"),
  ".env.example documents POSTGRES_PASSWORD generation",
);
const requiredRuntimeEnvVars = [
  "AA_API_RATE_LIMIT_DISABLED",
  "AA_API_RATE_LIMIT_REDIS",
  "AA_API_RATE_LIMIT_WINDOW_MS",
  "AA_API_RATE_LIMIT_MAX_CALLS",
  "AA_OPENAPI_PUBLIC",
  "AA_MODEL_PROVIDER_FALLBACK_MODELS",
  "AA_MODEL_CALL_RETRY_MAX_ATTEMPTS",
  "AA_MODEL_CALL_RETRY_BASE_DELAY_MS",
  "AA_ALLOW_IN_MEMORY_SESSION_STORE",
  "AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE",
];
const runtimeEnvSources = [
  httpApiServer,
  fivePlaneHealthRoutes,
  read("src/platform/five-plane-execution/execution-engine/model-call-provider.ts"),
  read("src/platform/five-plane-execution/execution-engine/model-call-provider-support.ts"),
  sessionManagement,
  serviceAuth,
].join("\n");
const missingRuntimeEnvVars = requiredRuntimeEnvVars.filter((name) => {
  return !envExample.includes(name) || !environmentConfiguration.includes(name) || !runtimeEnvSources.includes(name);
});
check(
  "runtime env vars are synchronized across code docs and example",
  missingRuntimeEnvVars.length === 0,
  `missing synchronized env vars: ${missingRuntimeEnvVars.join(", ") || "none"}`,
);

const fivePlaneExecutionIndex = read("src/platform/five-plane-execution/index.ts");
check(
  "five-plane execution barrel exports compensation manager",
  fivePlaneExecutionIndex.includes('export { CompensationManager } from "./compensation-manager.js";') &&
    fivePlaneExecutionIndex.includes("CompensationPlan") &&
    fivePlaneExecutionIndex.includes("CompensationResult"),
  "CompensationManager and its public types are exported from the execution plane barrel",
);

const iamIndex = read("src/platform/five-plane-control-plane/iam/index.ts");
check(
  "IAM barrel exports session and service-auth APIs",
  iamIndex.includes("createSession") &&
    iamIndex.includes("validateAccessToken") &&
    iamIndex.includes("registerServiceIdentity") &&
    iamIndex.includes("validateServiceToken") &&
    iamIndex.includes("ServiceAuthResult") &&
    iamIndex.includes("SessionValidationResult"),
  "IAM session-management and service-auth can be imported from the IAM barrel without deep paths",
);

const evidenceService = read("src/platform/five-plane-state-evidence/memory/evidence-service.ts");
check(
  "EvidenceService evicts on read and lifecycle paths",
  evidenceService.includes("public query(query: EvidenceQuery): EvidenceRecord[] {\n    this.evictOldRecords();") &&
    evidenceService.includes("public get(id: string): EvidenceRecord | null {\n    this.evictOldRecords();") &&
    evidenceService.includes("public updateStatus(id: string, status: EvidenceStatus): boolean {\n    this.evictOldRecords();"),
  "EvidenceService no longer evicts only during record()",
);

const taskStoreDecorator = read("src/platform/five-plane-state-evidence/truth/repositories/authoritative-task-store-decorator.ts");
check(
  "authoritative task store retry sleep has no busy loop",
  taskStoreDecorator.includes("Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)") && !taskStoreDecorator.includes("while (Date.now() < end)"),
  "sleepSync uses Atomics.wait instead of a CPU busy-wait loop",
);

const healthRoutesCurrent = read("src/platform/five-plane-interface/api/http-server/health-routes.ts");
check(
  "SDK version and handshake routes are present",
  healthRoutesCurrent.includes('pathname: "/v1/version"') && healthRoutesCurrent.includes('pathname: "/v1/handshake"') && healthRoutesCurrent.includes("minClientVersion"),
  "server exposes /v1/version and /v1/handshake for SDK negotiation",
);

const processErrorHandlers = read("src/platform/five-plane-execution/startup/process-error-handlers.ts");
check(
  "hard-exit timers are not unrefed",
  processErrorHandlers.includes("hardExitTimer = setTimeout") && !processErrorHandlers.includes(".unref()"),
  "uncaughtException/unhandledRejection fallback timers stay referenced",
);

const platformRoot = read("src/index.ts");
check(
  "platform root avoids production console output",
  platformRoot.includes("writeJsonToStdout") &&
    platformRoot.includes("writeJsonToStderr") &&
    !/console\.(?:log|error|warn|info)\s*\(/.test(platformRoot),
  "root entrypoint writes JSON through stdout/stderr helpers instead of console.*",
);

const gracefulShutdown = read("src/platform/five-plane-execution/startup/graceful-shutdown.ts");
check(
  "shutdown handler ordering contract is explicit",
  gracefulShutdown.includes("dependsOn?: readonly string[]") && gracefulShutdown.includes("orderHandlersForShutdown") && gracefulShutdown.includes("return [...this.handlers].reverse()"),
  "GracefulShutdown documents dependency ordering and reverses registration order by default",
);

const serviceRegistry = read("src/platform/shared/lifecycle/service-registry.ts");
check(
  "ServiceRegistry singleton creation is one expression",
  serviceRegistry.includes("return ServiceRegistry._instance ??= new ServiceRegistry();") &&
    serviceRegistry.includes("public async reset(): Promise<void>") &&
    serviceRegistry.includes("ServiceRegistry._instance = null"),
  "getInstance uses nullish assignment and reset clears singleton state",
);

const happyPath = read("src/platform/five-plane-execution/execution-engine/single-task-happy-path.ts");
const happyPathSupport = read("src/platform/five-plane-execution/execution-engine/single-task-happy-path-support.ts");
check(
  "single-task happy path persists HarnessRun and stale TODO is removed",
  happyPath.includes("INSERT INTO harness_runs") && !happyPath.includes("TODO R4-27"),
  "HarnessRun is inserted into harness_runs and the stale data-loss TODO is gone",
);
check(
  "single-task happy path has retry policy",
  happyPathSupport.includes("DEFAULT_SINGLE_TASK_MAX_RETRIES = 2") &&
    happyPathSupport.includes("DEFAULT_SINGLE_TASK_RETRY_BACKOFF = \"linear\"") &&
    happyPath.includes("DEFAULT_SINGLE_TASK_RETRY_BACKOFF") &&
    !happyPath.includes("maxRetries: 0"),
  "single task executions no longer persist a zero-retry policy",
);

const modelCallProvider = read("src/platform/five-plane-execution/execution-engine/model-call-provider.ts");
const modelCallProviderSupport = read("src/platform/five-plane-execution/execution-engine/model-call-provider-support.ts");
const unifiedChatProvider = read("src/platform/model-gateway/provider-registry/unified-chat-provider.ts");
check(
  "model call provider has retry and fallback chain",
  modelCallProvider.includes("executeGovernedCompletionWithFallback") &&
    modelCallProvider.includes("executeWithRetry") &&
    modelCallProviderSupport.includes("AA_MODEL_PROVIDER_FALLBACK_MODELS"),
  "non-streaming LLM calls retry retryable failures and walk configured fallback models",
);
check(
  "LLM provider calls are circuit-breaker protected",
  unifiedChatProvider.includes("private readonly breakers = new Map<string, CircuitBreaker>()") &&
    unifiedChatProvider.includes('this.breakers.set("anthropic"') &&
    unifiedChatProvider.includes("breaker.execute"),
  "UnifiedChatProvider wraps provider calls with per-provider circuit breakers",
);

const multiStepTypes = read("src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.ts");
const multiStepOrchestration = read("src/platform/five-plane-execution/execution-engine/multi-step-orchestration.ts");
check(
  "multi-step orchestration planner and router are injectable",
  multiStepTypes.includes("intakeRouter?: Pick<IntakeRouter") &&
    multiStepTypes.includes("workflowPlanner?: Pick<WorkflowPlanner") &&
    multiStepOrchestration.includes("input.intakeRouter ?? new IntakeRouter()") &&
    multiStepOrchestration.includes("input.workflowPlanner ?? new WorkflowPlanner()"),
  "WorkflowPlanner and IntakeRouter are no longer only directly instantiated",
);

const dispatcherIndex = read("src/platform/five-plane-execution/dispatcher/index.ts");
check(
  "dispatcher policy defaults are injectable",
  dispatcherIndex.includes("DEFAULT_DISPATCH_BUDGET_POLICY") &&
    dispatcherIndex.includes("MultiStepToolDispatcherOptions") &&
    dispatcherIndex.includes("options.budgetPolicy ?? DEFAULT_DISPATCH_BUDGET_POLICY"),
  "PolicyEngine construction accepts a budget policy override instead of only hardcoded defaults",
);

const conversationWeb = read("ui/packages/features/conversation/src/web/index.tsx");
const enUsCatalog = read("ui/packages/shared/i18n/src/catalogs/en-US.ts");
const zhCnCatalog = read("ui/packages/shared/i18n/src/catalogs/zh-CN.ts");
check(
  "conversation UI copy is translated and controls are labelled",
  conversationWeb.includes("translateFeatureCopy(\"conversation\")") &&
    conversationWeb.includes("translateMessage(\"ui.conversation.prompt.label\")") &&
    conversationWeb.includes("aria-label={translateMessage") &&
    enUsCatalog.includes("ui.conversation.sendPrompt") &&
    zhCnCatalog.includes("ui.conversation.sendPrompt"),
  "conversation feature moved hardcoded control copy into i18n catalogs and added aria labels",
);

const architectureReadme = read("docs_zh/architecture/README.md");
const operationsTodo = read("docs_zh/operations/current_todo_list.md");
check(
  "architecture and operations docs carry current review sync markers",
  architectureReadme.includes("2026-05-14") &&
    architectureReadme.includes("issues-table.md") &&
    operationsTodo.includes("2026-05-14 复核") &&
    operationsTodo.includes("权威逐行状态表"),
  "architecture/operations docs now point to the current review closure source of truth",
);
const operationsTodoArchivePath = "docs_zh/operations/archive/current_todo_list-history-2026-05-14.md";
const operationsTodoArchive = read(operationsTodoArchivePath);
check(
  "current todo list is compact and history is archived",
  statSync("docs_zh/operations/current_todo_list.md").size < 4096 &&
    operationsTodo.includes(operationsTodoArchivePath) &&
    operationsTodoArchive.includes("A9 剩余测试失败簇最终收口"),
  "current_todo_list.md is a short index and historical A1-A9 content is retained in archive",
);
const platformArchitectureIndex = read("docs_zh/architecture/00-platform-architecture.md");
const platformArchitectureArchivePath = "docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md";
const platformArchitectureArchive = read(platformArchitectureArchivePath);
check(
  "platform architecture monolith is compact and archived",
  statSync("docs_zh/architecture/00-platform-architecture.md").size < 4096 &&
    platformArchitectureIndex.includes(platformArchitectureArchivePath) &&
    platformArchitectureArchive.includes("企业级 Agent 平台总体技术架构设计文档") &&
    statSync(platformArchitectureArchivePath).size > 500000,
  "00-platform-architecture.md is a short index and the historical monolith is retained in archive",
);
const releaseVersioning = read("docs_zh/operations/release-versioning.md");
const codeGovernance = read("docs_zh/quality/code-governance.md");
check(
  "branch and commit governance is documented",
  releaseVersioning.includes("main` 是唯一可发布分支") &&
    releaseVersioning.includes("禁止使用无语义标题") &&
    releaseVersioning.includes("chore: sync"),
  "release-versioning documents branch source-of-truth and commit message rules",
);
check(
  "code governance requires executable duplicate and cycle audits",
  codeGovernance.includes("重复代码检测和循环依赖检测") &&
    codeGovernance.includes("audit-codebase-inventory.mjs") &&
    codeGovernance.includes("不允许只写人工结论"),
  "code-governance documents duplicate/cycle audit requirements and evidence rules",
);

const requestDedup = read("src/platform/five-plane-interface/api/middleware/request-deduplication.ts");
check(
  "request dedup memory store is production-guarded",
  requestDedup.includes("request_deduplication.distributed_store_required_in_production") && requestDedup.includes("allowInMemoryInProduction"),
  "process-local dedup store cannot be used in production without explicit opt-in",
);

const tenantIsolation = read("src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.ts");
check(
  "tenant quota listing requires tenant scope",
  tenantIsolation.includes("listQuotas(tenantId: string)") && tenantIsolation.includes("tenant.quota_tenant_required") && !tenantIsolation.includes("SELECT * FROM tenant_quotas ORDER BY tenant_id, quota_kind"),
  "listQuotas no longer returns all tenants when tenantId is omitted",
);

const distributedRateLimiter = read("src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts");
check(
  "distributed rate limiter cannot silently bypass Redis in production",
  distributedRateLimiter.includes("rate_limiter.redis_required_in_production") && distributedRateLimiter.includes("allowLocalFallbackInProduction"),
  "production construction without Redis requires an explicit local fallback opt-in",
);

const startupConsistencyChecker = read("src/platform/five-plane-execution/startup/startup-consistency-checker.ts");
const doctorService = read("src/platform/five-plane-control-plane/incident-control/doctor-service.ts");
check(
  "startup consistency exposes traffic block status",
  startupConsistencyChecker.includes("public canAcceptTraffic(): boolean") &&
    startupConsistencyChecker.includes("this._trafficBlocked = true") &&
    doctorService.includes("startupConsistency"),
  "fail-closed startup consistency state is visible through checker and doctor report",
);

const fieldEncryption = read("src/platform/five-plane-control-plane/iam/field-encryption.ts");
check(
  "field encryption key loading is explicit",
  fieldEncryption.includes("AA_FIELD_ENCRYPTION_KEY") && fieldEncryption.includes("loadFieldEncryptionKeyFromEnv") && fieldEncryption.includes("security.field_encryption_key_required"),
  "field encryption exposes a required env-backed key loader instead of leaving key management implicit",
);

const fencingTokenService = read("src/platform/five-plane-state-evidence/events/cas/fencing-token-service.ts");
check(
  "sync fencing token counter uses Atomics",
  fencingTokenService.includes("new Int32Array(new SharedArrayBuffer(4))") && fencingTokenService.includes("Atomics.add"),
  "FencingTokenService counter increments atomically",
);

const asyncFencingTokenService = read("src/platform/five-plane-state-evidence/events/cas/postgres-fencing-token-service.ts");
check(
  "async fencing token counter uses Atomics and avoids duplicate fence queries",
  asyncFencingTokenService.includes("new Int32Array(new SharedArrayBuffer(4))") &&
    asyncFencingTokenService.includes("const fences = await repo.getFencesForExecution(executionId)") &&
    (asyncFencingTokenService.match(/getFencesForExecution\(executionId\)/g) ?? []).length < 5,
  "AsyncFencingTokenService uses atomic counter and reuses the acquisition fence list",
);

const sqliteLockAdapter = read("src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.ts");
check(
  "sqlite lock fencing counter is refreshed from storage",
  sqliteLockAdapter.includes("private nextFencingToken(): number") && sqliteLockAdapter.includes("SELECT MAX(fencing_token) as max_token FROM distributed_locks"),
  "SqliteLockAdapter derives each new fencing token from the persisted max token",
);

const budgetAllocator = read("src/platform/five-plane-execution/budget-allocator.ts");
check(
  "BudgetAllocator active reservations use copy-on-write helpers",
  budgetAllocator.includes("trackActiveReservation") &&
    budgetAllocator.includes("untrackActiveReservation") &&
    budgetAllocator.includes("snapshotActiveReservations") &&
    !budgetAllocator.includes("for (const [reservationId, reservation] of this.activeReservations)"),
  "active reservation mutation is centralized and sweeps iterate over a stable snapshot",
);

const effectBuffer = read("src/platform/five-plane-execution/execution-engine/effect-buffer.ts");
check(
  "EffectBuffer flush iterates over stable scope snapshot",
  effectBuffer.includes("const scopesSnapshot = [...this.scopes.entries()]") &&
    effectBuffer.includes("scope_skipped_concurrent_change"),
  "flush does not iterate a Map that can be mutated concurrently without detection",
);

const websocketBridge = read("src/platform/five-plane-interface/channel-gateway/websocket-bridge.ts");
check(
  "WebSocket bridge parse/auth catch blocks log errors",
  websocketBridge.includes("invalid subprotocol token\", {") &&
    websocketBridge.includes("invalid payload\", {") &&
    !websocketBridge.includes("} catch {\n      ws.send"),
  "previously silent catch blocks now include structured warning context",
);

const haCoordinatorTypes = read("src/platform/five-plane-execution/ha/types.ts");
const haCoordinator = read("src/platform/five-plane-execution/ha/ha-coordinator-service-inner.ts");
check(
  "HA coordinator has a single active leadership lease",
  haCoordinatorTypes.includes("idx_leadership_leases_single_active") &&
    haCoordinator.includes("UPDATE leadership_leases SET status = 'expired' WHERE status = 'active'") &&
    haCoordinator.includes("return this.db.transaction(() => {"),
  "leadership acquisition runs in a transaction and DB schema enforces one active lease",
);

const sqliteMigrationPart2 = read("src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-runtime-part2.ts");
check(
  "experience cache has quality and outcome indexes",
  sqliteMigrationPart2.includes("idx_experience_cache_quality_created_at") && sqliteMigrationPart2.includes("idx_experience_cache_outcome_created_at"),
  "experience_cache is indexed for quality/outcome query paths",
);

const storybookReadme = read("ui/packages/storybook/README.md");
check(
  "UI Storybook package path exists",
  storybookReadme.includes("UI Storybook Package") && storybookReadme.includes("stable target"),
  "ui/packages/storybook now has a tracked package documentation target",
);

const interactionGovernanceOrchestrator = read("src/interaction-governance-runtime-orchestrator.ts");
check(
  "interaction governance startup dependency errors are typed",
  interactionGovernanceOrchestrator.includes("new ValidationError(") &&
    !interactionGovernanceOrchestrator.includes("throw new Error(`w3_startup_plan.missing_dependency"),
  "missing dependency path throws ValidationError instead of raw Error",
);

const apiAuthService = read("src/platform/five-plane-interface/api/api-auth-service.ts");
check(
  "API auth Buffer.from calls declare encodings",
  apiAuthService.includes('Buffer.from(item.apiKey, "utf8")') &&
    apiAuthService.includes('Buffer.from(apiKey, "utf8")') &&
    apiAuthService.includes('Buffer.from(signature, "base64url")'),
  "JWT/API-key Buffer.from usage is explicit about utf8/base64url encodings",
);

const anomalyClassificationTest = read("tests/unit/platform/contracts/anomaly-event-classification.test.ts");
check(
  "anomaly classification test has no unfinished TODO comments",
  !/TODO|FIXME/.test(anomalyClassificationTest),
  "the previously reported TODO comments were converted into executable assertions or explanatory notes",
);
const sourceTodoFiles = readTreeFiles("src", (path) => path.endsWith(".ts"));
const unfinishedTodoComments = [];
for (const path of sourceTodoFiles) {
  const source = read(path);
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/^\s*(?:\/\/|\*)\s*(?:TODO|FIXME)\b/.test(line)) {
      unfinishedTodoComments.push(`${path}:${index + 1}`);
    }
  });
}
check(
  "source files have no unfinished TODO/FIXME comments",
  unfinishedTodoComments.length === 0,
  `unfinished comments: ${unfinishedTodoComments.join(", ") || "none"}`,
);
const directConsoleCallSites = [];
const hardcodedSourceComments = [];
for (const path of sourceTodoFiles) {
  const source = read(path);
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/console\.(?:log|warn|error|info|debug|table)\s*\(/.test(line)) {
      directConsoleCallSites.push(`${path}:${index + 1}`);
    }
    if (/\bhard-?coded\b/i.test(line)) {
      hardcodedSourceComments.push(`${path}:${index + 1}`);
    }
  });
}
check(
  "source files have no direct console output calls",
  directConsoleCallSites.length === 0,
  `direct console calls: ${directConsoleCallSites.join(", ") || "none"}`,
);
check(
  "source files have no hardcoded remediation comments",
  hardcodedSourceComments.length === 0,
  `hardcoded comment sites: ${hardcodedSourceComments.join(", ") || "none"}`,
);

const uiStateIndex = read("ui/packages/shared/state/src/index.ts");
const uiSyncStore = read("ui/packages/shared/state/src/stores/sync-store.ts");
const uiRealtimeStore = read("ui/packages/shared/state/src/stores/realtime-store.ts");
const uiWsEventRouter = read("ui/packages/shared/api-client/src/ws-event-router.ts");
check(
  "UI Zustand stores expose typed state contracts",
  uiStateIndex.includes("type AuthStoreState") &&
    uiStateIndex.includes("type SyncStoreState") &&
    uiStateIndex.includes("type UiStoreState") &&
    uiSyncStore.includes("export interface SyncStoreState") &&
    uiRealtimeStore.includes("export interface RealtimeStoreState") &&
    uiRealtimeStore.includes("subscriptionLookup: Readonly<Record<string, true>>"),
  "shared state exports typed Zustand store state and lookup-backed realtime state",
);
check(
  "React Query and Zustand are synchronized by websocket router",
  uiStateIndex.includes("new WSEventRouter(") &&
    uiStateIndex.includes("resolvedQueryClient") &&
    uiStateIndex.includes("realtimeStore.getState().setWsStatus") &&
    uiWsEventRouter.includes("queryClient.invalidateQueries") &&
    uiWsEventRouter.includes("QUERY_EVENT_MAP"),
  "UiRuntimeProvider wires WS status into Zustand and realtime events into React Query invalidation",
);

const resultEnvelope = read("src/platform/contracts/result-envelope/result-envelope.ts");
check(
  "result envelope source has no obvious committed secrets",
  !/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}/i.test(resultEnvelope) &&
    resultEnvelope.includes("StructuredLogger") &&
    resultEnvelope.includes("safeParseJson"),
  "result-envelope source contains result shaping logic and no obvious secret literals",
);
const sharedAuthPackage = read("ui/packages/shared/auth/package.json");
const sharedStatePackage = read("ui/packages/shared/state/package.json");
const uiCorePackage = read("ui/packages/ui-core/package.json");
check(
  "UI shared package entrypoints are explicit",
  [sharedAuthPackage, sharedStatePackage, uiCorePackage].every((pkg) =>
    pkg.includes('"main"') && pkg.includes('"module"') && pkg.includes('"exports"') && pkg.includes('"types"')
  ),
  "@aa/shared-auth, @aa/shared-state, and @aa/ui-core expose source entrypoints for Vite/Vitest",
);
const electronMain = read("ui/apps/electron-win/src/main.ts");
const electronHtml = read("ui/apps/electron-win/index.html");
const tauriLinuxConfig = read("ui/apps/tauri-linux/src-tauri/tauri.conf.json");
const tauriMacosConfig = read("ui/apps/tauri-macos/src-tauri/tauri.conf.json");
const tauriMacosLib = read("ui/apps/tauri-macos/src-tauri/src/lib.rs");
check(
  "desktop shells enforce security baselines",
  electronMain.includes("contextIsolation: true") &&
    electronMain.includes("nodeIntegration: false") &&
    electronMain.includes("sandbox: true") &&
    electronHtml.includes("Content-Security-Policy") &&
    tauriLinuxConfig.includes('"csp"') &&
    tauriMacosConfig.includes('"csp"') &&
    tauriMacosLib.includes("ALLOWED_DEEP_LINK_SCHEMES") &&
    tauriMacosLib.includes("ALLOWED_COMMANDS"),
  "Electron and Tauri shells declare CSP, sandboxing, node isolation, command allowlists, and deep-link scheme allowlists",
);
const analyticsFeature = read("ui/packages/features/analytics/src/web/index.tsx");
const dashboardFeature = read("ui/packages/features/dashboard/src/web/index.tsx");
check(
  "UI feature responsive layouts are covered by source patterns",
  analyticsFeature.includes("repeat(auto-fit, minmax(220px, 1fr))") &&
    dashboardFeature.includes("repeat(auto-fit, minmax(180px, 1fr))"),
  "feature web views use auto-fit/minmax responsive grids exercised by targeted UI tests",
);

const backupScript = read("scripts/backup-sqlite.sh");
const restoreScript = read("scripts/restore-sqlite.sh");
check(
  "SQLite backup supports encryption and remote copy",
  backupScript.includes("AA_BACKUP_ENCRYPTION_KEY_FILE") &&
    backupScript.includes("openssl enc -aes-256-cbc") &&
    backupScript.includes("AA_BACKUP_REMOTE_URI") &&
    (backupScript.includes("rclone copyto") || backupScript.includes("aws s3 cp")),
  "backup-sqlite.sh can encrypt local backups and copy them to a configured remote destination",
);
check(
  "SQLite restore supports encrypted backups",
  restoreScript.includes("AA_BACKUP_ENCRYPTION_KEY_FILE") &&
    restoreScript.includes("openssl enc -d -aes-256-cbc") &&
    restoreScript.includes("mktemp"),
  "restore-sqlite.sh decrypts .enc backups into a temporary file before integrity checks",
);

const drDrill = read("deploy/scripts/dr-drill.sh");
check(
  "DR drill writes and verifies backup manifest",
  drDrill.includes(".backup_manifest.sha256") &&
    drDrill.includes("shasum -a 256 -c") &&
    drDrill.includes("Integrity verification completed"),
  "dr-drill.sh records SHA-256 manifest evidence and verifies it during drill validation",
);

const sqliteDatabase = read("src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.ts");
check(
  "SQLite database wrapper enforces FK and prepared statement migration ledger",
  sqliteDatabase.includes("PRAGMA foreign_keys = ON") &&
    sqliteDatabase.includes("this.connection.prepare(") &&
    sqliteDatabase.includes("Math.trunc(options.busyTimeoutMs"),
  "SQLite wrapper enables FK checks and keeps dynamic values sanitized/prepared",
);

const runtimePhysicalSchema = read("src/platform/five-plane-state-evidence/truth/runtime-physical-schema.ts");
check(
  "runtime physical schema declares core foreign keys",
  runtimePhysicalSchema.includes("FOREIGN KEY (task_draft_id) REFERENCES task_drafts(task_draft_id)") &&
    runtimePhysicalSchema.includes("FOREIGN KEY (harness_run_id) REFERENCES harness_runs(harness_run_id)") &&
    runtimePhysicalSchema.includes("FOREIGN KEY (budget_reservation_id) REFERENCES budget_reservations(budget_reservation_id)") &&
    runtimePhysicalSchema.includes("FOREIGN KEY (mission_id) REFERENCES mission_records(mission_id)"),
  "core runtime tables now encode parent-child relationships in DDL",
);

const migrationRunner = read("src/platform/five-plane-state-evidence/truth/migration-runner.ts");
check(
  "migration runner down action is fail-closed with procedure",
  migrationRunner.includes("rollbackSupported: boolean") &&
    migrationRunner.includes("rollbackProcedure") &&
    migrationRunner.includes("not supported and fail-closed"),
  "down migration requests return explicit restore/forward-fix procedure instead of a silent no-op",
);

const sqliteSchemaCompatibilityGate = read("src/platform/five-plane-state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.ts");
check(
  "migration 44 tenant extension index special case is gated",
  sqliteSchemaCompatibilityGate.includes("idx_extension_packages_tenant_extension_version") &&
    sqliteSchemaCompatibilityGate.includes("idx_extension_packages_extension_version") &&
    sqliteSchemaCompatibilityGate.includes("isSafeTenantScopedIndexReplacement"),
  "migration 44 index replacement has an explicit compatibility gate",
);

const runtimeStateMachineModel = read("src/platform/five-plane-execution/runtime-state-machine-model.ts");
check(
  "runtime state machine terminal harness states are sealed",
  runtimeStateMachineModel.includes("completed: []") &&
    runtimeStateMachineModel.includes("failed: []") &&
    runtimeStateMachineModel.includes("cancelled: []") &&
    runtimeStateMachineModel.includes("aborted: []") &&
    !runtimeStateMachineModel.includes('completed: ["paused"]'),
  "terminal harness runs no longer transition back to paused",
);

const harnessLoop = read("src/platform/five-plane-orchestration/harness/index.ts");
const oapeflirLoop = read("src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts");
check(
  "harness while loop is guarded by HarnessLoopController",
  harnessLoop.includes("new HarnessLoopController") &&
    harnessLoop.includes("loop.evaluateProgress(") &&
    harnessLoop.includes("!progress.shouldContinue") &&
    harnessLoop.includes("harness.guard.max_iterations_reached"),
  "harness loop uses loop controller guard violations for iteration/replan aborts",
);
check(
  "OAPeflir replan loop is guarded by HarnessLoopController",
  oapeflirLoop.includes("loopController.recordReplan()") &&
    oapeflirLoop.includes("loopController.getGuardViolation()") &&
    oapeflirLoop.includes("decisionKind: \"abort\""),
  "OAPeflir loop records replans and aborts on loop guard violation",
);

check(
  "soft quota exceed blocks execution even for log_only action",
  tenantIsolation.includes("allowed: false") && !tenantIsolation.includes('allowed: quota.enforcementAction === "log_only"'),
  "tenant quota check reports log_only action without allowing over-quota execution",
);

const apiClient = read("src/sdk/client-sdk/api-client.ts");
check(
  "SDK URLs include /api prefix",
  apiClient.includes("function normalizeApiVersionSegment") &&
    apiClient.includes('return normalized.startsWith("api/") ? normalized : `api/${normalized}`') &&
    apiClient.includes("normalizeApiVersionSegment(this.config.apiVersion)"),
  "buildApiUrl and SSE URL construction normalize apiVersion to api/vN",
);

check(
  "HTTP API server invokes version routing middleware",
  httpApiServer.includes("globalVersionRoutingMiddleware") &&
    httpApiServer.includes('headers["accept-version"]') &&
    httpApiServer.includes('payload.headers["x-api-version"]'),
  "incoming HTTP requests negotiate Accept-Version and expose x-api-version",
);
check(
  "SDK error categories include validation",
  apiClient.includes('VALIDATION = "validation"') &&
    apiClient.includes("statusCode === 400 || statusCode === 422") &&
    apiClient.includes("case ApiErrorCategory.VALIDATION"),
  "SDK classification aligns validation-category 4xx responses with server error semantics",
);

const experienceCache = read("src/platform/five-plane-state-evidence/memory/experience-cache-service.ts");
check(
  "experience cache similarity queries are paginated",
  experienceCache.includes("offset?: number") &&
    experienceCache.includes("scanLimit?: number") &&
    experienceCache.includes("LIMIT ?") &&
    experienceCache.includes("slice(offset, offset + limit)"),
  "findSimilarExperiences accepts offset/scanLimit and avoids fixed unpaged scans",
);

const postgresPoolEnv = read("src/platform/five-plane-control-plane/config-center/postgres-pool-env.ts");
check(
  "PostgreSQL default pool size is raised",
  postgresPoolEnv.includes("options.defaultPoolMax ?? 20"),
  "default pool max is 20 unless overridden by env/options",
);

const sqliteMigrationPlan = read("src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.ts");
const sqliteMigrationDefinitions = sqliteMigrationPlan.match(/defineMigration\(/g) ?? [];
check(
  "SQLite migrations are versioned beyond bootstrap SQL",
  sqliteMigrationDefinitions.length >= 46 &&
    sqliteMigrationPlan.includes('"0001_phase1a_init"') &&
    sqliteMigrationPlan.includes('"0046_config_rollout_persistence"') &&
    sqliteMigrationPlan.includes("SQLITE_MIGRATIONS"),
  `migration definitions=${sqliteMigrationDefinitions.length}`,
);

const primitives = read("src/platform/contracts/types/domain/primitives.ts");
check(
  "Timestamp is a branded string type",
  primitives.includes("TIMESTAMP_BRAND") && primitives.includes('readonly [TIMESTAMP_BRAND]: "Timestamp"'),
  "Timestamp is no longer a plain string alias",
);

const pgDatabase = read("src/platform/five-plane-state-evidence/truth/postgres/pg-database.ts");
check(
  "PgDatabase close clears connection state",
  pgDatabase.includes("await this.sql.end()") &&
    pgDatabase.includes("this._connected = false") &&
    pgDatabase.includes('createStubConnection("postgres.closed")'),
  "close() ends postgres.js, resets connection state, and installs a closed stub",
);

const cacheFacade = read("src/platform/shared/cache/cache-facade.ts");
const cacheInvalidationBroadcast = read("src/platform/shared/cache/cache-invalidation-broadcast.ts");
check(
  "cache stampede and cross-instance invalidation controls exist",
  cacheFacade.includes("pendingComputes") &&
    cacheInvalidationBroadcast.includes("CacheInvalidationBroadcast") &&
    cacheInvalidationBroadcast.includes("broadcastTagInvalidation"),
  "cache facade deduplicates in-flight computes and Redis broadcast propagates invalidations",
);

const orgRouting = read("src/org-governance/org-routing/index.ts");
check(
  "cross-tenant routing is derived by service",
  orgRouting.includes("const crossTenantRequest = this.crossesTenantBoundary(requesterOrgNodeId, targetOrgNodeId)") &&
    !orgRouting.includes("crossTenantRequest = false } = input"),
  "org routing no longer trusts caller-supplied crossTenantRequest",
);

const leaderElection = read("src/platform/five-plane-execution/ha/leader-election-service.ts");
check(
  "leader election can register graceful shutdown handler",
  leaderElection.includes("registerWithGracefulShutdown") &&
    leaderElection.includes("leader-election:${this.effectiveNodeId}") &&
    leaderElection.includes("handler: () => this.stop()"),
  "LeaderElectionService exposes a shutdown hook that releases leadership via stop()",
);
const agentMiddleware = read("src/platform/five-plane-execution/execution-engine/agent-middleware-chain.ts");
check(
  "agent middleware lifecycle hooks are complete",
  agentMiddleware.includes("registerOnSucceeded") &&
    agentMiddleware.includes("registerOnFailed") &&
    agentMiddleware.includes("triggerOnSucceeded") &&
    agentMiddleware.includes("triggerOnFailed") &&
    agentMiddleware.includes("runAgentRound"),
  "before/after/wrap plus success/failure lifecycle hooks are present",
);
check(
  "agent middleware chain is split below 500 lines",
  agentMiddleware.split(/\r?\n/).length < 500 &&
    read("src/platform/five-plane-execution/execution-engine/agent-middleware-types.ts").includes("export interface MiddlewareContext"),
  `agent-middleware-chain lines=${agentMiddleware.split(/\r?\n/).length}`,
);
const budgetAllocatorLargeFile = read("src/platform/five-plane-execution/budget-allocator.ts");
check(
  "budget allocator is split below 900 lines and 34KB",
  budgetAllocatorLargeFile.split(/\r?\n/).length < 900 &&
    statSync("src/platform/five-plane-execution/budget-allocator.ts").size < 34000 &&
    read("src/platform/five-plane-execution/budget-allocator-types.ts").includes("export interface BudgetAllocatorContext"),
  `budget-allocator lines=${budgetAllocatorLargeFile.split(/\r?\n/).length}, bytes=${statSync("src/platform/five-plane-execution/budget-allocator.ts").size}`,
);
const durableEventBus = read("src/platform/five-plane-state-evidence/events/durable-event-bus.ts");
check(
  "durable event bus is split below 1000 lines",
  durableEventBus.split(/\r?\n/).length < 1000 &&
    read("src/platform/five-plane-state-evidence/events/durable-event-bus-support.ts").includes("export class AdaptivePollingInterval"),
  `durable-event-bus lines=${durableEventBus.split(/\r?\n/).length}`,
);

const loginCli = read("src/sdk/cli/login.ts");
check(
  "OAuth credentials are encrypted in production",
  loginCli.includes("AA_CREDENTIALS_ENCRYPTION_KEY") &&
    loginCli.includes("aes-256-gcm") &&
    loginCli.includes("oauth.credentials_encryption_key_required") &&
    loginCli.includes("NODE_ENV === \"production\""),
  "CLI login writes encrypted token envelopes when key is provided and rejects plaintext production writes",
);

const testFiles = readTreeFiles("tests", (path) => path.endsWith(".ts"));
const skipOnlyMatches = [];
for (const path of testFiles) {
  const source = read(path);
  const matches = source.match(/\b(?:test|it|describe)\.(?:skip|only)\s*\(/g) ?? [];
  if (matches.length > 0) {
    skipOnlyMatches.push(`${path}:${matches.length}`);
  }
}
check(
  "test suite has no active skip/only markers",
  skipOnlyMatches.length === 0,
  `active skip/only markers: ${skipOnlyMatches.join(", ") || "none"}`,
);

const budgetIntegration = read("tests/integration/platform/execution/budget-allocation.integration.test.ts");
check(
  "budget allocation integration test is not skipped for workflow_state",
  !/\b(?:test|it|describe)\.skip\s*\(/.test(budgetIntegration) &&
    budgetIntegration.includes("Workflow execution tracks cost through lifecycle"),
  "budget allocation integration coverage is active and includes workflow cost lifecycle",
);

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`review batch resource contracts audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`review batch resource contracts audit passed: ${checks.length}/${checks.length}`);
