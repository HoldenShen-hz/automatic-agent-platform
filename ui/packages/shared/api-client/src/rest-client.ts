import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  DivisionInventorySnapshotDTO,
  DomainConfigDTO,
  ExplanationDTO,
  FeatureFlagDTO,
  IncidentDTO,
  LeadershipClaimsConsoleDTO,
  MarketplacePackDTO,
  MissionBudgetSummaryDTO,
  MissionDTO,
  MissionMemberDTO,
  MissionResourceDTO,
  ModelConfigDTO,
  QueueDTO,
  RoleDTO,
  SystemConfigDTO,
  TaskDTO,
  TenantDTO,
  UserDTO,
  UserPreferenceDTO,
  WebhookDTO,
  WorkerDTO,
  WorkflowRunStepDTO,
  WorkflowDTO,
} from "@aa/shared-types";
import { defaultMockApiShape, type MockApiShape } from "./mock-data.js";
import type { RestClientInterceptor, RestClientRequest, RestClientResponse } from "./interceptors.js";
import { generateStableId } from "./runtime-support.js";

export interface TransportResponse<T> {
  readonly status: number;
  readonly data: T;
}

export interface RestRequestOptions {
  readonly headers?: Headers;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export type RestTransport = <T>(request: RestClientRequest) => Promise<TransportResponse<T>>;

export interface RESTClient {
  get<T>(path: string, options?: RestRequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  delete<T>(path: string, options?: RestRequestOptions): Promise<T>;
}

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly acceptVersion?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImplementation?: typeof fetch;
  readonly fallbackToMock?: boolean;
  readonly credentials?: RequestCredentials;
  readonly mode?: RequestMode;
  readonly timeoutMs?: number;
}

export const DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01";

export type RestHttpUiAction = "redirect_to_login" | "access_denied" | "backoff_and_retry" | "version_not_supported" | "none";
export type RestHttpErrorCategory = "network" | "auth" | "validation" | "business" | "contract";

export class RestHttpError extends Error {
  public readonly status: number;
  public readonly uiAction: RestHttpUiAction;
  public readonly retryAfterMs: number | null;
  public readonly category: RestHttpErrorCategory;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly code: string | null;

  public constructor(
    status: number,
    retryAfterMs: number | null = null,
    details: { message?: string; code?: string | null } = {},
  ) {
    super(details.message ?? `rest.http_error:${status}`);
    this.status = status;
    this.statusCode = status;
    this.retryAfterMs = retryAfterMs;
    this.category = classifyRestHttpError(status);
    this.isRetryable = status === 429 || status >= 500;
    this.code = details.code ?? null;
    this.uiAction = status === 401
      ? "redirect_to_login"
      : status === 403
        ? "access_denied"
        : status === 406
          ? "version_not_supported"
        : status === 429
          ? "backoff_and_retry"
          : "none";
  }
}

type StoredMockTask = TaskDTO & {
  readonly mockCreatedAt?: string;
};

const MOCK_TASK_STORAGE_KEY = "aa.ui.mock.tasks.v1";

function cloneMockTasks(tasks: readonly TaskDTO[]): StoredMockTask[] {
  return tasks.map((task) => ({ ...task }));
}

function readStoredMockTasks(): StoredMockTask[] | null {
  if (typeof window === "undefined" || window.localStorage == null) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(MOCK_TASK_STORAGE_KEY);
    if (raw == null || raw.trim().length === 0) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is StoredMockTask => (
      item != null
      && typeof item === "object"
      && typeof (item as { id?: unknown }).id === "string"
      && typeof (item as { title?: unknown }).title === "string"
      && typeof (item as { domainId?: unknown }).domainId === "string"
    ));
  } catch {
    return null;
  }
}

function writeStoredMockTasks(tasks: readonly StoredMockTask[]): void {
  if (typeof window === "undefined" || window.localStorage == null) {
    return;
  }
  try {
    window.localStorage.setItem(MOCK_TASK_STORAGE_KEY, JSON.stringify(tasks.slice(0, 100)));
  } catch {
    // Local mock persistence must never break the UI.
  }
}

function unwrapMockBody(body: unknown): Record<string, unknown> {
  if (body != null && typeof body === "object" && "payload" in body) {
    const payload = (body as { payload?: unknown }).payload;
    return payload != null && typeof payload === "object" ? payload as Record<string, unknown> : {};
  }
  return body != null && typeof body === "object" ? body as Record<string, unknown> : {};
}

function normalizeMockTask(body: unknown): StoredMockTask {
  const payload = unwrapMockBody(body);
  const title = typeof payload.title === "string" && payload.title.trim().length > 0
    ? payload.title.trim()
    : "Untitled task";
  const createdAt = new Date(Date.now()).toISOString();
  return {
    id: typeof payload.id === "string" && payload.id.trim().length > 0
      ? payload.id.trim()
      : generateStableId("task_"),
    title,
    status: "queued",
    domainId: typeof payload.domainId === "string" && payload.domainId.trim().length > 0
      ? payload.domainId.trim()
      : "platform",
    currentStep: "intake",
    owner: typeof payload.owner === "string" && payload.owner.trim().length > 0
      ? payload.owner.trim()
      : "platform-sre",
    evidenceCount: 0,
    timelineDepth: 1,
    executionMode: "mock_dev",
    modelCallStatus: "not_called",
    modelProvider: "minimax",
    modelName: "minimax-m2.7",
    outputSummary: null,
    outputUri: null,
    mockCreatedAt: createdAt,
  };
}

function hasRealModelOutput(task: StoredMockTask): boolean {
  return task.executionMode === "real_model"
    && task.modelCallStatus === "succeeded"
    && (
      (typeof task.outputSummary === "string" && task.outputSummary.trim().length > 0)
      || (typeof task.outputUri === "string" && task.outputUri.trim().length > 0)
    );
}

function applyMockTaskProgress(task: StoredMockTask, now = Date.now()): StoredMockTask {
  if (task.status === "completed" && !hasRealModelOutput(task)) {
    return {
      ...task,
      status: "running",
      currentStep: "waiting-for-real-model-run",
      evidenceCount: 0,
      timelineDepth: Math.max(task.timelineDepth ?? 1, 2),
      executionMode: task.executionMode ?? "mock_dev",
      modelCallStatus: task.modelCallStatus ?? "not_called",
      modelProvider: task.modelProvider ?? "minimax",
      modelName: task.modelName ?? "minimax-m2.7",
      outputSummary: task.outputSummary ?? null,
      outputUri: task.outputUri ?? null,
    };
  }
  if (task.status === "blocked" || task.status === "failed" || task.status === "completed") {
    return task;
  }
  const createdAtMs = task.mockCreatedAt == null ? Number.NaN : Date.parse(task.mockCreatedAt);
  if (!Number.isFinite(createdAtMs)) {
    return task;
  }
  const elapsedMs = now - createdAtMs;
  if (elapsedMs >= 1_500) {
    return {
      ...task,
      status: "running",
      currentStep: "waiting-for-real-model-run",
      evidenceCount: 0,
      timelineDepth: Math.max(task.timelineDepth ?? 1, 2),
      executionMode: task.executionMode ?? "mock_dev",
      modelCallStatus: task.modelCallStatus ?? "not_called",
      modelProvider: task.modelProvider ?? "minimax",
      modelName: task.modelName ?? "minimax-m2.7",
      outputSummary: task.outputSummary ?? null,
      outputUri: task.outputUri ?? null,
    };
  }
  return task;
}

function buildMockWorkflowSteps(task: StoredMockTask): readonly WorkflowRunStepDTO[] {
  const runningStatus = task.status === "queued" ? "running" : "completed";
  const synthesisStatus = task.status === "running" ? "running" : "queued";
  return [
    {
      id: `${task.id}-intake`,
      title: "Capture operator request",
      status: runningStatus,
      executor: task.owner ?? "platform-sre",
      startedAt: task.mockCreatedAt,
      ...(task.status === "queued" ? {} : { completedAt: task.mockCreatedAt }),
    },
    {
      id: `${task.id}-research`,
      title: "Wait for real model gateway execution",
      status: synthesisStatus,
      executor: "agent-research-runner",
      startedAt: task.status === "queued" ? undefined : task.mockCreatedAt,
    },
    {
      id: `${task.id}-deliver`,
      title: "Deliver real model output artifact",
      status: "queued",
      executor: "agent-summarizer",
    },
  ];
}

export class MockTransport {
  private tasks: StoredMockTask[];

  public constructor(private readonly data: MockApiShape = defaultMockApiShape) {
    this.tasks = readStoredMockTasks() ?? cloneMockTasks(data.tasks);
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const payload = this.resolve(request.path, request.method, request.body);
    return {
      status: this.resolveStatus(request.method),
      data: payload as T,
    };
  }

  private resolveStatus(method: RestClientRequest["method"]): number {
    if (method === "POST") {
      return 201;
    }
    if (method === "DELETE") {
      return 204;
    }
    return 200;
  }

  private persistTasks(): void {
    writeStoredMockTasks(this.tasks);
  }

  private listTasks(): readonly StoredMockTask[] {
    this.tasks = this.tasks.map((task) => applyMockTaskProgress(task));
    this.persistTasks();
    return this.tasks;
  }

  private upsertTask(task: StoredMockTask): StoredMockTask {
    this.tasks = [task, ...this.tasks.filter((candidate) => candidate.id !== task.id)];
    this.persistTasks();
    return task;
  }

  private updateTask(path: string, body: unknown): StoredMockTask | null {
    const taskId = path.split("/tasks/")[1]?.split(/[/?#]/)[0] ?? "";
    const payload = unwrapMockBody(body);
    let updated: StoredMockTask | null = null;
    this.tasks = this.tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      updated = {
        ...task,
        ...payload,
        id: task.id,
      } as StoredMockTask;
      return updated;
    });
    this.persistTasks();
    return updated;
  }

  private deleteTask(path: string): void {
    const taskId = path.split("/tasks/")[1]?.split(/[/?#]/)[0] ?? "";
    this.tasks = this.tasks.filter((task) => task.id !== taskId);
    this.persistTasks();
  }

  private resolve(path: string, method: RestClientRequest["method"], body?: unknown):
    | DashboardSnapshotDTO
    | readonly TaskDTO[]
    | readonly WorkflowRunStepDTO[]
    | readonly WorkflowDTO[]
    | readonly ApprovalDTO[]
    | readonly IncidentDTO[]
    | readonly WorkerDTO[]
    | readonly QueueDTO[]
    | readonly AgentDTO[]
    | readonly AnalyticsMetricDTO[]
    | readonly CostReportDTO[]
    | readonly MarketplacePackDTO[]
    | readonly MissionDTO[]
    | readonly MissionMemberDTO[]
    | readonly MissionResourceDTO[]
    | MissionBudgetSummaryDTO
    | readonly ExplanationDTO[]
    | readonly RoleDTO[]
    | readonly FeatureFlagDTO[]
    | readonly ModelConfigDTO[]
    | readonly DomainConfigDTO[]
    | readonly TenantDTO[]
    | readonly WebhookDTO[]
    | readonly UserDTO[]
    | SystemConfigDTO
    | UserPreferenceDTO
    | LeadershipClaimsConsoleDTO
    | DivisionInventorySnapshotDTO
    | { reviewRequest: { requestId: string; familyId: string; requestedBy: string; status: string } }
    | { reviewRequest: { requestId: string; status: string; reviewedBy: string | null } }
    | {
      statusOverride: {
        claimId: string;
        status: string;
        reasonCode: string;
        revokedBy: string;
        revokedAt: string;
        replacementRequired: boolean;
      };
    }
    | { ok: true; body?: unknown } {
    if (path.includes("/metrics")) {
      return this.data.analytics;
    }
    if (path.includes("/dashboard")) {
      return this.data.dashboard;
    }
    if (path.includes("/missions/")) {
      const missionId = path.split("/missions/")[1]?.split("/")[0] ?? "";
      if (path.includes("/members")) {
        return this.data.missionMembers[missionId] ?? [];
      }
      if (path.includes("/tasks")) {
        return this.data.missionTasks[missionId] ?? [];
      }
      if (path.includes("/runs")) {
        return this.data.missionRuns[missionId] ?? [];
      }
      if (path.includes("/evidence")) {
        return this.data.missionEvidence[missionId] ?? [];
      }
      if (path.includes("/knowledge")) {
        return this.data.missionKnowledge[missionId] ?? [];
      }
      if (path.includes("/learning")) {
        return this.data.missionLearning[missionId] ?? [];
      }
      if (path.includes("/budget")) {
        return this.data.missionBudgets[missionId] ?? {
          missionId,
          budgetEnvelopeRef: null,
          status: "not_configured",
        };
      }
    }
    if (path.includes("/missions")) {
      return this.data.missions;
    }
    if (path.includes("/workflow-runs/")) {
      const workflowRunId = path.split("/workflow-runs/")[1]?.split("/")[0] ?? "";
      const task = this.listTasks().find((candidate) => candidate.id === workflowRunId);
      return task == null ? this.data.workflowRunSteps[workflowRunId] ?? [] : buildMockWorkflowSteps(task);
    }
    if (path.includes("/tasks")) {
      if (method === "POST") {
        const task = this.upsertTask(normalizeMockTask(body));
        return { ok: true, body: task };
      }
      if (method === "PUT" || method === "PATCH") {
        return { ok: true, body: this.updateTask(path, body) ?? unwrapMockBody(body) };
      }
      if (method === "DELETE") {
        this.deleteTask(path);
        return { ok: true };
      }
      return this.listTasks();
    }
    if (path.includes("/workflows")) {
      return this.data.workflows;
    }
    if (path.includes("/approvals")) {
      return this.data.approvals;
    }
    if (path.includes("/incidents")) {
      return this.data.incidents;
    }
    if (path.includes("/workers")) {
      return this.data.workers;
    }
    if (path.includes("/queues")) {
      return this.data.queues;
    }
    if (path.includes("/agents")) {
      return this.data.agents;
    }
    if (path.includes("/cost")) {
      return this.data.costs;
    }
    if (path.includes("/marketplace")) {
      return this.data.marketplace;
    }
    if (path.includes("/explanations")) {
      return this.data.explanations;
    }
    if (path.includes("/roles")) {
      return this.data.roles;
    }
    if (path.includes("/feature-flags")) {
      return this.data.featureFlags;
    }
    if (path.includes("/models")) {
      return this.data.models;
    }
    if (path.includes("/domains")) {
      return this.data.domainConfigs;
    }
    if (path.includes("/tenants")) {
      return this.data.tenants;
    }
    if (path.includes("/webhooks")) {
      return this.data.webhooks;
    }
    if (path.includes("/users")) {
      return this.data.users;
    }
    if (path.includes("/system-config")) {
      return this.data.systemConfig;
    }
    if (path.includes("/preferences")) {
      return this.data.preferences;
    }
    if (path.includes("/admin/governance/division-inventory")) {
      return this.data.divisionInventory;
    }
    if (path.includes("/admin/governance/leadership-claims/review-requests")) {
      if (path.endsWith("/approve") || path.endsWith("/reject")) {
        const requestId = path.split("/review-requests/")[1]?.split("/")[0] ?? generateStableId("leadership-claim-review");
        return {
          reviewRequest: {
            requestId,
            status: path.endsWith("/approve") ? "approved" : "rejected",
            reviewedBy: "mock-admin",
          },
        };
      }
      const requestBody = body != null && typeof body === "object" ? body as Record<string, unknown> : {};
      return {
        reviewRequest: {
          requestId: generateStableId("leadership-claim-review"),
          familyId: typeof requestBody.familyId === "string" ? requestBody.familyId : "unknown-family",
          requestedBy: "mock-admin",
          status: "pending",
        },
      };
    }
    if (path.includes("/admin/governance/leadership-claims/") && path.endsWith("/revoke")) {
      const requestBody = body != null && typeof body === "object" ? body as Record<string, unknown> : {};
      const claimId = path.split("/leadership-claims/")[1]?.split("/")[0] ?? generateStableId("leadership-claim");
      return {
        statusOverride: {
          claimId,
          status: "revoked",
          reasonCode: typeof requestBody.reasonCode === "string" ? requestBody.reasonCode : "claim.revoked",
          revokedBy: "mock-admin",
          revokedAt: "2026-05-31T00:00:00.000Z",
          replacementRequired: requestBody.replacementRequired === true,
        },
      };
    }
    if (path.includes("/admin/governance/leadership-claims")) {
      return this.data.leadershipClaims;
    }
    return { ok: true, body };
  }
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

interface PlatformEnvelope<T> {
  readonly requestId?: string;
  readonly data: T;
}

interface ContractEnvelope<T> {
  readonly envelopeId: string;
  readonly schemaVersion: string;
  readonly payload: T;
  readonly idempotencyKey?: string;
}

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
};
const DEFAULT_MAX_JSON_RESPONSE_BYTES = 1_048_576;
const DEFAULT_MAX_JSON_ERROR_BYTES = 262_144;

export class HttpTransport {
  private readonly fetchImplementation: typeof fetch;
  private readonly fallbackTransport: MockTransport | null;
  private readonly retryConfig: { maxRetries: number; baseDelayMs: number; maxDelayMs: number };
  private readonly circuitBreaker: CircuitBreakerState;

  public constructor(private readonly options: HttpTransportOptions) {
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    this.fallbackTransport = options.fallbackToMock === true ? new MockTransport() : null;
    this.retryConfig = DEFAULT_RETRY_CONFIG;
    this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" };
  }

  private shouldRetry(error: unknown, request: RestClientRequest): boolean {
    if (!this.isRetryAllowed(request)) {
      return false;
    }
    if (error instanceof RestHttpError) {
      return error.status >= 500 || error.status === 429;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return false;
    }
    return true;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  private recordFailure(): void {
    this.circuitBreaker.failures += 1;
    this.circuitBreaker.lastFailure = Date.now();
    if (this.circuitBreaker.failures >= DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreaker.state = "open";
    }
  }

  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = "closed";
  }

  private canAttempt(): boolean {
    if (this.circuitBreaker.state === "closed") {
      return true;
    }
    if (this.circuitBreaker.state === "open") {
      const elapsed = Date.now() - this.circuitBreaker.lastFailure;
      if (elapsed >= DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
        this.circuitBreaker.state = "half-open";
        return true;
      }
      return false;
    }
    return this.circuitBreaker.state === "half-open";
  }

  private async readJsonBody<T>(
    response: Response,
    maxBytes: number,
  ): Promise<T | PlatformEnvelope<T> | ContractEnvelope<T>> {
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > maxBytes) {
      throw new Error(`rest.response_too_large:${maxBytes}`);
    }
    return JSON.parse(body) as T | PlatformEnvelope<T> | ContractEnvelope<T>;
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }
    const parsed = await this.readJsonBody<T>(response, DEFAULT_MAX_JSON_RESPONSE_BYTES);
    if (parsed != null && typeof parsed === "object" && "data" in parsed) {
      return (parsed as PlatformEnvelope<T>).data;
    }
    if (parsed != null && typeof parsed === "object" && "envelopeId" in parsed && "schemaVersion" in parsed && "payload" in parsed) {
      return (parsed as ContractEnvelope<T>).payload;
    }
    return parsed as T;
  }

  private isRetryAllowed(request: RestClientRequest): boolean {
    if (request.method === "GET") {
      return true;
    }
    if (request.method === "HEAD" || request.method === "OPTIONS") {
      return true;
    }
    return request.headers.has("Idempotency-Key") || request.headers.has("x-idempotency-key");
  }

  private resolveRequestUrl(path: string): string {
    const trimmed = path.replace(/^\uFEFF+/, "").trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return trimmed;
    }
    const normalizedBaseUrl = this.options.baseUrl.replace(/\/$/, "");
    return `${normalizedBaseUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const url = this.resolveRequestUrl(request.path);
    const requestBody = request.body == null ? null : JSON.stringify(this.wrapRequestBody(request));
    const requestHeaders = new Headers({
      "content-type": "application/json",
      "Accept-Version": this.options.acceptVersion ?? DEFAULT_ACCEPT_VERSION_HEADER,
      ...(this.options.headers ?? {}),
      ...Object.fromEntries(request.headers.entries()),
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt += 1) {
      if (!this.canAttempt()) {
        throw new Error("rest.circuit_open:Circuit breaker is open");
      }

      try {
        const abortController = new AbortController();
        const timeoutMs = request.timeoutMs ?? this.options.timeoutMs ?? 10_000;
        const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
        const onAbort = () => abortController.abort();
        request.signal?.addEventListener("abort", onAbort, { once: true });
        let response: Response;
        try {
          response = await this.fetchImplementation(url, {
            method: request.method,
            headers: requestHeaders,
            body: requestBody,
            credentials: this.options.credentials ?? "same-origin",
            mode: this.options.mode ?? "cors",
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutHandle);
          request.signal?.removeEventListener("abort", onAbort);
        }

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader == null ? Number.NaN : Number(retryAfterHeader);
          const details = await this.readErrorDetails(response);
          throw new RestHttpError(
            response.status,
            Number.isFinite(retryAfterSeconds) ? Math.round(retryAfterSeconds * 1000) : null,
            details,
          );
        }

        this.recordSuccess();
        return {
          status: response.status,
          data: await this.parseResponse<T>(response),
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error, request)) {
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
        break;
      }
    }

    this.recordFailure();
    if (this.shouldFallbackToMock(lastError)) {
      return this.fallbackTransport.send(request);
    }
    throw lastError;
  }

  private shouldFallbackToMock(error: unknown): boolean {
    if (this.fallbackTransport == null) {
      return false;
    }
    if (!(error instanceof RestHttpError)) {
      return true;
    }
    // Local dev can run without auth wiring or every Layer C endpoint; keep
    // production-like errors visible while still letting the UI shell render.
    return error.code === "api.auth_not_configured" || error.status === 404;
  }

  private async readErrorDetails(response: Response): Promise<{ message?: string; code?: string | null }> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return {};
    }
    try {
      const parsed = await this.readJsonBody<unknown>(response.clone(), DEFAULT_MAX_JSON_ERROR_BYTES) as unknown;
      if (parsed == null || typeof parsed !== "object") {
        return {};
      }
      const root = parsed as {
        message?: unknown;
        code?: unknown;
        error?: { message?: unknown; code?: unknown };
      };
      const message = typeof root.error?.message === "string"
        ? root.error.message
        : typeof root.message === "string"
          ? root.message
          : undefined;
      const code = typeof root.error?.code === "string"
        ? root.error.code
        : typeof root.code === "string"
          ? root.code
          : null;
      return { ...(message == null ? {} : { message }), code };
    } catch {
      return {};
    }
  }

  private wrapRequestBody(request: RestClientRequest): unknown {
    if (request.body == null) {
      return null;
    }
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("x-idempotency-key") ?? undefined;
    return {
      envelopeId: generateStableId("env_"),
      schemaVersion: "v4.3",
      payload: request.body,
      ...(idempotencyKey == null ? {} : { idempotencyKey }),
    } satisfies ContractEnvelope<unknown>;
  }
}

function classifyRestHttpError(status: number): RestHttpErrorCategory {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 400 || status === 422) {
    return "validation";
  }
  if (status === 406) {
    return "contract";
  }
  if (status >= 500 || status === 429) {
    return "network";
  }
  return "business";
}

export class DefaultRESTClient implements RESTClient {
  public constructor(
    private readonly transport: RestTransport = (request) => new MockTransport().send(request),
    private readonly interceptors: readonly RestClientInterceptor[] = [],
  ) {}

  public get<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({
      path,
      method: "GET",
      headers: options?.headers ?? new Headers(),
      ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal == null ? {} : { signal: options.signal }),
    });
  }

  public post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({
      path,
      method: "POST",
      headers: options?.headers ?? new Headers(),
      body,
      ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal == null ? {} : { signal: options.signal }),
    });
  }

  public put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({
      path,
      method: "PUT",
      headers: options?.headers ?? new Headers(),
      body,
      ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal == null ? {} : { signal: options.signal }),
    });
  }

  public patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({
      path,
      method: "PATCH",
      headers: options?.headers ?? new Headers(),
      body,
      ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal == null ? {} : { signal: options.signal }),
    });
  }

  public delete<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({
      path,
      method: "DELETE",
      headers: options?.headers ?? new Headers(),
      ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
      ...(options?.signal == null ? {} : { signal: options.signal }),
    });
  }

  private async request<T>(initialRequest: RestClientRequest): Promise<T> {
    let request = initialRequest;
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest != null) {
        request = await interceptor.onRequest(request);
      }
    }

    const dispatchResponse = async (currentRequest: RestClientRequest): Promise<RestClientResponse<T>> => {
      let response: RestClientResponse<T> = await this.transport<T>(currentRequest);
      for (const interceptor of [...this.interceptors].reverse()) {
        if (interceptor.onResponse != null) {
          response = await interceptor.onResponse(response);
        }
      }
      return response;
    };

    let dispatch = dispatchResponse;
    for (const interceptor of [...this.interceptors].reverse()) {
      if (interceptor.intercept == null) {
        continue;
      }
      const currentDispatch = dispatch;
      dispatch = (currentRequest: RestClientRequest) => interceptor.intercept!(currentRequest, currentDispatch);
    }

    return (await dispatch(request)).data;
  }
}

export function createRuntimeRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  const baseUrl = options?.baseUrl ?? "/api";
  return new DefaultRESTClient((request) => new HttpTransport({
    baseUrl,
    ...(options?.headers == null ? {} : { headers: options.headers }),
    ...(options?.fetchImplementation == null ? {} : { fetchImplementation: options.fetchImplementation }),
    ...(options?.acceptVersion == null ? {} : { acceptVersion: options.acceptVersion }),
    ...(options?.credentials == null ? {} : { credentials: options.credentials }),
    ...(options?.mode == null ? {} : { mode: options.mode }),
    ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
    fallbackToMock: options?.fallbackToMock ?? false,
  }).send(request));
}

export function createRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  return createRuntimeRESTClient(options);
}
