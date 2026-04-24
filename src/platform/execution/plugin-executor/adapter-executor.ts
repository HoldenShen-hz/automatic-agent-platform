import { setTimeout as delay } from "node:timers/promises";

import { ValidationError } from "../../contracts/errors.js";
import { GrpcAdapterService, type GrpcCallResponse } from "../../interface/api/grpc-adapter-service.js";

export type AdapterProtocol = "rest" | "grpc" | "mq";

export interface AdapterRetryPolicy {
  readonly maxAttempts?: number;
  readonly backoffMs?: number;
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
    const backoffMs = Math.max(0, descriptor.retryPolicy?.backoffMs ?? 0);
    const startedAt = Date.now();
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const output = await this.dispatch(descriptor, request);
        return {
          adapterId,
          protocol: descriptor.protocol,
          action: request.action,
          status: "ok",
          attempts: attempt,
          durationMs: Date.now() - startedAt,
          output,
        };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts && backoffMs > 0) {
          await delay(backoffMs);
        }
      }
    }

    return {
      adapterId,
      protocol: descriptor.protocol,
      action: request.action,
      status: "error",
      attempts: attempt,
      durationMs: Date.now() - startedAt,
      output: {
        error: lastError instanceof Error ? lastError.message : String(lastError),
      },
    };
  }

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
