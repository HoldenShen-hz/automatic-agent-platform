import { setTimeout as delay } from "node:timers/promises";

import { AppError, ValidationError } from "../../contracts/errors.js";
import { GrpcAdapterService, type GrpcCallResponse } from "../../interface/api/grpc-adapter-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export type AdapterProtocol = "rest" | "grpc" | "mq";

export interface AdapterRetryPolicy {
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
  readonly backoffMultiplier?: number;
  readonly backoffMaxMs?: number;
  readonly jitterPercent?: number;
}

export interface AdapterDescriptor {
  readonly adapterId: string;
  readonly protocol: AdapterProtocol;
  readonly endpoint: string;
  readonly timeoutMs?: number;
  readonly retryPolicy?: AdapterRetryPolicy;
  readonly headers?: Readonly<Record<string, string>>;
  readonly grpc?: {
    readonly packageName: string;
    readonly serviceName: string;
    readonly host?: string;
    readonly port?: number;
  };
}

export interface AdapterExecutionContext {
  readonly taskId: string;
  readonly tenantId?: string | null;
  readonly correlationId?: string | null;
}

export interface AdapterExecutionRequest {
  readonly action: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly context: AdapterExecutionContext;
}

export interface AdapterExecutionResult {
  readonly adapterId: string;
  readonly protocol: AdapterProtocol;
  readonly action: string;
  readonly status: "ok" | "error";
  readonly attempts: number;
  readonly durationMs: number;
  readonly output: unknown;
}

export interface AdapterExecutorOptions {
  readonly fetchImpl?: typeof fetch;
  readonly grpcFactory?: (descriptor: AdapterDescriptor) => GrpcAdapterService;
  readonly mqDispatcher?: (
    descriptor: AdapterDescriptor,
    request: AdapterExecutionRequest,
  ) => Promise<unknown>;
}

export class AdapterExecutor {
  private readonly descriptors = new Map<string, AdapterDescriptor>();
  private readonly fetchImpl: typeof fetch;
  private readonly grpcFactory: (descriptor: AdapterDescriptor) => GrpcAdapterService;
  private readonly mqDispatcher: AdapterExecutorOptions["mqDispatcher"];

  public constructor(options: AdapterExecutorOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.grpcFactory = options.grpcFactory ?? ((descriptor) => {
      const [host, rawPort] = descriptor.endpoint.split(":");
      return new GrpcAdapterService({
        host: descriptor.grpc?.host ?? host ?? "127.0.0.1",
        port: descriptor.grpc?.port ?? Number(rawPort ?? 50051),
        packageName: descriptor.grpc?.packageName ?? "adapter.runtime.v1",
        serviceName: descriptor.grpc?.serviceName ?? descriptor.adapterId,
      });
    });
    this.mqDispatcher = options.mqDispatcher;
  }

  public register(descriptor: AdapterDescriptor): void {
    if (this.descriptors.has(descriptor.adapterId)) {
      throw new ValidationError("adapter_executor.adapter_already_registered", "Adapter descriptor is already registered.", {
        details: { adapterId: descriptor.adapterId },
      });
    }
    this.descriptors.set(descriptor.adapterId, descriptor);
  }

  public listAdapters(): readonly AdapterDescriptor[] {
    return [...this.descriptors.values()];
  }

  public async execute(adapterId: string, request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    const descriptor = this.descriptors.get(adapterId);
    if (descriptor == null) {
      throw new ValidationError("adapter_executor.adapter_not_found", "Adapter descriptor is not registered.", {
        details: { adapterId },
      });
    }

    const maxAttempts = Math.max(1, descriptor.retryPolicy?.maxAttempts ?? 1);
    const baseBackoffMs = Math.max(0, descriptor.retryPolicy?.backoffMs ?? 100);
    const backoffMultiplier = Math.max(1, descriptor.retryPolicy?.backoffMultiplier ?? 2);
    const backoffMaxMs = Math.max(baseBackoffMs, descriptor.retryPolicy?.backoffMaxMs ?? 30_000);
    const jitterPercent = Math.max(0, Math.min(100, descriptor.retryPolicy?.jitterPercent ?? 10));
    const startedAt = Date.now();
    let attempt = 0;
    let lastError: unknown = null;

    // Generate idempotency key for this execution attempt
    const idempotencyKey = `${adapterId}:${request.action}:${request.context.taskId}:${request.context.tenantId ?? "unknown"}`;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        // Check idempotency if this is a retry
        if (attempt > 1) {
          // In production, check a distributed cache (Redis) for the idempotency key
          // to prevent duplicate execution on retries after partial failures
          const cachedResult = await this.checkIdempotencyCache(idempotencyKey, attempt);
          if (cachedResult != null) {
            return {
              ...cachedResult,
              attempts: attempt,
              durationMs: Date.now() - startedAt,
            };
          }
        }

        const output = await this.dispatch(descriptor, request);

        // Cache successful result for idempotency
        const result = {
          adapterId,
          protocol: descriptor.protocol,
          action: request.action,
          status: "ok" as const,
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          output,
        };
        await this.cacheIdempotencyResult(idempotencyKey, attempt, result);

        return result;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          // Calculate exponential backoff with jitter
          const exponentialDelay = Math.min(baseBackoffMs * Math.pow(backoffMultiplier, attempt - 1), backoffMaxMs);
          const jitter = exponentialDelay * (jitterPercent / 100) * Math.random();
          const totalDelay = Math.round(exponentialDelay + jitter);
          await delay(totalDelay);
        }
      }
    }

    // Retry exhaustion: emit proper error events per §12.1
    const errorCode = lastError instanceof Error ? lastError.message : String(lastError);
    logger.error("adapter_executor:retry_exhausted", {
      adapterId,
      action: request.action,
      attempts: maxAttempts,
      errorCode,
      taskId: request.context.taskId,
      tenantId: request.context.tenantId,
    });

    // Emit incident/error event for retry exhaustion
    logger.log({
      level: "error",
      message: `adapter_executor:retry_exhausted`,
      crosscuttingFabric: "reliability",
      data: {
        adapterId,
        action: request.action,
        attempts: maxAttempts,
        errorCode,
        taskId: request.context.taskId,
        tenantId: request.context.tenantId,
        correlationId: request.context.correlationId,
      },
    });

    return {
      adapterId,
      protocol: descriptor.protocol,
      action: request.action,
      status: "error",
      attempts: attempt,
      durationMs: Date.now() - startedAt,
      output: {
        error: errorCode,
        error_code: "RETRY_EXHAUSTED",
        attempts: attempt,
        lastError: lastError instanceof Error ? lastError.message : String(lastError),
      },
    };
  }

  /**
   * Check idempotency cache for a previously cached result.
   * Uses in-memory Map with TTL for idempotency. In production, replace with Redis.
   */
  private async checkIdempotencyCache(
    idempotencyKey: string,
    attempt: number,
  ): Promise<AdapterExecutionResult | null> {
    // Skip idempotency check on first attempt
    if (attempt <= 1) {
      return null;
    }
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached != null) {
      // Expired or already used - don't return cached result
      if (cached.expiresAt < Date.now()) {
        this.idempotencyCache.delete(idempotencyKey);
        return null;
      }
      // Mark as consumed to prevent double-use
      this.idempotencyCache.delete(idempotencyKey);
      return cached.result;
    }
    return null;
  }

  /**
   * Cache successful result for idempotency with TTL.
   * Uses in-memory Map. In production, replace with Redis.
   */
  private async cacheIdempotencyResult(
    idempotencyKey: string,
    attempt: number,
    result: AdapterExecutionResult,
  ): Promise<void> {
    // Only cache successful results for idempotency
    if (result.status !== "ok") {
      return;
    }
    // TTL of 5 minutes for idempotency window
    const TTL_MS = 5 * 60 * 1000;
    this.idempotencyCache.set(idempotencyKey, {
      result,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  private readonly idempotencyCache = new Map<string, { result: AdapterExecutionResult; expiresAt: number }>();

  private async dispatch(descriptor: AdapterDescriptor, request: AdapterExecutionRequest): Promise<unknown> {
    switch (descriptor.protocol) {
      case "rest":
        return this.invokeRest(descriptor, request);
      case "grpc":
        return this.invokeGrpc(descriptor, request);
      case "mq":
        return this.invokeMq(descriptor, request);
      default:
        throw new ValidationError("adapter_executor.protocol_not_supported", "Adapter protocol is not supported.", {
          details: { adapterId: descriptor.adapterId, protocol: descriptor.protocol },
        });
    }
  }

  private async invokeRest(descriptor: AdapterDescriptor, request: AdapterExecutionRequest): Promise<unknown> {
    const response = await this.fetchImpl(descriptor.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...descriptor.headers,
      },
      body: JSON.stringify({
        action: request.action,
        context: request.context,
        payload: request.payload,
      }),
      signal: AbortSignal.timeout(descriptor.timeoutMs ?? 5_000),
    });
    if (response.status === 204 || response.status === 205) {
      if (!response.ok) {
        throw new Error(`adapter_executor.rest_failed:${response.status}`);
      }
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error(`adapter_executor.rest_failed:${response.status}`);
    }
    return body;
  }

  private async invokeGrpc(descriptor: AdapterDescriptor, request: AdapterExecutionRequest): Promise<unknown> {
    const adapter = this.grpcFactory(descriptor);
    const serviceName = descriptor.grpc == null
      ? descriptor.adapterId
      : `${descriptor.grpc.packageName}.${descriptor.grpc.serviceName}`;
    const response: GrpcCallResponse = await adapter.call(
      serviceName,
      request.action,
      {
        payload: request.payload,
        context: request.context,
      },
      descriptor.headers,
    );
    if (!response.success) {
      throw new Error(response.error?.message ?? "adapter_executor.grpc_failed");
    }
    return response.data ?? null;
  }

  private async invokeMq(descriptor: AdapterDescriptor, request: AdapterExecutionRequest): Promise<unknown> {
    if (this.mqDispatcher == null) {
      throw new ValidationError("adapter_executor.mq_dispatcher_missing", "MQ adapter requires a dispatcher.", {
        details: { adapterId: descriptor.adapterId },
      });
    }
    return this.mqDispatcher(descriptor, request);
  }
}
