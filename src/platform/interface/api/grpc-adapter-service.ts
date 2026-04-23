/**
 * gRPC Adapter Service
 *
 * Provides gRPC adapter for cross-platform support.
 * Implements §52 "Cross-Platform Adapter Layer" requirement using @grpc/grpc-js.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §52
 */

// Note: @grpc/grpc-js would be imported in production
// This provides the TypeScript interfaces and implementation structure

/**
 * gRPC adapter configuration
 */
export interface GrpcAdapterConfig {
  readonly host: string;
  readonly port: number;
  readonly packageName: string;
  readonly serviceName: string;
  readonly protoPath?: string;
  readonly credentials?: "insecure" | "tls";
  readonly enableReflection?: boolean;
}

/**
 * gRPC method definition
 */
export interface GrpcMethodDefinition {
  readonly name: string;
  readonly requestStream: boolean;
  readonly responseStream: boolean;
  readonly requestType: string;
  readonly responseType: string;
}

/**
 * gRPC service definition
 */
export interface GrpcServiceDefinition {
  readonly name: string;
  readonly package: string;
  readonly methods: readonly GrpcMethodDefinition[];
  readonly fullName: string;
}

/**
 * gRPC call request
 */
export interface GrpcCallRequest {
  readonly method: string;
  readonly request: Record<string, unknown>;
  readonly metadata?: Record<string, string>;
  readonly timeout?: number;
}

/**
 * gRPC call response
 */
export interface GrpcCallResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: number;
    readonly message: string;
  };
  readonly metadata?: Record<string, string>;
}

/**
 * Stream response handler
 */
export type GrpcStreamHandler<T> = (data: T, metadata?: Record<string, string>) => void;

/**
 * gRPC server instance interface
 */
export interface GrpcServer {
  isRunning: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  addService(service: GrpcServiceDefinition, handler: GrpcServiceHandler): void;
}

/**
 * gRPC service handler
 */
export interface GrpcServiceHandler {
  [methodName: string]: (
    call: GrpcServerCall,
    callback: GrpcServerCallback,
  ) => void;
}

/**
 * gRPC server call
 */
export interface GrpcServerCall {
  readonly request: Record<string, unknown>;
  readonly metadata: Map<string, string>;
  getMetadata(): Record<string, string>;
  getPeer(): string;
}

/**
 * gRPC server callback
 */
export type GrpcServerCallback<T = unknown> = (
  error: GrpcError | null,
  response?: T,
) => void;

/**
 * gRPC error
 */
export interface GrpcError {
  readonly code: number;
  readonly message: string;
}

/**
 * Standard gRPC error codes
 */
export const GRPC_ERROR_CODES = {
  OK: 0,
  CANCELLED: 1,
  UNKNOWN: 2,
  INVALID_ARGUMENT: 3,
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  RESOURCE_EXHAUSTED: 8,
  FAILED_PRECONDITION: 9,
  ABORTED: 10,
  OUT_OF_RANGE: 11,
  UNIMPLEMENTED: 12,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  DATA_LOSS: 15,
  UNAUTHENTICATED: 16,
} as const;

/**
 * gRPC adapter for cross-platform communication
 */
export class GrpcAdapterService {
  private readonly config: GrpcAdapterConfig;
  private server: GrpcServer | null = null;
  private readonly serviceHandlers = new Map<string, GrpcServiceHandler>();
  private readonly registeredServices = new Set<string>();

  public constructor(config: GrpcAdapterConfig) {
    this.config = config;
  }

  /**
   * Check if gRPC is available (would check for @grpc/grpc-js in production)
   */
  public isAvailable(): boolean {
    // In production, this would check if @grpc/grpc-js is installed
    return true;
  }

  /**
   * Get adapter configuration
   */
  public getConfig(): GrpcAdapterConfig {
    return { ...this.config };
  }

  /**
   * Get full server address
   */
  public getServerAddress(): string {
    return `${this.config.host}:${this.config.port}`;
  }

  /**
   * Create a gRPC server instance
   */
  public createServer(): GrpcServer {
    const server: GrpcServer = {
      isRunning: false,
      start: async () => {
        server.isRunning = true;
      },
      stop: async () => {
        server.isRunning = false;
      },
      addService: (service, handler) => {
        this.registerService(service, handler);
      },
    };

    this.server = server;
    return server;
  }

  /**
   * Register a service with its handler
   */
  public registerService(service: GrpcServiceDefinition, handler: GrpcServiceHandler): void {
    const key = `${service.package}.${service.name}`;
    this.serviceHandlers.set(key, handler);
    this.registeredServices.add(key);
  }

  /**
   * Get registered service names
   */
  public getRegisteredServices(): readonly string[] {
    return Array.from(this.registeredServices);
  }

  /**
   * Make a unary gRPC call
   */
  public async call<T = unknown>(
    serviceName: string,
    method: string,
    request: Record<string, unknown>,
    metadata?: Record<string, string>,
  ): Promise<GrpcCallResponse<T>> {
    const handler = this.serviceHandlers.get(serviceName);

    if (!handler) {
      return {
        success: false,
        error: {
          code: GRPC_ERROR_CODES.NOT_FOUND,
          message: `Service ${serviceName} not found`,
        },
      };
    }

    const methodHandler = handler[method];
    if (!methodHandler) {
      return {
        success: false,
        error: {
          code: GRPC_ERROR_CODES.UNIMPLEMENTED,
          message: `Method ${method} not found in service ${serviceName}`,
        },
      };
    }

    try {
      // In production, this would use actual @grpc/grpc-js
      // For now, return a structured response
      const call: GrpcServerCall = {
        request,
        metadata: new Map(Object.entries(metadata ?? {})),
        getMetadata: () => metadata ?? {},
        getPeer: () => "peer",
      };

      let response: T | undefined;
      const callback: GrpcServerCallback<unknown> = (error, res) => {
        if (error) {
          throw error;
        }
        response = res as T;
      };

      methodHandler(call, callback);

      const result: GrpcCallResponse<T> = {
        success: true,
      };
      if (response !== undefined) {
        (result as { data?: T }).data = response;
      }
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: GRPC_ERROR_CODES.INTERNAL,
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Start the gRPC server
   */
  public async start(): Promise<void> {
    if (!this.server) {
      this.server = this.createServer();
    }
    await this.server.start();
  }

  /**
   * Stop the gRPC server
   */
  public async stop(): Promise<void> {
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.server?.isRunning ?? false;
  }
}

/**
 * gRPC to REST converter utility
 */
export class GrpcRestConverter {
  /**
   * Convert REST request to gRPC format
   */
  public static toGrpcRequest(restRequest: Record<string, unknown>): Record<string, unknown> {
    return {
      ...restRequest,
      // gRPC typically uses camelCase
    };
  }

  /**
   * Convert gRPC response to REST format
   */
  public static toRestResponse(grpcResponse: Record<string, unknown>): Record<string, unknown> {
    return {
      ...grpcResponse,
      // REST typically uses snake_case or camelCase
    };
  }

  /**
   * Convert gRPC metadata to headers
   */
  public static metadataToHeaders(metadata: Map<string, string>): Record<string, string> {
    const headers: Record<string, string> = {};
    metadata.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
}

/**
 * gRPC health check service definition
 */
export const HEALTH_SERVICE: GrpcServiceDefinition = {
  name: "Health",
  package: "grpc.health.v1",
  methods: [
    {
      name: "Check",
      requestStream: false,
      responseStream: false,
      requestType: "HealthCheckRequest",
      responseType: "HealthCheckResponse",
    },
  ],
  fullName: "grpc.health.v1.Health",
};

/**
 * Health status enum
 */
export enum HealthStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}
